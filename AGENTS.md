# AGENTS.md

Short entrypoint for agent-driven work in Lineup.

Use the relevant section of [docs/AGENTIC_DEV_WORKFLOW.md](docs/AGENTIC_DEV_WORKFLOW.md)
for risk, verification, planning, or handoff decisions. Load deeper context only when
the task needs it:

- ownership, hotspots, or cross-module changes: [docs/architecture/CURRENT_STATE.md](docs/architecture/CURRENT_STATE.md)
- active checklist-linked cleanup: [ARCHITECTURE_CLEANUP_CHECKLIST.md](ARCHITECTURE_CLEANUP_CHECKLIST.md)
- UI behavior: [docs/design/ui-design-language.md](docs/design/ui-design-language.md)
- Plex behavior: [docs/api/plex-integration.md](docs/api/plex-integration.md)
- Codanna query details: [docs/agentic/codanna-playbook.md](docs/agentic/codanna-playbook.md)

Always-on defaults:

- Keep live task state in `update_plan`; create a tracked plan only for durable
  cross-session memory or when explicitly requested.
- Use the smallest matching skill set: normally one process skill plus only the
  boundary skills required by the change.
- Default to one agent. Delegate independent read-heavy work or an approved,
  disjoint write unit only when the benefit exceeds coordination cost.
- Prefer current source and direct tools over detector output, archived plans, or
  remembered context.
- Preserve existing owner boundaries; do not add compatibility paths, speculative
  abstractions, or new dependencies without a demonstrated need.
- Run `npm run verify` for UI, navigation, Orchestrator, Plex, build, or runtime
  changes. Run `npm run verify:docs` for workflow/control-plane-only changes.
- Before completion, inspect the diff, preserve unrelated user changes, and report
  only verification actually observed in this workspace.
