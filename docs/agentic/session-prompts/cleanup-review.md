# Cleanup Reviewer Launcher

Use this prompt for adversarial review of a cleanup artifact from any orchestration tier.

## Read Order

1. [`agents.md`](../../../agents.md)
2. [`docs/agentic/document-map.md`](../document-map.md)
3. [`docs/AGENTIC_DEV_WORKFLOW.md`](../../AGENTIC_DEV_WORKFLOW.md)
4. the artifact being reviewed
5. supporting standards that apply:
   - [`docs/agentic/plan-authoring-standard.md`](../plan-authoring-standard.md) for plan review
   - [`docs/agentic/historical-plan-corpus-review.md`](../historical-plan-corpus-review.md) for plan-shape calibration
   - [`docs/architecture/CURRENT_STATE.md`](../../architecture/CURRENT_STATE.md) and any relevant domain doc for implementation review
   - [`docs/agentic/evals/rubric.md`](../evals/rubric.md) when the review touches workflow-quality expectations

## Review Mode

If reviewing a plan, focus on:

- freshness for a no-context session
- wrong task routing or wrong orchestration tier for the actual work
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
  - missing `P0` security-gate disposition before `P(n+1)`

If reviewing an implementation, focus on:

- regressions, architecture leakage, and responsibility growth
- deviation from the approved plan
- missing doc updates
- missing or weak verification
- accidental local-only artifact changes
- new slop, fallback paths, or cross-boundary shortcuts
- if the artifact claims to close the last `P#-W#` item in a priority, treat it as a priority-exit review too:
  - verify every imported review issue mapped to that priority is retired, explicitly deferred, or split into a new owned follow-up
  - verify the `P0` security gate has been cleared or explicitly deferred with exact issue ids
  - verify the checklist is not advancing to `P(n+1)` while known priority-local debt is still open without a recorded reason

## Output Contract

- findings first, ordered by severity
- each finding should name the file and the actual risk
- list open questions or assumptions after findings
- keep summaries brief
- if there are no material findings, say so explicitly and note any residual risk or testing gap
- if another session is needed, end with one `NEXT_SESSION_HANDOFF` block:
  - when reviewing a plan with material findings: route back to `lineup-cleanup-plan`
  - when reviewing a plan with no material findings: route to `lineup-cleanup-implement`
  - when reviewing an implementation with material findings: route back to `lineup-cleanup-implement`
  - when reviewing an implementation with no material findings: no handoff block is required if closeout is complete
- for plan review, treat “implementation-ready” as meaning:
  - no hidden architecture or scope decisions remain
  - the execution path is feasible without inventing code structure on the fly
  - the likely bug/regression vectors are accounted for by scope, invariants, and verification
- for claimed priority closeout, treat “ready to move to the next priority” as meaning:
  - the matching `P#-EXIT` gate is satisfied
  - mapped imported issues and security triage have an auditable disposition
  - the remaining debt in that priority area is either intentionally owned elsewhere or explicitly deferred
