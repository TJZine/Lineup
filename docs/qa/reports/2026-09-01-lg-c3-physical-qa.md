# LG C3 Physical QA Report and Remediation Handoff (2026-09-01)

## Status

- Overall result: **PASS WITH FINDINGS (interim)**
- Target: physical LG C3, app ID `com.lineup.app`, 1920x1080 app target
- Tested commit: `e648143c` plus the uncommitted working-tree changes listed by `git status`
- Package version: `1.0.0`
- Runtime/tooling baseline: Node `v24.14.0`, webOS CLI `3.2.5`
- Inspector: connected to the physical app during the recorded observations
- Authentication/state: existing Plex authentication and configured libraries were preserved; no credentials, tokens, PINs, or private server identifiers were recorded
- webOS version: not observed; do not infer it from the LG C3 model
- Duration: the QA work was split across several interactive sessions and was not continuously timed. The measured 390-channel build took about 2m35s. No long-duration stability claim is made.

This is a durable snapshot of the physical-device QA findings and the agreed implementation direction. It is intentionally explicit about unverified hypotheses and incomplete reproductions so a new orchestration session can continue without treating them as proven causes.

## Findings

### P2 — Burn-in subtitle startup fails and leaks into later playback

- Area: Playback / subtitles
- Reproduction:
  1. Start playback on the physical LG C3.
  2. Select the burn-in subtitle option.
  3. Observe the playback surface and startup status for about 10 seconds.
  4. After it fails, switch to a different program/channel without selecting burn-in again.
- Expected: Burn-in playback starts successfully, or fails with a recoverable error. A per-playback subtitle choice must not silently apply to another program/channel unless the product explicitly presents it as a persistent preference.
- Actual: The screen turns black, a status indicating burn-in is starting appears, and startup fails after roughly 10 seconds. Switching to another program/channel retriggers burn-in even though it was not selected there.
- Frequency: observed once for the initial failure and once for the cross-program retrigger.
- Reproduced twice: no.
- Evidence: physical-TV observation and user report. Exact on-screen wording and a screenshot were not captured; do not quote a more exact message than this report provides.
- Status: confirmed behavior; root cause not investigated in this session.

### P2 — Guide PiP is black with audio after completing Channel Builder

- Area: Channel Builder → playback → Guide lifecycle
- Reproduction:
  1. Complete a lineup build.
  2. Select Done and allow the application to enter the Guide.
  3. Observe the PiP on the physical TV.
- Expected: The newly started channel is visible and audible in Guide PiP.
- Actual: Audio plays, but the PiP remains black. Selecting a channel restores video; subsequent Guide opens from established playback show working PiP.
- Frequency: 1/1 observed Channel Builder completion path.
- Reproduced twice: no.
- Control case: opening Guide from already-established playback works. A split-second black frame during video resize was observed there and is distinct from the persistent builder-path defect.
- Evidence: [Guide capture](../evidence/2026-09-01-lg-c3/03-guide-progress-and-pip.png). DevTools reported an advancing, unpaused video (`readyState: 4`, 3840x1604 dimensions, no media error) with PiP geometry applied. The inspector screencast cannot prove the LG hardware video plane; the persistent black PiP itself was confirmed on the physical TV.
- Suspected cause: first-frame/hardware-plane readiness race. `ChannelSetupBuildStepPresenter` waits for channel-switch settlement and immediately opens EPG, but that settlement does not prove that a decoded frame has painted. This is plausible, not proven.

### P2 — Focused-title ticker activates for text that easily fits

- Area: Guide / focused program-cell ticker
- Reproduction:
  1. Open the Guide with a current program that started before the visible grid anchor.
  2. Focus a wide program cell with a short title; the captured case is `Fight Club`.
  3. Wait for the 900ms ticker delay.
- Expected: A title that fits remains stationary and continuously readable. Ticker animation activates only when the actual rendered text exceeds its visible title viewport.
- Actual: The short title begins ticker animation despite having more than enough space. During the captured animation it moves completely outside its clipping viewport, leaving the focused cell temporarily without a title.
- Frequency: reproduced in two consecutive focused states. The captured `Fight Club` title measured about 105px inside a 1320px viewport. A later `Black Sails` state measured a 113px title and 20px episode subtitle inside 521px viewports; both were incorrectly armed with the same 154.09px distance.
- Reproduced twice: yes, across a movie title and a later episode title/subtitle state.
- Evidence: [False ticker capture](../evidence/2026-09-01-lg-c3/05-fight-club-false-ticker.png). Live target measurements showed approximately 105px of title content inside a 1320px title viewport. Nevertheless, the viewport had both `epg-cell-title-ticker-ready` and `epg-cell-title-ticker-running`, with a 154.09px ticker distance and 3200ms duration.
- Confirmed calculation defect: the 154.09px false overflow matches the focused cell's `textShiftPx`. `EPGCellRenderer` calculates content width as `max(content.scrollWidth, viewport.scrollWidth)` while `getEffectiveTickerClientWidth()` subtracts `textShiftPx` from the viewport width. In the captured case the viewport's ordinary 1320px scroll width is treated as content width, the usable width is reduced to about 1166px, and the difference is incorrectly classified as title overflow even though the title itself is only 105px wide. The same shared calculation also falsely armed the later episode subtitle.
- Test gap: the existing fitting-movie regression starts at the grid anchor and therefore exercises `textShiftPx = 0`; it does not cover a fitting title in a left-clipped/current cell with a positive text shift.
- Recommendation: derive ordinary single-line overflow from the actual text content width versus the actual visible text capacity. Preserve a separate measurement path only where ready-state CSS is genuinely needed to expose clamped multiline content. Add positive-shift fitting/overflow boundary tests before changing the helper.

### P2 — Selected movie schedules remain on `Loading...` indefinitely after app relaunch

- Area: Startup / Guide schedule recovery / movie-derived channels
- Observation date: 2026-09-02, using the persisted 390-channel lineup from the prior physical-device session
- Reproduction:
  1. Relaunch the installed app on the physical LG C3 without clearing persisted data.
  2. Open the Guide near the beginning of the lineup.
  3. Observe movie-derived rows while neighboring schedules resolve.
  4. Leave the Guide open for several minutes.
- Expected: every valid persisted movie channel resolves a schedule. A failed load should enter an explicit recoverable error state and retry safely rather than appearing to load forever.
- Actual: multiple movie rows remain on `Loading...` indefinitely while adjacent movie rows display valid programs. The captured view showed persistent placeholders on visible channels 11, 12, and 15, with additional affected rows partly below the viewport.
- Frequency: one cold-relaunch occurrence. Live inspection found six persistent loading cells among 13 rendered program cells.
- Reproduced twice: the same six placeholders were confirmed in two live measurements five seconds apart after the user had already observed them for several minutes; a second independent app relaunch has not been performed.
- Evidence: [Persistent movie loading capture](../evidence/2026-09-01-lg-c3/06-persistent-movie-guide-loading.png), captured directly from the physical app target at 1920x1080. The affected rows coexist with successfully populated rows 13 and 14, ruling out a whole-Guide loading state.
- Diagnostics:
  - DOM remained bounded at 13 program cells and 557 total elements; this is not evidence of virtualizer growth.
  - No fetch request had completed in roughly 22 minutes at inspection time, so the placeholders were not backed by continuing network work or an active retry.
  - Debug logging was disabled and the issue-diagnostic log contained no EPG entries, so the original channel-resolution exception is unavailable for this occurrence.
  - In the current failure path, `_refreshChannelSchedule()` increments/report diagnostics but does not publish an error schedule, retry state, or retry timer. The schedule remains absent, and the virtualizer continues rendering the missing row as `Loading...`.
- Status: confirmed P2 user-facing recovery defect; the underlying reason those particular movie channels failed to resolve remains unknown.
- Recommendation:
  1. Reproduce once with sanitized debug diagnostics enabled before changing behavior and capture `epg.scheduleLoadFailed`, resolution stage, strategy type, attempt count, and elapsed placeholder age without channel/Plex identifiers.
  2. Distinguish `loading`, `failed/retrying`, and terminal `unavailable` schedule states. Never leave a settled failed request represented as active loading.
  3. Automatically retry visible failed rows with a small capped exponential backoff and cancellation tied to the existing refresh operation. Prevent request storms and reset the backoff after a successful resolution.
  4. Give the focused failed row an explicit retry action/status while keeping Guide navigation usable.
  5. Add regression tests for immediate resolution failure, visible retry success, capped repeated failure, supersession/cancellation, and mixed successful/failed adjacent rows.

### P3 — Current-program progress bars disagree with the shared now line

- Area: Guide / EPG time geometry
- Reproduction:
  1. Open the Guide while several programs are in progress.
  2. Compare the endpoint of each current-program bottom progress bar with the vertical now line.
- Expected: If both indicators represent the current instant, they align to the same x-coordinate across every row.
- Actual: Progress endpoints differ by row and do not align with the now line.
- Frequency: visible across multiple rows in the captured Guide view.
- Reproduced twice: not yet recorded in a second Guide view.
- Evidence: [Guide timing capture](../evidence/2026-09-01-lg-c3/03-guide-progress-and-pip.png). Live DOM measurement showed current cells sharing x=261 while their fills ended at different positions. One example was a 7:42–10:05 program with a shortened visible cell width of about 1142.7px and a 49.46% fill ending around x=825.7.
- Confirmed cause: `EPGScheduledRowCollector` clamps negative program offsets to zero and shortens the rendered cell, while `getProgressFillWidth()` applies whole-program elapsed percentage to that shortened visible width.

Locked UX recommendation:

1. Keep one shared time axis and the now line.
2. Preserve each program's true left offset and full duration width, including negative left positions, and let the existing viewport overflow/edge mask clip it.
3. Remove the redundant per-cell bottom progress bars.
4. Keep start/end and duration in the focused detail panel.
5. Keep configurable lookback and D-pad time navigation; do not stagger rows independently.
6. Rename lookback choices to truthful slot language such as `Current slot`, `At least 15 min`, and `At least 30 min`.

The recommendation follows TV guidance favoring clear, uncluttered ten-foot interfaces and predictable four-way focus: [LG design principles](https://webostv.developer.lge.com/develop/guides/design-principles), [LG app self-checklist](https://webostv.developer.lge.com/distribute/app-self-checklist), [LG Magic Remote](https://webostv.developer.lge.com/develop/guides/magic-remote), [Android TV design](https://developer.android.com/design/ui/tv/guides/foundations/design-for-tv), [Android TV focus](https://developer.android.com/design/ui/tv/guides/styles/focus-system), [Apple layout](https://developer.apple.com/design/human-interface-guidelines/layout), and [Apple progress indicators](https://developer.apple.com/design/human-interface-guidelines/progress-indicators).

### P3 — Selected Settings toggles show inconsistent white outlines

- Area: Settings / all tabs using shared toggle controls
- Reproduction:
  1. Open Settings → Audio & Subtitles.
  2. Move focus away from selected On toggles.
  3. Compare the selected toggles with dropdown-style controls.
- Expected: A selected but unfocused toggle uses the same neutral selected surface as comparable controls. Only the focused element receives the strong orange focus treatment.
- Actual: Selected, unfocused toggles display conspicuous white borders. The behavior appears on other Settings tabs using the shared control.
- Frequency: visible on both top toggles in the captured Audio & Subtitles screen and reported on other tabs.
- Reproduced twice: yes, across multiple controls/tabs by shared styling.
- Evidence: [Settings border capture](../evidence/2026-09-01-lg-c3/04-settings-selected-border.png). Both controls had class `setup-toggle selected focusable`, were not focused, and computed to a white border with transparent background.
- Confirmed cause: `.setup-toggle.selected` references missing `--onboarding-accent-alpha-20` and `--onboarding-accent-alpha-60` variables, causing invalid-at-computed-time values and native-looking fallback rendering.
- Current implementation status: an uncommitted shared Settings override removes the white outline from selected, unfocused toggles while preserving the orange focused state. Automated verification exists in `src/styles/__tests__/settings-control-selected-state.test.ts`; physical-device confirmation is still required after deployment.

### P3 — Build completion label “Skipped 1939” is misleading

- Area: Channel Builder completion summary
- Reproduction:
  1. Build the reviewed 390-channel lineup.
  2. Read the completion summary.
- Expected: The summary distinguishes filtered/excluded candidates from failures to create planned channels.
- Actual: It reports `Skipped 1939`, which reads like 1,939 build failures. Source inspection indicates this primarily represents candidate categories rejected by minimum-item and planning limits.
- Frequency: 1/1 recorded build.
- Reproduced twice: no.
- Evidence: [Build completion capture](../evidence/2026-09-01-lg-c3/02-build-complete-390.png).
- Recommendation: current source shows the counter mixes planning exclusions with
  planned channels not attempted because of capacity or cancellation. Use the
  deliberately generic `Created N channels. N candidates not created.` in this UI
  bundle. Splitting the total by reason requires a separate core result-contract
  change; do not call the mixed total `failed` or `excluded`.

### P3 — Past Items labels understate the actual lookback interval

- Area: Guide Settings
- Reproduction: choose the available Past Items options and compare the label with the slot-rounded Guide anchor.
- Expected: labels describe the interval users can actually see.
- Actual: the anchor floors to a 30-minute slot, so `Now (0m)` can expose 0–29 minutes, `15m` can expose 15–44 minutes, and `30m` can expose 30–59 minutes.
- Frequency: deterministic from the current calculation.
- Reproduced twice: source-confirmed; physical option-by-option capture pending.
- Evidence: code-path inspection of `EPGCoordinatorPolicies`; no dedicated screenshot.
- Recommendation: use `Current slot`, `At least 15 min`, and `At least 30 min`.

### P3 — Clear-logo artwork can be too small for ten-foot readability

- Area: Player OSD, Guide information panel, and Now Playing information overlay
- Reproduction:
  1. Play an item with Plex `clearLogo` artwork.
  2. Reveal the player OSD and compare the logo with the ordinary title-text size.
  3. Open Guide and inspect the same logo in the information panel.
- Expected: clear-logo artwork remains comfortably legible at 1920x1080, preserves its aspect ratio, and falls back to the text title when width constraints make the logo too short to read.
- Actual: logos can render noticeably smaller than surrounding title treatments. The surfaces apply inconsistent caps and minimum-usability checks.
- Frequency: observed in the player OSD and intermittently in Guide; one Guide instance was measured directly.
- Reproduced twice: not with a controlled two-item matrix.
- Evidence: the `Fight Club` artwork in the [false ticker capture](../evidence/2026-09-01-lg-c3/05-fight-club-false-ticker.png). Its Guide source was 232x84 with nontransparent pixels reaching all image edges, so transparent outer padding did not cause this instance. The Guide constrained it to a 54px-tall visual. The loaded player-OSD logo measured about 216x48 from a 1750x389 source.
- Confirmed policy inconsistency:
  - Player OSD: `max-height: 48px`, `max-width: 520px`, and accepts a rendered height of only 24px.
  - Guide: `max-height: 54px`, `max-width: 520px`, and has no loaded-size usability fallback.
  - Now Playing information: `max-height: 84px`, `max-width: 520px`, and accepts a rendered height of 32px.
- Recommendation:
  1. Define role-specific target heights at the 1080p design resolution: approximately 56–64px for the compact player OSD, 64–72px for Guide, and 84px for the full Now Playing information overlay.
  2. Give each logo a definite target height with `width: auto`, retain a surface-appropriate `max-width`, use `object-fit: contain`, and anchor it to the left. Do not use `min-width`, stretch the image, or upscale both dimensions independently.
  3. On image load, calculate the effective contained-art height from its natural aspect ratio, target height, and available max width. If a very wide logo would render below a shared readable floor (proposed 44–48px at 1080p), hide it and retain the text-title fallback.
  4. Do not rely on the outer `<img>` box height alone: a fixed/stretched box can be tall while `object-fit: contain` paints substantially shorter artwork inside it.
  5. Add a physical matrix covering wide, ordinary, narrow, low-resolution, broken, and missing clear-logo assets in all three surfaces. Defer pixel-alpha-bound analysis unless transparent-padded assets are actually found; the captured example does not justify that complexity.

### P3 — Deep navigation into dense TV channels exposes Guide loading

- Area: Guide schedule loading / dense TV-derived channels
- Reproduction:
  1. Use the 390-channel lineup on the physical C3.
  2. Navigate well beyond the initially visible/warmed channels into the dense TV-derived portion around channel 150 or later.
  3. Observe program cells while paging/scrolling into previously unseen rows.
- Expected: directional prefetch keeps nearby rows ready, or any cold-row placeholder resolves quickly enough that normal D-pad/page navigation does not visibly stall.
- Actual: the Guide displayed loading while reaching dense TV channels around channel 150+.
- Frequency: observed once during this exploratory pass.
- Reproduced twice: no.
- Evidence: physical-TV/user observation. The transient loading state had cleared before inspection; no screenshot or exact duration was captured. Post-event inspection found no currently visible loading element, 22 program cells across about nine virtualized rows, and 813 total DOM elements, so there is no evidence of unbounded Guide DOM growth in this instance.
- Source-supported explanation, not yet a proven runtime cause:
  - A row with no loaded schedule is intentionally rendered as `Loading...`.
  - For a 390-channel guide, the non-aggressive very-large-guide policy limits background warming to 96 queued channels at concurrency 1.
  - The schedule cache is capped at 240 entries, while the initial warm window is substantially shallower than channel 150.
  - A cold TV-derived channel can require content resolution across multiple show episode lists before its schedule is generated. Historical resource timing contained numerous successful `allLeaves`/collection-child requests, but they predated this observation and cannot be attributed to the specific loading event.
- Recommendation:
  1. Reproduce from a cold app/Guide state with diagnostics enabled and record placeholder time-to-first-schedule at channel ranges 1–20, 90–110, 140–170, and 250–280.
  2. Record strategy/source type, resolved-item count, cache hit/miss, queued/in-flight work, aborts, and visible-row readiness without logging Plex identifiers or URLs.
  3. Prefer a sliding, direction-aware warm window that advances during sustained paging over preloading all 390 schedules or simply raising concurrency on the C3.
  4. Confirm whether dense TV channels are repeating show episode resolution that could safely reuse existing channel materialization/index data.
  5. Retain bounded virtualization and cancellation. Optimize the cold schedule/content seam only after timing identifies it; do not remove backpressure or increase cache/concurrency blindly.

### P4 — `showCurrentTimeIndicator` is inert configuration

- Area: Guide configuration / maintainability
- Reproduction: inspect the configuration consumer and indicator creation path.
- Expected: the option controls current-time indicator creation, or it does not exist.
- Actual: the indicator is always created and production code does not read the setting.
- Frequency: deterministic.
- Reproduced twice: not applicable.
- Evidence: source inspection of `EPGGridRuntimeController`; no user-facing failure was observed.
- Recommendation: delete the inert option unless a supported hidden-now-line mode is explicitly required.

## Successful Physical Flows

- Existing authenticated/configured state survived deployment and relaunch; onboarding and persisted state were not reset.
- Review completed successfully on the rebuilt package.
- Review produced 390 channels: Collections 186, Genres 99, Directors 34, Decades 34, Studios 24, Actors 10, Recently Added 3.
- A private local Plex count probe independently matched the actor/director totals without exposing server details: actors 9 movie + 1 TV = 10; directors 9 movie + 25 TV = 34.
- The 390-channel lineup build completed in about 2m35s.
- The new lineup opened in Guide after completion.
- Selecting a channel restored visible playback; later Guide opens from playback showed working PiP.
- The dropdown-only Step 2 remote behavior was physically confirmed for the tested control.
- Variant expansion policy and actor/director exclusions were reflected in the successful review totals.
- No uncaught console errors or warnings were observed during the successful build.

Evidence:

- [Review summary](../evidence/2026-09-01-lg-c3/01-review-390-channels.png)
- [Build completion](../evidence/2026-09-01-lg-c3/02-build-complete-390.png)

## Previously Observed Regressions Resolved in the Current Working Tree

These should remain regression tests but should not be filed again as open findings unless they recur after the next package deployment:

- Initial PIN entry did not receive focus until a physical number/Magic Remote action.
- The Step 2 estimate panel could remain on `Estimating channels` indefinitely and contributed substantial onboarding lag.
- Review failed with `Unable to prepare your review`.
- Movie actor/director count recovery generated an O(number of people) request storm.
- Left/Right changed dropdown-backed onboarding settings and could interfere with returning to the category rail.
- Focused orange action buttons darkened without changing their text to white.
- Variant expansion also affected alternate replicas and actor/director channels.

The package fix also disables a second Terser minification pass in `ares-package`; the prior Terser 4.8.1 pass corrupted already-built JavaScript and caused runtime Review failures.

## Skipped or Incomplete Coverage

- Actual webOS version was not visible.
- Authentication, sign-out, server deletion/reselection, app-data reset, and onboarding reset were intentionally not exercised.
- Retry/error recovery for unavailable Plex servers was not intentionally induced.
- Full remote matrix (Back, Guide, Info, channel up/down) is incomplete.
- Representative multi-channel playback, pause/resume, audio selection, non-burn-in subtitle modes, Direct Play/HLS/transcode comparison, HDR, and Dolby Vision remain incomplete.
- Background/resume and app exit/relaunch need a structured replay after the next deployment.
- The Channel Builder black-PiP path and burn-in failure have not yet been reproduced twice with synchronized logs.
- No two-hour keep-alive run was performed.
- Inspector screenshots do not capture LG's protected/hardware video plane reliably; physical-TV observation is authoritative for whether video was visible.

## Orchestrator Handoff Packages

Keep these as separate bounded units unless discovery proves they share an owner. Preserve all existing Plex state and use the physical LG C3 for final proof.

For the next deterministic UI remediation bundle, use the active
[`LG C3 Deterministic UI Remediation Orchestrator Handoff`](../../plans/2026-09-02-lg-c3-ui-remediation-orchestrator-handoff.md).
That plan includes Guide correctness/ticker, Settings styling, clear-logo
legibility, and Channel Builder completion semantics. It deliberately excludes
Packages A, B, and G below because burn-in subtitles, Channel Builder-to-Guide
black PiP, and Guide schedule loading each require a dedicated interactive
physical-device investigation.

### Package A — Burn-in subtitle failure and state leakage

- Skills/boundaries: debugging remediation, Plex integration boundaries, persistence boundaries, TypeScript quality/test design.
- First prove where burn-in selection is stored and why it survives a program/channel switch.
- Capture sanitized console/network lifecycle evidence and the exact visible failure text; never log tokens or stream URLs containing secrets.
- Add regression coverage for both startup failure recovery and per-playback state isolation.
- Verify on the physical C3 with one failure reproduction and one clean channel switch.

### Package B — Channel Builder → Guide first-frame readiness

- Skills/boundaries: debugging remediation, UI composition, playback lifecycle, TypeScript quality/test design.
- Instrument the existing switch outcome, media events, PiP class/geometry, and first rendered-frame seam before changing timing.
- Do not fix with an arbitrary delay. Gate Guide/PiP presentation on the smallest truthful playback-readiness signal or defer Guide opening until playback can paint.
- Compare fresh-builder completion twice against normal Guide-from-playback twice.

### Package C — Guide time model cleanup

- Skills/boundaries: UI composition, TypeScript quality/test design.
- Implement the locked model above: true program geometry, viewport clipping, no per-cell progress bars, retained now line, truthful lookback labels.
- Correct false-positive focused tickers in the same owner area. Cover fitting and overflowing movie/episode titles and episode subtitles at zero and positive `textShiftPx`, including left-clipped programs. Fitting text must never receive ready/running classes or ticker CSS variables.
- Do not introduce staggered rows, an alternate guide mode, a new feature flag, or continuously updating detail text.
- Add geometry and D-pad focus regression tests, then validate at 1920x1080 with rapid scroll and DOM-budget checks.

### Package D — Settings selected-state styling

- Current code/test change is already present but uncommitted.
- Complete full verification, package/deploy, and physically inspect every Settings tab.
- Confirm selected-unfocused toggles have no outline, focused controls retain a clear orange ring/surface with white text, and disabled controls remain distinguishable.

### Package E — Completion semantics and inert Guide configuration

- Replace `Skipped` with `N candidates not created`; source inspection confirms the
  total mixes planning exclusions with planned channels not attempted because of
  capacity or cancellation.
- Preserve the numeric result and planner/executor behavior. A future reason split
  belongs in a separate core result-contract task.
- Remove `showCurrentTimeIndicator` if no supported consumer exists.

### Package F — Clear-logo legibility contract

- Skills/boundaries: UI composition and TypeScript/CSS test design.
- Establish the shared readable-height contract while keeping role-specific target heights for compact OSD, Guide, and full Now Playing information.
- Centralize only the sizing/fallback calculation; keep each surface's layout dimensions in its owning stylesheet.
- Extend existing load/error/tiny-logo tests with wide-logo max-width cases and Guide fallback coverage.
- Validate all three surfaces on the physical C3 at 1920x1080. Do not accept a large element box as proof; visually confirm the contained artwork itself.

### Package G — Deep Guide schedule-loading performance

- Skills/boundaries: debugging remediation, UI composition, TypeScript quality/test design, and verification strategy.
- Begin with a read-only timed trace on the C3; keep channel/source identifiers sanitized.
- Treat the persistent cold-relaunch movie-row failure and transient deep-TV loading as adjacent but separate hypotheses. Fixing warming must not mask a settled channel-resolution failure, and adding retries must not create a deep-guide request storm.
- Separate schedule-cache misses, channel-content materialization, Plex episode-list work, schedule generation, and render latency.
- Add an explicit schedule failure/retry state so a settled failure cannot remain visually indistinguishable from active loading.
- Use the range matrix in the finding and compare cold forward navigation, immediate reverse navigation, and a warmed repeat.
- If confirmed, implement the smallest owner-level fix: likely directional warming or reuse of already-materialized TV channel content. Preserve cancellation, cache bounds, and visible-range priority.
- Add deterministic tests for sustained page navigation beyond the initial 96-channel warm range and a performance assertion based on work/count boundaries rather than wall-clock Jest timing.

## Verification Expectations for the Next Session

- Start with `git status --short` and preserve unrelated user files.
- Run focused tests for each bounded package while iterating.
- Run `npm run verify` for every UI, navigation, Plex, build, or runtime package.
- Run `npm run verify:docs` after updating this report or user-facing guidance.
- Inspect the final diff and independently review each high-risk runtime package.
- Package with the repository's current supported Node version and webOS CLI 3.2.5; Node 22.23.2 is no longer a project requirement.
- Redeployment may disconnect DevTools. Reuse/reconnect one inspector rather than opening duplicates.

## Verification Recorded for This Snapshot

- `npm run verify`: PASS after the report, evidence, and Settings selected-state change were added.
- Main Jest coverage run: 346/346 suites; 4,549 passed, 0 failed, 1 skipped.
- Tool tests: 6/6 suites; 52 passed, 0 failed, 1 skipped.
- Contract tests: 6/6 suites; 94 passed.
- TypeScript, architecture/maintainability checks, CSS lint, documentation structure, bundle verification, and development build all passed.
- Physical validation of the Settings selected-state change remains pending because this snapshot has not yet been redeployed to the C3.

## Deterministic UI Remediation Validation (2026-09-02)

The active deterministic remediation bundle was packaged, installed, and relaunched
on the same physical LG C3 without clearing application data or changing the
persisted lineup. The final package candidate tree SHA-256 was
`a175cace7ca6247c45404648bdb2f867786f7e87984b34a93ec3a52e80654f14`.

Observed physical/inspector results:

- Guide program cells retain their full duration widths and negative pre-anchor
  positions. In the recorded state, seven rendered cells had negative left
  positions while retaining widths from about 1054px to 2115px; the existing
  viewport mask clipped them.
- The shared now line was present inside the 1660px program viewport. No
  `.epg-cell-progress` or `.epg-cell-progress-fill` nodes remained.
- A focused current cell with a positive 537.6px text shift had about 155.8px of
  title content in 1339px of visible capacity. After the ticker delay it had no
  ready/running class, distance, duration, or animation.
- Physical inspection exposed that inline title spans report `scrollWidth = 0`
  on the C3 while their rendered rectangles remain truthful. The implementation
  was corrected to use the rendered content rectangle; focused regression tests
  cover fitting and overflowing movie and episode title/subtitle cases at zero
  and positive shifts.
- Guide up/down and left/right focus remained stable during the bounded pass. The
  final measured DOM contained 775 elements and 19 program cells.
- Across all five Settings tabs, selected-unfocused toggles resolved to the shared
  neutral 8% white background/border with no outline. Disabled controls remained
  distinguishable at 0.5 opacity. Focused controls retained the warm focus
  treatment with white text.
- The Past Items dropdown displayed `Current slot`, `At least 15 min`, and
  `At least 30 min`; closing it restored focus to the originating control.
- The current clear logo rendered at the intended 60px Player OSD, 72px Guide,
  and 84px full Now Playing target heights without stretching. A shallow Guide
  pass covered missing-logo text fallback and real assets with aspect ratios from
  about 2.9 to 6.4. Unusably-wide and broken-image fallback remain automated
  branches because the bounded physical view supplied no matching asset.
- Two existing `Loading...` rows appeared during the shallow Guide pass. This was
  recorded only; schedule loading remains excluded from this remediation bundle.
- The Channel Builder completion copy was not re-exercised physically because
  doing so would require rebuilding/replacing the current lineup. The exact copy
  and unchanged counter values are covered at the presenter seam.

Evidence:

- [Guide geometry and fitting ticker](../evidence/2026-09-02-lg-c3-ui-remediation/01-guide-geometry-and-fitting-ticker.png)
- [Settings selected state](../evidence/2026-09-02-lg-c3-ui-remediation/02-settings-selected-state.png)

Final automated verification after the device-backed ticker correction:

- Combined focused Jest: 17/17 suites; 468 passed.
- `npm run verify`: PASS; 347/347 main suites, 4,568 passed, 0 failed,
  1 skipped; tools, contracts, docs, bundle, and build gates passed.
- Independent adversarial review: no remaining material findings. Two clear-logo
  P2 findings were fixed and re-reviewed; the final device-backed ticker delta was
  also independently closed.

## Evidence Handling

The six images under `docs/qa/evidence/2026-09-01-lg-c3/` are normalized PNG copies of the inspector captures. They contain no credentials, tokens, PINs, or private server identifiers. Media/program names visible in the Guide are user-library evidence and should not be copied into public issue trackers without review.
