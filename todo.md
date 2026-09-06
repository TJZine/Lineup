# Lineup Backlog (Post-MVP)

Updated: 2026-09-05

This file tracks active and validated backlog work only.
Implemented work has been moved to the "Completed / Removed" section to keep priorities clear.

## Priority 0 (Active)

### Plex Collection Recreation Recovery and Unavailable Initial Channel Recovery

Status: bounded source-reference recovery and result-owned Guide snapshot correction
passed full verification and exact `7e716692` physical navigation/relaunch QA on
2026-09-06. Configuration preservation and repaired-reference persistence passed;
the operator confirmed populated rows, focus, picture/PiP and sound. Investigation
history remains in the recurrence report for future failures. Performance tuning
and the broader recovery contracts below remain open.
Current authority: `docs/plans/2026-09-06-collection-reference-recovery-and-shuffle-continuity.md`.
The earlier Guide loading/retry/warmup fixes did not implement this recovery.
General startup fallback UI and legacy/ambiguous replacement UI remain separate.
The checklist below retains the broader backlog contract; do not mark its deferred
parts complete when the bounded automatic recovery lands.

Observed evidence (LG C3, 2026-09-05):
- Startup stops with `Initial channel switch failed for [channel]: content_unavailable`.
- After TV connectivity was restored, both known connection addresses identified
  the selected Plex server successfully. The stored collection key returned 404
  at both addresses and was absent from all 116 collections across six accessible
  video libraries; all listing pages were complete.
- The operator reports likely daily Kometa collection recreation. Deletion and
  recreation has not yet been corroborated with Kometa configuration/run logs;
  daily membership synchronization alone does not establish key replacement.
- Current startup policy throws on unavailable initial-channel content. The recent
  Guide fixes neither repair source references nor provide startup recovery.
- Installed commit identity remains unverified; do not label this a regression in
  implementation HEAD `57d7a2a4` based on this observation.
- Session evidence:
  `docs/qa/reports/2026-09-05-guide-loading-recovery-validation.md`.

Proposed collection-reference contract:
- [ ] Keep the Plex collection key as the normal lookup identity; retain the
  collection name and owning library/server identity as bounded recovery metadata.
  Existing collection sources store key/name but lack an explicit library field;
  define validation, import/export, and safe enrichment for existing records.
  Never invent a library identity or search another server to repair a channel.
- [ ] On a confirmed missing key, refresh the active profile's collection listing
  within the original server/library. Do not interpret timeout, offline, 401, 403,
  or an empty-but-existing collection as evidence that its identity changed.
- [ ] Auto-rebind only one exact-name candidate in that same library, after
  validating collection type, access, and usable source resolution under current
  server/profile authority. Confirm the original source is still unchanged before
  persisting; do not overwrite a concurrent user edit or newer successful repair.
- [ ] Preserve channel ID, number, ordering, seeds, playback settings, and filters;
  persist the reference update through the public ChannelManager owner. Invalidate
  affected resolution/schedule state and publish/re-prime through existing owners.
- [ ] If no candidate exists, preserve the channel and offer bounded retry: Kometa
  may be between deletion and recreation. Do not delete the channel, rebuild the
  lineup automatically, or introduce unbounded polling/retry storms.
- [ ] If the name changed, multiple candidates match, or trustworthy library
  identity is missing, present a user-selected replacement flow. Never fuzzy-match
  silently or choose the first same-name collection across libraries/profiles.
- [ ] Coalesce concurrent repair attempts and scope refreshed listings to current
  authority. Cancel on profile/server changes, supersession, and shutdown; stale
  results must not persist or publish. Reuse existing queues/cache/request owners.

Proposed startup-recovery contract:
- [ ] Keep the initialized shell usable when only the selected channel's content
  is unavailable. Offer retry, Guide/another channel, and source repair/setup;
  retain the unavailable channel rather than forcing a full rebuild.
- [ ] Agree on the precise TV landing surface and focus behavior before UI work.
  Do not claim playback started or open an empty player as successful startup.
- [ ] Preserve fatal handling for actual initialization/dependency corruption.
  Coordinate with the deferred global-error-overlay policy review below without
  requiring a broad rewrite of all global error handling.
- [ ] Preserve startup currentness, cancellation, shutdown drainage, and the rule
  that hidden schedule warmup starts only after playing playback is established.

Ownership and proof:
- [ ] Put Plex lookup/access classification in Plex library owners, reference
  validation and persistence in channel-source/ChannelManager owners, and startup
  routing in initialization/navigation owners. Keep AppOrchestrator as wiring and
  Guide as a consumer, not a collection-repair or persistence owner.
- [ ] Cover unchanged-key fast path, deleted/recreated same-name collection, a
  temporary disappearance then return, rename, duplicate names, same name in
  another library/server, inaccessible profile, offline/auth failures, empty
  collections, older records lacking recovery metadata, failed persistence,
  concurrent repair, source edits, supersession, and restart after successful repair.
- [ ] Verify preserved channel identity/settings and cache invalidation, with no
  stale schedule publication. Keep same-day schedule-continuity semantics in the
  independent item below; key repair does not guarantee unchanged membership/order.
- [ ] Cover unavailable initial channel with another healthy channel, all channels
  unavailable, D-pad focus and retry, recovery to playback, and genuine fatal
  startup failure. Run risk-matched automated gates and physical LG C3 proof.
- [ ] Validate a controlled collection recreation with verified fixture backup and
  restore. Record counts, match outcome, attempt counts, timings, and persistence
  success only; exclude names, keys, server/profile IDs, URLs, tokens, and raw errors.

Rationale: support collection recreation by Kometa or other Plex automation as a
normal source-lifecycle event. A manual lineup rebuild may temporarily recover an
obsolete reference, but recurring recreation needs durable recovery. No Kometa
dependency or integration-specific scheduler is required.

### Same-Day Channel Schedule Continuity Across Relaunch

Status: response-order invariance for shuffled schedules is implemented and
locally verified under the 2026-09-06 collection-recovery/continuity plan. Actual source
membership/duration drift and daily snapshot policy remain separate, unproven work.

- [ ] Reproduce the observed same-channel program change across a same-day app
  relaunch with sanitized pre/post channel-config, resolved-content, schedule,
  and elapsed-position fingerprints.
- [ ] Determine whether Plex collection ordering, membership, or duration drift
  changes the input to deterministic shuffle despite stable saved seeds.
- [ ] Define the continuity contract for source-library changes: preserve the
  active daily lineup, intentionally regenerate it, or surface that it changed.
- [ ] Fix the proven owner and add regression coverage for same-input schedule
  determinism, controlled source drift, relaunch, and current-program position.
- [ ] Validate on the physical TV without recording media titles, Plex IDs,
  authenticated URLs, tokens, or server identifiers.

Observed symptom:
- The same channel showed a different program after an app relaunch on the same
  day, and the replacement was already substantially in progress. Midnight
  rollover does not explain the observation.

Current hypothesis, not yet a root-cause claim:
- The channel is backed by a shuffled Plex collection. Saved seeds are stable,
  but the resolver preserves Plex response order before seeded shuffle, and the
  phase offset depends on aggregate duration. A source-order, membership, or
  duration change could therefore shift the generated schedule.

Rationale:
- Same-day continuity is a core linear-channel invariant. Treat this as a large,
  independent correctness defect after the Guide loading/recovery P2; do not
  conflate it with Guide rendering latency or terminal loading-state behavior.

### Endpoint Canonicalization Pass (Plex auth + subtitles)

- [ ] Collect live traces on webOS and desktop for Plex Home profile fetch and subtitle extraction flows.
- [ ] Choose canonical endpoint/path variants and remove fallback branches that never succeed.
- [ ] Add/update tests to lock the selected endpoint behavior.
- [ ] Update docs (`docs/development/subtitles.md` and auth docs) with the canonical paths.

Rationale:
- Known endpoint TODOs are still in code (`PlexAuth.getHomeUsers` and `SubtitleManager` fallback paths).
- This is a high-ROI reliability + maintenance cleanup.

### Settings "Clear Cache" Action (real cache clear, not just navigation)

- [ ] Add a user-facing Settings action that triggers cache cleanup.
- [ ] Wire it to existing cache cleanup ownership (`AppLifecycle` and cache-owning modules).
- [ ] Ensure post-clear behavior is deterministic (toast/result + safe re-fetch behavior).
- [ ] Add tests for success/failure paths.

Rationale:
- Cache cleanup infrastructure exists, but there is no clear user action in Settings today.

### Keep-Alive Device Validation (webOS)

- [ ] Validate long-duration playback behavior on real webOS hardware (2+ hour run).
- [ ] Confirm whether current keepalive event approach is sufficient under idle conditions.
- [ ] If not sufficient, define a supported webOS-specific alternative and rollout plan.

Rationale:
- Mechanism is empirical and platform-sensitive; must be validated on device.

### Telemetry Foundation (Opt-in, Privacy-first)

- [ ] Create an opt-in telemetry module aligned with `docs/qa/baselines/2026-02-17-observability-contract.md`.
- [ ] Implement minimal crash/error reporting with strict redaction.
- [ ] Add user-facing opt-in setting and default it to off.
- [ ] Document data handling and privacy policy requirements.

Rationale:
- Needed for production diagnostics, but must stay privacy-compliant and bounded.

---

## Priority 1 (Active)

### Favorites + Reordering UX

- [ ] Implement favorite channels feature (data model + UX + persistence).
- [ ] Add channel reordering UI in Settings/Channel Setup using existing `reorderChannels` capability.
- [ ] Add focused tests for ordering persistence and navigation behavior.

### EPG Focus + Number Entry Spec Tightening

- [ ] Review number entry while Guide is open: currently it attempts a tune,
  then moves Guide focus only after a successful switch. On LG C3, entering
  disposable unavailable channel 391 left playback/focus on the prior channel.
  Decide collaboratively whether Guide number entry should instead focus the
  destination without tuning, with OK selecting playback or unavailable-row
  retry. Cover healthy/unavailable destinations and preserve normal player-mode
  number tuning. This is a UX review item, not an approved behavior change.
- [ ] Finalize and document focus rules for guide open/reopen across source changes (`guide`, `remote`, `number`).
- [ ] Explicitly define number-entry behavior while guide is visible.
- [ ] Align tests/docs with final behavior contract.

### Playback Options Accessibility/Theme Follow-up

- [ ] Add forced-colors treatment for playback-options focused/selected states.
- [ ] Verify selected-vs-focused contrast across Glass, DirecTV, Ember-Steel on TV distance.

### Legacy/Compat Cleanup Pass

- [ ] Inventory remaining compatibility and fallback branches.
- [ ] Remove branches without real-world value or supporting evidence.
- [ ] Keep only paths with explicit current justification.

### Unsupported Channel Content Guardrail (`track` / `clip`)

- [ ] Define the supported scheduled-channel content contract explicitly as `movie` and `episode` only.
- [ ] Add a scheduler/channel-manager guard so unsupported resolved items (`track`, `clip`, and any future non-EPG media types) cannot survive into channel schedules.
- [ ] Cover all known ingress paths with tests:
  - collections
  - playlists
  - manual content
- [ ] Decide product behavior for unsupported items:
  - fail fast and block channel creation, or
  - filter them out with a clear warning
- [ ] Document the single-path pre-MVP rule for unsupported media:
  - do not expand EPG/UI behavior to accommodate music tracks or miscellaneous video types
  - treat those as a separate future feature if ever supported

Verified findings already collected:
- Auto-setup currently limits library-backed channel planning to movie/show libraries in `src/core/channel-setup/ChannelSetupPlanningService.ts` and `src/core/channel-setup/ChannelSetupPlanner.ts`.
- `library` content-source validation already limits `libraryType` to `movie | show` in `src/modules/scheduler/channel-manager/ChannelContentSourceValidator.ts`.
- The remaining gap is downstream in scheduler/channel resolution:
  - collections, playlists, and manual sources can still introduce unsupported item types
  - `ContentResolver` currently preserves item types via `type: item.type as PlexMediaType`
  - the final defensive filter only removes `show`, not `track` / `clip`

Rationale:
- The current EPG contract and focused-cell work assume series/movies only.
- Music tracks and non-series/non-movie video would require separate product/design/runtime treatment and should not leak into the current EPG path.
- This should be solved at the scheduler/channel-content boundary, not by teaching EPG to render unsupported media types.

---

## Priority 2 (Deferred / Scoped)

### Plex JWT Authentication Track (Design-gated)

- [ ] Create/confirm ADR and migration plan for JWT flow (current runtime remains PIN flow).
- [ ] Plan JWK/device-key lifecycle and rollback strategy.
- [ ] Define implementation checkpoints before touching auth runtime.

Note:
- Keep this as a gated design track until endpoint/canonicalization and reliability priorities are complete.

### Bootstrap vs Runtime Global Error Overlay Policy Review

- [ ] Revisit the global error overlay policy in `src/bootstrap.ts` after the next thorough manual QA pass.
- [ ] Confirm whether the current all-fatal behavior is intentionally strict or overly disruptive for production TV flows.
- [ ] Decide and document the final policy for:
  - bootstrap/startup failures
  - uncaught runtime `error` events
  - unhandled promise rejections
- [ ] If the policy changes, implement the chosen mode split together with focused tests in `src/__tests__/bootstrap.test.ts`.

Current behavior:
- `handleBootstrapFailure(...)`, `handleGlobalError(...)`, and `handleUnhandledRejection(...)` all route through the same overlay path in `src/bootstrap.ts`.
- The current overlay contract is effectively fatal for all three paths:
  - applies the fatal overlay styling
  - uses blocking modal semantics
  - steals focus
  - treats the first global failure as an app-wide interruption

Why this is deferred:
- This is a failure-policy decision, not just a styling or cleanup tweak.
- The right answer depends on whether runtime global errors are proving true shell-corruption events or mostly isolated/recoverable faults.
- Without another deliberate QA pass, softening runtime handling risks hiding serious problems; keeping the current policy risks overreacting to recoverable faults and degrading TV navigation UX.

Revisit trigger:
- Complete another end-to-end manual QA pass that explicitly exercises:
  - cold bootstrap and startup failure handling
  - guide/navigation flows
  - playback open, retry, and recovery flows
  - settings and modal focus return flows
  - injected uncaught runtime errors during otherwise-usable sessions
  - injected unhandled rejections during otherwise-usable sessions
- Record whether the current overlay behavior was:
  - appropriately fail-fast
  - too disruptive for recoverable runtime faults
  - too weak to surface broken shell state

Decision options to consider on revisit:

Option A: Keep the current all-fatal policy
- Bootstrap failures remain fatal.
- Runtime global errors and unhandled rejections also remain fatal.
- Pros:
  - simplest policy and easiest to reason about
  - maximizes defect visibility during hardening
  - avoids continuing after unknown shell corruption
- Cons:
  - can turn localized runtime bugs into whole-app interruptions
  - focus-stealing modal behavior is expensive in TV/D-pad UX
  - severity signal is coarse because all global failures look equally fatal
- Best fit when:
  - uncaught runtime failures usually indicate unusable or untrusted app state
  - fail-fast visibility is more valuable than graceful degradation

Option B: Fatal bootstrap, nonfatal runtime by default
- Bootstrap failures stay fatal and modal.
- `window.onerror` and `unhandledrejection` become visible but non-modal runtime errors by default.
- Runtime overlays should avoid forced focus and avoid blocking the rest of the app unless explicitly escalated.
- Pros:
  - better matches failure scope in many cases
  - reduces disruption from isolated async/runtime faults
  - preserves strong startup guarantees while improving in-session UX
- Cons:
  - requires stronger policy discipline and better tests
  - risks underreacting if some runtime global errors actually imply shell corruption
  - some developers may feel bugs are easier to ignore when the app keeps running
- Best fit when:
  - the shell often remains usable after isolated runtime failures
  - QA shows current modal interruption is harsher than the underlying defect

Option C: Fatal bootstrap, classified runtime escalation
- Bootstrap failures stay fatal.
- Runtime global errors start as nonfatal by default, but explicitly classified unrecoverable runtime failures escalate to fatal.
- Example escalation candidates:
  - shell root/focus system corruption
  - unrecoverable navigation/app-shell invariants
  - runtime failures that prove trusted state is gone
- Pros:
  - best long-term policy precision
  - distinguishes isolated faults from app-wide corruption
  - preserves user continuity when safe while still supporting hard-stop escalation
- Cons:
  - highest design and maintenance complexity
  - classification mistakes are costly in both directions
  - needs clear invariants and stronger regression coverage
- Best fit when:
  - the team is ready to define explicit unrecoverable runtime boundaries
  - there is evidence that some, but not all, runtime global failures deserve fatal treatment

Option D: Keep runtime fatal in development/hardening, soften later for release readiness
- Preserve the current all-fatal behavior for now.
- Revisit again closer to release with better QA evidence and runtime diagnostics.
- Pros:
  - preserves maximum visibility while cleanup/hardening is still active
  - avoids premature policy churn
- Cons:
  - delays UX improvement if runtime failures are already being over-treated
  - risks institutionalizing an overly harsh production behavior by inertia
- Best fit when:
  - current priorities favor strict failure surfacing over user-facing recovery polish
  - the team expects more architecture/runtime stabilization work first

Concrete implementation considerations if the policy changes:
- Do not treat this as a CSS-class-only change.
- Revisit all of these together:
  - overlay role (`alertdialog` vs `alert`/other runtime treatment)
  - modal vs non-modal semantics
  - focus-stealing vs passive visibility
  - stacking/z-index behavior
  - dismissibility or retry affordances, if any
  - duplicate-overlay behavior
  - test coverage in `src/__tests__/bootstrap.test.ts`

Examples to evaluate during QA:
- Startup dependency/init failure before the app is usable
  - likely should stay fatal in every option
- A stray unhandled rejection in a secondary async path after the shell is already interactive
  - may be better treated as nonfatal in Options B or C
- A runtime error that leaves navigation/focus root broken
  - may justify fatal escalation in Option C

Recommended default if evidence remains mixed:
- Prefer Option D in the short term.
- If QA clearly shows current runtime handling is too disruptive while the shell remains usable, move to Option B before attempting the more complex Option C.

### EPG Per-Category Custom Color Map

- [ ] Add optional per-category color overrides in Settings.
- [ ] Persist validated category-color map and apply through CSS variables.
- [ ] Preserve `channel.color` override precedence.

### Keyboard Quick Reference Overlay

- [ ] Define final key ownership (Info/Blue/Guide) before implementing overlay trigger.
- [ ] Implement contextual quick-reference UI only after ownership is finalized.

### Storybook Evaluation (Decision, not commitment)

- [ ] Run a short decision spike: Storybook vs current test stack for this vanilla TS UI architecture.
- [ ] If chosen, scope a minimal setup and visual regression path.

---

## Device Validation Required

### Retry Seek Position Preservation

- [ ] Validate on real webOS device: playback resumes at pre-error position after retry.
- [ ] Keep current implementation unless hardware evidence shows regressions.

Note:
- RetryManager already waits for `loadedmetadata` before seek; this is now a validation task, not a code-fix task.

### Keep-Alive Behavior

- [ ] Validate idle playback survival on hardware across extended sessions.
- [ ] Record pass/fail and platform/version in QA notes.

---

## Completed / Removed From Active Backlog

These were previously listed as TODO items but are already implemented or no longer recommended as active backlog items:

- EPG virtualization baseline (DOM cap, pooling, virtualized rendering) is implemented.
- Mixed-content handling strategy (HTTPS-first with fallback ordering) is implemented.
- AbortController-based channel switching (latest-wins queue/abort semantics) is implemented.
- Rate-limiting behavior exists across Plex modules (library/auth/discovery).
- Multiple user profile support (Plex Home profile fetch/switch/select UI) is implemented.
- EPG strategy proposals that imply new fallback paths (for example paginated fallback) are removed from active backlog.

---

## References

- `docs/plans/2026-03-04-epg-performance-risk-register.md`
- `docs/qa/baselines/2026-02-17-observability-contract.md`
- `docs/development/subtitles.md`
