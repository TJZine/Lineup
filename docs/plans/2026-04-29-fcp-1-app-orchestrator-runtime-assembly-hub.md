**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

# FCP-1 AppOrchestrator Runtime Assembly Hub Package Plan

## Goal

Execute the next `FCP-1` package by narrowing the concrete `AppOrchestrator` priority-one runtime assembly handoff. The canonical source finding remains `FCP-1-SF4`; this plan scopes that broad hub finding to the priority-one runtime assembly sub-scope proven by source audit: `AppOrchestrator._initializePriorityOneControllers()` still owns broad priority-one controller/binder assembly input shaping even though `src/core/orchestrator/priority-one/` is the documented runtime assembly owner.

This plan authorizes one coherent handoff extraction only. It does not authorize a broad `AppOrchestrator` rewrite.

## Non-Goals

- Do not redesign startup sequencing, shutdown sequencing, event binding semantics, profile-switch cleanup behavior, playback start/runtime behavior, overlay policy, schedule-day rollover, subtitle-track recovery, or selected-server/channel-setup flows.
- Do not move `OrchestratorModuleFactory`, `OrchestratorCoordinatorAssembly`, `OrchestratorRuntimeControllerBuilder`, or `InitializationCoordinator` responsibilities unless a stop/replan trigger fires.
- Do not split this into tiny callback-by-callback fixes.
- Do not introduce adapter shims that merely move the same hub object into a sibling file without a durable priority-one owner contract.
- Do not close the accepted `src/modules/ui/channel-setup/ChannelSetupSessionState.ts` normalization residual unless implementation explicitly addresses or accepts it through source-backed review.
- Do not use Desloppify output, imported issue ids, package maps, score deltas, or detector evidence for intake, proof, prioritization, or closure.

## Parent Priority Alignment

Checklist token: `FCP-1`

This package advances architecture and handoff coherence by moving one source-backed runtime assembly responsibility out of the central orchestrator hotspot and into the documented priority-one runtime assembly owner. `FCP-1-SF1`, `FCP-1-SF2`, and `FCP-1-SF3` are already resolved. This plan is intended to be the final source-change package for `FCP-1` only if review agrees that the remaining SF4 audited areas are accepted/no-action and the channel-setup normalization residual has a clean final disposition.

`FCP-1` must not be marked complete until plan review, implementation or no-action review, verification evidence, residual owner disposition, and closeout review are clean.

## Required Reading

1. `agents.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/cleanup-loop.md`
4. `docs/agentic/plan-authoring-standard.md`
5. `docs/architecture/CURRENT_STATE.md`
6. `docs/architecture/modules.md`
7. `ARCHITECTURE_CLEANUP_CHECKLIST.md`
8. `docs/plans/2026-04-29-fcp-1-architecture-handoff-audit.md`
9. `src/core/orchestrator/AppOrchestrator.ts`
10. `src/core/orchestrator/priority-one/PriorityOneAssemblyBuilder.ts`
11. `src/core/orchestrator/priority-one/PriorityOneAssemblyInput.ts`
12. `src/core/orchestrator/priority-one/PriorityOneControllerFactory.ts`
13. `src/core/orchestrator/priority-one/PriorityOneControllerCollaborators.ts`
14. `src/core/orchestrator/OrchestratorRuntimeSeams.ts`
15. `src/core/orchestrator/OrchestratorRuntimeControllerBuilder.ts`
16. `src/core/orchestrator/OrchestratorCoordinatorAssembly.ts`
17. `src/core/initialization/InitializationCoordinator.ts`
18. `src/core/orchestrator/__tests__/PriorityOneControllerCollaborators.test.ts`
19. `src/core/orchestrator/__tests__/PriorityOneControllerFactory.playbackState.test.ts`
20. `src/__tests__/Orchestrator.test.ts`

Freshness gate: if any listed source file materially changed after this plan was written, rerun the SF4 source audit and update this plan before implementation.

## Required Skills

- `architecture-boundaries`: this touches the central orchestrator hotspot and priority-one runtime assembly ownership.
- `verification-strategy`: verification mode and proof surface are fixed before implementation.
- `execution-plan-authoring`: serious tracked cleanup plan with FCP source-backed coverage.

## Codanna Discovery

- `get_index_info`: Codanna was available with 11129 symbols across 696 files; semantic search enabled; embeddings created/updated 18 minutes before the planning pass.
- `semantic_search_with_context`: query `AppOrchestrator runtime assembly hub priority one initialization` returned six results but weak scores. The top useful hits were `AppOrchestrator` fields, with unrelated settings/channel-setup noise. Query `PriorityOneAssemblyBuilder broad runtime assembly input AppOrchestrator` was also weak/noisy and did not reliably identify exact package membership.
- `search_documents`: query `FCP-1 AppOrchestrator runtime assembly hub` returned relevant `CURRENT_STATE.md`, `modules.md`, and prior plan context, with a lock-busy auto-sync warning.
- `find_symbol`: `AppOrchestrator` resolved to `src/core/orchestrator/AppOrchestrator.ts:261-2449`. `search_symbols` found `OrchestratorModuleFactoryDeps`, `OrchestratorRuntimeControllerBuilderInput`, `PriorityOneAssemblyBuilderInput`, `OrchestratorCoordinatorAssemblyInput`, `InitializationCoordinator`, and `_buildCoordinatorAssemblyInput`.
- `analyze_impact`: `AppOrchestrator` reported only five impacted field symbols, which is too shallow for a central runtime hub. Treat impact output as incomplete for membership.
- Deterministic fallback: direct `sed`, `wc -l`, and `rg` reads were used for the final package decision and are part of the source evidence.

No external documentation was needed.

## Impact Snapshot

Source evidence for `FCP-1-SF4`:

- `src/core/orchestrator/AppOrchestrator.ts` is still 2449 lines and `_initializePriorityOneControllers()` constructs the full priority-one assembly input inline before calling `createPriorityOneAssembly()` and `createPriorityOneControllersAndBinder()`.
- `src/core/orchestrator/priority-one/PriorityOneAssemblyBuilder.ts` already owns `PriorityOneAssemblyBuilderInput -> PriorityOneAssemblyInput` grouping, but it currently receives the already-shaped broad object from `AppOrchestrator`.
- `src/core/orchestrator/priority-one/PriorityOneControllerFactory.ts` and `PriorityOneControllerCollaborators.ts` already own controller/binder construction and downstream collaborator dependency mapping. The live source issue is not inside those collaborators; it is the upstream assembly handoff still living in `AppOrchestrator`.
- `src/core/orchestrator/OrchestratorRuntimeControllerBuilder.ts` is a focused 71-line owner for schedule-day rollover and subtitle-track recovery construction; leave it accepted/no-action unless implementation proves a direct priority-one dependency.
- `src/core/orchestrator/OrchestratorCoordinatorAssembly.ts`, `OrchestratorModuleFactory.ts`, and `src/core/initialization/InitializationCoordinator.ts` are already documented owners for their respective assembly/startup seams. They are evidence context, not implementation targets.

Chosen owner seam:

- `AppOrchestrator` should keep top-level lifecycle, module field ownership, precondition checks, assignment of returned controllers, and the startup call order.
- `src/core/orchestrator/priority-one/` should own priority-one runtime assembly shaping from orchestrator-provided runtime refs/callbacks into `PriorityOneAssemblyInput`, and should continue to own controller/binder construction.
- The extraction must reduce the broad runtime assembly object inside `AppOrchestrator`; it must not simply rename `_initializePriorityOneControllers()` in another file while preserving the same hub responsibility.

## Files In Scope

- `src/core/orchestrator/AppOrchestrator.ts`
- `src/core/orchestrator/priority-one/PriorityOneAssemblyBuilder.ts`
- `src/core/orchestrator/priority-one/PriorityOneAssemblyInput.ts`
- `src/core/orchestrator/priority-one/PriorityOneControllerFactory.ts`
- `src/core/orchestrator/priority-one/PriorityOneControllerCollaborators.ts`, only if the chosen priority-one owner contract requires local type alignment
- `src/core/orchestrator/OrchestratorRuntimeSeams.ts`
- A new focused file under `src/core/orchestrator/priority-one/` if the implementer needs a durable owner for priority-one runtime assembly from orchestrator refs/callbacks
- `src/core/orchestrator/__tests__/PriorityOneControllerCollaborators.test.ts`
- `src/core/orchestrator/__tests__/PriorityOneControllerFactory.playbackState.test.ts`
- A new or updated priority-one assembly test under `src/core/orchestrator/__tests__/`
- `src/__tests__/Orchestrator.test.ts`, only for app-level startup/event-binding invariant coverage
- `docs/architecture/CURRENT_STATE.md` and `docs/architecture/modules.md`, only if source ownership wording changes
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` and `docs/plans/2026-04-29-fcp-1-architecture-handoff-audit.md` after implementation/review for same-pass accounting

## Files Out Of Scope

- `src/core/orchestrator/OrchestratorModuleFactory.ts`
- `src/core/orchestrator/OrchestratorCoordinatorAssembly.ts`
- `src/core/orchestrator/OrchestratorCoordinatorContracts.ts`, except for compile-only type impact if a local priority-one type extraction requires a narrow import correction
- `src/core/orchestrator/OrchestratorRuntimeControllerBuilder.ts`
- `src/core/initialization/InitializationCoordinator.ts`
- `src/core/server-selection/**`
- `src/core/channel-setup/**`
- `src/modules/ui/channel-setup/**`, except the known residual disposition in closeout docs/review
- Plex, scheduler, player, navigation, EPG, settings, app-shell, lifecycle, and platform behavior files not named in scope
- Archived package maps, Desloppify data, imported issue maps, score artifacts, or detector outputs

## Planner Self-Check

1. Unresolved ownership seam? No. The implementation seam is priority-one runtime assembly input shaping currently inline in `AppOrchestrator`.
2. Adjacent contract changes hidden out of scope? No. Runtime controller, coordinator assembly, initialization, server-selection, and channel-setup behavior are frozen unless a stop/replan trigger fires.
3. Out-of-scope files implicitly relied on? They are evidence and compile/test surfaces only. They are not planned edit targets.
4. Codanna evidence path recorded? Yes, including weak semantic/impact results and deterministic fallback reads.
5. Repo-preferred owner? Yes. The chosen owner is the existing `src/core/orchestrator/priority-one/` assembly package, not a new generic utility or sibling hub.
6. Fresh-session ambiguity? No. The plan names the seam, files, invariants, source finding, execution unit, verification, and stop/replan triggers.
7. Execution-grade? Yes for the priority-one runtime assembly sub-scope of `FCP-1-SF4`. It deliberately rejects a broad `AppOrchestrator` rewrite.

## Architecture Seam Decision Gate

Chosen seam: extract priority-one runtime assembly input shaping out of `AppOrchestrator._initializePriorityOneControllers()` and into a durable owner under `src/core/orchestrator/priority-one/`. `AppOrchestrator` may still validate required runtime modules, guard idempotence/reentrancy, call the priority-one owner, and assign the returned controllers/binder.

The priority-one owner must own the mapping from orchestrator-provided runtime refs/callbacks to `PriorityOneAssemblyInput`. `AppOrchestrator` should no longer build the full object passed to `createPriorityOneAssembly()` inline.

Preservation contracts:

- `initialize()` order remains: module factory, storage key configuration, startup UI initializer, `InitializationCoordinator`, coordinator assembly, stale channel build cleanup, priority-one controller initialization, error handler registration, then event-emitter module status.
- Priority-one initialization remains idempotent and reentrancy-safe. Existing `_eventBinder` and `_priorityOneControllersInitializing` guards must remain effective.
- Event binding still occurs through `InitializationCoordinator` calling `setupEventWiring()` and `this._requireEventBinder().bind()`; controller creation must not bind listeners early.
- Shutdown still disposes schedule-day rollover before event binder, records teardown failures, destroys overlays/modules in the current order, and clears priority-one fields.
- Profile switch cleanup still prepares/finalizes around auth/profile mutation and preserves startup-resume restore behavior on failure.
- Player state, time update, buffer update, track-change, Plex auth/stream error, screen-change, persistence warning, transcode-stop warning, and now-playing warning routes remain behaviorally identical.
- Schedule-day rollover and subtitle-track recovery construction remain owned by `OrchestratorRuntimeControllerBuilder` unless a replan explicitly widens scope.

Stop and replan if:

- The extraction requires editing `InitializationCoordinator`, `OrchestratorRuntimeControllerBuilder`, `OrchestratorCoordinatorAssembly`, server-selection, channel-setup, Plex, scheduler, player, navigation, or EPG behavior files.
- The proposed owner receives the entire `AppOrchestrator` instance, reads private fields indirectly through `any`, or creates a generic orchestrator service locator.
- The implementation needs compatibility fallbacks, duplicate event binding, duplicate controller ownership, or new public runtime exports.
- Targeted tests show listener/timer cleanup, startup, profile-switch, playback, or overlay behavior changed.
- The channel-setup normalization residual is claimed closed without source-backed owner disposition.

## Package Decomposition

- `package_id`: `fcp-1-app-orchestrator-runtime-assembly-hub`
- `checklist_token`: `FCP-1`
- `source_finding_ids`:
  - `FCP-1-SF1`
  - `FCP-1-SF2`
  - `FCP-1-SF3`
  - `FCP-1-SF4`
- `slice_table`:

### `FCP-1-S3` Priority-One Runtime Assembly Owner Extraction

- `goal`: move priority-one runtime assembly input shaping out of `AppOrchestrator._initializePriorityOneControllers()` and into a durable `src/core/orchestrator/priority-one/` owner while preserving startup, event-binding, playback, overlay, profile-switch, listener/timer, and error-reporting behavior.
- `areas/files`: `src/core/orchestrator/AppOrchestrator.ts`, priority-one assembly/controller files, `OrchestratorRuntimeSeams.ts`, targeted priority-one/orchestrator tests, architecture docs only if ownership wording changes, and checklist/audit docs after clean implementation review.
- `source_finding_ids`:
  - `FCP-1-SF4`
- `verification`: source audits proving the inline priority-one assembly object left `AppOrchestrator`, targeted priority-one assembly/controller tests, targeted orchestrator startup/event-binding tests, `npm run verify`, and `npm run verify:docs` for docs/control-plane updates.
- `dependencies`: `FCP-1-SF1`/`FCP-1-SF2` resolved by commit `75b59c4f`; `FCP-1-SF3` resolved by commits `23effad7` and `2326562f`; `ChannelSetupSessionState.ts` normalization residual must remain owned in final closeout accounting.
- `stop_condition`: stop if implementation widens beyond priority-one assembly shaping, changes runtime behavior, edits frozen adjacent owners, or moves hub responsibility sideways.
- `handoff_condition`: `AppOrchestrator` no longer builds the full priority-one assembly input inline; priority-one owner contract is protected by tests; runtime verification passes; FCP-1 audit/checklist record final `FCP-1-SF4` disposition plus the channel-setup residual owner.
- `serial_only`: true
- `parallel_justification`: single hotspot/runtime assembly seam. Parallel edits would create dependent partial states across app-level guards, priority-one contracts, and tests.

- `coverage_check`:
  - `FCP-1-SF1`: completed by prior slice `FCP-1-S1`; final owner: app-shell runtime contract owner; closure check: app-shell/server-select no longer consumes the full core selected-server result and completed verification remains recorded in the audit/checklist.
  - `FCP-1-SF2`: completed by prior slice `FCP-1-S1`; final owner: architecture docs owner; closure check: current architecture docs distinguish full core selected-server result ownership from narrowed app-shell/server-select ownership.
  - `FCP-1-SF3`: completed by prior slice `FCP-1-S2`; final owner: channel setup UI/core boundary owner; closure check: channel setup screen wiring no longer exposes the full core workflow port, with the normalization residual explicitly owned.
  - `FCP-1-SF4`: `FCP-1-S3`; final owner: priority-one runtime assembly owner; closure check: `AppOrchestrator._initializePriorityOneControllers()` no longer shapes the full priority-one assembly object inline, the new or existing priority-one owner owns that mapping, tests prove the startup/event-binding and priority-one runtime routes, and no adjacent owner was widened.
- `ready_now_slice`: `FCP-1-S3`
- `ready_now_execution_unit`: `FCP-1-S3`
- `recommended_slice_order`:
  1. `FCP-1-S3`
- `parallel_execution_policy`: Parallel execution is unavailable. This plan authorizes only `FCP-1-S3`; any broader `AppOrchestrator`, initialization, runtime-controller, server-selection, channel-setup, Plex, player, scheduler, navigation, or EPG work requires replan.

## Verification Commands

- Primary verification mode: `contract-first`
- Verification classification: `new regression/contract test required`

Required source audits after implementation:

- Run: `rg -n "createPriorityOneAssembly\\(|createPriorityOneControllersAndBinder\\(|nowPlayingModalId|wireNavigationCoordinatorEvents|wireEpgCoordinatorEvents" src/core/orchestrator/AppOrchestrator.ts src/core/orchestrator/priority-one`
- Expected: `AppOrchestrator.ts` does not contain the full priority-one assembly input object or direct `createPriorityOneAssembly()` call. Priority-one owner files contain the assembly mapping and controller/binder call. `AppOrchestrator.ts` may still call one priority-one owner function and assign returned controllers.

- Run: `rg -n "_priorityOneControllersInitializing|_eventBinder|_assignPriorityOneControllers|_requireEventBinder\\(\\)\\.bind" src/core/orchestrator/AppOrchestrator.ts`
- Expected: idempotence/reentrancy guards, field assignment, and deferred event binding through `_requireEventBinder().bind()` remain visible in `AppOrchestrator`.

- Run: `rg -n "new InitializationCoordinator|createOrchestratorRuntimeControllers|createOrchestratorCoordinators|createOrchestratorModules" src/core/orchestrator/AppOrchestrator.ts`
- Expected: source still shows the same startup assembly order. Any changed order must have explicit test proof and review approval.

Required targeted tests:

- Run: `npm run test:unit -- src/core/orchestrator/__tests__/PriorityOneControllerCollaborators.test.ts src/core/orchestrator/__tests__/PriorityOneControllerFactory.playbackState.test.ts src/core/orchestrator/__tests__/OrchestratorRuntimeSeams.test.ts --runInBand`
- Expected: all named suites pass.

- Run: the new or updated priority-one assembly test by path with `npm run test:unit -- <path> --runInBand`.
- Expected: the test proves priority-one assembly owner routes at least track-change, program-start UI side effects, transcode-stop warning/error path, event binder cleanup reporter, and now-playing modal id through the extracted contract without app-level object shaping.

- Run: `npm run test:unit -- src/__tests__/Orchestrator.test.ts --runInBand`
- Expected: orchestrator startup/event-binding/profile-switch/shutdown coverage remains green, including the existing proof that coordinator assembly receives the real `InitializationCoordinator.ensureEPGInitialized()` path before event binding.

Required full runtime gate:

- Run: `npm run verify`
- Expected: pass, because this is Orchestrator/runtime source work.

Required docs/control-plane gate after checklist, audit, plan, or architecture docs are updated:

- Run: `npm run verify:docs`
- Expected: pass.

Why this proof depth matches risk: the change is structural but crosses the central runtime composition boundary. A contract test is required to prevent the broad priority-one assembly handoff from returning to `AppOrchestrator`; targeted orchestrator tests protect startup/event-binding behavior; `npm run verify` catches broader runtime regressions.

## Rollback Notes

Rollback the `AppOrchestrator` priority-one initialization edits, priority-one owner extraction, and targeted tests together. Do not leave architecture docs or the FCP-1 audit claiming `FCP-1-SF4` was resolved unless source audits and targeted tests landed in the same implementation pass.

If implementation widened into `InitializationCoordinator`, `OrchestratorRuntimeControllerBuilder`, `OrchestratorCoordinatorAssembly`, server-selection, channel-setup, Plex, scheduler, player, navigation, or EPG behavior, revert those edits first and replan.

## Commit Checkpoints

1. `refactor(fcp-1): extract priority-one runtime assembly owner`
   - priority-one owner extraction, `AppOrchestrator` call-site slimming, and targeted tests.
2. `docs(fcp-1): record app orchestrator assembly disposition`
   - architecture docs if ownership wording changed, plus audit/checklist proof matrix after clean implementation review.

Active tracked plan docs should stay out of delegated implementation commits unless the controller explicitly owns a separate docs checkpoint.

## Priority-Exit Readiness

This plan is intended to be the last planned `FCP-1` source package only if implementation/review confirms the priority-one runtime assembly sub-scope satisfies `FCP-1-SF4` and accepted/no-action dispositions for the other audited SF4 areas remain valid.

- `FCP-1-SF1`
  - disposition: resolved
  - final owner: `FCP-1`
  - revisit trigger: rerun the source audit if app-shell/server-select selected-server result ownership changes
- `FCP-1-SF2`
  - disposition: resolved
  - final owner: `FCP-1`
  - revisit trigger: rerun the source audit if architecture docs or selected-server handoff ownership changes
- `FCP-1-SF3`
  - disposition: resolved
  - final owner: `FCP-1`
  - revisit trigger: rerun the source audit if channel setup screen/session workflow-port ownership changes
- `FCP-1-SF4`
  - disposition: resolved
  - final owner: priority-one runtime assembly owner
  - revisit trigger: rerun the source audit if `AppOrchestrator` regains priority-one assembly shaping or another concrete runtime assembly handoff is found before closeout

Residual owner disposition:

- `src/modules/ui/channel-setup/ChannelSetupSessionState.ts` still imports `normalizeChannelSetupConfig` from core planning. Final owner remains the channel setup UI/core boundary owner unless this plan's closeout review explicitly accepts a different source-backed disposition. Revisit trigger: before any `FCP-1` closeout claim or earlier if setup record hydration/normalization ownership changes.

Priority exit requirements:

- security triage: no open P0 security findings
- update `docs/plans/2026-04-29-fcp-1-architecture-handoff-audit.md` with final `FCP-1-SF4` disposition, accepted/no-action SF4 areas, verification evidence, and residual owner.
- update the `FCP-1` mini-record in `ARCHITECTURE_CLEANUP_CHECKLIST.md`.
- run the package source audit and static audits listed in this plan.
- run targeted tests and `npm run verify`.
- run `npm run verify:docs` after tracked docs are updated.
- run clean adversarial implementation review and clean FCP-1 closeout review.
- priority-exit review blocks FCP-(n+1), including `FCP-2`, until FCP-n is completed with source-finding proof matrix, clean priority-exit review, verification evidence, and owned follow-ups recorded.

## Current-Unit Execution Packet

execution_unit: `FCP-1-S3`

files_in_scope: `src/core/orchestrator/AppOrchestrator.ts`, `src/core/orchestrator/priority-one/PriorityOneAssemblyBuilder.ts`, `src/core/orchestrator/priority-one/PriorityOneAssemblyInput.ts`, `src/core/orchestrator/priority-one/PriorityOneControllerFactory.ts`, `src/core/orchestrator/priority-one/PriorityOneControllerCollaborators.ts` only if needed, `src/core/orchestrator/OrchestratorRuntimeSeams.ts`, targeted priority-one/orchestrator tests, architecture docs only if ownership wording changes, FCP-1 audit/checklist docs after implementation review.

files_out_of_scope: `OrchestratorModuleFactory.ts`, `OrchestratorCoordinatorAssembly.ts`, `OrchestratorRuntimeControllerBuilder.ts`, `InitializationCoordinator.ts`, server-selection, channel-setup source, Plex, scheduler, player, navigation, EPG, app-shell, lifecycle, platform behavior files, detector/package-map artifacts.

constraints: extract one priority-one runtime assembly owner; preserve startup/shutdown/listener/timer/error handling invariants; add or strengthen a contract test for the owner seam; no broad rewrite; no service locator; no compatibility branch.

verification: run the source audits, targeted priority-one/orchestrator tests, `npm run verify`, and `npm run verify:docs` after docs updates.

stop_and_replan_if: any adjacent owner must change, behavior changes are needed, source audits show the hub was only moved sideways, verification scope widens materially, or residual accounting changes.
