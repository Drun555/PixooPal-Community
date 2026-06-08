// src/NowPlaying/NowPlaying.ts
import { color, data, defineClockface, input } from "@pixoopal/clockface";
import { drawBitmapText, measureBitmapText } from "@pixoopal/clockface/bitmap-text";
import { decodeImageFile, drawImageFrame } from "@pixoopal/clockface/image";
var DEFAULT_DATA = {
  mediaPlayerEntityId: ""
};
var STATE_REFRESH_MS = 5e3;
var FRAME_INTERVAL_MS = 120;
var ALBUM_HEIGHT = 55;
var TEXT_Y = 54;
var PROGRESS_Y = 63;
var PROGRESS_COLOR = "#39ff88";
var PROGRESS_BACKGROUND = "#141414";
var TEXT_COLOR = color.white;
var EMPTY_TEXT_COLOR = [120, 120, 120];
var MEDIA_PLAYER_TEMPLATE = `
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
var stateCache = {
  entityId: "",
  fetchedAt: 0,
  player: void 0,
  error: ""
};
var albumCache = {
  url: "",
  frame: void 0,
  error: ""
};
var marqueeText = "";
var marqueeFrame = 0;
var NowPlaying_default = defineClockface({
  resolution: 64,
  frameQueueSize: 1,
  data: {
    mediaPlayerEntityId: data.string(DEFAULT_DATA.mediaPlayerEntityId)
  },
  inputs: [
    input.text("mediaPlayerEntityId", "Media player entity ID", {
      isSetting: true,
      onSubmit() {
        resetCaches();
      }
    })
  ],
  getInterval: (context) => getEntityId(context) ? FRAME_INTERVAL_MS : 0,
  render: async (context) => {
    context.canvas.clear("#000000");
    const entityId = getEntityId(context);
    if (!entityId) {
      await drawMessage(context, "configure");
      return;
    }
    const player = await getMediaPlayerState(context, entityId);
    const title = player?.title?.trim() || getFallbackTitle(player, stateCache.error);
    await drawAlbumArt(context, player?.albumArtUrl ?? "");
    drawBottomPanel(context, player);
    await drawMarquee(context, title, player?.title ? TEXT_COLOR : EMPTY_TEXT_COLOR);
  }
});
async function getMediaPlayerState(context, entityId) {
  const now = Date.now();
  if (stateCache.entityId === entityId && stateCache.player && now - stateCache.fetchedAt < STATE_REFRESH_MS) {
    return estimateLivePosition(stateCache.player, now - stateCache.fetchedAt);
  }
  try {
    const rendered = await context.homeAssistant.renderJinja(MEDIA_PLAYER_TEMPLATE, { entity_id: entityId });
    const player = parseMediaPlayerState(rendered);
    stateCache = {
      entityId,
      fetchedAt: now,
      player,
      error: ""
    };
    return player;
  } catch (error) {
    stateCache = {
      entityId,
      fetchedAt: now,
      player: stateCache.entityId === entityId ? stateCache.player : void 0,
      error: error instanceof Error ? error.message : String(error)
    };
    return stateCache.player;
  }
}
async function drawAlbumArt(context, url) {
  const normalizedUrl = url.trim();
  if (!normalizedUrl) {
    drawPlaceholderAlbum(context);
    return;
  }
  if (albumCache.url !== normalizedUrl) {
    albumCache = {
      url: normalizedUrl,
      frame: void 0,
      error: ""
    };
    try {
      const file = await context.homeAssistant.fetchBinary(normalizedUrl);
      albumCache.frame = await decodeImageFile(
        {
          name: "album-art",
          type: file.type,
          size: file.bytes.byteLength,
          bytes: file.bytes
        },
        {
          width: context.resolution,
          height: ALBUM_HEIGHT,
          fit: "cover"
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
function drawBottomPanel(context, player) {
  context.canvas.rect(0, TEXT_Y, context.resolution, context.resolution - TEXT_Y, "#000000");
  context.canvas.rect(0, PROGRESS_Y, context.resolution, 1, PROGRESS_BACKGROUND);
  const duration = Math.max(0, Number(player?.duration ?? 0));
  const position = Math.max(0, Number(player?.position ?? 0));
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;
  const progressWidth = Math.max(0, Math.min(context.resolution, Math.round(progress * context.resolution)));
  if (progressWidth > 0) {
    context.canvas.rect(0, PROGRESS_Y, progressWidth, 1, PROGRESS_COLOR);
  }
}
async function drawMarquee(context, text, textColor) {
  const normalizedText = text.trim() || "Nothing playing";
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
async function drawMessage(context, text) {
  await drawBitmapText({
    buffer: context.buffer,
    size: context.resolution,
    text,
    x: Math.max(0, Math.floor((context.resolution - measureBitmapText(text)) / 2)),
    y: 28,
    color: EMPTY_TEXT_COLOR
  });
}
function drawPlaceholderAlbum(context) {
  for (let y = 0; y < ALBUM_HEIGHT; y += 1) {
    for (let x = 0; x < context.resolution; x += 1) {
      const value = 12 + Math.round((x + y) / (context.resolution + ALBUM_HEIGHT) * 36);
      context.canvas.pixel(x, y, [value, value, value + 8]);
    }
  }
}
function getMarqueeX(resolution, textWidth, frame) {
  if (textWidth <= resolution) {
    return Math.floor((resolution - textWidth) / 2);
  }
  const travel = textWidth + resolution + 8;
  const offset = frame % travel;
  return resolution - offset;
}
function estimateLivePosition(player, elapsedMs) {
  if (player.state !== "playing") {
    return player;
  }
  return {
    ...player,
    position: player.position + elapsedMs / 1e3
  };
}
function parseMediaPlayerState(value) {
  const parsed = JSON.parse(value.trim());
  return {
    state: normalizeString(parsed.state),
    title: normalizeString(parsed.title),
    albumArtUrl: normalizeString(parsed.albumArtUrl),
    duration: normalizeNumber(parsed.duration),
    position: normalizeNumber(parsed.position)
  };
}
function getFallbackTitle(player, error) {
  if (error) {
    return "Home Assistant error";
  }
  if (!player || player.state === "unavailable" || player.state === "unknown") {
    return "Player unavailable";
  }
  return "Nothing playing";
}
function getEntityId(context) {
  return (context.data.mediaPlayerEntityId || DEFAULT_DATA.mediaPlayerEntityId).trim();
}
function resetCaches() {
  stateCache = {
    entityId: "",
    fetchedAt: 0,
    player: void 0,
    error: ""
  };
  albumCache = {
    url: "",
    frame: void 0,
    error: ""
  };
  marqueeText = "";
  marqueeFrame = 0;
}
function normalizeString(value) {
  return typeof value === "string" ? value : "";
}
function normalizeNumber(value) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}
export {
  NowPlaying_default as default
};
