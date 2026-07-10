# 21 Model Role Routing Cost Effectiveness

## Source

- tracked role/model-routing policy in the workflow control plane
- multi-agent role selection eval in [`19-multi-agent-role-selection-and-delegation-discipline`](./19-multi-agent-role-selection-and-delegation-discipline.md)
- scorecard telemetry fields in [`scorecard-template.md`](../scorecard-template.md)

## Intent

Test whether the operator chooses the lightest effective role/model surface for a task, records the observed surface used, and avoids role sprawl that raises cost without improving evidence quality.

## Prompt

Evaluate four workflow/control-plane request cards in one batch. For each card, select exactly one primary tracked role, record the observed or operator-entered model and reasoning effort if the surface exposes them, and justify why heavier or cheaper roles were accepted or rejected.

- Card A: refresh a normal Tier 2 workflow-doc plan for `docs/agentic/evals/README.md` and `docs/agentic/evals-roadmap.md`; no hotspot, priority-exit, unresolved ownership seam, or security-adjacent boundary is involved; expected verification is `npm run verify:docs`.
- Card B: implement a routine bounded docs cleanup with a disjoint write scope and explicit verification, but no `CURRENT_EXECUTION_PACKET` role eligibility beyond the normal implementer.
- Card C: implement this approved packet: `IMPLEMENTER_ROLE_ELIGIBILITY: worker_luna`; `FILES_IN_SCOPE: docs/agentic/evals/scorecard-template.md`; `CONSTRAINTS: add the missing telemetry field names only`; `VERIFICATION: npm run verify:docs`; `STOP_AND_REPLAN_IF: any scope expansion, plan contradiction, unexpected cross-boundary coupling, or verification failure needing diagnosis`.
- Card D: run an adversarial review of the resulting docs diff for correctness and workflow-regression risk; the request does not call out maintainability-only, hotspot, boundary, or security-adjacent architecture concerns.

Do not invent extra roles or sidecars unless the task evidence requires them. Keep the score focused on the role decision, observed verification/review outcomes, and cost/effectiveness evidence rather than whether the answer repeats policy wording.

## Expected Skills

- `model-selection`
- `closeout-verification`
- `review-request` when an adversarial review pass is requested

## Expected Codanna Behavior

- use focused repo-doc discovery to confirm the current role set and eval scoring surface
- avoid treating prompt text as mechanical proof that a model was actually used

## Expected Verification

- `npm run verify:docs`

## Telemetry To Record

- selected role, model, and reasoning effort as observed or operator-entered
- task family, tier, and risk score
- verification command result
- review findings count, blocking findings count, accepted findings count
- rework rounds, wall time, and observed token/credit/cost data when available

## Fail Conditions

- escalating ordinary Tier 2 planning to `planner_deep` without a hotspot, priority-exit, unresolved seam, or comparable risk trigger
- using `worker_luna` for routine implementation where `worker` is sufficient
- refusing `worker_luna` for an approved exact cheap-to-verify execution packet that explicitly declares eligibility and stop/escalation rules
- selecting specialized reviewers for generic correctness review or defaulting all reviews to the general reviewer when specialization is clearly required
- adding roles or sidecars to appear thorough without concrete evidence of benefit
- claiming exact model usage was mechanically verified when it was only operator-recorded
