# Architecture Cleanup Checklist

> V2 established 2026-03-09 and finalized against the full subjective review import on 2026-03-10. This replaces the completed wave-1 backlog archived at [`docs/archive/checklists/2026-03-09-architecture-cleanup-checklist-wave-1.md`](./docs/archive/checklists/2026-03-09-architecture-cleanup-checklist-wave-1.md).

This document is the active cleanup queue for getting Lineup to production-grade code quality, lower technical debt, lower AI-slop residue, and stronger architecture boundaries.

The goal is not a rewrite. The goal is to make the highest-ROI structural improvements first, keep ownership explicit, remove transitional residue aggressively, and make the remaining debt easy to audit.

Completion rule: every implementation plan that finishes a `P#-W#` work unit must update this checklist in the same delivery pass before the work is considered complete.

## How To Use This

- Treat this as the active cleanup queue for architecture and codebase-quality work.
- Before normal priority flow, triage the current `desloppify` security queue; any open security issue reported by `desloppify status` is a `P0` gate and must be resolved or explicitly deferred before routine cleanup work continues.
- Work from top to bottom unless a production issue forces a different order.
- Keep scope narrow and verification strong.
- Prefer explicit ownership, auditable seams, and fewer hotspot classes.
- Remove transitional residue after each extraction instead of letting it accumulate.
- Keep plans decision-point-free when delegating to weaker agents.
- Use [`docs/architecture/CURRENT_STATE.md`](./docs/architecture/CURRENT_STATE.md) for current architecture truth and this file for active cleanup status.

## Evidence Snapshot

- Imported subjective run:
  - run directory: `.desloppify/subagents/runs/20260309_211514`
  - validated result files: `20 / 20`
  - import replay: `desloppify review --import-run .desloppify/subagents/runs/20260309_211514 --scan-after-import`
  - import outcome: `20` trusted dimension updates and `62` new review issues
- Current post-import score state:
  - evidence captured on `2026-03-10` from `desloppify status`, `desloppify show review --status open`, and `wc -l` on the listed hotspot files
  - `desloppify status`: `strict 75.0 / mechanical 94.2 / subjective 62.1`
  - strict score improved from the pre-import `37.7` baseline to `75.0`
  - current queue shape: `62` open review issues and `488` total open items
- Raw imported subjective baseline:
  - full-batch average across all `20` dimensions: `79.2`
  - weakest raw batch dimensions: `cross_module_architecture 72.0`, `design_coherence 74.0`, `abstraction_fitness 74.0`, `error_consistency 74.6`, `ai_generated_debt 76.0`, `test_strategy 77.2`
- Weakest post-import subjective measures:
  - `cross-module architecture 48.0`
  - `design coherence 50.0`
  - `abstraction fit 53.2`
  - `test strategy 53.2`
  - `high elegance 54.9`
  - `type safety 55.5`
  - `AI generated debt 57.2`
- Priority-order re-check after full import:
  - keep the current priority order
  - the imported review reinforced the existing emphasis on runtime concentration, startup boundaries, persistence ownership, UI/coordinator decomposition, and Plex trust-boundary cleanup rather than surfacing a stronger alternative order

- Largest live source hotspots by size:
  - `src/Orchestrator.ts` at `2,595` lines
  - `src/modules/ui/epg/EPGComponent.ts` at `1,920` lines
  - `src/modules/scheduler/channel-manager/ChannelManager.ts` at `1,420` lines
  - `src/modules/plex/stream/PlexStreamResolver.ts` at `1,413` lines
  - `src/modules/player/VideoPlayer.ts` at `1,248` lines
  - `src/modules/ui/channel-setup/ChannelSetupScreen.ts` at `1,052` lines
  - `src/core/InitializationCoordinator.ts` at `998` lines
  - `src/modules/ui/settings/SettingsScreen.ts` at `735` lines
  - `src/App.ts` at `611` lines
- Strongest repeated findings from the imported run:
  - `AppOrchestrator` is still the central runtime hub, pass-through facade, and major blast-radius owner
  - startup wiring still contains an `Orchestrator` / `core` import cycle
  - persistence ownership still leaks through raw storage bypasses and constructor-time state restoration in auth and discovery flows
  - EPG, channel setup, and navigation still have coarse coordinator boundaries that blur render, orchestration, persistence, and queue/timing policy
  - Plex-facing auth, discovery, and stream helpers still show contract drift and inconsistent trust-boundary/error protocols
  - test realism remains weaker around startup, shared error helpers, and timing-sensitive flows than the zero-private-probe baseline alone suggests
  - migration residue still exists in auth, lifecycle, subtitle, player, and scheduler-adjacent surfaces

## Imported Review Issue Map

This is a high-signal seed map for the imported review queue, not an exhaustive list of all `62` imported review issues.

Use it to keep the highest-risk imported findings tied to concrete work units. For imported issues not listed here, the implementation plan for the touched priority must assign them to a `P#-W#` before the work starts or explicitly record why they are being deferred.

Do not close a listed work unit while its mapped imported issue still remains unresolved without recording the reason.

- `abstraction_fitness::orchestrator_passthrough_facade` -> `P1-W2`, `P1-W4`
- `cross_module_architecture::orchestrator_initialization_cycle` -> `P1-W1`
- `cross_module_architecture::storage_owner_boundary_drift` -> `P3-W2`, `P3-W3`, `P3-W4`
- `api_surface_coherence::fetch_with_timeout_signature_drift` -> `P5-W1`
- `api_surface_coherence::validate_token_error_contract_gap` -> `P5-W1`
- `authorization_consistency::profile_select_magic_auth_codes` -> `P5-W1`
- `authorization_consistency::token_query_origin_policy_drift` -> `P5-W3`
- `contract_coherence::channel_manager_boundary_contract_mismatch` -> `P6-W2`
- `contract_coherence::channel_scheduler_mutable_buffer_api` -> `P6-W2`
- `contract_coherence::resolve_channel_items_leaks_cached_reference` -> `P6-W2`
- `convention_outlier::container_id_convention_split` -> `P2-W4`
- `convention_outlier::scheduler_namespace_export_outlier` -> `P6-W4`
- `test_strategy::untested_core_error_helpers` -> `P7-W1`
- `test_strategy::bootstrap_internal_seam_coupling` -> `P7-W1`
- `test_strategy::mock_heavy_top_level_gaps` -> `P7-W2`
- `test_strategy::timer_and_eventloop_brittleness` -> `P7-W3`
- `ai_generated_debt::comment_template_ceremony` -> `P8-W1`

## Execution Hygiene

- Security deferral record format:
  - `issue`: exact `desloppify` issue id or security finding reference
  - `reason`: why it is being deferred instead of resolved now
  - `revisit trigger`: the concrete condition or date that forces re-triage
- Cleanup slice execution template:
  - `priority/work units`: exact `P#-W#` items in scope for this slice
  - `imported review issues`: exact mapped or newly assigned imported review issue ids being retired
  - `security triage`: `none open`, or the deferred/resolved security findings for this slice
  - `verification`: exact commands that prove the slice is complete
  - `deferred items`: anything intentionally left open with a concrete reason
- Evidence refresh checklist:
  - rerun `desloppify status`
  - rerun `desloppify show review --status open`
  - refresh hotspot counts with `wc -l` for the files listed in the evidence snapshot
  - update this checklist in the same pass when a priority closes, strict score shifts materially, or the imported review ownership map changes
- Cleanup slice command checklist:
  - start of slice:
    - `desloppify status`
    - `desloppify show review --status open`
    - any task-specific `desloppify show <pattern>` calls needed to scope the touched findings
  - end of slice:
    - rerun the same `desloppify` evidence commands used at slice start
    - run the verification commands named in the active plan
    - update this checklist if the slice completed a `P#-W#` item or changed the evidence snapshot

## Priority 1: Complete Runtime Composition Cleanup In `AppOrchestrator`

- ROI: Highest
- Why it matters: the full subjective import kept runtime concentration as the strongest repeated root-cause cluster: `AppOrchestrator` remains a broad runtime hub/pass-through facade, and the `Orchestrator` / `core` import cycle is still an explicit open finding.
- Primary files:
  - `src/Orchestrator.ts`
  - `src/core/InitializationCoordinator.ts`
  - `src/core/index.ts`
  - `src/core/orchestrator/**`
- Target outcomes:
  - reduce runtime blast radius in `AppOrchestrator`
  - remove the `Orchestrator` / `core` import cycle
  - keep runtime wiring explicit without keeping all policy in one facade
- Completion criteria:
  - `AppOrchestrator` no longer acts as the default owner for new runtime policy or startup logic
  - the `Orchestrator` / `core` import cycle is gone
  - remaining runtime responsibilities are grouped into explicit collaborators with auditable ownership
  - `InitializationCoordinator` is reduced to a crisp startup boundary instead of a second hotspot facade
- Must-finish to close this priority:
  - remove the `Orchestrator` / `core` import cycle
  - reduce `AppOrchestrator` and `InitializationCoordinator` to their intended steady-state ownership boundaries
  - remove transitional seams created during the round-2 runtime cleanup
- Nice-to-do while in the area:
  - tighten adjacent runtime naming or helper placement if the change is directly touched anyway
  - collapse trivial pass-through helpers that become obviously redundant during the extraction
- Cleanup track:
  - [x] `P1-W1` break the `Orchestrator` / `core` startup import cycle without adding another compatibility seam
    - Completed via `docs/plans/2026-03-10-p1-w1-break-orchestrator-core-import-cycle.md` by moving `OrchestratorConfig` and `ModuleStatus` ownership to `src/core/orchestrator/OrchestratorTypes.ts` and preserving `src/Orchestrator.ts` as the public re-export surface.
  - [x] `P1-W2` extract coordinator construction and dependency assembly paths that still make `AppOrchestrator` the central runtime factory (done 2026-03-10; plan: docs/plans/2026-03-10-p1-w2-extract-orchestrator-runtime-factory.md)
  - [x] `P1-W3` split remaining coarse-grained startup policy out of `InitializationCoordinator` (done 2026-03-10; plan: docs/plans/2026-03-10-p1-w3-split-initializationcoordinator-startup-policy.md)
  - [x] `P1-W4` remove leftover pass-through runtime helpers, duplicate lifecycle handoffs, and any transitional seams created by the round-2 extraction (done 2026-03-10; plan: docs/plans/2026-03-10-p1-w4-remove-orchestrator-runtime-transitional-seams.md)
  - [x] `P1-W5` run a full cleanup pass for this priority so the remaining `AppOrchestrator` surface matches the intended steady-state boundary rather than a partially reduced hotspot (done 2026-03-10)

## Priority 2: Finish App-Shell And Startup Boundary Cleanup

- ROI: High
- Why it matters: `App.ts` is no longer the top hotspot, but it still owns client-ID persistence, screen visibility policy, and shell/runtime handoffs that should be thinner and more explicit.
- Sequencing rule: this priority consumes the startup and runtime seams defined by Priority 1; it should not re-open or redesign orchestrator-facing public seams that P1 is responsible for freezing.
- Primary files:
  - `src/App.ts`
  - `src/core/app-shell/**`
  - `src/modules/plex/auth/helpers.ts`
- Target outcomes:
  - remove duplicated client-ID ownership
  - keep `App` focused on shell composition, not durable policy
  - make screen and startup handoffs easier to audit
- Completion criteria:
  - `App` owns shell composition and shell-only coordination, not duplicated persistence or feature policy
  - startup handoffs between `App`, the shell helpers, and orchestrator-facing code are explicit and minimal
  - screen visibility rules live behind stable shell boundaries instead of accumulating ad hoc in `App`
- Must-finish to close this priority:
  - remove duplicated client-ID ownership from the app shell path
  - leave `App` as a shell composition surface instead of a second policy owner
  - clean up shell glue left behind by the boundary tightening
- Nice-to-do while in the area:
  - normalize shell-level naming or helper placement where touched
  - reduce obvious boilerplate in shell-only presenters if it falls out naturally from the main cleanup
- Cleanup track:
  - [ ] `P2-W1` move client-identifier ownership behind one explicit owner used by both `App` and Plex auth
  - [ ] `P2-W2` narrow the `App` screen-visibility seam so it coordinates shell surfaces rather than feature details
  - [ ] `P2-W3` remove any remaining feature-specific persistence or trust-boundary policy from `App`
  - [ ] `P2-W4` clean up shell-level glue, duplicate container knowledge, and any app-shell transitional seams left after the boundary cleanup

## Priority 3: Consolidate Persistence Ownership And Storage Policy

- ROI: High
- Why it matters: the full import confirmed that persistence ownership is improved but still incomplete, with raw `localStorage` bypasses, overlapping lifecycle/channel persistence responsibility, and constructor-time state restoration still showing up as active review debt.
- Primary files:
  - `src/modules/plex/auth/PlexAuth.ts`
  - `src/modules/plex/auth/helpers.ts`
  - `src/modules/lifecycle/StateManager.ts`
  - `src/modules/ui/epg/EPGComponent.ts`
  - `src/modules/ui/epg/utils.ts`
  - `src/core/channel-setup/ChannelSetupCoordinator.ts`
  - `docs/architecture/CURRENT_STATE.md`
- Target outcomes:
  - every persistent key has one explicit owner
  - direct `localStorage` access outside sanctioned owners becomes rare and deliberate
  - current-state docs reflect the real owner list
- Completion criteria:
  - every durable storage key is owned by one named runtime/store/repository boundary
  - any remaining direct `localStorage` access is explicitly justified, documented, and limited to boundary code
  - current-state docs and real code agree on the persistence-owner map
- Must-finish to close this priority:
  - assign one explicit owner to each remaining persistent key family
  - either remove or explicitly justify every remaining direct-storage bypass
  - update architecture/current-state docs so the persistence-owner map matches the code
- Nice-to-do while in the area:
  - normalize storage helper naming where ownership cleanup exposes awkward seams
  - consolidate tiny adjacent persistence helpers if they are clearly duplicate after the owner map is cleaned up
- Cleanup track:
  - [ ] `P3-W1` unify client-ID ownership and remove duplicate storage logic between app shell and Plex auth
  - [ ] `P3-W2` decide and document the intended owner for lifecycle persistence versus channel-specific persistence edges
  - [ ] `P3-W3` isolate, wrap, or explicitly document the remaining direct-storage exceptions for EPG debug logging and channel-setup stale-key cleanup
  - [ ] `P3-W4` audit the rest of the repo for storage-owner drift and remove any newly discovered raw-storage bypasses before closing the priority
  - [ ] `P3-W5` refresh `CURRENT_STATE` and adjacent docs so the persistence-owner list is accurate and complete

## Priority 4: Complete UI And Coordinator Round-2 Decomposition

- ROI: High
- Why it matters: the imported review strengthened the case that `EPGComponent`, `EPGCoordinator`, `ChannelSetupCoordinator`, and `NavigationManager` still blur render, orchestration, persistence, cache, and timing ownership in ways that keep these seams hard to reason about.
- Primary files:
  - `src/modules/ui/epg/**`
  - `src/core/channel-setup/**`
  - `src/modules/navigation/NavigationManager.ts`
  - `src/modules/ui/settings/SettingsScreen.ts`
  - `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
- Target outcomes:
  - reduce multi-responsibility coordinator facades
  - keep UI timing/focus/render ownership bounded
  - improve behavior-level testability without private seams
- Completion criteria:
  - the remaining large UI/coordinator hotspots have explicit ownership splits for state, rendering, timing, focus, and orchestration
  - no major UI coordinator remains a catch-all facade for unrelated timing, persistence, and presentation behavior
  - the affected suites can be tested through public behavior seams rather than internal coordination state
- Must-finish to close this priority:
  - remove the known coarse-grained ownership problems in the listed UI/coordinator hotspots
  - replace the most visible EPG/UI type shortcuts that currently hide boundary confusion, especially duplicated status literal unions and force-cast configuration seams
  - preserve or improve public-behavior testability across the touched flows
  - remove transitional timing/focus/render glue left behind by the round-2 decomposition
- Nice-to-do while in the area:
  - align small UI helper naming or file placement while the ownership split is already in motion
  - delete redundant local glue code that becomes dead after the main extraction
- Cleanup track:
  - [ ] `P4-W1` split the next bounded concern out of `EPGCoordinator` and `EPGComponent`, not just one temporary seam
  - [ ] `P4-W2` narrow `ChannelSetupCoordinator` so planning, build execution, rerun workflow, and persistence are not co-owned
  - [ ] `P4-W3` audit and split `NavigationManager` where focus-rule logic and input/timing logic are separable
  - [ ] `P4-W4` finish remaining round-2 cleanup in `SettingsScreen` / `ChannelSetupScreen` where the imported review still flags coarse ownership or cleanup residue
  - [ ] `P4-W5` remove transitional coordinator glue, timing bridges, duplicated EPG status literals, and force-cast config residue created by the round-2 decomposition

## Priority 5: Tighten Plex/Auth/Discovery Trust Boundaries

- ROI: High
- Why it matters: the full import added sharper evidence of Plex trust-boundary drift, including `fetchWithTimeout` signature divergence, `validateToken()` contract mismatch, raw-string auth-code handling, inconsistent token origin checks, and still-active migration/fallback branches.
- Primary files:
  - `src/modules/plex/auth/**`
  - `src/modules/plex/discovery/**`
  - `src/modules/plex/library/**`
  - `src/modules/plex/stream/**`
  - `src/modules/player/SubtitleManager.ts`
- Target outcomes:
  - make auth and trust-boundary behavior consistent across sibling Plex modules
  - remove stale fallback or dual-path migration logic that no longer has active value
  - keep token/query-param behavior auditable and origin-safe
- Completion criteria:
  - auth, authorization, token transport, and trust-boundary rules are consistent across Plex-facing modules
  - obsolete migration or fallback branches have been removed rather than merely documented
  - token/query-param behavior is centralized enough to audit without chasing sibling drift
- Must-finish to close this priority:
  - remove the known trust-boundary drift across auth/discovery/library/player-facing paths
  - make auth-facing contracts honest and aligned, including `validateToken()` behavior, parser failure semantics, and shared auth-error signaling
  - retire obsolete migration and compatibility branches that still have active production cost
  - leave token/query-param policy auditable from one clear surface or a very small aligned set of surfaces
- Nice-to-do while in the area:
  - clean up low-value defensive duplication in Plex parsing or request helpers when directly touched
  - standardize nearby auth/trust naming if it reduces future drift without creating extra scope
- Cleanup track:
  - [ ] `P5-W1` normalize auth/trust-boundary error handling and contracts across auth, discovery, library, player, and playback-options surfaces, including `fetchWithTimeout`, `validateToken()`, parser failure semantics, and shared auth-error codes
  - [ ] `P5-W2` remove inactive migration or compatibility branches from auth, subtitle, player, and related Plex surfaces after tests prove they are obsolete
  - [ ] `P5-W3` consolidate token-in-URL usage and origin-trust checks behind one clear policy surface or a very small set of aligned surfaces
  - [ ] `P5-W4` remove any remaining sibling policy drift that the imported subjective findings flag inside Plex-facing modules

## Priority 6: Complete Scheduler And Channel Domain Cleanup

- ROI: Medium-high
- Why it matters: the imported review kept scheduler/channel cleanup in the active stack through contract mismatches, mutable read APIs, namespace-export drift, and utility-layer spillover even after the earlier persistence extractions.
- Primary files:
  - `src/modules/scheduler/channel-manager/**`
  - `src/modules/scheduler/scheduler/**`
  - `src/utils/**`
- Target outcomes:
  - remove leftover migration/review scaffolding from scheduler-domain code
  - keep channel persistence, content resolution, and retry behavior easier to audit
  - reduce catch-all utility spillover
- Completion criteria:
  - `ChannelManager` and adjacent scheduler code read like steady-state production code, not like a partially cleaned migration surface
  - scheduler-domain responsibilities are explicit enough that further edits do not require spelunking review-history residue
  - utility spillover from scheduler/channel work is brought back under clear ownership
- Must-finish to close this priority:
  - remove scheduler-domain review-history residue and transitional cleanup scaffolding
  - finish the known responsibility cleanup in `ChannelManager` and adjacent scheduler owners
  - fix imported scheduler/channel contract debt before calling this boundary stable, especially null-versus-wraparound behavior and mutable read/snapshot leaks
  - move scheduler-specific helpers out of catch-all utility surfaces where ownership is currently wrong
- Nice-to-do while in the area:
  - standardize scheduler naming/protocol drift that becomes obvious during the main cleanup
  - simplify small adjacent helpers if the primary cleanup makes them redundant
- Cleanup track:
  - [ ] `P6-W1` remove review-history / issue-round comments and replace any remaining needed context with durable code comments or docs
  - [ ] `P6-W2` fix scheduler/channel contract mismatches and mutable read APIs in `ChannelManager` and `ChannelScheduler`, then extract or simplify any remaining responsibility clusters that still blur domain, retry, and persistence concerns
  - [ ] `P6-W3` reduce utility-layer catch-all drift where feature-specific helpers belong closer to their owners
  - [ ] `P6-W4` run a final scheduler-domain cleanup pass to remove transitional helpers, duplicate conventions, namespace-export drift, and stale abstraction residue

## Priority 7: Improve Test Strategy And Public Seam Realism

- ROI: Medium-high
- Why it matters: the imported review scored `test_strategy` at `53.2` post-import and specifically called out missing direct coverage for shared error helpers, bootstrap tests tied to internal seam exports, mock-heavy startup/orchestrator coverage, and brittle timing-internal assertions.
- Primary files:
  - `src/__tests__/**`
  - `src/modules/**/__tests__/**`
  - `src/__tests__/policy/AntiPatterns.policy.test.ts`
- Target outcomes:
  - reduce brittle implementation-coupled tests outside the frozen suite policy surface
  - keep behavior-level coverage strong on hotspot modules
  - avoid regressing into private-probe-heavy tests while still deleting redundant test ceremony
- Completion criteria:
  - the remaining hotspot suites prefer public behavior and real collaborators over internals and incidental mechanics
  - test utilities encourage realistic seams rather than state injection and private patching
  - the frozen baseline staying at zero is backed by better test realism, not just narrower policy scope
- Must-finish to close this priority:
  - act on the imported `test_strategy` findings, not just the frozen private-probe policy surface
  - reduce known startup/bootstrap/orchestrator reliance on internal seam exports, heavy mocks, and incidental timing assertions
  - leave the affected test utilities pushing authors toward public seams and realistic collaborators instead of private patching
- Nice-to-do while in the area:
  - remove redundant or overbuilt assertions that become obviously unnecessary during seam cleanup
  - normalize nearby test helper patterns where touched
- Cleanup track:
  - [ ] `P7-W1` add direct tests for high-impact shared error helpers and remove bootstrap/orchestrator dependence on internal seam exports where the imported review called it out
  - [ ] `P7-W2` reduce mock-heavy coverage gaps in top-level startup and orchestrator tests so those suites exercise more realistic collaborator seams
  - [ ] `P7-W3` tighten test utility patterns and timing assertions that currently encourage incidental mechanics over behavior-level checks
  - [ ] `P7-W4` run a follow-up cleanup pass on redundant, overbuilt, or brittle tests in the affected hotspot areas

## Priority 8: Remove Cleanup Residue, AI-Slop Ceremony, And Control-Plane Drift

- ROI: Medium
- Why it matters: the imported review kept `AI generated debt` weak at `57.2` and reinforced that template headers, repetitive docblocks, review-history comments, and control-plane wording drift still add noise after the wave-1 reset.
- Primary files:
  - `src/**`
  - `docs/architecture/**`
  - `docs/agentic/**`
  - `docs/archive/checklists/2026-03-09-architecture-cleanup-checklist-wave-1.md`
- Target outcomes:
  - remove low-value structural ceremony and cleanup residue
  - keep active docs current and archived docs historical
  - keep temporary migration notes or issue-history breadcrumbs out of production code
- Completion criteria:
  - production code no longer carries obvious review-history residue, low-value boilerplate docblocks, or cargo-cult cleanup scaffolding
  - active control-plane docs are current, and historical material is archived instead of mixed into live surfaces
  - active checklist/current-state wording stays aligned with the imported evidence instead of drifting back toward provisional language
- Must-finish to close this priority:
  - remove known cleanup residue and low-value ceremony from touched production areas
  - keep active docs current and archive historical material instead of leaving it mixed into live surfaces
  - keep imported-review evidence, current-state docs, and the active checklist in sync as the cleanup backlog evolves
- Nice-to-do while in the area:
  - prune small doc/comment noise that is clearly redundant after the main cleanup
  - consolidate minor control-plane wording drift if it is directly adjacent to the required edits
- Cleanup track:
  - [ ] `P8-W1` remove low-value template/docblock scaffolding in all high-noise hotspot areas confirmed by the imported review
  - [ ] `P8-W2` clean up documented drift between the active backlog, `CURRENT_STATE`, and the real persistence-owner map
  - [ ] `P8-W3` remove review-history breadcrumbs, migration residue comments, and stale cleanup scaffolding from production code across the affected priorities
  - [ ] `P8-W4` audit remaining control-plane wording drift so active docs stay live and archives stay historical

## Closeout Rules For This Checklist

- Do not close a priority after one bounded extraction if meaningful debt in that same priority area is still known to remain.
- Do not mint new multi-session work plans from lower priorities until a higher-priority blocker is resolved, explicitly deprioritized, or accepted as deferred.
- Do not bypass the `P0` security triage gate just because a lower-numbered cleanup priority is next in sequence.
- Do not mark a mapped `P#-W#` item complete while its linked imported review issue still remains open unless the remaining gap is explicitly documented as deferred or intentionally split into a follow-up work unit.
- Do not leave imported review issues unowned: every open imported review issue must either be pre-mapped in this file, assigned in the active implementation plan for the touched priority, or explicitly deferred with a reason.
- The priority order was re-checked against the full subjective import on `2026-03-10`; keep this order unless newer evidence materially changes ROI.
- After any cleanup slice materially changes the evidence, refresh:
  - the evidence snapshot when the backlog meaningfully shifts, after any completed priority, or when strict score changes materially
  - the priority wording or cleanup-track bullets that were affected
  - any adjacent current-state docs that would otherwise drift
