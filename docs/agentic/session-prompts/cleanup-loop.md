# Cleanup Controller Launcher

Use this prompt when the task is already classified as Tier 3 high-risk work and one session needs to coordinate the full cleanup workflow.

## Read Order

1. [`agents.md`](../../../agents.md)
2. [`docs/agentic/document-map.md`](../document-map.md)
3. [`docs/AGENTIC_DEV_WORKFLOW.md`](../../AGENTIC_DEV_WORKFLOW.md)
4. [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../../ARCHITECTURE_CLEANUP_CHECKLIST.md)
5. the active plan or task input

## Operating Mode

Run the full controller loop only for Tier 3 work:

1. planner writes or refreshes the plan
2. reviewer performs adversarial plan review
3. implementer executes in a repo-local worktree
4. reviewer performs adversarial implementation review
5. implementation fixes, verification, and status/doc updates happen before closeout

## Tier Boundaries

- for small low-risk work, do not use this prompt; stay in one session and request review before closeout
- for a normal cleanup unit with clear scope, use the Tier 2 planner/implementer/reviewer prompts instead
- for hotspots, cross-boundary refactors, multi-session work, or Plex/UI/Orchestrator changes, keep the full loop
- for major multi-session work, create a run bundle in [`docs/runs/`](../../runs/README.md) first and have the loop use that bundle

## Controller Responsibilities

- keep `update_plan` aligned with the current step
- ensure the planner follows [`docs/agentic/plan-authoring-standard.md`](../plan-authoring-standard.md)
- ensure the implementer uses the right repo-local boundary skills
- ensure verification matches risk
- ensure checklist/current-state docs are updated in the same pass when ownership or status changes
- ensure corpus review is updated when archiving a completed cleanup section or standout plan

## Output Contract

Return:

1. the current phase reached
2. the artifacts produced or updated
3. verification performed
4. any blocking findings from review
5. the next exact action if the loop is not complete
