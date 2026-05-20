---
name: execution-plan-authoring
description: Use when a Lineup task needs a durable implementation plan or execution brief and the planner must freeze scope, seams, and verification without over-specifying local coding choices.
---

# Execution Plan Authoring

## Overview

Use this skill to write decision-complete Lineup plans.

The target is not "make the implementer decide nothing." The target is "leave no unresolved architecture, scope, ownership, or verification decision that would make implementation invent policy mid-run."

For serious tracked plans, this skill works with `docs/agentic/plan-authoring-standard.md`. The standard owns required sections; this skill owns how detailed the plan should be.

Use repo-local `verification-strategy` before or alongside this skill when the proof surface is still unsettled. The plan should record the chosen verification shape, not discover it halfway through execution.

## Use This Skill For

- Tier 2 or Tier 3 work that needs a serious tracked plan in `docs/plans/`
- Tier 1 or short-lived work that still needs a light execution brief before coding
- Planner sessions where the implementation seam is chosen but the execution surface still needs to be frozen
- Handoffs to weaker or cheaper implementers where the planner must remove important ambiguity without writing the whole patch in prose

## Do Not Use This Skill For

- Tiny one-file work that does not need written planning beyond `update_plan`
- Work with unresolved product or architecture intent
- Cases where the real need is design exploration; use `brainstorming` first when the seam or product shape is not settled
- Plans that try to pre-write full function bodies, helper layouts, or future-task patch text

## Planning Target

Freeze the decisions that are expensive to get wrong:

- task family and routing
- goal and non-goals
- chosen seam and ownership
- exact files in scope and out of scope
- invariants and preservation contracts
- verification strategy
- rollback surface
- replan triggers

Deliberately leave ordinary local coding choices delegated:

- helper naming inside the approved seam
- local extraction shapes that do not change ownership or public contracts
- routine control-flow cleanup
- test helper organization once the verification target is already chosen
- minor implementation style choices

If the plan tries to freeze both lists, it becomes stale pseudo-code instead of a durable execution surface.

## Plan Modes

Choose exactly one:

1. No tracked plan
   - Use `update_plan` only.
   - Best for tiny bounded work.
2. Light execution brief
   - Use when one session is likely enough but a written brief still reduces risk.
   - Include scope, seam, files, invariants, verification, and stop conditions.
3. Serious tracked plan
   - Use when the work needs durable handoff memory, crosses boundaries, spans sessions, or carries enough risk that the tracked plan becomes part of the control plane.
   - Follow the serious-plan standard exactly.

Do not promote routine work into a tracked plan just because the task has multiple steps.

## Verification Strategy

Every execution surface should classify verification explicitly before implementation starts.

Use one of these:

- `new regression/contract test required`
- `existing coverage sufficient`
- `broader integration/manual proof required`
- `no new automated test needed`

Then explain the proof surface:

- exact commands
- expected outcomes
- why this verification depth matches the risk
- the exact existing, integration, manual, static-analysis, or source-audit proof target that makes the classification defensible

Do not default to TDD scaffolding in the tracked plan. Use fail-first TDD only when the work truly needs new behavior protection.

## Snippet Policy

Use snippets only when precision materially reduces risk.

Good snippet use:

- interface or type shapes
- exact before/after behavior examples
- fragile selectors, queries, regexes, or payload shapes
- fixture shapes
- exact command lines

Avoid:

- full function bodies
- pseudo-code for every future task
- boilerplate test scaffolds for low-risk cleanup
- patch text that will go stale before the implementer reaches that step

Default to constraint snippets, not implementation snippets.

## Weak-Implementer Pattern

If the implementer is weak or highly cost-constrained, do not turn the master plan into a full patch recipe.

Instead:

1. freeze the seam, scope, invariants, and verification in the master plan
2. cut one bounded execution unit
3. if needed, prepare a detailed worker packet only for that current unit
4. review the result
5. re-plan if discovery invalidates the packet

The master plan stays durable; only the current unit gets high-detail execution guidance.

When that packet is needed, keep it bounded to the current unit and include:

- exact unit or slice
- files in scope
- files out of scope when ambiguity exists
- constraints and invariants
- verification commands plus expected outcomes
- explicit stop-and-replan conditions

## Stop Conditions

Stop and resolve the issue before freezing the plan when:

- an architecture seam or ownership boundary is still undecided
- adjacent contract or type changes are still implicitly required but out of scope
- the plan would force the implementer to choose verification depth mid-task
- the plan has no explicit stop-and-replan conditions even though discovery or boundary failure would invalidate the unit
- the plan depends on "mechanical wiring" in files that are declared frozen
- the plan is drifting into pseudo-code because the planner is compensating for weak execution with prose

## Output Expectations

For a light execution brief, return:

- scope and chosen seam
- files in scope and out of scope
- invariants to preserve
- verification strategy and commands
- stop conditions or replan triggers

For a serious tracked plan:

- satisfy `docs/agentic/plan-authoring-standard.md`
- make the chosen seam explicit before execution steps
- make the verification strategy explicit
- record explicit stop-and-replan conditions
- ensure the implementer does not need to invent important policy decisions
- avoid pseudo-code master-plan detail unless a narrow contract snippet is justified

## Common Mistakes

- mistaking "decision-complete" for "implementation-complete"
- forcing tracked plans to include full code snippets for future steps
- treating every refactor as fail-first TDD work
- hiding unresolved seams inside "mechanical wiring" language
- using tracked plans as a substitute for weak worker-packet design
