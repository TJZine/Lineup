# Lineup

Lineup turns a Plex library into a remote-friendly live TV experience on LG webOS TVs. Instead of picking something on demand, you build channels and tune into a schedule that keeps moving whether you are watching or not.

## Status

Lineup is currently a sideloaded webOS app. Installation on a TV requires LG Developer Mode until a store release exists.

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

- [Getting Started](docs/getting-started/README.md)
- [Installation](docs/getting-started/installation.md)
- [Quick Start](docs/getting-started/quick-start.md)
- [Your First Channel](docs/getting-started/first-channel.md)
- [User Guide](docs/user-guide/README.md)
- [Channel Management](docs/user-guide/channels.md)
- [EPG Guide](docs/user-guide/epg.md)
- [Subtitles](docs/user-guide/subtitles.md)
- [Remote Keys](docs/user-guide/remote-keys.md)
- [Troubleshooting](docs/user-guide/troubleshooting.md)
- [FAQ](FAQ.md)

### Development and Project Docs

- [Development Quick Reference](dev-workflow.md)
- [Development Setup](docs/development/setup.md)
- [Testing Guide](docs/development/testing.md)
- [Debugging Guide](docs/development/debugging.md)
- [Architecture Overview](docs/architecture/README.md)
- [Current Architecture State](docs/architecture/CURRENT_STATE.md)
- [Plex Integration Reference](docs/api/plex-integration.md)
- [Contributing](CONTRIBUTING.md)

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
