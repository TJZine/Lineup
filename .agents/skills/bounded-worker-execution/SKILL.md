---
name: bounded-worker-execution
description: Use when Lineup has a bounded implementation unit suitable for the cost-efficient worker_luna role.
---

# Bounded Worker Execution

Freeze the outcome, owner seam, contracts, acceptance criteria, verification, and
stop conditions before delegation. The unit must be bounded and disjoint from other
writers. Require exact files only when concurrent writers or sensitive shared
surfaces need collision protection.

Use `worker_luna` by default for delegated implementation when the outcome, owner
seam, contracts, acceptance criteria, and direct proof are clear. It may discover
exact files, use repository comprehension and routine local design judgment, add
focused tests, and diagnose failures caused by its implementation. It must stop
when evidence exposes unresolved product intent, ownership, public behavior,
architecture, proof depth, dependency or compatibility policy, or scope expansion.
The controller reviews the diff, integrates it, and reruns the proof. Use `worker`
instead when a settled bounded unit needs material local design judgment,
cross-boundary comprehension, complex diagnosis, or proof interpretation; return
unresolved product, owner, contract, architecture, or proof decisions to planning.
Route other delegation through `parallel-sidecars`.
