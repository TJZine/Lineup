---
name: parallel-sidecars
description: Assess and route an independent Lineup sidecar or delegated write unit when delegation would help; use bounded-worker-execution for the write-unit contract.
---

# Delegation Routing

Default to one agent. Delegate only independent work whose benefit exceeds
coordination cost. Read-only exploration, official-doc research, review, log/test
analysis, and waits should return concise evidence. Write work requires an approved
owner/write boundary, invariants, verification, stop conditions, and no overlap;
require exact files only for concurrent writers or sensitive shared surfaces. The
controller owns integration and final proof. Route bounded implementation through
`bounded-worker-execution`. Select roles and depth under the runbook's
[delegation policy](../../../docs/AGENTIC_DEV_WORKFLOW.md#delegation).

For a genuinely large program with multiple work units, dependency ordering, and
repeated integration checkpoints, explicitly use `large-task-orchestration`. This
skill routes individual sidecars and bounded units; it does not own a program.
