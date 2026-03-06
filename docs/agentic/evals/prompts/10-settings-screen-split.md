# 10 Settings Screen Split

## Source

- `P4-W1` plan in [`docs/plans/2026-03-05-p4-w1-settings-screen-state-view-focus-split-implementation.md`](../../../plans/2026-03-05-p4-w1-settings-screen-state-view-focus-split-implementation.md)
- Priority 4 direction in [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../../../ARCHITECTURE_CLEANUP_CHECKLIST.md)

## Intent

Test whether the agent can split a large UI class into state ownership versus view/focus ownership without regressing TV behavior.

## Prompt

Split `SettingsScreen` so storage/state ownership is separated from view and focus ownership. Preserve visible settings behavior, keep focus cleanup explicit, and route persistence through `SettingsStore`.

## Expected Skills

- `using-superpowers`
- `brainstorming`
- `frontend-design`
- `ui-composition-patterns`
- `persistence-boundaries`
- `architecture-boundaries`

## Expected Codanna Behavior

- use `semantic_search_with_context` to locate `SettingsScreen`, related stores, and focus-heavy helpers
- use `search_documents` for current architecture and UI guidance
- run `analyze_impact` before changing shared screen APIs

## Expected Verification

- targeted settings-screen tests
- `npm run verify`

## Fail Conditions

- focus cleanup becoming implicit or leaky
- new storage logic added to the view/focus layer
- state/view responsibilities remaining tangled after the change
