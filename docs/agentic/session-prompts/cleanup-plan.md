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

## Required Skill Order

1. load `using-superpowers`
2. load `brainstorming`
3. load the matching repo-local boundary skill(s)
4. use `writing-plans` for the plan format

## What This Session Must Do

- identify the exact cleanup item or task scope
- run Codanna-first discovery and record the fallback if Codanna is insufficient
- produce or refresh a tracked plan in [`docs/plans/`](../../plans/README.md) when the task needs durable memory
- keep the authoritative execution steps aligned in `update_plan`
- write the plan so a fresh-session implementer can execute it without making hidden design decisions

## Required Planning Constraints

- follow [`docs/agentic/plan-authoring-standard.md`](../plan-authoring-standard.md)
- use the `writing-plans` skill format for structure and checkpoint shape
- resolve any open architecture seam or adjacent contract decision before freezing the execution steps
- include exact files in scope and exact files out of scope
- include the full Codanna evidence trail for serious cleanup plans:
  - `semantic_search_with_context` result or explicit fallback note
  - `search_documents` result or explicit fallback note when repo-doc context matters
  - `analyze_impact` result
  - direct-read/`rg` fallback note when used
- include Codanna discovery findings and impact snapshot for risky/shared-symbol work
- run the planner self-check from [`docs/agentic/plan-authoring-standard.md`](../plan-authoring-standard.md) before finalizing the plan
- include required reading and required skills
- include verification commands with expected outcomes
- include rollback notes when the task is risky
- include commit checkpoints only for tracked work
- do not rely on ignored local material unless a tracked curated reference already exists
- if adjacent files may need contract/type changes, either place them in scope explicitly or freeze them explicitly and explain how the extraction still works

## Stop Conditions

Stop and revise the plan instead of continuing when:

- current docs or code contradict the intended plan
- the task is larger than one bounded cleanup unit and needs to be split
- an architecture seam or adjacent contract change is still undecided
- the plan would require fallback paths or compatibility shims that the repo policy forbids
- the plan needs “mechanical wiring” in files that are simultaneously declared out of scope
- the plan depends on stale ownership assumptions or stale file references

## Output Contract

Return:

1. the plan file path
2. the locked decisions and invariants
3. the main impacted files or symbols
4. the exact verification commands
5. any risks or unknowns that still need review before implementation
6. the result of the planner self-check if anything had to be resolved before the plan became execution-safe
