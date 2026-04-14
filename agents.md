# Agents

This file is the entrypoint map for Lineup's control plane. Keep it short. Use [`docs/AGENTIC_DEV_WORKFLOW.md`](./docs/AGENTIC_DEV_WORKFLOW.md) for the operating runbook, document precedence, and where-to-look-next.

## Global Defaults (Always On)

- **Planning = Codex plan**: Keep the authoritative plan in Codex `update_plan` and, when durable tracked memory is needed, in `docs/plans/*`. Move completed or superseded tracked plans to `docs/archive/plans/*` once they stop being the active handoff surface.
- **Plan authoring = tracked standard**: When asked to write an implementation plan, use the `writing-plans` skill format. Serious tracked plans follow [`docs/agentic/plan-authoring-standard.md`](./docs/agentic/plan-authoring-standard.md).
- **Operating runbook = workflow doc**: [`docs/AGENTIC_DEV_WORKFLOW.md`](./docs/AGENTIC_DEV_WORKFLOW.md) is the single operating runbook for read order, document precedence, workflow routing, tracked-vs-local hygiene, and launcher usage.
- **Docs lookup = Context7**: Pull short, dated snippets from official docs for external claims. If unavailable, log the fallback.
- **Search / discovery = Codanna first**: Prefer Codanna MCP discovery tools for repo-doc and code evidence sweeps. Fall back to `rg` only when Codanna is unavailable or insufficient, and record the fallback.
- **Evidence accuracy**: Do not claim files were changed, commands were run, or tests passed unless you actually observed it in this workspace.
- **Workflow routing = risk-tiered**: Route task family first, then choose the lightest valid orchestration tier. The workflow doc is the source of truth for Tier 1 / Tier 2 / Tier 3 behavior.
- **Codex multi-agent roles = tracked and conservative**: Prefer the repo-defined role config in `.codex/config.toml` and `.codex/agents/*.toml`; keep read-only roles read-only, keep worker write scopes disjoint, and wait sparingly.
- **Current truth surfaces**: [`docs/architecture/CURRENT_STATE.md`](./docs/architecture/CURRENT_STATE.md) wins for current architecture claims. [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](./ARCHITECTURE_CLEANUP_CHECKLIST.md) wins for active cleanup status.
- **Codanna playbook**: Use [`docs/agentic/codanna-playbook.md`](./docs/agentic/codanna-playbook.md) for query shaping, impact analysis, and fallback rules.
- **Verification gates**: Run `npm run verify` for UI, navigation, Orchestrator, or Plex work. Run `npm run verify:docs` for workflow, control-plane, launcher, or reference-doc changes.
- **Test policy**: When a unit test fails, first ask whether it exposed a real production bug or a flawed test.
- **Pre-MVP path policy**: Do not add legacy paths, compatibility shims, migrations, or dual-path “just in case” logic unless explicitly approved.
- **UI skill order**: For UI creation or redesign, choose exactly one global UI skill by intent: `interface-design` for product interfaces, `frontend-design` for marketing or brand-forward surfaces; then load repo-local `ui-composition-patterns`.
- **Architecture guardrails**: Load the matching repo-local boundary skill before architecture-affecting work: `architecture-boundaries`, `ui-composition-patterns`, `persistence-boundaries`, or `plex-integration-boundaries`, as applicable.
- **Local artifact absorption**: When a local run bundle or eval baseline changes the workflow conclusion, promote the durable lesson into a tracked doc or tracked eval summary in the same pass and leave only the raw artifacts local-only.

## Where To Look Next

- [`docs/AGENTIC_DEV_WORKFLOW.md`](./docs/AGENTIC_DEV_WORKFLOW.md): operating runbook, precedence, routing, verification, and document-role map
- [`docs/agentic/session-prompts/README.md`](./docs/agentic/session-prompts/README.md): tracked launcher templates and routing table
- [`docs/agentic/codanna-playbook.md`](./docs/agentic/codanna-playbook.md): Codanna-first discovery details
- [`docs/agentic/skill-strategy.md`](./docs/agentic/skill-strategy.md): skill topology and mirror policy
