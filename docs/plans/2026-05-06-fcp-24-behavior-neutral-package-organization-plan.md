**Plan Status:** completed
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

# FCP-24 Behavior-Neutral Package Organization Plan

## Goal

Retire `ARCHITECTURE_CLEANUP_CHECKLIST.md` item `FCP-24` by source-auditing exactly these FCP source findings and executing only the currently source-proven behavior-neutral organization work:

- `FCP-24-SF1`
- `FCP-24-SF2`
- `FCP-24-SF3`
- `FCP-24-SF4`

Current source admits implementation only for `FCP-24-SF4`: EPG package-local callers still import through `../view` and `../runtime` subfolder barrels. The ready-now work is direct leaf import reconciliation and removal of those subfolder barrel files if the replacement audit proves no remaining consumers.

Current source source-disproves production/test implementation for `FCP-24-SF1` and `FCP-24-SF2`. Navigation and Plex stream already match the completed `FCP-18`/`FCP-19` owner-folder shapes. Channel-manager remains flat and no folder movement is admitted, but `FCP-24-SF3` is not a pure source-disproved claim: current source has external production direct imports from `scheduler/channel-manager/constants` and `scheduler/channel-manager/types`. This plan accepts those as existing package-surface exceptions only when the refreshed SF3 audit proves they are stable domain constant/type reads, not a reason for public export widening, shims, barrels, or behavior-neutral folder churn.

## Non-Goals

- Do not implement production or test code from this planning pass.
- Do not mark `FCP-24` in progress or complete in `ARCHITECTURE_CLEANUP_CHECKLIST.md` from this planning pass.
- Do not start or plan `FCP-25`, Windows platform work, visual redesign, runtime/playback/Plex auth cleanup, scheduler/channel-manager/content behavior cleanup, UI workflow/presenter cleanup, or broader post-FCP cleanup.
- Do not reopen completed `FCP-18`, `FCP-19`, `FCP-22`, or `FCP-23` unless fresh current source proves distinct live residue inside this FCP-24 package-organization seam.
- Do not change behavior, public APIs, persistence schemas/keys, token/redaction policy, playback URLs, scheduler/channel semantics, navigation behavior, EPG visual/focus/ticker/virtualizer behavior, platform policy, or documented user-facing behavior.
- Do not add compatibility shims, old-path wrappers, root barrels, package barrels, subfolder barrels, public export widening, fallback paths, new dependencies, or speculative helper abstractions.

## Parent Priority Alignment

`FCP-24` is the next safe package after completed `FCP-23`. `FCP-25` remains blocked until `FCP-24` has clean closeout evidence.

This package is behavior-neutral package organization only. It exists to catch remaining organization residue after `FCP-21` through `FCP-23`; it is not a license for foldering-only churn. No-code/source-disproved dispositions are allowed only with positive current-source proof that the finding is false or that organization would not reduce port review risk.

Baseline guardrails:

- `FCP-18` completed navigation package organization into `contracts/`, `manager/`, `input/`, `coordinator/`, `handlers/`, and `config/`.
- `FCP-19` completed Plex stream package organization into `resolver/`, `contracts/`, `pipeline/`, `url/`, `policy/`, and `diagnostics/`.
- `FCP-22` completed broadened scheduler/channel-manager/content owner-shape proof and source-disproved standalone channel-manager organization for that package, but `FCP-24-SF3` must still audit and account for current external `constants`/`types`/`interfaces` direct imports before execution-unit selection.
- `FCP-23` completed channel setup workflow ownership and source-disproved EPG view organization for FCP-23 only, while leaving later behavior-neutral EPG organization to `FCP-24-SF4` if source-proven.

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
   - `FCP-13` through `FCP-24` baseline/current context
   - `FCP-25` only as sequencing blocker
8. `docs/architecture/CURRENT_STATE.md`
9. `docs/architecture/modules.md`
10. Completed guardrail plans:
    - `docs/plans/2026-05-05-fcp-18-behavior-neutral-navigation-package-organization-plan.md`
    - `docs/plans/2026-05-05-fcp-19-behavior-neutral-plex-stream-package-organization-plan.md`
    - `docs/plans/2026-05-05-fcp-21-port-runtime-playback-plex-auth-readiness-plan.md`
    - `docs/plans/2026-05-05-fcp-22-port-scheduler-channel-content-owner-shape-replan.md`
    - `docs/plans/2026-05-05-fcp-22-port-scheduler-channel-content-readiness-plan.md` as older partial evidence only
    - `docs/plans/2026-05-05-fcp-23-port-ui-workflow-readiness-plan.md`
11. Completed `FCP-7` through `FCP-17` and `FCP-20` plans only if current audit claims a compact checklist baseline is false.
12. `docs/api/plex-integration.md` only as the `FCP-24-SF2` Plex stream guardrail unless source audit contradicts this plan and replans Plex stream work.
13. This plan.
14. Source and test files named under `## Files In Scope`.
15. `git status --short --branch`.

Freshness gate: stop and refresh this plan if any `FCP-24` checklist text, completed `FCP-18`/`FCP-19`/`FCP-22`/`FCP-23` closeout truth, current architecture ownership text, EPG view/runtime package imports, or public package export surfaces changed materially after 2026-05-06.

Planning observed branch state from the controller prompt: `code-health...origin/code-health` ahead 8 with pre-existing dirty/untracked paths in workflow docs, archived DCR docs, `scorecard.png`, and one eval baseline summary. Preserve those paths unless a fresh audit proves direct FCP-24 overlap.

## Required Skills

- `architecture-boundaries`: required because this package evaluates module/package organization seams and public import surfaces.
- `verification-strategy`: required to freeze behavior-neutral proof depth and no-code source-disproof criteria.
- `execution-plan-authoring`: required for this Tier 3 source-backed FCP plan.
- `ui-composition-patterns`: required because the only admitted implementation touches EPG UI package import surfaces. No visual, focus, motion, layout, or TV-visible behavior change is approved.

Do not load `plex-integration-boundaries` unless `FCP-24-SF2` is contradicted and Plex stream files are admitted beyond read-only audit. Do not load `persistence-boundaries` unless `FCP-24-SF3` is contradicted and channel-manager persistence/storage owner files are admitted for source edits. Do not load `debugging-remediation` unless source audit proves a concrete bug or regression. Do not use `frontend-design` or `interface-design`.

## Codanna Discovery

- `get_index_info`: Codanna index contained 12,086 symbols across 802 files and 14,177 relationships. Semantic search was enabled with `JinaEmbeddingsV2BaseCode`, 336 embeddings, created/updated about 59 minutes before this planning pass.
- `search_documents "FCP-24 Behavior-Neutral Package Organization source findings navigation Plex stream channel-manager EPG package organization checklist"`: noisy and did not return the authoritative checklist. Deterministic fallback used direct reads of `ARCHITECTURE_CLEANUP_CHECKLIST.md`.
- `search_documents "FCP-18 FCP-19 FCP-21 FCP-22 FCP-23 completed baseline package organization navigation Plex stream scheduler EPG"`: noisy eval/DCR hits, not the completed FCP plans. Deterministic fallback used direct reads of the completed plan files named in `## Required Reading`.
- `search_documents "CURRENT_STATE modules navigation Plex stream channel-manager EPG package owners no root barrel no shim"`: noisy historical-plan hits. Deterministic fallback used direct reads of `docs/architecture/CURRENT_STATE.md` and `docs/architecture/modules.md`.
- `semantic_search_with_context "navigation package organization contracts manager input coordinator handlers config no shim barrel public seam index NavigationManager"`: confirmed current navigation owner folders and `NavigationManager` at `src/modules/navigation/manager/NavigationManager.ts`.
- `semantic_search_with_context "Plex stream package organization resolver contracts pipeline url policy diagnostics no shim barrel PlexStreamResolver UniversalTranscodeDecisionClient"`: confirmed current `PlexStreamResolver` at `src/modules/plex/stream/resolver/PlexStreamResolver.ts`; result set was partly noisy with scheduler `ContentResolver`, so direct tree reads remain the path authority.
- `semantic_search_with_context "scheduler channel-manager package organization ChannelManager ContentResolver ChannelPersistenceStore public facade no shim barrel"`: surfaced `ChannelManager.resolveChannelItemsForSchedule`, `ChannelManagerState`, `loadChannels`, and public facade impacts into EPG/initialization.
- `semantic_search_with_context "EPG view package organization EPGCellRenderer EPGCellPresentation EPGVirtualizer view index package seam no barrel"`: surfaced `EPGVirtualizer`, `CellRenderData`, and EPG view/presentation relationships.
- `analyze_impact ChannelManager`: returned no impacted symbols, a Codanna reverse-impact gap for this public facade. Direct `rg` shows broad imports through `src/modules/scheduler/channel-manager`.
- `analyze_impact ContentResolver`: impact only to `ChannelManager`.
- `analyze_impact ChannelPersistenceStore`: impacts `ChannelPersistenceCoordinator`, `ChannelRepository`, and a `ChannelRepository.test.ts` helper.
- Review follow-up direct `rg` for `scheduler/channel-manager/(constants|types|interfaces)` found external production direct imports including `src/core/channel-setup/planning/ChannelSetupPlanner.ts`, `src/core/channel-setup/persistence/ChannelSetupRecordStore.ts`, `src/core/channel-setup/config/normalizeChannelSetupConfig.ts`, `src/modules/ui/channel-setup/ChannelSetupWorkflowPresenter.ts`, `src/modules/ui/channel-setup/ChannelSetupSessionState.ts`, `src/modules/ui/channel-setup/steps/StrategyStepController.ts`, `src/modules/ui/common/channelBrandingIcons.ts`, `src/modules/ui/mini-guide/types.ts`, scheduler shared files, and scheduler scheduler types. This invalidated the earlier no-code proof wording that claimed external callers only use the package seam.
- `analyze_impact EPGVirtualizer`: impact to `EPGComponent`.
- `analyze_impact EPGCellRenderer`: returned no impacts, a Codanna gap contradicted by direct source showing `EPGVirtualizer` constructs it.
- `analyze_impact EPGScheduleRefreshRuntime` and `EPGVisibleRangeRefreshQueue`: impacts `EPGRefreshController` and `EPGCoordinator`.
- `analyze_impact EPGGridRuntimeController`: impact to `EPGComponent`.
- `analyze_impact EPGFocusNavigator`: impact to `EPGComponent`.
- Direct `find`, `rg`, and source reads were required for exact path/import evidence, subfolder barrel detection, and no-shim/no-barrel audits because Codanna is symbol-oriented and was noisy for document and file-path queries.

## Impact Snapshot

Current-source proof:

- `FCP-24-SF1` is source-disproved/no-code. `src/modules/navigation/` already has the completed `FCP-18` organization: `contracts/`, `manager/`, `input/`, `coordinator/`, `handlers/`, `config/`, root `index.ts` as the existing public package seam, and tests under `__tests__/`. The old flat leaf import audit for `Navigation*`, `RemoteHandler`, `FocusManager`, `ScreenNavigationPorts`, `interfaces`, `constants`, and `nonBlockingFailureTimestamps` returned no remaining old flat-path hits.
- `FCP-24-SF2` is source-disproved/no-code. `src/modules/plex/stream/` already has the completed `FCP-19` organization: `resolver/`, `contracts/`, `pipeline/`, `url/`, `policy/`, `diagnostics/`, root `index.ts` as the existing public package seam, and tests under `__tests__/`. The old flat stream leaf import audit for resolver, policy, diagnostics, contracts, pipeline, and URL files returned no remaining old flat-path hits. `docs/api/plex-integration.md` names current contract paths under `contracts/`.
- `FCP-24-SF3` is no-code with accepted package-surface exceptions, not a source-disproved direct-import proof. `src/modules/scheduler/channel-manager/` remains flat, but current source does not prove behavior-neutral foldering reduces port risk enough to justify churn after `FCP-22`. External callers mostly use the existing public package seam `src/modules/scheduler/channel-manager/index.ts`, but current source also has external production direct imports from `constants` and `types`, especially channel-setup planning/UI limit reads such as `DEFAULT_CHANNEL_SETUP_MAX` and type-only UI/scheduler reads such as `BuildStrategy` and `ResolvedContentItem`. Those imports are accepted only if the implementation-time SF3 audit confirms they are stable domain constant/type reads with final owner `src/modules/scheduler/channel-manager/{constants.ts,types.ts,interfaces.ts}` and no behavior, storage, facade, or export-surface change is needed. `FCP-22` already assigned final owners for persistence, facade, content resolution, cache/coalescing, mapping, selection policy, playback ordering, and standalone organization residue. Current audit found no shims, old-path wrappers, or maintainer-approved public export widening that would make channel-manager organization ready now.
- `FCP-24-SF4` is source-active in a narrow way. EPG is already organized into `component/`, `coordinator/`, `debug/`, `focus/`, `model/`, `runtime/`, `startup/`, and `view/`, so no broad EPG folder move is approved. However, current source still has package-local subfolder barrels:
  - `src/modules/ui/epg/view/index.ts`
  - `src/modules/ui/epg/runtime/index.ts`
  - callers import through `../view` from `EPGComponent.ts`, `EPGFocusNavigator.ts`, and `EPGGridRuntimeController.ts`
  - `EPGRefreshController.ts` imports through `../runtime`
- The approved `FCP-24-SF4` work is to replace those internal barrel imports with direct leaf imports and delete the subfolder barrel files if no consumers remain. It must not move EPG view/runtime files, widen `src/modules/ui/epg/index.ts`, alter EPG behavior, or change visual/focus/ticker/virtualizer contracts.

## Package Decomposition

- `package_id`: `FCP-24`
- `checklist_token`: `FCP-24`
- `source_finding_ids`:
  - `FCP-24-SF1`
  - `FCP-24-SF2`
  - `FCP-24-SF3`
  - `FCP-24-SF4`

`slice_table`:

| slice_id | goal | areas/files | source_finding_ids | verification | dependencies | stop_condition | handoff_condition | serial_only | parallel_justification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FCP-24-S1` | Reconfirm navigation organization is source-disproved/no-code after completed `FCP-18`. | Read-only audit over `src/modules/navigation/**`, navigation public seam, old flat path patterns, architecture path truth. | `FCP-24-SF1` | Navigation path/export/no-shim audits; targeted navigation tests only if audit contradicts no-code and a refreshed plan admits work. | None. | Stop if current navigation source has old flat paths, shims, subfolder barrels, public export widening, or reviewability risk not covered by `FCP-18`. | `FCP-24-SF1` remains source-disproved/no-code with final owner `FCP-18` baseline/navigation package owner, or this plan is refreshed. | true | This is read-only proof inside the same package closeout wave. |
| `FCP-24-S2` | Reconfirm Plex stream organization is source-disproved/no-code after completed `FCP-19`. | Read-only audit over `src/modules/plex/stream/**`, stream public seam, old flat path patterns, API/architecture path truth. | `FCP-24-SF2` | Plex stream path/export/no-shim audits; targeted Plex stream/policy/resolver/diagnostics tests and API docs verification only if audit contradicts no-code and a refreshed plan admits work. | S1 audit complete. | Stop if current Plex stream source has old flat paths, shims, subfolder barrels, public export widening, token/redaction path risk, or reviewability risk not covered by `FCP-19`. | `FCP-24-SF2` remains source-disproved/no-code with final owner `FCP-19` baseline/Plex stream package owner, or this plan is refreshed. | true | Plex stream is no-code unless contradicted; serial audit avoids reopening completed stream work casually. |
| `FCP-24-S3` | Reconfirm channel-manager package organization is no-code after completed `FCP-22`, while explicitly auditing and accounting for external `constants`/`types`/`interfaces` direct imports. | Read-only audit over `src/modules/scheduler/channel-manager/**`, public seam imports, external direct leaf imports, package-internal leaf imports, tests, and architecture path truth. | `FCP-24-SF3` | Channel-manager path/export/no-shim audits, including external direct imports from `constants`, `types`, and `interfaces`; targeted channel-manager/channel-setup tests only if audit contradicts no-code and a refreshed plan admits work. | S2 audit complete. | Stop if source proves package organization reduces port risk without public facade churn, if direct leaf imports cannot be source-justified as stable domain constant/type/interface reads, if public export widening is proposed, or if persistence/storage owner files must move. | `FCP-24-SF3` remains no-code with accepted direct-leaf package-surface exceptions and one final owner/revisit trigger, or this plan is refreshed with `persistence-boundaries` if storage owner files are admitted. | true | Channel-manager organization is a no-code disposition unless current source contradicts `FCP-22`; parallel work would duplicate owner accounting. |
| `FCP-24-S4` | Remove EPG package-local subfolder barrel import surfaces by replacing `../view` and `../runtime` imports with direct leaf imports, deleting those subfolder barrel files only if the no-consumer audit is clean. | `src/modules/ui/epg/component/EPGComponent.ts`; `src/modules/ui/epg/focus/EPGFocusNavigator.ts`; `src/modules/ui/epg/runtime/EPGGridRuntimeController.ts`; `src/modules/ui/epg/coordinator/EPGRefreshController.ts`; `src/modules/ui/epg/view/index.ts`; `src/modules/ui/epg/runtime/index.ts`; affected EPG tests only for import reconciliation. | `FCP-24-SF4` | EPG old/replacement import audits; no subfolder barrel/no-shim audit; circular/type-only dependency audit; targeted EPG view/component/virtualizer/focus tests; `npm run typecheck`; `git diff --check`; `npm run verify`; docs gates as applicable. | S1-S3 no-code audits complete so the implementation wave does not absorb unrelated package findings. | Stop if direct imports require behavior changes, file moves, new barrels, public EPG export widening, visual/focus/ticker/virtualizer changes, or broader EPG package reorganization. | `FCP-24-SF4` is resolved behavior-neutrally; no `../view` or `../runtime` imports remain; subfolder barrel files are deleted or source-justified if retained; tests and gates pass. | true | This is the only source-active implementation slice and shares closeout accounting with the no-code audits. |

`coverage_check`:

- `FCP-24-SF1` maps exactly once to `FCP-24-S1`. Planned disposition: source-disproved/no-code. Final owner: completed `FCP-18` navigation package organization baseline. Revisit trigger: source audit finds navigation old flat paths, shims/barrels, public export widening, or reviewability risk distinct from `FCP-18`.
- `FCP-24-SF2` maps exactly once to `FCP-24-S2`. Planned disposition: source-disproved/no-code. Final owner: completed `FCP-19` Plex stream package organization baseline. Revisit trigger: source audit finds Plex stream old flat paths, shims/barrels, public export widening, API path drift, token/redaction review risk, or reviewability risk distinct from `FCP-19`.
- `FCP-24-SF3` maps exactly once to `FCP-24-S3`. Planned disposition: no-code with accepted direct-leaf package-surface exceptions, not source-disproved direct-import absence. Final owners: completed `FCP-22` scheduler/channel-manager/content owner-shape baseline for the facade/content/persistence split; `src/modules/scheduler/channel-manager/constants.ts` for channel-domain constants including `DEFAULT_CHANNEL_SETUP_MAX`; `src/modules/scheduler/channel-manager/types.ts` for stable channel domain types such as `BuildStrategy` and `ResolvedContentItem`; `src/modules/scheduler/channel-manager/interfaces.ts` for public channel-manager interfaces. Revisit trigger: source audit proves the flat package layout blocks port reviewability after `FCP-22`, a direct leaf import needs behavior/persistence coupling rather than stable constant/type/interface access, public export widening is maintainer-approved, or a future owner-shape change creates a behavior-neutral organization need.
- `FCP-24-SF4` maps exactly once to `FCP-24-S4`. Planned disposition: active behavior-neutral implementation. Final owner: EPG package organization owner under `src/modules/ui/epg/**`, with `EPGComponent`, `EPGFocusNavigator`, `EPGGridRuntimeController`, and `EPGRefreshController` importing direct leaf owners instead of subfolder barrels. Revisit trigger: source audit proves broader EPG movement, visual/focus/ticker/virtualizer behavior, or public EPG package-seam change is required.
- No source finding is deferred solely because the correct cleanup would be large.
- No detector/imported/package-map/Desloppify id maps into FCP-24 coverage.
- Replan is required before admitting a new `source_finding_id`, changing final-owner accounting, widening implementation beyond `FCP-24-S4`, or splitting any source finding across multiple execution units.

`execution_waves`:

| wave_id | slice_ids | completion_condition | absorb_now_scope | replan_triggers |
| --- | --- | --- | --- | --- |
| `FCP-24-W1` | `FCP-24-S1`, `FCP-24-S2`, `FCP-24-S3`, `FCP-24-S4` | S1-S2 source-disproved audits remain true; S3 records accepted direct-leaf package-surface exceptions with one final owner/revisit trigger and no implementation need; S4 removes or source-justifies EPG `view`/`runtime` subfolder barrels without behavior changes; package-local audits, targeted EPG tests, `npm run typecheck`, `git diff --check`, `npm run verify`, `npm run plans:check`, and applicable docs verification pass; clean review approves closeout. | Only path/import residue inside the same four FCP-24 source findings, same final owners, same files, and same verification envelope. | Any stop condition in the seam gate; navigation/Plex/channel-manager implementation need; storage/Plex/runtime/scheduler/UI behavior change; public export widening; subfolder/root/package barrel need; changed source-finding membership; broader EPG organization or visual/focus/ticker/virtualizer change. |

`coverage_ledger`:

| source_finding_id | execution_unit | planned disposition | final owner before closeout |
| --- | --- | --- | --- |
| `FCP-24-SF1` | `FCP-24-W1` / `FCP-24-S1` | Source-disproved/no-code. | Completed `FCP-18` navigation package owner. |
| `FCP-24-SF2` | `FCP-24-W1` / `FCP-24-S2` | Source-disproved/no-code. | Completed `FCP-19` Plex stream package owner. |
| `FCP-24-SF3` | `FCP-24-W1` / `FCP-24-S3` | No-code with accepted direct-leaf package-surface exceptions. | Completed `FCP-22` scheduler/channel-manager/content owner-shape owner plus `channel-manager/constants.ts`, `types.ts`, and `interfaces.ts` for stable domain exports. |
| `FCP-24-SF4` | `FCP-24-W1` / `FCP-24-S4` | Active behavior-neutral implementation. | EPG package organization owner under `src/modules/ui/epg/**`. |

- `ready_now_execution_unit`: `FCP-24-W1`
- `ready_now_slice`: `FCP-24-S1`
- `recommended_slice_order`:
  1. `FCP-24-S1`
  2. `FCP-24-S2`
  3. `FCP-24-S3`
  4. `FCP-24-S4`
- `parallel_execution_policy`: serial only. The approved execution unit combines three no-code proof slices with one narrow EPG import-surface implementation slice; parallel workers would duplicate final-owner accounting and risk reopening completed package baselines.

Controller gate before `execution-unit-select`: do not enter implementation until this active plan has same-reviewer closure check, fresh final plan approval, and the controller selects `ready_now_execution_unit` `FCP-24-W1`. The first active implementation work inside that unit is `FCP-24-S4` only after S1-S2 audits still source-disprove their findings and S3 records accepted direct-leaf exceptions with one final owner/revisit trigger.

## Files In Scope

Planner write scope for this pass:

- `docs/plans/2026-05-06-fcp-24-behavior-neutral-package-organization-plan.md`

Future `FCP-24-W1` implementation scope after clean plan review:

- `src/modules/ui/epg/component/EPGComponent.ts`
- `src/modules/ui/epg/focus/EPGFocusNavigator.ts`
- `src/modules/ui/epg/runtime/EPGGridRuntimeController.ts`
- `src/modules/ui/epg/coordinator/EPGRefreshController.ts`
- `src/modules/ui/epg/view/index.ts`
- `src/modules/ui/epg/runtime/index.ts`
- EPG tests affected only by direct import reconciliation:
  - `src/modules/ui/epg/__tests__/EPGComponent.test.ts`
  - `src/modules/ui/epg/__tests__/EPGFocusNavigator.test.ts`
  - `src/modules/ui/epg/__tests__/EPGGridRuntimeController.test.ts`
  - `src/modules/ui/epg/__tests__/EPGRefreshController.test.ts`
  - `src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts`
  - `src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts`
  - `src/modules/ui/epg/view/__tests__/index.test.ts` only if retained or deleted index behavior needs reconciliation
  - `src/modules/ui/epg/runtime/__tests__/index.test.ts` only if retained or deleted index behavior needs reconciliation
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` only during later closeout after clean review and verification.
- `docs/architecture/CURRENT_STATE.md` and `docs/architecture/modules.md` only if the implementation changes tracked path truth. Direct import changes alone are not expected to require architecture docs.

Read-only audit scope:

- `src/modules/navigation/**`
- `src/modules/plex/stream/**`
- `src/modules/scheduler/channel-manager/**`
- `src/modules/ui/epg/**`
- `docs/api/plex-integration.md` as SF2 guardrail only.

## Files Out Of Scope

- Any production or test source change during this planner pass.
- Navigation production/test/doc changes unless `FCP-24-SF1` is contradicted and this plan is refreshed.
- Plex stream production/test/API doc changes unless `FCP-24-SF2` is contradicted and this plan is refreshed with `plex-integration-boundaries`.
- Channel-manager production/test/doc changes unless `FCP-24-SF3` is contradicted and this plan is refreshed; persistence/storage files remain read-only in this plan.
- EPG file moves, broad EPG folder reorganization, public `src/modules/ui/epg/index.ts` export widening, visual changes, focus behavior changes, ticker behavior changes, reduced-motion behavior changes, virtualizer behavior changes, CSS changes, runtime data behavior changes, and package seams outside the named EPG files.
- Compatibility shims, old-path wrappers, root/package barrels, subfolder barrels, public API widening, public export widening, fallback import paths, and circular dependencies.
- Completed `FCP-18`, `FCP-19`, `FCP-21`, `FCP-22`, and `FCP-23` implementation work except as read-only guardrails.
- Pre-existing unrelated dirty/untracked workspace paths from the controller gate evidence.

## Planner Self-Check

1. No unresolved source-finding coverage remains: every `FCP-24-SF*` maps exactly once in `coverage_check`.
2. Adjacent contract changes are explicit: public navigation, Plex stream, channel-manager, and EPG package seams are frozen unless a stop/replan trigger fires.
3. Files out of scope are not hidden implementation dependencies. EPG implementation is limited to direct import reconciliation and possible deletion of no-consumer subfolder barrel files.
4. Codanna evidence and insufficiencies are recorded, including noisy document search and reverse-impact gaps for `ChannelManager`, `EPGCellRenderer`, and `EPGComponent`.
5. The plan uses repo-preferred owners and does not grow hotspots: navigation and Plex remain closed baselines, channel-manager remains no-code under `FCP-22` proof plus accepted `constants`/`types`/`interfaces` direct-leaf owner accounting, and EPG direct imports keep ownership at existing leaf files.
6. A fresh cleanup-loop session can start `ready_now_execution_unit` `FCP-24-W1` without deciding package membership, final owners, parallelism, or verification depth.
7. This is execution-grade at seam/scope/verification level and deliberately leaves local import ordering to the future worker.

## Architecture Seam Decision Gate

Approved seam:

- Execute one serial execution unit, `FCP-24-W1`.
- Treat `FCP-24-S1` and `FCP-24-S2` as read-only source-disproved proof slices. Treat `FCP-24-S3` as a read-only no-code/accepted-exception proof slice that must account for external `constants`/`types`/`interfaces` direct imports before implementation starts.
- Treat `FCP-24-S4` as direct import-surface cleanup only:
  - replace `../view` imports with direct leaf imports from `../view/<OwnerFile>`;
  - replace `../runtime` imports with direct leaf imports from `../runtime/<OwnerFile>`;
  - delete `src/modules/ui/epg/view/index.ts` and `src/modules/ui/epg/runtime/index.ts` only if `rg` proves no consumers remain;
  - update or remove index tests only to match retained/deleted import surfaces.
- Keep `src/modules/ui/epg/index.ts` frozen except if a source audit proves a path-truth doc/test update is necessary. No new public exports.
- Keep EPG runtime/view behavior unchanged. This plan does not authorize file moves, class extraction, visual changes, focus changes, timer changes, reduced-motion changes, virtualizer changes, or scheduler data changes.

Stop and replan if:

- any navigation, Plex stream, or channel-manager implementation is needed;
- SF3 direct leaf imports expand beyond source-justified stable domain constants/types/interfaces, or the audit proves public export widening is the only acceptable way to retire them;
- any public export widening, compatibility shim, old-path wrapper, root barrel, package barrel, or subfolder barrel is needed;
- direct import reconciliation creates circular dependencies, including type-only cycles;
- EPG implementation requires file moves, broader package reorganization, behavior changes, visual/focus/ticker/reduced-motion/virtualizer changes, or new tests that probe private internals;
- Plex token/redaction, stream URL, playback, scheduler/channel-manager behavior, persistence/storage, selected-server, app-shell, Orchestrator, navigation, platform, or Windows behavior becomes implicated;
- current source disproves a completed baseline claim from `FCP-18`, `FCP-19`, `FCP-22`, or `FCP-23`;
- source finding membership, final-owner accounting, execution-unit membership, or verification surface changes.

Absorb-now rule: absorb only newly discovered path/import residue that stays within `FCP-24-W1`'s approved source findings, files, final owners, and verification envelope. Replan for any new owner or wider behavior surface.

## Verification Commands

Verification strategy classification: `broader integration/manual proof required`.

Primary verification mode: `refactor-invariance`, with source-audit proof for S1-S2, accepted-exception proof for S3, and targeted EPG tests for S4. New automated tests are not expected unless direct import reconciliation exposes an uncovered public EPG seam or the refreshed SF3 audit contradicts no-code; do not add tests that lock private implementation structure.

Plan validation:

1. `npm run plans:check`
   - Expected: this active tracked plan satisfies Universal Plan Core, cleanup overlay, FCP source-backed ids, `coverage_check`, `execution_waves`, `coverage_ledger`, `ready_now_execution_unit`, and `ready_now_slice`.
2. `npm run verify:docs`
   - Expected: docs/control-plane verification passes for this active plan. Run again after any checklist, architecture, API, or plan docs change.

Package-local source audits before implementation:

1. Navigation no-code audit for `FCP-24-SF1`:
   - `find src/modules/navigation -maxdepth 3 -type f | sort`
   - `rg -n "modules/navigation/(Navigation|RemoteHandler|FocusManager|ScreenNavigationPorts|interfaces|constants|nonBlockingFailureTimestamps)|\\.\\./(\\.\\./)*navigation/(Navigation|RemoteHandler|FocusManager|ScreenNavigationPorts|interfaces|constants|nonBlockingFailureTimestamps)" src --glob "*.ts"`
   - Expected: current owner folders match `FCP-18`; no old flat leaf imports, shims, subfolder barrels, or public export widening. If work is admitted, run targeted navigation tests from the completed FCP-18 plan and refresh this plan first.
2. Plex stream no-code audit for `FCP-24-SF2`:
   - `find src/modules/plex/stream -maxdepth 3 -type f | sort`
   - `rg -n "modules/plex/stream/(PlexStreamResolver|PlexStreamSubtitleDebugLogPort|SubtitleStreamDebugProbeCoordinator|SubtitleStreamProbe|SubtitleStreamProbeSupport|UniversalTranscodeDecisionClient|constants|dvHdr10Fallback|hdr|interfaces|mediaSelectionPolicy|playbackCompatibilityPolicy|plexSessionId|plexStreamUrlPolicy|plexSubtitleFallbackPolicy|resolveStreamPipeline|streamMimeType|subtitleDeliveryPolicy|types)(['\"?#]|$)" src --glob "*.ts"`
   - Expected: current owner folders match `FCP-19`; API docs point at current contract paths; no old flat leaf imports, shims, subfolder barrels, public export widening, or token/redaction drift. If work is admitted, run targeted Plex stream/policy/resolver/diagnostics tests plus API/docs verification and refresh this plan first.
3. Channel-manager no-code audit for `FCP-24-SF3`:
   - `find src/modules/scheduler/channel-manager -maxdepth 2 -type f | sort`
   - `rg -n "scheduler/channel-manager/(constants|types|interfaces)|from ['\"][^'\"]*scheduler/channel-manager/(constants|types|interfaces)['\"]|from ['\"][^'\"]*\\.\\.?/[^'\"]*channel-manager/(constants|types|interfaces)['\"]" src --glob "*.ts"`
   - `rg -n "scheduler/channel-manager/(ContentResolver|SourceResolutionCache|ContentItemMapper|ContentSelectionPolicy|ChannelResolutionCache|ChannelManager|ChannelPersistenceStore|ChannelRepository)|from './(ContentResolver|ContentSelectionPolicy|SourceResolutionCache|ContentItemMapper|ChannelManager|ChannelPersistenceStore|ChannelRepository)'|export .*from './(ContentResolver|ContentSelectionPolicy|SourceResolutionCache|ContentItemMapper|ChannelManager|ChannelPersistenceStore|ChannelRepository)'" src --glob "*.ts"`
   - Expected: external direct leaf imports from `constants`, `types`, and `interfaces` are recorded and either source-justified as stable domain constant/type/interface reads with one final owner and revisit trigger, or this plan is refreshed before execution. No shims, old-path wrappers, public export widening, folder movement, persistence/storage movement, or source-proven foldering need is admitted by this plan. If work is admitted, load `persistence-boundaries` if storage files move and run targeted channel-manager/channel-setup tests after refreshing this plan.
4. EPG implementation audit for `FCP-24-SF4`:
   - `rg -n "from '../view'|from '../runtime'|from './view'|from './runtime'|export .*from './(view|runtime)'" src/modules/ui/epg --glob "*.ts"`
   - `find src/modules/ui/epg -path '*/index.ts' | sort`
   - `rg -n "export .*from './|export type .*from './" src/modules/ui/epg --glob "index.ts"`
   - Expected before: only the known `../view` and `../runtime` internal imports plus `view/index.ts` and `runtime/index.ts` subfolder barrels. Expected after: no `../view` or `../runtime` imports remain; `view/index.ts` and `runtime/index.ts` are deleted if no consumers remain, or their retention is source-justified.

Replacement-path and dependency audits after S4:

1. `rg -n "from '../view'|from '../runtime'|from './view'|from './runtime'|export .*from './(view|runtime)'" src/modules/ui/epg --glob "*.ts"`
   - Expected: no internal EPG barrel imports or re-exports through `view`/`runtime` subfolder indexes remain unless explicitly source-justified.
2. `rg -n "from ['\"][^'\"]*ui/epg/view['\"]|from ['\"][^'\"]*ui/epg/runtime['\"]" src --glob "*.ts"`
   - Expected: no external direct imports through EPG subfolder barrels.
3. Inspect direct imports in touched files.
   - Expected: imports name leaf owners such as `EPGVirtualizer`, `EPGTimeHeader`, `EPGChannelList`, `EPGErrorBoundary`, `EPGInfoPanel`, `EPGInfoPanelCoordinator`, `EPGLibraryTabs`, `EPGVisibleRangeEmitter`, `EPGShellView`, `EPGScheduleRefreshRuntime`, and `EPGVisibleRangeRefreshQueue` from their owning leaf files.
4. Circular/type-only dependency audit:
   - Expected: no new runtime or type-only cycles are introduced. Use `npm run typecheck` as the hard gate and inspect any new reciprocal imports manually.
5. Path-truth docs audit:
   - Expected: no architecture/API docs change is needed if only imports change. If any tracked doc names deleted `view/index.ts` or `runtime/index.ts`, update that path truth and rerun docs verification.

Targeted tests for admitted `FCP-24-SF4` work:

1. `npm test -- EPGComponent EPGFocusNavigator EPGGridRuntimeController EPGRefreshController EPGVirtualizer`
   - Expected: EPG component composition, focus navigation, grid runtime, refresh runtime wiring, and virtualizer behavior remain unchanged.
2. `npm test -- --runInBand src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts`
   - Expected: EPG renderer DOM, width tier, sliver, text metrics, focused episode/movie, live/progress, placeholder/reset, reduced-motion, and ticker behavior remain stable.
3. `npm test -- --runInBand src/modules/ui/epg/view/__tests__/index.test.ts src/modules/ui/epg/runtime/__tests__/index.test.ts`
   - Expected: run only if those index files remain or their tests are updated/deleted as part of the approved barrel-removal cleanup; otherwise record deletion/no-consumer proof.

Package-level gates:

1. `npm run typecheck`
   - Expected: no TypeScript errors after direct import reconciliation.
2. `git diff --check`
   - Expected: no whitespace errors.
3. `npm run verify`
   - Expected: full verification passes before closeout because FCP-24 includes UI package organization work.
4. `npm run verify:docs`
   - Expected: required after checklist, architecture, API, or plan docs changes.

Closeout source review:

- For every `FCP-24-SF*`, record whether the original source finding is resolved, source-disproved, deferred, or accepted with one owner and revisit trigger.
- Confirm no detector/imported/Desloppify ids were used for coverage.
- Confirm no root/package/subfolder barrels, shims, old-path wrappers, public export widening, or behavior changes were introduced.
- Confirm `FCP-25` remains blocked until FCP-24 closeout evidence and clean review are recorded by the controller.

## Rollback Notes

Rollback for this planning pass is docs-only: remove or revise `docs/plans/2026-05-06-fcp-24-behavior-neutral-package-organization-plan.md`.

Rollback for future `FCP-24-S4` implementation is import-surface only:

- Revert direct import changes in the four touched EPG callers if typecheck or targeted tests fail.
- Restore `src/modules/ui/epg/view/index.ts` or `src/modules/ui/epg/runtime/index.ts` only if a required consumer remains and direct leaf imports cannot be made without a replan.
- Do not patch around failures by adding compatibility barrels, fallback imports, public exports, or behavior changes.

## Commit Checkpoints

- Planning artifact checkpoint: commit only `docs/plans/2026-05-06-fcp-24-behavior-neutral-package-organization-plan.md` if the controller wants a tracked-doc checkpoint after validation/review.
- Implementation checkpoint: after `FCP-24-W1` completes, targeted tests, source audits, `npm run typecheck`, `git diff --check`, `npm run verify`, and clean implementation review pass, create one focused non-interactive implementation commit for production/test changes. Exclude active tracked plan docs unless the controller explicitly commits plan progress separately.
- Closeout checkpoint: after clean implementation review and required verification, update `ARCHITECTURE_CLEANUP_CHECKLIST.md` and any required architecture/API docs in a separate controller-owned closeout pass if implementation commits already exist.
- Do not mark `FCP-24` in progress or complete until the future controller observes closeout evidence and performs the checklist update in that same pass.
