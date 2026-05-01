**Plan Status:** completed
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

# DCR-15 Player, Plex Runtime, Settings, And Media Contracts Plan

## Goal

Retire the eight `DCR-15` findings admitted by the DCR-EXIT S0 source audit while preserving Lineup's current playback, Plex, settings, and persistence contracts.

This is one package-scoped cleanup plan. The package spans multiple owners, but the issues share one cleanup goal: make player/runtime teardown, Plex stream/library contracts, settings policy precedence, and persistence warning behavior explicit enough for `DCR-EXIT-S2` to proceed after `DCR-16`.

ready_now_execution_unit: none; package complete

ready_now_slice: none; package complete

Execution is serial by default. Parallel implementation is unavailable unless this plan is revised after a clean review with proven disjoint writes and verification.

## Non-Goals

- Do not implement `DCR-14` EPG/UI source work or change EPG runtime behavior.
- Do not implement `DCR-16` production source-signal cleanup.
- Do not resume `DCR-EXIT-S2`; this package only unblocks it partially.
- Do not run Desloppify runtime, queue/import output, review packets, scans, or score refresh.
- Do not redesign Plex auth/session ownership. `DCR-15-A7` is identity metadata parity only.
- Do not change public parser null/empty/error semantics beyond required scalar validation for malformed external Plex payloads.
- Do not widen token-bearing logs or add new debug payload fields that can expose Plex tokens or URLs containing `X-Plex-Token`.

## Parent Priority Alignment

`DCR-15` is a checklist-linked DCR follow-up package in `ARCHITECTURE_CLEANUP_CHECKLIST.md`, admitted from the local DCR-EXIT S0 audit. It must close before `DCR-EXIT-S2` package reconciliation can resume.

The parent `DCR-EXIT` plan records `DCR-15` as the owner for:

- `F-S0L02-002`
- `S0-L03-F02`
- `S0-L03-F03`
- `S0-L03-F04`
- `S0-L06-NQ-001`
- `S0-L07-001`
- `S0-L15-F1`
- `TS-001`

Closeout must update the `DCR-15` checklist mini-record, this active plan status/ledger, and the `DCR-EXIT` blocker references so `DCR-EXIT-S2` remains blocked on `DCR-16` only. It must not start `DCR-EXIT-S2` or implement `DCR-16`.

## Required Reading

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/cleanup-loop.md`
4. `docs/agentic/plan-authoring-standard.md`
5. `docs/agentic/codanna-playbook.md`
6. `ARCHITECTURE_CLEANUP_CHECKLIST.md` section `DCR-15`
7. `docs/plans/2026-04-30-dcr-exit-final-dimension-audit-plan.md`
8. The DCR-EXIT S0 local run findings snapshot embedded in this plan for lanes `S0-L02`, `S0-L03`, `S0-L06`, `S0-L07`, `S0-L11`, `S0-L15`, and the S0 synthesis. The planner read the parent-specified local run artifacts during plan authoring; active tracked plans must not promote those local-only run paths into durable required-reading dependencies.
9. `docs/architecture/CURRENT_STATE.md` sections for storage, Plex, player/runtime, hotspots, and working rules
10. `docs/api/plex-integration.md`
11. This plan

Freshness gate: before implementation, run `git status --short` and stop if `ARCHITECTURE_CLEANUP_CHECKLIST.md`, this plan, relevant `CURRENT_STATE` Plex/player/settings ownership lines, or DCR-15 target source/test files are already dirty in a way that changes package meaning. Treat older untracked plan drafts and existing DCR-14 changes as protected. Do not touch EPG/UI DCR-14 source files.

## Required Skills

- `architecture-boundaries`
- `plex-integration-boundaries`
- `persistence-boundaries`
- `verification-strategy`
- `execution-plan-authoring`
- `model-selection`
- `parallel-sidecars`

`parallel-sidecars` is conceptual only for this plan because parallel execution is not approved. Use read-only sidecars only for focused review or blocking discovery, never for writes.

## Codanna Discovery

Planning discovery used Codanna first, then deterministic reads for exact proof.

- `get_index_info`: 11,836 symbols across 759 files, semantic search enabled, index updated 31 minutes before planning.
- `semantic_search_with_context`: `RetryManager metadata error listener retry unload destroy stale synthetic error` found `RetryManager.handleMediaError`, `VideoPlayerEvents._handleError`, and `ErrorHandler` as the player retry path.
- `semantic_search_with_context`: `persistence warning backoff lifecycle ChannelManager storage warning policy` found `ChannelManager` and save/persistence paths but was too broad for exact duplicate code proof.
- `semantic_search_with_context`: `native text-track debug snapshot VideoPlayer SubtitleManager subtitle debug token logs` was weak for the snapshot owner, so direct `rg` proved duplicate `_snapshotNativeTextTracks()`.
- `semantic_search_with_context`: `HDR10 fallback mode precedence PlaybackSettingsStore SettingsStore dvHdr10Fallback playbackCompatibilityPolicy PlexStreamResolver` found `PlexStreamResolver`, stream interfaces, and settings/HDR policy surfaces.
- `semantic_search_with_context`: `PlaybackRecoveryManager reset fallback burn-in attempt reset method name` found player retry/recovery neighbors but was weak for the exact method, so direct `rg` proved the method/caller.
- `semantic_search_with_context`: `PlexStreamResolver universal decision debug fetch stopTranscodeSession 401 403 global stream error` found `PlexStreamResolver`, stream error types, and `PlexApiError`.
- `semantic_search_with_context`: `Plex identity metadata client device identifier auth config platform stream callers clientIdentifier` found `PlexAuth`, `PlexAuthConfig`, and auth payload parsing.
- `semantic_search_with_context`: `Plex library media parsers required scalar fields external payload cast app-facing media types` found `RawMediaItem`, `RawStream`, parser functions, and `IPlexLibrary`.
- `search_documents`: `DCR-15 Player Plex Runtime Settings Media Contracts` and `DCR-EXIT S0 DCR-15 RetryManager HDR10 Plex identity media parsers` returned related architecture/eval/planning context, but direct reads of the required local DCR-EXIT artifacts were needed for exact S0 finding records.
- `analyze_impact RetryManager`: impacts `VideoPlayer.initialize`, `VideoPlayerEvents.attach`, `VideoPlayer`, and `VideoPlayerEvents` tests.
- `analyze_impact stopTranscodeSession`: impacts priority-one runtime assembly, playback runtime controller, channel tuning, subtitle recovery, and `PlaybackRecoveryManager`.
- `analyze_impact RawMediaItem`: impacts media item base/core/details parsers, search metadata extraction, `PlexLibrary.getItem`, and `PlexLibrary.search`.
- `analyze_impact PlaybackRecoveryManager`: impacts orchestrator coordinator assembly/builders and `AppOrchestrator`.
- `analyze_impact PlaybackSettingsStore`: impacts `SettingsStore`, `SettingsScreenStateController`, and settings deps tests.

Fallback reads: `rg` and `sed` read the required docs, S0 reports, `CURRENT_STATE`, `docs/api/plex-integration.md`, package scripts, and the exact source/test files named below. Codanna was sufficient for owner discovery and impact shape, not for exact line-level duplicate/error proof.

## Impact Snapshot

Current source supports all eight DCR-15 findings as live package work.

| Issue | Current-source proof | Chosen owner | Files in/out | Disposition path | Verification | Stop/replan trigger |
| --- | --- | --- | --- | --- | --- | --- |
| `DCR-15-A1` / `F-S0L02-002` | `RetryManager._retryPlayback()` creates local `loadedmetadata`/`error` listeners and only local `cleanup()` can remove them; `clear()` clears timers but has no active listener disposer. `VideoPlayer.destroy()` calls `RetryManager.destroy()` before `VideoPlayerEvents.detach()`, so late retry listeners can still seek/play or dispatch synthetic errors if not owned by `RetryManager`. | Player/runtime retry owner: `RetryManager` with `VideoPlayerEvents` tests proving teardown. | In: `src/modules/player/RetryManager.ts`, `VideoPlayerEvents.ts` if needed for test-visible contract, player tests. Out: Plex, EPG/UI, orchestrator behavior except existing destroy/unload calls. | Fix in `DCR-15-S1` by making retry-owned metadata/error listeners removable during `clear()`/`destroy()` and stale-safe after teardown. | Focused player retry tests, then player bundle and full closeout gates. | Stop if fix requires changing `VideoPlayerEvents` global error semantics or playback-critical media error contract. |
| `DCR-15-A2` / `S0-L03-F02` | `LifecycleStatePersistenceQueue._shouldEmitPersistenceWarning()` and `ChannelPersistenceSaveQueue._shouldEmitPersistenceWarning()` duplicate warning timing/backoff/quota reset policy while emitting different payload shapes. | Persistence warning policy owner: `src/utils/persistenceWarningBackoffPolicy.ts` owns timing/backoff/quota reset mechanics only; lifecycle and channel queues remain payload/schema owners. | In: `src/utils/persistenceWarningBackoffPolicy.ts`, lifecycle queue, channel save queue, shared helper tests, lifecycle/channel tests. Out: channel domain save semantics, lifecycle/channel warning payload schemas, and storage keys. | Fix in `DCR-15-S2` by moving warning timing/backoff decisions into `PersistenceWarningBackoffPolicy` while each caller keeps constructing its own warning payload. | `PersistenceWarningBackoffPolicy` unit tests plus lifecycle state queue and ChannelPersistenceSaveQueue/ChannelManager persistence tests. | Stop if `PersistenceWarningBackoffPolicy` cannot preserve both caller payload contracts or would need to own storage schema/domain-specific warning messages. |
| `DCR-15-A3` / `S0-L03-F03` | `VideoPlayer._snapshotNativeTextTracks()` and `SubtitleManager._snapshotNativeTextTracks()` are copied, including the same native text track fields. Debug URL redaction exists elsewhere and must not be widened. | Player/subtitle debug owner: one player-owned native text-track debug snapshot helper consumed by both. | In: `src/modules/player/VideoPlayer.ts`, `SubtitleManager.ts`, helper if extracted, relevant tests. Out: Plex subtitle probe logs, token-bearing URL logging. | Fix in `DCR-15-S3` by consolidating snapshot logic behind one owner. | VideoPlayer and SubtitleManager debug payload tests. | Stop if consolidation would expose URLs/tokens or require Plex debug log contract changes. |
| `DCR-15-A4` / `S0-L03-F04` | HDR10 mode precedence appears in `PlaybackSettingsStore.readHdr10FallbackModeAndClean()`, `SettingsStore.readHdr10FallbackModeValueAndClean()`/`writeHdr10FallbackModeValue()`, and `dvHdr10Fallback.computeHdr10FallbackMode()`, while `PlexStreamResolver` consumes the settings reader. | Plex/settings boundary owner: `PlaybackSettingsStore` owns storage normalization and one mode decision; stream policy consumes normalized mode. | In: `PlaybackSettingsStore.ts`, `SettingsStore.ts`, `dvHdr10Fallback.ts`, stream resolver/policy tests. Out: UI layout, storage key renames, public setting labels. | Fix in `DCR-15-S4` by making force-over-smart mode precedence one shared owner consumed consistently by UI facade and Plex policy. | PlaybackSettingsStore, SettingsStore, dvHdr10Fallback/playbackCompatibilityPolicy, PlexStreamResolver tests. | Stop if storage schema or public settings API redesign is required. |
| `DCR-15-A5` / `S0-L06-NQ-001` | `PlaybackRecoveryManager.resetDirectFallbackAttempts()` clears both `_directFallbackAttemptedForItemKey` and `_burnInAttemptedForItemKey`; caller `resetChannelTuningPlaybackGuards()` hides the burn-in reset behind a direct-fallback name. | Player/runtime recovery owner: `PlaybackRecoveryManager` public method naming plus orchestrator builder caller. | In: `PlaybackRecoveryManager.ts`, `OrchestratorCoordinatorBuilders.ts`, focused tests. Out: recovery algorithm behavior. | Fix in `DCR-15-S5` with a behavior-preserving rename or alias-removal that accurately names direct fallback plus burn-in attempt reset. | Focused PlaybackRecoveryManager/orchestrator builder tests and typecheck. | Stop if public caller behavior must change rather than method naming/type references. |
| `DCR-15-A6` / `S0-L07-001` | `_createError()` always emits resolver `error`; `_throwIfAuthFailure()` uses `_createError()` inside best-effort `stopTranscodeSession()`. Optional debug universal decision fetch uses the same public fetch path and can throw auth/access errors that are intended for debug logging only. Orchestrator forwards resolver `error` events globally. | Plex stream/runtime error-boundary owner: `PlexStreamResolver` creates silent/local errors for optional/best-effort paths and still emits playback-critical resolver errors. | In: `PlexStreamResolver.ts`, stream resolver tests, possibly universal decision client tests. Out: Orchestrator global error handling except proof tests. | Fix in `DCR-15-S6` by separating playback-critical emitting errors from optional/debug/best-effort local failures. | Tests proving debug universal-decision and stop cleanup `401`/`403` do not emit global stream errors, while critical resolver failures still do. | Stop on any playback-critical stream error contract change. |
| `DCR-15-A7` / `S0-L15-F1` | `createDefaultPlexAuthConfig()` owns resolved `clientIdentifier` plus auth metadata and uses `deviceName: 'Living Room TV'`; `platform/webosPlatformServices.ts` owns default stream identity with `X-Plex-Device-Name: 'Lineup'`; stream resolver adapts platform defaults via `getDefaultPlexIdentity()`. | Canonical Plex identity metadata owner: `src/modules/plex/auth/config.ts`. `clientIdentifier.ts` may only resolve/generate/persist `lineup_client_id`; `PlexAuth` may only consume canonical config for headers; platform identity may only adapt canonical metadata plus platform detection/model fields into Plex identity params; stream callers may only pass/consume canonical metadata and must not generate independent product/device names. | In: `src/modules/plex/auth/config.ts`, `src/modules/plex/auth/clientIdentifier.ts`, `src/modules/plex/auth/interfaces.ts`, `src/modules/plex/auth/PlexAuth.ts`, `src/platform/services.ts`, `src/platform/webosPlatformServices.ts`, `src/modules/plex/stream/interfaces.ts`, `src/modules/plex/stream/PlexStreamResolver.ts`, parity tests. Out: auth/session credential lifecycle, Home user switching, selected server persistence, and independent platform-owned product/device defaults. | Fix in `DCR-15-S7` by making auth config the single source for client/device identity metadata and converting platform/stream/auth paths into consumers/adapters with parity tests. | Focused auth config/client ID/PlexAuth/platform/stream identity parity tests and relevant Plex auth/stream suites. | Stop/replan if identity parity requires auth/session ownership changes, selected-server persistence changes, or a second product/device metadata generator outside `config.ts`. |
| `DCR-15-A8` / `TS-001` | `parseRequiredObject<T>()` object-checks then casts external payloads; `buildBaseMediaItem()` reads `ratingKey`, `key`, `type`, `title` as if scalars are valid; `parseStream()` stringifies `id`, normalizes `streamType`, and defaults `codec` without proving required scalar fields from external Plex payloads. | Plex library parsing/API owner: parser validation helpers and media parser ingress. | In: parser validation, media item/media file/stream parsers, parser/library tests. Out: public parser API redesign and semantic null/empty behavior. | Fix in `DCR-15-S8` by validating required scalar fields before exposing app-facing media types. | Parser tests for missing/wrong typed required fields, targeted Plex library parser/library tests, typecheck. | Stop if parser public API redesign or semantic null-empty-error behavior changes beyond scalar validation are required. |

## Package Decomposition

- `package_id`: `DCR-15`
- `checklist_token`: `DCR-15`
- `ready_now_execution_unit`: none; package complete
- `ready_now_slice`: none; package complete
- `parallel_execution_policy`: serial only. The package completed serially through `DCR-15-S1` through `DCR-15-S8`.
- `package_issue_ids`:
  - `DCR-15-A1`
  - `DCR-15-A2`
  - `DCR-15-A3`
  - `DCR-15-A4`
  - `DCR-15-A5`
  - `DCR-15-A6`
  - `DCR-15-A7`
  - `DCR-15-A8`

`slice_table`:

| slice_id | goal | areas/files | exact_issue_ids | verification | dependencies | stop_condition | handoff_condition | parallel policy |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DCR-15-S1` | Make retry-created metadata/error listeners teardown-owned and stale-safe. | `RetryManager.ts`, player event/player tests; `VideoPlayerEvents.ts` only if needed for contract proof. | `DCR-15-A1`, `F-S0L02-002` | Focused retry/player tests; no stale seek/play/synthetic error after unload/destroy. | None. | Stop if media error contract or `VideoPlayerEvents` global handling must change. | Tests prove late retry metadata/error events after `clear()`/`destroy()` do nothing. | `serial_only`; starts package. |
| `DCR-15-S2` | Consolidate persistence warning backoff policy into the named shared mechanics owner. | `src/utils/persistenceWarningBackoffPolicy.ts`, `LifecycleStatePersistenceQueue.ts`, `ChannelPersistenceSaveQueue.ts`, `src/utils/__tests__/persistenceWarningBackoffPolicy.test.ts`, lifecycle/channel tests. | `DCR-15-A2`, `S0-L03-F02` | Shared policy, lifecycle, and ChannelManager save warning tests. | `DCR-15-S1` complete. | Stop if `PersistenceWarningBackoffPolicy` cannot preserve both event payload contracts without owning caller schemas/messages. | Both callers use `PersistenceWarningBackoffPolicy` for timing/backoff/reset mechanics, keep their payload construction locally, and tests prove quota backoff/reset behavior. | `serial_only`; overlaps storage/persistence suites. |
| `DCR-15-S3` | Consolidate native text-track debug snapshot logic. | `VideoPlayer.ts`, `SubtitleManager.ts`, player helper/tests. | `DCR-15-A3`, `S0-L03-F03` | VideoPlayer and SubtitleManager debug payload tests. | `DCR-15-S1` complete. | Stop if debug consolidation widens token-bearing logs or changes Plex debug probe contracts. | One snapshot owner consumed by both player/subtitle paths. | `serial_only`; overlaps player tests with S1/S5. |
| `DCR-15-S4` | Make HDR10 fallback mode precedence single-owned and consistently consumed. | `PlaybackSettingsStore.ts`, `SettingsStore.ts`, `dvHdr10Fallback.ts`, `playbackCompatibilityPolicy.ts`, `PlexStreamResolver.ts` tests. | `DCR-15-A4`, `S0-L03-F04` | Settings store, HDR policy, stream resolver tests. | `DCR-15-S2` preferred so storage helper churn is settled. | Stop if storage schema, public setting labels, or settings UI contract must change. | Force-over-smart precedence lives in one owner; callers consume normalized mode. | `serial_only`; shared settings/Plex verification. |
| `DCR-15-S5` | Rename/reset recovery API so it describes direct fallback and burn-in attempt reset behavior. | `PlaybackRecoveryManager.ts`, `OrchestratorCoordinatorBuilders.ts`, focused tests. | `DCR-15-A5`, `S0-L06-NQ-001` | PlaybackRecoveryManager/orchestrator builder tests and typecheck. | `DCR-15-S1` and `DCR-15-S3` complete to avoid player test churn. | Stop if recovery behavior changes are needed. | Caller behavior preserved and method name matches both reset effects. | `serial_only`; player/runtime overlap. |
| `DCR-15-S6` | Keep optional Plex debug/best-effort cleanup auth failures out of global stream errors while preserving critical error surfacing. | `PlexStreamResolver.ts`, stream resolver tests, orchestrator proof tests only if required. | `DCR-15-A6`, `S0-L07-001` | Stream resolver tests for optional/debug/cleanup 401/403 and critical auth/access-denied events. | `DCR-15-S4` preferred because resolver tests overlap. | Stop on playback-critical stream error contract change. | Optional/best-effort paths are local/logged; critical resolver errors still emit globally. | `serial_only`; Plex stream shared surface. |
| `DCR-15-S7` | Establish `src/modules/plex/auth/config.ts` as the source of truth for Plex identity metadata parity. | `src/modules/plex/auth/config.ts`, `src/modules/plex/auth/clientIdentifier.ts`, `src/modules/plex/auth/interfaces.ts`, `src/modules/plex/auth/PlexAuth.ts`, `src/platform/services.ts`, `src/platform/webosPlatformServices.ts`, `src/modules/plex/stream/interfaces.ts`, `src/modules/plex/stream/PlexStreamResolver.ts`, auth/platform/stream identity tests. | `DCR-15-A7`, `S0-L15-F1` | Auth config/client ID/PlexAuth/platform/stream identity parity tests. | `DCR-15-S6` complete to avoid stream test churn. | Stop if auth/session ownership, selected-server persistence, or a second product/device metadata generator is required. | `config.ts` owns canonical product/version/platform/device/deviceName plus resolved client ID assembly; `clientIdentifier.ts` owns only ID resolution/persistence; auth/platform/stream callers consume or adapt those values without independent product/device generation. | `serial_only`; auth/stream identity overlap. |
| `DCR-15-S8` | Validate required scalar fields before Plex library parsers expose app-facing media types. | `parserValidation.ts`, media item/media file/stream parsers, Plex library parser tests. | `DCR-15-A8`, `TS-001` | Parser missing/wrong-type tests, targeted Plex library tests, typecheck. | `DCR-15-S7` complete. | Stop on parser public API redesign or semantic null/empty/error changes beyond scalar validation. | Malformed external scalar payloads reject as parser errors; semantic empties remain unchanged. | `serial_only`; final implementation slice before integration. |

`coverage_check`:

- `DCR-15-A1` maps only to `DCR-15-S1`.
- `DCR-15-A2` maps only to `DCR-15-S2`.
- `DCR-15-A3` maps only to `DCR-15-S3`.
- `DCR-15-A4` maps only to `DCR-15-S4`.
- `DCR-15-A5` maps only to `DCR-15-S5`.
- `DCR-15-A6` maps only to `DCR-15-S6`.
- `DCR-15-A7` maps only to `DCR-15-S7`.
- `DCR-15-A8` maps only to `DCR-15-S8`.

`recommended_slice_order`:

1. `DCR-15-S1`
2. `DCR-15-S2`
3. `DCR-15-S3`
4. `DCR-15-S4`
5. `DCR-15-S5`
6. `DCR-15-S6`
7. `DCR-15-S7`
8. `DCR-15-S8`
9. Package integration and closeout

No `execution_waves` or `coverage_ledger` are used because the approved ready-now execution unit is a single slice and this plan does not approve a multi-slice wave.

## Files In Scope

Production files that may be edited when their slice is active:

- `src/modules/player/RetryManager.ts`
- `src/modules/player/VideoPlayerEvents.ts`
- `src/modules/player/VideoPlayer.ts`
- `src/modules/player/SubtitleManager.ts`
- `src/modules/player/PlaybackRecoveryManager.ts`
- `src/core/orchestrator/OrchestratorCoordinatorBuilders.ts`
- `src/modules/lifecycle/LifecycleStatePersistenceQueue.ts`
- `src/modules/scheduler/channel-manager/ChannelPersistenceSaveQueue.ts`
- `src/utils/persistenceWarningBackoffPolicy.ts`
- `src/modules/settings/PlaybackSettingsStore.ts`
- `src/modules/ui/settings/SettingsStore.ts`
- `src/modules/plex/stream/dvHdr10Fallback.ts`
- `src/modules/plex/stream/playbackCompatibilityPolicy.ts`
- `src/modules/plex/stream/PlexStreamResolver.ts`
- `src/modules/plex/stream/UniversalTranscodeDecisionClient.ts` only if optional debug error ownership cannot be fixed solely in `PlexStreamResolver`
- `src/modules/plex/auth/config.ts`
- `src/modules/plex/auth/clientIdentifier.ts`
- `src/modules/plex/auth/interfaces.ts`
- `src/modules/plex/auth/PlexAuth.ts`
- `src/platform/services.ts`
- `src/platform/webosPlatformServices.ts`
- `src/modules/plex/stream/interfaces.ts`
- `src/modules/plex/library/parsing/parserValidation.ts`
- `src/modules/plex/library/parsing/mediaItemBaseParser.ts`
- `src/modules/plex/library/parsing/mediaItemCoreParser.ts`
- `src/modules/plex/library/parsing/mediaItemParser.ts`
- `src/modules/plex/library/parsing/mediaFileParser.ts`
- `src/modules/plex/library/parsing/streamParser.ts`
- `src/modules/plex/library/parsing/libraryResponsePayload.ts`

Test files in scope:

- `src/modules/player/__tests__/VideoPlayerEvents.test.ts`
- `src/modules/player/__tests__/VideoPlayer.test.ts`
- `src/modules/player/__tests__/SubtitleManager.test.ts`
- `src/modules/player/__tests__/PlaybackRecoveryManager.test.ts`
- `src/utils/__tests__/persistenceWarningBackoffPolicy.test.ts`
- `src/modules/lifecycle/__tests__/LifecycleStatePersistenceQueue.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelPersistenceSaveQueue.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.persistence.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.transactional.test.ts`
- `src/modules/settings/__tests__/PlaybackSettingsStore.test.ts`
- `src/modules/ui/settings/__tests__/SettingsStore.test.ts`
- `src/modules/plex/stream/__tests__/dvHdr10Fallback.test.ts`
- `src/modules/plex/stream/__tests__/playbackCompatibilityPolicy.test.ts`
- `src/modules/plex/stream/__tests__/PlexStreamResolver.test.ts`
- `src/modules/plex/stream/__tests__/plexStreamUrlPolicy.test.ts`
- `src/modules/plex/auth/__tests__/config.test.ts`
- `src/modules/plex/auth/__tests__/clientIdentifier.test.ts`
- `src/modules/plex/auth/__tests__/PlexAuth.test.ts`
- `src/platform/webosPlatformServices.test.ts`
- `src/modules/plex/library/__tests__/parserValidation.test.ts`
- `src/modules/plex/library/__tests__/mediaItemParser.test.ts`
- `src/modules/plex/library/__tests__/mediaItemInternals.test.ts`
- `src/modules/plex/library/__tests__/mediaFileParser.test.ts`
- `src/modules/plex/library/__tests__/streamParser.test.ts`
- `src/modules/plex/library/__tests__/PlexLibrary.test.ts`
- `src/modules/plex/library/__tests__/ResponseParser.test.ts`

Closeout docs in scope only after implementation/review is clean:

- `ARCHITECTURE_CLEANUP_CHECKLIST.md`
- this plan
- `docs/plans/2026-04-30-dcr-exit-final-dimension-audit-plan.md`
- `docs/architecture/CURRENT_STATE.md` only if implementation changes ownership claims
- `docs/api/plex-integration.md` only if the public Plex contract changes

## Files Out Of Scope

- DCR-14 EPG/UI source and test files not listed above, especially `src/modules/ui/epg/**`.
- DCR-16 production source-signal files unless a replan explicitly moves them out of `DCR-16`.
- `src/App.ts`, `src/Orchestrator.ts`, and broad app-shell composition roots except for read-only verification.
- Plex auth/session lifecycle redesign, selected-server persistence, Home user switching, and server selection.
- Independent product/device identity metadata generation outside `src/modules/plex/auth/config.ts`; platform and stream code may adapt canonical metadata but must not own separate defaults.
- Public parser API redesign or null/empty/not-found semantic changes.
- Desloppify outputs, scan artifacts, review packets, queue/import files, and score refresh artifacts.

## Planner Self-Check

1. Unresolved architecture seam? No. Each slice names one owner and stop/replan triggers for any seam that would widen.
2. Adjacent contract/type changes hidden out of scope? No. Adjacent files are either in scope for their slice or explicitly frozen.
3. Out-of-scope files still implicitly required? No. EPG/UI DCR-14 and DCR-16 files are excluded; DCR-15 can close without them.
4. Codanna evidence path recorded? Yes, with queries, impact snapshots, and deterministic fallback reads.
5. Repo-preferred owners? Yes: player/runtime, persistence owners, Plex stream/library/auth/platform identity, and settings stores match `CURRENT_STATE`.
6. Fresh-session invention required? No important ownership, verification, or stop/replan policy remains implicit.
7. Execution-grade? Yes for serial cleanup-worker execution; the plan does not prescribe full patches or local helper names beyond owner/seam constraints.

## Architecture Seam Decision Gate

The package seam is frozen as eight serial slices under one integration gate.

Preservation contracts:

- `RetryManager.clear()`/`destroy()` must make retry-owned timers/listeners inert; late retry metadata/error events must not seek/play or dispatch stale synthetic errors.
- Persistence warning payload shapes remain caller-owned; warning backoff timing/quota reset mechanics move to `src/utils/persistenceWarningBackoffPolicy.ts`.
- Subtitle/player debug consolidation must not add token-bearing URLs or widen debug logging.
- HDR10 mode storage keys remain unchanged; force-over-smart semantics must remain stable.
- Recovery reset behavior remains unchanged; only naming/API clarity changes.
- Playback-critical Plex resolver auth/access failures must still surface globally.
- Plex identity work is metadata parity only; `src/modules/plex/auth/config.ts` owns canonical product/version/platform/device/deviceName metadata and resolved client ID assembly, `clientIdentifier.ts` owns only `lineup_client_id` resolution/persistence, and auth/platform/stream callers consume or adapt those values without independent metadata generation.
- Plex library malformed payloads reject as parser errors; real semantic not-found/empty outcomes remain `null`/empty arrays per `docs/api/plex-integration.md`.

Stop/replan triggers:

- Auth/session ownership changes beyond identity metadata parity are required.
- `DCR-15-S2` requires persistence warning payload/schema ownership to move into `src/utils/persistenceWarningBackoffPolicy.ts` instead of keeping payloads in lifecycle/channel callers.
- `DCR-15-S7` requires product/device identity metadata generation outside `src/modules/plex/auth/config.ts`.
- Playback-critical stream error contract changes are required.
- Parser public API redesign or semantic null-empty-error changes beyond scalar validation are required.
- The implementer cannot name one owner/proof for an issue.
- Package scope needs multiple disjoint plans instead of one DCR-15 package goal.
- Verification failures appear outside DCR-15 seams.
- Work overlaps with DCR-14 dirty UI/EPG or DCR-16 source-signal files.
- Current-source proof disproves or reclassifies any DCR-15 issue.
- Protected files named in the freshness gate are dirty in a way that changes package meaning.

## Verification Commands

Primary verification mode: `contract-first` with `refactor-invariance` support.

Plan classification: `new regression/contract test required`.

Focused tests must be added or updated wherever existing coverage does not prove the fixed contract. At minimum, each slice must run its focused suites before handoff:

```bash
npm run test:unit -- --runInBand src/modules/player/__tests__/VideoPlayerEvents.test.ts src/modules/player/__tests__/VideoPlayer.test.ts
npm run test:unit -- --runInBand src/utils/__tests__/persistenceWarningBackoffPolicy.test.ts src/modules/lifecycle/__tests__/LifecycleStatePersistenceQueue.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelPersistenceSaveQueue.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.persistence.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.transactional.test.ts
npm run test:unit -- --runInBand src/modules/player/__tests__/SubtitleManager.test.ts src/modules/player/__tests__/VideoPlayer.test.ts
npm run test:unit -- --runInBand src/modules/settings/__tests__/PlaybackSettingsStore.test.ts src/modules/ui/settings/__tests__/SettingsStore.test.ts src/modules/plex/stream/__tests__/dvHdr10Fallback.test.ts src/modules/plex/stream/__tests__/playbackCompatibilityPolicy.test.ts src/modules/plex/stream/__tests__/PlexStreamResolver.test.ts
npm run test:unit -- --runInBand src/modules/player/__tests__/PlaybackRecoveryManager.test.ts
npm run test:unit -- --runInBand src/modules/plex/stream/__tests__/PlexStreamResolver.test.ts src/core/orchestrator/__tests__/OrchestratorRecoverableRuntimeReporter.test.ts
npm run test:unit -- --runInBand src/modules/plex/auth/__tests__/config.test.ts src/modules/plex/auth/__tests__/clientIdentifier.test.ts src/modules/plex/auth/__tests__/PlexAuth.test.ts src/platform/webosPlatformServices.test.ts src/modules/plex/stream/__tests__/PlexStreamResolver.test.ts src/modules/plex/stream/__tests__/plexStreamUrlPolicy.test.ts
npm run test:unit -- --runInBand src/modules/plex/library/__tests__/parserValidation.test.ts src/modules/plex/library/__tests__/mediaItemParser.test.ts src/modules/plex/library/__tests__/mediaItemInternals.test.ts src/modules/plex/library/__tests__/mediaFileParser.test.ts src/modules/plex/library/__tests__/streamParser.test.ts src/modules/plex/library/__tests__/PlexLibrary.test.ts src/modules/plex/library/__tests__/ResponseParser.test.ts
```

Closeout commands after all slices and reviews are clean:

```bash
npm run typecheck
npm run verify
npm run plans:check
npm run verify:docs
git diff --check
```

Use `npm run verify:docs:workspace` only during active plan churn if local plan references are temporarily unstable. It is not a closeout substitute.

Expected outcome: focused suites pass after the relevant slice, full `npm run verify` passes before package closeout, `plans:check` and `verify:docs` accept the active plan/checklist updates, and `git diff --check` reports no whitespace errors.

## Rollback Notes

- If a slice fails verification after code changes, revert only that slice's own edits or rework inside the approved files. Do not revert unrelated dirty user work.
- If player retry teardown changes regress playback events, roll back `DCR-15-S1` before attempting later player slices.
- If `PersistenceWarningBackoffPolicy` extraction changes warning payloads or timing beyond the shared mechanics policy, roll back `DCR-15-S2` and replan the owner.
- If Plex stream error changes suppress critical playback failures, roll back `DCR-15-S6` and replan before continuing.
- If parser validation changes public semantic empty/null behavior, roll back `DCR-15-S8` and replan the parser contract.

## Commit Checkpoints

Use focused non-interactive implementation commits by coherent slice group after clean review:

1. `DCR-15-S1` player retry teardown.
2. `DCR-15-S2` persistence warning policy.
3. `DCR-15-S3` through `DCR-15-S5` player/settings cleanup if the diff remains coherent; split if tests or review findings are separate.
4. `DCR-15-S6` through `DCR-15-S7` Plex stream/identity cleanup if review accepts the shared Plex scope; split if auth/stream ownership is contentious.
5. `DCR-15-S8` parser validation.
6. Docs/checklist closeout in a separate tracked-doc commit, excluding implementation-only churn.

Active tracked plan docs in `docs/plans/` must not be bundled into implementation commits unless the controller explicitly chooses a separate tracked-doc checkpoint.

MODEL_SUGGESTION
PLANNER: `gpt-5.5 high`
IMPLEMENTER: `cleanup_worker gpt-5.5 medium`
REVIEWER: `gpt-5.5 high`
WHY: Tier 3 checklist-linked cleanup spans player runtime, Plex stream/library/auth identity, settings persistence, and DCR-EXIT blocker state. Escalate implementer to high only if source proof invalidates a slice owner, auth/session ownership appears, playback-critical stream error semantics must change, parser API semantics widen, or focused verification fails in a way that requires cross-module debugging.

NEXT_SESSION_HANDOFF
PLAN: `docs/plans/2026-05-01-dcr-15-player-plex-runtime-settings-media-contracts-plan.md`
TASK_FAMILY: cleanup/refactor
CLEANUP_SUBTYPE: checklist-linked
READY_NOW_EXECUTION_UNIT: none; DCR-15 is complete
READY_NOW_SLICE: none; DCR-15 is complete
MESSAGE: DCR-15 is complete. Do not resume `DCR-EXIT-S2` until `DCR-16` closes or is explicitly maintainer-routed out of DCR. The next cleanup-loop package is `DCR-16`, not DCR-15 or DCR-EXIT.

## Closeout Evidence

`DCR-15` completed on 2026-05-01 after clean plan review, clean slice
implementation reviews, and focused implementation checkpoints for all eight
package issues.

- `DCR-15-S1` / `DCR-15-A1`: commit `b7453074` made `RetryManager` own active
  retry metadata/error listener cleanup and generation-guard late retry
  callbacks after `clear()`, `destroy()`, and `VideoPlayer.unloadStream()`.
- `DCR-15-S2` / `DCR-15-A2`: commit `18c9c114` introduced
  `src/utils/persistenceWarningBackoffPolicy.ts` as the shared warning
  timing/backoff/reset mechanics owner while lifecycle and channel persistence
  queues kept their warning payload schemas.
- `DCR-15-S3` / `DCR-15-A3`: commit `037d9576` extracted
  `snapshotNativeTextTracks()` as the single player-owned native text-track
  debug snapshot helper consumed by `VideoPlayer` and `SubtitleManager`.
- `DCR-15-S4` / `DCR-15-A4`: commit `bcd7c133` moved HDR10 fallback mode
  value reads/writes and force-over-smart precedence to `PlaybackSettingsStore`
  and made Plex stream policy consume the normalized mode.
- `DCR-15-S5` / `DCR-15-A5`: commit `8ee0b3c0` renamed
  `resetDirectFallbackAttempts()` to
  `resetDirectFallbackAndBurnInAttempts()` and preserved caller behavior.
- `DCR-15-S6` / `DCR-15-A6`: commit `6c711e72` kept optional/debug universal
  decision and best-effort `stopTranscodeSession()` auth failures local while
  preserving globally emitted playback-critical resolver errors.
- `DCR-15-S7` / `DCR-15-A7`: commit `311a284a` made
  `src/modules/plex/auth/config.ts` the canonical Plex identity metadata
  owner and changed platform/auth/stream callers into consumers/adapters.
- `DCR-15-S8` / `DCR-15-A8`: commit `a19ccff1` added required scalar
  validation at Plex media item, media file/part, and stream parser boundaries
  before app-facing media types are exposed.

Verification observed during implementation/review:

- Each slice had a clean implementation review with no material findings.
- Focused player, persistence, settings/Plex stream, auth/platform identity,
  and Plex library parser suites passed during slice execution and review.
- `npm run typecheck` passed during slices that changed exported helpers,
  public method references, parser helpers, or cross-module types.
- Final package closeout verification passed: focused DCR-15 Jest suite set,
  `npm run typecheck`, `npm run verify`, `npm run plans:check`, `npm run
  verify:docs`, and `git diff --check`.

No DCR-15 closeout gates remain open. `DCR-EXIT-S2` remains blocked on
`DCR-16` only.
