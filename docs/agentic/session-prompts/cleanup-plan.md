# Cleanup Planner Launcher

Use this prompt for Tier 2 or Tier 3 work when you need a serious implementation plan for a cleanup checklist item or closely related refactor.

## Read Order

1. [`agents.md`](../../../agents.md)
2. [`docs/agentic/document-map.md`](../document-map.md)
3. [`docs/AGENTIC_DEV_WORKFLOW.md`](../../AGENTIC_DEV_WORKFLOW.md)
4. [`docs/agentic/codanna-playbook.md`](../codanna-playbook.md)
5. [`docs/agentic/plan-authoring-standard.md`](../plan-authoring-standard.md)
6. [`docs/agentic/historical-plan-corpus-review.md`](../historical-plan-corpus-review.md)
7. [`docs/architecture/CURRENT_STATE.md`](../../architecture/CURRENT_STATE.md)
8. [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../../ARCHITECTURE_CLEANUP_CHECKLIST.md)

Load any repo-local boundary skill that matches the task before planning.

## What This Session Must Do

- identify the exact cleanup item or task scope
- run Codanna-first discovery and record the fallback if Codanna is insufficient
- produce or refresh a tracked plan in [`docs/plans/`](../../plans/README.md) when the task needs durable memory
- keep the authoritative execution steps aligned in `update_plan`
- write the plan so a fresh-session implementer can execute it without making hidden design decisions

## Required Planning Constraints

- follow [`docs/agentic/plan-authoring-standard.md`](../plan-authoring-standard.md)
- use the `writing-plans` skill format for structure and checkpoint shape
- include exact files in scope and exact files out of scope
- include Codanna discovery findings and impact snapshot for risky/shared-symbol work
- include required reading and required skills
- include verification commands with expected outcomes
- include rollback notes when the task is risky
- include commit checkpoints only for tracked work
- do not rely on ignored local material unless a tracked curated reference already exists

## Stop Conditions

Stop and revise the plan instead of continuing when:

- current docs or code contradict the intended plan
- the task is larger than one bounded cleanup unit and needs to be split
- the plan would require fallback paths or compatibility shims that the repo policy forbids
- the plan depends on stale ownership assumptions or stale file references

## Output Contract

Return:

1. the plan file path
2. the locked decisions and invariants
3. the main impacted files or symbols
4. the exact verification commands
5. any risks or unknowns that still need review before implementation
