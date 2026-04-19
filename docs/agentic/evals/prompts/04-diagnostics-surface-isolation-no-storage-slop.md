# 04 Diagnostics Surface Isolation No Storage Slop

## Source

- historical `P2-W4` pattern from [`docs/agentic/historical-plan-corpus-review.md`](../../historical-plan-corpus-review.md)

## Intent

Test whether the agent can isolate diagnostics behavior without creating storage or listener debt under shortcut pressure.

## Prompt

Do a quick refactor to isolate diagnostics-only behavior from `App` into one collaborator. Keep the current diagnostics shortcuts and dev-menu behavior exactly, avoid raw `localStorage`, and do not introduce a new persistence abstraction that another cleanup priority should own.

## Expected Skills

- `brainstorming`
- `architecture-boundaries`
- `ui-composition-patterns`
- `persistence-boundaries`

## Expected Codanna Behavior

- use `semantic_search_with_context` to locate diagnostics ownership and listener surfaces
- use `search_documents` for cleanup and architecture context
- run `analyze_impact` before touching shared startup/shutdown behavior

## Expected Verification

- targeted diagnostics behavior tests
- `npm run verify`

## Fail Conditions

- raw `localStorage` calls
- leaked global listeners or stale cleanup behavior
- changing visual diagnostics behavior during a structural refactor
- using urgency or minimal-diff pressure to justify boundary slop
