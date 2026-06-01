// src/DisplayText/DisplayText.ts
import { Clockface } from "@pixoopal/clockface";
var DEFAULT_RESOLUTION = 64;
var DEFAULT_DATA = {
  text: "PixooPal",
  textColor: "#ffffff",
  backgroundColor: "#000000"
};
var DisplayText_default = new Clockface({
  resolution: DEFAULT_RESOLUTION,
  data: { ...DEFAULT_DATA },
  inputs: [
    {
      type: "input-text",
      id: "text",
      friendlyName: "Text",
      onSubmit: (value, context) => {
        context.data.text = String(value);
        renderDisplayText(context);
      }
    },
    {
      type: "colorpicker",
      id: "textColor",
      friendlyName: "Text color",
      onSubmit: (value, context) => {
        context.data.textColor = String(value);
        renderDisplayText(context);
      }
    },
    {
      type: "colorpicker",
      id: "backgroundColor",
      friendlyName: "Background color",
      onSubmit: (value, context) => {
        context.data.backgroundColor = String(value);
        renderDisplayText(context);
      }
    }
  ],
  init: (context) => {
    clearBuffer(context, parseHexColor(context.data.backgroundColor));
  },
  main: renderDisplayText
});
function renderDisplayText(context) {
  const text = (context.data.text || "").trim() || DEFAULT_DATA.text;
  const textColor = parseHexColor(context.data.textColor || DEFAULT_DATA.textColor);
  const backgroundColor = parseHexColor(context.data.backgroundColor || DEFAULT_DATA.backgroundColor);
  const x = Math.floor((context.resolution - text.length * 4) / 2);
  const y = Math.floor((context.resolution - 5) / 2);
  clearBuffer(context, backgroundColor);
  [...text.toUpperCase()].forEach((character, index) => {
    drawCharacter(context, character, x + index * 4, y, textColor);
  });
}
function drawCharacter(context, character, startX, startY, color) {
  const rows = FONT[character] ?? FONT["?"];
  rows.forEach((row, y) => {
    [...row].forEach((pixel, x) => {
      if (pixel === "1") {
        setPixel(context, startX + x, startY + y, color);
      }
    });
  });
}
function clearBuffer(context, color) {
  for (let index = 0; index < context.buffer.length; index += 1) {
    context.buffer[index] = [...color];
  }
}
function setPixel(context, x, y, color) {
  if (x < 0 || y < 0 || x >= context.resolution || y >= context.resolution) {
    return;
  }
  context.buffer[x + y * context.resolution] = [...color];
}
function parseHexColor(value) {
  const normalized = value.trim();
  if (!/^#[0-9a-f]{6}$/i.test(normalized)) {
    return [255, 255, 255];
  }
  return [
    Number.parseInt(normalized.slice(1, 3), 16),
    Number.parseInt(normalized.slice(3, 5), 16),
    Number.parseInt(normalized.slice(5, 7), 16)
  ];
}
var FONT = {
  " ": ["000", "000", "000", "000", "000"],
  "?": ["111", "001", "011", "000", "010"],
  A: ["010", "101", "111", "101", "101"],
  D: ["110", "101", "101", "101", "110"],
  I: ["111", "010", "010", "010", "111"],
  L: ["100", "100", "100", "100", "111"],
  O: ["111", "101", "101", "101", "111"],
  P: ["110", "101", "110", "100", "100"],
  T: ["111", "010", "010", "010", "010"],
  X: ["101", "101", "010", "101", "101"]
};
export {
  DisplayText_default as default
};
