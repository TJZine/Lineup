# P4-W3 Channel Setup Session Flow Split Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete `P4-W3` by extracting `ChannelSetupScreen` session state and async step-flow orchestration into one durable collaborator while preserving the current Channel Setup UI, focus behavior, step transitions, preview/review/build behavior, and cleanup semantics.

**Architecture:** Keep `ChannelSetupScreen` as the exported screen class and keep its constructor call sites unchanged. Introduce one new internal collaborator, `ChannelSetupSessionController`, as the single owner of channel-setup session state, config shaping, preview/review/build orchestration, abort/timer cleanup, and stale-result protection. Keep `ChannelSetupScreen` as the only owner of DOM, step-controller rendering, focus registration, D-pad handling, and screen-local view state.

**Tech Stack:** TypeScript, Jest with jsdom and fake timers, existing channel-setup step controllers, `ChannelSetupFocusCoordinator`, `ServerSelectionStore`, `AppOrchestrator`-derived channel setup APIs.

---

## Freshness Gate

Run these checks before implementation:

```bash
git rev-parse --show-toplevel
rg -n "P4-W3" ARCHITECTURE_CLEANUP_CHECKLIST.md
rg -n "export type ChannelSetupOrchestrator|type SetupStep|createDefaultStrategyState|createDefaultStrategyOrder|defaultChannelExpansionState|_resetState|_loadLibraries|_cleanupStep2AsyncState|_buildConfig|_schedulePreview|_refreshPreview|_loadReview|_startBuild" src/modules/ui/channel-setup/ChannelSetupScreen.ts
rg -n "startBuild|loadReview|applySettingChange|schedulePreview" src/modules/ui/channel-setup/steps/*.ts
```

Expected:

- `git rev-parse --show-toplevel` prints the Lineup repo root.
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` still shows `P4-W3` as unchecked.
- `ChannelSetupScreen.ts` still contains the shared session types/default helpers plus the session-flow methods listed above.
- Step-controller files still expose the current callback-based seams:
  - `StrategyStepController` still uses `applySettingChange(...)` and `schedulePreview()`
  - `BuildReviewStepController` still uses `loadReview()`
  - `BuildProgressStepController` still uses `startBuild(...)`

If any expectation fails, stop and refresh this tracked plan before editing code.

## Non-Goals

- Do not redesign Channel Setup UI.
- Do not change `ChannelSetupScreen` constructor call sites in `src/core/app-shell/AppLazyScreenRegistry.ts` or `src/App.ts`.
- Do not change `ChannelSetupFocusCoordinator`.
- Do not change DOM structure, button copy, class names, IDs, ARIA behavior, preview-strip layout, or step ordering.
- Do not change `LibraryStepController`, `StrategyStepController`, `BuildReviewStepController`, `BuildProgressStepController`, or `src/modules/ui/channel-setup/steps/types.ts`.
- Do not change `src/core/channel-setup/**` or planner logic.
- Do not add fallback paths, compatibility shims, duplicate types, or temporary adapters that the next cleanup unit must remove.

## Parent Priority Alignment

This plan advances Priority 4 by separating `ChannelSetupScreen` view/focus ownership from the remaining screen-owned session workflow. The desired end state is:

- `ChannelSetupScreen` owns DOM, focus, D-pad, and screen-level rendering coordination.
- `ChannelSetupSessionController` owns session state and async workflow policy.
- Existing step controllers remain presentational renderers driven by screen-provided snapshots and callbacks.

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
11. `src/modules/ui/channel-setup/steps/StrategyStepController.ts`
12. `src/modules/ui/channel-setup/steps/BuildReviewStepController.ts`
13. `src/modules/ui/channel-setup/steps/BuildProgressStepController.ts`
14. `src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts`
15. `src/modules/ui/channel-setup/__tests__/channel-setup-test-helpers.ts`

## Required Skills

- `@brainstorming`
- `@architecture-boundaries`
- `@ui-composition-patterns`
- `@test-driven-development`

Planning note: this tracked plan already satisfied `@writing-plans`. Do not re-run `@writing-plans` during implementation unless you are revising the plan itself.

## Codanna Discovery

- `find_symbol` found `ChannelSetupScreen` at `src/modules/ui/channel-setup/ChannelSetupScreen.ts:151-1531` with 47 methods and 2 external usages.
- `analyze_impact` for `ChannelSetupScreen` showed the external impact radius is narrow:
  - `src/core/app-shell/AppLazyScreenRegistry.ts`
  - `src/App.ts`
  - bootstrap wiring
- `find_callers` returned no direct callers because screen usage is dynamic through app-shell wiring, which matches the `analyze_impact` result.
- `semantic_search_with_context` for this hotspot was too noisy in this repo snapshot and did not produce useful ownership guidance for the extraction. Do not cite it as the basis for the plan shape.
- `search_documents` for `ChannelSetupScreen` and `P4-W3` returned unrelated user-guide hits in this repo snapshot. Fallback used: direct tracked-doc reads of `agents.md`, workflow docs, checklist, and current-state docs.
- Direct code reads confirmed the current split:
  - `ChannelSetupScreen` already delegates focus registration to `ChannelSetupFocusCoordinator`
  - `ChannelSetupScreen` already delegates per-step DOM assembly to the four step controllers
  - `ChannelSetupScreen` still owns all session state, preview/review/build orchestration, abort cleanup, and preview-delta timers
- Direct test reads confirmed the current high-risk behavior is workflow/state behavior plus remote/focus preservation, not raw DOM creation.

## Impact Snapshot

- External/public impact is narrow, but internal impact is not limited to the screen file.
- The true implementation seam is:
  - `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
  - `src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts`
  - one new controller file
  - one new controller test file
- The step-controller files are part of the behavioral context but are intentionally not being changed. The screen must adapt controller state back into the existing step-controller contracts.
- The top of `ChannelSetupScreen.ts` currently defines shared session types and default-state helpers. The new controller file must become the authoritative home for those definitions so the extraction does not create type duplication or a type-only back-import from the controller into the screen.

## External Reference Notes

- 2026-03-06, MDN `/mdn/content`: `AbortController.abort()` aborts async operations and causes `fetch`-style consumers using the signal to reject with `AbortError`. Preserve explicit abort-controller ownership for preview, review, and build requests.
- 2026-03-06, Jest `/jestjs/jest`: `jest.useFakeTimers()` plus `jest.advanceTimersByTime()` is the recommended deterministic pattern for timeout-driven behavior. Use fake timers for preview debounce and preview-delta expiry tests.

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
- `src/modules/ui/channel-setup/steps/types.ts`
- `src/modules/ui/channel-setup/styles.css`
- `src/modules/ui/channel-setup/__tests__/channel-setup-test-helpers.ts`
- `src/core/channel-setup/**`
- `src/core/app-shell/AppLazyScreenRegistry.ts`
- `src/App.ts`
- `src/Orchestrator.ts`

If any file outside the in-scope list appears necessary, stop and refresh this plan before continuing.

## Locked Decisions

### Ownership Split

- `ChannelSetupSessionController` is the only new production collaborator for `P4-W3`.
- `ChannelSetupSessionController.ts` becomes the single home for session-domain definitions currently embedded in `ChannelSetupScreen.ts`, including:
  - `ChannelSetupOrchestrator`
  - `SetupStrategyState`
  - `ChannelExpansionState`
  - `SetupStep`
  - `EstimateKey`
  - `createDefaultStrategyState()`
  - `createDefaultStrategyOrder()`
  - `defaultChannelExpansionState()`
  - `clampSeriesBlockPreset()`
  - any other default-session helpers needed by the controller
- `ChannelSetupScreen.ts` must import those definitions from `ChannelSetupSessionController.ts`.
- `ChannelSetupScreen.ts` must re-export `ChannelSetupOrchestrator` from the controller file so `channel-setup-test-helpers.ts` stays unchanged.

### Screen-Owned State That Must Stay In `ChannelSetupScreen`

- DOM refs and screen shell ownership
- `ServerSelectionStore`
- `_preferredFocusId`
- `_visibilityToken`
- `_navKeyHandler`
- `_activeStrategyCategory`
- `_rememberedDetailFocusByCategory`
- `_lastReorder`
- `_grabbedPriorityKey`
- `_previewPanelId`
- `_maxPreviewWarnings`
- preset option arrays such as `_channelLimitOptions` and `_minItemsOptions`
- Step 2 D-pad `keyPress` handling
- focus registration and unregistering
- DOM-only rendering helpers such as `_renderBuildReviewLoading()`, `_renderCappedWarnings()`, and `_buildPreviewRow()`

### Session State That Must Move Into `ChannelSetupSessionController`

- `_step`
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
- session-token / stale-result protection for async work

### Public Controller API To Implement

Implement this exact shape unless freshness checks prove the repo changed first:

```ts
export type ChannelSetupSessionSnapshot = {
  step: SetupStep;
  libraries: PlexLibraryType[];
  selectedLibraryIds: Set<string>;
  strategies: SetupStrategyState;
  strategyOrder: SetupStrategyKey[];
  channelExpansion: ChannelExpansionState;
  seriesOrdering: SeriesOrderingState;
  buildMode: ChannelSetupConfig['buildMode'];
  actorStudioCombineMode: ChannelSetupConfig['actorStudioCombineMode'];
  maxChannels: number;
  minItems: number;
  isLoading: boolean;
  isBuilding: boolean;
  isPreviewLoading: boolean;
  isReviewLoading: boolean;
  replaceConfirm: boolean;
  preview: ChannelSetupPreview | null;
  previewError: string | null;
  review: ChannelSetupReview | null;
  reviewError: string | null;
  previewDeltas: Partial<Record<EstimateKey, number>>;
  previewDeltaExpiresAtMs: number;
  recordApplied: boolean;
  setupContext: ChannelSetupContext;
};

export type ChannelSetupBuildOutcome =
  | { kind: 'missing-server' }
  | { kind: 'canceled' }
  | { kind: 'error'; message: string }
  | {
      kind: 'success';
      serverId: string;
      config: ChannelSetupConfig;
      result: Awaited<ReturnType<ChannelSetupOrchestrator['createChannelsFromSetup']>>;
    };

export class ChannelSetupSessionController {
  constructor(deps: {
    orchestrator: ChannelSetupOrchestrator;
    getSelectedServerId: () => string | null;
  });

  getSnapshot(): ChannelSetupSessionSnapshot;
  beginSession(): void;
  endSession(): void;
  loadLibraries(): Promise<void>;
  syncSetupContext(): void;
  setStep(step: SetupStep): void;
  selectAllLibraries(): void;
  clearAllLibraries(): void;
  toggleLibrary(libraryId: string): boolean;
  updateStrategyState(mutate: (draft: StrategyStepMutableState) => void): void;
  clearReviewForEdits(): void;
  clearReviewAndReturnToStep2(): void;
  toggleReplaceConfirm(): void;
  buildConfig(serverId: string): ChannelSetupConfig;
  buildPreviewKey(config: ChannelSetupConfig): string;
  schedulePreview(onStateChange: () => void): void;
  ensureReviewLoaded(onStateChange: () => void): Promise<void>;
  beginBuild(
    options: {
      onProgress: (progress: ChannelBuildProgress) => void;
      onStateChange: () => void;
    }
  ): Promise<ChannelSetupBuildOutcome>;
  cancelBuild(): boolean;
}
```

### Adapter Rules Between Screen And Controller

- Do not change any step-controller files.
- The screen must treat `this._session.getSnapshot()` as read-only data. All mutations must go through controller methods.
- `ChannelSetupScreen` must adapt the controller snapshot back into the existing step-controller dependency contracts.
- `StrategyStepController` keeps using `applySettingChange(focusId, mutate)`. Inside that callback, the screen must:
  1. set focus bookkeeping
  2. call `controller.updateStrategyState(mutate)`
  3. perform only screen-local focus/render bookkeeping
  4. run the existing in-place row update optimization when applicable
  5. rerender or update focus
- `BuildReviewStepController` keeps using `loadReview()`. The screen must pass `() => controller.ensureReviewLoaded(() => this._renderStep())`.
- `BuildProgressStepController` keeps using `startBuild(ui)`. The screen must:
  1. call `controller.beginBuild({ onProgress, onStateChange })`
  2. translate the returned `ChannelSetupBuildOutcome` into the existing DOM updates
  3. keep button text/focus behavior in the screen

### Test Ownership Rules

Move state/config/private-probe assertions out of `ChannelSetupScreen.test.ts` and into the new controller test file. Specifically, migrate coverage for:

- cloning nested Step 2 draft state
- default Step 2 strategy state
- config serialization and preview-key generation
- Expand Lineup config effects
- higher-volume default config values

Keep these as screen/integration tests in `ChannelSetupScreen.test.ts`:

- show/hide/destroy cleanup
- Step 2 focus graph and D-pad behavior
- preview-strip expand/collapse persistence
- fast-path first-time build vs review routing
- delayed preview resolution after fast-path transition
- review-loading UI behavior
- build cancel/back button UI behavior
- stale focus protection across rerenders

Do not add new private probes to `ChannelSetupScreen.test.ts`. If a behavior needs deep state inspection, cover it in `ChannelSetupSessionController.test.ts` instead.

## Preservation Contracts

- `show()` must still:
  - make the container visible
  - register the Step 2 key handler once per visible session
  - reset session state for a fresh session
  - start library loading
- `hide()` must still:
  - abort in-flight build/preview/review work
  - clear preview debounce timers and preview-delta timers
  - unregister key handlers
  - unregister focusables
  - hide the container
- First-time setup must still route directly from Step 2 into build progress without loading review.
- Existing and unknown setup context must still route through review.
- Delayed preview responses must still be ignored after:
  - screen hide
  - session restart
  - fast-path transition into build
- Build cancellation must still surface as canceled, not as an error.
- Hidden UI must leave no stray timers, listeners, abort controllers, or stale focus targets behind.
- Focus and D-pad behavior must remain unchanged because focus ownership stays in the screen and focus coordinator.

## Verification Commands

Baseline before edits:

```bash
npm test -- --runTestsByPath src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts
npm run verify
```

Expected baseline:

- `ChannelSetupScreen.test.ts` passes before edits.
- `npm run verify` reflects the current workspace baseline. If unrelated failures remain, record them as baseline only.

Controller verification during implementation:

```bash
npm test -- --runTestsByPath src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts
```

Expected controller result:

- the new controller test file fails before implementation, then passes after the controller lands

Integration verification during implementation:

```bash
npm test -- --runTestsByPath src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts
npm test -- --runTestsByPath src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts
```

Expected integration result:

- both test files pass together

Completion gate:

```bash
npm run verify
```

Expected completion result:

- `npm run verify` passes before `P4-W3` is marked complete

## Rollback Notes

- If the screen starts depending on duplicated session types or helper logic in both files, stop and consolidate ownership into the controller before continuing.
- If implementation pressure suggests changing step-controller APIs or editing `steps/types.ts`, stop and refresh this plan. That is outside the allowed work unit.
- If focus behavior or Step 2 remote handling regresses, revert the screen-integration commit and keep the controller commit only if its tests are still green and isolated.
- If preview/review/build parity changes, restore the previous runtime behavior before continuing. This work unit cannot trade correctness for smaller file size.
- If `npm run verify` still has unrelated failures at the end, do not mark the checklist item complete.

## Commit Checkpoints

Suggested checkpoints for tracked work:

1. `refactor: extract channel setup session controller`
2. `refactor: route channel setup screen through session controller`
3. `docs: mark p4-w3 complete`

Do not create a commit that intentionally leaves the branch red unless the maintainer explicitly asks for that workflow.

## Allowed File Changes

Only these files may change during implementation:

- `src/modules/ui/channel-setup/ChannelSetupSessionController.ts`
- `src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts`
- `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
- `src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts`
- `ARCHITECTURE_CLEANUP_CHECKLIST.md`

## Task 0: Baseline The Worktree And Current Screen Behavior

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

Expected: all remaining commands run from that worktree root.

**Step 3: Confirm clean starting status**

Run:

```bash
git status --short --branch
```

Expected: output starts with `## codex/p4-w3-channel-setup-session-flow-split`.

**Step 4: Run freshness-gate commands**

Run the freshness-gate commands from the top of this plan.

Expected: all expectations still hold.

**Step 5: Record the current test baseline**

Run:

```bash
npm test -- --runTestsByPath src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts
npm run verify
```

Expected:

- the screen test suite passes
- `npm run verify` result is recorded exactly, including any unrelated baseline failures

## Task 1: Define Controller Coverage Before Moving Production Code

**Files:**
- Create: `src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts`

**Step 1: Create the new controller test file**

Create `src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts`.

**Step 2: Add failing tests for controller-owned default state and helper ownership**

Add tests that directly prove:

- `beginSession()` resets to Step 1 defaults
- the controller owns the default strategy/build/session state
- `buildConfig(serverId)` serializes strategy config, channel expansion, series ordering, and min/max values
- `buildPreviewKey(config)` changes when the preview-relevant config changes
- `updateStrategyState(...)` clones nested strategy/session state before applying the mutation

**Step 3: Add failing tests for async workflow ownership**

Add tests that directly prove:

- `loadLibraries()` handles success, failure, and setup-record application
- `syncSetupContext()` preserves `first-time`, `existing`, and `unknown`
- `schedulePreview(...)` debounces preview work, suppresses duplicate keys, and ignores stale results
- preview-delta expiry clears after the timeout window
- `ensureReviewLoaded(...)` handles success, failure, and abort-like interruption
- `beginBuild(...)` returns:
  - `missing-server`
  - `canceled`
  - `error`
  - `success`

**Step 4: Run the new controller test file**

Run:

```bash
npm test -- --runTestsByPath src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts
```

Expected: FAIL because the controller does not exist yet.

**Step 5: Do not commit yet**

Keep working until the branch is green.

## Task 2: Implement The Session Controller As The Single State Owner

**Files:**
- Create: `src/modules/ui/channel-setup/ChannelSetupSessionController.ts`

**Step 1: Move shared session types and default helpers into the new controller file**

Create `ChannelSetupSessionController.ts` and move the session-domain definitions from `ChannelSetupScreen.ts` into it:

- `ChannelSetupOrchestrator`
- session state types
- default-state helpers
- config-shaping helpers

Do not duplicate the old definitions. The new file is the new source of truth.

**Step 2: Implement the controller constructor and snapshot state**

Use one internal mutable state object and expose `getSnapshot()` for reads. The snapshot must contain every controller-owned field listed in the locked decisions section.

**Step 3: Implement session lifecycle methods**

Implement:

- `beginSession()`
- `endSession()`
- `setStep(step)`
- `clearReviewForEdits()`
- `clearReviewAndReturnToStep2()`
- `toggleReplaceConfirm()`

These methods must own all timer, abort-controller, and stale-session cleanup previously handled by `_resetState()` and `_cleanupStep2AsyncState()`.

**Step 4: Implement library/setup-record loading**

Implement `loadLibraries()` so it:

- sets loading state
- fetches libraries from the orchestrator
- applies any saved setup record
- defaults selection to all libraries when there is no record
- records load failure state without touching DOM

**Step 5: Implement strategy mutation and config helpers**

Implement:

- `toggleLibrary(...)`
- `selectAllLibraries()`
- `clearAllLibraries()`
- `updateStrategyState(...)`
- `buildConfig(serverId)`
- `buildPreviewKey(config)`

`updateStrategyState(...)` must clone nested state before applying the mutator, matching current behavior.

**Step 6: Implement preview and review orchestration**

Implement:

- `syncSetupContext()`
- `schedulePreview(onStateChange)`
- `ensureReviewLoaded(onStateChange)`

Rules:

- preview debounce remains 400ms
- stale preview results are ignored after session reset, hide, or step change
- review loading remains single-flight
- all DOM updates happen through the supplied `onStateChange()` callback, not inside the controller

**Step 7: Implement build orchestration**

Implement `beginBuild({ onProgress, onStateChange })` and `cancelBuild()`.

Rules:

- controller owns the build abort controller
- controller builds the config
- controller calls `markSetupComplete(...)` only on success
- controller returns the explicit `ChannelSetupBuildOutcome`
- controller never writes button text, focus, or DOM

**Step 8: Run controller tests until green**

Run:

```bash
npm test -- --runTestsByPath src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts
```

Expected: PASS.

**Step 9: Commit the green controller unit**

Run:

```bash
git add src/modules/ui/channel-setup/ChannelSetupSessionController.ts src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts
git commit -m "refactor: extract channel setup session controller"
```

Expected: one green commit containing the new controller and its tests.

## Task 3: Rewire `ChannelSetupScreen` To Consume Controller Snapshots

**Files:**
- Modify: `src/modules/ui/channel-setup/ChannelSetupScreen.ts`

**Step 1: Replace local session definitions with controller imports**

At the top of `ChannelSetupScreen.ts`:

- remove local session-domain type/helper definitions that moved to the controller file
- import those definitions from `./ChannelSetupSessionController`
- re-export `ChannelSetupOrchestrator` from the controller file so test helpers remain unchanged

**Step 2: Add a controller instance to the screen**

Add one field:

```ts
private readonly _session: ChannelSetupSessionController;
```

Instantiate it in the constructor with:

- `orchestrator: this._orchestrator`
- `getSelectedServerId: () => this._getSelectedServerId()`

**Step 3: Update `show()` and `hide()`**

- `show()` must call `this._session.beginSession()` instead of resetting local session fields.
- `show()` must still register the nav handler once and then start loading libraries through `this._session.loadLibraries()`.
- `hide()` must call `this._session.endSession()` before unregistering the nav handler and focusables.

**Step 4: Replace direct field reads with snapshot reads**

Inside `ChannelSetupScreen.ts`, read controller-owned state only through:

```ts
const session = this._session.getSnapshot();
```

Do this in:

- `_renderLibraryStep()`
- `_renderStrategyStep()`
- `_renderBuildStep()`
- `_renderBuildReview()`
- `_renderBuildProgress()`
- any helper that currently reads moved session state

**Step 5: Keep Step 2 D-pad logic in the screen**

The `keyPress` handler stays in `ChannelSetupScreen`. Update it so it:

- reads `step`, `strategyOrder`, and other moved data from the snapshot
- mutates session-owned strategy order via `this._session.updateStrategyState(...)`
- preserves `_activeStrategyCategory`, `_grabbedPriorityKey`, `_preferredFocusId`, and `_rememberedDetailFocusByCategory` in the screen

**Step 6: Keep step-controller APIs unchanged**

Rewire the callbacks only:

- Library step:
  - toggle/select/clear library calls controller methods
- Strategy step:
  - `applySettingChange(...)` calls `this._session.updateStrategyState(...)`
  - `schedulePreview()` calls `this._session.schedulePreview(() => this._renderStep())`
  - `onNext()` sets the controller step to `3` and preserves the existing fast-path rule
- Build review step:
  - `loadReview()` calls `this._session.ensureReviewLoaded(() => this._renderStep())`
  - `onBackToStrategy()` calls `this._session.clearReviewAndReturnToStep2()`
  - `onToggleReplaceConfirm()` calls `this._session.toggleReplaceConfirm()`
- Build progress step:
  - `onCancelOrBack()` first tries `this._session.cancelBuild()`
  - `startBuild(ui)` calls `this._session.beginBuild(...)` and maps the returned outcome into the existing DOM behavior

**Step 7: Preserve DOM-only helpers in the screen**

Do not move:

- `_renderBuildReviewLoading()`
- `_renderCappedWarnings()`
- `_buildPreviewRow()`
- focus registration helpers

**Step 8: Run the screen test suite**

Run:

```bash
npm test -- --runTestsByPath src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts
```

Expected: either PASS or a small set of failing tests that now need test ownership cleanup in Task 4.

Allowed temporary failures after Task 3:

- only the screen tests that still private-probe moved controller-owned state
- no focus/navigation/preview/build integration regressions

## Task 4: Move State-Probe Assertions Out Of Screen Tests And Finish Integration Coverage

**Files:**
- Modify: `src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts`
- Modify: `src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts`

**Step 1: Remove screen tests that only probe controller-owned state**

Delete or rewrite the `ChannelSetupScreen.test.ts` cases that directly inspect screen-private config/session state and move their assertions into `ChannelSetupSessionController.test.ts`.

Move these exact coverage areas to controller tests:

- nested draft cloning
- default strategy state
- config serialization
- preview-key generation
- Expand Lineup config values
- default min/max config values

**Step 2: Keep and repair screen integration tests**

Ensure `ChannelSetupScreen.test.ts` still covers:

- loading/render basics
- bulk selection UI
- focus neighbor wiring
- Step 2 category/detail movement
- stale-focus protection
- preview-strip expansion behavior
- first-time fast-path build
- existing/unknown review route
- delayed preview resolution after fast-path build transition
- cancel/back UI semantics in build progress

**Step 3: Run both channel-setup test files together**

Run:

```bash
npm test -- --runTestsByPath src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts
```

Expected: PASS.

**Step 4: Commit the screen integration and test cleanup**

Run:

```bash
git add src/modules/ui/channel-setup/ChannelSetupScreen.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts
git commit -m "refactor: route channel setup screen through session controller"
```

Expected: one green commit containing the screen rewire and test-ownership cleanup.

## Task 5: Final Verification And Checklist Update

**Files:**
- Modify: `ARCHITECTURE_CLEANUP_CHECKLIST.md`

**Step 1: Re-run the targeted channel-setup tests**

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

Expected: PASS.

**Step 3: Mark `P4-W3` complete only after verify passes**

Update this checklist line:

```md
- [ ] P4-W3 - Split one bounded concern out of `ChannelSetupScreen` (recommended: step orchestration vs view rendering)
```

to:

```md
- [x] P4-W3 - Split one bounded concern out of `ChannelSetupScreen` (recommended: step orchestration vs view rendering) (done 2026-03-06; plan: docs/archive/plans/2026-03-06-p4-w3-channel-setup-session-flow-split-implementation.md)
```

**Step 4: Commit closeout**

Run:

```bash
git add ARCHITECTURE_CLEANUP_CHECKLIST.md
git commit -m "docs: mark p4-w3 complete"
```

Expected: checklist update only after all verification passes.

## Success Criteria

- `ChannelSetupSessionController` exists and is the single owner of channel-setup session state and async workflow policy.
- `ChannelSetupScreen` remains the owner of DOM, focus, D-pad handling, and step-controller rendering.
- No step-controller files or shared step types were modified.
- State/config private probes moved out of `ChannelSetupScreen.test.ts` and into `ChannelSetupSessionController.test.ts`.
- Targeted channel-setup tests pass.
- `npm run verify` passes before checklist closeout.
- `P4-W3` is marked complete with the tracked plan path only after verification succeeds.
