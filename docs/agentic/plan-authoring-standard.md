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
- Keep the plan decision-complete at the seam/scope/verification level, not pseudo-code-complete.
- A fresh session should not need to invent ownership, boundary, or verification policy, but it may still make ordinary local coding decisions inside the approved seam.
- Record explicit stop-and-replan conditions in `## Architecture Seam Decision Gate` or an adjacent `## Replan Triggers` section when the task has concrete boundary, discovery, or verification conditions that would invalidate the current plan.

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
- `analyze_impact`: result summary or explicit note that it was not required for the current risk level
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
- For non-trivial code changes, add a debt-regression gate when any steady-state
  guardrail from the workflow is implicated. Name the guardrail category, the
  owner that must not grow, the forbidden shortcut, and the verification or
  source audit that will prove the diff did not reintroduce it.
- For cleanup/refactor work, optimize the plan around the correct long-term owner shape and repo-preferred practice, not the smallest patch that can close the named finding. If source audit shows the right shape requires a larger rewrite inside the approved owner boundary, plan that rewrite as the execution unit or wave instead of narrowing the work just to minimize diff size.
- Size alone is not a valid reason to defer, no-code, or split-follow-up cleanup/refactor work. Defer or stop/replan only when the rewrite crosses an unapproved ownership, behavior, persistence, auth, UI, public API, verification, or sequencing boundary, and record the exact boundary plus final owner.
- For UI/runtime refactors, add preservation contracts when they matter:
  - focus behavior
  - timer/listener cleanup
  - ARIA semantics
  - append order
  - startup/shutdown ordering

### Verification And Rollback Rules

- List exact verification commands.
- State the expected result for each command.
- Use repo-local `verification-strategy` to choose the proof mode when the answer is not already obvious; this standard records the resulting plan classification and proof surface, not the whole decision tree.
- Classify the verification strategy for the execution surface explicitly:
  - `new regression/contract test required`
  - `existing coverage sufficient`
  - `broader integration/manual proof required`
  - `no new automated test needed`
- For active serious plans, include one of those exact classification markers verbatim under `## Verification Commands`.
- The plan should explain why that verification depth matches the risk. Do not force fail-first TDD scaffolding into tracked plans when the work does not need new behavior protection.
- When using `existing coverage sufficient`, name the exact existing proof target that makes that claim defensible.
- When using `broader integration/manual proof required` or `no new automated test needed`, name the exact manual, integration, static-analysis, or source-audit proof surface.
- Match the verification depth to risk:
  - `npm run verify` for UI/navigation/Orchestrator/Plex work
  - `npm run verify:docs` for control-plane and docs work
  - at least `npm run typecheck` plus `npm test` for logic-only TypeScript changes unless the task needs broader coverage
- Add rollback notes for high-risk work so a fresh session can unwind safely if parity breaks.

### Current-Unit Execution Packets

When a weaker or cheaper implementer needs more current-unit detail than the master plan should carry, emit a bounded execution packet outside the master-plan core rather than expanding the whole tracked plan into pseudo-code.

The packet should name:

- exact execution unit or slice
- files in scope
- files out of scope when ambiguity exists
- constraints and invariants
- verification commands plus expected outcomes
- explicit stop-and-replan conditions

For feature/design handoffs to cheaper or weaker implementers, the packet may also include:

- `IMPLEMENTER_REASONING_ELIGIBILITY: low | medium | high`
- `WHY`
- `LOW_ELIGIBLE_IF`
- `ESCALATE_TO_MEDIUM_IF`
- `STOP_AND_REPLAN_IF`

These fields freeze decisions, constraints, verification, and escalation rules for the current unit without adding pseudo-code. They are primarily for feature/design handoffs and do not alter cleanup overlay defaults or the `MODEL_SUGGESTION` block shape.

The packet may live in a `NEXT_SESSION_HANDOFF` block or a local run-bundle artifact. It should not replace the serious tracked plan as the durable source of scope, seam, and verification policy.

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
- plans that try to pre-write full implementation details for future steps instead of freezing the seam and execution constraints
- treating tracked plans as mandatory TDD scripts instead of classifying the real verification need
- plans that use tool or detector ids as a substitute for current-source owner
  proof, or that optimize for score movement while leaving the owner shape
  likely to recreate the same debt

Keep the universal anti-pattern list short and always-on. Longer cleanup-era examples belong in optional historical references rather than in the core authoring surface.

## Cleanup Overlay

The cleanup overlay applies only when `**Task family:** cleanup/refactor`.

Cleanup plans must satisfy `Universal Plan Core + Cleanup Overlay`.
Feature/design plans satisfy `Universal Plan Core` only and must not rely on cleanup-overlay-only sections.

### FCP Source-Backed Checklist Override

The final production cleanup program in `ARCHITECTURE_CLEANUP_CHECKLIST.md`
uses source-backed package briefs instead of detector/imported issue ids.

For checklist-linked `FCP-*` plans only:

- package coverage is defined by `source_finding_id` entries from the approved
  audit/package brief, not by Desloppify ids, imported review ids, or companion
  package-map membership
- `source_finding_id` values must match the checklist token, for example
  `FCP-1-SF1` for `FCP-1` and `FCP-EXIT-SF1` for `FCP-EXIT`; detector-shaped
  ids such as `review::...` or `smells::...` are invalid in FCP plans
- use `source_finding_ids` wherever this overlay would otherwise require
  `package_issue_ids` or `exact_issue_ids`
- `coverage_check` must map every approved `source_finding_id` to exactly one
  planned slice or one explicit defer path with one final owner
- `slice_table` must include `source_finding_ids` instead of
  `exact_issue_ids`; the rest of the slice-table ownership, verification,
  dependency, stop-condition, and handoff requirements still apply
- no checklist companion map or detector package map is required for FCP
  membership; if maintainers later create a companion artifact for FCP, it must
  use `source_finding_id` coverage only
- detector, imported-issue, package-map, and Desloppify evidence must not be
  used for FCP intake, membership, proof, or closeout
- priority closeout does not require Desloppify commands, issue-id reruns, or
  package-map reconciliation; the only Desloppify use allowed by default is an
  optional end-of-program external score refresh after `FCP-EXIT`
- `## Priority-Exit Readiness` applies to the final package for an `FCP-*`
  priority and must record source findings, owned residuals, verification, clean
  review, and the rule that `FCP-(n+1)` cannot start until `FCP-n` is completed

The legacy detector-backed rules below continue to apply to legacy non-FCP
checklist-linked work, including older `P#-W#` / `P#-EXIT` work and `S#-W#`
style-cleanup plans. Any future detector-backed cleanup exception must live
outside the FCP override.

### Cleanup-Only Required Content

- declare `**Cleanup subtype:** checklist-linked` or `**Cleanup subtype:** standalone remediation`
- describe imported-issue disposition and detector-vs-source-audit reconciliation when detector-backed cleanup evidence is in scope
- keep `checklist-linked` versus `standalone remediation` explicit throughout the plan
- for `checklist-linked` package work, include a dedicated tracked `## Package Decomposition` section with:
  - `package_id`
  - `checklist_token`
  - `package_issue_ids`
  - `slice_table`
  - `coverage_check`
  - `ready_now_slice`
  - `ready_now_execution_unit`
  - `recommended_slice_order`
  - `parallel_execution_policy`
- for checklist-linked package work, `slice_table` remains the atomic ownership map. `execution_unit` is the execution/review surface.
- for `checklist-linked` package work, `ready_now_execution_unit` is required and must identify either one approved single-slice unit or one approved `wave_id`. `ready_now_slice` remains the first slice inside that unit.
- for `checklist-linked` package work, `execution_waves` are required only when the approved execution unit spans multiple slices or the plan explicitly opts into wave-scoped execution. A wave may contain one slice, but single-slice package plans do not need multi-slice wave scaffolding.
- for `checklist-linked` package work, single-slice package plans may stay lightweight:
  - `ready_now_execution_unit` points to that slice
  - `ready_now_slice` stays the same slice
  - no `execution_waves` or `coverage_ledger` scaffolding is required
- for `checklist-linked` package work, `slice_table` must record at least:
  - `slice_id`
  - `goal`
  - `areas/files`
  - `exact_issue_ids`
  - `verification`
  - `dependencies`
  - `stop_condition`
  - `handoff_condition`
  - either `serial_only` or `parallel_group`
  - `parallel_justification`
- for `checklist-linked` package work, require package-scoped slice ids (for example `P6-W1-S1`) in `slice_table`, `recommended_slice_order`, and `ready_now_slice`
- for `checklist-linked` package work, treat `coverage_check` as a hard implementation-ready gate: every package issue must map to exactly one planned slice or one explicit defer path with one final owner before implementation can begin
- for `checklist-linked` package work, keep the checklist companion map canonical for package issue membership; tracked plans may snapshot `package_issue_ids` for execution coverage but must not become a rival membership authority
- for `checklist-linked` package work, `coverage_ledger` is an execution-only no-drop ledger for existing `package_issue_ids`; it must not redefine package membership, which remains owned by the checklist companion map
- when `execution_waves` are present, require `coverage_ledger` plus per-wave:
  - `wave_id`
  - `slice_ids`
  - `completion_condition`
  - `absorb_now_scope`
  - `replan_triggers`
- for `checklist-linked` package work, decomposition is still mandatory even when the package is small enough to yield exactly one slice
- for `checklist-linked` package work, large-package execution should review coherent retirement batches, not one tiny fix at a time
- for cleanup/refactor work, source-disproved, no-code, deferred, or split-follow-up dispositions require positive current-source proof that the intended owner shape already exists, the finding no longer applies, or an explicit stop/replan boundary blocks the rewrite; do not use these dispositions because the fix would be large
- add `## Priority-Exit Readiness` only when the cleanup plan is intended to close the last legacy non-FCP checklist item in a cleanup priority, is itself `P#-EXIT`, or is the final package for an `FCP-*` priority
- for `standalone remediation`, say explicitly that no checklist update is expected unless the task is intentionally promoted later

### Execution-Unit Absorption Rules

- Absorb now only when newly discovered residue stays within the same approved execution unit goal, same owner, same seam/files, same verification envelope, and same final-owner accounting already approved by the tracked plan.
- Absorbed-now residue must still be recorded in the implementation or review output for that execution unit.
- Replan required when current-source proof shows a new owner, new package membership, changed execution-unit membership, materially wider verification surface, changed final-owner accounting, or a need to widen beyond the approved execution unit.

### Cleanup Closeout Rules

For a final legacy non-FCP detector-backed checklist-linked plan in a cleanup priority, including `P#-W#` and `S#-W#` style-cleanup plans, the verification section must also name the priority-exit evidence that will be rerun before moving on:

- `desloppify status`
- `desloppify show review --status open`
- any `desloppify show <mapped-issue>` calls needed to verify imported-issue retirement
- the strongest task-specific verification already required by the plan
- the exact legacy checklist-exit update and evidence refresh the implementer
  must complete before any next-priority work starts, including the exact
  P#-EXIT checklist update for `P#-W#` work or the matching style-cleanup exit
  gate for `S#-W#` work

For a final `FCP-*` package, the verification section must instead name:

- the source-backed audit rerun or source review that proves each
  `source_finding_id` disposition
- the package-local static/source audits for old and replacement patterns
- targeted tests and the strongest applicable `npm` verification command
- the priority mini-record update and clean closeout review required before any
  `FCP-(n+1)` work starts

### Priority-Exit Readiness

`## Priority-Exit Readiness` is required only for final-slice cleanup closeout work.

When present, the section must explicitly record:

- for legacy detector-backed priorities, every imported review issue mapped to
  the priority, with its exact issue id, and whether this plan retires it,
  defers it, or splits it into a follow-up owner
- for FCP priorities, every approved `source_finding_id` mapped to the priority,
  and whether this plan retires it, defers it, or splits it into a follow-up
  owner; do not include detector/imported issue ids
- for every deferred or split item, the exact current or follow-up owner, the reason it remains open, and the revisit trigger; if one issue spans multiple legacy non-FCP checklist items, nominate one single final owner
- for legacy detector-backed priorities only, if an issue resolves on
  current-code proof while the detector id still carries stale or broader
  wording, say so directly and keep the same final owner for any truly remaining
  residual instead of inventing a new owner transfer
- the expected `P0` security-gate disposition before the next priority begins, including exact issue ids and revisit triggers for anything not cleared
- any residual debt in the priority area that is intentionally left behind, with its new owner

### Cleanup Overlay Anti-Patterns

- plans that claim priority closeout while leaving the final owner of a mapped imported issue implicit
- plans that cite local run-bundle artifacts under `docs/plans/...` instead of their real `docs/runs/...` path
- plans that treat `No open issues matching` as sufficient closeout proof for ownership/coupling findings without a current-code source audit
- plans that map a broad imported issue to a narrow slice without naming the intended final owner and then rely on repeated `P#-EXIT` re-splitting to sort out stale residue later
