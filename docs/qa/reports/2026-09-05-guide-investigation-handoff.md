# Guide correctness and performance investigation handoff

Status: investigation and solution design requested; P2 remains OPEN. No release
or production implementation is authorized by this brief. Prepared 2026-09-05.

## Request for GPT-6 Pro with GitHub connector

Investigate Lineup's Guide startup correctness and performance deeply, using the
repository and physical evidence below. Develop evidence-backed solution options
and a recommended, bounded remediation plan. Do not merely tune delays or add
retries until the failure mechanism is established. Challenge the current design
where warranted, but avoid a speculative rewrite. We have spent substantial time
on repeated Guide performance work and need a durable solution with decisive
proof, not another unmeasured patch.

Read the branch `code-health` on `TJZine/Lineup`, including this evidence commit.
Do not assume the default branch contains these files. Analyze production behavior
at exact tested commit `57d7a2a4a4cc80b96d4939eb2405292841559424`; later documentation
commits are not a new tested implementation. If the connector cannot access the
branch or evidence, report that limitation before proposing conclusions.

Read AGENTS.md, docs/AGENTIC_DEV_WORKFLOW.md, and the complete
`docs/plans/2026-09-04-guide-loading-recovery-and-startup-warmup-plan.md`.
Phase 5 governs the physical matrix. The local collaborative-cadence edits in that
plan were pre-existing working-tree changes and are intentionally not included
in this evidence commit. This handoff preserves the operative constraints:
bounded operator batches, individual checkpoints at timing/persisted-state
boundaries, preserve failures, no release, and no production edits during QA.
Read relevant architecture and Plex ownership guidance before designing changes.

## Evidence and confidence

- [Physical chronology and final findings](2026-09-05-guide-loading-recovery-validation.md).
- [Sanitized checkpoints](../evidence/2026-09-05-guide-loading-recovery-validation/checkpoints.json).
- `todo.md`: independent collection recreation/startup recovery, same-day schedule
  continuity, and Guide number-entry UX workstreams. Do not conflate their causes.

The LG C3 ran the exact verified development artifact. Initial stale-installed
startup failure involved a missing collection key; Kometa recreation is an
operator hypothesis, not independently proven. That differs from the fresh-lineup
Guide failure.

The decisive reproduction is normal onboarding rebuild -> Done -> healthy
playback and Guide (operator report) -> cold close/launch -> immediate Guide open
-> several real rows unavailable. No developer replacement occurred between that
build and launch. Thus developer restoration is not a necessary trigger.

Both restored and fresh runs show early Guide refresh invalidations followed by
eight rapid resolution failures in the next refresh. On the fresh run, failures
were 42–59 ms; diagnostics retain failureStage=resolution, but not the actual
thrown exception. Sequence alone does not prove a cancellation bug. The observed
symptom is a startup failure on the tested version; a precise introducing commit
has not been established by a controlled older-version comparison.

Disposable-row checks confirmed terminal unavailable state for three minutes,
one observed collection request on operator OK, retrying for 133 ms, and return
to unavailable. Restoring its valid source and a browser-generated Enter yielded
a real schedule by 582 ms without closing Guide. Distinguish synthetic input from
physical remote proof. Synthetic arrows produced anomalous jumps; later physical
navigation was reported working, without exact per-key measurements.

The warm-opening first sampled frame at 277 ms still had five loading cells;
they became unavailable. Range 340 still had loading at 10.38 seconds on revisit,
and was fully ready by a later 75.58-second observation. Exact settlement time is
unknown. Other ranges and reverse visits were substantially faster. Cell counts
are not row counts. Diagnostic attempt counts are not necessarily HTTP requests.
Retained logs mix launches unless filtered by page time origin. Full concurrency,
priority, warmup preemption, and resource-storm evidence is incomplete.

Restore validation originally failed a raw checksum because exported refresh
metadata changes at runtime. Excluding only lastContentRefresh and canonicalizing
object keys produced identical backup/current configuration hashes, including
array order and current identity. The operator accepted this criterion refinement.
Do not diagnose data corruption from the original raw-checksum mismatch.

Private backups and live device state are not available through GitHub. No titles,
Plex identifiers, authenticated URLs, server identities, or raw private exports
should be requested in published evidence. The current physical failure was left
untouched after capture; do not assume it remains live indefinitely.

## Investigation questions

1. Trace startup, deferred warmup, initial PiP/Guide expansion and range changes
   through EPGRefreshController, EPGScheduleRefreshRuntime, its queues,
   ChannelManager, ContentResolver and Plex request scope/client. Identify who
   owns each request, abort signal, shared producer, cache entry and publication.
2. Explain whether superseding one consumer can abort or poison work adopted by
   another; whether aborted/rejected promises remain reusable; whether cancellation
   gets converted into terminal content failure; and whether source/currentness
   checks invalidate otherwise usable results. Inspect both success and cleanup.
3. Establish the actual exception behind the physical resolution failures. If
   repository evidence cannot establish it, specify the smallest privacy-safe,
   bounded diagnostic capture needed. Rank hypotheses with supporting and
   contradicting evidence; do not present a plausible trace as a proven cause.
4. Explain performance by phase: Plex retrieval, shared-source resolution,
   schedule generation, cache reuse, queue waiting and DOM publication. Investigate
   visible/current priority versus overscan/background competition, duplicate
   consumers of the same collection, main-thread blocking, eviction and cancellation.
5. Separate genuine missing/inaccessible content from interrupted transient work.
   Preserve honest terminal states and bounded explicit retry without masking
   failures, retry storms, or indefinitely showing Loading.
6. Specify startup consistency, schedule determinism and persistence invariants.
   Treat collection key recreation and ordering/membership drift as separate
   contracts unless evidence establishes a connection to this failure.

Useful source entrypoints (follow callers and tests, not just these files):
- src/modules/ui/epg/runtime/EPGScheduleRefreshRuntime.ts
- src/modules/ui/epg/runtime/EPGBackgroundWarmQueue.ts
- src/modules/ui/epg/runtime/EPGVisibleRangeRefreshQueue.ts
- src/modules/ui/epg/coordinator/EPGRefreshController.ts
- src/modules/scheduler/channel-manager/resolution/ContentResolver.ts
- src/modules/scheduler/channel-manager/ChannelManager.ts
- src/modules/plex/library/PlexLibraryRequestScope.ts
- src/modules/plex/library/PlexLibraryRequestClient.ts

## Comparable implementations are a required research input

Research how comparable TV-guide systems handle these problems. Start with
primary source code and official documentation from candidates such as Kodi,
Jellyfin, and relevant Plex-backed virtual-channel projects. Select references
based on actual architectural relevance, not popularity. Investigate commercial
apps only where public evidence exists; label observed UX separately from unknown
internals. Do not claim proprietary implementation details from appearance.

For each useful reference, cite exact source links and version/commit or access
date. Explain its approach to viewport virtualization, guide-data precomputation,
request coalescing, cancellation ownership, cache lifetime, foreground priority,
startup playback competition and failure/retry UX. Distinguish server-provided EPG
from Lineup's on-device deterministic schedules, and assess transferability to LG
C3/webOS constraints. Provide a comparison table with evidence, applicability,
tradeoffs and what should NOT be copied. External research has not been performed
as part of this evidence publication; it is a required part of the investigation.

## Required output and decision gates

Deliver a causal analysis with confidence levels and missing proof; a correctness
and performance bottleneck map; the primary-source comparison; and a small set of
solution options with tradeoffs. Recommend the simplest complete approach that
fits existing ownership, stating when architectural change is justified.

Produce independently verifiable remediation units, concrete regression tests,
required diagnostics, rollback notes and a physical validation matrix. Include
cold immediate/deferred Guide opening on a fresh lineup, overlapping refreshes,
shared-source cancellation/reuse, genuine missing content, manual recovery,
forward/reverse ranges, bounded resource use and uninterrupted playback/PiP.
Preserve targets and distinguish sampled bounds from exact event timings.

No code changes, model-specific implementation dispatch, or P2 closure by this
research task. Return a decision-ready proposal for user review. Implementation
and independent review follow separately; physical reruns must use the resulting
exact commit. Do not reclassify observed failures as passes to close the checklist.
