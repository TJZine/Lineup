# Guide Schedule Loading Recovery Remediation Handoff

- Status: **Instrumentation candidate physically exercised; P2 remains open**
- Task family: Guide schedule loading, retry/recovery, and lifecycle correctness
- Source baseline: commit `af709c8f` (`code-health`, synchronized with `origin/code-health`)
- Primary evidence: [`2026-09-02 LG C3 collaborative QA`](../qa/reports/2026-09-02-lg-c3-collaborative-qa.md)
- Sanitized checkpoints: [`guide-loading-checkpoints.json`](../qa/evidence/2026-09-02-lg-c3-collaborative-qa/guide-loading-checkpoints.json)
- Parent acceptance: Channel Builder-to-Guide black PiP is physically confirmed 2/2

## Prompt for the New Orchestrator

Use this document as the controlling handoff for source diagnosis, one bounded
implementation candidate, automated regression coverage, independent review, and
sanitized diagnostic preparation for the persistent Guide schedule-loading P2.
Work only in `/Users/tristan/Software/Lineup` and preserve every existing user
change.

Do not perform device testing, package or deploy an IPK, run `ares-*`, rebuild the
user's lineup, or change persisted Plex or Lineup state during the implementation
session. Physical LG C3 validation is a later task. The maximum closeout status for
the implementation session is **implementation candidate complete; awaiting
physical validation**.

This is not a general Guide performance task. The P3 queued-input/navigation lag
is a separate workstream and must not be folded into this remediation unless the
P2 root cause directly proves shared ownership. Do not change the accepted
Channel Builder-to-Guide lifecycle, Plex authentication, subtitle behavior, or
channel-generation policy.

Before source work, record:

```sh
cd /Users/tristan/Software/Lineup
git status --short
git rev-parse --short HEAD
node --version
```

The baseline had unrelated local files including `scorecard.png`, subtitle audit
artifacts, and remediation briefs. Do not stage, commit, reset, clean, overwrite,
or incorporate them.

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

Current architecture additionally establishes that `EPGRetainedOperationContext`
owns opaque selected-server transaction authority through priming and schedule
refresh, visible requests coalesce only within one authority, and detached
background work must retain that authority through settlement. Treat this as an
invariant to verify, not as proof that the current implementation satisfies it.

## Orchestration Model

The primary orchestrator owns source adjudication, integration, the hypothesis
ledger, and final verification. Keep delegation depth at one.

### Phase 1 — Parallel read-only diagnosis

Dispatch exactly two read-only agents before any writer:

1. An `explorer` traces one visible-range request from Guide open/scroll through
   coordinator, refresh session, immediate queue, background queue, Plex schedule
   request, cache/publication, virtualizer state, focus establishment, Guide
   close/reopen, app pause/resume, and shutdown. It must identify every authority,
   cancellation, ownership-replacement, and terminal-state boundary.
2. A `reviewer` adversarially compares the physical evidence and current tests
   against these hypotheses: orphaned/replaced in-flight ownership, swallowed or
   misclassified failure, background starvation/backpressure, stale cache/loaded
   markers, lifecycle restoration loss, and presentation-only loading state. It
   must reject speculative retries or timer changes unsupported by source.

The controller must inspect the owners directly and record, before dispatching a
writer:

- the failing lifecycle contract and source-supported root cause, or the precise
  evidence still missing;
- the owner of that contract;
- the smallest correction or diagnostic-only candidate;
- why rejected alternatives do not match the evidence;
- the physical uncertainty left for the later LG C3 pass.

If current source plus existing sanitized evidence cannot establish a truthful
behavioral correction, do not invent retry policy. Add only the smallest bounded,
privacy-safe diagnostic probe and stop at an instrumentation candidate.

### Phase 2 — One bounded writer

Dispatch one `worker` after adjudication. This is a cross-boundary asynchronous
lifecycle defect, not a multi-writer task. The worker owns the approved EPG
runtime/coordinator files and focused tests; no other agent writes concurrently.

Prefer the existing request/session/cache owners and one typed terminal-state
contract. Do not create a generic task queue, compatibility wrapper, feature flag,
continuous poller, speculative cache, or new dependency. Preserve the accepted
black-PiP lifecycle and ordinary Guide open/close behavior.

### Phase 3 — Independent source review

After focused proof passes, dispatch an independent read-only `reviewer` over the
whole changed owners, not only the diff. It must review correctness, stale
publication, cancellation, resource cleanup, retry/backpressure bounds, privacy,
focus behavior, architecture cohesion, and missing tests. Adjudicate every material
finding and re-review only after a material correction.

Then run the required local closeout gates. Do not package, deploy, or perform the
deferred physical matrix in this session.

## Required Diagnosis Before Implementation

Use the existing physical report, sanitized checkpoints, current diagnostics, and
current source to determine:

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

If these questions cannot be answered without another device observation, the
implementation session may add a bounded sanitized probe, but it must defer the
actual capture to the later physical-validation session.

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

The refreshed baseline at `af709c8f` passed `npm run verify` on 2026-09-03 with
4,592 main tests, 52 tool tests, 94 contract tests, documentation validation,
bundle validation, and the development build. This is context only; rerun the
required gates after the new implementation.

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

## Implementation-Session Closeout

The closeout report must state:

- source-supported cause or the remaining hypothesis;
- owning boundary and why the change belongs there;
- production, test, and diagnostic files changed;
- focused and full automated verification actually observed;
- independent-review findings and their disposition;
- what remains unproven without the physical LG C3;
- exact next steps for the deferred large-lineup physical replay.

Set the status to **Implementation candidate complete; awaiting physical
validation** only after focused proof, `npm run verify`, `npm run verify:docs`,
`git diff --check`, diff inspection, and a clean independent review. Do not mark
the P2 resolved until the physical acceptance matrix passes.

## 2026-09-03 Physical Validation Outcome

The bounded diagnostic candidate was exercised on the LG C3 after the user
explicitly authorized physical testing. The implementation did not add retry or
terminal-state policy because source diagnosis did not establish a truthful
policy to implement.

- The prior persisted lineup reproduced the defect: visible collection-backed
  rows settled as source-resolution failures but remained presented as
  `Loading...`. Closing and reopening Guide did not recover those rows. This
  confirms that a non-abort terminal failure can lack a terminal UI state.
- A freshly rebuilt 390-channel lineup showed zero persistent loading cells and
  retained Guide focus across the required sampled ranges. Cold population varied
  from visually instant to roughly ten seconds; the warmed reverse pass was
  visually instant. That latency is a separate performance workstream.
- One full app relaunch without clearing data reached zero loading cells with
  focus present at the 0/30/60/180-second checkpoints. Closing and reopening Guide
  was also visually instant. This is recorded only as a non-reproduction in one
  relaunch, not proof that the P2 is resolved.
- A separate same-channel program-consistency observation after relaunch remains
  unproven and requires a controlled, sanitized pre/post fingerprint capture.
- Debug Logging was intentionally left enabled at the user's request for ongoing
  testing. Subtitle Debug Logging remained disabled.

See the [physical validation report](../qa/reports/2026-09-03-guide-schedule-loading-physical-validation.md)
and [sanitized checkpoints](../qa/evidence/2026-09-03-guide-schedule-loading-physical-validation/checkpoints.json).

The next P2 step is a second controlled full relaunch and an explicit product
decision for failed-row presentation and bounded recovery. Do not treat the fresh
lineup's clean run as behavioral remediation.
