# P6-W1 Channel Setup And Scheduler Contracts Execution Plan

> **For agentic workers:** Use `lineup-cleanup-review` before implementation starts, then execute approved work under `cleanup-loop` one approved execution unit at a time. Keep package closure and `P6-EXIT` proof on the integration branch.

**Goal:** Retire `P6-W1` / `pkg_channel_setup_scheduler` by keeping channel-setup workflow cleanup, channel-tuning/runtime contract cleanup, and scheduler/channel-manager contract residue inside one domain-owned package without widening into EPG runtime cleanup.

**Architecture:** Keep channel-setup build/planning/workflow logic inside `src/core/channel-setup`, keep channel-setup UI/session/focus ownership inside `src/modules/ui/channel-setup`, keep runtime switch/schedule contracts inside `src/core/channel-tuning` plus `src/modules/scheduler/**`, and preserve current thin composition seams (`ChannelSetupWorkflowPort`, `ChannelSetupSessionController`, `ChannelManager`/`ChannelScheduler` public contracts) instead of regrowing orchestration logic in UI or core composition roots.

**Tech Stack:** TypeScript, Jest, Codanna, `desloppify`, `rg`, `npm run verify`, `npm run plans:check`, `npm run verify:docs`

---

**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked
**Tier:** Tier 3

## Goal

- Retire `ARCHITECTURE_CLEANUP_CHECKLIST.md` item `P6-W1` for `pkg_channel_setup_scheduler`.
- Reconcile all `41` package issue ids after the same-pass companion-map refresh that adds the three same-owner live residue rows discovered during this planning sweep:
  - `smells::src/core/channel-setup/ChannelSetupBuildExecutor.ts::catch_return_default`
  - `smells::src/core/channel-setup/ChannelSetupPlanningService.ts::catch_return_default`
  - `smells::src/core/channel-tuning/ChannelTuningCoordinator.ts::console_error_no_throw`
- Lock execution around four package-owned units:
  - channel-setup build/workflow resilience and error handling
  - channel-setup planning/facet/tag determinism and package-local source proof
  - channel-tuning plus scheduler/channel-manager contract cleanup and stale-proof audit
  - channel-setup UI session/screen/step cleanup with detector-recognized direct test coverage
- Preserve current architecture truth from `docs/architecture/CURRENT_STATE.md`:
  - `ChannelSetupPlanningService` remains the plan/review composition owner
  - `ChannelSetupSessionController` remains a UI-facing wrapper over `ChannelSetupSessionState` and `ChannelSetupSessionRuntime`
  - scheduler/channel persistence ownership stays in `ChannelPersistenceStore` / `ChannelRepository`
  - EPG runtime/package cleanup remains deferred to `P7-W1`

## Non-Goals

- Do not implement code in this planning pass.
- Do not widen into `src/core/orchestrator/**`, `src/core/app-shell/**`, or `src/modules/ui/epg/**`.
- Do not move channel-setup workflow logic into `ChannelSetupScreen` or other UI classes.
- Do not change `ChannelManager`, `ChannelScheduler`, or `ChannelSetupWorkflowPort` public contracts unless the owning slice proves a narrow same-owner adjustment is required; any broader contract drift is a replan trigger.
- Do not treat detector silence as closure by itself. Detector-silent package rows still need current-source proof plus exact issue-id reruns at `P6-EXIT`.
- Do not start `P7-W1` planning or implementation before `P6-EXIT` closes.

## Parent Priority Alignment

- Parent checklist item: `ARCHITECTURE_CLEANUP_CHECKLIST.md` -> `P6-W1` / `pkg_channel_setup_scheduler`.
- Current checklist truth:
  - `P5-W1` implementation is complete, but `P5-EXIT` is still in final review/closeout.
  - This `P6-W1` plan is intentionally pre-staged now per maintainer direction, but code implementation should still wait for `P5-EXIT` closure before the first implementer session starts.
  - package-local scoping commands observed during this planning pass:
    - `desloppify show src/core/channel-setup --status open --no-budget --top 150` -> `10` open rows
    - `desloppify show src/core/channel-tuning --status open --no-budget --top 100` -> `2` open rows
    - `desloppify show src/modules/scheduler/channel-manager --status open --no-budget --top 150` -> no open rows
    - `desloppify show src/modules/scheduler/scheduler --status open --no-budget --top 150` -> no open rows
    - `desloppify show src/modules/ui/channel-setup --status open --no-budget --top 150` -> `4` open rows
- Planning implication:
  - the package still owns `41` exact issue ids after the planning refresh, but only `16` are currently detector-live on this branch
  - the remaining `25` rows must be treated as package-owned stale-proof or residual-audit work, not silently dropped
  - `P6-W1` is the final `P6-W#` item, so the plan must leave `P6-EXIT` execution-ready with one explicit final owner for every survivor

## Required Reading

1. `agents.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/cleanup-loop.md`
4. `docs/agentic/plan-authoring-standard.md`
5. `ARCHITECTURE_CLEANUP_CHECKLIST.md`
6. `docs/architecture/active-cleanup-package-map.json`
7. `docs/architecture/CURRENT_STATE.md`
8. `docs/architecture/modules.md`
9. `docs/design/ui-design-language.md`
10. `src/core/channel-setup/ChannelSetupBuildCommitter.ts`
11. `src/core/channel-setup/ChannelSetupBuildExecutor.ts`
12. `src/core/channel-setup/ChannelSetupPlanningService.ts`
13. `src/core/channel-setup/ChannelSetupWorkflow.ts`
14. `src/core/channel-setup/ChannelSetupWorkflowPort.ts`
15. `src/core/channel-setup/createChannelSetupWorkflowPort.ts`
16. `src/core/channel-setup/ChannelSetupPlanner.ts`
17. `src/core/channel-setup/ChannelSetupFacetSnapshotLoader.ts`
18. `src/core/channel-setup/ChannelSetupTagFilters.ts`
19. `src/core/channel-tuning/ChannelTuningCoordinator.ts`
20. `src/modules/scheduler/channel-manager/ChannelManager.ts`
21. `src/modules/scheduler/channel-manager/interfaces.ts`
22. `src/modules/scheduler/channel-manager/ContentResolver.ts`
23. `src/modules/scheduler/scheduler/ChannelScheduler.ts`
24. `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
25. `src/modules/ui/channel-setup/ChannelSetupSessionController.ts`
26. `src/modules/ui/channel-setup/ChannelSetupSessionRuntime.ts`
27. `src/modules/ui/channel-setup/steps/BuildReviewStepController.ts`
28. `src/modules/ui/channel-setup/steps/LibraryStepController.ts`
29. `src/modules/ui/channel-setup/steps/StrategyStepController.ts`
30. `src/modules/ui/channel-setup/steps/StrategyStepInteractionController.ts`

Freshness gate:

- If `ARCHITECTURE_CLEANUP_CHECKLIST.md`, `docs/architecture/active-cleanup-package-map.json`, or `docs/architecture/CURRENT_STATE.md` changes materially before implementation, refresh this plan first.
- If fresh integration-branch `desloppify` reruns add new same-owner rows under `src/core/channel-setup`, `src/core/channel-tuning`, `src/modules/scheduler/**`, or `src/modules/ui/channel-setup`, update the companion map and this plan before coding.
- If the scheduler/channel-manager stale-proof audit shows live contract drift that requires EPG runtime consumer changes, stop and replan with `P7-W1` instead of widening this package.
- If channel-setup UI cleanup would force storage-schema or selected-server ownership changes outside the existing typed owners, stop and replan before implementation.

## Required Skills

1. `architecture-boundaries`
2. `ui-composition-patterns`
3. `verification-strategy`
4. `execution-plan-authoring`
5. `model-selection`

## Codanna Discovery

- `get_index_info`
  - index snapshot: `13611` symbols across `717` files; semantic search enabled; index updated `2` minutes before the planning sweep
- `semantic_search_with_context`
  - query `channel setup scheduler contracts channel manager channel tuning channel setup screen ownership cleanup`
  - result: one weak match in `tools/verify-docs.mjs` (`0.378`)
  - retry query `ChannelSetupPlanningService ChannelManager ChannelScheduler ChannelSetupScreen`
  - result: five weak/noisy hits, again dominated by `tools/verify-docs.mjs`
  - conclusion: semantic search was unexpectedly weak/noisy for this package, so symbol lookup plus direct reads were required
- `search_documents`
  - query `CURRENT_STATE channel setup session controller channel manager scheduler contracts`
  - useful result: `docs/architecture/CURRENT_STATE.md` confirmed present ownership for `ChannelSetupPlanningService`, `ChannelSetupSessionController`, and scheduler/channel persistence
  - fallback note: document search also returned stale indexed hits to old `P10` plan paths that no longer exist in `docs/`; those were not used as authority
- `find_symbol`
  - `ChannelManager` -> symbol `2406`
  - `ChannelSetupScreen` -> symbol `5833`
  - `ChannelSetupPlanningService` -> symbol `9543`
  - `ChannelTuningCoordinator` -> symbol `8645`
- `analyze_impact`
  - `ChannelTuningCoordinator` (`8645`) affects `buildChannelTuningCoordinator`, `createOrchestratorCoordinators`, `AppOrchestrator`, and `App`; tuning/runtime contract edits stay tightly coupled to the orchestrator assembly path
  - `ChannelSetupScreen` (`5833`) affects `AppLazyScreenRegistry`, `AppScreenVisibilityCoordinator`, `App`, and the lazy-screen registry boundary; UI cleanup must preserve show/hide and lazy-screen lifecycle behavior
  - `ChannelManager` (`2406`) and `ChannelSetupPlanningService` (`9543`) returned no useful reverse-edge impact snapshot, so direct reads plus `rg` were used instead of trusting empty impact output
- direct-read / `rg` fallback used because Codanna semantic discovery was insufficient:
  - current package hotspots remain large even when detector-silent: `ChannelManager.ts` `1485` LOC, `ContentResolver.ts` `1078`, `ChannelScheduler.ts` `624`, `ChannelSetupPlanner.ts` `1314`, `ChannelSetupFacetSnapshotLoader.ts` `1031`, `ChannelSetupScreen.ts` `950`, `StrategyStepInteractionController.ts` `1057`
  - `desloppify` package commands showed the live backlog is concentrated in channel-setup/core, channel-tuning, and UI step coverage, while mapped scheduler/review/structural rows are currently detector-silent and require stale-proof audit rather than blind removal

## Impact Snapshot

- Primary package owners/files:
  - channel-setup build/workflow: `ChannelSetupBuildCommitter.ts`, `ChannelSetupBuildExecutor.ts`, `ChannelSetupPlanningService.ts`, `ChannelSetupWorkflow.ts`, `ChannelSetupWorkflowPort.ts`
  - channel-setup planning/facet/tag logic: `ChannelSetupPlanner.ts`, `ChannelSetupFacetSnapshotLoader.ts`, `ChannelSetupTagFilters.ts`
  - runtime switch/scheduler contracts: `ChannelTuningCoordinator.ts`, `ChannelManager.ts`, `ContentResolver.ts`, `ChannelScheduler.ts`
  - channel-setup UI/session/steps: `ChannelSetupScreen.ts`, `ChannelSetupSessionController.ts`, `ChannelSetupSessionRuntime.ts`, `steps/*.ts`
- Call-site and lifecycle impact to preserve:
  - `ChannelTuningCoordinator` is assembled through orchestrator builders; `switchToChannel()` / `switchToChannelByNumber()` behavior and `handleGlobalError` propagation must stay stable for callers
  - `ChannelSetupScreen` is lazily owned through `AppLazyScreenRegistry` and `AppScreenVisibilityCoordinator`; UI cleanup must preserve show/hide, focus restoration, and hidden-state cleanup
  - `ChannelSetupSessionController` must stay a wrapper, not a second workflow/barrel owner
  - `ChannelManager` / `ChannelScheduler` public contracts consumed by orchestrator/player code must remain stable while stale-proof audit or narrow same-owner cleanup happens inside the package
- Domain invariants to preserve:
  - channel-setup preview/review/build still flow through `ChannelSetupWorkflowPort`
  - hidden or ended channel-setup UI must release timers, abort controllers, dropdown/focus state, and pending preview/review/build work
  - channel switching still resolves channel content before stopping playback, preserves `AppErrorCode` propagation, and keeps lifecycle save failures recoverable
  - scheduler/channel-manager persistence ownership remains in scheduler-channel-manager owners; no storage parsing moves into UI or channel-tuning code
  - EPG runtime cleanup remains out of scope except for preserving existing channel/schedule contract consumers

## Files In Scope

- `ARCHITECTURE_CLEANUP_CHECKLIST.md`
- `docs/architecture/active-cleanup-package-map.json`
- `docs/plans/2026-04-21-p6-w1-channel-setup-scheduler-contracts.md`
- `src/core/channel-setup/ChannelSetupBuildCommitter.ts`
- `src/core/channel-setup/ChannelSetupBuildExecutor.ts`
- `src/core/channel-setup/ChannelSetupPlanningService.ts`
- `src/core/channel-setup/ChannelSetupWorkflow.ts`
- `src/core/channel-setup/ChannelSetupWorkflowPort.ts`
- `src/core/channel-setup/createChannelSetupWorkflowPort.ts`
- `src/core/channel-setup/ChannelSetupPlanner.ts`
- `src/core/channel-setup/ChannelSetupFacetSnapshotLoader.ts`
- `src/core/channel-setup/ChannelSetupTagFilters.ts`
- `src/core/channel-setup/index.ts`
- `src/core/channel-setup/__tests__/ChannelSetupBuildCommitter.test.ts`
- `src/core/channel-setup/__tests__/ChannelSetupBuildExecutor.test.ts`
- `src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts`
- `src/core/channel-setup/__tests__/ChannelSetupPlanner.test.ts`
- `src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoader.test.ts`
- `src/core/channel-setup/__tests__/ChannelSetupTagFilters.test.ts`
- `src/core/channel-setup/__tests__/ChannelSetupWorkflow.test.ts`
- `src/core/channel-setup/__tests__/createChannelSetupWorkflowPort.test.ts`
- `src/core/channel-tuning/ChannelTuningCoordinator.ts`
- `src/core/channel-tuning/index.ts`
- `src/core/channel-tuning/__tests__/ChannelTuningCoordinator.test.ts`
- `src/modules/scheduler/channel-manager/ChannelManager.ts`
- `src/modules/scheduler/channel-manager/interfaces.ts`
- `src/modules/scheduler/channel-manager/types.ts` only if narrow same-owner contract cleanup requires it
- `src/modules/scheduler/channel-manager/ContentResolver.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ContentResolver.test.ts`
- `src/modules/scheduler/scheduler/ChannelScheduler.ts`
- `src/modules/scheduler/scheduler/ScheduleCalculator.ts`
- `src/modules/scheduler/scheduler/__tests__/ChannelScheduler.test.ts`
- `src/modules/scheduler/scheduler/__tests__/ScheduleCalculator.test.ts`
- `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
- `src/modules/ui/channel-setup/ChannelSetupSessionController.ts`
- `src/modules/ui/channel-setup/ChannelSetupSessionRuntime.ts`
- `src/modules/ui/channel-setup/ChannelSetupSessionContracts.ts`
- `src/modules/ui/channel-setup/ChannelSetupSessionState.ts`
- `src/modules/ui/channel-setup/ChannelSetupScreenPorts.ts`
- `src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts`
- `src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts`
- `src/modules/ui/channel-setup/__tests__/ChannelSetupSessionRuntime.test.ts`
- `src/modules/ui/channel-setup/steps/BuildReviewStepController.ts`
- `src/modules/ui/channel-setup/steps/LibraryStepController.ts`
- `src/modules/ui/channel-setup/steps/StrategyStepController.ts`
- `src/modules/ui/channel-setup/steps/StrategyStepInteractionController.ts`
- `src/modules/ui/channel-setup/steps/__tests__/BuildReviewStepController.test.ts`
- `src/modules/ui/channel-setup/steps/__tests__/LibraryStepController.test.ts`
- `src/modules/ui/channel-setup/steps/__tests__/StrategyStepController.test.ts`
- `src/modules/ui/channel-setup/steps/__tests__/StrategyStepInteractionController.test.ts`

## Files Out Of Scope

- `src/core/orchestrator/**`
- `src/core/app-shell/**`
- `src/modules/ui/epg/**`
- `src/modules/player/**`
- `src/modules/plex/**`
- `src/modules/navigation/**` except read-only focus-contract reference from existing callers
- scheduler persistence storage-key owners beyond narrow same-owner contract/test adjustments already listed in scope
- design-language or shared screen-shell primitives unless a same-owner UI cleanup proves a bounded invariant change is required
- `docs/runs/**` and archived plans

## Planner Self-Check

1. Is there any unresolved architecture seam, ownership seam, or collaborator boundary hidden inside the task?
   - No. The plan freezes four explicit package seams: build/workflow error handling, planning/facet determinism, tuning/scheduler contracts, and UI/session/step cleanup.
2. Does the plan depend on adjacent files needing contract or type changes that are not in scope?
   - No. Any narrow same-owner contract/test updates for workflow ports or scheduler interfaces are already in scope; broader orchestrator/EPG changes are explicit replan triggers.
3. Am I declaring any file out of scope that implementation will still implicitly rely on?
   - No. Callers above the package must remain stable; if they need edits, the plan is invalid and must be refreshed.
4. Did I record the full Codanna evidence path plus fallback logging?
   - Yes. Index snapshot, weak semantic-search results, document hit, useful impact analysis, and direct-read fallback are all recorded above.
5. Am I assigning the work to the repo-preferred owner, or am I quietly growing a hotspot?
   - Yes. Workflow/build cleanup stays in core channel-setup owners, UI cleanup stays in UI/session owners, tuning stays in channel-tuning, and scheduler contract work stays inside scheduler owners.
6. Would a fresh session have to invent anything important to finish this safely?
   - No. The slice table, stop conditions, verification envelope, and stale-proof handling are explicit.
7. Is this truly an execution-grade plan, or do I still need to resolve a design decision first?
   - Execution-grade. The only remaining gate is `P5-EXIT` closeout before code implementation starts.

## Architecture Seam Decision Gate

- **Seam 1: channel-setup build/workflow resilience**
  - chosen owners:
    - `ChannelSetupBuildExecutor` handles orchestration around library load, plan build, and commit delegation
    - `ChannelSetupBuildCommitter` owns temporary builder lifecycle, commit/apply sequencing, and bounded EPG refresh side effects
    - `ChannelSetupWorkflow` / `ChannelSetupWorkflowPort` remain the public workflow seam consumed by UI/session code
  - rule: silent fallback returns and raw package-local console branching must be replaced or normalized without moving workflow policy into UI
- **Seam 2: channel-setup planning/facet/tag logic**
  - chosen owners:
    - `ChannelSetupPlanningService` remains the composition owner for preview/review/diagnostics
    - `ChannelSetupFacetSnapshotLoader`, `ChannelSetupPlanner`, and `ChannelSetupTagFilters` remain pure/focused collaborators
  - rule: determinism and selector parsing should be fixed inside the planning collaborators, not papered over in callers or tests
- **Seam 3: tuning/scheduler/channel-manager contracts**
  - chosen owners:
    - `ChannelTuningCoordinator` remains the runtime switch owner
    - `ChannelManager`, `ContentResolver`, and `ChannelScheduler` remain the scheduler/channel-domain owners
  - rule: preserve public contract stability for orchestrator/player callers while retiring same-owner smell/test residue or proving detector lag explicitly
- **Seam 4: channel-setup UI/session/step boundaries**
  - chosen owners:
    - `ChannelSetupScreen` owns rendering/focus wiring only
    - `ChannelSetupSessionController` stays wrapper-only over `ChannelSetupSessionState` and `ChannelSetupSessionRuntime`
    - step controllers stay package-local view/interaction owners with detector-recognized direct tests
  - rule: no screen/session class may absorb workflow, storage, or scheduler policy to "fix" structural debt
- **Absorb-now rule**
  - absorb newly discovered residue only when it stays within the same slice goal, owner, file seam, verification envelope, and final-owner accounting
  - if a row would require widening into EPG, orchestrator, app-shell, or a new owner package, stop and replan
- **Stop-and-replan conditions**
  - fresh reruns show additional same-owner live rows outside this package's refreshed membership
  - scheduler/channel-manager audit proves a real public-contract drift that needs EPG, player, or orchestrator edits
  - UI cleanup cannot preserve lazy-screen show/hide, focus, abort-controller, or timer cleanup behavior without widening into app-shell ownership
  - channel-setup workflow cleanup would require storage-schema changes in out-of-scope persistence owners

## Package Decomposition

- `package_id`: `pkg_channel_setup_scheduler`
- `checklist_token`: `P6-W1`
- `package_issue_ids`:
  - `facade::src/core/channel-tuning/index.ts`
  - `flat_dirs::src/core/channel-setup`
  - `logs::src/core/channel-setup/ChannelSetupBuildCommitter.ts::ChannelSetup`
  - `logs::src/core/channel-setup/ChannelSetupBuildExecutor.ts::ChannelSetup`
  - `review::.::holistic::contract_coherence::channel_manager_error_contract_docs_lag_runtime`
  - `review::.::holistic::contract_coherence::channel_setup_port_absence_contract_split`
  - `smells::src/core/channel-setup/ChannelSetupBuildCommitter.ts::console_error_no_throw`
  - `smells::src/core/channel-setup/ChannelSetupBuildCommitter.ts::swallowed_error`
  - `smells::src/core/channel-setup/ChannelSetupBuildExecutor.ts::swallowed_error`
  - `smells::src/core/channel-setup/ChannelSetupBuildExecutor.ts::catch_return_default`
  - `smells::src/core/channel-setup/ChannelSetupFacetSnapshotLoader.ts::sort_no_comparator`
  - `smells::src/core/channel-setup/ChannelSetupPlanner.ts::sort_no_comparator`
  - `smells::src/core/channel-setup/ChannelSetupPlanningService.ts::catch_return_default`
  - `smells::src/core/channel-setup/ChannelSetupTagFilters.ts::high_cyclomatic_complexity`
  - `smells::src/core/channel-tuning/ChannelTuningCoordinator.ts::console_error_no_throw`
  - `smells::src/core/channel-tuning/ChannelTuningCoordinator.ts::swallowed_error`
  - `smells::src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts::non_null_assert`
  - `smells::src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts::stub_function`
  - `smells::src/modules/scheduler/scheduler/ChannelScheduler.ts::non_null_assert`
  - `structural::src/core/channel-setup/__tests__/ChannelSetupPlanner.test.ts`
  - `structural::src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts`
  - `structural::src/core/channel-setup/ChannelSetupFacetSnapshotLoader.ts`
  - `structural::src/core/channel-setup/ChannelSetupPlanner.ts`
  - `structural::src/core/channel-tuning/__tests__/ChannelTuningCoordinator.test.ts`
  - `structural::src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts`
  - `structural::src/modules/scheduler/channel-manager/__tests__/ContentResolver.test.ts`
  - `structural::src/modules/scheduler/channel-manager/ChannelManager.ts`
  - `structural::src/modules/scheduler/channel-manager/ContentResolver.ts`
  - `structural::src/modules/scheduler/scheduler/__tests__/ChannelScheduler.test.ts`
  - `structural::src/modules/scheduler/scheduler/__tests__/ScheduleCalculator.test.ts`
  - `structural::src/modules/scheduler/scheduler/ChannelScheduler.ts`
  - `structural::src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts`
  - `structural::src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts`
  - `structural::src/modules/ui/channel-setup/ChannelSetupScreen.ts`
  - `structural::src/modules/ui/channel-setup/ChannelSetupSessionRuntime.ts`
  - `structural::src/modules/ui/channel-setup/steps/StrategyStepController.ts`
  - `structural::src/modules/ui/channel-setup/steps/StrategyStepInteractionController.ts`
  - `test_coverage::src/modules/ui/channel-setup/steps/BuildReviewStepController.ts::transitive_only`
  - `test_coverage::src/modules/ui/channel-setup/steps/LibraryStepController.ts::transitive_only`
  - `test_coverage::src/modules/ui/channel-setup/steps/StrategyStepController.ts::transitive_only`
  - `test_coverage::src/modules/ui/channel-setup/steps/StrategyStepInteractionController.ts::transitive_only`
- `slice_table`:

### `P6-W1-S1`

- `goal`: normalize channel-setup build/workflow error handling so build execution, commit/apply, and workflow-port seams stop hiding failures behind raw package-local logging or default-object fallbacks
- `areas/files`: `src/core/channel-setup/ChannelSetupBuildCommitter.ts`, `src/core/channel-setup/ChannelSetupBuildExecutor.ts`, `src/core/channel-setup/ChannelSetupPlanningService.ts`, `src/core/channel-setup/ChannelSetupWorkflow.ts`, `src/core/channel-setup/ChannelSetupWorkflowPort.ts`, `src/core/channel-setup/createChannelSetupWorkflowPort.ts`, `src/core/channel-setup/__tests__/ChannelSetupBuildCommitter.test.ts`, `src/core/channel-setup/__tests__/ChannelSetupBuildExecutor.test.ts`, `src/core/channel-setup/__tests__/ChannelSetupWorkflow.test.ts`, `src/core/channel-setup/__tests__/createChannelSetupWorkflowPort.test.ts`
- `exact_issue_ids`: `logs::src/core/channel-setup/ChannelSetupBuildCommitter.ts::ChannelSetup`, `logs::src/core/channel-setup/ChannelSetupBuildExecutor.ts::ChannelSetup`, `smells::src/core/channel-setup/ChannelSetupBuildCommitter.ts::console_error_no_throw`, `smells::src/core/channel-setup/ChannelSetupBuildCommitter.ts::swallowed_error`, `smells::src/core/channel-setup/ChannelSetupBuildExecutor.ts::swallowed_error`, `smells::src/core/channel-setup/ChannelSetupBuildExecutor.ts::catch_return_default`, `smells::src/core/channel-setup/ChannelSetupPlanningService.ts::catch_return_default`
- `verification`: `npm test -- --runInBand src/core/channel-setup/__tests__/ChannelSetupBuildCommitter.test.ts src/core/channel-setup/__tests__/ChannelSetupBuildExecutor.test.ts src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts src/core/channel-setup/__tests__/ChannelSetupWorkflow.test.ts src/core/channel-setup/__tests__/createChannelSetupWorkflowPort.test.ts`; `npm run verify`
- `dependencies`: none
- `stop_condition`: build/workflow owners surface recoverable failures explicitly, preview/review/build paths stop returning silent default success shapes for real failures, and the workflow-port contract remains the only UI-facing seam
- `handoff_condition`: planning/facet cleanup can proceed on a stable workflow/build error contract
- `serial_only`: true
- `parallel_justification`: highest-risk live package seam; later slices depend on preserving these contracts

### `P6-W1-S2`

- `goal`: tighten channel-setup planning/facet/tag determinism and retire the remaining core channel-setup hotspot/package-surface residue without pushing planning logic into UI or tests
- `areas/files`: `src/core/channel-setup/ChannelSetupPlanner.ts`, `src/core/channel-setup/ChannelSetupFacetSnapshotLoader.ts`, `src/core/channel-setup/ChannelSetupTagFilters.ts`, `src/core/channel-setup/index.ts`, `src/core/channel-setup/__tests__/ChannelSetupPlanner.test.ts`, `src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts`, `src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoader.test.ts`, `src/core/channel-setup/__tests__/ChannelSetupTagFilters.test.ts`
- `exact_issue_ids`: `flat_dirs::src/core/channel-setup`, `smells::src/core/channel-setup/ChannelSetupFacetSnapshotLoader.ts::sort_no_comparator`, `smells::src/core/channel-setup/ChannelSetupPlanner.ts::sort_no_comparator`, `smells::src/core/channel-setup/ChannelSetupTagFilters.ts::high_cyclomatic_complexity`, `structural::src/core/channel-setup/__tests__/ChannelSetupPlanner.test.ts`, `structural::src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts`, `structural::src/core/channel-setup/ChannelSetupFacetSnapshotLoader.ts`, `structural::src/core/channel-setup/ChannelSetupPlanner.ts`
- `verification`: `npm test -- --runInBand src/core/channel-setup/__tests__/ChannelSetupPlanner.test.ts src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoader.test.ts src/core/channel-setup/__tests__/ChannelSetupTagFilters.test.ts`; `npm run verify`
- `dependencies`: `P6-W1-S1` complete
- `stop_condition`: planner/facet/tag collaborators are deterministic and smaller, core package-surface residue is retired or source-proven stale, and callers still depend on the same focused planning owners
- `handoff_condition`: tuning/scheduler cleanup can audit contract residue without unresolved planning-package debt
- `serial_only`: true
- `parallel_justification`: shares channel-setup planning types/tests and the same verification envelope as `S1`

### `P6-W1-S3`

- `goal`: retire live channel-tuning error-path residue and reconcile scheduler/channel-manager contract debt so detector-silent scheduler rows become stale-proven or receive one same-owner follow-up with bounded code/test work
- `areas/files`: `src/core/channel-tuning/ChannelTuningCoordinator.ts`, `src/core/channel-tuning/index.ts`, `src/core/channel-tuning/__tests__/ChannelTuningCoordinator.test.ts`, `src/modules/scheduler/channel-manager/ChannelManager.ts`, `src/modules/scheduler/channel-manager/interfaces.ts`, `src/modules/scheduler/channel-manager/ContentResolver.ts`, `src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts`, `src/modules/scheduler/channel-manager/__tests__/ContentResolver.test.ts`, `src/modules/scheduler/scheduler/ChannelScheduler.ts`, `src/modules/scheduler/scheduler/ScheduleCalculator.ts`, `src/modules/scheduler/scheduler/__tests__/ChannelScheduler.test.ts`, `src/modules/scheduler/scheduler/__tests__/ScheduleCalculator.test.ts`
- `exact_issue_ids`: `facade::src/core/channel-tuning/index.ts`, `review::.::holistic::contract_coherence::channel_manager_error_contract_docs_lag_runtime`, `smells::src/core/channel-tuning/ChannelTuningCoordinator.ts::console_error_no_throw`, `smells::src/core/channel-tuning/ChannelTuningCoordinator.ts::swallowed_error`, `smells::src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts::non_null_assert`, `smells::src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts::stub_function`, `smells::src/modules/scheduler/scheduler/ChannelScheduler.ts::non_null_assert`, `structural::src/core/channel-tuning/__tests__/ChannelTuningCoordinator.test.ts`, `structural::src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts`, `structural::src/modules/scheduler/channel-manager/__tests__/ContentResolver.test.ts`, `structural::src/modules/scheduler/channel-manager/ChannelManager.ts`, `structural::src/modules/scheduler/channel-manager/ContentResolver.ts`, `structural::src/modules/scheduler/scheduler/__tests__/ChannelScheduler.test.ts`, `structural::src/modules/scheduler/scheduler/__tests__/ScheduleCalculator.test.ts`, `structural::src/modules/scheduler/scheduler/ChannelScheduler.ts`
- `verification`: `npm test -- --runInBand src/core/channel-tuning/__tests__/ChannelTuningCoordinator.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts src/modules/scheduler/channel-manager/__tests__/ContentResolver.test.ts src/modules/scheduler/scheduler/__tests__/ChannelScheduler.test.ts src/modules/scheduler/scheduler/__tests__/ScheduleCalculator.test.ts`; `npm run verify`
- `dependencies`: `P6-W1-S2` complete
- `stop_condition`: tuning still propagates bounded `AppErrorCode` failures, scheduler/channel-manager stale rows are either retired with same-owner proof or turned into explicit same-owner code/test cleanup, and no EPG/orchestrator widening is required
- `handoff_condition`: UI slice can finish package-local cleanup on top of frozen runtime contracts and stale-proof matrix
- `serial_only`: true
- `parallel_justification`: shares one channel/schedule contract surface and one `P6-EXIT` proof matrix with prior slices

### `P6-W1-S4`

- `goal`: finish channel-setup UI/session/step cleanup by keeping screen/session ownership bounded, preserving focus/timer/abort invariants, and adding detector-recognized direct tests for step controllers
- `areas/files`: `src/modules/ui/channel-setup/ChannelSetupScreen.ts`, `src/modules/ui/channel-setup/ChannelSetupSessionController.ts`, `src/modules/ui/channel-setup/ChannelSetupSessionRuntime.ts`, `src/modules/ui/channel-setup/ChannelSetupSessionContracts.ts`, `src/modules/ui/channel-setup/ChannelSetupSessionState.ts`, `src/modules/ui/channel-setup/ChannelSetupScreenPorts.ts`, `src/core/channel-setup/ChannelSetupWorkflowPort.ts`, `src/core/channel-setup/createChannelSetupWorkflowPort.ts`, `src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts`, `src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts`, `src/modules/ui/channel-setup/__tests__/ChannelSetupSessionRuntime.test.ts`, `src/modules/ui/channel-setup/steps/BuildReviewStepController.ts`, `src/modules/ui/channel-setup/steps/LibraryStepController.ts`, `src/modules/ui/channel-setup/steps/StrategyStepController.ts`, `src/modules/ui/channel-setup/steps/StrategyStepInteractionController.ts`, `src/modules/ui/channel-setup/steps/__tests__/BuildReviewStepController.test.ts`, `src/modules/ui/channel-setup/steps/__tests__/LibraryStepController.test.ts`, `src/modules/ui/channel-setup/steps/__tests__/StrategyStepController.test.ts`, `src/modules/ui/channel-setup/steps/__tests__/StrategyStepInteractionController.test.ts`
- `exact_issue_ids`: `review::.::holistic::contract_coherence::channel_setup_port_absence_contract_split`, `structural::src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts`, `structural::src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts`, `structural::src/modules/ui/channel-setup/ChannelSetupScreen.ts`, `structural::src/modules/ui/channel-setup/ChannelSetupSessionRuntime.ts`, `structural::src/modules/ui/channel-setup/steps/StrategyStepController.ts`, `structural::src/modules/ui/channel-setup/steps/StrategyStepInteractionController.ts`, `test_coverage::src/modules/ui/channel-setup/steps/BuildReviewStepController.ts::transitive_only`, `test_coverage::src/modules/ui/channel-setup/steps/LibraryStepController.ts::transitive_only`, `test_coverage::src/modules/ui/channel-setup/steps/StrategyStepController.ts::transitive_only`, `test_coverage::src/modules/ui/channel-setup/steps/StrategyStepInteractionController.ts::transitive_only`
- `verification`: `npm test -- --runInBand src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupSessionRuntime.test.ts src/modules/ui/channel-setup/steps/__tests__/BuildReviewStepController.test.ts src/modules/ui/channel-setup/steps/__tests__/LibraryStepController.test.ts src/modules/ui/channel-setup/steps/__tests__/StrategyStepController.test.ts src/modules/ui/channel-setup/steps/__tests__/StrategyStepInteractionController.test.ts`; `npm run verify`
- `dependencies`: `P6-W1-S3` complete
- `stop_condition`: `ChannelSetupScreen` stays a view/focus owner, `ChannelSetupSessionController` stays wrapper-only, hidden-state cleanup remains explicit, and each step controller has detector-recognized direct coverage
- `handoff_condition`: `P6-W1` is ready for `P6-EXIT` detector refresh, stale-proof matrix closeout, and package score delta accounting
- `serial_only`: true
- `parallel_justification`: shares one lazy-screen/focus verification envelope and depends on the stable workflow/runtime contracts from prior slices
- `coverage_check`:
  - all `41` package issue ids are assigned exactly once after the same-pass companion-map refresh for the three newly observed same-owner live smell rows
  - currently detector-live rows (`16`) are intentionally front-loaded into `S1`, `S2`, `S3`, and `S4`
  - currently detector-silent mapped rows (`25`) are not dropped; each remains assigned to one slice as a stale-proof candidate or same-owner residual-audit obligation
  - no issue is pre-deferred outside `P6-W1`; if any row needs a different final owner after current-source proof, that is a replan trigger and must be recorded before implementation continues
- `ready_now_slice`: `P6-W1-S1`
- `ready_now_execution_unit`: `P6-W1-S1`
- `recommended_slice_order`:
  1. `P6-W1-S1`
  2. `P6-W1-S2`
  3. `P6-W1-S3`
  4. `P6-W1-S4`
- `parallel_execution_policy`: serial only
  - reason: all slices share one channel-setup/scheduler contract surface, one `npm run verify` envelope, and one `P6-EXIT` stale-proof / no-drop closeout surface
- `coverage_ledger`:
  - `flat_dirs::src/core/channel-setup` -> `P6-W1-S2` -> stale-proven on current source after `desloppify scan --profile objective --skip-slow --no-badge` plus `desloppify show "flat_dirs::src/core/channel-setup" --status open --no-budget --top 20`; the exact rerun is absent, `src/core/channel-setup/index.ts` remains a thin coordinator/workflow barrel, and current callers under `src/core/{index.ts,orchestrator/**}` consume only that bounded package surface
  - `smells::src/core/channel-setup/ChannelSetupFacetSnapshotLoader.ts::sort_no_comparator` -> `P6-W1-S2` -> stale-proven on current source after the same fresh objective scan; raw detector output from `desloppify detect smells --json` no longer lists `ChannelSetupFacetSnapshotLoader.ts`, and current source at `_buildSnapshotKey(...)` uses an explicit `localeCompare` comparator for `selectedLibraryIds`
  - `smells::src/core/channel-setup/ChannelSetupPlanner.ts::sort_no_comparator` -> `P6-W1-S2` -> stale-proven on current source after the same fresh objective scan; raw detector output from `desloppify detect smells --json` no longer lists `ChannelSetupPlanner.ts`, and current `stableStringify(...)` sorts object keys with an explicit `localeCompare` comparator
  - `smells::src/core/channel-setup/ChannelSetupTagFilters.ts::high_cyclomatic_complexity` -> `P6-W1-S2` -> stale-proven on current source after the same fresh objective scan; raw detector output from `desloppify detect smells --json` no longer lists `ChannelSetupTagFilters.ts`, and the fast-key parsing path is now split across `parseFastKeyQuery(...)`, `normalizeFastKeyEntry(...)`, and `parseFastKeyParam(...)` instead of one branch-heavy parser

## Priority-Exit Readiness

- This is the final planned `P6-W#` work item before `P6-EXIT`; no `P7-W1` implementation or closeout should start until `P6-EXIT` completes.
- Imported review issue disposition plan for `P6`:
  - `review::.::holistic::contract_coherence::channel_setup_port_absence_contract_split`
    - planned owner: `P6-W1-S4`
    - expected disposition: `retired`
    - current-source note: `ChannelSetupWorkflowPort`, `ChannelSetupWorkflow`, `createChannelSetupWorkflowPort`, and `ChannelSetupSessionController` already show the intended split on current source; `S4` must preserve that seam while retiring remaining UI/session residue and proving whether the detector row is stale or still partially live
  - `review::.::holistic::contract_coherence::channel_manager_error_contract_docs_lag_runtime`
    - planned owner: `P6-W1-S3`
    - expected disposition: `retired`
    - current-source note: runtime error propagation already routes through `ChannelError` / `AppErrorCode` plus `persistenceWarning` event seams; `S3` must prove docs/runtime alignment or make the narrow same-owner cleanup that remains
- Security gate:
  - expected disposition: no open `P0` security findings
  - exact `P0` security issue ids: none currently mapped during planning; `P6-EXIT` must rerun `desloppify show security --status open --no-budget --top 50` and record the result before any `P7` work starts
  - revisit trigger: if any `P0` row appears at `P6-EXIT`, `P7` remains blocked until that row is resolved or explicitly deferred with one final owner and revisit trigger
- Expected `P6-EXIT` proof:
  - rerun `desloppify status`
  - rerun `desloppify plan queue --sort recent`
  - rerun `desloppify show security --status open --no-budget --top 50`
  - rerun the five package-local scoping commands from `ARCHITECTURE_CLEANUP_CHECKLIST.md`
  - rerun `desloppify show "<issue_id>" --status open --no-budget --top 20` for every id listed under `package_issue_ids`
  - rerun the strongest package verification command used during `P6-W1`
  - update `ARCHITECTURE_CLEANUP_CHECKLIST.md` in the same pass with:
    - `P6-W1` mini-record completion details
    - `P6-EXIT` entry baseline, exit baseline, score delta, security triage, detector delta summary, and imported review dispositions
  - record a full proof matrix covering every `package_issue_id` with disposition (`resolved`, `stale-proven`, `deferred`, or `split follow-up`), exact evidence, final owner, and revisit trigger if anything remains open

## Verification Commands

- Verification classification: `broader integration/manual proof required`
- Why: this package spans core workflow logic, UI/session lifecycle, and runtime scheduler contracts. Focused Jest coverage is necessary but not sufficient; package completion still depends on `npm run verify`, manual focus/lifecycle proof, and authoritative integration-branch `desloppify` reruns.
- Plan/doc verification for this artifact:
  - Run: `npm run plans:check`
  - Expected: passes with this file recognized as the active `P6-W1` tracked plan
  - Run: `npm run verify:docs`
  - Expected: passes with the plan, checklist mini-record update, and companion-map refresh
- Execution-unit verification:
  - `P6-W1-S1`
    - Run: `npm test -- --runInBand src/core/channel-setup/__tests__/ChannelSetupBuildCommitter.test.ts src/core/channel-setup/__tests__/ChannelSetupBuildExecutor.test.ts src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts src/core/channel-setup/__tests__/ChannelSetupWorkflow.test.ts src/core/channel-setup/__tests__/createChannelSetupWorkflowPort.test.ts`
    - Expected: passes
    - Run: `npm run verify`
    - Expected: passes
  - `P6-W1-S2`
    - Run: `npm test -- --runInBand src/core/channel-setup/__tests__/ChannelSetupPlanner.test.ts src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoader.test.ts src/core/channel-setup/__tests__/ChannelSetupTagFilters.test.ts`
    - Expected: passes
    - Run: `npm run verify`
    - Expected: passes
  - `P6-W1-S3`
    - Run: `npm test -- --runInBand src/core/channel-tuning/__tests__/ChannelTuningCoordinator.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts src/modules/scheduler/channel-manager/__tests__/ContentResolver.test.ts src/modules/scheduler/scheduler/__tests__/ChannelScheduler.test.ts src/modules/scheduler/scheduler/__tests__/ScheduleCalculator.test.ts`
    - Expected: passes
    - Run: `npm run verify`
    - Expected: passes
  - `P6-W1-S4`
    - Run: `npm test -- --runInBand src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupSessionRuntime.test.ts src/modules/ui/channel-setup/steps/__tests__/BuildReviewStepController.test.ts src/modules/ui/channel-setup/steps/__tests__/LibraryStepController.test.ts src/modules/ui/channel-setup/steps/__tests__/StrategyStepController.test.ts src/modules/ui/channel-setup/steps/__tests__/StrategyStepInteractionController.test.ts`
    - Expected: passes
    - Run: `npm run verify`
    - Expected: passes
- Latest observed `P6-W1-S2` follow-up evidence on `2026-04-21`:
  - Run: `npm test -- --runInBand src/core/channel-setup/__tests__/ChannelSetupPlanner.test.ts src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoader.test.ts src/core/channel-setup/__tests__/ChannelSetupTagFilters.test.ts`
  - Expected: passes
  - Observed: passed on `code-health`
  - Run: `desloppify scan --profile objective --skip-slow --no-badge`
  - Expected: refreshes current scan state on `code-health` before the stale-proof rows above are recorded
  - Observed: refreshed current scan state before the stale-proof rows above were recorded
  - Run: `npm run plans:check`
  - Expected: passes with this file recognized as the active `P6-W1` tracked plan
  - Observed: passed after the doc-contract repair
  - Run: `npm run verify:docs`
  - Expected: passes with the repaired active-plan schema and priority-exit evidence
  - Observed: passed after the doc-contract repair
  - Run: `npm run verify`
  - Expected: passes once this active plan satisfies `verify:docs` and the workspace remains green on the same branch state
  - Observed: passed after the doc-contract repair on the same `code-health` branch state
- Latest observed `P6-W1-S4` direct-coverage closeout evidence on `2026-04-21`:
  - Run: `npm test -- --runInBand src/modules/ui/channel-setup/steps/__tests__/BuildReviewStepController.test.ts src/modules/ui/channel-setup/steps/__tests__/LibraryStepController.test.ts src/modules/ui/channel-setup/steps/__tests__/StrategyStepController.test.ts src/modules/ui/channel-setup/steps/__tests__/StrategyStepInteractionController.test.ts`
  - Expected: passes with direct-import proof on all four step controllers
  - Observed: passed `51/51` on `code-health`
  - Run: focused controller coverage on `src/modules/ui/channel-setup/steps/{BuildReviewStepController.ts,LibraryStepController.ts,StrategyStepController.ts,StrategyStepInteractionController.ts}`
  - Expected: demonstrates direct-source proof strong enough to adjudicate the lingering `transitive_only` rows
  - Observed: `BuildReviewStepController` `91.08 / 81.35 / 75`, `LibraryStepController` `91.17 / 80 / 75`, `StrategyStepController` `99.39 / 88.02 / 100`, and `StrategyStepInteractionController` `90.18 / 86.81 / 86.95`
  - Run: `desloppify scan --profile objective --skip-slow --no-badge`
  - Expected: refreshes current scan state before the final stale-proof matrix is recorded
  - Observed: refreshed current scan state, but all four `test_coverage::...::transitive_only` ids still reran open with stale “No direct tests” wording
  - Run: `npm run verify`
  - Expected: passes on the same branch state as the direct-coverage closeout
  - Observed: passed after the clean `S4` review gate on the same `code-health` branch state
- Manual proof required during UI slice and before `P6-EXIT`:
  - show the Channel Setup screen from the lazy-screen path and confirm the first-focus target is stable
  - step through libraries -> strategy -> review -> build/cancel paths and confirm preview/review/build abort/timer cleanup on hide/back
  - confirm dropdown/back behavior and priority-row focus behavior still work with D-pad navigation
  - confirm no EPG-side regression is introduced when channel-setup build applies or when channel switching happens after scheduler/tuning cleanup

## Rollback Notes

- Roll back in reverse slice order if parity breaks: `S4` UI/session cleanup first, then `S3` tuning/scheduler work, then `S2` planning/facet cleanup, then `S1` build/workflow cleanup.
- If `S1` regresses preview/review/build behavior, revert workflow/build files and their tests together so the old error-handling path remains internally consistent.
- If `S3` regresses channel switching or scheduler/runtime behavior, revert tuning/scheduler/channel-manager files together rather than leaving a mixed old/new contract.
- If `S4` regresses lazy-screen focus or hidden-state cleanup, revert UI/session/step files together so focus/timer/abort behavior stays aligned.

## Commit Checkpoints

- Keep this active plan doc out of implementation commits.
- Suggested implementation checkpoints:
  - checkpoint 1: `P6-W1-S1` channel-setup build/workflow resilience
  - checkpoint 2: `P6-W1-S2` planning/facet/tag determinism cleanup
  - checkpoint 3: `P6-W1-S3` channel-tuning plus scheduler/channel-manager contract audit/cleanup
  - checkpoint 4: `P6-W1-S4` UI/session/step cleanup plus direct coverage
- After each checkpoint, run the slice-targeted tests plus `npm run verify` before asking for review.

MODEL_SUGGESTION
PLANNER: gpt-5.4 high
IMPLEMENTER: gpt-5.3-codex high
REVIEWER: gpt-5.4 high
WHY: Tier 3 checklist-linked package work spanning core workflow owners, TV-facing UI/session cleanup, and scheduler runtime contracts with a required stale-proof no-drop exit review.

CURRENT_EXECUTION_PACKET
UNIT: P6-EXIT
FILES_IN_SCOPE:
- ARCHITECTURE_CLEANUP_CHECKLIST.md
- docs/architecture/active-cleanup-package-map.json
- docs/plans/2026-04-21-p6-w1-channel-setup-scheduler-contracts.md
FILES_OUT_OF_SCOPE:
- src/modules/ui/epg/**
- src/core/orchestrator/**
- src/core/app-shell/**
- docs/plans/2026-04-21-p7-w1-epg-runtime-surfaces.md
CONSTRAINTS:
- do not reopen implementation on the four step controllers; treat their rerun-open `transitive_only` rows as stale-proven detector wording unless current-source proof changes
- keep the checklist proof matrix aligned with the refreshed 41-row companion-map membership and do not re-home any survivor outside `P6-W1`/`P6-EXIT`
- prepare the package-exit review surface only; do not start `P7-W1` implementation before the closeout review lands
VERIFICATION:
- desloppify status
- desloppify plan queue --sort recent
- desloppify show review --status open --no-budget --top 100
- desloppify show security --status open --no-budget --top 50
- desloppify show src/core/channel-setup --status open --no-budget --top 150
- desloppify show src/core/channel-tuning --status open --no-budget --top 100
- desloppify show src/modules/scheduler/channel-manager --status open --no-budget --top 150
- desloppify show src/modules/scheduler/scheduler --status open --no-budget --top 150
- desloppify show src/modules/ui/channel-setup --status open --no-budget --top 150
- npm run plans:check
- npm run verify:docs
STOP_AND_REPLAN_IF:
- fresh reruns show new same-owner rows outside the refreshed package membership
- the package-exit review rejects the stale-proof matrix for any mapped survivor and requires new current-source implementation proof

NEXT_SESSION_HANDOFF
NEXT_SESSION_LAUNCHER: lineup-cleanup-review
TASK: P6-W1 / P6-EXIT Channel Setup And Scheduler Contracts closeout
TASK_FAMILY: cleanup/refactor
TIER: Tier 3
PLAN: docs/plans/2026-04-21-p6-w1-channel-setup-scheduler-contracts.md
ARTIFACT: P6-W1 checklist update and P6-EXIT proof/disposition closeout
FILES:
- docs/plans/2026-04-21-p6-w1-channel-setup-scheduler-contracts.md
- ARCHITECTURE_CLEANUP_CHECKLIST.md
- docs/architecture/active-cleanup-package-map.json
- src/modules/ui/channel-setup/steps/__tests__/BuildReviewStepController.test.ts
- src/modules/ui/channel-setup/steps/__tests__/LibraryStepController.test.ts
- src/modules/ui/channel-setup/steps/__tests__/StrategyStepController.test.ts
- src/modules/ui/channel-setup/steps/__tests__/StrategyStepInteractionController.test.ts
BLOCKERS: none
MESSAGE:
Review `P6-W1` / `P6-EXIT` closeout for `docs/plans/2026-04-21-p6-w1-channel-setup-scheduler-contracts.md`. Treat the four step-controller `transitive_only` rows as stale-proven detector wording on current source unless the recorded direct-import suites and focused coverage no longer hold, verify the refreshed 41-row package proof matrix and current-source stale-proof arguments for the remaining channel-setup/channel-tuning detector rows, and confirm `ARCHITECTURE_CLEANUP_CHECKLIST.md` is ready to hand off from `P6-EXIT` to `P7-W1` without another implementation pass.
