# Agent Evals

## Purpose

This directory defines the tracked regression surface for judging whether the Lineup agent workflow is still producing the behavior the repo expects.

These evals are intentionally lightweight:

- prompt-driven
- repo-specific
- focused on high-signal failure modes

They are not a replacement for product tests. They are a workflow-quality check.

## Seed Sources

Build and refresh eval prompts from:

1. [`docs/agentic/historical-plan-corpus-review.md`](../historical-plan-corpus-review.md)
2. [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../../ARCHITECTURE_CLEANUP_CHECKLIST.md)
3. [`docs/architecture/CURRENT_STATE.md`](../../architecture/CURRENT_STATE.md)
4. adversarial shortcut-pressure prompts that test whether agents resist slop under urgency

## Directory Layout

- `prompts/`
  - tracked eval prompt definitions
- `baselines/`
  - local-only baseline run outputs by default
- [`rubric.md`](./rubric.md)
  - tracked scoring rubric
- [`scorecard-template.md`](./scorecard-template.md)
  - tracked template for manual scoring

## How To Run A Manual Eval

1. Start from a clean worktree or clean branch.
2. Use one prompt file as the task input.
3. Start a fresh session for each prompt you score.
4. Record the agent surface used.
5. Record whether the expected skills and Codanna workflow were actually used.
6. Score the run with [`rubric.md`](./rubric.md) and [`scorecard-template.md`](./scorecard-template.md).
7. Keep raw baseline artifacts local-only unless they are intentionally promoted later.

For the first manual baseline, run only these prompts in this order:

1. `01-app-container-extraction-no-ui-drift`
2. `03-overlay-toast-extraction-no-timer-leaks`
3. `04-diagnostics-surface-isolation-no-storage-slop`
4. `07-settings-storage-boundary`
5. `11-plex-subtitle-policy`
6. `12-architecture-doc-refresh`

Do not run all 12 prompts in the first baseline.

## Scoring Model

Use the rubric outcomes only:

- `pass`
- `soft-fail`
- `fail`

Score dimensions live in [`rubric.md`](./rubric.md).

## Tracked Vs Local

Tracked:

- prompt definitions
- rubric
- scorecard template

Local-only by default:

- most baseline outputs under `docs/agentic/evals/baselines/`
- raw run transcripts
- temporary comparison notes

Promote only short durable summaries when recurring failures justify a tracked workflow change.

Manual baseline protocol:

- use a fresh session per prompt
- start from repo root each time
- do not reuse prompt threads
- store raw result artifacts locally under `docs/agentic/evals/baselines/`
- do not commit raw baseline files
