# Plan Authoring Standard

This standard applies to serious implementation plans in Lineup.

It is derived from:

- the repo workflow in [`agents.md`](../../agents.md)
- the Codanna workflow in [`docs/agentic/codanna-playbook.md`](./codanna-playbook.md)

Historical provenance:

- earlier revisions of this standard also incorporated lessons curated in [`docs/agentic/historical-plan-corpus-review.md`](./historical-plan-corpus-review.md)

That corpus remains a useful optional reference for review calibration, eval shaping, and archive-ingestion follow-up, but it is not default required reading for normal plan authoring.

## When This Applies

Use this standard for:

- architecture-affecting work
- multi-session implementation work
- high-risk changes touching shared/public symbols
- tracked plans that are meant to survive fresh-session handoff

When a tracked plan in `docs/plans/` is the current durable handoff surface, mark it explicitly before the first `##` section heading with this exact line:

```md
**Plan Status:** active
```

`npm run verify:docs` uses that marker, not directory placement alone, to decide whether the file must satisfy the full serious-plan structure. If an active backlog surface such as `ARCHITECTURE_CLEANUP_CHECKLIST.md` points at the plan as the live execution handoff, the plan must carry that exact marker while it remains active. Other active tracked plans still rely on the author/maintainer to keep the marker accurate when the file is serving as the live fresh-session handoff.

Do not use it for:

- tiny one-file edits that do not need durable task memory
- local-only run logs
- scratch notes

## Plan Classification

Every serious tracked implementation plan must declare its task family explicitly:

- `**Task family:** feature/design`
- `**Task family:** cleanup/refactor`

When `**Task family:** cleanup/refactor` applies, the plan must also declare the cleanup subtype explicitly:

- `**Cleanup subtype:** checklist-linked`
- `**Cleanup subtype:** standalone remediation`

When `**Task family:** feature/design` applies, the plan must not declare `**Cleanup subtype:**`. Split any cleanup slice into a separate `cleanup/refactor` plan instead of mixing cleanup classification into a feature/design plan.

Mixed work must split the cleanup slice into a separate cleanup plan instead of using one ambiguous mixed-plan overlay trigger.

## Universal Plan Core

Every serious tracked implementation plan must satisfy the universal core.

For new active plans, prefer the exact `##` headings below so the human-facing doc and the validator stay aligned. Older accepted variants may still pass in some cases, but they should not be the default pattern for new active plans.

1. `## Goal`
2. `## Non-Goals`
3. `## Parent Priority Alignment` or `## Parent Architecture Alignment`
4. `## Required Reading`
5. `## Required Skills`
6. `## Codanna Discovery`
7. `## Impact Snapshot`
8. `## Files In Scope`
9. `## Files Out Of Scope`
10. `## Planner Self-Check`
11. `## Architecture Seam Decision Gate`
12. `## Verification Commands`
13. `## Rollback Notes`
14. `## Commit Checkpoints`

When `**Plan Status:** active` appears before the first `##` heading, `npm run verify:docs` and the harness require the plan to satisfy the full serious-plan structure above. In practice, active plans should carry the exact headings listed here instead of relying on implied structure or house-style memory.

### Fresh-Session Rules

- Assume the implementing session starts with no task memory beyond tracked docs.
- Include the minimum reading order needed to execute safely.
- Add an explicit freshness gate:
  - if referenced files, ownership, or doc surfaces changed materially since the plan was written, update the plan first
- Do not continue through contradicted assumptions because the “intent is obvious.”

### Planner Self-Check

Before finalizing any serious tracked plan, explicitly self-check the plan against these questions:

1. Is there any unresolved architecture seam, ownership seam, or collaborator boundary hidden inside the task?
2. Does the plan depend on adjacent files needing contract or type changes that are not in scope?
3. Am I declaring any file out of scope that the implementation will still implicitly rely on?
4. Did I record the full Codanna evidence path plus any explicit fallback reads?
5. Am I assigning the work to the repo-preferred owner, or am I quietly growing a hotspot?
6. Would a fresh session have to invent anything important to finish this safely?
7. Is this truly an execution-grade plan, or do I still need to resolve a design decision first?

If any answer shows a live architectural or scope ambiguity, stop and resolve that ambiguity before treating the plan as decision-point-free.

### Architecture Seam Decision Gate

- Do not force a zero-decision execution plan across an architecture seam that is still undecided.
- If the task depends on changing adjacent contracts, ownership boundaries, or collaborator responsibilities, name the chosen seam explicitly before locking the implementation steps.
- If that seam is not chosen yet, stop and resolve the decision first instead of hiding it inside the task list.
- A “decision-point-free” plan is valid only after the extraction boundary is explicit enough that a fresh session does not have to invent adapters or contract changes mid-task.

### Discovery And Evidence Rules

- Start with Codanna where practical:
  - `semantic_search_with_context` for code and docs
  - `search_documents` when repo-doc context matters
  - `analyze_impact` before risky/shared edits
- Summarize the findings that justify the plan shape.
- Record the fallback when Codanna is unavailable or insufficient and `rg`/direct reads were used instead.
- Prefer symbol, ownership, and behavior descriptions over hand-wavy references to “that area” or “the relevant files.”

For serious tracked plans, the evidence block should be explicit enough that a fresh session can see both the discovery path and the fallback path. Prefer a fixed mini-template such as:

- `semantic_search_with_context`: result summary or explicit fallback note
- `search_documents`: result summary or explicit fallback note when repo-doc context matters
- `analyze_impact`: result summary
- direct tracked-doc reads or `rg`: what was read and why fallback was needed

When a tracked plan is mainly reconciling detector output with checklist/doc closeout state, the evidence bar is higher:

- detector silence is necessary but not sufficient for closure
- add a current-code source audit, ownership proof matrix, or equivalent explicit justification showing why the checklist outcome is true on the code as it exists now
- if detector output and source audit disagree, stop and resolve that contradiction before claiming closeout
- distinguish three things explicitly: the slice-owned rationale that this plan retires, any still-live residual debt, and any stale detector wording that has not yet caught up
- if the slice-owned rationale is gone on current code, do not plan an automatic `split follow-up` just because the same imported issue id may remain open with broader stale evidence; name the one intended final owner for any real residual instead

The goal is not to maximize tool usage for its own sake. The goal is to leave a clear evidence trail that explains why the chosen plan shape is the repo-best-practice choice for this task.

### Invariants And Scope Rules

- Name exact files in scope.
- Name exact files out of scope.
- State which parent architecture boundary the task is advancing.
- If adjacent files may need contract, type, or ownership changes, either:
  - mark them in scope explicitly, or
  - state that they are frozen and explain how the task works without changing them
- Do not allow “mechanical wiring only” for files that are simultaneously declared out of scope. Resolve that boundary in the plan.
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

### Verification And Rollback Rules

- List exact verification commands.
- State the expected result for each command.
- Match the verification depth to risk:
  - `npm run verify` for UI/navigation/Orchestrator/Plex work
  - `npm run verify:docs` for control-plane and docs work
  - at least `npm run typecheck` plus `npm test` for logic-only TypeScript changes unless the task needs broader coverage
- Add rollback notes for high-risk work so a fresh session can unwind safely if parity breaks.

### Anti-Patterns To Avoid

- hiding an unresolved architecture seam behind a “decisionless” plan
- contradictory scope or “mechanical wiring” claims that still depend on adjacent out-of-scope seams
- weak or missing Codanna evidence and fallback logging
- weak verification expectations or missing expected results
- local-only dependency leakage into tracked plan instructions
- stale repo names or stale workflow names
- absolute local filesystem paths in tracked plan body text when relative tracked references are enough
- brittle line-number anchoring without a freshness guard
- vague scope such as “touch whatever is needed”
- plans that commit local-only artifacts
- plans that require raw local-only source material when a tracked curated reference should exist instead

Keep the universal anti-pattern list short and always-on. Longer cleanup-era examples belong in optional historical references rather than in the core authoring surface.

## Cleanup Overlay

The cleanup overlay applies only when `**Task family:** cleanup/refactor`.

Cleanup plans must satisfy `Universal Plan Core + Cleanup Overlay`.
Feature/design plans satisfy `Universal Plan Core` only and must not rely on cleanup-overlay-only sections.

### Cleanup-Only Required Content

- declare `**Cleanup subtype:** checklist-linked` or `**Cleanup subtype:** standalone remediation`
- describe imported-issue disposition and detector-vs-source-audit reconciliation when detector-backed cleanup evidence is in scope
- keep `checklist-linked` versus `standalone remediation` explicit throughout the plan
- add `## Priority-Exit Readiness` only when the cleanup plan is intended to close the last `P#-W#` item in a cleanup priority or is itself `P#-EXIT`
- for `standalone remediation`, say explicitly that no checklist update is expected unless the task is intentionally promoted later

### Cleanup Closeout Rules

For a final `P#-W#` plan in a cleanup priority, the verification section must also name the priority-exit evidence that will be rerun before moving on:

- `desloppify status`
- `desloppify show review --status open`
- any `desloppify show <mapped-issue>` calls needed to verify imported-issue retirement
- the strongest task-specific verification already required by the plan
- the exact `P#-EXIT` checklist update and evidence refresh the implementer must complete before any `P(n+1)` work starts

### Priority-Exit Readiness

`## Priority-Exit Readiness` is required only for final-slice cleanup closeout work.

When present, the section must explicitly record:

- every imported review issue mapped to the priority, with its exact issue id, and whether this plan retires it, defers it, or splits it into a follow-up owner
- for every deferred or split item, the exact current or follow-up owner, the reason it remains open, and the revisit trigger; if one issue spans multiple `P#-W#` items, nominate one single final owner
- for any issue that this plan resolves on current-code proof while the detector id still carries stale or broader wording, say so directly and keep the same final owner for any truly remaining residual instead of inventing a new owner transfer
- the expected `P0` security-gate disposition before the next priority begins, including exact issue ids and revisit triggers for anything not cleared
- any residual debt in the priority area that is intentionally left behind, with its new owner

### Cleanup Overlay Anti-Patterns

- plans that claim priority closeout while leaving the final owner of a mapped imported issue implicit
- plans that cite local run-bundle artifacts under `docs/plans/...` instead of their real `docs/runs/...` path
- plans that treat `No open issues matching` as sufficient closeout proof for ownership/coupling findings without a current-code source audit
- plans that map a broad imported issue to a narrow slice without naming the intended final owner and then rely on repeated `P#-EXIT` re-splitting to sort out stale residue later
