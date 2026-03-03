# Architecture Cleanup Checklist

This document turns the current architecture review into a working backlog.

The goal is not a rewrite unless absolutely needed for best practices. The goal is to stop making the hotspot files worse, then reduce risk in the highest-value areas first.

Completion rule: every implementation plan that finishes a `P#-W#` work unit must update this checklist in the same delivery pass before the work is considered complete. Do not leave the work unit unchecked after code lands.

## How To Use This

- Treat this as the cleanup queue for architecture and codebase-quality work.
- Work from top to bottom unless a production issue forces a different order.
- For each item, write a focused plan before coding and keep scope narrow.
- The primary trackable unit is each `P#-W#` work unit below.
- The architectural target is the parent Priority section, not an individual `P#-W#` in isolation.
- Select the next task by the lowest unchecked `P#-W#` ID in the highest remaining priority.
- Execute one `P#-W#` at a time, but design it so the code moves toward the ideal end-state of that parent Priority section.
- These work units are intentionally large, near-full-session tasks. Do not split them smaller unless one unit would exceed a safe single session.
- Each completed `P#-W#` must leave behind a production-valid improvement, not a throwaway seam that the next subitem immediately has to replace.
- When a work unit is finished, mark it `[x]` and append a note in this exact format:
  `(done YYYY-MM-DD; plan: docs/plans/<file>.md)`
- Use the new repo skills before architecture-affecting work:
  - `architecture-boundaries`
  - `ui-composition-patterns`
  - `persistence-boundaries`

## Agent Workflow

- Start with the superpowers workflow: `using-superpowers`, then `brainstorming`, then the matching repo-local architecture skill(s).
- Do a repo evidence sweep before planning.
- Produce or refresh a concrete plan using the writing-plans skill under `docs/plans/` for the selected work unit before coding. The plan should have 0 decision points and be explicit enough for a less intelligent agent to implement.
- Keep scope limited to one work unit at a time.
- In every plan, explicitly state how the selected `P#-W#` advances the durable end-state of its parent Priority section.
- Favor durable collaborators/stores/binders that later work units can extend; avoid temporary adapters or one-off abstractions that will need immediate replacement inside the same Priority section.
- Only mark completion after the required verification for that unit actually passes.
- Before closing the work, update the matching `P#-W#` entry in this file to `[x]` and append the required `(done YYYY-MM-DD; plan: docs/plans/<file>.md)` note.

## Evidence Snapshot

The largest structural hotspots found during review were:

- `src/Orchestrator.ts` at 2,713 lines
- `src/App.ts` at 1,434 lines
- `src/modules/ui/epg/EPGComponent.ts` at 1,864 lines
- `src/modules/plex/stream/PlexStreamResolver.ts` at 1,749 lines
- `src/modules/scheduler/channel-manager/ChannelManager.ts` at 1,565 lines
- `src/modules/ui/settings/SettingsScreen.ts` at 1,399 lines
- `src/modules/ui/channel-setup/ChannelSetupScreen.ts` at 1,447 lines
- `src/modules/player/VideoPlayer.ts` at 1,252 lines

Other review signals:

- `src/Orchestrator.ts` has very high responsibility concentration and large closure-based dependency wiring.
- `src/App.ts` mixes bootstrapping, DOM composition, config creation, overlays, toasts, and dev tooling.
- Direct `localStorage` access is still spread across many feature files despite safe storage helpers existing.
- The architecture docs under `docs/architecture/` no longer fully match the current code layout.
- The test suite includes a private-probe ratchet, which is a sign that public seams are weaker than they should be in some hotspots.

## Operating Rules

- Do not rewrite the app around a new framework.
- Keep the webOS performance profile intact.
- Prefer extractions that introduce clearer ownership and smaller public seams.
- Do not move logic unless tests cover the behavior first.
- When in doubt, make the composition roots thinner and feature collaborators clearer.
- Do not optimize a single `P#-W#` in a way that fights the architecture the parent Priority section is trying to reach.
- Temporary delegation is acceptable only when it preserves behavior and clearly converges toward the parent section's intended steady-state design.

## Priority 1: Split AppOrchestrator Into Real Runtime Controllers

- ROI: Highest
- Why it matters: `src/Orchestrator.ts` is the main source of change amplification and cross-cutting risk.
- Target outcomes:
  - Keep `AppOrchestrator` focused on construction, top-level wiring, and public app lifecycle methods.
  - Move feature workflows into explicit collaborators.
  - Reduce private field growth and long workflow methods.
- Candidate extractions:
  - playback session controller
  - overlay/runtime controller
  - live tuning/session state controller
  - recovery/error routing controller
- Likely files:
  - `src/Orchestrator.ts`
  - `src/core/**`
  - new focused controllers under `src/core/` or feature modules
- Guardrails:
  - No behavior changes while extracting.
  - Keep ownership of cleanup and subscriptions explicit.
  - Prefer public seams over tests reaching into private internals.
  - Shape early playback-related extractions as durable steps toward a real playback/runtime boundary, not as isolated controller fragments that will be discarded later in Priority 1.
- Verification:
  - `npm run verify`
- Checklist:
  - [ ] Identify the first workflow to extract
  - [ ] Add or tighten tests around that workflow
  - [ ] Extract one controller with a narrow public API
  - [ ] Reduce `AppOrchestrator` state and private method count
  - [ ] Verify event wiring remains traceable
- Primary work units:
  - [x] P1-W1 - Extract program-start sequencing into a focused playback-start controller (done 2026-03-02; plan: docs/plans/2026-03-02-playback-start-controller-implementation.md)
  - [x] P1-W2 - Move player event handlers into a playback runtime controller while keeping subscriptions in place (done 2026-03-02; plan: docs/plans/2026-03-02-playback-runtime-controller-implementation.md)
  - [x] P1-W3 - Move pause/resume and in-flight playback coordination into the same runtime boundary (done 2026-03-02; plan: docs/plans/2026-03-02-playback-runtime-lifecycle-coordination-implementation.md)
  - [x] P1-W4 - Extract `_setupEventWiring()` and the `_wire*Events()` methods into a dedicated event binder (done 2026-03-02; plan: docs/plans/2026-03-02-orchestrator-event-binder-implementation.md)
  - [x] P1-W5 - Extract remaining overlay/runtime helper policies (badge visibility, modal toggles, profile-switch cleanup) (done 2026-03-03; plan: docs/plans/2026-03-03-p1-w5-overlay-runtime-policy-extraction-implementation.md)
  - [x] P1-W6 - Cleanup pass for Priority 1: remove temporary delegation shims, transitional fields, obsolete helper methods, and no-longer-needed compatibility wiring created during the P1 refactors (done 2026-03-03; plan: docs/plans/2026-03-03-p1-w6-priority-1-cleanup-pass-implementation.md)

## Priority 2: Split App Shell Responsibilities

- ROI: Very high
- Why it matters: `src/App.ts` is absorbing bootstrap concerns plus feature UI concerns and dev-only tooling.
- Target outcomes:
  - Separate DOM container composition from runtime startup.
  - Separate screen loading/visibility from diagnostics surfaces.
  - Keep config assembly and app bootstrap readable.
- Candidate extractions:
  - app container factory
  - screen registry / lazy screen loader
  - app diagnostics or dev menu surface
  - toast/error overlay presenter
- Likely files:
  - `src/App.ts`
  - new helpers under `src/core/` or `src/modules/ui/common/`
- Guardrails:
  - Preserve startup order and screen behavior.
  - Avoid adding new global listeners without clear cleanup ownership.
- Verification:
  - `npm run verify`
- Checklist:
  - [ ] Separate container creation from startup orchestration
  - [ ] Separate diagnostics/dev UI from core app shell
  - [ ] Reduce app shell knowledge of feature-specific UI details
  - [ ] Verify screen visibility and overlay behavior still match current flow
- Primary work units:
  - [x] P2-W1 - Extract app container creation into a dedicated factory/helper (done 2026-03-03; plan: docs/plans/2026-03-03-p2-w1-app-container-factory-implementation.md)
  - [x] P2-W2 - Extract screen loading and lazy-screen caching into a screen registry/loader (done 2026-03-03; plan: docs/plans/2026-03-03-p2-w2-screen-registry-loader-implementation.md)
  - [ ] P2-W3 - Extract toast and blocking error overlay presentation out of `App`
  - [ ] P2-W4 - Isolate the dev menu / diagnostics surface from the runtime app shell
  - [ ] P2-W5 - Cleanup pass for Priority 2: remove temporary pass-through helpers, dead container references, and transitional app-shell glue introduced while splitting `App`

## Priority 3: Introduce Real Persistence Boundaries

- ROI: Very high
- Why it matters: persisted state is currently too distributed, which duplicates parsing and increases webOS-specific failure risk.
- Target outcomes:
  - No new raw `localStorage` calls in feature modules.
  - Storage ownership moves behind stores/repositories.
  - Validation and migration logic becomes centralized.
- Candidate extractions:
  - `SettingsStore`
  - `ChannelRepository`
  - `DebugOverridesStore`
  - focused owners for selected server and server health state
- Likely files:
  - `src/utils/storage.ts`
  - `src/modules/ui/settings/**`
  - `src/modules/scheduler/channel-manager/**`
  - `src/modules/plex/discovery/**`
  - `src/modules/plex/stream/**`
- Guardrails:
  - Use safe storage helpers inside the storage owner.
  - Normalize invalid values immediately.
  - Keep storage failures non-fatal.
- Verification:
  - `npm run typecheck`
  - `npm test`
  - `npm run verify` when UI/Orchestrator/Plex wiring changes
- Checklist:
  - [ ] Pick one storage namespace and assign a single owner
  - [ ] Move parsing and defaults into that owner
  - [ ] Replace direct feature-module storage access with injected boundary
  - [ ] Add tests for valid, invalid, default, and blocked-storage cases
- Primary work units:
  - [ ] P3-W1 - Introduce `SettingsStore` and remove direct settings parsing from `SettingsScreen`
  - [ ] P3-W2 - Extract debug-override storage into a dedicated store
  - [ ] P3-W3 - Add a repository/store for selected server and server health state
  - [ ] P3-W4 - Introduce a dedicated channel persistence boundary and route one caller through it
  - [ ] P3-W5 - Cleanup pass for Priority 3: remove leftover raw storage access, duplicate key knowledge, temporary adapters, and obsolete parsing helpers after the persistence boundaries are in place

## Priority 4: Decompose The Largest UI Classes

- ROI: High
- Why it matters: large stateful UI classes are where focus, timing, and rendering regressions become hardest to reason about.
- Primary targets:
  - `src/modules/ui/epg/EPGComponent.ts`
  - `src/modules/ui/settings/SettingsScreen.ts`
  - `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
- Target outcomes:
  - Separate state, rendering, navigation, and async coordination.
  - Reduce multi-purpose `show()` and `hide()` behavior.
  - Improve testability without private probing.
- Candidate extractions:
  - view/state objects
  - focus/navigation controllers
  - rendering helpers / subviews
  - async coordinators for load/save flows
- Guardrails:
  - Preserve TV remote behavior, focus order, and bounded DOM usage.
  - No network waits in `show()`.
  - Hidden UI should not keep timers or listeners alive.
- Verification:
  - `npm run verify`
- Checklist:
  - [ ] Pick one UI class and map its state/render/input responsibilities
  - [ ] Extract one concern at a time
  - [ ] Keep focus cleanup ownership explicit
  - [ ] Re-test the affected navigation flow after each extraction
- Primary work units:
  - [ ] P4-W1 - Split `SettingsScreen` into storage/state ownership vs view/focus ownership
  - [ ] P4-W2 - Split one bounded concern out of `EPGComponent` (recommended: navigation or info-panel orchestration)
  - [ ] P4-W3 - Split one bounded concern out of `ChannelSetupScreen` (recommended: step orchestration vs view rendering)
  - [ ] P4-W4 - Consolidate repeated focus/render helpers into reusable UI primitives only after the first three extractions are stable
  - [ ] P4-W5 - Cleanup pass for Priority 4: remove placeholder view glue, dead DOM refs, temporary focus bridges, and transitional UI conditionals introduced during the screen splits

## Priority 5: Break PlexStreamResolver Into A Pipeline Of Policies

- ROI: High
- Why it matters: this is a fragile integration boundary that currently mixes URL construction, auth handling, transport policy, codec policy, subtitle strategy, and debug behavior.
- Target outcomes:
  - Smaller policy units for direct play, transcode decisions, subtitle delivery, and request helpers.
  - Easier regression testing for playback edge cases.
  - Clearer boundaries between transport helpers and media decision logic.
- Candidate extractions:
  - request/timeout helper
  - URL builder/token injection helper
  - media selection policy
  - subtitle delivery policy
  - HDR/audio compatibility policy
- Likely files:
  - `src/modules/plex/stream/PlexStreamResolver.ts`
  - supporting helpers under `src/modules/plex/stream/`
- Guardrails:
  - Preserve token safety.
  - Preserve direct play vs transcode behavior.
  - Keep feature flags and debug behavior out of core decision logic where possible.
- Verification:
  - `npm run verify`
- Checklist:
  - [ ] Map the current responsibilities inside `PlexStreamResolver`
  - [ ] Extract one policy seam with targeted tests
  - [ ] Keep URL/token handling centralized and auditable
  - [ ] Re-run affected playback and subtitle tests
- Primary work units:
  - [ ] P5-W1 - Extract request timeout/fetch helpers and keep behavior unchanged
  - [ ] P5-W2 - Extract URL building and token injection into one auditable helper
  - [ ] P5-W3 - Extract subtitle delivery policy from the main resolver
  - [ ] P5-W4 - Extract media selection plus HDR/audio compatibility rules into focused policy units
  - [ ] P5-W5 - Cleanup pass for Priority 5: remove temporary wrapper methods, duplicated decision branches, and transitional resolver plumbing left behind after the policy extractions

## Priority 6: Reintroduce A Dedicated Channel Persistence Layer

- ROI: Medium-high
- Why it matters: `ChannelManager` currently mixes domain behavior with serialization, normalization, and storage recovery.
- Target outcomes:
  - `ChannelManager` focuses on channel behavior and orchestration.
  - A repository/store owns serialization, loading, normalization, and migration.
- Likely files:
  - `src/modules/scheduler/channel-manager/ChannelManager.ts`
  - new persistence boundary under `src/modules/scheduler/channel-manager/`
- Guardrails:
  - Keep normalization logic test-covered.
  - Avoid changing scheduling behavior during structural extraction.
- Verification:
  - `npm run typecheck`
  - `npm test`
- Checklist:
  - [ ] Isolate serialization and load/save logic
  - [ ] Move migration/normalization behind a repository boundary
  - [ ] Keep `ChannelManager` focused on domain operations
- Primary work units:
  - [ ] P6-W1 - Extract serialization/deserialization into a dedicated codec/helper
  - [ ] P6-W2 - Introduce `ChannelRepository` for load/save and move raw storage calls behind it
  - [ ] P6-W3 - Move normalization and migration rules behind the same boundary and simplify `ChannelManager`
  - [ ] P6-W4 - Cleanup pass for Priority 6: remove temporary repository adapters, duplicate serialization paths, and dead persistence helpers after `ChannelManager` no longer owns them

## Priority 7: Refresh Architecture Documentation So It Matches Reality

- ROI: Medium
- Why it matters: stale architecture docs cause bad assumptions and make future refactors slower and riskier.
- Current problems:
  - docs still reference outdated or renamed pieces
  - some described module boundaries do not match the current source tree
- Target outcomes:
  - `docs/architecture/README.md` and `docs/architecture/modules.md` match current code
  - hotspot ownership is documented honestly
  - current composition roots and module boundaries are explicit
- Verification:
  - manual doc review for path and ownership accuracy
- Checklist:
  - [ ] Update diagrams and module names
  - [ ] Remove stale components that no longer exist
  - [ ] Document the real current hotspots and intended boundaries
- Primary work units:
  - [ ] P7-W1 - Refresh `docs/architecture/README.md` so the top-level story matches the current app
  - [ ] P7-W2 - Refresh `docs/architecture/modules.md` so module names and boundaries match the real source tree
  - [ ] P7-W3 - Add explicit notes about current hotspots and intended post-cleanup ownership
  - [ ] P7-W4 - Cleanup pass for Priority 7: remove stale references, outdated examples, and superseded wording from architecture docs once the new descriptions are complete

## Priority 8: Improve Public Test Seams And Reduce Private-Probe Dependence

- ROI: Medium
- Why it matters: tests that need private access are a sign the production seams are not clean enough.
- Target outcomes:
  - More behavior tested through public APIs or extracted collaborators
  - audit of any overengineered or redundant/unhelpful test for deletion
  - Less need for frozen private-probe debt
- Likely files:
  - `src/__tests__/policy/AntiPatterns.policy.test.ts`
  - hotspot test suites under `src/__tests__/` and `src/modules/**/__tests__/`
- Guardrails:
  - Do not add test-only production hacks.
  - Prefer extracting a real public collaborator over exposing private state.
- Verification:
  - `npm test`
- Checklist:
  - [ ] Identify one private-probe-heavy area
  - [ ] Extract a public seam that can be tested directly
  - [ ] Convert at least one test away from private probing
- Primary work units:
  - [ ] P8-W1 - Reduce private probing in the orchestrator playback tests by routing through the first extracted controller
  - [ ] P8-W2 - Reduce one private-probe-heavy UI test after the corresponding UI extraction lands
  - [ ] P8-W3 - Tighten the anti-pattern baseline once at least one hotspot suite no longer needs the old probe path
  - [ ] P8-W4 - Cleanup pass for Priority 8: remove obsolete test helpers, dead probe utilities, overengineered/redundant/unhelpful tests, and transitional assertions after the new public seams are stable

## Suggested Execution Order

- Start with one narrow extraction from `src/Orchestrator.ts`
- Then split one responsibility out of `src/App.ts`
- Then introduce one storage owner and convert one namespace
- Then tackle one major UI class

Keep each step small enough to verify cleanly.

## Review Notes

- This backlog is based on direct repo inspection, not on a rewrite plan.
- The fastest path is incremental extraction with strong verification, not a broad re-architecture effort.
- The new skills added in this change are intended to stop the same structural drift from continuing while this backlog is being worked down.
