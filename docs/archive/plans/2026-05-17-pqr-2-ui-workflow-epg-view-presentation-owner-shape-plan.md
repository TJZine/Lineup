# PQR-2 UI Workflow, EPG View, And Presentation Owner Shape Plan

**Plan Status:** completed
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked
**Package id:** `PQR-2`
**Checklist token:** `PQR-2`

## Goal

Retire `ARCHITECTURE_CLEANUP_CHECKLIST.md` item `PQR-2` by tightening the current UI owner shape without product behavior changes:

- keep `ChannelSetupScreen` as the screen shell, lifecycle owner, and step router only
- move Step 1 library render-adapter/session-callback/focus-neighbor glue into a focused package-local presenter
- make Step 2 rendering consume the same descriptor source that already drives interaction/dropdown behavior
- group EPG view files into owner folders only where current flat `view/` organization obscures ownership and import fallout stays inside approved `view/**`, `component/**`, and test scope
- centralize complete EPG cell secondary-text clearing in the renderer without DOM, sliver, ticker, focus, live-state, or layout churn

## Non-Goals

- No scheduler/channel-manager cleanup; `PQR-1` is closed.
- No Plex runtime/auth/discovery/library/stream behavior changes; that remains `PQR-5`.
- No core channel setup facet loading work; that remains `PQR-3`.
- No app-shell/orchestrator assembly cleanup; that remains `PQR-4`.
- No product behavior changes, new UI behavior, focus redesign, layout redesign, storage schema/key changes, public API widening, Windows implementation, shims, barrels, wrappers, compatibility re-exports, private test probes, or test-only APIs.
- No PQR score refresh; score rebaseline belongs to `PQR-EXIT`.
- Do not use Desloppify review ids as package membership or proof. This is source-backed cleanup with `PQR-2-SF*` coverage only.

## Parent Priority Alignment

`PQR-2` is a Tier 3 cleanup-loop package, task family `cleanup/refactor`, cleanup subtype `checklist-linked`. It advances the checklist's UI workflow and EPG presentation owner-shape goals while preserving the completed cleanup baseline:

- UI shell files must not regain async workflow, focus policy, persistence, or rendering-subdomain ownership.
- EPG view package organization must not create migration surfaces; package-local consumers import leaf owners directly.
- The implementation should optimize for the long-term owner shape, not the smallest patch.

## Required Reading

Fresh sessions must read, in order:

1. `docs/AGENTIC_DEV_WORKFLOW.md`
2. `agents.md`
3. `docs/agentic/session-prompts/cleanup-loop.md`
4. `ARCHITECTURE_CLEANUP_CHECKLIST.md` section `PQR-2`
5. `docs/agentic/codanna-playbook.md`
6. `docs/architecture/CURRENT_STATE.md`
7. `docs/architecture/modules.md`
8. this plan

Freshness gate: if any listed source file or current-state ownership claim changed materially after 2026-05-17, refresh this plan before implementation.

## Required Skills

- `architecture-boundaries`
- `ui-composition-patterns`
- `verification-strategy`
- `execution-plan-authoring`

Do not load `persistence-boundaries` during execution unless current source proves storage-backed setup state or persistence ownership must change. If that happens, stop and replan instead of widening silently.

## Codanna Discovery

- `get_index_info`: index had 12601 symbols across 812 files, semantic search enabled, updated 2 days before this plan.
- `semantic_search_with_context` for channel setup (`ChannelSetupScreen LibraryStepController StrategyStepController ChannelSetupWorkflowPresenter UI channel setup step rendering focus dropdown session callbacks`) was weak/noisy and returned unrelated EPG/app-shell hits, including `focusNow` and `openServerSelect`; exact symbol lookup and `rg` were required.
- `semantic_search_with_context` for EPG (`EPGCellRenderer EPGCellPresentation EPGVirtualizer EPGShellView EPGInfoPanel secondary text clear focused live ticker sliver`) anchored `EPGInfoPanel`, `CellRenderData`, `EPGConfig`, and `EPGVirtualizer`.
- `find_symbol` found:
  - `ChannelSetupScreen` `symbol_id:7059`, `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
  - `ChannelSetupWorkflowPresenter` `symbol_id:7125`
  - `LibraryStepController` `symbol_id:6865`
  - `StrategyStepController` `symbol_id:6951`
  - `StrategyStepInteractionController` `symbol_id:7199`
  - `ChannelSetupDropdownController` `symbol_id:7110`
  - `ChannelSetupFocusCoordinator` `symbol_id:7167`
  - `ChannelSetupSessionController` `symbol_id:6453`
  - `ChannelSetupSessionRuntime` `symbol_id:6713`
  - `ChannelSetupSessionState` `symbol_id:7392`
  - `ChannelSetupScreenPorts` `symbol_id:7108`
  - core `ChannelSetupScreenWorkflowPort` `symbol_id:10712`
  - `EPGCellRenderer` `symbol_id:4432`
  - `EPGVirtualizer` `symbol_id:4646`
  - `EPGShellView` `symbol_id:4306`
  - `EPGInfoPanel` `symbol_id:4959`
  - `EPGComponent` `symbol_id:5255`
- `find_symbol` and `search_symbols` did not find a symbol named `EPGCellPresentation`; direct file read confirmed it is a pure function/type owner at `src/modules/ui/epg/view/EPGCellPresentation.ts`.
- `search_documents` for `PQR-2 UI Workflow EPG View Presentation Owner Shape ChannelSetupScreen EPG secondary text` was weak/noisy and did not return the checklist/current-state source of truth; direct required doc reads were used.

`rg` fallback trail:

- `rg --files src/modules/ui/channel-setup src/modules/ui/epg/view src/modules/ui/epg/component src/core/channel-setup`
- exact library-step audit for `setup-lib-`, `setup-select-all`, `setup-clear-all`, `registerBulkActionNeighbors`, `registerSpatialFocusables`, `onToggleLibrary`, `onSelectAll`, `onClearAll`, `toDomId`, `MOVIE_SVG`, `SHOW_SVG`, `formatCount`
- exact Step 2 audit for `STRATEGY_CONTROL_DESCRIPTORS`, `createAdjustableToggle`, `openAdjustableControl`, `handleKeyPress`, `STEP2_CONTROL_IDS`, `dropdown`, `cyclePrev`, `cycleNext`, `registerStep2Focusables`
- exact EPG secondary-text/focus audit for `clearSubtitlePresentation`, `subtitleText.textContent`, `subtitle.style.display`, `CELL_SUBTITLE`, `clearFocusedTicker`, `CELL_FOCUSED`, `CELL_CURRENT`, `SLIVER`, `CELL_LIVE`, `showSubtitle`
- direct import/path audit for EPG view leaves from `src/modules/ui/epg`, tests, `src/core`, and `src/modules/navigation`

## Impact Snapshot

- `analyze_impact(ChannelSetupScreen symbol_id:7059, max_depth:2)`: impacts `AppLazyScreenRegistry`, `App`, `getChannelSetupScreen`, and `AppScreenVisibilityCoordinator.apply`. Keep `ChannelSetupScreen` constructor/public surface stable.
- `analyze_impact(StrategyStepController symbol_id:6951, max_depth:2)`: no Codanna impact detected; treat as weak leaf result and protect via direct import/test audit.
- `analyze_impact(EPGCellRenderer symbol_id:4432, max_depth:2)`: no Codanna impact detected; direct import audit shows `EPGVirtualizer` and renderer tests are the behavior surface.
- `analyze_impact(EPGComponent symbol_id:5255, max_depth:2)`: no Codanna impact detected; direct import audit shows app/orchestrator consume `IEPGComponent`/deferred EPG seams, not view leaves.
- `analyze_impact(EPGVirtualizer symbol_id:4646, max_depth:2)`: impacts `EPGComponent`.

Current-source proof matrix:

| source_finding_id | Disposition | Source-backed proof | Owner after execution | Revisit trigger |
| --- | --- | --- | --- | --- |
| `PQR-2-SF1` | Live; plan to retire in `PQR-2-S1`. | `ChannelSetupScreen.ts` owns `_renderLibraryStep`, `_registerBulkActionNeighbors`, `_toDomId`, `_formatCount`, inline movie/show SVG constants, library session mutation callbacks, selective DOM update, and back/next routing while `LibraryStepController.ts` only renders and exposes callback hooks. | New package-local `LibraryStepPresenter`-style owner under `src/modules/ui/channel-setup/steps/`; `ChannelSetupScreen` keeps shell/lifecycle/step-router. | Stop if presenter needs storage schema changes, core workflow contract changes, new public screen ports, or private test probes. |
| `PQR-2-SF2` | Live; plan to retire in `PQR-2-S2`. | `StrategyStepInteractionController.ts` already owns `STRATEGY_CONTROL_DESCRIPTORS` for dropdown/current/apply/disabled behavior, while `StrategyStepController.ts` hand-builds descriptor-compatible buttons and repeats state text/disabled/can-open policy. | A shared package-local Step 2 descriptor owner consumed by both `StrategyStepController` and `StrategyStepInteractionController`; `ChannelSetupWorkflowPresenter` remains adapter glue. | Stop if descriptor sharing changes dropdown, left/right cycling, priority grab/reorder, focus memory, preview scheduling, or build/review semantics. |
| `PQR-2-SF3` | Resolved in `PQR-2-W2` / `PQR-2-S3`. | `src/modules/ui/epg/view/cells/`, `view/info-panel/`, and `view/shell/` now hold approved-scope leaves with direct leaf imports. Runtime/focus-imported grid/navigation leaves stay at the view root; no `view/index.ts`, old-path shims, barrels, public export widening, or runtime/focus fallout were introduced. | Approved owner folders: `view/cells/`, `view/info-panel/`, and `view/shell/`. | Revisit only if future EPG view source proves runtime/focus-imported grid/navigation leaves can move without shims, public export widening, behavior edits, or runtime/focus import fallout. |
| `PQR-2-SF4` | Resolved in `PQR-2-W2` / `PQR-2-S4`. | `src/modules/ui/epg/view/cells/EPGCellRenderer.ts` owns one renderer-local subtitle clear/apply helper covering recycled placeholder, non-episode, sliver, focused/current/live cases; tests preserve ticker, sliver, focused, live, and current presentation. | `EPGCellRenderer` owns subtitle/secondary-text DOM clear/apply state; pure `EPGCellPresentation` remains width/text-layout policy only. | Revisit only if future renderer work changes DOM structure, class names, ticker readiness, sliver behavior, focused/live classes, temporal updates, or virtualizer recycling semantics. |

## Files In Scope

Channel setup:

- `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
- `src/modules/ui/channel-setup/ChannelSetupWorkflowPresenter.ts`
- `src/modules/ui/channel-setup/ChannelSetupDropdownController.ts` only for existing dropdown contract compatibility if needed
- `src/modules/ui/channel-setup/ChannelSetupScreenPorts.ts` only for import/type fallout; no port widening
- `src/modules/ui/channel-setup/ChannelSetupSessionController.ts`, `ChannelSetupSessionRuntime.ts`, `ChannelSetupSessionState.ts` only through existing public methods; no storage/persistence changes
- `src/modules/ui/channel-setup/focus/ChannelSetupFocusCoordinator.ts` and focus types only if the Step 1 presenter needs an existing focus-registration seam
- `src/modules/ui/channel-setup/steps/LibraryStepController.ts`
- new `src/modules/ui/channel-setup/steps/LibraryStepPresenter.ts` or equivalently named package-local Step 1 presenter
- `src/modules/ui/channel-setup/steps/StrategyStepController.ts`
- `src/modules/ui/channel-setup/steps/StrategyStepInteractionController.ts`
- new `src/modules/ui/channel-setup/steps/StrategyStepControlDescriptors.ts` or equivalently named package-local Step 2 descriptor owner
- `src/modules/ui/channel-setup/steps/types.ts`
- affected channel-setup tests under `src/modules/ui/channel-setup/**/__tests__`

EPG:

- `src/modules/ui/epg/view/EPGCellPresentation.ts`
- `src/modules/ui/epg/view/EPGCellRenderer.ts`
- `src/modules/ui/epg/view/EPGInfoPanel.ts`
- `src/modules/ui/epg/view/EPGInfoPanelCoordinator.ts`
- `src/modules/ui/epg/view/EPGInfoPanelDetailsLoader.ts`
- `src/modules/ui/epg/view/EPGInfoPanelDynamicBackground.ts`
- `src/modules/ui/epg/view/EPGShellView.ts`
- `src/modules/ui/epg/view/EPGVirtualizer.ts` only for import fallout from moving cell renderer/presentation leaves inside `view/**`; do not move this file unless a replan expands scope
- `src/modules/ui/epg/component/EPGComponent.ts` only for import/path fallout
- affected EPG tests only for import/path fallout from approved view file moves

Docs:

- This plan only during planning.
- Architecture/API/design docs only during implementation if public ownership/path/UI contract truth changes.

## Files Out Of Scope

- `src/modules/scheduler/**`
- `src/modules/plex/**`
- `src/core/channel-setup/planning/**` and facet loading owners
- `src/core/app-shell/**`, `src/core/orchestrator/**`, `src/App.ts`, and `src/Orchestrator.ts` except for source-audit references; no edits planned
- `src/modules/ui/epg/runtime/**` and `src/modules/ui/epg/focus/**`; if a view move would require editing these files, stop and replan instead of moving that leaf
- `src/modules/ui/epg/view/EPGChannelList.ts`, `EPGTimeHeader.ts`, `EPGLibraryTabs.ts`, `EPGErrorBoundary.ts`, `EPGVisibleRangeEmitter.ts`, and `EPGVirtualizer.ts` as move targets because current out-of-scope runtime/focus imports make those moves wider than PQR-2 allows
- `src/modules/ui/epg/index.ts` public export widening
- persistence stores, storage keys, migrations, setup-record schema, build-scratch cleanup, selected-server storage, and channel persistence
- visual redesign CSS beyond import/path fallout; no layout, focus-order, or animation redesign
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` until implementation closeout earns a checklist update

## Planner Self-Check

- Unresolved seam? No. Step 1 presenter owns library adapter/session/focus glue; Step 2 descriptor owner is package-local; EPG foldering is leaf-only; subtitle clear centralization stays in `EPGCellRenderer`.
- Adjacent contract changes? None planned. `ChannelSetupScreenPorts`, core `ChannelSetupScreenWorkflowPort`, `IEPGComponent`, and `src/modules/ui/epg/index.ts` remain stable.
- Files declared out of scope but implicitly needed? No. EPG runtime/focus files are frozen; `PQR-2-S3` may only move EPG leaves whose import fallout stays inside `view/**`, `component/**`, and tests.
- Codanna and fallback evidence recorded? Yes, including weak semantic/doc searches and direct `rg` trails.
- Repo-preferred owner? Yes. Hotspot/shell files shrink or stay stable; leaf owners receive focused responsibilities.
- Would a fresh session invent policy? No. Slices define owner, behavior invariants, stop triggers, and verification.
- Execution-grade without pseudo-code? Yes. The plan freezes seams and proof, leaving ordinary local implementation choices to the worker.

## Architecture Seam Decision Gate

Chosen seams:

- `ChannelSetupScreen` remains the screen shell/lifecycle/step-router. It may instantiate the Step 1 presenter and pass shell elements, session, focus, ports, and render callbacks, but it must not keep Step 1 render adapters, bulk focus-neighbor policy, SVG/icon/DOM-id formatting, or library mutation plumbing.
- `LibraryStepController` remains DOM rendering for Step 1 controls. The new Step 1 presenter owns adapter construction, session mutation callbacks, preferred-focus management, selective toggle refresh, status/detail updates, and bulk focus-neighbor registration policy.
- Step 2 descriptor ownership moves to a package-local descriptor source that is consumed by both rendering and interaction. `StrategyStepInteractionController` keeps keyboard/dropdown/focus interaction state; `StrategyStepController` keeps DOM assembly from descriptors.
- EPG file moves are owner-folder moves only and must stay inside the approved scope. Approved `PQR-2-S3` moves are limited to cells, info-panel leaves, and shell leaves whose import fallout stays inside `src/modules/ui/epg/view/**`, `src/modules/ui/epg/component/**`, and affected tests. Do not move view leaves that require `src/modules/ui/epg/runtime/**` or `src/modules/ui/epg/focus/**` edits without replan. No `view/index.ts`, no compatibility files, no re-export expansion, no old-path wrappers.
- EPG subtitle/secondary-text clearing centralizes inside `EPGCellRenderer`, because it owns DOM child binding and recycled element state. `EPGCellPresentation` stays pure presentation policy, not DOM mutation.

UI behavior invariants:

- Channel setup Step 1 focus order: select-all, clear-all, library buttons, back, next; select-all/right to clear-all; both bulk buttons down to first library when present.
- Step 1 DOM ids and selectors remain `setup-select-all`, `setup-clear-all`, `setup-lib-${toDomId(id)}`, `setup-back`, and `setup-next`.
- Step 1 keyboard/click behavior, selected-count detail text, next disabled state, movie/show icon DOM shape, and selective in-place library toggle update remain unchanged.
- Step 2 category rail, detail focus memory, left/right cycling, OK dropdown open, back-to-dismiss dropdown, disabled dropdown controls, priority grab/reorder behavior, preview scheduling, scroll reset, and `setup-preview-panel` semantics remain unchanged.
- Build review/progress/success semantics, replace confirmation, cancel/done behavior, and switch/open EPG callbacks remain unchanged.
- EPG DOM shape, class names, app-visible public exports, `IEPGComponent`, sliver presentation, ticker timing/classes, focused/live classes, temporal progress, virtualizer recycling, current/focused presentation, now-watching banner behavior, and info-panel host switching remain unchanged.

Stop/replan triggers:

- Any required storage schema/key, persistence-owner, Plex, scheduler, app-shell, orchestrator, public API, or public export change.
- Any need for compatibility shims/barrels/wrappers or old-path files after EPG moves.
- Any EPG view move that would require import fallout in `src/modules/ui/epg/runtime/**` or `src/modules/ui/epg/focus/**`.
- Any focus behavior, dropdown behavior, session callback, build/review/progress, DOM shape, sliver, ticker, live-state, or layout behavior change.
- Any test strategy that requires private probes/test-only APIs instead of public seam proof.
- Any file-shape guardrail violation that would grow an allowlisted production file without same-change rationale and a decomposition/revisit trigger.

## Verification Commands

Primary verification mode: `contract-first` for `PQR-2-S1`, `PQR-2-S2`, and `PQR-2-S4`; `refactor-invariance` for `PQR-2-S3`.

- Verification classification: `new regression/contract test required`

Behavior-neutral EPG folder moves are `refactor-invariance` and can rely on existing coverage plus import audits once moved.

Per-slice targeted commands:

- Channel setup wave:
  - Run: `npm test -- --runInBand src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.contracts.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupWorkflowPresenter.test.ts src/modules/ui/channel-setup/steps/__tests__/LibraryStepController.test.ts src/modules/ui/channel-setup/steps/__tests__/StrategyStepController.test.ts src/modules/ui/channel-setup/steps/__tests__/StrategyStepInteractionController.test.ts src/modules/ui/channel-setup/focus/__tests__/ChannelSetupFocusCoordinator.test.ts`
    - Expected: Step 1/2 channel setup rendering, focus, dropdown, preview, and build/review contracts pass.
- EPG wave:
  - Run: `npm test -- --runInBand src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts src/modules/ui/epg/__tests__/EPGComponent.test.ts src/modules/ui/epg/__tests__/EPGShellView.test.ts src/modules/ui/epg/__tests__/EPGInfoPanel.test.ts src/modules/ui/epg/__tests__/EPGInfoPanelCoordinator.test.ts src/modules/ui/epg/__tests__/EPGChannelList.test.ts src/modules/ui/epg/__tests__/EPGTimeHeader.test.ts src/modules/ui/epg/__tests__/EPGErrorBoundary.test.ts src/modules/ui/epg/__tests__/EPGVisibleRangeEmitter.test.ts src/modules/ui/epg/__tests__/EPGLibraryTabs.test.ts src/modules/ui/epg/__tests__/index.test.ts`
    - Expected: EPG renderer, virtualizer, shell, info-panel, tabs, range, and public package contracts pass after approved view moves.

Required final commands before implementation closeout:

- Approved-scope import audit after `PQR-2-S3`; expected output is no matches and exit `0`:
  - Run: `! rg -n "from '../view/(cells|info-panel|shell)/|from './(cells|info-panel|shell)/|from '../../view/(cells|info-panel|shell)/" src/modules/ui/epg/runtime src/modules/ui/epg/focus`
    - Expected: no matches; runtime/focus imports do not point at moved owner folders.
- Old flat-path audit for moved leaves after `PQR-2-S3`; replace the name list with the exact moved leaves. Expected output is no matches and exit `0`:
  - Run: `! rg -n "from '../view/(EPGCellRenderer|EPGCellPresentation|EPGInfoPanel|EPGInfoPanelCoordinator|EPGInfoPanelDetailsLoader|EPGInfoPanelDynamicBackground|EPGShellView)'|from './(EPGCellRenderer|EPGCellPresentation|EPGInfoPanel|EPGInfoPanelCoordinator|EPGInfoPanelDetailsLoader|EPGInfoPanelDynamicBackground|EPGShellView)'|from '../../view/(EPGCellRenderer|EPGCellPresentation|EPGInfoPanel|EPGInfoPanelCoordinator|EPGInfoPanelDetailsLoader|EPGInfoPanelDynamicBackground|EPGShellView)'" src/modules/ui/epg src/core src/modules/navigation`
    - Expected: no matches; moved leaves are imported from their new direct leaf paths only.
- Public export audit after `PQR-2-S3`; expected output is no matches and exit `0`:
  - Run: `! rg -n "EPG(CellRenderer|CellPresentation|Virtualizer|ShellView|InfoPanel|InfoPanelCoordinator|ChannelList|TimeHeader|LibraryTabs|ErrorBoundary|VisibleRangeEmitter)" src/modules/ui/epg/index.ts`
    - Expected: no matches; the public EPG package seam does not widen to view leaves.
- Run: `npm run typecheck`
  - Expected: no TypeScript errors.
- Run: `git diff --check`
  - Expected: no whitespace errors.
- Run: `npm run verify`
  - Expected: full UI/docs/build verification passes.
- Run: `npm run verify:docs`
  - Expected: required when implementation updates this plan, checklist, current-state, modules, design, API, or workflow docs.

Expected results: all commands exit `0`. For the negated `rg` audits, exit `0` means the forbidden matches were absent; any printed match is a failure. Targeted tests protect the named behavior invariants.

## Package Decomposition

- `package_id`: `PQR-2`
- `checklist_token`: `PQR-2`
- `source_finding_ids`:
  - `PQR-2-SF1`
  - `PQR-2-SF2`
  - `PQR-2-SF3`
  - `PQR-2-SF4`
- `ready_now_execution_unit`: none; package complete
- `ready_now_slice`: none; package complete
- `recommended_slice_order`: `PQR-2-S1`, `PQR-2-S2`, `PQR-2-S3`, `PQR-2-S4`
- `parallel_execution_policy`: serial by wave. `PQR-2-W1` and `PQR-2-W2` are independent owner areas but should not run in parallel unless a controller explicitly accepts the added review/import-audit coordination cost. Slices inside each wave are serial-only because they share test and import surfaces.
- `coverage_check`:
  - `PQR-2-SF1` maps only to `PQR-2-S1`.
  - `PQR-2-SF2` maps only to `PQR-2-S2`.
  - `PQR-2-SF3` maps only to `PQR-2-S3`.
  - `PQR-2-SF4` maps only to `PQR-2-S4`.
- `slice_table`:

### `PQR-2-S1`

- `goal`: Extract Step 1 library presenter so `ChannelSetupScreen` stops owning Step 1 adapter/session/focus-neighbor glue.
- `areas/files`: `ChannelSetupScreen.ts`, `steps/LibraryStepController.ts`, `steps/LibraryStepPresenter.ts`, `steps/types.ts`, channel-setup screen/library/focus tests.
- `source_finding_ids`:
  - `PQR-2-SF1`
- `verification`: new/updated contract tests for Step 1 DOM ids, selected count, next disabled state, toggle in-place update, bulk focus neighbors, back/next callbacks; targeted channel setup wave command.
- `dependencies`: none.
- `stop_condition`: stop if core workflow port, screen ports, storage, focus behavior, or DOM shape must change.
- `handoff_condition`: `ChannelSetupScreen` delegates Step 1 presenter ownership and all Step 1 invariants pass.
- `serial_only`: yes.
- `parallel_justification`: must precede `PQR-2-S2` so screen shell/presenter handoff shape is stable before Step 2 rendering changes.

### `PQR-2-S2`

- `goal`: Make Step 2 render controls descriptor-driven from the same package-local descriptor source used by interactions.
- `areas/files`: `steps/StrategyStepController.ts`, `steps/StrategyStepInteractionController.ts`, descriptor owner, `ChannelSetupWorkflowPresenter.ts`, Step 2 tests.
- `source_finding_ids`:
  - `PQR-2-SF2`
- `verification`: new/updated contract tests for descriptor-rendered build/combine/alternate/series/limits controls, disabled dropdown targets, left/right cycling, OK dropdown open, preview scheduling, and priority focus/reorder invariants.
- `dependencies`: `PQR-2-S1` in same wave.
- `stop_condition`: stop if dropdown behavior, focus memory, priority reorder, preview scheduling, or build/review routing changes.
- `handoff_condition`: rendering and interaction consume one descriptor source without broadening public exports.
- `serial_only`: yes.
- `parallel_justification`: shares Step 2 tests and presenter wiring with `PQR-2-S1`; no safe parallelism inside channel setup wave.

### `PQR-2-S3`

- `goal`: Move only approved flat EPG view leaves into owner folders with direct leaf imports: cells, info-panel leaves, and shell. Do not move runtime/focus-imported grid/navigation leaves in this plan.
- `areas/files`: `view/cells/*`, `view/info-panel/*`, `view/shell/*`, current `view/EPGVirtualizer.ts` only for cell import fallout, `component/EPGComponent.ts` import fallout, EPG tests import fallout.
- `source_finding_ids`:
  - `PQR-2-SF3`
- `verification`: refactor-invariance through targeted EPG wave command, negated approved-scope/old-path/public-export audits, and `npm run typecheck`.
- `dependencies`: channel setup wave complete or controller-approved separate EPG wave.
- `stop_condition`: stop if any shim/barrel/export widening is needed, if moves require behavior edits, or if a desired move would require `runtime/**` or `focus/**` import fallout.
- `handoff_condition`: approved owner folders exist, imports point at leaf files, forbidden old flat paths and public exports are absent, runtime/focus imports remain untouched, tests pass.
- `serial_only`: yes.
- `parallel_justification`: folder moves should happen before `PQR-2-S4` so secondary-text centralization lands at the final approved file path.

### `PQR-2-S4`

- `goal`: Centralize complete EPG secondary-text clear state without changing cell presentation behavior.
- `areas/files`: `view/cells/EPGCellRenderer.ts` after move or current `view/EPGCellRenderer.ts` if `PQR-2-S3` is replanned, `view/cells/EPGCellPresentation.ts` only if pure type names need import fallout, EPG cell/virtualizer/component tests.
- `source_finding_ids`:
  - `PQR-2-SF4`
- `verification`: new/updated tests for recycled placeholder/non-episode/sliver/focused-episode/live/current cells proving subtitle text and display clear together while ticker/sliver/focused/live classes remain unchanged.
- `dependencies`: `PQR-2-S3`.
- `stop_condition`: stop if DOM structure, classes, ticker, sliver, live/current/focused presentation, or virtualizer recycling behavior changes.
- `handoff_condition`: one renderer helper owns secondary-text clear/apply state and all EPG invariants pass.
- `serial_only`: yes.
- `parallel_justification`: depends on final file location from `PQR-2-S3`; do not parallelize.

- `execution_waves`:
  - `wave_id`: `PQR-2-W1`
    - `slice_ids`: `PQR-2-S1`, `PQR-2-S2`
    - `completion_condition`: channel setup Step 1/2 ownership findings are retired, targeted channel setup tests pass, no port/storage/public API change.
    - `absorb_now_scope`: additional Step 1/2 adapter, descriptor, focus, dropdown, or session-callback residue inside `src/modules/ui/channel-setup/**` with the same verification envelope.
    - `replan_triggers`: any persistence/core workflow/public port change; changed focus/dropdown/build semantics; private probe requirement.
  - `wave_id`: `PQR-2-W2`
    - `slice_ids`: `PQR-2-S3`, `PQR-2-S4`
    - `completion_condition`: approved-scope EPG view folder ownership and secondary-text clearing findings are retired, targeted EPG tests pass, negated old-path/export/scope audits pass.
    - `absorb_now_scope`: additional approved-scope EPG view leaf import fallout or renderer-local subtitle clear duplication inside `view/**`, `component/**`, and tests only.
    - `replan_triggers`: any shim/barrel/public export need; any runtime/focus import fallout; DOM/ticker/sliver/focus/live/layout behavior churn; cross-module ownership change.
- `coverage_ledger`:
  - `source_finding_id`: `PQR-2-SF1`; `slice_id`: `PQR-2-S1`; `execution_unit`: `PQR-2-W1`; `final owner`: `LibraryStepPresenter`.
  - `source_finding_id`: `PQR-2-SF2`; `slice_id`: `PQR-2-S2`; `execution_unit`: `PQR-2-W1`; `final owner`: Step 2 descriptor owner plus existing interaction/render controllers.
  - `source_finding_id`: `PQR-2-SF3`; `slice_id`: `PQR-2-S3`; `execution_unit`: `PQR-2-W2`; `final owner`: approved-scope EPG view owner folders; runtime/focus-imported leaves stay put unless a future replan widens scope.
  - `source_finding_id`: `PQR-2-SF4`; `slice_id`: `PQR-2-S4`; `execution_unit`: `PQR-2-W2`; `final owner`: `EPGCellRenderer`.

## Execution Progress

### 2026-05-18 `PQR-2-W1`

Status: complete after clean implementation review.

- `PQR-2-S1` resolved `PQR-2-SF1` by introducing
  `src/modules/ui/channel-setup/steps/LibraryStepPresenter.ts` as the Step 1
  owner for library render adapters, session callbacks, DOM id/count/icon
  formatting, selective toggle refresh, and bulk focus-neighbor registration.
- `PQR-2-S2` resolved `PQR-2-SF2` by introducing
  `src/modules/ui/channel-setup/steps/StrategyStepControlDescriptors.ts` as
  the shared Step 2 adjustable-control descriptor owner consumed by both
  `StrategyStepController` and `StrategyStepInteractionController`.
- Implementation review found no material findings for `PQR-2-W1`.
- Verification observed for the implementation pass: targeted channel setup
  wave tests passed, focused presenter tests passed, `npm run typecheck`
  passed, `git diff --check` passed, and `npm run verify` passed.
- Next exact action: execute `ready_now_execution_unit` `PQR-2-W2`, starting
  with `ready_now_slice` `PQR-2-S3`, without widening into
  `src/modules/ui/epg/runtime/**` or `src/modules/ui/epg/focus/**` import
  fallout.

### 2026-05-18 `PQR-2-W2`

Status: complete after clean implementation review.

- `PQR-2-S3` resolved `PQR-2-SF3` by moving approved EPG view leaves into
  `src/modules/ui/epg/view/cells/`,
  `src/modules/ui/epg/view/info-panel/`, and
  `src/modules/ui/epg/view/shell/` with direct leaf imports only.
  Runtime/focus-imported grid/navigation leaves stayed at the view root; no
  shims, barrels, public export widening, or runtime/focus fallout were added.
- `PQR-2-S4` resolved `PQR-2-SF4` by centralizing subtitle/secondary-text
  clear/apply state in `EPGCellRenderer` while preserving DOM shape, ticker,
  sliver, focused/live/current presentation, and virtualizer recycling
  behavior.
- Implementation review found no material findings for `PQR-2-W2`.
- Verification observed for the implementation pass: targeted EPG wave tests
  passed, approved-scope runtime/focus import audit passed with no matches,
  old flat-path audit passed with no matches, public export audit passed with
  no matches, `npm run plans:check` passed, `npm run verify:docs` passed,
  `npm run typecheck` passed, `git diff --check` passed, and final
  `npm run verify` passed during package closeout.
- Next exact action: `PQR-2` is closed. Continue with maintainer-selected
  `PQR-*` work; do not run a PQR score refresh until `PQR-EXIT`.

## Rollback Notes

- Step 1/2 changes can be reverted within `src/modules/ui/channel-setup/**` without touching core workflow or persistence. If parity fails, restore `ChannelSetupScreen`/Step controller wiring from the pre-slice diff and keep tests as the failure proof for a narrower replan.
- EPG folder moves should be reverted as a unit if import audits or typecheck fail due to path churn. Do not add compatibility files to rescue a failed move, and do not patch runtime/focus imports as part of this plan.
- EPG subtitle centralization can be reverted within `EPGCellRenderer` if behavior tests show presentation drift. Do not move this policy into `EPGCellPresentation` unless a replan explicitly changes the DOM/pure-policy seam.

## Commit Checkpoints

- Implementation checkpoint 1: after `PQR-2-W1` passes targeted channel setup tests, `npm run typecheck`, and `git diff --check`.
- Implementation checkpoint 2: after `PQR-2-W2` passes targeted EPG tests, old-path audits, `npm run typecheck`, and `git diff --check`.
- Closeout checkpoint: after `npm run verify` and required docs/checklist/current-state updates pass `npm run verify:docs`.

Keep active tracked plan docs out of implementation commits unless the controller explicitly makes a separate tracked-doc commit.
