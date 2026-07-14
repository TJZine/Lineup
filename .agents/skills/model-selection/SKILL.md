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

Use medium reasoning for routine bounded work and high for ambiguous planning or
adversarial review. Keep both lower-cost workers behind exact scope, direct
verification, and explicit stop conditions. Use Luna high; do not add or route to
Luna max without new task-specific evidence. Increase effort only when measured
quality improves enough to justify cost.
