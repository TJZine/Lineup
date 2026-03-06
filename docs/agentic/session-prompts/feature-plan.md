# Feature Planner Launcher

Use this prompt for Tier 2 or Tier 3 feature/design work when you need a serious implementation plan for new functionality, product behavior, or UI direction.

Do not use this launcher for cleanup-only refactors; use [`cleanup-plan.md`](./cleanup-plan.md) for that path.

## Read Order

1. [`agents.md`](../../../agents.md)
2. [`docs/agentic/document-map.md`](../document-map.md)
3. [`docs/AGENTIC_DEV_WORKFLOW.md`](../../AGENTIC_DEV_WORKFLOW.md)
4. [`docs/agentic/codanna-playbook.md`](../codanna-playbook.md)
5. [`docs/agentic/plan-authoring-standard.md`](../plan-authoring-standard.md)
6. [`docs/design/ui-design-language.md`](../../design/ui-design-language.md) when UI creation or redesign is in scope
7. domain current-state docs that match the feature boundary

## Required Skill Order

1. load `brainstorming` before hardening any implementation plan
2. load `frontend-design` only when the task includes real UI creation or redesign
3. load matching repo-local boundary skills when ownership/composition boundaries are implicated

## What This Session Must Do

- confirm this is feature/design or mixed work before selecting a risk tier
- run Codanna-first discovery and record the fallback if Codanna is insufficient
- clarify product/design intent, constraints, and explicit non-goals before locking steps
- separate exploration decisions from implementation sequencing so the plan is executable in a fresh session
- produce or refresh a tracked plan in [`docs/plans/`](../../plans/README.md) when durable handoff memory is needed
- keep the authoritative execution steps aligned in `update_plan`

## Required Planning Constraints

- follow [`docs/agentic/plan-authoring-standard.md`](../plan-authoring-standard.md) for serious tracked plans
- distinguish feature/design intent work from cleanup/refactor remediation work
- for UI creation/redesign, reference [`docs/design/ui-design-language.md`](../../design/ui-design-language.md) and require `frontend-design`
- include exact files in scope and out of scope, verification commands, and rollback notes when risk warrants it
- preserve the repo verification gate expectations:
  - `npm run verify` for risky UI/navigation/Orchestrator/Plex changes
  - `npm run verify:docs` for workflow/control-plane doc changes

## Stop Conditions

Stop and resolve ambiguity before writing or finalizing a plan when:

- requirements or success criteria are still unclear
- the task routing (cleanup vs feature vs mixed) is unresolved
- UI direction is requested but design constraints are missing or contradictory
- architecture ownership expectations conflict with current-state docs
- the plan would require policy-violating compatibility/fallback paths

## Output Contract

Return:

1. plan file path (or explicit reason no tracked plan is required)
2. locked decisions and invariants
3. major impacted files/symbols and risk tier
4. exact verification commands
5. open risks/unknowns that must be resolved before implementation
