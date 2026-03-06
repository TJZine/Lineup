# Agent Control Plane Document Map

> Established 2026-03-05. Defines which documents are authoritative for agent work in Lineup and how to resolve overlap.

## Goal

Keep the repo close to the effective control-plane pattern described by OpenAI and Anthropic:

- stable policy
- one operating runbook
- durable current-state memory
- one active backlog/status surface
- task-scoped plans
- explicit cleanup of stale guidance

## Precedence

When documents conflict, use this order:

1. [`agents.md`](../../agents.md)
2. [`docs/AGENTIC_DEV_WORKFLOW.md`](../AGENTIC_DEV_WORKFLOW.md)
3. [`docs/agentic/codanna-playbook.md`](./codanna-playbook.md)
4. [`docs/agentic/skill-strategy.md`](./skill-strategy.md)
5. [`docs/architecture/CURRENT_STATE.md`](../architecture/CURRENT_STATE.md)
6. [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../ARCHITECTURE_CLEANUP_CHECKLIST.md)
7. Domain-specific current docs such as [`docs/design/ui-design-language.md`](../design/ui-design-language.md) and [`docs/api/plex-integration.md`](../api/plex-integration.md)
8. Reference docs such as [`docs/architecture/modules.md`](../architecture/modules.md), development guides, and user guides
9. Active task plans in [`docs/plans/`](../plans/README.md) when working on that task
10. Historical docs such as [`docs/decisions/README.md`](../decisions/README.md) and [`docs/archive/plans/`](../archive/plans/README.md)

## Document Roles

### Stable Policy

- [`agents.md`](../../agents.md)

Use for:

- always-on rules
- tool priority
- verification bars
- skill invocation requirements
- document precedence references

Do not use for:

- evolving backlog detail
- long architecture explanation
- task status journaling

### Operating Runbook

- [`docs/AGENTIC_DEV_WORKFLOW.md`](../AGENTIC_DEV_WORKFLOW.md)

Use for:

- the default agent loop
- how to move from discovery to plan to code to review
- where agents should look next

### Tool Playbook

- [`docs/agentic/codanna-playbook.md`](./codanna-playbook.md)

Use for:

- Codanna-first discovery patterns
- query shaping
- impact analysis
- `rg` fallback rules

### Current Architecture Truth

- [`docs/architecture/CURRENT_STATE.md`](../architecture/CURRENT_STATE.md)

Use for:

- current composition roots
- actual module ownership
- current hotspots
- present-day boundary rules

### Active Backlog / Live Status

- [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../ARCHITECTURE_CLEANUP_CHECKLIST.md)

Use for:

- the active architecture cleanup queue
- work-unit completion state
- current cleanup direction

### Task-Level Plans

- [`docs/plans/`](../plans/README.md)

Use for:

- explicit, task-scoped implementation plans
- active handoff memory for a specific work item
- recent durable plan files that still matter for current execution

Do not use for:

- general repo policy
- current architecture truth after the task is finished

Archive completed or superseded plans to [`docs/archive/plans/`](../archive/plans/README.md) once they no longer need to occupy the active plan workspace.

### Archived Plans

- [`docs/archive/plans/`](../archive/plans/README.md)

Use for:

- completed or superseded tracked implementation plans
- historical implementation memory that should remain searchable

Do not use for:

- active handoff memory
- current policy
- live status

### Local Execution Artifacts

Local-only by default:

- `.agent/skills/`
- [`docs/runs/`](../runs/README.md) real run instances
- `docs/agentic/evals/baselines/*.md` run outputs

Use for:

- generated mirrors
- per-run logs
- local eval results

Do not treat these as canonical repo policy or source-of-truth surfaces.

### Skill Topology

- [`docs/agentic/skill-strategy.md`](./skill-strategy.md)

Use for:

- `.codex/skills` vs `.agent/skills`
- global mirror policy
- repo-local skill inventory

### Evaluation Roadmap

- [`docs/agentic/evals-roadmap.md`](./evals-roadmap.md)

Use for:

- the small, explicit regression tasks used to judge agent effectiveness

### Historical Corpus Review

- [`docs/agentic/historical-plan-corpus-review.md`](./historical-plan-corpus-review.md)

Use for:

- calibrating the plan-authoring standard against real Lineup history
- deriving initial eval prompts from completed cleanup work
- identifying historical anti-patterns that should not be repeated

Do not use for:

- current policy
- active task status
- current architecture truth

### Steady-State Transition

- [`docs/agentic/phase-2-steady-state-plan.md`](./phase-2-steady-state-plan.md)

Use for:

- how and when to tighten this repo after the cleanup phase stabilizes

## Garbage Collection Rules

- If a document makes a current-state claim and is no longer accurate, update it or archive it in the same pass.
- Do not leave “temporary” workflow guidance in random markdown files once it has a permanent home.
- `docs/plans/*` is active execution memory only while a task is live; once the plan is no longer active, move it to `docs/archive/plans/*`.
- `docs/archive/plans/*` and `docs/decisions/*` are historical memory, not current policy.
- Keep active durable plans in `docs/plans/`, archive older completed or superseded tracked plans into `docs/archive/plans/`, and update references in the same pass.
- Avoid free-floating workflow docs outside the control-plane set above.
- If a new doc does not clearly fit one of the roles above, prefer updating an existing authoritative doc instead.
