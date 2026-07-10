---
name: bounded-worker-execution
description: Use when an approved Lineup plan contains concrete, disjoint implementation slices that can be delegated to worker agents without making the main session wait on the immediate critical path.
---

# Bounded Worker Execution

## Overview

Use this skill when a plan-approved implementation slice is concrete enough for `worker`, `cleanup_worker`, or explicitly eligible `worker_luna` execution without inventing seams, adapters, ownership, or verification depth.

The controller still owns decomposition, integration, verification, and final judgment.

## Use This Skill For

- Approved plans with clearly separated write scopes
- Mechanical or moderately scoped implementation slices where the contract is already decided
- Approved, bounded, exact, cheap-to-verify execution units that explicitly declare `worker_luna` eligibility
- Parallel worker execution only when each worker owns a disjoint file set
- Cases where the main session can do non-overlapping integration, review prep, or another local slice while the worker runs

## Do Not Use This Skill For

- Work without an approved plan
- Slices with unresolved architecture or ownership seams
- Changes that require the worker to decide verification depth
- Overlapping write scopes or shared-symbol churn that would create merge roulette
- Cases where the very next local step is blocked on the worker result
- Routine single-slice work that is faster and safer to do locally

## Preconditions

All of these must already be true:

1. the task has an approved tracked plan, or an approved Tier 3 run bundle that already serves as the execution surface under the current workflow
2. the slice names exact files in scope
3. the slice has a clear verification target
4. the write scope is disjoint from any other active worker
5. the worker does not need to invent seams mid-task
6. `worker_luna` units also have exact constraints, direct verification, and explicit stop/escalation triggers

If any precondition is false, keep the implementation local or re-plan first.

## Implementer Role Eligibility

- Use `worker` for general approved implementation.
- Use `cleanup_worker` for Tier 3 cleanup-loop implementation passes.
- Use `worker_luna` only when the approved plan or `CURRENT_EXECUTION_PACKET` says `IMPLEMENTER_ROLE_ELIGIBILITY` includes `worker_luna` and the unit is approved, bounded, exact, and cheap to verify.
- `worker_luna` must stop and escalate on ambiguity, plan contradiction, scope expansion, unexpected cross-boundary coupling, or verification failure needing diagnosis.
- Do not use `worker_luna` for unresolved seams, broad cleanup/refactor judgment, architecture decisions, ambiguous debugging, or implementation that must diagnose failing verification.

## Worker Slice Contract

Every delegated slice should specify:

- exact task
- exact files in scope
- exact files out of scope when ambiguity is likely
- constraints
  - no hidden seam invention
  - no unrelated edits
  - no fallback or compatibility branches unless the plan already approved them
- required verification
- expected return format

Do not make the worker infer the slice from a broad plan alone.

## Delegation Record

Before dispatch, locate the selected role in `.codex/config.toml`, read its
exact `config_file` value, and resolve that value beneath `.codex/`. Record the
resolved path in the worker packet and use that same path at closeout when
reporting the role, `model`, and `model_reasoning_effort` read from the TOML.
For example, `worker_luna` resolves to `.codex/agents/worker-luna.toml`.
Never derive a config filename from the role identifier. Treat the worker's
`CONFIGURED ROLE` opening line as a visibility aid, not independent proof of
the model selection.

## Execution Pattern

1. Decide whether delegation is justified at all.
2. Cut one slice with one write owner.
3. Dispatch one eligible implementer role per disjoint slice.
4. Keep doing useful non-overlapping local work instead of waiting reflexively.
5. Review the worker result before integration.
6. Re-run the required verification locally on the integrated result.
7. If the worker surfaces a blocker or seam question, stop and re-plan instead of forcing through.

## Review Routing

- use `reviewer` after worker implementation when the slice is risky, cross-boundary, or likely to hide regressions
- use `parallel-sidecars` for optional read-only review or evidence sidecars around the worker run
- keep final integration and commit decisions in the main session

## Prompt Shape

The worker prompt should read like a narrow execution contract.

Example:

```text
Execute this approved plan slice.

Task:
- extract the documented verification helper into a focused module

Files in scope:
- src/tools/verifyDocs.ts
- src/tools/verifyDocsHelpers.ts

Files out of scope:
- docs/AGENTIC_DEV_WORKFLOW.md

Constraints:
- do not change public behavior
- do not widen scope beyond this extraction
- if the seam is not clean, stop and report the blocker

Verification:
- npm test -- src/__tests__/tools/verifyDocs.test.ts

Return:
- what changed
- verification run and result
- blockers or concerns
```

## Common Mistakes

- Delegating before the plan is execution-grade
- Handing one worker a slice that really spans multiple owners
- Running parallel workers against the same files or shared symbols
- Waiting immediately after dispatch even though local work remains
- Treating worker output as done before local integration and verification
- Letting the worker choose architecture or scope decisions that belong to the planner or reviewer
