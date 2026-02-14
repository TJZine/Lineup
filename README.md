<h1 align="center">
  <br>
  📺 Retune
  <br>
</h1>

<p align="center">
  <strong>Transform your Plex library into live TV channels on LG webOS TVs.</strong>
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-installation">Installation</a> •
  <a href="#-documentation">Documentation</a> •
  <a href="#-contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License: Apache 2.0">
  <img src="https://img.shields.io/badge/platform-webOS%206.0%2B-brightgreen.svg" alt="Platform: webOS 6.0+">
  <img src="https://img.shields.io/badge/typescript-5.3-blue.svg" alt="TypeScript 5.3">
  <img src="https://img.shields.io/badge/node-%5E20.19.0_%7C%7C_%3E%3D22.12.0-green.svg" alt="Node ^20.19.0 || >=22.12.0">
</p>

---

## What is Retune?

Retune transforms your Plex media library into simulated **live television channels** on your LG Smart TV. Instead of browsing and selecting content on-demand, you can tune into curated channels that play content on a schedule—just like traditional broadcast TV.

**Perfect for**:

- 🛋️ Passive viewing without decision fatigue
- 📺 Recreating the "cable TV" experience with your own content
- 🎬 Themed movie marathons that run themselves
- 📼 Nostalgic channel surfing through your media library

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📊 **Electronic Program Guide** | Browse channels and schedules in a familiar TV guide grid |
| 🔀 **Flexible Playback Modes** | Sequential, shuffle, or random playback per channel |
| ⏱️ **Time-Based Scheduling** | Content plays based on wall-clock time—tune in mid-program like real TV |
| 🎮 **Full Remote Support** | Navigate with your LG Magic Remote or standard remote |
| 💾 **Persistent Channels** | Your channel configurations survive app restarts |
| 🔐 **Secure Plex Auth** | OAuth PIN-based login—no typing passwords on your TV |
| 🖥️ **Multi-Server Support** | Connect to any Plex server you have access to |

---

## 🚀 Quick Start

Get Retune running in 5 minutes:

### Prerequisites

- ✅ LG Smart TV (2021 or newer with webOS 6.0+)
- ✅ Plex Media Server with content
- ✅ Plex account (free or Plex Pass)

### Steps

1. **Install Retune** on your LG TV (see [Installation](#-installation))
2. **Launch the app** and note the PIN code displayed
3. **Visit** [plex.tv/link](https://plex.tv/link) on any device
4. **Enter the PIN** to authorize Retune
5. **Select your Plex server** when prompted
6. **Create your first channel** from any library, collection, or show
7. **Start watching!** 🎉

---

## 📦 Installation

### From Source (Developer)

> [!NOTE]
> End-user installation instructions will be added once the app is published to the LG Content Store.

```bash
# Clone the repository
git clone https://github.com/TJZine/Retune.git
cd Retune

# Use the recommended Node version from .nvmrc
nvm use

# Install dependencies
npm install

# Build the application
npm run build

# Package for webOS
ares-package dist/

# Install to your TV (replace 'my-tv' with your device name)
ares-install --device my-tv com.retune.app_1.0.0_all.ipk

# Launch the app
ares-launch --device my-tv com.retune.app
```

> [!TIP]
> See the [Development Workflow Guide](dev-workflow.md) for detailed setup instructions, including webOS SDK installation and TV developer mode setup.

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| **Getting Started** | |
| [Quick Start](#-quick-start) | 5-minute setup guide |
| [Development Workflow](dev-workflow.md) | Complete development environment setup |
| **User Guides** | |
| [Creating Channels](docs/user-guide/channels.md) | How to create and manage channels |
| [Using the EPG](docs/user-guide/epg.md) | Navigating the program guide |
| [Remote Control Reference](docs/user-guide/remote-keys.md) | Button mappings and shortcuts |
| [FAQ](FAQ.md) | Frequently asked questions |
| **Technical** | |
| [Architecture Overview](docs/architecture/README.md) | System design and module breakdown |
| [Contributing](CONTRIBUTING.md) | How to contribute to Retune |

---

## 🎮 Remote Control

| Button | Action |
|--------|--------|
| ↑ ↓ ← → | Navigate menus and EPG |
| **OK** | Select / Confirm |
| **Back** | Go back / Close overlay |
| **Guide** | Open Electronic Program Guide |
| **CH +/-** | Change channel |
| **Play/Pause** | Toggle playback |
| **Info** | Show current program info |

<details>
<summary>Keyboard Shortcuts (Browser Development)</summary>

| Key | Remote Equivalent |
|-----|-------------------|
| Arrow Keys | D-pad |
| Enter | OK |
| Backspace / Escape | Back |
| G | Guide |
| Space | Play/Pause |
| I | Info |

</details>

---

## 🔧 Requirements

| Component | Requirement |
|-----------|-------------|
| **TV** | LG Smart TV (2021+ with webOS 6.0 or later) |
| **Node.js (development)** | `^20.19.0` \|\| `>=22.12.0` (recommended: `nvm use`) |
| **Plex Server** | Plex Media Server (any recent version) |
| **Plex Account** | Free or Plex Pass |
| **Network** | TV and Plex server on same network (or Plex relay enabled) |

### Supported Content

- 🎬 Movies
- 📺 TV Shows (episodes scheduled in order or shuffled)
- 🎵 Music (audio-only channels)
- 📁 Plex Collections and Playlists

---

## 🤝 Contributing

We welcome contributions! Whether it's:

- 🐛 Bug reports
- 💡 Feature requests
- 📝 Documentation improvements
- 🛠️ Code contributions

Please read our [Contributing Guide](CONTRIBUTING.md) to get started.

---

## 📜 License

This project is licensed under the Apache License 2.0—see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Plex](https://plex.tv) for their excellent media server platform
- [LG webOS TV](https://webostv.developer.lge.com) developer community
- Inspired by [PseudoTV](https://github.com/pseudo-tv/PseudoTV) and similar projects

---

<p align="center">
  Made with ❤️ for cord-cutters who miss channel surfing
</p>
