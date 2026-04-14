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

## Active Plan Marker

`npm run verify:docs` treats a plan in `docs/plans/` as an active serious plan only when it includes this exact marker before the first `##` section heading:

```md
**Plan Status:** active
```

Use the marker only while the plan is the active durable handoff surface that must satisfy the full serious-plan standard.

If a tracked plan is still referenced by an active backlog item such as [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../ARCHITECTURE_CLEANUP_CHECKLIST.md), keep the marker on that plan until the checklist/reference surface stops treating it as the live execution handoff.

Remove the marker when:

- the plan is no longer the active handoff surface
- the work is effectively implemented and only historical reference remains
- durable lessons have been absorbed into workflow docs, eval summaries, checklist notes, or other tracked surfaces

The marker is the gate signal. Directory placement alone is not enough to make a tracked plan fail serious-plan conformance.

Mechanical enforcement is intentionally narrow:

- `npm run verify:docs` and `npm run plans:check` validate full serious-plan structure for tracked plans that declare `**Plan Status:** active`
- those same checks also fail checklist-linked tracked plans that are still active but forgot to carry the marker
- other tracked plans still rely on the author/maintainer to keep the marker accurate when the file is the live handoff surface

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
Use `npm run plans:check` to validate that active serious plans with `**Plan Status:** active` still satisfy the tracked plan-authoring standard and that checklist-linked tracked plans are marked while active.

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

Do not automatically commit or track plans in this directory.

Only commit or otherwise track a plan when the user explicitly asks to commit, track, or organize it.

The agent may suggest promoting a plan into tracked repo memory, but it must not do that on its own.

If the artifact is only useful for one local execution run, keep it out of `docs/plans/` and use `docs/runs/` instead.

Do not keep `**Plan Status:** active` on plans that have become reference-only noise. Either remove the marker once the plan is no longer the active handoff surface or archive/delete the plan according to the normal rules.

Checklist references may temporarily point at an existing local `docs/plans/*` draft while harness evals, summaries, or follow-up cleanup are still in progress. `npm run verify:docs` warns for those local-untracked plan refs; before the local draft is removed, ask the user whether to promote it into tracked plan memory or update the checklist/reference note to a tracked summary or archived-plan path instead.

## Corpus Review Trigger

You do not need to update the historical corpus review for every finished plan.

Do update [`docs/agentic/historical-plan-corpus-review.md`](../agentic/historical-plan-corpus-review.md) when one of these is true:

- the archived plan is part of a completed cleanup section such as a full `P#` sequence
- the plan demonstrates a notably strong implementation pattern worth standardizing
- the plan exposes a recurring anti-pattern the harness should explicitly avoid

Routine one-off plans do not require a corpus update.
