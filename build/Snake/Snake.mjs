// src/Snake/Snake.ts
import {
  defineClockface,
  data,
  input
} from "@pixoopal/clockface";
var RESOLUTION = 32;
var CELL_SIZE = 2;
var GRID_SIZE = RESOLUTION / CELL_SIZE;
var UPDATE_INTERVAL_MS = 150;
var BACKGROUND = [0, 0, 0];
var SNAKE_HEAD = [143, 244, 190];
var SNAKE_BODY = [59, 204, 142];
var FOOD_COLOR = [255, 76, 101];
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
var Snake_default = defineClockface({
  resolution: RESOLUTION,
  data: {
    score: data.number(0)
  },
  inputs: [
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
  if (snake.length === 0 || gameOverFrames > 0) {
    gameOverFrames -= 1;
    if (gameOverFrames <= 0) {
      resetGame(context);
    }
    return;
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
  drawCell(context, food, FOOD_COLOR);
  snake.forEach((point, index) => {
    drawCell(context, point, index === 0 ? SNAKE_HEAD : SNAKE_BODY);
  });
  if (gameOverFrames > 0) {
    drawGameOverFlash(context);
  }
}
function drawBackground(context) {
  context.canvas.clear(BACKGROUND);
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
function drawGameOverFlash(context) {
  const color = [92, 18, 28];
  for (let index = 0; index < context.buffer.length; index += 1) {
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
