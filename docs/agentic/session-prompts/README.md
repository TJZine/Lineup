# Session Prompt Launchers

This directory contains the tracked Lineup-specific prompt templates for cleanup/refactor and feature/design workflow launches.

Use them to avoid copying large prompt blocks into fresh sessions. The tracked files here are the source of truth. Global prompts under `~/.codex/prompts/` should stay thin and point back to these files.

## Prompt Set

<!-- BEGIN MANAGED SESSION PROMPT SET -->
- [`cleanup-plan.md`](./cleanup-plan.md)
  - Tier 2 planner session for writing or refreshing a serious cleanup plan
- [`cleanup-implement.md`](./cleanup-implement.md)
  - Tier 2 implementer session for executing an approved plan in a repo-local worktree
- [`cleanup-review.md`](./cleanup-review.md)
  - reusable adversarial review session for either a plan or an implementation
- [`cleanup-loop.md`](./cleanup-loop.md)
  - Tier 3 controller session for high-risk work
- [`feature-plan.md`](./feature-plan.md)
  - Tier 2 or Tier 3 planner session for serious feature/design planning
- [`feature-implement.md`](./feature-implement.md)
  - approved feature/design implementer session; Tier 2 default, reusable in Tier 3 when a run bundle already exists
- [`feature-review.md`](./feature-review.md)
  - reusable adversarial review session for feature/design plans and implementations
- [`workflow-harness-review.md`](./workflow-harness-review.md)
  - adversarial whole-system review of the repo harness against current OpenAI and Anthropic guidance
<!-- END MANAGED SESSION PROMPT SET -->

## Routing (Authoritative)

Route task family first. Choose risk tier second.

| Task Type | Use This Path | Prompt Family | Notes |
|---|---|---|---|
| cleanup/refactor | checklist cleanup units, standalone bugfix/remediation, bounded remediation, refactors with no net-new feature intent | `cleanup-*` | choose `checklist-linked` vs `standalone remediation` before tiering; `cleanup-loop` is only for Tier 3 cleanup controller work. |
| feature/design | net-new capability, behavior expansion, product/design direction work, UI creation/redesign | `feature-plan` + `feature-implement` + `feature-review` | Tier 2 feature flow uses the same tracked planner/reviewer/implementer prompt family as cleanup, with planner -> reviewer -> implementer -> reviewer sequencing. |
| mixed | feature delivery that also includes a cleanup slice (for example hotspot extraction, ownership correction, or required doc refresh) | route by primary intent and split slices explicitly | Use `cleanup-*` only for the cleanup slice, never as umbrella control for full feature delivery. |

Mixed-task examples:

- feature delivery that also extracts hotspot responsibilities
- UI redesign that also changes ownership
- new feature work that also requires current-state or API doc updates

Cleanup sub-routing:

- `checklist-linked`
  - use when the cleanup task already belongs to a tracked checklist item or priority-exit gate
  - these tasks should update [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../../ARCHITECTURE_CLEANUP_CHECKLIST.md) in the same pass when status changes
- `standalone remediation`
  - use for QA/debugging/bug-fix work and other bounded remediation that is not owned by an existing checklist item
  - do not invent a checklist item just to route through the cleanup prompts

Tier 3 rule for feature or mixed work:

- use a task-specific run bundle in [`docs/runs/`](../../runs/README.md) plus the same feature planner -> reviewer -> implementer -> reviewer workflow
- do not treat [`cleanup-loop.md`](./cleanup-loop.md) as the controller for feature or mixed-task delivery

## Invocation

Recommended global launcher names:

- `lineup-cleanup-plan`
- `lineup-cleanup-implement`
- `lineup-cleanup-review`
- `lineup-cleanup-loop`
- `lineup-feature-plan`
- `lineup-feature-implement`
- `lineup-feature-review`
- `lineup-workflow-harness-review`

Each launcher should:

1. confirm the current repo is Lineup
2. load [`agents.md`](../../../agents.md), [`docs/agentic/document-map.md`](../document-map.md), and [`docs/AGENTIC_DEV_WORKFLOW.md`](../../AGENTIC_DEV_WORKFLOW.md)
3. load the matching file in this directory
4. if the user message includes a `NEXT_SESSION_HANDOFF` block, treat its `PLAN`, `ARTIFACT`, `FILES`, and `MESSAGE` fields as required task-specific context after the launcher read order
5. if no `NEXT_SESSION_HANDOFF` block is supplied, accept one short follow-up message that names the exact checklist item, plan path, or artifact under review and treat that message as the active scope selector for the session
6. follow the workflow in that file without duplicating repo policy text inline
7. load repo-local `model-selection` only when the user explicitly asks for model guidance or the outgoing handoff meets the auto-trigger conditions in [`docs/AGENTIC_DEV_WORKFLOW.md`](../../AGENTIC_DEV_WORKFLOW.md#session-handoffs)

### Two-Message Invocation Contract

The reusable Lineup launchers are meant to support either of these invocation styles:

1. launcher + `NEXT_SESSION_HANDOFF`
   - invoke the launcher, then paste the full handoff block
   - the session should obey the handoff's `PLAN`, `ARTIFACT`, `FILES`, and `MESSAGE`
2. launcher + one short scope message
   - invoke the launcher, then send one short follow-up naming the exact checklist item, plan, or artifact
   - example planner follow-up: `We are working on ARCHITECTURE_CLEANUP_CHECKLIST.md item P1-W1.`
   - example implementer follow-up: `Implement docs/plans/2026-03-26-p1-w1-<slug>.md for ARCHITECTURE_CLEANUP_CHECKLIST.md item P1-W1.`
   - example reviewer follow-up: `Review docs/plans/2026-03-26-p1-w1-<slug>.md for ARCHITECTURE_CLEANUP_CHECKLIST.md item P1-W1.`

When the short follow-up form is used, the launcher should derive the rest of the context from the checklist, the named plan or artifact, and the tracked workflow docs instead of waiting for a formal handoff block.

## When To Stay Reusable

Use these reusable launchers for Tier 2 cleanup work:

- routine `P#-W#` cleanup items
- standalone QA/debugging/bug-fix remediation with no net-new feature intent
- bounded refactors with one planner, one implementer, and one reviewer
- plan refreshes for active tracked plans

Use these reusable launchers for Tier 2 feature/design work:

- serious feature/design plans that need adversarial review before coding
- approved feature/design plans that should execute in a fresh implementer session
- implementation review passes after the approved plan lands

## When To Stay In One Session

Use Tier 1 single-session execution plus review when the task is:

- small
- bounded
- low-risk
- unlikely to need durable handoff memory

## When To Escalate To A Run Bundle

Create a local run bundle in [`docs/runs/`](../../runs/README.md) first when the task is already Tier 3:

- multi-session
- architecture-heavy
- likely to need repeated handoff
- high-risk across hotspots such as `src/App.ts`, `src/Orchestrator.ts`, major UI composition roots, or Plex policy surfaces

When a run bundle exists, the reusable launcher should use it as task-specific context instead of inventing a new one-off prompt.

## Design Rules

- Keep repo-specific workflow text tracked here, not in global prompt files.
- Keep launcher prompts short enough to scan in one read.
- Prefer explicit read order, exact deliverables, and exact stop conditions.
- Do not create a new reusable prompt for every feature or checklist item.
- Planner, reviewer, and implementer prompts should emit a pasteable `NEXT_SESSION_HANDOFF` block when another session is expected.
- Emit `MODEL_SUGGESTION` only when the user explicitly asked for model advice or the handoff is high-risk under the workflow trigger; do not make model advice an always-on tax.
- Update these templates when the repo workflow changes materially.
