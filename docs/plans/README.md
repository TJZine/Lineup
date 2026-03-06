# Active Plans

This directory holds tracked, durable implementation plans that are still useful as active execution memory.

Keep a plan in `docs/plans/` when at least one of these is true:

- the work is still in progress
- the plan is still the active handoff surface for a current task
- the plan is referenced by an active backlog item such as [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../ARCHITECTURE_CLEANUP_CHECKLIST.md)
- the plan is recent enough that fresh sessions are likely to resume from it directly

Do not use `docs/plans/` for:

- scratch notes
- live run logs
- temporary status journals
- eval outputs

Use `docs/runs/` for local-only execution artifacts and `docs/archive/plans/` for older completed plans that should remain tracked as historical memory without crowding the active plan workspace.

## Naming

Use date-first file names:

- `YYYY-MM-DD-<topic>.md`

Keep names specific enough that a fresh session can identify the task without opening multiple files.

## Archive Rules

Archive a tracked plan when all of the following are true:

- the work is completed, cancelled, or superseded
- the plan is no longer the active handoff surface
- the plan is not needed in the main `docs/plans/` directory for current-day execution

Use `npm run plans:stale` as a non-blocking maintenance report to spot older plan files that may be ready for archive review. The report is heuristic only; it does not decide archival status for you.

Before archiving:

1. Confirm the task is complete, cancelled, or superseded.
2. Update any references that still point at `docs/plans/<file>.md`.
3. If the plan completes a cleanup section or is unusually strong, review whether it adds new reusable patterns or anti-patterns to [`docs/agentic/historical-plan-corpus-review.md`](../agentic/historical-plan-corpus-review.md).
4. Move the file to `docs/archive/plans/<file>.md`.
5. Keep the filename unchanged so the history remains searchable.

Use `git mv` for tracked plan moves:

```bash
git mv docs/plans/<file>.md docs/archive/plans/<file>.md
```

## Commit Policy

Commit plans in this directory when they are part of the repo's durable memory, especially for:

- architecture cleanup work
- multi-session refactors
- plans explicitly referenced by tracked backlog or architecture docs

If the artifact is only useful for one local execution run, keep it out of `docs/plans/` and use `docs/runs/` instead.

## Corpus Review Trigger

You do not need to update the historical corpus review for every finished plan.

Do update [`docs/agentic/historical-plan-corpus-review.md`](../agentic/historical-plan-corpus-review.md) when one of these is true:

- the archived plan is part of a completed cleanup section such as a full `P#` sequence
- the plan demonstrates a notably strong implementation pattern worth standardizing
- the plan exposes a recurring anti-pattern the harness should explicitly avoid

Routine one-off plans do not require a corpus update.
