# Session Prompt Launchers

This directory contains the tracked Lineup-specific prompt templates for routine cleanup work.

Use them to avoid copying large prompt blocks into fresh sessions. The tracked files here are the source of truth. Global prompts under `~/.codex/prompts/` should stay thin and point back to these files.

## Prompt Set

- [`cleanup-plan.md`](./cleanup-plan.md)
  - Tier 2 planner session for writing or refreshing a serious cleanup plan
- [`cleanup-implement.md`](./cleanup-implement.md)
  - Tier 2 implementer session for executing an approved plan in a repo-local worktree
- [`cleanup-review.md`](./cleanup-review.md)
  - reusable adversarial review session for either a plan or an implementation
- [`cleanup-loop.md`](./cleanup-loop.md)
  - Tier 3 controller session for high-risk work
- [`workflow-harness-review.md`](./workflow-harness-review.md)
  - adversarial whole-system review of the repo harness against current OpenAI and Anthropic guidance

## Invocation

Recommended global launcher names:

- `lineup-cleanup-plan`
- `lineup-cleanup-implement`
- `lineup-cleanup-review`
- `lineup-cleanup-loop`
- `lineup-workflow-harness-review`

Each launcher should:

1. confirm the current repo is Lineup
2. load [`agents.md`](../../../agents.md), [`docs/agentic/document-map.md`](../document-map.md), and [`docs/AGENTIC_DEV_WORKFLOW.md`](../../AGENTIC_DEV_WORKFLOW.md)
3. load the matching file in this directory
4. follow the workflow in that file without duplicating repo policy text inline

## When To Stay Reusable

Use these reusable launchers for Tier 2 work:

- routine `P#-W#` cleanup items
- bounded refactors with one planner, one implementer, and one reviewer
- plan refreshes for active tracked plans

## When To Stay In One Session

Use Tier 1 single-session execution plus review when the task is:

- small
- bounded
- low-risk
- unlikely to need durable handoff memory

## When To Escalate To A Run Bundle

Create a local run bundle in [`docs/runs/`](../../runs/README.md) first when the task is already Tier 3:

- multi-session
- architecture-heavy
- likely to need repeated handoff
- high-risk across hotspots such as `src/App.ts`, `src/Orchestrator.ts`, major UI composition roots, or Plex policy surfaces

When a run bundle exists, the reusable launcher should use it as task-specific context instead of inventing a new one-off prompt.

## Design Rules

- Keep repo-specific workflow text tracked here, not in global prompt files.
- Keep launcher prompts short enough to scan in one read.
- Prefer explicit read order, exact deliverables, and exact stop conditions.
- Do not create a new reusable prompt for every feature or checklist item.
- Update these templates when the repo workflow changes materially.
