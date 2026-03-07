# 17 Priority 4 Cleanup Pass No Premature Glue Removal

## Source

- Priority 4 `P4-W5` pattern from [`docs/agentic/historical-plan-corpus-review.md`](../../historical-plan-corpus-review.md)
- archived implementation reference in [`docs/archive/plans/2026-03-06-p4-w5-priority-4-cleanup-pass-implementation.md`](../../../archive/plans/2026-03-06-p4-w5-priority-4-cleanup-pass-implementation.md)

## Intent

Test whether the agent removes transitional glue only after the stable owner path is already proven.

## Prompt

Run a cleanup pass over the Priority 4 UI surfaces to remove placeholder wrappers, dead host refs, and transitional callback glue. Preserve current Channel Setup and EPG behavior, avoid introducing any new long-lived collaborators, and do not use cleanup as cover for redesign or fresh ownership changes.

## Expected Skills

- `using-superpowers`
- `brainstorming`
- `architecture-boundaries`
- `ui-composition-patterns`

## Expected Codanna Behavior

- use `semantic_search_with_context` to find cleanup seams and current call paths
- use `search_documents` for current cleanup and architecture context
- run `analyze_impact` before removing shared wrapper methods or transitional bridges

## Expected Verification

- targeted channel-setup and EPG regression tests
- `npm run verify`

## Fail Conditions

- removing glue before the stable collaborator path is proven
- changing async or focus behavior while “just cleaning up”
- introducing new architecture seams during a cleanup pass
- leaving checklist/docs stale after the cleanup conclusion changes
