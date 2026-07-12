---
name: typescript-test-design
description: Use when adding or changing Lineup Jest tests, fixtures, mocks, fake timers, DOM tests, async workflow tests, contract tests, or regression coverage for TypeScript behavior.
---

# TypeScript Test Design

Protect stable behavior through the nearest public seam:

- reproduce a real defect before adding a regression test; for refactors, prove the
  invariant without mirroring the implementation;
- exercise exported behavior, observable state, DOM output, focus movement, storage
  effects, or boundary requests rather than private fields and bracket probes;
- mock external boundaries such as Plex transport, browser/platform APIs, time, and
  storage—not the collaborator whose behavior the test is meant to prove;
- use realistic typed fixtures and keep them local unless multiple suites share the
  same stable contract;
- await async work explicitly, control promises deterministically, and fail on stale
  completion or unhandled rejection paths;
- restore fake timers, spies, DOM, listeners, globals, and storage after every test;
- verify timer/listener cancellation and hidden/destroyed UI behavior when lifecycle
  ownership changes;
- prefer focused semantic assertions over giant snapshots, exact internal call
  sequences, or tests that only restate branches;
- keep tests deterministic under `--runInBand` and normal parallel Jest execution.

Run the focused suite first, then `npm run typecheck` and the runbook-required gate.
Use full `npm run verify` for UI, navigation, Orchestrator, Plex, runtime, or build
behavior. Stop when the only testable seam is private; that usually signals a missing
production owner or contract rather than a need for test-only access.
