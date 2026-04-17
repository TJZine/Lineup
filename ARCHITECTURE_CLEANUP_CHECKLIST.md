# Architecture Cleanup Checklist

> V6 package-backed execution model established `2026-04-16` from the reconciled `2026-04-16` `desloppify` baseline.
>
> Supersedes the pre-package-migration draft archived at `docs/archive/checklists/2026-04-16-architecture-cleanup-checklist-v5-pre-package-migration.md`.
>
> Exact issue membership belongs to the tracked companion surface `/Users/tristan/Software/Lineup/docs/architecture/active-cleanup-package-map.json`. Local planning bundles under `docs/runs/` are historical planning context only and are not authority.

This document is the live cleanup queue for the reconciled `2026-04-16` backlog. It stays concise at the package layer while preserving checklist-resident gate scaffolding, mini-record expectations, and `P#-W#` / `P#-EXIT` execution discipline.

This checklist is not complete until an authoritative rerun on the target integration branch proves the live `2026-04-16` review and mechanical backlog is retired or stale-proven with current-source evidence, `strict > 87.2`, `overall > 87.2`, and no issue was dropped without an explicit disposition.

## Fresh-Session Handoff

- Last structural refresh: `2026-04-16`
- Prior completed ledger: `docs/archive/checklists/2026-04-16-architecture-cleanup-checklist-wave-4.md`
- Current execution state: `P1-W1` slice execution is complete; package closeout and residual ownership now route through `P1-EXIT`
- Next safe start: `P1-EXIT`
- Authoritative evidence rule: only integration-branch `desloppify` reruns may change backlog status, package completion claims, exit records, or closeout claims
- Exact issue-membership surface: `/Users/tristan/Software/Lineup/docs/architecture/active-cleanup-package-map.json`
- Historical planning context only: local run bundles under `docs/runs/`

## Goals

- retire every live reconciled backlog item from the `2026-04-16` baseline
- keep one explicit owner package for every mapped review issue and every remaining detector residue
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
- the checklist owns package rows and gate records; the companion map owns exact issue membership
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
- record entry baseline, exit baseline, and delta; if neither `overall` nor `strict` improves, keep the exit open unless every survivor has one exact later owner
- keep exact residual ownership in the companion map and this checklist synchronized

## Execution Hygiene

- Disposition vocabulary:
  - `stale-proven`: the exact mapped issue is absent on current source, and the rerun evidence plus current-source inspection prove the tracked complaint was stale rather than silently dropped.
  - `resolved`: the exact mapped issue or package-owned rationale is retired on current source and backed by fresh rerun evidence.
  - `deferred`: the issue stays open, but the record names the exact current owner, reason, and revisit trigger.
  - `split follow-up`: the current package is not the final owner; the remaining live gap is handed to one exact successor owner.
  - `owned follow-up`: the exact successor owner named by a `split follow-up` record; every deferred or split item must have one single final owner.
  - `priority-exit review`: the blocking review run after the package work item and before any `P(n+1)` work, plan, or checklist progress begins.
- Ownership rule:
  - keep one single final owner for every deferred or split follow-up item.
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
  - confirm every mapped imported issue or package-owned rationale for the priority is either retired here or explicitly deferred or split with one single final owner, reason, and revisit trigger
  - do not mark progress on `P(n+1)` work until the current priority-exit review is complete and the `P#-EXIT` record is complete

## Fresh Evidence Snapshot

### Reconciled Backlog Counts

- `209` total open
- `158` older live non-review
- `41` fresh review
- `10` fresh non-review
- package count: `9` backlog work units, with queue-trust preflight and final rerun/no-drop proof kept outside the package count

### Commands Observed In This Session

- `desloppify status`: `overall 87.7 / objective 96.6 / strict 87.6 / verified 94.2`; `209` open; living plan signal still reports `Queue: 54 items (54 planned · 2 skipped)`
- `desloppify plan`: `54` user-ordered queue items, `143` backlog items, `2` skipped stale placeholders; next command reported as `desloppify next --count 20`
- `desloppify plan queue --sort recent`: `Queue: 0 items (54 planned · 2 skipped)`; queue is empty
- `desloppify next`: `Queue: 0 items`; `Nothing to do! Strict score: 87.6/100`
- `desloppify show review --status open --no-budget --top 100`: `41` open review issues
- `desloppify show security --status open --no-budget --top 50`: no open security/cycles issues
- queue-trust conclusion for this migration pass: the queue-order surface is stale and is not authoritative backlog truth; the package-backed checklist plus the tracked companion map are the live backlog model until a fresh integration-branch rerun says otherwise

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
  - the backlog has been reconciled to `209 = 158 older live non-review + 41 fresh review + 10 fresh non-review`
  - this checklist now routes exact issue membership to `/Users/tristan/Software/Lineup/docs/architecture/active-cleanup-package-map.json` and treats `docs/runs/...` as historical context only
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
- Exact membership: `/Users/tristan/Software/Lineup/docs/architecture/active-cleanup-package-map.json` -> `pkg_control_plane_runtime`
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

- [ ] `P1-EXIT`

  - required: record every mapped imported issue with an exact disposition, assign one single final owner for every deferred or split follow-up, and record the package score delta before moving to `P2`
  - required: refresh package-local commands, record mapped review dispositions from `pkg_control_plane_runtime`, record detector deltas and security triage, and either post a score delta or assign one exact later owner for every survivor
- Status: in progress
- Plan: local-only closeout pass
- Last touched: `2026-04-17`
- Verification: refreshed closeout evidence on `2026-04-17` includes two fresh `desloppify scan --skip-slow` reruns, `desloppify status`, `desloppify plan queue --sort recent`, `desloppify show security --status open --no-budget --top 50`, `desloppify show src/core/orchestrator --status open --no-budget --top 150`, `desloppify show src/modules/navigation --status open --no-budget --top 120`, `desloppify show structural --status open --no-budget --top 150`, `desloppify show "flat_dirs::src/core/orchestrator" --status open --no-budget --top 20`, the exact survivor reruns for `AppOrchestrator.ts`, `OrchestratorRecoverableRuntimeReporter.ts`, `priority-one/PriorityOneControllerFactory.ts`, `OrchestratorPriorityOneControllerFactory.ts`, `OverlayRuntimePolicyController.ts`, and `OrchestratorRuntimeSeams.ts`, targeted Jest envelopes `npm test -- --runInBand --runTestsByPath src/core/orchestrator/__tests__/OrchestratorRecoverableRuntimeReporter.test.ts src/__tests__/Orchestrator.test.ts`, `npm test -- --runInBand --runTestsByPath src/core/orchestrator/__tests__/OrchestratorRuntimeSeams.test.ts src/core/__tests__/OverlayRuntimePolicyController.test.ts`, `npm test -- --runInBand --runTestsByPath src/core/orchestrator/__tests__/OrchestratorPriorityOneControllerFactory.playbackState.test.ts`, and `npm test -- --runInBand --runTestsByPath src/core/orchestrator/__tests__/OrchestratorRecoverableRuntimeResult.test.ts src/core/orchestrator/__tests__/OrchestratorRecoverableRuntimeWarnings.test.ts src/core/orchestrator/__tests__/PriorityOneControllerCollaborators.test.ts`, plus full `npm run verify`; the same implementation reviewer cleared a closure check after one non-clean round and a fresh final reviewer then reported no material findings in the scoped artifact
- Entry baseline: package entry used the checklist-backed `2026-04-16` status snapshot `overall 87.7 / objective 96.6 / strict 87.6 / verified 94.2`, `209` open
- Exit baseline: post-refresh `2026-04-17T10:03:19+00:00` scan snapshot `overall 87.5 / objective 96.1 / strict 87.5 / verified 94.1`, `319` open, with `typescript` slow phases skipped
- Score delta: `overall -0.2`, `strict -0.1`; `P1-EXIT` stays open because the score did not improve and five live exact survivor rows still remain after two bounded remediation passes
- Imported review dispositions: `review::.::holistic::abstraction_fitness::orchestrator_builder_passthrough_bags`, `review::.::holistic::abstraction_fitness::single_impl_runtime_interfaces`, `review::.::holistic::cross_module_architecture::navigation_depends_on_orchestrator_runtime_seam`, `review::.::holistic::design_coherence::app_orchestrator_remains_runtime_hub`, `review::.::holistic::design_coherence::priority_one_runtime_assembly_is_still_one_large_factory_step`, `review::.::holistic::high_level_elegance::runtime_owner_concentration`, and `review::.::holistic::package_organization::core_priority_one_root_residue` all reran absent on `2026-04-17` and are treated as `resolved` on current source
- Detector deltas: entry mapped package counts were `review 7 / structural 8 / smells 14 / test_coverage 2 / flat_dirs 1`; refreshed exit reads are still `review 0 / structural 0 / flat_dirs 0`, `src/modules/navigation` clean, and the exact reruns now split into five live rows plus five stale-proven disagreements. `test_coverage::src/core/orchestrator/OrchestratorRuntimeSeams.ts::transitive_only` remains open in `show`, but detector-internal proof on current source maps `src/core/orchestrator/__tests__/OrchestratorRuntimeSeams.test.ts` directly to that file with `quality: thorough`, `directly_tested = true`, and `detect_test_coverage(...) -> matched_count 0`, so it is treated as `stale-proven`. `smells::src/core/orchestrator/OrchestratorPriorityOneControllerFactory.ts::{monster_function,nested_closure,high_cyclomatic_complexity}` and `smells::src/core/orchestrator/OverlayRuntimePolicyController.ts::voided_symbol` also remain open in `show`, but current-source proof still disagrees: the compatibility file is a five-line re-export barrel and `OverlayRuntimePolicyController.handleOverlayVisibilityChange(_visible: boolean)` no longer uses any `void` suppression, so those four rows are also `stale-proven`
- Follow-ups:
  - `smells::src/core/orchestrator/AppOrchestrator.ts::console_error_no_throw`
    reason: two bounded remediation passes removed `AppOrchestrator`'s local fallback logger, restored the non-fatal Plex-resource-url guard, and pushed the warning sink/result handling into orchestrator-local collaborators, but the exact row still reruns open on current source
    final owner: `P1-EXIT`
    revisit trigger: rerun `desloppify show "smells::src/core/orchestrator/AppOrchestrator.ts::console_error_no_throw" --status open --no-budget --top 20` after reproducing what shape the detector is still attributing to `AppOrchestrator`, then only do another code pass if current-source proof identifies a remaining inline fallback branch
  - `smells::src/core/orchestrator/AppOrchestrator.ts::swallowed_error`
    reason: two bounded remediation passes converted the remaining catch/report sites into result-returning helpers for EPG refresh, subtitle track updates, module-status context cloning, global-error handler invocation, transcode-session stop, and Plex resource URL building, but the exact row still reruns open
    final owner: `P1-EXIT`
    revisit trigger: rerun `desloppify show "smells::src/core/orchestrator/AppOrchestrator.ts::swallowed_error" --status open --no-budget --top 20` after isolating the detector-attributed catch site on current source, then rerun `npm test -- --runInBand --runTestsByPath src/core/orchestrator/__tests__/OrchestratorRecoverableRuntimeReporter.test.ts src/__tests__/Orchestrator.test.ts` if another code pass is justified
  - `smells::src/core/orchestrator/OrchestratorRecoverableRuntimeReporter.ts::console_error_no_throw`
    reason: two bounded remediation passes moved warning emission behind `OrchestratorRecoverableRuntimeWarnings.ts`, removed the prior direct fallback wrapper shape, and kept the focused reporter tests green, but the exact row still reruns open
    final owner: `P1-EXIT`
    revisit trigger: rerun `desloppify show "smells::src/core/orchestrator/OrchestratorRecoverableRuntimeReporter.ts::console_error_no_throw" --status open --no-budget --top 20` after reproducing the detector against the current reporter/warning-sink split, then rerun `npm test -- --runInBand --runTestsByPath src/core/orchestrator/__tests__/OrchestratorRecoverableRuntimeReporter.test.ts src/__tests__/Orchestrator.test.ts` if another code pass is warranted
  - `smells::src/core/orchestrator/priority-one/PriorityOneControllerFactory.ts::nested_closure`
    reason: two bounded remediation passes moved the inline dependency bags into `PriorityOneControllerCollaborators.ts` and left `PriorityOneControllerFactory.ts` as a thin assembly root, but the exact nested-closure row still reruns open
    final owner: `P1-EXIT`
    revisit trigger: rerun `desloppify show "smells::src/core/orchestrator/priority-one/PriorityOneControllerFactory.ts::nested_closure" --status open --no-budget --top 20` on current source; only do another code pass if the detector still points at logic that remains inside the thin assembly wrapper, then rerun `npm test -- --runInBand --runTestsByPath src/core/orchestrator/__tests__/OrchestratorPriorityOneControllerFactory.playbackState.test.ts`
  - `smells::src/core/orchestrator/priority-one/PriorityOneControllerFactory.ts::high_cyclomatic_complexity`
    reason: the same two bounded remediation passes left the priority-one factory structurally thin, but the exact high-cyclomatic row still reruns open on the file
    final owner: `P1-EXIT`
    revisit trigger: rerun `desloppify show "smells::src/core/orchestrator/priority-one/PriorityOneControllerFactory.ts::high_cyclomatic_complexity" --status open --no-budget --top 20` on current source; only do another code pass if the detector still identifies live branching inside `PriorityOneControllerFactory.ts`, then rerun `npm test -- --runInBand --runTestsByPath src/core/orchestrator/__tests__/OrchestratorPriorityOneControllerFactory.playbackState.test.ts`
- Handoff: keep `P1-EXIT` open; next safe step is a focused detector/source-reconciliation pass for the five live rows above while preserving the stale-proven proof already gathered for `OrchestratorRuntimeSeams.ts`, `OrchestratorPriorityOneControllerFactory.ts`, and `OverlayRuntimePolicyController.ts`, before any `P2` plan or implementation work starts

### [ ] `P2-W1` `pkg_app_shell_shared_ui` App-Shell, Shared UI, And Persistence Seams

- Backlog: `39 = 33 older live non-review + 6 fresh review + 0 fresh non-review`
- Scope: keep app-shell wiring on package-owned seams, finish shared UI persistence assembly cleanup, and hold non-EPG shared UI residue in one execution surface
- Exact membership: `/Users/tristan/Software/Lineup/docs/architecture/active-cleanup-package-map.json` -> `pkg_app_shell_shared_ui`
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
- Status: not started
- Plan: none yet
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P2-EXIT`

- [ ] `P2-EXIT`

  - required: record every mapped imported issue with an exact disposition, assign one single final owner for every deferred or split follow-up, and record the package score delta before moving to `P3`
  - required: refresh package-local commands, record mapped review dispositions from `pkg_app_shell_shared_ui`, record detector deltas and security triage, and either post a score delta or assign one exact later owner for every survivor
- Status: not started
- Plan: none yet
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P3-W1`

### [ ] `P3-W1` `pkg_plex_contracts_identity` Plex Contracts And Identity

- Backlog: `19 = 11 older live non-review + 6 fresh review + 2 fresh non-review`
- Scope: normalize Plex discovery, library, auth, and identity/error seams under one Plex-owned package
- Exact membership: `/Users/tristan/Software/Lineup/docs/architecture/active-cleanup-package-map.json` -> `pkg_plex_contracts_identity`
- Package-local scoping commands:
  - `desloppify show src/modules/plex/discovery --status open --no-budget --top 120`
  - `desloppify show src/modules/plex/library --status open --no-budget --top 150`
  - `desloppify show src/modules/plex/auth --status open --no-budget --top 150`
  - `desloppify show test_coverage --status open --no-budget --top 120`
- Status: not started
- Plan: none yet
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P3-EXIT`

- [ ] `P3-EXIT`

  - required: record every mapped imported issue with an exact disposition, assign one single final owner for every deferred or split follow-up, and record the package score delta before moving to `P4`
  - required: refresh package-local commands, record mapped review dispositions from `pkg_plex_contracts_identity`, record detector deltas and security triage, and either post a score delta or assign one exact later owner for every survivor
- Status: not started
- Plan: none yet
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P4-W1`

### [ ] `P4-W1` `pkg_startup_auth_lifecycle` Startup, Auth, Profile, And Lifecycle State

- Backlog: `23 = 15 older live non-review + 6 fresh review + 2 fresh non-review`
- Scope: make startup/session state honest across auth expiry, profile selection, initialization, error normalization, and lifecycle timing
- Exact membership: `/Users/tristan/Software/Lineup/docs/architecture/active-cleanup-package-map.json` -> `pkg_startup_auth_lifecycle`
- Package-local scoping commands:
  - `desloppify show src/core/initialization --status open --no-budget --top 150`
  - `desloppify show src/core/InitializationCoordinator.ts --status open --no-budget --top 80`
  - `desloppify show src/core/__tests__/InitializationCoordinator.test.ts --status open --no-budget --top 50`
  - `desloppify show src/core/error-recovery --status open --no-budget --top 80`
  - `desloppify show src/modules/ui/auth --status open --no-budget --top 120`
  - `desloppify show src/modules/ui/profile-select --status open --no-budget --top 120`
  - `desloppify show src/modules/ui/server-select --status open --no-budget --top 120`
  - `desloppify show src/modules/lifecycle --status open --no-budget --top 120`
- Status: not started
- Plan: none yet
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P4-EXIT`

- [ ] `P4-EXIT`

  - required: record every mapped imported issue with an exact disposition, assign one single final owner for every deferred or split follow-up, and record the package score delta before moving to `P5`
  - required: refresh package-local commands, record mapped review dispositions from `pkg_startup_auth_lifecycle`, record detector deltas and security triage, and either post a score delta or assign one exact later owner for every survivor
- Status: not started
- Plan: none yet
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P5-W1`

### [ ] `P5-W1` `pkg_playback_subtitle_recovery` Playback And Subtitle Recovery

- Backlog: `18 = 16 older live non-review + 2 fresh review + 0 fresh non-review`
- Scope: separate generic playback recovery from subtitle-specific policy and keep player/stream recovery cleanup in one execution surface
- Exact membership: `/Users/tristan/Software/Lineup/docs/architecture/active-cleanup-package-map.json` -> `pkg_playback_subtitle_recovery`
- Package-local scoping commands:
  - `desloppify show src/modules/player --status open --no-budget --top 150`
  - `desloppify show src/modules/plex/stream --status open --no-budget --top 150`
- Status: not started
- Plan: none yet
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P5-EXIT`

- [ ] `P5-EXIT`

  - required: record every mapped imported issue with an exact disposition, assign one single final owner for every deferred or split follow-up, and record the package score delta before moving to `P6`
  - required: refresh package-local commands, record mapped review dispositions from `pkg_playback_subtitle_recovery`, record detector deltas and security triage, and either post a score delta or assign one exact later owner for every survivor
- Status: not started
- Plan: none yet
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P6-W1`

### [ ] `P6-W1` `pkg_channel_setup_scheduler` Channel Setup And Scheduler Contracts

- Backlog: `38 = 34 older live non-review + 2 fresh review + 2 fresh non-review`
- Scope: keep channel-setup workflow cleanup, scheduler/channel-manager contracts, and channel-tuning residue in one domain-owned package
- Exact membership: `/Users/tristan/Software/Lineup/docs/architecture/active-cleanup-package-map.json` -> `pkg_channel_setup_scheduler`
- Package-local scoping commands:
  - `desloppify show src/core/channel-setup --status open --no-budget --top 150`
  - `desloppify show src/core/channel-tuning --status open --no-budget --top 100`
  - `desloppify show src/modules/scheduler/channel-manager --status open --no-budget --top 150`
  - `desloppify show src/modules/scheduler/scheduler --status open --no-budget --top 150`
  - `desloppify show src/modules/ui/channel-setup --status open --no-budget --top 150`
- Status: not started
- Plan: none yet
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P6-EXIT`

- [ ] `P6-EXIT`

  - required: record every mapped imported issue with an exact disposition, assign one single final owner for every deferred or split follow-up, and record the package score delta before moving to `P7`
  - required: refresh package-local commands, record mapped review dispositions from `pkg_channel_setup_scheduler`, record detector deltas and security triage, and either post a score delta or assign one exact later owner for every survivor
- Status: not started
- Plan: none yet
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P7-W1`

### [ ] `P7-W1` `pkg_epg_runtime_surfaces` EPG Runtime And Package Surfaces

- Backlog: `28 = 23 older live non-review + 5 fresh review + 0 fresh non-review`
- Scope: retire the remaining EPG runtime, view-package, naming, and test hotspot residue under one EPG-owned package
- Exact membership: `/Users/tristan/Software/Lineup/docs/architecture/active-cleanup-package-map.json` -> `pkg_epg_runtime_surfaces`
- Package-local scoping commands:
  - `desloppify show src/modules/ui/epg --status open --no-budget --top 180`
  - `desloppify show src/modules/ui/epg/runtime --status open --no-budget --top 120`
  - `desloppify show facade --status open --no-budget --top 100`
  - `desloppify show structural --status open --no-budget --top 150`
- Status: not started
- Plan: none yet
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P7-EXIT`

- [ ] `P7-EXIT`

  - required: record every mapped imported issue with an exact disposition, assign one single final owner for every deferred or split follow-up, and record the package score delta before moving to `P8`
  - required: refresh package-local commands, record mapped review dispositions from `pkg_epg_runtime_surfaces`, record detector deltas and security triage, and either post a score delta or assign one exact later owner for every survivor
- Status: not started
- Plan: none yet
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P8-W1`

### [ ] `P8-W1` `pkg_shared_hygiene_migration` Shared Hygiene And Migration Residue

- Backlog: `5 = 2 older live non-review + 3 fresh review + 0 fresh non-review`
- Scope: isolate the truly cross-cutting AI-debt, wrapper-sprawl, and dead migration residue so domain packages do not inherit repo-wide cleanup noise
- Exact membership: `/Users/tristan/Software/Lineup/docs/architecture/active-cleanup-package-map.json` -> `pkg_shared_hygiene_migration`
- Package-local scoping commands:
  - `desloppify show src --status open --no-budget --top 80`
  - `desloppify show src/utils --status open --no-budget --top 80`
- Exact-id review scope required at entry/exit: the cross-cutting review items in `pkg_shared_hygiene_migration` are closed only by companion-map issue-id review, because the AI-debt and migration-residue findings are broader than any one area command
- Status: not started
- Plan: none yet
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P8-EXIT`

- [ ] `P8-EXIT`

  - required: record every mapped imported issue with an exact disposition, assign one single final owner for every deferred or split follow-up, and record the package score delta before moving to `P9`
  - required: refresh package-local commands, record mapped review dispositions from `pkg_shared_hygiene_migration`, record detector deltas and security triage, and either post a score delta or assign one exact later owner for every survivor
- Status: not started
- Plan: none yet
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P9-W1`

### [ ] `P9-W1` `pkg_type_safety_test_guardrails` Type Safety And Test Guardrails

- Backlog: `7 = 3 older live non-review + 4 fresh review + 0 fresh non-review`
- Scope: retire the remaining typed-error drift and focused test-fragility residue under one verification-oriented package
- Exact membership: `/Users/tristan/Software/Lineup/docs/architecture/active-cleanup-package-map.json` -> `pkg_type_safety_test_guardrails`
- Package-local scoping commands:
  - `desloppify show src/__tests__/helpers.ts --status open --no-budget --top 50`
  - `desloppify show src/__tests__/tools/verifyDocs.test.ts --status open --no-budget --top 50`
  - `desloppify show src/index.ts --status open --no-budget --top 50`
  - `desloppify show src/modules/ui/common/channelBrandingIcons.ts --status open --no-budget --top 50`
- Exact-id review scope required at entry/exit: the cross-cutting review items in `pkg_type_safety_test_guardrails` are closed only by companion-map issue-id review, because `duplicated_error_code_taxonomies` and `unsafe_error_code_coercions` are broader than any one file-level scoping command
- Status: not started
- Plan: none yet
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P9-EXIT`

- [ ] `P9-EXIT`

- Required: record every mapped imported issue with an exact disposition, and if any survivor remains open after this last package, keep `pkg_type_safety_test_guardrails` as the single final owner through `P10` rather than inventing a later package owner
- Required: refresh package-local commands, record mapped review dispositions from `pkg_type_safety_test_guardrails`, record detector deltas and security triage, and either post a score delta or explicitly carry same-package ownership into `P10-W1` for every survivor
- Status: not started
- Plan: none yet
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
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
- Final proof record must include:
  - previous baseline
  - new baseline
  - delta
  - remaining open review issues
  - no-drop proof for every removed, stale-proven, deferred, or still-open mapped issue
- Status: not started
- Plan: none yet
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P10-EXIT`

- [ ] `P10-EXIT`

- Close only if: `overall > 87.2`, `strict > 87.2`, the final record captures previous baseline, new baseline, delta, remaining open review issues, and no-drop proof, every mapped review item has a recorded disposition, every surviving detector residue has one exact owner or stale-proven disposition, the companion map and checklist agree, and the final detector table is fully accounted for
- Status: not started
- Plan: none yet
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: checklist complete only when this gate is satisfied
