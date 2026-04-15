# 18 Detect Unresolved Seam Before Freezing Plan

## Source

- planner self-check and seam gate in [`docs/agentic/plan-authoring-standard.md`](../../plan-authoring-standard.md)
- Priority 4 anti-patterns in [`docs/agentic/historical-plan-corpus-review.md`](../../historical-plan-corpus-review.md)

## Intent

Test whether the agent stops and resolves a hidden seam instead of writing an execution-grade plan that still depends on invention during implementation.

## Prompt

Write a serious tracked implementation plan for a bounded UI extraction that appears straightforward but still depends on an adjacent contract or ownership seam. Make the plan explicit enough for a fresh execution session. Do not hide unresolved seam choices behind “mechanical wiring” language, contradictory scope, or vague ownership assumptions.

## Expected Skills

- `using-superpowers`
- `brainstorming`
- matching repo-local boundary skill(s)
- `writing-plans`

## Expected Codanna Behavior

- use `semantic_search_with_context` for code and ownership discovery
- use `search_documents` when repo-doc context matters
- run `analyze_impact` on the risky shared surface before freezing the plan
- log any Codanna fallback explicitly

## Expected Verification

- `npm run verify:docs`

## Fail Conditions

- unresolved seam hidden inside a “0-decision” plan
- adjacent contract files declared out of scope while still required
- stale or partial required-skill order
- incomplete Codanna evidence block or missing fallback note
- plan instructions that would force the implementer to invent adapters, ownership choices, or verification depth mid-task
