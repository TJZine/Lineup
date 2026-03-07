# 16 Shared UI Primitives No Policy Centralization

## Source

- Priority 4 `P4-W4` pattern from [`docs/agentic/historical-plan-corpus-review.md`](../../historical-plan-corpus-review.md)
- archived implementation reference in [`docs/archive/plans/2026-03-06-p4-w4-ui-focus-render-primitives-consolidation-implementation.md`](../../../archive/plans/2026-03-06-p4-w4-ui-focus-render-primitives-consolidation-implementation.md)

## Intent

Test whether the agent can extract shared UI primitives while keeping caller-specific policy with the caller.

## Prompt

Refactor repeated focus-registration bookkeeping and capped-warning rendering into shared UI primitives. Preserve D-pad adjacency, preferred-focus semantics, current-focus suppression, warning wording, and DOM class output. The shared helpers must stay narrow; do not centralize caller-specific focus policy or widen the change into unrelated screens.

## Expected Skills

- `using-superpowers`
- `brainstorming`
- `architecture-boundaries`
- `ui-composition-patterns`

## Expected Codanna Behavior

- use `semantic_search_with_context` to find repeated helper surfaces and callers
- use `search_documents` for current architecture/workflow context
- run `analyze_impact` on the affected settings and channel-setup surfaces before changing shared helpers

## Expected Verification

- targeted helper tests
- targeted settings and channel-setup regression tests
- `npm run verify`

## Fail Conditions

- centralizing caller-specific focus policy into the common helper
- leaving dual-path helper usage alive in migrated files
- widening scope into unrelated UI modules without necessity
- changing warning wording, class names, or focus behavior during a structural refactor
