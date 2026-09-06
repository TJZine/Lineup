---
name: plex-integration-boundaries
description: Use when changing Plex auth, discovery, library, stream resolution, subtitle delivery, or playback URL logic in Lineup.
---

# Plex Integration Boundaries

## Overview

Use this skill to keep Plex-facing code as a typed integration boundary instead of letting transport and policy details leak through the app.

The main anti-pattern is mixing URL construction, auth handling, transport policy, subtitle strategy, and debug logic in one workflow.

## Required Reading

Read the relevant sections and affected owners first. Expand to callers, adjacent
contracts, or full documents when material questions remain. Reuse task context.

1. [`docs/api/plex-integration.md`](../../../docs/api/plex-integration.md) for the public Plex contract
2. [`docs/architecture/CURRENT_STATE.md`](../../../docs/architecture/CURRENT_STATE.md) for current ownership truth
3. relevant sections of [`docs/AGENTIC_DEV_WORKFLOW.md`](../../../docs/AGENTIC_DEV_WORKFLOW.md) for verification and handoff rules
4. [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../../ARCHITECTURE_CLEANUP_CHECKLIST.md) only when the task explicitly implements or updates a checklist item

## Relevant Owner Examples

Confirm current file-level ownership in `CURRENT_STATE.md`; these examples identify
the stable Plex layers, not a second authoritative inventory.

- [`src/modules/plex/auth/PlexAuth.ts`](../../../src/modules/plex/auth/PlexAuth.ts)
- [`src/modules/plex/discovery/PlexServerDiscovery.ts`](../../../src/modules/plex/discovery/PlexServerDiscovery.ts)
- [`src/modules/plex/discovery/ServerSelectionStore.ts`](../../../src/modules/plex/discovery/ServerSelectionStore.ts)
- [`src/modules/plex/library/PlexLibrary.ts`](../../../src/modules/plex/library/PlexLibrary.ts)
- [`src/modules/plex/stream/resolver/PlexStreamResolver.ts`](../../../src/modules/plex/stream/resolver/PlexStreamResolver.ts)
- Contract doc: [`docs/api/plex-integration.md`](../../../docs/api/plex-integration.md)

## Boundary Routing

- If the change affects persisted Plex auth or selected server state, consult relevant guidance in `persistence-boundaries`.
- Consult `ui-composition-patterns` when changing rendering, interaction, focus,
  or screen lifecycle; a typed result consumed by UI does not itself require UI context.
- If the change affects composition roots, ownership, or cross-module wiring, consult relevant guidance in `architecture-boundaries`.

## Discovery Pattern

1. Find the owning Plex layer and exact callers with search and direct reads. Use
   Codanna semantic or impact tools when available and useful for an unknown or
   shared API.
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
- Remove a temporary compatibility path when current callers and the authorized
  change establish that it is obsolete; historical priority tracks do not set scope.
- Keep secrets and token-bearing URLs out of logs, errors, and debug surfaces.
- Preserve deterministic selection policy. Connection/auth fallback behavior should stay explicit and testable, not emerge from scattered conditionals in callers.
- Keep debug overrides as policy inputs, not permanent branching structure throughout the call chain.

## Contracts To Preserve When Affected

- Auth/discovery changes preserve existing operation authority and selection
  receipts: acquisition/invalidation order, caller-abort precedence, and guards
  before state, event, storage, and successful-return suffixes, including listener
  re-entry. Use the [auth](../../../docs/api/plex-integration.md#authentication-iplexauth)
  and [discovery](../../../docs/api/plex-integration.md#server-discovery-iplexserverdiscovery)
  contracts rather than adding caller-owned counters.
- Keep plex.tv account/Home credentials separate from selected PMS resource tokens.
  Preserve bounded resource-token refresh/retry and endpoint-specific auth errors;
  never introduce account-token fallback to PMS or token-bearing public server data.
- Subtitle work spans Plex URL/auth/delivery policy and player fetch/conversion/track
  lifecycle. Inspect the affected portions of
  [SubtitleManager](../../../src/modules/player/subtitles/SubtitleManager.ts),
  [subtitleFallbackPipeline](../../../src/modules/player/subtitles/subtitleFallbackPipeline.ts),
  and their tests as well as Plex policy; keep each responsibility in its current layer.
- Preserve secure authenticated subtitle attempts, response/body deadlines and size
  limits, cancellation/currentness through body consumption, and track/blob cleanup.
  The [stream contract](../../../docs/api/plex-integration.md#stream-resolution-iplexstreamresolver)
  defines HLS/burn-in selection and delivery semantics: Lineup's `sidecar` and `embed`
  labels are not proof of PMS native subtitle rendering. Requested burn-in is
  distinct from confirmation by PMS decision evidence.

## Extraction Heuristics

- Extract URL/query construction into the Plex owner that owns the policy, not into UI/runtime callers.
- Extract subtitle and transcode decision logic into focused policy helpers when the resolver starts mixing too many concerns.
- Keep server-selection persistence and transport selection coupled to the discovery/selection owner, not to screens or orchestrators.
- Translate Plex payload shape once near the boundary, then expose app-facing types inward.

## Verification

- Use the [runbook's verification gate](../../../docs/AGENTIC_DEV_WORKFLOW.md#verification)
  for all affected Plex behavior, including auth/discovery. Choose focused Plex and
  player regressions for the changed contract and reuse still-current proof.
- Update [`docs/api/plex-integration.md`](../../../docs/api/plex-integration.md) if the integration contract changes.
- Confirm the diff did not introduce new Plex URL construction, token handling, or query-shaping logic into callers outside Plex modules.

## Common Mistakes

- Encoding Plex URL rules in callers
- Mixing debug behavior into production policy paths
- Letting subtitle fallbacks sprawl into unrelated modules
- Treating stream policy as untestable and pushing regressions to manual QA
- Letting auth/discovery/stream concerns merge back into one hotspot file
- Returning raw Plex payloads deep into unrelated application layers
