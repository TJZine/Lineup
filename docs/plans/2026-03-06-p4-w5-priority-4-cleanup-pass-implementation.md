# P4-W5 Priority 4 UI Cleanup Pass Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete `P4-W5` by removing leftover Priority 4 split glue (placeholder view wrappers, temporary focus bridges, dead EPG host refs, and transitional review-loading conditionals) while preserving current Channel Setup, Settings, and EPG behavior.

**Architecture:** Keep existing owners from `P4-W2` through `P4-W4` intact: `EPGInfoPanelCoordinator` remains the EPG info-panel owner; `ChannelSetupSessionController` remains setup session/async owner; step controllers remain render-focused. Cleanup should remove transitional plumbing around those boundaries, not introduce new owners.

**Tech Stack:** TypeScript, Jest (jsdom + fake timers where needed), existing Lineup UI modules under `src/modules/ui/**`.

---

## Goal

- Finish `P4-W5 - Cleanup pass for Priority 4`.
- Remove known transitional leftovers from the prior Priority 4 extraction sequence without behavior changes.

## Non-Goals

- No redesign or visual behavior changes.
- No new UI architecture or collaborator families.
- No changes to `NavigationManager` contracts.
- No changes to Plex/persistence modules.
- No compatibility shims or dual-path fallbacks.

## Parent Priority Alignment

Priority 4 targets smaller UI owners with explicit focus/render/state boundaries. `P4-W2` through `P4-W4` established those boundaries, and `P4-W5` is the stabilization pass that removes residual transitional glue so the split owners become the durable steady-state design.

## Freshness Gate

Run before implementation:

```bash
git rev-parse --show-toplevel
rg -n "P4-W5" ARCHITECTURE_CLEANUP_CHECKLIST.md
rg -n "_renderCappedWarnings|_registerFocusables\\(|_unregisterFocusables\\(|renderBuildReviewLoading|registerFocusables: \\(|renderCappedWarnings: \\(" src/modules/ui/channel-setup/ChannelSetupScreen.ts src/modules/ui/channel-setup/steps/types.ts src/modules/ui/channel-setup/steps/BuildReviewStepController.ts src/modules/ui/channel-setup/steps/StrategyStepController.ts src/modules/ui/channel-setup/steps/LibraryStepController.ts src/modules/ui/channel-setup/steps/BuildProgressStepController.ts
rg -n "infoPanelElement|classicShowcaseInfoElement|overlayShowcaseElement|attachHosts\\(" src/modules/ui/epg/EPGComponent.ts src/modules/ui/epg/EPGInfoPanelCoordinator.ts
```

Expected:

- Repo root resolves to this Lineup checkout.
- `P4-W5` is still unchecked.
- The transitional seams above still exist in current files.

If freshness fails, update this plan before editing.

## Required Reading

1. `agents.md`
2. `docs/agentic/document-map.md`
3. `docs/AGENTIC_DEV_WORKFLOW.md`
4. `docs/agentic/codanna-playbook.md`
5. `docs/agentic/plan-authoring-standard.md`
6. `docs/agentic/historical-plan-corpus-review.md`
7. `docs/architecture/CURRENT_STATE.md`
8. `ARCHITECTURE_CLEANUP_CHECKLIST.md`
9. `docs/plans/2026-03-06-p4-w2-epg-info-panel-orchestration-split-implementation.md`
10. `docs/plans/2026-03-06-p4-w3-channel-setup-session-flow-split-implementation.md`
11. `docs/plans/2026-03-06-p4-w4-ui-focus-render-primitives-consolidation-implementation.md`

## Required Skills

Planning/session launcher order for this task:

1. `using-superpowers`
2. `brainstorming`
3. `architecture-boundaries`
4. `ui-composition-patterns`
5. `writing-plans`

Implementation pass skills:

1. `using-superpowers`
2. `brainstorming`
3. `architecture-boundaries`
4. `ui-composition-patterns`
5. `test-driven-development`
6. `verification-before-completion`

## Codanna Discovery

- `semantic_search_with_context` (typescript, threshold 0.3) on cleanup seams surfaced:
  - `SettingsScreen._registerFocusables` (`symbol_id:6140`)
  - `SettingsScreen.hide` (`symbol_id:6132`)
  - Channel setup focus/unregister surfaces
- `find_symbol` + `analyze_impact` for key cleanup symbols:
  - `_renderCappedWarnings` in `ChannelSetupScreen` (`symbol_id:5329`) impacts 4 render paths.
  - `_registerFocusables` in `ChannelSetupScreen` (`symbol_id:5341`) impacts 6 paths.
  - `_unregisterFocusables` in `ChannelSetupScreen` (`symbol_id:5343`) impacts 13 paths.
  - `_registerFocusables` in `SettingsScreen` (`symbol_id:6140`) impacts 8 settings paths.
  - `ChannelSetupScreen` class (`symbol_id:5157`) external impact remains bounded through `AppLazyScreenRegistry` and `App`.
- `search_documents`:
  - Returned workflow/checklist context hits.
  - One targeted query timed out; direct tracked-doc reads were used as fallback for task-specific context.
- Explicit fallback reads (`rg` + direct files) used to locate:
  - callback glue in `ChannelSetupScreen.ts` and `steps/types.ts`
  - async review-loading kickoff logic in `BuildReviewStepController.ts`
  - dead EPG host refs in `EPGComponent.ts`

## Impact Snapshot

- High-risk behavior to preserve:
  - Step 2 focus graph and preferred-focus restoration in Channel Setup.
  - Step 3 review loading/build confirmation flow.
  - EPG info-panel host switching between overlay/classic modes.
  - Settings focus registration behavior.
- Cleanup seams selected:
  - Remove transitional callback plumbing from Channel Setup step controller deps where ownership is now stable.
  - Move review-load side effects out of step view controller and into screen/session orchestration boundary.
  - Remove EPG host fields that are now dead after coordinator extraction.
- Risk level: moderate (UI focus and async loading paths), bounded to Priority 4 UI modules.

## External Reference Notes

- 2026-03-06, Context7 `/mdn/content`:
  - `removeEventListener` removal matching depends on same listener reference and capture flag alignment.
  - `clearTimeout(timeoutId)` safely cancels pending timer work.
- 2026-03-06, Context7 `/jestjs/jest`:
  - `jest.useFakeTimers()` with `jest.advanceTimersByTime()` is the deterministic timer-test path.

## Files In Scope

- `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
- `src/modules/ui/channel-setup/focus/ChannelSetupFocusCoordinator.ts`
- `src/modules/ui/channel-setup/steps/types.ts`
- `src/modules/ui/channel-setup/steps/StrategyStepController.ts`
- `src/modules/ui/channel-setup/steps/BuildReviewStepController.ts`
- `src/modules/ui/channel-setup/steps/LibraryStepController.ts`
- `src/modules/ui/channel-setup/steps/BuildProgressStepController.ts`
- `src/modules/ui/epg/EPGComponent.ts`
- `src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts`
- `src/modules/ui/channel-setup/focus/__tests__/ChannelSetupFocusCoordinator.test.ts`
- `src/modules/ui/epg/__tests__/EPGComponent.test.ts`
- `src/modules/ui/epg/__tests__/EPGInfoPanelCoordinator.test.ts`
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` (only after verification passes)

## Files Out Of Scope

- `src/modules/navigation/**`
- `src/modules/plex/**`
- `src/modules/scheduler/**` (except existing constants already consumed by in-scope files)
- `src/App.ts`
- `src/Orchestrator.ts`
- any `*.css` changes
- architecture docs beyond checklist completion update

If implementation requires out-of-scope changes, stop and revise this plan first.

## Locked Decisions And Invariants

1. `P4-W5` remains a cleanup pass; no new long-lived architecture seams are introduced.
2. `ChannelSetupSessionController` stays owner of async review/preview/build state.
3. `BuildReviewStepController` becomes pure render (no async kickoff side effects).
4. Review-load kickoff must stay on a post-render async boundary; Task 1 must not introduce synchronous re-entrant `_renderStep()` calls while Step 3 is rendering.
5. Channel Setup focus behavior and D-pad adjacency remain unchanged.
6. EPG info-panel presentation behavior remains unchanged while dead refs are removed.
7. No fallback/compatibility paths.

## Task Plan

### Task 0: Baseline And Safety Gate

**Files:**
- Modify: none

1. Run current targeted suites:
```bash
npm test -- --runTestsByPath src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts src/modules/ui/channel-setup/focus/__tests__/ChannelSetupFocusCoordinator.test.ts src/modules/ui/epg/__tests__/EPGComponent.test.ts src/modules/ui/epg/__tests__/EPGInfoPanelCoordinator.test.ts
```
Expected: PASS baseline before edits.

2. Record current verify baseline:
```bash
npm run verify
```
Expected: PASS (or explicitly record any pre-existing failure before proceeding).

### Task 1: Remove Channel Setup Transitional Review-Loading Glue

**Files:**
- Modify: `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
- Modify: `src/modules/ui/channel-setup/steps/BuildReviewStepController.ts`
- Modify: `src/modules/ui/channel-setup/steps/types.ts`
- Modify: `src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts`

1. Move "kick off review load when eligible" logic from `BuildReviewStepController.render(...)` into `ChannelSetupScreen` orchestration, but keep it on a deferred post-render boundary (microtask or equivalent) so `ensureReviewLoaded(() => this._renderStep())` cannot synchronously re-enter `_renderStep()` while the outer Step 3 render is still building DOM.
2. Simplify `BuildReviewDeps` by removing transitional side-effect deps that only existed for lazy-load kickoff (`getState`, `getVisibilityToken`, `loadReview` as render-time side effect trigger, and screen-level loading renderer callback).
3. Preserve the current stale-work guards around kickoff:
   - do not start a review request if the visibility token changed before the deferred kickoff runs
   - do not start a review request if Step 3 is no longer eligible (`isBuilding`, `review`, `isReviewLoading`, or `reviewError` already changed)
4. Keep loading UI copy/markup behavior unchanged (`Preparing your review...` path still visible while loading).
5. Update `ChannelSetupScreen` tests to lock:
   - review loading still appears before payload resolution
   - review fetch is not re-triggered on simple rerenders while pending
   - first-time fast-path still skips review load
   - hide/back-before-deferred-kickoff does not start a stale review request

### Task 2: Remove Placeholder View/Focus Bridges In Channel Setup

**Files:**
- Modify: `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
- Modify: `src/modules/ui/channel-setup/steps/types.ts`
- Modify: `src/modules/ui/channel-setup/steps/StrategyStepController.ts`
- Modify: `src/modules/ui/channel-setup/steps/LibraryStepController.ts`
- Modify: `src/modules/ui/channel-setup/steps/BuildReviewStepController.ts`
- Modify: `src/modules/ui/channel-setup/steps/BuildProgressStepController.ts`
- Modify: `src/modules/ui/channel-setup/focus/ChannelSetupFocusCoordinator.ts`
- Modify: `src/modules/ui/channel-setup/focus/__tests__/ChannelSetupFocusCoordinator.test.ts`

1. Remove pass-through wrappers in `ChannelSetupScreen` that only forward shared helper behavior:
   - remove `_renderCappedWarnings(...)` wrapper
   - remove `_unregisterFocusables()` wrapper and call focus coordinator directly
2. Simplify focus bridge usage:
   - replace mode-string bridge where possible with explicit linear/spatial callback surfaces in step deps
   - keep preferred-focus semantics unchanged
3. In `ChannelSetupFocusCoordinator.unregisterAll()`, use the same registry-sync cleanup path used by register methods (single bookkeeping path).
4. Keep existing callback contracts where required by bounded scope, but eliminate placeholder delegates that no longer add behavior.

### Task 3: Remove Dead EPG Host References

**Files:**
- Modify: `src/modules/ui/epg/EPGComponent.ts`
- Modify tests if needed:
  - `src/modules/ui/epg/__tests__/EPGComponent.test.ts`
  - `src/modules/ui/epg/__tests__/EPGInfoPanelCoordinator.test.ts`

1. Remove `EPGComponent` class fields that are only used as one-time bridge state for coordinator host wiring:
   - `infoPanelElement`
   - `classicShowcaseInfoElement`
   - `overlayShowcaseElement`
2. Replace those with local host refs resolved at attach time (behavior-preserving).
3. Keep `EPGInfoPanelCoordinator` host attachment/presentation behavior unchanged.

### Task 4: Verification And Checklist Completion

**Files:**
- Modify after verification: `ARCHITECTURE_CLEANUP_CHECKLIST.md`

1. Re-run targeted suites:
```bash
npm test -- --runTestsByPath src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts src/modules/ui/channel-setup/focus/__tests__/ChannelSetupFocusCoordinator.test.ts src/modules/ui/epg/__tests__/EPGComponent.test.ts src/modules/ui/epg/__tests__/EPGInfoPanelCoordinator.test.ts
```
Expected: PASS.

2. Run required UI verification gate:
```bash
npm run verify
```
Expected: PASS.

3. Mark `P4-W5` complete only after verification passes:
```md
- [x] P4-W5 - Cleanup pass for Priority 4: remove placeholder view glue, dead DOM refs, temporary focus bridges, and transitional UI conditionals introduced during the screen splits (done 2026-03-06; plan: docs/plans/2026-03-06-p4-w5-priority-4-cleanup-pass-implementation.md)
```

## Verification Commands

```bash
npm test -- --runTestsByPath src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts src/modules/ui/channel-setup/focus/__tests__/ChannelSetupFocusCoordinator.test.ts src/modules/ui/epg/__tests__/EPGComponent.test.ts src/modules/ui/epg/__tests__/EPGInfoPanelCoordinator.test.ts
npm run verify
```

Expected:

- Targeted suites: PASS.
- `npm run verify`: PASS.

## Rollback Notes

- If Channel Setup review flow regresses, revert Task 1 commit first to restore previous lazy-load path.
- If focus graph changes in Step 2 or build/review actions, revert Task 2 and re-validate with focus tests.
- If EPG layout/host behavior regresses, revert Task 3 and keep Channel Setup cleanup changes isolated.
- Do not mark checklist completion if verification fails.

## Commit Checkpoints

1. `refactor: move channel setup review load kickoff to screen orchestration`
2. `refactor: remove channel setup focus/render cleanup bridges`
3. `refactor: remove dead epg info-panel host refs`
4. `docs: mark p4-w5 complete`

## Planner Self-Check Result

1. Unresolved architecture seam? **No**. Ownership stays with existing extracted collaborators.
2. Hidden adjacent contract changes? **No**. Contract edits are explicitly in-scope (`steps/types.ts` + step controllers + screen).
3. Out-of-scope files required? **No**.
4. Full Codanna evidence + fallback documented? **Yes**.
5. Growing a hotspot? **No**. This pass removes glue and dead refs.
6. Fresh session must invent key decisions? **No**. Scope, files, commands, invariants, and rollback are explicit.
7. Execution-grade plan? **Yes**.
