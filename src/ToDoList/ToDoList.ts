import { color, data, defineClockface, input, type ClockfaceContext } from '@pixoopal/clockface';
import {
  drawBitmapText,
  getBitmapTextRenderHeight,
  measureBitmapText
} from '@pixoopal/clockface/bitmap-text';

const DEFAULT_DATA = {
  todoEntityId: ''
};

const REFRESH_MS = 20000;
const FRAME_INTERVAL_MS = 120;
const ROW_HEIGHT = 9;
const CHECKBOX_X = 0;
const CHECKBOX_SIZE = 5;
const TEXT_X = 8;
const TEXT_MAX_WIDTH = 56;
const TEXT_COLOR = color.white;
const MUTED_COLOR: [number, number, number] = [120, 120, 120];
const ACCENT_COLOR = '#39ff88';
const ERROR_COLOR: [number, number, number] = [255, 92, 92];

type TodoItem = {
  summary: string;
  status: string;
};

let todoCache: {
  entityId: string;
  fetchedAt: number;
  items: TodoItem[];
  error: string;
} = {
  entityId: '',
  fetchedAt: 0,
  items: [],
  error: ''
};

let scrollOffset = 0;
let scrollDirection: 1 | -1 = 1;
let itemsSignature = '';

export default defineClockface({
  resolution: 64,
  frameQueueSize: 1,
  data: {
    todoEntityId: data.string(DEFAULT_DATA.todoEntityId)
  },
  inputs: [
    input.text('todoEntityId', 'ToDo entity ID', {
      isSetting: true,
      onSubmit() {
        resetCache();
      }
    })
  ],
  getInterval: (context) => (getEntityId(context) ? FRAME_INTERVAL_MS : 0),
  render: async (context) => {
    context.canvas.clear('#000000');

    const entityId = getEntityId(context);
    if (!entityId) {
      await drawCenteredMessage(context, 'configure', MUTED_COLOR);
      return;
    }

    const items = await getTodoItems(context, entityId);

    if (todoCache.error && items.length === 0) {
      await drawCenteredMessage(context, 'HA error', ERROR_COLOR);
      return;
    }

    if (items.length === 0) {
      await drawCenteredMessage(context, 'all done', ACCENT_COLOR);
      return;
    }

    await drawItems(context, items);
  }
});

async function getTodoItems(context: ClockfaceContext, entityId: string) {
  const now = Date.now();

  if (todoCache.entityId === entityId && now - todoCache.fetchedAt < REFRESH_MS) {
    return todoCache.items;
  }

  try {
    const response = await context.homeAssistant.callService(
      'todo',
      'get_items',
      {
        entity_id: entityId,
        status: ['needs_action', 'completed']
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
      error: ''
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

async function drawItems(context: ClockfaceContext, items: TodoItem[]) {
  resetScrollIfItemsChanged(items);

  for (let index = 0; index < items.length; index += 1) {
    const rowY = index * ROW_HEIGHT - scrollOffset;
    const item = items[index];

    if (rowY >= context.resolution || rowY + ROW_HEIGHT <= 0) {
      continue;
    }

    const text = truncateText(item.summary, TEXT_MAX_WIDTH);
    const textY = getCenteredY(rowY, getBitmapTextRenderHeight(text));
    const isCompleted = item.status === 'completed';
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

function drawCheckbox(context: ClockfaceContext, rowY: number, checked: boolean) {
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

async function drawCenteredMessage(
  context: ClockfaceContext,
  text: string,
  textColor: [number, number, number] | string
) {
  await drawBitmapText({
    buffer: context.buffer,
    size: context.resolution,
    text,
    x: Math.max(0, Math.floor((context.resolution - measureBitmapText(text)) / 2)),
    y: Math.max(0, Math.floor((context.resolution - getBitmapTextRenderHeight(text)) / 2)),
    color: typeof textColor === 'string' ? color.parse(textColor) : textColor
  });
}

function parseTodoItems(response: unknown, entityId: string): TodoItem[] {
  const root = isRecord(response) && isRecord(response.service_response)
    ? response.service_response
    : response;
  const entityResponse = isRecord(root) ? root[entityId] : undefined;
  const items = isRecord(entityResponse) && Array.isArray(entityResponse.items)
    ? entityResponse.items
    : [];

  return items
    .map(parseTodoItem)
    .filter((item): item is TodoItem => Boolean(item));
}

function parseTodoItem(value: unknown): TodoItem | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const summary = normalizeString(value.summary);
  if (!summary) {
    return undefined;
  }

  return {
    summary,
    status: normalizeString(value.status) || 'needs_action'
  };
}

function truncateText(text: string, maxWidth: number) {
  if (measureBitmapText(text) <= maxWidth) {
    return text;
  }

  const suffix = '..';
  let output = text;

  while (output.length > 0 && measureBitmapText(`${output}${suffix}`) > maxWidth) {
    output = output.slice(0, -1);
  }

  return output ? `${output}${suffix}` : suffix;
}

function resetScrollIfItemsChanged(items: TodoItem[]) {
  const nextSignature = items.map((item) => `${item.status}:${item.summary}`).join('\n');

  if (nextSignature === itemsSignature) {
    return;
  }

  itemsSignature = nextSignature;
  resetScroll();
}

function updateScroll(contentHeight: number, viewportHeight: number) {
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

function getCenteredY(rowY: number, height: number) {
  return rowY + Math.max(0, Math.floor((ROW_HEIGHT - height) / 2));
}

function getEntityId(context: ClockfaceContext) {
  return (context.data.todoEntityId || DEFAULT_DATA.todoEntityId).trim();
}

function resetCache() {
  todoCache = {
    entityId: '',
    fetchedAt: 0,
    items: [],
    error: ''
  };
  itemsSignature = '';
  resetScroll();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
