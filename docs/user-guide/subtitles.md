# Subtitles

Retune supports Plex subtitle tracks with a few different delivery paths. On webOS, “subtitle support” is mostly about *how we fetch and render text*, and *when we ask Plex to transcode (burn-in)*.

## Subtitle Mode

Settings → **Audio & Subtitles** → **Subtitle Mode**

- **Off**: Retune won’t auto-select subtitles. You can still pick **Off** during playback.
- **Direct only (fastest)**: Only show subtitles that can be fetched directly (best performance).
- **Standard (Recommended)**: Allow server extraction for text subtitles (e.g., embedded SRT).
- **Full (Burn-in)**: Also allow image/styled subtitles (PGS/ASS/etc) via burn-in transcoding.

## Playback labels

When choosing subtitles in **Playback Options**:

- **Direct**: The subtitle file can be fetched directly.
- **Extract**: Retune asks Plex to extract/serve the subtitle text and converts it for webOS playback.
- **Burn-in**: Retune asks Plex to burn subtitles into the video stream (transcoding).

## Troubleshooting

### “No direct subtitles available”

You’re likely in **Subtitle Mode → Direct only (fastest)**. Switch to **Standard (Recommended)**.

### “Subtitles unavailable for this item”

Try in order:

1. Set **Subtitle Mode → Standard (Recommended)** and re-select the subtitle track.
2. If you need styled/image subtitles (PGS/ASS) or extraction keeps failing, set **Subtitle Mode → Full (Burn-in)**.

### Collecting logs for an issue

Enable **Settings → Developer → Subtitle Debug Logging**, reproduce the problem, and capture the TV/app logs.

For engineering notes on what Retune tries (and what usually fails on webOS), see [docs/development/subtitles.md](../development/subtitles.md).
