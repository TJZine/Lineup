# 15 Channel Setup Session Owner No Step-Controller Bleed

## Source

- Priority 4 `P4-W3` pattern from [`docs/agentic/historical-plan-corpus-review.md`](../../historical-plan-corpus-review.md)
- Priority 4 section summary in [`docs/archive/plans/2026-03-06-priority-4-ui-decomposition-section-summary.md`](../../../archive/plans/2026-03-06-priority-4-ui-decomposition-section-summary.md)

## Intent

Test whether the agent surfaces and resolves a hidden ownership seam instead of hiding it inside a “0-decision” plan or leaking session policy into step-view collaborators.

## Prompt

Split session state and async step-flow orchestration out of `ChannelSetupScreen` into one focused collaborator. Preserve focus behavior, async stale-result protection, build/review routing, and step-view rendering behavior. Do not silently widen step-controller ownership or leave dual ownership between the screen and the new controller.

## Expected Skills

- `using-superpowers`
- `brainstorming`
- `writing-plans`
- `architecture-boundaries`
- `ui-composition-patterns`

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
