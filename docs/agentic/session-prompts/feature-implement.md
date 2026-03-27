# Feature Implementer Launcher

Use this prompt for feature/design implementation in either mode:

- approved-plan execution (a reviewed plan already exists), or
- remediation/fix execution when `feature-review.md` routes an implementation review with material findings back here.

Tier 2 uses this as the default implementer launcher. Tier 3 feature or mixed work may reuse it when a task-specific run bundle already provides the task context.

## Read Order

1. [`agents.md`](../../../agents.md)
2. [`docs/agentic/document-map.md`](../document-map.md)
3. [`docs/AGENTIC_DEV_WORKFLOW.md`](../../AGENTIC_DEV_WORKFLOW.md)
4. the `NEXT_SESSION_HANDOFF` block that routed work here (from [`feature-review.md`](./feature-review.md))
5. the assigned tracked plan in [`docs/plans/`](../../plans/README.md) or active run bundle in [`docs/runs/`](../../runs/README.md), plus the referenced `ARTIFACT`
6. [`docs/design/ui-design-language.md`](../../design/ui-design-language.md) when UI creation or redesign is in scope
7. [`docs/architecture/CURRENT_STATE.md`](../../architecture/CURRENT_STATE.md) plus any domain docs named by the plan
8. any repo-local boundary skills named by the plan

## Invocation Inputs

Accept either of these as the task-specific input after the launcher:

- a pasted `NEXT_SESSION_HANDOFF` block; when present, treat `PLAN`, `ARTIFACT`, `FILES`, and `MESSAGE` as required additional reading after the standard read order
- one short follow-up message naming the approved plan path or active run bundle plus the target feature scope, for example `Implement docs/plans/2026-03-27-settings-diagnostics-redesign.md.`

If the short follow-up form is used, do not wait for a formal handoff block; use the named approved plan or run-bundle context as the execution surface.

## What This Session Must Do

- if `ARTIFACT` is an approving review output: execute the approved feature/design plan in a repo-local worktree under `.worktrees/` when the task is more than a tiny edit
- if `ARTIFACT` is a remediation/fix findings artifact (commonly named `implementation-findings.md`): treat it as the fix-session gate and implement only the listed fixes without widening scope
- if remediation findings are actually plan/decision/product boundary defects (not fixable safely inside the approved plan), stop and route back to `lineup-feature-plan` instead of patching ad hoc
- re-check the plan freshness gate before changing files
- re-confirm task routing before implementation if the approved plan includes a mixed cleanup slice
- run Codanna impact confirmation again before risky/shared-symbol edits if the code moved since planning
- implement one bounded work unit at a time without widening scope
- preserve the approved product/design direction instead of “simplifying” into generic output mid-implementation
- update the tracked docs that the plan explicitly requires in the same pass

## Implementation Constraints

- follow the approved plan exactly unless current repo state contradicts it
- if the approving review output and the tracked plan disagree, reconcile them before editing instead of picking one ad hoc
- if repo state contradicts the plan, update the plan first instead of improvising
- keep feature intent and cleanup intent separated; do not let cleanup-only shortcuts steer net-new behavior
- for UI creation/redesign, follow [`docs/design/ui-design-language.md`](../../design/ui-design-language.md) and use the appropriate global UI skill:
  - `interface-design` for product interfaces (dashboards/admin/settings/tools/data-heavy UI)
  - `frontend-design` for marketing/landing pages and other brand-forward surfaces
- prefer extraction and focused collaborators over growing hotspot files
- do not add fallback paths, migration shims, or dual-path logic unless explicitly approved
- do not commit local-only artifacts such as `.agent/skills/`, `docs/runs/<instance>/`, raw run bundles, or raw eval baseline artifacts
- if a local run bundle changes the workflow conclusion, commit the updated tracked baseline-summary or workflow doc before closeout and keep only the raw bundle local
- keep `update_plan` aligned with actual progress

## Verification Requirements

- run the exact commands listed in the plan
- run `npm run verify` for risky UI, navigation, Orchestrator, or Plex work
- run `npm run verify:docs` for workflow/control-plane/reference doc changes
- otherwise run at least the plan’s required `npm run typecheck` / `npm test` coverage
- do not claim success without reporting the commands that were actually run and their results

## Output Contract

Return:

1. what changed
2. what verification actually ran
3. any remaining risks or follow-up items
4. whether any tracked docs or plan references need updating before closeout
5. a `NEXT_SESSION_HANDOFF` block that routes to `lineup-feature-review` and includes:
   - `TASK`
   - `PLAN`
   - `ARTIFACT` (the patched implementation artifact, diff target, or reviewed commit containing the actual changes; do not point back to the incoming findings artifact)
   - `FILES`
   - a pasteable implementation-review request unless the task is fully blocked before code changes; keep it concrete enough that a fresh-session reviewer does not have to reconstruct the intended scope
   - if the user explicitly asked for model guidance, or if the handoff is Tier 3 or architecture-risk score `>= 2`, include a `MODEL_SUGGESTION` block immediately before `NEXT_SESSION_HANDOFF` using repo-local `model-selection`
