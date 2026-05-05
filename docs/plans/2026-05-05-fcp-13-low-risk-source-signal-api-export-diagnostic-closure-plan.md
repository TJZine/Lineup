**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

# FCP-13 Low-Risk Source Signal, API Export, And Diagnostic Closure Plan

## Goal

Retire exactly `ARCHITECTURE_CLEANUP_CHECKLIST.md` item `FCP-13` by closing the low-risk source-signal, public export, diagnostic, and local duplication findings admitted for this package.

This is an `FCP-*` source-backed cleanup package. Coverage is defined only by checklist `source_finding_id` values `FCP-13-SF1` through `FCP-13-SF9`; do not use Desloppify, detector ids, imported review ids, package-map ids, stale hotspot docs, line count, score output, or fresh post-FCP subjective review as intake, proof, or closeout.

Completion means every original `FCP-13-SF*` sentence is fixed, source-disproved, or explicitly reclassified with one final owner and revisit trigger. Closeout must answer whether each original source finding still describes current source.

## Non-Goals

- Do not start, plan, or mark progress on `FCP-14` or later, `FCP-EXIT`, Windows port work, or broader post-FCP cleanup.
- Do not broaden into repo-wide comment cleanup, broad source-signal sweeps, package folder organization, Plex auth extraction, channel-manager owner extraction, ContentResolver work, or ChannelSetupScreen convergence cleanup.
- Do not change product behavior for navigation, Plex auth, stream resolution, playback, scheduler persistence, channel setup workflow, EPG visuals, focus, reduced-motion, ticker behavior, or user warnings.
- Do not delete semantic comments that explain lifecycle, nullability, side effects, server quirks, platform behavior, failure handling, security/redaction, or public contracts.
- Do not introduce new dependencies, compatibility shims, root barrels, fallback paths, storage schema changes, or persistence behavior changes.

## Parent Priority Alignment

`FCP-13` is the first additional pre-Windows-port cleanup package after completed `FCP-7` through `FCP-12`. The checklist identifies `FCP-13` as the next safe start, and states that `FCP-14` through `FCP-20`, `FCP-EXIT`, Windows port work, and other post-FCP cleanup must wait for clean `FCP-13` closeout evidence.

Current architecture docs place the affected owners as follows:

- navigation owns remote/focus/navigation contracts;
- Plex auth, library, and stream remain separate Plex-facing owners;
- channel-manager package seams expose scheduler/channel public contracts while `ChannelManager` remains the public channel-domain facade;
- `src/modules/ui/epg/view/EPGCellRenderer.ts` remains the EPG view-layer DOM adapter with renderer-local presentation helpers from `FCP-10`;
- `src/modules/ui/channel-setup/steps/StrategyStepController.ts` remains a package-local step controller under the channel setup UI owner.

This plan tightens those existing owners without moving ownership across module boundaries.

## Required Reading

Read in this order before implementation or review:

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/README.md` routing table
4. `ARCHITECTURE_CLEANUP_CHECKLIST.md` sections `FCP Operating Rules`, `FCP-12`, and `FCP-13`
5. `docs/architecture/CURRENT_STATE.md`
6. `docs/architecture/modules.md`
7. `docs/agentic/session-prompts/cleanup-loop.md`
8. `docs/agentic/plan-authoring-standard.md`
9. `docs/agentic/codanna-playbook.md`
10. `docs/api/plex-integration.md`
11. completed guardrail plans only:
    - `docs/plans/2026-05-02-fcp-7-boundary-type-hygiene-plan.md`
    - `docs/plans/2026-05-02-fcp-8-api-plex-error-contract-coherence-plan.md`
    - `docs/plans/2026-05-02-fcp-9-source-signal-convention-local-elegance-plan.md`
    - `docs/plans/2026-05-02-fcp-10-epg-renderer-direct-confidence-presentation-decomposition-plan.md`
    - `docs/plans/2026-05-02-fcp-11-runtime-owner-reduction-hotspots-plan.md`
    - `docs/plans/2026-05-02-fcp-12-package-organization-structure-navigation-final-exit-plan.md`
12. this plan
13. source and test files named under `## Files In Scope`
14. `git status --short --branch`

Freshness gate: stop and refresh this plan if any `FCP-13` checklist text, current architecture/API ownership text, source files in scope, or tests in scope changed materially after this plan was written.

Planning observed branch `code-health...origin/code-health` with pre-existing unrelated dirty/untracked files. Preserve those files unless a fresh source audit proves direct `FCP-13` overlap.

## Required Skills

- `architecture-boundaries`: required for package seam exports, architecture-rule exception cleanup, and public contract alignment.
- `plex-integration-boundaries`: required for Plex auth docs and Plex stream/library interface source-signal work.
- `ui-composition-patterns`: required for EPG renderer and StrategyStepController UI-adjacent cleanup.
- `verification-strategy`: required to separate behavior-neutral comment/doc pruning from contract and executable invariance proof.
- `execution-plan-authoring`: required for Tier 3 source-backed FCP package planning.

Do not load `persistence-boundaries` unless implementation discovers a required storage schema or persistence behavior change. That discovery should normally stop and replan. `brainstorming` was not used because source audit found enough signal to choose seams without maintainer choice.

## Codanna Discovery

- `get_index_info`: Codanna available with 12,090 symbols across 798 files; semantic search enabled with 343 embeddings; index updated 11 minutes before this planning pass.
- Controller evidence also reported the same index shape about 8 minutes before handoff. This plan used the live snapshot above.
- `search_documents "FCP-13 Low-Risk Source Signal API Export Diagnostic Closure source findings"`: noisy low-score hits; did not return `ARCHITECTURE_CLEANUP_CHECKLIST.md` as authoritative.
- `search_documents "FCP Operating Rules FCP-13 source_finding_id checklist"`: noisy low-score hits; did not return the checklist as authoritative. Direct checklist reads are the fallback membership source.
- `semantic_search_with_context "FCP-13 ChannelCreateOptions validateToken isSignalAborted EPGCellRenderer StrategyStepController subtitle burn-in diagnostics"`: weak/noisy hits around EPG config and channel types, not the exact FCP-13 seams.
- `find_symbol ChannelCreateOptions` -> symbol_id `2083`; `analyze_impact` showed limited impact: `ChannelManager.createChannel` and constructor relationship.
- `find_symbol validateToken` -> symbol_id `2327`; `analyze_impact` showed callers in app-shell profile-select ports, `PlexAuth.switchHomeUser`, initialization validation, and profile-select switching. This plan approves documentation alignment only, not behavior changes.
- `find_symbol isSignalAborted` -> symbol_id `10776`; `analyze_impact` showed one production caller path in `ChannelSetupFacetSnapshotLoadSession`.
- `find_symbol EPGCellRenderer` -> symbol_id `4435`; impact analysis reported no impacted symbols, but `rg` proved `EPGVirtualizer` constructs it and direct tests import it. Treat Codanna impact as insufficient for this UI class seam.
- `find_symbol StrategyStepController` -> symbol_id `6824`; impact analysis reported no impacted symbols, but `rg` proved `ChannelSetupScreen` constructs it and its direct tests import it. Treat Codanna impact as insufficient for this UI class seam.
- `rg`/direct source reads: authoritative for comment locations, package exports, stale architecture-rule paths, subtitle diagnostic timing, abort helper callers, EPG duplicate clearing, StrategyStepController structural repetition, and UI/test caller paths.

## Impact Snapshot

Current-source proof at plan time:

- `src/modules/navigation/interfaces.ts`, `src/modules/plex/stream/interfaces.ts`, and `src/modules/plex/library/interfaces.ts` still contain redundant JSDoc in selected areas, but also contain useful semantic notes that must remain.
- `src/modules/player/AudioTrackManager.ts`, `src/modules/player/ErrorHandler.ts`, `src/modules/ui/epg/view/EPGErrorBoundary.ts`, and `src/modules/ui/epg/view/EPGCellRenderer.ts` contain a mix of useful rationale and adjacent-statement comments. Source-signal cleanup must be comments-only in this slice.
- `PlexAuth.validateToken` implementation already returns `false` only for `401`/`403` and throws `PlexApiError` for timeout, rate limiting, server, network, and malformed success cases. `IPlexAuth` docs are already aligned; the class method JSDoc still says `false otherwise`.
- `ChannelCreateOptions` is exported from `interfaces.ts` and used by `IChannelManager.createChannel`, but `src/modules/scheduler/channel-manager/index.ts` does not export it from the package seam.
- `tools/architecture-rules/lineupArchitectureRules.mjs` still carries composition-root exceptions for old app-shell paths `src/core/app-shell/AppOrchestratorConfigFactory.ts` and `src/core/app-shell/AppShellRuntimeContracts.ts`. Current source imports the moved paths under `config/` and `runtime/`; implementation must prove whether the exceptions are stale and remove them only if the rule remains active or stricter.
- `SubtitleTrackRecoveryController` appends `orchestrator.subtitleTrackChange.burnInAttempt` after a burn-in recovery promise is returned. The worker must source-audit whether the original finding is already false for the "no attempt object exists" case or still true for ignored/no-real-attempt outcomes, then fix or source-disprove with tests.
- `isSignalAborted` is a wrapper around `signal?.aborted` with one production caller in `ChannelSetupFacetSnapshotLoadSession`.
- `EPGCellRenderer.applyTextPresentation` repeats the same subtitle clearing block in adjacent non-program and non-episode branches. This is local duplication inside the EPG view DOM adapter.
- `StrategyStepController.render` repeats inline structural control construction for build options, series ordering, limits, preview, and footer controls. A local descriptor/helper is acceptable only if it reduces concrete repetition without hiding UI behavior.

## Files In Scope

- `src/modules/navigation/interfaces.ts`
- `src/modules/plex/stream/interfaces.ts`
- `src/modules/plex/library/interfaces.ts`
- `src/modules/player/AudioTrackManager.ts`
- `src/modules/player/ErrorHandler.ts`
- `src/modules/ui/epg/view/EPGErrorBoundary.ts`
- `src/modules/ui/epg/view/EPGCellRenderer.ts`
- `src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts`
- `src/modules/scheduler/channel-manager/interfaces.ts`
- `src/modules/scheduler/channel-manager/index.ts`
- `src/modules/scheduler/channel-manager/__tests__/*` only for API export proof if needed
- `src/modules/plex/auth/PlexAuth.ts`
- `src/modules/plex/auth/__tests__/PlexAuth.test.ts`
- `tools/architecture-rules/lineupArchitectureRules.mjs`
- `tools/__tests__/build-eslint-architecture-rules.test.mjs`
- `src/core/orchestrator/controllers/SubtitleTrackRecoveryController.ts`
- `src/__tests__/orchestrator/subtitle-track-recovery-warning-contract.test.ts`
- `src/core/channel-setup/shared/utils.ts`
- call sites/tests for `isSignalAborted` only if the wrapper has live production callers
- `src/modules/ui/channel-setup/steps/StrategyStepController.ts`
- affected channel setup UI tests only for strictly local strategy-step cleanup
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` only during package closeout after clean review and verification
- `docs/architecture/CURRENT_STATE.md` and `docs/architecture/modules.md` only if source audit/closeout proves architecture truth changed

## Files Out Of Scope

- Any runtime/source file not named in `## Files In Scope`
- Broad repo-wide comment cleanup
- Behavior changes to navigation, Plex auth, stream resolution, playback, scheduler persistence, channel setup workflow, or EPG visuals
- Plex auth Home/profile/status helper work, Plex stream/library package organization, ChannelManager owner extraction, ContentResolver decomposition, package folder reorganization, ChannelSetupScreen convergence cleanup, and Windows port work
- Storage keys, persistence schemas, raw localStorage ownership, selected server state, channel persistence behavior, and migrations
- `docs/api/plex-integration.md` unless source audit proves the documented Plex public contract is wrong after a stopped/replanned contract decision
- Completed FCP-7 through FCP-12 implementation work except as read-only guardrails
- Pre-existing unrelated dirty/untracked files

## Planner Self-Check

1. No unresolved package-level seam remains: every `FCP-13-SF*` maps to exactly one slice or reclassification path with one final owner.
2. Adjacent contract/type changes are explicit. `ChannelCreateOptions` may be exported from the existing channel-manager seam; no behavior widening is approved.
3. Out-of-scope files are not hidden implementation dependencies. If a slice needs them for more than targeted proof, stop and replan.
4. Codanna evidence and insufficiencies are recorded, including direct-read fallback for checklist membership and UI class caller paths.
5. The plan uses repo-preferred owners: comments stay local, Plex docs stay Plex-owned, channel export stays scheduler-owned, architecture rules stay tool-owned, subtitle diagnostics stay orchestrator controller-owned, EPG duplication stays view-owned, and strategy controls stay in the strategy step controller.
6. A fresh cleanup-loop session can start `ready_now_execution_unit` `FCP-13-S1` without deciding package membership, final owners, or verification depth.
7. The plan is execution-grade at seam/scope/verification level and deliberately leaves local helper naming and exact code shape to the cleanup worker.

## Architecture Seam Decision Gate

Approved seams:

- `FCP-13-S1`: comments and JSDoc may be deleted or narrowed only when they restate TypeScript signatures or adjacent code. `PlexAuth.validateToken` class docs may be aligned with the existing tested behavior; implementation must not change token validation behavior.
- `FCP-13-S2`: export the existing `ChannelCreateOptions` public type from the channel-manager package seam without changing `IChannelManager.createChannel` behavior. Remove obsolete architecture exceptions only when source audit and rule tests prove the boundary remains active or stricter.
- `FCP-13-S3`: keep subtitle recovery diagnostics in `SubtitleTrackRecoveryController`, abort handling in the channel setup planning caller, and EPG duplicate clearing in `EPGCellRenderer`. No cross-owner helper or UI behavior change is approved.
- `FCP-13-S4`: keep strategy-step structural cleanup local to `StrategyStepController`. A descriptor table or focused helper is allowed only for concrete repeated button/control construction that preserves preview, validation, focus registration, category state, and lifecycle semantics.

Stop and replan if:

- comment pruning removes semantic API, platform, Plex, lifecycle, nullability, side-effect, redaction/security, failure, or focus guidance;
- `validateToken` behavior appears wrong rather than documentation drift;
- `ChannelCreateOptions` export requires a new public API decision, compatibility layer, or behavior widening;
- architecture-rule cleanup loosens enforcement, removes a still-needed exception, or hides a current violation;
- subtitle diagnostic changes user warnings or changes playback recovery semantics rather than diagnostic emission timing;
- abort helper removal requires broader channel setup cancellation policy decisions;
- EPG consolidation changes DOM shape, width-tier behavior, focus hooks, reduced-motion handling, ticker behavior, live/progress/time presentation, or text layout;
- StrategyStepController cleanup changes preview behavior, validation, focus registration, category switching, adjustable-control opening, or step lifecycle behavior;
- persistence/storage behavior is touched;
- new residue changes package membership, execution-unit membership, final-owner accounting, or verification surface.

Absorb-now rule: absorb only newly discovered residue that stays within the same approved execution unit goal, owner, seam/files, verification envelope, and final-owner accounting. Record absorbed residue in implementation/review output. Replan for new owners, wider verification, changed source-finding coverage, or changed execution-unit membership.

## Verification Commands

Verification strategy classification: `new regression/contract test required`.

Primary proof mode: `refactor-invariance` for behavior-neutral source-signal and local duplication cleanup, with `contract-first` proof for package export, Plex auth documentation alignment, architecture rules, and subtitle diagnostic behavior.

Plan validation:

- `npm run plans:check`
  - Expected: this active tracked plan satisfies Universal Plan Core and FCP cleanup-overlay structure.

Ready-now `FCP-13-S1` verification:

- Targeted pre/post source audit over the S1 files.
  - Expected: only redundant comments/JSDoc are removed or narrowed; no TypeScript tokens, imports, exports, selectors, runtime logic, or public signatures change except `PlexAuth.validateToken` comment text.
- `npm test -- PlexAuth`
  - Expected: validate-token behavior remains aligned with existing contract: `false` only for explicit auth-invalid outcomes, throws for timeout/service/network/malformed success failures.
- `npm run typecheck`
  - Expected: no TypeScript errors.
- `git diff --check`
  - Expected: no whitespace errors.

`FCP-13-S2` verification:

- `npm test -- ChannelManager`
  - Expected: channel-manager behavior remains unchanged after exporting `ChannelCreateOptions`; if no runtime code changes occur, typecheck plus export/import proof may be sufficient.
- `node --test tools/__tests__/build-eslint-architecture-rules.test.mjs`
  - Expected: architecture-rule tests pass, stale old-path app-shell exceptions are gone if source-proven stale, and composition-root restrictions remain active or stricter.
- Source audits:
  - `rg -n "export type \\{[^}]*ChannelCreateOptions|ChannelCreateOptions" src/modules/scheduler/channel-manager/index.ts src/modules/scheduler/channel-manager/interfaces.ts`
    - Expected: `ChannelCreateOptions` is exported from the package seam and still owned by `interfaces.ts`.
  - `rg -n "src/core/app-shell/(AppOrchestratorConfigFactory|AppShellRuntimeContracts)\\.ts|to: '../../Orchestrator'" tools/architecture-rules/lineupArchitectureRules.mjs`
    - Expected: no obsolete old-path exceptions remain unless source audit records a still-live exception with current path/reason.
- `npm run typecheck`
- `git diff --check`

`FCP-13-S3` verification:

- `npm test -- subtitle-track-recovery-warning-contract`
  - Expected: subtitle burn-in diagnostics are emitted only for source-proven actual attempts; existing user warnings for disable/recovery failures remain unchanged.
- `npm test -- ChannelSetupFacetSnapshotLoadSession ChannelSetupFacetSnapshotLoader`
  - Expected: removing or inlining `isSignalAborted` preserves caller-canceled and failure-stop behavior.
- `npm test -- --runInBand src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts`
  - Expected: EPG renderer DOM, text layout, width tier, sliver, focus, reduced-motion, ticker, live/progress, placeholder, and reset behavior remain unchanged after duplicate clearing consolidation.
- Source audits:
  - `rg -n "isSignalAborted" src/core/channel-setup`
    - Expected: no redundant wrapper remains, or implementation output source-justifies one canonical helper.
  - targeted diff audit of `EPGCellRenderer.applyTextPresentation`
    - Expected: duplicate adjacent secondary-text clearing is consolidated locally without DOM/behavior drift.
- `npm run typecheck`
- `git diff --check`

`FCP-13-S4` verification:

- `npm test -- StrategyStepController`
  - Expected: strategy category rendering, toggles, scope buttons, priority rows, preview panel, footer actions, focus registration, and state updates remain unchanged.
- Run affected channel setup UI tests only if `StrategyStepController` changes touch shared step/focus behavior.
- Source audit:
  - Expected: repeated structural control patterns are reduced by a local helper/descriptor table, or implementation records a source-justified no-code disposition if the current explicit controls are clearer and safer.
- `npm run typecheck`
- `git diff --check`

Package closeout:

- Source-finding proof matrix for `FCP-13-SF1` through `FCP-13-SF9`.
  - Expected: every original source finding sentence is answered as fixed, source-disproved, deferred, or reclassified with one final owner.
- Package-local old/replacement pattern audits for comments, exports, architecture exceptions, diagnostics, abort helper, EPG duplicate clearing, and strategy-step repetition.
- `npm run verify:docs`
  - Expected: required if checklist/current-state/modules/plan docs are updated during closeout.
- `npm run plans:check`
  - Expected: active/completed plan structure remains valid after closeout updates.
- `npm run typecheck`
- `git diff --check`
- `npm run verify`
  - Expected: full UI/navigation/Plex/runtime package gate passes before marking `FCP-13` complete.

Do not use fresh post-FCP verification, subjective review, detector score output, stale hotspot docs, line count, or package-map output as membership or closure proof.

## Rollback Notes

- Roll back by slice, not by package.
- If `FCP-13-S1` removes semantic guidance, restore the comment and continue only with source-proven redundant comments.
- If `validateToken` docs expose behavior uncertainty, restore docs and replan around behavior rather than changing Plex auth inside S1.
- If `FCP-13-S2` export changes behavior or creates public API ambiguity, restore the export change and replan the package seam; do not add compatibility shims.
- If architecture-rule cleanup exposes a real current violation, restore only the still-needed exception with current path/reason and stop for replan.
- If `FCP-13-S3` changes warnings, cancellation semantics, or EPG behavior, revert that local slice while preserving any tests that revealed the issue.
- If `FCP-13-S4` makes strategy-step behavior less explicit or changes focus/preview/lifecycle behavior, revert to the current inline controls and record source-justified retention or replan.

## Commit Checkpoints

- `FCP-13-S1` implementation checkpoint: redundant comment/JSDoc pruning plus `PlexAuth.validateToken` documentation alignment and focused PlexAuth/typecheck proof.
- `FCP-13-S2` implementation checkpoint: channel-manager package export plus architecture-rule stale exception cleanup and rule/export verification.
- `FCP-13-S3` implementation checkpoint: subtitle diagnostic disposition, abort helper disposition, and EPG duplicate clearing consolidation with focused tests.
- `FCP-13-S4` implementation checkpoint: StrategyStepController structural cleanup or source-justified retention with focused strategy-step tests.
- Closeout checkpoint: after all slices pass clean review and `npm run verify`, update `ARCHITECTURE_CLEANUP_CHECKLIST.md` and any narrow current architecture docs in a separate orchestrator-owned closeout pass if implementation commits already exist.

## Package Decomposition

- `package_id`: `FCP-13`
- `checklist_token`: `FCP-13`
- `package_issue_ids`: n/a for FCP source-backed packages; use `source_finding_ids`
- `source_finding_ids`: `FCP-13-SF1`, `FCP-13-SF2`, `FCP-13-SF3`, `FCP-13-SF4`, `FCP-13-SF5`, `FCP-13-SF6`, `FCP-13-SF7`, `FCP-13-SF8`, `FCP-13-SF9`
- `coverage_check`:
  - `FCP-13-SF1` maps exactly to `FCP-13-S1`.
  - `FCP-13-SF2` maps exactly to `FCP-13-S1`.
  - `FCP-13-SF3` maps exactly to `FCP-13-S2`.
  - `FCP-13-SF4` maps exactly to `FCP-13-S1`.
  - `FCP-13-SF5` maps exactly to `FCP-13-S2`.
  - `FCP-13-SF6` maps exactly to `FCP-13-S3`.
  - `FCP-13-SF7` maps exactly to `FCP-13-S3`.
  - `FCP-13-SF8` maps exactly to `FCP-13-S3`.
  - `FCP-13-SF9` maps exactly to `FCP-13-S4`.
  - No defer path is approved at plan freeze. If a fresh source audit source-disproves a finding or makes a listed cleanup churn, update this plan before implementation or record the source-disproved disposition in the owning slice with one final owner: `FCP-13` package closeout.
- `ready_now_execution_unit`: `FCP-13-S1`
- `ready_now_slice`: `FCP-13-S1`
- `recommended_slice_order`: `FCP-13-S1`, then `FCP-13-S2`, then `FCP-13-S3`, then `FCP-13-S4`, then package closeout source audit and docs/checklist updates if earned.
- `parallel_execution_policy`: serial only by default. Do not start all slices at once. No execution waves are approved. After `FCP-13-S1` clean review, the controller may select the next listed slice only if no replan trigger fired and no overlapping uncommitted work remains.

| slice_id | goal | areas/files | source_finding_ids | verification | dependencies | stop_condition | handoff_condition | serial_only | parallel_justification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FCP-13-S1` | Prune redundant comment/JSDoc signal and align `PlexAuth.validateToken` class docs with current tested behavior. | `src/modules/navigation/interfaces.ts`, `src/modules/plex/stream/interfaces.ts`, `src/modules/plex/library/interfaces.ts`, `src/modules/player/AudioTrackManager.ts`, `src/modules/player/ErrorHandler.ts`, `src/modules/ui/epg/view/EPGErrorBoundary.ts`, `src/modules/ui/epg/view/EPGCellRenderer.ts`, `src/modules/plex/auth/PlexAuth.ts`, `src/modules/plex/auth/__tests__/PlexAuth.test.ts` if needed. | `FCP-13-SF1`, `FCP-13-SF2`, `FCP-13-SF4` | Targeted comment/doc source audit; `npm test -- PlexAuth`; `npm run typecheck`; `git diff --check`. | none | Stop if pruning removes semantic guidance, if non-comment code changes are needed beyond doc text, or if `validateToken` behavior is wrong rather than docs stale. | Only redundant comments are removed or narrowed; semantic guidance is preserved; `validateToken` docs say `false` only for `401`/`403` and throws for non-auth failures; tests/typecheck pass. | true | Ready-now because the source audit confirms behavior-neutral comment/doc cleanup with contained PlexAuth verification. |
| `FCP-13-S2` | Align the channel-manager package export surface and remove obsolete app-shell architecture-rule exceptions only when enforcement remains active. | `src/modules/scheduler/channel-manager/interfaces.ts`, `src/modules/scheduler/channel-manager/index.ts`, `src/modules/scheduler/channel-manager/__tests__/*` only for export proof if needed, `tools/architecture-rules/lineupArchitectureRules.mjs`, `tools/__tests__/build-eslint-architecture-rules.test.mjs`. | `FCP-13-SF3`, `FCP-13-SF5` | Export source audit; focused ChannelManager/export proof as needed; architecture-rule tests; `npm run typecheck`; `git diff --check`. | `FCP-13-S1` clean review. | Stop if export requires behavior widening, a compatibility seam, or a new API decision; stop if architecture exception removal loosens enforcement or hides a live violation. | `ChannelCreateOptions` is exported through the package seam; obsolete old-path architecture exceptions are removed or rejustified with current source proof; tests/audits pass. | true | API seam and architecture-rule edits are low-risk but distinct from comment pruning, so execute after S1 review. |
| `FCP-13-S3` | Close subtitle burn-in diagnostic noise, abort wrapper redundancy, and EPG secondary-text clearing duplication without behavior drift. | `src/core/orchestrator/controllers/SubtitleTrackRecoveryController.ts`, `src/__tests__/orchestrator/subtitle-track-recovery-warning-contract.test.ts`, `src/core/channel-setup/shared/utils.ts`, `src/core/channel-setup/planning/ChannelSetupFacetSnapshotLoadSession.ts` and local tests if wrapper removal requires caller edits, `src/modules/ui/epg/view/EPGCellRenderer.ts`, `src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts`. | `FCP-13-SF6`, `FCP-13-SF7`, `FCP-13-SF8` | Subtitle warning-contract tests; channel setup facet loader/session tests as touched; direct EPGCellRenderer tests; source audits; `npm run typecheck`; `git diff --check`. | `FCP-13-S2` clean review unless controller proves no overlapping source/test work and no replan trigger fired. | Stop if diagnostics change warnings or recovery behavior, abort cleanup changes cancellation semantics, EPG cleanup changes DOM/focus/ticker/width-tier/reduced-motion behavior, or source audit proves one item is already false and the planned edit would be churn. | Subtitle diagnostic disposition is source-proven; abort wrapper is removed or justified; EPG duplicate clearing is consolidated locally; focused tests/audits pass. | true | This slice combines small executable cleanup under one verification envelope and should be reviewed as a coherent runtime/UI invariance unit. |
| `FCP-13-S4` | Reduce StrategyStepController structural repetition with a local descriptor/helper only if it improves clarity without changing behavior. | `src/modules/ui/channel-setup/steps/StrategyStepController.ts`, `src/modules/ui/channel-setup/steps/__tests__/StrategyStepController.test.ts`, affected channel setup UI tests only if shared step/focus behavior changes. | `FCP-13-SF9` | `npm test -- StrategyStepController`; affected channel setup UI tests as touched; source audit; `npm run typecheck`; `git diff --check`; package closeout `npm run verify`. | `FCP-13-S3` clean review unless controller explicitly replans. | Stop if cleanup hides behavior, changes preview/status/focus/validation/lifecycle semantics, needs cross-file helpers, or makes the current explicit controls clearer than the proposed abstraction. | Repetition is reduced by a local helper/descriptor or source-justified as accepted explicitness with `FCP-13` closeout owner; tests/audits pass. | true | UI-adjacent strategy-step work is local but should run after prior package slices to keep review and closeout accounting simple. |

No `execution_waves` or parallel worker units are approved by this plan.

## Source Finding Disposition

Plan-freeze dispositions:

- `FCP-13-SF1`: planned retirement in `FCP-13-S1` by pruning only redundant navigation/Plex stream/Plex library interface JSDoc while preserving semantic guidance.
- `FCP-13-SF2`: planned retirement in `FCP-13-S1` by deleting only implementation comments that narrate adjacent statements and preserving platform/failure/performance/security rationale.
- `FCP-13-SF3`: planned retirement in `FCP-13-S2` by exporting the existing public `ChannelCreateOptions` type through the channel-manager package seam.
- `FCP-13-SF4`: planned retirement in `FCP-13-S1` by aligning `PlexAuth.validateToken` class docs with current tested behavior.
- `FCP-13-SF5`: planned retirement in `FCP-13-S2` by removing or current-proof rejustifying obsolete app-shell composition-root exceptions.
- `FCP-13-SF6`: planned retirement or source-disproof in `FCP-13-S3` after source audit clarifies whether current diagnostics can still report attempts without actual attempts.
- `FCP-13-SF7`: planned retirement in `FCP-13-S3` by removing the redundant abort wrapper or source-justifying one canonical helper.
- `FCP-13-SF8`: planned retirement in `FCP-13-S3` by consolidating adjacent EPG secondary-text clearing logic locally.
- `FCP-13-SF9`: planned retirement or source-justified retention in `FCP-13-S4` depending on whether a local descriptor/helper reduces concrete repetition without obscuring behavior.

No deferred or split follow-ups are approved before implementation. If any finding cannot be retired without churn or wider behavior risk, the final owner is `FCP-13` package closeout and the revisit trigger is a maintained current-source proof matrix entry before `FCP-14` planning can begin.

## Priority-Exit Readiness

This plan is intended to close the whole `FCP-13` package once all four slices are implemented or source-disproved, reviewed, verified, and source-audited.

- FCP source findings mapped: `FCP-13-SF1`, `FCP-13-SF2`, `FCP-13-SF3`, `FCP-13-SF4`, `FCP-13-SF5`, `FCP-13-SF6`, `FCP-13-SF7`, `FCP-13-SF8`, `FCP-13-SF9`.
- Detector/imported issue ids are not in scope.
- No deferred or split follow-ups are approved at plan freeze.
- Before any `FCP-14` planning or work starts, `FCP-13` must have a source-finding proof matrix, package-local source audit rerun, targeted tests, `npm run verify`, clean closeout review, and updated checklist/current-state records if ownership truth changed.
- Security gate: no open P0 security findings are known for this package from source audit. If implementation discovers one, stop and route it as a blocker with one owner.
