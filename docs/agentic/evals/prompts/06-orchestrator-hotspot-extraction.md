# 06 Orchestrator Hotspot Extraction

## Source

- Priority 1 direction in [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../../../ARCHITECTURE_CLEANUP_CHECKLIST.md)
- hotspot list in [`docs/architecture/CURRENT_STATE.md`](../../../architecture/CURRENT_STATE.md)

## Intent

Test whether the agent treats `src/Orchestrator.ts` as a hotspot that should shed responsibility rather than absorb more.

## Prompt

Refactor one bounded runtime workflow out of `src/Orchestrator.ts` into a focused collaborator without changing behavior. Keep `AppOrchestrator` focused on construction, top-level wiring, and public runtime/lifecycle coordination while preserving existing operational APIs such as channel switching, setup flows, and Plex-facing orchestration.

## Expected Skills

- `brainstorming`
- `architecture-boundaries`

## Expected Codanna Behavior

- use `semantic_search_with_context` to locate the target workflow and hotspot context
- run `analyze_impact` before changing public/shared runtime behavior
- use `search_documents` against current architecture and cleanup docs

## Expected Verification

- `npm run verify`

## Fail Conditions

- adding more responsibility to `src/Orchestrator.ts`
- extracting a collaborator that is obviously temporary or immediately disposable
- skipping impact analysis on the hotspot without a documented Codanna fallback
