**Plan Status:** completed
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

# FCP-7 Boundary And Type Hygiene Plan

## Goal

Retire `ARCHITECTURE_CLEANUP_CHECKLIST.md` item `FCP-7` by removing the remaining boundary/type hygiene hazards that would otherwise normalize source cycles, stale architecture exceptions, duplicated literal unions, duplicated error predicates, and open event-map typing before platform work.

This is an `FCP-*` source-backed cleanup package. Coverage is defined only by the checklist `source_finding_id` values `FCP-7-SF1` through `FCP-7-SF7`; do not use Desloppify, detector ids, imported review ids, package-map ids, or score deltas for intake, proof, or closeout.

## Non-Goals

- Do not extract server-select discovery, autoconnect, focus, visibility generation, or idle state machines.
- Do not rewrite `NavigationCoordinator` or change navigation runtime behavior beyond type-owner cleanup and stale rule-exception removal.
- Do not redesign the now-playing debug modal or now-playing-info overlay.
- Do not clean up channel setup wizard rendering, focus behavior, or DCR-2 failure semantics.
- Do not widen public event APIs or add compatibility shims to preserve arbitrary string event names.
- Do not update `FCP-8` through `FCP-12`, `FCP-EXIT`, or any legacy detector-backed package from this plan.

## Parent Priority Alignment

`FCP-7` is the first active package in the final cleanup pass. It advances the checklist operating rule that unchecked `FCP-*` rows are handled as source-backed packages through `cleanup-loop`, with source findings owned exactly once.

`docs/architecture/CURRENT_STATE.md` currently identifies:

- app-shell/server-select callers consume narrowed server-select results while selected-server readiness and persistence remain in core/orchestrator/server-selection owners;
- channel setup config normalization is owned by `src/core/channel-setup/config/normalizeChannelSetupConfig.ts`, and the planning path is compatibility-only;
- channel setup UI runtime owns string-only error summaries while typed planning/build failures stay in core contracts/logs;
- overlay package roots are the intended cross-module seams for coordinator/value imports, while non-UI runtime modules should not import UI overlay interfaces unless a boundary owner adapts them.

This plan tightens those existing owners. It must not invent new broad owners.

## Required Reading

Read in this order before implementation or review:

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/plan-authoring-standard.md`
4. `docs/architecture/CURRENT_STATE.md`
5. `ARCHITECTURE_CLEANUP_CHECKLIST.md`
6. this plan
7. `docs/plans/2026-05-01-server-select-list-view-extraction-plan.md` for the prior standalone server-select extraction seam, noting that `FCP-7-SF1` now supersedes its allowed type import shape
8. source files named under `## Files In Scope`
9. `git status --short --branch`

Freshness gate: if any file in scope, `ARCHITECTURE_CLEANUP_CHECKLIST.md`, or `docs/architecture/CURRENT_STATE.md` changed materially after this plan was written, refresh this plan before implementation.

## Required Skills

- `architecture-boundaries`: primary skill; this package changes module boundaries, source import direction, architecture-rule exceptions, and shared type owners.
- `verification-strategy`: use contract-first where shared type contracts are tightened and refactor-invariance where behavior must stay unchanged.
- `execution-plan-authoring`: keep execution units decision-complete without turning the package plan into patch prose.

Do not load `ui-composition-patterns` unless an implementation slice attempts a TV-visible UI/focus/rendering change. That should usually be a stop-and-replan signal for `FCP-7`.

## Codanna Discovery

- `get_index_info`: Codanna available; index contains 12,344 symbols across 784 files, semantic search enabled, updated about one hour before this plan.
- `search_documents "FCP Operating Rules FCP-7 Boundary And Type Hygiene source findings"`: found `docs/agentic/plan-authoring-standard.md` FCP source-backed rules. Direct checklist reads provided the authoritative `FCP-7` source findings because document search did not return `ARCHITECTURE_CLEANUP_CHECKLIST.md` as the top hit for the longer FCP query.
- `search_documents "FCP-7 Boundary And Type Hygiene source_finding_id server-select event maps channel setup navigation"`: returned prior cross-module and channel-setup planning docs but not authoritative FCP membership; fallback was direct read of `ARCHITECTURE_CLEANUP_CHECKLIST.md`.
- `semantic_search_with_context "ServerSelectListView ServerSelectScreen shared state types source cycle"`: no useful match. A broader server-select query returned weak unrelated hits, so deterministic `rg` and source reads are the evidence for `FCP-7-SF1`.
- `find_symbol EventEmitter` -> symbol_id `8828`; `analyze_impact` showed 18 impacted symbols at depth 2, including `VideoPlayer`, `NavigationManager`, `RemoteHandler`, `EPGComponent`, `DeferredEPGComponent`, `AppLifecycle`, `ChannelScheduler`, `PlexLibrary`, `PlexStreamResolver`, `PlexAuth`, `ChannelManager`, `PlexServerDiscovery`, and `VideoPlayerEvents`.
- `find_symbol IEventEmitter` -> symbol_id `8675`; `analyze_impact` showed 16 impacted symbols at depth 2 across the same shared emitter family.
- `find_symbol ChannelSetupWorkflowPort` -> symbol_id `10443`; `analyze_impact` showed a contained impact surface of `AppOrchestrator`, `createChannelSetupRuntimePort`, and diagnostics callers.
- `find_symbol normalizeChannelSetupConfig` -> symbol_id `10957`; `analyze_impact` showed callers in channel setup persistence, planning service, workflow-port creation, `ChannelSetupCoordinator`, and UI session hydration.
- `find_symbol ChannelSwitchOutcome` -> symbol_id `10965`; `analyze_impact` showed limited current Codanna usage in channel tuning, while direct source reads found a duplicated navigation-local union in `NavigationFeaturePorts.ts`.
- `find_symbol NowPlayingDebugManager` -> symbol_id `781`; `analyze_impact` showed the debug manager is constructed only through orchestrator coordinator builders/assembly and `AppOrchestrator`.
- `rg`/direct source reads: used for import cycles, temporary exceptions, duplicated unions, duplicated error predicates, compatibility re-export imports, and event-map index signatures because those are text/import-shape findings.

Codanna is sufficient for the shared-symbol impact gates. Direct source reads are the authoritative proof for import-shape findings and current duplicated literals.

## Impact Snapshot

Current source proof:

- `ServerSelectListView.ts` imports `ServerSelectScreenState` from `ServerSelectScreen.ts`; `ServerSelectScreen.ts` imports `renderServerSelectList` from `ServerSelectListView.ts`. This is the `FCP-7-SF1` source cycle, even though the list view only needs selected-server id and health-map display data.
- `tools/architecture-rules/lineupArchitectureRules.mjs` still contains three `runtime-ui-boundary` temporary exceptions from `src/modules/navigation/NavigationCoordinator.ts` to `../ui/epg`, `../ui/now-playing-info`, and `../ui/playback-options/types`. Direct source search did not find matching current imports in `NavigationCoordinator.ts`, so these are stale unless implementation source-audit disproves that.
- `NowPlayingDebugManager.ts` imports `INowPlayingInfoOverlay` from the UI package. Current debug usage only checks overlay existence before auto-show and relies on navigation modal state for visibility; orchestrator builders are the natural adapter boundary.
- `ChannelSetupPlanningService.ts` imports `normalizeChannelSetupConfig` through `./normalizeChannelSetupConfig`, and `ChannelSetupBuildExecutor.ts` imports it through `../planning/normalizeChannelSetupConfig`; both are active production callers of the planning compatibility re-export to `../config/normalizeChannelSetupConfig`.
- `ChannelSetupSessionRuntime.ts` locally duplicates `ChannelSetupWorkflowUnavailableError` name/predicate logic already exported by `ChannelSetupWorkflowPort.ts`.
- `NavigationFeaturePorts.ts` declares `NavigationChannelSwitchOutcome = 'switched' | 'aborted' | 'failed'` while `src/types/channelSwitch.ts` owns the same outcome union as `ChannelSwitchOutcome`.
- `EventEmitter.ts` and `IEventEmitter` constrain event maps with `TEventMap extends Record<string, unknown>`, which forces real event maps to add `[key: string]: unknown` or equivalent widening. Current direct hits include navigation, player, lifecycle, scheduler, channel-manager, EPG, Plex library/stream, remote handler, and EPG error-boundary maps.

The branch also has pre-existing unrelated local changes and untracked plan/docs artifacts. Implementation must not modify or revert them.

## Files In Scope

- `src/modules/ui/server-select/ServerSelectScreen.ts`
- `src/modules/ui/server-select/ServerSelectListView.ts`
- `src/modules/ui/server-select/__tests__/ServerSelectListView.test.ts`
- `src/modules/ui/server-select/__tests__/ServerSelectScreen.test.ts`
- a new or existing sibling server-select contract/type owner under `src/modules/ui/server-select/`
- `tools/architecture-rules/lineupArchitectureRules.mjs`
- `tools/__tests__/build-eslint-architecture-rules.test.mjs`
- `src/modules/debug/NowPlayingDebugManager.ts`
- `src/modules/debug/__tests__/NowPlayingDebugManager.test.ts`
- `src/core/orchestrator/OrchestratorCoordinatorBuilders.ts`
- `src/core/orchestrator/__tests__/OrchestratorCoordinatorBuilders.test.ts`
- `src/modules/ui/now-playing-info/interfaces.ts` read-only unless review approves a public contract change
- `src/core/channel-setup/config/normalizeChannelSetupConfig.ts`
- `src/core/channel-setup/build/ChannelSetupBuildExecutor.ts`
- `src/core/channel-setup/planning/ChannelSetupPlanningService.ts`
- `src/core/channel-setup/planning/normalizeChannelSetupConfig.ts`
- `src/core/channel-setup/workflow/ChannelSetupWorkflowPort.ts`
- `src/core/channel-setup/__tests__/ChannelSetupBuildExecutor.test.ts`
- `src/core/channel-setup/__tests__/ChannelSetupWorkflowPort.test.ts`
- `src/core/channel-setup/__tests__/normalizeChannelSetupConfig.test.ts`
- `src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts`
- `src/modules/ui/channel-setup/ChannelSetupSessionRuntime.ts`
- `src/modules/ui/channel-setup/__tests__/ChannelSetupSessionRuntime.test.ts`
- `src/modules/navigation/NavigationFeaturePorts.ts`
- `src/modules/navigation/__tests__/NavigationCoordinator.test.ts`
- `src/types/channelSwitch.ts`
- `src/utils/EventEmitter.ts`
- `src/utils/interfaces.ts`
- `src/utils/__tests__/EventEmitter.test.ts`
- event-map owner files/tests touched only by `FCP-7-S3` if closed event-map typing remains bounded after source audit
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` only during implementation closeout after clean review and verification

## Files Out Of Scope

- server-select discovery/autoconnect/focus state-machine extraction
- broad `NavigationCoordinator` rewrite
- channel setup wizard rendering cleanup
- debug modal redesign
- `src/modules/ui/now-playing-info/interfaces.ts` production contract changes unless plan review approves them before implementation
- selected-server persistence, app-shell result narrowing, Plex discovery/selection policy, and channel setup DCR-2 failure semantics
- `docs/architecture/CURRENT_STATE.md` unless implementation changes a public architecture ownership claim
- unrelated dirty files shown by `git status --short --branch`
- `FCP-8` through `FCP-12` and `FCP-EXIT`

## Planner Self-Check

- The package has no unresolved architecture seam at the planning level: each source finding has one intended owner and one planned slice.
- Adjacent contract/type changes are explicitly in scope where needed. `src/modules/ui/now-playing-info/interfaces.ts` is frozen read-only unless review approves a public contract change.
- No out-of-scope file is required for "mechanical wiring"; the only checklist closeout edit is in scope after verification.
- Codanna evidence and direct-read fallbacks are recorded.
- The plan avoids growing hotspots: server-select shared types move to a sibling owner, debug gets a debug-owned port, channel setup consumers use canonical owners, navigation aliases the shared union, and EventEmitter closes its own type contract.
- A fresh cleanup-loop session can start with `ready_now_execution_unit` `FCP-7-S1` without deciding package membership, final owners, or verification depth.
- The plan remains execution-grade, but `FCP-7-S3` intentionally contains a stop gate because event-map tightening may reveal broad API redesign.

## Architecture Seam Decision Gate

Approved seams:

- `FCP-7-S1`: server-select shared display/state shapes belong in a sibling server-select owner such as `types.ts`/`contracts.ts`, not in either `ServerSelectScreen.ts` or `ServerSelectListView.ts`. Architecture-rule stale exceptions should be removed only if a current import audit confirms the corresponding imports are gone; the rule must stay active or become stricter.
- `FCP-7-S2`: debug owns the minimal presence port it needs. Orchestrator builders adapt the full now-playing overlay to that debug-owned port. Channel setup planning and build executor imports config normalization from the canonical config owner, and channel setup UI consumes the workflow-owned unavailable predicate.
- `FCP-7-S3`: navigation must consume or alias the shared `ChannelSwitchOutcome`; `EventEmitter`/`IEventEmitter` should accept closed event maps without index signatures if the impact audit remains bounded.

Stop and replan if:

- source audit shows one listed `source_finding_id` is already false and the planned edit would be churn rather than cleanup;
- event-map tightening requires a broad public API redesign, runtime event name registry, or compatibility path;
- debug changes alter auto-show, modal-open, or stream-decision refresh behavior;
- channel setup changes alter unavailable-workflow handling, abort handling, preview/review/build failure semantics, or DCR-2 behavior;
- architecture-rule changes loosen enforcement, remove non-stale exceptions, or hide a still-live violation;
- server-select work starts extracting discovery/autoconnect/focus/idle logic;
- any slice requires files outside its approved scope or changes the final owner of another `FCP-*` package.

Absorb-now rule: absorb only newly discovered residue that stays within the same approved execution unit goal, owner, seam/files, verification envelope, and final-owner accounting. Record absorbed residue in implementation/review output. Replan for new owners, new source findings, wider verification, changed execution-unit membership, or changed final-owner accounting.

## Verification Commands

Verification strategy classification: `new regression/contract test required`.

Primary proof mode: contract-first for shared type boundaries and architecture rules, with refactor-invariance for behavior-preserving import/type-owner cleanup.

Required per-slice commands:

- `npm test -- ServerSelectListView ServerSelectScreen`
  - Expected: server-select list/screen tests pass after `FCP-7-S1`; add or update targeted assertions only for the shared-state contract if current coverage does not protect it.
- `node --test tools/__tests__/build-eslint-architecture-rules.test.mjs`
  - Expected: architecture-rule config tests pass and include proof that stale `NavigationCoordinator` UI exceptions are removed while runtime UI restrictions remain active.
- `npm test -- NowPlayingDebugManager OrchestratorCoordinatorBuilders`
  - Expected: debug manager behavior and orchestrator adapter wiring remain unchanged after `FCP-7-S2`.
- `npm test -- ChannelSetupWorkflowPort ChannelSetupSessionRuntime ChannelSetupPlanningService normalizeChannelSetupConfig`
  - Expected: canonical unavailable predicate and canonical normalization imports preserve channel setup behavior.
- `npm test -- ChannelSetupBuildExecutor`
  - Expected: build executor behavior is unchanged while its setup-config normalization import uses the canonical config owner.
- `npm test -- NavigationCoordinator EventEmitter`
  - Expected: navigation channel-switch outcome typing and event emitter behavior/type tests pass after `FCP-7-S3`.
- `npm run typecheck`
  - Expected: no TypeScript errors, including closed event-map type checks.
- `npm run verify`
  - Expected: full UI/navigation/orchestrator verification passes before implementation closeout.

Required source/static audits:

- `rg -n "from './ServerSelectScreen'|ServerSelectScreenState" src/modules/ui/server-select/ServerSelectListView.ts src/modules/ui/server-select/__tests__/ServerSelectListView.test.ts`
  - Expected: no list-view import from `ServerSelectScreen.ts` and no list-view test dependency on screen-owned state.
- `rg -n "from: 'src/modules/navigation/NavigationCoordinator.ts'|to: '../ui/(epg|now-playing-info|playback-options)" tools/architecture-rules/lineupArchitectureRules.mjs`
  - Expected: no stale runtime UI temporary exceptions for `NavigationCoordinator`.
- `rg -n "from '../ui/now-playing-info'|INowPlayingInfoOverlay" src/modules/debug src/modules/debug/__tests__`
  - Expected: debug module no longer imports the UI overlay interface.
- `rg -n "from './normalizeChannelSetupConfig'|from '../planning/normalizeChannelSetupConfig'|core/channel-setup/planning/normalizeChannelSetupConfig" src/core/channel-setup src/modules/ui/channel-setup`
  - Expected: no active production caller imports setup-config normalization through the planning compatibility re-export; remove the re-export file only if no imports remain and tests confirm the path is unused.
- `rg -n "CHANNEL_SETUP_UNAVAILABLE_ERROR_NAME|function isChannelSetupWorkflowUnavailableError" src/modules/ui/channel-setup/ChannelSetupSessionRuntime.ts`
  - Expected: no duplicated UI-local unavailable predicate.
- `rg -n "NavigationChannelSwitchOutcome = 'switched' \\| 'aborted' \\| 'failed'" src/modules/navigation src/core src/modules/ui`
  - Expected: no duplicated outcome union.
- `rg -n "\\[key: string\\]: unknown|EventEmitter<TEventMap extends Record<string, unknown>|IEventEmitter<TEventMap extends Record<string, unknown>" src/modules src/utils`
  - Expected: event maps no longer need arbitrary string index signatures solely for emitter compatibility, or the implementation records an accepted owner/revisit trigger if `FCP-7-S3` stops.

Because this package touches UI, navigation, orchestrator wiring, and shared runtime contracts, `npm run verify` is the closeout gate. `npm run verify:docs` is required only if implementation updates checklist/current-state/plan docs separately from `npm run verify`'s included docs gate.

## Rollback Notes

- Roll back by slice, not by package. If `FCP-7-S3` fails because event-map tightening is too broad, keep reviewed `FCP-7-S1`/`FCP-7-S2` changes and replan `FCP-7-S3` with an accepted owner/revisit trigger.
- If server-select type extraction changes behavior, revert only the sibling type-owner changes and restore the prior data shape while keeping any test proof that revealed the issue.
- If architecture-rule cleanup exposes a real violation, restore only the still-needed exception with a fresh reason/revisit trigger and replan instead of weakening the rule globally.
- If channel setup unavailable handling regresses, restore the canonical workflow predicate call path before attempting broader error taxonomy changes.

## Commit Checkpoints

- `FCP-7-S1` implementation checkpoint: server-select type owner plus architecture-rule/test changes.
- `FCP-7-S2` implementation checkpoint: debug port/adaptation plus channel setup canonical import/predicate changes.
- `FCP-7-S3` implementation checkpoint: channel-switch union alias/import plus closed event-map typing and affected event-map tests.
- Closeout checkpoint: after all slices pass review and `npm run verify`, update `ARCHITECTURE_CLEANUP_CHECKLIST.md` for `FCP-7` in a separate orchestrator-owned closeout pass if implementation commits were already made.

## Package Decomposition

- `package_id`: `FCP-7`
- `checklist_token`: `FCP-7`
- `package_issue_ids`: n/a for FCP source-backed packages; use `source_finding_ids`
- `source_finding_ids`: `FCP-7-SF1`, `FCP-7-SF2`, `FCP-7-SF3`, `FCP-7-SF4`, `FCP-7-SF5`, `FCP-7-SF6`, `FCP-7-SF7`
- `coverage_check`: every `source_finding_id` maps to exactly one planned slice below and no defer path is approved before implementation.
- `ready_now_slice`: `FCP-7-S1`
- `ready_now_execution_unit`: `FCP-7-S1`
- `recommended_slice_order`: `FCP-7-S1`, then `FCP-7-S2`, then `FCP-7-S3`
- `parallel_execution_policy`: serial by default. `FCP-7-S2` may run after `FCP-7-S1` review if the controller confirms no overlapping file edits remain. `FCP-7-S3` is serial because event-map typing touches shared utility contracts and many event owners.

| slice_id | goal | areas/files | source_finding_ids | verification | dependencies | stop_condition | handoff_condition | parallel_group | parallel_justification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FCP-7-S1` | Break the server-select screen/list type cycle and remove stale `NavigationCoordinator` architecture exceptions while keeping rules active. | `src/modules/ui/server-select/*`, `tools/architecture-rules/lineupArchitectureRules.mjs`, `tools/__tests__/build-eslint-architecture-rules.test.mjs` | `FCP-7-SF1`, `FCP-7-SF2` | `npm test -- ServerSelectListView ServerSelectScreen`; `node --test tools/__tests__/build-eslint-architecture-rules.test.mjs`; targeted `rg` audits; `npm run typecheck` | none | Stop if server-select work needs discovery/autoconnect/focus extraction, or if a removed architecture exception still masks a real current import violation. | No source cycle remains; stale exceptions are gone or rejustified with current proof; tests and audits pass. | `serial_only` | First slice establishes package baseline and may affect later navigation/type audit assumptions. |
| `FCP-7-S2` | Replace debug UI-overlay type import with a debug-owned minimal port, migrate active channel setup normalization callers to the canonical config owner, and consume the workflow-owned unavailable predicate. | `src/modules/debug/NowPlayingDebugManager.ts`, `src/core/orchestrator/OrchestratorCoordinatorBuilders.ts`, related tests, `src/core/channel-setup/config/*`, `src/core/channel-setup/build/ChannelSetupBuildExecutor.ts`, `src/core/channel-setup/planning/*`, `src/core/channel-setup/workflow/ChannelSetupWorkflowPort.ts`, `src/modules/ui/channel-setup/ChannelSetupSessionRuntime.ts`, related tests | `FCP-7-SF3`, `FCP-7-SF4`, `FCP-7-SF5` | `npm test -- NowPlayingDebugManager OrchestratorCoordinatorBuilders`; `npm test -- ChannelSetupWorkflowPort ChannelSetupSessionRuntime ChannelSetupPlanningService normalizeChannelSetupConfig`; `npm test -- ChannelSetupBuildExecutor`; targeted `rg` audits; `npm run typecheck` | `FCP-7-S1` clean review, unless controller proves disjoint local files and no stale architecture-rule edits are pending | Stop if debug behavior changes, now-playing-info public contract changes without review approval, channel setup unavailable handling changes semantics, build executor abort/preview/review/build failure semantics change, or the compatibility re-export still has active production callers after migration. | Debug module has no UI overlay import; active normalization callers, including build executor, use canonical config owner; UI runtime consumes canonical unavailable predicate; tests/audits pass. | `parallel_group: after-S1-disjoint` | May run after S1 because files are disjoint from server-select/rule cleanup, but should not run before S1 establishes current architecture-rule baseline. |
| `FCP-7-S3` | Deduplicate channel-switch outcome typing and tighten EventEmitter/IEventEmitter to support closed event maps without arbitrary string event names. | `src/modules/navigation/NavigationFeaturePorts.ts`, `src/types/channelSwitch.ts`, `src/utils/EventEmitter.ts`, `src/utils/interfaces.ts`, affected event-map owner files/tests | `FCP-7-SF6`, `FCP-7-SF7` | `npm test -- NavigationCoordinator EventEmitter`; affected owner tests discovered by typecheck/source audit; targeted `rg` audits; `npm run typecheck`; `npm run verify` before package closeout | `FCP-7-S1` and preferably `FCP-7-S2` complete, because this slice can create wide type churn | Stop if closed event-map typing requires public API redesign, runtime event-name registration, widespread behavioral changes, or a compatibility shim. Replan with an accepted owner/revisit trigger if tightening is not bounded. | Shared channel-switch outcome has one owner; event maps reject arbitrary names or have a documented accepted owner/revisit trigger; typecheck and tests pass. | `serial_only` | Shared utility/type impact is broad; Codanna impact already shows many emitter consumers. |

No `execution_waves` are approved in this plan. `cleanup-loop` should execute and review `FCP-7-S1` as the first single-slice execution unit, then return to this plan for the next unit unless review requires a replan.

## Source Finding Disposition

- `FCP-7-SF1`: retired in `FCP-7-S1` by moving shared server-select display state to `src/modules/ui/server-select/types.ts`.
- `FCP-7-SF2`: retired in `FCP-7-S1` by removing stale `NavigationCoordinator` runtime UI temporary exceptions while preserving architecture-rule enforcement.
- `FCP-7-SF3`: retired in `FCP-7-S2` by making debug own `NowPlayingDebugOverlayPort` and adapting the full now-playing overlay at the orchestrator boundary.
- `FCP-7-SF4`: retired in `FCP-7-S2` by migrating active planning and build-executor normalization callers to `src/core/channel-setup/config/normalizeChannelSetupConfig.ts` and removing the planning compatibility re-export.
- `FCP-7-SF5`: retired in `FCP-7-S2` by consuming the workflow-owned unavailable predicate from channel setup UI runtime.
- `FCP-7-SF6`: retired in `FCP-7-S3` by aliasing navigation's channel-switch outcome to the shared `ChannelSwitchOutcome` owner.
- `FCP-7-SF7`: retired in `FCP-7-S3` by allowing closed event maps in `EventEmitter`/`IEventEmitter` and removing emitter-compatibility index signatures from event-map owners.

## Closeout Results

- Implementation checkpoints: `611b73e8` (`FCP-7-S1`), `d51791ef` (`FCP-7-S2`), and `59f35d72` (`FCP-7-S3`).
- Plan-revision note: `FCP-7-S2` scope was expanded after review to include `src/core/channel-setup/build/ChannelSetupBuildExecutor.ts` because it was an active production caller of the planning normalization compatibility re-export.
- Review result: all three execution units received clean implementation reviews with no material findings.
- Verification: targeted execution-unit test suites, targeted source audits, `git diff --check`, `npm run typecheck`, and package closeout `npm run verify` passed on 2026-05-02.
- Checklist/current-state closeout: `ARCHITECTURE_CLEANUP_CHECKLIST.md`, `docs/architecture/CURRENT_STATE.md`, and `docs/architecture/modules.md` record the completed owner state.
