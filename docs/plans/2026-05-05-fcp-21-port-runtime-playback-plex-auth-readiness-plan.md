**Plan Status:** completed
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

# FCP-21 Port Runtime, Playback, And Plex Auth Readiness Plan

## Goal

Retire `ARCHITECTURE_CLEANUP_CHECKLIST.md` item `FCP-21` by closing the current-source port-readiness findings that remain live after completed `FCP-14`, `FCP-15`, `FCP-19`, and `FCP-20` baseline evidence.

This is an FCP source-backed checklist package. Coverage is defined only by these local `source_finding_id` values from the FCP-21 package brief: `FCP-21-SF1`, `FCP-21-SF2`, `FCP-21-SF3`, `FCP-21-SF4`, and `FCP-21-SF5`. Do not use detector ids, imported review ids, package-map ids, raw review observations, score deltas, or Desloppify output as intake, proof, or closeout evidence.

Current-source audit admits implementation work for:

- `FCP-21-SF1`: playback async contract clarity for `IVideoPlayer` / `VideoPlayer`.
- `FCP-21-SF2`: direct port-confidence coverage for `UniversalTranscodeDecisionClient`.
- `FCP-21-SF3`: canonical Plex token/header helper ownership around `X-Plex-Token` header/query assembly.

Current-source audit source-disproves implementation work for:

- `FCP-21-SF4`: no distinct live priority-one runtime/assembly residual was found after completed `FCP-14`.
- `FCP-21-SF5`: no distinct live PlexAuth Home/profile/status residual was found after completed `FCP-15`.

Completion means every `FCP-21-SF*` is resolved, source-disproved, or accepted with one owner and revisit trigger; no Windows implementation starts; public playback behavior, token value flow, request ordering, stream URL semantics, auth policy, redaction, PIN, credential epoch, profile switching, and persisted auth/storage schema remain unchanged unless a stopped/replanned plan receives maintainer approval.

## Non-Goals

- Do not implement production or test code from this planning pass.
- Do not update `ARCHITECTURE_CLEANUP_CHECKLIST.md` status, mini-records, or checkboxes from this planning pass.
- Do not start, plan, or mark progress on `FCP-22`, `FCP-23`, `FCP-24`, `FCP-25`, Windows platform implementation, or broader post-FCP cleanup.
- Do not reopen completed `FCP-14` or `FCP-15` unless current source proves their closeout evidence is false. This plan source-disproves both follow-through prompts at planning time.
- Do not change observable playback behavior. Contract docs/tests may make existing `resolve`, `reject`, or event-reporting behavior explicit; behavior changes require replan.
- Do not change token redaction, token value flow, token-bearing URL semantics, auth policy, request order, Plex Home/PIN/profile-switch behavior, credential epoch, persisted keys, or storage schema.
- Do not absorb scheduler/channel-manager/content-resolution work owned by `FCP-22`, UI/channel setup/EPG workflow work owned by `FCP-23`, behavior-neutral foldering owned by `FCP-24`, or final review gate work owned by `FCP-25`.
- Do not add compatibility shims, fallback branches, root/package barrels, new dependencies, test-only exports, private-probe-only tests, or speculative helper abstractions.

## Parent Priority Alignment

`FCP-21` is the first final port-foundation cleanup package and the next safe start after completed `FCP-20`. The checklist says `FCP-22` through `FCP-25` are blocked until `FCP-21` has clean closeout evidence.

Current architecture places playback runtime under `src/modules/player/**`, Plex auth under `src/modules/plex/auth/**`, shared Plex helpers under `src/modules/plex/shared/**`, Plex stream policy under `src/modules/plex/stream/**`, and priority-one runtime assembly under `src/core/orchestrator/priority-one/**`. `src/core/orchestrator/AppOrchestrator.ts` remains a composition/runtime facade and must not regain playback, token, or auth policy.

The approved FCP-21 seam is port-readiness contract cleanup and direct confidence only:

- make the playback async method contract explicit through public docs/types/tests without changing behavior;
- test the already-extracted universal transcode decision client directly or stop if direct tests require private probing;
- centralize reusable `X-Plex-Token` read/apply behavior in the Plex shared/auth owner while preserving current token placement and request shapes;
- retain `FCP-14` priority-one and `FCP-15` PlexAuth baselines as closed unless a fresh source audit contradicts them.

## Required Reading

Read in this order before implementation or review:

1. `agents.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/README.md` routing table
4. `docs/agentic/session-prompts/cleanup-loop.md`
5. `docs/agentic/plan-authoring-standard.md`, especially Universal Plan Core, Cleanup Overlay, and FCP Source-Backed Checklist Override
6. `docs/agentic/codanna-playbook.md`
7. `ARCHITECTURE_CLEANUP_CHECKLIST.md`
   - `Fresh-Session Handoff`
   - `Operating Contract`
   - `FCP Operating Rules`
   - completed `FCP-13` through `FCP-20`
   - `FCP-21`
   - `FCP-22` through `FCP-25` only for sequencing blockers and out-of-scope routing
8. `docs/architecture/CURRENT_STATE.md`
9. `docs/architecture/modules.md`
10. `docs/api/plex-integration.md`
11. `docs/development/subtitles.md`
12. completed FCP guardrail plans:
   - `docs/plans/2026-05-05-fcp-13-low-risk-source-signal-api-export-diagnostic-closure-plan.md`
   - `docs/plans/2026-05-05-fcp-14-priority-one-forwarding-assembly-seam-plan.md`
   - `docs/plans/2026-05-05-fcp-15-plexauth-home-profile-status-helper-boundary-plan.md`
   - `docs/plans/2026-05-05-fcp-16-scheduler-current-channel-channelmanager-persistence-semantics-plan.md`
   - `docs/plans/2026-05-05-fcp-17-contentresolver-cache-coalescing-mapping-boundaries-plan.md`
   - `docs/plans/2026-05-05-fcp-18-behavior-neutral-navigation-package-organization-plan.md`
   - `docs/plans/2026-05-05-fcp-19-behavior-neutral-plex-stream-package-organization-plan.md`
   - `docs/plans/2026-05-05-fcp-20-pre-windows-cleanup-exit-source-reconciliation-plan.md`
13. completed `FCP-7` through `FCP-12` plans/checklist rows only as historical guardrails if current source contradicts recorded baseline evidence
14. this plan
15. source and test files named under `## Files In Scope`
16. `git status --short --branch`

Freshness gate: stop and refresh this plan if any `FCP-21` checklist text, playback/Plex/current architecture/API ownership text, files in scope, tests in scope, or public `IVideoPlayer` / Plex auth/stream contract text changed materially after 2026-05-05.

Planning observed branch `code-health...origin/code-health [ahead 2]` with unrelated dirty/untracked paths: `docs/archive/plans/2026-04-30-dcr-10-oversized-test-suite-structure.md`, `docs/plans/2026-04-30-dcr-exit-final-dimension-audit-plan.md`, `scorecard.png`, and `docs/agentic/evals/baseline-summaries/2026-04-28-prompt-13-feature-low-implementer-policy.md`. Preserve those paths unless a fresh source audit proves direct FCP-21 overlap.

## Required Skills

- `architecture-boundaries`: required because FCP-21 touches public runtime contracts, orchestrator priority-one guardrails, player/Plex seams, and cross-module helper ownership.
- `plex-integration-boundaries`: required because FCP-21 touches Plex auth headers, token query assembly, stream decision diagnostics, subtitle/token URL behavior, and PlexAuth baseline proof.
- `verification-strategy`: required to freeze the proof mode for behavior-preserving contract cleanup and direct confidence tests.
- `execution-plan-authoring`: required for Tier 3 source-backed FCP package planning.
- `ui-composition-patterns`: loaded because the token-helper audit crosses `src/modules/ui/playback-options/PlaybackOptionsCoordinator.ts`. No UI composition, focus, visual, overlay, or screen workflow changes are approved; if implementation needs any UI behavior work, stop and replan to the appropriate UI owner.

Do not load or proceed under `debugging-remediation` unless execution proves a concrete playback/auth/stream regression. Do not load or proceed under `persistence-boundaries` unless token/header/auth cleanup implicates persisted credential/storage schema, persisted keys, credential epoch, or selected-server profile storage; that should normally stop and replan.

## Codanna Discovery

- `get_index_info`: Codanna index contained 11,268 symbols across 761 files and 12,503 relationships. Semantic search was enabled with `JinaEmbeddingsV2BaseCode`, 52 embeddings, created/updated 9 hours before this planning pass. Because the embedding count is low and several moved stream/priority-one symbols were missed, deterministic `rg` and direct reads are recorded below as required fallback.
- `search_documents "FCP-21 Port Runtime Playback Plex Auth Readiness checklist source findings baseline docs"`: returned noisy low-score DCR plan hits, not the authoritative checklist. Direct reads of `ARCHITECTURE_CLEANUP_CHECKLIST.md` and required docs are the FCP-21 membership and sequencing source.
- `search_documents "FCP-14 FCP-15 FCP-19 FCP-20 completed baseline priority-one PlexAuth Plex stream source findings"`: returned noisy historical/design hits. Direct reads of completed FCP-14, FCP-15, FCP-19, and FCP-20 plans are the deterministic baseline source.
- `search_documents "CURRENT_STATE Plex auth stream player IVideoPlayer UniversalTranscodeDecisionClient modules architecture API docs"`: returned noisy DCR and user-guide hits. Direct reads of `CURRENT_STATE.md`, `modules.md`, `docs/api/plex-integration.md`, and `docs/development/subtitles.md` are the architecture/API source.
- `semantic_search_with_context "IVideoPlayer playback async methods reject resolve report error events play pause stop seek load player contract"`: useful enough to find `IVideoPlayer` and `VideoPlayer`-adjacent methods, especially `setAudioTrack` and `VideoPlayerEvents.waitForCanPlay`; direct reads are still required for the full async contract.
- `semantic_search_with_context "UniversalTranscodeDecisionClient universal transcode decision fetch decision URL XML parser direct coverage tests"`: missed the moved `UniversalTranscodeDecisionClient` class and returned unrelated Plex/library/UI hits. `rg` and direct reads of `src/modules/plex/stream/diagnostics/UniversalTranscodeDecisionClient.ts` and `PlexStreamResolver.test.ts` are authoritative.
- `semantic_search_with_context "Plex token header helper X-Plex-Token apply token query auth headers request helper candidates"`: found `validateToken`, `buildRequestHeaders`, `getAuthHeaders`, and auth transport symbols, but did not enumerate all token query readers. `rg` is required for raw `X-Plex-Token` extraction and query application.
- `semantic_search_with_context "PlexAuth Home profile client getHomeUsers switchHomeUser status classification profile switch"`: weak/noisy; direct `find_symbol PlexHomeProfileClient`, `find_symbol PlexAuth`, and source reads are authoritative for FCP-15 residual proof.
- `semantic_search_with_context "priority-one assembly runtime symbols PriorityOneAssemblyBuilder PriorityOneControllerFactory no-value forwarding"`: weak/noisy; direct `find_symbol PriorityOneAssemblyInput`, `search_symbols createPriorityOneRuntimeAssembly`, `analyze_impact`, and source reads are authoritative for FCP-14 residual proof.
- `find_symbol IVideoPlayer`: symbol_id `15`, interface at `src/modules/player/interfaces.ts`, implemented by `VideoPlayer`, used by 18 symbols.
- `analyze_impact IVideoPlayer`: 23 affected symbols at depth 2, including `VideoPlayer`, `PlaybackRecoveryManager`, `PlaybackReloadController`, `ChannelTuningCoordinator`, player OSD, priority-one assembly, and player tests. This makes public contract docs/tests mandatory before changing the interface.
- `find_symbol UniversalTranscodeDecisionClient`: no result; `search_symbols UniversalTranscodeDecision` also returned no results. This is a Codanna moved-symbol/index gap; `rg` located the class in `src/modules/plex/stream/diagnostics/UniversalTranscodeDecisionClient.ts`.
- `find_symbol buildRequestHeaders`: symbol_id `2000`, auth transport header builder called by auth, Plex Home profile client, library, player descriptor, and orchestrator resource URL paths.
- `analyze_impact buildRequestHeaders`: 25 affected symbols at depth 2, including `PlexAuth`, `PlexHomeProfileClient`, `PlexLibrary`, `PlaybackStreamDescriptorBuilder`, app-shell auth/profile ports, initialization auth validation, and AppOrchestrator resource URL construction.
- `search_symbols applyXPlexTokenQueryParam`: found `applyXPlexTokenQueryParam` and `applyXPlexTokenQueryParamIfTrusted` in `src/modules/plex/shared/plexUrl.ts`.
- `analyze_impact applyXPlexTokenQueryParam`: 11 affected symbols at depth 2, including `SubtitleManager`, `PlaybackOptionsCoordinator`, `PlexLibrary.getImageUrl`, `PlexDiscoveryFetchVariants`, `buildPlexResourceUrlWithAuth`, and subtitle fallback/probe paths.
- `search_symbols getAuthHeaders` and `analyze_impact getAuthHeaders`: 10 affected symbols at depth 2, including `PlexLibrary`, `PlaybackRecoveryManager`, `PlaybackStreamDescriptorBuilder`, AppOrchestrator module assembly, and `AppOrchestrator._buildPlexResourceUrl`.
- `find_symbol PlexHomeProfileClient`: symbol_id `2110`, impact only through `PlexAuth`.
- `find_symbol PlexAuth`: symbol_id `2342`; `analyze_impact` returned no impacted symbols, which is insufficient for the class. Direct `rg`/source reads prove callers through initialization, app-shell profile select ports, orchestrator auth/runtime methods, and tests.
- `find_symbol PriorityOneAssemblyInput`: symbol_id `9588`; `analyze_impact` found 15 affected priority-one collaborator/factory/builder functions.
- `analyze_impact createPriorityOneRuntimeAssembly`: limited to `AppOrchestrator.initialize` and `_initializePriorityOneControllers`, supporting source-disproof of broad priority-one residual work.
- `rg` / direct reads covered `src/modules/player/interfaces.ts`, `VideoPlayer.ts`, `VideoPlayerEvents.ts`, `types.ts`, player tests, `UniversalTranscodeDecisionClient.ts`, `PlexStreamResolver.ts`, `PlexStreamResolver.test.ts`, `plexUrl.ts`, `plexAuthTransport.ts`, `PlexAuth.ts`, `plexHomeProfileClient.ts`, token/helper callers in Plex/player/playback-options, and priority-one source/tests.

## Impact Snapshot

Current-source proof at plan time:

- `IVideoPlayer` exposes async methods with mixed semantics: `initialize`, `loadStream`, `play`, `seekTo`, `seekRelative`, `setSubtitleTrack`, and `setAudioTrack` return promises; `destroy`, `unloadStream`, `pause`, `stop`, volume/mute, media-session, getters, and event methods are synchronous.
- `setAudioTrack` already has explicit interface JSDoc and direct tests for initialization, unknown-track, and native-switch failure rejections. Other async methods have less explicit interface-level failure wording even though implementation/tests show stable behavior.
- `VideoPlayer.loadStream()` rejects when uninitialized, when preferred subtitle selection rejects, when media canplay errors, and when `waitForCanPlay()` times out; media element errors after load are reported through `PlayerEventMap.error` for unrecoverable errors and status updates for recoverable retry behavior.
- `VideoPlayer.play()` rejects when uninitialized or when native `video.play()` rejects, logs through `logVideoPlayerPlayFailure`, and does not convert failures into player error events.
- `VideoPlayer.seekTo()` rejects when uninitialized or when the `seeked` event does not arrive before timeout. `seekRelative()` delegates to `seekTo()`.
- `VideoPlayer.setSubtitleTrack()` may reject via `SubtitleManager.setActiveTrack()` or async recovery hooks, and also emits `trackChange` / state updates for successful or deferred deactivation paths. Tests already cover significant subtitle behavior but the public interface does not describe the failure/reporting split.
- `VideoPlayerEvents` owns post-load media event failure reporting. `waitForCanPlay()` rejects on detached video, media error, or timeout, while `_handleError()` emits `PlayerEventMap.error` only for unrecoverable media errors after retry policy declines recovery.
- `UniversalTranscodeDecisionClient` already owns request conversion, decision URL derivation, 4s fetch timeout, auth failure handling through `PlexStreamResolver._throwIfAuthFailure`, non-ok rejection, DOMParser XML parsing, and regex fallback parsing. Current direct tests exercise it only through `PlexStreamResolver.fetchUniversalTranscodeDecision`; there is no class-local test file for constructor wiring, `_toHlsOptions` request propagation, decision URL conversion, non-ok failure, malformed XML fallback, or auth failure passthrough.
- `PlexStreamResolver.fetchUniversalTranscodeDecision()` is a thin public delegator to the client. Existing resolver tests prove public integration and debug logging, but FCP-21-SF2 asks for direct client confidence or a no-code proof. Current source favors direct tests because the class is already extracted and has a narrow constructor seam.
- `plexAuthTransport.buildRequestHeaders()` is the canonical owner for Plex identity headers and `X-Plex-Token` header assembly.
- `src/modules/plex/shared/plexUrl.ts` owns query application helpers: `applyXPlexTokenQueryParam`, `applyXPlexTokenQueryParamIfTrusted`, `applyXPlexQueryParamsFromHeaders`, and `buildPlexResourceUrlWithAuth`.
- Raw token extraction from `Record<string, string>` is duplicated in production code: `SubtitleManager._getAuthTokenFromHeaders`, `PlaybackOptionsCoordinator.getAuthTokenFromHeaders`, `plexSubtitleFallbackPolicy.getAuthTokenFromHeaders`, `SubtitleStreamProbeSupport.readTokenFromHeaders`, `PlexDiscoveryFetchVariants` local read, and `buildPlexResourceUrlWithAuth` local read. Centralizing this read in the shared Plex URL/header helper owner can reduce duplication without changing token placement.
- `PlexLibrary.getImageUrl()` uses `getAuthToken()` rather than `getAuthHeaders()`; this is library-local config shape and should not be changed unless source audit proves it can use the canonical helper without changing image URL behavior. This plan expects only query-application helper use, not config-shape redesign.
- `PlaybackOptionsCoordinator` has one token-helper caller for subtitle extractability probe cache keys and probe URLs. This plan permits only a narrow import/call replacement to a canonical Plex token helper. Any focus, UI lifecycle, screen workflow, status text, or remote interaction change is out of scope and triggers replan.
- `PriorityOneAssemblyInput`, `PriorityOneAssemblyBuilder`, `PriorityOneControllerCollaborators`, and `PriorityOneControllerFactory` currently preserve owner-valued seams from FCP-14: grouped input shaping, controller-specific dependency creation, delayed channel badge sync, recoverable async failure reporting, event binder construction, playback runtime lifecycle, and profile-switch cleanup. No current-source no-value forwarding residual was found for `FCP-21-SF4`.
- `PlexHomeProfileClient` currently owns Home user fetch, v2/v1 endpoint fallback, status classification, profile-switch request URL/PIN handling, wrong-PIN disambiguation, and sanitized error causes. `PlexAuth` delegates Home/profile operations while retaining credential state, credential epoch, token validation, PIN flow, storage, and `authChange` / `profileChange` events. No current-source auth-local residual was found for `FCP-21-SF5`.

## Files In Scope

- `src/modules/player/interfaces.ts`
- `src/modules/player/VideoPlayer.ts`
- `src/modules/player/VideoPlayerEvents.ts`
- `src/modules/player/types.ts` only for documentation/type-comment alignment if needed; public event payload shapes are frozen
- `src/modules/player/SubtitleManager.ts` only for canonical token helper adoption; subtitle behavior is frozen
- `src/modules/player/__tests__/VideoPlayer.test.ts`
- `src/modules/player/__tests__/VideoPlayerEvents.test.ts`
- `src/modules/player/__tests__/PlaybackReloadController.test.ts` only if playback async contract proof affects reload behavior
- `src/modules/player/__tests__/PlaybackRecoveryManager.test.ts` only if playback async contract proof affects recovery/reload behavior
- `src/modules/plex/stream/diagnostics/UniversalTranscodeDecisionClient.ts`
- new `src/modules/plex/stream/__tests__/UniversalTranscodeDecisionClient.test.ts` or equivalent direct class test file
- `src/modules/plex/stream/resolver/PlexStreamResolver.ts` only for public delegator/type alignment if direct client tests expose a public seam mismatch
- `src/modules/plex/stream/__tests__/PlexStreamResolver.test.ts`
- `src/modules/plex/shared/plexUrl.ts`
- `src/modules/plex/shared/__tests__/plexUrl.test.ts`
- `src/modules/plex/stream/policy/plexSubtitleFallbackPolicy.ts`
- `src/modules/plex/stream/__tests__/plexSubtitleFallbackPolicy.test.ts`
- `src/modules/plex/stream/diagnostics/SubtitleStreamProbeSupport.ts`
- `src/modules/plex/stream/__tests__/SubtitleStreamProbeSupport.test.ts`
- `src/modules/plex/discovery/PlexDiscoveryFetchVariants.ts`
- `src/modules/plex/discovery/__tests__/PlexDiscoveryFetchVariants.test.ts`
- `src/modules/plex/library/PlexLibrary.ts` only for token query helper adoption in `getImageUrl()` when source audit proves no config-shape behavior drift
- `src/modules/plex/library/__tests__/PlexLibrary.test.ts` only if `PlexLibrary.getImageUrl()` token query helper use changes
- `src/modules/ui/playback-options/PlaybackOptionsCoordinator.ts` only for replacing local `X-Plex-Token` extraction/application with the canonical helper; no UI behavior/composition/focus changes are approved
- `src/modules/ui/playback-options/__tests__/PlaybackOptionsCoordinator.test.ts` only for token probe URL/cache behavior preservation if the coordinator import/call changes
- `src/modules/plex/auth/plexAuthTransport.ts` and `src/modules/plex/auth/__tests__/PlexAuth.test.ts` only if helper naming/export docs around header construction need alignment; auth behavior is frozen
- `docs/api/plex-integration.md`, `docs/development/subtitles.md`, `docs/architecture/CURRENT_STATE.md`, and `docs/architecture/modules.md` only if implementation source audit proves public contract/path/owner truth changed
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` only during package closeout after clean implementation review and verification, not in this planning pass

## Files Out Of Scope

- Windows platform implementation and Windows-specific playback/auth behavior.
- `FCP-22` scheduler/channel-manager/content-resolution source files and tests.
- `FCP-23` channel setup, EPG, navigation, focus, visual, or UI workflow changes. The only approved UI-file touch is the narrow playback-options token helper replacement named above.
- `FCP-24` behavior-neutral foldering, package organization, import-path churn, shims, barrels, or compatibility exports.
- `FCP-25` final review artifacts and retrospective score/tool refresh.
- Public playback behavior changes, event payload shape changes, media retry policy changes, subtitle delivery behavior changes, audio switching behavior changes, stream URL semantics changes, request ordering changes, auth token value flow changes, token redaction changes, credential epoch/storage/schema/key changes, PIN flow changes, Home/profile switching behavior changes, and profile-select UI behavior changes.
- Plex discovery/library feature behavior beyond the narrow helper replacement named in scope.
- Priority-one production edits unless source audit contradicts the FCP-14 baseline and this plan is refreshed.
- PlexAuth Home/profile production edits unless source audit contradicts the FCP-15 baseline and this plan is refreshed.
- Pre-existing unrelated dirty/untracked workspace files listed under `## Required Reading`.

## Planner Self-Check

1. Package membership is explicit: `FCP-21-SF1`, `FCP-21-SF2`, and `FCP-21-SF3` map to implementation slices inside `FCP-21-W1`; `FCP-21-SF4` and `FCP-21-SF5` map to source-disproved no-code dispositions.
2. Adjacent contract changes are explicit: `IVideoPlayer` async contract docs/tests may be clarified, but method behavior, return types, and event payload shapes are frozen unless a replan approves behavior change.
3. Files out of scope are not hidden dependencies. Playback-options is in scope only for token helper call replacement. Any real UI/focus/workflow change stops and replans.
4. Codanna evidence and insufficiencies are recorded, including weak document search, missing moved `UniversalTranscodeDecisionClient` symbol, weak priority-one/Home semantic search, and deterministic `rg` fallback.
5. The plan uses repo-preferred owners: playback contracts stay in player, universal transcode decision stays in Plex stream diagnostics, token header construction stays in Plex auth transport, token query/read helpers stay in Plex shared URL helpers, priority-one stays closed under its owner, and PlexAuth keeps credential/event ownership.
6. A fresh cleanup-loop session can start `ready_now_execution_unit` `FCP-21-W1` without deciding package membership, parallelism, final owners, or verification depth.
7. This is execution-grade at seam/scope/verification level and leaves ordinary implementation details such as helper names, exact assertions, and local import style to the cleanup worker.

## Architecture Seam Decision Gate / Replan Triggers

Approved execution seam:

- Execute one serial wave, `FCP-21-W1`, covering `FCP-21-S1`, `FCP-21-S2`, and `FCP-21-S3`.
- Treat `FCP-21-S1` as public playback contract clarification. It may update interface docs and add/adjust direct tests for existing `VideoPlayer` / `VideoPlayerEvents` behavior. It must not change whether methods reject, resolve, or report errors through events.
- Treat `FCP-21-S2` as direct confidence for `UniversalTranscodeDecisionClient`. Prefer a direct class test file over exposing private methods. Constructor dependencies may be faked through the existing public constructor; do not add test-only exports.
- Treat `FCP-21-S3` as canonical token helper centralization. The canonical helper may live in `src/modules/plex/shared/plexUrl.ts` or an adjacent Plex shared owner and should read/apply `X-Plex-Token` consistently from auth headers without changing token values, URL shape, header shape, request ordering, or redaction.
- `buildRequestHeaders()` remains the header construction owner. Do not move auth identity or credential/token policy into `plexUrl.ts`.
- `applyXPlexQueryParamsFromHeaders()` / query helper behavior remains token/query assembly policy. Callers should use the canonical helper instead of duplicating local `headers['X-Plex-Token']` reads when they need only token extraction/application.
- `FCP-21-SF4` remains source-disproved unless fresh audit finds no-value priority-one forwarding, runtime contract ambiguity, or ownership residue distinct from the completed FCP-14 baseline.
- `FCP-21-SF5` remains source-disproved unless fresh audit finds Home/profile/status boundary residue distinct from the completed FCP-15 baseline.

Stop and replan if:

- any public playback behavior changes, including async method rejection/resolve behavior, event emission, error payloads, retry semantics, subtitle selection behavior, audio switching behavior, media-session behavior, or load/seek/play behavior;
- direct universal transcode decision tests require private probing, test-only exports, DOMParser monkey-patching beyond stable public constructor behavior, or behavior changes to pass;
- token/helper cleanup changes token value flow, token redaction, token query/header placement, request order, stream URL semantics, Plex discovery/library/auth behavior, subtitle URL attempt order, or observable request shapes;
- token/header cleanup implicates PIN flow, credential epoch, persisted auth keys/schema, selected-server map/profile persistence, Home/profile switch behavior, or public `IPlexAuth` shape;
- source audit needs scheduler, channel-manager, content-resolution, channel setup, EPG, navigation, focus, visual UI workflow, package organization, or Windows platform work;
- a playback-options edit grows beyond import/call replacement into UI composition, lifecycle, focus, status text, or remote behavior;
- completed `FCP-14` or `FCP-15` evidence appears source-false;
- newly discovered residue changes package membership, execution-unit membership, final-owner accounting, owner seam, or verification surface.

Absorb-now rule: absorb only newly discovered residue that stays within `FCP-21-W1`'s approved goal, owners, files, verification envelope, and final-owner accounting. Record absorbed residue in implementation/review output. Replan for any new owner, wider verification, changed source-finding coverage, or changed execution-unit membership.

## Verification Commands

Verification strategy classification: `new regression/contract test required`.

Primary verification mode: `contract-first`, with `refactor-invariance` support for token-helper centralization. FCP-21 is behavior-preserving port-readiness work, but the current source audit found under-explicit public playback contracts, no direct `UniversalTranscodeDecisionClient` tests, and duplicated token helper logic. New or tightened tests are required for the public seams being clarified.

Plan validation:

1. `npm run plans:check`
   - Expected: active tracked plan structure passes, including FCP source-backed `source_finding_ids`, `coverage_check`, ready-now wave, execution waves, and coverage ledger.
2. `npm run verify:docs`
   - Expected: docs/control-plane verification passes for the active plan. Run again during package closeout if checklist/current-state/modules/API/subtitle docs are updated.

Pre/post source audits:

1. Playback async contract audit:
   - Run: `rg -n "initialize\\(|loadStream\\(|play\\(|seekTo\\(|seekRelative\\(|setSubtitleTrack\\(|setAudioTrack\\(|PlayerEventMap|waitForCanPlay|_handleError" src/modules/player src/modules/player/__tests__ src/core src/modules/ui/playback-options`
   - Expected pre-edit: current async/public event surfaces are identified. Expected post-edit: interface docs/tests name existing reject/resolve/event-reporting behavior without changing runtime code beyond approved contract alignment.
2. Universal transcode decision audit:
   - Run: `rg -n "UniversalTranscodeDecisionClient|fetchUniversalTranscodeDecision|universal/decision|decisionCode|serverDecision" src/modules/plex/stream src/modules/debug src/core docs/api`
   - Expected post-edit: direct client coverage exists or a source-backed no-code disposition is recorded; resolver public delegator behavior remains stable.
3. Token/header helper audit:
   - Run: `rg -n "getAuthTokenFromHeaders|readTokenFromHeaders|headers\\[['\\\"]X-Plex-Token['\\\"]\\]|searchParams\\.set\\(['\\\"]X-Plex-Token|params\\.set\\(['\\\"]X-Plex-Token" src/modules/player src/modules/plex src/modules/ui/playback-options src/core`
   - Expected post-edit: production token extraction/application routes through the canonical helper except source-justified owner points such as `buildRequestHeaders()` and helper internals; tests may still assert literal token keys.
4. Priority-one no-code audit:
   - Run: `rg -n "PriorityOneAssemblyInput|createPriorityOneRuntimeAssembly|buildPriorityOneAssemblyInput|PriorityOneControllerCollaborators|forward|adapter|TODO|noop|no-op|pass through|pass-through" src/core/orchestrator/priority-one src/core/orchestrator/AppOrchestrator.ts src/core/orchestrator/__tests__`
   - Expected: no source-proven FCP-21-SF4 residual beyond owner-valued seams already closed by FCP-14.
5. PlexAuth Home/profile no-code audit:
   - Run: `rg -n "PlexHomeProfileClient|getHomeUsers|requestHomeUserSwitch|switchHomeUser|_credentialsEpoch|authChange|profileChange|lineup_plex_auth|HOME_USERS_ENDPOINT" src/modules/plex/auth src/core src/modules/ui/profile-select`
   - Expected: Home/profile request/status work remains in `PlexHomeProfileClient`; credential/epoch/storage/events remain in `PlexAuth`; no FCP-21-SF5 residual is source-proven.

Focused tests:

1. `npm test -- VideoPlayer VideoPlayerEvents`
   - Expected: playback load/play/seek/subtitle/audio method contracts, canplay rejection, media error event reporting, retry/error state behavior, and existing player invariants pass with added or tightened assertions.
2. `npm test -- PlaybackReloadController PlaybackRecoveryManager`
   - Expected: callers that depend on `IVideoPlayer.loadStream`, `unloadStream`, subtitle/audio reload, and recovery behavior remain stable after contract clarification.
3. `npm test -- UniversalTranscodeDecisionClient PlexStreamResolver`
   - Expected: direct client tests prove request conversion, decision URL derivation, fetch timeout, auth failure passthrough, non-ok handling, XML parsing, and fallback parsing; resolver public delegation and debug behavior remain stable.
4. `npm test -- plexUrl plexSubtitleFallbackPolicy SubtitleStreamProbeSupport SubtitleManager PlaybackOptionsCoordinator PlexDiscoveryFetchVariants`
   - Expected: token query/header helpers preserve subtitle direct/fallback/probe behavior, playback-options probe cache/request behavior, discovery token variants, and shared URL helper behavior.
5. `npm test -- PlexLibrary PlexAuth plexHomeProfileClient`
   - Expected if library/auth helper code is touched: image URL token attachment, auth header construction, token redaction, Home/profile behavior, credential/event behavior, and helper tests remain stable.
6. `npm test -- PriorityOneAssemblyBuilder PriorityOneControllerCollaborators PriorityOneControllerFactory`
   - Expected: priority-one FCP-14 baseline remains intact; run as guardrail if SF4 source audit finds touched or suspicious priority-one files.
7. `npm run typecheck`
   - Expected: no TypeScript errors after docs/types/helper/test changes.
8. `git diff --check`
   - Expected: no whitespace errors across the FCP-21 diff.
9. `npm run verify`
   - Expected: full UI/navigation/orchestrator/Plex/runtime gate passes before FCP-21 closeout because this package touches playback, Plex, and one playback-options token helper path.

Package closeout:

- Source-finding proof matrix for every `FCP-21-SF*`, using only FCP source-backed ids.
- Package-local old/replacement audits for playback contract wording, direct transcode decision coverage, token helper duplication, priority-one baseline, and PlexAuth baseline.
- `npm run plans:check`
- `npm run verify:docs` if checklist/current architecture/API/subtitle/plan docs are updated
- `npm run typecheck`
- `git diff --check`
- `npm run verify`
- Clean implementation/closeout review before `FCP-22` planning or implementation starts.

## Rollback Notes

- Roll back by execution wave `FCP-21-W1`.
- If playback parity fails, restore previous `VideoPlayer` / `IVideoPlayer` code and keep only tests or docs that accurately expose the existing behavior. Do not change runtime behavior to satisfy newly written contract text without replan.
- If direct universal transcode decision tests expose a real behavior ambiguity, revert any behavior-changing edits and replan around the Plex stream diagnostics owner.
- If token helper centralization changes any request URL/header/order or redaction behavior, restore the previous local token handling and keep any helper tests that exposed the parity gap.
- If a priority-one or PlexAuth audit contradicts completed FCP-14/FCP-15 evidence, do not patch under this plan; stop and route a source-backed replan.
- If docs/checklist closeout fails, leave reviewed source/test changes intact and fix tracked docs in a separate controller-owned closeout pass.
- Never revert unrelated dirty/untracked workspace paths.

## Commit Checkpoints

- Planning artifact checkpoint: this active plan may be committed separately from any future implementation or closeout work.
- `FCP-21-W1` implementation checkpoint: playback async contract docs/tests, direct `UniversalTranscodeDecisionClient` tests, canonical token helper cleanup, and focused tests/source audits.
- Closeout checkpoint: after clean implementation review and required verification pass, update `ARCHITECTURE_CLEANUP_CHECKLIST.md` and any narrow current architecture/API/subtitle docs only if source audit proves truth changed.
- Keep active tracked plan churn separate from implementation commits unless the controller explicitly chooses a tracked-doc checkpoint.
- Do not mix unrelated dirty files into FCP-21 commits.

## Package Decomposition

- `package_id`: `FCP-21`
- `checklist_token`: `FCP-21`
- `source_finding_ids`:
  - `FCP-21-SF1`
  - `FCP-21-SF2`
  - `FCP-21-SF3`
  - `FCP-21-SF4`
  - `FCP-21-SF5`

`slice_table`:

| slice_id | goal | areas/files | source_finding_ids | verification | dependencies | stop_condition | handoff_condition | serial_only | parallel_justification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FCP-21-S1` | Make `IVideoPlayer` async method rejection/resolve/event-reporting contracts explicit and directly tested without changing playback behavior. | `src/modules/player/interfaces.ts`; `src/modules/player/VideoPlayer.ts`; `src/modules/player/VideoPlayerEvents.ts`; `src/modules/player/types.ts` docs/type comments only if needed; `VideoPlayer.test.ts`; `VideoPlayerEvents.test.ts`; reload/recovery tests if affected. | `FCP-21-SF1` | Playback source audit; `npm test -- VideoPlayer VideoPlayerEvents`; `npm test -- PlaybackReloadController PlaybackRecoveryManager` if touched/affected; `npm run typecheck`; `git diff --check`; final `npm run verify`. | None. First slice in the ready wave. | Stop if public playback behavior, event payloads, retry/error policy, subtitle/audio switching behavior, or method signatures must change; stop if proof needs private probing. | Public interface/docs/tests clearly state which async methods reject and which failures report through events; current behavior remains unchanged and tests pass. | true | Shares `IVideoPlayer` and player-call proof with S2/S3 runtime verification; running serially prevents contract text from chasing later helper changes. |
| `FCP-21-S2` | Add direct port-confidence coverage for `UniversalTranscodeDecisionClient` while keeping `PlexStreamResolver.fetchUniversalTranscodeDecision()` as the public delegating contract. | `src/modules/plex/stream/diagnostics/UniversalTranscodeDecisionClient.ts`; new direct client test; `PlexStreamResolver.ts` only for delegator/type alignment if needed; `PlexStreamResolver.test.ts`. | `FCP-21-SF2` | Universal decision source audit; `npm test -- UniversalTranscodeDecisionClient PlexStreamResolver`; `npm run typecheck`; `git diff --check`; final `npm run verify`. | After S1 source audit so playback contract wording does not conflict with stream diagnostics behavior. | Stop if direct tests require private accessors/test-only exports, behavior changes, URL/request order changes, or stream/auth/redaction changes. | Direct client tests prove request conversion, decision URL derivation, timeout, auth failure passthrough, non-ok handling, and parsing; resolver public behavior remains stable. | true | Same Plex stream diagnostic owner and verification envelope as S3; serial execution avoids overlapping request/header assumptions. |
| `FCP-21-S3` | Centralize reusable Plex token/header helper ownership for `X-Plex-Token` header reads/query application while preserving token value flow and observable requests. | `src/modules/plex/shared/plexUrl.ts`; `plexUrl.test.ts`; in-scope token-helper callers in `SubtitleManager.ts`, `plexSubtitleFallbackPolicy.ts`, `SubtitleStreamProbeSupport.ts`, `PlexDiscoveryFetchVariants.ts`, `PlexLibrary.ts` only if source-proven safe, and `PlaybackOptionsCoordinator.ts` only for narrow helper call replacement; affected tests. | `FCP-21-SF3` | Token/helper source audit; `npm test -- plexUrl plexSubtitleFallbackPolicy SubtitleStreamProbeSupport SubtitleManager PlaybackOptionsCoordinator PlexDiscoveryFetchVariants`; `npm test -- PlexLibrary PlexAuth plexHomeProfileClient` if touched; `npm run typecheck`; `git diff --check`; final `npm run verify`. | After S2 so universal decision request/header expectations are stable before token helper call sites are rewritten. | Stop if token value flow, redaction, query/header placement, request order, stream URL semantics, auth policy, discovery/library behavior, subtitle fallback order, playback-options UI behavior, or persisted credential/storage behavior changes. | Production token extraction/application routes through the canonical helper except source-justified owner points; observable URLs/headers and tests remain stable. | true | Token helper touches multiple Plex/player/UI-adjacent callers with shared request-shape tests; parallel edits would risk conflicting token placement. |
| `FCP-21-S4` | Source-disprove priority-one follow-through after FCP-14 unless current source proves a distinct live residual. | Read-only audit of `src/core/orchestrator/priority-one/**`, `src/core/orchestrator/AppOrchestrator.ts` priority-one call site, and priority-one tests. | `FCP-21-SF4` | Source audit plus optional `npm test -- PriorityOneAssemblyBuilder PriorityOneControllerCollaborators PriorityOneControllerFactory` guardrail. | Completed FCP-14 baseline. | Stop and replan if no-value forwarding, runtime contract ambiguity, or ownership residue is source-proven. | Planning disposition: source-disproved at plan time; no implementation approved. | true | No-code disposition; implementation would reopen completed FCP-14 without current-source proof. |
| `FCP-21-S5` | Source-disprove PlexAuth Home/profile/status follow-through after FCP-15 unless current source proves a distinct live residual. | Read-only audit of `src/modules/plex/auth/PlexAuth.ts`, `plexHomeProfileClient.ts`, auth interfaces/tests, and caller seams. | `FCP-21-SF5` | Source audit plus optional `npm test -- PlexAuth plexHomeProfileClient` guardrail if auth files are touched by S3. | Completed FCP-15 baseline. | Stop and replan if Home/profile/status boundary residue, auth-local contract ambiguity, credential/event drift, or token/PIN/persistence behavior drift is source-proven. | Planning disposition: source-disproved at plan time; no implementation approved. | true | No-code disposition; implementation would reopen completed FCP-15 without current-source proof. |

`coverage_check`:

- `FCP-21-SF1` maps exactly once to `FCP-21-S1`.
- `FCP-21-SF2` maps exactly once to `FCP-21-S2`.
- `FCP-21-SF3` maps exactly once to `FCP-21-S3`.
- `FCP-21-SF4` maps exactly once to no-code source-disproved disposition `FCP-21-S4`; final owner is FCP-21 closeout, with revisit trigger only if priority-one assembly source changes or a fresh audit contradicts FCP-14.
- `FCP-21-SF5` maps exactly once to no-code source-disproved disposition `FCP-21-S5`; final owner is FCP-21 closeout, with revisit trigger only if PlexAuth/Home/profile source changes or a fresh audit contradicts FCP-15.
- No FCP-22, FCP-23, FCP-24, or FCP-25 source finding is admitted.
- No detector/imported/package-map/raw review id maps into FCP-21 coverage.

`ready_now_execution_unit`: `FCP-21-W1`

`ready_now_slice`: `FCP-21-S1`

`recommended_slice_order`:

1. `FCP-21-S1`
2. `FCP-21-S2`
3. `FCP-21-S3`
4. `FCP-21-S4` and `FCP-21-S5` source-disproved dispositions are rechecked during package closeout before checklist completion.

`parallel_execution_policy`: no parallel implementation. The approved ready-now execution unit is one serial wave because playback contracts, universal transcode diagnostics, and token/header helper ownership share runtime/Plex verification and request-shape risk. Parallel workers would duplicate source audits and could create conflicting assumptions about token/header behavior.

`execution_waves`:

| wave_id | slice_ids | completion_condition | absorb_now_scope | replan_triggers |
| --- | --- | --- | --- | --- |
| `FCP-21-W1` | `FCP-21-S1`, `FCP-21-S2`, `FCP-21-S3` | `FCP-21-SF1` through `FCP-21-SF3` are resolved with source proof; `FCP-21-SF4` and `FCP-21-SF5` remain source-disproved or trigger a replan; targeted tests, `typecheck`, `git diff --check`, and `npm run verify` pass; clean review approves the wave. | Newly discovered playback/Plex token/test residue may be absorbed only if it stays within the same player/Plex shared/stream/auth helper files, preserves behavior, uses the same verification commands, and does not change final-owner accounting. | Any stop condition in the seam gate; need for public behavior change; need for persistence/auth/schema/profile/PIN changes; need for scheduler/UI workflow/package-organization work; completed FCP-14/FCP-15 baseline contradiction; or a new owner/finding outside FCP-21. |

`coverage_ledger`:

| source_finding_id | planned_status | execution_owner | closeout_proof |
| --- | --- | --- | --- |
| `FCP-21-SF1` | implementation in `FCP-21-S1` | player runtime contract owner | interface/source/test proof that async playback reject/resolve/event-reporting contracts are explicit and behavior unchanged |
| `FCP-21-SF2` | implementation in `FCP-21-S2` | Plex stream diagnostics owner | direct `UniversalTranscodeDecisionClient` tests or stopped/replanned no-code proof |
| `FCP-21-SF3` | implementation in `FCP-21-S3` | Plex shared/auth token helper owner | canonical helper source audit, old-pattern audit, token/request-shape tests, and redaction preservation |
| `FCP-21-SF4` | source-disproved at plan time | FCP-21 closeout owner, priority-one baseline guardrail | priority-one source audit confirms FCP-14 remains true; no code approved |
| `FCP-21-SF5` | source-disproved at plan time | FCP-21 closeout owner, PlexAuth baseline guardrail | PlexAuth/Home/profile source audit confirms FCP-15 remains true; no code approved |

## Priority-Exit Readiness

`FCP-21` is a full FCP package and must close before any `FCP-22` planning or implementation starts.

- `FCP-21-SF1`
  - Planned disposition: resolved by `FCP-21-S1`.
  - Final owner: player runtime contract owner.
  - Revisit trigger: `IVideoPlayer`, `VideoPlayer`, or `VideoPlayerEvents` public async behavior changes.
- `FCP-21-SF2`
  - Planned disposition: resolved by `FCP-21-S2`.
  - Final owner: Plex stream diagnostics owner.
  - Revisit trigger: universal transcode decision request/parse behavior or debug decision surface changes.
- `FCP-21-SF3`
  - Planned disposition: resolved by `FCP-21-S3`.
  - Final owner: Plex shared/auth token helper owner.
  - Revisit trigger: new production `X-Plex-Token` header/query assembly or raw token extraction appears outside canonical helper/owner points.
- `FCP-21-SF4`
  - Planned disposition: source-disproved by planning audit, rechecked at closeout.
  - Final owner: FCP-21 closeout owner with FCP-14 priority-one baseline as guardrail.
  - Revisit trigger: priority-one assembly source changes or fresh source audit proves no-value forwarding/runtime contract ambiguity.
- `FCP-21-SF5`
  - Planned disposition: source-disproved by planning audit, rechecked at closeout.
  - Final owner: FCP-21 closeout owner with FCP-15 PlexAuth baseline as guardrail.
  - Revisit trigger: PlexAuth/Home/profile source changes or fresh source audit proves auth-local boundary ambiguity.
- Deferred or split items: none approved at plan start.
- P0/security disposition: no open P0 security finding is known from this planning audit. If token/redaction/auth/security drift is found during execution, stop and route it as a blocker with one owner.
- Before `FCP-22` starts, FCP-21 closeout must record the source-finding proof matrix, old/replacement token and playback audits, targeted test evidence, `npm run typecheck`, `git diff --check`, `npm run verify`, required docs verification if docs changed, and clean closeout review evidence.

## FCP-21 Execution Packet

Use this bounded packet for the next cleanup-loop implementation pass.

- Execution unit: `FCP-21-W1`
- Ready slice: `FCP-21-S1`
- Slice order: `FCP-21-S1` -> `FCP-21-S2` -> `FCP-21-S3`; recheck `FCP-21-S4` and `FCP-21-S5` no-code dispositions at closeout.
- Write scope:
  - files listed under `FCP-21-S1`, `FCP-21-S2`, and `FCP-21-S3`
  - architecture/API/subtitle docs only if source truth changes
  - checklist only during controller closeout after clean review and verification
- Read-only audit scope:
  - priority-one files/tests for `FCP-21-SF4`
  - PlexAuth/Home/profile files/tests for `FCP-21-SF5`
  - completed FCP-14, FCP-15, FCP-19, and FCP-20 plans as guardrails
- Required output:
  - source-finding proof matrix for all five `FCP-21-SF*`
  - playback async contract proof
  - universal transcode decision direct coverage proof
  - token/helper old/replacement audit and redaction/request-shape proof
  - explicit confirmation that FCP-14 and FCP-15 baselines remain true or a stopped/replanned blocker
  - verification command results or precise blocker evidence
- Review evidence rule: cleanup worker must not claim clean review evidence. The controller records clean implementation/closeout review evidence only after review is observed clean.
