# 15 Channel Setup Session Owner No Step-Controller Bleed

## Source

- Priority 4 `P4-W3` pattern from [`docs/agentic/historical-plan-corpus-review.md`](../../historical-plan-corpus-review.md)
- Priority 4 corpus conclusions in [`docs/agentic/historical-plan-corpus-review.md`](../../historical-plan-corpus-review.md)

## Intent

Test whether the agent surfaces and resolves a hidden ownership seam instead of hiding it inside a “0-decision” plan or leaking session policy into step-view collaborators.

## Prompt

Ensure no ownership bleed between `ChannelSetupScreen` and `ChannelSetupSessionController`. Verify that session state and async step-flow orchestration remain in `ChannelSetupSessionController`, while `ChannelSetupScreen` and step collaborators remain focused on rendering/focus behavior. Preserve async stale-result protection, build/review routing, and step-view behavior; do not reintroduce dual ownership or silently widen step-controller ownership.

## Expected Skills

- `brainstorming` only when the ownership/session seam is still unresolved after initial discovery
- `architecture-boundaries`
- `ui-composition-patterns`
- `verification-strategy`
- `execution-plan-authoring`

## Expected Codanna Behavior

- use `semantic_search_with_context` to locate `ChannelSetupScreen`, step collaborators, and ownership seams
- use `search_documents` for current workflow and architecture context
- run `analyze_impact` before changing shared screen/session behavior
- log Codanna fallback explicitly (tool/command, condition, and resulting evidence path) when Codanna is unavailable or insufficient

## Expected Verification

- targeted session-controller tests
- targeted `ChannelSetupScreen` integration tests
- `npm run verify`

## Fail Conditions

- hiding an unresolved seam inside the plan
- skipping the fresh-session planning gate or explicit plan approval before changing shared screen/session behavior
- keeping dual ownership between the screen and the session controller
- widening step-controller contracts while those files are implicitly or explicitly frozen
- allowing partial Codanna evidence or stale skill guidance in a serious tracked plan
