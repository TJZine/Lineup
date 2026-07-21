---
name: parallel-sidecars
description: Use when Lineup may benefit from delegated read-heavy work, a wait, or an approved disjoint write unit.
---

# Delegation Routing

Default to one agent. Delegate only independent work whose benefit exceeds
coordination cost. Read-only exploration, official-doc research, review, log/test
analysis, and waits should return concise evidence. Write work requires exact files,
invariants, verification, stop conditions, and no overlap. The controller owns
integration and final proof. Route a Sol-planned, exact, low-ambiguity,
cheap-to-verify unit through `bounded-worker-execution` when `worker_sol_low` or
`worker_luna` is explicitly selected. Keep delegation depth shallow.

For a genuinely large program with multiple work units, dependency ordering, and
repeated integration checkpoints, explicitly use `large-task-orchestration`. This
skill routes individual sidecars and bounded units; it does not own a program.
