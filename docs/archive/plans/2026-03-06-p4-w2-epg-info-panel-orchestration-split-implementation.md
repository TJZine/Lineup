# P4-W2 EPG Info Panel Orchestration Split Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete `P4-W2` by extracting info-panel orchestration out of `src/modules/ui/epg/EPGComponent.ts` into one durable collaborator while preserving current EPG behavior, focus behavior, layout-mode behavior, and timer cleanup.

**Architecture:** Keep `EPGComponent` as the exported EPG surface and keep all existing public methods and constructor call sites unchanged. Introduce exactly one new collaborator, `src/modules/ui/epg/EPGInfoPanelCoordinator.ts`, to own info-panel presentation mode sync, host switching between overlay/classic containers, immediate fast updates, deferred full updates, and hide/cleanup behavior. `EPGComponent` remains responsible for grid state, navigation, scroll math, and deciding when focus/layout changes should trigger coordinator sync.

**Tech Stack:** TypeScript, Jest with jsdom and fake timers, Lineup EPG UI module, existing `EPGInfoPanel`, existing EPG DOM/CSS structure.

---

## Freshness Gate

Run these commands before creating a worktree or editing files:

```bash
git rev-parse --show-toplevel
rg -n "P4-W2" ARCHITECTURE_CLEANUP_CHECKLIST.md
rg -n "syncInfoPanelHost|_scheduleInfoPanelUpdate|_clearInfoPanelFullUpdateTimer|_infoPanelFullUpdateTimer|_pendingInfoPanelKey" src/modules/ui/epg/EPGComponent.ts
rg -n "wires the resolved layout mode into the shared info panel presentation mode|moves the info panel between overlay showcase and classic showcase when layout mode changes|poster/summary deferred during rapid focus changes|timer cleared on hide" src/modules/ui/epg/__tests__/EPGComponent.test.ts
```

Expected:

- `git rev-parse --show-toplevel` prints the Lineup repo root.
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` still shows `P4-W2` as unchecked.
- `EPGComponent.ts` still contains all five info-panel orchestration seams listed above.
- `EPGComponent.test.ts` still contains the current info-panel behavior tests listed above.

If any expectation fails, stop and update this tracked plan first. Do not improvise around drift.

## Non-Goals

- Do not extract EPG navigation in this work unit.
- Do not change `EPGComponent` public API in `src/modules/ui/epg/interfaces.ts`.
- Do not change `EPGInfoPanel.ts` rendering, poster fetching, HDR badge logic, dynamic color logic, or CSS.
- Do not change `EPGCoordinator.ts`, `NavigationManager`, `EPGVirtualizer.ts`, `EPGChannelList.ts`, `styles.css`, or any user-facing copy.
- Do not redesign the EPG or adjust layout, spacing, timing, focus order, ARIA behavior, or remote-control semantics.
- Do not add compatibility layers, temporary adapters, or second extraction targets.
- Do not add any new DOM structure, CSS classes, inline styles, animation hooks, or design tokens.

## Parent Priority Alignment

This plan advances Priority 4 by removing one bounded, UI-specific orchestration concern from `EPGComponent` without touching D-pad navigation semantics. It moves `EPGComponent` toward the stated end-state of separate state/render/input/async owners while keeping this work unit narrow and durable: after this extraction, future EPG work can target navigation independently instead of fighting intertwined info-panel timer and host-switching code.

## Locked Decisions

- The bounded concern for `P4-W2` is **info-panel orchestration**, not navigation.
- Create exactly one new production file: `src/modules/ui/epg/EPGInfoPanelCoordinator.ts`.
- Create exactly one new test file: `src/modules/ui/epg/__tests__/EPGInfoPanelCoordinator.test.ts`.
- Modify exactly these existing implementation/test files during execution:
  - `src/modules/ui/epg/EPGComponent.ts`
  - `src/modules/ui/epg/__tests__/EPGComponent.test.ts`
  - `ARCHITECTURE_CLEANUP_CHECKLIST.md`
- Do not export `EPGInfoPanelCoordinator` from `src/modules/ui/epg/index.ts`; it is an internal collaborator for this hotspot split.
- Use `IEPGInfoPanel` as the coordinator dependency type so the new coordinator can be unit-tested with mocks.
- Move the info-panel debounce constant into the new coordinator file. Remove the old `INFO_PANEL_FULL_UPDATE_DEBOUNCE_MS` constant from `EPGComponent.ts`.
- Remove the private `EPGComponent` fields `_infoPanelFullUpdateTimer` and `_pendingInfoPanelKey`.
- Remove the private `EPGComponent` methods `syncInfoPanelHost()`, `_clearInfoPanelFullUpdateTimer()`, and `_scheduleInfoPanelUpdate()`.
- Replace direct info-panel hide/debounce calls in `EPGComponent` with coordinator calls; do not leave both code paths alive.
- Keep all current behavior around:
  - classic vs overlay info-panel host placement
  - `setPresentationMode()` calls on layout mode changes
  - focused program fast update immediately
  - full update after 200 ms debounce only when the same program is still focused and the EPG is still visible
  - pending timer cleanup on `hide()`, placeholder focus, schedule clear, and `destroy()`

## Required Reading

Read these in order before implementation:

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/plan-authoring-standard.md`
4. `docs/architecture/CURRENT_STATE.md`
5. `ARCHITECTURE_CLEANUP_CHECKLIST.md`
6. `docs/design/ui-design-language.md`
7. `src/modules/ui/epg/EPGComponent.ts`
8. `src/modules/ui/epg/EPGInfoPanel.ts`
9. `src/modules/ui/epg/interfaces.ts`
10. `src/modules/ui/epg/__tests__/EPGComponent.test.ts`

## Required Skills

Load these exact skills in this order:

1. `using-superpowers`
2. `brainstorming`
3. `writing-plans`
4. `architecture-boundaries`
5. `frontend-design`
6. `ui-composition-patterns`
7. `test-driven-development`
8. `verification-before-completion`

Execution notes:

- Load the listed skills from the current repo/global skill surfaces before implementation.
- `frontend-design` applies here only as a guardrail skill, not as permission to redesign anything.
- This work unit is a refactor. The only acceptable visual outcome is no user-visible visual change.

## Codanna Discovery

- `find_symbol` found `EPGComponent` at `src/modules/ui/epg/EPGComponent.ts:36-1972` with 66 methods, confirming it remains a major hotspot.
- `search_documents` against repo docs confirmed `EPGComponent` remains one of the active Priority 4 UI targets.
- Direct file reads showed the info-panel orchestration is already a bounded seam inside `EPGComponent`:
  - `syncInfoPanelHost()`
  - `applyLayoutMode()`
  - `_clearInfoPanelFullUpdateTimer()`
  - `_scheduleInfoPanelUpdate()`
  - show/hide branches that resync or hide the info panel
  - placeholder/schedule-clear branches that clear the panel
- Existing tests already cover the behavior we need to preserve:
  - host movement between overlay/classic showcases
  - content refresh when switching from classic to overlay
  - info-panel debounce timing
  - timer cleanup on hide
- Codanna `analyze_impact` did not provide enough reverse-usage detail to plan this safely, so direct file reads and `rg` were used as the fallback evidence method.

## Impact Snapshot

- `src/modules/ui/epg/EPGComponent.ts` currently mixes:
  - grid/navigation state
  - layout-mode container class handling
  - info-panel presentation mode and host placement
  - focused-program info-panel fast/full update timing
  - hide/cleanup responsibilities for info-panel timers
- The safest extraction boundary is the info-panel orchestration block because it already talks to an existing focused collaborator (`EPGInfoPanel`) and has strong test coverage.
- Navigation remains larger and more cross-cutting because it also spans library tabs, scrub labels, placeholder focus, wrap behavior, and channel/time scroll reconciliation. Do not start that extraction in this work unit.

## External Reference Notes

- 2026-03-06, Context7 `/mdn/content`: `removeEventListener()` only removes listeners when the event type, listener reference, and capture setting match. Keep the existing `EPGComponent` document/window listener wiring unchanged in this work unit; do not wrap or rebind those listeners while doing the info-panel extraction.
- 2026-03-06, Context7 `/jestjs/jest`: `jest.useFakeTimers()` plus `jest.advanceTimersByTime()` is the correct deterministic way to test timeout-based behavior, and `jest.clearAllTimers()` is appropriate cleanup between timer-driven tests. Use fake timers for the new coordinator debounce tests.

## Files In Scope

- Create: `src/modules/ui/epg/EPGInfoPanelCoordinator.ts`
- Create: `src/modules/ui/epg/__tests__/EPGInfoPanelCoordinator.test.ts`
- Modify: `src/modules/ui/epg/EPGComponent.ts`
- Modify: `src/modules/ui/epg/__tests__/EPGComponent.test.ts`
- Modify after all verification passes: `ARCHITECTURE_CLEANUP_CHECKLIST.md`

## Files Out Of Scope

- `src/modules/ui/epg/EPGInfoPanel.ts`
- `src/modules/ui/epg/index.ts`
- `src/modules/ui/epg/interfaces.ts`
- `src/modules/ui/epg/styles.css`
- `src/modules/ui/epg/EPGCoordinator.ts`
- `src/modules/navigation/**`
- `src/App.ts`
- `src/Orchestrator.ts`
- `docs/architecture/**`

If any out-of-scope file appears to require modification, stop and update the plan first instead of improvising.

## Frontend And Design Guardrails

These are hard constraints derived from `frontend-design`, `ui-composition-patterns`, and `docs/design/ui-design-language.md`:

- Preserve the existing edge-integrated design language by keeping the same host elements and the same DOM order around the classic showcase, overlay showcase, and grid.
- Do not add wrappers, cards, shadows, borders, gradients, typography changes, spacing changes, or motion changes.
- Do not touch `EPGInfoPanel.createTemplate()`, `EPGInfoPanel` CSS classes, or any stylesheets.
- Do not change visibility mechanics for the info panel beyond routing the existing hide/show/update calls through the coordinator.
- The coordinator may move the existing `.epg-info-panel` element between the two existing host elements only. It may not create, clone, or restyle that element.
- No new asynchronous UI waits are allowed in `show()`.
- Hidden UI must still leave no timers alive.

## Preservation Contracts

- `EPGComponent.show()` must still:
  - make the container visible
  - sync peek/layout mode
  - render immediately
  - restore focused info-panel state when `preserveFocus` is true and the focused cell is a program
  - hide the info panel when `preserveFocus` is true and the focused cell is not a program
- `EPGComponent.hide()` must still clear any pending info-panel full update and hide the info panel immediately.
- Switching layout mode while visible with a focused program must still refresh the focused info-panel content.
- Focusing a placeholder or clearing schedules must still hide the info panel immediately and cancel pending full updates.
- No hidden EPG state may leave pending info-panel timers alive.
- No D-pad focus order, channel wrap behavior, page behavior, library-tab focus behavior, scrub label behavior, or selection behavior may change.
- No ARIA attributes or visibility behavior on the classic shell may change.
- Existing document and window listener wiring must remain byte-for-byte untouched.

## Coordinator API Contract

Implement `EPGInfoPanelCoordinator` with this exact public surface:

```ts
import type { IEPGInfoPanel } from './interfaces';
import type { ScheduledProgram } from './types';

interface EPGInfoPanelCoordinatorDeps {
    infoPanel: IEPGInfoPanel;
    getIsVisible: () => boolean;
    getFocusedProgram: () => ScheduledProgram | null;
}

interface EPGInfoPanelHosts {
    infoPanelElement: HTMLElement | null;
    overlayShowcaseElement: HTMLElement | null;
    classicShowcaseInfoElement: HTMLElement | null;
}

export class EPGInfoPanelCoordinator {
    constructor(deps: EPGInfoPanelCoordinatorDeps);
    attachHosts(hosts: EPGInfoPanelHosts): void;
    setLayoutMode(mode: 'overlay' | 'classic'): void;
    syncFocusedProgram(program: ScheduledProgram | null): void;
    clear(): void;
    destroy(): void;
}
```

Use these exact private fields inside the class:

```ts
private readonly infoPanel: IEPGInfoPanel;
private readonly getIsVisible: () => boolean;
private readonly getFocusedProgram: () => ScheduledProgram | null;
private infoPanelElement: HTMLElement | null = null;
private overlayShowcaseElement: HTMLElement | null = null;
private classicShowcaseInfoElement: HTMLElement | null = null;
private layoutMode: 'overlay' | 'classic' = 'classic';
private fullUpdateTimer: ReturnType<typeof setTimeout> | null = null;
private pendingProgramKey: string | null = null;
```

Implement these exact behavior rules:

- `attachHosts(hosts)`:
  - store the three DOM references on the instance
  - immediately sync the current host for the last known layout mode
  - do not throw if any host is `null`
- `setLayoutMode(mode)`:
  - store the mode
  - call `infoPanel.setPresentationMode(mode)`
  - if `infoPanelElement` and the target host both exist, move `infoPanelElement` into:
    - `classicShowcaseInfoElement` when mode is `classic`
    - `overlayShowcaseElement` when mode is `overlay`
- `syncFocusedProgram(program)`:
  - if `program` is `null`, call `clear()` and return immediately
  - call `infoPanel.updateFast(program)` immediately
  - cancel any pending full-update timer
  - schedule a new 200 ms timer
  - when the timer fires, only call `infoPanel.updateFull(program)` if:
    - `getIsVisible()` returns `true`
    - `getFocusedProgram()` returns a non-null program
    - the focused program key still matches the scheduled key
- Use this program key format exactly:

```ts
`${program.item.ratingKey}::${program.scheduledStartTime}`
```

- `clear()`:
  - clear any pending full-update timer
  - clear the pending key
  - call `infoPanel.hide()`
- `destroy()`:
  - call `clear()` first
  - set all three host references to `null`
  - do **not** call `infoPanel.destroy()`; `EPGComponent` still owns that

Implementation constraints:

- Do not export `EPGInfoPanelCoordinatorDeps`.
- Do not export `EPGInfoPanelHosts`.
- Do not add any method beyond the five public methods listed above.
- Do not add event listeners, storage access, CSS imports, DOM creation, or navigation knowledge.

## EPGComponent Replacement Map

Make these exact changes in `src/modules/ui/epg/EPGComponent.ts`:

1. Add:

```ts
import { EPGInfoPanelCoordinator } from './EPGInfoPanelCoordinator';
```

2. Remove:

- `const INFO_PANEL_FULL_UPDATE_DEBOUNCE_MS = 200;`
- field `_infoPanelFullUpdateTimer`
- field `_pendingInfoPanelKey`
- method `syncInfoPanelHost()`
- method `_clearInfoPanelFullUpdateTimer()`
- method `_scheduleInfoPanelUpdate()`

3. Add one new field immediately after `private infoPanel: EPGInfoPanel = new EPGInfoPanel();`:

```ts
private infoPanelCoordinator: EPGInfoPanelCoordinator = new EPGInfoPanelCoordinator({
    infoPanel: this.infoPanel,
    getIsVisible: () => this.state.isVisible,
    getFocusedProgram: () =>
        this.state.focusedCell?.kind === 'program'
            ? this.state.focusedCell.program
            : null,
});
```

4. In `initialize()`:
  - keep `this.infoPanel.initialize(overlayShowcase);` exactly as-is
  - keep the existing `this.infoPanelElement = ...` query exactly as-is
  - immediately after the `this.infoPanelElement = ...` line and before thumb-resolver wiring, add exactly:

```ts
this.infoPanelCoordinator.attachHosts({
    infoPanelElement: this.infoPanelElement,
    overlayShowcaseElement: this.overlayShowcaseElement,
    classicShowcaseInfoElement: this.classicShowcaseInfoElement,
});
```

5. In `destroy()`:
  - replace `this._clearInfoPanelFullUpdateTimer();` with `this.infoPanelCoordinator.destroy();`
  - keep `this.infoPanel.destroy();` exactly where the concrete panel is destroyed

6. In `applyLayoutMode()`:
  - keep the container class and `onLayoutModeChange` logic exactly as-is
  - replace:

```ts
this.infoPanel?.setPresentationMode(mode);
this.syncInfoPanelHost();
```

  - with:

```ts
this.infoPanelCoordinator.setLayoutMode(mode);
```

  - keep the existing `didLayoutModeChange && this.state.isVisible` branch, but replace the body with:

```ts
const focusedCell = this.state.focusedCell;
this.infoPanelCoordinator.syncFocusedProgram(
    focusedCell?.kind === 'program' ? focusedCell.program : null
);
```

7. In `show()` preserve-focus handling:
  - replace `this._scheduleInfoPanelUpdate(focusedCell.program);` with `this.infoPanelCoordinator.syncFocusedProgram(focusedCell.program);`
  - replace `this.infoPanel.hide();` with `this.infoPanelCoordinator.clear();`

8. In `hide()`:
  - remove `this._clearInfoPanelFullUpdateTimer();`
  - replace `this.infoPanel.hide();` with `this.infoPanelCoordinator.clear();`

9. In `focusProgram()`:
  - replace `this._scheduleInfoPanelUpdate(program);` with `this.infoPanelCoordinator.syncFocusedProgram(program);`

10. In `focusPlaceholder()`:
  - replace the `_clearInfoPanelFullUpdateTimer()` plus `this.infoPanel.hide()` pair with `this.infoPanelCoordinator.clear();`

11. In `clearSchedules()`:
  - replace `this.infoPanel.hide();` with `this.infoPanelCoordinator.clear();`

12. Do not change any other `EPGComponent` logic in this work unit unless TypeScript or tests force a purely mechanical import/type fix.

## Test Plan

### New Coordinator Unit Tests

Create `src/modules/ui/epg/__tests__/EPGInfoPanelCoordinator.test.ts` with `@jest-environment jsdom` and fake timers. Use a mocked `IEPGInfoPanel` and real DOM host elements.

Start the file with these exact imports:

```ts
/**
 * @jest-environment jsdom
 */

import { EPGInfoPanelCoordinator } from '../EPGInfoPanelCoordinator';
import type { IEPGInfoPanel } from '../interfaces';
import type { ScheduledProgram } from '../types';
```

Use this exact mock shape:

```ts
const infoPanel: IEPGInfoPanel = {
    setPresentationMode: jest.fn(),
    getPresentationMode: jest.fn(() => 'overlay'),
    show: jest.fn(),
    hide: jest.fn(),
    update: jest.fn(),
    updateFast: jest.fn(),
    updateFull: jest.fn(),
};
```

Use this exact program factory:

```ts
const createProgram = (id: string, startMs: number): ScheduledProgram => ({
    item: {
        ratingKey: id,
        type: 'movie',
        title: `Program ${id}`,
        fullTitle: `Program ${id}`,
        durationMs: 3_600_000,
        thumb: `https://example.com/${id}.jpg`,
        summary: `Summary ${id}`,
        year: 2024,
        scheduledIndex: 0,
    },
    scheduledStartTime: startMs,
    scheduledEndTime: startMs + 3_600_000,
    elapsedMs: 0,
    remainingMs: 3_600_000,
    scheduleIndex: 0,
    loopNumber: 0,
    streamDescriptor: null,
    isCurrent: false,
});
```

Use this exact host setup helper:

```ts
const createHosts = (): {
    infoPanelElement: HTMLElement;
    overlayShowcaseElement: HTMLElement;
    classicShowcaseInfoElement: HTMLElement;
} => {
    const infoPanelElement = document.createElement('div');
    const overlayShowcaseElement = document.createElement('div');
    const classicShowcaseInfoElement = document.createElement('div');
    overlayShowcaseElement.appendChild(infoPanelElement);
    document.body.appendChild(overlayShowcaseElement);
    document.body.appendChild(classicShowcaseInfoElement);
    return { infoPanelElement, overlayShowcaseElement, classicShowcaseInfoElement };
};
```

Use this exact timer lifecycle:

```ts
beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
    document.body.innerHTML = '';
});
```

Add these tests with these exact names:

1. `moves the info panel element between overlay and classic hosts when layout mode changes`
2. `updates fast immediately and defers full updates until debounce completes for the still-focused program`
3. `does not run deferred full updates after clear is called`
4. `does not run a stale deferred full update after focus changes to a different program`
5. `destroy clears pending timers without destroying the underlying info panel`

Required assertions:

- test 1:
  - construct the coordinator with `getIsVisible: () => true`
  - call `attachHosts()` once
  - call `setLayoutMode('classic')`
  - assert `infoPanel.setPresentationMode` was called with `'classic'`
  - assert `infoPanelElement.parentElement === classicShowcaseInfoElement`
  - call `setLayoutMode('overlay')`
  - assert `infoPanel.setPresentationMode` was last called with `'overlay'`
  - assert `infoPanelElement.parentElement === overlayShowcaseElement`
- test 2:
  - use one focused-program variable closed over by `getFocusedProgram`
  - call `syncFocusedProgram(programA)`
  - assert `updateFast(programA)` immediately
  - advance timers by `199` ms and assert `updateFull` not called
  - advance timers by `1` ms and assert `updateFull(programA)` called once
- test 3:
  - call `syncFocusedProgram(programA)`
  - call `clear()`
  - assert `hide()` called once
  - advance timers by `250` ms and assert `updateFull` never called
- test 4:
  - call `syncFocusedProgram(programA)`
  - update the focused-program closure to `programB`
  - call `syncFocusedProgram(programB)`
  - advance timers by `250` ms
  - assert `updateFull(programA)` never happened
  - assert `updateFull(programB)` happened exactly once
- test 5:
  - call `syncFocusedProgram(programA)`
  - call `destroy()`
  - advance timers by `250` ms
  - assert `hide()` called once
  - assert `updateFull` never called
  - assert there is no expectation about `destroy` on `infoPanel` because `IEPGInfoPanel` does not own destruction

### Existing EPGComponent Tests To Keep Passing

Keep these current tests passing in `src/modules/ui/epg/__tests__/EPGComponent.test.ts`:

- `moves the info panel between overlay showcase and classic showcase when layout mode changes`
- `refreshes the focused info panel content when switching from classic to overlay mode`
- `poster/summary deferred during rapid focus changes`
- `timer cleared on hide`
- `restores info panel content on reopen when preserveFocus is enabled`
- `does not interfere with focused program and info panel updates`

### Existing Private-Probe Test To Replace

Replace the current private-probe test:

- `wires the resolved layout mode into the shared info panel presentation mode`

with a public-behavior test instead. Do not keep the private `jest.spyOn((localEpg as unknown as { infoPanel: EPGInfoPanel }).infoPanel, ...)` pattern after this refactor.

Replace it with this exact behavior test:

- `applies classic presentation behavior on show and overlay presentation behavior after layout switch`

Use this exact assertion flow:

1. Create an EPG instance with `layoutMode: 'classic'`.
2. Load one channel and the existing `createDetailedSchedule(channel.id)` schedule.
3. Call `show()` and `focusProgram(0, 0)`.
4. Read `const poster = container.querySelector('.epg-info-poster') as HTMLImageElement;`.
5. Assert `poster.style.display === 'none'`.
6. Assert `poster.getAttribute('src') === null`.
7. Call `setLayoutMode('overlay')`.
8. Assert `poster.style.display === 'block'`.
9. Assert `poster.getAttribute('src')` contains `'poster-a.jpg'`.

Do not add any new private probes to replace the old one.

## Task 0: Create The Dedicated Worktree And Baseline

**Files:**
- Modify: none

**Step 1: Confirm the target worktree path does not already exist**

Run:

```bash
test ! -e ../Lineup-p4-w2-epg-info-panel-orchestration
```

Expected: command exits successfully with no output.

If it fails, stop. Do not delete or reuse an existing sibling directory.

**Step 2: Confirm the target branch does not already exist**

Run:

```bash
git branch --list codex/p4-w2-epg-info-panel-orchestration
```

Expected: no output.

If it prints an existing branch, stop and update the plan first.

**Step 3: Create the worktree and branch**

Run:

```bash
git worktree add ../Lineup-p4-w2-epg-info-panel-orchestration -b codex/p4-w2-epg-info-panel-orchestration
```

Expected: a sibling worktree is created on branch `codex/p4-w2-epg-info-panel-orchestration`.

**Step 4: Enter the worktree**

Run:

```bash
cd ../Lineup-p4-w2-epg-info-panel-orchestration
```

Expected: all remaining commands run from the worktree root.

**Step 5: Confirm clean starting status**

Run:

```bash
git status --short --branch
```

Expected: output starts with `## codex/p4-w2-epg-info-panel-orchestration` and shows no tracked changes.

**Step 6: Run the current focused baseline tests**

Run:

```bash
npm test -- --runTestsByPath src/modules/ui/epg/__tests__/EPGComponent.test.ts src/modules/ui/epg/__tests__/EPGInfoPanel.test.ts
```

Expected: PASS before any edits.

## Task 1: Add The New Failing Coordinator Tests First

**Files:**
- Create: `src/modules/ui/epg/__tests__/EPGInfoPanelCoordinator.test.ts`
- Modify: `src/modules/ui/epg/__tests__/EPGComponent.test.ts`

**Step 1: Create the new coordinator test file with the exact imports, helpers, and timer lifecycle from this plan**

Create `src/modules/ui/epg/__tests__/EPGInfoPanelCoordinator.test.ts` exactly as specified in the `Test Plan` section above. Do not invent additional helpers.

**Step 2: Add the first coordinator host-switching test**

Add only:

- `moves the info panel element between overlay and classic hosts when layout mode changes`

Expected after save: the new test file contains one test and does not yet compile because the production coordinator file does not exist.

**Step 3: Add the remaining four coordinator tests**

Add only:

- `updates fast immediately and defers full updates until debounce completes for the still-focused program`
- `does not run deferred full updates after clear is called`
- `does not run a stale deferred full update after focus changes to a different program`
- `destroy clears pending timers without destroying the underlying info panel`

Expected after save: the new test file contains exactly five tests with the exact names from this plan.

**Step 4: Replace the private-probe integration test in `EPGComponent.test.ts`**

Delete `wires the resolved layout mode into the shared info panel presentation mode` and replace it with `applies classic presentation behavior on show and overlay presentation behavior after layout switch` using the exact assertion flow from this plan.

**Step 5: Run the two affected tests before implementation**

Run:

```bash
npm test -- --runTestsByPath src/modules/ui/epg/__tests__/EPGInfoPanelCoordinator.test.ts src/modules/ui/epg/__tests__/EPGComponent.test.ts
```

Expected:

- `EPGInfoPanelCoordinator.test.ts` fails because `../EPGInfoPanelCoordinator` does not exist yet.
- `EPGComponent.test.ts` passes or fails only because of the not-yet-created coordinator import path; there must be no unrelated failures.

**Step 6: Commit the red test stage**

Run:

```bash
git add src/modules/ui/epg/__tests__/EPGInfoPanelCoordinator.test.ts src/modules/ui/epg/__tests__/EPGComponent.test.ts
git commit -m "test: define epg info panel coordinator behavior"
```

Expected: a commit capturing the failing test intent.

## Task 2: Implement The New Coordinator

**Files:**
- Create: `src/modules/ui/epg/EPGInfoPanelCoordinator.ts`

**Step 1: Create `src/modules/ui/epg/EPGInfoPanelCoordinator.ts` with the exact public API and private fields from this plan**

Start with this file structure:

```ts
import type { IEPGInfoPanel } from './interfaces';
import type { ScheduledProgram } from './types';

const INFO_PANEL_FULL_UPDATE_DEBOUNCE_MS = 200;

interface EPGInfoPanelCoordinatorDeps {
    infoPanel: IEPGInfoPanel;
    getIsVisible: () => boolean;
    getFocusedProgram: () => ScheduledProgram | null;
}

interface EPGInfoPanelHosts {
    infoPanelElement: HTMLElement | null;
    overlayShowcaseElement: HTMLElement | null;
    classicShowcaseInfoElement: HTMLElement | null;
}

export class EPGInfoPanelCoordinator {
    // exact field list from the contract section
}
```

**Step 2: Implement the constructor and `attachHosts()`**

Requirements:

- store the three injected dependencies on the instance
- store the three host refs when `attachHosts()` is called
- immediately sync the last-known layout mode by calling the same internal host-move logic used by `setLayoutMode()`
- if any host ref is `null`, return without throwing

**Step 3: Implement `setLayoutMode(mode)`**

Requirements:

- assign `this.layoutMode = mode`
- call `this.infoPanel.setPresentationMode(mode)`
- move `this.infoPanelElement` into the correct target host if both exist
- do nothing else

**Step 4: Implement `syncFocusedProgram(program)`**

Requirements:

- `program === null` must delegate to `clear()`
- otherwise:
  - call `this.infoPanel.updateFast(program)`
  - clear any existing pending timer
  - compute the key
  - store the key
  - schedule the 200 ms timer
- inside the timer callback:
  - clear `this.fullUpdateTimer`
  - return if `this.pendingProgramKey !== key`
  - read `const focusedProgram = this.getFocusedProgram()`
  - return if `!this.getIsVisible()`
  - return if `focusedProgram === null`
  - compute `focusedKey`
  - return if `focusedKey !== key`
  - clear `this.pendingProgramKey`
  - call `this.infoPanel.updateFull(program)`

**Step 5: Implement `clear()` and `destroy()`**

Requirements:

- `clear()` must:
  - clear and null the timer when present
  - clear `this.pendingProgramKey`
  - call `this.infoPanel.hide()`
- `destroy()` must:
  - call `this.clear()`
  - null all three host refs
  - leave the injected `infoPanel` instance alone

**Step 6: Run only the new coordinator test file**

Run:

```bash
npm test -- --runTestsByPath src/modules/ui/epg/__tests__/EPGInfoPanelCoordinator.test.ts
```

Expected: PASS.

**Step 7: Commit the new collaborator**

Run:

```bash
git add src/modules/ui/epg/EPGInfoPanelCoordinator.ts src/modules/ui/epg/__tests__/EPGInfoPanelCoordinator.test.ts
git commit -m "refactor: add epg info panel coordinator"
```

Expected: a clean commit containing only the new coordinator and its direct unit tests.

## Task 3: Wire EPGComponent To The Coordinator

**Files:**
- Modify: `src/modules/ui/epg/EPGComponent.ts`

**Step 1: Add the import and coordinator field**

Make the exact import and field additions from the replacement map. Do not change the existing `infoPanel` field type.

**Step 2: Attach hosts during `initialize()`**

Add `this.infoPanelCoordinator.attachHosts(...)` immediately after the existing `this.infoPanelElement = ...` line and before thumb resolver wiring.

**Step 3: Replace layout-mode orchestration in `applyLayoutMode()`**

Replace only the info-panel presentation/host-sync logic with `this.infoPanelCoordinator.setLayoutMode(mode)`, then replace the focused-program resync branch with the exact `syncFocusedProgram(...)` call from the replacement map.

**Step 4: Replace preserve-focus orchestration in `show()`**

Replace only:

- the program branch call to `_scheduleInfoPanelUpdate(...)`
- the non-program branch call to `this.infoPanel.hide()`

with the coordinator equivalents from the replacement map.

**Step 5: Replace hide-path orchestration in `hide()`**

Remove the direct timer-clear call and replace the direct `infoPanel.hide()` call with `this.infoPanelCoordinator.clear()`.

**Step 6: Replace focus-path orchestration in `focusProgram()`**

Replace the single `_scheduleInfoPanelUpdate(program)` call with `this.infoPanelCoordinator.syncFocusedProgram(program)`.

**Step 7: Replace placeholder and schedule-clear orchestration**

Make these exact replacements:

- in `focusPlaceholder()`, replace the timer-clear plus `infoPanel.hide()` pair with `this.infoPanelCoordinator.clear()`
- in `clearSchedules()`, replace `this.infoPanel.hide()` with `this.infoPanelCoordinator.clear()`

**Step 8: Remove obsolete fields, constant, and helper methods**

Delete:

- `INFO_PANEL_FULL_UPDATE_DEBOUNCE_MS`
- `_infoPanelFullUpdateTimer`
- `_pendingInfoPanelKey`
- `syncInfoPanelHost()`
- `_clearInfoPanelFullUpdateTimer()`
- `_scheduleInfoPanelUpdate()`

Do not delete any unrelated private field or method.

**Step 9: Replace destroy-path timer cleanup**

In `destroy()`, replace `this._clearInfoPanelFullUpdateTimer();` with `this.infoPanelCoordinator.destroy();` and leave `this.infoPanel.destroy();` in place.

**Step 10: Run TypeScript-aware targeted tests**

Run:

```bash
npm test -- --runTestsByPath src/modules/ui/epg/__tests__/EPGInfoPanelCoordinator.test.ts src/modules/ui/epg/__tests__/EPGComponent.test.ts
```

Expected: PASS.

**Step 11: Commit the integration change**

Run:

```bash
git add src/modules/ui/epg/EPGComponent.ts src/modules/ui/epg/__tests__/EPGComponent.test.ts
git commit -m "refactor: route epg info panel flow through coordinator"
```

Expected: a clean integration commit.

## Task 4: Full Verification

**Files:**
- Modify: none

**Step 1: Run the focused EPG tests**

Run:

```bash
npm test -- --runTestsByPath src/modules/ui/epg/__tests__/EPGInfoPanelCoordinator.test.ts src/modules/ui/epg/__tests__/EPGComponent.test.ts src/modules/ui/epg/__tests__/EPGInfoPanel.test.ts
```

Expected: PASS.

**Step 2: Run the repo verification gate required for UI work**

Run:

```bash
npm run verify
```

Expected: PASS.

**Step 3: Inspect the diff before touching the checklist**

Run:

```bash
git diff --stat HEAD~3..HEAD
```

Expected: only these implementation files appear:

- `src/modules/ui/epg/EPGInfoPanelCoordinator.ts`
- `src/modules/ui/epg/__tests__/EPGInfoPanelCoordinator.test.ts`
- `src/modules/ui/epg/EPGComponent.ts`
- `src/modules/ui/epg/__tests__/EPGComponent.test.ts`

There must be no CSS, architecture-doc, or unrelated UI-file changes at this point.

## Task 5: Update The Checklist After Verification Passes

**Files:**
- Modify: `ARCHITECTURE_CLEANUP_CHECKLIST.md`

**Step 1: Mark the work unit complete**

Change:

```md
- [ ] P4-W2 - Split one bounded concern out of `EPGComponent` (recommended: navigation or info-panel orchestration)
```

to:

```md
- [x] P4-W2 - Split one bounded concern out of `EPGComponent` (recommended: navigation or info-panel orchestration) (done 2026-03-06; plan: docs/archive/plans/2026-03-06-p4-w2-epg-info-panel-orchestration-split-implementation.md)
```

**Step 2: Verify only the checklist changed after the prior implementation commits**

Run:

```bash
git diff -- ARCHITECTURE_CLEANUP_CHECKLIST.md
```

Expected: one checklist-line change only.

**Step 3: Commit the checklist update**

Run:

```bash
git add ARCHITECTURE_CLEANUP_CHECKLIST.md
git commit -m "docs: record completion of p4-w2"
```

Expected: the checklist references this plan path exactly.

## Verification Commands

Run these exact commands during implementation:

```bash
npm test -- --runTestsByPath src/modules/ui/epg/__tests__/EPGComponent.test.ts src/modules/ui/epg/__tests__/EPGInfoPanel.test.ts
npm test -- --runTestsByPath src/modules/ui/epg/__tests__/EPGInfoPanelCoordinator.test.ts src/modules/ui/epg/__tests__/EPGComponent.test.ts
npm test -- --runTestsByPath src/modules/ui/epg/__tests__/EPGInfoPanelCoordinator.test.ts
npm test -- --runTestsByPath src/modules/ui/epg/__tests__/EPGInfoPanelCoordinator.test.ts src/modules/ui/epg/__tests__/EPGComponent.test.ts
npm test -- --runTestsByPath src/modules/ui/epg/__tests__/EPGInfoPanelCoordinator.test.ts src/modules/ui/epg/__tests__/EPGComponent.test.ts src/modules/ui/epg/__tests__/EPGInfoPanel.test.ts
npm run verify
```

Expected result for each command:

- baseline command before edits: PASS
- red-test command in Task 1: FAIL for missing coordinator implementation only
- coordinator-only command after Task 2: PASS
- targeted integration command after Task 3: PASS
- focused EPG verification command after Task 4: PASS
- `npm run verify`: PASS

## Rollback Notes

- If the new coordinator unit tests pass but `EPGComponent` integration breaks, revert the integration commit (`refactor: route epg info panel flow through coordinator`) and keep the coordinator commit for diagnosis.
- If `npm run verify` fails in unrelated areas, do not mark `P4-W2` complete; investigate whether the failure is pre-existing before editing the checklist.
- If public behavior changes in navigation, scrub label flow, or classic-shell visibility, stop and restore the previous `EPGComponent` behavior before continuing. This work unit is not allowed to trade remote-flow correctness for file-size reduction.
- If the freshness gate fails because the hotspot already drifted, stop and update this tracked plan rather than forcing the old shape onto the newer code.

## Commit Checkpoints

Use these exact checkpoints:

1. `test: define epg info panel coordinator behavior`
2. `refactor: add epg info panel coordinator`
3. `refactor: route epg info panel flow through coordinator`
4. `docs: record completion of p4-w2`

## Completion Criteria

This plan is complete only when all of the following are true:

- `EPGInfoPanelCoordinator` exists and is the only new production collaborator.
- `EPGComponent` no longer owns info-panel host switching or deferred full-update timer state.
- All listed targeted tests pass.
- `npm run verify` passes.
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` is updated in the same delivery pass with the exact plan path note.
- No visual output, DOM structure, CSS classes, or focus behavior changed beyond the internal ownership split.
