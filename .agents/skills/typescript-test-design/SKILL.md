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
- verify visibility-scoped cancellation, instance cleanup, reopen behavior, and
  focus restoration when UI lifecycle ownership changes; retained DOM handlers and
  navigation-owned focus memory need not be discarded on hide;
- prefer focused semantic assertions over giant snapshots, exact internal call
  sequences, or tests that only restate branches;
- keep tests deterministic under `--runInBand` and normal parallel Jest execution.

Use the runbook's [suite selection and verification](../../../docs/AGENTIC_DEV_WORKFLOW.md#verification)
without repeating still-current checks. Confirm the selected Jest config actually
includes the test: unit, contract/policy/types, and tooling suites have different
discovery rules. If the apparent test seam is private, investigate the nearest
observable behavior and existing tests. Choose meaningful proof within the current owner;
do not add a production abstraction solely for test access. Escalate only a
consequential unresolved contract or scope decision.
