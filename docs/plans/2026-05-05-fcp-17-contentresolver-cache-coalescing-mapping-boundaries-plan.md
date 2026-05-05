**Plan Status:** completed
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

# FCP-17 ContentResolver Cache, Coalescing, And Mapping Boundaries Plan

## Goal

Retire exactly `ARCHITECTURE_CLEANUP_CHECKLIST.md` item `FCP-17` by closing source finding `FCP-17-SF1`: `ContentResolver` combines source resolution, cache/in-flight coordination, item mapping/filtering/sorting, and media metadata normalization.

This is an `FCP-*` source-backed cleanup package. Coverage is defined only by checklist `source_finding_id` value `FCP-17-SF1`; do not use Desloppify, detector ids, imported review ids, package-map ids, stale hotspot wording, line count, score output, or retrospective subjective review as intake, proof, or closeout.

Completion means `ContentResolver` keeps its public orchestration entrypoint stable while current-source cache/coalescing and mapping/normalization responsibilities either move into focused package-local owners or are source-justified as acceptable retained local responsibilities. Behavior, source-result cache semantics, in-flight waiter/abort semantics, show-list cache fallback, mapping/filtering/sorting, media metadata normalization, and error behavior must remain stable with public-seam tests.

## Non-Goals

- Do not implement production or test code from this planning pass.
- Do not reopen completed `FCP-7` through `FCP-16`, start `FCP-18` or later, `FCP-EXIT`, DCR packages, legacy `FCP-EXIT`, Windows port work, or broader post-FCP cleanup.
- Do not change ChannelManager persistence/current-channel behavior, storage keys, persistence schema, selected-server/channel storage context, or channel setup persistence.
- Do not widen the public channel-manager API, remove the `ContentResolver` orchestration entrypoint, or expose new raw cache/mapping internals to callers.
- Do not change Plex auth, Plex discovery, Plex library transport contracts, Plex stream URL/subtitle/transcode behavior, navigation, UI/focus/motion/CSS, app-shell, orchestrator, or Windows platform behavior.
- Do not change sorting, filtering, playback ordering, show expansion, zero-duration filtering, cache fallback, abort propagation, warning/error taxonomy, media metadata normalization, HDR detection, or scheduled-index normalization except under a stopped/replanned maintainer-approved behavior change.
- Do not add compatibility shims, package/root barrels, new dependencies, speculative generic utility owners, or tests that depend only on private probes.

## Parent Priority Alignment

`FCP-17` is the next safe package after completed `FCP-16`. The checklist marks `FCP-16` completed with no follow-ups and states `FCP-18` or later, `FCP-EXIT`, Windows port work, and other post-FCP cleanup must wait for clean `FCP-17` closeout evidence.

Current architecture docs identify scheduler/channel management as the owner for channel-domain flows. `ChannelManager.ts` remains the public channel-domain API/state owner, while package-local collaborators own authoring/default shaping, import/export orchestration, manager-facing persistence coordination, resolved-content clone/stale policy, retry timers, and persistence save orchestration. `FCP-16` closed current-channel persistence semantics and explicitly froze ContentResolver cleanup for this package.

The approved seam is scheduler/channel-manager `ContentResolver` responsibility isolation only. Keep `ContentResolver.resolveSource(...)`, `clearCaches()`, `invalidateSource(...)`, `applyFilters(...)`, `applySort(...)`, and `applyPlaybackMode(...)` caller behavior stable unless a stop/replan condition is met. New owners, if source-proven, must stay package-local under `src/modules/scheduler/channel-manager/` and must not take over Plex, persistence, UI, or public ChannelManager responsibilities.

## Required Reading

Read in this order before implementation or review:

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/README.md` routing table
4. `docs/agentic/session-prompts/cleanup-loop.md`
5. `docs/agentic/plan-authoring-standard.md`, especially Universal Plan Core, Cleanup Overlay, and FCP Source-Backed Checklist Override
6. `docs/agentic/codanna-playbook.md`
7. `ARCHITECTURE_CLEANUP_CHECKLIST.md` sections `FCP Operating Rules`, `FCP-16`, and `FCP-17`
8. `docs/architecture/CURRENT_STATE.md`
9. `docs/architecture/modules.md`
10. Completed guardrail plans only:
    - `docs/plans/2026-05-02-fcp-7-boundary-type-hygiene-plan.md`
    - `docs/plans/2026-05-02-fcp-8-api-plex-error-contract-coherence-plan.md`
    - `docs/plans/2026-05-02-fcp-9-source-signal-convention-local-elegance-plan.md`
    - `docs/plans/2026-05-02-fcp-10-epg-renderer-direct-confidence-presentation-decomposition-plan.md`
    - `docs/plans/2026-05-02-fcp-11-runtime-owner-reduction-hotspots-plan.md`, especially prior ChannelManager/ContentResolver guardrails
    - `docs/plans/2026-05-02-fcp-12-package-organization-structure-navigation-final-exit-plan.md`
    - `docs/plans/2026-05-05-fcp-13-low-risk-source-signal-api-export-diagnostic-closure-plan.md`
    - `docs/plans/2026-05-05-fcp-14-priority-one-forwarding-assembly-seam-plan.md`
    - `docs/plans/2026-05-05-fcp-15-plexauth-home-profile-status-helper-boundary-plan.md`
    - `docs/plans/2026-05-05-fcp-16-scheduler-current-channel-channelmanager-persistence-semantics-plan.md`, especially the immediate ContentResolver exclusion guardrail
11. This plan
12. Source and test files named under `## Files In Scope`
13. `git status --short --branch`

Freshness gate: stop and refresh this plan if any `FCP-17` checklist text, scheduler/channel-manager architecture ownership text, source files in scope, tests in scope, or public channel-manager/content-resolution contract text changed materially after 2026-05-05.

Planning observed branch `code-health...origin/code-health` with the controller-noted unrelated dirty/untracked paths: `docs/archive/plans/2026-04-30-dcr-10-oversized-test-suite-structure.md`, `docs/plans/2026-04-30-dcr-exit-final-dimension-audit-plan.md`, `scorecard.png`, and `docs/agentic/evals/baseline-summaries/2026-04-28-prompt-13-feature-low-implementer-policy.md`. Preserve those paths unless a fresh source audit proves direct `FCP-17` overlap.

## Required Skills

- `architecture-boundaries`: required because this package extracts or confirms owners inside a scheduler hotspot and must keep public seams, module ownership, and dependency direction explicit.
- `verification-strategy`: required to freeze proof depth for behavior-preserving cache/coalescing and mapping/normalization cleanup.
- `execution-plan-authoring`: required for Tier 3 source-backed FCP package planning.

Do not load `persistence-boundaries` unless source audit unexpectedly proves storage-backed behavior must change. That should normally stop and replan because `FCP-17` excludes persistence schema/key, current-channel persistence, and selected/current channel storage work.

Do not load `plex-integration-boundaries`, `ui-composition-patterns`, or `brainstorming` unless implementation proves Plex auth/discovery/library/stream behavior, TV-visible UI/focus behavior, or unresolved product intent is truly in scope. That discovery should normally stop and replan.

## Codanna Discovery

- `get_index_info`: Codanna available with 12,074 symbols across 797 files; 12,288 relationships; semantic search enabled with `JinaEmbeddingsV2BaseCode`; 295 embeddings; created and updated 6 minutes before the planning pass.
- `search_documents "FCP-17 ContentResolver cache coalescing mapping normalization source finding"`: returned only noisy user-guide/getting-started hits and did not locate the authoritative checklist. Direct reads of `ARCHITECTURE_CLEANUP_CHECKLIST.md`, current architecture docs, and completed FCP guardrail plans are the deterministic membership and sequencing source.
- `semantic_search_with_context "ContentResolver source resolution cache in-flight coalescing mapping normalization channel-manager"`: found `ContentResolver` at `src/modules/scheduler/channel-manager/ContentResolver.ts` symbol_id `2834`, `ResolvedContentItem`, source types, and `resolveSource` symbol_id `2847`. This confirmed the owner area and source-resolution/cache entrypoint.
- `semantic_search_with_context "ContentResolver map Plex media item normalize duration sort filter resolve library collection playlist manual mixed source"`: surfaced Plex media/source type anchors but did not directly locate `ContentResolver` mapping helpers. Direct source reads are required for mapping/normalization proof.
- `find_symbol ContentResolver`: found class symbol_id `2834`, documented as resolving content from Plex sources. `analyze_impact` on the class returned no impacted symbols, which is insufficient because direct `rg` proves `ChannelManager` constructs and calls it.
- `search_symbols resolveSource`: found `resolveSource` symbol_id `2847` and `_resolveSourceUncached`. `analyze_impact` on `resolveSource` showed impact through `_resolveMixedSource` and `_resolveSourceUncached`; direct `rg` also proves `ChannelManager._resolveFilteredItems` calls the public method.
- `find_symbol _awaitInFlight`: symbol_id `2917`; `analyze_impact` showed impact through `resolveSource`, `_resolveMixedSource`, and `_resolveSourceUncached`.
- `find_symbol _toResolvedItem`: symbol_id `2930`; `analyze_impact` showed seven affected resolver methods, including `_expandShowContainers`, `_resolveLibrarySource`, `_resolveCollectionSource`, `_resolveShowSource`, `_resolvePlaylistSource`, `_resolveSourceUncached`, and `resolveSource`.
- `find_symbol _buildMediaInfo`: symbol_id `2934`; `analyze_impact` showed the same resolver mapping path through `_toResolvedItem`.
- `find_symbol _resolveLibrarySource`: symbol_id `2878`; `analyze_impact` showed impact through `_resolveSourceUncached`, `_resolveMixedSource`, and `resolveSource`.
- `find_symbol _expandShowContainers`: symbol_id `2862`; `analyze_impact` showed impact through `_resolveLibrarySource`, `_resolveSourceUncached`, `_resolveMixedSource`, and `resolveSource`.
- `find_symbol applyFilters`, `applySort`, and `applyPlaybackMode`: found public `ContentResolver` methods, but `analyze_impact` returned no reverse impact. Treat this as Codanna insufficiency because direct `rg` proves `ChannelManager._resolveFilteredItems` and `_createResolvedContent` call them.
- `find_symbol ChannelResolutionCache`: found class symbol_id `2181`; `analyze_impact` returned no impacted symbols, insufficient because direct `rg` and tests prove ChannelManager uses it for resolved channel-content clone/stale policy. It is a related guardrail, not the source-result cache owner to extract from `ContentResolver`.
- `rg` / direct source reads covered `ContentResolver.ts`, `ChannelResolutionCache.ts`, `ChannelManager.ts` content-resolution methods, `interfaces.ts`, `types.ts`, `ContentResolver.test.ts`, `ChannelManager.content-resolution.test.ts`, `ChannelManager.error-semantics.test.ts`, `ChannelManager.persistence.test.ts`, `ChannelManager.transactional.test.ts`, and `ChannelResolutionCache.test.ts`.

## Impact Snapshot

Current-source proof at plan time:

- `ContentResolver` is 1,056 lines at this plan revision and remains the scheduler content-source orchestration entrypoint. It owns public `resolveSource`, `clearCaches`, `invalidateSource`, `applyFilters`, `applySort`, and `applyPlaybackMode`.
- `resolveSource` builds stable source cache keys, checks a TTL/LRU source-result cache, coalesces identical in-flight resolves, manages waiter counts, aborts shared source work only when the last waiter releases, caches only successful source results for the same epoch/generation, and returns cloned items with normalized `scheduledIndex`.
- `clearCaches` increments a cache epoch, clears show-list and source-result caches, aborts all in-flight source work, and clears in-flight entries. `invalidateSource` bumps one source generation, deletes the matching source-result cache entry, aborts matching in-flight work, clears show-list cache for show-library sources, and recursively invalidates mixed sub-sources.
- The source-result cache and in-flight map are separate from `ChannelResolutionCache.ts`. `ChannelResolutionCache` owns resolved channel-content clone/stale policy for `ChannelManager`, while `ContentResolver` owns source-level cache/coalescing for Plex source payloads. FCP-17 must not conflate those owners.
- `_resolveSourceUncached` dispatches library, collection, show, playlist, manual, and mixed source types, expands leftover show containers, filters unexpanded shows with warnings, and normalizes final `scheduledIndex` values.
- TV-library fast path fetches episodes directly, fetches show list for parent metadata once per library within TTL, falls back to cached show lists on non-abort fetch failures, propagates aborts, and decorates episodes with parent show metadata. Genre-filtered TV libraries instead fetch shows with a show type filter and expand strictly so failures propagate and partial results are not cached.
- Collection and leftover show expansion decorate episodes with parent metadata and currently warn/non-strict-skip on expansion errors except where strict expansion is requested.
- Mapping/normalization is concentrated in `_toResolvedItem`, `_buildFullTitle`, `_buildMediaInfo`, `_normalizeResolution`, `_detectHdrFromStream`, `_selectAudioStream`, and `_decorateEpisodeFromParent`. These functions normalize full titles, show title/thumb/art/clearLogo, filterable fields, watched/addedAt, media resolution, HDR labels, Dolby Vision profile, audio codec/channels/title, and parent metadata.
- Filtering/sorting/playback ordering remains public behavior consumed by `ChannelManager`: filters use AND logic, missing rating/contentRating/watched/addedAt rejects when those filters are present, missing genre/director arrays count as empty for `neq`/`notContains`, sorts cover title/year/duration/episode/added order, and playback mode covers sequential, deterministic shuffle, random, block grouping, scheduled-index reset, and unknown-mode throwing.
- `ChannelManager._resolveFilteredItems` calls `resolveSource`, distinguishes source-empty `CONTENT_UNAVAILABLE` from filter-empty `SCHEDULER_EMPTY_CHANNEL`, applies `applyFilters` and `applySort`, filters zero-duration items, applies min/max duration limits, and then `_createResolvedContent` calls `applyPlaybackMode`. ChannelManager public behavior is therefore part of the proof surface, but not the extraction owner.
- Existing tests directly cover source cache reuse, in-flight de-duping, caller-abort isolation, TTL expiry, cache key stability for omitted/undefined fields, show-list cache fallback and abort propagation, strict genre-filtered show expansion failures, mixed sequential/interleave ordering, parent metadata propagation, mediaInfo HDR detection, filtering, sorting, playback modes, full-title generation, ChannelManager content-resolution cache interactions, stale-cache/error behavior, and `ChannelResolutionCache` cloning.

Source finding disposition planned:

- `FCP-17-SF1` maps exactly once to `FCP-17-S1`.
- The checklist's candidate prompts `FCP-17-S1` cache/coalescing and `FCP-17-S2` mapping/normalization are not approved as separate coverage owners in this plan. They are ordered work phases inside one execution unit so the single source finding has one final owner and one review surface.

## Files In Scope

- `src/modules/scheduler/channel-manager/ContentResolver.ts`
- New package-local owner file(s) under `src/modules/scheduler/channel-manager/` only when source audit proves a focused ContentResolver-local cache/coalescing owner or mapping/normalization owner is needed.
- `src/modules/scheduler/channel-manager/interfaces.ts` only if private owner contracts or imports need package-local alignment; public `IPlexLibraryMinimal` and `PlexMediaItemMinimal` behavior are frozen unless a stopped/replanned plan approves a contract change.
- `src/modules/scheduler/channel-manager/types.ts` only if `ResolvedContentItem`-adjacent private owner typing needs local alignment; public resolved item shape and persisted channel types are frozen unless a stopped/replanned plan approves a contract change.
- `src/modules/scheduler/channel-manager/ChannelManager.ts` only for narrow call-site wiring if `ContentResolver` delegates to package-local collaborators while preserving public behavior.
- `src/modules/scheduler/channel-manager/ChannelResolutionCache.ts` and `src/modules/scheduler/channel-manager/__tests__/ChannelResolutionCache.test.ts` read-only or tests-only guardrails unless implementation proves clone ownership must align with a new source-cache owner; source changes here require replan unless purely local type import alignment is needed.
- `src/modules/scheduler/channel-manager/__tests__/ContentResolver.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.content-resolution.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.error-semantics.test.ts` only if source-resolution error/cache fallback behavior or invalidation behavior is touched.
- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.persistence.test.ts` and `src/modules/scheduler/channel-manager/__tests__/ChannelManager.transactional.test.ts` only for existing cache-clearing expectations when `clearCaches` / `invalidateSource` wiring is touched; persistence behavior remains frozen.
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` only during package closeout after clean implementation review and verification.
- `docs/architecture/CURRENT_STATE.md` and `docs/architecture/modules.md` only if implementation source audit proves current scheduler/channel-manager ownership truth changed.

## Files Out Of Scope

- Any runtime/source file not named in `## Files In Scope`.
- ChannelManager persistence/current-channel work, `ChannelPersistenceStore.ts`, `ChannelRepository.ts`, `ChannelPersistenceCoordinator.ts`, `ChannelPersistenceSaveQueue.ts`, storage keys, persistence schema, server/user key scoping, selected-server/current-channel persistence, and channel setup persistence.
- Public channel-manager API widening, public `IChannelManager` shape changes, public `ContentResolver` method behavior changes, public Plex library/stream/auth contract changes, or caller contract changes.
- Plex auth, Plex discovery, Plex library transport/parsing behavior, Plex stream URL/subtitle/transcode/HDR policy beyond preserving existing `detectHdrLabel` consumption, navigation, UI/focus/motion/CSS, app-shell, orchestrator, player, lifecycle, and Windows platform behavior.
- Broad `ChannelManager` facade decomposition, import/export, retry policy, authoring/default shaping, scheduler schedule calculation, EPG runtime behavior, package folder organization, root/package barrels, and compatibility shims.
- Completed `FCP-7` through `FCP-16` implementation work except as read-only guardrails.
- Pre-existing unrelated dirty/untracked workspace paths listed in `## Required Reading`.

## Planner Self-Check

1. No unresolved package-level owner seam remains: `FCP-17-SF1` maps exactly once to `FCP-17-S1`, a single execution unit covering both cache/coalescing and mapping/normalization responsibility isolation.
2. Adjacent contract/type changes are explicit: public ContentResolver methods, public ChannelManager API, `IPlexLibraryMinimal`, `PlexMediaItemMinimal`, `ResolvedContentItem`, storage keys/schema, and Plex behavior are frozen unless a stop/replan condition is met.
3. Files out of scope are not hidden implementation dependencies. `ChannelManager` is in scope only for content-resolution call-site wiring/proof; persistence tests are proof surfaces only for cache-clearing behavior, not persistence changes.
4. Codanna evidence and insufficiencies are recorded, including weak document search, class/method impact gaps, and direct `rg`/source-read fallback for callers and tests.
5. The plan uses repo-preferred owners: `ContentResolver` remains the scheduler source-resolution orchestrator; any extracted cache/coalescing or mapping/normalization owner stays package-local and focused; channel resolved-content cloning stays with `ChannelResolutionCache` unless a replan approves alignment.
6. A fresh cleanup-loop session can start `ready_now_execution_unit` `FCP-17-S1` without deciding package membership, final owners, parallelism, or verification depth.
7. The plan is execution-grade at seam/scope/verification level and deliberately leaves local helper names, file names, and exact extraction mechanics to the cleanup worker as long as the approved seam and proof surface hold.

## Architecture Seam Decision Gate

Approved seam:

- Execute one slice, `FCP-17-S1`, as one coherent execution/review unit. Do not run the checklist candidate `FCP-17-S2` as a separate package coverage owner without a replan.
- Keep `ContentResolver` as the package-local orchestration entrypoint for resolving `ChannelContentSource` values and for the current public helper methods consumed by `ChannelManager`.
- First audit and isolate source-result cache/in-flight coalescing semantics. A focused owner may own stable source serialization, source cache TTL/LRU/epoch/generation behavior, source invalidation, in-flight waiter registration/release, shared abort lifecycle, clone-on-read/write, and all-caches clear behavior. It must not own source-specific Plex resolution, ChannelManager resolved-content cache policy, storage persistence, or public ChannelManager behavior.
- Then audit and isolate mapping/normalization semantics inside the same execution unit. A focused owner may own Plex item to `ResolvedContentItem` mapping, full-title generation, parent metadata decoration, mediaInfo/resolution/audio/HDR normalization, and show-container episode decoration. It must not own Plex library fetch transport, Plex stream URL policy, or ChannelManager filtering/duration/error classification.
- `applyFilters`, `applySort`, and `applyPlaybackMode` may remain public delegating methods on `ContentResolver` or move behind a focused package-local policy owner only if the public call behavior and test surface remain stable. If the worker cannot keep these methods stable without widening `ChannelManager`, stop and replan.
- Preserve current source-resolution behavior: successful results are cached; failed strict expansions are not cached; cached items are cloned and rescheduled; source cache keys ignore `undefined`; `clearCaches` aborts in-flight work; `invalidateSource` aborts matching in-flight work and recursively invalidates mixed sources; one caller abort must not cancel shared work for other callers.
- Preserve current mapping/filtering/sorting behavior: parent show metadata propagation, fullTitle format, mediaInfo HDR/audio/resolution normalization, scheduled-index normalization, filter semantics, sort order, playback ordering, zero-duration filtering through `ChannelManager`, and public error behavior.
- Tests should prove public seams and package-local owner behavior. Prefer moving existing ContentResolver tests to the extracted owner only when the owner has a stable public package-local contract; do not add test-only public accessors or brittle private probes.

Stop and replan if:

- public ChannelManager API or public ContentResolver entrypoint/signature must widen or change;
- persistence behavior, storage keys, key scoping, channel schema, current-channel semantics, selected-server storage behavior, or channel setup persistence become necessary;
- Plex auth, Plex discovery, Plex library transport/parsing behavior, Plex stream URL/subtitle/transcode behavior, navigation, UI/focus, app-shell, orchestrator, player, lifecycle, or Windows platform source changes are required;
- sorting, filtering, playback ordering, zero-duration filtering, scheduled-index normalization, source-empty vs filter-empty errors, cache fallback, show expansion, media metadata normalization, HDR/audio detection, warnings, or abort/error semantics change;
- implementation needs private-probe-only tests instead of public seam or package-local collaborator behavior proof;
- source audit proves `FCP-17-SF1` is already false and planned extraction would be churn;
- source audit proves cache/coalescing and mapping/normalization must have independent final owners, independent execution units, or incompatible verification surfaces;
- newly discovered residue changes package membership, execution-unit membership, final-owner accounting, owner seam, or verification surface.

Absorb-now rule: absorb only newly discovered residue that stays within `FCP-17-S1`'s approved execution-unit goal, owner, seam/files, verification envelope, and final-owner accounting. Record absorbed residue in implementation/review output. Replan for new owners, wider verification, changed source-finding coverage, or changed execution-unit membership.

## Package Decomposition

- `package_id`: `FCP-17`
- `checklist_token`: `FCP-17`
- `source_finding_ids`: `FCP-17-SF1`

`slice_table`:

| slice_id | goal | areas/files | source_finding_ids | verification | dependencies | stop_condition | handoff_condition | serial_only | parallel_justification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FCP-17-S1` | Close the whole ContentResolver mixed-responsibility finding by extracting or source-justifying package-local cache/coalescing and mapping/normalization owners while preserving the public orchestration entrypoint. | `ContentResolver.ts`; new package-local collaborator file(s) only if source-proven; `interfaces.ts`/`types.ts` for private import/type alignment only; `ChannelManager.ts` for narrow call-site preservation only; targeted ContentResolver and ChannelManager content-resolution/error/cache tests. | `FCP-17-SF1` | Pre/post source audits for public entrypoint stability, source cache/in-flight semantics, mapping/filtering/sorting semantics, media metadata normalization, and error behavior; public-seam or package-local collaborator tests for cache/coalescing invariants; `npm test -- ContentResolver ChannelManager.content-resolution`; add `ChannelManager.error-semantics`, `ChannelManager.persistence`, `ChannelManager.transactional`, and `ChannelResolutionCache` only if touched/affected; `npm run typecheck`; `git diff --check`; `npm run plans:check`; `npm run verify:docs`; final `npm run verify`. | None. This is the ready-now execution unit. Within the unit, audit cache/coalescing first, then mapping/normalization; do not split coverage ownership. | Stop if public APIs widen, persistence/Plex/UI/navigation/orchestrator behavior enters scope, semantics drift, tests require private probing, or source audit needs separate final owners for cache/coalescing and mapping/normalization. | `FCP-17-SF1` no longer describes current source, or any retained responsibility has a source-backed final owner/revisit trigger; ContentResolver public behavior is stable; targeted tests and full verification pass; package closeout can update the checklist. | true | Single source finding with overlapping files/tests. Parallel execution would create ambiguous final ownership and duplicate coverage mapping, so this package is serial-only. |

`coverage_check`:

- `FCP-17-SF1` maps only to `FCP-17-S1`.
- No `source_finding_id` is deferred, split, or mapped to both cache/coalescing and mapping/normalization.
- Replan is required before admitting any new source finding, approving a separate `FCP-17-S2` execution unit, or assigning separate final owners to cache/coalescing and mapping/normalization.

`ready_now_slice`: `FCP-17-S1`

`ready_now_execution_unit`: `FCP-17-S1`

`recommended_slice_order`:

1. `FCP-17-S1`

`parallel_execution_policy`: no parallel implementation. The approved package has one source finding, one slice, one execution unit, and one final coverage owner. Cache/coalescing audit/cleanup must happen before mapping/normalization cleanup inside the same execution unit, but both remain under `FCP-17-S1`.

## Verification Commands

- Verification classification: `new regression/contract test required`

Primary proof mode: `contract-first` for source cache/in-flight abort/coalescing, mapping/normalization, filtering/sorting/playback, and public error semantics, with `refactor-invariance` for behavior-preserving package-local extraction.

Plan validation:

- Run: `npm run plans:check`
  - Expected: this active tracked plan satisfies Universal Plan Core and FCP cleanup-overlay structure, including exactly one `FCP-17-SF1` coverage mapping.
- Run after active plan creation/update: `npm run verify:docs`
  - Expected: docs/control-plane verification passes for the active plan. Run again during package closeout if checklist/current-state/modules/plan docs are updated.

Ready-now `FCP-17-S1` source-audit proof:

- Pre-edit source audit over `ContentResolver.ts`, `ChannelManager.ts` content-resolution methods, `ChannelResolutionCache.ts`, `interfaces.ts`, `types.ts`, and targeted tests.
  - Expected: implementation records current public entrypoint behavior, source cache/in-flight semantics, show-list cache behavior, mapping/filtering/sorting behavior, media metadata normalization, and error behavior before editing.
- Post-edit source audit over the same files plus any new package-local ContentResolver collaborators.
  - Expected: `FCP-17-SF1` no longer describes current source, or any retained responsibility is source-justified with one final owner and revisit trigger; public ContentResolver orchestration behavior is stable.
- Public entrypoint/source cache static audits:
  - Run: `rg -n "new ContentResolver|ContentResolver\\(|\\.resolveSource\\(|\\.applyFilters\\(|\\.applySort\\(|\\.applyPlaybackMode\\(|invalidateSource\\(|clearCaches\\(" src docs/plans`
    - Expected: active callers remain inside scheduler/channel-manager code and tests, with no public ChannelManager API widening or new external raw-owner imports.
  - Run: `rg -n "CONTENT_RESOLVER_CACHE_TTL_MS|SHOW_CACHE_TTL_MS|SOURCE_CACHE_TTL_MS|SOURCE_CACHE_MAX_ENTRIES|SourceCacheEntry|SourceInFlightEntry|AbortError|_stableSerialize|_awaitInFlight|_getCachedSourceItems|_setCachedSourceItems" src/modules/scheduler/channel-manager`
    - Expected: TTL/LRU/generation/epoch/waiter/abort/cache-key behavior is either preserved in `ContentResolver` or owned by one package-local cache/coalescing collaborator with stable tests.
- Mapping/normalization static audits:
  - Run: `rg -n "_toResolvedItem|_buildFullTitle|_buildMediaInfo|_normalizeResolution|_detectHdrFromStream|_selectAudioStream|_decorateEpisodeFromParent|detectHdrLabel|mediaInfo|clearLogo|showThumb|addedAt|watched" src/modules/scheduler/channel-manager`
    - Expected: mapping and metadata normalization are either preserved in `ContentResolver` delegating methods or owned by one package-local mapping/normalization collaborator with stable tests; no Plex stream/auth behavior changes.

Focused tests:

- Run: `npm test -- ContentResolver ChannelManager.content-resolution`
  - Expected: source resolution, source-result cache reuse, in-flight coalescing, caller abort isolation, TTL expiry, show-list cache fallback, show expansion, mapping/normalization, filtering/sorting/playback, full-title generation, and ChannelManager content-resolution behavior pass.
- Before implementation closeout, cache/coalescing preservation must be covered by public-seam `ContentResolver` tests or package-local collaborator tests if a collaborator is extracted.
  - Expected: tests explicitly prove max-entry/LRU eviction, `clearCaches` source-cache invalidation and in-flight abort behavior, `invalidateSource` exact-source and mixed-source invalidation plus abort behavior, clone-on-read/write mutation resistance, waiter release, and shared abort semantics. The plan does not prescribe whether those assertions live in existing `ContentResolver` tests or focused collaborator tests; the tested seam must be stable and not private-probe-only.
- Run if error/fallback/invalidation behavior is touched: `npm test -- ChannelManager.error-semantics`
  - Expected: non-fallback failures, cache fallback, source invalidation, retry cancellation, and imported-record failure semantics remain stable.
- Run if `clearCaches`, `invalidateSource`, storage-scope cache-clearing, or replace-all cache-clearing call sites are touched: `npm test -- ChannelManager.persistence ChannelManager.transactional`
  - Expected: storage-scope and replace-all cache clearing still call the resolver boundary without changing persistence behavior.
- Run if resolved channel-content cloning or cache ownership is touched: `npm test -- ChannelResolutionCache`
  - Expected: resolved channel-content cache still owns stored content and returns cloned nested arrays/mediaInfo.

Static and package gates:

- Run: `npm run typecheck`
  - Expected: no TypeScript errors after owner extraction and test updates.
- Run: `git diff --check`
  - Expected: no whitespace errors before commits and package closeout.
- Run: `npm run verify`
  - Expected: full repo verification passes before package closeout because this is scheduler/channel-manager runtime work.

Closeout audits:

- Public entrypoint stability audit:
  - Expected: `ContentResolver` remains the package-local orchestration entrypoint consumed by `ChannelManager`; no external callers consume raw cache/mapping owners.
- Cache/in-flight semantics audit:
  - Expected: cache key stability, TTL, max entries, epoch/generation invalidation, clone-on-read/write, waiter release, shared abort, caller abort isolation, and non-caching of failed strict expansion remain stable.
- Mapping/filtering/sorting semantics audit:
  - Expected: parent metadata propagation, full-title generation, filter behavior, sort order, playback ordering, zero-duration filtering through `ChannelManager`, and scheduled-index normalization remain stable.
- Media metadata normalization audit:
  - Expected: resolution, HDR, Dolby Vision profile, audio codec/channels/title, clearLogo/art/showThumb, watched, addedAt, summary, genres, directors, contentRating, and rating behavior remain stable.
- Error behavior preservation audit:
  - Expected: source-empty vs filter-empty errors, abort propagation, show-list fallback warning behavior, strict show expansion failures, source invalidation after access denied, and retry/cache fallback behavior remain stable.

## Rollback Notes

If implementation breaks behavior or verification, revert only the `FCP-17` implementation diff and any same-pass `FCP-17` checklist/current-state updates. Preserve pre-existing unrelated dirty/untracked workspace paths.

Rollback should restore `ContentResolver.ts`, any new package-local ContentResolver collaborator files, touched scheduler/channel-manager tests, and narrow `ChannelManager.ts` call-site changes. Do not roll back completed `FCP-16` persistence work or unrelated docs.

If a partial extraction lands and then fails review, prefer reverting the partial extraction rather than leaving temporary adapters or compatibility shims. A new plan/review pass is required before attempting a different owner split.

## Commit Checkpoints

- Planning checkpoint: commit only this plan artifact if the controller wants a tracked-doc checkpoint; do not bundle unrelated dirty/untracked files.
- Implementation checkpoint: after `FCP-17-S1` implementation, targeted tests, typecheck, diff check, and implementation review pass, create one focused non-interactive implementation commit for production/test changes. Exclude active tracked plan docs unless the controller explicitly commits plan progress separately.
- Closeout checkpoint: after final verification and clean review, update `ARCHITECTURE_CLEANUP_CHECKLIST.md` and any required architecture docs in a separate tracked-doc closeout commit if the controller chooses to commit closeout docs.

## Closeout Evidence

- Implementation commits:
  - `43bbd179` (`FCP-17-S1` implementation)
  - `0343b591` (mixed-source cache invalidation test follow-up)
- Source finding disposition:
  - `FCP-17-SF1`: resolved. `ContentResolver` remains the public package-local
    source-resolution orchestration entrypoint, while `SourceResolutionCache`
    owns source-result cache/in-flight coalescing, `ContentItemMapper` owns Plex
    item mapping and media metadata normalization, and
    `ContentSelectionPolicy` owns filtering, sorting, and playback ordering.
- Review evidence:
  - Plan review initially found checklist-state and verification-plan gaps;
    the planner revised the plan/checklist, the same reviewer confirmed closure,
    and a fresh final plan reviewer approved `FCP-17-S1` for implementation.
  - Implementation review initially found a missing mixed-source cached
    invalidation proof; the worker added the public-seam test in `0343b591`,
    the same reviewer confirmed closure, and a fresh final implementation
    reviewer approved `FCP-17-S1` for package closeout.
- Verification evidence:
  - `npm test -- ContentResolver ChannelManager.content-resolution`
  - `npm test -- ChannelManager.error-semantics`
  - `npm run typecheck`
  - `git diff --check`
  - `npm run verify`
