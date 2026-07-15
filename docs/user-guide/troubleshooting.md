# Troubleshooting

Common issues and how to fix them.

## Installation Issues

### Developer Mode is expiring or has expired

**Before expiry**: Open the **Developer Mode** app and select **Extend Session**.
Extending the session before it expires keeps sideloaded apps installed.

**After Developer Mode is disabled**: LG uninstalls Developer Mode-installed
apps. Re-enable Developer Mode, then reinstall the Lineup IPK using the
[Installation Guide](../getting-started/installation.md).
See LG's [Developer Mode app documentation](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app)
for the platform lifecycle.

### "Connection Refused" when installing

**Issue**: `ares-install` fails with connection error.
**Fix**:

1. Ensure TV and PC are on the same Wi-Fi.
2. Check if the IP address in Developer Mode app has changed.
3. Turn "Key Server" OFF and ON again in Developer Mode app.

## Playback Issues

### Video buffers constantly

> [!TIP]
> 4K content requires high bandwidth. Try wired Ethernet for best results.

- **Network**: Check your Wi-Fi signal strength.
- **Server**: Your Plex server might be struggling to transcode. Lineup tries to Direct Play, but sometimes transcoding is unavoidable (e.g., unsupported subtitles).

### Subtitles are missing or “unavailable”

See the dedicated guide: [Subtitles](subtitles.md).

### "Playback Failed" error

- **File Moved**: Use "Scan Library Files" in Plex to ensure the file still exists.
- **Format**: The specific video codec might not be supported by webOS.

### Audio is out of sync

- Try pausing and resuming playback.
- If persistent, check if "Direct Play" is active in Plex Dashboard. Transcoding sometimes introduces sync issues.

### Dolby Vision MKV shows dark letterbox bars

- Set **HDR Fallback** to **Prefer HDR10 (Direct Play)** (Settings → Playback & HDR) to prefer the HDR10 base layer without forcing a transcode.
- The setting only affects MKV; MP4/TS Dolby Vision behavior is unchanged.
- If the issue persists, use **Force HLS/Transcode** to request an HLS session with the HDR10 base layer.

## EPG & Channel Issues

### Guide data is empty

- Wait a moment; schedule generation happens in the background.
- If persistent, try running the setup wizard again to regenerate the schedule.

### Wrong poster art

- Lineup caches images for performance. If you changed art in Plex, it might take a while to update in Lineup.

## Still stuck?

> [!NOTE]
> When opening an issue, include your TV model, webOS version, and steps to reproduce.

Please [open an issue](https://github.com/TJZine/Lineup/issues) on GitHub.
