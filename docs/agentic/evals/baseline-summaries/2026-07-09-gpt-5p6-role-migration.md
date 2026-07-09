# Eval Baseline Summary

## Date

- `2026-07-09`

## Operator / Agent Surface

- operator: Codex main session with four fresh bounded read-only eval agents
- eval run surface: trigger-based closeout evaluation of the GPT-5.6 role migration, `worker_terra` routing, planner escalation, and reviewer specialization policy

## Session Metadata

- fresh-session run: `yes`; each prompt was evaluated by a separate bounded agent with no inherited conversation history
- session id / launcher: prompts `19`, `21`, `22`, and `23` dispatched as separate read-only eval tasks
- repo state note: dirty working tree exception; scoring was limited to the current workflow/control-plane diff and unrelated pre-existing files were left untouched
- ROLE / MODEL / REASONING_EFFORT: operator-recorded from tracked role config; runtime identity was not mechanically exposed
- task family / tier / risk score: workflow/control-plane manual eval; bounded read-only evaluation
- telemetry note: exact reasoning-token, credit, and cost telemetry was not exposed

## Prompts Run

- `19-multi-agent-role-selection-and-delegation-discipline`: `pass`
- `21-model-role-routing-cost-effectiveness`: `pass`
- `22-planner-escalation-and-plan-critique-boundaries`: `pass`
- `23-reviewer-specialization-effectiveness`: `pass`

## Verification Commands / Results

- command: `npm run verify:docs`
- observed result: passed; documentation verification passed, harness-doc tests `108/108`, and verifier-contract tests `98/98`

## Review / Rework Telemetry

- review findings count: `not observed`; prompts `21` and `23` evaluated synthetic routing cards and did not execute concrete reviews
- blocking review findings count: `not observed`
- blocking eval findings count: `0`
- accepted findings count: `not observed`
- rework rounds: `0` after the final verified policy surface
- wall time: not separately instrumented per eval task
- observed token / credit / cost data when available: not exposed

## Codanna Fallback Log

- fallback used: `yes`
- prompt `19` index command: `codanna mcp get_index_info --json`; Lineup index created/updated `2026-06-12`, `878` files, `13,379` symbols, `251` embeddings, model `JinaEmbeddingsV2BaseCode`
- prompt `19` search: `codanna mcp search_documents --json --args '{"query":"multi-agent role selection delegation discipline worker_terra bounded exact cheap-to-verify read-only roles shallow nesting wait critical path","limit":10}'`; stdout/result count was not retained
- prompt `19` fallback search: `codanna documents search "multi-agent delegation worker terra" --limit 10 --json`; `10` results; top hit was the older `2026-03-06-feature-design-workflow-rollout-meta-eval.md` baseline at similarity `0.48555034`, and current `worker_terra` policy was not surfaced
- prompt `21` index command: `codanna mcp get_index_info --json`; Lineup index created/updated `2026-06-12`, `878` files, `13,379` symbols, `15,415` relationships, `251` embeddings at `768` dimensions
- prompt `21` searches: `codanna mcp search_documents --args '{"query":"model role routing cost effectiveness planner worker_terra reviewer telemetry scorecard", "limit": 10}' --json`; `codanna mcp search_documents --args '{"query":"GPT-5.6 planner Tier 2 worker_terra approved exact bounded reviewer normal adversarial", "limit": 10}' --json`; `codanna mcp search_documents --args '{"query":"worker_terra", "limit": 10}' --json`; and `codanna mcp search_documents --args '{"query":"model selection", "limit": 10}' --json`
- prompt `21` search results: each returned `10` results; top hits were unrelated risk-register, getting-started, or observability docs with similarity `0.0774` to `0.1150`; the index predated the July 9 uncommitted migration and emitted auto-sync lock warnings
- prompt `22` index command: `codanna mcp get_index_info --json`; same Lineup June 12 index snapshot (`878` files, `13,379` symbols, `15,415` relationships, `251` embeddings at `768` dimensions)
- prompt `22` searches: `codanna mcp search_documents 'query:planner_deep priority-exit unresolved seam' limit:5 --json`; `codanna mcp search_documents 'query:maintainability_reviewer plan critique authoritative primary' limit:5 --json`; and `codanna mcp search_documents 'query:normal Tier 2 planner gpt-5.6-sol medium' limit:5 --json`
- prompt `22` search results: each returned `5` unrelated documents; top similarities were `0.061293553560972214` to `0.07463930547237396`
- prompt `22` retries: `codanna mcp search_documents 'query:planner escalation' limit:5 --json`; `codanna mcp search_documents 'query:planner_deep' limit:5 --json`; `codanna mcp search_documents 'query:plan critique' limit:5 --json`; and `codanna mcp search_documents 'query:maintainability reviewer' limit:5 --json`; only the first retained a result (`5` unrelated hits led by `Lineup UI Design Language` at `0.0715813860297203`), while exact results for the other three were not retained after `Vector dimension mismatch: expected 384, got 768` and auto-sync `LockBusy` warnings
- prompt `23` index command: `mcp__codanna__get_index_info {}`; snapshot was the wrong repository index (`336` files, `13,745` symbols, `5,758` relationships, `973` embeddings, created/updated `2026-06-11`)
- prompt `23` searches: `mcp__codanna__semantic_search_docs` with query `reviewer specialization routing normal correctness maintainability architecture hotspot persistence Plex public contract security adjacent GPT-5.6`, limit `10`; `mcp__codanna__semantic_search_with_context` with query `verifyDocs role routing public contract tests reviewer model config`, language `typescript`, limit `5`; `mcp__codanna__semantic_search_with_context` with query `AppOrchestrator App composition selected server persistence Plex stream url state`, language `typescript`, limit `5`; and `mcp__codanna__semantic_search_docs` with query `CURRENT_STATE persistence owner selected server Plex stream url AppOrchestrator`, limit `10`; all returned no matches
- prompt `23` fallback search: `mcp__codanna__search_documents` with query `reviewer role routing maintainability architecture reviewer` and tool defaults for limit/collection returned `5` wrong-repository documents, led by a Frame Compare report-viewer plan at score `0.122`
- fallback evidence captured: after those explicit insufficiency conditions, agents used targeted current-tree reads and `rg` across `docs/AGENTIC_DEV_WORKFLOW.md`, `.agents/skills/`, `.codex/config.toml`, `.codex/agents/`, eval prompts, reviewer routing, and `tools/verify-docs.mjs`

## Fresh-Session Deviations

- The evals used fresh bounded reviewer tasks rather than standalone interactive launcher sessions.
- The dirty-working-tree exception was intentional because the purpose was to evaluate the in-progress model-policy migration before commit.
- No raw eval transcripts or `docs/runs/*` artifacts were promoted.

## Outcome Summary

- Prompt `19` confirmed delegation remains optional, shallow, and role-disciplined; read-only roles stay read-only, `max_depth = 1` remains enforced, and `worker_terra` stops on ambiguity or verification diagnosis.
- Prompt `21` selected `planner` (`gpt-5.6-sol medium`) for routine planning, `worker` (`gpt-5.6-sol medium`) for normal implementation, `worker_terra` (`gpt-5.6-terra medium`) only for the explicitly eligible exact unit, and `reviewer` (`gpt-5.6-sol high`) for ordinary adversarial review.
- Prompt `22` kept bounded Tier 2 planning on `planner`, escalated a hotspot/priority-exit/unresolved-seam plan to `planner_deep` (`gpt-5.6-sol xhigh`), and kept `maintainability_reviewer` advisory rather than authoritative planning.
- Prompt `23` routed generic correctness review to `reviewer`, maintainability-only review to `maintainability_reviewer` (`gpt-5.6-sol xhigh`), and hotspot/persistence/Plex/security-adjacent review to `architecture_reviewer` (`gpt-5.6-sol xhigh`) without redundant second reviewers.
- No eval found a blocking model, effort, eligibility, delegation, or reviewer-routing defect.

## Recurring Misses

- Codanna did not represent the current uncommitted role-policy surface, so every eval needed the documented deterministic fallback.
- Exact runtime model attribution and cost telemetry remain operator-recorded unless a future surface exposes them mechanically.

## Workflow / Docs / Skills Changed In Response

- No additional workflow change was required by the eval results.
- This tracked baseline summary records the required closeout evidence for the role/model migration.

## Durable Lessons Absorbed

- Sol remains the normal implementation and quality-critical planning/review tier.
- Terra is cost-effective only when `worker_terra` eligibility is explicit and the unit is exact, bounded, directly verifiable, and equipped with stop/escalation rules.
- Spark remains useful for latency-sensitive explorer and monitor roles; Luna is the monitor fallback rather than a quality-critical planning or review model.
- Reviewer specialization should follow the risk surface, not a blanket preference for the strongest reviewer.

## Intentionally Local-Only Artifacts

- Raw eval task transcripts remain local/session-only.
- Unrelated dirty and untracked repository files were not modified or staged.

## Next Follow-Up

- Re-run prompts `19`, `21`, `22`, and `23` when tracked role/model routing, worker eligibility, planner escalation, reviewer specialization, or reasoning-effort policy changes materially.
