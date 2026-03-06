# Module Reference

This document is a current module inventory and ownership reference.

For the canonical current-state summary, start with [`CURRENT_STATE.md`](./CURRENT_STATE.md).

## Composition Roots

### `src/bootstrap.ts`

- top-level environment bootstrap

### `src/App.ts`

- app shell composition
- screen/runtime startup wiring

### `src/core/InitializationCoordinator.ts`

- startup sequencing collaborator

### `src/Orchestrator.ts`

- runtime coordination and top-level feature delegation

## Core Modules

### Lifecycle: `src/modules/lifecycle/`

- app lifecycle phases
- persistence coordination
- error recovery and cleanup

### Navigation: `src/modules/navigation/`

- remote handling
- focus movement
- navigation coordination

### Player: `src/modules/player/`

- playback runtime
- subtitle attachment/conversion
- keep-alive, retry, and recovery flows

### Scheduler: `src/modules/scheduler/`

- schedule calculation
- shuffle/order logic
- channel domain operations and persistence boundaries

## Plex Modules

### Auth: `src/modules/plex/auth/`

- OAuth PIN flow
- Plex token handling

### Discovery: `src/modules/plex/discovery/`

- server discovery
- server selection persistence

### Library: `src/modules/plex/library/`

- library and metadata retrieval
- Plex response parsing

### Stream: `src/modules/plex/stream/`

- stream URL resolution
- subtitle/transcode/HDR policy

## Settings And Debug Owners

### `src/modules/ui/settings/`

- settings screen
- UI settings persistence via `SettingsStore`

### `src/modules/settings/`

- audio-focused settings storage

### `src/modules/debug/`

- debug overrides and now-playing debug behavior

## UI Modules

### Shared UI

- `src/modules/ui/common/`
- shared shells, overlay primitives, and branding helpers

### Screens And Overlays

- `src/modules/ui/auth/`
- `src/modules/ui/server-select/`
- `src/modules/ui/profile-select/`
- `src/modules/ui/settings/`
- `src/modules/ui/channel-setup/`
- `src/modules/ui/epg/`
- `src/modules/ui/player-osd/`
- `src/modules/ui/now-playing-info/`
- `src/modules/ui/mini-guide/`
- `src/modules/ui/channel-badge/`
- `src/modules/ui/channel-number-overlay/`
- `src/modules/ui/channel-transition/`
- `src/modules/ui/playback-options/`
- `src/modules/ui/exit-confirm/`
- `src/modules/ui/audio-setup/`
- `src/modules/ui/sleep-timer/`
- `src/modules/ui/splash/`
- `src/modules/ui/toast/`
- `src/modules/ui/theme/`

## Current Hotspot Reference

The most important structural hotspots remain:

- `src/Orchestrator.ts`
- `src/App.ts`
- `src/modules/ui/epg/EPGComponent.ts`
- `src/modules/ui/settings/SettingsScreen.ts`
- `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
- `src/modules/plex/stream/PlexStreamResolver.ts`
- `src/modules/scheduler/channel-manager/ChannelManager.ts`
