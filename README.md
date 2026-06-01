# PixooPal Community Clockfaces

PixooPal Community is a registry for third-party Clockfaces. Add your Clockface under `src/{ClockfaceName}/`, open a pull request, and GitHub Actions will validate and build it. After merge, the registry build in `build/` and the root `manifest.json` are regenerated automatically.

## Folder Structure

Each Clockface lives in its own folder:

```text
src/MyClockface/
  manifest.json
  picture.png
  MyClockface.ts
  optional-assets...
```

`manifest.json` describes the Clockface:

```json
{
  "entry": "./MyClockface.ts",
  "name": "My Clockface",
  "description": "Short description shown in PixooPal.",
  "picture": "./picture.png"
}
```

Fields:

- `entry`: required TypeScript entry file. It must stay inside the Clockface folder.
- `name`: required display name.
- `description`: optional short description.
- `picture`: optional preview image path. Defaults to `./picture.png`.
- `id`: optional stable ID. If omitted, PixooPal uses the folder name.

## Creating a Clockface

Install dependencies:

```bash
npm install
```

Create a new folder under `src/`, then export a default `Clockface` instance:

```ts
import { Clockface, type ClockfaceContext, type ClockfacePixel } from '@pixoopal/clockface';

export default new Clockface({
  resolution: 64,
  data: {
    text: 'Hello'
  },
  inputs: [
    {
      type: 'input-text',
      id: 'text',
      friendlyName: 'Text',
      onSubmit: (value, context) => {
        context.data.text = String(value);
        render(context);
      }
    }
  ],
  init: render,
  main: render
});

function render(context: ClockfaceContext) {
  clear(context, [0, 0, 0]);
  setPixel(context, 0, 0, [255, 255, 255]);
}

function clear(context: ClockfaceContext, color: ClockfacePixel) {
  for (let index = 0; index < context.buffer.length; index += 1) {
    context.buffer[index] = [...color];
  }
}

function setPixel(context: ClockfaceContext, x: number, y: number, color: ClockfacePixel) {
  if (x < 0 || y < 0 || x >= context.resolution || y >= context.resolution) {
    return;
  }

  context.buffer[x + y * context.resolution] = [...color];
}
```

Run checks before opening a PR:

```bash
npm run check
```

This type-checks all Clockfaces, validates manifests, compiles `.mjs` output, copies assets, and regenerates the root registry manifest.

## SDK Overview

Clockfaces use `@pixoopal/clockface`.

Core import:

```ts
import { Clockface, type ClockfaceContext, type ClockfacePixel } from '@pixoopal/clockface';
```

Useful types:

- `ClockfaceContext`: render context with `resolution`, `data`, `inputs`, `buffer`, and `persistence`.
- `ClockfacePixel`: RGB tuple `[red, green, blue]`.
- `ClockfaceFileInputValue`: uploaded file value for `input-file`.
- `ClockfaceInput`: input definition used by PixooPal UI.

`Clockface` options:

- `resolution`: usually `64`.
- `data`: string key-value state shown and persisted by PixooPal.
- `inputs`: UI controls for settings/actions.
- `init(context)`: runs before first render.
- `main(context)`: renders a frame.
- `updateIntervalMs`: fixed animation interval.
- `getUpdateIntervalMs(context)`: dynamic animation interval.
- `start(context)` / `stop(context)`: optional lifecycle hooks.

Input types:

- `button`
- `colorpicker`
- `input-text`
- `input-num`
- `input-file`
- `select`

## Media Helpers

Use media helpers for GIF/video playback:

```ts
import {
  createMediaAnimation,
  decodeMediaFile,
  drawMediaAnimationFrame,
  isMediaFileInput,
  type MediaAnimation
} from '@pixoopal/clockface/media';
```

Typical flow:

- accept a file with an `input-file`;
- check it with `isMediaFileInput(value)`;
- decode with `decodeMediaFile(value, { resolution: context.resolution })`;
- wrap frames with `createMediaAnimation`;
- draw each frame with `drawMediaAnimationFrame`.

Video decoding requires `ffmpeg` to be available in the runtime environment.

## Bitmap Text Helpers

Use bitmap text helpers for compact text rendering:

```ts
import {
  drawBitmapText,
  getBitmapTextRenderHeight,
  measureBitmapText
} from '@pixoopal/clockface/bitmap-text';
```

Example:

```ts
await drawBitmapText({
  buffer,
  size: context.resolution,
  text: 'PixooPal',
  x: 0,
  y: 0,
  color: [255, 255, 255]
});
```

`drawBitmapText` writes into a flat RGB buffer (`number[]`). To copy it into `context.buffer`:

```ts
const buffer = new Array(context.resolution * context.resolution * 3).fill(0);

await drawBitmapText({
  buffer,
  size: context.resolution,
  text: 'PixooPal',
  x: 0,
  y: 0,
  color: [255, 255, 255]
});

for (let index = 0; index < context.buffer.length; index += 1) {
  const offset = index * 3;
  context.buffer[index] = [
    buffer[offset] ?? 0,
    buffer[offset + 1] ?? 0,
    buffer[offset + 2] ?? 0
  ];
}
```

## Pull Request Rules

- One Clockface per folder.
- Keep all assets inside the Clockface folder.
- Do not reference files outside your folder.
- Do not edit `build/` or root `manifest.json` manually in PRs unless you are intentionally refreshing generated output locally.
- Make sure `npm run check` passes.

On pull requests, CI validates and uploads build artifacts. On `main`, CI commits generated `build/` files and the root `manifest.json`.
