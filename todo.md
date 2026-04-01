# Lineup Backlog (Post-MVP)

Updated: 2026-03-04

This file tracks active and validated backlog work only.
Implemented work has been moved to the "Completed / Removed" section to keep priorities clear.

## Priority 0 (Active)

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
