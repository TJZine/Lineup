# Eval Baseline Summary

## Date

- `2026-04-13`

## Operator / Agent Surface

- Codex CLI

## Session Metadata

- fresh-session run: `yes`
- session id / launcher: `manual fresh session from repo root`
- repo state note (clean branch/worktree or exception): dirty worktree exception; local modifications already existed in `.codex/agents/reviewer.toml` and `.codex/agents/docs-researcher.toml`, and a stale untracked local draft plan (`docs/plans/2026-04-13-role-model-defaults-alignment.md`) existed during the run and was retired before closeout

## Prompts Run

- `19-multi-agent-role-selection-and-delegation-discipline`

## Codanna Fallback Log

- fallback used: `yes`
- if yes: exact invocation, condition, and evidence captured
  - started with `mcp__codanna__search_documents(query="19 multi-agent role selection and delegation discipline April 13 2026 reviewer docs-researcher GPT-5.4 workflow control-plane role-default alignment eval", limit=10)`
  - fallback condition: preview snippets were insufficient to verify exact TOML values, eval-trigger wording, and the local draft-plan text observed during the run
  - fallback invocation:
    - `cat docs/agentic/evals/prompts/19-multi-agent-role-selection-and-delegation-discipline.md`
    - `cat docs/agentic/evals/README.md`
    - `cat docs/AGENTIC_DEV_WORKFLOW.md`
    - `cat docs/plans/2026-04-13-role-model-defaults-alignment.md`
    - `cat .codex/config.toml`
    - `cat .codex/agents/reviewer.toml`
    - `cat .codex/agents/docs-researcher.toml`
    - `cat agents.md`
    - `cat .codex/skills/model-selection/SKILL.md`
    - `rg -n "docs-researcher|docs_researcher|reviewer|gpt-5\\.4|gpt-5\\.3-codex|multi-agent|delegat" docs .codex agents.md`
  - evidence captured in the local run bundle for this eval instance

## Fresh-Session Deviations

- none for session freshness or repo root
- repo-state exception noted above

## Outcome Summary

- Outcome: `pass`
- The current role files are aligned with the intended upgrade:
  - `.codex/agents/reviewer.toml:1-3` => `gpt-5.4`, `high`, `read-only`
  - `.codex/agents/docs-researcher.toml:1-3` => `gpt-5.4`, `medium`, `read-only`
- The workflow/control-plane docs are aligned on conservative multi-agent usage and the requirement to run prompt `19` before claiming role-surface improvements:
  - `agents.md:12-13`
  - `docs/AGENTIC_DEV_WORKFLOW.md:87,124,129-139`
  - `docs/agentic/evals/README.md:110,135`
- Multi-agent delegation was not justified for this bounded review, so the critical path stayed local and no waits or nested delegation were introduced.
- A stale untracked local draft plan existed during the run and initially appeared as drift evidence, but it was not an active tracked contradiction and was retired before closeout.
- This eval validated tracked policy/config consistency and delegation discipline only; it did not directly prove runtime model attribution for spawned sidecars because no delegation was warranted.
- `npm run verify:docs` completed successfully with exit `0`, including `22` harness-doc tests passed and `51` `verifyDocs` contract tests passed.

## Recurring Misses

- stale local drafts can be mistaken for active tracked blockers unless tracked-vs-local status is called out explicitly
- bounded control-plane evals may validate policy consistency without proving live runtime model attribution; summaries must state that caveat explicitly instead of over-claiming

## Workflow / Docs / Skills Changed In Response

- Added this tracked baseline summary
- No other tracked workflow docs or skills were changed during the eval run

## Durable Lessons Absorbed

- Prompt `19` is sufficient to catch the difference between "role files are correct" and "the whole tracked role-surface is production-ready"
- Local draft artifacts that are not part of the tracked source of truth should be retired before eval closeout so summaries do not report false blockers.

## Intentionally Local-Only Artifacts

- Local run-bundle review notes and raw scorecard for this eval instance remained local-only.

## Next Follow-Up

- If the repo wants less trigger ambiguity in the future, tighten `docs/agentic/evals/README.md` so `.codex/agents/*.toml` role-default edits are named explicitly alongside `.codex/config.toml`.
- If a future prompt-19 run uses delegation, capture direct runtime role/model attribution evidence in the transcript when the surface exposes it.
