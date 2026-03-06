# P4-W4 UI Focus/Render Primitive Consolidation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete `P4-W4` by consolidating repeated focus-registration and warning-render helper logic into reusable UI primitives without changing TV navigation, focus order, or visual behavior.

**Architecture:** Introduce two narrowly-scoped helpers under `src/modules/ui/common/`: one render-only helper for capped warning rows, and one registry helper that only synchronizes focusable registration bookkeeping. Keep focus-resolution policy owned by each caller: `SettingsScreen` must preserve its current-focus/stale-category guards, while `ChannelSetupFocusCoordinator` keeps its existing preferred-or-first semantics and boolean return contract. Avoid expanding the scope to unrelated UI modules in this unit.

**Tech Stack:** TypeScript, Jest, existing NavigationManager/FocusableElement contracts, Lineup UI common module (`src/modules/ui/common/`).

---

## Goal

- Finish checklist item `P4-W4 - Consolidate repeated focus/render helpers into reusable UI primitives only after the first three extractions are stable`.
- Land one bounded refactor that is reusable, test-backed, and behavior-preserving.

## Non-Goals

- No EPG navigation extraction work (already addressed in `P4-W2`).
- No new UI/visual redesign.
- No changes to `NavigationManager` or `FocusManager` contracts.
- No migration of every screen to the new helpers in this work unit.
- No fallback/compatibility branches.

## Parent Priority Alignment

This plan advances **Priority 4 (Decompose The Largest UI Classes)** by turning repeated focus/render helper code into shared primitives, so post-extraction screens do not re-accumulate boilerplate focus wiring and render utility logic.

## Required Reading

1. `agents.md`
2. `docs/agentic/document-map.md`
3. `docs/AGENTIC_DEV_WORKFLOW.md`
4. `docs/agentic/codanna-playbook.md`
5. `docs/agentic/plan-authoring-standard.md`
6. `docs/architecture/CURRENT_STATE.md`
7. `ARCHITECTURE_CLEANUP_CHECKLIST.md` (Priority 4 + `P4-W4`)
8. `docs/design/ui-design-language.md`
9. `docs/plans/2026-03-06-p4-w2-epg-info-panel-orchestration-split-implementation.md`
10. `docs/plans/2026-03-06-p4-w3-channel-setup-session-flow-split-implementation.md`

## Freshness Gate

- Before coding, re-read `docs/architecture/CURRENT_STATE.md`, `ARCHITECTURE_CLEANUP_CHECKLIST.md`, and the current implementations/tests listed below.
- If `SettingsScreen`, `ChannelSetupFocusCoordinator`, `ChannelSetupScreen`, or the Step 2 contract tests changed materially since this plan was authored, update this plan before implementation.
- Do not treat "the helper boundary is obvious" as sufficient; if the focus helper would need to own caller-specific focus resolution, stop and narrow the seam again before proceeding.

## Required Skills

1. `using-superpowers`
2. `brainstorming`
3. `ui-composition-patterns`
4. `architecture-boundaries`
5. `verification-before-completion`

## Codanna Discovery

- `semantic_search_with_context`:
  - Query: `SettingsScreen _registerFocusables ChannelSetupFocusCoordinator registerLinear registerStep2 duplicated preferred focus selection`
  - Strong hit: `SettingsScreen._registerFocusables` (`symbol_id:6140`, score `0.512`) with direct call chain in `show`, `_setActiveCategory`, `_renderActiveCategory`, and subtitle-dependent rerender paths.
- `search_documents`:
  - Query on `P4-W4` and reusable focus/render helpers was insufficient for code-level boundaries, so repo-doc context came from direct tracked-doc reads (`docs/AGENTIC_DEV_WORKFLOW.md`, `docs/architecture/CURRENT_STATE.md`, `ARCHITECTURE_CLEANUP_CHECKLIST.md`, `docs/agentic/plan-authoring-standard.md`).
- `analyze_impact`:
  - `symbol_id:6140` (`SettingsScreen._registerFocusables`) affects 8 settings-flow symbols, including category swaps, screen show, and detail rerenders.
  - `symbol_id:4772` (`ChannelSetupFocusCoordinator`) affects `ChannelSetupScreen` plus the app lazy screen registry path.
  - `symbol_id:5329` (`ChannelSetupScreen._renderCappedWarnings`) affects 4 channel-setup render methods (`_renderStep`, `_renderStrategyStep`, `_renderBuildReview`, `_renderBuildStep`).
- Fallback reads (explicit, due Codanna noise for duplication discovery):
  - `rg` over `src/modules/ui/**` for `preferredFocusId`, `registerFocusable`, `unregisterFocusable`, `renderCappedWarnings`.
  - Direct reads:
    - `src/modules/ui/settings/SettingsScreen.ts` (`_registerFocusables`, `_unregisterFocusables`, current-focus suppression during category swaps)
    - `src/modules/ui/channel-setup/focus/ChannelSetupFocusCoordinator.ts`
    - `src/modules/ui/channel-setup/ChannelSetupScreen.ts` (`_renderCappedWarnings`, `_registerFocusables`)
    - `src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.contracts.test.ts`
    - `src/modules/ui/common/ScreenShell.ts`, `src/modules/ui/common/OverlayPrimitives.ts`
  - `rg` also confirmed similar register/unregister duplication still exists in `audio-setup`, `playback-options`, and `profile-select`; this plan freezes those callers out-of-scope rather than pretending they do not exist.

## Impact Snapshot

- High-risk behavior surfaces:
  - Settings category/detail focus transitions and right/left navigation edges.
  - Settings current-focus preservation rules during rerenders, including the stale-category suppression path.
  - Channel setup Step 2 category/detail/footer focus routing.
  - Preferred-focus restoration semantics after rerenders.
  - Channel setup preview/review warning rendering used from multiple Step 2 render paths.
- Chosen seam:
  - The common focus primitive only unregisters previous IDs, registers the next focusable entries, and returns the new ID list.
  - `SettingsScreen` keeps its local focus-target resolution (`preferred -> usable current focus -> active category -> first`) and category-mismatch guard.
  - `ChannelSetupFocusCoordinator` keeps `_setPreferredOrFirst` local so `registerLinear`/`registerSpatial`/`registerStep2` preserve their current boolean contract.
- Shared symbol risk:
  - Any primitive signature drift can affect both settings and channel-setup focus lifecycles.
- Guardrail:
  - Keep helper APIs minimal and behaviorally equivalent to current local implementations; do not centralize caller-specific focus policy in `src/modules/ui/common/`.

## Files In Scope

- Create: `src/modules/ui/common/focus/syncFocusableRegistry.ts`
- Create: `src/modules/ui/common/render/renderCappedWarnings.ts`
- Modify: `src/modules/ui/settings/SettingsScreen.ts`
- Modify: `src/modules/ui/channel-setup/focus/ChannelSetupFocusCoordinator.ts`
- Modify: `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
- Modify tests:
  - `src/modules/ui/settings/__tests__/SettingsScreen.test.ts`
  - `src/modules/ui/channel-setup/focus/__tests__/ChannelSetupFocusCoordinator.test.ts`
  - `src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts`
  - `src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.contracts.test.ts`
  - Add focused helper tests:
    - `src/modules/ui/common/__tests__/syncFocusableRegistry.test.ts`
    - `src/modules/ui/common/__tests__/renderCappedWarnings.test.ts`

## Files Out Of Scope

- `src/modules/ui/epg/EPGComponent.ts`
- `src/modules/navigation/**`
- `src/modules/ui/playback-options/**`
- `src/modules/ui/audio-setup/**`
- `src/modules/ui/profile-select/**`
- `src/modules/ui/server-select/**`
- `src/App.ts`, `src/Orchestrator.ts`
- Any CSS/style redesign work

## Invariants / Preservation Contracts

- Preserve D-pad focus order and neighbor semantics for current settings and channel-setup flows.
- Preserve focus restore behavior when category/detail rerenders occur.
- Preserve warning text content and capping behavior (`And N more warning(s)…`) in channel setup.
- Preserve existing DOM class names and action IDs used by tests and runtime focus hooks.
- Hidden UI must still unregister focusables and release focus ownership exactly as before.

## Anti-Slop Constraints

- No compatibility shims or dual-path helper usage once migration is complete in-scope files.
- No unrelated extraction into additional screens.
- No helper that requires call sites to pass UI-domain data outside current boundaries.

## Task Plan

### Task 1: Lock Baseline Behavior With Focused Tests

**Files:**
- Modify: `src/modules/ui/settings/__tests__/SettingsScreen.test.ts`
- Modify: `src/modules/ui/channel-setup/focus/__tests__/ChannelSetupFocusCoordinator.test.ts`
- Modify: `src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts`
- Modify: `src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.contracts.test.ts`

**Step 1:** Add/confirm settings regressions around focus retention and stale-category suppression.

```ts
expect(nav.setFocus).toHaveBeenCalledWith('settings-subtitle-mode');
expect(nav.setFocus).not.toHaveBeenCalledWith('settings-category-appearance');
```

**Step 2:** Add/confirm channel-setup focus-order and Step 2 transfer assertions, including contract-level ID coverage.

```ts
expect(nav.focusables.get('setup-category-priority-order')?.neighbors.down).toBe('setup-strategy-collections');
expect(nav.setFocus).toHaveBeenLastCalledWith('setup-strategy-collections');
expect(container.querySelector('#setup-preview-panel')).not.toBeNull();
```

**Step 3:** Add/confirm warning-capping assertions for exact wording, class output, and singular/plural remainder handling.

```ts
expect(container.textContent).toContain('And 2 more warnings…');
expect(container.textContent).toContain('And 1 more warning…');
```

**Step 4:** Run targeted tests.

Run:
```bash
npm test -- src/modules/ui/settings/__tests__/SettingsScreen.test.ts src/modules/ui/channel-setup/focus/__tests__/ChannelSetupFocusCoordinator.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.contracts.test.ts
```

Expected: PASS; baseline confirms no existing regressions before refactor.

**Step 5:** Commit checkpoint.

```bash
git add src/modules/ui/settings/__tests__/SettingsScreen.test.ts src/modules/ui/channel-setup/focus/__tests__/ChannelSetupFocusCoordinator.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.contracts.test.ts
git commit -m "test: lock p4-w4 focus and warning baseline"
```

### Task 2: Add Shared Focus Registration Primitive

**Files:**
- Create: `src/modules/ui/common/focus/syncFocusableRegistry.ts`
- Add tests: `src/modules/ui/common/__tests__/syncFocusableRegistry.test.ts`

**Step 1:** Implement a reusable helper for unregistering previous IDs, registering the next entries, and returning the new ID list only.

```ts
export function syncFocusableRegistry(
  nav: Pick<INavigationManager, 'registerFocusable' | 'unregisterFocusable'>,
  prevIds: string[],
  entries: FocusableElement[],
): string[] {
  for (const id of prevIds) nav.unregisterFocusable(id);
  for (const entry of entries) nav.registerFocusable(entry);
  return entries.map((entry) => entry.id);
}
```

**Step 2:** Unit-test helper behavior for unregister ordering, registration passthrough, returned ID order, and empty-list handling.

**Step 3:** Run targeted helper tests.

Run:
```bash
npm test -- src/modules/ui/common/__tests__/syncFocusableRegistry.test.ts
```

Expected: PASS.

**Step 4:** Commit checkpoint.

```bash
git add src/modules/ui/common/focus/syncFocusableRegistry.ts src/modules/ui/common/__tests__/syncFocusableRegistry.test.ts
git commit -m "refactor: add shared focus registry helper"
```

### Task 3: Migrate ChannelSetup Focus Coordinator To Shared Primitive

**Files:**
- Modify: `src/modules/ui/channel-setup/focus/ChannelSetupFocusCoordinator.ts`
- Modify: `src/modules/ui/channel-setup/focus/__tests__/ChannelSetupFocusCoordinator.test.ts`

**Step 1:** Replace only the unregister/register bookkeeping with the shared helper.

**Step 2:** Keep `scrollToNearest`, Step 2-specific neighbor wiring, and `_setPreferredOrFirst` local to the coordinator so the public boolean return behavior does not change.

**Step 3:** Re-run the focused coordinator test plus the screen-level Step 2 safety net, because the refactor changes live registration behavior used by `ChannelSetupScreen`.

Run:
```bash
npm test -- src/modules/ui/channel-setup/focus/__tests__/ChannelSetupFocusCoordinator.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.contracts.test.ts
```

Expected: PASS with unchanged neighbor/focus behavior, Step 2 transfer behavior, and contract-level DOM/focus parity.

**Step 4:** Commit checkpoint.

```bash
git add src/modules/ui/channel-setup/focus/ChannelSetupFocusCoordinator.ts src/modules/ui/channel-setup/focus/__tests__/ChannelSetupFocusCoordinator.test.ts
git commit -m "refactor: route channel setup focus registration through shared helper"
```

### Task 4: Migrate Settings Focus Registration To Shared Primitive

**Files:**
- Modify: `src/modules/ui/settings/SettingsScreen.ts`
- Modify: `src/modules/ui/settings/__tests__/SettingsScreen.test.ts`

**Step 1:** Keep category/detail/switch-profile neighbor construction inside `SettingsScreen`.

**Step 2:** Replace only manual register/unregister bookkeeping with the common helper. Preserve `SettingsScreen`'s local focus-target resolution, including usable-current-focus fallback and the stale-category suppression guard.

**Step 3:** Re-run settings tests.

Run:
```bash
npm test -- src/modules/ui/settings/__tests__/SettingsScreen.test.ts
```

Expected: PASS with no behavior changes in category switching or detail focus.

**Step 4:** Commit checkpoint.

```bash
git add src/modules/ui/settings/SettingsScreen.ts src/modules/ui/settings/__tests__/SettingsScreen.test.ts
git commit -m "refactor: reuse shared focus helper in settings screen"
```

### Task 5: Add Shared Render Helper For Capped Warning Lists

**Files:**
- Create: `src/modules/ui/common/render/renderCappedWarnings.ts`
- Modify: `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
- Modify: `src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts`
- Modify: `src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.contracts.test.ts` (only if parity assertions need to expand)
- Add tests: `src/modules/ui/common/__tests__/renderCappedWarnings.test.ts`

**Step 1:** Move warning-list row generation to a shared helper with explicit `maxItems` and `itemClassName` options.

```ts
renderCappedWarnings({
  warnings,
  container,
  maxItems: this._maxPreviewWarnings,
  itemClassName: 'setup-preview-warning',
});
```

**Step 2:** Keep channel-setup-specific wording and style class output unchanged.

**Step 3:** Keep `ChannelSetupScreen._renderCappedWarnings` as a thin wrapper if that avoids widening `steps/types.ts` or the step-controller callback surface.

**Step 4:** Run targeted render-helper and channel-setup tests.

Run:
```bash
npm test -- src/modules/ui/common/__tests__/renderCappedWarnings.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.contracts.test.ts
```

Expected: PASS.

**Step 5:** Commit checkpoint.

```bash
git add src/modules/ui/common/render/renderCappedWarnings.ts src/modules/ui/common/__tests__/renderCappedWarnings.test.ts src/modules/ui/channel-setup/ChannelSetupScreen.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.contracts.test.ts
git commit -m "refactor: extract shared capped-warning render helper"
```

### Task 6: Full Verification + Checklist/Doc Updates

**Files:**
- Modify: `ARCHITECTURE_CLEANUP_CHECKLIST.md`
- Optional docs touch only if ownership wording changed: `docs/architecture/modules.md`

**Step 1:** Run full verification for UI refactor.

Run:
```bash
npm run verify
```

Expected: PASS.

**Step 2:** Mark checklist item complete with tracked plan note.

Add:
```md
- [x] P4-W4 - Consolidate repeated focus/render helpers into reusable UI primitives only after the first three extractions are stable (done YYYY-MM-DD; plan: docs/plans/2026-03-06-p4-w4-ui-focus-render-primitives-consolidation-implementation.md)
```

**Step 3:** Final commit checkpoint.

```bash
git add ARCHITECTURE_CLEANUP_CHECKLIST.md docs/architecture/modules.md
git commit -m "docs: close p4-w4 after shared ui helper consolidation"
```

## Verification Commands

1. `npm test -- src/modules/ui/settings/__tests__/SettingsScreen.test.ts src/modules/ui/channel-setup/focus/__tests__/ChannelSetupFocusCoordinator.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts`
   - Expected: PASS.
2. `npm test -- src/modules/ui/settings/__tests__/SettingsScreen.test.ts src/modules/ui/channel-setup/focus/__tests__/ChannelSetupFocusCoordinator.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.contracts.test.ts`
   - Expected: PASS.
3. `npm test -- src/modules/ui/common/__tests__/syncFocusableRegistry.test.ts src/modules/ui/common/__tests__/renderCappedWarnings.test.ts`
   - Expected: PASS.
4. `npm run verify`
   - Expected: PASS.

## Commit Checkpoints

1. `test: lock p4-w4 focus and warning baseline`
   - `git add src/modules/ui/settings/__tests__/SettingsScreen.test.ts src/modules/ui/channel-setup/focus/__tests__/ChannelSetupFocusCoordinator.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.contracts.test.ts`
2. `refactor: add shared focus registry helper`
   - `git add src/modules/ui/common/focus/syncFocusableRegistry.ts src/modules/ui/common/__tests__/syncFocusableRegistry.test.ts`
3. `refactor: route channel setup focus registration through shared helper`
   - `git add src/modules/ui/channel-setup/focus/ChannelSetupFocusCoordinator.ts src/modules/ui/channel-setup/focus/__tests__/ChannelSetupFocusCoordinator.test.ts`
4. `refactor: reuse shared focus helper in settings screen`
   - `git add src/modules/ui/settings/SettingsScreen.ts src/modules/ui/settings/__tests__/SettingsScreen.test.ts`
5. `refactor: extract shared capped-warning render helper`
   - `git add src/modules/ui/common/render/renderCappedWarnings.ts src/modules/ui/common/__tests__/renderCappedWarnings.test.ts src/modules/ui/channel-setup/ChannelSetupScreen.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.contracts.test.ts`
6. `docs: close p4-w4 after shared ui helper consolidation`
   - `git add ARCHITECTURE_CLEANUP_CHECKLIST.md docs/architecture/modules.md`

## Rollback Notes

- If Task 2 must be reverted, first revert Task 3 and Task 4 so no caller depends on a removed shared helper.
- Revert Task 3 immediately if Channel Setup Step 2 focus order, category-to-detail transfer, or boolean preferred-focus return behavior regresses.
- Revert Task 4 immediately if settings rerenders stop preserving usable current focus or begin snapping back to a stale category button.
- Revert Task 5 if preview/review warning text, ellipsis wording, class names, or append order changes unexpectedly.
- If the shared focus helper starts accreting caller-specific focus policy, revert Task 2 and keep the duplication local until a narrower primitive is proven.

## Risks / Unknowns Requiring Review

- `registerFocusable` patterns are duplicated outside this work unit (audio setup, playback options, profile select). This plan intentionally freezes them out-of-scope; ensure reviewers enforce this scope boundary.
- Channel setup Step 2 has dense focus wiring; stale-focus regressions are possible if helper call order changes.
- `ChannelSetupScreen.contracts.test.ts` is part of the safety net for DOM/focus parity even if no production code in that file changes; do not skip it as "just an extra test file."
- Existing Codanna index output includes some duplicate/stale path entries; rely on direct test-backed validation before merge.

## Planner Self-Check Result

1. Unresolved seam? **No.** The seam is explicit: the shared focus helper handles registry bookkeeping only; each caller retains its own focus-target policy.
2. Adjacent contract changes needed out-of-scope? **No.** Navigation contracts remain unchanged.
3. Any out-of-scope file implicitly required? **No.** Non-P4 screens stay frozen, and `ChannelSetupScreen.contracts.test.ts` is now explicitly part of the verification surface.
4. Full Codanna evidence path + fallback documented? **Yes.** Included above.
5. Growing a hotspot? **No.** This reduces duplicate helper mechanics in two Priority 4 hotspot areas.
6. Fresh session must invent critical decisions? **No.** The helper boundaries, freshness gate, files, and verification surface are explicit.
7. Execution-grade vs design-grade? **Execution-grade.**
