---
name: bounded-worker-execution
description: Define and execute a bounded delegated Lineup implementation unit after delegation is justified; ordinary single-agent implementation does not need this skill.
---

# Bounded Worker Execution

Freeze the outcome, owner seam, contracts, acceptance criteria, verification, and
stop conditions before delegation. The unit must be bounded and disjoint from other
writers. Require exact files only when concurrent writers or sensitive shared
surfaces need collision protection.

Select the implementation role using the runbook's
[delegation policy](../../../docs/AGENTIC_DEV_WORKFLOW.md#delegation). Within the
assigned boundary, discover exact files, make routine local design choices, add
focused tests, and diagnose failures caused by the implementation. Investigate
uncertainty within the assigned owner and contracts. Return consequential scope,
product, contract, dependency, or ownership decisions outside that boundary to the
controller with evidence; the controller resolves them within user authorization
before asking the user.

The controller reviews the diff, integrates it, and confirms current proof under
the runbook. Use `parallel-sidecars` when the decision to delegate or the kind of
sidecar still needs assessment.
