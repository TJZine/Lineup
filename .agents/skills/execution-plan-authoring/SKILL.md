---
name: execution-plan-authoring
description: Use when a Lineup task needs a decision-complete execution brief or durable cross-session plan.
---

# Execution Plan Authoring

Choose one mode: `update_plan` only, a light single-session brief, or a tracked plan
for durable cross-session memory. Do not promote routine work into `docs/plans/`.

Freeze only expensive decisions: goal/non-goals, owner seam, public contracts,
invariants, acceptance criteria, verification, rollback, and stop conditions. Name
likely files or an allowed write boundary; require exact file lists only when
parallel writers or a sensitive shared surface need collision protection. Leave
exact file discovery, helper names, local control flow, focused test organization,
and routine failure diagnosis to implementation. Investigate unresolved product,
ownership, or proof questions; escalate only consequential decisions outside the task.

Describe implementation risk and constraints without permanently binding a durable
plan to a model. At dispatch, use `worker_luna` for a bounded unit whose outcome,
owner seam, contracts, acceptance criteria, and proof are clear, even when it needs
repository comprehension or routine local coding judgment. Use `worker` when the
same settled unit needs material local design judgment, cross-boundary
comprehension, complex diagnosis, or proof interpretation. Return to planning when
product intent, ownership, public contracts, architecture, or proof depth remains
unresolved.
