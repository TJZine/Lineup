**Plan Status:** completed
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

# FCP-9 Source Signal, Convention, And Local Elegance Plan

## Goal

Retire exactly `FCP-9-SF1` through `FCP-9-SF5` by improving source signal and local convention without changing behavior: keep the now-playing stylesheet seam as a composition surface, reconcile stale architecture hotspot claims, prune only redundant comments in the listed files, and reduce the native facet-definition duplication inside the current channel setup executor.

This package is complete. The implementation landed in three reviewed checkpoints:

- `3902552a` `refactor(ui): split now-playing stylesheet seam`
- `f56d2c55` `refactor(source): prune redundant interface comments`
- `1120b3ac` `refactor(channel-setup): table native facet definitions`

## Non-Goals

- Do not reopen `DCR-16` as a broad comment sweep.
- Do not perform visual redesign, selector renaming, DOM restructuring, focus-flow changes, public Plex/library API behavior changes, storage-backed behavior changes, or persistence ownership changes.
- Do not change Plex auth, library, stream, subtitle, token, URL, or logging semantics.
- Do not change channel setup request behavior, DCR-7 callback ownership, required-tag failure semantics, progress/error accounting, abort behavior, or count recovery semantics.
- Do not admit source findings beyond `FCP-9-SF1` through `FCP-9-SF5` without refreshing this plan.

## Parent Priority Alignment

`FCP-9` is an active source-backed package in the final cleanup pass (`FCP-7` through `FCP-12`). `ARCHITECTURE_CLEANUP_CHECKLIST.md` owns package membership through `source_finding_id` values, not detector ids or Desloppify output. This plan keeps `FCP-9` package-scoped while choosing one ready-now execution unit for the cleanup-loop controller.

Closeout for this package must update the `FCP-9` checklist mini-record only after implementation, review, source audits, and verification are clean. `FCP-9` is not the final FCP package, so this plan does not include `## Priority-Exit Readiness`.

## Required Reading

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/README.md` routing table
4. `docs/agentic/session-prompts/cleanup-loop.md`
5. `docs/agentic/plan-authoring-standard.md`
6. `docs/agentic/codanna-playbook.md`
7. `ARCHITECTURE_CLEANUP_CHECKLIST.md` section `FCP-9`
8. `docs/architecture/CURRENT_STATE.md`
9. `docs/architecture/modules.md`
10. `docs/plans/2026-05-01-dcr-16-production-source-signal-residue-plan.md` as completed-background guardrail only
11. `docs/api/plex-integration.md`
12. This plan

Freshness gate: before implementation, run `git status --short` and stop if any in-scope source/doc file is dirty with overlapping FCP-9 edits. The dirty files observed during planning were unrelated/protected: `docs/archive/plans/2026-04-30-dcr-10-oversized-test-suite-structure.md`, `docs/plans/2026-04-30-dcr-exit-final-dimension-audit-plan.md`, `scorecard.png`, and untracked eval/plan drafts. Do not modify or rely on those files for FCP-9.

## Required Skills

- `architecture-boundaries`
- `verification-strategy`
- `execution-plan-authoring`
- `ui-composition-patterns`
- `plex-integration-boundaries`

`persistence-boundaries` was not loaded because this plan does not propose storage-backed behavior changes. Any storage-backed behavior change is a stop/replan signal.

## Codanna Discovery

- `get_index_info`: 11,896 symbols across 775 files; semantic search enabled; index updated about 35 minutes before planning.
- `search_documents` for `FCP-9 source signal convention local elegance`: returned weak/noisy hits in `docs/design/ui-design-language.md`, older EPG/style plans, and an AI-generated-debt plan. It did not directly locate the checklist source findings, so direct `ARCHITECTURE_CLEANUP_CHECKLIST.md` reads were required.
- `semantic_search_with_context` for `now-playing-info styles CSS seam local actor progress responsive rules`: returned unrelated scheduler/Plex/settings symbols. Fallback direct reads of `src/modules/ui/now-playing-info/styles.css`, sibling stylesheets, and `src/modules/ui/__tests__/runtime-token-style-contracts.test.ts` were required. That contract test currently pins `.now-playing-info-actors`, `.now-playing-info-progress`, `.now-playing-info-actor`, and `.now-playing-info-actor-more` declarations to `src/modules/ui/now-playing-info/styles.css`, so it is the affected CSS test surface for `FCP-9-S1`.
- `find_symbol ChannelSetupFacetLibraryExecutor`: found class at `src/core/channel-setup/planning/ChannelSetupFacetLibraryExecutor.ts:98-498` with `symbol_id:10736`.
- `analyze_impact symbol_id:10736`: reported no impacted symbols. Fallback `rg` found construction in `src/core/channel-setup/planning/ChannelSetupFacetSnapshotLoadSession.ts` and relevant tests in `src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoader.test.ts`, `ChannelSetupFacetCountRecoveryWorker.test.ts`, `ChannelSetupPlanner.test.ts`, `ChannelSetupPlanningService.test.ts`, and `ChannelSetupFacetSnapshotFailures.test.ts`.
- Public/shared symbol impact checks:
  - `IPlexLibrary` (`symbol_id:922`) impacts `PlexLibrary` and `AppOrchestrator`.
  - `INavigationManager` (`symbol_id:2809`) has a broad UI/runtime impact radius.
  - `AudioTrackManager` (`symbol_id:316`) impacts `VideoPlayer` and its focused tests.
  - `EPGErrorBoundary` (`symbol_id:4346`) impacts `EPGComponent`.
  - `EPGVirtualizer` (`symbol_id:4434`) impacts `EPGComponent`.
  - Codanna was inconsistent for `IPlexStreamResolver`; fallback `rg` showed it is used by player recovery, now-playing debug, tests, the stream barrel, `PlexStreamResolver`, and `docs/api/plex-integration.md`.
- Direct reads covered `docs/architecture/CURRENT_STATE.md`, `docs/architecture/modules.md`, the completed DCR-16 plan, `docs/api/plex-integration.md`, the FCP-9 checklist section, now-playing styles, selected interface/source files, executor code, and targeted channel setup test references.

## Impact Snapshot

`FCP-9-SF1`: `src/modules/ui/now-playing-info/styles.css` currently imports `styles.core.css`, `styles.motion.css`, and `styles.theme.css`, then carries local actor, cast, progress, and responsive rules. The intended seam is CSS composition: keep `styles.css` as imports only and move those local rules into a sibling leaf stylesheet imported from the seam. Selector names, declaration order, import order, and visual behavior must remain equivalent.

`FCP-9-SF2`: `docs/architecture/CURRENT_STATE.md` names only `src/App.ts` and `src/modules/ui/channel-setup/ChannelSetupScreen.ts` as current primary hotspots, while `docs/architecture/modules.md` still lists `src/Orchestrator.ts`, `src/App.ts`, `src/modules/ui/epg/component/EPGComponent.ts`, `src/modules/ui/channel-setup/ChannelSetupScreen.ts`, and `src/modules/scheduler/channel-manager/ChannelManager.ts` as primary active work targets. Update `modules.md` to match the source-backed current-hotspot distinction in `CURRENT_STATE.md`: EPG, Plex stream, scheduler/channel manager, and related surfaces remain important ownership/backlog surfaces where stated, but not current primary file-size hotspots unless a new source audit proves otherwise.

`FCP-9-SF3`: selected interface files contain a mix of useful public contract notes and restating JSDoc. Prune only comments that restate names, obvious parameter types, or section labels. Preserve navigation return semantics, focus/modal/input behavior notes, Plex library null/error semantics, Plex tag directory unsupported semantics, image URL token/null behavior, stream error stage diagnostics, mixed-content/connection seams, and any note mirrored by `docs/api/plex-integration.md`.

`FCP-9-SF4`: selected implementation comments include useful platform/performance/failure rationale and redundant adjacent narration. In `AudioTrackManager`, keep webOS/native-track, retry/timeout, codec, restore-failure, and media-relative index guidance; delete only comments such as field-name restatements or immediate step narration. In `EPGErrorBoundary`, keep graceful degradation, redaction/logging, event, threshold, and operation-wrapper rationale; delete only comments that echo the next branch. In `EPGVirtualizer`, keep ADR/performance, deterministic positioning, pool bounds, focus synchronization, ticker, and DOM-recycling rationale; delete only generated-style class/method/step comments.

`FCP-9-SF5`: `_createNativeFacetDefinitions()` repeats five enabled-branch blocks for genres, directors, decades, studios, and actors. A local descriptor table is allowed only if it stays inside `ChannelSetupFacetLibraryExecutor.ts`, preserves definition order, maps genre vs detail media types exactly, uses the same state maps and Plex methods, and does not alter failure/progress/count recovery/abort behavior. Source audit classifies the code rewrite as optional; the required outcome is a disposition. If the descriptor table would obscure the current contract or widen the seam, source-justify retaining the explicit branches and record that in implementation/review output.

## Package Decomposition

- `package_id`: `FCP-9`
- `checklist_token`: `FCP-9`
- `source_finding_ids`:
  - `FCP-9-SF1`
  - `FCP-9-SF2`
  - `FCP-9-SF3`
  - `FCP-9-SF4`
  - `FCP-9-SF5`

`slice_table`:

| slice_id | goal | areas/files | source_finding_ids | verification | dependencies | stop_condition | handoff_condition | serial_only | parallel_justification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FCP-9-S1` | Make the now-playing stylesheet seam composition-only and reconcile architecture hotspot truth. | `src/modules/ui/now-playing-info/styles.css`, a new or existing sibling leaf stylesheet under `src/modules/ui/now-playing-info/`, `src/modules/ui/__tests__/runtime-token-style-contracts.test.ts` scoped only to stylesheet seam policy expectations if needed, `docs/architecture/modules.md`, `docs/architecture/CURRENT_STATE.md` only if source audit proves it needs a narrow wording correction. | `FCP-9-SF1`, `FCP-9-SF2` | CSS import/source audit, focused runtime token style contract test, `npm run lint:css`, stale-hotspot source audit, `npm run verify:docs` because architecture docs change, `git diff --check`; `npm run verify` at package closeout because CSS changes are implemented. | None. This is the ready-now execution unit. | Stop if CSS selector/declaration/import order changes visuals, if `styles.css` keeps local leaf rules after the move, if the runtime token contract update broadens beyond stylesheet seam policy expectations, if docs drift away from `CURRENT_STATE.md`, or if architecture truth requires a broader hotspot audit than FCP-9. | `styles.css` is import-only for the now-playing package, local rules live in a leaf stylesheet, runtime token style contracts point at the correct declaration owner, architecture docs agree on current primary hotspots, and audits show no visual/selector drift. | true | CSS seam, its existing contract test, and architecture docs are the lowest-risk first slice and should be reviewed as one coherent convention/truth update. |
| `FCP-9-S2` | Prune narrow redundant comments while preserving API and runtime guidance. | `src/modules/navigation/interfaces.ts`, `src/modules/plex/stream/interfaces.ts`, `src/modules/plex/library/interfaces.ts`, `src/modules/player/AudioTrackManager.ts`, `src/modules/ui/epg/view/EPGErrorBoundary.ts`, `src/modules/ui/epg/view/EPGVirtualizer.ts`; `docs/api/plex-integration.md` only if source audit proves a public Plex contract doc must remain aligned after non-comment token changes, which should normally stop/replan. | `FCP-9-SF3`, `FCP-9-SF4` | Targeted pre/post `rg` comment audit, behavior-neutral diff audit proving no code-token/signature/export/import/selector movement, `npm run typecheck` if any TypeScript file changes, `git diff --check`; `npm run verify` at package closeout if this follows CSS or executable changes. | Run after `FCP-9-S1` to keep architecture-doc truth settled before source-signal pruning. | Stop if a comment carries semantic API guidance, Plex null/error behavior, focus/modal semantics, webOS/platform behavior, performance rationale, redaction/security guidance, lifecycle cleanup, or failure semantics that would be lost. Stop if any public contract or docs/API alignment change is needed. | Only redundant comments are removed or narrowed; retained comments continue to explain non-obvious contracts and UI/Plex/runtime rationale; no behavior or public API changes occur. | true | Comments span public interfaces and TV/Plex-visible runtime surfaces; one serial source-signal review keeps the behavior-neutral proof coherent. |
| `FCP-9-S3` | Dispose the facet-definition duplication by a local descriptor table if it improves readability, or source-justify retaining explicit branches. | `src/core/channel-setup/planning/ChannelSetupFacetLibraryExecutor.ts`; targeted channel setup tests only if executable logic moves. | `FCP-9-SF5` | Source audit of `_createNativeFacetDefinitions()` before editing; if code changes, run focused channel setup tests for tag-directory success/failure, abort, count recovery, and planning service behavior, plus `npm run typecheck`, `git diff --check`, and package-closeout `npm run verify`. If no code change, record source-justified retention and run the source audit only. | Run after `FCP-9-S2`; do not combine with comment cleanup. | Stop if a descriptor table changes definition order, media-type choice, Plex request method, state map, required-tag failure handling, progress/error accounting, count recovery, abort behavior, or DCR-7 callback ownership. Stop if the table requires a shared helper/export or cross-file contract. | Either the local descriptor table lands with focused tests and unchanged behavior, or implementation output records why explicit branches are the clearer final owner for this low-level duplication. | true | This is executable channel setup logic and must stay serial after the lower-risk source-signal slices. |

`coverage_check`:

- `FCP-9-SF1` maps only to `FCP-9-S1`.
- `FCP-9-SF2` maps only to `FCP-9-S1`.
- `FCP-9-SF3` maps only to `FCP-9-S2`.
- `FCP-9-SF4` maps only to `FCP-9-S2`.
- `FCP-9-SF5` maps only to `FCP-9-S3`.
- No `source_finding_id` is deferred or split. Replan is required before admitting any new source finding or broadening into a repo-wide comment/style sweep.

`recommended_slice_order`:

1. `FCP-9-S1`
2. `FCP-9-S2`
3. `FCP-9-S3`

`ready_now_execution_unit`: `none`

`ready_now_slice`: `none`

`parallel_execution_policy`: serial only. No execution waves were used, and no `execution_waves` or `coverage_ledger` were used.

Closeout disposition:

- `FCP-9-S1` complete: `styles.css` is import-only, local now-playing actor/cast/progress/responsive rules live in `styles.content.css`, runtime token style contracts point at the declaration owner, and `modules.md` matches `CURRENT_STATE.md` for current primary hotspots.
- `FCP-9-S2` complete: redundant comments were pruned from the listed interface/player/EPG files with a comments-only diff; retained comments preserve public contracts, Plex null/error and token guidance, focus/runtime semantics, platform behavior, and failure/performance rationale.
- `FCP-9-S3` complete: `_createNativeFacetDefinitions()` now uses a private in-method descriptor table that preserves facet order, genre/detail media types, state maps, Plex methods, returned shape, and existing failure/progress/count-recovery/abort behavior.

## Files In Scope

- `src/modules/ui/now-playing-info/styles.css`
- A new or existing sibling leaf stylesheet under `src/modules/ui/now-playing-info/` for moved local rules
- `src/modules/ui/__tests__/runtime-token-style-contracts.test.ts` only for stylesheet seam policy expectations if the moved now-playing declarations require contract updates
- `docs/architecture/modules.md`
- `docs/architecture/CURRENT_STATE.md` only if a narrow source-backed wording correction is needed
- `src/modules/navigation/interfaces.ts`
- `src/modules/plex/stream/interfaces.ts`
- `src/modules/plex/library/interfaces.ts`
- `src/modules/player/AudioTrackManager.ts`
- `src/modules/ui/epg/view/EPGErrorBoundary.ts`
- `src/modules/ui/epg/view/EPGVirtualizer.ts`
- `src/core/channel-setup/planning/ChannelSetupFacetLibraryExecutor.ts`
- Focused channel setup tests only if `FCP-9-S3` changes executable logic
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` only after implementation/review/verification are clean
- This plan for status/evidence updates only after the controller approves closeout

## Files Out Of Scope

- Any production file not listed in `## Files In Scope`
- `docs/api/plex-integration.md` unless a stopped/replanned contract-doc alignment decision explicitly brings it into scope
- Broad generated-comment cleanup outside the listed files
- Visual redesign, selector renaming, UI text changes, DOM changes, focus behavior, timers/listeners, ARIA/status semantics, navigation behavior, Plex request/transport/auth/stream behavior, storage keys/schemas, and public API shape changes
- `docs/plans/2026-05-01-dcr-16-production-source-signal-residue-plan.md` except as read-only guardrail
- The unrelated dirty/protected files observed at planning startup

## Planner Self-Check

1. Unresolved architecture seam? No. The plan chooses three serial seams: CSS composition plus docs truth, behavior-neutral comment pruning, and optional local executor cleanup/disposition.
2. Adjacent contract/type changes hidden out of scope? No. Any public contract, export, import, selector, storage, Plex behavior, or API-doc semantic change is a stop/replan trigger.
3. Out-of-scope files implicitly required? No. `docs/api/plex-integration.md` remains read-only unless a contract-doc mismatch is discovered, in which case the plan must be refreshed.
4. Codanna evidence path recorded? Yes, including weak/noisy Codanna results and `rg`/direct-read fallbacks.
5. Repo-preferred owner? Yes. CSS leaf rules stay in the now-playing UI package, architecture truth stays in architecture docs, Plex and navigation contracts are preserved, and channel setup duplication stays inside the existing executor if changed at all.
6. Fresh-session invention required? No. Slice ownership, source findings, verification, and stop conditions are explicit.
7. Execution-grade? Yes. The plan freezes the seams and verification without prescribing implementation-level helper names beyond the local descriptor-table boundary for `FCP-9-S3`.

## Architecture Seam Decision Gate

The approved seams are:

- CSS seam: `styles.css` remains a package composition surface; local actor/progress/responsive rules move to a sibling leaf stylesheet with equivalent selectors/declarations and deterministic import order.
- Architecture docs seam: `CURRENT_STATE.md` remains canonical current-state truth; `modules.md` must not list broader backlog surfaces as current primary hotspots when `CURRENT_STATE.md` says they are important but no longer primary file-size hotspots.
- Comment seam: edits are deletion or narrowing of redundant comments only. Comments that explain public contracts, null/error semantics, Plex quirks, side effects, lifecycle cleanup, platform behavior, performance rationale, focus behavior, redaction/security, or failure handling must remain.
- Facet executor seam: any descriptor table must be private to `ChannelSetupFacetLibraryExecutor.ts` and preserve the existing executor contract exactly. No shared helper, export, callback ownership move, or cross-file abstraction is approved.

Stop and replan if comment pruning removes semantic API guidance; CSS movement changes visuals, selectors, declaration order, or import behavior; facet-table work changes failure/progress/count recovery semantics or DCR-7 callback ownership; any storage-backed behavior change appears; or source audit shows package membership no longer matches exactly `FCP-9-SF1` through `FCP-9-SF5`.

## Verification Commands

Primary verification mode: `refactor-invariance`.

Plan classification: `broader integration/manual proof required`.

Plan gate:

- `npm run plans:check`
  - Expected: this active plan satisfies the serious-plan and FCP cleanup-overlay structure.

Ready-now `FCP-9-S1` verification:

- Source audit: inspect `src/modules/ui/now-playing-info/styles.css` and sibling leaf stylesheet(s) to confirm `styles.css` is import-only and moved rules are equivalent.
- Focused contract test: `npm run test:contracts -- src/modules/ui/__tests__/runtime-token-style-contracts.test.ts`
  - Expected: now-playing token/style contract expectations pass after any declaration-owner updates for the stylesheet seam split.
- Source audit: inspect `docs/architecture/CURRENT_STATE.md` and `docs/architecture/modules.md` hotspot sections to confirm they no longer conflict.
- `npm run lint:css`
  - Expected: stylelint passes after the stylesheet split.
- `npm run verify:docs`
  - Expected: architecture doc updates pass docs/control-plane verification.
- `git diff --check`
  - Expected: no whitespace errors.

`FCP-9-S2` verification:

- Targeted source audit: pre/post `rg` over the listed files for redundant comment patterns and retained contract/rationale comments.
- Diff audit: no code-token, signature, export/import, selector, or behavior changes.
- `npm run typecheck` if any TypeScript file is changed.
  - Expected: TypeScript remains clean.
- `git diff --check`
  - Expected: no whitespace errors.

`FCP-9-S3` verification if executable logic changes:

- Focused tests:
  - `npm test -- --runInBand src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoader.test.ts src/core/channel-setup/__tests__/ChannelSetupFacetCountRecoveryWorker.test.ts src/core/channel-setup/__tests__/ChannelSetupPlanner.test.ts src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotFailures.test.ts`
  - Expected: tag-directory success/failure, abort, planning, and count recovery behavior remains unchanged.
- `npm run typecheck`
  - Expected: TypeScript remains clean.
- `git diff --check`
  - Expected: no whitespace errors.

Package closeout verification after any CSS or executable code change:

- `npm run verify`
  - Expected: full package gate passes before FCP-9 checklist closeout.

Observed verification:

- `npm run plans:check` passed after plan creation and again after plan-review revision.
- `npm run test:contracts -- src/modules/ui/__tests__/runtime-token-style-contracts.test.ts` passed for `FCP-9-S1`.
- `npm run lint:css` passed for `FCP-9-S1`.
- `npm run verify:docs` passed for `FCP-9-S1`.
- `npm run typecheck` passed for `FCP-9-S2`.
- `npm test -- --runInBand src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoader.test.ts src/core/channel-setup/__tests__/ChannelSetupFacetCountRecoveryWorker.test.ts src/core/channel-setup/__tests__/ChannelSetupPlanner.test.ts src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotFailures.test.ts` passed for `FCP-9-S3`.
- `npm run typecheck` passed for `FCP-9-S3`.
- `git diff --check` passed at each implementation checkpoint.
- Final package `npm run verify` passed.

No new automated tests are required for pure comment pruning. New or changed tests are justified only if `src/modules/ui/__tests__/runtime-token-style-contracts.test.ts` needs to follow the moved stylesheet declaration owner for `FCP-9-S1` or the facet descriptor-table refactor exposes a real coverage gap.

## Rollback Notes

- CSS rollback: restore the previous `styles.css` rule placement or revert only the added leaf stylesheet/import if visual or import parity fails.
- Architecture-doc rollback: revert the hotspot wording update if a source audit proves `modules.md` was more current than `CURRENT_STATE.md`; then refresh `CURRENT_STATE.md` first in a revised plan.
- Comment rollback: restore any comment that review identifies as carrying semantic contract, failure, platform, Plex, focus, or lifecycle guidance.
- Facet rollback: revert the descriptor-table change and retain explicit branches if focused tests or source review show any behavior, ordering, ownership, or readability regression.

## Commit Checkpoints

- Commit `FCP-9-S1` separately after CSS/doc verification is clean.
- Commit `FCP-9-S2` separately if it changes TypeScript comments/source signal.
- Commit `FCP-9-S3` separately only if executable executor logic changes; if it is source-justified with no code change, record that disposition in implementation/review output and checklist closeout instead.
- Keep active tracked plan updates and checklist closeout docs separate from implementation commits unless the controller explicitly chooses a tracked-doc commit.
