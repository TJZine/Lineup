# DCR-9 Lifecycle Migration And Comment/API Cleanup Plan

**Plan Status:** archived
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

## Goal

Complete the whole `DCR-9` package from `ARCHITECTURE_CLEANUP_CHECKLIST.md`: decide and protect the lifecycle migration seam, then remove or compress restating lifecycle comments while preserving comments that carry invariants, storage ownership, async ordering, platform, or public API meaning.

The migration decision is frozen before source edits:

- `MIGRATIONS` is kept and documented as a package-internal `StateManager` migration registry.
- It is not public lifecycle API. It remains intentionally absent from `src/modules/lifecycle/index.ts`.
- It is not speculative public API. It is a lifecycle-internal seam consumed by `StateManager._migrateState()` so future approved schema migrations have a single registry next to lifecycle storage constants.
- Exact import/export impact for the approved plan: keep the named export from `src/modules/lifecycle/constants.ts` for `src/modules/lifecycle/StateManager.ts`; do not add it to the lifecycle barrel; do not add external consumers; do not remove the import unless the plan is revised after review.

## Non-Goals

- Do not start `DCR-10`, `DCR-EXIT`, priority-exit work, or any broad cleanup program outside `DCR-9`.
- Do not rewrite lifecycle startup sequencing, app-shell orchestration, or platform lifecycle ownership.
- Do not implement a future Windows/Electron port or add future-port placeholders.
- Do not redesign shared storage helpers or move lifecycle storage ownership out of `StateManager`.
- Do not add migration examples, compatibility shims, or broad exports that are not required by the current version-1 lifecycle payload.
- Do not change product behavior while cleaning comments.

## Parent Priority Alignment

`DCR-9` is checklist-linked debt cleanup owned by the lifecycle module owner. The package retires:

- `DCR-9-A1`: lifecycle/AppLifecycle/constants have restating comments that should be removed or compressed while preserving invariant/platform notes.
- `DCR-9-D1`: decide whether empty exported `MIGRATIONS` is an intentional versioning seam or speculative API.

The current architecture truth says `src/modules/lifecycle/` owns lifecycle state, visibility, persistence coordination, and recovery concerns. It also says `StateManager.ts` owns the `lineup_app_state` key only, with versioned lifecycle payload fields `userPreferences` and `lastUpdated`, and only deletes `STORAGE_CONFIG.CLEANUP_KEYS` as bounded cleanup helpers without owning their schemas or migrations.

## Required Reading

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/cleanup-loop.md`
4. `docs/agentic/plan-authoring-standard.md`
5. `docs/agentic/codanna-playbook.md`
6. `docs/architecture/CURRENT_STATE.md`
7. `ARCHITECTURE_CLEANUP_CHECKLIST.md` section `DCR-9`
8. This plan
9. `src/modules/lifecycle/constants.ts`
10. `src/modules/lifecycle/StateManager.ts`
11. `src/modules/lifecycle/AppLifecycle.ts`
12. `src/modules/lifecycle/interfaces.ts`
13. `src/modules/lifecycle/__tests__/StateManager.test.ts`
14. `src/modules/lifecycle/__tests__/AppLifecycle.test.ts`

Freshness gate: before implementation, rerun the `DCR-9` source audits below. If the `MIGRATIONS` import/export surface, lifecycle storage ownership, or checklist membership changed since this plan was written, update the plan before source edits.

## Required Skills

- `architecture-boundaries`
- `persistence-boundaries`
- `verification-strategy`
- `execution-plan-authoring`
- `model-selection`

Model-selection result:

```text
MODEL_SUGGESTION
PLANNER: gpt-5.5 high
IMPLEMENTER: gpt-5.5 medium
REVIEWER: gpt-5.5 high
WHY: Tier 3 checklist-linked lifecycle/persistence cleanup touches a package-internal API seam, storage migration behavior, and closeout consequences. Risk score >=4 from shared lifecycle/persistence surface, multiple boundary skills, public/export-surface audit, checklist linkage, and hidden startup dependency risk. Use gpt-5.4 high/medium/high fallback if gpt-5.5 is unavailable.
```

## Codanna Discovery

Fresh evidence captured on 2026-04-29:

- `git status --short`: only unrelated untracked docs/eval/plan files were present; no in-scope lifecycle source or `ARCHITECTURE_CLEANUP_CHECKLIST.md` dirty files were reported.
- `codanna mcp get_index_info`: 11643 symbols across 743 files; semantic search enabled with `AllMiniLML6V2`; 518 embeddings; index created/updated 8 minutes before the refresh.
- `codanna mcp semantic_search_with_context query:"lifecycle MIGRATIONS StateManager versioned app state"`: no semantic matches, so deterministic fallback was required.
- `codanna mcp search_symbols query:MIGRATIONS`: found `MIGRATIONS` in `src/modules/lifecycle/constants.ts`, plus weak related hits for `StateManager`, `PersistentState`, `load`, and `_migrateState`.
- `codanna mcp find_symbol StateManager`: found `src/modules/lifecycle/StateManager.ts`; docs summarize it as localStorage persistence with versioning, migrations, and quota errors.
- `codanna mcp analyze_impact MIGRATIONS`: reported 0 impacted symbols. This is insufficient because raw source shows an import from `StateManager`; implementation must use `rg` fallback before any import/export change.
- `codanna mcp search_documents query:"DCR-9 Lifecycle Migration Comment API Cleanup MIGRATIONS"`: returned weak/noisy historical plan and decision-log hits, and warned that docs auto-sync failed because the docs collection lock was busy. Direct tracked-doc reads were therefore required.
- Direct reads refreshed `AGENTS.md`, `docs/AGENTIC_DEV_WORKFLOW.md`, `docs/agentic/session-prompts/cleanup-loop.md`, `docs/agentic/plan-authoring-standard.md`, `docs/agentic/codanna-playbook.md`, `docs/architecture/CURRENT_STATE.md`, and `ARCHITECTURE_CLEANUP_CHECKLIST.md` section `DCR-9`.
- Raw fallback audit `rg -n "\bMIGRATIONS\b" src docs ARCHITECTURE_CLEANUP_CHECKLIST.md -S` found only the checklist entry plus `src/modules/lifecycle/constants.ts` and `src/modules/lifecycle/StateManager.ts` in source.

## Impact Snapshot

Current source facts:

- `src/modules/lifecycle/constants.ts` exports empty `MIGRATIONS` with restating migration comments.
- `src/modules/lifecycle/StateManager.ts` imports `MIGRATIONS` directly from `./constants` and consumes it only in `_migrateState()`.
- `src/modules/lifecycle/index.ts` does not re-export `MIGRATIONS`; the approved decision keeps that absence intentional.
- `StateManager.load()` returns `null` for absent, invalid, missing-version, or failed-migration state; preserves future versions without downgrading; repairs loaded state to lifecycle-owned `PersistentState` fields only.
- `StateManager.save()` stamps the current lifecycle schema version and `lastUpdated`.
- `src/modules/lifecycle/interfaces.ts` already has concise invariant comments for async save errors, platform seams, phase waits, and persistence/network warnings.
- Existing `StateManager.test.ts` covers current-version save/load, missing-version rejection, future-version preservation, minimal-state repair, and dropping legacy non-owned fields. It does not by itself prove the older-version-without-migration rejection path while `STATE_VERSION` is currently `1`; `DCR-9-S1` must add or explicitly confirm that proof.
- Existing `AppLifecycle.test.ts` covers idempotent initialization, authenticating-before-`stateRestored`, shutdown ordering, final flush behavior, relaunch disposer cleanup, pending transition behavior, and public lifecycle surface expectations.

The Codanna impact result is not authoritative for `MIGRATIONS` because it missed the raw import. Treat `rg` and direct source audit as the impact gate for this package.

## Package Decomposition

`package_id`: `DCR-9`

`checklist_token`: `DCR-9`

`package_issue_ids`:

- `DCR-9-A1`
- `DCR-9-D1`

`slice_table`:

| slice_id | goal | areas/files | exact_issue_ids | verification | dependencies | stop_condition | handoff_condition | execution_policy | parallel_justification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DCR-9-S1` | Document and protect the `MIGRATIONS` decision as package-internal lifecycle migration registry, not public API. | `src/modules/lifecycle/constants.ts`; `src/modules/lifecycle/StateManager.ts`; `src/modules/lifecycle/__tests__/StateManager.test.ts`; `src/modules/lifecycle/index.ts` read-only export audit only; `src/modules/lifecycle/types.ts` read-only unless a lifecycle payload contract source/doc reference is directly needed. | `DCR-9-D1` | Source audit for all `MIGRATIONS` imports/exports and lifecycle constants consumers; targeted `StateManager` tests/source references proving current-version load/save, future-version load, missing-version rejection, older-version-without-migration rejection, minimal-state repair, and legacy non-owned field dropping; `npm run typecheck` if API/export shape changes; `npm run verify`. | None. Must happen before S2. | Replan if implementation wants to remove `MIGRATIONS`, make it public API, change persisted payload schema, change future-version handling, add migration compatibility behavior, or edit app-shell startup sequencing. | `MIGRATIONS` status is explicitly documented in source/tests; import/export shape matches this plan; no public barrel export is added; older-version-without-migration behavior is protected. | serial_only | This slice chooses the package API/persistence seam; comment cleanup must not proceed until it is resolved. |
| `DCR-9-S2` | Remove or compress restating lifecycle comments while preserving invariant/platform/source-signal notes. | `src/modules/lifecycle/AppLifecycle.ts`; `src/modules/lifecycle/constants.ts`; `src/modules/lifecycle/interfaces.ts`; `src/modules/lifecycle/StateManager.ts`; lifecycle tests only if comment cleanup exposes or requires test-reference updates. | `DCR-9-A1` | Behavior-neutral source audit over lifecycle comments; targeted lifecycle tests if any source/API shape changed in S1; `npm run typecheck`; `npm run verify`; `npm run verify:docs` if checklist/current-state/docs/tracked plan references change. | After `DCR-9-S1` is reviewed clean. | Replan if comment cleanup requires behavior changes, future-port implementation, storage helper redesign, broader lifecycle cleanup, or app-shell startup sequencing work. | Restating comments are removed/compressed; invariant/platform/async/persistence notes remain; behavior and public lifecycle events are unchanged. | serial_only | S2 touches overlapping lifecycle files and depends on S1's migration-source wording. |

`coverage_check`:

- `DCR-9-D1` maps exactly to `DCR-9-S1`; final owner is `DCR-9`.
- `DCR-9-A1` maps exactly to `DCR-9-S2`; final owner is `DCR-9`.
- No accepted residuals are approved by this plan.

`ready_now_slice`: `DCR-9-S1`

`ready_now_execution_unit`: `DCR-9-S1`

`recommended_slice_order`:

1. `DCR-9-S1`
2. `DCR-9-S2`

`parallel_execution_policy`: unavailable by default. The package has overlapping lifecycle write surfaces, and S2 depends on S1's migration wording and test/source references. Do not run slices in parallel unless a reviewed replan proves disjoint write surfaces, disjoint verification surfaces, and no shared import/export decision.

## Files In Scope

Implementation source/test scope:

- `src/modules/lifecycle/constants.ts`
- `src/modules/lifecycle/StateManager.ts`
- `src/modules/lifecycle/AppLifecycle.ts`
- `src/modules/lifecycle/interfaces.ts`
- `src/modules/lifecycle/__tests__/StateManager.test.ts`
- `src/modules/lifecycle/__tests__/AppLifecycle.test.ts`

Conditional/read-only-with-exception scope:

- `src/modules/lifecycle/types.ts`: read-only except if the `MIGRATIONS` decision directly needs a lifecycle payload contract source/doc reference.
- `src/modules/lifecycle/index.ts`: read-only except lifecycle export surface audit, unless reviewed `DCR-9-D1` decision changes `MIGRATIONS` import/export shape.
- `docs/architecture/CURRENT_STATE.md`: only if lifecycle ownership truth changes.
- `ARCHITECTURE_CLEANUP_CHECKLIST.md`: closeout status only after implementation and review complete; not part of the current planning pass.
- `docs/plans/2026-04-29-dcr-9-lifecycle-migration-comment-api-cleanup.md`: active plan surface owned by the controller/planner.

## Files Out Of Scope

- `src/utils/storage.ts` and broad storage helper redesign.
- App-shell startup sequencing and orchestration files unless a reviewed replan approves a lifecycle API change that requires them.
- Future Windows/Electron port implementation.
- `DCR-10`, `DCR-EXIT`, unrelated lifecycle cleanup, and repo-wide comment cleanup.
- New public lifecycle exports unrelated to the approved `MIGRATIONS` decision.
- New helpers, adapters, compatibility shims, or migration examples that are not required to protect the current version-1 lifecycle payload.

## Planner Self-Check

- Architecture seam: resolved. `MIGRATIONS` is package-internal `StateManager` migration registry, not public lifecycle API.
- Adjacent contracts: frozen. `PersistentState` shape remains lifecycle-owned and versioned; `types.ts` is read-only unless the source/doc reference is directly needed.
- Out-of-scope dependencies: explicit. `index.ts` remains audit-only unless a reviewed DCR-9-D1 change alters import/export shape; app-shell startup and storage helper redesign are out of scope.
- Codanna and fallback evidence: recorded, including the insufficient `analyze_impact MIGRATIONS` result and `rg` fallback.
- Ownership: assigned to the lifecycle module owner without expanding composition roots or shared storage helpers.
- Fresh-session readiness: S1/S2 order, migration decision, file scope, invariants, verification, and stop conditions are explicit.
- Plan grade: execution-ready at the seam level without pseudo-code implementation detail.

## Architecture Seam Decision Gate

Approved seam:

- `StateManager` remains the lifecycle persistence owner for `lineup_app_state`.
- `MIGRATIONS` remains package-internal to lifecycle persistence. It is exported from `constants.ts` only so `StateManager` can consume the registry; it is not re-exported from `index.ts` and must not become public lifecycle API during DCR-9.
- Empty registry is intentional while `STORAGE_CONFIG.STATE_VERSION` is `1`. Older persisted versions without an approved migration remain rejected by `_migrateState()`; future versions remain accepted and repaired without downgrading.

Preservation contracts:

- `StateManager.save()` stamps current version and `lastUpdated`.
- `StateManager.load()` returns `null` for absent, invalid, missing-version, parse-failed, or missing-migration older state.
- Future versions are not downgraded.
- Repair keeps only lifecycle-owned `PersistentState` fields: `version`, `userPreferences`, and `lastUpdated`.
- Cleanup keys remain removal-only helpers; `StateManager` does not own their schemas.
- `AppLifecycle.initialize()` remains idempotent and reaches `authenticating` before `stateRestored` observers run.
- Shutdown ordering remains: transition to `terminating`, emit `beforeTerminate`, run terminate callbacks, final flush, monitor/listener cleanup, relaunch disposer cleanup, and listener removal.
- `saveState()` promise settlement behavior, pending transition tracking, phase validity, and public lifecycle events remain unchanged.
- Comment cleanup must preserve storage ownership boundaries, lifecycle phase/save ordering, webOS/platform relaunch notes, and non-obvious async/persistence semantics.

Stop and replan if:

- source audit finds external `MIGRATIONS` consumers outside lifecycle internals;
- implementation wants to remove `MIGRATIONS`, make it public API, or change the lifecycle barrel export;
- current-source proof shows the persisted lifecycle payload contract must change;
- older-version-without-migration behavior is intentionally changed instead of documented/protected;
- comment cleanup requires runtime behavior changes;
- app-shell startup sequencing, future port work, or broad storage helper redesign becomes necessary;
- verification scope widens beyond targeted lifecycle tests plus `npm run verify`.

## Verification Commands

Verification mode: `contract-first` for `DCR-9-S1`, then `refactor-invariance` for `DCR-9-S2`.

Plan classification: `new regression/contract test required`

Planning artifact verification:

```bash
npm run plans:check
```

Expected result: active tracked plan conformance passes.

Required S1 source audits before source changes:

```bash
rg -n "\bMIGRATIONS\b" src docs ARCHITECTURE_CLEANUP_CHECKLIST.md -S
rg -n "STORAGE_CONFIG|MEMORY_THRESHOLDS|ERROR_MESSAGES|VALID_PHASE_TRANSITIONS|NETWORK_CHECK_PROBE_URL|TIMING_CONFIG" src/modules src/core src/App.ts -S
```

Expected result: all `MIGRATIONS` source consumers are accounted for before import/export decisions; lifecycle constants consumers do not require broad API changes.

Required S1 targeted proof:

```bash
npm test -- --runInBand src/modules/lifecycle/__tests__/StateManager.test.ts
```

Expected result: `StateManager` tests pass and include or confirm proof for current-version load/save, future-version load, missing-version rejection, older-version-without-migration rejection, minimal-state repair, and legacy non-owned field dropping.

Minimum targeted lifecycle proof after source/API changes:

```bash
npm test -- --runInBand src/modules/lifecycle/__tests__/StateManager.test.ts src/modules/lifecycle/__tests__/AppLifecycle.test.ts
npm run typecheck
npm run verify
```

Expected result: both targeted lifecycle suites pass, typecheck passes, and full verification passes because lifecycle startup/persistence behavior is touched.

Docs/control-plane proof when checklist/current-state/docs/tracked plan references change:

```bash
npm run verify:docs
```

Expected result: docs verification passes. The active tracked plan remains conformant and any checklist/current-state references stay truthful.

New test rationale: existing tests protect much of `StateManager` and `AppLifecycle`, but the empty migration registry needs explicit contract proof for older-version-without-migration rejection if it is kept as intentional package-internal API.

## Rollback Notes

- If the S1 migration test or source audit shows `MIGRATIONS` is not safely package-internal, stop and replan before changing comments.
- If an attempted `MIGRATIONS` documentation change accidentally changes import/export shape, revert that narrow change and restore the approved package-internal import from `constants.ts` to `StateManager.ts`.
- If comment cleanup removes a contract-critical note, restore only the specific invariant/platform/async/persistence comment; do not restore broad template comments.
- If lifecycle behavior changes or `npm run verify` fails due to lifecycle startup/persistence behavior, revert the source edits for the failing slice and keep this active plan for revision.

## Commit Checkpoints

- Plan checkpoint: this tracked plan may be committed separately from implementation work.
- Implementation checkpoint after `DCR-9-S1`: include only focused lifecycle source/test changes for the migration decision and proof; exclude active tracked plan updates unless the controller explicitly commits plan progress separately.
- Implementation checkpoint after `DCR-9-S2` and package closeout: include focused lifecycle comment/source-signal cleanup, any required tests, and checklist/current-state updates only after verification and review are clean.
- Do not bundle unrelated untracked docs/eval files or unrelated plan files into DCR-9 commits.
