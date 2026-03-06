# Feature Reviewer Launcher

Use this prompt for adversarial review of a feature/design artifact from any orchestration tier.

This launcher supports review of either:

- a feature/design plan
- a feature/design implementation

## Read Order

1. [`agents.md`](../../../agents.md)
2. [`docs/agentic/document-map.md`](../document-map.md)
3. [`docs/AGENTIC_DEV_WORKFLOW.md`](../../AGENTIC_DEV_WORKFLOW.md)
4. the artifact being reviewed
5. supporting standards that apply:
   - [`docs/agentic/plan-authoring-standard.md`](../plan-authoring-standard.md) for plan review
   - [`docs/design/ui-design-language.md`](../../design/ui-design-language.md) for UI-heavy reviews
   - [`docs/architecture/CURRENT_STATE.md`](../../architecture/CURRENT_STATE.md) plus domain docs for architecture/boundary checks
   - [`docs/agentic/evals/rubric.md`](../evals/rubric.md) when workflow quality is in scope

## Review Priorities

Always look for:

- product/design intent drift
- architecture leakage and boundary violations
- weak or missing UX reasoning
- generic or low-quality UI output
- shallow verification claims
- deviation from the agreed feature/design plan

## Plan Review Criteria

When reviewing a feature/design plan, require evidence of:

- clear requirements and non-goals
- clear design direction and constraints
- correct task routing and orchestration tier for the actual work
- correct `brainstorming` usage before implementation hardening
- correct `frontend-design` usage and repo design-doc references when UI creation/redesign applies
- explicit scope boundaries, verification commands, and stop conditions
- no hidden architecture seams, ownership seams, or adjacent contract changes left for the implementer to invent
- full Codanna evidence trail plus explicit fallback logging when used
- preservation contracts for likely UX/runtime regression areas
- implementation feasibility without temporary adapters, dual ownership, or silent hotspot growth
- likely bug, UX regression, and boundary-failure vectors accounted for by the plan

## Implementation Review Criteria

When reviewing a feature/design implementation, focus on:

- UX/design regressions and weak interaction rationale
- architecture/boundary regressions or responsibility growth
- generic/sloppy UI patterns that ignore repo design direction
- missing accessibility, focus, and motion constraints where relevant
- mismatch between approved plan and implementation output
- cleanup-oriented assumptions incorrectly applied to net-new feature work

## Output Contract

- findings first, ordered by severity
- each finding names file/path and concrete risk
- open questions or assumptions after findings
- brief summary only after findings
- if no material findings exist, say so explicitly and note residual risk/testing gaps
- if another session is needed, end with one `NEXT_SESSION_HANDOFF` block:
  - when reviewing a plan with material findings: route back to `lineup-feature-plan`
  - when reviewing a plan with no material findings: route to `normal repo workflow` for implementation using the approved plan
  - when reviewing an implementation with material findings: route to `normal repo workflow` for implementation fixes
  - when reviewing an implementation with no material findings: no handoff block is required if closeout is complete
- for plan review, treat “implementation-ready” as meaning:
  - no hidden product/design or architecture decisions remain
  - the implementation path is feasible without inventing missing UI or boundary structure mid-task
  - likely UX, a11y, boundary, and verification failures are already addressed in the plan
