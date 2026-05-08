**Plan Status:** completed
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

# FCP-19 Behavior-Neutral Plex Stream Package Organization Plan

## Goal

Retire exactly `ARCHITECTURE_CLEANUP_CHECKLIST.md` item `FCP-19` by closing `FCP-19-SF1`: the Plex stream package flat folder mixes resolver, policy, URL helpers, subtitle probe/debug, and pipeline code.

This is an `FCP-*` source-backed cleanup package. Coverage is defined only by checklist `source_finding_id` value `FCP-19-SF1`; do not use Desloppify, detector ids, imported review ids, package-map ids, score output, stale hotspot wording, or retrospective review text as intake, proof, or closeout.

Completion means `src/modules/plex/stream/` is organized around current focused owners without changing stream resolution, playback URLs, universal transcode decisions, subtitle delivery/probe/debug behavior, diagnostics, auth/token handling, token redaction, public exported names, or caller-visible contracts.

## Non-Goals

- Do not implement production or test code from this planning pass.
- Do not reopen completed `FCP-7` through `FCP-18`, start `FCP-20`, `FCP-EXIT`, Windows port work, Plex auth/stream behavior redesign, navigation work, UI work, Orchestrator work, or broader post-FCP cleanup.
- Do not change playback behavior, stream-selection behavior, direct-play/transcode policy, universal transcode decision behavior, subtitle delivery, subtitle debug probe scheduling/logging, diagnostics, auth handling, token placement, token redaction, server selection, Plex library behavior, player behavior, or Orchestrator runtime behavior except import-path updates required by approved file moves.
- Do not add fallback branches, compatibility re-export files at old stream leaf paths, new root/package barrels, subfolder barrels, widened public exports, test-only exports, temporary adapters, new dependencies, or speculative helpers.
- Do not authorize ChannelSetupScreen implementation. The `Deferred ChannelSetupScreen Candidate Analysis` section is read-only planning analysis only and is outside `source_finding_ids`, `coverage_check`, and `ready_now_execution_unit`.

## Parent Priority Alignment

`FCP-19` is the next safe package after completed `FCP-18`. The checklist marks `FCP-18` completed with no follow-ups and states `FCP-20`, `FCP-EXIT`, Windows port work, and other post-FCP cleanup must wait for clean `FCP-19` closeout evidence.

Current architecture docs identify `src/modules/plex/stream/` as the owner for stream URL resolution, subtitle/transcode/HDR policy, and stream/subtitle diagnostics. `PlexStreamResolver` remains the public `IPlexStreamResolver` implementation; `SubtitleStreamDebugProbeCoordinator` owns debug subtitle discovery/probe scheduling; `UniversalTranscodeDecisionClient` owns universal transcode decision request conversion and parsing.

The approved seam is behavior-neutral package organization only. The package may regroup existing stream files under focused subfolders and update import paths. It must not create new behavior owners, change public contracts, or move Plex stream policy into auth, discovery, library, player, scheduler, UI, app-shell, Orchestrator, or shared utility owners.

## Required Reading

Read in this order before implementation or review:

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/README.md` routing table
4. `docs/agentic/session-prompts/cleanup-loop.md`
5. `docs/agentic/plan-authoring-standard.md`, especially Universal Plan Core, Cleanup Overlay, and FCP Source-Backed Checklist Override
6. `docs/agentic/codanna-playbook.md`
7. `ARCHITECTURE_CLEANUP_CHECKLIST.md` sections `Fresh-Session Handoff`, `Operating Contract`, `FCP Operating Rules`, `FCP-18`, `FCP-19`, `Deferred Pre-Port Candidate: ChannelSetupScreen Distinct Residual`, and `FCP-20`
8. `docs/architecture/CURRENT_STATE.md`
9. `docs/architecture/modules.md`
10. `docs/api/plex-integration.md`, especially Stream Resolution and the token/redaction caution
11. Completed guardrail plans only:
    - `docs/plans/2026-05-02-fcp-7-boundary-type-hygiene-plan.md`
    - `docs/plans/2026-05-02-fcp-8-api-plex-error-contract-coherence-plan.md`
    - `docs/plans/2026-05-02-fcp-9-source-signal-convention-local-elegance-plan.md`
    - `docs/plans/2026-05-02-fcp-10-epg-renderer-direct-confidence-presentation-decomposition-plan.md`
    - `docs/plans/2026-05-02-fcp-11-runtime-owner-reduction-hotspots-plan.md`
    - `docs/plans/2026-05-02-fcp-12-package-organization-structure-navigation-final-exit-plan.md`
    - `docs/plans/2026-05-05-fcp-13-low-risk-source-signal-api-export-diagnostic-closure-plan.md`
    - `docs/plans/2026-05-05-fcp-14-priority-one-forwarding-assembly-seam-plan.md`
    - `docs/plans/2026-05-05-fcp-15-plexauth-home-profile-status-helper-boundary-plan.md`
    - `docs/plans/2026-05-05-fcp-16-scheduler-current-channel-channelmanager-persistence-semantics-plan.md`
    - `docs/plans/2026-05-05-fcp-17-contentresolver-cache-coalescing-mapping-boundaries-plan.md`
    - `docs/plans/2026-05-05-fcp-18-behavior-neutral-navigation-package-organization-plan.md`, especially the single-slice package-organization pattern
12. This plan
13. `src/modules/plex/stream/*`
14. `src/modules/plex/stream/__tests__/*`
15. Related imports/tests discovered by current source audit, including the external direct stream leaf imports named in `## Impact Snapshot`
16. For the read-only deferred addendum only: `src/modules/ui/channel-setup/*`, `src/modules/ui/channel-setup/steps/*`, `src/modules/ui/channel-setup/focus/*`, completed `FCP-11` and `FCP-13-SF9` evidence, and current architecture docs around ChannelSetupScreen
17. `git status --short --branch`

Freshness gate: stop and refresh this plan if any `FCP-19` checklist text, Plex stream architecture/API ownership text, source files in scope, tests in scope, public stream export/contract text, or direct old-path import surfaces changed materially after 2026-05-05.

Planning observed branch `code-health...origin/code-health [ahead 6]` with unrelated dirty/untracked paths: `docs/archive/plans/2026-04-30-dcr-10-oversized-test-suite-structure.md`, `docs/plans/2026-04-30-dcr-exit-final-dimension-audit-plan.md`, `scorecard.png`, and `docs/agentic/evals/baseline-summaries/2026-04-28-prompt-13-feature-low-implementer-policy.md`. Preserve those paths unless a fresh source audit proves direct `FCP-19` overlap.

## Required Skills

- `architecture-boundaries`: required because this package reorganizes a module boundary, public package seam, and cross-module import paths.
- `plex-integration-boundaries`: required because this package touches Plex stream resolution, playback URL policy, universal transcode decisions, subtitle delivery/probe/debug, and token-bearing URL surfaces.
- `verification-strategy`: required to freeze behavior-preserving proof depth for Plex stream folder organization.
- `execution-plan-authoring`: required for Tier 3 source-backed FCP package planning.
- `ui-composition-patterns`: loaded only for the read-only deferred ChannelSetupScreen analysis addendum. It does not authorize UI implementation inside `FCP-19`.

Do not load `persistence-boundaries`, `debugging-remediation`, or feature/design skills unless source audit unexpectedly proves storage-backed state, a concrete regression, or product behavior is implicated. That discovery should normally stop and replan because `FCP-19` is behavior-neutral package organization only.

## Codanna Discovery

- `get_index_info`: Codanna available with 11,708 symbols across 780 files; 13,689 relationships; semantic search enabled with `JinaEmbeddingsV2BaseCode`; 38 embeddings; created and updated 49 minutes before this planning pass.
- `search_documents "FCP-19 Plex stream package organization flat folder resolver policy URL helpers subtitle probe debug pipeline"`: returned noisy unrelated docs and did not return the checklist as authoritative. Direct reads of `ARCHITECTURE_CLEANUP_CHECKLIST.md`, current architecture docs, API docs, and completed FCP guardrail plans are the deterministic membership and sequencing source.
- `search_documents "CURRENT_STATE Plex stream resolver subtitle debug probe UniversalTranscodeDecisionClient package ownership"`: returned noisy unrelated docs and did not locate the architecture truth. Direct reads of `docs/architecture/CURRENT_STATE.md`, `docs/architecture/modules.md`, and `docs/api/plex-integration.md` are the fallback.
- `semantic_search_with_context "src/modules/plex/stream PlexStreamResolver stream URL policy subtitle debug probe universal transcode decision pipeline tests"`: found weak/noisy stream context but surfaced `HlsOptions` in `types.ts` with uses in `resolveStreamPipeline`, `UniversalTranscodeDecisionClient`, and `PlexStreamResolver.getTranscodeUrl`. Direct source reads are required for the full package map.
- `find_symbol PlexStreamResolver`: class symbol_id `1755`, implements `IPlexStreamResolver`, defines 22 methods, and uses stream config/event/types.
- `analyze_impact PlexStreamResolver`: reported no impacted symbols. Treat this as Codanna insufficiency because direct `rg` proves construction and public package usage through `OrchestratorModuleFactory`, `AppOrchestrator` tests, player/debug/orchestrator types, and the public stream package seam.
- `find_symbol UniversalTranscodeDecisionClient`: class symbol_id `1510`; `analyze_impact` showed impact only through `PlexStreamResolver`.
- `find_symbol SubtitleStreamDebugProbeCoordinator`: class symbol_id `1663`; `analyze_impact` showed impact only through `PlexStreamResolver`.
- `find_symbol resolveStreamPipeline`: function symbol_id `1622`; `analyze_impact` showed impact through `PlexStreamResolver.resolveStream`, player recovery/reload paths, and priority-one playback start paths.
- `find_symbol IPlexStreamResolver`: interface symbol_id `1296`; `analyze_impact` showed broad public type impact through `AppOrchestrator`, orchestrator assembly, initialization, debug, player tests, and ChannelSetup test helpers. This freezes public contract shape and argues against export widening.
- `find_symbol StreamDecision`: interface symbol_id `1600`; `analyze_impact` showed broad impact through player descriptor/recovery, now-playing debug, playback info snapshot, priority-one assembly, and orchestrator runtime state. This freezes payload shape.
- `find_symbol buildPlexTranscodeStartUrl`: function symbol_id `1918`; `analyze_impact` showed impact through `resolveStreamPipeline`, `PlexStreamResolver.getTranscodeUrl`, `fetchUniversalTranscodeDecision`, `UniversalTranscodeDecisionClient`, and player recovery/reload paths.
- `find_symbol getDirectPlayDecision`, `selectBestMedia`, `getSubtitleDelivery`, `probeSubtitleStreamDelivery`, and `createPlexStreamSubtitleDebugLogPort`: impact stays in the stream resolver/pipeline plus player/orchestrator call paths for resolved stream decisions. These are path-move surfaces only; behavior must stay frozen.
- `find_symbol PlexStreamErrorCode`, `MIME_TYPES`: Codanna impact was weak or empty. Direct `rg` proves `MIME_TYPES` is imported by `AppOrchestrator` and `AudioTrackManager`; `PlexStreamErrorCode` is exported through the package seam and tested by stream error taxonomy.
- ChannelSetup addendum Codanna: `find_symbol ChannelSetupScreen` found class symbol_id `7015`; `analyze_impact` showed impact through `AppLazyScreenRegistry`, `App`, and screen visibility coordination. `find_symbol StrategyStepController` found class symbol_id `6843`; `analyze_impact` returned no impact, but direct `rg` proves construction by `ChannelSetupScreen` and direct step tests. This addendum uses direct reads for source truth.
- `rg` / direct source reads covered all production files under `src/modules/plex/stream/*.ts`, all tests under `src/modules/plex/stream/__tests__/*.ts`, public package exports in `src/modules/plex/stream/index.ts`, external direct stream leaf imports, API-doc path tests, and the ChannelSetup files needed for the deferred addendum.

Codanna is useful for owner and public-contract impact, but insufficient for file/path import audits and several class reverse-usage paths. `rg`, `find`, `wc -l`, and direct reads are the fallback evidence for old flat paths, replacement path surfaces, affected tests, and deferred ChannelSetup source truth.

## Impact Snapshot

Current-source proof at plan time:

- `src/modules/plex/stream/` contains 20 flat production TypeScript files plus `__tests__/`.
- The flat package currently mixes:
  - public resolver and package seam: `PlexStreamResolver.ts`, `index.ts`;
  - public contracts and payload shapes: `interfaces.ts`, `types.ts`;
  - stream pipeline: `resolveStreamPipeline.ts`;
  - URL/session helpers: `plexStreamUrlPolicy.ts`, `plexSessionId.ts`;
  - playback/media/subtitle/HDR policy: `playbackCompatibilityPolicy.ts`, `mediaSelectionPolicy.ts`, `subtitleDeliveryPolicy.ts`, `plexSubtitleFallbackPolicy.ts`, `dvHdr10Fallback.ts`, `hdr.ts`, `constants.ts`, `streamMimeType.ts`;
  - diagnostics and debug probe owners: `PlexStreamSubtitleDebugLogPort.ts`, `SubtitleStreamDebugProbeCoordinator.ts`, `SubtitleStreamProbe.ts`, `SubtitleStreamProbeSupport.ts`, `UniversalTranscodeDecisionClient.ts`.
- `PlexStreamResolver.ts` is 573 lines and composes the resolver, stream pipeline, URL policy, debug probe coordinator, universal transcode decision client, policy readers, auth headers, selected connection, and token-bearing URL helpers. The package organization work must not alter that composition behavior.
- `resolveStreamPipeline.ts` owns media selection, direct-play/transcode branch shaping, subtitle burn-in request shaping, HDR10/Dolby Vision fallback decision inputs, and `StreamDecision` construction. It is not a package-root contract and may move under a focused `pipeline/` owner.
- `plexStreamUrlPolicy.ts` owns transcode URL construction, client capability serialization, session query params, profile name defaults, selected-connection location classification, and X-Plex query/header propagation. Moving it must preserve token placement/redaction behavior and no URL parameter changes are allowed.
- Subtitle debug/probe files already own redaction-sensitive logs and token-bearing probe context. `SubtitleStreamProbeSupport.ts` uses `redactUrlForLog`, `applyXPlexTokenQueryParam`, and `tryBuildPlexServerUrlFromKey`; moving it must not change auth mode, sample reads, redacted log fields, fetch options, or probe scheduling.
- `UniversalTranscodeDecisionClient.ts` owns best-effort decision URL derivation and XML/attribute parsing for debug diagnostics. Moving it must not change fetch timeout, auth failure handling, non-ok handling, or parser fallback behavior.
- Existing focused tests cover resolver behavior, subtitle errors, URL policy, subtitle fallback/delivery policies, HDR/DV fallback, media selection, playback compatibility, session IDs, stream pipeline, fetch timeout, subtitle probes/support, and stream error taxonomy.
- External direct old flat-path imports currently exist in:
  - `src/core/orchestrator/AppOrchestrator.ts` for `MIME_TYPES`;
  - `src/core/orchestrator/assembly/OrchestratorModuleFactory.ts` for `createPlexStreamSubtitleDebugLogPort`;
  - `src/modules/player/AudioTrackManager.ts` for `SUPPORTED_AUDIO_CODECS`;
  - `src/modules/player/subtitleFallbackPipeline.ts` for `plexSubtitleFallbackPolicy`;
  - `src/modules/ui/now-playing-info/NowPlayingInfoCoordinator.ts`, `src/modules/ui/epg/view/EPGInfoPanelDetailsLoader.ts`, and `src/modules/scheduler/channel-manager/ContentItemMapper.ts` for `hdr` helpers;
  - `src/__tests__/tools/plexIntegrationDocs.test.ts` for hardcoded API-doc source paths to `interfaces.ts` and `types.ts`.
- Many external callers import public types/values from the existing package seam `src/modules/plex/stream/index.ts`. That seam may be updated to point at moved owners, but it must export the same public names only.
- Source audit found no requirement for playback behavior changes, diagnostic behavior changes, auth/token/redaction changes, public export widening, compatibility shims, root/subfolder barrels, Plex auth/discovery/library changes, player behavior changes, Orchestrator logic changes, or UI changes. If implementation discovers one, the current plan is invalid.

Approved replacement organization for `FCP-19-S1`:

- root: keep only the existing `index.ts` public package seam; update export paths only, with the same exported names.
- `resolver/`: `PlexStreamResolver.ts`, `plexSessionId.ts`
- `contracts/`: `interfaces.ts`, `types.ts`
- `pipeline/`: `resolveStreamPipeline.ts`
- `url/`: `plexStreamUrlPolicy.ts`
- `policy/`: `constants.ts`, `playbackCompatibilityPolicy.ts`, `mediaSelectionPolicy.ts`, `subtitleDeliveryPolicy.ts`, `plexSubtitleFallbackPolicy.ts`, `dvHdr10Fallback.ts`, `hdr.ts`, `streamMimeType.ts`
- `diagnostics/`: `PlexStreamSubtitleDebugLogPort.ts`, `SubtitleStreamDebugProbeCoordinator.ts`, `SubtitleStreamProbe.ts`, `SubtitleStreamProbeSupport.ts`, `UniversalTranscodeDecisionClient.ts`
- `__tests__/`: may remain in the existing test folder with imports updated to moved owner paths. Move test files only if the worker proves it reduces path ambiguity without changing test names or verification surface; otherwise avoid test-file churn.

Source finding disposition planned:

- `FCP-19-SF1` maps exactly once to `FCP-19-S1`.
- The checklist candidate prompts `FCP-19-S1` Plex stream folder organization and `FCP-19-S2` import/path reconciliation are not approved as separate coverage owners. They are one coherent execution unit because folder moves and import reconciliation share the same old flat-path surface, same Plex stream package owner, same files, same public seam, and same verification envelope.

## Package Decomposition

- `package_id`: `FCP-19`
- `checklist_token`: `FCP-19`
- `source_finding_ids`: `FCP-19-SF1`

`slice_table`:

| slice_id | goal | areas/files | source_finding_ids | verification | dependencies | stop_condition | handoff_condition | serial_only | parallel_justification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FCP-19-S1` | Reorganize the Plex stream package around existing current owners and reconcile imports without changing playback, diagnostics, auth/token/redaction, or public exports. | `src/modules/plex/stream/*.ts`; approved new subfolders under `src/modules/plex/stream/`; `src/modules/plex/stream/__tests__/*.ts`; external direct stream leaf import paths discovered by source audit; `docs/api/plex-integration.md`, `src/__tests__/tools/plexIntegrationDocs.test.ts`, `docs/architecture/CURRENT_STATE.md`, and `docs/architecture/modules.md` for path-truth updates if moved named paths stale tracked docs/tests. | `FCP-19-SF1` | Pre/post package source audits for old flat paths, replacement folder map, public export stability, no compatibility shims/barrels, no URL/token/redaction changes, and API/architecture path truth for moved named paths; targeted Plex stream tests; `npm run typecheck`; `git diff --check`; `npm run verify`; `npm run plans:check`; `npm run verify:docs` for the active plan and again after checklist/API/architecture/plan doc updates. | None. This is the ready-now execution unit. | Stop if foldering needs old-path shim files, subfolder barrels, root/package barrel changes beyond updating existing `index.ts`, public export widening, playback behavior changes, diagnostic behavior changes, auth/token/redaction changes, URL policy changes, cycles, Plex auth/discovery/library/player/Orchestrator/UI behavior changes, or a different owner seam. | `FCP-19-SF1` no longer describes current Plex stream package organization; the existing public package seam exports the same public names; old flat production/test direct imports are gone or source-justified; named API/architecture paths are current; targeted tests and closeout gates pass; package closeout can update the checklist. | true | Single source finding with one owner and one old-path import surface. Parallel execution would split folder moves from import reconciliation and risk duplicate or missing coverage for the same source finding. |

`coverage_check`:

- `FCP-19-SF1` maps only to `FCP-19-S1`.
- No `source_finding_id` is deferred, split, or mapped to both the checklist candidate `FCP-19-S1` and `FCP-19-S2`.
- `FCP-19-S1` has one final owner: Plex stream package organization owner.
- Replan is required before admitting any new source finding, approving a separate import-only execution unit, or assigning a separate final owner to old-path import reconciliation.

`ready_now_execution_unit`: `FCP-19-S1`

`ready_now_slice`: `FCP-19-S1`

`recommended_slice_order`:

1. `FCP-19-S1`

`parallel_execution_policy`: no parallel implementation. The approved package has one source finding, one slice, one execution unit, and one final coverage owner.

## Files In Scope

- `src/modules/plex/stream/index.ts`
- `src/modules/plex/stream/PlexStreamResolver.ts`
- `src/modules/plex/stream/PlexStreamSubtitleDebugLogPort.ts`
- `src/modules/plex/stream/SubtitleStreamDebugProbeCoordinator.ts`
- `src/modules/plex/stream/SubtitleStreamProbe.ts`
- `src/modules/plex/stream/SubtitleStreamProbeSupport.ts`
- `src/modules/plex/stream/UniversalTranscodeDecisionClient.ts`
- `src/modules/plex/stream/constants.ts`
- `src/modules/plex/stream/dvHdr10Fallback.ts`
- `src/modules/plex/stream/hdr.ts`
- `src/modules/plex/stream/interfaces.ts`
- `src/modules/plex/stream/mediaSelectionPolicy.ts`
- `src/modules/plex/stream/playbackCompatibilityPolicy.ts`
- `src/modules/plex/stream/plexSessionId.ts`
- `src/modules/plex/stream/plexStreamUrlPolicy.ts`
- `src/modules/plex/stream/plexSubtitleFallbackPolicy.ts`
- `src/modules/plex/stream/resolveStreamPipeline.ts`
- `src/modules/plex/stream/streamMimeType.ts`
- `src/modules/plex/stream/subtitleDeliveryPolicy.ts`
- `src/modules/plex/stream/types.ts`
- New focused subfolders under `src/modules/plex/stream/` only for approved behavior-neutral organization: `resolver/`, `contracts/`, `pipeline/`, `url/`, `policy/`, and `diagnostics/`
- `src/modules/plex/stream/__tests__/PlexStreamResolver.test.ts`
- `src/modules/plex/stream/__tests__/PlexStreamResolver.subtitle-errors.test.ts`
- `src/modules/plex/stream/__tests__/SubtitleStreamDebugProbeCoordinator.test.ts`
- `src/modules/plex/stream/__tests__/SubtitleStreamProbe.test.ts`
- `src/modules/plex/stream/__tests__/SubtitleStreamProbeSupport.test.ts`
- `src/modules/plex/stream/__tests__/dvHdr10Fallback.test.ts`
- `src/modules/plex/stream/__tests__/error-taxonomy.test.ts`
- `src/modules/plex/stream/__tests__/fetchWithTimeout.test.ts`
- `src/modules/plex/stream/__tests__/hdr.test.ts`
- `src/modules/plex/stream/__tests__/mediaSelectionPolicy.test.ts`
- `src/modules/plex/stream/__tests__/playbackCompatibilityPolicy.test.ts`
- `src/modules/plex/stream/__tests__/plexSessionId.test.ts`
- `src/modules/plex/stream/__tests__/plexStreamUrlPolicy.test.ts`
- `src/modules/plex/stream/__tests__/plexSubtitleFallbackPolicy.test.ts`
- `src/modules/plex/stream/__tests__/resolveStreamPipeline.test.ts`
- `src/modules/plex/stream/__tests__/subtitleDeliveryPolicy.test.ts`
- `src/modules/plex/stream/__tests__/testUtils.ts`
- `src/core/orchestrator/AppOrchestrator.ts` only for import-path reconciliation of `MIME_TYPES`
- `src/core/orchestrator/assembly/OrchestratorModuleFactory.ts` only for import-path reconciliation of `createPlexStreamSubtitleDebugLogPort`
- `src/modules/player/AudioTrackManager.ts` only for import-path reconciliation of `SUPPORTED_AUDIO_CODECS`
- `src/modules/player/subtitleFallbackPipeline.ts` only for import-path reconciliation of `plexSubtitleFallbackPolicy`
- `src/modules/ui/now-playing-info/NowPlayingInfoCoordinator.ts`, `src/modules/ui/epg/view/EPGInfoPanelDetailsLoader.ts`, and `src/modules/scheduler/channel-manager/ContentItemMapper.ts` only for import-path reconciliation of `hdr` helpers
- `src/__tests__/tools/plexIntegrationDocs.test.ts` and `docs/api/plex-integration.md` if moved contract paths stale the documented API source path proof
- `docs/architecture/CURRENT_STATE.md` and `docs/architecture/modules.md` for required path-truth updates if approved folder moves relocate named Plex stream paths; ownership wording changes only if implementation source audit proves ownership truth changed
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` only during package closeout after clean review and verification

## Files Out Of Scope

- Any runtime/source file not named in `## Files In Scope`, except narrow import-path updates discovered by the required old flat-path audit.
- Playback behavior changes, stream decision payload changes, direct-play/transcode policy changes, universal transcode decision behavior changes, subtitle delivery behavior changes, subtitle debug probe behavior changes, diagnostic/logging behavior changes, auth/token handling changes, token redaction changes, public type shape changes, and public export widening.
- Old-path compatibility re-export files such as `src/modules/plex/stream/PlexStreamResolver.ts` left behind after moving the owner, subfolder `index.ts` barrels, new root/package barrels, temporary migration shims, and fallback imports.
- Plex auth/discovery/library behavior, player recovery/reload behavior, scheduler behavior, navigation behavior, UI visual/focus composition, app-shell/deferred-screen behavior, Orchestrator runtime behavior, persistence/storage behavior, CSS, Windows platform work, and feature/design work.
- ChannelSetupScreen production/test changes. The deferred addendum below is read-only and must not be treated as FCP-19 implementation scope.
- Completed `FCP-7` through `FCP-18` implementation work except as read-only guardrails.
- Pre-existing unrelated dirty/untracked workspace files listed in `## Required Reading`.

## Planner Self-Check

1. No unresolved package-level owner seam remains: `FCP-19-SF1` maps exactly once to `FCP-19-S1`.
2. Adjacent contract/type changes are explicit: public `IPlexStreamResolver`, `PlexStreamResolverConfig`, `StreamResolverError`, `StreamRequest`, `StreamDecision`, `HlsOptions`, `PlexStreamMediaItem`, `PlexStream`, `PlexStreamErrorCode`, `mapPlexStreamErrorCodeToAppErrorCode`, and `getMimeType` exports are frozen.
3. Files out of scope are not hidden implementation dependencies. External files are in scope only for import-path reconciliation discovered by the old-path audit, not behavior changes.
4. Codanna evidence and insufficiencies are recorded, including weak document search, weak class-level impact for `PlexStreamResolver`, weak constants/error-code impact, and deterministic `rg`/direct-read fallback for import paths.
5. The plan uses repo-preferred owners: Plex stream files remain under `src/modules/plex/stream/`, grouped by current owner rather than moving policy into auth, discovery, library, player, scheduler, UI, app-shell, Orchestrator, or shared utility modules.
6. A fresh cleanup-loop session can start `ready_now_execution_unit` `FCP-19-S1` without deciding package membership, final owners, parallelism, or verification depth.
7. The plan is execution-grade at seam/scope/verification level and deliberately leaves local relative import mechanics and exact move commands to the cleanup worker as long as the approved folder map and proof surface hold.

## Architecture Seam Decision Gate

Approved seam:

- Execute one slice, `FCP-19-S1`, as behavior-neutral package organization plus import reconciliation.
- Use the replacement organization named in `## Impact Snapshot` unless fresh source audit proves a narrower grouping is clearly safer. Any alternate grouping must still keep the same owner classes/functions together, remain inside `src/modules/plex/stream/`, avoid behavior changes, avoid compatibility shims/barrels, preserve public exports, and preserve the same verification envelope.
- Keep the existing `src/modules/plex/stream/index.ts` as the public package export seam. Update its export paths to moved owners only. Do not add public exports, delete existing public exports, or add new root/subfolder barrels.
- Move old flat production files to approved subfolders rather than leaving old-path re-export files behind. All internal and external direct imports of old flat stream leaf paths must be updated to the new owner path or to the existing public package seam when that seam already exports the needed public type/value.
- Update API/architecture path truth in `docs/api/plex-integration.md`, `docs/architecture/CURRENT_STATE.md`, `docs/architecture/modules.md`, and `src/__tests__/tools/plexIntegrationDocs.test.ts` in the same closeout path if approved moves relocate paths those docs/tests name. This is required even when semantic ownership is unchanged.
- Keep `PlexStreamResolver` behavior unchanged while imports are updated to moved resolver/pipeline/url/policy/diagnostics/contract owners.
- Keep URL policy and token-bearing code unchanged. Moving `plexStreamUrlPolicy`, `SubtitleStreamProbe`, or `SubtitleStreamProbeSupport` must not alter `X-Plex-Token` query/header handling, redacted URL fields, fetch options, timeouts, auth mode, or logged context shape.
- Keep tests behavior-focused. Update imports to moved owner paths; do not add private accessors, casts into private fields, test-only exports, or new snapshots solely for foldering.

Stop and replan if:

- foldering requires any old flat-path compatibility shim file, new subfolder barrel, new root/package barrel, fallback import path, or public export widening;
- direct import updates create circular dependencies, including type-only cycles;
- `PlexStreamResolver`, URL policy, stream pipeline, playback compatibility policy, media selection, subtitle delivery, subtitle fallback, HDR/DV fallback, universal transcode decision, subtitle debug probe/support, session id generation, MIME type behavior, or error taxonomy requires behavior changes to pass tests;
- auth/token handling, redaction, token-bearing URL query/header shape, diagnostic log payloads, or debug behavior would change;
- source audit proves the existing flat package is source-justified and moving files would be churn;
- Plex auth/discovery/library, player, scheduler, UI/focus-visible behavior, app-shell, Orchestrator runtime, persistence/storage, or Windows behavior becomes necessary;
- tests require private probing or new test-only APIs instead of existing public/package-local seams;
- newly discovered residue changes package membership, execution-unit membership, final-owner accounting, owner seam, or verification surface.

Absorb-now rule: absorb only newly discovered path/import residue that stays within `FCP-19-S1`'s approved execution-unit goal, owner, seam/files, verification envelope, and final-owner accounting. Record absorbed residue in implementation/review output. Replan for new owners, wider verification, changed source-finding coverage, or changed execution-unit membership.

## Verification Commands

- Verification classification: `broader integration/manual proof required`

Primary proof mode: `refactor-invariance`, supported by package-local source audits, old/replacement path audits, targeted Plex stream tests, `typecheck`, docs gates, and final `npm run verify`. New automated tests are not expected because existing Plex stream tests already cover the behavior seams; add tests only if source audit proves an affected behavior seam lacks coverage after the move.

Plan validation:

- Run: `npm run plans:check`
  - Expected: this active tracked plan satisfies Universal Plan Core and FCP cleanup-overlay structure, including exactly one `FCP-19-SF1` coverage mapping.
- Run after active plan creation/update: `npm run verify:docs`
  - Expected: docs/control-plane verification passes for the active plan. Run again during package closeout if checklist/API/current-state/modules/plan docs are updated.

Ready-now `FCP-19-S1` source-audit proof:

- Pre-edit source audit over `src/modules/plex/stream/*.ts`, `src/modules/plex/stream/__tests__/*.ts`, external direct stream leaf imports, public package seam exports, API-doc source-path tests, and Plex stream architecture/API docs.
  - Expected: implementation records the current flat files, old flat direct import paths, existing public package seam exports, token/redaction-sensitive files, and behavior owners before moving files.
- Pre-edit replacement-path audit against the approved folder map.
  - Expected: every current flat file and external direct old leaf import has exactly one approved replacement owner path, with no planned compatibility shim, new public export, subfolder barrel, or root/package barrel.
- Post-edit source audit over `src/modules/plex/stream/`, affected external import files, tests, API docs, and architecture docs.
  - Expected: `FCP-19-SF1` no longer describes current source; production files are grouped by approved owners; no old-path shim files, subfolder barrels, public export widening, URL/token/redaction changes, diagnostic changes, or playback behavior changes were introduced.

Old-path static audits:

- Run before and after edits:
  - `find src/modules/plex/stream -maxdepth 3 -type f | sort`
  - Expected before: flat production files plus `__tests__`. Expected after: production files under approved subfolders, root `index.ts`, and `__tests__` unless test-file moves are source-justified.
- Run before and after edits:
  - `rg -n "modules/plex/stream/(PlexStreamResolver|PlexStreamSubtitleDebugLogPort|SubtitleStreamDebugProbeCoordinator|SubtitleStreamProbe|SubtitleStreamProbeSupport|UniversalTranscodeDecisionClient|constants|dvHdr10Fallback|hdr|interfaces|mediaSelectionPolicy|playbackCompatibilityPolicy|plexSessionId|plexStreamUrlPolicy|plexSubtitleFallbackPolicy|resolveStreamPipeline|streamMimeType|subtitleDeliveryPolicy|types)(['\"?#]|$)" src --glob "*.ts"`
  - Expected before: external direct imports or source-path string references to old flat stream leaf paths are recorded, including API-doc source-path tests if present. Expected after: no external production or test file points at old flat stream leaf paths. Any hit must be a source-justified false positive or an intentionally retained source-path assertion that was reviewed against API/architecture docs.
- Run before and after edits:
  - `rg -n "(from ['\"]\\x2e{1,2}\\x2f(PlexStreamResolver|PlexStreamSubtitleDebugLogPort|SubtitleStreamDebugProbeCoordinator|SubtitleStreamProbe|SubtitleStreamProbeSupport|UniversalTranscodeDecisionClient|constants|dvHdr10Fallback|hdr|interfaces|mediaSelectionPolicy|playbackCompatibilityPolicy|plexSessionId|plexStreamUrlPolicy|plexSubtitleFallbackPolicy|resolveStreamPipeline|streamMimeType|subtitleDeliveryPolicy|types)['\"]|require\\(['\"]\\x2e{1,2}\\x2f(PlexStreamResolver|PlexStreamSubtitleDebugLogPort|SubtitleStreamDebugProbeCoordinator|SubtitleStreamProbe|SubtitleStreamProbeSupport|UniversalTranscodeDecisionClient|constants|dvHdr10Fallback|hdr|interfaces|mediaSelectionPolicy|playbackCompatibilityPolicy|plexSessionId|plexStreamUrlPolicy|plexSubtitleFallbackPolicy|resolveStreamPipeline|streamMimeType|subtitleDeliveryPolicy|types)['\"]\\))" src/modules/plex/stream --glob "*.ts"`
  - Expected before: stream-package-local relative imports/exports to old flat leaf files are recorded, including `./<leaf>` production imports/exports and `../<leaf>` test imports. Expected after: no stream production or test file imports old flat leaf files by `./<leaf>` or `../<leaf>`; imports must point at approved owner subfolders or the unchanged public package seam where appropriate.
- Run after edits:
  - `rg -n "export .*from './(PlexStreamResolver|PlexStreamSubtitleDebugLogPort|SubtitleStreamDebugProbeCoordinator|SubtitleStreamProbe|SubtitleStreamProbeSupport|UniversalTranscodeDecisionClient|constants|dvHdr10Fallback|hdr|interfaces|mediaSelectionPolicy|playbackCompatibilityPolicy|plexSessionId|plexStreamUrlPolicy|plexSubtitleFallbackPolicy|resolveStreamPipeline|streamMimeType|subtitleDeliveryPolicy|types)" src/modules/plex/stream/index.ts src/modules/plex/stream --glob "*.ts"`
  - Expected: `index.ts` exports point at approved subfolder owners; no old flat re-export shim files remain.

Replacement-path and public seam audits:

- Run after edits:
  - `rg -n "from ['\"][^'\"]*modules/plex/stream['\"]|from ['\"][^'\"]*\\.\\.?/[^'\"]*plex/stream['\"]|require\\(['\"][^'\"]*modules/plex/stream['\"]\\)" src --glob "*.ts"`
  - Expected: public callers that need exported stream contracts still import through the existing package seam; internal direct imports use approved owner subfolder paths.
- Run after edits:
  - `rg -n "X-Plex-Token|redactUrlForLog|redactSensitiveTokens|applyXPlexTokenQueryParam|applyXPlexQueryParamsFromHeaders|SubtitleStreamProbe|buildPlexTranscodeStartUrl" src/modules/plex/stream src/core/orchestrator/assembly/OrchestratorModuleFactory.ts src/core/orchestrator/AppOrchestrator.ts src/modules/player src/modules/ui src/modules/scheduler --glob "*.ts"`
  - Expected: token-bearing URL/query/header handling and redaction-sensitive helpers are only path-moved; no new token logging, unredacted URL logging, auth branch, or diagnostics branch is introduced.
- Run after edits:
  - inspect `src/modules/plex/stream/index.ts`
  - Expected: same public exported names as before: `PlexStreamResolver`, `PlexStreamErrorCode`, `mapPlexStreamErrorCodeToAppErrorCode`, `getMimeType`, `IPlexStreamResolver`, `PlexStreamResolverConfig`, `StreamResolverError`, `StreamRequest`, `StreamDecision`, `HlsOptions`, `PlexStreamMediaItem`, and `PlexStream`.

Targeted tests:

- Run:
  - `npm test -- --runInBand src/modules/plex/stream/__tests__/PlexStreamResolver.test.ts src/modules/plex/stream/__tests__/PlexStreamResolver.subtitle-errors.test.ts src/modules/plex/stream/__tests__/plexStreamUrlPolicy.test.ts src/modules/plex/stream/__tests__/resolveStreamPipeline.test.ts src/modules/plex/stream/__tests__/subtitleDeliveryPolicy.test.ts src/modules/plex/stream/__tests__/plexSubtitleFallbackPolicy.test.ts src/modules/plex/stream/__tests__/SubtitleStreamDebugProbeCoordinator.test.ts src/modules/plex/stream/__tests__/SubtitleStreamProbe.test.ts src/modules/plex/stream/__tests__/SubtitleStreamProbeSupport.test.ts`
  - Expected: resolver, URL policy, stream pipeline, subtitle delivery/fallback, subtitle debug coordinator/probe/support, token/redaction-sensitive probe context, and subtitle error behavior remain unchanged after path moves.
- Run:
  - `npm test -- --runInBand src/modules/plex/stream/__tests__/playbackCompatibilityPolicy.test.ts src/modules/plex/stream/__tests__/mediaSelectionPolicy.test.ts src/modules/plex/stream/__tests__/dvHdr10Fallback.test.ts src/modules/plex/stream/__tests__/hdr.test.ts src/modules/plex/stream/__tests__/plexSessionId.test.ts src/modules/plex/stream/__tests__/error-taxonomy.test.ts src/modules/plex/stream/__tests__/fetchWithTimeout.test.ts`
  - Expected: playback compatibility, media selection, HDR/DV fallback, session id, error taxonomy, and shared fetch timeout tests remain valid. There is no dedicated `streamMimeType.test.ts` in current source; rely on `PlexStreamResolver`/package tests plus typecheck for `getMimeType` path proof unless implementation adds a focused test for a newly exposed gap.
- Run affected cross-module tests if import moves touch their files:
  - `npm test -- --runInBand src/__tests__/Orchestrator.test.ts src/__tests__/tools/plexIntegrationDocs.test.ts`
  - Expected: Orchestrator stream resolver construction mocks and API-doc source-path contract tests remain valid after path updates. If these are too broad for a targeted pass, run the exact affected test file path/pattern and record why.

Static and package gates:

- Run: `npm run typecheck`
  - Expected: no TypeScript errors after file moves and import-path updates.
- Run: `git diff --check`
  - Expected: no whitespace errors before commits and package closeout.
- Run: `npm run verify`
  - Expected: full repo verification passes before marking `FCP-19` complete because this is Plex stream package work.
- Run: `npm run verify:docs`
  - Expected: required again after closeout updates `ARCHITECTURE_CLEANUP_CHECKLIST.md`, API docs, architecture docs, or this active plan. API/architecture docs must be updated when approved file moves stale named Plex stream paths.

Closeout source review:

- Source-finding proof matrix for `FCP-19-SF1`.
  - Expected: the original source finding sentence is answered as resolved, source-disproved, deferred, or reclassified with one final owner. No detector/imported ids are used.
- Public seam review.
  - Expected: `src/modules/plex/stream/index.ts` exports the same public names as before, from moved owner files, with no new compatibility path.
- API/architecture path-truth review.
  - Expected: `docs/api/plex-integration.md`, `docs/architecture/CURRENT_STATE.md`, and `docs/architecture/modules.md` no longer name old Plex stream paths after approved moves; ownership text remains semantically accurate.
- Behavior review.
  - Expected: implementation diff is import/file organization only; any runtime logic, URL parameter, token/redaction, or diagnostic change must have triggered stop/replan before closeout.

## Priority-Exit Readiness

`FCP-19` is the current FCP package gate before `FCP-20`. Do not start, plan, or mark progress on `FCP-20`, `FCP-EXIT`, Windows port work, or broader post-FCP cleanup until `FCP-19` is completed with source-backed closeout evidence, clean review, and required checklist/API/architecture path-truth updates.

FCP source finding disposition intent:

- `FCP-19-SF1`: planned disposition is `resolved` by `FCP-19-S1` when current source shows the Plex stream package is grouped around current owners, old flat direct imports are reconciled, existing public exports remain stable, API/architecture path truth is current, and no playback, diagnostic, auth/token/redaction, URL-policy, subtitle, or public-contract behavior changes landed.
- Detector/imported/package-map ids: none. FCP-19 uses only `source_finding_id` coverage; do not add detector, imported review, Desloppify, or package-map ids to proof or closeout.
- Deferred or split items: none planned for `FCP-19-SF1`. If source audit discovers a real residual, stop and replan unless it stays within `FCP-19-S1` absorption rules. Any accepted residual must name one final owner, the reason it remains open, and a concrete revisit trigger.
- Security triage: no open P0 security findings are admitted for this package. If the package audit discovers a P0 security finding, stop for replan and record the exact resolved or deferred P0 finding, one final owner, and revisit trigger before closeout.
- Deferred ChannelSetupScreen residual: remains outside `FCP-19` source finding coverage and cannot be used to delay or satisfy `FCP-19-SF1`. Its owner/revisit handling is recorded only in the read-only addendum below.

Required closeout evidence before `FCP-20`:

- source proof matrix for `FCP-19-SF1`, with disposition, live residual status, final owner, and revisit trigger if any residual remains;
- old-path and replacement-path audits proving no old flat-path shim, subfolder barrel, public export widening, stale API/architecture path, or stale external direct stream leaf import remains;
- token/redaction-sensitive audit proving `X-Plex-Token`, redacted URL logging, auth header/query propagation, subtitle probe auth mode, and universal transcode decision diagnostics were only path-moved;
- targeted Plex stream tests, affected cross-module/API-doc tests, `npm run typecheck`, `git diff --check`, `npm run verify`, `npm run plans:check`, and `npm run verify:docs`;
- clean plan and implementation closeout review confirming FCP-19 source finding disposition, verification evidence, public export stability, token/redaction invariants, path-truth docs, and owned follow-ups;
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` `FCP-19` mini-record update with status, plan path, latest verification evidence, proof matrix, follow-ups, and handoff;
- `docs/api/plex-integration.md`, `docs/architecture/CURRENT_STATE.md`, and `docs/architecture/modules.md` updates if approved file moves stale named Plex stream paths or ownership text.

## Rollback Notes

Roll back by the single execution unit, `FCP-19-S1`.

If parity fails, restore the previous flat Plex stream file layout and imports, then keep any valid import-audit or test evidence that exposed the issue. Do not leave old-path shim files or partial moved owners in place as a temporary compatibility layer.

If a proposed subfolder grouping proves confusing or creates cycles, revert only the package-organization diff and replan a narrower folder map. Do not use fallback barrels or public export widening to paper over unresolved ownership.

If URL/token/redaction or diagnostic parity is in doubt, revert the path move for the affected owner and replan around the redaction-sensitive seam before continuing.

If docs/checklist closeout fails after source/test changes pass, leave reviewed source/test changes intact and fix tracked docs in a separate controller-owned closeout pass.

## Commit Checkpoints

- Planning checkpoint: commit only this plan artifact if the controller wants a tracked-doc checkpoint; do not bundle unrelated dirty/untracked files.
- Implementation checkpoint: after `FCP-19-S1` implementation, targeted tests, typecheck, diff check, and implementation review pass, create one focused non-interactive implementation commit for production/test import/path changes. Exclude active tracked plan docs unless the controller explicitly commits plan progress separately.
- Closeout checkpoint: after final verification and clean review, update `ARCHITECTURE_CLEANUP_CHECKLIST.md` and any required API/architecture docs in a separate tracked-doc closeout commit if the controller chooses to commit closeout docs.

## Deferred ChannelSetupScreen Candidate Analysis

This section is a read-only addendum for `Deferred Pre-Port Candidate: ChannelSetupScreen Distinct Residual`. It is outside `FCP-19` implementation coverage, outside `source_finding_ids`, outside `coverage_check`, and outside `ready_now_execution_unit`. It must not authorize ChannelSetup implementation inside `FCP-19`.

Current source and completed evidence:

- `FCP-11-SF2` is completed. Checklist proof records `ChannelSetupScreen` as the screen shell/step router; dropdown lifecycle lives in `ChannelSetupDropdownController`; build review/progress/success presentation lives in `ChannelSetupBuildStepPresenter`; session/runtime, focus, strategy interactions, and step rendering remain in package-local owners.
- `FCP-13-SF9` is completed. Checklist proof records `StrategyStepController` uses a local helper for repeated adjustable-control construction while preserving preview, validation, focus registration, category state, and step lifecycle behavior.
- Current source agrees with that closure. `ChannelSetupScreen.ts` is 573 lines and delegates session/runtime to `ChannelSetupSessionController` / `ChannelSetupSessionRuntime`, focus to `ChannelSetupFocusCoordinator`, dropdown lifecycle to `ChannelSetupDropdownController`, build presentation to `ChannelSetupBuildStepPresenter`, library rendering to `LibraryStepController`, strategy rendering to `StrategyStepController`, and strategy interactions to `StrategyStepInteractionController`.
- Current source still has a possible distinct residual: `ChannelSetupScreen._createStrategyInteractionAdapters()`, `_renderStrategyStep()`, and `_openStep2Dropdown()` form a screen-local strategy-step bridge that fans session, focus, dropdown, preview scheduling, priority-row visual state, and strategy interaction callbacks into `StrategyStepInteractionController` and `StrategyStepController`.
- That residual is not the same as completed `FCP-11-SF2` owner closure or completed `FCP-13-SF9` structural repetition. It is narrower: a strategy-step adapter/focus/dropdown bridge inside the screen shell.

Recommendation: keep the item deferred for now. Do not activate it before `FCP-20` unless a fresh source-backed brief proves the strategy-step bridge is causing real maintenance risk or blocking a planned ChannelSetup change.

Pros of addressing later:

- Could reduce `ChannelSetupScreen`'s remaining adapter fan-out and make the screen shell/step-router role cleaner.
- Could give strategy-step focus/dropdown/preview wiring one named package-local owner, which may help future ChannelSetup feature work.
- Could make tests around strategy-step D-pad/dropdown/preview behavior more targeted if the existing screen tests become too broad for future changes.

Cons of addressing now:

- It risks reopening completed `FCP-11` ChannelSetup owner closure without a new source finding in the active package.
- The remaining bridge is composition glue at the screen boundary, not clearly a behavior owner that belongs elsewhere.
- Extracting it prematurely could create a second screen-like owner with hidden lifecycle/focus responsibilities, the exact UI-composition anti-pattern the earlier cleanup avoided.
- It would require UI/focus verification and likely `npm run verify`, which is outside the Plex stream package verification envelope.

If activated later, use this analysis-level brief only:

- Distinct residual: ChannelSetup strategy-step adapter/focus/dropdown bridge concentrated in `ChannelSetupScreen._createStrategyInteractionAdapters()`, `_renderStrategyStep()`, and `_openStep2Dropdown()`.
- Final owner: channel setup UI owner.
- Files in: `src/modules/ui/channel-setup/ChannelSetupScreen.ts`, `src/modules/ui/channel-setup/steps/StrategyStepInteractionController.ts`, `src/modules/ui/channel-setup/steps/types.ts`, relevant channel setup UI tests/helpers, and a new package-local bridge only if source audit proves it will own adapter composition without DOM rendering or lifecycle ownership.
- Files out: core channel setup workflow/planning/build owners, Plex stream package, scheduler persistence/schema, navigation public API, CSS/visual redesign, ChannelSetupScreen broad rewrite, and completed FCP-11/FCP-13 implementation work.
- Behavior invariants: show/hide lifecycle, `visibilityToken` stale-load guard, key listener registration/removal, D-pad focus registration/restoration, dropdown dismissal/deferred render behavior, priority-row grabbed visuals, preview scheduling, strategy category switching, adjustable controls, library selection, build review/progress/success, ARIA/status semantics, and setup persistence semantics must remain unchanged.
- Verification proof: targeted `ChannelSetupScreen`, `ChannelSetupDropdownController`, `ChannelSetupFocusCoordinator`, `StrategyStepController`, `StrategyStepInteractionController`, `BuildReviewStepController`, `BuildProgressStepController`, and `ChannelSetupBuildStepPresenter` tests as touched; focus/lifecycle source audit; `npm run typecheck`; `git diff --check`; `npm run verify`; `npm run verify:docs` if architecture/checklist docs change.
- Stop/replan triggers: extraction changes focus behavior, dropdown behavior, preview timing, build/session lifecycle, persistence semantics, screen visibility, public screen ports, or creates a second screen/controller with hidden DOM or lifecycle ownership.

Revisit trigger if kept deferred: open a new source-backed brief only when current source proves the strategy-step bridge remains a distinct live residual after completed `FCP-11` and `FCP-13-SF9`, or when a planned ChannelSetup change must touch that bridge and would otherwise expand `ChannelSetupScreen` responsibility.
