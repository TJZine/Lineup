**Plan Status:** completed
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

# FCP-11 Runtime Owner Reduction Hotspots Plan

## Goal

Retire exactly `ARCHITECTURE_CLEANUP_CHECKLIST.md` item `FCP-11` by proving or reducing the remaining runtime owner-concentration hotspots in server-select, channel setup, channel-manager, and priority-one runtime assembly.

This is an FCP source-backed cleanup package. Coverage is defined only by checklist `source_finding_id` values `FCP-11-SF1`, `FCP-11-SF2`, `FCP-11-SF3`, and `FCP-11-SF4`; do not use Desloppify ids, detector ids, imported review ids, package-map ids, stale hotspot docs, line count, or score deltas for intake, proof, or closeout.

## Non-Goals

- Do not implement production or test code from this plan-writing pass.
- Do not reopen `FCP-7`, `FCP-8`, `FCP-9`, `FCP-10`, `DCR-14`, `FCP-12`, or the standalone server-select list-view closeout plan.
- Do not change Plex auth, discovery, library, stream resolution, subtitle delivery, playback URL logic, selected-server persistence schema, channel persistence schema, navigation public API, or platform policy.
- Do not perform open-ended large-file rewrites or close a finding by extracting one helper while the original mixed-responsibility sentence remains source-true.
- Do not add fallback or compatibility paths unless a maintainer explicitly approves them after a replan.

## Parent Priority Alignment

`FCP-11` is the active final-cleanup package after completed `FCP-10`. It is checklist-linked Tier 3 cleanup-loop work and must keep `slice_table` as the atomic ownership map, with one ready-now execution unit before implementation starts.

Current architecture docs still list `ChannelSetupScreen` as a primary structural hotspot. They also record `ChannelManager` and priority-one as important owner surfaces, not current file-size proof by themselves. This plan therefore uses current source, tests, and ownership seams to decide closure, not stale hotspot wording.

FCP-7/server-select reconciliation: current source proves the FCP-7 list-view/type-cycle concern is closed. `ServerSelectListView.ts` imports shared `ServerSelectDisplayState` from `types.ts`, no longer imports `ServerSelectScreen.ts`, and `ServerSelectListView.test.ts` now exists. That does not close `FCP-11-SF1`: `ServerSelectScreen.ts` still owns screen shell setup, async discovery, saved-server reconnect, manual select, clear-selection, status/error policy, focus registration, visibility generation, and idle tracking. `FCP-11-S1` remains valid and is the ready-now unit.

## Required Reading

Read in this order before implementation or review:

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/README.md`
4. `ARCHITECTURE_CLEANUP_CHECKLIST.md` sections `FCP Operating Rules`, `FCP-7`, `FCP-10`, and `FCP-11`
5. `docs/architecture/CURRENT_STATE.md`
6. `docs/architecture/modules.md`
7. `docs/agentic/session-prompts/cleanup-loop.md`
8. `docs/agentic/plan-authoring-standard.md`
9. `docs/agentic/codanna-playbook.md`
10. `docs/plans/2026-05-02-fcp-7-boundary-type-hygiene-plan.md` as server-select/list-view background only
11. `docs/plans/2026-05-02-fcp-10-epg-renderer-direct-confidence-presentation-decomposition-plan.md` as completed-background guardrail only
12. `docs/plans/2026-05-01-server-select-list-view-extraction-plan.md` only as pre-existing read-only server-select background if relevant
13. This plan
14. Source and test files named under `## Files In Scope`
15. `git status --short --branch`

Freshness gate: stop and refresh this plan if any FCP-11 checklist text, current architecture ownership text, source files in scope, or public contracts named here changed materially after 2026-05-02.

## Required Skills

- `architecture-boundaries`: primary skill for runtime ownership moves, hotspot class decomposition, public seams, and orchestrator/priority-one assembly.
- `ui-composition-patterns`: required for server-select and channel setup screen rendering, focus, status, timer/listener, and TV-visible behavior.
- `persistence-boundaries`: required for `FCP-11-S3`; ChannelManager remains persistence-adjacent and must preserve `ChannelPersistenceStore` schema and public channel contracts.
- `verification-strategy`: choose proof by behavior seam, not by line-count reduction.
- `execution-plan-authoring`: keep this package decision-complete without writing patch prose.

`plex-integration-boundaries` is intentionally not loaded for implementation. If any slice needs Plex-specific auth/discovery/library/stream contract changes, stop and replan instead of implementing. `brainstorming` was not used because source audit decided the owner seams without a maintainer choice.

## Codanna Discovery

- `get_index_info`: Codanna available; 11,827 symbols across 775 files, semantic search enabled, updated about 50 minutes before planning.
- `search_documents "FCP-11 Runtime Owner Reduction Hotspots source findings ServerSelectScreen ChannelSetupScreen ChannelManager priority-one"`: returned noisy low-score docs and did not surface the authoritative checklist. Direct checklist reads are the FCP-11 membership source.
- `semantic_search_with_context "ServerSelectScreen discovery select reconnect focus status visibility idle tracking ServerSelectListView"`: surfaced app/orchestrator server-select entrypoints, but not the screen/list ownership details. Direct source reads were required for the package-local seam.
- `find_symbol ServerSelectScreen` -> `symbol_id:6080`; `analyze_impact` showed limited app-shell impact through `AppLazyScreenRegistry`, `AppScreenVisibilityCoordinator`, and `App`.
- `find_symbol renderServerSelectList` -> `symbol_id:5995`; `analyze_impact` showed the caller path is `ServerSelectScreen._renderServers` and related load/select/clear paths.
- `semantic_search_with_context "ChannelSetupScreen wizard progress rendering dropdown interaction session focus lifecycle"`: weak/noisy; direct source reads were required.
- `find_symbol ChannelSetupScreen` -> `symbol_id:7264`; `analyze_impact` showed app-shell visibility/registry impact only.
- `semantic_search_with_context "ChannelManager create channel import export persistence cache retry ChannelPersistenceStore ChannelImportNormalizer"`: found channel-manager type anchors, not class responsibility/caller proof.
- `find_symbol ChannelManager` and `analyze_impact ChannelManager`: insufficient; Codanna misreported/no impact for the class despite current source/tests importing it. `search_symbols ChannelManager` found the class at `ChannelManager.ts:239`, but impact remained unreliable. Direct `rg`/source reads are authoritative for `FCP-11-SF3`.
- `semantic_search_with_context "priority-one controller assembly forwarding ports PriorityOneAssemblyBuilder PriorityOneControllerFactory OrchestratorRuntimeSeams"`: weak/noisy for priority-one.
- `search_symbols PriorityOne`, `find_symbol createPriorityOneAssembly`, `find_symbol buildPriorityOneAssemblyInput`, and `find_symbol createPriorityOneControllersAndBinder`: found the priority-one assembly functions. `analyze_impact createPriorityOneAssembly` showed impact through `createPriorityOneRuntimeAssembly` and `AppOrchestrator._initializePriorityOneControllers`.
- `rg`/direct source reads: used for line-local ownership proof, import direction, tests present, persistence adjacency, and direct-forwarding assembly shape because Codanna was insufficient for those package-local relationships.

Key Codanna insufficiencies to carry into implementation: document search did not find authoritative FCP-11 membership; channel setup semantic search was noisy; ChannelManager symbol/impact data is stale or malformed; priority-one semantic search missed the actual assembly shape and required symbol search plus direct source.

## Impact Snapshot

- `FCP-11-SF1`: `ServerSelectScreen.ts` is 938 lines and still owns shell creation, action buttons, async discovery/autoconnect/select/clear flows, status/error policy, focus registration, visibility generations, and `whenIdle` tracking. `ServerSelectListView.ts` is now DOM-list-only and has direct tests, so the FCP-7 type-cycle concern is source-disproved for FCP-11 planning.
- `FCP-11-SF2`: `ChannelSetupScreen.ts` is 924 lines and uses package-local step/session/focus collaborators, but still coordinates show/hide, library load, key listener lifecycle, wizard step switching, dropdown lifecycle, build review kickoff, build progress DOM mutation, cancel/blocked/error/success UI, and preview-row delta rendering.
- `FCP-11-SF3`: `ChannelManager.ts` is 1,352 lines and still spans channel authoring, import/export, state/order mutation, persistence coordination through `ChannelRepository`/`ChannelPersistenceSaveQueue`, content-resolution cache ownership, stale fallback, and retry timers. Existing collaborators (`ChannelRepository`, `ChannelPersistenceSaveQueue`, `ChannelImportNormalizer`, `ContentResolver`) reduce but do not make the original source sentence false.
- `FCP-11-SF4`: priority-one already has controller collaborators, but `PriorityOneAssemblyBuilder.ts` still creates a 45-field intermediate `PriorityOneAssemblyBuilderInput` and `createPriorityOneAssembly` mostly repackages those fields into `PriorityOneAssemblyInput`. Direct forwarding exists, but some wrappers preserve real owner value by adapting runtime controller callbacks, recoverable error reporting, channel badge sync, and event binder seams.
- Public/shared symbols likely impacted by implementation: `ServerSelectScreen`, `renderServerSelectList`, `ChannelSetupScreen`, `IChannelManager`, `ChannelManager`, `ChannelCreateInput`, `ChannelCreateOptions`, `ChannelManagerEventMap`, `ChannelPersistenceStore`/`ChannelRepository` APIs, `PriorityOneRuntimeAssemblyInput`, `PriorityOneAssemblyInput`, `createPriorityOneRuntimeAssembly`, `createPriorityOneAssembly`, and `createPriorityOneControllersAndBinder`.
- Persistence impact: `FCP-11-S3` may move coordination code but must not change storage keys, serialized channel schema, current-channel schema, or raw localStorage ownership. `ChannelPersistenceStore` remains the schema/storage owner; `ChannelManager`/new collaborators consume typed repository/store APIs only.

## Files In Scope

- `src/modules/ui/server-select/ServerSelectScreen.ts`
- `src/modules/ui/server-select/ServerSelectListView.ts`
- `src/modules/ui/server-select/types.ts`
- new server-select package-local runtime/focus/status collaborators if `FCP-11-S1` proves the seam
- `src/modules/ui/server-select/__tests__/*`
- `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
- existing and new channel setup package-local rendering, interaction, build-progress, session, and focus collaborators
- `src/modules/ui/channel-setup/__tests__/*`
- `src/modules/ui/channel-setup/steps/**/*`
- `src/modules/ui/channel-setup/focus/**/*`
- `src/modules/scheduler/channel-manager/ChannelManager.ts`
- `src/modules/scheduler/channel-manager/interfaces.ts`
- `src/modules/scheduler/channel-manager/types.ts`
- existing and new scheduler/channel-manager package-local authoring, import/export, persistence-coordination, cache, and retry collaborators
- `src/modules/scheduler/channel-manager/__tests__/*`
- `src/core/orchestrator/priority-one/*`
- `src/core/orchestrator/OrchestratorRuntimeSeams.ts`
- `src/core/orchestrator/AppOrchestrator.ts` only for the approved priority-one assembly call-site seam
- priority-one/orchestrator tests under `src/core/orchestrator/__tests__/`
- `docs/architecture/CURRENT_STATE.md`, `docs/architecture/modules.md`, and `ARCHITECTURE_CLEANUP_CHECKLIST.md` only during package closeout or if an implementation slice changes public ownership truth

## Files Out Of Scope

- Plex auth Home endpoint/client cleanup owned by `FCP-8`
- EPG renderer cleanup owned by `FCP-10`
- package folder reorganization owned by `FCP-12`
- `src/modules/plex/**` production contracts unless a stop/replan gate promotes separate Plex work
- selected-server persistence schema and app-shell selected-server result contract
- channel persistence schema, storage key names, raw localStorage helpers, and `ChannelPersistenceStore` serialization semantics
- broad `src/App.ts` or `src/core/orchestrator/AppOrchestrator.ts` refactors outside the priority-one assembly call-site seam
- navigation public API changes
- CSS/visual redesign
- unrelated dirty/untracked files listed by the controller task input

## Planner Self-Check

1. No unresolved package-level owner seam remains: each `FCP-11-SF*` maps to one slice and one target owner set.
2. Adjacent public contract changes are not implicit. If a public channel, persistence, Plex, navigation, or runtime contract must change, the slice stops for replan.
3. Files out of scope are not hidden implementation dependencies; `AppOrchestrator.ts` is in scope only for `FCP-11-S4` call-site wiring.
4. Codanna evidence and fallback reads are recorded, including the weak ChannelManager and priority-one relationship data.
5. The plan avoids growing hotspots: each slice extracts package-local owners or source-disproves the current finding.
6. A fresh cleanup-loop session can start `ready_now_execution_unit` `FCP-11-S1` without deciding package membership or verification policy.
7. This is execution-grade at seam/scope/verification level while leaving helper names and local code structure to the implementer.

## Architecture Seam Decision Gate

Approved seams:

- `FCP-11-S1`: keep `ServerSelectScreen` as the public screen adapter and shell owner. Extract package-local owners only for runtime workflow/status/focus/session responsibilities needed to make the original finding false. The required owner set is: screen DOM adapter, server-select session/runtime workflow owner, server-select focus owner, and status/display policy owner. `ServerSelectListView` remains DOM-list rendering only.
- `FCP-11-S2`: keep `ChannelSetupScreen` as the public screen adapter. Extract enough package-local owners to separate build review/progress rendering, dropdown lifecycle, and session/focus delegation. The required owner set is: screen shell adapter, session/runtime owner, focus owner, strategy interaction/dropdown owner, build review/progress presenter owner, and step view controllers.
- `FCP-11-S3`: keep `ChannelManager` as the public `IChannelManager` API/state facade. Extract package-local owners for channel authoring/default shaping, import/export orchestration, persistence coordination, resolved-content cache/clone policy, and retry scheduling where source audit proves concentration. `ChannelPersistenceStore` remains the storage/schema owner and public channel contracts stay stable.
- `FCP-11-S4`: collapse only priority-one direct forwarding layers that add no translation. Preserve explicit seams that add owner value: runtime-controller callback adaptation, recoverable failure reporting, channel badge sync indirection, event binder dependency shaping, and public `PriorityOneRuntimeAssemblyInput` grouping if it remains the clearest boundary.

Stop and replan if:

- any slice needs Plex-specific contract changes;
- any slice needs persistence schema/key changes, raw storage ownership changes, or migration behavior changes;
- public channel contracts, public runtime seams, or navigation APIs must change;
- a slice becomes a feature rewrite, visual redesign, or broad package reorganization;
- focus behavior changes without targeted tests;
- extraction creates a second screen/controller with hidden lifecycle ownership;
- direct forwarding proves necessary to preserve an explicit cross-module seam;
- the implementer cannot state how the original mixed-responsibility sentence becomes false;
- new residue changes package membership, execution-unit membership, final-owner accounting, or verification surface.

Absorb-now rule: absorb only newly discovered residue that stays within the same approved execution unit goal, same owner, same seam/files, same verification envelope, and same final-owner accounting. Record absorbed residue in implementation/review output. Replan for new owners, wider verification, changed source-finding coverage, or changed execution-unit membership.

## Verification Commands

Verification strategy classification: `new regression/contract test required`.

Primary proof mode: refactor-invariance for behavior-preserving owner reduction, with contract-first tests at public seams when behavior is subtle. Do not use private probes as closure proof; if tests need internals, extract a real collaborator or add public behavior proof.

Plan validation:

- `npm run plans:check`
  - Expected: this active plan satisfies Universal Plan Core and FCP cleanup overlay conformance.

Per-slice required verification:

- `FCP-11-S1`: run `npm test -- ServerSelectListView ServerSelectScreen`; add/update public-seam tests for discovery, saved reconnect, manual select, clear-selection, status/error, idle, focus registration/restoration, hidden/stale generation behavior, and direct list-view contract only if the owner move affects them.
- `FCP-11-S2`: run targeted channel setup UI tests for `ChannelSetupScreen`, `ChannelSetupSessionController`, `ChannelSetupSessionRuntime`, `ChannelSetupFocusCoordinator`, `StrategyStepController`, `StrategyStepInteractionController`, `BuildReviewStepController`, and `BuildProgressStepController` as touched; cover wizard render/interaction/session/focus/dropdown/build-progress behavior before and after extraction.
- `FCP-11-S3`: run targeted `ChannelManager` suites, including content resolution, stale fallback, error semantics, import order, persistence, transactional, `ChannelPersistenceSaveQueue`, `ChannelRepository`, `ChannelPersistenceStore`, and `ChannelImportNormalizer` as touched. Preserve public channel contracts and persistence schema.
- `FCP-11-S4`: run priority-one/orchestrator tests for `PriorityOneAssemblyBuilder`, `PriorityOneControllerFactory`, `PriorityOneControllerCollaborators`, `PlaybackStartController`, `PlaybackRuntimeController`, `OrchestratorEventBinder`, and `AppOrchestrator` initialization seams as touched.

Package-level gates:

- Source audits after each slice: old responsibilities moved out of the hotspot owner; no private-probe tests; no new raw storage access; no stale line-count-only closure claim.
- `npm run typecheck`
  - Expected: no TypeScript errors after any TypeScript changes.
- `git diff --check`
  - Expected: no whitespace errors before commits and package closeout.
- `npm run verify:docs`
  - Expected: required if checklist, workflow, plan, current-state, or module-reference docs change.
- `npm run verify`
  - Expected: full UI/navigation/orchestrator/persistence runtime closeout gate passes before marking `FCP-11` complete.

Closeout source review must answer, for each `source_finding_id`, whether the original source finding sentence still describes current source. If yes, continue the package or record accepted residue with one final owner and revisit trigger. If no, close with source proof.

## Rollback Notes

- Roll back by execution unit, not by package.
- If `FCP-11-S1` behavior parity fails, restore the previous `ServerSelectScreen` workflow/status/focus ownership and keep any valid public tests that exposed the gap.
- If `FCP-11-S2` extraction changes wizard focus, dropdown, build progress, or session lifecycle behavior, revert that slice and keep collaborator tests that still prove the intended public seam.
- If `FCP-11-S3` threatens persistence schema or public `IChannelManager` contracts, revert the extraction and replan around a smaller package-local collaborator.
- If `FCP-11-S4` removes a seam that was carrying owner value, restore that seam and document why it remains accepted owner structure instead of forcing collapse.

## Commit Checkpoints

- `FCP-11-S1` implementation checkpoint: server-select owner reduction plus targeted server-select tests and source audit.
- `FCP-11-S2` implementation checkpoint: channel setup screen owner reduction plus targeted channel setup tests and source audit.
- `FCP-11-S3` implementation checkpoint: ChannelManager owner reduction plus targeted channel-manager/persistence/cache/retry tests and source audit.
- `FCP-11-S4` implementation checkpoint: priority-one direct-forwarding reduction plus targeted priority-one/orchestrator tests and source audit.
- Closeout checkpoint: after all slices pass clean review and `npm run verify`, update `ARCHITECTURE_CLEANUP_CHECKLIST.md` and any current architecture docs in a separate orchestrator-owned closeout pass if implementation commits already exist.

## Package Decomposition

- `package_id`: `FCP-11`
- `checklist_token`: `FCP-11`
- `package_issue_ids`: n/a for FCP source-backed packages; use `source_finding_ids`
- `source_finding_ids`: `FCP-11-SF1`, `FCP-11-SF2`, `FCP-11-SF3`, `FCP-11-SF4`
- `coverage_check`:
  - `FCP-11-SF1` maps exactly to `FCP-11-S1`.
  - `FCP-11-SF2` maps exactly to `FCP-11-S2`.
  - `FCP-11-SF3` maps exactly to `FCP-11-S3`.
  - `FCP-11-SF4` maps exactly to `FCP-11-S4`.
- `ready_now_execution_unit`: `FCP-11-S1`
- `ready_now_slice`: `FCP-11-S1`
- `recommended_slice_order`: `FCP-11-S1`, then `FCP-11-S2`, then `FCP-11-S3`, then `FCP-11-S4`, then package closeout source audit and docs/checklist updates if earned.
- `parallel_execution_policy`: serial by default. Do not start all slices at once. Each `FCP-11-S*` row is its own implementation/review unit. No execution waves are approved in this plan. After `FCP-11-S1` clean review, the controller may select the next listed slice only if its files remain disjoint from uncommitted work and no replan trigger fired; otherwise continue serially.

| slice_id | goal | areas/files | source_finding_ids | verification | dependencies | stop_condition | handoff_condition | serial_only | parallel_justification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FCP-11-S1` | Make `ServerSelectScreen` stop owning the whole runtime workflow mix while preserving the completed list-view seam. Owner set: screen DOM adapter, session/runtime workflow owner, focus owner, status/display policy owner, list-view DOM owner. | `src/modules/ui/server-select/ServerSelectScreen.ts`, `ServerSelectListView.ts`, `types.ts`, new package-local collaborators, server-select tests. | `FCP-11-SF1` | `npm test -- ServerSelectListView ServerSelectScreen`; targeted source audits for discovery/select/reconnect/status/focus/idle ownership; `npm run typecheck`; `git diff --check`. | none | Stop if source audit shows only the already-closed FCP-7 list-view concern remains; if selected-server persistence/app-shell/Plex/navigation contracts must change; or if behavior proof requires private probing. | The original mixed-responsibility sentence is false for current server-select source, or the slice records a source-disproved/accepted-residue disposition with one final owner. | true | Ready-now because source audit confirmed the seam and FCP-7/list-view background is reconciled. |
| `FCP-11-S2` | Make `ChannelSetupScreen` stop being the convergence point for wizard render/interaction/session/focus/build-progress concerns. Owner set: screen adapter, session/runtime owner, focus owner, strategy/dropdown interaction owner, build review/progress presenter owner, step view controllers. | `src/modules/ui/channel-setup/ChannelSetupScreen.ts`, package-local steps/focus/session collaborators, channel setup UI tests/helpers. | `FCP-11-SF2` | Targeted channel setup screen/session/focus/step/build tests as touched; source audits for moved responsibilities and private-probe avoidance; `npm run typecheck`; `git diff --check`. | `FCP-11-S1` reviewed or controller confirms no overlapping UI/focus assumptions remain. | Stop if extraction changes wizard behavior, D-pad focus, dropdown dismissal, build cancellation/progress, setup persistence semantics, or creates a second screen owner. | The original ChannelSetupScreen convergence sentence is false or accepted with one final owner/revisit trigger. | true | UI/focus-sensitive and shares verification style with S1, so do not run before S1 is reviewed. |
| `FCP-11-S3` | Make `ChannelManager` stop owning authoring, import/export, persistence coordination, cache, and retry policy in one class while preserving public API and storage schema. Owner set: public manager facade/state owner, authoring/default-shaping owner, import/export owner, persistence coordinator, resolution cache/clone policy owner, retry scheduler owner, existing repository/store owners. | `src/modules/scheduler/channel-manager/ChannelManager.ts`, interfaces/types, package-local collaborators, channel-manager tests. | `FCP-11-SF3` | Targeted ChannelManager contract/import/export/persistence/cache/retry tests; `ChannelPersistenceStore`/`ChannelRepository` tests if touched; schema/source audits; `npm run typecheck`; `git diff --check`. | `FCP-11-S2` reviewed unless controller proves scheduler work is fully disjoint and no shared closeout assumptions changed. | Stop if `IChannelManager`, channel payload schema, storage keys, raw localStorage ownership, Orchestrator storage context, or Plex contracts need behavior changes. | The original ChannelManager mixed-responsibility sentence is false while public contracts and persistence schema are preserved, or accepted with one final owner/revisit trigger. | true | Persistence-adjacent shared runtime surface; run as its own reviewed unit. |
| `FCP-11-S4` | Collapse priority-one direct-forwarding layers that add no owner value while preserving explicit runtime assembly seams. Owner set: runtime assembly input owner, controller factory owner, collaborator dependency shapers, AppOrchestrator call-site owner. | `src/core/orchestrator/priority-one/*`, `src/core/orchestrator/OrchestratorRuntimeSeams.ts`, `src/core/orchestrator/AppOrchestrator.ts` call site, priority-one/orchestrator tests. | `FCP-11-SF4` | Priority-one/orchestrator assembly tests as touched; source audits for direct forwarding vs preserved seams; `npm run typecheck`; `git diff --check`; package closeout `npm run verify`. | `FCP-11-S3` reviewed unless controller proves no shared runtime seam or closeout dependency changed. | Stop if a forwarding layer proves necessary to preserve cross-module ownership, lifecycle ordering, recoverable error reporting, or public runtime assembly clarity. | Direct forwarding with no owner value is removed, and remaining seams have explicit owner value documented in implementation output/source review. | true | Orchestrator-adjacent assembly work should stay isolated after UI/scheduler slices. |

## Source Finding Disposition

- `FCP-11-SF1`: retired by `FCP-11-S1`. `ServerSelectScreen` is the public screen/DOM adapter; runtime workflow, visibility generation, saved reconnect, select/clear, and idle ownership live in `ServerSelectRuntimeCoordinator`; focus ownership lives in `ServerSelectFocusCoordinator`; status/display policy lives in `ServerSelectStatusPolicy`; `ServerSelectListView` remains DOM-list rendering only.
- `FCP-11-SF2`: retired by `FCP-11-S2`. `ChannelSetupScreen` is the screen shell/step router; dropdown lifecycle lives in `ChannelSetupDropdownController`; build review/progress/success presentation lives in `ChannelSetupBuildStepPresenter`; session/runtime, focus, strategy interactions, and step rendering remain in their package-local owners.
- `FCP-11-SF3`: retired by `FCP-11-S3`. `ChannelManager` remains the public `IChannelManager` facade/state owner; authoring/default shaping, import/export orchestration, persistence coordination, resolution cache/clone policy, and retry timers now live in focused package-local collaborators while `ChannelPersistenceStore` keeps storage/schema ownership.
- `FCP-11-SF4`: retired by `FCP-11-S4`. The no-value `PriorityOneAssemblyBuilderInput` / `createPriorityOneAssembly` forwarding layer is gone; remaining priority-one assembly seams perform boundary shaping/adaptation with explicit owner value.

No deferred `FCP-11` source findings remain.

## Priority-Exit Readiness

This plan is intended to close the whole `FCP-11` package once all four slices are implemented, reviewed, verified, and source-audited.

- FCP source findings mapped: `FCP-11-SF1`, `FCP-11-SF2`, `FCP-11-SF3`, `FCP-11-SF4`.
- No detector/imported ids are in scope.
- No deferred or split follow-ups are approved yet.
- Before any `FCP-12` planning or work starts, `FCP-11` must have a source-finding proof matrix, package-local source audit rerun, targeted tests, `npm run verify`, clean closeout review, and updated checklist/current-state records if ownership truth changed.
- Security gate: no open P0 security findings are known for this package from source audit; if implementation discovers one, stop and route it as a blocker with one owner.

## Closeout Evidence

`FCP-11` completed on 2026-05-02 after clean plan review and clean final implementation review for all four approved slices.

Implementation checkpoints:

- `d56a13ca` (`FCP-11-S1`): split server-select runtime, focus, and status ownership.
- `aefbbfd0` and `606ad0ae` (`FCP-11-S2`): split channel setup dropdown/build presentation ownership and add `Done` success-path proof.
- `42d93a9d` and `6ed9d0c6` (`FCP-11-S3`): split ChannelManager runtime owners and fix stale debounced persistence interleaving.
- `f02cc0a1` (`FCP-11-S4`): collapse priority-one assembly forwarding.
- `51c60d02`: satisfy FCP lint gates introduced by the reviewed FCP-11 slices.

Verification:

- `npm run plans:check`
- `npm test -- ServerSelectListView ServerSelectScreen`
- `npm test -- ChannelSetupScreen ChannelSetupSessionController ChannelSetupSessionRuntime ChannelSetupFocusCoordinator StrategyStepController StrategyStepInteractionController BuildReviewStepController BuildProgressStepController ChannelSetupDropdownController ChannelSetupBuildStepPresenter`
- `npm test -- --runInBand src/modules/ui/channel-setup/steps/__tests__/ChannelSetupBuildStepPresenter.test.ts`
- `npm test -- ChannelManager.persistence ChannelPersistenceSaveQueue --runInBand`
- `npm test -- ChannelManager.content-resolution ChannelManager.stale-fallback ChannelManager.error-semantics ChannelManager.import-order ChannelManager.transactional ChannelRepository ChannelPersistenceStore ChannelImportNormalizer --runInBand`
- `npm test -- src/modules/scheduler/channel-manager --runInBand`
- `npm test -- PriorityOneAssemblyBuilder PriorityOneControllerFactory PriorityOneControllerCollaborators PlaybackStartController PlaybackRuntimeController OrchestratorEventBinder AppOrchestrator`
- `npm run typecheck`
- `npm run verify:architecture`
- `npm run verify:docs`
- `git diff --check`
- `npm run verify`

Package closeout recorded checklist/current-state updates and requires clean
closeout review before `FCP-12` work starts.
