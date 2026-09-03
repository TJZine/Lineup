# LG C3 Post-Implementation Collaborative QA Report (2026-09-02)

## Status

- Overall result: **PASS WITH FINDINGS**
- Primary Channel Builder-to-Guide black-PiP acceptance: **PASS, physically confirmed 2/2**
- Open blocker: **P2 persistent Guide schedule loading reproduced on a 390-channel lineup**
- Target: physical LG C3, `com.lineup.app`, 1920x1080 app target
- Tested source: commit `47bc6a43` plus the pre-existing uncommitted candidate working tree
- Package: `packages/com.lineup.app_1.0.0_all.ipk`
- Package SHA-256: `07a6200b810b2e610d005803b5524bf4cbfe385c1841b313773b8999530c2fe4`
- Candidate tree SHA-256: `3d2a11b6be175d431495214c0629c8bb5975fd154aea3084a9e3c51de50eaf23`
- Runtime/tooling: Node `v24.14.0`, webOS CLI `3.2.5`
- webOS version: not observed
- State handling: existing authentication, selected server, and application data were preserved; no app data was cleared
- Exclusion honored: no burn-in subtitle option was selected
- Stability claim: no dedicated 15-minute or two-hour stability run was performed

The physical TV was authoritative for video visibility, audio, and PiP. DevTools
was used for sanitized timelines, DOM state, media readiness, geometry, and loading
counts. Inspector screenshots containing profile or media metadata were not saved
as repository artifacts.

## Findings

### P2 — Large Guide schedules can remain on `Loading...` indefinitely

- Area: Guide schedule refresh, large-lineup traversal, and relaunch recovery
- Fixture dependency: the issue did not appear during a complete traversal of the
  fresh 189-channel lineup. It reproduced after replacing it with a 390-channel
  stress lineup.
- Dense traversal behavior:
  - transient row-level loading first appeared at varying positions, including
    around channel 112 and later in the lineup;
  - early occurrences resolved in roughly 3–4 seconds;
  - an instrumented late batch peaked at nine loading cells; eight resolved, but
    the final focused cell remained loading;
  - on channel 341, that focused placeholder was unchanged at 0, 36, 68, 126, and
    184 seconds while adjacent rows were populated.
- Cold relaunch behavior:
  - the app was closed and relaunched without reinstalling or clearing data;
  - opening Guide near the beginning produced six loading cells across visible
    channels 1–9 and no focused program cell;
  - counts remained six at 0, 37, 69, 126, and 183 seconds;
  - PiP media itself was healthy (`readyState 4`, 672x378) and fullscreen playback
    remained visible and audible when the Guide was closed.
- Recovery: closing Guide and reopening it populated the rows in about one second,
  reduced loading cells to zero, and restored focus.
- Expected: every valid persisted channel should resolve a schedule, or expose an
  explicit recoverable failure/retry state. A settled failure must not remain
  represented as active loading with no usable focus.
- Actual: one or more rows can remain indefinitely on `Loading...`; after relaunch,
  the initial Guide can remain partially unusable until the user closes and
  reopens it.
- Frequency: reproduced both during dense traversal and after one full app relaunch.
- Evidence: [sanitized loading checkpoints](../evidence/2026-09-02-lg-c3-collaborative-qa/guide-loading-checkpoints.json)
- Disposition: open. See the separate [Guide schedule recovery remediation handoff](../../plans/2026-09-02-guide-schedule-loading-remediation-handoff.md).

### P3 — Guide navigation feedback visibly lags under queued input

- Area: Guide D-pad and paging performance
- Actual: vertical and horizontal movement could take noticeable time to catch up
  with repeated remote presses. The user observed the Guide processing queued
  input after presses stopped.
- Integrity result: no lost vertical input was established. A normal ten-press
  move settled from channel 6 to 16; a rapid ten-press move settled exactly from
  16 to 26. Ten Channel Down presses advanced from 26 to 76 at five rows per page.
  Focus remained visible and landed on a real cell after settling.
- Horizontal control: a deliberate Right press moved focus from program 1 to
  program 2 of the row with no loading state.
- Severity rationale: interaction remains functional and deterministic, but the
  delayed feedback is perceptible on the physical TV.
- Disposition: record as a performance follow-up; do not conflate it with the P2
  missing-schedule failure.

## Primary Acceptance — Channel Builder Done to Guide PiP

Two authorized 189-channel builds completed and transitioned through Player into
Guide. Both runs produced visible, audible PiP on the physical LG C3, visible Guide
focus, no stuck message or transition overlay, and healthy subsequent channel
selection and Guide reopen/close behavior.

Both runs briefly exposed fullscreen Player and Player OSD before Guide opened.
The flash was short-lived and is consistent with the candidate's provisional
Player reveal; it did not produce persistent black PiP or lost audio.

| Attempt | Switch settled | Playback started | Guide shown | PiP presented | Attempt settled |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 642 ms | 1,341 ms | 2,199 ms | 2,201 ms | success at 2,485 ms |
| 2 | 650 ms | 1,063 ms | 1,610 ms | 1,621 ms | success at 2,114 ms |

The complete sanitized sequences are in
[builder transition evidence](../evidence/2026-09-02-lg-c3-collaborative-qa/builder-transition-attempts.json).

Acceptance label: **Physically confirmed: visible/audible PiP in 2/2 builder completions.**

## Builder and Review Results

### Attempt 1

- Review: `390 → 189`; 172 stay, 218 leave, 17 new.
- Categories: Collections 78, Genres 40, Directors 34, Decades 13, Studios 12,
  Actors 10, Recently Added 2.
- Review timing: unavailable because the workflow had already advanced before the
  timestamp could be captured.
- Build milestones: approximately 25% by 13:22:14 EDT, 50% at 13:22:37, 75% at
  13:23:02, complete at 13:23:12.906.
- Measured duration: approximately 59.9 seconds from the first confirmed build
  observation.
- Result: created 189 channels; 1,939 candidates not created.

### Attempt 2

- Review: `189 → 189`; all 189 stay. Category counts matched Attempt 1.
- Build start: 17:31:46.677Z.
- Milestones: 25% at 17:31:57.974, 50% at 17:32:36.462, 75% at
  17:33:03.569, Guide refresh at 17:33:08.402, completion at 17:33:09.997.
- Measured duration: approximately 83.3 seconds.
- Result: created 189 channels; 1,939 candidates not created.

### Loading stress build

- Purpose: restore the scale of the prior 390-channel fixture after the
  189-channel lineup completed a full Guide traversal without loading failures.
- Result: created 390 channels; 1,938 candidates not created.
- Timing: not recorded from build start; no duration claim is made.
- This third build was diagnostic only and is not counted toward the 2/2 black-PiP
  acceptance result.

The user had previously validated the Channel Setup rail/control behavior and
reported no changes in that area. The bounded setup-navigation matrix was not
repeated in full during this session. Review and Build completed without a visible
error.

## Guide Regression Results

- Vertical navigation through ten adjacent rows: pass.
- Rapid vertical burst: pass with visible lag; focus settled correctly with all
  ten inputs retained.
- Horizontal current/future navigation: pass.
- Channel Up/Down paging: pass; five rows per page and stable focus.
- Shared now line: present.
- Current/past clipped geometry: visually truthful in sampled rows.
- Per-cell bottom progress bars: absent.
- Fitting focused title after ticker delay: no ticker running.
- Naturally overflowing title: not isolated as a dedicated measured case.
- Program details/artwork updates: no stale content observed.
- Clear-logo presentation/text fallback: readable in sampled rows.
- Past Items labels: `Current slot`, `At least 15 min`, and `At least 30 min`
  displayed exactly; closing the dropdown returned focus to Past Items.
- Complete 189-channel forward traversal: zero visible loading rows.
- 390-channel traversal and relaunch: failed as documented in the P2 finding.

## Playback and Lifecycle Smoke

- Movie-derived playback: pass.
- TV-derived playback: pass on numeric tune to channel 342.
- Additional channel switches with CH +/CH −: pass with healthy audio/video.
- Pause/resume: not applicable; the app intentionally exposes live-TV behavior
  without pause/play controls.
- First and second Player OSD reveals after Settings: pass; no video shift or resize.
- Full Now Playing overlay and transition to Playback Options: pass.
- Ordinary subtitle/audio inspection: pass. Subtitles were Off with none available;
  two ordinary audio choices were focusable. No selection changed.
- Guide open/close and Settings open/close: pass.
- Back, Guide, Info, Channel Up, and Channel Down: pass. Info opened Server
  Selection and Back restored playback with the current server retained.
- Full app exit/relaunch without clearing data: persisted lineup and playback state
  returned; this action reproduced the Guide-loading P2.
- Background/resume: pass; channel 342 resumed with active video/audio and the
  prior Guide surface preserved.
- Final media state: `readyState 4`, not paused, not ended, no media error.
- Direct Play/HLS/transcode, HDR, and Dolby Vision: not claimed; no authoritative
  diagnostic comparison was captured for those dimensions.

## Cleanup and Residual Risk

- `Debug Logging` was restored to Off (`lineup_debug_logging = "0"`).
- `Subtitle Debug Logging` remained at its default/off state.
- The app was left in normal playback with the 390-channel lineup.
- No production source, tests, runtime configuration, credentials, or Plex state
  were modified by this QA closeout.
- No dedicated long-duration stability run was performed.
- The primary black-PiP change is accepted, but release confidence remains
  constrained by the independently reproduced P2 Guide schedule recovery defect.

## Verification

- Pre-package `npm run verify`: pass; 4,585 main tests, 52 tool tests, 94 contract
  tests, plus docs, bundle, and build gates.
- Pre-package `git diff --check`: pass.
- Install and launch on physical LG C3: pass.
- Closeout documentation verification is recorded in the final task response.
