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
  post-P12 subjective review backlog package queue on 2026-04-26. P14 is the
  active score-targeted cleanup priority for AI generated debt, cross-module
  architecture, and design coherence.
- Next safe start: run the required post-WAVE8 focused review/scoring pass for
  `design_coherence,cross_module_architecture,ai_generated_debt`, then decide
  whether P14 can proceed toward `P14-EXIT` or needs another admitted wave. Do
  not open P15 or enter `P14-EXIT` from WAVE8 completion alone.
- Preferred launcher: `cleanup-loop` for checklist-linked cleanup orchestration.
- First action at package start: use the completed `P14-WAVE8` closeout in the
  package map, including package-local scoping commands and duplicate residual
  lineage notes, as the source for the post-WAVE8 decision gate.
- Active exact issue-membership surface:
  `docs/architecture/p14-post-p13-subjective-review-package-map.json`.
- Completed P13 exact issue-membership surface:
  `docs/architecture/p13-post-p12-subjective-backlog-package-map.json`.
- Completed P12 exact issue-membership surface:
  `docs/architecture/p12-subjective-refresh-package-map.json`.
- Prior fresh-baseline exact issue-membership surface:
  `docs/architecture/p11-fresh-baseline-package-map.json`.
- Authoritative evidence rule: only integration-branch `desloppify` reruns may
  change backlog status, package completion claims, exit records, or closeout
  claims.

## Current Evidence Snapshot

Source: post-WAVE7 focused review run
`.desloppify/subagents/runs/20260428_193443`, imported on `2026-04-28`.

- Current wave state: `P14-WAVE1` through `P14-WAVE8` are completed. P14
  remains open and cannot enter `P14-EXIT` until a fresh post-WAVE8 focused
  review/scoring pass evaluates the target dimensions and P14-EXIT evidence.
- Current target scores: AI generated debt `82.0` (`+4.0` from `78.0`),
  cross-module arch `81.5` (`+3.5` from `78.0`), and design coherence `84.0`
  (`+11.0` from `73.0`); all remain below the `>=85` P14 target.
- WAVE6 closeout commits: `2ba166d7` `refactor: complete p14 wave6 cleanup`
  and `1761c65f` `fix: address p14 wave6 review followups`. WAVE7 admission
  was recorded in `7e9cd111` `docs: admit p14 wave7`. WAVE7 closeout commits:
  `b508bf88` `refactor: complete p14 wave7 cleanup` and `e2a5b369`
  `docs: mark p14 wave7 package map complete`. WAVE8 source commits:
  `5853c7c7` `refactor: complete p14 wave8 cleanup` and `4fe221cf`
  `fix: keep guide mini-guide hide outside typed intents`.
- Current active evidence: the package map imports
  `.desloppify/subagents/runs/20260428_193443/holistic_issues_merged.json`
  with six concrete source-backed WAVE8 residual issues.
- Last touched: `2026-04-28`.
- P14 score target: raise AI generated debt, cross-module arch, and design
  coherence into the mid/high 80s. Continue P14 until all three target
  dimensions are at least `85`, or stop earlier only if two consecutive fresh
  focused subjective reviews find no concrete source-backed issues that can be
  fixed without ownership churn, strict remains at least `88`, and no P0
  security or high-confidence source-backed design/coherence issues remain.

Score interpretation: P13 is closed with strict `88.0` at exit and the current
post-P13 read is strict `88.3`. The next score-moving cleanup surface is a
wave-scoped P14 program: first complete the admitted navigation,
diagnostics-surface, and generated-comment packages together, then re-review the
target dimensions before admitting any broader cleanup.

## Operating Contract

- Work top to bottom unless maintainer direction says otherwise.
- Keep authoritative execution state in Codex `update_plan`.
- Create a package-local execution-grade plan for the selected `P14-WAVE#` or
  `P14-W#`; keep it local by default and promote to `docs/plans/*` only when
  durable tracked handoff memory is explicitly needed.
- Use the active companion map for exact review-id membership. Checklist rows
  summarize package intent; they are not a substitute for the map.
- Wave metadata is orchestration-only. Exact issue ownership remains in
  package-map package/disposition entries and must not be duplicated by wave
  rows.
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
  - Handoff: archived; P13 completed the refreshed post-P12 backlog and P14 is
    the active cleanup priority.

## Completed P13 Post-P12 Subjective Backlog Summary

P13 is closed. Its exact completed package membership remains in
`docs/architecture/p13-post-p12-subjective-backlog-package-map.json`.

- Final status: `P13-W1` through `P13-W5` and `P13-EXIT` completed.
- Closeout commit: `195508ab` `Close P13 cleanup exit`.
- Final scan date: `2026-04-26`.
- Final P13 exit scores: overall `88.1`, objective `96.0`, strict `88.0`,
  verified `96.0`; strict stayed above the `85.0` target.
- Verification evidence: `desloppify scan --path .`, `desloppify status`,
  `desloppify plan queue --sort recent`, `desloppify next`, package-local
  scoping commands, `desloppify show review --status open --no-budget --top
  120`, security/cycle reconciliation checks, `npm run verify`, and
  `npm run verify:docs` passed or were reconciled in the P13 exit record.
- Disposition: no P13 exact-membership follow-ups remain. Accepted non-P13
  objective residue stays with the existing Desloppify objective queue and is
  revisited only when `desloppify next` or a future objective cleanup selects
  those rows.
- Handoff rule: do not reopen P13 exact issues solely from stale detector
  wording; require current-source proof of a live seam and a new owner.

- [x] `P13-EXIT`
  - required: every P13 review issue had one checklist owner or explicit
    disposition, the P13 package map and checklist agreed, package-local checks
    passed, final integration-branch scan/status/queue/review/security evidence
    was recorded, and `npm run verify` / `npm run verify:docs` passed as
    appropriate.
  - Status: completed
  - Handoff: archived; P14 owns the refreshed post-P13 review queue.

## Active P14 Score-Targeted Subjective Review

The active P14 exact membership surface is
`docs/architecture/p14-post-p13-subjective-review-package-map.json`.

P14 targets the current low subjective dimensions, not just the four admitted
review rows:

- AI generated debt: raise from `78.0` to at least `85`.
- Cross-module arch: raise from `78.0` to at least `85`.
- Design coherence: raise from `73.0` to at least `85`.

Continue P14 until all three target dimensions are at least `85`, or stop
earlier only when two consecutive fresh focused reviews for
`design_coherence,cross_module_architecture,ai_generated_debt` find no concrete
source-backed issues that can be fixed without ownership churn, strict remains
at least `88`, and no P0 security or high-confidence source-backed
design/coherence issues remain. Do not convert skipped/deferred findings into
active implementation just to chase scores.

Completion of `P14-W1`, `P14-W2`, and `P14-W3` is necessary for the first wave
but is not sufficient to close P14 or `P14-EXIT`. Treat `P14-WAVE1` closeout as
the evidence checkpoint that decides whether `P14-WAVE2` and/or `P14-WAVE3`
must add larger score-moving packages.

### [x] `P14-WAVE1` admitted score-moving cleanup

- Scope: execute the current admitted P14 issues as one coordinated cleanup
  wave while preserving slice-level issue ownership for `P14-W1`, `P14-W2`, and
  `P14-W3`.
- Owned slices:
  - `P14-W1` `navigation-feature-port-boundary`
  - `P14-W2` `diagnostics-surface-action-split`
  - `P14-W3` `generated-comment-noise`
- Goal: move cross-module arch, design coherence, and AI generated debt in one
  coherent batch before rerunning focused subjective review.
- Package guardrail: one package-local execution-grade plan may cover the wave
  only if it includes a `slice_table` or equivalent ledger that keeps each exact
  review issue id owned by its package, preserves separate closure conditions,
  and records package-local verification for each slice. The plan must not
  merge the three packages into a generic cleanup bucket.
- Verification routing: `npm run verify` for the source wave, package-local
  scoping commands for all three slices, targeted `rg` audits from the companion
  map, and a fresh focused subjective review for
  `design_coherence,cross_module_architecture,ai_generated_debt` after the wave.
- Status: completed
- Plan: local `P14-WAVE1` execution plan reviewed clean after revision.
- Last touched: `2026-04-27`
- Verification: `npm run verify`, `npm run verify:docs`, package-local
  Desloppify commands, targeted `rg` audits, and implementation review passed.
- Focused review: `.desloppify/subagents/runs/20260427_025123` imported with
  `--allow-partial`; AI generated debt `76.0` (`-2.0` from `78.0`),
  cross-module arch `82.0` (`+4.0` from `78.0`), and design coherence `76.0`
  (`+3.0` from `73.0`).
- Follow-ups: target dimensions remain below `85`, and the fresh review found
  concrete source-backed issues. `P14-WAVE2` and `P14-WAVE3` are admitted below
  before any further implementation.
- Handoff: `P14-WAVE1` is closed, but P14 and `P14-EXIT` remain open. Do not
  open P15.

### [x] `P14-W1` `navigation-feature-port-boundary`

- Backlog: `1` refreshed post-P13 review issue.
- Scope: replace feature-owned imports in `NavigationCoordinatorDeps` with
  navigation-local structural ports; keep concrete feature adaptation in
  `src/core/orchestrator/OrchestratorCoordinatorBuilders.ts`.
- Imported review issues:
  - `review::.::holistic::cross_module_architecture::navigation_cross_feature_deps_contract`
- Exact seed membership:
  `docs/architecture/p14-post-p13-subjective-review-package-map.json` ->
  `pkg_navigation_feature_port_boundary`.
- Candidate files:
  - `src/modules/navigation/NavigationCoordinatorDeps.ts`
  - `src/modules/navigation/NavigationKeyModeRouter.ts`
  - `src/modules/navigation/NavigationScreenEffectsHandler.ts`
  - `src/modules/navigation/NavigationModalEffectsHandler.ts`
  - `src/modules/navigation/NavigationRepeatHandler.ts`
  - `src/modules/navigation/NavigationChannelNumberHandler.ts`
  - `src/core/orchestrator/OrchestratorCoordinatorBuilders.ts`
- Package guardrail: navigation may define only navigation-owned structural
  ports; feature-specific concrete types and adaptation stay in the orchestrator
  composition root. Do not introduce a new runtime orchestration layer.
- Verification routing: `npm run verify`, package-local Desloppify show
  commands, and targeted `rg` audits for feature-owned imports and structural
  port adaptation.
- Status: completed
- Plan: local `P14-WAVE1` reviewed plan.
- Last touched: `795ef311` `refactor: add navigation-owned dependency ports`
- Verification: `npm run verify`, package-local Desloppify commands, targeted
  navigation import audits, and implementation review passed.
- Follow-ups: fresh focused review admitted `P14-W4` for handler-specific
  navigation port splitting; do not treat that follow-up as reopening `P14-W1`.
- Handoff: archived inside completed `P14-WAVE1`.

### [x] `P14-W2` `diagnostics-surface-action-split`

- Backlog: `1` refreshed post-P13 review issue.
- Scope: split `AppDiagnosticsSurface` dev-menu DOM construction from
  diagnostic actions, storage mutations, formatting, console API installation,
  and toast feedback.
- Imported review issues:
  - `review::.::holistic::design_coherence::diagnostics_surface_mixes_ui_and_actions`
- Exact seed membership:
  `docs/architecture/p14-post-p13-subjective-review-package-map.json` ->
  `pkg_diagnostics_surface_action_split`.
- Candidate files:
  - `src/core/app-shell/AppDiagnosticsSurface.ts`
  - possible new helpers under `src/core/app-shell/`
  - possibly `src/core/app-shell/AppDiagnosticsChannelSetupSummary.ts`
- Package guardrail: keep diagnostics in the app-shell/core owner. Do not move
  developer settings or storage policy into UI modules, and preserve the
  existing `window.lineup`, toast, clipboard, and storage-clearing behavior.
- Verification routing: `npm run verify`, package-local Desloppify show
  commands, and targeted `rg` audits for diagnostics action/copy dataset/API
  preservation.
- Status: completed
- Plan: local `P14-WAVE1` reviewed plan.
- Last touched: `7cac8a6f` `refactor: split diagnostics dev menu rendering`
- Verification: `npm run verify`, `npm run verify:docs`,
  `npm test -- --runTestsByPath src/core/app-shell/__tests__/AppDiagnosticsSurface.test.ts --runInBand`,
  package-local Desloppify commands, targeted diagnostics audits, and
  implementation review passed.
- Follow-ups: fresh focused review admitted `P14-W5` for the remaining dev-menu
  controller/action split; do not treat that follow-up as reopening `P14-W2`.
- Handoff: archived inside completed `P14-WAVE1`.

### [x] `P14-W3` `generated-comment-noise`

- Backlog: `2` refreshed post-P13 review issues.
- Scope: remove generated-style banners and tautological comments/JSDoc while
  preserving useful behavioral comments.
- Imported review issues:
  - `review::.::holistic::ai_generated_debt::doc_banners_and_field_echoes`
  - `review::.::holistic::ai_generated_debt::event_api_jsdoc_echoes`
- Exact seed membership:
  `docs/architecture/p14-post-p13-subjective-review-package-map.json` ->
  `pkg_generated_comment_noise`.
- Initial high-signal files:
  - `src/utils/interfaces.ts`
  - `src/modules/player/VideoPlayerEvents.ts`
  - `src/modules/player/types.ts`
  - `src/modules/scheduler/channel-manager/interfaces.ts`
  - `src/modules/scheduler/scheduler/ChannelScheduler.ts`
  - additional package-map candidate files when the package-local plan confirms
    they are comment-only and low risk.
- Package guardrail: this is a comment-only readability cleanup. Do not rename
  exports, reshape event APIs, or remove comments that explain non-obvious
  behavior, compatibility constraints, error isolation, platform quirks, strict
  subtitle behavior, or EventEmitter generic constraints.
- Verification routing: `npm run verify`, package-local Desloppify show
  commands, and targeted `rg` audits for removed generated-style comments.
- Status: completed
- Plan: local `P14-WAVE1` reviewed plan.
- Last touched: `b4269bd6` `chore: remove generated comment noise`
- Verification: `npm run verify`, package-local Desloppify commands, targeted
  changed-file comment audits, broad generated-comment audit, and
  implementation review passed.
- Follow-ups: broad generated-comment audit and focused review admitted
  `P14-W8` and `P14-W9`; do not treat those follow-ups as reopening `P14-W3`.
- Handoff: archived inside completed `P14-WAVE1`.

### [x] `P14-WAVE2` design/coherence follow-up wave

- Scope: execute the admitted post-WAVE1 design/coherence and cross-module
  source issues after an execution-grade plan and clean adversarial plan review.
- Owned slices:
  - `P14-W4` `navigation-handler-port-split`
  - `P14-W5` `diagnostics-dev-menu-controller-split`
  - `P14-W6` `plex-discovery-request-policy-split`
  - `P14-W7` `channel-setup-planner-strategy-boundary`
- Admission evidence: focused review
  `.desloppify/subagents/runs/20260427_025123/holistic_issues_merged.json`.
- Package guardrail: do not activate broad AppOrchestrator, lifecycle,
  channel-setup, or Plex cleanup merely because files are large or prior
  detector wording exists. A WAVE2 admission must reduce ownership breadth
  without relocating the same hub responsibility into a sibling owner.
- Verification routing: current-source proof for each newly admitted issue id,
  package-local scoping commands for newly scoped files, targeted tests and
  `npm run verify` for admitted source work, implementation review, and `npm
  run verify:docs` for checklist/package-map updates. Per the current handoff,
  focused subjective review/scoring is deferred until `P14-WAVE3` also closes
  unless a replan-triggering contradiction appears.
- Status: completed
- Plan: local `P14-WAVE2` execution plan reviewed clean after revision and a
  fresh final approval pass.
- Last touched: `2026-04-27`
- Verification: package-local Desloppify commands, targeted `rg` audits,
  targeted navigation/orchestrator, diagnostics, Plex discovery, and
  channel-setup tests, `npm run verify`, and implementation review passed.
- Follow-ups: `P14-W6` supersedes the previous non-active
  `plex_discovery_request_policy_nested` disposition. The older broad
  `channel_setup_planner_pipeline_bulk` disposition remains non-active; `P14-W7`
  owns only the fresh planner/strategy cycle issue.
- Commits: `cd9d7094` `refactor: narrow navigation handler ports`,
  `1ba2f847` `refactor: extract diagnostics dev menu controller`,
  `51f13a1c` `refactor: split Plex discovery request policy`, and
  `530154a5` `refactor: move channel setup planning contracts`
- Handoff: `P14-WAVE2` is closed, but P14 and `P14-EXIT` remain open. Continue
  directly to `P14-WAVE3`; do not run focused subjective review/scoring until
  `P14-WAVE3` also closes unless a replan trigger fires.

### [x] `P14-W4` `navigation-handler-port-split`

- Imported review issues:
  - `review::.::holistic::cross_module_architecture::navigation_deps_cross_feature_contract`
- Scope: split the broad navigation dependency contract into handler-specific
  navigation-owned ports for key-mode, repeat, screen, modal, and channel-number
  helpers.
- Candidate files:
  - `src/modules/navigation/NavigationCoordinatorDeps.ts`
  - `src/modules/navigation/NavigationKeyModeRouter.ts`
  - `src/modules/navigation/NavigationRepeatHandler.ts`
  - `src/modules/navigation/NavigationScreenEffectsHandler.ts`
  - `src/modules/navigation/NavigationModalEffectsHandler.ts`
  - `src/modules/navigation/NavigationChannelNumberHandler.ts`
  - `src/modules/navigation/NavigationCoordinator.ts`
  - `src/core/orchestrator/OrchestratorCoordinatorBuilders.ts`
- Package guardrail: do not move feature coordination into navigation or create
  a new orchestration layer. Keep concrete adaptation in the orchestrator
  builder.
- Status: completed
- Plan: local `P14-WAVE2` reviewed plan.
- Last touched: `cd9d7094` `refactor: narrow navigation handler ports`
- Verification: targeted navigation/orchestrator tests, package-local
  Desloppify commands, targeted navigation port `rg` audits, `npm run verify`,
  and implementation review passed.
- Review: exact complaint is no longer fair; navigation helpers now depend on
  handler-specific ports while concrete adaptation remains in the orchestrator
  builder.
- Handoff: archived inside completed `P14-WAVE2`.

### [x] `P14-W5` `diagnostics-dev-menu-controller-split`

- Imported review issues:
  - `review::.::holistic::design_coherence::app_diagnostics_surface_mixed_actions`
- Scope: move dev-menu command handling, hydration, refresh, storage mutation,
  clipboard, and toast feedback behind an app-shell diagnostics controller while
  keeping `AppDiagnosticsSurface` as lifecycle/keybinding owner.
- Candidate files:
  - `src/core/app-shell/AppDiagnosticsSurface.ts`
  - `src/core/app-shell/AppDiagnosticsDevMenuController.ts`
  - `src/core/app-shell/AppDiagnosticsDevMenuView.ts`
  - `src/core/app-shell/AppDiagnosticsPlaybackInfoFormatter.ts`
  - `src/core/app-shell/AppDiagnosticsChannelSetupSummary.ts`
  - `src/core/app-shell/__tests__/AppDiagnosticsSurface.test.ts`
- Package guardrail: preserve `window.lineup`, toast, clipboard,
  storage-clearing/reload, and debug override behavior. Do not move diagnostics
  into UI modules.
- Status: completed
- Plan: local `P14-WAVE2` reviewed plan.
- Last touched: `1ba2f847` `refactor: extract diagnostics dev menu controller`
- Verification: targeted diagnostics surface tests, package-local Desloppify
  commands, targeted diagnostics API/action `rg` audits, `npm run verify`, and
  implementation review passed.
- Review: exact complaint is no longer fair; dev-menu actions moved into
  `AppDiagnosticsDevMenuController`, while `AppDiagnosticsSurface` retains
  lifecycle, keybinding, and `window.lineup` helper ownership.
- Handoff: archived inside completed `P14-WAVE2`.

### [x] `P14-W6` `plex-discovery-request-policy-split`

- Imported review issues:
  - `review::.::holistic::design_coherence::plex_discovery_request_policy_nested`
- Scope: split Plex discovery request execution from retry/fallback/response
  classification policy after fresh focused review superseded the earlier
  non-active disposition.
- Candidate files:
  - `src/modules/plex/discovery/PlexResourceDiscoveryRequestPolicy.ts`
  - `src/modules/plex/discovery/PlexDiscoveryFetchVariants.ts`
  - `src/modules/plex/discovery/PlexDiscoveryRequestExecutor.ts`
  - `src/modules/plex/discovery/PlexDiscoveryResponsePolicy.ts`
  - `src/modules/plex/discovery/__tests__/PlexServerDiscovery.test.ts`
- Package guardrail: preserve retry timing, 429 `Retry-After`, 5xx fallback,
  timeout handling, abort behavior, and final response/error classification.
- Status: completed
- Plan: local `P14-WAVE2` reviewed plan.
- Last touched: `51f13a1c` `refactor: split Plex discovery request policy`
- Verification: targeted Plex discovery tests, package-local Desloppify
  commands, targeted discovery retry/fallback `rg` audits, `npm run verify`,
  and implementation review passed.
- Review: exact complaint is no longer fair; request execution, fetch-variant
  construction, and response policy are split inside the Plex discovery owner
  with retry/fallback/classification behavior preserved.
- Handoff: archived inside completed `P14-WAVE2`.

### [x] `P14-W7` `channel-setup-planner-strategy-boundary`

- Imported review issues:
  - `review::.::holistic::design_coherence::channel_setup_planner_builder_cycle`
- Scope: break the planner/strategy-builder dependency cycle by moving
  planner-neutral identity and estimate helpers to a shared planning module
  without changing channel setup behavior.
- Candidate files:
  - `src/core/channel-setup/planning/ChannelSetupPlanner.ts`
  - `src/core/channel-setup/planning/ChannelSetupStrategyBuilders.ts`
  - `src/core/channel-setup/planning/ChannelSetupPlanningTypes.ts`
  - `src/core/channel-setup/planning/ChannelSetupPlanningService.ts`
  - `src/core/channel-setup/planning/ChannelSetupPlanDiagnostics.ts`
  - `src/core/app-shell/AppDiagnosticsChannelSetupSummary.ts`
  - `src/core/channel-setup/build/ChannelSetupBuildCommitter.ts`
  - `src/core/channel-setup/build/ChannelSetupBuildExecutor.ts`
  - `src/core/channel-setup/__tests__/ChannelSetupPlanner.test.ts`
  - `src/core/channel-setup/__tests__/ChannelSetupBuildCommitter.test.ts`
- Package guardrail: do not broaden channel setup planning or rewrite the
  strategy pipeline. This is a boundary/cycle cleanup only.
- Status: completed
- Plan: local `P14-WAVE2` reviewed plan.
- Last touched: `530154a5` `refactor: move channel setup planning contracts`
- Verification: targeted channel-setup and app diagnostics summary tests,
  package-local Desloppify commands, targeted planner/strategy dependency `rg`
  audits, `npm run verify`, and implementation review passed.
- Review: exact complaint is no longer fair; planner-neutral identity, diff,
  diagnostics, and pending-channel contracts now live in
  `ChannelSetupPlanningTypes`, while `ChannelSetupPlanner` remains the planner
  behavior owner. The extra build committer/executor changes were type-helper
  import reconciliation inside the approved W7 owner and did not activate the
  older broad `channel_setup_planner_pipeline_bulk` disposition.
- Handoff: archived inside completed `P14-WAVE2`.

### [x] `P14-WAVE3` AI-generated-debt follow-up wave

- Scope: execute the admitted post-WAVE1 generated comment/header/JSDoc cleanup
  after an execution-grade plan and clean adversarial plan review.
- Owned slices:
  - `P14-W8` `generated-headers-and-banners`
  - `P14-W9` `trivial-event-and-method-jsdoc`
- Admission evidence: focused review
  `.desloppify/subagents/runs/20260427_025123/holistic_issues_merged.json`.
- Candidate expansion proof: targeted `rg` audits for `@fileoverview`,
  `@module`, stale `@version`, signature-echo event JSDoc, private-field echo
  comments, and comments that only restate adjacent names or types.
- Package guardrail: WAVE3 remains behavior-neutral comment/API-doc cleanup.
  Preserve comments documenting non-obvious behavior, compatibility constraints,
  error isolation, platform quirks, strict subtitle behavior, EventEmitter
  generic constraints, and externally visible contract caveats.
- Verification routing: targeted audit before admission, package-local
  Desloppify show commands for admitted files, `git diff --check`, `npm run
  verify` for source-comment batches, and focused subjective review after the
  batch.
- Status: completed
- Plan: local `P14-WAVE3` execution plan reviewed clean after revision and a
  fresh final approval pass.
- Last touched: `2026-04-27`
- Verification: targeted audits, package-local Desloppify commands,
  `git diff --check`, `npm run verify`, and implementation review passed.
- Commit: `78e79884` `chore: clean p14 wave3 generated comments`
- Follow-ups: `P14-WAVE3` owns the remaining active P14 work items. It triggers
  combined focused subjective review/scoring and `P14-EXIT` readiness evidence,
  but does not close P14 by itself.
- Handoff: proceed to combined focused review/scoring for
  `design_coherence,cross_module_architecture,ai_generated_debt` and P14-EXIT
  readiness. Do not open P15.

### [x] `P14-W8` `generated-headers-and-banners`

- Imported review issues:
  - `review::.::holistic::ai_generated_debt::generated_style_headers_and_banners`
- Scope: remove generated-style file headers and separator banners from
  hand-written modules while preserving meaningful ownership and runtime
  comments.
- Candidate files:
  - `src/modules/scheduler/scheduler/index.ts`
  - `src/modules/navigation/interfaces.ts`
  - `src/modules/plex/stream/interfaces.ts`
  - `src/modules/player/AudioTrackManager.ts`
- Package guardrail: comment-only; no export/API/type/runtime changes.
- Status: completed
- Plan: local `P14-WAVE3` reviewed plan.
- Last touched: `78e79884` `chore: clean p14 wave3 generated comments`
- Verification: package-local Desloppify commands, targeted generated-header,
  separator/banner, and navigation section-label audits, `git diff --check`,
  `npm run verify`, and implementation review passed.
- Review: exact complaint is no longer fair for the approved W8 scope;
  generated metadata, separator/export banners, and navigation section labels
  were removed while meaningful comments were preserved.
- Handoff: archived inside completed `P14-WAVE3`.

### [x] `P14-W9` `trivial-event-and-method-jsdoc`

- Imported review issues:
  - `review::.::holistic::ai_generated_debt::trivial_event_and_method_jsdoc`
- Scope: delete trivial JSDoc that repeats obvious event, lifecycle,
  getter/setter, initialize, unload, and destroy method signatures while
  preserving comments with behavioral value.
- Candidate files:
  - `src/modules/plex/stream/interfaces.ts`
  - `src/modules/plex/library/interfaces.ts`
  - `src/modules/player/AudioTrackManager.ts`
  - `src/core/initialization/InitializationCoordinator.ts`
- Package guardrail: comment-only; preserve comments explaining lifecycle
  ordering, platform constraints, error isolation, compatibility, or external
  contracts.
- Status: completed
- Plan: local `P14-WAVE3` reviewed plan.
- Last touched: `78e79884` `chore: clean p14 wave3 generated comments`
- Verification: package-local Desloppify commands, targeted trivial
  event/method/init-stage JSDoc audits, preservation audit, `git diff --check`,
  `npm run verify`, and implementation review passed.
- Review: exact complaint is no longer fair for the approved W9 scope; trivial
  event/method/init-stage JSDoc was removed, zero exact
  `InitializationCoordinator` init-stage phrases were retained, and useful
  lifecycle/platform/error/contract comments were preserved.
- Handoff: archived inside completed `P14-WAVE3`.

### [x] `P14-WAVE4` post-WAVE3 target residual cleanup

- Scope: execute the focused post-WAVE3 residual issues admitted because all
  three P14 target dimensions remain below `85`.
- Owned slices:
  - `P14-W10` `navigation-deps-feature-spanning-hub`
  - `P14-W11` `generated-header-residuals`
  - `P14-W12` `trivial-signature-jsdoc-residuals`
  - `P14-W13` `channel-setup-planner-stage-blur`
  - `P14-W14` `navigation-collaborator-cycle`
- Admission evidence: focused review
  `.desloppify/subagents/runs/20260427_042426/holistic_issues_merged.json`.
- Score evidence: AI generated debt `80.0` (`+2.0` from `78.0`, target
  `>=85`), cross-module arch `82.0` (`+4.0` from `78.0`, target `>=85`), and
  design coherence `76.0` (`+3.0` from `73.0`, target `>=85`).
- Package guardrail: do not open P15, broad AppOrchestrator cleanup, or broad
  lifecycle cleanup. Do not treat stale/type-only cycle rows as source truth
  without current-source proof. Comment cleanup remains behavior-neutral.
- Verification routing: package-local scoping commands from the P14 package
  map, targeted `rg` audits, targeted tests where source behavior is touched,
  `npm run verify`, implementation review, checklist/package-map updates, and
  `npm run verify:docs`.
- Status: completed
- Plan: local `P14-WAVE4` execution plan reviewed clean after revision and a
  fresh final approval pass.
- Last touched: `2026-04-27`
- Verification: package-local Desloppify commands, targeted `rg` audits,
  targeted navigation/orchestrator and channel-setup tests, `git diff --check`,
  `npm run verify`, and implementation review passed.
- Commit: `7d27cc2e` `refactor: close p14 wave4 residual cleanup`
- Follow-ups: the post-WAVE3 focused review re-used the
  `generated_style_headers_and_banners` id with new residual files; `P14-W11`
  is the current residual owner while `P14-W8` remains closed for its approved
  WAVE3 source slice. `P14-WAVE4` source completion still requires a fresh
  focused review/scoring pass before P14 can enter `P14-EXIT`.
- Handoff: run focused subjective review/scoring for
  `design_coherence,cross_module_architecture,ai_generated_debt`, then decide
  whether P14 can enter `P14-EXIT` or needs another admitted wave.

### [x] `P14-W10` `navigation-deps-feature-spanning-hub`

- Imported review issues:
  - `review::.::holistic::cross_module_architecture::navigation_deps_feature_spanning_hub`
- Scope: stop deriving every handler contract from one feature-spanning
  `NavigationCoordinatorDeps` source of truth; assemble explicit handler input
  contracts at the orchestrator composition root.
- Candidate files:
  - `src/modules/navigation/NavigationCoordinatorContracts.ts`
  - `src/modules/navigation/NavigationCoordinator.ts`
  - `src/core/orchestrator/OrchestratorCoordinatorBuilders.ts`
- Package guardrail: keep concrete feature adaptation in the orchestrator
  builder. Do not move feature coordination into navigation.
- Status: completed
- Plan: local `P14-WAVE4` reviewed plan.
- Last touched: `7d27cc2e` `refactor: close p14 wave4 residual cleanup`
- Verification: targeted navigation/orchestrator tests, package-local
  Desloppify commands, targeted handler-contract `rg` audits, `git diff
  --check`, `npm run verify`, and implementation review passed.
- Review: exact complaint is no longer fair; handler ports now live in
  navigation-owned `NavigationCoordinatorContracts`, while concrete feature
  adaptation remains in `OrchestratorCoordinatorBuilders`.
- Handoff: archived inside completed `P14-WAVE4`.

### [x] `P14-W11` `generated-header-residuals`

- Imported review issues:
  - `review::.::holistic::ai_generated_debt::generated_style_headers_and_banners`
- Scope: remove remaining generated-style headers and banner dividers from the
  newly cited residual files.
- Candidate files:
  - `src/modules/navigation/RemoteHandler.ts`
  - `src/modules/player/PlaybackRecoveryManager.ts`
  - `src/core/initialization/InitializationCoordinator.ts`
  - `src/modules/navigation/NavigationManager.ts`
- Package guardrail: comment-only; preserve comments that explain non-obvious
  ownership, platform behavior, lifecycle ordering, or error isolation.
- Status: completed
- Plan: local `P14-WAVE4` reviewed plan.
- Last touched: `7d27cc2e` `refactor: close p14 wave4 residual cleanup`
- Verification: package-local Desloppify commands, targeted generated-header
  and banner audits, `git diff --check`, `npm run verify`, and implementation
  review passed.
- Review: exact complaint is no longer fair for the residual files; generated
  metadata and banner dividers were removed while useful runtime comments were
  preserved.
- Handoff: archived inside completed `P14-WAVE4`.

### [x] `P14-W12` `trivial-signature-jsdoc-residuals`

- Imported review issues:
  - `review::.::holistic::ai_generated_debt::trivial_signature_jsdoc`
- Scope: delete remaining trivial JSDoc that repeats obvious getter, setter,
  event-registration, initialize, and destroy method signatures.
- Candidate files:
  - `src/modules/navigation/RemoteHandler.ts`
  - `src/modules/lifecycle/AppLifecycle.ts`
  - `src/modules/plex/library/interfaces.ts`
  - `src/modules/navigation/interfaces.ts`
- Package guardrail: comment-only; preserve semantic comments where null-vs-throw
  behavior, lifecycle ordering, platform constraints, or external contracts
  differ from the signature.
- Status: completed
- Plan: local `P14-WAVE4` reviewed plan.
- Last touched: `7d27cc2e` `refactor: close p14 wave4 residual cleanup`
- Verification: package-local Desloppify commands, targeted trivial-signature
  JSDoc audits, `git diff --check`, `npm run verify`, and implementation
  review passed.
- Review: exact complaint is no longer fair for the current-source-proven
  residuals; `src/modules/navigation/interfaces.ts` was stale for the targeted
  trivial signatures and was left unchanged.
- Handoff: archived inside completed `P14-WAVE4`.

### [x] `P14-W13` `channel-setup-planner-stage-blur`

- Imported review issues:
  - `review::.::holistic::design_coherence::channel_setup_planner_stage_blur`
- Scope: split channel setup planning into clearer pure stages for strategy
  buckets, playback normalization, alternate lineup expansion, playback
  variants, final truncation, and diagnostics without changing planning
  behavior.
- Candidate files:
  - `src/core/channel-setup/planning/ChannelSetupPlanner.ts`
  - `src/core/channel-setup/planning/ChannelSetupStrategyBuilders.ts`
- Package guardrail: do not rewrite the channel setup pipeline or change channel
  setup output. This is a stage-boundary cleanup only.
- Status: completed
- Plan: local `P14-WAVE4` reviewed plan.
- Last touched: `7d27cc2e` `refactor: close p14 wave4 residual cleanup`
- Verification: targeted channel-setup tests, package-local Desloppify
  commands, targeted planner-stage `rg` audits, `git diff --check`, `npm run
  verify`, and implementation review passed.
- Review: exact complaint is no longer fair; channel setup planning now exposes
  pure named stages for limits, library selection, strategy ordering, playback
  normalization, alternate lineups, playback variants, truncation, estimates,
  and diagnostics without observed behavior drift.
- Handoff: archived inside completed `P14-WAVE4`.

### [x] `P14-W14` `navigation-collaborator-cycle`

- Imported review issues:
  - `review::.::holistic::design_coherence::navigation_collaborator_cycle`
- Scope: make navigation collaborator imports acyclic by moving shared callback
  and runtime contract types into a small navigation-owned contract module.
- Candidate files:
  - `src/modules/navigation/NavigationCoordinatorContracts.ts`
  - `src/modules/navigation/NavigationCoordinator.ts`
  - `src/modules/navigation/NavigationKeyModeRouter.ts`
  - `src/modules/navigation/NavigationRepeatHandler.ts`
  - `src/modules/navigation/NavigationScreenEffectsHandler.ts`
  - `src/modules/navigation/NavigationModalEffectsHandler.ts`
  - `src/modules/navigation/NavigationChannelNumberHandler.ts`
- Package guardrail: preserve remote behavior and event subscription ownership.
  Confirm current imports before treating mechanical cycle rows as live source
  defects.
- Status: completed
- Plan: local `P14-WAVE4` reviewed plan.
- Last touched: `7d27cc2e` `refactor: close p14 wave4 residual cleanup`
- Verification: targeted navigation/orchestrator tests, package-local
  Desloppify commands, targeted collaborator import audits, `git diff --check`,
  `npm run verify`, and implementation review passed.
- Review: exact complaint is no longer fair; shared navigation callback/runtime
  and handler port types now live in `NavigationCoordinatorContracts`, and
  handlers no longer import concrete coordinator/repeat classes for shared
  contracts. `NavigationScreenEffectsHandler.ts` was included as approved
  package-local scope expansion under the same W14 owner.
- Handoff: archived inside completed `P14-WAVE4`.

### [x] `P14-WAVE5` post-WAVE4 target residual cleanup

- Scope: execute the focused post-WAVE4 residual issues admitted because all
  three P14 target dimensions remain below `85`.
- Owned slices:
  - `P14-W15` `navigation-contract-hub`
  - `P14-W16` `generated-header-banner-residuals`
  - `P14-W17` `trivial-signature-jsdoc-wave5-residuals`
  - `P14-W18` `channel-setup-planner-diagnostics-interleaved`
  - `P14-W19` `navigation-role-split-cycle`
  - `P14-W20` `facet-snapshot-session-policy-blend`
- Admission evidence: focused review
  `.desloppify/subagents/runs/20260427_051430/holistic_issues_merged.json`.
- Score evidence: AI generated debt `78.0` (`+0.0` from `78.0`, target
  `>=85`), cross-module arch `82.0` (`+4.0` from `78.0`, target `>=85`), and
  design coherence `76.0` (`+3.0` from `73.0`, target `>=85`).
- Package guardrail: do not open P15, broad AppOrchestrator cleanup, or broad
  lifecycle cleanup. Do not implement stale/cycle detector wording without
  current-source proof. Comment cleanup remains behavior-neutral.
- Verification routing: package-local scoping commands from the P14 package
  map, targeted `rg` audits, targeted tests where source behavior is touched,
  `npm run verify`, implementation review, checklist/package-map updates, and
  `npm run verify:docs`.
- Status: completed
- Plan: local `P14-WAVE5` execution plan reviewed clean.
- Last touched: `2026-04-27`
- Verification: package-local Desloppify commands, targeted `rg` audits,
  targeted navigation/orchestrator and channel-setup tests, `madge --circular`
  navigation audit, `git diff --check`, `npm run verify`, `npm run
  verify:docs`, and implementation review passed.
- Commit: `96bbb9ae` `Implement P14 WAVE5 cleanup`
- Follow-ups: the post-WAVE4 focused review re-used the
  `trivial_signature_jsdoc` id with new residual files; `P14-W17` is the
  current residual owner while `P14-W12` remains closed for its approved WAVE4
  source slice. WAVE5 source completion still requires a fresh focused
  review/scoring pass before P14 can enter `P14-EXIT`.
- Handoff: run focused subjective review/scoring for
  `design_coherence,cross_module_architecture,ai_generated_debt`, then decide
  whether P14 can enter `P14-EXIT` or needs another admitted wave.

### [x] `P14-W15` `navigation-contract-hub`

- Imported review issues:
  - `review::.::holistic::cross_module_architecture::navigation_contract_hub`
- Scope: reduce the remaining broad navigation-owned cross-feature runtime
  contract surface by moving handler-owned input contracts next to handlers
  while keeping app-level assembly in the orchestrator.
- Candidate files:
  - `src/modules/navigation/NavigationCoordinatorContracts.ts`
  - `src/modules/navigation/NavigationCoordinator.ts`
  - `src/core/orchestrator/OrchestratorCoordinatorBuilders.ts`
- Package guardrail: navigation may own remote/focus routing contracts, but
  cross-feature wiring and concrete adaptation stay in the orchestrator.
- Status: completed
- Plan: local `P14-WAVE5` reviewed plan.
- Last touched: `96bbb9ae` `Implement P14 WAVE5 cleanup`
- Verification: targeted navigation/orchestrator tests, package-local
  Desloppify commands, targeted contract-ownership `rg` audits, `git diff
  --check`, `npm run verify`, and implementation review passed.
- Review: exact complaint is no longer fair; handler-owned input contracts now
  live with the handlers, while orchestrator-owned assembly keeps concrete
  adaptation at the app-level composition boundary.
- Handoff: archived inside completed `P14-WAVE5`.

### [x] `P14-W16` `generated-header-banner-residuals`

- Imported review issues:
  - `review::.::holistic::ai_generated_debt::generated_style_headers_and_banners`
- Scope: remove newly cited generated-style fileoverview/module/version headers
  and banner separators from hand-written modules.
- Candidate files:
  - `src/shared/subtitle-mode.ts`
  - `src/modules/player/subtitleConversion.ts`
  - `src/modules/scheduler/channel-manager/types.ts`
  - `src/modules/scheduler/shared/prng.ts`
- Package guardrail: comment-only; preserve comments that explain non-obvious
  domain rules, external constraints, or algorithm choices.
- Status: completed
- Plan: local `P14-WAVE5` reviewed plan.
- Last touched: `96bbb9ae` `Implement P14 WAVE5 cleanup`
- Verification: package-local Desloppify commands, targeted generated-header
  and banner audits, `git diff --check`, `npm run verify`, and implementation
  review passed.
- Review: exact complaint is no longer fair; cited fileoverview/module/version
  headers and banner separators were removed without runtime changes.
- Follow-ups: `P14-W16` is the post-WAVE4 residual continuation of the same
  `generated_style_headers_and_banners` ownership chain as `P14-W8` and
  `P14-W11`; the source run used the shorter
  `generated_style_headers_banners` spelling, canonicalized here for P14
  accounting.
- Handoff: archived inside completed `P14-WAVE5`.

### [x] `P14-W17` `trivial-signature-jsdoc-wave5-residuals`

- Imported review issues:
  - `review::.::holistic::ai_generated_debt::trivial_signature_jsdoc`
- Scope: delete newly cited trivial getter, setter, and pass-through interface
  JSDoc while preserving lifecycle, platform, business-rule, and behavior
  comments.
- Candidate files:
  - `src/modules/lifecycle/AppLifecycle.ts`
  - `src/modules/scheduler/channel-manager/interfaces.ts`
  - `src/modules/ui/epg/interfaces.ts`
  - `src/modules/ui/epg/view/EPGVirtualizer.ts`
- Package guardrail: comment-only; do not remove comments that document
  lifecycle ordering, browser/platform quirks, business rules, or behavior not
  visible in the signature.
- Status: completed
- Plan: local `P14-WAVE5` reviewed plan.
- Last touched: `96bbb9ae` `Implement P14 WAVE5 cleanup`
- Verification: package-local Desloppify commands, targeted trivial-signature
  JSDoc audits, `git diff --check`, `npm run verify`, and implementation
  review passed.
- Review: exact complaint is no longer fair for the WAVE5 residual files; cited
  trivial getter/setter/pass-through JSDoc was removed while behavior and
  lifecycle/platform comments were preserved.
- Handoff: archived inside completed `P14-WAVE5`.

### [x] `P14-W18` `channel-setup-planner-diagnostics-interleaved`

- Imported review issues:
  - `review::.::holistic::design_coherence::channel_setup_planner_diagnostics_interleaved`
- Scope: move channel setup planner diagnostics bookkeeping into a small
  planner-local recorder while preserving planning output and diagnostic
  semantics.
- Candidate files:
  - `src/core/channel-setup/planning/ChannelSetupPlanner.ts`
- Package guardrail: do not change channel setup output, ordering, or
  diagnostic semantics. This is a diagnostics-ownership cleanup only.
- Status: completed
- Plan: local `P14-WAVE5` reviewed plan.
- Last touched: `96bbb9ae` `Implement P14 WAVE5 cleanup`
- Verification: targeted channel-setup tests, package-local Desloppify
  commands, targeted planner-diagnostics `rg` audits, `git diff --check`, `npm
  run verify`, and implementation review passed.
- Review: exact complaint is no longer fair; planner diagnostics bookkeeping now
  routes through a planner-local recorder with unchanged diagnostics output
  semantics.
- Handoff: archived inside completed `P14-WAVE5`.

### [x] `P14-W19` `navigation-role-split-cycle`

- Imported review issues:
  - `review::.::holistic::design_coherence::navigation_role_split_cycle`
- Scope: resolve the remaining navigation role-split ownership cycle by making
  contracts dependency-free and moving concrete handler assembly out of the
  coordinator if source proof confirms the cycle is live.
- Candidate files:
  - `src/modules/navigation/NavigationCoordinatorContracts.ts`
  - `src/modules/navigation/NavigationCoordinator.ts`
  - `src/modules/navigation/NavigationKeyModeRouter.ts`
  - `src/modules/navigation/NavigationRepeatHandler.ts`
  - `src/modules/navigation/NavigationChannelNumberHandler.ts`
- Package guardrail: preserve remote behavior and event subscription ownership.
  Do not treat stale/type-only cycle rows as source truth without current-source
  proof.
- Status: completed
- Plan: local `P14-WAVE5` reviewed plan.
- Last touched: `96bbb9ae` `Implement P14 WAVE5 cleanup`
- Verification: targeted navigation/orchestrator tests, package-local
  Desloppify commands, targeted navigation cycle `rg` audits, `madge
  --circular` navigation audit, `git diff --check`, `npm run verify`, and
  implementation review passed.
- Review: exact complaint is no longer fair; coordinator event subscription
  ownership was preserved, concrete handler construction moved to orchestrator
  assembly, and source audit plus `madge --circular` found no circular
  dependency across the cited navigation files. The remaining Desloppify cycle
  row is stale detector wording, not live source proof.
- Handoff: archived inside completed `P14-WAVE5`.

### [x] `P14-W20` `facet-snapshot-session-policy-blend`

- Imported review issues:
  - `review::.::holistic::design_coherence::facet_snapshot_session_policy_blend`
- Scope: split facet snapshot load-session accumulation and worker-queue
  mechanics from load-order and failure-policy coordination without changing
  snapshot output.
- Candidate files:
  - `src/core/channel-setup/planning/ChannelSetupFacetSnapshotLoadSession.ts`
  - `src/core/channel-setup/planning/ChannelSetupFacetSnapshotLoader.ts`
- Package guardrail: preserve facet snapshot output, cancellation, warning,
  timing, progress, cache/inflight, and partial-failure behavior.
- Status: completed
- Plan: local `P14-WAVE5` reviewed plan.
- Last touched: `96bbb9ae` `Implement P14 WAVE5 cleanup`
- Verification: targeted channel-setup tests, package-local Desloppify
  commands, targeted facet snapshot session `rg` audits, `git diff --check`,
  `npm run verify`, and implementation review passed.
- Review: exact complaint is no longer fair; snapshot data accumulation,
  timings, warnings, deferred-empty bookkeeping, and library queue mechanics now
  sit behind session-local collaborators while load-order and failure-policy
  coordination remain in the session.
- Handoff: archived inside completed `P14-WAVE5`.

### [x] `P14-WAVE6` post-WAVE5 target residual cleanup

- Scope: execute the focused post-WAVE5 residual issues admitted because all
  three P14 target dimensions remain below `85`.
- Owned slices:
  - `P14-W21` `navigation-runtime-contract-hub`
  - `P14-W22` `generated-style-headers-persist`
  - `P14-W23` `interface-lifecycle-signature-jsdoc`
  - `P14-W24` `scheduler-type-field-doc-bloat`
  - `P14-W25` `facet-snapshot-load-session-too-broad`
  - `P14-W26` `navigation-collaborator-cycle-wave6-residual`
  - `P14-W27` `epg-info-duration-duplication`
- Admission evidence: focused review
  `.desloppify/subagents/runs/20260428_022830/holistic_issues_merged.json`.
- Score evidence: AI generated debt `78.0` (`+0.0` from `78.0`, target
  `>=85`), cross-module arch `82.0` (`+4.0` from `78.0`, target `>=85`), and
  design coherence `76.0` (`+3.0` from `73.0`, target `>=85`).
- Package guardrail: do not open P15, broad AppOrchestrator cleanup, or broad
  lifecycle cleanup. Do not implement stale/cycle detector wording without
  current-source proof. Comment cleanup remains behavior-neutral.
- Verification routing: package-local scoping commands from the P14 package
  map, targeted `rg` audits, targeted tests where source behavior is touched,
  `npm run verify`, implementation review, checklist/package-map updates, and
  `npm run verify:docs`.
- Status: completed
- Plan: approved package-local WAVE6 execution unit; implementation completed
  for `P14-W21` through `P14-W27`.
- Last touched: `2026-04-28`
- Follow-ups: the post-WAVE5 focused review re-used the
  `navigation_collaborator_cycle` id with new residual assembly evidence;
  `P14-W26` is the current residual owner while `P14-W14` remains closed for
  its approved WAVE4 source slice.
- Post-wave review: focused review/scoring imported from
  `.desloppify/subagents/runs/20260428_032838/holistic_issues_merged.json`
  reported AI generated debt `76.0`, cross-module arch `82.0`, and design
  coherence `82.0`, all below target `>=85`.
- Handoff: archived inside completed `P14-WAVE6`; post-WAVE6 review admitted
  `P14-WAVE7`, so P14 remains open and cannot enter `P14-EXIT` yet.

### [x] `P14-W21` `navigation-runtime-contract-hub`

- Imported review issues:
  - `review::.::holistic::cross_module_architecture::navigation_runtime_contract_hub`
- Scope: reduce the remaining navigation-owned cross-feature runtime contract
  hub by moving concrete feature-facing handler ports out of the shared
  coordinator contract file while preserving orchestrator-owned feature
  adaptation.
- Candidate files:
  - `src/modules/navigation/NavigationCoordinatorContracts.ts`
  - `src/core/orchestrator/OrchestratorCoordinatorBuilders.ts`
  - `src/modules/navigation/NavigationKeyModeRouter.ts`
  - `src/modules/navigation/NavigationScreenEffectsHandler.ts`
  - `src/modules/navigation/NavigationModalEffectsHandler.ts`
- Package guardrail: navigation may own remote/focus routing contracts, but
  cross-feature wiring and concrete adaptation stay in the orchestrator.
- Disposition: resolved in `P14-WAVE6`; feature-facing navigation handler ports
  moved from `NavigationCoordinatorContracts` to `NavigationFeaturePorts`, with
  orchestrator-owned feature adaptation preserved in
  `OrchestratorCoordinatorBuilders`.
- Status: completed
- Plan: local `P14-WAVE6` reviewed plan.
- Last touched: `2ba166d7` `refactor: complete p14 wave6 cleanup`
- Verification: targeted navigation/orchestrator tests, package-local
  Desloppify commands, targeted `rg` audits, and `npm run verify`.
- Follow-ups: `P14-W28` owns the post-WAVE6 runtime-contract residual.
- Handoff: archived inside completed `P14-WAVE6`.

### [x] `P14-W22` `generated-style-headers-persist`

- Imported review issues:
  - `review::.::holistic::ai_generated_debt::generated_style_headers_persist`
- Scope: remove remaining generated-style fileoverview/module/version metadata
  and decorative separator banners from hand-written production modules without
  changing runtime code.
- Candidate files:
  - `src/modules/ui/epg/interfaces.ts`
  - `src/modules/ui/epg/view/EPGVirtualizer.ts`
  - `src/modules/scheduler/scheduler/ScheduleCalculator.ts`
  - `src/modules/plex/stream/constants.ts`
- Package guardrail: comment-only; preserve compact comments that explain
  architecture references, platform constraints, or domain invariants.
- Disposition: resolved in `P14-WAVE6`; generated-style metadata and separator
  banners were removed from the admitted handwritten production modules without
  runtime changes.
- Status: completed
- Plan: local `P14-WAVE6` reviewed plan.
- Last touched: `2ba166d7` `refactor: complete p14 wave6 cleanup`
- Verification: `git diff --check`, package-local Desloppify commands,
  targeted generated-header/banner audits, and `npm run verify`.
- Follow-ups: `P14-W29` owns the post-WAVE6 generated-style residual.
- Handoff: archived inside completed `P14-WAVE6`.

### [x] `P14-W23` `interface-lifecycle-signature-jsdoc`

- Imported review issues:
  - `review::.::holistic::ai_generated_debt::interface_lifecycle_signature_jSDoc`
- Scope: delete remaining lifecycle, event, getter/setter, and interface JSDoc
  that repeats signatures while preserving lifecycle ordering, platform,
  persistence, and non-obvious behavior comments.
- Candidate files:
  - `src/modules/lifecycle/AppLifecycle.ts`
  - `src/modules/ui/epg/interfaces.ts`
  - `src/modules/scheduler/channel-manager/interfaces.ts`
  - `src/modules/ui/epg/view/EPGVirtualizer.ts`
- Package guardrail: comment-only; do not remove comments that document
  lifecycle ordering, browser/platform quirks, persistence guarantees, business
  rules, or behavior not visible in the signature.
- Disposition: resolved in `P14-WAVE6`; repetitive lifecycle/interface/signature
  JSDoc was trimmed while preserving ordering, persistence, platform, and
  non-obvious behavior comments.
- Status: completed
- Plan: local `P14-WAVE6` reviewed plan.
- Last touched: `2ba166d7` `refactor: complete p14 wave6 cleanup`
- Verification: `git diff --check`, package-local Desloppify commands,
  targeted trivial-signature JSDoc audits, and `npm run verify`.
- Follow-ups: `P14-W31` owns the post-WAVE6 restating-comment residual.
- Handoff: archived inside completed `P14-WAVE6`.

### [x] `P14-W24` `scheduler-type-field-doc-bloat`

- Imported review issues:
  - `review::.::holistic::ai_generated_debt::type_field_doc_bloat`
- Scope: trim scheduler channel type field comments that duplicate names and
  TypeScript types while preserving non-obvious domain constraints, persistence
  semantics, token/security concerns, and compatibility notes.
- Candidate files:
  - `src/modules/scheduler/channel-manager/types.ts`
- Package guardrail: comment-only; preserve comments that explain domain
  constraints or persistence/security semantics not visible from the type.
- Disposition: resolved in `P14-WAVE6`; duplicate scheduler field comments were
  removed while preserving domain, cache, token, persistence, and compatibility
  notes.
- Status: completed
- Plan: local `P14-WAVE6` reviewed plan.
- Last touched: `2ba166d7` `refactor: complete p14 wave6 cleanup`
- Verification: `git diff --check`, package-local Desloppify commands,
  targeted duplicate-field-comment audits, and `npm run verify`.
- Follow-ups: `P14-W30` owns the post-WAVE6 type-field-comment residual.
- Handoff: archived inside completed `P14-WAVE6`.

### [x] `P14-W25` `facet-snapshot-load-session-too-broad`

- Imported review issues:
  - `review::.::holistic::design_coherence::facet_snapshot_load_session_too_broad`
- Scope: split facet snapshot failure-snapshot/message construction and
  tag-count recovery worker logic from the load-session orchestration shell
  without changing snapshot output.
- Candidate files:
  - `src/core/channel-setup/planning/ChannelSetupFacetSnapshotLoadSession.ts`
- Package guardrail: preserve facet snapshot output, cancellation, warning,
  timing, progress, cache/inflight, and partial-failure behavior.
- Disposition: resolved in `P14-WAVE6`; failure construction moved to
  `ChannelSetupFacetSnapshotFailureBuilder` and unknown tag-count recovery moved
  to `ChannelSetupFacetCountRecoveryWorker`, while load-session orchestration
  retains cancellation, warnings, timing, progress, cache/inflight, and
  partial-failure behavior.
- Status: completed
- Plan: local `P14-WAVE6` reviewed plan.
- Last touched: `1761c65f` `fix: address p14 wave6 review followups`
- Verification: targeted channel-setup/facet snapshot tests, package-local
  Desloppify commands, targeted ownership audits, and `npm run verify`.
- Follow-ups: `P14-W32` owns the post-WAVE6 facet snapshot residual.
- Handoff: archived inside completed `P14-WAVE6`.

### [x] `P14-W26` `navigation-collaborator-cycle-wave6-residual`

- Imported review issues:
  - `review::.::holistic::design_coherence::navigation_collaborator_cycle`
- Scope: resolve the remaining navigation role ownership bundle by introducing
  a small runtime-services seam or equivalent source-proven split so the
  coordinator receives built handlers and only wires events.
- Candidate files:
  - `src/modules/navigation/NavigationCoordinator.ts`
  - `src/core/orchestrator/OrchestratorCoordinatorBuilders.ts`
- Package guardrail: preserve remote behavior and event subscription ownership.
  Do not treat stale/type-only cycle rows as source truth without current-source
  proof.
- Disposition: resolved in `P14-WAVE6`; `NavigationCoordinator` receives built
  handlers plus a runtime-services seam and remains responsible for event
  subscription wiring. `npx madge --circular` found no circular dependency
  across the cited navigation files.
- Status: completed
- Plan: local `P14-WAVE6` reviewed plan.
- Last touched: `1761c65f` `fix: address p14 wave6 review followups`
- Verification: targeted navigation/orchestrator tests, package-local
  Desloppify commands, targeted role-assembly audits, madge circular audit, and
  `npm run verify`.
- Follow-ups: none for the WAVE6 collaborator-cycle slice; `P14-W28` owns the
  separate post-WAVE6 runtime-contract residual.
- Handoff: archived inside completed `P14-WAVE6`.

### [x] `P14-W27` `epg-info-duration-duplication`

- Imported review issues:
  - `review::.::holistic::design_coherence::epg_info_duration_duplication`
- Scope: remove the local `EPGInfoPanel` duration-formatting duplicate by
  reusing the existing EPG utility without changing visible formatting.
- Candidate files:
  - `src/modules/ui/epg/view/EPGInfoPanel.ts`
  - `src/modules/ui/epg/utils.ts`
- Package guardrail: preserve current displayed duration formatting.
- Disposition: stale-proven in `P14-WAVE6`; current source already imports and
  uses shared `formatDuration` from `../utils`, and the targeted EPG info panel
  test preserved duration formatting.
- Status: completed
- Plan: local `P14-WAVE6` reviewed plan.
- Last touched: `2ba166d7` `refactor: complete p14 wave6 cleanup`
- Verification: targeted EPG info panel tests, package-local Desloppify
  commands, targeted `formatDuration` audit, and `npm run verify`.
- Follow-ups: none.
- Handoff: archived inside completed `P14-WAVE6`.

### [x] `P14-WAVE7` post-WAVE6 target residual cleanup

- Scope: execute the focused post-WAVE6 residual issues admitted because all
  three P14 target dimensions remain below `85`.
- Owned slices:
  - `P14-W28` `navigation-runtime-contract-hub-wave7-residual`
  - `P14-W29` `generated-style-headers-banners-wave7-residual`
  - `P14-W30` `type-field-comment-bloat-wave7`
  - `P14-W31` `restating-method-and-step-comments`
  - `P14-W32` `facet-snapshot-load-session-policy-bundle`
- Admission evidence: focused review
  `.desloppify/subagents/runs/20260428_032838/holistic_issues_merged.json`.
- Score evidence: AI generated debt `76.0` (`-2.0` from `78.0`, target
  `>=85`), cross-module arch `82.0` (`+4.0` from `78.0`, target `>=85`), and
  design coherence `82.0` (`+9.0` from `73.0`, target `>=85`).
- Package guardrail: do not open P15, broad AppOrchestrator cleanup, broad
  lifecycle cleanup, or stale detector wording without current-source proof.
  Keep cross-feature wiring and concrete adaptation in the orchestrator.
  Comment cleanup remains behavior-neutral.
- Sequencing guardrail: navigation residual work (`P14-W28`) must be serial or
  an explicitly coordinated navigation sub-wave. Comment cleanup (`P14-W29`
  through `P14-W31`) may be one behavior-neutral batch only if exact issue
  accounting remains separate. Facet snapshot work (`P14-W32`) must preserve
  snapshot output, cancellation, warning, timing, progress, cache/inflight, and
  partial-failure behavior.
- Verification routing: package-local scoping commands from the P14 package
  map, targeted `rg` audits, targeted tests where source behavior is touched,
  `npm run verify`, implementation review, checklist/package-map updates, and
  `npm run verify:docs`.
- Status: completed
- Note: this closes WAVE7 only and is not P14 exit.
- Plan: local approved `P14-WAVE7` execution unit `P14-W28` through `P14-W32`.
- Last touched: P14-WAVE7 cleanup-worker implementation pass.
- Verification: package-local Desloppify show commands were rerun; Desloppify
  still reported triage-pending stale cycle wording for W28/W32, so source
  proof used targeted `rg` plus `npx madge --circular` for the navigation
  files. Targeted navigation/orchestrator tests and channel-setup facet tests
  passed, `git diff --check` passed, and `npm run verify` passed.
- Follow-ups: the post-WAVE6 focused review re-used
  `navigation_runtime_contract_hub` with remaining runtime-contract evidence;
  `P14-W28` is the current residual owner while `P14-W21` remains closed for
  its approved WAVE6 source slice. It also re-used
  `generated_style_headers_and_banners` with new residual files; `P14-W29` is
  the current residual owner for that lineage.
- Handoff: WAVE7 source work is complete. Completing WAVE7 is still not P14
  exit; focused review/scoring and any P14-EXIT decision remain
  controller-owned.

### [x] `P14-W28` `navigation-runtime-contract-hub-wave7-residual`

- Imported review issues:
  - `review::.::holistic::cross_module_architecture::navigation_runtime_contract_hub`
- Scope: finish reducing navigation-owned runtime contract centralization by
  moving remaining handler-owned runtime interfaces and runtime-service
  vocabulary next to concrete handlers or the runtime-services owner while
  preserving orchestrator-owned app-level assembly.
- Candidate files:
  - `src/modules/navigation/NavigationCoordinatorContracts.ts`
  - `src/modules/navigation/NavigationKeyModeRouter.ts`
  - `src/modules/navigation/NavigationScreenEffectsHandler.ts`
  - `src/modules/navigation/NavigationModalEffectsHandler.ts`
  - `src/core/orchestrator/OrchestratorCoordinatorBuilders.ts`
- Package guardrail: navigation may own remote/focus routing contracts and
  event subscription wiring, but not app-level feature assembly. Preserve
  remote behavior.
- Disposition: completed in `P14-WAVE7`. `NavigationCoordinatorEventPort` now
  lives in a navigation-owned event-port module, runtime callback vocabulary is
  exported by `NavigationCoordinatorRuntimeServices`, and key/screen handlers
  no longer derive callback types from the aggregate runtime-services shape.
  `P14-W28` remains the current residual owner for
  `review::.::holistic::cross_module_architecture::navigation_runtime_contract_hub`;
  `P14-W21` stays closed for its approved WAVE6 slice.
- Verification: targeted navigation/orchestrator tests passed; required import
  audit passed; `npx madge --circular` reported no circular dependency for the
  cited navigation files; `npm run verify` passed.

### [x] `P14-W29` `generated-style-headers-banners-wave7-residual`

- Imported review issues:
  - `review::.::holistic::ai_generated_debt::generated_style_headers_and_banners`
- Scope: remove newly cited generated-style fileoverview/module/version
  metadata and decorative separator banners from hand-written production
  modules without changing runtime code.
- Candidate files:
  - `src/modules/plex/library/PlexLibrary.ts`
  - `src/modules/scheduler/scheduler/ChannelScheduler.ts`
  - `src/modules/ui/epg/types.ts`
  - `src/modules/scheduler/channel-manager/ChannelManager.ts`
- Package guardrail: comment-only; preserve comments that explain platform
  behavior, trust boundaries, persistence guarantees, domain constraints, or
  algorithmic rationale.
- Disposition: stale-proven for generated-header/banner scope in current
  source. The targeted audit found no `@fileoverview`, `@module`, `@version`,
  decorative separator banner, or generated-style header matches in the
  candidate files. `P14-W29` remains the current residual owner for
  `review::.::holistic::ai_generated_debt::generated_style_headers_and_banners`;
  `P14-W8`, `P14-W11`, and `P14-W16` stay closed for their approved slices.
- Verification: package-local Desloppify show commands for the candidate files
  reported no matching open issues, the targeted generated-header/banner `rg`
  audit returned no matches, and `npm run verify` passed.

### [x] `P14-W30` `type-field-comment-bloat-wave7`

- Imported review issues:
  - `review::.::holistic::ai_generated_debt::type_field_comment_bloat`
- Scope: trim type field comments that duplicate names and TypeScript types
  while preserving non-obvious domain constraints, persistence semantics,
  security notes, and compatibility behavior.
- Candidate files:
  - `src/modules/scheduler/channel-manager/types.ts`
  - `src/modules/ui/epg/types.ts`
- Package guardrail: comment-only; let descriptive names and TypeScript types
  carry straightforward shape information.
- Disposition: completed in `P14-WAVE7`. Duplicate field comments matched by
  the package audit were removed from channel-manager and EPG type surfaces
  while domain/persistence comments were preserved.
- Verification: targeted duplicate field-comment `rg` audit returned no
  matches for the cited phrases, package-local Desloppify show commands for the
  two files reported no open matches, `git diff --check` passed, and
  `npm run verify` passed.

### [x] `P14-W31` `restating-method-and-step-comments`

- Imported review issues:
  - `review::.::holistic::ai_generated_debt::restating_method_and_step_comments`
- Scope: delete JSDoc and inline step comments that only restate method names
  or immediate statements while preserving lifecycle ordering, platform, cache,
  trust-boundary, and behavior comments.
- Candidate files:
  - `src/modules/ui/epg/component/EPGComponent.ts`
  - `src/modules/scheduler/scheduler/ScheduleCalculator.ts`
  - `src/modules/plex/library/PlexLibrary.ts`
  - `src/modules/lifecycle/AppLifecycle.ts`
- Package guardrail: comment-only; preserve comments that explain behavior not
  visible in signatures or immediate code.
- Disposition: completed in `P14-WAVE7`. Restating step comments and trivial
  method JSDoc were removed from the cited EPG, scheduler, and Plex files;
  AppLifecycle was source-audited and left unchanged because the remaining
  comments explain lifecycle/platform behavior rather than restating methods.
- Verification: targeted restating-comment `rg` audit no longer reports the
  removed step-comment phrases; package-local Desloppify show commands were
  rerun; `git diff --check` passed; `npm run verify` passed.

### [x] `P14-W32` `facet-snapshot-load-session-policy-bundle`

- Imported review issues:
  - `review::.::holistic::design_coherence::facet_snapshot_load_session_policy_bundle`
- Scope: extract a per-library facet execution owner from the uncached facet
  snapshot load session while leaving the session responsible for playlist
  loading, invoking library executors, progress forwarding, and final snapshot
  assembly.
- Candidate files:
  - `src/core/channel-setup/planning/ChannelSetupFacetSnapshotLoadSession.ts`
  - `src/core/channel-setup/planning/ChannelSetupFacetSnapshotLoader.ts`
- Package guardrail: preserve facet snapshot output, cancellation, warning,
  timing, progress, cache/inflight, and partial-failure behavior. Do not
  introduce a generic workflow framework.
- Disposition: completed in `P14-WAVE7`. Per-library collection, native facet,
  tag-count recovery, and library-scoped abort execution moved to
  `ChannelSetupFacetLibraryExecutor`; the load session remains the playlist/load
  coordinator, progress forwarder, failure aggregator, and final snapshot
  assembler, while the loader remains the cache/inflight owner.
- Verification: targeted channel-setup facet snapshot tests passed, the
  required `loadSnapshot`/session audit preserved loader/session call
  boundaries, `npm run verify` passed, and package-local Desloppify show was
  rerun. Desloppify still reported stale triage-pending cycle/line evidence for
  the old load-session shape, so current-source proof is the diff plus tests and
  targeted `rg`.

### [x] `P14-WAVE8` post-WAVE7 target residual cleanup

- Scope: execute the focused post-WAVE7 residual issues admitted because all
  three P14 target dimensions remain below `85`.
- Owned slices:
  - `P14-W33` `production-file-generated-header-wave8`
  - `P14-W34` `self-describing-type-constant-comments-wave8`
  - `P14-W35` `ui-navigation-step-comments-wave8`
  - `P14-W36` `navigation-feature-contract-hub-wave8`
  - `P14-W37` `navigation-handler-contract-cycles-wave8`
  - `P14-W38` `facet-snapshot-session-policy-bundle-wave8`
- Admission evidence: focused review
  `.desloppify/subagents/runs/20260428_193443/holistic_issues_merged.json`.
- Score evidence: AI generated debt `82.0` (`+4.0` from `78.0`, target
  `>=85`), cross-module arch `81.5` (`+3.5` from `78.0`, target `>=85`), and
  design coherence `84.0` (`+11.0` from `73.0`, target `>=85`).
- Package guardrail: do not open P15, broad AppOrchestrator cleanup, broad
  lifecycle cleanup, or stale detector wording without current-source proof.
  Keep cross-feature wiring and concrete adaptation in the orchestrator.
  Comment cleanup remains behavior-neutral.
- Sequencing guardrail: navigation contract work (`P14-W36` and `P14-W37`)
  must be serial or one explicitly coordinated navigation sub-wave.
  Comment cleanup (`P14-W33` through `P14-W35`) may be one behavior-neutral
  batch only if exact issue accounting remains separate. Facet snapshot work
  (`P14-W38`) must preserve snapshot output, cancellation, warning, timing,
  progress, cache/inflight, partial-failure behavior, and load ordering.
- Verification routing: package-local scoping commands from the P14 package
  map, targeted `rg` audits, targeted tests where source behavior is touched,
  `npm run verify`, implementation review, checklist/package-map updates, and
  `npm run verify:docs`.
- Status: completed
- Plan: local approved `P14-WAVE8` execution unit `P14-W33` through
  `P14-W38`, reviewed clean after revision.
- Last touched: `5853c7c7` `refactor: complete p14 wave8 cleanup` and
  `4fe221cf` `fix: keep guide mini-guide hide outside typed intents`.
- Verification: package-local Desloppify/`rg` audits, `git diff --check`,
  TypeScript check, targeted navigation coordinator tests, targeted facet
  snapshot tests, navigation `madge --circular`, `npm run verify`, fresh source
  implementation review, and `npm run verify:docs`.
- Follow-ups: WAVE8 closes the admitted source residuals only. Completing WAVE8
  is not P14 exit; run a fresh focused review/scoring pass for
  `design_coherence,cross_module_architecture,ai_generated_debt` before
  deciding whether P14 can proceed toward `P14-EXIT` or needs another wave.
- Handoff: post-WAVE8 focused review/scoring remains the next controller-owned
  gate.

### [x] `P14-W33` `production-file-generated-header-wave8`

- Imported review issues:
  - `review::.::holistic::ai_generated_debt::production_file_generated_header`
- Scope: remove generated-style `@fileoverview` / `@module` metadata from the
  hand-written transcode quality config while preserving useful Plex transcode
  mapping rationale.
- Candidate files:
  - `src/config/transcodeQuality.ts`
- Package guardrail: comment-only; do not change transcode option values,
  labels, Plex query semantics, or exported types.
- Disposition: completed in `P14-WAVE8`; generated-style `@fileoverview` and
  `@module` metadata were removed from `src/config/transcodeQuality.ts` while
  preserving the useful Plex transcode mapping rationale and exported
  transcode option semantics. Source review and `npm run verify` passed.

### [x] `P14-W34` `self-describing-type-constant-comments-wave8`

- Imported review issues:
  - `review::.::holistic::ai_generated_debt::self_describing_type_constant_comments`
- Scope: trim comments on type and constant declarations that restate names,
  units, or nullability already carried by TypeScript names/types while
  preserving ADR rationale, units not visible in names, webOS behavior, and
  Plex API constraints.
- Candidate files:
  - `src/modules/plex/discovery/types.ts`
  - `src/modules/ui/epg/constants.ts`
  - `src/config/transcodeQuality.ts`
- Package guardrail: comment-only; do not change exported constants, DTO
  shapes, Plex discovery contracts, or EPG timing values.
- Disposition: completed in `P14-WAVE8`; self-describing type/constant
  comments were trimmed from the cited Plex discovery, EPG constant, and
  transcode quality files while preserving API constraints, meaningful units,
  and exported values/shapes. Source review and `npm run verify` passed.

### [x] `P14-W35` `ui-navigation-step-comments-wave8`

- Imported review issues:
  - `review::.::holistic::ai_generated_debt::ui_navigation_step_comments`
- Scope: remove UI/navigation/orchestrator comments and docblocks that only
  narrate obvious method names or immediate statements while preserving webOS
  behavior, failure isolation, timing contracts, shutdown ordering, and
  user-visible policy comments.
- Candidate files:
  - `src/modules/ui/audio-setup/AudioSetupScreen.ts`
  - `src/modules/navigation/RemoteHandler.ts`
  - `src/core/orchestrator/AppOrchestrator.ts`
- Package guardrail: comment-only; do not change shutdown order, remote input
  behavior, long-press timing, UI DOM structure, or orchestration behavior.
- Disposition: completed in `P14-WAVE8`; obvious UI/navigation/orchestrator
  step comments were removed while preserving webOS, shutdown ordering, timing,
  failure-isolation, and behavior comments. Source review and `npm run verify`
  passed.

### [x] `P14-W36` `navigation-feature-contract-hub-wave8`

- Imported review issues:
  - `review::.::holistic::cross_module_architecture::navigation_feature_contract_hub`
- Scope: reduce navigation-owned cross-feature runtime contract hub pressure by
  moving feature-specific reactions toward feature-owned navigation effect
  adapters or typed navigation intents while preserving NavigationManager
  remote/focus ownership and orchestrator-owned app-level assembly.
- Candidate files:
  - `src/modules/navigation/NavigationFeaturePorts.ts`
  - `src/modules/navigation/NavigationKeyModeRouter.ts`
  - `src/modules/navigation/NavigationScreenEffectsHandler.ts`
  - `src/modules/navigation/NavigationModalEffectsHandler.ts`
  - `src/core/orchestrator/OrchestratorCoordinatorBuilders.ts`
- Package guardrail: navigation may own remote/focus routing contracts and
  event subscription wiring, but not app-level feature assembly. Preserve
  remote behavior and D-pad focus behavior.
- Disposition: completed in `P14-WAVE8`; player OSD and mini-guide navigation
  feature ports now expose typed navigation intents while concrete feature
  adaptation remains in `OrchestratorCoordinatorBuilders.ts`. The guide-event
  mini-guide hide path was corrected to use a narrow coordinator event contract
  with concrete adaptation in the orchestrator. Navigation behavior tests,
  source review, and `npm run verify` passed.

### [x] `P14-W37` `navigation-handler-contract-cycles-wave8`

- Imported review issues:
  - `review::.::holistic::cross_module_architecture::navigation_handler_contract_cycles`
- Scope: move shared navigation handler runtime contracts beside a neutral
  navigation handler contract owner so the coordinator and concrete handlers no
  longer import runtime interfaces from peer concrete handler files.
- Candidate files:
  - `src/modules/navigation/NavigationHandlerContracts.ts`
  - `src/modules/navigation/NavigationCoordinator.ts`
  - `src/modules/navigation/NavigationKeyModeRouter.ts`
  - `src/modules/navigation/NavigationScreenEffectsHandler.ts`
  - `src/modules/navigation/NavigationModalEffectsHandler.ts`
  - `src/modules/navigation/NavigationRepeatHandler.ts`
  - `src/modules/navigation/NavigationChannelNumberHandler.ts`
- Package guardrail: contract/import refactor only unless an approved plan
  proves a behavior change is necessary. Preserve remote behavior, repeat
  handling, modal behavior, focus routing, and event subscription ownership.
- Disposition: completed in `P14-WAVE8`; shared handler runtime contracts moved
  to the new neutral `NavigationHandlerContracts.ts`, including channel-number
  and repeat-support contracts needed to remove runtime-interface imports from
  concrete peer handler files. Navigation `madge --circular`, targeted import
  audits, source review, and `npm run verify` passed.

### [x] `P14-W38` `facet-snapshot-session-policy-bundle-wave8`

- Imported review issues:
  - `review::.::holistic::design_coherence::facet_snapshot_session_policy_bundle`
- Scope: reduce the wide facet executor adapter by separating mutable facet
  load state from cancellation/failure-stop/progress control while keeping the
  session responsible for top-level sequencing and final snapshot selection.
- Candidate files:
  - `src/core/channel-setup/planning/ChannelSetupFacetSnapshotLoadSession.ts`
  - `src/core/channel-setup/planning/ChannelSetupFacetLibraryExecutor.ts`
  - `src/core/channel-setup/planning/ChannelSetupFacetSnapshotFailures.ts`
- Package guardrail: preserve facet snapshot output, cancellation, warning,
  timing, progress, cache/inflight, partial-failure behavior, and load ordering.
  Do not introduce a generic workflow framework.
- Disposition: completed in `P14-WAVE8`; mutable facet load state moved into
  `ChannelSetupFacetSnapshotLoadState`, and the library executor now receives
  separated control and state ports while the session keeps top-level
  sequencing and final snapshot assembly. Targeted facet snapshot tests, source
  review, and `npm run verify` passed.

### [ ] `P14-EXIT`

- Close only if: every P14 review issue id has one owner
  or explicit disposition; the P14 package map and checklist agree;
  package-local checks pass; final integration-branch scan/status/plan/review
  and security evidence is recorded; focused review evidence after each wave is
  recorded; stop-condition evaluation is recorded before opening P15; and `npm
  run verify` / `npm run verify:docs` pass as appropriate.
- Explicit non-closure rule: completing `P14-W1`, `P14-W2`, and `P14-W3`
  closed only `P14-WAVE1`. It did not close P14 because the focused review
  reported AI generated debt `76.0`, cross-module arch `82.0`, and design
  coherence `76.0`. Completing `P14-WAVE2` and `P14-WAVE3` also did not close
  P14 because the post-WAVE3 focused review reported AI generated debt `80.0`,
  cross-module arch `82.0`, and design coherence `76.0`, with concrete
  source-backed residual issues admitted under `P14-WAVE4`. Completing
  `P14-WAVE4` also did not close P14 because the post-WAVE4 focused review
  reported AI generated debt `78.0`, cross-module arch `82.0`, and design
  coherence `76.0`, with concrete source-backed residual issues now admitted
  under `P14-WAVE5`. Completing `P14-WAVE5` also did not close P14 because the
  post-WAVE5 focused review reported AI generated debt `78.0`, cross-module
  arch `82.0`, and design coherence `76.0`, with concrete source-backed
  residual issues admitted under `P14-WAVE6`. Completing `P14-WAVE6` also did
  not close P14 because the post-WAVE6 focused review reported AI generated
  debt `76.0`, cross-module arch `82.0`, and design coherence `82.0`, with
  concrete source-backed residual issues admitted under `P14-WAVE7`. Completing
  `P14-WAVE7` also did not close P14 because the post-WAVE7 focused review
  reported AI generated debt `82.0`, cross-module arch `81.5`, and design
  coherence `84.0`, with concrete source-backed residual issues now admitted
  under `P14-WAVE8`.
- Required commands:
  - `desloppify scan --path .`
  - `desloppify status`
  - `desloppify plan queue --sort recent --include-skipped`
  - `desloppify plan`
  - `desloppify show review --status open --no-budget --top 120`
  - package-local scoping commands for each completed P14 package
  - focused subjective review for
    `design_coherence,cross_module_architecture,ai_generated_debt` after each
    completed P14 wave
  - `desloppify show security --status open --no-budget --top 50`
  - `npm run verify` for P14 source work and `npm run verify:docs` for
    checklist/package-map closeout
- Score reporting required at exit:
  - AI generated debt current score and delta from `78.0`
  - Cross-module arch current score and delta from `78.0`
  - Design coherence current score and delta from `73.0`
- Stop-condition evaluation:
  - close normally when all three target dimensions are at least `85`
  - or close early only if two consecutive fresh focused subjective reviews
    find no concrete source-backed issues that can be fixed without ownership
    churn, strict remains at least `88`, and no P0 security or high-confidence
    source-backed design/coherence issues remain
- New issue rule: any newly admitted focused-review issue must be added to the
  package map with one owner, candidate files, package-local commands,
  verification routing, and a revisit/stop condition before implementation.
- Status: not started
- Plan: none yet
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: do not open P15 until P14-EXIT records exact-id ownership,
  dispositions, scan/status/review/security evidence, target-dimension score
  evidence, stop-condition evaluation, and verification results.

## P14 Non-Active Refreshed Review Dispositions

These refreshed review issue ids are accounted for but are not active P14 work
unless fresh current-source proof supersedes the triage/value-check decision.
Exact owner, reason, and revisit trigger are recorded in
`docs/architecture/p14-post-p13-subjective-review-package-map.json`.

- `review::.::holistic::design_coherence::app_lifecycle_boundary_still_broad`:
  deferred; no active P14 owner because current lifecycle code already delegates
  key collaborators and no concrete boundary defect was proven.
- `review::.::holistic::design_coherence::app_orchestrator_runtime_hub`:
  deferred; no active P14 owner because the value-check found the proposed
  selected-server move would relocate orchestration detail into a broader
  selected-server seam.
- `review::.::holistic::design_coherence::channel_setup_planner_pipeline_bulk`:
  deferred; no active P14 owner because the current planner pipeline is readable
  glue over existing extracted stages. Fresh review superseded part of this
  area with `P14-W7`, but the older broad pipeline-bulk wording remains
  non-active.
- `review::.::holistic::incomplete_migration::legacy_playback_variant_strip_still_live`:
  deferred; no active P14 owner because the legacy field strip is a bounded
  persisted-data compatibility shim.

## Not Active Checklist Scope By Default

- Subjective reassessment placeholders currently shown by
  `desloppify plan queue --sort recent --include-skipped`, unless a fresh
  review creates concrete issue ids and P14/P15 ownership assigns them.
- `stale_exclude::*` rows for local/tooling directories unless repo policy
  changes.
- Duplicate detector rows or detector-lag rows without current-source evidence.
- Dirty source edits already present in the worktree; evaluate them separately
  before assuming they belong to a P14 package.
