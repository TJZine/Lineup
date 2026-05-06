# Eval Baseline Summary

## Date

2026-05-06

## Operator / Agent Surface

Codex implementation session applying an approved suggestion-review cleanup/control-plane slice for prompt `13-risk-tiered-orchestration-and-local-only-absorption`.

## Session Metadata

- fresh-session run: `no`
- session id / launcher: approved `suggestion-review` implementation slice in the main Lineup workspace
- repo state note (clean branch/worktree or exception): pre-existing unrelated dirty files were present outside this scope, including `ARCHITECTURE_CLEANUP_CHECKLIST.md`, archived/current plan drafts, `scorecard.png`, and one untracked prompt-13 baseline summary; this pass did not modify those files

## Prompts Run

- Prompt 13 cleanup planning constraints/vocabulary/control-plane guidance review
  - scenario: align cleanup planner and reviewer launcher vocabulary around `source-disproved`, `no-code`, and literal `split follow-up`, while preserving stop/replan constraints for large cleanup work
  - result: implementation summary only; no fresh manual eval run is claimed in this file

## Codanna Fallback Log

- fallback used: `yes`
- Codanna status: Codanna was available for code symbol discovery through `semantic_search_with_context`; it returned partial scheduler and Plex context but did not cover the workflow prompt wording
- fallback evidence captured: direct reads and `rg` were used for the exact cleanup-plan, cleanup-review, and baseline-summary wording edits

## Fresh-Session Deviations

- This was not a fresh eval session; it was a bounded implementation pass over accepted reviewer findings.
- No raw eval baseline transcript or scorecard is claimed.

## Outcome Summary

The tracked prompt-13 summary now records the cleanup planning constraint update: cleanup plans must not use `source-disproved`, `no-code`, deferred, or `split follow-up` dispositions merely because a cleanup is large. The planner must stop/replan when source evidence, owner boundaries, or verification scope invalidate the approved execution unit.

The cleanup-review vocabulary now defines `source-disproved` and `no-code`, and both cleanup-plan and cleanup-review use literal `split follow-up` wording consistently.

## Recurring Misses

- Cleanup-control prompts can drift when one launcher names a disposition without defining it locally.
- Hyphenating literal disposition vocabulary makes review and planner outputs easier to misalign.

## Workflow / Docs / Skills Changed In Response

- [`docs/agentic/session-prompts/cleanup-plan.md`](../../session-prompts/cleanup-plan.md)
- [`docs/agentic/session-prompts/cleanup-review.md`](../../session-prompts/cleanup-review.md)
- this tracked baseline summary

## Durable Lessons Absorbed

- Prompt 13 cleanup planning guidance must keep large-but-valid cleanup work inside the approved owner boundary instead of allowing size-based `no-code`, `source-disproved`, deferred, or `split follow-up` exits.
- Stop/replan conditions remain the control-plane escape hatch when a required rewrite crosses an unapproved boundary, changes final ownership, or expands the verification envelope.
- Literal vocabulary alignment is part of the prompt contract; reviewers should push back on `split-follow-up` wording where the launcher defines `split follow-up`.
- Expected verification for these workflow/control-plane edits is `npm run verify:docs`;
  it passed in the implementation session after the prompt updates.

## Intentionally Local-Only Artifacts

- Raw eval baselines, scorecards, transcripts, and run bundles remain local-only under `docs/agentic/evals/baselines/` or `docs/runs/` unless a durable lesson is promoted into a tracked summary.
- No local-only eval artifact is promoted by this file beyond the tracked summary itself.

## Next Follow-Up

- none required for prompt `13` unless a later review asks for an independent
  fresh-session raw transcript in addition to this tracked implementation
  summary
