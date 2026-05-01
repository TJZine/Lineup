**Plan Status:** completed
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

# DCR-14 EPG Component File-Health Follow-Through

## Goal

Retire `DCR-14-A1` / `S0-L01-F2` with source-backed responsibility reduction in `src/modules/ui/epg/component/EPGComponent.ts`.

The approved execution unit must leave `EPGComponent` as the public `IEPGComponent` facade and wiring surface, not the owner of DOM shell construction, focus/navigation policy, timer/listener lifecycle, visible-range emission, and virtualized-grid render coordination at the same time. Closure requires a fresh post-change source audit proving the S0 wording no longer describes current source, or an explicit maintainer reclassification.

## Non-Goals

- Do not change EPG visual styling, CSS, edge treatment, or info-panel panel treatment.
- Do not use `S0-L14-F2` to drive cleanup-agent visual work. It is maintainer-accepted cleanup residual/design backlog work.
- Do not change the `IEPGComponent` public API, `DeferredEPGComponent` deferred loading/replay behavior, or `EPGCoordinator` runtime policy entrypoints unless a stop/replan trigger fires and the maintainer approves a wider seam.
- Do not perform a DOM-shell-only, visible-range-only, comments-only, tests-only, or line-count-only cleanup and call DCR-14 closed.
- Do not introduce compatibility shims, fallback runtime branches, new dependencies, framework changes, or unrelated EPG redesign.

## Parent Priority Alignment

`DCR-14` is a checklist-linked Tier 3 cleanup/refactor package admitted by `DCR-EXIT-S0`. It owns only `DCR-14-A1`: `S0-L01-F2` found that `EPGComponent` still concentrates rendering, focus, navigation, timers, and grid runtime.

The package also records the `S0-L14-F2` accepted residual boundary: EPG info-panel edge integration remains accepted for codebase cleanup and belongs to future maintainer-led style/design backlog work, not this cleanup-agent pass.

## Required Reading

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/cleanup-loop.md`
4. `docs/agentic/plan-authoring-standard.md`
5. `docs/agentic/codanna-playbook.md`
6. `ARCHITECTURE_CLEANUP_CHECKLIST.md` section `DCR-14`
7. `docs/plans/2026-04-30-dcr-exit-final-dimension-audit-plan.md`
8. The embedded `S0-L01-F2` and `S0-L14-F2` evidence summaries in this plan's `Codanna Discovery`, `Impact Snapshot`, and `Package Decomposition` sections
9. The `DCR-14` routing rows already promoted into the DCR-EXIT plan and checklist
11. `docs/architecture/CURRENT_STATE.md` sections `UI` and `Current Hotspots`
12. `docs/design/ui-design-language.md` only to preserve the `S0-L14-F2` visual-residual boundary or if an implementation proposal would touch visible EPG structure/styles
13. This plan

Freshness gate: before implementation, rerun:

```bash
git status --short -- ARCHITECTURE_CLEANUP_CHECKLIST.md docs/architecture/CURRENT_STATE.md docs/plans/2026-04-30-dcr-exit-final-dimension-audit-plan.md docs/plans/2026-04-30-dcr-14-epg-component-file-health-follow-through.md src/modules/ui/epg/component/EPGComponent.ts src/modules/ui/epg/view/EPGShellView.ts src/modules/ui/epg/focus/EPGFocusNavigator.ts src/modules/ui/epg/runtime/EPGGridRuntimeController.ts src/modules/ui/epg/view/EPGVisibleRangeEmitter.ts src/modules/ui/epg/__tests__/EPGComponent.test.ts src/modules/ui/epg/__tests__/DeferredEPGComponent.test.ts src/modules/ui/epg/__tests__/EPGCoordinator.test.ts src/modules/ui/epg/__tests__/EPGShellView.test.ts src/modules/ui/epg/__tests__/EPGFocusNavigator.test.ts src/modules/ui/epg/__tests__/EPGGridRuntimeController.test.ts src/modules/ui/epg/__tests__/EPGVisibleRangeEmitter.test.ts
```

Inspect relevant diffs before implementation. The current pre-planning dirty state includes the active DCR-EXIT plan modified and this DCR-14 plan untracked; preserve those as protected planning surfaces. Stop if the DCR-14 checklist section, this plan path, active DCR-EXIT plan DCR-14 routing, current-state EPG hotspot lines, or in-scope EPG source/test seams changed in a way that changes DCR-14 meaning or invalidates the selected seams.

## Required Skills

- `architecture-boundaries`
- `ui-composition-patterns`
- `verification-strategy`
- `execution-plan-authoring`
- `model-selection`
- `parallel-sidecars`

Do not use the `desloppify` skill or any Desloppify runtime/intake/scan/queue/import/score output for this package.

`parallel-sidecars` applies to the cleanup-loop review shape: use read-only reviewer sidecars for plan and implementation review, but do not parallelize implementation slices inside `DCR-14-W1`. The selected owner seams touch the same public facade and shared EPG state, so writes are serial.

## Codanna Discovery

Planning evidence on 2026-04-30:

- `search_documents`: queried `S0-L01-F2 EPGComponent rendering focus navigation timers grid runtime`; direct lane report reads supplied the exact finding because document search surfaced broader EPG docs and prior plans rather than the exact S0 rows.
- `search_documents`: queried `S0-L14-F2 EPG info-panel edge residual accepted residual design backlog`; direct S0 lane/synthesis reads supplied the exact accepted-residual wording.
- `semantic_search_with_context`: queried `EPGComponent rendering focus navigation timers grid runtime src/modules/ui/epg/component`; top hit was `EPGComponent` at `src/modules/ui/epg/component/EPGComponent.ts` with `symbol_id:5595`, implementing `IEPGComponent` and using `EPGVirtualizer`, `EPGInfoPanel`, `EPGInfoPanelCoordinator`, `EPGTimeHeader`, `EPGChannelList`, `EPGVisibleRangeEmitter`, and EPG state/config types.
- `find_symbol`: `EPGComponent` resolved to `symbol_id:5595`, class range `src/modules/ui/epg/component/EPGComponent.ts:55-1803`, defining 64 methods.
- `analyze_impact`: `symbol_id:5595` returned no impacted symbols, which is insufficient for this class-level refactor because the public contract is consumed through `IEPGComponent` and lazy/deferred wrappers.
- `semantic_search_with_context`: queried `EPG focus navigation coordinator visible range event emission timer cleanup`; returned `EPGComponent`, `IEPGComponent`, `EPGState`, `EPGFocusPosition`, `EPGCoordinator`, and navigation interfaces as the relevant source seam.
- Fallback: used `rg --files`, `rg`, `wc -l`, and direct source reads for deterministic method grouping, public API consumers, test coverage, and exact file-health evidence.

Fallback source paths read or searched:

- `src/modules/ui/epg/component/EPGComponent.ts`
- `src/modules/ui/epg/component/DeferredEPGComponent.ts`
- `src/modules/ui/epg/interfaces.ts`
- `src/modules/ui/epg/types.ts`
- `src/modules/ui/epg/coordinator/EPGCoordinator.ts`
- `src/modules/ui/epg/view/EPGVirtualizer.ts`
- `src/modules/ui/epg/view/EPGVisibleRangeEmitter.ts`
- `src/modules/ui/epg/view/EPGInfoPanelCoordinator.ts`
- `src/modules/ui/epg/__tests__/EPGComponent.test.ts`
- `src/modules/ui/epg/__tests__/DeferredEPGComponent.test.ts`
- `src/modules/ui/epg/__tests__/EPGCoordinator.test.ts`
- `src/modules/navigation/*` and `src/core/orchestrator/*` EPG call sites found by `rg`

## Impact Snapshot

Current-source audit:

- `src/modules/ui/epg/component/EPGComponent.ts` is 1,803 lines and defines 64 methods.
- It still constructs and caches the EPG shell DOM (`createDOMStructure`, `_buildShellStructure`, `_cacheShellElements`, `initializeProgramAreaOverlays`, `createTimeIndicator`).
- It still owns show/hide lifecycle, visibility listener registration, current-time interval start/stop, layout/PIP mode signaling, now-watching banner presentation, and visibilitychange refresh.
- It still owns focus state, focus restoration, placeholder focus, channel/time visibility math, D-pad navigation, page navigation, select/back handling, focus event emission, and library-tab focus state.
- It still coordinates grid runtime rendering by refreshing time, updating headers/virtualizer scroll, calculating visible range, emitting visible range changes, rendering visible cells, restoring focused cell DOM state, and debug logging.
- Adjacent owners are real but incomplete for this finding: `EPGVirtualizer` owns DOM cell pooling/rendering; `EPGVisibleRangeEmitter` dedupes emitted ranges only; `EPGInfoPanelCoordinator` owns info-panel host moves and full-update debounce; `EPGCoordinator` owns runtime policy entrypoints and schedule refresh orchestration; `DeferredEPGComponent` owns lazy-load replay.
- Existing tests already cover many behaviors through `EPGComponent.test.ts`, `DeferredEPGComponent.test.ts`, and `EPGCoordinator.test.ts`, but new focused tests are required for extracted owners because DCR-14 closure depends on proving responsibility moved, not only preserving public behavior through the facade.

Accepted residual audit:

- `S0-L14-F2` is not an implementation finding for this package. The accepted residual is the EPG info-panel edge-integration visual/design backlog. This plan preserves current EPG visual treatment and forbids cleanup-agent CSS/panel redesign.
- `docs/design/ui-design-language.md` confirms the target edge-integrated panel language and accessibility invariants, but this DCR-14 execution is not a design pass.

Public API/caller snapshot:

- `IEPGComponent` is consumed by `DeferredEPGComponent`, `EPGCoordinator`, `EPGRefreshController`, `EPGScheduleRefreshRuntime`, initialization/orchestrator wiring, and navigation routing.
- Navigation surfaces call `handleNavigation`, `handlePage`, `handleSelect`, and `handleBack` through the existing interface.
- `onVisibleRangeChange` remains an `EPGConfig` callback wired by orchestrator/config binding code and consumed by `EPGCoordinator.handleVisibleRangeChange`.

## Package Decomposition

- `package_id`: `DCR-14`
- `checklist_token`: `DCR-14`
- `package_issue_ids`:
  - `DCR-14-A1`: `S0-L01-F2` `EPGComponent` still concentrates rendering/focus/navigation/timers/grid runtime.
- `accepted_residuals`:
  - `S0-L14-F2`: accepted visual/design residual; out of cleanup-agent implementation scope.

- `slice_table`:

### `DCR-14-S1`

- `goal`: Extract EPG shell/view presentation ownership so `EPGComponent` no longer builds and owns the full shell DOM, classic/overlay host visibility, ARIA-hidden shell toggling, and now-watching banner presentation inline.
- `areas/files`: `src/modules/ui/epg/component/EPGComponent.ts`, new `src/modules/ui/epg/view/EPGShellView.ts`, new `src/modules/ui/epg/__tests__/EPGShellView.test.ts`, and `src/modules/ui/epg/view/index.ts` only if package-local export is needed.
- `exact_issue_ids`: `DCR-14-A1`
- `verification`: `src/modules/ui/epg/__tests__/EPGShellView.test.ts` plus existing `EPGComponent.test.ts` DOM/layout/ARIA/banner assertions.
- `dependencies`: none inside this package.
- `stop_condition`: stop if shell extraction requires CSS/visual changes, public `IEPGComponent` changes, or app-shell container ownership changes.
- `handoff_condition`: shell DOM creation, cached shell references, classic/overlay shell visibility, and now-watching banner text/visibility policy live outside `EPGComponent`; the facade delegates without changing rendered structure or ARIA hooks.
- `serial_only`: yes
- `parallel_justification`: shares `EPGComponent` state and DOM initialization with later slices; serial execution avoids conflicting facade rewrites.

### `DCR-14-S2`

- `goal`: Extract EPG focus/navigation ownership so `EPGComponent` no longer contains D-pad navigation policy, page navigation, channel/time visibility math, placeholder/program focus transition policy, select/back focus behavior, and focus event preparation inline.
- `areas/files`: `src/modules/ui/epg/component/EPGComponent.ts`, new `src/modules/ui/epg/focus/EPGFocusNavigator.ts`, new `src/modules/ui/epg/__tests__/EPGFocusNavigator.test.ts`, and package-local focus export only if the implementation needs one.
- `exact_issue_ids`: `DCR-14-A1`
- `verification`: `src/modules/ui/epg/__tests__/EPGFocusNavigator.test.ts` must cover wrap behavior, horizontal program moves, placeholder focus, page moves preserving focus time, select event payload preservation, and library-tabs focus routing; existing `EPGComponent.test.ts` navigation/focus assertions remain public facade parity tests.
- `dependencies`: `DCR-14-S1` complete enough that shell/view host references are stable.
- `stop_condition`: stop if the extraction requires `NavigationManager`/remote-input contract changes, changes focus semantics, removes current `data-key`/focused-cell class behavior, or needs private test probes instead of a real owner API.
- `handoff_condition`: `EPGComponent` public focus/navigation methods delegate to a focused owner; `EPGComponent` no longer contains the navigation decision tree as method bodies.
- `serial_only`: yes
- `parallel_justification`: focus extraction mutates the same facade state and render callbacks as the grid runtime slice.

### `DCR-14-S3`

- `goal`: Extract EPG grid runtime/lifecycle ownership so `EPGComponent` no longer owns current-time interval/listener lifecycle, visible-range calculation/emission, render-pass coordination, time-header/virtualizer update choreography, and current-time/time-indicator refresh policy inline.
- `areas/files`: `src/modules/ui/epg/component/EPGComponent.ts`, new `src/modules/ui/epg/runtime/EPGGridRuntimeController.ts`, new `src/modules/ui/epg/__tests__/EPGGridRuntimeController.test.ts`, `src/modules/ui/epg/view/EPGVisibleRangeEmitter.ts` if its API must accept a range calculator input, and existing EPG component/coordinator tests.
- `exact_issue_ids`: `DCR-14-A1`
- `verification`: `src/modules/ui/epg/__tests__/EPGGridRuntimeController.test.ts` must cover start/stop interval idempotence, visibilitychange registration/removal, hidden-state cleanup, visible-range emission/dedupe/reset across open cycles, render-pass callback ordering, and current-time/time-indicator refresh behavior; existing component/coordinator tests remain integration proof.
- `dependencies`: `DCR-14-S1` and `DCR-14-S2` complete enough that shell and focus callbacks are stable.
- `stop_condition`: stop if render extraction requires changing `EPGVirtualizer` public behavior, `EPGCoordinator.handleVisibleRangeChange` semantics, `onVisibleRangeChange` payloads, or Deferred EPG replay order.
- `handoff_condition`: timer/listener lifecycle and grid render coordination live in a runtime owner; `EPGComponent` remains a facade that wires state/collaborators and exposes the unchanged public API.
- `serial_only`: yes
- `parallel_justification`: grid runtime extraction consumes shell/focus seams and changes the same render callbacks.

- `coverage_check`:
  - `DCR-14-A1` maps to `DCR-14-S1`, `DCR-14-S2`, and `DCR-14-S3`. All three are required before package closeout because any one seam alone would leave the S0 concentration live.
  - `S0-L14-F2` maps to accepted residual only and has no implementation slice in this plan.
- `coverage_ledger`:
  - `DCR-14-A1`: execution unit `DCR-14-W1`; disposition remains `open` until all three slices land, verification passes, and a source audit proves `EPGComponent` no longer concentrates shell rendering, focus/navigation, timer/listener lifecycle, visible-range emission, and grid runtime coordination.
  - `S0-L14-F2`: disposition `accepted residual`; final owner design/style backlog owner; revisit on a future maintainer-approved EPG info-panel visual/structure pass, not DCR-14 cleanup execution.
- `execution_waves`:
  - `wave_id`: `DCR-14-W1`
  - `slice_ids`: `DCR-14-S1`, `DCR-14-S2`, `DCR-14-S3`
  - `completion_condition`: all three selected owner seams are implemented, focused tests for extracted owners pass, public EPG facade/coordinator/deferred tests pass, `npm run verify` passes, no CSS/visual treatment changes are present, and a source-backed closeout audit proves `S0-L01-F2` no longer describes current source.
  - `absorb_now_scope`: only residue inside the same EPG component file-health goal, same source files/owners, same public API, same verification envelope, and no visual/CSS treatment changes.
  - `replan_triggers`: any need for public `IEPGComponent` contract changes, navigation manager changes, `EPGCoordinator` policy changes, CSS/visible panel treatment changes, broader virtualizer redesign, or a post-slice audit showing `EPGComponent` still concentrates the same responsibility set.
- `ready_now_slice`: `DCR-14-S1`
- `ready_now_execution_unit`: `DCR-14-W1`
- `recommended_slice_order`: `DCR-14-S1`, `DCR-14-S2`, `DCR-14-S3`, then closeout source/design audit.
- `parallel_execution_policy`: serial only. Do not run these implementation slices in parallel because all slices edit the same facade and share state/rendering callbacks.

## Files In Scope

Implementation files:

- `src/modules/ui/epg/component/EPGComponent.ts`
- `src/modules/ui/epg/view/EPGShellView.ts` (new)
- `src/modules/ui/epg/view/index.ts` only for package-local export if needed
- `src/modules/ui/epg/focus/EPGFocusNavigator.ts` (new)
- `src/modules/ui/epg/runtime/EPGGridRuntimeController.ts` (new)
- `src/modules/ui/epg/view/EPGVisibleRangeEmitter.ts` only if the runtime extraction needs a narrow API adjustment

Test files:

- `src/modules/ui/epg/__tests__/EPGComponent.test.ts`
- `src/modules/ui/epg/__tests__/DeferredEPGComponent.test.ts`
- `src/modules/ui/epg/__tests__/EPGCoordinator.test.ts`
- `src/modules/ui/epg/__tests__/EPGShellView.test.ts`
- `src/modules/ui/epg/__tests__/EPGFocusNavigator.test.ts`
- `src/modules/ui/epg/__tests__/EPGGridRuntimeController.test.ts`
- `src/modules/ui/epg/__tests__/EPGVisibleRangeEmitter.test.ts` only if `EPGVisibleRangeEmitter` changes

Closeout docs after implementation/review only:

- `ARCHITECTURE_CLEANUP_CHECKLIST.md` section `DCR-14`
- `docs/architecture/CURRENT_STATE.md` `Current Hotspots` only if the source audit proves EPGComponent is no longer a current hotspot
- this plan for execution status/checklist closeout notes if the controller updates tracked planning state

## Files Out Of Scope

- `src/modules/ui/epg/styles.css`
- `src/modules/ui/epg/styles.cells.css`
- `src/modules/ui/epg/styles.classic.css`
- `src/modules/ui/epg/styles.grid.css`
- `src/modules/ui/epg/styles.info-panel.css`
- `src/modules/ui/epg/styles.motion.css`
- `src/modules/ui/epg/styles.shell.css`
- `src/modules/ui/epg/styles.theme.css`
- `docs/design/ui-design-language.md` unless a maintainer separately approves a visual/design pass
- `src/modules/ui/epg/view/EPGInfoPanel.ts` except for read-only audit or unchanged type imports
- `src/modules/ui/epg/view/EPGInfoPanelCoordinator.ts` except for read-only audit or unchanged wiring
- `src/modules/ui/epg/coordinator/EPGCoordinator.ts` except for tests proving unchanged interactions; implementation changes here are a replan trigger
- `src/modules/ui/epg/component/DeferredEPGComponent.ts` except for tests proving unchanged behavior; implementation changes here are a replan trigger
- `src/modules/navigation/*`
- `src/core/orchestrator/*`
- `src/core/initialization/*`
- unrelated DCR-11/DCR-12/DCR-13/DCR-EXIT plans, checklist entries, docs, and source files

## Planner Self-Check

- Architecture seam: resolved. `EPGComponent` remains the public facade; new owners are package-local shell view, focus navigator, and grid runtime controller.
- Adjacent contracts: frozen. `IEPGComponent`, `DeferredEPGComponent`, `EPGCoordinator`, navigation routing, and orchestrator wiring must keep current behavior.
- Out-of-scope reliance: explicit. CSS and info-panel visual treatment are out of scope; existing visual treatment must be preserved.
- Codanna evidence: recorded, including insufficient class-level impact result and deterministic fallback reads.
- Ownership: selected seams reduce the current hotspot instead of moving logic into composition roots or unrelated modules.
- Fresh-session readiness: package id, ready execution unit, slices, files, invariants, verification, and stop/replan triggers are explicit.
- Plan grade: execution-ready at seam/scope/verification level without pre-writing implementation internals.

## Architecture Seam Decision Gate

Approved seams:

- `EPGShellView` owns EPG shell DOM creation and shell/banner presentation details.
- `EPGFocusNavigator` owns focus and navigation decisions while using `EPGComponent` only as facade/state/callback wiring.
- `EPGGridRuntimeController` owns time/listener lifecycle, visible-range emission, and render-pass coordination around `EPGVirtualizer`, `EPGTimeHeader`, and current-time refresh.
- `EPGComponent` remains the `IEPGComponent` implementation and may retain public method delegation, collaborator construction/wiring, and final event emission.

Preservation contracts:

- Preserve `IEPGComponent` method names, arguments, return values, events, and `getState` shape.
- Preserve `DeferredEPGComponent` lazy runtime loading, queued state replay, event bridging, pending focus commands, and logical visibility behavior.
- Preserve `EPGCoordinator` interactions: open/close/toggle, visible range callback semantics, schedule refresh triggers, focus preservation, library filter behavior, and guide-setting handling.
- Preserve D-pad focus/navigation behavior, wrap behavior, page behavior, library-tabs focus behavior, select/back handling, focused-cell class/data-key behavior, and `focusChange`, `channelSelected`, `programSelected`, `timeScroll`, and `channelScroll` event semantics.
- Preserve timer/listener cleanup: current-time interval starts only when shown, stops on hide/destroy, visibilitychange listener is removed on hide/destroy, info-panel timers are cleared by existing owner, and hidden UI leaves no stale transient focus state.
- Preserve visible-range semantics and event emission: same range payload shape, dedupe behavior, reset across close/open cycles, row buffer, time window, and `EPGCoordinator.handleVisibleRangeChange` behavior.
- Preserve ARIA/status/data hooks: `aria-live` on now-watching banner, `aria-hidden` shell toggles, program edge mask `aria-hidden`, focused-cell classes/data keys, and existing action/focus hooks.
- Preserve reduced-motion and current EPG visual treatment by making no CSS/visual-treatment changes.

Stop and replan if:

- an implementer proposes CSS, visible panel treatment, info-panel edge redesign, layout aesthetics, or design-language changes;
- one selected seam still leaves `EPGComponent` concentrating rendering, focus/navigation, timer lifecycle, and grid runtime coordination after its slice;
- public `IEPGComponent`, `DeferredEPGComponent`, `EPGCoordinator`, navigation, or orchestrator contracts need changes;
- focused tests require private probes instead of public owner APIs or stable behavior seams;
- extracted owners become generic utility dumping grounds rather than package-local responsibility owners;
- verification scope widens beyond the commands in this plan;
- current-source audit after `DCR-14-W1` cannot prove `S0-L01-F2` is false and there is no maintainer reclassification.

## Verification Commands

Verification mode: `refactor-invariance` plus focused owner contract tests.

- Verification classification: `new regression/contract test required`

Focused tests required:

- Add `src/modules/ui/epg/__tests__/EPGShellView.test.ts`, `src/modules/ui/epg/__tests__/EPGFocusNavigator.test.ts`, and `src/modules/ui/epg/__tests__/EPGGridRuntimeController.test.ts` because closure depends on proving responsibility moved.
- Existing `EPGComponent.test.ts` remains the public facade parity suite; it is not sufficient by itself for DCR-14 closeout.

Required commands for implementation closeout:

- Run: `npm run test:unit -- --runInBand src/modules/ui/epg/__tests__/EPGComponent.test.ts src/modules/ui/epg/__tests__/DeferredEPGComponent.test.ts src/modules/ui/epg/__tests__/EPGCoordinator.test.ts`
- Expected: public EPG facade, deferred behavior, and coordinator interactions remain unchanged.

- Run: `npm run test:unit -- --runInBand src/modules/ui/epg/__tests__/EPGShellView.test.ts src/modules/ui/epg/__tests__/EPGFocusNavigator.test.ts src/modules/ui/epg/__tests__/EPGGridRuntimeController.test.ts`
- Expected: extracted owners have direct focused proof for moved responsibilities.

- Run: `npm run verify`
- Expected: full UI/navigation/EPG integration verification passes after production/test changes.

- Run if CSS changes are made: `npm run lint:css`
- Expected: CSS lint passes. CSS changes should normally be absent; if this command is required because CSS changed, stop first unless maintainer approved a visual pass.

- Run if checklist/current-state/plan docs are updated: `npm run verify:docs`
- Expected: workflow/control-plane/reference docs validate after DCR-14 closeout doc updates.

- Run: `npm run plans:check`
- Expected: active tracked plan/checklist conformance passes before closeout.

- Run: `git diff --check`
- Expected: no whitespace or patch formatting errors.

Closeout source/design audit:

- Re-audit `src/modules/ui/epg/component/EPGComponent.ts` and adjacent EPG owners after implementation.
- Prove `EPGComponent` no longer owns all of shell rendering, focus/navigation, timer/listener lifecycle, visible-range emission, and grid runtime coordination.
- Prove no EPG CSS/visual panel treatment changed unless maintainer separately approved a visual pass.
- If the audit still supports `S0-L01-F2`, stop for maintainer reclassification rather than checking DCR-14 complete.

## Rollback Notes

- Revert the `DCR-14-W1` implementation files as one unit if public EPG behavior, focus/navigation, timer cleanup, visible-range emission, or visual treatment regresses.
- Keep this plan/checklist doc work separate from implementation commits.
- If a single slice fails verification but earlier slices are clean, do not close DCR-14; either continue inside `DCR-14-W1` if the failure stays within the approved seams or replan if the failure widens the contract.
- If a visual/CSS change appears in the diff without maintainer approval, remove it or stop for reclassification before proceeding.

## Commit Checkpoints

- Commit this plan artifact separately from production/test implementation work.
- During implementation, one focused non-interactive commit may cover the full `DCR-14-W1` execution unit after tests and review pass.
- Do not bundle active `docs/plans/*` progress edits into the implementation commit.
- Do not commit unrelated dirty/untracked DCR-11/DCR-12/DCR-13/DCR-EXIT work with this package.

## Closeout Evidence

`DCR-14` completed on 2026-04-30 after clean plan review, clean implementation
review, and source-backed closeout audit.

- `DCR-14-S1`: extracted shell DOM, shell ARIA visibility, program-area edge
  masks, watermark/header structure, and now-watching banner presentation into
  `src/modules/ui/epg/view/EPGShellView.ts`.
- `DCR-14-S2`: extracted D-pad navigation, page navigation, select/back
  handling, focus-time preservation, placeholder focus, wrap behavior, and
  library-tab routing into `src/modules/ui/epg/focus/EPGFocusNavigator.ts`.
- `DCR-14-S3`: extracted current-time interval/listener lifecycle,
  visibilitychange refresh, visible-range emission/dedupe/reset, render-pass
  coordination, virtualizer/time-header refresh, time indicator, and auto-fit
  time-offset behavior into
  `src/modules/ui/epg/runtime/EPGGridRuntimeController.ts`.

Fresh source audit:

- `src/modules/ui/epg/component/EPGComponent.ts` is `778` lines and remains the
  `IEPGComponent` facade/wiring owner.
- Shell rendering ownership is now in `EPGShellView`; focus/navigation
  ownership is now in `EPGFocusNavigator`; timer/listener lifecycle,
  visible-range emission, and grid render coordination are now in
  `EPGGridRuntimeController`.
- `EPGComponent` still exposes the public EPG facade methods but delegates
  `handleNavigation`, `handlePage`, `handleSelect`, and `handleBack` to
  `EPGFocusNavigator`.
- No EPG CSS or visual panel treatment files changed. `S0-L14-F2` remains an
  accepted visual/design residual outside cleanup-agent implementation scope.

Verification observed during implementation/review:

- Clean final plan approval completed before implementation.
- Implementation review found no material findings.
- `npm run test:unit -- --runInBand
  src/modules/ui/epg/__tests__/EPGComponent.test.ts
  src/modules/ui/epg/__tests__/DeferredEPGComponent.test.ts
  src/modules/ui/epg/__tests__/EPGCoordinator.test.ts` passed.
- `npm run test:unit -- --runInBand
  src/modules/ui/epg/__tests__/EPGShellView.test.ts
  src/modules/ui/epg/__tests__/EPGFocusNavigator.test.ts
  src/modules/ui/epg/__tests__/EPGGridRuntimeController.test.ts` passed.
- Implementation review reran the six EPG suites together with `npx jest ...
  --runInBand`; `6` suites and `178` tests passed.
- `npm run verify` passed.
- `npm run plans:check`, `npm run verify:docs`, and `git diff --check` passed
  during controller closeout.

No DCR-14 closeout gates remain open. `DCR-EXIT-S2` remains blocked on
`DCR-15` and `DCR-16`.
