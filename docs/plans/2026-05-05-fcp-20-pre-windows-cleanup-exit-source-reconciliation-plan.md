**Plan Status:** completed
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

# FCP-20 Pre-Windows Cleanup Exit And Source Reconciliation Plan

## Goal

Retire exactly `ARCHITECTURE_CLEANUP_CHECKLIST.md` item `FCP-20` by closing `FCP-20-SF1`: final pre-Windows cleanup reconciliation must prove `FCP-13` through `FCP-19` local source findings are fixed, source-disproved, accepted with one owner/revisit trigger, or explicitly deferred to the Windows port owner.

This is an `FCP-*` source-backed checklist package. Coverage is defined only by checklist `source_finding_id` value `FCP-20-SF1`; do not use Desloppify output, detector ids, imported review ids, package-map ids, raw review observations, score deltas, or FCP-7 through FCP-12 historical baseline rows as FCP-20 membership, proof, or closeout.

The completed `FCP-13` through `FCP-19` active plans and checklist closeout records are primary reconciliation inputs. Current source and current docs must still be checked before closeout. The duplicated priority-one review observation is covered only by `FCP-14-SF1` and must not become a second FCP-20 checklist member.

## Non-Goals

- Do not implement production source changes.
- Do not start or plan `FCP-EXIT`, Windows port work, Desloppify intake, raw review-id mapping, score chasing, or broader post-FCP cleanup.
- Do not reopen completed `FCP-7` through `FCP-12` unless current source proves their recorded baseline evidence is false.
- Do not implement ChannelSetupScreen cleanup inside FCP-20. The deferred ChannelSetupScreen candidate may only be recorded as a non-active owner/revisit disposition unless current source proves a distinct live residual; if it does, stop for maintainer routing into a separate source-backed brief.
- Do not use detector/package-map/imported ids as FCP-20 coverage.

## Parent Priority Alignment

`FCP-20` is the final additional pre-Windows cleanup reconciliation package after `FCP-13` through `FCP-19`. It should leave one auditable source-backed exit record for those packages and one owner for any accepted residue before any later exit gate or platform work begins.

The parent architecture alignment is docs/source coherence, not code reshaping. The approved owner is the final cleanup controller and pre-Windows reconciliation owner. Source package owners remain where the completed packages placed them:

- priority-one assembly remains under `src/core/orchestrator/priority-one/`
- Plex auth Home/profile helper work remains auth-local
- scheduler/channel-manager persistence and content-resolution owners remain package-local
- navigation and Plex stream package organization remain grouped under their current subfolders
- ChannelSetupScreen deferred candidate remains owned by the channel setup UI owner, outside FCP-20 execution coverage

## Required Reading

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/README.md`
4. `docs/agentic/session-prompts/cleanup-loop.md`
5. `docs/agentic/plan-authoring-standard.md`
6. `docs/agentic/codanna-playbook.md`
7. `ARCHITECTURE_CLEANUP_CHECKLIST.md`
   - `Fresh-Session Handoff`
   - `Operating Contract`
   - `FCP Operating Rules`
   - completed `FCP-13` through `FCP-19`
   - `Deferred Pre-Port Candidate: ChannelSetupScreen Distinct Residual`
   - `FCP-20`
8. `docs/architecture/CURRENT_STATE.md`
9. `docs/architecture/modules.md`
10. `docs/api/plex-integration.md`
11. `docs/development/subtitles.md`
12. completed active FCP plans:
   - `docs/plans/2026-05-05-fcp-13-low-risk-source-signal-api-export-diagnostic-closure-plan.md`
   - `docs/plans/2026-05-05-fcp-14-priority-one-forwarding-assembly-seam-plan.md`
   - `docs/plans/2026-05-05-fcp-15-plexauth-home-profile-status-helper-boundary-plan.md`
   - `docs/plans/2026-05-05-fcp-16-scheduler-current-channel-channelmanager-persistence-semantics-plan.md`
   - `docs/plans/2026-05-05-fcp-17-contentresolver-cache-coalescing-mapping-boundaries-plan.md`
   - `docs/plans/2026-05-05-fcp-18-behavior-neutral-navigation-package-organization-plan.md`
   - `docs/plans/2026-05-05-fcp-19-behavior-neutral-plex-stream-package-organization-plan.md`
13. completed `FCP-7` through `FCP-12` plans/checklist records only as guardrails if current source contradicts recorded baseline evidence; do not treat them as active inputs.

Freshness gate: before execution, rerun `git status --short --branch` and re-read the `FCP-20` checklist entry plus any file changed since this plan was written. If another session has already updated `FCP-20`, this plan must be refreshed before execution. The checklist currently still says `Plan: none yet` / ready-now none while this plan is under review; do not treat that as a contradiction until the pre-execution bookkeeping gate below has run after clean plan review.

## Required Skills

- `.codex/skills/architecture-boundaries/SKILL.md`
- `.codex/skills/verification-strategy/SKILL.md`
- `.codex/skills/execution-plan-authoring/SKILL.md`
- `.codex/skills/plex-integration-boundaries/SKILL.md` for the FCP-19 Plex stream/API/subtitle path-truth audit only

Do not load `ui-composition-patterns` unless the source audit proves the deferred ChannelSetupScreen candidate is a distinct live residual that needs more than owner/revisit accounting. If that happens, stop and replan instead of expanding FCP-20.

## Codanna Discovery

- `get_index_info`: refreshed for this planner pass. Snapshot: 11268 symbols across 761 files, 12503 relationships, semantic search enabled with `JinaEmbeddingsV2BaseCode`, 52 embeddings, updated 7 hours before this plan.
- `search_documents`: attempted anchored queries for `FCP-13 FCP-20 source_finding_id cleanup checklist proof matrix`, `ARCHITECTURE_CLEANUP_CHECKLIST FCP-20-SF1 source finding proof matrix`, `CURRENT_STATE modules navigation plex stream path truth FCP-18 FCP-19`, and `Deferred ChannelSetupScreen Distinct Residual FCP-11 FCP-13 StrategyStepController`. Results were noisy and mostly returned unrelated user-guide, historical, or older DCR/P6 plan snippets. Deterministic fallback was required and used: direct reads of the required checklist, workflow, architecture, API, subtitle, and FCP-13 through FCP-19 plan files.
- `semantic_search_with_context`: useful for `PlexAuth Home profile status helper boundary validate token`; it found `validateToken` with symbol id `2370` and confirmed callers through auth validation/startup. Queries for navigation package organization, Plex stream organization, and ContentResolver owner split were weak or stale/noisy, so file-system source audits below are authoritative for those surfaces.
- `analyze_impact`: audit-only, because FCP-20 plans no production source edits. Snapshots:
  - `validateToken` symbol id `2370`: impacts `PlexAuth` constructor and initialization auth-validation callers only; this supports treating FCP-13/FCP-15 auth checks as audit-only.
  - `createPriorityOneRuntimeAssembly`: impacts `AppOrchestrator._initializePriorityOneControllers()` / `initialize()` only; this supports keeping FCP-14 proof to priority-one assembly ownership and not adding duplicate coverage.
  - `ChannelSetupScreen`: impacts `AppLazyScreenRegistry`, `App`, and visibility coordination; this confirms why any live ChannelSetup residual would require UI-boundary replanning instead of FCP-20 absorption.
  - `ContentResolver` by name returned an incorrect/noisy symbol association in Codanna, so the current source files are audited with `rg` and direct reads instead.
- `rg` fallback/source audits used because Codanna document search and several moved-symbol lookups were insufficient after FCP-18/FCP-19 package moves.

## Impact Snapshot

Planner pre-audit found no reason to split FCP-20 into implementation refactors. The current safe execution surface is one serial docs/checklist reconciliation unit.

Source/doc evidence to carry into execution:

- `FCP-13` current-signal checks:
  - Redundant old comment/banner patterns were searched in current navigation/Plex stream/Plex library/player/EPG files; the targeted `rg` returned no matches.
  - `ChannelCreateOptions` is exported from `src/modules/scheduler/channel-manager/index.ts` and owned in `interfaces.ts`.
  - `PlexAuth.validateToken()` docs now say only explicit `401`/`403` auth-invalid responses return `false`; service, transport, timeout, and malformed success failures throw.
  - `tools/architecture-rules/lineupArchitectureRules.mjs` has `temporaryExceptions: []`.
  - `isSignalAborted` appears only in historical checklist text, not live source/current architecture/API docs.
  - `SubtitleTrackRecoveryController` appends burn-in attempt diagnostics only after a non-ignored attempt result or thrown attempt.
  - `StrategyStepController` uses `_createAdjustableToggle(...)` for repeated adjustable controls.
- `FCP-14` current-signal checks:
  - `PriorityOneControllerCollaborators.ts` builds owner-valued controllers/binders from the grouped `PriorityOneAssemblyInput`; `PlaybackRuntimeController` consumes grouped playback/scheduler/player/UI runtime ports.
  - Codanna impact for priority-one runtime assembly is limited to `AppOrchestrator` initialization wiring.
  - The duplicated priority-one review observation stays covered only by `FCP-14-SF1`.
- `FCP-15` current-signal checks:
  - `PlexHomeProfileClient` owns Home user/profile-switch request and status work.
  - `PlexAuth` delegates Home/profile calls while retaining credential state, token validation, PIN flow, persistence, and auth/profile events.
- `FCP-16` current-signal checks:
  - `ChannelPersistenceCoordinator.persistCurrentChannelIdBestEffort()` is explicitly best-effort and tests name the public best-effort behavior.
  - `ChannelManager` remains the public facade while package-local collaborators own authoring, import/export, persistence coordination, save queue, retry, and content resolution.
- `FCP-17` current-signal checks:
  - `ContentResolver` constructs `SourceResolutionCache`, `ContentItemMapper`, and `ContentSelectionPolicy`.
  - The cache/coalescing, mapping/normalization, filtering/sorting/playback-ordering owners exist as package-local files.
- `FCP-18` current-signal checks:
  - `src/modules/navigation/` production files are grouped under `contracts/`, `manager/`, `input/`, `coordinator/`, `handlers/`, and `config/`.
  - Current architecture docs describe those groups. Old direct flat-path references remain only in historical checklist/package-map/run contexts or tests that intentionally assert stale-rule cleanup; do not treat historical rows as current path truth.
- `FCP-19` current-signal checks:
  - `src/modules/plex/stream/` production files are grouped under `contracts/`, `diagnostics/`, `pipeline/`, `policy/`, `resolver/`, and `url/`.
  - `docs/api/plex-integration.md` points `IPlexStreamResolver` at `src/modules/plex/stream/contracts/interfaces.ts`.
  - `docs/development/subtitles.md` and architecture docs point the resolver implementation at `src/modules/plex/stream/resolver/PlexStreamResolver.ts`.
- Deferred ChannelSetupScreen:
  - The FCP-19 read-only addendum and checklist keep the possible strategy-step bridge residual deferred with final owner `channel setup UI owner`.
  - Current architecture docs say `ChannelSetupScreen.ts` is a screen shell/step router and no longer a primary hotspot. FCP-20 must not implement this work.

Execution must rerun these audits and write the final source-finding proof matrix/residual owner ledger into the checklist closeout record. If the rerun contradicts the planner pre-audit, follow the stop/replan triggers below.

## Files In Scope

- `ARCHITECTURE_CLEANUP_CHECKLIST.md`
- `docs/architecture/CURRENT_STATE.md`, only if the final audit finds current-source ownership/path truth missing or stale
- `docs/architecture/modules.md`, only if the final audit finds current-source ownership/path truth missing or stale
- `docs/api/plex-integration.md`, only if the FCP-19 Plex stream API path-truth audit finds stale path or contract text
- `docs/development/subtitles.md`, only if the FCP-19 subtitle path-truth audit finds stale path or behavior text
- `docs/plans/2026-05-05-fcp-20-pre-windows-cleanup-exit-source-reconciliation-plan.md`
- Read-only audit scope for living source files touched by `FCP-13` through `FCP-19`, including:
  - `src/core/orchestrator/priority-one/**`
  - `src/core/orchestrator/controllers/SubtitleTrackRecoveryController.ts`
  - `src/modules/navigation/**`
  - `src/modules/plex/auth/**`
  - `src/modules/plex/stream/**`
  - `src/modules/scheduler/channel-manager/**`
  - `src/modules/player/AudioTrackManager.ts`
  - `src/modules/player/ErrorHandler.ts`
  - `src/modules/plex/library/interfaces.ts`
  - `src/modules/ui/epg/view/EPGCellRenderer.ts`
  - `src/modules/ui/epg/view/EPGErrorBoundary.ts`
  - `src/modules/ui/channel-setup/steps/StrategyStepController.ts`
  - `src/modules/ui/channel-setup/ChannelSetupScreen.ts` only for deferred owner/revisit accounting
  - `tools/architecture-rules/lineupArchitectureRules.mjs`

## Files Out Of Scope

- Production source edits.
- Test source edits.
- Windows port files or platform feature implementation.
- New Desloppify, detector, imported-review, package-map, or raw review-id artifacts.
- FCP-7 through FCP-12 historical plans/checklist rows except as guardrails if current source proves recorded baseline evidence false.
- ChannelSetupScreen implementation, ChannelSetup UI extraction, focus behavior changes, dropdown behavior changes, CSS/visual redesign, or persistence/schema work.
- Any runtime/source file not named in the read-only audit scope, unless the final source audit produces a hard contradiction that requires replanning before execution continues.
- The unrelated dirty/untracked files present at planner start:
  - `docs/archive/plans/2026-04-30-dcr-10-oversized-test-suite-structure.md`
  - `docs/plans/2026-04-30-dcr-exit-final-dimension-audit-plan.md`
  - `scorecard.png`
  - `docs/agentic/evals/baseline-summaries/2026-04-28-prompt-13-feature-low-implementer-policy.md`

## Planner Self-Check

1. No unresolved architecture seam is hidden in FCP-20. The chosen seam is reconciliation-only: source audits plus checklist/current-doc truth updates.
2. Adjacent source contracts are frozen. If the audit needs a source or test change, this plan stops and replans.
3. Files marked out of scope are not needed for implementation. They are either historical evidence, unrelated dirty state, or future work.
4. Codanna evidence and fallback are recorded. Codanna document search was noisy, so direct reads and `rg` source audits are the deterministic basis.
5. The plan does not grow a hotspot. It writes docs/checklist closeout only.
6. After the clean-plan-review bookkeeping gate updates the checklist mini-record, a fresh session can start `ready_now_execution_unit` `FCP-20-S1` without choosing package membership, owner finality, parallelism, or verification depth.
7. The plan is execution-grade at seam/scope/verification level and does not prescribe production-code pseudo-code.

## Architecture Seam Decision Gate

The approved FCP-20 seam is a single serial reconciliation unit:

- rerun source-finding proof matrix audit for `FCP-13` through `FCP-19`
- reconcile current architecture/API/subtitle docs only when source ownership/path truth changed or is stale
- record source-audit proof, residual owner ledger, docs/checklist reconciliation, verification results, and handoff prep in the checklist; the controller appends clean implementation review evidence only after that review is observed clean

FCP-20 may update docs/checklist inconsistencies discovered during exit. It may not change production source, tests, public APIs, persistence schemas, Plex behavior, navigation behavior, UI/focus behavior, token/redaction behavior, or Windows platform behavior.

Stop and replan before any implementation if:

- a live source issue is found without one final owner and revisit trigger;
- completed FCP-7 through FCP-12 baseline evidence is source-false;
- a source-audit theme cannot be mapped to local `source_finding_id` coverage;
- verification fails for runtime work completed in FCP-13 through FCP-19;
- closeout would require production refactoring instead of reconciliation;
- the ChannelSetupScreen deferred candidate needs more than owner/revisit accounting;
- any FCP-13 through FCP-19 finding needs a different final owner, package membership, execution-unit membership, or verification envelope;
- a doc update would need to relabel detector/imported/package-map ids as FCP proof.

Pre-execution bookkeeping gate after clean plan review:

- Only after a clean plan review, the controller must update the `FCP-20` checklist mini-record from `Plan: none yet` / ready-now none to point at this plan and selected execution unit `FCP-20-S1`.
- This is a bookkeeping update, not a completion or closeout update. It must not mark `FCP-20` complete, in progress, or otherwise claim source-finding disposition before execution evidence exists.
- Do not launch cleanup_worker for `FCP-20-S1` until that bookkeeping update is present or the controller explicitly refreshes this plan to account for a different reviewed handoff surface.

## Verification Commands

Verification strategy classification: `broader integration/manual proof required`.

Primary verification mode: `integration-ops`, supported by source audit. This is docs/checklist reconciliation over completed runtime packages, so new automated tests are not expected. Existing targeted tests and `npm run verify` are the runtime confidence gate; if they fail, FCP-20 must stop because reconciliation can no longer prove the completed runtime work.

Run these during execution:

1. `git status --short --branch`
   - Expected: branch and dirty state are recorded; unrelated dirty/untracked paths are preserved and not used as FCP-20 evidence.
2. Source-finding proof matrix audit for `FCP-13` through `FCP-19`
   - Expected: every `FCP-13-SF*` through `FCP-19-SF*` is fixed, source-disproved, accepted with one owner/revisit trigger, or explicitly deferred to the Windows port owner.
3. Package-local `rg` audits for old and replacement patterns named by FCP-13 through FCP-19 closeouts
   - Expected: old-path or old-pattern matches in current source/current docs are absent or source-justified; replacement owners are present and match architecture/API docs.
4. `npm run plans:check`
   - Expected: active tracked plan structure and FCP source-backed coverage pass.
5. `npm run verify:docs`
   - Expected: checklist, plan, architecture/API/reference docs pass.
6. `git diff --check -- ARCHITECTURE_CLEANUP_CHECKLIST.md`
   - Expected: no whitespace errors in the required checklist closeout diff.
7. If any other tracked docs change, run a broader targeted diff check, for example:
   - `git diff --check -- ARCHITECTURE_CLEANUP_CHECKLIST.md docs/plans/2026-05-05-fcp-20-pre-windows-cleanup-exit-source-reconciliation-plan.md docs/architecture/CURRENT_STATE.md docs/architecture/modules.md docs/api/plex-integration.md docs/development/subtitles.md`
   - Expected: no whitespace errors in all changed tracked docs.
8. `npm run verify`
   - Expected: full package verification passes before any Windows port work or broader post-FCP work begins.

Optional only after FCP-20 is closed and never as membership or closure proof: final external score refresh as retrospective signal.

## Rollback Notes

Rollback is docs-only unless a replan explicitly authorizes source work. If closeout evidence is wrong, revert or amend only the FCP-20 plan/checklist/doc changes from this package, then rerun `npm run plans:check` and the applicable docs verifier. Do not revert unrelated dirty/untracked workspace files.

If `npm run verify` fails due to completed runtime work, do not "rollback" by editing FCP-20 docs around the failure. Stop, preserve evidence, and route the failure to the package owner or a new source-backed remediation brief.

## Commit Checkpoints

- Planning artifact checkpoint: this active plan may be committed separately from any future closeout record.
- FCP-20 execution checkpoint: after source audits, docs/checklist reconciliation, required verification, observed clean implementation review, and controller-appended review evidence, commit the checklist/current-doc closeout updates as one focused docs/control-plane checkpoint.
- Do not mix active tracked plan churn with unrelated dirty files.
- Do not create a source implementation commit under this plan.

## Package Decomposition

- `package_id`: `FCP-20`
- `checklist_token`: `FCP-20`
- `source_finding_ids`:
  - `FCP-20-SF1`

| slice_id | goal | areas/files | source_finding_ids | verification | dependencies | stop_condition | handoff_condition | serial_only | parallel_justification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FCP-20-S1` | Complete the pre-Windows cleanup exit reconciliation by auditing FCP-13 through FCP-19 source-finding dispositions, recording any residual owner ledger, reconciling current architecture/API/subtitle docs if stale, and preparing the final checklist handoff record for controller closeout. | `ARCHITECTURE_CLEANUP_CHECKLIST.md`; `docs/architecture/CURRENT_STATE.md`, `docs/architecture/modules.md`, `docs/api/plex-integration.md`, `docs/development/subtitles.md` only if source/path truth needs reconciliation; read-only audits over FCP-13 through FCP-19 source surfaces; this plan file for plan-status/progress updates if needed. | `FCP-20-SF1` | Source-finding proof matrix audit for FCP-13 through FCP-19; package-local `rg` old/replacement pattern audits; architecture/API/subtitle path-truth audits; `npm run plans:check`; `npm run verify:docs`; `git diff --check -- ARCHITECTURE_CLEANUP_CHECKLIST.md`; broader `git diff --check` if other tracked docs change; final `npm run verify`. | FCP-19 is closed with clean closeout evidence, and the post-plan-review bookkeeping gate has updated the checklist mini-record to point at this plan and `FCP-20-S1`. No FCP-EXIT or Windows work may start before this unit closes. | Stop if source audit finds a live source issue without one owner, false FCP-7 through FCP-12 baseline evidence, an unmappable source-audit theme, failed verification for completed runtime work, a need for production refactor, or ChannelSetupScreen work beyond owner/revisit accounting. | `FCP-20-SF1` no longer has ambiguous disposition: every FCP-13 through FCP-19 source finding has source-backed final status; accepted/deferred residuals have one owner and revisit trigger; docs match current source; required verification results are recorded or prepared for controller closeout; checklist handoff names the next allowed gate or blocker. The controller appends clean implementation review evidence only after review is observed clean. | true | Single source finding with one exit ledger. Splitting S1/S2/S3 would risk duplicate or conflicting final-owner accounting; architecture/API doc reconciliation is conditional closeout work inside the same proof envelope. |

Coverage check:

- `FCP-20-SF1` maps exactly once to `FCP-20-S1`.
- Deferred ChannelSetupScreen candidate maps to no FCP-20 slice; it remains a non-active deferred owner/revisit record with final owner `channel setup UI owner` unless source audit proves a live distinct residual, which is a stop/replan condition.
- The duplicated priority-one review observation maps to no FCP-20 slice and remains covered only by `FCP-14-SF1`.
- No detector/imported/package-map/raw review id maps into FCP-20 coverage.

`ready_now_execution_unit`: `FCP-20-S1`

`ready_now_slice`: `FCP-20-S1`

`recommended_slice_order`:

1. `FCP-20-S1`

`parallel_execution_policy`: serial only. The exit ledger, conditional doc reconciliation, final verification, and handoff record share the same owner and proof envelope.

## Priority-Exit Readiness

FCP-20 is the final additional pre-Windows cleanup package before any later exit gate or platform work can be considered. Closeout must record the following without detector/imported ids:

- `FCP-20-SF1`: planned disposition is `resolved` by `FCP-20-S1` when the final checklist record proves every `FCP-13` through `FCP-19` source finding is fixed, source-disproved, accepted with one owner/revisit trigger, or explicitly deferred to the Windows port owner.
- Source-finding set to audit:
  - `FCP-13-SF1` through `FCP-13-SF9`
  - `FCP-14-SF1`
  - `FCP-15-SF1`
  - `FCP-16-SF1` and `FCP-16-SF2`
  - `FCP-17-SF1`
  - `FCP-18-SF1`
  - `FCP-19-SF1`
- Deferred or split items: none planned for active FCP-20 coverage. If source audit discovers real residue, record exactly one final owner, reason, and revisit trigger only if it stays inside reconciliation scope; otherwise stop and replan.
- Deferred ChannelSetupScreen residual: keep as a non-active deferred record. Final owner: `channel setup UI owner`. Reason: broad ChannelSetupScreen cleanup risks reopening completed FCP-11 work without a new source finding, and the currently named possible bridge is screen-boundary composition glue rather than clearly separate behavior ownership. Revisit trigger: open a new source-backed brief only if current source proves a distinct ChannelSetupScreen residual not covered by completed FCP-11 channel setup owner closure or `FCP-13-SF9` strategy-step structural cleanup, or if a planned ChannelSetup change must touch that bridge and would otherwise expand `ChannelSetupScreen` responsibility. Do not activate or implement it inside FCP-20.
- Priority-one duplicated observation: do not add it to FCP-20; `FCP-14-SF1` remains the only final owner for that completed priority-one observation.
- P0/security disposition: no FCP-20 security finding is planned. If the audit finds token/redaction, auth, or security behavior drift, stop and route a separate source-backed brief instead of closing FCP-20.
- Next-work gate: do not start `FCP-EXIT`, Windows port implementation, or broader post-FCP cleanup until FCP-20 has clean source-backed closeout, required verification evidence, and clean review. If the maintainer still requires `FCP-EXIT`, Windows port work waits for that later gate too.

## FCP-20 Execution Packet

Use this bounded packet for the next cleanup-loop implementation pass.

- Execution unit: `FCP-20-S1`
- Slice: `FCP-20-S1`
- Write scope:
  - `ARCHITECTURE_CLEANUP_CHECKLIST.md`
  - current architecture/API/subtitle docs only if the final audit proves stale path/source truth
  - this plan file only for plan-status/progress metadata if the controller asks for it
- Read-only audit scope:
  - completed FCP-13 through FCP-19 plans and checklist closeouts
  - living source paths listed under `## Files In Scope`
  - current architecture/API/subtitle docs
- Required output in checklist:
  - FCP-13 through FCP-19 source-finding proof matrix
  - residual owner ledger, even if empty
  - explicit ChannelSetupScreen deferred owner/revisit disposition
  - docs/checklist reconciliation and verification command results or closeout-ready verification prep
  - next safe gate or named blocker
- Review evidence rule: cleanup_worker must not claim or write clean implementation review evidence. After `FCP-20-S1` execution is reviewed and observed clean, the controller appends the clean implementation review evidence during closeout.
- Stop immediately if the source audit needs production refactor, new tests, UI/focus work, Plex behavior changes, persistence/schema changes, or source edits.
