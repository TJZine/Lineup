# Settings

Access Settings by pressing the **Yellow** button (F3 on keyboard) on your remote, or through the menu overlay.

Settings are organized into categories in a two-pane layout: select a category on the left, adjust options on the right. A **Switch Profile** button sits below the category list for switching Plex Home profiles.

## Categories

### 🔊 Audio & Subtitles

Controls for audio and subtitle behavior during playback.

| Setting | Description |
|---------|-------------|
| **DTS Passthrough** | Enable if you have an eARC receiver |
| **Direct Play Audio Fallback** | Allow Direct Play using a compatible fallback audio track |
| **Subtitle Mode** | Controls subtitle delivery (see below) |
| **Preferred Subtitle Language** | Override the Plex user preference (Auto uses Plex default) |
| **Prefer Forced Subtitles** | Auto-select forced (partial) subtitles over full subtitles |

#### Subtitle Modes

| Mode | Description |
|------|-------------|
| **Off** | Disable subtitles entirely |
| **Direct only (fastest)** | Only use subtitles that can be delivered without transcoding |
| **Standard (avoid transcoding)** | Use subtitles but prefer methods that avoid server transcoding |
| **Full (Burn-in, default)** | Enable all subtitle types including burn-in (may require transcoding) |

### ▶ Playback & HDR

Controls for video playback, HDR, and Dolby Vision behavior.

| Setting | Description |
|---------|-------------|
| **Keep Playback Running in Settings** | Avoid pausing video when opening Settings (uses more CPU/GPU) |
| **HDR Fallback** | For Dolby Vision MKV only: Off / Smart (Recommended) / Force |
| **Transcode Quality** | Caps Plex transcoding bitrate/resolution (Direct Play is unaffected) |
| **Transcode Compat Mode** | Advanced: sends a minimal parameter set to Plex (only use if transcoding fails) |

### 🎨 Appearance

Visual customization for the UI and EPG.

| Setting | Description |
|---------|-------------|
| **Category Colors** | Show colored left border for auto-setup channel types in the EPG |
| **Library Tabs** | Filter the guide by source library |
| **Now Watching Banner** | Show current channel/program above the guide |
| **Aggressive Guide Preload** | Uses more memory to reduce loading in very large guides (Experimental) |
| **Guide Density** | Detailed (2h) or Wide (3h) time window |
| **Guide Layout** | Overlay (full-screen video) or Classic (PIP) |
| **Past Items** | How much past programming to show (Auto uses Shows: 0m, Movies: 15m) |
| **Info Box Background** | Artwork Bleed / Artwork / Theme Default |
| **Theme** | Visual style of the entire application |
| **Cinematic Now Playing** | Full-screen layout with blurred backdrop and large poster |
| **Use Clear Logos** | Show clear logos instead of text titles when available |
| **Now Playing Auto-Hide** | Info overlay hide delay (or Persistent) |

### 👤 Account

| Setting | Description |
|---------|-------------|
| **Show Profile Picker on Startup** | When enabled, prompt for a Plex Home profile on launch |

### 🛠 Developer

Advanced options for debugging and development.

| Setting | Description |
|---------|-------------|
| **Debug Logging** | Enable verbose console output (applies immediately) |
| **Subtitle Debug Logging** | Log subtitle tracks and native textTracks state (tokens redacted) |

> [!NOTE]
> Developer settings are intended for troubleshooting. Changing these settings may affect playback behavior.

## Navigating Settings

- Use **Up/Down** to move between categories on the left rail.
- Press **Right** or **OK** to enter the settings detail pane.
- Use **Left** to return to the category rail.
- For select controls, use **Left/Right** to cycle through options, or press **OK** to open a dropdown.
- Press **Back** to close Settings and return to playback.

## See Also

- [Subtitles Guide](subtitles.md) — Detailed subtitle mode information
- [Remote Control Reference](remote-keys.md) — Full button mapping
