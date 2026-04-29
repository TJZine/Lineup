# FCP-3 Focused Design Coherence Audit

## Purpose And Scope

This is the source-backed audit for `ARCHITECTURE_CLEANUP_CHECKLIST.md` item `FCP-3` Focused Design Coherence.

The audit covers current hotspots and recently changed coordination files for mixed responsibilities, unclear stage boundaries, unearned abstractions, repeated structural patterns, dense control flow, and domain-model obscurity. It uses current source, tests, architecture docs, Codanna where available, and deterministic `rg`/direct reads. It does not use Desloppify output, issue ids, package maps, score deltas, or triage as intake, proof, prioritization, or closure evidence.

## Audit Freshness And Update Rule

- Audit date: 2026-04-29.
- Source baseline: current workspace at planning time.
- Worktree hygiene observed with `git status --short`; unrelated dirty/untracked files were present and ignored for FCP-3 intake and package membership:
  - `M scorecard.png`
  - `?? docs/agentic/evals/baseline-summaries/2026-04-28-prompt-13-feature-low-implementer-policy.md`
  - `?? docs/plans/2026-04-28-ai-generated-debt-hygiene-sweep.md`
  - `?? docs/plans/2026-04-28-cross-module-architecture-audit-plan.md`
  - `?? docs/plans/2026-04-28-cross-module-architecture-cleanup-checklist.md`
  - `?? docs/plans/2026-04-28-design-coherence-audit-checklist.md`
  - `?? docs/plans/2026-04-28-design-coherence-audit-plan.md`
  - `?? docs/plans/2026-04-28-plex-stream-url-policy-capability-cleanup-plan.md`
- The untracked 2026-04-28 standalone design-coherence artifacts were read only to confirm they are not an active FCP-3 checklist-linked plan. They were not used as FCP-3 intake, proof, prioritization, or closure evidence because they are standalone remediation artifacts and include disallowed detector-derived evidence.
- Update this audit if implementation touches a design owner outside the selected package, if tests reveal a different focus/lifecycle contract, if plan review admits another FCP-3 source finding, or before FCP-3 closeout if more than one implementation session has passed.
- Future FCP-3 packages, if any are approved before closeout, must update this audit when planned and when closed. Execution plans may summarize this audit, but this file remains the durable coverage surface.

## Discovery Trail

Codanna was available through the local CLI; MCP Codanna tools were not exposed in this session.

- `/Users/tristan/.cargo/bin/codanna mcp get_index_info`
  - Index contained 11140 symbols across 696 files and 3148 relationships.
  - Semantic search was enabled with model `AllMiniLML6V2`, 14 embeddings, 384 dimensions, updated about 1 hour before audit.
- `/Users/tristan/.cargo/bin/codanna mcp --json semantic_search_with_context query:"FCP-3 focused design coherence hotspots mixed responsibilities dense control flow" limit:10`
  - Weak/noisy overall. Useful hits included `SettingsScreen._registerFocusables`, `SettingsScreen.show`, `NavigationFocusPolicy`, and unrelated low-signal symbols.
- `/Users/tristan/.cargo/bin/codanna mcp --json search_documents query:"FCP-3 focused design coherence" limit:10`
  - Returned relevant plan-standard and workflow hits. It emitted a Tantivy `LockBusy` auto-sync warning; returned docs were usable as orientation.
- `/Users/tristan/.cargo/bin/codanna mcp --json analyze_impact SettingsScreen`
  - Reported limited public impact through `AppLazyScreenRegistry.getSettingsScreen()` and `AppScreenVisibilityCoordinator.apply()/syncCurrentScreen()`.
- `/Users/tristan/.cargo/bin/codanna mcp --json search_symbols query:_registerFocusables limit:10`
  - Found matching screen-local focus registration methods, including `SettingsScreen._registerFocusables` at `src/modules/ui/settings/SettingsScreen.ts`.
- `/Users/tristan/.cargo/bin/codanna mcp --json analyze_impact _registerFocusables`
  - Reported the local `SettingsScreen` methods coupled to focus graph registration: constructor, `_buildUI`, `_createCategoryButton`, `_renderActiveCategory`, `_setActiveCategory`, `show`, and `_handleStateInvalidated`.

Deterministic fallback used `wc -l`, `rg`, and direct source reads for the current architecture hotspots and recently changed coordination files because Codanna semantic results were not proof-grade for repo-wide package membership.

Direct source/read targets included:

- `src/modules/ui/settings/SettingsScreen.ts`
- `src/modules/ui/settings/__tests__/SettingsScreen.test.ts`
- `src/modules/ui/settings/SettingsScreenStateController.ts`
- `src/modules/ui/epg/component/EPGComponent.ts`
- `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
- `src/modules/plex/stream/PlexStreamResolver.ts`
- `src/modules/scheduler/channel-manager/ChannelManager.ts`
- `src/core/orchestrator/AppOrchestrator.ts`
- `src/core/orchestrator/priority-one/PriorityOneAssemblyBuilder.ts`
- `src/core/orchestrator/priority-one/PriorityOneControllerFactory.ts`
- `src/core/channel-setup/planning/ChannelSetupStrategyBuilders.ts`
- `docs/architecture/CURRENT_STATE.md`
- `docs/architecture/modules.md`

## Audited Area Matrix

| Area | Source evidence | Disposition | source_finding_id | Owner | Closure or no-action rationale |
| --- | --- | --- | --- | --- | --- |
| Settings screen focus and remote-control orchestration | `SettingsScreen.ts` is 736 lines and currently owns DOM rendering, active-category state, deferred detail-swap animation frames, keypress routing, dropdown focus restoration, focusable graph construction, focus memory, and focus registry sync. The focus seam is concentrated in `_renderActiveCategory`, `_setActiveCategory`, `show`, `_handleStateInvalidated`, `_openDropdownForSelect`, `_registerFocusables`, `_unregisterFocusables`, `_isFocusableEnabled`, and `_getFocusableElement`. Codanna impact for `_registerFocusables` confirms the coupling is local to `SettingsScreen`. Existing tests in `SettingsScreen.test.ts` cover two-pane focus, deferred category swaps, hide cleanup, focus restoration, dropdown/select key handling, and re-open continuity. | Ready package | `FCP-3-SF1` | Settings UI focus owner | Extract the focus graph/key-routing/dropdown focus restoration concern behind a Settings-screen-local owner without changing rendering, settings state persistence, public constructor, or app-shell lazy-screen contracts. Closure is behavior-preserving source shape plus focused tests, not file-size reduction alone. |
| Settings persistence and settings-domain state shaping | `SettingsScreenStateController.ts` owns category/item state construction and settings callbacks; `SettingsScreen.ts` consumes it through `getCategories()` and invalidation callback. | Accepted/no-action | none | Settings state-controller owner | Current source already separates storage-backed state/category shaping from the screen. Do not move persistence or item config into the focus package. |
| EPG component | `EPGComponent.ts` is 1803 lines but already delegates to `EPGVirtualizer`, `EPGInfoPanelCoordinator`, `EPGTimeHeader`, `EPGChannelList`, `EPGErrorBoundary`, `EPGLibraryTabs`, debug runtime helpers, and visible-range emitter. Direct reads show remaining responsibilities are tightly coupled grid render/focus/time/visibility behavior. | Accepted/no-action for FCP-3 package | none | EPG component/view owners | Size and dense behavior alone are not enough. A future EPG package needs a narrower source finding with a closure condition around one grid/focus/time owner, not a broad split. Revisit if FCP-6 test audit finds focus/timing behavior is under-protected or if EPG view ownership changes. |
| Channel setup screen | `ChannelSetupScreen.ts` is 934 lines but current source shows step controllers, `ChannelSetupFocusCoordinator`, `ChannelSetupSessionController`, and `StrategyStepInteractionController` already own major seams. The screen still adapts step rendering and dropdown behavior, but no current-source closure condition beyond an arbitrary split was proven in this audit. | Accepted/no-action for FCP-3 package | none | Channel setup UI/screen owner | Existing collaborators make the stage boundaries explicit enough for this priority. Revisit if channel setup UI/session contracts change or if future source audit proves one remaining screen-local concern with stable tests. |
| Plex stream resolver | `PlexStreamResolver.ts` is 758 lines and contains stream resolution, URL building, subtitle debug probing, universal-decision fetch, auth failure mapping, and settings reads. Current source already delegates core decision policy to `resolveStreamPipeline`, compatibility policy, URL policy, subtitle probe, and platform identity. | Deferred outside FCP-3 selected package | none | Plex stream resolver owner | This is a plausible future focused package, but the audit did not prove a single small design-coherence closure condition with obvious tests. Revisit under Plex boundary planning if subtitle-debug probe orchestration or universal-decision fetch becomes production-risk, or under FCP-5 portability if platform assumptions are the driver. |
| ChannelManager | `ChannelManager.ts` is 1706 lines and recently changed for FCP-2. Current source now resolves create/update content before mutation for non-fallback failures while preserving graceful fallback. The file still owns CRUD, persistence queueing, import/export, cache cloning, and retry behavior. | Accepted/no-action for FCP-3 package | none | Scheduler/channel-manager owner | FCP-2 just corrected the runtime contract. A design split now would need a new source finding beyond size, and should not disturb the freshly verified failure semantics. Revisit if a later audit proves one cohesive retry/persistence/import owner with its own proof surface. |
| AppOrchestrator and priority-one assembly | `AppOrchestrator.ts` remains large, but FCP-1 moved priority-one assembly shaping into `PriorityOneAssemblyBuilder.ts`; direct reads show the builder now owns grouped priority-one input mapping and controller/binder construction. | Accepted/no-action | none | Core orchestrator plus priority-one assembly owners | Current architecture docs and FCP-1 closeout name this accepted seam. Do not reopen under FCP-3 without a new source-backed owner/closure condition. |
| Channel setup strategy builders | `ChannelSetupStrategyBuilders.ts` currently contains source-local descriptor/helper code for tag-backed families and explicit strategy-family builders. | Accepted/no-action | none | Channel setup planning owner | Current source already reflects a focused local-helper cleanup; no new FCP-3 package is admitted. Revisit only if planning/service ownership changes. |

## Ready Package Finding

### FCP-3-SF1: Settings Screen Focus Orchestration Coherence

`SettingsScreen` currently mixes view rendering with the full TV focus/remote-control orchestration seam:

- `_renderActiveCategory()` renders detail items, schedules deferred swap/reveal frames, tracks pending focus restoration, unregisters and re-registers focusables, and updates active category button state.
- `_setActiveCategory()` handles category state transitions, focus-only RIGHT navigation, pending deferred-swap focus intent, visible-state checks, focus target selection, and registry refresh.
- `show()` both reveals/rerenders the screen and installs an inline key handler for dropdown dismissal, category RIGHT navigation, select left/right cycling, and detail LEFT navigation.
- `_registerFocusables()` builds category/detail/profile neighbor graphs, defines per-entry `onFocus` and `onSelect` behavior, remembers per-category detail focus, syncs the navigation registry, and chooses the next focus target.
- `_openDropdownForSelect()` owns dropdown creation plus focus restoration around select changes.

This is a focused design-coherence issue because the screen class owns at least two durable responsibilities that already have stable behavior seams:

- render/category-detail composition
- D-pad focus graph, key routing, dropdown focus restoration, and focus memory

The closure condition is not "make `SettingsScreen.ts` smaller." Closure requires a Settings-screen-local focus owner that preserves the current focus/remote behavior while leaving rendering and settings state ownership in place.

#### Audit-First Package Brief

- `source_finding_id`: `FCP-3-SF1`
- `source findings`: `SettingsScreen.ts` mixes settings view composition with focus graph construction, remote key handling, dropdown focus restoration, deferred swap focus intent, and per-category focus memory. Codanna impact shows `_registerFocusables` is local to `SettingsScreen`, and existing `SettingsScreen.test.ts` covers the focus/lifecycle behavior needed for behavior-preserving extraction.
- `rubric linkage`: design coherence, mid-level elegance, low-level elegance, abstraction fitness, logic clarity, convention outlier, and naming quality.
- `owner seam`: settings UI owns the screen; a new `src/modules/ui/settings/SettingsScreenFocusCoordinator.ts` or equivalently named settings-local focus owner should own focus graph construction, key routing, focus memory, and registry sync. `SettingsScreen.ts` remains the DOM/rendering and category-detail composition owner. `SettingsScreenStateController.ts` remains the settings state/persistence facade owner.
- `files in scope`: `src/modules/ui/settings/SettingsScreen.ts`; new settings-local focus coordinator/model file(s) under `src/modules/ui/settings/`; `src/modules/ui/settings/__tests__/SettingsScreen.test.ts`; optional narrow new focus-coordinator unit test under `src/modules/ui/settings/__tests__/` only if a pure coordinator contract emerges.
- `files out of scope`: `src/modules/ui/settings/SettingsScreenStateController.ts` except read-only verification; `src/modules/ui/settings/SettingsStore.ts`; app-shell lazy-screen wiring; navigation manager internals; shared focus primitives except read-only verification; CSS/theme files; EPG, channel setup, Plex, scheduler, player, and Orchestrator source.
- `closure condition`: `SettingsScreen` no longer contains the full focus graph/key-handler/dropdown focus restoration implementation inline. A settings-local focus owner owns focusable entry creation, current/preferred focus selection, per-category detail focus memory, keypress handling policy, and registry sync. Public constructor/import behavior, rendered IDs/classes/ARIA semantics, dropdown behavior, deferred category-swap focus restoration, hide/destroy cleanup, and settings persistence remain unchanged. Existing focused tests pass and source audits show no new persistence, Plex, or concrete navigation-manager ownership drift; type-only `INavigationManager` usage remains permitted.
- `verification routing`: targeted `SettingsScreen` tests; targeted source audits for focus/key/dropdown ownership movement and forbidden owner coupling; `npm run verify` for UI/navigation source work; `npm run verify:docs` for audit/plan/checklist updates.
- `stop/replan triggers`: implementation needs to change `NavigationManager` or shared focus primitive contracts; implementation needs settings persistence/state-controller contract changes; focus behavior cannot be preserved through existing `SettingsScreen` tests without adding broader UI integration proof; the focus coordinator starts owning DOM rendering or settings storage; source work needs app-shell lazy-screen or visibility coordinator contract changes; implementation discovers another FCP-3 source finding with a different owner/proof surface.
- `security triage`: `no open P0 security findings` at planning time. This focus-refactor package must not change auth, token handling, Plex transport, storage schemas, network requests, authorization behavior, or security-sensitive persistence. Any discovered P0 finding requires replan with one final owner and revisit trigger.

## Proof Matrix

| source_finding_id | planned slice | current status | proof required before closeout | final owner | revisit trigger |
| --- | --- | --- | --- | --- | --- |
| `FCP-3-SF1` | `FCP-3-S1` | resolved by commit `22847d97` | `SettingsScreenFocusCoordinator.ts` now owns focus graph/key/dropdown restoration, focus memory, pending deferred focus restore, and registry sync; `SettingsScreen.ts` retains rendering, settings-state consumption, and screen lifecycle delegation. Controller-rerun targeted Settings tests passed (2 suites / 46 tests). Source audits show moved focus terms in the settings-local coordinator and only allowed type-only `INavigationManager` usage in focus files; no forbidden storage/Plex/network/app-shell/concrete navigation-manager ownership moved into the coordinator. Security triage remains `no open P0 security findings`. Worker-rerun `npm run verify` passed after implementation. Fresh implementation review found no findings and approved `FCP-3-S1` for closeout. Fresh FCP-3 priority-exit closeout review is pending. | Settings UI focus owner | Reopen only if future source changes move focus/dropdown/deferred-swap behavior back into `SettingsScreen`, if final FCP reconciliation proves a second live FCP-3 design finding outside this owner, or if any P0 security finding is discovered. |

## Deferred And Accepted Residuals

- EPG grid/render/focus density: accepted/no-action for FCP-3 closeout. Final owner: EPG component/view owners. Revisit trigger: FCP-6 test-confidence audit or an EPG-specific source audit proves one narrow focus/time/render owner with a behavior closure condition.
- Plex stream resolver density: deferred outside selected package, not admitted as an FCP-3 source finding. Final owner: Plex stream resolver owner. Revisit trigger: Plex boundary planning or FCP-5 portability audit proves one coherent subtitle-debug, universal-decision, URL, or platform-assumption package with its own proof surface.
- ChannelManager density after FCP-2: accepted/no-action. Final owner: scheduler/channel-manager owner. Revisit trigger: a future source audit proves one cohesive retry, persistence, import, or cache owner without disturbing FCP-2 failure semantics.
- Channel setup screen density: accepted/no-action. Final owner: channel setup UI/screen owner. Revisit trigger: channel setup UI/session ownership changes or a future source audit proves one remaining screen-local concern with stable tests.
- AppOrchestrator and priority-one assembly: accepted/no-action based on current FCP-1 source/docs state. Final owner: core orchestrator plus priority-one assembly owners. Revisit trigger: FCP final reconciliation finds ownership drift or priority-one assembly markers return to `AppOrchestrator`.
- Untracked standalone design-coherence artifacts from 2026-04-28: not FCP-3 intake. Final owner: user/controller. Revisit trigger: maintainer explicitly promotes any standalone item into checklist-linked FCP work with source-backed audit.

## Known Uncertainty And Tool Fallback

- Codanna CLI was available, but MCP Codanna tools were not exposed. The audit records CLI Codanna evidence and uses direct source reads as proof.
- Codanna semantic search was weak/noisy for broad FCP-3 classification. Direct reads are the authoritative basis for package membership and accepted/no-action decisions.
- Codanna document search emitted a `LockBusy` warning during auto-sync, but returned useful workflow/plan-standard context.
- This is source-backed, not a mechanically exhaustive proof over every production function. The strongest coverage is for current architecture hotspots, recently changed coordination files, and the selected Settings focus seam.

## FCP-3 Closeout Readiness

FCP-3 is closed after the fresh priority-exit closeout review accepted the
resolved `FCP-3-SF1` proof matrix and the accepted/no-action plus
deferred-outside-selected-package records above.

Closeout evidence:

- Focused source re-audit of `SettingsScreen.ts` and
  `SettingsScreenFocusCoordinator.ts` confirms the focus graph/key handler,
  dropdown focus restoration, per-category detail focus memory, pending
  deferred focus restore, and registry sync live in the settings-local
  coordinator while rendering and settings-state consumption stay in
  `SettingsScreen`.
- Source audit for forbidden ownership in focus files found only type-only
  `INavigationManager` usage. No `localStorage`, `sessionStorage`,
  `SettingsStore`, Plex/network, app-shell, concrete `NavigationManager`, auth,
  token, authorization, or security-sensitive persistence ownership moved into
  the coordinator.
- Security triage remains `no open P0 security findings`.
- Targeted controller-rerun Settings tests passed:
  `npm run test:unit -- src/modules/ui/settings/__tests__/SettingsScreen.test.ts
  src/modules/ui/settings/__tests__/SettingsScreenStateController.test.ts`
  (2 suites / 46 tests).
- Worker-rerun `npm run verify` passed after implementation commit `22847d97`.
  Controller-rerun final `npm run verify` passed after the completed plan, audit,
  and checklist closeout update.
- Fresh implementation review found no findings and approved `FCP-3-S1` for
  controller closeout.
- Fresh FCP-3 priority-exit closeout review found no findings and approved FCP-3
  completion after the controller records the clean review evidence.
