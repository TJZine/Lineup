---
name: architecture-boundaries
description: Use when changing module ownership, composition roots, hotspot classes, cross-module wiring, or any refactor that could expand responsibilities across Lineup's architecture.
---

# Architecture Boundaries

## Overview

Use this skill to keep Lineup moving toward smaller owners, thinner composition roots, lower cross-module coupling, and explicit runtime ownership.

The default move is extraction, not accretion.

## Use This Skill For

- Changes touching [`src/App.ts`](../../../src/App.ts) or [`src/Orchestrator.ts`](../../../src/Orchestrator.ts)
- Work in current hotspots like [`src/modules/ui/settings/SettingsScreen.ts`](../../../src/modules/ui/settings/SettingsScreen.ts), [`src/modules/ui/epg/component/EPGComponent.ts`](../../../src/modules/ui/epg/component/EPGComponent.ts), [`src/modules/ui/channel-setup/ChannelSetupScreen.ts`](../../../src/modules/ui/channel-setup/ChannelSetupScreen.ts), [`src/modules/plex/stream/resolver/PlexStreamResolver.ts`](../../../src/modules/plex/stream/resolver/PlexStreamResolver.ts), or [`src/modules/scheduler/channel-manager/ChannelManager.ts`](../../../src/modules/scheduler/channel-manager/ChannelManager.ts)
- New collaborators, controllers, binders, repositories, or stores
- Any change that moves logic between UI, Plex, scheduler, navigation, persistence, or lifecycle modules
- Refactors that change ownership, public seams, startup wiring, or lifecycle cleanup behavior

## Core Rules

- Treat [`src/App.ts`](../../../src/App.ts) and [`src/Orchestrator.ts`](../../../src/Orchestrator.ts) as composition roots. They should wire modules, delegate workflows, and own top-level lifecycle only.
- Do not add feature logic, storage parsing, DOM assembly, or long async workflow policy back into the composition roots.
- One workflow, one owner. If a method coordinates a distinct flow, prefer a focused collaborator with an explicit API.
- Keep cross-module knowledge narrow. UI should not know Plex transport details. Plex code should not know DOM or focus behavior. Persistence code should not live inside screens or controllers.
- Keep dependency direction honest. Shared owners may serve callers across modules, but do not make lower-level owners depend back on UI/runtime callers just to avoid moving code.
- Favor public seams over private probing. If tests need internals, extract a real collaborator instead of adding test-only access.
- Prefer typed stores, coordinators, binders, and policy owners over utility dumping grounds.
- Preserve runtime invariants while refactoring: startup order, listener/timer cleanup, focus behavior, append order, storage ownership, and playback/navigation lifecycle contracts must remain explicit.
- Keep adjacent contracts explicit. If a refactor needs another file's public contract to change, either bring that file into scope or freeze the seam and pick a smaller extraction.
- Hold the line on DRY and YAGNI. Reuse existing module owners and primitives before creating another near-duplicate helper.
- Do not add fallback or compatibility branches unless explicitly required by the maintainer. Pre-MVP policy is single-path by default.
- Do not hide an unresolved boundary decision inside "mechanical wiring." If ownership is unclear, resolve the seam before coding.

## Required Reading

1. [`docs/architecture/CURRENT_STATE.md`](../../../docs/architecture/CURRENT_STATE.md) for current ownership truth
2. relevant sections of [`docs/AGENTIC_DEV_WORKFLOW.md`](../../../docs/AGENTIC_DEV_WORKFLOW.md) for verification and handoff rules
3. [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../../ARCHITECTURE_CLEANUP_CHECKLIST.md) only when the task explicitly implements or updates a checklist item
4. the relevant architecture/module reference doc when changing public ownership

## Boundary Routing

- If the change touches storage-backed state, also load `persistence-boundaries`.
- If the change touches Plex auth/discovery/library/stream policy, also load `plex-integration-boundaries`.
- If the change touches screens, overlays, focus, motion, or TV-visible composition, also load `ui-composition-patterns`.
- Load `typescript-quality-boundaries` for production TypeScript and
  `typescript-test-design` when tests or fixtures change.
- When more than one boundary applies, make the ownership split explicit; determine
  risk from blast radius, novelty, contracts, and proof difficulty rather than skill count.

## Discovery Pattern

1. Find the current owner with exact search and direct reads. Use Codanna semantic or
   impact tools when available and materially useful for an unknown or shared seam;
   do not delay work merely to prove a preferred discovery tool was attempted.
2. Identify the narrowest responsibility that can move out without inventing new coupling.
3. Define the target owner before editing.
   - who owns the workflow
   - which module it belongs to
   - what its public API is
   - what lifecycle or persistence contract it preserves
4. Identify the existing behavior proof and add or tighten a test when the seam is
   under-protected or a regression needs durable coverage.
5. Extract one durable collaborator with clear ownership.
6. Cross-check the diff against the intended owner map before moving on.

## Extraction Heuristics

- Extract policy from wiring.
- Extract persistence from screens/controllers into typed stores or repositories.
- Extract async workflow coordination into a focused coordinator/controller instead of leaving it inline in hotspots.
- Extract cross-module translation at the boundary owner instead of leaking raw payloads through the call chain.
- Prefer one durable collaborator over multiple tiny helpers with no ownership story.
- A new file should answer: why does this owner exist, what contract does it own, and why is this module the right home?

## Required Checks

- Re-read [`docs/architecture/CURRENT_STATE.md`](../../../docs/architecture/CURRENT_STATE.md) and confirm the target ownership still matches present-day truth.
- When the task is checklist-linked, re-read the exact checklist item and update its
  status in the same delivery pass.
- Refresh [`docs/architecture/README.md`](../../../docs/architecture/README.md) or [`docs/architecture/modules.md`](../../../docs/architecture/modules.md) when public ownership changes.
- For risky/shared-symbol edits, record the impacted public callers and owners from
  the best available source or language tool.
- Run the repo-appropriate verification depth:
  - `npm run verify` for UI, navigation, Orchestrator, or Plex work
  - at least `npm run typecheck` plus `npm test` for logic-only TypeScript refactors unless broader coverage is required
- Before concluding, confirm the hotspot did not gain new long-term responsibility and the actual diff matches the intended owner boundaries.

## Common Mistakes

- Adding "just one more helper" to a hotspot file instead of extracting a real owner
- Letting UI modules parse raw storage or Plex payloads
- Letting composition roots regrow feature workflow logic because extraction feels slower
- Creating a new owner with no clear lifecycle or module boundary
- Moving code across a seam without updating current ownership docs, or the exact
  checklist item when the task is checklist-linked
- Solving a boundary problem with a temporary adapter that becomes permanent coupling
- Moving logic without first tightening tests around the behavior
- Treating detector silence or passing tests alone as proof that the architecture improved
