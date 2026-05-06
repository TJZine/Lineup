**Plan Status:** completed
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

# FCP-23 Port UI Workflow Readiness Plan

## Goal

Retire `ARCHITECTURE_CLEANUP_CHECKLIST.md` item `FCP-23` by closing the source-backed UI workflow port-readiness findings for channel setup and EPG presentation after completed `FCP-10`, `FCP-11`, `FCP-13`, `FCP-20`, `FCP-21`, and reopened `FCP-22` broadened owner-shape baseline evidence.

This is an FCP source-backed checklist package. Coverage is defined only by `source_finding_id` values `FCP-23-SF1`, `FCP-23-SF2`, `FCP-23-SF3`, and `FCP-23-SF4`. Do not use Desloppify output, detector ids, imported review ids, package-map ids, raw review observations, score deltas, or historical hotspot wording as intake, proof, or closeout evidence. Those signals may still be used as source-audit prompts and risk context for files already inside the FCP-23 scope; they must not be ignored when they point at current same-file risk, and they must not be converted into FCP membership, coverage, or raw issue-id proof.

Current-source audit admits one behavior-preserving implementation slice:

- `FCP-23-SF1`: `ChannelSetupScreen` already has focused session, focus, dropdown, strategy interaction, step, and build presenters after `FCP-11`, but it still owns the screen-local bridge that ties portable wizard workflow concepts to one TV/webOS screen adapter: visibility/load lifecycle, step routing, strategy interaction adapters, preset stepping, selected-server projection handoff, and presenter composition. The approved work is a narrow channel setup UI owner split that keeps `ChannelSetupScreen` as the screen shell/step-router while moving the portable workflow/presenter glue into package-local owner(s) behind the existing screen and workflow ports.

Current-source audit source-disproves production implementation for the exact FCP source findings below. This is a source-truth disposition, not a deferral because the rewrite would be large. If execution audit proves any of these exact findings is true on current source, or proves the correct port-ready shape requires a larger rewrite inside the FCP-23 owner seam, the worker must admit that work through a refreshed FCP-23 plan instead of source-disproving it.

- `FCP-23-SF2`: `StrategyStepController` has no source-proven schema ambiguity after `FCP-13`. Current strategy interaction descriptors and tests already own adjustable-control schema and keyboard/dropdown interaction outside the render controller.
- `FCP-23-SF3`: EPG cell text/layout/progress/ticker measurement helpers already live in `EPGCellPresentation.ts`, with `EPGCellRenderer.ts` acting as the DOM adapter and ticker timer/class owner. Existing direct renderer tests cover width tiers, slivers, focused episode/movie layouts, live/progress, reset behavior, and ticker timing.
- `FCP-23-SF4`: no EPG view organization is naturally required by the current EPG presentation audit. Behavior-neutral EPG organization remains a later `FCP-24-SF4` question only if post-FCP-23 source audit proves reviewability risk.

Completion means every `FCP-23-SF*` is resolved, source-disproved, or accepted with one owner and revisit trigger; channel setup portable workflow/presenter glue no longer concentrates in `ChannelSetupScreen`; selected-server projection remains runtime-only behind app-shell ports; TV-visible focus/dropdown/build/review/success/cancel/error behavior remains unchanged; EPG presentation residuals are source-disproved or resolved without visual, ticker, reduced-motion, virtualizer, DOM, or package-seam drift; and `FCP-24`, `FCP-25`, Windows work, and broader post-FCP cleanup remain blocked until clean FCP-23 closeout evidence exists. Closeout may accept same-file or same-area residual debt only by naming why it is outside FCP-23 membership or outside the approved owner seam, never because it is too large to fix in this package.

## Non-Goals

- Do not implement production or test code from this planning pass.
- Do not update `ARCHITECTURE_CLEANUP_CHECKLIST.md`, mark `FCP-23` in progress or complete, or set ready-now fields outside this plan during this planning pass.
- Do not start or plan `FCP-24`, `FCP-25`, Windows platform implementation, or other post-FCP cleanup.
- Do not reopen completed `FCP-10`, `FCP-11`, or `FCP-13` unless fresh current-source audit proves a distinct live residual in the FCP-23 owner seam.
- Do not change product behavior, visual design, CSS aesthetics, copy, channel setup workflow semantics, EPG layout behavior, focus behavior, dropdown behavior, build/review/progress/cancel/success/error semantics, selected-server behavior, or platform policy.
- Do not change selected-server persistence schemas/keys, channel setup persisted record schemas/keys, build scratch keys, raw storage ownership, Plex request/metadata contracts, scheduler/channel-manager/content-resolution behavior, navigation public APIs, or playback/runtime/Plex auth behavior.
- Do not add compatibility shims, old-path wrappers, root/package barrels, subfolder barrels, public API widening, public export widening, or foldering-only churn.
- Do not move EPG view files unless `FCP-23-SF3` implementation unexpectedly proves organization is required; that is a stop/replan condition unless the move remains inside the approved EPG view proof surface and has clean review.

## Parent Priority Alignment

`FCP-23` is the next safe package after completed and reopened `FCP-22`. The broadened FCP-22 owner-shape closeout plan is `docs/plans/2026-05-05-fcp-22-port-scheduler-channel-content-owner-shape-replan.md`; the older `docs/plans/2026-05-05-fcp-22-port-scheduler-channel-content-readiness-plan.md` remains completed partial evidence only. The FCP-22 replan is scheduler/channel-manager/content scoped and source-disproves remaining owner-shape residue there; it does not admit channel setup, EPG, navigation, focus, UI workflow, selected-server, Plex, Windows, or FCP-23 work into FCP-22.

This refresh incorporates the FCP-22 owner-shape replan and the strengthened cleanup planning rule: optimize for the intended long-term owner shape and repo-preferred practice, not the smallest patch that closes a named finding. No FCP-23 no-code/source-disproved disposition may rest on fix size. If current FCP-23 source audit proves a larger rewrite is the correct port-ready shape inside the approved UI owner seam, refresh this plan and admit that rewrite as a coherent execution unit or wave.

The checklist blocks `FCP-24`, `FCP-25`, Windows work, and other post-FCP cleanup until `FCP-23` has clean closeout evidence.

Current architecture places channel setup workflow, persistence, build scratch lifecycle, and planning contracts under `src/core/channel-setup/**`, while `src/modules/ui/channel-setup/**` owns the TV screen, step rendering, session/runtime, dropdown, focus, and build presentation. `src/core/app-shell/deferred-screens/AppLazyScreenPortFactory.ts` owns the channel setup screen's selected-server projection as runtime state (`getSelectedServerId`) only; channel setup UI must not construct `ServerSelectionStore` or consume selected-server storage-key getters.

Current architecture places EPG view/presentation owners under `src/modules/ui/epg/view/**`. `EPGCellPresentation.ts` owns pure cell text/layout/progress/ticker measurement helpers, `EPGCellRenderer.ts` stays the DOM adapter used by `EPGVirtualizer.ts`, and `src/modules/ui/epg/view/index.ts` is package-local. The cross-module `src/modules/ui/epg/index.ts` must not re-export view/util leaves.

The approved FCP-23 seam is UI workflow port-readiness inside channel setup and source-backed EPG presentation proof only. It does not authorize scheduler/content cleanup, Plex runtime cleanup, standalone package organization, visual redesign, or Windows implementation.

## Required Reading

Read in this order before implementation or review:

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/README.md` routing table
4. `docs/agentic/session-prompts/cleanup-loop.md`
5. `docs/agentic/plan-authoring-standard.md`, especially Universal Plan Core, Cleanup Overlay, and FCP Source-Backed Checklist Override
6. `docs/agentic/codanna-playbook.md`
7. `ARCHITECTURE_CLEANUP_CHECKLIST.md`
   - `Fresh-Session Handoff`
   - `Operating Contract`
   - `FCP Operating Rules`
   - `FCP-7` through `FCP-12` completed baseline summary
   - `FCP-13` through `FCP-22` completed baseline/current context
   - `FCP-23`
   - `FCP-24` and `FCP-25` only for sequencing blockers and out-of-scope routing
8. `docs/architecture/CURRENT_STATE.md`
9. `docs/architecture/modules.md`
10. Completed guardrail plans:
    - `docs/plans/2026-05-02-fcp-10-epg-renderer-direct-confidence-presentation-decomposition-plan.md`
    - `docs/plans/2026-05-02-fcp-11-runtime-owner-reduction-hotspots-plan.md`
    - `docs/plans/2026-05-05-fcp-13-low-risk-source-signal-api-export-diagnostic-closure-plan.md`
    - `docs/plans/2026-05-05-fcp-20-pre-windows-cleanup-exit-source-reconciliation-plan.md`
    - `docs/plans/2026-05-05-fcp-21-port-runtime-playback-plex-auth-readiness-plan.md`
    - `docs/plans/2026-05-05-fcp-22-port-scheduler-channel-content-owner-shape-replan.md`
    - `docs/plans/2026-05-05-fcp-22-port-scheduler-channel-content-readiness-plan.md` as older partial evidence only
11. Completed `FCP-7` through `FCP-9`, `FCP-12`, and `FCP-14` through `FCP-19` plans only if current source contradicts the compact checklist baseline.
12. This plan.
13. Source and test files named under `## Files In Scope`.
14. `git status --short --branch`.

Freshness gate: stop and refresh this plan if any `FCP-22` closeout truth, `FCP-23` checklist text, channel setup or EPG architecture ownership text, source files in scope, tests in scope, selected-server projection contracts, or public channel setup workflow contracts changed materially after this refresh on 2026-05-05.

Refresh observed branch `code-health...origin/code-health [ahead 6]` with unrelated dirty/untracked paths: `docs/archive/plans/2026-04-30-dcr-10-oversized-test-suite-structure.md`, `docs/plans/2026-04-30-dcr-exit-final-dimension-audit-plan.md`, `scorecard.png`, and `docs/agentic/evals/baseline-summaries/2026-04-28-prompt-13-feature-low-implementer-policy.md`. Also observed FCP-22/workflow control-plane edits and the new FCP-22 owner-shape replan. Preserve unrelated paths unless a fresh source audit proves direct FCP-23 overlap.

`docs/design/ui-design-language.md` and `docs/user-guide/channels.md` were not required for this plan because source audit did not admit visual redesign, styling truth changes, or public channel setup/user-guide behavior changes. If implementation changes TV-visible styling, copy, or documented channel setup/live-TV workflow truth, stop and replan before reading/updating those docs.

## Required Skills

- `ui-composition-patterns`: required for channel setup screen composition, focus, dropdown, build presentation, lifecycle cleanup, and TV-visible behavior preservation.
- `architecture-boundaries`: required because this plan changes module ownership and screen/composition seams around a current UI workflow surface.
- `verification-strategy`: required to freeze proof depth for behavior-preserving UI workflow extraction and no-code source-disproved EPG/strategy dispositions.
- `execution-plan-authoring`: required for Tier 3 source-backed FCP package planning.
- `persistence-boundaries`: loaded as read-only guardrail context because selected-server projection and channel setup record/build-scratch storage owners are implicated. This plan does not authorize storage changes.

Do not load `debugging-remediation` unless execution proves a concrete bug/regression. Do not load `plex-integration-boundaries` unless a fresh source audit unexpectedly implicates Plex request/metadata contracts; that should normally stop and replan. Do not load `frontend-design` or `interface-design`; this is not a visual redesign or new product UI.

## Codanna Discovery

- `get_index_info`: Codanna index contained 12,111 symbols across 802 files and 14,316 relationships. Semantic search was enabled with `JinaEmbeddingsV2BaseCode`, 337 embeddings, created/updated about 40 minutes before planning.
- Refresh after reopened FCP-22: direct reads of `ARCHITECTURE_CLEANUP_CHECKLIST.md`, workflow/plan-standard changes, and `docs/plans/2026-05-05-fcp-22-port-scheduler-channel-content-owner-shape-replan.md` show the FCP-22 update is scheduler/channel-manager/content owner-shape evidence only. It changes the FCP-23 baseline and review standard, but it does not change FCP-23 source membership or add FCP-23 source files. No new FCP-23 Codanna source discovery was required for this refresh because no channel setup, selected-server, StrategyStep, EPG, app-shell port, or UI workflow source changed in the FCP-22 replan.
- `search_documents`: anchored searches for `FCP-23 checklist baseline source finding ChannelSetupScreen StrategyStepController EPGCellRenderer`, `FCP-10 FCP-11 FCP-13 FCP-20 FCP-21 FCP-22 baseline completed plans channel setup EPG renderer runtime owner`, and current architecture context were noisy. Results returned unrelated DCR/user-guide/historical snippets and did not reliably surface authoritative FCP-23 membership. Deterministic fallback was required and used: direct reads of the checklist, current architecture docs, and completed FCP plans.
- `semantic_search_with_context "ChannelSetupScreen portable workflow presenter session focus dropdown build progress selected server projection"`: surfaced app-shell selected-server entrypoints such as `openServerSelect` and EPG focus symbols rather than the screen owner. This was insufficient for channel setup source truth.
- `find_symbol ChannelSetupScreen`: found `src/modules/ui/channel-setup/ChannelSetupScreen.ts` symbol_id `7423`; impact shows app-shell visibility/registry/app relationships through `AppLazyScreenRegistry`, `AppScreenVisibilityCoordinator`, and `App`.
- `find_symbol ChannelSetupSessionRuntime`: found symbol_id `6515`; impact shows `ChannelSetupSessionController`, `ChannelSetupScreen`, and `ChannelSetupBuildStepPresenter` paths.
- `find_symbol ChannelSetupFocusCoordinator`: found symbol_id `6996`; impact shows `ChannelSetupScreen` and lazy registry visibility path.
- `find_symbol ChannelSetupDropdownController`: found symbol_id `7103`; impact returned no impacted symbols, which is a Codanna reverse-impact gap because direct source reads prove `ChannelSetupScreen` owns the instance.
- `search_symbols ChannelSetupScreenWorkflowPort`: found `src/core/channel-setup/workflow/ChannelSetupScreenWorkflowPort.ts`, `createChannelSetupScreenWorkflowPort(...)`, `ChannelSetupSessionController`, `ChannelSetupSessionRuntime`, and `ChannelSetupScreen` consumers.
- `search_symbols ChannelSetupPlanningService`: found `src/core/channel-setup/planning/ChannelSetupPlanningService.ts` as the plan/review composition owner.
- `search_symbols getSelectedServerId`: found app-shell/orchestrator runtime methods and the private channel setup screen wrapper. Direct reads confirmed selected-server storage getters are not exposed through `ChannelSetupScreenPorts`.
- `find_symbol StrategyStepController`: found symbol_id `6860`; impact returned no impacted symbols, which is insufficient for render-owner proof. Direct reads and tests are authoritative.
- `semantic_search_with_context "EPGCellRenderer EPGCellPresentation ticker reduced motion virtualizer DOM adapter"`: surfaced `CellRenderData`, `EPGVirtualizer.renderVisibleCells(...)`, `EPGChannelList`, and related EPG view symbols.
- `find_symbol EPGCellRenderer`: found symbol_id `4353`; impact returned no impacted symbols, which is insufficient because direct source reads prove `EPGVirtualizer` constructs and calls the renderer.
- `find_symbol EPGCellPresentation`: no class/file symbol found. Fallback `search_symbols` found exported presentation helpers:
  - `getCellTimeLabelPresentation` symbol_id `4871`; impact reaches `EPGCellRenderer.updateCellTimeLabel*`.
  - `getProgramCellTextLayout` symbol_id `4874`; impact reaches `EPGCellRenderer.updateCellContent` and `EPGVirtualizer` render/focus paths.
  - `getProgressFillWidth` symbol_id `4888`; impact reaches `EPGCellRenderer.applyProgressPresentation` and temporal/content updates.
  - `getEffectiveTickerClientWidth` symbol_id `4892`; impact reaches `EPGCellRenderer.syncFocusedTicker`, `EPGVirtualizer.syncFocusedTitleTickerForVisibleFocus`, and `measureReadyStateTickerOverflow`.
  - `measureReadyStateTickerOverflow` symbol_id `4894`; impact reaches ticker sync paths.
  - `buildTickerTarget` symbol_id `4897`; impact reaches ticker sync paths.
- `find_symbol AppLazyScreenPortFactory`: found symbol_id `9731`; impact shows `AppLazyScreenRegistry` and `App`.
- `rg` / direct source reads covered `src/modules/ui/channel-setup/**`, `src/core/channel-setup/**`, `src/core/app-shell/deferred-screens/AppLazyScreenPortFactory.ts`, `src/core/app-shell/runtime/AppShellRuntimeContracts.ts`, `src/modules/ui/epg/view/**`, `src/modules/ui/epg/component/**` for EPG view organization guardrails, selected-server projection boundaries, workflow/presenter/session/dropdown/focus/build/progress behavior, StrategyStepController descriptor/control structure, EPG renderer/presentation/text-layout/ticker/DOM-adapter behavior, reduced-motion and virtualizer guardrails, and package-local imports/exports.

## Impact Snapshot

Current-source proof at plan time:

- Reopened `FCP-22` owner-shape closeout is now the scheduler/channel-manager/content baseline. It leaves FCP-23 sequencing unblocked only after this FCP-23 plan refresh/review and does not alter channel setup, selected-server projection, StrategyStep, or EPG ownership claims below.
- The strengthened cleanup planning rule applies to all FCP-23 dispositions: source-disproved/no-code requires positive source proof that the exact finding is false and that the intended owner shape already exists, not merely that a broader cleanup would be large.

- `ChannelSetupScreen.ts` is now a screen shell/step-router rather than the pre-FCP-11 all-in-one hotspot, but it still owns channel setup's portable UI workflow bridge: show/hide visibility tokens, library-load kickoff, navigation key listener registration, step routing, strategy interaction adapter creation, selected-server projection wrapper, numeric preset stepping helpers, transient state resets, and composition of session/focus/dropdown/build/step controllers.
- `ChannelSetupSessionController.ts` is a UI-facing composition wrapper over `ChannelSetupSessionState` and `ChannelSetupSessionRuntime`.
- `ChannelSetupSessionRuntime.ts` owns workflow I/O, load/preview/review/build abort controllers, preview debounce/request/delta timers, string-only UI runtime error summaries, missing-server/build blocked/canceled/error/success outcomes, and session cleanup.
- `ChannelSetupDropdownController.ts` owns active dropdown lifecycle, deferred render flushing, dismiss-to-anchor focus, and cleanup. It is package-local and should not become a second screen owner.
- `ChannelSetupFocusCoordinator.ts` owns focus registration/unregistration and preferred/first focus restore for linear, spatial, and Step 2 focus maps.
- `StrategyStepInteractionController.ts` owns Step 2 interaction state, adjustable-control descriptors, dropdown config building, inline left/right cycling, category/detail focus memory, priority-row grab/reorder state, and keyboard handling.
- `StrategyStepController.ts` owns render-only Step 2 DOM assembly and in-place priority-row state updates. After `FCP-13`, no source-proven schema ambiguity remains; its direct tests cover mixed-scope controls, adjustable controls, preview strip, priority rows, category dots, footer actions, and mutation routing.
- `ChannelSetupBuildStepPresenter.ts`, `BuildReviewStepController.ts`, and `BuildProgressStepController.ts` own build review/progress/success UI presentation and Done action handoff. The presenter still participates in the active S1 proof because `ChannelSetupScreen` composes it and build semantics are preservation-critical.
- `AppLazyScreenPortFactory.ts` owns the screen-facing channel setup workflow projection and runtime screen ports. `AppShellChannelSetupRuntimePort.getSelectedServerId()` is runtime projection only; `ChannelSetupScreenPorts` does not expose selected-server storage-key getters.
- `ChannelSetupScreen.contracts.test.ts` already asserts selected-server persistence stays behind app-shell ports and string-only UI runtime errors remain at the screen boundary.
- `AppLazyScreenPortFactory.test.ts` already asserts `createChannelSetupScreenWorkflowPort(...)` omits planner diagnostics, channel setup input delegates through runtime ports, selected-server storage getters are absent, and navigation is looked up at call time.
- `EPGCellPresentation.ts` owns pure cell width tiers, visible text metrics, time label presentation, text layout, width presentation, progress fill calculation, ticker target building, and ticker measurement helpers.
- `EPGCellRenderer.ts` owns DOM element creation/reset, applying presentation helpers to DOM nodes, live badge classes, progress fill DOM mutation, focused ticker timer/class lifecycle, and reduced-motion gating. That is the expected DOM-adapter role, not a source-proven duplicate presentation owner.
- `EPGVirtualizer.ts` constructs `EPGCellRenderer`, calls renderer methods for render/recycle/focus/ticker/temporal updates, and remains the virtualized-grid owner.
- `src/modules/ui/epg/view/index.ts` is package-local and currently exports view classes, not `EPGCellPresentation` helpers. `src/modules/ui/epg/index.ts` remains the cross-module seam and does not re-export view/util leaves.
- Current tests provide a broad proof surface: `ChannelSetupScreen.test.ts` covers loading, show/hide, focus cleanup, Step 2 navigation/dropdowns/preview, review/build/progress/cancel/success/error paths, and priority reorder behavior; package-local session/focus/dropdown/step tests cover extracted owners; `EPGCellRenderer.test.ts` covers renderer behavior directly.

## Files In Scope

- `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
- `src/modules/ui/channel-setup/ChannelSetupScreenPorts.ts`
- `src/modules/ui/channel-setup/ChannelSetupSessionController.ts`
- `src/modules/ui/channel-setup/ChannelSetupSessionRuntime.ts`
- `src/modules/ui/channel-setup/ChannelSetupSessionState.ts`
- `src/modules/ui/channel-setup/ChannelSetupSessionContracts.ts`
- `src/modules/ui/channel-setup/ChannelSetupDropdownController.ts`
- `src/modules/ui/channel-setup/focus/ChannelSetupFocusCoordinator.ts`
- `src/modules/ui/channel-setup/focus/types.ts`
- `src/modules/ui/channel-setup/steps/LibraryStepController.ts`
- `src/modules/ui/channel-setup/steps/StrategyStepController.ts`
- `src/modules/ui/channel-setup/steps/StrategyStepInteractionController.ts`
- `src/modules/ui/channel-setup/steps/ChannelSetupBuildStepPresenter.ts`
- `src/modules/ui/channel-setup/steps/BuildReviewStepController.ts`
- `src/modules/ui/channel-setup/steps/BuildProgressStepController.ts`
- `src/modules/ui/channel-setup/steps/types.ts`
- New package-local channel setup workflow/presenter/adapter owner file(s) under `src/modules/ui/channel-setup/` or `src/modules/ui/channel-setup/steps/` only when they directly retire `FCP-23-SF1` without widening public APIs.
- `src/core/channel-setup/workflow/ChannelSetupScreenWorkflowPort.ts` and `src/core/channel-setup/workflow/ChannelSetupWorkflowPort.ts` for read-only contract audit by default; production changes require the seam gate to remain inside the existing screen-facing workflow projection.
- `src/core/channel-setup/planning/ChannelSetupPlanningService.ts` for read-only proof that plan/review composition stays in core.
- `src/core/app-shell/deferred-screens/AppLazyScreenPortFactory.ts` and `src/core/app-shell/runtime/AppShellRuntimeContracts.ts` for selected-server projection and lazy-screen port audits; production changes are not approved by default.
- `src/modules/ui/epg/view/EPGCellPresentation.ts`
- `src/modules/ui/epg/view/EPGCellRenderer.ts`
- `src/modules/ui/epg/view/EPGVirtualizer.ts` only for read-only source audit or narrow affected integration proof if EPG presentation changes are unexpectedly admitted after replan.
- `src/modules/ui/epg/view/index.ts` and `src/modules/ui/epg/component/EPGComponent.ts` only for package-local export/view-organization audits; production changes are not approved by default.
- Targeted tests:
  - `src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts`
  - `src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.contracts.test.ts`
  - `src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts`
  - `src/modules/ui/channel-setup/__tests__/ChannelSetupSessionRuntime.test.ts`
  - `src/modules/ui/channel-setup/__tests__/ChannelSetupDropdownController.test.ts`
  - `src/modules/ui/channel-setup/focus/__tests__/ChannelSetupFocusCoordinator.test.ts`
  - `src/modules/ui/channel-setup/steps/__tests__/StrategyStepController.test.ts`
  - `src/modules/ui/channel-setup/steps/__tests__/StrategyStepInteractionController.test.ts`
  - `src/modules/ui/channel-setup/steps/__tests__/ChannelSetupBuildStepPresenter.test.ts`
  - `src/modules/ui/channel-setup/steps/__tests__/BuildReviewStepController.test.ts`
  - `src/modules/ui/channel-setup/steps/__tests__/BuildProgressStepController.test.ts`
  - `src/core/app-shell/__tests__/AppLazyScreenPortFactory.test.ts`
  - `src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts`
  - `src/modules/ui/epg/view/__tests__/index.test.ts`
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` only during future package closeout after clean implementation review and verification.
- `docs/architecture/CURRENT_STATE.md` and `docs/architecture/modules.md` only if implementation source audit proves current ownership truth changed.

## Files Out Of Scope

- Any production or test file not named in `## Files In Scope`.
- `src/modules/plex/**`, Plex request/metadata/auth/discovery/library/stream contracts, token/header/redaction behavior, playback/runtime behavior, scheduler/channel-manager/content-resolution behavior, navigation public APIs, lifecycle/settings persistence owners, Windows platform code, and broad app-shell/orchestrator composition outside the named port-factory audit.
- `src/modules/ui/epg/styles.css`, channel setup CSS files, design docs, user-guide docs, and other visual/copy surfaces unless a stopped/replanned review explicitly admits a docs or style truth change.
- EPG package/folder organization outside a source-proven S4 replan. `FCP-24-SF4` remains the final owner for later behavior-neutral EPG organization if FCP-23 source-disproves the need now.
- Selected-server persistence schemas/keys, channel setup persisted record schemas/keys, build scratch schemas/keys, raw `localStorage` access, storage helper behavior, migration/compatibility parsing, and any new storage owner.
- Public package barrels, compatibility re-exports, root barrels, subfolder barrels, old-path wrappers, or public API widening.
- Pre-existing unrelated dirty/untracked workspace paths listed under `## Required Reading`.

## Planner Self-Check

1. Package membership is explicit: `FCP-23-SF1` maps to `FCP-23-S1`, `FCP-23-SF2` maps to `FCP-23-S2`, `FCP-23-SF3` maps to `FCP-23-S3`, and `FCP-23-SF4` maps to `FCP-23-S4`.
2. Adjacent contracts are explicit: selected-server projection, channel setup workflow ports, persistence owners, EPG virtualizer behavior, EPG package seams, Plex, scheduler, navigation, visual design, and Windows behavior are frozen unless a stop/replan condition fires.
3. Files out of scope are not hidden dependencies. App-shell selected-server projection and EPG component/virtualizer paths are read-only audit or affected proof surfaces, not approved ownership expansion.
4. Codanna evidence and insufficiencies are recorded, including noisy document search, weak channel setup semantic results, missing file-level `EPGCellPresentation` symbol, and weak reverse impact for local classes, with direct `rg`/source-read fallback.
5. The plan uses repo-preferred owners: channel setup UI workflow/presenter glue moves to package-local UI owners, core channel setup keeps planning/workflow contracts, app-shell keeps selected-server projection, and EPG view helpers remain under the EPG view owner.
6. A fresh cleanup-loop session can start `ready_now_execution_unit` `FCP-23-W1` without deciding package membership, final-owner accounting, parallelism, or verification depth.
7. This is execution-grade at seam/scope/verification level and leaves ordinary helper naming, exact private type names, and local extraction mechanics to the cleanup worker.

## Architecture Seam Decision Gate

Approved execution seam:

- Execute one serial wave, `FCP-23-W1`, covering `FCP-23-S1` through `FCP-23-S4`.
- `FCP-23-S1` is the only approved production implementation slice. Keep `ChannelSetupScreen` as the public screen shell and step-router. Move only portable wizard workflow/presenter glue out of the screen into package-local owner(s): strategy adapter creation, preset stepping, presenter composition glue, and screen-to-session/dropdown/focus/build coordination that is not inherently DOM shell setup. Preserve existing screen constructor shape unless a narrow package-local test update proves a smaller internal seam is needed. Do not move session runtime, focus, dropdown, build presenter, or core planning responsibilities into a new all-purpose coordinator.
- `FCP-23-S2` is source-disproved/no-code only if current source proves the exact `FCP-23-SF2` StrategyStepController schema/descriptor finding is false after completed `FCP-13`. `StrategyStepController` remains render-only Step 2 DOM assembly; `StrategyStepInteractionController` remains descriptor and interaction owner. If the exact source finding is true and the correct shape requires a larger Step 2 rewrite inside this owner seam, refresh this plan and do that work instead of marking it no-code.
- `FCP-23-S3` is source-disproved/no-code only if current source proves the exact `FCP-23-SF3` EPG duplicate presentation/text-layout/ticker/DOM-adapter finding is false beyond completed `FCP-10` and `FCP-13`. `EPGCellPresentation.ts` remains the pure presentation helper owner; `EPGCellRenderer.ts` remains the DOM adapter/ticker lifecycle owner; `EPGVirtualizer.ts` remains the virtualized-grid owner. If the exact source finding is true and port-ready shape requires a larger EPG presentation rewrite inside this owner seam, refresh this plan and do that work instead of marking it no-code.
- `FCP-23-S4` is source-disproved/no-code for FCP-23 only if current source proves the exact `FCP-23-SF4` view-organization finding is false or not naturally required by S3. If S3 proves organization is required to reach the correct EPG presentation shape, refresh this plan and admit that work; otherwise standalone behavior-neutral organization remains a later `FCP-24-SF4` owner.
- Desloppify and other rubric signals in files already in scope are audit prompts and risk context. Use them to challenge source-disproved dispositions and same-file residuals, especially when they point to current structure in the FCP-23 owner seam. Do not use their raw ids, scores, or detector categories as FCP coverage, proof, or closeout membership.

Stop and replan if:

- focus behavior, focus registration/unregistration, preferred focus restoration, Step 2 category/detail focus transfer, priority-row grab/reorder behavior, or stale-focus behavior changes;
- dropdown open/dismiss/select/deferred-render behavior, anchor focus restoration, or Back-key dismissal changes;
- channel setup session lifecycle, preview debounce/timeout/delta cleanup, review loading, build abort/cancel, blocked/error/missing-server/success/bookkeeping-warning semantics, or Done action handoff changes;
- selected-server projection changes from runtime read to storage access, storage-key getter exposure, `ServerSelectionStore` construction, schema/key migration, or any persistence behavior change;
- channel setup core planning/build contracts, `ChannelSetupWorkflowPort`, or `ChannelSetupScreenWorkflowPort` need public API widening beyond the existing screen-facing projection;
- UI extraction creates a second screen owner, a broad workflow god object, compatibility shim, root/package barrel, public export widening, or temporary adapter with no removal trigger;
- EPG DOM shape, class names, ticker timer/ready/running classes, reduced-motion behavior, virtualizer render/recycle/focus/temporal behavior, live/progress/text layout, sliver behavior, or package export seams change without a refreshed plan and targeted proof;
- source-disproved/no-code audit for S2, S3, or S4 finds current structural debt in the FCP-23 owner seam that materially blocks port-readiness, even if the correct fix is a broad rewrite;
- Desloppify or another rubric signal points to current same-file structural risk inside the FCP-23 owner seam and source audit cannot prove the exact FCP finding false with one final owner and revisit trigger;
- source audit requires Plex, scheduler/channel-manager/content-resolution, navigation API, app-shell/orchestrator composition beyond selected-server port audit, visual redesign, public docs behavior changes, package-foldering-only work, or Windows work;
- reopened FCP-22 owner-shape evidence changes again, or a later FCP-22 review/source audit admits channel setup, EPG, navigation, focus, selected-server, or UI workflow work into the scheduler/channel-manager package;
- completed `FCP-10`, `FCP-11`, `FCP-13`, `FCP-21`, or `FCP-22` baseline evidence appears source-false;
- newly discovered residue changes package membership, execution-unit membership, final-owner accounting, owner seam, or verification surface.

Absorb-now rule: absorb only newly discovered residue that stays within `FCP-23-W1`'s approved goal, owners, files, verification envelope, and final-owner accounting. Record absorbed residue in implementation/review output. Replan for any new owner, wider verification, changed source-finding coverage, or changed execution-unit membership.

Post-plan-review bookkeeping gate: after this plan receives clean plan review, the controller may update the `FCP-23` checklist mini-record to point at this plan and `FCP-23-W1` / `FCP-23-S1`. That future bookkeeping update must not mark `FCP-23` in progress or complete and must not claim source-finding disposition before execution/review evidence exists.

## Package Decomposition

- `package_id`: `FCP-23`
- `checklist_token`: `FCP-23`
- `source_finding_ids`:
  - `FCP-23-SF1`
  - `FCP-23-SF2`
  - `FCP-23-SF3`
  - `FCP-23-SF4`

`slice_table`:

| slice_id | goal | areas/files | source_finding_ids | verification | dependencies | stop_condition | handoff_condition | serial_only | parallel_justification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FCP-23-S1` | Retire the live ChannelSetupScreen portable workflow/presenter concentration by moving non-shell wizard glue to package-local owner(s) while preserving screen shell, step routing, selected-server projection, session, focus, dropdown, and build semantics. This combines the checklist S1/S2 prompts into one owner split because source audit showed they share one behavior surface. | `ChannelSetupScreen.ts`; `ChannelSetupScreenPorts.ts`; existing/new channel setup package-local workflow/presenter/adapter owner files; session/focus/dropdown/build/strategy step files as needed for call-site preservation; `AppLazyScreenPortFactory.ts` and `AppShellRuntimeContracts.ts` read-only by default; targeted tests. | `FCP-23-SF1` | Targeted channel setup screen/contracts/session/runtime/focus/dropdown/strategy/build tests; app-shell port-factory selected-server projection tests if touched; selected-server no-storage audit; old/residual screen-responsibility audit; `npm run typecheck`; `git diff --check`; `npm run verify`. | None; first slice in wave. | Stop if extraction changes focus, dropdown, session, preview, review, build, selected-server, persistence, public port, visual, or Done action behavior; if a new owner becomes a second screen; or if tests require private probing. | `ChannelSetupScreen` remains shell/step-router while portable wizard workflow/presenter glue is owned by focused package-local owner(s); current behavior and tests pass; source audit shows the original SF1 concentration sentence no longer describes current source, or a reviewed no-code/accepted disposition names one final owner. | true | Focus/build/dropdown/session behavior shares one screen-level proof surface; splitting implementation would create duplicate final-owner accounting and risk inconsistent focus/lifecycle changes. |
| `FCP-23-S2` | Source-disprove or reopen StrategyStepController residual cleanup after proving the exact `FCP-23-SF2` descriptor/schema finding is false on current source, not merely large to fix. | Read-only audit by default over `StrategyStepController.ts`, `StrategyStepInteractionController.ts`, step constants/types, and targeted tests. Production changes are required through a refreshed plan if fresh audit proves the correct Step 2 shape needs a larger rewrite inside this owner seam. | `FCP-23-SF2` | Source audit for descriptor/schema repetition and render-vs-interaction ownership; use same-file rubric/Desloppify signals as prompts only; `npm test -- StrategyStepController StrategyStepInteractionController`; broader channel setup tests if touched. | After S1 source audit begins, so screen glue findings do not masquerade as StrategyStep render residuals. | Stop if cleanup would obscure render clarity, change Step 2 keyboard/dropdown/focus behavior, reopen completed `FCP-13-SF9` without distinct current-source proof, or find structural debt in the Step 2 owner seam that materially blocks port-readiness. | `FCP-23-SF2` is recorded as source-disproved/no-code with one final owner and revisit trigger, or this plan is refreshed with a concrete Step 2 render-owner slice, including broad rewrite if required. | true | Strategy Step behavior is tied to S1 focus/adapter proof; serial audit keeps one Step 2 final owner. |
| `FCP-23-S3` | Source-disprove or reopen EPG renderer/presentation residuals after completed FCP-10/FCP-13 by proving the exact `FCP-23-SF3` presentation/ticker/DOM-adapter finding is false on current source. | Read-only audit by default over `EPGCellPresentation.ts`, `EPGCellRenderer.ts`, `EPGVirtualizer.ts`, and direct renderer tests. Production changes are required through a refreshed plan if fresh audit proves the correct EPG presentation shape needs a larger rewrite inside this owner seam. | `FCP-23-SF3` | Source audit for text-layout/presentation/ticker helper ownership; use same-file rubric/Desloppify signals as prompts only; `npm test -- --runInBand src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts`; `npm test -- --runInBand src/modules/ui/epg/view/__tests__/index.test.ts` if exports are touched or audited; broader EPG tests if touched. | After S2 no-code audit, unless controller proves no overlapping channel setup work and no replan trigger fired. | Stop if EPG DOM shape, ticker, reduced-motion, virtualizer, live/progress/text layout, package exports, or visual behavior changes without refreshed plan; also stop if structural debt in the EPG presentation owner seam materially blocks port-readiness. | `FCP-23-SF3` is recorded as source-disproved/no-code with one final owner and revisit trigger, or this plan is refreshed with a concrete EPG view owner slice, including broad rewrite if required. | true | EPG source-disproof is independent from channel setup code but belongs in the same package closeout wave; parallel audit would not improve implementation throughput and could duplicate proof-matrix ownership. |
| `FCP-23-S4` | Close EPG view organization as no-code for FCP-23 only after proving the exact `FCP-23-SF4` organization finding is false or not naturally required by S3 on current source. | Read-only audit by default over `src/modules/ui/epg/view/index.ts`, `src/modules/ui/epg/index.ts`, EPG view imports, and `EPGComponent.ts` only for view-organization dependency checks. Production changes require a refreshed plan if S3 proves organization is required for correct port-ready shape. | `FCP-23-SF4` | EPG view/package export audit; use same-file rubric/Desloppify signals as prompts only; old/new import audit only if S3 admits moved files; no-barrel/no-shim audit; `npm test -- --runInBand src/modules/ui/epg/view/__tests__/index.test.ts`; docs verification only if architecture path truth changes. | After S3. | Stop if foldering-only churn is proposed, shims/barrels/export widening appear necessary, organization needs broader FCP-24-style package movement, or structural debt inside the FCP-23 EPG owner seam materially blocks port-readiness. | `FCP-23-SF4` is recorded as source-disproved/no-code for FCP-23 with one final owner and revisit trigger, or a refreshed plan proves organization is naturally required by S3. | true | Organization depends on S3 outcome; running it independently would violate the package's no-churn rule and FCP-24 sequencing. |

`coverage_check`:

- `FCP-23-SF1` maps exactly once to `FCP-23-S1`; planning disposition is active implementation. Final owner before closeout: channel setup UI package-local workflow/presenter owner(s), with `ChannelSetupScreen` retained as screen shell/step-router, `ChannelSetupSessionRuntime` retained for async workflow I/O/timers, `ChannelSetupDropdownController` retained for dropdown lifecycle, `ChannelSetupFocusCoordinator` retained for focus, and app-shell retained for selected-server projection. Revisit trigger: targeted channel setup tests, selected-server no-storage audit, or source review proves the new owner split changes behavior or leaves screen-concentration source-true.
- `FCP-23-SF2` maps exactly once to `FCP-23-S2`; planning disposition is source-disproved/no-code only if current source proves the exact `FCP-23-SF2` finding false. Final owner before closeout: `StrategyStepController` for render DOM and `StrategyStepInteractionController` for descriptors/interactions. Revisit trigger: future Step 2 source audit proves structural repetition or schema ambiguity beyond completed `FCP-13` and beyond S1 screen glue, including broad rewrite if that is the correct owner-seam fix.
- `FCP-23-SF3` maps exactly once to `FCP-23-S3`; planning disposition is source-disproved/no-code only if current source proves the exact `FCP-23-SF3` finding false. Final owner before closeout: `EPGCellPresentation.ts` for pure presentation helpers, `EPGCellRenderer.ts` for DOM/ticker lifecycle, and `EPGVirtualizer.ts` for virtualized-grid ownership. Revisit trigger: renderer tests or source audit prove duplicate presentation/text-layout/ticker/DOM-adapter residue not covered by FCP-10/FCP-13, including broad rewrite if that is the correct owner-seam fix.
- `FCP-23-SF4` maps exactly once to `FCP-23-S4`; planning disposition is no standalone organization in FCP-23 only if current source proves the exact `FCP-23-SF4` finding false or not naturally required by S3. Final owner for any later behavior-neutral EPG view organization is `FCP-24-SF4` unless S3 naturally requires a small organization change inside this wave. Revisit trigger: post-FCP-23 FCP-24 audit proves EPG view layout still blocks UI workflow or presentation reviewability, or S3 source audit proves organization is required inside FCP-23.
- No detector/imported/package-map/raw review id maps into FCP-23 coverage. Same-file Desloppify/rubric signals may be recorded as audit prompts/risk context, and closeout must state why any unresolved same-file signal is outside FCP-23 membership or owner seam rather than too large to fix.
- Replan is required before admitting any new `source_finding_id`, assigning one FCP-23 source finding to multiple final owners outside the approved wave accounting, or assigning `FCP-23-SF4` to foldering-only work.

`execution_waves`:

| wave_id | slice_ids | completion_condition | absorb_now_scope | replan_triggers |
| --- | --- | --- | --- | --- |
| `FCP-23-W1` | `FCP-23-S1`, `FCP-23-S2`, `FCP-23-S3`, `FCP-23-S4` | Every FCP-23 source finding has a source-backed final disposition; no-code/source-disproved findings prove the exact FCP source sentence false on current source; the channel setup screen concentration is resolved or accepted with one owner/revisit trigger; StrategyStep and EPG no-code audits remain true or the plan is refreshed; targeted tests, source audits, `npm run typecheck`, `git diff --check`, `npm run verify`, `npm run plans:check`, and docs verification as applicable pass; clean implementation review approves closeout before checklist updates. | Residue inside the same channel setup UI workflow/presenter owner split or same no-code StrategyStep/EPG proof owners, same files, same tests, same verification envelope, and same final-owner accounting. Same-file rubric/Desloppify signals are absorbable only as audit prompts; unresolved ones need an outside-FCP-membership or outside-owner-seam explanation. | Any stop condition in the seam gate; new persistence/Plex/scheduler/navigation/visual/Windows/package-foldering owner; wider verification surface; changed source-finding membership; FCP-10/FCP-11/FCP-13 baseline contradiction; current structural debt inside the FCP-23 owner seam that materially blocks port-readiness; inability to keep selected-server projection app-shell-owned; inability to keep EPG organization no-code without FCP-24-style movement. |

`coverage_ledger`:

| source_finding_id | execution_unit | planned disposition | final owner before closeout |
| --- | --- | --- | --- |
| `FCP-23-SF1` | `FCP-23-W1` / `FCP-23-S1` | Active implementation for channel setup portable workflow/presenter owner split. | Channel setup UI package-local workflow/presenter owner(s), with `ChannelSetupScreen` as shell/step-router and existing session/focus/dropdown/build owners retained. |
| `FCP-23-SF2` | `FCP-23-W1` / `FCP-23-S2` | Source-disproved/no-code only if current source proves the exact finding false; replan/admit if correct Step 2 shape requires a larger owner-seam rewrite. | `StrategyStepController` for render DOM; `StrategyStepInteractionController` for descriptors/interactions. |
| `FCP-23-SF3` | `FCP-23-W1` / `FCP-23-S3` | Source-disproved/no-code only if current source proves the exact finding false; replan/admit if correct EPG presentation shape requires a larger owner-seam rewrite. | `EPGCellPresentation.ts` for pure presentation helpers; `EPGCellRenderer.ts` for DOM/ticker lifecycle; `EPGVirtualizer.ts` for grid ownership. |
| `FCP-23-SF4` | `FCP-23-W1` / `FCP-23-S4` | No standalone organization in FCP-23 only if current source proves the exact finding false or not naturally required by S3; replan/admit if S3 requires organization for correct shape. | `FCP-24-SF4` for later behavior-neutral EPG organization unless S3 resolves a naturally required local move. |

- `ready_now_slice`: `FCP-23-S1`
- `ready_now_execution_unit`: `FCP-23-W1`
- `recommended_slice_order`:
  1. `FCP-23-S1`
  2. `FCP-23-S2`
  3. `FCP-23-S3`
  4. `FCP-23-S4`
- `parallel_execution_policy`: serial only. The package has one active UI implementation surface and three no-code/source-disproof audits whose final-owner accounting must be reviewed with the same package proof matrix. Parallel workers are not approved.

## Verification Commands

Verification strategy classification: `new regression/contract test required`.

Primary verification mode: `refactor-invariance`, supported by `contract-first` proof for the new or changed channel setup package-local workflow/presenter owner seam. Existing channel setup and EPG tests are strong, but the active S1 owner split needs direct public-seam or package-local collaborator coverage for any new owner API so behavior is not proven only through private screen internals. New tests are required only for the new/changed S1 collaborator contract; S2 through S4 are no-code audits unless fresh source contradicts this plan.

Plan validation:

1. `npm run plans:check`
   - Expected: active tracked plan structure passes, including FCP source-backed `source_finding_ids`, `coverage_check`, `ready_now_execution_unit`, execution wave, and coverage ledger.
2. `npm run verify:docs`
   - Expected: docs/control-plane verification passes for the active plan. Run again during package closeout if checklist/current-state/modules docs are updated.

Pre/post source audits for `FCP-23-W1`:

0. Same-file rubric signal handling:
   - Run: review any current Desloppify/rubric output already available to the worker for files listed in `## Files In Scope`, without importing raw detector ids into this plan or checklist coverage.
   - Expected: use those signals only to sharpen source reads and risk review. If a same-file signal points at structural debt in the FCP-23 owner seam that materially blocks port-readiness, stop and replan even when the fix would be broad. If a same-file signal remains unresolved, closeout must say whether it is outside FCP-23 membership or outside the approved owner seam, not that it was too large.
1. Channel setup screen responsibility audit:
   - Run: `rg -n "_createStrategyInteractionAdapters|_stepPreset|_getNearestOptionIndex|_openStep2Dropdown|_renderBuildStep|_getSelectedServerId|new ChannelSetup(SessionController|DropdownController|FocusCoordinator|BuildStepPresenter|StrategyStepController|StrategyStepInteractionController)" src/modules/ui/channel-setup/ChannelSetupScreen.ts`
   - Expected after S1: `ChannelSetupScreen` remains shell/step-router and may compose focused owners, but portable strategy/build/workflow adapter glue is no longer concentrated in the screen. If retained methods are source-justified shell glue, implementation output must say why the original `FCP-23-SF1` sentence is false.
2. Selected-server projection and storage audit:
   - Run: `rg -n "ServerSelectionStore|getSelectedServerStorageKey|getServerHealthStorageKey|localStorage|lineup_" src/modules/ui/channel-setup src/core/app-shell/deferred-screens/AppLazyScreenPortFactory.ts src/core/app-shell/runtime/AppShellRuntimeContracts.ts`
   - Expected: channel setup UI and app-shell screen ports expose runtime `getSelectedServerId` only; no selected-server storage owner, key getter, raw storage access, or persistence schema/key change appears in UI/app-shell screen ports.
3. Channel setup workflow-port audit:
   - Run: `rg -n "getSetupPlanDiagnostics|ChannelSetupWorkflowPort|ChannelSetupScreenWorkflowPort|createChannelSetupScreenWorkflowPort" src/modules/ui/channel-setup src/core/app-shell/deferred-screens/AppLazyScreenPortFactory.ts src/core/channel-setup/workflow`
   - Expected: UI consumes the screen-facing workflow port without planner diagnostics; full workflow diagnostics stay out of `ChannelSetupScreen` and package-local UI owners.
4. Strategy Step audit:
   - Run: `rg -n "STRATEGY_CONTROL_DESCRIPTORS|StrategyControlDescriptor|openAdjustableControl|_createAdjustableToggle|STEP2_CONTROL_IDS" src/modules/ui/channel-setup/steps/StrategyStepController.ts src/modules/ui/channel-setup/steps/StrategyStepInteractionController.ts`
   - Expected: descriptors/interactions remain in `StrategyStepInteractionController`; `StrategyStepController` remains render-focused and any retained repeated render calls are accepted explicit DOM assembly, not schema ambiguity.
5. EPG presentation audit:
   - Run: `rg -n "getProgramCellTextLayout|getCellTimeLabelPresentation|getProgressFillWidth|getEffectiveTickerClientWidth|measureReadyStateTickerOverflow|buildTickerTarget|prefersReducedMotion|focusedTickerTimer|syncFocusedTicker|EPGCellPresentation" src/modules/ui/epg/view/EPGCellPresentation.ts src/modules/ui/epg/view/EPGCellRenderer.ts src/modules/ui/epg/view/EPGVirtualizer.ts`
   - Expected: pure presentation helpers remain in `EPGCellPresentation.ts`; renderer remains DOM/ticker lifecycle adapter; reduced-motion and virtualizer interactions remain unchanged.
6. EPG package seam audit:
   - Run: `rg -n "EPGCellPresentation|EPGCellRenderer|from './view'|from './view/|export .*view" src/modules/ui/epg/index.ts src/modules/ui/epg/view/index.ts src/modules/ui/epg/component src/modules/ui/epg/view`
   - Expected: no cross-module EPG package seam widening, no public view/helper re-export from `src/modules/ui/epg/index.ts`, and no behavior-neutral foldering churn unless a refreshed plan admitted it.

Targeted tests for `FCP-23-W1`:

1. Run: `npm test -- ChannelSetupScreen ChannelSetupScreen.contracts ChannelSetupSessionController ChannelSetupSessionRuntime ChannelSetupDropdownController ChannelSetupFocusCoordinator StrategyStepController StrategyStepInteractionController ChannelSetupBuildStepPresenter BuildReviewStepController BuildProgressStepController AppLazyScreenPortFactory`
   - Expected: channel setup loading, focus cleanup, Step 2 navigation/dropdowns/preview, review/build/progress/cancel/success/error paths, selected-server projection, and app-shell screen port contracts remain stable.
2. Run: `npm test -- --runInBand src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts`
   - Expected: EPG renderer DOM, width tier, sliver, text metrics, focused episode/movie, live/progress, placeholder/reset, reduced-motion, and ticker behavior remain stable.
3. Run: `npm test -- --runInBand src/modules/ui/epg/view/__tests__/index.test.ts`
   - Expected: package-local view barrel remains stable if audited or touched.
4. Run broader EPG tests only if EPG source changes after a refreshed plan:
   - `npm test -- EPGComponent EPGVirtualizer EPGFocusNavigator`
   - Expected: EPG focus, virtualizer, ticker clearing, and guide behavior remain stable.

Package-level gates:

1. `npm run typecheck`
   - Expected: no TypeScript errors after any TypeScript changes.
2. `git diff --check`
   - Expected: no whitespace errors across the FCP-23 diff.
3. `npm run verify`
   - Expected: full UI/navigation/runtime verification passes before FCP-23 closeout because the package touches UI workflow behavior.
4. `npm run verify:docs`
   - Expected: required if checklist/current-state/modules/docs change during closeout.

Closeout source review must answer, for each `source_finding_id`, whether the original source finding sentence still describes current source. If yes, continue the wave or record accepted residue with one final owner and revisit trigger. If no, close with source proof. For `FCP-23-SF2`, `FCP-23-SF3`, and `FCP-23-SF4`, no-code/source-disproved closeout must explicitly say the exact FCP source finding is false on current source after audit. It must also state whether any same-file or same-area residual debt surfaced by source audit, Desloppify, or another rubric is accepted because it is outside FCP-23 membership or outside the approved owner seam, never because the rewrite would be too large.

## Rollback Notes

- Roll back by wave. `FCP-23-W1` is the only approved execution unit.
- If S1 behavior parity fails, revert the channel setup owner split while keeping any valid public-seam tests that exposed the gap. Do not patch around the failure by adding compatibility adapters or broadening public ports.
- If selected-server projection drifts into storage access, revert that change and replan with `persistence-boundaries`; do not introduce selected-server storage getters or schema changes in UI.
- If focus/dropdown/session/build behavior changes, revert the affected owner split and preserve any targeted tests that reveal missing coverage.
- If S2, S3, or S4 no-code audits are contradicted, do not force churn inside the existing plan. Refresh the plan with a concrete owner, files, tests, and final-owner accounting before production edits.
- If EPG presentation or view organization changes alter DOM/ticker/reduced-motion/virtualizer behavior, revert those EPG changes and replan against a narrower EPG view contract.

## Commit Checkpoints

- Implementation checkpoint: after `FCP-23-W1` source/test changes, targeted tests, source audits, `npm run typecheck`, `git diff --check`, `npm run verify`, and clean implementation review pass, create one focused non-interactive implementation commit for production/test changes. Exclude active tracked plan docs unless the controller explicitly commits plan progress separately.
- Closeout checkpoint: after clean implementation review and required verification, update `ARCHITECTURE_CLEANUP_CHECKLIST.md` and any current architecture docs in a separate orchestrator-owned closeout pass if implementation commits already exist.
- Do not mark `FCP-23` in progress or complete until the future controller observes closeout evidence and performs the checklist update in that same pass.
