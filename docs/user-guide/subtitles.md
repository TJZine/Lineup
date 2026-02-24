# Subtitles

Lineup supports Plex subtitle tracks with a few different delivery paths. On webOS, “subtitle support” is mostly about *how we fetch and render text*, and *when we ask Plex to transcode (burn-in)*.

## Subtitle Mode

Settings → **Audio & Subtitles** → **Subtitle Mode**

- **Off**: Lineup won’t auto-select subtitles. You can still pick **Off** during playback.
- **Direct only (fastest)**: Only show subtitles that can be fetched directly (best performance).
- **Standard (avoid transcoding)**: Allow server extraction for text subtitles, but try to avoid burn-in transcoding.
- **Full (Burn-in, default)**: Also allow image/styled subtitles (PGS/ASS/etc) via burn-in transcoding, and may use burn-in when other subtitle paths aren’t available.

## Subtitle selection persistence

Lineup does **not** remember a specific subtitle track selection (per-item or globally). If you change subtitles during playback, that choice applies only to the current program/stream.

To influence auto-selection, use **Preferred Subtitle Language** and **Prefer Forced Subtitles** in Settings.

## Playback labels

When choosing subtitles in **Playback Options**:

- **Direct**: The subtitle file can be fetched directly.
- **Extract**: Lineup asks Plex to extract/serve the subtitle text and converts it for webOS playback.
- **Burn-in**: Lineup asks Plex to burn subtitles into the video stream (transcoding).

## Troubleshooting

### “No direct subtitles available”

You’re likely in **Subtitle Mode → Direct only (fastest)**. Switch to **Full (Burn-in, default)** or **Standard (avoid transcoding)**.

### “Subtitles unavailable for this item”

Try in order:

1. Set **Subtitle Mode → Standard (avoid transcoding)** and re-select the subtitle track.
2. If you need styled/image subtitles (PGS/ASS) or extraction keeps failing, set **Subtitle Mode → Full (Burn-in, default)**.

### Collecting logs for an issue

Enable **Settings → Developer → Subtitle Debug Logging**, reproduce the problem, and capture the TV/app logs.

For engineering notes on what Lineup tries (and what usually fails on webOS), see [docs/development/subtitles.md](../development/subtitles.md).
