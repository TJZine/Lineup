# FCP-6 Test Confidence Audit

Date: 2026-04-29

Checklist token: `FCP-6`

Task family: cleanup/refactor

Cleanup subtype: checklist-linked

This audit is source-backed only. It does not use Desloppify output, imported issue ids, score deltas, package maps, generated task queues, or detector issue ids for intake, proof, prioritization, or closure.

## Discovery And Tool Fallback

Codanna is preferred by `docs/AGENTIC_DEV_WORKFLOW.md` and `docs/agentic/codanna-playbook.md`, but the controller reported that Codanna tools (`semantic_search_with_context`, `search_documents`, `analyze_impact`) are not exposed in this session. Deterministic fallback used `rg`, `find`, and direct source/test reads.

Fallback query and read coverage:

- `find src -path '*__tests__*' -type f | sort`
- `rg -n "startup|initialize|initializ|resume|selected server|selectServer|server select|ServerSelection|profile|auth|ready|route" src/__tests__ src/core src/modules -g '*test.ts' -g '*.ts'`
- `rg -n "Back|Exit|root|window\.close|navigateBack|back|remote|Escape|GoBack|exit confirm|exit-confirm" src/__tests__ src/modules/navigation src/modules/ui/exit-confirm src/App.ts src/core -g '*test.ts' -g '*.ts'`
- `rg -n "token|X-Plex-Token|redact|Authorization|credential|client id|clientIdentifier|authToken|selectedServerByUserId|ServerSelectionStore|lineup_plex_auth|lineup_client_id" src/__tests__ src/modules/plex src/core/server-selection src/utils -g '*test.ts' -g '*.ts'`
- `rg -n "offline|online|connectivity|recovery|visibilitychange|pagehide|webOSRelaunch|reload|error recovery|recover|Lifecycle|StateManager" src/__tests__ src/modules/lifecycle src/core/error-recovery src/core/orchestrator -g '*test.ts' -g '*.ts'`
- `rg -n "describe\(|it\("` over player, Plex, scheduler, settings, channel setup, and initialization test files named below
- Direct reads: `docs/plans/2026-04-29-fcp-5-portability-readiness-audit.md`, `docs/plans/2026-04-29-fcp-5-portability-readiness.md`, `docs/api/plex-integration.md`, `src/__tests__/bootstrap.test.ts`, `src/__tests__/startup-integration.test.ts`, `src/__tests__/Orchestrator.test.ts`, `src/core/initialization/__tests__/InitializationCoordinator.test.ts`, `src/core/initialization/InitializationStartupPolicy.ts`, `src/core/server-selection/__tests__/ServerSelectionCoordinator.test.ts`, `src/core/server-selection/__tests__/SelectedServerPersistenceAdapter.test.ts`, `src/modules/navigation/__tests__/NavigationCoordinator.test.ts`, `src/modules/navigation/__tests__/NavigationManager.test.ts`, `src/modules/navigation/__tests__/NavigationRemoteInputRouter.test.ts`, `src/modules/navigation/NavigationManager.ts`, `src/modules/ui/exit-confirm/ExitConfirmCoordinator.ts`, `src/modules/ui/exit-confirm/ExitConfirmModal.ts`, and the focused test inventories named in the candidate table.

## Coverage Summary

| Area | Current proof | Audit result |
| --- | --- | --- |
| Startup and initialization | `src/__tests__/bootstrap.test.ts`, `src/__tests__/startup-integration.test.ts`, `src/__tests__/Orchestrator.test.ts`, `src/core/initialization/__tests__/InitializationCoordinator.test.ts`, `src/core/initialization/__tests__/InitializationStartupPolicy.test.ts` | Existing coverage protects DOM bootstrap, fatal overlay/redaction, unauthenticated auth gate, module phase ordering, auth validation branches, server-select routing, queued startup reruns, post-ready audio/channel setup routing, and startup resume error reporting. |
| Navigation/root Back/Exit | `src/modules/navigation/__tests__/NavigationCoordinator.test.ts`, `src/modules/navigation/__tests__/NavigationManager.test.ts`, `src/modules/navigation/__tests__/NavigationRemoteInputRouter.test.ts`, `src/modules/navigation/NavigationManager.ts`, `src/modules/ui/exit-confirm/*` | Existing tests prove remote routing and Back opens exit-confirm from player, but there is no direct contract test for the exit-confirm owner rendering/registering focusables, Cancel close, Exit `window.close()`, and cleanup. Narrow test needed now. |
| Plex auth/discovery/library/stream connectivity | `src/modules/plex/auth/__tests__/PlexAuth.test.ts`, `src/modules/plex/discovery/__tests__/PlexServerDiscovery.test.ts`, `src/modules/plex/discovery/__tests__/PlexDiscoveryFetchVariants.test.ts`, `src/modules/plex/library/__tests__/PlexLibrary.test.ts`, `src/modules/plex/stream/__tests__/PlexStreamResolver.test.ts` | Existing coverage is broad and contract-oriented: auth token validation, Plex Home switching, discovery connection fallback/auth-state handling, library parse/error taxonomy, stream direct-play/transcode decisions, and connection URI sanitization. No new automated test should be added in FCP-6 unless a source change touches these contracts. |
| Token/security behavior | `docs/api/plex-integration.md`, `src/modules/plex/shared/__tests__/plexLogging.test.ts`, `src/modules/plex/shared/__tests__/plexUrl.test.ts`, `src/__tests__/bootstrap.test.ts`, Plex library/stream redaction tests | Existing coverage protects redaction utilities, Plex logging redaction, trusted token query injection, bootstrap fatal overlay redaction, and stream/library token-bearing URL logging. No new automated test needed now. |
| Selected-server persistence/resume | `src/core/server-selection/__tests__/SelectedServerPersistenceAdapter.test.ts`, `src/core/server-selection/__tests__/ServerSelectionCoordinator.test.ts`, `src/__tests__/Orchestrator.test.ts`, `src/__tests__/orchestrator/storage-keys.test.ts` | Existing coverage protects active-user selected-server persistence, missing/corrupted credential semantics, discovery/persisted rollback on persistence or resume failure, app-facing selection result shaping, and server/user-scoped storage keys. |
| Scheduler/channel persistence | `src/modules/scheduler/channel-manager/__tests__/ChannelPersistenceStore.test.ts`, `src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts`, `src/modules/scheduler/channel-manager/__tests__/StoredChannelDataCodec.test.ts`, `src/__tests__/orchestrator/storage-keys.test.ts` | Existing coverage protects storage-key scoping, malformed payload cleanup, quota/blocked-storage warnings, current-channel persistence, debounced save/flush behavior, and channel import/load normalization. |
| Player recovery/media/subtitle behavior | `src/modules/player/__tests__/PlaybackRecoveryManager.test.ts`, `src/modules/player/__tests__/SubtitleManager.test.ts`, `src/modules/player/__tests__/VideoPlayer.test.ts`, `src/modules/player/__tests__/subtitleFallbackPipeline.test.ts`, `src/modules/plex/stream/__tests__/*`, `src/__tests__/orchestrator/subtitle-track-recovery-warning-contract.test.ts` | Existing coverage is sufficient for current webOS/browser renderer contracts: native video load/control, stale load handling, retry/backoff, Media Session feature absence/presence, subtitle fallback/XHR/universal endpoint, burn-in/disable recovery, and redacted debug output. |
| Settings persistence | `src/modules/settings/__tests__/*.test.ts`, `src/core/app-shell/__tests__/AppThemeController.test.ts` | Existing store tests cover read/write/default/invalid-value normalization and blocked-storage behavior for audio, developer, playback, EPG, now-playing, profile session, subtitles, and theme preferences. |
| Channel setup flows | `src/core/channel-setup/__tests__/*.test.ts`, `src/modules/ui/channel-setup/__tests__/*.test.ts` | Existing coverage protects setup record persistence, setup/rerun decision gates, scratch cleanup, planning/build execution, UI session state/runtime/controller abort/stale-result handling, and screen DOM/focus contracts. |
| Lifecycle/offline/recovery paths | `src/modules/lifecycle/__tests__/AppLifecycle.test.ts`, `src/modules/lifecycle/__tests__/LifecycleConnectivityMonitor.test.ts`, `src/modules/lifecycle/__tests__/StateManager.test.ts`, `src/__tests__/orchestrator/lifecycle-resume-race.test.ts`, `src/core/error-recovery/__tests__/*.test.ts` | Existing coverage protects visibility/webOS relaunch lifecycle, online/offline listeners, lifecycle persistence, resume race handling, recovery actions, and lifecycle error adaptation. |
| FCP-5 portability assumptions | FCP-5 audit/plan plus `src/__tests__/orchestrator/platform-wiring.test.ts`, storage-owner tests, Plex/media tests above | FCP-5 assumptions are represented by existing platform wiring, storage failure, token/security, media, Plex, and filesystem-absence source proof. No FCP-6 source/test work should reopen the Windows/Electron port itself. |

## Source-Backed Candidates

| source_finding_id | Classification | Owner | Source/test proof | Disposition |
| --- | --- | --- | --- | --- |
| `FCP-6-SF1` | existing coverage sufficient | app-shell/initialization owner | Bootstrap, startup integration, `Orchestrator`, and `InitializationCoordinator` tests cover DOM readiness, fatal bootstrap failure, unauthenticated auth gate, phase ordering, auth branches, server connection branches, queued reruns, and post-ready routing. | No new automated test needed for startup now. Reopen only if startup ordering, auth routing, or readiness semantics change. |
| `FCP-6-SF2` | narrow regression/contract test needed now | navigation/exit UI owner | `NavigationCoordinator` proves Back opens the exit-confirm modal from player and routes modal open/close effects. Direct reads showed `ExitConfirmCoordinator` owns modal view, focusable registration, Cancel close, Exit `window.close()`, and cleanup, and no direct test file exercised those public outcomes. | Resolved by commit `ef09466b`: focused exit-confirm coordinator/modal tests now cover the public contract. |
| `FCP-6-SF3` | existing coverage sufficient | Plex auth/discovery/library/stream owners | Plex auth, discovery, library, stream, URL, and logging suites cover token validation, profile switching, retry/error taxonomy, connection fallback, library parse failures, stream decisions, transcode sessions, and URI sanitization. | No new Plex tests now. Any Plex behavior change must run focused Plex tests plus `npm run verify`. |
| `FCP-6-SF4` | existing coverage sufficient | Plex/security owners | `docs/api/plex-integration.md` forbids token logging. Existing tests cover `redactSensitiveTokens`, Plex logging redaction, URL token policy, bootstrap overlay redaction, library log redaction, stream debug redaction, and subtitle debug redaction. | No P0 security gap admitted. Reopen if token storage, token query/header construction, logging, diagnostics, or debug surfaces change. |
| `FCP-6-SF5` | existing coverage sufficient | server-selection/persistence owners | `SelectedServerPersistenceAdapter`, `ServerSelectionCoordinator`, `Orchestrator`, and storage-key tests cover active-user selected-server persistence, missing/corrupted credentials, rollback after persistence or startup-resume failure, and server/user scoped key calculation. | No new selected-server persistence test now. |
| `FCP-6-SF6` | existing coverage sufficient | scheduler/channel persistence and settings owners | Channel persistence/manager tests cover malformed data, quota/blocked storage, current channel persistence, key switching, debounce/flush, and import/load normalization. Settings store tests cover defaults, invalid values, writes, and blocked storage across the configured stores. | No new automated test now. |
| `FCP-6-SF7` | existing coverage sufficient | player/Plex stream/subtitle owners | Player, subtitle fallback, stream resolver, and subtitle-track recovery tests cover native media behavior, stale overlapping loads, retries, Media Session feature checks, direct/transcode decisions, subtitle fallback classifications, XHR fallback, burn-in recovery, and redacted debug output. | No new automated test now. |
| `FCP-6-SF8` | existing coverage sufficient | channel-setup owners | Channel setup core/UI tests cover setup record persistence, coordinator gating, workflow port preconditions, planning/build services, session runtime abort/stale-result cleanup, build outcomes, DOM ids, and focus transfer. | No new automated test now. |
| `FCP-6-SF9` | existing coverage sufficient | lifecycle/recovery owners | Lifecycle tests cover visibility transitions, webOS relaunch binding, page/persistence flush behavior, online/offline listeners, state persistence failure handling, resume race behavior, error adaptation, and recovery action coverage. | No new automated test now. |
| `FCP-6-SF10` | no new automated test needed | app/runtime portability owner | FCP-5 resolved lifecycle raw storage and accepted current webOS/browser-renderer assumptions. This audit found no need to implement or test a speculative Windows/Electron runtime before the port exists. | Preserve FCP-5 owner/revisit triggers. Do not add unused runtime adapters or broad port tests now. |
| `FCP-6-SF11` | broader integration/manual proof required | future-port test owner | Current Jest coverage cannot prove actual Windows/Electron shell behavior, real device Plex connectivity, webOS media playback, or native Back/Exit semantics outside jsdom/mocked fetch. | Deferred future-port owner must add manual/integration proof when a concrete port or device validation pass opens. |

## Brittle-Test Triage

Avoid tests that assert private initialization helper names, internal collaborator construction order beyond documented startup phase ordering, timer durations that are not user-visible contracts, exact mock call counts in long cross-module flows when outcome assertions are enough, or CSS/DOM snapshots of full screens.

The only admitted automated gap is `FCP-6-SF2` because it tests stable public outcomes at the exit-confirm boundary rather than private implementation details:

- opening the known exit modal renders expected accessible modal state and actions,
- Cancel closes the modal through navigation,
- Exit calls `window.close()` for the current webOS root-exit contract,
- close/destroy unregisters focusables and clears visible modal state.

## Deferred Future-Port Proof

`FCP-6-SF11` is intentionally not a cleanup-worker unit. A real Windows/Electron-style port must own separate integration/manual proof for runtime shell startup, native Back/Exit mapping, real Plex network connectivity, token storage policy in that runtime, native media/subtitle playback, and offline/recovery behavior. FCP-6 should not add speculative mocks for those runtime contracts before the port exists.

## Proof Matrix

| source_finding_id | classification | closeout status | proof | final owner | revisit trigger |
| --- | --- | --- | --- | --- | --- |
| `FCP-6-SF1` | existing coverage sufficient | no-action | Startup/initialization audit remains source-backed by bootstrap, startup integration, orchestrator, `InitializationCoordinator`, and startup policy tests. FCP-6 implementation changed no startup source. | app-shell/initialization owner | Startup ordering, readiness, auth, server routing, queued rerun, or initialization contract changes. |
| `FCP-6-SF2` | narrow regression/contract test needed now | resolved by commit `ef09466b` | `src/modules/ui/exit-confirm/__tests__/ExitConfirmCoordinator.test.ts` covers modal render/accessibility state, focusable registration, Cancel through `navigation.closeModal`, Exit through `window.close()`, close/unregister cleanup, and modal destroy DOM cleanup. Focused Jest path passed with 4 tests; `npm run typecheck`, `npm run verify`, `npm run verify:docs`, `git diff --check`, and clean implementation review passed. | navigation/exit UI owner | Root Back/Exit behavior changes, exit-confirm modal ownership changes, or a future port needs non-`window.close()` exit semantics. |
| `FCP-6-SF3` | existing coverage sufficient | no-action | Plex auth/discovery/library/stream audit remains source-backed by the focused Plex suites; FCP-6 implementation changed no Plex source. | Plex auth/discovery/library/stream owners | Plex auth, discovery, library, stream, connectivity, or error contract changes. |
| `FCP-6-SF4` | existing coverage sufficient | no P0 admitted | Token/security audit remains source-backed by redaction, URL/logging, bootstrap, library, and stream tests. FCP-6 implementation did not touch token storage, token-bearing URL/header construction, logging, diagnostics, debug surfaces, or Plex connectivity. | Plex/security owners | Token storage, token-bearing URL/header construction, logging, diagnostics, debug, or auth/connectivity changes. |
| `FCP-6-SF5` | existing coverage sufficient | no-action | Selected-server persistence/resume audit remains source-backed by `SelectedServerPersistenceAdapter`, `ServerSelectionCoordinator`, orchestrator, and storage-key tests; FCP-6 implementation changed no server-selection source. | server-selection/persistence owners | Selected-server persistence, startup resume, rollback, or scoped-storage key changes. |
| `FCP-6-SF6` | existing coverage sufficient | no-action | Scheduler/channel persistence and settings persistence audit remains source-backed by channel persistence/manager/codec tests, storage-key tests, and settings store tests; FCP-6 implementation changed no scheduler/settings source. | scheduler/channel persistence and settings owners | Storage-key, channel persistence, settings store, blocked-storage, or normalization contract changes. |
| `FCP-6-SF7` | existing coverage sufficient | no-action | Player/media/subtitle recovery audit remains source-backed by player, subtitle fallback, stream resolver, and subtitle-track recovery tests; FCP-6 implementation changed no player/Plex stream source. | player/Plex stream/subtitle owners | Player recovery, stream decision, subtitle delivery, native media, or debug-redaction behavior changes. |
| `FCP-6-SF8` | existing coverage sufficient | no-action | Channel setup audit remains source-backed by core and UI channel setup tests; FCP-6 implementation changed no channel setup source. | channel-setup owners | Setup persistence, planning/build, session runtime, abort/stale-result, or UI flow changes. |
| `FCP-6-SF9` | existing coverage sufficient | no-action | Lifecycle/offline/recovery audit remains source-backed by lifecycle, connectivity, state, resume-race, and error-recovery tests; FCP-6 implementation changed no lifecycle source. | lifecycle/recovery owners | Lifecycle, offline, resume, persistence flush, or recovery contract changes. |
| `FCP-6-SF10` | no new automated test needed | no-action | FCP-5 portability assumptions remain represented by FCP-5 audit/plan records and existing source/test coverage; FCP-6 did not add speculative runtime adapters or port mocks. | app/runtime portability owner | A concrete port plan opens or FCP-5 platform/storage/filesystem assumptions change. |
| `FCP-6-SF11` | broader integration/manual proof required | deferred | Real Windows/Electron shell, device Plex, native media, and manual integration proof remain deferred because that runtime does not exist in this package. | future-port test owner | A real Windows/Electron shell, device validation pass, or port execution plan opens. |

## Security Triage / P0 Disposition

- Planning-time disposition: no P0 security finding admitted.
- Implementation commit `ef09466b` touched only `src/modules/ui/exit-confirm/__tests__/ExitConfirmCoordinator.test.ts`.
- The implementation did not touch Plex auth, token storage, token-bearing URL/header construction, logging, debug surfaces, Plex connectivity, DOM injection, media policy, filesystem APIs, or platform identity.
- Post-implementation closeout disposition remains no P0 security finding admitted.
- If any future FCP-6 revision changes token/security behavior, stop and replan with Plex/security ownership before closeout or FCP-EXIT work.

## FCP-6 Closeout Readiness

FCP-6 implementation review approved `FCP-6-S1` with no material findings after implementation commit `ef09466b` resolved `FCP-6-SF2`.

Closeout evidence so far:

- Planner created this source-backed audit and the active execution plan.
- Fresh plan review found no material findings and approved `FCP-6-S1`.
- `FCP-6-SF2` resolved by commit `ef09466b`: focused exit-confirm tests now cover modal render/accessibility state, focusable registration, Cancel close, Exit-to-Home via `window.close()`, close/unregister cleanup, and destroy DOM cleanup.
- Focused exit-confirm tests passed: `npm run test -- --runTestsByPath src/modules/ui/exit-confirm/__tests__/ExitConfirmCoordinator.test.ts` (4 tests).
- `npm run typecheck` passed.
- `npm run verify` passed, including full coverage tests, tools tests, contracts, docs verification, and Vite build.
- `npm run verify:docs` passed inside `npm run verify`.
- `git diff --check` passed after closeout edits.
- Fresh implementation review approved `FCP-6-S1` with no material findings.
- Fresh FCP-6 priority-exit closeout review approved completion with no material findings.
- No production source changed.
- Deferred/no-action records for `FCP-6-SF1` and `FCP-6-SF3` through `FCP-6-SF11` remain owned above with single final owners and revisit triggers.
- FCP-EXIT may start only through its own cleanup-loop scope-load and final reconciliation pass.

## Known Uncertainty

- Codanna discovery and impact analysis could not run because no Codanna MCP tools were exposed to the controller/planner. The plan review found a local Codanna CLI/index exists, but accepted this deterministic `rg` and direct-read fallback for the bounded `FCP-6-S1` test slice.
- This is a test-confidence/source audit, not a webOS device run, Plex server run, or Windows/Electron validation pass.
- The full test suite and verifier have now run through `npm run verify`; this still does not claim webOS device, Plex server, or Windows/Electron validation proof.

## Future Package Rule

Any future FCP-6 package, FCP-6 closeout revision, or FCP-EXIT reconciliation pass must update this audit when it changes, retires, accepts, or defers any listed `source_finding_id`, or if it discovers a new source-backed test-confidence gap in a critical port-survival path.
