# Eval Baseline Summary

## Date

- `2026-07-10`

## Operator / Agent Surface

- operator: Codex main session with fresh bounded read-only eval agents
- eval surface: trigger-based closeout evaluation of semantic role-config verification, role trust boundaries, and subagent runtime-identity transparency

## Session Metadata

- fresh-session run: `yes`; prompts `13`, `19`, and `21` ran in separate read-only sessions
- session id / launcher: fresh bounded eval agents; prompt `19` used a second fresh session after the first run soft-failed Codanna ordering
- repo state note: intentional dirty-worktree exception while validating the review remediation; unrelated pre-existing tracked and untracked files were not edited or staged
- ROLE / MODEL / REASONING_EFFORT: configured defaults were read from the mapped TOML files; runtime identity was not mechanically exposed and remains `operator-recorded/unverified`
- task family / tier / risk score: workflow/control-plane standalone remediation; Tier 1 evaluation
- telemetry note: exact reasoning-token, credit, cost, and end-to-end wall-time telemetry was not exposed

## Prompts Run

- `13-risk-tiered-orchestration-and-local-only-absorption`: `pass`
- `19-multi-agent-role-selection-and-delegation-discipline`: `pass` on a fresh Codanna-first rerun; the first run was a procedural `soft-fail` because targeted reads preceded Codanna
- `21-model-role-routing-cost-effectiveness`: `pass`

## Verification Commands / Results

- command: `npm run verify`
- observed result: passed; runtime tests `4111/4112` with one skipped, tools tests `135/135`, contract tests `206/206`, harness tests `113/113`, verifier-contract tests `112/112`, plus typecheck, architecture, maintainability, CSS, bundle, and production build gates
- command: `git diff --check`
- observed result: passed

## Review / Rework Telemetry

- review findings count: `3` control-plane re-review findings after the initial remediation (`2` major trust-boundary gaps and `1` minor portability issue)
- blocking findings count: `2`
- accepted findings count: `3`
- rework rounds: `2` control-plane rounds plus `1` prompt-19 eval rerun
- wall time: not consistently exposed
- observed token / credit / cost data when available: not exposed

## Codanna Fallback Log

- fallback used: `yes` for all three prompts
- prompt `13`: Codanna resolved to the Frame Compare index rather than Lineup; the evaluator recorded the wrong-index snapshot and used focused Lineup reads
- prompt `19` final run: Codanna was the first discovery action; the initial CLI syntax was invalid, the corrected structured searches returned unrelated results below `0.071`, and the index reported `878` files, `13,379` symbols, `251` embeddings, and a `384`/`768` vector-dimension mismatch before deterministic fallback
- prompt `21`: three searches returned irrelevant results with top similarities `0.0774` to `0.1242`, plus vector-dimension and lock-contention warnings; the evaluator used focused `rg` and direct reads
- fallback evidence captured: current workflow, prompt rubric, `.codex/config.toml`, mapped role TOMLs, model-selection and bounded-worker guidance, the centralized role contracts, verifier implementation, tests, and remediation commits

## Fresh-Session Deviations

- The evals used fresh bounded read-only agents rather than standalone interactive launcher sessions.
- Prompt `19` required a second fresh session because its first run consulted Codanna after targeted reads; the Codanna-first rerun passed.
- The shared branch advanced during some evaluations; evaluators confirmed later changes did not invalidate the scored control-plane surface and verification ran against the final committed state.
- No raw transcript or `docs/agentic/evals/baselines/*` artifact was promoted.

## Outcome Summary

- Prompt `13` kept bounded control-plane remediation at Tier 1, preserved task-family-first routing, and kept raw run/eval artifacts local-only while placing durable transparency guidance in existing tracked owner surfaces.
- Prompt `19` confirmed shallow, explicit delegation; closed role catalog and sandbox contracts; explicit fallback roles; controller-owned integration; and waiting only when the next critical-path action depends on a delegated result.
- Prompt `21` kept ordinary planning, implementation, and generic review on `planner`, `worker`, and `reviewer`; selected `worker_luna` only for the exact eligible packet with direct verification and stop conditions.
- Configured TOML defaults, dispatch-time overrides, and runtime identity are now separate facts. TOML values and `CONFIGURED ROLE` markers are not reported as runtime proof.

## Recurring Misses

- Codanna's active index was stale, weak, or pointed at the wrong repository, so every eval needed the documented deterministic fallback.
- Exact runtime model identity and cost telemetry remain unavailable from the evaluated surface.
- The first prompt `19` run demonstrated that a complete fallback log does not repair an out-of-order Codanna-first workflow; the fresh rerun was required.

## Workflow / Docs / Skills Changed In Response

- The workflow and bounded-worker skill now distinguish configured defaults, dispatch overrides, and verified versus operator-recorded runtime identity.
- The verifier now parses TOML semantically, uses a closed role catalog, validates model/effort and sandbox policy, rejects retired or unexpected roles, scans active launchers, and requires regular tracked non-symlink control-plane files.
- Verifier tests now use semantic TOML assertions and portable non-regular-file fixtures.

## Durable Lessons Absorbed

- Parse tracked configuration as configuration rather than text.
- Treat the role catalog and sandbox posture as a closed trust boundary.
- Report configured defaults and dispatch requests as policy inputs, never as verified runtime identity unless the execution surface exposes that identity.
- Keep delegation shallow and use cost-sensitive workers only when eligibility, scope, direct verification, and stop rules are explicit.

## Intentionally Local-Only Artifacts

- Raw eval task transcripts remain session-only.
- Unrelated tracked and untracked workspace artifacts remain outside the review remediation commits.

## Next Follow-Up

- Re-run prompts `13`, `19`, and `21` when workflow tiering, delegation roles, role trust boundaries, runtime-identity reporting, or model/cost routing changes materially.
