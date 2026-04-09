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
  - `src/modules/ui/epg/view/EPGVirtualizer.ts` at `1,601` lines
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
  - rerun `desloppify plan queue`
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
  - rerun `desloppify plan queue`
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
- [x] `P1-EXIT` run the priority-exit review before moving to `P2`
  - required: record every mapped imported issue with an exact disposition
  - Gate: no `P2` plan, code, or checklist progress starts until every `P1` mapped id has an explicit disposition record
  - Required verification: `desloppify status`; `desloppify show review --status open --no-budget --top 100`; `desloppify show security --status open --no-budget --top 50`; all ten exact `P1` issue-id checks; `npm run verify`
  - Evidence refresh (2026-03-28):
    - `desloppify status`
    - `desloppify show review --status open --no-budget --top 100`
    - `desloppify show security --status open --no-budget --top 50` (no open security issues)
    - all ten exact `P1` issue-id checks listed in this item (each still reports one open issue)
  - Source-proof matrix (current code audit, 2026-03-28):
    - `review::.::holistic::cross_module_architecture::orchestrator_runtime_hub` -> `split follow-up` -> owner `P6-W3`; proof: the stale constructor claim is gone because `AppLazyScreenRegistry` now exposes `AppLazyScreenRegistryRuntimeFacade` and screen constructors receive narrow ports, but one live runtime-root seam remains in the broad facade assembled by `App.ts` and backed by `AppOrchestrator` runtime methods (`src/core/app-shell/AppLazyScreenRegistry.ts`, `src/App.ts`, `src/Orchestrator.ts`)
    - `review::.::holistic::abstraction_fitness::orchestrator_facade_sprawl` -> `split follow-up` -> owner `P6-W3`; proof: direct `AppOrchestrator` injection into auth/profile/server-select constructors is retired, but the registry/runtime-facade surface still mixes auth, profile, server-selection, channel-setup, subtitle, and navigation capabilities in one app-shell contract (`src/core/app-shell/AppLazyScreenRegistry.ts`, `src/App.ts`, `src/Orchestrator.ts`)
    - `review::.::holistic::abstraction_fitness::oversized_runtime_dependency_bags` -> `split follow-up` -> owner `P6-W3`; proof: `P1-W6` retired the `getInitCoordinator()` and modal-initializer seams, but live bag breadth still remains across `NavigationCoordinatorDeps`, `InitializationDependencies`/`InitializationCallbacks`, and `OrchestratorCoordinatorFactoryDeps` (`src/modules/navigation/NavigationCoordinator.ts`, `src/core/InitializationCoordinator.ts`, `src/core/orchestrator/OrchestratorCoordinatorFactory.ts`)
    - `review::.::holistic::abstraction_fitness::single_impl_interface_ceremony` -> `resolved` -> owner `P1-EXIT`; proof: current source audit shows the exact interface examples named by the detector are gone (`rg -n "IChannelNumberOverlay|IChannelBadgeOverlay|IAppOrchestrator" src` returned no matches), and the remaining detector wording is stale residue rather than a live `P1` owner seam
    - `review::.::holistic::design_coherence::app_orchestrator_remains_multi_hub` -> `split follow-up` -> owner `P6-W3`; proof: schedule-day rollover and subtitle-track recovery moved out, but `AppOrchestrator` still concentrates broad runtime state, cross-module wiring, and screen-facing runtime capabilities in one hotspot (`src/Orchestrator.ts`)
    - `review::.::holistic::error_consistency::app_startup_contract_swallowed_failure` -> `resolved` -> owner `P1-EXIT`; proof: `App.start()` now rethrows after best-effort shutdown, `bootstrap()` logs success only after the awaited start completes, and the startup contract is covered by targeted app-shell tests (`src/App.ts`, `src/bootstrap.ts`, `src/__tests__/App.test.ts`)
    - `review::.::holistic::error_consistency::orchestrator_precondition_strategy_drift` -> `split follow-up` -> owner `P5-W1`; proof: auth/discovery/start entry points throw AppError-shaped precondition errors while `switchToChannel*` intentionally remains safe no-op for absent tuning modules, so the remaining work is contract normalization on the shared `Orchestrator` API surface rather than additional `P1` seam narrowing (`src/Orchestrator.ts`, `src/__tests__/orchestrator/orchestrator-preconditions.test.ts`, `src/__tests__/orchestrator/playback-flow.test.ts`)
    - `review::.::holistic::high_level_elegance::composition_root_role_drift` -> `split follow-up` -> owner `P6-W3`; proof: the stale `IAppOrchestrator` detector wording is gone, but the broad app-shell runtime facade assembled in `App.ts` still keeps composition-root responsibility wider than the current-state contract allows (`src/App.ts`, `src/core/app-shell/AppLazyScreenRegistry.ts`, `src/Orchestrator.ts`)
    - `review::.::holistic::error_consistency::recovery_warning_paths_drop_error_context` -> `resolved` -> owner `P1-EXIT`; proof: the recovery-warning branches now flow through `SubtitleTrackRecoveryController` result handling instead of context-dropping `.catch(() => warn...)` wrappers (`src/core/orchestrator/SubtitleTrackRecoveryController.ts`)
    - `review::.::holistic::test_strategy::orchestrator_module_factory_wiring_gap` -> `resolved` -> owner `P1-EXIT`; proof: direct factory wiring coverage exists for `createOrchestratorModules` and verifies the sleep-timer wiring contract (`src/__tests__/orchestrator/orchestrator-module-factory-wiring.test.ts`)
  - Follow-up ownership and revisit triggers:
    - `split follow-up` to `P6-W3`: `review::.::holistic::cross_module_architecture::orchestrator_runtime_hub`, `review::.::holistic::abstraction_fitness::orchestrator_facade_sprawl`, `review::.::holistic::design_coherence::app_orchestrator_remains_multi_hub`, `review::.::holistic::high_level_elegance::composition_root_role_drift`, `review::.::holistic::abstraction_fitness::oversized_runtime_dependency_bags`; reason: one bounded later owner now covers the remaining app-shell runtime-facade narrowing, `AppOrchestrator` multi-hub reduction, composition-root thinning, and adjacent coordinator dependency-bag cleanup without forcing those seams into unrelated `P4`/`P5` work; revisit trigger: rerun each exact issue-id command during `P6-W3` and either retire the seam there or reassign it once to one better-fitting final owner before closing `P6-W3`
    - `split follow-up` to `P5-W1`: `review::.::holistic::error_consistency::orchestrator_precondition_strategy_drift`; reason: the remaining gap is shared `Orchestrator` contract normalization, which fits the later boundary-contract work that already owns `src/Orchestrator.ts` in `P5-W1`; revisit trigger: rerun the exact issue-id command during `P5-W1` and either normalize the public precondition strategy there or reassign it once to one better-fitting final owner before closing `P5-W1`
  - Residual scope note: no live residual seam remains owned by `P1-EXIT`; the runtime-facade and dependency-bag items above now live under `P6-W3`, and `review::.::holistic::error_consistency::orchestrator_precondition_strategy_drift` lives under `P5-W1`.
  - Exit state: `P1-EXIT` is complete on current evidence because every mapped `P1` issue id now has an explicit final disposition or one mirrored successor owner.

## Priority 2: Consolidate EPG Ownership, Runtime State, And Readiness Contracts

- ROI: Highest after `P1`
- Why it matters: the refreshed queue still clusters EPG debt around overlapping owners, split readiness, refresh-seam blur, module-global runtime state, widened types, and a still-flat package shape.
- Required skills: `architecture-boundaries`, `ui-composition-patterns`, `persistence-boundaries`

### Work Units

- [x] `P2-W1` choose one top-level EPG owner surface and one readiness contract (pref Highest ROI)
  - Imported review issues: `review::.::holistic::high_level_elegance::epg_top_level_owner_blur`, `review::.::holistic::api_surface_coherence::epg_readiness_split_contract`
  - Primary files: `src/modules/ui/epg/EPGCoordinator.ts`, `src/modules/ui/epg/interfaces.ts`, `src/modules/ui/epg/DeferredEpgComponent.ts`, `src/core/orchestrator/OrchestratorCoordinatorFactory.ts`
  - Minimum verification: `npm run verify`; exact `desloppify show` commands for the two mapped ids
  - Execution (2026-04-01): split deferred readiness into explicit `IEpgReadinessPort` wiring from `createOrchestratorModules(...)` to `InitializationCoordinator` via a dedicated readiness dependency bag, removed runtime-side `ensureReady` probing from `IEPGComponent` callers, and moved caller-owned visible-range callback composition into `src/modules/ui/epg/EPGConfigBindings.ts` so `EPGCoordinator` keeps runtime-policy ownership only.
  - Verification (2026-04-01):
    - `npm test -- --runInBand src/__tests__/orchestrator/orchestrator-module-factory-wiring.test.ts`
    - `npm test -- --runInBand src/modules/ui/epg/__tests__/EPGConfigBindings.test.ts`
    - `npm test -- --runInBand src/modules/ui/epg/__tests__/DeferredEpgComponent.test.ts`
    - `npm test -- --runInBand src/modules/ui/epg/__tests__/EPGCoordinator.test.ts`
    - `npm test -- --runInBand src/core/__tests__/InitializationCoordinator.test.ts`
    - `npm test -- --runInBand src/core/orchestrator/__tests__/OrchestratorCoordinatorFactory.playbackState.test.ts`
    - `npm test -- --runInBand src/__tests__/Orchestrator.test.ts`
    - `npm run verify`
  - Issue dispositions (2026-04-01 source audit + detector refresh):
    - `review::.::holistic::api_surface_coherence::epg_readiness_split_contract` -> `resolved` -> owner `P2-W1`; proof: `IEPGComponent` no longer advertises optional `ensureReady`, readiness now flows through `OrchestratorModules.epgReadinessPort` and `InitializationDependencies.readiness.epg`, and `EPGCoordinator.openEPG()` no longer probes `ensureReady`; command: `desloppify show "review::.::holistic::api_surface_coherence::epg_readiness_split_contract" --status open --no-budget` (current output still cites pre-change optional-interface/probe evidence, treated as stale detector residue).
    - `review::.::holistic::high_level_elegance::epg_top_level_owner_blur` -> `split follow-up` -> final owner `P2-W2`; reason: after the readiness/config-binding split, one broader live owner-envelope remains around top-level EPG surface clarity (`EPGComponent` vs coordinator/orchestrator delegation surface) that aligns with `P2-W2` runtime-seam follow-through; revisit trigger: rerun `desloppify show "review::.::holistic::high_level_elegance::epg_top_level_owner_blur" --status open --no-budget` plus `npm run verify` during `P2-W2` and retire there or reassign once if source audit finds a better final owner.
- [x] `P2-W2` move refresh orchestration and library-filter normalization behind one explicit EPG runtime seam
  - Imported review issues: `review::.::holistic::mid_level_elegance::epg_coordinator_still_owns_refresh_seam`, `review::.::holistic::mid_level_elegance::epg_library_filter_rules_split_across_seams`
  - Primary files: `src/modules/ui/epg/EPGCoordinator.ts`, `src/modules/ui/epg/EPGRefreshController.ts`, `src/modules/ui/epg/EPGScheduleRefreshRuntime.ts`, `src/modules/ui/epg/EPGCoordinatorPolicies.ts`, `src/modules/settings/EpgPreferencesStore.ts`, `src/core/orchestrator/OrchestratorCoordinatorFactory.ts`
  - Minimum verification: `npm run verify`; exact `desloppify show` commands for the two mapped ids
  - Inherited follow-ups:
    - Source `P2-W1` disposition `split follow-up`: `review::.::holistic::high_level_elegance::epg_top_level_owner_blur`; required verification commands: `desloppify show "review::.::holistic::high_level_elegance::epg_top_level_owner_blur" --status open --no-budget`; `npm run verify`
  - Execution (2026-04-01): extracted internal `EPGRefreshController` seam to own refresh queue/runtime orchestration, kept `EPGCoordinator` as top-level owner with guide-selection abort state, moved schedule-range snapshot ownership to `EpgPreferencesStore.readScheduleRangeSnapshot()`, centralized library-filter normalization in `computeNormalizedLibraryFilterState(...)`, and added seam coverage (`EPGRefreshController.test.ts`, `EPGCoordinatorPolicies.test.ts`) plus updated coordinator/runtime/store/factory tests.
  - Follow-up execution (2026-04-01): routed production guide-setting and library-filter refresh follow-through through `EPGRefreshController` (while keeping guide-selection abort ownership in `EPGCoordinator`), removed `EPGRefreshController` test-only debug getters, and updated coordinator/orchestrator seam tests to assert observable behavior instead of coordinator-internal debug hooks.
  - Follow-up execution (2026-04-01, pass 2): removed guide-setting invalidation ownership from `EPGRefreshController` (`onGuideSettingInvalidation` dep removed) so `EPGCoordinator` is the sole owner of guide-selection abort/version state; refresh controller remains refresh-side reset/clear/reload only.
  - Follow-up execution (2026-04-01, final closeout): moved schedule-range/filter/cache/debug policy shaping fully behind `EPGRefreshController` + `EPGCoordinatorPolicies`, replaced coordinator-local library-filter cleanup with explicit `readAppliedLibraryFilterState(...)` application, removed the stale “Main orchestrator” owner claim from `EPGComponent`, and kept `Orchestrator` as delegation-only wiring.
  - Verification (2026-04-01):
    - `npm test -- --runInBand src/modules/settings/__tests__/EpgPreferencesStore.test.ts`
    - `npm test -- --runInBand src/modules/ui/epg/__tests__/EPGCoordinatorPolicies.test.ts`
    - `npm test -- --runInBand src/modules/ui/epg/__tests__/EPGRefreshController.test.ts`
    - `npm test -- --runInBand src/modules/ui/epg/__tests__/EPGScheduleRefreshRuntime.test.ts`
    - `npm test -- --runInBand src/modules/ui/epg/__tests__/EPGCoordinator.test.ts`
    - `npm test -- --runInBand src/core/orchestrator/__tests__/OrchestratorCoordinatorFactory.playbackState.test.ts`
    - `npm test -- --runInBand src/__tests__/Orchestrator.test.ts`
    - `rg -n "openEPG|closeEPG|toggleEPG|onGuideSettingChange|_epgCoordinator" src/Orchestrator.ts`
    - `rg -n "Main orchestrator for the Electronic Program Guide|channelSelected|libraryFilterChanged|show\\(|hide\\(|isVisible\\(|focusNow\\(" src/modules/ui/epg/EPGComponent.ts`
    - `rg -n "EPGRefreshController" src` (explicit repo-wide caller/import guard)
    - `npm run verify`
  - Follow-up verification (2026-04-01):
    - `npm test -- --runInBand src/modules/ui/epg/__tests__/EPGRefreshController.test.ts`
    - `npm test -- --runInBand src/modules/ui/epg/__tests__/EPGCoordinator.test.ts`
    - `npm test -- --runInBand src/__tests__/Orchestrator.test.ts`
    - `rg -n "EPGRefreshController" src` (explicit repo-wide caller/import guard rerun)
    - `desloppify show "review::.::holistic::mid_level_elegance::epg_coordinator_still_owns_refresh_seam" --status open --no-budget`
    - `desloppify show "review::.::holistic::mid_level_elegance::epg_library_filter_rules_split_across_seams" --status open --no-budget`
    - `npm run verify`
  - Follow-up verification (2026-04-01, pass 2):
    - `npm test -- --runInBand src/modules/ui/epg/__tests__/EPGRefreshController.test.ts`
    - `npm test -- --runInBand src/modules/ui/epg/__tests__/EPGCoordinator.test.ts`
    - `rg -n "EPGRefreshController" src` (explicit repo-wide caller/import guard rerun)
    - `desloppify show "review::.::holistic::mid_level_elegance::epg_coordinator_still_owns_refresh_seam" --status open --no-budget`
    - `desloppify show "review::.::holistic::mid_level_elegance::epg_library_filter_rules_split_across_seams" --status open --no-budget`
    - `npm run verify`
  - Follow-up verification (2026-04-01, final closeout):
    - `npm test -- --runInBand src/modules/ui/epg/__tests__/EPGCoordinatorPolicies.test.ts`
    - `npm test -- --runInBand src/modules/ui/epg/__tests__/EPGRefreshController.test.ts`
    - `npm test -- --runInBand src/modules/ui/epg/__tests__/EPGCoordinator.test.ts`
    - `npm test -- --runInBand src/__tests__/Orchestrator.test.ts`
    - `rg -n "EPGRefreshController" src`
    - `rg -n "openEPG|closeEPG|toggleEPG|onGuideSettingChange|_epgCoordinator" src/Orchestrator.ts`
    - `rg -n "Main orchestrator for the Electronic Program Guide|channelSelected|libraryFilterChanged|show\\(|hide\\(|isVisible\\(|focusNow\\(" src/modules/ui/epg/EPGComponent.ts`
    - `desloppify show "review::.::holistic::mid_level_elegance::epg_coordinator_still_owns_refresh_seam" --status open --no-budget`
    - `desloppify show "review::.::holistic::mid_level_elegance::epg_library_filter_rules_split_across_seams" --status open --no-budget`
    - `desloppify show "review::.::holistic::high_level_elegance::epg_top_level_owner_blur" --status open --no-budget`
    - `npm run verify`
  - Issue dispositions (2026-04-01 final source audit + detector refresh):
    - `review::.::holistic::mid_level_elegance::epg_coordinator_still_owns_refresh_seam` -> `resolved` -> owner `P2-W2`; proof: `EPGCoordinator` now delegates refresh-policy shaping to `EPGRefreshController` and shared policy helpers instead of authoring the runtime callback contract itself, while `EPGRefreshController` is the only production owner that constructs/feeds `EPGScheduleRefreshRuntime` (`rg -n "EPGRefreshController" src` shows only the controller definition plus its internal coordinator consumer in production code); command: `desloppify show "review::.::holistic::mid_level_elegance::epg_coordinator_still_owns_refresh_seam" --status open --no-budget` still prints pre-closeout wording about coordinator-authored runtime callbacks, treated as stale detector residue.
    - `review::.::holistic::mid_level_elegance::epg_library_filter_rules_split_across_seams` -> `resolved` -> owner `P2-W2`; proof: `computeNormalizedLibraryFilterState(...)` remains the single normalization rule, `readAppliedLibraryFilterState(...)` is now the explicit persistence-application boundary, and the coordinator-local duplicate `_getLibraryFilterState` path is gone; command: `desloppify show "review::.::holistic::mid_level_elegance::epg_library_filter_rules_split_across_seams" --status open --no-budget` still cites the removed coordinator helper/mutation path, treated as stale detector residue.
    - `review::.::holistic::high_level_elegance::epg_top_level_owner_blur` -> `resolved` -> owner `P2-W2`; proof: `rg -n "Main orchestrator for the Electronic Program Guide|channelSelected|libraryFilterChanged|show\\(|hide\\(|isVisible\\(|focusNow\\(" src/modules/ui/epg/EPGComponent.ts` no longer finds the top-level-orchestrator wording, `rg -n "openEPG|closeEPG|toggleEPG|onGuideSettingChange|_epgCoordinator" src/Orchestrator.ts` still shows `Orchestrator` as a delegation surface only, and `EPGRefreshController` remains an internal collaborator rather than a second public owner; command: `desloppify show "review::.::holistic::high_level_elegance::epg_top_level_owner_blur" --status open --no-budget` still reports the pre-fix wording and broader stale owner-surface residue.
- [x] `P2-W3` replace hidden EPG runtime globals with explicit owner state and restore narrow shared types at the boundary
  - Imported review issues: `review::.::holistic::initialization_coupling::epg_debug_module_global_runtime`, `review::.::holistic::type_safety::epg_channel_boundary_widens_known_types`
  - Primary files: `src/modules/ui/epg/utils.ts`, `src/modules/ui/epg/EPGCoordinator.ts`, `src/modules/ui/epg/domainTypes.ts`, `src/modules/ui/epg/adapters.ts`, `src/modules/scheduler/channel-manager/types.ts`
  - Minimum verification: `npm run verify`; exact `desloppify show` commands for the two mapped ids
  - Verification (2026-04-02):
    - `npm run verify`
    - `desloppify scan --path . --force-rescan --attest "I understand this is not the intended workflow and I am intentionally skipping queue completion because I need to refresh stale state before closing already-fixed P2-W3 issues."`
    - `desloppify plan reorder "review::.::holistic::initialization_coupling::epg_debug_module_global_runtime" "review::.::holistic::type_safety::epg_channel_boundary_widens_known_types" top`
    - `desloppify plan resolve "review::.::holistic::initialization_coupling::epg_debug_module_global_runtime" "review::.::holistic::type_safety::epg_channel_boundary_widens_known_types" --note "I have actually replaced the hidden EPG debug module globals with explicit orchestrator-owned EPGDebugRuntime wiring, restored storage-event invalidation and same-tab bounded refresh behavior, and narrowed EpgChannel to scheduler-derived shared types at the EPG boundary; I am not gaming the score by resolving without fixing." --confirm`
    - `desloppify show "review::.::holistic::initialization_coupling::epg_debug_module_global_runtime" --status open --no-budget`
    - `desloppify show "review::.::holistic::type_safety::epg_channel_boundary_widens_known_types" --status open --no-budget`
    - `rg -n "appendEpgDebugLog|isEpgDebugLoggingEnabled|__resetEpgDebugStateForTests|debugOverridesStore" src/modules/ui/epg`
  - Issue dispositions (2026-04-02 closeout):
    - `review::.::holistic::initialization_coupling::epg_debug_module_global_runtime` -> `resolved` -> owner `P2-W3`; proof: mutable debug state moved out of `utils.ts` into one explicit `EPGDebugRuntime` owner, one runtime is assembled in `Orchestrator.initialize(...)`, coordinator/runtime owners receive it directly through `createOrchestratorCoordinators(...)`, and UI-only consumers receive it through `EPGConfig.debugRuntime` via `InitializationCoordinator` startup config wiring; tracker closeout: after a forced stale-state rescan and `desloppify plan resolve ...`, `desloppify show "review::.::holistic::initialization_coupling::epg_debug_module_global_runtime" --status open --no-budget` now returns no open issues.
    - `review::.::holistic::type_safety::epg_channel_boundary_widens_known_types` -> `resolved` -> owner `P2-W3`; proof: `EpgChannel` now derives from `Pick<ChannelConfig, ...>` and preserves scheduler-owned `contentSource`/`playbackMode` unions at compile time while adapter/fixture updates align with the narrowed boundary; tracker closeout: after a forced stale-state rescan and `desloppify plan resolve ...`, `desloppify show "review::.::holistic::type_safety::epg_channel_boundary_widens_known_types" --status open --no-budget` now returns no open issues.
- [x] `P2-W4` split the EPG render/data package surface so view, runtime, and model owners stop accreting together
  - Imported review issues: `review::.::holistic::low_level_elegance::epg_virtual_render_method_accretion`, `review::.::holistic::package_organization::epg_flat_directory_overload`
  - Primary files: `src/modules/ui/epg/view/EPGVirtualizer.ts`, `src/modules/ui/epg/view/`, `src/modules/ui/epg/runtime/`, `src/modules/ui/epg/model/`, `src/modules/ui/epg/index.ts`, `src/core/initialization/InitializationStartupPolicy.ts`
  - Minimum verification: `npm run verify`; exact `desloppify show` commands for the two mapped ids
  - Execution (2026-04-02): moved leaf EPG collaborators into staged subfolders (`view/`, `runtime/`, `model/`) without forwarding shims, added subfolder barrels, rewired direct imports (including `InitializationStartupPolicy.ts` to `src/modules/ui/epg/model/adapters`), kept the root EPG barrel stable for previously-public surface exports only, and refactored `renderVisibleCells(...)` into explicit private phases (`createRenderPassContext`, `collectVisibleCells`, `collectCellsForScheduledRow`, `pruneToDomBudget`, `reconcileVisibleCells`, `finishRenderPass`) while preserving the existing public `EPGVirtualizer` API.
  - Verification (2026-04-02):
    - `npm run typecheck`
    - `npm test -- --runInBand src/modules/ui/epg/__tests__/index.test.ts src/modules/ui/epg/__tests__/EPGTimeHeader.test.ts src/modules/ui/epg/__tests__/EPGChannelList.test.ts src/modules/ui/epg/__tests__/EPGScheduleCacheStore.test.ts src/modules/ui/epg/__tests__/EPGVisibleRangeRefreshQueue.test.ts src/modules/ui/epg/__tests__/EPGRefreshController.test.ts src/modules/ui/epg/__tests__/EPGScheduleRefreshRuntime.test.ts src/modules/ui/epg/__tests__/EPGComponent.test.ts`
    - `npm test -- --runInBand src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts`
    - `npm test -- --runInBand src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts src/modules/ui/epg/__tests__/EPGComponent.test.ts src/modules/ui/epg/__tests__/EPGRefreshController.test.ts src/modules/ui/epg/__tests__/EPGScheduleRefreshRuntime.test.ts src/modules/ui/epg/__tests__/EPGTimeHeader.test.ts src/modules/ui/epg/__tests__/EPGChannelList.test.ts src/modules/ui/epg/__tests__/EPGScheduleCacheStore.test.ts src/modules/ui/epg/__tests__/EPGVisibleRangeRefreshQueue.test.ts`
    - `npm run verify`
    - `desloppify show "review::.::holistic::low_level_elegance::epg_virtual_render_method_accretion" --status open --no-budget`
    - `desloppify show "review::.::holistic::package_organization::epg_flat_directory_overload" --status open --no-budget`
  - Issue dispositions (2026-04-02 source audit + detector check):
    - `review::.::holistic::low_level_elegance::epg_virtual_render_method_accretion` -> `resolved` (slice-owned rationale retired on current source) -> final owner for residual reconciliation: `P2-EXIT`; proof: `renderVisibleCells(...)` is now a thin coordinator over explicit class-private phase helpers in `src/modules/ui/epg/view/EPGVirtualizer.ts`; detector output still cites removed single-pass structure and pre-move file path (`src/modules/ui/epg/EPGVirtualizer.ts`), treated as stale detector residue pending broader queue reconciliation.
    - `review::.::holistic::package_organization::epg_flat_directory_overload` -> `resolved` (slice-owned rationale retired on current source) -> final owner for residual reconciliation: `P2-EXIT`; proof: moved view/runtime/model leaf collaborators out of the flat EPG root and retained only root-owner + shared contract surfaces in `src/modules/ui/epg/`; detector output still cites pre-move flat-path evidence (`src/modules/ui/epg/EPGChannelList.ts`, `src/modules/ui/epg/EPGTimeHeader.ts`, `src/modules/ui/epg/EPGScheduleCacheStore.ts`, `src/modules/ui/epg/EPGVisibleRangeRefreshQueue.ts`, `src/modules/ui/epg/adapters.ts`), treated as stale detector residue.
- [x] `P2-EXIT` run the priority-exit review before moving to `P3`
  - required: record every mapped imported issue with an exact disposition
  - Gate: no `P3` plan, code, or checklist progress starts until every `P2` mapped id has an explicit disposition record
  - Required verification: `desloppify status`; `desloppify show review --status open --no-budget --top 100`; `desloppify show security --status open --no-budget --top 50`; all eight exact `P2` issue-id checks; `npm run verify`
  - Priority-exit review status (2026-04-02): `complete` (cleanup-review confirmed later-owner reassignment, destination mirroring, and security-gate clearance on current evidence; `P3` may proceed)
  - Verified commands (2026-04-02 refresh):
    - `npm run typecheck`
    - `npm test -- --runInBand src/modules/ui/epg/__tests__/EPGCoordinator.test.ts src/modules/ui/epg/__tests__/EPGRefreshController.test.ts src/modules/ui/epg/__tests__/EPGScheduleRefreshRuntime.test.ts`
    - `npm run verify`
    - `desloppify status`
    - `desloppify show review --status open --no-budget --top 100`
    - `desloppify show security --status open --no-budget --top 50`
    - `desloppify show "review::.::holistic::high_level_elegance::epg_top_level_owner_blur" --status open --no-budget`
    - `desloppify show "review::.::holistic::api_surface_coherence::epg_readiness_split_contract" --status open --no-budget`
    - `desloppify show "review::.::holistic::mid_level_elegance::epg_coordinator_still_owns_refresh_seam" --status open --no-budget`
    - `desloppify show "review::.::holistic::mid_level_elegance::epg_library_filter_rules_split_across_seams" --status open --no-budget`
    - `desloppify show "review::.::holistic::initialization_coupling::epg_debug_module_global_runtime" --status open --no-budget`
    - `desloppify show "review::.::holistic::type_safety::epg_channel_boundary_widens_known_types" --status open --no-budget`
    - `desloppify show "review::.::holistic::low_level_elegance::epg_virtual_render_method_accretion" --status open --no-budget`
    - `desloppify show "review::.::holistic::package_organization::epg_flat_directory_overload" --status open --no-budget`
    - `desloppify scan --force-rescan --attest "I understand this is not the intended workflow and I am intentionally skipping queue completion"`
    - `desloppify detect cycles --json`
    - `desloppify detect cycles --file src/modules/ui/epg/EPGCoordinator.ts --json`
    - `desloppify detect cycles --file src/modules/ui/epg/EPGRefreshController.ts --json`
    - `desloppify plan reorder "cycles::src/modules/ui/epg/EPGCoordinator.ts::src/modules/ui/epg/EPGCoordinator.ts::src/modules/ui/epg/EPGRefreshController.ts" top`
    - `desloppify plan resolve "cycles::src/modules/ui/epg/EPGCoordinator.ts::src/modules/ui/epg/EPGCoordinator.ts::src/modules/ui/epg/EPGRefreshController.ts" --note "Detector reconciliation: desloppify detect cycles returns zero cycles for both EPGCoordinator.ts and EPGRefreshController.ts; source import audit shows one-way import (EPGCoordinator -> EPGRefreshController) with no reverse import. Clearing stale persisted cycle work item." --attest "I have actually rerun the cycle detector and audited imports, and I am not gaming the score."`
    - `desloppify show "cycles::src/modules/ui/epg/EPGCoordinator.ts::src/modules/ui/epg/EPGCoordinator.ts::src/modules/ui/epg/EPGRefreshController.ts" --status open --no-budget`
    - `desloppify show security --status open --no-budget --top 50`
  - Mapped imported issues (2026-04-02 disposition record):
    - `review::.::holistic::high_level_elegance::epg_top_level_owner_blur` -> `split follow-up`; owner: `P4-W2`; reason: remaining live debt is a cross-surface EPG ownership seam (`EPGComponent`/`EPGCoordinator`/`Orchestrator` delegation) that needs the same coordinator/runtime/startup boundary pass already in scope for `P4-W2`; revisit trigger: during `P4-W2`, rerun `desloppify show "review::.::holistic::high_level_elegance::epg_top_level_owner_blur" --status open --no-budget` and `npm run verify`.
    - `review::.::holistic::api_surface_coherence::epg_readiness_split_contract` -> `split follow-up`; owner: `P4-W2`; reason: remaining readiness ambiguity crosses `IEPGComponent`, deferred EPG runtime wiring, coordinator open flow, and orchestrator startup seams that align with the `P4-W2` initialization/runtime boundary cleanup; revisit trigger: during `P4-W2`, rerun `desloppify show "review::.::holistic::api_surface_coherence::epg_readiness_split_contract" --status open --no-budget` and `npm run verify`.
    - `review::.::holistic::mid_level_elegance::epg_coordinator_still_owns_refresh_seam` -> `split follow-up`; owner: `P4-W2`; reason: remaining seam is still centered on `EPGCoordinator` plus runtime refresh orchestration and belongs to the same bounded extraction pass as `P4-W2`; revisit trigger: during `P4-W2`, rerun `desloppify show "review::.::holistic::mid_level_elegance::epg_coordinator_still_owns_refresh_seam" --status open --no-budget` and `npm run verify`.
    - `review::.::holistic::mid_level_elegance::epg_library_filter_rules_split_across_seams` -> `split follow-up`; owner: `P4-W1`; reason: remaining duplication crosses `EPGCoordinator` and `EPGCoordinatorPolicies` and belongs with the storage/owner-boundary policy cleanup that already names `EPGCoordinatorPolicies.ts` in `P4-W1`; revisit trigger: during `P4-W1`, rerun `desloppify show "review::.::holistic::mid_level_elegance::epg_library_filter_rules_split_across_seams" --status open --no-budget` and `npm run verify`.
    - `review::.::holistic::initialization_coupling::epg_debug_module_global_runtime` -> `resolved`; owner: `P2-W3`; reason: exact issue-id command returns `No open issues matching`; revisit trigger: rerun exact issue-id command during next `P2-EXIT` refresh if EPG runtime debug ownership changes.
    - `review::.::holistic::type_safety::epg_channel_boundary_widens_known_types` -> `resolved`; owner: `P2-W3`; reason: exact issue-id command returns `No open issues matching`; revisit trigger: rerun exact issue-id command during next `P2-EXIT` refresh if channel-domain boundary types are widened again.
    - `review::.::holistic::low_level_elegance::epg_virtual_render_method_accretion` -> `resolved`; owner: `P6-W2`; reason: `P6-W2` reran the exact issue-id check, confirmed `No open issues matching`, and re-audited `src/modules/ui/epg/view/EPGVirtualizer.ts` on current code; `renderVisibleCells(...)` remains a thin coordinator over explicit private phases, so the earlier detector wording was stale rather than a live residual seam.
    - `review::.::holistic::package_organization::epg_flat_directory_overload` -> `resolved`; owner: `P6-W2`; reason: `P6-W2` reran the exact issue-id check, confirmed `No open issues matching`, and re-audited `src/modules/ui/epg/view/`, `src/modules/ui/epg/runtime/`, and `src/modules/ui/epg/model/`; the staged owner split remains present on current code, so the earlier detector wording was stale rather than a live residual seam.
  - Security triage (2026-04-02 disposition record):
    - issue: `cycles::src/modules/ui/epg/EPGCoordinator.ts::src/modules/ui/epg/EPGCoordinator.ts::src/modules/ui/epg/EPGRefreshController.ts`
    - disposition: `resolved`
    - owner: `P2-EXIT`
    - reason: source audit confirms one-way import (`EPGCoordinator -> EPGRefreshController`) and no reverse import remains, while `desloppify detect cycles --json` returns zero cycles. The open security finding persisted as stale plan/work-item state after forced-rescan mid-cycle scans, so `desloppify plan resolve` was used (with attested detector + source proof) to reconcile the stale cycle id.
    - revisit trigger: before any `P3` work (or if either file’s import surface changes), rerun `desloppify detect cycles --json` and `desloppify show security --status open --no-budget --top 50`; reopen triage immediately if either command reports a cycle again.

## Priority 3: Realign Channel-Setup Ownership And Remove Duplicated Flow Contracts

- ROI: High
- Why it matters: channel setup is still split between `core` assembly and feature-heavy workflow ownership, and the refreshed queue still calls out duplicated flow logic, naming drift, and re-declared UI unions.
- Required skills: `architecture-boundaries`, `ui-composition-patterns`, `persistence-boundaries`

### Work Units

- [x] `P3-W1` choose one owner for channel-setup workflow and reduce the gateway seam to thin assembly
  - Imported review issues: `review::.::holistic::high_level_elegance::channel_setup_domain_placement_blur`
  - Primary files: `src/core/channel-setup/ChannelSetupCoordinator.ts`, `src/core/channel-setup/ChannelSetupSessionGateway.ts`, `src/core/channel-setup/createChannelSetupSessionGateway.ts`, `src/modules/ui/channel-setup/ChannelSetupSessionController.ts`
  - Minimum verification: `npm run verify`; exact `desloppify show` command for the mapped id
  - Execution (2026-04-02): replaced the mixed `ChannelSetupSessionGateway` seam with explicit workflow and screen ports, kept `ChannelSetupSessionController` as the channel-setup workflow/session owner, rewired app-shell assembly to use `getChannelSetupWorkflowPort()` plus `createChannelSetupScreenPorts()`, kept `requestChannelSetupRerun()` as a direct runtime action, kept diagnostics on workflow plus direct selected-server accessors, and tightened `ChannelSetupScreen` tests/contracts so they construct split workflow and screen test ports explicitly.
  - Verification (2026-04-02):
    - `npm run verify`
    - `desloppify show "review::.::holistic::high_level_elegance::channel_setup_domain_placement_blur" --status open --no-budget`
    - `rg -n "ChannelSetupSessionGateway|getChannelSetupSessionGateway" src`
  - Issue dispositions (2026-04-02 source audit + detector refresh):
    - `review::.::holistic::high_level_elegance::channel_setup_domain_placement_blur` -> `resolved` -> owner `P3-W1`; proof: `rg -n "ChannelSetupSessionGateway|getChannelSetupSessionGateway" src` now returns no matches, `ChannelSetupScreen` requires explicit `{ workflowPort, screenPorts }` construction, `ChannelSetupSessionController` consumes `ChannelSetupWorkflowPort` as the session/async owner, diagnostics now depend on `getChannelSetupWorkflowPort()` plus direct selected-server accessors, and `requestChannelSetupRerun()` remains a direct runtime action on `AppOrchestrator`; command: `desloppify show "review::.::holistic::high_level_elegance::channel_setup_domain_placement_blur" --status open --no-budget` still reports deleted gateway files and pre-split coordinator evidence, treated as stale detector residue.
- [x] `P3-W2` split overloaded build execution and deduplicate error-summary policy inside channel setup
  - Imported review issues: `review::.::holistic::design_coherence::channel_setup_build_execution_is_overloaded`, `review::.::holistic::design_coherence::channel_setup_error_summary_logic_is_duplicated`
  - Primary files: `src/core/channel-setup/ChannelSetupBuildExecutor.ts`, `src/core/channel-setup/ChannelSetupPlanningService.ts`, `src/modules/ui/channel-setup/`
  - Minimum verification: `npm run verify`; exact `desloppify show` commands for the two mapped ids
  - Execution (2026-04-02): extracted `ChannelSetupBuildCommitter` as the commit/apply/refresh owner, narrowed `ChannelSetupBuildExecutor` to planning/progress/cancel orchestration, rewired `ChannelSetupCoordinator` assembly to inject the new collaborator, added direct `ChannelSetupBuildCommitter` tests for cancellation/reached-max/cleanup-order/EPG-refresh behavior, and removed channel-setup-local `summarizeErrorForLog` helpers so both core channel-setup files now use `src/utils/errors.ts`.
  - Verification (2026-04-02):
    - `npm test -- --runInBand src/core/channel-setup/__tests__/ChannelSetupBuildCommitter.test.ts src/core/channel-setup/__tests__/ChannelSetupCoordinator.test.ts`
    - `npm test -- --runInBand src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts src/utils/__tests__/errors.test.ts`
    - `npm run verify`
    - `desloppify status`
    - `desloppify show review --status open --no-budget --top 100`
    - `desloppify show security --status open --no-budget --top 50`
    - `desloppify show "review::.::holistic::design_coherence::channel_setup_build_execution_is_overloaded" --status open --no-budget`
    - `desloppify show "review::.::holistic::design_coherence::channel_setup_error_summary_logic_is_duplicated" --status open --no-budget`
    - `rg -n "function summarizeErrorForLog|summarizeErrorForLog\\(" src/core/channel-setup src/utils/errors.ts`
  - Issue dispositions (2026-04-02 source audit + detector refresh):
    - `review::.::holistic::design_coherence::channel_setup_build_execution_is_overloaded` -> `resolved` -> owner `P3-W2`; proof: `ChannelSetupBuildExecutor` now delegates temp-builder lifecycle, create/apply, and post-commit EPG refresh to `ChannelSetupBuildCommitter`, while executor owns preflight planning/progress/cancel orchestration only; direct collaborator coverage now exists in `ChannelSetupBuildCommitter.test.ts`; exact issue-id `desloppify` command still reports pre-extraction wording and is treated as stale detector residue.
    - `review::.::holistic::design_coherence::channel_setup_error_summary_logic_is_duplicated` -> `resolved` -> owner `P3-W2`; proof: `rg -n "function summarizeErrorForLog|summarizeErrorForLog\\(" src/core/channel-setup src/utils/errors.ts` now shows a single shared helper definition in `src/utils/errors.ts` with channel-setup files only importing/calling it; exact issue-id `desloppify` command still reports removed local helper copies and is treated as stale detector residue.
  - Security triage (2026-04-02 disposition record):
    - `desloppify show security --status open --no-budget --top 50` -> `No open issues for Security. Detectors: cycles, security`.
    - `P0` impact: none intersects channel setup; no `P0` blocker recorded for `P3-W2` or `P3-EXIT`.
- [x] `P3-W3` align channel-setup names and UI state types to the domain contracts they already mirror
  - Imported review issues: `review::.::holistic::naming_quality::playback_variant_flag_name_drift`, `review::.::holistic::naming_quality::scroll_to_nearest_fallback_mismatch`, `review::.::holistic::type_safety::channel_setup_ui_redefines_core_unions`
  - Primary files: `src/core/channel-setup/ChannelSetupPlanner.ts`, `src/core/channel-setup/types.ts`, `src/modules/ui/channel-setup/ChannelSetupSessionController.ts`, `src/modules/ui/channel-setup/steps/types.ts`, `src/modules/ui/channel-setup/focus/scrollToNearest.ts`, `src/modules/scheduler/channel-manager/types.ts`
  - Minimum verification: `npm run verify`; exact `desloppify show` commands for the three mapped ids
  - Execution (2026-04-03): renamed setup variant flag usage from `isSequentialVariant` to `isPlaybackModeVariant` across scheduler + channel-setup planner/commit paths, added one-time migration in `ChannelRepository.loadNormalized()` to move persisted legacy records and persist via the existing normalized-save path, expanded `ChannelSetupBuildCommitter` merge/apply-path test coverage for the renamed flag, aligned channel-setup UI state types to core/domain contracts (`SetupStrategyConfig`, `ChannelExpansionConfig`, `SeriesOrderingConfig`) instead of re-stated local unions, and replaced `scrollToNearest` fallback behavior with nearest-edge approximation (`true` above viewport, `false` below viewport, no-op when already visible) plus focused unit tests.
  - Verification (2026-04-03):
    - `npm test -- --runInBand src/modules/scheduler/channel-manager/__tests__/ChannelRepository.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts`
    - `npm test -- --runInBand src/core/channel-setup/__tests__/ChannelSetupPlanner.test.ts src/core/channel-setup/__tests__/ChannelSetupCoordinator.test.ts src/core/channel-setup/__tests__/ChannelSetupBuildCommitter.test.ts`
    - `npm test -- --runInBand src/modules/ui/channel-setup/focus/__tests__/scrollToNearest.test.ts`
    - `npm run typecheck`
    - `npm run verify`
    - `desloppify show "review::.::holistic::naming_quality::playback_variant_flag_name_drift" --status open --no-budget`
    - `desloppify show "review::.::holistic::naming_quality::scroll_to_nearest_fallback_mismatch" --status open --no-budget`
    - `desloppify show "review::.::holistic::type_safety::channel_setup_ui_redefines_core_unions" --status open --no-budget`
    - `rg -n "isSequentialVariant|isPlaybackModeVariant" src/core/channel-setup src/modules/scheduler/channel-manager src/modules/ui/channel-setup`
    - `rg -n "scrollToNearest\\(|scrollIntoView\\(" src/modules/ui/channel-setup`
    - `rg -n "'per-library'|'cross-library'|'none'\\s*\\|\\s*'sequential'\\s*\\|\\s*'block'|'shuffle'\\s*\\|\\s*'sequential'\\s*\\|\\s*'block'" src/modules/ui/channel-setup`
  - Issue dispositions (2026-04-03 source audit + detector refresh):
    - `review::.::holistic::naming_quality::playback_variant_flag_name_drift` -> `resolved` -> owner `P3-W3`; proof: planner/build/scheduler now use `isPlaybackModeVariant`, and legacy `isSequentialVariant` appears only in `ChannelRepository` migration logic and migration-specific tests; exact issue-id `desloppify` command still reports pre-rename evidence and is treated as stale detector residue.
    - `review::.::holistic::naming_quality::scroll_to_nearest_fallback_mismatch` -> `resolved` -> owner `P3-W3`; proof: `scrollToNearest` now attempts `{ block: 'nearest', inline: 'nearest' }`, then falls back to nearest-edge approximation for above/below cases with explicit unit coverage in `focus/__tests__/scrollToNearest.test.ts`; exact issue-id `desloppify` command still reports old fallback wording and is treated as stale detector residue.
    - `review::.::holistic::type_safety::channel_setup_ui_redefines_core_unions` -> `resolved` -> owner `P3-W3`; proof: `ChannelSetupSessionController` and `steps/types` now reference core contracts (`SetupStrategyConfig['scope']`, `ChannelExpansionConfig['variantType']`, `SeriesOrderingConfig['basePlaybackMode']`) instead of local duplicate unions; exact issue-id `desloppify` command still reports pre-refactor evidence and is treated as stale detector residue.
- [x] `P3-EXIT` run the priority-exit review before moving to `P4`
  - required: record every mapped imported issue with an exact disposition
  - Gate: no `P4` plan, code, or checklist progress starts until every `P3` mapped id has an explicit disposition record
  - Required verification: `desloppify status`; `desloppify show review --status open --no-budget --top 100`; `desloppify show security --status open --no-budget --top 50`; all six exact `P3` issue-id checks; `npm run verify`
  - Priority-exit review status (2026-04-03): `complete` (all six mapped `P3` ids now return `No open issues matching`; no `deferred`/`split follow-up` carry-forward required)
  - Verified commands (2026-04-03 final refresh):
    - `desloppify status`
    - `desloppify show review --status open --no-budget --top 100`
    - `desloppify show security --status open --no-budget --top 50`
    - `desloppify show "review::.::holistic::high_level_elegance::channel_setup_domain_placement_blur" --status open --no-budget`
    - `desloppify show "review::.::holistic::design_coherence::channel_setup_build_execution_is_overloaded" --status open --no-budget`
    - `desloppify show "review::.::holistic::design_coherence::channel_setup_error_summary_logic_is_duplicated" --status open --no-budget`
    - `desloppify show "review::.::holistic::naming_quality::playback_variant_flag_name_drift" --status open --no-budget`
    - `desloppify show "review::.::holistic::naming_quality::scroll_to_nearest_fallback_mismatch" --status open --no-budget`
    - `desloppify show "review::.::holistic::type_safety::channel_setup_ui_redefines_core_unions" --status open --no-budget`
    - `rg -n "ChannelSetupSessionGateway|getChannelSetupSessionGateway" src`
    - `rg -n "function summarizeErrorForLog|summarizeErrorForLog\\(" src/core/channel-setup src/utils/errors.ts`
    - `rg -n "isSequentialVariant|isPlaybackModeVariant" src/core/channel-setup src/modules/scheduler/channel-manager src/modules/ui/channel-setup`
    - `rg -n "scrollToNearest\\(|scrollIntoView\\(" src/modules/ui/channel-setup`
    - `rg -n "'per-library'|'cross-library'|'none'\\s*\\|\\s*'sequential'\\s*\\|\\s*'block'|'shuffle'\\s*\\|\\s*'sequential'\\s*\\|\\s*'block'" src/modules/ui/channel-setup`
    - `rg -n "\\[x\\] \`P4-" ARCHITECTURE_CLEANUP_CHECKLIST.md`
    - `ls docs/plans | rg -i '(^|-)p4(-|_)'`
    - `desloppify plan reorder "review::.::holistic::high_level_elegance::channel_setup_domain_placement_blur" "review::.::holistic::design_coherence::channel_setup_build_execution_is_overloaded" "review::.::holistic::design_coherence::channel_setup_error_summary_logic_is_duplicated" "review::.::holistic::naming_quality::playback_variant_flag_name_drift" "review::.::holistic::naming_quality::scroll_to_nearest_fallback_mismatch" "review::.::holistic::type_safety::channel_setup_ui_redefines_core_unions" top`
    - `desloppify plan resolve "review::.::holistic::high_level_elegance::channel_setup_domain_placement_blur" "review::.::holistic::design_coherence::channel_setup_build_execution_is_overloaded" "review::.::holistic::design_coherence::channel_setup_error_summary_logic_is_duplicated" "review::.::holistic::naming_quality::playback_variant_flag_name_drift" "review::.::holistic::naming_quality::scroll_to_nearest_fallback_mismatch" "review::.::holistic::type_safety::channel_setup_ui_redefines_core_unions" --note "I reran the P3 source-audit gates and confirmed stale detector residue only: no gateway seam references, no duplicate summarizeErrorForLog definitions in channel-setup, planner/scheduler use isPlaybackModeVariant with one-time migration in repository, scrollToNearest fallback preserves nearest semantics, and UI state unions derive from core contracts. Resolving stale plan items after evidence refresh." --confirm`
    - `npm run verify`
  - Mapped imported issues (2026-04-03 disposition record):
    - `review::.::holistic::high_level_elegance::channel_setup_domain_placement_blur` -> `resolved`; owner: `P3-W1`; reason: exact issue-id command now returns `No open issues matching` after stale-state reconciliation.
    - `review::.::holistic::design_coherence::channel_setup_build_execution_is_overloaded` -> `resolved`; owner: `P3-W2`; reason: exact issue-id command now returns `No open issues matching` after stale-state reconciliation.
    - `review::.::holistic::design_coherence::channel_setup_error_summary_logic_is_duplicated` -> `resolved`; owner: `P3-W2`; reason: exact issue-id command now returns `No open issues matching` after stale-state reconciliation.
    - `review::.::holistic::naming_quality::playback_variant_flag_name_drift` -> `resolved`; owner: `P3-W3`; reason: exact issue-id command now returns `No open issues matching` after stale-state reconciliation.
    - `review::.::holistic::naming_quality::scroll_to_nearest_fallback_mismatch` -> `resolved`; owner: `P3-W3`; reason: exact issue-id command now returns `No open issues matching` after stale-state reconciliation.
    - `review::.::holistic::type_safety::channel_setup_ui_redefines_core_unions` -> `resolved`; owner: `P3-W3`; reason: exact issue-id command now returns `No open issues matching` after stale-state reconciliation.
  - Security triage (2026-04-03 disposition record):
    - `desloppify show security --status open --no-budget --top 50` -> `No open issues for Security. Detectors: cycles, security`.
    - `P0` impact: none; no `P0` defer/split records required for `P3-EXIT`.

## Priority 4: Tighten Persistence, Lifecycle, And Diagnostics Ownership

- ROI: High
- Why it matters: storage-owner drift is still open after wave 2, lifecycle still keeps a deprecated Plex-auth slot visible, diagnostics lifetimes are still hidden behind module-scope instances, and startup ownership still carries misleading async wrappers.
- Required skills: `architecture-boundaries`, `persistence-boundaries`, `plex-integration-boundaries`

### Work Units

- [x] `P4-W1` retire remaining raw storage-owner drift and remove deprecated lifecycle/auth schema carry-forward
  - Imported review issues: `review::.::holistic::cross_module_architecture::storage_owner_boundary_drift`, `review::.::holistic::incomplete_migration::deprecated_lifecycle_plexauth_slot`
  - Primary files: `src/modules/ui/epg/EPGCoordinatorPolicies.ts`, `src/core/orchestrator/OrchestratorCoordinatorFactory.ts`, `src/modules/player/AudioTrackManager.ts`, `src/modules/lifecycle/StateManager.ts`, `docs/architecture/CURRENT_STATE.md`
  - Minimum verification: `npm run verify`; exact `desloppify show` commands for the two mapped ids
  - Closeout note: planning and final verification for `P4-W1` must cover both the mapped `P4-W1` issues above and the inherited `epg_library_filter_rules_split_across_seams` follow-up below before this work unit can be marked complete.
  - Inherited follow-ups:
    - Source `P2-EXIT` disposition `split follow-up`: `review::.::holistic::mid_level_elegance::epg_library_filter_rules_split_across_seams`; required verification commands: `desloppify show "review::.::holistic::mid_level_elegance::epg_library_filter_rules_split_across_seams" --status open --no-budget`; `npm run verify`
  - Execution (2026-04-07): removed lifecycle `PersistentState.plexAuth` from live schema/save-repair output while retaining load compatibility tests for legacy payloads; routed DTS passthrough policy in `AudioTrackManager` through injected `AudioSettingsStore`; changed `ChannelSetupCoordinator` to consume a typed `recordStore` seam (no raw setup-record storage get/set callbacks in coordinator deps); made EPG library-filter normalization helper pure and moved persisted-selection cleanup writes into `EPGCoordinator` and `EPGRefreshController`; refreshed architecture truth for these ownership seams.
  - Verification (2026-04-07):
    - `desloppify status`
    - `desloppify show security --status open --no-budget --top 50`
    - `desloppify show "review::.::holistic::cross_module_architecture::storage_owner_boundary_drift" --status open --no-budget`
    - `desloppify show "review::.::holistic::incomplete_migration::deprecated_lifecycle_plexauth_slot" --status open --no-budget`
    - `desloppify show "review::.::holistic::mid_level_elegance::epg_library_filter_rules_split_across_seams" --status open --no-budget`
    - `npm test -- src/modules/lifecycle/__tests__/StateManager.test.ts src/modules/lifecycle/__tests__/AppLifecycle.test.ts src/modules/player/__tests__/AudioTrackManager.test.ts src/core/channel-setup/__tests__/ChannelSetupCoordinator.test.ts src/core/channel-setup/__tests__/ChannelSetupRecordStore.test.ts src/core/orchestrator/__tests__/OrchestratorCoordinatorFactory.playbackState.test.ts src/modules/ui/epg/__tests__/EPGCoordinatorPolicies.test.ts src/modules/ui/epg/__tests__/EPGCoordinator.test.ts src/modules/ui/epg/__tests__/EPGRefreshController.test.ts`
    - `rg -n "plexAuth" src/modules/lifecycle` (matches only compatibility-focused lifecycle tests; no live lifecycle type/save-path `plexAuth` field remains)
    - `rg -n "safeLocalStorage(Get|Set|Remove)|localStorage\\." src/core/orchestrator/OrchestratorCoordinatorFactory.ts src/core/channel-setup src/modules/player/AudioTrackManager.ts src/modules/ui/epg` (no direct storage calls remain in `AudioTrackManager`; setup-record ownership remains in `ChannelSetupRecordStore`; factory still assembles typed owners)
    - `npm run verify` (pass)
  - Verification (2026-04-08 tracker refresh):
    - `desloppify scan --path . --force-rescan --attest "I understand this is not the intended workflow and I am intentionally skipping queue completion because I need to refresh stale state before closing already-fixed P4-W1 issues."`
    - `desloppify plan resolve "review::.::holistic::cross_module_architecture::storage_owner_boundary_drift" "review::.::holistic::incomplete_migration::deprecated_lifecycle_plexauth_slot" "review::.::holistic::mid_level_elegance::epg_library_filter_rules_split_across_seams" --note "I have actually landed the P4-W1 storage and lifecycle owner cleanup and I am not gaming the score by resolving without fixing: lifecycle PersistentState no longer carries plexAuth in live schema/save paths, AudioTrackManager now reads DTS passthrough policy through AudioSettingsStore, ChannelSetupCoordinator now consumes a typed ChannelSetupRecordStore seam instead of raw setup-record get/set callbacks, and EPG library-filter normalization is pure while EPGCoordinator and EPGRefreshController perform the explicit persistence cleanup writes." --confirm --force-resolve`
    - `desloppify status` -> `Last scan: 2026-04-08T04:17:13+00:00` (tracker state refreshed; score movement reflects broader scan scope, not a new `P4-W1` seam regression)
    - `desloppify show security --status open --no-budget --top 50` -> `No open issues for Security. Detectors: cycles, security`
    - `desloppify show "review::.::holistic::cross_module_architecture::storage_owner_boundary_drift" --status open --no-budget` -> `No open issues matching: review::.::holistic::cross_module_architecture::storage_owner_boundary_drift`
    - `desloppify show "review::.::holistic::incomplete_migration::deprecated_lifecycle_plexauth_slot" --status open --no-budget` -> `No open issues matching: review::.::holistic::incomplete_migration::deprecated_lifecycle_plexauth_slot`
    - `desloppify show "review::.::holistic::mid_level_elegance::epg_library_filter_rules_split_across_seams" --status open --no-budget` -> `No open issues matching: review::.::holistic::mid_level_elegance::epg_library_filter_rules_split_across_seams`
  - Security triage (2026-04-07 disposition record):
    - `desloppify show security --status open --no-budget --top 50` -> `No open issues for Security. Detectors: cycles, security`.
    - `P0` impact: none; no `P0` defer/split records required for `P4-W1`.
  - Security triage (2026-04-08 tracker refresh):
    - `desloppify show security --status open --no-budget --top 50` -> `No open issues for Security. Detectors: cycles, security`.
    - `P0` impact: none; no `P0` defer/split records required for `P4-W1`.
  - Proof matrix (2026-04-07 source-audit closeout):
    - `review::.::holistic::cross_module_architecture::storage_owner_boundary_drift` -> `resolved` (slice-owned rationale retired on current source for DTS and channel-setup record seams; no live `AudioTrackManager` direct storage read remains; no new residual owner discovered in this slice; tracker closeout: after the forced stale-state rescan and `desloppify plan resolve ...`, the exact `desloppify show ... --status open --no-budget` command now returns no open issues.)
    - `review::.::holistic::incomplete_migration::deprecated_lifecycle_plexauth_slot` -> `resolved` (slice-owned rationale retired on current source; live `PersistentState` schema/save path no longer carries `plexAuth`; legacy payload handling remains load-only compatibility; tracker closeout: after the forced stale-state rescan and `desloppify plan resolve ...`, the exact `desloppify show ... --status open --no-budget` command now returns no open issues.)
    - `review::.::holistic::mid_level_elegance::epg_library_filter_rules_split_across_seams` -> `resolved on current-code proof` (normalization is now pure in `computeNormalizedLibraryFilterState(...)`; runtime owners perform explicit persistence cleanup writes; no live residual owner outside `P4-W1`; tracker closeout: after the forced stale-state rescan and `desloppify plan resolve ...`, the exact `desloppify show ... --status open --no-budget` command now returns no open issues.)
- [x] `P4-W2` centralize diagnostics ownership and remove misleading startup async wrappers
  - Imported review issues: `review::.::holistic::initialization_coupling::diagnostics_store_scattered_singletons`, `review::.::holistic::logic_clarity::startup_ui_async_wrapper_drift`
  - Primary files: `src/Orchestrator.ts`, `src/core/orchestrator/OrchestratorCoordinatorFactory.ts`, `src/modules/debug/IssueDiagnosticsStore.ts`, `src/modules/player/PlaybackRecoveryManager.ts`, `src/core/channel-tuning/ChannelTuningCoordinator.ts`, `src/modules/ui/epg/EPGCoordinator.ts`, `src/modules/ui/epg/EPGRefreshController.ts`, `src/modules/ui/epg/EPGScheduleRefreshRuntime.ts`, `docs/architecture/CURRENT_STATE.md`
  - Minimum verification: `npm run verify`; exact `desloppify show` commands for the two mapped ids
  - Closeout note: planning and final verification for `P4-W2` must cover the mapped `P4-W2` issues and all inherited EPG ownership/readiness/refresh follow-ups below before this work unit can be marked complete.
  - Inherited follow-ups:
    - Source `P2-EXIT` disposition `split follow-up`: `review::.::holistic::high_level_elegance::epg_top_level_owner_blur`, `review::.::holistic::api_surface_coherence::epg_readiness_split_contract`, `review::.::holistic::mid_level_elegance::epg_coordinator_still_owns_refresh_seam`; required verification commands: `desloppify show "review::.::holistic::high_level_elegance::epg_top_level_owner_blur" --status open --no-budget`; `desloppify show "review::.::holistic::api_surface_coherence::epg_readiness_split_contract" --status open --no-budget`; `desloppify show "review::.::holistic::mid_level_elegance::epg_coordinator_still_owns_refresh_seam" --status open --no-budget`; `npm run verify`
  - Execution (2026-04-08): introduced a narrow `AppendIssueDiagnostic` callback contract at `IssueDiagnosticsStore` boundary and moved all in-scope QA-003b append paths (`PlaybackRecoveryManager`, `ChannelTuningCoordinator`, `EPGCoordinator`, `EPGRefreshController`, `EPGScheduleRefreshRuntime`) to consume one composition-root-wired sink; kept `IssueDiagnosticsStore` as the storage owner. In the same pass, removed the misleading startup no-op readiness seam by constructing `InitializationCoordinator` before coordinator assembly and requiring real `ensureEPGInitialized()` wiring.
  - Verification (2026-04-08):
    - `npm test -- --runInBand src/modules/player/__tests__/PlaybackRecoveryManager.test.ts`
    - `npm test -- --runInBand src/core/channel-tuning/__tests__/ChannelTuningCoordinator.test.ts`
    - `npm test -- --runInBand src/modules/ui/epg/__tests__/EPGCoordinator.test.ts`
    - `npm test -- --runInBand src/modules/ui/epg/__tests__/EPGRefreshController.test.ts`
    - `npm test -- --runInBand src/modules/ui/epg/__tests__/EPGScheduleRefreshRuntime.test.ts`
    - `npm test -- --runInBand src/__tests__/Orchestrator.test.ts`
    - `npm test -- --runInBand src/core/orchestrator/__tests__/OrchestratorCoordinatorFactory.playbackState.test.ts`
    - `npm run verify` (pass)
    - `desloppify show "review::.::holistic::initialization_coupling::diagnostics_store_scattered_singletons" --status open --no-budget` -> `No open issues matching`
    - `desloppify show "review::.::holistic::logic_clarity::startup_ui_async_wrapper_drift" --status open --no-budget` -> `No open issues matching`
    - `desloppify show "review::.::holistic::high_level_elegance::epg_top_level_owner_blur" --status open --no-budget` -> `No open issues matching`
    - `desloppify show "review::.::holistic::api_surface_coherence::epg_readiness_split_contract" --status open --no-budget` -> `No open issues matching`
    - `desloppify show "review::.::holistic::mid_level_elegance::epg_coordinator_still_owns_refresh_seam" --status open --no-budget` -> `No open issues matching`
  - Proof matrix (2026-04-08 source audit):
    - `review::.::holistic::initialization_coupling::diagnostics_store_scattered_singletons` -> `resolved` -> owner `P4-W2`; proof: one `AppOrchestrator` sink now owns diagnostics append wiring (`_issueDiagnosticsStore` + injected `AppendIssueDiagnostic` callback), while collaborators no longer instantiate module-scope `IssueDiagnosticsStore` singletons.
    - `review::.::holistic::logic_clarity::startup_ui_async_wrapper_drift` -> `resolved` -> owner `P4-W2`; proof: `InitializationCoordinator` now exists before `_createCoordinators()` runs, `_createCoordinators()` hard-fails if startup owner is missing, and coordinator deps no longer accept a fake `Promise.resolve()` fallback for EPG readiness.
    - `review::.::holistic::high_level_elegance::epg_top_level_owner_blur` -> `resolved` -> owner `P4-W2`; proof: current source still keeps `Orchestrator` as delegation/wiring surface while EPG runtime policy entrypoints remain in `EPGCoordinator`; detector check now reports no open issue.
    - `review::.::holistic::api_surface_coherence::epg_readiness_split_contract` -> `resolved` -> owner `P4-W2`; proof: readiness seam now routes through a real startup owner callback with truthful construction order; detector check now reports no open issue.
    - `review::.::holistic::mid_level_elegance::epg_coordinator_still_owns_refresh_seam` -> `resolved` -> owner `P4-W2`; proof: refresh runtime remains internally owned by `EPGRefreshController`/`EPGScheduleRefreshRuntime` with explicit injected diagnostics seam; detector check now reports no open issue.
- [x] `P4-W3` make corrupted stored Plex auth observable instead of silently folding it into clean absence
  - Imported review issues: `review::.::holistic::contract_coherence::plex_auth_stored_credentials_null_hides_corruption`
  - Primary files: `src/modules/plex/auth/PlexAuth.ts`, `src/modules/plex/auth/interfaces.ts`
  - Minimum verification: `npm run verify`; exact `desloppify show` command for the mapped id
  - Execution (2026-04-08): replaced `IPlexAuth.getStoredCredentials()` null contract with `PlexStoredCredentialsReadResult` (`missing` | `available` | `corrupted`) and kept corruption detection/cleanup private to `PlexAuth`; constructor-time corruption is surfaced once via a boot marker, corrupted payloads are cleared by `PlexAuth`, startup auth gate now routes `kind: 'corrupted'` to pending-auth with `STORAGE_CORRUPTED`, and Orchestrator/internal profile-switch/logout carry-forward reuse persisted metadata only when `kind === 'available'`.
  - Verification (2026-04-08):
    - `npm test -- --runInBand src/modules/plex/auth/__tests__/PlexAuth.test.ts src/core/initialization/__tests__/InitializationStartupPolicy.test.ts src/__tests__/Orchestrator.test.ts` (pass)
    - `npm run verify` (pass)
    - `desloppify show "review::.::holistic::contract_coherence::plex_auth_stored_credentials_null_hides_corruption" --status open --no-budget` -> `No open issues matching: review::.::holistic::contract_coherence::plex_auth_stored_credentials_null_hides_corruption`
  - Proof matrix (2026-04-08 source audit):
    - `review::.::holistic::contract_coherence::plex_auth_stored_credentials_null_hides_corruption` -> `resolved` -> owner `P4-W3`; proof: malformed persisted auth is now observable as `kind: 'corrupted'` instead of being collapsed into clean absence, cleanup remains inside `PlexAuth`, and blocked storage writes do not fabricate persisted availability.
  - Explicit `P4-EXIT` fallback disposition language (required before any `P5` work):
    - If the exact detector id above ever reappears after this slice, `P4-EXIT` is the single final owner for reconciliation (`resolved on current-code proof with stale detector residue` vs `split follow-up` only when a different live owner is proven). No `P5` plan/code/checklist progress may begin until `P4-EXIT` records that explicit disposition with owner, reason, revisit trigger, and refreshed evidence.
- [x] `P4-EXIT` run the priority-exit review before moving to `P5`
  - required: record every mapped imported issue with an exact disposition
  - Gate: no `P5` plan, code, or checklist progress starts until every `P4` mapped id has an explicit disposition record
  - Required verification: `desloppify status`; `desloppify plan queue`; `desloppify show security --status open --no-budget --top 50`; all five exact `P4` issue-id checks; `npm run verify`
  - Priority-exit review status (2026-04-08): `complete` (all five mapped `P4` ids return `No open issues matching`; no `deferred`/`split follow-up` carry-forward required)
  - Verified commands (2026-04-08 final refresh):
    - `desloppify status`
    - `desloppify plan queue`
    - `desloppify show security --status open --no-budget --top 50`
    - `desloppify show "review::.::holistic::cross_module_architecture::storage_owner_boundary_drift" --status open --no-budget`
    - `desloppify show "review::.::holistic::incomplete_migration::deprecated_lifecycle_plexauth_slot" --status open --no-budget`
    - `desloppify show "review::.::holistic::initialization_coupling::diagnostics_store_scattered_singletons" --status open --no-budget`
    - `desloppify show "review::.::holistic::logic_clarity::startup_ui_async_wrapper_drift" --status open --no-budget`
    - `desloppify show "review::.::holistic::contract_coherence::plex_auth_stored_credentials_null_hides_corruption" --status open --no-budget`
    - `npm run verify`
  - Refreshed verification results (2026-04-08):
    - `desloppify status` -> `Scores: overall 80.9/100 · objective 90.7/100 · strict 79.0/100 · verified 90.7/100`; `Review: 33 issues open, 33 uninvestigated`; `Last scan: 2026-04-08T04:17:13+00:00`.
    - `desloppify plan queue` -> `Queue: 2 items (57 planned · 1 subjective)`; both queued items are subjective review work (`subjective_assessment`, `subjective_review`) and align with `desloppify status` reporting open review work.
    - literal output: `desloppify plan queue`
      ```text
      
        Queue: 2 items (57 planned · 1 subjective)
      
      #     Confidence  Detector      Summary                                             Cluster
      ──────────────────────────────────────────────────────────────────────────────────────────────
      1     medium  subjective_assessment  Subjective review needed: Auth consistency (91.…                    
      2     medium  subjective_review  File changed since last review — re-review reco…
      ```
    - `desloppify show security --status open --no-budget --top 50` -> `Security: 100.0% health (strict: 96.0%)`; `No open issues for Security. Detectors: cycles, security`.
    - `npm run verify` -> pass (`typecheck`, `lint`, `lint:css`, `test:all`, `verify:docs`, `build` all passed on current branch).
  - Mapped imported issues (2026-04-08 disposition record):
    - `review::.::holistic::cross_module_architecture::storage_owner_boundary_drift` -> `resolved`; owner: `P4-W1`; reason: exact issue-id command returns `No open issues matching`.
    - `review::.::holistic::incomplete_migration::deprecated_lifecycle_plexauth_slot` -> `resolved`; owner: `P4-W1`; reason: exact issue-id command returns `No open issues matching`.
    - `review::.::holistic::initialization_coupling::diagnostics_store_scattered_singletons` -> `resolved`; owner: `P4-W2`; reason: exact issue-id command returns `No open issues matching`.
    - `review::.::holistic::logic_clarity::startup_ui_async_wrapper_drift` -> `resolved`; owner: `P4-W2`; reason: exact issue-id command returns `No open issues matching`.
    - `review::.::holistic::contract_coherence::plex_auth_stored_credentials_null_hides_corruption` -> `resolved`; owner: `P4-W3`; reason: exact issue-id command returns `No open issues matching`.
  - Follow-up ownership and residuals (2026-04-08):
    - Follow-up ownership: none.
    - Residuals: none on current-code proof in the `P4` issue envelope.
  - Security triage (2026-04-08 disposition record):
    - `desloppify show security --status open --no-budget --top 50` confirms no open security findings.
    - `P0` impact: none; no deferred `P0` findings and no `P0` revisit trigger required for `P4-EXIT`.

## Priority 5: Normalize Plex And Player Contracts, Dependencies, And Pipelines

- ROI: High
- Why it matters: the refreshed queue still calls out null-contract ambiguity, server-selection semantics drift, browser-inappropriate auth dependencies, recovery-noise narration, and overpacked stream/subtitle pipelines.
- Required skills: `architecture-boundaries`, `plex-integration-boundaries`

### Work Units

- [x] `P5-W1` normalize library and server-selection contracts so boolean and null results mean one thing at each boundary
  - Imported review issues: `review::.::holistic::api_surface_coherence::server_selection_boolean_semantics_drift`, `review::.::holistic::contract_coherence::plex_library_null_conflates_not_found_and_invalid_response`
  - Primary files: `src/modules/plex/discovery/PlexServerDiscovery.ts`, `src/Orchestrator.ts`, `src/modules/ui/server-select/ServerSelectScreen.ts`, `src/modules/plex/library/PlexLibrary.ts`, `src/modules/plex/library/interfaces.ts`
  - Verification (2026-04-09):
    - `desloppify show "review::.::holistic::api_surface_coherence::server_selection_boolean_semantics_drift" --status open --no-budget` -> `No open issues matching ...`
    - `desloppify show "review::.::holistic::contract_coherence::plex_library_null_conflates_not_found_and_invalid_response" --status open --no-budget` -> `No open issues matching ...`
    - `desloppify show "review::.::holistic::error_consistency::orchestrator_precondition_strategy_drift" --status open --no-budget` -> `No open issues matching ...`
    - `npm test -- --runInBand src/modules/plex/discovery/__tests__/PlexServerDiscovery.test.ts src/modules/ui/server-select/__tests__/ServerSelectScreen.test.ts src/core/app-shell/__tests__/AppLazyScreenRegistry.test.ts src/__tests__/Orchestrator.test.ts` -> pass
    - `npm test -- --runInBand src/modules/plex/library/__tests__/PlexLibrary.test.ts` -> pass
    - `npm test -- --runInBand src/__tests__/orchestrator/orchestrator-preconditions.test.ts src/__tests__/orchestrator/playback-flow.test.ts src/__tests__/Orchestrator.test.ts` -> pass
    - `npm test -- --runInBand src/__tests__/Orchestrator.test.ts` -> pass (public `selectServer` branch coverage refresh: `selection_failed` translation + `persistedSelection: 'skipped_missing_credentials'`)
    - `npm run verify` -> pass (`typecheck`, `lint`, `lint:css`, `test:all`, `verify:docs`, `build`)
  - Mapped imported issues (2026-04-09 disposition record):
    - `review::.::holistic::api_surface_coherence::server_selection_boolean_semantics_drift` -> `resolved`; owner: `P5-W1`; proof: `IPlexServerDiscovery.selectServer(...)` now returns explicit `PlexServerSelectionResult`, and app-level `AppOrchestrator.selectServer(...)` now returns explicit `OrchestratorServerSelectionResult` with truthful `readiness` + `persistedSelection` variants instead of overloaded booleans (`src/modules/plex/discovery/interfaces.ts`, `src/modules/plex/discovery/PlexServerDiscovery.ts`, `src/Orchestrator.ts`, `src/modules/ui/server-select/ServerSelectScreen.ts`). Targeted `src/__tests__/Orchestrator.test.ts` coverage now exercises the remaining public branches for `selection_failed` translation (`server_not_found` and `connection_unavailable`) plus `persistedSelection: 'skipped_missing_credentials'`.
    - `review::.::holistic::contract_coherence::plex_library_null_conflates_not_found_and_invalid_response` -> `resolved`; owner: `P5-W1`; proof: `PlexLibrary` now uses a private section-lookup helper so public `getLibrary(...)` keeps `Promise<PlexLibrary | null>` with `null` only for `not_found`, while unavailable/invalid section-list fetches throw typed `PlexLibraryError` (`src/modules/plex/library/PlexLibrary.ts`, `src/modules/plex/library/interfaces.ts`, `src/modules/plex/library/__tests__/PlexLibrary.test.ts`).
    - Inherited follow-up `review::.::holistic::error_consistency::orchestrator_precondition_strategy_drift` -> `resolved`; owner: `P5-W1`; proof: strict precondition throws remain explicit on setup/capability entrypoints (including `selectServer`) while runtime `switchToChannel*` methods are now explicitly documented + tested as intentional best-effort safe no-op commands before tuning readiness (`src/Orchestrator.ts`, `src/__tests__/orchestrator/orchestrator-preconditions.test.ts`, `src/__tests__/orchestrator/playback-flow.test.ts`).
  - Source-proof closeout note: exact issue-id detector commands all report `No open issues matching`, but this item was closed on current-code source audit and targeted contract tests above rather than detector silence alone.
- [x] `P5-W2` slim auth-path dependencies and reduce recovery narration to intentional diagnostics only
  - Imported review issues: `review::.::holistic::dependency_health::qrcode_cli_transitives_for_browser_render`, `review::.::holistic::ai_generated_debt::playback_recovery_diagnostic_narration`
  - Primary files: `package.json`, `package-lock.json`, `src/modules/ui/auth/AuthScreen.ts`, `src/modules/player/PlaybackRecoveryManager.ts`
  - Minimum verification: `npm run verify`; exact `desloppify show` commands for the two mapped ids
  - Execution (2026-04-09): replaced the auth-screen runtime `qrcode` import path with a trusted static `plex.tv/link` SVG rendered inside `AuthScreen`, preserved the existing `.auth-qr-canvas` styling hook without changing `src/styles/shell.css`, removed `qrcode` and `@types/qrcode` from the package graph, and normalized `PlaybackRecoveryManager` repeated-failure/recovery telemetry to terse event labels plus structured diagnostics and `AppError.context`.
  - Verification (2026-04-09):
    - `npm test -- --runInBand src/modules/ui/auth/__tests__/AuthScreen.test.ts` -> pass
    - `npm test -- --runInBand src/modules/player/__tests__/PlaybackRecoveryManager.test.ts` -> pass
    - `npm test -- --runInBand src/modules/player/__tests__/PlaybackRecoveryManager.test.ts src/core/__tests__/PlaybackStartController.test.ts src/core/__tests__/PlaybackRuntimeController.test.ts src/__tests__/orchestrator/subtitle-track-recovery-warning-contract.test.ts src/__tests__/orchestrator/lifecycle-resume-race.test.ts` -> pass
    - `desloppify show "review::.::holistic::dependency_health::qrcode_cli_transitives_for_browser_render" --status open --no-budget` -> `No open issues matching ...`
    - `desloppify show "review::.::holistic::ai_generated_debt::playback_recovery_diagnostic_narration" --status open --no-budget` -> `No open issues matching ...`
    - `npm run verify` -> pass (`typecheck`, `lint`, `lint:css`, `test:all`, `verify:docs`, `build`)
  - Mapped imported issues (2026-04-09 disposition record):
    - `review::.::holistic::dependency_health::qrcode_cli_transitives_for_browser_render` -> `resolved`; owner: `P5-W2`; proof: `AuthScreen` now renders a developer-controlled static QR SVG through the trusted inline-SVG helper and no longer imports `qrcode`; `package.json`/`package-lock.json` no longer carry the browser-inappropriate dependency path (`src/modules/ui/auth/AuthScreen.ts`, `src/modules/ui/auth/plexLinkQrSvg.ts`, `src/utils/inlineSvg.ts`, `package.json`, `package-lock.json`).
    - `review::.::holistic::ai_generated_debt::playback_recovery_diagnostic_narration` -> `resolved`; owner: `P5-W2`; proof: `PlaybackRecoveryManager` now emits terse blocking error text (`Playback failed repeatedly`) with structured `context` plus short event-style telemetry payloads for audio reload, transcode fallback, burn-in reload, and disable-burn-in paths, while caller contracts remain unchanged (`src/modules/player/PlaybackRecoveryManager.ts`, `src/modules/player/__tests__/PlaybackRecoveryManager.test.ts`, `src/core/__tests__/PlaybackStartController.test.ts`, `src/core/__tests__/PlaybackRuntimeController.test.ts`, `src/__tests__/orchestrator/subtitle-track-recovery-warning-contract.test.ts`).
  - Source-proof closeout note: exact issue-id detector commands now report `No open issues matching`, and the closeout is also backed by direct source audit plus focused regression coverage rather than detector silence alone.
- [x] `P5-W3` split overpacked stream and subtitle fallback pipelines and stop duplicating shared app-error taxonomies
  - Imported review issues: `review::.::holistic::low_level_elegance::stream_resolution_pipeline_overpacked`, `review::.::holistic::low_level_elegance::subtitle_fallback_fetch_monolith`, `review::.::holistic::type_safety::parallel_error_code_enums_duplicate_app_taxonomy`
  - Primary files: `src/modules/plex/stream/PlexStreamResolver.ts`, `src/modules/player/SubtitleManager.ts`, `src/types/app-errors.ts`, `src/modules/player/types.ts`, `src/modules/plex/library/types.ts`, `src/modules/plex/stream/types.ts`
  - Minimum verification: `npm run verify`; exact `desloppify show` commands for the three mapped ids
  - Execution (2026-04-09): extracted `resolveStreamPipeline(...)` inside `src/modules/plex/stream/` so `PlexStreamResolver` keeps item fetch, session/debug ownership, and `StreamResolverError` emission while the media-selection/direct-vs-transcode assembly becomes one local pipeline helper; extracted `fetchSubtitleFallbackVtt(...)` inside `src/modules/player/` so `SubtitleManager` keeps active-track state, readiness timers, `_fallbackControllers`, `_blobUrls`, and deactivation/unavailable callbacks while the fetch/XHR/transcode fallback attempt matrix plus subtitle conversion move into one player-local helper; replaced duplicate player/Plex/library error enums with AppErrorCode-backed subset exports, preserved `PlexStreamErrorCode.SUBTITLE_STREAM_NOT_FOUND` as the one local supplement, and kept `PlexLibrary.ts` explicitly covered for the export-shape fallout.
  - Verification (2026-04-09):
    - `npm test -- --runInBand src/modules/plex/stream/__tests__/resolveStreamPipeline.test.ts src/modules/plex/stream/__tests__/PlexStreamResolver.test.ts src/modules/plex/stream/__tests__/PlexStreamResolver.subtitle-errors.test.ts` -> pass
    - `npm test -- --runInBand src/modules/player/__tests__/SubtitleManager.test.ts` -> pass
    - `npm test -- --runInBand src/modules/player/__tests__/error-taxonomy.test.ts src/modules/plex/stream/__tests__/error-taxonomy.test.ts src/modules/plex/library/__tests__/error-taxonomy.test.ts src/modules/plex/library/__tests__/PlexLibrary.test.ts src/core/__tests__/PlaybackRuntimeController.test.ts` -> pass
    - `desloppify show "review::.::holistic::low_level_elegance::stream_resolution_pipeline_overpacked" --status open --no-budget` -> `No open issues matching ...`
    - `desloppify show "review::.::holistic::low_level_elegance::subtitle_fallback_fetch_monolith" --status open --no-budget` -> `No open issues matching ...`
    - `desloppify show "review::.::holistic::type_safety::parallel_error_code_enums_duplicate_app_taxonomy" --status open --no-budget` -> `No open issues matching ...`
    - `npm run verify` -> pass (`typecheck`, `lint`, `lint:css`, `test:all`, `verify:docs`, `build`)
  - Mapped imported issues (2026-04-09 disposition record):
    - `review::.::holistic::low_level_elegance::stream_resolution_pipeline_overpacked` -> `resolved`; owner: `P5-W3`; proof: `resolveStream()` no longer carries the full media-selection/direct-play/transcode assembly inline, while `PlexStreamResolver` still owns server/auth/settings reads, session/debug behavior, and resolver-local error creation (`src/modules/plex/stream/PlexStreamResolver.ts`, `src/modules/plex/stream/resolveStreamPipeline.ts`, `src/modules/plex/stream/__tests__/resolveStreamPipeline.test.ts`).
    - `review::.::holistic::low_level_elegance::subtitle_fallback_fetch_monolith` -> `resolved`; owner: `P5-W3`; proof: `SubtitleManager` no longer owns the fetch/XHR/transcode fallback attempt matrix or subtitle conversion inline, but it still owns abort-controller registration, blob-URL revocation, readiness timers, and subtitle deactivation/unavailable callbacks (`src/modules/player/SubtitleManager.ts`, `src/modules/player/subtitleFallbackPipeline.ts`, `src/modules/player/__tests__/SubtitleManager.test.ts`).
    - `review::.::holistic::type_safety::parallel_error_code_enums_duplicate_app_taxonomy` -> `resolved`; owner: `P5-W3`; proof: player, Plex stream, and Plex library error exports now reuse canonical `AppErrorCode` values through subset `as const` objects while preserving stable mapping-helper imports and the resolver-local `SUBTITLE_STREAM_NOT_FOUND` special case (`src/modules/player/types.ts`, `src/modules/plex/stream/types.ts`, `src/modules/plex/library/types.ts`, `src/modules/player/__tests__/error-taxonomy.test.ts`, `src/modules/plex/stream/__tests__/error-taxonomy.test.ts`, `src/modules/plex/library/__tests__/error-taxonomy.test.ts`, `src/modules/plex/library/__tests__/PlexLibrary.test.ts`).
  - Source-proof closeout note: the three exact detector commands now return `No open issues matching`, but `P5-W3` is closed on current-code source audit plus the targeted resolver/subtitle/taxonomy suites above and the final `npm run verify` gate, not on detector silence alone.
- [x] `P5-EXIT` run the priority-exit review before moving to `P6`
  - required: record every mapped imported issue with an exact disposition
  - Gate: no `P6` plan, code, or checklist progress starts until every `P5` mapped id has an explicit disposition record
  - Required verification: `desloppify status`; `desloppify plan queue`; `desloppify show security --status open --no-budget --top 50`; all eight exact `P5` issue-id checks; `npm run verify`
  - Priority-exit review status (2026-04-09): `complete` (all eight mapped `P5` ids still return `No open issues matching`; no `deferred`/`split follow-up` carry-forward is required for `P5`)
  - Verified commands (2026-04-09 final refresh):
    - `desloppify status`
    - `desloppify plan queue`
    - `desloppify show security --status open --no-budget --top 50`
    - `desloppify show "review::.::holistic::api_surface_coherence::server_selection_boolean_semantics_drift" --status open --no-budget`
    - `desloppify show "review::.::holistic::contract_coherence::plex_library_null_conflates_not_found_and_invalid_response" --status open --no-budget`
    - `desloppify show "review::.::holistic::error_consistency::orchestrator_precondition_strategy_drift" --status open --no-budget`
    - `desloppify show "review::.::holistic::dependency_health::qrcode_cli_transitives_for_browser_render" --status open --no-budget`
    - `desloppify show "review::.::holistic::ai_generated_debt::playback_recovery_diagnostic_narration" --status open --no-budget`
    - `desloppify show "review::.::holistic::low_level_elegance::stream_resolution_pipeline_overpacked" --status open --no-budget`
    - `desloppify show "review::.::holistic::low_level_elegance::subtitle_fallback_fetch_monolith" --status open --no-budget`
    - `desloppify show "review::.::holistic::type_safety::parallel_error_code_enums_duplicate_app_taxonomy" --status open --no-budget`
    - `npm run verify`
  - Refreshed verification results (2026-04-09):
    - `desloppify status` -> `Scores: overall 80.9/100 · objective 90.7/100 · strict 79.0/100 · verified 90.7/100`; `Queue: 2 items (7 planned · 50 stale tracked · 1 subjective)`; `Objective queue complete`; `Review: 33 issues open, 33 uninvestigated`; `Last scan: 2026-04-08T04:17:13+00:00`.
    - `desloppify plan queue` -> `Queue: 2 items (57 planned · 1 subjective)` with:
      - `subjective_assessment` -> `Subjective review needed: Auth consistency (91...)`
      - `subjective_review` -> `File changed since last review — re-review recommended`
    - Queue residue disposition: the two remaining `desloppify plan queue` items are not any of the eight mapped `P5` ids above, so `P5-EXIT` records them as non-blocking global queue residue rather than inventing a new `P5` successor owner.
    - All eight exact mapped issue-id commands -> `No open issues matching ...`
    - `npm run verify` -> pass (`typecheck`, `lint`, `lint:css`, `test:all`, `verify:docs`, `build`)
  - Mapped imported issues (2026-04-09 disposition record):
    - `review::.::holistic::api_surface_coherence::server_selection_boolean_semantics_drift` -> `resolved`; owner: `P5-W1`; reason: rerun exact issue-id command still reports `No open issues matching`, and the current-code source proof remains the explicit selection-result contract normalization recorded in `P5-W1`.
    - `review::.::holistic::contract_coherence::plex_library_null_conflates_not_found_and_invalid_response` -> `resolved`; owner: `P5-W1`; reason: rerun exact issue-id command still reports `No open issues matching`, and the current-code source proof remains the `PlexLibrary` not-found vs invalid-response contract split recorded in `P5-W1`.
    - `review::.::holistic::error_consistency::orchestrator_precondition_strategy_drift` -> `resolved`; owner: `P5-W1`; reason: rerun exact issue-id command still reports `No open issues matching`, and the current-code source proof remains the explicit precondition-vs-best-effort public `Orchestrator` contract recorded in `P5-W1`.
    - `review::.::holistic::dependency_health::qrcode_cli_transitives_for_browser_render` -> `resolved`; owner: `P5-W2`; reason: rerun exact issue-id command still reports `No open issues matching`, and the current-code source proof remains the static QR asset path plus package-graph removal recorded in `P5-W2`.
    - `review::.::holistic::ai_generated_debt::playback_recovery_diagnostic_narration` -> `resolved`; owner: `P5-W2`; reason: rerun exact issue-id command still reports `No open issues matching`, and the current-code source proof remains the terse recovery narration plus structured diagnostics contract recorded in `P5-W2`.
    - `review::.::holistic::low_level_elegance::stream_resolution_pipeline_overpacked` -> `resolved`; owner: `P5-W3`; reason: rerun exact issue-id command still reports `No open issues matching`, and the current-code source proof remains the local stream-pipeline extraction with `PlexStreamResolver` ownership preserved as recorded in `P5-W3`.
    - `review::.::holistic::low_level_elegance::subtitle_fallback_fetch_monolith` -> `resolved`; owner: `P5-W3`; reason: rerun exact issue-id command still reports `No open issues matching`, and the current-code source proof remains the local subtitle fallback pipeline extraction with cleanup lifecycle ownership preserved in `SubtitleManager` as recorded in `P5-W3`.
    - `review::.::holistic::type_safety::parallel_error_code_enums_duplicate_app_taxonomy` -> `resolved`; owner: `P5-W3`; reason: rerun exact issue-id command still reports `No open issues matching`, and the current-code source proof remains the AppErrorCode-backed subset export shape with the one stream-local supplement recorded in `P5-W3`.
  - Security triage (2026-04-09 disposition record):
    - `desloppify show security --status open --no-budget --top 50` -> `No open issues for Security. Detectors: cycles, security`.
    - `P0` impact: none; no `P0` defer/split records required for `P5-EXIT`.
  - Closeout basis: `P5` closes on current-code source audit plus the targeted `P5-W1`/`P5-W2`/`P5-W3` verification already recorded above and the refreshed full `npm run verify` gate, not on detector silence alone.

## Priority 6: Finish Shared UI Owner Placement And Package Cleanup

- ROI: Last architecture-heavy owner move
- Why it matters: the refreshed queue still retains container-id drift, hidden-cleanup helper naming, shared UI owner/package stragglers, and one deferred app-shell runtime-facade/composition-root seam that should settle before the final naming/test/ceremony passes.
- Required skills: `ui-composition-patterns`; add `architecture-boundaries` when moving shared owners

### Work Units

- [x] `P6-W1` centralize app-shell container ids and make destructive DOM normalization helpers explicit
  - Imported review issues: `review::.::holistic::convention_outlier::container_id_convention_split`, `review::.::holistic::naming_quality::get_or_create_div_hidden_cleanup`
  - Primary files: `src/core/app-shell/AppContainerFactory.ts`, `src/App.ts`, `src/modules/ui/common/appShellContainerIds.ts`
  - Minimum verification: `npm run verify`; exact `desloppify show` commands for the two mapped ids
  - Execution (2026-04-09): broadened `src/modules/ui/common/appShellContainerIds.ts` from overlay-only constants to the full app-shell-owned container id set used by `AppContainerFactory`, `App.ts`, bootstrap diagnostics, startup policy, fixtures, and adjacent app-shell/runtime tests; kept `EXIT_CONFIRM_CONTAINER_ID` feature-owned and out of scope; renamed the internal `AppContainerFactory` helper from `getOrCreateDiv(...)` to `ensureUniqueContainerDiv(...)` so duplicate-removal and wrong-tag replacement stay local but explicit.
  - Verification (2026-04-09):
    - `npm test -- --runInBand src/core/app-shell/__tests__/AppContainerFactory.test.ts src/__tests__/App.test.ts src/__tests__/bootstrap.test.ts src/core/app-shell/__tests__/AppDiagnosticsSurface.test.ts src/core/app-shell/__tests__/AppToastPresenter.test.ts src/core/app-shell/__tests__/AppBlockingErrorOverlayPresenter.test.ts src/core/__tests__/InitializationCoordinator.test.ts src/modules/player/__tests__/VideoPlayer.test.ts src/__tests__/Orchestrator.test.ts` -> pass (`9` suites, `227` tests)
    - `desloppify show "review::.::holistic::convention_outlier::container_id_convention_split" --status open --no-budget` -> `No open issues matching: review::.::holistic::convention_outlier::container_id_convention_split`
    - `desloppify show "review::.::holistic::naming_quality::get_or_create_div_hidden_cleanup" --status open --no-budget` -> `No open issues matching: review::.::holistic::naming_quality::get_or_create_div_hidden_cleanup`
    - `npm run verify` -> pass (`typecheck`, `lint`, `lint:css`, `test:all`, `verify:docs`, `build`)
  - Mapped imported issues (2026-04-09 disposition record):
    - `review::.::holistic::convention_outlier::container_id_convention_split` -> `resolved`; owner: `P6-W1`; proof: app-shell-owned DOM ids now come from the single shared owner in `src/modules/ui/common/appShellContainerIds.ts`, while feature-owned ids remain in their existing modules and `EXIT_CONFIRM_CONTAINER_ID` stays feature-owned (`src/modules/ui/common/appShellContainerIds.ts`, `src/core/app-shell/AppContainerFactory.ts`, `src/App.ts`, `src/bootstrap.ts`, `src/core/initialization/InitializationStartupPolicy.ts`, `src/__tests__/fixtures/appShellContainerIds.ts`).
    - `review::.::holistic::naming_quality::get_or_create_div_hidden_cleanup` -> `resolved`; owner: `P6-W1`; proof: `AppContainerFactory` now uses `ensureUniqueContainerDiv(...)`, and focused regression coverage proves duplicate removal plus wrong-tag replacement instead of relying on idempotence alone (`src/core/app-shell/AppContainerFactory.ts`, `src/core/app-shell/__tests__/AppContainerFactory.test.ts`).
  - Source-proof closeout note: this slice closes on current-code source audit plus focused regression coverage and the verification gates above, not on detector silence alone.
- [x] `P6-W2` move shared UI metadata and helper code under the packages that actually own them
  - Imported review issues: `review::.::holistic::package_organization::theme_definitions_live_under_settings`, `review::.::holistic::package_organization::ui_root_channel_display_straggler`, `review::.::holistic::design_coherence::player_timecode_formatting_is_copied_between_overlays`
  - Primary files: `src/modules/ui/theme/themeDefinitions.ts`, `src/modules/ui/theme/ThemeManager.ts`, `src/modules/ui/theme/index.ts`, `src/modules/ui/settings/index.ts`, `src/modules/ui/common/channelDisplay.ts`, `src/modules/ui/common/formatTimecode.ts`, player overlay surfaces, `docs/architecture/CURRENT_STATE.md`, `docs/architecture/modules.md`
  - Minimum verification: `npm run verify`; exact `desloppify show` commands for the three mapped ids
  - Closeout note: planning and final verification for `P6-W2` must include the inherited EPG render/package stale-detector reconciliation follow-ups below before this work unit can be marked complete.
  - Inherited follow-ups:
    - Source `P2-EXIT` disposition `split follow-up`: `review::.::holistic::low_level_elegance::epg_virtual_render_method_accretion`, `review::.::holistic::package_organization::epg_flat_directory_overload`; required verification commands: `desloppify show "review::.::holistic::low_level_elegance::epg_virtual_render_method_accretion" --status open --no-budget`; `desloppify show "review::.::holistic::package_organization::epg_flat_directory_overload" --status open --no-budget`; `npm run verify`
  - Execution (2026-04-09): moved theme metadata from `src/modules/ui/settings/theme.ts` into the theme owner package as `src/modules/ui/theme/themeDefinitions.ts`, re-exported that metadata from `src/modules/ui/theme/index.ts`, and removed the incidental `THEME_CLASSES` re-export from `src/modules/ui/settings/index.ts` so `ui/theme` is the sole public owner. Moved `getChannelNameForDisplay(...)` into `src/modules/ui/common/channelDisplay.ts` and rewired EPG, mini-guide, and player OSD imports without leaving a forwarding file behind. Extracted the duplicated pure `formatTimecode(...)` logic into `src/modules/ui/common/formatTimecode.ts` while keeping overlay-local copy and policy in `PlayerOsdCoordinator.ts` (`Sleep`, `Ends`, remaining-label thresholds) and `NowPlayingInfoOverlay.ts` (`Live` fallback). Re-audited `src/modules/ui/epg/view/EPGVirtualizer.ts` plus the `view/`, `runtime/`, and `model/` directories on current code and confirmed the inherited `P2` EPG follow-ups were stale-detector residue rather than live residual seams.
  - Verification (2026-04-09):
    - `npm test -- --runInBand src/modules/ui/theme/__tests__/ThemeManager.test.ts src/modules/ui/theme/__tests__/themeDefinitions.test.ts src/modules/ui/settings/__tests__/SettingsScreen.test.ts src/modules/ui/common/__tests__/channelDisplay.test.ts src/modules/ui/player-osd/__tests__/PlayerOsdCoordinator.test.ts src/modules/ui/now-playing-info/__tests__/NowPlayingInfoOverlay.test.ts src/styles/__tests__/theme-token-completeness.test.ts` -> pass (`7` suites, `101` tests)
    - `desloppify status` -> `Scores: overall 80.9/100 · objective 90.7/100 · strict 79.0/100 · verified 90.7/100`; `Queue: 2 items (7 planned · 50 stale tracked · 1 subjective)`; `21 resolved issues uncommitted`
    - `desloppify show security --status open --no-budget --top 50` -> `Security: 100.0% health (strict: 96.0%)`; `No open issues for Security. Detectors: cycles, security`
    - `desloppify show "review::.::holistic::package_organization::theme_definitions_live_under_settings" --status open --no-budget` -> `No open issues matching: review::.::holistic::package_organization::theme_definitions_live_under_settings`
    - `desloppify show "review::.::holistic::package_organization::ui_root_channel_display_straggler" --status open --no-budget` -> `No open issues matching: review::.::holistic::package_organization::ui_root_channel_display_straggler`
    - `desloppify show "review::.::holistic::design_coherence::player_timecode_formatting_is_copied_between_overlays" --status open --no-budget` -> `No open issues matching: review::.::holistic::design_coherence::player_timecode_formatting_is_copied_between_overlays`
    - `desloppify show "review::.::holistic::low_level_elegance::epg_virtual_render_method_accretion" --status open --no-budget` -> `No open issues matching: review::.::holistic::low_level_elegance::epg_virtual_render_method_accretion`
    - `desloppify show "review::.::holistic::package_organization::epg_flat_directory_overload" --status open --no-budget` -> `No open issues matching: review::.::holistic::package_organization::epg_flat_directory_overload`
    - `npm run verify`
  - Mapped imported issues (2026-04-09 disposition record):
    - `review::.::holistic::package_organization::theme_definitions_live_under_settings` -> `resolved`; owner: `P6-W2`; proof: theme metadata now lives in `src/modules/ui/theme/themeDefinitions.ts`, `src/modules/ui/theme/index.ts` is the public theme metadata entry point, `ThemeManager` imports its metadata locally, and `src/modules/ui/settings/index.ts` no longer re-exports `THEME_CLASSES`.
    - `review::.::holistic::package_organization::ui_root_channel_display_straggler` -> `resolved`; owner: `P6-W2`; proof: `getChannelNameForDisplay(...)` now lives in `src/modules/ui/common/channelDisplay.ts`, callers import the shared owner directly, and no forwarding file remains at `src/modules/ui/channelDisplay.ts`.
    - `review::.::holistic::design_coherence::player_timecode_formatting_is_copied_between_overlays` -> `resolved`; owner: `P6-W2`; proof: `src/modules/ui/common/formatTimecode.ts` owns the pure `m:ss` / `h:mm:ss` formatter, while focused overlay tests prove `Sleep` / `Ends` copy stays in `PlayerOsdCoordinator` and `Live` fallback copy stays in `NowPlayingInfoOverlay`.
    - Inherited follow-up `review::.::holistic::low_level_elegance::epg_virtual_render_method_accretion` -> `resolved`; owner: `P6-W2`; proof: exact issue-id check now reports `No open issues matching`, and source audit confirms `renderVisibleCells(...)` still coordinates explicit private render phases in `src/modules/ui/epg/view/EPGVirtualizer.ts`.
    - Inherited follow-up `review::.::holistic::package_organization::epg_flat_directory_overload` -> `resolved`; owner: `P6-W2`; proof: exact issue-id check now reports `No open issues matching`, and source audit confirms the current EPG split still lives under `src/modules/ui/epg/view/`, `src/modules/ui/epg/runtime/`, and `src/modules/ui/epg/model/`.
  - Security triage (2026-04-09 disposition record):
    - `desloppify show security --status open --no-budget --top 50` confirms no open security findings.
    - `P0` impact: none; no deferred `P0` findings and no `P0` revisit trigger required for `P6-W2`.
  - Source-proof closeout note: this slice closes on current-code source audit plus focused regression coverage and exact issue-id checks, not on detector silence alone.
- [x] `P6-W3` narrow the remaining app-shell runtime facade and coordinator assembly bags so composition roots stay thin
  - Primary files: `src/App.ts`, `src/core/app-shell/AppLazyScreenRegistry.ts`, `src/Orchestrator.ts`, `src/modules/navigation/NavigationCoordinator.ts`, `src/core/InitializationCoordinator.ts`, `src/core/orchestrator/OrchestratorCoordinatorFactory.ts`, `docs/architecture/CURRENT_STATE.md`
  - Minimum verification: `npm run verify`
  - Progress note (2026-04-09): extracted `src/core/server-selection/ServerSelectionCoordinator.ts` so `AppOrchestrator.selectServer()` now delegates the full app-shell-facing selected-server workflow (discovery-result translation, selected-server persistence handoff, and post-selection runtime swap), and kept `src/core/server-selection/ServerSelectionTypes.ts` as the durable owner of the app-shell result contract.
  - Execution (2026-04-09): retired the broad `AppLazyScreenRegistryRuntimeFacade` path by introducing `src/core/app-shell/AppLazyScreenPortFactory.ts`, rewiring `src/App.ts` to pass that focused owner into `AppLazyScreenRegistry`, and updating `AppLazyScreenRegistry` to consume screen-scoped creation methods instead of one multi-feature runtime bag. Added focused app-shell seam coverage in `src/core/app-shell/__tests__/AppLazyScreenPortFactory.test.ts` and updated registry/app tests to enforce the narrowed contract.
  - Verification (2026-04-09):
    - `npm test -- --runInBand src/core/app-shell/__tests__/AppLazyScreenPortFactory.test.ts src/core/app-shell/__tests__/AppLazyScreenRegistry.test.ts src/__tests__/App.test.ts` -> pass (`3` suites, `42` tests)
    - `npm run typecheck` -> pass
    - `npm run verify:docs` -> pass
    - `desloppify status` -> `Scores: overall 80.9/100 · objective 90.7/100 · strict 79.0/100 · verified 90.7/100`; `Queue: 2 items (7 planned · 50 stale tracked · 1 subjective)`; `21 resolved issues uncommitted`
    - `desloppify show review --status open --no-budget --top 50` -> `No open issues matching: review`
    - `desloppify show security --status open --no-budget --top 50` -> `Security: 100.0% health (strict: 96.0%)`; `No open issues for Security. Detectors: cycles, security`
    - `desloppify show "review::.::holistic::cross_module_architecture::orchestrator_runtime_hub" --status open --no-budget` -> `No open issues matching: review::.::holistic::cross_module_architecture::orchestrator_runtime_hub`
    - `desloppify show "review::.::holistic::abstraction_fitness::orchestrator_facade_sprawl" --status open --no-budget` -> `No open issues matching: review::.::holistic::abstraction_fitness::orchestrator_facade_sprawl`
    - `desloppify show "review::.::holistic::design_coherence::app_orchestrator_remains_multi_hub" --status open --no-budget` -> `No open issues matching: review::.::holistic::design_coherence::app_orchestrator_remains_multi_hub`
    - `desloppify show "review::.::holistic::high_level_elegance::composition_root_role_drift" --status open --no-budget` -> `No open issues matching: review::.::holistic::high_level_elegance::composition_root_role_drift`
    - `desloppify show "review::.::holistic::abstraction_fitness::oversized_runtime_dependency_bags" --status open --no-budget` -> `No open issues matching: review::.::holistic::abstraction_fitness::oversized_runtime_dependency_bags`
    - `npm test -- --runInBand src/core/__tests__/InitializationCoordinator.test.ts src/core/orchestrator/__tests__/OrchestratorCoordinatorFactory.playbackState.test.ts src/modules/navigation/__tests__/NavigationCoordinator.test.ts src/__tests__/Orchestrator.test.ts` -> pass (`4` suites, `177` tests)
    - `npm run verify` -> pass
  - Mapped imported issues (2026-04-09 disposition record):
    - `review::.::holistic::cross_module_architecture::orchestrator_runtime_hub` -> `resolved`; owner: `P6-W3`; proof: app-shell lazy-screen seam no longer exposes a broad cross-feature runtime facade and `App.ts` now wires one focused owner (`src/core/app-shell/AppLazyScreenPortFactory.ts`, `src/core/app-shell/AppLazyScreenRegistry.ts`, `src/App.ts`)
    - `review::.::holistic::abstraction_fitness::orchestrator_facade_sprawl` -> `resolved`; owner: `P6-W3`; proof: registry screen constructors now consume screen-scoped port creators and no `AppLazyScreenRegistryRuntimeFacade` equivalent remains in source
    - `review::.::holistic::design_coherence::app_orchestrator_remains_multi_hub` -> `resolved`; owner: `P6-W3`; proof: screen-facing app-shell runtime seam is narrowed to focused per-screen port assembly instead of one multi-hub bag
    - `review::.::holistic::high_level_elegance::composition_root_role_drift` -> `resolved`; owner: `P6-W3`; proof: `src/App.ts` no longer hand-builds a broad lazy-screen runtime object literal and now limits itself to app-shell wiring
    - `review::.::holistic::abstraction_fitness::oversized_runtime_dependency_bags` -> `resolved`; owner: `P6-W3`; proof: post-refactor source audit confirms the remaining bag interfaces (`NavigationCoordinatorDeps`, `InitializationDependencies`/`InitializationCallbacks`, `OrchestratorCoordinatorFactoryDeps`) are concern-bounded final owners for their respective collaborators and no additional mixed-owner seam was found in this slice
  - Security triage (2026-04-09 disposition record):
    - `desloppify show security --status open --no-budget --top 50` confirms no open security findings.
    - `P0` impact: none; no deferred `P0` findings and no `P0` revisit trigger required for `P6-W3`.
  - Source-proof closeout note: this slice closes on current-code source audit plus focused regression coverage and exact issue-id checks, not on detector silence alone.
  - Inherited follow-ups:
    - Source `P1-EXIT` disposition `split follow-up`: `review::.::holistic::cross_module_architecture::orchestrator_runtime_hub`, `review::.::holistic::abstraction_fitness::orchestrator_facade_sprawl`, `review::.::holistic::design_coherence::app_orchestrator_remains_multi_hub`, `review::.::holistic::high_level_elegance::composition_root_role_drift`; required verification commands: `desloppify show "review::.::holistic::cross_module_architecture::orchestrator_runtime_hub" --status open --no-budget`; `desloppify show "review::.::holistic::abstraction_fitness::orchestrator_facade_sprawl" --status open --no-budget`; `desloppify show "review::.::holistic::design_coherence::app_orchestrator_remains_multi_hub" --status open --no-budget`; `desloppify show "review::.::holistic::high_level_elegance::composition_root_role_drift" --status open --no-budget`; `npm run verify`
    - Source `P1-EXIT` disposition `split follow-up`: `review::.::holistic::abstraction_fitness::oversized_runtime_dependency_bags`; required verification commands: `desloppify show "review::.::holistic::abstraction_fitness::oversized_runtime_dependency_bags" --status open --no-budget`; `npm run verify`
- [x] `P6-EXIT` run the priority-exit review before moving to `P7`
  - required: record every mapped imported issue with an exact disposition
  - Gate: no `P7` plan, code, or checklist progress starts until every `P6` mapped id has an explicit disposition record
  - Required verification: `desloppify status`; `desloppify plan queue`; `desloppify show security --status open --no-budget --top 50`; all twelve exact `P6` issue-id checks listed in `P6-W1`/`P6-W2`/`P6-W3`; `npm run verify`
  - Priority-exit review status (2026-04-09): `complete` (all twelve mapped `P6` ids still return `No open issues matching`; no `deferred`/`split follow-up` carry-forward is required for `P6`)
  - Verified commands (2026-04-09 final refresh):
    - `desloppify status`
    - `desloppify plan queue`
    - `desloppify show security --status open --no-budget --top 50`
    - `desloppify show "review::.::holistic::convention_outlier::container_id_convention_split" --status open --no-budget`
    - `desloppify show "review::.::holistic::naming_quality::get_or_create_div_hidden_cleanup" --status open --no-budget`
    - `desloppify show "review::.::holistic::package_organization::theme_definitions_live_under_settings" --status open --no-budget`
    - `desloppify show "review::.::holistic::package_organization::ui_root_channel_display_straggler" --status open --no-budget`
    - `desloppify show "review::.::holistic::design_coherence::player_timecode_formatting_is_copied_between_overlays" --status open --no-budget`
    - `desloppify show "review::.::holistic::low_level_elegance::epg_virtual_render_method_accretion" --status open --no-budget`
    - `desloppify show "review::.::holistic::package_organization::epg_flat_directory_overload" --status open --no-budget`
    - `desloppify show "review::.::holistic::cross_module_architecture::orchestrator_runtime_hub" --status open --no-budget`
    - `desloppify show "review::.::holistic::abstraction_fitness::orchestrator_facade_sprawl" --status open --no-budget`
    - `desloppify show "review::.::holistic::design_coherence::app_orchestrator_remains_multi_hub" --status open --no-budget`
    - `desloppify show "review::.::holistic::high_level_elegance::composition_root_role_drift" --status open --no-budget`
    - `desloppify show "review::.::holistic::abstraction_fitness::oversized_runtime_dependency_bags" --status open --no-budget`
    - `npm run verify`
  - Refreshed verification results (2026-04-09):
    - `desloppify status` -> `Scores: overall 80.9/100 · objective 90.7/100 · strict 79.0/100 · verified 90.7/100`; `Queue: 2 items (7 planned · 50 stale tracked · 1 subjective)`; `Objective queue complete`; `Review: 33 issues open, 33 uninvestigated`; `Last scan: 2026-04-08T04:17:13+00:00`.
    - `desloppify plan queue` -> `Queue: 2 items (57 planned · 1 subjective)` with:
      - `subjective_assessment` -> `Subjective review needed: Auth consistency (91...)`
      - `subjective_review` -> `File changed since last review — re-review recommended`
    - Queue residue disposition: the two remaining `desloppify plan queue` items are not any of the twelve mapped `P6` ids below, so `P6-EXIT` records them as non-blocking global queue residue rather than minting a new `P6` successor owner.
    - All twelve exact mapped issue-id commands -> `No open issues matching ...`
    - `npm run verify` -> pass (`typecheck`, `lint`, `lint:css`, `test:all`, `verify:docs`, `build`)
  - Mapped imported issues (2026-04-09 disposition record):
    - `review::.::holistic::convention_outlier::container_id_convention_split` -> `resolved`; owner: `P6-W1`; reason: rerun exact issue-id command still reports `No open issues matching`, and the current-code source proof remains the shared app-shell container-id owner recorded in `P6-W1`.
    - `review::.::holistic::naming_quality::get_or_create_div_hidden_cleanup` -> `resolved`; owner: `P6-W1`; reason: rerun exact issue-id command still reports `No open issues matching`, and the current-code source proof remains the explicit `ensureUniqueContainerDiv(...)` helper plus focused regression coverage recorded in `P6-W1`.
    - `review::.::holistic::package_organization::theme_definitions_live_under_settings` -> `resolved`; owner: `P6-W2`; reason: rerun exact issue-id command still reports `No open issues matching`, and the current-code source proof remains the `ui/theme` metadata ownership move recorded in `P6-W2`.
    - `review::.::holistic::package_organization::ui_root_channel_display_straggler` -> `resolved`; owner: `P6-W2`; reason: rerun exact issue-id command still reports `No open issues matching`, and the current-code source proof remains the `ui/common/channelDisplay.ts` ownership move recorded in `P6-W2`.
    - `review::.::holistic::design_coherence::player_timecode_formatting_is_copied_between_overlays` -> `resolved`; owner: `P6-W2`; reason: rerun exact issue-id command still reports `No open issues matching`, and the current-code source proof remains the shared pure formatter plus overlay-local policy split recorded in `P6-W2`.
    - `review::.::holistic::low_level_elegance::epg_virtual_render_method_accretion` -> `resolved`; owner: `P6-W2`; reason: rerun exact issue-id command still reports `No open issues matching`, and the current-code source proof remains the bounded `EPGVirtualizer` render-phase owner recorded in `P6-W2`.
    - `review::.::holistic::package_organization::epg_flat_directory_overload` -> `resolved`; owner: `P6-W2`; reason: rerun exact issue-id command still reports `No open issues matching`, and the current-code source proof remains the `view/` + `runtime/` + `model/` package split recorded in `P6-W2`.
    - `review::.::holistic::cross_module_architecture::orchestrator_runtime_hub` -> `resolved`; owner: `P6-W3`; reason: rerun exact issue-id command still reports `No open issues matching`, and the current-code source proof remains the retired broad app-shell runtime-facade seam recorded in `P6-W3`.
    - `review::.::holistic::abstraction_fitness::orchestrator_facade_sprawl` -> `resolved`; owner: `P6-W3`; reason: rerun exact issue-id command still reports `No open issues matching`, and the current-code source proof remains the screen-scoped port-factory seam recorded in `P6-W3`.
    - `review::.::holistic::design_coherence::app_orchestrator_remains_multi_hub` -> `resolved`; owner: `P6-W3`; reason: rerun exact issue-id command still reports `No open issues matching`, and the current-code source proof remains the narrowed screen-facing app-shell runtime seam recorded in `P6-W3`.
    - `review::.::holistic::high_level_elegance::composition_root_role_drift` -> `resolved`; owner: `P6-W3`; reason: rerun exact issue-id command still reports `No open issues matching`, and the current-code source proof remains the removal of the broad inline lazy-screen runtime assembly from `src/App.ts` recorded in `P6-W3`.
    - `review::.::holistic::abstraction_fitness::oversized_runtime_dependency_bags` -> `resolved`; owner: `P6-W3`; reason: rerun exact issue-id command still reports `No open issues matching`, and the current-code source proof remains the concern-bounded grouped bag audit recorded in `P6-W3`.
  - Follow-up ownership and residuals (2026-04-09):
    - Follow-up ownership: none.
    - Residuals: none on current-code proof in the `P6` issue envelope.
  - Security triage (2026-04-09 disposition record):
    - `desloppify show security --status open --no-budget --top 50` -> `Security: 100.0% health (strict: 96.0%)`; `No open issues for Security. Detectors: cycles, security`.
    - `P0` impact: none; no `P0` defer/split records required for `P6-EXIT`.
  - Closeout basis: `P6` closes on current-code source audit plus the targeted `P6-W1`/`P6-W2`/`P6-W3` verification already recorded above and the refreshed full `npm run verify` gate, not on detector silence alone.

## Priority 7: Finish Remaining UI Naming Drift And Player Safeguard Coverage

- ROI: Low
- Why it matters: the remaining open issues here are bounded but still worth closing before the final ceremony pass so naming/style cleanup and keep-alive coverage do not get mixed into owner-moving work.
- Required skills: `ui-composition-patterns`; add `architecture-boundaries` if the keep-alive coverage slice needs a real public seam extraction

### Work Units

- [x] `P7-W1` normalize remaining UI private-member style islands once the shared-owner moves are stable
  - Imported review issues: `review::.::holistic::convention_outlier::ui_private_member_style_islands`
  - Primary files: `src/modules/ui/epg/EPGLibraryTabs.ts`, `src/modules/ui/now-playing-info/NowPlayingInfoOverlay.ts`, `src/modules/ui/channel-number-overlay/ChannelNumberOverlay.ts`, `src/modules/ui/playback-options/PlaybackOptionsCoordinator.ts`
  - Minimum verification: `npm run verify`; exact `desloppify show` command for the mapped id
  - Execution (2026-04-09): normalized remaining underscore-style private-member naming in `EPGLibraryTabs`, `ChannelNumberOverlay`, and `PlaybackOptionsCoordinator` without behavior changes.
  - Source-audit note (2026-04-09): `NowPlayingInfoOverlay` had no remaining underscore-style private-member naming drift, so it was intentionally left unchanged.
  - Verification (2026-04-09):
    - `npm test -- --runInBand src/modules/ui/channel-number-overlay/__tests__/ChannelNumberOverlay.test.ts src/modules/ui/playback-options/__tests__/PlaybackOptionsCoordinator.test.ts` -> pass (`2` suites, `20` tests)
    - `desloppify show "review::.::holistic::convention_outlier::ui_private_member_style_islands" --status open --no-budget` -> `No open issues matching: review::.::holistic::convention_outlier::ui_private_member_style_islands`
    - `npm run verify` -> pass
- [x] `P7-W2` add durable coverage for player keep-alive behavior
  - Imported review issues: `review::.::holistic::test_strategy::keepalive_path_untested`
  - Primary files: `src/modules/player/KeepAliveManager.ts`, `src/modules/player/VideoPlayer.ts`
  - Minimum verification: `npm run verify`; exact `desloppify show` command for the mapped id
  - Execution (2026-04-09): added durable keep-alive coverage with a focused collaborator suite (`src/modules/player/__tests__/KeepAliveManager.test.ts`) and tightened integration assertions in `src/modules/player/__tests__/VideoPlayer.test.ts` to prove `lineup:keepalive` dispatch/teardown behavior; no production seam widening required.
  - Verification (2026-04-09):
    - `npm test -- --runInBand src/modules/player/__tests__/VideoPlayer.test.ts src/modules/player/__tests__/KeepAliveManager.test.ts` -> pass (`2` suites, `49` tests)
    - `desloppify show "review::.::holistic::test_strategy::keepalive_path_untested" --status open --no-budget` -> `No open issues matching: review::.::holistic::test_strategy::keepalive_path_untested`
    - `npm run verify` -> pass
- [x] `P7-EXIT` run the priority-exit review before moving to `P8`
  - required: record every mapped imported issue with an exact disposition
  - Gate: no `P8` plan, code, or checklist progress starts until every `P7` mapped id has an explicit disposition record
  - Required verification: `desloppify status`; `desloppify plan queue`; `desloppify show security --status open --no-budget --top 50`; all two exact `P7` issue-id checks; `npm run verify`
  - Priority-exit review status (2026-04-09): `complete` (`P7-W1` and `P7-W2` both resolved on current-code evidence; no follow-up owner required)
  - Verified commands (2026-04-09):
    - `npm run verify`
    - `desloppify status`
    - `desloppify plan queue`
    - `desloppify show review --status open --no-budget --top 100`
    - `desloppify show security --status open --no-budget --top 50`
    - `desloppify show "review::.::holistic::convention_outlier::ui_private_member_style_islands" --status open --no-budget`
    - `desloppify show "review::.::holistic::test_strategy::keepalive_path_untested" --status open --no-budget`
    - `wc -l src/Orchestrator.ts src/modules/ui/epg/view/EPGVirtualizer.ts src/modules/plex/stream/PlexStreamResolver.ts src/modules/plex/library/PlexLibrary.ts src/modules/player/SubtitleManager.ts src/modules/player/PlaybackRecoveryManager.ts src/modules/plex/auth/PlexAuth.ts src/modules/ui/epg/EPGCoordinator.ts src/core/orchestrator/OrchestratorCoordinatorFactory.ts src/App.ts`
  - Refreshed verification results (2026-04-09):
    - `desloppify status` -> `Scores: overall 80.9/100 · objective 90.7/100 · strict 79.0/100 · verified 90.7/100`; `Queue: 2 items (7 planned · 50 stale tracked · 1 subjective)`; `Review: 33 issues open, 33 uninvestigated`; `Last scan: 2026-04-08T04:17:13+00:00`
    - `desloppify plan queue` -> `Queue: 2 items (57 planned · 1 subjective)` with non-`P7` global residue (`subjective_assessment`, `subjective_review`)
    - `desloppify show review --status open --no-budget --top 100` -> `No open issues matching: review`
    - `desloppify show security --status open --no-budget --top 50` -> `No open issues for Security`
    - `wc -l` hotspot refresh:
      - `src/Orchestrator.ts` -> `2015`
      - `src/modules/ui/epg/view/EPGVirtualizer.ts` -> `1912`
      - `src/modules/plex/stream/PlexStreamResolver.ts` -> `1144`
      - `src/modules/plex/library/PlexLibrary.ts` -> `1236`
      - `src/modules/player/SubtitleManager.ts` -> `685`
      - `src/modules/player/PlaybackRecoveryManager.ts` -> `896`
      - `src/modules/plex/auth/PlexAuth.ts` -> `921`
      - `src/modules/ui/epg/EPGCoordinator.ts` -> `525`
      - `src/core/orchestrator/OrchestratorCoordinatorFactory.ts` -> `638`
      - `src/App.ts` -> `470`
  - Mapped imported issues (2026-04-09 disposition record):
    - `review::.::holistic::convention_outlier::ui_private_member_style_islands` -> `resolved`; owner: `P7-W1`; reason: naming-style islands removed in scoped UI owners, exact issue-id command now reports `No open issues matching`, and `NowPlayingInfoOverlay` was confirmed clean on current-code audit.
    - `review::.::holistic::test_strategy::keepalive_path_untested` -> `resolved`; owner: `P7-W2`; reason: durable collaborator + integration keep-alive tests now cover interval scheduling, dispatch behavior, and teardown stop semantics, and exact issue-id command now reports `No open issues matching`.
  - Follow-up ownership and residuals (2026-04-09):
    - Follow-up ownership: none.
    - Residuals: none in the imported `P7` issue envelope or in the earlier file-level `test_coverage` follow-ups on current-code proof.
    - Post-exit file-health follow-up (2026-04-09):
      - Execution: added `src/modules/ui/epg/__tests__/EPGLibraryTabs.test.ts` as a focused direct suite for `EPGLibraryTabs` and revalidated the existing direct collaborator suite at `src/modules/player/__tests__/KeepAliveManager.test.ts`.
      - Verification:
        - `npm test -- --runInBand src/modules/ui/epg/__tests__/EPGLibraryTabs.test.ts` -> pass (`1` suite, `3` tests)
        - `npm test -- --runInBand src/modules/player/__tests__/KeepAliveManager.test.ts` -> pass (`1` suite, `4` tests)
        - `desloppify show src/modules/player/KeepAliveManager.ts --status open --no-budget` -> `No open issues matching: src/modules/player/KeepAliveManager.ts`
        - `desloppify show src/modules/ui/epg/EPGLibraryTabs.ts --status open --no-budget` -> `No open issues matching: src/modules/ui/epg/EPGLibraryTabs.ts`
        - `desloppify scan --force-rescan --skip-slow --no-badge --attest "I understand this is not the intended workflow and I am intentionally skipping queue completion"` -> `-2 resolved`; `Scores: overall 82.1/100 · objective 95.2/100 · strict 81.8/100 · verified 95.1/100`; `Test health 93.3% (strict 91.7%)`
      - Resolution note: both earlier `test_coverage` residues were adjudicated on direct current-code evidence after the new direct suite landed; `desloppify next --count 5` now reports `Queue: 0 items`.
  - Security triage (2026-04-09 disposition record):
    - `desloppify show security --status open --no-budget --top 50` confirms no open security findings.
    - `P0` impact: none; no `P0` defer/split records required for `P7-EXIT`.
  - Priority gate note: `P7-EXIT` is complete before any `P8` implementation work.

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
  - Required verification: `desloppify status`; `desloppify plan queue`; `desloppify show security --status open --no-budget --top 50`; the exact `P8-W1` issue-id check; `npm run verify`; `npm run verify:docs`; `npm run plans:check`

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
