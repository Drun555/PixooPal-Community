import { color, data, defineClockface, input, type ClockfaceContext } from '@pixoopal/clockface';
import { drawBitmapText, measureBitmapText } from '@pixoopal/clockface/bitmap-text';
import { decodeImageFile, drawImageFrame, type ImageFrame } from '@pixoopal/clockface/image';

const DEFAULT_DATA = {
  mediaPlayerEntityId: ''
};

const STATE_REFRESH_MS = 5000;
const FRAME_INTERVAL_MS = 120;
const ALBUM_HEIGHT = 55;
const TEXT_Y = 54;
const PROGRESS_Y = 63;
const PROGRESS_COLOR = '#39ff88';
const PROGRESS_BACKGROUND = '#141414';
const TEXT_COLOR = color.white;
const EMPTY_TEXT_COLOR: [number, number, number] = [120, 120, 120];

const MEDIA_PLAYER_TEMPLATE = `
{% set entity = entity_id %}
{% set duration = state_attr(entity, 'media_duration') | float(0) %}
{% set position = state_attr(entity, 'media_position') | float(0) %}
{% set updated_at = state_attr(entity, 'media_position_updated_at') %}
{% if states(entity) == 'playing' and updated_at %}
  {% set position = position + as_timestamp(now()) - as_timestamp(updated_at) %}
{% endif %}
{{ {
  "state": states(entity),
  "title": (state_attr(entity, "media_artist") + " - " + state_attr(entity, "media_title")) or "",
  "albumArtUrl": state_attr(entity, "entity_picture") or "",
  "duration": duration,
  "position": position
} | to_json }}
`;

type MediaPlayerState = {
  state: string;
  title: string;
  albumArtUrl: string;
  duration: number;
  position: number;
};

let stateCache: {
  entityId: string;
  fetchedAt: number;
  player: MediaPlayerState | undefined;
  error: string;
} = {
  entityId: '',
  fetchedAt: 0,
  player: undefined,
  error: ''
};

let albumCache: {
  url: string;
  frame: ImageFrame | undefined;
  error: string;
} = {
  url: '',
  frame: undefined,
  error: ''
};

let marqueeText = '';
let marqueeFrame = 0;

export default defineClockface({
  resolution: 64,
  frameQueueSize: 1,
  data: {
    mediaPlayerEntityId: data.string(DEFAULT_DATA.mediaPlayerEntityId)
  },
  inputs: [
    input.text('mediaPlayerEntityId', 'Media player entity ID', {
      isSetting: true,
      onSubmit() {
        resetCaches();
      }
    })
  ],
  getInterval: (context) => (getEntityId(context) ? FRAME_INTERVAL_MS : 0),
  render: async (context) => {
    context.canvas.clear('#000000');

    const entityId = getEntityId(context);
    if (!entityId) {
      await drawMessage(context, 'configure');
      return;
    }

    const player = await getMediaPlayerState(context, entityId);
    const title = player?.title?.trim() || getFallbackTitle(player, stateCache.error);

    await drawAlbumArt(context, player?.albumArtUrl ?? '');
    drawBottomPanel(context, player);
    await drawMarquee(context, title, player?.title ? TEXT_COLOR : EMPTY_TEXT_COLOR);
  }
});

async function getMediaPlayerState(context: ClockfaceContext, entityId: string) {
  const now = Date.now();
  if (
    stateCache.entityId === entityId &&
    stateCache.player &&
    now - stateCache.fetchedAt < STATE_REFRESH_MS
  ) {
    return estimateLivePosition(stateCache.player, now - stateCache.fetchedAt);
  }

  try {
    const rendered = await context.homeAssistant.renderJinja(MEDIA_PLAYER_TEMPLATE, { entity_id: entityId });
    const player = parseMediaPlayerState(rendered);

    stateCache = {
      entityId,
      fetchedAt: now,
      player,
      error: ''
    };

    return player;
  } catch (error) {
    stateCache = {
      entityId,
      fetchedAt: now,
      player: stateCache.entityId === entityId ? stateCache.player : undefined,
      error: error instanceof Error ? error.message : String(error)
    };

    return stateCache.player;
  }
}

async function drawAlbumArt(context: ClockfaceContext, url: string) {
  const normalizedUrl = url.trim();

  if (!normalizedUrl) {
    drawPlaceholderAlbum(context);
    return;
  }

  if (albumCache.url !== normalizedUrl) {
    albumCache = {
      url: normalizedUrl,
      frame: undefined,
      error: ''
    };

    try {
      const file = await context.homeAssistant.fetchBinary(normalizedUrl);
      albumCache.frame = await decodeImageFile(
        {
          name: 'album-art',
          type: file.type,
          size: file.bytes.byteLength,
          bytes: file.bytes
        },
        {
          width: context.resolution,
          height: ALBUM_HEIGHT,
          fit: 'cover'
        }
      );
    } catch (error) {
      albumCache.error = error instanceof Error ? error.message : String(error);
    }
  }

  if (albumCache.frame) {
    drawImageFrame(context, albumCache.frame);
    return;
  }

  drawPlaceholderAlbum(context);
}

function drawBottomPanel(context: ClockfaceContext, player: MediaPlayerState | undefined) {
  context.canvas.rect(0, TEXT_Y, context.resolution, context.resolution - TEXT_Y, '#000000');
  context.canvas.rect(0, PROGRESS_Y, context.resolution, 1, PROGRESS_BACKGROUND);

  const duration = Math.max(0, Number(player?.duration ?? 0));
  const position = Math.max(0, Number(player?.position ?? 0));
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;
  const progressWidth = Math.max(0, Math.min(context.resolution, Math.round(progress * context.resolution)));

  if (progressWidth > 0) {
    context.canvas.rect(0, PROGRESS_Y, progressWidth, 1, PROGRESS_COLOR);
  }
}

async function drawMarquee(
  context: ClockfaceContext,
  text: string,
  textColor: [number, number, number]
) {
  const normalizedText = text.trim() || 'Nothing playing';
  const textWidth = measureBitmapText(normalizedText);

  if (normalizedText !== marqueeText) {
    marqueeText = normalizedText;
    marqueeFrame = 0;
  }

  const x = getMarqueeX(context.resolution, textWidth, marqueeFrame);

  await drawBitmapText({
    buffer: context.buffer,
    size: context.resolution,
    text: normalizedText,
    x,
    y: TEXT_Y,
    color: textColor,
    clip: {
      left: 0,
      right: context.resolution - 1,
      top: TEXT_Y,
      bottom: PROGRESS_Y - 1
    }
  });

  marqueeFrame += 1;
}

async function drawMessage(context: ClockfaceContext, text: string) {
  await drawBitmapText({
    buffer: context.buffer,
    size: context.resolution,
    text,
    x: Math.max(0, Math.floor((context.resolution - measureBitmapText(text)) / 2)),
    y: 28,
    color: EMPTY_TEXT_COLOR
  });
}

function drawPlaceholderAlbum(context: ClockfaceContext) {
  for (let y = 0; y < ALBUM_HEIGHT; y += 1) {
    for (let x = 0; x < context.resolution; x += 1) {
      const value = 12 + Math.round(((x + y) / (context.resolution + ALBUM_HEIGHT)) * 36);
      context.canvas.pixel(x, y, [value, value, value + 8]);
    }
  }
}

function getMarqueeX(resolution: number, textWidth: number, frame: number) {
  if (textWidth <= resolution) {
    return Math.floor((resolution - textWidth) / 2);
  }

  const travel = textWidth + resolution + 8;
  const offset = frame % travel;

  return resolution - offset;
}

function estimateLivePosition(player: MediaPlayerState, elapsedMs: number): MediaPlayerState {
  if (player.state !== 'playing') {
    return player;
  }

  return {
    ...player,
    position: player.position + elapsedMs / 1000
  };
}

function parseMediaPlayerState(value: string): MediaPlayerState {
  const parsed = JSON.parse(value.trim()) as Partial<MediaPlayerState>;

  return {
    state: normalizeString(parsed.state),
    title: normalizeString(parsed.title),
    albumArtUrl: normalizeString(parsed.albumArtUrl),
    duration: normalizeNumber(parsed.duration),
    position: normalizeNumber(parsed.position)
  };
}

function getFallbackTitle(player: MediaPlayerState | undefined, error: string) {
  if (error) {
    return 'Home Assistant error';
  }

  if (!player || player.state === 'unavailable' || player.state === 'unknown') {
    return 'Player unavailable';
  }

  return 'Nothing playing';
}

function getEntityId(context: ClockfaceContext) {
  return (context.data.mediaPlayerEntityId || DEFAULT_DATA.mediaPlayerEntityId).trim();
}

function resetCaches() {
  stateCache = {
    entityId: '',
    fetchedAt: 0,
    player: undefined,
    error: ''
  };
  albumCache = {
    url: '',
    frame: undefined,
    error: ''
  };
  marqueeText = '';
  marqueeFrame = 0;
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function normalizeNumber(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value);

  return Number.isFinite(number) ? number : 0;
}
