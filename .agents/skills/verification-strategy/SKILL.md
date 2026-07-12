---
name: verification-strategy
description: Use when a Lineup task needs an explicit proof surface or the correct verification depth is unclear.
---

# Verification Strategy

Read the runbook and choose the smallest proof covering the risk:

- regression/contract proof for a stable defect or public contract;
- focused existing tests plus static checks for invariant refactors;
- integration/manual proof for UI, Plex, runtime, packaging, or device behavior;
- structural docs verification for control-plane-only edits.

Record exact commands, expected outcomes, and unavailable proof. Avoid brittle
snapshots or tests that restate implementation details.
