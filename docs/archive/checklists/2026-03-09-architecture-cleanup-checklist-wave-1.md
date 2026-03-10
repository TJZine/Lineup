# Architecture Cleanup Checklist

> Archived 2026-03-09 when the active backlog was reset to a v2 draft at [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../../ARCHITECTURE_CLEANUP_CHECKLIST.md). This file preserves the completed wave-1 backlog and completion record.

## Historical Context

Wave 1 was the initial architecture-cleanup backlog used from 2026-03-02 through 2026-03-09.

Its purpose was to reduce the major hotspot files without rewriting the app:

- split `AppOrchestrator` into real runtime collaborators
- thin the app shell
- introduce real persistence boundaries
- decompose the largest UI hotspots
- break `PlexStreamResolver` into smaller policy seams
- restore a dedicated channel persistence boundary
- refresh architecture docs
- reduce private-probe dependence in tests

## Historical Evidence Snapshot

The hotspot snapshot used when this wave started was:

- `src/Orchestrator.ts` at `2,592` lines
- `src/modules/ui/epg/EPGComponent.ts` at `1,920` lines
- `src/modules/plex/stream/PlexStreamResolver.ts` at `1,733` lines
- `src/modules/scheduler/channel-manager/ChannelManager.ts` at `1,583` lines
- `src/modules/player/VideoPlayer.ts` at `1,252` lines
- `src/modules/ui/channel-setup/ChannelSetupScreen.ts` at `1,052` lines
- `src/modules/ui/settings/SettingsScreen.ts` at `735` lines
- `src/App.ts` at `611` lines

The most important starting concerns were:

- `AppOrchestrator` had the highest responsibility concentration.
- `App.ts` still mixed shell setup with feature-facing behavior.
- raw persistence ownership was spread across too many modules.
- UI hotspots still mixed timing, focus, rendering, and state.
- private-probe-heavy tests signaled weak public seams in some hotspots.

## Completed Priority History

### Priority 1: Split AppOrchestrator Into Real Runtime Controllers

Why it mattered:
- `src/Orchestrator.ts` was the main source of change amplification and cross-cutting risk.

Completed work units:
- [x] `P1-W1` Extract program-start sequencing into a focused playback-start controller (done 2026-03-02; plan: unavailable-pre-bootstrap)
- [x] `P1-W2` Move player event handlers into a playback runtime controller while keeping subscriptions in place (done 2026-03-02; plan: unavailable-pre-bootstrap)
- [x] `P1-W3` Move pause/resume and in-flight playback coordination into the same runtime boundary (done 2026-03-02; plan: unavailable-pre-bootstrap)
- [x] `P1-W4` Extract `_setupEventWiring()` and the `_wire*Events()` methods into a dedicated event binder (done 2026-03-02; plan: unavailable-pre-bootstrap)
- [x] `P1-W5` Extract remaining overlay/runtime helper policies (badge visibility, modal toggles, profile-switch cleanup) (done 2026-03-03; plan: unavailable-pre-bootstrap)
- [x] `P1-W6` Cleanup pass for Priority 1: remove temporary delegation shims, transitional fields, obsolete helper methods, and no-longer-needed compatibility wiring created during the P1 refactors (done 2026-03-03; plan: unavailable-pre-bootstrap)

### Priority 2: Split App Shell Responsibilities

Why it mattered:
- `src/App.ts` was absorbing bootstrap concerns plus feature UI concerns and dev-only tooling.

Completed work units:
- [x] `P2-W1` Extract app container creation into a dedicated factory/helper (done 2026-03-03; plan: unavailable-pre-bootstrap)
- [x] `P2-W2` Extract screen loading and lazy-screen caching into a screen registry/loader (done 2026-03-03; plan: unavailable-pre-bootstrap)
- [x] `P2-W3` Extract toast and blocking error overlay presentation out of `App` (done 2026-03-03; plan: unavailable-pre-bootstrap)
- [x] `P2-W4` Isolate the dev menu / diagnostics surface from the runtime app shell (done 2026-03-03; plan: unavailable-pre-bootstrap)
- [x] `P2-W5` Cleanup pass for Priority 2: remove temporary pass-through helpers, dead container references, and transitional app-shell glue introduced while splitting `App` (done 2026-03-03; plan: unavailable-pre-bootstrap)

### Priority 3: Introduce Real Persistence Boundaries

Why it mattered:
- persisted state was too distributed, duplicating parsing and increasing webOS-specific failure risk.

Completed work units:
- [x] `P3-W1` Introduce `SettingsStore` and remove direct settings parsing from `SettingsScreen` (done 2026-03-04; plan: unavailable-pre-bootstrap)
- [x] `P3-W2` Extract debug-override storage into a dedicated store (done 2026-03-04; plan: unavailable-pre-bootstrap)
- [x] `P3-W3` Add a repository/store for selected server and server health state (done 2026-03-05; plan: unavailable-pre-bootstrap)
- [x] `P3-W4` Introduce a dedicated channel persistence boundary and route one caller through it (done 2026-03-05; plan: unavailable-pre-bootstrap)
- [x] `P3-W5` Cleanup pass for Priority 3: remove leftover raw storage access, duplicate key knowledge, temporary adapters, and obsolete parsing helpers after the persistence boundaries are in place (done 2026-03-05; plan: unavailable-pre-bootstrap)
- [x] `P3-W6` Introduce `DeveloperSettingsStore` for debug flags and replace remaining direct reads of `DEBUG_LOGGING` / `SUBTITLE_DEBUG_LOGGING` in non-UI modules (done 2026-03-08; plan: docs/archive/plans/2026-03-08-p3-w6-developer-settings-store-summary.md)

### Priority 4: Decompose The Largest UI Classes

Why it mattered:
- large stateful UI classes were where focus, timing, and rendering regressions became hardest to reason about.

Completed work units:
- [x] `P4-W1` Split `SettingsScreen` into storage/state ownership vs view/focus ownership (done 2026-03-05; plan: docs/archive/plans/2026-03-06-priority-4-ui-decomposition-section-summary.md)
- [x] `P4-W2` Split one bounded concern out of `EPGComponent` (recommended: navigation or info-panel orchestration) (done 2026-03-06; plan: docs/archive/plans/2026-03-06-priority-4-ui-decomposition-section-summary.md)
- [x] `P4-W3` Split one bounded concern out of `ChannelSetupScreen` (recommended: step orchestration vs view rendering) (done 2026-03-06; plan: docs/archive/plans/2026-03-06-priority-4-ui-decomposition-section-summary.md)
- [x] `P4-W4` Consolidate repeated focus/render helpers into reusable UI primitives only after the first three extractions are stable (done 2026-03-06; plan: docs/archive/plans/2026-03-06-priority-4-ui-decomposition-section-summary.md)
- [x] `P4-W5` Cleanup pass for Priority 4: remove placeholder view glue, dead DOM refs, temporary focus bridges, and transitional UI conditionals introduced during the screen splits (done 2026-03-06; plan: docs/archive/plans/2026-03-06-priority-4-ui-decomposition-section-summary.md)

### Priority 5: Break PlexStreamResolver Into A Pipeline Of Policies

Why it mattered:
- this integration boundary mixed URL construction, auth handling, transport policy, codec policy, subtitle strategy, and debug behavior.

Completed work units:
- [x] `P5-W1` Extract request timeout/fetch helpers and keep behavior unchanged (done 2026-03-08; plan: docs/archive/plans/2026-03-08-priority-5-plex-stream-policy-section-summary.md)
- [x] `P5-W2` Extract URL building and token injection into one auditable helper (done 2026-03-08; plan: docs/archive/plans/2026-03-08-priority-5-plex-stream-policy-section-summary.md)
- [x] `P5-W3` Extract subtitle delivery policy from the main resolver (done 2026-03-08; plan: docs/archive/plans/2026-03-08-priority-5-plex-stream-policy-section-summary.md)
- [x] `P5-W4` Extract media selection plus HDR/audio compatibility rules into focused policy units (done 2026-03-08; plan: docs/archive/plans/2026-03-08-priority-5-plex-stream-policy-section-summary.md)
- [x] `P5-W5` Cleanup pass for Priority 5: remove temporary wrapper methods, duplicated decision branches, and transitional resolver plumbing left behind after the policy extractions (done 2026-03-08; plan: docs/archive/plans/2026-03-08-priority-5-plex-stream-policy-section-summary.md)
- [x] `P5-W6` Introduce a typed playback settings boundary + unify DTS passthrough gating for direct-play vs advertised capabilities (remove remaining raw storage reads in `PlexStreamResolver`) (done 2026-03-08; plan: docs/archive/plans/2026-03-08-priority-5-plex-stream-policy-section-summary.md)

### Priority 6: Reintroduce A Dedicated Channel Persistence Layer

Why it mattered:
- `ChannelManager` mixed domain behavior with serialization, normalization, and storage recovery.

Completed work units:
- [x] `P6-W1` Extract serialization/deserialization into a dedicated codec/helper (done 2026-03-08; plan: docs/archive/plans/2026-03-08-priority-6-channel-persistence-section-summary.md)
- [x] `P6-W2` Introduce `ChannelRepository` for load/save and move raw storage calls behind it (done 2026-03-08; plan: docs/archive/plans/2026-03-08-priority-6-channel-persistence-section-summary.md)
- [x] `P6-W3` Move normalization and migration rules behind the same boundary and simplify `ChannelManager` (done 2026-03-08; plan: docs/archive/plans/2026-03-08-priority-6-channel-persistence-section-summary.md)
- [x] `P6-W4` Cleanup pass for Priority 6: remove temporary repository adapters, duplicate serialization paths, and dead persistence helpers after `ChannelManager` no longer owns them (done 2026-03-08; plan: docs/archive/plans/2026-03-08-priority-6-channel-persistence-section-summary.md)

### Priority 7: Refresh Architecture Documentation So It Matches Reality

Why it mattered:
- stale architecture docs caused bad assumptions and slowed future refactors.

Completed work units:
- [x] `P7-W1` Refresh `docs/architecture/README.md`, refresh `docs/architecture/modules.md` so module names and boundaries match the real source tree, add explicit notes about current hotspots and intended post-cleanup ownership, and complete a cleanup pass for stale references and outdated wording (done 2026-03-08; plan: docs/archive/plans/2026-03-08-priority-7-architecture-doc-refresh-summary.md)

### Priority 8: Improve Public Test Seams And Reduce Private-Probe Dependence

Why it mattered:
- tests that needed private access signaled weak production seams and redundant test debt.

Completed work units:
- [x] `P8-W1` Reduce private probing in the orchestrator playback tests by routing through the first extracted controller (done 2026-03-09; plan: docs/plans/2026-03-09-p8-w1-orchestrator-playback-tests-without-private-probes.md)
- [x] `P8-W2` Reduce one private-probe-heavy UI test after the corresponding UI extraction lands, and report remaining debt (done 2026-03-09; plan: docs/plans/2026-03-09-p8-w2-epgcoordinator-tests-without-private-probes.md)
- [x] `P8-W3` Convert one remaining real UI private-probe suite to a production seam or public-behavior path, then ratchet the anti-pattern baseline and refresh the remaining-debt note (done 2026-03-09; plan: docs/plans/2026-03-09-p8-w3-tighten-antipattern-baseline.md)
- [x] `P8-W4` Cleanup pass for Priority 8: remove obsolete test helpers, dead probe utilities, overengineered/redundant/unhelpful tests, and transitional assertions after the new public seams are stable (done 2026-03-09; plan: docs/plans/2026-03-09-p8-w4-priority-8-private-probe-cleanup-pass.md)

Historical closeout note:

- after `P8-W4`, the frozen-suite private-probe baseline was reduced to `maxCount=0`
- the remaining `_visible` / `_src` references called out during `P8-W2` were test-double internals, not real UI SUT private-probe debt
