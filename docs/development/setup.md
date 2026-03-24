# Development Setup

This guide covers the practical setup for working on Lineup locally and, when needed, deploying builds to a webOS TV.

## Prerequisites

- Node `>=22.12.0`
- the repo-pinned Node version from `.nvmrc` is recommended (`22.19.0` currently)
- npm from the supported Node installation
- optional for TV deployment: LG webOS CLI tools or a desktop installer such as webOS Dev Manager

## Clone and Install

```bash
git clone https://github.com/TJZine/Lineup.git
cd Lineup
nvm use
npm ci
```

## Verify the Checkout

```bash
npm run verify
```

For documentation-only work, `npm run verify:docs` is enough.

## Browser Development

Most UI, logic, and startup flows can be developed in a browser first.

```bash
npm run dev
```

Open `http://localhost:5173` and use the keyboard as a remote substitute:

- arrows: D-pad
- `Enter`: OK
- `Backspace` / `Escape`: Back
- `G`: Guide
- `Space`: Play/Pause
- `I`: Info

## webOS Tooling

If you need device deployment from the command line, install the webOS CLI:

```bash
npm install -g @webos-tools/cli
```

Then register a device:

```bash
ares-setup-device
```

You can also use webOS Dev Manager if you prefer a desktop UI for install and launch tasks.

## Build and Package for webOS

```bash
npm run package:webos
```

This runs the lean production build and packages `dist/` into an IPK.

## Install to a TV

```bash
ares-install --device my-tv com.lineup.app_<VERSION>_all.ipk
ares-launch --device my-tv com.lineup.app
```

Replace:

- `my-tv` with the device name from `ares-setup-device`
- `<VERSION>` with the package filename emitted by the packaging step

## Remote Debugging

```bash
ares-inspect --device my-tv --app com.lineup.app --open
```

For more debugging guidance, see [Debugging Guide](debugging.md).

## Related Docs

- [Development Quick Reference](../../dev-workflow.md)
- [Testing Guide](testing.md)
- [Debugging Guide](debugging.md)
- [Installation Guide](../getting-started/installation.md)
