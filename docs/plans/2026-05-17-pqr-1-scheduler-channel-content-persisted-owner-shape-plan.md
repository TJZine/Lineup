**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

# PQR-1 Scheduler Channel Content Persisted Owner Shape Plan

## Goal

Retire `ARCHITECTURE_CLEANUP_CHECKLIST.md` item `PQR-1` by turning the scheduler/channel-manager owner shape into current-source proof and one execution-ready implementation sequence.

Coverage is defined only by `source_finding_id` values `PQR-1-SF1` through `PQR-1-SF5`. Do not use Desloppify review ids, detector ids, imported issue ids, package-map ids, score deltas, or stale hotspot wording as package membership or proof.

Completion means:

- `ChannelManager` remains the stable public channel-domain facade.
- Package-local owners carry state-transition, content-resolution, and persistence responsibilities where current source proves a focused owner is needed.
- Persisted channel data is decoded through validated/defaulted runtime construction before any record is returned as `ChannelConfig`.
- Current-channel pointer persistence remains explicitly best-effort unless a stopped/replanned transactional requirement is approved.
- Package organization changes happen only when they improve reviewability without behavior churn, shims, wrapper barrels, or public API churn.

## Non-Goals

- Do not implement production or test code from this planning pass.
- Do not remove the public `ChannelManager` facade or widen public channel APIs.
- Do not change storage schema, storage keys, scoped key formats, or migration policy.
- Do not change Plex auth, discovery, library, stream, subtitle, or playback URL behavior; route that to `PQR-5`.
- Do not change UI, EPG, mini-guide presentation, focus, or navigation behavior; route that to `PQR-2`.
- Do not add compatibility shims, wrapper barrels, root barrels, subfolder barrels, private test probes, or test-only APIs.
- Do not perform Windows implementation work.

## Parent Priority Alignment

`PQR-1` is the next cleanup start for the refreshed source-backed cleanup track. It owns only `src/modules/scheduler/channel-manager/**`, affected scheduler/channel-manager tests, and architecture/API docs if public ownership/path truth changes.

Current architecture already names `ChannelManager` as the public channel-domain API/state facade, `ChannelPersistenceStore` as the channel-domain persistence owner, `ChannelRepository` as a thin normalization wrapper, `ChannelPersistenceCoordinator` as manager-facing persistence coordination, `ContentResolver` as the package-local source-resolution entrypoint, `SourceResolutionCache` as source-result cache/coalescing owner, `ContentItemMapper` as mapping/media normalization owner, `ContentSelectionPolicy` as filtering/sorting/content playback policy owner, `ChannelResolutionCache` as resolved-content clone/stale owner, and `ChannelRetryScheduler` as retry-timer owner.

The source audit finds one active persistence implementation seam before broader facade/content proof: `StoredChannelDataCodec` currently validates only the top-level persisted JSON shape, while `ChannelRepository.loadNormalized()` casts raw records to `ChannelConfig` before defaulting seeds, stripping legacy fields, validating content source, and normalizing numbers/order/current channel. `PQR-1` should fix that seam first because it is storage-backed, has narrow owners, and strengthens later owner-shape proof.

## Required Reading

Read in this order before implementation or review:

1. `docs/AGENTIC_DEV_WORKFLOW.md`
2. `agents.md`
3. `docs/agentic/codanna-playbook.md`
4. `docs/agentic/session-prompts/cleanup-loop.md`
5. `ARCHITECTURE_CLEANUP_CHECKLIST.md` section `PQR-1`
6. `docs/architecture/CURRENT_STATE.md`
7. `docs/architecture/modules.md`
8. `docs/agentic/plan-authoring-standard.md`
9. This plan
10. Source and test files named under `## Files In Scope`
11. `git status --short --branch`

Freshness gate: stop and refresh this plan if `PQR-1` checklist text, scheduler/channel-manager architecture truth, source files in scope, tests in scope, public channel API shape, storage key/schema text, or verifier source-finding rules changed materially after 2026-05-17.

Planning observed branch `code-health...origin/code-health [ahead 1]` with pre-existing dirty/untracked files including `ARCHITECTURE_CLEANUP_CHECKLIST.md`, `docs/architecture/README.md`, archived DCR plan docs, `scorecard.png`, and several untracked `docs/plans/*` artifacts. Preserve those paths unless a future controller explicitly opens them for PQR-1 closeout or verifier representation work.

## Required Skills

- `architecture-boundaries`: required because `ChannelManager.ts` is a public facade/hotspot and this plan may move package-local owners or files.
- `persistence-boundaries`: required because stored channel data, current-channel pointer state, storage keys, and localStorage failure semantics are in scope.
- `verification-strategy`: required to classify persistence contract tests versus behavior-preserving owner extraction.
- `execution-plan-authoring`: required because this is a Tier 3 checklist-linked tracked plan.

Do not load `plex-integration-boundaries` unless source audit proves Plex runtime/auth/stream behavior is required; that is normally a stop/replan to `PQR-5`. Do not load `ui-composition-patterns` unless UI/EPG/focus work becomes required; that is normally a stop/replan to `PQR-2`.

## Codanna Discovery

- `get_index_info`: Codanna contained 12,601 symbols across 812 files and 15,173 relationships. Semantic search was enabled with `JinaEmbeddingsV2BaseCode`, 338 embeddings, created/updated 2 days before planning.
- `search_documents "PQR-1 Scheduler Channel Content Persisted Data Owner Shape ChannelManager ContentResolver StoredChannelDataCodec"`: returned low-score/noisy unrelated plan/development hits and did not locate the authoritative PQR-1 checklist text. Deterministic fallback used direct reads of `ARCHITECTURE_CLEANUP_CHECKLIST.md`, `docs/architecture/CURRENT_STATE.md`, `docs/architecture/modules.md`, and relevant completed FCP plans.
- `semantic_search_with_context "ChannelManager public facade current channel persistence replacement cache retry policy ChannelPersistenceCoordinator ChannelResolutionCache ChannelRetryScheduler"`: found `ChannelManager.resolveChannelItemsForSchedule`, `ChannelManagerState`, `refreshChannelContent`, `loadChannels`, and `resolveChannelContent`, confirming facade/content/cache/retry call paths.
- `semantic_search_with_context "ContentResolver show expansion parent decoration filtering sorting playback ordering owners ContentSelectionPolicy SourceResolutionCache ContentItemMapper"`: produced weak type-heavy hits; direct source reads are authoritative for ContentResolver collaborator ownership.
- `find_symbol ChannelManager`: found class symbol_id `2756`; `analyze_impact` returned no impacted symbols, which is a Codanna gap for this public facade. Direct `rg` proves public callers through channel tuning, orchestrator, EPG, mini-guide, channel setup, and tests.
- `find_symbol ContentResolver`: found class symbol_id `2520`; `analyze_impact` reports impact to `ChannelManager`.
- `find_symbol ChannelRepository`: found class symbol_id `2262`; `analyze_impact` reports impact to `ChannelManager`, `ChannelPersistenceCoordinator`, and `ChannelRepository.test.ts`.
- `find_symbol ChannelPersistenceStore`: found class symbol_id `2283`; `analyze_impact` reports impact to `ChannelRepository`, `ChannelManager`, `ChannelPersistenceCoordinator`, and `ChannelRepository.test.ts`.
- `find_symbol StoredChannelDataCodec`: no symbol found. Fallback `rg` found `src/modules/scheduler/channel-manager/StoredChannelDataCodec.ts`; `find_symbol decodeStoredChannelData` found symbol_id `2171`; `analyze_impact` reports impact to `ChannelPersistenceStore.readStoredChannelData`, `ChannelRepository.loadNormalized`, and `ChannelManager.loadChannels`.
- `find_symbol setCurrentChannel`: found symbol_id `2803`; `analyze_impact` reports impact to `ChannelTuningCoordinator.switchToChannel`, `_drainSwitchQueue`, and `_runSingleSwitch`.
- `find_symbol persistCurrentChannelIdBestEffort`: found symbol_id `2963`; `analyze_impact` reports impact to `ChannelManager.setCurrentChannel`, `ChannelManager.replaceAllChannels`, and channel-tuning switch queue methods.
- `find_symbol ChannelResolutionCache`: found symbol_id `2219`; `analyze_impact` reports impact to `ChannelManager`.
- `find_symbol ChannelRetryScheduler`: found symbol_id `2849`; `analyze_impact` reports impact to `ChannelManager`.
- `find_symbol SourceResolutionCache` and `ContentSelectionPolicy`: found classes, but `analyze_impact` returned no impacted symbols. Treat this as a reverse-impact gap because direct source reads prove `ContentResolver` constructs them.
- `rg` fallback covered exact paths/imports for `StoredChannelDataCodec`, current-channel persistence, storage keys, cache/retry invalidation, `ChannelManager` and `ContentResolver` imports, package organization, public root exports, and targeted tests.

## Impact Snapshot

Source proof at plan time:

- `ChannelManager.ts` remains a 930-line public facade. Current source already delegates authoring/default shaping (`ChannelAuthoringService`), import/export (`ChannelImportExportService`), manager-facing persistence (`ChannelPersistenceCoordinator` plus save queue), resolved-content clone/stale policy (`ChannelResolutionCache`), retry timers (`ChannelRetryScheduler`), source resolution (`ContentResolver`), source cache/coalescing (`SourceResolutionCache`), mapping/media normalization (`ContentItemMapper`), and filtering/sorting/content playback policy (`ContentSelectionPolicy`).
- `ChannelManager` still owns public state transitions, event emission, source-empty versus filter-empty taxonomy, duration filtering tied to channel config, access-denied invalidation, and cache-fallback classification. Those stay facade-local unless a fresh source audit proves one focused package-local owner can move them without public API, ordering, retry, cache, persistence, or content-resolution behavior churn.
- `StoredChannelDataCodec.decodeStoredChannelData()` validates only JSON parse plus `channels`/`channelOrder` arrays, then returns `Partial<StoredChannelData>`. It does not construct validated/defaulted `ChannelConfig` records.
- `ChannelRepository.loadNormalized()` currently casts sanitized raw channel records to `ChannelConfig`, mutates missing `shuffleSeed`/`phaseSeed`, validates content source after the cast, normalizes numbers/order/current channel, and returns `StoredChannelData`. This is the active `PQR-1-SF4` seam.
- `ChannelPersistenceStore` owns raw localStorage reads/writes for channel data and the current-channel key. It removes empty/invalid channel payloads, trims current-channel values, rewrites normalized pointer reads, and returns safe mutation results for writes.
- `ChannelPersistenceCoordinator.persistCurrentChannelIdBestEffort()` is the only current-channel pointer persistence method. Its JSDoc explicitly says caller state transition is not transactional on localStorage availability. It logs `Failed to persist current channel`, emits persistence warnings through `ChannelPersistenceSaveQueue`, and swallows pointer write failures.
- `ChannelManager.setCurrentChannel()` validates the id, updates in-memory current channel, best-effort persists the pointer, then emits `channelSwitch`. `replaceAllChannels()` persists the full channel blob transactionally before state replacement, then best-effort persists the separate current-channel pointer. This supports retaining best-effort pointer semantics with contract tests and a revisit trigger.
- Storage keys remain unchanged: `lineup_channels_v4`, `lineup_channels_server_v1`, and `lineup_current_channel_v4`; `OrchestratorStorageContext` scopes channel and current-channel keys by selected server and active user.
- `ContentResolver` remains the package-local source-resolution entrypoint. It delegates source-result cache/in-flight coalescing to `SourceResolutionCache`, item mapping/media normalization and parent decoration transforms to `ContentItemMapper`, and filtering/sorting/playback ordering to `ContentSelectionPolicy`. It still owns show-list cache orchestration and show expansion sequencing because those are tied to source-resolution fetch/abort/fallback behavior.
- The channel-manager package is flat with explicit owner filenames and one existing public root `index.ts`. Source proves a persistence owner folder would improve reviewability if `PQR-1-SF4` edits move all persistence-local collaborators together. Source does not currently prove standalone `authoring/` or `resolution/` folder moves are worth behavior-neutral import churn.

## Files In Scope

Production files:

- `src/modules/scheduler/channel-manager/StoredChannelDataCodec.ts`
- `src/modules/scheduler/channel-manager/ChannelPersistenceStore.ts`
- `src/modules/scheduler/channel-manager/ChannelRepository.ts`
- `src/modules/scheduler/channel-manager/ChannelPersistenceCoordinator.ts`
- `src/modules/scheduler/channel-manager/ChannelPersistenceSaveQueue.ts`
- `src/modules/scheduler/channel-manager/ChannelManager.ts`
- `src/modules/scheduler/channel-manager/ChannelAuthoringService.ts` only if validated/defaulted runtime channel construction needs existing authoring/default primitives.
- `src/modules/scheduler/channel-manager/ChannelValueValidators.ts`, `ChannelContentSourceValidator.ts`, `stripLegacySequentialVariant.ts`, `ChannelDomainClone.ts`, `types.ts`, `interfaces.ts`, and `constants.ts` only for persistence validation/import alignment.
- New package-local files under `src/modules/scheduler/channel-manager/persistence/` only if the worker executes the approved persistence owner-folder move without shims/barrels.
- `src/modules/scheduler/channel-manager/ContentResolver.ts`, `SourceResolutionCache.ts`, `ContentItemMapper.ts`, `ContentSelectionPolicy.ts`, `ChannelResolutionCache.ts`, and `ChannelRetryScheduler.ts` for source audit and narrow import/path alignment only unless a stop/replan approves production behavior changes.

Test files:

- `src/modules/scheduler/channel-manager/__tests__/StoredChannelDataCodec.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelRepository.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelPersistenceStore.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.persistence.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.transactional.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelPersistenceSaveQueue.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ContentResolver.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ContentSelectionPolicy.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.content-resolution.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.error-semantics.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.stale-fallback.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelResolutionCache.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelRetryScheduler.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/SourceResolutionCache.test.ts`

Docs, only if truth changes:

- `docs/architecture/CURRENT_STATE.md`
- `docs/architecture/modules.md`
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` during future closeout after clean review.

## Files Out Of Scope

- Removing `ChannelManager` as public facade.
- Storage schema, key, or scoped-key migration.
- Public channel API widening or new public exports without maintainer replan.
- Plex runtime/auth/stream/discovery/library behavior; route to `PQR-5`.
- UI, EPG, mini-guide presentation/focus/navigation cleanup; route to `PQR-2`.
- Windows implementation.
- Compatibility shims, wrapper barrels, root barrels, subfolder barrels, and old-path re-export files.
- Private test probes and test-only API exposure.
- Standalone `authoring/` or `resolution/` package moves unless a fresh source audit proves the flat package blocks reviewability and the move can happen without shims/barrels/public export churn.

## Planner Self-Check

1. No unresolved approved-ready seam remains for the first execution unit: persisted decode/defaulting and current-channel semantics belong to the persistence owner seam.
2. Adjacent contracts are frozen: public `IChannelManager`, public `ChannelManager`, storage keys/schema, scoped key formats, Plex behavior, UI behavior, and content ordering are unchanged unless a stop/replan condition fires.
3. Files out of scope are not hidden dependencies. Orchestrator storage context and UI/EPG callers are proof surfaces only; implementation must not edit them under this plan except docs/architecture truth after reviewed closeout.
4. Codanna evidence and fallback are recorded, including weak document search, `StoredChannelDataCodec` symbol miss, and reverse-impact gaps for public facade/collaborators.
5. The plan uses repo-preferred owners: persistence validation stays with channel-manager persistence owners, current-channel pointer persistence stays in `ChannelPersistenceCoordinator`/store/repository, source resolution stays with `ContentResolver` and collaborators, and `ChannelManager` remains a facade.
6. A fresh cleanup-loop worker can start `ready_now_execution_unit` `PQR-1-W1` without inventing package membership, final-owner accounting, parallelism, or verification depth.
7. This is execution-grade at seam/scope/verification level and leaves local helper names, exact private type shapes, and mechanical import edits to the worker.

## Architecture Seam Decision Gate

Approved execution seam:

- Execute `PQR-1-W1` first. It covers validated persisted decode/defaulting and current-channel persistence semantics inside the persistence owner seam.
- `PQR-1-S1` must remove the raw-record-to-`ChannelConfig` cast path by ensuring persisted channels are validated/defaulted through runtime construction before `ChannelRepository.loadNormalized()` returns `StoredChannelData`.
- `PQR-1-S1` may move persistence files into `src/modules/scheduler/channel-manager/persistence/` only if the worker moves the coherent persistence owner set together, updates direct imports/tests, and adds no shims, compatibility re-exports, wrapper barrels, or subfolder barrels.
- `PQR-1-S2` must retain best-effort current-channel pointer persistence unless a transactional requirement is source-proven. If retained, tests and closeout rationale must name one owner and revisit trigger.
- `PQR-1-W2` is owner-shape proof after W1. It should source-disprove or replan facade/content/package organization residuals against current code; production extraction is not approved by default for S3/S4/S5 unless the source audit proves a focused owner can move without behavior churn.

Stop and replan if:

- storage schema/key migration, server/user key format changes, compatibility storage branches, or `StoredChannelData` wire-shape changes become necessary;
- public facade removal, public API widening, public export changes, root/subfolder barrels, wrappers, shims, or old-path compatibility files become necessary;
- channel ordering, retry, cache, persistence, import/export, content resolution, filtering, sorting, playback ordering, source-empty/filter-empty taxonomy, access-denied behavior, or error/warning behavior would change;
- Plex, UI/EPG, navigation, app-shell/orchestrator composition, player runtime, or Windows work becomes necessary;
- tests require private probes or test-only APIs;
- source audit shows different package ownership than this plan;
- first safe execution unit cannot stay inside the persistence owner seam;
- package moves require shims/barrels/wrappers or cannot be reviewed without behavior churn.

Absorb-now rule: absorb only residue that stays within the selected execution unit goal, same owner seam, same files, same verification envelope, and same final-owner accounting. Replan for any new owner, wider verification surface, changed source-finding membership, or changed execution-unit membership.

## Package Decomposition

- `package_id`: `PQR-1`
- `checklist_token`: `PQR-1`
- `source_finding_ids`:
  - `PQR-1-SF1`
  - `PQR-1-SF2`
  - `PQR-1-SF3`
  - `PQR-1-SF4`
  - `PQR-1-SF5`
- `slice_table`:

### `PQR-1-S1` Persisted Decode Runtime Construction

- `goal`: decode persisted channels through validated/defaulted runtime construction before returning `ChannelConfig` from repository load paths.
- `areas/files`:
  - `StoredChannelDataCodec.ts`
  - `ChannelRepository.ts`
  - `ChannelPersistenceStore.ts`
  - validation/default helper files named in scope
  - `StoredChannelDataCodec.test.ts`
  - `ChannelRepository.test.ts`
  - `ChannelManager.persistence.test.ts`
- `source_finding_ids`:
  - `PQR-1-SF4`
- `verification`:
  - `npm test -- StoredChannelDataCodec ChannelRepository ChannelManager.persistence`
  - `npm run typecheck`
  - old-path/import audit if files move
- `dependencies`: none.
- `stop_condition`: stop if validation requires storage schema/key migration, public API widening, compatibility parsing outside the persistence owner, or private test probes.
- `handoff_condition`: persisted decode/defaulting is contract-tested; repository no longer casts raw persisted records directly to `ChannelConfig`; no schema/key behavior changed.
- `serial_only`: true
- `parallel_justification`: first persistence slice changes the decode contract used by later persistence/current-channel proof.

### `PQR-1-S2` Current-Channel Pointer Semantics

- `goal`: settle current-channel pointer persistence as explicit best-effort with tests, rationale, one owner, and revisit trigger unless transactional semantics are source-proven.
- `areas/files`:
  - `ChannelPersistenceCoordinator.ts`
  - `ChannelPersistenceStore.ts`
  - `ChannelRepository.ts`
  - `ChannelManager.ts`
  - `ChannelManager.persistence.test.ts`
  - `ChannelManager.transactional.test.ts`
  - `ChannelPersistenceSaveQueue.test.ts`
- `source_finding_ids`:
  - `PQR-1-SF5`
- `verification`:
  - `npm test -- ChannelPersistenceStore ChannelRepository ChannelManager.persistence ChannelManager.transactional ChannelPersistenceSaveQueue`
  - `rg` audit for current-channel pointer writes/read keys.
- `dependencies`: after `PQR-1-S1` so persisted decode/defaulting cannot mask current-channel load semantics.
- `stop_condition`: stop if `setCurrentChannel()` or `replaceAllChannels()` must make pointer writes strict/transactional, if warning semantics change, or if caller behavior changes.
- `handoff_condition`: current-channel pointer semantics are explicitly best-effort or replanned as strict; owner and revisit trigger are recorded; targeted tests pass.
- `serial_only`: true
- `parallel_justification`: shares persistence owners and tests with S1.

### `PQR-1-S3` ChannelManager Facade State Transition And Cache-Retry Proof

- `goal`: keep `ChannelManager` as public facade while source-disproving or replanning any remaining concentrated replacement/current-channel/cache-retry/storage-key state-transition policy.
- `areas/files`:
  - `ChannelManager.ts`
  - `ChannelAuthoringService.ts`
  - `ChannelPersistenceCoordinator.ts`
  - `ChannelResolutionCache.ts`
  - `ChannelRetryScheduler.ts`
  - affected ChannelManager tests
- `source_finding_ids`:
  - `PQR-1-SF1`
- `verification`:
  - source audit for public facade responsibilities and package-local owners
  - `npm test -- ChannelManager.persistence ChannelManager.transactional ChannelManager.content-resolution ChannelManager.error-semantics ChannelManager.stale-fallback ChannelRetryScheduler ChannelResolutionCache`
- `dependencies`: after W1, because persistence semantics must be settled before facade residuals are judged.
- `stop_condition`: stop if a distinct facade-local owner extraction is source-proven but cannot stay package-local, or if extraction changes public API, ordering, cache/retry, persistence, import/export, or error behavior.
- `handoff_condition`: SF1 is either source-disproved with final owners and revisit trigger, or a refreshed plan names one focused owner extraction.
- `serial_only`: true
- `parallel_justification`: facade proof overlaps persistence and content-resolution call paths; serial review avoids duplicate final-owner accounting.

### `PQR-1-S4` ContentResolver Owner Proof

- `goal`: keep `ContentResolver` as source-resolution entrypoint only if show expansion, parent decoration, filtering/sorting, and playback-ordering surfaces have focused owners or source-backed retained-owner rationale.
- `areas/files`:
  - `ContentResolver.ts`
  - `SourceResolutionCache.ts`
  - `ContentItemMapper.ts`
  - `ContentSelectionPolicy.ts`
  - `ChannelManager.ts` content-resolution methods for call-site proof only
  - content-resolution tests named in scope
- `source_finding_ids`:
  - `PQR-1-SF2`
- `verification`:
  - source audit for show expansion, parent decoration, filtering/sorting, playback ordering, source cache, and mapping owners
  - `npm test -- ContentResolver ContentSelectionPolicy SourceResolutionCache ChannelManager.content-resolution`
  - add `ChannelManager.error-semantics` if cache/error paths are touched.
- `dependencies`: after S3 unless a controller explicitly approves read-only parallel audit with no writes.
- `stop_condition`: stop if source audit proves `ContentResolver` still owns mixed behavior that needs a new owner, if Plex behavior changes, or if public ContentResolver/ChannelManager APIs must change.
- `handoff_condition`: SF2 is source-disproved with final owners/revisit triggers or a refreshed plan names the next focused owner extraction.
- `serial_only`: true
- `parallel_justification`: content proof overlaps ChannelManager content paths and cache/error semantics.

### `PQR-1-S5` Package Organization And Public Seam Audit

- `goal`: introduce or retain visible owner folders only where current source proves the flat package blocks reviewability; keep public seam stable and audit old paths/exports.
- `areas/files`:
  - `src/modules/scheduler/channel-manager/**`
  - `index.ts`
  - package-local imports/tests
  - architecture docs only if path truth changes
- `source_finding_ids`:
  - `PQR-1-SF3`
- `verification`:
  - `rg` old-path and public export audits
  - `npm run typecheck`
  - `git diff --check`
  - `npm run verify`
  - `npm run verify:docs` if docs/checklist/current-state change.
- `dependencies`: after S1/S2 for persistence folder decision and after S3/S4 for authoring/resolution folder decisions.
- `stop_condition`: stop if package moves require shims, barrels, wrappers, public export churn, or behavior-neutral foldering cannot be reviewed independently from behavior changes.
- `handoff_condition`: persistence foldering is completed or source-disproved; standalone authoring/resolution foldering is source-disproved or replanned with proof; public imports/exports remain stable.
- `serial_only`: true
- `parallel_justification`: organization is dependent on owner proof; parallel foldering would hide behavior changes in import churn.

- `coverage_check`:
  - `PQR-1-SF1` maps exactly once to `PQR-1-S3`.
  - `PQR-1-SF2` maps exactly once to S4.
  - `PQR-1-SF3` maps exactly once to `PQR-1-S5`.
  - `PQR-1-SF4` maps exactly once to S1.
  - `PQR-1-SF5` maps exactly once to S2.
- `coverage_ledger`:
  - `source_finding_id`: `PQR-1-SF1`; `slice_id`: `PQR-1-S3`; `execution_unit`: `PQR-1-W2`; final owner: `ChannelManager` public facade plus focused package-local collaborators unless S3 replans.
  - `source_finding_id`: `PQR-1-SF2`; `slice_id`: `PQR-1-S4`; `execution_unit`: `PQR-1-W2`; final owner: `ContentResolver`, `SourceResolutionCache`, `ContentItemMapper`, and `ContentSelectionPolicy` unless S4 replans.
  - `source_finding_id`: `PQR-1-SF3`; `slice_id`: `PQR-1-S5`; `execution_unit`: `PQR-1-W2`; final owner: package-local path truth with no shims/barrels.
  - `source_finding_id`: `PQR-1-SF4`; `slice_id`: `PQR-1-S1`; `execution_unit`: `PQR-1-W1`; final owner: channel persistence decode/repository seam.
  - `source_finding_id`: `PQR-1-SF5`; `slice_id`: `PQR-1-S2`; `execution_unit`: `PQR-1-W1`; final owner: `ChannelPersistenceCoordinator` with `ChannelPersistenceStore`/`ChannelRepository` mechanics.
- `execution_waves`:
  - `wave_id`: `PQR-1-W1`
    - `slice_ids`: `PQR-1-S1`, `PQR-1-S2`
    - `completion_condition`: persisted decode/defaulting is validated before `ChannelConfig` return; current-channel pointer semantics are explicitly best-effort or replanned; targeted persistence tests, `npm run typecheck`, `git diff --check`, `npm run verify`, and docs verification as applicable pass.
    - `absorb_now_scope`: persistence owner residue inside the same files, same tests, same storage key/schema invariants, and same final-owner accounting.
    - `replan_triggers`: any stop condition in S1/S2, schema/key migration, strict transactional pointer requirement, public API widening, or shims/barrels.
  - `wave_id`: `PQR-1-W2`
    - `slice_ids`: `PQR-1-S3`, `PQR-1-S4`, `PQR-1-S5`
    - `completion_condition`: facade/content/package organization source findings are source-disproved or replanned with one final owner; no behavior churn or public seam drift; targeted content/cache/retry tests and full gates pass.
    - `absorb_now_scope`: owner-shape proof inside channel-manager package-local files and tests with unchanged public seam.
    - `replan_triggers`: new owner outside channel-manager, Plex/UI/EPG work, public API/export changes, package moves needing shims/barrels, behavior drift, or wider verification surface.
- `recommended_slice_order`:
  1. `PQR-1-S1`
  2. `PQR-1-S2`
  3. `PQR-1-S3`
  4. `PQR-1-S4`
  5. `PQR-1-S5`
- `ready_now_slice`: `PQR-1-S1`
- `ready_now_execution_unit`: `PQR-1-W1`
- `parallel_execution_policy`: serial within waves. A read-only sidecar may audit S4 while W1 implementation runs only if it writes nothing and does not alter final-owner accounting; no parallel implementation is approved.

## Verification Commands

- Verification classification: `new regression/contract test required`

Primary proof mode: `contract-first` for persisted decode/defaulting and current-channel pointer semantics, supported by `refactor-invariance` for owner extraction or file moves that preserve behavior.

Plan/control-plane validation:

1. Run: `npm run verify:docs`
   Expected: active PQR source-finding plan structure passes, including `source_finding_ids`, wave-scoped `ready_now_execution_unit`, slice coverage, and no detector-derived proof.

Ready-now `PQR-1-W1` commands:

1. Run: `npm test -- StoredChannelDataCodec ChannelRepository ChannelPersistenceStore ChannelManager.persistence ChannelManager.transactional ChannelPersistenceSaveQueue`
   Expected: persisted decode/defaulting, invalid/missing/default states, storage failure behavior, current-channel load precedence, best-effort pointer writes, warning behavior, and transactional replace behavior pass.
2. Run: `rg -n "lineup_channels_v4|lineup_channels_server_v1|lineup_current_channel_v4|CURRENT_CHANNEL_KEY|STORAGE_KEY|setStorageKeys|currentChannelKey|storageKey" src/modules/scheduler/channel-manager src/core/orchestrator/storage src/config -g '*.ts'`
   Expected: key values and scoped key formats are unchanged; any import-path changes stay package-local.
3. Run: `rg -n "persistCurrentChannelId|BestEffort|current channel|current-channel|saveCurrentChannelId|readCurrentChannelId|writeCurrentChannelId" src/modules/scheduler/channel-manager src/core/channel-tuning src/core/orchestrator src/__tests__ -g '*.ts'`
   Expected: pointer persistence remains in scheduler/channel-manager owners; callers do not learn storage mechanics.
4. If files move, run: `rg -n "StoredChannelDataCodec|ChannelPersistenceStore|ChannelRepository|ChannelPersistenceCoordinator|ChannelPersistenceSaveQueue" src docs -g '*.ts' -g '*.md'`
   Expected: no stale old-path imports except intentional tracked docs/history; no old-path shim/barrel files.
5. Run: `npm run typecheck`
   Expected: TypeScript passes.
6. Run: `git diff --check`
   Expected: no whitespace errors.
7. Run: `npm run verify`
   Expected: full repo verification passes because scheduler/channel-manager behavior is runtime-relevant.
8. Run: `npm run verify:docs`
   Expected: docs/control-plane verification passes if this active plan, checklist, or architecture docs changed.

Later `PQR-1-W2` adds:

1. Run: `npm test -- ContentResolver ContentSelectionPolicy SourceResolutionCache ChannelManager.content-resolution ChannelManager.error-semantics ChannelManager.stale-fallback ChannelResolutionCache ChannelRetryScheduler`
   Expected: content resolution, selection, source cache, resolved cache, fallback/error, and retry behavior remain stable.
2. Run: `npm test -- ChannelManager.stale-fallback`
   Expected: stale fallback and content-unavailable cache behavior remain stable under the retained `ChannelManager` cache-fallback classification owner.
3. Run: `rg -n "from ['\\\"].*scheduler/channel-manager|export .*ChannelManager|export .*ContentResolver" src/modules/scheduler/channel-manager src/core src/modules -g '*.ts'`
   Expected: public channel-manager seam remains stable; no new compatibility exports or wrappers.

## Rollback Notes

- If persisted decode/defaulting changes reject valid existing records, revert the persistence slice and restore the previous repository normalization path before trying a narrower codec/repository split.
- If a file move causes import churn or review noise that cannot be proven behavior-neutral without shims/barrels, revert the move and keep the owner-shape improvement inside current file paths.
- If current-channel pointer behavior changes from best-effort to strict by accident, revert to the current `persistCurrentChannelIdBestEffort` path and replan before any transactional pointer semantics.
- If content/cache/retry behavior changes during W2, revert those edits and split a new focused owner plan rather than mixing behavior repair with PQR-1 closeout.

## Commit Checkpoints

- Checkpoint 1: verifier/source-finding representation changes, if required for PQR source-finding ids, separate from product code.
- Checkpoint 2: `PQR-1-W1` persistence implementation and tests only.
- Checkpoint 3: `PQR-1-W2` facade/content/package organization proof or implementation only.
- Checkpoint 4: checklist/current-state/modules closeout docs after clean review and verification.
