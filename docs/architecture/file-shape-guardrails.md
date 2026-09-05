# Production File-Shape Attention

`npm run verify:maintainability` reports production files under `src/**` that
exceed the architecture-attention thresholds. It excludes `__tests__` and
`*.test.*` files and does not fail because a file is large or has grown.
The default output is a compact count; use
`npm run verify:maintainability -- --details` when exact paths are useful.

## Thresholds

The 500/800-line thresholds, composition roots, and named hotspots guide attention
to affected lifecycle, callers, and invariants. Expand to the whole owner when a
behavior or ownership question requires it. They do not automatically require a
written disposition, independent reviewer, or extraction. Use the workflow's
review criteria when a concrete consequential risk merits a second assessment.

A large cohesive owner may grow; a smaller owner mixing independent
responsibilities may need extraction. Never split solely to cross a numeric
threshold. Record a brief cohesion decision when adding or moving responsibilities.

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
