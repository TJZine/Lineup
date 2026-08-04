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

### `src/core/app-shell/runtime/AppThemeController.ts`

- app-shell runtime owner for active theme state
- owns startup theme initialization and runtime theme updates
- composes Settings theme callbacks into app-shell runtime screen ports
- delegates persistence reads/writes to `src/modules/settings/ThemePreferencesStore.ts`

### `src/core/app-shell/chrome/AppStartupUiInitializer.ts`

- app-shell startup UI initializer owner
- initializes now-playing-info, playback-options, and exit-confirm overlays during startup
- constructed directly by `AppOrchestrator` and consumed through the initialization startup-UI port
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

### `src/core/app-shell/`

- app-shell composition collaborators grouped by owner:
  - `diagnostics/`: diagnostics surface, dev menu, playback-info formatting, and channel-setup summary
  - `deferred-screens/`: lazy-screen registry and screen port assembly
  - `runtime/`: app-shell runtime contracts and theme state
  - `chrome/`: containers, startup UI, visibility, blocking error overlay, and toast presentation
  - `config/`: app orchestrator config factory and prefetch constants
- there is no app-shell root barrel or compatibility shim; callers import the owning leaf file directly

### `src/core/orchestrator/`

- orchestrator-facing core collaborators and shared ownership of orchestrator type definitions
- `src/core/orchestrator/AppOrchestrator.ts` remains the package-root implementation facade
- `src/core/orchestrator/contracts/OrchestratorTypes.ts` is the durable owner of `OrchestratorConfig` and `ModuleStatus`
- `src/core/orchestrator/assembly/OrchestratorModuleFactory.ts` owns runtime module constructor/config assembly for `AppOrchestrator.initialize()`
- `src/core/orchestrator/assembly/OrchestratorCoordinatorAssembly.ts` owns coordinator construction order, dependency validation, and typed assembly glue; feature-family construction/projection lives in direct sibling owners for EPG/channel setup, playback/OSD, navigation/modal, and now-playing/debug
- `AppOrchestrator` directly constructs the schedule-day rollover and subtitle-track recovery controllers at its composition seam
- `src/core/orchestrator/events/` owns orchestrator event binding and cleanup reporting
- `src/core/orchestrator/controllers/` owns runtime controller collaborators such as schedule-day rollover, subtitle-track recovery, profile-switch cleanup, and overlay runtime policy
- `src/core/orchestrator/AppOrchestrator.ts` owns the shared identity-scoped runtime reset path after successful selected-server clear, sign-out, and profile switch; it clears in-memory channel, EPG, and playback identity state without deleting persisted channel data
- `src/core/orchestrator/policy/` and `src/core/orchestrator/storage/` own schedule policy and storage context respectively
- `src/core/initialization/InitializationCoordinator.ts` owns orchestrator startup sequencing for the app-shell/orchestrator startup path
- `src/core/orchestrator/priority-one/PriorityOneAssemblyBuilder.ts` owns Priority-1 runtime assembly shaping from app-provided runtime refs and callbacks; it shapes the public assembly input directly without a separate no-value forwarding layer
- `src/core/orchestrator/priority-one/PriorityOneControllerFactory.ts` owns Priority-1 controller and `OrchestratorEventBinder` construction previously in `AppOrchestrator._initializePriorityOneControllers()`
- `src/Orchestrator.ts` remains the public re-export surface for external callers (including `src/App.ts` and tests)

### `src/core/initialization/`

- startup coordinator and policy collaborators for app-shell/orchestrator startup
- `src/core/initialization/InitializationStartupPolicy.ts` owns startup routing policy (auth/profile/server-select/post-ready), including saved-server restore failure surfacing from discovery initialize results
- `src/modules/ui/epg/startup/EPGStartupConfigRuntime.ts` owns EPG startup config shaping

### `src/core/server-selection/`

- focused server-selection collaborators shared between app shell and orchestrator
- `src/core/server-selection/ServerSelectionTypes.ts` owns the full core/orchestrator `OrchestratorServerSelectionResult`, including readiness, persistence, and startup-resume details
- `src/core/server-selection/ServerSelectionCoordinator.ts` owns the full selected-server workflow previously assembled inline in `AppOrchestrator.selectServer()`, including discovery-result translation, full result shaping, transactional persistence handoff, rollback, and selected-server startup-resume invocation
- `src/core/server-selection/SelectedServerPersistenceAdapter.ts` owns selected-server credential persistence, active-user snapshot/restore helpers, and `selectedServerByUserId` updates behind a narrow Plex-auth port; metadata-only server-map writes suppress `authChange`
- `src/core/orchestrator/runtime/OrchestratorServerSelectionRuntime.ts` composes clear-selection cleanup and the selected-server runtime handoff while persistence, discovery snapshots, and startup transaction policy stay in their focused owners
- `src/core/app-shell/runtime/AppShellRuntimeContracts.ts` owns the narrowed app-shell selected-server result exposed to app-shell/server-select callers, and `src/core/app-shell/deferred-screens/AppLazyScreenPortFactory.ts` adapts that result into the server-select screen port without exposing core resume details

### `src/config/`

- configuration constants and typed config helpers used across modules

### `src/platform/`

- webOS-specific platform adapters and platform-aware helpers

### `src/shared/`

- shared utilities and domain-neutral constants used across features
- `src/shared/toast.ts` owns the UI-neutral toast payload contract consumed by
  runtime modules; `src/core/app-shell/chrome/AppToastPresenter.ts` owns toast presentation
- `src/shared/audioCodecSupport.ts` owns shared audio codec normalization plus
  the baseline webOS codec-support helpers consumed by player runtime and Plex
  stream compatibility policy

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
- owns the lifecycle-only `lineup_app_state` storage boundary via `src/modules/lifecycle/LifecycleStateStore.ts`

### `src/modules/navigation/`

- remote handling
- focus movement
- navigation coordination
- package organization:
  - `src/modules/navigation/contracts/` owns navigation contracts and ports
  - `src/modules/navigation/manager/` owns navigation state, focus operations, and focus policy
  - `src/modules/navigation/input/` owns remote handling, key routing, directional repeat, and channel-number input buffering
  - `src/modules/navigation/coordinator/` owns navigation event coordination and runtime services
  - `src/modules/navigation/handlers/` owns coordinator handlers and effects
  - `src/modules/navigation/config/` owns constants and key-map configuration

### `src/modules/player/`

- playback runtime
- subtitle attachment/conversion
- keep-alive, retry, and recovery flows
- `src/modules/player/tracks/AudioTrackManager.ts` owns runtime audio-track
  switching and consumes player-facing codec support input instead of importing
  Plex stream policy constants directly

### `src/modules/scheduler/`

- schedule calculation and shuffle/order logic
- channel domain operations and persistence boundaries
- meaningful submodules:
  - `src/modules/scheduler/channel-manager/`
  - `src/modules/scheduler/scheduler/`
  - `src/modules/scheduler/shared/`
- `src/modules/scheduler/shared/prng.ts` owns seeded shuffle,
  `src/modules/scheduler/shared/blockPlayback.ts` owns block grouping, and
  `src/modules/scheduler/shared/playbackOrdering.ts` owns common
  sequential/shuffle/block ordering plus scheduled-index normalization.
  `src/modules/scheduler/scheduler/programIdentity.ts` owns scheduled-program
  occurrence identity helpers for scheduler-aligned runtime callers outside
  the scheduler package.
	  `ScheduleCalculator.ts` keeps scheduler-specific injected shuffler wiring,
	  and `channel-manager/resolution/ContentSelectionPolicy.ts` keeps
	  content-level random playback mode.
- `src/modules/scheduler/channel-manager/resolution/ContentResolver.ts` remains the
	  source-resolution orchestration entrypoint; package-local collaborators own
	  source-result cache/coalescing (`resolution/SourceResolutionCache.ts`), item
	  mapping/media normalization (`resolution/ContentItemMapper.ts`), and
	  selection policy (`resolution/ContentSelectionPolicy.ts`)

### `src/modules/settings/`

- settings persistence boundary and typed domain stores

### `src/modules/debug/`

- debug overrides and diagnostics behavior support

## Plex Modules

### `src/modules/plex/auth/`

- OAuth PIN flow
- Plex token handling
- Plex Home endpoint fallback and profile-switch request/status policy stay in
  auth-local helpers; credential persistence and events stay with `PlexAuth`.
- `PlexAuth.storeCredentials(..., { emitAuthChange: false })` is reserved for metadata-only credential writes such as selected-server map persistence; token/profile mutations keep the default `authChange` emission.

### `src/modules/plex/discovery/`

- server discovery
- server selection persistence
- saved-server restore returns an explicit result (`selected`, `already_selected`, skipped, or `selection_failed`) so startup can surface stale/unreachable saved-server state instead of inferring from `isConnected()` alone

### `src/modules/plex/library/`

- library and metadata retrieval
- Plex response parsing

### `src/modules/plex/stream/`

- stream URL resolution
- subtitle/transcode/HDR policy
- `src/modules/plex/stream/policy/plexSubtitleFallbackPolicy.ts` owns Plex
  subtitle fetch attempt planning, authenticated query/header variants,
  universal subtitle fallback URL shaping, and LAN HTTP retry eligibility

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
- owns global EPG display preferences plus the selected-library filter scoped by
  selected server and active Plex profile; selected-library reads/writes fail
  closed when scope is unavailable
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
- `src/modules/plex/auth/plexHomeProfileClient.ts` (Plex Home endpoint
  fallback, Home status classification, and profile-switch request/status
  coordination)
- `src/modules/plex/auth/clientIdentifier.ts`
- `src/modules/plex/auth/plexAuthTransport.ts` (shared Plex auth transport owner for `PlexApiError`, header construction, and retry transport policy)

### `src/core/channel-setup/`

- channel setup record persistence and build-scratch lifecycle owners
- `src/core/channel-setup/config/normalizeChannelSetupConfig.ts` owns public
  setup-config normalization used by planning, build execution, persistence,
  and UI session hydration; callers import this canonical owner directly
- `src/core/channel-setup/workflow/ChannelSetupScreenWorkflowPort.ts` owns the
  screen-facing workflow contract derived from the full workflow port without
  diagnostics
- `src/core/channel-setup/persistence/ChannelSetupRecordStore.ts`
- owns only the persisted setup-record family `lineup_channel_setup_v3:${serverId}:${activeUserId}` and returns typed setup-completion persistence results
- `src/core/channel-setup/build/ChannelSetupBuildScratchStore.ts`
- owns temporary Channel Setup build-key cleanup for `lineup_channels_build_tmp_v1:*`
  and `lineup_current_channel_build_tmp_v1:*`

### `src/modules/plex/discovery/`

- server selection persistence layer under discovery
- `src/modules/plex/discovery/ServerSelectionStore.ts`

### `src/modules/scheduler/channel-manager/`

- channel persistence ownership and normalization for channel manager
- `src/modules/scheduler/channel-manager/persistence/ChannelPersistenceStore.ts`
- owns server/user-scoped channel key families (including selected/current channel state) configured by `src/core/orchestrator/storage/OrchestratorStorageContext.ts`
- `src/modules/scheduler/channel-manager/persistence/ChannelRepository.ts` is a thin consumer wrapper over `ChannelPersistenceStore`, not a separate storage owner
- `src/modules/scheduler/channel-manager/ChannelManager.ts` is the public channel-domain API/state facade; package-local services own authoring/default shaping, import/export orchestration, manager-facing persistence coordination, resolved-content cache/clone policy, and retry timers without changing storage schema ownership.

### Direct-storage Exception Wraps (`P3-W3`, completed 2026-03-11)

- `src/modules/debug/DebugOverridesStore.ts` owns the `lineup_debug_epg` flag; `src/modules/ui/epg/debug/debugRuntimeGuards.ts` (`appendDebugRuntimeLog`) owns safe helper fan-out to `EPGDebugRuntime.append(...)`; `src/modules/ui/epg/debug/EPGDebugRuntime.ts` owns bounded `lineup_debug_epg_log` buffering and flush scheduling
- `src/core/channel-setup/persistence/ChannelSetupRecordStore.ts` owns persisted setup records only; `src/core/channel-setup/build/ChannelSetupBuildScratchStore.ts` owns stale build-temp-key cleanup through `src/utils/storage.ts` prefix-based helpers; `ChannelSetupCoordinator.ts` just delegates to those typed seams
- `src/bootstrap.ts` still contains the one-off `lineup_debug_transcode` -> `lineup_debug_logging` migration helper
- `src/modules/ui/audio-setup/AudioSetupScreen.ts` and `src/Orchestrator.ts` now consume `AudioSettingsStore` for `lineup_audio_setup_complete`; `src/Orchestrator.ts` now uses `SubtitlePreferencesStore` subtitle mode policy instead of the retired `lineup_subtitle_allow_burn_in` key
- broader repo drift cleanup is still tracked under `P3-W4`

## UI Modules

### Shared UI

- `src/modules/ui/common/`
- shared shells, overlay primitives, branding helpers, and cross-surface presentation helpers such as `appShellContainerIds.ts`, `channelDisplay.ts`, and `formatTimecode.ts`
- `src/core/app-shell/chrome/AppContainerFactory.ts` is the app-shell DOM owner that creates the bounded `runtime-chrome-host` under `#app`, canonicalizes app-shell container IDs plus app-materialized feature mount nodes at document scope, and keeps the approved runtime chrome members grouped there in fixed structural order

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
- `src/modules/ui/theme/`
- `src/modules/ui/theme/` is the public owner of theme metadata (`ThemeName`, `DEFAULT_THEME`, `THEME_CLASSES`, `THEME_OPTIONS`)
- runtime theme state/control is app-shell-owned by `src/core/app-shell/runtime/AppThemeController.ts`
- `src/modules/ui/settings/` consumes theme metadata plus app-composed runtime callbacks and should not act as a second public owner for those definitions
- `src/modules/ui/epg/component/`, `src/modules/ui/epg/coordinator/`, `src/modules/ui/epg/startup/`, `src/modules/ui/epg/debug/`, `src/modules/ui/epg/view/`, `src/modules/ui/epg/runtime/`, and `src/modules/ui/epg/model/` are the staged EPG package owners. Inside `view/`, approved owner folders include `cells/` for cell renderer/presentation policy, `info-panel/` for info-panel leaves, and `shell/` for `EPGShellView`; runtime/focus-imported grid/navigation leaves stay at the view root.
- `src/modules/ui/server-select/ServerSelectScreen.ts` is the server-select screen adapter; `ServerSelectRuntimeCoordinator.ts`, `ServerSelectFocusCoordinator.ts`, `ServerSelectStatusPolicy.ts`, and `ServerSelectListView.ts` own runtime workflow, focus, status/display policy, and DOM-list rendering respectively.
- `src/modules/ui/channel-setup/ChannelSetupScreen.ts` is the channel-setup screen adapter and step router; `steps/LibraryStepPresenter.ts` owns Step 1 library render adapters, SVG/DOM-id/count formatting, bulk focus-neighbor policy, selective toggle refresh, and session mutation callbacks; `ChannelSetupWorkflowPresenter.ts` owns Step 2 workflow/presenter glue, preset stepping, dropdown handoff, and build presenter wiring; `steps/StrategyStepControlDescriptors.ts` owns the shared Step 2 adjustable-control descriptor source consumed by rendering and interaction; dropdown lifecycle lives in `ChannelSetupDropdownController.ts`, build review/progress/success presentation lives in `steps/ChannelSetupBuildStepPresenter.ts`, and session/runtime, focus, strategy interaction, and DOM rendering stay in their package-local collaborators.

## Current Hotspot Reference

The primary structural hotspots still treated as current by
[`CURRENT_STATE.md`](./CURRENT_STATE.md) are:

- `src/App.ts`

`src/Orchestrator.ts`, `src/modules/ui/settings/SettingsScreen.ts`,
`src/modules/ui/epg/component/EPGComponent.ts`,
`src/modules/plex/stream/resolver/PlexStreamResolver.ts`, and
`src/modules/scheduler/channel-manager/ChannelManager.ts` remain important
backlog or ownership surfaces where listed below, but current source
size/delegation evidence no longer supports listing them as primary active
hotspots. `ChannelSetupScreen.ts` is no longer listed as a current primary
hotspot after FCP-11 because focused package-local owners now carry dropdown,
build presentation, session/runtime, focus, strategy interaction, and step
rendering behavior.

## Cleanup Backlog Direction

- `src/Orchestrator.ts` → `P1` in [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../ARCHITECTURE_CLEANUP_CHECKLIST.md)
- `src/App.ts` → `P2` in [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../ARCHITECTURE_CLEANUP_CHECKLIST.md)
- `src/modules/ui/epg/component/EPGComponent.ts`, `src/modules/ui/settings/SettingsScreen.ts`, `src/modules/ui/channel-setup/ChannelSetupScreen.ts` → `P4` in [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../ARCHITECTURE_CLEANUP_CHECKLIST.md)
- `src/modules/plex/stream/resolver/PlexStreamResolver.ts` → `P5` in [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../ARCHITECTURE_CLEANUP_CHECKLIST.md)
- `src/modules/scheduler/channel-manager/ChannelManager.ts` → `P6` in [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../ARCHITECTURE_CLEANUP_CHECKLIST.md)

The backlog-direction entries above are planned outcomes and are not current completed fact.
