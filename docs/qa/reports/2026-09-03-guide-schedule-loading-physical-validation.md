# Guide Schedule Loading Physical Validation (2026-09-03)

## Status

- Overall result: **INSTRUMENTATION VALIDATED; P2 REMAINS OPEN**
- Target: physical LG C3 with a 390-channel lineup
- Candidate: bounded, sanitized Guide refresh and row-lifecycle diagnostics
- State handling: existing authentication and application data were preserved
- Deployment scope: the updated development app was loaded and launched for this
  user-authorized validation session; no release deployment was performed

The old persisted lineup established the missing behavioral contract. Several
visible collection-backed rows completed source resolution as failures within
tens of milliseconds, yet Guide continued to display `Loading...` after the work
had settled. Closing and reopening Guide did not recover them. The diagnostic
candidate therefore distinguishes a terminal resolution failure from an active
request, but it does not itself add the required failed/unavailable UI state or a
bounded retry policy.

## Fresh-Lineup Matrix

The user replaced the old fixture with a newly built 390-channel lineup. The
review changed 332 channels to 390, with 298 retained, 34 removed, and 92 added;
the build took approximately 110 seconds.

Initial Guide and stationary checks showed zero loading cells, no failed visible
rows, and usable focus. Sampled ranges near channels 20, 100, 150, 260, 340, and
350 all settled with zero loading cells and focus present. User-perceived cold
population ranged from instant to almost ten seconds. Logged full-refresh
durations ranged from about 2.7 to 22.6 seconds because background refresh could
continue after visible rows were usable.

The warmed reverse pass through 340, 260, 150, and 100 was visually instant, with
zero visible failures or loading cells. These results support keeping cold-range
latency separate from the P2 terminal-state correctness defect.

## Relaunch and Reopen

After one full app relaunch without clearing data, the user reported that the
Guide cells populated for a few seconds and then settled. Because the user moved
the Guide slightly to locate the now line, the opening observation was not a
perfectly stationary timing sample. Sanitized checkpoints at 0, 30, 60, and 180
seconds all contained zero loading cells and usable focus. A later Guide
close/reopen was visually instant.

This is **not reproduced in one fresh-lineup relaunch**, not a resolution claim.
The controlling handoff requires more than one clean relaunch and an explicit
terminal behavior before closing the P2.

## Additional Observation

The user observed that the program associated with the same channel differed
across an app relaunch on the same day. The affected channel uses deterministic
shuffle configuration, but determinism also depends on stable source membership,
ordering, and durations. No controlled pre/post fingerprint was captured, so no
root cause or regression claim is made. A later validation should capture a
sanitized channel/config/schedule fingerprint immediately before and after a
same-day relaunch.

## Residual Work

- Define and implement an explicit failed/unavailable row presentation and a
  bounded recovery policy at the EPG runtime/coordinator boundary.
- Repeat a controlled full relaunch and record stationary 0/30/60/180-second
  checkpoints.
- Investigate cold visible-range prioritization separately from P2 correctness.
- Reproduce the schedule-consistency observation with sanitized fingerprints.

Debug Logging was intentionally left On at the user's request for continued work
over the next few days. Subtitle Debug Logging remained Off. No credentials,
media titles, private identifiers, authenticated URLs, or headers were stored in
the evidence.

Evidence: [sanitized checkpoints](../evidence/2026-09-03-guide-schedule-loading-physical-validation/checkpoints.json).
