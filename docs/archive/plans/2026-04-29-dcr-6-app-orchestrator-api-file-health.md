# DCR-6 AppOrchestrator API And File-Health Cleanup Plan

> **For agentic workers:** Execute through `cleanup-loop` one approved execution unit at a time. This is a narrow AppOrchestrator API/file-health package, not a broad runtime rewrite.

**Plan Status:** archived
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked
**Tier:** Tier 3

## Goal

- Retire `ARCHITECTURE_CLEANUP_CHECKLIST.md` item `DCR-6` / AppOrchestrator Narrow API And File-Health Cleanup.
- Narrow the public orchestrator API/export surface only where current source proves it is safe.
- Move playback info snapshot shaping out of inline `AppOrchestrator` projection logic into a focused orchestrator-owned snapshot accessor/projection owner.
- Replace the coordinator assembly non-null assertion cluster with one explicit construction seam that either produces a fully typed assembly input or fails before coordinator creation.
- Consolidate repeated shutdown teardown source patterns while preserving shutdown order, failure capture/reporting, nulling, and singleton lifecycle invariants.

## Non-Goals

- Do not start `DCR-7`, `DCR-EXIT`, or unrelated orchestrator cleanup.
- Do not perform a broad `AppOrchestrator` rewrite, split the full class, or move ownership into app-shell, priority-one, Plex, EPG, scheduler, or playback modules.
- Do not change Plex stream URL/token/subtitle delivery policy or `StreamDecision` behavior. Snapshot projection may move, but Plex policy remains owned by Plex/player owners.
- Do not change TV-visible overlay, focus, or route behavior during shutdown. If implementation proves such a behavior change is required, stop and replan with `ui-composition-patterns`.
- Do not widen `src/App.ts`; it remains an accepted app-shell composition root baseline.
- Do not add compatibility/fallback re-export chains. Any retained export must have a current consumer or an explicitly documented runtime/test stability reason.

## Parent Priority Alignment

- Parent checklist item: `ARCHITECTURE_CLEANUP_CHECKLIST.md` -> `DCR-6`.
- Scope owner: core orchestrator owner.
- Current architecture truth:
  - `src/Orchestrator.ts` is a thin public runtime entry barrel for app/test import stability.
  - `src/core/orchestrator/AppOrchestrator.ts` owns central runtime coordinator implementation.
  - `src/core/orchestrator/priority-one/` owns grouped priority-one runtime assembly and controller/binder composition.
  - `src/core/orchestrator/OrchestratorRuntimeControllerBuilder.ts` owns schedule-day rollover and subtitle-track recovery controller construction.
  - app-shell owners remain under `src/core/app-shell/**`; `src/App.ts` is not a DCR-6 target except for narrow import/API normalization if S1 proves it necessary.

## Required Reading

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/cleanup-loop.md`
4. `ARCHITECTURE_CLEANUP_CHECKLIST.md` DCR Operating Rules and full `DCR-6` section
5. `docs/architecture/CURRENT_STATE.md` sections for `src/Orchestrator.ts`, `AppOrchestrator`, priority-one, `OrchestratorRuntimeControllerBuilder`, and app-shell ownership
6. `docs/agentic/plan-authoring-standard.md`
7. `docs/agentic/codanna-playbook.md`
8. `src/Orchestrator.ts`
9. `src/core/orchestrator/AppOrchestrator.ts`
10. `src/core/orchestrator/OrchestratorCoordinatorAssembly.ts`
11. `src/core/orchestrator/OrchestratorCoordinatorContracts.ts`
12. `src/core/orchestrator/OrchestratorPlaybackStateAccessors.ts`
13. `src/core/orchestrator/OrchestratorEventCleanupReporter.ts`
14. `src/__tests__/Orchestrator.test.ts`
15. `src/core/orchestrator/__tests__/OrchestratorCoordinatorAssembly.test.ts`
16. `src/core/orchestrator/__tests__/OrchestratorCoordinatorAssembly.playbackState.test.ts`

Freshness gate:

- If `ARCHITECTURE_CLEANUP_CHECKLIST.md`, `docs/architecture/CURRENT_STATE.md`, `src/Orchestrator.ts`, or the orchestrator source/test files above change materially before implementation, refresh this plan before coding.
- If fresh source audit finds public runtime consumers outside the current `src/Orchestrator.ts` barrel policy, resolve `DCR-6-D1` again before any export change.
- If any slice needs to move ownership into app-shell, priority-one, Plex/player stream policy, or UI overlay/focus behavior, stop and replan instead of widening DCR-6 in place.

## Required Skills

1. `architecture-boundaries`
2. `verification-strategy`
3. `execution-plan-authoring`

Not applied now:

- `plex-integration-boundaries`: DCR-6 does not approve Plex URL/token/subtitle delivery or `StreamDecision` behavior changes.
- `ui-composition-patterns`: DCR-6 freezes existing overlay/focus-visible behavior. Add this skill only if S3 discovers shutdown cleanup must change TV-visible overlay/focus semantics.

## Codanna Discovery

- `semantic_search_with_context`: unavailable in this session. No Codanna MCP tools were exposed.
- `search_documents`: unavailable in this session. No Codanna MCP resources or templates were exposed.
- `analyze_impact`: unavailable in this session. Risky shared-symbol impact must be approximated through `rg` source audits until Codanna is available.
- Direct fallback reads used:
  - `sed -n '1,220p' AGENTS.md`
  - `sed -n '1,520p' docs/AGENTIC_DEV_WORKFLOW.md`
  - `sed -n '1,260p' docs/agentic/session-prompts/cleanup-loop.md`
  - `sed -n '214,746p' ARCHITECTURE_CLEANUP_CHECKLIST.md`
  - `sed -n '1,120p' docs/architecture/CURRENT_STATE.md` and `sed -n '150,210p' docs/architecture/CURRENT_STATE.md`
  - `sed -n '1,620p' docs/agentic/plan-authoring-standard.md`
  - `sed -n '1,260p' docs/agentic/codanna-playbook.md`
  - `sed -n '1,220p' src/Orchestrator.ts`
  - targeted reads of `src/core/orchestrator/AppOrchestrator.ts`, `OrchestratorCoordinatorAssembly.ts`, `OrchestratorCoordinatorContracts.ts`, `OrchestratorPlaybackStateAccessors.ts`, and `OrchestratorEventCleanupReporter.ts`
- Direct fallback `rg` used:
  - `rg -n "DCR Operating Rules|DCR-6|DCR-7|DCR-EXIT" ARCHITECTURE_CLEANUP_CHECKLIST.md`
  - `rg -n "AppOrchestrator|Orchestrator|priority-one|runtime-controller|app-shell|PlaybackInfoSnapshot|shutdown|coordinator assembly" docs/architecture/CURRENT_STATE.md`
  - `rg -n "PlaybackInfoSnapshot|getPlaybackInfoSnapshot|refreshPlaybackInfoSnapshot|_buildCoordinatorAssemblyInput|shutdown|try \\{|catch|finally|export" src/core/orchestrator/AppOrchestrator.ts`
  - `rg -n "from ['\"][^'\"]*Orchestrator['\"]|PlaybackInfoSnapshot|AppOrchestratorRuntime|ModuleStatus" src --glob '*.ts' --glob '*.tsx'`
  - `rg -n "core/orchestrator/AppOrchestrator|OrchestratorServerSelectionResult|ErrorRecoveryAction|ChannelSetupConfig|OrchestratorConfig" src --glob '*.ts' --glob '*.tsx'`

## Impact Snapshot

- `src/Orchestrator.ts` currently exports:
  - `AppOrchestrator`
  - `type PlaybackInfoSnapshot`
  - `type ModuleStatus`
  - local interface `AppOrchestratorRuntime`
- Current source consumers:
  - `src/App.ts` imports `AppOrchestrator` and `AppOrchestratorRuntime` from `src/Orchestrator.ts`.
  - app and orchestrator tests import `AppOrchestrator` and `PlaybackInfoSnapshot` from `src/Orchestrator.ts`.
  - `OrchestratorConfig` consumers already import from `src/core/orchestrator/OrchestratorTypes.ts`, not the root barrel.
- `src/core/orchestrator/AppOrchestrator.ts` still exports several non-orchestrator type aliases/re-exports, including channel setup, server-selection, and error-recovery types. S1 owns auditing whether those are dead/publicly unnecessary and removing only source-proven unnecessary exports.
- `PlaybackInfoSnapshot`, selected audio/subtitle snapshot aliases, `getPlaybackInfoSnapshot`, `refreshPlaybackInfoSnapshot`, and selected-stream mapping helpers are still inline in `AppOrchestrator`.
- `_createCoordinators()` has a precondition block, but `_buildCoordinatorAssemblyInput()` still relies on many non-null assertions when building `modules` and `overlays`.
- Shutdown currently uses repeated best-effort `try`/`catch` plus nulling patterns and records teardown failures into one recoverable runtime issue after attempts complete.
- Architecture-risk score: `4` (`AppOrchestrator` hotspot, public export/API seam, ownership move into focused collaborator, checklist-linked Tier 3 package).

## Files In Scope

- `src/Orchestrator.ts`
- `src/core/orchestrator/AppOrchestrator.ts`
- `src/core/orchestrator/OrchestratorTypes.ts`
- `src/core/orchestrator/OrchestratorCoordinatorAssembly.ts`
- `src/core/orchestrator/OrchestratorCoordinatorContracts.ts`
- `src/core/orchestrator/OrchestratorPlaybackStateAccessors.ts`
- `src/core/orchestrator/OrchestratorEventCleanupReporter.ts`
- new focused orchestrator helper files under `src/core/orchestrator/` if needed for snapshot projection, coordinator assembly input construction, or shutdown teardown
- `src/core/orchestrator/__tests__/*`
- `src/__tests__/Orchestrator.test.ts`
- `src/__tests__/App.test.ts` only if S1 import/type stability requires narrow updates
- `src/App.ts` only if S1 import/type stability requires narrow updates
- `docs/architecture/CURRENT_STATE.md` only if implementation changes public ownership truth
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` only during package closeout after reviewed implementation

## Files Out Of Scope

- Broad `src/App.ts` composition-root cleanup.
- `src/core/app-shell/**` except narrow test/type fallout from the approved `src/Orchestrator.ts` public runtime interface.
- `src/core/orchestrator/priority-one/**` unless S1/S2 source audit proves a current coordinator assembly contract import must be adjusted without changing priority-one ownership.
- `src/modules/plex/**`, `src/modules/player/**`, and stream URL/token/subtitle delivery policy.
- `src/modules/ui/**` overlay/focus behavior changes; shutdown may preserve existing hide/destroy calls but must not redesign visible UI behavior.
- `DCR-7`, `DCR-EXIT`, detector score refresh, and unrelated orchestrator cleanup.

## Planner Self-Check

1. Unresolved architecture seam hidden inside task? No. Snapshot projection owner, coordinator assembly construction seam, shutdown teardown invariants, and root export policy are frozen below.
2. Adjacent files needing contract/type changes but not in scope? No known required changes. If S1/S2 discovers priority-one, app-shell, or Plex/player contract changes are required, that is a replan trigger.
3. File declared out of scope but implicitly required? `src/App.ts` and `src/__tests__/App.test.ts` are in scope only for narrow import/type stability; broad app-shell cleanup stays out of scope.
4. Codanna evidence path recorded? Yes. Codanna tools were unavailable; exact `rg` and direct reads are recorded.
5. Repo-preferred owner? Yes. New ownership stays under `src/core/orchestrator/**` and removes inline policy from `AppOrchestrator` without growing app-shell or priority-one.
6. Would a fresh session invent important policy? No. DCR-6-D1 export policy, snapshot ownership, assembly construction seam, teardown invariants, verification, and replan triggers are explicit.
7. Execution-grade? Yes for one serial package. S1 is the ready execution unit; S2 and S3 remain ordered and bounded.

## Architecture Seam Decision Gate

Frozen decisions before implementation:

- Playback snapshot owner:
  - `src/core/orchestrator/AppOrchestrator.ts` remains the runtime state source.
  - A focused orchestrator-owned helper/accessor under `src/core/orchestrator/` owns the `PlaybackInfoSnapshot` contract, selected audio/subtitle projection, and snapshot construction from narrow state accessors plus current channel getter.
  - `refreshPlaybackInfoSnapshot()` may stay as the public AppOrchestrator method because app-shell diagnostics and tests consume that runtime API, but its implementation must delegate snapshot construction and only keep the orchestration step that asks `NowPlayingDebugManager` to ensure server decision data when current program/decision/resolver state makes that meaningful.
  - The helper must not change `StreamDecision`, Plex URL/token policy, subtitle delivery semantics, or now-playing UI summary behavior.
- Coordinator assembly construction seam:
  - `OrchestratorCoordinatorAssembly.ts` / `OrchestratorCoordinatorContracts.ts` own the typed assembly input boundary.
  - `AppOrchestrator` may collect existing runtime fields, but all required-module validation must be expressed through one named construction/assertion seam before `createOrchestratorCoordinators(...)`.
  - No default no-op modules, fake fallbacks, or deferred null checks are approved. Missing required modules should fail before coordinator creation with the existing precondition class of error.
  - Non-null assertions must be removed from `_buildCoordinatorAssemblyInput()` or contained in one named assertion seam whose contract is covered by targeted tests.
- Shutdown teardown invariants:
  - Preserve current shutdown order unless a targeted test proves the existing order is impossible to consolidate safely.
  - Clear initialization resume callbacks before teardown.
  - Dispose event bindings early and continue capturing cleanup failures.
  - Flush/dispose channel manager before nulling it.
  - Preserve lifecycle shutdown, playback stop, scheduler pause/unload, coordinator dispose/hide, overlay destroy, video player destroy, sleep timer destroy, and navigation destroy attempts.
  - Continue after individual teardown failures and report one `orchestrator.shutdown.teardown` recoverable runtime issue with summarized failures after attempts finish.
  - Null owned fields after their best-effort teardown and keep the documented singleton/no-reuse lifecycle invariant.
  - Retain only comments that explain ordering, singleton lifecycle, or failure-continuation invariants; remove restating generated-looking comments.
- DCR-6-D1 public export policy:
  - `src/Orchestrator.ts` may retain exactly the stable public runtime surface currently justified by app/tests: `AppOrchestrator`, `AppOrchestratorRuntime`, `ModuleStatus`, and `PlaybackInfoSnapshot`.
  - `PlaybackInfoSnapshot` should be re-exported from its focused owner after S1 if the type moves.
  - `src/Orchestrator.ts` must not grow new exports such as `OrchestratorConfig`, channel setup types, server-selection results, error-recovery actions, internal coordinator types, or Plex/player stream types.
  - No `src/Orchestrator.ts` export change is approved until S1 completes a before/after source audit of root-barrel consumers.
  - Direct imports from `src/core/orchestrator/AppOrchestrator.ts` should not become the app/test stability path.

Replan triggers:

- Any required change to Plex stream URL/token/subtitle delivery or `StreamDecision` behavior.
- Any required TV-visible overlay/focus behavior change during shutdown.
- Any public runtime consumer outside app/tests breaks after the DCR-6-D1 export policy is applied.
- Coordinator assembly cleanup requires changing app-shell or priority-one ownership instead of only the assembly input seam.
- Snapshot extraction starts duplicating orchestrator state ownership instead of projecting from narrow state accessors.
- Shutdown consolidation changes teardown order, drops failure capture, or makes instance reuse appear supported.

## Verification Commands

Primary verification mode: `contract-first` with `refactor-invariance` support.

Plan classification: `new regression/contract test required`.

Planning-surface verification for this plan:

- `npm run plans:check`
  - Expected: active plan structure passes, including checklist-linked package decomposition.
- `npm run verify:docs`
  - Expected: docs/control-plane verification passes with this active plan present.

Implementation verification to run inside the approved execution units:

- Export/API source audit before and after S1:
  - `rg -n "from ['\"][^'\"]*Orchestrator['\"]|from ['\"][^'\"]*core/orchestrator/AppOrchestrator['\"]|PlaybackInfoSnapshot|AppOrchestratorRuntime|ModuleStatus" src --glob '*.ts' --glob '*.tsx'`
  - Expected: root barrel consumers still match the approved DCR-6-D1 export policy; no new direct import path becomes a compatibility substitute.
- Focused playback snapshot tests for S1:
  - `npm test -- --runInBand src/core/orchestrator/__tests__/OrchestratorPlaybackInfoSnapshot.test.ts src/__tests__/Orchestrator.test.ts src/__tests__/App.test.ts`
  - Expected: snapshot shape, selected audio/subtitle field inclusion, no-stream behavior, and refresh-trigger behavior match current public behavior.
- Focused coordinator assembly tests for S2:
  - `npm test -- --runInBand src/core/orchestrator/__tests__/OrchestratorCoordinatorAssembly.test.ts src/core/orchestrator/__tests__/OrchestratorCoordinatorAssembly.playbackState.test.ts`
  - Expected: safer construction seam builds the same coordinator inputs, missing required modules fail before coordinator creation, and non-null assertion containment is source-auditable.
- Focused shutdown/recoverable runtime tests for S3:
  - `npm test -- --runInBand src/core/orchestrator/__tests__/OrchestratorShutdownTeardown.test.ts src/core/orchestrator/__tests__/OrchestratorRecoverableRuntimeReporter.test.ts src/__tests__/Orchestrator.test.ts`
  - Expected: teardown order, failure capture/reporting, failure-continuation, and field nulling behavior are preserved.
- Source audit for non-null assertions after S2:
  - `rg -n "_buildCoordinatorAssemblyInput|!," src/core/orchestrator/AppOrchestrator.ts src/core/orchestrator/OrchestratorCoordinatorAssembly.ts src/core/orchestrator/OrchestratorCoordinatorContracts.ts`
  - Expected: no broad non-null assertion cluster remains in `_buildCoordinatorAssemblyInput`; any remaining `!` has a local invariant reason.
- Source audit for restating comments after S3:
  - `rg -n "/\\*\\*|//" src/core/orchestrator/AppOrchestrator.ts src/core/orchestrator/Orchestrator*.ts`
  - Expected: retained comments explain invariants, ordering, or public contracts; restating/generated-looking comments from the touched seams are removed.
- Full implementation gate:
  - `npm run verify`
  - Expected: full UI/navigation/Orchestrator/Plex verification passes.
- Docs gate when checklist/current-state/tracked plan references change:
  - `npm run verify:docs`
  - Expected: docs/control-plane verification passes after any checklist/current-state/plan reference update.

Why this depth matches the risk:

- S1 changes a public API/type stability seam and therefore needs contract tests plus source audit.
- S2 changes a construction precondition seam with runtime initialization impact and therefore needs targeted assembly/precondition tests.
- S3 changes lifecycle teardown structure and therefore needs targeted order/failure/nulling tests, not just `npm run verify`.
- The package touches Orchestrator, so `npm run verify` remains mandatory before implementation closeout.

## Rollback Notes

- Roll back one execution unit at a time in reverse order.
- If S1 breaks public imports or snapshot shape, revert the snapshot owner/export changes first and restore the prior `src/Orchestrator.ts` export surface before attempting S2.
- If S2 changes coordinator initialization behavior, revert the assembly construction seam while preserving S1 if its tests still pass.
- If S3 changes shutdown behavior, revert only the teardown helper/consolidation and keep prior explicit try/catch/nulling until a revised plan can prove the invariant-preserving shape.
- Do not roll back unrelated user or controller docs artifacts. Active tracked plan docs should stay out of worker implementation commits.

## Commit Checkpoints

- Planner checkpoint: this active plan file only.
- Implementation checkpoint after `DCR-6-S1`: source/tests for export/API surface and playback snapshot ownership.
- Implementation checkpoint after `DCR-6-S2`: source/tests for coordinator assembly construction seam.
- Implementation checkpoint after `DCR-6-S3`: source/tests for shutdown teardown/source-signal cleanup.
- Controller closeout checkpoint: checklist/current-state/plan archive updates only after reviewed implementation and verification.
- Keep `docs/plans/2026-04-29-dcr-6-app-orchestrator-api-file-health.md` out of worker implementation commits unless the controller explicitly owns a separate tracked-doc update.

## Package Decomposition

- `package_id`: `DCR-6`
- `checklist_token`: `DCR-6`
- `package_issue_ids`:
  - `DCR-6-A1`
  - `DCR-6-A2`
  - `DCR-6-A3`
  - `DCR-6-A4`
  - `DCR-6-D1`
- `slice_table`:

### `DCR-6-S1`

- `goal`: resolve DCR-6-D1 export policy, narrow source-proven unnecessary AppOrchestrator exports, and move playback snapshot projection into a focused orchestrator-owned helper/accessor without changing public snapshot behavior
- `areas/files`: `src/Orchestrator.ts`, `src/core/orchestrator/AppOrchestrator.ts`, `src/core/orchestrator/OrchestratorPlaybackStateAccessors.ts`, new `src/core/orchestrator/OrchestratorPlaybackInfoSnapshot.ts` or equivalent focused owner, `src/core/orchestrator/__tests__/OrchestratorPlaybackInfoSnapshot.test.ts`, `src/__tests__/Orchestrator.test.ts`, `src/__tests__/App.test.ts`, narrow `src/App.ts` import/type fallout only if source audit proves it necessary
- `exact_issue_ids`: `DCR-6-A1`, `DCR-6-A2`, `DCR-6-D1`
- `verification`: export/API source audit; targeted playback snapshot tests; `npm run verify`
- `dependencies`: none
- `stop_condition`: `src/Orchestrator.ts` public exports match the approved DCR-6-D1 policy; playback snapshot shape/refresh behavior is preserved by a focused owner; no Plex/player policy or app-shell ownership change is introduced
- `handoff_condition`: coordinator assembly cleanup can proceed with public export policy and snapshot ownership settled
- `serial_only`: true
- `parallel_justification`: first slice decides the public API surface and snapshot owner that later slices must not invalidate

### `DCR-6-S2`

- `goal`: replace the coordinator assembly non-null assertion cluster with one explicit typed construction/assertion seam
- `areas/files`: `src/core/orchestrator/AppOrchestrator.ts`, `src/core/orchestrator/OrchestratorCoordinatorAssembly.ts`, `src/core/orchestrator/OrchestratorCoordinatorContracts.ts`, `src/core/orchestrator/__tests__/OrchestratorCoordinatorAssembly.test.ts`, `src/core/orchestrator/__tests__/OrchestratorCoordinatorAssembly.playbackState.test.ts`
- `exact_issue_ids`: `DCR-6-A3`
- `verification`: targeted coordinator assembly tests; source audit for `_buildCoordinatorAssemblyInput` and non-null assertion containment; `npm run verify`
- `dependencies`: `DCR-6-S1` complete
- `stop_condition`: coordinator input construction has one tested required-module seam; `_buildCoordinatorAssemblyInput` no longer contains a broad non-null assertion cluster; missing required modules still fail before coordinator creation
- `handoff_condition`: shutdown/source-signal cleanup can proceed without unresolved coordinator construction debt
- `serial_only`: true
- `parallel_justification`: shares `AppOrchestrator.ts` and assembly contracts with S1; serial execution avoids competing public/runtime seam edits

### `DCR-6-S3`

- `goal`: consolidate repeated shutdown teardown patterns and remove restating source comments while preserving shutdown order, failure reporting, nulling, and singleton lifecycle invariants
- `areas/files`: `src/core/orchestrator/AppOrchestrator.ts`, `src/core/orchestrator/OrchestratorEventCleanupReporter.ts`, new `src/core/orchestrator/OrchestratorShutdownTeardown.ts` or equivalent focused teardown helper if useful, `src/core/orchestrator/__tests__/OrchestratorShutdownTeardown.test.ts`, `src/core/orchestrator/__tests__/OrchestratorRecoverableRuntimeReporter.test.ts`, `src/__tests__/Orchestrator.test.ts`
- `exact_issue_ids`: `DCR-6-A4`
- `verification`: targeted shutdown/recoverable runtime tests; source audit for restating comments removed and invariant comments retained; `npm run verify`
- `dependencies`: `DCR-6-S2` complete
- `stop_condition`: teardown structure is less repetitive, all prior shutdown attempts still happen in order, individual failures are summarized and reported once, fields are nulled after best-effort teardown, and only invariant-bearing comments remain in touched seams
- `handoff_condition`: `DCR-6` implementation is ready for review, checklist closeout, and any current-state update required by the final diff
- `serial_only`: true
- `parallel_justification`: shares `AppOrchestrator.ts`, shutdown/runtime tests, and final package verification with previous slices

- `coverage_check`:
  - `DCR-6-A1` -> `DCR-6-S1` final owner: core orchestrator owner; no defer path.
  - `DCR-6-A2` -> `DCR-6-S1` final owner: focused orchestrator playback snapshot owner; no defer path.
  - `DCR-6-D1` -> `DCR-6-S1` final owner: `src/Orchestrator.ts` public runtime barrel policy; no defer path.
  - `DCR-6-A3` -> `DCR-6-S2` final owner: coordinator assembly construction seam; no defer path.
  - `DCR-6-A4` -> `DCR-6-S3` final owner: orchestrator shutdown/source-signal cleanup seam; no defer path.
  - Accepted residual: no broad orchestrator rewrite; final owner remains DCR accepted baseline / `DCR-EXIT` source reconciliation. Revisit only if DCR-6 source proof shows the narrow fixes cannot retire the listed issues without a broader package.
  - Accepted residual: `src/App.ts` remains broadly acceptable as composition root; final owner remains app-shell composition baseline / `DCR-EXIT` source reconciliation. Revisit only if S1 source audit proves a real import/API break that requires more than narrow import normalization.
- `ready_now_slice`: `DCR-6-S1`
- `ready_now_execution_unit`: `DCR-6-S1`
- `recommended_slice_order`:
  1. `DCR-6-S1`
  2. `DCR-6-S2`
  3. `DCR-6-S3`
- `parallel_execution_policy`: serial only
  - reason: all slices share `src/core/orchestrator/AppOrchestrator.ts`, public/runtime contract risk, and one full Orchestrator verification envelope. Parallel `cleanup_worker` execution is unavailable because this plan does not prove disjoint write scopes, disjoint verification surfaces, and a separate controller-owned integration gate.

Current-unit packet:

- `execution_unit`: `DCR-6-S1`
- `ready_now_slice`: `DCR-6-S1`
- files in scope: `src/Orchestrator.ts`, `src/core/orchestrator/AppOrchestrator.ts`, focused playback snapshot helper/accessor file if created, playback snapshot tests, app/orchestrator tests needed for import/type stability
- files out of scope: coordinator assembly non-null cleanup, shutdown teardown consolidation, Plex/player stream policy, UI overlay/focus behavior
- must preserve: root export policy, public snapshot shape, refresh behavior, app/test import stability, no new compatibility exports
- verification: export/API source audit; targeted playback snapshot tests; `npm run verify`
- stop and replan if: public consumers require exports beyond the approved DCR-6-D1 list, snapshot extraction needs Plex/player behavior changes, or the helper starts owning mutable playback state instead of projecting from orchestrator state accessors
