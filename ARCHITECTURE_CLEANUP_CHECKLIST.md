# Architecture Cleanup Checklist

> V4 established 2026-04-10 from the fresh holistic review imported from `.desloppify/subagents/runs/20260410_053544`.
>
> Any pre-refresh copy preserved under `docs/_local/` is scratch-only and must not be treated as tracked handoff memory or current truth.

This document is the active cleanup queue for the current repo-wide `desloppify` backlog.

This is the correct top-level tracked format for this work. Per `docs/agentic/document-map.md`, `ARCHITECTURE_CLEANUP_CHECKLIST.md` is the authoritative active backlog and live-status surface, while `docs/plans/*` remains task-scoped execution memory. Every `P#-W#` below must still get its own execution-grade plan file before code changes begin.

## Fresh-Session Handoff

- Last structural refresh: `2026-04-10` from `.desloppify/subagents/runs/20260410_053544`
- Current execution state: `P0-W1`, `P0-W2`, `P0-EXIT`, `P1-W1`, `P1-W2`, `P1-EXIT`, `P2-W1`, `P2-W2`, `P2-W3`, `P2-EXIT`, and `P3-W1` completed on integration-branch evidence
- Next safe start: `P3-W2`
- Legacy note: `docs/plans/2026-04-02-p3-w1-channel-setup-workflow-owner.md` predates the `2026-04-10` checklist refresh and is historical planning context, not the active `P3-W1` gate token
- Authoritative evidence rule: only update checklist status, baseline counts, or exit records from reruns on the target integration branch; worktree evidence is provisional
- Recent update log:
  - `2026-04-10`: closed `P0-W1`/`P0-W2`/`P0-EXIT`; locked `dist-ts` generated-output exclusion, recorded queue operating rule, ran `desloppify` exit evidence plus `npm run verify:docs`
  - `2026-04-10`: completed `P1-W1` runtime-owner decomposition (root barrel move, selected-server runtime owner extraction, schedule policy owner extraction, app-shell runtime contract narrowing, app config factory extraction), ran full verification + required `desloppify` evidence
  - `2026-04-10`: completed `P1-W2` runtime seam cleanup (explicit event cleanup reporter seam, grouped priority-one runtime seams, coordinator builder extraction), ran full `verify` plus required `desloppify` evidence refresh
  - `2026-04-11`: completed `P1-EXIT` reconciliation (all mapped imported review ids closed, cycle detector residue dispositioned with source-audit proof and final owner, `npm run verify` rerun)
  - `2026-04-13`: completed `P2-W2` owner-boundary split (state/runtime session owners, facet snapshot loader extraction, typed build scratch owner), ran targeted channel-setup/orchestrator regressions plus `npm run verify`
  - `2026-04-13`: completed `P2-W3` error/migration/test closure (typed `ChannelSetupPlanningError` boundary proof, canonical playback variant key cleanup, direct tag-filter tests), ran targeted P2-W3 suites + `npm run verify` + source-audit and detector reconciliation commands

## Goal

- Turn the 2026-04-10 fresh `desloppify` run into an auditable, production-grade cleanup program that retires the current imported review debt, burns down the current mechanical detector backlog, removes queue-surface ambiguity, and raises the repo from `strict 83.4` through verified fixes rather than suppression or bookkeeping tricks.

## Non-Goals

- Do not treat the old V3 checklist ownership map as current truth.
- Do not mass-resolve imported review issues or mechanical detector items without current-code proof.
- Do not suppress or exclude generated/build/tool surfaces just to improve the score; every scope change must be an explicit repo decision and be re-verified with a fresh scan.
- Do not use this checklist as a substitute for per-work-unit implementation plans.
- Do not rewrite subsystems wholesale when a narrower owner, contract, or package split is sufficient.

## How To Use This

- Treat this file as the repo-level cleanup control plane for the current run.
- Before implementation begins for any `P#-W#`, write a companion tracked plan in `docs/plans/YYYY-MM-DD-<topic>.md` using the plan-authoring standard.
- Work top-down unless a `P0` trust issue blocks the rest of the queue.
- Keep one explicit final owner per imported review issue envelope.
- For imported review issues, use the exact issue ids mapped below.
- For mechanical detector work, treat detector envelopes as the durable unit of planning. Exact mechanical issue ids may churn after refactors, file moves, and test splits.
- Only record authoritative `desloppify` evidence here from the target integration branch; do not close boxes from worktree-only scans.
- Do not let parallel agents edit the same `P#-W#` or `P#-EXIT` record concurrently; parallel execution must use disjoint checklist items.
- Update this checklist in the same delivery pass whenever a priority closes, the review issue map changes, a scan-scope decision changes, or the queue-trust story changes.

## Work-Unit Status Contract

- Every `P#-W#` and `P#-EXIT` item below is a checklist item. The checkbox is the binary closeout signal.
- Keep the live execution state directly under the touched item using this compact mini-record:
  - `Status:` `planned`, `in progress`, `blocked`, `completed`, `deferred`, or `split follow-up`
  - `Plan:` tracked `docs/plans/...` path, or `none yet`
  - `Last touched:` `YYYY-MM-DD`
  - `Verification:` exact rerun commands plus short result
  - `Follow-ups:` exact issue ids and final owner, or `none`
  - `Handoff:` one-line next safe action, or `none`
- If a slice has never been touched in this V4 cycle, leave the mini-record absent instead of adding placeholder noise.
- Check a box only in the same pass that updates the mini-record with current verification results and final issue dispositions.
- If the slice needs more than this compact status record, put the extra implementation history in its companion plan or archived plan, not in this checklist body.

## Fresh Evidence Snapshot

### Commands Run For The Current Baseline

- `desloppify scan --path .`
- `desloppify next`
- `desloppify status`
- `desloppify review --prepare`
- `desloppify review --run-batches --runner codex --parallel --scan-after-import`
- `desloppify show review --status open`
- `desloppify plan queue --sort recent`
- `desloppify show stale_exclude --status open`

### Run Summary

- Fresh run directory: `.desloppify/subagents/runs/20260410_053544`
- Run summary: `20 / 20` successful batches, `0` failed batches
- Merged output: `.desloppify/subagents/runs/20260410_053544/holistic_issues_merged.json`
- Import mode: trusted internal run-batches import
- Follow-up scan completed successfully after import

### Current Post-Import Score State

- Last scan: `2026-04-10T06:03:47+00:00`
- `desloppify status`: `overall 83.4 / objective 95.7 / strict 83.4 / verified 95.7`
- Open issues: `366` total
- Open imported review issues: `51`
- Open non-review issues: `315`
- Weakest subjective dimensions:
  - `design_coherence 72.0`
  - `cross_module_architecture 73.0`
  - `test_strategy 74.0`
  - `high_level_elegance 74.0`
  - `contracts 78.0`
  - `structure_nav 78.0`
  - `API coherence 79.0`
  - `error_consistency 78.4`

### Current Detector Inventory

- `smells`: `163`
- `structural`: `76`
- `review`: `51`
- `facade`: `21`
- `test_coverage`: `20`
- `logs`: `8`
- `signature`: `8`
- `stale_exclude`: `6`
- `responsibility_cohesion`: `5`
- `flat_dirs`: `3`
- `single_use`: `3`
- `naming`: `1`
- `boilerplate_duplication`: `1`

### Current Hotspot Anchors

- `src/Orchestrator.ts` at `2,015` lines
- `src/modules/ui/epg/view/EPGVirtualizer.ts` at `1,912` lines
- `src/modules/ui/epg/EPGComponent.ts` at `1,796` lines
- `src/core/channel-setup/ChannelSetupPlanningService.ts` at `364` lines
- `src/modules/plex/library/PlexLibrary.ts` at `1,236` lines
- `src/modules/plex/stream/PlexStreamResolver.ts` at `1,144` lines
- `src/modules/ui/channel-setup/ChannelSetupSessionController.ts` at `172` lines
- `src/modules/plex/auth/PlexAuth.ts` at `921` lines
- `src/modules/player/PlaybackRecoveryManager.ts` at `896` lines
- `src/modules/player/SubtitleManager.ts` at `684` lines
- `src/core/orchestrator/OrchestratorCoordinatorFactory.ts` at `636` lines
- `src/App.ts` at `470` lines

### Queue-Trust And Scope Irregularities That Must Be Addressed

- `desloppify status` reports `Queue: 1 item (51 stale tracked · 1 subjective)`.
- `desloppify plan queue --sort recent` also reports `1` subjective queue item.
- `desloppify next` reports `Queue: 0 items` and `Nothing to do!`.
- `desloppify status` still lists excluded paths such as `.desloppify`, `.worktrees`, `.codex/cache`, `.codanna/index`, `.mcp_sequential_thinking`, and `docs/_local` in structural debt area summaries even though the scan respected those excludes.
- `dist-ts/` is current TypeScript build output (`tsconfig.json` `outDir`) but it was not on the approved exclude list for the freshness run, so its current `facade` findings are in scope until the repo explicitly decides otherwise.

## Discovery Trail

- Codanna symbol lookup succeeded for:
  - `createChannelSetupWorkflowPort`
  - `ChannelSetupCoordinator`
  - `PlaybackRecoveryManager`
- Codanna broad semantic search was too noisy for repo-wide cleanup shaping, so final mapping used direct reads of:
  - `docs/agentic/document-map.md`
  - `docs/agentic/plan-authoring-standard.md`
  - `ARCHITECTURE_CLEANUP_CHECKLIST.md` V3
  - `.desloppify/state-typescript.json`
  - `.desloppify/plan.json`
  - `.desloppify/subagents/runs/20260410_053544/run_summary.json`
  - `.desloppify/subagents/runs/20260410_053544/holistic_issues_merged.json`
  - `tsconfig.json`

## Review Backlog Shape By Dimension

- `abstraction_fitness`: `3`
- `ai_generated_debt`: `3`
- `api_surface_coherence`: `3`
- `authorization_consistency`: `1`
- `contract_coherence`: `3`
- `convention_outlier`: `3`
- `cross_module_architecture`: `3`
- `design_coherence`: `3`
- `error_consistency`: `3`
- `high_level_elegance`: `4`
- `incomplete_migration`: `2`
- `initialization_coupling`: `2`
- `logic_clarity`: `2`
- `low_level_elegance`: `2`
- `mid_level_elegance`: `3`
- `naming_quality`: `2`
- `package_organization`: `3`
- `test_strategy`: `3`
- `type_safety`: `3`

## Mechanical Debt Planning Rule

Imported review issues are stable enough to map one-by-one. Mechanical issues are not. File splits, renamed helpers, test extraction, generated-output decisions, and detector churn will change many mechanical issue ids even when the underlying debt is the same.

Because of that, this checklist tracks mechanical debt by:

- detector envelope
- affected package or owner area
- authoritative `desloppify show ... --no-budget` commands
- exit expectations for each priority

Do not convert the current 315 non-review issue ids into permanent ownership records in this file. Refresh them at each `P#-EXIT` instead.

## Companion Plan Rule

Before implementing any work unit below, create a companion plan file under `docs/plans/` with:

- exact files in scope
- exact files out of scope
- the mapped imported review issue ids from this checklist
- the detector envelopes from this checklist
- verification commands and expected results
- rollback notes when ownership, persistence, Orchestrator, Plex, or UI runtime seams are being changed

Suggested naming:

- `docs/plans/YYYY-MM-DD-p0-w1-scan-scope-and-generated-output-policy.md`
- `docs/plans/YYYY-MM-DD-p1-w1-runtime-composition-root-narrowing.md`
- `docs/plans/YYYY-MM-DD-p2-w1-channel-setup-seam-reduction.md`
- etc.

## Priority Overview

- `P0`: queue trust, scan scope, generated output, and control-plane hygiene
- `P1`: runtime composition roots and orchestrator ownership
- `P2`: channel setup boundary and workflow decomposition
- `P3`: EPG and UI package surface normalization
- `P4`: lifecycle, navigation, initialization, and app-owned startup seams
- `P5`: storage and settings contract coherence
- `P6`: Plex auth/discovery/library contract and type normalization
- `P7`: player and playback recovery contract cleanup
- `P8`: diagnostics, documentation, and ceremony cleanup
- `P9`: test-seam repair and test-only detector burn-down
- `P10`: residual mechanical detector burn-down and overall exit

## Priority Skill Routing

- `P0`: `architecture-boundaries` when scan-scope choices affect ownership; otherwise docs/process only
- `P1`: `architecture-boundaries`
- `P2`: `architecture-boundaries`, `ui-composition-patterns`, `persistence-boundaries`
- `P3`: `architecture-boundaries`, `ui-composition-patterns`
- `P4`: `architecture-boundaries`, `persistence-boundaries`, `ui-composition-patterns`
- `P5`: `persistence-boundaries`
- `P6`: `architecture-boundaries`, `plex-integration-boundaries`
- `P7`: `architecture-boundaries`, `plex-integration-boundaries`
- `P8`: boundary skill matching touched files; default `architecture-boundaries`
- `P9`: boundary skill matching touched files; add `ui-composition-patterns` or `plex-integration-boundaries` as needed
- `P10`: only the skills needed by the final residuals; do not load broad skills by habit

## Execution Hygiene

- Disposition vocabulary:
  - `resolved`: the exact imported issue, or the slice-owned rationale mapped to it, is retired by the current slice or priority exit, and the closing evidence has been refreshed on current code.
  - `deferred`: the issue stays open, but the record names the exact issue id, current owner, reason, and revisit trigger; nothing deferred is implicitly accepted.
  - `split follow-up`: the current slice is not the final owner; the remaining gap is handed to one exact successor owner.
  - `owned follow-up`: the exact successor owner named by a `split follow-up` record; each split issue must have one single final owner, not shared implicit ownership across multiple `P#-W#` items.
  - `security triage`: a fresh `desloppify status` result for the current slice or exit that either says `no open P0 security findings` or lists the exact open or deferred `P0` security issue ids plus reasons and revisit triggers.
  - `priority-exit review`: the blocking review run after the last planned `P#-W#` item in a priority and before any `P(n+1)` work, plan, or checklist progress begins.
- Issue-envelope ownership rule:
  - choose one intended final owner for every imported issue envelope when it first enters a priority;
  - do not keep reassigning the same issue envelope unless current-code proof shows a genuinely different remaining owner;
  - detector lag alone is not a reason to invent a new successor owner.
- Source-audit precedence rule:
  - when current-code proof shows that the slice-owned rationale is gone, prefer `resolved` plus a note about stale detector wording over a new `split follow-up`;
  - use `split follow-up` only when current-code proof shows a real remaining live gap outside the completed slice.
- Priority exit record format:
  - `mapped imported issues`: every imported issue mapped to the priority, each with one disposition: `resolved`, `deferred`, or `split follow-up`
  - `follow-up ownership`: for every `deferred` or `split follow-up` item, the exact current owner, reason, and revisit trigger; if an imported issue was mapped across multiple `P#-W#` items, nominate one single final owner here
  - `security triage`: `no open P0 security findings`, or the exact deferred or resolved `P0` security findings blocking next-priority work
  - `residuals`: any meaningful debt intentionally left in the priority area, plus its new owner
  - `verification`: exact commands used for the priority-exit review, including `desloppify` evidence refresh and task-specific gates
- Cleanup slice execution template:
  - `priority/work units`: exact `P#-W#` items in scope for the slice
  - `imported review issues`: exact mapped issue ids being retired
  - `security triage`: `no open P0 security findings`, or the deferred or resolved `P0` security findings for the slice
  - `verification`: exact commands that prove the slice is complete
  - `deferred items`: anything intentionally left open with its exact issue id, owner, reason, and revisit trigger
  - `proof matrix`: for each mapped imported issue, record whether the slice-owned rationale is retired on current source, whether live residual debt remains, whether any detector wording is stale, the final owner, and the revisit trigger if anything remains open
- Priority exit command checklist:
  - rerun `desloppify status`
  - rerun `desloppify plan queue`
  - rerun `desloppify show review --status open --no-budget --top 100`
  - rerun every exact mapped `desloppify show "<issue-id>" --status open --no-budget` command for the closing priority
  - rerun the strongest task-specific verification used by the closing work units
  - confirm every mapped imported issue for the priority is either retired here or explicitly deferred or split with an exact owner, reason, and revisit trigger
  - confirm every issue mapped across multiple `P#-W#` items has one single final owner at exit
  - confirm no `P(n+1)` work, plan, or checklist progress has been opened before the current `P#-EXIT` record is complete

## Priority Exit Gates

Each exit gate below is mandatory. Do not mark progress on `P(n+1)` work until the current priority-exit review is complete and the `P#-EXIT` record is complete.

- [x] `P0-EXIT`
  - required: record the final `dist-ts/` scope decision, the queue-surface consistency disposition, explicit `security triage`, and docs-verification result before moving to `P1`
  - rerun `desloppify status`, `desloppify next`, `desloppify plan queue --sort recent`, `desloppify show stale_exclude --status open --no-budget --top 50`, `desloppify show facade --status open --no-budget --top 50`, `desloppify show security --status open --no-budget --top 50`, and `npm run verify:docs`
  - classify any surviving queue mismatch as one of: repo-side persisted subjective state, by-design queue semantics, or upstream tooling inconsistency; do not collapse these into one bucket
  - confirm the local operating rule for any surviving queue mismatch and whether `dist-ts/` stays in scope or moves to approved generated output
  - refresh the top-level `Fresh-Session Handoff` block in the same pass so `P1-W1` becomes the next safe start only after `P0-EXIT` is actually closed
  - Status: completed
  - Plan: `docs/plans/2026-04-10-p0-queue-trust-and-scan-contract.md`
  - Last touched: `2026-04-10`
  - Verification: `desloppify status`; `desloppify next`; `desloppify plan queue --sort recent`; `desloppify show stale_exclude --status open --no-budget --top 50`; `desloppify show facade --status open --no-budget --top 50`; `desloppify show security --status open --no-budget --top 50`; `npm run verify:docs`; `npm run plans:check`.
  - Follow-ups:
    - `followup::p0-exit::dist-ts-facade-residue`
      owner: `desloppify upstream detector contract (tracked locally by Lineup cleanup owner in P10-W1/P10-EXIT)`
      reason: `desloppify show facade --status open --no-budget --top 50` still reports `facade::dist-ts/**` after `dist-ts` exclusion and fresh scan; local scan-scope decision remains locked (`dist-ts` excluded generated output).
      revisit trigger: rerun `desloppify scan --path .` + `desloppify show facade --status open --no-budget --top 50` at `P10-W1` entry and before `P10-EXIT`; if residue persists with exclusion intact, keep as tooling-state residue or escalate with minimal repro.
    - `followup::p0-exit::plans-check-preexisting-gaps`
      owner: `tracked-plan maintainers for the listed active plans`
      reason: `npm run plans:check` failure is caused by pre-existing conformance gaps in unrelated active plans, outside this P0 scope and intentionally not edited in this slice.
      revisit trigger: next plan-maintenance pass touching those specific plan files, and mandatory rerun before any session claims global serious-plan conformance is green.
  - Handoff: `P1-W1 plan/review may begin`
  - Queue-surface disposition (locked three-bucket rule): repo-side persisted subjective state exists in `.desloppify/plan.json`/`.desloppify/state-typescript.json`; mismatch classified as by-design queue semantics (`next` excludes subjective reminders) rather than unresolved upstream inconsistency for `P0` closeout.
  - Security triage: `desloppify show security --status open --no-budget --top 50` returned `No open issues for Security`.
  - Docs verification: `npm run verify:docs` passed.

- [x] `P1-EXIT`
  - required: record every mapped imported issue with an exact disposition
  - run the priority-exit review before moving to `P2`
  - refresh every `P1` issue id, the `P1` detector envelopes, `desloppify status`, `desloppify plan queue`, and `npm run verify`
  - confirm one single final owner for any `P1` issue that still needs a follow-up
  - Status: completed
  - Plan: `none (priority-exit reconciliation recorded directly in this checklist)`
  - Last touched: `2026-04-11`
  - Mapped imported issues:
    - `review::.::holistic::cross_module_architecture::orchestrator_runtime_hub` → `resolved` (`desloppify show ...` returned no open issues)
    - `review::.::holistic::design_coherence::orchestrator_monolith_boundary` → `resolved` (`desloppify show ...` returned no open issues)
    - `review::.::holistic::high_level_elegance::composition_root_role_drift` → `resolved` (`desloppify show ...` returned no open issues)
    - `review::.::holistic::package_organization::root_orchestrator_straggler` → `resolved` (`desloppify show ...` returned no open issues)
    - `review::.::holistic::low_level_elegance::orchestrator_factory_wrapper_sprawl` → `resolved` (`desloppify show ...` returned no open issues)
    - `review::.::holistic::mid_level_elegance::orchestrator_factory_callback_bag` → `resolved` (`desloppify show ...` returned no open issues)
    - `review::.::holistic::error_consistency::orchestrator_cleanup_failures_disappear` → `resolved` (`desloppify show ...` returned no open issues)
  - Verification:
    - `desloppify scan --path .` rerun on integration branch
    - `desloppify show review --status open --no-budget --top 100` returned no open review issues
    - reran all seven mapped imported-id commands above with `--status open --no-budget --top 20`; each returned no open issues
    - `desloppify show src/Orchestrator.ts --status open --no-budget --top 100` still reports non-P1 imported detector residue (`logs::Orchestrator`, `console_error_no_throw`, `swallowed_error`)
    - `desloppify show src/core/orchestrator --status open --no-budget --top 100` reports orchestrator-family residue plus `cycles::src/core/orchestrator/OrchestratorCoordinatorBuilders.ts::src/core/orchestrator/OrchestratorCoordinatorBuilders.ts::src/core/orchestrator/OrchestratorCoordinatorFactory.ts`
    - `desloppify show logs --status open --no-budget --top 50` still reports orchestrator-family and non-P1 log items
    - `desloppify show structural --status open --no-budget --top 150` returned `No open issues matching: structural`
    - `desloppify show src/core/orchestrator/OrchestratorCoordinatorFactory.ts --status open --no-budget --top 50` still reports `monster_function`, `high_cyclomatic_complexity`, `nested_closure`
    - `desloppify show src/core/orchestrator/OrchestratorEventBinder.ts --status open --no-budget --top 50` still reports `[Orchestrator]` tagged log and `console_error_no_throw`
    - `desloppify show smells --status open --no-budget --top 250` confirms no reopened mapped imported review ids
    - `desloppify show cycles --status open --no-budget --top 50` still reports one builders→factory cycle issue id
    - source-audit proof for cycle back-edge removal:
      - `rg -n "OrchestratorCoordinatorFactory" src/core/orchestrator/OrchestratorCoordinatorBuilders.ts` returned no matches
      - `rg -n "OrchestratorCoordinatorBuilders" src/core/orchestrator/OrchestratorCoordinatorFactory.ts` returned no matches
    - `desloppify status` shows `overall 83.2 / strict 83.2 / objective 95.1 / verified 95.1`
    - `desloppify plan queue` shows `Queue: 1 item (51 planned · 1 subjective)`
    - `npm run verify` passed
  - Security triage:
    - `desloppify scan --path .` reported `security: clean` on the fresh integration-branch scan.
    - `desloppify show security --status open --no-budget --top 50` currently returns the same T3 cycle issue id (`cycles::src/core/orchestrator/OrchestratorCoordinatorBuilders.ts::src/core/orchestrator/OrchestratorCoordinatorBuilders.ts::src/core/orchestrator/OrchestratorCoordinatorFactory.ts`), not a P0 security blocker.
    - that cycle issue is owned by `followup::p1-exit::orchestrator-cycle-detector-residue` below.
  - Follow-ups:
    - `followup::p1-exit::root-orchestrator-detector-residue`
      owner: `P10-W1 detector-contract cleanup owner`
      reason: `desloppify show src/Orchestrator.ts --status open --no-budget --top 100` still reports detector residue, but current `src/Orchestrator.ts` is a thin barrel and the reported legacy line refs are stale detector evidence.
      revisit trigger: rerun `desloppify scan --path .` + `desloppify show src/Orchestrator.ts --status open --no-budget --top 100` at `P10-W1` entry and before `P10-EXIT`; if residue persists with the same barrel source shape, keep as tooling-state residue or escalate upstream with minimal repro.
    - `followup::p1-exit::factory-smell-detector-residue`
      owner: `P10-W1 detector-contract cleanup owner`
      reason: `desloppify show src/core/orchestrator/OrchestratorCoordinatorFactory.ts --status open --no-budget --top 50` still reports `monster_function`/`high_cyclomatic_complexity`/`nested_closure`, but current `OrchestratorCoordinatorFactory.ts` is a 6-line barrel and reported line 195 evidence is stale detector output.
      revisit trigger: rerun `desloppify scan --path .` + `desloppify show src/core/orchestrator/OrchestratorCoordinatorFactory.ts --status open --no-budget --top 50` at `P10-W1` entry and before `P10-EXIT`; if residue persists with the same barrel source shape, keep as tooling-state residue or escalate upstream with minimal repro.
    - `followup::p1-exit::orchestrator-live-log-error-policy-residue`
      owner: `P10-W1 residual mechanical detector owner`
      reason: `desloppify show logs --status open --no-budget --top 50`, `desloppify show src/core/orchestrator --status open --no-budget --top 100`, and `desloppify show src/core/orchestrator/OrchestratorEventBinder.ts --status open --no-budget --top 50` still show live orchestrator log/smell mechanical backlog (`AppOrchestrator` and `OrchestratorEventBinder`) that is not unresolved P1 imported-review ownership.
      revisit trigger: rerun `desloppify scan --path .` + `desloppify show logs --status open --no-budget --top 50` + `desloppify show src/core/orchestrator/AppOrchestrator.ts --status open --no-budget --top 100` + `desloppify show src/core/orchestrator/OrchestratorEventBinder.ts --status open --no-budget --top 50` at `P10-W1` entry and before `P10-EXIT`, and disposition as one owned residual mechanical envelope.
    - `followup::p1-exit::orchestrator-cycle-detector-residue`
      owner: `P10-W1 detector-contract cleanup owner`
      reason: cycle detector still reports `cycles::...OrchestratorCoordinatorBuilders.ts...OrchestratorCoordinatorFactory.ts` after source-audit proof removed explicit factory↔builder import edges; treat as detector/graph residue, not a live runtime seam in current source.
      revisit trigger: rerun `desloppify scan --path .` + `desloppify show cycles --status open --no-budget --top 50` at `P10-W1` entry and before `P10-EXIT`; if still open with same source-audit proof, classify as tooling-state residue or escalate upstream with minimal repro.
  - Handoff: `P2-W1 planning/implementation may begin`

- [x] `P2-EXIT`
  - required: record every mapped imported issue with an exact disposition
  - run the priority-exit review before moving to `P3`
  - refresh every `P2` issue id, the `P2` detector envelopes, `desloppify status`, `desloppify plan queue`, and `npm run verify`
  - confirm one single final owner for any `P2` issue that still needs a follow-up
  - Status: completed
  - Plan: `none (priority-exit reconciliation recorded directly in this checklist)`
  - Last touched: `2026-04-13`
  - Mapped imported issues:
    - `review::.::holistic::abstraction_fitness::channel_setup_wrapper_chain` -> `resolved` (`desloppify show ... --status open --no-budget --top 20` returned no open issues)
    - `review::.::holistic::abstraction_fitness::planning_service_used_as_normalizer` -> `resolved` (`desloppify show ... --status open --no-budget --top 20` returned no open issues)
    - `review::.::holistic::mid_level_elegance::channel_setup_port_mixed_absence_contract` -> `resolved` (`desloppify show ... --status open --no-budget --top 20` returned no open issues)
    - `review::.::holistic::cross_module_architecture::channel_setup_raw_storage_seam` -> `resolved` (`desloppify show ... --status open --no-budget --top 20` returned no open issues)
    - `review::.::holistic::design_coherence::channel_setup_session_controller_mixed_state_and_io` -> `resolved` (`desloppify show ... --status open --no-budget --top 20` returned no open issues)
    - `review::.::holistic::design_coherence::channel_setup_snapshot_loader_overloaded` -> `resolved` (`desloppify show ... --status open --no-budget --top 20` returned no open issues)
    - `review::.::holistic::high_level_elegance::channel_setup_domain_placement_blur` -> `resolved` (`desloppify show ... --status open --no-budget --top 20` returned no open issues)
    - `review::.::holistic::error_consistency::channel_setup_plain_object_throw` -> `resolved` (`desloppify show ... --status open --no-budget --top 20` returned no open issues)
    - `review::.::holistic::incomplete_migration::playback_variant_rename_still_leaks_legacy_key` -> `resolved` (`desloppify show ... --status open --no-budget --top 20` returned no open issues)
    - `review::.::holistic::test_strategy::fastkey_filter_parser_untested` -> `resolved` (`desloppify show ... --status open --no-budget --top 20` returned no open issues; detector `test_coverage::src/core/channel-setup/ChannelSetupTagFilters.ts::transitive_only` remains open but is stale wording resolved on current-code proof via direct `ChannelSetupTagFilters.test.ts`)
  - Verification:
    - `npm test -- --runInBand src/modules/scheduler/channel-manager/__tests__/StoredChannelDataCodec.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelRepository.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts` passed
    - `npm test -- --runInBand src/core/channel-setup/__tests__/ChannelSetupTagFilters.test.ts src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoader.test.ts src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts src/core/channel-setup/__tests__/ChannelSetupPlanner.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelRepository.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts` passed
    - `desloppify show review --status open --no-budget --top 100` returned no open review issues
    - reran all ten mapped `P2` imported issue-id commands above with `--status open --no-budget --top 20`; each returned no open issues
    - `desloppify show test_coverage::src/core/channel-setup/ChannelSetupTagFilters.ts::transitive_only --status open --no-budget --top 20` still reports transitive-only wording, but current source has direct coverage (`src/core/channel-setup/__tests__/ChannelSetupTagFilters.test.ts`) for parser/fallback/malformed behavior
    - `desloppify show smells::src/core/channel-setup/ChannelSetupTagFilters.ts::hardcoded_url --status open --no-budget --top 20` reports one open smell at line 38 (`new URL(fastKey, 'http://localhost')`)
    - `desloppify status` refreshed (`overall 83.2 / strict 83.2 / objective 94.9 / verified 94.9`)
    - `desloppify plan queue --sort recent` refreshed (`Queue: 1 item (51 planned · 1 subjective)`)
    - `npm run verify` passed
  - Follow-ups:
    - `followup::p2-exit::channel-setup-tagfilters-transitive-only-detector-residue`
      owner: `P10-W1 detector-contract cleanup owner`
      reason: detector issue `test_coverage::src/core/channel-setup/ChannelSetupTagFilters.ts::transitive_only` is stale wording after direct source-proof tests; imported review issue `review::.::holistic::test_strategy::fastkey_filter_parser_untested` is resolved on current code.
      revisit trigger: rerun `desloppify scan --path .` + `desloppify show test_coverage::src/core/channel-setup/ChannelSetupTagFilters.ts::transitive_only --status open --no-budget --top 20` at `P10-W1` entry and before `P10-EXIT`; if unchanged with the same direct test file coverage, keep as detector-contract residue or escalate upstream with minimal repro.
    - `followup::p2-exit::channel-setup-tagfilters-hardcoded-url-residue`
      owner: `P10-W1 residual mechanical detector owner`
      reason: `desloppify show smells::src/core/channel-setup/ChannelSetupTagFilters.ts::hardcoded_url --status open --no-budget --top 20` reports one remaining non-imported mechanical smell (`hardcoded_url`) in `ChannelSetupTagFilters.ts`.
      revisit trigger: rerun `desloppify scan --path .` + `desloppify show smells::src/core/channel-setup/ChannelSetupTagFilters.ts::hardcoded_url --status open --no-budget --top 20` at `P10-W1` entry and before `P10-EXIT`, then disposition as detector-contract residue vs intentional local parse-base URL usage with explicit evidence.

- [ ] `P3-EXIT`
  - required: record every mapped imported issue with an exact disposition
  - run the priority-exit review before moving to `P4`
  - refresh every `P3` issue id, the `P3` detector envelopes, `desloppify status`, `desloppify plan queue`, and `npm run verify`
  - confirm one single final owner for any `P3` issue that still needs a follow-up

- [ ] `P4-EXIT`
  - required: record every mapped imported issue with an exact disposition
  - run the priority-exit review before moving to `P5`
  - refresh every `P4` issue id, the `P4` detector envelopes, `desloppify status`, `desloppify plan queue`, and `npm run verify`
  - confirm one single final owner for any `P4` issue that still needs a follow-up

- [ ] `P5-EXIT`
  - required: record every mapped imported issue with an exact disposition
  - run the priority-exit review before moving to `P6`
  - refresh every `P5` issue id, the `P5` detector envelopes, `desloppify status`, `desloppify plan queue`, and `npm run verify`
  - confirm one single final owner for any `P5` issue that still needs a follow-up

- [ ] `P6-EXIT`
  - required: record every mapped imported issue with an exact disposition
  - run the priority-exit review before moving to `P7`
  - refresh every `P6` issue id, the `P6` detector envelopes, `desloppify status`, `desloppify plan queue`, and `npm run verify`
  - confirm one single final owner for any `P6` issue that still needs a follow-up

- [ ] `P7-EXIT`
  - required: record every mapped imported issue with an exact disposition
  - run the priority-exit review before moving to `P8`
  - refresh every `P7` issue id, the `P7` detector envelopes, `desloppify status`, `desloppify plan queue`, and `npm run verify`
  - confirm one single final owner for any `P7` issue that still needs a follow-up

- [ ] `P8-EXIT`
  - required: record every mapped imported issue with an exact disposition
  - run the priority-exit review before moving to `P9`
  - refresh every `P8` issue id, the `P8` detector envelopes, `desloppify status`, `desloppify plan queue`, `npm run verify`, and `npm run verify:docs`
  - confirm one single final owner for any `P8` issue that still needs a follow-up

- [ ] `P9-EXIT`
  - required: record every mapped imported issue with an exact disposition and the final detector-only test debt that remains, if any
  - run the priority-exit review before moving to `P10`
  - refresh every `P9` issue id, the `P9` detector envelopes, `desloppify status`, `desloppify plan queue`, and the strongest test verification used by the closing slice
  - confirm one single final owner for any `P9` issue or residual detector debt that still needs a follow-up

## Priority 0: Restore Queue Trust Before Chasing Score

### [x] `P0-W1` Scan Scope And Generated-Output Policy

**Goal:** lock the scan contract so later score movement is meaningful.

**Required outcomes:**

- Reconfirm the approved excludes remain:
  - `.desloppify`
  - `.git`
  - `.worktrees`
  - `.agent`
  - `.agents`
  - `.codex/cache`
  - `node_modules`
  - `dist`
  - `.codanna/index`
  - `.mcp_sequential_thinking`
  - `docs/_local`
- Decide whether `dist-ts/` is in-scope source-of-truth build output or generated output that should be excluded from future scans.
- If `dist-ts/` is excluded, rerun from a clean state and update this checklist in the same pass.
- If `dist-ts/` remains in scope, keep its `facade` findings mapped under `P3` and `P10`.

**Authoritative commands:**

- `desloppify show stale_exclude --status open --no-budget --top 50`
- `desloppify show facade --status open --no-budget --top 50`
- `rg -n "outDir|dist-ts" tsconfig.json tsconfig.eslint.json`

**Exit rule:** no ambiguity remains about whether `dist-ts/` belongs in the cleanup backlog.

- Status: completed
- Plan: `docs/plans/2026-04-10-p0-queue-trust-and-scan-contract.md`
- Last touched: `2026-04-10`
- Verification: `rg -n "outDir|dist-ts" tsconfig.json tsconfig.eslint.json .gitignore eslint.config.js stylelint.config.cjs package.json` confirmed `dist-ts` as compiler/tool-generated output; `git ls-files dist-ts` returned no tracked files; `desloppify scan --path .` reran with `dist-ts` in exclude list; `desloppify show stale_exclude --status open --no-budget --top 50` reported expected local-state excludes.
- Follow-ups: `desloppify show facade --status open --no-budget --top 50` still reports `facade::dist-ts/**` residue despite exclusion; classify and carry in `P0-EXIT`.
- Handoff: `P0-W2 queue-surface repro and operating rule`

### [x] `P0-W2` Queue-Surface Consistency And Tooling Trust

**Goal:** resolve or explicitly record the mismatch between `status`, `plan queue`, and `next`.

**Required outcomes:**

- Reproduce the mismatch on current state.
- Determine whether the stray subjective queue item is real, stale state, or a tool bug.
- Determine whether the stray subjective queue item reflects repo-side persisted subjective state, by-design queue semantics, or a true tool bug.
- If it is repo-state driven, fix the repo-side cause.
- If it is a `desloppify` bug, capture a minimal repro and keep this checklist honest about the remaining tool inconsistency.

**Authoritative commands:**

- `desloppify status`
- `desloppify next`
- `desloppify plan queue --sort recent`
- `desloppify show review --status open --no-budget --top 100`

**Exit rule:** either the queue surfaces agree, or the mismatch is explicitly classified as repo-state cleanup, by-design queue semantics, or upstream tooling inconsistency with a clear local operating rule.

- Status: completed
- Plan: `docs/plans/2026-04-10-p0-queue-trust-and-scan-contract.md`
- Last touched: `2026-04-10`
- Verification: `desloppify status` reported `Queue: 1 item (51 stale tracked · 1 subjective)`; `desloppify next` reported `Queue: 0 items`; `desloppify plan queue --sort recent` reported `Queue: 1 item (51 planned · 1 subjective)`; `desloppify show review --status open --no-budget --top 100` confirmed review backlog context; `rg -n "subjective|queue|active_cluster|queue_order" .desloppify/plan.json .desloppify/state-typescript.json .desloppify/query.json` plus direct reads confirmed persisted subjective state (`queue_order`, `subjective::unscored`, `sync_subjective`, `subjective_assessments`, `dependency_health: 94.0`, `subjective_integrity.status: "disabled"`).
- Follow-ups: documented by-design queue semantics; operating rule is `desloppify next` as implementation-start surface, while `desloppify status`/`desloppify plan queue` are broader awareness surfaces that include subjective reminders.
- Handoff: `P0-EXIT closeout rerun`

## Priority 1: Narrow Runtime Composition Roots And Orchestrator Ownership

### [x] `P1-W1` Break The Orchestrator Monolith Into Narrower Owners

**Mapped imported review issues:**

- `review::.::holistic::cross_module_architecture::orchestrator_runtime_hub`
- `review::.::holistic::design_coherence::orchestrator_monolith_boundary`
- `review::.::holistic::high_level_elegance::composition_root_role_drift`
- `review::.::holistic::package_organization::root_orchestrator_straggler`

**Primary files:**

- `src/Orchestrator.ts`
- `src/App.ts`
- `src/core/orchestrator/OrchestratorCoordinatorFactory.ts`
- `src/core/orchestrator/OrchestratorModuleFactory.ts`
- `src/core/app-shell/AppLazyScreenPortFactory.ts`

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show src/Orchestrator.ts --status open --no-budget --top 100`
- `desloppify show src/core/orchestrator --status open --no-budget --top 100`
- `desloppify show logs --status open --no-budget --top 50`
- `desloppify show structural --status open --no-budget --top 150`

**Exit rule:** `Orchestrator` is no longer the implicit final owner for runtime wiring, persistence helpers, and feature coordination.

- Status: completed
- Plan: `docs/plans/2026-04-10-p1-w1-orchestrator-owner-decomposition.md`
- Last touched: `2026-04-10`
- Verification:
  - `npm run verify` passed
  - `npm run verify:docs` passed
  - `npm run plans:check` failed on pre-existing unrelated active-plan conformance gaps (no new P1-W1 regression)
  - `desloppify scan --path .` completed on integration branch
  - `desloppify show "review::.::holistic::cross_module_architecture::orchestrator_runtime_hub" --status open --no-budget --top 20` still open with stale pre-move evidence text
  - `desloppify show "review::.::holistic::design_coherence::orchestrator_monolith_boundary" --status open --no-budget --top 20` still open with stale pre-move evidence text
  - `desloppify show "review::.::holistic::high_level_elegance::composition_root_role_drift" --status open --no-budget --top 20` still open with stale pre-move evidence text
  - `desloppify show "review::.::holistic::package_organization::root_orchestrator_straggler" --status open --no-budget --top 20` still open with stale pre-move evidence text
  - `desloppify show src/Orchestrator.ts --status open --no-budget --top 100` reports stale legacy line references while source is now a thin barrel
  - `desloppify show src/core/orchestrator --status open --no-budget --top 100` shows live orchestrator/factory/binder/log residue aligned with `P1-W2` ownership envelope
  - `desloppify show logs --status open --no-budget --top 50` shows no new P1-W1-specific log class beyond expected orchestrator-family entries already mapped to P1
  - `desloppify show structural --status open --no-budget --top 150` returned `No open issues matching: structural`
- Follow-ups:
  - imported review-id text for the four `P1-W1` issue ids remains stale after current-code move; treat as stale detector wording, not live ownership reversal
  - `P1-W2` remains the single next owner before `P1-EXIT` for factory/binder callback-bag and cleanup-failure seams (`review::.::holistic::low_level_elegance::orchestrator_factory_wrapper_sprawl`, `review::.::holistic::mid_level_elegance::orchestrator_factory_callback_bag`, `review::.::holistic::error_consistency::orchestrator_cleanup_failures_disappear`)
- Handoff: `Run P1-W2 implementation/review, then perform P1-EXIT reconciliation with a fresh imported-review evidence pass`

### [x] `P1-W2` Replace Wrapper Walls And Callback Bags With Focused Runtime Seams

**Mapped imported review issues:**

- `review::.::holistic::low_level_elegance::orchestrator_factory_wrapper_sprawl`
- `review::.::holistic::mid_level_elegance::orchestrator_factory_callback_bag`
- `review::.::holistic::error_consistency::orchestrator_cleanup_failures_disappear`

**Primary files:**

- `src/core/orchestrator/OrchestratorCoordinatorFactory.ts`
- `src/core/orchestrator/OrchestratorEventBinder.ts`
- any new focused seam types or collaborators created by the companion plan

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show src/core/orchestrator/OrchestratorCoordinatorFactory.ts --status open --no-budget --top 50`
- `desloppify show src/core/orchestrator/OrchestratorEventBinder.ts --status open --no-budget --top 50`
- `desloppify show smells --status open --no-budget --top 250`

**Exit rule:** coordinator assembly no longer depends on ad hoc callback bags and cleanup failures do not disappear silently.

- Status: completed
- Plan: `docs/plans/2026-04-10-p1-w2-runtime-seams-and-cleanup-reporting.md` (local-untracked draft by explicit maintainer request; no tracked plan-doc commit for this slice)
- Last touched: `2026-04-10`
- Verification:
  - `npm test -- --runInBand src/__tests__/orchestrator/event-wiring.test.ts src/__tests__/Orchestrator.test.ts` passed
  - `npm test -- --runInBand src/core/orchestrator/__tests__/OrchestratorPriorityOneControllerFactory.playbackState.test.ts src/__tests__/orchestrator/event-wiring.test.ts src/__tests__/Orchestrator.test.ts` passed
  - `npm test -- --runInBand src/core/orchestrator/__tests__/OrchestratorCoordinatorFactory.playbackState.test.ts src/core/orchestrator/__tests__/OrchestratorPriorityOneControllerFactory.playbackState.test.ts src/__tests__/orchestrator/event-wiring.test.ts src/__tests__/Orchestrator.test.ts` passed
  - `npm run typecheck` passed
  - `npm run verify` passed
  - `npm run verify:docs` passed
  - `desloppify scan --path .` completed on integration branch
  - `desloppify show src/core/orchestrator/OrchestratorCoordinatorFactory.ts --status open --no-budget --top 50` still reports smells::`monster_function`, `high_cyclomatic_complexity`, and `nested_closure` in `createOrchestratorCoordinators` (current detector residue to reconcile at `P1-EXIT`)
  - `desloppify show src/core/orchestrator/OrchestratorEventBinder.ts --status open --no-budget --top 50` still reports logs::`[Orchestrator]` plus smells::`console_error_no_throw` (current detector residue to reconcile at `P1-EXIT`)
  - `desloppify show smells --status open --no-budget --top 250` reports no additional new `P1-W2`-scoped imported review regressions
  - `desloppify show "review::.::holistic::low_level_elegance::orchestrator_factory_wrapper_sprawl" --status open --no-budget --top 20` returned no open issues
  - `desloppify show "review::.::holistic::mid_level_elegance::orchestrator_factory_callback_bag" --status open --no-budget --top 20` returned no open issues
  - `desloppify show "review::.::holistic::error_consistency::orchestrator_cleanup_failures_disappear" --status open --no-budget --top 20` returned no open issues
  - `desloppify show logs --status open --no-budget --top 50` still shows orchestrator-family tagged logs including `OrchestratorEventBinder.ts` line 121 and `AppOrchestrator.ts` lines 976/1138/1853
  - `desloppify status` shows `overall 83.2 / strict 83.2 / objective 95.1 / verified 95.1`
  - `desloppify plan queue` shows 1 live subjective item and 51 planned stale tracked items
- Follow-ups:
  - imported review ids owned by `P1-W2` are resolved in detector output (`orchestrator_factory_wrapper_sprawl`, `orchestrator_factory_callback_bag`, `orchestrator_cleanup_failures_disappear`)
  - remaining orchestrator-family smell/log detector residue should be dispositioned in `P1-EXIT` with current-code proof and single-owner mapping before any `P2` work
  - plan-doc tracking waiver is intentional for this slice: maintainer requested no plan-doc commits to avoid repository noise from large transient plan artifacts
- Handoff: `P1-EXIT complete; begin P2-W1 as the next cleanup owner`

## Priority 2: Rebuild Channel Setup Around Explicit Owners And Contracts

### [x] `P2-W1` Remove Wrapper Duplication And Planning-Service Misuse

**Mapped imported review issues:**

- `review::.::holistic::abstraction_fitness::channel_setup_wrapper_chain`
- `review::.::holistic::abstraction_fitness::planning_service_used_as_normalizer`
- `review::.::holistic::mid_level_elegance::channel_setup_port_mixed_absence_contract`

**Primary files:**

- `src/core/channel-setup/createChannelSetupWorkflowPort.ts`
- `src/core/channel-setup/ChannelSetupCoordinator.ts`
- `src/core/channel-setup/ChannelSetupRecordStore.ts`
- `src/core/orchestrator/OrchestratorCoordinatorFactory.ts`

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show src/core/channel-setup --status open --no-budget --top 150`
- `desloppify show src/core/orchestrator --status open --no-budget --top 100`

**Exit rule:** channel setup no longer uses duplicate forwarders or heavyweight services where narrow pure helpers are enough.

- Status: completed
- Plan: `docs/plans/2026-04-13-p2-w1-channel-setup-workflow-contract-and-normalization.md`
- Last touched: `2026-04-13`
- Verification:
  - `npm test -- --runInBand src/core/channel-setup/__tests__/ChannelSetupWorkflow.test.ts src/core/channel-setup/__tests__/ChannelSetupCompletionTracker.test.ts src/core/channel-setup/__tests__/ChannelSetupCoordinator.test.ts src/core/channel-setup/__tests__/ChannelSetupRecordStore.test.ts src/core/channel-setup/__tests__/createChannelSetupWorkflowPort.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts src/__tests__/Orchestrator.test.ts` passed
  - `npm run verify` passed
  - `desloppify scan --path .` completed on integration branch; scan reported `security: clean`, `overall 83.2 / strict 83.2 / objective 95.2 / verified 95.2`, and `+2 new / -20 resolved`
  - `desloppify show "review::.::holistic::abstraction_fitness::channel_setup_wrapper_chain" --status open --no-budget --top 20` returned no open issues
  - `desloppify show "review::.::holistic::abstraction_fitness::planning_service_used_as_normalizer" --status open --no-budget --top 20` returned no open issues
  - `desloppify show "review::.::holistic::mid_level_elegance::channel_setup_port_mixed_absence_contract" --status open --no-budget --top 20` returned no open issues
  - `desloppify show src/core/channel-setup --status open --no-budget --top 150` still reports live non-`P2-W1` residue in `ChannelSetupBuildCommitter.ts`, `ChannelSetupBuildExecutor.ts`, `ChannelSetupTagFilters.ts`, `ChannelSetupPlanningService.ts`, and `ChannelSetupPlanner.ts`
  - `desloppify show src/core/orchestrator --status open --no-budget --top 100` still reports broader orchestrator-family residue, including legacy/stale cycle and factory smell detector output unrelated to the resolved `P2-W1` contract slice
- Issue dispositions:
  - `review::.::holistic::abstraction_fitness::channel_setup_wrapper_chain` -> `resolved` -> owner `P2-W1`; proof: `createChannelSetupWorkflowPort` now forwards workflow operations through `ChannelSetupWorkflow`, `ChannelSetupWorkflow.createChannelsFromSetup()` stays build-only, `markSetupComplete()` stays explicit, and `ChannelSetupCoordinator` is narrowed to rerun / should-run / cleanup duties
  - `review::.::holistic::abstraction_fitness::planning_service_used_as_normalizer` -> `resolved` -> owner `P2-W1`; proof: config normalization now lives in `src/core/channel-setup/normalizeChannelSetupConfig.ts` and is reused by `ChannelSetupBuildExecutor`, `ChannelSetupPlanningService`, and `ChannelSetupRecordStore`
  - `review::.::holistic::mid_level_elegance::channel_setup_port_mixed_absence_contract` -> `resolved` -> owner `P2-W1`; proof: `createChannelSetupWorkflowPort` now throws one consistent initialization error for operational methods while preserving total query reads for diagnostics/UI callers
- Follow-ups:
  - current-code correction for the stale primary-file note: the former `src/core/orchestrator/OrchestratorCoordinatorFactory.ts` assembly reference is no longer the active seam for this cleanup; the shared channel-setup assembly now lives across `src/core/orchestrator/OrchestratorCoordinatorBuilders.ts`, `src/core/orchestrator/OrchestratorCoordinatorAssembly.ts`, `src/core/orchestrator/OrchestratorCoordinatorContracts.ts`, and `src/core/orchestrator/AppOrchestrator.ts`
  - `P2-W2` remains the next explicit owner for the remaining owner-boundary/runtime seams in this area (`review::.::holistic::cross_module_architecture::channel_setup_raw_storage_seam`, `review::.::holistic::design_coherence::channel_setup_session_controller_mixed_state_and_io`, `review::.::holistic::design_coherence::channel_setup_snapshot_loader_overloaded`, `review::.::holistic::high_level_elegance::channel_setup_domain_placement_blur`)
  - `P2-W3` remains the next explicit owner for the remaining error/test/migration cleanup in this area (`review::.::holistic::error_consistency::channel_setup_plain_object_throw`, `review::.::holistic::incomplete_migration::playback_variant_rename_still_leaks_legacy_key`, `review::.::holistic::test_strategy::fastkey_filter_parser_untested`)
- Handoff: `P2-W1 complete; continue with P2-W2 for owner-boundary and snapshot-loading cleanup`

### [x] `P2-W2` Split Channel Setup Owner Boundaries And Snapshot Loading

**Mapped imported review issues:**

- `review::.::holistic::cross_module_architecture::channel_setup_raw_storage_seam`
- `review::.::holistic::design_coherence::channel_setup_session_controller_mixed_state_and_io`
- `review::.::holistic::design_coherence::channel_setup_snapshot_loader_overloaded`
- `review::.::holistic::high_level_elegance::channel_setup_domain_placement_blur`

**Primary files:**

- `src/modules/ui/channel-setup/ChannelSetupSessionController.ts`
- `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
- `src/core/channel-setup/ChannelSetupPlanningService.ts`
- `src/core/channel-setup/ChannelSetupBuildCommitter.ts`
- `src/core/channel-setup/index.ts`

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show src/modules/ui/channel-setup --status open --no-budget --top 200`
- `desloppify show src/core/channel-setup --status open --no-budget --top 200`
- `desloppify show responsibility_cohesion --status open --no-budget --top 50`

**Exit rule:** UI session control, persistence, planning, and build execution have explicit seams and no raw-storage leakage across owners.

- Status: completed
- Plan: `docs/plans/2026-04-13-p2-w2-channel-setup-owner-boundaries-and-snapshot-loading.md`
- Last touched: `2026-04-13`
- Verification:
  - `npm test -- --runInBand src/core/channel-setup/__tests__/ChannelSetupBuildScratchStore.test.ts src/core/channel-setup/__tests__/ChannelSetupBuildCommitter.test.ts src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts src/core/channel-setup/__tests__/ChannelSetupRecordStore.test.ts src/core/channel-setup/__tests__/ChannelSetupCoordinator.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts src/__tests__/Orchestrator.test.ts` passed
  - `npm run verify` passed
- Issue dispositions:
  - `review::.::holistic::cross_module_architecture::channel_setup_raw_storage_seam` -> `resolved` -> owner `P2-W2`; proof: temp build-key lifecycle moved to `ChannelSetupBuildScratchStore`, `ChannelSetupBuildCommitter` consumes typed scratch-store APIs, and `ChannelSetupRecordStore` no longer owns build-scratch cleanup
  - `review::.::holistic::design_coherence::channel_setup_session_controller_mixed_state_and_io` -> `resolved` -> owner `P2-W2`; proof: `ChannelSetupSessionController` is now a facade over `ChannelSetupSessionState` and `ChannelSetupSessionRuntime`
  - `review::.::holistic::design_coherence::channel_setup_snapshot_loader_overloaded` -> `resolved` -> owner `P2-W2`; proof: facet snapshot loading moved into `ChannelSetupFacetSnapshotLoader.ts` and remains an internal `ChannelSetupPlanningService` collaborator
  - `review::.::holistic::high_level_elegance::channel_setup_domain_placement_blur` -> `resolved` -> owner `P2-W2`; proof: storage/planning/ui-session responsibilities now map to explicit owners (`ChannelSetupRecordStore`, `ChannelSetupBuildScratchStore`, `ChannelSetupPlanningService` + internal loader, `ChannelSetupSessionState`, `ChannelSetupSessionRuntime`) with `ChannelSetupWorkflowPort` unchanged
- Follow-ups:
  - `P2-W3` remains the next owner for error-consistency/migration/test cleanup only (`channel_setup_plain_object_throw`, `playback_variant_rename_still_leaks_legacy_key`, `fastkey_filter_parser_untested`)
  - no residual `P2-W2` owner-boundary debt was carried forward because current code did not prove a different final owner
- Handoff: `P2-W2 complete; continue with P2-W3 for error/migration/test cleanup`

### [x] `P2-W3` Normalize Channel Setup Errors, Migration Residue, And Tests

**Mapped imported review issues:**

- `review::.::holistic::error_consistency::channel_setup_plain_object_throw`
- `review::.::holistic::incomplete_migration::playback_variant_rename_still_leaks_legacy_key`
- `review::.::holistic::test_strategy::fastkey_filter_parser_untested`

**Primary files:**

- `src/core/channel-setup/ChannelSetupPlanningService.ts`
- `src/core/channel-setup/ChannelSetupTagFilters.ts`
- `src/core/channel-setup/ChannelSetupPlanner.ts`
- `src/modules/scheduler/channel-manager/ChannelRepository.ts`
- `src/modules/scheduler/channel-manager/ChannelManager.ts`
- `src/modules/scheduler/channel-manager/StoredChannelDataCodec.ts`

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show src/core/channel-setup/ChannelSetupTagFilters.ts --status open --no-budget --top 50`
- `desloppify show test_coverage --status open --no-budget --top 100`

**Exit rule:** channel setup throws typed errors, the playback-variant rename is truly canonical, and fastKey filtering is directly covered by tests.

- Status: completed
- Plan: `docs/plans/2026-04-13-p2-w3-channel-setup-error-canonicalization-and-test-closure.md`
- Last touched: `2026-04-13`
- Verification:
  - `npm test -- --runInBand src/modules/scheduler/channel-manager/__tests__/StoredChannelDataCodec.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelRepository.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts` passed
  - `npm test -- --runInBand src/core/channel-setup/__tests__/ChannelSetupTagFilters.test.ts src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoader.test.ts src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts src/core/channel-setup/__tests__/ChannelSetupPlanner.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelRepository.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts` passed
  - `npm run verify` passed
  - `rg -n "isSequentialVariant|throw \\{" src/core/channel-setup src/modules/scheduler/channel-manager --glob '!dist-ts'` now shows `isSequentialVariant` only in explicit legacy-strip helpers (`ChannelRepository`, `ChannelManager`, `StoredChannelDataCodec`) plus tests; no compatibility migration/rewrite branch remains and no implementation raw `throw {` residue
  - `desloppify scan --profile ci --skip-slow` reran integration-branch detector state before reconciliation
  - `desloppify show review --status open --no-budget --top 100` returned `No open issues matching: review`; detector review-id silence treated as supporting-only evidence
- `desloppify show src/core/channel-setup/ChannelSetupTagFilters.ts --status open --no-budget --top 50` and `desloppify show test_coverage --status open --no-budget --top 100` still report `test_coverage::src/core/channel-setup/ChannelSetupTagFilters.ts::transitive_only` despite the new direct test file; that detector/source mismatch was reconciled in `P2-EXIT` and should only be carried forward if a fresh rerun still contradicts the direct source proof
- Issue dispositions:
  - `review::.::holistic::error_consistency::channel_setup_plain_object_throw` -> `resolved` -> owner `P2-W3`; proof: `ChannelSetupFacetSnapshotLoader` now throws `ChannelSetupPlanningError` via `assertRecoveredTagCount`, boundary-local `ChannelSetupFacetSnapshotLoader.test.ts` asserts typed discriminator, and raw object throw source-audit is clear
  - `review::.::holistic::incomplete_migration::playback_variant_rename_still_leaks_legacy_key` -> `resolved` -> owner `P2-W3`; proof: `createChannelIdentityKey()` serializes `isPlaybackModeVariant`, import rewrite compatibility was removed, load boundary strips legacy `isSequentialVariant`, save codec strips legacy fields on encode, and `ChannelManager` load/export/save tests prove legacy fields do not survive runtime/exported/persisted channel objects
  - `review::.::holistic::test_strategy::fastkey_filter_parser_untested` -> `resolved on current-code proof` -> owner `P2-W3`; proof: direct `ChannelSetupTagFilters.test.ts` covers parser/fallback/malformed behavior; detector still labels transitive-only after rescan, so `P2-EXIT` must treat this as stale detector wording unless a new live owner is proven
- Follow-ups:
  - `P3-W1` completed; `P3-W2` is now the next planned Priority 3 gate after the completed Priority 2 exit review
  - carry the stale `test_coverage::src/core/channel-setup/ChannelSetupTagFilters.ts::transitive_only` detector wording into `P3` planning only if a fresh rerun still contradicts the direct test source proof
- Handoff: `P2 complete on current integration-branch evidence; execute P3-W2 planning/implementation next`

## Priority 3: Rebound EPG And UI Package Surfaces

### [x] `P3-W1` Stop Core From Depending On UI-Owned EPG Internals

**Mapped imported review issues:**

- `review::.::holistic::cross_module_architecture::core_depends_on_ui_helpers`
- `review::.::holistic::high_level_elegance::epg_public_surface_blur`
- `review::.::holistic::convention_outlier::overlay-barrel-policy-inconsistent`

**Primary files:**

- `src/core/initialization/InitializationStartupPolicy.ts`
- `src/modules/ui/epg/index.ts`
- `src/modules/ui/epg/view/index.ts`
- `src/modules/ui/common/appShellContainerIds.ts`
- affected overlay package `index.ts` files

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show facade --status open --no-budget --top 50`
- `desloppify show src/modules/ui --status open --no-budget --top 200`

**Exit rule:** core consumes bounded feature seams, not UI-private helpers or accidental barrels.

- Status: completed
- Plan: `docs/plans/2026-04-13-p3-w1-epg-core-boundary-and-package-surfaces.md`
- Last touched: `2026-04-13`
- Verification:
  - `npm test -- src/modules/ui/epg/__tests__/buildEpgStartupConfig.test.ts src/core/__tests__/InitializationCoordinator.test.ts` passed
  - `npm test -- src/modules/ui/epg/__tests__/index.test.ts src/modules/ui/epg/view/__tests__/index.test.ts src/core/orchestrator/__tests__/ScheduleDayRolloverController.test.ts src/core/orchestrator/__tests__/OrchestratorCoordinatorFactory.playbackState.test.ts src/__tests__/Orchestrator.test.ts` passed
  - `npm test -- src/modules/ui/__tests__/overlay-package-surfaces.test.ts src/core/orchestrator/__tests__/OrchestratorCoordinatorFactory.playbackState.test.ts src/__tests__/Orchestrator.test.ts` passed
  - `npm run verify` passed
  - `npm run verify:docs` passed
  - `desloppify show "review::.::holistic::cross_module_architecture::core_depends_on_ui_helpers" --status open --no-budget` returned `No open issues matching`
  - `desloppify show "review::.::holistic::high_level_elegance::epg_public_surface_blur" --status open --no-budget` returned `No open issues matching`
  - `desloppify show "review::.::holistic::convention_outlier::overlay-barrel-policy-inconsistent" --status open --no-budget` returned `No open issues matching`
  - `desloppify show facade --status open --no-budget --top 50` still reports one non-mapped residual (`facade::src/modules/ui/epg/runtime/index.ts`)
  - `desloppify show src/modules/ui --status open --no-budget --top 200` reports open UI debt outside the three mapped `P3-W1` imported ids
- Proof matrix:
  - `review::.::holistic::cross_module_architecture::core_depends_on_ui_helpers`
    - slice-owned rationale retired on current source: yes
    - live residual debt remains: no (for this imported id)
    - detector wording stale: no
    - final owner: `P3-W1` (resolved)
    - revisit trigger: none
  - `review::.::holistic::high_level_elegance::epg_public_surface_blur`
    - slice-owned rationale retired on current source: yes
    - live residual debt remains: no (for this imported id)
    - detector wording stale: no
    - final owner: `P3-W1` (resolved)
    - revisit trigger: none
  - `review::.::holistic::convention_outlier::overlay-barrel-policy-inconsistent`
    - slice-owned rationale retired on current source: yes
    - live residual debt remains: no (for this imported id)
    - detector wording stale: no
    - final owner: `P3-W1` (resolved)
    - revisit trigger: none
- Follow-ups:
  - non-mapped residual `facade::src/modules/ui/epg/runtime/index.ts` remains under Priority 3 cleanup scope and should be handled in `P3-W2`/`P3-EXIT` evidence reconciliation
- Handoff: `P3-W2` is now the next safe start for Priority 3 package-shape/naming closeout

### [ ] `P3-W2` Reshape The EPG Package And Naming Surface

**Mapped imported review issues:**

- `review::.::holistic::naming_quality::epg_acronym_casing_drift`
- `review::.::holistic::package_organization::epg_root_flat_overload`

**Primary files:**

- `src/modules/ui/epg/`
- `src/core/orchestrator/OrchestratorCoordinatorFactory.ts`
- any moved EPG subpackages created by the companion plan

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show src/modules/ui/epg --status open --no-budget --top 250`
- `desloppify show flat_dirs --status open --no-budget --top 50`
- `desloppify show naming --status open --no-budget --top 50`

**Exit rule:** EPG code is grouped by real ownership and the acronym casing is canonical across the public surface.

## Priority 4: Simplify Lifecycle, Navigation, Initialization, And App-Owned Startup Seams

### [ ] `P4-W1` Collapse Ceremony Around Lifecycle And Navigation Contracts

**Mapped imported review issues:**

- `review::.::holistic::abstraction_fitness::lifecycle_single_impl_interfaces`
- `review::.::holistic::logic_clarity::redundant_async_forwarders`
- `review::.::holistic::logic_clarity::predicate_ladders_obscure_intent`
- `review::.::holistic::mid_level_elegance::navigation_hidden_store_reads`
- `review::.::holistic::type_safety::generic_navigation_param_bag`

**Primary files:**

- `src/modules/lifecycle/interfaces.ts`
- `src/modules/lifecycle/AppLifecycle.ts`
- `src/modules/lifecycle/StateManager.ts`
- `src/modules/lifecycle/ErrorRecovery.ts`
- `src/modules/navigation/NavigationCoordinator.ts`
- `src/modules/navigation/NavigationManager.ts`
- `src/modules/navigation/interfaces.ts`

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show src/modules/lifecycle --status open --no-budget --top 100`
- `desloppify show src/modules/navigation --status open --no-budget --top 150`
- `desloppify show responsibility_cohesion --status open --no-budget --top 50`

**Exit rule:** lifecycle and navigation surfaces only keep abstractions that buy real polymorphism or ownership clarity.

### [ ] `P4-W2` Move Startup And Theme State Into App-Owned Seams

**Mapped imported review issues:**

- `review::.::holistic::initialization_coupling::theme_manager_singleton_ordering`
- `review::.::holistic::package_organization::core_misc_bucket`
- `review::.::holistic::test_strategy::startup_ui_initializer_untested`

**Primary files:**

- `src/modules/ui/theme/ThemeManager.ts`
- `src/App.ts`
- `src/core/initialization/InitializationUiInitializer.ts`
- `src/core/InitializationCoordinator.ts`
- `src/core/index.ts`

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show src/core/initialization --status open --no-budget --top 100`
- `desloppify show src/core --status open --no-budget --top 100`
- `desloppify show test_coverage --status open --no-budget --top 100`

**Exit rule:** startup UI initialization and theme state are app-owned and directly testable, not hidden behind global singletons or catch-all `core` buckets.

## Priority 5: Unify Storage And Settings Contracts

### [ ] `P5-W1` Normalize Storage Write Contracts

**Mapped imported review issues:**

- `review::.::holistic::api_surface_coherence::storage_write_contract_fragmentation`

**Primary files:**

- `src/utils/storage.ts`
- `src/modules/scheduler/channel-manager/ChannelPersistenceStore.ts`
- `src/modules/settings/EpgPreferencesStore.ts`

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show src/utils/storage.ts --status open --no-budget --top 50`
- `desloppify show src/modules/settings --status open --no-budget --top 100`

**Exit rule:** all public storage writes use one consistent failure contract per boundary.

### [ ] `P5-W2` Separate Read Semantics From Cleanup Writes

**Mapped imported review issues:**

- `review::.::holistic::contract_coherence::read-apis-hide-cleanup-writes`

**Primary files:**

- `src/modules/plex/discovery/ServerSelectionStore.ts`
- `src/modules/settings/EpgPreferencesStore.ts`
- `src/modules/settings/PlaybackSettingsStore.ts`
- `src/modules/plex/auth/PlexAuth.ts`
- `src/modules/plex/auth/interfaces.ts`

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show src/modules/settings --status open --no-budget --top 100`
- `desloppify show src/modules/plex/discovery --status open --no-budget --top 100`
- `desloppify show src/modules/plex/auth --status open --no-budget --top 100`

**Exit rule:** read APIs do not hide cleanup writes behind plain accessor names.

## Priority 6: Normalize Plex Auth, Discovery, Library, And Shared Type Surfaces

### [ ] `P6-W1` Normalize Plex Auth Parsers And Fetch Contracts

**Mapped imported review issues:**

- `review::.::holistic::api_surface_coherence::parse_home_users_overloaded_payload_entrypoint`
- `review::.::holistic::api_surface_coherence::plex_fetch_helper_shape_drift`
- `review::.::holistic::authorization_consistency::restricted_profile_flag_unused`
- `review::.::holistic::contract_coherence::plexauth-validate-token-error-contract`

**Primary files:**

- `src/modules/plex/auth/helpers.ts`
- `src/modules/plex/auth/PlexAuth.ts`
- `src/modules/plex/auth/interfaces.ts`
- `src/modules/plex/shared/fetchWithTimeout.ts`
- `src/modules/ui/profile-select/ProfileSelectScreen.ts`

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show src/modules/plex/auth --status open --no-budget --top 150`
- `desloppify show src/modules/plex/shared --status open --no-budget --top 100`
- `desloppify show src/modules/plex/discovery --status open --no-budget --top 100`

**Exit rule:** Plex auth and fetch helpers have one coherent error and payload contract, and profile restriction metadata has an explicit product policy.

### [ ] `P6-W2` Remove Hidden Plex State And Duplicate Library/Type Surfaces

**Mapped imported review issues:**

- `review::.::holistic::convention_outlier::plex-library-type-name-collision`
- `review::.::holistic::initialization_coupling::plex_client_identifier_module_cache`
- `review::.::holistic::naming_quality::generic_plex_utility_file_names`
- `review::.::holistic::type_safety::duplicated_plex_media_type_aliases`

**Primary files:**

- `src/modules/plex/auth/clientIdentifier.ts`
- `src/modules/plex/library/index.ts`
- `src/modules/plex/library/PlexLibrary.ts`
- `src/modules/plex/library/types.ts`
- `src/modules/plex/stream/types.ts`
- `src/modules/scheduler/channel-manager/types.ts`

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show src/modules/plex/library --status open --no-budget --top 150`
- `desloppify show src/modules/plex/stream --status open --no-budget --top 150`
- `desloppify show src/modules/scheduler/channel-manager --status open --no-budget --top 150`

**Exit rule:** Plex shared state and media types are canonicalized across auth, library, stream, and scheduler boundaries.

## Priority 7: Repair Player And Playback Recovery Contracts

### [ ] `P7-W1` Simplify Playback Recovery And Error Propagation

**Mapped imported review issues:**

- `review::.::holistic::ai_generated_debt::nested_defensive_catch_defaults`
- `review::.::holistic::error_consistency::media_session_play_swallow`
- `review::.::holistic::low_level_elegance::playback_recovery_repeated_reload_choreography`
- `review::.::holistic::type_safety::raw_error_code_string_branching`

**Primary files:**

- `src/modules/player/PlaybackRecoveryManager.ts`
- `src/modules/player/VideoPlayer.ts`
- `src/types/app-errors.ts`

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show src/modules/player --status open --no-budget --top 200`
- `desloppify show logs --status open --no-budget --top 50`
- `desloppify show smells --status open --no-budget --top 250`

**Exit rule:** playback recovery stops swallowing collaborator failures and uses canonical app error typing instead of raw string branching.

### [ ] `P7-W2` Normalize Player Public Surface And Migration Residue

**Mapped imported review issues:**

- `review::.::holistic::contract_coherence::videoplayer-setaudiotrack-throw-surface-drift`
- `review::.::holistic::convention_outlier::player-helper-exported-through-class-file`
- `review::.::holistic::incomplete_migration::player_backward_compat_aliases_keep_multiple_canonical_paths_alive`

**Primary files:**

- `src/modules/player/interfaces.ts`
- `src/modules/player/VideoPlayer.ts`
- `src/modules/player/ErrorHandler.ts`
- `src/modules/player/index.ts`
- `src/modules/player/constants.ts`
- `src/modules/ui/playback-options/PlaybackOptionsCoordinator.ts`

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show src/modules/player --status open --no-budget --top 200`
- `desloppify show test_coverage --status open --no-budget --top 100`

**Exit rule:** player public contracts match real behavior and internal callers no longer depend on backward-compat aliasing.

## Priority 8: Remove Diagnostic Noise, Template Ceremony, And Doc Drift

### [ ] `P8-W1` Replace Diagnostic Spam With Bounded Summaries

**Mapped imported review issues:**

- `review::.::holistic::ai_generated_debt::diagnostic_payload_dump_logging`

**Primary files:**

- `src/core/app-shell/AppDiagnosticsSurface.ts`

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show src/core/app-shell --status open --no-budget --top 100`
- `desloppify show logs --status open --no-budget --top 50`

**Exit rule:** diagnostics emit targeted summaries instead of object dumps and table spam.

### [ ] `P8-W2` Remove Template Docblocks And Refresh Architecture Docs

**Mapped imported review issues:**

- `review::.::holistic::ai_generated_debt::templated_docblock_ceremony`
- `review::.::holistic::high_level_elegance::architecture_reference_drift`

**Primary files:**

- `src/modules/plex/auth/helpers.ts`
- `src/modules/player/interfaces.ts`
- `src/modules/player/VideoPlayer.ts`
- `docs/architecture/CURRENT_STATE.md`
- `docs/architecture/modules.md`

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show README.md --status open --no-budget --top 50`
- `npm run verify:docs`

**Exit rule:** architecture docs match runtime ownership and code comments keep only non-obvious contract detail.

## Priority 9: Rebuild Test Seams Instead Of Fighting Them

### [ ] `P9-W1` Remove Private-API Test Coupling

**Mapped imported review issues:**

- `review::.::holistic::test_strategy::private_api_test_coupling`

**Primary files:**

- `src/__tests__/orchestrator/playback-flow.test.ts`
- `src/modules/player/__tests__/SubtitleManager.test.ts`
- `src/__tests__/App.test.ts`

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show signature --status open --no-budget --top 50`
- `desloppify show test_coverage --status open --no-budget --top 100`
- `desloppify show src/__tests__ --status open --no-budget --top 150`

**Exit rule:** tests assert stable public seams instead of private helpers, prototype spying, or brittle internal structure.

### [ ] `P9-W2` Burn Down Remaining Test-Only Detector Debt

**Mapped imported review issues:**

- none; this is the residual detector-only test hardening pass

**Primary detector envelopes:**

- `signature`
- test-only portions of `smells`
- test-only portions of `structural`
- remaining `test_coverage`

**Authoritative commands:**

- `desloppify show signature --status open --no-budget --top 50`
- `desloppify show test_coverage --status open --no-budget --top 100`
- `desloppify show src/__tests__ --status open --no-budget --top 200`
- `desloppify show src/modules --status open --no-budget --top 250`

**Exit rule:** test debt no longer blocks clean refactors or leaves startup/channel-setup/player seams unprotected.

## Priority 10: Residual Detector Burn-Down And Overall Exit

### [ ] `P10-W1` Burn Down Residual Mechanical Detector Envelopes

This pass is intentionally last. Earlier architectural work should retire a large fraction of the current detector backlog automatically.

**Residual detector envelopes to clear or intentionally disposition:**

- `smells`
- `structural`
- `facade`
- `logs`
- `responsibility_cohesion`
- `flat_dirs`
- `single_use`
- `naming`
- `boilerplate_duplication`

**Authoritative commands:**

- `desloppify show smells --status open --no-budget --top 250`
- `desloppify show structural --status open --no-budget --top 150`
- `desloppify show facade --status open --no-budget --top 50`
- `desloppify show logs --status open --no-budget --top 50`
- `desloppify show responsibility_cohesion --status open --no-budget --top 50`
- `desloppify show flat_dirs --status open --no-budget --top 50`
- `desloppify show single_use --status open --no-budget --top 50`
- `desloppify show naming --status open --no-budget --top 50`
- `desloppify show boilerplate_duplication --status open --no-budget --top 50`

**Exit rule:** any residual detector debt is explicit, intentionally owned, and backed by current-code proof rather than stale scan residue.

**Inherited follow-ups from `P1-EXIT` (must be explicitly dispositioned in this work item):**

- `followup::p1-exit::root-orchestrator-detector-residue`
  - required commands: `desloppify scan --path .`; `desloppify show src/Orchestrator.ts --status open --no-budget --top 100`
- `followup::p1-exit::factory-smell-detector-residue`
  - required commands: `desloppify scan --path .`; `desloppify show src/core/orchestrator/OrchestratorCoordinatorFactory.ts --status open --no-budget --top 50`
- `followup::p1-exit::orchestrator-live-log-error-policy-residue`
  - required commands: `desloppify scan --path .`; `desloppify show logs --status open --no-budget --top 50`; `desloppify show src/core/orchestrator/AppOrchestrator.ts --status open --no-budget --top 100`; `desloppify show src/core/orchestrator/OrchestratorEventBinder.ts --status open --no-budget --top 50`
- `followup::p1-exit::orchestrator-cycle-detector-residue`
  - required commands: `desloppify scan --path .`; `desloppify show cycles --status open --no-budget --top 50`

### [ ] `P10-EXIT` Overall Closeout Gate

Do not treat the cleanup wave as complete until all of the following are true on the target integration branch:

- `npm run verify` passes
- `npm run verify:docs` passes
- `desloppify scan --path .` completes cleanly
- `desloppify status` reflects the intended final score state
- `desloppify next`, `desloppify plan queue`, and `desloppify status` agree on remaining queue state, or any surviving mismatch is documented as a tooling defect with a repro
- `desloppify show review --status open --no-budget --top 100` shows either `No open issues matching` or only explicitly deferred issue ids with named owners and revisit triggers
- every mapped imported review issue in this checklist is dispositioned as `resolved`, `deferred`, or `split follow-up`
- any surviving `stale_exclude` warnings are explicitly accepted as approved local-state excludes and do not obscure repo-source debt
- any `dist-ts/` decision has been applied consistently to scan scope, documentation, and the final evidence snapshot
- this checklist has been updated in the same pass with the final score, residual debt, and archive/supersession notes

## Imported Review Issue Map By Priority

### `P1`

- `review::.::holistic::cross_module_architecture::orchestrator_runtime_hub`
- `review::.::holistic::design_coherence::orchestrator_monolith_boundary`
- `review::.::holistic::high_level_elegance::composition_root_role_drift`
- `review::.::holistic::low_level_elegance::orchestrator_factory_wrapper_sprawl`
- `review::.::holistic::mid_level_elegance::orchestrator_factory_callback_bag`
- `review::.::holistic::error_consistency::orchestrator_cleanup_failures_disappear`
- `review::.::holistic::package_organization::root_orchestrator_straggler`

### `P2`

- `review::.::holistic::abstraction_fitness::channel_setup_wrapper_chain`
- `review::.::holistic::abstraction_fitness::planning_service_used_as_normalizer`
- `review::.::holistic::cross_module_architecture::channel_setup_raw_storage_seam`
- `review::.::holistic::design_coherence::channel_setup_session_controller_mixed_state_and_io`
- `review::.::holistic::design_coherence::channel_setup_snapshot_loader_overloaded`
- `review::.::holistic::error_consistency::channel_setup_plain_object_throw`
- `review::.::holistic::high_level_elegance::channel_setup_domain_placement_blur`
- `review::.::holistic::incomplete_migration::playback_variant_rename_still_leaks_legacy_key`
- `review::.::holistic::mid_level_elegance::channel_setup_port_mixed_absence_contract`
- `review::.::holistic::test_strategy::fastkey_filter_parser_untested`

### `P3`

- `review::.::holistic::cross_module_architecture::core_depends_on_ui_helpers`
- `review::.::holistic::high_level_elegance::epg_public_surface_blur`
- `review::.::holistic::convention_outlier::overlay-barrel-policy-inconsistent`
- `review::.::holistic::naming_quality::epg_acronym_casing_drift`
- `review::.::holistic::package_organization::epg_root_flat_overload`

### `P4`

- `review::.::holistic::abstraction_fitness::lifecycle_single_impl_interfaces`
- `review::.::holistic::initialization_coupling::theme_manager_singleton_ordering`
- `review::.::holistic::logic_clarity::predicate_ladders_obscure_intent`
- `review::.::holistic::logic_clarity::redundant_async_forwarders`
- `review::.::holistic::mid_level_elegance::navigation_hidden_store_reads`
- `review::.::holistic::package_organization::core_misc_bucket`
- `review::.::holistic::test_strategy::startup_ui_initializer_untested`
- `review::.::holistic::type_safety::generic_navigation_param_bag`

### `P5`

- `review::.::holistic::api_surface_coherence::storage_write_contract_fragmentation`
- `review::.::holistic::contract_coherence::read-apis-hide-cleanup-writes`

### `P6`

- `review::.::holistic::api_surface_coherence::parse_home_users_overloaded_payload_entrypoint`
- `review::.::holistic::api_surface_coherence::plex_fetch_helper_shape_drift`
- `review::.::holistic::authorization_consistency::restricted_profile_flag_unused`
- `review::.::holistic::contract_coherence::plexauth-validate-token-error-contract`
- `review::.::holistic::convention_outlier::plex-library-type-name-collision`
- `review::.::holistic::initialization_coupling::plex_client_identifier_module_cache`
- `review::.::holistic::naming_quality::generic_plex_utility_file_names`
- `review::.::holistic::type_safety::duplicated_plex_media_type_aliases`

### `P7`

- `review::.::holistic::ai_generated_debt::nested_defensive_catch_defaults`
- `review::.::holistic::contract_coherence::videoplayer-setaudiotrack-throw-surface-drift`
- `review::.::holistic::convention_outlier::player-helper-exported-through-class-file`
- `review::.::holistic::error_consistency::media_session_play_swallow`
- `review::.::holistic::incomplete_migration::player_backward_compat_aliases_keep_multiple_canonical_paths_alive`
- `review::.::holistic::low_level_elegance::playback_recovery_repeated_reload_choreography`
- `review::.::holistic::type_safety::raw_error_code_string_branching`

### `P8`

- `review::.::holistic::ai_generated_debt::diagnostic_payload_dump_logging`
- `review::.::holistic::ai_generated_debt::templated_docblock_ceremony`
- `review::.::holistic::high_level_elegance::architecture_reference_drift`

### `P9`

- `review::.::holistic::test_strategy::private_api_test_coupling`

## Detector Envelope Inventory For Fresh Refreshes

Use these exact commands at the start and end of each priority. The counts below are the 2026-04-10 baseline and must be updated as the cleanup progresses.

- `smells (163)`: `desloppify show smells --status open --no-budget --top 250`
- `structural (76)`: `desloppify show structural --status open --no-budget --top 150`
- `review (51)`: `desloppify show review --status open --no-budget --top 100`
- `facade (21)`: `desloppify show facade --status open --no-budget --top 50`
- `test_coverage (20)`: `desloppify show test_coverage --status open --no-budget --top 100`
- `logs (8)`: `desloppify show logs --status open --no-budget --top 50`
- `signature (8)`: `desloppify show signature --status open --no-budget --top 50`
- `stale_exclude (6)`: `desloppify show stale_exclude --status open --no-budget --top 50`
- `responsibility_cohesion (5)`: `desloppify show responsibility_cohesion --status open --no-budget --top 50`
- `flat_dirs (3)`: `desloppify show flat_dirs --status open --no-budget --top 50`
- `single_use (3)`: `desloppify show single_use --status open --no-budget --top 50`
- `naming (1)`: `desloppify show naming --status open --no-budget --top 50`
- `boilerplate_duplication (1)`: `desloppify show boilerplate_duplication --status open --no-budget --top 50`

## Operating Rules

- No imported review issue may be resolved without direct code validation on current source.
- No mechanical detector may be suppressed purely to improve the score.
- Every generated-output or local-state exclusion must be explicitly approved and re-verified after the scope change.
- Every `P#-EXIT` must update this checklist in the same pass.
- Every final closeout claim must be backed by rerun commands, not memory or prior output.
