**Plan Status:** completed
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

# FCP-12 Package Organization, Structure Navigation, And Final Exit Plan

## Goal

Retire exactly `ARCHITECTURE_CLEANUP_CHECKLIST.md` item `FCP-12` by reorganizing the app-shell and core orchestrator packages only where current source proves navigation value, then closing the final cleanup pass with source-backed reconciliation for `FCP-7` through `FCP-12`.

This is an `FCP-*` source-backed cleanup package. Coverage is defined only by `source_finding_id` values `FCP-12-SF1`, `FCP-12-SF2`, and `FCP-12-SF3`; do not use detector ids, imported review ids, Desloppify ids, package-map ids, line count, folder count, or score output for intake, proof, or closeout.

## Non-Goals

- Do not change app-shell, startup, DOM, toast, theme, diagnostics, lazy-screen, Orchestrator, runtime, storage-context, priority-one, Plex, scheduler, navigation, persistence, or UI behavior.
- Do not introduce root barrels, compatibility re-export layers, temporary import shims, or fallback paths.
- Do not reopen completed implementation work from `FCP-7` through `FCP-11`.
- Do not use stale hotspot docs, detector output, line count, or folder count as closure proof.
- Do not start Windows port work, `FCP-EXIT`, or any post-FCP cleanup before this package earns closeout.

## Parent Priority Alignment

At plan start, `FCP-12` was the first unchecked and final package in the active final cleanup pass. `FCP-7` through `FCP-11` were marked completed in `ARCHITECTURE_CLEANUP_CHECKLIST.md`, and `FCP-11` recorded a proof matrix plus the gate that `FCP-12` could start only after that closeout evidence remained clean.

Current architecture docs identify `src/App.ts` as the app-shell composition root and `src/core/app-shell/` as the owner for deferred screens, app-shell runtime ports, screen visibility, theme, startup UI, diagnostics, containers, toast, and config. They identify `src/Orchestrator.ts` as a thin public runtime entry barrel and `src/core/orchestrator/AppOrchestrator.ts` plus collaborators as the runtime implementation and assembly surface. This plan preserves those owners and changes only package navigation paths.

## Required Reading

Read in this order before implementation or review:

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/README.md` routing table
4. `ARCHITECTURE_CLEANUP_CHECKLIST.md` sections `FCP Operating Rules` and `FCP-7` through `FCP-12`
5. `docs/architecture/CURRENT_STATE.md`
6. `docs/architecture/modules.md`
7. `docs/agentic/session-prompts/cleanup-loop.md`
8. `docs/agentic/plan-authoring-standard.md`
9. `docs/agentic/codanna-playbook.md`
10. completed-background guardrail plans only:
    - `docs/plans/2026-05-02-fcp-7-boundary-type-hygiene-plan.md`
    - `docs/plans/2026-05-02-fcp-8-api-plex-error-contract-coherence-plan.md`
    - `docs/plans/2026-05-02-fcp-9-source-signal-convention-local-elegance-plan.md`
    - `docs/plans/2026-05-02-fcp-10-epg-renderer-direct-confidence-presentation-decomposition-plan.md`
    - `docs/plans/2026-05-02-fcp-11-runtime-owner-reduction-hotspots-plan.md`
11. this plan
12. source and test files named under `## Files In Scope`
13. `git status --short --branch`

Freshness gate: stop and refresh this plan if any `FCP-12` checklist text, app-shell/orchestrator ownership docs, public runtime entry exports, source files in scope, or tests in scope changed materially after this plan was written.

Planning observed branch `code-health...origin/code-health` with unrelated dirty/untracked paths already listed by the controller. Preserve those files unless a fresh source audit proves direct `FCP-12` overlap.

## Required Skills

- `architecture-boundaries`: loaded first; this package changes source/package organization around composition roots and public runtime seams.
- `verification-strategy`: loaded second; primary mode is behavior-preserving refactor invariance with source-audit closeout.
- `execution-plan-authoring`: loaded third; this is a serious tracked FCP package plan.

`ui-composition-patterns` was not loaded because the approved plan is import-path and folder organization only. Load it and stop for replan if implementation changes app-shell DOM/container/startup UI behavior beyond path updates. Do not load `plex-integration-boundaries` or `persistence-boundaries` unless source audit unexpectedly shows a required Plex or storage contract change; that should normally stop and replan.

## Codanna Discovery

- `get_index_info`: Codanna available; 11,630 symbols across 774 files; semantic search enabled with 115 embeddings; updated 14 minutes before this planning pass.
- `search_documents "FCP-12 Package Organization Structure Navigation Final Exit app-shell orchestrator source findings"`: 5 results, all noisy. Top hits were `docs/plans/2026-04-28-design-coherence-audit-plan.md`, `docs/plans/2026-04-28-cross-module-architecture-audit-plan.md`, `docs/getting-started/first-channel.md`, and `docs/plans/2026-04-28-cross-module-architecture-cleanup-checklist.md`; it did not return `ARCHITECTURE_CLEANUP_CHECKLIST.md` as authoritative. Fallback: direct checklist read.
- `semantic_search_with_context "src/core/app-shell diagnostics lazy screen registry theme startup UI toast containers config folder organization"`: 5 results, mostly unrelated settings/EPG symbols; it surfaced `AppLazyScreenRegistry` only indirectly through `SettingsScreen` usage. Fallback: direct `src/core/app-shell` file/import/test reads.
- `semantic_search_with_context "src/core/orchestrator AppOrchestrator composition event binder runtime facade controller priority-one storage context folder organization"`: 1 weak result, `LifecycleCallback`, not authoritative for orchestrator package organization. Fallback: direct `src/core/orchestrator` file/import/test reads.
- `find_symbol`/`analyze_impact` app-shell anchors:
  - `AppLazyScreenRegistry` symbol_id `10134`: impact limited to `App`.
  - `AppThemeController` symbol_id `10056`: impact limited to `App`.
  - `AppStartupUiInitializer` symbol_id `9593`: no impact detected, treated as incomplete because `AppOrchestrator` imports it directly.
  - `createAppContainers` symbol_id `9623`: impact limited to `App.start` and `App._createContainers`.
  - `createAppOrchestratorConfig` symbol_id `9578`: impact limited to `App._buildConfig` and `App.start`.
  - `AppDiagnosticsSurface` symbol_id `9505` and `AppToastPresenter` symbol_id `9649`: no impact detected, treated as incomplete because `App.ts` imports both directly.
- `find_symbol`/`analyze_impact` orchestrator anchors:
  - `AppOrchestrator` symbol_id `9758`: Codanna reported no reverse impact, treated as incomplete because `src/Orchestrator.ts`, `src/App.ts`, and tests import it.
  - `OrchestratorEventBinder` symbol_id `9344`: impact includes `AppOrchestrator`, priority-one factory/collaborators, and event-binder tests.
  - `OrchestratorStorageContext` symbol_id `8906`: impact limited to `AppOrchestrator`.
  - `OrchestratorRuntimeSeams` and `createPriorityOneRuntimeAssembly`: Codanna symbol/impact was weak or inconsistent; direct `rg` found priority-one, initialization, event binder, runtime reporter, and tests as the authoritative import surface.
- Direct fallback reads/audits:
  - `rg --files src/core/app-shell` found 16 production TypeScript files and 11 app-shell test files in one flat production folder.
  - `rg --files src/core/orchestrator` plus `wc -l` found 26 root production TypeScript files, an existing `priority-one/` subfolder, and 6,571 lines across root plus priority-one production files.
  - `rg` import audits found external app-shell imports in `src/App.ts`, `src/__tests__/App.test.ts`, and app-shell tests; external orchestrator imports in `src/Orchestrator.ts`, `src/__tests__/Orchestrator.test.ts`, `src/__tests__/orchestrator/*`, EPG tests, and orchestrator tests.

Codanna is useful for anchor names but insufficient for file-level package organization and several public contract impact paths. Direct source reads are the authoritative proof for `FCP-12-SF1` and `FCP-12-SF2`.

## Impact Snapshot

`FCP-12-SF1` remains source-true and worth behavior-neutral foldering. `src/core/app-shell` currently mixes:

- diagnostics: `AppDiagnosticsSurface`, dev-menu controller/view, playback formatter, channel setup summary;
- deferred screens: lazy screen registry and port factory;
- runtime contracts/theme: `AppShellRuntimeContracts`, `AppThemeController`;
- app chrome/startup surfaces: container factory, blocking error presenter, screen visibility coordinator, startup UI initializer, toast presenter;
- config: orchestrator config factory and prefetch constants.

The proposed foldering is navigation-positive because the clusters already have stable owners, tests, and direct import surfaces. It should not create any root barrel or compatibility layer.

`FCP-12-SF2` remains source-true and worth behavior-neutral foldering. `src/core/orchestrator` still has a large flat root containing distinct assembly, event binding, runtime facade, controller, recoverable-runtime, policy, storage-context, and public-contract files. `priority-one/` is already grouped and must remain the priority-one owner. `AppOrchestrator.ts` may stay at the orchestrator package root as the public implementation facade; `src/Orchestrator.ts` remains the only public runtime entry barrel.

Public/shared seams that require impact-aware treatment if paths move:

- app-shell: `AppShellRuntimeContracts`, `AppLazyScreenRegistry`, `AppLazyScreenPortFactory`, `AppContainerFactory`, `AppThemeController`, `AppStartupUiInitializer`, `AppDiagnosticsSurface`, `AppToastPresenter`, and `createAppOrchestratorConfig`;
- orchestrator: `AppOrchestrator`, `OrchestratorTypes`, `OrchestratorRuntimeSeams`, `OrchestratorCoordinatorAssembly`/contracts/builders, `OrchestratorModuleFactory`, `OrchestratorEventBinder`, `OrchestratorStorageContext`, `OrchestratorPlaybackInfoSnapshot`, and priority-one `PriorityOneRuntimeAssemblyInput` / `PriorityOneAssemblyInput`;
- docs: `CURRENT_STATE.md`, `modules.md`, and `ARCHITECTURE_CLEANUP_CHECKLIST.md` if final source paths or ownership descriptions change.

`FCP-12-SF3` is closeout-only until `FCP-12-S1` and `FCP-12-S2` are completed, source-disproved, or explicitly accepted with one owner/revisit trigger. Closure must answer whether the original source finding sentence still describes current source for every FCP package, not whether detectors are quiet.

## Files In Scope

- `src/core/app-shell/*`
- `src/core/app-shell/__tests__/*`
- new focused subfolders under `src/core/app-shell/` only for approved behavior-neutral organization:
  - `diagnostics/`
  - `deferred-screens/`
  - `runtime/`
  - `chrome/`
  - `config/`
- `src/App.ts`
- `src/__tests__/App.test.ts`
- `src/core/orchestrator/*`
- `src/core/orchestrator/priority-one/*`
- `src/core/orchestrator/__tests__/*`
- new focused subfolders under `src/core/orchestrator/` only for approved behavior-neutral organization:
  - `assembly/`
  - `events/`
  - `runtime/`
  - `controllers/`
  - `policy/`
  - `storage/`
  - `contracts/`
- `src/Orchestrator.ts`
- `src/__tests__/Orchestrator.test.ts`
- `src/__tests__/orchestrator/*`
- any test import paths directly affected by app-shell/orchestrator file moves
- `docs/architecture/CURRENT_STATE.md`
- `docs/architecture/modules.md`
- `ARCHITECTURE_CLEANUP_CHECKLIST.md`
- this plan only for status/evidence updates after reviewed execution

## Files Out Of Scope

- Production or test files outside the listed app-shell/orchestrator import blast radius.
- Behavior changes in `src/App.ts`, `src/Orchestrator.ts`, `src/core/app-shell/*`, or `src/core/orchestrator/*`.
- Plex auth/discovery/library/stream contracts, playback URL logic, scheduler/channel persistence schema, navigation public API, storage key ownership, and platform policy.
- Moving `src/core/orchestrator/priority-one/` to a different owner or reopening `FCP-11-S4` priority-one forwarding behavior.
- New root `index.ts` barrels, compatibility re-export files, temporary shims, or fallback import paths.
- Unrelated dirty/untracked files reported by the controller startup facts.

## Planner Self-Check

1. Architecture seam resolved? Yes. The approved changes are path/package organization only, with app-shell and orchestrator owners preserved.
2. Hidden adjacent contracts? No. Public symbols keep their names and behavior; path changes require import updates and targeted tests only.
3. Out-of-scope files implicitly required? No. Any source outside the named import blast radius is a stop/replan trigger unless it is only a test import path directly affected by a move.
4. Codanna evidence recorded? Yes, including noisy document search and weak symbol-impact fallbacks.
5. Repo-preferred owner? Yes. Existing app-shell/orchestrator owners are grouped rather than split into new behavior owners.
6. Fresh-session invention required? No. Slice membership, ready-now unit, foldering seams, verification, and stop conditions are explicit.
7. Execution-grade? Yes. The plan freezes package organization decisions without prescribing mechanical patch details.

## Architecture Seam Decision Gate

Approved `FCP-12-S1` app-shell organization:

- `diagnostics/`: `AppDiagnosticsSurface`, `AppDiagnosticsDevMenuController`, `AppDiagnosticsDevMenuView`, `AppDiagnosticsPlaybackInfoFormatter`, `AppDiagnosticsChannelSetupSummary`.
- `deferred-screens/`: `AppLazyScreenRegistry`, `AppLazyScreenPortFactory`.
- `runtime/`: `AppShellRuntimeContracts`, `AppThemeController`.
- `chrome/`: `AppContainerFactory`, `AppBlockingErrorOverlayPresenter`, `AppScreenVisibilityCoordinator`, `AppStartupUiInitializer`, `AppToastPresenter`.
- `config/`: `AppOrchestratorConfigFactory`, `constants`.

Approved `FCP-12-S2` orchestrator organization:

- Keep `AppOrchestrator.ts` at `src/core/orchestrator/AppOrchestrator.ts` as the implementation facade unless a fresh import audit proves moving it is strictly safer. Do not move `src/Orchestrator.ts`.
- `assembly/`: `OrchestratorCoordinatorAssembly`, `OrchestratorCoordinatorContracts`, `OrchestratorCoordinatorBuilders`, `OrchestratorModuleFactory`.
- `events/`: `OrchestratorEventBinder`, `OrchestratorEventCleanupReporter`.
- `runtime/`: `OrchestratorRuntimeSeams`, `OrchestratorRuntimeControllerBuilder`, `OrchestratorChannelSwitchRuntime`, `OrchestratorPlexAuthRuntime`, `OrchestratorServerSelectionRuntime`, `OrchestratorPlaybackStateAccessors`, `OrchestratorPlaybackInfoSnapshot`, recoverable-runtime reporter/result/warnings, `OrchestratorShutdownTeardown`.
- `controllers/`: `ScheduleDayRolloverController`, `SubtitleTrackRecoveryController`, `OverlayRuntimePolicyController`, `ProfileSwitchCleanupController`.
- `policy/`: `OrchestratorSchedulePolicy`.
- `storage/`: `OrchestratorStorageContext`.
- `contracts/`: `OrchestratorTypes`, `OverlayPorts` if the implementation audit confirms moving public internal contract files is cleaner than leaving them beside `AppOrchestrator`.
- Keep `priority-one/` intact as the priority-one owner. Preserve `OrchestratorRuntimeSeams`, `PriorityOneRuntimeAssemblyInput`, and `PriorityOneAssemblyInput` names and behavior.

Stop and replan if:

- foldering would require behavior changes, new public APIs, compatibility re-exports, root barrels, or fallback paths;
- import updates create circular dependencies, including type-only cycles;
- the fresh source audit shows app-shell foldering creates more churn than navigation value;
- orchestrator foldering requires reopening `FCP-11` priority-one behavior, runtime seam ownership, storage context semantics, or coordinator assembly contracts;
- `src/App.ts` or `AppOrchestrator.ts` starts absorbing new logic instead of only updating import paths;
- tests require private probing or new test-only APIs to prove a path move;
- source findings, execution-unit membership, final-owner accounting, or verification surface changes.

Absorb-now rule: absorb only path/import residue that stays inside the same approved execution unit goal, owner, files, verification envelope, and final-owner accounting. Replan for new owners, behavior changes, wider verification, or any Plex/persistence/UI composition contract change.

## Verification Commands

Verification strategy classification: `broader integration/manual proof required`.

Primary proof mode: `refactor-invariance`, supported by package-local source audits, targeted tests around moved owners, `typecheck`, architecture/lint gates, and final `npm run verify`.

Plan validation:

- `npm run plans:check`
  - Expected: this active plan satisfies Universal Plan Core and FCP cleanup-overlay requirements.

Required `FCP-12-S1` verification:

- Targeted app-shell tests:
  - `npm test -- AppDiagnosticsSurface AppDiagnosticsPlaybackInfoFormatter AppDiagnosticsChannelSetupSummary AppLazyScreenRegistry AppLazyScreenPortFactory AppShellRuntimeContracts AppThemeController AppStartupUiInitializer AppToastPresenter AppContainerFactory AppBlockingErrorOverlayPresenter AppScreenVisibilityCoordinator AppOrchestratorConfigFactory App`
  - Expected: diagnostics, lazy-screen registry/ports, runtime theme, startup UI, toast, container, config, blocking overlay, and visibility behavior remain unchanged. If Jest pattern matching misses a moved owner, run the exact affected test file path.
- `npm run typecheck`
  - Expected: all app-shell path moves and public type imports compile.
- Source audits:
  - no production import remains from old flat app-shell file paths;
  - no app-shell root barrel or compatibility re-export file was added;
  - no app-shell circular import was introduced;
  - `src/App.ts` changed only import paths and any unavoidable relative path text.
- `git diff --check`
  - Expected: no whitespace errors before the `FCP-12-S1` commit/review.

Required `FCP-12-S2` verification:

- Targeted orchestrator tests:
  - `npm test -- Orchestrator OrchestratorCoordinatorAssembly OrchestratorCoordinatorBuilders OrchestratorEventBinder OrchestratorEventCleanupReporter OrchestratorRecoverableRuntimeReporter OrchestratorRecoverableRuntimeWarnings OrchestratorRecoverableRuntimeResult OrchestratorRuntimeSeams OrchestratorChannelSwitchRuntime OrchestratorPlexAuthRuntime OrchestratorServerSelectionRuntime OrchestratorSchedulePolicy OrchestratorStorageContext OrchestratorShutdownTeardown PriorityOneAssemblyBuilder PriorityOneControllerFactory PriorityOneControllerCollaborators OverlayRuntimePolicyController PlaybackRuntimeController PlaybackStartController ScheduleDayRolloverController SubtitleTrackRecoveryController`
  - Expected: AppOrchestrator, coordinator assembly/builders, event binder/cleanup reporter, runtime seams/controllers, schedule policy, storage context, shutdown, server selection, priority-one assembly/factory/collaborators, and overlay/runtime policy behavior remain unchanged. If Jest pattern matching misses a moved owner, run the exact affected test file path.
- `npm run typecheck`
  - Expected: all orchestrator path moves and public type imports compile.
- `npm run verify:architecture`
  - Expected: architecture lint remains clean after import path changes.
- Source audits:
  - no production import remains from old flat orchestrator file paths except approved root `AppOrchestrator.ts` and any explicitly retained public contract files;
  - no orchestrator root barrel or compatibility re-export file was added;
  - no orchestrator or priority-one circular import was introduced;
  - `OrchestratorRuntimeSeams`, priority-one assembly contracts, storage context contracts, and `src/Orchestrator.ts` public exports preserve names and behavior.
- `git diff --check`
  - Expected: no whitespace errors before the `FCP-12-S2` commit/review.

Required `FCP-12-S3` closeout verification:

- Source-backed audit rerun for `FCP-7` through `FCP-12`:
  - Expected: each original source finding sentence is fixed, source-disproved, or accepted with one final owner and revisit trigger.
- Package-local static/source audits for old and replacement patterns:
  - Expected: app-shell and orchestrator old flat-path imports are gone where files moved; replacement folders contain no barrels/shims and no circular imports.
- `npm run verify:docs`
  - Expected: checklist/current-state/modules/plan updates pass docs verification. Run this during package closeout when `FCP-12` checklist/current-state/modules docs are updated.
- `npm run typecheck`
  - Expected: final TypeScript import graph remains clean.
- `git diff --check`
  - Expected: no whitespace errors before package closeout.
- `npm run verify`
  - Expected: full UI/navigation/orchestrator/runtime/docs/build gate passes before marking `FCP-12` complete.

New automated tests are not required for path-only folder moves unless current targeted tests fail to protect a public seam affected by the move. Do not add tests that assert private file layout beyond the no-barrel/no-cycle/source-audit expectations.

## Rollback Notes

- Roll back by slice. If app-shell foldering regresses behavior or creates import cycles, restore the previous app-shell file paths and keep any valid audit/test evidence for replan.
- If orchestrator foldering destabilizes runtime seams, priority-one assembly, storage context, or public exports, restore only that slice and preserve completed `FCP-12-S1` if reviewed clean.
- If closeout reconciliation finds a completed FCP package still source-true, do not force the checklist closed. Record the single final owner/revisit trigger or replan the package before any next-work gate opens.

## Commit Checkpoints

- `FCP-12-S1` implementation checkpoint: app-shell folder organization plus app-shell import/test updates and source audits.
- `FCP-12-S2` implementation checkpoint: orchestrator folder organization plus orchestrator import/test updates and source audits.
- `FCP-12-S3` closeout checkpoint: final FCP reconciliation, checklist/current-state/modules updates, proof matrix, docs verification, final `npm run verify`, and clean priority-exit review.
- Keep active plan progress/checklist closeout docs separate from implementation commits unless the controller explicitly chooses a tracked-doc commit.

## Package Decomposition

- `package_id`: `FCP-12`
- `checklist_token`: `FCP-12`
- `package_issue_ids`: n/a for FCP source-backed packages; use `source_finding_ids`
- `source_finding_ids`: `FCP-12-SF1`, `FCP-12-SF2`, `FCP-12-SF3`
- `coverage_check`:
  - `FCP-12-SF1` maps exactly to `FCP-12-S1`.
  - `FCP-12-SF2` maps exactly to `FCP-12-S2`.
  - `FCP-12-SF3` maps exactly to `FCP-12-S3`.
  - No defer path is approved at plan freeze. If a fresh slice audit source-disproves `FCP-12-SF1` or `FCP-12-SF2`, stop and update this plan so `FCP-12-S3` records the reclassification with one final owner and revisit trigger.
- `ready_now_execution_unit`: none; package complete
- `ready_now_slice`: none; package complete
- `recommended_slice_order`: `FCP-12-S1`, then `FCP-12-S2`, then `FCP-12-S3`
- `parallel_execution_policy`: serial only. Treat each `FCP-12-S*` row as its own implementation/review unit. No execution waves are approved because `S1` and `S2` both affect shared app/orchestrator import paths and `S3` depends on their final dispositions.

| slice_id | goal | areas/files | source_finding_ids | verification | dependencies | stop_condition | handoff_condition | serial_only | parallel_justification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FCP-12-S1` | Reorganize `src/core/app-shell` into focused diagnostics, deferred-screens, runtime, chrome, and config subfolders without behavior changes or compatibility exports. | `src/core/app-shell/*`, `src/core/app-shell/__tests__/*`, `src/App.ts`, `src/__tests__/App.test.ts`, directly affected app-shell imports. | `FCP-12-SF1` | targeted app-shell tests; app-shell old/new path source audits; no barrel/no cycle audit; `npm run typecheck`; `git diff --check`. | none | Stop if foldering changes DOM/startup/theme/toast/visibility behavior, creates a root barrel or compatibility layer, creates cycles, or fresh audit shows the foldering is churn rather than navigation value. | App-shell production files are grouped by approved owner cluster; public symbol names and behavior are stable; old flat imports are gone; targeted tests/audits/typecheck pass. | true | Ready-now because source audit confirms the app-shell flat folder is source-true and the clusters have stable owner/test seams. |
| `FCP-12-S2` | Reorganize `src/core/orchestrator` into focused assembly, events, runtime, controllers, policy, storage, and contracts subfolders while preserving public runtime seams and priority-one owner value. | `src/core/orchestrator/*`, `src/core/orchestrator/priority-one/*`, `src/core/orchestrator/__tests__/*`, `src/Orchestrator.ts`, `src/__tests__/Orchestrator.test.ts`, `src/__tests__/orchestrator/*`, directly affected orchestrator imports. | `FCP-12-SF2` | targeted orchestrator/priority-one tests; old/new path source audits; no barrel/no cycle audit; `npm run typecheck`; `npm run verify:architecture`; `git diff --check`. | `FCP-12-S1` clean review and committed or otherwise stable import baseline. | Stop if foldering changes runtime behavior, reopens priority-one forwarding behavior, changes `OrchestratorRuntimeSeams` or priority-one assembly contracts, changes storage context semantics, creates cycles, or needs compatibility exports. | Orchestrator files are grouped by approved owner cluster; `src/Orchestrator.ts` public exports and runtime seams are stable; targeted tests/audits/typecheck pass. | true | Orchestrator path churn is broad and shares app/runtime imports with S1, so execute after S1. |
| `FCP-12-S3` | Reconcile final FCP source findings and close the final cleanup pass only after S1/S2 are complete, source-disproved, or explicitly accepted. | `ARCHITECTURE_CLEANUP_CHECKLIST.md`, `docs/architecture/CURRENT_STATE.md`, `docs/architecture/modules.md`, this plan for status/evidence updates; source read-only audits for FCP-7 through FCP-12. | `FCP-12-SF3` | source-backed FCP proof matrix; `npm run plans:check`; `npm run verify:docs`; `npm run typecheck`; `git diff --check`; final `npm run verify`; clean closeout review. | `FCP-12-S1` and `FCP-12-S2` completed, deferred, or source-reclassified with one final owner/revisit trigger. | Stop if any original FCP source finding sentence remains source-true without an accepted owner/revisit trigger, if docs would claim closure from stale detector/line/folder output, or if same-area residue lacks one owner. | FCP-7 through FCP-12 are fixed, source-disproved, or accepted with one owner/revisit trigger; checklist/current-state/modules docs match current source; final verification and clean review are recorded. | true | Final reconciliation depends on all package dispositions and cannot run in parallel. |

No `execution_waves` are approved in this plan.

## Priority-Exit Readiness

Mapped source-finding dispositions at plan freeze:

- `FCP-12-SF1`: planned retirement by `FCP-12-S1`; current audit says app-shell foldering is behavior-neutral and worth the navigation churn.
- `FCP-12-SF2`: planned retirement by `FCP-12-S2`; current audit says orchestrator foldering is behavior-neutral and worth the navigation churn.
- `FCP-12-SF3`: planned retirement by `FCP-12-S3` after `S1` and `S2` are complete, source-disproved, or explicitly accepted.

No deferrals are approved. If implementation source-disproves foldering for `FCP-12-SF1` or `FCP-12-SF2`, the final owner is `FCP-12-S3` closeout, and the revisit trigger is the next material app-shell/orchestrator ownership change, Windows port startup/navigation work, or a maintainer-approved structure pass.

Closeout must record:

- source-backed dispositions for all `FCP-7` through `FCP-12` source findings;
- any accepted residual debt with one final owner and revisit trigger;
- package-local verification evidence, including targeted tests, source audits, `npm run typecheck`, `git diff --check`, `npm run verify:docs`, and final `npm run verify`;
- a clean closeout review.

Next-work blocking gate: do not start `FCP-EXIT`, Windows port work, or post-FCP cleanup until `FCP-12-S3` records the final proof matrix, docs/checklist updates pass, final `npm run verify` passes, and clean priority-exit review confirms no same-area FCP residue is unowned.

## Closeout Evidence

`FCP-12` completed on 2026-05-04 after the reviewed `FCP-12-S1` and
`FCP-12-S2` implementation checkpoints and this `FCP-12-S3` source-backed
closeout.

Implementation checkpoints:

- `bf87a345` (`FCP-12-S1`): organized `src/core/app-shell/` into
  `diagnostics/`, `deferred-screens/`, `runtime/`, `chrome/`, and `config/`
  without app-shell behavior changes.
- `0a1c64af` (`FCP-12-S2`): organized `src/core/orchestrator/` into
  `assembly/`, `events/`, `runtime/`, `controllers/`, `policy/`, `storage/`,
  and `contracts/` while preserving root `AppOrchestrator.ts` and
  `priority-one/`.

Source finding disposition:

- `FCP-12-SF1`: resolved. Current source no longer has the original flat
  app-shell diagnostics/deferred-screen/runtime/theme/startup/toast/container
  config root. The replacement folders own those clusters directly, no
  production imports target the old flat leaf paths, and no app-shell root
  barrel or compatibility shim exists.
- `FCP-12-SF2`: resolved. Current source no longer has the original flat
  orchestrator composition/event/runtime/controller/storage/policy root. The
  replacement folders own those clusters directly, root `AppOrchestrator.ts`
  remains the implementation facade, `priority-one/` remains the priority-one
  owner, no production imports target the old flat leaf paths, and no
  orchestrator root barrel or compatibility shim exists.
- `FCP-12-SF3`: resolved. The final source reconciliation found no unowned
  `FCP-7` through `FCP-12` residue. `FCP-7` through `FCP-11` were rechecked
  against current source and prior reviewed commits as supporting evidence, not
  copied from completed-plan summaries.

Final FCP reconciliation:

- `FCP-7`: resolved. Current source shows the server-select type cycle is gone
  through `src/modules/ui/server-select/types.ts`; architecture-rule tests keep
  `NavigationCoordinator` runtime-UI exceptions removed; `NowPlayingDebugManager`
  consumes a debug-owned refresh port; channel setup callers use canonical
  config/workflow helpers; navigation aliases `ChannelSwitchOutcome` from
  `src/types/channelSwitch.ts`; and `EventEmitter<TEventMap extends object>`
  uses `keyof TEventMap` instead of string index signatures.
- `FCP-8`: resolved. Current source shows one object-shaped Plex timeout helper
  shape for production callers; `ChannelCreateOptions` aligns
  `IChannelManager` and `ChannelManager`; `PlexMediaItem` belongs to library
  while stream uses `PlexStreamMediaItem`; Plex auth preserves sanitized causes
  and delegates Home endpoint probing to `plexHomeEndpointClient.ts`;
  `PlexLibrary` owns private `_fetchPagedMediaItems`; and channel setup/import
  error details share `formatChannelSetupWarningDetail`.
- `FCP-9`: resolved. Current source keeps `now-playing-info/styles.css` as a
  CSS import seam with leaf content rules in `styles.content.css`; architecture
  docs now name current owners; audited comments are semantic rather than
  signature restatement; and native facet planning is descriptor-driven inside
  the existing channel setup planning owner.
- `FCP-10`: resolved. Current source keeps `EPGCellRenderer.ts` as the DOM
  adapter and moves presentation/text-layout policy to
  `EPGCellPresentation.ts`; direct renderer tests cover width tiers, slivers,
  focused episode/movie layout, live/progress presentation, and ticker timing.
- `FCP-11`: resolved. Current source splits server-select runtime/focus/status
  owners, channel-setup session/focus/dropdown/build-step owners,
  ChannelManager authoring/import/persistence/cache/retry owners, and
  priority-one assembly/collaborator owner-value seams.
- `FCP-12`: resolved by `bf87a345`, `0a1c64af`, and this closeout.

Closeout source audits:

- `find src/core/app-shell -maxdepth 2 -type f | sort`
- `find src/core/orchestrator -maxdepth 2 -type f | sort`
- `find src/core/app-shell src/core/orchestrator -name 'index.ts' -o -name '*.ts' | sort`
- `rg --pcre2 -n "core/app-shell/(AppDiagnostics|AppLazy|AppShellRuntimeContracts|AppThemeController|AppStartupUiInitializer|AppToastPresenter|AppContainerFactory|AppOrchestratorConfigFactory|constants|AppBlocking|AppScreenVisibility)|core/orchestrator/(OrchestratorCoordinator|OrchestratorModuleFactory|OrchestratorEvent|OrchestratorRuntime|OrchestratorChannel|OrchestratorPlex|OrchestratorServer|OrchestratorPlayback|OrchestratorRecoverable|OrchestratorShutdown|ScheduleDay|SubtitleTrack|OverlayRuntime|ProfileSwitch|OrchestratorSchedule|OrchestratorStorage|OrchestratorTypes|OverlayPorts)" src --glob '*.ts'`
- package-local import graph audit over production `src/core/app-shell` and
  `src/core/orchestrator` files: `cycles=0 files=48`

Verification:

- `npm run plans:check`
- `npm run verify:docs`
- `npm run typecheck`
- `git diff --check`
- `npm run verify`

No deferred or accepted-residue `FCP-12` follow-ups remain. The next-work gate
is unchanged: do not start `FCP-EXIT`, Windows port work, or post-FCP cleanup
unless this closeout commit and review evidence remain clean.
