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

### `src/core/app-shell/AppScreenVisibilityCoordinator.ts`

- owner for route-driven app-shell show/hide policy
- owns splash-backed deferred-screen reveal sequencing for startup and setup routes

### `src/core/InitializationCoordinator.ts`

- focused startup sequencing collaborator between app shell and orchestrator

### `src/Orchestrator.ts`

- central runtime coordinator
- should remain focused on wiring, lifecycle orchestration, and top-level runtime delegation rather than absorbing more feature logic

## Module Boundaries

### Lifecycle

- `src/modules/lifecycle/`
- owns lifecycle state, visibility, persistence coordination, and recovery concerns
- `src/modules/lifecycle/StateManager.ts` owns the lifecycle storage key `lineup_app_state` only (versioned lifecycle payload: `plexAuth` null marker, `userPreferences`, `lastUpdated`) and the bounded cleanup-only keys in `STORAGE_CONFIG.CLEANUP_KEYS`

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
- `src/modules/ui/epg/utils.ts`
- these are the current designated owners for storage-backed state
- `src/modules/ui/settings/SettingsStore.ts` is a façade that routes through the typed stores above instead of owning persistence itself
- runtime consumers route mapped key families through typed stores (for example `PlayerOsdCoordinator` -> `NowPlayingDisplayStore`, `ProfileSelectScreen` -> `ProfileSessionStore`, `ThemeManager` -> `ThemePreferencesStore`, `EPGInfoPanel` -> `NowPlayingDisplayStore`/`EpgPreferencesStore`, `SettingsStore` -> the dedicated settings stores, `AudioSetupScreen` -> `AudioSettingsStore` for audio controls)
- `src/modules/ui/epg/utils.ts` owns the bounded `lineup_debug_epg_log` cache; `EPGComponent.ts` and `EPGCoordinatorPolicies.ts` still read the `lineup_debug_epg` flag directly, which remains residual drift rather than a canonical owner
- `src/core/channel-setup/ChannelSetupRecordStore.ts` owns the `lineup_channel_setup_v2:${serverId}` family and its prefix cleanup through `safeLocalStorageRemoveByPrefixes`
- `src/bootstrap.ts` still carries the one-off `lineup_debug_transcode` -> `lineup_debug_logging` migration path
- residual direct-storage drift remains limited to the startup/setup reads in `src/Orchestrator.ts` and `src/modules/ui/audio-setup/AudioSetupScreen.ts` (`lineup_audio_setup_complete`) plus the subtitle burn-in gate in `src/Orchestrator.ts` (`lineup_subtitle_allow_burn_in`); those are tracked but not changed in `P8-W2`

### UI

- `src/modules/ui/`
- owns TV screens, overlays, shared primitives, and user-visible composition
- `src/modules/ui/common/appShellContainerIds.ts` is the shared owner for app-shell overlay container IDs consumed by app-shell wiring and feature constants
- `src/modules/ui/epg/EPGCoordinator.ts` owns EPG runtime policy entrypoints (open/close/toggle/guide-setting handling and schedule-policy orchestration), while `src/Orchestrator.ts` remains a delegation surface that wires this owner
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
