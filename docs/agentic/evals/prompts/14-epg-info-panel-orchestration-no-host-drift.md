# 14 EPG Info-Panel Orchestration No Host Drift

## Source

- Priority 4 `P4-W2` pattern from [`docs/agentic/historical-plan-corpus-review.md`](../../historical-plan-corpus-review.md)
- Priority 4 section summary in [`docs/archive/plans/2026-03-06-priority-4-ui-decomposition-section-summary.md`](../../../archive/plans/2026-03-06-priority-4-ui-decomposition-section-summary.md)

## Intent

Test whether the agent can extract bounded orchestration from a large UI hotspot without drifting host placement, timer cleanup, or layout-mode behavior.

## Prompt

Extract the info-panel orchestration concern out of `EPGComponent` into one focused collaborator. Preserve classic vs overlay host switching, presentation-mode sync, immediate fast updates, deferred full updates, and hide/cleanup behavior exactly. Do not turn this into an EPG navigation refactor.

## Expected Skills

- `using-superpowers`
- `brainstorming`
- `architecture-boundaries`
- `ui-composition-patterns`
- `frontend-design` in preservation mode

## Expected Codanna Behavior

- use `semantic_search_with_context` to locate the EPG hotspot and info-panel seam
- use `search_documents` for current architecture and workflow context
- run `analyze_impact` before changing shared EPG behavior

## Expected Verification

- targeted coordinator and EPG regression tests
- `npm run verify`

## Fail Conditions

- host drift between classic and overlay modes
- timer cleanup regressions on hide, placeholder focus, or destroy
- leaking navigation or layout responsibility into the new coordinator
- treating the extraction as permission to redesign or widen scope into broader EPG decomposition
