import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { basename, extname, join, normalize, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { build } from 'esbuild';

const execFileAsync = promisify(execFile);
const validateOnly = process.argv.includes('--validate-only');
const root = process.cwd();
const sourceDir = join(root, 'src');
const buildDir = join(root, 'build');
const manifestPath = join(root, 'manifest.json');
const clockfaces = [];
const ids = new Set();

if (!existsSync(sourceDir)) {
  await writeRootManifest([]);
  process.exit(0);
}

const entries = (await readdir(sourceDir, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right));

for (const folderName of entries) {
  const folder = join(sourceDir, folderName);
  const sourceManifestPath = join(folder, 'manifest.json');

  if (!existsSync(sourceManifestPath)) {
    throw new Error(`${sourceManifestPath} is missing.`);
  }

  const manifest = JSON.parse(await readText(sourceManifestPath));
  const id = normalizeClockfaceId(manifest.id ?? folderName);
  const entry = normalizeRelativePath(manifest.entry, 'entry', sourceManifestPath);
  const picture = normalizeRelativePath(manifest.picture ?? './picture.png', 'picture', sourceManifestPath);
  const entryPath = join(folder, entry);
  const picturePath = join(folder, picture);

  if (ids.has(id)) {
    throw new Error(`Duplicate clockface id "${id}".`);
  }

  ids.add(id);

  if (!existsSync(entryPath)) {
    throw new Error(`${sourceManifestPath} points to missing entry "${manifest.entry}".`);
  }

  if (!existsSync(picturePath)) {
    throw new Error(`${sourceManifestPath} points to missing picture "${manifest.picture ?? './picture.png'}".`);
  }

  const outputDir = join(buildDir, id);
  const moduleName = `${id}.mjs`;
  const outputModulePath = join(outputDir, moduleName);

  clockfaces.push({
    id,
    name: normalizeOptionalString(manifest.name) ?? id,
    description: normalizeOptionalString(manifest.description),
    author: normalizeOptionalString(manifest.author),
    ...(await getClockfaceGitDates(folder)),
    sourceFiles: await listClockfaceSourceFiles(folder),
    sourceFolder: folder,
    sourceManifestPath,
    entryPath,
    picturePath,
    outputDir,
    outputModulePath,
    moduleName,
    pictureName: basename(picturePath)
  });
}

if (!validateOnly) {
  await rm(buildDir, { force: true, recursive: true });
}

for (const clockface of clockfaces) {
  await build({
    entryPoints: [clockface.entryPath],
    outfile: validateOnly ? undefined : clockface.outputModulePath,
    bundle: true,
    format: 'esm',
    loader: {
      '.gif': 'dataurl',
      '.jpeg': 'dataurl',
      '.jpg': 'dataurl',
      '.png': 'dataurl',
      '.webp': 'dataurl'
    },
    platform: 'node',
    target: 'node22',
    packages: 'external',
    write: !validateOnly,
    logLevel: 'silent'
  });

  if (!validateOnly) {
    await mkdir(clockface.outputDir, { recursive: true });
    await copyClockfaceAssets(clockface);
  }
}

if (!validateOnly) {
  await writeRootManifest(clockfaces);
}

async function copyClockfaceAssets(clockface) {
  const files = await readdir(clockface.sourceFolder, { withFileTypes: true });

  for (const file of files) {
    if (file.isDirectory()) {
      await cp(join(clockface.sourceFolder, file.name), join(clockface.outputDir, file.name), {
        recursive: true
      });
      continue;
    }

    if (file.name === 'manifest.json' || extname(file.name) === '.ts') {
      continue;
    }

    await cp(join(clockface.sourceFolder, file.name), join(clockface.outputDir, file.name));
  }
}

async function writeRootManifest(nextClockfaces) {
  const body = {
    version: 1,
    generatedAt: nextClockfaces.length > 0 ? new Date().toISOString() : null,
    clockfaces: nextClockfaces.map((clockface) => ({
      id: clockface.id,
      name: clockface.name,
      ...(clockface.description ? { description: clockface.description } : {}),
      ...(clockface.author ? { author: clockface.author } : {}),
      ...(clockface.createdAt ? { createdAt: clockface.createdAt } : {}),
      ...(clockface.updatedAt ? { updatedAt: clockface.updatedAt } : {}),
      module: `./build/${clockface.id}/${clockface.moduleName}`,
      picture: `./build/${clockface.id}/${clockface.pictureName}`,
      source: `./src/${basename(clockface.sourceFolder)}/manifest.json`,
      sourceFiles: clockface.sourceFiles
    }))
  };

  await writeFile(manifestPath, `${JSON.stringify(body, null, 2)}\n`, 'utf-8');
}

async function readText(path) {
  return (await import('node:fs/promises')).readFile(path, 'utf-8');
}

function normalizeClockfaceId(value) {
  const id = String(value ?? '').trim().replace(/[^\w-]/g, '');

  if (!id) {
    throw new Error('Clockface id cannot be empty.');
  }

  return id;
}

function normalizeRelativePath(value, field, manifestFile) {
  const raw = String(value ?? '').trim().replace(/^\.\/+/, '');

  if (!raw || raw.includes('\0') || raw.startsWith('/') || raw.split(/[\\/]/).includes('..')) {
    throw new Error(`${manifestFile} has invalid ${field} path "${value}".`);
  }

  const normalized = normalize(raw);
  const absolute = resolve(join(manifestFile, '..'), normalized);
  const folder = resolve(join(manifestFile, '..'));

  if (relative(folder, absolute).startsWith('..')) {
    throw new Error(`${manifestFile} has ${field} path outside its folder.`);
  }

  return normalized;
}

function normalizeOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

async function listClockfaceSourceFiles(folder) {
  const files = [];
  await collectClockfaceSourceFiles(folder, folder, files);
  return files.sort((left, right) => left.localeCompare(right));
}

async function collectClockfaceSourceFiles(rootFolder, folder, files) {
  const entries = (await readdir(folder, { withFileTypes: true })).sort((left, right) =>
    left.name.localeCompare(right.name)
  );

  for (const entry of entries) {
    const path = join(folder, entry.name);

    if (entry.isDirectory()) {
      await collectClockfaceSourceFiles(rootFolder, path, files);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const relativePath = normalize(relative(root, path)).replaceAll('\\', '/');

    if (!relativePath.startsWith(`src/${basename(rootFolder)}/`)) {
      throw new Error(`${path} is outside of its clockface folder.`);
    }

    files.push(`./${relativePath}`);
  }
}

async function getClockfaceGitDates(folder) {
  const gitPath = normalize(relative(root, folder)).replaceAll('\\', '/');
  const [createdAt, updatedAt] = await Promise.all([
    getGitLogDate(['log', '--format=%aI', '--reverse', '--', gitPath], 'first'),
    getGitLogDate(['log', '--format=%aI', '-1', '--', gitPath], 'first')
  ]);

  return {
    ...(createdAt ? { createdAt } : {}),
    ...(updatedAt ? { updatedAt } : {})
  };
}

async function getGitLogDate(args, mode) {
  try {
    const { stdout } = await execFileAsync('git', args, { cwd: root });
    const lines = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (mode === 'first') {
      return lines[0];
    }

    return lines.at(-1);
  } catch {
    return undefined;
  }
}
