# FCP-5 Portability Readiness

**Plan Status:** completed

**Task family:** cleanup/refactor

**Cleanup subtype:** checklist-linked

## Goal

Prepare current production code for future Windows/Electron-style portability without implementing that port.

The approved source audit is `docs/plans/2026-04-29-fcp-5-portability-readiness-audit.md`. This plan admits exactly one cleanup-now source finding: `FCP-5-SF1`, the lifecycle `StateManager` direct `localStorage` bypass. All other audited platform-bound assumptions are intentional webOS invariants, accepted browser-renderer contracts, or future-port-triggered deferred items with owners.

## Non-Goals

- Do not implement a Windows/Electron port.
- Do not add a broad platform framework, runtime selector, compatibility shim, or unused adapter.
- Do not change Plex auth/token semantics, Plex URL construction, stream policy, subtitle delivery policy, root Back/Exit UX, Media Session behavior, fullscreen behavior, or webOS platform identity.
- Do not use Desloppify outputs, imported issue ids, score deltas, package maps, or generated task queues for FCP-5 intake, proof, prioritization, or closeout.
- Do not move unrelated storage owners or normalize all browser globals.

## Parent Priority Alignment

`FCP-5` is the final package before `FCP-6`. It advances portability readiness by making the only source-proven cleanup-now portability blocker explicit and bounded while preserving true webOS-only production invariants.

`FCP-6` must not start until `FCP-5` is completed with:

- updated audit and plan/source-finding proof matrix,
- verification evidence,
- checklist mini-record closeout,
- clean closeout review,
- one final owner plus revisit trigger for every deferred finding.

## Required Reading

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/cleanup-loop.md`
4. `ARCHITECTURE_CLEANUP_CHECKLIST.md` entry `FCP-5`
5. `docs/agentic/plan-authoring-standard.md`
6. `docs/architecture/CURRENT_STATE.md`
7. `docs/architecture/modules.md`
8. `docs/agentic/codanna-playbook.md`
9. `docs/plans/2026-04-29-fcp-5-portability-readiness-audit.md`
10. `src/modules/lifecycle/StateManager.ts`
11. `src/utils/storage.ts`
12. `src/modules/lifecycle/__tests__/StateManager.test.ts`
13. `src/__tests__/mocks/localStorage.ts`

Freshness gate: if any required source file, storage-owner docs, or the `FCP-5` checklist mini-record changed after this plan was written, update the audit and this plan before implementation.

## Required Skills

- `architecture-boundaries`: keep `StateManager` inside lifecycle persistence ownership and avoid expanding composition roots or platform framework scope.
- `persistence-boundaries`: route lifecycle storage through the shared safe storage mechanics while preserving `lineup_app_state` ownership.
- `plex-integration-boundaries`: use as a guardrail only; no Plex auth, URL, token, stream, or discovery changes are in scope.
- `ui-composition-patterns`: use as a guardrail only; no TV-visible UI or focus changes are in scope.
- `verification-strategy`: selected before plan freeze.
- `execution-plan-authoring`: this is the active serious tracked plan.

## Codanna Discovery

- `semantic_search_with_context`: unavailable; no Codanna MCP tools are exposed in this controller session.
- `search_documents`: unavailable for the same reason; direct tracked-doc reads were used instead.
- `analyze_impact`: unavailable; impact was bounded by direct source reads and `rg` fallback.
- Fallback: `rg` and direct reads covered platform/webOS, storage, browser globals, networking/fetch/XHR, lifecycle/startup/shutdown, fullscreen/media, filesystem absence, Plex connectivity/auth/token handling, platform detection, and runtime contracts. The exact fallback query list is recorded in the audit artifact.

Codanna fallback is a known planning uncertainty, not a blocker for this bounded implementation unit because `FCP-5-SF1` is localized to `StateManager`, `src/utils/storage.ts`, and existing `StateManager` tests.

## Impact Snapshot

Approved source findings:

| source_finding_id | Classification | Disposition |
| --- | --- | --- |
| `FCP-5-SF1` | future-port blocker needing cleanup now | Resolved by implementation commit `2f54311e`; closeout review approved completion. |
| `FCP-5-SF2` | intentional webOS-only invariant / portable runtime port | Defer to platform owner; future port trigger only. |
| `FCP-5-SF3` | intentional webOS-only invariant with future-port revisit | Accepted residue; navigation/exit UI owner. |
| `FCP-5-SF4` | accepted portable browser-renderer contract | No runtime cleanup now; Plex/player transport owners. |
| `FCP-5-SF5` | accepted/no-action media contract | No runtime cleanup now; player and Plex stream owners. |
| `FCP-5-SF6` | accepted/no-action filesystem absence | No runtime cleanup now; app/runtime owner. |
| `FCP-5-SF7` | security triage / accepted no P0 | No P0 admitted; Plex/security owners. |

Expected implementation impact for `FCP-5-S1`:

- `src/modules/lifecycle/StateManager.ts`: replace raw direct `localStorage` calls with safe helper calls/results while preserving synchronous `save/load/clear` behavior and existing quota-cleanup semantics as closely as the helper contract allows.
- `src/modules/lifecycle/__tests__/StateManager.test.ts`: add or tighten tests for unavailable storage, failed storage reads, failed cleanup writes/removes, and quota retry behavior.
- `src/utils/storage.ts`: in scope only if the worker proves a narrow helper is necessary for `StateManager`; otherwise prefer existing `safeLocalStorageGet`, `safeLocalStorageSetWithResult`, `safeLocalStorageRemove`, `safeLocalStorageRemoveByPrefixes`, and current parsing helpers.

No app-shell, Plex, navigation, player, platform identity, or UI behavior files are implementation scope for the ready unit.

## Source Finding Proof Matrix

| source_finding_id | Required proof before closeout | P0/security disposition |
| --- | --- | --- |
| `FCP-5-SF1` | Resolved by commit `2f54311e`: source audit shows no production raw `localStorage.*` / `sessionStorage.*` calls remain outside `src/utils/storage.ts`; `StateManager` tests cover blocked load, blocked clear, cleanup remove failures, quota retry failure, and unavailable save while preserving lifecycle persistence behavior. Focused tests, typecheck, full verify, docs verification, raw-storage audit, and implementation review passed. | No token/security surface. |
| `FCP-5-SF2` | Audit remains explicit that webOS platform defaults are preserved and deferred to a real port trigger. | No P0. Do not change Plex identity headers in this package. |
| `FCP-5-SF3` | Audit remains explicit that `window.close()` root-exit behavior is accepted webOS residue with owner/revisit trigger. | No P0. |
| `FCP-5-SF4` | Audit remains explicit that fetch/XHR subtitle and Plex transport behavior is accepted browser-renderer contract. | No P0. Do not change token-bearing request construction. |
| `FCP-5-SF5` | Audit remains explicit that native media and webOS codec policy are accepted/no-action. | No P0. Do not change stream policy or Media Session behavior. |
| `FCP-5-SF6` | Static source audit still finds no production filesystem/Electron dependency. | No P0. |
| `FCP-5-SF7` | Token/logging source audit remains redacted; no implementation touches token behavior. | Expected P0 disposition before `FCP-6`: clear/no P0 admitted, or stop and replan with Plex/security owner if token behavior changes. |

## Package Decomposition

package_id: `FCP-5-portability-readiness`

checklist_token: `FCP-5`

source_finding_ids: `FCP-5-SF1`, `FCP-5-SF2`, `FCP-5-SF3`, `FCP-5-SF4`, `FCP-5-SF5`, `FCP-5-SF6`, `FCP-5-SF7`

slice_table:

| slice_id | goal | areas/files | source_finding_ids | verification | dependencies | stop_condition | handoff_condition | serial_only / parallel_group | parallel_justification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FCP-5-S1` | Route lifecycle state persistence through safe optional-storage helpers and prove blocked/unavailable storage is non-fatal where the lifecycle contract expects it. | `src/modules/lifecycle/StateManager.ts`, `src/modules/lifecycle/__tests__/StateManager.test.ts`, optionally `src/utils/storage.ts` only for a narrowly justified helper. | `FCP-5-SF1` | `npm run test -- --runTestsByPath src/modules/lifecycle/__tests__/StateManager.test.ts`; `npm run typecheck`; `npm run verify`; `npm run verify:docs`; source audit `rg -n "\blocalStorage\.\w+|\bsessionStorage\.\w+" src --glob '!**/__tests__/**'`. | Audit and plan approval. | Stop if preserving `StateManager.save()` requires async persistence, a new storage backend, changing lifecycle public contracts, touching unrelated stores, or broad platform abstraction. | Tests/source audit prove `FCP-5-SF1` retired; audit/checklist updated; clean implementation review. | serial_only | This is the only cleanup-now runtime slice and it owns the only source-proven blocker. |
| `FCP-5-D1` | Preserve webOS platform invariants and owned future-port trigger without runtime changes. | Audit/checklist/plan docs only. Platform source remains out of implementation scope. | `FCP-5-SF2`, `FCP-5-SF3`, `FCP-5-SF4`, `FCP-5-SF5`, `FCP-5-SF6`, `FCP-5-SF7` | Source review against the audit plus `npm run verify:docs`; `npm run verify` only if runtime code changes accidentally touch these areas. | Audit approval. | Stop if implementation needs to change platform identity, root exit behavior, Plex token/URL behavior, media policy, filesystem assumptions, or runtime contracts. | Deferred owner/revisit triggers remain recorded in audit and checklist; clean plan/closeout review. | serial_only | These are accepted/deferred disposition records, not implementation work. |

coverage_check:

- `FCP-5-SF1` maps exactly to implementation slice `FCP-5-S1`.
- `FCP-5-SF2` maps exactly to defer/no-action record `FCP-5-D1`, final owner platform owner, revisit trigger concrete Windows/Electron port plan or runtime selection change.
- `FCP-5-SF3` maps exactly to defer/no-action record `FCP-5-D1`, final owner navigation/exit UI owner, revisit trigger root Back/Exit behavior change or non-webOS runtime plan.
- `FCP-5-SF4` maps exactly to defer/no-action record `FCP-5-D1`, final owner Plex/player transport owners, revisit trigger missing browser-compatible `fetch`/`XMLHttpRequest` in a future runtime or subtitle transport policy change.
- `FCP-5-SF5` maps exactly to defer/no-action record `FCP-5-D1`, final owner player and Plex stream owners, revisit trigger future media/capability contract change.
- `FCP-5-SF6` maps exactly to defer/no-action record `FCP-5-D1`, final owner app/runtime owner, revisit trigger any proposed production filesystem/Electron IPC/local file picker/OS storage contract.
- `FCP-5-SF7` maps exactly to defer/no-action record `FCP-5-D1`, final owner Plex/security owners, revisit trigger any token storage, token-bearing URL/header construction, logging, debug surface, or Plex auth/connectivity behavior change.

ready_now_slice: `FCP-5-S1`

ready_now_execution_unit: `FCP-5-S1`

recommended_slice_order: `FCP-5-S1`, then `FCP-5-D1` closeout confirmation.

parallel_execution_policy: serial only. No parallel implementation units are approved because the only runtime slice touches lifecycle persistence and the remaining package work is disposition/closeout proof.

## Files In Scope

Runtime/source implementation scope for `ready_now_execution_unit`:

- `src/modules/lifecycle/StateManager.ts`
- `src/modules/lifecycle/__tests__/StateManager.test.ts`
- `src/utils/storage.ts` only if a narrowly scoped safe-storage helper is proven necessary; prefer existing helpers first.

Planning/closeout docs in scope:

- `docs/plans/2026-04-29-fcp-5-portability-readiness-audit.md`
- `docs/plans/2026-04-29-fcp-5-portability-readiness.md`
- `ARCHITECTURE_CLEANUP_CHECKLIST.md`

## Files Out Of Scope

- `src/platform/**` except read-only review.
- `src/modules/plex/**` except read-only review.
- `src/modules/player/**` except read-only review.
- `src/modules/navigation/**` and `src/modules/ui/exit-confirm/**` except read-only review.
- `src/App.ts`, `src/bootstrap.ts`, `src/core/app-shell/**`, and `src/core/orchestrator/**` except read-only review.
- `docs/api/plex-integration.md`, `docs/architecture/CURRENT_STATE.md`, and `docs/architecture/modules.md` unless implementation actually changes a public ownership or Plex contract, which is a stop/replan trigger.
- Any Electron, Windows, Node filesystem, IPC, runtime selector, or platform adapter files.

## Planner Self-Check

1. Unresolved architecture seam? No. `FCP-5-S1` stays inside lifecycle persistence ownership and shared storage mechanics.
2. Adjacent contract/type changes needed but out of scope? No. `StateManager` remains synchronous and lifecycle-owned.
3. Out-of-scope files implicitly relied on? Platform/Plex/player/navigation files are audited but not needed for `FCP-5-S1` implementation.
4. Codanna evidence path recorded? Yes, with explicit unavailable-tool fallback and `rg` coverage.
5. Repo-preferred owner? Yes. Lifecycle state stays in `StateManager`; storage mechanics stay in `src/utils/storage.ts`.
6. Would a fresh session need to invent policy? No. Source findings, owners, verification, and stop/replan triggers are explicit.
7. Execution-grade? Yes for `FCP-5-S1`; deferred/no-action findings are owner-trigger records, not hidden implementation tasks.

## Architecture Seam Decision Gate

Chosen seam: keep browser storage mechanics in `src/utils/storage.ts` and lifecycle state schema/cleanup ownership in `src/modules/lifecycle/StateManager.ts`.

`StateManager` may consume safe helpers; it must not become a generic storage abstraction and must not move lifecycle state ownership elsewhere.

Stop and replan if implementation needs to:

- implement an actual Electron/Windows runtime or runtime selector,
- introduce a broad platform framework, compatibility adapter, or unused abstraction,
- touch new owners outside lifecycle storage or shared storage mechanics,
- change `StateManager` public synchronous contracts,
- change startup/shutdown ordering,
- change Plex auth/token behavior, token-bearing URL/header construction, logging, or debug surfaces,
- change webOS root Back/Exit behavior,
- change media/fullscreen/player/Plex stream policy,
- widen verification beyond the commands listed here,
- rely on filesystem/Electron/Node APIs in production source.

## Verification Commands

Verification strategy: `new regression/contract test required` for `FCP-5-S1`, supported by source audit and broad integration verification.

Before plan review, controller must run:

```sh
npm run verify:docs
```

Expected: docs/checklist/active-plan verifier passes after adding the audit, active plan, and checklist pointers.

After implementing `ready_now_execution_unit`, worker/controller must run:

```sh
npm run test -- --runTestsByPath src/modules/lifecycle/__tests__/StateManager.test.ts
npm run typecheck
npm run verify
npm run verify:docs
rg -n "\blocalStorage\.\w+|\bsessionStorage\.\w+" src --glob '!**/__tests__/**'
```

Expected:

- focused `StateManager` tests pass, including unavailable-storage proof added for `FCP-5-SF1`;
- typecheck passes;
- full `npm run verify` passes because this is runtime/source behavior in lifecycle/storage;
- `npm run verify:docs` passes after checklist/audit/plan closeout updates;
- storage source audit shows no production raw `localStorage.*`/`sessionStorage.*` calls outside `src/utils/storage.ts`, or any intentional exception is explicitly added to the audit with one owner and replan approval.

Why this depth matches risk: this is a behavior-preserving cleanup of lifecycle persistence failure handling. It needs a narrow contract regression test because the current tests do not prove blocked/unavailable storage, and it needs `npm run verify` because runtime/source lifecycle behavior changed.

## Priority-Exit Readiness

`FCP-5` is the final package for this FCP priority. `FCP-6` is blocked until this section is satisfied during closeout.

Approved source finding disposition before `FCP-6`:

- `FCP-5-SF1`: must be retired by `FCP-5-S1` with tests, source audit, verification evidence, and clean implementation review.
- `FCP-5-SF2`: deferred/no-action, final owner platform owner, revisit trigger concrete Windows/Electron port plan or runtime selection change.
- `FCP-5-SF3`: accepted residue, final owner navigation/exit UI owner, revisit trigger root Back/Exit behavior change or non-webOS runtime plan.
- `FCP-5-SF4`: accepted browser-renderer contract, final owner Plex/player transport owners, revisit trigger missing browser-compatible fetch/XHR in future runtime or subtitle transport policy change.
- `FCP-5-SF5`: accepted media contract, final owner player and Plex stream owners, revisit trigger future media/capability contract change.
- `FCP-5-SF6`: accepted filesystem absence, final owner app/runtime owner, revisit trigger proposed production filesystem/Electron IPC/local file picker/OS storage contract.
- `FCP-5-SF7`: security triage/no P0 admitted, final owner Plex/security owners, revisit trigger any token storage, token-bearing URL/header construction, logging, debug surface, or Plex auth/connectivity behavior change.

Expected P0 security-gate disposition: no P0 security finding is admitted by the FCP-5 audit. If implementation changes token/security behavior, stop and replan under Plex/security ownership before closeout.

Closeout must include:

- audit updated with `FCP-5-SF1` resolved proof and deferred/no-action owner records for `FCP-5-SF2` through `FCP-5-SF7`;
- checklist `FCP-5` mini-record updated after the clean priority-exit review;
- `npm run verify` and `npm run verify:docs` evidence recorded;
- clean closeout review completed with no blocking findings;
- explicit statement that `FCP-6` was blocked until all above evidence was present.

Closeout evidence already observed by the controller:

- Plan review found no material findings and approved `ready_now_execution_unit` `FCP-5-S1`.
- Implementation commit `2f54311e` resolved `FCP-5-SF1`.
- Focused tests passed: `npm run test -- --runTestsByPath src/modules/lifecycle/__tests__/StateManager.test.ts` (24 tests).
- `npm run typecheck` passed.
- `npm run verify` passed.
- `npm run verify:docs` passed before implementation and again as part of `npm run verify`.
- Raw storage source audit passed and reports raw production storage calls only in `src/utils/storage.ts`.
- `git diff --check` passed.
- Fresh implementation review approved `FCP-5-S1` with no material findings.
- Fresh priority-exit closeout review found no blocking findings and approved marking `FCP-5` completed after this plan/checklist status update and final docs verification.

## Rollback Notes

If `FCP-5-S1` regresses lifecycle persistence or storage failure behavior, revert only the `StateManager`/test/helper changes from that implementation batch and keep this audit/plan/checklist planning state intact. Do not revert unrelated user changes. If rollback reveals that safe-helper routing cannot preserve the synchronous lifecycle contract, stop and replan rather than introducing async or platform-specific storage.

## Commit Checkpoints

- Planning checkpoint: audit artifact, active plan, and `ARCHITECTURE_CLEANUP_CHECKLIST.md` mini-record update can be committed separately from runtime implementation.
- Implementation checkpoint after approval: one focused non-interactive commit for `FCP-5-S1` runtime/test changes only. Do not bundle active tracked plan edits into the implementation commit unless the controller explicitly chooses a separate tracked-doc commit.
- Closeout checkpoint: checklist/audit/plan status updates after verification and clean review.
