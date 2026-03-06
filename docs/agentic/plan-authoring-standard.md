# Plan Authoring Standard

This standard applies to serious implementation plans in Lineup.

It is derived from:

- the repo workflow in [`agents.md`](../../agents.md)
- the Codanna workflow in [`docs/agentic/codanna-playbook.md`](./codanna-playbook.md)
- the strongest historical plan patterns captured in [`docs/agentic/historical-plan-corpus-review.md`](./historical-plan-corpus-review.md)

## When This Applies

Use this standard for:

- architecture-affecting work
- multi-session implementation work
- high-risk changes touching shared/public symbols
- tracked plans that are meant to survive fresh-session handoff

Do not use it for:

- tiny one-file edits that do not need durable task memory
- local-only run logs
- scratch notes

## Required Structure

Every serious tracked implementation plan must include:

1. Goal
2. Non-goals
3. Parent-priority or parent-architecture alignment
4. Required reading
5. Required skills
6. Codanna discovery
7. Impact snapshot
8. Files in scope
9. Files out of scope
10. Invariants or preservation contracts when relevant
11. Verification commands
12. Rollback notes for high-risk work
13. Commit checkpoints for tracked work

Use section titles that make those requirements obvious to a fresh session. Do not rely on implied structure or house style memory.

## Fresh-Session Rules

- Assume the implementing session starts with no task memory beyond tracked docs.
- Include the minimum reading order needed to execute safely.
- Add an explicit freshness gate:
  - if referenced files, ownership, or doc surfaces changed materially since the plan was written, update the plan first
- Do not continue through contradicted assumptions because the “intent is obvious.”

## Discovery And Evidence Rules

- Start with Codanna where practical:
  - `semantic_search_with_context` for code and docs
  - `search_documents` when repo-doc context matters
  - `analyze_impact` before risky/shared edits
- Summarize the findings that justify the plan shape.
- Record the fallback when Codanna is unavailable or insufficient and `rg`/direct reads were used instead.
- Prefer symbol, ownership, and behavior descriptions over hand-wavy references to “that area” or “the relevant files.”

## Invariants And Scope Rules

- Name exact files in scope.
- Name exact files out of scope.
- State which parent architecture boundary the task is advancing.
- Add explicit anti-slop constraints when risk exists:
  - no fallback or compatibility paths unless explicitly approved
  - no temporary adapters that the next work unit must immediately replace
  - no unrelated side quests
- For UI/runtime refactors, add preservation contracts when they matter:
  - focus behavior
  - timer/listener cleanup
  - ARIA semantics
  - append order
  - startup/shutdown ordering

## Verification And Rollback Rules

- List exact verification commands.
- State the expected result for each command.
- Match the verification depth to risk:
  - `npm run verify` for UI/navigation/Orchestrator/Plex work
  - `npm run verify:docs` for control-plane and docs work
  - at least `npm run typecheck` plus `npm test` for logic-only TypeScript changes unless the task needs broader coverage
- Add rollback notes for high-risk work so a fresh session can unwind safely if parity breaks.

## Anti-Patterns To Avoid

- stale repo names or stale workflow names
- absolute local filesystem paths in tracked plan body text when relative tracked references are enough
- brittle line-number anchoring without a freshness guard
- vague scope such as “touch whatever is needed”
- plans that omit verification expectations
- plans that commit local-only artifacts
- plans that require raw local-only source material when a tracked curated reference should exist instead
