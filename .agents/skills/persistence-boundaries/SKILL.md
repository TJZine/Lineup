---
name: persistence-boundaries
description: Use when adding or changing local persistence, storage-backed settings, channel data, selected server state, or any code that reads or writes browser storage in Lineup.
---

# Persistence Boundaries

## Overview

Use this skill to keep storage concerns behind typed owners and out of screens, controllers, and feature logic.

Lineup's rule is simple: one storage namespace, one owner.

## Required Reading

Read the relevant sections and affected owners first. Expand to callers, adjacent
contracts, or full documents when material questions remain. Reuse task context.

1. [`docs/architecture/CURRENT_STATE.md`](../../../docs/architecture/CURRENT_STATE.md) for the current storage owner map
2. [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../../ARCHITECTURE_CLEANUP_CHECKLIST.md) only when the task explicitly implements or updates a checklist item
3. relevant sections of [`docs/AGENTIC_DEV_WORKFLOW.md`](../../../docs/AGENTIC_DEV_WORKFLOW.md) for verification and handoff rules
4. [`src/utils/storage.ts`](../../../src/utils/storage.ts) when changing shared storage helpers or failure handling

## Owner Selection

Use the current storage-owner map in `CURRENT_STATE.md`; do not copy key ownership
into another caller. Settings, sessions, scheduler/channel data, Plex auth/selection,
and lifecycle state have different lifecycles and should remain in their existing
domain owners. Shared storage helpers own mechanics only—not schemas, defaults,
migrations, or product policy.

## Bounded Exceptions

- [`src/modules/ui/epg/utils.ts`](../../../src/modules/ui/epg/utils.ts)
  - UI-layer helper exception for the bounded `lineup_debug_epg_log` cache only
  - not precedent for adding new raw `localStorage` access in UI/helpers
  - `lineup_debug_epg` flag ownership remains in [`src/modules/debug/DebugOverridesStore.ts`](../../../src/modules/debug/DebugOverridesStore.ts)

## Boundary Routing

- If the change is driven by a screen, overlay, or focus flow, consult relevant guidance in `ui-composition-patterns`.
- If the change changes ownership, composition roots, or cross-module wiring, consult relevant guidance in `architecture-boundaries`.
- If the change touches Plex auth, selected server state, or Plex-derived persisted policy, consult relevant guidance in `plex-integration-boundaries`.

## Core Rules

- Do not add raw `localStorage` access outside a dedicated owner/store/repository.
- Do not spread key names, JSON parsing, or defaults across callers.
- Normalize invalid values immediately at the boundary.
- Storage failure must stay non-fatal unless product requirements explicitly say otherwise.
- Feature modules should depend on typed owner APIs, not storage mechanics.
- Migrations and compatibility parsing belong inside the owner, not inside UI or orchestration code.
- Keep key-family ownership centralized. A new persistence field should usually extend the existing owner for that namespace instead of creating a second partial owner.
- Preserve scope boundaries: settings stores own settings, session stores own session state, scheduler stores own channel persistence, and Plex modules own Plex-backed persistence.
- Do not turn helpers into shadow owners. Shared storage utilities may provide mechanics, but they do not decide schemas, defaults, or lifecycle semantics.
- Persist stable domain intent, not UI-transient state, unless the product contract explicitly requires resume behavior.

## Discovery Pattern

1. Find the current owner and all key/API callers with exact search and direct reads.
   Use Codanna impact tools when available and useful for a shared store API.
2. Confirm the current owner in [`docs/architecture/CURRENT_STATE.md`](../../../docs/architecture/CURRENT_STATE.md).
3. Decide whether the change belongs to an existing owner, a focused new owner, or no persistence at all.
4. Keep the public API typed and small. Callers should ask for values and intents, not storage details.

## Ownership Heuristics

- Extend an existing owner when the new field shares the same lifecycle, namespace, and caller domain.
- Create a new owner only when the data has a distinct lifecycle, contract, or module boundary.
- Keep serialization, normalization, versioning, and cleanup inside the owner.
- Keep prefix cleanup and migration logic near the owner that owns that key family.
- If two modules need the same persisted concept, nominate one owner and make the other a consumer.

## Required Tests

Every new or changed storage owner should cover:

- valid stored value
- invalid stored value
- missing/default state
- blocked or failing storage

Follow the existing store test pattern before creating a new one.

## Verification

- Run `npm run typecheck` and `npm test` for storage-only changes.
- Run `npm run verify` when the persistence change also touches UI, Orchestrator, or Plex wiring.
- Before concluding, confirm the diff did not introduce new raw storage access outside a dedicated owner.
- Update [`docs/architecture/README.md`](../../../docs/architecture/README.md) or [`docs/architecture/modules.md`](../../../docs/architecture/modules.md) when persistence ownership changes in a user-visible or cross-module way.

## Common Mistakes

- A screen reading raw JSON because "it's only one key"
- A controller owning both workflow logic and storage defaults
- Copying an existing storage key into another module instead of introducing a boundary
- Treating parse failures as impossible
- Persisting view-local temporary state because it is convenient during implementation
- Splitting one key family across multiple files with no single truth owner
- Letting callers decide migration/default policy instead of the owner
