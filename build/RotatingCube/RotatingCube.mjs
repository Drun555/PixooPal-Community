// src/RotatingCube/RotatingCube.ts
import {
  defineClockface,
  data,
  input,
  color
} from "@pixoopal/clockface";
var RESOLUTION = 32;
var UPDATE_INTERVAL_MS = 100;
var DEFAULT_DATA = {
  cubeColor: "#6ee7d8",
  borderColor: "#ecfcff",
  displayResolution: "64"
};
var BACKGROUND_TOP = [4, 8, 16];
var BACKGROUND_BOTTOM = [1, 2, 5];
var CAMERA_DISTANCE = 4.4;
var PERSPECTIVE = 31;
var CUBE_SCALE = 1.15;
var EDGE_FILL_TOLERANCE = 0.7;
var VERTICES = [
  { x: -1, y: -1, z: -1 },
  { x: 1, y: -1, z: -1 },
  { x: 1, y: 1, z: -1 },
  { x: -1, y: 1, z: -1 },
  { x: -1, y: -1, z: 1 },
  { x: 1, y: -1, z: 1 },
  { x: 1, y: 1, z: 1 },
  { x: -1, y: 1, z: 1 }
];
var FACES = [
  [0, 1, 2, 3],
  [4, 7, 6, 5],
  [0, 4, 5, 1],
  [3, 2, 6, 7],
  [1, 5, 6, 2],
  [0, 3, 7, 4]
];
var EDGES = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7]
];
var angle = 0;
var RotatingCube_default = defineClockface({
  resolution: (context) => getDisplayResolution(context.data.displayResolution),
  frameQueueSize: 0,
  data: {
    cubeColor: data.color(DEFAULT_DATA.cubeColor),
    borderColor: data.color(DEFAULT_DATA.borderColor),
    displayResolution: data.select(DEFAULT_DATA.displayResolution)
  },
  inputs: [
    input.select(
      "displayResolution",
      "Resolution",
      [
        { value: "32", label: "32x32" },
        { value: "64", label: "64x64" }
      ],
      {
        isSetting: true
      }
    ),
    input.color("cubeColor", "Cube color", {
      onSubmit: (value, context) => {
        context.data.cubeColor = String(value);
        renderCube(context);
      }
    }),
    input.color("borderColor", "Border color", {
      onSubmit: (value, context) => {
        context.data.borderColor = String(value);
        renderCube(context);
      }
    })
  ],
  interval: UPDATE_INTERVAL_MS,
  setup: renderCube,
  render: (context) => {
    angle += 0.07;
    renderCube(context);
  }
});
function renderCube(context) {
  const cubeColor = parseHexColor(context.data.cubeColor, DEFAULT_DATA.cubeColor);
  const borderColor = parseHexColor(context.data.borderColor, DEFAULT_DATA.borderColor);
  const rotated = VERTICES.map((vertex) => rotateVertex(scaleVertex(vertex, CUBE_SCALE), angle));
  const projected = rotated.map((vertex) => projectVertex(vertex, context.resolution));
  const faces = FACES.map((face) => createFace(face, rotated, projected, cubeColor)).sort(
    (left, right) => left.depth - right.depth
  );
  drawBackground(context);
  drawShadow(context, projected);
  for (const face of faces) {
    drawFace(context, face);
  }
  for (const [start, end] of EDGES) {
    drawLine(context, projected[start], projected[end], borderColor, 0.46);
  }
}
function createFace(indexes, rotated, projected, baseColor) {
  const points = indexes.map((index) => projected[index]);
  const normal = normalize(cross(subtract(rotated[indexes[1]], rotated[indexes[0]]), subtract(rotated[indexes[2]], rotated[indexes[0]])));
  const light = normalize({ x: -0.45, y: -0.7, z: 0.95 });
  const lightAmount = Math.max(0, dot(normal, light));
  const viewAmount = Math.max(0, normal.z) * 0.18;
  const shade = 0.34 + lightAmount * 0.48 + viewAmount;
  return {
    points,
    color: shadePixel(baseColor, shade),
    depth: indexes.reduce((sum, index) => sum + rotated[index].z, 0) / indexes.length
  };
}
function drawBackground(context) {
  for (let y = 0; y < context.resolution; y += 1) {
    const amount = y / Math.max(1, context.resolution - 1);
    for (let x = 0; x < context.resolution; x += 1) {
      setPixel(context, x, y, mixPixel(BACKGROUND_TOP, BACKGROUND_BOTTOM, amount));
    }
  }
}
function drawShadow(context, points) {
  const scale = context.resolution / RESOLUTION;
  const centerX = points.reduce((sum, point) => sum + point.screenX, 0) / points.length;
  const lowestY = Math.max(...points.map((point) => point.screenY));
  const radiusX = 17 * scale;
  const radiusY = 5 * scale;
  const shadowY = Math.min(context.resolution - 7 * scale, lowestY + 6 * scale);
  for (let y = Math.floor(shadowY - radiusY); y <= Math.ceil(shadowY + radiusY); y += 1) {
    for (let x = Math.floor(centerX - radiusX); x <= Math.ceil(centerX + radiusX); x += 1) {
      const dx = (x - centerX) / radiusX;
      const dy = (y - shadowY) / radiusY;
      const distance = dx * dx + dy * dy;
      if (distance <= 1) {
        blendPixel(context, x, y, [0, 0, 0], (1 - distance) * 0.38);
      }
    }
  }
}
function drawFace(context, face) {
  fillPolygon(context, face.points, face.color);
}
function fillPolygon(context, points, color2) {
  const minX = Math.max(0, Math.floor(Math.min(...points.map((point) => point.screenX)) - 1));
  const maxX = Math.min(
    context.resolution - 1,
    Math.ceil(Math.max(...points.map((point) => point.screenX)) + 1)
  );
  const minY = Math.max(0, Math.floor(Math.min(...points.map((point) => point.screenY)) - 1));
  const maxY = Math.min(
    context.resolution - 1,
    Math.ceil(Math.max(...points.map((point) => point.screenY)) + 1)
  );
  if (points.length < 3) {
    return;
  }
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const sampleX = x + 0.5;
      const sampleY = y + 0.5;
      if (isInsideConvexPolygon(points, sampleX, sampleY) || isNearPolygonEdge(points, sampleX, sampleY)) {
        setPixel(context, x, y, color2);
      }
    }
  }
}
function drawLine(context, start, end, color2, opacity) {
  const dx = end.screenX - start.screenX;
  const dy = end.screenY - start.screenY;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let step = 0; step <= steps; step += 1) {
    const amount = step / steps;
    const x = Math.round(start.screenX + dx * amount);
    const y = Math.round(start.screenY + dy * amount);
    blendPixel(context, x, y, color2, opacity);
  }
}
function projectVertex(vertex, resolution) {
  const depth = CAMERA_DISTANCE - vertex.z;
  const scale = PERSPECTIVE * resolution / RESOLUTION / depth;
  return {
    ...vertex,
    screenX: resolution / 2 + vertex.x * scale,
    screenY: resolution / 2 + vertex.y * scale
  };
}
function rotateVertex(vertex, rotation) {
  const yRotation = rotation;
  const xRotation = rotation * 0.68;
  const zRotation = rotation * 0.22;
  const cosY = Math.cos(yRotation);
  const sinY = Math.sin(yRotation);
  const yRotated = {
    x: vertex.x * cosY + vertex.z * sinY,
    y: vertex.y,
    z: -vertex.x * sinY + vertex.z * cosY
  };
  const cosX = Math.cos(xRotation);
  const sinX = Math.sin(xRotation);
  const xRotated = {
    x: yRotated.x,
    y: yRotated.y * cosX - yRotated.z * sinX,
    z: yRotated.y * sinX + yRotated.z * cosX
  };
  const cosZ = Math.cos(zRotation);
  const sinZ = Math.sin(zRotation);
  return {
    x: xRotated.x * cosZ - xRotated.y * sinZ,
    y: xRotated.x * sinZ + xRotated.y * cosZ,
    z: xRotated.z
  };
}
function scaleVertex(vertex, scale) {
  return {
    x: vertex.x * scale,
    y: vertex.y * scale,
    z: vertex.z * scale
  };
}
function edge(a, b, x, y) {
  return (x - a.screenX) * (b.screenY - a.screenY) - (y - a.screenY) * (b.screenX - a.screenX);
}
function isInsideConvexPolygon(points, x, y) {
  let sign = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const value = edge(current, next, x, y);
    if (Math.abs(value) <= Number.EPSILON) {
      continue;
    }
    const nextSign = Math.sign(value);
    if (sign !== 0 && nextSign !== sign) {
      return false;
    }
    sign = nextSign;
  }
  return true;
}
function isNearPolygonEdge(points, x, y) {
  for (let index = 0; index < points.length; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    if (distanceToSegment(start, end, x, y) <= EDGE_FILL_TOLERANCE) {
      return true;
    }
  }
  return false;
}
function distanceToSegment(start, end, x, y) {
  const dx = end.screenX - start.screenX;
  const dy = end.screenY - start.screenY;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return Math.hypot(x - start.screenX, y - start.screenY);
  }
  const amount = Math.max(
    0,
    Math.min(1, ((x - start.screenX) * dx + (y - start.screenY) * dy) / lengthSquared)
  );
  const projectionX = start.screenX + dx * amount;
  const projectionY = start.screenY + dy * amount;
  return Math.hypot(x - projectionX, y - projectionY);
}
function subtract(a, b) {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z
  };
}
function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}
function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function normalize(vector) {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length
  };
}
function shadePixel(color2, shade) {
  return color2.map((channel) => clampColor(channel * shade));
}
function mixPixel(start, end, amount) {
  const clamped = Math.max(0, Math.min(1, amount));
  return [
    Math.round(start[0] + (end[0] - start[0]) * clamped),
    Math.round(start[1] + (end[1] - start[1]) * clamped),
    Math.round(start[2] + (end[2] - start[2]) * clamped)
  ];
}
function blendPixel(context, x, y, color2, opacity) {
  if (x < 0 || y < 0 || x >= context.resolution || y >= context.resolution) {
    return;
  }
  const current = context.canvas.buffer[x + y * context.resolution];
  context.canvas.pixel(x, y, mixPixel(current, color2, opacity));
}
function setPixel(context, x, y, color2) {
  context.canvas.pixel(x, y, color2);
}
function parseHexColor(value, fallback) {
  try {
    return color.parse(String(value ?? fallback));
  } catch {
    return color.parse(fallback);
  }
}
function clampColor(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}
function getDisplayResolution(value) {
  return value === "32" ? 32 : 64;
}
export {
  RotatingCube_default as default
};
