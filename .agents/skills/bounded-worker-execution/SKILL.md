---
name: bounded-worker-execution
description: Use when Lineup has a decision-complete implementation unit suitable for worker_sol_low or the lower-cost worker_luna role.
---

# Bounded Worker Execution

Freeze exact files, ownership, invariants, verification, and stop conditions before
delegation. The unit must be bounded, disjoint from other writers, and cheap to
verify.

Use `worker_sol_low` when local implementation still needs repository comprehension.
Use `worker_luna` only for frozen, repeatable, low-ambiguity execution. Neither role
may discover ownership, design public behavior, diagnose unknown failures, change
architecture, or repair an incomplete packet. The controller reviews the diff,
integrates it, and reruns the proof. Route other delegation through
`parallel-sidecars`.
