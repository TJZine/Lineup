# Development Quick Reference

Use this page for day-to-day commands. For the full agent/control-plane workflow, see [docs/AGENTIC_DEV_WORKFLOW.md](docs/AGENTIC_DEV_WORKFLOW.md).

## Environment

```bash
nvm install
npm ci
```

The repo pins the recommended local Node version in `.nvmrc`. `package.json` requires Node `>=22.12.0`.

## Core Commands

```bash
npm run dev
npm run typecheck
npm run lint
npm run lint:css
npm run test:all
npm run verify
npm run verify:docs
```

## Packaging for webOS

```bash
npm run package:webos
```

That command builds the lean production bundle and packages `dist/` into an installable IPK.

## Install to a TV

```bash
ares-install --device my-tv com.lineup.app_<VERSION>_all.ipk
ares-launch --device my-tv com.lineup.app
```

Replace `my-tv` with the device name you configured in `ares-setup-device`. Replace `<VERSION>` with the actual package filename that `ares-package` emitted.

## Remote Debugging

```bash
ares-inspect --device my-tv --app com.lineup.app --open
```

## Useful References

- [Development Setup](docs/development/setup.md)
- [Testing Guide](docs/development/testing.md)
- [Debugging Guide](docs/development/debugging.md)
- [Getting Started](docs/getting-started/README.md)
