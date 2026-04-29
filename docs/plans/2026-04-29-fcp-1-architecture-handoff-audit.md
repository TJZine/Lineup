# FCP-1 Architecture And Handoff Coherence Audit

## Purpose And Scope

This is the durable source-backed audit companion for `FCP-1` Architecture And Handoff Coherence.

Purpose:

- track the repo-wide architecture/handoff coverage inspected for `FCP-1`
- record source-backed candidates found so far
- distinguish ready package findings, deferred FCP-1 findings, accepted/no-action areas, and out-of-FCP-1 areas
- prevent the active execution plan from becoming the only memory surface for audited areas and possible misses

Scope:

- composition roots and startup/runtime wiring
- hotspot modules named by current architecture docs
- module boundary docs
- root/package exports
- cross-module handoffs
- Orchestrator initialization and runtime assembly
- server-selection handoff
- navigation/UI coordination where it creates architecture ownership risk
- Plex/player/scheduler seams where relevant to architecture/handoff ownership

Evidence rule: this audit uses current source, current tracked docs, targeted source/import audits, and direct source reads. It does not use Desloppify, imported issue, package map, detector, or score evidence as intake, proof, prioritization, or closure.

## Audit Freshness And Update Rule

This audit was created for the 2026-04-29 `FCP-1` planning pass.

Update this file when:

- a future `FCP-1` package is planned
- a future `FCP-1` package closes
- plan review identifies a missing source-backed FCP-1 candidate
- source changes materially alter a listed candidate, accepted/no-action area, owner, closure condition, or revisit trigger

Do not claim repo-wide `FCP-1` audit coverage or `FCP-1` closeout from an execution plan alone. The repo-wide coverage claim must point to this tracked audit artifact or to explicitly tracked per-area audit artifacts. `ARCHITECTURE_CLEANUP_CHECKLIST.md` also requires the FCP-1 mini-record to link the audit artifact(s), execution plan(s), source-finding proof matrix, deferred owners and revisit triggers, verification evidence, and clean adversarial review evidence before closeout.

## Discovery Trail

- Codanna was available. `get_index_info` showed 696 indexed files and semantic search enabled; the revision pass saw 11116 symbols.
- Broad `semantic_search_with_context` queries for FCP-1 architecture handoffs were weak/noisy and did not reliably identify package membership.
- `search_documents` returned relevant `CURRENT_STATE.md`, `modules.md`, and prior plan/reference hits, though document auto-sync emitted lock-busy warnings.
- `find_symbol AppOrchestrator` resolved to `src/core/orchestrator/AppOrchestrator.ts`; `find_symbol ServerSelectionCoordinator` returned an unrelated EPG binding symbol, so exact lookup was insufficient for that owner.
- `analyze_impact` returned zero impacted symbols for shared runtime seams where zero impact was not credible.
- Deterministic fallback used targeted `rg`, `find`, `wc -l`, and direct `nl -ba` source reads.
- `FCP-1-SF3` planning refresh: Codanna CLI was available with 11117 symbols, 696 files, semantic search enabled, and embeddings updated about 53 minutes before the pass. `semantic_search_with_context` for channel-setup handoff queries was weak/noisy, `search_symbols` found the expected channel setup screen/session/core anchors, `search_documents` returned prior channel-setup cleanup plan context with a lock-busy warning, and `analyze_impact ChannelSetupCoordinator` returned zero impacted symbols. Because that impact result was not credible for a shared runtime seam, the package brief uses targeted `rg`, `wc -l`, and direct source reads as deterministic fallback.
- `FCP-1-SF4` planning refresh: Codanna CLI was available with 11129 symbols, 696 files, semantic search enabled, and embeddings updated about 18 minutes before the pass. `semantic_search_with_context` for `AppOrchestrator runtime assembly hub priority one initialization` and `PriorityOneAssemblyBuilder broad runtime assembly input AppOrchestrator` returned weak/noisy hits. `search_documents` returned relevant `CURRENT_STATE.md`, `modules.md`, and prior plan context, with a lock-busy auto-sync warning. `find_symbol AppOrchestrator` resolved to `src/core/orchestrator/AppOrchestrator.ts`; `search_symbols` found the expected orchestrator assembly, priority-one, runtime-controller, and initialization anchors. `analyze_impact AppOrchestrator` returned only five impacted field symbols, which is too shallow for a central runtime hub. The `FCP-1-SF4` package therefore uses targeted `rg`, `wc -l`, and direct source reads as deterministic fallback and scopes the broad finding to priority-one runtime assembly input shaping.

Known uncertainty:

- This audit should be treated as source-backed, not mechanically exhaustive. Codanna semantic/impact weakness means missed candidates are possible where ownership risk is not discoverable by import strings, file size, or currently documented hotspots.
- The audit is strongest for the areas explicitly listed below. Future FCP-1 reviews should add missing source-backed candidates here instead of treating this file as closed by default.

## Source-Backed Candidate And Disposition Matrix

| area/candidate | source evidence | disposition | source_finding_id | final owner | closure or no-action rationale |
| --- | --- | --- | --- | --- | --- |
| App-shell server-selection runtime port exposes full core selected-server result. | `src/core/app-shell/AppShellRuntimeContracts.ts` imports `OrchestratorServerSelectionResult`; `src/core/server-selection/ServerSelectionTypes.ts` includes readiness, persistence, and startup resume details; `src/core/app-shell/AppLazyScreenPortFactory.ts` drops those details; `src/modules/ui/server-select/ServerSelectScreen.ts` only consumes selected/failed. | Resolved by first package. | `FCP-1-SF1` | App-shell runtime contract owner. | Narrowed the app-shell result contract while keeping the rich core/orchestrator result. Completed plan: `docs/plans/2026-04-29-fcp-1-architecture-handoff-coherence.md`; implementation commit `75b59c4f`. |
| Architecture docs omit the app-shell result-narrowing owner. | `docs/architecture/CURRENT_STATE.md` names `AppLazyScreenPortFactory` and `ServerSelectionCoordinator`; `docs/architecture/modules.md` names `ServerSelectionTypes` as owner of `OrchestratorServerSelectionResult`; neither names where app-shell narrowing must happen. | Resolved by first package. | `FCP-1-SF2` | Architecture docs owner. | Docs distinguish full core selected-server result ownership from app-shell/screen result ownership. Completed plan: `docs/plans/2026-04-29-fcp-1-architecture-handoff-coherence.md`; implementation commit `75b59c4f`. |
| Channel setup UI/app-shell screen wiring exposes the full core `ChannelSetupWorkflowPort` to the UI setup workflow. | Original source showed `AppShellChannelSetupRuntimePort` and `AppLazyScreenPortFactory` handing the full core workflow port to `ChannelSetupScreen`; UI session files typed against `ChannelSetupWorkflowPort`; the full port includes diagnostics (`getSetupPlanDiagnostics`) used by app-shell diagnostics, not by screen/session runtime. Closure source now shows `ChannelSetupScreenWorkflowPort` owns the screen contract, `AppLazyScreenPortFactory` calls `getChannelSetupScreenWorkflowPort()`, and `App.ts` projects the full core workflow into a diagnostics-free screen object. | Resolved by second package. | `FCP-1-SF3` | Channel setup UI/core boundary owner. | Completed plan: `docs/plans/2026-04-29-fcp-1-channel-setup-ui-core-handoff.md`; implementation commits `23effad7` and `2326562f`. Accepted residual: `ChannelSetupSessionState.ts` still imports `normalizeChannelSetupConfig` from core planning; owner is channel setup UI/core boundary owner; revisit before `FCP-1` closeout or any setup record normalization ownership change. |
| AppOrchestrator priority-one runtime assembly input is still shaped inline. | `src/core/orchestrator/AppOrchestrator.ts` is 2449 lines; `_initializePriorityOneControllers()` constructs the full `createPriorityOneAssembly({...})` input inline before calling `createPriorityOneControllersAndBinder()`. `PriorityOneAssemblyBuilder.ts`, `PriorityOneAssemblyInput.ts`, `PriorityOneControllerFactory.ts`, and `PriorityOneControllerCollaborators.ts` show priority-one already owns the downstream assembly/controller contracts. | Active package planned. | `FCP-1-SF4` | Priority-one runtime assembly owner. | Active plan: `docs/plans/2026-04-29-fcp-1-app-orchestrator-runtime-assembly-hub.md`. Closure requires moving priority-one assembly shaping out of `AppOrchestrator` without changing startup/shutdown/listener/timer/error handling behavior or moving the hub sideways. |
| AppOrchestrator adjacent assembly owners for modules, coordinators, runtime controllers, and initialization. | `OrchestratorModuleFactory.ts` is a focused module constructor/config owner; `OrchestratorCoordinatorAssembly.ts` owns coordinator construction; `OrchestratorRuntimeControllerBuilder.ts` is 71 lines and owns schedule-day rollover plus subtitle-track recovery construction; `InitializationCoordinator.ts` owns startup sequencing. `CURRENT_STATE.md` and `modules.md` already name these owners. | Accepted/no action for SF4 package. | none | Existing focused owners. | Do not widen the SF4 package into these areas unless implementation proves a direct priority-one dependency and triggers replan. |
| `src/Orchestrator.ts` root runtime barrel. | Source is 14 lines and re-exports `AppOrchestrator`, `PlaybackInfoSnapshot`, `ModuleStatus`, and `AppOrchestratorRuntime`; `CURRENT_STATE.md` explicitly says it is a thin public runtime entry barrel and must not export internal lifecycle/core owners. | Accepted/no action. | none | Public runtime barrel owner. | No source-backed widening found. Keep accepted seam. |
| Empty core/package roots. | `src/core/index.ts` contains only the intentional empty comment; `src/core/channel-setup/index.ts` is empty; targeted root-import audit found no production imports from broad `core` roots. | Accepted/no action. | none | Owning modules, not root barrels. | Current source matches `CURRENT_STATE.md`; no FCP-1 fix. |
| EPG package root and EPG leaf owners. | `src/modules/ui/epg/index.ts` exports bounded cross-module seams; targeted audit found core imports use `../../modules/ui/epg` and did not import EPG view/component/runtime/model leaf paths directly. | Accepted/no action. | none | EPG package root owner. | Current source matches `CURRENT_STATE.md`; no FCP-1 fix. |
| Overlay package roots and app container materialization. | `CURRENT_STATE.md` says overlay package roots are intended cross-module seams; `AppContainerFactory` owns shell-plane host/materialization while feature packages keep DOM/visibility ownership. | Accepted/no action. | none | App-shell container owner plus feature overlay owners. | No source-backed package-root or handoff problem found in this audit. |
| Current hotspot sizes outside the selected seams. | `wc -l` showed `EPGComponent.ts` 1803, `SettingsScreen.ts` 736, `ChannelSetupScreen.ts` 935, `PlexStreamResolver.ts` 758, `ChannelManager.ts` 1603; `CURRENT_STATE.md` lists them as hotspots. | Mostly out of current FCP-1; channel-setup handoff portion covered by `FCP-1-SF3`. | none beyond `FCP-1-SF3` | Respective module owners. | Size/design density alone belongs to later focused design/runtime-contract priorities unless source proves a current architecture/handoff seam. |

## Ready Package Findings

### `FCP-1-SF1`

Finding: app-shell server-selection runtime port exposes core/orchestrator selected-server internals.

Owner: app-shell runtime contract owner.

Closure condition: app-shell runtime contracts no longer import `OrchestratorServerSelectionResult` or `ServerSelectionTypes`; app-shell exposes a narrow app-shell-owned selected-server result; core/server-selection and `AppOrchestrator.selectServer()` keep the full result; server-select behavior is unchanged.

Execution path: `FCP-1-S1` in `docs/plans/2026-04-29-fcp-1-architecture-handoff-coherence.md`.

### `FCP-1-SF2`

Finding: architecture handoff docs do not name the app-shell server-selection result-narrowing owner.

Owner: architecture docs owner.

Closure condition: `CURRENT_STATE.md` and `modules.md` distinguish the full core/orchestrator server-selection result from the app-shell/server-select narrow result without widening public barrels.

Execution path: `FCP-1-S1` in `docs/plans/2026-04-29-fcp-1-architecture-handoff-coherence.md`.

### `FCP-1-SF3`

Finding: channel setup UI/app-shell screen wiring exposes the full core channel-setup workflow port to the TV-facing setup workflow.

Owner: channel setup UI/core boundary owner.

Closure condition: channel setup UI/session/app-shell screen wiring no longer imports or exposes the full core `ChannelSetupWorkflowPort`; the UI-facing workflow contract omits diagnostics; remaining direct core DTO/constants imports are either removed inside the same seam or recorded as accepted data-contract residue; behavior tests and source audits pass.

Execution path: `FCP-1-S2` in `docs/plans/2026-04-29-fcp-1-channel-setup-ui-core-handoff.md`.

Disposition: resolved by commits `23effad7` and `2326562f`.

Proof:

- `src/modules/ui/channel-setup/ChannelSetupScreenPorts.ts` owns `ChannelSetupScreenWorkflowPort` and omits `getSetupPlanDiagnostics`.
- `src/core/app-shell/AppShellRuntimeContracts.ts` exposes `getChannelSetupScreenWorkflowPort(): ChannelSetupScreenWorkflowPort` for channel setup screen construction while retaining `getChannelSetupWorkflowPort(): ChannelSetupWorkflowPort` only on diagnostics runtime.
- `src/core/app-shell/AppLazyScreenPortFactory.ts` no longer imports or calls the full core workflow port for channel setup screen construction.
- `src/App.ts` projects the full core workflow port into a new screen-only object before lazy screen construction, so the screen does not receive the full object by reference.
- Source audit and targeted tests listed in the completed plan passed, full `npm run verify` passed after the corrected implementation, and `npm run verify:docs` passed after this audit, the completed plan, and the checklist mini-record were updated for `FCP-1-S2` closeout.

Owned residual: `src/modules/ui/channel-setup/ChannelSetupSessionState.ts` still imports `normalizeChannelSetupConfig` from core planning. This is not DTO/constants residue. Final owner is the channel setup UI/core boundary owner. Revisit trigger: before `FCP-1` closeout, or earlier if setup record hydration/normalization ownership changes.

### `FCP-1-SF4`

Finding: `AppOrchestrator._initializePriorityOneControllers()` still owns priority-one runtime assembly input shaping. This is the concrete source-backed sub-scope selected for the broad AppOrchestrator runtime assembly hub finding.

Owner: priority-one runtime assembly owner.

Closure condition: `AppOrchestrator` keeps top-level guards, required-module validation, call-site orchestration, and assignment of returned controllers/binder, but no longer builds the full priority-one assembly input inline. A durable owner under `src/core/orchestrator/priority-one/` owns the mapping from orchestrator-provided runtime refs/callbacks to `PriorityOneAssemblyInput`. Startup, shutdown, listener/timer cleanup, playback, overlay, profile-switch, track-change, Plex error, persistence warning, and now-playing warning behavior remain unchanged.

Execution path: `FCP-1-S3` in `docs/plans/2026-04-29-fcp-1-app-orchestrator-runtime-assembly-hub.md`.

Disposition: active plan, not implemented. Other adjacent SF4 audit areas are accepted/no-action for this package because current source already has focused owners for module construction, coordinator assembly, runtime-controller construction, and initialization sequencing. Closeout must confirm those accepted/no-action areas remain true and that no other concrete `FCP-1-SF4` runtime assembly handoff is needed before `FCP-1` completion.

## Deferred Source Findings

No deferred `FCP-1` source finding remains admitted at this planning pass. The channel-setup normalization residual is an owned residual from `FCP-1-SF3`, not a new source finding. If implementation or closeout review finds another concrete AppOrchestrator handoff under the broad `FCP-1-SF4` theme, stop and update this audit plus the active plan before proceeding.

## Audited Accepted Areas

- `src/Orchestrator.ts`: accepted thin public runtime barrel. No action unless it starts exporting internal lifecycle/core/channel-setup owners.
- `src/core/index.ts` and `src/core/channel-setup/index.ts`: accepted empty roots. No action unless broad root imports or re-exports appear.
- `src/modules/ui/epg/index.ts`: accepted bounded cross-module EPG seam. No action unless core imports EPG leaf view/component/runtime/model paths directly or the root starts exporting leaf view utilities for unrelated callers.
- Overlay package roots and `AppContainerFactory`: accepted split between shell-plane materialization and feature-owned DOM/visibility. No action unless app-shell starts owning feature markup/visibility logic or feature packages start owning shell-plane structure.
- `OrchestratorModuleFactory`, `OrchestratorCoordinatorAssembly`, `OrchestratorRuntimeControllerBuilder`, and `InitializationCoordinator`: accepted focused owners for their current seams in the `FCP-1-SF4` audit. No action unless `FCP-1-S3` implementation proves a direct priority-one dependency and replans.
- Hotspot size alone: accepted as not enough for FCP-1 package admission. Create a source finding only when a concrete architecture/handoff ownership seam is proven.

## Closeout Rules For FCP-1

`FCP-1` cannot be marked complete until:

- `FCP-1-SF1` and `FCP-1-SF2` remain resolved by the completed first package or are explicitly superseded by review.
- `FCP-1-SF3` remains resolved by the completed channel-setup UI/core handoff package or is explicitly superseded by review.
- `FCP-1-SF4` is resolved by `FCP-1-S3` or explicitly accepted by source-backed review, and accepted/no-action adjacent SF4 areas remain true.
- this audit artifact is updated with final disposition, verification evidence, and any owned residuals.
- the checklist mini-record points to the final plan/audit state and records verification.
- the cleanup-loop closeout review accepts the source-finding proof matrix.
- the final FCP reconciliation pass, when the whole FCP checklist is ready to close, rechecks this audit against implemented source/docs changes so any new follow-up, ownership drift, stale doc, or architecture/handoff residue has one owner and revisit trigger.

`FCP-1-S1` and `FCP-1-S2` are completed packages. This audit does not claim `FCP-1` closeout while `FCP-1-SF4` remains active/not implemented and the `ChannelSetupSessionState.ts` normalization residual still needs closeout disposition or an owned follow-up.
