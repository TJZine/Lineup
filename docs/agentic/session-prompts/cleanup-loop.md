# Cleanup Controller Launcher

Use this prompt when the task is already classified as Tier 3 high-risk cleanup/refactor/remediation work and one session needs to orchestrate the full cleanup workflow. Debugging fits this launcher only when the task is corrective remediation, regression repair, source-audit reconciliation, or refactor follow-through with no net-new feature intent. Keep planning and closeout package-scoped for `checklist-linked` work, but execute and review inside the approved `execution_unit` there so large packages can retire coherent approved batches instead of degrading into tiny per-slice loops. Keep `standalone remediation` to one bounded execution target unless the approved plan says otherwise.

## Read Order

1. [`docs/AGENTIC_DEV_WORKFLOW.md`](../../AGENTIC_DEV_WORKFLOW.md)
2. [`agents.md`](../../../agents.md)
3. [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../../ARCHITECTURE_CLEANUP_CHECKLIST.md) when the scope is `checklist-linked`
4. the active plan or task input

## Invocation Inputs

Accept either of these as the task-specific input after the launcher:

- a pasted `NEXT_SESSION_HANDOFF` block; when present, treat `PLAN`, `ARTIFACT`, `FILES`, and `MESSAGE` as required additional reading after the standard read order
- one short follow-up message naming the exact Tier 3 cleanup scope, for example `Run cleanup-loop for ARCHITECTURE_CLEANUP_CHECKLIST.md item P4-W2.`
- one short follow-up message naming the approved Tier 3 standalone-remediation scope, for example `Run cleanup-loop for docs/plans/2026-04-16-navigation-remediation.md.`

If the short follow-up form is used, treat the named checklist item or cleanup task as the scope selector for the loop and derive the remaining context from the checklist, tracked workflow docs, and current code.

## Operating Mode

Run the full controller loop only for Tier 3 cleanup/refactor/remediation work. This launcher is not a temporary feature-loop or umbrella controller for feature delivery. The main session is the orchestrator. It keeps the authoritative state in `update_plan`, keeps routing and seam decisions local by default, delegates only the bounded write or review work that materially benefits from delegation, and only edits directly as a last resort for small adjustments or when preserving controller context is materially more reliable than another handoff.

## Controller State Machine

Run the loop as an explicit state machine:

1. `scope-load`
2. `plan`
3. `plan-review`
4. `plan-revise`
5. `execution-unit-select`
6. `implement`
7. `implementation-review`
8. `implementation-revise`
9. `closeout`
10. `done`
11. `blocked`

### Phase Rules

- `scope-load`
  - confirm the task is Tier 3 cleanup/refactor/remediation work
  - identify the exact cleanup subtype (`checklist-linked` or `standalone remediation`) and the approved scope
  - for `checklist-linked` work, load the matching checklist entry and linkage
  - load the current plan or active run-bundle context when present
  - keep controller-side startup reading bounded to the authority surfaces and package-local scope needed to route the work and brief subagents correctly
  - do not front-load planner-grade repo discovery in the controller unless the delegated planning pass fails, stalls with a concrete blocker, or needs a controller-level seam decision
  - initialize or refresh `update_plan`
- `plan`
  - keep initial routing and seam decisions local, but for `checklist-linked` Tier 3 cleanup delegate the primary execution-grade plan-writing pass by default after `scope-load`
  - for that primary `checklist-linked` planning pass, use the tracked write-capable `planner` role for the bounded plan artifact by default; use `planner_deep` for Tier 3 hotspot, priority-exit, cross-boundary, unresolved architecture/product seam, or security-adjacent planning and rely on tracked role defaults instead of prompt-level model overrides
  - spawn that tracked-role planner as a fresh bounded-context thread, not a full-history fork; current Codex forked launches cannot also change `agent_type`, `model`, or `reasoning_effort`, and tracked role routing depends on those role-bound settings
  - once delegated planning starts, that planner is the authoritative plan author until it finishes, explicitly blocks, fails, or is abandoned only after a long wait, a direct status check, and a follow-up wait that still produces no usable progress signal
  - while that planner pass is active, the controller may wait, poll status, answer blocker questions, and keep `update_plan` current, but must not do planner-grade repo discovery, redundant package-local scoping, issue reconciliation, or tracked plan drafting locally; limit controller-side inspection to the minimum needed to answer an explicit blocker question or resolve a controller-only seam decision
  - the main thread must not author the execution-grade `checklist-linked` package plan itself just because it now has enough local context; reclaim planning only when delegated planning explicitly blocks, fails, the user explicitly asks the main thread to plan locally, a controller-only seam decision must be resolved before planning can continue, or the narrow long-wait/direct-status-check/follow-up-wait abandonment test is met
  - for `standalone remediation`, the controller may keep the planning pass local when the bounded execution target is already clear, but should still delegate when the same Tier 3 scale/risk factors that justified `cleanup-loop` materially benefit from a separate planning writer
  - have the planning pass write or refresh the implementation plan using the tracked cleanup planning standards
  - require the planning pass to optimize for the intended long-term owner shape and repo-preferred practice, not the smallest issue-closing patch; larger rewrites are valid execution units or waves when they stay inside the approved owner boundary and verification envelope
  - reject source-disproved, no-code, deferred, or split-follow-up dispositions when the only reason is fix size; those dispositions need current-source proof that the intended shape already exists, the finding no longer applies, or an explicit unapproved boundary forces stop/replan with one final owner
  - for `checklist-linked` package work, require approved package decomposition, one explicit `ready_now_execution_unit`, and a clear next-slice recommendation inside that unit before implementation starts
  - do not enter `implement` for `checklist-linked` work until the active approved plan exposes inline scalar `ready_now_execution_unit` and `ready_now_slice`; `ready_now_slice` remains the first slice inside that approved unit
  - for `standalone remediation`, require one explicit bounded execution target in the approved plan and do not invent package slices or checklist linkage
- `plan-review`
  - run an adversarial plan review using a fresh tracked `reviewer` pass by default; use `architecture_reviewer` for hotspot/boundary/security-adjacent architecture risk and `maintainability_reviewer` for code-health or maintainability-only review
  - launch that reviewer as a fresh bounded-context tracked-role thread instead of a full-history fork for the same role-selection reason
  - keep that reviewer thread alive for follow-up closure checks on the same plan artifact when findings come back
  - treat the plan as implementation-ready only when there are no material findings
  - treat slice parallelism as unavailable unless the approved plan explicitly authorizes it and explains the boundary and verification split
- `plan-revise`
  - route plan-review findings back to the same planning subagent by default
  - only keep a narrow controller-side plan revision local as a last resort when delegated planning explicitly blocks, fails, the user explicitly asks the main thread to plan locally, a controller-only seam decision must be resolved in the revision itself, or the narrow long-wait/direct-status-check/follow-up-wait abandonment test is met
  - by default, send the revised plan back to the same reviewer thread for closure checking instead of spawning a brand-new reviewer each round
  - run a fresh reviewer again only for the final clean approval gate, when the prior reviewer context is no longer trustworthy, or when the controller wants a second opinion because the loop is stuck or scope changed materially
  - when a same-reviewer closure check clears the findings after a non-clean round, return to `plan-review` for the fresh final approval gate before entering `execution-unit-select`
  - do not begin implementation while material plan findings remain
- `execution-unit-select`
  - keep planning and package closeout package-scoped for `checklist-linked` work, but select implementation scope at approved execution-unit level there
  - for `checklist-linked` work, choose the next incomplete approved execution unit from the tracked plan (`ready_now_execution_unit` first; `ready_now_slice` remains the first slice inside that unit)
  - an execution unit may be one approved slice or one approved wave containing multiple slices
  - when a wave is selected, the controller stays inside that wave until its declared completion condition is met or a replan trigger fires
  - wave review is the default approval gate for that unit; slice-level accounting remains mandatory inside the wave
  - for `standalone remediation`, confirm the single approved execution target from the tracked plan and proceed without inventing package slices
  - if the approved plan explicitly allows bounded parallel execution units, launch only the approved set; do not invent new splits in the controller
- `implement`
  - spawn or resume a persistent tracked `cleanup_worker` implementation subagent using the approved plan and selected execution scope
  - for Tier 3 `cleanup-loop` implementation passes, use the tracked `cleanup_worker` role instead of `worker`; keep Tier 2 implementers and feature implementers on the general `worker` role unless an approved current execution packet explicitly allows `worker_54_high` for a bounded exact cheap-to-verify subunit
  - `worker_54_high` must stop/escalate on ambiguity, plan contradiction, scope expansion, unexpected cross-boundary coupling, or verification failure needing diagnosis
  - when starting that tracked-role implementer, pass the approved plan/execution-unit context explicitly and avoid full-history forking; the runtime rejects forked launches when role/model/reasoning overrides are attached
  - follow the tracked role defaults and any explicit `MODEL_SUGGESTION` guidance already present in the approved handoff rather than inventing ad hoc controller-side role/model routing
  - execute one approved execution unit by default for `checklist-linked` work; package-wide implementation is not the default loop unit there
  - absorb now only when newly discovered residue stays within the same approved execution unit goal, same owner, same seam/files, same verification envelope, and same final-owner accounting already approved by the plan
  - replan required when current-source proof shows a new owner, new package membership, changed execution-unit membership, materially wider verification surface, changed final-owner accounting, or a need to widen beyond the approved execution unit
  - for `standalone remediation`, execute the single approved execution target by default unless the plan explicitly authorizes a narrower staged rollout
  - when the delegated write pass makes substantive repo changes, require a focused non-interactive implementation commit checkpoint before handoff unless the controller explicitly chose a no-commit tiny-edit exception
  - keep active tracked plan docs from `docs/plans/` out of delegated implementation commits; plan-progress updates may stay in the working tree for orchestrator handling or a separate tracked-doc commit
- `implementation-review`
  - run an adversarial implementation review using a fresh tracked `reviewer` pass for the implemented execution unit or bounded execution target by default; use `architecture_reviewer` for hotspot/boundary/security-adjacent architecture risk and `maintainability_reviewer` for code-health or maintainability-only review
  - launch that reviewer as a fresh bounded-context tracked-role thread instead of a full-history fork for the same role-selection reason
  - keep that reviewer thread alive for follow-up closure checks on the same execution-unit artifact when findings come back
  - after a clean review, return to `execution-unit-select` for remaining checklist-linked work or proceed to `closeout` when the subtype-matched exit conditions are satisfied
- `implementation-revise`
  - route implementation-review findings back to the same implementation subagent for the current execution unit or bounded execution target
  - by default, send the revised execution-unit or execution-target artifact back to the same reviewer thread for closure checking instead of spawning a brand-new reviewer each round
  - run a fresh reviewer again only for the final clean approval gate, when the prior reviewer context is no longer trustworthy, or when the controller wants a second opinion because the loop is stuck or scope changed materially
  - when a same-reviewer closure check clears the findings after a non-clean round, return to `implementation-review` for the fresh final approval gate before advancing to the next execution unit, next bounded execution target, or `closeout`
  - do not advance to the next execution unit, next bounded execution target, or final closeout while material implementation findings remain
- `closeout`
  - ensure required verification actually ran
  - for `checklist-linked` work, ensure checklist and required doc updates happen in the same pass after the approved execution unit is complete, slice-level accounting inside it is current, and package closeout is earned
  - for `standalone remediation`, do not invent new checklist linkage during closeout
  - if the completed checklist-linked execution unit closes the final planned `P#-W#` item in a priority, ensure the required `P#-EXIT` evidence and status handling are also complete before finishing
- `done`
  - use only when all review loops are clean and all closeout conditions are satisfied
- `blocked`
  - use when progress cannot continue without a routing correction, user input, or a material workflow exception

## Tier Boundaries

- for small low-risk work, do not use this prompt; stay in one session and request review before closeout
- for a normal cleanup unit with clear scope, use the Tier 2 planner/implementer/reviewer prompts instead
- for hotspots, cross-boundary refactors, multi-session work, or Plex/UI/Orchestrator changes, keep the full loop
- for feature/design work, mixed-task umbrella control, or debugging that expands product behavior, do not use this prompt; route the feature slice through the feature workflow and keep any cleanup slice separate
- for major multi-session work, create a run bundle in [`docs/runs/`](../../runs/README.md) first and have the loop use that bundle

## Controller Responsibilities

- keep `update_plan` aligned with the current step
- keep the controller's task family, cleanup subtype, and checklist linkage explicit
- ensure the planner follows [`docs/agentic/plan-authoring-standard.md`](../plan-authoring-standard.md)
- ensure cleanup planning and review use both [`Universal Plan Core`](../plan-authoring-standard.md#universal-plan-core) and [`Cleanup Overlay`](../plan-authoring-standard.md#cleanup-overlay)
- ensure cleanup planning targets the correct long-term owner shape rather than minimum-diff issue closure, and require replan instead of deferral when the intended rewrite crosses an unapproved boundary
- keep orchestration package-scoped for planning and closeout only when the task is `checklist-linked`; otherwise keep `standalone remediation` bounded to its approved execution target
- for checklist-linked package work, treat `slice_table` as the atomic ownership map and `execution_unit` as the execution/review surface
- keep delegation inside the tracked role catalog from `.codex/config.toml`; use `planner` for bounded planning artifacts, `planner_deep` for Tier 3/hotspot/priority-exit/cross-boundary/unresolved seam planning, `cleanup_worker` for Tier 3 `cleanup-loop` implementation write passes, `worker` for general implementation outside that loop, `worker_54_high` only for approved bounded exact cheap-to-verify execution units, `reviewer` for normal adversarial review, `maintainability_reviewer` for maintainability-only review, and `architecture_reviewer` for hotspot/boundary/security-adjacent architecture review
- for `checklist-linked` Tier 3 cleanup, treat delegated primary plan authoring as the default, and treat main-thread plan authoring as a last-resort exception that must be justified by delegated planning explicitly blocking or failing, a user request for local planning, a controller-only seam decision that must be resolved before planning can continue, or the narrow long-wait/direct-status-check/follow-up-wait abandonment test
- while a delegated planner pass is active, treat that planner as the authoritative plan author and do not run competing controller-side planning discovery or draft a rival tracked/local plan
- ensure delegated write passes use the right repo-local boundary skills
- keep write-capable delegated passes alive across revision rounds unless there is a specific reason to restart them
- keep reviewers read-only by default and do not reuse a writer pass as reviewer
- keep the same reviewer alive for follow-up closure checks on the same artifact by default, and reserve fresh reviewers for the initial adversarial pass plus the final clean approval gate
- do not ask a tracked read-only reviewer to patch the artifact; if the controller breaks repeated churn with a tiny direct fix or a write-capable pass after reviewer guidance, require a fresh reviewer before the artifact can be treated as clean
- ensure verification matches risk
- ensure delegated implementation commits stay focused on implementation artifacts and exclude active tracked plan docs
- ensure checklist/current-state docs are updated in the same pass when ownership or status changes
- ensure corpus review is updated when archiving a completed cleanup section or standout plan

## Loop Discipline

- planner -> fresh reviewer -> planner repeats, with the same reviewer handling rereview closure checks by default until the plan reaches a final clean approval pass
- for `checklist-linked` work, execution-unit-select -> implementer -> fresh reviewer -> implementer repeats, with the same reviewer handling rereview closure checks by default until the execution unit is ready for a final clean approval pass
- after a clean review, return to execution-unit-select until the approved checklist-linked execution units are complete or explicitly deferred by the approved plan; `standalone remediation` proceeds directly to `closeout` once its one bounded execution target is clean
- large-package execution should review coherent retirement batches, not one tiny fix at a time
- if the same findings recur, tighten instructions, narrow context, or explicitly resolve the blocked decision in the controller before continuing
- direct orchestrator edits are allowed only as a last resort and should stay narrowly scoped
- if delegated implementation updates plan progress and code in the same pass, keep the worker commit focused on implementation artifacts and let the orchestrator decide whether plan-doc updates should be committed separately
- do not interrupt a planner or implementer subagent just because a large cleanup package is taking a long time; prefer long waits and progress checks, and only interrupt when there is a concrete wrong-scope, failure, or no-progress signal
- do not treat planner latency, controller curiosity, or newly gathered local context as a valid reason to reclaim planning while the delegated planner is still active
- do not spawn a brand-new reviewer for every rereview round by default; prefer reviewer continuity for closure checks, then use a fresh reviewer again for the final clean gate

## Completion Gate

Do not treat the task as complete unless all of the following are true:

1. the plan review loop is clean
   - if the plan ever had material findings, “clean” includes the required fresh final approval pass after any same-reviewer closure checks
2. each implemented approved execution unit or standalone execution target has a clean implementation review loop, and package closeout only starts when the subtype-matched completion/deferral state matches the approved plan
   - if an execution-unit or standalone execution-target review ever had material findings, “clean” includes the required fresh final approval pass after any same-reviewer closure checks
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
