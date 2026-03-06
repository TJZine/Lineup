# Agentic Development Workflow

This is the operating runbook for agent-driven development in Lineup.

## Read Order

1. [`agents.md`](../agents.md)
2. [`docs/agentic/document-map.md`](./agentic/document-map.md)
3. [`docs/agentic/codanna-playbook.md`](./agentic/codanna-playbook.md)
4. [`docs/architecture/CURRENT_STATE.md`](./architecture/CURRENT_STATE.md)
5. [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../ARCHITECTURE_CLEANUP_CHECKLIST.md) when the task is architecture-affecting

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
2. Run evidence sweep.
   - Prefer Codanna using [`docs/agentic/codanna-playbook.md`](./agentic/codanna-playbook.md).
   - Use Codanna for both code and repo-doc discovery before falling back to `rg`.
   - Fall back to `rg` only when Codanna is missing or insufficient.
3. Load the right source-of-truth docs.
   - architecture truth: [`docs/architecture/CURRENT_STATE.md`](./architecture/CURRENT_STATE.md)
   - active cleanup backlog: [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../ARCHITECTURE_CLEANUP_CHECKLIST.md)
   - UI language: [`docs/design/ui-design-language.md`](./design/ui-design-language.md)
   - Plex contract: [`docs/api/plex-integration.md`](./api/plex-integration.md)
4. Choose the orchestration tier before editing.
   - Tier 1: small bounded low-risk work uses one session/agent plus review before closeout
   - Tier 2: a normal cleanup unit uses planner -> implementer -> reviewer
   - Tier 3: hotspot, cross-boundary, multi-session, or otherwise high-risk work uses the controller loop, and a local run bundle when repeated handoff is likely
   - do not escalate to a heavier tier unless the lower tier would materially weaken reliability
5. Plan explicitly before multi-step work.
   - keep the authoritative plan in `update_plan`
   - write or refresh `docs/plans/*` when a task requires durable, tracked task memory
   - for serious tracked plans, follow [`docs/agentic/plan-authoring-standard.md`](./agentic/plan-authoring-standard.md)
   - move completed or superseded tracked plans to `docs/archive/plans/` once they stop being the active handoff surface
   - use `docs/runs/` for local-only major-task execution bundles and run logs
   - when drafting or reviewing serious tracked plans, use `docs/agentic/historical-plan-corpus-review.md` alongside `docs/agentic/plan-authoring-standard.md` as calibration for strong plan shape and eval seeding
   - record the Codanna impact snapshot for risky/shared-symbol edits
6. Implement narrowly.
   - one work unit at a time
   - prefer extraction over expansion in hotspot files
   - avoid compatibility shims unless explicitly approved
7. Verify based on risk.
   - `npm run verify` for UI, navigation, Orchestrator, or Plex work
   - `npm run verify:docs` for workflow/control-plane/reference doc changes
   - otherwise at least `npm run typecheck` and `npm test` for logic-only TypeScript changes
8. Review before closeout.
   - AI review is the baseline pass
   - humans still own architecture, product intent, and merge decisions
9. Update the right memory surface in the same pass.
   - update [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../ARCHITECTURE_CLEANUP_CHECKLIST.md) when a cleanup work unit is completed
   - update current-state or reference docs when ownership changes
   - update tracked plan references when a plan moves from `docs/plans/` to `docs/archive/plans/`
   - when archiving a completed cleanup section or a standout implementation plan, review whether it adds new reusable patterns or anti-patterns and update `docs/agentic/historical-plan-corpus-review.md` in the same pass
   - when a local `docs/runs/<date>-<topic>/` bundle or eval baseline changes the workflow conclusion, write the durable lesson into a tracked workflow doc or tracked eval summary in the same pass
   - do not leave stale current-state claims behind

## Repo-Local Skill Usage

- `architecture-boundaries`
  - composition roots, cross-module refactors, hotspot decomposition
- `ui-composition-patterns`
  - screens, overlays, focus flows, TV-visible UI behavior
- `persistence-boundaries`
  - local storage, settings, selected server state, channel persistence
- `plex-integration-boundaries`
  - Plex auth, discovery, library, stream, subtitle, playback-URL work

For skill topology and mirror policy, see [`docs/agentic/skill-strategy.md`](./agentic/skill-strategy.md).

After cloning the repo or updating repo-local/global mirrored skills, run `scripts/sync_agent_skills.sh` to materialize the local `.agent/skills/` mirror for Antigravity.

## Session Launchers

Use the tracked launcher templates in [`docs/agentic/session-prompts/README.md`](./agentic/session-prompts/README.md) to start fresh sessions without copy-pasting large prompt blocks.

- Tier 2 planner session: [`cleanup-plan.md`](./agentic/session-prompts/cleanup-plan.md)
- Tier 2 implementer session: [`cleanup-implement.md`](./agentic/session-prompts/cleanup-implement.md)
- reusable review session: [`cleanup-review.md`](./agentic/session-prompts/cleanup-review.md)
- Tier 3 controller session: [`cleanup-loop.md`](./agentic/session-prompts/cleanup-loop.md)
- whole-harness audit: [`workflow-harness-review.md`](./agentic/session-prompts/workflow-harness-review.md)

Use the reusable launchers only when the task risk justifies them. Tier 1 work should usually stay in one session with review. For larger multi-session or hotspot work, create a task-specific run bundle in [`docs/runs/`](./runs/README.md) and let the Tier 3 controller loop consume that bundle.

## Quality Loop

- Plan, code, verify, review.
- Use the small eval set in [`docs/agentic/evals-roadmap.md`](./agentic/evals-roadmap.md) to check whether the workflow is resisting the failure modes that matter.
- Write a tracked baseline summary after each manual eval baseline run; keep the raw run artifacts local-only.
- Feed strong completed sections and standout archived plans back into [`docs/agentic/historical-plan-corpus-review.md`](./agentic/historical-plan-corpus-review.md) so the plan standard and eval seeds keep improving.
- Run [`docs/agentic/doc-gardening-checklist.md`](./agentic/doc-gardening-checklist.md) every 2-4 weeks and after major cleanup milestones so the control plane does not drift.
- Run `npm run plans:check` when maintaining active serious plans or before claiming that a tracked plan refresh is complete.
- Use `npm run plans:stale` during maintenance passes to list archive-review candidates without auto-moving them.
- Keep the post-cleanup transition in view via [`docs/agentic/phase-2-steady-state-plan.md`](./agentic/phase-2-steady-state-plan.md).
