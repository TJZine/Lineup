# Cleanup Planner Launcher

Use this prompt for Tier 2 or Tier 3 work when you need a serious implementation plan for a cleanup checklist item, standalone bugfix/remediation task, or closely related refactor.

## Read Order

1. [`agents.md`](../../../agents.md)
2. [`docs/agentic/document-map.md`](../document-map.md)
3. [`docs/AGENTIC_DEV_WORKFLOW.md`](../../AGENTIC_DEV_WORKFLOW.md)
4. [`docs/agentic/codanna-playbook.md`](../codanna-playbook.md)
5. [`docs/agentic/plan-authoring-standard.md`](../plan-authoring-standard.md)
6. [`docs/agentic/historical-plan-corpus-review.md`](../historical-plan-corpus-review.md)
7. [`docs/architecture/CURRENT_STATE.md`](../../architecture/CURRENT_STATE.md)
8. [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../../ARCHITECTURE_CLEANUP_CHECKLIST.md)

## Invocation Inputs

Accept either of these as the task-specific input after the launcher:

- a pasted `NEXT_SESSION_HANDOFF` block; when present, treat `PLAN`, `ARTIFACT`, `FILES`, and `MESSAGE` as required additional reading after the standard read order
- one short follow-up message naming the exact cleanup scope, for example `We are working on ARCHITECTURE_CLEANUP_CHECKLIST.md item P1-W1.`

If the short follow-up form is used, treat the named checklist item or cleanup task as the active scope selector for the session and derive the remaining context from the checklist, current docs, and current code.

## Required Skill Order

1. load `using-superpowers`
2. load `brainstorming`
3. load the matching repo-local boundary skill(s)
4. use `writing-plans` for the plan format

## What This Session Must Do

- identify the exact cleanup item or task scope
  - when the user uses the short follow-up form, the named checklist item or task is the scope selector
- classify the cleanup subtype before choosing a tier:
  - `checklist-linked` for tracked checklist or priority-exit work
  - `standalone remediation` for QA/debugging/bug-fix work with no existing checklist owner
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
- for `standalone remediation`, state explicitly that no checklist item is being updated; do not invent checklist linkage just to fit the cleanup lane
- if adjacent files may need contract/type changes, either place them in scope explicitly or freeze them explicitly and explain how the extraction still works
- if the plan closes the last planned `P#-W#` item in a priority, include a `Priority-exit readiness` section that names every mapped imported issue with an exact disposition, assigns a single final owner to every deferred or split-follow-up item, records exact `P0` security issue ids and revisit triggers for anything not cleared, and names the `P#-EXIT` checklist update/evidence refresh that blocks `P(n+1)`

## Stop Conditions

Stop and revise the plan instead of continuing when:

- current docs or code contradict the intended plan
- the task is larger than one bounded cleanup unit and needs to be split
- an architecture seam or adjacent contract change is still undecided
- the plan would require fallback paths or compatibility shims that the repo policy forbids
- the plan needs “mechanical wiring” in files that are simultaneously declared out of scope
- the plan depends on stale ownership assumptions or stale file references
- the final `P#-W#` plan still leaves a mapped imported issue without one single final owner or leaves `P0` security disposition implicit

## Output Contract

Return:

1. the plan file path
2. the cleanup subtype (`checklist-linked` or `standalone remediation`) and why it applies
3. the locked decisions and invariants
4. the main impacted files or symbols
5. the exact verification commands
   - if this is the final `P#-W#` for a priority, include the exact priority-exit evidence and `P#-EXIT` update that must happen before `P(n+1)`
6. any risks or unknowns that still need review before implementation
7. the result of the planner self-check if anything had to be resolved before the plan became execution-safe
8. a `NEXT_SESSION_HANDOFF` block that routes to `lineup-cleanup-review` and includes:
   - `TASK`
   - `PLAN`
   - `ARTIFACT`
   - `FILES`
   - a pasteable review request for the finished plan, explicitly calling out priority-exit readiness when the plan claims priority closeout and explicitly stating when the task is `standalone remediation` with no checklist update
   - if the user explicitly asked for model guidance, or if the handoff is Tier 3 or architecture-risk score `>= 2`, include a `MODEL_SUGGESTION` block immediately before `NEXT_SESSION_HANDOFF` using repo-local `model-selection`
