# Subtitles (Engineering)

This document is a living “what we do and why” for subtitles on webOS, plus the known failure modes and the debugging signals Lineup emits.

## Goals

- Make **embedded text subtitles** (especially SRT/SubRip) reliable.
- Keep the UX **simple** (streaming-app expectations) while preserving power options (direct-only and burn-in).
- Avoid leaking Plex tokens (URLs must be redacted in logs).
- Avoid persisting subtitle track selections across items/channels (webOS subtitle handling is brittle).

## Terminology

- **Direct**: A subtitle stream can be fetched directly from Plex (often has a `key`).
- **Extract**: Lineup asks Plex to extract/serve the selected subtitle stream as text, then converts to WebVTT.
- **Burn-in**: Lineup asks Plex to burn subtitles into the video stream (forces transcoding).

## Current architecture

### Track discovery

- `PlexStreamResolver` returns `StreamDecision.availableSubtitleStreams`.
- `PlaybackRecoveryManager` maps those to `SubtitleTrack[]` and builds `StreamDescriptor.subtitleContext`.
- `VideoPlayer` loads tracks via `SubtitleManager`.
- Subtitle track selections are not persisted; only language preferences influence auto-selection.
- `StreamRequest.subtitleStreamId` is treated as **strict**: if the requested subtitle stream is not present in any selectable media version/part, `resolveStream()` throws `SUBTITLE_STREAM_NOT_FOUND` rather than silently dropping the selection.

Key files:
- `src/modules/plex/stream/resolver/PlexStreamResolver.ts`
- `src/modules/player/PlaybackRecoveryManager.ts`
- `src/modules/player/VideoPlayer.ts`
- `src/modules/player/SubtitleManager.ts`

### WebOS constraints (practical)

- `<track src="...">` **cannot send auth headers** (Plex token/header), and token-in-URL has tradeoffs.
- Older embedded Chromium builds can fail `fetch()` on some responses (chunked encoding issues), where XHR succeeds.
- `HTMLTrackElement` is most reliable with **WebVTT**. SRT/subrip often requires conversion.

## What Lineup tries (in order)

When a user selects a subtitle track that isn’t already “ready”, `SubtitleManager` fetches the subtitle text and converts to WebVTT, then attaches it as a `blob:` URL.

### Attempt A: direct subtitle stream

Try `/library/streams/{id}` (or `track.key` when present), with a few auth variants:

- token in query
- token in header
- +`download=1` variants

### Attempt B: PMS universal subtitle extraction

If direct stream fails (common for keyless/embedded), request:

- `GET /video/:/transcode/universal/subtitles`
  - `path=/library/metadata/{ratingKey}`
  - `mediaIndex={selected}`
  - `partIndex={selected}`
  - `subtitleStreamID={streamId}`
  - `format=srt`
  - `download=1`
  - best-effort identity params (`X-Plex-*`) + token

Lineup then runs `normalizeSubtitleToVtt()` and uses a VTT `Blob`.

### Burn-in escalation (Full mode)

If **Subtitle Mode = Full (Burn-in, default)**, Lineup triggers a best-effort burn-in reload when needed:

- immediately for burn-in formats (PGS/ASS/etc) when selected in Playback Options
- when a fast direct-stream probe suggests a text track is not directly fetchable (avoid slow Extract UX)
- when extraction fails after a normal selection attempt

- `PlaybackRecoveryManager.attemptBurnInSubtitleForCurrentProgram(trackId, reason)`
- `PlexStreamResolver.resolveStream({ directPlay: false, subtitleMode: 'burn', subtitleStreamId })`

## The “embedded SRT doesn’t work” cluster

Historically, the most common causes:

1. **Wrong `mediaIndex`/`partIndex`** for the selected stream version.
2. **Keyless streams** where `/library/streams/{id}` is unsupported (sometimes 501).
3. **Auth/identity quirks** for the universal subtitle endpoint depending on server/profile matching.
4. **Transport quirks on webOS** (fetch works on desktop, fails on TV; XHR works on TV).
5. **Non-VTT text formats** being attached directly to `<track>` (works inconsistently).

Lineup now carries `mediaIndex`/`partIndex` through to the universal subtitle extraction URL and avoids attaching non‑VTT sources as `<track src>`.

## Debugging

Enable:
- `lineup_subtitle_debug_logging=1` (Settings → Developer → Subtitle Debug Logging)

Look for `[SubtitleDebug]` JSON logs. Helpful events:

- `subtitle_tracks_discovered` (counts and codecs)
- `subtitle_track_deferred` (non-VTT requires conversion)
- `subtitle_fallback_used` (why conversion path started)
- `subtitle_fetch_error` (includes attempt + status + redacted URL)
- `subtitle_conversion_result` (format detected + bytes)
- `subtitle_track_ready` / `subtitle_track_error`

### Quick triage matrix

- Many `subtitle_fetch_error` with `html_response`: likely auth/redirect/captive portal/plex sign-in page.
- `subtitle_text_fetch_failed*` (fetch exceptions): webOS transport quirk; XHR fallback may succeed.
- Repeated failures on `/video/:/transcode/universal/subtitles`: check required identity/query params and profile matching.
- Burn-in succeeds but Extract fails: likely PMS subtitle extraction endpoint behavior vs stream endpoint behavior.
- `SUBTITLE_STREAM_NOT_FOUND`: `StreamRequest.subtitleStreamId` was not present where `resolveStream()` expected it.
  - Failure path A (strict selection; before media+part selection): `resolveStream()` could not find any selectable media version/part containing `subtitleStreamId` (stale ID, media versions changed, selection constraints excluded the version that had it). Verify the `subtitleStreamId` against the currently loaded/selectable media versions + parts (ensure metadata is fresh and selection filters or ingest jobs haven’t removed/renamed the stream); then re-sync stream metadata or clear the stale selection.
  - Failure path B (burn-in only; after mediaIndex/partIndex selection): burn-in was requested, but the selected part does not contain `subtitleStreamId`. Confirm the subtitle appears in the selected media version + part metadata and that the selected part/version wasn’t changed before the burn-in retry.

## Future experiments (if embedded still fails)

- Try requesting alternate formats for universal subtitles:
  - `format=vtt` / `format=webvtt` (keep conversion but accept server-vtt when present).
- Consider “always blob-fetch” for subtitles (even VTT) to avoid `<track src>` auth/CORS quirks.
- Cache extracted VTT per session (avoid re-fetching on reselect).
- UI affordance: “Try Burn‑in” action in Playback Options (explicit instead of only automatic in Full mode).
