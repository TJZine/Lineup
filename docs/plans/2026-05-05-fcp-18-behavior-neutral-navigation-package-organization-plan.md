**Plan Status:** completed
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

# FCP-18 Behavior-Neutral Navigation Package Organization Plan

## Goal

Retire exactly `ARCHITECTURE_CLEANUP_CHECKLIST.md` item `FCP-18` by closing `FCP-18-SF1`: the navigation package flat folder mixes input routing, effects, repeat policy, contracts, and managers.

This is an `FCP-*` source-backed cleanup package. Coverage is defined only by checklist `source_finding_id` value `FCP-18-SF1`; do not use Desloppify, detector ids, imported review ids, package-map ids, stale hotspot wording, line count, score output, fresh post-FCP verification, or retrospective subjective review as intake, proof, or closeout.

Completion means `src/modules/navigation/` is organized around current focused owners without changing navigation behavior, public exports, focus policy, remote input routing, repeat timing, modal/screen effects, channel-number input behavior, or runtime contracts. The existing `src/modules/navigation/index.ts` package seam may be updated to point at moved owners, but no new compatibility shim, old-path re-export file, subfolder barrel, root barrel, or widened export may be added.

## Non-Goals

- Do not implement production or test code from this planning pass.
- Do not reopen completed `FCP-7` through `FCP-17`, start `FCP-19`, `FCP-20`, `FCP-EXIT`, Windows port work, Plex stream organization, Orchestrator cleanup, navigation behavior redesign, or broader post-FCP cleanup.
- Do not change navigation input routing, key repeat timing, long-press behavior, channel-number input buffering, focus movement, focus restoration, modal stack behavior, screen stack behavior, pointer mode, cursor hide timing, recoverable async failure reporting, toast behavior, or existing navigation events.
- Do not change UI/focus-visible behavior, screens, overlays, ARIA, CSS, Plex behavior, scheduler behavior, persistence/storage behavior, platform key maps, or app-shell/orchestrator runtime behavior except for import-path updates required by file moves.
- Do not add fallback branches, compatibility re-export shims at old file paths, new package/root barrels, subfolder barrels, public export widening, new dependencies, speculative generic utilities, or private-probe-only tests.

## Parent Priority Alignment

`FCP-18` is the next safe package after completed `FCP-17`. The checklist marks `FCP-17` completed with no follow-ups and states `FCP-19` or later, `FCP-EXIT`, Windows port work, and other post-FCP cleanup must wait for clean `FCP-18` closeout evidence.

Current architecture docs identify `src/modules/navigation/` as the owner for remote handling, focus/navigation flow, and navigation coordination. `NavigationManager.ts` owns navigation state, screen stack, modal stack, and focus operations, and delegates low-level key routing and timing behavior to `NavigationRemoteInputRouter`, `NavigationDirectionalRepeatController`, and `NavigationChannelNumberInputController`. `NavigationFeaturePorts.ts` consumes the shared `ChannelSwitchOutcome` owner from `src/types/channelSwitch.ts`.

The approved seam is behavior-neutral package organization only. The package may regroup existing navigation files under focused subfolders and update import paths. It must not create new behavior owners, change public contracts, or move navigation policy into UI, Plex, scheduler, app-shell, orchestrator, platform, or persistence owners.

## Required Reading

Read in this order before implementation or review:

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/README.md` routing table
4. `docs/agentic/session-prompts/cleanup-loop.md`
5. `docs/agentic/plan-authoring-standard.md`, especially Universal Plan Core, Cleanup Overlay, and FCP Source-Backed Checklist Override
6. `docs/agentic/codanna-playbook.md`
7. `ARCHITECTURE_CLEANUP_CHECKLIST.md` sections `FCP Operating Rules`, `FCP-17`, and `FCP-18`
8. `docs/architecture/CURRENT_STATE.md`
9. `docs/architecture/modules.md`
10. Completed guardrail plans only:
    - `docs/plans/2026-05-02-fcp-7-boundary-type-hygiene-plan.md`
    - `docs/plans/2026-05-02-fcp-8-api-plex-error-contract-coherence-plan.md`
    - `docs/plans/2026-05-02-fcp-9-source-signal-convention-local-elegance-plan.md`
    - `docs/plans/2026-05-02-fcp-10-epg-renderer-direct-confidence-presentation-decomposition-plan.md`
    - `docs/plans/2026-05-02-fcp-11-runtime-owner-reduction-hotspots-plan.md`
    - `docs/plans/2026-05-02-fcp-12-package-organization-structure-navigation-final-exit-plan.md`, especially the no-shim package-organization guardrails
    - `docs/plans/2026-05-05-fcp-13-low-risk-source-signal-api-export-diagnostic-closure-plan.md`
    - `docs/plans/2026-05-05-fcp-14-priority-one-forwarding-assembly-seam-plan.md`
    - `docs/plans/2026-05-05-fcp-15-plexauth-home-profile-status-helper-boundary-plan.md`
    - `docs/plans/2026-05-05-fcp-16-scheduler-current-channel-channelmanager-persistence-semantics-plan.md`
    - `docs/plans/2026-05-05-fcp-17-contentresolver-cache-coalescing-mapping-boundaries-plan.md`
11. This plan
12. `src/modules/navigation/*`
13. `src/modules/navigation/__tests__/*`
14. Navigation-related imports/tests discovered by current source audit, especially `src/core/orchestrator/assembly/OrchestratorCoordinatorBuilders.ts`, `src/core/orchestrator/AppOrchestrator.ts`, `src/core/orchestrator/__tests__/OrchestratorCoordinatorBuilders.test.ts`, `src/core/orchestrator/__tests__/OrchestratorCoordinatorAssembly.test.ts`, and `src/__tests__/Orchestrator.test.ts`
15. `git status --short --branch`

Freshness gate: stop and refresh this plan if any `FCP-18` checklist text, navigation architecture ownership text, source files in scope, tests in scope, or public navigation export/contract text changed materially after 2026-05-05.

Planning observed branch `code-health...origin/code-health [ahead 4]` with unrelated dirty/untracked paths: `docs/archive/plans/2026-04-30-dcr-10-oversized-test-suite-structure.md`, `docs/plans/2026-04-30-dcr-exit-final-dimension-audit-plan.md`, `scorecard.png`, and `docs/agentic/evals/baseline-summaries/2026-04-28-prompt-13-feature-low-implementer-policy.md`. Preserve those paths unless a fresh source audit proves direct `FCP-18` overlap.

## Required Skills

- `architecture-boundaries`: required because this package reorganizes a module boundary, public package seam, and cross-module import paths.
- `verification-strategy`: required to freeze behavior-preserving proof depth for navigation folder organization.
- `execution-plan-authoring`: required for Tier 3 source-backed FCP package planning.

Do not load `ui-composition-patterns` unless source audit unexpectedly proves behavior-visible screen, overlay, focus-flow, motion, ARIA, or TV-visible UI changes are truly needed. That should normally stop and replan because `FCP-18` is behavior-neutral folder organization only.

Do not load `persistence-boundaries`, `plex-integration-boundaries`, or `debugging-remediation` unless source audit unexpectedly proves storage-backed state, Plex auth/discovery/library/stream behavior, or a concrete navigation bug/regression is implicated. That discovery should normally stop and replan because those boundaries are out of scope for `FCP-18`.

## Codanna Discovery

- `get_index_info`: Codanna available with 12,126 symbols across 802 files; 14,845 relationships; semantic search enabled with `JinaEmbeddingsV2BaseCode`; 338 embeddings; created and updated about 1 hour before this planning pass.
- `search_documents "FCP-18 navigation package organization source finding flat folder input routing effects repeat policy contracts managers"`: returned noisy unrelated docs and did not return the checklist as authoritative. Direct reads of `ARCHITECTURE_CLEANUP_CHECKLIST.md`, current architecture docs, and completed FCP guardrail plans are the deterministic membership and sequencing source.
- `search_documents "CURRENT_STATE Navigation owns remote handling focus navigation coordination NavigationManager delegates input router repeat controller channel number controller"`: returned noisy unrelated docs and did not locate the architecture truth. Direct reads of `docs/architecture/CURRENT_STATE.md` and `docs/architecture/modules.md` are the fallback.
- `semantic_search_with_context "src/modules/navigation NavigationManager remote handling focus input routing repeat policy effects contracts tests"`: found `NavigationFocusPolicy` symbol_id `3395`, `NavigationManager._handleFocusIn`, `RemoteHandler` symbol_id `3139`, and navigation-related focus/current-screen hits. This confirmed the navigation owner area but did not produce a full file/path organization map.
- `find_symbol NavigationManager`: found class symbol_id `3211`, implementing `INavigationManager` from `interfaces.ts`, extending `EventEmitter`, and using `RemoteHandler`, focus, remote-input, repeat, channel-number, state, and event types.
- `analyze_impact NavigationManager` returned no impacted symbols. Treat this as Codanna insufficiency for class-level reverse imports because direct `rg` proves `src/core/orchestrator/assembly/OrchestratorModuleFactory.ts`, `src/__tests__/Orchestrator.test.ts`, and the navigation package barrel consume `NavigationManager`.
- `find_symbol` / `analyze_impact` on local manager delegates:
  - `NavigationRemoteInputRouter` symbol_id `3386`: impact to `NavigationManager`.
  - `NavigationDirectionalRepeatController` symbol_id `2993`: impact to `NavigationManager`.
  - `NavigationChannelNumberInputController` symbol_id `3112`: impact to `NavigationManager`.
  - `NavigationFocusPolicy` symbol_id `3395`: impact to `NavigationManager`.
  - `RemoteHandler` symbol_id `3139`: impact to `NavigationManager`.
- `find_symbol NavigationCoordinator`: found class symbol_id `3353`; `analyze_impact` showed impact through `buildNavigationCoordinator`, `createOrchestratorCoordinators`, `AppOrchestrator._createCoordinators`, and `AppOrchestrator`.
- `find_symbol` / `analyze_impact` on handler/effects symbols:
  - `NavigationKeyModeRouter` symbol_id `3298`, `NavigationRepeatHandler` symbol_id `3176`, `NavigationChannelNumberHandler` symbol_id `3107`, `NavigationModalEffectsHandler` symbol_id `3379`, and `NavigationScreenEffectsHandler` symbol_id `3401` had weak or no reverse impact in Codanna. Direct `rg` proves construction/imports in `OrchestratorCoordinatorBuilders.ts`, mocks in `OrchestratorCoordinatorBuilders.test.ts`, and direct coverage in `NavigationCoordinator.test.ts`.
- `find_symbol INavigationManager`: symbol_id `3072`; `analyze_impact` showed a broad public type impact radius of 27 symbols, including `App`, `AppOrchestrator`, app-shell lazy-screen/overlay ports, initialization policy, audio/settings/profile-select/channel-setup UI, debug tests, and navigation tests. This freezes public navigation contracts and argues against moving or changing exported type shapes beyond import paths.
- `find_symbol NavigationEventMap`: symbol_id `3085`; impact was weak/no reverse impact. Direct `rg` proves event-map usage in navigation tests and settings helpers.
- `search_symbols` for `NavigationFeaturePorts`, `NavigationCoordinatorContracts`, and `NavigationHandlerContracts` found file-level contracts inconsistently or not at all. Direct source reads are the authoritative proof for file-level contract grouping.
- `rg` / direct source reads covered all production files under `src/modules/navigation/*.ts`, all tests under `src/modules/navigation/__tests__/*.ts`, public package exports in `src/modules/navigation/index.ts`, external direct navigation imports in orchestrator assembly/tests, and external public barrel imports throughout app-shell, UI, initialization, debug, and tests.

Codanna is useful for owner and public-contract impact, but insufficient for file/path import audits. `rg`, `find`, `wc -l`, and direct reads are the fallback evidence for old flat paths, replacement path surfaces, and affected tests.

## Impact Snapshot

Current-source proof at plan time:

- `src/modules/navigation/` contains 23 flat production TypeScript files plus `__tests__/`.
- The flat package currently mixes public contracts (`interfaces.ts`, `ScreenNavigationPorts.ts`, `NavigationFeaturePorts.ts`, `NavigationHandlerContracts.ts`, `NavigationCoordinatorContracts.ts`), manager/focus owners (`NavigationManager.ts`, `FocusManager.ts`, `NavigationFocusPolicy.ts`), input owners (`RemoteHandler.ts`, `NavigationRemoteInputRouter.ts`, `NavigationDirectionalRepeatController.ts`, `NavigationChannelNumberInputController.ts`), coordinator/runtime owners (`NavigationCoordinator.ts`, `NavigationCoordinatorEventPort.ts`, `NavigationCoordinatorRuntimeServices.ts`, `nonBlockingFailureTimestamps.ts`), behavior handlers/effects (`NavigationKeyModeRouter.ts`, `NavigationRepeatHandler.ts`, `NavigationChannelNumberHandler.ts`, `NavigationModalEffectsHandler.ts`, `NavigationScreenEffectsHandler.ts`), and config/constants (`constants.ts`).
- `NavigationManager.ts` owns navigation state, screen stack, modal stack, focus operations, initialization/destroy wiring, and event emission. It delegates low-level key routing and timing to `NavigationRemoteInputRouter`, `NavigationDirectionalRepeatController`, and `NavigationChannelNumberInputController`; source audit agrees with `CURRENT_STATE.md`.
- `NavigationCoordinator.ts` owns event-to-handler coordination and is constructed from orchestrator assembly. `OrchestratorCoordinatorBuilders.ts` also constructs `NavigationKeyModeRouter`, `NavigationRepeatHandler`, `NavigationChannelNumberHandler`, `NavigationModalEffectsHandler`, and `NavigationScreenEffectsHandler`.
- `INavigationManager` is a broad public type consumed by app-shell, initialization, orchestrator, debug, UI, and tests. `NavigationConfig`, `Screen`, `KeyEvent`, focus types, and screen navigation ports are exported through the existing navigation package barrel. This package must not change the public type shapes or remove the existing barrel contract.
- Direct old flat-path external imports currently exist in `src/core/orchestrator/AppOrchestrator.ts`, `src/core/orchestrator/assembly/OrchestratorCoordinatorBuilders.ts`, `src/core/orchestrator/assembly/OrchestratorCoordinatorContracts.ts`, `src/core/orchestrator/__tests__/OrchestratorCoordinatorBuilders.test.ts`, `src/core/RuntimeTypeContracts.ts`, and UI files/tests that import `../../navigation/interfaces` or similar direct `interfaces` paths. These are part of the import-reconciliation surface.
- Many callers import from the existing package seam `src/modules/navigation/index.ts` via `../../modules/navigation` or `../../navigation`. That seam is not a compatibility shim; it is the current public package contract and should remain stable while pointing at the moved owners.
- Existing focused tests cover `NavigationManager`, `RemoteHandler`, `NavigationRemoteInputRouter`, `NavigationDirectionalRepeatController`, `NavigationChannelNumberInputController`, `NavigationFocusPolicy`, `NavigationCoordinator`, `NavigationCoordinatorRuntimeServices`, and `nonBlockingFailureTimestamps`. Orchestrator tests cover navigation module construction and coordinator assembly mocks.
- Source audit found no requirement for behavior-visible UI/focus redesign, persistence changes, Plex changes, debugging remediation, public API widening, or compatibility shim files. If implementation discovers one, the current plan is invalid.

Proposed replacement organization for `FCP-18-S1`:

- `contracts/`: `interfaces.ts`, `ScreenNavigationPorts.ts`, `NavigationFeaturePorts.ts`, `NavigationHandlerContracts.ts`, `NavigationCoordinatorContracts.ts`
- `manager/`: `NavigationManager.ts`, `FocusManager.ts`, `NavigationFocusPolicy.ts`
- `input/`: `RemoteHandler.ts`, `NavigationRemoteInputRouter.ts`, `NavigationDirectionalRepeatController.ts`, `NavigationChannelNumberInputController.ts`
- `coordinator/`: `NavigationCoordinator.ts`, `NavigationCoordinatorEventPort.ts`, `NavigationCoordinatorRuntimeServices.ts`, `nonBlockingFailureTimestamps.ts`
- `handlers/`: `NavigationKeyModeRouter.ts`, `NavigationRepeatHandler.ts`, `NavigationChannelNumberHandler.ts`, `NavigationModalEffectsHandler.ts`, `NavigationScreenEffectsHandler.ts`
- `config/`: `constants.ts`
- root: keep only `index.ts` as the existing public package export seam; do not add root compatibility files for old flat paths.
- `__tests__/`: may remain in the existing test folder with imports updated to moved owner paths. Move test files only if the worker proves it reduces path ambiguity without changing test names or verification surface; otherwise avoid test-file churn.

Source finding disposition planned:

- `FCP-18-SF1` maps exactly once to `FCP-18-S1`.
- The checklist candidate prompts `FCP-18-S1` navigation folder organization and `FCP-18-S2` import/path reconciliation are not approved as separate coverage owners. They are one coherent execution unit because folder moves and import reconciliation share the same old flat-path surface, same owner, same files, and same verification envelope.

## Package Decomposition

- `package_id`: `FCP-18`
- `checklist_token`: `FCP-18`
- `source_finding_ids`: `FCP-18-SF1`

`slice_table`:

| slice_id | goal | areas/files | source_finding_ids | verification | dependencies | stop_condition | handoff_condition | serial_only | parallel_justification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FCP-18-S1` | Reorganize the navigation package around existing current owners and reconcile imports without changing behavior or public exports. | `src/modules/navigation/*.ts`; approved new subfolders under `src/modules/navigation/`; `src/modules/navigation/__tests__/*.ts`; external navigation import paths in orchestrator assembly/tests, runtime type contracts, and UI/test files discovered by source audit; `docs/architecture/CURRENT_STATE.md` and `docs/architecture/modules.md` for path-truth updates if named navigation paths move. | `FCP-18-SF1` | Pre/post package source audits for old flat paths, replacement folder map, public export stability, no compatibility shims, and architecture-doc path truth for moved named paths; targeted navigation and orchestrator assembly tests; `npm run typecheck`; `git diff --check`; `npm run verify`; `npm run plans:check`; `npm run verify:docs` for the active plan and again after checklist/architecture/plan doc updates. | None. This is the ready-now execution unit. | Stop if foldering needs old-path shim files, subfolder barrels, root/package barrel changes beyond updating existing `index.ts`, public export widening, behavior changes, cycles, UI/focus-visible changes, persistence/Plex involvement, or a different owner seam. | `FCP-18-SF1` no longer describes current navigation package organization; the existing public package seam exports the same public names; old flat production/test direct imports are gone or source-justified; named architecture-doc paths are current; targeted tests and closeout gates pass; package closeout can update the checklist. | true | Single source finding with one owner and one old-path import surface. Parallel execution would split folder moves from import reconciliation and risk duplicate or missing coverage for the same source finding. |

`coverage_check`:

- `FCP-18-SF1` maps only to `FCP-18-S1`.
- No `source_finding_id` is deferred, split, or mapped to both the checklist candidate `FCP-18-S1` and `FCP-18-S2`.
- `FCP-18-S1` has one final owner: navigation package organization owner.
- Replan is required before admitting any new source finding, approving a separate import-only execution unit, or assigning a separate final owner to old-path import reconciliation.

`ready_now_slice`: `FCP-18-S1`

`ready_now_execution_unit`: `FCP-18-S1`

`recommended_slice_order`:

1. `FCP-18-S1`

`parallel_execution_policy`: no parallel implementation. The approved package has one source finding, one slice, one execution unit, and one final coverage owner.

## Files In Scope

- `src/modules/navigation/index.ts`
- `src/modules/navigation/interfaces.ts`
- `src/modules/navigation/ScreenNavigationPorts.ts`
- `src/modules/navigation/NavigationFeaturePorts.ts`
- `src/modules/navigation/NavigationHandlerContracts.ts`
- `src/modules/navigation/NavigationCoordinatorContracts.ts`
- `src/modules/navigation/NavigationManager.ts`
- `src/modules/navigation/FocusManager.ts`
- `src/modules/navigation/NavigationFocusPolicy.ts`
- `src/modules/navigation/RemoteHandler.ts`
- `src/modules/navigation/NavigationRemoteInputRouter.ts`
- `src/modules/navigation/NavigationDirectionalRepeatController.ts`
- `src/modules/navigation/NavigationChannelNumberInputController.ts`
- `src/modules/navigation/NavigationCoordinator.ts`
- `src/modules/navigation/NavigationCoordinatorEventPort.ts`
- `src/modules/navigation/NavigationCoordinatorRuntimeServices.ts`
- `src/modules/navigation/nonBlockingFailureTimestamps.ts`
- `src/modules/navigation/NavigationKeyModeRouter.ts`
- `src/modules/navigation/NavigationRepeatHandler.ts`
- `src/modules/navigation/NavigationChannelNumberHandler.ts`
- `src/modules/navigation/NavigationModalEffectsHandler.ts`
- `src/modules/navigation/NavigationScreenEffectsHandler.ts`
- `src/modules/navigation/constants.ts`
- New focused subfolders under `src/modules/navigation/` only for approved behavior-neutral organization: `contracts/`, `manager/`, `input/`, `coordinator/`, `handlers/`, and `config/`
- `src/modules/navigation/__tests__/FocusManager.test.ts`
- `src/modules/navigation/__tests__/NavigationChannelNumberInputController.test.ts`
- `src/modules/navigation/__tests__/NavigationCoordinator.test.ts`
- `src/modules/navigation/__tests__/NavigationCoordinatorRuntimeServices.test.ts`
- `src/modules/navigation/__tests__/NavigationDirectionalRepeatController.test.ts`
- `src/modules/navigation/__tests__/NavigationFocusPolicy.test.ts`
- `src/modules/navigation/__tests__/NavigationManager.test.ts`
- `src/modules/navigation/__tests__/NavigationRemoteInputRouter.test.ts`
- `src/modules/navigation/__tests__/RemoteHandler.test.ts`
- `src/modules/navigation/__tests__/nonBlockingFailureTimestamps.test.ts`
- `src/core/orchestrator/assembly/OrchestratorCoordinatorBuilders.ts`
- `src/core/orchestrator/assembly/OrchestratorCoordinatorContracts.ts`
- `src/core/orchestrator/AppOrchestrator.ts`
- `src/core/RuntimeTypeContracts.ts`
- `src/core/orchestrator/__tests__/OrchestratorCoordinatorBuilders.test.ts`
- `src/core/orchestrator/__tests__/OrchestratorCoordinatorAssembly.test.ts`
- `src/__tests__/Orchestrator.test.ts` only if the navigation package barrel or module construction mocks are affected
- UI/app-shell/debug/initialization/test files that directly import `src/modules/navigation/interfaces` or other old flat navigation leaf paths, only for import-path reconciliation to the approved `contracts/` path or existing public package seam
- `docs/architecture/CURRENT_STATE.md` and `docs/architecture/modules.md` for required path-truth updates if approved folder moves relocate named navigation paths such as `src/modules/navigation/NavigationManager.ts` or `src/modules/navigation/NavigationFeaturePorts.ts`; ownership wording changes only if implementation source audit proves ownership truth changed
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` only during package closeout after clean review and verification

## Files Out Of Scope

- Any runtime/source file not named in `## Files In Scope`, except narrow import-path updates discovered by the required old flat-path audit.
- Navigation behavior changes, focus policy redesign, remote/keyboard handling behavior, platform key-map behavior, timer interval/delay behavior, screen/modal stack behavior, event names, public navigation type shapes, and public export widening.
- Old-path compatibility re-export files such as `src/modules/navigation/NavigationManager.ts` left behind after moving the owner, subfolder `index.ts` barrels, new root/package barrels, and temporary migration shims.
- Plex auth/discovery/library/stream behavior, Plex stream organization, scheduler/channel-manager behavior, persistence/storage behavior, app-shell deferred-screen behavior, Orchestrator runtime cleanup, UI visual/focus composition, CSS, Windows platform work, and feature/design work.
- Completed `FCP-7` through `FCP-17` implementation work except as read-only guardrails.
- Pre-existing unrelated dirty/untracked workspace files listed in `## Required Reading`.

## Planner Self-Check

1. No unresolved package-level owner seam remains: `FCP-18-SF1` maps exactly once to `FCP-18-S1`.
2. Adjacent contract/type changes are explicit: public `INavigationManager`, `NavigationConfig`, `Screen`, `KeyEvent`, focus types, feature ports, handler runtime contracts, and existing package-barrel exports are frozen.
3. Files out of scope are not hidden implementation dependencies. External files are in scope only for import-path reconciliation discovered by the old-path audit, not behavior changes.
4. Codanna evidence and insufficiencies are recorded, including weak document search, weak file-level impact for several navigation classes, and deterministic `rg`/direct-read fallback for import paths.
5. The plan uses repo-preferred owners: navigation files remain under `src/modules/navigation/`, grouped by current owner rather than moving policy into UI, Plex, scheduler, app-shell, orchestrator, platform, or persistence.
6. A fresh cleanup-loop session can start `ready_now_execution_unit` `FCP-18-S1` without deciding package membership, final owners, parallelism, or verification depth.
7. The plan is execution-grade at seam/scope/verification level and deliberately leaves local relative import mechanics and exact move commands to the cleanup worker as long as the approved folder map and proof surface hold.

## Architecture Seam Decision Gate

Approved seam:

- Execute one slice, `FCP-18-S1`, as behavior-neutral package organization plus import reconciliation.
- Use the replacement organization named in `## Impact Snapshot` unless fresh source audit proves a narrower grouping is clearly safer. Any alternate grouping must still keep the same owner classes together, remain inside `src/modules/navigation/`, avoid behavior changes, avoid compatibility shims, and preserve the same verification envelope.
- Keep the existing `src/modules/navigation/index.ts` as the public package export seam. Update its export paths to moved owners only. Do not add public exports, delete existing public exports, or add new root/subfolder barrels.
- Move old flat production files to approved subfolders rather than leaving old-path re-export files behind. All internal and external direct imports of old flat leaf paths must be updated to the new owner path or to the existing public package seam when that seam already exports the needed public type/value.
- Update architecture path truth in `docs/architecture/CURRENT_STATE.md` and `docs/architecture/modules.md` in the same closeout path if approved moves relocate any navigation path those docs name. This is required even when semantic ownership is unchanged.
- Keep `NavigationManager` behavior unchanged while relative imports are updated to the moved manager/input/contracts/config owners.
- Keep `OrchestratorCoordinatorBuilders` behavior unchanged while direct navigation handler/coordinator imports are updated to moved paths.
- Keep navigation tests behavior-focused. Update imports to moved owner paths; do not add private accessors, cast into private fields, or create test-only exports solely for foldering.

Stop and replan if:

- foldering requires any old flat-path compatibility shim file, new subfolder barrel, new root/package barrel, fallback import path, or public export widening;
- direct import updates create circular dependencies, including type-only cycles;
- `NavigationManager`, `FocusManager`, `RemoteHandler`, input routing, repeat controllers, handlers, effects, coordinator runtime services, or constants require behavior changes to pass tests;
- source audit proves the existing flat package is source-justified and moving files would be churn;
- UI/focus-visible behavior, ARIA/CSS/screen/overlay behavior, Plex behavior, persistence/storage behavior, scheduler behavior, platform key-map behavior, Orchestrator runtime behavior, or Windows behavior becomes necessary;
- tests require private probing or new test-only APIs instead of existing public/package-local seams;
- newly discovered residue changes package membership, execution-unit membership, final-owner accounting, owner seam, or verification surface.

Absorb-now rule: absorb only newly discovered path/import residue that stays within `FCP-18-S1`'s approved execution-unit goal, owner, seam/files, verification envelope, and final-owner accounting. Record absorbed residue in implementation/review output. Replan for new owners, wider verification, changed source-finding coverage, or changed execution-unit membership.

## Verification Commands

- Verification classification: `broader integration/manual proof required`

Primary proof mode: `refactor-invariance`, supported by package-local source audits, old/replacement path audits, targeted navigation/orchestrator tests, `typecheck`, docs gates, and final `npm run verify`. New automated tests are not expected because existing navigation and orchestrator tests already cover the behavior seams; add tests only if source audit proves an affected behavior seam lacks coverage after the move.

Plan validation:

- Run: `npm run plans:check`
  - Expected: this active tracked plan satisfies Universal Plan Core and FCP cleanup-overlay structure, including exactly one `FCP-18-SF1` coverage mapping.
- Run after active plan creation/update: `npm run verify:docs`
  - Expected: docs/control-plane verification passes for the active plan. Run again during package closeout if checklist/current-state/modules/plan docs are updated.

Ready-now `FCP-18-S1` source-audit proof:

- Pre-edit source audit over `src/modules/navigation/*.ts`, `src/modules/navigation/__tests__/*.ts`, navigation imports in orchestrator assembly/tests, and UI/app-shell/debug/initialization direct navigation leaf imports.
  - Expected: implementation records the current flat files, old flat direct import paths, existing public package seam exports, and behavior owners before moving files.
- Post-edit source audit over `src/modules/navigation/`, affected external import files, and tests.
  - Expected: `FCP-18-SF1` no longer describes current source; production files are grouped by approved owners; no old-path shim files, subfolder barrels, public export widening, or behavior changes were introduced.

Old-path static audits:

- Run before and after edits:
  - `find src/modules/navigation -maxdepth 2 -type f | sort`
  - Expected before: flat production files plus `__tests__`. Expected after: production files under approved subfolders, root `index.ts`, and `__tests__` unless test-file moves are source-justified.
- Run after edits:
  - `rg -n "modules/navigation/(Navigation|RemoteHandler|FocusManager|ScreenNavigationPorts|interfaces|constants|nonBlockingFailureTimestamps)|\\.\\./(\\.\\./)*navigation/(Navigation|RemoteHandler|FocusManager|ScreenNavigationPorts|interfaces|constants|nonBlockingFailureTimestamps)" src --glob "*.ts"`
  - Expected: no production or test imports point at old flat leaf paths. Any hit must be a source-justified false positive or a required public package-seam import that does not name an old leaf file.
- Run after edits:
  - `rg -n "export .*from './(Navigation|RemoteHandler|FocusManager|ScreenNavigationPorts|interfaces|constants|nonBlockingFailureTimestamps)" src/modules/navigation/index.ts src/modules/navigation --glob "*.ts"`
  - Expected: `index.ts` exports point at approved subfolder owners; no old flat re-export shim files remain.

Replacement-path and public seam audits:

- Run after edits:
  - `rg -n "from ['\"][^'\"]*modules/navigation['\"]|from ['\"][^'\"]*\\.\\.?/[^'\"]*navigation['\"]|require\\(['\"][^'\"]*modules/navigation['\"]\\)" src --glob "*.ts"`
  - Expected: public callers that need exported navigation contracts still import through the existing package seam; internal direct imports use approved owner subfolder paths.
- Run after edits:
  - `rg -n "NavigationChannelSwitchOutcome|ChannelSwitchOutcome" src/modules/navigation src/core/orchestrator/assembly src/core/RuntimeTypeContracts.ts`
  - Expected: navigation continues aliasing the shared `ChannelSwitchOutcome`; no duplicated outcome union or cross-owner drift returns.

Targeted tests:

- Run:
  - `npm test -- --runInBand src/modules/navigation/__tests__/NavigationManager.test.ts src/modules/navigation/__tests__/RemoteHandler.test.ts src/modules/navigation/__tests__/NavigationRemoteInputRouter.test.ts src/modules/navigation/__tests__/NavigationDirectionalRepeatController.test.ts src/modules/navigation/__tests__/NavigationChannelNumberInputController.test.ts src/modules/navigation/__tests__/NavigationFocusPolicy.test.ts src/modules/navigation/__tests__/NavigationCoordinator.test.ts src/modules/navigation/__tests__/NavigationCoordinatorRuntimeServices.test.ts src/modules/navigation/__tests__/nonBlockingFailureTimestamps.test.ts`
  - Expected: navigation manager, focus, remote handler, input routing, repeat timing, channel-number input, coordinator, runtime reporting, and non-blocking failure timestamp behavior remain unchanged after path moves.
- Run:
  - `npm test -- --runInBand src/core/orchestrator/__tests__/OrchestratorCoordinatorBuilders.test.ts src/core/orchestrator/__tests__/OrchestratorCoordinatorAssembly.test.ts src/__tests__/Orchestrator.test.ts`
  - Expected: orchestrator module construction, navigation coordinator assembly, and existing package-barrel module mocks remain valid after import path updates. If `src/__tests__/Orchestrator.test.ts` becomes too broad for a targeted pass, run the exact failing/affected test subset and record why.

Static and package gates:

- Run: `npm run typecheck`
  - Expected: no TypeScript errors after file moves and import-path updates.
- Run: `git diff --check`
  - Expected: no whitespace errors before commits and package closeout.
- Run: `npm run verify`
  - Expected: full repo verification passes before marking `FCP-18` complete because this is navigation/runtime package organization work.
- Run: `npm run verify:docs`
  - Expected: required again after closeout updates `ARCHITECTURE_CLEANUP_CHECKLIST.md`, architecture docs, or this active plan. Architecture docs must be updated when approved file moves stale named navigation paths.

Closeout source review:

- Source-finding proof matrix for `FCP-18-SF1`.
  - Expected: the original source finding sentence is answered as resolved, source-disproved, deferred, or reclassified with one final owner. No detector/imported ids are used.
- Public seam review.
  - Expected: `src/modules/navigation/index.ts` exports the same public names as before, from moved owner files, with no new compatibility path.
- Architecture path-truth review.
  - Expected: `docs/architecture/CURRENT_STATE.md` and `docs/architecture/modules.md` no longer name old navigation paths after approved moves; ownership text remains semantically accurate.
- Behavior review.
  - Expected: implementation diff is import/file organization only; any runtime logic change must have triggered stop/replan before closeout.

## Priority-Exit Readiness

`FCP-18` is not the final package in the additional pre-Windows-port pass, but it is the current FCP package gate before `FCP-19`. Do not start, plan, or mark progress on `FCP-19`, `FCP-20`, `FCP-EXIT`, Windows port work, or other post-FCP cleanup until the `FCP-18` mini-record is completed with source audit, `source_finding_id` proof matrix, clean closeout review, verification evidence, and owned follow-ups recorded.

FCP source finding disposition intent:

- `FCP-18-SF1`: planned disposition is `resolved` by `FCP-18-S1` when current source shows the navigation package is grouped around current owners, old flat direct imports are reconciled, existing public exports remain stable, named architecture-doc paths are current, and no behavior-visible navigation changes landed.
- Detector/imported/package-map ids: none. FCP-18 uses only `source_finding_id` coverage; do not add detector, imported review, Desloppify, or package-map ids to proof or closeout.
- Deferred or split items: none planned. If source audit discovers a real residual, stop and replan unless it stays within `FCP-18-S1` absorption rules; any accepted residual must name one final owner, the reason it remains open, and a revisit trigger.
- Security triage: no open P0 security findings are admitted for this package. If the package audit discovers a P0 security finding, stop for replan and record the exact resolved or deferred P0 finding, one final owner, and revisit trigger before closeout.

Required closeout evidence before `FCP-19`:

- source proof matrix for `FCP-18-SF1`, with disposition, live residual status, final owner, and revisit trigger if any residual remains;
- old-path and replacement-path audits proving no old flat-path shim, subfolder barrel, public export widening, or stale architecture path remains;
- targeted navigation/orchestrator tests, `npm run typecheck`, `git diff --check`, `npm run verify`, `npm run plans:check`, and `npm run verify:docs`;
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` `FCP-18` mini-record update with status, plan path, latest verification evidence, proof matrix, follow-ups, and handoff;
- `docs/architecture/CURRENT_STATE.md` and `docs/architecture/modules.md` updates if approved file moves stale named navigation paths;
- clean closeout/priority-exit review confirming FCP-18 source finding disposition, verification evidence, path-truth docs, and owned follow-ups before `FCP-19` starts.

## Rollback Notes

Roll back by the single execution unit, `FCP-18-S1`.

If parity fails, restore the previous flat navigation file layout and imports, then keep any valid import-audit or test evidence that exposed the issue. Do not leave old-path shim files or partial moved owners in place as a temporary compatibility layer.

If a proposed subfolder grouping proves confusing or creates cycles, revert only the package-organization diff and replan a narrower folder map. Do not use fallback barrels to paper over unresolved ownership.

If docs/checklist closeout fails after source/test changes pass, leave reviewed source/test changes intact and fix tracked docs in a separate controller-owned closeout pass.

## Commit Checkpoints

- Planning checkpoint: commit only this plan artifact if the controller wants a tracked-doc checkpoint; do not bundle unrelated dirty/untracked files.
- Implementation checkpoint: after `FCP-18-S1` implementation, targeted tests, typecheck, diff check, and implementation review pass, create one focused non-interactive implementation commit for production/test import/path changes. Exclude active tracked plan docs unless the controller explicitly commits plan progress separately.
- Closeout checkpoint: after final verification and clean review, update `ARCHITECTURE_CLEANUP_CHECKLIST.md` and any required architecture docs in a separate tracked-doc closeout commit if the controller chooses to commit closeout docs.
