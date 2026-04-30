**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

# DCR-12 App-Shell, Startup, And Server-Selection Contracts

## Goal

Retire the `DCR-12` checklist package by fixing or source-disproving the app-shell, startup, Plex-auth cancellation, server-selection, and channel-switch contract findings admitted by `DCR-EXIT-S0`.

This is a Tier 3 cleanup-loop package. The implementation must reduce live responsibility in `src/core/orchestrator/AppOrchestrator.ts`, not only add tests around it. `DCR-12-A1` may close only by actual source responsibility reduction plus a fresh file-health source audit proving `S0-L01-F1` no longer describes current source, or by explicit maintainer reclassification with owner, rationale, and revisit trigger.

## Execution Update

2026-04-30 controller update:

- `DCR-12-S1` was implemented in commits `70a83725` and `992afedb`,
  reviewed clean after fixes, and verified by full `npm run verify`.
- The tracked-plan/docs checkpoint was recorded in commit `0b48e578`.
- `DCR-12-S2` is now the next approved execution unit.

## Non-Goals

- Do not run or use Desloppify runtime intake, scans, queue/import output, score refreshes, status/next/plan output, or review packets.
- Do not load the `desloppify` skill.
- Do not redesign server-select UI visuals, focus model, navigation flow, or startup product behavior beyond the contract repairs named here.
- Do not introduce new storage owners for selected-server state when the existing server-selection/Plex discovery owners can own the projection.
- Do not add compatibility branches, fallback contracts, or temporary adapters that preserve the leaky API as a second path.
- Do not modify unrelated dirty or untracked work. Known unrelated dirty state includes `docs/plans/2026-04-30-dcr-exit-final-dimension-audit-plan.md` and untracked plan/eval docs.

## Parent Priority Alignment

`DCR-12` is a checklist-linked follow-up package admitted by `DCR-EXIT-S0` and recorded in `ARCHITECTURE_CLEANUP_CHECKLIST.md`. It blocks resuming `DCR-EXIT-S2` until all four package issues are fixed, source-disproved, or explicitly maintainer-routed out of DCR.

The package advances the current architecture rules that composition roots stay thin, app-shell ports stay outcome-oriented, Plex auth/token handling stays behind Plex owners, storage keys stay behind persistence owners, and startup/channel routing carries typed outcomes instead of discarding them.

## Required Reading

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/cleanup-loop.md`
4. `ARCHITECTURE_CLEANUP_CHECKLIST.md` section `DCR-12`
5. `docs/plans/2026-04-30-dcr-exit-final-dimension-audit-plan.md` only for `DCR-EXIT-S0`/`S1` routing context and block state
6. The local DCR-EXIT-S0 run artifacts for the DCR-12 finding ids
   (`S0-L01-F1`, `F-S0L02-001`, `S0-L08-F1`, `F-S0-L09-001`,
   `S0-L12-F1`). These were controller-loaded during planning; they are not
   tracked-plan required-reading links because run-instance artifacts are
   local-only by policy.
7. `docs/architecture/CURRENT_STATE.md`
8. `docs/api/plex-integration.md`
9. `docs/agentic/plan-authoring-standard.md`
10. `docs/agentic/codanna-playbook.md`
11. Current source and tests named in this plan.

Freshness gate: before implementation, run `git status --short` on in-scope files. If any in-scope file has unrelated dirty changes, stop and report routing instead of writing over it. If the DCR-12 checklist entry, source contracts, or active DCR-EXIT routing changed materially after this plan, update this plan and rerun plan review before implementation.

## Required Skills

- `architecture-boundaries`: required because `AppOrchestrator` responsibility, app-shell ports, and startup routing change.
- `plex-integration-boundaries`: required for Plex PIN auth, credential storage, and selected-server contracts.
- `persistence-boundaries`: required for selected-server storage-key and credential-persistence seams.
- `ui-composition-patterns`: required because server-select/auth screens and guide-visible channel-selection behavior are touched.
- `verification-strategy`: required to freeze targeted contract/regression proof.
- `execution-plan-authoring`: required for this active tracked cleanup plan.
- `model-selection`: required for this high-risk Tier 3 handoff.
- `parallel-sidecars`: allowed only for read-only plan review, source-audit review, or focused evidence sidecars.

`bounded-worker-execution` is not authorized by this plan because the implementation slices share public contracts and source files. Do not run parallel write workers unless a reviewed plan revision proves disjoint file ownership and updates `parallel_execution_policy`.

## Codanna Discovery

Codanna tools are unavailable in this session. Tool discovery exposed no callable Codanna tools, so this plan records a required fallback to deterministic `rg`, `wc`, `sed`, direct tracked-doc reads, and source/test reads.

- `semantic_search_with_context`: unavailable; fallback used direct reads of required docs and targeted source searches.
- `search_documents`: unavailable; fallback used direct reads of `AGENTS.md`, `docs/AGENTIC_DEV_WORKFLOW.md`, `docs/agentic/session-prompts/cleanup-loop.md`, `docs/agentic/plan-authoring-standard.md`, `docs/agentic/codanna-playbook.md`, `docs/architecture/CURRENT_STATE.md`, `docs/api/plex-integration.md`, `ARCHITECTURE_CLEANUP_CHECKLIST.md`, the active DCR-EXIT plan, and exact `DCR-EXIT-S0` records.
- `analyze_impact`: unavailable; fallback used current source/test `rg` across app-shell, orchestrator, initialization, Plex auth, server-selection, server-select UI, EPG, navigation, and tests.
- Direct evidence commands included `wc -l` for DCR-12 hotspot files, `rg` for `pollForPin`/`cancelPin`/`storeCredentials`/`authChange`, `rg` for selected-server storage-key leaks, `rg` for `ChannelSwitchOutcome` and `switchToChannel` routes, and direct reads of the relevant source snippets.

No Desloppify skill, CLI, scan output, status output, plan output, score output, review packet, or queue/import output was loaded or used.

## Impact Snapshot

Current-source audit on 2026-04-30 supports fixing all DCR-12 issues; none are source-disproved by current code.

- `DCR-12-A1` / `S0-L01-F1`: `src/core/orchestrator/AppOrchestrator.ts` is currently 2140 lines and still owns many runtime fields plus public auth, server-selection, startup resume, channel-switching, global error, lifecycle, and helper responsibilities. `CURRENT_STATE.md` still lists it as a current hotspot. The plan chooses source responsibility reduction, not tests-only closure, and freezes the minimum A1 closure scope in `DCR-12-S1` instead of leaving the worker to decide it.
- `DCR-12-A2` / `F-S0L02-001`: `PlexAuth.checkPinStatus()` stores credentials and emits `authChange` as soon as a claimed PIN is observed. `PlexAuth.pollForPin()` has no abort/cancel option. `AuthScreen.hide()` and cancel only increment a local token and best-effort call `cancelPin`; a stale poll can still complete in Plex auth before the UI discards its result. `InitializationCoordinator` resumes startup on `authChange`, so cancelled auth can still resume startup.
- `DCR-12-A3` / `S0-L08-F1` + `S0-L12-F1`: `AppShellServerSelectionRuntimePort` and `ServerSelectScreenPorts` expose `getSelectedServerStorageKey()` and `getServerHealthStorageKey()`. `AppLazyScreenPortFactory` forwards those getters, and `ServerSelectScreen` constructs `ServerSelectionStore` directly from them. `AppShellDiagnosticsRuntimePort` also exposes `getSelectedServerStorageKey()`, and `AppDiagnosticsSurface` logs that key in channel-setup planner diagnostics. Existing app-shell, diagnostics, and server-select tests assert the leaky surface.
- `DCR-12-A4` / `F-S0-L09-001`: `ChannelTuningCoordinator` returns `ChannelSwitchOutcome`, and the number-entry navigation path already consumes `switched | failed | aborted`. The ID-based runtime path `AppOrchestrator.switchToChannel()` returns `Promise<void>`, `InitializationCoordinator` callbacks type startup routing as `switchToChannel(id): Promise<void>`, and `EPGCoordinator` awaits a void guide-selection port after closing the guide. Startup and guide routing cannot observe `failed` or `aborted`.

MODEL_SUGGESTION
PLANNER: `gpt-5.5 high`
IMPLEMENTER: `gpt-5.5 medium`
REVIEWER: `gpt-5.5 high`
WHY: Tier 3 cleanup touches a hotspot file, cross-module ownership, Plex auth/token safety, persistence boundaries, app-shell contracts, startup routing, and user-visible guide behavior.

## Files In Scope

- `src/core/orchestrator/AppOrchestrator.ts`
- `src/core/orchestrator/OrchestratorChannelSwitchRuntime.ts` or a similarly focused new orchestrator collaborator if implementation chooses this name/path
- `src/core/orchestrator/OrchestratorPlexAuthRuntime.ts` or a similarly focused new orchestrator auth/runtime collaborator
- `src/core/orchestrator/OrchestratorServerSelectionRuntime.ts` or a similarly focused new orchestrator/server-selection collaborator
- `src/__tests__/Orchestrator.test.ts`
- `src/core/initialization/InitializationCoordinator.ts`
- `src/core/initialization/InitializationStartupPolicy.ts`
- `src/core/initialization/__tests__/InitializationCoordinator.test.ts`
- `src/modules/plex/auth/PlexAuth.ts`
- `src/modules/plex/auth/interfaces.ts`
- `src/modules/plex/auth/__tests__/*`
- `src/modules/ui/auth/AuthScreen.ts`
- `src/modules/ui/auth/__tests__/*`
- `src/core/server-selection/*`
- `src/core/server-selection/__tests__/*`
- `src/core/app-shell/AppShellRuntimeContracts.ts`
- `src/core/app-shell/AppLazyScreenPortFactory.ts`
- `src/core/app-shell/AppLazyScreenRegistry.ts`
- `src/core/app-shell/AppDiagnosticsSurface.ts`
- `src/core/app-shell/__tests__/*`
- `src/modules/ui/server-select/*`
- `src/modules/ui/server-select/__tests__/*`
- `src/modules/ui/epg/coordinator/EPGCoordinator.ts`
- `src/modules/ui/epg/__tests__/EPGCoordinator.test.ts`
- `src/modules/navigation/*` only if channel-switch outcome propagation changes navigation-facing contracts
- `docs/architecture/CURRENT_STATE.md` if ownership/current-hotspot truth changes
- `docs/api/plex-integration.md` if the public Plex auth/server-selection contract changes
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` only during closeout after reviewed implementation and verification

## Files Out Of Scope

- Desloppify runtime state, scan output, queue/import artifacts, score outputs, and review packets.
- Unrelated modified or untracked plan/eval docs, including the dirty DCR-EXIT plan except for read-only routing context.
- `docs/design/ui-design-language.md` unless implementation intentionally changes reusable visual rules, which this plan does not authorize.
- Plex stream, library, player runtime, scheduler/channel-manager, settings, and EPG component cleanup outside the channel-switch outcome path.
- Broad test-suite splitting or DCR-13/DCR-14/DCR-15/DCR-16 package work.

## Planner Self-Check

- No unresolved package membership: `DCR-12-A1` through `DCR-12-A4` are the complete checklist package issues.
- No source-disprove path is chosen up front. Current source still exhibits all four issue shapes.
- The key seams are explicit: AppOrchestrator sheds a frozen set of runtime responsibilities to focused orchestrator collaborators; Plex auth owns cancellable PIN persistence; server-selection/core owns screen-ready selected-server state; diagnostics stops exposing selected-server storage keys; startup/guide owners consume typed channel-switch outcomes with defined per-outcome behavior.
- Adjacent contracts that must change are in scope: app-shell runtime ports, auth interfaces, initialization callbacks/policy, server-select screen ports, and EPG coordinator port typing.
- The plan does not declare files out of scope while depending on them for mechanical wiring.
- Codanna unavailability is recorded, with `rg`/direct-read fallback evidence.
- A fresh session should not have to invent ownership or verification policy; local helper names remain delegated inside the chosen seams.

## Architecture Seam Decision Gate

Chosen seams:

- `AppOrchestrator` remains the public runtime facade and lifecycle composition owner, but `DCR-12-S1` must move these exact responsibilities before A1 can close:
  - channel-switch runtime policy to `OrchestratorChannelSwitchRuntime` or an equivalently focused owner: `switchToChannel`, `switchToChannelByNumber`, outcome-aware ID and number switching, missing channel-tuning dependency reporting for switch commands, and next/previous best-effort channel commands;
  - Plex auth screen-runtime facade to `OrchestratorPlexAuthRuntime` or an equivalently focused owner: `requestAuthPin`, `pollForPin`, `cancelPin`, and their initialized/shutdown dependency checks, with `DCR-12-S2` later changing the poll contract for cancellation;
  - selected-server runtime facade to `OrchestratorServerSelectionRuntime` or an equivalently focused owner: `selectServer`, `clearSelectedServer`, selected-server ID projection, selected-server startup-resume/swap orchestration, and the server-selection coordinator/runtime-controller handoff.
  A1 remains open if a worker performs only a narrower extraction. In that case the worker must stop after the narrower extraction, record the source proof, and replan the remaining A1 closure scope instead of claiming closure.
- Plex PIN cancellation belongs in Plex auth plus the auth UI port contract. A cancelled or hidden auth screen must abort the poll before token profile fetch/credential storage and therefore before `authChange` can resume startup.
- Server-select UI and diagnostics must receive screen-ready selected-server state or a narrow query result through app-shell/server-selection ports. App-shell, diagnostics, and UI ports must not expose selected-server storage keys, storage-key getters, readiness internals, or persistence-result details.
- Channel-switch outcome observation belongs to the startup routing owner and guide-selection owner. `ChannelTuningCoordinator` remains the lower-level switch executor. `AppOrchestrator` delegates to the runtime collaborator and exposes outcome-aware internal ports while preserving the visible routing behavior defined below.

A4 outcome policy:

- Startup post-ready routing keeps the existing route order: audio setup and channel setup still win; otherwise startup still routes to `player` before attempting the initial tune, and opens server-select only when there is no channel to tune.
- Startup `switched`: continue current successful path and allow readiness/lifecycle ready publication.
- Startup `failed`: treat as the current route-failure equivalent. Do not publish ready, do not set lifecycle ready, do not open server-select as a fallback, and let `InitializationCoordinator.runStartup()` report/reject through its existing initialization failure path.
- Startup `aborted`: treat as incomplete startup routing rather than success. Do not publish ready, do not set lifecycle ready, do not open server-select as a fallback, and reject/report through the same initialization failure path unless implementation proves an existing abort-specific path is already owned and tested.
- Guide selection before switch starts: stale or pre-close abort keeps current behavior; do not close the guide and do not call switch.
- Guide selection `switched`: keep current behavior; close the guide and complete without restoring guide focus.
- Guide selection `failed`: keep the guide closed, append/report the existing EPG switch-failure diagnostic, do not reopen/refocus the guide, and do not raise a global navigation error.
- Guide selection `aborted` after the guide has closed: keep the guide closed, do not reopen/refocus, and do not report it as a failure.

Stop and replan if:

- `DCR-12-A1` cannot be closed by actual responsibility reduction and source audit; do not substitute tests, docs, or residual acceptance without explicit maintainer reclassification.
- The auth cancellation fix would require storing credentials outside `PlexAuth` or logging/exposing tokens.
- Server-select repair requires raw `localStorage`, key names, or `ServerSelectionStore` construction in UI/app-shell callers after the change.
- Startup or guide routing needs behavior outside the A4 policy above, or a user-visible navigation behavior change that is not covered by targeted tests and ownership review.
- Public runtime contracts change more broadly than the files in scope, or downstream callers outside this package require behavior decisions not recorded here.
- Any in-scope file has unrelated dirty changes at implementation start.

## Package Decomposition

- `package_id`: `DCR-12`
- `checklist_token`: `DCR-12`
- `package_issue_ids`:
  - `DCR-12-A1`: `S0-L01-F1` `AppOrchestrator` remains a live production file-health hotspot after DCR-6.
  - `DCR-12-A2`: `F-S0L02-001` cancelled Plex PIN polling can still store credentials or resume startup.
  - `DCR-12-A3`: `S0-L08-F1` / `S0-L12-F1` server-select API still exposes selected-server storage-key details through app-shell ports.
  - `DCR-12-A4`: `F-S0-L09-001` channel-switch failure outcomes are discarded before startup/guide routing can react.

- `slice_table`:

### `DCR-12-S1`

- `goal`: Reduce `AppOrchestrator` responsibility by moving the frozen A1 closure set: channel-switch runtime policy, Plex auth screen-runtime facade, and selected-server runtime facade/startup-swap orchestration into focused orchestrator collaborators.
- `areas/files`: `AppOrchestrator`, `OrchestratorChannelSwitchRuntime` or equivalent, `OrchestratorPlexAuthRuntime` or equivalent, `OrchestratorServerSelectionRuntime` or equivalent, orchestrator tests, current-state docs if ownership truth changes.
- `exact_issue_ids`: `DCR-12-A1`, `S0-L01-F1`
- `verification`: `npm run test:unit -- --runInBand src/__tests__/Orchestrator.test.ts`; fresh file-health source audit recording the three moved responsibility groups, current line/responsibility shape, and why `S0-L01-F1` is no longer live or why maintainer reclassification is required; `npm run typecheck`.
- `dependencies`: none
- `stop_condition`: Stop if any of the three mandatory responsibility groups cannot move cleanly, if extraction would grow a new broad owner, if AppOrchestrator remains a live hotspot after the planned moves, or if closure would rely only on tests/docs.
- `handoff_condition`: AppOrchestrator no longer owns channel-switch runtime policy, Plex auth screen-runtime facade methods, or selected-server runtime facade/startup-swap orchestration; public behavior is preserved or deliberately tested; A1 audit evidence is ready for review.
- `serial_only`: yes
- `parallel_justification`: First slice changes shared seams consumed by all later slices.

### `DCR-12-S2`

- `goal`: Make Plex PIN polling cancellation token-safe and prevent cancelled/hidden auth flows from storing credentials or resuming startup.
- `areas/files`: `PlexAuth`, auth interfaces, `AuthScreen`, app-shell auth ports/factory, initialization auth resume tests.
- `exact_issue_ids`: `DCR-12-A2`, `F-S0L02-001`
- `verification`: `npm run test:unit -- --runInBand src/modules/plex/auth/__tests__/PlexAuth.test.ts src/modules/ui/auth/__tests__/AuthScreen.test.ts src/core/initialization/__tests__/InitializationCoordinator.test.ts`; tests prove abort before/after claim cannot call `storeCredentials` or emit `authChange`, AuthScreen cancel/hide abort polling, and cancelled auth does not resume startup; `npm run typecheck`.
- `dependencies`: `DCR-12-S1`
- `stop_condition`: Stop if cancellation can still race after profile fetch but before storage, if token-bearing values would be logged, or if startup resume is suppressed for legitimate completed auth.
- `handoff_condition`: Cancelled flows abort and do not persist credentials or trigger startup; successful non-cancelled auth still stores credentials and resumes startup.
- `serial_only`: yes
- `parallel_justification`: Shares auth/app-shell/startup contracts with S1 and later verification.

### `DCR-12-S3`

- `goal`: Remove selected-server storage-key/readiness/persistence details from app-shell and server-select UI ports.
- `areas/files`: app-shell runtime contracts/factory/registry tests, `AppDiagnosticsSurface` and diagnostics tests, core server-selection state projection, `ServerSelectScreen`, server-select tests, `ServerSelectionStore` only behind owner boundary.
- `exact_issue_ids`: `DCR-12-A3`, `S0-L08-F1`, `S0-L12-F1`
- `verification`: `npm run test:unit -- --runInBand src/core/app-shell/__tests__/AppShellRuntimeContracts.test.ts src/core/app-shell/__tests__/AppLazyScreenPortFactory.test.ts src/core/app-shell/__tests__/AppLazyScreenRegistry.test.ts src/core/app-shell/__tests__/AppDiagnosticsSurface.test.ts src/modules/ui/server-select/__tests__/ServerSelectScreen.test.ts`; tests prove no `getSelectedServerStorageKey`/`getServerHealthStorageKey` app-shell, diagnostics, or screen port exposure; tests prove screen/diagnostics consume narrowed state; source audit for storage-key exposure; `npm run typecheck`.
- `dependencies`: `DCR-12-S1`
- `stop_condition`: Stop if UI, diagnostics, or app-shell callers still construct `ServerSelectionStore`, know key names, log key names, or branch on selected-server readiness/persistence internals.
- `handoff_condition`: App-shell, diagnostics, and screen ports expose only outcome/screen-ready state; selected-server storage remains behind the server-selection/Plex discovery owner; old leaky tests are replaced.
- `serial_only`: yes
- `parallel_justification`: Shared app-shell contracts and UI tests make parallel writes unsafe.

### `DCR-12-S4`

- `goal`: Carry ID-based channel-switch outcomes through startup and guide routing so owners can react to `switched`, `failed`, and `aborted`.
- `areas/files`: orchestrator channel-switch collaborator, `InitializationCoordinator`, `InitializationStartupPolicy`, `EPGCoordinator`, navigation only if public navigation contract changes, targeted tests.
- `exact_issue_ids`: `DCR-12-A4`, `F-S0-L09-001`
- `verification`: `npm run test:unit -- --runInBand src/core/initialization/__tests__/InitializationStartupPolicy.test.ts src/core/initialization/__tests__/InitializationCoordinator.test.ts src/modules/ui/epg/__tests__/EPGCoordinator.test.ts src/__tests__/Orchestrator.test.ts`; tests cover the A4 startup and guide `switched`, `failed`, and `aborted` policy; `npm run typecheck`.
- `dependencies`: `DCR-12-S1` channel-switch runtime seam.
- `stop_condition`: Stop if behavior departs from the A4 outcome policy, if number-entry outcome handling regresses, or if outcome errors are swallowed again as `void`.
- `handoff_condition`: Startup and guide owners observe outcomes through typed ports; failed/aborted behavior matches the A4 policy; no unreviewed visible navigation behavior change.
- `serial_only`: yes
- `parallel_justification`: Depends on S1 channel-switch seam and overlaps EPG/startup contracts.

- `coverage_check`:
  - `DCR-12-A1` maps exactly once to `DCR-12-S1`.
  - `DCR-12-A2` maps exactly once to `DCR-12-S2`.
  - `DCR-12-A3` maps exactly once to `DCR-12-S3`.
  - `DCR-12-A4` maps exactly once to `DCR-12-S4`.
- `ready_now_slice`: `DCR-12-S2`
- `ready_now_execution_unit`: `DCR-12-S2`
- `recommended_slice_order`:
  1. `DCR-12-S1`
  2. `DCR-12-S2`
  3. `DCR-12-S3`
  4. `DCR-12-S4`
- `parallel_execution_policy`: serial implementation only. Read-only sidecars are allowed for plan review, source-audit review, or focused contract impact checks. Parallel write execution is not authorized because all slices may touch `AppOrchestrator`, app-shell contracts, startup routing, or shared tests.

## Verification Commands

1. Verification classification: `new regression/contract test required`

Run these gates in order as applicable:

- Run: `npm run plans:check`
  Expected: passes after creating/updating this active DCR-12 plan and before closeout.
- Run: `npm run test:unit -- --runInBand src/__tests__/Orchestrator.test.ts`
  Expected: public facade behavior remains stable where intended; the three `DCR-12-S1` responsibility groups are delegated; ID-based channel switching can return/propagate `switched`, `failed`, and `aborted` through the approved owners.
- Run: `npm run test:unit -- --runInBand src/modules/plex/auth/__tests__/PlexAuth.test.ts src/modules/ui/auth/__tests__/AuthScreen.test.ts src/core/initialization/__tests__/InitializationCoordinator.test.ts`
  Expected: cancelled/hidden PIN polling cannot store credentials, emit `authChange`, or resume startup; completed non-cancelled auth still works.
- Run: `npm run test:unit -- --runInBand src/core/app-shell/__tests__/AppShellRuntimeContracts.test.ts src/core/app-shell/__tests__/AppLazyScreenPortFactory.test.ts src/core/app-shell/__tests__/AppLazyScreenRegistry.test.ts src/core/app-shell/__tests__/AppDiagnosticsSurface.test.ts src/modules/ui/server-select/__tests__/ServerSelectScreen.test.ts`
  Expected: app-shell, diagnostics, and screen ports no longer expose selected-server storage-key getters, readiness internals, or persistence-result details; server-select and diagnostics consume narrowed state.
- Run: `npm run test:unit -- --runInBand src/core/initialization/__tests__/InitializationStartupPolicy.test.ts src/core/initialization/__tests__/InitializationCoordinator.test.ts src/modules/ui/epg/__tests__/EPGCoordinator.test.ts src/__tests__/Orchestrator.test.ts`
  Expected: startup and guide routing observe `switched`, `failed`, and `aborted` according to the A4 policy; number-entry navigation outcome behavior does not regress.
- Run: `wc -l src/core/orchestrator/AppOrchestrator.ts src/core/orchestrator/OrchestratorChannelSwitchRuntime.ts src/core/orchestrator/OrchestratorPlexAuthRuntime.ts src/core/orchestrator/OrchestratorServerSelectionRuntime.ts`
  Expected: records current file-size evidence for `AppOrchestrator` and the three focused replacement owners.
- Run: `rg -n "switchToChannel|switchToChannelByNumber|switchToNextChannel|switchToPreviousChannel|channelSwitch|ChannelSwitchOutcome|_logMissingChannelTuningDependencies" src/core/orchestrator/AppOrchestrator.ts src/core/orchestrator/OrchestratorChannelSwitchRuntime.ts`
  Expected: channel-switch runtime policy lives in `OrchestratorChannelSwitchRuntime`; `AppOrchestrator` has facade wiring/delegation only.
- Run: `rg -n "requestAuthPin|pollForPin|cancelPin|PlexAuth not initialized|requestAuthPin|pollForPin|cancelPin" src/core/orchestrator/AppOrchestrator.ts src/core/orchestrator/OrchestratorPlexAuthRuntime.ts`
  Expected: Plex auth screen-runtime facade and dependency checks live in `OrchestratorPlexAuthRuntime`; `AppOrchestrator` has facade wiring/delegation only.
- Run: `rg -n "selectServer|clearSelectedServer|getSelectedServerId|resumeStartupAfterSelectedServerChange|SelectedServerRuntimeController|ServerSelectionCoordinator|serverSwap|startupResume" src/core/orchestrator/AppOrchestrator.ts src/core/orchestrator/OrchestratorServerSelectionRuntime.ts`
  Expected: selected-server runtime facade, selected-server ID projection, startup-resume/swap orchestration, and server-selection handoff live in `OrchestratorServerSelectionRuntime`; `AppOrchestrator` has facade wiring/delegation only.
- Run: `npm run typecheck`
  Expected: passes after public contract/type changes.
- Run: `npm run verify`
  Expected: passes because this work touches UI, navigation-adjacent routing, Orchestrator, and Plex.
- Run: `npm run verify:docs`
  Expected: passes if `CURRENT_STATE.md`, `docs/api/plex-integration.md`, `ARCHITECTURE_CLEANUP_CHECKLIST.md`, or active plan docs changed.

Why this depth matches the risk: each issue is a cross-boundary contract bug or hotspot cleanup item. Passing broad verification alone cannot prove cancellation safety, storage-key leakage removal, outcome propagation, or A1 responsibility reduction, so targeted regression/contract tests plus a source audit are mandatory.

## Rollback Notes

- Keep each implementation batch small enough to revert independently.
- If auth cancellation causes legitimate completed PIN auth to stop storing credentials, revert the auth slice and preserve the pre-slice app-shell/orchestrator extraction if already verified.
- If server-select state projection regresses saved-server auto-selection, revert only the server-select/app-shell slice and restore the last passing contract while re-planning a narrower state reader.
- If channel-switch outcome propagation creates unreviewed visible navigation changes, revert the channel outcome slice and replan the guide/startup reaction policy before trying again.
- Do not revert unrelated dirty or untracked files. If unrelated changes block rollback, stop and report the conflict.

## Commit Checkpoints

- Create focused non-interactive commits for coherent implementation fix batches or execution units.
- Do not make one giant commit for all DCR-12 work.
- Keep active tracked plan/checklist/doc progress separate from implementation commits where practical.
- A suggested commit split is:
  1. `DCR-12-S1` AppOrchestrator responsibility extraction and source-audit note.
  2. `DCR-12-S2` Plex auth cancellation contract and tests.
  3. `DCR-12-S3` server-select/app-shell storage-key leak removal and tests.
  4. `DCR-12-S4` channel-switch outcome propagation and tests.
  5. closeout docs/checklist updates after review and full verification.
