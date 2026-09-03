# LG C3 Deterministic UI Remediation Orchestrator Handoff

> **Archived — completed remediation handoff. Do not execute.**
> Historical reference only; the remediation scope it describes is closed.
> Start new work from the current QA report or an active plan, not this file.

- Status: **Complete**
- Task family: physical-TV UI correctness and polish
- Primary evidence: [`docs/qa/reports/2026-09-01-lg-c3-physical-qa.md`](../qa/reports/2026-09-01-lg-c3-physical-qa.md)
- Target: physical LG C3, `com.lineup.app`, 1920x1080
- Baseline observed during QA: commit `e648143c` plus the existing uncommitted working tree

## Prompt for the New Orchestrator

Use this plan as the controlling handoff for a bounded remediation pass on the
deterministic LG C3 UI findings. Read the linked QA report and its evidence before
editing. Preserve all existing user changes and Plex state. Use shallow subagent
delegation with one writer for overlapping EPG cell-rendering files, disjoint
writers only where the boundaries below permit it, and independent review before
calling the bundle complete.

Implement only the included scope in this plan. Do not investigate or fix burn-in
subtitles, Channel Builder-to-Guide black PiP, persistent movie schedule loading,
or deep-channel Guide loading in this task. Those require dedicated interactive
physical-device sessions. If one appears during validation, record the observation
and continue with unaffected acceptance checks.

Do not clear application data, reset onboarding, sign out, change Plex/network
state, expose credentials/tokens/server identifiers, or replace the current lineup
without asking the user. Reuse one existing `ares-inspect` session when connected;
reconnect only when it is clearly disconnected. Do not infer physical webOS video
behavior from the inspector screencast.

## Goal

Ship and verify the deterministic UI fixes that can be implemented from confirmed
source/DOM evidence without requiring a separate exploratory playback or schedule-
loading investigation:

1. Make Guide program geometry truthful and remove misleading current-program
   progress bars while retaining the shared now line.
2. Stop focused title/subtitle tickers from activating when the actual text fits.
3. Make Guide lookback labels accurately describe slot-rounded behavior.
4. Remove the inert `showCurrentTimeIndicator` configuration surface if direct
   source inspection confirms it has no consumer.
5. Finish and physically validate the existing Settings selected-toggle styling
   correction across all tabs.
6. Make clear-logo artwork consistently legible across the player OSD, Guide
   information panel, and full Now Playing information overlay.
7. Replace the misleading Channel Builder `Skipped` completion wording with copy
   that matches the counter's proven semantics.

## Explicitly Excluded Dedicated Sessions

### Burn-in subtitle failure and cross-program state leakage

Keep entirely separate. It crosses Plex part selection, stream resolution,
playback recovery, and preference/session ownership and requires repeated interactive
media testing with sanitized diagnostics.

### Channel Builder → Guide black PiP with audio

Keep separate. The suspected first-frame/hardware-plane readiness race is not
proven. It requires fresh Channel Builder completion reproductions, normal Guide-
from-playback controls, and physical-TV video visibility checks. Do not add an
arbitrary timeout in this bundle.

### Persistent and deep Guide schedule loading

Keep both adjacent loading symptoms in one separate performance/recovery session:

- settled movie rows remaining on `Loading...` after cold relaunch;
- transient cold loading around dense TV channels 150+.

That session must begin with debug-enabled physical timing and must distinguish
resolution failure/retry from warming/cache behavior. This bundle must not alter
schedule concurrency, cache sizes, retry policy, channel materialization, or warm-
queue behavior.

### General exploratory QA

Long-duration stability, the full remote matrix, HDR/Dolby Vision, playback mode
coverage, and unrelated onboarding/auth flows remain QA work, not implied
implementation scope.

## Frozen Product Decisions and Invariants

### Guide time model

- Keep one shared horizontal time axis and the vertical now line.
- Preserve each program's real left offset and full duration width, including a
  negative left position when it begins before the visible anchor.
- Let the existing program viewport overflow and edge mask clip offscreen content.
- Remove per-cell bottom progress bars; do not replace them with another current-
  time signal.
- Keep start/end time and duration in focused details.
- Do not stagger rows, add a second Guide mode, add a feature flag, or add a new
  minute-updating elapsed label.
- Preserve D-pad movement, `focusTimeMs`, focus restoration, visible-row
  virtualization, reduced-motion behavior, and the existing DOM budget.

### Ticker activation

- Ordinary single-line overflow is based on actual title/subtitle content width
  versus actual visible text capacity.
- A positive focused-cell `textShiftPx` must not manufacture overflow.
- Fitting text receives no ticker-ready/running class, distance variable, duration
  variable, timer, or animation.
- Genuine overflowing text retains the existing delayed motion and reduced-motion
  suppression.
- Keep clamp-specific measurement separate only where CSS state is genuinely
  required to reveal multiline-clamped content.

### Lookback labels and current-time configuration

- Present the slot-rounded choices as `Current slot`, `At least 15 min`, and
  `At least 30 min`.
- Update the Auto description to remain truthful for its show/movie policy.
- If `showCurrentTimeIndicator` is still unconsumed, remove it from the config type,
  defaults, bindings, and fixtures. The now line remains always present.
- Stop and replan if a real runtime or public consumer is found.

### Settings selected state

- A selected but unfocused toggle uses the same neutral selected treatment as
  comparable Settings controls and has no conspicuous white outline.
- Only the focused control receives the strong orange treatment; focused text is
  white and readable.
- Disabled and selected states remain distinguishable.
- Apply through the shared Settings surface, not tab-specific overrides.

### Clear-logo legibility

- Preserve aspect ratio; never stretch logos or impose a minimum width.
- At 1920x1080, use initial target heights of 60px in the compact player OSD,
  72px in Guide, and 84px in the full Now Playing information overlay.
- Retain a 520px maximum width unless physical layout evidence requires a smaller
  surface-specific cap.
- Estimate the effective contained artwork height from natural aspect ratio,
  target height, and available width. If it would be below 44px, retain/fall back
  to the text title.
- Keep the text title visible until a logo has loaded and passed usability checks.
- Broken, missing, or unusably wide logos fall back cleanly to text.
- Do not add canvas/alpha-bound scanning unless multiple real assets prove that
  transparent outer padding defeats the simpler contract.

### Channel Builder completion semantics

- Do not describe planning exclusions as runtime failures.
- Current source proves that `result.skipped` is mixed: it begins with planning
  exclusions, then the committer adds planned channels that were not attempted
  because of capacity or cancellation. Do not call the total `failed` or
  `excluded`.
- Use deliberately generic, truthful copy: `Created N channels. N candidates not
  created.`
- Keep the existing result contract in this bundle. Splitting the count by reason
  is a separate core build-contract change and is not authorized here.
- Do not change channel selection, planning, or build results merely to change the
  summary wording.

## Current Ownership and Write Boundaries

The orchestrator owns integration and final proof. Keep delegation depth at one.
Subagents must not spawn additional agents.

### Unit 1 — Guide geometry, progress, ticker, labels, and inert config

- Suggested role: `worker` because the settled behavior still requires careful
  interpretation across geometry, presentation, CSS, focus, and config fixtures.
- Exclusive production ownership during the unit:
  - `src/modules/ui/epg/view/EPGScheduledRowCollector.ts`
  - `src/modules/ui/epg/view/cells/EPGCellRenderer.ts`
  - `src/modules/ui/epg/view/cells/EPGCellPresentation.ts`
  - `src/modules/ui/epg/styles.cells.css`
  - `src/modules/ui/epg/styles.classic.css`
  - `src/modules/ui/epg/styles.motion.css`
  - `src/modules/ui/epg/constants.ts`
  - `src/modules/ui/epg/types.ts`
  - `src/modules/ui/settings/SettingsScreenStateController.ts`
- Exclusive test/fixture ownership during the unit:
  - `src/modules/ui/epg/view/cells/__tests__/EPGCellPresentation.test.ts`
  - `src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts`
  - `src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts`
  - `src/modules/ui/epg/__tests__/epg-focused-overflow-style.test.ts`
  - `src/modules/ui/epg/__tests__/DeferredEPGComponent.test.ts`
  - `src/modules/ui/epg/__tests__/EPGChannelList.test.ts`
  - `src/modules/ui/epg/__tests__/EPGComponent.test.ts`
  - `src/modules/ui/epg/__tests__/EPGConfigBindings.test.ts`
  - `src/modules/ui/epg/__tests__/EPGCoordinator.test.ts`
  - `src/modules/ui/epg/__tests__/EPGCoordinatorPolicies.test.ts`
  - `src/modules/ui/epg/__tests__/EPGFocusNavigator.test.ts`
  - `src/modules/ui/epg/__tests__/EPGGridRuntimeController.test.ts`
  - `src/modules/ui/epg/__tests__/EPGRefreshController.lazy-runtime.test.ts`
  - `src/modules/ui/epg/__tests__/EPGRefreshController.test.ts`
  - `src/modules/ui/epg/__tests__/EPGTimeHeader.test.ts`
  - `src/modules/ui/epg/__tests__/buildEPGStartupConfig.test.ts`
  - `src/modules/ui/settings/__tests__/SettingsScreenStateController.test.ts`
  - `src/__tests__/Orchestrator.test.ts`
  - `src/core/orchestrator/__tests__/OrchestratorCoordinatorAssembly.playbackState.test.ts`
  - `src/core/orchestrator/__tests__/OrchestratorCoordinatorFeatureAssembly.test.ts`
- Do not touch schedule refresh/loading runtime, cache, channel resolution, PiP,
  playback, Channel Builder, or clear-logo info-panel code.
- Required focused proof includes pre-anchor geometry, fitting/overflowing movie
  titles, episode titles and subtitles with zero and positive text shifts,
  reduced-motion suppression, focus restoration, and lookback label contracts.
- Run:
  - `npm test -- --runInBand src/modules/ui/epg/view/cells/__tests__/EPGCellPresentation.test.ts src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts src/modules/ui/epg/__tests__/epg-focused-overflow-style.test.ts src/modules/ui/epg/__tests__/EPGComponent.test.ts src/modules/ui/epg/__tests__/EPGConfigBindings.test.ts src/modules/ui/epg/__tests__/EPGCoordinatorPolicies.test.ts src/modules/ui/settings/__tests__/SettingsScreenStateController.test.ts src/__tests__/Orchestrator.test.ts src/core/orchestrator/__tests__/OrchestratorCoordinatorAssembly.playbackState.test.ts src/core/orchestrator/__tests__/OrchestratorCoordinatorFeatureAssembly.test.ts`
  - `npm exec -- stylelint src/modules/ui/epg/styles.cells.css src/modules/ui/epg/styles.classic.css src/modules/ui/epg/styles.motion.css`
  - `npm run typecheck`
  - `git diff --check`

### Unit 2 — Settings selected-toggle physical acceptance

- Controller-owned validation item, not an initial writer unit. The code and test
  already exist and passed the recorded full verification.
- Existing boundary:
  - `src/modules/ui/settings/styles.core.css`
  - `src/styles/__tests__/settings-control-selected-state.test.ts`
- Run before physical validation:
  - `npm test -- --runInBand src/styles/__tests__/settings-control-selected-state.test.ts`
  - `npm exec -- stylelint src/modules/ui/settings/styles.core.css`
- Dispatch a `worker_luna` for only these two files if physical inspection proves
  the existing patch incomplete. Do not rewrite it merely to claim ownership.

### Unit 3 — Clear-logo legibility

- Suggested role: `worker` because three UI owners share one usability rule and
  the effective contained-height proof needs careful interpretation.
- Exclusive production boundary:
  - `src/modules/ui/player-osd/PlayerOsdOverlay.ts`
  - `src/modules/ui/player-osd/styles.content.css`
  - `src/modules/ui/player-osd/__tests__/PlayerOsdOverlay.test.ts`
  - `src/modules/ui/epg/view/info-panel/EPGInfoPanel.ts`
  - `src/modules/ui/epg/styles.info-panel.css`
  - `src/modules/ui/epg/__tests__/EPGInfoPanel.test.ts`
  - `src/modules/ui/now-playing-info/NowPlayingInfoOverlay.ts`
  - `src/modules/ui/now-playing-info/styles.core.css`
  - `src/modules/ui/now-playing-info/__tests__/NowPlayingInfoOverlay.test.ts`
- Reserved optional shared-helper boundary, owned only by this unit:
  - `src/modules/ui/common/ClearLogoPresentation.ts`
  - `src/modules/ui/common/__tests__/ClearLogoPresentation.test.ts`
- Introduce the reserved pure sizing/usability calculation only if all three
  consumers use the same inputs and semantics. Keep layout dimensions in each
  owning stylesheet. Add no dependency.
- Do not touch EPG program-cell geometry/ticker files assigned to Unit 1.
- Run:
  - `npm test -- --runInBand src/modules/ui/player-osd/__tests__/PlayerOsdOverlay.test.ts src/modules/ui/epg/__tests__/EPGInfoPanel.test.ts src/modules/ui/now-playing-info/__tests__/NowPlayingInfoOverlay.test.ts src/modules/ui/common/__tests__/ClearLogoPresentation.test.ts`
  - If the optional shared test file is not created, omit only that path from the command.
  - `npm exec -- stylelint src/modules/ui/player-osd/styles.content.css src/modules/ui/epg/styles.info-panel.css src/modules/ui/now-playing-info/styles.core.css`
  - `npm run typecheck`
  - `git diff --check`

### Unit 4 — Channel Builder generic completion wording

- Suggested role: `worker_luna`; the counter semantics and deliberately generic
  copy are now frozen.
- Exclusive boundary:
  - `src/modules/ui/channel-setup/steps/ChannelSetupBuildStepPresenter.ts`
  - `src/modules/ui/channel-setup/steps/__tests__/ChannelSetupBuildStepPresenter.test.ts`
- Required copy: `Created N channels. N candidates not created.`
- Run:
  - `npm test -- --runInBand src/modules/ui/channel-setup/steps/__tests__/ChannelSetupBuildStepPresenter.test.ts`
  - `npm run typecheck`
  - `git diff --check`
- If implementation requires changing planner/executor result contracts or other
  production files, stop and return the evidence to the orchestrator.

## Architecture Dispositions and Review Gates

These dispositions are required because the bundle changes production owners over
500 lines and an EPG composition surface. Reconfirm line counts against current
source at dispatch.

### `EPGCellRenderer`

- Owner: `src/modules/ui/epg/view/cells/EPGCellRenderer.ts`
- Existing responsibility: program-cell DOM rendering, presentation state,
  secondary text, progress, and focused ticker lifecycle.
- New behavior: remove redundant progress presentation and correct focused ticker
  activation/cleanup.
- Decision: cohesive growth.
- Evidence: both changes alter presentation and timer state already owned by the
  cell renderer; no new lifecycle, transport, persistence, or domain policy enters
  the owner.

### `EPGInfoPanel`

- Owner: `src/modules/ui/epg/view/info-panel/EPGInfoPanel.ts`
- Existing responsibility: Guide detail-panel DOM/presentation and its artwork
  load/error/fallback lifecycle.
- New behavior: enforce the shared clear-logo legibility contract.
- Decision: cohesive growth.
- Evidence: logo acceptance and text fallback already live in this presentation
  owner; the change does not add Plex transport or storage parsing.

### `NowPlayingInfoOverlay`

- Owner: `src/modules/ui/now-playing-info/NowPlayingInfoOverlay.ts`
- Existing responsibility: full Now Playing overlay DOM/presentation and artwork
  load/error/fallback lifecycle.
- New behavior: enforce the shared clear-logo legibility contract.
- Decision: cohesive growth.
- Evidence: the change refines existing image usability/fallback behavior under
  the same overlay lifecycle.

After integration and automated verification, dispatch one fresh `reviewer` with
no implementation rationale. Its single packet must cover the integrated net diff
for correctness and scope plus an architecture/YAGNI review over the complete
current contents of all three owners above, with particular emphasis on the entire
800+ line `EPGInfoPanel.ts`. The reviewer must state whether each remains cohesive
or needs a present-day extraction; line count alone is not a reason to split.

### Read-only sidecars

- Use the single fresh post-integration reviewer defined above. It must examine the
  integrated net diff for correctness, regressions, scope creep, and missing tests,
  and the complete changed large owners for architecture/YAGNI—not only their
  diffs.
- Ask that same reviewer for closure only after a material correction changes its
  review surface. Do not add redundant clean reviewer passes.
- A `monitor` may own a long `npm run verify` wait if useful.
- Do not delegate repeat research already captured in the QA report unless current
  source contradicts it.

## Execution Order

### Phase 0 — Preserve and establish the baseline

1. Use the `large-task-orchestration` process skill. Read `AGENTS.md`, the linked
   QA report, this plan, and only the boundary skills applicable to each unit.
2. Run and record:
   - `git status --short`
   - `git rev-parse --short HEAD`
   - `node --version`
   - `ares-install --version`
3. Inspect the existing diff before editing. The working tree already contains
   validated Channel Builder/planner changes, the Settings CSS fix, tests, QA
   evidence, and unrelated user files. Preserve all of them.
4. Do not stage, commit, push, reset, restore, or clean unless the user explicitly
   requests it. If commits are later requested, use conventional commits and keep
   these units separable.
5. Confirm no active writer already owns any listed file before dispatch.

### Phase 1 — Parallel bounded implementation

Units 1, 3, and 4 may run concurrently only with the exact boundaries above. Unit
2 remains controller-owned physical acceptance unless a post-validation correction
is needed. The orchestrator must halt/reassign a unit before allowing a boundary
expansion that would overlap another writer.

Each worker must:

- inspect current source before editing;
- preserve existing unrelated changes;
- use `apply_patch` for text edits;
- run focused tests, targeted lint/typecheck as appropriate, and `git diff --check`;
- report exact changed files and observed proof;
- stop rather than crossing an excluded investigation boundary.

### Phase 2 — Integrate and independently review

1. Inspect the combined diff and remove duplicated or conflicting policy.
2. Run focused suites for every unit together.
3. Update `docs/design/ui-design-language.md` with the shared clear-logo minimum-
   legibility rule and surface-specific target heights. This controller-owned doc
   change occurs after Unit 3 integration so no worker overlaps it.
4. Run `npm run verify` and read the complete result.
5. Run the single fresh post-integration review defined above and adjudicate every
   finding against current source and tests.
6. After any production TypeScript/CSS correction, rerun affected focused proof
   and then a fresh complete `npm run verify`. Documentation-only corrections need
   `npm run verify:docs` and `git diff --check` instead.
7. Ask the same reviewer for closure only when a material correction changed its
   review surface.

### Phase 3 — Package and physical C3 acceptance

1. Package only after automated verification passes.
2. Deployment is allowed only within the user's requested test workflow. Warn that
   it will disconnect DevTools, then reconnect one inspector when necessary.
3. Preserve authentication, libraries, lineup, and application data.
4. Do not rebuild/replace the lineup solely to validate completion copy without
   first asking the user.
5. Capture sanitized screenshots for materially changed visual states and append
   them to the QA evidence/report.

## Acceptance Criteria

### Guide

- Pre-anchor programs keep truthful full geometry and clip at the program viewport.
- The now line remains aligned across every row.
- No per-cell bottom progress bar remains in DOM, CSS, constants, runtime updates,
  or obsolete tests.
- A short fitting title remains stationary and continuously visible in a
  left-clipped focused cell.
- Fitting episode title/subtitle text remains stationary.
- A genuinely long title still animates only after the intended delay.
- Reduced-motion mode never animates tickers.
- Up/down and left/right navigation preserve the expected focus/time anchor.
- Rapid scrolling shows no stale titles, focus loss, or visual jumps attributable
  to this bundle. Schedule-loading findings are recorded but not fixed here.
- Lookback choices use the frozen truthful labels.
- The now line remains present after inert-config removal.

### Settings

- Across every Settings tab, selected-unfocused toggles have no white outline.
- Focused controls retain a clear orange state with white readable text.
- Selected, disabled, and focused states remain visually distinguishable.
- Focus returns correctly after opening/closing dropdowns or overlays.

### Clear logos

- Representative ordinary and wide logos are legible in all three surfaces.
- No logo is stretched.
- A logo whose contained height would fall below 44px uses the text-title fallback.
- Broken/missing assets preserve the title without flicker or stale prior artwork.
- The Guide info panel does not hide text merely because a logo URL exists; the
  logo must load and pass the usability contract.

### Completion summary

- The completion line reads `Created N channels. N candidates not created.`
- Existing created/not-created numeric values remain unchanged.
- No planner, strategy, or build behavior changes.

## Verification

At minimum, observe and report the exact per-unit commands above, plus:

- `npm run verify`: PASS for the integrated UI/runtime working tree.
- `npm run verify:docs`: PASS after updating the QA report or this plan.
- `git diff --check`: PASS.
- Final `git status --short` and net-diff inspection showing unrelated user files
  preserved.
- Physical LG C3 results for Guide, Settings, and clear-logo acceptance. If the C3
  is unavailable or any required physical check is unperformed, keep this active
  plan incomplete and report the exact physical blocker; never infer success from
  browser/emulator tests.

## Stop and Replan Triggers

Stop the affected unit and return evidence to the orchestrator if:

- truthful program geometry requires changing schedule generation, time-axis
  semantics, or focus ownership beyond the EPG view layer;
- a real `showCurrentTimeIndicator` consumer or supported hidden-now-line mode is
  found;
- ticker correction requires changing schedule loading or virtualizer ownership;
- clear-logo sizing requires Plex metadata/API changes or transparent-padding
  analysis across unproven assets;
- the frozen generic `candidates not created` description is contradicted by a
  counter contributor;
- an existing user change overlaps the proposed patch and intent cannot be safely
  preserved;
- physical validation exposes persistent loading, black PiP, burn-in behavior, or
  another excluded investigation as the blocker;
- focused or full verification fails outside the unit and the failure cannot be
  attributed safely.

## Rollback Boundaries

- Keep each unit's diff independently reversible.
- Keep one Guide writer, but maintain separate integration checkpoints for:
  1. geometry/progress;
  2. ticker activation/lifecycle;
  3. lookback labels/inert config.
  Each checkpoint must be independently reversible without restoring unrelated
  defects from another checkpoint.
- Settings, clear-logo, and completion-copy changes can each be reverted without
  changing domain state or persisted data.
- Do not use destructive Git commands. Preserve QA evidence even if a code unit is
  rolled back.

## Progress

- 2026-09-02: plan created from physical LG C3 QA evidence.
- 2026-09-02: Units 1, 3, and 4 were implemented through the prescribed disjoint
  workers; Settings remained controller-owned because its existing patch passed
  physical validation without correction.
- 2026-09-02: combined focused proof passed 17/17 suites and 468 tests. Final
  `npm run verify` passed 347/347 main suites with 4,568 tests passed and one
  skipped, plus tools, contracts, docs, bundle, and build gates.
- 2026-09-02: the single independent reviewer found two clear-logo P2 issues
  (actual available-width calculation and Guide handler cleanup). Both were fixed
  by the same Unit 3 worker and independently closed. The reviewer accepted
  deferring the harmless dead `nowMs` parameter because complete removal crosses
  the frozen Unit 1 file boundary.
- 2026-09-02: physical C3 validation exposed inline ticker content spans with
  `scrollWidth = 0`; Unit 1 switched ordinary measurement to the rendered content
  rectangle, added device-shaped regressions, reran full verification, and
  received independent closure.
- 2026-09-02: the final package was deployed without clearing app/Plex state.
  Guide geometry/now line/fitting ticker/focus/DOM budget, all-tab Settings
  selected state and dropdown restoration, and the three clear-logo target
  heights passed the bounded physical acceptance recorded in the linked QA report.
- 2026-09-02: the generic completion copy remained source/automated proof only to
  avoid rebuilding or replacing the current lineup solely for validation.
- Dedicated interactive sessions remain required for burn-in subtitles,
  Channel Builder-to-Guide black PiP, and both Guide schedule-loading findings.
