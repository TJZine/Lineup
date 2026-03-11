# Archived Plans

This directory holds tracked historical implementation plans that no longer need to live in the active `docs/plans/` workspace.

Archived plans are still valuable because they preserve:

- the implementation approach used for a completed task
- the rationale behind a finished refactor
- durable repo memory for future investigation

Archived plans are not current policy and are not the default handoff surface for active work.

## Section Summary Triage

When archiving a completed priority or section summary (`*section-summary.md`), add a `## Harness Ingestion Triage` block so the repo records whether that completed block should affect the harness.

Required fields:

- `status`: `none` | `deferred` | `pending` | `absorbed`
- `recommended action`: `none` | `historical-corpus` | `targeted-eval` | `workflow-docs` | `harness-update-loop`
- `why`
- `tracked follow-up`
- `local-only holding note`
- `revisit trigger`

Use these rules:

- `none`
  - no harness signal worth carrying forward
  - keep `recommended action`, `tracked follow-up`, `local-only holding note`, and `revisit trigger` set to `none`
- `deferred`
  - there may be future harness signal, but the evidence is not strong enough yet
  - keep `tracked follow-up` as `none`
  - point `local-only holding note` at the placeholder convention `docs/runs/<date>-harness-ingestion-triage/Documentation.md`
  - name the concrete revisit condition in `revisit trigger`
- `pending`
  - a harness follow-up should happen next, but the tracked surface has not absorbed it yet
  - `tracked follow-up` must name the tracked doc(s) or tracked destination(s) that should absorb the lesson
- `absorbed`
  - the lesson already changed a tracked surface
  - `tracked follow-up` must name the tracked doc(s) that absorbed it

Run `npm run harness:ingestion` after archiving or updating section summaries. The report prints only summaries whose triage is still `pending` or `deferred`.

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
3. If the archived artifact is a completed section summary, add the required `Harness Ingestion Triage` block and run `npm run harness:ingestion`.
4. Update tracked references so they point to the archived path.
5. Move the plan with:

```bash
git mv docs/plans/<file>.md docs/archive/plans/<file>.md
```

6. Leave the filename unchanged.

If a future task needs to resume directly from an archived plan, either keep working from the archived file or promote a new active plan in `docs/plans/` that references it explicitly.
