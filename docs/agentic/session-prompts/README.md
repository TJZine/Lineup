# Session Prompt Launchers

This directory contains the tracked Lineup-specific prompt templates for cleanup/refactor and feature/design workflow launches.

Use them to avoid copying large prompt blocks into fresh sessions. The tracked files here are the source of truth. Global prompts under `~/.codex/prompts/` should stay thin and point back to these files.

## Prompt Set

<!-- BEGIN MANAGED SESSION PROMPT SET -->
- [`cleanup-plan.md`](./cleanup-plan.md)
  - Tier 2 planner session for writing or refreshing a serious cleanup plan
- [`cleanup-implement.md`](./cleanup-implement.md)
  - Tier 2 implementer session for executing an approved plan in a repo-local worktree
- [`cleanup-review.md`](./cleanup-review.md)
  - reusable adversarial review session for either a plan or an implementation
- [`cleanup-loop.md`](./cleanup-loop.md)
  - Tier 3 controller session for high-risk work
- [`feature-plan.md`](./feature-plan.md)
  - Tier 2 or Tier 3 planner session for serious feature/design planning
- [`feature-implement.md`](./feature-implement.md)
  - Tier 2 implementer session for executing an approved feature/design plan in a repo-local worktree
- [`feature-review.md`](./feature-review.md)
  - reusable adversarial review session for feature/design plans and implementations
- [`workflow-harness-review.md`](./workflow-harness-review.md)
  - adversarial whole-system review of the repo harness against current OpenAI and Anthropic guidance
<!-- END MANAGED SESSION PROMPT SET -->

## Routing (Authoritative)

Route task family first. Choose risk tier second.

| Task Type | Use This Path | Prompt Family | Notes |
|---|---|---|---|
| cleanup/refactor | checklist cleanup units, bounded remediation, refactors with no net-new feature intent | `cleanup-*` | `cleanup-loop` is only for Tier 3 cleanup controller work. |
| feature/design | net-new capability, behavior expansion, product/design direction work, UI creation/redesign | `feature-plan` + `feature-implement` + `feature-review` | Tier 2 feature flow mirrors cleanup: planner -> reviewer -> implementer -> reviewer. |
| mixed | feature delivery that also includes a cleanup slice (for example hotspot extraction, ownership correction, or required doc refresh) | route by primary intent and split slices explicitly | Use `cleanup-*` only for the cleanup slice, never as umbrella control for full feature delivery. |

Mixed-task examples:

- feature delivery that also extracts hotspot responsibilities
- UI redesign that also changes ownership
- new feature work that also requires current-state or API doc updates

Tier 3 rule for feature or mixed work:

- use a task-specific run bundle in [`docs/runs/`](../../runs/README.md) plus the normal workflow
- do not treat [`cleanup-loop.md`](./cleanup-loop.md) as the controller for feature or mixed-task delivery

## Invocation

Recommended global launcher names:

- `lineup-cleanup-plan`
- `lineup-cleanup-implement`
- `lineup-cleanup-review`
- `lineup-cleanup-loop`
- `lineup-feature-plan`
- `lineup-feature-implement`
- `lineup-feature-review`
- `lineup-workflow-harness-review`

Each launcher should:

1. confirm the current repo is Lineup
2. load [`agents.md`](../../../agents.md), [`docs/agentic/document-map.md`](../document-map.md), and [`docs/AGENTIC_DEV_WORKFLOW.md`](../../AGENTIC_DEV_WORKFLOW.md)
3. load the matching file in this directory
4. follow the workflow in that file without duplicating repo policy text inline

## When To Stay Reusable

Use these reusable launchers for Tier 2 cleanup work:

- routine `P#-W#` cleanup items
- bounded refactors with one planner, one implementer, and one reviewer
- plan refreshes for active tracked plans

Use these reusable launchers for Tier 2 feature/design work:

- serious feature/design plans that need adversarial review before coding
- approved feature/design plans that should execute in a fresh implementer session
- implementation review passes after the approved plan lands

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
- Planner, reviewer, and implementer prompts should emit a pasteable `NEXT_SESSION_HANDOFF` block when another session is expected.
- Update these templates when the repo workflow changes materially.
