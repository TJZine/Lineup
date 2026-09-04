# Guide Loading Recovery and Startup Warmup Execution Plan

- Status: **Active; Muse implementation received; material implementation-review
  corrections authorized through the configured `worker_luna` role; physical
  validation blocked on an authorized LG C3 operator-access mechanism**
- Task family: high-risk Guide correctness, focus, asynchronous lifecycle, and
  performance
- Planning baseline: commit `b7cb7198` on `code-health`
- Reviewed execution baseline: commit `ddf57b8f` on `code-health`
- Prior handoff:
  [`2026-09-02-guide-schedule-loading-remediation-handoff.md`](./2026-09-02-guide-schedule-loading-remediation-handoff.md)
- Physical evidence:
  [`2026-09-03-guide-schedule-loading-physical-validation.md`](../qa/reports/2026-09-03-guide-schedule-loading-physical-validation.md)
  and
  [`checkpoints.json`](../qa/evidence/2026-09-03-guide-schedule-loading-physical-validation/checkpoints.json)

## Next Session Orchestrator Handoff

Copy this prompt into the next session:

> Work only in `/Users/tristan/Software/Lineup`. Read `AGENTS.md`,
> `docs/AGENTIC_DEV_WORKFLOW.md`, and
> `docs/plans/2026-09-04-guide-loading-recovery-and-startup-warmup-plan.md`
> completely. Treat the plan as the controlling implementation authority and
> preserve every unrelated working-tree change. First dispatch the configured
> read-only reviewer role to adversarially review the plan for correctness,
> ownership, performance/resource risk, proof sufficiency, and execution
> readiness for Meta Muse Spark 1.3. Adjudicate every material finding and amend
> the plan before implementation. Then invoke exactly Meta Muse Spark 1.3 at
> xhigh reasoning to implement the bounded plan without committing. If that
> exact implementor or effort is unavailable, stop and report the availability
> blocker; do not substitute another model. Run focused proof, dispatch a
> read-only reviewer over every changed owner and the net diff, and pass every
> material finding back to Meta Muse Spark 1.3 for correction. Repeat focused
> proof and review only after material changes until all material findings are
> resolved or a genuine authority/product blocker is reached. The orchestrator
> owns integration, final verification, and coherent commits. Test the exact
> implementation commit on the LG C3 using the plan's sanitized physical matrix
> before closing P2. Do not perform a release deployment.

## Goal

Close the Guide loading P2 with truthful, bounded row behavior and improve cold
Guide readiness without delaying Guide chrome or competing with initial playback:

1. A current, settled, non-abort schedule failure becomes a focusable
   `Unavailable — OK to retry` row instead of indefinite `Loading...`.
2. Abort and supersession never publish a stale failure or overwrite newer
   schedule state.
3. Pressing OK on an unavailable row performs one targeted, coalesced foreground
   retry; recovery does not require closing Guide.
4. Guide chrome opens immediately. Schedule work is ordered
   current/focused, actually visible, near overscan, then bounded background.
5. After successful startup routing and stable playback, the existing deferred
   EPG warmup materializes the likely viewport around the current channel at low
   priority. Guide open reuses completed work and adopts or promotes matching
   in-flight work without duplicate resolution or abort/restart churn.

## Frozen Decisions

- Keep the immediate Guide reveal. Add no artificial reveal delay.
- Treat a schedule already held by the EPG component or its existing in-memory
  cache as immediately usable, then refresh within the existing TTL policy.
- Keep the existing two-minute fresh and ten-minute stale in-memory schedule
  cache TTLs. Do not persist schedule snapshots in this scope.
- Keep the existing 390-channel background ceiling of 96 and concurrency of one;
  do not increase either. Startup-hidden work also has concurrency one.
- Do not add a second automatic transport retry in EPG. Plex Library already
  performs bounded timeout, rate-limit, and server-error retries, while the EPG
  owner receives both typed and generic non-abort failures and cannot safely infer
  permanence from error text. Never parse error messages to choose retry policy.
- Every current UI-owning non-abort failure with no usable matching schedule
  settles as unavailable. A failed refresh after a matching stale schedule was
  published preserves that usable ready row and records only the bounded failure
  diagnostic. A hidden-only failure does not publish row state unless a current
  foreground caller adopted it before settlement. User OK is the only EPG-owned
  retry and starts one targeted attempt. Repeated OK presses while that attempt
  is active coalesce into it.
- `Loading...` means an active current attempt only. `Retrying...` means the
  deliberate manual attempt is active. `Unavailable — OK to retry` means the
  current attempt settled unsuccessfully.
- A matching schedule success clears loading/retrying/unavailable state. A new
  schedule range, channel/source replacement, selected-server/profile change,
  Guide-setting invalidation, or full cache clear invalidates the corresponding
  terminal state. Guide close alone may preserve current schedules and terminal
  state, but it cancels active work as it does today.
- Startup warmup is best effort. At the existing 1,500 ms deferred warmup point,
  it may materialize schedules only when startup authority is still current, the
  app reached ready after successful initial routing, EPG initialization
  succeeded, and `IVideoPlayer.isPlaying()` is true. If playback is not playing,
  initialize EPG as today but skip schedule warming; do not poll or add a new
  playback listener.
- Hidden warmup checks playback again before each queued batch. If playback is no
  longer playing, cancel the hidden queue. Foreground Guide work is not blocked
  by that gate.
- The initialization warmup port is abortable and its returned promise settles
  only after hidden schedule work drains. Startup/profile/server supersession,
  quarantine, and shutdown cancel the active warmup; shutdown drains it before
  ChannelManager or player teardown. This remains fire-and-forget after ready and
  must not delay startup routing or Guide chrome.
- Whole-lineup eager warming, new dependencies, compatibility paths, feature
  flags, generic task queues, and persisted schedule snapshots are deferred.

## Non-Goals

- Do not change scheduler generation, channel seeds, Plex source resolution,
  authentication, selected-server persistence, Channel Builder policy, playback
  URLs, subtitle behavior, or the accepted Guide PiP lifecycle.
- Do not redesign Guide visuals. Add only the existing placeholder-cell treatment
  needed to distinguish loading, retrying, and unavailable while preserving
  focus/forced-colors behavior.
- Do not solve general D-pad input latency in this workstream.
- Do not raise foreground or background concurrency to make benchmarks look
  faster.
- Do not add disk/localStorage persistence for schedules or failure state.
- The same-day schedule-continuity defect recorded under Priority 0 in
  [`todo.md`](../../todo.md) is the next independent correctness issue. Do not
  alter ordering, membership, duration, or seed behavior here, and do not record
  media titles, Plex IDs, or other private values while validating this plan.

## Ownership and Likely Files

The implementor may discover the exact smallest file set, but must preserve these
owners:

- Schedule request authority, terminal publication, targeted retry, adoption of
  matching warm work, cache interaction, and resource metrics belong in
  [`src/modules/ui/epg/runtime/`](../../src/modules/ui/epg/runtime/), primarily
  `EPGScheduleRefreshRuntime.ts`, its focused types/currentness collaborators,
  `EPGBackgroundWarmQueue.ts`, and `EPGScheduleCacheStore.ts` only if their
  existing contracts need extension.
- Priority partitioning belongs in
  [`EPGCoordinatorPolicies.ts`](../../src/modules/ui/epg/coordinator/EPGCoordinatorPolicies.ts).
  Do not create another scheduler or queue for four priority tiers.
- Guide open, hidden viewport warming, manual retry intent, and refresh entrypoints
  belong in `EPGCoordinator.ts`, `EPGRefreshController.ts`, and their focused
  contracts. The coordinator decides what to request; the runtime owns attempts.
- Typed row state and its publication seam belong in `types.ts`, `interfaces.ts`,
  and `EPGComponent.ts`. The component owns UI state; it does not resolve Plex
  content or decide retry policy.
- `EPGVirtualizer.ts`, `EPGGridRuntimeController.ts`, `EPGFocusNavigator.ts`, and
  existing cell presentation/style owners render and focus the published state.
  An unavailable placeholder emits a retry intent on OK; a loading placeholder
  remains non-selectable.
- `InitializationCoordinator.ts` owns when the existing deferred warmup runs and
  its startup-authority/playback gate. It calls a narrow, late-bound EPG warmup
  callback. EPG policy must not move into initialization.
- `AppOrchestrator.ts` and existing coordinator assembly contracts may wire only
  the narrow callback/readers required above. They remain composition roots and
  must not gain warmup policy.
- Focused tests belong beside these owners, especially the existing initialization,
  EPG runtime, warm queue, policies, coordinator/controller, component,
  virtualizer, and focus suites.

No new production package or dependency is expected. If implementation appears to
require one, stop and replan first.

## Public Contracts and Invariants

### Row lifecycle

- Use one focused discriminated row-state type. Ready remains represented by an
  actual schedule; do not duplicate schedule data inside the lifecycle state.
- State transitions are observable through the component seam and rendered on the
  next Guide render pass:
  `loading -> ready`, `loading -> unavailable`,
  `unavailable -> retrying -> ready`, or
  `unavailable -> retrying -> unavailable`.
- Only the current request owner may publish or clear row state. Abort,
  supersession, Guide close, settings change, filter change, server/profile
  transition, and shutdown may invalidate work but never publish unavailable for
  the invalidated attempt.
- Failure state is keyed by channel plus the current schedule range. It cannot
  leak into another day/range or a changed channel/source.
- One manual retry targets one channel and the current range. It does not refresh
  every visible channel. It uses the foreground lane and the existing
  cancellation/currentness authority.
- At most one EPG attempt for a channel/range may be active. Repeated retry intents
  coalesce; a later current foreground owner may adopt matching hidden work only
  when channel ID, schedule range key, EPG runtime generation, and an opaque
  channel/source snapshot all match. Adoption retains the hidden operation's
  currentness and adds a foreground publication waiter; it does not transfer stale
  publication authority. Before cache or UI publication, both the producing work
  and the adopting foreground waiter must still be current. If this match cannot
  be proven without a new ChannelManager public revision/identity contract, stop
  and return to planning.
- A failed row remains D-pad focusable. Directional and large page/channel jumps
  preserve focus time and never depend on a real program cell existing.
- OK on unavailable emits the retry intent and consumes the key. OK on loading or
  retrying performs no duplicate work. Program selection behavior is unchanged.

### Priority and warmup

- Preserve the half-open channel-range contract
  `[channelStart, channelEndExclusive)`.
- Partition in exact priority order: live/current channel, focused channel when
  distinct, actually visible rows in display order, nearest overscan rows, then
  forward bounded background look-ahead. Deduplicate by channel while preserving
  first priority.
- A large Guide jump immediately replaces obsolete background priority with the
  destination's focused/visible tier. It does not wait for prior look-ahead.
- Completed hidden work is reused through the existing component/cache state.
  Matching in-flight work with the same schedule range and current identity
  authority is adopted or promoted so the foreground caller becomes the sole UI
  publisher. Nonmatching or stale work is cancelled and cannot publish.
- Foreground work may use the existing foreground concurrency policy. Hidden
  startup work is concurrency one and uses the existing idle/timer yield path.
  Background work never occupies capacity required to start current/focused or
  actually visible work.
- Warmup does not mutate hidden focus, navigation route, selected library, current
  channel, schedule seeds, or persistent state.
- App startup, profile/server supersession, quarantine, shutdown, and Guide close
  retain one explicit cleanup path for timers, listeners, operations, and queues.
  An active hidden warmup is aborted and drained before its ChannelManager/player
  dependencies are disposed.

### Diagnostics and privacy

- Extend the existing bounded EPG diagnostics rather than adding another logging
  store. Diagnostics may record mode, tier, row ordinal, attempt count, state,
  cache outcome, elapsed time, concurrency, queue depth, promotion/reuse count,
  duplicate-prevention count, cancellation reason, and aggregate ready/failed
  counts.
- Record first-visible-ready and all-visible-settled times separately from full
  background-refresh duration.
- Never log channel names, media titles, source keys, rating keys, Plex/server/user
  identifiers, tokens, authenticated URLs, headers, or raw errors.

## Phased Execution

### Phase 0 — Baseline and adversarial plan gate

1. Record `git status --short`, `git rev-parse --short HEAD`, and `node --version`.
   Preserve the known unrelated files and any newer user work.
2. Read this plan and the linked prior evidence, then inspect the current owners;
   current source wins if a historical statement has drifted.
3. Dispatch the configured read-only reviewer role. Review the complete plan for
   correctness, ownership, cancellation/stale-publication risk, playback and
   memory/network budgets, focus/accessibility, proof sufficiency, and readiness
   for exact Meta Muse Spark 1.3.
4. Adjudicate every material finding. Amend this plan before code when a finding is
   valid. Reject style-only expansion and speculative architecture.
5. Stop before implementation if product intent, owner seam, failure-state
   contract, warmup gate, or proof surface is no longer decision-complete.

#### 2026-09-04 adversarial review adjudication

- **Resolved — exact implementor availability:** Meta Muse Spark 1.3 is not a
  configured Codex role, but the installed Muse Code CLI accepts
  `muse exec --model muse-spark-1.3 --reasoning-effort xhigh` and reports the
  exact provider model in its run metadata. Phase 1 must use that execution
  surface; substitution remains forbidden.
- **Accepted — stale-cache failure semantics:** unavailable is limited to a
  current UI-owning attempt with no usable matching schedule. A stale ready row
  survives failed revalidation, and hidden-only failures do not publish.
- **Accepted — adoption identity:** the prior authority-only wording was
  insufficient. Matching now requires range, runtime generation, and an opaque
  channel/source snapshot, plus final producer and foreground currentness.
- **Accepted — warmup cancellation/drain:** the warmup port must own abort and
  drainage, and shutdown must settle it before dependent teardown.
- **Accepted — physical fixture executability:** the current development debug
  API exposes no ChannelManager export/replace/flush/re-prime surface. Phase 5 is
  blocked until the user authorizes an exact operator-only access mechanism; a
  new debug mutation API is not implicitly approved by this plan.
- **Accepted — state-specific accessibility proof:** unavailable must use visible,
  non-shimmering action text and retain focus/forced-colors/reduced-motion
  behavior. This is a bounded presentation/proof requirement, not a redesign.

The reviewer rejected a new queue, dependency, persistence layer, Plex retry,
scope expansion into schedule continuity or D-pad latency, and extraction based
on line count alone.

#### 2026-09-04 implementation review adjudication and authority update

Meta Muse Spark 1.3 produced the initial uncommitted implementation and began its
focused correction pass, then became unavailable when its subscription quota was
exhausted. After that blocker was reported, the user explicitly authorized the
configured read-only `reviewer` role for review and the configured `worker_luna`
role for implementation. This later instruction supersedes the Muse-only
correction requirement below; Phase 3 corrections must use `worker_luna`, remain
bounded to accepted findings, and remain uncommitted for controller integration.

The independent implementation review findings are adjudicated as follows:

- **Accepted — terminal-state request authority:** same-range unavailable rows
  must not automatically retry on scroll or reopen, and a component-held usable
  schedule must remain ready after failed revalidation. Mismatched-range terminal
  state is cleared before a new automatic attempt.
- **Accepted — foreground precedence:** startup warmup must not start or replace
  shared background work once Guide is visible. Both warmup/Guide race orders
  require regression proof.
- **Accepted — active cancellation:** warmup abort must propagate into an active
  hidden resolver so drainage settles without waiting for transport timeout.
- **Accepted — adoption authority and cleanup:** cache publication for adopted
  work requires producer and adopting-foreground currentness; attempt cleanup
  must never release a newer entry's retain. Cover cancelled adoption and three
  overlapping attempts.
- **Accepted — read-only warmup selection:** startup warmup must derive its
  library-filter snapshot without persistence cleanup or any other write.
- **Accepted — performance instrumentation:** record all-visible-settled time,
  counting ready and unavailable visible rows, separately from overscan and full
  background duration.
- **Accepted — nearest overscan order:** after current/focused and visible rows,
  overscan must be globally distance ordered rather than trailing-side-first,
  including after a large jump.

The review otherwise accepted focus, forced-colors, reduced-motion, privacy
payloads, resource caps, and owner placement. Its optional simplification of
`session.debugEnabled || true` may be included only while editing that method;
unconditional sanitized issue diagnostics remain allowed.

The post-correction re-review accepted the fixes above and identified three
remaining material gaps, all accepted for a second bounded `worker_luna` pass:

- **Accepted — held-schedule freshness and identity:** the component-held
  schedule seam must preserve or expose load time plus the same opaque
  channel/source identity used by runtime adoption. A matching held schedule is
  fresh for two minutes, remains usable but revalidates through ten minutes, and
  is unusable after ten minutes. A same-ID source replacement is not a match and
  must not preserve or render the old source after failed refresh. Cover fresh
  reopen, stale revalidation, and same-ID source replacement failure.
- **Accepted — held-ready settlement accounting:** a matching usable held row is
  marked ready immediately for first/all-visible timing and readiness accounting,
  including when its direct or adopted revalidation later fails.
- **Accepted — composition-root proof:** add focused AppOrchestrator assembly
  coverage proving startup warmup options reach the current EPG coordinator and
  shutdown awaits warmup drainage before ChannelManager/player teardown.

The next net-diff review accepted those three corrections and identified two
remaining correctness gaps, both accepted for a third bounded `worker_luna`
pass:

- **Accepted — preserve originating schedule age:** publishing a stale cache hit
  into the component must carry the cache entry's original `loadedAt`; neither a
  cache read nor a failed revalidation may renew that timestamp. Repeated stale
  publications cannot extend usability past ten minutes from the originating
  successful load. Cover multiple failed stale revalidations crossing the
  original ten-minute boundary.
- **Accepted — canonical schedule-source identity:** the opaque identity must be
  deterministic for semantically equivalent content sources regardless of
  object property order and must cover every input that can change schedule
  generation, including playback mode, phase/shuffle/block settings, content
  filters, sort order, duration constraints, and source content. Do not assume a
  caller-supplied `updatedAt` is a monotonic replacement revision. Cover reordered
  equivalent sources as a match and same-timestamp schedule-input changes as a
  mismatch.

The final follow-up review confirmed that both corrections are resolved: cache
publication remains anchored to the originating successful load timestamp, and
the canonical identity is deterministic while covering schedule-producing
inputs. No material findings remain. Per the user's closeout direction, the
review loop ends with that clean verdict.

#### 2026-09-04 architecture attention disposition

The final whole-owner review covered every changed production owner above 500
lines. Each change remains inside its documented responsibility, so line count
alone does not justify extraction in this bounded fix:

- `EPGScheduleRefreshRuntime.ts` owns request authority, cache/adoption
  currentness, failure publication, and metrics; `EPGRefreshController.ts` and
  `EPGCoordinator.ts` retain Guide entrypoint and warmup policy coordination.
- `EPGComponent.ts`, `DeferredEPGComponent.ts`, `EPGVirtualizer.ts`,
  `EPGFocusNavigator.ts`, and `EPGCellRenderer.ts` retain component state,
  deferred-shell parity, projection, focus, and cell presentation respectively.
- `InitializationCoordinator.ts` retains startup warmup timing and drainage;
  `AppOrchestrator.ts` adds composition-root wiring only.

The full repository verification gate passed after the clean review. Physical LG
C3 validation remains open because the authorized operator-access mechanism
required by Phase 5 has not been supplied; P2 is therefore not closed.

### Phase 1 — Dispatch the sole implementor

Invoke exactly Meta Muse Spark 1.3 through Muse Code with
`muse exec --model muse-spark-1.3 --reasoning-effort xhigh`, this amended plan,
and the current task-owned file boundary. Confirm the configured-model event
before accepting edits. The implementor must:

- make no commits and stage no files;
- preserve unrelated changes;
- first add the smallest regression proving a settled non-abort failure remains
  loading today, then implement the row lifecycle and targeted retry;
- reorder existing prefetch partitions instead of creating a new scheduler;
- extend the existing deferred EPG warmup through narrow initialization/EPG
  ownership seams;
- reuse the existing cache, retained-operation authority, visible-range queue, and
  background warm queue;
- run focused tests for each changed owner and report the exact diff and proof.

If Meta Muse Spark 1.3 or xhigh is unavailable, stop and tell the user. Do not
silently substitute a model.

### Phase 2 — Controller inspection and focused proof

The controller inspects every changed owner, not only the diff. Confirm the state
machine, invalidation paths, timer/listener cleanup, priority order, in-flight
adoption, resource caps, and privacy fields directly.

Run the touched focused suites, including as applicable:

```sh
npx jest src/modules/ui/epg/__tests__/EPGScheduleRefreshRuntime.test.ts --runInBand
npx jest src/modules/ui/epg/__tests__/EPGBackgroundWarmQueue.test.ts --runInBand
npx jest src/modules/ui/epg/__tests__/EPGScheduleCacheStore.test.ts --runInBand
npx jest src/modules/ui/epg/__tests__/EPGCoordinatorPolicies.test.ts --runInBand
npx jest src/modules/ui/epg/__tests__/EPGRefreshController.test.ts --runInBand
npx jest src/modules/ui/epg/__tests__/EPGCoordinator.test.ts --runInBand
npx jest src/modules/ui/epg/__tests__/EPGComponent.test.ts --runInBand
npx jest src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts --runInBand
npx jest src/modules/ui/epg/__tests__/EPGFocusNavigator.test.ts --runInBand
npx jest src/core/initialization/__tests__/InitializationCoordinator.test.ts --runInBand
npm run typecheck
npm run lint
```

Do not run untouched suites merely to satisfy this list. Add a focused assembly
test if the narrow startup callback/wiring changes.

### Phase 3 — Independent implementation review and correction loop

1. Dispatch the configured read-only reviewer over the whole changed owners and
   net diff. Include the plan, focused-test results, architecture attention list,
   and measured diagnostic/resource assertions, but not the implementation
   transcript.
2. Require findings on correctness, stale publication, abort/supersession,
   retry/request storms, playback competition, priority inversion, cache bounds,
   focus/accessibility, privacy, architecture cohesion, and missing tests.
3. Adjudicate every material finding. The initial correction instruction targeted
   the same Meta Muse Spark 1.3 implementor at xhigh; the later explicit authority
   update above instead assigns the accepted correction package to the configured
   `worker_luna` role.
4. Rerun affected focused proof and request re-review only when the fix materially
   changes the review surface. Continue until no material findings remain or a
   genuine authority/product blocker is reached. Ignore style-only churn.
5. The controller, not the implementor or reviewer, owns the final net diff and
   verification verdict.

### Phase 4 — Automated closeout and implementation commits

After a clean material review, run:

```sh
npm run verify
npm run verify:docs
git diff --check
git status --short
git diff --stat
```

Inspect the task-owned diff and record the architecture disposition required for
every changed production file over 500 lines. Because EPG composition is a named
hotspot, and `EPGScheduleRefreshRuntime.ts`, `EPGVirtualizer.ts`, and
`AppOrchestrator.ts` exceed 800 lines at the planning baseline, the reviewer must
cover each changed whole owner. Line count alone does not require extraction.

Only after all gates pass, create coherent commits without unrelated files:

1. `fix(epg): publish bounded Guide row recovery`
2. `perf(epg): prioritize and warm the current Guide viewport`

The controller may combine them only if the implementation is inseparable and the
combined commit remains independently reviewable. Record the resulting exact
implementation HEAD; physical validation must use that commit. Do not push unless
the user separately requests it.

### Phase 5 — LG C3 validation of the exact implementation commit

Build/install only the development artifact for the exact implementation commit.
Do not release or deploy a production build.

Before mutating the physical fixture:

0. Resolve and document an authorized operator-access mechanism. Current source
   does not expose ChannelManager backup, replacement, save flushing, or Guide
   re-prime through the development debug API. Do not add or expose a mutation
   bridge without a separate user decision covering its exact API, development-
   only gating, teardown, and proof that it is absent from release builds. Until
   that decision exists, Phase 5 is blocked.

1. Use the running app's public `ChannelManager.exportChannels()` and current
   channel accessor to capture the active lineup plus current-channel identity to
   an operator-only temporary file outside the repository. Record only a checksum
   and channel count in QA evidence.
2. Verify the backup parses and can be restored through the public ChannelManager
   boundary. Do not copy its private contents into logs, chat, screenshots, or the
   repository.
3. Through the same public boundary, create a disposable copy of one non-current
   channel with a unique channel number and a deliberately nonexistent collection
   source key, then replace/persist the test lineup atomically. Do not delete or
   modify a real Plex collection. If this cannot be done through the public owner
   without exposing credentials or private identifiers, stop and choose another
   deterministic failure injection; do not write raw localStorage.
4. After each injected or restored replacement, explicitly re-prime EPG channels
   through an existing public owner or relaunch before judging Guide behavior;
   `replaceAllChannels()` does not itself publish a lineup-change event. Record
   which path was used.

Run these checks with Debug Logging enabled and Subtitle Debug Logging disabled:

#### Terminal failure and recovery

- Open Guide on the disposable row and record sanitized 0, 30, 60, and 180 second
  checkpoints.
- Pass requires the settled request to show
  `Unavailable — OK to retry`, remain focusable, and never return to `Loading...`
  without a current active attempt.
- Press OK once. Confirm exactly one targeted retry, `Retrying...` while active,
  return to unavailable on the still-invalid source, and no sibling-row refresh or
  request storm.
- Restore that disposable channel's valid source while Guide remains open, press
  OK once, and confirm it becomes a real schedule without closing Guide.
- Confirm adjacent successful rows, D-pad movement, large channel jumps, playback,
  and PiP remain healthy throughout.

#### Startup warmup and priority

- Perform one cold relaunch and wait at least ten seconds on stable last-channel
  playback before opening Guide. The first instrumented checkpoint should have
  focus and zero loading cells for the warmed viewport. Target
  first-visible-ready at or below 250 ms and all-visible-settled at or below
  1,000 ms; if missed, report the measurement and keep the performance claim open.
- Perform a second cold relaunch and open Guide immediately, before deferred
  warmup can complete. Guide chrome must appear immediately; current/focused and
  actually visible work must start ahead of overscan/background, and all visible
  rows must become ready or explicitly unavailable without closing Guide.
- Sample ranges near channels 1–20, 90–110, 140–170, 250–280, and 330–350, then
  traverse them in reverse. Record first-visible-ready, all-visible-settled,
  focused row responsiveness, visible loading/unavailable counts, tier order,
  foreground/background request counts, reuse/promotions, cancellations, maximum
  concurrency, playback status, and PiP health.
- A cold healthy-source range should settle its visible rows within the prior
  user-observed ten-second envelope; a miss does not falsify P2 correctness, but
  it blocks calling the performance work complete until the cause is adjudicated.
- Warm reverse traversal should be visually instant and produce no duplicate
  source resolution for schedules still within the existing cache policy.
- Hidden startup concurrency must never exceed one, the 390-channel background
  queue must never exceed 96, and no hidden schedule request may start before
  playback is playing.

After testing, restore the exact backed-up lineup and current channel through the
public ChannelManager boundary, flush saves, relaunch, and verify the channel
count, current-channel identity, and backup checksum match. Remove the temporary
backup only after restoration is proven. Report whether it remains recoverable if
cleanup cannot be completed.

### Phase 6 — Evidence and P2 closeout

Create a new dated report and sanitized JSON under `docs/qa/reports/` and
`docs/qa/evidence/`; do not overwrite the 2026-09-03 historical evidence. Include
the exact tested commit, fixture backup/restore proof, 0/30/60/180 checkpoints, two
cold relaunches, retry counts, tier/resource metrics, focus, playback/PiP, and
privacy statement.

Mark P2 closed only when every correctness acceptance criterion and the fixture
restore pass. If performance targets miss while correctness passes, close P2
truthfully and leave a measured performance follow-up rather than conflating the
verdicts. Update this plan and the prior handoff status, then create a separate
evidence/closeout commit. Do not include private fixture content.

## Automated Acceptance Criteria

- A deterministic non-abort rejection publishes unavailable after settlement;
  no settled failure remains loading.
- Abort, caller cancellation, Guide close, operation supersession, newer refresh,
  filter/settings change, and shutdown publish no stale unavailable state.
- Retry success and retry failure follow the frozen state transitions. Rapid
  repeated OK presses cause one targeted request, not a visible-range refresh.
- A newer successful schedule cannot be overwritten or cleared by an older
  failure/finally block.
- Mixed adjacent success/failure rows render correctly and retain D-pad focus.
- Unavailable action text is visible and non-shimmering, remains focusable, and
  preserves forced-colors and reduced-motion behavior; loading/retrying animation
  does not hide unavailable copy.
- Loading/retrying placeholders cannot tune a channel; unavailable consumes OK as
  retry; normal program selection is unchanged.
- Priority tests prove current/focused, actual visible, overscan, and background
  ordering, including a large jump where preceding overscan cannot delay the
  destination's visible rows.
- Hidden warmup begins only under current startup authority and playing playback,
  uses concurrency one, cancels on lost playback/currentness, and leaves no timer
  or retained operation after cancellation/shutdown.
- Foreground Guide open reuses completed warm schedules and adopts/promotes a
  matching in-flight row without duplicate resolution. Stale/nonmatching work
  cannot publish.
- Existing cache TTL/cap behavior, Guide open/close, focus restoration, current
  live-row preseed, library filter, schedule rollover, and Channel Builder refresh
  tests remain green.
- Diagnostics are bounded and contain no private identifiers or raw errors.
- `npm run verify`, `npm run verify:docs`, and `git diff --check` pass on the final
  implementation.

## Stop or Replan Conditions

Stop and return to the user before widening scope if:

- the exact requested implementor or xhigh effort is unavailable;
- current source cannot represent terminal state without changing scheduler,
  Plex, persistence, or channel-generation public contracts;
- safe in-flight adoption would require retaining work across different
  server/profile authority or allowing stale publication;
- startup cannot prove both current authority and playing playback through the
  existing injected seams;
- the only proposed transient classifier parses message text or duplicates Plex
  retry policy;
- the implementation needs a new dependency, feature flag, persistent schedule
  format, generic queue, or compatibility API;
- device validation requires raw localStorage mutation, private evidence, or an
  unverified destructive lineup operation;
- physical validation lacks a user-authorized operator-access mechanism that can
  back up, replace, flush, and re-prime/relaunch through public owners without
  shipping a release mutation surface;
- playback/PiP regresses, hidden concurrency exceeds one, the background cap
  exceeds 96, requests storm, memory grows without the existing cap, focus becomes
  unusable, or large jumps regress;
- a performance optimization cannot be supported by representative diagnostics
  and LG C3 evidence.

## Rollback

- Keep correctness and warmup changes in separate commits when feasible so startup
  warming can be reverted without removing the terminal failure fix.
- Reverting warmup must restore the existing initialization-only deferred EPG
  warmup and current on-open refresh behavior.
- Reverting terminal-state behavior must not alter channel, Plex, scheduler, or
  persistence data.
- Any physical fixture mutation is rolled back from the verified operator-only
  export through `replaceAllChannels`, followed by a save flush and relaunch proof.

## Completion Statuses

- **Implementation candidate; awaiting physical validation**: clean review and all
  automated gates pass, implementation commits exist, but the exact commit has not
  completed LG C3 proof.
- **P2 closed; performance validated**: terminal failure/retry/recovery, two cold
  relaunches, focus, resource caps, and playback/PiP pass, and warm/cold performance
  targets are met.
- **P2 closed; performance follow-up measured**: all P2 correctness and restore
  gates pass, but a performance target misses with sanitized evidence and a
  separately bounded follow-up.
