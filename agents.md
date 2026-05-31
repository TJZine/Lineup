# Agents

This file is the entrypoint map for Lineup's control plane.
Use [`docs/AGENTIC_DEV_WORKFLOW.md`](./docs/AGENTIC_DEV_WORKFLOW.md) as the single operating runbook for workflow, precedence, verification routing, and where-to-look-next.

## Always-On Defaults

- Keep the authoritative execution state in Codex `update_plan`.
- Treat implementation plans as local by default; promote them into `docs/plans/*` only when durable tracked handoff memory is explicitly needed.
- Use [`docs/architecture/CURRENT_STATE.md`](./docs/architecture/CURRENT_STATE.md) for current architecture truth and [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](./ARCHITECTURE_CLEANUP_CHECKLIST.md) for active cleanup status.
- Prefer Codanna for repo discovery and Context7 for external documentation claims; record the fallback when either is insufficient.
- Preserve the completed cleanup baseline using the steady-state guardrails in the workflow runbook.
- Do not claim files changed, commands run, or tests passed unless you observed that evidence in this workspace.
- Run `npm run verify` for UI, navigation, Orchestrator, or Plex work. Run `npm run verify:docs` for workflow, control-plane, launcher, or reference-doc changes.

## Where To Look Next

- [`docs/AGENTIC_DEV_WORKFLOW.md`](./docs/AGENTIC_DEV_WORKFLOW.md): operating runbook, precedence, routing, verification, and document-role map
- [`docs/agentic/session-prompts/README.md`](./docs/agentic/session-prompts/README.md): tracked launcher templates and routing table
- [`docs/agentic/codanna-playbook.md`](./docs/agentic/codanna-playbook.md): Codanna-first discovery details
- [`docs/agentic/skill-strategy.md`](./docs/agentic/skill-strategy.md): skill topology
