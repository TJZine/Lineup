# Production File-Shape Attention

`npm run verify:maintainability` reports production files under `src/**` that
exceed the architecture-attention thresholds. It excludes `__tests__` and
`*.test.*` files and does not fail because a file is large or has grown.
The default output is a compact count; use
`npm run verify:maintainability -- --details` when exact paths are useful.

## Thresholds

- Over 500 lines: when changed, record the compact architecture disposition from
  the `architecture-boundaries` skill.
- Over 800 lines: when changed, obtain a fresh independent Sol-high architecture
  and YAGNI review of the whole owner.
- Composition roots and hotspots named in current architecture guidance require
  the same fresh review regardless of their current line count.

These are attention and review triggers, not decomposition requirements. A large
cohesive owner may grow; a smaller owner mixing independent responsibilities may
need extraction. Never split solely to cross a numeric threshold.

## Decision Standard

Keep behavior together when it shares invariants, state, lifecycle, dependency
direction, and reason to change. Extract only a distinct present-day
responsibility, lifecycle/resource owner, trust boundary, policy, translation, or
real consumer. An extraction must own meaningful behavior rather than forward
calls through another layer.

The authoritative procedure is in
[`architecture-boundaries`](../../.agents/skills/architecture-boundaries/SKILL.md);
the risk and review policy is in
[`docs/AGENTIC_DEV_WORKFLOW.md`](../AGENTIC_DEV_WORKFLOW.md).
