# EPG Video Layer Stability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate the EPG PiP jank and the sequence-sensitive post-overlay video shift without globally removing the player OSD slide-up polish.

**Architecture:** This plan treats the bug as a layered runtime/UI stability problem, not as an OSD-animation bug by default. The implementation is staged: first instrument and prove the failing state, then remove animated geometry from the real EPG PiP video path, and only then escalate into deeper `VideoPlayer` visibility/runtime changes if evidence still points there. The player-screen animation language stays intact unless the measured evidence says a narrow conditional mitigation is still necessary.

**Tech Stack:** TypeScript, Jest, webOS-targeted DOM/CSS UI, Lineup orchestrator/runtime controllers, Codanna discovery, Context7 docs checks.

---

## Goal

- Fix issue 2 directly by stabilizing EPG PiP open behavior.
- Investigate and, if supported by evidence, fix the deeper runtime cause of issue 1 without globally removing the OSD slide-up animation.
- Leave a regression-resistant verification trail so future sessions do not have to rediscover the same video-layer/compositor seam.

## Non-Goals

- Do not globally remove the OSD slide-up or the exit-confirm entry motion as a first-line change.
- Do not redesign the EPG visual language or switch away from classic PiP mode.
- Do not rewrite playback startup/channel tuning architecture beyond the minimum needed to stabilize the measured seam.
- Do not introduce legacy/fallback dual paths unless explicitly approved later.

## Parent-Priority / Architecture Alignment

- Task family: `cleanup/refactor`
- Cleanup subtype: `standalone remediation`
- This is not a checklist-linked `P#-W#` item by default; it is a production-facing bug remediation plan.
- Architecture alignment:
  - `docs/architecture/CURRENT_STATE.md` says `src/Orchestrator.ts` should remain a delegation surface, `src/modules/ui/epg/EPGCoordinator.ts` owns EPG runtime policy entrypoints, and `src/modules/player/` owns playback runtime behavior.
  - The plan therefore keeps fixes inside the actual owners:
    - EPG PiP/layout changes in EPG/startup-policy/video-style owners
    - playback visibility/runtime changes in player/runtime owners
    - any post-switch overlay-reopen gate owned by playback runtime, with navigation/UI as a consumer only if a read-only runtime-readiness contract is needed
    - instrumentation/test sequencing in the same owners that expose the behavior

## Freshness Gate

- Before implementation, re-read:
  - `docs/qa/reports/2026-04-04-epg-osd-sequence-bug-report.md`
  - `src/core/initialization/InitializationStartupPolicy.ts`
  - `src/styles/video.css`
  - `src/modules/player/VideoPlayer.ts`
  - `src/modules/ui/epg/EPGCoordinator.ts`
  - `src/modules/ui/epg/EPGComponent.ts`
- If those files or the bug-report conclusions changed materially, update this plan before implementing.
- If a fresh repro proves the OSD slide is itself broken even in steady-state playback, stop and refresh the plan; that would change the current decision gate.

## Planner Self-Check

1. Unresolved architecture seam or ownership ambiguity hidden in the task?
   - No. The plan explicitly assigns PiP/layout ownership to `InitializationStartupPolicy`, post-switch overlay-readiness ownership to `PlaybackRuntimeController`, and keeps `NavigationCoordinator` as a consumer only.
2. Adjacent files needing contract or type changes that are not in scope?
   - No. `NavigationCoordinator` and `PlayerOsdCoordinator` may assert consumer behavior in tests, but no cross-module contract expansion is required unless phase 3 is entered, and that escalation is already named here.
3. Any file declared out of scope that implementation still implicitly relies on?
   - No. The out-of-scope motion files remain frozen unless phase-3 proof explicitly reopens them.
4. Full Codanna evidence path plus fallback reads recorded?
   - Yes. The Codanna discovery section records noisy semantic results and the direct tracked-doc / `rg` fallback reads that shaped the plan.
5. Repo-preferred owner selected, or is a hotspot quietly growing?
   - Repo-preferred owners are selected. The plan avoids regrowing `Orchestrator` and keeps runtime timing logic out of navigation/UI owners.
6. Would a fresh session need to invent anything important to execute safely?
   - No. The owner seams, decision gates, in-scope files, and escalation order are all explicit.
7. Is this execution-grade, or is a design decision still unresolved?
   - Execution-grade. The only conditional path is whether phase 3 is needed, and that condition is governed by the explicit proof and decision-gate sections below.

## Architecture Seam Decision Gate

- Chosen seam for issue 2:
  - classic PiP layout/class ownership remains in `src/core/initialization/InitializationStartupPolicy.ts` plus `src/styles/video.css`
  - the fix removes animated real-video geometry from the PiP path without moving ownership into navigation or player OSD surfaces
- Chosen seam for issue 1:
  - post-switch overlay timing/readiness belongs to `src/core/PlaybackRuntimeController.ts`
  - `src/modules/navigation/NavigationCoordinator.ts` may only consume a read-only readiness signal if phase 3 proves that gating is required
- Frozen seams unless phase-3 proof reopens them:
  - `src/modules/ui/player-osd/styles.css`
  - `src/modules/ui/exit-confirm/styles.css`
  - `src/modules/ui/player-osd/PlayerOsdCoordinator.ts`
  - `src/modules/ui/exit-confirm/ExitConfirmCoordinator.ts`
- Decision-point-free execution rule:
  - do not invent new adapters, timers, or UI-local timing heuristics mid-implementation
  - if phase-1 or phase-2 proof contradicts these owner choices, stop and refresh the plan instead of improvising a new seam during execution

## Required Reading

1. `docs/qa/reports/2026-04-04-epg-osd-sequence-bug-report.md`
2. `docs/architecture/CURRENT_STATE.md`
3. `docs/AGENTIC_DEV_WORKFLOW.md`
4. `docs/agentic/plan-authoring-standard.md`
5. `docs/plans/2026-03-04-epg-performance-risk-register.md`
6. `docs/development/debugging.md`

## Required Skills

- `using-superpowers`
- `systematic-debugging`
- `ui-composition-patterns`
- `architecture-boundaries`
- `execution-plan-authoring`
- `verification-before-completion`
- `test-driven-development` when behavior coverage changes are introduced

## Codanna Discovery

- `semantic_search_with_context`
  - Query: `EPG classic PiP video geometry layout mode onLayoutModeChange video-container epg-pip-active`
  - Result: noisy / insufficient for precise ownership; did not surface the actual PiP owner cleanly.
  - Fallback used: direct file reads and symbol lookups.
- `semantic_search_with_context`
  - Query: `player video display none block channel switch overlay OSD modal close video layer`
  - Result: partially useful, surfaced `VideoPlayer.stop()` / unload path but still noisy for plan-grade ownership.
  - Fallback used: direct file reads and symbol lookups.
- `search_documents`
  - Query: `EPG performance PiP video layout renderGrid current-time risk register`
  - Result: useful. Confirmed `docs/plans/2026-03-04-epg-performance-risk-register.md` as the tracked performance context and highlighted unfinished `renderGridInternal()` risk.
- `find_symbol`
  - `EPGCoordinator` -> symbol `4423`
  - `PlaybackRuntimeController` -> symbol `7479`
  - `VideoPlayer` -> symbol `274`
- `analyze_impact`
  - `EPGCoordinator` (`4423`) shows App/bootstrap/Orchestrator impact, confirming shared-risk status.
  - `PlaybackRuntimeController` (`7479`) shows limited but central orchestrator/runtime impact.
  - `VideoPlayer` impact output was unexpectedly weak, so direct reads are the authoritative fallback here.
- Direct tracked-doc / `rg` fallback reads used because Codanna semantic results were noisy:
  - `src/core/initialization/InitializationStartupPolicy.ts`
  - `src/styles/video.css`
  - `src/modules/player/VideoPlayer.ts`
  - `src/modules/ui/epg/EPGCoordinator.ts`
  - `src/modules/ui/epg/EPGComponent.ts`
  - `src/modules/navigation/NavigationCoordinator.ts`
  - `src/modules/ui/player-osd/styles.css`
  - `src/modules/ui/exit-confirm/styles.css`

## Impact Snapshot

- Shared/public symbols and seams likely touched:
  - `src/modules/ui/epg/EPGCoordinator.ts`
  - `src/modules/ui/epg/EPGComponent.ts`
  - `src/core/initialization/InitializationStartupPolicy.ts`
  - `src/styles/video.css`
  - `src/modules/player/VideoPlayer.ts`
  - `src/core/PlaybackRuntimeController.ts`
  - `src/core/PlaybackStartController.ts`
  - `src/core/channel-tuning/ChannelTuningCoordinator.ts`
  - `src/modules/navigation/NavigationCoordinator.ts` (consumer-only if a runtime-readiness contract is added; never the owner of overlay timing policy)
- High-risk contracts to preserve:
  - EPG open/close visibility semantics
  - current classic-vs-overlay layout selection
  - OSD slide-up in steady-state playback
  - channel-switch playback continuity
  - focus and modal sequencing on player screen

## Files In Scope

- `docs/qa/reports/2026-04-04-epg-osd-sequence-bug-report.md`
- `docs/plans/2026-03-04-epg-performance-risk-register.md`
- `src/core/initialization/InitializationStartupPolicy.ts`
- `src/styles/video.css`
- `src/modules/ui/epg/EPGCoordinator.ts`
- `src/modules/ui/epg/EPGComponent.ts`
- `src/modules/player/VideoPlayer.ts`
- `src/core/PlaybackRuntimeController.ts`
- `src/core/PlaybackStartController.ts`
- `src/core/channel-tuning/ChannelTuningCoordinator.ts`
- `src/modules/navigation/NavigationCoordinator.ts`
- `src/core/__tests__/InitializationCoordinator.test.ts`
- `src/modules/ui/epg/__tests__/EPGComponent.test.ts`
- `src/modules/navigation/__tests__/NavigationCoordinator.test.ts`
- `src/modules/ui/player-osd/__tests__/PlayerOsdCoordinator.test.ts`
- `src/modules/player/__tests__/VideoPlayer.test.ts`
- `src/core/__tests__/PlaybackRuntimeController.test.ts`
- additional focused tests in `src/core/orchestrator/__tests__/` only if ownership or orchestration seams change

## Files Out Of Scope

- `src/modules/ui/player-osd/styles.css`
- `src/modules/ui/exit-confirm/styles.css`
- `src/modules/ui/player-osd/PlayerOsdOverlay.ts`
- `src/modules/ui/exit-confirm/ExitConfirmCoordinator.ts`
- `src/modules/ui/exit-confirm/ExitConfirmModal.ts`

Out-of-scope rule:

- Do not globally remove or soften the OSD slide-up / exit-confirm motion in this plan.
- `src/modules/ui/player-osd/PlayerOsdCoordinator.ts` source stays out of scope unless phase 3 proves the runtime-readiness contract must be consumed there; the tests are in scope now because they own the observable overlay-timing contract.
- The listed out-of-scope motion files only come into scope if later evidence proves a narrow conditional mitigation is still required after phases 1-3.

## Invariants / Preservation Contracts

- Preserve the current OSD slide-up effect in steady-state playback.
- Preserve classic EPG PiP as a supported layout mode.
- Preserve remote/focus behavior for:
  - `Down` opening player OSD
  - `Back` hiding OSD before opening exit confirm
  - `Back` cancel path returning to player cleanly
  - EPG open/close behavior from player screen
- Do not move domain logic back into `src/Orchestrator.ts`.
- Keep `show()` / `hide()` owners bounded; do not hide multi-step runtime logic inside view classes.
- Preserve `prefers-reduced-motion` handling for any remaining animation.
- Avoid adding fallback/compatibility branches.

## Chosen Owner Seams

- Phase 1 PiP/layout proof owner: `src/core/initialization/InitializationStartupPolicy.ts`
  - This owner already shapes `onLayoutModeChange` behavior and `epg-pip-active` state.
  - Its seam-owner tests live in `src/core/__tests__/InitializationCoordinator.test.ts`.
- Phase 1 and phase 3 post-switch overlay-readiness owner: `src/core/PlaybackRuntimeController.ts`
  - `PlaybackRuntimeController` already owns playback-state-driven player-surface behavior, including auto info-banner reuse after `playing`.
  - `PlaybackStartController.ts` and `ChannelTuningCoordinator.ts` may arm/reset runtime state, but they do not own the overlay timing contract.
- Navigation/UI role if phase 3 is needed:
  - `src/modules/navigation/NavigationCoordinator.ts` may consume a read-only runtime-readiness contract before reopening player overlays on `Down` or after modal cancel.
  - Navigation must not invent timers, playback heuristics, or compositor-readiness rules locally.
- `src/modules/player/VideoPlayer.ts` is a secondary escalation seam only.
  - Do not change `display: none/block` behavior in phase 3 unless the phase-1 proof and post-phase-2 repro still point there.

## Phase 1 Proof Artifact Contract

- Phase 1 is mandatory. Implementation must not begin phase 2 until proof artifacts exist.
- Raw phase-1 proof artifact:
  - local-only phase-1 proof note for this task run
- Durable summary artifact:
  - `docs/qa/reports/2026-04-04-epg-osd-sequence-bug-report.md`
- Required phase-1 proof contents:
  - startup-policy / `epg-pip-active` state observations
  - post-switch playback-state and overlay-timing observations
  - which sequence still reproduces after proof instrumentation
  - explicit disposition: `stale PiP/layout state`, `post-switch runtime instability`, `both`, or `inconclusive`
- Owner rule:
  - layout/PiP instrumentation belongs to `InitializationStartupPolicy`
  - post-switch overlay-readiness instrumentation belongs to `PlaybackRuntimeController`
  - navigation tests may assert consumer behavior but may not become the source of truth for timing

## Strategy And Decision Gates

### Phase 1 decision gate: instrumentation first

- Add instrumentation and seam-owner tests to prove which state is unstable.
- Required proof owners and observations:
  - `InitializationStartupPolicy.ts`
    - `video-container` class list
    - `epg-pip-active` add/remove timing
    - video element rect/geometry expectations relevant to classic PiP mode
  - `PlaybackRuntimeController.ts`
    - timing around channel switch
    - first `playing` state after switch
    - exit-confirm close
    - first manual OSD reopen after sensitive transitions
  - `NavigationCoordinator.ts` and `PlayerOsdCoordinator` tests only verify consumer behavior against those owners
- Record the raw proof in the local-only phase-1 proof note for this task run, then summarize it in `docs/qa/reports/2026-04-04-epg-osd-sequence-bug-report.md` before phase 2.
- If instrumentation proves issue 1 is caused by stale PiP/layout state, skip deeper player-runtime changes and fix that seam first.
- If instrumentation shows the video layer becomes unstable after visibility toggles on channel switch, escalate to phase 3.

### Phase 2 decision gate: EPG PiP path

- Implement option 2 regardless of issue-1 uncertainty if issue-2 repro remains valid:
  - stop animating the real video geometry into classic PiP
  - preserve the PiP shell/layout state
- Re-test issue 1 after this lands.
- If issue 1 materially improves, keep phase 3 smaller or skip it.

### Phase 3 decision gate: deeper player/runtime stabilization

- Only enter this phase if:
  - issue 1 still reproduces after phase 2, and
  - instrumentation still points to channel-switch/video-layer instability
- Preferred escalation order inside phase 3:
  1. add a playback-runtime-owned readiness contract that gates overlay reopen until first stable post-switch playback, with navigation/UI as a consumer only
  2. only then consider broader `VideoPlayer` visibility strategy changes
- Explicit owner rule:
  - the gate is owned by `PlaybackRuntimeController` and fed by runtime/channel-switch owners as needed
  - `NavigationCoordinator` may consult the gate but must not become its owner
  - `VideoPlayer` changes are blocked unless the gate variant fails or the proof still implicates `display: none/block`

## Verification Commands

- `npm test -- --runInBand src/core/__tests__/InitializationCoordinator.test.ts src/modules/ui/epg/__tests__/EPGComponent.test.ts src/modules/navigation/__tests__/NavigationCoordinator.test.ts src/modules/ui/player-osd/__tests__/PlayerOsdCoordinator.test.ts src/modules/player/__tests__/VideoPlayer.test.ts src/core/__tests__/PlaybackRuntimeController.test.ts`
  - Expected: pass
- `npm run verify`
  - Expected: pass
- Hardware/manual repro verification on the exact sequences from the bug report
  - Issue 1 sequence A: `channel switch -> auto OSD -> back -> down`
  - Issue 1 sequence B: `back -> exit confirm -> cancel -> down`
  - Issue 2 sequence: `open EPG while video is playing in classic PiP mode`
  - Expected:
    - no post-overlay video shift / black flash for issue 1
    - no visible PiP shrink/jank for issue 2

## Rollback Notes

- If phase-2 PiP changes regress classic guide presentation, rollback:
  - `src/core/initialization/InitializationStartupPolicy.ts`
  - `src/styles/video.css`
  - related EPG tests
- If phase-3 runtime stabilization causes playback regressions, rollback:
  - `src/modules/player/VideoPlayer.ts`
  - `src/core/PlaybackRuntimeController.ts`
  - `src/core/PlaybackStartController.ts`
  - `src/core/channel-tuning/ChannelTuningCoordinator.ts`
  - related tests
- If instrumentation/test additions are useful but code fixes regress, keep the instrumentation-friendly tests where they still assert correct public behavior.

## Commit Checkpoints

- Commit 1: instrumentation + regression coverage for the sensitive sequences
- Commit 2: EPG PiP real-video geometry stabilization
- Commit 3: optional deeper player/runtime stabilization only if phase-3 gate is met
- Commit 4: report/risk-register refresh after final verification

## Priority-Exit Readiness

- Not a checklist-linked `P#-W#` item.
- No `P#-EXIT` closeout required.
- Readiness requirement for completion instead:
  - tracked bug report updated with final conclusions
  - any durable EPG performance lesson promoted into the risk register
  - verification evidence recorded in the implementation pass

## Task 1: Add Sequence-Specific Instrumentation And Coverage

**Files:**
- Modify: `src/core/__tests__/InitializationCoordinator.test.ts`
- Modify: `src/modules/ui/epg/__tests__/EPGComponent.test.ts`
- Modify: `src/modules/navigation/__tests__/NavigationCoordinator.test.ts`
- Modify: `src/modules/ui/player-osd/__tests__/PlayerOsdCoordinator.test.ts`
- Modify: `src/modules/player/__tests__/VideoPlayer.test.ts`
- Modify: `src/core/__tests__/PlaybackRuntimeController.test.ts`
- Modify: `docs/qa/reports/2026-04-04-epg-osd-sequence-bug-report.md`

**Step 1: Decide verification class**

- `New or updated automated test required`
- Reason: current coverage does not exercise the sequence-sensitive paths named in the bug report.

**Step 2: Add focused regression tests**

- Add startup-policy seam-owner tests in `src/core/__tests__/InitializationCoordinator.test.ts` that:
  - assert `onLayoutModeChange` continues to own `epg-pip-active`
  - cover returning from classic PiP to normal player state without stale layout class assumptions
  - pin the non-animated real-video geometry contract expected after phase 2
- Add EPG tests that explicitly assert classic PiP mode does not rely on animated real-video geometry as a contract after the code change.
- Add navigation/runtime tests that cover:
  - `back` hiding OSD before exit confirm
  - exit-confirm close path returning cleanly to player state
  - post-switch playback state reaching `playing` before any new overlay-sensitive assertions
- Add player OSD seam-owner timing tests in `src/modules/ui/player-osd/__tests__/PlayerOsdCoordinator.test.ts` that:
  - cover the auto info-banner path after `playing`
  - keep overlay timing assertions attached to the public coordinator behavior rather than CSS motion
  - verify no UI-local timer contract is introduced for the eventual phase-3 readiness gate
- Add player/runtime tests that expose current `display: none/block` assumptions so later changes are deliberate.

**Step 3: Add the mandatory proof artifact**

- Prefer test-observable state and explicit helper seams over permanent noisy logging.
- If hardware proof needs temporary instrumentation, add it only in the chosen seam owners:
  - `InitializationStartupPolicy.ts` for PiP/layout observations
  - `PlaybackRuntimeController.ts` for post-switch overlay-readiness observations
- Record the exact observations, enabled hooks, and disposition in the local-only phase-1 proof note for this task run.
- Summarize the disposition in `docs/qa/reports/2026-04-04-epg-osd-sequence-bug-report.md`.
- Do not proceed to task 2 until both artifacts are updated.

**Step 4: Run the focused verification**

Run:

```bash
npm test -- --runInBand src/core/__tests__/InitializationCoordinator.test.ts src/modules/ui/epg/__tests__/EPGComponent.test.ts src/modules/navigation/__tests__/NavigationCoordinator.test.ts src/modules/ui/player-osd/__tests__/PlayerOsdCoordinator.test.ts src/modules/player/__tests__/VideoPlayer.test.ts src/core/__tests__/PlaybackRuntimeController.test.ts
```

Expected:

- pass, with new sequence coverage in place

**Step 5: Commit**

```bash
git add src/core/__tests__/InitializationCoordinator.test.ts src/modules/ui/epg/__tests__/EPGComponent.test.ts src/modules/navigation/__tests__/NavigationCoordinator.test.ts src/modules/ui/player-osd/__tests__/PlayerOsdCoordinator.test.ts src/modules/player/__tests__/VideoPlayer.test.ts src/core/__tests__/PlaybackRuntimeController.test.ts docs/qa/reports/2026-04-04-epg-osd-sequence-bug-report.md
git commit -m "test(epg): add sequence coverage for video-layer stability"
```

## Task 2: Stabilize The EPG PiP Path Without Touching OSD Motion

**Files:**
- Modify: `src/core/initialization/InitializationStartupPolicy.ts`
- Modify: `src/styles/video.css`
- Modify: `src/core/__tests__/InitializationCoordinator.test.ts`
- Modify: `src/modules/ui/epg/__tests__/EPGComponent.test.ts`
- Modify: `docs/plans/2026-03-04-epg-performance-risk-register.md`
- Modify: `docs/qa/reports/2026-04-04-epg-osd-sequence-bug-report.md`

**Step 1: Decide verification class**

- `New or updated automated test required`
- `Broader verification is enough`
- Reason: this changes a user-visible runtime contract for classic PiP open behavior and touches the tracked EPG performance seam.

**Step 2: Implement the minimal PiP stabilization change**

- Remove transition of the real video geometry in `src/styles/video.css`.
- Keep the classic PiP layout state itself.
- If polish is needed, move that motion to non-video shell/chrome rather than the real video element.

**Step 3: Tighten EPG tests around the new contract**

- Assert startup-policy-owned PiP class behavior remains correct in `src/core/__tests__/InitializationCoordinator.test.ts`.
- Assert classic PiP still activates correctly.
- Assert the layout class/state still flips correctly.
- Assert the new contract does not depend on animated geometry.

**Step 4: Refresh the risk register**

- Add a dated note describing the PiP stabilization change, risk, and rollback surface.

**Step 5: Run verification**

Run:

```bash
npm test -- --runInBand src/core/__tests__/InitializationCoordinator.test.ts src/modules/ui/epg/__tests__/EPGComponent.test.ts src/modules/navigation/__tests__/NavigationCoordinator.test.ts src/modules/ui/player-osd/__tests__/PlayerOsdCoordinator.test.ts src/modules/player/__tests__/VideoPlayer.test.ts src/core/__tests__/PlaybackRuntimeController.test.ts
npm run verify
```

Expected:

- both commands pass
- manual EPG-open repro no longer shows visible PiP shrink during stutter

**Step 6: Commit**

```bash
git add src/core/initialization/InitializationStartupPolicy.ts src/styles/video.css src/core/__tests__/InitializationCoordinator.test.ts src/modules/ui/epg/__tests__/EPGComponent.test.ts docs/plans/2026-03-04-epg-performance-risk-register.md docs/qa/reports/2026-04-04-epg-osd-sequence-bug-report.md
git commit -m "fix(epg): stabilize classic pip video geometry"
```

## Task 3: Re-Evaluate Issue 1 After Phase 2

**Files:**
- Modify: `docs/qa/reports/2026-04-04-epg-osd-sequence-bug-report.md`

**Step 1: Replay the exact issue-1 sequences**

- Sequence A:
  - switch channel
  - wait for auto OSD/info banner
  - press `Back`
  - press `Down`
- Sequence B:
  - press `Back`
  - cancel exit confirm
  - press `Down`

**Step 2: Record which of these is true**

- `Issue 1 resolved or materially reduced after phase 2`
- `Issue 1 unchanged and still points at post-switch video-layer instability`
- `Issue 1 only reproduces on one of the two sequences`

**Step 3: Update the bug report**

- Record the new evidence and whether phase 3 is still justified.

**Step 4: Commit**

```bash
git add docs/qa/reports/2026-04-04-epg-osd-sequence-bug-report.md
git commit -m "docs(qa): record post-pip-stabilization repro results"
```

## Task 4: If Needed, Add A Narrow Post-Switch Stability Guard

**Files:**
- Modify: `src/core/PlaybackRuntimeController.ts`
- Modify: `src/core/PlaybackStartController.ts`
- Modify: `src/core/channel-tuning/ChannelTuningCoordinator.ts`
- Modify: `src/modules/navigation/NavigationCoordinator.ts`
- Modify: `src/modules/ui/player-osd/__tests__/PlayerOsdCoordinator.test.ts`
- Modify: `src/modules/navigation/__tests__/NavigationCoordinator.test.ts`
- Modify: `src/modules/player/VideoPlayer.ts` only if the runtime-readiness gate is insufficient
- Modify: `src/core/__tests__/PlaybackRuntimeController.test.ts`
- Modify: `src/modules/player/__tests__/VideoPlayer.test.ts`
- Modify: `docs/qa/reports/2026-04-04-epg-osd-sequence-bug-report.md`

**Step 1: Decide verification class**

- `New or updated automated test required`
- `Broader verification is enough`
- Reason: this is the deepest and riskiest seam in the plan.

**Step 2: Choose the narrowest runtime fix**

- Preferred order:
  - add a bounded playback-runtime-owned “overlay reopen is safe” contract before overlay-sensitive flows are considered safe
  - let `NavigationCoordinator` consume that read-only contract only where player-screen reopen behavior needs it
  - avoid broad `display: none/block` removal unless the narrower gate is insufficient

Record the chosen variant in the implementation notes before editing.

**Step 3: Implement the minimal runtime stabilization**

- Keep ownership inside player/runtime owners.
- Keep navigation as a consumer only.
- Do not push player-runtime policy back into `src/Orchestrator.ts`.

**Step 4: Add or update tests**

- Assert the chosen runtime guard behavior explicitly.
- Assert navigation/player OSD tests still consume public behavior rather than owning timing policy.
- Assert no regressions in playback resume / time-update / state-transition expectations.

**Step 5: Run verification**

Run:

```bash
npm test -- --runInBand src/core/__tests__/PlaybackRuntimeController.test.ts src/modules/navigation/__tests__/NavigationCoordinator.test.ts src/modules/ui/player-osd/__tests__/PlayerOsdCoordinator.test.ts src/modules/player/__tests__/VideoPlayer.test.ts src/modules/ui/epg/__tests__/EPGComponent.test.ts
npm run verify
```

Expected:

- both commands pass
- manual issue-1 sequences no longer show video shift or black flash

**Step 6: Commit**

```bash
git add src/core/PlaybackRuntimeController.ts src/core/PlaybackStartController.ts src/core/channel-tuning/ChannelTuningCoordinator.ts src/modules/navigation/NavigationCoordinator.ts src/modules/navigation/__tests__/NavigationCoordinator.test.ts src/modules/ui/player-osd/__tests__/PlayerOsdCoordinator.test.ts src/core/__tests__/PlaybackRuntimeController.test.ts src/modules/player/VideoPlayer.ts src/modules/player/__tests__/VideoPlayer.test.ts docs/qa/reports/2026-04-04-epg-osd-sequence-bug-report.md
git commit -m "fix(player): stabilize post-switch video layer before overlay reuse"
```

## Task 5: Final Verification And Documentation Refresh

**Files:**
- Modify: `docs/qa/reports/2026-04-04-epg-osd-sequence-bug-report.md`
- Modify: `docs/plans/2026-03-04-epg-performance-risk-register.md`

**Step 1: Run final verification**

Run:

```bash
npm run verify
```

Expected:

- pass

**Step 2: Record final dispositions**

- Update the bug report with:
  - final root-cause call
  - what landed
  - what remains open, if anything
- Update the risk register if any durable EPG performance lesson or rollback surface changed.

**Step 3: Commit**

```bash
git add docs/qa/reports/2026-04-04-epg-osd-sequence-bug-report.md docs/plans/2026-03-04-epg-performance-risk-register.md
git commit -m "docs(epg): record final video-layer stability outcome"
```
