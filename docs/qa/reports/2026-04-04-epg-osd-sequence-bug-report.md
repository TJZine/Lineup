# EPG / OSD Sequence Bug Report (2026-04-04)

## Scope

- Primary issue: player video shifts or flashes after reopening the OSD following another UI surface.
- Secondary issue: EPG open causes PiP shrink/jank.
- This report completes the primary issue first and treats the secondary issue as an addendum only after the primary findings stand on their own.

## Implementation Update (2026-04-04)

- Phase 1 proof is now captured in:
  - `docs/runs/2026-04-04-epg-video-layer-stability/phase-1-proof.md`
- Owner-seam contracts are now pinned in tests:
  - startup-policy owns `epg-pip-active` class toggling for classic/overlay layout mode
  - `PlaybackRuntimeController` owns post-program-start overlay readiness (`pending -> ready` on first `playing`)
- Phase 2 PiP stabilization landed:
  - `src/styles/video.css` no longer animates real video geometry (`top/left/width/height`) for classic PiP
- OSD and exit-confirm motion were not globally changed in this pass.

### Updated disposition

- `stale PiP/layout state`: confirmed and narrowed.
- `post-switch runtime instability`: runtime-owner seam instrumented and test-covered.
- Combined disposition: `both`.

### Manual repro status

- Post-phase-2 hardware replay for issue-1 sequence A/B remains required:
  - A: `channel switch -> auto OSD -> back -> down`
  - B: `back -> exit confirm -> cancel -> down`
- This report update records code/test evidence and does not claim final device-side elimination without that rerun.

## Command Log

- `rg` / `sed` evidence sweep across:
  - `src/modules/ui/player-osd/*`
  - `src/modules/ui/epg/*`
  - `src/modules/ui/exit-confirm/*`
  - `src/modules/navigation/NavigationCoordinator.ts`
  - `src/core/initialization/InitializationStartupPolicy.ts`
  - `src/modules/player/VideoPlayer.ts`
  - `src/styles/video.css`
- `npm test -- --runInBand src/modules/ui/epg/__tests__/EPGComponent.test.ts src/modules/navigation/__tests__/NavigationCoordinator.test.ts src/modules/ui/player-osd/__tests__/PlayerOsdCoordinator.test.ts`
  - Result: PASS (`3/3` suites, `167` tests)
- Context7 docs check:
  - MDN guidance on animation performance and property cost
  - web.dev guidance on animation performance / CLS-safe animation

## Issue 1

### User-Reported Symptom

Sequence A:

1. Swap channel.
2. Let the auto-open OSD appear.
3. Press `Back` to close it.
4. Press `Down` to open the OSD manually.
5. Video appears visually displaced and then settles into place, sometimes with a brief black flash.

Sequence B:

1. While video is playing, press `Back` to open exit confirm.
2. Cancel.
3. Open the OSD on the current playback.
4. The same shift / black-flash behavior can reappear.

Observed behavior:

- The problem is sequence-sensitive.
- It is strongest on the first reopen after another UI surface was active.
- Immediate repeat OSD opens often do not reproduce it.

### Severity

- Severity: High
- User impact: breaks trust in playback stability during core remote-control flows
- Risk category: player-visible compositor / layout glitch on a 10-foot UI path

## Primary Findings

### Finding 1: the OSD itself does not intentionally move the video element

`PlayerOsdCoordinator` only sets view-model state and toggles overlay visibility.

- `src/modules/ui/player-osd/PlayerOsdCoordinator.ts`
  - `toggle()` calls `_renderAndShow(...)`
  - `hide()` only hides the overlay and unregisters focusables
  - no video geometry mutation exists in this coordinator

`PlayerOsdOverlay` only toggles a `visible` class on the OSD container.

- `src/modules/ui/player-osd/PlayerOsdOverlay.ts`
  - `show()` adds `visible`
  - `hide()` removes `visible`

### Finding 2: the OSD animation is a bottom-up transform/opacity transition over live video

The OSD root fades in and the OSD panel slides from bottom to final position.

- `src/modules/ui/player-osd/styles.css`
  - `.player-osd` transitions `opacity`
  - `.player-osd-panel` starts at `transform: translateY(100%)`
  - `.player-osd.visible .player-osd-panel` transitions to `translateY(0)`

This means the OSD can trigger a fresh compositing pass even though it does not directly change video geometry.

### Finding 3: the exit confirm modal uses the same bottom-entry pattern

The exit confirm modal uses a bottom sheet with `transform` + `opacity` transition.

- `src/modules/ui/exit-confirm/styles.css`
  - `.exit-confirm-panel` starts at `transform: translate3d(0, 18px, 0); opacity: 0`
  - `.exit-confirm-container.visible .exit-confirm-panel` transitions to `transform: translate3d(0, 0, 0); opacity: 1`

This matches the user report that the bug reappears after opening another UI surface first.

### Finding 4: channel switching recreates the video plane visibility state

`VideoPlayer` explicitly hides and re-shows the actual video element during unload/load/play.

- `src/modules/player/VideoPlayer.ts`
  - initialize: `display = 'none'`
  - `loadStream(...)`: `display = 'block'`
  - `unloadStream()`: `display = 'none'`
  - `play()`: `display = 'block'` if a descriptor exists

This is the strongest direct code-level explanation for why the glitch is easiest to trigger after channel swap: the video plane has just been torn down and reintroduced.

### Finding 5: the codebase already has one explicit path that physically repositions the video element

The EPG startup policy toggles `epg-pip-active` on `#video-container`.

- `src/core/initialization/InitializationStartupPolicy.ts`
  - `onLayoutModeChange('classic')` adds `epg-pip-active`
  - `onLayoutModeChange('overlay')` removes it

That class changes the actual video geometry and animates it:

- `src/styles/video.css`
  - `.video-container.epg-pip-active #lineup-video-player`
  - forces `top`, `left`, `width`, `height`
  - transitions `top`, `left`, `width`, `height`

This is the only confirmed in-repo path that intentionally makes the video "move into place." It is directly relevant to issue 2 and is also the main reason to keep an eye on leaked/stale PiP state while investigating issue 1.

### Finding 6: current automated coverage does not exercise the failure sequence

The targeted suites pass, but they cover isolated flows rather than the reported sequence:

- `src/modules/navigation/__tests__/NavigationCoordinator.test.ts`
  - covers `down` opening OSD
  - covers `back` hiding OSD before exit confirm
  - does not cover `channel switch -> auto OSD -> back -> manual OSD`
  - does not cover `exit confirm cancel -> manual OSD`
- `src/modules/ui/epg/__tests__/EPGComponent.test.ts`
  - covers classic/overlay layout mode and PiP activation/deactivation
  - does not cover non-EPG overlays reopening after a recent video-plane change
- `src/modules/ui/player-osd/__tests__/PlayerOsdCoordinator.test.ts`
  - covers visibility and timer logic
  - does not cover interaction with channel-switch or modal-close timing

## Root-Cause Assessment

### Most likely root cause

Sequence-dependent compositor invalidation around the live video plane.

Why this is the leading hypothesis:

- Channel switch explicitly hides then re-shows the real video element.
- OSD and exit confirm both animate transformed overlay panels over that live video.
- The bug is strongest only after another UI surface was active.
- The bug often disappears on immediate repeat use, which is consistent with a first-frame compositor settle problem rather than a persistent state bug.

Confidence: medium-high

### Secondary hypothesis

Stale or late-cleared PiP video geometry from EPG layout mode contributes to the same class of visual defect.

Why this remains plausible:

- `epg-pip-active` is the only confirmed path that physically moves the video.
- It animates `top/left/width/height`, which is exactly the kind of movement users describe as "video falls into place."
- Issue 2 reproduces in the same EPG/PiP area, so both issues likely share at least one rendering/compositing seam.

Why this is not yet the primary issue-1 diagnosis:

- The reported issue-1 sequences do not require opening the EPG.
- I did not find a direct non-EPG call site that adds `epg-pip-active`.

Confidence: medium

### Lower-probability hypothesis

OSD state/focus registration itself is moving the video.

Why this is weaker:

- `PlayerOsdCoordinator` and `PlayerOsdOverlay` do not touch video geometry.
- Current evidence shows overlay show/hide and focus registration only.

Confidence: low

## Ranked Solutions

### 1. Remove transform-based entry motion from player-screen overlays that sit on top of live video

Recommendation:

- Change the player OSD and exit confirm reveal on player playback paths from `transform + opacity` to either:
  - opacity-only
  - discrete show/hide with no slide motion
  - webOS/player-screen specific reduced-motion variant

Why this ranks first:

- It directly targets the exact sequence that reproduces the bug.
- It is narrow in scope.
- It does not require changing playback state, EPG ownership, or scheduler behavior.
- It also matches the user’s report that "other UI elements being activated in between" is the trigger.

Blast radius: low-medium

Expected payoff: high for issue 1

### 2. Stop animating the real video element’s PiP geometry during EPG classic mode

Recommendation:

- Keep the PiP layout change, but do not transition `top/left/width/height` on `#lineup-video-player`.
- Safer options:
  - snap the real video immediately and animate only a shell/frame
  - animate surrounding HTML chrome while the video jumps instantly
  - if motion is required, animate a separate placeholder/mask instead of the video element itself

Why this ranks second:

- It is the clearest code path that physically moves the video.
- It is a likely direct fix for issue 2.
- It may also eliminate any stale-geometry tail that can bleed into adjacent overlay flows.

Blast radius: medium

Expected payoff: very high for issue 2, possible spillover benefit for issue 1

### 3. Keep the video plane stable across channel switches instead of flipping `display: none/block`

Recommendation:

- Revisit `VideoPlayer` visibility strategy during `unloadStream()` and `loadStream()`.
- Candidate approaches:
  - keep the element mounted and visible while swapping source state
  - hide with opacity or a dedicated overlay instead of `display`
  - delay the first post-switch OSD render until after the first stable playback frame / one or two `requestAnimationFrame` turns

Why this ranks third:

- It directly explains why the bug is easy to trigger after channel swap.
- It is more invasive than the overlay-animation change and needs careful regression testing.

Blast radius: medium-high

Expected payoff: high for channel-switch-triggered issue 1 reproductions

### 4. Add sequence-specific instrumentation and regression coverage before broader tuning

Recommendation:

- Instrument:
  - `video-container.className`
  - `#lineup-video-player` `display`
  - `getBoundingClientRect()` for the video element
  - timestamps around channel switch, OSD hide/show, exit modal close, and EPG open/close
- Add targeted tests for:
  - `channel switch -> auto info banner -> back -> manual OSD`
  - `exit confirm open -> cancel -> manual OSD`
  - no `epg-pip-active` outside active classic EPG visibility

Why this ranks fourth:

- It does not fix the user-visible bug directly.
- It is still important because the current test gap is exactly where the reported bug lives.

Blast radius: low

Expected payoff: high confidence, low immediate user impact

## Standards Check

Context7 docs support the direction of the second recommendation:

- MDN performance guidance says animating geometry/position properties such as `top`, `left`, `width`, and `height` triggers layout/repaint, while `transform` and `opacity` are the preferred cheap animation properties.
- web.dev guidance says modern browsers animate `transform` and `opacity` most cheaply and warns against animating layout-shifting properties.

Important caveat for this bug:

- Those sources describe browser animation cost in general.
- This issue appears to involve a native/composited video plane on TV hardware, where even otherwise cheap overlay transforms can still cause visible plane invalidation after a recent video visibility change.
- So the standards guidance strongly supports removing the EPG PiP geometry transition, but local evidence still favors overlay-motion reduction as the fastest issue-1 mitigation.

## What I Ruled Out

- I did not find any direct OSD code that repositions the video.
- I did not find any direct exit-confirm code that repositions the video.
- The targeted OSD / EPG / navigation suites are not currently failing; this is not an already-covered regression with a broken assertion.

## Recommended Next Debug Pass

1. Add temporary instrumentation around player-screen overlay open/close and video rect/class state on real hardware.
2. Disable OSD + exit-confirm transform entry motion locally and retest the exact user sequences.
3. If issue 1 disappears, keep that mitigation and then independently remove EPG PiP geometry transitions for issue 2.
4. If issue 1 remains, move to stabilizing `VideoPlayer` visibility around channel swaps and capture another hardware repro.

## Current Verdict

- Issue 1 is most likely a player-screen compositor/layering problem triggered by recent overlay activity and recent video-plane visibility changes, not a pure OSD state bug.
- The EPG PiP path is still highly relevant because it is the only confirmed code path that explicitly animates the video element’s position and size, and it likely explains the second issue directly.

## Issue 2 Addendum

### User-Reported Symptom

Opening the EPG causes PiP to lag or stutter. The guide opens, playback freezes briefly, and the user can visibly see the PiP shrink happen during the stutter.

### Findings

### Finding A: EPG open does multiple expensive things immediately

`EPGCoordinator.openEPG()` does all of the following in the open path:

- primes schedules
- shows the EPG
- focuses current channel / now
- schedules an immediate refresh with `debounceMs: 0`

Evidence:

- `src/modules/ui/epg/EPGCoordinator.ts`
  - `preseedCurrentChannelSchedule(...)`
  - `epgInstance.show(...)`
  - `epgInstance.focusNow()`
  - `_refreshEpgSchedulesBestEffort({ debounceMs: 0 })`

### Finding B: EPG show immediately performs render work on open

`EPGComponent.show()` performs synchronous work before the UI settles:

- toggles visible/layout state
- applies layout mode
- recalculates time offset and pixels-per-minute
- refreshes the time header
- calls `renderGridInternal()` immediately
- calls `updateTemporalClasses(...)`
- may call `focusNow()`

Evidence:

- `src/modules/ui/epg/EPGComponent.ts`
  - comment: `Render immediately on open to avoid a blank guide before first input.`
  - immediate `renderGridInternal()`
  - immediate `focusNow()`

### Finding C: render-on-open still includes hot-path work already tracked as performance risk

`renderGridInternal()` still calls `refreshCurrentTime()` and drives visible-cell rendering on each pass.

Evidence:

- `src/modules/ui/epg/EPGComponent.ts`
  - `refreshCurrentTime()`
  - `virtualizer.calculateVisibleRange(...)`
  - `virtualizer.renderVisibleCells(...)`
- `docs/plans/2026-03-04-epg-performance-risk-register.md`
  - baseline evidence explicitly calls out `renderGridInternal()` hot-path work
  - `EPG-PND-004` already tracks removing `refreshCurrentTime()` from the render loop as unfinished work

### Finding D: opening classic EPG also animates the real video into PiP

At the same time the EPG opens, classic layout can add `epg-pip-active`, which animates the actual video element’s geometry:

- `top`
- `left`
- `width`
- `height`

Evidence:

- `src/core/initialization/InitializationStartupPolicy.ts`
  - `onLayoutModeChange('classic')` adds `epg-pip-active`
- `src/styles/video.css`
  - `.video-container.epg-pip-active #lineup-video-player`
  - transitions `top`, `left`, `width`, `height`

This is a near-direct match for the symptom: the guide opens, main-thread work happens, and the user can visibly watch the PiP resize during the same frame window.

## Issue 2 Assessment

This issue is lower ambiguity than issue 1.

Most likely root cause:

- EPG open is coupling synchronous guide work with a real video-geometry transition.
- On weaker TV hardware, the guide render and the PiP shrink compete in the same open path.
- The result is exactly what the user described: a visible stutter before the PiP reaches its smaller target frame.

Confidence: high

## Ranked Solutions For Issue 2

### 1. Stop transitioning the real video element into PiP

Recommendation:

- Snap the video into its PiP rectangle immediately when the classic guide opens.
- If motion is still desired, animate non-video chrome only.

Why this ranks first:

- The current code explicitly animates layout/geometry properties on the actual video element.
- MDN/web.dev guidance already warns that geometry animation is expensive.
- This is the most direct fix for the visible "PiP shrinks during stutter" symptom.

### 2. Defer or split the heavy EPG-open work

Recommendation:

- Separate "show shell" from "full render and focus reconciliation".
- Candidate sequencing:
  - show shell
  - snap PiP
  - next frame: render grid
  - later frame / idle slot: refresh schedules

Why this ranks second:

- The current open path does too much synchronously.
- This would reduce first-open hitching even if the PiP geometry change remains.

### 3. Finish the already-identified EPG hot-path cleanup

Recommendation:

- Tackle `EPG-PND-004` and related EPG render-path cleanup from the performance risk register.
- Keep current-time refresh and other non-essential work off the open-path render when possible.

Why this ranks third:

- It is worthwhile, but it is less direct than stopping the video-geometry transition itself.

## Final Cross-Issue Read

- Issue 1 and issue 2 likely share the same broad class of problem: fragile rendering/compositing behavior around live video when adjacent UI surfaces animate or resize near it.
- Issue 2 has the cleaner causal chain: EPG open currently animates the actual video geometry while also doing synchronous guide work.
- Issue 1 is more sequence-sensitive and likely needs a smaller overlay-animation mitigation first, plus hardware instrumentation to prove the exact trigger.

## Adverse-Effects Analysis By Fix

This section answers a different question than "what is most likely to work?"

It answers:

- what each fix can break
- what visual or UX quality it may reduce
- whether the fix can be narrowed so the current polish is preserved

### Fix 1: Remove transform-based entry motion from player-screen overlays over live video

What this means in plain terms:

- Yes, this is the current OSD slide-up effect.
- It also includes the exit-confirm bottom-sheet rise effect.

Possible adverse effects:

- The OSD can feel less premium or less "broadcast UI" if the slide motion is removed entirely.
- The overlay may feel more abrupt on first appearance, especially when the user presses `Down` or `OK` expecting a smooth panel reveal.
- If changed to opacity-only, the panel can appear to "pop" rather than "arrive," which may look cheaper even if technically stable.
- If changed to immediate show/hide with no motion, the app may feel more mechanical than cinematic on premium TVs.
- If only some overlays lose motion and others keep it, the app can start to feel inconsistent.
- If the OSD motion is removed globally without narrowing the condition, you may lose a perfectly good effect in the common cases where it already behaves correctly.

Behavioral risks:

- If the implementation changes too much of the OSD show/hide lifecycle instead of just the CSS motion, focus timing or auto-hide timing could regress.
- If the visible class timing changes, button focus registration could occur before the panel is visually stable, causing awkward focus-ring timing.

Why this fix can still be product-safe:

- The motion does not have to be removed globally.
- A narrower version is possible:
  - disable the slide motion only on the player screen when playback was just restarted or a modal just closed
  - keep the motion for steady-state playback
  - keep the motion for non-problematic surfaces
  - swap full slide for a smaller-distance slide or opacity-only on the first reopen after a sensitive sequence

Most product-preserving variant:

- Keep the OSD reveal effect in normal steady-state playback.
- Only reduce or remove the slide animation in the sequence-sensitive window after:
  - channel switch
  - exit-confirm close
  - other player-screen overlay transitions

Bottom line:

- This fix does not require permanently killing the OSD slide.
- The crude version removes polish.
- The refined version preserves polish for normal use and only disables the risky motion when conditions suggest the compositor is fragile.

### Fix 2: Stop animating the real video element into PiP for classic EPG

What this means in plain terms:

- The guide can still open in classic PiP layout.
- The likely change is that the video snaps to the PiP box instantly instead of visibly shrinking into it.

Possible adverse effects:

- You lose the smooth "guide opens and video gracefully shrinks" effect if that was intentional product polish.
- An instant snap can feel harsher if the rest of the guide open remains animated.
- If only the video snaps while the guide shell animates, some users may notice a mismatch between the motion of the HTML shell and the motion of the video.
- If the PiP frame or surrounding info panel still animates while the video itself snaps, alignment issues can become more obvious unless the shell timing is tuned carefully.

Behavioral risks:

- If the snap is not synchronized with the guide shell, users may briefly see the PiP appear in its final size before the rest of the guide settles.
- If the video shell and actual video are separated into different moving parts, subtle clipping, border, or focus alignment issues can appear.

Why this fix can still preserve visual quality:

- You do not need to remove the perception of motion.
- You only need to stop animating the real video plane itself.
- Better variant:
  - snap the actual video immediately
  - animate surrounding chrome, mask, frame, or adjacent guide shell
  - preserve the feeling of motion without asking the TV compositor to animate the video geometry

Most product-preserving variant:

- Keep classic EPG PiP as a designed state.
- Preserve motion in the shell around the PiP.
- Stop transitioning the actual `#lineup-video-player` geometry.

Bottom line:

- This fix sacrifices the literal shrinking animation of the real video.
- It does not require sacrificing the overall feeling of an elegant guide transition.
- It is the cleanest trade for issue 2 because the current visible PiP shrink is exactly what users are seeing stutter.

### Fix 3: Keep the video plane stable across channel switches instead of flipping `display: none/block`

What this means in plain terms:

- Instead of tearing the video element fully out of view and re-showing it, keep it mounted/stable and hide transition states another way.

Possible adverse effects:

- Higher risk of showing stale or black video frames during channel switches if the replacement masking is not handled well.
- More chance of exposing intermediate playback states that the current `display: none` logic cleanly hides.
- If a spinner or transition overlay does not fully cover the video at the right times, users may see decoder garbage, stale frames, or half-initialized playback.
- If the video stays composited continuously, overlays that were relying on the video being absent during loading may reveal z-order quirks on webOS.

Behavioral risks:

- This is the most architecture-sensitive fix of the top three.
- It can affect:
  - playback start
  - channel switch
  - error recovery
  - transition overlays
  - subtitle timing on load
  - any code that assumes hidden video during idle/loading

Why this fix is attractive but risky:

- It goes closer to the likely root seam for issue 1 after channel swaps.
- But it changes playback runtime behavior, not just presentation.
- That means larger regression surface and more device-specific QA.

Most product-preserving variant:

- Leave the existing runtime model mostly intact.
- Add a narrow "do not reopen OSD until first stable playback frame" guard before touching broader player visibility behavior.
- Only if that fails, move to the deeper video-plane stabilization work.

Bottom line:

- This fix can preserve all current UI polish if done well.
- It also has the highest chance of causing new playback regressions if done carelessly.
- It should not be the first change unless the narrower overlay fixes fail.

### Fix 4: Add sequence-specific instrumentation and regression coverage

What this means in plain terms:

- This is diagnostic and protective work, not a user-facing change.

Possible adverse effects:

- Temporary instrumentation can add console noise and small runtime overhead during investigation builds.
- If left enabled accidentally, debug logging in hot paths can hurt performance and confuse future debugging.
- New regression tests can become brittle if they assert timing too strictly rather than asserting stable state transitions.

Behavioral risks:

- Very low in production if kept temporary or debug-gated.
- Medium maintenance risk if the tests are written too tightly around implementation details.

Why this fix matters anyway:

- It has the lowest product risk.
- It gives you a way to preserve the nice effects intentionally instead of removing them blindly.
- It is how you distinguish:
  - "the slide effect is inherently broken"
  - from
  - "the slide effect is fine except during one narrow compositor window"

Most product-preserving variant:

- Instrument first.
- Narrow the bad sequence.
- Apply the smallest behavior change that stabilizes only that sequence.

Bottom line:

- This fix does not hurt the user experience directly.
- It is the best prerequisite if preserving the current animation language is a priority.

## Recommendation If Preserving The Current OSD Slide Is Important

If your priority is "do not remove the nice OSD slide unless we absolutely have to," then the best order changes.

Recommended order for that product goal:

1. Instrument the bad sequence first.
2. Try a narrow conditional mitigation for OSD/exit-confirm motion only in the unstable window after channel switch or modal close.
3. Independently remove animated geometry from the real EPG PiP video path, because that one already has a stronger direct case against it.
4. Only touch deeper `VideoPlayer` visibility behavior if the narrower fixes fail.

## Direct Answer To Your Question

Yes, the current OSD slide can very plausibly be preserved.

Why:

- The effect already works correctly in steady-state playback.
- The bug appears tied to a sequence involving other UI activity or recent video-plane change, not to the existence of the slide effect in every case.
- That means the right fix is probably not "kill the animation everywhere."
- The better target is "find the unstable transition window and stop asking the compositor to do that exact combination of work during that window."
