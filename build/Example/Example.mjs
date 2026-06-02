// src/Example/Example.ts
import {
  defineClockface,
  data,
  input
} from "@pixoopal/clockface";

// src/Example/picture.png
var picture_default = "data:image/png;base64,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";

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
