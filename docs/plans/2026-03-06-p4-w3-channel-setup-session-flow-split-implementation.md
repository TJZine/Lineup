# P4-W3 Channel Setup Session Flow Split Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete `P4-W3` by extracting `ChannelSetupScreen` session state and async step-flow orchestration into one durable collaborator while preserving current Channel Setup UI, focus behavior, step transitions, preview/review/build behavior, and cleanup semantics.

**Architecture:** Keep `ChannelSetupScreen` as the exported screen class and keep its constructor call sites unchanged. Introduce exactly one new collaborator, `src/modules/ui/channel-setup/ChannelSetupSessionController.ts`, to own step/session state, config shaping, preview/review/build lifecycle, abort-controller management, timeout cleanup, and stale-result protection. `ChannelSetupScreen` remains responsible for DOM shell ownership, step rendering via the existing step controllers, focus registration, and the Step 2 D-pad key-handling layer.

**Tech Stack:** TypeScript, Jest with jsdom and fake timers, Lineup Channel Setup UI module, existing `ChannelSetupFocusCoordinator`, existing step controllers under `src/modules/ui/channel-setup/steps/`, existing `ChannelSetupCoordinator` orchestrator APIs.

---

## Freshness Gate

Run these commands before implementation:

```bash
git rev-parse --show-toplevel
rg -n "P4-W3" ARCHITECTURE_CLEANUP_CHECKLIST.md
rg -n "_resetState|_loadLibraries|_cleanupStep2AsyncState|_buildConfig|_schedulePreview|_refreshPreview|_loadReview|_startBuild" src/modules/ui/channel-setup/ChannelSetupScreen.ts
```

Expected:

- `git rev-parse --show-toplevel` prints the Lineup repo root.
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` still shows `P4-W3` as unchecked before implementation and points at `ChannelSetupScreen`.
- `ChannelSetupScreen.ts` still owns the listed session/flow methods.

If any of those expectations fail, stop and update this tracked plan first.

## Non-Goals

- Do not redesign Channel Setup UI.
- Do not change `ChannelSetupScreen` constructor call sites in `src/core/app-shell/AppLazyScreenRegistry.ts` or `src/App.ts`.
- Do not move DOM creation, button markup, copy, class names, or step-controller rendering into the new controller.
- Do not change `ChannelSetupFocusCoordinator`.
- Do not change `LibraryStepController`, `StrategyStepController`, `BuildReviewStepController`, or `BuildProgressStepController` except for mechanical type wiring if strictly required.
- Do not change `src/core/channel-setup/ChannelSetupCoordinator.ts` or planner logic.
- Do not add fallback or compatibility paths.

## Parent Priority Alignment

This plan advances Priority 4 by separating `ChannelSetupScreen` view/focus ownership from the remaining screen-owned session workflow. The current module already has focused render controllers and a focused focus coordinator, so the durable next step is to move step/session state and async orchestration behind one explicit owner instead of keeping preview/review/build lifecycle logic embedded in the screen.

## Required Reading

1. `agents.md`
2. `docs/agentic/document-map.md`
3. `docs/AGENTIC_DEV_WORKFLOW.md`
4. `docs/agentic/codanna-playbook.md`
5. `docs/agentic/plan-authoring-standard.md`
6. `docs/agentic/historical-plan-corpus-review.md`
7. `docs/architecture/CURRENT_STATE.md`
8. `ARCHITECTURE_CLEANUP_CHECKLIST.md`
9. `docs/design/ui-design-language.md`
10. `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
11. `src/modules/ui/channel-setup/focus/ChannelSetupFocusCoordinator.ts`
12. `src/modules/ui/channel-setup/steps/types.ts`
13. `src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts`

## Required Skills

- `@writing-plans`
- `@architecture-boundaries`
- `@ui-composition-patterns`

## Codanna Discovery

- `find_symbol` found `ChannelSetupScreen` at `src/modules/ui/channel-setup/ChannelSetupScreen.ts:151-1531` with 47 methods and existing dependencies on:
  - `ChannelSetupFocusCoordinator`
  - `LibraryStepController`
  - `StrategyStepController`
  - `BuildReviewStepController`
  - `BuildProgressStepController`
- `analyze_impact` on `ChannelSetupScreen` showed the external impact radius is limited to:
  - `src/core/app-shell/AppLazyScreenRegistry.ts`
  - `src/App.ts`
  - bootstrap references
- Direct file reads showed `ChannelSetupScreen` already delegates:
  - focus registration to `ChannelSetupFocusCoordinator`
  - per-step rendering to step controllers under `src/modules/ui/channel-setup/steps/`
- Direct file reads also showed `ChannelSetupScreen` still owns the remaining hotspot flow:
  - `_resetState()`
  - `_loadLibraries()`
  - `_cleanupStep2AsyncState()`
  - `_buildConfig()`
  - `_schedulePreview()`
  - `_refreshPreview()`
  - `_loadReview()`
  - `_startBuild()`
- Repo tests confirm the highest-risk behavior is flow/state behavior, not raw rendering:
  - delayed preview responses
  - review loading
  - build cancellation
  - first-time fast-path build flow
  - stale focus protection across rerenders

## Impact Snapshot

- `ChannelSetupScreen` currently mixes:
  - DOM shell ownership
  - step rendering delegation
  - focus and D-pad coordination
  - setup session state
  - preview/review/build async orchestration
  - abort/timeout cleanup
- The cleanest bounded extraction is a session/flow controller, because:
  - render controllers already exist
  - focus coordination already exists
  - the remaining cross-cutting complexity is stateful async flow
- External impact is narrow enough for one work unit: `ChannelSetupScreen` is lazily instantiated and only surfaced through app-shell screen wiring.

## External Reference Notes

- 2026-03-06, Context7 `/mdn/content`: `AbortController.abort()` aborts an asynchronous operation before it has completed. Preserve explicit abort-controller ownership for preview, review, and build requests; do not replace it with boolean-only flags.
- 2026-03-06, Context7 `/jestjs/jest`: `jest.useFakeTimers()` with `jest.advanceTimersByTime()` is the standard deterministic pattern for timeout-driven behavior. Use fake timers for preview debounce and delayed-preview race tests.

## Files In Scope

- Create: `src/modules/ui/channel-setup/ChannelSetupSessionController.ts`
- Create: `src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts`
- Modify: `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
- Modify: `src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts`
- Modify after all verification passes: `ARCHITECTURE_CLEANUP_CHECKLIST.md`

## Files Out Of Scope

- `src/modules/ui/channel-setup/focus/**`
- `src/modules/ui/channel-setup/steps/LibraryStepController.ts`
- `src/modules/ui/channel-setup/steps/StrategyStepController.ts`
- `src/modules/ui/channel-setup/steps/BuildReviewStepController.ts`
- `src/modules/ui/channel-setup/steps/BuildProgressStepController.ts`
- `src/modules/ui/channel-setup/styles.css`
- `src/core/channel-setup/**`
- `src/core/app-shell/AppLazyScreenRegistry.ts`
- `src/App.ts`
- `src/Orchestrator.ts`

## Locked Decisions

- The bounded concern for `P4-W3` is **session/step orchestration**, not focus and not visual rendering.
- Create exactly one new production file: `src/modules/ui/channel-setup/ChannelSetupSessionController.ts`.
- Create exactly one new test file: `src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts`.
- Keep `ChannelSetupScreen` exported from the same file and keep its constructor signature unchanged.
- The new controller owns:
  - selected libraries
  - strategy/build/session state
  - current step
  - preview/review/build async status
  - preview debounce timeout
  - preview delta timeout
  - abort controllers
  - stale-result/session token protection
  - setup record application
  - config shaping and preview-key generation
- `ChannelSetupScreen` keeps:
  - DOM shell element references
  - render dispatch to existing step controllers
  - focus registration
  - Step 2 D-pad `keyPress` handling
  - purely view-layer helpers such as `_renderBuildReviewLoading()`, `_renderCappedWarnings()`, and `_buildPreviewRow()` unless the implementation proves they are needed unchanged by the controller
- Do not introduce a second controller or split this into separate preview/review/build controllers during `P4-W3`.
- Do not export the new controller from `src/modules/ui/channel-setup/index.ts`; it is an internal hotspot collaborator.

## Preservation Contracts

- `show()` must still:
  - make the container visible
  - register the Step 2 key handler once per visible session
  - reset screen state for a fresh session
  - start library loading
- `hide()` must still:
  - abort in-flight build/preview/review work
  - clear preview debounce timers and preview delta timers
  - unregister key handlers
  - unregister focusables
  - hide the container
- First-time setup must still use the Step 2 fast path directly into build progress without loading review.
- Existing and unknown setup context must still route through review.
- Delayed preview responses must still be ignored after:
  - screen hide
  - session restart
  - fast-path transition into build
- Build cancellation must still surface as canceled, not as an error.
- Focus and D-pad behavior must remain unchanged because focus ownership stays in the screen and focus coordinator.

## Verification Commands

Baseline before edits:

```bash
npm test -- --runTestsByPath src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts
npm run verify
```

Expected baseline:

- `ChannelSetupScreen.test.ts` passes before edits.
- `npm run verify` currently reflects the workspace baseline. As observed on 2026-03-06, it failed in unrelated tool tests:
  - `src/__tests__/tools/syncAgentSkills.test.ts`
  - `src/__tests__/tools/verifyDocs.test.ts`

Targeted verification during implementation:

```bash
npm test -- --runTestsByPath src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts
npm test -- --runTestsByPath src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts
npm test -- --runTestsByPath src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts
```

Expected targeted result:

- all targeted tests pass

Completion gate:

```bash
npm run verify
```

Expected completion result:

- `npm run verify` passes before `P4-W3` is marked complete in the checklist. If unrelated baseline failures still exist, do not mark the checklist item complete until they are resolved or explicitly handled by the maintainer.

## Rollback Notes

- If the new controller tests pass but `ChannelSetupScreen` integration regresses focus or step transitions, revert the integration commit and keep the controller commit for diagnosis.
- If delayed preview, review loading, or build cancellation behavior changes, restore the old screen behavior before continuing. `P4-W3` is not allowed to trade runtime correctness for file-size reduction.
- If the work starts requiring step-controller or focus-coordinator redesign, stop and split the task instead of widening `P4-W3`.

## Commit Checkpoints

Suggested checkpoints for tracked work:

1. `test: add channel setup session controller coverage`
2. `refactor: extract channel setup session controller`
3. `docs: update p4-w3 checklist status`

If the work remains small and coherent, combining the first two checkpoints is acceptable, but do not mark `P4-W3` complete until the checklist update and full verification both land.

## Allowed File Changes

Only these files may change during implementation:

- `src/modules/ui/channel-setup/ChannelSetupSessionController.ts`
- `src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts`
- `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
- `src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts`
- `ARCHITECTURE_CLEANUP_CHECKLIST.md`

If any other file appears necessary, stop and update the plan first.

## Task 0: Baseline The Screen And Worktree

**Files:**
- Modify: none

**Step 1: Create the dedicated worktree and branch**

Run:

```bash
git worktree add ../Lineup-p4-w3-channel-setup-session-flow-split -b codex/p4-w3-channel-setup-session-flow-split
```

Expected: a new sibling worktree exists on branch `codex/p4-w3-channel-setup-session-flow-split`.

**Step 2: Move into the worktree**

Run:

```bash
cd ../Lineup-p4-w3-channel-setup-session-flow-split
```

Expected: all remaining commands run from the worktree root.

**Step 3: Confirm clean starting status**

Run:

```bash
git status --short --branch
```

Expected: output starts with `## codex/p4-w3-channel-setup-session-flow-split`.

**Step 4: Run the current screen test baseline**

Run:

```bash
npm test -- --runTestsByPath src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts
```

Expected: PASS before edits.

**Step 5: Record the repo-wide verify baseline**

Run:

```bash
npm run verify
```

Expected: record the actual result. If the same unrelated tool-test failures remain, keep them noted as baseline and do not claim `P4-W3` complete until they are resolved.

## Task 1: Define The New Session Controller API With Failing Tests

**Files:**
- Create: `src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts`

**Step 1: Add the new test file**

Create `src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts`.

**Step 2: Add red tests for the session controller responsibilities**

Add tests that prove the new controller owns:

- fresh-session reset state
- library-load success and failure state
- preview debounce plus stale-result suppression
- review load and review error state
- build cancel/error/success state
- `buildConfig` and preview-key generation

Use fake timers for preview scheduling tests.

**Step 3: Run the new test file**

Run:

```bash
npm test -- --runTestsByPath src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts
```

Expected: FAIL because `ChannelSetupSessionController` does not exist yet.

**Step 4: Commit the red test stage**

Run:

```bash
git add src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts
git commit -m "test: define channel setup session controller behavior"
```

Expected: one commit containing only the new failing controller tests.

## Task 2: Implement ChannelSetupSessionController

**Files:**
- Create: `src/modules/ui/channel-setup/ChannelSetupSessionController.ts`

**Step 1: Create the controller with internal session state**

Implement `ChannelSetupSessionController` with:

- session snapshot state
- `beginSession()` / `endSession()`-style lifecycle
- async ownership for libraries, preview, review, and build
- config shaping and preview-key generation
- explicit cleanup of abort controllers and timeouts

**Step 2: Keep the controller DOM-free**

The controller may depend on orchestrator methods and pure callback hooks only. It must not:

- read or write DOM
- import focus code
- import CSS
- register navigation handlers

**Step 3: Make preview scheduling deterministic**

Keep the current debounce semantics and stale-result suppression. Use explicit timer cleanup and session-token checks rather than hidden promise races.

**Step 4: Run controller tests**

Run:

```bash
npm test -- --runTestsByPath src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts
```

Expected: PASS.

**Step 5: Commit the controller**

Run:

```bash
git add src/modules/ui/channel-setup/ChannelSetupSessionController.ts src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts
git commit -m "refactor: extract channel setup session flow controller"
```

Expected: one clean commit containing only the new controller and its tests.

## Task 3: Rewire ChannelSetupScreen To The Session Controller

**Files:**
- Modify: `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
- Modify: `src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts`

**Step 1: Replace screen-owned session fields with the controller**

Remove the screen-owned state fields that move into the controller, including:

- `_libraries`
- `_selectedLibraryIds`
- `_strategies`
- `_strategyOrder`
- `_channelExpansion`
- `_seriesOrdering`
- `_buildMode`
- `_actorStudioCombineMode`
- `_maxChannels`
- `_minItems`
- `_buildAbortController`
- `_previewAbortController`
- `_reviewAbortController`
- `_previewTimeoutId`
- `_step`
- `_isLoading`
- `_isBuilding`
- `_isPreviewLoading`
- `_isReviewLoading`
- `_replaceConfirm`
- `_preview`
- `_previewError`
- `_review`
- `_reviewError`
- `_lastPreviewKey`
- `_pendingPreviewKey`
- `_previewDeltas`
- `_previewDeltaTimeoutId`
- `_previewDeltaExpiresAtMs`
- `_recordApplied`
- `_setupContext`

Keep only screen-owned DOM/focus/render/navigation state.

**Step 2: Route screen callbacks through the controller**

Replace direct mutations in render callbacks with controller methods. The screen should ask the controller for current snapshot data, then render from that snapshot.

**Step 3: Preserve Step 2 key-handling behavior in the screen**

Do not move the `keyPress` handler into the controller. It is a UI/focus concern and must stay in `ChannelSetupScreen`.

**Step 4: Update or add integration tests**

Keep existing `ChannelSetupScreen.test.ts` behavior coverage passing, and add only the integration assertions needed to prove the screen now uses the controller rather than local session state.

**Step 5: Run the screen tests**

Run:

```bash
npm test -- --runTestsByPath src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts
npm test -- --runTestsByPath src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts
```

Expected: PASS.

**Step 6: Commit the screen integration**

Run:

```bash
git add src/modules/ui/channel-setup/ChannelSetupScreen.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts
git commit -m "refactor: route channel setup screen through session controller"
```

Expected: one clean integration commit.

## Task 4: Final Verification And Checklist Update

**Files:**
- Modify: `ARCHITECTURE_CLEANUP_CHECKLIST.md`

**Step 1: Run final targeted verification**

Run:

```bash
npm test -- --runTestsByPath src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts
```

Expected: PASS.

**Step 2: Run full verify**

Run:

```bash
npm run verify
```

Expected: PASS before checklist update.

**Step 3: Mark the checklist item complete**

Update this line in `ARCHITECTURE_CLEANUP_CHECKLIST.md`:

```md
- [ ] P4-W3 - Split one bounded concern out of `ChannelSetupScreen` (recommended: step orchestration vs view rendering)
```

to:

```md
- [x] P4-W3 - Split one bounded concern out of `ChannelSetupScreen` (recommended: step orchestration vs view rendering) (done 2026-03-06; plan: docs/plans/2026-03-06-p4-w3-channel-setup-session-flow-split-implementation.md)
```

**Step 4: Commit closeout**

Run:

```bash
git add ARCHITECTURE_CLEANUP_CHECKLIST.md
git commit -m "docs: mark p4-w3 complete"
```

Expected: checklist updated only after all verification passes.

## Success Criteria

- `ChannelSetupSessionController` exists and is the only new production collaborator.
- `ChannelSetupScreen` no longer owns the extracted session/flow lifecycle state.
- All targeted channel-setup tests pass.
- `npm run verify` passes before checklist closeout.
- `P4-W3` is marked complete in the cleanup checklist with the tracked plan path.
