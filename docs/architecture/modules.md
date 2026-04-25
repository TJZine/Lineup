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

- thin public runtime entry barrel
- re-exports `AppOrchestrator` and runtime-facing types for app/test import stability

### `src/core/app-shell/AppThemeController.ts`

- app-shell runtime owner for active theme state
- owns startup theme initialization and runtime theme updates
- composes Settings theme callbacks into app-shell runtime screen ports
- delegates persistence reads/writes to `src/modules/settings/ThemePreferencesStore.ts`

### `src/core/app-shell/AppStartupUiInitializer.ts`

- app-shell startup UI initializer owner
- initializes now-playing-info, playback-options, and exit-confirm overlays during startup
- consumed through a narrow startup-UI port by `src/core/initialization/InitializationCoordinator.ts`

### `src/core/`

- core collaborators layer used by orchestration and startup paths
- currently hosts focused coordinators in:
  - `src/core/app-shell/`
  - `src/core/channel-setup/`
  - `src/core/channel-tuning/`
  - `src/core/error-recovery/`
  - `src/core/initialization/`
  - `src/core/orchestrator/`
  - `src/core/server-selection/`
  - `src/core/__tests__/`

### `src/core/orchestrator/`

- orchestrator-facing core collaborators and shared ownership of orchestrator type definitions
- `src/core/orchestrator/OrchestratorTypes.ts` is the durable owner of `OrchestratorConfig` and `ModuleStatus`
- `src/core/orchestrator/OrchestratorModuleFactory.ts` owns runtime module constructor/config assembly for `AppOrchestrator.initialize()`
- `src/core/orchestrator/OrchestratorCoordinatorAssembly.ts` owns coordinator construction and dependency assembly previously in `AppOrchestrator._createCoordinators()`
- `src/core/initialization/InitializationCoordinator.ts` owns orchestrator startup sequencing for the app-shell/orchestrator startup path
- `src/core/orchestrator/priority-one/PriorityOneControllerFactory.ts` owns Priority-1 controller and `OrchestratorEventBinder` construction previously in `AppOrchestrator._initializePriorityOneControllers()`
- `src/Orchestrator.ts` remains the public re-export surface for external callers (including `src/App.ts` and tests)

### `src/core/initialization/`

- startup coordinator and policy collaborators for app-shell/orchestrator startup
- `src/core/initialization/InitializationStartupPolicy.ts` owns startup routing policy (auth/profile/server-select/post-ready)
- `src/modules/ui/epg/startup/buildEPGStartupConfig.ts` owns EPG startup config shaping

### `src/core/server-selection/`

- focused server-selection collaborators shared between app shell and orchestrator
- `src/core/server-selection/ServerSelectionTypes.ts` owns `OrchestratorServerSelectionResult`
- `src/core/server-selection/ServerSelectionCoordinator.ts` owns the app-shell-facing selected-server workflow previously assembled inline in `AppOrchestrator.selectServer()`, including discovery-result translation, result shaping, transactional persistence handoff, rollback, and selected-server startup-resume invocation
- `src/core/server-selection/SelectedServerRuntimeController.ts` owns selected-server persistence snapshot/restore helpers, clear-selection cleanup, and the concrete selected-server startup-resume helper consumed by the server-selection flow rather than the flow orchestration itself

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
- owns the lifecycle-only `lineup_app_state` storage boundary via `src/modules/lifecycle/StateManager.ts`

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
- settings facade for most toggles; `SettingsStore.ts` delegates debug toggles to `DeveloperSettingsStore`
- `src/modules/ui/settings/SettingsStore.ts`

### `src/modules/settings/`

- audio settings storage ownership
- `src/modules/settings/AudioSettingsStore.ts`
- developer settings storage ownership
- `src/modules/settings/DeveloperSettingsStore.ts`
- playback settings storage ownership
- `src/modules/settings/PlaybackSettingsStore.ts`
- EPG settings storage ownership
- `src/modules/settings/EpgPreferencesStore.ts`
- now-playing display settings storage ownership
- `src/modules/settings/NowPlayingDisplayStore.ts`
- profile session storage ownership
- `src/modules/settings/ProfileSessionStore.ts`
- subtitle preferences storage ownership
- `src/modules/settings/SubtitlePreferencesStore.ts`
- theme preference storage ownership
- `src/modules/settings/ThemePreferencesStore.ts`

### `src/modules/debug/`

- debug flags and override persistence
- `src/modules/debug/DebugOverridesStore.ts`
- issue diagnostics log persistence
- `src/modules/debug/IssueDiagnosticsStore.ts`

### `src/modules/ui/epg/`

- bounded exception for the EPG debug-log cache helper
- `src/modules/ui/epg/debug/debugRuntimeGuards.ts` owns safe helper fan-out through `appendDebugRuntimeLog(...)`; `src/modules/ui/epg/debug/EPGDebugRuntime.ts` owns bounded `lineup_debug_epg_log` buffering/flush behavior through runtime `append(...)`; this remains a bounded exception and is not precedent for new UI-layer storage owners

### `src/modules/plex/auth/`

- auth credential persistence and client identifier resolution
- `src/modules/plex/auth/PlexAuth.ts`
- `src/modules/plex/auth/clientIdentifier.ts`
- `src/modules/plex/auth/plexAuthTransport.ts` (shared Plex auth transport owner for `PlexApiError`, header construction, and retry transport policy)

### `src/core/channel-setup/`

- channel setup record persistence
- `src/core/channel-setup/ChannelSetupRecordStore.ts`
- owns the `lineup_channel_setup_v2:${serverId}` family and prefix cleanup helpers

### `src/modules/plex/discovery/`

- server selection persistence layer under discovery
- `src/modules/plex/discovery/ServerSelectionStore.ts`

### `src/modules/scheduler/channel-manager/`

- channel persistence ownership and normalization for channel manager
- `src/modules/scheduler/channel-manager/ChannelPersistenceStore.ts`
- owns server/user-scoped channel key families (including selected/current channel state) configured by `src/core/orchestrator/OrchestratorStorageContext.ts`
- `src/modules/scheduler/channel-manager/ChannelRepository.ts` is a thin consumer wrapper over `ChannelPersistenceStore`, not a separate storage owner

### Direct-storage Exception Wraps (`P3-W3`, completed 2026-03-11)

- `src/modules/debug/DebugOverridesStore.ts` owns the `lineup_debug_epg` flag; `src/modules/ui/epg/debug/debugRuntimeGuards.ts` (`appendDebugRuntimeLog`) owns safe helper fan-out to `EPGDebugRuntime.append(...)`; `src/modules/ui/epg/debug/EPGDebugRuntime.ts` owns bounded `lineup_debug_epg_log` buffering and flush scheduling
- `src/core/channel-setup/ChannelSetupRecordStore.ts` (`cleanupStaleBuildKeys`) now routes stale temp-key cleanup through `src/utils/storage.ts` prefix-based helper; `ChannelSetupCoordinator.ts` just delegates
- `src/bootstrap.ts` still contains the one-off `lineup_debug_transcode` -> `lineup_debug_logging` migration helper
- `src/modules/ui/audio-setup/AudioSetupScreen.ts` and `src/Orchestrator.ts` now consume `AudioSettingsStore` for `lineup_audio_setup_complete`; `src/Orchestrator.ts` now uses `SubtitlePreferencesStore` subtitle mode policy instead of the retired `lineup_subtitle_allow_burn_in` key
- broader repo drift cleanup is still tracked under `P3-W4`

## UI Modules

### Shared UI

- `src/modules/ui/common/`
- shared shells, overlay primitives, branding helpers, and cross-surface presentation helpers such as `appShellContainerIds.ts`, `channelDisplay.ts`, and `formatTimecode.ts`
- `src/core/app-shell/AppContainerFactory.ts` is the app-shell DOM owner that creates the bounded `runtime-chrome-host` under `#app`, canonicalizes app-shell container IDs plus app-materialized feature mount nodes at document scope, and keeps the approved runtime chrome members grouped there in fixed structural order

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
- `src/modules/ui/theme/` is the public owner of theme metadata (`ThemeName`, `DEFAULT_THEME`, `THEME_CLASSES`, `THEME_OPTIONS`)
- runtime theme state/control is app-shell-owned by `src/core/app-shell/AppThemeController.ts`
- `src/modules/ui/settings/` consumes theme metadata plus app-composed runtime callbacks and should not act as a second public owner for those definitions
- `src/modules/ui/epg/component/`, `src/modules/ui/epg/coordinator/`, `src/modules/ui/epg/startup/`, `src/modules/ui/epg/debug/`, `src/modules/ui/epg/view/`, `src/modules/ui/epg/runtime/`, and `src/modules/ui/epg/model/` are the staged EPG package owners.

## Current Hotspot Reference

The most important structural hotspots remain and should be treated as active work targets:

- `src/Orchestrator.ts`
- `src/App.ts`
- `src/modules/ui/epg/component/EPGComponent.ts`
- `src/modules/ui/settings/SettingsScreen.ts`
- `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
- `src/modules/plex/stream/PlexStreamResolver.ts`
- `src/modules/scheduler/channel-manager/ChannelManager.ts`

## Cleanup Backlog Direction

- `src/Orchestrator.ts` → `P1` in [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../ARCHITECTURE_CLEANUP_CHECKLIST.md)
- `src/App.ts` → `P2` in [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../ARCHITECTURE_CLEANUP_CHECKLIST.md)
- `src/modules/ui/epg/component/EPGComponent.ts`, `src/modules/ui/settings/SettingsScreen.ts`, `src/modules/ui/channel-setup/ChannelSetupScreen.ts` → `P4` in [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../ARCHITECTURE_CLEANUP_CHECKLIST.md)
- `src/modules/plex/stream/PlexStreamResolver.ts` → `P5` in [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../ARCHITECTURE_CLEANUP_CHECKLIST.md)
- `src/modules/scheduler/channel-manager/ChannelManager.ts` → `P6` in [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../ARCHITECTURE_CLEANUP_CHECKLIST.md)

The backlog-direction entries above are planned outcomes and are not current completed fact.
