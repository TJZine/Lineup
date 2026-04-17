# Cleanup Controller Launcher

Use this prompt when the task is already classified as Tier 3 high-risk cleanup/refactor work and one session needs to orchestrate the full cleanup workflow at package scope while iterating implementation/review at slice scope.

## Read Order

1. [`agents.md`](../../../agents.md)
2. [`docs/AGENTIC_DEV_WORKFLOW.md`](../../AGENTIC_DEV_WORKFLOW.md)
3. [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../../ARCHITECTURE_CLEANUP_CHECKLIST.md) when the scope is `checklist-linked`
4. the active plan or task input

## Invocation Inputs

Accept either of these as the task-specific input after the launcher:

- a pasted `NEXT_SESSION_HANDOFF` block; when present, treat `PLAN`, `ARTIFACT`, `FILES`, and `MESSAGE` as required additional reading after the standard read order
- one short follow-up message naming the exact Tier 3 cleanup scope, for example `Run cleanup-loop for ARCHITECTURE_CLEANUP_CHECKLIST.md item P4-W2.`

If the short follow-up form is used, treat the named checklist item or cleanup task as the scope selector for the loop and derive the remaining context from the checklist, tracked workflow docs, and current code.

## Operating Mode

Run the full controller loop only for Tier 3 cleanup/refactor work. The main session is the orchestrator. It keeps the authoritative state in `update_plan`, keeps routing and seam decisions local by default, delegates only the bounded write or review work that materially benefits from delegation, and only edits directly as a last resort for small adjustments or when preserving controller context is materially more reliable than another handoff.

## Controller State Machine

Run the loop as an explicit state machine:

1. `scope-load`
2. `plan`
3. `plan-review`
4. `plan-revise`
5. `slice-select`
6. `implement`
7. `implementation-review`
8. `implementation-revise`
9. `closeout`
10. `done`
11. `blocked`

### Phase Rules

- `scope-load`
  - confirm the task is Tier 3 cleanup/refactor work
  - identify the exact cleanup subtype (`checklist-linked` or `standalone remediation`) and the approved scope
  - for `checklist-linked` work, load the matching checklist entry and linkage
  - load the current plan or active run-bundle context when present
  - initialize or refresh `update_plan`
- `plan`
  - keep initial routing and seam decisions local unless Tier 3 scale clearly justifies delegating the plan-writing pass
  - when delegating plan writing, use the tracked write-capable `worker` role for the bounded plan artifact rather than inventing a new planner role
  - have the planning pass write or refresh the implementation plan using the tracked cleanup planning standards
  - for `checklist-linked` package work, require approved package decomposition and a clear next slice recommendation in the tracked plan before implementation starts
- `plan-review`
  - run an adversarial plan review using a fresh tracked `reviewer` pass
  - treat the plan as implementation-ready only when there are no material findings
  - treat slice parallelism as unavailable unless the approved plan explicitly authorizes it and explains the boundary and verification split
- `plan-revise`
  - route plan-review findings back to the same planning subagent
  - do not begin implementation while material plan findings remain
- `slice-select`
  - keep planning and package closeout package-scoped, but select implementation scope at slice level by default
  - choose the next incomplete approved slice from the tracked plan (`ready_now_slice` when present, otherwise recommended order)
  - if the approved plan explicitly allows bounded parallel slice execution, launch only the approved slice set; do not invent new parallel splits in the controller
- `implement`
  - spawn or resume a persistent tracked `worker` implementation subagent using the approved plan and selected slice scope
  - follow the tracked role defaults and any explicit `MODEL_SUGGESTION` guidance already present in the approved handoff rather than inventing ad hoc controller-side role/model routing
  - execute one approved slice by default; package-wide implementation is not the default loop unit
  - when the delegated write pass makes substantive repo changes, require a focused non-interactive implementation commit checkpoint before handoff unless the controller explicitly chose a no-commit tiny-edit exception
  - keep active tracked plan docs from `docs/plans/` out of delegated implementation commits; plan-progress updates may stay in the working tree for orchestrator handling or a separate tracked-doc commit
- `implementation-review`
  - run an adversarial implementation review using a fresh tracked `reviewer` pass for the implemented slice
  - after a clean slice review, either return to `slice-select` for remaining slices or proceed to `closeout` when package exit conditions are satisfied
- `implementation-revise`
  - route implementation-review findings back to the same implementation subagent for the current slice
  - do not advance to the next slice or mark the package complete while material implementation findings remain
- `closeout`
  - ensure required verification actually ran
  - for `checklist-linked` work, ensure checklist and required doc updates happen in the same pass after slice completion has earned package closeout
  - for `standalone remediation`, do not invent new checklist linkage during closeout
  - if the slice closes the final planned `P#-W#` item in a priority, ensure the required `P#-EXIT` evidence and status handling are also complete before finishing
- `done`
  - use only when all review loops are clean and all closeout conditions are satisfied
- `blocked`
  - use when progress cannot continue without a routing correction, user input, or a material workflow exception

## Tier Boundaries

- for small low-risk work, do not use this prompt; stay in one session and request review before closeout
- for a normal cleanup unit with clear scope, use the Tier 2 planner/implementer/reviewer prompts instead
- for hotspots, cross-boundary refactors, multi-session work, or Plex/UI/Orchestrator changes, keep the full loop
- for major multi-session work, create a run bundle in [`docs/runs/`](../../runs/README.md) first and have the loop use that bundle

## Controller Responsibilities

- keep `update_plan` aligned with the current step
- keep the controller's task family, cleanup subtype, and checklist linkage explicit
- ensure the planner follows [`docs/agentic/plan-authoring-standard.md`](../plan-authoring-standard.md)
- ensure cleanup planning and review use both [`Universal Plan Core`](../plan-authoring-standard.md#universal-plan-core) and [`Cleanup Overlay`](../plan-authoring-standard.md#cleanup-overlay)
- keep orchestration package-scoped for planning and closeout, but drive implementation/review by approved slices
- keep delegation inside the tracked role catalog from `.codex/config.toml`; use `worker` for bounded write passes and `reviewer` for adversarial review passes
- ensure delegated write passes use the right repo-local boundary skills
- keep write-capable delegated passes alive across revision rounds unless there is a specific reason to restart them
- keep review passes adversarial and fresh for each loop instead of reusing a writer pass as reviewer
- ensure verification matches risk
- ensure delegated implementation commits stay focused on implementation artifacts and exclude active tracked plan docs
- ensure checklist/current-state docs are updated in the same pass when ownership or status changes
- ensure corpus review is updated when archiving a completed cleanup section or standout plan

## Loop Discipline

- planner -> reviewer -> planner repeats until plan review is clean
- slice-select -> implementer -> reviewer -> implementer repeats until the current slice review is clean
- after a slice is clean, return to slice-select until the approved package slices are complete or explicitly deferred by the approved plan
- if the same findings recur, tighten instructions, narrow context, or explicitly resolve the blocked decision in the controller before continuing
- direct orchestrator edits are allowed only as a last resort and should stay narrowly scoped
- if delegated implementation updates plan progress and code in the same pass, keep the worker commit focused on implementation artifacts and let the orchestrator decide whether plan-doc updates should be committed separately

## Completion Gate

Do not treat the task as complete unless all of the following are true:

1. the plan review loop is clean
2. each implemented approved slice has a clean implementation review loop, and package closeout only starts when slice completion/deferral state matches the approved plan
3. the required verification commands actually ran
4. the required subtype-matched updates happened in the same pass (`checklist-linked`: checklist/current-state/doc updates; `standalone remediation`: docs/current-state updates without inventing checklist linkage)
5. if applicable, the required `P#-EXIT` evidence and status handling are complete

## Output Contract

Return:

1. the current phase reached
2. the artifacts produced or updated
3. verification performed
4. any blocking findings from review
5. the next exact action if the loop is not complete
6. whether the task is `done`, `closeout pending`, or `blocked`
