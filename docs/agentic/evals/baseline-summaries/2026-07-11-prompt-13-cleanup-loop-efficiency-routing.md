# Eval Baseline Summary

**Summary mode:** `full telemetry`

## Date

2026-07-11

## Operator / Agent Surface

Codex desktop main session, bounded workflow/control-plane edit.

## Session Metadata

- fresh-session run: `yes`
- session id / launcher: bounded fresh prompt-13 eval subagent
- repo state note: existing unrelated dirty files were preserved; eval inspected only the bounded workflow diff
- ROLE / MODEL / REASONING_EFFORT: primary agent / runtime identity not exposed / high
- task family / tier / risk score: workflow/control-plane / bounded in-session implementation after Tier 3 case-study audit / architecture risk 2
- telemetry note: exact reasoning-token telemetry was not exposed

## Prompts Run

- `13-risk-tiered-orchestration-and-local-only-absorption`

## Verification Commands / Results

- command: `npm run docs:sync`
- observed result: managed harness inventories synchronized
- command: `npm run verify:docs`
- observed result: initial run exposed one stale eval-inventory test expectation; corrected without reopening design review

## Review / Rework Telemetry

- review findings count: 1 mechanical inventory-contract failure
- blocking findings count: 1
- accepted findings count: 1
- rework rounds: 1 mechanical correction
- wall time: observed in the active session, not separately instrumented
- observed token / credit / cost data when available: unavailable

## Codanna Fallback Log

- fallback used: `yes`
- if yes: direct tracked-doc reads, `rg`, and `git show` were used because Codanna tools were not exposed in this session; evidence covered the workflow, launcher, skills, verifier, eval trigger map, RP-02 plan, program plan, and completed commit

## Fresh-Session Deviations

- Runtime role/model identity was not exposed; no Luna identity is claimed.
- Codanna returned weak/noisy results with lock-busy warnings, so exact `rg` and direct authority reads were logged as fallback.

## Outcome Summary

Pass with logged deviations. The fresh session accepted a resolvable authoritative delta base only after reading it, rejected a stale base and required a complete handoff, widened targeted reading only when authority dependencies required it, kept local run artifacts local, and preserved full closeout verification plus task-local safety rules around named contracts.

## Recurring Misses

- The generic prompt does not directly exercise Tier 3 plan-review latency or revision budgets.

## Workflow / Docs / Skills Changed In Response

- Added prompt 24 as the targeted Tier 3 cleanup-loop regression surface.

## Durable Lessons Absorbed

- Use the broad prompt 13 for routing/local-only discipline and a targeted prompt for protocol-specific correctness and efficiency.
- Token reduction is valid only when the authority artifact remains available and the receiving agent does not reconstruct hidden state.

## Intentionally Local-Only Artifacts

- RP-02 execution plan and remediation program run bundle remain under `docs/runs/`.

## Next Follow-Up

- Run prompt 24 whenever cleanup-loop plan-review budgeting or scope-reset policy changes.
