// src/Snake/Snake.ts
import {
  defineClockface,
  data,
  input
} from "@pixoopal/clockface";
var RESOLUTION = 16;
var CELL_SIZE = 1;
var GRID_SIZE = RESOLUTION / CELL_SIZE;
var UPDATE_INTERVAL_MS = 150;
var BACKGROUND = [0, 0, 0];
var SNAKE_HEAD = [143, 244, 190];
var SNAKE_BODY = [59, 204, 142];
var SNAKE_TAIL = [35, 128, 103];
var FOOD_COLOR = [255, 76, 101];
var AUTOPLAY_OPTIONS = [
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" }
];
var OPPOSITE_DIRECTION = {
  up: "down",
  down: "up",
  left: "right",
  right: "left"
};
var snake = [];
var food = { x: 0, y: 0 };
var direction = "right";
var pendingDirection = "right";
var gameOverFrames = 0;
var frame = 0;
var Snake_default = defineClockface({
  resolution: RESOLUTION,
  frameQueueSize: 0,
  data: {
    score: data.number(0),
    autoplay: data.select("no")
  },
  inputs: [
    [
      input.select("autoplay", "Autoplay", AUTOPLAY_OPTIONS, {
        onSubmit: (value, context) => {
          context.data.autoplay = String(value) === "yes" ? "yes" : "no";
          renderSnake(context);
        },
        isSetting: true
      })
    ],
    [
      input.button("up", "\u2191", {
        onSubmit: (_value, context) => {
          turn("up");
          renderSnake(context);
        }
      })
    ],
    [
      input.button("left", "\u2190", {
        onSubmit: (_value, context) => {
          turn("left");
          renderSnake(context);
        }
      }),
      input.button("right", "\u2192", {
        onSubmit: (_value, context) => {
          turn("right");
          renderSnake(context);
        }
      })
    ],
    [
      input.button("down", "\u2193", {
        onSubmit: (_value, context) => {
          turn("down");
          renderSnake(context);
        }
      })
    ]
  ],
  interval: UPDATE_INTERVAL_MS,
  setup: (context) => {
    resetGame(context);
  },
  render: (context) => {
    stepGame(context);
    renderSnake(context);
  }
});
function resetGame(context) {
  snake = [
    { x: 7, y: 8 },
    { x: 6, y: 8 },
    { x: 5, y: 8 }
  ];
  direction = "right";
  pendingDirection = "right";
  gameOverFrames = 0;
  frame = 0;
  context.data.score = "0";
  food = createFood();
  renderSnake(context);
}
function turn(nextDirection) {
  if (OPPOSITE_DIRECTION[nextDirection] === direction) {
    return;
  }
  pendingDirection = nextDirection;
}
function stepGame(context) {
  frame += 1;
  if (snake.length === 0 || gameOverFrames > 0) {
    gameOverFrames -= 1;
    if (gameOverFrames <= 0) {
      resetGame(context);
    }
    return;
  }
  if (isAutoplayEnabled(context)) {
    pendingDirection = getAutoplayDirection();
  }
  direction = pendingDirection;
  const head = snake[0];
  const nextHead = wrapPoint({
    x: head.x + getDirectionDelta(direction).x,
    y: head.y + getDirectionDelta(direction).y
  });
  const eatsFood = nextHead.x === food.x && nextHead.y === food.y;
  const bodyToCheck = eatsFood ? snake : snake.slice(0, -1);
  if (bodyToCheck.some((point) => point.x === nextHead.x && point.y === nextHead.y)) {
    gameOverFrames = 5;
    return;
  }
  snake = [nextHead, ...snake];
  if (eatsFood) {
    context.data.score = String(Number.parseInt(context.data.score || "0", 10) + 1);
    food = createFood();
  } else {
    snake.pop();
  }
}
function renderSnake(context) {
  drawBackground(context);
  drawFood(context);
  snake.forEach((point, index) => {
    drawCell(context, point, getSnakeColor(index));
  });
  if (gameOverFrames > 0) {
    drawGameOverFlash(context);
  }
}
function drawBackground(context) {
  context.canvas.clear(BACKGROUND);
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      if ((x + y + frame) % 8 === 0) {
        context.canvas.pixel(x * CELL_SIZE, y * CELL_SIZE, [2, 9, 12]);
      }
    }
  }
}
function drawCell(context, point, color) {
  const startX = point.x * CELL_SIZE;
  const startY = point.y * CELL_SIZE;
  for (let y = 0; y < CELL_SIZE; y += 1) {
    for (let x = 0; x < CELL_SIZE; x += 1) {
      context.canvas.pixel(startX + x, startY + y, color);
    }
  }
}
function drawFood(context) {
  drawCell(context, food, FOOD_COLOR);
}
function getSnakeColor(index) {
  if (index === 0) {
    return frame % 4 < 2 ? SNAKE_HEAD : [116, 234, 198];
  }
  const progress = snake.length <= 1 ? 0 : index / (snake.length - 1);
  return mixColor(SNAKE_BODY, SNAKE_TAIL, progress);
}
function drawGameOverFlash(context) {
  const color = [92, 18, 28];
  const pixelCount = context.resolution * context.resolution;
  for (let index = 0; index < pixelCount; index += 1) {
    if (index % 5 === 0) {
      context.canvas.pixel(index % context.resolution, Math.floor(index / context.resolution), color);
    }
  }
}
function createFood() {
  const available = [];
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      if (!snake.some((point) => point.x === x && point.y === y)) {
        available.push({ x, y });
      }
    }
  }
  return available[Math.floor(Math.random() * available.length)] ?? { x: 0, y: 0 };
}
function isAutoplayEnabled(context) {
  return context.data.autoplay === "yes";
}
function getAutoplayDirection() {
  const pathDirection = findPathDirection();
  if (pathDirection) {
    return pathDirection;
  }
  return getSafeDirection();
}
function findPathDirection() {
  const head = snake[0];
  const queue = [];
  const visited = /* @__PURE__ */ new Set([pointKey(head)]);
  const bodyToAvoid = snake.slice(0, -1);
  for (const nextDirection of getAvailableDirections()) {
    const nextPoint = getNextPoint(head, nextDirection);
    if (isBodyCollision(nextPoint, bodyToAvoid)) {
      continue;
    }
    queue.push({ point: nextPoint, firstDirection: nextDirection });
    visited.add(pointKey(nextPoint));
  }
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }
    if (current.point.x === food.x && current.point.y === food.y) {
      return current.firstDirection;
    }
    for (const nextDirection of ALL_DIRECTIONS) {
      const nextPoint = getNextPoint(current.point, nextDirection);
      const key = pointKey(nextPoint);
      if (visited.has(key) || isBodyCollision(nextPoint, bodyToAvoid)) {
        continue;
      }
      visited.add(key);
      queue.push({ point: nextPoint, firstDirection: current.firstDirection });
    }
  }
  return null;
}
function getSafeDirection() {
  const head = snake[0];
  const bodyToAvoid = snake.slice(0, -1);
  const directions = getAvailableDirections();
  return directions.map((nextDirection) => ({
    direction: nextDirection,
    point: getNextPoint(head, nextDirection)
  })).filter(({ point }) => !isBodyCollision(point, bodyToAvoid)).sort((a, b) => getWrappedDistance(a.point, food) - getWrappedDistance(b.point, food))[0]?.direction ?? pendingDirection;
}
var ALL_DIRECTIONS = ["up", "right", "down", "left"];
function getAvailableDirections() {
  return ALL_DIRECTIONS.filter((nextDirection) => OPPOSITE_DIRECTION[nextDirection] !== direction);
}
function isBodyCollision(point, body) {
  return body.some((part) => part.x === point.x && part.y === point.y);
}
function getNextPoint(point, nextDirection) {
  const delta = getDirectionDelta(nextDirection);
  return wrapPoint({
    x: point.x + delta.x,
    y: point.y + delta.y
  });
}
function getWrappedDistance(a, b) {
  const dx = Math.min(Math.abs(a.x - b.x), GRID_SIZE - Math.abs(a.x - b.x));
  const dy = Math.min(Math.abs(a.y - b.y), GRID_SIZE - Math.abs(a.y - b.y));
  return dx + dy;
}
function pointKey(point) {
  return `${point.x}:${point.y}`;
}
function mixColor(start, end, amount) {
  return [
    Math.round(start[0] + (end[0] - start[0]) * amount),
    Math.round(start[1] + (end[1] - start[1]) * amount),
    Math.round(start[2] + (end[2] - start[2]) * amount)
  ];
}
function getDirectionDelta(nextDirection) {
  if (nextDirection === "up") {
    return { x: 0, y: -1 };
  }
  if (nextDirection === "down") {
    return { x: 0, y: 1 };
  }
  if (nextDirection === "left") {
    return { x: -1, y: 0 };
  }
  return { x: 1, y: 0 };
}
function wrapPoint(point) {
  return {
    x: (point.x + GRID_SIZE) % GRID_SIZE,
    y: (point.y + GRID_SIZE) % GRID_SIZE
  };
}
export {
  Snake_default as default
};
