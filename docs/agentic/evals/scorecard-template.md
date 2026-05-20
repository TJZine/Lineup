# Eval Run Scorecard

## Prompt ID

## Date

## Agent / Surface

- record the surface used, for example Codex CLI or Antigravity
- ROLE:
- MODEL:
- REASONING_EFFORT:
- Surface-recording note: use observed/operator-entered values only; exact reasoning-token telemetry is optional because Codex may not expose it consistently.

## Task Classification

- Task family:
- Tier:
- Risk score:
- Routing/escalation reason:

## Outcome

## Regression Vs Previous Baseline

- Baseline ID:
- Key Metrics Before/After (with deltas):
- Pass/Fail flag:
- Short summary:
- Recommended action items:
- Example: `B-2026-03-01 -> B-2026-03-07 | pass: 5->7 (+2), soft-fail: 2->1 (-1), fail: 1->0 (-1) | Pass | Codanna fallback logging improved; keep verification depth strict`

## Dimension Scores

### Discovery Quality

- Outcome: `pass` | `soft-fail` | `fail`
- Justification:

### Codanna Usage Quality

- Outcome: `pass` | `soft-fail` | `fail`
- Justification:

### Boundary And Skill Selection

- Outcome: `pass` | `soft-fail` | `fail`
- Justification:

### Verification Selection

- Outcome: `pass` | `soft-fail` | `fail`
- Justification:

### Slop Resistance

- Outcome: `pass` | `soft-fail` | `fail`
- Justification:

### Documentation And Update Discipline

- Outcome: `pass` | `soft-fail` | `fail`
- Justification:

## Evidence

- note whether Codanna was consulted
- note whether the expected skills were consulted
- list verification commands and observed results
- list review findings count, blocking findings count, accepted findings count
- list rework rounds
- list wall time
- list observed token, credit, or cost data when available
- note that exact reasoning-token telemetry is optional/observed-only
- list the concrete evidence that supports the outcome

## Failure Notes

## Follow-Up

## Tracked Summary Path

- Use a repo-relative path to the tracked baseline summary markdown file (preferred format).
- Example: `docs/agentic/evals/baseline-summaries/2026-03-07-manual-baseline.md`
- Use `none` only when no tracked summary was intentionally created for this run.
