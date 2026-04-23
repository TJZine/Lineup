# Cleanup Planner Launcher

Use this prompt for Tier 2 or Tier 3 work when you need a serious implementation plan for a cleanup checklist item, standalone bugfix/remediation task, or closely related refactor.

Run this launcher with the tracked write-capable `planner` role. The role is for bounded planning discovery, tracked plan artifacts, and execution-ready handoffs, not product-code implementation.

## Read Order

1. [`docs/AGENTIC_DEV_WORKFLOW.md`](../../AGENTIC_DEV_WORKFLOW.md)
2. [`agents.md`](../../../agents.md)
3. [`docs/agentic/codanna-playbook.md`](../codanna-playbook.md)
4. [`docs/agentic/plan-authoring-standard.md#universal-plan-core`](../plan-authoring-standard.md#universal-plan-core)
5. [`docs/agentic/plan-authoring-standard.md#cleanup-overlay`](../plan-authoring-standard.md#cleanup-overlay)
6. [`docs/architecture/CURRENT_STATE.md`](../../architecture/CURRENT_STATE.md)
7. [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../../ARCHITECTURE_CLEANUP_CHECKLIST.md)

## Invocation Inputs

Accept either of these as the task-specific input after the launcher:

- a pasted `NEXT_SESSION_HANDOFF` block; when present, treat `PLAN`, `ARTIFACT`, `FILES`, and `MESSAGE` as required additional reading after the standard read order
- one short follow-up message naming the exact cleanup scope, for example `We are working on ARCHITECTURE_CLEANUP_CHECKLIST.md item P1-W1.`

If the short follow-up form is used, treat the named checklist item or cleanup task as the active scope selector for the session and derive the remaining context from the checklist, current docs, and current code.

## Required Skill Order

1. load `brainstorming` only when the cleanup seam, scope, or remediation approach is still unresolved
2. load the matching repo-local boundary skill(s)
3. use repo-local `verification-strategy` to choose the proof mode and test depth
4. use repo-local `execution-plan-authoring` for plan depth, mode selection, and verification strategy

## What This Session Must Do

- identify the exact cleanup item or task scope
  - when the user uses the short follow-up form, the named checklist item or task is the scope selector
- classify the cleanup subtype before choosing a tier:
  - `checklist-linked` for tracked checklist or priority-exit work
  - `standalone remediation` for QA/debugging/bug-fix work with no existing checklist owner
- run Codanna-first discovery and record the fallback if Codanna is insufficient
- produce or refresh a tracked plan in [`docs/plans/`](../../plans/README.md) when the task needs durable memory
- keep the authoritative execution steps aligned in `update_plan`
- write the plan so a fresh-session implementer can execute it without making hidden seam, scope, or verification decisions
- keep write activity confined to planning surfaces unless the parent explicitly narrows the task to a workflow/control-plane planning-doc edit

## Required Planning Constraints

- follow [`docs/agentic/plan-authoring-standard.md#universal-plan-core`](../plan-authoring-standard.md#universal-plan-core) and [`docs/agentic/plan-authoring-standard.md#cleanup-overlay`](../plan-authoring-standard.md#cleanup-overlay)
- treat [`docs/agentic/historical-plan-corpus-review.md`](../historical-plan-corpus-review.md) as optional calibration only when the plan needs extra example-driven context beyond the standard and current tracked docs
- use repo-local `execution-plan-authoring` to keep the plan decision-complete without turning it into pseudo-code
- use repo-local `verification-strategy` to select the verification mode before deciding whether new automated coverage is required
- declare `**Task family:** cleanup/refactor` and the exact `**Cleanup subtype:**` before freezing the plan
- resolve any open architecture seam or adjacent contract decision before freezing the execution steps
- record explicit stop-and-replan conditions under the seam gate or an adjacent replan block whenever discovery, boundary, or verification failure would invalidate the current plan
- include exact files in scope and exact files out of scope
- freeze expensive-to-get-wrong decisions and deliberately leave ordinary local coding choices delegated unless a narrow contract snippet materially reduces risk
- include the full Codanna evidence trail for serious cleanup plans:
  - `semantic_search_with_context` result or explicit fallback note
  - `search_documents` result or explicit fallback note when repo-doc context matters
  - `analyze_impact` result when risky/shared symbols are involved, or an explicit note that it was not required for the current risk level
  - direct-read/`rg` fallback note when used
- include Codanna discovery findings and impact snapshot for risky/shared-symbol work
- run the planner self-check from [`docs/agentic/plan-authoring-standard.md#planner-self-check`](../plan-authoring-standard.md#planner-self-check) before finalizing the plan
- include required reading and required skills
- include verification commands with expected outcomes
- classify the verification strategy for the execution surface as one of:
  - `new regression/contract test required`
  - `existing coverage sufficient`
  - `broader integration/manual proof required`
  - `no new automated test needed`
- when using `existing coverage sufficient`, name the exact existing test or proof surface that makes that claim defensible
- when using `broader integration/manual proof required` or `no new automated test needed`, name the exact integration/manual/static proof surface
- avoid brittle tests that overfit current helper structure, mock owned boundaries, or snapshot large transient surfaces when narrower proof is available
- include rollback notes when the task is risky
- include commit checkpoints only for tracked work
- do not rely on ignored local material unless a tracked curated reference already exists
- for `standalone remediation`, state explicitly that no checklist item is being updated; do not invent checklist linkage just to fit the cleanup lane
- for `checklist-linked` package work, require a tracked `## Package Decomposition` section in the plan with canonical fields:
  - `package_id`
  - `checklist_token`
  - `package_issue_ids`
  - `slice_table`
  - `coverage_check`
  - `ready_now_slice`
  - `ready_now_execution_unit`
  - `recommended_slice_order`
  - `parallel_execution_policy`
- for checklist-linked package work, `slice_table` remains the atomic ownership map. `execution_unit` is the execution/review surface.
- for `checklist-linked` package work, require each `slice_table` row to capture at least `slice_id`, `goal`, `areas/files`, `exact_issue_ids`, `verification`, `dependencies`, `stop_condition`, `handoff_condition`, and either `serial_only` or `parallel_group` plus `parallel_justification`
- for `checklist-linked` package work, require package-scoped slice ids (for example `P6-W1-S1`) in `slice_table`, `recommended_slice_order`, and `ready_now_slice`
- for `checklist-linked` package work, require `ready_now_execution_unit`; it must identify either one approved single-slice unit or one approved `wave_id`, while `ready_now_slice` remains the first slice inside that unit
- for `checklist-linked` package work, require `execution_waves`, `coverage_ledger`, per-wave `absorb_now_scope`, and per-wave `replan_triggers` only when the plan groups multiple approved slices into one execution/review batch or explicitly opts into wave-scoped execution
- for single-slice checklist-linked package plans, keep the plan lightweight: `ready_now_execution_unit` points to the same slice as `ready_now_slice`, and no multi-slice wave scaffolding is required
- for `checklist-linked` package work, treat `coverage_check` as a hard implementation-ready gate: every package issue must map to exactly one planned slice or one explicit defer path with one final owner before implementation can begin
- for `checklist-linked` package work, keep the checklist companion map canonical for package issue membership; tracked plans may snapshot `package_issue_ids` for execution coverage but must not become a rival membership authority
- for `checklist-linked` package work, `coverage_ledger` is an execution-only no-drop ledger for existing `package_issue_ids`; it must not redefine package membership, which remains owned by the checklist companion map
- for `checklist-linked` package work, decomposition is still mandatory even when the package is small enough to yield exactly one slice
- for `checklist-linked` package work, require `ready_now_slice` to name the first implementation slice for the next implementer session
- for `checklist-linked` package work, large-package execution should review coherent retirement batches, not one tiny fix at a time
- for `checklist-linked` package work, require `parallel_execution_policy` to be explicit; when parallel slices are allowed, the plan must justify why boundaries and verification surfaces are disjoint
- when wave-scoped execution is approved, require the plan to say that wave review is the default approval gate for that execution unit and that slice-level accounting remains mandatory inside the wave
- require the plan to state the absorbed-residue rule explicitly:
  - absorb now only when newly discovered residue stays within the same approved execution unit goal, same owner, same seam/files, same verification envelope, and same final-owner accounting
  - absorbed-now residue must still be recorded in the implementation/review output for that execution unit
  - replan required when current-source proof shows a new owner, new package membership, changed execution-unit membership, materially wider verification surface, changed final-owner accounting, or a need to widen beyond the approved execution unit
- if adjacent files may need contract/type changes, either place them in scope explicitly or freeze them explicitly and explain how the extraction still works
- when a mapped imported issue is broader than the proposed slice, either widen the slice or name one intended final owner for the remaining live debt; do not rely on repeated future `P#-EXIT` re-splitting to sort out stale detector residue
- if the plan expects a slice to retire one sub-claim of a broader imported issue, say exactly which slice-owned rationale is being retired and whether any residual live debt stays with the same final owner
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
- the same imported issue would need to be split forward again even though no new live owner or seam has been shown on current code

## Output Contract

Return:

1. the plan file path
2. the cleanup subtype (`checklist-linked` or `standalone remediation`) and why it applies
3. the locked decisions and invariants
   - for `checklist-linked` package work, include `Package Decomposition` decisions with `ready_now_execution_unit`, `ready_now_slice`, and `parallel_execution_policy`
   - when the approved execution unit is a wave, also name the covered `slice_id` set and any required `execution_waves` gating that keeps the controller inside that wave until completion or replan
4. the main impacted files or symbols
5. the exact verification commands
   - if this is the final `P#-W#` for a priority, include the exact priority-exit evidence and `P#-EXIT` update that must happen before `P(n+1)`
6. any risks or unknowns that still need review before implementation
7. the result of the planner self-check if anything had to be resolved before the plan became execution-safe
   - when the task touches detector-backed checklist closeout, say explicitly whether the plan resolves the slice-owned rationale, preserves an existing final owner for residual live debt, or truly requires a new successor owner
8. a `NEXT_SESSION_HANDOFF` block that routes to `lineup-cleanup-review` and includes:
   - `TASK`
   - `PLAN`
   - `ARTIFACT`
   - `FILES`
   - a pasteable review request for the finished plan, explicitly calling out priority-exit readiness when the plan claims priority closeout and explicitly stating when the task is `standalone remediation` with no checklist update
   - if the user explicitly asked for model guidance, or if the handoff is Tier 3 or architecture-risk score `>= 2`, include a `MODEL_SUGGESTION` block immediately before `NEXT_SESSION_HANDOFF` using repo-local `model-selection`
9. when a weaker/cheaper implementer or an unusually fragile current unit needs extra detail, include an optional `CURRENT_EXECUTION_PACKET` block before `NEXT_SESSION_HANDOFF` with:
   - `UNIT`
   - `FILES_IN_SCOPE`
   - `FILES_OUT_OF_SCOPE`
   - `CONSTRAINTS`
   - `VERIFICATION`
   - `STOP_AND_REPLAN_IF`
