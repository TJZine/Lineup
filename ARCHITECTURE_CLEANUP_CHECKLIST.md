# Architecture Cleanup Checklist

> V6 package-backed execution model established `2026-04-16` from the reconciled `2026-04-16` `desloppify` baseline.
>
> Supersedes the pre-package-migration draft archived at `docs/archive/checklists/2026-04-16-architecture-cleanup-checklist-v5-pre-package-migration.md`.
>
> Historical `2026-04-16` exact issue membership belongs to `docs/architecture/active-cleanup-package-map.json`. The live `2026-04-23` fresh-baseline queue uses `docs/architecture/p11-fresh-baseline-package-map.json`. Local planning bundles under `docs/runs/` are historical planning context only and are not authority.

This document preserves the historical `2026-04-16` cleanup closeout record and now carries the live `2026-04-23` fresh-baseline follow-on queue. It stays concise at the package layer while preserving checklist-resident gate scaffolding, mini-record expectations, and `P#-W#` / `P#-EXIT` execution discipline.

As of `2026-04-23`, the original `2026-04-16` no-drop closeout path has been operationally superseded by a full `.desloppify` reset and a ground-up rerun. The fresh baseline record is `docs/runs/2026-04-p10-plans/2026-04-23-p10-w1-fresh-baseline-reset-and-ground-up-rerun.md`; the old companion-map/no-drop proof remains historical evidence only unless this checklist is explicitly rewritten back onto the old lineage.

The live post-reset follow-on queue is defined by `docs/architecture/p11-fresh-baseline-package-map.json`, with supporting rationale and mechanical adjudication recorded in `docs/runs/2026-04-p11-plans/2026-04-23-p11-fresh-baseline-follow-on-queue.md`.

## Fresh-Session Handoff

- Last structural refresh: `2026-04-16`
- Prior completed ledger: `docs/archive/checklists/2026-04-16-architecture-cleanup-checklist-wave-4.md`
- Current execution state: `P1-W1` through `P10-W1` are now historical evidence for the retired `2026-04-16` lineage; `P11-W1`, `P11-W2`, `P11-W3`, and `P11-W4` are complete and `P11-W5` is the next live fresh-baseline package from the authoritative `2026-04-23` rerun
- Next safe start: `P11-W5` / `pkg_player_recovery_contract_cleanup`
- Preferred launcher: `cleanup-loop` for checklist-linked cleanup orchestration, keeping planning and package closeout scoped to the active package or exit row
- First action at package start: planning only; create the package-local execution-grade plan first and do not begin implementation until that planning gate is complete
- Authoritative evidence rule: only integration-branch `desloppify` reruns may change backlog status, package completion claims, exit records, or closeout claims
- Historical exact issue-membership surface: `docs/architecture/active-cleanup-package-map.json`
- Active fresh-baseline exact issue-membership surface: `docs/architecture/p11-fresh-baseline-package-map.json`
- Historical planning context only: local run bundles under `docs/runs/`

## Goals

- retire every live `2026-04-23` fresh-baseline review issue and the highest-value overlapping mechanical hotspots
- keep one explicit owner package for every active fresh-baseline review issue and every mechanical hotspot intentionally absorbed into the same seam
- keep the `2026-04-16` no-drop lineage available as historical evidence without letting it drive active scope
- preserve checklist-resident gates while keeping the live backlog readable

## Non-Goals

- do not treat `docs/runs/...` artifacts as the live authority surface
- do not dump raw non-review issue ids into this checklist
- do not reopen retired hotspots because of stale wording alone
- do not claim closeout on bookkeeping, suppressions, or prose-only cleanup

## Operating Contract

- work top to bottom unless explicit maintainer direction says otherwise
- keep the authoritative execution state in Codex `update_plan`
- before code changes begin, create an execution-grade plan for the selected `P#-W#`; keep it local by default and promote it to `docs/plans/*` only when durable handoff memory is needed
- the checklist owns package rows and gate records; the active companion map owns exact review-id membership and bounded candidate scoping files for the live queue
- refresh the listed authoritative `desloppify` commands at package entry and exit on the integration branch
- no `P(n+1)` work, tracked plan, or checklist progress starts before the current `P#-EXIT` is complete

## Mini-Record Contract

Every work unit and every exit gate keeps the same compact ledger:

- `Status`: `not started`, `in progress`, `blocked`, or `completed`
- `Plan`: exact tracked plan path, `local-only`, or `none yet`
- `Last touched`: exact date or `not started`
- `Verification`: exact latest commands and whether they passed; `not run` is explicit
- `Follow-ups`: exact inherited or deferred residuals with one owner, or `none yet`
- `Handoff`: next safe step, next owner, or blocking condition

Do not check a box unless the mini-record is updated in the same pass with current evidence.

## Package Exit Expectations

Every `P#-EXIT` must, in the same pass:

- record mapped review dispositions from the tracked companion map rather than inline checklist ids
- refresh the package-local scoping commands and record detector-count deltas that matter for that package
- refresh `desloppify show security --status open --no-budget --top 50` as security triage
- record entry baseline, exit baseline, and delta; if neither `overall` nor `strict` improves, keep the exit open unless every survivor has one exact later owner or an explicit `accepted residue` disposition with rationale and revisit trigger
- keep exact residual ownership in the companion map and this checklist synchronized

## Execution Hygiene

- Disposition vocabulary:
  - `stale-proven`: the exact mapped issue is absent on current source, and the rerun evidence plus current-source inspection prove the tracked complaint was stale rather than silently dropped.
  - `resolved`: the exact mapped issue or package-owned rationale is retired on current source and backed by fresh rerun evidence.
  - `accepted residue`: the issue still reruns open, but current-source review shows the detector hit is intentionally accepted with explicit rationale and revisit trigger because implementation work is low-value or unjustified on current source.
  - `deferred`: the issue stays open, but the record names the exact current owner, reason, and revisit trigger.
  - `split follow-up`: the current package is not the final owner; the remaining live gap is handed to one exact successor owner.
  - `owned follow-up`: the exact successor owner named by a `split follow-up` record; every deferred or split item must have one single final owner.
  - `priority-exit review`: the blocking review run after the package work item and before any `P(n+1)` work, plan, or checklist progress begins.
- Ownership rule:
  - keep one single final owner for every deferred or split follow-up item.
  - `accepted residue` closes locally and does not require a successor owner, but it must keep one explicit rationale and revisit trigger.
  - detector lag alone is not a reason to invent a new successor owner.
- Cleanup slice execution template:
  - `priority/work units`: exact `P#-W#` items in scope for the slice
  - `imported review issues`: exact mapped issue ids or the exact companion-map package section being retired
  - `security triage`: `no open P0 security findings`, or the exact deferred or resolved `P0` security findings for the slice
  - `verification`: exact commands that prove the slice is complete
  - `deferred items`: anything intentionally left open with one exact owner, reason, and revisit trigger
  - `proof matrix`: for each mapped imported issue or package-owned rationale, record whether the slice-owned rationale is retired on current source, whether live residual debt remains, the single final owner, and the revisit trigger if anything remains open
- Priority exit command checklist:
  - rerun `desloppify status`
  - rerun `desloppify plan queue --sort recent`
  - rerun `desloppify show review --status open --no-budget --top 100`
  - rerun `desloppify show security --status open --no-budget --top 50`
  - rerun the package-local scoping commands for the closing priority
  - rerun the strongest task-specific verification used by the closing work item
- confirm every mapped imported issue or package-owned rationale for the priority is either retired here, `accepted residue` with rationale and revisit trigger, or explicitly deferred or split with one single final owner, reason, and revisit trigger
  - do not mark progress on `P(n+1)` work until the current priority-exit review is complete and the `P#-EXIT` record is complete

## Fresh Evidence Snapshot

### Active `2026-04-23` Baseline

- `276` total open
- `39` fresh review
- `237` raw non-review
- estimated meaningful mechanical backlog: roughly `30-40`, with roughly `10-15` likely worth fixing soon
- active package count: `6` fresh-baseline work units under `P11`

### Commands Observed In This Session

- `desloppify status`: `overall 85.9 / objective 97.2 / strict 85.9 / verified 97.2`; `276` open; `Review: 39 issues open`; `Queue: 1 item (54 stale tracked · 1 subjective)`
- `desloppify plan queue --sort recent`: `Queue: 1 item (54 planned · 1 subjective)` with one residual subjective placeholder row
- `desloppify show review --status open --no-budget --top 100`: `39` open review issues
- `desloppify show security --status open --no-budget --top 50`: no open security/cycles issues
- `.desloppify/state-typescript.json` non-review detector split: `smells 108`, `structural 85`, `facade 8`, `signature 8`, `stale_exclude 7`, `responsibility_cohesion 6`, `flat_dirs 5`, `single_use 4`, `test_coverage 3`, `boilerplate_duplication 2`, `naming 1`
- active-queue conclusion for this pass: the `2026-04-23` reset rerun is the live backlog model; the old `2026-04-16` queue-trust numbers are archival only

### Historical `2026-04-16` Snapshot

- `216` total open
- `161` older live non-review
- `41` fresh review
- `14` fresh non-review
- historical package count: `9` backlog work units, with queue-trust preflight and final rerun/no-drop proof outside that package count

### Current-Source Guardrails

- `src/Orchestrator.ts` remains a thin public barrel and is not, by itself, proof of a reopened hotspot
- `src/modules/ui/channel-setup/ChannelSetupSessionController.ts` should not be re-elevated without fresh current-source proof
- `src/modules/plex/auth/plexAuthPayloadParsers.ts` is not a standalone hotspot absent new evidence

## Queue-Trust Gate

### [x] `P0-W1` Queue-Trust Preflight And Package-Map Lock

- Goal: retire queue-order ambiguity before package execution starts and make the package-backed model the only live checklist truth
- Evidence captured in this session:
  - `desloppify status` reports `209` open with scores `overall 87.7 / strict 87.6`
  - `desloppify plan` still renders a stale ordered queue surface
  - `desloppify plan queue --sort recent` is empty despite `54` planned items, proving queue order is not the right execution surface
  - `desloppify next` is empty, proving queue order is not the right execution surface
  - `desloppify show review --status open --no-budget --top 100` still reports `41` live open review issues
  - `desloppify show security --status open --no-budget --top 50` reports no open security/cycles issues
  - the authoritative backlog is now reconciled to `216 = 161 older live non-review + 41 fresh review + 14 fresh non-review`; the `209` count above is a historical preflight snapshot only
  - this checklist now routes exact issue membership to `docs/architecture/active-cleanup-package-map.json` and treats `docs/runs/...` as historical context only
- Status: completed
- Plan: local-only controller-approved migration directive
- Last touched: `2026-04-16`
- Verification: `desloppify status`, `desloppify plan`, `desloppify plan queue --sort recent`, `desloppify next`, `desloppify show review --status open --no-budget --top 100`, and `desloppify show security --status open --no-budget --top 50` observed in this session
- Follow-ups: none yet
- Handoff: `P0-EXIT`

- [x] `P0-EXIT` Lock Queue Trust Before Package Execution

- Required closeout met in this pass: stale queue-order surfaces were demoted from backlog authority, the package-backed row model replaced the old draft, the tracked companion path is now the exact issue-membership surface for live execution, and the old queue/review/security reads were refreshed before exposing `P1-W1` as the next safe start
- Entry baseline: `desloppify status` observed in this session as `overall 87.7 / objective 96.6 / strict 87.6 / verified 94.2`, `209` open
- Exit baseline: `desloppify plan queue --sort recent` is empty, `desloppify show review --status open --no-budget --top 100` still reports `41` open review issues, and `desloppify show security --status open --no-budget --top 50` reports no open security/cycles issues; no integration-branch scan rerun performed in this docs-only migration pass
- Status: completed
- Plan: local-only controller-approved migration directive
- Last touched: `2026-04-16`
- Verification: `desloppify status`, `desloppify plan`, `desloppify plan queue --sort recent`, `desloppify next`, `desloppify show review --status open --no-budget --top 100`, and `desloppify show security --status open --no-budget --top 50` observed in this session; no integration-branch scan rerun performed in this pass
- Follow-ups: none yet
- Handoff: `P1-W1`

## Package Backlog

### [x] `P1-W1` `pkg_control_plane_runtime` Control-Plane Runtime Ownership

- Backlog: `32 = 21 older live non-review + 7 fresh review + 4 fresh non-review`
- Scope: retire the orchestrator/runtime hotspot cluster, narrow builder-bag assembly, and restore owner-honest navigation-facing control-plane seams
- Exact membership: `docs/architecture/active-cleanup-package-map.json` -> `pkg_control_plane_runtime`
- Package-local scoping commands:
  - `desloppify show src/core/orchestrator --status open --no-budget --top 150`
  - `desloppify show src/modules/navigation --status open --no-budget --top 120`
  - `desloppify show structural --status open --no-budget --top 150`
  - `desloppify show smells --status open --no-budget --top 250`
- Status: completed
- Plan: `docs/plans/2026-04-16-p1-w1-control-plane-runtime-ownership.md`
- Last touched: `2026-04-17`
- Verification: `npm run verify` passed on `2026-04-17`; targeted slice envelopes passed for `P1-W1-S3` (`src/__tests__/Orchestrator.test.ts`, `src/__tests__/orchestrator/event-wiring.test.ts`, `src/core/orchestrator/__tests__/OrchestratorPriorityOneControllerFactory.playbackState.test.ts`, `src/core/orchestrator/__tests__/OrchestratorRecoverableRuntimeReporter.test.ts`) and `P1-W1-S4` (`src/core/orchestrator/__tests__/OrchestratorEventBinder.test.ts`, `src/core/orchestrator/__tests__/OrchestratorEventCleanupReporter.test.ts`, `src/core/orchestrator/__tests__/OverlayPorts.test.ts`, `src/core/orchestrator/__tests__/OrchestratorCoordinatorBuilders.test.ts`, `src/__tests__/Orchestrator.test.ts`, `src/modules/navigation/__tests__/FocusManager.test.ts`, `src/modules/navigation/__tests__/NavigationManager.test.ts`, `src/modules/navigation/__tests__/NavigationCoordinator.test.ts`); package-local `desloppify show src/core/orchestrator --status open --no-budget --top 150`, `desloppify show src/modules/navigation --status open --no-budget --top 120`, `desloppify show structural --status open --no-budget --top 150`, and the mapped exact-row reruns were refreshed on `2026-04-17`
- Follow-ups: `P1-EXIT` is the single final owner for the remaining package-local orchestrator residue, including live `PriorityOneControllerFactory` complexity/nested-closure rows, live runtime-fallback rows in `AppOrchestrator.ts` / `OrchestratorRecoverableRuntimeReporter.ts`, and stale detector lag still pointing at `OrchestratorPriorityOneControllerFactory.ts` / `OverlayRuntimePolicyController.ts`
- Handoff: `P1-EXIT`

- [x] `P1-EXIT`

  - required: record every mapped imported issue with an exact disposition, assign one single final owner for every deferred or split follow-up, and record the package score delta before moving to `P2`
  - required: refresh package-local commands, record mapped review dispositions from `pkg_control_plane_runtime`, record detector deltas and security triage, and either post a score delta or assign one exact later owner for every survivor
- Required closeout met in this pass: refreshed the exact survivor reruns for the five remaining `P1-EXIT` smell rows, reran the package-local scoping commands plus security/queue-trust/status checks, reran the strongest targeted Jest envelopes and full `npm run verify`, and reconciled every remaining mapped survivor bucket as `resolved` or `stale-proven` on current source without opening `P2`
- Status: completed
- Plan: local-only closeout pass
- Last touched: `2026-04-17`
- Verification: refreshed closeout evidence on `2026-04-17` includes passing runs of `desloppify status`, `desloppify plan queue --sort recent`, `desloppify show review --status open --no-budget --top 100`, `desloppify show security --status open --no-budget --top 50`, `desloppify show src/core/orchestrator --status open --no-budget --top 150`, `desloppify show src/modules/navigation --status open --no-budget --top 120`, `desloppify show structural --status open --no-budget --top 150`, `desloppify show "flat_dirs::src/core/orchestrator" --status open --no-budget --top 20`, the exact survivor reruns for `smells::src/core/orchestrator/AppOrchestrator.ts::{console_error_no_throw,swallowed_error}`, `smells::src/core/orchestrator/OrchestratorRecoverableRuntimeReporter.ts::console_error_no_throw`, and `smells::src/core/orchestrator/priority-one/PriorityOneControllerFactory.ts::{nested_closure,high_cyclomatic_complexity}`, helper-row reruns for `test_coverage::src/core/orchestrator/{OrchestratorRecoverableRuntimeResult,OrchestratorRecoverableRuntimeWarnings,OrchestratorRuntimeSeams}.ts::transitive_only` plus `test_coverage::src/core/orchestrator/priority-one/PriorityOneControllerCollaborators.ts::transitive_only`, targeted Jest `npm test -- --runInBand --runTestsByPath src/core/orchestrator/__tests__/OrchestratorRecoverableRuntimeReporter.test.ts src/__tests__/Orchestrator.test.ts src/core/orchestrator/__tests__/OrchestratorPriorityOneControllerFactory.playbackState.test.ts src/core/orchestrator/__tests__/OrchestratorRecoverableRuntimeResult.test.ts src/core/orchestrator/__tests__/OrchestratorRecoverableRuntimeWarnings.test.ts src/core/orchestrator/__tests__/PriorityOneControllerCollaborators.test.ts`, full `npm run verify`, and post-edit `npm run verify:docs`
- Entry baseline: package entry used the checklist-backed `2026-04-16` status snapshot `overall 87.7 / objective 96.6 / strict 87.6 / verified 94.2`, `209` open
- Exit baseline: `desloppify status` rerun on `2026-04-17T10:06:21+00:00` reports `overall 87.5 / objective 96.1 / strict 87.5 / verified 94.1`, `319` open in-scope, with `typescript` slow phases skipped
- Score delta: `overall -0.2`, `strict -0.1`; `P1-EXIT` closes because every mapped `pkg_control_plane_runtime` survivor is now retired or `stale-proven` on current source despite the worse score
- Imported review dispositions: `review::.::holistic::abstraction_fitness::orchestrator_builder_passthrough_bags`, `review::.::holistic::abstraction_fitness::single_impl_runtime_interfaces`, `review::.::holistic::cross_module_architecture::navigation_depends_on_orchestrator_runtime_seam`, `review::.::holistic::design_coherence::app_orchestrator_remains_runtime_hub`, `review::.::holistic::design_coherence::priority_one_runtime_assembly_is_still_one_large_factory_step`, `review::.::holistic::high_level_elegance::runtime_owner_concentration`, and `review::.::holistic::package_organization::core_priority_one_root_residue` all reran absent on `2026-04-17` and are treated as `resolved` on current source
- Detector deltas: entry mapped package counts were `review 7 / structural 8 / smells 14 / test_coverage 2 / flat_dirs 1`; refreshed exit reads are `review 0 / structural 0 / flat_dirs 0`, `src/modules/navigation` clean, and the former `P1-EXIT` exact-smell survivors now all disagree with current source. `smells::src/core/orchestrator/AppOrchestrator.ts::console_error_no_throw` still reruns open, but its cited line `376` is only the constructor call closing `createDefaultRecoverableRuntimeIssueReporter(...)` and the file contains no `console.error`, so it is `stale-proven`. `smells::src/core/orchestrator/AppOrchestrator.ts::swallowed_error` still reruns open, but its cited line `1978` is the declaration of `_persistSelectedServerForActiveUser(...)`, whose body has no `try`/`catch`, so it is `stale-proven`. `smells::src/core/orchestrator/OrchestratorRecoverableRuntimeReporter.ts::console_error_no_throw` still reruns open, but its cited line `27` is only the optional `warningSink` property and the file emits through `RecoverableRuntimeWarningSink` with the default console-backed sink using `console.warn`, so it is `stale-proven`. `smells::src/core/orchestrator/priority-one/PriorityOneControllerFactory.ts::{nested_closure,high_cyclomatic_complexity}` still rerun open, but the current file is only `43` lines long and the reported anchors (`78`, `111`, `148`, `203`, `235`) are impossible on current source; the exported factory is straight-line collaborator wiring, so both rows are `stale-proven`. `test_coverage::src/core/orchestrator/OrchestratorRuntimeSeams.ts::transitive_only` remains `stale-proven` from the earlier direct-test reconciliation. `smells::src/core/orchestrator/OrchestratorPriorityOneControllerFactory.ts::{monster_function,nested_closure,high_cyclomatic_complexity}` and `smells::src/core/orchestrator/OverlayRuntimePolicyController.ts::voided_symbol` remain detector-lag disagreements and stay `stale-proven` on the previously captured current-source proof. Package-local `transitive_only` rows now also rerun for `OrchestratorRecoverableRuntimeResult.ts`, `OrchestratorRecoverableRuntimeWarnings.ts`, and `priority-one/PriorityOneControllerCollaborators.ts`, but direct test files import those helpers directly and the rows are not part of `pkg_control_plane_runtime` companion-map membership, so `P1-EXIT` does not inherit them here
- Follow-ups: none
- Handoff: `P2-W1` is the next safe checklist start, but no `P2` plan or implementation work opened in this pass

### [x] `P2-W1` `pkg_app_shell_shared_ui` App-Shell, Shared UI, And Persistence Seams

- Backlog: `39 = 33 older live non-review + 6 fresh review + 0 fresh non-review`
- Scope: keep app-shell wiring on package-owned seams, finish shared UI persistence assembly cleanup, and hold non-EPG shared UI residue in one execution surface
- Exact membership: `docs/architecture/active-cleanup-package-map.json` -> `pkg_app_shell_shared_ui`
- Package-local scoping commands:
  - `desloppify show src/core/app-shell --status open --no-budget --top 150`
  - `desloppify show src/modules/ui/mini-guide --status open --no-budget --top 120`
  - `desloppify show src/modules/ui/now-playing-info --status open --no-budget --top 120`
  - `desloppify show src/modules/ui/playback-options --status open --no-budget --top 120`
  - `desloppify show src/modules/ui/player-osd --status open --no-budget --top 120`
  - `desloppify show src/modules/ui/settings --status open --no-budget --top 120`
  - `desloppify show src/modules/ui/common --status open --no-budget --top 100`
  - `desloppify show src/styles --status open --no-budget --top 80`
  - `desloppify show src/bootstrap.ts --status open --no-budget --top 50`
  - `desloppify show src/__tests__/App.test.ts --status open --no-budget --top 50`
- Companion-map leaf review required at entry/exit: confirm the exact package-owned facade leaves in `channel-badge`, `channel-number-overlay`, `sleep-timer`, and `theme` from `pkg_app_shell_shared_ui`; do not treat the command list alone as exhaustive closure proof
- Status: completed
- Plan: `docs/plans/2026-04-17-p2-w1-app-shell-shared-ui-persistence-seams.md`
- Last touched: `2026-04-17`
- Verification: targeted slice tests passed across `P2-W1` slices on `2026-04-17`; `npm run verify:docs` passed during `P2-W1-S5`; package-level `npm run verify` passed on `2026-04-17` after the reopened `P2-W1-S2` and `P2-W1-S4` CSS lint fixes
- Follow-ups: `P2-EXIT` must refresh authoritative package-local `desloppify` reruns, security triage, detector deltas, and exit evidence before `P3`
- Handoff: `P2-EXIT`

- [x] `P2-EXIT`

  - required: record every mapped imported issue with an exact disposition, assign one single final owner for every deferred or split follow-up, and record the package score delta before moving to `P3`
  - required: refresh package-local commands, record mapped review dispositions from `pkg_app_shell_shared_ui`, record detector deltas and security triage, and either post a score delta or assign one exact later owner for every survivor
- Status: completed
- Plan: `docs/plans/2026-04-17-p2-w1-app-shell-shared-ui-persistence-seams.md`
- Last touched: `2026-04-18`
- Verification: `W3` on `2026-04-18` preserved the clean package-local reruns for `src/core/app-shell`, `src/modules/ui/now-playing-info`, `src/modules/ui/settings`, `src/styles`, and `src/__tests__/App.test.ts`, and added exact current-source proof that `smells::src/bootstrap.ts::nested_closure` is stale-proven after the bootstrap debug API helper extraction. The final-gate rerun on `2026-04-18` then reran the required priority-exit commands `desloppify status`, `desloppify plan queue --sort recent`, `desloppify show review --status open --no-budget --top 100`, and `desloppify show security --status open --no-budget --top 50`; reran the package-local scoping commands for `src/core/app-shell`, `src/modules/ui/{mini-guide,now-playing-info,playback-options,player-osd,settings,common}`, `src/styles`, `src/bootstrap.ts`, and `src/__tests__/App.test.ts`; reran every mapped imported review issue id from `docs/architecture/active-cleanup-package-map.json`; reran every mapped package issue id to reconcile current-source absences vs stale detector rows; completed a fresh `desloppify scan --skip-slow --no-badge`; and used the already gathered final-gate evidence recorded below as authoritative closeout proof
- Entry baseline: checklist-backed package entry was `39 = 33 older live non-review + 6 fresh review + 0 fresh non-review` with global `desloppify status` snapshot `overall 87.7 / objective 96.6 / strict 87.6 / verified 94.2`
- Exit baseline: authoritative final-gate evidence on `2026-04-18` recorded `npm run verify` passed after `W3`; `desloppify status` and `desloppify scan --skip-slow --no-badge` both at `overall 87.5 / objective 96.1 / strict 87.5 / verified 94.1`; `desloppify status` with `324` open in-scope, `333` open global, and `9` out-of-scope carried; `desloppify plan queue --sort recent` reported the queue empty; `desloppify show review --status open --no-budget --top 100` returned no open review issues; and `desloppify show security --status open --no-budget --top 50` remained clean
- Score delta: global `overall -0.2`, `objective -0.5`, `strict -0.1`, and `verified -0.1` from the checklist entry baseline to the final `2026-04-18` closeout rerun. Those final numbers are authoritative for `P2-EXIT`, and no live imported review debt, package-local blocker, or queued follow-up remained after the rerun
- Imported review dispositions: reran absent on `2026-04-18`, treated as `resolved` on current source
  - `review::.::holistic::high_level_elegance::orchestrator_public_barrel_backflow`
    - reason: exact issue-id rerun no longer reports an open review row after the app-shell import cleanup
    - revisit trigger: exact issue-id rerun plus `rg -n "src/Orchestrator|\\.\\./Orchestrator|\\.\\./\\.\\./Orchestrator" src/core/app-shell src/__tests__/App.test.ts src/bootstrap.ts`
  - `review::.::holistic::high_level_elegance::types_package_role_drift`
    - reason: exact issue-id rerun no longer reports an open review row after retiring `src/types/index.ts` and routing channel keys through the canonical storage-key surface
    - revisit trigger: exact issue-id rerun plus `rg -n "STORAGE_KEYS|src/types/index" src`
  - `review::.::holistic::incomplete_migration::internal_orchestrator_barrel_drift`
    - reason: exact issue-id rerun no longer reports an open review row after the app-shell barrel cleanup
    - revisit trigger: exact issue-id rerun plus `rg -n "AppOrchestrator|OrchestratorTypes|src/Orchestrator" src/core/app-shell`
  - `review::.::holistic::mid_level_elegance::ui_owned_persistence_seams`
    - reason: exact issue-id rerun no longer reports an open review row after removing app-shell `SettingsStore` assembly and retiring the `src/types` storage-key import path
    - revisit trigger: exact issue-id rerun plus `rg -n "new SettingsStore\\(|STORAGE_KEYS|src/types/index" src/core/app-shell src`
  - `review::.::holistic::cross_module_architecture::lazy_screen_contracts_live_in_concrete_ui_files`
    - reason: exact issue-id rerun no longer reports an open review row after switching lazy-screen loaders and screen-port types onto package-root seams
    - revisit trigger: exact issue-id rerun plus `rg -n "AuthScreen|AudioSetupScreen|ChannelSetupScreen|ProfileSelectScreen|ServerSelectScreen|SettingsScreen|ChannelSetupScreenPorts|new SettingsStore\\(" src/core/app-shell/AppLazyScreenRegistry.ts src/core/app-shell/AppLazyScreenPortFactory.ts`
  - `review::.::holistic::convention_outlier::playback_options_root_surface_bypass`
    - reason: exact issue-id rerun no longer reports an open review row after `PlayerOsdCoordinator` moved to the `playback-options` package root export
    - revisit trigger: exact issue-id rerun plus `rg -n "playback-options/(PlaybackOptionsCoordinator|types)" src`
- Detector/survivor summary: all P2 mapped rows and supplemental closeout rows are now either rerun-resolved or stale-proven on current source; no live `P2-EXIT` survivor remains after `W3` plus the final-gate rerun
  - mapped stale-proven rows:
    - `logs::src/modules/ui/mini-guide/MiniGuideCoordinator.ts::MiniGuideCoordinator`
      - reason: `W1` proved the reported detector/source disagreement is stale; the exact anchor is the toast-only `switchToChannel(...).catch(...)` path and test coverage proves notifyToast-only failure handling
      - revisit trigger: rerun the exact issue id if mini-guide channel-switch failure handling changes
    - `smells::src/modules/ui/common/ScreenShell.ts::monster_function`
      - reason: `W2` proved stale detector wording on a current `ScreenShell.ts` wrapper that is only `10` lines long
      - revisit trigger: rerun the exact issue id if `ScreenShell.ts` regrows beyond a thin wrapper
    - `smells::src/bootstrap.ts::hardcoded_color`
      - reason: `W2` proved the anchor lands near `handleUnhandledRejection`; there are no color literals or style color assignments in current `bootstrap.ts`
      - revisit trigger: rerun the exact issue id if startup wiring reintroduces color/style literals
    - `smells::src/modules/ui/playback-options/PlaybackOptionsCoordinator.ts::console_error_no_throw`
      - reason: `W2` proved the anchor lands on a guard clause and the file contains no `console.error`
      - revisit trigger: rerun the exact issue id if playback-options logging/error paths change
    - `smells::src/modules/ui/player-osd/PlayerOsdCoordinator.ts::voided_symbol`
      - reason: `W2` proved the anchor lands on a normal binding and the file contains no `void` usage
      - revisit trigger: rerun the exact issue id if player-OSD command dispatch adds `void` calls
  - supplemental stale-proven rows:
    - `smells::src/modules/ui/common/OverlayPrimitives.ts::high_cyclomatic_complexity`
      - reason: `W1` proved stale detector/source disagreement; the current helper shape does not match the reported branch count
      - revisit trigger: rerun the exact issue id if `OverlayPrimitives.ts` grows new branching paths
    - `smells::src/modules/ui/common/ScreenShell.ts::high_cyclomatic_complexity`
      - reason: `W2` proved stale detector wording on the current `10` line wrapper and the reported anchors are impossible on current source
      - revisit trigger: rerun the exact issue id if `ScreenShell.ts` stops being a thin wrapper
    - `smells::src/modules/ui/common/ScreenShell.ts::nested_closure`
      - reason: `W2` proved stale detector wording on the current `10` line wrapper and the reported anchors are impossible on current source
      - revisit trigger: rerun the exact issue id if `ScreenShell.ts` regains nested control flow
    - `smells::src/bootstrap.ts::console_error_no_throw`
      - reason: `W2` proved the anchors hit comments and object-return fields while real logging is funneled through `logSanitizedError()`
      - revisit trigger: rerun the exact issue id if bootstrap error logging stops routing through `logSanitizedError()`
    - `smells::src/bootstrap.ts::nested_closure`
      - reason: `W3` plus final review proved the previous rerun anchor is stale; the rerun still points at line `142`, but current line `142` is a plain helper after the bootstrap debug API helper extraction and the prior nested-closure cluster is gone
      - revisit trigger: rerun the exact issue id if bootstrap control flow regains nested closure-heavy startup wiring
    - `test_coverage::src/modules/ui/common/ScreenShellView.ts::transitive_only`
      - reason: final-gate review proved stale detector output; `ScreenShell.test.ts` directly imports `createScreenShellView` and directly tests it, so this row is not current companion-map membership
      - revisit trigger: rerun the exact issue id if direct `ScreenShellView` coverage is removed or remapped
  - package-local command results remain clean for `src/core/app-shell`, `src/modules/ui/now-playing-info`, `src/modules/ui/settings`, `src/styles`, and `src/__tests__/App.test.ts`
  - the rerun-open package-local rows in `src/modules/ui/mini-guide`, `src/modules/ui/playback-options`, `src/modules/ui/player-osd`, `src/bootstrap.ts`, and `src/modules/ui/common` were reconciled as stale-proven detector lag, not live P2 blockers
- Resolved-on-rerun groups: `review 6`, `structural 15`, `facade 4`, `single_use 1`, `smells 3`, and `css_monolith 5` reran absent on current source; the remaining rerun-open package-local rows were closed as stale-proven detector lag during final-gate reconciliation
- Security triage: `desloppify show security --status open --no-budget --top 50` remained clean with no open security or cycle issues
- Follow-ups: preserve the stale-proven rows above unless future current-source changes invalidate their proof; `P3-W1` is now the next safe start
- Handoff: `P2-EXIT` closed on authoritative `2026-04-18` final-gate evidence; proceed to `P3-W1`

### [x] `P3-W1` `pkg_plex_contracts_identity` Plex Contracts And Identity

- Backlog: `19 = 11 older live non-review + 6 fresh review + 2 fresh non-review`
- Scope: normalize Plex discovery, library, auth, and identity/error seams under one Plex-owned package
- Exact membership: `docs/architecture/active-cleanup-package-map.json` -> `pkg_plex_contracts_identity`
- Package-local scoping commands:
  - `desloppify show src/modules/plex/discovery --status open --no-budget --top 120`
  - `desloppify show src/modules/plex/library --status open --no-budget --top 150`
  - `desloppify show src/modules/plex/auth --status open --no-budget --top 150`
  - `desloppify show test_coverage --status open --no-budget --top 120`
- Status: completed
- Plan: `docs/plans/2026-04-18-p3-w1-plex-contracts-identity.md`
- Last touched: `2026-04-18`
- Verification: authoritative closeout evidence on `2026-04-18` reran `desloppify show src/modules/plex/discovery --status open --no-budget --top 120`, `desloppify show src/modules/plex/library --status open --no-budget --top 150`, `desloppify show src/modules/plex/auth --status open --no-budget --top 150`, and `desloppify show test_coverage --status open --no-budget --top 120`; observed passing `npm test -- --runInBand src/modules/plex/discovery/__tests__/discoveryProbe.test.ts`; observed passing `npm test -- --runInBand src/modules/plex/library/__tests__/mediaItemInternals.test.ts src/modules/plex/library/__tests__/mediaFileParser.test.ts src/modules/plex/library/__tests__/libraryResponsePayload.test.ts src/modules/plex/library/__tests__/PlexLibraryError.test.ts`; and observed passing `npm run verify`
- Follow-ups: `P3-EXIT` must preserve the stale-proven detector rows below unless future current-source changes invalidate their proof
- Handoff: `P3-EXIT`

- [x] `P3-EXIT`

  - required: record every mapped imported issue with an exact disposition, assign one single final owner for every deferred or split follow-up, and record the package score delta before moving to `P4`
  - required: refresh package-local commands, record mapped review dispositions from `pkg_plex_contracts_identity`, record detector deltas and security triage, and either post a score delta or assign one exact later owner for every survivor
- Status: completed
- Plan: `docs/plans/2026-04-18-p3-w1-plex-contracts-identity.md`
- Last touched: `2026-04-18`
- Verification: `P3-EXIT` evidence on `2026-04-18` reran `desloppify status`, `desloppify plan queue --sort recent`, `desloppify show review --status open --no-budget --top 100`, `desloppify show security --status open --no-budget --top 50`, the six exact imported-review reruns for `review::.::holistic::{api_surface_coherence::{plex_discovery_scalar_test_result,plex_library_failure_contract_drift},error_consistency::{plex_auth_pin_parsing_bypasses_typed_errors,plex_auth_poll_timeout_masks_retryable_failures,plex_library_null_results_mask_fetch_failures},initialization_coupling::platform_version_first_probe_cache}`, the package-local scoping commands for `src/modules/plex/{discovery,library,auth}` plus `test_coverage`, the exact reruns for `test_coverage::src/modules/plex/discovery/discoveryProbe.ts::transitive_only` and `smells::src/modules/plex/library/mediaItemBaseParser.ts::high_cyclomatic_complexity`, the focused Jest commands recorded in `P3-W1`, and a passing `npm run verify`
- Entry baseline: checklist-backed package entry was `19 = 11 older live non-review + 6 fresh review + 2 fresh non-review` with the `P2-EXIT` global snapshot `overall 87.5 / objective 96.1 / strict 87.5 / verified 94.1`, `324` open in-scope, `333` open global, and `9` out-of-scope carried
- Exit baseline: authoritative `desloppify status` rerun in this session reports `overall 87.5 / objective 96.0 / strict 87.5 / verified 94.0`, `340` open in-scope, `349` open global, and `9` out-of-scope carried; `desloppify plan queue --sort recent` is empty; `desloppify show review --status open --no-budget --top 100` returns no open review issues; and `desloppify show security --status open --no-budget --top 50` remains clean
- Score delta: global `overall 0.0`, `objective -0.1`, `strict 0.0`, and `verified -0.1` versus the checklist-backed entry snapshot. `P3-EXIT` closes anyway because every mapped `pkg_plex_contracts_identity` review issue reran absent and every remaining discovery/library detector row is `stale-proven` on current source with no successor owner
- Imported review dispositions: reran absent on `2026-04-18`, treated as `resolved` on current source
  - `review::.::holistic::api_surface_coherence::plex_discovery_scalar_test_result`
    - reason: exact issue-id rerun no longer reports an open review row after `P3-W1-S2`, and the current discovery seam keeps typed internal probe results behind the unchanged outward discovery contract
    - revisit trigger: exact issue-id rerun plus `rg -n "testConnection\\(|findFastestConnection\\(|selectServer\\(" docs/api/plex-integration.md src/modules/plex/discovery/interfaces.ts src/modules/plex/discovery`
  - `review::.::holistic::api_surface_coherence::plex_library_failure_contract_drift`
    - reason: exact issue-id rerun no longer reports an open review row after `P3-W1-S3`, and current library entrypoints keep malformed/transport/server failures in typed `PlexLibraryError` paths instead of semantic empties
    - revisit trigger: exact issue-id rerun plus `rg -n "_fetchWithRetry<|return null;|return \\[\\];|PlexLibraryError" src/modules/plex/library`
  - `review::.::holistic::error_consistency::plex_auth_pin_parsing_bypasses_typed_errors`
    - reason: exact issue-id rerun no longer reports an open review row after `P3-W1-S1`, and auth PIN parsing now routes malformed success payloads through typed Plex auth error handling
    - revisit trigger: exact issue-id rerun plus `rg -n "parsePinResponse\\(" src/modules/plex/auth`
  - `review::.::holistic::error_consistency::plex_auth_poll_timeout_masks_retryable_failures`
    - reason: exact issue-id rerun no longer reports an open review row after `P3-W1-S1`, and `pollForPin()` no longer collapses retryable failure context into a terminal timeout-only classification
    - revisit trigger: exact issue-id rerun plus `rg -n "pollForPin\\(" src/modules/plex/auth`
  - `review::.::holistic::error_consistency::plex_library_null_results_mask_fetch_failures`
    - reason: exact issue-id rerun no longer reports an open review row after `P3-W1-S3`, and current library parse/fetch helpers keep failure cases in typed error flows rather than `null`/empty sentinel returns
    - revisit trigger: exact issue-id rerun plus `rg -n "return null;|return \\[\\];|PlexLibraryError" src/modules/plex/library`
  - `review::.::holistic::initialization_coupling::platform_version_first_probe_cache`
    - reason: exact issue-id rerun no longer reports an open review row after `P3-W1-S1`, and Plex startup plus stream identity now consume one platform-owned version source instead of split auth-vs-stream probing
    - revisit trigger: exact issue-id rerun plus `rg -n "platformVersion|detectPlatformVersion\\(" src/modules/plex src/platform src/core/app-shell`
- Detector deltas: entry mapped package counts were `review 6 / structural 6 / smells 6 / responsibility_cohesion 1`; refreshed exit reads are `review 0`, `src/modules/plex/auth` clean, `src/modules/plex/discovery` with `2` rerun-open rows, `src/modules/plex/library` with `8` rerun-open rows, and `desloppify show test_coverage --status open --no-budget --top 120` still listing the same six Plex helper transitive-only rows beside unrelated repo rows. Current-source reconciliation proves those remaining Plex rows are detector lag, not live `P3-W1` debt:
  - `test_coverage::src/modules/plex/discovery/discoveryProbe.ts::transitive_only`
    - reason: stale-proven; current direct test file `src/modules/plex/discovery/__tests__/discoveryProbe.test.ts` (lines `1-98`) imports `findFastestConnectionProbe` directly and exercises both mixed-content selection and auth-summary outcomes, but the rerun still reports “No direct tests”
    - revisit trigger: rerun the exact issue id if direct `discoveryProbe` coverage is removed or remapped
  - `smells::src/modules/plex/discovery/discoveryProbe.ts::async_no_await`
    - reason: stale-proven; the reported anchor is current line `18`, but `src/modules/plex/discovery/discoveryProbe.ts` awaits `probeConnection(connection)` at line `33`, so the current source does not match the detector wording
    - revisit trigger: rerun the exact issue id if `findFastestConnectionProbe()` is rewritten to a new async control-flow shape
  - library helper `transitive_only` rows on `PlexLibraryError.ts`, `libraryResponsePayload.ts`, `mediaFileParser.ts`, `mediaItemCoreParser.ts`, and `mediaItemDetailsParser.ts`
    - reason: stale-proven; direct tests import each helper directly via `src/modules/plex/library/__tests__/PlexLibraryError.test.ts`, `src/modules/plex/library/__tests__/libraryResponsePayload.test.ts`, `src/modules/plex/library/__tests__/mediaFileParser.test.ts`, and `src/modules/plex/library/__tests__/mediaItemInternals.test.ts`, but the reruns still report “No direct tests”
    - revisit trigger: rerun the exact issue ids if those direct helper tests are removed or remapped
  - `smells::src/modules/plex/library/mediaItemCoreParser.ts::high_cyclomatic_complexity`, `smells::src/modules/plex/library/mediaItemBaseParser.ts::high_cyclomatic_complexity`, and `smells::src/modules/plex/library/mediaItemParser.ts::high_cyclomatic_complexity`
    - reason: stale-proven; `src/modules/plex/library/mediaItemCoreParser.ts` is a straight parse-build-apply pipeline, `src/modules/plex/library/mediaItemBaseParser.ts` is now a thin wrapper over `buildMediaIdentity()` and `buildMediaMetadata()`, and `src/modules/plex/library/mediaItemParser.ts` is a `parseArrayOrEmpty(...).map(...)` wrapper whose reported anchor `21` is impossible on current source
    - revisit trigger: rerun the exact issue ids if those helpers regrow branching logic or merge back into a larger parser hotspot
- Security triage: `desloppify show security --status open --no-budget --top 50` remained clean with no open security or cycle issues
- Follow-ups: preserve the stale-proven discovery/library detector rows above unless future current-source changes invalidate their proof; no deferred or split successor owner remains after `P3-EXIT`
- Handoff: `P4` remained blocked until this `P3-EXIT` record was completed. With `P3-EXIT` now complete on authoritative `2026-04-18` evidence, `P4-W1` is unblocked and is the next safe checklist start

### [x] `P4-W1` `pkg_startup_auth_lifecycle` Startup, Auth, Profile, And Lifecycle State

- Backlog: `23 = 15 older live non-review + 6 fresh review + 2 fresh non-review`
- Scope: make startup/session state honest across auth expiry, profile selection, initialization, error normalization, and lifecycle timing
- Exact membership: `docs/architecture/active-cleanup-package-map.json` -> `pkg_startup_auth_lifecycle`
- Package-local scoping commands:
  - `desloppify show src/core/initialization --status open --no-budget --top 150`
  - `desloppify show src/core/InitializationCoordinator.ts --status open --no-budget --top 80`
  - `desloppify show src/core/__tests__/InitializationCoordinator.test.ts --status open --no-budget --top 50`
  - `desloppify show src/core/error-recovery --status open --no-budget --top 80`
  - `desloppify show src/modules/ui/auth --status open --no-budget --top 120`
  - `desloppify show src/modules/ui/profile-select --status open --no-budget --top 120`
  - `desloppify show src/modules/ui/server-select --status open --no-budget --top 120`
  - `desloppify show src/modules/lifecycle --status open --no-budget --top 120`
- Status: completed
- Plan: `docs/plans/2026-04-18-p4-w1-startup-auth-lifecycle.md`
- Last touched: `2026-04-18`
- Verification: authoritative closeout evidence on `2026-04-18` reran `desloppify scan`, `desloppify show src/core/initialization --status open --no-budget --top 150`, `desloppify show src/core/InitializationCoordinator.ts --status open --no-budget --top 80`, `desloppify show src/core/__tests__/InitializationCoordinator.test.ts --status open --no-budget --top 50`, `desloppify show src/core/error-recovery --status open --no-budget --top 80`, `desloppify show src/modules/ui/auth --status open --no-budget --top 120`, `desloppify show src/modules/ui/profile-select --status open --no-budget --top 120`, `desloppify show src/modules/ui/server-select --status open --no-budget --top 120`, and `desloppify show src/modules/lifecycle --status open --no-budget --top 120`; observed passing `npm test -- --runInBand src/core/initialization/__tests__/InitializationStartupPolicy.test.ts src/core/__tests__/InitializationCoordinator.test.ts src/modules/plex/auth/__tests__/PlexAuth.test.ts`; observed passing `npm test -- --runInBand src/core/__tests__/InitializationCoordinator.test.ts src/modules/lifecycle/__tests__/AppLifecycle.test.ts`; observed passing `npm test -- --runInBand src/core/error-recovery/__tests__/RecoveryActions.test.ts src/modules/ui/auth/__tests__/AuthScreen.test.ts src/modules/ui/profile-select/__tests__/ProfileSelectScreen.test.ts src/modules/ui/server-select/__tests__/ServerSelectScreen.test.ts src/core/initialization/__tests__/RecoverableModuleStatusError.test.ts`; observed `rg -n "console\\.error|getRecoveryActions\\(|toRecoverableModuleStatusError\\(" src/core/error-recovery src/core/initialization src/modules/ui/auth src/modules/ui/profile-select src/modules/ui/server-select`; and observed passing `npm run verify`
- Follow-ups: `P4-EXIT` must preserve the stale-proven detector rows below unless future current-source changes invalidate their proof
- Handoff: `P4-EXIT`

- [x] `P4-EXIT`

  - required: record every mapped imported issue with an exact disposition, assign one single final owner for every deferred or split follow-up, and record the package score delta before moving to `P5`
  - required: refresh package-local commands, record mapped review dispositions from `pkg_startup_auth_lifecycle`, record detector deltas and security triage, and either post a score delta or assign one exact later owner for every survivor
- Status: completed
- Plan: `docs/plans/2026-04-18-p4-w1-startup-auth-lifecycle.md`
- Last touched: `2026-04-18`
- Verification: `P4-EXIT` evidence on `2026-04-18` reran `desloppify status`, `desloppify plan queue --sort recent`, `desloppify show review --status open --no-budget --top 100`, `desloppify show security --status open --no-budget --top 50`, the six exact imported-review reruns for `review::.::holistic::{authorization_consistency::{profile_select_auth_resume_gap,startup_invalid_active_token_persisted},initialization_coupling::plex_auth_constructor_storage_side_effect,logic_clarity::lifecycle_promise_semantics_hide_real_timing,low_level_elegance::phase2_auth_gate_branch_stack,test_strategy::startup-error-normalization-gap}`, the package-local scoping commands for `src/core/{initialization,error-recovery,InitializationCoordinator.ts,__tests__/InitializationCoordinator.test.ts}`, `src/modules/ui/{auth,profile-select,server-select}`, and `src/modules/lifecycle`, the exact reruns for `responsibility_cohesion::src/modules/lifecycle/AppLifecycle.ts::cohesion::src/modules/lifecycle/AppLifecycle.ts`, `smells::src/core/InitializationCoordinator.ts::non_null_assert`, `smells::src/core/error-recovery/RecoveryActions.ts::high_cyclomatic_complexity`, `smells::src/core/initialization/InitializationStartupPolicy.ts::{console_error_no_throw,high_cyclomatic_complexity}`, `smells::src/modules/ui/{auth/AuthScreen.ts::console_error_no_throw,profile-select/styles.css::css_monolith,server-select/ServerSelectScreen.ts::console_error_no_throw}`, `test_coverage::src/core/initialization/RecoverableModuleStatusError.ts::transitive_only`, and the mapped structural ids for `InitializationCoordinator`, `AppLifecycle.test.ts`, `AuthScreen.ts`, `ProfileSelectScreen{.ts,.test.ts}`, and `ServerSelectScreen{.ts,.test.ts}`; observed the slice-targeted Jest commands recorded in `P4-W1`; observed a passing `npm run verify`; and observed fresh implementation review with no material findings on commit `f5a9f222`
- Entry baseline: checklist-backed package entry was `23 = 15 older live non-review + 6 fresh review + 2 fresh non-review` with the `P3-EXIT` global snapshot `overall 87.5 / objective 96.0 / strict 87.5 / verified 94.0`, `340` open in-scope, `349` open global, and `9` out-of-scope carried
- Exit baseline: authoritative `desloppify status` rerun in this session reports `overall 87.6 / objective 96.2 / strict 87.5 / verified 94.3`, `336` open in-scope, `345` open global, and `9` out-of-scope carried; `desloppify plan queue --sort recent` is empty; `desloppify show review --status open --no-budget --top 100` returns no open review issues; and `desloppify show security --status open --no-budget --top 50` remains clean
- Score delta: global `overall +0.1`, `objective +0.2`, `strict 0.0`, and `verified +0.3` versus the checklist-backed entry snapshot. `P4-EXIT` closes because every mapped imported review, structural, and cohesion row reran absent and every remaining rerun-open startup/auth/profile/recovery row is `stale-proven` on current source with no successor owner
- Imported review dispositions: reran absent on `2026-04-18`, treated as `resolved` on current source
  - `review::.::holistic::authorization_consistency::profile_select_auth_resume_gap`
    - reason: exact issue-id rerun no longer reports an open review row after `P4-W1-S2`, and current startup resume policy routes both server-select and profile-select restart paths through `InitializationCoordinator`
    - revisit trigger: exact issue-id rerun plus `rg -n "prepareForProfileSwitchAttempt|resumeStartupAfterProfileSwitch|registerProfileResume|registerServerResume" src/core/InitializationCoordinator.ts src/core/orchestrator/AppOrchestrator.ts`
  - `review::.::holistic::authorization_consistency::startup_invalid_active_token_persisted`
    - reason: exact issue-id rerun no longer reports an open review row after `P4-W1-S1`, and current phase-2 auth startup rewrites persisted credentials to the validated account-owned token path instead of leaving a stale invalid active token behind
    - revisit trigger: exact issue-id rerun plus `rg -n "persistValidated(AccountFallback|ActiveCredentials)|storeCredentials\\(" src/core/initialization/InitializationStartupPolicy.ts src/modules/plex/auth/PlexAuth.ts`
  - `review::.::holistic::initialization_coupling::plex_auth_constructor_storage_side_effect`
    - reason: exact issue-id rerun no longer reports an open review row after `P4-W1-S1`, and startup now owns the explicit credential-read path while `PlexAuth` no longer hydrates stored credentials in the constructor
    - revisit trigger: exact issue-id rerun plus `rg -n "_loadStoredCredentials|readStoredCredentialsAndClearCorruption" src/modules/plex/auth/PlexAuth.ts src/core/initialization/InitializationStartupPolicy.ts`
  - `review::.::holistic::logic_clarity::lifecycle_promise_semantics_hide_real_timing`
    - reason: exact issue-id rerun no longer reports an open review row after `P4-W1-S2`, and lifecycle restoration now exposes the restored phase before the auth-start transition instead of masking it behind an unconditional rewrite
    - revisit trigger: exact issue-id rerun plus `rg -n "stateRestored|authenticating|loading_data" src/modules/lifecycle/AppLifecycle.ts`
  - `review::.::holistic::low_level_elegance::phase2_auth_gate_branch_stack`
    - reason: exact issue-id rerun no longer reports an open review row after `P4-W1-S1`, and the phase-2 auth gate now routes through named persistence/profile helpers rather than one constructor-coupled branch stack
    - revisit trigger: exact issue-id rerun plus `rg -n "applyPhase2AuthGatePolicy|persistValidated(AccountFallback|ActiveCredentials)|maybeRouteToProfileSelect" src/core/initialization/InitializationStartupPolicy.ts`
  - `review::.::holistic::test_strategy::startup-error-normalization-gap`
    - reason: exact issue-id rerun no longer reports an open review row after `P4-W1-S3`, and startup error normalization now has a direct focused test owner in `src/core/initialization/__tests__/RecoverableModuleStatusError.test.ts`
    - revisit trigger: exact issue-id rerun plus `rg -n "toRecoverableModuleStatusError\\(" src/core/initialization src/core/error-recovery`
- Detector deltas: entry mapped package counts were `review 6 / structural 5 / smells 5 / responsibility_cohesion 1 / test_coverage 1`; refreshed exit reads are `review 0`, `src/core/InitializationCoordinator.ts` clean, `src/core/__tests__/InitializationCoordinator.test.ts` clean, `src/modules/lifecycle` clean, `src/core/initialization` with `3` rerun-open rows, `src/core/error-recovery` with `3` rerun-open rows, `src/modules/ui/auth` with `1` rerun-open row, `src/modules/ui/profile-select` with `1` rerun-open row, and `src/modules/ui/server-select` with `1` rerun-open row. Current-source reconciliation proves those remaining startup/auth/profile/recovery rows are detector lag, not live `P4-W1` debt:
  - mapped stale-proven rows:
    - `smells::src/core/initialization/InitializationStartupPolicy.ts::console_error_no_throw`
      - reason: stale-proven; `rg -n "console\\.error" src/core/initialization/InitializationStartupPolicy.ts` returns no hits, and the rerun still cites line `244`, which is now the `validateToken(...)` call inside `applyPhase2AuthGatePolicy()`
      - revisit trigger: rerun the exact issue id if startup auth logging/error handling changes in `InitializationStartupPolicy.ts`
    - `smells::src/core/initialization/InitializationStartupPolicy.ts::high_cyclomatic_complexity`
      - reason: stale-proven; the rerun still anchors line `104`, which is now only `inputs.openServerSelect();`, while the current phase-2 helper set is split across `applyPhase2AuthGatePolicy()`, `maybeRouteToProfileSelect()`, and the persistence helpers instead of one hotspot branch stack
      - revisit trigger: rerun the exact issue id if phase-2 auth gating is merged back into one larger control-flow owner
    - `smells::src/core/error-recovery/RecoveryActions.ts::high_cyclomatic_complexity`
      - reason: stale-proven; the rerun still anchors line `10`, but current `getRecoveryActions()` is a lookup-based helper at lines `127-140` with one guard and one table lookup, not a branch-heavy switch
      - revisit trigger: rerun the exact issue id if `RecoveryActions.ts` regrows switch-style branching instead of the current data-driven mapping
    - `smells::src/modules/ui/auth/AuthScreen.ts::console_error_no_throw`
      - reason: stale-proven; `rg -n "console\\.error" src/modules/ui/auth/AuthScreen.ts` returns no hits, and the rerun still cites lines `61`, `66`, and `71`, which now only dispatch through `_runScreenAction(...)`
      - revisit trigger: rerun the exact issue id if startup PIN request/cancel/retry handling reintroduces console-only error paths
    - `smells::src/modules/ui/profile-select/styles.css::css_monolith`
      - reason: stale-proven; current `src/modules/ui/profile-select/styles.css` is only a `3`-line import surface delegating to package-local partials `styles/{layout,cards,pin-modal}.css`
      - revisit trigger: rerun the exact issue id if profile-select styles collapse back into one large stylesheet
    - `smells::src/modules/ui/server-select/ServerSelectScreen.ts::console_error_no_throw`
      - reason: stale-proven; `rg -n "console\\.error" src/modules/ui/server-select/ServerSelectScreen.ts` returns no hits, and the rerun still cites lines `96`, `205`, and `584`, which no longer contain console logging
      - revisit trigger: rerun the exact issue id if startup server-select actions or load/select flows reintroduce console-only error handling
    - `test_coverage::src/core/initialization/RecoverableModuleStatusError.ts::transitive_only`
      - reason: stale-proven; direct focused test file `src/core/initialization/__tests__/RecoverableModuleStatusError.test.ts` imports `toRecoverableModuleStatusError()` directly and the targeted Jest command passed in this session, but the rerun still reports “No direct tests”
      - revisit trigger: rerun the exact issue id if that direct test file is removed or the helper stops being imported directly there
  - supplemental stale-proven rows:
    - `smells::src/core/error-recovery/RecoveryActions.ts::monster_function`
      - reason: stale-proven; the rerun still anchors line `10`, but current `RecoveryActions.ts` is `141` lines total and does not contain any `150+` LOC function
      - revisit trigger: rerun the exact issue id if the recovery-action owner regrows into a large monolithic function
    - `smells::src/core/error-recovery/RecoveryActions.ts::nested_closure`
      - reason: stale-proven; the rerun still anchors line `10`, but the current file is a module-level mapping table plus thin helper lookup rather than the earlier nested control-flow hotspot
      - revisit trigger: rerun the exact issue id if recovery-action construction regains nested closure-heavy control flow
- Resolved-on-rerun groups: `review 6`, `structural 5`, and `responsibility_cohesion 1` reran absent on current source; the remaining rerun-open package-local rows were all reconciled as stale-proven detector lag during this final-gate pass
- Security triage: `desloppify show security --status open --no-budget --top 50` remained clean with no open security or cycle issues
- Follow-ups: preserve the stale-proven startup/auth/profile/recovery detector rows above unless future current-source changes invalidate their proof; no deferred or split successor owner remains after `P4-EXIT`
- Handoff: `P5-W1`

### [x] `P5-W1` `pkg_playback_subtitle_recovery` Playback And Subtitle Recovery

- Backlog: `18 = 16 older live non-review + 2 fresh review + 0 fresh non-review`
- Scope: separate generic playback recovery from subtitle-specific policy and keep player/stream recovery cleanup in one execution surface
- Exact membership: `docs/architecture/active-cleanup-package-map.json` -> `pkg_playback_subtitle_recovery`
- Package-local scoping commands:
  - `desloppify show src/modules/player --status open --no-budget --top 150`
  - `desloppify show src/modules/plex/stream --status open --no-budget --top 150`
- Status: completed
- Plan: `docs/plans/2026-04-20-p5-w1-playback-subtitle-recovery.md`
- Last touched: `2026-04-21`
- Verification: observed passing focused Jest commands for `P5-W1-S1` (`src/modules/player/__tests__/PlaybackRecoveryManager.test.ts`, `src/modules/player/__tests__/PlaybackReloadController.test.ts`, `src/modules/player/__tests__/PlaybackStreamDescriptorBuilder.test.ts`), the bounded reload/player follow-up regressions (`src/modules/player/__tests__/VideoPlayer.test.ts`, `src/modules/player/__tests__/PlaybackReloadController.test.ts`, `src/modules/player/__tests__/PlaybackRecoveryManager.test.ts`), `P5-W1-S2` (`src/modules/debug/__tests__/SubtitleDebugLogger.test.ts`, `src/modules/player/__tests__/SubtitleManager.test.ts`, `src/modules/player/__tests__/VideoPlayer.test.ts`), and `P5-W1-S3` (`src/modules/plex/stream/__tests__/PlexStreamResolver.test.ts`, `src/modules/plex/stream/__tests__/SubtitleStreamProbe.test.ts`, `src/modules/plex/stream/__tests__/SubtitleStreamProbeSupport.test.ts`, `src/modules/plex/stream/__tests__/mediaSelectionPolicy.test.ts`); and observed a passing `npm run verify` on `2026-04-21` after the final clean review gate
- Follow-ups: preserve the stale-proven detector rows recorded in `P5-EXIT` unless future current-source changes invalidate that proof; no split successor owner remains after `P5-EXIT`
- Handoff: `P6-W1`

- [x] `P5-EXIT`

  - required: record every mapped imported issue with an exact disposition, assign one single final owner for every deferred or split follow-up, and record the package score delta before moving to `P6`
  - required: refresh package-local commands, record mapped review dispositions from `pkg_playback_subtitle_recovery`, record detector deltas and security triage, and either post a score delta or assign one exact later owner for every survivor
- Status: completed
- Plan: `docs/plans/2026-04-20-p5-w1-playback-subtitle-recovery.md`
- Last touched: `2026-04-21`
- Verification: observed `desloppify status`, `desloppify plan queue --sort recent`, `desloppify show review --status open --no-budget --top 100`, `desloppify show security --status open --no-budget --top 50`, the package-local scoping commands for `src/modules/player` and `src/modules/plex/stream`, exact reruns for `review::.::holistic::{ai_generated_debt::duplicate_subtitle_debug_helpers,design_coherence::playback_recovery_manager_blends_generic_recovery_with_subtitle_policy}`, exact reruns for `logs::src/modules/player/{PlaybackRecoveryManager.ts::PlaybackRecovery,SubtitleManager.ts::SubtitleManager,VideoPlayer.ts::VideoPlayer,PlaybackReloadController.ts::PlaybackRecovery}`, exact reruns for `smells::src/modules/player/{__tests__/SubtitleManager.test.ts::as_any_cast,VideoPlayer.ts::switch_no_default,PlaybackRecoveryManager.ts::console_error_no_throw,PlaybackReloadController.ts::console_error_no_throw}`, `smells::src/modules/plex/stream/{__tests__/mediaSelectionPolicy.test.ts::non_null_assert,__tests__/PlexStreamResolver.test.ts::non_null_assert,PlexStreamResolver.ts::magic_number,SubtitleStreamProbe.ts::monster_function,SubtitleStreamProbe.ts::high_cyclomatic_complexity,SubtitleStreamProbe.ts::nested_closure}`, `test_coverage::src/modules/plex/stream/SubtitleStreamProbeSupport.ts::transitive_only`, exact reruns for the mapped structural ids `structural::src/modules/player/{__tests__/PlaybackRecoveryManager.test.ts,__tests__/SubtitleManager.test.ts,__tests__/VideoPlayer.test.ts,PlaybackRecoveryManager.ts,SubtitleManager.ts,VideoPlayer.ts}` and `structural::src/modules/plex/stream/{__tests__/PlexStreamResolver.test.ts,PlexStreamResolver.ts}`, observed the focused Jest commands recorded under `P5-W1`, and observed a passing `npm run verify`
- Entry baseline: checklist-backed package entry was `18 = 16 older live non-review + 2 fresh review + 0 fresh non-review` with the `P4-EXIT` global snapshot `overall 87.6 / objective 96.2 / strict 87.5 / verified 94.3`, `336` open in-scope, `345` open global, and `9` out-of-scope carried
- Exit baseline: authoritative `desloppify status` rerun in this session reports `overall 87.5 / objective 96.1 / strict 87.5 / verified 94.2`, `355` open in-scope, `364` open global, and `9` out-of-scope carried; `desloppify plan queue --sort recent` is empty; `desloppify show review --status open --no-budget --top 100` returns no open review issues; and `desloppify show security --status open --no-budget --top 50` remains clean
- Score delta: global `overall -0.1`, `objective -0.1`, `strict 0.0`, and `verified -0.1` versus the checklist-backed entry snapshot. `P5-EXIT` closes because every mapped imported review, structural, and non-log smell row reran absent and the remaining mapped playback/player log rows are `stale-proven` on current source with no successor owner
- Imported review dispositions: reran absent on `2026-04-21`, treated as `resolved` on current source
  - `review::.::holistic::ai_generated_debt::duplicate_subtitle_debug_helpers`
    - reason: exact issue-id rerun no longer reports an open review row after `P5-W1-S2`, and subtitle debug ownership now routes through shared `SubtitleDebugLogger` / `PlayerConsoleLogger` helpers instead of duplicating enablement and formatting logic across player and resolver owners
    - revisit trigger: exact issue-id rerun plus `rg -n "SubtitleDebugLogger|PlayerConsoleLogger|_logSubtitleDebug" src/modules/player src/modules/plex/stream`
  - `review::.::holistic::design_coherence::playback_recovery_manager_blends_generic_recovery_with_subtitle_policy`
    - reason: exact issue-id rerun no longer reports an open review row after `P5-W1-S1`, and generic reload sequencing plus descriptor shaping now live behind `PlaybackReloadController` and `PlaybackStreamDescriptorBuilder` while `PlaybackRecoveryManager` keeps the public orchestrator-facing seam stable
    - revisit trigger: exact issue-id rerun plus `rg -n "PlaybackReloadController|PlaybackStreamDescriptorBuilder|attempt(BurnIn|DisableBurnIn|AudioTrack)Reload" src/modules/player`
- Detector deltas: entry mapped package counts were `review 2 / structural 8 / smells 5 / logs 3`; refreshed exit reads are `src/modules/player` with `9` rerun-open rows and `src/modules/plex/stream` with `4` rerun-open rows. Current-source reconciliation proves the remaining mapped `P5` rows are detector lag, not live package debt:
  - mapped stale-proven rows:
    - `logs::src/modules/player/PlaybackRecoveryManager.ts::PlaybackRecovery`
      - reason: stale-proven; `rg -n "console\\.(warn|error)" src/modules/player/PlaybackRecoveryManager.ts src/modules/player/PlaybackReloadController.ts src/modules/player/VideoPlayer.ts src/modules/player/SubtitleManager.ts` returns no hits, and the rerun still cites line `160`, which is now only the blank line before `_readPlayerState(...)` after the S1 extraction
      - revisit trigger: rerun the exact issue id if `PlaybackRecoveryManager.ts` regains direct recovery logging or reabsorbs reload sequencing
    - `logs::src/modules/player/SubtitleManager.ts::SubtitleManager`
      - reason: stale-proven; the rerun still anchors line `90`, which is now only `if (!this._videoElement) return [];`, while subtitle debug emission is routed through the shared `SubtitleDebugLogger` owner created for `P5-W1-S2`
      - revisit trigger: rerun the exact issue id if `SubtitleManager.ts` regains direct logging or duplicates subtitle debug ownership again
    - `logs::src/modules/player/VideoPlayer.ts::VideoPlayer`
      - reason: stale-proven; the rerun still anchors line `992`, which is now only the media-session timestamp-map clear, while `VideoPlayer` delegates structured console writes through `src/modules/debug/PlayerConsoleLogger.ts`
      - revisit trigger: rerun the exact issue id if `VideoPlayer.ts` regains direct player/media-session logging paths
  - supplemental stale-proven rows:
    - `smells::src/modules/player/PlaybackRecoveryManager.ts::console_error_no_throw`
      - reason: stale-proven; the rerun still cites line `164`, but current source at lines `160-166` is only the `_readPlayerState(...)` return boundary and `resetPlaybackFailureGuard()` declaration with no local `console.error`
      - revisit trigger: rerun the exact issue id if `PlaybackRecoveryManager.ts` regains direct error logging instead of delegating to shared helpers
    - `logs::src/modules/player/PlaybackReloadController.ts::PlaybackRecovery`
      - reason: stale-proven; the rerun still cites line `174`, which is now the method closing brace after `_getRecoveryReloadOffset(...)`, while current console writes were moved out into `src/modules/debug/PlayerConsoleLogger.ts`
      - revisit trigger: rerun the exact issue id if `PlaybackReloadController.ts` regains direct tagged logging
    - `smells::src/modules/player/PlaybackReloadController.ts::console_error_no_throw`
      - reason: stale-proven; the rerun still cites impossible line `178`, but current `PlaybackReloadController.ts` ends at line `175` and contains no direct `console.error`
      - revisit trigger: rerun the exact issue id if recovery-reload failure handling moves back into the controller body
    - `smells::src/modules/plex/stream/SubtitleStreamProbe.ts::{monster_function,high_cyclomatic_complexity,nested_closure}`
      - reason: stale-proven; `SubtitleStreamProbe.ts` is now `136` lines total, and the reruns still point at line `51`, which is only the `url` field inside `buildSubtitleProbeSuccessContext(...)` after the probe support split
      - revisit trigger: rerun these exact issue ids if probe request/sample/payload shaping is merged back into one larger control-flow owner
    - `test_coverage::src/modules/plex/stream/SubtitleStreamProbeSupport.ts::transitive_only`
      - reason: stale-proven; direct test file `src/modules/plex/stream/__tests__/SubtitleStreamProbeSupport.test.ts` imports `buildSubtitleStreamProbeRequestContext()` and `readSubtitleProbeSample()` directly and passed in this session, but the rerun still reports “covered only via imports”
      - revisit trigger: rerun the exact issue id if that direct support test is removed or the helper stops being imported directly there
  - package-local non-membership note:
    - `src/modules/player` still reports unrelated pre-existing rows in `AudioTrackManager.ts` and `subtitleFallbackPipeline.ts`, but they are outside `pkg_playback_subtitle_recovery` companion-map membership and were not changed in this pass, so `P5-EXIT` does not re-home them here
- Resolved-on-rerun groups: `review 2`, `structural 8`, and the mapped non-log smell rows (`smells::src/modules/player/__tests__/SubtitleManager.test.ts::as_any_cast`, `smells::src/modules/player/VideoPlayer.ts::switch_no_default`, `smells::src/modules/plex/stream/__tests__/mediaSelectionPolicy.test.ts::non_null_assert`, `smells::src/modules/plex/stream/__tests__/PlexStreamResolver.test.ts::non_null_assert`, `smells::src/modules/plex/stream/PlexStreamResolver.ts::magic_number`) reran absent on current source
- Security triage: `desloppify show security --status open --no-budget --top 50` remained clean with no open security or cycle issues
- Follow-ups: preserve the stale-proven playback/player/probe detector rows above unless future current-source changes invalidate their proof; no deferred or split successor owner remains after `P5-EXIT`
- Handoff: `P6-W1`

### [x] `P6-W1` `pkg_channel_setup_scheduler` Channel Setup And Scheduler Contracts

- Backlog: `41 = 37 older live non-review + 2 fresh review + 2 fresh non-review`
- Scope: keep channel-setup workflow cleanup, scheduler/channel-manager contracts, and channel-tuning residue in one domain-owned package
- Exact membership: `docs/architecture/active-cleanup-package-map.json` -> `pkg_channel_setup_scheduler`
- Package-local scoping commands:
  - `desloppify show src/core/channel-setup --status open --no-budget --top 150`
  - `desloppify show src/core/channel-tuning --status open --no-budget --top 100`
  - `desloppify show src/modules/scheduler/channel-manager --status open --no-budget --top 150`
  - `desloppify show src/modules/scheduler/scheduler --status open --no-budget --top 150`
  - `desloppify show src/modules/ui/channel-setup --status open --no-budget --top 150`
- Status: completed
- Plan: `docs/plans/2026-04-21-p6-w1-channel-setup-scheduler-contracts.md`
- Last touched: `2026-04-21`
- Verification: observed passing focused Jest envelopes for `P6-W1-S1` (`src/core/channel-setup/__tests__/ChannelSetupBuildCommitter.test.ts`, `src/core/channel-setup/__tests__/ChannelSetupBuildExecutor.test.ts`, `src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts`, `src/core/channel-setup/__tests__/ChannelSetupWorkflow.test.ts`, `src/core/channel-setup/__tests__/createChannelSetupWorkflowPort.test.ts`), `P6-W1-S2` (`src/core/channel-setup/__tests__/ChannelSetupPlanner.test.ts`, `src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts`, `src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoader.test.ts`, `src/core/channel-setup/__tests__/ChannelSetupTagFilters.test.ts`), `P6-W1-S3` (`src/core/channel-tuning/__tests__/ChannelTuningCoordinator.test.ts`, `src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts`, `src/modules/scheduler/channel-manager/__tests__/ContentResolver.test.ts`, `src/modules/scheduler/scheduler/__tests__/ChannelScheduler.test.ts`, `src/modules/scheduler/scheduler/__tests__/ScheduleCalculator.test.ts`), and the final `P6-W1-S4` UI/controller surface (`src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts`, `src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts`, `src/modules/ui/channel-setup/__tests__/ChannelSetupSessionRuntime.test.ts`, `src/modules/ui/channel-setup/steps/__tests__/BuildReviewStepController.test.ts`, `src/modules/ui/channel-setup/steps/__tests__/LibraryStepController.test.ts`, `src/modules/ui/channel-setup/steps/__tests__/StrategyStepController.test.ts`, `src/modules/ui/channel-setup/steps/__tests__/StrategyStepInteractionController.test.ts`); observed focused direct-controller coverage of `BuildReviewStepController` `91.08 / 81.35 / 75`, `LibraryStepController` `91.17 / 80 / 75`, `StrategyStepController` `99.39 / 88.02 / 100`, and `StrategyStepInteractionController` `90.18 / 86.81 / 86.95`; and observed a passing `npm run verify` after the final clean `S4` review gate
- Follow-ups: preserve the stale-proven detector rows recorded in `P6-EXIT`; no split successor owner remains after `P6-EXIT`
- Handoff: `P6-EXIT`

- [x] `P6-EXIT`

  - required: record every mapped imported issue with an exact disposition, assign one single final owner for every deferred or split follow-up, and record the package score delta before moving to `P7`
  - required: refresh package-local commands, record mapped review dispositions from `pkg_channel_setup_scheduler`, record detector deltas and security triage, and either post a score delta or assign one exact later owner for every survivor
- Status: completed
- Plan: `docs/plans/2026-04-21-p6-w1-channel-setup-scheduler-contracts.md`
- Last touched: `2026-04-21`
- Verification: observed `desloppify status`, `desloppify plan queue --sort recent`, `desloppify show review --status open --no-budget --top 100`, `desloppify show security --status open --no-budget --top 50`, the package-local scoping commands for `src/core/channel-setup`, `src/core/channel-tuning`, `src/modules/scheduler/channel-manager`, `src/modules/scheduler/scheduler`, and `src/modules/ui/channel-setup`, exact reruns for the mapped review ids `review::.::holistic::contract_coherence::{channel_manager_error_contract_docs_lag_runtime,channel_setup_port_absence_contract_split}`, exact reruns for the mapped detector rows `facade::src/core/channel-tuning/index.ts`, `flat_dirs::src/core/channel-setup`, `logs::src/core/channel-setup/{ChannelSetupBuildCommitter.ts::ChannelSetup,ChannelSetupBuildExecutor.ts::ChannelSetup}`, `smells::src/core/channel-setup/{ChannelSetupBuildCommitter.ts::console_error_no_throw,ChannelSetupBuildCommitter.ts::swallowed_error,ChannelSetupBuildExecutor.ts::catch_return_default,ChannelSetupBuildExecutor.ts::swallowed_error,ChannelSetupFacetSnapshotLoader.ts::sort_no_comparator,ChannelSetupPlanner.ts::sort_no_comparator,ChannelSetupPlanningService.ts::catch_return_default,ChannelSetupTagFilters.ts::high_cyclomatic_complexity}`, `smells::src/core/channel-tuning/ChannelTuningCoordinator.ts::{console_error_no_throw,swallowed_error}`, `smells::src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts::{non_null_assert,stub_function}`, `smells::src/modules/scheduler/scheduler/ChannelScheduler.ts::non_null_assert`, the mapped structural ids under `src/core/channel-setup`, `src/core/channel-tuning`, `src/modules/scheduler/{channel-manager,scheduler}`, and `src/modules/ui/channel-setup`, and the four mapped `test_coverage::src/modules/ui/channel-setup/steps/{BuildReviewStepController,LibraryStepController,StrategyStepController,StrategyStepInteractionController}.ts::transitive_only` ids; observed the focused Jest envelopes recorded under `P6-W1`; and observed a passing `npm run verify`
- Entry baseline: checklist-backed package entry was `41 = 37 older live non-review + 2 fresh review + 2 fresh non-review` with the `P5-EXIT` global snapshot `overall 87.5 / objective 96.1 / strict 87.5 / verified 94.2`, `355` open in-scope, `364` open global, and `9` out-of-scope carried
- Exit baseline: authoritative `desloppify status` rerun in this session reports `overall 87.5 / objective 96.0 / strict 87.5 / verified 94.2`, `361` open in-scope, `370` open global, and `9` out-of-scope carried; `desloppify plan queue --sort recent` is empty; `desloppify show review --status open --no-budget --top 100` returns no open review rows for this package closeout surface; and `desloppify show security --status open --no-budget --top 50` remains clean
- Score delta: global `overall 0.0`, `objective -0.1`, `strict 0.0`, and `verified 0.0` versus the checklist-backed entry snapshot. `P6-EXIT` closes because every mapped review and structural row reran absent and the remaining mapped logs, smells, and direct-test detector rows are all `stale-proven` on current source with no successor owner
- Imported review dispositions: reran absent on `2026-04-21`, treated as `resolved` on current source
  - `review::.::holistic::contract_coherence::channel_manager_error_contract_docs_lag_runtime`
    - reason: exact issue-id rerun no longer reports an open review row after `P6-W1-S3`, and the channel-manager / scheduler path now resolves channel lineup and failure normalization through the tightened scheduler contract surface instead of drifting from the current runtime behavior
    - revisit trigger: exact issue-id rerun plus `rg -n "ChannelManager|ChannelScheduler|schedule" src/modules/scheduler`
  - `review::.::holistic::contract_coherence::channel_setup_port_absence_contract_split`
    - reason: exact issue-id rerun no longer reports an open review row after `P6-W1-S4`, and `ChannelSetupSessionController` now stays wrapper-only over state/runtime while the workflow-edit seam remains bounded behind the channel-setup runtime/state owners
    - revisit trigger: exact issue-id rerun plus `rg -n "workflowPort|updateWorkflow" src/modules/ui/channel-setup`
- Detector deltas: entry mapped package counts were `review 2 / structural 18 / smells 13 / test_coverage 4 / logs 2 / facade 1 / flat_dirs 1`; refreshed exit reads are `review 0 / structural 0 / facade 0 / flat_dirs 0`, `src/modules/scheduler/channel-manager` clean, `src/modules/scheduler/scheduler` clean, and the remaining package-local rerun-open rows all disagree with current source rather than exposing live package debt:
  - mapped stale-proven rows:
    - `logs::src/core/channel-setup/ChannelSetupBuildCommitter.ts::ChannelSetup`
      - reason: stale-proven; `ChannelSetupBuildCommitter.ts` now routes failures into `addWarning(...)` and `logger.error(...)` with no direct `console` writes, but the rerun still points at legacy tagged-log wording
      - revisit trigger: rerun the exact issue id if `ChannelSetupBuildCommitter.ts` regains direct `[ChannelSetup]` console logging
    - `logs::src/core/channel-setup/ChannelSetupBuildExecutor.ts::ChannelSetup`
      - reason: stale-proven; the current executor only records recoverable progress-callback warnings and explicit cancel summaries with no direct `console` writes, but the rerun still points at legacy tagged-log wording
      - revisit trigger: rerun the exact issue id if `ChannelSetupBuildExecutor.ts` regains direct `[ChannelSetup]` console logging
    - `smells::src/core/channel-setup/ChannelSetupBuildCommitter.ts::console_error_no_throw`
      - reason: stale-proven; current source uses `logger.error(...)` plus warning accumulation rather than `console.error`, and the rerun-open smell no longer matches the owner body
      - revisit trigger: rerun the exact issue id if the committer regains direct error logging without surfacing that error through its current warning/result contract
    - `smells::src/core/channel-setup/ChannelSetupBuildCommitter.ts::swallowed_error`
      - reason: stale-proven; current cleanup and refresh failures are converted into explicit warnings returned in the summary contract, not silently discarded
      - revisit trigger: rerun the exact issue id if committer-side failures stop surfacing through returned workflow warnings
    - `smells::src/core/channel-setup/ChannelSetupBuildExecutor.ts::catch_return_default`
      - reason: stale-proven; the current executor rethrows non-abort failures and only returns explicit canceled summaries when the abort signal is set, so the detector wording is lagging older default-return behavior
      - revisit trigger: rerun the exact issue id if non-abort execution failures start collapsing back into default summaries
    - `smells::src/core/channel-setup/ChannelSetupBuildExecutor.ts::swallowed_error`
      - reason: stale-proven; non-abort failures now rethrow and progress-callback failures are surfaced as workflow warnings instead of disappearing locally
      - revisit trigger: rerun the exact issue id if build execution paths start suppressing non-abort failures again
    - `smells::src/core/channel-setup/ChannelSetupFacetSnapshotLoader.ts::sort_no_comparator`
      - reason: stale-proven; `_buildSnapshotKey(...)` currently sorts `selectedLibraryIds` with `localeCompare`, and the smell rerun no longer matches current source
      - revisit trigger: rerun the exact issue id if snapshot key construction regresses to comparator-free sorting
    - `smells::src/core/channel-setup/ChannelSetupPlanner.ts::sort_no_comparator`
      - reason: stale-proven; current `stableStringify(...)` sorts object keys with an explicit `localeCompare` comparator, not a bare default sort
      - revisit trigger: rerun the exact issue id if planner determinism regresses to comparator-free key sorting
    - `smells::src/core/channel-setup/ChannelSetupPlanningService.ts::catch_return_default`
      - reason: stale-proven; the current catch block only returns an explicit canceled-plan result when the abort signal is set and otherwise rethrows
      - revisit trigger: rerun the exact issue id if planning failures begin returning default/canceled results outside the abort contract
    - `smells::src/core/channel-setup/ChannelSetupTagFilters.ts::high_cyclomatic_complexity`
      - reason: stale-proven; the fast-key parsing/filter path is now split across focused helpers instead of one branch-heavy owner
      - revisit trigger: rerun the exact issue id if tag-filter parsing logic recombines into one large control-flow owner
    - `smells::src/core/channel-tuning/ChannelTuningCoordinator.ts::console_error_no_throw`
      - reason: stale-proven; current source uses `console.warn` in the remaining diagnostics path and the rerun-open row still points at older console-error wording
      - revisit trigger: rerun the exact issue id if tuning coordination regains direct `console.error`-without-throw behavior
    - `smells::src/core/channel-tuning/ChannelTuningCoordinator.ts::swallowed_error`
      - reason: stale-proven; the rerun-open anchors no longer describe the current diagnostics/reporting helpers and no live catch-only suppression remains on current source
      - revisit trigger: rerun the exact issue id if tuning coordination reintroduces catch-only suppression without surfaced failure state
    - `test_coverage::src/modules/ui/channel-setup/steps/BuildReviewStepController.ts::transitive_only`
      - reason: stale-proven; direct-import suite `BuildReviewStepController.test.ts` exists and focused coverage observed `91.08 / 81.35 / 75`, but the rerun still reports stale “covered only via imports” wording
      - revisit trigger: rerun the exact issue id if the direct step-controller suite is removed or stops importing the owner directly
    - `test_coverage::src/modules/ui/channel-setup/steps/LibraryStepController.ts::transitive_only`
      - reason: stale-proven; direct-import suite `LibraryStepController.test.ts` exists and focused coverage observed `91.17 / 80 / 75`, but the rerun still reports stale “covered only via imports” wording
      - revisit trigger: rerun the exact issue id if the direct step-controller suite is removed or stops importing the owner directly
    - `test_coverage::src/modules/ui/channel-setup/steps/StrategyStepController.ts::transitive_only`
      - reason: stale-proven; direct-import suite `StrategyStepController.test.ts` exists and focused coverage observed `99.39 / 88.02 / 100`, but the rerun still reports stale “covered only via imports” wording
      - revisit trigger: rerun the exact issue id if the direct strategy-step controller suite is removed or stops importing the owner directly
    - `test_coverage::src/modules/ui/channel-setup/steps/StrategyStepInteractionController.ts::transitive_only`
      - reason: stale-proven; direct-import suite `StrategyStepInteractionController.test.ts` exists and focused coverage observed `90.18 / 86.81 / 86.95`, but the rerun still reports stale “covered only via imports” wording
      - revisit trigger: rerun the exact issue id if the direct strategy-step interaction suite is removed or stops importing the owner directly
- Resolved-on-rerun groups: `review 2`, `structural 18`, `facade 1`, `flat_dirs 1`, and the mapped scheduler/core non-log smell rows (`smells::src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts::{non_null_assert,stub_function}` and `smells::src/modules/scheduler/scheduler/ChannelScheduler.ts::non_null_assert`) reran absent on current source
- Security triage: `desloppify show security --status open --no-budget --top 50` remained clean with no open security or cycle issues
- Follow-ups: preserve the stale-proven channel-setup, channel-tuning, and direct-test detector rows above unless future current-source changes invalidate their proof; no deferred or split successor owner remains after `P6-EXIT`
- Handoff: `P7-W1`

### [x] `P7-W1` `pkg_epg_runtime_surfaces` EPG Runtime And Package Surfaces

- Backlog at package entry: `28 = 23 older live non-review + 5 fresh review + 0 fresh non-review`
- Scope: retire the remaining EPG runtime, view-package, naming, and test hotspot residue under one EPG-owned package
- Exact membership: `docs/architecture/active-cleanup-package-map.json` -> `pkg_epg_runtime_surfaces`
- Current canonical membership after the same-pass companion-map refresh: `32 = 23 older live non-review + 5 fresh review + 4 fresh non-review`
- Package-local scoping commands:
  - `desloppify show src/modules/ui/epg --status open --no-budget --top 180`
  - `desloppify show src/modules/ui/epg/runtime --status open --no-budget --top 120`
  - `desloppify show src/modules/ui/epg/view --status open --no-budget --top 120`
  - `desloppify show security --status open --no-budget --top 50`
- Exact-id review scope required at entry/exit: the mapped review, facade, and structural rows in `pkg_epg_runtime_surfaces` are closed only by exact issue-id checks plus package-local path reruns, because broad facade/structural queries no longer isolate this package in the current CLI
- Status: completed
- Plan: `docs/plans/2026-04-21-p7-w1-epg-runtime-surfaces.md`
- Last touched: `2026-04-21`
- Verification: planning evidence via package-map/current-state reads, Codanna symbol/impact checks, package-local `desloppify` scoping, `desloppify show security --status open --no-budget --top 50`, and the plan-review loop were observed on `2026-04-21`; `P7-W1-S1` passed the slice Jest command for 8 suites / 164 tests, the slice `rg` import/naming audit, exact-id reruns for `review::.::holistic::package_organization::epg_view_leaves_in_root`, `review::.::holistic::naming_quality::boolean_accessor_get_is_drift`, `facade::src/modules/ui/epg/index.ts`, and `facade::src/modules/ui/epg/view/index.ts`, plus `npm run verify`, and review returned clean on `43ad7076b3e4ac904a953f9683e05bde76ddd3bd`; `P7-W1-S2` passed its targeted runtime Jest reruns and `npm run verify`, reran the mapped review/facade ids clean, then passed a non-clean review round, a focused regression-test revision on `16b0540cf2dc451b7a16dbf041036d27f4b90e18`, and a fresh final approval gate on top of `6701df83f12e36d7ffdc5c7290e2469210625b9d`; `P7-W1-S3` passed the targeted component/view Jest reruns, exact-id structural reruns, `npm run verify`, and review clean on `eb0861a7`; `P7-W1-S4` passed the targeted test Jest reruns, exact-id reruns for `flat_dirs::src/modules/ui/epg/__tests__`, `signature::src/modules/ui/epg/__tests__/DeferredEpgComponent.test.ts::signature_variance::makeChannel`, `smells::src/modules/ui/epg/__tests__/EPGChannelList.test.ts::hardcoded_color`, and `smells::src/modules/ui/epg/__tests__/EPGComponent.test.ts::non_null_assert`, then passed review clean on `2c8ee23e`
- Follow-ups: mapped package work is complete. The `2026-04-22` closeout sequence left the remaining rerun-open EPG rows only as current-source-proven detector residue (`buildEpgStartupConfig.ts`, `EPGStartupConfigRuntime.ts`, `domainTypes.ts`, queue `voided_symbol`, existing console-error residues) plus the accepted CSS no-action residue set
- Handoff: `P8-W1`

- [x] `P7-EXIT`

  - required: record every mapped imported issue with an exact disposition, assign one single final owner for every deferred or split follow-up, and record the package score delta before moving to `P8`
  - required: refresh package-local commands, record mapped review dispositions from `pkg_epg_runtime_surfaces`, record detector deltas and security triage, and either post a score delta or assign one exact later owner for every survivor
- Status: completed
- Plan: `docs/plans/2026-04-21-p7-w1-epg-runtime-surfaces.md`
- Last touched: `2026-04-22`
- Verification: final-gate evidence was refreshed on `2026-04-21` via `desloppify status`, `desloppify plan queue --sort recent`, `desloppify show review --status open --no-budget --top 100`, `desloppify show security --status open --no-budget --top 50`, `desloppify show src/modules/ui/epg --status open --no-budget --top 180`, `desloppify show src/modules/ui/epg/runtime --status open --no-budget --top 120`, `desloppify show src/modules/ui/epg/view --status open --no-budget --top 120`, and exact-id reruns for all `28` mapped `pkg_epg_runtime_surfaces` issue ids plus the unmapped EPG watchlist ids surfaced at package entry. The first `2026-04-22` closeout pass then passed `npx jest --runInBand src/modules/ui/epg/__tests__/buildEpgStartupConfig.test.ts src/modules/ui/epg/__tests__/EPGVisibleRangeRefreshQueue.test.ts src/modules/ui/epg/__tests__/domainTypes.test.ts`, `npm run verify`, `desloppify scan --skip-slow --no-badge`, refreshed `desloppify status`, `desloppify plan queue --sort recent`, `desloppify show review --status open --no-budget --top 100`, `desloppify show security --status open --no-budget --top 50`, `desloppify show src/modules/ui/epg --status open --no-budget --top 180`, exact-id reruns for the four canonical non-style rows plus the four EPG CSS watchlist rows, and `npm run verify:docs`. The revision pass on `2026-04-22` then passed `npx jest --runInBand src/modules/ui/epg/__tests__/buildEpgStartupConfig.test.ts src/modules/ui/epg/__tests__/EPGStartupConfigRuntime.test.ts`, reran `desloppify scan --skip-slow --no-badge` twice while tightening `buildEpgStartupConfig.ts`, reran the four non-style exact ids, refreshed `desloppify show src/modules/ui/epg --status open --no-budget --top 180`, and passed `npm run verify`. This final closeout pass on `2026-04-22` reran the five remaining startup/runtime exact ids, refreshed `desloppify show src/modules/ui/epg --status open --no-budget --top 180`, refreshed `desloppify status`, source-audited the cited anchors, and passed `npm run verify:docs`
- Entry baseline: historical checklist-backed package entry scope was `28 = 23 older live non-review + 5 fresh review + 0 fresh non-review` with the pre-package snapshot `overall 87.7 / objective 96.6 / strict 87.6 / verified 94.2`, `209` open
- Exit baseline: the latest `2026-04-22` scan still reports `overall 87.5 / objective 96.0 / strict 87.4 / verified 94.1`; the package-local rerun still reports `14` open EPG rows, but each surviving row is now either exact-rerun clean, stale-proven with current-source proof, or `accepted residue`
- Score delta: global `overall -0.2`, `objective -0.6`, `strict -0.2`, and `verified -0.1` versus the historical checklist-backed entry snapshot. The package-local rerun does not go numerically clean, but `P7-EXIT` closes because every remaining open EPG row now has an explicit `resolved`, `stale-proven`, or `accepted residue` disposition with current-source evidence and no unresolved owner gap
- Imported review dispositions: all five mapped review ids reran absent on `2026-04-21` and are treated as `resolved` on current source
  - `review::.::holistic::contract_coherence::epg_cache_queries_hide_cleanup_side_effects`
    - reason: exact-id rerun is clean after the `EPGScheduleCacheStore` read-contract cleanup and follow-up regression coverage
    - revisit trigger: rerun the exact id if cache-read methods regain hidden cleanup side effects
  - `review::.::holistic::low_level_elegance::epg_refresh_session_too_dense`
    - reason: exact-id rerun is clean after `EPGScheduleRefreshRuntime.refreshForRange()` decomposition
    - revisit trigger: rerun the exact id if runtime refresh orchestration regrows into one dense owner
  - `review::.::holistic::naming_quality::boolean_accessor_get_is_drift`
    - reason: exact-id rerun is clean after the EPG-owned `getIsVisible` rename landed in `P7-W1-S1`; no remaining non-EPG remainder is open on the current rerun
    - revisit trigger: rerun the exact id if boolean-accessor naming drift reappears on current source
  - `review::.::holistic::naming_quality::epg_run_for_channel_callback`
    - reason: exact-id rerun is clean after renaming the runtime callback to `refreshChannelSchedule`
    - revisit trigger: rerun the exact id if the runtime warm/refresh seam regains generic callback naming
  - `review::.::holistic::package_organization::epg_view_leaves_in_root`
    - reason: exact-id rerun is clean after moving the view-only leaves under `src/modules/ui/epg/view/`
    - revisit trigger: rerun the exact id if root EPG files regain direct view-leaf ownership
- Detector/survivor summary:
  - stale-proven detector-lag residue with strong current-source proof:
    - `smells::src/modules/ui/epg/buildEpgStartupConfig.ts::high_cyclomatic_complexity`
      - reason: exact-id rerun still reports `lines: 26`, but current source `src/modules/ui/epg/buildEpgStartupConfig.ts:1` is only a seven-line re-export seam; the reported anchor is impossible on current source and no high-complexity owner remains in that file
      - revisit trigger: rerun the exact id if `buildEpgStartupConfig.ts` regains local behavioral ownership beyond the re-export seam
    - `smells::src/modules/ui/epg/buildEpgStartupConfig.ts::nested_closure`
      - reason: exact-id rerun still reports `lines: 26`, but the file is the same seven-line re-export seam; there are no nested closures in current source for that file
      - revisit trigger: rerun the exact id if `buildEpgStartupConfig.ts` regains local closure-heavy behavior instead of re-exporting the runtime seam
    - `test_coverage::src/modules/ui/epg/EPGStartupConfigRuntime.ts::transitive_only`
      - reason: current source has a direct runtime test in `src/modules/ui/epg/__tests__/EPGStartupConfigRuntime.test.ts:27` and `src/modules/ui/epg/__tests__/EPGStartupConfigRuntime.test.ts:36`, exercising the runtime seam directly rather than only through importers
      - revisit trigger: rerun the exact id if the direct runtime test is removed or narrowed back to importer-only coverage
    - `test_coverage::src/modules/ui/epg/model/domainTypes.ts::transitive_only`
      - reason: current source has a direct test in `src/modules/ui/epg/__tests__/domainTypes.test.ts:10` and `src/modules/ui/epg/__tests__/domainTypes.test.ts:14`, importing the module directly and pinning representative contract shapes
      - revisit trigger: rerun the exact id if direct `domainTypes.ts` coverage is removed or narrowed back to transitive-only use
    - `smells::src/modules/ui/epg/runtime/EPGVisibleRangeRefreshQueue.ts::voided_symbol`
      - reason: exact-id rerun still reports `lines: 108`, but current source `src/modules/ui/epg/runtime/EPGVisibleRangeRefreshQueue.ts:108` is `resolvePending?.();`; the old `void`-suppressed promise chain is absent after the explicit `async`/`await` rewrite
      - revisit trigger: rerun the exact id if immediate/queued refresh orchestration regains a void-suppressed promise path
  - mapped ids now clean on exact reruns:
    - `facade::src/modules/ui/epg/index.ts`
    - `facade::src/modules/ui/epg/runtime/index.ts`
    - `facade::src/modules/ui/epg/view/index.ts`
    - `flat_dirs::src/modules/ui/epg`
    - `flat_dirs::src/modules/ui/epg/__tests__`
    - `signature::src/modules/ui/epg/__tests__/DeferredEpgComponent.test.ts::signature_variance::makeChannel`
    - `smells::src/modules/ui/epg/__tests__/EPGChannelList.test.ts::hardcoded_color`
    - `smells::src/modules/ui/epg/__tests__/EPGComponent.test.ts::non_null_assert`
    - `structural::src/modules/ui/epg/__tests__/EPGComponent.test.ts`
    - `structural::src/modules/ui/epg/__tests__/EPGCoordinator.test.ts`
    - `structural::src/modules/ui/epg/__tests__/EPGInfoPanel.test.ts`
    - `structural::src/modules/ui/epg/__tests__/EPGScheduleRefreshRuntime.test.ts`
    - `structural::src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts`
    - `structural::src/modules/ui/epg/EPGComponent.ts`
    - `structural::src/modules/ui/epg/EPGCoordinator.ts`
    - `structural::src/modules/ui/epg/EPGInfoPanel.ts`
    - `structural::src/modules/ui/epg/runtime/EPGScheduleRefreshRuntime.ts`
    - `structural::src/modules/ui/epg/view/EPGVirtualizer.ts`
  - mapped stale-proven rows still rerun open but disagree with current source:
    - `smells::src/modules/ui/epg/EPGCoordinator.ts::console_error_no_throw`
      - reason: rerun-open anchors `101/111/267/399` now land on `_reportIssue(...)` call sites and guided-channel failure diagnostics; there is no `console.error` on current source
      - revisit trigger: rerun the exact id if coordinator best-effort/init/channel-switch paths regain direct `console.error`
    - `smells::src/modules/ui/epg/EPGRefreshController.ts::console_error_no_throw`
      - reason: rerun-open anchor `378` now lands in `refreshEpgSchedulesBestEffort(...)`, which reports through `_reportIssue(...)`; current source contains no `console.error`
      - revisit trigger: rerun the exact id if refresh-controller best-effort handling regains direct `console.error`
    - `smells::src/modules/ui/epg/runtime/EPGBackgroundWarmQueue.ts::console_error_no_throw`
      - reason: rerun-open anchor `98` now lands inside `_reportBatchError(...)`, which only forwards to `onError`; current source contains no `console.error`
      - revisit trigger: rerun the exact id if warm-queue batch failures regain direct `console.error`
    - `smells::src/modules/ui/epg/runtime/EPGScheduleRefreshRuntime.ts::console_error_no_throw`
      - reason: rerun-open anchor `164` now lands on the runtime warm-queue `onError` handler, which appends debug log / issue diagnostics and contains no `console.error`
      - revisit trigger: rerun the exact id if runtime warm-queue failures regain direct `console.error`
    - `smells::src/modules/ui/epg/styles.css::css_monolith`
      - reason: rerun-open anchor `1` lands on a seven-line import-only aggregator file; current source is only `@import` statements for the split EPG stylesheets and the import-seam role is pinned by `EPGComponent.test.ts`
      - revisit trigger: rerun the exact id if `styles.css` regrows beyond the import-only aggregator seam
  - `accepted residue` / low-value CSS detector residue:
    - `smells::src/modules/ui/epg/styles.cells.css::css_monolith`
    - `smells::src/modules/ui/epg/styles.grid.css::css_monolith`
    - `smells::src/modules/ui/epg/styles.shell.css::css_monolith`
    - `smells::src/modules/ui/epg/styles.theme.css::css_monolith`
      - reason: these are threshold-only monolith hits on the stable split EPG stylesheet set; recent CSS cleanup already created churn on this surface, no concrete EPG bug cluster points at these files, and further slicing has higher revert risk than value without a narrow seam
      - revisit trigger: reopen only if a concrete EPG CSS bug cluster or a narrow extraction seam appears on current source
- Follow-ups: none
- Handoff: `P8-W1` is now a safe start; if future reruns still report these five startup/runtime detector-lag rows without source changes, treat them as recorded detector-lag residue unless current-source evidence changes

### [x] `P8-W1` `pkg_shared_hygiene_migration` Shared Hygiene And Migration Residue

- Backlog: `5 = 2 older live non-review + 3 fresh review + 0 fresh non-review`
- Scope: isolate the truly cross-cutting AI-debt, wrapper-sprawl, and dead migration residue so domain packages do not inherit repo-wide cleanup noise
- Exact membership: `docs/architecture/active-cleanup-package-map.json` -> `pkg_shared_hygiene_migration`
- Package-local scoping commands:
  - `desloppify show src --status open --no-budget --top 80`
  - `desloppify show src/utils --status open --no-budget --top 80`
- Exact-id review scope required at entry/exit: the cross-cutting review items in `pkg_shared_hygiene_migration` are closed only by companion-map issue-id review, because the AI-debt and migration-residue findings are broader than any one area command
- Status: completed
- Plan: `docs/plans/2026-04-22-p8-w1-shared-hygiene-migration.md`
- Last touched: `2026-04-22`
- Verification: planning evidence via package-map/current-state reads, package-local `desloppify` scoping, subjective/comment-noise baselines, and the plan-review loop were observed on `2026-04-22`; `P8-W1-S1` then passed `npm test -- --runInBand src/modules/ui/toast/__tests__/types.test.ts src/core/app-shell/__tests__/AppToastPresenter.test.ts src/__tests__/App.test.ts src/__tests__/Orchestrator.test.ts src/core/orchestrator/__tests__/OrchestratorCoordinatorBuilders.test.ts`, the playback-recovery `rg` audit for `handler(type ? { message, type } : message)` returned no matches, and `npm run verify` passed on `82048a83`; `P8-W1-S2` passed `npm test -- --runInBand src/core/orchestrator/__tests__/OrchestratorRecoverableRuntimeReporter.test.ts src/core/orchestrator/__tests__/OrchestratorRecoverableRuntimeWarnings.test.ts src/modules/plex/shared/__tests__/fetchWithTimeoutCore.test.ts src/modules/plex/stream/__tests__/fetchWithTimeout.test.ts src/modules/ui/epg/__tests__/EPGDebugRuntime.test.ts` and `npm run verify` on `46ed1e80`, then the fail-open revision reran the same targeted test envelope plus `npm run verify` on `afef15a8`; `P8-W1-S3` passed `npm test -- --runInBand src/utils/__tests__/EventEmitter.test.ts`, `desloppify show src --status open --no-budget --top 80`, `desloppify show src/utils --status open --no-budget --top 80`, and `npm run verify` on `c8886a1e`, then the EventEmitter warning-fallback revision reran `npm test -- --runInBand src/utils/__tests__/EventEmitter.test.ts` plus `npm run verify` on `d2f7f479`
- Follow-ups: package implementation is complete. `P8-EXIT` owns the final closeout matrix for the surviving same-package review/mechanical residue and the stale exact-id state rows recorded below
- Handoff: `P8-EXIT`

- [x] `P8-EXIT`

  - required: record every mapped imported issue with an exact disposition, assign one single final owner for every deferred or split follow-up, and record the package score delta before moving to `P9`
  - required: refresh package-local commands, record mapped review dispositions from `pkg_shared_hygiene_migration`, record detector deltas and security triage, and either post a score delta or assign one exact later owner for every survivor
- Status: completed
- Plan: `docs/plans/2026-04-22-p8-w1-shared-hygiene-migration.md`
- Last touched: `2026-04-22`
- Verification: final-gate evidence was refreshed on `2026-04-22` via `desloppify status`, `desloppify plan queue --sort recent`, `desloppify show review --status open --no-budget --top 120`, `desloppify show subjective --no-budget --top 40`, `desloppify show security --status open --no-budget --top 50`, `desloppify show src --status open --no-budget --top 80`, `desloppify show src/utils --status open --no-budget --top 80`, `desloppify show "smells::src/utils/EventEmitter.ts::console_error_no_throw" --status open --no-budget`, the exact issue-id extraction command for all five mapped ids, the comment-count delta audit command, source audits confirming the root entry/composition files still match `CURRENT_STATE` and the playback-recovery raw-string toast path is absent, and a passing `npm run verify`; after these same-pass checklist updates, `npm run verify:docs` passed
- Entry baseline: planning-entry evidence recorded `desloppify show src --status open --no-budget --top 80` -> `95` open rows, `desloppify show src/utils --status open --no-budget --top 80` -> `2` open rows, `desloppify show subjective --no-budget --top 40` -> `AI generated debt 78.0%, Abstraction fit 80.0%, API coherence 81.0%`, and the comment-noise audit baseline `152 @fileoverview / 93 @version 1.0.0 / 439 docblock openings`
- Exit baseline: `desloppify status` now reports `overall 87.5 / objective 96.0 / strict 87.4 / verified 94.1`; `desloppify plan queue --sort recent` reports `Queue: 0 items (56 planned · 2 skipped)`; `desloppify show src --status open --no-budget --top 80` now reports `94` open rows and `desloppify show src/utils --status open --no-budget --top 80` now reports `1` open row; `desloppify show subjective --no-budget --top 40` is unchanged at `AI generated debt 78.0%, Abstraction fit 80.0%, API coherence 81.0%`; the comment-count audit now reports `142 @fileoverview / 83 @version 1.0.0 / 404 docblock openings`
- Detector delta summary:
  - package-local `src` scoping improved from `95` to `94` open rows, with the package-owned `EventEmitter` smell retired and no new package-owned `src` rows introduced
  - package-local `src/utils` scoping improved from `2` to `1` open row, leaving only unrelated `smells::src/utils/color/extractDominantColor.ts::high_cyclomatic_complexity`
  - exact-id rerun for `smells::src/utils/EventEmitter.ts::console_error_no_throw` is now `fixed`
  - comment-count delta versus planning baseline: `@fileoverview -10`, `@version 1.0.0 -10`, `docblock openings -35`
- Score delta: checklist-backed integration entry/exit status stayed flat at `overall 87.5 -> 87.5`, `strict 87.4 -> 87.4`, with `objective 96.0 -> 96.0` and `verified 94.1 -> 94.1`; subjective package scores are likewise unchanged versus entry baseline: `AI generated debt 78.0 -> 78.0`, `Abstraction fit 80.0 -> 80.0`, `API coherence 81.0 -> 81.0`
- Security triage: `desloppify show security --status open --no-budget --top 50` reported no open security issues and no `P0` survivors block `P9`
- Imported review dispositions:
  - stale-proven exact-id residue with strong current-source proof:
    - `review::.::holistic::incomplete_migration::toast_string_back_compat_dead`
      - reason: the broad review refresh returned no open review rows, `src/modules/ui/toast/types.ts` now keeps `ToastInput` payload-only with object-only `normalizeToastInput(...)`, `src/core/app-shell/AppToastPresenter.ts` still normalizes only structured payloads, and `src/core/orchestrator/OrchestratorCoordinatorBuilders.ts:270` now emits `{ message }` instead of a raw string on the no-type playback-recovery path; the exact-id state row remains open, but current source no longer carries the old compatibility branch
      - revisit trigger: rerun the exact id if toast normalization regains a string branch or any production caller under `src/` starts emitting raw-string toasts again
  - `accepted residue`:
    - `review::.::holistic::ai_generated_debt::defensive_nonfatal_wrapper_sprawl`
      - reason: `P8-W1-S2` removed the stacked reporter helper hops and restored fail-open behavior only where runtime ownership warrants it, but the exact review row still reruns open and the shared fail-open/reporting surface still owns the remaining judgment call
      - revisit trigger: revisit only if a future approved fail-open policy rewrite or package-map revision proves the remaining wrapper-sprawl rationale belongs to a different owner
    - `review::.::holistic::ai_generated_debt::template_docblock_noise`
      - reason: `P8-W1-S3` materially reduced the shared/root template scaffold counts within the approved manifest, but the comment-count audit still shows `142/83/404`, so the broad rationale remains materially live on current source even after the scoped sweep
      - revisit trigger: revisit only if a future approved `comment_sweep_manifest` expansion or package-map revision proves the remaining template-comment residue belongs to a different owner
- Mechanical/disposition summary:
  - resolved:
    - `smells::src/utils/EventEmitter.ts::console_error_no_throw`
      - reason: `src/utils/EventEmitter.ts` now preserves redacted, non-fatal handler-failure reporting without direct `console.error`, the targeted Jest envelope covers `reportError` present/absent/throwing plus fallback-throws behavior, and the exact-id rerun is `fixed`
      - revisit trigger: rerun the exact id if handler isolation regains direct `console.error` or loses its non-throwing reporting fallback
  - `accepted residue`:
    - `flat_dirs::src`
      - reason: the row still reruns open, but current source and `docs/architecture/CURRENT_STATE.md` both keep `src/bootstrap.ts`, `src/App.ts`, `src/Orchestrator.ts`, and `src/index.ts` as intentional root entry/composition surfaces, so this closeout does not game the detector by burying those files
      - revisit trigger: revisit only if the root ownership model changes or a future package-map revision proves a different live owner
- Broad review refresh note: `desloppify show review --status open --no-budget --top 120` returned no open rows on this pass, so exact-id extraction remained the authoritative imported-review evidence surface for `pkg_shared_hygiene_migration`
- Follow-ups: `P8-EXIT` closes with explicit `accepted residue` only for `flat_dirs::src`, `review::.::holistic::ai_generated_debt::defensive_nonfatal_wrapper_sprawl`, and `review::.::holistic::ai_generated_debt::template_docblock_noise`; no later package owner is assigned because each survivor is intentionally closed locally with rationale and revisit trigger
- Handoff: `P9-W1`

### [x] `P9-W1` `pkg_type_safety_test_guardrails` Type Safety And Test Guardrails

- Backlog: `7 = 3 older live non-review + 4 fresh review + 0 fresh non-review`
- Scope: retire the remaining typed-error drift and focused test-fragility residue under one verification-oriented package
- Exact membership: `docs/architecture/active-cleanup-package-map.json` -> `pkg_type_safety_test_guardrails`
- Package-local scoping commands:
  - `desloppify show src/__tests__/helpers.ts --status open --no-budget --top 50`
  - `desloppify show src/__tests__/tools/verifyDocs.test.ts --status open --no-budget --top 50`
  - `desloppify show src/index.ts --status open --no-budget --top 50`
  - `desloppify show src/modules/ui/common/channelBrandingIcons.ts --status open --no-budget --top 50`
- Exact-id review scope required at entry/exit: the cross-cutting review items in `pkg_type_safety_test_guardrails` are closed only by companion-map issue-id review taken after a fresh authoritative `desloppify scan --path .`, because `duplicated_error_code_taxonomies` and `unsafe_error_code_coercions` are broader than any one file-level scoping command
- Status: completed
- Plan: `docs/plans/2026-04-22-p9-w1-type-safety-test-guardrails.md`
- Last touched: `2026-04-22`
- Verification: planning evidence via package-map/current-state reads, package-local `desloppify` scoping, `desloppify show security --status open --no-budget --top 50`, and the plan-review loop were observed on `2026-04-22`; `P9-W1-S1` then passed `npm test -- --runInBand src/modules/ui/common/__tests__/channelBrandingIcons.test.ts src/modules/ui/mini-guide/__tests__/MiniGuideCoordinator.test.ts`, `npm run typecheck`, and the branding-helper `rg` audit on `f727b68d`; `P9-W1-S2` passed the targeted player/Plex Jest envelope, the shadow-taxonomy/coercion `rg` audit, and `npm run verify` on `5a823b43`; `P9-W1-S3` passed the targeted ratchet/index/channel-manager reruns, the private-probe/sleep and `flushPromises` `rg` audits, `desloppify show src/__tests__/helpers.ts --status open --no-budget --top 50`, `npm run test:contracts -- --runInBand src/__tests__/policy/AntiPatterns.policy.test.ts`, and `npm run verify` on `5cc9b161`; `P9-W1-S4` reran `npm run test:verify-docs-contracts`, `npm run verify:docs`, `desloppify show src/__tests__/tools/verifyDocs.test.ts --status open --no-budget --top 50`, and `wc -l src/__tests__/tools/verifyDocs.test.ts`, proving the structural query surface is clean on current source without widening into tooling files; final exit review then caught one remaining `ChannelManager` coercion seam, the closeout fix reran `npm test -- --runInBand src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts`, and `npm run verify` passed on `792f7f48`
- Follow-ups: package implementation is complete. `P9-EXIT` owns the final exact-id disposition matrix, including stale exact-id state/query mismatches for the resolved review/helper/verify-docs ids and the single same-package carry rule for `test_coverage::src/index.ts::untested_module`
- Handoff: `P9-EXIT`

- [x] `P9-EXIT`

- Required: record every mapped imported issue with an exact disposition, and if any survivor remains open after this last package, keep `pkg_type_safety_test_guardrails` as the single final owner through `P10` rather than inventing a later package owner
- Required: refresh package-local commands, record mapped review dispositions from `pkg_type_safety_test_guardrails`, record detector deltas and security triage, and either post a score delta or explicitly carry same-package ownership into `P10-W1` for every survivor
- Status: completed
- Plan: `docs/plans/2026-04-22-p9-w1-type-safety-test-guardrails.md`
- Last touched: `2026-04-22`
- Verification: final-gate evidence was refreshed on `2026-04-22` via two authoritative `desloppify scan --path .` runs, `desloppify status`, `desloppify plan queue --sort recent`, `desloppify show review --status open --no-budget --top 120`, `desloppify show security --status open --no-budget --top 50`, the package-local scoping commands for `src/__tests__/helpers.ts`, `src/__tests__/tools/verifyDocs.test.ts`, `src/index.ts`, and `src/modules/ui/common/channelBrandingIcons.ts`, the exact issue-id extraction command for all seven mapped ids, final exact-id review sidecars for the four mapped review ids plus the `ChannelManager` coercion closure check, `npm run test:verify-docs-contracts`, and a passing post-fix `npm run verify`; after these same-pass checklist updates, `npm run verify:docs` passed
- Entry baseline: planning-entry evidence recorded `desloppify show src/__tests__/helpers.ts --status open --no-budget --top 50` -> `No open issues matching`, `desloppify show src/__tests__/tools/verifyDocs.test.ts --status open --no-budget --top 50` -> `No open issues matching`, `desloppify show src/index.ts --status open --no-budget --top 50` -> `1` open row (`test_coverage::src/index.ts::untested_module`), `desloppify show src/modules/ui/common/channelBrandingIcons.ts --status open --no-budget --top 50` -> `No open issues matching`, and the companion-map exact issue-id extraction still listed all seven mapped ids as `open`
- Exit baseline: `desloppify status` now reports `overall 87.5 / objective 96.0 / strict 87.4 / verified 94.0`; `desloppify plan queue --sort recent` reports `Queue: 0 items (56 planned · 2 skipped)`; `desloppify show review --status open --no-budget --top 120` reports no open review rows; `desloppify show security --status open --no-budget --top 50` reports no open security issues; the package-local reruns remain clean for `src/__tests__/helpers.ts`, `src/__tests__/tools/verifyDocs.test.ts`, and `src/modules/ui/common/channelBrandingIcons.ts`; `desloppify show src/index.ts --status open --no-budget --top 50` still reports the same single `test_coverage::src/index.ts::untested_module` row; and the fresh exact issue-id extraction from `.desloppify/state-typescript.json` still prints all seven mapped ids as `open`, requiring current-source reconciliation below
- Detector delta summary:
  - package-local scoping stayed clean for `src/__tests__/helpers.ts`, `src/__tests__/tools/verifyDocs.test.ts`, and `src/modules/ui/common/channelBrandingIcons.ts`; only `src/index.ts` still reruns open with the same single `test_coverage::src/index.ts::untested_module` row
  - the broad review refresh reran with no open review rows, so exact-id review plus current-source inspection remained the authoritative imported-review proof surface for `pkg_type_safety_test_guardrails`
  - fresh exact-id extraction still shows all seven mapped ids as `open`, but current-source proof reconciles six of them as resolved or stale-proven detector/state residue; only `test_coverage::src/index.ts::untested_module` remains a live same-package detector-lag carry into `P10-W1`
- Score delta: checklist-backed integration entry/exit status stayed flat at `overall 87.5 -> 87.5`, `strict 87.4 -> 87.4`, `objective 96.0 -> 96.0`, and `verified 94.0 -> 94.0`
- Security triage: `desloppify show security --status open --no-budget --top 50` reported no open security issues and no `P0` survivors block `P10`
- Imported review dispositions:
  - resolved:
    - `review::.::holistic::type_safety::branding_icon_api_uses_plain_string`
      - reason: the broad review rerun is clean, `src/modules/ui/common/channelBrandingIcons.ts:15` now types branding helpers against `BuildStrategy`, `src/modules/ui/mini-guide/types.ts:17` consumes the typed strategy contract, and `src/modules/ui/common/__tests__/channelBrandingIcons.test.ts:8` now proves the typed surface without plain-string casts
      - revisit trigger: rerun the exact id only if branding helpers regain `string` strategy inputs or another parallel strategy union appears outside the approved UI/common seam
    - `review::.::holistic::type_safety::duplicated_error_code_taxonomies`
      - reason: the canonical error contract now lives in `src/types/app-errors.ts:1`, Plex library errors route through `src/modules/plex/library/PlexLibraryError.ts:6` without a shadow identity mapper, the remaining stream-local supplement in `src/modules/plex/stream/types.ts:73` is narrow and defensible, and the broad review rerun is clean
      - revisit trigger: rerun the exact id only if player/library modules reintroduce parallel AppErrorCode wrappers or identity mappers beyond the stream-local supplement
    - `review::.::holistic::type_safety::unsafe_error_code_coercions`
      - reason: the known `ChannelTuningCoordinator` sub-claim is stale because `src/core/channel-tuning/ChannelTuningCoordinator.ts:632` already normalizes via `getAppErrorCode(...)`, `src/core/channel-setup/ChannelSetupFacetSnapshotLoader.ts:479` now uses the canonical helper, and the final closeout patch moved `src/modules/scheduler/channel-manager/ChannelManager.ts:72` onto `getAppErrorCode(...)`, after which the closure review returned `closed`
      - revisit trigger: rerun the exact id only if raw string-to-enum casts or `Object.values(AppErrorCode).includes(code as AppErrorCode)` style guards return in scheduler/channel-setup/player/Plex code
    - `review::.::holistic::test_strategy::fragility-ratchet-blind-spots`
      - reason: `src/__tests__/policy/AntiPatterns.policy.test.ts:13` now ratchets the formerly cited active suites, `src/__tests__/policy/AntiPatterns.policy.test.ts:121` still enforces the private-probe/sleep guardrail, `src/__tests__/index.test.ts:490` now proves direct import coverage for `src/index.ts`, and the final review sidecar returned clean with only narrow async/timer residual risk
      - revisit trigger: rerun the exact id only if new active suites regain private-instance probing, sleep-based waits, or require-only entrypoint coverage
- Mechanical/disposition summary:
  - stale-proven exact-id residue with strong current-source proof:
    - `signature::src/__tests__/helpers.ts::signature_variance::flushPromises`
      - reason: the fresh state row still reports `open`, but `desloppify show src/__tests__/helpers.ts --status open --no-budget --top 50` reruns clean and current source now keeps the canonical `flushPromises` name only in `src/__tests__/helpers.ts:1`, with touched suites either importing it directly or renaming distinct local wrappers
      - revisit trigger: rerun the exact id if a second same-named `flushPromises` helper is introduced or package-local show starts surfacing the row again
    - `structural::src/__tests__/tools/verifyDocs.test.ts`
      - reason: the fresh state row still reports `open` with the unchanged `3446` LOC summary, but both `desloppify show src/__tests__/tools/verifyDocs.test.ts --status open --no-budget --top 50` and `desloppify show structural --status open --no-budget --top 200` reran clean on current source, while `npm run test:verify-docs-contracts` and `npm run verify:docs` both passed without tooling changes
      - revisit trigger: rerun the exact id if package-local or detector-wide structural queries start surfacing `verifyDocs.test.ts` again or if the docs-verification contract regresses
  - same-package carry into `P10-W1`:
    - `test_coverage::src/index.ts::untested_module`
      - reason: `src/__tests__/index.test.ts:490` now uses a true direct `import('../index')` proof and `npm run verify` reports `src/index.ts` at `100%` coverage, but the fresh detector rerun still reports the exact row live via both `desloppify show src/index.ts --status open --no-budget --top 50` and the exact-id extraction, so this remains same-package detector lag rather than an invented successor package
      - revisit trigger: `P10-W1` must rerun the fresh exact-id proof surface after `desloppify scan --path .`; if the row still appears, keep `pkg_type_safety_test_guardrails` as the single owner until the no-drop gate records the final disposition
- Broad review refresh note: `desloppify show review --status open --no-budget --top 120` returned no open rows on this pass, so exact-id review plus current-source inspection remained the authoritative imported-review evidence surface for `pkg_type_safety_test_guardrails`
- Follow-ups: `P10-W1` inherits only the same-package carry for `test_coverage::src/index.ts::untested_module`; no new successor package owner is assigned
- Handoff: `P10-W1`

## Final Rerun / No-Drop Gate

### [ ] `P10-W1` Authoritative Rerun And No-Drop Proof

- Goal: rerun the integration-branch baseline, refresh the companion map if membership changed, and prove that no live `2026-04-16` issue disappeared without an explicit disposition
- Required commands:
  - `desloppify scan --path .`
  - `desloppify status`
  - `desloppify plan queue --sort recent`
  - `desloppify show review --status open --no-budget --top 100`
  - `desloppify show security --status open --no-budget --top 50`
  - rerun every package-local scoping command for any still-open package or inherited residual owner
  - if `pkg_type_safety_test_guardrails` carries survivors out of `P9-EXIT`, rerun the exact-id proof surface for those inherited ids from the freshly regenerated `.desloppify/state-typescript.json` after `desloppify scan --path .` instead of relying only on broad review or package-local file commands
- Final proof record must include:
  - previous baseline
  - new baseline
  - delta
  - remaining open review issues
  - no-drop proof for every removed, stale-proven, deferred, or still-open mapped issue
  - exact-id before/after proof for any `pkg_type_safety_test_guardrails` issue carried from `P9-EXIT` into `P10-W1`
- Status: blocked
- Plan: `docs/runs/2026-04-p10-plans/2026-04-23-p10-w1-fresh-baseline-reset-and-ground-up-rerun.md`
- Last touched: `2026-04-23`
- Verification: a full reset-to-config-only proof was observed on `2026-04-23`, followed by `desloppify scan --path .`, `desloppify status`, `desloppify plan queue --sort recent`, `desloppify show review --status open --no-budget --top 100`, `desloppify show security --status open --no-budget --top 50`, raw-state inspection of `.desloppify/state-typescript.json`, and the fresh subjective rerun `desloppify review --run-batches --runner codex --parallel --no-retrospective --force-review-rerun --scan-after-import`
- Previous baseline: the last pre-reset tracked baseline observed before deleting historical `.desloppify` state was `2026-04-23T06:57:49+00:00` with `open 387`, `raw issues 235`, `overall 87.5`, `objective 96.0`, `strict 87.4`, and `verified 94.0`
- New baseline: the authoritative fresh-baseline rerun now ends at `2026-04-23T07:32:05+00:00` with `open 276`, `raw issues 237`, `overall 85.9`, `objective 97.2`, `strict 85.9`, `verified 97.2`, `Review: 39 issues open`, and no open security rows
- Delta:
  - the clean reset removed all prior `.desloppify` issue state, review cache, plan history, packets, subagent runs, and the old scorecard before the new scan
  - the first post-reset scan rebuilt a blank-history baseline at `2026-04-23T07:11:06+00:00` with `overall 24.3`, `objective 97.2`, `strict 24.3`, `verified 97.2`, and `open 257` because all `20` subjective dimensions were intentionally unassessed
  - the fresh subjective rerun then imported `39` review issues and raised the final post-review baseline to `overall 85.9` / `strict 85.9`
- Remaining open review issues:
  - the fresh rerun now has a trustworthy live review queue: `desloppify show review --status open --no-budget --top 100` returns `39` open review issues
  - top drag dimensions on the new baseline are `Design coherence 71.0`, `AI generated debt 76.0`, `Error consistency 76.0`, `Cross-module arch 78.0`, and `Mid elegance 78.0`
- No-drop proof status:
  - intentionally superseded by maintainer-approved full reset on `2026-04-23`
  - the old `2026-04-16` companion-map disposition matrix is now historical rather than authoritative for the current backlog
- Exact-id before/after proof for the inherited `pkg_type_safety_test_guardrails` carry:
  - retired with the old lineage at reset time; the fresh `2026-04-23` rerun carries no inherited raw issue state from `P9-EXIT`
- Follow-ups:
  - either archive this checklist and companion map as completed historical closeout evidence for the retired `2026-04-16` lineage, or rewrite the final gate against the `2026-04-23` fresh baseline
  - if cleanup continues on the fresh baseline, start with the `39` live review issues from `desloppify show review --status open --no-budget --top 100`
  - if desired, clean up the single residual subjective queue artifact shown by `desloppify plan queue --sort recent` (`Dep health 96.0% [baseline]`) so the plan queue reflects only live work
- Handoff: `P10-EXIT`

- [ ] `P10-EXIT`

- Close only if: `overall > 87.2`, `strict > 87.2`, the final record captures previous baseline, new baseline, delta, remaining open review issues, and no-drop proof, every mapped review item has a recorded disposition, every surviving detector residue has one exact owner or stale-proven disposition, the companion map and checklist agree, and the final detector table is fully accounted for
- Status: blocked
- Plan: none yet
- Last touched: `2026-04-23`
- Verification: blocked because the original close condition still references the retired `2026-04-16` no-drop lineage; the fresh-baseline rerun itself is complete and recorded in `docs/runs/2026-04-p10-plans/2026-04-23-p10-w1-fresh-baseline-reset-and-ground-up-rerun.md`
- Follow-ups: do not close this checklist as written unless it is first rewritten against the `2026-04-23` fresh baseline or explicitly archived as a historical `2026-04-16` lineage record
- Handoff: checklist complete only when this gate is satisfied

## Fresh-Baseline Follow-On Queue

Use the `2026-04-23` reset baseline as the active source of truth for this queue. Exact fresh review-id membership and bounded scoping guidance live in `docs/architecture/p11-fresh-baseline-package-map.json`. Supporting rationale and mechanical adjudication live in `docs/runs/2026-04-p11-plans/2026-04-23-p11-fresh-baseline-follow-on-queue.md`.

Default scoping rule for this queue:

- the fresh review ids listed in `docs/architecture/p11-fresh-baseline-package-map.json` are the primary ownership surface
- overlapping production-file mechanical hotspots may be absorbed when they reinforce the same seam
- do not spend cleanup-loop time on default non-active buckets from the companion map and follow-on queue rationale doc unless current-source evidence shows a concrete same-seam defect

### [x] `P11-W1` `pkg_orchestrator_boundary_simplification` Orchestrator, App-Shell, And Priority-One Boundary Simplification

- Backlog: `seed 19 = 13 fresh review + 6 candidate mechanical hotspots`
- Scope: retire the fresh orchestrator/app-shell/priority-one pass-through sprawl, shrink the orchestrator blast radius, and tighten the public/root boundary so the main runtime no longer depends on oversized assembly and delegation warehouses
- Exact seed membership: `docs/architecture/p11-fresh-baseline-package-map.json` -> `pkg_orchestrator_boundary_simplification`
- Package-local scoping commands:
  - `desloppify show src/core/orchestrator/AppOrchestrator.ts --status open --no-budget --top 80`
  - `desloppify show src/core/orchestrator/OrchestratorCoordinatorBuilders.ts --status open --no-budget --top 80`
  - `desloppify show src/core/orchestrator/priority-one/PriorityOneControllerCollaborators.ts --status open --no-budget --top 80`
  - `desloppify show src/core/orchestrator/InitializationCoordinator.ts --status open --no-budget --top 80`
  - `desloppify show src/__tests__/Orchestrator.test.ts --status open --no-budget --top 80`
- Cleanup-loop fit: Tier 3 checklist-linked package; use the exact review ids as the primary scope selector, use the companion-map candidate files only as bounded scoping aids, and do not absorb cross-cutting hygiene ids or default non-active buckets
- Likely first slice: inventory AppOrchestrator, coordinator builders, and priority-one collaborator seams before deciding whether the first execution unit is assembly relocation, contract narrowing, or boundary slimming
- Status: completed
- Progress: `P11-W1-S1` contract narrowing complete; `P11-W1-S2` coordinator assembly relocation complete; `P11-W1-S3` priority-one startup ownership seam complete; `P11-W1-S4` sequencing-test cleanup complete
- Plan: `docs/runs/2026-04-p11-plans/2026-04-23-p11-w1-orchestrator-boundary-simplification-plan.md`
- Last touched: `2026-04-23`
- Verification: `P11-W1-S1` reviewed clean and committed as `56809c0d`; `P11-W1-S2` reviewed clean after closure/final review and committed as `384bd1d1`; `P11-W1-S3` reviewed/verified and committed as `a2626811`; `P11-W1-S4` reviewed clean and committed as `6c0cac5f`; `npm run verify` passed after S4 with typecheck, architecture lint, CSS lint, coverage tests (`252` suites, `3075` passed, `1` skipped), tools tests (`5` suites, `98` tests), contracts (`7` suites, `201` tests), docs verification, and build
- Follow-ups: none for `P11-W1`; continue fresh-baseline queue at `P11-W2`
- Handoff: `P11-W2`

### [x] `P11-W2` `pkg_plex_contract_surface_alignment` Plex Contract, Auth, And Error Surface Alignment

- Backlog: `seed 12 = 7 fresh review + 5 candidate mechanical hotspots`
- Scope: align Plex auth/library/discovery/stream contracts, make error handling and auth semantics consistent across sibling Plex surfaces, and reduce the flat parser-heavy library seam
- Exact seed membership: `docs/architecture/p11-fresh-baseline-package-map.json` -> `pkg_plex_contract_surface_alignment`
- Package-local scoping commands:
  - `desloppify show src/modules/plex/library/PlexLibrary.ts --status open --no-budget --top 80`
  - `desloppify show src/modules/plex/auth/PlexAuth.ts --status open --no-budget --top 80`
  - `desloppify show src/modules/plex/discovery/PlexServerDiscovery.ts --status open --no-budget --top 80`
  - `desloppify show src/modules/plex/stream/PlexStreamResolver.ts --status open --no-budget --top 80`
- Cleanup-loop fit: Tier 3 checklist-linked package; drive execution from the exact Plex review ids, use the candidate mechanical ids only as same-seam secondary evidence, and do not absorb unrelated test-only Plex residue by default
- Likely first slice: start with auth/library contract and error-policy alignment before absorbing any parser/package reorganization work
- Status: completed
- Progress: `P11-W2-EU1` auth/error contract wave complete; `P11-W2-EU2` parser package organization complete
- Plan: local cleanup-loop plan artifact; not tracked
- Last touched: `2026-04-23`
- Verification: `P11-W2-EU1` reviewed clean and committed as `3749a2fd`; `P11-W2-EU2` reviewed clean and committed as `fd05556a`; `npm run verify` passed after each implementation unit; closeout reran the four package-local scoping commands and all report no open issues for `PlexLibrary.ts`, `PlexAuth.ts`, `PlexServerDiscovery.ts`, and `PlexStreamResolver.ts`. Exact review-id `desloppify show` commands still report the seven seed ids as open, but reviewed current-source proof retires the package-owned rationale: auth interface failure contracts are documented, auth storage methods are synchronous, transport wrapping preserves sanitized cause, discovery startup auth failures route through global recovery, `403` semantics are endpoint-aware, `getLibrary()` accepts cancellation options, and parser internals now live under `src/modules/plex/library/parsing/` with public exports preserved through `src/modules/plex/library/index.ts`.
- Follow-ups: none for `P11-W2`; continue fresh-baseline queue at `P11-W3`
- Handoff: `P11-W3`

### [x] `P11-W3` `pkg_channel_setup_scheduler_contract_cleanup` Channel Setup And Scheduler Contract Cleanup

- Backlog: `seed 13 = 3 fresh review + 10 candidate mechanical hotspots`
- Scope: tighten the channel-manager/channel-setup contract surface, retire repeated legacy-field scrub logic, and reduce the oversized scheduler/channel-setup coordination seam
- Exact seed membership: `docs/architecture/p11-fresh-baseline-package-map.json` -> `pkg_channel_setup_scheduler_contract_cleanup`
- Package-local scoping commands:
  - `desloppify show src/modules/scheduler/channel-manager/ChannelManager.ts --status open --no-budget --top 80`
  - `desloppify show src/modules/scheduler/channel-manager/ContentResolver.ts --status open --no-budget --top 80`
  - `desloppify show src/core/channel-setup/ChannelSetupPlanner.ts --status open --no-budget --top 80`
  - `desloppify show src/modules/scheduler/scheduler/ChannelScheduler.ts --status open --no-budget --top 80`
  - `desloppify show src/modules/ui/channel-setup/ChannelSetupScreen.ts --status open --no-budget --top 80`
- Cleanup-loop fit: Tier 3 checklist-linked package; the review ids define the owner seam, the candidate mechanical ids are scoping aids only, and EPG/navigation or cross-cutting hygiene residue stays out unless current-source proof re-homes it here
- Likely first slice: begin with ChannelManager input types, legacy field scrub duplication, and channel-setup planner interfaces before widening into UI controllers
- Status: completed
- Progress: `P11-W3-EU1` channel-manager/channel-setup contract wave complete; `P11-W3-S1` explicit create/update input contracts complete; `P11-W3-S2` legacy `isSequentialVariant` scrub centralized to the repository normalization boundary; `P11-W3-S3` channel-setup workflow port availability contract made uniform with UI edge defaults preserved
- Plan: local cleanup-loop plan artifact; not tracked
- Last touched: `2026-04-23`
- Verification: `P11-W3-EU1` reviewed clean and committed as `5596f684`; focused verification passed with `8` suites / `115` tests for channel-manager persistence/import, setup workflow port, setup runtime, build committer, and app diagnostics; `npm run typecheck` passed; `npm run verify` passed with typecheck, architecture lint, CSS lint, coverage tests (`252` suites, `3077` passed, `1` skipped), tools tests (`5` suites, `98` tests), contracts (`7` suites, `201` tests), docs verification, and build. Closeout reran the five package-local scoping commands and all report no open issues for `ChannelManager.ts`, `ContentResolver.ts`, `ChannelSetupPlanner.ts`, `ChannelScheduler.ts`, and `ChannelSetupScreen.ts`. Exact review-id `desloppify show` commands still report the three seed ids as open, but reviewed current-source proof retires the package-owned rationale: channel-manager create/update contracts now use explicit writable input types, runtime-owned channel fields stay manager-owned, legacy `isSequentialVariant` cleanup remains only at repository load normalization plus its helper, manager save/load/export no longer repeat the scrub, and `createChannelSetupWorkflowPort` now routes all methods through one strict unavailable-workflow contract while `ChannelSetupSessionRuntime` owns UI-safe unavailable defaults.
- Follow-ups: none for `P11-W3`; continue fresh-baseline queue at `P11-W4`
- Handoff: `P11-W4`

### [x] `P11-W4` `pkg_epg_navigation_runtime_cleanup` EPG, Navigation, And UI Runtime Cleanup

- Backlog: `seed 18 = 7 fresh review + 11 candidate mechanical hotspots`
- Scope: reduce navigation/EPG runtime complexity, fix the stale route/state contract drift, and replace the most fragile EPG/server-select async coordination seams with clearer ownership and testable completion boundaries
- Exact seed membership: `docs/architecture/p11-fresh-baseline-package-map.json` -> `pkg_epg_navigation_runtime_cleanup`
- Package-local scoping commands:
  - `desloppify show src/modules/ui/epg/view/EPGVirtualizer.ts --status open --no-budget --top 80`
  - `desloppify show src/modules/ui/epg/EPGComponent.ts --status open --no-budget --top 80`
  - `desloppify show src/modules/ui/epg/runtime/EPGScheduleRefreshRuntime.ts --status open --no-budget --top 80`
  - `desloppify show src/modules/navigation/NavigationManager.ts --status open --no-budget --top 80`
  - `desloppify show src/modules/ui/server-select/ServerSelectScreen.ts --status open --no-budget --top 80`
- Cleanup-loop fit: Tier 3 checklist-linked package; use the exact review ids as the execution anchor, treat the candidate mechanical ids as bounded scoping aids only, and keep player/Plex/cross-cutting hygiene residue out by default
- Likely first slice: start with the stale server-select state contract and the EPG/navigation async completion seam before widening into larger EPG decomposition
- Status: completed
- Plan: package-local cleanup-loop plan approved after adversarial review; local-only plan artifact was not promoted to `docs/plans/`
- Last touched: `2026-04-24`
- Progress: `P11-W4-EU1` completed the server-selection transaction and UI async-completion wave; `P11-W4-S1` made server-select route params active-route-only, renamed the selected-server startup resume path to intent-revealing APIs, and made selected-server commit rollback cover discovery runtime state, discovery selected-server storage, and active-user `{ serverId, serverUri }` persistence. `P11-W4-S2` added explicit idle/completion seams for server-select, profile-select, EPG background warm, EPG background refresh, and EPG info-panel async work. `P11-W4-EU2` split `NavigationCoordinator._handleKeyPress()` into named mode handlers without changing routing behavior. `P11-W4-EU3` normalized the scoped EPG acronym casing seam to `DeferredEPGComponent.ts`, `buildEPGStartupConfig.ts`, and `EPGLibraryUtils.ts` while preserving package-root public exports and adding no compatibility aliases.
- Verification: `P11-W4-EU1` passed focused Jest coverage for navigation manager, server-selection coordinator/runtime, initialization coordinator, Plex discovery, orchestrator, server-select, profile-select, EPG background warm, EPG schedule refresh, and EPG info panel (`11` suites / `395` tests) plus `npm run typecheck`; implementation review found one active-user snapshot timing regression, the fix passed closure, and a fresh final review approved the wave. `P11-W4-EU2` passed `npm test -- src/modules/navigation/__tests__/NavigationCoordinator.test.ts` (`67` tests) plus `npm run typecheck` and clean review. `P11-W4-EU3` passed renamed EPG focused tests (`4` suites / `17` tests) plus `npm run typecheck` and clean review. Package closeout passed `npm run verify` with typecheck, architecture lint, CSS lint, coverage tests (`252` suites, `3085` passed, `1` skipped), tools tests (`5` suites, `98` tests), contracts (`7` suites, `201` tests), docs verification, and build. Exact review-id `desloppify show` reruns still report the seven seed ids as open, but reviewed current-source proof retires the package-owned rationale: stale server-select params are cleared/guarded off-route, selection rollback now restores all selected-server state surfaces on failed commit, selected-server runtime resume naming is explicit, UI suites await feature-owned idle seams instead of guessed flush counts, navigation key handling is a dispatcher plus named mode handlers, and scoped EPG filename/import casing is normalized. Package-local scoping reruns for `EPGVirtualizer.ts`, `EPGComponent.ts`, `EPGScheduleRefreshRuntime.ts`, `NavigationManager.ts`, and `ServerSelectScreen.ts` all reported no open issues matching those files.
- Follow-ups: none for `P11-W4`; continue fresh-baseline queue at `P11-W5`
- Handoff: `P11-W5`

### [ ] `P11-W5` `pkg_player_recovery_contract_cleanup` Player, Subtitle, And Recovery Contract Cleanup

- Backlog: `seed 6 = 2 fresh review + 4 candidate mechanical hotspots`
- Scope: align player/subtitle/runtime failure contracts, retire the remaining playback-recovery cohesion hotspot, and reduce the coupling between player behavior and brittle sequence-sensitive tests
- Exact seed membership: `docs/architecture/p11-fresh-baseline-package-map.json` -> `pkg_player_recovery_contract_cleanup`
- Package-local scoping commands:
  - `desloppify show src/modules/player/VideoPlayer.ts --status open --no-budget --top 80`
  - `desloppify show src/modules/player/SubtitleManager.ts --status open --no-budget --top 80`
  - `desloppify show src/modules/player/PlaybackRecoveryManager.ts --status open --no-budget --top 80`
  - `desloppify show src/modules/player/AudioTrackManager.ts --status open --no-budget --top 80`
- Cleanup-loop fit: Tier 3 checklist-linked package; drive execution from the exact player/recovery review ids, use the candidate mechanical ids only as same-seam evidence, and keep orchestrator/channel-tuning sequencing review work out of this package
- Likely first slice: start with the audio-track error contract and subtitle failure-mode split, then absorb playback-recovery cohesion only if the same runtime contract cleanup needs it
- Status: not started
- Plan: none yet
- Last touched: `2026-04-23`
- Verification: not run for package-local scoping yet; seed evidence comes from the authoritative `2026-04-23T07:32:05+00:00` rerun and `docs/architecture/p11-fresh-baseline-package-map.json`
- Follow-ups: none yet
- Handoff: `P11-W6`

### [ ] `P11-W6` `pkg_cross_cutting_contract_hygiene` Cross-Cutting Contract And Hygiene Cleanup

- Backlog: `seed 11 = 7 fresh review + 4 candidate mechanical hotspots`
- Scope: own the explicitly cross-cutting fresh review ids that do not cleanly belong to one architectural package without becoming a default residue sink for unrelated cleanup work
- Exact seed membership: `docs/architecture/p11-fresh-baseline-package-map.json` -> `pkg_cross_cutting_contract_hygiene`
- Package-local scoping commands:
  - `desloppify show src/modules/lifecycle/AppLifecycle.ts --status open --no-budget --top 80`
  - `desloppify show src/modules/ui/settings/SettingsScreen.ts --status open --no-budget --top 80`
  - `desloppify show src/modules/ui/auth/AuthScreen.ts --status open --no-budget --top 80`
  - `desloppify show src/core/app-shell/AppDiagnosticsSurface.ts --status open --no-budget --top 80`
  - `desloppify show src/core/channel-setup/ChannelSetupWorkflow.ts --status open --no-budget --top 80`
- Cleanup-loop fit: Tier 3 checklist-linked package; exact review ids are the only authoritative membership surface here, candidate files are bounded scoping aids only, and no unrelated residue may be absorbed just because it feels “shared”
- Likely first slice: start with a per-id ownership inventory across lifecycle, settings, toast, and pass-through facade surfaces before choosing the first execution unit
- Status: not started
- Plan: none yet
- Last touched: `2026-04-23`
- Verification: not run for package-local scoping yet; seed evidence comes from the authoritative `2026-04-23T07:32:05+00:00` rerun and `docs/architecture/p11-fresh-baseline-package-map.json`
- Follow-ups: none yet
- Handoff: `P11-EXIT`

- [ ] `P11-EXIT`

- Close only if: every fresh `2026-04-23` review issue has one checklist owner, every overlapping mechanical hotspot retired under `P11` has one exact package owner or an explicit `accepted residue`, `deferred`, or `stale-proven` disposition recorded from current-source evidence, `docs/architecture/p11-fresh-baseline-package-map.json`, the follow-on queue rationale doc, and this checklist agree on package seed membership, and the final fresh-baseline backlog is re-rerun from the integration branch before claiming completion
- Status: not started
- Plan: none yet
- Last touched: `2026-04-23`
- Verification: not run
- Follow-ups: none yet
- Handoff: continue through `P11` until the fresh-baseline queue is fully drained or explicitly archived
