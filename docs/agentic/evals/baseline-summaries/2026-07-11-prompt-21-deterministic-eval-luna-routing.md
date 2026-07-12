# Eval Baseline Summary

**Summary mode:** `compact`

## Date

2026-07-11

## Operator / Agent Surface

Fresh bounded read-only subagent; runtime role/model identity unverified.

## Session Metadata

- fresh-session run: `yes`
- session id / launcher: prompt-21 deterministic-eval routing variant
- repo state note: existing dirty worktree preserved; no files edited

## Prompts Run

- `21-model-role-routing-cost-effectiveness`

## Verification Commands / Results

- command: `npm run verify:docs`
- observed result: passed; 114 harness tests and 117 verifier-contract tests

## Codanna Fallback Log

- fallback used: `yes`
- if yes: Codanna was unavailable; focused `rg` and direct reads covered the runbook, eval policy, model-selection skill, worker-Luna verifier rules, and role assertions

## Outcome Summary

Pass. Deterministic eval execution is eligible for `worker_luna` only when an exact `CURRENT_EXECUTION_PACKET` freezes prompt, files, rubric, output, verification, and stop conditions. Ambiguity, unexpected evidence, cross-boundary coupling, or diagnostic verification failure escalates to Sol. Luna output remains eval evidence and never substitutes for adversarial approval.

## Recurring Misses

- Runtime role/model selection was not exposed by the available subagent interface, so this run validates routing policy rather than actual Luna execution telemetry.

## Workflow / Docs / Skills Changed In Response

- Added deterministic-eval eligibility and evidence-not-approval rules to the runbook and eval protocol.

## Durable Lessons Absorbed

- Cheap execution and strong approval are separate decisions: bounded eval execution may use Luna while risk-matched review remains on Sol reviewer roles.

## Intentionally Local-Only Artifacts

- None.

## Next Follow-Up

- Measure actual Luna cost/quality only when the dispatch surface exposes verified role/model identity.
