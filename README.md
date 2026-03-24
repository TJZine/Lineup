<p align="center">
  <img src="./public/lineup-logo-mark.png" alt="Lineup logo mark" width="112">
</p>

<p align="center">
  <img src="./public/lineup-wordmark.png" alt="Lineup" width="520">
</p>

<p align="center">
  Turn a Plex library into a remote-friendly live TV experience on LG webOS.
</p>

<p align="center">
  <a href="./docs/getting-started/quick-start.md">Quick Start</a> ·
  <a href="./docs/getting-started/installation.md">Install on TV</a> ·
  <a href="./docs/user-guide/README.md">User Guide</a> ·
  <a href="./CONTRIBUTING.md">Contribute</a>
</p>

## Status

> [!NOTE]
> Lineup is currently a sideloaded webOS app. Installation on a TV requires LG Developer Mode until a store release exists.

## Start Here

| Goal | Start Here |
| --- | --- |
| Install Lineup on a TV | [Installation](docs/getting-started/installation.md) |
| Get from launch to first channel fast | [Quick Start](docs/getting-started/quick-start.md) |
| Build a lineup from source | [Development Setup](docs/development/setup.md) |
| Learn the core user flows | [User Guide](docs/user-guide/README.md) |
| Contribute code or docs | [Contributing](CONTRIBUTING.md) |

## What You Get

- live channel surfing backed by Plex libraries, collections, and playlists
- a TV-style Electronic Program Guide
- channel setup flows for building one channel or a full lineup
- subtitle handling for direct, extracted, and burn-in paths
- webOS remote-first navigation and startup flows
- persistent channel and settings state between launches

## Requirements

| Component | Requirement |
| --- | --- |
| TV | LG Smart TV running webOS 6.0 or later |
| Plex | Plex Media Server plus a Plex account |
| Node.js (development) | `>=22.12.0` |
| Recommended local Node | Use the version pinned in `.nvmrc` |

## Quick Start

### On a TV

1. Install the app in Developer Mode. Start with [Installation](docs/getting-started/installation.md).
2. Launch Lineup and sign in through the Plex PIN flow.
3. Select a Plex server.
4. Run the first-time Channel Setup flow to build your first lineup.
5. Open the guide, surf channels, and refine the lineup in settings.

If you want the shortest path, use [Quick Start](docs/getting-started/quick-start.md).

### From Source

```bash
git clone https://github.com/TJZine/Lineup.git
cd Lineup
nvm install
npm ci
npm run verify
npm run package:webos
```

`npm run package:webos` produces the build and packages `dist/` into an installable IPK. For the full environment and deployment flow, see [Development Setup](docs/development/setup.md).

## Documentation

### Product and User Docs

| Guide | Use It For |
| --- | --- |
| [Getting Started](docs/getting-started/README.md) | First-time install and first-run flow |
| [Installation](docs/getting-started/installation.md) | TV sideloading and deployment |
| [Quick Start](docs/getting-started/quick-start.md) | Fastest path to a working lineup |
| [Your First Channel](docs/getting-started/first-channel.md) | Building a lineup more intentionally |
| [User Guide](docs/user-guide/README.md) | Day-to-day usage and configuration |
| [Troubleshooting](docs/user-guide/troubleshooting.md) | Common setup and playback issues |
| [FAQ](FAQ.md) | Short answers to common questions |

### Development and Project Docs

| Guide | Use It For |
| --- | --- |
| [Development Quick Reference](dev-workflow.md) | Day-to-day commands |
| [Development Setup](docs/development/setup.md) | Local environment and packaging |
| [Testing Guide](docs/development/testing.md) | Test scope and verification flow |
| [Debugging Guide](docs/development/debugging.md) | Emulator, browser, and device debugging |
| [Architecture Overview](docs/architecture/README.md) | Architecture reading order and references |
| [Current Architecture State](docs/architecture/CURRENT_STATE.md) | Canonical architecture truth |
| [Plex Integration Reference](docs/api/plex-integration.md) | Plex contract details |
| [Contributing](CONTRIBUTING.md) | PR workflow and review expectations |

## Development Commands

```bash
npm run dev
npm run typecheck
npm run test:all
npm run verify
npm run verify:docs
npm run package:webos
```

Use `npm run verify` before landing app changes. Use `npm run verify:docs` for documentation-only changes.

## Contributing

Issues, docs fixes, and pull requests are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md) for the repo workflow, verification expectations, and issue/PR guidance.

## License

Lineup is licensed under Apache 2.0. See [LICENSE](LICENSE).
