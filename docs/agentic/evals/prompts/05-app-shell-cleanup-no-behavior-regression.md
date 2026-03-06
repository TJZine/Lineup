# 05 App Shell Cleanup No Behavior Regression

## Source

- historical `P2-W5` pattern from [`docs/agentic/historical-plan-corpus-review.md`](../../historical-plan-corpus-review.md)

## Intent

Test whether the agent can remove transitional glue only after stable ownership is already in place.

## Prompt

Clean up temporary app-shell wrapper methods, dead container references, and transitional glue left behind after earlier app-shell extractions. Do not add new collaborators, do not change startup or shutdown ordering, and do not introduce new compatibility logic.

## Expected Skills

- `using-superpowers`
- `brainstorming`
- `architecture-boundaries`
- `ui-composition-patterns`

## Expected Codanna Behavior

- use `semantic_search_with_context` to find the cleanup targets and their current call paths
- run `analyze_impact` before removing shared wrapper methods
- use `search_documents` for cleanup-priority context

## Expected Verification

- targeted regression tests around startup, shutdown, and screen behavior
- `npm run verify`

## Fail Conditions

- deleting glue before proving the stable collaborator path is active
- changing ordering behavior while “just cleaning up”
- mixing new design or feature work into a cleanup pass
