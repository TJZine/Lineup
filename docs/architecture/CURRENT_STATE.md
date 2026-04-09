# Current Architecture State

> Established 2026-03-05. This is the canonical current-state architecture document for Lineup.

## Scope

Use this document for the repo’s present-day architecture truth.

If another architecture doc disagrees with this one, update the other doc or archive it.

## Product Invariants

- Lineup is a client-side TypeScript application for LG webOS.
- It connects directly to Plex services; there is no Lineup cloud backend.
- Scheduling, state, and most orchestration happen locally on the device.
- The app prioritizes deterministic channel behavior and a zero-transcode bias where possible.

## Composition Roots

### `src/bootstrap.ts`

- environment bootstrap
- startup wiring entry

### `src/App.ts`

- application shell composition
- startup flow and screen/runtime bootstrap
- eagerly owns splash plus top-level app-shell composition only
- should stay thin and avoid regaining feature-specific logic

### `src/core/app-shell/AppLazyScreenRegistry.ts`

- owner for deferred app-shell screen loading/instances (`auth`, `profile-select`, `server-select`, `audio-setup`, `channel-setup`, `settings`)
- owns deferred-screen inflight loading state, prefetch timers, and deferred-screen cleanup
- consumes focused screen-specific ports from `AppLazyScreenPortFactory`; it no longer owns or accepts a broad multi-feature lazy-screen runtime facade

### `src/core/app-shell/AppLazyScreenPortFactory.ts`

- focused owner for lazy-screen port assembly at the app-shell boundary
- builds screen-specific port contracts for deferred screens while delegating runtime operations to `AppOrchestrator`
- keeps `src/App.ts` at composition wiring by replacing the previous inline lazy-screen runtime object-literal assembly

### `src/core/app-shell/AppScreenVisibilityCoordinator.ts`

- owner for route-driven app-shell show/hide policy
- owns splash-backed deferred-screen reveal sequencing for startup and setup routes

### `src/core/InitializationCoordinator.ts`

- focused startup sequencing collaborator between app shell and orchestrator

### `src/core/server-selection/`

- focused server-selection collaborators shared between app shell and orchestrator
- owns the app-shell-facing selected-server workflow/result contract, including selected-server persistence handoff and post-selection runtime swap delegation

### `src/Orchestrator.ts`

- central runtime coordinator
- should remain focused on wiring, lifecycle orchestration, and top-level runtime delegation rather than absorbing more feature logic
- owns composition-root diagnostics append wiring (`AppendIssueDiagnostic`) for runtime collaborators while `IssueDiagnosticsStore` remains the storage/debug owner
- constructs `InitializationCoordinator` before coordinator assembly so `ensureEpgInitialized` callbacks always bind the real startup owner (no fake no-op readiness path)

## Module Boundaries

### Lifecycle

- `src/modules/lifecycle/`
- owns lifecycle state, visibility, persistence coordination, and recovery concerns
- `src/modules/lifecycle/StateManager.ts` owns the lifecycle storage key `lineup_app_state` only (versioned lifecycle payload: `userPreferences`, `lastUpdated`) and deletes the bounded cleanup-only keys in `STORAGE_CONFIG.CLEANUP_KEYS` as a helper; it does not own their schema or migrations

### Navigation

- `src/modules/navigation/`
- owns remote handling, focus/navigation flow, and navigation coordination
- `src/modules/navigation/NavigationManager.ts` owns navigation state, screen stack, modal stack, and focus operations
- `src/modules/navigation/NavigationManager.ts` delegates low-level key routing and timing behavior to `NavigationRemoteInputRouter`, `NavigationDirectionalRepeatController`, and `NavigationChannelNumberInputController`

### Plex

- `src/modules/plex/auth/`
- `src/modules/plex/discovery/`
- `src/modules/plex/library/`
- `src/modules/plex/stream/`
- owns Plex-facing auth, discovery, library metadata, and stream/subtitle policy
- `src/modules/plex/auth/PlexAuth.ts` owns the auth credential storage key `lineup_plex_auth`
- `src/modules/plex/auth/clientIdentifier.ts` is the explicit owner for `lineup_client_id` resolution and persistence (`resolveClientIdentifier(preferred?: string): string`)

### Scheduler And Channel Management

- `src/modules/scheduler/`
- owns scheduling behavior, shuffle logic, and channel domain flows
- channel-domain persistence ownership (including selected/current channel state) stays in `src/modules/scheduler/channel-manager/ChannelPersistenceStore.ts`; `src/modules/scheduler/channel-manager/ChannelRepository.ts` is a thin consumer wrapper over that store, with server/user-scoped keys configured through `src/core/orchestrator/OrchestratorStorageContext.ts`

### Player

- `src/modules/player/`
- owns playback runtime, subtitle attachment/conversion, keep-alive, and player recovery behavior

### Settings And Persistence Owners

- `src/modules/ui/settings/SettingsStore.ts`
- `src/modules/settings/AudioSettingsStore.ts`
- `src/modules/settings/DeveloperSettingsStore.ts`
- `src/modules/settings/PlaybackSettingsStore.ts`
- `src/modules/settings/EpgPreferencesStore.ts`
- `src/modules/settings/NowPlayingDisplayStore.ts`
- `src/modules/settings/ProfileSessionStore.ts`
- `src/modules/settings/SubtitlePreferencesStore.ts`
- `src/modules/settings/ThemePreferencesStore.ts`
- `src/modules/debug/DebugOverridesStore.ts`
- `src/modules/debug/IssueDiagnosticsStore.ts`
- `src/modules/plex/discovery/ServerSelectionStore.ts`
- `src/modules/scheduler/channel-manager/ChannelPersistenceStore.ts`
- `src/core/channel-setup/ChannelSetupRecordStore.ts`
- `src/modules/plex/auth/PlexAuth.ts`
- `src/modules/plex/auth/clientIdentifier.ts`
- these are the current designated owners for storage-backed state
- `src/modules/ui/settings/SettingsStore.ts` is a UI-facing facade; `debugLogging` and `subtitleDebugLogging` persistence now routes through `src/modules/settings/DeveloperSettingsStore.ts`
- runtime consumers route mapped key families through typed stores (for example `PlayerOsdCoordinator` -> `NowPlayingDisplayStore`, `ProfileSelectScreen` -> `ProfileSessionStore`, `ThemeManager` -> `ThemePreferencesStore`, `EPGInfoPanel` -> `NowPlayingDisplayStore`/`EpgPreferencesStore`, `SettingsStore` -> dedicated settings stores, `AudioSetupScreen`/`Orchestrator`/`AudioTrackManager` -> `AudioSettingsStore` policy reads and setup completion state, `Orchestrator` -> `SubtitlePreferencesStore` subtitle mode policy for burn-in decisions)
- `src/modules/ui/epg/EPGDebugRuntime.ts` is the bounded EPG-layer owner for `lineup_debug_epg_log` buffering + flush scheduling and debug-flag cache reads used by EPG runtime/UI consumers; it is not a general storage-owner precedent
- `src/modules/debug/DebugOverridesStore.ts` is the canonical owner for the `lineup_debug_epg` flag
- `src/core/channel-setup/ChannelSetupRecordStore.ts` owns the `lineup_channel_setup_v2:${serverId}` family and its prefix cleanup through `safeLocalStorageRemoveByPrefixes`
- `src/core/channel-setup/ChannelSetupCoordinator.ts` consumes `ChannelSetupRecordStore` through a typed record-store seam; composition-root wiring no longer forwards raw setup-record storage get/set callbacks
- `src/bootstrap.ts` still carries the one-off `lineup_debug_transcode` -> `lineup_debug_logging` migration path
- `P8-W5` removed the known direct-storage bypasses for `lineup_audio_setup_complete`, `lineup_subtitle_allow_burn_in`, and `lineup_debug_epg`

### UI

- `src/modules/ui/`
- owns TV screens, overlays, shared primitives, and user-visible composition
- `src/modules/ui/theme/` owns `ThemeManager` plus the public theme metadata contract (`ThemeName`, `DEFAULT_THEME`, `THEME_CLASSES`, `THEME_OPTIONS`); `src/modules/ui/settings/` consumes that owner but does not publicly re-export theme metadata
- `src/modules/ui/common/` owns cross-surface UI presentation helpers such as `appShellContainerIds`, `channelDisplay`, and the pure `formatTimecode` helper shared by overlay owners
- `src/modules/ui/common/appShellContainerIds.ts` is the shared owner for app-shell-owned container IDs created by `src/core/app-shell/AppContainerFactory.ts` and consumed by app-shell/runtime wiring; feature-owned container IDs such as EPG, player OSD, mini guide, channel badge, channel transition, and exit confirm remain with their feature modules
- `src/modules/ui/epg/EPGCoordinator.ts` owns EPG runtime policy entrypoints (open/close/toggle/guide-setting handling and schedule-policy orchestration), while `src/Orchestrator.ts` remains a delegation surface that wires this owner
- `src/modules/ui/epg/EPGCoordinatorPolicies.ts` keeps library-filter normalization pure, while `EPGCoordinator` and `EPGRefreshController` own explicit persisted-selection cleanup writes through `EpgPreferencesStore`
- `src/modules/ui/epg/view/EPGVirtualizer.ts` remains the current virtualized-grid owner, and the EPG package split continues to stage leaf owners under `src/modules/ui/epg/view/`, `src/modules/ui/epg/runtime/`, and `src/modules/ui/epg/model/`
- visual rules are governed by [`docs/design/ui-design-language.md`](../design/ui-design-language.md)

## Current Hotspots

The main structural hotspots still called out by the cleanup backlog are:

- `src/Orchestrator.ts`
- `src/App.ts`
- `src/modules/ui/epg/EPGComponent.ts`
- `src/modules/ui/settings/SettingsScreen.ts`
- `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
- `src/modules/plex/stream/PlexStreamResolver.ts`
- `src/modules/scheduler/channel-manager/ChannelManager.ts`

The active remediation queue for these is [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../ARCHITECTURE_CLEANUP_CHECKLIST.md).

## Working Rules

- Keep composition roots thin.
- Prefer explicit collaborators, stores, binders, and coordinators over large multipurpose classes.
- Keep persistence behind typed owners.
- Keep Plex transport/policy logic inside Plex modules.
- Keep UI classes focused on rendering, focus, and bounded UI coordination.

## Related Docs

- Entry point: [`docs/architecture/README.md`](./README.md)
- Module reference: [`docs/architecture/modules.md`](./modules.md)
- Active backlog: [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../ARCHITECTURE_CLEANUP_CHECKLIST.md)
- Workflow: [`docs/AGENTIC_DEV_WORKFLOW.md`](../AGENTIC_DEV_WORKFLOW.md)
