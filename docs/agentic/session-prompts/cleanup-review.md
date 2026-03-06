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
- missing scope boundaries
- missing Codanna discovery or impact gate
- verification gaps
- rollback gaps
- hidden design decisions disguised as implementation steps
- stale paths, stale repo names, or local-only dependencies

If reviewing an implementation, focus on:

- regressions, architecture leakage, and responsibility growth
- deviation from the approved plan
- missing doc updates
- missing or weak verification
- accidental local-only artifact changes
- new slop, fallback paths, or cross-boundary shortcuts

## Output Contract

- findings first, ordered by severity
- each finding should name the file and the actual risk
- list open questions or assumptions after findings
- keep summaries brief
- if there are no material findings, say so explicitly and note any residual risk or testing gap
