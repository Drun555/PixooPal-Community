// src/Snowfall/Snowfall.ts
import {
  defineClockface,
  data,
  input
} from "@pixoopal/clockface";
var RESOLUTION = 64;
var DEFAULT_SNOWFLAKE_COUNT = 48;
var MIN_SNOWFLAKE_COUNT = 0;
var MAX_SNOWFLAKE_COUNT = 180;
var snowflakes = [];
var frame = 0;
var Snowfall_default = defineClockface({
  frameQueueSize: 0,
  resolution: RESOLUTION,
  data: {
    snowflakeCount: data.number(DEFAULT_SNOWFLAKE_COUNT)
  },
  inputs: [
    input.number("snowflakeCount", "Snowflakes", {
      min: MIN_SNOWFLAKE_COUNT,
      max: MAX_SNOWFLAKE_COUNT,
      step: 1,
      onSubmit: (value, context) => {
        context.data.snowflakeCount = normalizeSnowflakeCount(String(value)).toString();
        syncSnowflakes(context);
      }
    })
  ],
  interval: 200,
  setup: (context) => {
    syncSnowflakes(context);
  },
  render: renderSnowfall
});
function renderSnowfall(context) {
  frame += 1;
  syncSnowflakes(context);
  drawBackground(context);
  for (const snowflake of snowflakes) {
    snowflake.y += snowflake.speed;
    snowflake.x += Math.sin(frame * 0.045 + snowflake.phase) * snowflake.drift;
    if (snowflake.y >= context.resolution + 2) {
      resetSnowflake(snowflake, true);
    }
    if (snowflake.x < -2) {
      snowflake.x = context.resolution + 1;
    } else if (snowflake.x > context.resolution + 2) {
      snowflake.x = -1;
    }
    drawSnowflake(context, snowflake);
  }
}
function syncSnowflakes(context) {
  const targetCount = normalizeSnowflakeCount(context.data.snowflakeCount);
  context.data.snowflakeCount = targetCount.toString();
  while (snowflakes.length < targetCount) {
    snowflakes.push(createSnowflake(false));
  }
  if (snowflakes.length > targetCount) {
    snowflakes = snowflakes.slice(0, targetCount);
  }
}
function createSnowflake(fromTop) {
  const snowflake = {
    x: 0,
    y: 0,
    speed: 0,
    drift: 0,
    phase: 0,
    brightness: 0,
    size: 1
  };
  resetSnowflake(snowflake, fromTop);
  return snowflake;
}
function resetSnowflake(snowflake, fromTop) {
  snowflake.x = randomBetween(0, RESOLUTION - 1);
  snowflake.y = fromTop ? randomBetween(-10, -1) : randomBetween(0, RESOLUTION - 1);
  snowflake.speed = randomBetween(0.28, 0.92);
  snowflake.drift = randomBetween(0.04, 0.22);
  snowflake.phase = randomBetween(0, Math.PI * 2);
  snowflake.brightness = randomBetween(150, 255);
  snowflake.size = Math.random() > 0.86 ? 2 : 1;
}
function drawBackground(context) {
  const top = [5, 10, 24];
  const bottom = [20, 32, 54];
  for (let y = 0; y < context.resolution; y += 1) {
    const amount = y / (context.resolution - 1);
    const color = mixPixel(top, bottom, amount);
    for (let x = 0; x < context.resolution; x += 1) {
      setPixel(context, x, y, color);
    }
  }
}
function drawSnowflake(context, snowflake) {
  const x = Math.round(snowflake.x);
  const y = Math.round(snowflake.y);
  const color = getSnowColor(snowflake.brightness);
  blendPixel(context, x, y, color, 0.95);
  if (snowflake.size === 2) {
    blendPixel(context, x - 1, y, color, 0.34);
    blendPixel(context, x + 1, y, color, 0.34);
    blendPixel(context, x, y - 1, color, 0.28);
    blendPixel(context, x, y + 1, color, 0.28);
  }
}
function normalizeSnowflakeCount(value) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_SNOWFLAKE_COUNT;
  }
  return Math.max(MIN_SNOWFLAKE_COUNT, Math.min(MAX_SNOWFLAKE_COUNT, parsed));
}
function getSnowColor(brightness) {
  return [
    Math.round(brightness * 0.88),
    Math.round(brightness * 0.94),
    Math.round(brightness)
  ];
}
function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}
function mixPixel(start, end, amount) {
  const clamped = Math.max(0, Math.min(1, amount));
  return [
    Math.round(start[0] + (end[0] - start[0]) * clamped),
    Math.round(start[1] + (end[1] - start[1]) * clamped),
    Math.round(start[2] + (end[2] - start[2]) * clamped)
  ];
}
function blendPixel(context, x, y, color, opacity) {
  if (x < 0 || y < 0 || x >= context.resolution || y >= context.resolution) {
    return;
  }
  const current = context.canvas.buffer[x + y * context.resolution];
  context.canvas.pixel(x, y, mixPixel(current, color, opacity));
}
function setPixel(context, x, y, color) {
  context.canvas.pixel(x, y, color);
}
export {
  Snowfall_default as default
};
