**Plan Status:** completed
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

# FCP-8 API, Plex, And Error Contract Coherence Plan

## Goal

Retire `ARCHITECTURE_CLEANUP_CHECKLIST.md` item `FCP-8` by making API shapes, Plex contracts, and error-detail/cause handling coherent without changing product behavior.

This is an `FCP-*` source-backed cleanup package. Coverage is defined only by checklist `source_finding_id` values `FCP-8-SF1` through `FCP-8-SF7`; do not use Desloppify, detector ids, imported review ids, package-map ids, or score deltas for intake, proof, or closeout.

Completion means:

- Plex timeout fetch has one public call shape for callers, with the lower-level core helper private or shape-aligned.
- `ChannelManager.createChannel` and `IChannelManager.createChannel` expose the same options contract.
- library and stream media-item contracts no longer export different shapes under the same `PlexMediaItem` name.
- Plex auth wrapping preserves sanitized failure causes where redaction permits it.
- Plex Home endpoint probing/status handling is bounded behind a focused auth-owned helper/client, while token/PIN/profile persistence/event emission remain in `PlexAuth`.
- Plex library pagination duplication is resolved through a required `FCP-8-S4` disposition unit that extracts a private helper when invariance is provable, or stops for replan/source-justified disposition if current behavior cannot be preserved.
- channel setup warning/import error detail formatting has one local formatter.

## Non-Goals

- Do not redesign Plex auth/session ownership.
- Do not change credential persistence, selected-server/profile persistence, credential epoch behavior, PIN validation policy, or auth/profile event emission.
- Do not change playback URL or token redaction policy except to preserve existing sanitized-cause coverage.
- Do not change channel persistence schema or import/export payload schema.
- Do not change UI, focus, rendering, or TV-visible behavior.
- Do not rewrite Orchestrator composition or Plex stream resolver policy.
- Do not start or update `FCP-9` through `FCP-12` or `FCP-EXIT`.

## Parent Priority Alignment

`FCP-8` is the next unchecked package in the active final cleanup pass after completed `FCP-7`. It advances the final cleanup rule that each unchecked `FCP-*` row is planned and executed as a source-backed checklist-linked cleanup package through `cleanup-loop`.

`docs/architecture/CURRENT_STATE.md` currently says:

- Plex auth, discovery, library, and stream are separate Plex-facing module owners.
- `src/modules/plex/auth/PlexAuth.ts` owns the auth credential storage key and credential lifecycle.
- Plex library owns metadata retrieval and parsing, and stream owns stream/subtitle policy.
- `ChannelManager.ts` remains the public channel-domain API/state owner, with package-local collaborators for focused channel concerns.
- channel persistence ownership remains in `ChannelPersistenceStore`, not in API cleanup slices.

This plan tightens those existing owners. It must not move Plex auth persistence, channel persistence, playback URL policy, or UI behavior into new owners.

## Required Reading

Read in this order before implementation or review:

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/README.md`
4. `docs/agentic/session-prompts/cleanup-loop.md`
5. `ARCHITECTURE_CLEANUP_CHECKLIST.md` section `FCP-8`
6. `docs/architecture/CURRENT_STATE.md`
7. `docs/api/plex-integration.md`
8. `docs/agentic/plan-authoring-standard.md`
9. `.agents/skills/plex-integration-boundaries/SKILL.md`
10. `.agents/skills/architecture-boundaries/SKILL.md`
11. `.agents/skills/verification-strategy/SKILL.md`
12. `.agents/skills/execution-plan-authoring/SKILL.md`
13. this plan
14. source files named under `## Files In Scope`
15. `git status --short --branch`

Freshness gate: if any file in scope, `ARCHITECTURE_CLEANUP_CHECKLIST.md`, `docs/architecture/CURRENT_STATE.md`, or `docs/api/plex-integration.md` changed materially after this plan was written, refresh this plan before implementation.

Do not load `.agents/skills/persistence-boundaries/SKILL.md` as routine startup reading. Load it only if implementation discovers a necessary credential/profile/channel persistence change, and treat that discovery as a stop/replan trigger unless the controller explicitly widens scope.

## Required Skills

- `plex-integration-boundaries`: required for Plex auth, library, stream, shared transport, error redaction, and Plex API contract changes.
- `architecture-boundaries`: required because this package aligns public interfaces and extracts bounded collaborators from hotspot owners.
- `verification-strategy`: primary modes are contract-first for public API/type/error contracts and refactor-invariance for pagination/helper extraction.
- `execution-plan-authoring`: required to preserve source-finding coverage, ready-now execution-unit routing, and stop/replan gates without turning the plan into patch prose.

Do not use `ui-composition-patterns`; UI/focus/rendering work is out of scope and should stop the package for replan.

## Codanna Discovery

- `get_index_info`: Codanna available; index contains 11915 symbols across 775 files, semantic search enabled with `JinaEmbeddingsV2BaseCode`, 373 embeddings, updated about 12 minutes before this plan pass.
- `semantic_search_with_context "Plex timeout helper fetchWithTimeout object-shaped options positional fetchWithTimeoutCore Plex auth stream resolver callers"`: found `PlexLibrary._fetchWithRetry`, `LibraryQueryOptions`, and `IPlexStreamResolver`; useful for locating adjacent Plex seams but weak for the exact duplicate public timeout shape, so direct source reads and `rg` provided the source proof.
- `semantic_search_with_context "PlexAuth Home users endpoint probing status classification switch home user persistence error cause wrapping createPlexHomeNetworkError"`: found `PlexApiError` and related error owners but did not reliably locate Home endpoint helper/catch paths. Fallback was direct `PlexAuth.ts` reads and targeted `rg`.
- `search_documents "FCP-8 Plex API error contract coherence source findings plan authoring cleanup source_finding_id"`: returned `docs/api/plex-integration.md` and prior planning docs but not the authoritative `FCP-8` checklist membership. Fallback was direct read of `ARCHITECTURE_CLEANUP_CHECKLIST.md`.
- `analyze_impact` symbol_id `803` (`fetchWithTimeout`): 33 impacted symbols at max depth 3, including Plex auth token/Home flows, stream resolver/transcode decision, subtitle fallback/probe, playback options, orchestration, and initialization policy.
- `analyze_impact` symbol_id `828` (`fetchWithTimeoutCore`): 19 impacted symbols at max depth 3, including `PlexLibrary._fetchWithRetry`, Plex auth Home endpoint paths, stream resolver paths, subtitle fallback/probe, and playback options.
- `analyze_impact` symbol_id `2687` (`ChannelManager.createChannel`): direct impact limited to `ChannelManager.importChannels`.
- `analyze_impact` symbol_id `1027` (`library PlexMediaItem`): 45 impacted symbols at max depth 2, including library parsers, `PlexLibrary` methods, stream resolver/tests, now-playing info, EPG adapters, and orchestrator assembly.
- `analyze_impact` symbol_id `1601` (`stream PlexMediaItem`): no Codanna reverse impact detected; direct source reads found stream types/tests and stream interfaces export/use the name.
- `analyze_impact` symbol_id `2267` (`_requestFirstSupportedHomeEndpoint`): 10 impacted symbols at max depth 3, including `getHomeUsers`, `switchHomeUser`, profile-select load/switch/submit flows, app-shell profile-select port creation, and initialization profile-select routing.
- `analyze_impact` symbol_id `2435` (`ChannelImportNormalizer`): impact limited to `ChannelManager`.
- `find_symbol PlexAuth`: symbol_id `2211`; confirms `PlexAuth` implements `IPlexAuth`, defines auth state/events, and remains the credential lifecycle owner.
- `rg`/direct source reads: used for `fetchWithTimeoutCore(` call shapes, `createChannel`/`initialContent` contract drift, duplicated `PlexMediaItem` exports, Home endpoint/catch paths, Plex library pagination loops, and duplicated channel error-detail formatting because these are string/import-shape findings where Codanna semantic search was weak.

Codanna is sufficient for shared-symbol impact radius. Direct source reads are the authoritative proof for duplicated names, call signatures, catch/wrap behavior, and formatter duplication.

## Impact Snapshot

Current source proof:

- `src/modules/plex/shared/fetchWithTimeout.ts` exports object-shaped `fetchWithTimeout(args: FetchWithTimeoutArgs)`, while `src/modules/plex/shared/fetchWithTimeoutCore.ts` exports positional `fetchWithTimeoutCore(url, options, timeoutMs, upstreamSignal)`. Production callers use both shapes: public shared/stream/auth callers use `fetchWithTimeout`, while `PlexLibrary._fetchWithRetry` imports the core helper directly.
- Existing timeout tests also exercise both helpers (`src/modules/plex/shared/__tests__/fetchWithTimeoutCore.test.ts` and `src/modules/plex/stream/__tests__/fetchWithTimeout.test.ts`), so `FCP-8-S1` must update tests with the API decision.
- `ChannelManager.createChannel` accepts `options?: { signal?: AbortSignal | null; initialContent?: ResolvedContentItem[] | undefined }`, but `IChannelManager.createChannel` exposes only `{ signal?: AbortSignal | null }`.
- `src/modules/plex/library/types.ts` exports `PlexMediaItem` with library metadata fields such as genres/directors/actors/studios/actorRoles/clearLogo/parent thumbs, while `src/modules/plex/stream/types.ts` exports a smaller stream-local `PlexMediaItem` under the same name. `FCP-8-S1` chooses the contract direction: library remains the owner of the public metadata item name `PlexMediaItem`; stream keeps its narrower playback-facing contract but renames it to `PlexStreamMediaItem`, uses that name internally and in stream public interfaces, and stops exporting `PlexMediaItem` from the stream package. Stream must not import the library type solely to reuse the name, and library must not depend on stream types.
- `PlexAuth.validateToken` catches unknown transport failures and wraps them as `SERVER_UNREACHABLE` without passing the original cause. Home helper paths already have `createPlexHomeNetworkError(message, cause)`, but switch/getHome catch behavior must be audited so sanitized causes are consistently preserved and token-bearing URLs are not exposed.
- `PlexAuth` currently contains endpoint list construction, endpoint probing/status classification, PIN retry validation, profile-switch persistence, credential epoch checks, `storeCredentials`, and `profileChange` emission in one class. `FCP-8-S2` may extract only Home endpoint/status probing; persistence, token/PIN lifecycle, epoch checks, and events stay in `PlexAuth`.
- `PlexLibrary.getLibraryItems` and `PlexLibrary.getShowEpisodes` both carry pagination guard, offset, accumulation, and stop-condition logic. They differ in page size, optional limit trimming, totalSize use, and final sorting, so a helper must preserve those differences or stop.
- `formatChannelSetupWarning.ts` and `ChannelImportNormalizer.formatErrorMessage` duplicate the same `summarizeErrorForLog` string/object/message/JSON fallback formatting.

The branch has pre-existing unrelated local changes and untracked plan/docs artifacts. Implementation must not modify or revert them.

## Files In Scope

- `src/modules/plex/shared/fetchWithTimeout.ts`
- `src/modules/plex/shared/fetchWithTimeoutCore.ts`
- `src/modules/plex/shared/__tests__/fetchWithTimeoutCore.test.ts`
- `src/modules/plex/stream/__tests__/fetchWithTimeout.test.ts`
- `src/modules/plex/library/PlexLibrary.ts`
- `src/modules/plex/library/types.ts`
- `src/modules/plex/library/interfaces.ts`
- `src/modules/plex/library/index.ts`
- `src/modules/plex/library/parsing/*`
- `src/modules/plex/library/__tests__/PlexLibrary.test.ts`
- `src/modules/plex/stream/types.ts`
- `src/modules/plex/stream/interfaces.ts`
- `src/modules/plex/stream/index.ts`
- `src/modules/plex/stream/PlexStreamResolver.ts`
- `src/modules/plex/stream/resolveStreamPipeline.ts`
- `src/modules/plex/stream/__tests__/*`
- `src/modules/plex/auth/PlexAuth.ts`
- one focused auth-private helper/client file under `src/modules/plex/auth/` only if `FCP-8-S2` can extract Home endpoint/status probing without touching persistence or public auth contracts
- `src/modules/plex/auth/__tests__/PlexAuth.test.ts`
- Plex tests under `src/modules/plex/**/__tests__/`
- `src/modules/scheduler/channel-manager/ChannelManager.ts`
- `src/modules/scheduler/channel-manager/interfaces.ts`
- `src/modules/scheduler/channel-manager/ChannelImportNormalizer.ts`
- `src/modules/scheduler/channel-manager/__tests__/*`
- `src/core/channel-setup/shared/formatChannelSetupWarning.ts`
- `src/core/channel-setup/__tests__/formatChannelSetupWarning.test.ts`
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` only during implementation closeout after all planned slices pass review and verification

## Files Out Of Scope

- broad Plex auth/session redesign
- Plex credential persistence, profile persistence, selected-server persistence, credential epoch semantics, PIN validation product policy, and auth/profile event semantics
- playback URL/token redaction policy changes except preserving existing coverage
- channel persistence schema changes
- UI/focus/rendering changes
- Orchestrator composition rewrites unless source-proven narrow adapter work is required and review approves it
- `docs/api/plex-integration.md` unless implementation changes a documented public Plex contract
- `docs/architecture/CURRENT_STATE.md` unless implementation changes a public ownership claim
- unrelated dirty files shown by `git status --short --branch`
- `FCP-9` through `FCP-12` and `FCP-EXIT`

## Planner Self-Check

- Architecture seams are chosen at the package level: timeout API belongs to Plex shared transport; library keeps the public metadata item name `PlexMediaItem`; stream owns a narrower playback-facing `PlexStreamMediaItem` contract without re-exporting `PlexMediaItem`; Home endpoint/status probing stays auth-owned; channel API contract stays scheduler-owned; warning/import detail formatting stays local to channel setup/channel import.
- Adjacent contract changes are in scope where needed: Plex library/stream exported types and `IChannelManager` are in scope. Persistence, UI, Orchestrator, and playback URL policy are explicitly out of scope.
- The only planned new file is an auth-private Home endpoint/status helper/client, and only if it avoids persistence/public-contract changes. If not bounded, `FCP-8-S2` stops for replan instead of moving persistence out of `PlexAuth`.
- No out-of-scope file is required for mechanical wiring. Any discovered need outside scope triggers replan.
- Codanna evidence and explicit `rg`/direct-read fallback are recorded.
- The plan avoids growing hotspots: it aligns public contracts, removes duplicated names/shapes, and allows bounded extraction only when ownership is clear.
- A fresh cleanup-loop session can start with `ready_now_execution_unit` `FCP-8-S1` without deciding package membership, final owners, or verification depth.
- The package remains execution-grade without pseudo-code; implementation still owns local helper naming and exact extraction mechanics inside the approved seams.

## Architecture Seam Decision Gate

Approved seams:

- `FCP-8-S1`: expose one public timeout helper shape. Production Plex callers should converge on the public `fetchWithTimeout` object-shaped contract unless the implementation proves a stricter private/core boundary is safer. Direct public imports of positional `fetchWithTimeoutCore` should disappear or become private to the wrapper. Library owns the public metadata contract name `PlexMediaItem` and continues exporting it from `src/modules/plex/library/types.ts` and the library barrel. Stream owns its narrower playback-facing shape under the explicit name `PlexStreamMediaItem` in `src/modules/plex/stream/types.ts`; stream interfaces, resolver code, pipeline code, stream tests, and the stream barrel must use/export `PlexStreamMediaItem` instead of stream-local `PlexMediaItem`. Import direction must stay non-cyclic: stream must not import the library item only to inherit the name, library must not import stream types, and no compatibility re-export may keep `PlexMediaItem` available from the stream package.
- `FCP-8-S2`: preserve sanitized causes in Plex auth wrapping and extract only Home endpoint/status probing into an auth-owned helper/client if bounded. `PlexAuth` retains token storage, credential epoch checks, PIN validation decisions, profile persistence, `storeCredentials`, and `profileChange` emission.
- `FCP-8-S3`: align `IChannelManager.createChannel` with the concrete `ChannelManager.createChannel` contract or remove the concrete-only option if source audit proves it is not public API. Extract one shared local error-detail formatter for channel setup warning/import normalization without creating a broad error subsystem.
- `FCP-8-S4`: required disposition unit for Plex library pagination. Extract pagination as a private helper inside the library owner if current tests and source audit can prove request order, accumulation, abort behavior, stop conditions, limit trimming, sorting, and error taxonomy are unchanged. If that proof fails, stop for replan or record an explicit source-justified closeout/defer path with one final owner; do not silently skip `FCP-8-SF6`.

Stop and replan if:

- Plex auth extraction changes credential persistence, token redaction, PIN validation, credential epoch behavior, profile persistence, event emission, or existing Home fallback tests.
- Playback URL/token redaction policy changes beyond preserving existing coverage.
- ChannelManager `initialContent` alignment requires a product/API decision outside channel-manager contract coherence.
- Channel persistence schema changes are required.
- Plex library pagination helper changes request order, accumulation semantics, abort behavior, or error taxonomy.
- Shared media-item naming requires broad stream/library API redesign, compatibility shims, stream-to-library type ownership, library-to-stream type ownership, or keeping `PlexMediaItem` exported from the stream package.
- Error cause preservation would expose secrets or unsanitized token-bearing URLs.
- The plan needs files outside `FCP-8` scope, changes final-owner accounting, or pulls in another `FCP-*` package.
- A source audit shows a listed `source_finding_id` is already false and the planned edit would be churn rather than cleanup.

Absorb-now rule: absorb only newly discovered residue that stays within the same approved execution-unit goal, owner, seam/files, verification envelope, and final-owner accounting. Record absorbed residue in implementation/review output. Replan for new owners, new source findings, wider verification, changed execution-unit membership, or changed final-owner accounting.

## Verification Commands

Verification strategy classification: `new regression/contract test required`.

Primary proof mode: contract-first for public helper/interface/type/error contracts, with refactor-invariance for behavior-preserving pagination and formatter extraction.

Plan validation:

- `npm run plans:check`
  - Expected: this active tracked plan satisfies the serious-plan and cleanup-overlay structure.

Required per-slice implementation commands:

- `npm test -- fetchWithTimeout`
  - Expected: timeout helper tests pass after converging production and test imports on one public call shape.
- `npm test -- PlexStreamResolver`
  - Expected: stream media-item naming/typing changes preserve stream resolver behavior.
- `npm test -- PlexLibrary`
  - Expected: library media-item naming, sanitized cause expectations, and any pagination extraction preserve library behavior.
- `npm test -- PlexAuth`
  - Expected: validate-token and Home user/switch tests preserve abort, v2/v1 fallback, unsupported, status classification, PIN, profile-switch, and sanitized-cause behavior.
- `npm test -- ChannelManager ChannelImportNormalizer`
  - Expected: `createChannel` contract alignment and import error formatting behavior are preserved.
- `npm test -- formatChannelSetupWarning`
  - Expected: channel setup warning formatting remains unchanged while sharing the detail formatter.
- `npm run typecheck`
  - Expected: no TypeScript errors, especially around timeout helper imports, `PlexMediaItem` names, and `IChannelManager` options.
- `npm run verify`
  - Expected: full Plex/scheduler/UI-adjacent verification passes before package closeout.

Required source/static audits:

- `rg -n "fetchWithTimeoutCore\\(" src`
  - Expected after `FCP-8-S1`: no production caller imports/calls positional core directly outside the shared helper boundary; tests may reference only if the core remains intentionally private-testable or shape-aligned.
- `rg -n "export interface PlexMediaItem|export type \\{[^}]*PlexMediaItem" src/modules/plex/library src/modules/plex/stream`
  - Expected after `FCP-8-S1`: `PlexMediaItem` is exported only by the library package; the stream package does not export or re-export `PlexMediaItem`.
- `rg -n "PlexStreamMediaItem" src/modules/plex/stream`
  - Expected after `FCP-8-S1`: stream-facing item annotations use the explicit stream-owned `PlexStreamMediaItem` name in stream types/interfaces/resolver/pipeline/tests/barrel exports.
- `rg -n "createChannel\\(config: ChannelCreateInput, options\\?: \\{ signal\\?: AbortSignal \\| null \\}" src/modules/scheduler/channel-manager`
  - Expected after `FCP-8-S3`: interface and concrete `createChannel` options are aligned; no hidden concrete-only `initialContent` option remains outside the chosen public contract.
- `rg -n "cause:|new PlexApiError\\(|createPlexHomeNetworkError|X-Plex-Token" src/modules/plex/auth src/modules/plex/auth/__tests__`
  - Expected after `FCP-8-S2`: relevant wraps preserve sanitized causes and tests prove no token-bearing URL leakage.
- `rg -n "MAX_PAGINATION_ITERATIONS|X-Plex-Container-Start|X-Plex-Container-Size|totalSize|pageCounter" src/modules/plex/library/PlexLibrary.ts`
  - Expected after `FCP-8-S4`: duplicated pagination guard/accumulation logic is centralized in a private library helper, or the slice has stopped for replan/source-justified disposition with one final owner for `FCP-8-SF6`.
- `rg -n "formatChannelSetupWarningDetail|formatErrorMessage\\(|summarizeErrorForLog" src/core/channel-setup/shared src/modules/scheduler/channel-manager`
  - Expected after `FCP-8-S3`: duplicated error-detail adapter logic has one local owner.

Because this package touches Plex and scheduler contracts, `npm run verify` is the implementation closeout gate. `npm run verify:docs` is not required for this plan file alone; use `npm run plans:check` for plan creation/review and run docs verification only if implementation changes workflow/control-plane/reference docs beyond the tracked plan/checklist closeout.

## Rollback Notes

- Roll back by slice, not by package. Preserve any reviewed earlier slice if a later auth or pagination slice stops.
- If timeout helper convergence regresses abort/timeout behavior, revert the helper API migration and keep the failing test/audit output for replan.
- If stream-local `PlexMediaItem` renaming to `PlexStreamMediaItem` creates broad stream/library churn, restore the previous names and replan with one final owner; do not add compatibility shims or make stream/library import each other to share the item name.
- If Plex auth cause preservation risks token or URL leakage, roll back the cause path first and keep the redaction failure as the blocker.
- If Home endpoint extraction changes profile switch persistence or fallback behavior, restore the previous inline `PlexAuth` flow and replan with `persistence-boundaries`.
- If pagination extraction changes request order, accumulation, abort, sorting, or error taxonomy, revert `FCP-8-S4` only; do not block closeout of reviewed `FCP-8-S1` through `FCP-8-S3` unless source-finding coverage changes.
- If channel contract alignment requires a product/API decision, restore the existing behavior and replan `FCP-8-SF2` with the controller before editing persistence or import schema.

## Commit Checkpoints

- `FCP-8-S1` implementation checkpoint: shared timeout API shape and Plex media-item naming/type cleanup plus focused Plex shared/stream/library tests.
- `FCP-8-S2` implementation checkpoint: Plex auth sanitized-cause preservation and bounded Home endpoint/status helper/client plus auth tests.
- `FCP-8-S3` implementation checkpoint: ChannelManager create contract alignment and shared error-detail formatter plus scheduler/channel setup tests.
- `FCP-8-S4` implementation checkpoint: required Plex library pagination disposition plus library tests/source audit, only after `FCP-8-S1` and `FCP-8-S2` risk is understood.
- Closeout checkpoint: after all planned slices pass review and `npm run verify`, update `ARCHITECTURE_CLEANUP_CHECKLIST.md` for `FCP-8` in a separate orchestrator-owned closeout pass if implementation commits were already made.

## Package Decomposition

- `package_id`: `FCP-8`
- `checklist_token`: `FCP-8`
- `package_issue_ids`: n/a for FCP source-backed packages; use `source_finding_ids`
- `source_finding_ids`: `FCP-8-SF1`, `FCP-8-SF2`, `FCP-8-SF3`, `FCP-8-SF4`, `FCP-8-SF5`, `FCP-8-SF6`, `FCP-8-SF7`
- `coverage_check`:
  - `FCP-8-SF1` maps exactly to `FCP-8-S1`.
  - `FCP-8-SF2` maps exactly to `FCP-8-S3`.
  - `FCP-8-SF3` maps exactly to `FCP-8-S1`.
  - `FCP-8-SF4` maps exactly to `FCP-8-S2`.
  - `FCP-8-SF5` maps exactly to `FCP-8-S2`.
  - `FCP-8-SF6` maps exactly to `FCP-8-S4`.
  - `FCP-8-SF7` maps exactly to `FCP-8-S3`.
  - No defer path is approved before implementation.
- `ready_now_execution_unit`: `FCP-8-S1`
- `ready_now_slice`: `FCP-8-S1`
- `recommended_slice_order`: `FCP-8-S1`, then `FCP-8-S2`, then `FCP-8-S3` if the controller confirms it remains disjoint from active auth/Plex edits, then required `FCP-8-S4` after `FCP-8-S1` and `FCP-8-S2` risk is understood.
- `parallel_execution_policy`: serial by default. No `execution_waves` are approved. `FCP-8-S3` may run apart only after clean plan review and controller confirmation that no shared tests/files overlap with active Plex/auth work. `FCP-8-S2` is auth-sensitive and serial. `FCP-8-S4` is required for `FCP-8-SF6` disposition and should wait until timeout/media-item and auth risk is understood.

| slice_id | goal | areas/files | source_finding_ids | verification | dependencies | stop_condition | handoff_condition | parallel_group | parallel_justification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FCP-8-S1` | Converge Plex timeout helpers to one public call shape, keep library-owned `PlexMediaItem` as the public metadata item name, and rename stream's narrower item contract to `PlexStreamMediaItem`. | `src/modules/plex/shared/fetchWithTimeout.ts`, `src/modules/plex/shared/fetchWithTimeoutCore.ts`, Plex shared tests, `src/modules/plex/library/types.ts`, `src/modules/plex/library/interfaces.ts`, `src/modules/plex/library/index.ts`, library parsing/tests as needed, `src/modules/plex/stream/types.ts`, `src/modules/plex/stream/interfaces.ts`, `src/modules/plex/stream/index.ts`, stream resolver/pipeline/tests as needed | `FCP-8-SF1`, `FCP-8-SF3` | `npm test -- fetchWithTimeout`; `npm test -- PlexStreamResolver`; `npm test -- PlexLibrary`; targeted timeout/media-item `rg` audits; `npm run typecheck` | none | Stop if timeout convergence changes abort/timeout behavior, keeps parallel public call shapes, requires stream/library type ownership in either direction, keeps `PlexMediaItem` exported from stream, or requires compatibility shims. | One public timeout shape remains for production callers; library exports `PlexMediaItem`; stream exports `PlexStreamMediaItem` and no `PlexMediaItem`; targeted tests/audits/typecheck pass. | `serial_only` | First slice touches shared Plex transport and type contracts with broad Codanna impact; it establishes the package API baseline. |
| `FCP-8-S2` | Preserve sanitized Plex auth causes and extract only bounded Home endpoint/status probing while keeping auth persistence and profile switch ownership in `PlexAuth`. | `src/modules/plex/auth/PlexAuth.ts`, optional focused auth-private Home endpoint/status helper/client, `src/modules/plex/auth/__tests__/PlexAuth.test.ts` | `FCP-8-SF4`, `FCP-8-SF5` | `npm test -- PlexAuth`; targeted cause/redaction/Home `rg` audits; `npm run typecheck` | `FCP-8-S1` clean review preferred so shared timeout behavior is stable before auth extraction | Stop if extraction touches credential/profile persistence, token redaction policy, PIN validation, credential epoch behavior, event emission, existing Home fallback tests, or exposes unsanitized token-bearing URLs. | Auth tests prove validate-token/Home/switch behavior, fallback, abort, PIN, profile switch persistence, and sanitized causes remain correct; helper/client owns only endpoint/status probing. | `serial_only` | Auth-sensitive slice affects credential-facing behavior and profile-select flows; no parallel auth work is approved. |
| `FCP-8-S3` | Align `ChannelManager.createChannel` public/concrete contracts and deduplicate channel setup/import error-detail formatting. | `src/modules/scheduler/channel-manager/ChannelManager.ts`, `src/modules/scheduler/channel-manager/interfaces.ts`, `src/modules/scheduler/channel-manager/ChannelImportNormalizer.ts`, scheduler channel-manager tests, `src/core/channel-setup/shared/formatChannelSetupWarning.ts`, `src/core/channel-setup/__tests__/formatChannelSetupWarning.test.ts` | `FCP-8-SF2`, `FCP-8-SF7` | `npm test -- ChannelManager ChannelImportNormalizer`; `npm test -- formatChannelSetupWarning`; targeted createChannel/formatter `rg` audits; `npm run typecheck` | `FCP-8-S1` clean review; may run before `FCP-8-S2` only if controller confirms disjoint files/tests | Stop if `initialContent` requires product/API decision outside channel-manager contract coherence, channel persistence schema changes, import/export schema changes, or the formatter becomes a broad cross-package error subsystem. | Interface and concrete create options align; one local detail formatter is shared by setup warnings/import normalization; targeted tests/audits/typecheck pass. | `parallel_group: after-S1-disjoint` | Scheduler/channel setup files are disjoint from auth and Plex shared files, but controller must confirm no active test or review overlap before running apart. |
| `FCP-8-S4` | Resolve Plex library pagination duplication through a required private helper extraction or an explicit source-justified replan/defer disposition for `FCP-8-SF6`. | `src/modules/plex/library/PlexLibrary.ts`, `src/modules/plex/library/__tests__/PlexLibrary.test.ts` | `FCP-8-SF6` | `npm test -- PlexLibrary`; targeted pagination `rg` audit; `npm run typecheck`; `npm run verify` before package closeout | `FCP-8-S1` complete and `FCP-8-S2` risk understood; controller approval required before starting because this is the final required disposition unit | Stop if helper changes request order, accumulation semantics, abort behavior, stop conditions, limit trimming, sorting, or error taxonomy. If invariance cannot be proved, stop for replan or create an explicit source-justified defer path with one final owner before package closeout. | Pagination duplication is centralized privately, or `FCP-8-SF6` has an explicit source-justified replan/defer disposition with one final owner; library tests/audits/typecheck pass. | `serial_only` | Pagination behavior is subtle and Plex library already shares timeout/type risk with earlier slices; do not run in parallel by default. |

No `execution_waves` are approved in this plan. `cleanup-loop` should execute and review `FCP-8-S1` as the first single-slice execution unit, then return to this plan for the next unit unless review requires a replan.

## Source Finding Disposition

- `FCP-8-SF1`: planned retirement in `FCP-8-S1` by converging production timeout callers on one public helper shape and making positional core private or shape-aligned.
- `FCP-8-SF2`: planned retirement in `FCP-8-S3` by aligning `IChannelManager.createChannel` with the concrete options contract or removing the concrete-only option if current source proves it should not be public.
- `FCP-8-SF3`: planned retirement in `FCP-8-S1` by keeping library-owned `PlexMediaItem` as the public metadata item name and renaming stream's narrower playback-facing contract to stream-owned `PlexStreamMediaItem`, with no stream `PlexMediaItem` re-export and no stream/library type dependency.
- `FCP-8-SF4`: planned retirement in `FCP-8-S2` by preserving sanitized causes in Plex auth catch-and-wrap paths.
- `FCP-8-SF5`: planned retirement in `FCP-8-S2` by extracting only bounded Home endpoint/status probing into an auth-owned helper/client and keeping persistence/profile switch ownership in `PlexAuth`.
- `FCP-8-SF6`: required disposition in `FCP-8-S4` by extracting a private behavior-preserving library pagination helper, or by stopping for an explicit source-justified replan/defer path with one final owner if invariance cannot be proved.
- `FCP-8-SF7`: planned retirement in `FCP-8-S3` by sharing one local error-detail formatter between channel setup warning formatting and channel import normalization.

## Implementation Closeout

- Implementation checkpoints: `b18d23c9` (`FCP-8-S1`), `65ba1bf1` (`FCP-8-S2`), `508d52aa` (`FCP-8-S3`), and `5e548a92` (`FCP-8-S4`).
- `FCP-8-SF1`: retired by converging production Plex callers on the object-shaped timeout helper; `fetchWithTimeoutCore` remains object-shaped and limited to the wrapper/core tests.
- `FCP-8-SF2`: retired by adding the shared `ChannelCreateOptions` contract and exposing `initialContent` consistently through `IChannelManager` and `ChannelManager`.
- `FCP-8-SF3`: retired by keeping library-owned `PlexMediaItem` as the public metadata item name and renaming stream's narrower contract to `PlexStreamMediaItem`.
- `FCP-8-SF4`: retired by preserving sanitized Plex auth causes while redacting token-bearing and Home-switch PIN-bearing details in `Error`, string, and object-shaped causes.
- `FCP-8-SF5`: retired by moving Home endpoint probing/status fallback into `plexHomeEndpointClient.ts` while leaving credential/profile persistence, credential epoch checks, PIN validation decisions, `storeCredentials`, and `profileChange` emission in `PlexAuth`.
- `FCP-8-SF6`: retired by extracting the private library-owned `_fetchPagedMediaItems` helper while preserving request order, accumulation, abort signal threading, stop conditions, limit trimming, sorting, and error taxonomy.
- `FCP-8-SF7`: retired by sharing `formatChannelSetupWarningDetail` between channel import normalization and channel setup warning formatting without creating a broad error subsystem.
- Closeout verification: targeted package tests and source audits passed for every slice; `npm run verify` passed on 2026-05-02 before checklist closeout; `npm run verify:docs` passed after checklist/plan closeout updates.
