# Agents

## Global Defaults (Always On)

- **Planning = Codex plan + ST thoughts**: Keep the authoritative plan in Codex `update_plan`. Use Sequential‑Thinking MCP for structured thoughts per stage (not as the plan store).
- **Plan authoring style = writing-plans skill**: When asked to produce an implementation plan file, use `.codex/skills/writing-plans/SKILL.md` format by default (required header, explicit files, bite-sized steps, concrete code snippets, exact commands, expected outcomes, frequent commit checkpoints).
- **Docs lookup = context7**: pull short, dated snippets from official sources/best-practice docs for each claim. If unavailable, log the fallback.
- **Search = Codanna first**: prefer Codanna MCP discovery tools (`semantic_search_docs`, `semantic_search_with_context`, `find_symbol`) for evidence sweeps; fall back to `ripgrep` when Codanna is unavailable or insufficient. Respect repo ignores and log the fallback method used.
- **Discovery/Context = Codanna MCP**: use Codanna for symbol-aware context (`find_symbol`, `get_calls`, `find_callers`, `analyze_impact`) during analysis. Advisors still propose diffs; Codex executes per CODEX.md.
- **Metadata accuracy**: Flag hallucinated Sequential Thinking metadata—`files_touched`, `tests_to_run`, `dependencies`, `risk_level`, `confidence_score`, etc. should stay empty/default unless there is real evidence.
- **Default workflow = 3-agent loop**: Prefer Plan → Code → Review. Reference `docs/AGENTIC_DEV_WORKFLOW.md`.
- **Verification gate**: For UI/navigation/Orchestrator/Plex work, run `npm run verify` before concluding.
- **Pre-MVP path policy**: Retune currently has 0 users. Do not add legacy/fallback/compatibility code paths, migration shims, or dual-path "just in case" logic unless explicitly requested by the user.

## Standard Flow

1) **Evidence sweep (Codanna ➜ ripgrep)** → prefer Codanna tools (`semantic_search_docs`, `semantic_search_with_context`, `find_symbol`, `get_calls`, `find_callers`, `analyze_impact`) to enumerate where code/config/tests live. If Codanna is unavailable or insufficient for the task, use `ripgrep` and record the fallback used.
2) **Docs check (context7 ➜ ref MCP)** → start with Context7 (title + link + date). When Context7 lacks the needed source, use `mcp__ref__ref_search_documentation` + `mcp__ref__ref_read_url` for public docs and keep excerpts short. If nothing is available, log the fallback used.
3) **Plan (Codex + ST)** → Keep the plan in Codex via `update_plan`. Use Sequential‑Thinking MCP for short Scoping→Review notes when it helps, but do not treat ST as the plan store.
4) **Verify (local, risk-based)** → run `npm run verify` for UI/navigation/Orchestrator/Plex work (or at least `npm run typecheck` + `npm test` for logic-only TS changes) before concluding.

## Codanna + Sequential‑Thinking workflow

- **Roles**
  - **Codanna** provides discovery/context via semantic search, symbol lookups, and impact analysis.
  - **Sequential‑Thinking MCP** records structured thoughts; keep entries short (stage + metadata) and obey `guidance.recommendedNextThoughtNeeded`.
  - **Codex `update_plan`** is the authoritative plan; ST is not the planning store.

- **Tool priority (Codanna)**
  - **Tier 1**: `semantic_search_with_context`, `analyze_impact` (default limit=5, threshold≈0.5, omit `lang` unless noise is high; raise limit to 8–10 when ambiguity persists).
  - **Tier 2**: `find_symbol`, `get_calls`, `find_callers` to confirm call chains and disambiguate symbols.
  - **Tier 3**: `search_symbols`, `semantic_search_docs` for broader sweeps once Tier 1/2 context is captured.

- **Accuracy-first defaults**
  - **Discovery:** prefer `semantic_search_with_context`, summarize each key symbol, chain into `analyze_impact symbol_id:<ID>` before touching public/shared code, and broaden the query (lower threshold or raise limit) when context is weak.
  - **Plan:** keep `update_plan` aligned with Codanna findings; add verification/rollback actions for high-risk items.
  - **Thoughts:** include `stage`; only fill `files_touched` / `tests_to_run` / `dependencies` / `risk_level` when you have real evidence; do not force tool-specific `next_thought_needed` behavior.
  - **Verification:** cross-check Codanna’s impacted files against the diff, ensure tests cover each high-risk scope, and prefer broader discovery rather than missing context.

- **Workflow**
  1. **Discovery (Codanna)** – run Tier 1 queries using the defaults above, chain into `analyze_impact`, and use Tier 2 lookups to trace usages; capture symbol_ids/results and summarize their implications.
  2. **Plan (Codex)** – update steps via `update_plan`, referencing Codanna context and listing verification/rollback steps when risk warrants it.
  3. **Thoughts (ST)** – log `process_thought` payloads with the required metadata, keeping them concise yet complete, and stop once `guidance.recommendedNextThoughtNeeded` is false after Review.
  4. **Validate/Review** – execute tests, record outcomes, and conclude with a Review thought before closing.

- **ST guidance**
  - Stage aliases and stringified metadata are acceptable; keep entries focused on stage, files, tests, dependencies, and risk.
  - Ensure you record a Review-stage thought before concluding if you are using ST (do not force tool-specific `next_thought_needed` behavior).

- **Verification guidance**
  - Cross-check impacted files from Codanna’s results against the actual diff; document how tests/rollbacks cover each high-risk area.
  - When context is unclear, prefer broader discovery (lower threshold or higher limit) over assuming coverage.

## Skills Locations (Codex vs other agents)

- **Antigravity / other agents (repo-local)**: source skills live in `.agent/skills/`.
- **Codex CLI (repo-local)**: Codex loads repo skills from `.codex/skills/`.
