# Current Architecture State

> Established 2026-03-05. This is the canonical current-state architecture document for Lineup.

## Scope

Use this document for the repo’s present-day architecture truth.

If another architecture doc disagrees with this one, update the other doc or archive it.

## Steady-State Guardrails

- Production file-shape exceptions and baselines live in [`file-shape-guardrails.md`](./file-shape-guardrails.md).
- `npm run verify:maintainability` blocks unreviewed growth in production files over 500 lines and requires explicit decomposition or revisit triggers for production files over 800 lines.
- Current oversized production files are accepted baselines, not automatic cleanup obligations. Any baseline increase requires same-change rationale and a decomposition or revisit trigger.

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

### `src/core/app-shell/deferred-screens/AppLazyScreenRegistry.ts`

- owner for deferred app-shell screen loading/instances (`auth`, `profile-select`, `server-select`, `audio-setup`, `channel-setup`, `settings`)
- owns deferred-screen inflight loading state, prefetch timers, and deferred-screen cleanup
- consumes focused screen-specific ports from `AppLazyScreenPortFactory`; it no longer owns or accepts a broad multi-feature lazy-screen runtime facade

### `src/core/app-shell/deferred-screens/AppLazyScreenPortFactory.ts`

- focused owner for lazy-screen port assembly at the app-shell boundary
- builds screen-specific port contracts for deferred screens while delegating runtime operations through app-shell-owned runtime port contracts (`AppShellRuntimeContracts`)
- owns the app-shell/server-select projection of selected-server results; success preserves only the exact persistence and EPG-refresh outcome in the app-shell-owned contract without importing the core `OrchestratorServerSelectionResult`
- owns the channel-setup screen's selected-server projection as runtime state (`getSelectedServerId`) only; channel setup UI must not construct `ServerSelectionStore` or consume selected-server storage-key getters
- keeps `src/App.ts` at composition wiring by replacing the previous inline lazy-screen runtime object-literal assembly

### `src/core/app-shell/chrome/AppScreenVisibilityCoordinator.ts`

- owner for route-driven app-shell show/hide policy
- owns splash-backed deferred-screen reveal sequencing for startup and setup routes

### `src/core/app-shell/runtime/AppThemeController.ts`

- app-shell-owned runtime owner for active theme state
- owns theme initialization and theme class application at startup
- composes Settings runtime theme reads/writes via app-shell runtime ports
- delegates persisted theme storage to `ThemePreferencesStore`

### `src/core/app-shell/chrome/AppStartupUiInitializer.ts`

- app-shell-owned startup UI initializer
- owns startup-time initialization calls for now-playing-info, playback-options, and exit-confirm overlays
- concrete construction is owned by `src/core/app-shell/chrome/AppStartupUiPortFactory.ts`, which returns the narrow initialization startup-UI port
- keeps startup UI readiness sequencing explicit through `src/core/initialization/InitializationCoordinator.ts`'s narrow startup-UI port

### `src/core/app-shell/`

- app-shell package navigation is grouped by owner:
  - `diagnostics/`: diagnostics surface, dev menu, playback-info formatting, and channel-setup summary
  - `deferred-screens/`: lazy screen registry and screen port assembly
  - `runtime/`: app-shell runtime contracts and theme state
  - `chrome/`: containers, startup UI, visibility, blocking error overlay, and toast presentation
  - `config/`: app orchestrator config factory and app-shell prefetch constants
- there is no app-shell root barrel or compatibility shim; callers import the owning leaf file directly

### `src/core/initialization/InitializationCoordinator.ts`

- focused startup sequencing collaborator between app shell and orchestrator
- owns each startup pass's opaque Plex-auth guard through discovery, runtime/EPG work, routing, event wiring, ready/lifecycle publication, queued continuation, resume cleanup, and guarded warmup scheduling
- every separate phase entry validates stored credentials first; same-pass queued work retains its guard, while queued work after supersession re-enters validation under a fresh lineage
- `InitializationSelectedServerTransaction` owns selected-server auth/server gating, runtime and EPG preparation, raw EPG outcome mapping, initial-tune routing under an opaque lineage, and the commit boundary that withholds event wiring, routing, ready/lifecycle-ready state, and resume cleanup on stop or failure
- `InitializationStartupHandoff` stamps selected-server work and ordinary/queued startup requests with opaque initialization-owned lineage. A stale selection may await only a strictly newer startup settlement associated with its exact lineage; it does not consume that startup's result or infer ownership from server-selection serialization

### `src/core/server-selection/`

- focused server-selection collaborators shared between app shell and orchestrator
- `ServerSelectionCoordinator.selectServer()` serializes the full selected-server transaction, retains the exact discovery receipt plus opaque persistence evidence across every continuation, suspends/drains ordinary tuning before scope work, and is the sole production constructor of `{ kind: 'selected', persistedSelection, epgRefresh }`
- app-shell/server-select callers consume the narrowed app-shell result owned by `src/core/app-shell/runtime/AppShellRuntimeContracts.ts` and adapted through `src/core/app-shell/deferred-screens/AppLazyScreenPortFactory.ts`
- `SelectedServerPersistenceAdapter` owns strict opaque evidence for candidate persistence and exact selected/unselected rollback proof, rejecting port, profile, envelope, and partial-pair drift; clear-selection persistence remains a separate focused command
- rollback restores discovery first for a fresh selected or unselected receipt, then proves persistence and runs the matching runtime restoration. Retained discovery snapshots remain reusable for Retry only within their original storage/profile namespace; a real namespace change permanently invalidates them. Failure enters `SelectedServerQuarantineRecoveryState`, keeps tuning/resolution suspended, blocks further selection, and exposes awaited Retry/Exit command state; protected-modal presentation and navigation policy remain outside this owner
- `SelectedServerRuntimeController` owns only the ordered persisted-selection then discovery clear command; it does not own selected startup, EPG mapping, or rollback

### `src/Orchestrator.ts`

- thin public runtime entry barrel
- re-exports only `AppOrchestrator`, `AppOrchestratorRuntime`, `ModuleStatus`, and `PlaybackInfoSnapshot` for app/test import stability
- does not re-export lifecycle error taxonomy or internal core/channel-setup owners; import those from their owning modules

### `src/core/orchestrator/AppOrchestrator.ts`

- central runtime coordinator implementation owner
- owns composition-root diagnostics append wiring (`AppendIssueDiagnostic`) for runtime collaborators while `IssueDiagnosticsStore` remains the storage/debug owner
- constructs the initialization-package `InitializationCoordinator` before coordinator assembly so `ensureEpgInitialized` callbacks always bind the real startup owner (no fake no-op readiness path)
- delegates grouped priority-one runtime assembly shaping to `src/core/orchestrator/priority-one/PriorityOneAssemblyBuilder.ts` and delegates schedule-day rollover plus subtitle-track recovery construction to `src/core/orchestrator/runtime/OrchestratorRuntimeControllerBuilder.ts`
- delegates playback info snapshot projection to `src/core/orchestrator/runtime/OrchestratorPlaybackInfoSnapshot.ts`; `AppOrchestrator` remains the runtime state source and refresh trigger owner
- delegates coordinator assembly required-module hardening to `src/core/orchestrator/assembly/OrchestratorCoordinatorAssembly.ts` / `OrchestratorCoordinatorContracts.ts`, which own the typed assembly input seam
- delegates shutdown teardown failure collection to `src/core/orchestrator/runtime/OrchestratorShutdownTeardown.ts` while preserving `AppOrchestrator.shutdown()` ordering, field nulling, and singleton/no-reuse lifecycle ownership
- delegates channel-switch runtime commands and missing-dependency reporting to `src/core/orchestrator/runtime/OrchestratorChannelSwitchRuntime.ts`
- delegates Plex auth screen-runtime PIN operations to `src/core/orchestrator/runtime/OrchestratorPlexAuthRuntime.ts`
- delegates selected-server projection, selection/clear commands, and selected-server startup-swap handoff to `src/core/orchestrator/runtime/OrchestratorServerSelectionRuntime.ts`
- remains the only production file at `src/core/orchestrator/` package root; the package has no root barrel or compatibility shim

### `src/core/orchestrator/runtime/OrchestratorPlaybackInfoSnapshot.ts`

- focused owner for the `PlaybackInfoSnapshot` projection contract consumed through the public `src/Orchestrator.ts` barrel
- projects from narrow orchestrator playback/channel state accessors and does not own mutable playback state or Plex/player stream policy

### `src/core/orchestrator/assembly/OrchestratorCoordinatorAssembly.ts`

- owns coordinator assembly input construction, required-module validation before coordinator creation, and explicit coordinator construction order
- exposes the typed assembly input seam used by `AppOrchestrator` without no-op module fallbacks or scattered non-null assertions
- delegates feature-family coordinator construction and assembly projections to sibling owners:
  `EpgChannelSetupCoordinatorAssembly.ts`, `PlaybackOsdCoordinatorAssembly.ts`,
  `NavigationModalCoordinatorAssembly.ts`, and `NowPlayingDebugCoordinatorAssembly.ts`

### `src/core/orchestrator/runtime/OrchestratorShutdownTeardown.ts`

- focused shutdown helper for best-effort teardown failure collection
- preserves continuation after individual teardown failures and returns failures for one aggregate `orchestrator.shutdown.teardown` report from `AppOrchestrator`

### `src/core/orchestrator/runtime/OrchestratorChannelSwitchRuntime.ts`

- focused owner for AppOrchestrator-facing channel-switch runtime commands
- owns ID and number switch delegation, missing channel-tuning dependency reporting, outcome-aware number-switch adaptation, and best-effort next/previous channel commands

### `src/core/orchestrator/runtime/OrchestratorPlexAuthRuntime.ts`

- focused owner for AppOrchestrator-facing Plex auth screen-runtime PIN operations
- preserves initialized/shutdown checks for `requestAuthPin`, `pollForPin`, and `cancelPin` while Plex auth remains the credential/token owner

### `src/core/orchestrator/runtime/OrchestratorServerSelectionRuntime.ts`

- focused owner for AppOrchestrator-facing selected-server runtime operations
- owns selected-server ID projection, select/clear commands, selected-server coordinator/runtime-controller handoff, and post-selection startup-swap orchestration

### DCR-12-S1 AppOrchestrator Source Audit

Current source audit on 2026-05-17 records `src/core/orchestrator/AppOrchestrator.ts`
at 1884 lines, matching the production file-shape guardrail baseline after
extracting the frozen `DCR-12-A1` closure set. The remaining
large-file shape is the public runtime facade, module field ownership, lifecycle
composition, coordinator/controller assembly, and cross-module wiring. The file no
longer owns the three DCR-12-S1 hotspot responsibility groups: channel-switch
runtime policy lives in `OrchestratorChannelSwitchRuntime.ts`, Plex auth PIN
screen-runtime operations live in `OrchestratorPlexAuthRuntime.ts`, and
selected-server projection/selection/clear plus post-selection startup-swap
orchestration live in `OrchestratorServerSelectionRuntime.ts`.

`S0-L01-F1` no longer describes the current `AppOrchestrator` source for the
DCR-12-S1 closure scope. Future cleanup may still split additional facade or
composition responsibilities, but that is not the active DCR-12-A1 issue shape
after this extraction.

### `src/core/orchestrator/priority-one/`

- focused owner for the grouped priority-one runtime assembly contract plus controller/binder composition
- `PriorityOneAssemblyBuilder.ts` owns the grouped priority-one runtime assembly contract from app-provided runtime refs and callbacks; it shapes the public `PriorityOneAssemblyInput` directly and must not add no-value field-for-field forwarding layers around that contract
- `PriorityOneControllerFactory.ts` now owns playback start/runtime, overlay runtime policy, profile-switch cleanup, and event-binder assembly for the priority-one path

### `src/core/orchestrator/runtime/OrchestratorRuntimeControllerBuilder.ts`

- focused owner for schedule-day rollover and subtitle-track recovery controller construction used by `AppOrchestrator`

### `src/core/orchestrator/policy/OrchestratorSchedulePolicy.ts`

- focused owner for local-day-key/midnight math and deterministic daily schedule seed policy used by channel-tuning and schedule-day rollover flows

## Module Boundaries

### Lifecycle

- `src/modules/lifecycle/`
- owns lifecycle state, visibility, persistence coordination, and recovery concerns
- `src/modules/lifecycle/LifecycleStateStore.ts` owns the lifecycle storage key `lineup_app_state` only (versioned lifecycle payload: `userPreferences`, `lastUpdated`) and deletes the bounded cleanup-only keys in `STORAGE_CONFIG.CLEANUP_KEYS` as a helper; it does not own their schema or migrations. The empty `MIGRATIONS` registry is package-internal lifecycle persistence policy, exported from `constants.ts` only for `LifecycleStateStore` consumption, intentionally absent from the lifecycle barrel, and older persisted versions without an approved migration are rejected.

### Navigation

- `src/modules/navigation/`
- owns remote handling, focus/navigation flow, and navigation coordination
- navigation package files are grouped by owner:
  - `contracts/`: public navigation contracts, screen ports, feature ports, handler contracts, and coordinator contracts
  - `manager/`: navigation state, screen/modal stack, focus manager, and focus policy
  - `input/`: remote handling, key routing, directional repeat, and channel-number input buffering
  - `coordinator/`: navigation event coordination, runtime services, event ports, and non-blocking failure timestamp policy
  - `handlers/`: coordinator handlers for key mode, repeat, channel-number entry, modal effects, and screen effects
  - `config/`: constants and key-map configuration
- `src/modules/navigation/manager/NavigationManager.ts` owns navigation state, screen stack, modal stack, and focus operations
- `src/modules/navigation/manager/NavigationManager.ts` delegates low-level key routing and timing behavior to `NavigationRemoteInputRouter`, `NavigationDirectionalRepeatController`, and `NavigationChannelNumberInputController`
- `src/modules/navigation/contracts/NavigationFeaturePorts.ts` consumes the shared `ChannelSwitchOutcome` owner from `src/types/channelSwitch.ts`; navigation must not duplicate the outcome literal union.

### Plex

- `src/modules/plex/auth/`
- `src/modules/plex/discovery/`
- `src/modules/plex/library/`
- `src/modules/plex/stream/`
- owns Plex-facing auth, discovery, library metadata, and stream/subtitle policy
- `src/modules/plex/discovery/PlexDiscoverySelectionContext.ts` owns discovery-local monotonic context validity, per-invocation latest-selection authority, snapshot lineage, and opaque selected/restored-scope receipts with discovery-owned invalidation signals. `PlexDiscoverySelectionState.ts` owns receipt-aware selected-state commit, snapshot restore, current-receipt capture, clear ordering, and synchronous listener gates; `PlexServerDiscovery` delegates those transitions while capturing or advancing discovery authority for selection, initialization, and storage/profile transitions. Supersession is a typed discovery rejection exposed only through its public error and narrow predicate, while callers retain no counter, receipt construction, or mutation authority.
- selected-server mutation order remains state, selected-id storage, `serverChange`, `connectionChange`, health storage, then success. Each suffix is context-guarded, including synchronous listener re-entry; caller abort is observed before selection-context validity, and standalone connection-probe contracts are unchanged.
- `src/modules/plex/library/PlexLibraryRequestScope.ts` owns the library-local
  immutable server URI/auth-header/opaque-key/version snapshot, exact private
  token-identity comparison, and currentness checks
  used by `PlexLibrary` and its request client. Scope supersession remains a
  typed library rejection; callers may classify it through the narrow exported
  predicate but do not own identity validity or construct scope failures.
- `src/modules/plex/stream/resolver/PlexStreamResolver.ts` remains the public
  `IPlexStreamResolver` implementation and delegates focused stream
  responsibilities instead of constructing settings/debug storage owners
  directly. It receives typed policy readers and a subtitle-debug logging port
  from composition wiring.
- `src/modules/plex/stream/capabilities/PlaybackCapabilityProfile.ts` owns the
  durable playback capability snapshot consumed by local direct-play decisions,
  Plex `X-Plex-Client-Capabilities` serialization, and public
  `IPlexStreamResolver.canDirectPlay()` checks; request-level overrides such as
  hiding Dolby Vision remain outside the base profile.
- `src/modules/plex/stream/policy/plexSubtitleFallbackPolicy.ts` owns Plex
  subtitle fetch attempt planning, including authenticated query/header
  variants, universal subtitle fallback URLs, and LAN HTTP retry eligibility
  for token-bearing versus non-token subtitle requests.
- `src/modules/plex/stream/diagnostics/SubtitleStreamDebugProbeCoordinator.ts` owns debug
  subtitle discovery summaries, text-candidate selection, key-backed/keyless
  probe selection, and fire-and-forget subtitle probe scheduling.
- `src/modules/plex/stream/diagnostics/UniversalTranscodeDecisionClient.ts` owns universal
  transcode decision request conversion, decision URL derivation, fetch timeout,
  non-ok handling, and XML/regex decision parsing while
  `PlexStreamResolver.fetchUniversalTranscodeDecision()` remains the public
  delegating contract.
- `src/modules/plex/auth/PlexAuth.ts` owns the auth credential storage key
  `lineup_plex_auth`, private monotonic credential-operation authority, atomic
  stored-credential validation/reconstruction, token validation, PIN flow, and
  auth / profile event emission
- `src/modules/plex/auth/plexStoredCredentialsValidation.ts` owns pure active-token
  and account-fallback credential reconstruction while `PlexAuth` retains storage,
  operation-context, commit, and event authority
- `src/modules/plex/auth/plexHomeProfileClient.ts` owns Plex Home endpoint
  fallback, Home status classification, and profile-switch request/status
  coordination while returning typed auth outcomes to `PlexAuth`
- `src/modules/plex/auth/config.ts` owns canonical Plex identity metadata
  (`product`, `version`, `platform`, `device`, `deviceName`) and identity-header
  assembly for auth/platform/stream consumers.
- `src/modules/plex/auth/clientIdentifier.ts` owns `lineup_client_id` resolution/persistence (`resolveClientIdentifier(preferred?: string): string`) and the value is resolved once at config assembly (`createDefaultPlexAuthConfig`) before `PlexAuth` construction
- `src/modules/plex/auth/plexAuthTransport.ts` owns shared Plex auth transport concerns (`PlexApiError`, request headers, retry transport policy) consumed by auth and discovery

### Scheduler And Channel Management

- `src/modules/scheduler/`
- owns scheduling behavior, shuffle logic, and channel domain flows
- scheduler shuffle/order logic uses shared scheduler helpers:
  `src/modules/scheduler/shared/prng.ts` owns seeded shuffle,
  `src/modules/scheduler/shared/blockPlayback.ts` owns block grouping, and
  `src/modules/scheduler/shared/playbackOrdering.ts` owns common
  sequential/shuffle/block ordering plus scheduled-index normalization.
  `src/modules/scheduler/scheduler/programIdentity.ts` owns scheduled-program
  occurrence identity construction/comparison for cross-module runtime callers
  such as playback recovery and orchestrator start/retry guards.
  `src/modules/scheduler/scheduler/ShuffleGenerator.ts` still adapts seeded
  shuffle for scheduler injection, `ScheduleCalculator.ts` keeps the
	  scheduler-specific injected shuffler seam, and
	  `channel-manager/resolution/ContentSelectionPolicy.ts` keeps content-level
	  random playback mode.
- channel-domain persistence ownership (including selected/current channel
	  state) stays in `src/modules/scheduler/channel-manager/persistence/ChannelPersistenceStore.ts`;
	  `src/modules/scheduler/channel-manager/persistence/ChannelRepository.ts` is a thin
	  consumer wrapper over that store, with server/user-scoped keys configured
	  through `src/core/orchestrator/storage/OrchestratorStorageContext.ts`
- `src/modules/scheduler/channel-manager/ChannelManager.ts` remains the public
	  channel-domain API/state owner, while package-local collaborators own focused
	  responsibilities: `authoring/ChannelAuthoringService.ts` owns authoring/default shaping,
	  `import-export/ChannelImportExportService.ts` owns import/export orchestration,
	  `persistence/ChannelPersistenceCoordinator.ts` owns manager-facing persistence
	  coordination, `resolution/ChannelResolutionCache.ts` owns resolved-content clone/stale
	  policy, `resolution/ChannelRetryScheduler.ts` owns retry timers,
	  `resolution/ChannelResolutionOperationContext.ts` owns cancel-first resolution-scope
	  supersession and drain, and
	  `persistence/ChannelPersistenceSaveQueue.ts` owns debounced save promise/timer/warning
	  orchestration through callbacks while delegating warning backoff timing to
	  `src/utils/persistenceWarningBackoffPolicy.ts`. `import-export/ChannelImportNormalizer.ts`
	  owns import payload validation and create-input shaping without mutating
	  manager state or changing persistence schema
- `src/modules/scheduler/channel-manager/resolution/ContentResolver.ts` remains the
	  package-local source-resolution orchestration entrypoint consumed by
	  `ChannelManager`, while `resolution/SourceResolutionCache.ts` owns source-result
	  cache/in-flight coalescing under opaque entry/waiter authorities from
	  `resolution/SourceResolutionEntryAuthority.ts`, `resolution/ContentItemMapper.ts` owns Plex item mapping and
	  media metadata normalization, and `resolution/ContentSelectionPolicy.ts` owns filtering,
	  sorting, content-level random playback mode, and delegation to the shared
	  scheduler playback-ordering owner for common sequential/shuffle/block
	  ordering
- `src/core/channel-tuning/ChannelTuningCoordinator.ts` remains the channel-switch
  workflow owner. `ChannelTuningOperationContext.ts` owns general admission and
  retained suspension currentness, `ChannelInitialTuneAuthority.ts` owns opaque
  single-use initialization lineage/permits, and ChannelManager mints the matching
  channel-bound one-use resolution authorization while its general resolution
  scope remains suspended.

### Player

- `src/modules/player/`
- owns playback runtime, subtitle attachment/conversion, keep-alive, and player recovery behavior
- `src/modules/player/tracks/AudioTrackManager.ts` consumes player-facing codec
  support input instead of importing Plex stream-policy constants directly; the
  shared baseline codec owner lives in `src/shared/audioCodecSupport.ts` and is
  reused by both player and Plex compatibility policy.

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
- `src/modules/scheduler/channel-manager/persistence/ChannelPersistenceStore.ts`
- `src/core/channel-setup/persistence/ChannelSetupRecordStore.ts`
- `src/modules/plex/auth/PlexAuth.ts`
- `src/modules/plex/auth/clientIdentifier.ts`
- `src/utils/persistenceWarningBackoffPolicy.ts` owns shared persistence-warning
  timing/backoff/reset mechanics for lifecycle and scheduler callers; the
  callers keep their warning payload schemas.
- these are the current designated owners for storage-backed state
- `src/modules/ui/settings/SettingsStore.ts` is a UI-facing facade; `debugLogging` and `subtitleDebugLogging` persistence now routes through `src/modules/settings/DeveloperSettingsStore.ts`
- runtime consumers route mapped key families through typed stores (for example `PlayerOsdCoordinator` -> `NowPlayingDisplayStore`, `ProfileSelectScreen` -> `ProfileSessionStore`, `AppThemeController` -> `ThemePreferencesStore`, `EPGInfoPanel` -> `NowPlayingDisplayStore`/`EpgPreferencesStore`, `SettingsStore` -> dedicated settings stores, `AudioSetupScreen`/`Orchestrator`/`AudioTrackManager` -> `AudioSettingsStore` policy reads and setup completion state, `Orchestrator` -> `SubtitlePreferencesStore` subtitle mode policy for burn-in decisions)
- `src/modules/ui/epg/debug/EPGDebugRuntime.ts` is the bounded EPG-layer owner for `lineup_debug_epg_log` buffering + flush scheduling and debug-flag cache reads used by EPG runtime/UI consumers; it is not a general storage-owner precedent
- `src/modules/debug/DebugOverridesStore.ts` is the canonical owner for the `lineup_debug_epg` flag
- `src/modules/settings/EpgPreferencesStore.ts` owns global EPG display preferences plus the server/user-scoped selected-library filter key family configured by `OrchestratorStorageContext`; selected-library filter reads/writes fail closed when that scope is unavailable
- `src/core/channel-setup/persistence/ChannelSetupRecordStore.ts` owns only the persisted setup-record family `lineup_channel_setup_v3:${serverId}:${activeUserId}` and returns typed completion persistence results instead of treating durable writes as void side effects
- `src/modules/plex/auth/PlexAuth.ts` owns credential persistence events; selected-server metadata persistence uses `storeCredentials(..., { emitAuthChange: false })` so server-map writes do not impersonate token/profile auth mutations
- `src/core/orchestrator/AppOrchestrator.ts` owns the shared identity-scoped runtime reset path after successful selected-server clear, sign-out, and profile switch; the path clears in-memory ChannelManager state, EPG schedule caches/rows, and playback identity state where applicable without deleting persisted channel data
- `src/core/channel-setup/build/ChannelSetupBuildScratchStore.ts` owns temporary Channel Setup build-key lifecycle (`lineup_channels_build_tmp_v1:*`, `lineup_current_channel_build_tmp_v1:*`)
- `src/core/channel-setup/config/normalizeChannelSetupConfig.ts` owns public setup-config normalization for planning, build execution, persistence, and UI session hydration; callers import the canonical config owner directly.
- `src/core/channel-setup/workflow/ChannelSetupScreenWorkflowPort.ts` owns the screen-facing workflow contract derived from the full workflow port without planner diagnostics
- `src/core/channel-setup/planning/ChannelSetupPlanningService.ts` owns plan/review composition and uses `ChannelSetupFacetSnapshotLoader` as its internal facet-snapshot collaborator; collection/playlist facet failures remain partial-warning enrichment failures, while enabled native tag directory/count failures remain blocking or slow planning-boundary failures
- `src/core/channel-setup/ChannelSetupCoordinator.ts` consumes typed seams for record persistence (`ChannelSetupRecordStore`) and build-scratch cleanup (`ChannelSetupBuildScratchStore`); composition-root wiring no longer forwards raw setup-record storage callbacks
- `src/core/index.ts` and `src/core/channel-setup/index.ts` are intentionally empty; runtime callers import from owning modules instead of widening root/package barrels
- `src/bootstrap.ts` still carries the one-off `lineup_debug_transcode` -> `lineup_debug_logging` migration path
- `P8-W5` removed the known direct-storage bypasses for `lineup_audio_setup_complete`, `lineup_subtitle_allow_burn_in`, and `lineup_debug_epg`

### UI

- `src/modules/ui/`
- owns TV screens, overlays, shared primitives, and user-visible composition
- `src/shared/toast.ts` owns the UI-neutral toast payload contract, and `src/core/app-shell/chrome/AppToastPresenter.ts` owns toast presentation; `src/modules/ui/` does not own a separate toast package.
- `src/modules/ui/theme/` owns the public theme metadata contract (`ThemeName`, `DEFAULT_THEME`, `THEME_CLASSES`, `THEME_OPTIONS`); runtime theme state/control lives in app-shell ownership (`AppThemeController`), and `src/modules/ui/settings/` consumes theme callbacks through app-composed ports
- `src/modules/ui/common/` owns cross-surface UI presentation helpers such as `appShellContainerIds`, `channelDisplay`, and the pure `formatTimecode` helper shared by overlay owners
- `src/modules/ui/common/appShellContainerIds.ts` is the shared owner for app-shell-owned container IDs created by `src/core/app-shell/chrome/AppContainerFactory.ts` and consumed by app-shell/runtime wiring, including the bounded `runtime-chrome-host`; feature-owned mount container IDs such as EPG, player OSD, mini guide, channel badge, channel transition, and exit confirm remain with their feature modules even though `AppContainerFactory` may canonicalize their materialized DOM nodes at document scope
- `src/modules/ui/epg/coordinator/EPGCoordinator.ts` owns EPG runtime policy entrypoints (open/close/toggle/guide-setting handling and schedule-policy orchestration), while `src/Orchestrator.ts` remains a delegation surface that wires this owner
- `src/modules/ui/epg/constants.ts` owns canonical EPG default config values, including row height; cross-module callers consume fresh default config objects through the EPG package seam, and app-shell config assembly does not own an independent EPG row-height override
- `src/modules/ui/epg/startup/buildEPGStartupConfig.ts` owns EPG startup-config shaping consumed by `src/core/initialization/InitializationCoordinator.ts`
- `src/modules/ui/epg/index.ts` is a bounded cross-module seam and no longer re-exports EPG view/util leaf symbols
- `src/modules/ui/epg/coordinator/EPGCoordinatorPolicies.ts` keeps library-filter normalization pure, while `EPGCoordinator` and `EPGRefreshController` own explicit persisted-selection cleanup writes through the scoped selected-library filter API on `EpgPreferencesStore`
- `EPGRetainedOperationContext` carries opaque selected-server transaction authority through EPG channel priming and schedule refresh. `EPGChannelPrimePublisher` owns the ordered, currentness-gated prime publication; visible-range requests coalesce only within one authority; and detached background refresh retains that authority through queue settlement so superseded work cannot publish UI, diagnostics, cache, loaded-marker, focus, or result suffixes
- `src/modules/ui/epg/` keeps one package root seam at `src/modules/ui/epg/index.ts`; view and runtime subfolder barrels were removed, so package-local consumers import view/runtime leaf owners directly. `src/modules/ui/epg/view/EPGVirtualizer.ts` remains the current virtualized-grid owner, runtime/focus-imported grid/navigation leaves stay at the view root, and approved owner folders live under `src/modules/ui/epg/view/cells/`, `src/modules/ui/epg/view/info-panel/`, and `src/modules/ui/epg/view/shell/`. `src/modules/ui/epg/view/EPGEpisodeTitlePresentation.ts` owns shared episode show/title display policy for EPG view callers. `src/modules/ui/epg/view/cells/EPGCellRenderer.ts` owns cell DOM rendering and secondary-text clear/apply state, `src/modules/ui/epg/view/cells/EPGCellPresentation.ts` stays pure cell presentation policy, and the EPG package split continues to stage leaf owners under `src/modules/ui/epg/component/`, `src/modules/ui/epg/coordinator/`, `src/modules/ui/epg/startup/`, `src/modules/ui/epg/debug/`, `src/modules/ui/epg/view/`, `src/modules/ui/epg/runtime/`, and `src/modules/ui/epg/model/`
- overlay package roots (`now-playing-info`, `player-osd`, `mini-guide`, `channel-transition`, `playback-options`, `exit-confirm`) are the intended cross-module seams for coordinator/value imports used by core/app-shell wiring
- `src/core/app-shell/chrome/AppContainerFactory.ts` materializes a bounded `runtime-chrome-host` under `#app`, canonicalizes app-shell-owned containers plus app-materialized feature mount nodes at document scope, and reparents exactly `player-osd`, `channel-number-overlay`, `channel-badge`, `mini-guide`, and `channel-transition` into that host; the host owns shell-plane structure only, while feature packages keep their DOM markup, visibility, and local z-index ownership
- `src/modules/ui/channel-setup/ChannelSetupSessionController.ts` is now a UI-facing composition wrapper over `ChannelSetupSessionState` (session state/config serialization/record hydration) and `ChannelSetupSessionRuntime` (workflow I/O, abort/timer lifecycle)
- `src/modules/ui/channel-setup/ChannelSetupSessionRuntime.ts` owns string-only UI runtime error summaries for load, preview/review, build, blocked, and bookkeeping outcomes; typed planning/build failure details stay in core contracts/logs rather than `ChannelSetupScreen`
- `src/modules/ui/channel-setup/ChannelSetupScreen.ts` is the screen shell and step-router owner; package-local collaborators own focused wizard behavior: `strategyConstants.ts` owns shared strategy and Step 2 control constants, `stepContracts.ts` owns render/dropdown contracts shared by the parent and step presenters, `steps/LibraryStepPresenter.ts` owns Step 1 library render adapters, SVG/DOM-id/count formatting, bulk focus-neighbor policy, selective toggle refresh, and session mutation callbacks; `ChannelSetupWorkflowPresenter.ts` owns Step 2 workflow/presenter glue, preset stepping, dropdown handoff, and build presenter wiring; `steps/StrategyStepControlDescriptors.ts` owns the Step 2 adjustable-control descriptor source consumed by rendering and interaction; `ChannelSetupDropdownController.ts` owns dropdown lifecycle, `ChannelSetupBuildStepPresenter.ts` owns build review/progress/success presentation, session/runtime ownership stays in `ChannelSetupSessionController` / `ChannelSetupSessionRuntime`, focus ownership stays in `focus/ChannelSetupFocusCoordinator.ts`, and DOM rendering remains in the step controllers.
- `src/modules/ui/server-select/ServerSelectScreen.ts` is the public screen/DOM adapter for server select. Runtime workflow, discovery/select/clear/reconnect, visibility generation, and idle ownership live in `ServerSelectRuntimeCoordinator.ts`; focus registration/restore lives in `ServerSelectFocusCoordinator.ts`; status and server-display policy live in `ServerSelectStatusPolicy.ts`; `ServerSelectListView.ts` remains DOM-list rendering only.
- `src/modules/ui/server-select/types.ts` owns shared server-select display state shapes consumed by both the screen and list view; list rendering must not import screen-owned state types.
- `src/modules/debug/NowPlayingDebugManager.ts` owns the minimal debug overlay presence port it needs; orchestrator builders adapt the full now-playing-info overlay at the boundary.
- visual rules are governed by [`docs/design/ui-design-language.md`](../design/ui-design-language.md)

### Shared Runtime Contracts

- `src/utils/EventEmitter.ts` and `src/utils/interfaces.ts` accept closed event-map object types and must not force event-map owners to add arbitrary string index signatures.

## Current Hotspots

The main structural hotspots still treated as current by this architecture source are:

- `src/App.ts`

`src/modules/ui/settings/SettingsScreen.ts`,
`src/modules/ui/epg/component/EPGComponent.ts`,
`src/modules/plex/stream/resolver/PlexStreamResolver.ts`, and
`src/modules/scheduler/channel-manager/ChannelManager.ts` remain important
ownership surfaces, but they are no longer treated as current primary file-size
hotspots after their latest split/delegation passes. `EPGComponent.ts` now
acts as the `IEPGComponent` facade/wiring owner while shell rendering,
focus/navigation, and grid runtime lifecycle live in package-local EPG owners.
`ChannelSetupScreen.ts` is no longer treated as a current primary hotspot after
the FCP-11 owner split; it remains a screen adapter/step router with dropdown,
build presentation, session/runtime, focus, and strategy/step behavior owned by
package-local collaborators.

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
