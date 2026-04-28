# Channel Management

Channels are the core of Lineup. Each channel represents a curated stream of content from your Plex library.

## How Channels Work

Channels are created automatically by the setup wizard when you first launch Lineup. The wizard analyzes your Plex libraries and generates channels from your collections, genres, playlists, and individual TV shows.

### Content Sources

Each channel draws content from one of these Plex sources:

| Source Type | Description |
|-------------|-------------|
| **Library** | Uses an entire Plex Library (e.g. "Movies"). |
| **Collection** | Uses a specific Plex Collection. Great for curated lists like "Marvel Universe". |
| **Show** | Plays a specific TV Show. Great for 24/7 marathon channels (e.g., "The Office"). |
| **Playlist** | Uses a Plex Playlist. |

## Channel Setup Builder (Step 2)

The guided setup wizard can generate many channels in one pass.

### Strategy Order (Priority)

- Every strategy has a numeric **Priority**.
- Lower numbers are planned first (`1` before `4`).
- Priority helps you control which categories are created first when max-channel limits apply.

### Strategy Scope

- Default scope is **Per Library** for all strategies.
- Per-library output example: `Movies - Action` and `Shows - Action`.
- You can opt into **Mixed** scope (experimental) for category strategies that support it (Genres/Directors/Studios/Actors) to combine sources across libraries for the same category (example: `Action`).

### Expansion Options (Both Off by Default)

- **Add Alternate Lineups**:
  - Creates additional channels from the same source/category with different deterministic shuffle seeds.
  - Names use neutral numbering:
    - `Action` (base)
    - `Action (2)`, `Action (3)`, ...
- **Alternate Lineup Copies**:
  - Number of extra copies per generated channel (`1` to `3`).
- **Add Sequential Channels**:
  - Adds one sequential companion channel for each generated non-sequential base channel.
  - Naming format:
    - `Action • Sequential`

### High-Volume Defaults and Quick Action

- Setup defaults are now:
  - **Max channels**: `200`
  - **Min items per channel**: `5`
- Use **Expand Lineup** to quickly set:
  - **Max channels** to `500` (the app maximum)
  - **Min items per channel** to `1`

## Channel Ordering

Channels appear in the EPG sorted by **Channel Number**.
