# 22 Planner Escalation And Plan Critique Boundaries

## Source

- risk-tiered orchestration eval in [`13-risk-tiered-orchestration-and-local-only-absorption`](./13-risk-tiered-orchestration-and-local-only-absorption.md)
- unresolved seam eval in [`18-detect-unresolved-seam-before-freezing-plan`](./18-detect-unresolved-seam-before-freezing-plan.md)
- tracked role/model-routing policy in the workflow control plane

## Intent

Test whether planning escalates only when the task risk justifies it, and whether high-cost critique surfaces remain advisory instead of becoming the authoritative primary planner by default.

## Prompt

Evaluate two planning requests and one optional critique request. For each planning request, choose the primary tracked planning role from the current policy, record the observed or operator-entered model/reasoning surface, and explain why escalation was or was not justified.

- Request A: draft a normal Tier 2 plan for a bounded workflow-doc update that touches only `docs/agentic/evals/README.md`; the owner seam is known, no hotspot/composition root is involved, no priority-exit or checklist closeout is at stake, and verification is `npm run verify:docs`.
- Request B: draft a cleanup plan for a priority-exit package that touches a hotspot composition root and has an unresolved ownership seam between orchestration and UI composition; a wrong plan would create rework across multiple execution units.
- Optional critique: after either plan is drafted, decide whether a maintainability/code-health critique pass is useful and whether it is advisory or authoritative.

Do not claim the eval mechanically proves actual model identity unless the tool surface exposes it. Keep raw planning transcripts local; track only the scored summary.

## Expected Skills

- `execution-plan-authoring`
- `model-selection`
- `closeout-verification`

## Expected Codanna Behavior

- use repo-doc discovery to find the relevant plan/tier/seam guidance
- record fallback evidence if Codanna cannot identify the planning surface

## Expected Verification

- `npm run verify:docs`

## Fail Conditions

- treating normal Tier 2 planning as deep-planner work without risk evidence
- failing to escalate a hotspot, priority-exit, or unresolved-seam plan to `planner_deep`
- allowing a critique-only high-cost surface to become the authoritative primary plan without policy support
- omitting the reason why escalation was accepted or rejected
- tracking raw planning transcripts instead of a short scored summary
