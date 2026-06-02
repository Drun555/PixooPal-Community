// src/Example/Example.ts
import {
  defineClockface,
  data,
  input
} from "@pixoopal/clockface";

// src/Example/picture.png
var picture_default = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAA80lEQVR4nO2aQQqEMBAEc8yhT/uyvD7fKdmbh0VQiMlqCaOIqDh0enp6LPTGm6N8dzWfVwYmoImA4hLocgCzyUgSjFUAy2DUASiEohJEKRx7AWyGYjeI7XD0A9AQiY4QWmLRE0RTNLrCaIvHuQAORuJkCEdjcTbI1OHo6tttCaiLng9PQH1QYAKaCCgugS4HMJuMJMFYBbAMRh3AXwghdr+ZrnxtaALq7vjr2tF9V5959n1LIqBeTMBSCKgHHzQSAWefuSQCGICcaQioDwhMQBMBxSXQ5QBmk5EkGKsAlsGoA1AIRSWIUjj2AtgM5eZukBfHBncAdGO+8mobAAAAAElFTkSuQmCC";

// src/Example/Example.ts
var uploadedMedia;
var uploadedMediaType = "image";
var Example_default = defineClockface({
  // 16, 32 or 64 - it's the resolution of your clockface. Please note that lower resolution means better FPS.
  resolution: 64,
  // data is something persistent across clockface restarts. Good thing to have.
  data: {
    message: data.string("HELLO"),
    size: data.number(12),
    accent: data.color("#ffd650"),
    background: data.color("#05070c"),
    mode: data.select("all")
  },
  // There's all available methods. If their ID match with "data", then it'll automaticly save it's state.
  inputs: [
    input.text("message", "Message"),
    input.number("size", "Size", { min: 4, max: 28, step: 1 }),
    input.color("accent", "Accent"),
    input.color("background", "Background"),
    input.select("mode", "Mode", [
      { value: "all", label: "All" },
      { value: "media", label: "Media" },
      { value: "buffer", label: "Buffer" }
    ]),
    input.file("media", "Media", {
      accept: "image/png,image/jpeg,image/webp,image/gif,video/*",
      isSetting: false,
      onSubmit(value, context) {
        if (typeof value !== "object" || value === null || !("bytes" in value) || !(value.bytes instanceof Uint8Array)) {
          return;
        }
        uploadedMedia = value;
        uploadedMediaType = value.type.startsWith("video/") ? "video" : value.type === "image/gif" || value.name.toLowerCase().endsWith(".gif") ? "gif" : "image";
        context.data.mode = "media";
      }
    }),
    input.button("reset", "Reset", {
      isSetting: false,
      onSubmit(_value, context) {
        uploadedMedia = void 0;
        uploadedMediaType = "image";
        context.data.message = "HELLO";
        context.data.size = "12";
        context.data.accent = "#ffd650";
        context.data.background = "#05070c";
        context.data.mode = "all";
      }
    })
  ],
  render: (context) => {
    const size = Math.max(4, Math.min(28, Number.parseInt(context.data.size, 10) || 12));
    context.canvas.clear(context.data.background);
    context.canvas.pixel(2, 2, context.data.accent);
    context.canvas.pixel(3, 2, { fill: "#ffffff", opacity: 0.5 });
    context.canvas.rect(6, 6, size, size, { fill: context.data.accent, opacity: 0.35 });
    context.canvas.rect(24, 6, size, size, { stroke: "#ffffff" });
    context.canvas.circle(16, 38, Math.floor(size / 2), { fill: "#38bdf8" });
    context.canvas.circle(42, 38, Math.floor(size / 2), {
      fill: context.data.accent,
      stroke: "#ffffff",
      opacity: 0.85
    });
    context.canvas.text(context.data.message.toUpperCase().slice(0, 10), 4, 54, {
      fill: "#ffffff"
    });
    if (uploadedMedia && (context.data.mode === "media" || context.data.mode === "all")) {
      context.canvas.media(uploadedMedia, uploadedMediaType, {
        x: 34,
        y: 6,
        width: 24,
        height: 24
      });
    }
    context.canvas.media(picture_default, "image", {
      x: 34,
      y: 34,
      width: 18,
      height: 18
    });
    for (let index = 4; index < context.canvas.buffer.length; index += 13) {
      context.canvas.buffer[index] = [255, 255, 255];
    }
  },
  interval: 120
});
export {
  Example_default as default
};
