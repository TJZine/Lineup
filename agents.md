# Agents

## Global Defaults (Always On)

- **Planning = Codex plan**: Keep the authoritative plan in Codex `update_plan` and (when requested) in tracked durable plan docs under `docs/plans/*`. Archive completed or superseded tracked plans to `docs/archive/plans/*` when they stop being the active handoff surface.
- **Plan authoring style = writing-plans skill**: When asked to produce an implementation plan file, use the `writing-plans` skill format by default (required header, explicit files, bite-sized steps, concrete code snippets, exact commands, expected outcomes, frequent commit checkpoints). Do not assume `writing-plans` exists under this repo’s `.codex/skills/` (it is typically provided globally via Superpowers).
- **Serious tracked plans = plan authoring standard**: For architecture-affecting, multi-session, or high-risk tracked implementation plans, follow [`docs/agentic/plan-authoring-standard.md`](./docs/agentic/plan-authoring-standard.md) instead of relying on memory or older plan shape.
- **Docs lookup = context7**: pull short, dated snippets from official sources/best-practice docs for each claim. If unavailable, log the fallback.
- **Search = Codanna first**: prefer Codanna MCP discovery tools (`semantic_search_docs`, `semantic_search_with_context`, `search_documents`, `find_symbol`) for evidence sweeps across both code and docs; fall back to `ripgrep` when Codanna is unavailable or insufficient. Respect repo ignores and log the fallback method used.
- **Discovery/Context = Codanna MCP**: use Codanna for symbol-aware context (`find_symbol`, `get_calls`, `find_callers`, `analyze_impact`) during analysis. Advisors still propose diffs; Codex executes per CODEX.md.
- **Evidence accuracy**: Do not claim files were changed, commands were run, or tests passed unless you actually observed it in this workspace. Prefer “I ran `…` and it returned `…`” over vague assertions.
- **Default workflow = 3-agent loop**: Prefer Plan → Code → Review. `docs/AGENTIC_DEV_WORKFLOW.md` is the repo workflow source of truth, and `docs/agentic/skill-strategy.md` is the skill-topology source of truth.
- **Document precedence**: Use `docs/agentic/document-map.md` for document roles and conflict resolution. For current architecture claims, `docs/architecture/CURRENT_STATE.md` wins; for active cleanup status, `ARCHITECTURE_CLEANUP_CHECKLIST.md` wins.
- **Codanna playbook**: Use `docs/agentic/codanna-playbook.md` for Codanna query shaping, impact analysis patterns, and `ripgrep` fallback rules.
- **Verification gate**: For UI/navigation/Orchestrator/Plex work, run `npm run verify` before concluding.
- **Test policy**: When a unit test fails, first ask yourself: is this exposing a real bug in the production code — or is the test itself flawed?
- **Pre-MVP path policy**: Until an explicit milestone is reached (e.g., MVP launch) as declared by the project lead, or explicitly requested and approved by the project maintainer/tech lead, do not add legacy/fallback/compatibility code paths, migration shims, or dual-path "just in case" logic.
- **UI skill order**: For UI creation or redesign, use global `frontend-design` first for design direction and quality, then load repo-local `ui-composition-patterns` for Lineup-specific TV composition, focus, motion, and cleanup rules.
- **Architecture guardrails**: For architecture-affecting work, load the repo skills that match the change before coding: `architecture-boundaries` for module ownership and composition roots, `ui-composition-patterns` for screens/overlays, `persistence-boundaries` for local storage or persisted state, and `plex-integration-boundaries` for Plex auth/discovery/library/stream policy. New code should prefer focused collaborators, explicit ownership, and centralized persistence instead of growing hotspot classes.

## Standard Flow

1) **Evidence sweep (Codanna ➜ ripgrep)** → prefer Codanna tools (`semantic_search_docs`, `semantic_search_with_context`, `search_documents`, `find_symbol`, `get_calls`, `find_callers`, `analyze_impact`) to enumerate where code/config/tests/docs live. If Codanna is unavailable or insufficient for the task, use `ripgrep` and record the fallback used.
2) **Docs check (context7 ➜ ref MCP)** → start with Context7 (title + link + date). When Context7 lacks the needed source, use `mcp__ref__ref_search_documentation` + `mcp__ref__ref_read_url` for public docs and keep excerpts short. If nothing is available, log the fallback used.
3) **Plan (Codex)** → Keep the plan in Codex via `update_plan`. For multi-step work, reflect locked decisions, risks, verification commands, and rollback notes in the plan itself (or in `docs/plans/*` when a task requires durable, tracked task memory). Use [`docs/agentic/plan-authoring-standard.md`](./docs/agentic/plan-authoring-standard.md) for serious tracked plans, use `docs/runs/` for local-only major-task execution artifacts, and move older completed tracked plans to `docs/archive/plans/*` when they no longer need to stay active.
4) **Verify (local, risk-based)** → run `npm run verify` for UI/navigation/Orchestrator/Plex work (or at least `npm run typecheck` + `npm test` for logic-only TS changes) before concluding.

## Codanna Workflow

- **Roles**
  - **Codanna** provides discovery/context via semantic search, symbol lookups, and impact analysis.
  - **Codex `update_plan`** is the authoritative plan store.

- **Tool priority (Codanna)**
  - **Tier 1**: `semantic_search_with_context`, `analyze_impact` (default limit=8, threshold≈0.35; add `lang="typescript"` if noise is high; raise limit to 10–12 when ambiguity persists; raise threshold to ~0.5 when results are too noisy).
  - **Tier 2**: `find_symbol`, `get_calls`, `find_callers` to confirm call chains and disambiguate symbols.
  - **Tier 3**: `search_symbols`, `semantic_search_docs`, `search_documents` for broader sweeps once Tier 1/2 context is captured.

- **Accuracy-first defaults**
  - **Semantic search score intuition:** ~`0.7+` is usually a strong match; `0.3–0.5` can be a weak-but-useful match for discovery.
  - **Query shaping:** include at least one concrete anchor (feature name, screen/module name, file-ish hint, or identifier). Example: "SettingsScreen transcode quality localStorage key".
  - **Discovery:** prefer `semantic_search_with_context`, summarize each key symbol, chain into `analyze_impact symbol_id:<ID>` before touching public/shared code, and broaden the query when context is weak.
  - **Docs-aware discovery:** use `search_documents` when planning/reviewing against architecture docs, decision records, or cleanup guidance instead of relying on memory.
  - **Plan:** keep `update_plan` aligned with Codanna findings; add verification/rollback actions for high-risk items.
  - **Checkpoints:** use explicit checkpoints instead of journaling:
    - before coding: restate goal + locked decisions + impacted areas
    - before risky edits: enumerate impacted files/symbols from Codanna
    - before completion: list tests/commands you ran and their results
  - **Verification:** cross-check Codanna’s impacted files against the diff, ensure tests cover each high-risk scope, and prefer broader discovery rather than missing context.

- **Workflow**
  1. **Discovery (Codanna)** – run Tier 1 queries using the defaults above, use `search_documents` for repo-doc context where relevant, chain into `analyze_impact`, and use Tier 2 lookups to trace usages; capture symbol_ids/results and summarize their implications.
  2. **Plan (Codex)** – update steps via `update_plan`, referencing Codanna context and listing verification/rollback steps when risk warrants it.
  3. **Validate/Review** – execute tests, record outcomes, and conclude by enumerating remaining risks/unknowns (if any) and how to reproduce/verify.

- **Verification guidance**
  - Cross-check impacted files from Codanna’s results against the actual diff; document how tests/rollbacks cover each high-risk area.
  - When context is unclear, prefer broader discovery over assuming coverage.

## Skills Locations (Codex vs other agents)

- **Antigravity / other agents (repo-local)**: use a generated local mirror under `.agent/skills/`, materialized with `scripts/sync_agent_skills.sh`.
- **Codex CLI (repo-local)**: source-of-truth repo skills live in `.codex/skills/`.
- **No duplicate local Codex globals**: if a skill already exists in Codex global skills, do not copy it into `.codex/skills/`; keep `.codex/skills/` reserved for Lineup-specific skills.
- **Antigravity mirrors use copies, not symlinks**: `.agent/skills/` is a local generated mirror containing copied skill folders for the curated global skills plus mirrors of the Lineup-specific repo skills.
- **Repo-local skill publishing order**: When adding or editing repo-local skills, create or update `.codex/skills/<skill>/` first, then run `scripts/sync_agent_skills.sh` to refresh `.agent/skills/`.
- **Workflow reference**: See `docs/AGENTIC_DEV_WORKFLOW.md` and `docs/agentic/skill-strategy.md` for the current skill topology and workflow rules.
