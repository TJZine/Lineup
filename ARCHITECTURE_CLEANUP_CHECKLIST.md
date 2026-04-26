# Architecture Cleanup Checklist

> Live cleanup control plane.
>
> The completed P0-P11 ledger was removed from the live checklist on
> `2026-04-24` to keep the control plane focused on active cleanup work.
> Historical exact issue membership remains in
> `docs/architecture/active-cleanup-package-map.json` and
> `docs/architecture/p11-fresh-baseline-package-map.json`.

This file now carries only the active cleanup queue and the compact operating
rules needed to continue work. Completed package detail belongs in the archive
unless a future pass needs to promote a reusable lesson into a current
architecture or workflow document.

## Fresh-Session Handoff

- Current execution state: P0-P13 are complete. `P13-EXIT` closed the refreshed
  post-P12 subjective review backlog package queue on 2026-04-26.
- Next safe start: choose the next cleanup priority from the current
  `desloppify next` / living-plan evidence. Do not reopen P13 exact issues
  solely from stale detector wording; require current-source proof of a live
  seam and a new owner before planning any follow-up.
- Preferred launcher: `cleanup-loop` for checklist-linked cleanup orchestration.
- First action at package start: for new checklist-linked work, planning only;
  create the package-local execution-grade plan before implementation.
- Active exact issue-membership surface:
  `docs/architecture/p13-post-p12-subjective-backlog-package-map.json`.
- Completed P12 exact issue-membership surface:
  `docs/architecture/p12-subjective-refresh-package-map.json`.
- Prior fresh-baseline exact issue-membership surface:
  `docs/architecture/p11-fresh-baseline-package-map.json`.
- Authoritative evidence rule: only integration-branch `desloppify` reruns may
  change backlog status, package completion claims, exit records, or closeout
  claims.

## Current Evidence Snapshot

Source: trusted internal subjective review runs
`.desloppify/subagents/runs/20260425_182437`,
`.desloppify/subagents/runs/20260425_182908`, and
`.desloppify/subagents/runs/20260425_184236`, plus
`.desloppify/subagents/runs/20260425_184735`; final integration-branch
`desloppify scan --path .`; local queue/status reads on `2026-04-25`.

- Final scan result: `desloppify scan --path .` completed successfully at
  `2026-04-25T18:52:09+00:00` with `272` total scan issues and no active
  scan-blocking queue.
- Final scores: overall `88.0`, objective `95.7`, strict `87.9`, verified
  `95.7`; strict remains above the `85.0` target.
- Current queue read after post-scan deferral: `desloppify next` reports
  `Queue: 0 items` and `Nothing to do! Strict score: 87.9/100`.
- Direct review read: `desloppify show review --status open --no-budget --top
  120` reports no active open `review` detector rows, while `desloppify status`
  records `5` untriaged review work items from the final five-dimension
  subjective pass. Treat those rows as future checklist input, not P12 source
  work.
- Security read: `desloppify show security --status open --no-budget --top 50`
  reports three import-cycle rows, not security-vulnerability rows:
  channel-setup facet snapshot loader/session, channel-setup planner/strategy
  builders, and navigation channel-number/router cycle.
- Biggest weighted drags in the final scan: mid elegance `82.0`, design
  coherence `73.0`, high elegance `88.0`, low elegance `84.0`, contracts
  `88.0`.
- Real future-work candidates identified by refreshed review output include
  profile-select CSS shard consistency, bootstrap live app singleton exposure,
  EPGVirtualizer render-context closure complexity, channel-setup workflow
  contract ownership, AppLifecycle operational concern mixing, AppOrchestrator
  runtime hub breadth, Plex library/error/URL contract seams, and stale
  architecture-doc channel-setup owner paths. The final five-dimension pass
  additionally surfaced navigation helper/coordinator import coupling,
  EPG background warm queue scheduling breadth, duplicate core/UI channel setup
  workflow-port contracts, EPGVirtualizer DOM-budget closure complexity, and
  `bootstrap.ts` live mutable app lifecycle export. These are not P12 blockers;
  they need fresh owner/verification planning before any P13-style execution.

Score interpretation: P12 is closed with strict `87.9`, but Desloppify still
shows a score plateau and points to design coherence as the next breakthrough
area. The refreshed review output should seed future checklist planning, not
retroactively reopen completed P12 packages.

## Operating Contract

- Work top to bottom unless maintainer direction says otherwise.
- Keep authoritative execution state in Codex `update_plan`.
- Create a package-local execution-grade plan for the selected `P13-W#`; keep it
  local by default and promote to `docs/plans/*` only when durable tracked
  handoff memory is explicitly needed.
- Use the active companion map for exact review-id membership. Checklist rows
  summarize package intent; they are not a substitute for the map.
- Overlapping production mechanical hotspots may be absorbed only when current
  source proves they reinforce the same package seam.
- Do not absorb stale-exclude rows, duplicated detector rows, or broad
  "subjective assessment needed" placeholders into a package unless a concrete
  current-source issue id or source audit proves the same seam.
- Run `npm run verify` for UI, navigation, Orchestrator, Plex, lifecycle,
  settings, or runtime work. Run `npm run verify:docs` for checklist,
  package-map, launcher, workflow, or reference-doc changes.

## Mini-Record Contract

Every work item and exit gate must keep this compact ledger:

- `Status`: `not started`, `in progress`, `blocked`, or `completed`
- `Plan`: exact tracked plan path, `local-only`, or `none yet`
- `Last touched`: exact date or `not started`
- `Verification`: exact latest commands and result; `not run` is explicit
- `Follow-ups`: exact inherited/deferred residuals with one owner, or `none yet`
- `Handoff`: next safe step, next owner, or blocking condition

Do not check a box unless the mini-record is updated in the same pass with
current evidence.

## Priority Exit Enforcement

- Disposition vocabulary: `resolved`, `stale-proven`, `accepted residue`,
  `deferred`, `split follow-up`, and `owned follow-up`.
- Ownership rule: every deferred or split follow-up must have one single final
  owner, a reason, and a revisit trigger.
- Priority-exit review: run the matching closeout review before starting or
  planning the next priority.
- Do not mark progress on P(n+1) work until the current priority's P#-EXIT
  record is complete.
- Cleanup slice execution template:
  - `priority/work units`: exact `P#-W#` items in scope.
  - `imported review issues`: exact mapped issue ids or companion-map package.
  - `security triage`: `no open P0 security findings`, or exact deferred or
    resolved P0 findings.
  - `verification`: exact commands proving the slice.
  - `deferred items`: exact owner, reason, and revisit trigger.
  - `proof matrix`: mapped issue disposition, live residual status, final owner,
    and revisit trigger.
- Priority exit command checklist:
  - `desloppify status`
  - `desloppify plan queue --sort recent`
  - `desloppify show review --status open --no-budget --top 120`
  - `desloppify show security --status open --no-budget --top 50`
  - package-local scoping commands for the closing priority
  - strongest task-specific verification used by the closing work item

## Checklist-Linked Closure Protocol

Checklist-linked packages must prove they closed the current-source issue area, not just
changed files related to the imported review text.

- Source-proof matrix before implementation:
  - exact review issue id
  - current-source evidence that the complaint is still true, or `stale-proven`
    with proof
  - concrete closure condition: "fixed when..."
  - out-of-scope guardrails that prevent broad opportunistic refactors
  - expected proof commands, tests, and source audits
  - likely regression/new-debt risks introduced by the proposed fix
- Implementation review gate:
  - reviewer must answer whether the same complaint would still be fair after
    the change
  - reviewer must check whether the fix moved the same responsibility,
    pass-through, typing, error, or package-organization problem to a sibling
    surface
  - reviewer must list any newly introduced issue that belongs to the same
    package before the work item can close
- Post-fix issue-area sweep:
  - rerun all package-local `desloppify show` commands
  - rerun exact imported issue-id queries when the tool can show them
  - rerun targeted `rg` audits for the old pattern and any replacement pattern
  - inspect touched files for new one-hop facades, broader barrels, duplicated
    unions, swallowed errors, untyped widening, or test-only call-order coupling
  - record every survivor as `resolved`, `stale-proven`, `accepted residue`,
    `deferred`, or `split follow-up` with one single final owner
- New-issue capture rule:
  - if the fix reveals or creates a new issue in the same issue area, keep the
    current package open and either absorb it into the current execution unit or
    replan the same package before moving on
  - if the fix reveals a different issue area, assign it to one later owner in
    the same active priority or a new checklist item before closing the current
    package
  - do not close a package solely because tests pass or the originally imported
    wording disappeared
- Score-risk rule:
  - a package can close on a flat or worse score only if the closeout record
    proves each mapped issue's closure condition and assigns every new/surviving
    current-source issue to one owner
  - if overall or strict score drops and there is no exact owner for each new
    same-area issue, reopen or keep open the package instead of advancing
  - full score communication at closeout must include overall, strict,
    objective, verified, File health, Code quality, Duplication, Test health,
    Security, and all subjective dimensions surfaced by `desloppify status`

## Archived Priority Exit Anchors

These compact anchors keep the historical P1-P8 priority-exit gates visible to
the docs verifier without retaining the completed P0-P11 cleanup ledger in the
active docs tree.

- [x] `P1-EXIT`
  - required: record every mapped imported issue with an exact disposition, assign one single final owner for every deferred or split follow-up, and record the package score delta before moving to `P2`
  - Status: completed
  - Handoff: archived

- [x] `P2-EXIT`
  - required: record every mapped imported issue with an exact disposition, assign one single final owner for every deferred or split follow-up, and record the package score delta before moving to `P3`
  - Status: completed
  - Handoff: archived

- [x] `P3-EXIT`
  - required: record every mapped imported issue with an exact disposition, assign one single final owner for every deferred or split follow-up, and record the package score delta before moving to `P4`
  - Status: completed
  - Handoff: archived

- [x] `P4-EXIT`
  - required: record every mapped imported issue with an exact disposition, assign one single final owner for every deferred or split follow-up, and record the package score delta before moving to `P5`
  - Status: completed
  - Handoff: archived

- [x] `P5-EXIT`
  - required: record every mapped imported issue with an exact disposition, assign one single final owner for every deferred or split follow-up, and record the package score delta before moving to `P6`
  - Status: completed
  - Handoff: archived

- [x] `P6-EXIT`
  - required: record every mapped imported issue with an exact disposition, assign one single final owner for every deferred or split follow-up, and record the package score delta before moving to `P7`
  - Status: completed
  - Handoff: archived

- [x] `P7-EXIT`
  - required: record every mapped imported issue with an exact disposition, assign one single final owner for every deferred or split follow-up, and record the package score delta before moving to `P8`
  - Status: completed
  - Handoff: archived

- [x] `P8-EXIT`
  - required: record every mapped imported issue with an exact disposition, assign one single final owner for every deferred or split follow-up, and record the package score delta before moving to `P9`
  - Status: completed
  - Handoff: archived

## Completed P12 Subjective Refresh Summary

P12 is closed. Its exact completed package membership remains in
`docs/architecture/p12-subjective-refresh-package-map.json`.

- Final status: `P12-W1` through `P12-W5` and `P12-EXIT` completed.
- Closeout commit: `5738defa` `Close P12 exit scan evidence`.
- Final scan date: `2026-04-25`.
- Final scan result: `desloppify scan --path .` completed successfully with
  overall `88.0`, strict `87.9`, objective `95.7`, and verified `95.7`; strict
  stayed above the `85.0` target.
- Queue/status evidence: `desloppify next` reported `Queue: 0 items` and
  `Nothing to do! Strict score: 87.9/100`; `desloppify show review --status
  open --no-budget --top 120` reported no active open review rows, while
  `desloppify status` recorded five refreshed future-work review items.
- Security evidence: `desloppify show security --status open --no-budget --top
  50` reported import-cycle rows, not security vulnerabilities.
- Verification evidence: `npm run verify` passed during P12 source closeout, and
  `npm run verify:docs` passed after the P12 checklist closeout.
- Disposition: refreshed post-P12 review items seed P13. They are not P12 reopen
  work and must not be used as source-fix instructions without a P13 owner and
  package-local verification plan.

- [x] `P12-EXIT`
  - required: every P12 review issue had one checklist owner or explicit
    disposition, the P12 package map and checklist agreed, package-local checks
    passed, final integration-branch scan/queue/status/security/review evidence
    was recorded, and docs verification passed.
  - Status: completed
  - Handoff: archived; P13 owns the refreshed post-P12 backlog.

## Active P13 Post-P12 Subjective Backlog

The active P13 exact membership surface is
`docs/architecture/p13-post-p12-subjective-backlog-package-map.json`.

### [x] `P13-W1` `pkg_channel_setup_workflow_and_ui_contract_ownership`

- Backlog: `3` refreshed post-P12 review issues.
- Scope: make the core channel-setup workflow port the canonical contract,
  remove duplicate core/UI workflow-contract ownership, and replace positional
  channel-setup focus registration with a clearer UI-owned API.
- Imported review issues:
  - `review::.::holistic::cross_module_architecture::channel_setup_workflow_contract_owned_by_ui`
  - `review::.::holistic::incomplete_migration::channel_setup_dual_workflow_contract`
  - `review::.::holistic::api_surface_coherence::channel_setup_focus_positional_api`
- Exact seed membership:
  `docs/architecture/p13-post-p12-subjective-backlog-package-map.json` ->
  `pkg_channel_setup_workflow_and_ui_contract_ownership`.
- Core files:
  - `src/core/channel-setup/workflow/ChannelSetupWorkflowPort.ts`
  - `src/core/channel-setup/workflow/createChannelSetupWorkflowPort.ts`
  - `src/core/channel-setup/types.ts`
  - `src/core/channel-setup/planning/ChannelSetupPlanDiagnostics.ts`
  - `src/modules/ui/channel-setup/ChannelSetupSessionRuntime.ts`
  - `src/modules/ui/channel-setup/focus/ChannelSetupFocusCoordinator.ts`
  - `src/modules/ui/channel-setup/steps/StrategyStepInteractionController.ts`
  - `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
  - retired during closeout:
    `src/modules/ui/channel-setup/ChannelSetupSessionPorts.ts`
- Package guardrail: the source-proof matrix must account for both the
  workflow-port owner and the duplicate core/UI shape evidence before choosing
  an execution unit.
- Likely verification: `npm run verify`.
- Status: completed
- Plan: package-local execution brief approved for `P13-W1-WAVE1`
  (`P13-W1-S1` workflow contract canonicalization, `P13-W1-S2` focus API
  object-shape cleanup).
- Last touched: 2026-04-25
- Verification: `npm run verify` passed; targeted `rg` audits found no
  `ChannelSetupSessionWorkflowPort`, no `ChannelSetupSessionPorts` references
  under `src`, and object-shaped `registerStep2` signatures/call sites; all
  package-local `desloppify show <file> --status open --no-budget` sweeps
  reported no open file-path issues, including the now-retired
  `ChannelSetupSessionPorts.ts` path.
- Source-proof closeout:
  - `review::.::holistic::cross_module_architecture::channel_setup_workflow_contract_owned_by_ui`
    is stale-proven resolved: core factory now imports/returns the core
    `ChannelSetupWorkflowPort`, and the duplicate UI contract file is deleted.
  - `review::.::holistic::incomplete_migration::channel_setup_dual_workflow_contract`
    is stale-proven resolved: no `ChannelSetupSessionWorkflowPort` source
    references remain, and unavailable workflow handling imports from the core
    workflow port owner.
  - `review::.::holistic::api_surface_coherence::channel_setup_focus_positional_api`
    is stale-proven resolved: `registerStep2` now accepts one named options
    object across the focus coordinator, strategy interaction adapter, screen
    adapter, and tests.
- Review: plan review and implementation review were clean after revision; the
  implementation reviewer found no sibling wrapper, alias, facade, or new
  same-package debt requiring absorption or replan.
- Follow-ups: none.
- Handoff: `P13-W1` is closed. Do not start `P13-W2` unless this closeout
  remains intact on the integration branch.

### [x] `P13-W2` `pkg_orchestrator_navigation_lifecycle_composition_boundaries`

- Backlog: `5` refreshed post-P12 review issues.
- Scope: reduce remaining AppOrchestrator runtime-hub breadth, narrow
  coordinator-builder assembly inputs, break navigation helper/coordinator type
  cycles, split lifecycle operational concerns, and clarify the bootstrap live
  app export boundary.
- Imported review issues:
  - `review::.::holistic::design_coherence::app_orchestrator_still_runtime_hub`
  - `review::.::holistic::mid_level_elegance::coordinator_builders_full_assembly_bus`
  - `review::.::holistic::dependency_health::navigation_coordinator_type_cycle`
  - `review::.::holistic::design_coherence::app_lifecycle_mixed_operational_concerns`
  - `review::.::holistic::initialization_coupling::bootstrap_live_app_export`
- Exact seed membership:
  `docs/architecture/p13-post-p12-subjective-backlog-package-map.json` ->
  `pkg_orchestrator_navigation_lifecycle_composition_boundaries`.
- Core files:
  - `src/core/orchestrator/AppOrchestrator.ts`
  - `src/core/orchestrator/OrchestratorCoordinatorAssembly.ts`
  - `src/core/orchestrator/OrchestratorCoordinatorBuilders.ts`
  - `src/core/orchestrator/OrchestratorCoordinatorContracts.ts`
  - `src/modules/navigation/NavigationCoordinator.ts`
  - navigation helper files
  - `src/modules/lifecycle/AppLifecycle.ts`
  - `src/bootstrap.ts`
- Likely verification: `npm run verify`.
- Status: completed
- Plan: package-local execution brief approved for serial slices `P13-W2-S1`
  through `P13-W2-S5`.
- Last touched: 2026-04-25
- Verification: `npm run verify` passed; `npm run verify:docs` passed during
  S3 ownership-doc closeout and as part of final `npm run verify`; package-local
  `desloppify show` commands were rerun; exact issue-id queries were rerun with
  `--status all`; targeted `rg` audits found no old navigation deps import, no
  full assembly input in coordinator builders, no selected-server credential
  mutation or priority-one/runtime-controller construction in
  `AppOrchestrator.ts`, no old lifecycle persistence/monitor internals in
  `AppLifecycle.ts`, and no bootstrap live `app` export, `getLineupApp`, or
  exported `App | null` accessor. Direct `desloppify detect cycles --file`
  checks for `NavigationChannelNumberHandler.ts` and `NavigationCoordinator.ts`
  reported no import cycles.
- Source-proof closeout:
  - `review::.::holistic::dependency_health::navigation_coordinator_type_cycle`
    is stale-proven resolved: `NavigationCoordinatorDeps` now lives in a neutral
    navigation contract file, helper imports no longer point back to
    `NavigationCoordinator.ts`, and direct cycle detection reports no import
    cycles.
  - `review::.::holistic::mid_level_elegance::coordinator_builders_full_assembly_bus`
    is stale-proven resolved: all seven named leaf builders now consume narrow
    builder inputs; the full coordinator assembly input remains only in the
    assembly shaper layer.
  - `review::.::holistic::design_coherence::app_orchestrator_still_runtime_hub`
    is stale-proven resolved for the mapped P13-W2 subclaims:
    selected-server credential persistence moved to
    `SelectedServerPersistenceAdapter`, priority-one assembly shaping moved to
    `PriorityOneAssemblyBuilder`, and schedule-day rollover plus subtitle-track
    recovery construction moved to `OrchestratorRuntimeControllerBuilder`.
  - `review::.::holistic::design_coherence::app_lifecycle_mixed_operational_concerns`
    is stale-proven resolved: persistence queueing, connectivity monitoring,
    and memory monitoring moved into focused lifecycle collaborators while
    `AppLifecycle` preserves its public lifecycle API and phase/callback seam.
  - `review::.::holistic::initialization_coupling::bootstrap_live_app_export`
    is stale-proven resolved: bootstrap app state is private and the exported
    status seam returns bounded snapshot facts, not `App`, `Orchestrator`, or
    mutable live runtime objects.
- Review: plan review was clean after revision; every implementation slice
  reached clean review. S3 and S4 had review findings that were fixed and
  closure-checked before fresh final approval; S5 had a live-app accessor finding
  that was fixed and then passed fresh final review.
- Follow-ups: accepted residue only for pre-existing objective detector rows not
  owned by P13-W2 exact membership: the nested-closure row in
  `OrchestratorCoordinatorBuilders.ts`, navigation helper transitive-test rows,
  and lifecycle log/shallow-test/swallowed-error rows remain with the existing
  Desloppify objective queue as final owner; revisit when `desloppify next`
  selects them. No P13-W2 exact review issue has a deferred or split follow-up.
- Handoff: `P13-W2` is closed. Next safe start is a package-local
  execution-grade plan for `P13-W3`; do not start source cleanup directly from
  refreshed review output.

### [x] `P13-W3` `pkg_epg_and_channel_setup_ui_runtime_complexity`

- Backlog: `4` refreshed post-P12 review issues.
- Scope: split EPG info-panel render/fetch/color ownership, reduce
  EPGVirtualizer render-context closure complexity, isolate EPG background warm
  queue scheduling policy, and remove duplicated strategy-step control tables.
- Imported review issues:
  - `review::.::holistic::design_coherence::epg_info_panel_mixed_render_fetch_color`
  - `review::.::holistic::low_level_elegance::epg_virtualizer_render_context_closure_nest`
  - `review::.::holistic::low_level_elegance::epg_background_warm_schedule_next_batch_dense`
  - `review::.::holistic::design_coherence::strategy_step_control_tables_duplicated`
- Exact seed membership:
  `docs/architecture/p13-post-p12-subjective-backlog-package-map.json` ->
  `pkg_epg_and_channel_setup_ui_runtime_complexity`.
- Core files:
  - `src/modules/ui/epg/view/EPGInfoPanel.ts`
  - `src/modules/ui/epg/view/EPGVirtualizer.ts`
  - `src/modules/ui/epg/runtime/EPGBackgroundWarmQueue.ts`
  - `src/modules/ui/channel-setup/steps/StrategyStepInteractionController.ts`
- Likely verification: `npm run verify`.
- Status: completed
- Plan: package-local execution brief approved for serial execution units
  `P13-W3-EU1` through `P13-W3-EU4`.
- Last touched: 2026-04-26
- Verification: targeted package tests passed (`266` Jest tests plus `4`
  channel-setup contract tests); `npm run verify` passed after the final
  explicit-return-type cleanup; package-local `desloppify show` commands were
  rerun and reported no open file-scoped issues; exact issue-id queries were
  rerun with `--status all` and still show stale review wording; targeted `rg`
  audits confirmed warm-queue batch/scheduler work now lives in named methods,
  EPG virtualizer budget/sampling work lives in `RenderPassAccumulator`, EPG
  info-panel fetch/color/cache work lives in package-local collaborators, and
  strategy-step dropdown/cycle behavior derives from one descriptor table.
- Source-proof closeout:
  - `review::.::holistic::low_level_elegance::epg_background_warm_schedule_next_batch_dense`
    is stale-proven resolved: `_scheduleNextBatch` resolves and applies queue
    action/backpressure only, while batch execution, worker fan-out, safe error
    reporting, and idle/timer scheduling live in named methods.
  - `review::.::holistic::low_level_elegance::epg_virtualizer_render_context_closure_nest`
    is stale-proven resolved: render-pass row budget, visible/buffer queues,
    focused-cell exemption, row finalization, and sampling policy live in the
    package-local `RenderPassAccumulator` instead of nested closures.
  - `review::.::holistic::design_coherence::epg_info_panel_mixed_render_fetch_color`
    is stale-proven resolved: `EPGInfoPanel` remains the presenter/DOM binder
    and delegates HDR/episode-poster loading/cache state to
    `EPGInfoPanelDetailsLoader` and dynamic color sampling/object URL/cache
    state/gradient mutation to `EPGInfoPanelDynamicBackground`.
  - `review::.::holistic::design_coherence::strategy_step_control_tables_duplicated`
    is stale-proven resolved: `STRATEGY_CONTROL_DESCRIPTORS` is the single local
    source for adjustable strategy control ids, options, current values,
    disabled predicates, draft mutation, and preset/discrete cycling mode.
- Review: plan review found missing wave/slice accounting, the planner revised
  to serial execution units, and a fresh final plan review approved
  implementation. Every implementation unit reached clean review; the final
  integrated source review approved the behavior-neutral return-type cleanup
  before checklist/package-map closeout.
- Follow-ups: none for P13-W3 exact membership. The exact issue-id queries still
  return stale imported review text, but current-source proof and implementation
  review show the package-owned complaints are resolved; do not create a new
  follow-up solely from detector wording lag.
- Handoff: `P13-W3` is closed. Next safe start is a package-local
  execution-grade plan for `P13-W4`; do not close `P13-EXIT` until later P13
  packages are complete.

### [x] `P13-W4` `pkg_plex_and_player_contract_error_semantics`

- Backlog: `6` refreshed post-P12 review issues.
- Scope: preserve Plex library error causes, clarify Plex image URL trust
  boundaries, document or normalize transcode URL throw semantics, extract Plex
  discovery retry/fallback policy, tighten Plex user parser record contracts,
  and simplify synchronous audio-track restoration.
- Imported review issues:
  - `review::.::holistic::error_consistency::plex_library_error_wrapping_loses_cause`
  - `review::.::holistic::authorization_consistency::plex_image_foreign_url_boundary`
  - `review::.::holistic::contract_coherence::plex_transcode_url_throws_undocumented`
  - `review::.::holistic::design_coherence::plex_discovery_discover_servers_pipeline`
  - `review::.::holistic::type_safety::plex_user_parser_record_contract`
  - `review::.::holistic::logic_clarity::restore_track_async_without_await`
- Exact seed membership:
  `docs/architecture/p13-post-p12-subjective-backlog-package-map.json` ->
  `pkg_plex_and_player_contract_error_semantics`.
- Core files:
  - `src/modules/plex/library/PlexLibraryError.ts`
  - `src/modules/plex/library/PlexLibrary.ts`
  - `src/modules/plex/auth/plexAuthTransport.ts`
  - `src/modules/plex/shared/plexUrl.ts`
  - `src/modules/plex/stream/interfaces.ts`
  - `src/modules/plex/stream/PlexStreamResolver.ts`
  - `src/modules/plex/stream/resolveStreamPipeline.ts`
  - `src/modules/plex/discovery/PlexServerDiscovery.ts`
  - `src/modules/plex/auth/plexAuthPayloadParsers.ts`
  - `src/modules/plex/auth/PlexAuth.ts`
  - `src/modules/player/SubtitleManager.ts`
  - `src/modules/player/AudioTrackManager.ts`
- Package guardrail: the package-local plan must separate Plex contract/error
  semantics from player-only simplification unless it proves a shared execution
  unit, owner, and verification envelope.
- Likely verification: `npm run verify`.
- Status: completed
- Plan: package-local execution brief approved for serial single-slice units
  `P13-W4-EU1` through `P13-W4-EU6`.
- Last touched:
  - `964aa21e` `Preserve Plex library error causes`
  - `9031be56` `Reject foreign Plex image URLs`
  - `86cb0c84` `Document Plex transcode URL failures`
  - `4c25001e` `Extract Plex discovery request policy`
  - `f18a2ebf` `Validate Plex user profile payloads`
  - `dc0089da` `Simplify audio track restore`
- Source-proof disposition:
  - `review::.::holistic::error_consistency::plex_library_error_wrapping_loses_cause`
    is stale-proven resolved by preserving sanitized `cause`/`context` on
    `PlexLibraryError` wrappers for parse, network, timeout, and unknown
    failures without using native raw `Error.cause` or leaking Plex tokens.
  - `review::.::holistic::authorization_consistency::plex_image_foreign_url_boundary`
    is stale-proven resolved by rejecting foreign absolute image metadata with
    `null` in both library image URL construction and shared Plex resource URL
    construction while preserving server-relative and same-server absolute
    image URLs.
  - `review::.::holistic::contract_coherence::plex_transcode_url_throws_undocumented`
    is stale-proven resolved by documenting synchronous `StreamResolverError`
    throws on the public interface, implementation JSDoc, and Plex API docs,
    plus a pipeline contract test proving the transcode-path throw propagates
    unchanged.
  - `review::.::holistic::design_coherence::plex_discovery_discover_servers_pipeline`
    is stale-proven resolved by moving Plex resource request variants, timeout,
    retry/backoff/rate-limit, 5xx fallback, response parsing, and response
    error mapping into the stateless `PlexResourceDiscoveryRequestPolicy`
    helper while leaving cache, stale-context handling, selected-server state,
    events, and health persistence in `PlexServerDiscovery`.
  - `review::.::holistic::type_safety::plex_user_parser_record_contract` is
    stale-proven resolved by making `parseUserResponse` accept `unknown`,
    validate required profile fields internally, and throw typed parse errors
    without manufacturing required token fields from missing payload fields.
  - `review::.::holistic::logic_clarity::restore_track_async_without_await` is
    stale-proven resolved by making `_restoreTrack` synchronous and calling it
    directly inside the existing recovery `try/catch`.
- Accepted residue:
  - The remaining objective `AudioTrackManager.ts` `console_error_no_throw` and
    `swallowed_error` Desloppify rows are pre-existing objective backlog
    signals for the restore-failure catch/log path, not part of P13-W4 exact
    review membership. Final owner: the existing Desloppify objective queue;
    revisit when `desloppify next` or a future objective cleanup selects the
    `AudioTrackManager.ts` restore-failure catch/log path. Verification command:
    `desloppify show src/modules/player/AudioTrackManager.ts --status open --no-budget --top 80`.
    The mapped async-without-await complaint is closed by current-source proof.
  - The imported exact review issue queries still return stale original
    Desloppify review rows, but every P13-W4 exact issue is resolved by
    current-source proof and reviewed implementation evidence.
- Verification:
  - Targeted package Jest command passed: 10 suites, 384 tests.
  - `npm run typecheck` passed.
  - `npm run verify` passed, including architecture lint, CSS lint, coverage
    tests, tools tests, contract tests, docs verification, and build; Vite
    emitted only the existing chunk-size warning.
  - `npm run verify:docs` passed as part of `npm run verify` before this
    closeout edit and will be rerun for the final closeout commit.
  - Package-local Desloppify show commands and exact issue-id queries were
    rerun; stale imported review rows remain but are resolved by current-source
    proof.
  - Targeted `rg` audits covered sanitized library causes, foreign image URL
    boundaries, transcode throw contract docs/call sites, parser required-field
    manufacturing, audio restore async/await removal, and discovery
    state/storage/event ownership.
- Follow-ups: none for P13-W4 exact membership. `P13-W5` and `P13-EXIT` are
  closed by later records in this checklist.
- Handoff: `P13-W4` is closed. Later P13 records complete P13-W5 and P13
  priority exit.

### [x] `P13-W5` `pkg_documentation_comment_and_package_hygiene`

- Backlog: `4` refreshed post-P12 review issues.
- Scope: planning container for four small hygiene issues that must remain
  separately owned at execution time: lifecycle/player restating comments, Plex
  type/constant doc bloat, profile-select style-shard organization, and stale
  channel-setup owner paths in current architecture truth.
- Imported review issues:
  - `review::.::holistic::ai_generated_debt::lifecycle_player_restating_comments`
  - `review::.::holistic::ai_generated_debt::plex_type_constant_doc_bloat`
  - `review::.::holistic::package_organization::profile_select_nested_css_shards`
  - `review::.::holistic::high_level_elegance::canonical_architecture_channel_setup_path_drift`
- Exact seed membership:
  `docs/architecture/p13-post-p12-subjective-backlog-package-map.json` ->
  `pkg_documentation_comment_and_package_hygiene`.
- Core files:
  - `src/modules/lifecycle/AppLifecycle.ts`
  - `src/modules/player/VideoPlayer.ts`
  - `src/modules/plex/discovery/types.ts`
  - `src/modules/plex/library/constants.ts`
  - `src/modules/ui/profile-select/styles.css`
  - `src/modules/ui/profile-select/styles.layout.css`
  - `src/modules/ui/profile-select/styles.cards.css`
  - `src/modules/ui/profile-select/styles.pin-modal.css`
  - `docs/architecture/CURRENT_STATE.md`
- Likely verification: source/style changes require `npm run verify`; current
  architecture doc changes require `npm run verify:docs`.
- Package guardrail: `P13-W5` is not a miscellaneous cleanup bucket. Its
  package-local plan must either split these issues into explicit execution
  units with one owner and verification command each, or mark an issue
  `deferred`/`split follow-up` with one final owner and revisit trigger before
  closing any completed subset.
- Status: completed
- Plan: local cleanup-loop execution units `P13-W5-EU1` through `P13-W5-EU4`.
- Last touched: 2026-04-26
- Dispositions:
  - `P13-W5-S1` / `review::.::holistic::ai_generated_debt::lifecycle_player_restating_comments` resolved by removing restating comments in lifecycle/player code while preserving non-obvious phase, platform, retry, and media-session rationale.
  - `P13-W5-S2` / `review::.::holistic::ai_generated_debt::plex_type_constant_doc_bloat` resolved by removing Plex file/module/version headers, wrapper comments, and obvious per-field/per-constant comments while preserving non-obvious protocol/default semantics.
  - `P13-W5-S3` / `review::.::holistic::package_organization::profile_select_nested_css_shards` resolved by flattening profile-select CSS shards to `styles.layout.css`, `styles.cards.css`, and `styles.pin-modal.css` with unchanged CSS content and preserved import order.
  - `P13-W5-S4` / `review::.::holistic::high_level_elegance::canonical_architecture_channel_setup_path_drift` resolved by correcting canonical channel-setup owner paths in `docs/architecture/CURRENT_STATE.md` to the current `persistence/`, `build/`, and `planning/` source paths.
- Verification:
  - Exact issue-id `desloppify show --status open` checks for all four imported review issues reported no open matches during execution-unit proof.
  - Package-local `desloppify show` checks for the touched source/doc/style paths reported no remaining package-owned open issues, except pre-existing AppLifecycle log/swallowed-error/shallow-test rows outside P13-W5 scope.
  - Targeted `rg` checks cleared the stale comment/path/import evidence for S1-S4, including profile-select nested-path references in source, checklist, and package-map surfaces.
  - `git diff --check` passed for each execution unit's touched files.
  - Full `npm run verify` and `npm run verify:docs` passed during final package verification.
- Follow-ups: none for P13-W5 exact membership. `P13-EXIT` is closed by the
  controller-owned priority-exit record below.
- Handoff: `P13-W5` is closed for implementation and P13 priority exit is
  complete; do not reopen P13 exact issues solely from stale detector wording.

### [x] `P13-EXIT`

- Close only if: every P13 review issue has one checklist owner or explicit
  disposition, every absorbed mechanical hotspot has one exact owner or
  explicit disposition, the P13 package map and checklist agree, package-local
  checks pass, final integration-branch `desloppify scan --path .` succeeds,
  `desloppify status`, queue, review, and security evidence are recorded, and
  `npm run verify` and/or `npm run verify:docs` pass as appropriate.
- Required commands:
  - `desloppify scan --path .`
  - `desloppify status`
  - `desloppify plan queue --sort recent`
  - `desloppify next`
  - `desloppify show review --status open --no-budget --top 120`
  - `desloppify show security --status open --no-budget --top 50`
  - rerun each completed package's local scoping commands
  - `npm run verify` and/or `npm run verify:docs`, matching touched surfaces
- Status: completed
- Plan: controller-owned P13 priority-exit evidence pass on the integration
  branch. Verification mode: `integration-ops`; classification: broader
  integration/manual proof required.
- Last touched: 2026-04-26
- Exit evidence:
  - Checklist and package map agree: `P13-W1` through `P13-W5` are complete,
    all `5` package-map execution statuses are `completed`, and package-map
    validation reports `22` expected / `22` assigned exact review issues with
    no duplicates or unassigned ids.
  - Every P13 exact review issue has one owner/disposition: all `22`
    `desloppify show <exact-review-issue-id> --status open --no-budget --top 20`
    checks returned no open matches; source-proof dispositions remain recorded
    under each package.
  - Package-local sweep passed: `40` package-local `desloppify show` commands
    ran with no failures. Open rows are accepted objective residue outside P13
    exact membership and have final owners or dispositions: P13-W2 objective
    builder/navigation/lifecycle rows remain with the existing Desloppify
    objective queue, P13-W4 `AudioTrackManager.ts` catch/log rows remain with
    the existing Desloppify objective queue, and P13-W5 only resurfaced the
    already documented AppLifecycle objective residue outside P13-W5 scope.
  - Final integration-branch `desloppify scan --path .` succeeded. Scores:
    overall `88.1`, objective `96.0`, strict `88.0`, verified `96.0`; security
    detector pass reported clean during scan, and subjective review reported
    clean across `20` dimensions. The scan also reported `+15` new and `-24`
    resolved objective/query changes, skipped boilerplate auto-resolve because
    `jscpd` errored, and skipped auto-resolve for review because the review
    pass returned `0`, likely transient.
  - `desloppify status` recorded strict `88.0`, `324` open in-scope/global
    issues, and a CLI triage recommendation for `5` new review work items.
    `desloppify plan queue --sort recent` reported an empty queue, and
    `desloppify next` reported nothing to do.
  - `desloppify show review --status open --no-budget --top 120` returned no
    open issues matching `review`. `desloppify show security --status open --no-budget --top 50`
    returned three open `cycles` rows via search-term matching; direct
    `desloppify detect cycles --file` checks for
    `src/core/channel-setup/planning/ChannelSetupFacetSnapshotLoadSession.ts`,
    `src/core/channel-setup/planning/ChannelSetupPlanner.ts`,
    `src/modules/navigation/NavigationChannelNumberHandler.ts`, and
    `src/modules/navigation/NavigationCoordinator.ts` all reported no import
    cycles, so those rows are stale query residue rather than live P13-owned
    blockers.
  - Review: read-only P13-EXIT ownership review initially blocked on missing
    final-owner wording for P13-W4 `AudioTrackManager.ts` objective residue;
    checklist and package map were updated with the final owner, revisit
    trigger, and verification command, and the closure check approved the
    patch with no new blocker.
- Verification:
  - `desloppify scan --path .` passed.
  - `desloppify status` passed.
  - `desloppify plan queue --sort recent` passed.
  - `desloppify next` passed.
  - `desloppify show review --status open --no-budget --top 120` passed with
    no open review matches.
  - `desloppify show security --status open --no-budget --top 50` ran and was
    reconciled against direct cycle-detection proof.
  - Package-local scoping commands for all five completed packages passed as
    described above.
  - `npm run verify` passed; Vite emitted only the existing chunk-size warning.
  - `npm run verify:docs` passed.
- Follow-ups: no P13 exact-membership follow-ups. Accepted non-P13 objective
  residue remains with the existing Desloppify objective queue and should be
  revisited only when `desloppify next` or a future objective cleanup selects
  those rows.
- Handoff: `P13` priority exit is closed. Do not reopen P13 exact issues solely
  from stale detector wording; require current-source proof of a live seam.

## Not Active Checklist Scope By Default

- The five subjective reassessment placeholders currently shown by
  `desloppify plan queue --sort recent`: low elegance, stale migration, init
  coupling, convention drift, and dependency health.
- `stale_exclude::*` rows for local/tooling directories unless repo policy
  changes.
- Duplicate detector rows or detector-lag rows without current-source evidence.
- Dirty source edits already present in the worktree; evaluate them separately
  before assuming they belong to a P13 package.
