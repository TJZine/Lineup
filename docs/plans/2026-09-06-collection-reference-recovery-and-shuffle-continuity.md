# Collection reference recovery and shuffled schedule continuity

Status: active implementation. Controller owns scope and integration. No release.

## Authority and evidence

The operator prioritized these defects on 2026-09-06 after repeated unavailable
rows following a reported daily Kometa refresh, and clarified that the ordering
issue is Plex collection item response order rather than channel list order.
Existing `todo.md` recovery/continuity notes informed this bounded scope.
See `docs/qa/reports/2026-09-06-guide-post-refresh-recurrence.md`.

Exact installed baseline: `bd6368432598e89e86e44c0360eb6b9c31e40338`, verified by
packaged QA manifest and entry digest. Channels 19/20 share an obsolete collection
key. In their saved library, one exact-name replacement has 67 positive-duration
items. No channel-reference mutation was made during diagnosis.

## Controller decisions

1. Preserve a typed distinction between collection HTTP 404 and an existing empty
   collection. Other errors must never trigger identity repair.
2. Existing top-level collection channels may recover automatically only within
   their saved `sourceLibraryId` and current server/profile authority. Require a
   complete listing, old key absent, exactly one case-sensitive name match with a
   different key, and successful filtered source resolution before commit.
   Recovery belongs to foreground content resolution, including visible Guide
   retry and initial tuning. Schedule-only/background resolution retains its
   no-ChannelManager-mutation contract and cannot persist a repaired reference.
3. Reuse existing channel-level library metadata and persistence owners. Do not
   add redundant schema fields. Missing metadata, mixed sources, renamed or
   ambiguous collections stay unavailable; no fuzzy or cross-library matching.
   Preserve existing mixed-channel behavior for a missing collection child (other
   valid children still resolve); do not add mixed-source rebinding. Auth, network,
   and cancellation failures continue to propagate.
4. Preserve channel ID/number/order, seeds, anchor, filters, and playback settings.
   Persist the guarded replacement before publication; persistence failure must
   retain original state. Recheck edits, deletion, scope and consumer authority at
   every asynchronous publication boundary. Share only bounded active work with
   independent consumer cancellation and drain/cleanup on scope transitions.
5. Canonicalize shuffled input by stable media rating key before seeded shuffle
   in the shared scheduler owner. Content-level random ordering delegates there
   too. Sequential and block ordering preserve their existing intentional order.
   Same item identities and durations must yield the same current program/offset
   and window after a response permutation. This may shift existing shuffled
   schedules once on upgrade; no promise of old-version schedule compatibility.
6. Actual membership/duration changes, arbitrary legacy-source repair UI, startup
   fallback UI, and performance tuning remain outside this bounded repair.
7. Device QA exposed stale Guide ownership after a successful key repair. Resolved
   content must carry its exact owned channel snapshot; Guide propagates it into
   generation, publication metadata, cache and in-flight ownership, and compares
   it against current manager state before publication. Do not infer an allowed
   key delta from a later read or silently accept unrelated edits.

## Ownership and proof

- Worker: Plex library missing/listing contract and ChannelManager guarded recovery,
  including operation ownership, persistence and focused tests. No UI or shared
  scheduler writes. Consequential deviations return to controller.
- Controller: shared shuffled ordering, schedule/current-position regression tests,
  documentation, integration, independent review and verification.
- Independent review must target confirmed404 versus empty/auth failures, ambiguous
  candidates, complete listing, caller cancellation, stale state/publication,
  concurrent edits, persistence failure, bounded cleanup, and playback interaction.
- Run full `npm run verify`, commit task-owned changes, build a development artifact
  from that exact implementation, verify installed identity, then use bounded
  physical batches for existing failed rows, relaunch continuity, focus/playback.
- Do not erase earlier evidence or close P2 solely because retries or tests pass.
  Preserve unrelated worktree changes and separate correctness/performance verdicts.

## Progress

- [x] Live failed-reference and usable replacement proof.
- [x] Response-permutation regression fails on baseline (three tests) and passes
  with stable shuffled input (39 focused tests).
- [x] Guarded reference recovery and focused proof.
- [x] Final independent implementation review and remediation; schedule-only
  mutation removed, lifecycle/persistence proof added, foreground EPG retry traced.
  No remaining actionable findings.
- [x] Full `npm run verify` passed, including 4,716 unit tests and dev/lean builds.
- [x] Full verification, exact commit and development device QA (final `7e716692`).
- [x] First development device batch: 19/20 repaired and persisted; 45 normal
  retry repaired in 230 ms. Configuration fingerprint preserved. Physical testing
  exposed a remaining stale Guide snapshot after repair; P2 remains open.
- [x] Snapshot correction: integrated and independently reviewed; full verification
  passed (4,720 unit tests), exact `7e716692` passed physical paging, repaired-row
  publication, configuration preservation, relaunch persistence and final
  row/focus/picture/PiP/sound confirmation. See the recurrence QA report.

The bounded recovery correctness work is complete. Preserve the earlier failing
evidence and deferred broader recovery/continuity contracts. Performance tuning
remains deferred. A separately reported Settings/Guide focus conflict is being
corrected independently; it does not change the recovery candidate verdict.
