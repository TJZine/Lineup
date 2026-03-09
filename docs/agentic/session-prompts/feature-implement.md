# Feature Implementer Launcher

Use this prompt for Tier 2 or Tier 3 feature/design work when an approved feature plan already exists and the next step is implementation.

## Read Order

1. [`agents.md`](../../../agents.md)
2. [`docs/agentic/document-map.md`](../document-map.md)
3. [`docs/AGENTIC_DEV_WORKFLOW.md`](../../AGENTIC_DEV_WORKFLOW.md)
4. the assigned tracked plan in [`docs/plans/`](../../plans/README.md) or active run bundle in [`docs/runs/`](../../runs/README.md)
5. [`docs/design/ui-design-language.md`](../../design/ui-design-language.md) when UI creation or redesign is in scope
6. [`docs/architecture/CURRENT_STATE.md`](../../architecture/CURRENT_STATE.md) plus any domain docs named by the plan
7. any repo-local boundary skills named by the plan

## What This Session Must Do

- execute the approved feature/design plan in a repo-local worktree under `.worktrees/` when the task is more than a tiny edit
- re-check the plan freshness gate before changing files
- re-confirm task routing before implementation if the approved plan includes a mixed cleanup slice
- run Codanna impact confirmation again before risky/shared-symbol edits if the code moved since planning
- implement one bounded work unit at a time without widening scope
- preserve the approved product/design direction instead of “simplifying” into generic output mid-implementation
- update the tracked docs that the plan explicitly requires in the same pass

## Implementation Constraints

- follow the approved plan exactly unless current repo state contradicts it
- if repo state contradicts the plan, update the plan first instead of improvising
- keep feature intent and cleanup intent separated; do not let cleanup-only shortcuts steer net-new behavior
- for UI creation/redesign, follow [`docs/design/ui-design-language.md`](../../design/ui-design-language.md) and use `frontend-design`
- prefer extraction and focused collaborators over growing hotspot files
- do not add fallback paths, migration shims, or dual-path logic unless explicitly approved
- do not commit local-only artifacts such as `.agent/skills/`, `docs/runs/<instance>/`, raw run bundles, or raw eval baseline artifacts
- if a local run bundle changes the workflow conclusion, commit the updated tracked baseline-summary or workflow doc before closeout and keep only the raw bundle local
- keep `update_plan` aligned with actual progress

## Verification Requirements

- run the exact commands listed in the plan
- run `npm run verify` for risky UI, navigation, Orchestrator, or Plex work
- run `npm run verify:docs` for workflow/control-plane/reference doc changes
- otherwise run at least the plan’s required `npm run typecheck` / `npm test` coverage
- do not claim success without reporting the commands that were actually run and their results

## Output Contract

Return:

1. what changed
2. what verification actually ran
3. any remaining risks or follow-up items
4. whether any tracked docs or plan references need updating before closeout
5. a `NEXT_SESSION_HANDOFF` block that routes to `lineup-feature-review` and includes:
   - `TASK`
   - `PLAN`
   - `ARTIFACT`
   - `FILES`
   - a pasteable implementation-review request unless the task is fully blocked before code changes
