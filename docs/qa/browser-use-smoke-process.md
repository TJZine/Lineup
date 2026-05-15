# Browser Use Broad Smoke QA Process

## Purpose

Use this process for a broad, one-off Browser Use QA pass when the goal is to understand overall app readiness, visual polish, and obvious user-facing issues. This is not a replacement for automated verification or device QA. It is a repeatable manual proof surface for catching integration, layout, copy, and flow problems in the running app.

## When to Use

Use this process when:

- checking whether Lineup feels close to app-complete
- validating first-run flow and main guide behavior after major UI changes
- looking for obvious bugs, broken states, bad copy, clipped layouts, or dead controls
- preparing a bug backlog for further investigation

Do not use this as the only proof when:

- shipping playback changes that require webOS device validation
- validating Plex stream compatibility
- proving long-running reliability
- making a release decision without running the normal verification gate

## Target Surface

- Primary viewport: `1920x1080`.
- Treat smaller viewport results as diagnostic only unless the task explicitly targets desktop/mobile browser layouts.
- Rationale: Lineup is a TV-focused webOS app, and compatible LG TV app surfaces are expected to run at a 1080p app resolution even on 4K TVs.

## Verification Mode

- Primary mode: `UX-manual`
- Classification: `broader integration/manual proof required`
- Supporting commands:
  - use `npm run verify` before or after the Browser Use pass when the QA is part of release readiness or follows UI/navigation/Plex code changes
  - use `npm run verify:docs` when only QA docs/process docs changed

## Session Setup

1. Confirm current workspace:
   - `/Users/tristan/Software/Lineup`
2. Check dirty state:
   - `git status --short`
3. Start the dev server:
   - `npm run dev -- --host 127.0.0.1`
4. Open Browser Use at:
   - `http://127.0.0.1:5173/`
5. Set or confirm target viewport:
   - `1920x1080`
6. Keep a local findings list while testing.

## Evidence Discipline

For each finding, record:

- severity
- screen/flow
- observed behavior
- expected behavior
- repro steps
- whether it was seen at `1920x1080`
- whether it is confirmed, suspected, or environment-limited
- any relevant visible text

Do not overstate:

- playback failures seen only in the local browser
- small viewport layout failures when the release target is 1080p TV
- account/server-specific behavior without a second data point

## Severity Guide

- `P1`: blocks normal first-run, setup, guide entry, or exposes internal/unsafe product behavior.
- `P2`: important user-facing bug or visual issue on the target `1920x1080` surface.
- `P3`: polish issue, confusing state, missing empty state, or incomplete-looking UI that does not block core flow.
- `P4`: non-target, exploratory, or future-platform observation.

## Standard Walkthrough

### 1. First Load / Auth

Check:

- splash or initial startup state
- Plex auth screen layout
- PIN request button state
- QR/code rendering
- countdown or expiry state
- cancel/retry states
- post-link transition into the next screen

Record:

- whether the app advances automatically after PIN link
- whether errors are user-safe
- whether focus states are visible and stable

### 2. Server Selection

Check:

- discovered server list
- empty/no-server state if available
- retry discovery button
- selected/saved server state
- connect transition
- any black/blank transition frames

Record:

- server names only when useful for repro and not sensitive
- whether server selection affects only local Lineup state

### 3. First-Run Audio Setup

Check:

- step title and progress text
- default selected option
- focus ring
- advanced option visibility
- continue button

Record:

- whether the default route is obvious
- whether explanatory copy is readable from TV distance

### 4. Channel Setup Step 1: Libraries

Check:

- all libraries listed
- selected count
- select all / clear all
- card layout
- library metadata counts
- fallback icons/artwork/placeholders
- Back/Next actions

Record:

- selected library count
- any blank or broken-looking visual slots

### 5. Channel Setup Step 2: Build Options

Visit each section:

- Content Sources
- Advanced Sources
- Build Options
- Series Ordering
- Limits
- Priority Order

Check:

- section switching
- focus restoration
- scroll reset
- copy fit
- disabled-state clarity
- dropdown affordances
- estimate summary
- estimate details

Record:

- whether headers and footer actions stay visible after switching sections
- whether estimate succeeds with defaults
- exact user-facing error copy for failures

### 6. Channel Build

Check:

- build starts
- progress messages update
- cancel button state
- done button disabled/enabled state
- final summary

Record:

- number of channels created
- number skipped
- any long stalls or blank frames

### 7. Main Guide / EPG

Check:

- guide grid appears
- channel list aligns with time grid
- current-time marker
- selected program focus
- now-playing detail panel
- artwork/logo/backdrop
- metadata badges
- long titles
- library filter trigger
- scroll and time movement if in scope

Record:

- target-resolution visual quality at `1920x1080`
- any clipping, overlap, unreadable labels, or missing empty states

### 8. Playback Startup

Check:

- whether content starts playing in the local browser
- whether a fallback or error appears
- error dialog readability
- skip/retry action behavior

Record:

- classify local-browser playback failures as environment-limited until device proof exists
- capture exact dialog text
- note whether the guide remains usable afterward

### 9. Guide Utility Controls

Check:

- Subtitles
- Sleep
- Audio
- Library filter

Record:

- whether the control opens a visible panel
- whether unavailable states explain themselves
- whether active/focus states are distinct
- whether menu items can be selected without ambiguity

### 10. Settings

Open Settings with `F3`.

Check categories:

- Audio & Subtitles
- Playback & HDR
- Appearance
- Account
- Developer

Record:

- initial entry layout at `1920x1080`
- top/bottom clipping
- left rail visibility
- profile switch card visibility
- detail pane readability
- long setting copy fit
- dropdown/toggle affordances

### 11. Return / Recovery

Check:

- Back/Esc from settings
- return to guide/player
- whether guide/player layout is still correct
- whether prior focus is restored sensibly

## Browser Use Interaction Notes

- Prefer DOM snapshots before clicking so locators come from visible state.
- Prefer screenshots when the question is visual layout or style.
- Use role/name locators when unique.
- If a role/name is ambiguous, narrow by visible context or choose another unique control.
- Avoid destructive actions unless explicitly requested.
- Treat Plex account/server changes as sensitive; explain before changing persistent account state.
- Selecting a server and building channels affect local Lineup state and should be recorded.

## Suggested Report Template

```markdown
# Browser Use Broad Smoke QA Report (YYYY-MM-DD)

## Scope

## Environment

## Verification Classification

## Walkthrough Log

## Pass Signals

## Findings

### P1 - Title

Status:

Observed behavior:

Repro outline:

Impact:

Investigation leads:

## Target-Resolution Notes

## Deferred / Not Covered

## Recommended Next Review Order
```

## Closeout Checklist

Before ending the QA session:

- target viewport reset or intentionally left documented
- dev server status known
- all findings classified
- target-resolution findings separated from non-target viewport notes
- user-facing copy quoted exactly where relevant
- environment-limited playback findings clearly labeled
- report saved under `docs/qa/reports/`
- process improvements folded into this document when useful
