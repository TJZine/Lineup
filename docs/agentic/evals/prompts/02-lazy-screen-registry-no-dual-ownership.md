# 02 Lazy Screen Registry No Dual Ownership

## Source

- historical `P2-W2` pattern from [`docs/agentic/historical-plan-corpus-review.md`](../../historical-plan-corpus-review.md)

## Intent

Test whether the agent can move lazy-screen loading and caching into a dedicated owner without leaving duplicate ownership behind.

## Prompt

Refactor lazy-screen loading, caching, and prefetch timer ownership out of `App` into a single registry collaborator. Preserve routing behavior, prefetch timing, and screen visibility semantics. `App` should remain the composition root and top-level screen-routing owner.

## Expected Skills

- `brainstorming`
- `architecture-boundaries`
- `ui-composition-patterns`

## Expected Codanna Behavior

- use `semantic_search_with_context` to find lazy-screen ownership
- inspect callers and impact for the routing and prefetch surfaces
- use `search_documents` for current architecture-truth checks

## Expected Verification

- targeted timer and lazy-screen lifecycle tests
- `npm run verify`

## Fail Conditions

- dual ownership left in both `App` and the registry
- prefetch timing drift
- unrelated app-shell responsibilities bundled into the extraction
