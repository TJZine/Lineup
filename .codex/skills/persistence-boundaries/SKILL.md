---
name: persistence-boundaries
description: Use when adding or changing local persistence, storage-backed settings, channel data, selected server state, or any code that reads or writes browser storage in Lineup.
---

# Persistence Boundaries

## Overview

Use this skill to keep storage concerns behind typed owners and out of screens, controllers, and feature logic.

Lineup's rule is simple: one storage namespace, one owner.

## Current Storage Owners

- [`src/modules/lifecycle/StateManager.ts`](../../../src/modules/lifecycle/StateManager.ts)
- [`src/modules/settings/AudioSettingsStore.ts`](../../../src/modules/settings/AudioSettingsStore.ts) - owns audio toggles plus `lineup_audio_setup_complete`
- [`src/modules/settings/DeveloperSettingsStore.ts`](../../../src/modules/settings/DeveloperSettingsStore.ts) - owns `debugLogging` and `subtitleDebugLogging`
- [`src/modules/settings/PlaybackSettingsStore.ts`](../../../src/modules/settings/PlaybackSettingsStore.ts)
- [`src/modules/settings/EpgPreferencesStore.ts`](../../../src/modules/settings/EpgPreferencesStore.ts)
- [`src/modules/settings/NowPlayingDisplayStore.ts`](../../../src/modules/settings/NowPlayingDisplayStore.ts)
- [`src/modules/settings/ProfileSessionStore.ts`](../../../src/modules/settings/ProfileSessionStore.ts)
- [`src/modules/settings/SubtitlePreferencesStore.ts`](../../../src/modules/settings/SubtitlePreferencesStore.ts) - owns subtitle mode policy including burn-in allowance
- [`src/modules/settings/ThemePreferencesStore.ts`](../../../src/modules/settings/ThemePreferencesStore.ts)
- [`src/modules/debug/DebugOverridesStore.ts`](../../../src/modules/debug/DebugOverridesStore.ts) - owns debug overrides including `lineup_debug_epg`
- [`src/modules/debug/IssueDiagnosticsStore.ts`](../../../src/modules/debug/IssueDiagnosticsStore.ts)
- [`src/modules/plex/auth/PlexAuth.ts`](../../../src/modules/plex/auth/PlexAuth.ts)
- [`src/modules/plex/auth/clientIdentifier.ts`](../../../src/modules/plex/auth/clientIdentifier.ts)
- [`src/modules/plex/discovery/ServerSelectionStore.ts`](../../../src/modules/plex/discovery/ServerSelectionStore.ts)
- [`src/modules/scheduler/channel-manager/ChannelPersistenceStore.ts`](../../../src/modules/scheduler/channel-manager/ChannelPersistenceStore.ts)
- [`src/core/channel-setup/ChannelSetupRecordStore.ts`](../../../src/core/channel-setup/ChannelSetupRecordStore.ts)
- [`src/modules/ui/epg/utils.ts`](../../../src/modules/ui/epg/utils.ts) - bounded owner for the `lineup_debug_epg_log` cache
- Shared storage helpers in [`src/utils/storage.ts`](../../../src/utils/storage.ts)

## Core Rules

- Do not add raw `localStorage` access outside a dedicated owner/store/repository.
- Do not spread key names, JSON parsing, or defaults across callers.
- Normalize invalid values immediately at the boundary.
- Storage failure must stay non-fatal unless product requirements explicitly say otherwise.
- Feature modules should depend on typed owner APIs, not storage mechanics.
- Migrations and compatibility parsing belong inside the owner, not inside UI or orchestration code.

## Required Tests

Every new or changed storage owner should cover:

- valid stored value
- invalid stored value
- missing/default state
- blocked or failing storage

Follow the existing store test pattern before creating a new one.

## Verification

- Run `npm run typecheck` and `npm test` for storage-only changes.
- Run `npm run verify` when the persistence change also touches UI, Orchestrator, or Plex wiring.

## Common Mistakes

- A screen reading raw JSON because "it's only one key"
- A controller owning both workflow logic and storage defaults
- Copying an existing storage key into another module instead of introducing a boundary
- Treating parse failures as impossible
