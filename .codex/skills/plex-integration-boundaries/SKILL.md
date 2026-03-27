---
name: plex-integration-boundaries
description: Use when changing Plex auth, discovery, library, stream resolution, subtitle delivery, or playback URL logic in Lineup.
---

# Plex Integration Boundaries

## Overview

Use this skill to keep Plex-facing code as a typed integration boundary instead of letting transport and policy details leak through the app.

The main anti-pattern is mixing URL construction, auth handling, transport policy, subtitle strategy, and debug logic in one workflow.

## Required Reading

1. [`docs/api/plex-integration.md`](../../../docs/api/plex-integration.md) for the public Plex contract
2. [`docs/architecture/CURRENT_STATE.md`](../../../docs/architecture/CURRENT_STATE.md) for current ownership truth
3. [`docs/AGENTIC_DEV_WORKFLOW.md`](../../../docs/AGENTIC_DEV_WORKFLOW.md) for tiering, verification, and handoff rules
4. [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../../ARCHITECTURE_CLEANUP_CHECKLIST.md) when the task is cleanup-linked or hotspot-oriented

## Relevant Modules

- [`src/modules/plex/auth/PlexAuth.ts`](../../../src/modules/plex/auth/PlexAuth.ts)
- [`src/modules/plex/discovery/PlexServerDiscovery.ts`](../../../src/modules/plex/discovery/PlexServerDiscovery.ts)
- [`src/modules/plex/discovery/ServerSelectionStore.ts`](../../../src/modules/plex/discovery/ServerSelectionStore.ts)
- [`src/modules/plex/library/PlexLibrary.ts`](../../../src/modules/plex/library/PlexLibrary.ts)
- [`src/modules/plex/stream/PlexStreamResolver.ts`](../../../src/modules/plex/stream/PlexStreamResolver.ts)
- Contract doc: [`docs/api/plex-integration.md`](../../../docs/api/plex-integration.md)

## Boundary Routing

- If the change affects persisted Plex auth or selected server state, also load `persistence-boundaries`.
- If the change leaks into screens, overlays, focus behavior, or user-visible playback UI, also load `ui-composition-patterns`.
- If the change affects composition roots, ownership, or cross-module wiring, also load `architecture-boundaries`.

## Discovery Pattern

1. Run a Codanna-first evidence sweep before changing shared Plex surfaces.
   - start with `semantic_search_with_context`
   - use `search_documents` when repo-doc context matters
   - run `analyze_impact` before touching shared/public Plex APIs or resolver types
   - fall back to `rg` only when Codanna is insufficient, and note the fallback
2. Confirm which Plex layer owns the change:
   - auth
   - discovery/selection
   - library metadata
   - stream resolution
   - subtitle policy
3. Keep callers outcome-oriented. They should request an auth result, selection result, library data, or stream decision, not reconstruct Plex mechanics.

## Core Rules

- UI, navigation, and orchestration code should ask Plex modules for outcomes, not build Plex URLs or query parameters themselves.
- Keep policy layers separable: auth, request helpers, direct-play decisions, transcode decisions, subtitle delivery, and debug overrides should remain independently testable.
- Preserve the zero-transcode bias unless a product requirement explicitly needs a fallback.
- Map Plex-specific payloads into app-facing types before they spread into unrelated modules.
- Avoid slipping new transport or subtitle branches into `AppOrchestrator` when the real fix belongs in Plex policy code.
- When a branch exists only to survive temporary cleanup, remove it in the same priority track instead of normalizing it as a permanent abstraction.
- Keep secrets and token-bearing URLs out of logs, errors, and debug surfaces.
- Preserve deterministic selection policy. Connection/auth fallback behavior should stay explicit and testable, not emerge from scattered conditionals in callers.
- Keep debug overrides as policy inputs, not permanent branching structure throughout the call chain.

## Extraction Heuristics

- Extract URL/query construction into the Plex owner that owns the policy, not into UI/runtime callers.
- Extract subtitle and transcode decision logic into focused policy helpers when the resolver starts mixing too many concerns.
- Keep server-selection persistence and transport selection coupled to the discovery/selection owner, not to screens or orchestrators.
- Translate Plex payload shape once near the boundary, then expose app-facing types inward.

## Verification

- Run focused Plex tests for the touched module.
- Run `npm run verify` for changes that affect playback wiring, UI behavior, subtitles, or Orchestrator integration.
- Update [`docs/api/plex-integration.md`](../../../docs/api/plex-integration.md) if the integration contract changes.
- Confirm the diff did not introduce new Plex URL construction, token handling, or query-shaping logic into callers outside Plex modules.

## Common Mistakes

- Encoding Plex URL rules in callers
- Mixing debug behavior into production policy paths
- Letting subtitle fallbacks sprawl into unrelated modules
- Treating stream policy as untestable and pushing regressions to manual QA
- Letting auth/discovery/stream concerns merge back into one hotspot file
- Returning raw Plex payloads deep into unrelated application layers
