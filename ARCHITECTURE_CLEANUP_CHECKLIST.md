# Architecture Cleanup Checklist

> V3 established 2026-03-26 from the refreshed holistic review imported from `.desloppify/subagents/runs/20260327_025138`.

This document is the active cleanup queue for closing the refreshed holistic `desloppify` review without reopening wave-2 control-plane ambiguity.

The goal is not a rewrite. The goal is to retire the current 44 open review issues in priority order, keep one explicit owner per issue, require `P#-EXIT` evidence before any lower priority begins, and leave no implicit carry-forward debt.

Completion rule: every implementation plan that finishes a `P#-W#` work unit must update this checklist in the same delivery pass before the work is considered complete.

## How To Use This

- Treat this as the active cleanup queue for the refreshed 44-issue holistic review backlog.
- Before normal priority flow, triage the current `desloppify` security queue; any open security issue reported by `desloppify status` is a `P0` gate and must be resolved or explicitly deferred before routine cleanup work continues.
- Work from top to bottom unless a production issue forces a different order.
- Keep scope narrow and verification strong.
- Prefer explicit ownership, auditable seams, and fewer hotspot classes.
- Remove transitional residue after each extraction instead of letting it accumulate.
- Keep plans decision-point-free when delegating to weaker agents.
- Use [`docs/architecture/CURRENT_STATE.md`](./docs/architecture/CURRENT_STATE.md) for current architecture truth and this file for active cleanup status.

## Evidence Snapshot

- Refreshed holistic import:
  - run directory: `.desloppify/subagents/runs/20260327_025138`
  - run summary: `20 / 20` successful batches, `0` failed batches
  - import replay used for the refreshed state: `desloppify review --import-run .desloppify/subagents/runs/20260327_025138 --scan-after-import`
  - import outcome on current state: `44` open review issues, `0` open security issues
- Current post-import score state:
  - evidence captured from `desloppify status`, `desloppify show review --status open --no-budget --top 100`, `desloppify show security --status open --no-budget --top 50`, and `jq` reads of `.desloppify/state-typescript.json`
  - last scan: `2026-03-27T03:30:22+00:00`
  - `desloppify status`: `overall 82.1 / objective 95.2 / strict 76.0 / verified 95.2`
  - stale subjective dimensions: none
  - weakest refreshed subjective dimensions:
    - `abstraction_fitness 71.0`
    - `cross_module_architecture 72.0`
    - `high_level_elegance 72.0`
    - `design_coherence 74.0`
    - `error_consistency 74.0`
    - `low_level_elegance 74.2`
    - `mid_level_elegance 76.0`
- Current hotspot anchors:
  - `src/Orchestrator.ts` at `2,041` lines
  - `src/modules/ui/epg/EPGVirtualizer.ts` at `1,601` lines
  - `src/modules/plex/stream/PlexStreamResolver.ts` at `1,411` lines
  - `src/modules/plex/library/PlexLibrary.ts` at `1,111` lines
  - `src/modules/player/SubtitleManager.ts` at `1,034` lines
  - `src/modules/player/PlaybackRecoveryManager.ts` at `849` lines
  - `src/modules/plex/auth/PlexAuth.ts` at `816` lines
  - `src/modules/ui/epg/EPGCoordinator.ts` at `784` lines
  - `src/core/orchestrator/OrchestratorCoordinatorFactory.ts` at `556` lines
  - `src/App.ts` at `453` lines
- Priority-order rationale from the refreshed queue:
  - runtime composition-root drift remains the highest-ROI architecture drag
  - EPG still carries the densest ownership/elegance cluster after wave 2
  - channel setup still has unresolved owner placement and duplicated flow logic
  - persistence/lifecycle/diagnostics ownership drift remains explicitly open
  - Plex/player contracts and pipelines still carry null-contract and overpacked-method debt
  - shared UI owner moves should land before the final naming/test/ceremony passes

## Imported Review Issue Map

This map is exhaustive for the `44` open review issue ids from the refreshed holistic import.

Do not mark a `P#-W#` item complete until each mapped issue id either:

- returns `No open issues matching` under its exact `desloppify show` command, or
- is explicitly dispositioned as `deferred` or `split follow-up` with the exact owner, reason, and revisit trigger required by the execution-hygiene rules below.

### `P1-W1`

- `review::.::holistic::cross_module_architecture::orchestrator_runtime_hub`
- `review::.::holistic::abstraction_fitness::orchestrator_facade_sprawl`

### `P1-W2`

- `review::.::holistic::abstraction_fitness::oversized_runtime_dependency_bags`
- `review::.::holistic::abstraction_fitness::single_impl_interface_ceremony`
- `review::.::holistic::design_coherence::app_orchestrator_remains_multi_hub`

### `P1-W3`

- `review::.::holistic::error_consistency::app_startup_contract_swallowed_failure`
- `review::.::holistic::error_consistency::orchestrator_precondition_strategy_drift`

### `P1-W4`

- `review::.::holistic::high_level_elegance::composition_root_role_drift`
- `review::.::holistic::error_consistency::recovery_warning_paths_drop_error_context`
- `review::.::holistic::test_strategy::orchestrator_module_factory_wiring_gap`

### `P2-W1`

- `review::.::holistic::high_level_elegance::epg_top_level_owner_blur`
- `review::.::holistic::api_surface_coherence::epg_readiness_split_contract`

### `P2-W2`

- `review::.::holistic::mid_level_elegance::epg_coordinator_still_owns_refresh_seam`
- `review::.::holistic::mid_level_elegance::epg_library_filter_rules_split_across_seams`

### `P2-W3`

- `review::.::holistic::initialization_coupling::epg_debug_module_global_runtime`
- `review::.::holistic::type_safety::epg_channel_boundary_widens_known_types`

### `P2-W4`

- `review::.::holistic::low_level_elegance::epg_virtual_render_method_accretion`
- `review::.::holistic::package_organization::epg_flat_directory_overload`

### `P3-W1`

- `review::.::holistic::high_level_elegance::channel_setup_domain_placement_blur`

### `P3-W2`

- `review::.::holistic::design_coherence::channel_setup_build_execution_is_overloaded`
- `review::.::holistic::design_coherence::channel_setup_error_summary_logic_is_duplicated`

### `P3-W3`

- `review::.::holistic::naming_quality::playback_variant_flag_name_drift`
- `review::.::holistic::naming_quality::scroll_to_nearest_fallback_mismatch`
- `review::.::holistic::type_safety::channel_setup_ui_redefines_core_unions`

### `P4-W1`

- `review::.::holistic::cross_module_architecture::storage_owner_boundary_drift`
- `review::.::holistic::incomplete_migration::deprecated_lifecycle_plexauth_slot`

### `P4-W2`

- `review::.::holistic::initialization_coupling::diagnostics_store_scattered_singletons`
- `review::.::holistic::logic_clarity::startup_ui_async_wrapper_drift`

### `P4-W3`

- `review::.::holistic::contract_coherence::plex_auth_stored_credentials_null_hides_corruption`

### `P5-W1`

- `review::.::holistic::api_surface_coherence::server_selection_boolean_semantics_drift`
- `review::.::holistic::contract_coherence::plex_library_null_conflates_not_found_and_invalid_response`

### `P5-W2`

- `review::.::holistic::dependency_health::qrcode_cli_transitives_for_browser_render`
- `review::.::holistic::ai_generated_debt::playback_recovery_diagnostic_narration`

### `P5-W3`

- `review::.::holistic::low_level_elegance::stream_resolution_pipeline_overpacked`
- `review::.::holistic::low_level_elegance::subtitle_fallback_fetch_monolith`
- `review::.::holistic::type_safety::parallel_error_code_enums_duplicate_app_taxonomy`

### `P6-W1`

- `review::.::holistic::convention_outlier::container_id_convention_split`
- `review::.::holistic::naming_quality::get_or_create_div_hidden_cleanup`

### `P6-W2`

- `review::.::holistic::package_organization::theme_definitions_live_under_settings`
- `review::.::holistic::package_organization::ui_root_channel_display_straggler`
- `review::.::holistic::design_coherence::player_timecode_formatting_is_copied_between_overlays`

### `P7-W1`

- `review::.::holistic::convention_outlier::ui_private_member_style_islands`

### `P7-W2`

- `review::.::holistic::test_strategy::keepalive_path_untested`

### `P8-W1`

- `review::.::holistic::ai_generated_debt::systemic_restating_jsdoc`

## Priority Skill Routing

These are the required repo-local boundary skills for the new wave. Load them before writing code for the named priority.

- `P1`: `architecture-boundaries`
- `P2`: `architecture-boundaries`, `ui-composition-patterns`, `persistence-boundaries`
- `P3`: `architecture-boundaries`, `ui-composition-patterns`, `persistence-boundaries`
- `P4`: `architecture-boundaries`, `persistence-boundaries`, `plex-integration-boundaries`
- `P5`: `architecture-boundaries`, `plex-integration-boundaries`
- `P6`: `ui-composition-patterns`; add `architecture-boundaries` when moving shared owners such as theme definitions or app-shell container ids
- `P7`: `ui-composition-patterns`; add `architecture-boundaries` when the keep-alive coverage slice needs a real public seam extraction
- `P8`: load the boundary skill that matches the file family touched by the final ceremony cleanup; default to `ui-composition-patterns`

## Execution Hygiene

- Disposition vocabulary:
  - `resolved`: the exact imported issue, or the slice-owned rationale mapped to it, is retired by the current slice or priority exit, and the closing evidence has been refreshed on current code
  - `deferred`: the issue stays open, but the record names the exact issue id, current owner, reason, and revisit trigger; nothing deferred is implicitly accepted
  - `split follow-up`: the current slice is not the final owner; the remaining gap is handed to one exact successor owner
  - `owned follow-up`: the exact successor owner named by a `split follow-up` record; each split issue must have one single final owner, not shared implicit ownership across multiple `P#-W#` items
  - `security triage`: a fresh `desloppify status` result for the current slice or exit that either says `no open P0 security findings` or lists the exact open/deferred `P0` security issue ids plus reasons and revisit triggers
  - `priority-exit review`: the blocking review run after the last planned `P#-W#` item in a priority and before any `P(n+1)` work, plan, or checklist progress begins
- Issue-envelope ownership rule:
  - for broad imported issues, choose one intended final owner for the remaining live debt when the issue first enters the priority
  - intermediate `P#-W#` slices may retire one mapped sub-claim and add proof, but they should not reassign the same issue envelope again unless the current source audit shows a genuinely different remaining owner or the earlier owner mapping was wrong
  - detector lag alone is not a reason to create a new successor owner
- Source-audit precedence rule:
  - when current-code proof shows that the slice-owned rationale is gone, prefer `resolved` plus a note about stale detector residue over a new `split follow-up`
  - use `split follow-up` only when current-code proof shows a real remaining live gap outside the completed slice
  - if stale detector wording and live residual debt both exist, record them separately so the checklist does not keep re-splitting the entire issue envelope
- Security deferral record format:
  - `issue`: exact `desloppify` issue id or security finding reference
  - `owner`: exact current owner responsible for clearing or revisiting the deferred item
  - `reason`: why it is being deferred instead of resolved now
  - `revisit trigger`: the concrete condition or date that forces re-triage
- Priority exit record format:
  - `mapped imported issues`: every imported issue mapped to the priority, each with its exact issue id and one disposition: `resolved`, `deferred`, or `split follow-up`
  - `follow-up ownership`: for every `deferred` or `split follow-up` item, the exact current owner, reason, and revisit trigger; if an imported issue was mapped across multiple `P#-W#` items, nominate one single final owner here
  - `security triage`: `no open P0 security findings`, or the exact deferred/resolved `P0` security findings blocking next-priority work, with exact issue ids and revisit triggers for anything still open
  - `residuals`: any meaningful debt intentionally left in the priority area, plus its new owner
  - `verification`: exact commands used for the priority-exit review, including `desloppify` evidence refresh and task-specific gates
- Cleanup slice execution template:
  - `priority/work units`: exact `P#-W#` items in scope for this slice
  - `imported review issues`: exact mapped issue ids being retired
  - `security triage`: `no open P0 security findings`, or the deferred/resolved `P0` security findings for this slice with exact issue ids, reasons, and revisit triggers
  - `verification`: exact commands that prove the slice is complete
  - `deferred items`: anything intentionally left open with its exact issue id, owner, reason, and revisit trigger
  - `proof matrix`: for each mapped imported issue, record the exact issue id, whether the slice-owned rationale is retired on current source, whether any live residual debt remains, whether any detector wording is stale, the final owner, and the revisit trigger if anything remains open
- Priority exit command checklist:
  - do not run authoritative `desloppify` evidence commands in worktrees; run them on the target integration branch that will carry the checklist state forward
  - rerun `desloppify status`
  - rerun `desloppify show review --status open --no-budget --top 100`
  - rerun `desloppify show security --status open --no-budget --top 50`
  - rerun every exact mapped `desloppify show "<issue-id>" --status open --no-budget` command for the closing priority
  - rerun the strongest task-specific verification used by the closing work units
  - confirm every mapped imported issue for the priority is either retired here or explicitly deferred/split with an exact owner, reason, and revisit trigger
  - confirm every issue mapped across multiple `P#-W#` items has one single final owner at exit
  - confirm the `P0` security gate is either cleared or explicitly deferred before the next priority begins
  - confirm no `P(n+1)` work, plan, or checklist progress has been opened before this exit record is complete
- Evidence refresh checklist:
  - refresh authoritative `desloppify` evidence on the same integration branch where checklist updates are committed; treat worktree-only output as non-authoritative for checklist and plan dispositions
  - rerun `desloppify status`
  - rerun `desloppify show review --status open --no-budget --top 100`
  - rerun `desloppify show security --status open --no-budget --top 50`
  - refresh hotspot counts with `wc -l` for the files listed in the evidence snapshot when a priority closes or the queue meaningfully shifts
  - update this checklist in the same pass when a priority closes, strict score shifts materially, or the imported review ownership map changes
- Reassignment carry-forward checklist:
  - when any `P#-EXIT` record marks an issue as `deferred` or `split follow-up` with owner `Pn-Wm`, update the destination `Pn-Wm` checklist item in the same pass with an `Inherited follow-ups` block
  - each `Inherited follow-ups` block must include: source exit (`P#-EXIT`), exact issue id(s), disposition (`deferred` or `split follow-up`), and the exact verification command(s) required before closing `Pn-Wm`
  - do not rely on the source exit record alone; the destination work item must be self-sufficient for a fresh session
  - when drafting the destination tracked plan, copy every inherited issue id into the plan evidence and verification section and re-check each id before marking the destination item complete
  - if an inherited issue is re-deferred at destination closeout, record the new single final owner and revisit trigger in that destination exit record
  - if the exact same imported issue would be split forward a second time, stop and resolve whether the earlier owner mapping was wrong or the detector output is simply stale; do not keep chaining routine successor work items for the same issue envelope

## Priority 1: Narrow Runtime Composition Roots And Screen-Facing Ports

- ROI: Highest
- Why it matters: the refreshed queue still flags `AppOrchestrator` as runtime hub, facade sprawl, and multi-hub design drift; the composition root is still leaking feature-specific seams into screens and wide coordinator bags.
- Required skills: `architecture-boundaries`

### Work Units

- [x] `P1-W1` replace direct screen dependencies on `AppOrchestrator` with feature-scoped ports wired from app-shell assembly
  - Imported review issues: `review::.::holistic::cross_module_architecture::orchestrator_runtime_hub`, `review::.::holistic::abstraction_fitness::orchestrator_facade_sprawl`
  - Primary files: `src/Orchestrator.ts`, `src/core/app-shell/AppLazyScreenRegistry.ts`, `src/modules/ui/auth/AuthScreen.ts`, `src/modules/ui/profile-select/ProfileSelectScreen.ts`, `src/modules/ui/server-select/ServerSelectScreen.ts`
  - Minimum verification: `npm run verify`; `desloppify show "review::.::holistic::cross_module_architecture::orchestrator_runtime_hub" --status open --no-budget`; `desloppify show "review::.::holistic::abstraction_fitness::orchestrator_facade_sprawl" --status open --no-budget`
  - Execution (2026-03-27): constructor seams for `AuthScreen`, `ProfileSelectScreen`, and `ServerSelectScreen` now use feature-scoped ports wired in `AppLazyScreenRegistry`; screen and registry seam tests were updated and pass.
  - Verification (2026-03-27): `npm run verify` passed; both mapped `desloppify show` checks still report open after `desloppify scan --force-rescan`.
  - Split follow-up (owner `P1-EXIT`): `review::.::holistic::cross_module_architecture::orchestrator_runtime_hub`; reason: output currently mixes stale constructor evidence (registry->screen constructor path is now ports) with still-live broader debt (`AppOrchestrator` remains a large cross-feature runtime hub); revisit trigger: in `P1-EXIT`, rerun the exact issue-id command and disposition stale constructor wording separately from any remaining runtime-hub debt.
  - Split follow-up (owner `P1-EXIT`): `review::.::holistic::abstraction_fitness::orchestrator_facade_sprawl`; reason: output currently mixes stale constructor evidence (screens no longer accept `AppOrchestrator`) with still-live broad-facade debt at orchestrator scope; revisit trigger: in `P1-EXIT`, rerun the exact issue-id command and disposition stale constructor wording separately from any remaining broad-facade debt.
- [x] `P1-W2` split runtime dependency bags and remove interface ceremony that no longer carries real substitution value
  - Imported review issues: `review::.::holistic::abstraction_fitness::oversized_runtime_dependency_bags`, `review::.::holistic::abstraction_fitness::single_impl_interface_ceremony`, `review::.::holistic::design_coherence::app_orchestrator_remains_multi_hub`
  - Primary files: `src/core/orchestrator/OrchestratorCoordinatorFactory.ts`, `src/core/InitializationCoordinator.ts`, `src/modules/navigation/NavigationCoordinator.ts`, `src/Orchestrator.ts`, `src/modules/ui/channel-number-overlay/interfaces.ts`, `src/modules/ui/channel-badge/interfaces.ts`
  - Minimum verification: `npm run verify`; exact `desloppify show` commands for the three mapped ids
  - Execution (2026-03-27 to 2026-03-28): split runtime dependency bags across navigation, initialization, and orchestrator coordinator assembly; removed single-implementation overlay and orchestrator interface ceremony; extracted schedule day-rollover and subtitle track-recovery policy owners; fixed deferred day-rollover dedupe regression by preserving pending day key while timer is scheduled.
  - Verification (2026-03-28): `npm test -- src/core/orchestrator/__tests__/ScheduleDayRolloverController.test.ts`; `npm test -- src/__tests__/Orchestrator.test.ts src/core/__tests__/ProfileSwitchCleanupController.test.ts`; `npm test -- src/modules/navigation/__tests__/NavigationCoordinator.test.ts`; `npm run verify`; `desloppify show "review::.::holistic::abstraction_fitness::oversized_runtime_dependency_bags" --status open --no-budget`; `desloppify show "review::.::holistic::abstraction_fitness::single_impl_interface_ceremony" --status open --no-budget`; `desloppify show "review::.::holistic::design_coherence::app_orchestrator_remains_multi_hub" --status open --no-budget` (all three issue-id checks still report one open issue).
  - Split follow-up (owner `P1-EXIT`): `review::.::holistic::abstraction_fitness::oversized_runtime_dependency_bags`; reason: major bag splits landed, but review still reports remaining wide constructor contracts and wiring indirection as active debt; revisit trigger: in `P1-EXIT`, rerun the exact issue-id command and disposition remaining role-boundary bag scope for final owner.
  - Split follow-up (owner `P1-EXIT`): `review::.::holistic::abstraction_fitness::single_impl_interface_ceremony`; reason: interface ceremony reductions landed, but review output still reports one open issue and currently includes stale references to removed overlay interface files plus residual interface-layer debt; revisit trigger: in `P1-EXIT`, rerun the exact issue-id command and disposition stale-vs-live evidence before final owner handoff.
  - Split follow-up (owner `P1-EXIT`): `review::.::holistic::design_coherence::app_orchestrator_remains_multi_hub`; reason: day-rollover and subtitle policy owners were extracted, but `AppOrchestrator` still carries multi-domain runtime hub responsibility; revisit trigger: in `P1-EXIT`, rerun the exact issue-id command and disposition remaining multi-hub responsibilities with explicit final owner.
- [x] `P1-W3` normalize startup and precondition failure contracts so bootstrap and public orchestrator APIs follow one observable strategy
  - Imported review issues: `review::.::holistic::error_consistency::app_startup_contract_swallowed_failure`, `review::.::holistic::error_consistency::orchestrator_precondition_strategy_drift`
  - Primary files: `src/App.ts`, `src/bootstrap.ts`, `src/Orchestrator.ts`
  - Minimum verification: `npm run verify`; exact `desloppify show` commands for the two mapped ids
  - Execution (2026-03-28): `App.start()` now rethrows startup failures after best-effort shutdown, `bootstrap()` is now start-or-throw while wrapper entrypoints (`DOMContentLoaded`, immediate start, `pageshow`) are the sole fatal presenters that reset app/debug state and show the global fatal overlay, and public auth/discovery/start precondition throws in `AppOrchestrator` now use one AppError-shaped contract (`code: MODULE_INIT_FAILED`, `recoverable: true`, `context`).
  - Verification (2026-03-28): `npm test -- src/__tests__/bootstrap.test.ts`; `npm test -- src/__tests__/orchestrator/playback-flow.test.ts`; `npm test -- src/__tests__/orchestrator/orchestrator-preconditions.test.ts`; `npm test -- src/__tests__/App.test.ts`; `npm run verify`; `desloppify scan --force-rescan --attest "I understand this is not the intended workflow and I am intentionally skipping queue completion"`; `desloppify show "review::.::holistic::error_consistency::app_startup_contract_swallowed_failure" --status open --no-budget`; `desloppify show "review::.::holistic::error_consistency::orchestrator_precondition_strategy_drift" --status open --no-budget` (both issue-id checks still report one open issue).
  - Split follow-up (owner `P1-EXIT`): `review::.::holistic::error_consistency::app_startup_contract_swallowed_failure`; reason: post-change detector output still reports stale evidence describing pre-fix behavior (`App.start()` swallowing failures and `bootstrap()` always logging success), so priority exit must rerun and disposition stale-vs-live evidence on current scan output before final closeout; revisit trigger: in `P1-EXIT`, rerun the exact issue-id command and confirm refreshed evidence reflects the rethrow + wrapper-owned fatal presentation contract.
  - Split follow-up (owner `P1-EXIT`): `review::.::holistic::error_consistency::orchestrator_precondition_strategy_drift`; reason: `P1-W3` intentionally preserved the tested safe no-op contract for `switchToChannel*` while normalizing auth/discovery/start precondition throws, so the broad detector id remains open until priority-exit adjudication resolves the intentional mixed-contract boundary; revisit trigger: in `P1-EXIT`, rerun the exact issue-id command and record whether the remaining signal is accepted as intentional contract split or requires additional narrowing.
- [x] `P1-W4` close runtime composition-root drift with wiring-focused coverage and explicit error-context preservation
  - Imported review issues: `review::.::holistic::high_level_elegance::composition_root_role_drift`, `review::.::holistic::error_consistency::recovery_warning_paths_drop_error_context`, `review::.::holistic::test_strategy::orchestrator_module_factory_wiring_gap`
  - Primary files: `src/core/orchestrator/SubtitleTrackRecoveryController.ts`, `src/core/orchestrator/OrchestratorModuleFactory.ts`, `src/__tests__/orchestrator/orchestrator-module-factory-wiring.test.ts`, `src/__tests__/orchestrator/subtitle-track-recovery-warning-contract.test.ts`, `src/__tests__/startup-integration.test.ts`
  - Minimum verification: `npm run verify`; exact `desloppify show` commands for the three mapped ids
  - Execution (2026-03-28): added `createOrchestratorModules` wiring coverage in `src/__tests__/orchestrator/orchestrator-module-factory-wiring.test.ts`, added focused resolved-failure warning coverage in `src/__tests__/orchestrator/subtitle-track-recovery-warning-contract.test.ts`, and removed context-dropping `.catch(() => warn...)` branches from `SubtitleTrackRecoveryController` while preserving existing user-facing warning messages and no controller-side logging.
  - Verification (2026-03-28): `npm test -- src/__tests__/orchestrator/orchestrator-module-factory-wiring.test.ts`; `npm test -- src/__tests__/orchestrator/subtitle-track-recovery-warning-contract.test.ts`; `npm test -- src/__tests__/startup-integration.test.ts`; `npm run verify`; `desloppify scan --force-rescan --attest "I understand this is not the intended workflow and I am intentionally skipping queue completion"`; `desloppify show "review::.::holistic::high_level_elegance::composition_root_role_drift" --status open --no-budget`; `desloppify show "review::.::holistic::error_consistency::recovery_warning_paths_drop_error_context" --status open --no-budget`; `desloppify show "review::.::holistic::test_strategy::orchestrator_module_factory_wiring_gap" --status open --no-budget` (all three issue-id checks still report one open issue).
  - Split follow-up (owner `P1-EXIT`): `review::.::holistic::high_level_elegance::composition_root_role_drift`; reason: this bounded slice intentionally avoided a broad `AppOrchestrator` ownership split and the detector still reports live composition-root role breadth; revisit trigger: in `P1-EXIT`, rerun the exact issue-id command and disposition the remaining orchestrator role-drift debt with one final owner.
  - Split follow-up (owner `P1-EXIT`): `review::.::holistic::error_consistency::recovery_warning_paths_drop_error_context`; reason: `SubtitleTrackRecoveryController` no longer contains the context-dropping `catch(() => warn...)` branches, but the detector output still cites the pre-refactor `Orchestrator` evidence; revisit trigger: in `P1-EXIT`, rerun the exact issue-id command and disposition stale-vs-live recovery-warning evidence against current code.
  - Split follow-up (owner `P1-EXIT`): `review::.::holistic::test_strategy::orchestrator_module_factory_wiring_gap`; reason: targeted `createOrchestratorModules` wiring coverage was added, but the detector output still reports no direct factory test evidence; revisit trigger: in `P1-EXIT`, rerun the exact issue-id command and disposition stale-vs-live wiring-coverage evidence against current test inventory.
- [x] `P1-W5` finish runtime-root and facade narrowing for `AppOrchestrator` consumer seams
  - Imported review issues: `review::.::holistic::cross_module_architecture::orchestrator_runtime_hub`, `review::.::holistic::abstraction_fitness::orchestrator_facade_sprawl`, `review::.::holistic::design_coherence::app_orchestrator_remains_multi_hub`, `review::.::holistic::high_level_elegance::composition_root_role_drift`
  - Primary files: `src/Orchestrator.ts`, `src/App.ts`, `src/core/app-shell/AppLazyScreenRegistry.ts`
  - Minimum verification: `npm run verify`; exact `desloppify show` commands for the four mapped ids
  - Execution (2026-03-28): narrowed `AppLazyScreenRegistry` from `getOrchestrator(): AppOrchestrator | null` to `getRuntimeFacade(): AppLazyScreenRegistryRuntimeFacade | null`; `App.ts` remains the sole concrete `AppOrchestrator` owner and now provides the bounded lazy-screen facade; screen constructor contracts stayed unchanged.
  - Verification (2026-03-28): `npm test -- src/core/app-shell/__tests__/AppLazyScreenRegistry.test.ts`; `npm test -- src/__tests__/App.test.ts`; `npm run verify`; `desloppify show "review::.::holistic::cross_module_architecture::orchestrator_runtime_hub" --status open --no-budget`; `desloppify show "review::.::holistic::abstraction_fitness::orchestrator_facade_sprawl" --status open --no-budget`; `desloppify show "review::.::holistic::design_coherence::app_orchestrator_remains_multi_hub" --status open --no-budget`; `desloppify show "review::.::holistic::high_level_elegance::composition_root_role_drift" --status open --no-budget` (all four issue-id checks still report one open issue).
  - Post-change proof matrix (2026-03-28):
    - `review::.::holistic::cross_module_architecture::orchestrator_runtime_hub` -> `split follow-up` -> final owner `P1-EXIT`; proof: `AppLazyScreenRegistry` no longer imports `AppOrchestrator` and now consumes a bounded runtime facade (`src/core/app-shell/AppLazyScreenRegistry.ts`), but detector still reports cross-feature runtime-hub debt centered in `src/Orchestrator.ts`; revisit trigger: rerun `desloppify show "review::.::holistic::cross_module_architecture::orchestrator_runtime_hub" --status open --no-budget` during `P1-EXIT`.
    - `review::.::holistic::abstraction_fitness::orchestrator_facade_sprawl` -> `split follow-up` -> final owner `P1-EXIT`; proof: registry/screen construction now binds to `AppLazyScreenRegistryRuntimeFacade` instead of a direct orchestrator type (`src/core/app-shell/AppLazyScreenRegistry.ts`, `src/App.ts`), while detector still reports broad orchestrator facade scope in `src/Orchestrator.ts`; revisit trigger: rerun `desloppify show "review::.::holistic::abstraction_fitness::orchestrator_facade_sprawl" --status open --no-budget` during `P1-EXIT`.
    - `review::.::holistic::design_coherence::app_orchestrator_remains_multi_hub` -> `split follow-up` -> final owner `P1-EXIT`; proof: this slice narrowed one app-shell seam only and intentionally left `AppOrchestrator` responsibility breadth untouched (`src/Orchestrator.ts`); revisit trigger: rerun `desloppify show "review::.::holistic::design_coherence::app_orchestrator_remains_multi_hub" --status open --no-budget` during `P1-EXIT`.
    - `review::.::holistic::high_level_elegance::composition_root_role_drift` -> `split follow-up` -> final owner `P1-EXIT`; proof: `App.ts` is now the single concrete orchestrator owner and passes a bounded facade to lazy-screen assembly (`src/App.ts`, `src/core/app-shell/AppLazyScreenRegistry.ts`), but composition-root drift still remains at orchestrator scope per current detector output; revisit trigger: rerun `desloppify show "review::.::holistic::high_level_elegance::composition_root_role_drift" --status open --no-budget` during `P1-EXIT`.
  - Inherited follow-ups:
    - Source `P1-EXIT` disposition `split follow-up`: `review::.::holistic::cross_module_architecture::orchestrator_runtime_hub`; required verification command: `desloppify show "review::.::holistic::cross_module_architecture::orchestrator_runtime_hub" --status open --no-budget`
    - Source `P1-EXIT` disposition `split follow-up`: `review::.::holistic::abstraction_fitness::orchestrator_facade_sprawl`; required verification command: `desloppify show "review::.::holistic::abstraction_fitness::orchestrator_facade_sprawl" --status open --no-budget`
    - Source `P1-EXIT` disposition `split follow-up`: `review::.::holistic::design_coherence::app_orchestrator_remains_multi_hub`; required verification command: `desloppify show "review::.::holistic::design_coherence::app_orchestrator_remains_multi_hub" --status open --no-budget`
    - Source `P1-EXIT` disposition `split follow-up`: `review::.::holistic::high_level_elegance::composition_root_role_drift`; required verification command: `desloppify show "review::.::holistic::high_level_elegance::composition_root_role_drift" --status open --no-budget`
- [x] `P1-W6` finish initialization and composition-bag narrowing
  - Imported review issues: `review::.::holistic::abstraction_fitness::oversized_runtime_dependency_bags`, `review::.::holistic::abstraction_fitness::single_impl_interface_ceremony`
  - Primary files: `src/core/InitializationCoordinator.ts`, `src/core/orchestrator/OrchestratorCoordinatorFactory.ts`
  - Conditional evidence-only file: `src/modules/navigation/NavigationCoordinator.ts` (promote to implementation scope only if fresh proof shows residual live bag debt there)
  - Minimum verification: `npm run verify`; exact `desloppify show` commands for the two mapped ids
  - Execution (2026-03-28): narrowed `createOrchestratorCoordinators` init coupling from `getInitCoordinator()` to one null-safe `ensureEpgInitialized(): Promise<void>` closure; extracted modal/post-ready overlay initialization (`nowPlayingInfo`, `playbackOptions`, `exitConfirm`) into concrete `InitializationUiInitializer` while keeping Phase 4 overlays in `InitializationDependencies`.
  - Promotion gate decision (2026-03-28): `NavigationCoordinator.ts` stayed out of scope because the refreshed detector evidence stayed broad/runtime-general and did not provide a bounded initialization/composition-bag narrowing sub-claim that could be cleanly retired in this slice alone.
  - Verification (2026-03-28): `npm test -- src/core/__tests__/InitializationCoordinator.test.ts`; `npm test -- src/core/orchestrator/__tests__/OrchestratorCoordinatorFactory.playbackState.test.ts`; `npm test -- src/__tests__/Orchestrator.test.ts`; `npm run verify`; `desloppify show "review::.::holistic::abstraction_fitness::oversized_runtime_dependency_bags" --status open --no-budget`; `desloppify show "review::.::holistic::abstraction_fitness::single_impl_interface_ceremony" --status open --no-budget` (both issue-id checks still report one open issue).
  - Split follow-up (owner `P1-EXIT`): `review::.::holistic::abstraction_fitness::oversized_runtime_dependency_bags`; reason: this slice retired the targeted initialization/coordinator seams, but the detector still reports a broader remaining envelope spanning `NavigationCoordinator` + residual factory wiring-bag breadth; revisit trigger: in `P1-EXIT`, rerun the exact issue-id command and disposition stale-vs-live evidence with one final owner for any remaining live residual.
  - Split follow-up (owner `P1-EXIT`): `review::.::holistic::abstraction_fitness::single_impl_interface_ceremony`; reason: `P1-W6` intentionally kept to initialization/composition-bag narrowing and did not claim the remaining overlay/interface ceremony debt outside this seam; revisit trigger: in `P1-EXIT`, rerun the exact issue-id command and disposition stale-vs-live ceremony evidence with one final owner for any residual live debt.
  - Inherited follow-ups:
    - Source `P1-EXIT` disposition `split follow-up`: `review::.::holistic::abstraction_fitness::oversized_runtime_dependency_bags`; required verification command: `desloppify show "review::.::holistic::abstraction_fitness::oversized_runtime_dependency_bags" --status open --no-budget`
    - Source `P1-EXIT` disposition `split follow-up`: `review::.::holistic::abstraction_fitness::single_impl_interface_ceremony`; required verification command: `desloppify show "review::.::holistic::abstraction_fitness::single_impl_interface_ceremony" --status open --no-budget`
- [ ] `P1-EXIT` run the priority-exit review before moving to `P2`
  - required: record every mapped imported issue with an exact disposition
  - Gate: no `P2` plan, code, or checklist progress starts until every `P1` mapped id has an explicit disposition record
  - Required verification: `desloppify status`; `desloppify show review --status open --no-budget --top 100`; `desloppify show security --status open --no-budget --top 50`; all ten exact `P1` issue-id checks; `npm run verify`
  - Evidence refresh (2026-03-28):
    - `desloppify status`
    - `desloppify show review --status open --no-budget --top 100`
    - `desloppify show security --status open --no-budget --top 50` (no open security issues)
    - all ten exact `P1` issue-id checks listed in this item (each still reports one open issue)
  - Source-proof matrix (current code audit, 2026-03-28):
    - `review::.::holistic::cross_module_architecture::orchestrator_runtime_hub` -> `split follow-up` -> owner `P1-W5`; proof: screen constructors use ports now, but `AppLazyScreenRegistry` still depends on `AppOrchestrator` and detector still flags runtime-root breadth (`src/core/app-shell/AppLazyScreenRegistry.ts`, `src/Orchestrator.ts`)
    - `review::.::holistic::abstraction_fitness::orchestrator_facade_sprawl` -> `split follow-up` -> owner `P1-W5`; proof: stale constructor-specific evidence is gone, but broad orchestrator facade pressure remains (`src/Orchestrator.ts`, `src/core/app-shell/AppLazyScreenRegistry.ts`)
    - `review::.::holistic::abstraction_fitness::oversized_runtime_dependency_bags` -> `split follow-up` -> owner `P1-EXIT`; proof: `P1-W6` narrowed the init-coupling + modal initializer seams (`src/core/orchestrator/OrchestratorCoordinatorFactory.ts`, `src/core/InitializationCoordinator.ts`, `src/core/initialization/InitializationUiInitializer.ts`), but detector output still reports a broader envelope including navigation/runtime bag breadth
    - `review::.::holistic::abstraction_fitness::single_impl_interface_ceremony` -> `split follow-up` -> owner `P1-EXIT`; proof: `P1-W6` remained scoped to initialization/composition-bag narrowing and detector output still reports interface-ceremony residuals outside this slice
    - `review::.::holistic::design_coherence::app_orchestrator_remains_multi_hub` -> `split follow-up` -> owner `P1-W5`; proof: runtime policies were extracted, but orchestrator still carries broad runtime-hub responsibilities (`src/Orchestrator.ts`)
    - `review::.::holistic::error_consistency::app_startup_contract_swallowed_failure` -> `resolved` -> owner `P1-EXIT`; proof: `App.start()` rethrows and `bootstrap()` logs success only after awaited completion (`src/App.ts`, `src/bootstrap.ts`)
    - `review::.::holistic::error_consistency::orchestrator_precondition_strategy_drift` -> `deferred` -> owner `P1-EXIT`; proof: auth/discovery/start entry points throw AppError-shaped precondition errors while `switchToChannel*` intentionally remains safe no-op for absent tuning modules (`src/Orchestrator.ts`)
    - `review::.::holistic::high_level_elegance::composition_root_role_drift` -> `split follow-up` -> owner `P1-W5`; proof: composition-root breadth remains live and should close with runtime-root/facade narrowing (`src/Orchestrator.ts`, `src/App.ts`)
    - `review::.::holistic::error_consistency::recovery_warning_paths_drop_error_context` -> `resolved` -> owner `P1-EXIT`; proof: context-dropping `.catch(() => warn...)` branches are absent from current recovery controller (`src/core/orchestrator/SubtitleTrackRecoveryController.ts`)
    - `review::.::holistic::test_strategy::orchestrator_module_factory_wiring_gap` -> `resolved` -> owner `P1-EXIT`; proof: direct factory wiring test exists (`src/__tests__/orchestrator/orchestrator-module-factory-wiring.test.ts`)
  - Follow-up ownership and revisit triggers:
    - `split follow-up` to `P1-W5`: `review::.::holistic::cross_module_architecture::orchestrator_runtime_hub`, `review::.::holistic::abstraction_fitness::orchestrator_facade_sprawl`, `review::.::holistic::design_coherence::app_orchestrator_remains_multi_hub`, `review::.::holistic::high_level_elegance::composition_root_role_drift`; reason: same runtime-root/facade seam remains live; revisit trigger: rerun each exact issue-id command at `P1-W5` closeout and retire or re-defer with one final owner
    - `split follow-up` under `P1-EXIT`: `review::.::holistic::abstraction_fitness::oversized_runtime_dependency_bags`, `review::.::holistic::abstraction_fitness::single_impl_interface_ceremony`; reason: `P1-W6` narrowed its planned seam but both detector ids still report one open broad envelope; revisit trigger: rerun each exact issue-id command during priority-exit review, separate stale detector residue from live residual debt, and keep one final owner for anything still live
    - `deferred` under `P1-EXIT`: `review::.::holistic::error_consistency::orchestrator_precondition_strategy_drift`; reason: current throw vs safe-noop split is intentional and test-covered; revisit trigger: if the exact issue-id check still reports broader non-channel drift after `P1-W6`, convert to `split follow-up` owned by `P1-W6` before closing `P1-EXIT`
  - Exit state: `P1-EXIT` remains open until priority-exit review dispositions are finalized for all mapped `P1` issue ids on current evidence.

## Priority 2: Consolidate EPG Ownership, Runtime State, And Readiness Contracts

- ROI: Highest after `P1`
- Why it matters: the refreshed queue still clusters EPG debt around overlapping owners, split readiness, refresh-seam blur, module-global runtime state, widened types, and a still-flat package shape.
- Required skills: `architecture-boundaries`, `ui-composition-patterns`, `persistence-boundaries`

### Work Units

- [ ] `P2-W1` choose one top-level EPG owner surface and one readiness contract
  - Imported review issues: `review::.::holistic::high_level_elegance::epg_top_level_owner_blur`, `review::.::holistic::api_surface_coherence::epg_readiness_split_contract`
  - Primary files: `src/modules/ui/epg/EPGCoordinator.ts`, `src/modules/ui/epg/interfaces.ts`, `src/modules/ui/epg/DeferredEpgComponent.ts`, `src/core/orchestrator/OrchestratorCoordinatorFactory.ts`
  - Minimum verification: `npm run verify`; exact `desloppify show` commands for the two mapped ids
- [ ] `P2-W2` move refresh orchestration and library-filter normalization behind one explicit EPG runtime seam
  - Imported review issues: `review::.::holistic::mid_level_elegance::epg_coordinator_still_owns_refresh_seam`, `review::.::holistic::mid_level_elegance::epg_library_filter_rules_split_across_seams`
  - Primary files: `src/modules/ui/epg/EPGCoordinator.ts`, `src/modules/ui/epg/EPGScheduleRefreshRuntime.ts`, `src/modules/ui/epg/EPGCoordinatorPolicies.ts`
  - Minimum verification: `npm run verify`; exact `desloppify show` commands for the two mapped ids
- [ ] `P2-W3` replace hidden EPG runtime globals with explicit owner state and restore narrow shared types at the boundary
  - Imported review issues: `review::.::holistic::initialization_coupling::epg_debug_module_global_runtime`, `review::.::holistic::type_safety::epg_channel_boundary_widens_known_types`
  - Primary files: `src/modules/ui/epg/utils.ts`, `src/modules/ui/epg/EPGCoordinator.ts`, `src/modules/ui/epg/domainTypes.ts`, `src/modules/ui/epg/adapters.ts`, `src/modules/scheduler/channel-manager/types.ts`
  - Minimum verification: `npm run verify`; exact `desloppify show` commands for the two mapped ids
- [ ] `P2-W4` split the EPG render/data package surface so view, runtime, and model owners stop accreting together
  - Imported review issues: `review::.::holistic::low_level_elegance::epg_virtual_render_method_accretion`, `review::.::holistic::package_organization::epg_flat_directory_overload`
  - Primary files: `src/modules/ui/epg/EPGVirtualizer.ts`, `src/modules/ui/epg/`
  - Minimum verification: `npm run verify`; exact `desloppify show` commands for the two mapped ids
- [ ] `P2-EXIT` run the priority-exit review before moving to `P3`
  - required: record every mapped imported issue with an exact disposition
  - Gate: no `P3` plan, code, or checklist progress starts until every `P2` mapped id has an explicit disposition record
  - Required verification: `desloppify status`; `desloppify show review --status open --no-budget --top 100`; `desloppify show security --status open --no-budget --top 50`; all eight exact `P2` issue-id checks; `npm run verify`

## Priority 3: Realign Channel-Setup Ownership And Remove Duplicated Flow Contracts

- ROI: High
- Why it matters: channel setup is still split between `core` assembly and feature-heavy workflow ownership, and the refreshed queue still calls out duplicated flow logic, naming drift, and re-declared UI unions.
- Required skills: `architecture-boundaries`, `ui-composition-patterns`, `persistence-boundaries`

### Work Units

- [ ] `P3-W1` choose one owner for channel-setup workflow and reduce the gateway seam to thin assembly
  - Imported review issues: `review::.::holistic::high_level_elegance::channel_setup_domain_placement_blur`
  - Primary files: `src/core/channel-setup/ChannelSetupCoordinator.ts`, `src/core/channel-setup/ChannelSetupSessionGateway.ts`, `src/core/channel-setup/createChannelSetupSessionGateway.ts`, `src/modules/ui/channel-setup/ChannelSetupSessionController.ts`
  - Minimum verification: `npm run verify`; exact `desloppify show` command for the mapped id
- [ ] `P3-W2` split overloaded build execution and deduplicate error-summary policy inside channel setup
  - Imported review issues: `review::.::holistic::design_coherence::channel_setup_build_execution_is_overloaded`, `review::.::holistic::design_coherence::channel_setup_error_summary_logic_is_duplicated`
  - Primary files: `src/core/channel-setup/ChannelSetupBuildExecutor.ts`, `src/core/channel-setup/ChannelSetupPlanningService.ts`, `src/modules/ui/channel-setup/`
  - Minimum verification: `npm run verify`; exact `desloppify show` commands for the two mapped ids
- [ ] `P3-W3` align channel-setup names and UI state types to the domain contracts they already mirror
  - Imported review issues: `review::.::holistic::naming_quality::playback_variant_flag_name_drift`, `review::.::holistic::naming_quality::scroll_to_nearest_fallback_mismatch`, `review::.::holistic::type_safety::channel_setup_ui_redefines_core_unions`
  - Primary files: `src/core/channel-setup/ChannelSetupPlanner.ts`, `src/core/channel-setup/types.ts`, `src/modules/ui/channel-setup/ChannelSetupSessionController.ts`, `src/modules/ui/channel-setup/steps/types.ts`, `src/modules/ui/channel-setup/focus/scrollToNearest.ts`, `src/modules/scheduler/channel-manager/types.ts`
  - Minimum verification: `npm run verify`; exact `desloppify show` commands for the three mapped ids
- [ ] `P3-EXIT` run the priority-exit review before moving to `P4`
  - required: record every mapped imported issue with an exact disposition
  - Gate: no `P4` plan, code, or checklist progress starts until every `P3` mapped id has an explicit disposition record
  - Required verification: `desloppify status`; `desloppify show review --status open --no-budget --top 100`; `desloppify show security --status open --no-budget --top 50`; all six exact `P3` issue-id checks; `npm run verify`

## Priority 4: Tighten Persistence, Lifecycle, And Diagnostics Ownership

- ROI: High
- Why it matters: storage-owner drift is still open after wave 2, lifecycle still keeps a deprecated Plex-auth slot visible, diagnostics lifetimes are still hidden behind module-scope instances, and startup ownership still carries misleading async wrappers.
- Required skills: `architecture-boundaries`, `persistence-boundaries`, `plex-integration-boundaries`

### Work Units

- [ ] `P4-W1` retire remaining raw storage-owner drift and remove deprecated lifecycle/auth schema carry-forward
  - Imported review issues: `review::.::holistic::cross_module_architecture::storage_owner_boundary_drift`, `review::.::holistic::incomplete_migration::deprecated_lifecycle_plexauth_slot`
  - Primary files: `src/modules/ui/epg/EPGCoordinatorPolicies.ts`, `src/core/orchestrator/OrchestratorCoordinatorFactory.ts`, `src/modules/player/AudioTrackManager.ts`, `src/modules/lifecycle/StateManager.ts`, `docs/architecture/CURRENT_STATE.md`
  - Minimum verification: `npm run verify`; exact `desloppify show` commands for the two mapped ids
- [ ] `P4-W2` centralize diagnostics ownership and remove misleading startup async wrappers
  - Imported review issues: `review::.::holistic::initialization_coupling::diagnostics_store_scattered_singletons`, `review::.::holistic::logic_clarity::startup_ui_async_wrapper_drift`
  - Primary files: `src/Orchestrator.ts`, `src/modules/player/PlaybackRecoveryManager.ts`, `src/core/channel-tuning/ChannelTuningCoordinator.ts`, `src/modules/ui/epg/EPGCoordinator.ts`, `src/modules/ui/epg/EPGScheduleRefreshRuntime.ts`, `src/core/InitializationCoordinator.ts`
  - Minimum verification: `npm run verify`; exact `desloppify show` commands for the two mapped ids
- [ ] `P4-W3` make corrupted stored Plex auth observable instead of silently folding it into clean absence
  - Imported review issues: `review::.::holistic::contract_coherence::plex_auth_stored_credentials_null_hides_corruption`
  - Primary files: `src/modules/plex/auth/PlexAuth.ts`, `src/modules/plex/auth/interfaces.ts`
  - Minimum verification: `npm run verify`; exact `desloppify show` command for the mapped id
- [ ] `P4-EXIT` run the priority-exit review before moving to `P5`
  - required: record every mapped imported issue with an exact disposition
  - Gate: no `P5` plan, code, or checklist progress starts until every `P4` mapped id has an explicit disposition record
  - Required verification: `desloppify status`; `desloppify show review --status open --no-budget --top 100`; `desloppify show security --status open --no-budget --top 50`; all five exact `P4` issue-id checks; `npm run verify`

## Priority 5: Normalize Plex And Player Contracts, Dependencies, And Pipelines

- ROI: High
- Why it matters: the refreshed queue still calls out null-contract ambiguity, server-selection semantics drift, browser-inappropriate auth dependencies, recovery-noise narration, and overpacked stream/subtitle pipelines.
- Required skills: `architecture-boundaries`, `plex-integration-boundaries`

### Work Units

- [ ] `P5-W1` normalize library and server-selection contracts so boolean and null results mean one thing at each boundary
  - Imported review issues: `review::.::holistic::api_surface_coherence::server_selection_boolean_semantics_drift`, `review::.::holistic::contract_coherence::plex_library_null_conflates_not_found_and_invalid_response`
  - Primary files: `src/modules/plex/discovery/PlexServerDiscovery.ts`, `src/Orchestrator.ts`, `src/modules/ui/server-select/ServerSelectScreen.ts`, `src/modules/plex/library/PlexLibrary.ts`, `src/modules/plex/library/interfaces.ts`
  - Minimum verification: `npm run verify`; exact `desloppify show` commands for the two mapped ids
- [ ] `P5-W2` slim auth-path dependencies and reduce recovery narration to intentional diagnostics only
  - Imported review issues: `review::.::holistic::dependency_health::qrcode_cli_transitives_for_browser_render`, `review::.::holistic::ai_generated_debt::playback_recovery_diagnostic_narration`
  - Primary files: `package.json`, `package-lock.json`, `src/modules/ui/auth/AuthScreen.ts`, `src/modules/player/PlaybackRecoveryManager.ts`
  - Minimum verification: `npm run verify`; exact `desloppify show` commands for the two mapped ids
- [ ] `P5-W3` split overpacked stream and subtitle fallback pipelines and stop duplicating shared app-error taxonomies
  - Imported review issues: `review::.::holistic::low_level_elegance::stream_resolution_pipeline_overpacked`, `review::.::holistic::low_level_elegance::subtitle_fallback_fetch_monolith`, `review::.::holistic::type_safety::parallel_error_code_enums_duplicate_app_taxonomy`
  - Primary files: `src/modules/plex/stream/PlexStreamResolver.ts`, `src/modules/player/SubtitleManager.ts`, `src/types/app-errors.ts`, `src/modules/player/types.ts`, `src/modules/plex/library/types.ts`, `src/modules/plex/stream/types.ts`
  - Minimum verification: `npm run verify`; exact `desloppify show` commands for the three mapped ids
- [ ] `P5-EXIT` run the priority-exit review before moving to `P6`
  - required: record every mapped imported issue with an exact disposition
  - Gate: no `P6` plan, code, or checklist progress starts until every `P5` mapped id has an explicit disposition record
  - Required verification: `desloppify status`; `desloppify show review --status open --no-budget --top 100`; `desloppify show security --status open --no-budget --top 50`; all eight exact `P5` issue-id checks; `npm run verify`

## Priority 6: Finish Shared UI Owner Placement And Package Cleanup

- ROI: Last architecture-heavy owner move
- Why it matters: the refreshed queue still retains container-id drift, hidden-cleanup helper naming, and shared UI owner/package stragglers that should settle before the final naming/test/ceremony passes.
- Required skills: `ui-composition-patterns`; add `architecture-boundaries` when moving shared owners

### Work Units

- [ ] `P6-W1` centralize app-shell container ids and make destructive DOM normalization helpers explicit
  - Imported review issues: `review::.::holistic::convention_outlier::container_id_convention_split`, `review::.::holistic::naming_quality::get_or_create_div_hidden_cleanup`
  - Primary files: `src/core/app-shell/AppContainerFactory.ts`, `src/App.ts`, `src/modules/ui/common/appShellContainerIds.ts`
  - Minimum verification: `npm run verify`; exact `desloppify show` commands for the two mapped ids
- [ ] `P6-W2` move shared UI metadata and helper code under the packages that actually own them
  - Imported review issues: `review::.::holistic::package_organization::theme_definitions_live_under_settings`, `review::.::holistic::package_organization::ui_root_channel_display_straggler`, `review::.::holistic::design_coherence::player_timecode_formatting_is_copied_between_overlays`
  - Primary files: `src/modules/ui/settings/theme.ts`, `src/modules/ui/theme/ThemeManager.ts`, `src/modules/ui/channelDisplay.ts`, `src/modules/ui/common/`, player overlay surfaces
  - Minimum verification: `npm run verify`; exact `desloppify show` commands for the three mapped ids
- [ ] `P6-EXIT` run the priority-exit review before moving to `P7`
  - required: record every mapped imported issue with an exact disposition
  - Gate: no `P7` plan, code, or checklist progress starts until every `P6` mapped id has an explicit disposition record
  - Required verification: `desloppify status`; `desloppify show review --status open --no-budget --top 100`; `desloppify show security --status open --no-budget --top 50`; all five exact `P6` issue-id checks; `npm run verify`

## Priority 7: Finish Remaining UI Naming Drift And Player Safeguard Coverage

- ROI: Low
- Why it matters: the remaining open issues here are bounded but still worth closing before the final ceremony pass so naming/style cleanup and keep-alive coverage do not get mixed into owner-moving work.
- Required skills: `ui-composition-patterns`; add `architecture-boundaries` if the keep-alive coverage slice needs a real public seam extraction

### Work Units

- [ ] `P7-W1` normalize remaining UI private-member style islands once the shared-owner moves are stable
  - Imported review issues: `review::.::holistic::convention_outlier::ui_private_member_style_islands`
  - Primary files: `src/modules/ui/epg/EPGLibraryTabs.ts`, `src/modules/ui/now-playing-info/NowPlayingInfoOverlay.ts`, `src/modules/ui/channel-number-overlay/ChannelNumberOverlay.ts`, `src/modules/ui/playback-options/PlaybackOptionsCoordinator.ts`
  - Minimum verification: `npm run verify`; exact `desloppify show` command for the mapped id
- [ ] `P7-W2` add durable coverage for player keep-alive behavior
  - Imported review issues: `review::.::holistic::test_strategy::keepalive_path_untested`
  - Primary files: `src/modules/player/KeepAliveManager.ts`, `src/modules/player/VideoPlayer.ts`
  - Minimum verification: `npm run verify`; exact `desloppify show` command for the mapped id
- [ ] `P7-EXIT` run the priority-exit review before moving to `P8`
  - required: record every mapped imported issue with an exact disposition
  - Gate: no `P8` plan, code, or checklist progress starts until every `P7` mapped id has an explicit disposition record
  - Required verification: `desloppify status`; `desloppify show review --status open --no-budget --top 100`; `desloppify show security --status open --no-budget --top 50`; all two exact `P7` issue-id checks; `npm run verify`

## Priority 8: Remove Remaining Ceremony Residue And Close The Wave

- ROI: Final polish
- Why it matters: systemic restating JSDoc is intentionally last so comment cleanup happens against the settled owner map instead of being invalidated by later refactors.
- Required skills: match the touched file family; default to `ui-composition-patterns` for UI-heavy cleanup

### Work Units

- [ ] `P8-W1` remove systemic restating JSDoc and template residue without deleting comments that carry real boundary rules
  - Imported review issues: `review::.::holistic::ai_generated_debt::systemic_restating_jsdoc`
  - Primary files: high-noise production files touched by the current wave, including `src/config/storageKeys.ts`, `src/modules/ui/epg/EPGTimeHeader.ts`, `src/modules/ui/settings/SettingsToggle.ts`, `src/modules/ui/epg/utils.ts`
  - Minimum verification: `npm run verify`; exact `desloppify show` command for the mapped id
- [ ] `P8-EXIT` run the final priority-exit review before declaring this wave complete
  - required: record every mapped imported issue with an exact disposition
  - Gate: this checklist is not complete until every one of the `44` imported review issue ids listed above has a final disposition record
  - Required verification: `desloppify status`; `desloppify show review --status open --no-budget --top 100`; `desloppify show security --status open --no-budget --top 50`; the exact `P8-W1` issue-id check; `npm run verify`; `npm run verify:docs`; `npm run plans:check`

## Closeout Rules For This Checklist

- Do not close a priority after one bounded extraction if meaningful debt in that same priority area is still known to remain.
- Treat `P#-EXIT` as a required gate, not optional polish: do not start, plan, or mark progress on `P(n+1)` work until the current priority's `P#-EXIT` record is complete.
- If `P#-EXIT` itself must be deferred, record that deferral inside the `P#-EXIT` item with exact blocking issue ids, a single current owner, a reason, and a revisit trigger.
- Do not mint new multi-session work plans from lower priorities until a higher-priority blocker is resolved, explicitly deprioritized, or accepted as deferred.
- Do not bypass the `P0` security triage gate just because a lower-numbered cleanup priority is next in sequence.
- Do not mark a mapped `P#-W#` item complete while its linked imported review issue still remains open unless the remaining gap is explicitly documented as deferred or intentionally split into a follow-up work unit.
- Mark a mapped `P#-W#` item complete in the same pass once the implementation for that slice has landed, the slice verification has been rerun, and every linked imported review issue is now either retired on current evidence or explicitly recorded there as `deferred`/`split follow-up` with one exact owner, reason, and revisit trigger.
- A mapped `P#-W#` item may mark an imported issue `resolved` when current-code proof shows that the slice-owned rationale is gone, even if the exact detector id still prints stale or broader wording; in that case record the stale detector residue and the established final owner for any still-live residual instead of creating a fresh follow-up by default.
- Treat a checked `P#-W#` item as “this work unit is done and any remaining mapped debt is intentionally handed off,” not as proof that the whole priority is cleared; only `P#-EXIT` can clear the priority for `P(n+1)` work.
- Do not mark `P#-EXIT` complete until every imported review issue mapped to that priority is either retired, explicitly deferred, or intentionally split into a new owned follow-up work unit.
- Do not mark `P#-EXIT` complete until the `P0` security gate has either been cleared or explicitly deferred for the next slice with exact issue ids and revisit triggers.
- Do not leave a multiply-mapped imported review issue with shared implicit ownership at priority exit; the exit record must nominate one single final owner.
- Do not leave imported review issues unowned: every one of the `44` imported review issue ids listed in this file must remain mapped to one explicit `P#-W#` item or one explicit `P#-EXIT` follow-up record.
- Intermediate priority exits may use `deferred` or `split follow-up`, but only with one named later owner and mirrored destination-item verification commands.
- Treat `P#-EXIT` as a reconciliation gate for stale detector residue, proof-matrix disagreements, and true residual ownership, not as a routine follow-up factory for already-established issue envelopes.
- Do not create a new `split follow-up` from `P#-EXIT` unless the exit audit finds a genuinely different remaining live owner or proves the earlier owner assignment was wrong.
- Final wave completion at `P8-EXIT` is blocked unless every one of the `44` imported review ids either returns `No open issues matching` under its exact `desloppify show` command or is given an explicit final disposition that mints a new tracked successor surface in the same pass.
- The expected end state of this wave is zero remaining open issues from the imported 44-id set; final non-resolved dispositions are exceptional and must not be left implicit.
- After any cleanup slice materially changes the evidence, refresh:
  - the evidence snapshot when the backlog meaningfully shifts, after any completed priority, or when strict score changes materially
  - the priority wording or cleanup-track bullets that were affected
  - any adjacent current-state docs that would otherwise drift
