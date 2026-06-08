// src/ToDoList/ToDoList.ts
import { color, data, defineClockface, input } from "@pixoopal/clockface";
import {
  drawBitmapText,
  getBitmapTextRenderHeight,
  measureBitmapText
} from "@pixoopal/clockface/bitmap-text";
var DEFAULT_DATA = {
  todoEntityId: ""
};
var REFRESH_MS = 2e4;
var FRAME_INTERVAL_MS = 120;
var ROW_HEIGHT = 9;
var CHECKBOX_X = 0;
var CHECKBOX_SIZE = 5;
var TEXT_X = 8;
var TEXT_MAX_WIDTH = 56;
var TEXT_COLOR = color.white;
var MUTED_COLOR = [120, 120, 120];
var ACCENT_COLOR = "#39ff88";
var ERROR_COLOR = [255, 92, 92];
var todoCache = {
  entityId: "",
  fetchedAt: 0,
  items: [],
  error: ""
};
var scrollOffset = 0;
var scrollDirection = 1;
var itemsSignature = "";
var ToDoList_default = defineClockface({
  resolution: 64,
  frameQueueSize: 1,
  data: {
    todoEntityId: data.string(DEFAULT_DATA.todoEntityId)
  },
  inputs: [
    input.text("todoEntityId", "ToDo entity ID", {
      isSetting: true,
      onSubmit() {
        resetCache();
      }
    })
  ],
  getInterval: (context) => getEntityId(context) ? FRAME_INTERVAL_MS : 0,
  render: async (context) => {
    context.canvas.clear("#000000");
    const entityId = getEntityId(context);
    if (!entityId) {
      await drawCenteredMessage(context, "configure", MUTED_COLOR);
      return;
    }
    const items = await getTodoItems(context, entityId);
    if (todoCache.error && items.length === 0) {
      await drawCenteredMessage(context, "HA error", ERROR_COLOR);
      return;
    }
    if (items.length === 0) {
      await drawCenteredMessage(context, "all done", ACCENT_COLOR);
      return;
    }
    await drawItems(context, items);
  }
});
async function getTodoItems(context, entityId) {
  const now = Date.now();
  if (todoCache.entityId === entityId && now - todoCache.fetchedAt < REFRESH_MS) {
    return todoCache.items;
  }
  try {
    const response = await context.homeAssistant.callService(
      "todo",
      "get_items",
      {
        entity_id: entityId,
        status: ["needs_action", "completed"]
      },
      {
        returnResponse: true
      }
    );
    const items = parseTodoItems(response, entityId);
    todoCache = {
      entityId,
      fetchedAt: now,
      items,
      error: ""
    };
    return items;
  } catch (error) {
    todoCache = {
      entityId,
      fetchedAt: now,
      items: todoCache.entityId === entityId ? todoCache.items : [],
      error: error instanceof Error ? error.message : String(error)
    };
    return todoCache.items;
  }
}
async function drawItems(context, items) {
  resetScrollIfItemsChanged(items);
  for (let index = 0; index < items.length; index += 1) {
    const rowY = index * ROW_HEIGHT - scrollOffset;
    const item = items[index];
    if (rowY >= context.resolution || rowY + ROW_HEIGHT <= 0) {
      continue;
    }
    const text = truncateText(item.summary, TEXT_MAX_WIDTH);
    const textY = getCenteredY(rowY, getBitmapTextRenderHeight(text));
    const isCompleted = item.status === "completed";
    const itemColor = isCompleted ? MUTED_COLOR : TEXT_COLOR;
    drawCheckbox(context, rowY, isCompleted);
    await drawBitmapText({
      buffer: context.buffer,
      size: context.resolution,
      text,
      x: TEXT_X,
      y: textY,
      color: itemColor,
      clip: {
        left: TEXT_X,
        right: context.resolution - 1,
        top: Math.max(0, rowY),
        bottom: Math.min(context.resolution - 1, rowY + ROW_HEIGHT - 1)
      }
    });
    if (isCompleted) {
      context.canvas.rect(
        TEXT_X,
        rowY + Math.floor(ROW_HEIGHT / 2),
        Math.min(TEXT_MAX_WIDTH, measureBitmapText(text)),
        1,
        MUTED_COLOR
      );
    }
  }
  updateScroll(items.length * ROW_HEIGHT, context.resolution);
}
function drawCheckbox(context, rowY, checked) {
  const y = getCenteredY(rowY, CHECKBOX_SIZE);
  context.canvas.rect(CHECKBOX_X, y, CHECKBOX_SIZE, CHECKBOX_SIZE, {
    stroke: checked ? ACCENT_COLOR : MUTED_COLOR
  });
  if (!checked) {
    return;
  }
  context.canvas.pixel(CHECKBOX_X + 1, y + 2, ACCENT_COLOR);
  context.canvas.pixel(CHECKBOX_X + 2, y + 3, ACCENT_COLOR);
  context.canvas.pixel(CHECKBOX_X + 3, y + 1, ACCENT_COLOR);
}
async function drawCenteredMessage(context, text, textColor) {
  await drawBitmapText({
    buffer: context.buffer,
    size: context.resolution,
    text,
    x: Math.max(0, Math.floor((context.resolution - measureBitmapText(text)) / 2)),
    y: Math.max(0, Math.floor((context.resolution - getBitmapTextRenderHeight(text)) / 2)),
    color: typeof textColor === "string" ? color.parse(textColor) : textColor
  });
}
function parseTodoItems(response, entityId) {
  const root = isRecord(response) && isRecord(response.service_response) ? response.service_response : response;
  const entityResponse = isRecord(root) ? root[entityId] : void 0;
  const items = isRecord(entityResponse) && Array.isArray(entityResponse.items) ? entityResponse.items : [];
  return items.map(parseTodoItem).filter((item) => Boolean(item));
}
function parseTodoItem(value) {
  if (!isRecord(value)) {
    return void 0;
  }
  const summary = normalizeString(value.summary);
  if (!summary) {
    return void 0;
  }
  return {
    summary,
    status: normalizeString(value.status) || "needs_action"
  };
}
function truncateText(text, maxWidth) {
  if (measureBitmapText(text) <= maxWidth) {
    return text;
  }
  const suffix = "..";
  let output = text;
  while (output.length > 0 && measureBitmapText(`${output}${suffix}`) > maxWidth) {
    output = output.slice(0, -1);
  }
  return output ? `${output}${suffix}` : suffix;
}
function resetScrollIfItemsChanged(items) {
  const nextSignature = items.map((item) => `${item.status}:${item.summary}`).join("\n");
  if (nextSignature === itemsSignature) {
    return;
  }
  itemsSignature = nextSignature;
  resetScroll();
}
function updateScroll(contentHeight, viewportHeight) {
  const maxOffset = Math.max(0, contentHeight - viewportHeight);
  if (maxOffset === 0) {
    resetScroll();
    return;
  }
  scrollOffset += scrollDirection;
  if (scrollOffset >= maxOffset) {
    scrollOffset = maxOffset;
    scrollDirection = -1;
  } else if (scrollOffset <= 0) {
    scrollOffset = 0;
    scrollDirection = 1;
  }
}
function resetScroll() {
  scrollOffset = 0;
  scrollDirection = 1;
}
function getCenteredY(rowY, height) {
  return rowY + Math.max(0, Math.floor((ROW_HEIGHT - height) / 2));
}
function getEntityId(context) {
  return (context.data.todoEntityId || DEFAULT_DATA.todoEntityId).trim();
}
function resetCache() {
  todoCache = {
    entityId: "",
    fetchedAt: 0,
    items: [],
    error: ""
  };
  itemsSignature = "";
  resetScroll();
}
function isRecord(value) {
  return typeof value === "object" && value !== null;
}
function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}
export {
  ToDoList_default as default
};
