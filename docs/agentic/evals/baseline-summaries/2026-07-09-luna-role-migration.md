# Eval Baseline Summary

## Date

- `2026-07-09`

## Operator / Agent Surface

- operator: Codex main session with three fresh bounded read-only eval agents
- eval surface: trigger-based closeout evaluation of the Luna role migration and its delegation/cost-routing policy

## Session Metadata

- fresh-session run: `yes`; prompts `13`, `19`, and `21` ran in separate read-only sessions
- repo state note: intentional dirty-worktree exception while validating the pre-commit control-plane migration; unrelated pre-existing files were not edited or staged
- configured eval role: `worker_luna` where the session reported its repository mapping
- configured model / reasoning effort: `gpt-5.6-luna` / `xhigh`, operator-recorded from `.codex/config.toml` and `.codex/agents/worker-luna.toml`
- runtime identity note: the subagent surface did not independently expose exact model or reasoning telemetry
- observed token, credit, and cost data: not exposed

## Prompts Run

- `13-risk-tiered-orchestration-and-local-only-absorption`: `pass`
- `19-multi-agent-role-selection-and-delegation-discipline`: `pass`
- `21-model-role-routing-cost-effectiveness`: `pass` after one fresh-session rerun

## Verification Commands / Results

- command: `npm run verify:docs`
- observed result: passed; documentation verification passed, harness-doc tests `108/108`, and verifier-contract tests `104/104`
- command: `git diff --check`
- observed result: passed

## Review / Rework Telemetry

- blocking findings: `1` in the first prompt `21` run; its Card C still named the retired `worker_terra` role
- accepted findings: `1`; Card C and its failure conditions were updated to `worker_luna`
- final blocking findings: `0`
- rework rounds: `1`; prompt `21` was rerun in a fresh session after the correction and passed
- exact per-session wall time: not consistently exposed; the final prompt `21` verifier portion took approximately `20 seconds`

## Codanna Fallback Log

- fallback used: `yes` for all three prompts
- prompt `13`: Codanna document searches returned weak results and a `Vector dimension mismatch: expected 384, got 768` warning; the evaluator used focused reads of the workflow, launcher README, run policy, eval policy, and entrypoint
- prompt `19`: `search_documents` resolved against the Frame Compare index rather than Lineup; the evaluator used focused reads of Lineup's entrypoint, workflow, role config, role TOML, Codanna playbook, and required skills
- prompt `21`: Lineup's June 12 index returned five irrelevant results per query with top similarity at or below `0.0895`, plus vector-dimension and lock-contention warnings; the evaluator used focused `rg` and direct reads of role config, role TOMLs, model selection, review routing, workflow, and eval scorecard
- fallback condition: the indexes were stale, wrong-repository, or too noisy to represent the current uncommitted role-policy surface

## Fresh-Session Deviations

- The evals used bounded read-only subagent sessions rather than standalone interactive launcher sessions.
- Prompt `21` required a second fresh session because the first session caught a stale active eval-card reference during the migration.
- No raw transcripts or `docs/agentic/evals/baselines/*` artifacts were promoted.

## Outcome Summary

- Prompt `13` kept the bounded workflow clarification at Tier 1 and avoided creating a run bundle or one-off tracked control-plane artifact.
- Prompt `19` confirmed delegation remains optional, shallow, and role-disciplined; no extra worker, reviewer, researcher, monitor, or nested fan-out was justified for a bounded read-only task.
- Prompt `21` kept routine planning and implementation on `planner` / `worker` with `gpt-5.6-sol medium`, selected `worker_luna` with `gpt-5.6-luna xhigh` only for the explicitly eligible exact packet, and kept generic adversarial review on `reviewer` with `gpt-5.6-sol high`.
- No final eval found a blocking role, eligibility, delegation, cost-routing, or verification defect.

## Regression Vs Previous Baseline

- baseline: `2026-07-09-gpt-5p6-role-migration`
- routing result: `pass -> pass`
- worker role: `worker_terra` / `gpt-5.6-terra medium` -> `worker_luna` / `gpt-5.6-luna xhigh`
- delegation discipline and ordinary Sol routing remained stable.

## Durable Lessons Absorbed

- Sol remains the default for ordinary implementation and quality-critical planning/review.
- Luna xhigh is the cost-sensitive worker option only when eligibility, scope, verification, and stop/escalation rules are explicit.
- Luna high owns official-doc research; Luna xhigh owns the Spark explorer fallback; Luna low remains the monitor fallback.
- `max` remains an exceptional direct override rather than a tracked role default.

## Workflow / Docs / Skills Changed In Response

- The active model-selection, bounded-worker, workflow, launcher, role-config, verifier, and eval guidance was migrated from Terra to Luna.
- Prompt `21` was corrected after the first fresh run found its stale `worker_terra` packet.

## Intentionally Local-Only Artifacts

- Raw eval task transcripts remain session-only.
- Unrelated tracked and untracked workspace changes remain outside this migration commit.

## Next Follow-Up

- Re-run prompts `13`, `19`, and `21` when orchestration, delegation roles, or model/cost-routing policy changes materially.
