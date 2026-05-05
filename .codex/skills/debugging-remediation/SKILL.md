---
name: debugging-remediation
description: Use when Lineup has a bug, regression, failing test, unexplained runtime behavior, or user-reported symptom where the cause is unknown or easy to misdiagnose.
---

# Debugging Remediation

## Overview

Use this skill to debug before fixing.

The goal is to turn an unclear symptom into a source-backed explanation, a bounded owner seam, and a verification path. Do not patch from intuition, especially when the user is unsure of the cause.

## Use This Skill For

- user-reported bugs where the cause is unknown
- failing tests, flaky tests, build failures, runtime errors, or unexplained UI/player behavior
- regressions after refactors, cleanup work, or dependency/tooling changes
- webOS/device-only behavior where browser, DOM, media, focus, or timing layers may disagree
- review findings that require reproduction or source audit before accepting the proposed fix

## Do Not Use This Skill For

- pure planning with no concrete symptom
- feature design where the desired behavior is still undecided
- non-behavioral cleanup with no failure or observed risk
- cases where `verification-strategy` alone is enough to choose a proof mode

## Debugging Contract

Before proposing a fix, establish:

- the exact symptom and expected behavior
- the smallest reliable reproduction or best available observational proof
- what changed recently, if relevant
- the failing layer and the nearest owner boundary
- at least one rejected alternative cause with evidence
- the verification mode and command/manual proof that will prove the fix

If a reliable reproduction is impossible, say so and gather enough diagnostic evidence to make the next probe meaningful. Do not fill the gap with confidence language.

## Investigation Sequence

### 1. Frame The Symptom

Record:

- user-visible symptom
- affected route/screen/module/device
- expected behavior
- observed behavior
- frequency: always, intermittent, sequence-dependent, environment-specific, or unknown
- first known bad version, commit, or recent change when available

If the symptom is vague, ask for the one missing detail that blocks reproduction. Otherwise proceed with the best available evidence.

### 2. Reproduce Or Observe

Prefer the cheapest proof that exercises the real boundary:

- targeted unit/integration test for deterministic logic
- `npm test -- <file-or-test-name>` for existing failing tests
- `npm run verify` when UI, navigation, Orchestrator, or Plex behavior may be affected
- local browser/device reproduction for DOM, focus, media, and visual timing issues
- direct log/error/stack-trace inspection for build/runtime failures
- source audit when the failure is already visible in code but not executable in the current environment

For intermittent bugs, build a small reproduction matrix:

| Variable | Values Checked | Result |
|---|---|---|
| environment | local/browser/device/test | pass/fail/unknown |
| sequence | direct path/reopen/switch/retry | pass/fail/unknown |
| timing | immediate/delayed/repeated | pass/fail/unknown |

### 3. Isolate The Layer

Trace from symptom toward the owner:

- UI/focus/motion: `ui-composition-patterns`, UI owner files, CSS, timers, focus cleanup
- storage/settings/server state: `persistence-boundaries`
- Plex auth/discovery/library/stream/subtitle/playback URL: `plex-integration-boundaries`
- composition roots, cross-module ownership, hotspot files: `architecture-boundaries`
- workflow/control-plane failures: workflow docs, launchers, verifier scripts, skill surfaces

Use Codanna first when symbol or doc discovery matters. Fall back to `rg` and direct reads when Codanna is missing, noisy, or insufficient, and record that fallback.

### 4. Build And Test Hypotheses

Keep hypotheses falsifiable:

```text
HYPOTHESIS:
EVIDENCE_FOR:
EVIDENCE_AGAINST:
NEXT_PROBE:
STATUS: open | rejected | likely | confirmed
```

Reject common traps explicitly:

- fixing the stack trace line when the bad value originates upstream
- adding a timeout or retry without proving a timing boundary
- changing UI state locally when the owner is a coordinator/runtime module
- widening a cleanup checklist item to include unrelated residue
- accepting stale detector output without current-source proof
- assuming webOS behavior from desktop browser behavior without a device-specific reason

### 5. Choose The Remediation Seam

Before editing, state:

- chosen owner file/module
- why that owner is closer to the root cause than the symptom surface
- files in scope and out of scope
- stop-and-replan triggers
- whether the task is `standalone remediation`, `checklist-linked` cleanup, feature/design, or mixed

If the fix would change architecture ownership, storage, Plex policy, focus behavior, or tracked workflow behavior, load the matching boundary skill before editing.

### 6. Verify The Fix

Use `verification-strategy` to choose the proof mode:

- `regression-first` when a stable bug reproduction can become an automated test
- `contract-first` when a public/shared contract drifted
- `refactor-invariance` when the bug came from structure but behavior should remain unchanged
- `integration-ops` when the failure crosses runtime/tooling/workflow layers
- `UX-manual` when visual, focus, motion, or device behavior is the proof surface

Run the narrow proof first, then the repo-required gate:

- `npm run verify` for UI, navigation, Orchestrator, or Plex work
- `npm run verify:docs` for workflow/control-plane/reference-doc changes
- targeted tests plus `npm test`/`npm run typecheck` when logic-only TypeScript changes warrant it

## Output Shape

For non-trivial debugging, keep this concise record in the final answer or plan:

```text
DEBUGGING_RECORD
SYMPTOM:
REPRODUCTION_OR_OBSERVATION:
ROOT_CAUSE:
REJECTED_CAUSES:
OWNER_SEAM:
FIX_SUMMARY:
VERIFICATION:
RESIDUAL_RISK:
```

## Common Mistakes

- proposing a fix before reproducing, observing, or source-proving the symptom
- treating user uncertainty as permission to guess
- stopping at the first plausible cause
- using broad verification as a substitute for a root-cause explanation
- letting a symptom file absorb policy that belongs to a runtime, boundary, or owner module
- claiming a bug is fixed before fresh verification evidence exists
