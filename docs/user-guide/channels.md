# Channel Management

Channels are the core of Retune. Each channel represents a curated stream of content from your Plex library.

## Creating a Channel

1. Navigate to **Settings** -> **Channels**.
2. Select **"New Channel"**.
3. Configure the following options:

### Basic Settings

- **Number**: The channel number (e.g. 101). Must be unique.
- **Name**: Display name in the EPG (e.g. "Action Movies").
- **Icon**: Choose a visual identifier for the channel.

### Content Source

Choose where the channel gets its videos:

| Source Type | Description |
|-------------|-------------|
| **Library** | Uses an entire Plex Library (e.g. "Movies"). You can filter by genre, year, etc. |
| **Collection** | Uses a specific Plex Collection. Great for curated lists like "Marvel Universe". |
| **Show** | Plays a specific TV Show. Great for 24/7 marathon channels (e.g., "The Office"). |
| **Playlist** | Uses a Plex Playlist. |

### Playback Mode

Determines the order of content:

- **Shuffle**: Best for movie channels. Deterministic shuffle means the schedule is consistent for the day.
- **Sequential**: Plays items in order (A-Z for movies, S01E01... for shows). Best for "binge" channels.
- **Random**: True random shuffle. The schedule changes every time you look.

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
  - Adds a sequential companion channel for each generated non-sequential channel.
  - Naming format:
    - `Action • Sequential`
    - `Action (2) • Sequential`

### High-Volume Defaults and Quick Action

- Setup defaults are now:
  - **Max channels**: `200`
  - **Min items per channel**: `5`
- Use **Expand Lineup** to quickly set:
  - **Max channels** to the app cap
  - **Min items per channel** to `1`

### Legacy Compatibility

- `libraryFallback` is preserved only for backward compatibility with older saved records and is no longer shown as a selectable setup strategy.

## Editing a Channel

1. Go to **Settings** -> **Channels**.
2. Select the channel you want to modify.
3. Change settings and select **Save**.
4. **Note**: Changing content or playback mode will regenerate the schedule.

## Deleting a Channel

1. Go to **Settings** -> **Channels**.
2. Select the channel.
3. Scroll down and select **Delete Channel**.
4. Confirm the action.

## Channel Ordering

Channels appear in the EPG sorted by **Channel Number**. To reorder them, simply edit their numbers.
