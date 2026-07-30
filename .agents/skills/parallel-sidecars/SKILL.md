---
name: parallel-sidecars
description: Use when Lineup may benefit from delegated read-heavy work, a wait, or an approved disjoint write unit.
---

# Delegation Routing

Default to one agent. Delegate only independent work whose benefit exceeds
coordination cost. Read-only exploration, official-doc research, review, log/test
analysis, and waits should return concise evidence. Write work requires an approved
owner/write boundary, invariants, verification, stop conditions, and no overlap;
require exact files only for concurrent writers or sensitive shared surfaces. The
controller owns integration and final proof. Route bounded implementation through
`bounded-worker-execution`; use `worker_luna` by default when outcome, ownership,
contracts, and proof are clear. Keep delegation depth shallow.

For a genuinely large program with multiple work units, dependency ordering, and
repeated integration checkpoints, explicitly use `large-task-orchestration`. This
skill routes individual sidecars and bounded units; it does not own a program.
