# Module Reference

This is a current module inventory and ownership reference.

For the canonical current-state summary, start with [`CURRENT_STATE.md`](./CURRENT_STATE.md).

This document is directory-oriented and lists file-level owners where the canonical current-state source names them explicitly.

## Stable Top-Level App Surfaces

### `src/bootstrap.ts`

- environment bootstrap entrypoint

### `src/App.ts`

- app shell composition
- runtime startup and screen wiring

### `src/Orchestrator.ts`

- runtime coordination and top-level feature delegation

### `src/core/InitializationCoordinator.ts`

- startup sequencing collaborator between app shell and orchestrator

### `src/core/`

- core collaborators layer used by orchestration and startup paths
- currently hosts focused coordinators in:
  - `src/core/app-shell/`
  - `src/core/channel-setup/`
  - `src/core/channel-tuning/`
  - `src/core/error-recovery/`
  - `src/core/orchestrator/`
  - `src/core/__tests__/`

### `src/core/orchestrator/`

- orchestrator-facing core collaborators and shared orchestrator type ownership
- `src/core/orchestrator/OrchestratorTypes.ts` is the durable owner of `OrchestratorConfig` and `ModuleStatus`
- `src/core/orchestrator/OrchestratorModuleFactory.ts` owns runtime module constructor/config assembly for `AppOrchestrator.initialize()`
- `src/core/orchestrator/OrchestratorCoordinatorFactory.ts` owns coordinator construction and dependency assembly previously in `AppOrchestrator._createCoordinators()`
- `src/core/orchestrator/OrchestratorPriorityOneControllerFactory.ts` owns Priority-1 controller and `OrchestratorEventBinder` construction previously in `AppOrchestrator._initializePriorityOneControllers()`
- `src/Orchestrator.ts` remains the public re-export surface for external callers (including `src/App.ts` and tests)

### `src/config/`

- configuration constants and typed config helpers used across modules

### `src/platform/`

- webOS-specific platform adapters and platform-aware helpers

### `src/shared/`

- shared utilities and domain-neutral constants used across features

### `src/styles/`

- shared styling resources and style helpers

### `src/types/`

- shared TypeScript types used across the architecture

### `src/utils/`

- general-purpose helper functions used by multiple modules

### `src/modules/`

- feature module cluster (listed below)

## Core Modules

### `src/modules/lifecycle/`

- app lifecycle phases
- persistence coordination
- error recovery and cleanup

### `src/modules/navigation/`

- remote handling
- focus movement
- navigation coordination

### `src/modules/player/`

- playback runtime
- subtitle attachment/conversion
- keep-alive, retry, and recovery flows

### `src/modules/scheduler/`

- schedule calculation and shuffle/order logic
- channel domain operations and persistence boundaries
- meaningful submodules:
  - `src/modules/scheduler/channel-manager/`
  - `src/modules/scheduler/scheduler/`
  - `src/modules/scheduler/shared/`

### `src/modules/settings/`

- settings persistence boundary and typed domain stores

### `src/modules/debug/`

- debug overrides and diagnostics behavior support

## Plex Modules

### `src/modules/plex/auth/`

- OAuth PIN flow
- Plex token handling

### `src/modules/plex/discovery/`

- server discovery
- server selection persistence

### `src/modules/plex/library/`

- library and metadata retrieval
- Plex response parsing

### `src/modules/plex/stream/`

- stream URL resolution
- subtitle/transcode/HDR policy

### `src/modules/plex/shared/`

- shared Plex helpers and cross-cutting Plex logic used by plex feature modules

## Settings and Debug Owners

### `src/modules/ui/settings/`

- settings screen
- `SettingsStore` and user settings persistence hooks
- `src/modules/ui/settings/SettingsStore.ts`

### `src/modules/settings/`

- audio settings storage ownership
- `src/modules/settings/AudioSettingsStore.ts`

### `src/modules/debug/`

- debug flags and override persistence
- `src/modules/debug/DebugOverridesStore.ts`

### `src/modules/plex/discovery/`

- server selection persistence layer under discovery
- `src/modules/plex/discovery/ServerSelectionStore.ts`

### `src/modules/scheduler/channel-manager/`

- channel persistence ownership and normalization for channel manager
- `src/modules/scheduler/channel-manager/ChannelPersistenceStore.ts`

## UI Modules

### Shared UI

- `src/modules/ui/common/`
- shared shells, overlay primitives, and branding helpers

### Screens and Overlays

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

The most important structural hotspots remain and should be treated as active work targets:

- `src/Orchestrator.ts`
- `src/App.ts`
- `src/modules/ui/epg/EPGComponent.ts`
- `src/modules/ui/settings/SettingsScreen.ts`
- `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
- `src/modules/plex/stream/PlexStreamResolver.ts`
- `src/modules/scheduler/channel-manager/ChannelManager.ts`

## Cleanup Backlog Direction

- `src/Orchestrator.ts` → `P1` in [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../ARCHITECTURE_CLEANUP_CHECKLIST.md)
- `src/App.ts` → `P2` in [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../ARCHITECTURE_CLEANUP_CHECKLIST.md)
- `src/modules/ui/epg/EPGComponent.ts`, `src/modules/ui/settings/SettingsScreen.ts`, `src/modules/ui/channel-setup/ChannelSetupScreen.ts` → `P4` in [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../ARCHITECTURE_CLEANUP_CHECKLIST.md)
- `src/modules/plex/stream/PlexStreamResolver.ts` → `P5` in [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../ARCHITECTURE_CLEANUP_CHECKLIST.md)
- `src/modules/scheduler/channel-manager/ChannelManager.ts` → `P6` in [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../ARCHITECTURE_CLEANUP_CHECKLIST.md)

The backlog-direction entries above are planned outcomes and are not current completed fact.
