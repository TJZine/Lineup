# Architecture Cleanup Checklist

> V2 draft established 2026-03-09. This replaces the completed wave-1 backlog archived at [`docs/archive/checklists/2026-03-09-architecture-cleanup-checklist-wave-1.md`](./docs/archive/checklists/2026-03-09-architecture-cleanup-checklist-wave-1.md).

This document is the active cleanup queue for getting Lineup to production-grade code quality, lower technical debt, lower AI-slop residue, and stronger architecture boundaries.

The goal is not a rewrite. The goal is to make the highest-ROI structural improvements first, keep ownership explicit, remove transitional residue aggressively, and make the remaining debt easy to audit.

Completion rule: every implementation plan that finishes a `P#-W#` work unit must update this checklist in the same delivery pass before the work is considered complete.

## Temporary Subjective Review Completion Gate

This section is temporary. Remove it after the remaining `desloppify` subjective batches are completed, imported, and the v2 priority order is re-checked in the same pass.

- Current status:
  - `desloppify status` before subjective import: `overall 37.7 / objective 94.2 / strict 37.7 / verified 94.2`
  - Partial subjective baseline completed: `10 / 20` batches
  - Partial subjective average from completed batches: `79.8`
  - Active run directory: `.desloppify/subagents/runs/20260309_211514`
- Completed batches:
  - `batch-1` `cross_module_architecture`
  - `batch-3` `convention_outlier`
  - `batch-7` `dependency_health`
  - `batch-9` `mid_level_elegance`
  - `batch-12` `ai_generated_debt`
  - `batch-13` `incomplete_migration`
  - `batch-14` `package_organization`
  - `batch-15` `initialization_coupling`
  - `batch-16` `design_coherence`
  - `batch-20` `authorization_consistency`
- Remaining batches:
  - `batch-2` `high_level_elegance`
  - `batch-4` `error_consistency`
  - `batch-5` `naming_quality`
  - `batch-6` `abstraction_fitness`
  - `batch-8` `logic_clarity`
  - `batch-10` `test_strategy`
  - `batch-11` `api_surface_coherence`
  - `batch-17` `contract_coherence`
  - `batch-18` `low_level_elegance`
  - `batch-19` `type_safety`
- Recommended remaining run order:
  - Wave 3: `6`, `11`, `17`, `19`, `5`
  - Wave 4: `4`, `8`, `10`, `18`, `2`

### Exact Completion Procedure

1. Reuse the existing run directory:
   - `.desloppify/subagents/runs/20260309_211514`
2. For each remaining batch, open the generated prompt:
   - `.desloppify/subagents/runs/20260309_211514/prompts/batch-<N>.md`
3. Start a fresh reviewer session.
4. Paste the repo starter prompt first, then paste the generated `batch-<N>.md` prompt exactly.
5. Save the returned JSON to:
   - `.desloppify/subagents/runs/20260309_211514/results/batch-<N>.json`
6. Validate the JSON before import:
   - `python3 -m json.tool .desloppify/subagents/runs/20260309_211514/results/batch-<N>.json >/dev/null`
7. Keep `batch_tracking.csv` updated in the same run directory.
8. After all 20 result files exist and validate, import the run:

```bash
desloppify review --import-run .desloppify/subagents/runs/20260309_211514 --scan-after-import
desloppify status
desloppify show review --status open
desloppify next --count 20
```

9. In the same pass:
   - refresh the evidence snapshot below
   - rebalance the priority order only if the imported subjective results materially change ROI
   - remove this entire temporary section

## How To Use This

- Treat this as the active cleanup queue for architecture and codebase-quality work.
- Work from top to bottom unless a production issue forces a different order.
- Keep scope narrow and verification strong.
- Prefer explicit ownership, auditable seams, and fewer hotspot classes.
- Remove transitional residue after each extraction instead of letting it accumulate.
- Keep plans decision-point-free when delegating to weaker agents.
- Use [`docs/architecture/CURRENT_STATE.md`](./docs/architecture/CURRENT_STATE.md) for current architecture truth and this file for active cleanup status.

## Provisional Evidence Snapshot

This snapshot is intentionally marked provisional until the remaining subjective batches are imported.

- Largest live source hotspots by size:
  - `src/Orchestrator.ts` at `2,592` lines
  - `src/modules/ui/epg/EPGComponent.ts` at `1,920` lines
  - `src/modules/scheduler/channel-manager/ChannelManager.ts` at `1,420` lines
  - `src/modules/plex/stream/PlexStreamResolver.ts` at `1,413` lines
  - `src/modules/player/VideoPlayer.ts` at `1,248` lines
  - `src/modules/ui/channel-setup/ChannelSetupScreen.ts` at `1,052` lines
  - `src/core/InitializationCoordinator.ts` at `998` lines
  - `src/modules/ui/settings/SettingsScreen.ts` at `735` lines
  - `src/App.ts` at `611` lines
- Strongest partial subjective signals so far:
  - `cross_module_architecture` remains the weakest completed dimension at `72.0`
  - `design_coherence` remains weak at `74.0`
  - `ai_generated_debt` remains weak at `76.0`
- Strongest repeated findings from completed batches:
  - `AppOrchestrator` is still the central runtime hub and major blast-radius owner
  - startup wiring still contains an `Orchestrator` / `core` import cycle
  - persistence ownership is still inconsistent across runtime, auth, lifecycle, and EPG-debug surfaces
  - migration residue still exists in auth, lifecycle, subtitle, and player surfaces
  - some coordinators remain coarse-grained facades instead of crisp boundaries

## Priority 1: Complete Runtime Composition Cleanup In `AppOrchestrator`

- ROI: Highest
- Why it matters: the strongest completed subjective signals still point at runtime concentration, startup coupling, and coarse-grained orchestration ownership in `src/Orchestrator.ts`.
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
  - [ ] `P1-W1` break the `Orchestrator` / `core` startup import cycle without adding another compatibility seam
  - [ ] `P1-W2` extract coordinator construction and dependency assembly paths that still make `AppOrchestrator` the central runtime factory
  - [ ] `P1-W3` split remaining coarse-grained startup policy out of `InitializationCoordinator`
  - [ ] `P1-W4` remove leftover pass-through runtime helpers, duplicate lifecycle handoffs, and any transitional seams created by the round-2 extraction
  - [ ] `P1-W5` run a full cleanup pass for this priority so the remaining `AppOrchestrator` surface matches the intended steady-state boundary rather than a partially reduced hotspot

## Priority 2: Finish App-Shell And Startup Boundary Cleanup

- ROI: High
- Why it matters: `App.ts` is no longer the top hotspot, but it still owns client-ID persistence, screen visibility policy, and shell/runtime handoffs that should be thinner and more explicit.
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
- Why it matters: partial review results and direct repo inspection both show that persistence ownership is improved but still incomplete and inconsistently documented.
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
- Why it matters: completed subjective batches still call out coarse seams in `EPGComponent`, `EPGCoordinator`, `ChannelSetupCoordinator`, and adjacent UI/runtime coordinators.
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
  - preserve or improve public-behavior testability across the touched flows
  - remove transitional timing/focus/render glue left behind by the round-2 decomposition
- Nice-to-do while in the area:
  - align small UI helper naming or file placement while the ownership split is already in motion
  - delete redundant local glue code that becomes dead after the main extraction
- Cleanup track:
  - [ ] `P4-W1` split the next bounded concern out of `EPGCoordinator` and `EPGComponent`, not just one temporary seam
  - [ ] `P4-W2` narrow `ChannelSetupCoordinator` so planning, build execution, rerun workflow, and persistence are not co-owned
  - [ ] `P4-W3` audit and split `NavigationManager` where focus-rule logic and input/timing logic are separable
  - [ ] `P4-W4` finish remaining round-2 cleanup in `SettingsScreen` / `ChannelSetupScreen` if the subjective tail batches still flag them
  - [ ] `P4-W5` remove transitional coordinator glue, timing bridges, and UI helper residue created by the round-2 decomposition

## Priority 5: Tighten Plex/Auth/Discovery Trust Boundaries

- ROI: High
- Why it matters: the partial subjective review found incomplete migration branches, policy drift across trust boundaries, and constructor-time persistence behavior in auth and discovery flows.
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
  - retire obsolete migration and compatibility branches that still have active production cost
  - leave token/query-param policy auditable from one clear surface or a very small aligned set of surfaces
- Nice-to-do while in the area:
  - clean up low-value defensive duplication in Plex parsing or request helpers when directly touched
  - standardize nearby auth/trust naming if it reduces future drift without creating extra scope
- Cleanup track:
  - [ ] `P5-W1` normalize auth/trust-boundary error handling across auth, discovery, library, player, and playback-options surfaces
  - [ ] `P5-W2` remove inactive migration or compatibility branches from auth, subtitle, player, and related Plex surfaces after tests prove they are obsolete
  - [ ] `P5-W3` consolidate token-in-URL usage and origin-trust checks behind one clear policy surface or a very small set of aligned surfaces
  - [ ] `P5-W4` remove any remaining sibling policy drift that the completed and pending subjective findings flag inside Plex-facing modules

## Priority 6: Complete Scheduler And Channel Domain Cleanup

- ROI: Medium-high
- Why it matters: `ChannelManager` is smaller than before but still carries cleanup residue, mixed responsibilities, and production comments that should not remain in the steady-state code.
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
  - move scheduler-specific helpers out of catch-all utility surfaces where ownership is currently wrong
- Nice-to-do while in the area:
  - standardize scheduler naming/protocol drift that becomes obvious during the main cleanup
  - simplify small adjacent helpers if the primary cleanup makes them redundant
- Cleanup track:
  - [ ] `P6-W1` remove review-history / issue-round comments and replace any remaining needed context with durable code comments or docs
  - [ ] `P6-W2` extract or simplify any remaining `ChannelManager` responsibility clusters that still blur domain, retry, and persistence concerns
  - [ ] `P6-W3` reduce utility-layer catch-all drift where feature-specific helpers belong closer to their owners
  - [ ] `P6-W4` run a final scheduler-domain cleanup pass to remove transitional helpers, duplicate conventions, and stale abstraction residue

## Priority 7: Improve Test Strategy And Public Seam Realism

- ROI: Medium-high
- Why it matters: the frozen private-probe baseline is now zero, but wider test coupling and internal-seam dependence still exist outside the frozen suites.
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
  - complete the `test_strategy` subjective input and act on its highest-confidence findings
  - reduce known non-frozen hotspot reliance on internals and incidental assertions
  - leave the affected test utilities pushing authors toward public seams instead of private patching
- Nice-to-do while in the area:
  - remove redundant or overbuilt assertions that become obviously unnecessary during seam cleanup
  - normalize nearby test helper patterns where touched
- Cleanup track:
  - [ ] `P7-W1` finish the remaining `test_strategy` subjective review batch and fold its highest-confidence findings into this priority
  - [ ] `P7-W2` identify and fix or delete non-frozen hotspot suites that still lean on internals
  - [ ] `P7-W3` tighten test utility patterns that encourage state injection over behavior-level seams
  - [ ] `P7-W4` run a follow-up cleanup pass on redundant, overbuilt, or brittle tests in the affected hotspot areas

## Priority 8: Remove Cleanup Residue, AI-Slop Ceremony, And Control-Plane Drift

- ROI: Medium
- Why it matters: partial subjective results already show persistent template headers, low-value docblock repetition, transitional comments, and a completed wave-1 backlog that no longer fits the active surface.
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
  - the temporary subjective-review completion gate is removed after the import and rebalance pass
- Must-finish to close this priority:
  - remove known cleanup residue and low-value ceremony from touched production areas
  - keep active docs current and archive historical material instead of leaving it mixed into live surfaces
  - remove the temporary subjective-review completion gate once the import is done and the checklist is rebalanced
- Nice-to-do while in the area:
  - prune small doc/comment noise that is clearly redundant after the main cleanup
  - consolidate minor control-plane wording drift if it is directly adjacent to the required edits
- Cleanup track:
  - [ ] `P8-W1` remove low-value template/docblock scaffolding in all high-noise hotspot areas confirmed by the remaining subjective batches
  - [ ] `P8-W2` clean up documented drift between active backlog, current-state docs, and real persistence owners
  - [ ] `P8-W3` remove review-history breadcrumbs, migration residue comments, and stale cleanup scaffolding from production code across the affected priorities
  - [ ] `P8-W4` remove the temporary subjective-review completion gate at the top of this file once the run is imported and the priority order is refreshed

## Closeout Rules For This Draft

- Do not treat the temporary completion gate as permanent policy.
- Do not close a priority after one bounded extraction if meaningful debt in that same priority area is still known to remain.
- Do not mint new multi-session work plans from lower priorities until the remaining subjective batches are imported, unless production risk forces it.
- After the subjective import is complete, refresh:
  - the evidence snapshot
  - the priority ordering if needed
  - the cleanup-track wording where the imported findings add stronger evidence
