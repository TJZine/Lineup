# DCR-2 Channel Setup UI Persistence And Runtime Contract

**Plan Status:** archived
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

## Goal

Retire `ARCHITECTURE_CLEANUP_CHECKLIST.md` package `DCR-2` by removing the
Channel Setup UI's direct selected-server persistence access and by freezing the
runtime/facet failure contracts that decide how setup errors reach the UI.

The implementation must resolve every listed DCR-2 issue or owner decision:

- `DCR-2-A1`: `ChannelSetupScreen` must stop importing/instantiating
  `ServerSelectionStore` and must not read selected-server persistence directly.
- `DCR-2-D1`: facet failure semantics for collections, playlists, and native
  tag directories/count recovery are decided below.
- `DCR-2-D2`: the UI runtime result error shape is decided below.

## Non-Goals

- Do not implement deep facet loader/executor cache, progress replay,
  concurrency, or fixture cleanup; that remains `DCR-7`.
- Do not change broad Plex library request/parser behavior outside setup facet
  failure semantics.
- Do not revisit the accepted `ChannelSetupSessionState` ->
  `normalizeChannelSetupConfig` residual unless record-normalization ownership
  changes.
- Do not expand unrelated `ChannelManager.test.ts` or
  `SettingsScreen.test.ts`; those remain `DCR-10`.
- Do not add compatibility/fallback selected-server storage reads in the UI.
- Do not close the checklist row during implementation; checklist closeout
  remains controller-owned after implementation and review.

## Parent Architecture Alignment

This plan advances the channel setup UI/core boundary owner called out by
`DCR-2`. It preserves `docs/architecture/CURRENT_STATE.md` by keeping
storage-backed selected-server state behind the Plex discovery/server-selection
owners and keeping `ChannelSetupScreen` focused on rendering, focus, and bounded
UI coordination.

The selected-server app-shell/core seam is:
`AppShellChannelSetupRuntimePort.getSelectedServerId()` assembled by
`AppLazyScreenPortFactory`.

The owner is the app-shell channel setup runtime boundary. It may expose the
current selected server id to the screen, but it must not expose selected-server
storage keys or require the screen to construct `ServerSelectionStore`.
`ServerSelectionStore` remains the Plex discovery/server-select storage owner;
channel setup UI is only a consumer of the app-shell/core selected-server state.

## Required Reading

Read in this order before implementation:

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/cleanup-loop.md`
4. `ARCHITECTURE_CLEANUP_CHECKLIST.md`
   - DCR Operating Rules
   - full `DCR-2` section
   - `DCR-7` boundary section
   - `DCR-10` test-structure section
5. `docs/architecture/CURRENT_STATE.md`
6. `docs/agentic/plan-authoring-standard.md`
7. `docs/agentic/codanna-playbook.md`
8. This plan.

## Required Skills

- `architecture-boundaries`
- `persistence-boundaries`
- `ui-composition-patterns`
- `verification-strategy`
- `execution-plan-authoring`

`plex-integration-boundaries` is not required for the approved plan because
`DCR-2-D1` is frozen at the channel setup planning boundary and does not approve
changes to Plex library/discovery contracts. Load it and replan if
implementation needs to change Plex library facet APIs, parser behavior, or
discovery persistence ownership.

## Codanna Discovery

Codanna MCP/tools were unavailable in the planning context. MCP resource and
resource-template discovery returned no Codanna resources/templates, and this
session exposed no callable Codanna namespaces. Fallback discovery used `rg`,
direct source reads, and targeted impact-style searches, as required by
`docs/agentic/codanna-playbook.md`.

Fallback evidence:

- Direct reads covered all user-listed DCR-2 files:
  `ChannelSetupScreen.ts`, `ChannelSetupScreenPorts.ts`,
  `ChannelSetupSessionContracts.ts`, `ChannelSetupSessionRuntime.ts`,
  `ChannelSetupSessionState.ts`, `AppLazyScreenPortFactory.ts`,
  `AppShellRuntimeContracts.ts`, `ChannelSetupWorkflowPort.ts`,
  `createChannelSetupWorkflowPort.ts`, `ChannelSetupPlanningService.ts`, and
  `ChannelSetupFacetSnapshotFailures.ts`.
- `rg -n "new ServerSelectionStore|ServerSelectionStore|readSelectedServerIdAndClean|getSelectedServerStorageKey|getServerHealthStorageKey" src`
  found the DCR-2 leak only in `ChannelSetupScreen.ts` for channel setup UI;
  server-select and Plex discovery remain legitimate selected-server storage
  owners.
- `rg -n "createChannelSetupRuntimePort|AppShellChannelSetupRuntimePort|getChannelSetupRuntime" src`
  showed the app-shell channel setup runtime seam is assembled only through
  `AppLazyScreenPortFactory` and consumed by `App.ts` and app-shell tests.
- `rg -n "addPartialWarning|buildRequired|playlist|collection|tag directory|blocked|slow" src/core/channel-setup`
  and direct reads showed collection/playlist failures are partial warnings and
  native tag directory/count failures produce `blocked` or `slow` planning
  snapshots.
- Direct reads of `ChannelSetupPlanningService.test.ts`,
  `ChannelSetupSessionController.test.ts`, `ChannelSetupSessionRuntime.test.ts`,
  `AppLazyScreenPortFactory.test.ts`, and `AppShellRuntimeContracts.test.ts`
  showed the existing proof surfaces for facet failure behavior, UI string
  errors, and app-shell runtime port shape.

If Codanna becomes available in the implementation session, rerun
`semantic_search_with_context` for `ChannelSetupScreen ServerSelectionStore`,
`ChannelSetupSessionRuntime build outcome error contract`, and
`ChannelSetupPlanningService facet failure semantics`; run `search_documents`
for `DCR-2 Channel Setup UI Persistence`; and run `analyze_impact` for
`AppShellChannelSetupRuntimePort` and `ChannelSetupScreenPorts` before editing.
Treat contradictory results as a freshness gate and replan if they show new
selected-server persistence consumers, public port consumers, or Plex/facet
owners outside this plan.

## Impact Snapshot

Source-backed findings that shape the plan:

- `ChannelSetupScreen` imports `ServerSelectionStore`, constructs it from
  `ChannelSetupScreenPorts` storage-key getters, and implements
  `_getSelectedServerId()` by reading/cleaning selected-server persistence
  before falling back to `screenPorts.getSelectedServerId()`.
- `ChannelSetupScreenPorts` and `AppShellChannelSetupRuntimePort` currently
  expose selected-server and server-health storage-key getters only to support
  that UI-side store construction. The diagnostics runtime separately still
  needs selected-server storage key access for diagnostics.
- `AppLazyScreenPortFactory.createChannelSetupScreenInput()` is the local
  app-shell assembly point for channel setup screen ports, so this is the
  correct seam for removing storage-key projection from the channel setup screen
  contract.
- `ChannelSetupSessionRuntime` stores load, preview, review, build, blocked, and
  bookkeeping errors as user-facing strings. Existing tests assert string
  outcomes for load/build/review/bookkeeping paths.
- `ChannelSetupFacetSnapshotLoadSession` and
  `ChannelSetupFacetLibraryExecutor` continue planning with partial warnings for
  playlist and collection fetch failures, while native tag directory failures
  and required count-recovery failures return failure snapshots through
  `ChannelSetupFacetSnapshotFailures`.
- DCR-7 owns loader cache/progress/concurrency/fixture cleanup. DCR-2 may
  source-audit those surfaces for boundary proof but must not change them.

## Files In Scope

- `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
- `src/modules/ui/channel-setup/ChannelSetupScreenPorts.ts`
- `src/modules/ui/channel-setup/ChannelSetupSessionContracts.ts`
- `src/modules/ui/channel-setup/ChannelSetupSessionRuntime.ts`
- `src/modules/ui/channel-setup/ChannelSetupSessionState.ts`
- `src/modules/ui/channel-setup/__tests__/*`
- `src/core/app-shell/AppLazyScreenPortFactory.ts`
- `src/core/app-shell/AppShellRuntimeContracts.ts`
- `src/core/app-shell/__tests__/AppLazyScreenPortFactory.test.ts`
- `src/core/app-shell/__tests__/AppShellRuntimeContracts.test.ts`
- `src/core/channel-setup/workflow/ChannelSetupWorkflowPort.ts`
- `src/core/channel-setup/workflow/createChannelSetupWorkflowPort.ts`
- `src/core/channel-setup/planning/ChannelSetupPlanningService.ts`
- `src/core/channel-setup/planning/ChannelSetupFacetSnapshotFailures.ts`
- Focused channel setup planning tests under `src/core/channel-setup/__tests__/`
  only when needed to prove DCR-2-D1 without touching DCR-7 cache/progress or
  fixture-consolidation ownership.
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` only for controller-owned closeout after
  implementation/review is clean.

## Files Out Of Scope

- `src/core/channel-setup/planning/ChannelSetupFacetSnapshotLoader.ts`
- `src/core/channel-setup/planning/ChannelSetupFacetLibraryExecutor.ts`
- `src/core/channel-setup/planning/ChannelSetupFacetSnapshotLoadSession.ts`
  except read-only audit for DCR-2-D1 proof.
- Deep facet loader/executor cache, progress replay, concurrency, and test
  helper cleanup owned by `DCR-7`.
- Broad Plex library behavior, discovery behavior, request/parsing policy, and
  Plex auth/storage contracts.
- `src/modules/plex/discovery/ServerSelectionStore.ts` except read-only audit.
- `src/modules/ui/server-select/*` except read-only audit.
- `src/App.ts` unless a type-only compile failure proves the app-shell channel
  setup runtime source contract cannot be narrowed without it; if so, stop and
  replan before editing.
- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts`
- `src/modules/ui/settings/__tests__/SettingsScreen.test.ts`
- Accepted `ChannelSetupSessionState` normalization import unless
  record-normalization ownership changes.

## Planner Self-Check

1. Unresolved architecture seam? No. The chosen seam is
   `AppShellChannelSetupRuntimePort.getSelectedServerId()` through
   `AppLazyScreenPortFactory`; selected-server storage remains with Plex
   discovery/server-select owners.
2. Adjacent contract changes hidden out of scope? No. Channel setup screen and
   app-shell channel setup port contracts are in scope; Plex discovery and
   server-select storage behavior are frozen.
3. Out-of-scope files implicitly required? No. `App.ts` and Plex discovery are
   explicitly stop/replan surfaces if compile or behavior proof requires them.
4. Codanna evidence path recorded? Yes. Codanna was unavailable; fallback
   source reads and `rg` searches are recorded.
5. Repo-preferred owner? Yes. The plan shrinks a hotspot screen and keeps
   persistence behind typed owners.
6. Would a fresh session invent policy? No. DCR-2-D1 and DCR-2-D2 are resolved
   below, and DCR-7/DCR-10 boundaries are explicit.
7. Execution-grade? Yes. Package issues map to slices, with verification,
   serial execution, and stop/replan triggers fixed.

## Architecture Seam Decision Gate

Decision for `DCR-2-A1`: selected-server access for channel setup is owned by
the app-shell/core channel setup runtime port.

- `ChannelSetupScreen` must call only `screenPorts.getSelectedServerId()` and
  must not import `ServerSelectionStore`, storage utilities, discovery
  constants, or selected-server storage-key getters.
- Remove selected-server and server-health storage-key getters from
  `ChannelSetupScreenPorts` and `AppShellChannelSetupRuntimePort` unless a
  source-backed caller still needs them for channel setup screen construction.
- Keep `AppShellDiagnosticsRuntimePort.getSelectedServerStorageKey()` intact;
  diagnostics are a separate app-shell contract and are not the channel setup
  screen runtime port.
- `ServerSelectionStore.readSelectedServerIdAndClean()` remains owned by Plex
  discovery/server-select flows. Do not move that cleanup logic into
  `ChannelSetupScreen`.

Decision for `DCR-2-D1`: retain the current asymmetric facet failure semantics.

- Playlists and collections are enrichment facets for channel setup planning.
  Fetch failures continue as partial warnings, increment setup error counts, and
  may prevent degraded ready snapshots from being cached, but they do not block
  plan creation by themselves.
- Enabled native tag facets (`genres`, `directors`, `decades`, `actors`,
  `studios`) are required planning facets. Unsupported, empty, non-timeout, and
  count-recovery failures return a `blocked` planning result with a
  `failureReason`; timeout failures return `slow` with transient-load failure
  metadata.
- The owner is `ChannelSetupPlanningService` at the planning boundary, with
  user-facing failure strings produced through
  `ChannelSetupFacetSnapshotFailures`.
- Do not change Plex library facet APIs or DCR-7 loader/executor
  cache/progress/concurrency behavior to implement this decision.

Decision for `DCR-2-D2`: retain string-only UI runtime errors.

- `ChannelSetupSessionContracts` keeps string-only UI error fields and build
  outcomes: `loadError`, `previewError`, `reviewError`, blocked/error
  `message`, and `bookkeepingError`.
- `ChannelSetupSessionRuntime` owns conversion from thrown values/core outcomes
  into user-facing strings at the UI runtime edge.
- Typed error codes, detailed summaries, and failure reasons remain in core
  planning/build contracts and logs; the screen should render strings and must
  not import core error taxonomy for display decisions.
- If a future product requirement needs typed UI error affordances, it must be a
  new feature/design or explicitly approved cleanup package, not hidden inside
  DCR-2.

Stop and replan if any of these are true:

- Removing the Channel Setup UI store dependency requires changing
  `ServerSelectionStore`, `PlexServerDiscovery`, or server-select screen
  persistence ownership.
- `AppShellChannelSetupRuntimePort.getSelectedServerId()` cannot preserve
  current channel setup behavior without changing `App.ts`, `AppOrchestrator`,
  or core server-selection contracts beyond narrow type fallout.
- UI error shape changes become user-visible behavior, require typed UI
  affordances, or require importing core error taxonomy into
  `ChannelSetupScreen`.
- Facet failure work expands into DCR-7 cache hit/invalidation/cacheability,
  progress replay, concurrent waiter behavior, executor option narrowing, or
  fixture consolidation.
- Facet failure work requires changing broad Plex library parser/request
  contracts instead of planning-boundary semantics.
- Verification would require broad manual/webOS proof beyond targeted Jest
  coverage, source audits, typecheck, and `npm run verify`.
- DCR-10 boundaries become implicated by adding coverage to unrelated
  `ChannelManager.test.ts` or `SettingsScreen.test.ts`.

## Package Decomposition

package_id: `DCR-2`
checklist_token: `DCR-2`
package_issue_ids: `DCR-2-A1`, `DCR-2-D1`, `DCR-2-D2`
ready_now_execution_unit: `DCR-2-WAVE1`
ready_now_slice: `DCR-2-S1`
recommended_slice_order: `DCR-2-S1`, `DCR-2-S2`, `DCR-2-S3`
parallel_execution_policy: serial only; parallel cleanup_worker execution is
not approved for this package.

slice_table:

| slice_id | goal | areas/files | exact_issue_ids | verification | dependencies | stop_condition | handoff_condition | serial_only or parallel_group | parallel_justification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DCR-2-S1` | Remove selected-server persistence leakage from Channel Setup UI and narrow the app-shell channel setup screen port to selected-server runtime state only. | `ChannelSetupScreen.ts`; `ChannelSetupScreenPorts.ts`; `AppLazyScreenPortFactory.ts`; `AppShellRuntimeContracts.ts`; focused app-shell/UI tests. | `DCR-2-A1` | Contract tests proving channel setup screen input no longer exposes storage-key getters, runtime port still exposes `getSelectedServerId()`, and source audit shows no `ServerSelectionStore`/selected-server storage import in channel setup UI. | None. | Replan if removal requires changing Plex discovery/server-select storage ownership, `ServerSelectionStore`, or broad app/orchestrator contracts. | Screen gets selected server only through `screenPorts.getSelectedServerId()`; no channel setup UI store construction remains; targeted tests pass. | serial_only | This slice changes shared app-shell/UI port shape and should land before runtime contract assertions are finalized. |
| `DCR-2-S2` | Settle and protect the UI runtime error contract as string-only. | `ChannelSetupSessionContracts.ts`; `ChannelSetupSessionRuntime.ts`; `ChannelSetupSessionState.ts`; channel setup session tests. | `DCR-2-D2` | Targeted session runtime/controller tests or existing-test audit proving load, preview/review, build error, blocked message, and bookkeeping warning are strings; typecheck proves no typed UI error union is introduced. | After S1 so selected-server accessor cleanup is reflected in session tests if needed. | Replan if implementation needs typed UI error objects, user-visible error affordance changes, or core error taxonomy imports in UI. | String-only UI error contract is recorded in source/tests; all runtime outcomes still render through string fields. | serial_only | Shares UI/session contracts with S1 and should not run in parallel against the same tests. |
| `DCR-2-S3` | Settle facet failure semantics at the channel setup planning boundary without entering DCR-7. | `ChannelSetupPlanningService.ts`; `ChannelSetupFacetSnapshotFailures.ts`; focused channel setup planning/failure tests or source audit; no loader cache/progress/concurrency edits. | `DCR-2-D1` | Existing or added focused tests prove collection/playlist failures continue as warnings/ready degradation while native tag/count failures return `blocked` or `slow`; source audit confirms no DCR-7-owned behavior changed. | After S2 in the approved serial wave. | Replan if proof requires changing loader cacheability, progress replay, concurrency, executor options, Plex library APIs, or broad fixture consolidation. | D1 behavior is source-backed, tested or explicitly covered by existing tests, and no DCR-7 ownership is modified. | serial_only | Planning failure semantics touch adjacent DCR-7 files by audit and must stay in one controlled package review. |

coverage_check:

| package_issue_id | planned disposition |
| --- | --- |
| `DCR-2-A1` | Retired by `DCR-2-S1`; no residual accepted. |
| `DCR-2-D1` | Resolved by retaining current asymmetric planning-boundary semantics in `DCR-2-S3`; no residual accepted unless current-source proof contradicts existing tests, in which case stop/replan. |
| `DCR-2-D2` | Resolved by retaining string-only UI runtime errors in `DCR-2-S2`; no residual accepted. |

execution_waves:

| wave_id | slice_ids | completion_condition | absorb_now_scope | replan_triggers |
| --- | --- | --- | --- | --- |
| `DCR-2-WAVE1` | `DCR-2-S1`, `DCR-2-S2`, `DCR-2-S3` | All DCR-2 issues/decisions retired, targeted tests and source audits pass, `npm run verify` passes, and implementation review is clean. | Same DCR-2 owner, same listed files/seams, same verification envelope, no DCR-7/DCR-10 expansion, and no new final-owner accounting. | Any stop condition from the seam gate; new owner; new files outside scope; materially wider verification; DCR-7 or DCR-10 ownership becomes necessary. |

coverage_ledger:

| package_issue_id | wave_id | final owner |
| --- | --- | --- |
| `DCR-2-A1` | `DCR-2-WAVE1` | channel setup UI/core boundary owner |
| `DCR-2-D1` | `DCR-2-WAVE1` | channel setup UI/core boundary owner |
| `DCR-2-D2` | `DCR-2-WAVE1` | channel setup UI/core boundary owner |

Accepted residuals:

- `ChannelSetupSessionState` -> `normalizeChannelSetupConfig` remains accepted.
  Owner: channel setup record-normalization owner. Revisit trigger: setup-record
  normalization ownership changes or `DCR-EXIT` source reconciliation disproves
  the current accepted baseline.

## Verification Commands

Primary verification mode: `contract-first` with supporting
`refactor-invariance`.

Plan classification: `new regression/contract test required`.

Plan/document validation after creating or refreshing this plan:

- `npm run plans:check`
  - Expected: passes and recognizes this active DCR-2 checklist-linked plan as
    satisfying Universal Plan Core plus Cleanup Overlay.

Implementation/source verification for `DCR-2-WAVE1`:

- `rg -n "ServerSelectionStore|readSelectedServerIdAndClean|getSelectedServerStorageKey|getServerHealthStorageKey" src/modules/ui/channel-setup src/core/app-shell/AppLazyScreenPortFactory.ts src/core/app-shell/AppShellRuntimeContracts.ts`
  - Expected: no `ServerSelectionStore` or `readSelectedServerIdAndClean` hit in
    `src/modules/ui/channel-setup`; no storage-key getter remains on the channel
    setup screen/runtime port; diagnostics/server-select may still own their
    separate contracts outside this audit target.
- `rg -n "getSelectedServerStorageKey|getServerHealthStorageKey" src/modules/ui/channel-setup`
  - Expected: no hits after S1.
- `npm test -- --runTestsByPath src/core/app-shell/__tests__/AppLazyScreenPortFactory.test.ts src/core/app-shell/__tests__/AppShellRuntimeContracts.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.contracts.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupSessionRuntime.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotFailures.test.ts`
  - Expected: passes, including selected-server port shape, string-only runtime
    errors, and retained facet failure semantics.
- `npm run typecheck`
  - Expected: passes with narrowed port types and no typed UI error union.
- `npm run verify`
  - Expected: passes because the package touches UI, app-shell runtime ports,
    persistence boundaries, and channel setup planning behavior.

Documentation/checklist verification if implementation or closeout changes
`ARCHITECTURE_CLEANUP_CHECKLIST.md`, current architecture docs, API/reference
docs, workflow docs, launcher docs, or this active plan beyond normal plan
progress:

- `npm run verify:docs`
  - Expected: passes after any checklist/current-state/API/reference/control
    plane updates.

Why this depth matches the risk: S1 narrows a shared app-shell/UI port and
removes a persistence bypass, so contract tests and source audits are required.
S2 and S3 primarily freeze existing contracts, but they are user-visible setup
failure paths; existing coverage may be reused only when the worker explicitly
names the proof. The full `npm run verify` gate is required by repo policy for
UI, persistence, app-shell, and planning/runtime source work.

## Rollback Notes

If selected-server access regresses, roll back the S1 port narrowing as one
unit: restore the previous `ChannelSetupScreenPorts` and
`AppShellChannelSetupRuntimePort` shape together with the matching factory/tests.
Do not reintroduce `ServerSelectionStore` into `ChannelSetupScreen` as a partial
rollback without a maintainer-approved replan.

If string-only UI errors prove insufficient, revert the typed-error attempt and
replan as a feature/design or approved cleanup package with UI affordance scope.

If facet failure semantics regress, revert only DCR-2 planning-boundary edits and
keep DCR-7 cache/progress/concurrency files untouched unless a DCR-7 replan is
approved.

## Commit Checkpoints

- One focused implementation commit for `DCR-2-WAVE1` source/test changes after
  targeted verification and `npm run verify` pass, excluding active plan
  progress edits unless the controller explicitly chooses a separate docs commit.
- Controller closeout may update `ARCHITECTURE_CLEANUP_CHECKLIST.md` and archive
  or delete this active plan after implementation and review are clean.
- Keep any checklist/current-state/reference doc closeout in a separate docs
  commit from worker source/test changes when practical.

## NEXT_SESSION_HANDOFF

PLAN: `docs/plans/2026-04-29-dcr-2-channel-setup-ui-persistence-runtime-contract.md`
TASK: Execute `ready_now_execution_unit` `DCR-2-WAVE1`, starting with
`ready_now_slice` `DCR-2-S1`.
MODE: Tier 3 `cleanup-loop` implementation through `cleanup_worker`, then
reviewer.

ready_now_execution_unit: `DCR-2-WAVE1`
ready_now_slice: `DCR-2-S1`

Do not implement outside the approved wave. Stop and replan if selected-server
cleanup needs Plex discovery/server-select ownership changes, if UI errors need
typed objects, or if facet semantics expand into DCR-7 loader/executor
cache/progress/concurrency ownership.
