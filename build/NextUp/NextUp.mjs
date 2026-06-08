// src/NextUp/NextUp.ts
import { color, data, defineClockface, input } from "@pixoopal/clockface";
import {
  drawBitmapText,
  getBitmapTextRenderHeight,
  measureBitmapText
} from "@pixoopal/clockface/bitmap-text";
var DEFAULT_DATA = {
  calendarEntity: "",
  backgroundColor: "#ff5d5b",
  textColor: "#ffffff"
};
var CALENDAR_REFRESH_MS = 6e4 * 1;
var CARD_X = 0;
var CARD_Y = 18;
var CARD_WIDTH = 64;
var CARD_HEIGHT = 46;
var ERROR_COLOR = [255, 184, 168];
var calendarTemplate = String.raw`
{%- set wanted = calendar_entity | default('', true) -%}
{%- set ns = namespace(events=[]) -%}
{%- for calendar in states.calendar -%}
  {%- if not wanted or calendar.entity_id == wanted -%}
    {%- set title = state_attr(calendar.entity_id, 'message') -%}
    {%- set start = state_attr(calendar.entity_id, 'start_time') -%}
    {%- set end = state_attr(calendar.entity_id, 'end_time') -%}
    {%- if title and start -%}
      {%- set ns.events = ns.events + [{
        'entity_id': calendar.entity_id,
        'calendar': calendar.name,
        'title': title,
        'start': start,
        'end': end or start,
        'all_day': state_attr(calendar.entity_id, 'all_day') or false
      }] -%}
    {%- endif -%}
  {%- endif -%}
{%- endfor -%}
{{ {'events': ns.events} | to_json }}
`;
var cachedEvents = [];
var lastRefreshAt = 0;
var lastCalendarEntity = "";
var lastError = "";
var frame = 0;
var NextUp_default = defineClockface({
  resolution: 64,
  frameQueueSize: 1,
  interval: 100,
  data: {
    calendarEntity: data.string(DEFAULT_DATA.calendarEntity),
    backgroundColor: data.color(DEFAULT_DATA.backgroundColor),
    textColor: data.color(DEFAULT_DATA.textColor)
  },
  inputs: [
    input.text("calendarEntity", "Calendar entity", {
      isSetting: true,
      onSubmit(value, context) {
        context.data.calendarEntity = String(value).trim();
        lastRefreshAt = 0;
      }
    }),
    input.color("backgroundColor", "Background color", { isSetting: true }),
    input.color("textColor", "Text color", { isSetting: true })
  ],
  render: async (context) => {
    frame += 1;
    const calendarEntity = normalizeCalendarEntity(context.data.calendarEntity);
    const backgroundColor = context.data.backgroundColor;
    const textColor = context.data.textColor;
    const now = /* @__PURE__ */ new Date();
    if (calendarEntity !== lastCalendarEntity) {
      cachedEvents = [];
      lastRefreshAt = 0;
      lastCalendarEntity = calendarEntity;
    }
    if (context.homeAssistant.connected && Date.now() - lastRefreshAt >= CALENDAR_REFRESH_MS) {
      await refreshEvents(context.homeAssistant, calendarEntity);
    } else if (!context.homeAssistant.connected) {
      lastError = "HA Disconnected";
    }
    const event = getNextEvent(cachedEvents, now);
    const dateText = formatDate(now);
    const dateY = Math.max(0, Math.floor((CARD_Y - getBitmapTextRenderHeight(dateText)) / 2));
    const parsedColorText = color.parse(textColor);
    context.canvas.clear("#000000");
    await drawText(context.buffer, context.resolution, dateText, 4, dateY + 1, parsedColorText);
    drawEventCard(context.buffer, context.resolution, color.parse(context.data.backgroundColor));
    if (!context.homeAssistant.connected) {
      await drawCenteredText(context.buffer, context.resolution, "HA", 25, ERROR_COLOR);
      await drawCenteredText(context.buffer, context.resolution, "NOT", 38, ERROR_COLOR);
      await drawCenteredText(context.buffer, context.resolution, "CONNECTED", 51, ERROR_COLOR);
      return;
    }
    if (!event) {
      await drawCenteredText(context.buffer, context.resolution, lastError || "No events", 34, parsedColorText);
      return;
    }
    await drawText(context.buffer, context.resolution, formatRelativeTime(event, now), 4, 22, parsedColorText);
    await drawText(context.buffer, context.resolution, formatEventTime(event), 4, 35, parsedColorText);
    await drawMarqueeText(context.buffer, context.resolution, event.title, 0, 49, 64, frame, parsedColorText);
  }
});
async function refreshEvents(homeAssistant, calendarEntity) {
  lastRefreshAt = Date.now();
  try {
    const response = await homeAssistant.renderJinja(calendarTemplate, {
      calendar_entity: calendarEntity
    });
    const payload = JSON.parse(response.trim() || "{}");
    cachedEvents = normalizeEvents(payload.events);
    lastError = "";
  } catch (error) {
    lastError = error instanceof Error ? "Jinja error" : String(error);
  }
}
function normalizeEvents(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord).map((event) => ({
    allDay: event.all_day === true,
    calendar: normalizeString(event.calendar),
    color: normalizeColorString(event.color),
    end: normalizeString(event.end),
    entityId: normalizeString(event.entity_id),
    start: normalizeString(event.start),
    title: normalizeString(event.title)
  })).filter((event) => event.title && event.start);
}
function getNextEvent(events, now) {
  const nowMs = now.getTime();
  return events.map((event) => ({
    event,
    ...getEventRange(event)
  })).filter(({ endMs, startMs }) => Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= nowMs).sort((left, right) => left.startMs - right.startMs)[0]?.event;
}
function drawEventCard(buffer, size, fill) {
  drawRoundedRect(buffer, size, CARD_X - 1, CARD_Y, CARD_WIDTH + 2, CARD_HEIGHT, 0, fill);
  drawRoundedRectOutline(buffer, size, CARD_X - 1, CARD_Y - 1, CARD_WIDTH + 2, CARD_HEIGHT + 1, 0, lighten(fill, 0.18));
}
async function drawMarqueeText(buffer, size, text, x, y, width, frameIndex, fill) {
  const textWidth = measureBitmapText(text);
  if (textWidth <= width) {
    await drawText(buffer, size, text, x, y, fill);
    return;
  }
  const overflow = textWidth - width;
  const cycle = Math.max(1, overflow * 2);
  const cycleFrame = frameIndex % cycle;
  const offset = cycleFrame <= overflow ? cycleFrame : cycle - cycleFrame;
  await drawBitmapText({
    buffer,
    size,
    text,
    x: x - offset,
    y,
    color: fill,
    clip: {
      left: x,
      right: x + width - 1,
      top: y,
      bottom: y + 9
    }
  });
}
async function drawCenteredText(buffer, size, text, y, fill) {
  await drawText(buffer, size, text, Math.max(0, Math.floor((size - measureBitmapText(text)) / 2)), y, fill);
}
async function drawText(buffer, size, text, x, y, fill) {
  await drawBitmapText({
    buffer,
    size,
    text,
    x,
    y,
    color: fill
  });
}
function drawRoundedRect(buffer, size, x, y, width, height, radius, fill) {
  for (let targetY = y; targetY < y + height; targetY += 1) {
    for (let targetX = x; targetX < x + width; targetX += 1) {
      if (isInsideRoundedRect(targetX, targetY, x, y, width, height, radius)) {
        setPixel(buffer, size, targetX, targetY, fill);
      }
    }
  }
}
function drawRoundedRectOutline(buffer, size, x, y, width, height, radius, stroke) {
  for (let targetY = y; targetY < y + height; targetY += 1) {
    for (let targetX = x; targetX < x + width; targetX += 1) {
      if (isInsideRoundedRect(targetX, targetY, x, y, width, height, radius) && !isInsideRoundedRect(targetX, targetY, x + 1, y + 1, width - 2, height - 2, Math.max(0, radius - 1))) {
        setPixel(buffer, size, targetX, targetY, stroke);
      }
    }
  }
}
function isInsideRoundedRect(targetX, targetY, x, y, width, height, radius) {
  const left = x + radius;
  const right = x + width - radius - 1;
  const top = y + radius;
  if (targetY >= top || targetX >= left && targetX <= right) {
    return true;
  }
  const cornerX = targetX < left ? left : right;
  const cornerY = top;
  const dx = targetX - cornerX;
  const dy = targetY - cornerY;
  return dx * dx + dy * dy <= radius * radius;
}
function setPixel(buffer, size, x, y, fill) {
  if (x < 0 || y < 0 || x >= size || y >= size) {
    return;
  }
  const index = (x + y * size) * 3;
  buffer[index] = fill[0];
  buffer[index + 1] = fill[1];
  buffer[index + 2] = fill[2];
}
function formatDate(value) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short"
  }).format(value);
}
function formatRelativeTime(event, now) {
  if (event.allDay) {
    return "All day";
  }
  const minutes = Math.round((getEventRange(event).startMs - now.getTime()) / 6e4);
  if (minutes <= 0) {
    return "Now";
  }
  if (minutes <= 60) {
    return `In ${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}
function formatEventTime(event) {
  if (event.allDay) {
    return "Today";
  }
  const date = getEventDate(event.start);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
function getEventDate(value) {
  const normalized = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return /* @__PURE__ */ new Date(`${normalized}T00:00:00`);
  }
  return new Date(normalized.replace(" ", "T"));
}
function getEventRange(event) {
  const startMs = getEventDate(event.start).getTime();
  let endMs = getEventDate(event.end || event.start).getTime();
  if (event.allDay && endMs <= startMs) {
    endMs = startMs + 24 * 60 * 60 * 1e3;
  }
  return {
    startMs,
    endMs
  };
}
function normalizeCalendarEntity(value) {
  const normalized = value.trim();
  return normalized && !normalized.startsWith("calendar.") ? `calendar.${normalized}` : normalized;
}
function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}
function normalizeColorString(value) {
  const normalized = normalizeString(value);
  return /^#?[0-9a-f]{6}$/i.test(normalized) ? `#${normalized.replace(/^#/, "")}` : "";
}
function lighten(fill, amount) {
  return [
    Math.round(fill[0] + (255 - fill[0]) * amount),
    Math.round(fill[1] + (255 - fill[1]) * amount),
    Math.round(fill[2] + (255 - fill[2]) * amount)
  ];
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export {
  NextUp_default as default
};
