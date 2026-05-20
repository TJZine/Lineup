# Cleanup Implementer Launcher

Use this prompt for Tier 2 or Tier 3 work when an approved cleanup plan already exists and the next step is execution.

## Read Order

1. [`agents.md`](../../../agents.md)
2. [`docs/AGENTIC_DEV_WORKFLOW.md`](../../AGENTIC_DEV_WORKFLOW.md)
3. the assigned tracked plan in [`docs/plans/`](../../plans/README.md) or active run bundle in [`docs/runs/`](../../runs/README.md)
4. [`docs/agentic/plan-authoring-standard.md#universal-plan-core`](../plan-authoring-standard.md#universal-plan-core)
5. [`docs/agentic/plan-authoring-standard.md#cleanup-overlay`](../plan-authoring-standard.md#cleanup-overlay)
6. [`docs/architecture/CURRENT_STATE.md`](../../architecture/CURRENT_STATE.md)
7. any referenced domain docs and repo-local boundary skills named by the plan

## Invocation Inputs

Accept either of these as the task-specific input after the launcher:

- a pasted `NEXT_SESSION_HANDOFF` block; when present, treat `PLAN`, `ARTIFACT`, `FILES`, and `MESSAGE` as required additional reading after the standard read order
- one short follow-up message naming the approved plan path and exact checklist item, for example `Implement docs/plans/2026-03-26-p1-w1-<slug>.md for ARCHITECTURE_CLEANUP_CHECKLIST.md item P1-W1 slice P1-W1-S1.`
- one short follow-up message naming the approved standalone-remediation plan path and scope, for example `Implement docs/plans/2026-04-16-navigation-remediation.md for standalone remediation: navigation warning fallback.` 

If the short follow-up form is used, do not wait for a formal handoff block; use the named approved plan plus the supplied execution target as the execution surface.

For `checklist-linked` package plans, the execution target must include a checklist item context and should identify the approved `execution_unit`. That unit may be one approved slice or one approved wave. If only `slice_id` is supplied, treat it as a single-slice execution unit. If the execution unit is not supplied, derive `ready_now_execution_unit` from the tracked package plan before editing files and state that derivation in your kickoff note.

For `standalone remediation`, do not require checklist linkage just to use the short follow-up form. Use the named approved plan and the bounded remediation scope directly.

## What This Session Must Do

- execute the approved plan in a repo-local worktree under `.worktrees/` when the task is more than a tiny edit
- exception: for any task where `desloppify` output is used as authoritative checklist/plan evidence, execute those `desloppify` commands only on the target integration branch (no worktree evidence pass)
- re-check the plan freshness gate before changing files
- when the execution pass makes substantive repo changes, create a focused non-interactive commit checkpoint before handing off unless the controller explicitly says this is a no-commit tiny-edit pass
- preserve the approved cleanup subtype during execution:
  - `checklist-linked` tasks carry their checklist or priority-exit updates
  - `standalone remediation` tasks stay out of checklist bookkeeping unless the approved plan explicitly promotes them
- for `checklist-linked` package plans, execute one approved execution unit by default; `slice_table` remains the atomic ownership map and `execution_unit` is the execution/review surface
- for `checklist-linked` package plans, only merge adjacent slices when the approved plan explicitly permits that merge and states the slices share one code boundary, one verification surface, and one approved execution unit
- run Codanna impact confirmation again before risky/shared-symbol edits if the code moved since planning
- implement one work unit at a time without widening scope
- update the tracked docs that the plan explicitly requires in the same pass

## Implementation Constraints

- follow the plan exactly unless current repo state contradicts it
- for any cleanup task that records `desloppify`-based dispositions, do not run authoritative `desloppify` evidence in a worktree; use the integration branch as the single source of truth for recorded dispositions
- if a worktree `desloppify` run is unavoidable, synchronize the full `.desloppify` state first, treat output as provisional, and rerun the same commands on the integration branch before recording dispositions
- if repo state contradicts the plan, update the plan first instead of improvising
- prefer extraction and focused collaborators over growing hotspot files
- do not add fallback paths, migration shims, or dual-path logic unless explicitly approved
- treat `.agents/skills/` as the tracked repo skill surface; commit updates there when the task changes repo-local skill behavior
- do not commit local-only artifacts such as `.agent/`, `docs/runs/<instance>/`, raw run bundles, or raw eval baseline artifacts
- do not stage active tracked plan docs from `docs/plans/` into implementation commits, even when the execution pass refreshed plan progress; leave plan-doc changes for the orchestrator or a separate tracked-doc commit
- if the execution pass updates tracked package-plan slice status, keep those plan edits out of the implementation checkpoint and either leave them for the orchestrator or land them in a separate tracked-doc commit when no controller session owns closeout
- if a local run bundle changes the workflow conclusion, commit the updated tracked baseline-summary or workflow doc before closeout and keep only the raw bundle local
- terminology: `tracked baseline-summary` means tracked durable conclusion, while `local-only eval artifacts` means raw run outputs/transcripts kept out of git
- keep `update_plan` aligned with actual progress
- if the approved plan is `standalone remediation`, do not create or update checklist linkage unless the plan explicitly says the result should be promoted into tracked cleanup backlog
- if the approved plan closes the last planned `P#-W#` item in a priority, prepare the `P#-EXIT` evidence and checklist update in the same pass or report exactly why exit is still blocked; do not start `P(n+1)` work in the same session while that exit remains unresolved
- when a mapped imported issue still reports open after implementation, separate stale detector wording from live residual debt using current-code proof; do not mint a new `split follow-up` unless the source audit shows a genuinely different remaining owner
- if the slice-owned rationale is retired and the plan already names the final owner for any broader residual debt, record that as `resolved` plus proof instead of automatically handing the same issue envelope forward again
- absorb now only when newly discovered residue stays within the same approved execution unit goal, same owner, same seam/files, same verification envelope, and same final-owner accounting already approved by the tracked plan
- absorbed-now residue must still be recorded in the implementation output for that execution unit
- replan required when current-source proof shows a new owner, new package membership, changed execution-unit membership, materially wider verification surface, changed final-owner accounting, or a need to widen beyond the approved execution unit
- keep checklist bookkeeping package-level; record slice completion and remaining coverage in the tracked package plan, and only update checklist status at package/priority-exit boundaries

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
   - for `standalone remediation`, say explicitly when no checklist update applies
   - for `checklist-linked` package plans, name the executed `execution_unit`, the covered `slice_id` set, whether that unit is complete, and which slices remain in-package before proposing any checklist status change
   - if this closes the last planned `P#-W#` item in a priority, include the exact priority-exit evidence, any deferred/split items with their exact issue id, single final owner, and reason and revisit trigger, and whether the outgoing review should be treated as a priority-exit review
   - if any detector id stayed open because of stale wording rather than live slice-owned debt, say that explicitly and name the already-established final owner for any residual live debt
5. a `NEXT_SESSION_HANDOFF` block that routes to `lineup-cleanup-review` and includes:
   - `TASK`
   - `PLAN`
   - `ARTIFACT`
   - `FILES`
   - a pasteable implementation-review request unless the task is fully blocked before code changes; for `checklist-linked` package plans, that request must name the executed `execution_unit`, and when that unit is a wave it must also name the covered `slice_id` set; for claimed priority closeout, repeat the same deferred/split-item exact issue id, single final owner, and reason and revisit trigger metadata in that request, and for `standalone remediation` say explicitly that no checklist update is expected
   - when the session claims priority closeout, explicitly request a priority-exit review rather than a normal slice review
   - if the user explicitly asked for model guidance, or if the handoff is Tier 3 or architecture-risk score `>= 2`, include a `MODEL_SUGGESTION` block immediately before `NEXT_SESSION_HANDOFF` using repo-local `model-selection`
