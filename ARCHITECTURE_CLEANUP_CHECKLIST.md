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

- Current execution state: P0-P11 are complete and archived; P12 work packages
  are complete, and `P12-EXIT` is blocked on the final scan guard.
- Next safe start: resolve `P12-EXIT` by clearing the five subjective
  reassessment placeholders or getting maintainer approval for the
  `desloppify scan --force-rescan` path.
- Preferred launcher: `cleanup-loop` for checklist-linked cleanup orchestration.
- First action at package start: for new checklist-linked work, planning only;
  create the package-local execution-grade plan before implementation.
- Active exact issue-membership surface:
  `docs/architecture/p12-subjective-refresh-package-map.json`.
- Prior fresh-baseline exact issue-membership surface:
  `docs/architecture/p11-fresh-baseline-package-map.json`.
- Authoritative evidence rule: only integration-branch `desloppify` reruns may
  change backlog status, package completion claims, exit records, or closeout
  claims.

## Current Evidence Snapshot

Source: trusted internal subjective review run
`.desloppify/subagents/runs/20260424_185104/holistic_issues_merged.json`,
follow-up `desloppify scan --path .`, and local queue reads on `2026-04-24`.

- Imported review result: `27` new review issues, `56` resolved, `0` reopened.
- Living plan result: `30` planned review work items; `36` stale review work
  items removed; `15` covered subjective queue items removed.
- Current queue read: `desloppify plan queue --sort recent` reports `5`
  subjective reassessment placeholders, not direct implementation packages.
- Current direct review read: `desloppify show review --status open --no-budget
  --top 80` reports no open `review` detector rows, while `desloppify plan`
  still lists the `30` planned review items. Treat the P12 companion map as the
  exact checklist scope until the next authoritative scan/plan sync proves a
  different state.
- Scores after the follow-up scan: overall `85.8`, objective `96.8`, strict
  `85.8`, verified `96.8`.
- Mechanical pool: `96.8%`; subjective pool: `82.1%`.
- Largest weighted subjective drags: high elegance `76.0`, design coherence
  `64.0`, mid elegance `84.0`, abstraction fit `78.0`, contracts `88.0`.
- Security: `100.0`, no open security issues in the pasted scan output.

Score interpretation: the `-0.1` strict drop is not evidence that the P11 fixes
regressed the code. The newer `gpt-5.5` review surfaced a more current
subjective backlog and removed stale review rows at the same time. The active
cleanup question is now whether the 30 imported issues represent worthwhile
current-source work; the package map below keeps only those issue ids as P12
scope.

## Operating Contract

- Work top to bottom unless maintainer direction says otherwise.
- Keep authoritative execution state in Codex `update_plan`.
- Create a package-local execution-grade plan for the selected `P12-W#`; keep it
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

## P12 Closure Protocol

P12 packages must prove they closed the current-source issue area, not just
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
  - reviewer must list any newly introduced issue that belongs to the same P12
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
  - if the fix reveals a different issue area, assign it to one later P12 owner
    or a new checklist item before closing the current package
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

## Active P12 Subjective Refresh Queue

The active P12 exact membership surface is
`docs/architecture/p12-subjective-refresh-package-map.json`.

### [x] `P12-W1` `pkg_runtime_assembly_and_initialization_boundary`

- Backlog: `seed 10` fresh subjective review issues.
- Scope: reduce the remaining AppOrchestrator/coordinator/priority-one assembly
  hub, move initialization ownership toward the initialization package, clarify
  startup phase vocabulary, and trim root/public barrels where they still widen
  runtime ownership.
- Exact seed membership:
  `docs/architecture/p12-subjective-refresh-package-map.json` ->
  `pkg_runtime_assembly_and_initialization_boundary`.
- Package-local scoping commands:
  - `desloppify show src/core/orchestrator/AppOrchestrator.ts --status open --no-budget --top 120`
  - `desloppify show src/core/orchestrator/OrchestratorCoordinatorBuilders.ts --status open --no-budget --top 120`
  - `desloppify show src/core/orchestrator/priority-one --status open --no-budget --top 120`
  - `desloppify show src/core/orchestrator/InitializationCoordinator.ts --status open --no-budget --top 80`
  - `desloppify show src/core/initialization/InitializationCoordinator.ts --status open --no-budget --top 80`
  - `desloppify show src/Orchestrator.ts --status open --no-budget --top 80`
  - `desloppify show src/core/index.ts --status open --no-budget --top 80`
- Likely first slice: inventory the runtime assembly and priority-one handoff
  seams; choose one shaping boundary to collapse before moving files or barrels.
- Status: completed
- Plan: local-only cleanup-loop plan reviewed and approved
- Last touched: 2026-04-24
- Verification: `npm run verify` passed; `npm run verify:docs` passed after
  checklist closeout; package-local `desloppify show` commands rerun with no
  open issues for `AppOrchestrator`, `OrchestratorCoordinatorBuilders`, old/new
  `InitializationCoordinator`, `src/Orchestrator.ts`, or `src/core/index.ts`;
  priority-one residual mechanical smells remain accepted as non-P12-W1
  closure blockers; exact imported review-id queries returned no open rows;
  `desloppify scan --path .` completed with overall `85.8`, strict `85.8`,
  objective `97.1`, and verified `97.1`.
- Follow-ups: none for P12-W1; `P12-EXIT` remains pending until all P12
  packages are complete.
- Handoff: continue with `P12-W2`.

### [x] `P12-W2` `pkg_plex_api_error_and_url_contracts`

- Backlog: `seed 7` fresh subjective review issues.
- Scope: align Plex cancellation, auth/error semantics, URL absence contracts,
  header typing, stream URL policy ownership, discovery cause preservation, and
  library-count enrichment.
- Exact seed membership:
  `docs/architecture/p12-subjective-refresh-package-map.json` ->
  `pkg_plex_api_error_and_url_contracts`.
- Package-local scoping commands:
  - `desloppify show src/modules/plex/library/PlexLibrary.ts --status open --no-budget --top 120`
  - `desloppify show src/modules/plex/library/interfaces.ts --status open --no-budget --top 80`
  - `desloppify show src/modules/plex/discovery/PlexServerDiscovery.ts --status open --no-budget --top 80`
  - `desloppify show src/modules/plex/auth/plexAuthTransport.ts --status open --no-budget --top 80`
  - `desloppify show src/modules/plex/stream/PlexStreamResolver.ts --status open --no-budget --top 120`
  - `desloppify show src/modules/plex/shared/plexUrl.ts --status open --no-budget --top 80`
- Likely first slice: handle the single-edit API/contract items
  (`search` signal, `getImageUrl` nullability, typed auth headers, discovery
  cause preservation) before larger stream/library decomposition.
- Status: completed
- Plan: local-only cleanup-loop plan reviewed and approved
- Last touched: 2026-04-24
- Verification: focused Plex tests passed for library, discovery, auth,
  shared URL, stream resolver, and stream URL policy surfaces; `npm run verify`
  passed; `desloppify scan --path .` completed with overall `85.8`, strict
  `85.8`, objective `97.0`, and verified `97.0`; `desloppify status` recorded
  File health `92.6` (`92.2` strict), Code quality `98.1`, Duplication
  `100.0`, Test health `99.0`, Security `100.0`, and subjective dimensions:
  AI generated debt `78.0`, API coherence `84.0`, Abstraction fit `78.0`,
  Auth consistency `84.0`, Contracts `88.0`, Convention drift `92.0`,
  Cross-module arch `76.0`, Design coherence `64.0`, Elegance `83.0`, Error
  consistency `80.0`, Naming quality `88.0`, Stale migration `91.0`,
  Structure nav `78.0`, Test strategy `82.0`, and Type safety `88.0`;
  package-local `desloppify show` commands and all seven exact review-id
  queries returned no open rows; targeted source audits confirmed `search`
  signal threading, `getImageUrl()` null absence, typed Plex URL headers,
  sanitized discovery causes, endpoint-aware `403` semantics, stream URL
  policy ownership, and delegated library-count enrichment.
- Follow-ups: none for P12-W2; `P12-EXIT` remains pending until all P12
  packages are complete.
- Handoff: continue with `P12-W3`.

### [x] `P12-W3` `pkg_channel_setup_scheduler_strategy_and_errors`

- Backlog: `seed 5` fresh subjective review issues.
- Scope: tighten channel setup package organization, planner/facet-loader
  decomposition, workflow policy honesty, and ChannelManager typed public
  failures.
- Exact seed membership:
  `docs/architecture/p12-subjective-refresh-package-map.json` ->
  `pkg_channel_setup_scheduler_strategy_and_errors`.
- Package-local scoping commands:
  - `desloppify show src/core/channel-setup/ChannelSetupWorkflow.ts --status open --no-budget --top 80`
  - `desloppify show src/core/channel-setup/ChannelSetupPlanner.ts --status open --no-budget --top 120`
  - `desloppify show src/core/channel-setup/ChannelSetupFacetSnapshotLoader.ts --status open --no-budget --top 120`
  - `desloppify show src/core/channel-setup --status open --no-budget --top 160`
  - `desloppify show src/modules/scheduler/channel-manager/ChannelManager.ts --status open --no-budget --top 100`
  - `desloppify show src/modules/scheduler/channel-manager/interfaces.ts --status open --no-budget --top 80`
- Likely first slice: normalize ChannelManager public failure typing if still
  live, then decide whether channel setup work starts with package folders,
  planner strategy builders, or facet-loader load-session extraction.
- Status: completed
- Plan: local-only cleanup-loop plan reviewed and approved
- Last touched: 2026-04-25
- Verification: P12-W3 exact imported review-id queries returned no open rows
  for `channel_manager_bare_errors_bypass_channel_error`,
  `channel_setup_workflow_facade`, `channel_setup_flat_mixed_package`,
  `channel_setup_planner_strategy_pipeline`, and
  `facet_snapshot_loader_mixed_control_flow`; package-local `desloppify show`
  commands returned no open rows for `ChannelSetupWorkflow.ts`,
  `ChannelSetupPlanner.ts`, `ChannelSetupFacetSnapshotLoader.ts`,
  `ChannelManager.ts`, and `interfaces.ts`; package-folder sweep still reports
  accepted mechanical residue in extracted planning leaves
  (`ChannelSetupStrategyBuilders.ts`, `ChannelSetupFacetSnapshotLoadSession.ts`,
  `ChannelSetupPlanningTypes.ts`) that is not a live P12-W3 imported-review
  blocker.
- Follow-ups: none for P12-W3; `P12-EXIT` remains pending until all P12
  packages are complete.
- Handoff: continue with `P12-W4`.

### [x] `P12-W4` `pkg_ui_epg_navigation_package_coherence`

- Backlog: `seed 5` fresh subjective review issues.
- Scope: decouple UI packages from core coordination contracts where current
  source proves an ownership leak, finish EPG root/package splits, reduce
  NavigationCoordinator and EPGVirtualizer mixed responsibilities, and align EPG
  error typing with `AppErrorCode`.
- Exact seed membership:
  `docs/architecture/p12-subjective-refresh-package-map.json` ->
  `pkg_ui_epg_navigation_package_coherence`.
- Package-local scoping commands:
  - `desloppify show src/modules/ui/channel-setup --status open --no-budget --top 120`
  - `desloppify show src/modules/ui/epg --status open --no-budget --top 160`
  - `desloppify show src/modules/ui/epg/view/EPGVirtualizer.ts --status open --no-budget --top 120`
  - `desloppify show src/modules/navigation/NavigationCoordinator.ts --status open --no-budget --top 120`
  - `desloppify show src/modules/ui/epg/types.ts --status open --no-budget --top 80`
- Likely first slice: choose between EPG package split and EPG error-type
  cleanup; do not fold broad navigation decomposition into the first slice
  unless the package plan proves the same verification envelope.
- Status: completed
- Plan: local-only cleanup-loop plan reviewed and approved
- Last touched: 2026-04-25
- Verification: exact imported review-id queries returned no open rows for all
  five P12-W4 ids; package-local `desloppify show` commands returned no open
  rows for `src/modules/ui/channel-setup`,
  `src/modules/ui/epg/view/EPGVirtualizer.ts`,
  `src/modules/navigation/NavigationCoordinator.ts`, and
  `src/modules/ui/epg/types.ts`; `src/modules/ui/epg` package sweep reports
  only accepted CSS monolith residue in style files that was explicitly out of
  P12-W4 implementation scope. Targeted `rg` audits confirmed production UI no
  longer imports `core/channel-setup`, `core/channel-tuning`, or
  `core/module-status`; scoped EPG error handling has no raw quoted EPG error
  literals; old root-level moved EPG owner paths are absent from current
  architecture/tool/package-map surfaces; EPG root contains only public seam,
  type, utility, and style files; navigation routing delegates key-mode,
  repeat, modal, screen, and channel-number behavior to navigation-local
  handlers. `npm run verify` passed. `npm run verify:docs` passed after the
  repo-local skill link update. `desloppify status` recorded overall `85.7`,
  strict `85.7`, objective `96.7`, verified `96.7`, File health `92.4`
  (`91.6` strict), Code quality `98.1`, Duplication `99.9`, Test health
  `97.5` (`97.3` strict), Security `99.7`, and subjective dimensions:
  AI generated debt `78.0`, API coherence `84.0`, Abstraction fit `78.0`,
  Auth consistency `84.0`, Contracts `88.0`, Convention drift `92.0`,
  Cross-module arch `76.0`, Design coherence `64.0`, Elegance `83.0`,
  Error consistency `80.0`, Naming quality `88.0`, Stale migration `91.0`,
  Structure nav `78.0`, Test strategy `82.0`, and Type safety `88.0`.
- Follow-ups: none for P12-W4; `P12-EXIT` remains pending until all P12
  packages are complete.
- Handoff: continue with `P12-W5`.

### [x] `P12-W5` `pkg_focused_test_and_comment_hygiene`

- Backlog: `seed 3` fresh subjective review issues.
- Scope: retire the remaining high-value focused test seams and restating
  player/scheduler comment noise without turning this into a miscellaneous
  residue sink.
- Exact seed membership:
  `docs/architecture/p12-subjective-refresh-package-map.json` ->
  `pkg_focused_test_and_comment_hygiene`.
- Package-local scoping commands:
  - `desloppify show src/core/channel-tuning/__tests__/ChannelTuningCoordinator.test.ts --status open --no-budget --top 100`
  - `desloppify show src/modules/lifecycle/AppLifecycle.ts --status open --no-budget --top 100`
  - `desloppify show src/modules/lifecycle/__tests__/AppLifecycle.test.ts --status open --no-budget --top 100`
  - `desloppify show src/modules/player/RetryManager.ts --status open --no-budget --top 80`
  - `desloppify show src/modules/player/SubtitleManager.ts --status open --no-budget --top 80`
  - `desloppify show src/modules/player/VideoPlayer.ts --status open --no-budget --top 80`
  - `desloppify show src/modules/scheduler/scheduler --status open --no-budget --top 100`
- Likely first slice: add or use an awaitable lifecycle completion seam only if
  it improves production/test clarity; otherwise handle comment hygiene as a
  separate low-risk slice.
- Status: completed
- Plan: local-only cleanup-loop plan reviewed and approved
- Last touched: 2026-04-25
- Verification: P12-W5 exact imported review-id queries returned no open rows
  for `core_call_order_coupling`, `lifecycle_async_flush_coupling`, and
  `restating_doc_block_noise`; package-local `desloppify show` commands
  returned no open rows for
  `src/core/channel-tuning/__tests__/ChannelTuningCoordinator.test.ts`,
  `src/modules/lifecycle/__tests__/AppLifecycle.test.ts`,
  `src/modules/player/RetryManager.ts`,
  `src/modules/player/SubtitleManager.ts`,
  `src/modules/player/VideoPlayer.ts`, and
  `src/modules/scheduler/scheduler`; `src/modules/lifecycle/AppLifecycle.ts`
  still reports the accepted non-P12-W5 mechanical log/swallowed-error rows.
  Targeted `rg` audits found no channel-tuning `invocationCallOrder`/relative
  order coupling, no lifecycle generic drain guesses, and no mapped
  fileoverview/module/version/restating comment patterns. `npm run verify`
  passed after all P12-W5 source changes. `desloppify status` recorded overall
  `85.7`, strict `85.7`, objective `96.7`, verified `96.7`, File health
  `92.4` (`91.6` strict), Code quality `98.1`, Duplication `99.9`, Test health
  `97.5` (`97.3` strict), Security `99.7`, and subjective dimensions:
  AI generated debt `78.0`, API coherence `84.0`, Abstraction fit `78.0`,
  Auth consistency `84.0`, Contracts `88.0`, Convention drift `92.0`,
  Cross-module arch `76.0`, Design coherence `64.0`, Elegance `83.0`, Error
  consistency `80.0`, Naming quality `88.0`, Stale migration `91.0`, Structure
  nav `78.0`, Test strategy `82.0`, and Type safety `88.0`.
- Follow-ups: none for P12-W5; `P12-EXIT` remains blocked on final
  `desloppify scan --path .` because the tool's mid-cycle guard reports five
  subjective reassessment placeholders and requires either clearing them or a
  maintainer-approved force-rescan decision.
- Handoff: resolve the `desloppify scan` guard, then close `P12-EXIT`.

- [ ] `P12-EXIT`

- Close only if: every P12 review issue has one checklist owner, every absorbed
  mechanical hotspot has one exact owner or explicit disposition, the P12
  package map and checklist agree, security triage is clean or assigned, and a
  final integration-branch scan/queue/status refresh records the score delta.
- Required commands:
  - `desloppify scan --path .`
  - `desloppify status`
  - `desloppify plan queue --sort recent`
  - `desloppify show review --status open --no-budget --top 120`
  - `desloppify show security --status open --no-budget --top 50`
  - rerun each completed package's local scoping commands
  - `npm run verify`
  - `npm run verify:docs`
- Status: blocked
- Plan: local-only P12-W5 closeout evidence; no tracked plan promoted
- Last touched: 2026-04-25
- Verification: `desloppify scan --path .` was attempted and blocked by the
  tool's mid-cycle guard because five subjective reassessment placeholders
  remain; `desloppify status` passed and recorded overall `85.7`, strict
  `85.7`, objective `96.7`, and verified `96.7`; `desloppify plan queue --sort
  recent` reported five subjective reassessment placeholders; `desloppify show
  review --status open --no-budget --top 120` returned no open `review`
  detector rows; `desloppify show security --status open --no-budget --top 50`
  returned two non-security import-cycle rows in channel-setup planning; P12-W5
  package-local commands and `npm run verify` passed.
- Follow-ups: final P12 scan/exit owner is `P12-EXIT`; resolve whether to clear
  the five subjective placeholders first or run the force-rescan command with
  maintainer approval, then record the final scan delta and close `P12-EXIT`.
- Handoff: do not start P13 work until `P12-EXIT` has a completed final scan and
  exit record.

## Not Active Checklist Scope By Default

- The five subjective reassessment placeholders currently shown by
  `desloppify plan queue --sort recent`: low elegance, stale migration, init
  coupling, convention drift, and dependency health.
- `stale_exclude::*` rows for local/tooling directories unless repo policy
  changes.
- Duplicate detector rows or detector-lag rows without current-source evidence.
- Dirty source edits already present in the worktree; evaluate them separately
  before assuming they belong to a P12 package.
