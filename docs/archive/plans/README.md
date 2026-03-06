# Archived Plans

This directory holds tracked historical implementation plans that no longer need to live in the active `docs/plans/` workspace.

Archived plans are still valuable because they preserve:

- the implementation approach used for a completed task
- the rationale behind a finished refactor
- durable repo memory for future investigation

Archived plans are not current policy and are not the default handoff surface for active work.

## What Belongs Here

- completed implementation plans that are no longer active
- superseded plans that are still useful as history
- completed cleanup plans that no longer need to stay in `docs/plans/`

## What Does Not Belong Here

- run logs
- scratch notes
- eval outputs
- current architecture truth
- active backlog/status docs

## How To Archive A Plan

1. Verify the plan is completed, cancelled, or superseded.
2. If the archived plan completes a cleanup section or adds unusually strong signal, update [`docs/agentic/historical-plan-corpus-review.md`](../../agentic/historical-plan-corpus-review.md) in the same pass.
3. Update tracked references so they point to the archived path.
4. Move the plan with:

```bash
git mv docs/plans/<file>.md docs/archive/plans/<file>.md
```

5. Leave the filename unchanged.

If a future task needs to resume directly from an archived plan, either keep working from the archived file or promote a new active plan in `docs/plans/` that references it explicitly.
