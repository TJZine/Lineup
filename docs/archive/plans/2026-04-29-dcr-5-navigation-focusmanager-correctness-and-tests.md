# DCR-5 Navigation FocusManager Correctness And Tests

**Plan Status:** archived
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

## Goal

Retire `ARCHITECTURE_CLEANUP_CHECKLIST.md` package `DCR-5` by tightening `FocusManager` visibility behavior and proof coverage, then removing low-signal generated-looking comments after the behavior is locked by tests.

The chosen `DCR-5-D1` policy is: `_isVisible` must keep excluding zero-size, hidden, detached, and non-fixed elements with no layout parent, but it must admit visible `position: fixed` candidates with a non-zero bounding rect. `offsetParent === null` is not by itself a visibility failure for fixed-position elements.

## Non-Goals

- No broad `NavigationManager` or remote input refactor.
- No Settings focus extraction or screen-specific focus coordinator rewrite.
- No public navigation API, `IFocusManager`, `FocusableElement`, or `FocusGroup` contract change unless implementation proves the private policy cannot be tested or preserved through the existing `findNeighbor` seam.
- No new shared visibility helper unless the FocusManager-local implementation becomes meaningfully duplicated inside this package.

## Parent Priority Alignment

Parent artifact: `ARCHITECTURE_CLEANUP_CHECKLIST.md` item `DCR-5`.

This plan is a checklist-linked DCR package. DCR membership is owned by the checklist mini-record, not by detector output, imported issue ids, Desloppify rows, or score deltas. Package closeout requires all listed DCR-5 actual issues and owner decisions to have one outcome.

## Required Reading

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/cleanup-loop.md`
4. `ARCHITECTURE_CLEANUP_CHECKLIST.md`, especially `DCR Operating Rules` and the full `DCR-5` mini-record
5. `docs/architecture/CURRENT_STATE.md` Navigation section
6. `docs/agentic/plan-authoring-standard.md`
7. `docs/agentic/codanna-playbook.md`
8. `src/modules/navigation/FocusManager.ts`
9. `src/modules/navigation/interfaces.ts` as read/context only unless a direct FocusManager contract need is proven
10. `src/modules/navigation/__tests__/FocusManager.test.ts`

Freshness gate: before implementation starts, re-read the DCR-5 mini-record and `FocusManager.ts`. If `_isVisible`, `findNeighbor`, `FocusGroup`, or the navigation owner docs changed materially after this plan was written, stop and refresh the plan before editing source or tests.

## Required Skills

- `ui-composition-patterns`: D-pad/focus behavior is TV-visible UI behavior.
- `verification-strategy`: DCR-5 is under-proven focus correctness and needs explicit proof mode selection.
- `execution-plan-authoring`: this is an active Tier 3 cleanup-loop handoff.

`architecture-boundaries` was not loaded for this plan because discovery kept the intended implementation inside private `FocusManager` behavior and tests. Load it before widening to public navigation contracts, ownership boundaries, or cross-module API changes.

## Codanna Discovery

- `semantic_search_with_context query:"FocusManager navigation visibility offsetParent fixed position grid spatial" limit:8`: found `FocusManager`, `_navigateGrid`, `_calculateSpatialNeighbor`, `_isVisible`, `IFocusManager`, and adjacent `NavigationManager.moveFocus` context.
- `find_symbol FocusManager`: found class symbol `3252` in `src/modules/navigation/FocusManager.ts`; it implements `IFocusManager` from `interfaces.ts`.
- `find_symbol _isVisible`: found multiple symbols named `_isVisible`; the FocusManager method is symbol `3311` in `src/modules/navigation/FocusManager.ts`.
- `analyze_impact symbol_id:3252`: reported limited class impact, with `NavigationManager` as the affected dependent.
- `analyze_impact symbol_id:3311`: reported the visibility policy impact chain as `_calculateSpatialNeighbor` -> `findNeighbor` -> `NavigationManager.moveFocus`.
- `find_callers symbol_id:3271`: confirmed `FocusManager.findNeighbor` is called by `NavigationManager.moveFocus`.
- `search_documents query:"DCR-5 FocusManager _isVisible offsetParent" limit:8`: returned noisy focus/design hits and emitted a docs auto-sync lock warning. Deterministic fallback for docs context was direct reads of `ARCHITECTURE_CLEANUP_CHECKLIST.md`, `CURRENT_STATE.md`, and the plan-authoring docs.
- Direct fallback reads: `FocusManager.ts`, `interfaces.ts`, `FocusManager.test.ts`, `NavigationManager.ts` `moveFocus` lines, and narrow `rg` searches for navigation registration/fixed-position evidence.

## Impact Snapshot

`_isVisible` is private and only gates spatial fallback candidates inside `_calculateSpatialNeighbor`. Explicit neighbor mappings and focus group navigation do not currently call `_isVisible`.

The public behavioral surface is `FocusManager.findNeighbor` and, through `NavigationManager.moveFocus`, D-pad movement. The plan must therefore prove behavior through `findNeighbor` tests rather than by testing private methods directly.

The impact radius is contained enough for a FocusManager-local source/test change. A public API change would invalidate this plan and require architecture-boundary review.

## Files In Scope

- `src/modules/navigation/FocusManager.ts`
- `src/modules/navigation/__tests__/FocusManager.test.ts`

Read/context only unless the seam changes:

- `src/modules/navigation/interfaces.ts`
- `src/modules/navigation/NavigationManager.ts`

## Files Out Of Scope

- Broad `NavigationManager` implementation changes.
- `src/modules/navigation/interfaces.ts` contract edits without a proven direct FocusManager contract need.
- Remote input router/repeat controller/channel-number input refactors.
- Settings focus extraction or screen-specific focus coordinator rewrites.
- UI CSS/layout changes outside tests needed to simulate visibility policy.

## Package Decomposition

`package_id: DCR-5`

`checklist_token: ARCHITECTURE_CLEANUP_CHECKLIST.md#DCR-5`

`package_issue_ids: DCR-5-A1, DCR-5-A2, DCR-5-D1`

`slice_table:`

| slice_id | goal | areas/files | exact_issue_ids | verification | dependencies | stop_condition | handoff_condition | parallel_group | parallel_justification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DCR-5-S1` | Decide and implement the `_isVisible` fixed-position policy, then add high-signal grid/spatial/visibility tests through `findNeighbor`. | `FocusManager.ts`, `FocusManager.test.ts` | `DCR-5-A2`, `DCR-5-D1` | Targeted FocusManager Jest tests cover grid navigation, spatial fallback, zero-size/hidden candidates, and fixed-position `offsetParent === null` candidates; then source audit of `_isVisible`. | none | Public navigation/interface changes are needed; jsdom cannot faithfully test the chosen policy; source proof shows the policy affects multiple screen focus coordinators beyond FocusManager; test setup would have to assert private methods directly. | Tests and source behavior establish the fixed-position policy without widening files beyond the approved scope. | `serial_only` | S1 owns the behavior decision and tests that S2 must preserve. |
| `DCR-5-S2` | Remove or compress restating/generated-looking FocusManager comments while preserving real invariants. | `FocusManager.ts` | `DCR-5-A1` | Source audit confirms restating docblocks/comments are removed or compressed and invariant comments remain; targeted FocusManager Jest still passes; full verify gates run before closeout. | `DCR-5-S1` | Comment cleanup risks obscuring the fixed-position invariant; source cleanup requires contract/interface wording changes; new behavior changes are discovered. | FocusManager source signal is cleaner, real invariants remain documented, and DCR-5 has no unowned actual issues or decisions. | `serial_only` | Comment cleanup must not race the behavior-locking tests. |

`coverage_check:`

| package_issue_id | owner slice or residual path | final owner |
| --- | --- | --- |
| `DCR-5-A1` | `DCR-5-S2` | navigation/focus owner |
| `DCR-5-A2` | `DCR-5-S1` | navigation/focus owner |
| `DCR-5-D1` | `DCR-5-S1` | navigation/focus owner |

`ready_now_slice: DCR-5-S1`

`ready_now_execution_unit: DCR-5-S1`

`recommended_slice_order: DCR-5-S1 -> DCR-5-S2`

`parallel_execution_policy: serial only. DCR-5-S2 depends on the behavior tests and fixed-position policy established by DCR-5-S1, and both slices touch FocusManager.ts.`

No DCR-5 residuals are accepted beyond the checklist's already accepted residual: no broad navigation rewrite; only FocusManager contract/source-signal cleanup is admitted.

## Planner Self-Check

- No unresolved ownership seam remains: `FocusManager` owns the private visibility decision; `NavigationManager` remains only the caller.
- No adjacent contract/type change is planned. `interfaces.ts` is frozen unless implementation proves an unavoidable public contract need.
- Files declared out of scope are not required for the approved implementation path.
- Codanna evidence and fallback direct reads are recorded above.
- The plan assigns work to the navigation/focus owner and does not grow a UI screen coordinator.
- A fresh session should not need to invent the `_isVisible` policy, package coverage, serial order, or verification depth.
- This is execution-grade for the approved scope; ordinary helper/test fixture details are left to the implementer.

## Architecture Seam Decision Gate

Chosen seam: keep visibility policy private to `FocusManager` and prove it through the public `findNeighbor` behavior. Fixed-position elements with a non-zero rect and computed `position: fixed` are visible candidates even when `offsetParent` is `null`; non-fixed candidates with `offsetParent === null` remain excluded unless source proof requires a broader policy.

Stop and replan if any of these occur:

- Implementing the policy requires changing `IFocusManager`, `FocusableElement`, `FocusGroup`, `INavigationManager`, or any other public navigation contract.
- Source proof shows multiple screen-specific focus coordinators depend on incompatible visibility semantics.
- jsdom cannot provide a reliable targeted proof surface for fixed-position/offsetParent behavior even with controlled `getBoundingClientRect`, `offsetParent`, and computed-style setup.
- Browser/manual proof becomes necessary to validate the policy.
- The needed write scope expands beyond `FocusManager.ts` and `FocusManager.test.ts`.
- The implementation uncovers live DCR-5 residual debt that does not map to `DCR-5-S1` or `DCR-5-S2` under the same owner, seam, and verification envelope.

Absorb-now rule: only absorb newly discovered FocusManager-local visibility or comment residue when it stays within the same slice goal, same two-file write scope, same navigation/focus owner, and same verification commands.

## Verification Commands

Verification strategy classification: `new regression/contract test required`.

Primary mode: `contract-first` for the fixed-position visibility policy, with `refactor-invariance` for comment cleanup after tests pass. This depth is required because DCR-5 explicitly identifies missing grid/spatial/fixed-position tests as production risk for TV D-pad focus behavior.

Commands and proof surfaces:

1. `npm run plans:check`
   - Expected: plan conformance passes for this active DCR-5 plan.
2. `npm test -- --runInBand src/modules/navigation/__tests__/FocusManager.test.ts`
   - Expected: FocusManager tests pass, including new coverage for grid navigation, spatial fallback scoring, zero-size/hidden candidates, and the chosen fixed-position `offsetParent === null` policy.
3. `rg -n "offsetParent|position|_isVisible|/\\*\\*|//" src/modules/navigation/FocusManager.ts`
   - Expected: source audit shows `_isVisible` implements the chosen fixed-position policy and remaining comments document real invariants instead of restating obvious code.
4. `npm run verify`
   - Expected: full UI/navigation verification passes.
5. `npm run verify:docs`
   - Expected: docs/control-plane verification passes before closeout because this active plan and eventual checklist state are tracked docs surfaces.

Closeout also requires updating the DCR-5 mini-record in `ARCHITECTURE_CLEANUP_CHECKLIST.md` in the controller closeout pass after implementation and review are clean. That checklist edit is not part of this planner-only pass.

## Rollback Notes

If fixed-position visibility breaks focus movement, revert the `FocusManager.ts` visibility-policy change and the corresponding DCR-5-S1 tests together. Do not keep tests that assert a policy no longer implemented.

If comment cleanup removes necessary invariants, restore only the invariant comments, not the broad generated-looking docblock pattern. Checklist closeout must wait until tests and source audit pass again.

## Commit Checkpoints

- Worker implementation checkpoint after `DCR-5-S1`: source/test changes for visibility policy and targeted FocusManager tests only.
- Worker implementation checkpoint after `DCR-5-S2`: FocusManager source-signal cleanup only, if kept separate by the controller.
- Keep active `docs/plans/*` changes out of worker implementation commits. Checklist and plan-progress updates belong to controller closeout or a separate docs commit.

## Execution Handoff

Start with `ready_now_execution_unit: DCR-5-S1`.

For `DCR-5-S1`, implement the chosen `_isVisible` policy through the existing private helper and prove it via `findNeighbor` behavior. Add targeted tests that mock stable rectangles and layout/style signals explicitly enough that jsdom limitations do not accidentally define the contract. Do not test `_isVisible` directly.

For `DCR-5-S2`, run only after S1 is green. Remove or compress restating comments in `FocusManager.ts`, but preserve comments that explain non-obvious invariants such as focus-memory preservation and fixed-position visibility policy.
