# Agentic Development Workflow

This is the operating runbook for agent-driven development in Lineup.

## Launcher Load Order

Read these in this order when bootstrapping a fresh session. This is the bootstrap/load sequence, not a second precedence ladder.

1. this file
2. [`agents.md`](../agents.md)
3. [`docs/agentic/codanna-playbook.md`](./agentic/codanna-playbook.md) when you need Codanna query shaping or fallback rules
4. [`docs/agentic/session-prompts/README.md`](./agentic/session-prompts/README.md) when you need tracked launcher routing or invocation rules
5. [`docs/architecture/CURRENT_STATE.md`](./architecture/CURRENT_STATE.md) for current architecture claims
6. [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../ARCHITECTURE_CLEANUP_CHECKLIST.md) for active cleanup status or checklist-linked work

## Authority And Document Roles

This doc is the single operating runbook for Lineup's control plane.

- [`agents.md`](../agents.md) is the short entrypoint map and always-on defaults surface. It should not become a second runbook.
- [`docs/agentic/document-map.md`](./agentic/document-map.md) is a compatibility stub only. Do not use it as a second authority surface for precedence, read order, or workflow policy.

## Document Precedence

When tracked docs conflict, use this order:

1. this file for operating workflow, precedence, and where-to-look-next
2. [`agents.md`](../agents.md) for entrypoint defaults only; it is not a second runbook
3. [`docs/agentic/codanna-playbook.md`](./agentic/codanna-playbook.md) for Codanna query shaping and fallback rules
4. [`docs/agentic/skill-strategy.md`](./agentic/skill-strategy.md) for skill topology and mirror policy
5. [`docs/architecture/CURRENT_STATE.md`](./architecture/CURRENT_STATE.md) for current architecture claims
6. [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../ARCHITECTURE_CLEANUP_CHECKLIST.md) for active cleanup and live status
7. domain-specific current docs such as [`docs/design/ui-design-language.md`](./design/ui-design-language.md) and [`docs/api/plex-integration.md`](./api/plex-integration.md)
8. active task plans in [`docs/plans/`](./plans/README.md) when working that task
9. historical and reference docs such as [`docs/archive/plans/`](./archive/plans/README.md) and [`docs/decisions/README.md`](./decisions/README.md)

## Where To Look Next

- **Tool playbook**: [`docs/agentic/codanna-playbook.md`](./agentic/codanna-playbook.md)
- **Tracked launcher routing and invocation**: [`docs/agentic/session-prompts/README.md`](./agentic/session-prompts/README.md)
- **Current architecture truth**: [`docs/architecture/CURRENT_STATE.md`](./architecture/CURRENT_STATE.md)
- **Active cleanup / live status**: [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../ARCHITECTURE_CLEANUP_CHECKLIST.md)
- **Task-level plans**: [`docs/plans/`](./plans/README.md) for active tracked implementation memory
- **Archived plans**: [`docs/archive/plans/`](./archive/plans/README.md) for completed or superseded tracked plans
- **Local execution artifacts**: [`docs/runs/`](./runs/README.md) and raw eval outputs under `docs/agentic/evals/baselines/` stay local-only by default; promote durable lessons into tracked docs or tracked eval summaries in the same pass
- **Skill topology**: [`docs/agentic/skill-strategy.md`](./agentic/skill-strategy.md)
- **Evaluation roadmap and tracked summaries**: [`docs/agentic/evals/README.md`](./agentic/evals/README.md), [`docs/agentic/evals-roadmap.md`](./agentic/evals-roadmap.md), and [`docs/agentic/evals/baseline-summaries/`](./agentic/evals/baseline-summaries/README.md)
- **Historical corpus review**: optional calibration for plan review, harness review, eval seeding, and archive-ingestion follow-up
- **Plan and launcher standards**: [`docs/agentic/plan-authoring-standard.md`](./agentic/plan-authoring-standard.md) and [`docs/agentic/session-prompts/README.md`](./agentic/session-prompts/README.md)
- **Steady-state transition**: [`docs/agentic/phase-2-steady-state-plan.md`](./agentic/phase-2-steady-state-plan.md)
- **Recurring maintenance**: [`docs/agentic/doc-gardening-checklist.md`](./agentic/doc-gardening-checklist.md)

## Goals

- keep agent context explicit and inspectable
- keep the control plane small and authoritative
- use Codanna-first discovery for code understanding
- prevent hotspot files from absorbing more responsibility
- catch debt early through verification, review, and evals

## Default Workflow

1. Start with the relevant process skills.
   - always: `using-superpowers`
   - add `brainstorming` when shaping new functionality, behavior, or design
   - add the matching repo-local boundary skill(s) when the task crosses that boundary
   - for cleanup/refactor planning, the default planning order is: `using-superpowers` -> `brainstorming` -> matching repo-local boundary skill(s) -> `writing-plans`
   - for feature/design planning, the default planning order is:
     `using-superpowers` -> `brainstorming` -> one global UI skill when UI creation/redesign is actually in scope -> matching repo-local boundary skill(s) -> `writing-plans`
     - choose exactly one global UI skill:
       - `interface-design` for product interfaces (dashboards/admin/settings/tools/data-heavy UI)
       - `frontend-design` for marketing/landing pages and other brand-forward surfaces
2. Run evidence sweep.
   - Prefer Codanna using [`docs/agentic/codanna-playbook.md`](./agentic/codanna-playbook.md).
   - Use Codanna for both code and repo-doc discovery before falling back to `rg`.
   - Fall back to `rg` only when Codanna is missing or insufficient.
   - For any task that uses `desloppify` outputs as acceptance or checklist evidence, run those authoritative `desloppify` commands on the integration branch that will receive the updates.
   - Do not run authoritative `desloppify` evidence passes in worktrees. If a worktree run is unavoidable, synchronize the full `.desloppify` state first, treat output as provisional, and rerun on the integration branch before recording dispositions.
3. Load the right source-of-truth docs.
   - architecture truth: [`docs/architecture/CURRENT_STATE.md`](./architecture/CURRENT_STATE.md)
   - active cleanup backlog: [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../ARCHITECTURE_CLEANUP_CHECKLIST.md)
   - UI language: [`docs/design/ui-design-language.md`](./design/ui-design-language.md)
   - Plex contract: [`docs/api/plex-integration.md`](./api/plex-integration.md)
4. Route task family before choosing a tier.
   - Use the authoritative routing table in [`docs/agentic/session-prompts/README.md`](./agentic/session-prompts/README.md#routing-authoritative).
   - choose exactly one task family first: cleanup/refactor, feature/design, or mixed
   - if the task family is `cleanup/refactor`, choose one cleanup subtype before selecting a tier:
     - `checklist-linked`: tracked checklist work such as a `P#-W#` item, `P#-EXIT`, or other cleanup slice that must update [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../ARCHITECTURE_CLEANUP_CHECKLIST.md)
     - `standalone remediation`: QA/debugging/bug-fix work or other bounded remediation with no net-new feature intent and no existing checklist owner; do not invent checklist linkage just to use the cleanup lane
   - for mixed work, split feature and cleanup slices explicitly so cleanup prompts are only used for the cleanup slice
5. Choose the orchestration tier before editing.
   - Tier 1: small bounded low-risk work uses one session/agent plus review before closeout
   - Tier 2: a normal cleanup unit uses planner -> implementer -> reviewer
   - Tier 2 feature/design work uses the same tracked planner/reviewer/implementer prompt family as cleanup, with planner -> reviewer -> implementer -> reviewer sequencing
   - Tier 3: hotspot, cross-boundary, multi-session, or otherwise high-risk work uses the controller loop, and a local run bundle when repeated handoff is likely
   - for Tier 3 feature or mixed work, use a task-specific run bundle and the normal workflow; do not treat `cleanup-loop` as umbrella control for feature delivery
   - do not escalate to a heavier tier unless the lower tier would materially weaken reliability
6. Plan explicitly before multi-step work.
   - keep the authoritative plan in `update_plan`
   - write or refresh `docs/plans/*` when a task requires durable, tracked task memory
   - for cleanup work, record whether the task is `checklist-linked` or `standalone remediation` before freezing the plan; only `checklist-linked` tasks should promise checklist updates or priority-exit progress
   - for serious tracked plans, follow [`docs/agentic/plan-authoring-standard.md`](./agentic/plan-authoring-standard.md)
   - before freezing a serious tracked plan, run the planner self-check from the plan standard so unresolved seams, wrong owners, contradictory scope, or missing evidence are surfaced before execution
   - if an architecture seam or adjacent contract change is still undecided, resolve that boundary before freezing a “decision-point-free” execution plan
   - when a mapped imported issue is broader than the proposed slice, choose one intended final owner up front; do not approve a narrow slice that expects `P#-EXIT` to keep re-splitting the same issue envelope by default
   - if a slice is only retiring one sub-claim of a broader detector issue, name that sub-claim explicitly in the plan and say whether the same work unit or one already-named final owner will carry any residual live debt
   - if a cleanup slice is the last planned `P#-W#` item for a priority, add an explicit priority-exit step before any `P(n+1)` work begins
   - a final `P#-W#` plan is incomplete unless its `Priority-exit readiness` section names every mapped imported issue with an exact disposition, assigns a single final owner to every deferred or split-follow-up item, records exact `P0` security issue ids plus revisit triggers for anything not cleared, and lists the evidence/commands that will close `P#-EXIT`
   - when a plan's main job is closeout or reconciliation of detector-backed ownership/coupling findings, do not treat detector silence alone as sufficient evidence; require a current-code source audit, ownership proof matrix, or equivalent explicit justification tied to the checklist outcome being claimed
   - when detector-backed closeout work finds that a slice-owned rationale is gone but the same issue id still reports broader stale evidence, prefer recording the slice as resolved on current-code proof and keep one established final owner for any remaining live residual instead of minting another routine split follow-up
   - move completed or superseded tracked plans to `docs/archive/plans/` once they stop being the active handoff surface
   - use `docs/runs/` for local-only major-task execution bundles and run logs
   - keep path surfaces truthful across memory tiers: local run-bundle artifacts should continue to reference `docs/runs/...` until their durable lessons are promoted into tracked docs; do not relabel local artifacts as `docs/plans/...` in handoffs or required-reading sections
   - treat `docs/agentic/historical-plan-corpus-review.md` as optional calibration, not default required reading, when a serious tracked plan needs extra example-driven review context or when you are updating eval seeds
   - for serious tracked plans, record the full Codanna evidence trail: `semantic_search_with_context`, `search_documents` when repo-doc context matters, `analyze_impact`, and any explicit fallback reads
   - record the Codanna impact snapshot for risky/shared-symbol edits
7. Implement narrowly.
   - one work unit at a time
   - prefer extraction over expansion in hotspot files
   - avoid compatibility shims unless explicitly approved
8. Verify based on risk.
   - `npm run verify` for UI, navigation, Orchestrator, or Plex work
   - `npm run verify:docs` for workflow/control-plane/reference doc changes
   - `npm run verify:docs` warns for checklist plan paths that are untracked (including when the path is missing from the workspace and not tracked), and still fails for missing tracked plan references or other docs regressions
   - `npm run verify:docs:workspace` downgrades missing tracked plan references to warnings during active local plan churn, but it does not replace the normal `npm run verify:docs` gate before closeout
   - if prompt inventories or their README indexes changed, run `npm run docs:sync` before the docs verifier so the managed sections stay aligned with the tracked manifest
   - when tracked workflow/control-plane, launcher, repo-local skill, or multi-agent role guidance changes materially, run the trigger-based manual evals listed in [`docs/agentic/evals/README.md`](./agentic/evals/README.md) before claiming the workflow change is production-ready
   - otherwise at least `npm run typecheck` and `npm test` for logic-only TypeScript changes
9. Review before closeout.
   - AI review is the baseline pass
   - humans still own architecture, product intent, and merge decisions
   - if the work claims to finish a cleanup priority, run a priority-exit review before starting or planning the next priority
   - priority-exit review must verify:
     - authoritative `desloppify` evidence requirements are satisfied; see Step 2 for the canonical integration-branch rule
     - every imported review issue mapped to that priority is retired, explicitly deferred, or split into a new owned follow-up
     - every deferred or split item has one named final owner plus a reason and revisit trigger, especially when one issue was mapped across multiple `P#-W#` items
     - detector lag is not being mistaken for live residual debt: when current-code proof shows a slice-owned rationale is gone, the review should prefer “resolved on source audit” over creating another follow-up just because the exact issue id still prints stale wording
     - the same imported issue is not being re-split for a second time unless the current source audit shows a genuinely different remaining owner or the earlier owner mapping was wrong
     - every deferred or split item is mirrored into its destination checklist work item (`Pn-Wm`) with exact issue id(s) and required verification command(s), not only in the source `P#-EXIT` record
     - the `P0` security gate has been cleared or explicitly deferred with exact issue ids
     - the strongest verification/evidence commands for that priority have been rerun on current code
     - no `P(n+1)` checklist item, plan, or implementation work has been opened while `P#-EXIT` is still unresolved
     - `P#-EXIT` is acting as a reconciliation gate, not a routine follow-up factory; if no new live owner was discovered, the exit should confirm the established final owner rather than minting new work
10. Update the right memory surface in the same pass.
   - update [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../ARCHITECTURE_CLEANUP_CHECKLIST.md) when a `checklist-linked` cleanup work unit is completed
   - when a `P#-W#` slice implementation is done, rerun the slice verification and then check that work-unit box in the same pass once every mapped issue is either retired on current evidence or explicitly recorded there as `deferred`/`split follow-up` with one exact owner, reason, and revisit trigger
   - when the slice-owned rationale is retired on current-code proof but the same detector id still reports broader stale evidence, mark the slice issue as resolved in that work unit and record the stale detector residue plus the already-established final owner for any still-live residual; do not create a new follow-up solely because the issue id stayed open
   - do not leave a finished `P#-W#` unchecked merely because its remaining mapped debt now belongs to `P#-EXIT`; the unchecked state is for unfinished slice work or missing disposition data, not for already-reassigned debt
   - a checked `P#-W#` means the slice is complete; it does not authorize `P(n+1)` work while `P#-EXIT` is still open
   - for `standalone remediation`, do not create or update checklist linkage unless the task is intentionally promoted into tracked cleanup backlog
   - complete the matching `P#-EXIT` item and its auditable exit record before opening `P(n+1)` in the checklist or minting new tracked plans for `P(n+1)`
   - update current-state or reference docs when ownership changes
   - update tracked plan references when a plan moves from `docs/plans/` to `docs/archive/plans/`
   - when a `P#-EXIT` record reassigns an issue to `Pn-Wm`, update the destination `Pn-Wm` checklist bullet in the same pass with an explicit inherited-follow-up note (source exit, exact issue id(s), and required verification command(s))
   - do not reassign the same imported issue to a new destination work item purely because detector wording stayed stale after a verified slice; only reassign when current-code proof shows a different remaining live seam
   - when archiving a completed cleanup section or a standout implementation plan, review whether it adds new reusable patterns or anti-patterns and update `docs/agentic/historical-plan-corpus-review.md` in the same pass
   - when archiving a completed section summary (`*section-summary.md`), add the required `Harness Ingestion Triage` block and run `npm run harness:ingestion`
   - when a local `docs/runs/<date>-<topic>/` bundle or eval baseline changes the workflow conclusion, write the durable lesson into a tracked workflow doc or tracked eval summary in the same pass
   - do not leave stale current-state claims behind
11. Close workflow/control-plane changes deliberately.
   - when launcher invocation behavior changes, update the matching tracked launcher docs and keep cleanup vs feature ergonomics aligned unless a documented difference is intentional
   - when repo-local skills change, sync the `.agent/skills/` mirror with `scripts/sync_agent_skills.sh`
   - when prompt inventories or managed README sections change, run `npm run docs:sync` before `npm run verify:docs`
   - when workflow, launcher, skill, or role changes trip an eval trigger, run the required manual eval prompt set named in [`docs/agentic/evals/README.md`](./agentic/evals/README.md) and record the tracked baseline summary in the same pass
   - do not claim a workflow-quality improvement from prose alone; pair the doc update with the matching verification and eval evidence

## Multi-Agent Usage (Optional)

Use Codex multi-agent support only when it improves reliability for non-critical-path sidecars; do not replace the default Tier 1/Tier 2/Tier 3 workflow with “always multi-agent”.

- Keep immediate critical-path work local when the very next action depends on it.
- Delegate independent sidecars such as targeted exploration, adversarial review, docs verification, bounded disjoint implementation slices, or long waits/polling.
- Treat the tracked role config as canonical for the role catalog and defaults:
  - `.codex/config.toml`
  - `.codex/agents/*.toml`
  - `agents.md`
- Keep read-only roles read-only; do not route edits through exploration/review/docs/monitor roles (enforced by the tracked config + verifier).
- Do not spawn nested worker trees by default; keep delegation shallow (enforced by the tracked config + verifier).
- Wait sparingly; block only when the next critical-path action truly depends on a delegated result.

## Repo-Local Skill Usage

- `architecture-boundaries`
  - composition roots, cross-module refactors, hotspot decomposition
- `ui-composition-patterns`
  - screens, overlays, focus flows, TV-visible UI behavior
- `persistence-boundaries`
  - local storage, settings, selected server state, channel persistence
- `plex-integration-boundaries`
  - Plex auth, discovery, library, stream, subtitle, playback-URL work
- `model-selection`
  - explicit "which model should I use?" requests and high-risk handoffs that need a model recommendation for the next session

For skill topology and mirror policy, see [`docs/agentic/skill-strategy.md`](./agentic/skill-strategy.md).

After cloning the repo or updating repo-local/global mirrored skills, run `scripts/sync_agent_skills.sh` to materialize the local `.agent/skills/` mirror for Antigravity.

## Session Launchers

Use the tracked launcher templates in [`docs/agentic/session-prompts/README.md`](./agentic/session-prompts/README.md) to start fresh sessions without copy-pasting large prompt blocks.

If you keep optional local launcher skills installed, invoke them explicitly through `/skills`, `$<skill-name>`, or a first message that names the exact launcher skill. The tracked workflow should not depend on those thin wrappers existing inside the repo.

- Tier 2 planner session: [`cleanup-plan.md`](./agentic/session-prompts/cleanup-plan.md)
- Tier 2 implementer session: [`cleanup-implement.md`](./agentic/session-prompts/cleanup-implement.md)
- reusable review session: [`cleanup-review.md`](./agentic/session-prompts/cleanup-review.md)
- Tier 3 controller session: [`cleanup-loop.md`](./agentic/session-prompts/cleanup-loop.md)
- Tier 2/3 feature planner session: [`feature-plan.md`](./agentic/session-prompts/feature-plan.md)
- approved feature implementer session: [`feature-implement.md`](./agentic/session-prompts/feature-implement.md) (Tier 2 default; reusable in Tier 3 when a run bundle already exists)
- reusable feature/design review session: [`feature-review.md`](./agentic/session-prompts/feature-review.md)
- whole-harness audit: [`workflow-harness-review.md`](./agentic/session-prompts/workflow-harness-review.md)

Feature Tier 2 work should use the same explicit tracked prompt family as cleanup, with planner (`feature-plan`) -> reviewer (`feature-review`) -> implementer (`feature-implement`) -> reviewer (`feature-review`).

Use the reusable launchers only when the task risk justifies them. Tier 1 work should usually stay in one session with review.

For larger multi-session or hotspot work, create a task-specific run bundle in [`docs/runs/`](./runs/README.md). Use `cleanup-loop` only for Tier 3 cleanup/refactor control; for Tier 3 feature or mixed work, keep the same feature `feature-plan` + `feature-review` + `feature-implement` + `feature-review` workflow, use the run bundle as the task-specific context, and keep cleanup prompts scoped to the cleanup slice.

## Session Handoffs

Planner, reviewer, and implementer sessions should end with a pasteable next-session handoff whenever another session is expected.

When the user explicitly asks for model guidance, or when the outgoing handoff is Tier 3 or has architecture-risk score `>= 2`, include a `MODEL_SUGGESTION` block immediately before the handoff. Omit it for Tier 1 and low-risk Tier 2 work by default to avoid spending tokens on routine recommendations.

Architecture-risk score:

- start at `0`
- add `+1` for each:
  - hotspot file or composition root involved
  - ownership move or cross-module wiring change
  - more than one repo-local boundary skill applies
  - priority-exit, checklist, or merge-blocking review consequence
  - mixed routing ambiguity or likely hidden dependency

Use this shape when the trigger applies:

```text
MODEL_SUGGESTION
PLANNER: <model or "n/a">
IMPLEMENTER: <model or "n/a">
REVIEWER: <model or "n/a">
WHY: <short reason tied to the risk signals>
```

Use a fenced text block with this shape:

```text
NEXT_SESSION_HANDOFF
NEXT_SESSION_LAUNCHER: <launcher skill name or "normal repo workflow">
TASK: <task id and short title>
TASK_FAMILY: <cleanup/refactor|feature/design|mixed>
TIER: <Tier 1|Tier 2|Tier 3>
PLAN: <plan path or "none">
ARTIFACT: <reviewed artifact or diff target>
FILES:
- <key file or artifact path>
BLOCKERS: <none or short blocker summary>
MESSAGE:
<pasteable next-session message>
```

Rules:

- prefer one exact next step, not multiple possible next launcher skills
- if review findings block progress, the handoff should point back to the session type that must resolve them
- if no further session is needed, say so explicitly instead of emitting a fake handoff
- keep the handoff block short enough to paste directly into the next fresh session
- do not require users to reconstruct the next launcher/message from prose paragraphs
- keep `TASK`, `PLAN`, and `FILES` concrete enough that the next fresh session can start without extra reconstruction

## Quality Loop

- Plan, code, verify, review.
- Use the small eval set in [`docs/agentic/evals-roadmap.md`](./agentic/evals-roadmap.md) to check whether the workflow is resisting the failure modes that matter.
- Use [`docs/agentic/evals/README.md`](./agentic/evals/README.md) as the trigger table for which manual eval prompts must rerun after workflow/control-plane, launcher, skill, or role-surface changes.
- Write a tracked baseline summary after each manual eval baseline run; keep the raw run artifacts local-only.
- Feed strong completed sections and standout archived plans back into [`docs/agentic/historical-plan-corpus-review.md`](./agentic/historical-plan-corpus-review.md) so the plan standard and eval seeds keep improving.
- Use `npm run harness:ingestion` as the lightweight report for archived section summaries that are still `pending` or `deferred` for harness follow-up.
- Run [`docs/agentic/doc-gardening-checklist.md`](./agentic/doc-gardening-checklist.md) every 2-4 weeks and after major cleanup milestones so the control plane does not drift.
- Run `npm run plans:check` when maintaining active serious plans or before claiming that a tracked plan refresh is complete.
- Use `npm run plans:stale` during maintenance passes to list archive-review candidates without auto-moving them.
- Keep the post-cleanup transition in view via [`docs/agentic/phase-2-steady-state-plan.md`](./agentic/phase-2-steady-state-plan.md).
