**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

# DCR-16 Production Source-Signal Residue Plan

## Goal

Retire `DCR-16-A1` / `S0-L10-F4` by removing or source-disproving generated-style, step-by-step, and trivial method comments that remain in production hot-path source after the code-signal cleanup was marked complete.

This is a behavior-neutral comment-only cleanup. The ready execution surface is intentionally small even though it crosses several hot-path ownership areas:

ready_now_execution_unit: `DCR-16-S1`

ready_now_slice: `DCR-16-S1`

No implementation may start until the worker confirms the freshness gate and this plan still reflects current source. If source audit proves additional same-pattern residue in the exact files in scope, the worker may absorb it into `DCR-16-S1`. If the cleanup needs code movement or a wider file set, stop and replan.

## Non-Goals

- Do not change runtime behavior, signatures, exports, APIs, imports, selectors, CSS semantics, runtime order, storage keys, test content, or public contracts.
- Do not perform production/test implementation in this planning pass.
- Do not update `ARCHITECTURE_CLEANUP_CHECKLIST.md` or the parent `DCR-EXIT` plan in this planning pass.
- Do not resume `DCR-EXIT-S2`, reconcile DCR package proof, or perform DCR-EXIT package proof reconciliation.
- Do not run or use Desloppify runtime, scans, queue/import output, review packets, score output, or the Desloppify skill.
- Do not remove comments that encode runtime invariants, platform quirks, security/token/logging constraints, accessibility/focus behavior, lifecycle cleanup guarantees, public contracts, or non-obvious browser/webOS behavior.
- Do not touch tests, tools, config, CSS, or docs except for verification and post-implementation closeout docs named below.

## Parent Priority Alignment

`DCR-16` is the final DCR follow-up package admitted by the DCR-EXIT S0 source audit. `ARCHITECTURE_CLEANUP_CHECKLIST.md` records it as the owner for `S0-L10-F4`, and the active DCR-EXIT plan blocks `DCR-EXIT-S2` until `DCR-16` closes or is explicitly maintainer-routed out of DCR.

Closeout must update only the `DCR-16` checklist mini-record, this plan status/evidence, and minimal DCR-EXIT blocker references needed to show the dependency is satisfied. It must not start, plan, or execute `DCR-EXIT-S2`.

## Required Reading

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/cleanup-loop.md`
4. `docs/agentic/plan-authoring-standard.md`
5. `docs/agentic/codanna-playbook.md`
6. `ARCHITECTURE_CLEANUP_CHECKLIST.md` section `DCR-16` plus the `DCR-EXIT` blocker lines
7. `docs/plans/2026-04-30-dcr-exit-final-dimension-audit-plan.md` only for DCR-16 routing/blocker context
8. Embedded S0-L10-F4 evidence in this plan. During plan authoring, the planner read the local DCR-EXIT S0 AI-generated-debt lane report and S0 synthesis artifacts named by the parent task. Fresh sessions should use the embedded snapshot unless rerouting requires rechecking the local run bundle.
9. `docs/architecture/CURRENT_STATE.md` sections for app-shell/orchestrator, navigation, scheduler/channel management, EPG/UI, Plex, settings/persistence owners, current hotspots, and working rules
10. `docs/api/plex-integration.md` only for Plex auth/library/stream preservation constraints
11. This plan

Freshness gate: before implementation, run `git status --short` and stop if any DCR-16 candidate source file, this plan, `ARCHITECTURE_CLEANUP_CHECKLIST.md`, `docs/architecture/CURRENT_STATE.md`, or `docs/plans/2026-04-30-dcr-exit-final-dimension-audit-plan.md` is dirty in a way that changes package meaning or overlaps comment cleanup. Treat the known untracked `docs/agentic/evals/baseline-summaries/2026-04-28-prompt-13-feature-low-implementer-policy.md` and `docs/plans/2026-04-28-*` drafts as protected unrelated user/session work.

## Required Skills

- `architecture-boundaries`
- `plex-integration-boundaries`
- `ui-composition-patterns`
- `persistence-boundaries`
- `verification-strategy`
- `execution-plan-authoring`
- `model-selection`
- `parallel-sidecars`

`plex-integration-boundaries` is required because `DCR-16-S1` now admits exact non-contract trivial comments in Plex auth/library/stream source. Plex edits remain comment-only and must preserve token handling, auth/session behavior, request/transport policy, stream error semantics, and public integration contracts.

`ui-composition-patterns` is required because the candidate list touches navigation, settings UI, and EPG view/focus surfaces. UI edits remain comment-only and must preserve focus behavior, timers/listeners, DOM structure, ARIA/status semantics, data hooks, selectors, visual behavior, and remote-control flow.

`persistence-boundaries` is required because the candidate list includes scheduler/channel persistence-sensitive code, settings UI state consumers, lifecycle/error-recovery neighbors, bootstrap debug migration context, and Plex auth storage owners. Edits must not alter storage keys, schemas, storage owner boundaries, raw storage access, migration behavior, or persistence warning semantics.

`parallel-sidecars` is conceptual for this package. Do not delegate implementation in parallel because the approved execution unit is one cross-file comment sweep with one behavior-neutral diff audit. Read-only sidecars are allowed only for focused review or a blocking source-audit question.

## Codanna Discovery

Planning discovery used Codanna first, then deterministic `rg`/direct reads for exact comment proof.

- `get_index_info`: 12,023 symbols across 779 files, semantic search enabled, index updated 7 minutes before planning.
- `search_documents`: `DCR-16 Production Source-Signal Residue S0-L10-F4` found `CURRENT_STATE.md`, the active DCR-EXIT plan, and related completed DCR package plans. It confirmed DCR-16 is the remaining DCR-EXIT blocker.
- `search_documents`: `DCR-EXIT DCR-16 blocker S0-L10-F4` found the active DCR-EXIT blocker lines and DCR-15 closeout context showing `DCR-EXIT-S2` is blocked on `DCR-16` only.
- `semantic_search_with_context`: `production source generated-style step comments trivial comments app shell orchestrator channel setup plex subtitle settings` found representative hot-path symbols including `src/App.ts` `_buildConfig`, `ChannelManager`, and settings/subtitle surfaces. This was useful for ownership context but insufficient for exact comment classification.
- `analyze_impact`: not required for this plan because approved implementation is comments-only and must not change symbols, types, call paths, imports, exports, selectors, or runtime order. If implementation needs any token/signature/API/import/export change, stop before editing and run impact analysis for the affected symbol in a revised plan.
- Fallback: `rg` and direct `nl`/`sed` reads were required for exact S0 artifact lines and current-source comment matches. Fallback reads covered the checklist DCR-16/DCR-EXIT entries, active DCR-EXIT plan routing rows, S0-L10 lane report, S0 synthesis, `CURRENT_STATE.md`, and the source-family files summarized below.

No Desloppify command, skill, score, queue/import output, or review packet was used.

## Impact Snapshot

S0-L10 evidence snapshot:

- The local DCR-EXIT S0 AI-generated-debt lane report records `S0-L10-F4` as: production hot-path files still carry generated-style step and trivial method comments after code-signal cleanup was marked complete.
- The lane report routes `S0-L10-F4` to a split final DCR package owned by `DCR-FINAL-COMMENT-RESIDUE`, the AI-generated residue/code-signal owner with app-shell/scheduler/navigation/UI reviewers.
- The S0 synthesis records the same finding as low-severity AI-generated debt, with required verification: behavior-neutral diff audit, `git diff --check`, targeted source search, and typecheck/tests only if signatures/code move.
- The active DCR-EXIT plan maps `DCR-16` to `S0-L10-F4` and blocks `DCR-EXIT-S2` until DCR-16 closes or is maintainer-routed.

Current source audit across S0-L10 source families:

| Source family | Current-source audit | DCR-16 disposition |
| --- | --- | --- |
| App/bootstrap/app-shell/orchestrator/initialization/error-recovery | `rg` found live step narration and trivial JSDoc in `src/App.ts`, `src/bootstrap.ts`, `src/core/initialization/InitializationCoordinator.ts`, `src/core/orchestrator/AppOrchestrator.ts`, and `src/modules/lifecycle/ErrorRecovery.ts`. | In scope for `DCR-16-S1`, comments only. |
| Scheduler/channel/channel-setup | `rg` found live trivial JSDoc and step comments in `src/modules/scheduler/channel-manager/ChannelManager.ts` and `src/modules/scheduler/channel-manager/ContentResolver.ts`. Public interface/type docs in scheduler files describe channel-domain API, storage-boundary, source/build strategy, or persisted shape contracts. | `ChannelManager.ts` and `ContentResolver.ts` are in scope; scheduler interface/type docs are source-disproved retained contract commentary. |
| EPG/settings/UI/navigation/styles | `rg` found live residue in `src/modules/navigation/NavigationManager.ts`, `src/modules/ui/settings/SettingsScreen.ts`, `src/modules/ui/server-select/ServerSelectScreen.ts`, `src/modules/ui/epg/component/EPGComponent.ts`, `src/modules/ui/epg/view/EPGVirtualizer.ts`, `src/modules/ui/epg/view/EPGInfoPanel.ts`, `src/modules/ui/epg/view/EPGChannelList.ts`, and `src/modules/ui/epg/view/EPGErrorBoundary.ts`. Style surfaces were audited through S0 context; DCR-11 already owned `S0-L10-F2` CSS token wording, and no CSS runtime declarations are in DCR-16 scope. | Listed TS files are in scope; CSS/style changes are out of scope. `RemoteHandler.ts`, `LibraryStepController.ts`, and UI type files are source-disproved retained webOS/input, no-DOM-rebuild, or type-contract commentary. |
| Plex/server-selection/auth | Follow-up source review found exact non-contract trivial comments in `src/modules/plex/auth/PlexAuth.ts`, `src/modules/plex/library/PlexLibrary.ts`, `src/modules/plex/stream/PlexStreamResolver.ts`, and `src/modules/plex/stream/streamMimeType.ts`: simple auth accessors, library getter banners, URL/helper banners, and stream MIME helper comments. Other Plex matches describe auth/token, transport, mixed-content, request, stream, debug, pagination, or public API contracts. | The four Plex files are in scope for exact comment-only cleanup of non-contract residue; Plex interfaces, auth transport, discovery, and server-selection persistence remain source-disproved retained contract/security/transport commentary unless implementation proves a same-file obvious residue match within the approved files. |
| Player/runtime/subtitle | Current matches in `AudioTrackManager.ts`, `VideoPlayerEvents.ts`, `SubtitleManager.ts`, `RetryManager.ts`, and `ErrorHandler.ts` describe codec/native-track checks, buffering state, subtitle burn-in, WebVTT/jsdom, retry caps, exponential backoff, and debug/lifecycle constraints. | Out of scope; source-disproved retained runtime/platform commentary. |
| Settings/debug/config/storage | Current matches in lifecycle/storage/settings/debug owners describe storage schema, migration, cleanup semantics, facade boundaries, debug stores, or failure guarantees. | Out of scope; source-disproved retained persistence/debug ownership commentary. |
| Shared/types/utils/platform | Current matches in type/interface/platform files are public contracts, security/platform notes, schema docs, or webOS/browser compatibility notes. | Out of scope; source-disproved retained contract/platform commentary. |

Source-backed evidence table for `DCR-16-S1`:

| Candidate file/path | Current-source match | Why DCR-16 residue | Planned disposition | Verification | Stop/replan trigger |
| --- | --- | --- | --- | --- | --- |
| `src/App.ts` | Startup comments such as `Create root containers`, `Build configuration`, `Create and initialize orchestrator`, `Start the orchestrator`; trivial `_buildConfig`/overlay/fatal-error comments. | Step-by-step narration restates adjacent calls in the app-shell composition root and adds noise to startup flow. | Remove generated-style step comments and redundant method comments; keep any non-obvious lifecycle or recovery note. | Targeted pre/post `rg` for app-shell step comments; diff must show comment-only removal. | Stop if startup ordering, container creation, orchestrator wiring, overlay behavior, or public method signatures change. |
| `src/bootstrap.ts` | `Start when DOM is ready` near `document.readyState`. | Restates the DOM-ready branch. | Remove only trivial narration; retain `pagehide` and uninstall comments because they encode lifecycle/test/debug harness constraints. | Targeted bootstrap comment search and behavior-neutral diff. | Stop if bootstrap install/uninstall order or event registration changes. |
| `src/core/initialization/InitializationCoordinator.ts` | `Initialize Lifecycle and Navigation in parallel`. | Restates the promise setup immediately below. | Remove if still redundant in current code; keep any comment that preserves startup sequencing invariants. | Targeted initialization comment search. | Stop if startup phase ordering or module status behavior changes. |
| `src/core/orchestrator/AppOrchestrator.ts` | Trivial JSDoc for `initialize`, `start`, `getModuleStatus`, `isReady`, `getCurrentScreen`, `getNavigation`, `switchToChannel`, global error handling, recovery actions, and MIME helper. | Mostly restates method names or visible bodies in a hot orchestrator facade. | Remove only trivial/generated-style method comments; retain singleton lifecycle, precondition, shutdown ordering, diagnostic, error-routing, and public contract notes. | Targeted orchestrator comment search; diff audit must show no code-token movement. | Stop if public runtime facade, module status, channel switch, global error, or MIME logic changes. |
| `src/modules/lifecycle/ErrorRecovery.ts` | Trivial comments for `handleError`, `createError`, and `getUserMessage`. | Restates method names in a small error-recovery owner. | Remove trivial JSDoc only; retain any taxonomy or user-message mapping constraints if encountered. | Targeted error-recovery comment search. | Stop if error taxonomy, recoverability, or user-facing message behavior changes. |
| `src/modules/navigation/NavigationManager.ts` | Step comments like `Subscribe to remote events`, `Set up pointer mode`, `Save focus state`, `Push current screen`, `Set new screen`, `Emit screen change event`, `Check if we have history`, plus trivial handler JSDoc. | Narrates direct operations in a navigation hotspot and competes with the useful focus/webOS comments already present. | Remove trivial step comments and redundant method comments; retain focus desync repair, root Back behavior, webOS Home behavior, focus restore, and pointer-mode/browser behavior notes. | Navigation-targeted comment search and diff audit. | Stop if focus behavior, screen stack order, modal close semantics, input-block checks, event emission, or webOS Back behavior changes. |
| `src/modules/scheduler/channel-manager/ChannelManager.ts` | Trivial comments for constructor, create/update/delete/get methods, `Check max channels`, `Add optional properties`, `Apply updates`, `Persist and emit event`, and simple channel getters. | Restates obvious state operations in the scheduler channel API owner. | Remove redundant method/step comments; retain persistence-boundary, cache fallback, stale-content, retry-timer, storage-key, schema, and warning-policy comments. | Scheduler-targeted comment search and behavior-neutral diff. | Stop if channel persistence schema, event order, channel numbering, save queue, import normalization, or public API behavior changes. |
| `src/modules/scheduler/channel-manager/ContentResolver.ts` | `Create a ContentResolver instance` and `Build resolved item from cached manual metadata`; the finite-number comparison comment is retained. | Constructor and build-step comments restate adjacent code, while the finite comparison note protects non-obvious filter behavior. | Remove constructor/build narration only; retain cache, stale fallback, manual metadata, filter validation, and finite-number semantics where they explain behavior. | Scheduler/content-resolver comment search and behavior-neutral diff. | Stop if content resolution, cache fallback, filter comparison, manual content typing, or logger behavior changes. |
| `src/modules/ui/settings/SettingsScreen.ts` | Duplicate file/class comments, `Build the settings UI`, `Header`, `Show`, `Hide`, and `Destroy` comments. | Restates UI component names and obvious DOM assembly. | Remove duplicate/trivial comments; retain focus-only path and deferred-detail/focus restore comments. | Settings-targeted comment search and diff audit. | Stop if visible UI text, focus registration, category rendering, animation frame cleanup, or settings store calls change. |
| `src/modules/ui/server-select/ServerSelectScreen.ts` | `Add health pill` inside server row DOM assembly. | Restates the immediate DOM creation and does not encode server-selection, auth, focus, or health semantics. | Remove the trivial DOM step comment only; retain health-status, selection dispatch, focus, auth, and persistence-boundary commentary. | Server-select targeted comment search and behavior-neutral diff. | Stop if server row DOM structure, visible text, focus behavior, health status semantics, selection flow, or server persistence/auth behavior changes. |
| `src/modules/ui/epg/component/EPGComponent.ts` | Duplicate file/class comments plus trivial comments for error-boundary init, DOM creation, show/hide/toggle, load/clear schedules, simple focus/scroll/handler wrappers, and state getter. | Restates methods in an EPG facade after DCR-14 moved rendering/focus/grid runtime to owners. | Remove redundant generated-style comments; retain TV performance, debug, blank-guide prevention, timer visibility, focus preservation, current-program, and accessibility/runtime invariant notes. | EPG component comment search and diff audit. | Stop if rendering order, focus/navigation, timers/listeners, debug payloads, layout classes, or public `IEPGComponent` API changes. |
| `src/modules/ui/epg/view/EPGVirtualizer.ts` | Trivial comments for setter/getters, pool operations, render cell, and position update, mixed with useful virtualization notes. | Some comments narrate direct DOM pool actions already obvious from names. | Remove only redundant step/method comments; retain ADR rationale, deterministic positioning, buffer math, DOM recycling constraints, pool bound behavior, testing seam notes that explain public proof. | EPG virtualizer comment search and diff audit. | Stop if DOM pool behavior, render ordering, focus preservation, time scrolling, or test seams change. |
| `src/modules/ui/epg/view/EPGInfoPanel.ts` | Trivial comments for init/template/update/get/showing helpers. | Restates method names in a view file with many direct DOM operations. | Remove redundant method comments; retain comments for rating/quality badge slot count, poster failure, semantic vs visual pills, ARIA/screen-reader behavior, and dynamic background behavior. | EPG info-panel comment search and diff audit. | Stop if DOM structure, badge semantics, dynamic background, screen-reader text, poster handling, or focus/display behavior changes. |
| `src/modules/ui/epg/view/EPGChannelList.ts` | Trivial comments for init/update/render/create row/getters. | Restates method names and direct DOM row operations. | Remove redundant comments; retain virtualization, row recycling, CSS injection validation, category color, and focus synchronization notes. | EPG channel-list comment search and diff audit. | Stop if row virtualization, category color validation, focus state, or scroll transform behavior changes. |
| `src/modules/ui/epg/view/EPGErrorBoundary.ts` | Trivial accessor comments for `getErrorCount()` and `isDegraded()` plus some generated-style recovery-action narration. | Accessor comments and obvious action labels restate adjacent code. Class-level graceful-degradation, token-redaction, degraded-mode, and operation-wrapper behavior are useful runtime contracts. | Remove trivial accessor/step comments; retain event contract, graceful degradation, redaction/logging, recovery strategy, and degradation threshold commentary. | EPG error-boundary comment search and behavior-neutral diff. | Stop if redaction, emitted events, error counts, degradation threshold, recovery callbacks, or operation wrapping behavior changes. |
| `src/modules/plex/auth/PlexAuth.ts` | `/** Check if currently authenticated. */` and `/** Get current user token. */`. | These comments restate the adjacent accessor names and do not encode token logging, storage, auth/session, or public integration constraints. | Remove only these trivial accessor comments unless the worker finds same-file generated-style comments with the same non-contract shape. Retain PIN flow, token storage, storage failure, credential lifecycle, and header/auth contract comments. | Plex/auth-targeted comment search plus bounded all-family audit; diff must be comment-only. | Stop if auth/session behavior, token handling, credential storage, event emission, or header generation changes. |
| `src/modules/plex/library/PlexLibrary.ts` | `Get all libraries` above `getLibraries()`. | The comment restates the public method name; detailed behavior is already represented by typed options and implementation. | Remove the trivial method comment. Retain pagination, auth-expiry, 403 permission, rate-limit, 404, 500 retry, timeout/abort, cache, and public API behavior comments. | Plex/library-targeted comment search plus bounded all-family audit; diff must be comment-only. | Stop if request/transport behavior, cache policy, auth-expiry emission, parser behavior, pagination, or public library API changes. |
| `src/modules/plex/stream/PlexStreamResolver.ts` | `Create a StreamResolverError`. | The comment restates the private helper name and is not an error-boundary or token/logging invariant. | Remove the trivial helper comment. Retain direct-play, mixed-content, token URL, auth/debug, subtitle, transcode, and stream error contract comments. | Plex/stream-targeted comment search plus bounded all-family audit; diff must be comment-only. | Stop if stream URL building, token handling, mixed-content fallback, resolver error emission, subtitle policy, or public stream API changes. |
| `src/modules/plex/stream/streamMimeType.ts` | `Get MIME type for a stream protocol`. | Restates the exported helper name and does not encode stream policy or fallback behavior beyond the code itself. | Remove the trivial helper comment only; retain MIME/fallback behavior in code unchanged. | Plex/stream targeted comment search plus bounded all-family audit; diff must be comment-only. | Stop if MIME constants, fallback value, protocol union, or stream policy changes. |

Classification rules for implementation:

- Remove only generated-style comments, step-by-step narration, comments that restate obvious code, duplicate file/class banners, stale cleanup/process residue, and trivial method comments that add no contract.
- Retain runtime invariants, platform quirks, security/token/logging constraints, accessibility/focus behavior, lifecycle cleanup guarantees, public contracts, non-obvious browser/webOS behavior, performance rationale, and comments required to prevent future unsafe changes.
- Prefer deletion over rewriting. Rewrite only when an important invariant is present but buried inside generated-style wording.
- Never use comment cleanup as a reason to move code, rename helpers, change visibility, or edit tests.

## Package Decomposition

- `package_id`: `DCR-16`
- `checklist_token`: `DCR-16`
- `ready_now_execution_unit`: `DCR-16-S1`
- `ready_now_slice`: `DCR-16-S1`
- `parallel_execution_policy`: serial only. The package is a single behavior-neutral comment cleanup slice across related hot-path source files. Parallel edits would make the no-code-token diff audit harder to trust.
- `package_issue_ids`:
  - `DCR-16-A1`
  - `S0-L10-F4`

`slice_table`:

| slice_id | goal | areas/files | exact_issue_ids | verification | dependencies | stop_condition | handoff_condition | parallel policy |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DCR-16-S1` | Remove or source-disprove generated-style/trivial comments in current S0-L10 hot-path production source without changing behavior. | `src/App.ts`, `src/bootstrap.ts`, `src/core/initialization/InitializationCoordinator.ts`, `src/core/orchestrator/AppOrchestrator.ts`, `src/modules/lifecycle/ErrorRecovery.ts`, `src/modules/navigation/NavigationManager.ts`, `src/modules/scheduler/channel-manager/ChannelManager.ts`, `src/modules/scheduler/channel-manager/ContentResolver.ts`, `src/modules/ui/settings/SettingsScreen.ts`, `src/modules/ui/server-select/ServerSelectScreen.ts`, `src/modules/ui/epg/component/EPGComponent.ts`, `src/modules/ui/epg/view/EPGVirtualizer.ts`, `src/modules/ui/epg/view/EPGInfoPanel.ts`, `src/modules/ui/epg/view/EPGChannelList.ts`, `src/modules/ui/epg/view/EPGErrorBoundary.ts`, `src/modules/plex/auth/PlexAuth.ts`, `src/modules/plex/library/PlexLibrary.ts`, `src/modules/plex/stream/PlexStreamResolver.ts`, `src/modules/plex/stream/streamMimeType.ts`. | `DCR-16-A1`, `S0-L10-F4` | Targeted pre/post source search, bounded all-family source audit, behavior-neutral diff audit, `git diff --check`, `npm run plans:check`, `npm run verify:docs`; typecheck/targeted tests only if code tokens move. | `DCR-11` through `DCR-15` are complete and no candidate files are dirty with overlapping comment cleanup. | Stop if any code movement, token/signature/import/export/order/CSS/test change is needed; if bounded audit finds obvious same-pattern production residue outside the approved file list that cannot be source-disproved as contract/platform/security/runtime commentary; if a comment encodes an invariant and cannot be safely classified; or if an approved file is actively changing. | Diff contains only comment removals or narrowed invariant-preserving comment rewrites in approved files; post-search and bounded all-family audit show the S0-L10-F4 residue class retired or each survivor is documented as retained contract commentary. | `serial_only`; one cleanup worker, one review surface. |

`coverage_check`:

- `DCR-16-A1` maps only to `DCR-16-S1`.
- `S0-L10-F4` maps only to `DCR-16-S1`.
- No issue id is deferred or split. Replan is required before admitting any new package issue id or source family.

`recommended_slice_order`:

1. `DCR-16-S1`
2. Package closeout docs only after implementation and review are clean

No `execution_waves` or `coverage_ledger` are used because the approved execution unit is a single slice.

## Files In Scope

Production files in scope for comment-only edits:

- `src/App.ts`
- `src/bootstrap.ts`
- `src/core/initialization/InitializationCoordinator.ts`
- `src/core/orchestrator/AppOrchestrator.ts`
- `src/modules/lifecycle/ErrorRecovery.ts`
- `src/modules/navigation/NavigationManager.ts`
- `src/modules/scheduler/channel-manager/ChannelManager.ts`
- `src/modules/scheduler/channel-manager/ContentResolver.ts`
- `src/modules/ui/settings/SettingsScreen.ts`
- `src/modules/ui/server-select/ServerSelectScreen.ts`
- `src/modules/ui/epg/component/EPGComponent.ts`
- `src/modules/ui/epg/view/EPGVirtualizer.ts`
- `src/modules/ui/epg/view/EPGInfoPanel.ts`
- `src/modules/ui/epg/view/EPGChannelList.ts`
- `src/modules/ui/epg/view/EPGErrorBoundary.ts`
- `src/modules/plex/auth/PlexAuth.ts`
- `src/modules/plex/library/PlexLibrary.ts`
- `src/modules/plex/stream/PlexStreamResolver.ts`
- `src/modules/plex/stream/streamMimeType.ts`

Closeout docs in scope only after implementation/review is clean:

- `ARCHITECTURE_CLEANUP_CHECKLIST.md`
- this plan
- `docs/plans/2026-04-30-dcr-exit-final-dimension-audit-plan.md` only for minimal blocker-reference updates showing DCR-16 dependency is satisfied
- `docs/architecture/CURRENT_STATE.md` only if closeout needs to record a source-disproved current-state ownership note; this plan does not expect ownership changes

## Files Out Of Scope

Exact production files audited but out of implementation scope for this package:

- `src/modules/navigation/RemoteHandler.ts`
- `src/modules/navigation/interfaces.ts`
- `src/modules/player/AudioTrackManager.ts`
- `src/modules/player/VideoPlayerEvents.ts`
- `src/modules/player/SubtitleManager.ts`
- `src/modules/player/RetryManager.ts`
- `src/modules/player/ErrorHandler.ts`
- `src/modules/lifecycle/StateManager.ts`
- `src/modules/lifecycle/constants.ts`
- `src/utils/storage.ts`
- `src/modules/scheduler/channel-manager/interfaces.ts`
- `src/modules/scheduler/channel-manager/types.ts`
- `src/modules/ui/channel-setup/steps/LibraryStepController.ts`
- `src/modules/plex/library/interfaces.ts`
- `src/modules/plex/stream/interfaces.ts`
- `src/modules/plex/auth/interfaces.ts`
- `src/modules/plex/auth/plexAuthTransport.ts`
- `src/modules/ui/epg/types.ts`
- `src/modules/ui/settings/types.ts`
- `src/platform/services.ts`
- `src/platform/webosPlatformServices.ts`
- `src/styles/tokens.css`
- `stylelint.config.cjs`

Source-disproved survivor categories from the bounded all-family audit:

- Interface/type files (`navigation/interfaces.ts`, scheduler channel interfaces/types, Plex library/stream/auth interfaces, EPG/settings types) are retained as public contract and data-shape commentary. They are not implementation residue unless the worker finds a non-contract comment in an admitted implementation file.
- Platform/security/transport helpers (`plexAuthTransport.ts`, `utils/storage.ts`, platform services, storage/lifecycle constants) are retained because their comments describe token/request headers, HTTP error mapping, storage removal guarantees, migration/schema boundaries, or platform behavior.
- Player/subtitle/runtime files (`AudioTrackManager.ts`, `VideoPlayerEvents.ts`, `SubtitleManager.ts`, `RetryManager.ts`, `ErrorHandler.ts`) are retained because the matches describe codec/native-track checks, buffering state, subtitle fetch/burn-in/WebVTT/jsdom behavior, retry caps, and backoff timing.
- Navigation/input and channel-setup survivors (`RemoteHandler.ts`, `LibraryStepController.ts`) are retained because they describe webOS raw keyboard input or the no-DOM-rebuild update invariant.
- CSS/config survivors (`src/styles/tokens.css`, `stylelint.config.cjs`) remain out of DCR-16 because DCR-11 already owned `S0-L10-F2`/`S0-L10-F3`; DCR-16 does not change CSS declarations or tooling policy.

Other out-of-scope surfaces:

- All test files, fixtures, tools, scripts, generated output, package metadata, and config files except verification commands.
- Any source file not listed in `Files In Scope`.
- CSS runtime declarations, selectors, class names, UI text, DOM structure, focus maps, navigation behavior, Plex auth/session logic, player/subtitle runtime behavior, persistence schemas, storage keys, and public API contracts.
- Desloppify artifacts and any new scoring-only evidence.

## Planner Self-Check

1. Unresolved architecture seam? No. The seam is comment-only source-signal cleanup in exact files; no ownership or contract move is approved.
2. Adjacent contract/type changes hidden out of scope? No. Any token/signature/import/export/API/order/CSS/test change is a stop/replan trigger.
3. Out-of-scope files still implicitly required? No. Follow-up review admitted the exact non-contract Plex, server-select, EPG error-boundary, and ContentResolver matches into `DCR-16-S1`; remaining out-of-scope audit matches are classified above as retained contract/platform/security/runtime/lifecycle/focus/persistence commentary or trigger stop/replan.
4. Codanna evidence path recorded? Yes, with Codanna document/code searches plus explicit `rg` fallback for exact comment proof.
5. Repo-preferred owner? Yes. The package owner is code-signal cleanup, with app-shell/scheduler/navigation/UI reviewers; no hotspot gains responsibility.
6. Fresh-session invention required? No. The plan defines files, classification rules, verification, closeout policy, and stop triggers.
7. Execution-grade? Yes. It freezes the behavior-neutral edit surface without prescribing a patch or local helper choices.

## Architecture Seam Decision Gate

The approved seam is comment deletion or, only when necessary, a narrower invariant-preserving comment rewrite inside the exact files in scope.

Behavior-neutral edit strategy:

- Comments only.
- No code movement.
- No token, signature, import, export, selector, CSS runtime declaration, test, API, or runtime-order edits.
- No formatter-only rewrites outside touched comment blocks.

Stop and replan if:

- A comment cannot be classified using the rules above.
- A needed edit would alter code tokens or runtime behavior.
- The bounded all-family audit shows obvious same-pattern production residue outside `Files In Scope` that cannot be source-disproved as contract, platform, security/token/logging, lifecycle, focus/accessibility, public API, or runtime invariant commentary.
- A file in scope is dirty with overlapping comment cleanup or package-meaning changes.
- Verification reveals non-comment diff, whitespace damage in code, doc-validator failure requiring policy changes, or any test/typecheck need not covered by this plan.

## Verification Commands

Primary verification mode: `refactor-invariance`.

Plan classification: `no new automated test needed`.

Why: the approved implementation surface is comment-only and must not change behavior, public contracts, selectors, CSS, runtime order, imports/exports, or tests. Automated behavior tests would not add signal unless the worker violates the plan and moves code tokens.

Pre-implementation source search:

```sh
rg -n "^\\s*(//|/\\*\\*|\\*)\\s*(Step|First|Next|Then|Finally|Initialize|Initializes|Create|Creates|Build|Builds|Set up|Setup|Handle|Handles|Get|Gets|Start|Starts|Stop|Stops|Clean up|Cleanup|Update|Updates|Load|Loads|Save|Saves|Render|Renders|Process|Processes|Validate|Validates|Calculate|Calculates|Add|Adds|Remove|Removes|Check|Checks|Convert|Converts|Configure|Configures|Bind|Binds)\\b" src/App.ts src/bootstrap.ts src/core/initialization/InitializationCoordinator.ts src/core/orchestrator/AppOrchestrator.ts src/modules/lifecycle/ErrorRecovery.ts src/modules/navigation/NavigationManager.ts src/modules/scheduler/channel-manager/ChannelManager.ts src/modules/scheduler/channel-manager/ContentResolver.ts src/modules/ui/settings/SettingsScreen.ts src/modules/ui/server-select/ServerSelectScreen.ts src/modules/ui/epg/component/EPGComponent.ts src/modules/ui/epg/view/EPGVirtualizer.ts src/modules/ui/epg/view/EPGInfoPanel.ts src/modules/ui/epg/view/EPGChannelList.ts src/modules/ui/epg/view/EPGErrorBoundary.ts src/modules/plex/auth/PlexAuth.ts src/modules/plex/library/PlexLibrary.ts src/modules/plex/stream/PlexStreamResolver.ts src/modules/plex/stream/streamMimeType.ts
```

Bounded all-family audit proof:

```sh
rg -n --glob '!**/__tests__/**' --glob '!**/*.test.ts' --glob '!**/*.test.tsx' "^\\s*(//|/\\*\\*|\\*)\\s*(Step|First|Next|Then|Finally|Initialize|Initializes|Create|Creates|Build|Builds|Set up|Setup|Handle|Handles|Get|Gets|Start|Starts|Stop|Stops|Clean up|Cleanup|Update|Updates|Load|Loads|Save|Saves|Render|Renders|Process|Processes|Validate|Validates|Calculate|Calculates|Add|Adds|Remove|Removes|Check|Checks|Convert|Converts|Configure|Configures|Bind|Binds)\\b" src/App.ts src/bootstrap.ts src/core/app-shell src/core/orchestrator src/core/initialization src/modules/lifecycle src/modules/scheduler src/core/channel-setup src/modules/ui src/modules/navigation src/modules/plex src/modules/player src/modules/settings src/modules/debug src/types src/utils src/platform
```

The worker must include a compact disposition note for this bounded audit in the implementation or closeout handoff: all in-scope obvious residue removed, all remaining matches source-disproved as retained contract/platform/security/runtime/focus/lifecycle/public API commentary, or stop/replan if any obvious same-pattern production residue remains outside the approved files.

Post-implementation verification:

```sh
git diff -- src/App.ts src/bootstrap.ts src/core/initialization/InitializationCoordinator.ts src/core/orchestrator/AppOrchestrator.ts src/modules/lifecycle/ErrorRecovery.ts src/modules/navigation/NavigationManager.ts src/modules/scheduler/channel-manager/ChannelManager.ts src/modules/scheduler/channel-manager/ContentResolver.ts src/modules/ui/settings/SettingsScreen.ts src/modules/ui/server-select/ServerSelectScreen.ts src/modules/ui/epg/component/EPGComponent.ts src/modules/ui/epg/view/EPGVirtualizer.ts src/modules/ui/epg/view/EPGInfoPanel.ts src/modules/ui/epg/view/EPGChannelList.ts src/modules/ui/epg/view/EPGErrorBoundary.ts src/modules/plex/auth/PlexAuth.ts src/modules/plex/library/PlexLibrary.ts src/modules/plex/stream/PlexStreamResolver.ts src/modules/plex/stream/streamMimeType.ts
git diff --check
npm run plans:check
npm run verify:docs
```

Expected results:

- `git diff -- ...` shows only comment deletion or narrower retained-invariant comment rewrites in approved files.
- Bounded all-family audit output has a recorded disposition: no obvious generated-style/trivial production residue remains in the audited hot-path scope outside retained/source-disproved contract commentary.
- No non-comment code tokens, imports, exports, signatures, selectors, CSS, tests, storage keys, Plex auth/session behavior, stream/library behavior, or runtime ordering change.
- `git diff --check` passes with no whitespace errors.
- `npm run plans:check` passes for the active plan surface.
- `npm run verify:docs` passes after closeout doc updates.

Conditional verification:

- Run `npm run typecheck` and targeted tests only if any code token, signature, import, export, runtime ordering, selector, CSS runtime declaration, storage key, Plex auth/session/library/stream behavior, or test content moves. If that happens unintentionally, prefer reverting the non-comment edit before verification; if the code change is required, stop and replan.
- Skip `npm run verify` for pure comment/docs closeout and record: DCR-16 touched no executable code, UI/navigation/orchestrator/Plex runtime tokens, selectors, CSS runtime declarations, tests, imports/exports, storage keys, or Plex auth/library/stream behavior. If any of those move, `npm run verify` becomes required before closeout.

## Rollback Notes

Rollback is straightforward while the diff remains comment-only: revert the comment edits in the approved source files and any DCR-16 closeout doc updates. If verification finds code-token movement, revert those changes immediately and re-enter the seam gate before attempting a revised implementation.

Do not use `git reset --hard` or broad checkout commands because unrelated untracked planning/eval drafts are protected user/session work.

## Commit Checkpoints

- Commit this active plan separately from any later implementation.
- A cleanup worker implementation commit, if requested by the controller, must include only the approved comment-only source edits and exclude active tracked plan progress edits.
- Closeout docs should be a separate controller/tracked-doc commit after implementation review and verification are clean.

## Closeout Update Policy

After clean implementation and review:

- Update only the DCR-16 checklist mini-record to completed, with verification evidence and final disposition for `DCR-16-A1` / `S0-L10-F4`.
- Update this plan from active to completed and record the source-search/diff/verification evidence.
- Update the active DCR-EXIT plan only as needed to remove the DCR-16 blocker and show `DCR-EXIT-S2` may resume next.
- Do not perform DCR-EXIT-S2 reconciliation, owner-decision ledger work, package proof reconciliation, or final DCR-EXIT closeout inside DCR-16.
- Do not update `CURRENT_STATE.md` unless a closeout reviewer requires a source-disproved note. No ownership or architecture change is expected.

## MODEL_SUGGESTION

```text
MODEL_SUGGESTION
PLANNER: gpt-5.5 high
CLEANUP_WORKER: gpt-5.5 medium
REVIEWER: gpt-5.5 high
WHY: Tier 3 checklist blocker with source classification and strict scope-control risk. The implementation is comments-only, but the hard part is distinguishing generated-style residue from useful runtime, platform, security, focus, and lifecycle commentary.
```

## NEXT_SESSION_HANDOFF

```text
NEXT_SESSION_HANDOFF
LAUNCHER: $lineup-cleanup-loop
PLAN: docs/plans/2026-05-01-dcr-16-production-source-signal-residue-plan.md
CHECKLIST: ARCHITECTURE_CLEANUP_CHECKLIST.md section DCR-16
TASK_FAMILY: cleanup/refactor
CLEANUP_SUBTYPE: checklist-linked
PACKAGE_ID: DCR-16
READY_NOW_EXECUTION_UNIT: DCR-16-S1
READY_NOW_SLICE: DCR-16-S1
FILES:
  src/App.ts
  src/bootstrap.ts
  src/core/initialization/InitializationCoordinator.ts
  src/core/orchestrator/AppOrchestrator.ts
  src/modules/lifecycle/ErrorRecovery.ts
  src/modules/navigation/NavigationManager.ts
  src/modules/scheduler/channel-manager/ChannelManager.ts
  src/modules/scheduler/channel-manager/ContentResolver.ts
  src/modules/ui/settings/SettingsScreen.ts
  src/modules/ui/server-select/ServerSelectScreen.ts
  src/modules/ui/epg/component/EPGComponent.ts
  src/modules/ui/epg/view/EPGVirtualizer.ts
  src/modules/ui/epg/view/EPGInfoPanel.ts
  src/modules/ui/epg/view/EPGChannelList.ts
  src/modules/ui/epg/view/EPGErrorBoundary.ts
  src/modules/plex/auth/PlexAuth.ts
  src/modules/plex/library/PlexLibrary.ts
  src/modules/plex/stream/PlexStreamResolver.ts
  src/modules/plex/stream/streamMimeType.ts
MESSAGE:
  Execute DCR-16-S1 only. Remove generated-style, step-by-step, and trivial
  method comments in the approved production files, preserving all runtime,
  platform, security/token/logging, focus/accessibility, lifecycle, public
  contract, webOS/browser, Plex auth/library/stream, and non-obvious performance
  comments. Do not edit production code tokens, tests, CSS, imports/exports,
  selectors, APIs, storage keys, Plex behavior, or runtime order. Run the
  bounded all-family audit and stop/replan if it finds obvious same-pattern
  production residue outside the approved files that cannot be source-disproved.
  After clean implementation/review, update only DCR-16 closeout docs and minimal
  DCR-EXIT blocker references. Do not resume DCR-EXIT-S2 inside this package.
```
