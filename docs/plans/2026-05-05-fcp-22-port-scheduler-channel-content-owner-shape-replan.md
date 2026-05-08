**Plan Status:** completed
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

# FCP-22 Port Scheduler, Channel, And Content Owner-Shape Replan

## Goal

Replan reopened `ARCHITECTURE_CLEANUP_CHECKLIST.md` item `FCP-22` against current source and the broadened owner-shape gate.

This is an FCP source-backed checklist package. Coverage is defined only by `source_finding_id` values `FCP-22-SF1`, `FCP-22-SF2`, `FCP-22-SF3`, and `FCP-22-SF4`. Do not use detector ids, imported review ids, package-map ids, Desloppify output, score deltas, raw review observations, or stale hotspot wording as FCP-22 intake, proof, or closeout evidence.

Current-source audit finds no approved production/test implementation wave for FCP-22. The prior narrow FCP-22 pass, commits `a23ad65a` and `6dec336d`, and `docs/plans/2026-05-05-fcp-22-port-scheduler-channel-content-readiness-plan.md` are partial evidence only. This replan must still prove that the same scheduler/channel-manager/content owner shape is not structurally wrong in a way that would recreate recurring cleanup work.

Completion means every FCP-22 source finding is resolved, source-disproved, or accepted with one owner and revisit trigger; the public `ChannelManager` facade remains; current-channel persistence remains explicit best-effort pointer persistence; content cache/coalescing/mapping/filtering/sorting/playback-ordering owners are source-backed; no standalone channel-manager foldering is admitted; and `FCP-23` remains blocked until FCP-22 closeout is reviewed clean and recorded by the controller.

## Non-Goals

- Do not implement production or test changes from this planning pass.
- Do not mark FCP-22 in progress or complete from this planning pass.
- Do not edit `ARCHITECTURE_CLEANUP_CHECKLIST.md`, current architecture docs, or the untracked FCP-23 draft during this planning pass.
- Do not start, refresh, or implement `FCP-23`, `FCP-24`, `FCP-25`, Windows platform work, Desloppify intake, or any post-FCP cleanup.
- Do not reopen completed `FCP-16` or `FCP-17` unless current source proves distinct live residual or false baseline evidence.
- Do not remove the public `ChannelManager` facade, widen public channel APIs, add compatibility shims, add root/package barrels, or expose package-local cache/mapping/persistence/order internals to external callers.
- Do not change persistence keys, server/user key formats, localStorage schema, `StoredChannelData` wire shape, current-channel best-effort behavior, persistence warning behavior, Plex behavior, UI workflow behavior, scheduler/content behavior, or package organization.

## Parent Priority Alignment

`FCP-22` is the next safe package after completed `FCP-21`. The checklist explicitly reopens FCP-22 because the prior narrow pass is partial evidence only and blocks `FCP-23` until a broadened owner-shape replan passes checks and review.

The approved parent architecture owner is `src/modules/scheduler/channel-manager/**` plus the already-existing scheduler shared ordering helpers. Current architecture docs name `ChannelPersistenceStore` as the channel-domain persistence owner, `ChannelManager` as the public channel-domain API/state facade, `ContentResolver` as the package-local source-resolution entrypoint, `SourceResolutionCache` as source-result cache/coalescing owner, `ContentItemMapper` as Plex item mapping/media normalization owner, `ContentSelectionPolicy` as filtering/sorting/content playback policy owner, `ChannelResolutionCache` as resolved channel-content clone/stale owner, and `src/modules/scheduler/shared/playbackOrdering.ts` as common sequential/shuffle/block ordering owner.

This replan is a no-production-change owner-shape closure handoff unless plan review or controller validation disproves the current audit. Any implementation requirement is a stop/replan event, not an instruction to patch source under this artifact.

## Required Reading

Read in this order before review or any later closeout execution:

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
   - completed `FCP-13` through reopened `FCP-22`
   - `FCP-23` through `FCP-25` sequencing blockers
8. `docs/architecture/CURRENT_STATE.md`
9. `docs/architecture/modules.md`
10. Completed baseline plans:
    - `docs/plans/2026-05-05-fcp-16-scheduler-current-channel-channelmanager-persistence-semantics-plan.md`
    - `docs/plans/2026-05-05-fcp-17-contentresolver-cache-coalescing-mapping-boundaries-plan.md`
    - `docs/plans/2026-05-05-fcp-20-pre-windows-cleanup-exit-source-reconciliation-plan.md`
    - `docs/plans/2026-05-05-fcp-21-port-runtime-playback-plex-auth-readiness-plan.md`
    - `docs/plans/2026-05-05-fcp-22-port-scheduler-channel-content-readiness-plan.md` as partial evidence only
11. This active replan
12. Read-only source/test audit surfaces named in `## Files In Scope`
13. `git status --short --branch`

Freshness gate: stop and refresh this plan if any FCP-22 checklist text, scheduler/channel-manager architecture ownership text, files in scope, tests in scope, or public scheduler/channel contract text changed materially after 2026-05-05.

Planning observed branch `code-health...origin/code-health [ahead 6]` with pre-existing dirty/untracked paths: `ARCHITECTURE_CLEANUP_CHECKLIST.md`, workflow/launcher docs, archived DCR docs, `scorecard.png`, a baseline summary, and untracked `docs/plans/2026-05-05-fcp-23-port-ui-workflow-readiness-plan.md`. Preserve those paths unless a future controller explicitly opens them for reviewed closeout work.

## Required Skills

- `architecture-boundaries`: required because FCP-22 evaluates the `ChannelManager` public facade, package-local owner seams, and shared scheduler ordering owner.
- `persistence-boundaries`: required because current-channel persistence, storage keys, storage warnings, and channel-domain storage ownership are audited.
- `verification-strategy`: required to freeze this no-production-change proof surface without inventing brittle tests.
- `execution-plan-authoring`: required for the Tier 3 source-backed FCP package replan.

Do not load `debugging-remediation` unless a concrete bug/regression appears. Do not load `plex-integration-boundaries` unless a source audit proves Plex request or metadata contracts are implicated; normally stop/replan. Do not load `ui-composition-patterns` unless the audit crosses channel setup, EPG, navigation, focus, or UI workflow; normally block because `FCP-23` owns that work.

## Codanna Discovery

- `get_index_info`: 12,111 symbols across 802 files; 14,316 relationships; semantic search enabled with `JinaEmbeddingsV2BaseCode`; 337 embeddings; index created/updated 1 hour before this planning pass.
- `search_documents`: anchored queries for reopened FCP-22 checklist context, FCP operating rules, FCP-16/FCP-17/FCP-20/FCP-21 baseline docs, the completed partial FCP-22 plan, and current architecture docs were noisy. Top results were unrelated eval, getting-started, user-guide, or historical-plan snippets. Deterministic fallback used direct reads of the required checklist, workflow, architecture, and completed FCP plan files.
- `semantic_search_with_context "ChannelManager public facade scheduler channel-manager content resolution persistence owner concentration"`: found `ChannelManager.resolveChannelItemsForSchedule`, `ChannelManagerState`, and `loadChannels`; useful for owner/caller hints, but direct reads were required for full facade shape.
- `semantic_search_with_context "current-channel persistence ChannelPersistenceStore ChannelPersistenceCoordinator ChannelPersistenceSaveQueue ChannelRepository OrchestratorStorageContext"`: found `persistCurrentChannelIdBestEffort`, `saveChannels`, `ChannelConfig`, and `setStorageKeys`; confirmed best-effort persistence seam.
- `semantic_search_with_context "ContentResolver SourceResolutionCache ContentItemMapper ContentSelectionPolicy ChannelResolutionCache cache coalescing mapping normalization filtering sorting"`: found `ContentResolver`, `ResolvedContentItem`, `ResolvedChannelContent`, and `resolveChannelItemsForSchedule`; `SourceResolutionCache`, mapper, and selection-policy reverse impact remained weak, so source reads and `rg` are authoritative.
- `semantic_search_with_context "ScheduleCalculator shared playbackOrdering ContentSelectionPolicy applyPlaybackMode scheduledIndex block shuffle sequential"`: found `applyBlockPlaybackMode`, `PlaybackMode`, and `ContentResolver.applyPlaybackMode`; Codanna did not index `applyPlaybackOrdering`, so `rg` and direct reads prove the shared owner.
- `find_symbol` snapshots:
  - `ChannelManager` symbol_id `2801`
  - `ChannelPersistenceStore` symbol_id `2268`
  - `ChannelPersistenceCoordinator` symbol_id `2752`
  - `ChannelPersistenceSaveQueue` symbol_id `2599`
  - `ChannelRepository` symbol_id `2247`
  - `ContentResolver` symbol_id `2493`
  - `SourceResolutionCache` symbol_id `2663`
  - `ContentItemMapper` symbol_id `2563`
  - `ChannelResolutionCache` symbol_id `2204`
  - `OrchestratorStorageContext` symbol_id `9367`
- `analyze_impact` snapshots:
  - `ChannelManager` returned no impacted symbols, which is a Codanna gap for a public facade; direct `rg`/semantic caller hints show EPG schedule refresh, channel tuning, mini-guide, and tests use it through public seams.
  - `ChannelPersistenceStore` impacts `ChannelRepository`, `ChannelPersistenceCoordinator`, and a `ChannelRepository.test.ts` helper.
  - `ChannelPersistenceCoordinator` impacts `ChannelManager`.
  - `ChannelPersistenceSaveQueue` impacts `ChannelPersistenceCoordinator` and `ChannelManager`.
  - `ChannelRepository` impacts `ChannelPersistenceCoordinator`, `ChannelManager`, and a `ChannelRepository.test.ts` helper.
  - `ContentResolver` impacts `ChannelManager`.
  - `SourceResolutionCache` and `ContentItemMapper` returned no impacted symbols, a reverse-impact gap contradicted by direct source showing `ContentResolver` constructs them.
  - `ChannelResolutionCache` impacts `ChannelManager`.
  - `OrchestratorStorageContext` impacts `AppOrchestrator`.
  - `applyPlaybackMode` was ambiguous; symbol-specific impact for `ContentResolver.applyPlaybackMode` returned no impacted symbols, and scheduler/content-selection results were noisy. Direct `rg` is authoritative for the two call paths into `applyPlaybackOrdering`.
- Fallback source audits used `rg` and direct reads for persistence method names, strict/best-effort wording, storage warning patterns, ChannelManager ownership concentration, ContentResolver owner patterns, cache/coalescing behavior, mapping/normalization/filtering/sorting/playback-ordering behavior, imports/exports, and no public API/schema widening.

## Impact Snapshot

Current source observed during this replan:

- `ChannelPersistenceStore` owns raw channel and current-channel storage mechanics through safe storage helpers. It trims current-channel ids, removes empty current-channel values, rewrites normalized reads, and returns mutation results instead of throwing storage mechanics into callers.
- `ChannelRepository.loadNormalized()` reads the channel payload and separate current-channel pointer together. The separate pointer wins only when it points at an existing channel; channel data is not rewritten solely because the pointer changed selected current channel.
- `ChannelPersistenceCoordinator.persistCurrentChannelIdBestEffort(...)` is the only current-channel pointer persistence method. Its JSDoc states the state transition is not transactional on localStorage availability, it logs `Failed to persist current channel`, emits persistence warnings through `ChannelPersistenceSaveQueue`, and swallows pointer-write failures.
- `ChannelManager.setCurrentChannel(...)` validates the channel, updates in-memory current state, calls `persistCurrentChannelIdBestEffort(...)`, and emits `channelSwitch`. `replaceAllChannels(...)` persists the full channel payload transactionally before in-memory replacement, then best-effort persists the separate current-channel pointer.
- Storage keys remain unchanged: `lineup_channels_v4`, `lineup_channels_server_v1`, and `lineup_current_channel_v4`; `OrchestratorStorageContext` still scopes channel keys by selected server and active user.
- `ChannelManager.ts` is still broad at 930 lines, and the plan must not hide that residual shape. Its FCP-22-retained responsibilities are source-justified as the public channel-domain facade: public state transitions, event emission, duration filtering tied to channel config, source-empty versus filter-empty taxonomy, resolved-content cache fallback, access-denied invalidation, and retry/cache coordination. These responsibilities need channel state, public error semantics, `ChannelResolutionCache`, `ChannelRetryScheduler`, and facade event/persistence side-effect policy in one place. They are not structurally wrong for FCP-22 unless future source audit proves they can move to one package-local owner without changing public channel behavior or cache/error semantics.
- `ContentResolver.ts` is 485 lines and remains the package-local source-resolution orchestration entrypoint. It delegates source-result cache/in-flight coalescing to `SourceResolutionCache`, Plex item mapping/media normalization to `ContentItemMapper`, and filtering/sorting/playback policy to `ContentSelectionPolicy`.
- `ContentResolver` still owns show-list cache TTL/stale fallback orchestration for TV-library parent decoration. That is source-justified retained ownership because the cache is local to source resolution, depends on the library fetch path and abort/fallback behavior, and is not the same owner as the generic source-result cache in `SourceResolutionCache`. Revisit only if parent-decoration/show-list caching is reused by another owner, grows beyond source-resolution orchestration, or needs a separately testable policy without changing Plex request behavior.
- `SourceResolutionCache` owns TTL/LRU source-result cache behavior, epoch/generation invalidation, stable source serialization, in-flight waiter coalescing, shared abort lifecycle, clone-on-read/write, source invalidation, and mixed-source recursive invalidation.
- `ContentItemMapper` owns Plex item to `ResolvedContentItem` mapping, full-title building, parent episode decoration, and mediaInfo resolution/HDR/Dolby Vision/audio normalization.
- `ContentSelectionPolicy` owns filtering, sorting, and content-level playback policy. It delegates sequential/shuffle/block ordering to `src/modules/scheduler/shared/playbackOrdering.ts` and keeps random playback mode local.
- `ScheduleCalculator.applyPlaybackMode(...)` also delegates sequential/shuffle/block ordering to `src/modules/scheduler/shared/playbackOrdering.ts` while retaining scheduler-specific `IShuffleGenerator` injection.
- `src/modules/scheduler/shared/playbackOrdering.ts` owns common sequential/shuffle/block playback ordering, block-size normalization, and scheduled-index normalization. `blockPlayback.ts` remains the block grouping primitive.
- `ChannelResolutionCache` owns resolved channel-content clone/stale policy for `ChannelManager`; it is distinct from `SourceResolutionCache` and should not be merged under FCP-22.
- `src/modules/scheduler/channel-manager/index.ts` still exports the existing public `ChannelManager`, `ContentResolver`, public interfaces/types, and constants. No public export widening, root barrel addition, compatibility shim, storage schema/key migration, or package-foldering-only change is source-proven.

Owner-shape gate conclusion:

- The original FCP-22 narrow source concerns are false on current source or already resolved by the partial pass.
- The same scheduler/channel-manager/content owner area is not still structurally wrong for the FCP-22 port-foundation goal. `ChannelManager` and `ContentResolver` remain non-trivial owners, but their retained responsibilities are explicitly accounted for: `ChannelManager` owns public facade state/error/cache/retry coordination, and `ContentResolver` owns source-resolution orchestration including TV show-list cache fallback. Those retained responsibilities have final owners and revisit triggers in `coverage_check`; they do not recreate the specific persistence, facade-local, cache/coalescing, mapping, filtering/sorting, playback-ordering, or organization cleanup loop.

## Files In Scope

Write scope for this planner pass:

- `docs/plans/2026-05-05-fcp-22-port-scheduler-channel-content-owner-shape-replan.md`

Future closeout scope after clean plan validation and review only:

- `ARCHITECTURE_CLEANUP_CHECKLIST.md` for FCP-22 closeout recording only; do not mark status without observed evidence.
- `docs/architecture/CURRENT_STATE.md` and `docs/architecture/modules.md` only if closeout review finds current architecture truth stale.

Read-only source/test audit scope:

- `src/modules/scheduler/channel-manager/**`
- `src/modules/scheduler/shared/**`
- `src/modules/scheduler/scheduler/ScheduleCalculator.ts`
- `src/modules/scheduler/scheduler/types.ts`
- `src/modules/scheduler/scheduler/ShuffleGenerator.ts`
- `src/core/orchestrator/storage/OrchestratorStorageContext.ts`
- `src/config/storageKeys.ts`
- scheduler/channel-manager and scheduler tests covering persistence, content resolution, source cache/coalescing, mapping/filtering/sorting/playback, shared ordering, transactional replacement, warning behavior, and storage keys

## Files Out Of Scope

- Production source changes.
- Test source changes.
- `docs/plans/2026-05-05-fcp-23-port-ui-workflow-readiness-plan.md`.
- Public `ChannelManager` facade removal, public channel API widening, `ContentResolver` public entrypoint changes, scheduler public export changes, compatibility shims, root/package barrels, and foldering-only organization.
- Persistence schema/key migrations, server/user key format changes, compatibility storage branches, `StoredChannelData` wire-shape changes, strict current-channel persistence, and warning behavior changes.
- Plex auth/runtime/playback work owned by `FCP-21`.
- Channel setup, EPG, navigation, focus, or UI workflow work owned by `FCP-23`.
- Behavior-neutral package organization owned by `FCP-24`.
- Final proof/Windows handoff work owned by `FCP-25`.
- Windows platform implementation and Desloppify intake.
- Pre-existing dirty/untracked workspace files unless a future controller explicitly scopes them.

## Planner Self-Check

1. No unresolved architecture seam is hidden: this replan chooses no production implementation because current source passes the owner-shape gate, including explicit final-owner accounting for retained `ChannelManager` and `ContentResolver` responsibilities.
2. Adjacent contract/type changes are explicit: public channel APIs, persistence schema/keys, source-resolution behavior, scheduler ordering behavior, Plex behavior, and UI workflow behavior are frozen.
3. Files out of scope are not hidden implementation dependencies. Source/test files are read-only audit surfaces only.
4. Codanna evidence and insufficiencies are recorded, including noisy document search and direct `rg` fallback.
5. The plan assigns final ownership to repo-preferred owners and does not grow `ChannelManager` or `ContentResolver`.
6. A fresh session does not need to invent package membership, owner-shape policy, source-disproved criteria, or verification depth.
7. This is execution-grade for review/closeout routing. It deliberately does not prescribe production-code pseudo-code because no source edits are approved.

## Architecture Seam Decision Gate

Approved seam:

- No production/test implementation is approved by this replan.
- Treat `FCP-22-W1` as the ready-now serial source-audit/closeout-recording execution unit. It may update checklist/current architecture docs only after the controller observes clean review and the required source audits.
- `source-disproved/no-code` is valid only if the original source concern is false and the same scheduler/channel-manager/content owner is not still structurally wrong in a way that would recreate recurring cleanup work. This replan’s current-source audit says that gate is met.
- Do not defer solely because a possible cleanup would be large. If review proves a live correction stays inside scheduler/channel-manager/content ownership with a stable proof surface, refresh this plan to make it a coherent wave. If review proves the correction crosses owners, behavior, public API, persistence, Plex, UI, or verification envelopes, stop/replan with maintainer approval.

Stop and replan if:

- persistence schema/key migration, server/user key format changes, compatibility storage branches, strict/transactional current-channel behavior, or warning behavior changes are needed;
- public `ChannelManager` facade removal, public channel API widening, public package export widening, `ContentResolver` public entrypoint changes, or compatibility shims are needed;
- Plex behavior, UI workflow behavior, scheduler/content behavior, playback ordering behavior, cache/coalescing behavior, mapping/normalization behavior, filtering/sorting behavior, source-empty/filter-empty errors, stale-cache fallback, EPG/mini-guide/channel-tuning behavior, or Windows platform behavior would change;
- source review proves `ChannelManager` or `ContentResolver` remains structurally concentrated for an FCP-22-owned reason despite the current audit, including unowned show-list cache fallback, duration filtering, empty-content taxonomy, cache fallback, access-denied invalidation, or retry/cache coordination;
- FCP-16 or FCP-17 baseline evidence is source-false;
- FCP-23, FCP-24, or FCP-25 ownership is needed to finish the correction;
- a new `source_finding_id`, changed execution-unit membership, changed final-owner accounting, or materially wider verification surface is needed.

Absorb-now rule: absorb only newly discovered residue that stays within the same FCP-22 owner seam, same read-only/proof surface, same final-owner accounting, and same no-production-change closeout goal. Any source edit or wider verification need is a replan trigger.

## Verification Commands

Verification strategy classification: `broader integration/manual proof required`.

Primary verification mode: `integration-ops` with source-audit proof. This replan changes only the tracked plan artifact. It does not require new automated tests because no production/test behavior changes are approved. Existing tests remain the confidence surface for current source; any future source edit must refresh the verification strategy.

Plan-authoring validation, to be run by the controller after this planning pass and before any FCP-22 closeout/unblocking claim:

1. `npm run plans:check`
   - Expected: active tracked plan structure passes, including Universal Plan Core, cleanup overlay, FCP source-backed ids, coverage check, scalar ready-now fields, and no detector/imported ids.
2. `npm run verify:docs`
   - Expected: docs/control-plane verification passes for this active plan. Run again if checklist/current architecture docs change during later closeout.

Required closeout source audits before any FCP-22 closeout/unblocking claim:

1. Current-channel persistence audit:
   - `rg -n "persistCurrentChannelId|BestEffort|best-effort|transactional|strict|current channel|current-channel|persistenceWarning|Failed to persist current channel|Failed to persist channels" src/modules/scheduler/channel-manager src/core/orchestrator/storage src/__tests__`
   - Expected: current-channel pointer persistence remains explicitly best-effort; public switch behavior remains non-throwing on pointer storage failure; key/schema formats remain unchanged; warning behavior matches existing tests.
2. Content owner audit:
   - `rg -n "new SourceResolutionCache|new ContentItemMapper|new ContentSelectionPolicy|_sourceCache|_mapper|_selectionPolicy|_showCacheByLibraryId|applyFilters|applySort|applyPlaybackMode|resolveSource\\(|invalidateSource\\(|clearCaches\\(" src/modules/scheduler/channel-manager src/modules/scheduler/scheduler src/core src/modules/ui/epg src/modules/ui/mini-guide`
   - Expected: source cache/coalescing, mapping/normalization, selection policy, source-resolution entrypoint, TV show-list cache fallback, ChannelManager duration filtering, empty-content taxonomy, cache fallback, access-denied invalidation, retry/cache coordination, and resolved-content cache ownership all have one source-justified final owner.
3. Playback-ordering audit:
   - `rg -n "applyPlaybackMode|applyBlockPlaybackMode|shuffleWithSeed|SchedulerPlaybackMode|PlaybackMode|scheduledIndex|blockSize|applyPlaybackOrdering" src/modules/scheduler/channel-manager src/modules/scheduler/scheduler src/modules/scheduler/shared`
   - Expected: `playbackOrdering.ts` remains the shared sequential/shuffle/block ordering and scheduled-index normalization owner; random mode remains content-selection-local; scheduler-specific injected shuffler wiring remains in `ScheduleCalculator`.
4. Public export/import audit:
   - `rg -n "scheduler/channel-manager/(ContentResolver|SourceResolutionCache|ContentItemMapper|ContentSelectionPolicy|ChannelResolutionCache|ChannelManager)|from './ContentResolver'|from './ContentSelectionPolicy'|from '../shared|from './SourceResolutionCache'|from './ContentItemMapper'" src/modules/scheduler src/core src/modules/ui`
   - Expected: no public export widening, no compatibility shims, no old-path wrappers, and no UI/Plex/orchestrator import churn outside established public seams.
5. Storage key/schema audit:
   - `rg -n "localStorage|safeLocalStorage|lineup_channels|lineup_current_channel|STORAGE_KEY|CURRENT_CHANNEL_KEY|CHANNELS_SERVER|CURRENT_CHANNEL" src/modules/scheduler/channel-manager src/core/orchestrator/storage src/config/storageKeys.ts`
   - Expected: raw storage remains in `ChannelPersistenceStore` plus canonical key/config owners; key strings and scoped formats remain unchanged.

Required closeout tests and gates before any FCP-22 closeout/unblocking claim:

1. `npm test -- ChannelPersistenceStore ChannelRepository ChannelManager.persistence ChannelManager.transactional ChannelPersistenceSaveQueue`
2. `npm test -- ContentResolver ScheduleCalculator ChannelManager.content-resolution`
3. `npm test -- ChannelManager.error-semantics ChannelResolutionCache`
4. `npm run typecheck`
5. `git diff --check`
6. `npm run verify`

Expected: all pass before any FCP-22 closeout claim, because this package gates runtime scheduler/channel-manager confidence even when no source edits are made. If any targeted test or `npm run verify` fails, FCP-22 remains blocked and the controller must route the failure before FCP-23 can start.

## Rollback Notes

Rollback for this planner pass is docs-only: remove or revise this active replan file. Do not revert unrelated dirty/untracked paths.

If plan review finds the no-production-change owner-shape conclusion wrong, refresh this plan before source edits. If later closeout docs are wrong, revert only the FCP-22 closeout doc changes and rerun `npm run plans:check` plus the applicable docs verifier.

## Commit Checkpoints

- Planning artifact checkpoint: commit only `docs/plans/2026-05-05-fcp-22-port-scheduler-channel-content-owner-shape-replan.md` if the controller wants a tracked-doc checkpoint.
- No implementation checkpoint is approved unless a reviewed replan admits source/test changes.
- Closeout checkpoint, later controller only: after plan validation, clean plan review, source audits, and any chosen verification pass, update `ARCHITECTURE_CLEANUP_CHECKLIST.md` and any required architecture docs in a focused docs/control-plane commit. Do not bundle active FCP-23 draft state or unrelated dirty files.

## Package Decomposition

- `package_id`: `FCP-22`
- `checklist_token`: `FCP-22`
- `source_finding_ids`:
  - `FCP-22-SF1`
  - `FCP-22-SF2`
  - `FCP-22-SF3`
  - `FCP-22-SF4`

`slice_table`:

| slice_id | goal | areas/files | source_finding_ids | verification | dependencies | stop_condition | handoff_condition | serial_only | parallel_justification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FCP-22-S1` | Source-disprove current-channel persistence residuals under the owner-shape gate by proving best-effort semantics, key/schema preservation, and warning ownership remain correct. | Read-only audit over `ChannelPersistenceStore.ts`, `ChannelRepository.ts`, `ChannelPersistenceCoordinator.ts`, `ChannelPersistenceSaveQueue.ts`, `ChannelManager.ts`, `OrchestratorStorageContext.ts`, `storageKeys.ts`, constants, and persistence tests. | `FCP-22-SF1` | Current-channel persistence `rg` audit; storage key/schema audit; required closeout persistence tests/gates. | None; this is the first slice in ready-now `FCP-22-W1`. | Stop if strict/best-effort ambiguity, schema/key drift, warning drift, or uncovered public failure behavior is found. | `FCP-22-SF1` is source-disproved/no-code with owner-shape gate satisfied, or the plan is refreshed with an implementation wave. | true | All FCP-22 findings share the same owner-shape proof and closeout accounting. |
| `FCP-22-S2` | Source-disprove ChannelManager facade-local residuals under the owner-shape gate while preserving the public facade. | Read-only audit over `ChannelManager.ts`, package-local collaborators, public exports, and facade tests. | `FCP-22-SF2` | ChannelManager owner-concentration audit; public export/import audit; required closeout facade/content tests. | S1 audit complete so persistence residue does not masquerade as facade residue. | Stop if a distinct FCP-22-owned facade concentration blocks port reasoning or requires public API changes. | `FCP-22-SF2` is source-disproved/no-code with final owner `ChannelManager` as public facade delegating to package-local owners, or the plan is refreshed. | true | Facade reads overlap S1/S3 and need one final owner decision. |
| `FCP-22-S3` | Source-disprove remaining ContentResolver/content-owner residuals under the owner-shape gate after the partial playback-ordering fix, including retained responsibilities that must be source-justified rather than hidden as delegated. | Read-only audit over `ContentResolver.ts`, `SourceResolutionCache.ts`, `ContentItemMapper.ts`, `ContentSelectionPolicy.ts`, `ChannelManager.ts`, `ChannelResolutionCache.ts`, `ChannelRetryScheduler.ts`, `playbackOrdering.ts`, `blockPlayback.ts`, `ScheduleCalculator.ts`, and content/scheduler tests. | `FCP-22-SF3` | Content owner audit; playback-ordering audit; retained-responsibility audit for `ContentResolver` show-list cache fallback and `ChannelManager` duration filtering, empty-content taxonomy, cache fallback, access-denied invalidation, and retry/cache coordination; required closeout tests/gates. | S1/S2 audits complete. | Stop if cache/coalescing, mapping, normalization, filtering, sorting, playback ordering, random mode, injected scheduler shuffler wiring, show-list cache fallback, duration filtering, empty-content taxonomy, cache fallback, access-denied invalidation, retry/cache coordination, or public content behavior lacks a correct owner. | `FCP-22-SF3` is source-disproved/no-code for remaining residue, with old playback-ordering residue recorded as already resolved by partial evidence and current source, and retained `ContentResolver`/`ChannelManager` responsibilities explicitly assigned final owners/revisit triggers. | true | Content owner proof overlaps facade and organization proof. |
| `FCP-22-S4` | Source-disprove standalone channel-manager organization under the owner-shape gate; keep any later behavior-neutral foldering with `FCP-24-SF3`. | Read-only path/import/export audit over scheduler channel-manager/shared paths and architecture docs. | `FCP-22-SF4` | Public export/import audit; no-shim/no-barrel/source path audit; docs verifier if closeout docs change. | After S3 proves no organization is required to fix owner shape. | Stop if current layout itself blocks FCP-22 owner reasoning, or if foldering needs shims/barrels/export widening. | `FCP-22-SF4` is source-disproved/no-code; later behavior-neutral foldering, if source-proven, remains final-owned by `FCP-24-SF3`. | true | Organization depends on S1-S3 owner proof and cannot run independently. |

`coverage_check`:

- `FCP-22-SF1` maps exactly once to `FCP-22-S1`. Planned disposition: source-disproved/no-code. Final owner: `ChannelPersistenceCoordinator` for manager-facing best-effort current-channel persistence, `ChannelPersistenceStore` for raw storage mechanics, and `ChannelRepository` for normalized load semantics. Revisit trigger: future source audit finds strict/best-effort ambiguity, key/schema drift, warning drift, or uncovered current-channel failure behavior.
- `FCP-22-SF2` maps exactly once to `FCP-22-S2`. Planned disposition: source-disproved/no-code. Final owner: `ChannelManager` public facade delegating to package-local collaborators and retaining public state/event/error/cache/retry coordination where the facade needs channel state and public behavior context. Revisit trigger: future port work proves a distinct facade-local concentration that blocks scheduler/channel reasoning while still staying inside the public facade seam.
- `FCP-22-SF3` maps exactly once to `FCP-22-S3`. Planned disposition: source-disproved/no-code for remaining residue, with prior playback-ordering residue treated as resolved partial evidence and confirmed by current source. Final owners: `SourceResolutionCache` for generic source cache/coalescing; `ContentResolver` for source-resolution orchestration and TV show-list cache TTL/stale fallback; `ContentItemMapper` for mapping/media normalization; `ContentSelectionPolicy` for filtering/sorting/random content playback policy; `src/modules/scheduler/shared/playbackOrdering.ts` for common sequential/shuffle/block ordering and scheduled-index normalization; `ScheduleCalculator` for scheduler-specific injected shuffler wiring; `ChannelManager` for duration filtering, source-empty versus filter-empty taxonomy, resolved-content cache fallback, access-denied invalidation, and retry/cache coordination at the public facade boundary; and `ChannelResolutionCache` for resolved channel-content clone/stale policy. Revisit trigger: source audit or tests prove behavior drift, missing owner, reusable retained policy, or need for broader scheduler/content redesign.
- `FCP-22-SF4` maps exactly once to `FCP-22-S4`. Planned disposition: source-disproved/no-code for standalone organization. Final owner: `FCP-24-SF3` for any later behavior-neutral channel-manager organization not naturally required by FCP-22 owner closure. Revisit trigger: post-FCP-23/FCP-24 audit proves channel-manager layout still blocks port reviewability.
- No source finding is deferred solely because a correct cleanup would be large.
- No detector/imported/package-map/raw review id maps into FCP-22 coverage.
- Replan is required before admitting a new `source_finding_id`, approving source edits, changing final-owner accounting, or splitting any finding across multiple execution units.

`execution_waves`:

| wave_id | slice_ids | completion_condition | absorb_now_scope | replan_triggers |
| --- | --- | --- | --- | --- |
| `FCP-22-W1` | `FCP-22-S1`, `FCP-22-S2`, `FCP-22-S3`, `FCP-22-S4` | Clean plan validation and review approve this no-production-change owner-shape conclusion; required source audits and targeted tests pass; strongest applicable verification `npm run verify` passes; closeout docs can record every FCP-22 source finding with one final owner and revisit trigger; no source/test edits are needed. | Read-only scheduler/channel-manager/content owner-shape residue inside the same source findings, same files, same final-owner accounting, and same verification envelope. | Any stop condition in the seam gate; any source/test edit need; changed package membership; FCP-16/FCP-17 baseline contradiction; public API/schema/Plex/UI behavior boundary; FCP-23/FCP-24/FCP-25 ownership overlap; failed targeted test or `npm run verify`. |

`coverage_ledger`:

| source_finding_id | execution_unit | planned disposition | final owner before closeout |
| --- | --- | --- | --- |
| `FCP-22-SF1` | `FCP-22-W1` / `FCP-22-S1` | Source-disproved/no-code. | `ChannelPersistenceCoordinator`, `ChannelPersistenceStore`, `ChannelRepository`. |
| `FCP-22-SF2` | `FCP-22-W1` / `FCP-22-S2` | Source-disproved/no-code. | `ChannelManager` public facade with package-local collaborators. |
| `FCP-22-SF3` | `FCP-22-W1` / `FCP-22-S3` | Source-disproved/no-code for remaining residue; prior playback-ordering residue resolved and current-source confirmed; retained responsibilities source-justified. | `SourceResolutionCache`, `ContentResolver`, `ContentItemMapper`, `ContentSelectionPolicy`, `playbackOrdering.ts`, `ScheduleCalculator`, `ChannelManager`, `ChannelResolutionCache`. |
| `FCP-22-SF4` | `FCP-22-W1` / `FCP-22-S4` | Source-disproved/no-code for standalone organization. | `FCP-24-SF3` for later behavior-neutral organization if source-proven. |

- `ready_now_slice`: `FCP-22-S1`
- `ready_now_execution_unit`: `FCP-22-W1`
- `recommended_slice_order`:
  1. `FCP-22-S1`
  2. `FCP-22-S2`
  3. `FCP-22-S3`
  4. `FCP-22-S4`
- `parallel_execution_policy`: serial only. The package is no-production-change owner-shape closure, and parallel workers would duplicate final-owner accounting while increasing the risk of accidentally opening FCP-23/FCP-24 work.

## Priority-Exit Readiness

This is an FCP-22-to-FCP-23 sequencing gate, not the final FCP program gate. `FCP-25` remains the final port gate. This section exists because FCP-22 currently blocks FCP-23 and the closeout record must prove no scheduler/channel-manager/content residual is left ambiguous before UI workflow planning resumes.

Source-finding readiness:

| source_finding_id | closeout-ready disposition expected from this plan | final owner | residual/revisit trigger |
| --- | --- | --- | --- |
| `FCP-22-SF1` | Source-disproved/no-code if required audits/tests still prove best-effort current-channel pointer persistence, key/schema preservation, and warning behavior. | `ChannelPersistenceCoordinator`, `ChannelPersistenceStore`, `ChannelRepository`. | Revisit if current-channel semantics become strict/transactional, key/schema drift appears, or warning behavior is uncovered or inconsistent. |
| `FCP-22-SF2` | Source-disproved/no-code if required audits still prove `ChannelManager` is the correct public facade owner and no facade-local extraction is source-proven. | `ChannelManager` public facade with package-local collaborators. | Revisit if future port work proves a distinct facade-local concentration that blocks scheduler/channel reasoning while preserving public APIs. |
| `FCP-22-SF3` | Source-disproved/no-code for remaining residue, with prior playback-ordering residue already resolved and retained `ContentResolver`/`ChannelManager` responsibilities explicitly source-justified. | `SourceResolutionCache`, `ContentResolver`, `ContentItemMapper`, `ContentSelectionPolicy`, `playbackOrdering.ts`, `ScheduleCalculator`, `ChannelManager`, `ChannelResolutionCache`. | Revisit if source audit or tests prove behavior drift, missing owner, reusable retained policy, or need for broader scheduler/content redesign. |
| `FCP-22-SF4` | Source-disproved/no-code for standalone organization. | `FCP-24-SF3` for later behavior-neutral channel-manager organization if source-proven. | Revisit only during FCP-24 after FCP-23 closeout, unless FCP-22 source audit proves current layout itself blocks owner-shape proof. |

FCP-23 may not start until all of these are true:

- `FCP-22-W1` receives clean plan/review closure for this revised artifact.
- Required FCP-22 source audits pass and are recorded in closeout evidence.
- Required targeted tests, `npm run typecheck`, `git diff --check`, and `npm run verify` pass before any closeout/unblocking claim.
- Any checklist/current architecture closeout update is made by the controller in the same pass that records evidence; this planning pass does not mark FCP-22 in progress or complete.
- No FCP-22 residual lacks one final owner and one revisit trigger.
- No source audit admits `FCP-23`, `FCP-24`, `FCP-25`, Windows, Plex, UI workflow, public API, or persistence schema work into FCP-22.

P0/security disposition: no active P0/security finding is part of FCP-22 source-backed coverage. If validation or review finds a security issue in the scheduler/channel-manager/content owner area, FCP-22 closeout and FCP-23 unblocking must stop until the controller routes that issue to the correct security/remediation owner with maintainer approval.
