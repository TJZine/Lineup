# Eval Baseline Summary

## Date

2026-03-06

## Operator / Agent Surface

- Operator: Codex (GPT-5) in repo workspace
- Fresh-session eval run: spawned agent `Noether` (`default`) with no forked task context

## Prompts Run

- [`13-risk-tiered-orchestration-and-local-only-absorption`](../prompts/13-risk-tiered-orchestration-and-local-only-absorption.md)
- rollout scenario: workflow-doc update requiring explicit routing split among cleanup/refactor vs feature/design vs mixed, then risk-tier selection

## Outcome Summary

- Result: `pass`
- The eval run selected `feature/design` routing for the scenario, selected Tier 1 for bounded docs-only risk, avoided `cleanup-loop` as umbrella control, and preserved local-only artifact boundaries.

## Recurring Misses

- none observed in this single rollout eval run

## Workflow / Docs / Skills Changed In Response

- Added feature planning/review launchers:
  - [`docs/agentic/session-prompts/feature-plan.md`](../../session-prompts/feature-plan.md)
  - [`docs/agentic/session-prompts/feature-review.md`](../../session-prompts/feature-review.md)
- Added authoritative routing split and mixed-task handling:
  - [`docs/agentic/session-prompts/README.md`](../../session-prompts/README.md)
  - [`docs/AGENTIC_DEV_WORKFLOW.md`](../../../AGENTIC_DEV_WORKFLOW.md)
  - [`docs/agentic/document-map.md`](../../document-map.md)
- Added rollout meta-eval guidance and expectation text:
  - [`docs/agentic/evals/README.md`](../README.md)
  - [`docs/agentic/evals-roadmap.md`](../../evals-roadmap.md)
- Added mechanical docs checks for new prompt family and routing markers:
  - [`tools/verify-docs.mjs`](../../../../tools/verify-docs.mjs)

## Durable Lessons Absorbed

- Route task family first (cleanup/refactor vs feature/design vs mixed), then choose orchestration tier.
- For Tier 3 feature or mixed work, keep cleanup prompts scoped to cleanup slices instead of using `cleanup-loop` as umbrella control.
- Treat local launcher convenience as optional and outside tracked success criteria.

## Intentionally Local-Only Artifacts

- Spawned-agent run transcript and raw scoring notes for this eval instance remained local/session-only.

## Next Follow-Up

- Run a fresh-session adversarial review pass against the new feature/design launcher pair after initial real-world usage.
