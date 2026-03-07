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
- `baseline-summaries/`
  - tracked baseline summaries only
- [`rubric.md`](./rubric.md)
  - tracked scoring rubric
- [`scorecard-template.md`](./scorecard-template.md)
  - tracked template for manual scoring
- [`baseline-summary-template.md`](./baseline-summary-template.md)
  - tracked template for baseline summaries

## How To Run A Manual Eval

1. Start from a clean worktree or clean branch.
2. Use one prompt file as the task input.
3. Start a fresh session for each prompt you score.
4. Record the agent surface used.
5. Record whether the expected skills and Codanna workflow were actually used.
6. Score the run with [`rubric.md`](./rubric.md) and [`scorecard-template.md`](./scorecard-template.md).
7. Write one tracked summary file under [`docs/agentic/evals/baseline-summaries/`](./baseline-summaries/README.md) using [`baseline-summary-template.md`](./baseline-summary-template.md).
8. Keep raw baseline artifacts local-only unless they are intentionally promoted later.

For the first manual baseline, run only these prompts in this order:

1. `01-app-container-extraction-no-ui-drift`
2. `03-overlay-toast-extraction-no-timer-leaks`
3. `04-diagnostics-surface-isolation-no-storage-slop`
4. `07-settings-storage-boundary`
5. `11-plex-subtitle-policy`
6. `12-architecture-doc-refresh`

Do not run all tracked prompts in the first baseline.

Run [`13-risk-tiered-orchestration-and-local-only-absorption`](./prompts/13-risk-tiered-orchestration-and-local-only-absorption.md) whenever the workflow/control-plane changes materially.

Priority 4 prompt additions can be run as a second manual baseline when validating UI-class decomposition and cleanup-pass behavior:

- `14-epg-info-panel-orchestration-no-host-drift`
- `15-channel-setup-session-owner-no-step-controller-bleed`
- `16-shared-ui-primitives-no-policy-centralization`
- `17-priority-4-cleanup-pass-no-premature-glue-removal`
- `18-detect-unresolved-seam-before-freezing-plan`

### Feature/Design Workflow Rollout Meta-Eval (2026-03-06)

When routing or launcher guidance for feature/design work changes, run a targeted meta-eval in a fresh session:

1. Use prompt `13-risk-tiered-orchestration-and-local-only-absorption`.
2. Use a scenario that forces explicit routing among cleanup/refactor vs feature/design vs mixed.
3. Require the agent to choose task family first, then orchestration tier.
4. Verify success criteria focus on tracked docs/workflow behavior only:
   - correct routing choice
   - correct tier choice
   - no local-only artifact promotion mistakes
5. Treat optional global launcher naming or local launcher convenience drift as out of scope for tracked success criteria.
6. Record the result in one tracked file under [`baseline-summaries/`](./baseline-summaries/README.md) and keep raw artifacts local-only.

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
- baseline summary template
- baseline summary files

Local-only by default:

- most baseline outputs under `docs/agentic/evals/baselines/`
- raw run transcripts
- temporary comparison notes

Promote only short durable summaries when recurring failures justify a tracked workflow change.

## Ownership And Cadence

- The operator who runs the baseline owns writing the tracked summary in the same pass.
- During active cleanup, rerun the seed baseline after a material harness/control-plane change and at least once per month.
- If a baseline changes the workflow conclusion, update the relevant tracked doc or skill guidance before closeout.
- For the feature/design workflow rollout, the operator must include date, prompt(s) run, result, main misses, and workflow/docs changed in response in the tracked summary.

Manual baseline protocol:

- use a fresh session per prompt
- start from repo root each time
- do not reuse prompt threads
- store raw result artifacts locally under `docs/agentic/evals/baselines/`
- do not commit raw baseline files
- close out the run by recording:
  - the durable lesson learned
  - which tracked doc absorbed it
  - which raw artifacts remain intentionally local-only
