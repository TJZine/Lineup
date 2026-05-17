# Browser Use Broad Smoke QA Report (2026-05-14)

## Scope

- Goal: one-off broad Browser Use QA smoke test to assess how close Lineup feels to app-complete.
- Primary proof mode: manual Browser Use visual/style inspection.
- Target runtime surface: local Vite dev app at `http://127.0.0.1:5173/`.
- Target display surface: `1920x1080`. This is the expected Lineup TV resolution surface because compatible LG webOS apps are expected to run at 1080p, including on 4K TVs.
- Non-target viewport notes: smaller viewport checks were sampled only as diagnostic context and are not release blockers unless Lineup later targets non-TV/browser layouts.

## Environment

- Workspace: `<REDACTED_WORKSPACE>`
- Date: `2026-05-14`
- Dev server command: `npm run dev -- --host 127.0.0.1`
- Dev server URL: `http://127.0.0.1:5173/`
- Browser surface: Codex in-app Browser Use
- Manual auth handoff: user linked the Plex PIN at `plex.tv/link`
- Plex profile observed in Settings: `<REDACTED_PROFILE>`
- Server selected during QA: `<REDACTED_SERVER>`

## Verification Classification

- Primary verification mode: `UX-manual`
- Plan classification: `broader integration/manual proof required`
- Automated test status: not run for this pass.
- Manual proof: Browser Use snapshots and screenshots during the live app session.
- Reasoning: the requested work was exploratory product QA focused on visible runtime behavior, layout, interaction, first-run completion, and user-facing error quality.

## Walkthrough Log

1. Started the local Vite dev server.
2. Opened `http://127.0.0.1:5173/` in Browser Use.
3. Observed first-load Plex auth screen.
4. Requested a Plex PIN.
5. User linked the PIN externally at `plex.tv/link`.
6. Observed post-auth server selection.
7. Selected `<REDACTED_SERVER>`.
8. Continued through Audio Setup using current/default settings.
9. Entered Channel Setup with all six libraries selected.
10. Sampled Channel Setup sections:
    - Content Sources
    - Advanced Sources
    - Build Options
    - Series Ordering
    - Limits
    - Priority Order
    - Estimate Details
11. Hit default estimate failures from advanced metadata sources.
12. Disabled advanced metadata-derived sources to continue the smoke path:
    - Genres
    - Directors
    - Decades
    - Studios
    - Actors
13. Built channels successfully after reducing advanced sources.
14. Entered the main EPG.
15. Observed immediate playback failure modal.
16. Cleared the playback error and inspected the guide.
17. Tested top guide controls:
    - Subtitles
    - Sleep
    - Audio
    - Library filter
18. Opened Settings using keyboard `F3`.
19. Sampled Settings categories:
    - Audio & Subtitles
    - Playback & HDR
    - Appearance
    - Account
    - Developer
20. Performed viewport checks at `1920x1080` and smaller diagnostic sizes.

## Pass Signals

- App launches into Plex PIN authentication.
- Plex PIN request renders a QR/code state.
- Post-auth server selection appears after successful PIN handoff.
- Server list discovered two servers.
- Audio Setup renders and continues.
- Channel Setup can discover libraries and build a reduced lineup.
- Reduced setup completed with `Created 87 channels. Skipped 36.`
- Main EPG rendered real guide data with channel rows, time grid, current program details, artwork/logo, metadata badges, and library filter.
- Library filter opens and lists source libraries.
- Settings opens from `F3` and exposes the expected category set.

## Findings

### P1 - Default Channel Setup Can Block on Plex Tag Payload Shape

Status: confirmed during this QA pass.

Observed behavior:

- With default Channel Setup options, Estimate Details failed on advanced metadata-derived channel types.
- First observed failure was for Studios:
  - `Required studios tag directory (type=4) failed for Anime Home`
  - parser detail: `Directory must be an array`
- After disabling Studios, another failure appeared for Genres:
  - `Required genres tag directory (type=1) failed for Home Videos`
  - parser detail: `Directory must be an array`
- The default setup path could not continue cleanly until advanced metadata sources were manually disabled.

Repro outline:

1. Sign in.
2. Select `<REDACTED_SERVER>`.
3. Enter Channel Setup.
4. Keep all libraries selected.
5. Keep default source options enabled.
6. Open Estimate Details or wait for estimate.
7. Observe advanced-source estimate failure.

Impact:

- A normal first-run user can hit an unrecoverable-looking setup failure before building a lineup.
- The app appears incomplete or broken even though a reduced core setup can succeed.

Investigation leads:

- Review tag-directory response parsing for Plex libraries where tag payloads return an object or alternate shape instead of an array.
- Decide whether unsupported/malformed tag directories should skip that category/library with user-safe warnings instead of blocking the full estimate/build.
- Verify whether Collections/Recently Added remain reliable as fallback channel sources when tag directories fail.

### P1 - Internal Planning Language Leaks Into User-Facing Estimate Errors

Status: confirmed during this QA pass.

Observed behavior:

- Estimate Details displayed internal remediation wording:
  - `Action required: ... stop and re-plan.`

Impact:

- This is not customer-facing language.
- It exposes implementation/process vocabulary and makes the product feel unfinished.

Expected behavior:

- A user-safe message such as:
  - `Some channel types could not be estimated for this library. Try disabling advanced sources or continue with supported channel types.`
- Technical detail can remain in debug logs or a developer diagnostics surface.

Investigation leads:

- Find the owner that formats Channel Setup preview/estimate failures.
- Separate developer diagnostics from user-facing copy.
- Add a copy contract around estimate failure messages if this path is covered by tests.

### P2 - Settings Screen Opens Clipped at the Top

Status: confirmed at target `1920x1080` and default Browser Use viewport.

Observed behavior:

- Opening Settings with `F3` initially showed the top of the Settings title/detail heading clipped.
- At `1920x1080`, the left rail and detail pane were visible, but the top of the page started offscreen.
- The profile switch card at the lower left was also partially clipped at the bottom in the initial settings view.
- Switching settings categories caused some later screenshots to look better, but the initial entry state was visibly wrong.

Repro outline:

1. Build or load a channel lineup.
2. Open the main EPG/player surface.
3. Press `F3`.
4. Observe Settings entry layout.

Impact:

- Settings is a core control surface and appears visually mispositioned.
- This is especially noticeable on TV because there is no browser scroll affordance.

Investigation leads:

- Inspect Settings container height, top offset, and any inherited transform/scroll state from the guide/player shell.
- Confirm whether Settings should reset internal scroll/top position on every show.
- Test direct Settings entry from player, EPG, and after viewport changes.

### P2 - Channel Setup Section Switching Preserves Bad Scroll Position

Status: confirmed during setup section sampling.

Observed behavior:

- After visiting taller Channel Setup sections, switching to other sections retained a scrolled-down position.
- The header could be cut off.
- Footer actions such as Back/Build Channels could disappear from the visible viewport until the user scrolled or changed context.

Repro outline:

1. Enter Channel Setup Step 2.
2. Open Priority Order or Advanced Sources.
3. Scroll or allow the panel to sit lower in a long section.
4. Switch sections, such as Advanced Sources -> Build Options -> Priority Order.
5. Observe header/footer visibility.

Impact:

- A remote-first setup flow can strand users away from the step title and primary actions.
- It makes the setup flow feel unstable even when controls still exist in the DOM.

Investigation leads:

- Reset the setup panel scroll position when changing sections.
- Verify focus restoration does not scroll a deep child into view before the container has reset.
- Add manual Browser Use proof for section switching at `1920x1080`.

### P2 - Immediate Playback Failure in Browser Dev Session

Status: observed; root cause unknown.

Observed behavior:

- After completing setup and entering the main EPG/player, the app opened an error dialog:
  - heading: `Something went wrong`
  - body: `Unable to play content`
  - action: `Skip`
- The dialog disappeared before a successful Browser Use click on `Skip`, and the guide remained usable afterward.

Impact:

- Could be expected in local browser/dev if direct playback URLs/codecs/webOS-specific playback behavior are unavailable.
- Could also indicate a real stream resolution/playback startup issue.
- Needs classification before release.

Investigation leads:

- Capture stream resolution/playback diagnostics for the first attempted item.
- Compare Browser Use/local Chrome behavior against target webOS device behavior.
- Improve the error body if the failure is a known unsupported local-browser playback path.

### P2 - Error Modal Heading Has Poor Contrast

Status: confirmed visually.

Observed behavior:

- The playback error modal heading `Something went wrong` rendered very dark against a dark modal/backdrop.
- The body text and orange button were readable; the heading was not.

Impact:

- Error handling appears broken at the exact moment users need clarity.

Investigation leads:

- Inspect modal heading color tokens in runtime error overlays.
- Confirm contrast in both guide overlay and player-overlay contexts.
- Add a CSS contract test if modal heading color is expected to use a semantic foreground token.

### P3 - Channel Setup Library Cards Show Blank Square Placeholders

Status: confirmed visually.

Observed behavior:

- Channel Setup Step 1 rendered each library card with a blank square on the left.
- No icon, poster, or fallback glyph appeared inside the square.

Impact:

- This reads as unfinished UI unless intentionally reserved for future library artwork.

Investigation leads:

- Decide whether the slot should render a stable library-type icon, a Plex library icon, or be removed.
- If intentionally empty, adjust styling so it does not look like a broken image/placeholder.

### P3 - Top Utility Buttons Can Show Active State Without Visible Panel

Status: observed; needs follow-up.

Observed behavior:

- Clicking `Subtitles`, `Sleep`, and `Audio` changed the active/focused button state.
- No visible panel or menu was apparent in the sampled state.

Impact:

- Users may think the button click did nothing.
- This may depend on active playback state or unavailable tracks, but the UI should explain that if so.

Investigation leads:

- Confirm expected behavior when playback is unavailable.
- Provide disabled states or empty-state panels where no options exist.

### P4 - Small Viewports Are Not Supported

Status: non-target observation only.

Observed behavior:

- At `800x600`, the now-playing detail panel was pushed off the right edge and text clipped severely.

Disposition:

- Not a release blocker for the current target if Lineup only supports the LG/webOS `1920x1080` app surface.
- Keep this as future context only if desktop/mobile browser support becomes a product goal.

## Target-Resolution Notes

At `1920x1080`:

- Main guide was generally usable and visually coherent.
- Settings clipping still reproduced and should be treated as target-surface bug.
- Channel Setup scroll-position issue reproduced during normal setup interactions.
- Error modal contrast issue is independent of viewport size.

## Deferred / Not Covered

- Full playback success on physical webOS hardware.
- Long-running playback stability.
- Real remote/D-pad hardware behavior.
- Exhaustive channel surfing.
- Home profile switching.
- Clear Saved Server / destructive local state flows.
- Automated verification (`npm run verify`) for this QA pass.

## Recommended Next Review Order

1. Fix or classify default Channel Setup estimate failures.
2. Remove internal planning language from user-facing errors.
3. Fix Settings initial layout clipping at `1920x1080`.
4. Fix Channel Setup section scroll reset.
5. Classify local-browser playback failure versus real webOS playback failure.
6. Fix modal heading contrast.
7. Decide library-card placeholder treatment.
8. Add disabled/empty-state behavior for unavailable utility controls.

## Follow-Up Browser Use Audit (2026-05-14 Post-Fix Pass)

### Scope

- Goal: fresh read-only Browser Use UI audit after target fixes through commit `d4f21618`.
- Primary proof mode: manual Browser Use visual/style inspection.
- Target runtime surface: local Vite dev app at `http://127.0.0.1:5173/`.
- Target display surface: `1920x1080`.
- Browser route discipline: normal user-facing routes only. The Channel Setup review was reached through `Re-run Setup` from server selection, with no relink and no dev panel.
- Report status: this section was added after the post-fix audit; no implementation changes were made during the audit.

### Verification Classification

- Primary verification mode: `UX-manual`.
- Plan classification: `broader integration/manual proof required`.
- Automated test status during audit: not run because the audit was read-only.
- Documentation verification after recording this section: run `npm run verify:docs`.
- Browser Use evidence: live visual inspection and accessibility snapshots at `1920x1080`. No screenshot artifacts were persisted.

### Pass Signals

- EPG opened at `1920x1080`; sampled keyboard focus updated the now-playing detail panel, library filtering worked by pointer, channel highlight was visible, artwork/logos/backdrops/metadata rendered, and disabled utility controls were visibly disabled.
- Channel Setup Step 1 library selection, Step 2 sections/options/estimate/details/warnings, and Step 3 review loaded through `Re-run Setup` without relinking.
- Settings opened from the player/EPG surface with `F3`; sampled major categories, dropdowns, toggles, disabled states, scrolling, and return with Escape did not reproduce the earlier target-viewport clipping.
- Server selection and profile selection were sampled without destructive sign-out, clear-server, or relink actions.

### Remaining Findings

#### P2 - EPG Time Header Overlaps First Future Slot Label

Status: confirmed at target `1920x1080`.

Observed behavior:

- In the EPG with `Library: Anime Home` selected, the sticky current-time label around `3:55 PM` visually overlapped the first future slot label around `4:00 PM`.
- The combined text read like `3:55 PM0 PM`, making the time scale harder to parse.

Expected behavior:

- The current-time label, current-time marker, and future slot labels should remain readable and should not overlap on the target TV viewport.

Repro outline:

1. Load the app with an existing signed-in state and saved lineup.
2. Open the EPG with `G`.
3. Open the library filter.
4. Select `Anime Home`.
5. Inspect the left edge of the time header near the current-time marker.

Impact:

- The EPG is the primary navigation surface, and time-grid readability is part of the core guide contract.

Likely owners:

- `src/modules/ui/epg/view/EPGTimeHeader.ts`
- `src/modules/ui/epg/styles.grid.css`

Investigation leads:

- Check sticky label width and slot clipping behavior around the current-time marker.
- Confirm behavior at different minute offsets, especially when the current-time marker sits close to the first visible future slot.

#### P2 - EPG Live Indicator Can Clip Into Partial Text

Status: confirmed at target `1920x1080`.

Observed behavior:

- In current-airing cells after filtering to `Anime Home`, the visual live badge could render as partial text such as a dot plus `L` or `LIV` at the cell edge.
- The accessibility tree exposed the intended `Currently playing: LIVE` state, but the visual indicator was not coherent.

Expected behavior:

- Current/live state should render as either a readable `LIVE` badge or an intentional compact indicator, with no partial clipped text.

Repro outline:

1. Load the app with an existing signed-in state and saved lineup.
2. Open the EPG with `G`.
3. Select `Library: Anime Home`.
4. Inspect current-airing cells near the visible time-window edge.

Impact:

- The live/current indicator is a core EPG affordance and is specifically called out in the EPG user guide.

Likely owners:

- `src/modules/ui/epg/view/EPGCellRenderer.ts`
- `src/modules/ui/epg/view/EPGCellPresentation.ts`
- `src/modules/ui/epg/styles.cells.css`

Investigation leads:

- Check `visibleWidthPx`, sliver detection, and partially visible current-cell geometry.
- Avoid assuming this is only a narrow/tiny tier issue; the current code already removes badge text for compact tiers, so partial `LIVE` text may come from clipped medium/wide presentation.

#### P2 - Blocking Error Overlay Heading Has Poor Contrast

Status: confirmed at target `1920x1080`.

Observed behavior:

- During local-browser playback resume failure, the blocking error modal showed:
  - heading: `Something went wrong`
  - body: `Unable to play content`
  - action: `Skip`
- The body text and button were readable, but the heading appeared dark/low-contrast on the dark modal.

Expected behavior:

- Blocking error overlay headings should use a readable semantic foreground token in every runtime context.

Impact:

- This affects a shared app-owned blocking error surface. The playback failure event itself remains environment-limited, but the overlay contrast is a target-surface UI defect.

Likely owners:

- `src/core/app-shell/chrome/AppBlockingErrorOverlayPresenter.ts`
- `src/styles/shell.chrome.css`

Investigation leads:

- Add an explicit foreground color for `.error-title`.
- Confirm contrast against the shared panel surface in both player and guide overlay contexts.

### EPG Doc-vs-Runtime Verdict

`docs/user-guide/epg.md` says the focused cell expands to show program title, time range, and currently-airing indicator.

Runtime partially satisfied this in sampled states:

- The now-playing/detail panel exposed focused title, time range, metadata, and description.
- Keyboard focus movement updated the sampled detail states.
- Library filters worked by pointer.
- Channel column highlight was visible.

Runtime did not fully satisfy the in-grid readability expectation:

- Current/live badge text could clip into partial text.
- Long or constrained in-grid cell titles could still rely on the separate detail panel for readable context.

Disposition:

- Classify the live/current badge and time-header issues as runtime UI defects.
- Classify the focused-cell wording as docs drift or underspecification unless the intended contract is that the detail panel, not the cell itself, is the reliable fallback for full focused context.

### Sampled Old Findings Now Clean

- Default Channel Setup tag-payload failures were not reproduced in the supported sampled path; estimates completed with warnings instead of blocking.
- Internal setup error copy was not reproduced.
- Settings target-viewport clipping was not reproduced.
- Channel Setup section/detail scrolling remained recoverable, and footer actions were reachable after scroll.
- Library-card selected states and placeholders looked coherent in the sampled Step 1 path.
- Unavailable playback utility controls had visible disabled state in the sampled local-browser failure state.

### Deferred / Not Covered in Follow-Up Audit

- Auth/PIN linking, sign-out, profile PIN, and audio setup were not re-run because the audit used the existing signed-in state and avoided relink/destructive paths.
- `Confirm & Replace`, channel build progress, and done states were not executed because replacing the lineup is destructive.
- Physical webOS playback and long-running playback stability were not tested.
- Small viewport support remained out of scope unless a target `1920x1080` issue reproduced.

### Recommended Remediation Slices

1. Fix EPG time-header/current-marker overlap at `1920x1080`.
2. Fix EPG live badge behavior for partially visible or constrained current cells.
3. Fix shared blocking error overlay heading contrast.
4. Optionally update `docs/user-guide/epg.md` to clarify whether full focused context is guaranteed in the cell, in the detail panel, or both.

### Next Session Handoff

```text
NEXT_SESSION_LAUNCHER: lineup-cleanup-plan
TASK: Produce a Tier 2 standalone remediation implementation plan for the first grouped EPG readability defects from the 2026-05-14 Browser Use QA audit: (1) time header/current-marker overlap at 1920x1080 after selecting Library: Anime Home, and (2) live/current badge rendering partial text such as dot+L or dot+LIV in current cells.
TASK_FAMILY: cleanup/refactor
CLEANUP_SUBTYPE: standalone remediation
TIER: Tier 2
TIER_RATIONALE:
This is bounded UI remediation inside the EPG module with one target runtime surface and no planned ownership, persistence, Plex, navigation, or modal-contract rewrite. It does not need Tier 3 unless current-source discovery shows the fix requires cross-module ownership changes, public virtualizer contract redesign, persistent data changes, or multi-session orchestration.

SOURCE_CONTEXT:
The post-fix Browser Use audit at http://127.0.0.1:5173/ with target viewport 1920x1080 found three confirmed P2 UI defects. This first group covers only the two EPG defects: time header overlap and live badge partial clipping. The report is recorded in docs/qa/reports/2026-05-14-browser-use-broad-smoke-qa.md, which is currently local-only/untracked unless the workspace owner stages it.

IN_SCOPE_FINDINGS:
- P2 EPG time header/current-marker overlap.
- P2 EPG live/current indicator partial clipping.
- Optional docs/user-guide/epg.md wording only if the planner decides the focused-cell contract needs clarification after runtime/source audit.

OUT_OF_SCOPE_FINDINGS:
- P2 blocking error overlay heading contrast; plan as a separate owner slice.
- First-run/auth/PIN/audio relink flows.
- Destructive Confirm & Replace build execution.
- Physical webOS playback.
- Small viewport support.
- Storage/Plex/auth/stream policy.
- Broad navigation/modal contract rewrites.

READ_FIRST:
- AGENTS.md
- docs/AGENTIC_DEV_WORKFLOW.md
- docs/agentic/session-prompts/cleanup-plan.md
- docs/agentic/codanna-playbook.md
- docs/architecture/CURRENT_STATE.md
- docs/design/ui-design-language.md
- docs/user-guide/epg.md
- docs/qa/reports/2026-05-14-browser-use-broad-smoke-qa.md

REQUIRED_SKILLS:
- ui-composition-patterns
- verification-strategy
- execution-plan-authoring
- review-request before closeout

DISCOVERY_REQUIREMENTS:
Run Codanna-first discovery for EPG time header, cell renderer/presentation, styles, virtualizer measurement, and any EPG test owner touched. Record Codanna results plus rg/direct-read fallback. Run analyze_impact when available for shared EPG presentation helpers or virtualizer contracts; if unavailable or insufficient, record that and fall back to find_symbol/search_symbols/direct reads.

LIKELY_FILES_IN_SCOPE:
- src/modules/ui/epg/view/EPGTimeHeader.ts
- src/modules/ui/epg/styles.grid.css
- src/modules/ui/epg/view/EPGCellRenderer.ts
- src/modules/ui/epg/view/EPGCellPresentation.ts
- src/modules/ui/epg/styles.cells.css
- conditional: src/modules/ui/epg/view/EPGVirtualizer.ts, if visibleWidthPx/sliver/partial-cell geometry ownership is needed without public contract redesign
- conditional: relevant EPG tests, if a deterministic regression proof is practical
- docs/user-guide/epg.md only if docs drift remains after the runtime contract decision

SCOPE:
Planning first. The planner may choose a light execution brief if durable memory is not needed, or write/refresh a tracked active plan in docs/plans/ if the implementation needs fresh-session durability. If a tracked plan is created, run npm run verify:docs.

VERIFICATION:
Verification classification: broader integration/manual proof required.
For implementation, plan npm run verify plus Browser Use proof at 1920x1080. Browser proof should open the EPG, select Library: Anime Home, confirm no time-label overlap around the current marker, confirm live/current badges render as full LIVE or an intentional compact marker with no partial text, and sample D-pad focus still updates the detail panel. Because the time-header issue is wall-clock/offset sensitive, the planner must also define a deterministic proof strategy where practical: controlled time/offset source audit, targeted regression test, or an explicit fallback explaining why Browser Use/manual timing is the only viable proof. If docs-only, run npm run verify:docs; if docs change with UI code, npm run verify is sufficient.

STOP_AND_REPLAN_IF:
- The fix requires changing EPG data contracts, public virtualizer contracts, navigation/focus routing, persistence/Plex/auth/playback behavior, small viewport support, or unrelated guide redesign.
- Browser Use cannot reproduce or verify the finding and no deterministic proof substitute is available.
- Current-source discovery shows either issue is already fixed.
- Solving one EPG issue regresses focused-cell title/time/live indicator behavior.

NEXT_REVIEW:
After the plan is written, route to lineup-cleanup-review. If implementation is approved after review, route to lineup-cleanup-implement for Tier 2. Use cleanup-loop only if the reviewed plan reclassifies this as Tier 3 because of cross-boundary or multi-session orchestration risk.
```

## Follow-Up Browser Use Notes (2026-05-15)

### Scope

- Goal: record post-remediation EPG and Channel Setup observations from the live in-app browser session after the first EPG readability fix was implemented.
- Target runtime surface: local Vite dev app at `http://127.0.0.1:5173/`.
- Target display surface: `1920x1080`.
- Browser state: user rebuilt the schedule for a more realistic test set using only `TV Shows Home` and `Movies Home`.
- Setup choices reported by the user:
  - Libraries selected: `TV Shows Home`, `Movies Home`.
  - Actors disabled because actor estimates reached roughly `270` channels even with minimum items set to `10`.
  - Variant type set to `sequential` to exercise variant channel generation.
  - Alternate lineups enabled with lineup copies set to `1`.
  - Estimate warning shown: `Skipped studios for TV Shows Home: Plex returned no tag entries (type=4).`
- Prior EPG remediation status:
  - Commit `092da7e9` fixed the previously recorded time-header/current-marker overlap and partial live-badge text defects.
  - Browser evidence after that commit confirmed no partial `LIVE` text and a transparent occluded time-slot label in the active EPG DOM; visual proof later used a rebuilt schedule.

### New Findings

#### P2 - Focused Series Cells Suppress the Episode Tag Lane

Status: confirmed by user observation and source audit; product direction needs a decision before implementation.

Observed behavior:

- When a series episode cell receives focus, the cell removes the top episode tag/marker lane, such as `S01E12`.
- The same episode information is folded into the subtitle line with the episode title.
- The time label and full `LIVE` text are also removed on focused/current series cells, leaving the compact pulsing current marker.
- User observation: keeping the tag above the main title likely looks cleaner and preserves more subtitle width for long episode titles, especially in smaller cells.

Current-source evidence:

- `src/modules/ui/epg/view/EPGCellPresentation.ts` currently forces focused episode cells into `focusedLayoutMode: 'compact'`.
- In that compact mode, `focusedCompactSubtitle` is built as `episodeTag - episodeTitle`.
- `src/modules/ui/epg/view/EPGCellRenderer.ts` then inlines that compact subtitle and hides the meta/tag lane for focused compact cells through width presentation.

Expected behavior candidate:

- Focused series cells should retain the episode tag lane when there is enough visible width.
- The subtitle should prioritize the episode title itself, not duplicate tag text that could live in the tag lane.
- Time can still be hidden on constrained focused series cells if retaining both the tag lane and full episode title would otherwise create unreadable truncation.

Impact:

- Current focused series layout spends subtitle width on data that can fit more cleanly in the tag lane.
- Long episode names lose readable room in the exact state where focus is supposed to improve readability.
- The detail panel remains correct, but the in-grid focused cell feels less polished than it could.

Likely owners:

- `src/modules/ui/epg/view/EPGCellPresentation.ts`
- `src/modules/ui/epg/view/EPGCellRenderer.ts`
- `src/modules/ui/epg/styles.cells.css`
- `src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts`
- `src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts`

Implementation direction options:

1. Preserve the tag lane on focused wide/medium series cells only.
   - Pros: lowest behavior risk; keeps compact mode for truly constrained cells.
   - Cons: still leaves narrow focused series cells with the current folded subtitle behavior.
2. Preserve the tag lane on all focused series cells where the tag itself fits, and hide time before hiding the tag.
   - Pros: best aligns with the observed visual preference and gives the episode title more subtitle room.
   - Cons: needs careful threshold tests so tiny/narrow cells do not become cluttered.
3. Keep the current compact behavior but tune subtitle truncation.
   - Pros: smallest code change.
   - Cons: does not address the core visual concern that the tag belongs above the title and consumes subtitle room unnecessarily.

Recommended direction:

- Use option 2, with explicit width thresholds and regression tests. In focused series cells, preserve the tag lane first, preserve title/subtitle readability second, and hide the time label when the cell cannot support all three.

#### P2 - Movie and Series Cell Truncation Is Too Aggressive in Some Constrained Cells

Status: confirmed by user observation and Browser Use sampling; needs design decision.

Observed behavior:

- Some movie cells truncate earlier than feels necessary, even though movies do not need the extra subtitle lane that series episodes need.
- Some series cells look awkward because title/subtitle/time compete for the same constrained space.
- Browser sampling showed long movie titles such as `The Lord of the Rings: The Fellowship of...` truncating while the time label remains visible.

Current-source evidence:

- Width tiers are shared across content types:
  - wide: `>= 220px`
  - medium: `>= 140px`
  - narrow: `>= 88px`
  - tiny: below `88px`
- `src/modules/ui/epg/view/EPGCellRenderer.ts` applies time/subtitle/meta visibility mostly by tier and focused compact mode, not by movie-vs-series readability needs.
- Movie focused cells get a separate `epg-cell-focused-movie-overlay` presentation, but unfocused movie truncation still competes with time visibility under the same broad tier rules.

Impact:

- Movie rows can waste potential title readability because the time label wins too early.
- Series rows need a more nuanced trade-off because title, episode subtitle, episode tag, and time can all matter.
- The timeline header gives time context, so hiding time in a cell can be acceptable when it significantly improves title/episode readability.

Design options:

1. Differentiate movie and series rules.
   - Movies: relax truncation and allow title to consume more width; keep time only when it does not materially reduce title readability.
   - Series: keep stricter behavior because episode subtitle and time both carry more navigational value.
   - Pros: targeted and intuitive; lower risk for existing series layouts.
   - Cons: two presentation policies to maintain.
2. Add an adaptive time-hiding threshold for both movies and series.
   - If a cell cannot fit the title and supporting text within the threshold, hide the in-cell time even when not focused.
   - Pros: maximizes readable content; consistent rule across content types.
   - Cons: loses some at-a-glance time data, and users must rely more on the time header.
3. Hybrid approach.
   - Movies get relaxed truncation by default.
   - Series keep time where practical, but hide time below a measured width/overflow threshold to preserve show title plus episode title.
   - Pros: best balances readability and guide context.
   - Cons: requires the most careful regression matrix.

Recommended direction:

- Use option 3. Movies should be allowed to favor title readability earlier than series. Series should only hide time when measured title/subtitle readability would otherwise fall below an explicit threshold.

Verification needs:

- Browser proof at `1920x1080` with both movie and series rows visible.
- Targeted renderer/virtualizer tests around boundary widths near `220`, `140`, and `88` pixels.
- Tests that movie cells and episode cells can diverge without regressing live/current badge behavior.

#### P2 - Focused Title Ticker Can Activate When Text Fits

Status: confirmed in Browser Use and source audit.

Observed behavior:

- Browser Use showed a focused movie cell for `Django Unchained` around `1004px` wide.
- The title visually fit, but the title element still had ticker classes:
  - `epg-cell-title-ticker-ready`
  - `epg-cell-title-ticker-running`
- The visible effect is a slight title self-hiding/shift even though no ticker is needed.

Expected behavior:

- Ticker should arm only when rendered content overflows the effective visible title area or when tiny-tier line-clamp measurement proves hidden text.
- Re-rendering or re-focusing the same visible cell should not re-arm ticker state when key, width, visible width, text shift, and text content are unchanged.

Current-source evidence:

- `src/modules/ui/epg/view/EPGCellRenderer.ts` clears ticker state and recomputes ticker targets on every `syncFocusedTicker()` call.
- `src/modules/ui/epg/view/EPGVirtualizer.ts` calls focused ticker sync during visible-focus synchronization and again from `setFocusedCell()`.
- At the time of this finding, the implementation had extensive ticker tests but lacked a regression proving repeated no-op focus/render sync did not arm or re-arm the ticker for fitting title/subtitle text. The follow-up remediation branch adds these regressions.

Impact:

- Focused text can look subtly broken in otherwise readable wide cells.
- This undermines trust in the focused-cell affordance and can create motion when no motion is warranted.

Likely owners:

- `src/modules/ui/epg/view/EPGCellRenderer.ts`
- `src/modules/ui/epg/view/EPGVirtualizer.ts`
- `src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts`
- `src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts`

Investigation leads:

- Add an idempotent focused-ticker sync guard keyed by focused cell key plus geometry/text metrics.
- Confirm ticker clears on focus movement, cell recycle, reduced-motion, no visible width, and real overflow.
- Add a regression for a wide focused movie title that fits and remains non-tickered across repeated render/focus sync.

### Additional EPG Cell Readability Notes (2026-05-15)

Status: user-observed during the focused-cell readability remediation follow-up; these notes should inform the next EPG visual bug/remediation plan rather than being folded into the completed focused-tag/ticker pass without review.

#### P2 - Unfocused Episode Title Width Can Still Be Over-Constrained by Lower-Row Time

Observed examples:

- Unfocused `Adventure Time: Fionna and Cake` episode cell with tag `S01E08`, subtitle `Jerry`, and visible time range: the title displayed as `Advent...` even though the subtitle was short and the lower row had unused visual space.
- Focused version of the same cell showed the tag lane and much more of the title, confirming the content itself was not the limiting factor.

Interpretation:

- The issue is not primarily subtitle string length.
- The base two-column cell layout can reserve the rail/time column across the full cell height, which narrows the title row even though the time label visually sits on the lower row.
- Title and subtitle/time should be treated as separate rows: the title row should not always pay for lower-row time width.

Small-pass implementation direction captured during the session:

- Add a renderer-owned row-aware presentation class for safe episode cases instead of adding per-string measurement to every virtualized cell.
- Let the title row span the full cell width.
- Keep the subtitle row constrained so it does not collide with the in-cell time range.
- Keep this local to `EPGCellPresentation`, `EPGCellRenderer`, and `styles.cells.css`; no scheduler/channel data, Plex metadata, persistence, navigation, or public virtualizer redesign is implicated.

Verification leads:

- Renderer test: non-current wide episode with long show title, short subtitle, visible time gets the row-aware class and retains visible time.
- CSS contract: row-aware title cells use one grid column, absolute rail positioning, and subtitle-only time reservation.
- Browser Use: at `1920x1080`, inspect row-aware episode cells and confirm title uses the wider row while subtitle/time lower-row geometry has a positive gap.

#### P3 - Unfocused Constrained Episode Tags Might Fit, But Tag Visibility Needs Separate Policy

Observed examples:

- A constrained unfocused `Aqua...` episode cell had room where `S03E08` appeared on focus.
- A constrained unfocused `That '70...` episode cell had room where `S01E08` appeared on focus.

Decision note:

- Do not automatically restore unfocused episode tags in constrained cells as part of the focused-cell/tag-lane fix.
- Focused cells should preserve the tag lane because focus is the expanded/contextual state.
- Unfocused constrained cells prioritize quick title scanning; showing tags there risks making unfocused cells look like focused cells and introduces new collision rules with live/current badges.

Future option:

- Consider a conservative unfocused tag rule only for medium/wide non-current episode cells where the tag lane can fit without hiding title or subtitle.
- Avoid showing unfocused tags in current/live compact-dot or full-live cells unless the top-row live/tag/title relationship is intentionally redesigned.

#### P2 - Current/Live Text Competes With Episode Titles

Observed example:

- A current unfocused `That '70s Show` cell displayed `That '70...` with subtitle `Drive-In` and full `LIVE` text.
- The focused version used the compact live dot, preserved the episode tag lane, and displayed much more of `That '70s Show`.

Interpretation:

- This is the current/live variant of the title-row width problem.
- Full `LIVE` text is a real top-row element, so it competes with title readability more directly than lower-row time does.
- This is more complex than the non-current row-aware title pass because the live badge belongs near the title row, not only the subtitle/time row.

Future remediation direction:

- Either make current/live episode cells row-aware while reserving only the actual live-badge width on the title row, or change the live badge policy so cells always use the compact dot.
- Preserve accessibility with `aria-label="Currently playing"` regardless of visible badge text.
- Keep partial `LIVE` text prohibited.

#### P2 - Consider Compact Live Dot for All Cell Live Badges

Product direction under consideration:

- Always render the in-cell current/live indicator as the pulsing compact dot and remove visible `LIVE` text from all EPG cells.

Pros:

- Reduces title-row width pressure in current/live cells.
- Makes current cells visually more consistent across focused and unfocused states.
- Avoids the `LIVE` text appearing/disappearing during focus changes.
- Keeps in-grid cells calmer while the detail panel can carry explicit currently-playing context.
- Keeps accessibility intact if the badge retains `aria-label="Currently playing"`.

Cons / decision risks:

- Reduces discoverability because a red dot is less explicit than visible `LIVE` text.
- Some themes may rely on the written `LIVE` affordance if current-progress styling is low contrast.
- This intentionally changes the earlier contract that allowed either full `LIVE` or compact dot depending on geometry, so it should be planned as a new UX decision rather than a hidden bug fix.

Recommended framing:

- Plan as `Use compact live dot for all EPG cell live badges`.
- Keep it smaller and safer than broad tag visibility changes.
- Pair it with a current-progress contrast check so the loss of visible `LIVE` does not make current-airing state too subtle.

#### P2 - Current Progress Bar Contrast May Be Too Low

Observed concern:

- If visible `LIVE` text is removed, discoverability may depend more on the current-progress indicator.
- In the sampled theme, the filled progress portion was difficult to distinguish from the unfilled/current-cell orange treatment. The contrast between current progress and the remaining progress track appeared too low.

Impact:

- Users may not easily read how far through the current program they are.
- Always using compact live dots could make this worse if the progress fill does not provide enough visual reinforcement.
- Theme differences may make the issue inconsistent, so the check should cover at least the active/default theme and any high-contrast/currently preferred guide theme.

Investigation leads:

- Audit `.epg-cell-progress`, `.epg-cell-progress-fill`, current-cell border/background, and theme overrides in `styles.cells.css` and related theme CSS.
- Confirm whether the unfilled current-progress track uses a color too close to the filled progress segment or row accent.
- Consider a stronger semantic progress fill token, darker unfilled track, or clearer progress height/edge treatment for current cells.
- Preserve reduced-motion and forced-colors behavior.

Verification leads:

- Browser Use at `1920x1080` with current cells visible in at least the active theme.
- CSS contract or theme-token test if progress colors are intended to map to stable semantic tokens.
- Visual check that current state remains discoverable if visible `LIVE` text is replaced by the compact dot.

#### P2 - Actor Channel Estimates Can Explode Despite Minimum Item Count

Status: confirmed by user observation; source audit suggests likely cause but runtime payload needs capture.

Observed behavior:

- With the rebuilt setup using `TV Shows Home` and `Movies Home`, enabling actors reported roughly `270` actor channels even with minimum items set to `10`.
- User disabled actors to avoid an unrealistic channel count.
- Directors may share part of the risk but were less severe in the sampled setup.

Current-source evidence:

- `src/core/channel-setup/planning/ChannelSetupStrategyBuilders.ts` uses `tagMeetsMinItems(tag, minItems)`.
- That helper returns `true` when `tag.count === null`.
- Actor/studio combined generation also treats `hasUnknownCount` as passing the minimum count.
- Therefore, if Plex actor tags are missing counts or count recovery leaves counts unknown, many actor tags can pass the minimum threshold even when the user expects `minItems = 10` to filter them out.

Impact:

- Actor channels can dominate setup estimates and produce an unrealistic lineup.
- The user-facing minimum item count control may not behave as users expect for actor/director metadata with missing tag counts.
- The setup flow needs either stricter default filtering, a separate cap, or clearer copy for unknown-count metadata sources.

Likely owners:

- `src/core/channel-setup/planning/ChannelSetupStrategyBuilders.ts`
- `src/core/channel-setup/planning/ChannelSetupFacetLibraryExecutor.ts`
- `src/core/channel-setup/ChannelSetupFacetCountRecoveryWorker.ts`
- `src/modules/ui/channel-setup/steps/StrategyStepController.ts`
- `src/modules/ui/channel-setup/steps/StrategyStepInteractionController.ts`
- Channel Setup tests under `src/core/channel-setup/__tests__` and `src/modules/ui/channel-setup/__tests__`

Remediation options:

1. Treat unknown actor/director counts as failing `minItems`.
   - Pros: matches the plain-language meaning of the minimum item count.
   - Cons: could hide valid actor/director channels when Plex omits counts but the channel would resolve to enough items.
2. Add a per-strategy candidate cap, especially for actors.
   - Pros: prevents runaway estimates even when counts are unknown.
   - Cons: needs UI copy and priority rules so users understand why some actor channels were skipped.
3. Improve count recovery and only let unknown counts pass when recovery was unavailable for a known, user-safe reason.
   - Pros: most accurate.
   - Cons: more complex and may touch Plex metadata fetching behavior.
4. Add a dedicated actor/director minimum or top-N setting.
   - Pros: gives users explicit control over high-cardinality sources.
   - Cons: expands setup UI and persistence/config surface.

Recommended direction:

- Plan this separately from EPG UI work. Start by capturing actor tag payload/count recovery data for `TV Shows Home` and `Movies Home`, then choose between unknown-count fail-closed, a per-strategy cap, or improved recovery. The smallest likely user-safe improvement is a per-strategy cap plus explicit warning copy, but the correct behavior depends on whether the actor counts are truly missing or recovery is failing.

#### P3 - TV Shows Home Studio Warning Appears Acceptable But Should Stay Covered

Status: observed by user during selective setup.

Observed behavior:

- Estimate box showed: `Skipped studios for TV Shows Home: Plex returned no tag entries (type=4).`

Disposition:

- This looks like the improved non-blocking behavior intended after the earlier default setup tag-payload failures.
- Keep it as a warning/pass signal unless it blocks build, uses internal planning language, or prevents movie studio channels from being generated for `Movies Home`.

Verification lead:

- Add or retain a copy contract that empty/unsupported tag directories render as user-safe skip warnings instead of blocking estimate/build.

#### P2 - Video Plane Drops Slightly When OSD First Opens After Returning From Full-Screen UI

Status: user-observed regression/resurfaced bug; not yet reverified in Browser Use during this report update.

Observed behavior:

- While watching a channel, opening a separate full-screen UI surface and then returning to playback can leave the next OSD open animation in a bad state.
- Pressing Down to open the OSD after returning makes the video appear to drop downward slightly as the OSD panel rises from the bottom.
- The drop only happens on the first OSD open after returning from a different UI surface.
- Reopening the OSD again from the same player state does not reproduce the drop.

Concrete repro outline:

1. Start playback on any channel.
2. Open a completely different UI surface, such as Server Select.
3. Return to the current channel/player with Back or Backspace.
4. Press Down to open the player OSD.
5. Observe the video plane during the first OSD reveal. Expected failure: video appears to shift/drop downward slightly as the OSD appears.

Additional repro surfaces reported by user:

- Server Select reproduces the issue.
- Subtitle settings or OSD-launched settings/menu UIs reproduce the issue.
- Settings menus opened from the OSD reproduce the issue.

Non-repro / boundary notes:

- Starting from the player and opening the guide or mini guide, then returning and pressing Down for OSD, does not reproduce the drop.
- The issue appears tied to leaving the player for a separate screen or menu surface, not merely opening an overlay while still in the player context.
- This has reportedly been attempted before and may be a resurfaced or incompletely fixed transition/compositor bug.

Impact:

- The playback surface visibly shifts at the exact moment a user returns from a menu and invokes the primary playback controls.
- Because it only happens on the first OSD open after certain UI returns, it is easy to miss in normal OSD-only testing.
- The behavior makes the video plane feel loosely coupled to the HTML overlay stack.

Current-source leads:

- `src/modules/navigation/handlers/NavigationScreenEffectsHandler.ts` hides the OSD and mini guide when leaving the player, then calls `videoPlayer.play()` when returning to the player from another screen.
- `src/modules/navigation/handlers/NavigationKeyModeRouter.ts` routes Down/OK on the player to `requestPlayerOsdIntent({ type: 'toggle' })` when no modal, guide, OSD, or mini guide is active.
- `src/modules/ui/player-osd/styles.surface.css` animates the OSD panel with `transform: translateY(100%)` to `translateY(0)` while the root OSD overlay fades in.
- `src/styles/video.css` owns special video geometry for EPG PiP mode; any stale class or inline geometry after screen returns should be ruled out.
- `src/styles/shell.player-runtime-chrome.css` keeps runtime chrome as an absolute overlay plane with `pointer-events: none`.

Investigation leads:

- Reproduce with Browser Use at `1920x1080`, ideally capturing before/during/after screenshots or video frames for the first OSD open after returning from Server Select and from playback-options/settings menus.
- Compare DOM classes and computed geometry for `#lineup-video-player`, `.video-container`, runtime chrome, and `.player-osd-panel` before leaving player, immediately after returning, during first OSD open, and during second OSD open.
- Confirm whether stale PiP/guide classes, screen visibility classes, focus restoration, or playback resume timing changes the video element's inline top/left/width/height/transform.
- Check whether opening playback options from the OSD leaves the OSD panel in a transformed/hidden-but-still-layout-affecting state before the next player return.
- Add a targeted regression if the root cause is a deterministic class/state cleanup issue; otherwise keep Browser Use visual proof as the primary verification surface.

Likely owners:

- `src/modules/ui/player-osd/PlayerOsdOverlay.ts`
- `src/modules/ui/player-osd/PlayerOsdCoordinator.ts`
- `src/modules/ui/player-osd/styles.surface.css`
- `src/modules/navigation/handlers/NavigationScreenEffectsHandler.ts`
- `src/modules/navigation/handlers/NavigationKeyModeRouter.ts`
- `src/styles/video.css`
- `src/styles/shell.player-runtime-chrome.css`

Verification needs:

- Browser Use proof at `1920x1080` while real channel playback is active.
- Repro through Server Select return.
- Repro or disproof through subtitle/playback-options/settings menu return.
- Negative proof that player -> guide or player -> mini guide -> player still does not produce the drop.
- Confirmation that the first and second OSD opens after return have identical video geometry.

### Updated Remediation Slice Recommendation

1. `EPG focused-cell readability and ticker remediation`
   - Fix unnecessary ticker activation first.
   - Preserve focused series episode tag lane where width allows.
   - Relax movie truncation separately from series.
   - Add adaptive time hiding for constrained series cells only after explicit threshold tests.
   - Follow-up after the focused-cell pass: decide whether all in-cell live badges should become compact dots, then verify current-progress contrast so currently-airing state remains discoverable without visible `LIVE` text.
   - Follow-up after the row-aware episode title pass: decide whether unfocused episode tags should ever render in constrained cells; keep this separate from focused tag-lane preservation and avoid current/live tag rules until the live-badge policy is settled.
2. `Playback return OSD/video-plane stability`
   - Reproduce the first-OSD-open video drop after returning from Server Select and playback-options/settings menus.
   - Audit player return, OSD hidden/showing state, and video geometry/class cleanup.
   - Add deterministic cleanup tests if the root cause is state/class-based; otherwise close with Browser Use visual proof.
3. `Channel Setup actor/director candidate limiting`
   - Investigate actor tag count payloads and count recovery.
   - Decide unknown-count policy and/or per-strategy cap.
   - Update estimate/build warnings so users understand skipped high-cardinality sources.
4. Keep the already-fixed EPG time-header/live-badge remediation closed unless final Browser Use proof finds a regression.

### Fresh-Session Handoff Candidate

```text
NEXT_SESSION_LAUNCHER: lineup-cleanup-plan
TASK: Produce a focused remediation plan for EPG focused-cell readability and ticker behavior from the 2026-05-15 Browser Use follow-up: preserve episode tags on focused series cells where width allows, reduce overly aggressive movie/series truncation, and fix ticker activation when text already fits.
TASK_FAMILY: cleanup/refactor
CLEANUP_SUBTYPE: standalone remediation
TIER: Tier 2 unless discovery shows public EPG presentation/virtualizer contracts must change.
READ_FIRST:
- AGENTS.md
- docs/AGENTIC_DEV_WORKFLOW.md
- docs/agentic/session-prompts/cleanup-plan.md
- docs/agentic/codanna-playbook.md
- docs/architecture/CURRENT_STATE.md
- docs/design/ui-design-language.md
- docs/user-guide/epg.md
- docs/qa/reports/2026-05-14-browser-use-broad-smoke-qa.md
LIKELY_FILES_IN_SCOPE:
- src/modules/ui/epg/view/EPGCellPresentation.ts
- src/modules/ui/epg/view/EPGCellRenderer.ts
- src/modules/ui/epg/view/EPGVirtualizer.ts
- src/modules/ui/epg/styles.cells.css
- src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts
- src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts
- src/modules/ui/epg/__tests__/epg-focused-overflow-style.test.ts
VERIFICATION:
- npm run verify
- Browser Use at 1920x1080 with movie and series rows visible.
- Confirm fitting focused titles do not ticker.
- Confirm focused series cells retain the episode tag lane when width allows.
- Confirm movie cells show more title text without regressing time/live/current readability.
STOP_AND_REPLAN_IF:
- The fix requires changing scheduler/channel data contracts, public virtualizer contracts, navigation routing, persistence, Plex metadata fetching, or channel setup behavior.
- The truncation behavior cannot be made deterministic without a broader design decision.
```

```text
NEXT_SESSION_LAUNCHER: lineup-cleanup-plan
TASK: Produce a focused remediation plan for the resurfaced playback OSD/video-plane stability bug: after leaving active channel playback for Server Select or an OSD-launched menu/settings surface, returning to the player and opening the OSD with Down can make the video plane appear to drop slightly during the first OSD reveal.
TASK_FAMILY: cleanup/refactor
CLEANUP_SUBTYPE: standalone remediation
TIER: Tier 2 unless discovery shows a broader navigation/screen-visibility or player geometry contract rewrite is required.
READ_FIRST:
- AGENTS.md
- docs/AGENTIC_DEV_WORKFLOW.md
- docs/agentic/session-prompts/cleanup-plan.md
- docs/agentic/codanna-playbook.md
- docs/architecture/CURRENT_STATE.md
- docs/design/ui-design-language.md
- docs/qa/reports/2026-05-14-browser-use-broad-smoke-qa.md
LIKELY_FILES_IN_SCOPE:
- src/modules/ui/player-osd/PlayerOsdOverlay.ts
- src/modules/ui/player-osd/PlayerOsdCoordinator.ts
- src/modules/ui/player-osd/styles.surface.css
- src/modules/navigation/handlers/NavigationScreenEffectsHandler.ts
- src/modules/navigation/handlers/NavigationKeyModeRouter.ts
- src/styles/video.css
- src/styles/shell.player-runtime-chrome.css
- relevant player OSD, navigation, and style contract tests
VERIFICATION:
- npm run verify
- Browser Use at 1920x1080 with real channel playback active.
- Confirm first OSD open after Server Select return does not move video geometry.
- Confirm first OSD open after subtitle/playback-options/settings menu return does not move video geometry.
- Confirm player -> guide and player -> mini guide paths remain stable.
STOP_AND_REPLAN_IF:
- The fix requires changing player stream/playback contracts, persisted settings, public navigation contracts, or broad screen-shell ownership.
- Browser Use cannot reproduce the issue and no computed-geometry proof can substitute for the visual failure.
```

```text
NEXT_SESSION_LAUNCHER: lineup-cleanup-plan
TASK: Produce a separate remediation plan for Channel Setup actor/director channel estimate explosion when minimum item count is set, including unknown-count tag policy and possible per-strategy caps.
TASK_FAMILY: cleanup/refactor
CLEANUP_SUBTYPE: standalone remediation
TIER: Tier 2 unless discovery shows Plex metadata fetching contracts or persisted setup config must change.
READ_FIRST:
- AGENTS.md
- docs/AGENTIC_DEV_WORKFLOW.md
- docs/agentic/session-prompts/cleanup-plan.md
- docs/agentic/codanna-playbook.md
- docs/architecture/CURRENT_STATE.md
- docs/qa/reports/2026-05-14-browser-use-broad-smoke-qa.md
LIKELY_FILES_IN_SCOPE:
- src/core/channel-setup/planning/ChannelSetupStrategyBuilders.ts
- src/core/channel-setup/planning/ChannelSetupFacetLibraryExecutor.ts
- src/core/channel-setup/ChannelSetupFacetCountRecoveryWorker.ts
- src/modules/ui/channel-setup/steps/StrategyStepController.ts
- src/modules/ui/channel-setup/steps/StrategyStepInteractionController.ts
- relevant Channel Setup planning/session tests
VERIFICATION:
- Targeted Channel Setup planning tests for actors/directors with known counts and unknown counts.
- npm run verify.
- Browser Use setup estimate proof with `TV Shows Home` and `Movies Home`, actors enabled, min items set to `10`.
STOP_AND_REPLAN_IF:
- Fixing count accuracy requires changing Plex library/tag request contracts, persisted setup config schema, or destructive build behavior.
```
