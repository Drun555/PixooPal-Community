// src/Tetris/Tetris.ts
import { color, data, defineClockface, input } from "@pixoopal/clockface";
var RESOLUTION = normalizeResolution(Number.parseInt(process.env.RESOLUTION ?? "") ?? 16);
var CELL_SIZE = Math.max(1, Math.floor(RESOLUTION / 16));
var BOARD_WIDTH = Math.floor(RESOLUTION / CELL_SIZE);
var BOARD_HEIGHT = Math.floor(RESOLUTION / CELL_SIZE);
var BOARD_PIXEL_WIDTH = BOARD_WIDTH * CELL_SIZE;
var BOARD_PIXEL_HEIGHT = BOARD_HEIGHT * CELL_SIZE;
var BOARD_LEFT = Math.floor((RESOLUTION - BOARD_PIXEL_WIDTH) / 2);
var BOARD_TOP = Math.floor((RESOLUTION - BOARD_PIXEL_HEIGHT) / 2);
var TICK_MS = 130;
var LOCK_DELAY_FRAMES = 2;
var AUTOPLAY_OPTIONS = [
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" }
];
var PIECES = {
  i: [
    [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 }
    ],
    [
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 2, y: 3 }
    ]
  ],
  j: [
    [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 }
    ],
    [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 }
    ],
    [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 2 }
    ],
    [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 2 }
    ]
  ],
  l: [
    [
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 }
    ],
    [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 2 }
    ],
    [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 0, y: 2 }
    ],
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 }
    ]
  ],
  o: [
    [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 }
    ]
  ],
  s: [
    [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 }
    ],
    [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 2 }
    ]
  ],
  t: [
    [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 }
    ],
    [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 2 }
    ],
    [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 2 }
    ],
    [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 2 }
    ]
  ],
  z: [
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 }
    ],
    [
      { x: 2, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 2 }
    ]
  ]
};
var COLORS = {
  i: [92, 225, 230],
  j: [91, 135, 255],
  l: [255, 164, 72],
  o: [255, 223, 82],
  s: [105, 226, 127],
  t: [190, 110, 255],
  z: [255, 91, 111]
};
var board = createBoard();
var active = createPiece(randomKind());
var next = createPiece(randomKind());
var lockFrames = 0;
var score = 0;
var lines = 0;
var autoPlan = null;
var Tetris_default = defineClockface({
  resolution: RESOLUTION,
  interval: TICK_MS,
  frameQueueSize: 0,
  data: {
    autoplay: data.select("no")
  },
  inputs: [
    [
      input.select("autoplay", "AutoPlay", AUTOPLAY_OPTIONS, {
        isSetting: true,
        onSubmit(value, context) {
          context.data.autoplay = String(value) === "yes" ? "yes" : "no";
          autoPlan = null;
        }
      })
    ],
    [
      input.button("left", "Left", {
        onSubmit: (_value, context) => {
          moveActive(-1, 0);
          renderTetris(context);
        }
      }),
      input.button("rotate", "Rotate", {
        onSubmit: (_value, context) => {
          rotateActive();
          renderTetris(context);
        }
      }),
      input.button("right", "Right", {
        onSubmit: (_value, context) => {
          moveActive(1, 0);
          renderTetris(context);
        }
      })
    ],
    [
      input.button("drop", "Drop", {
        onSubmit: (_value, context) => {
          hardDrop(context);
          renderTetris(context);
        }
      })
    ]
  ],
  setup: (context) => {
    resetGame(context);
  },
  render: (context) => {
    stepGame(context);
    renderTetris(context);
  }
});
function resetGame(context) {
  board = createBoard();
  active = createPiece(randomKind());
  next = createPiece(randomKind());
  lockFrames = 0;
  score = 0;
  lines = 0;
  autoPlan = null;
}
function stepGame(context) {
  if (context.data.autoplay === "yes") {
    runAutoplay();
  }
  if (moveActive(0, 1)) {
    lockFrames = 0;
    return;
  }
  lockFrames += 1;
  if (lockFrames >= LOCK_DELAY_FRAMES) {
    lockPiece(context);
  }
}
function runAutoplay() {
  const key = getPieceKey(active);
  if (!autoPlan || autoPlan.pieceKey !== key) {
    autoPlan = getBestPlan();
  }
  if (!autoPlan) {
    return;
  }
  if (active.rotation !== autoPlan.rotation) {
    rotateActive();
    return;
  }
  if (active.x < autoPlan.x) {
    moveActive(1, 0);
    return;
  }
  if (active.x > autoPlan.x) {
    moveActive(-1, 0);
    return;
  }
}
function hardDrop(context) {
  while (moveActive(0, 1)) {
  }
  lockPiece(context);
}
function moveActive(dx, dy) {
  const moved = { ...active, x: active.x + dx, y: active.y + dy };
  if (!canPlace(moved, board)) {
    return false;
  }
  active = moved;
  return true;
}
function rotateActive() {
  const rotations = PIECES[active.kind].length;
  const rotated = { ...active, rotation: (active.rotation + 1) % rotations };
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    const candidate = { ...rotated, x: rotated.x + kick };
    if (canPlace(candidate, board)) {
      active = candidate;
      return true;
    }
  }
  return false;
}
function lockPiece(context) {
  for (const point of getPieceCells(active)) {
    if (point.y >= 0 && point.y < BOARD_HEIGHT && point.x >= 0 && point.x < BOARD_WIDTH) {
      board[point.y][point.x] = active.kind;
    }
  }
  const clearedRows = getFullRows(board);
  const cleared = clearedRows.length;
  if (cleared > 0) {
    board = clearRows(board, clearedRows);
    lines += cleared;
    score += [0, 100, 300, 500, 800][cleared];
  }
  active = next;
  active.x = Math.floor(BOARD_WIDTH / 2) - 2;
  active.y = -1;
  next = createPiece(randomKind());
  lockFrames = 0;
  autoPlan = null;
  if (!canPlace(active, board)) {
    resetGame(context);
  }
}
function renderTetris(context) {
  context.canvas.clear([3, 6, 12]);
  drawBoard(context);
  drawPiece(context, active, 1);
  drawGhost(context);
}
function drawBoard(context) {
  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      const cell = board[y][x];
      if (!cell) {
        continue;
      }
      drawCell(context, x, y, COLORS[cell], 1);
    }
  }
}
function drawPiece(context, piece, opacity) {
  for (const point of getPieceCells(piece)) {
    if (point.y >= 0) {
      drawCell(context, point.x, point.y, COLORS[piece.kind], opacity);
    }
  }
}
function drawGhost(context) {
  let ghost = { ...active };
  while (canPlace({ ...ghost, y: ghost.y + 1 }, board)) {
    ghost = { ...ghost, y: ghost.y + 1 };
  }
  if (ghost.y !== active.y) {
    drawPiece(context, ghost, 0.26);
  }
}
function drawCell(context, x, y, fill, opacity) {
  const left = BOARD_LEFT + x * CELL_SIZE;
  const top = BOARD_TOP + y * CELL_SIZE;
  context.canvas.rect(left, top, CELL_SIZE, CELL_SIZE, {
    fill,
    opacity
  });
  if (opacity >= 1 && CELL_SIZE > 2) {
    context.canvas.pixel(left, top, color.mix(fill, color.white, 0.45));
  }
}
function getBestPlan() {
  let best = null;
  for (let rotation = 0; rotation < PIECES[active.kind].length; rotation += 1) {
    for (let x = -3; x < BOARD_WIDTH + 3; x += 1) {
      const candidate = { ...active, x, y: -1, rotation };
      if (!canPlace(candidate, board)) {
        continue;
      }
      const landed = dropPiece(candidate);
      const simulated = placePiece(board, landed);
      const lines2 = getFullRows(simulated).length;
      const score2 = lines2 * 80 - getAggregateHeight(simulated) * 2 - getHoles(simulated) * 14 - getBumpiness(simulated) * 3;
      const plan = { pieceKey: getPieceKey(active), rotation, x };
      if (!best || score2 > best.score) {
        best = { plan, score: score2 };
      }
    }
  }
  return best?.plan ?? null;
}
function dropPiece(piece) {
  let dropped = { ...piece };
  while (canPlace({ ...dropped, y: dropped.y + 1 }, board)) {
    dropped = { ...dropped, y: dropped.y + 1 };
  }
  return dropped;
}
function canPlace(piece, targetBoard) {
  return getPieceCells(piece).every((point) => {
    if (point.x < 0 || point.x >= BOARD_WIDTH || point.y >= BOARD_HEIGHT) {
      return false;
    }
    return point.y < 0 || targetBoard[point.y][point.x] === "";
  });
}
function placePiece(source, piece) {
  const nextBoard = source.map((row) => [...row]);
  for (const point of getPieceCells(piece)) {
    if (point.y >= 0 && point.y < BOARD_HEIGHT && point.x >= 0 && point.x < BOARD_WIDTH) {
      nextBoard[point.y][point.x] = piece.kind;
    }
  }
  return clearRows(nextBoard, getFullRows(nextBoard));
}
function getFullRows(targetBoard) {
  const rows = [];
  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    if (targetBoard[y].every(Boolean)) {
      rows.push(y);
    }
  }
  return rows;
}
function clearRows(source, rows) {
  const rowSet = new Set(rows);
  const remaining = source.filter((_row, index) => !rowSet.has(index)).map((row) => [...row]);
  const emptyRows = Array.from({ length: rows.length }, () => createEmptyRow());
  return [...emptyRows, ...remaining].slice(-BOARD_HEIGHT);
}
function getAggregateHeight(targetBoard) {
  return getColumnHeights(targetBoard).reduce((sum, height) => sum + height, 0);
}
function getHoles(targetBoard) {
  let holes = 0;
  for (let x = 0; x < BOARD_WIDTH; x += 1) {
    let blockSeen = false;
    for (let y = 0; y < BOARD_HEIGHT; y += 1) {
      if (targetBoard[y][x]) {
        blockSeen = true;
      } else if (blockSeen) {
        holes += 1;
      }
    }
  }
  return holes;
}
function getBumpiness(targetBoard) {
  const heights = getColumnHeights(targetBoard);
  let bumpiness = 0;
  for (let index = 0; index < heights.length - 1; index += 1) {
    bumpiness += Math.abs(heights[index] - heights[index + 1]);
  }
  return bumpiness;
}
function getColumnHeights(targetBoard) {
  return Array.from({ length: BOARD_WIDTH }, (_value, x) => {
    for (let y = 0; y < BOARD_HEIGHT; y += 1) {
      if (targetBoard[y][x]) {
        return BOARD_HEIGHT - y;
      }
    }
    return 0;
  });
}
function getPieceCells(piece) {
  return getShape(piece.kind, piece.rotation).map((point) => ({
    x: piece.x + point.x,
    y: piece.y + point.y
  }));
}
function getShape(kind, rotation) {
  const rotations = PIECES[kind];
  return rotations[rotation % rotations.length];
}
function createPiece(kind) {
  return {
    kind,
    rotation: 0,
    x: Math.floor(BOARD_WIDTH / 2) - 2,
    y: -1
  };
}
function createBoard() {
  return Array.from({ length: BOARD_HEIGHT }, () => createEmptyRow());
}
function createEmptyRow() {
  return Array.from({ length: BOARD_WIDTH }, () => "");
}
function randomKind() {
  const kinds = Object.keys(PIECES);
  return kinds[Math.floor(Math.random() * kinds.length)];
}
function getPieceKey(piece) {
  return `${piece.kind}:${piece.rotation}:${piece.x}:${piece.y}`;
}
function normalizeResolution(value) {
  if (value === 32 || value === 64) {
    return value;
  }
  return 16;
}
export {
  Tetris_default as default
};
