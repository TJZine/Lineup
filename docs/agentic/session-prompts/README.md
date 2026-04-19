# Session Launcher Templates

This directory contains the tracked Lineup-specific launcher templates for cleanup/refactor and feature/design workflow launches.

Use them to avoid copying large prompt blocks into fresh sessions. The tracked files here are the source of truth. Optional local launcher skills may point back to these files, but those thin wrappers are convenience only and should not become a second tracked control plane.

Authority, read order, and document precedence now live in [`docs/AGENTIC_DEV_WORKFLOW.md`](../../AGENTIC_DEV_WORKFLOW.md). [`docs/agentic/document-map.md`](../document-map.md) remains only as a compatibility stub for older inbound links.

## Launcher Template Set

<!-- BEGIN MANAGED SESSION PROMPT SET -->
- [`cleanup-plan.md`](./cleanup-plan.md)
  - Tier 2 planner session for writing or refreshing a serious cleanup plan
- [`cleanup-implement.md`](./cleanup-implement.md)
  - Tier 2 implementer session for executing an approved plan in a repo-local worktree
- [`cleanup-review.md`](./cleanup-review.md)
  - reusable adversarial review session for either a plan or an implementation
- [`cleanup-loop.md`](./cleanup-loop.md)
  - Tier 3 cleanup/refactor controller session for package-scoped planning/closeout and execution-unit orchestration
- [`feature-plan.md`](./feature-plan.md)
  - Tier 2 or Tier 3 planner session for serious feature/design planning
- [`feature-implement.md`](./feature-implement.md)
  - approved feature/design implementer session; Tier 2 default, reusable in Tier 3 when a run bundle already exists
- [`feature-review.md`](./feature-review.md)
  - reusable adversarial review session for feature/design plans and implementations
- [`workflow-harness-review.md`](./workflow-harness-review.md)
  - adversarial whole-system review of the repo harness against current OpenAI and Anthropic guidance
<!-- END MANAGED SESSION PROMPT SET -->

The managed-list description for `cleanup-loop.md` is intentionally concise. The authoritative scope is cleanup/refactor-only Tier 3 orchestration: keep planning/package closeout package-scoped for `checklist-linked` work, run implementation/review by approved `execution_unit` there, keep iterating planner/reviewer and implementer/reviewer until clean approval at each gate, keep `standalone remediation` to one bounded execution target unless the approved plan says otherwise, and do not route feature/design or mixed-task umbrella control through it.

Tracked role intent:

- run `cleanup-plan.md` and `feature-plan.md` with the tracked `planner` role
- run `cleanup-implement.md` and `feature-implement.md` with the tracked `worker` role
- route Tier 3 cleanup-loop.md implementation passes through the tracked cleanup_worker role only
- keep `cleanup-review.md`, `feature-review.md`, and `workflow-harness-review.md` read-only under the tracked `reviewer` role

## Routing (Authoritative)

Route task family first. Choose risk tier second.

| Task Type | Use This Path | Prompt Family | Notes |
|---|---|---|---|
| cleanup/refactor | checklist cleanup units, standalone bugfix/remediation, bounded remediation, refactors with no net-new feature intent | `cleanup-*` | choose `checklist-linked` vs `standalone remediation` before tiering; `cleanup-loop` is only for Tier 3 cleanup controller/orchestrator work, with `planner` for planning, `cleanup_worker` for approved implementation passes, `reviewer` for review, package-scoped planning/closeout for `checklist-linked` work, and one bounded execution target for `standalone remediation` unless the approved plan says otherwise. |
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

Tier 3 cleanup orchestration note:

- keep planning and closeout package-scoped for `checklist-linked` work
- for checklist-linked package work, `slice_table` remains the atomic ownership map and `execution_unit` is the execution/review surface
- require `ready_now_execution_unit` for checklist-linked package work; `ready_now_slice` remains the first slice inside that unit
- require `execution_waves` and `coverage_ledger` only when the approved execution unit spans multiple slices or explicitly opts into wave-scoped execution
- when a wave is selected, stay inside that approved wave until its completion condition is met or a replan trigger fires; wave review is the default approval gate for that coherent batch, and slice-level accounting remains required inside that unit
- keep `standalone remediation` bounded to the single approved execution target unless the plan explicitly stages it further
- large-package execution should review coherent retirement batches, not one tiny fix at a time

## Invocation

Recommended optional local launcher skill names:

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
2. load [`agents.md`](../../../agents.md) and [`docs/AGENTIC_DEV_WORKFLOW.md`](../../AGENTIC_DEV_WORKFLOW.md)
3. load the matching file in this directory
4. use the tracked role that matches the launcher intent (`planner` for planning, `worker` for implementation, `reviewer` for review)
   cleanup-loop is the exception: Tier 3 cleanup implementation inside that loop routes to cleanup_worker while Tier 2 cleanup and feature implementation stay on worker
5. if the user message includes a `NEXT_SESSION_HANDOFF` block, treat its `PLAN`, `ARTIFACT`, `FILES`, and `MESSAGE` fields as required task-specific context after the launcher read order
6. if no `NEXT_SESSION_HANDOFF` block is supplied, accept one short follow-up message that names the exact checklist item, plan path, or artifact under review and treat that message as the active scope selector for the session
7. follow the workflow in that file without duplicating repo policy text inline
8. load repo-local `model-selection` only when the user explicitly asks for model guidance or the outgoing handoff meets the auto-trigger conditions in [`docs/AGENTIC_DEV_WORKFLOW.md`](../../AGENTIC_DEV_WORKFLOW.md#session-handoffs)

Recommended explicit invocation styles:

- use `/skills` and choose the launcher skill from the picker if you keep local launcher skills installed
- type `$` and mention the exact launcher skill name in the first message if you keep local launcher skills installed
- start the session with a first message such as `Use the lineup-feature-implement skill for this task.`

The removed `~/.codex/prompts` slash-command surface is not part of the supported workflow. Local launcher skills are optional convenience only.

### Two-Message Invocation Contract

The reusable Lineup launchers are meant to support either of these invocation styles:

1. launcher skill + `NEXT_SESSION_HANDOFF`
   - invoke the launcher skill, then paste the full handoff block
   - the session should obey the handoff's `PLAN`, `ARTIFACT`, `FILES`, and `MESSAGE`
2. launcher skill + one short scope message
   - invoke the launcher skill, then send one short follow-up naming the exact checklist item, plan, or artifact
   - for `checklist-linked` package-plan implement/review sessions, include the exact approved `execution_unit` when known; if it is a wave, also name the covered `slice_id` set, and if it is omitted, the implementer/reviewer must derive it from the approved tracked package plan before proceeding
   - example planner follow-up: `We are working on ARCHITECTURE_CLEANUP_CHECKLIST.md item P1-W1.`
   - example implementer follow-up: `Implement docs/plans/2026-03-26-p1-w1-<slug>.md for ARCHITECTURE_CLEANUP_CHECKLIST.md item P1-W1 execution unit P1-W1-S1.`
   - example reviewer follow-up: `Review docs/plans/2026-03-26-p1-w1-<slug>.md for ARCHITECTURE_CLEANUP_CHECKLIST.md item P1-W1 execution unit P1-W1-S1.`
   - example wave-scoped reviewer follow-up: `Review docs/plans/2026-03-26-p1-w1-<slug>.md for ARCHITECTURE_CLEANUP_CHECKLIST.md item P1-W1 execution unit P1-W1 (slice ids P1-W1-S1, P1-W1-S2).`
   - example loop follow-up: `Run cleanup-loop for ARCHITECTURE_CLEANUP_CHECKLIST.md item P1-W1 with execution unit P1-W1.`
   - example feature planner follow-up: `We are planning the Settings diagnostics redesign as feature/design work.`
   - example feature implementer follow-up: `Implement docs/plans/2026-03-27-settings-diagnostics-redesign.md.`
   - example feature reviewer follow-up: `Review docs/plans/2026-03-27-settings-diagnostics-redesign.md.`

When the short follow-up form is used, the launcher skill should derive the rest of the context from the checklist, the named plan or artifact, and the tracked workflow docs instead of waiting for a formal handoff block.

## When To Stay Reusable

Use these reusable launcher skills for Tier 2 cleanup work:

- routine `P#-W#` cleanup items
- standalone QA/debugging/bug-fix remediation with no net-new feature intent
- bounded refactors with one planner, one implementer, and one reviewer
- plan refreshes for active tracked plans

Use these reusable launcher skills for Tier 2 feature/design work:

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

When a run bundle exists, the reusable launcher skill should use it as task-specific context instead of inventing a new one-off prompt.

## Design Rules

- Keep repo-specific workflow text tracked here, not in local launcher skills.
- Keep launcher skills thin enough to scan in one read.
- Prefer explicit read order, exact deliverables, and exact stop conditions.
- Do not create a new reusable launcher skill for every feature or checklist item.
- Planner, reviewer, and implementer launcher templates should emit a pasteable `NEXT_SESSION_HANDOFF` block when another session is expected.
- Emit `MODEL_SUGGESTION` only when the user explicitly asked for model advice or the handoff is high-risk under the workflow trigger; do not make model advice an always-on tax.
- Keep cleanup and feature launcher invocation ergonomics aligned unless the difference is intentionally documented in the tracked launcher itself.
- Update these templates when the repo workflow changes materially.
