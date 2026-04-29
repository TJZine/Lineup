# FCP-6 Test Confidence For The Port

**Plan Status:** completed

**Task family:** cleanup/refactor

**Cleanup subtype:** checklist-linked

## Goal

Raise confidence that a future Windows/Electron-style port can preserve Lineup's current critical runtime contracts without implementing that port.

The approved source-backed audit is `docs/plans/2026-04-29-fcp-6-test-confidence-audit.md`. It admits one narrow cleanup-now automated coverage gap: `FCP-6-SF2`, the exit-confirm coordinator/modal behavior that bridges player Back handling to the current webOS Exit-to-Home contract. All other audited areas have sufficient current Jest/source coverage, require future-port manual/integration proof, or should remain no-action until a concrete port exists.

## Non-Goals

- Do not implement a Windows/Electron port.
- Do not add runtime adapters, compatibility shims, platform selectors, Electron APIs, filesystem APIs, or browser-global abstractions.
- Do not change production source in this planning pass.
- Do not change Plex auth, discovery, library, stream, subtitle, token, URL, or logging behavior unless a later reviewed implementation plan is opened.
- Do not rewrite startup, navigation, lifecycle, scheduler, settings, player, or channel setup production flows.
- Do not add tests that merely codify private helper names, private construction details, or brittle timer/order behavior outside stable public contracts.
- Do not use Desloppify outputs, imported issue ids, score deltas, task queues, or detector ids for FCP-6 intake, proof, prioritization, or closure.

## Parent Priority Alignment

`FCP-6` is the final FCP package before `FCP-EXIT`. It closes the pre-exit confidence pass by auditing critical port-survival paths and selecting only the smallest test addition that materially improves confidence now.

`FCP-EXIT` must not start until `FCP-6` has:

- source-backed audit and plan reviewed cleanly,
- `FCP-6-SF2` implemented or explicitly replanned with one owner,
- targeted test and `npm run verify` evidence for any source/test changes,
- `npm run verify:docs` evidence for docs/checklist changes,
- checklist mini-record closeout and clean closeout review.

## Required Reading

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/cleanup-loop.md`
4. `ARCHITECTURE_CLEANUP_CHECKLIST.md` entries `FCP-5`, `FCP-6`, and `FCP-EXIT`
5. `docs/agentic/plan-authoring-standard.md`
6. `docs/architecture/CURRENT_STATE.md`
7. `docs/architecture/modules.md`
8. `docs/agentic/codanna-playbook.md`
9. `docs/plans/2026-04-29-fcp-6-test-confidence-audit.md`
10. `docs/plans/2026-04-29-fcp-5-portability-readiness-audit.md`
11. `docs/plans/2026-04-29-fcp-5-portability-readiness.md`
12. `src/modules/ui/exit-confirm/ExitConfirmCoordinator.ts`
13. `src/modules/ui/exit-confirm/ExitConfirmModal.ts`
14. `src/modules/ui/exit-confirm/constants.ts`
15. `src/modules/navigation/__tests__/NavigationCoordinator.test.ts`

Freshness gate: if any required source/test file, FCP-5 artifact, FCP-6 audit artifact, or checklist mini-record changes materially after this plan is written, update the audit and this plan before implementation.

## Required Skills

- `architecture-boundaries`: keep test work at the exit-confirm/navigation boundary without moving ownership into composition roots.
- `ui-composition-patterns`: preserve TV-facing Back/Exit modal behavior, focus registration, and cleanup semantics.
- `persistence-boundaries`: guardrail only; no storage changes are in the ready unit.
- `plex-integration-boundaries`: guardrail only; no Plex source/test changes are in the ready unit.
- `verification-strategy`: selected before plan freeze.
- `execution-plan-authoring`: this is the active serious tracked plan.

## Codanna Discovery

- `semantic_search_with_context`: unavailable; the controller reported no Codanna MCP tools exposed in this session.
- `search_documents`: unavailable for the same reason; direct tracked-doc reads were used instead.
- `analyze_impact`: unavailable; impact was bounded by source/test direct reads and `rg` fallback.
- Fallback: deterministic `rg`, `find`, and direct reads covered startup/initialization, navigation/root Back/Exit, Plex auth/discovery/library/stream connectivity, token/security behavior, scheduler/channel persistence, player recovery/media/subtitle behavior, settings persistence, channel setup flows, selected-server persistence, lifecycle/offline/recovery paths, and FCP-5 portability assumptions. The exact fallback query/read list is recorded in the audit artifact.

Codanna unavailability is a planning uncertainty, not a blocker for the ready unit, because `FCP-6-SF2` is localized to the public exit-confirm UI boundary and existing navigation tests already identify the adjacent routing seam.

## Impact Snapshot

Approved source findings:

| source_finding_id | Disposition |
| --- | --- |
| `FCP-6-SF1` | Startup/initialization has sufficient existing coverage; no implementation now. |
| `FCP-6-SF2` | Resolved by implementation commit `ef09466b`; focused exit-confirm coordinator/modal contract tests now cover the admitted gap. |
| `FCP-6-SF3` | Plex auth/discovery/library/stream coverage sufficient; no implementation now. |
| `FCP-6-SF4` | Token/security redaction coverage sufficient; no P0 security gap admitted. |
| `FCP-6-SF5` | Selected-server persistence/resume rollback coverage sufficient. |
| `FCP-6-SF6` | Scheduler/channel persistence and settings persistence coverage sufficient. |
| `FCP-6-SF7` | Player/media/subtitle recovery coverage sufficient. |
| `FCP-6-SF8` | Channel setup flow coverage sufficient. |
| `FCP-6-SF9` | Lifecycle/offline/recovery coverage sufficient. |
| `FCP-6-SF10` | FCP-5 portability assumptions require no speculative test or runtime code now. |
| `FCP-6-SF11` | Defer real Windows/Electron/device manual/integration proof to future-port test owner. |

Expected implementation impact for the ready unit:

- Added focused Jest coverage under `src/modules/ui/exit-confirm/__tests__/` in commit `ef09466b`.
- Exercise public `ExitConfirmCoordinator` and `ExitConfirmModal` behavior through DOM and mocked navigation methods.
- No production source changed.

## Source Finding Proof Matrix

| source_finding_id | closeout status | proof | final owner | revisit trigger |
| --- | --- | --- | --- | --- |
| `FCP-6-SF1` | existing coverage sufficient | Startup/initialization audit remains no-action; bootstrap/startup/orchestrator/initialization tests cover DOM readiness, auth gates, module phase ordering, server-select routing, queued reruns, and post-ready routing. | app-shell/initialization owner | Startup ordering, readiness, auth, server routing, or initialization contract changes. |
| `FCP-6-SF2` | resolved by commit `ef09466b` | `src/modules/ui/exit-confirm/__tests__/ExitConfirmCoordinator.test.ts` covers modal render/accessibility state, focus registration, Cancel through `navigation.closeModal`, Exit through `window.close()`, close/unregister cleanup, and destroy DOM cleanup. Focused Jest path passed with 4 tests; `npm run typecheck`, `npm run verify`, `npm run verify:docs`, and implementation review passed. | navigation/exit UI owner | Root Back/Exit behavior changes, exit-confirm modal ownership changes, or a future port needs non-`window.close()` exit semantics. |
| `FCP-6-SF3` | existing coverage sufficient | Plex auth/discovery/library/stream coverage remains no-action; no Plex source or tests changed. | Plex auth/discovery/library/stream owners | Plex auth, discovery, library, stream, connectivity, or error contract changes. |
| `FCP-6-SF4` | no P0 admitted | Token/security redaction coverage remains no-action; FCP-6 implementation did not touch token storage, token-bearing URL/header construction, logging, diagnostics, debug surfaces, or Plex connectivity. | Plex/security owners | Token storage, token-bearing URL/header construction, logging, diagnostics, debug, or auth/connectivity changes. |
| `FCP-6-SF5` | existing coverage sufficient | Selected-server persistence/resume coverage remains no-action; no server-selection or persistence source changed. | server-selection/persistence owners | Selected-server persistence, startup resume, rollback, or scoped-storage key changes. |
| `FCP-6-SF6` | existing coverage sufficient | Scheduler/channel persistence and settings persistence coverage remains no-action; no scheduler/settings source changed. | scheduler/channel persistence and settings owners | Storage-key, channel persistence, settings store, blocked-storage, or normalization contract changes. |
| `FCP-6-SF7` | existing coverage sufficient | Player/media/subtitle recovery coverage remains no-action; no player/Plex stream source changed. | player/Plex stream/subtitle owners | Player recovery, stream decision, subtitle delivery, native media, or debug-redaction behavior changes. |
| `FCP-6-SF8` | existing coverage sufficient | Channel setup flow coverage remains no-action; no channel setup source changed. | channel-setup owners | Setup persistence, planning/build, session runtime, abort/stale-result, or UI flow changes. |
| `FCP-6-SF9` | existing coverage sufficient | Lifecycle/offline/recovery coverage remains no-action; no lifecycle source changed. | lifecycle/recovery owners | Lifecycle, offline, resume, persistence flush, or recovery contract changes. |
| `FCP-6-SF10` | no new automated test needed | FCP-5 portability assumptions remain owned by FCP-5 records; FCP-6 did not add speculative runtime adapters or port mocks. | app/runtime portability owner | A concrete port plan opens or FCP-5 platform/storage/filesystem assumptions change. |
| `FCP-6-SF11` | deferred future-port proof | Real Windows/Electron shell, device Plex, native media, and manual integration proof remain intentionally deferred because that runtime does not exist in this package. | future-port test owner | A real Windows/Electron shell, device validation pass, or port execution plan opens. |

## Package Decomposition

package_id: `FCP-6-test-confidence`

checklist_token: `FCP-6`

source_finding_ids: `FCP-6-SF1`, `FCP-6-SF2`, `FCP-6-SF3`, `FCP-6-SF4`, `FCP-6-SF5`, `FCP-6-SF6`, `FCP-6-SF7`, `FCP-6-SF8`, `FCP-6-SF9`, `FCP-6-SF10`, `FCP-6-SF11`

slice_table:

| slice_id | goal | areas/files | source_finding_ids | verification | dependencies | stop_condition | handoff_condition | serial_only / parallel_group | parallel_justification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FCP-6-S1` | Add a narrow public contract test for exit-confirm owner behavior: modal render/accessibility state, focus registration, Cancel close, Exit `window.close()`, and cleanup. | `src/modules/ui/exit-confirm/__tests__/ExitConfirmCoordinator.test.ts` and/or `src/modules/ui/exit-confirm/__tests__/ExitConfirmModal.test.ts`; read-only adjacent files `ExitConfirmCoordinator.ts`, `ExitConfirmModal.ts`, `constants.ts`, `src/modules/navigation/__tests__/NavigationCoordinator.test.ts`. | `FCP-6-SF2` | `npm run test -- --runTestsByPath <new-or-updated-exit-confirm-test-path>`; `npm run typecheck`; `npm run verify`; `npm run verify:docs`; `git diff --check`. | Clean plan review. | Stop if the test exposes a production defect, requires changing navigation manager/coordinator production logic, requires changing root Back/Exit UX, or needs assertions against private fields instead of public behavior. | Focused tests pass, full verify passes, docs verification passes, and implementation review finds no material issues. | serial_only | This is the only admitted cleanup-now implementation slice. |
| `FCP-6-D1` | Preserve existing coverage/no-action dispositions for startup, Plex, token/security, persistence, player, channel setup, lifecycle, and FCP-5 assumptions. | Audit/plan/checklist docs only; source/test files remain read-only unless a replan admits a new finding. | `FCP-6-SF1`, `FCP-6-SF3`, `FCP-6-SF4`, `FCP-6-SF5`, `FCP-6-SF6`, `FCP-6-SF7`, `FCP-6-SF8`, `FCP-6-SF9`, `FCP-6-SF10` | Source review against the audit plus `npm run verify:docs`; `npm run verify` only if runtime/source/test changes touch these areas. | Audit approval. | Stop if a reviewer finds a source-backed critical-path coverage gap that is not owned by `FCP-6-S1`. | Audit remains source-backed with one final owner/revisit trigger for each no-action/deferred item. | serial_only | These are coverage dispositions, not implementation slices. |
| `FCP-6-D2` | Defer real Windows/Electron shell, device Plex, native media, and manual integration proof to the future-port test owner. | Audit/plan/checklist docs only. | `FCP-6-SF11` | Source review against the audit plus `npm run verify:docs`. | Audit approval. | Stop if the current task is expanded to implement or validate a real port. | Future-port test owner and trigger remain explicit before FCP-EXIT. | serial_only | The required runtime does not exist yet, so automated tests now would be speculative. |

coverage_check:

- `FCP-6-SF1` maps exactly to disposition slice `FCP-6-D1`, final owner app-shell/initialization owner, revisit trigger startup ordering/readiness/auth/server routing changes.
- `FCP-6-SF2` maps exactly to implementation slice `FCP-6-S1`.
- `FCP-6-SF3` maps exactly to disposition slice `FCP-6-D1`, final owner Plex auth/discovery/library/stream owners, revisit trigger Plex contract changes.
- `FCP-6-SF4` maps exactly to disposition slice `FCP-6-D1`, final owner Plex/security owners, revisit trigger token storage, token-bearing URL/header construction, logging, diagnostics, debug, or auth/connectivity changes.
- `FCP-6-SF5` maps exactly to disposition slice `FCP-6-D1`, final owner server-selection/persistence owners, revisit trigger selected-server persistence/resume/rollback changes.
- `FCP-6-SF6` maps exactly to disposition slice `FCP-6-D1`, final owner scheduler/channel persistence and settings owners, revisit trigger storage-key, channel persistence, or settings store contract changes.
- `FCP-6-SF7` maps exactly to disposition slice `FCP-6-D1`, final owner player/Plex stream/subtitle owners, revisit trigger player recovery, stream decision, subtitle delivery, or media policy changes.
- `FCP-6-SF8` maps exactly to disposition slice `FCP-6-D1`, final owner channel-setup owners, revisit trigger setup persistence, planning/build, session runtime, or UI flow changes.
- `FCP-6-SF9` maps exactly to disposition slice `FCP-6-D1`, final owner lifecycle/recovery owners, revisit trigger lifecycle, offline, resume, persistence flush, or recovery contract changes.
- `FCP-6-SF10` maps exactly to disposition slice `FCP-6-D1`, final owner app/runtime portability owner, revisit trigger a concrete port plan or any change to FCP-5 platform/storage/filesystem assumptions.
- `FCP-6-SF11` maps exactly to defer slice `FCP-6-D2`, final owner future-port test owner, revisit trigger a concrete Windows/Electron shell, device validation, or port execution plan.

ready_now_slice: `FCP-6-S1`

ready_now_execution_unit: `FCP-6-S1`

recommended_slice_order: `FCP-6-S1`, then `FCP-6-D1`/`FCP-6-D2` closeout confirmation.

parallel_execution_policy: serial only. No parallel implementation units are approved because the package admits one focused test slice and the remaining work is disposition/closeout proof.

## Files In Scope

Ready execution unit implementation scope:

- `src/modules/ui/exit-confirm/__tests__/ExitConfirmCoordinator.test.ts`
- `src/modules/ui/exit-confirm/__tests__/ExitConfirmModal.test.ts`

Read-only implementation context:

- `src/modules/ui/exit-confirm/ExitConfirmCoordinator.ts`
- `src/modules/ui/exit-confirm/ExitConfirmModal.ts`
- `src/modules/ui/exit-confirm/constants.ts`
- `src/modules/navigation/__tests__/NavigationCoordinator.test.ts`

Planning/closeout docs in scope:

- `docs/plans/2026-04-29-fcp-6-test-confidence-audit.md`
- `docs/plans/2026-04-29-fcp-6-test-confidence.md`
- `ARCHITECTURE_CLEANUP_CHECKLIST.md`

## Files Out Of Scope

- Production source changes unless the focused test exposes a real defect; that is a stop/replan trigger before source edits.
- `src/App.ts`, `src/bootstrap.ts`, `src/core/initialization/**`, `src/core/orchestrator/**`, and `src/core/server-selection/**` except read-only review.
- `src/modules/navigation/**` except read-only review of existing Back/Exit tests and contracts.
- `src/modules/plex/**`, `src/modules/player/**`, `src/modules/scheduler/**`, `src/modules/settings/**`, `src/modules/lifecycle/**`, and `src/core/channel-setup/**` except read-only review.
- `docs/api/plex-integration.md`, `docs/architecture/CURRENT_STATE.md`, and `docs/architecture/modules.md` unless implementation changes public ownership or contract; that would require replan.
- Any Windows/Electron port, native shell integration, filesystem, IPC, or real Plex/device test harness.

## Planner Self-Check

1. Unresolved architecture seam? No. `FCP-6-S1` stays at the exit-confirm UI owner and does not move navigation or app-shell ownership.
2. Adjacent contract/type changes needed but out of scope? No. The ready unit can test public coordinator/modal behavior with existing constants and mocked navigation methods.
3. Out-of-scope files implicitly relied on? Navigation, startup, Plex, player, scheduler, settings, lifecycle, and channel setup files are audited for coverage but not required for `FCP-6-S1` implementation.
4. Codanna evidence path recorded? Yes, with explicit unavailable-tool fallback and deterministic query/read coverage.
5. Repo-preferred owner? Yes. Exit-confirm behavior stays in `src/modules/ui/exit-confirm`; navigation routing stays in navigation tests.
6. Would a fresh session need to invent policy? No. Source findings, owners, verification, scope, and stop/replan triggers are explicit.
7. Execution-grade? Yes for `FCP-6-S1`; deferred/no-action findings are owner-trigger records, not hidden implementation tasks.

## Architecture Seam Decision Gate

Chosen seam: add public behavior tests at the `src/modules/ui/exit-confirm` owner boundary. Do not push exit-confirm behavior tests into `NavigationCoordinator` beyond the existing routing proof, and do not test private fields on `ExitConfirmCoordinator` or `ExitConfirmModal`.

Stop and replan if implementation needs to:

- change production source,
- change root Back/Exit UX,
- change `window.close()` semantics for the current webOS packaged app,
- move modal/focus ownership into navigation or app-shell code,
- touch Plex, player, scheduler, settings, channel setup, lifecycle, startup, or selected-server source/test files,
- add brittle assertions against private fields, full DOM snapshots, or incidental registration order beyond stable public behavior,
- widen verification beyond the listed commands,
- implement or simulate a Windows/Electron runtime.

## Verification Commands

Verification strategy: `new regression/contract test required`.

Before plan review, controller must run:

```sh
npm run verify:docs
```

Expected: docs/checklist/active-plan verifier passes after adding the audit, active plan, and checklist pointers.

After implementing `ready_now_execution_unit`, worker/controller must run:

```sh
npm run test -- --runTestsByPath src/modules/ui/exit-confirm/__tests__/ExitConfirmCoordinator.test.ts
npm run typecheck
npm run verify
npm run verify:docs
git diff --check
```

Expected:

- focused exit-confirm tests pass and prove modal render/focus registration, Cancel, Exit-to-Home, and cleanup contracts;
- typecheck passes;
- full `npm run verify` passes because this is a UI/navigation-adjacent test change for a runtime behavior contract;
- `npm run verify:docs` passes after checklist/audit/plan closeout updates;
- `git diff --check` reports no whitespace errors.

Why this depth matches risk: the admitted gap is a small, stable user-visible boundary between Back navigation and the current webOS exit contract. A focused contract test is warranted; broad port mocks or device tests are not.

## Priority-Exit Readiness

`FCP-6` is the final FCP package before `FCP-EXIT`. `FCP-EXIT` is blocked until this section is satisfied during closeout.

Approved source finding disposition before `FCP-EXIT`:

- `FCP-6-SF1`: no implementation now; app-shell/initialization owner; revisit on startup ordering/readiness/auth/server routing changes.
- `FCP-6-SF2`: retired by `FCP-6-S1` in commit `ef09466b` with focused tests, full verification, and clean implementation review.
- `FCP-6-SF3`: no implementation now; Plex auth/discovery/library/stream owners; revisit on Plex contract changes.
- `FCP-6-SF4`: no P0 security gap admitted; Plex/security owners; revisit on token storage, token-bearing URL/header construction, logging, diagnostics, debug, or auth/connectivity changes.
- `FCP-6-SF5`: no implementation now; server-selection/persistence owners; revisit on selected-server persistence/resume/rollback changes.
- `FCP-6-SF6`: no implementation now; scheduler/channel persistence and settings owners; revisit on storage-key, channel persistence, or settings store contract changes.
- `FCP-6-SF7`: no implementation now; player/Plex stream/subtitle owners; revisit on player recovery, stream decision, subtitle delivery, or media policy changes.
- `FCP-6-SF8`: no implementation now; channel-setup owners; revisit on setup persistence, planning/build, session runtime, or UI flow changes.
- `FCP-6-SF9`: no implementation now; lifecycle/recovery owners; revisit on lifecycle, offline, resume, persistence flush, or recovery contract changes.
- `FCP-6-SF10`: no implementation now; app/runtime portability owner; revisit when a concrete port plan opens or FCP-5 platform/storage/filesystem assumptions change.
- `FCP-6-SF11`: deferred to future-port test owner; revisit when a real Windows/Electron shell, device validation, or port execution plan opens.

P0 security-gate disposition: no P0 security finding is admitted by the FCP-6 audit. Implementation commit `ef09466b` touched only exit-confirm tests and did not change token/security behavior.

Closeout evidence:

- audit updated with `FCP-6-SF2` proof and unchanged owner/revisit records for every no-action/deferred finding;
- checklist `FCP-6` mini-record updated after clean implementation review and controller verification;
- focused test passed: `npm run test -- --runTestsByPath src/modules/ui/exit-confirm/__tests__/ExitConfirmCoordinator.test.ts` (4 tests);
- `npm run typecheck` passed;
- `npm run verify` passed, including coverage, tools, contracts, docs verification, and build;
- `npm run verify:docs` passed after checklist/audit/plan closeout updates;
- `git diff --check` passed after closeout edits;
- clean implementation review approved `FCP-6-S1`;
- fresh FCP-6 priority-exit closeout review approved completion with no material findings;
- `FCP-EXIT` may start only through its own cleanup-loop scope-load and final reconciliation pass.

## Rollback Notes

If `FCP-6-S1` creates brittle or failing test coverage without revealing a production defect, revert only the new exit-confirm test file(s) from that implementation batch and keep this audit/plan/checklist planning state intact for replan. If the focused test exposes a real production defect, do not patch source under this plan; stop and replan with the defect, owner, and verification surface named explicitly.

## Commit Checkpoints

- Planning checkpoint: audit artifact, active plan, and `ARCHITECTURE_CLEANUP_CHECKLIST.md` mini-record update can be committed separately from implementation.
- Implementation checkpoint after approval: one focused non-interactive commit for `FCP-6-S1` test changes only. Do not bundle active tracked plan edits into the implementation commit unless the controller explicitly chooses a separate tracked-doc commit.
- Closeout checkpoint: checklist/audit/plan status updates after verification and clean implementation/closeout reviews.
