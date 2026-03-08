# P6-W1 Channel Serialization Codec Implementation Plan

> Task family: cleanup/refactor (Priority 6: dedicated channel persistence layer)
> Tier: Tier 2 (planner -> implementer -> reviewer)
>
> **Goal:** Extract `StoredChannelData` JSON serialization/deserialization into a dedicated codec/helper so persistence parsing/encoding is reusable and `ChannelPersistenceStore` stays thin.
>
> This plan is intentionally scoped to `P6-W1` only. It should not introduce `ChannelRepository` yet (that is `P6-W2`).

---

## Goal

Introduce a pure codec/helper for `StoredChannelData` that owns:

- JSON parsing and top-level shape validation for reads
- JSON stringifying for writes

Then update `ChannelPersistenceStore` to delegate encode/decode to that codec while preserving existing behavior (including clearing invalid storage payloads).

## Non-Goals

- Do not move normalization/migration logic out of `ChannelManager` yet (`P6-W3`).
- Do not introduce `ChannelRepository` yet (`P6-W2`).
- Do not change stored schema, storage keys, or add versioning fields.
- Do not change UI, scheduling behavior, or channel domain logic.
- Do not add any new raw `localStorage` calls outside the persistence boundary.

## Parent Priority Alignment

Priority 6’s target end-state is a dedicated channel persistence layer where `ChannelManager` is focused on domain behavior, and persistence/parsing/normalization/migration live behind a boundary.

This work unit specifically isolates the lowest-level JSON codec so the next units (`P6-W2` / `P6-W3`) can reuse it without duplicating parsing rules across new owners.

## Required Reading

1. `agents.md`
2. `docs/agentic/document-map.md`
3. `docs/AGENTIC_DEV_WORKFLOW.md`
4. `docs/agentic/codanna-playbook.md`
5. `docs/agentic/plan-authoring-standard.md`
6. `docs/architecture/CURRENT_STATE.md`
7. `ARCHITECTURE_CLEANUP_CHECKLIST.md` (Priority 6, `P6-W1`)
8. `src/modules/scheduler/channel-manager/ChannelPersistenceStore.ts` (live persistence owner behavior baseline)
9. `src/modules/scheduler/channel-manager/types.ts` (`StoredChannelData` live contract baseline)
10. `src/modules/scheduler/channel-manager/__tests__/ChannelPersistenceStore.test.ts` (live test baseline)

Freshness gate:

- Confirm `P6-W1` is still the next unchecked work unit in `ARCHITECTURE_CLEANUP_CHECKLIST.md`. If sequencing changed, stop and re-plan.
- If any of these changed since this plan was written (2026-03-08), stop and update the plan before implementing:
  - `src/modules/scheduler/channel-manager/ChannelPersistenceStore.ts` (owner behavior)
  - `src/modules/scheduler/channel-manager/types.ts` (stored contract shape)
  - `src/modules/scheduler/channel-manager/__tests__/ChannelPersistenceStore.test.ts` (baseline expectations)
  - `docs/architecture/CURRENT_STATE.md` (ownership/boundary truth relevant to persistence)

## Required Skills

Planning session (authoring):

1. `using-superpowers`
2. `brainstorming`
3. `architecture-boundaries`
4. `persistence-boundaries`
5. `writing-plans`

Implementation session:

1. `using-superpowers`
2. `persistence-boundaries`
3. `architecture-boundaries`

## Codanna Discovery

Codanna index snapshot (for the planning session):

- `get_index_info`: semantic search enabled; index updated minutes before planning.

Queries and outcomes:

- `semantic_search_with_context`: queries around “ChannelManager serialization/localStorage” were noisy and did not surface `ChannelPersistenceStore` directly (fallback to symbol lookup + direct reads below).
- `find_symbol`:
  - `ChannelManager` -> `src/modules/scheduler/channel-manager/ChannelManager.ts`
  - `ChannelPersistenceStore` -> `src/modules/scheduler/channel-manager/ChannelPersistenceStore.ts`
  - `StoredChannelData` -> `src/modules/scheduler/channel-manager/types.ts`
- `search_documents` (repo-doc context / sequencing / boundary truth):
  - query: `P6-W1 Extract serialization deserialization codec helper ChannelManager ChannelPersistenceStore`
  - notable hits included:
    - `docs/agentic/codanna-playbook.md`
    - `docs/agentic/evals/prompts/09-channel-persistence-boundary.md`
- Direct reads (fallback for detailed behavior and current truth):
  - `ARCHITECTURE_CLEANUP_CHECKLIST.md` (to confirm `P6-W1` scope/sequence)
  - `docs/architecture/CURRENT_STATE.md` (to confirm current storage owner expectations)
  - `src/modules/scheduler/channel-manager/ChannelPersistenceStore.ts` (live behavior baseline)
  - `src/modules/scheduler/channel-manager/__tests__/ChannelPersistenceStore.test.ts` (live test baseline)
  - `src/modules/scheduler/channel-manager/types.ts` (`StoredChannelData` contract)
- `analyze_impact`:
  - `ChannelPersistenceStore` impact: used by `ChannelManager` (tests also exist but are not captured as symbol relationships).
  - `StoredChannelData` impact: `ChannelManager` persistence methods + `ChannelPersistenceStore.writeStoredChannelData`, plus a couple runtime call sites (`InitializationCoordinator`, `EPGCoordinator`).

## Impact Snapshot

Primary impacted symbols/files for `P6-W1` are confined to the channel-manager persistence boundary:

- `ChannelPersistenceStore` (delegates encode/decode)
- new codec/helper (new owner)
- `ChannelPersistenceStore` test suite (may gain additional coverage)

`ChannelManager` should remain behavior-identical; it should still:

- call `readStoredChannelData()` and handle `null`
- normalize/repair the partial payload after read

## Files In Scope

- Create: `src/modules/scheduler/channel-manager/StoredChannelDataCodec.ts` (name can vary, but keep it inside this module)
- Modify: `src/modules/scheduler/channel-manager/ChannelPersistenceStore.ts`
- Test: `src/modules/scheduler/channel-manager/__tests__/ChannelPersistenceStore.test.ts`
- Test (new): `src/modules/scheduler/channel-manager/__tests__/StoredChannelDataCodec.test.ts`

## Files Out Of Scope

- `src/modules/scheduler/channel-manager/ChannelManager.ts` (no behavior or signature changes in `P6-W1`)
- Any file outside `src/modules/scheduler/channel-manager/`
- Storage helper utilities in `src/utils/storage.ts`

If implementation discovers `ChannelManager` must be edited, stop and revise scope before proceeding.

## Architecture Seam Decision Gate

This work unit must not introduce new module ownership seams.

- If extracting the codec forces new public APIs outside `src/modules/scheduler/channel-manager/`, stop and re-plan.
- If the codec wants to grow into “repository”-like ownership (`P6-W2`), stop and defer that expansion to the correct work unit.

## Invariants / Preservation Contracts

- `ChannelPersistenceStore.readStoredChannelData()` must:
  - return `null` when missing
  - remove empty-string payload and return `null`
  - remove malformed JSON payload and return `null`
  - remove invalid top-level shape and return `null`
  - return the parsed object (as `Partial<StoredChannelData>`) when valid
- `writeStoredChannelData()` must preserve quota/unavailable behavior via `safeLocalStorageSetWithResult`.
- No new raw `localStorage` access.
- Do not expand validation beyond current top-level shape checks in `P6-W1`.

## Implementation Plan (TDD, Small Steps)

### Task 1: Introduce a Stored Channel Data Codec (Pure Helper)

**Files:**

- Create: `src/modules/scheduler/channel-manager/StoredChannelDataCodec.ts`
- Test (new): `src/modules/scheduler/channel-manager/__tests__/StoredChannelDataCodec.test.ts`

**Step 1: Write failing codec tests**

Add tests that cover:

- `decodeStoredChannelData('{bad-json')` returns `null`
- `decodeStoredChannelData(JSON.stringify({ channels: 'bad', channelOrder: [] }))` returns `null`
- `decodeStoredChannelData(JSON.stringify(validPayload))` returns a deep-equal object
- `encodeStoredChannelData(validPayload)` returns a string that round-trips via `decodeStoredChannelData`

**Step 2: Run tests**

Run: `npm test -- src/modules/scheduler/channel-manager/__tests__/StoredChannelDataCodec.test.ts`

Expected: FAIL (codec not implemented).

**Step 3: Implement the minimal codec**

Suggested API (keep pure, no storage side-effects):

```ts
import type { StoredChannelData } from './types';

export function decodeStoredChannelData(raw: string): Partial<StoredChannelData> | null {
  // JSON.parse + minimal top-level shape validation (mirrors old store behavior)
}

export function encodeStoredChannelData(data: StoredChannelData): string {
  return JSON.stringify(data);
}
```

Validation rule should match existing `_isValidStoredShape`:

- top-level is a non-array object
- `channels` is an array
- `channelOrder` is an array

**Step 4: Re-run tests**

Run: `npm test -- src/modules/scheduler/channel-manager/__tests__/StoredChannelDataCodec.test.ts`

Expected: PASS.

**Step 5: Commit checkpoint**

Commit: `git commit -m "refactor(channel-persistence): add StoredChannelData codec"`

### Task 2: Switch ChannelPersistenceStore To Use The Codec

**Files:**

- Modify: `src/modules/scheduler/channel-manager/ChannelPersistenceStore.ts`
- Modify: `src/modules/scheduler/channel-manager/__tests__/ChannelPersistenceStore.test.ts` (only if needed; goal is no behavior change)

**Step 1: Write a characterization test if needed**

If any behavior is ambiguous during refactor, add a small characterization test in `ChannelPersistenceStore.test.ts` first (for example: ensure invalid JSON clears the key).

**Step 2: Refactor store read/write to delegate encode/decode**

- In `readStoredChannelData()`:
  - keep the current `null`/`''` handling and key removal behavior
  - use `decodeStoredChannelData(raw)` instead of inline `JSON.parse` + `_isValidStoredShape`
  - if decode returns `null`, remove the payload and return `null` (preserve behavior)
- In `writeStoredChannelData()`:
  - use `encodeStoredChannelData(data)` instead of inline `JSON.stringify`
- Remove `_isValidStoredShape` (codec becomes the single source of truth for that validation).

**Step 3: Run channel-manager persistence tests**

Run: `npm test -- src/modules/scheduler/channel-manager/__tests__/ChannelPersistenceStore.test.ts`

Expected: PASS.

**Step 4: Run full unit suite (or at least channel-manager tests)**

Run: `npm test -- src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts`

Expected: PASS.

**Step 5: Commit checkpoint**

Commit: `git commit -m "refactor(channel-persistence): move StoredChannelData JSON parsing to codec"`

## Verification Commands

- `npm run typecheck`
  - Expected: exit 0
- `npm test`
  - Expected: exit 0

## Rollback Notes

If persistence behavior regresses:

- Revert the commits that introduce the codec delegation.
- Ensure `ChannelPersistenceStore` continues to:
  - clear invalid payloads
  - treat blocked storage as non-fatal (via safe storage helpers)

## Commit Checkpoints

- After introducing the codec + delegation (with tests green):
  - `git commit -m "refactor(channel-persistence): move StoredChannelData JSON parsing to codec"`

## Planner Self-Check

1. Architecture seam unresolved? No. Codec is internal to the existing persistence owner; no new ownership boundary is introduced.
2. Adjacent contract/type changes out of scope? No. `StoredChannelData` shape and `ChannelPersistenceStore` public API remain unchanged.
3. Declaring out-of-scope files that implementation will rely on? No. `ChannelManager` should not require edits for `P6-W1`.
4. Full evidence trail recorded? Yes, with explicit repo-doc context (`search_documents` + direct reads of checklist/current-state) and explicit code/test/type baselines for preservation behavior.
5. Growing a hotspot? No. Extraction makes `ChannelPersistenceStore` thinner.
6. Fresh session inventing decisions? No. Codec API and validation rules are explicitly specified.
7. Execution-grade? Yes.
