# Feature Planner Launcher

Use this prompt for Tier 2 or Tier 3 feature/design work when you need a serious implementation plan for new functionality, product behavior, or UI direction.

Do not use this launcher for cleanup-only refactors; use [`cleanup-plan.md`](./cleanup-plan.md) for that path.

Run this launcher with the tracked write-capable `planner` role by default. Use `planner_deep` for Tier 3, hotspot, cross-boundary, unresolved architecture/product seam, or security-adjacent planning. Both planning roles are for bounded planning discovery, tracked plan artifacts, and execution-ready handoffs rather than product-code implementation.

## Read Order

1. [`agents.md`](../../../agents.md)
2. [`docs/AGENTIC_DEV_WORKFLOW.md`](../../AGENTIC_DEV_WORKFLOW.md)
3. [`docs/agentic/codanna-playbook.md`](../codanna-playbook.md)
4. [`docs/agentic/plan-authoring-standard.md#universal-plan-core`](../plan-authoring-standard.md#universal-plan-core)
5. [`docs/design/ui-design-language.md`](../../design/ui-design-language.md) when UI creation or redesign is in scope
6. domain current-state docs that match the feature boundary

## Invocation Inputs

Accept either of these as the task-specific input after the launcher:

- a pasted `NEXT_SESSION_HANDOFF` block; when present, treat `PLAN`, `ARTIFACT`, `FILES`, and `MESSAGE` as required additional reading after the standard read order
- one short follow-up message naming the exact feature/design scope, plan seed, or run-bundle context, for example `We are planning the Settings diagnostics redesign as feature/design work.`

If the short follow-up form is used, treat the named feature/design target as the active scope selector for the session and derive the remaining context from the tracked docs, current code, and any named artifact or plan seed.

## Required Skill Order

1. load `brainstorming` only when product intent, UX direction, or the implementation seam is still unresolved
2. load a global UI skill only when the task includes real UI creation or redesign:
   - `interface-design` for product interfaces (dashboards/admin/settings/tools/data-heavy UI)
   - `frontend-design` for marketing/landing pages and other brand-forward surfaces
3. load matching repo-local boundary skills when ownership/composition boundaries are implicated
4. use repo-local `verification-strategy` to choose the proof mode and test depth
5. use repo-local `execution-plan-authoring` for plan depth, mode selection, and verification strategy

## What This Session Must Do

- confirm this is feature/design or mixed work before selecting a risk tier
- when the user uses the short follow-up form, treat the named feature/design target as the scope selector
- run Codanna-first discovery and record the fallback if Codanna is insufficient
- clarify product/design intent, constraints, and explicit non-goals before locking steps
- separate exploration decisions from implementation sequencing so the plan is executable in a fresh session
- produce or refresh a tracked plan in [`docs/plans/`](../../plans/README.md) when durable handoff memory is needed
- keep the authoritative execution steps aligned in `update_plan`
- keep write activity confined to planning surfaces unless the parent explicitly narrows the task to a workflow/control-plane planning-doc edit

## Required Planning Constraints

- follow [`docs/agentic/plan-authoring-standard.md#universal-plan-core`](../plan-authoring-standard.md#universal-plan-core) for serious tracked plans
- declare `**Task family:** feature/design` for serious tracked feature plans
- distinguish feature/design intent work from cleanup/refactor remediation work
- for UI creation/redesign, reference [`docs/design/ui-design-language.md`](../../design/ui-design-language.md) and require the appropriate global UI skill (`interface-design` or `frontend-design`)
- resolve any open architecture seam, ownership seam, or adjacent contract decision before freezing the execution steps
- record explicit stop-and-replan conditions under the seam gate or an adjacent replan block whenever discovery, boundary, or verification failure would invalidate the current plan
- make the plan decision-complete at the seam, scope, invariants, and verification level without turning it into pseudo-code for every future implementation step
- freeze expensive-to-get-wrong decisions and deliberately leave ordinary local coding choices delegated unless a narrow contract snippet materially reduces risk
- use repo-local `verification-strategy` to select the verification mode before deciding whether new automated coverage is required
- include the full Codanna evidence trail for serious feature/design plans:
  - `semantic_search_with_context` result or explicit fallback note
  - `search_documents` result or explicit fallback note when repo-doc context matters
  - `analyze_impact` result when risky/shared symbols are involved, or an explicit note that it was not required for the current risk level
  - direct-read/`rg` fallback note when used
- include exact files in scope and out of scope, verification commands, and rollback notes when risk warrants it
- when recommending a lower-reasoning implementer for feature/design work, make `low` conditional on an approved current unit and provide a `CURRENT_EXECUTION_PACKET` with eligibility, escalation, and stop/replan rules
- classify the verification strategy for the execution surface as one of:
  - `new regression/contract test required`
  - `existing coverage sufficient`
  - `broader integration/manual proof required`
  - `no new automated test needed`
- when using `existing coverage sufficient`, name the exact existing test or proof surface that makes that claim defensible
- when using `broader integration/manual proof required` or `no new automated test needed`, name the exact integration/manual/static proof surface
- avoid brittle tests that lock helper internals, broad snapshots, or temporary structure when the real seam is behavioral, contract, integration, or UX-level
- use contract snippets only when exact interface, payload, fixture, or behavior examples materially reduce plan risk
- run the planner self-check from [`docs/agentic/plan-authoring-standard.md#planner-self-check`](../plan-authoring-standard.md#planner-self-check) before finalizing the plan
- if adjacent files may need contract/type changes, either place them in scope explicitly or freeze them explicitly and explain how the task still works
- preserve the repo verification gate expectations:
  - `npm run verify` for risky UI/navigation/Orchestrator/Plex changes
  - `npm run verify:docs` for workflow/control-plane doc changes

## Stop Conditions

Stop and resolve ambiguity before writing or finalizing a plan when:

- requirements or success criteria are still unclear
- the task routing (cleanup vs feature vs mixed) is unresolved
- UI direction is requested but design constraints are missing or contradictory
- architecture ownership expectations conflict with current-state docs
- an architecture seam or adjacent contract change is still undecided
- the plan would require policy-violating compatibility/fallback paths
- the plan needs “mechanical wiring” in files that are simultaneously declared out of scope

## Output Contract

Return:

1. plan file path (or explicit reason no tracked plan is required)
2. locked decisions and invariants
3. major impacted files/symbols and risk tier
4. exact verification commands
5. open risks/unknowns that must be resolved before implementation
6. the result of the planner self-check if anything had to be resolved before the plan became execution-safe
7. a `NEXT_SESSION_HANDOFF` block that routes to `lineup-feature-review` and includes:
   - `TASK`
   - `PLAN`
   - `ARTIFACT`
   - `FILES`
   - a pasteable review request for the finished plan that is specific enough for a fresh-session reviewer to start without reconstructing scope from prose
   - if the user explicitly asked for model guidance, or if the handoff is Tier 3 or architecture-risk score `>= 2`, include a `MODEL_SUGGESTION` block immediately before `NEXT_SESSION_HANDOFF` using repo-local `model-selection`
8. when a weaker/cheaper implementer or an unusually fragile current unit needs extra detail, include an optional `CURRENT_EXECUTION_PACKET` block before `NEXT_SESSION_HANDOFF` with:
   - `UNIT`
   - `IMPLEMENTER_ROLE_ELIGIBILITY: worker_54_high | worker`
   - `IMPLEMENTER_REASONING_ELIGIBILITY: low | medium | high`
   - `WHY`
   - `LOW_ELIGIBLE_IF`
   - `ESCALATE_TO_MEDIUM_IF`
   - `FILES_IN_SCOPE`
   - `FILES_OUT_OF_SCOPE`
   - `CONSTRAINTS`
   - `VERIFICATION`
   - `STOP_AND_REPLAN_IF`

Keep the `MODEL_SUGGESTION` schema unchanged; put lower-reasoning eligibility details only in `CURRENT_EXECUTION_PACKET`.

Use `worker_54_high` eligibility only for approved, bounded, exact, cheap-to-verify execution units. Any packet allowing `worker_54_high` must stop/escalate on ambiguity, plan contradiction, scope expansion, unexpected cross-boundary coupling, or verification failure needing diagnosis.
