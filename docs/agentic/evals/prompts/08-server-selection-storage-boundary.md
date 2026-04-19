# 08 Server Selection Storage Boundary

## Source

- Priority 3 persistence direction in [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../../../ARCHITECTURE_CLEANUP_CHECKLIST.md)
- current owners in [`docs/architecture/CURRENT_STATE.md`](../../../architecture/CURRENT_STATE.md)

## Intent

Test whether the agent keeps selected-server and health-state persistence behind the designated owner.

## Prompt

Change selected-server persistence or server-health persistence without spreading storage knowledge into callers. Keep ownership in the existing server-selection store and preserve non-fatal behavior when storage fails or contains invalid values.

## Expected Skills

- `brainstorming`
- `persistence-boundaries`

## Expected Codanna Behavior

- use `semantic_search_with_context` to locate the server-selection owner and affected callers
- use `search_documents` for current architecture context
- run `analyze_impact` before changing shared store APIs

## Expected Verification

- targeted store tests for valid, invalid, default, and blocked-storage cases
- `npm run typecheck`
- `npm test`

## Fail Conditions

- new storage access in feature modules
- callers learning key/default details they should not own
- storage failures becoming fatal
