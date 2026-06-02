# PixooPal Community Clockfaces
This repository serves as a registry for third-party Clockfaces.

## Quick Start

1. Fork this repository and clone it to your machine
2. Install dependencies with `npm install`
3. Copy "Example" folder, rename it and have fun!

...

99. If you want to publish your clockface, just make a Pull Request. [Make sure to follow PR rules](https://github.com/Drun555/PixooPal-Community#pull-request-rules).

## But I don't know how to code!

You know, this thing is AI friendly. You can just send a link to this repository to your favorite AI tool (like Codex) and ask it to create any clockface you want. Trust me, they are good at this.

## Clockface Structure

Each Clockface lives in its own folder:

```text
src/MyClockface/
  manifest.json
  picture.png
  MyClockface.ts
  optional-assets...
```

`manifest.json` describes the Clockface:

```json
{
  "entry": "./MyClockface.ts",
  "name": "My Clockface",
  "description": "Short description shown in PixooPal.",
  "picture": "./picture.png",
  "id": "MyClockface"
}
```

## Pull Request Rules

- One Clockface per folder.
- Keep all assets inside your Clockface folder.
- Do not reference or change files outside your folder.
- Make sure `npm run check` passes.

On pull requests, CI validates and uploads build artifacts.
