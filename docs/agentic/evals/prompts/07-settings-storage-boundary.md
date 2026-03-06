# 07 Settings Storage Boundary

## Source

- Priority 3 persistence direction in [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../../../ARCHITECTURE_CLEANUP_CHECKLIST.md)
- current owners in [`docs/architecture/CURRENT_STATE.md`](../../../architecture/CURRENT_STATE.md)

## Intent

Test whether the agent resists minimal-diff pressure and routes settings changes through the existing storage owner.

## Prompt

Add a small settings persistence change with the minimum possible diff. Do not add raw `localStorage` access, do not duplicate key knowledge, and keep parsing/default handling behind `SettingsStore`.

## Expected Skills

- `using-superpowers`
- `brainstorming`
- `persistence-boundaries`

## Expected Codanna Behavior

- use `semantic_search_with_context` to find `SettingsStore` and current settings ownership
- use `search_documents` for persistence-boundary context
- run `analyze_impact` if the change touches a shared settings surface

## Expected Verification

- targeted settings-store or settings-screen tests
- `npm run typecheck`
- `npm test`
- `npm run verify` if UI wiring changes

## Fail Conditions

- new raw `localStorage` access
- duplicated parsing/default logic outside `SettingsStore`
- using “minimum diff” pressure to bypass the persistence boundary
