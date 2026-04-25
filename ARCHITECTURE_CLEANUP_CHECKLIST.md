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

- Current execution state: P0-P12 are complete; P13 is the active
  checklist-linked cleanup planning priority seeded from the refreshed post-P12
  subjective review backlog.
- Next safe start: create a package-local execution-grade plan for `P13-W1`, or
  for another P13 package only if maintainer direction explicitly changes the
  order. Do not start source cleanup directly from the refreshed review output
  without a package-local plan and review.
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

### [ ] `P13-W1` `pkg_channel_setup_workflow_and_ui_contract_ownership`

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
  - `src/modules/ui/channel-setup/ChannelSetupSessionPorts.ts`
  - `src/modules/ui/channel-setup/ChannelSetupSessionRuntime.ts`
  - `src/modules/ui/channel-setup/focus/ChannelSetupFocusCoordinator.ts`
  - `src/modules/ui/channel-setup/steps/StrategyStepInteractionController.ts`
  - `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
- Likely verification: `npm run verify`.
- Status: not started
- Plan: none yet
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: create a package-local execution-grade plan before source edits.

### [ ] `P13-W2` `pkg_orchestrator_navigation_lifecycle_composition_boundaries`

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
- Status: not started
- Plan: none yet
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: plan only after `P13-W1` is complete or explicitly deferred with one
  final owner.

### [ ] `P13-W3` `pkg_epg_and_channel_setup_ui_runtime_complexity`

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
- Status: not started
- Plan: none yet
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: plan only after earlier P13 owners are complete or explicitly
  deferred with one final owner.

### [ ] `P13-W4` `pkg_plex_and_player_contract_error_semantics`

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
  - `src/modules/plex/shared/plexUrl.ts`
  - `src/modules/plex/stream/interfaces.ts`
  - `src/modules/plex/stream/PlexStreamResolver.ts`
  - `src/modules/plex/discovery/PlexServerDiscovery.ts`
  - `src/modules/plex/auth/plexAuthPayloadParsers.ts`
  - `src/modules/player/AudioTrackManager.ts`
- Likely verification: `npm run verify`.
- Status: not started
- Plan: none yet
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: plan only after earlier P13 owners are complete or explicitly
  deferred with one final owner.

### [ ] `P13-W5` `pkg_documentation_comment_and_package_hygiene`

- Backlog: `4` refreshed post-P12 review issues.
- Scope: trim restating lifecycle/player comments, trim Plex type/constant doc
  bloat, flatten profile-select style shards if the package-local audit confirms
  the inconsistency, and update stale channel-setup owner paths in current
  architecture truth.
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
  - `src/modules/ui/profile-select/styles/*`
  - `docs/architecture/CURRENT_STATE.md`
- Likely verification: source/style changes require `npm run verify`; current
  architecture doc changes require `npm run verify:docs`.
- Status: not started
- Plan: none yet
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: plan only after earlier P13 owners are complete or explicitly
  deferred with one final owner.

### [ ] `P13-EXIT`

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
- Status: not started
- Plan: none yet
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: do not close until all P13 work items are complete or explicitly
  disposed with one final owner.

## Not Active Checklist Scope By Default

- The five subjective reassessment placeholders currently shown by
  `desloppify plan queue --sort recent`: low elegance, stale migration, init
  coupling, convention drift, and dependency health.
- `stale_exclude::*` rows for local/tooling directories unless repo policy
  changes.
- Duplicate detector rows or detector-lag rows without current-source evidence.
- Dirty source edits already present in the worktree; evaluate them separately
  before assuming they belong to a P13 package.
