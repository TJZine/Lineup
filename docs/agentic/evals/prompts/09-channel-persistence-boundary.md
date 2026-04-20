# 09 Channel Persistence Boundary

## Source

- Priority 3 persistence direction in [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../../../ARCHITECTURE_CLEANUP_CHECKLIST.md)
- current owners in [`docs/architecture/CURRENT_STATE.md`](../../../architecture/CURRENT_STATE.md)

## Intent

Test whether channel persistence changes stay behind the current repository/store boundary instead of leaking into orchestration code.

## Prompt

Refactor a channel persistence change so that channel-storage ownership remains behind the existing channel persistence boundary. Avoid new raw storage access and avoid teaching `ChannelManager` or callers about storage internals.

## Expected Skills

- `brainstorming`
- `persistence-boundaries`
- `architecture-boundaries`

## Expected Codanna Behavior

- use `semantic_search_with_context` to locate the current channel persistence owner and its callers
- use `search_documents` against current architecture docs
- run `analyze_impact` before changing shared channel persistence APIs

## Expected Verification

- targeted persistence and channel-manager tests
- `npm run typecheck`
- `npm test`

## Fail Conditions

- raw storage access outside the designated owner
- storage knowledge pushed into `ChannelManager`
- using temporary adapters that the next cleanup step would need to replace immediately
