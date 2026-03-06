# Classic EPG Performance Risk Register

Linked plan: no matching implementation plan is currently checked into `docs/plans/` for this register in this clone.

## Purpose

Track possible adverse effects for EPG performance changes, especially medium/high-risk items, with concrete detection signals and rollback steps.

## Baseline Evidence (Current Code)

- `renderGridInternal()` still calls `refreshCurrentTime()` and rebuilds channel IDs each pass: `src/modules/ui/epg/EPGComponent.ts:1855-1865`
- Direct `localStorage` debug-flag reads still exist in hot paths:
  - `src/modules/ui/epg/EPGVirtualizer.ts:102-107`
  - `src/modules/ui/epg/EPGChannelList.ts:456-463`
- `EPGTimeHeader` always builds debug payload when scrolling: `src/modules/ui/epg/EPGTimeHeader.ts:154-165`

## Risk Scale

- `Low`: behavior should remain equivalent; rollback is simple.
- `Medium`: logic flow changes in render/update loops; requires focused TV validation.
- `High`: algorithmic or visual pipeline changes likely to affect UX correctness.

## Register

| ID | Change | Status | Risk | Possible Adverse Effects | Detection Signals | Safe Rollback |
| --- | --- | --- | --- | --- | --- | --- |
| EPG-IMP-001 | Channel-list row node reuse/cache (`EPGChannelList.ts`) | Implemented in branch (uncommitted) | Low | Stale icon/branding/name when row gets remapped; wrong channel art after fast scroll | Rapid scroll up/down shows mismatched branding or stale channel text | `git restore --source=HEAD -- src/modules/ui/epg/EPGChannelList.ts src/modules/ui/epg/__tests__/EPGChannelList.test.ts` |
| EPG-IMP-002 | Virtualizer delta-based update skipping (`EPGVirtualizer.ts`) | Implemented in branch (uncommitted) | Medium | Stale cell title/time badge/focus state if delta predicate misses a field; ticker/focus desync | Program data updates but on-screen title/time does not refresh; focus ring appears on wrong cell | `git restore --source=HEAD -- src/modules/ui/epg/EPGVirtualizer.ts src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts` |
| EPG-IMP-003 | Cached EPG debug-flag reads in utils (`utils.ts`) | Implemented in branch (uncommitted) | Low | Debug toggle takes up to cache window to reflect; logs appear delayed after enabling debug | Toggle debug and observe ~0-500ms lag before logs change | `git restore --source=HEAD -- src/modules/ui/epg/utils.ts src/modules/ui/epg/__tests__/utils.test.ts` |
| EPG-PND-001 | Cache `channelIds` once per channel load (`EPGComponent.ts`) | Implemented (`b92ae94`) | Low | Stale IDs if cache update paths are incomplete after lineup resets | Wrong row schedule mapping after channel reload/reset | Revert only `EPGComponent.ts` change or disable cache field usage |
| EPG-PND-002 | Replace remaining direct debug-flag storage reads with shared helper | Implemented (`8ceb125`) | Low | Debug behavior divergence between modules if helper not used consistently | One module logs while others stop under same debug flag state | Revert helper migration file-by-file |
| EPG-PND-003 | Gate `EPGTimeHeader` debug payload creation behind debug-enabled check | Implemented (`8ceb125`) | Low | Missing time-header debug logs if gate condition is incorrect | Debug enabled but no `EPGTimeHeader.scroll` entries generated | Revert `EPGTimeHeader.ts` gating change |
| EPG-PND-004 | Remove `refreshCurrentTime()` from `renderGridInternal()` and run on dedicated cadence | Not started | Medium | Current-time indicator drifts or updates late while scrolling/focusing | Time indicator lags by >1 minute or snaps unexpectedly during navigation | Immediate revert; restore inline refresh call path |
| EPG-PND-005 | Program-window indexing/binary search for visible range lookup | Not started | High | Incorrect program selection around boundaries/day rollover; missing cells | Edge programs disappear at day boundaries; wrong focused program chosen | Feature-flag or full revert to linear scan path |
| EPG-PND-006 | Theme-glass TV performance mode reducing `backdrop-filter` load | Not started | Medium | Visual regression from reduced blur/contrast; readability issues in glass theme | Theme appears flat or lower contrast; text legibility complaints | Keep existing theme default; rollback perf-mode toggle and CSS variables |

## Not Yet Implemented From Findings List

- `EPG-PND-004` Decouple current-time refresh from render loop.
- `EPG-PND-005` Add schedule-range indexing for visible-window lookup.
- `EPG-PND-006` Add TV-safe glass-performance mode.

## Execution Gate For Medium/High-Risk Items

Before implementing any `Medium` or `High` item:

1. Add a short change note under the relevant row with date, owner, and branch.
2. Capture before/after measurements on device (LG C3 + at least one lower-spec webOS target):
   - Horizontal scrub responsiveness
   - Vertical channel scroll FPS perception
   - Focus movement latency
   - Time-indicator correctness
3. Run:
   - `npm run test -- src/modules/ui/epg/__tests__`
   - `npm run verify`
4. If adverse effects are observed, rollback immediately, then append incident notes.

## Incident Notes Template

Use this block for any observed issue:

- `Date:` YYYY-MM-DD
- `Risk ID:` EPG-PND-xxx / EPG-IMP-xxx
- `Build/Commit:` <sha>
- `Device:` LG C3 / other model
- `Observed Effect:`
- `Steps to Reproduce:`
- `Rollback Performed:` yes/no (command)
- `Follow-up Action:`

## External Best-Practice Notes (2026-03-04)

- MDN Web Storage API: `localStorage` is synchronous, so repeated hot-path reads can block main-thread work; minimize synchronous storage operations in render paths.
- MDN `requestAnimationFrame`: frame work should stay minimal and synchronized to repaint cadence; expensive per-frame work increases jank risk.

## Validation Notes

- `Date:` 2026-03-04
- `Scope:` EPG-PND-001, EPG-PND-002, EPG-PND-003
- `Adverse effects observed: none`
