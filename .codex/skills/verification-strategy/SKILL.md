---
name: verification-strategy
description: Use when a Lineup task needs an explicit verification mode and proof surface without defaulting every change to fail-first TDD or brittle tests.
---

# Verification Strategy

## Overview

Use this skill to choose the smallest verification mode that still proves the change safely.

Verification is mandatory. Fail-first TDD is not.

The goal is to leave every non-trivial Lineup change with an explicit proof story:

- what kind of evidence is required
- which commands or manual checks produce it
- why that evidence is enough for this seam
- why new tests are or are not justified

## Use This Skill For

- Planner sessions that need to lock verification before freezing a tracked plan
- Implementation work where the proof surface is unclear
- Refactors, workflow changes, prompt changes, or boundary work that could invite brittle or low-signal tests
- Deciding whether to add a new test, rely on existing coverage, or use broader integration/manual proof

## Do Not Use This Skill For

- Tasks that truly need no work beyond the repo-default verification gate already named by the parent task
- Cases where the real issue is unresolved product or architecture intent; resolve that seam first
- Excuses to skip verification entirely

## Verification Modes

Choose one primary mode. Add one supporting mode only when the seam genuinely needs two proof surfaces.

### `regression-first`

Use when fixing a concrete bug or behavior regression with a stable reproduction.

- Prefer a targeted regression test or reproducible failing proof before the fix when the seam is stable.
- Good fit for logic bugs, state bugs, and control-plane regressions with deterministic inputs.
- Usually maps to `new regression/contract test required`.

### `contract-first`

Use when the risk is a shared/public contract drifting unexpectedly.

- Protect the exact contract that must hold: schema, prompt contract, verifier rule, public helper boundary, or stable payload shape.
- Prefer narrow assertions over broad snapshots.
- Usually maps to `new regression/contract test required`.

### `refactor-invariance`

Use when changing structure while preserving behavior.

- Start from existing coverage, static checks, and source audit.
- Add new tests only if the current seam is under-protected.
- Usually maps to `existing coverage sufficient` or `no new automated test needed`.

### `integration-ops`

Use when correctness lives across multiple layers or the repo workflow itself.

- Prefer high-signal integration commands, smoke checks, verifier runs, and end-to-end proof over low-value unit mocks.
- Good fit for workflow/control-plane changes, toolchain changes, orchestration, or runtime seams.
- Usually maps to `broader integration/manual proof required`.

### `UX-manual`

Use when the important proof is visual, focus-related, motion-related, or otherwise human-observable.

- Name the exact manual script, screenshots, or behavior checklist.
- Pair with automation only when automation can actually protect the same seam.
- Usually maps to `broader integration/manual proof required`.

### `spike`

Use only for bounded exploration where the output is learning, not a durable behavior guarantee.

- Keep the scope explicit and temporary.
- Do not add speculative tests for code that may be thrown away.
- If the spike lands durable behavior changes, switch to a non-spike mode before closeout.
- Usually maps to `no new automated test needed` only while the work remains exploratory.

## Guardrails Against Brittle Tests

- Test stable behavior seams, not helper internals that are expected to move.
- Avoid snapshots unless the snapshot itself is the contract and small enough to review.
- Do not add mocks for boundaries you own just to make a test easy to write.
- Do not add a new test when existing coverage already protects the exact seam.
- Do not force unit tests onto workflow, docs, visual, or ops changes when verifier, integration, or manual proof is the real signal.
- If the proposed test would mostly restate the implementation, choose a different proof mode.
- If you cannot explain what regression the test would catch, do not add it.

## Required Output

Before implementation or plan freeze, state:

- primary verification mode
- plan classification:
  - `new regression/contract test required`
  - `existing coverage sufficient`
  - `broader integration/manual proof required`
  - `no new automated test needed`
- exact commands and/or manual proof steps
- expected outcomes
- why that proof depth matches the risk
- why new tests are or are not needed

## Common Mistakes

- treating "verification" as synonymous with fail-first TDD
- adding tests that lock internal structure during a refactor
- writing broad snapshots where one narrow assertion would do
- using manual proof as a vague escape hatch instead of naming the exact checklist
- skipping verification because the change is "just docs" or "just workflow"
