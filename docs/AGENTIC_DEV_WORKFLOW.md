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

## Default Loop

1. Start with process skills.
   - `using-superpowers`
   - `brainstorming`
   - the matching repo-local boundary skill(s)
2. Run evidence sweep.
   - Prefer Codanna using [`docs/agentic/codanna-playbook.md`](./agentic/codanna-playbook.md).
   - Use Codanna for both code and repo-doc discovery before falling back to `rg`.
   - Fall back to `rg` only when Codanna is missing or insufficient.
3. Load the right source-of-truth docs.
   - architecture truth: [`docs/architecture/CURRENT_STATE.md`](./architecture/CURRENT_STATE.md)
   - active cleanup backlog: [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../ARCHITECTURE_CLEANUP_CHECKLIST.md)
   - UI language: [`docs/design/ui-design-language.md`](./design/ui-design-language.md)
   - Plex contract: [`docs/api/plex-integration.md`](./api/plex-integration.md)
4. Plan explicitly before multi-step work.
   - keep the authoritative plan in `update_plan`
   - write or refresh `docs/plans/*` when the task needs tracked durable task memory
   - move completed or superseded tracked plans to `docs/archive/plans/` once they stop being the active handoff surface
   - use `docs/runs/` for local-only major-task execution bundles and run logs
   - record the Codanna impact snapshot for risky/shared-symbol edits
5. Implement narrowly.
   - one work unit at a time
   - prefer extraction over expansion in hotspot files
   - avoid compatibility shims unless explicitly approved
6. Verify based on risk.
   - `npm run verify` for UI, navigation, Orchestrator, or Plex work
   - `npm run verify:docs` for workflow/control-plane/reference doc changes
   - otherwise at least `npm run typecheck` and `npm test` for logic-only TypeScript changes
7. Review before closeout.
   - AI review is the baseline pass
   - humans still own architecture, product intent, and merge decisions
8. Update the right memory surface in the same pass.
   - update [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../ARCHITECTURE_CLEANUP_CHECKLIST.md) when a cleanup work unit is completed
   - update current-state or reference docs when ownership changes
   - update tracked plan references when a plan moves from `docs/plans/` to `docs/archive/plans/`
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

## Quality Loop

- Plan, code, verify, review.
- Use the small eval set in [`docs/agentic/evals-roadmap.md`](./agentic/evals-roadmap.md) to check whether the workflow is resisting the failure modes that matter.
- Keep the post-cleanup transition in view via [`docs/agentic/phase-2-steady-state-plan.md`](./agentic/phase-2-steady-state-plan.md).
