**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

# FCP-14 Priority-One Forwarding And Assembly Seam Plan

## Goal

Retire exactly `ARCHITECTURE_CLEANUP_CHECKLIST.md` item `FCP-14` by closing `FCP-14-SF1`: priority-one controller assembly rebuilds dependency interfaces mostly by forwarding grouped runtime ports, and the same seam includes a duplicate adapter handoff.

This is an `FCP-*` source-backed cleanup package. Coverage is defined only by checklist `source_finding_id` value `FCP-14-SF1`; do not use Desloppify, detector ids, imported review ids, package-map ids, stale hotspot docs, line count, score output, fresh post-FCP verification, or retrospective subjective review as intake, proof, or closeout.

Completion means the original `FCP-14-SF1` sentence is answered against current source: no-value priority-one forwarding layers are collapsed, preserved seams have source-backed controller ownership value, and no runtime public contract or behavior changes.

## Non-Goals

- Do not implement production or test code from this planning pass.
- Do not reopen completed `FCP-7` through `FCP-13`, start `FCP-15` through `FCP-20`, `FCP-EXIT`, DCR packages, legacy `FCP-EXIT`, Windows port work, or broader post-FCP cleanup.
- Do not absorb PlexAuth Home/profile/status work, scheduler/current-channel work, ContentResolver work, UI/focus behavior, persistence schema work, Plex stream URL policy, navigation behavior, or Windows platform behavior.
- Do not remove a seam that encodes controller ownership, callback adaptation, lifecycle ordering, recoverable-error reporting, event-binder dependency shaping, or explicit runtime assembly ownership.
- Do not add fallback paths, compatibility shims, root barrels, package barrels, new dependencies, or speculative helper abstractions.

## Parent Priority Alignment

`FCP-14` is the next safe package after completed `FCP-13`. The checklist states `FCP-14` is not started, belongs to the priority-one orchestrator assembly owner, and must close before `FCP-15` or later cleanup starts.

Current architecture docs say `src/core/orchestrator/priority-one/` owns the grouped priority-one runtime assembly contract plus controller/binder composition. They also say `PriorityOneAssemblyBuilder.ts` shapes `PriorityOneAssemblyInput` directly and must not add no-value field-for-field forwarding layers around that contract, while `PriorityOneControllerFactory.ts` owns playback start/runtime, overlay runtime policy, profile-switch cleanup, and event-binder assembly for the priority-one path.

`FCP-11-S4` is guardrail context, not active scope. It removed the earlier no-value `PriorityOneAssemblyBuilderInput` / `createPriorityOneAssembly` forwarding layer. Current source audit still shows a narrower FCP-14 residue: `PriorityOneAssemblyBuilder.ts` groups runtime refs into `PriorityOneAssemblyInput`, then `PriorityOneControllerCollaborators.ts` rebuilds controller-specific deps objects, with some fields acting as pure pass-through and some fields doing real adaptation. FCP-14 must collapse only the former.

## Required Reading

Read in this order before implementation or review:

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/README.md` routing table
4. `ARCHITECTURE_CLEANUP_CHECKLIST.md` sections `FCP Operating Rules`, `FCP-13`, and `FCP-14`
5. `docs/architecture/CURRENT_STATE.md`
6. `docs/architecture/modules.md`
7. `docs/agentic/session-prompts/cleanup-loop.md`
8. `docs/agentic/plan-authoring-standard.md`
9. `docs/agentic/codanna-playbook.md`
10. Completed guardrail plans only:
    - `docs/plans/2026-05-02-fcp-7-boundary-type-hygiene-plan.md`
    - `docs/plans/2026-05-02-fcp-8-api-plex-error-contract-coherence-plan.md`
    - `docs/plans/2026-05-02-fcp-9-source-signal-convention-local-elegance-plan.md`
    - `docs/plans/2026-05-02-fcp-10-epg-renderer-direct-confidence-presentation-decomposition-plan.md`
    - `docs/plans/2026-05-02-fcp-11-runtime-owner-reduction-hotspots-plan.md`, especially `FCP-11-S4`
    - `docs/plans/2026-05-02-fcp-12-package-organization-structure-navigation-final-exit-plan.md`
    - `docs/plans/2026-05-05-fcp-13-low-risk-source-signal-api-export-diagnostic-closure-plan.md`, especially closeout sequencing
11. This plan
12. Source and test files named under `## Files In Scope`
13. `git status --short --branch`

Freshness gate: stop and refresh this plan if any `FCP-14` checklist text, current priority-one architecture ownership text, source files in scope, or tests in scope changed materially after 2026-05-05.

Planning observed branch `code-health...origin/code-health` with pre-existing unrelated dirty/untracked paths. Preserve those paths unless a fresh source audit proves direct `FCP-14` overlap.

## Required Skills

- `architecture-boundaries`: required for priority-one composition, controller ownership, runtime seams, and cross-module wiring.
- `verification-strategy`: required to freeze proof depth for behavior-preserving assembly refactor work.
- `execution-plan-authoring`: required for Tier 3 source-backed FCP package planning.

Do not load `ui-composition-patterns`, `plex-integration-boundaries`, `persistence-boundaries`, or `brainstorming` unless source audit unexpectedly proves that TV-visible UI/focus behavior, Plex auth/discovery/library/stream behavior, storage-backed persistence, or unresolved product/ownership intent is truly in scope. That discovery should normally stop and replan because `FCP-14` is priority-one/orchestrator assembly only.

## Codanna Discovery

- `get_index_info`: Codanna available with 12,092 symbols across 797 files; semantic search enabled with 330 embeddings; created and updated about 1 hour before planning.
- Controller startup evidence reported the same current index shape and noted weak/noisy document search for `FCP-14`/`FCP-13`; this plan confirmed that direct checklist reads are the deterministic FCP membership source.
- `search_documents "FCP-14 priority-one forwarding assembly seam FCP-13 closeout checklist"`: returned noisy low-score plan/design hits and did not return the checklist as authoritative. Direct reads of `ARCHITECTURE_CLEANUP_CHECKLIST.md`, current architecture docs, and guardrail FCP plans are the fallback membership and sequencing source.
- `semantic_search_with_context "priority-one controller assembly forwarding ports PriorityOneAssemblyBuilder PriorityOneControllerCollaborators OrchestratorRuntimeSeams"`: weak/noisy for the exact seam; top useful result was broad `AppOrchestrator`, not the priority-one files. Direct symbol and source reads are required.
- `semantic_search_with_context "createPriorityOneRuntimeAssembly PriorityOneAssemblyInput PriorityOneControllerFactory PlaybackRuntimeController ProfileSwitchCleanupController"`: weak/noisy; did not find the exact priority-one seam. Direct symbol and source reads are required.
- `find_symbol PriorityOneAssemblyInput` -> symbol_id `9572`; `analyze_impact` showed 18 affected symbols, including `buildPriorityOneAssemblyInput`, `createPriorityOneRuntimeAssembly`, `createPriorityOneControllersAndBinder`, all controller collaborator creators, and `AppOrchestrator._initializePriorityOneControllers`.
- `find_symbol createPriorityOneRuntimeAssembly` -> symbol_id `9577`; `analyze_impact` showed impact through `AppOrchestrator.initialize` and `_initializePriorityOneControllers`.
- `find_symbol PriorityOneRuntimeAssemblyInput` -> symbol_id `9575`; `analyze_impact` showed impact through `buildPriorityOneAssemblyInput`, `createPriorityOneRuntimeAssembly`, and `AppOrchestrator` initialization.
- `find_symbol buildPriorityOneAssemblyInput` -> symbol_id `9576`; `analyze_impact` showed impact through `createPriorityOneRuntimeAssembly` and `AppOrchestrator` initialization.
- `find_symbol createPriorityOneControllersAndBinder` -> symbol_id `9544`; `analyze_impact` showed impact through `createPriorityOneRuntimeAssembly` and `AppOrchestrator` initialization.
- `find_symbol PlaybackRuntimeController` -> symbol_id `9554`; `analyze_impact` showed 9 affected symbols including `createPlaybackRuntimeController`, `createEventBinderDeps`, `createPriorityOneRuntimeAssembly`, `createPriorityOneControllersAndBinder`, and `AppOrchestrator` require/build paths.
- `find_symbol ProfileSwitchCleanupController` -> symbol_id `9190`; `analyze_impact` showed 9 affected symbols including profile-select app-shell ports, `AppOrchestrator` profile-switch methods, and priority-one controller factory/collaborator functions.
- `find_symbol` / `search_symbols` for `PriorityOneControllerCollaborators`, `PriorityOneAssemblyBuilder`, `PriorityOneControllerFactory`, and `OrchestratorRuntimeSeams` returned no file-level symbols. This is a Codanna limitation for file/module names; `rg` and direct file reads are authoritative for those files.
- `rg` / direct source reads covered `PriorityOneAssemblyBuilder.ts`, `PriorityOneControllerCollaborators.ts`, `PriorityOneAssemblyInput.ts`, `PriorityOneControllerFactory.ts`, `OrchestratorRuntimeSeams.ts`, `PlaybackRuntimeController.ts`, `ProfileSwitchCleanupController.ts`, `AppOrchestrator._initializePriorityOneControllers`, and affected tests.

## Impact Snapshot

Current-source proof at plan time:

- `PriorityOneAssemblyBuilder.ts` exposes `PriorityOneRuntimeAssemblyInput`, then `buildPriorityOneAssemblyInput` reshapes it into `PriorityOneAssemblyInput`. Some of that reshaping is ownerful adaptation: channel transition activity null-safety, `syncChannelBadgeOverlay` closure wiring after controller creation, recoverable transcode-stop error reporting, UI side-effect aggregation for program start, debug-HUD fire-and-forget behavior, event cleanup reporting, and optional runtime-controller fallbacks.
- The same builder also contains pure forwarding candidates: grouped module/surface fields and simple method fields that are passed through only to be rebuilt into controller deps in `PriorityOneControllerCollaborators.ts`.
- `PriorityOneControllerCollaborators.ts` creates controller-specific dependency objects for overlay policy, playback start, playback runtime, profile-switch cleanup, and event binding. Several callbacks translate or combine ownership boundaries and must be preserved; other callbacks simply forward grouped runtime-port methods under another name and are the likely FCP-14 collapse target.
- `PriorityOneAssemblyInput.ts` currently groups modules, optional surfaces, playback runtime, scheduler runtime, player events, UI runtime, event runtime, and `nowPlayingModalId`. That public internal seam is valuable only if the grouped contract directly feeds controller collaborators without no-value duplicate handoff.
- `PriorityOneControllerFactory.ts` owns controller/binder construction order. The construction order and `PriorityOneControllersAndBinder` return shape are ownerful and must remain stable unless a source audit proves a narrower internal type simplification is safe.
- `OrchestratorRuntimeSeams.ts` owns priority-one runtime port contracts. It is in scope only where port shapes need to remove no-value forwarding; it must not become a dumping ground or widen runtime public contracts.
- `PlaybackRuntimeController.ts` and `ProfileSwitchCleanupController.ts` own runtime behavior and profile-switch cleanup ordering. They are in scope only for dependency-contract alignment if no-value adapter callbacks collapse; behavior and method ordering must remain unchanged.
- `AppOrchestrator._initializePriorityOneControllers` is the single production caller of `createPriorityOneRuntimeAssembly`. It is in scope only for call-site input wiring if the internal assembly contract changes.
- Affected tests discovered by source audit include `src/core/orchestrator/__tests__/PriorityOneAssemblyBuilder.test.ts`, `src/core/orchestrator/__tests__/PriorityOneControllerCollaborators.test.ts`, `src/core/orchestrator/__tests__/PriorityOneControllerFactory.playbackState.test.ts`, `src/core/orchestrator/__tests__/OrchestratorRuntimeSeams.test.ts`, `src/core/__tests__/PlaybackRuntimeController.test.ts`, `src/core/__tests__/ProfileSwitchCleanupController.test.ts`, `src/__tests__/orchestrator/lifecycle-resume-race.test.ts`, and `src/__tests__/Orchestrator.test.ts` only if the AppOrchestrator initialization/assignment path is touched.

## Files In Scope

- `src/core/orchestrator/priority-one/PriorityOneControllerCollaborators.ts`
- `src/core/orchestrator/priority-one/PriorityOneAssemblyBuilder.ts`
- `src/core/orchestrator/priority-one/PriorityOneAssemblyInput.ts`
- `src/core/orchestrator/priority-one/PriorityOneControllerFactory.ts`
- `src/core/orchestrator/priority-one/PlaybackRuntimeController.ts`
- `src/core/orchestrator/runtime/OrchestratorRuntimeSeams.ts`
- `src/core/orchestrator/controllers/ProfileSwitchCleanupController.ts`
- `src/core/orchestrator/AppOrchestrator.ts` only for the `createPriorityOneRuntimeAssembly` call-site input wiring and priority-one controller assignment seam if required by the approved internal contract cleanup
- `src/core/orchestrator/__tests__/PriorityOneAssemblyBuilder.test.ts`
- `src/core/orchestrator/__tests__/PriorityOneControllerCollaborators.test.ts`
- `src/core/orchestrator/__tests__/PriorityOneControllerFactory.playbackState.test.ts`
- `src/core/orchestrator/__tests__/OrchestratorRuntimeSeams.test.ts`
- `src/core/__tests__/PlaybackRuntimeController.test.ts`
- `src/core/__tests__/ProfileSwitchCleanupController.test.ts`
- `src/__tests__/orchestrator/lifecycle-resume-race.test.ts` if playback runtime lifecycle wiring is touched
- `src/__tests__/Orchestrator.test.ts` only if the AppOrchestrator initialization/assignment path is touched
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` only during package closeout after clean review and verification
- `docs/architecture/CURRENT_STATE.md` and `docs/architecture/modules.md` only if source audit or closeout proves architecture truth changed

## Files Out Of Scope

- Any runtime/source file not named in `## Files In Scope`
- Plex auth, Plex discovery, Plex library, Plex stream URL/subtitle/transcode policy, and PlexAuth Home/profile/status helper work
- Scheduler/channel-manager ownership, current-channel persistence, channel persistence schema, raw localStorage ownership, storage keys, migrations, and selected-server persistence
- Navigation behavior, public navigation API changes, app-shell deferred-screen behavior, UI screens, overlays, focus, motion, CSS, and TV-visible behavior
- ContentResolver decomposition, package folder reorganization, root/package barrels, compatibility exports, and Windows platform behavior
- Broad `src/core/orchestrator/AppOrchestrator.ts` refactors outside the priority-one call-site seam
- Completed `FCP-7` through `FCP-13` implementation work except as read-only guardrails
- Pre-existing unrelated dirty/untracked files

## Planner Self-Check

1. No unresolved package-level owner seam remains: `FCP-14-SF1` maps exactly once to `FCP-14-S1`.
2. Adjacent contract/type changes are explicit: `PriorityOneAssemblyInput`, `PriorityOneControllerFactory`, and the `AppOrchestrator` call site are in scope only where the priority-one internal contract requires it.
3. Files out of scope are not hidden implementation dependencies. If implementation needs UI, Plex, persistence, navigation, Windows, scheduler ownership, or broad AppOrchestrator changes, it must stop and replan.
4. Codanna evidence and insufficiencies are recorded, including weak semantic/doc search and direct-read fallback for file-level seams.
5. The plan uses repo-preferred owners: priority-one assembly stays in `priority-one/`, runtime port contracts stay in `OrchestratorRuntimeSeams.ts`, controller behavior stays in the existing controllers, and `AppOrchestrator` remains only a call-site/composition owner.
6. A fresh cleanup-loop session can start `ready_now_execution_unit` `FCP-14-S1` without deciding package membership, final owners, or verification depth.
7. The plan is execution-grade at seam/scope/verification level and deliberately leaves local helper names, exact type names, and routine code shape to the cleanup worker.

## Architecture Seam Decision Gate

Approved seam:

- Execute one slice, `FCP-14-S1`, in the priority-one assembly owner.
- Collapse only no-value forwarding that takes a grouped runtime port or module/surface value, renames or rewraps it without translation, and immediately rebuilds another dependency interface for the same consumer.
- Preserve seams that encode owner value, including null-safe optional runtime surface adaptation, `syncChannelBadgeOverlay` delayed controller handoff, recoverable error reporting, cleanup rollback reporting, event-binder dependency shaping, playback-state mutation policy, profile-switch cleanup ordering, lifecycle pause/resume ordering, and `PriorityOneControllersAndBinder` construction order.
- Keep `AppOrchestrator` as a composition/call-site owner only. It may pass the approved priority-one assembly input shape, but it must not regain controller dependency-building logic.
- If source audit proves a direct-forwarding layer carries owner value, record that disposition in implementation output and package closeout instead of forcing churn.

Stop and replan if:

- direct forwarding proves necessary to preserve an explicit cross-module seam, lifecycle ordering, controller ownership, or public runtime assembly clarity;
- the work needs a runtime public contract change outside the priority-one internal assembly contract;
- implementation needs UI/focus behavior changes, Plex behavior changes, persistence/storage changes, navigation behavior changes, scheduler/channel-manager ownership changes, ContentResolver work, Windows behavior, or broad AppOrchestrator refactoring;
- tests require private probing instead of public seam proof;
- source audit shows the `FCP-14-SF1` sentence is already false and planned edits would be churn;
- newly discovered residue changes package membership, execution-unit membership, final-owner accounting, or verification surface.

Absorb-now rule: absorb only newly discovered residue that stays within the same approved execution-unit goal, owner, seam/files, verification envelope, and final-owner accounting. Record absorbed residue in implementation/review output. Replan for new owners, wider verification, changed source-finding coverage, or changed execution-unit membership.

## Verification Commands

Verification classification: `new regression/contract test required`.

Primary proof mode: `refactor-invariance` for behavior-preserving assembly cleanup, with `contract-first` proof for priority-one internal assembly/port contract changes.

Plan validation:

- Run: `npm run plans:check`
  - Expected: this active tracked plan satisfies Universal Plan Core and FCP cleanup-overlay structure.
- Run after active plan creation/update: `npm run verify:docs`
  - Expected: docs/control-plane verification passes for the active plan. Run again during package closeout if checklist/current-state/modules/plan docs are updated.

Ready-now `FCP-14-S1` source-audit proof:

- Pre-edit source audit over `PriorityOneAssemblyBuilder.ts`, `PriorityOneAssemblyInput.ts`, `PriorityOneControllerCollaborators.ts`, `PriorityOneControllerFactory.ts`, `OrchestratorRuntimeSeams.ts`, `PlaybackRuntimeController.ts`, `ProfileSwitchCleanupController.ts`, and `AppOrchestrator._initializePriorityOneControllers`.
  - Expected: implementation can name each removed layer as pure forwarding and each preserved seam as ownerful adaptation.
- Post-edit source audit over the same files.
  - Expected: no no-value double forwarding remains for `FCP-14-SF1`; preserved seams have explicit owner value; `AppOrchestrator` remains composition/call-site only.

Focused tests:

- Run: `npm test -- PriorityOneAssemblyBuilder PriorityOneControllerCollaborators PriorityOneControllerFactory`
  - Expected: priority-one runtime assembly, controller collaborator, playback-state wiring, event binder, overlay, and profile-switch wiring remain behaviorally unchanged or are updated to the approved contract shape.
- Run: `npm test -- PlaybackRuntimeController ProfileSwitchCleanupController OrchestratorRuntimeSeams`
  - Expected: controller dependency contracts, playback lifecycle/runtime behavior, profile-switch cleanup ordering, and runtime seam fixtures remain valid.
- Run: `npm test -- lifecycle-resume-race`
  - Expected: playback runtime lifecycle resume race behavior remains unchanged if lifecycle wiring or playback runtime deps are touched.
- Run affected `AppOrchestrator` initialization/priority-one wiring tests if `AppOrchestrator.ts` or priority-one controller assignment is touched.
  - Expected: priority-one controller initialization still assigns overlay, playback runtime, profile-switch cleanup, and event binder once required modules are present.

Static and package gates:

- Run: `npm run typecheck`
  - Expected: no TypeScript errors after contract/import/signature changes.
- Run: `git diff --check`
  - Expected: no whitespace errors before commits and package closeout.
- Run: `npm run verify`
  - Expected: full UI/navigation/orchestrator/Plex/runtime gate passes before marking `FCP-14` complete because orchestrator/runtime source changes are likely.

Package closeout:

- Source-finding proof matrix for `FCP-14-SF1`.
  - Expected: the original source finding sentence is answered as fixed, source-disproved, deferred, or reclassified with one final owner. No detector/imported ids are used.
- Package-local old/replacement pattern audits for no-value forwarding and duplicate adapter handoff.
- Run: `npm run plans:check`
- Run: `npm run verify:docs` if checklist/current-state/modules/plan docs are updated during closeout.
- Run: `git diff --check`
- Run: `npm run verify`
- Obtain clean closeout review before `FCP-15` starts.

## Rollback Notes

- Roll back by the single execution unit, `FCP-14-S1`.
- If parity fails, restore the previous priority-one assembly and collaborator dependency shape, then keep any new or tightened public-seam tests that exposed the parity gap.
- If a removed adapter proves ownerful, restore that adapter and record why it remains accepted priority-one structure rather than forcing collapse.
- If docs/checklist closeout fails, leave reviewed source/test changes intact and fix tracked docs in a separate controller-owned closeout pass.

## Commit Checkpoints

- `FCP-14-S1` implementation checkpoint: priority-one forwarding collapse plus focused priority-one/orchestrator tests and source audit.
- Closeout checkpoint: after implementation has clean review and `npm run verify` passes, update `ARCHITECTURE_CLEANUP_CHECKLIST.md` and any narrow current architecture docs only if source audit proves architecture truth changed. Keep active tracked plan progress/checklist closeout separate from implementation commits unless the controller explicitly chooses a tracked-doc commit.

## Package Decomposition

- `package_id`: `FCP-14`
- `checklist_token`: `FCP-14`
- `package_issue_ids`: n/a for FCP source-backed packages; use `source_finding_ids`
- `source_finding_ids`: `FCP-14-SF1`
- `coverage_check`:
  - `FCP-14-SF1` maps exactly to `FCP-14-S1`.
- `ready_now_execution_unit`: `FCP-14-S1`
- `ready_now_slice`: `FCP-14-S1`
- `recommended_slice_order`: `FCP-14-S1`, then package closeout source audit and docs/checklist updates if earned.
- `parallel_execution_policy`: serial single-slice package. No parallel worker split and no execution wave are approved. Implementation and review should treat `FCP-14-S1` as one coherent priority-one assembly unit.

| slice_id | goal | areas/files | source_finding_ids | verification | dependencies | stop_condition | handoff_condition | serial_only | parallel_justification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FCP-14-S1` | Collapse priority-one forwarding layers that add no owner value while preserving controller ownership seams. | `src/core/orchestrator/priority-one/PriorityOneAssemblyBuilder.ts`, `PriorityOneAssemblyInput.ts`, `PriorityOneControllerCollaborators.ts`, `PriorityOneControllerFactory.ts`, `PlaybackRuntimeController.ts`, `src/core/orchestrator/runtime/OrchestratorRuntimeSeams.ts`, `src/core/orchestrator/controllers/ProfileSwitchCleanupController.ts`, `src/core/orchestrator/AppOrchestrator.ts` call site only if required, and affected priority-one/orchestrator tests. | `FCP-14-SF1` | Pre/post source audits for removed pure forwarding and preserved owner-value seams; `npm test -- PriorityOneAssemblyBuilder PriorityOneControllerCollaborators PriorityOneControllerFactory`; `npm test -- PlaybackRuntimeController ProfileSwitchCleanupController OrchestratorRuntimeSeams`; `npm test -- lifecycle-resume-race` and affected AppOrchestrator tests as touched; `npm run typecheck`; `git diff --check`; package closeout `npm run verify`. | none | Stop if a forwarding layer carries controller owner value; if public runtime contracts, UI/focus behavior, Plex behavior, persistence behavior, navigation behavior, scheduler/channel-manager ownership, Windows behavior, or broad AppOrchestrator refactor is needed; or if proof requires private probing. | The `FCP-14-SF1` sentence is false for current source, or any retained forwarding is source-justified with one final owner/revisit trigger; tests/audits/typecheck/verify pass. | true | Single owner seam across tightly coupled priority-one assembly and controller deps; splitting would duplicate source audits and weaken parity proof. |

## Priority-Exit Readiness

This plan is intended to close the whole `FCP-14` package before `FCP-15` can start.

- FCP source findings mapped: `FCP-14-SF1`.
- No detector/imported ids are in scope.
- No deferred or split follow-ups are approved at plan start.
- If implementation source-disproves part of `FCP-14-SF1`, the final owner remains `FCP-14-S1` closeout unless the source-disproved path reveals a different owner or verification surface, in which case stop and replan.
- If a direct-forwarding seam remains because it carries owner value, closeout must name the exact retained seam, final owner, reason it remains, and revisit trigger. Do not create a follow-up solely from stale detector wording or line-count output.
- Before any `FCP-15` planning or work starts, `FCP-14` must have a source-finding proof matrix, package-local old/replacement pattern audits, targeted priority-one/orchestrator tests, `npm run typecheck`, `git diff --check`, `npm run verify`, any required `npm run verify:docs`, updated checklist/current-state records if ownership truth changed, and clean closeout review.
- Security gate: no open P0 security findings are known for this package from source audit. If implementation discovers one, stop and route it as a blocker with one owner.
