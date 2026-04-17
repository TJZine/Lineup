# Cleanup Reviewer Launcher

Use this prompt for adversarial review of a cleanup artifact from any orchestration tier.

## Read Order

1. [`agents.md`](../../../agents.md)
2. [`docs/AGENTIC_DEV_WORKFLOW.md`](../../AGENTIC_DEV_WORKFLOW.md)
3. the artifact being reviewed
4. supporting standards that apply:
   - [`docs/agentic/plan-authoring-standard.md#universal-plan-core`](../plan-authoring-standard.md#universal-plan-core) and [`docs/agentic/plan-authoring-standard.md#cleanup-overlay`](../plan-authoring-standard.md#cleanup-overlay) for cleanup plan review
   - [`docs/agentic/historical-plan-corpus-review.md`](../historical-plan-corpus-review.md) for plan-shape calibration
   - [`docs/architecture/CURRENT_STATE.md`](../../architecture/CURRENT_STATE.md) and any relevant domain doc for implementation review
   - [`docs/agentic/evals/rubric.md`](../evals/rubric.md) when the review touches workflow-quality expectations

## Invocation Inputs

Accept either of these as the task-specific input after the launcher:

- a pasted `NEXT_SESSION_HANDOFF` block; when present, treat `PLAN`, `ARTIFACT`, `FILES`, and `MESSAGE` as required additional reading after the standard read order
- one short follow-up message naming the exact artifact under review and its checklist linkage when applicable, for example `Review docs/plans/2026-03-26-p1-w1-<slug>.md for ARCHITECTURE_CLEANUP_CHECKLIST.md item P1-W1 slice P1-W1-S1.`

If the short follow-up form is used, treat the named artifact as the review target and derive the rest of the context from the checklist, plan, and tracked workflow docs instead of waiting for a formal handoff block.

For `checklist-linked` package plans, implementation review must identify the `slice_id` under review (or derive the implemented slice from the approved tracked package plan and implementation artifact) before assessing correctness.

## Review Mode

Use this disposition vocabulary literally:

- `deferred`: the issue stays open, but the artifact names the exact issue id, current owner, reason, and revisit trigger
- `split follow-up`: the artifact does not retire the issue now and instead hands the remaining gap to one exact successor owner
- `owned follow-up`: the one exact successor owner named by a `split follow-up` record; do not accept shared implicit ownership
- `security triage`: a fresh `desloppify status` result that either says `no open P0 security findings` or lists the exact `P0` security issue ids still open/deferred, plus reasons and revisit triggers for anything not yet cleared
- `priority-exit review`: the blocking review required after the last planned `P#-W#` item and before any `P(n+1)` work, plan, or checklist progress

If reviewing a plan, focus on:

- freshness for a no-context session
- wrong task routing or wrong orchestration tier for the actual work
- missing or incorrect cleanup subtype (`checklist-linked` vs `standalone remediation`)
- missing scope boundaries
- contradictory scope boundaries, especially around adjacent contract/type files
- unresolved architecture seams or ownership seams hidden inside task steps
- missing Codanna discovery or impact gate
- incomplete Codanna evidence trail or missing explicit fallback logging
- verification gaps
- rollback gaps
- missing preservation contracts for risky UI/runtime behavior
- wrong repo-preferred owner or likely hotspot growth
- temporary adapters that may not survive, dual ownership, or responsibility bleed implied by the plan
- code-feasibility issues that would force the implementer to invent API/contract changes mid-task
- hidden design decisions disguised as implementation steps
- stale paths, stale repo names, or local-only dependencies
- likely bug or regression vectors suggested by the proposed implementation path
- if the plan claims to close the last `P#-W#` item in a priority:
  - missing priority-exit readiness
  - missing mapped-imported-issue disposition
  - missing exact final owner for a deferred or split-follow-up issue
  - missing explicit reason + revisit trigger for each deferred or split-follow-up issue
  - missing evidence refresh: rerun strongest verification/evidence commands on current code before approving `P(n+1)`
  - missing `P0` security-gate disposition before `P(n+1)`

If reviewing an implementation, focus on:

- regressions, architecture leakage, and responsibility growth
- deviation from the approved plan
- incorrect slice targeting, including missing `slice_id` or unapproved adjacent-slice merge
- missing doc updates
- incorrect checklist bookkeeping for `standalone remediation`, or missing checklist updates for `checklist-linked` work
- slice-to-issue retirement correctness for the reviewed slice
- remaining package coverage integrity after the reviewed slice
- no-drop accounting across completed and remaining slices
- whether package state is ready for the next slice or ready for package exit
- missing or weak verification
- accidental local-only artifact changes
- new slop, fallback paths, or cross-boundary shortcuts
- stale detector residue being mistaken for live slice-owned debt
- repeated `split follow-up` churn for the same imported issue envelope when no new owner was proven on current code
- if the artifact claims to close the last `P#-W#` item in a priority, treat it as a priority-exit review too:
  - verify every imported review issue mapped to that priority is retired, explicitly deferred, or split into a new owned follow-up
  - verify every deferred or split item names one single final owner plus a reason and revisit trigger, especially when one imported issue was mapped to multiple `P#-W#` items
  - push back if the same imported issue is being split forward again without a fresh source audit proving a different remaining owner or proving the earlier mapping was wrong
  - verify the `P0` security gate has been cleared or explicitly deferred with exact issue ids
  - rerun strongest verification/evidence commands on current code before approving `P(n+1)`
  - verify the checklist is not advancing to `P(n+1)` while known priority-local debt is still open without a recorded reason
  - verify no `P(n+1)` plan or implementation work is being approved while `P#-EXIT` is still unresolved

## Output Contract

- findings first, ordered by severity
- each finding should name the file and the actual risk
- list open questions or assumptions after findings
- keep summaries brief
- if there are no material findings, say so explicitly and note any residual risk or testing gap
- for `checklist-linked` package-plan implementation reviews, include an explicit package-coverage verdict stating the reviewed `slice_id`, retired issues, remaining slice coverage, and whether next-slice work or package-exit review is justified
- if another session is needed, end with one `NEXT_SESSION_HANDOFF` block:
  - when reviewing a plan with material findings: route back to `lineup-cleanup-plan`
  - when reviewing a plan with no material findings: route to `lineup-cleanup-implement`
  - when reviewing an implementation with material findings: route back to `lineup-cleanup-implement`
  - when reviewing an implementation with no material findings but approved package slices still remain and no active `cleanup-loop` controller owns the run: route to `lineup-cleanup-implement` for the next approved slice
  - when reviewing an implementation inside an active `cleanup-loop` run with no material findings: no handoff block is required, but state explicitly whether control returns to `slice-select` or `closeout`
  - when reviewing an implementation with no material findings: no handoff block is required if closeout is complete
  - for `checklist-linked` package-plan implementation review handoffs, include the exact reviewed or next `slice_id` in the request
  - if the user explicitly asked for model guidance, or if the handoff is Tier 3 or architecture-risk score `>= 2`, include a `MODEL_SUGGESTION` block immediately before `NEXT_SESSION_HANDOFF` using repo-local `model-selection`
- for plan review, treat “implementation-ready” as meaning:
  - no hidden architecture or scope decisions remain
  - the execution path is feasible without inventing code structure on the fly
  - the likely bug/regression vectors are accounted for by scope, invariants, and verification
- for claimed priority closeout, treat “ready to move to the next priority” as meaning:
  - the matching `P#-EXIT` gate is satisfied
  - mapped imported issues and security triage have an auditable disposition with exact issue ids, owners, reasons, and revisit triggers
  - the remaining debt in that priority area is either intentionally owned elsewhere or explicitly deferred
  - stale detector wording has been separated from true residual debt so `P#-EXIT` is reconciling evidence rather than creating routine new follow-up work
