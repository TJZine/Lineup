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

Known uncertainty:

- This audit should be treated as source-backed, not mechanically exhaustive. Codanna semantic/impact weakness means missed candidates are possible where ownership risk is not discoverable by import strings, file size, or currently documented hotspots.
- The audit is strongest for the areas explicitly listed below. Future FCP-1 reviews should add missing source-backed candidates here instead of treating this file as closed by default.

## Source-Backed Candidate And Disposition Matrix

| area/candidate | source evidence | disposition | source_finding_id | final owner | closure or no-action rationale |
| --- | --- | --- | --- | --- | --- |
| App-shell server-selection runtime port exposes full core selected-server result. | `src/core/app-shell/AppShellRuntimeContracts.ts` imports `OrchestratorServerSelectionResult`; `src/core/server-selection/ServerSelectionTypes.ts` includes readiness, persistence, and startup resume details; `src/core/app-shell/AppLazyScreenPortFactory.ts` drops those details; `src/modules/ui/server-select/ServerSelectScreen.ts` only consumes selected/failed. | Ready package finding in active execution plan. | `FCP-1-SF1` | App-shell runtime contract owner. | Narrow the app-shell result contract while keeping the rich core/orchestrator result. Active plan: `docs/plans/2026-04-29-fcp-1-architecture-handoff-coherence.md`. |
| Architecture docs omit the app-shell result-narrowing owner. | `docs/architecture/CURRENT_STATE.md` names `AppLazyScreenPortFactory` and `ServerSelectionCoordinator`; `docs/architecture/modules.md` names `ServerSelectionTypes` as owner of `OrchestratorServerSelectionResult`; neither names where app-shell narrowing must happen. | Ready package finding in active execution plan. | `FCP-1-SF2` | Architecture docs owner. | Docs must distinguish full core selected-server result ownership from app-shell/screen result ownership. Active plan: `docs/plans/2026-04-29-fcp-1-architecture-handoff-coherence.md`. |
| Channel setup UI imports core channel-setup contracts directly across screen/session/steps. | Targeted production import audit found only channel-setup UI importing core owners under `src/modules`; direct reads show `ChannelSetupScreen.ts`, `ChannelSetupSessionController.ts`, `ChannelSetupSessionState.ts`, step constants/types importing core setup types/constants/workflow ports. | Deferred FCP-1 candidate. | `FCP-1-SF3` | Channel setup UI/core boundary owner. | Future package must either narrow the UI-facing channel-setup contract or record source-backed acceptance of direct domain imports. |
| AppOrchestrator remains a broad runtime assembly hub. | `src/core/orchestrator/AppOrchestrator.ts` is 2449 lines; field/constructor reads show many module refs plus server-selection/channel-setup/runtime wiring; `PriorityOneAssemblyBuilder.ts` accepts a broad runtime assembly input. | Deferred FCP-1 candidate. | `FCP-1-SF4` | Core orchestrator runtime assembly owner. | Future package must isolate one concrete AppOrchestrator handoff and prove it reduces owner breadth rather than moving hub responsibility. |
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

## Deferred Source Findings

### `FCP-1-SF3`

Finding: channel setup UI/core handoff is broad.

Owner: channel setup UI/core boundary owner.

Closure condition: a future FCP-1 package either narrows the UI-facing channel-setup contract to the minimal screen/session port or records source-backed acceptance that the direct core domain imports are intentional and do not leak core workflow internals into UI.

Revisit trigger: after `FCP-1-S1` is reviewed/implemented, before marking `FCP-1` complete, or sooner if channel-setup UI/core files are touched by another FCP-1 package.

Required future package brief rule: the future brief must identify exact UI/core files in and out of scope, decide whether the target owner lives under `src/modules/ui/channel-setup/` or `src/core/channel-setup/`, name the preservation contracts for setup session state/workflow/preview behavior, and include targeted channel-setup tests plus `npm run verify`.

### `FCP-1-SF4`

Finding: AppOrchestrator remains a broad runtime assembly hub.

Owner: core orchestrator runtime assembly owner.

Closure condition: a future FCP-1 package names one concrete AppOrchestrator handoff to narrow, its target owner, exact files in/out, invariant-preserving tests, and proof that the change reduces owner breadth rather than relocating hub responsibility.

Revisit trigger: after `FCP-1-S1` and any channel-setup handoff disposition are complete, before `FCP-1` closeout, or sooner if plan review identifies a concrete AppOrchestrator seam that must precede them.

Required future package brief rule: the future brief must not authorize broad `AppOrchestrator` decomposition. It must isolate one runtime handoff, define a single owner, preserve startup/shutdown/listener/timer/error handling invariants, and include targeted tests plus `npm run verify`.

## Audited Accepted Areas

- `src/Orchestrator.ts`: accepted thin public runtime barrel. No action unless it starts exporting internal lifecycle/core/channel-setup owners.
- `src/core/index.ts` and `src/core/channel-setup/index.ts`: accepted empty roots. No action unless broad root imports or re-exports appear.
- `src/modules/ui/epg/index.ts`: accepted bounded cross-module EPG seam. No action unless core imports EPG leaf view/component/runtime/model paths directly or the root starts exporting leaf view utilities for unrelated callers.
- Overlay package roots and `AppContainerFactory`: accepted split between shell-plane materialization and feature-owned DOM/visibility. No action unless app-shell starts owning feature markup/visibility logic or feature packages start owning shell-plane structure.
- Hotspot size alone: accepted as not enough for FCP-1 package admission. Create a source finding only when a concrete architecture/handoff ownership seam is proven.

## Closeout Rules For FCP-1

`FCP-1` cannot be marked complete until:

- `FCP-1-SF1` and `FCP-1-SF2` are resolved by the active execution plan or explicitly superseded by review.
- `FCP-1-SF3` and `FCP-1-SF4` are either resolved by future source-backed FCP-1 packages or accepted as no-action with source-backed owner rationale.
- this audit artifact is updated with final disposition, verification evidence, and any owned residuals.
- the checklist mini-record points to the final plan/audit state and records verification.
- the cleanup-loop closeout review accepts the source-finding proof matrix.
- the final FCP reconciliation pass, when the whole FCP checklist is ready to close, rechecks this audit against implemented source/docs changes so any new follow-up, ownership drift, stale doc, or architecture/handoff residue has one owner and revisit trigger.

`FCP-1-S1` is only the first ready package. This audit does not claim `FCP-1` closeout while `FCP-1-SF3` and `FCP-1-SF4` remain deferred.
