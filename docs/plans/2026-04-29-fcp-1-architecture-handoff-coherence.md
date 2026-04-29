**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

# FCP-1 Architecture And Handoff Coherence First Package Plan

## Goal

Execute the first ready `FCP-1` package by narrowing the app-shell server-selection handoff so app-shell and server-select code no longer compile against core/orchestrator selected-server resume details they do not own.

The repo-wide source-backed audit companion is `docs/plans/2026-04-29-fcp-1-architecture-handoff-audit.md`. This execution plan owns `ready_now_execution_unit: FCP-1-S1` and references that audit companion for broader FCP-1 coverage, deferred findings, accepted/no-action areas, and known uncertainty.

## Non-Goals

- Do not decompose `src/core/orchestrator/AppOrchestrator.ts` broadly.
- Do not change server-selection behavior, startup resume behavior, persistence rollback behavior, EPG refresh behavior, or server-select UI behavior.
- Do not change `ServerSelectionCoordinator.selectServer()` or `AppOrchestrator.selectServer()` result semantics.
- Do not widen package roots, restore broad root barrels, or add compatibility/fallback APIs.
- Do not use Desloppify output, issue ids, package maps, score deltas, or triage as intake, proof, prioritization, or closure.
- Do not mark `FCP-1` complete after `FCP-1-S1` while deferred source findings remain unresolved or explicitly accepted by review.

## Parent Priority Alignment

Checklist token: `FCP-1`

This plan advances architecture and handoff coherence by reducing a broad cross-module runtime contract at the app-shell/server-selection boundary. The broader source-backed FCP-1 audit and candidate dispositions live in `docs/plans/2026-04-29-fcp-1-architecture-handoff-audit.md`.

`ARCHITECTURE_CLEANUP_CHECKLIST.md` requires source-backed package briefs for FCP work. This plan uses `source_finding_id` coverage only.

The checklist also requires every FCP package or priority that claims repo-wide or package-wide audit coverage to link a tracked master audit artifact or tracked per-area/package audit artifacts. For this first `FCP-1` package, the tracked audit artifact is `docs/plans/2026-04-29-fcp-1-architecture-handoff-audit.md`; the checklist mini-record must carry that link, the active execution plan link, the source-finding proof matrix, deferred owners and revisit triggers, verification evidence, and clean adversarial review evidence before `FCP-1` closeout. This plan does not close `FCP-1`; `FCP-1-SF3` and `FCP-1-SF4` remain deferred until future source-backed package briefs or explicit source-backed no-action acceptance.

## Required Reading

1. `agents.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/cleanup-loop.md`
4. `docs/agentic/plan-authoring-standard.md`
5. `docs/architecture/CURRENT_STATE.md`
6. `ARCHITECTURE_CLEANUP_CHECKLIST.md`
7. `docs/plans/2026-04-29-fcp-1-architecture-handoff-audit.md`
8. `src/core/app-shell/AppShellRuntimeContracts.ts`
9. `src/core/app-shell/AppLazyScreenPortFactory.ts`
10. `src/core/server-selection/ServerSelectionTypes.ts`
11. `src/core/server-selection/ServerSelectionCoordinator.ts`
12. `src/modules/ui/server-select/ServerSelectScreen.ts`
13. `src/core/app-shell/__tests__/AppShellRuntimeContracts.test.ts`
14. `src/core/app-shell/__tests__/AppLazyScreenPortFactory.test.ts`
15. `src/core/server-selection/__tests__/ServerSelectionCoordinator.test.ts`
16. `src/modules/ui/server-select/__tests__/ServerSelectScreen.test.ts`

## Required Skills

- `architecture-boundaries`: composition-root, runtime contract, and cross-module handoff cleanup.
- `verification-strategy`: verification mode and proof surface are locked before implementation.
- `execution-plan-authoring`: serious tracked cleanup plan with FCP source-backed coverage.

## Codanna Discovery

- `get_index_info`: Codanna index was available and fresh enough for this revision: 11116 symbols, 696 files, semantic search enabled, embeddings updated during the revision. The original planning pass observed 11114 symbols and the same 696 indexed files.
- `semantic_search_with_context`: broad FCP-1 queries for `AppOrchestrator initialization composition root handoff server selection`, `root package exports internal barrel Orchestrator App`, and `server-selection ServerSelectionTypes OrchestratorServerSelectionResult UI imports` returned weak/noisy matches, mostly unrelated settings or Plex symbols. These were insufficient for package membership.
- `search_documents`: query `CURRENT_STATE server-selection AppOrchestrator package root exports` returned relevant hits for `docs/architecture/modules.md`, `docs/architecture/CURRENT_STATE.md`, and the API surface decision log. Document search also logged lock-busy auto-sync warnings, but returned usable results.
- `find_symbol`: `AppOrchestrator` resolved to `src/core/orchestrator/AppOrchestrator.ts`, class range 260-2448. `find_symbol ServerSelectionCoordinator` unexpectedly returned an unrelated EPG binding symbol, so exact symbol lookup was insufficient for that owner.
- `analyze_impact`: `AppOrchestrator` and `ServerSelectionCoordinator` returned zero impacted symbols, which is not credible for these shared runtime seams. Treat impact output as insufficient and rely on direct source/import/test reads for this package.
- Fallback recorded: because Codanna semantic and impact results were insufficient for package membership, the audit used `rg`, `find`, `wc -l`, and direct `nl -ba` source reads for deterministic evidence. The full candidate matrix and known uncertainty are tracked in `docs/plans/2026-04-29-fcp-1-architecture-handoff-audit.md`.

No external documentation was needed.

## Impact Snapshot

This execution plan implements the first ready package from the tracked audit companion. The audit companion records the broader source-backed candidate matrix, including deferred findings `FCP-1-SF3` and `FCP-1-SF4`, accepted/no-action areas, and possible misses.

Current package brief:

`FCP-1-SF1`: App-shell server-selection runtime port exposes core/orchestrator selected-server internals.

- Source evidence: `src/core/app-shell/AppShellRuntimeContracts.ts` imports `OrchestratorServerSelectionResult` from `../server-selection/ServerSelectionTypes` and exposes it from `AppShellServerSelectionRuntimePort.selectServer(...)`.
- Source evidence: `src/core/server-selection/ServerSelectionTypes.ts` defines the selected result with `readiness`, `persistedSelection`, and `startupResume`; `startupResume` also carries EPG refresh status.
- Source evidence: `src/core/app-shell/AppLazyScreenPortFactory.ts` adapts `runtime.selectServer(...)` into `ServerSelectSelectionResult` and drops those fields before the screen receives the result.
- Source evidence: `src/modules/ui/server-select/ServerSelectScreen.ts` only needs `{ kind: 'selected' }` or `{ kind: 'selection_failed'; reason }`.
- Production risk: the app-shell boundary compiles against initialization/persistence/EPG resume details it does not own, making future UI or app-shell changes more likely to couple to core startup internals.
- Owner seam: app-shell owns the screen-facing runtime port shape; core/server-selection owns full selected-server workflow and resume details.
- Closure condition: app-shell runtime contracts no longer import `OrchestratorServerSelectionResult` or `ServerSelectionTypes`; app-shell exposes a narrow app-shell-owned selected-server result; core/server-selection and `AppOrchestrator.selectServer()` keep the full result for core tests and diagnostics; server-select behavior is unchanged.

`FCP-1-SF2`: Architecture handoff docs do not name the app-shell server-selection result-narrowing owner.

- Source evidence: `docs/architecture/CURRENT_STATE.md` names `AppLazyScreenPortFactory` as lazy-screen port assembly owner and `ServerSelectionCoordinator.selectServer()` as the full selected-server workflow/result owner, but it does not state which owner narrows the selected-server result for app-shell/screen consumption.
- Source evidence: `docs/architecture/modules.md` describes `src/core/server-selection/ServerSelectionTypes.ts` as owner of `OrchestratorServerSelectionResult`, while source also has an app-shell adaptation seam in `AppLazyScreenPortFactory`.
- Production risk: future handoffs can preserve the current broad app-shell port because docs say where the core result lives but not where it must stop.
- Owner seam: `CURRENT_STATE.md` remains canonical architecture truth; `modules.md` mirrors directory-level ownership after the source contract is narrowed.
- Closure condition: architecture docs distinguish the full core/orchestrator server-selection result from the app-shell/server-select narrow result and keep `src/Orchestrator.ts`, empty core barrels, EPG package root, and overlay package roots documented as accepted bounded seams.

Deferred FCP-1 findings:

- `FCP-1-SF3`: channel-setup UI/core handoff. Deferred to a future FCP-1 package brief or explicit source-backed no-action acceptance in `docs/plans/2026-04-29-fcp-1-architecture-handoff-audit.md`.
- `FCP-1-SF4`: AppOrchestrator runtime assembly hub. Deferred to a future FCP-1 package brief or explicit source-backed no-action acceptance in `docs/plans/2026-04-29-fcp-1-architecture-handoff-audit.md`.

Review gate: plan review must validate the audit companion's candidate matrix before implementation starts. If review identifies a missing source-backed candidate that must precede app-shell server-selection narrowing, stop and replan.

## Files In Scope

- `src/core/app-shell/AppShellRuntimeContracts.ts`
- `src/core/app-shell/AppLazyScreenPortFactory.ts`
- `src/core/app-shell/__tests__/AppShellRuntimeContracts.test.ts`
- `src/core/app-shell/__tests__/AppLazyScreenPortFactory.test.ts`
- `docs/architecture/CURRENT_STATE.md`
- `docs/architecture/modules.md`
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` only for same-pass mini-record/proof-matrix update after implementation and review complete

Conditional, only if type-checking proves the narrowed app-shell contract needs local fixture alignment:

- `src/core/app-shell/AppLazyScreenRegistry.ts`
- `src/core/app-shell/__tests__/AppLazyScreenRegistry.test.ts`

## Files Out Of Scope

- `src/core/orchestrator/AppOrchestrator.ts`, except no-runtime-change type assignability should continue to compile through its existing `selectServer(...)` method.
- `src/core/server-selection/ServerSelectionTypes.ts`
- `src/core/server-selection/ServerSelectionCoordinator.ts`
- `src/core/server-selection/SelectedServerRuntimeController.ts`
- `src/core/server-selection/SelectedServerPersistenceAdapter.ts`
- `src/core/server-selection/__tests__/ServerSelectionCoordinator.test.ts`, except rerunning it for proof.
- `src/modules/ui/server-select/ServerSelectScreen.ts`
- `src/modules/ui/server-select/__tests__/ServerSelectScreen.test.ts`, except rerunning it for proof.
- EPG, Plex stream, player, scheduler, channel-manager, channel-setup runtime, navigation, lifecycle, bootstrap, and package root exports not listed in scope.
- Any archived/historical package maps, Desloppify data, imported issue maps, or score artifacts.

## Planner Self-Check

1. Unresolved ownership seam? No. Core/server-selection keeps the full selected-server workflow/result; app-shell owns the narrow result exposed to screens.
2. Adjacent contract changes hidden out of scope? No. `AppOrchestrator.selectServer()` may remain richer because TypeScript structural typing should allow assignment to the narrower app-shell port. If that assumption fails, stop and replan before changing core/server-selection behavior.
3. Out-of-scope files implicitly relied on? `AppOrchestrator.ts` and server-selection tests are relied on only for compile/test proof, not edits.
4. Codanna evidence path recorded? Yes, including weak semantic results, weak impact results, document search, and deterministic fallback.
5. Repo-preferred owner? Yes. The change reduces app-shell coupling without growing `AppOrchestrator` or the server-select screen.
6. Fresh-session ambiguity? No. The target result shape, owner seam, files, and verification are explicit.
7. Execution-grade? Yes for the selected package. The audit companion records non-ready FCP-1 candidates and accepted/no-action areas so this execution plan can stay focused.
8. Does the plan identify non-ready FCP-1 candidates? Yes, by reference to `docs/plans/2026-04-29-fcp-1-architecture-handoff-audit.md`; `FCP-1-SF3` and `FCP-1-SF4` do not block `FCP-1-S1` unless plan review says one must precede it.

## Architecture Seam Decision Gate

Chosen seam: introduce or move the app-shell/server-select selected-server result contract into app-shell ownership, then make `AppShellServerSelectionRuntimePort.selectServer(...)` expose only the app-shell result:

```ts
type AppShellServerSelectionResult =
    | { kind: 'selection_failed'; reason: ServerSelectSelectionFailureReason }
    | { kind: 'selected' };
```

The exact exported type name can change if the implementer finds an existing local convention, but the ownership must not: app-shell owns the narrowed contract, server-selection owns the full orchestration contract.

Preservation contracts:

- `ServerSelectionCoordinator.selectServer()` still returns readiness, persistence, and startup-resume details to core/orchestrator callers.
- `AppOrchestrator.selectServer()` behavior and public return details remain unchanged.
- `ServerSelectScreenPorts.selectServer(...)` still receives only `ServerSelectSelectionResult`.
- `AppLazyScreenPortFactory` still rejects unknown result kinds instead of treating them as selected.
- No startup ordering, rollback ordering, EPG refresh, persistence, focus, or UI text changes are allowed.

Stop and replan if:

- TypeScript does not allow `AppOrchestrator` to satisfy the narrowed app-shell port without changing `AppOrchestrator.selectServer()` or server-selection result semantics.
- The implementation needs to edit `ServerSelectionCoordinator`, `SelectedServerRuntimeController`, persistence adapters, EPG startup/refresh code, `ServerSelectScreen`, or `AppOrchestrator` behavior.
- The narrowed result cannot preserve the existing unhandled-result guard.
- Architecture docs would need to contradict `CURRENT_STATE.md` or widen any package root/barrel to express the seam.
- Verification requires mocks that mostly restate implementation internals rather than protecting the public handoff contract.

## Package Decomposition

package_id: `fcp-1-architecture-handoff-audit-and-first-package`

checklist_token: `FCP-1`

source_finding_ids: `FCP-1-SF1`, `FCP-1-SF2`, `FCP-1-SF3`, `FCP-1-SF4`

slice_table:

| slice_id | goal | areas/files | source_finding_ids | verification | dependencies | stop_condition | handoff_condition | serial_only_or_parallel_group | parallel_justification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FCP-1-S1` | Narrow the app-shell server-selection result handoff and document the owner seam. | `src/core/app-shell/AppShellRuntimeContracts.ts`, `src/core/app-shell/AppLazyScreenPortFactory.ts`, app-shell tests, `docs/architecture/CURRENT_STATE.md`, `docs/architecture/modules.md`, checklist mini-record at closeout. | `FCP-1-SF1`, `FCP-1-SF2` | Contract/source audits, targeted app-shell/server-selection/server-select tests, `npm run verify`, `npm run verify:docs`. | None. | Any required behavior edit outside the app-shell contract/doc seam, or any need to change core/server-selection result semantics. | Narrow app-shell contract is in source, targeted tests pass, docs identify core-vs-app-shell ownership, checklist mini-record/proof matrix is updated after clean review. | `serial_only` | Single cross-module contract seam; splitting docs/tests/source would create dependent partial states. |

coverage_check:

| source_finding_id | planned_slice_or_defer_path | final_owner | closure_check |
| --- | --- | --- | --- |
| `FCP-1-SF1` | `FCP-1-S1` | App-shell runtime contract owner | `AppShellRuntimeContracts.ts` no longer imports `OrchestratorServerSelectionResult` or `ServerSelectionTypes`; app-shell tests assert the boundary; adapter behavior is unchanged. |
| `FCP-1-SF2` | `FCP-1-S1` | Architecture docs owner | `CURRENT_STATE.md` and `modules.md` name the full core selected-server result owner and the app-shell result-narrowing owner without widening public barrels. |
| `FCP-1-SF3` | Deferred to a future FCP-1 channel-setup handoff package or explicit no-action acceptance after fresh source review. | Channel setup UI/core boundary owner | Future closure either narrows the UI-facing channel-setup contract or records source-backed acceptance of direct core domain imports with docs. |
| `FCP-1-SF4` | Deferred to a future FCP-1 AppOrchestrator runtime assembly package after a narrower source brief is proven. | Core orchestrator runtime assembly owner | Future closure names one concrete AppOrchestrator handoff to narrow and proves the change reduces owner breadth rather than moving hub responsibility. |

ready_now_slice: `FCP-1-S1`

ready_now_execution_unit: `FCP-1-S1`

recommended_slice_order: `FCP-1-S1`

deferred_finding_order: `FCP-1-SF3`, then `FCP-1-SF4`, unless plan review or fresh source audit changes the order.

parallel_execution_policy: Parallel execution is unavailable for the ready-now package. `FCP-1-SF3` and `FCP-1-SF4` are not approved execution units yet; parallel execution may be reconsidered only after later source-backed package splits prove disjoint scopes, independent verification, and explicit rejoin conditions.

## Verification Commands

Primary verification mode: `contract-first`

Plan classification: `new regression/contract test required`

Required source audits after implementation:

```sh
rg -n "OrchestratorServerSelectionResult|ServerSelectionTypes" src/core/app-shell/AppShellRuntimeContracts.ts
```

Expected: no matches.

```sh
rg -n "startupResume|persistedSelection|readiness" src/core/app-shell/AppShellRuntimeContracts.ts src/modules/ui/server-select/ServerSelectScreen.ts
```

Expected: no matches for app-shell/server-select contract leakage. If a match appears only in a comment explaining the separation, prefer removing the comment unless it is necessary for docs; source should stay contract-focused.

```sh
rg -n "OrchestratorServerSelectionResult|SelectedServerStartupResumeResult|startupResume" src/core/server-selection src/core/orchestrator/AppOrchestrator.ts src/__tests__/Orchestrator.test.ts src/core/server-selection/__tests__/ServerSelectionCoordinator.test.ts
```

Expected: the full selected-server result remains in core/orchestrator ownership and core tests still cover startup-resume details.

Required targeted tests:

```sh
npm run test:unit -- src/core/app-shell/__tests__/AppShellRuntimeContracts.test.ts src/core/app-shell/__tests__/AppLazyScreenPortFactory.test.ts src/core/server-selection/__tests__/ServerSelectionCoordinator.test.ts src/modules/ui/server-select/__tests__/ServerSelectScreen.test.ts --runInBand
```

Expected: all named suites pass. The app-shell boundary test must include a new assertion that `AppShellRuntimeContracts.ts` does not import `core/server-selection/ServerSelectionTypes` or expose `OrchestratorServerSelectionResult`.

Required full runtime gate:

```sh
npm run verify
```

Expected: pass, because this is UI/app-shell/Orchestrator-adjacent source work.

Required docs/control-plane gate if docs or checklist are updated:

```sh
npm run verify:docs
```

Expected: pass.

Why this proof depth matches risk: the source change is a contract boundary cleanup, not a behavior change. A narrow contract assertion protects against the same ownership regression returning, targeted tests protect the adapter/core result behavior, and `npm run verify` covers broader TypeScript/runtime regressions.

## Rollback Notes

Rollback is low-risk if no behavior files were edited: revert the app-shell contract/test/doc/checklist changes together.

If type assignability fails and an implementer touched `AppOrchestrator` or server-selection behavior, stop and revert those behavior edits first; this plan does not authorize changing core selected-server semantics.

Do not leave docs claiming the app-shell result is narrowed unless the source contract and tests landed in the same implementation pass.

## Commit Checkpoints

1. `refactor(fcp-1): narrow app-shell server-selection handoff`
   - app-shell contract and adapter/test updates only.
2. `docs(fcp-1): record server-selection handoff ownership`
   - `CURRENT_STATE.md`, `modules.md`, and checklist mini-record/proof matrix after clean implementation review.

If the implementation batch is small and the controller wants one focused checkpoint, combine these only after both runtime and docs verification pass. Active tracked plan docs should not be bundled into delegated implementation commits unless the controller explicitly owns that docs checkpoint.

## Current-Unit Execution Packet

execution_unit: `FCP-1-S1`

files_in_scope: `src/core/app-shell/AppShellRuntimeContracts.ts`, `src/core/app-shell/AppLazyScreenPortFactory.ts`, `src/core/app-shell/__tests__/AppShellRuntimeContracts.test.ts`, `src/core/app-shell/__tests__/AppLazyScreenPortFactory.test.ts`, `docs/architecture/CURRENT_STATE.md`, `docs/architecture/modules.md`, `ARCHITECTURE_CLEANUP_CHECKLIST.md`

files_out_of_scope: `src/core/orchestrator/AppOrchestrator.ts`, `src/core/server-selection/*`, `src/modules/ui/server-select/ServerSelectScreen.ts`, EPG/Plex/player/scheduler/channel-manager/runtime behavior files

constraints:

- Keep runtime behavior invariant.
- Keep full selected-server resume details in core/server-selection and orchestrator tests.
- Keep screen-facing result narrow.
- Do not add compatibility aliases or barrel exports.
- Update checklist mini-record only after source, tests, docs, and review are clean.

verification:

- Run the source audits in `## Verification Commands`.
- Run the targeted test command.
- Run `npm run verify`.
- Run `npm run verify:docs` after docs/checklist updates.

stop_and_replan_if:

- Any core selected-server behavior change appears necessary.
- App-shell cannot type against `AppOrchestrator` without widening back to `OrchestratorServerSelectionResult`.
- The docs update needs to revise broader architecture ownership beyond this seam.
- Targeted tests fail in unrelated runtime areas that would require wider investigation.
