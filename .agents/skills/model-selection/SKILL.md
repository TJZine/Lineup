---
name: model-selection
description: Use when choosing a model or reasoning effort for a Lineup task or handoff.
---

# Model Selection

Use the configured role defaults. Revisit them only when current official guidance
and representative independent benchmark evidence justify a change:

- `explorer` and `monitor`: fast read-only work;
- `docs_researcher`: official-source research;
- `planner`: only when separate planning is justified;
- `worker`: bounded implementation;
- `worker_sol_low`: bounded implementation with established ownership that still
  needs repository comprehension;
- `worker_luna`: frozen, repeatable, low-ambiguity implementation that is cheap to
  verify directly;
- `reviewer`: independent read-only review.

Treat `.codex/agents/<role>.toml` as the sole authority for exact model,
reasoning-effort, sandbox, and fallback settings. Keep both lower-cost workers
behind exact scope, direct verification, and explicit stop conditions. Do not
duplicate exact settings in plans, prompts, or workflow prose, or add a tracked
role until current guidance and representative evidence justify the recurring
need and coordination cost.
