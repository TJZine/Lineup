---
name: execution-plan-authoring
description: Use when a Lineup task needs a decision-complete execution brief or durable cross-session plan.
---

# Execution Plan Authoring

Choose one mode: `update_plan` only, a light single-session brief, or a tracked plan
for durable cross-session memory. Do not promote routine work into `docs/plans/`.

Freeze only expensive decisions: goal/non-goals, owner seam, files in/out, public
contracts, invariants, verification, rollback, and stop conditions. Leave helper
names, local control flow, and test organization to implementation. Stop if product
intent, ownership, or proof depth remains unresolved.

When selecting `worker_luna`, also state why the unit is low ambiguity and cheap to
verify; otherwise route implementation to the normal Sol worker.
