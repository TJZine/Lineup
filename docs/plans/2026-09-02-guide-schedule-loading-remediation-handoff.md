# Guide Schedule Loading Recovery Remediation Handoff

- Status: **Ready for remediation**
- Task family: Guide schedule loading, retry/recovery, and lifecycle correctness
- Source baseline: commit `47bc6a43`
- Primary evidence: [`2026-09-02 LG C3 collaborative QA`](../qa/reports/2026-09-02-lg-c3-collaborative-qa.md)
- Sanitized checkpoints: [`guide-loading-checkpoints.json`](../qa/evidence/2026-09-02-lg-c3-collaborative-qa/guide-loading-checkpoints.json)

## Goal

Ensure every visible Guide row on a valid persisted channel either publishes a
schedule or enters an explicit, bounded, recoverable failure state. A failed or
superseded request must not leave `Loading...` indefinitely, and a cold relaunch
must establish usable Guide focus without requiring the user to close and reopen
the Guide.

## Non-Goals

- Do not change the accepted Channel Builder-to-Guide black-PiP lifecycle unless
  diagnosis proves a direct dependency.
- Do not enable aggressive preload by default as a substitute for correctness.
- Do not alter Plex authentication, selected-server persistence, channel strategy
  semantics, or scheduler output rules.
- Do not add compatibility paths, speculative caches, or dependencies.
- Burn-in subtitles remain out of scope.

## Reproduced Failure Contract

On a physical LG C3 with a 390-channel lineup:

1. Dense Guide traversal produced batches of up to nine loading cells. Eight
   resolved, while one focused channel remained `Loading...` through 184 seconds.
2. After closing and relaunching the app without clearing data, Guide near channels
   1–9 contained six loading cells and no focused program cell at 0, 37, 69, 126,
   and 183 seconds.
3. PiP playback remained healthy throughout.
4. Closing and reopening Guide recovered all rows in about one second and restored
   focus.

The variable first-occurrence position and immediate Guide-reopen recovery suggest
a refresh ownership, cancellation, publication, or retry-state problem. That is a
diagnostic hypothesis, not a proven root cause.

## Owner Seam and Likely Files

Primary owner: `src/modules/ui/epg/runtime/`.

Likely investigation surface:

- `EPGScheduleRefreshRuntime.ts` for refresh-session authority, in-flight request
  replacement, success/failure publication, and immediate/background phases;
- `EPGBackgroundWarmQueue.ts` and `EPGBackgroundRefreshLease.ts` for retained work,
  backpressure, cancellation, and relaunch/Guide-open ownership;
- `EPGScheduleCacheStore.ts` for loaded/stale/absent state distinctions;
- `EPGRefreshController.ts` and the EPG coordinator for Guide open/close refresh
  lifecycle and focus establishment;
- `EPGVirtualizer.ts` only for presenting explicit loading/failed/retrying states,
  not for owning retries or network work;
- focused EPG runtime/coordinator/cache tests plus physical-device QA.

Preserve current module ownership: retry and refresh authority belong in the EPG
runtime/coordinator seam, while the virtualizer renders published state.

## Required Diagnosis Before Implementation

Capture one sanitized failure with Debug Logging enabled and determine:

- whether each stuck channel has active in-flight work, a settled exception, an
  aborted request, or no scheduled request;
- refresh ID, phase, elapsed age, attempt count, cache result, and cancellation or
  supersession reason;
- whether `_inFlightByChannel` ownership is replaced by a later session without a
  corresponding schedule/failure publication;
- whether the background warm queue reaches settled state, stalls under
  backpressure, or loses work across lifecycle/Guide transitions;
- why closing and reopening Guide repairs the same rows immediately.

Diagnostics must remain bounded and sanitized. Do not emit channel names, media
titles, Plex IDs, rating keys, tokens, authenticated URLs, or headers.

## Required Behavior

- A visible channel request has a bounded lifecycle: loading, success, or explicit
  failed/retrying/unavailable state.
- Visible failures retry with a small capped policy or expose an explicit retry
  action; retries must be cancelable and must not create request storms.
- Superseded sessions cannot publish stale schedules or clear newer ownership.
- Background warming cannot starve immediate visible-channel work.
- Guide focus establishes on a real available cell, or on an explicit recoverable
  row state, without becoming absent indefinitely.
- Guide close/reopen remains safe but is no longer required for recovery.
- Cache and lifecycle behavior remains bounded for large lineups.

The exact retry count, backoff values, and user-facing terminal copy are product
decisions if current source does not already define them. Stop for a decision
rather than inventing permanent policy.

## Acceptance Criteria

- Focused automated coverage proves immediate resolution success, immediate
  failure, retry success, capped repeated failure, cancellation/supersession,
  background backpressure, Guide close/reopen, and app lifecycle restoration.
- Mixed adjacent success/failure rows never render a settled failure as indefinite
  active loading.
- No stale schedule is published after a newer refresh owns the channel/range.
- On the physical LG C3 with a 390-channel fixture, sample channels 1–20, 90–110,
  140–170, 250–280, and 330–350. Record cold first-row time, focus responsiveness,
  request state, and warmed reverse-pass behavior.
- After a full app relaunch without clearing data, visible loading counts reach
  zero or explicit recoverable terminal states by the agreed timeout; focus is
  usable without closing and reopening Guide.
- Existing Channel Builder-to-Guide physical PiP acceptance remains 2/2.

## Verification

- Focused Jest for EPG refresh runtime, warm queue, cache, coordinator, and
  virtualizer presentation. Files include
  `src/modules/ui/epg/__tests__/EPGScheduleRefreshRuntime.test.ts`,
  `src/modules/ui/epg/__tests__/EPGBackgroundWarmQueue.test.ts`,
  `src/modules/ui/epg/__tests__/EPGRefreshController.test.ts`,
  `src/modules/ui/epg/__tests__/EPGCoordinator.test.ts`,
  `src/modules/ui/epg/__tests__/EPGScheduleCacheStore.test.ts`, and
  `src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts`; run
  `npx jest <file>` for each touched area, then `npm run verify` because the
  change touches UI, lifecycle, async workflows, and runtime behavior.
- `git diff --check`.
- Physical LG C3 replay using the sanitized checkpoint matrix above. Enable
  capture via Settings > Debug Logging (see `docs/user-guide/settings.md`; it
  applies immediately and must be restored to Off afterward, per the recording in
  `docs/qa/reports/2026-09-02-lg-c3-collaborative-qa.md`). Store new sanitized
  checkpoints alongside
  `docs/qa/evidence/2026-09-02-lg-c3-collaborative-qa/`.
- Timeout for "visible loading counts reach zero or explicit recoverable terminal
  states" is the evidence cadence already required below (0/30/60/180 seconds);
  no separate timeout is introduced here.
- Pass/fail is behavioral: no visible channel stays in indefinite loading, no
  stale schedule is published after a newer refresh owns the channel/range, and
  Guide close/reopen is safe but no longer required for recovery. The
  `_inFlightByChannel` ownership and warm-queue internals named above remain
  diagnostic evidence for those verdicts, not contract gates.
- Inspect the final diff and preserve the unrelated pre-existing working-tree
  changes.

## Rollback and Stop Conditions

- Keep the change within the existing EPG runtime/coordinator ownership seam so it
  can be reverted without touching Channel Builder or Plex authentication.
- Stop if diagnosis requires changing channel-generation semantics, scheduler
  contracts, Plex request behavior, or persistence format; those are separate
  boundary decisions.
- Stop if instrumentation cannot distinguish abort/supersession from settled
  failure without recording private identifiers; redesign the diagnostic shape
  first.
- Do not claim remediation from a single clean relaunch. Require the full
  large-lineup device replay and explicit 0/30/60/180-second evidence.
