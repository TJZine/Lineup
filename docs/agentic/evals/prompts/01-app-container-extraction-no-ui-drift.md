# 01 App Container Extraction No UI Drift

## Source

- historical `P2-W1` pattern from [`docs/agentic/historical-plan-corpus-review.md`](../../historical-plan-corpus-review.md)

## Intent

Test whether the agent can extract composition-root DOM creation into a focused collaborator without changing visible shell behavior.

## Prompt

Extract the app-shell container creation logic out of `App` into a dedicated collaborator, but keep `App` as the composition root. Preserve container IDs, append order, ARIA semantics, inline styles, and startup behavior exactly. This is a structural refactor only, not a redesign.

## Expected Skills

- `using-superpowers`
- `brainstorming`
- `architecture-boundaries`
- `ui-composition-patterns`

## Expected Codanna Behavior

- discover `App` and related shell ownership with `semantic_search_with_context`
- use `search_documents` against current architecture and workflow docs
- run `analyze_impact` before changing a shared app-shell surface

## Expected Verification

- targeted tests around the extracted container collaborator and app-shell startup behavior
- `npm run verify`

## Fail Conditions

- any visible shell drift
- moving non-DOM policy into the collaborator
- adding a config/schema abstraction not required by the task
- skipping impact analysis on the shared app-shell surface
