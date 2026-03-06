---
name: plex-integration-boundaries
description: Use when changing Plex auth, discovery, library, stream resolution, subtitle delivery, or playback URL logic in Lineup.
---

# Plex Integration Boundaries

## Overview

Use this skill to keep Plex-facing code as a typed integration boundary instead of letting transport and policy details leak through the app.

The main anti-pattern is mixing URL construction, auth handling, transport policy, subtitle strategy, and debug logic in one workflow.

## Relevant Modules

- [`src/modules/plex/auth/PlexAuth.ts`](../../../src/modules/plex/auth/PlexAuth.ts)
- [`src/modules/plex/discovery/PlexServerDiscovery.ts`](../../../src/modules/plex/discovery/PlexServerDiscovery.ts)
- [`src/modules/plex/discovery/ServerSelectionStore.ts`](../../../src/modules/plex/discovery/ServerSelectionStore.ts)
- [`src/modules/plex/library/PlexLibrary.ts`](../../../src/modules/plex/library/PlexLibrary.ts)
- [`src/modules/plex/stream/PlexStreamResolver.ts`](../../../src/modules/plex/stream/PlexStreamResolver.ts)
- Contract doc: [`docs/api/plex-integration.md`](../../../docs/api/plex-integration.md)

## Core Rules

- UI, navigation, and orchestration code should ask Plex modules for outcomes, not build Plex URLs or query parameters themselves.
- Keep policy layers separable: auth, request helpers, direct-play decisions, transcode decisions, subtitle delivery, and debug overrides should remain independently testable.
- Preserve the zero-transcode bias unless a product requirement explicitly needs a fallback.
- Map Plex-specific payloads into app-facing types before they spread into unrelated modules.
- Avoid slipping new transport or subtitle branches into `AppOrchestrator` when the real fix belongs in Plex policy code.
- When a branch exists only to survive temporary cleanup, remove it in the same priority track instead of normalizing it as a permanent abstraction.

## Verification

- Run focused Plex tests for the touched module.
- Run `npm run verify` for changes that affect playback wiring, UI behavior, subtitles, or Orchestrator integration.
- Update [`docs/api/plex-integration.md`](../../../docs/api/plex-integration.md) if the integration contract changes.

## Common Mistakes

- Encoding Plex URL rules in callers
- Mixing debug behavior into production policy paths
- Letting subtitle fallbacks sprawl into unrelated modules
- Treating stream policy as untestable and pushing regressions to manual QA
