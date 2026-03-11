# Cleanup Implementer Launcher

Use this prompt for Tier 2 or Tier 3 work when an approved cleanup plan already exists and the next step is execution.

## Read Order

1. [`agents.md`](../../../agents.md)
2. [`docs/agentic/document-map.md`](../document-map.md)
3. [`docs/AGENTIC_DEV_WORKFLOW.md`](../../AGENTIC_DEV_WORKFLOW.md)
4. the assigned tracked plan in [`docs/plans/`](../../plans/README.md) or active run bundle in [`docs/runs/`](../../runs/README.md)
5. [`docs/architecture/CURRENT_STATE.md`](../../architecture/CURRENT_STATE.md)
6. any referenced domain docs and repo-local boundary skills named by the plan

## What This Session Must Do

- execute the approved plan in a repo-local worktree under `.worktrees/` when the task is more than a tiny edit
- re-check the plan freshness gate before changing files
- run Codanna impact confirmation again before risky/shared-symbol edits if the code moved since planning
- implement one work unit at a time without widening scope
- update the tracked docs that the plan explicitly requires in the same pass

## Implementation Constraints

- follow the plan exactly unless current repo state contradicts it
- if repo state contradicts the plan, update the plan first instead of improvising
- prefer extraction and focused collaborators over growing hotspot files
- do not add fallback paths, migration shims, or dual-path logic unless explicitly approved
- treat `.codex/skills/` as the tracked repo skill surface; commit updates there when the task changes repo-local skill behavior
- do not commit local-only artifacts such as `.agent/skills/`, `docs/runs/<instance>/`, raw run bundles, or raw eval baseline artifacts
- if a local run bundle changes the workflow conclusion, commit the updated tracked baseline-summary or workflow doc before closeout and keep only the raw bundle local
- terminology: `tracked baseline-summary` means tracked durable conclusion, while `local-only eval artifacts` means raw run outputs/transcripts kept out of git
- keep `update_plan` aligned with actual progress
- if the approved plan closes the last planned `P#-W#` item in a priority, prepare the `P#-EXIT` evidence and checklist update in the same pass or report exactly why exit is still blocked; do not start `P(n+1)` work in the same session while that exit remains unresolved

## Verification Requirements

- run the exact commands listed in the plan
- for UI, navigation, Orchestrator, or Plex work, run `npm run verify`
- for workflow or control-plane doc changes, run `npm run verify:docs`
- do not claim success without reporting the commands that were actually run and their results

## Output Contract

Return:

1. what changed
2. what verification actually ran
3. any remaining risks or follow-up items
4. whether the checklist item or plan status should be updated
   - if this closes the last planned `P#-W#` item in a priority, include the exact priority-exit evidence, any deferred/split items with their single final owners, and whether the outgoing review should be treated as a priority-exit review
5. a `NEXT_SESSION_HANDOFF` block that routes to `lineup-cleanup-review` and includes:
   - `TASK`
   - `PLAN`
   - `ARTIFACT`
   - `FILES`
   - a pasteable implementation-review request unless the task is fully blocked before code changes
   - when the session claims priority closeout, explicitly request a priority-exit review rather than a normal slice review
