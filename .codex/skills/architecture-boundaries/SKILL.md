---
name: architecture-boundaries
description: Use when changing module ownership, composition roots, hotspot classes, cross-module wiring, or any refactor that could expand responsibilities across Lineup's architecture.
---

# Architecture Boundaries

## Overview

Use this skill to keep Lineup's cleanup work moving toward smaller owners, thinner composition roots, and lower cross-module coupling.

The default move is extraction, not accretion.

## Use This Skill For

- Changes touching [`src/App.ts`](/Users/tristan/Software/Lineup/src/App.ts) or [`src/Orchestrator.ts`](/Users/tristan/Software/Lineup/src/Orchestrator.ts)
- Work in current hotspots like [`src/modules/ui/settings/SettingsScreen.ts`](/Users/tristan/Software/Lineup/src/modules/ui/settings/SettingsScreen.ts), [`src/modules/ui/epg/EPGComponent.ts`](/Users/tristan/Software/Lineup/src/modules/ui/epg/EPGComponent.ts), [`src/modules/ui/channel-setup/ChannelSetupScreen.ts`](/Users/tristan/Software/Lineup/src/modules/ui/channel-setup/ChannelSetupScreen.ts), [`src/modules/plex/stream/PlexStreamResolver.ts`](/Users/tristan/Software/Lineup/src/modules/plex/stream/PlexStreamResolver.ts), or [`src/modules/scheduler/channel-manager/ChannelManager.ts`](/Users/tristan/Software/Lineup/src/modules/scheduler/channel-manager/ChannelManager.ts)
- New collaborators, controllers, binders, repositories, or stores
- Any change that moves logic between UI, Plex, scheduler, navigation, persistence, or lifecycle modules

## Core Rules

- Treat [`src/App.ts`](/Users/tristan/Software/Lineup/src/App.ts) and [`src/Orchestrator.ts`](/Users/tristan/Software/Lineup/src/Orchestrator.ts) as composition roots. They should wire modules, delegate workflows, and own top-level lifecycle only.
- Do not add feature logic, storage parsing, DOM assembly, or long async workflow policy back into the composition roots.
- One workflow, one owner. If a method coordinates a distinct flow, prefer a focused collaborator with an explicit API.
- Keep cross-module knowledge narrow. UI should not know Plex transport details. Plex code should not know DOM or focus behavior. Persistence code should not live inside screens or controllers.
- Favor public seams over private probing. If tests need internals, extract a real collaborator instead of adding test-only access.
- Hold the line on DRY and YAGNI. Reuse existing module owners and primitives before creating another near-duplicate helper.
- Do not add fallback or compatibility branches unless explicitly required by the maintainer. Pre-MVP policy is single-path by default.

## Working Pattern

1. Run an evidence sweep before editing shared code.
2. Identify the narrowest responsibility that can move out.
3. Add or tighten behavior tests around that responsibility.
4. Extract one durable collaborator with clear ownership.
5. Verify the hotspot did not gain new long-term responsibility.

## Required Checks

- Re-read [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](/Users/tristan/Software/Lineup/ARCHITECTURE_CLEANUP_CHECKLIST.md) before architecture-affecting work.
- If a `P#-W#` item is completed, update the checklist in the same delivery pass.
- Refresh [`docs/architecture/README.md`](/Users/tristan/Software/Lineup/docs/architecture/README.md) or [`docs/architecture/modules.md`](/Users/tristan/Software/Lineup/docs/architecture/modules.md) when public ownership changes.

## Common Mistakes

- Adding "just one more helper" to a hotspot file instead of extracting a real owner
- Letting UI modules parse raw storage or Plex payloads
- Moving logic without first tightening tests around the behavior
- Creating temporary adapters that the next cleanup step must immediately replace
