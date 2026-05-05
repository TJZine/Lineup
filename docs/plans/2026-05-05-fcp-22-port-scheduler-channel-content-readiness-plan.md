**Plan Status:** completed
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

# FCP-22 Port Scheduler, Channel, And Content Readiness Plan

## Goal

Retire `ARCHITECTURE_CLEANUP_CHECKLIST.md` item `FCP-22` by closing the source-backed scheduler/channel-manager/content-readiness findings that remain after completed `FCP-16` and `FCP-17` baseline evidence.

This is an FCP source-backed checklist package. Coverage is defined only by `source_finding_id` values `FCP-22-SF1`, `FCP-22-SF2`, `FCP-22-SF3`, and `FCP-22-SF4`. Do not use Desloppify output, detector ids, imported review ids, package-map ids, raw review observations, score deltas, or historical hotspot wording as intake, proof, or closeout evidence.

Current-source audit admits one behavior-preserving implementation slice:

- `FCP-22-SF3`: cache, in-flight, mapping, normalization, filtering, and sorting residue is source-disproved after completed `FCP-17`, but playback-ordering residue remains because `ContentSelectionPolicy.applyPlaybackMode(...)` and `ScheduleCalculator.applyPlaybackMode(...)` duplicate sequential/shuffle/block ordering shape while already sharing `applyBlockPlaybackMode(...)`. The approved final owner for that common playback-ordering residue is a scheduler-shared helper at `src/modules/scheduler/shared/playbackOrdering.ts`.

Current-source audit source-disproves production implementation for:

- `FCP-22-SF1`: current-channel persistence semantics are explicitly best-effort at the public `ChannelManager` paths and are directly covered by persistence tests.
- `FCP-22-SF2`: the public `ChannelManager` facade remains broad but current source already delegates the FCP-22-relevant persistence, import/export, authoring, retry, source-resolution, resolved-content cache, mapping, and selection owners to package-local collaborators; no distinct facade-local owner extraction is source-proven for this package beyond the playback-ordering seam in `FCP-22-SF3`.
- `FCP-22-SF4`: channel-manager folder/package organization is not approved as standalone churn. It may only happen if the approved playback-ordering cleanup naturally requires it; otherwise the final owner for any later behavior-neutral organization question is `FCP-24-SF3`.

Completion means every `FCP-22-SF*` is resolved, source-disproved, or accepted with one owner and revisit trigger; the public `ChannelManager` facade remains stable; persistence keys/schema and current-channel behavior remain unchanged; scheduler/channel common sequential/shuffle/block ordering and scheduled-index normalization are owned by `src/modules/scheduler/shared/playbackOrdering.ts`; and `FCP-23` through `FCP-25`, Windows work, and broader post-FCP cleanup remain blocked until clean FCP-22 closeout evidence exists.

## Non-Goals

- Do not implement production or test code from this planning pass.
- Do not update `ARCHITECTURE_CLEANUP_CHECKLIST.md` status, ready-now fields, mini-records, or checkboxes from this planning pass.
- Do not start or plan `FCP-23`, `FCP-24`, `FCP-25`, Windows platform implementation, or other post-FCP cleanup.
- Do not reopen completed `FCP-16` or `FCP-17` unless fresh current-source audit proves their closeout evidence is false.
- Do not remove the public `ChannelManager` facade, widen public channel APIs, add compatibility shims, add root/package barrels, or expose cache/mapping/order internals to external callers.
- Do not change persistence keys, server/user key formats, localStorage schema, `StoredChannelData` wire shape, current-channel best-effort behavior, or persistence warning semantics.
- Do not change Plex auth/runtime/playback behavior owned by `FCP-21`, channel setup/EPG/navigation/UI workflow behavior owned by `FCP-23`, behavior-neutral foldering owned by `FCP-24`, or final gate evidence owned by `FCP-25`.
- Do not change content filtering, sorting, random playback behavior, source cache/coalescing behavior, mapping/media normalization, source-empty versus filter-empty errors, stale-cache fallback, access-denied invalidation, schedule timing, EPG behavior, mini-guide behavior, channel-tuning behavior, or platform behavior without a stopped/replanned maintainer-approved plan.

## Parent Priority Alignment

`FCP-22` is the next safe package after completed `FCP-21`. The checklist blocks `FCP-23` through `FCP-25`, Windows work, and other post-FCP cleanup until `FCP-22` has clean closeout evidence.

Current architecture places scheduler/channel-domain persistence and content readiness under `src/modules/scheduler/channel-manager/**`, with `src/core/orchestrator/storage/OrchestratorStorageContext.ts` configuring server/user-scoped channel keys. `ChannelManager.ts` remains the public channel-domain API/state facade. Package-local collaborators own focused responsibilities: `ChannelPersistenceStore`, `ChannelRepository`, `ChannelPersistenceCoordinator`, `ChannelPersistenceSaveQueue`, `ChannelAuthoringService`, `ChannelImportExportService`, `ChannelResolutionCache`, `ChannelRetryScheduler`, `ContentResolver`, `SourceResolutionCache`, `ContentItemMapper`, and `ContentSelectionPolicy`.

The approved FCP-22 seam is port-readiness cleanup inside scheduler/channel-manager and directly required scheduler ordering helpers only. This plan does not authorize broad scheduler redesign, public API reshaping, UI workflow work, Plex behavior changes, or foldering-only reorganization.

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
   - completed `FCP-13` through `FCP-21`
   - `FCP-22`
   - `FCP-23` through `FCP-25` only for sequencing blockers and out-of-scope routing
8. `docs/architecture/CURRENT_STATE.md`
9. `docs/architecture/modules.md`
10. Completed guardrail plans:
   - `docs/plans/2026-05-05-fcp-16-scheduler-current-channel-channelmanager-persistence-semantics-plan.md`
   - `docs/plans/2026-05-05-fcp-17-contentresolver-cache-coalescing-mapping-boundaries-plan.md`
   - `docs/plans/2026-05-05-fcp-20-pre-windows-cleanup-exit-source-reconciliation-plan.md`
   - `docs/plans/2026-05-05-fcp-21-port-runtime-playback-plex-auth-readiness-plan.md`
11. Completed `FCP-7` through `FCP-15` and `FCP-18`/`FCP-19` plans only if current source contradicts the compact checklist baseline.
12. This plan.
13. Source and test files named under `## Files In Scope`.
14. `git status --short --branch`.

Freshness gate: stop and refresh this plan if any `FCP-22` checklist text, scheduler/channel-manager architecture ownership text, source files in scope, tests in scope, or public scheduler/channel playback-ordering contract text changed materially after 2026-05-05.

Planning observed branch `code-health...origin/code-health [ahead 4]` with unrelated dirty/untracked paths: `docs/archive/plans/2026-04-30-dcr-10-oversized-test-suite-structure.md`, `docs/plans/2026-04-30-dcr-exit-final-dimension-audit-plan.md`, `scorecard.png`, and `docs/agentic/evals/baseline-summaries/2026-04-28-prompt-13-feature-low-implementer-policy.md`. Preserve those paths unless a fresh source audit proves direct FCP-22 overlap.

## Required Skills

- `architecture-boundaries`: required because this plan touches the public `ChannelManager` facade, scheduler/channel-manager package-local ownership, and a shared scheduler ordering helper seam.
- `persistence-boundaries`: required because FCP-22 audits current-channel and channel-domain local persistence ownership, keys, and failure semantics.
- `verification-strategy`: required to freeze proof depth for behavior-preserving scheduler/content ordering cleanup without forcing brittle private probes.
- `execution-plan-authoring`: required for Tier 3 source-backed FCP package planning.

Do not load `debugging-remediation` unless execution proves a concrete bug/regression. Do not load `plex-integration-boundaries` unless a fresh audit proves `ContentResolver` or mapper cleanup implicates Plex request/metadata contracts; that should normally stop and replan. Do not load `ui-composition-patterns` unless implementation crosses into channel setup, EPG, navigation, focus, or UI workflow work; that should normally stop because `FCP-23` owns those surfaces.

## Codanna Discovery

- `get_index_info`: Codanna index contained 12,118 symbols across 802 files and 14,440 relationships. Semantic search was enabled with `JinaEmbeddingsV2BaseCode`, 337 embeddings, created/updated 34 minutes before planning.
- `search_documents`: required anchored searches for FCP-22 checklist/source-finding context, FCP-16/FCP-17/FCP-20/FCP-21 baselines, current architecture docs, and FCP-23/FCP-25 sequencing blockers were noisy and returned unrelated DCR, user-guide, historical-plan, or playbook hits. Deterministic fallback was required and used: direct reads of `ARCHITECTURE_CLEANUP_CHECKLIST.md`, current architecture docs, and completed FCP plans.
- `semantic_search_with_context "current-channel persistence ChannelPersistenceStore current channel best effort strict ChannelPersistenceCoordinator"`: found `persistCurrentChannelIdBestEffort` at `ChannelPersistenceCoordinator.ts` symbol_id `2769`, `CURRENT_CHANNEL_KEY`, and `ChannelManagerState`. This confirmed the current-channel best-effort seam.
- `semantic_search_with_context "ChannelManager facade seams channel-manager persistence coordinator content resolver public API facade"`: found `resolveChannelItemsForSchedule`, `resolveChannelContent`, and `ChannelManagerState`, confirming public facade content-resolution call paths but not enough to prove all facade ownership; direct source reads were required.
- `semantic_search_with_context` for `ChannelPersistenceStore`, `ChannelPersistenceCoordinator`, and `ChannelPersistenceSaveQueue`: found key persistence and save/warning symbols, but `ChannelPersistenceStore` and save queue searches still needed source reads for exact warning/failure wording.
- `semantic_search_with_context` for `ContentResolver`, `SourceResolutionCache`, `ContentItemMapper`, `ContentSelectionPolicy`, and `ChannelResolutionCache`: found `ContentResolver`, `resolveSource`, `applyPlaybackMode`, and related type anchors. `SourceResolutionCache`, mapper, and selection-policy reverse impact was weak/noisy, so direct source reads and `rg` audits are authoritative for their current responsibilities.
- `semantic_search_with_context "OrchestratorStorageContext channel manager storage keys current channel server user scoped keys"`: weak result set; direct read of `OrchestratorStorageContext.ts` is authoritative for server/user-scoped key context.
- `find_symbol` / `analyze_impact` snapshots:
  - `ChannelManager` symbol_id `2801`: `analyze_impact` returned no impacted symbols, which is insufficient for a public facade; direct `rg`/source reads prove callers through channel tuning, EPG, mini-guide, and tests.
  - `ChannelPersistenceStore` symbol_id `2268`: impacts `ChannelRepository`, `ChannelPersistenceCoordinator`, and a `ChannelRepository.test.ts` helper.
  - `ChannelPersistenceCoordinator` symbol_id `2752`: impacts `ChannelManager`.
  - `ChannelPersistenceSaveQueue` symbol_id `2599`: impacts `ChannelManager` and `ChannelPersistenceCoordinator`.
  - current-channel methods: `persistCurrentChannelIdBestEffort` symbol_id `2769` impacts `setCurrentChannel`, `replaceAllChannels`, and `ChannelTuningCoordinator._runSingleSwitch`; `_persistCurrentChannelId` symbol_id `2775` impacts the same manager paths; `writeCurrentChannelId` symbol_id `2284` impacts `ChannelRepository.saveCurrentChannelId` and `_persistCurrentChannelId`; `readCurrentChannelId` symbol_id `2281` impacts `ChannelRepository.loadNormalized`; `setCurrentChannel` symbol_id `2848` impacts `ChannelTuningCoordinator._runSingleSwitch` and `_drainSwitchQueue`.
  - `ContentResolver` symbol_id `2493`: impacts `ChannelManager`.
  - `SourceResolutionCache` symbol_id `2663`, `ContentItemMapper` symbol_id `2563`, and `ContentSelectionPolicy` symbol_id `2702`: impact analysis returned no affected symbols, which is a Codanna reverse-impact gap because direct source reads prove `ContentResolver` constructs them.
  - `ChannelResolutionCache` symbol_id `2204`: impacts `ChannelManager`.
  - `OrchestratorStorageContext` symbol_id `9367`: impacts `AppOrchestrator`.
  - public/shared ordering symbols admitted by this plan: `ContentSelectionPolicy.applyPlaybackMode` symbol_id `2706` impacts `ChannelManager._createResolvedContent` and authoring/content paths; `ScheduleCalculator.applyPlaybackMode` symbol_id `2965` impacts `buildScheduleIndex`, `ChannelScheduler.loadChannel`, EPG schedule refresh, and mini-guide row building; `applyBlockPlaybackMode` symbol_id `2924` impacts both content-selection and schedule-calculation ordering paths; `shuffleWithSeed` symbol_id `2718` impacts both scheduler/channel ordering users and `ShuffleGenerator`.
- `rg` / direct source reads covered `src/modules/scheduler/channel-manager/**`, targeted scheduler calculation files, `src/core/orchestrator/storage/OrchestratorStorageContext.ts`, current-channel persistence/warning patterns, ContentResolver owner patterns, selection/playback-ordering patterns, package imports/exports, and affected tests.

## Impact Snapshot

Current-source proof at plan time:

- `ChannelPersistenceStore` owns raw storage mechanics for channel payload and current-channel key reads/writes. It trims current-channel ids, rewrites normalized reads, removes empty current-channel values, and returns safe mutation results instead of throwing.
- `ChannelRepository.loadNormalized()` reads the channel payload and separate current-channel key together, accepts the separate key only when it points at an existing channel, and does not rewrite channel data when only the separate current-channel key changes the selected current channel.
- `ChannelPersistenceCoordinator` exposes only `persistCurrentChannelIdBestEffort(...)` for separate current-channel pointer persistence. It documents that the caller's state transition is not transactional on localStorage availability, logs `Failed to persist current channel`, emits persistence warnings through `ChannelPersistenceSaveQueue`, and swallows current-channel write failures.
- `ChannelManager.setCurrentChannel(...)` validates the channel, updates in-memory `currentChannelId`, calls `persistCurrentChannelIdBestEffort(...)`, and emits `channelSwitch`. `replaceAllChannels(...)` persists the full channel payload transactionally before replacing state, then best-effort persists the separate current-channel pointer after state replacement.
- Existing persistence tests cover current-channel writes, repository routing, quota/unavailable warning payloads, public best-effort switch behavior, warning throttling reset after successful current-channel save, separate current-channel key load precedence, storage-key scoping, and transactional `replaceAllChannels` behavior. `FCP-22-SF1` is source-disproved for production edits at planning time.
- `OrchestratorStorageContext.configureChannelManagerStorageForSelectedServer()` still constructs selected-server and active-user scoped keys with `lineup_channels_server_v1:${serverId}[:${userId}]` and `lineup_current_channel_v4:${serverId}[:${userId}]`; no schema/key migration is source-proven.
- `ChannelManager` remains the public channel-domain facade and still owns public state transitions, event emission, cache fallback classification, retry scheduling handoff, and facade call-site wiring. For FCP-22-relevant concerns, current source already delegates persistence, authoring, import/export, retry timers, source-level cache/coalescing, mapping/normalization, filtering/sorting/playback-ordering policy, and resolved-content clone/stale policy to package-local collaborators. `FCP-22-SF2` is source-disproved for standalone facade extraction at planning time.
- `ContentResolver` remains the package-local source-resolution orchestration entrypoint. It delegates source-result cache/in-flight coalescing to `SourceResolutionCache`, Plex item mapping/media normalization to `ContentItemMapper`, and filtering/sorting/playback ordering to `ContentSelectionPolicy`.
- `SourceResolutionCache` owns source-result cache TTL/LRU, epoch/generation invalidation, stable source serialization, in-flight waiter coalescing, shared abort lifecycle, clone-on-read/write, source invalidation, and mixed-source recursive invalidation.
- `ContentItemMapper` owns Plex item to `ResolvedContentItem` mapping, full-title building, parent episode decoration, mediaInfo resolution/HDR/Dolby Vision/audio normalization, watched, addedAt, art/logo/show metadata, and optional arrays.
- `ContentSelectionPolicy` owns filtering, sorting, and content-level playback ordering. It delegates block grouping to `src/modules/scheduler/shared/blockPlayback.ts` and seeded shuffle to `src/modules/scheduler/shared/prng.ts`.
- `ScheduleCalculator.applyPlaybackMode(...)` separately implements scheduler-level sequential/shuffle/block ordering for schedule indexes, using an injected `IShuffleGenerator` and the same shared block helper. This is the only source-proven `FCP-22-SF3` live residue: playback-ordering policy is split in a way that makes port reasoning more expensive even though the two paths already share types and block-order logic. The approved final owner is `src/modules/scheduler/shared/playbackOrdering.ts`, which should own common sequential ordering, seeded shuffle ordering through an injected shuffle callback, block ordering delegation to `applyBlockPlaybackMode(...)`, block-size normalization, and scheduled-index normalization. `ContentSelectionPolicy` remains the owner of channel-manager random playback mode, and `ScheduleCalculator` remains the owner of scheduler-specific injected `IShuffleGenerator` wiring.
- `ChannelResolutionCache` separately owns resolved channel-content clone/stale policy for `ChannelManager`; it is not the source-result cache owner and should not be merged with `SourceResolutionCache` under this plan.
- `src/modules/scheduler/channel-manager/index.ts` still exports the public `ChannelManager`, `ChannelError`, `ContentResolver`, public interfaces/types, and constants. This plan does not authorize public export widening or removal.

## Files In Scope

- `src/modules/scheduler/channel-manager/ContentSelectionPolicy.ts`
- `src/modules/scheduler/channel-manager/ContentResolver.ts` only for public delegating method preservation or import alignment if the ordering helper seam changes.
- `src/modules/scheduler/channel-manager/ChannelManager.ts` only for behavior-preservation audits and narrow ordering call-site proof; no public API widening or facade removal.
- `src/modules/scheduler/shared/blockPlayback.ts` only if the approved ordering cleanup can reuse or slightly generalize the existing shared ordering owner without changing behavior.
- `src/modules/scheduler/shared/playbackOrdering.ts` as the approved final owner for common sequential/shuffle/block playback ordering and scheduled-index normalization.
- `src/modules/scheduler/scheduler/ScheduleCalculator.ts`
- `src/modules/scheduler/scheduler/types.ts` only if type import alignment is needed without changing public scheduler types.
- `src/modules/scheduler/scheduler/ShuffleGenerator.ts` and `src/modules/scheduler/shared/prng.ts` read-only unless a stopped/replanned audit proves ordering cleanup must touch them; default plan expects no production change there.
- `src/modules/scheduler/channel-manager/ChannelPersistenceStore.ts`, `ChannelRepository.ts`, `ChannelPersistenceCoordinator.ts`, `ChannelPersistenceSaveQueue.ts`, `ChannelResolutionCache.ts`, `SourceResolutionCache.ts`, `ContentItemMapper.ts`, and `src/core/orchestrator/storage/OrchestratorStorageContext.ts` for read-only source audit and closeout proof only.
- Targeted tests:
  - `src/modules/scheduler/channel-manager/__tests__/ContentResolver.test.ts`
  - `src/modules/scheduler/scheduler/__tests__/ScheduleCalculator.test.ts`
  - `src/modules/scheduler/channel-manager/__tests__/ChannelManager.content-resolution.test.ts`
  - `src/modules/scheduler/channel-manager/__tests__/ChannelManager.error-semantics.test.ts` only if error/fallback behavior is touched or suspicious.
  - `src/modules/scheduler/channel-manager/__tests__/ChannelManager.persistence.test.ts`, `ChannelManager.transactional.test.ts`, `ChannelPersistenceStore.test.ts`, `ChannelRepository.test.ts`, `ChannelPersistenceSaveQueue.test.ts`, `ChannelResolutionCache.test.ts`, and `ContentResolver.test.ts` as audit/proof surfaces for no-code dispositions or if touched by import alignment.
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` only during future package closeout after clean implementation review and verification.
- `docs/architecture/CURRENT_STATE.md` and `docs/architecture/modules.md` only if implementation source audit proves current ownership truth changed.

## Files Out Of Scope

- Any production or test file not named in `## Files In Scope`.
- Public `IChannelManager` widening, public facade removal, public `ContentResolver` behavior changes, channel API reshaping, root/package barrels, compatibility re-exports, foldering-only reorganization, and import churn unrelated to the approved ordering seam.
- Persistence key/schema migrations, server/user key format changes, `StoredChannelData` wire-shape changes, current-channel strict/transactional behavior changes, or persistence warning behavior changes.
- Plex auth/discovery/library/stream behavior, player/runtime/playback behavior outside scheduler ordering data, channel setup, EPG UI workflow, mini-guide UI behavior, navigation/focus behavior, app-shell/orchestrator composition changes, lifecycle/settings persistence changes, and Windows platform work.
- Completed `FCP-16` and `FCP-17` implementation work except as read-only guardrails.
- Standalone channel-manager package organization. If behavior-neutral foldering remains valuable after FCP-22, it belongs to `FCP-24-SF3`.
- Pre-existing unrelated dirty/untracked workspace paths listed under `## Required Reading`.

## Planner Self-Check

1. Package membership is explicit: `FCP-22-SF1` maps to `FCP-22-S1`, `FCP-22-SF2` maps to `FCP-22-S2`, `FCP-22-SF3` maps to `FCP-22-S3`, and `FCP-22-SF4` maps to `FCP-22-S4`.
2. Adjacent contracts are explicit: persistence keys/schema, public channel APIs, ContentResolver public behavior, scheduler public types, Plex behavior, UI behavior, and Windows behavior are frozen unless a stop/replan condition fires.
3. Files out of scope are not hidden dependencies. EPG/mini-guide/channel-tuning are impacted callers for scheduler ordering and are covered by full verification/source audit, but this plan does not authorize UI workflow or caller behavior edits.
4. Codanna evidence and insufficiencies are recorded, including noisy document search, weak facade reverse impact, and weak moved-collaborator reverse impact, with direct `rg`/source-read fallback.
5. The plan uses repo-preferred owners: persistence stays behind channel persistence owners; source-resolution cache/mapping/selection stays package-local; common playback ordering belongs in `src/modules/scheduler/shared/playbackOrdering.ts` rather than inside UI, Plex, orchestration callers, or duplicated channel-manager/scheduler implementations.
6. A fresh cleanup-loop session can start `ready_now_execution_unit` `FCP-22-W1` without deciding package membership, final-owner accounting, parallelism, or verification depth; `FCP-22-SF3` already names `src/modules/scheduler/shared/playbackOrdering.ts` as the approved final owner for the active common playback-ordering residue.
7. This is execution-grade at seam/scope/verification level and leaves ordinary helper naming, exact private type names, and local extraction mechanics to the cleanup worker.

## Architecture Seam Decision Gate

Approved execution seam:

- Execute one serial wave, `FCP-22-W1`, covering `FCP-22-S1` through `FCP-22-S4`.
- `FCP-22-S1` is source-disproved/no-code unless a fresh audit contradicts the current evidence. The worker must rerun current-channel persistence source audits and targeted persistence tests before recording closeout, but no production persistence change is approved by default.
- `FCP-22-S2` is source-disproved/no-code unless a fresh audit proves a facade-local responsibility concentration distinct from completed FCP-16/FCP-17 and distinct from the approved playback-ordering seam. The public `ChannelManager` facade must remain.
- `FCP-22-S3` is the only approved implementation slice. It must make `src/modules/scheduler/shared/playbackOrdering.ts` the final owner for common sequential/shuffle/block ordering shape, block-size normalization, `applyBlockPlaybackMode(...)` delegation, injected shuffle callback use, and scheduled-index normalization while preserving all current behavior. `ContentSelectionPolicy.applyPlaybackMode(...)` must keep owning channel-manager random playback mode and may delegate sequential/shuffle/block modes to the shared helper. `ScheduleCalculator.applyPlaybackMode(...)` must keep owning scheduler-specific `IShuffleGenerator` injection and may delegate sequential/shuffle/block modes to the shared helper through an adapter callback. This must not change `random` handling, injected scheduler shuffling, block grouping, scheduled-index normalization, public method signatures, or caller behavior.
- `FCP-22-S4` is source-disproved/no-code for standalone organization. Organization changes are allowed only when directly required by `FCP-22-S3` to add `src/modules/scheduler/shared/playbackOrdering.ts`; otherwise the final owner for later behavior-neutral channel-manager organization is `FCP-24-SF3`.

Stop and replan if:

- persistence schema/key migration, server/user key format changes, compatibility storage branches, current-channel strict/transactional behavior, or warning semantics changes become necessary;
- public `ChannelManager`, `IChannelManager`, `ContentResolver`, scheduler, or channel-manager package exports must widen, narrow, or add compatibility shims;
- playback ordering cleanup changes sequential, shuffle, random, block, scheduled-index, block-size normalization, injected `IShuffleGenerator`, seeded PRNG behavior, source-empty/filter-empty errors, cache fallback, schedule timing, EPG, mini-guide, or channel-tuning behavior;
- tests require private probing or test-only exports instead of public seam or package-local stable helper proof;
- source audit proves a live cache/coalescing, mapping, normalization, filtering, sorting, persistence, or facade-owner residual beyond the approved playback-ordering seam;
- source audit requires Plex, player runtime, channel setup, EPG UI workflow, navigation/focus, app-shell/orchestrator composition, package-foldering-only, or Windows work;
- completed FCP-16 or FCP-17 baseline evidence appears source-false;
- newly discovered residue changes package membership, execution-unit membership, final-owner accounting, owner seam, or verification surface.

Absorb-now rule: absorb only newly discovered residue that stays within `FCP-22-W1`'s approved goal, owners, files, verification envelope, and final-owner accounting. Record absorbed residue in implementation/review output. Replan for any new owner, wider verification, changed source-finding coverage, or changed execution-unit membership.

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
| `FCP-22-S1` | Source-disprove or reopen current-channel persistence residuals after FCP-16 by proving best-effort semantics, key/schema preservation, and warning behavior on current source. | Read-only audit by default over `ChannelPersistenceStore.ts`, `ChannelRepository.ts`, `ChannelPersistenceCoordinator.ts`, `ChannelPersistenceSaveQueue.ts`, `ChannelManager.ts`, `OrchestratorStorageContext.ts`, storage-key constants, and targeted persistence tests. | `FCP-22-SF1` | Source audit for best-effort wording and current-channel call paths; `rg` key/warning audit; `npm test -- ChannelPersistenceStore ChannelRepository ChannelManager.persistence ChannelManager.transactional ChannelPersistenceSaveQueue`; broader gates in this plan. | None; first slice in wave. | Stop if strict-vs-best-effort ambiguity, storage warning drift, schema/key drift, or untested public failure behavior is found. | `FCP-22-SF1` is recorded as source-disproved/no-code, or the plan is refreshed if current source contradicts the planning audit. | true | Same package and same closeout proof as S2/S3/S4; parallel no-code audit would duplicate final-owner accounting. |
| `FCP-22-S2` | Source-disprove or reopen ChannelManager facade-local ownership cleanup after proving current collaborators already own the FCP-22-relevant responsibilities. | `ChannelManager.ts`; package-local collaborators named in current architecture; tests only if a fresh contradiction admits implementation. | `FCP-22-SF2` | Source audit for public facade retention, collaborator ownership, public export stability, and absence of distinct facade-local port blocker; targeted `ChannelManager`/content-resolution tests if touched. | Run after S1 audit so persistence findings do not masquerade as facade residuals. | Stop if a distinct facade-local owner extraction is source-proven and cannot fit inside current files/verification, or if public API changes are required. | `FCP-22-SF2` is recorded as source-disproved/no-code, or the plan is refreshed with a specific facade-local owner slice. | true | Facade ownership overlaps S1 and S3 source reads; serial review keeps one final owner. |
| `FCP-22-S3` | Resolve the live playback-ordering residue by moving common sequential/shuffle/block ordering and scheduled-index normalization ownership to `src/modules/scheduler/shared/playbackOrdering.ts` while preserving behavior. | `ContentSelectionPolicy.ts`; `ScheduleCalculator.ts`; new `playbackOrdering.ts`; `blockPlayback.ts`; `ContentResolver.ts`/`ChannelManager.ts` only for import/call preservation; targeted tests. | `FCP-22-SF3` | Pre/post source audit for cache/coalescing/mapping/filtering/sorting no-code proof plus playback-ordering cleanup; `npm test -- ContentResolver ScheduleCalculator ChannelManager.content-resolution`; add `ChannelManager.error-semantics` if fallback/error paths are touched; `npm run typecheck`; `git diff --check`; `npm run verify`. | S1 and S2 audits complete; execute before S4 final organization disposition. | Stop if ordering behavior changes, public APIs widen, random behavior or injected scheduler shuffling changes, `playbackOrdering.ts` cannot own the common behavior without mixing random/scheduler-specific policy, or cache/mapping/filter/sort residuals beyond playback ordering are found. | `playbackOrdering.ts` owns common sequential/shuffle/block ordering and scheduled-index normalization; `ContentSelectionPolicy` retains random mode; `ScheduleCalculator` retains injected shuffler wiring; cache/coalescing/mapping/filtering/sorting parts of `FCP-22-SF3` are recorded as source-disproved/no-code; current tests pass. | true | This is the only write slice and it shares affected tests/callers with the no-code audit slices, so no parallel implementation is approved. |
| `FCP-22-S4` | Close channel-manager package organization as no-code unless S3 naturally requires a shared helper placement; defer later behavior-neutral foldering to FCP-24-SF3. | `src/modules/scheduler/channel-manager/**` and `src/modules/scheduler/shared/**` import/path audit; docs only if ownership truth changes. | `FCP-22-SF4` | Old/new import audit if S3 creates or moves a helper; public export audit; no-barrel/no-shim audit; docs verification if architecture text changes. | After S3. | Stop if foldering-only organization is proposed, shims/barrels/export widening appear necessary, or organization needs a broader FCP-24-style package move. | `FCP-22-SF4` is recorded as source-disproved/no-code for standalone organization, or any S3-required organization is proven behavior-neutral and scoped to the ordering owner. | true | Organization depends on S3 outcome; parallel foldering would violate the package's no-churn rule. |

`coverage_check`:

- `FCP-22-SF1` maps exactly once to `FCP-22-S1`; planning disposition is source-disproved/no-code with final owner `ChannelPersistenceCoordinator` plus `ChannelPersistenceStore`/`ChannelRepository` for storage mechanics. Revisit trigger: future current-channel persistence source audit finds strict/best-effort ambiguity, schema/key drift, or uncovered warning behavior.
- `FCP-22-SF2` maps exactly once to `FCP-22-S2`; planning disposition is source-disproved/no-code with final owner `ChannelManager` as public facade delegating to current package-local collaborators. Revisit trigger: future port work proves a distinct facade-local responsibility concentration that blocks scheduler/channel reasoning without changing public APIs.
- `FCP-22-SF3` maps exactly once to `FCP-22-S3`; planning disposition is mixed. Cache, in-flight, mapping, normalization, filtering, and sorting residue is source-disproved/no-code with final owners `SourceResolutionCache`, `ContentItemMapper`, and `ContentSelectionPolicy`; playback-ordering residue remains active with final owner `src/modules/scheduler/shared/playbackOrdering.ts` for common sequential/shuffle/block ordering and scheduled-index normalization. `ContentSelectionPolicy` remains the final owner for random playback mode, and `ScheduleCalculator` remains the final owner for scheduler-specific injected `IShuffleGenerator` wiring. Revisit trigger: targeted ordering tests or source audit prove behavior drift, the shared helper cannot preserve both channel-manager and scheduler behavior without mixing random or scheduler-specific policy, or a broader scheduler redesign need appears.
- `FCP-22-SF4` maps exactly once to `FCP-22-S4`; planning disposition is no standalone organization. Final owner for any later behavior-neutral channel-manager organization is `FCP-24-SF3` unless S3 naturally requires a small helper placement. Revisit trigger: post-FCP-22/FCP-23 FCP-24 audit proves channel-manager layout still blocks port reviewability.
- No detector/imported/package-map/raw review id maps into FCP-22 coverage.
- Replan is required before admitting any new `source_finding_id`, splitting `FCP-22-SF3` into multiple final owners outside the approved S3 accounting, or assigning `FCP-22-SF4` to foldering-only work.

`execution_waves`:

| wave_id | slice_ids | completion_condition | absorb_now_scope | replan_triggers |
| --- | --- | --- | --- | --- |
| `FCP-22-W1` | `FCP-22-S1`, `FCP-22-S2`, `FCP-22-S3`, `FCP-22-S4` | Every FCP-22 source finding has a source-backed final disposition; `src/modules/scheduler/shared/playbackOrdering.ts` owns the common playback-ordering residue or the plan is refreshed before implementation continues; targeted tests, static audits, `npm run typecheck`, `git diff --check`, `npm run verify`, `npm run plans:check`, and docs verification as applicable pass; clean implementation review approves closeout before checklist updates. | Residue inside the same scheduler/channel-manager/content ordering owners, same files, same tests, same verification envelope, and same final-owner accounting, with `playbackOrdering.ts` as the fixed owner for common playback ordering. | Any stop condition in the seam gate; new persistence/public API/Plex/UI/Windows/package-foldering owner; wider verification surface; changed source-finding membership; FCP-16/FCP-17 baseline contradiction; inability to keep `playbackOrdering.ts` as the common ordering owner. |

`coverage_ledger`:

| source_finding_id | execution_unit | planned disposition | final owner before closeout |
| --- | --- | --- | --- |
| `FCP-22-SF1` | `FCP-22-W1` / `FCP-22-S1` | Source-disproved/no-code unless fresh audit contradicts. | `ChannelPersistenceCoordinator` plus `ChannelPersistenceStore`/`ChannelRepository` for storage mechanics. |
| `FCP-22-SF2` | `FCP-22-W1` / `FCP-22-S2` | Source-disproved/no-code unless fresh audit proves a distinct facade-local blocker. | `ChannelManager` public facade delegating to package-local collaborators. |
| `FCP-22-SF3` | `FCP-22-W1` / `FCP-22-S3` | Active for playback-ordering residue; source-disproved/no-code for cache, in-flight, mapping, normalization, filtering, and sorting residue. | `src/modules/scheduler/shared/playbackOrdering.ts` for common sequential/shuffle/block ordering and scheduled-index normalization; `ContentSelectionPolicy` for random playback mode; `ScheduleCalculator` for injected scheduler shuffler wiring; existing `SourceResolutionCache`, `ContentItemMapper`, and `ContentSelectionPolicy` for no-code parts. |
| `FCP-22-SF4` | `FCP-22-W1` / `FCP-22-S4` | No standalone organization; only S3-natural helper placement allowed. | `FCP-24-SF3` for later behavior-neutral organization unless S3 resolves helper placement locally. |

- `ready_now_slice`: `FCP-22-S1`
- `ready_now_execution_unit`: `FCP-22-W1`
- `recommended_slice_order`:
  1. `FCP-22-S1`
  2. `FCP-22-S2`
  3. `FCP-22-S3`
  4. `FCP-22-S4`
- `parallel_execution_policy`: serial only. The no-code audits and the one active ordering cleanup share source files, proof commands, and final-owner accounting. Parallel workers would increase duplicate coverage risk and could let S4 organization run before S3 proves whether any helper placement is needed.

## Verification Commands

Verification strategy classification: `existing coverage sufficient`.

Primary verification mode: `refactor-invariance`, supported by source audit. This is behavior-preserving port-readiness cleanup. Existing public-seam tests already cover current-channel persistence semantics, ContentResolver source/cache/mapping/filter/sort/playback behavior, and scheduler playback-ordering behavior. New automated tests are not required by default; add or tighten tests only if the worker changes an unprotected stable behavior seam or discovers an uncovered ordering invariant.

Plan validation:

1. `npm run plans:check`
   - Expected: active tracked plan structure passes, including FCP source-backed `source_finding_ids`, `coverage_check`, `ready_now_execution_unit`, execution wave, and coverage ledger.
2. `npm run verify:docs`
   - Expected: docs/control-plane verification passes for the active plan. Run again during package closeout if checklist/current-state/modules docs are updated.

Pre/post source audits for `FCP-22-W1`:

1. Current-channel persistence audit:
   - Run: `rg -n "persistCurrentChannelId|BestEffort|best-effort|transactional|strict|current channel|current-channel|persistenceWarning|Failed to persist current channel|Failed to persist channels" src/modules/scheduler/channel-manager src/core/orchestrator/storage src/__tests__`
   - Expected: current-channel separate pointer writes remain best-effort; public switch behavior remains non-throwing on current-channel storage failure; key/schema formats remain unchanged; warning behavior matches existing tests.
2. Content owner audit:
   - Run: `rg -n "new SourceResolutionCache|new ContentItemMapper|new ContentSelectionPolicy|_sourceCache|_mapper|_selectionPolicy|_showCacheByLibraryId|applyFilters|applySort|applyPlaybackMode|resolveSource\\(|invalidateSource\\(|clearCaches\\(" src/modules/scheduler/channel-manager src/modules/scheduler/scheduler src/core src/modules/ui/epg src/modules/ui/mini-guide`
   - Expected: cache/coalescing, mapping/normalization, and selection-policy owners remain focused and package-local; only playback-ordering residue is changed or explicitly accepted.
3. Playback-ordering audit:
   - Run: `rg -n "applyPlaybackMode|applyBlockPlaybackMode|shuffleWithSeed|SchedulerPlaybackMode|PlaybackMode|scheduledIndex|blockSize" src/modules/scheduler/channel-manager src/modules/scheduler/scheduler src/modules/scheduler/shared`
   - Expected: `src/modules/scheduler/shared/playbackOrdering.ts` owns common sequential/shuffle/block ordering and scheduled-index normalization after S3; sequential/shuffle/block behavior remains stable; random mode stays content-selection-only; scheduler-specific injected shuffler wiring stays in `ScheduleCalculator`.
4. Public export/import audit if files move or a helper is added:
   - Run: `rg -n "scheduler/channel-manager/(ContentResolver|SourceResolutionCache|ContentItemMapper|ContentSelectionPolicy|ChannelResolutionCache|ChannelManager)|from './ContentResolver'|from './ContentSelectionPolicy'|from '../shared" src/modules/scheduler src/core src/modules/ui`
   - Expected: no public export widening, no compatibility shims, no old-path wrappers, and no UI/Plex/orchestrator import churn outside approved call sites.

Focused tests:

1. `npm test -- ChannelPersistenceStore ChannelRepository ChannelManager.persistence ChannelManager.transactional ChannelPersistenceSaveQueue`
   - Expected: FCP-22-SF1 no-code proof remains true.
2. `npm test -- ContentResolver ScheduleCalculator ChannelManager.content-resolution`
   - Expected: source resolution, source-result cache/coalescing, mapping/media normalization, filtering/sorting/playback, schedule playback ordering, block ordering, scheduled-index normalization, and ChannelManager content-resolution behavior remain stable.
3. `npm test -- ChannelManager.error-semantics ChannelResolutionCache`
   - Expected if touched or suspicious: cache fallback, access-denied invalidation, stale-cache behavior, and resolved channel-content clone/stale policy remain stable.
4. `npm run typecheck`
   - Expected: no TypeScript errors after behavior-preserving owner/import changes.
5. `git diff --check`
   - Expected: no whitespace errors across the FCP-22 diff.
6. `npm run verify`
   - Expected: full repo verification passes before FCP-22 closeout because this package touches scheduler/channel-manager runtime behavior and impacted EPG/mini-guide/channel-tuning callers.

Package closeout:

- Source-finding proof matrix for every `FCP-22-SF*`, using only FCP source-backed ids.
- Package-local old/replacement audits for current-channel best-effort semantics, facade-local owner proof, cache/coalescing/mapping/selection ownership, `playbackOrdering.ts` common-ordering ownership, retained random/injected-shuffler owners, and no standalone organization.
- `npm run plans:check`
- `npm run verify:docs` if checklist/current-state/modules/plan docs are updated during closeout.
- `git diff --check`
- `npm run verify`
- Clean implementation/closeout review before `FCP-23` planning or implementation starts.

## Rollback Notes

- Roll back by execution unit: `FCP-22-W1` is the only approved wave. If S3 implementation fails behavior parity or review, revert the ordering-helper/import changes and keep the no-code source audit evidence for S1/S2/S4 available for a refreshed plan.
- If ordering consolidation changes sequential/shuffle/block/random/scheduled-index behavior, or if `playbackOrdering.ts` cannot stay the fixed common-ordering owner without absorbing random mode or scheduler-specific injected-shuffler policy, restore the previous `ContentSelectionPolicy` and `ScheduleCalculator` implementations before considering a new owner split.
- If persistence behavior changes accidentally, revert the persistence diff rather than adding compatibility migrations or warning adapters.
- If a helper placement creates import churn, public export widening, a shim, or foldering-only organization, revert the organization and replan under FCP-24 only if source-proven.
- If docs/checklist closeout fails after source/test changes are approved, leave reviewed production/test changes intact and fix tracked docs in a separate controller-owned closeout pass.

## Commit Checkpoints

- Planning artifact checkpoint: this active plan may be committed separately by the controller; do not bundle unrelated dirty/untracked files.
- Implementation checkpoint: after `FCP-22-W1` source/test changes, targeted tests, `npm run typecheck`, `git diff --check`, `npm run verify`, and clean implementation review pass, create one focused non-interactive implementation commit for production/test changes. Exclude active tracked plan docs unless the controller explicitly commits plan progress separately.
- Closeout checkpoint: after final verification and clean review, update `ARCHITECTURE_CLEANUP_CHECKLIST.md` and any required architecture docs in a separate tracked-doc closeout commit if the controller chooses to commit closeout docs.
- Do not mark `FCP-22` in progress or complete until the future controller observes closeout evidence and performs the checklist update in that same pass.
