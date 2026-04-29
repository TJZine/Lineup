# FCP-2 Runtime Contracts And Failure Semantics Audit

## Purpose And Scope

This is the source-backed audit for `ARCHITECTURE_CLEANUP_CHECKLIST.md` item `FCP-2` Runtime Contracts And Failure Semantics.

The audit covers runtime contracts whose failures would be user-visible or port-blocking: parsing and payload validation, Plex transport/auth/discovery/library/stream errors, persistence and storage-backed contract failures, startup/lifecycle propagation, scheduler and channel-manager failure semantics, player/playback recovery contracts, fallback behavior, swallowed or context-losing errors, and broad DTO/result surfaces discovered from current source.

This audit intentionally does not use Desloppify output, issue ids, package maps, score deltas, or triage as intake, proof, prioritization, or closure evidence.

## Audit Freshness And Update Rule

- Audit date: 2026-04-29.
- Source baseline: current workspace at planning time.
- Worktree hygiene observed at startup with `git status --short`; unrelated dirty files were present and ignored for FCP-2 evidence and package membership:
  - `M scorecard.png`
  - `?? docs/agentic/evals/baseline-summaries/2026-04-28-prompt-13-feature-low-implementer-policy.md`
  - `?? docs/plans/2026-04-28-ai-generated-debt-hygiene-sweep.md`
  - `?? docs/plans/2026-04-28-cross-module-architecture-audit-plan.md`
  - `?? docs/plans/2026-04-28-cross-module-architecture-cleanup-checklist.md`
  - `?? docs/plans/2026-04-28-design-coherence-audit-checklist.md`
  - `?? docs/plans/2026-04-28-design-coherence-audit-plan.md`
  - `?? docs/plans/2026-04-28-plex-stream-url-policy-capability-cleanup-plan.md`
- Update this audit if implementation touches a runtime owner outside the selected package, if tests reveal a different caller-visible failure contract, or before FCP-2 closeout if more than one implementation session has passed.
- Closeout must rerun the focused source audit, targeted contract tests, `npm run verify`, and `npm run verify:docs` if docs/checklist/audit/plan references change.

## Discovery Trail

Codanna was used first where available through the local CLI because MCP Codanna tools were not exposed to the controller.

- `/Users/tristan/.cargo/bin/codanna mcp get_index_info`
  - Index contained 11128 symbols across 696 files, 4163 relationships.
  - Semantic search was enabled with model `AllMiniLML6V2`, 42 embeddings, 384 dimensions, updated about 3 hours before audit.
- `/Users/tristan/.cargo/bin/codanna mcp --json semantic_search_with_context query:"runtime contracts failure semantics thrown swallowed fallback validation parsing Plex persistence startup scheduler player" limit:10`
  - Weak/noisy results. Useful hints included `ChannelSetupPlexRequestUseCase`, `AppOrchestrator.selectServer`, `discoverServers`, `shutdown`, and auth methods, but the result set was not proof-grade.
- `/Users/tristan/.cargo/bin/codanna mcp --json semantic_search_with_context query:"Plex transport auth discovery library stream error fallback validation" limit:10`
  - Weak/noisy results. Useful hints pointed to `AppOrchestrator.requestAuthPin`, `selectServer`, `discoverServers`, and `ChannelSetupPlexRequestUseCase`.
- `/Users/tristan/.cargo/bin/codanna mcp --json semantic_search_with_context query:"ChannelManager scheduler failure persistence fallback channel load save error" limit:10`
  - Weak/noisy results, mostly channel switching and shutdown hints.
- `/Users/tristan/.cargo/bin/codanna mcp --json search_documents query:"FCP-2 runtime contracts failure semantics" limit:10`
  - Returned relevant plan-authoring and prior-plan documentation snippets. Codanna emitted a Tantivy `LockBusy` auto-sync warning; the returned docs were usable as orientation only.
- `/Users/tristan/.cargo/bin/codanna mcp --json search_symbols query:ChannelManager kind:class limit:10`
  - Found `ChannelManager` in `src/modules/scheduler/channel-manager/ChannelManager.ts` at line 238; parser reported kind `Function`.
- `/Users/tristan/.cargo/bin/codanna mcp --json search_symbols query:createChannel kind:method limit:10`
  - Found `createChannel` in `src/modules/scheduler/channel-manager/ChannelManager.ts` at line 451.
- `/Users/tristan/.cargo/bin/codanna mcp --json search_symbols query:resolveChannelContent kind:method limit:10`
  - Found `resolveChannelContent` in `src/modules/scheduler/channel-manager/ChannelManager.ts` at line 682.
- `/Users/tristan/.cargo/bin/codanna mcp --json analyze_impact ChannelManager`
  - Returned 0 impacted symbols for a central runtime owner; treated as insufficient.
- `/Users/tristan/.cargo/bin/codanna mcp --json analyze_impact symbol_id:13187`
  - Returned an irrelevant impacted symbol in `AppOrchestrator`; treated as insufficient.

Deterministic fallback used `rg` and direct source reads across `src/core`, `src/modules`, `src/platform`, and `src/utils`, focusing on `catch`, `throw`, `console`, `return null`, `return []`, storage access, parse/validation helpers, result shapes, and Plex/runtime error codes. Direct reads are the proof surface for findings and accepted areas below.

## Candidate And Disposition Matrix

| Area | Source evidence | Disposition | Owner | Rationale |
| --- | --- | --- | --- | --- |
| Channel authoring content-resolution failures | Original source showed `createChannel` catching all initial resolution errors after state insertion, and `updateChannel` deleting cached content plus catching all content-affecting resolution errors after state mutation. Closure source in commit `239b3db5` resolves content before authoring state publication, propagates non-fallback failures, preserves graceful fallback, and tests create/update/import behavior in `src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts`. | Resolved by `FCP-2-S1` / `FCP-2-SF1` | Scheduler/channel-manager | `createChannel()` and content-affecting `updateChannel()` now align with the resolver's existing typed failure semantics while preserving skipped-import `ImportResult` behavior and deleted/empty-source fallback. |
| Plex auth token validation and credential storage | `src/modules/plex/auth/PlexAuth.ts:210` returns `false` only for 401/403 validation failures and throws typed `PlexApiError` for timeout, rate-limit, service, and unknown failures; `cancelPin` ignores delete failures at `PlexAuth.ts:187`; credential storage failures are non-fatal at `PlexAuth.ts:303`. | Accepted/no-action | Plex auth | Matches `docs/api/plex-integration.md`; best-effort cancel and non-fatal storage are intentional runtime contracts. |
| Plex discovery and server selection | `src/modules/plex/discovery/PlexServerDiscovery.ts:88` wraps discovery failures as typed `PlexApiError`; `_probeConnection` returns endpoint-specific `auth_required`, `access_denied`, or `unreachable` outcomes at `PlexServerDiscovery.ts:141`; `selectServer` returns typed selection results at `PlexServerDiscovery.ts:249`; storage-key changes validate and invalidate cached discovery at `PlexServerDiscovery.ts:406`. | Accepted/no-action | Plex discovery | Failure semantics are explicit and caller-visible through typed discovery/selection outcomes. |
| Plex library transport and payload parsing | `src/modules/plex/library/PlexLibrary.ts:202`, `247`, `279`, `385`, `535`, and `850` distinguish unavailable/not-found/empty successes from transport, auth, server, timeout, empty-body, and malformed JSON errors; parsing helpers in `src/modules/plex/library/parsing/libraryResponsePayload.ts` throw `PlexLibraryError(PARSE_ERROR)` for malformed containers and non-array payload fields. Tests cover empty/malformed responses, 403 access denied, omitted metadata, and pagination guard in `src/modules/plex/library/__tests__/PlexLibrary.test.ts`. | Accepted/no-action | Plex library | Current source aligns with the documented Plex integration contract. 404 and empty collection/list surfaces intentionally return `null` or `[]` only on source-backed success/not-found paths. |
| Plex stream resolution and playback URL failures | `src/modules/plex/stream/PlexStreamResolver.ts:143` throws `StreamResolverError` when item lookup fails; `getTranscodeUrl` validates server and key at `PlexStreamResolver.ts:391`; auth failures map to stream errors at `PlexStreamResolver.ts:707`; debug universal-decision fetch and stop-transcode teardown are best-effort at `PlexStreamResolver.ts:307` and `331`. | Accepted/no-action | Plex stream resolver | User-visible stream resolution paths are typed. Best-effort debug and teardown paths are intentionally non-blocking and do not authorize an FCP-2 package. |
| Storage-backed helpers and stores | `src/utils/storage.ts` exposes safe storage helpers; `src/modules/scheduler/channel-manager/ChannelPersistenceStore.ts` normalizes malformed stored channel data and uses structured mutation results; `src/modules/plex/discovery/ServerSelectionStore.ts` removes malformed selected-server state; `src/core/channel-setup/persistence/ChannelSetupRecordStore.ts` returns `null` for invalid setup records and relies on injected storage setters. | Accepted/no-action | Storage-owning modules | Runtime storage failures are mostly non-fatal by design. No source-backed cross-owner storage package is selected because failures are either typed mutation results or accepted best-effort persistence. |
| Lifecycle state persistence | `src/modules/lifecycle/StateManager.ts` uses raw `localStorage` as the lifecycle owner, retries quota cleanup on save, and returns `null` on load/parse/storage failures. | Accepted/no-action with revisit trigger | Lifecycle/state manager | The raw access is inside the designated owner. Revisit if lifecycle state becomes durable user-facing state, port-blocking state, or is moved behind shared persistence policy. |
| Startup and lifecycle failure propagation | `src/core/initialization/InitializationCoordinator.ts:173` reports fatal startup failures through global error handling, cancels warmup/listeners, rejects queued waiters, and rethrows; startup policy routes missing/corrupt credentials and recoverable discovery/auth outcomes explicitly in `src/core/initialization/InitializationStartupPolicy.ts`; EPG warmup/profile resume diagnostics are best-effort. | Accepted/no-action | Initialization/lifecycle | Startup has explicit fatal vs recoverable routing. Best-effort resume/warmup failures are not selected because they are non-blocking diagnostics. |
| Channel tuning and player switch failure semantics | `src/core/channel-tuning/ChannelTuningCoordinator.ts:294` resolves content before stopping playback, reports handled app errors on failure, and returns failed/aborted outcomes; unknown errors are normalized with context at `ChannelTuningCoordinator.ts:555`. | Accepted/no-action | Channel tuning/player integration | Runtime switching avoids blanking playback before content readiness and exposes handled failures. No package needed. |
| Player/playback recovery and subtitle fallbacks | Player runtime and subtitle selection paths use typed result/fallback behavior; stream-resolver teardown/debug paths are best-effort. | Accepted/no-action | Player/playback | No source-backed failure-semantics risk rose above the selected ChannelManager authoring contract issue. |
| Import/parse result surfaces | `src/modules/scheduler/channel-manager/ChannelManager.ts:844` parses channel import JSON into `ImportResult` with errors/skips, and imports each valid record through `createChannel()`. Invalid JSON and invalid records are caller-visible through result fields. | Partly covered by `FCP-2-SF1`; parse/export accepted/no-action | Scheduler/channel-manager | If `createChannel()` propagates non-fallback content-resolution failures, import should keep using its existing catch path and report those records as skipped with errors. Export and parse-only import validation remain no-action. |

## Ready Package Finding

### FCP-2-SF1: Channel Authoring Content-Resolution Failure Semantics

`createChannel` and `updateChannel` currently treat all content-resolution failures as successful channel mutations:

- `createChannel` inserts the channel into state, then catches every `_resolveContentInternal` failure, logs a warning, queues persistence, emits `channelCreated`, and returns the channel.
- `updateChannel` mutates state, deletes cached resolved content for content-affecting updates, then catches every `_resolveContentInternal` failure, logs a warning, persists, emits `channelUpdated`, and returns the updated channel.

This conflicts with the resolver’s internal contract. `_resolveContentInternal` already handles source-specific fallback:

- Network failure with cache can return cached content.
- `CONTENT_UNAVAILABLE` with cache can return stale cache.
- `ACCESS_DENIED` invalidates cache/retry state and throws a non-recoverable `ChannelError`.
- Empty filtered content and other non-fallback failures rethrow.

The source-backed cleanup package should preserve the documented/covered graceful behavior for deleted or empty content sources while making non-fallback authoring failures caller-visible. It should also prevent content-affecting updates from deleting usable cache or publishing mutated channel state when the update’s required resolution failed.

Source-backed closure evidence must include focused contract tests around `createChannel` and `updateChannel` failure paths, not only `refreshChannelContent`.

#### Audit-First Package Brief

- `source_finding_id`: `FCP-2-SF1`
- `source findings`: `createChannel()` and `updateChannel()` catch every content-resolution failure after mutating channel state, while `_resolveContentInternal()` already classifies fallback-eligible and non-fallback failures. `importChannels()` delegates to `createChannel()`, so the package must decide and test import behavior when non-fallback content-resolution failures become caller-visible.
- `rubric linkage`: error consistency, contract coherence, type safety, API surface coherence, authorization consistency, and logic clarity.
- `owner seam`: scheduler/channel-manager owns channel CRUD, import delegation, resolved-content cache mutation, and public ChannelManager contract comments. Plex, startup, player, UI, and storage owners are context only.
- `files in scope`: `src/modules/scheduler/channel-manager/ChannelManager.ts`; `src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts`; `src/modules/scheduler/channel-manager/interfaces.ts` only for public contract comments.
- `files out of scope`: `src/modules/plex/**`; `src/core/orchestrator/AppOrchestrator.ts`; `src/core/initialization/**`; `src/core/channel-tuning/**`; `src/modules/player/**`; UI screens/components; `src/utils/storage.ts`; `src/modules/scheduler/channel-manager/ChannelPersistenceStore.ts`; `ARCHITECTURE_CLEANUP_CHECKLIST.md` except planning/verified closeout state.
- `closure condition`: `createChannel()` and content-affecting `updateChannel()` preserve graceful deleted/empty-source fallback, propagate non-fallback failures such as access/auth/parse/server failures through existing typed errors, and do not persist/emit/publish partially updated state for failed content-affecting updates. `importChannels()` keeps its structured `ImportResult` behavior by skipping records whose `createChannel()` fails with a non-fallback resolution error and recording an error message; export semantics are unchanged.
- `verification routing`: `npm run test:unit -- src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts`; `rg -n "Failed initial content resolution|Failed content resolution during update|Access denied resolving channel content|CONTENT_UNAVAILABLE|ACCESS_DENIED|SCHEDULER_EMPTY_CHANNEL|Failed to import channel" src/modules/scheduler/channel-manager/ChannelManager.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts`; `rg -n "localStorage|sessionStorage|fetch\\(|PlexAuth|PlexServerDiscovery|PlexStreamResolver" src/modules/scheduler/channel-manager/ChannelManager.ts`; `npm run verify`; `npm run verify:docs` if plan/audit/checklist/docs change.
- `stop/replan triggers`: implementation needs Plex error-taxonomy changes; implementation needs UI/orchestrator/startup/channel-tuning/player edits; import behavior cannot be kept as skipped-import structured `ImportResult` without wider import API changes; fixing update consistency requires a broader transaction abstraction; tests prove downstream callers intentionally depend on successful create/update for non-fallback auth/access/parse/server failures.

## Deferred Findings

None admitted in this planning pass.

Accepted residual areas have revisit triggers in the matrix. If implementation or adversarial review finds a source-backed failure contract outside `FCP-2-SF1`, update this audit before expanding the package.

## Accepted No-Action Areas

- Plex auth, discovery, library, and stream owners already expose typed, documented failure semantics for user-visible transport/auth/payload/stream failures.
- Storage failures are either typed mutation results inside storage-owning modules or intentionally best-effort persistence paths. No raw storage package is selected from this audit.
- Startup/lifecycle fatal failures are reported and rethrown; recoverable auth/discovery/setup paths route explicitly.
- Channel tuning resolves content before stopping playback and normalizes handled failures.
- Player recovery and teardown/debug fallbacks are no-action unless future source audit finds user-visible swallowed failures.
- Channel import parsing and export serialization remain accepted/no-action, but import delegation through `createChannel()` is part of `FCP-2-SF1` and must be tested.

## Known Uncertainty And Tool Fallback

- Codanna semantic search was useful as orientation but too noisy for proof. Codanna impact analysis for `ChannelManager` and `createChannel` was insufficient for a central runtime owner, so deterministic `rg` and direct source reads are authoritative.
- Codanna document search emitted `LockBusy` auto-sync warnings but returned usable documentation snippets.
- MCP Codanna tools were not exposed; CLI `codanna mcp` was used instead.
- This is a source-backed audit, not a formal path-coverage proof. Closeout must include a focused re-audit of the selected owner and any files changed by implementation.

## FCP-2 Closeout Readiness

FCP-2 closeout evidence:

- `FCP-2-SF1` resolved by implementation commit `239b3db5` without expanding beyond scheduler/channel-manager source, tests, and public interface comments.
- `src/modules/scheduler/channel-manager/ChannelManager.ts` now resolves authoring-time content before state publication for create and content-affecting update paths, propagates non-fallback failures, and preserves graceful `CONTENT_UNAVAILABLE`/404 fallback.
- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts` covers create non-fallback propagation/no mutation, update non-fallback propagation/state+cache preservation, deleted-source fallback, import skipped-record behavior, and existing refresh access-denied propagation.
- `src/modules/scheduler/channel-manager/interfaces.ts` documents the clarified public throw contract.
- Accepted/no-action areas remained out of scope and owned by their current module owners; no deferred `FCP-2` source findings are admitted.
- `npm run test:unit -- src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts` passed: 1 suite, 83 tests.
- Focused source audit for runtime error/fallback strings returned expected ChannelManager/test anchors; focused coupling audit for raw storage, raw fetch, and direct Plex owner references in `ChannelManager.ts` returned no matches.
- First final `npm run verify` attempt exited 139 with a segmentation fault during `npm run test:contracts` after earlier phases passed; direct `npm run test:contracts` rerun passed.
- Final `npm run verify` rerun passed after the completed-plan/checklist update.
- Standalone `npm run verify:docs` passed after the completed-plan/checklist update.
- Fresh implementation review found no material findings and approved `FCP-2-S1` for implementation checkpoint commit.
- Fresh FCP-2 closeout review found no material findings and approved closeout after accepting this audit, the completed plan, the proof matrix, verification evidence, accepted/no-action owner record, and checklist mini-record.

The final FCP reconciliation pass should recheck this audit against implemented source/docs changes so any new runtime-contract residue, stale doc reference, or ownership drift has one owner and revisit trigger before `FCP-EXIT` closes.
