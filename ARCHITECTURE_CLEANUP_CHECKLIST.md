# Architecture Cleanup Checklist

> V4 established 2026-04-10 from the fresh holistic review imported from `.desloppify/subagents/runs/20260410_053544`.
>
> Any pre-refresh copy preserved under `docs/_local/` is scratch-only and must not be treated as tracked handoff memory or current truth.

This document is the active cleanup queue for the current repo-wide `desloppify` backlog.

This is the correct top-level tracked format for this work. Per [`docs/AGENTIC_DEV_WORKFLOW.md#authority-and-document-roles`](./docs/AGENTIC_DEV_WORKFLOW.md#authority-and-document-roles), `ARCHITECTURE_CLEANUP_CHECKLIST.md` is the authoritative active backlog and live-status surface, while `docs/plans/*` remains task-scoped execution memory. Every `P#-W#` below must still have an execution-grade plan before code changes begin, but that plan is local by default and should only be tracked when durable handoff memory is explicitly needed.

## Fresh-Session Handoff

- Last structural refresh: `2026-04-10` from `.desloppify/subagents/runs/20260410_053544`
- Current execution state: `P0-W1`, `P0-W2`, `P0-EXIT`, `P1-W1`, `P1-W2`, `P1-EXIT`, `P2-W1`, `P2-W2`, `P2-W3`, `P2-EXIT`, `P3-W1`, `P3-W2`, `P3-EXIT`, `P4-W1`, `P4-W2`, `P4-EXIT`, `P5-W1`, `P5-W2`, `P5-EXIT`, `P6-W1`, `P6-W2`, `P6-EXIT`, `P7-W1`, `P7-W2`, `P7-EXIT`, `P8-W1`, `P8-W2`, `P8-EXIT`, `P9-W1`, `P9-W2`, and `P9-EXIT` completed on integration-branch evidence
- Next safe start: `P10-W1`
- Legacy note: `docs/plans/2026-04-02-p3-w1-channel-setup-workflow-owner.md` predates the `2026-04-10` checklist refresh and is historical planning context, not the active `P3-W1` gate token
- Authoritative evidence rule: only update checklist status, baseline counts, or exit records from reruns on the target integration branch; worktree evidence is provisional
- Recent update log:
  - `2026-04-10`: closed `P0-W1`/`P0-W2`/`P0-EXIT`; locked `dist-ts` generated-output exclusion, recorded queue operating rule, ran `desloppify` exit evidence plus `npm run verify:docs`
  - `2026-04-10`: completed `P1-W1` runtime-owner decomposition (root barrel move, selected-server runtime owner extraction, schedule policy owner extraction, app-shell runtime contract narrowing, app config factory extraction), ran full verification + required `desloppify` evidence
  - `2026-04-10`: completed `P1-W2` runtime seam cleanup (explicit event cleanup reporter seam, grouped priority-one runtime seams, coordinator builder extraction), ran full `verify` plus required `desloppify` evidence refresh
  - `2026-04-11`: completed `P1-EXIT` reconciliation (all mapped imported review ids closed, cycle detector residue dispositioned with source-audit proof and final owner, `npm run verify` rerun)
  - `2026-04-13`: completed `P2-W2` owner-boundary split (state/runtime session owners, facet snapshot loader extraction, typed build scratch owner), ran targeted channel-setup/orchestrator regressions plus `npm run verify`
  - `2026-04-13`: completed `P2-W3` error/migration/test closure (typed `ChannelSetupPlanningError` boundary proof, canonical playback variant key cleanup, direct tag-filter tests), ran targeted P2-W3 suites + `npm run verify` + source-audit and detector reconciliation commands
  - `2026-04-14`: completed `P3-W2`/`P3-EXIT` EPG package-shape closeout (canonical public `EPG` naming, `EPGRefreshController` routed through `./runtime`, root-vs-runtime owner audit preserved), ran focused EPG regressions, `npm run verify`, `npm run verify:docs`, and refreshed `desloppify` scan evidence
  - `2026-04-14`: completed `P4-W1` lifecycle/navigation contract ceremony closeout (`IAppLifecycle` narrowed to runtime seam, lifecycle-only collaborator ceremony removed, navigation hidden store reads removed, server-select param seam narrowed with explicit no-param reset semantics), ran targeted lifecycle/navigation regressions, `npm run verify`, source-audit `rg` proofs, and refreshed `desloppify` evidence
  - `2026-04-14`: completed `P4-W2` startup/theme seam closeout (`AppThemeController` now owns runtime theme state and app-shell settings theme callbacks, startup UI initializer moved to `src/core/app-shell/AppStartupUiInitializer.ts`, `InitializationCoordinator` now depends on a narrow startup-UI port, and core barrel imports no longer route `InitializationCoordinator`), ran targeted startup/theme suites, `npm run verify`, `npm run verify:docs`, and refreshed `desloppify` scan evidence
  - `2026-04-14`: completed `P4-EXIT` priority-exit reconciliation (all eight mapped imported `P4` issue ids remained resolved on current-source proof, no exact `P4` test-only residue remained for `P9-W2`, exact non-test `P4` mechanical residue was assigned to `P10-W1`, and security triage stayed outside Priority 4 scope), reran the full `P4` source-audit matrix, refreshed detector/status/queue evidence, and reran `npm run verify` plus `npm run verify:docs`
  - `2026-04-14`: completed `P5-EXIT` priority-exit reconciliation (`storage_write_contract_fragmentation` stayed resolved on current-source proof, `read-apis-hide-cleanup-writes` stayed split to one residual `P10-W1` owner based on current-source audit despite live detector silence, and security triage remained outside Priority 5 scope), reran the exact `P5` issue-id commands, refreshed queue/status evidence, reran the residual read audit, and reran `npm run verify` plus `npm run verify:docs`
  - `2026-04-14`: completed `P6-W1` auth/fetch/profile contract normalization (`fetchWithTimeout` now uses one args-object signature across auth/stream/player/UI callsites, auth parsing seams now consume explicit response payload types, `validateToken` now returns `false` only for auth-invalid/timeout and throws typed failures for service/network/parse outcomes, and profile-select now surfaces `restricted` as informational-only UI metadata), reran focused Plex/auth/profile/startup/docs suites plus `npm run typecheck` and `npm run verify`
  - `2026-04-14`: completed `P6-W2` Plex state/type surface normalization (client identifier now resolves once at config assembly with no hidden module cache or constructor re-resolution, library data types renamed to `PlexLibrarySection`/`PlexLibrarySectionType` with no compatibility aliases, `PlexMediaType` now has one canonical owner in `plex/shared`, generic `auth/helpers.ts` and `stream/utils.ts` buckets were replaced by purpose-specific owners, and discovery now imports `PlexApiError` from `plexAuthTransport`), reran focused Plex/auth/library/discovery/stream/scheduler/channel-setup/docs suites plus `npm run typecheck`, `npm run verify`, and `npm run verify:docs`
  - `2026-04-14`: completed `P6-EXIT` priority-exit reconciliation (all eight mapped imported `P6` issue ids remained resolved on current-source proof, `P6-W1` stayed closed, the `P6-W2` seam closures held with no compatibility aliases or constructor re-resolution, stale deleted-file auth detector residue was assigned to `P10-W1`, exact live P6 mechanical residue was assigned to `P10-W1`, and security triage stayed outside Priority 6 scope), reran the exact `P6` issue-id commands, refreshed package/status/queue/security evidence, and reran `npm run verify` plus `npm run verify:docs`
  - `2026-04-14`: completed `P7-W1` playback recovery/error propagation cleanup (runtime `AppErrorCode` validation now has canonical helpers in `src/types/app-errors.ts`, `PlaybackRecoveryManager` routes audio/direct-to-transcode/burn-in/disable-burn-in reloads through one private executor with explicit result contracts, bounded orchestrator/UI callers distinguish `ignored` from `failed`, and Media Session `play()` failures now surface through the throttled warning path), reran focused player/orchestrator/playback-options suites, `npm run verify`, source-audit `rg` checks, and refreshed `desloppify` evidence with stale-detector reconciliation notes
  - `2026-04-15`: completed `P7-EXIT` priority-exit reconciliation (all seven mapped imported `P7` issue ids remained resolved on current-source proof, the subtitle-deactivation seam is now source-audit clean with `_buildStreamDescriptor()` wiring callbacks only, `SubtitleManager` owning handled-deactivation dispatch plus unavailable fallback, and `PlaybackRecoveryManager` retaining the player-owned burn-in recovery helpers, and no `P7` follow-up owner remains), reran the exact `P7` issue-id commands, refreshed scan/status evidence, reran the player/lifecycle verification commands, and ran `npm run verify` plus `npm run verify:docs`
  - `2026-04-15`: completed `P8-W2` bounded template-docblock and architecture-reference refresh (removed template header/signature-restating commentary from the scoped live auth/player files, updated `modules.md` to match `CURRENT_STATE.md` plus current source for `src/Orchestrator.ts` and the server-selection split, and recorded the remaining repo-wide template-ceremony/detector-lag closeout path under `P8-EXIT`), reran `npm run typecheck` plus `npm run verify:docs`
  - `2026-04-15`: completed `P8-EXIT` priority-exit reconciliation (`diagnostic_payload_dump_logging` and `architecture_reference_drift` stayed resolved on current-source proof despite stale imported wording, the scoped `templated_docblock_ceremony` anchors remained resolved while broader repo-wide header residue was handed to one exact `P10-W1` owner, and security triage stayed outside Priority 8 scope), reran the exact `P8` issue-id commands, refreshed scan/status/queue evidence, reran the scoped detector/source audits, and reran `npm run verify` plus `npm run verify:docs`
  - `2026-04-15`: completed `P9-EXIT` priority-exit reconciliation (`private_api_test_coupling` is now retired on current source, `Orchestrator.test.ts` retains only the AppOrchestrator-owned `ensureEPGInitialized()` callback-path proof while focused coordinator owner suites cover builder/assembly seams, all remaining Priority 9 detector rows were dispositioned in-place as detector mismatch, orchestrator-helper residue, or type-only limitation, and only lower-priority Plex helper coverage rows were handed to one exact `P10-W1` owner), reran the exact `P9` evidence matrix, refreshed scan/status/queue/security evidence, reran the targeted P9 suites, and reran `npm run verify` plus `npm run verify:docs`

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
- Before implementation begins for any `P#-W#`, create an execution-grade plan using the plan-authoring standard. Keep it local by default, and only promote it into `docs/plans/YYYY-MM-DD-<topic>.md` when the slice needs durable tracked handoff memory.
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

- [x] `P3-EXIT`
  - required: record every mapped imported issue with an exact disposition
  - run the priority-exit review before moving to `P4`
  - refresh every `P3` issue id, the `P3` detector envelopes, `desloppify status`, `desloppify plan queue`, and `npm run verify`
  - confirm one single final owner for any `P3` issue that still needs a follow-up
  - Status: completed
  - Plan: `none (priority-exit reconciliation recorded directly in this checklist)`
  - Last touched: `2026-04-14`
  - Mapped imported issues:
    - `review::.::holistic::cross_module_architecture::core_depends_on_ui_helpers` -> `resolved` (`desloppify show ... --status open --no-budget` returned no open issues; retained `P3-W1` disposition on current source)
    - `review::.::holistic::high_level_elegance::epg_public_surface_blur` -> `resolved` (`desloppify show ... --status open --no-budget` returned no open issues; retained `P3-W1` disposition on current source)
    - `review::.::holistic::convention_outlier::overlay-barrel-policy-inconsistent` -> `resolved` (`desloppify show ... --status open --no-budget` returned no open issues; retained `P3-W1` disposition on current source)
    - `review::.::holistic::naming_quality::epg_acronym_casing_drift` -> `resolved` (`desloppify show ... --status open --no-budget` returned no open issues after canonical public `EPG` renames)
    - `review::.::holistic::package_organization::epg_root_flat_overload` -> `resolved` (`desloppify show ... --status open --no-budget` returned no open issues; current-source owner audit kept shared helpers at the package root and retired the runtime-barrel residue)
  - Verification:
    - `npm test -- src/modules/ui/epg/__tests__/index.test.ts src/modules/ui/epg/__tests__/DeferredEpgComponent.test.ts src/modules/ui/epg/__tests__/buildEpgStartupConfig.test.ts src/modules/ui/epg/__tests__/debugRuntimeGuards.test.ts src/modules/ui/epg/__tests__/EPGCoordinator.test.ts src/core/__tests__/InitializationCoordinator.test.ts src/__tests__/Orchestrator.test.ts src/modules/ui/epg/runtime/__tests__/index.test.ts src/modules/ui/epg/__tests__/EPGRefreshController.test.ts` passed
    - `rg -n "from './runtime'" src/modules/ui/epg/EPGRefreshController.ts` returned one package-local barrel import
    - `rg -n "runtime/(EPGScheduleRefreshRuntime|EPGVisibleRangeRefreshQueue)" src/modules/ui/epg/EPGRefreshController.ts` returned no matches
    - `npm run verify` passed
    - `npm run verify:docs` passed
    - `desloppify scan --path .` refreshed the detector state on current branch code (`+6 new · -20 resolved`; last scan `2026-04-14T05:04:05+00:00`)
    - `desloppify status` refreshed (`overall 83.1 / strict 83.1 / objective 94.8 / verified 94.8`)
    - `desloppify plan queue` refreshed (`Queue: 1 item (51 planned · 1 subjective)`)
    - reran all five mapped `P3` imported issue-id commands above with `--status open --no-budget`; each returned no open issues
    - `desloppify show src/modules/ui/epg --status open --no-budget --top 250` no longer reports `facade::src/modules/ui/epg/runtime/index.ts`; remaining EPG residue is non-mapped (`buildEpgStartupConfig.ts` smells, `model/*` direct-test gaps, `facade::src/modules/ui/epg/model/index.ts`, `EPGCoordinator.ts` console-error smell, `EPGVisibleRangeRefreshQueue.ts` voided symbol, `styles.css` css monolith)
    - `desloppify show flat_dirs --status open --no-budget --top 50` returned no open issues
    - `desloppify show naming --status open --no-budget --top 50` returned no open issues
    - `desloppify show facade --status open --no-budget --top 50` no longer reports `src/modules/ui/epg/runtime/index.ts`; the remaining in-scope EPG facade residue is `facade::src/modules/ui/epg/model/index.ts`
    - `desloppify show security --status open --no-budget --top 50` reports three import-cycle issues outside Priority 3 scope (`OrchestratorCoordinatorBuilders.ts`, `ChannelSetupSessionController.ts`, `NowPlayingInfoCoordinator.ts`)
  - Follow-ups:
    - `followup::p3-exit::epg-model-index-facade-residue`
      owner: `P10-W1 residual mechanical detector owner`
      reason: `desloppify show facade --status open --no-budget --top 50` now reports `facade::src/modules/ui/epg/model/index.ts`, while the slice-owned `runtime/index.ts` residue is retired on current source.
      revisit trigger: rerun `desloppify scan --path .` + `desloppify show facade --status open --no-budget --top 50` at `P10-W1` entry and before `P10-EXIT`; only promote it earlier if a new tracked plan intentionally takes EPG model-surface cleanup.
  - Handoff: `P3 complete on current integration-branch evidence; P4-W1 may begin after the required review handoff for this slice`

- [x] `P4-EXIT`
  - required: record every mapped imported issue with an exact disposition
  - run the priority-exit review before moving to `P5`
  - refresh every `P4` issue id, the `P4` detector envelopes, `desloppify status`, `desloppify plan queue`, and `npm run verify`
  - confirm one single final owner for any `P4` issue that still needs a follow-up
  - Status: completed
  - Plan: `docs/plans/2026-04-14-p4-exit-priority-exit-reconciliation.md`
  - Last touched: `2026-04-14`
  - Mapped imported issues:
    - `review::.::holistic::abstraction_fitness::lifecycle_single_impl_interfaces` -> `resolved` (`desloppify show ... --status open --no-budget` returned no open issues; `rg -n "IStateManager|IErrorRecovery|getErrorRecovery\(" src/modules/lifecycle src/core/orchestrator/AppOrchestrator.ts` returned no production matches)
    - `review::.::holistic::initialization_coupling::theme_manager_singleton_ordering` -> `resolved` (`desloppify show ... --status open --no-budget` returned no open issues; `test -e src/modules/ui/theme/ThemeManager.ts && echo present || echo absent` returned `absent`; `rg -n "ThemeManager|getInstance\(" src/App.ts src/core src/modules/ui/settings src/__tests__` returned no matches)
    - `review::.::holistic::logic_clarity::predicate_ladders_obscure_intent` -> `resolved` (`desloppify show ... --status open --no-budget` returned no open issues; typed and no-param server-select route audits remained explicit and narrow on current source)
    - `review::.::holistic::logic_clarity::redundant_async_forwarders` -> `resolved` (`desloppify show ... --status open --no-budget` returned no open issues; lifecycle-only forwarder seams stayed absent on current source)
    - `review::.::holistic::mid_level_elegance::navigation_hidden_store_reads` -> `resolved` (`desloppify show ... --status open --no-budget` returned no open issues; `rg -n "new (DeveloperSettingsStore|ProfileSessionStore)" src/modules/navigation` returned no matches)
    - `review::.::holistic::package_organization::core_misc_bucket` -> `resolved` (`desloppify show ... --status open --no-budget` returned no open issues; `rg -n "class AppThemeController|class AppStartupUiInitializer" src/core/app-shell` returned both app-shell owners at their expected paths)
    - `review::.::holistic::test_strategy::startup_ui_initializer_untested` -> `resolved` (`desloppify show ... --status open --no-budget` returned no open issues; startup-UI source audit plus `desloppify show test_coverage --status open --no-budget --top 100` showed no exact audited `P4` test-only residue)
    - `review::.::holistic::type_safety::generic_navigation_param_bag` -> `resolved` (`desloppify show ... --status open --no-budget` returned no open issues; `rg -n "getScreenParams\(" src/App.ts src/core/app-shell/AppScreenVisibilityCoordinator.ts src/modules/navigation` returned no matches and `getServerSelectParams()` remained the only focused runtime param seam)
  - Verification:
    - reran all eight mapped `P4` imported issue-id commands above with `desloppify show ... --status open --no-budget --top 20`; each returned no open issues
    - `rg -n "new (DeveloperSettingsStore|ProfileSessionStore)" src/modules/navigation` returned no matches
    - `rg -n "getScreenParams\(" src/App.ts src/core/app-shell/AppScreenVisibilityCoordinator.ts src/modules/navigation` returned no matches
    - `rg -n "Record<string, unknown>" src/modules/navigation/interfaces.ts src/modules/navigation/NavigationManager.ts src/core/app-shell/AppScreenVisibilityCoordinator.ts` returned one interfaces-only comment match and no live generic runtime param bag
    - `rg -n "goTo\('server-select', \{ allowAutoConnect:" src/core/orchestrator/AppOrchestrator.ts src/modules/navigation/NavigationCoordinator.ts` returned one explicit typed server-select route call in `NavigationCoordinator.ts`
    - `rg -n "goTo\('server-select'\)" src/core/orchestrator/AppOrchestrator.ts src/core/initialization/InitializationStartupPolicy.ts` returned intentional no-param recovery/startup reset routes only
    - `rg -n "getServerSelectParams\(" src/App.ts src/core/app-shell/AppScreenVisibilityCoordinator.ts src/modules/navigation` returned only the focused server-select seam plus tests
    - `rg -n "IStateManager|IErrorRecovery|getErrorRecovery\(" src/modules/lifecycle src/core/orchestrator/AppOrchestrator.ts` returned no matches
    - `test -e src/modules/ui/theme/ThemeManager.ts && echo present || echo absent` returned `absent`
    - `rg -n "ThemeManager|getInstance\(" src/App.ts src/core src/modules/ui/settings src/__tests__` returned no matches
    - `rg -n "class AppThemeController|class AppStartupUiInitializer" src/core/app-shell` returned both expected app-shell owner classes
    - `rg -n "startupUiInitializer|ensureCorePlayerUiInitialized\(" src/core/InitializationCoordinator.ts src/core/orchestrator/AppOrchestrator.ts src/core/__tests__/InitializationCoordinator.test.ts src/core/app-shell/__tests__/AppStartupUiInitializer.test.ts` returned the narrow startup-UI port wiring plus direct tests
    - `desloppify scan --path .` refreshed the detector state on current branch code; `desloppify status` reported last scan `2026-04-14T09:29:15+00:00`, `overall 83.1 / strict 83.1 / objective 94.8 / verified 94.8`, and the scan emitted `WARNING: Boilerplate duplication detection skipped: jscpd exited with errors`
    - `desloppify show src/modules/lifecycle --status open --no-budget --top 100` shows only `smells::src/modules/lifecycle/AppLifecycle.ts::hardcoded_url`
    - `desloppify show src/modules/navigation --status open --no-budget --top 150` shows only `smells::src/modules/navigation/NavigationCoordinator.ts::console_error_no_throw` and `smells::src/modules/navigation/NavigationCoordinator.ts::async_no_await`
    - `desloppify show responsibility_cohesion --status open --no-budget --top 50` returned no open issues
    - `desloppify show src/core/initialization --status open --no-budget --top 100` shows only non-imported `InitializationStartupPolicy` smells
    - `desloppify show src/core/app-shell --status open --no-budget --top 100` shows `test_coverage::src/core/app-shell/AppOrchestratorConfigFactory.ts::transitive_only`, `smells::src/core/app-shell/AppContainerFactory.ts::hardcoded_color`, `smells::src/core/app-shell/AppStartupUiInitializer.ts::async_no_await`, and `smells::src/core/app-shell/AppScreenVisibilityCoordinator.ts::voided_symbol`; only `AppStartupUiInitializer.ts` is carried forward from exact `P4` source surfaces
    - `desloppify show src/core/InitializationCoordinator.ts --status open --no-budget --top 50` shows only `smells::src/core/InitializationCoordinator.ts::console_error_no_throw`
    - `desloppify show src/App.ts --status open --no-budget --top 50` shows `smells::src/App.ts::console_error_no_throw` and `smells::src/App.ts::swallowed_error`, which remain outside the exact inherited `P4` follow-up set
    - `desloppify show test_coverage --status open --no-budget --top 100` reported no exact audited `P4` files, so no inherited `P9-W2` follow-up was created
    - `desloppify show security --status open --no-budget --top 50` reported three non-`P4` T3 import-cycle issues (`OrchestratorCoordinatorBuilders.ts`, `ChannelSetupSessionController.ts`, `NowPlayingInfoCoordinator.ts`)
    - `desloppify plan queue --sort recent` refreshed (`Queue: 1 item (51 planned · 1 subjective)`)
    - `npm run verify` passed
    - `npm run verify:docs` passed
  - Security triage: `no open P0 security findings`; refreshed security output reported only the three non-`P4` T3 import-cycle issues above
  - Follow-ups:
    - no exact `P4` test-only residue remains, so no inherited `P9-W2` follow-up was created
    - `followup::p4-exit::exact-p4-mechanical-residue`
      owner: `P10-W1 residual mechanical detector owner`
      reason: exact current-branch `P4` detector refresh left five non-test residual issue ids in exact audited `P4` files only: `smells::src/modules/lifecycle/AppLifecycle.ts::hardcoded_url`, `smells::src/modules/navigation/NavigationCoordinator.ts::console_error_no_throw`, `smells::src/modules/navigation/NavigationCoordinator.ts::async_no_await`, `smells::src/core/app-shell/AppStartupUiInitializer.ts::async_no_await`, and `smells::src/core/InitializationCoordinator.ts::console_error_no_throw`.
      revisit trigger: rerun `desloppify scan --path .` + `desloppify show src/modules/lifecycle --status open --no-budget --top 100` + `desloppify show src/modules/navigation --status open --no-budget --top 150` + `desloppify show src/core/app-shell --status open --no-budget --top 100` + `desloppify show src/core/InitializationCoordinator.ts --status open --no-budget --top 50` at `P10-W1` entry and before `P10-EXIT`; do not widen this inheritance to neighboring `src/App.ts`, `AppScreenVisibilityCoordinator.ts`, or app-shell/test-coverage residue unless current source proves a still-live mapped `P4` rationale.
  - Handoff: `P4 complete on current integration-branch evidence; run the required priority-exit review handoff before starting P5-W1`

- [x] `P5-EXIT`
  - required: record every mapped imported issue with an exact disposition
  - run the priority-exit review before moving to `P6`
  - refresh every `P5` issue id, the `P5` detector envelopes, `desloppify status`, `desloppify plan queue`, and `npm run verify`
  - confirm one single final owner for any `P5` issue that still needs a follow-up
  - Status: completed
  - Plan: `none (priority-exit reconciliation recorded directly in this checklist)`
  - Last touched: `2026-04-14`
  - Mapped imported issues:
    - `review::.::holistic::api_surface_coherence::storage_write_contract_fragmentation` -> `resolved` (`desloppify show ... --status open --no-budget` returned no open issues; retained the `P5-W1` current-source disposition that the in-scope storage write boundaries now share one explicit failure contract)
    - `review::.::holistic::contract_coherence::read-apis-hide-cleanup-writes` -> `split follow-up` (the exact `desloppify show ... --status open --no-budget` command returned no open issues, but current-source audit still found lower-priority plain read names hiding cleanup behavior in `AudioSettingsStore`, `DeveloperSettingsStore`, `NowPlayingDisplayStore`, `ProfileSessionStore`, `SubtitlePreferencesStore`, `ThemePreferencesStore`, and `DebugOverridesStore`; no second successor owner was proven, so the only remaining owner stays `P10-W1 residual mechanical detector owner`)
  - Verification:
    - `desloppify status` refreshed (`overall 83.1 / strict 83.1 / objective 94.8 / verified 94.8`; last scan `2026-04-14T17:27:25+00:00`; queue note remained `1 item (51 stale tracked · 1 subjective)`)
    - `desloppify plan queue --sort recent` refreshed (`Queue: 1 item (51 planned · 1 subjective)`)
    - `desloppify show "review::.::holistic::api_surface_coherence::storage_write_contract_fragmentation" --status open --no-budget` returned no open issues
    - `desloppify show "review::.::holistic::contract_coherence::read-apis-hide-cleanup-writes" --status open --no-budget` returned no open issues; detector silence treated as supporting-only evidence because the current-source residual audit below still found lower-priority plain reads
    - `rg -n "readDtsPassthroughEnabled\\(|readDirectPlayAudioFallbackEnabled\\(|readAudioSetupComplete\\(|readDebugLoggingEnabled\\(|readSubtitleDebugLoggingEnabled\\(|readCinematicNowPlayingEnabled\\(|readPreferClearLogosEnabled\\(|readClampedAutoHideMs\\(|readShowProfilePickerOnStartup\\(|readKeepPlayingInSettings\\(|readLastProfileId\\(|readSubtitleMode\\(|readSubtitlePreferForced\\(|readSubtitleLanguage\\(|readTheme\\(|readNowPlayingStreamDebugEnabled\\(|readNowPlayingStreamDebugAutoShowEnabled\\(|readEpgDebugEnabled\\(|readTranscodeProfileName\\(" src/modules/settings/AudioSettingsStore.ts src/modules/settings/DeveloperSettingsStore.ts src/modules/settings/NowPlayingDisplayStore.ts src/modules/settings/ProfileSessionStore.ts src/modules/settings/SubtitlePreferencesStore.ts src/modules/settings/ThemePreferencesStore.ts src/modules/debug/DebugOverridesStore.ts src/bootstrap.ts src/modules/player src/modules/ui src/core src/__tests__` returned only the residual lower-priority settings/debug store reads and their current callers; no new `P5`-owned discovery/auth/settings-facade plain read surfaces were reintroduced
    - `desloppify show src/modules/settings --status open --no-budget --top 100` returned no open issues
    - `desloppify show src/modules/debug --status open --no-budget --top 100` reported only `smells::src/modules/debug/NowPlayingDebugManager.ts::console_error_no_throw`
    - `desloppify show src/modules/plex/discovery --status open --no-budget --top 100` reported only `logs::src/modules/plex/discovery/PlexServerDiscovery.ts::Discovery`
    - `desloppify show src/modules/plex/auth --status open --no-budget --top 100` reported only `smells::src/modules/plex/auth/helpers.ts::high_cyclomatic_complexity` and `smells::src/modules/plex/auth/helpers.ts::async_no_await`
    - `desloppify show security --status open --no-budget --top 50` reported three non-`P5` T3 import-cycle issues (`OrchestratorCoordinatorBuilders.ts`, `ChannelSetupSessionController.ts`, `NowPlayingInfoCoordinator.ts`)
    - `npm run verify` passed
    - `npm run verify:docs` passed
  - Security triage: `no open P0 security findings`; refreshed security output reported only the three non-`P5` T3 import-cycle issues above
  - Follow-ups:
    - `followup::p5-exit::read-api-cleanup-write-residual`
      owner: `P10-W1 residual mechanical detector owner`
      reason: the exact `P5` discovery/auth/settings-facade rename slice remains resolved on current source, but lower-priority settings/debug owners still expose plain reads with cleanup side effects (`AudioSettingsStore`, `DeveloperSettingsStore`, `NowPlayingDisplayStore`, `ProfileSessionStore`, `SubtitlePreferencesStore`, `ThemePreferencesStore`, and `DebugOverridesStore`), so the remaining read-side residual is one owned `P10-W1` cleanup envelope rather than a new `P6+` owner.
      revisit trigger: rerun `desloppify show "review::.::holistic::contract_coherence::read-apis-hide-cleanup-writes" --status open --no-budget` + `rg -n "readDtsPassthroughEnabled\\(|readDirectPlayAudioFallbackEnabled\\(|readAudioSetupComplete\\(|readDebugLoggingEnabled\\(|readSubtitleDebugLoggingEnabled\\(|readCinematicNowPlayingEnabled\\(|readPreferClearLogosEnabled\\(|readClampedAutoHideMs\\(|readShowProfilePickerOnStartup\\(|readKeepPlayingInSettings\\(|readLastProfileId\\(|readSubtitleMode\\(|readSubtitlePreferForced\\(|readSubtitleLanguage\\(|readTheme\\(|readNowPlayingStreamDebugEnabled\\(|readNowPlayingStreamDebugAutoShowEnabled\\(|readEpgDebugEnabled\\(|readTranscodeProfileName\\(" src/modules/settings/AudioSettingsStore.ts src/modules/settings/DeveloperSettingsStore.ts src/modules/settings/NowPlayingDisplayStore.ts src/modules/settings/ProfileSessionStore.ts src/modules/settings/SubtitlePreferencesStore.ts src/modules/settings/ThemePreferencesStore.ts src/modules/debug/DebugOverridesStore.ts src/bootstrap.ts src/modules/player src/modules/ui src/core src/__tests__` + `desloppify show src/modules/settings --status open --no-budget --top 100` + `desloppify show src/modules/debug --status open --no-budget --top 100` at `P10-W1` entry and before `P10-EXIT`; keep `P6` through `P9` free of this residual unless current source proves a narrower earlier owner.
  - Handoff: `P5 complete on current integration-branch evidence; P6-W1 may begin after the required review handoff for this slice`

- [x] `P6-EXIT`
  - required: record every mapped imported issue with an exact disposition
  - run the priority-exit review before moving to `P7`
  - refresh every `P6` issue id, the `P6` detector envelopes, `desloppify status`, `desloppify plan queue`, and `npm run verify`
  - confirm one single final owner for any `P6` issue that still needs a follow-up
  - Status: completed
  - Plan: `none (priority-exit reconciliation recorded directly in this checklist)`
  - Last touched: `2026-04-14`
  - Mapped imported issues:
    - `review::.::holistic::api_surface_coherence::parse_home_users_overloaded_payload_entrypoint` -> `resolved` (`desloppify show ... --status open --no-budget` returned no open issues; `src/modules/plex/auth/plexAuthPayloadParsers.ts` now owns explicit `PlexResponsePayload` parsing rather than an exported catch-all parser entrypoint)
    - `review::.::holistic::api_surface_coherence::plex_fetch_helper_shape_drift` -> `resolved` (`desloppify show ... --status open --no-budget` returned no open issues; `rg -n "fetchWithTimeout\\(" src/modules/plex src/modules/player src/modules/ui/playback-options src/core/initialization` showed only the normalized args-object call shape)
    - `review::.::holistic::authorization_consistency::restricted_profile_flag_unused` -> `resolved` (`desloppify show ... --status open --no-budget` returned no open issues; `rg -n "restricted" src/modules/plex/auth src/modules/ui/profile-select` shows informational-only UI labeling plus tests)
    - `review::.::holistic::contract_coherence::plexauth-validate-token-error-contract` -> `resolved` (`desloppify show ... --status open --no-budget` returned no open issues; current `PlexAuth.validateToken()` returns `false` only for `401`/`403` and timeout while throwing typed `PlexApiError` failures for parse/service/network paths)
    - `review::.::holistic::convention_outlier::plex-library-type-name-collision` -> `resolved` (`desloppify show ... --status open --no-budget` returned no open issues; `rg -n "PlexLibraryType|PlexLibraryTypeEnum|type PlexLibrary =|interface PlexLibrary\\b|type PlexLibrarySection\\b|interface PlexLibrarySection\\b|PlexLibrarySectionType" src/modules/plex src/core/channel-setup src/modules/ui/channel-setup src/modules/scheduler/channel-manager src/__tests__` shows the canonical `PlexLibrarySection` / `PlexLibrarySectionType` surface with no compatibility aliases)
    - `review::.::holistic::initialization_coupling::plex_client_identifier_module_cache` -> `resolved` (`desloppify show ... --status open --no-budget` returned no open issues; `src/modules/plex/auth/config.ts` resolves `clientIdentifier` once via `resolveClientIdentifier(...)`, `PlexAuth` consumes `config.clientIdentifier` directly, and no constructor re-resolution path remains)
    - `review::.::holistic::naming_quality::generic_plex_utility_file_names` -> `resolved` (`desloppify show ... --status open --no-budget` returned no open issues; `ls -1 src/modules/plex/auth src/modules/plex/stream` confirms `auth/helpers.ts` and `stream/utils.ts` are gone, and `PlexServerDiscovery.ts` imports `PlexApiError` from `../auth/plexAuthTransport`)
    - `review::.::holistic::type_safety::duplicated_plex_media_type_aliases` -> `resolved` (`desloppify show ... --status open --no-budget` returned no open issues; `rg -n "type PlexMediaType|PlexMediaType\\b" src/modules/plex src/modules/scheduler/channel-manager src/core/channel-setup src/modules/ui/channel-setup` shows the canonical owner in `src/modules/plex/shared/types.ts`)
  - Verification:
    - reran all eight mapped `P6` imported issue-id commands above with `desloppify show ... --status open --no-budget`; each returned no open issues
    - `rg -n "fetchWithTimeout\\(" src/modules/plex src/modules/player src/modules/ui/playback-options src/core/initialization` showed only the normalized args-object call shape
    - `rg -n "validateToken\\(|return false|AUTH_INVALID|AUTH_REQUIRED|NETWORK_TIMEOUT|PARSE_ERROR|timeout" src/modules/plex/auth/PlexAuth.ts src/core/initialization/InitializationStartupPolicy.ts` confirmed the narrowed `validateToken()` false-vs-throw contract and startup handling
    - `rg -n "restricted" src/modules/plex/auth src/modules/ui/profile-select` confirmed informational-only restricted-profile UI handling and test coverage
    - `rg -n "resolveClientIdentifier\\(|clientIdentifier" src/core/app-shell/AppOrchestratorConfigFactory.ts src/modules/plex/auth src/modules/plex/stream src/modules/plex/discovery` confirmed resolved-input config assembly plus direct consumers
    - `rg -n "PlexLibraryType|PlexLibraryTypeEnum|type PlexLibrary =|interface PlexLibrary\\b|type PlexLibrarySection\\b|interface PlexLibrarySection\\b|PlexLibrarySectionType" src/modules/plex src/core/channel-setup src/modules/ui/channel-setup src/modules/scheduler/channel-manager src/__tests__` confirmed the `PlexLibrarySection` / `PlexLibrarySectionType` rename with no compatibility aliases
    - `rg -n "type PlexMediaType|PlexMediaType\\b" src/modules/plex src/modules/scheduler/channel-manager src/core/channel-setup src/modules/ui/channel-setup` confirmed the canonical `PlexMediaType` owner in `src/modules/plex/shared/types.ts`
    - `rg -n "PlexApiError|helpers\\.ts|stream/utils|plexAuthTransport|auth/helpers|../auth/helpers|from './helpers'|from \\\"\\./helpers\\\"|from './utils'|from \\\"\\./utils\\\"\" src/modules/plex` confirmed `PlexApiError` ownership in `plexAuthTransport` and no surviving deleted-bucket imports
    - `desloppify show src/modules/plex/auth --status open --no-budget --top 150` still reports only stale deleted-file residue (`smells::src/modules/plex/auth/helpers.ts::high_cyclomatic_complexity`, `smells::src/modules/plex/auth/helpers.ts::async_no_await`)
    - `desloppify show src/modules/plex/library --status open --no-budget --top 150` reports only non-imported mechanical residue in exact `P6` files (`smells::src/modules/plex/library/ResponseParser.ts::high_cyclomatic_complexity`, `smells::src/modules/plex/library/PlexLibrary.ts::console_error_no_throw`)
    - `desloppify show src/modules/plex/stream --status open --no-budget --top 150` reports only non-imported mechanical residue in exact `P6` files (`test_coverage::src/modules/plex/stream/hdr.ts::transitive_only`, `smells::src/modules/plex/stream/hdr.ts::high_cyclomatic_complexity`, `logs::src/modules/plex/stream/PlexStreamResolver.ts::PlexStreamResolver`, `smells::src/modules/plex/stream/playbackCompatibilityPolicy.ts::high_cyclomatic_complexity`, `smells::src/modules/plex/stream/dvHdr10Fallback.ts::high_cyclomatic_complexity`, `smells::src/modules/plex/stream/types.ts::high_cyclomatic_complexity`)
    - `desloppify show src/modules/scheduler/channel-manager --status open --no-budget --top 150` reports only non-imported mechanical residue in exact `P6` files (`smells::src/modules/scheduler/channel-manager/ChannelContentSourceValidator.ts::high_cyclomatic_complexity`, `smells::src/modules/scheduler/channel-manager/ChannelManager.ts::voided_symbol`, `smells::src/modules/scheduler/channel-manager/StoredChannelDataCodec.ts::voided_symbol`)
    - `desloppify status` refreshed (`overall 83.1 / strict 83.1 / objective 94.8 / verified 94.8`; last scan `2026-04-14T17:27:25+00:00`; queue note remained `1 item (51 stale tracked · 1 subjective)`)
    - `desloppify plan queue --sort recent` refreshed (`Queue: 1 item (51 planned · 1 subjective)`)
    - `desloppify show security --status open --no-budget --top 50` reported three non-`P6` T3 import-cycle issues (`OrchestratorCoordinatorBuilders.ts`, `ChannelSetupSessionController.ts`, `NowPlayingInfoCoordinator.ts`)
    - `npm run verify` passed
    - `npm run verify:docs` passed
  - Security triage: `no open P0 security findings`; refreshed security output reported only the three non-`P6` T3 import-cycle issues above
  - Follow-ups:
    - `followup::p6-exit::deleted-plex-auth-helper-detector-residue`
      owner: `P10-W1 detector-contract cleanup owner`
      reason: `desloppify show src/modules/plex/auth --status open --no-budget --top 150` still reports `smells::src/modules/plex/auth/helpers.ts::high_cyclomatic_complexity` and `smells::src/modules/plex/auth/helpers.ts::async_no_await`, but `src/modules/plex/auth/helpers.ts` no longer exists and the actual auth owners are now `plexAuthPayloadParsers.ts` and `plexAuthTransport.ts`; this is stale detector path residue, not live `P6` ownership drift.
      revisit trigger: rerun `desloppify scan --path .` + `desloppify show src/modules/plex/auth --status open --no-budget --top 150` at `P10-W1` entry and before `P10-EXIT`; if the same deleted-file residue persists with the current source shape, keep it classified as tooling-state detector residue or escalate with a minimal repro instead of reopening `P6`.
    - `followup::p6-exit::exact-p6-mechanical-residue`
      owner: `P10-W1 residual mechanical detector owner`
      reason: exact current-branch `P6` detector refresh left live non-imported mechanical residue in exact audited `P6` files only: `smells::src/modules/plex/library/ResponseParser.ts::high_cyclomatic_complexity`, `smells::src/modules/plex/library/PlexLibrary.ts::console_error_no_throw`, `test_coverage::src/modules/plex/stream/hdr.ts::transitive_only`, `smells::src/modules/plex/stream/hdr.ts::high_cyclomatic_complexity`, `logs::src/modules/plex/stream/PlexStreamResolver.ts::PlexStreamResolver`, `smells::src/modules/plex/stream/playbackCompatibilityPolicy.ts::high_cyclomatic_complexity`, `smells::src/modules/plex/stream/dvHdr10Fallback.ts::high_cyclomatic_complexity`, `smells::src/modules/plex/stream/types.ts::high_cyclomatic_complexity`, `smells::src/modules/scheduler/channel-manager/ChannelContentSourceValidator.ts::high_cyclomatic_complexity`, `smells::src/modules/scheduler/channel-manager/ChannelManager.ts::voided_symbol`, and `smells::src/modules/scheduler/channel-manager/StoredChannelDataCodec.ts::voided_symbol`; none reopens a mapped `P6` imported review id or a still-live `P6-W1` / `P6-W2` seam.
      revisit trigger: rerun `desloppify scan --path .` + `desloppify show src/modules/plex/library --status open --no-budget --top 150` + `desloppify show src/modules/plex/stream --status open --no-budget --top 150` + `desloppify show src/modules/scheduler/channel-manager --status open --no-budget --top 150` at `P10-W1` entry and before `P10-EXIT`; do not widen this inheritance to `P7` through `P9` unless current source proves a narrower earlier owner.
  - Handoff: `P6 complete on current integration-branch evidence; P7-W1 may begin`

- [x] `P7-EXIT`
  - required: record every mapped imported issue with an exact disposition
  - run the priority-exit review before moving to `P8`
  - refresh every `P7` issue id, the `P7` detector envelopes, `desloppify status`, and `npm run verify`
  - confirm one single final owner for any `P7` issue that still needs a follow-up
  - Status: completed
  - Plan: `none (priority-exit reconciliation recorded directly in this checklist)`
  - Last touched: `2026-04-15`
  - Mapped imported issues:
    - `review::.::holistic::ai_generated_debt::nested_defensive_catch_defaults` -> `resolved` (`desloppify show ... --status all` still reports stale pre-fix evidence against `PlaybackRecoveryManager`, but current source no longer contains the old blanket getter/live-position catch wrappers and the focused player/orchestrator verification remained green)
    - `review::.::holistic::error_consistency::media_session_play_swallow` -> `resolved` (`desloppify show ... --status all` still reports stale pre-fix evidence, but current `VideoPlayer` routes Media Session `play()` failures through `_warnMediaSessionActionFailure('play', error)` and the full verification pass stayed green)
    - `review::.::holistic::low_level_elegance::playback_recovery_repeated_reload_choreography` -> `resolved` (`desloppify show ... --status all` still reports stale pre-extraction evidence, but current source audit proves `_buildStreamDescriptor()` only wires `onDeactivate` / `onDeactivateRecovery`, `SubtitleManager` owns handled-deactivation dispatch plus generic unavailable fallback, and `PlaybackRecoveryManager` retains the player-owned burn-in recovery helpers and shared reload executor)
    - `review::.::holistic::type_safety::raw_error_code_string_branching` -> `resolved` (`desloppify show ... --status all` now points at `src/core/channel-setup/ChannelSetupPlanningService.ts`, not the player recovery slice)
    - `review::.::holistic::contract_coherence::videoplayer-setaudiotrack-throw-surface-drift` -> `resolved` (`desloppify show ... --status all` still carries pre-fix player-surface evidence, but the current `P7-W2` source and focused tests keep the `setAudioTrack()` contract aligned)
    - `review::.::holistic::convention_outlier::player-helper-exported-through-class-file` -> `resolved` (`desloppify show ... --status all` still carries pre-fix export-path evidence, but the current player barrel now points at the canonical helper owner and the focused player verification stayed green)
    - `review::.::holistic::incomplete_migration::player_backward_compat_aliases_keep_multiple_canonical_paths_alive` -> `resolved` (`desloppify show ... --status all` still carries pre-fix alias residue wording, but current source and the `P7-W2` source-audit checks confirm internal callers now use the canonical owners)
  - Verification:
    - `npm test -- --runInBand src/types/__tests__/app-errors.test.ts src/modules/player/__tests__/PlaybackRecoveryManager.test.ts src/modules/player/__tests__/VideoPlayer.test.ts src/modules/player/__tests__/error-taxonomy.test.ts src/__tests__/orchestrator/subtitle-track-recovery-warning-contract.test.ts src/modules/ui/playback-options/__tests__/PlaybackOptionsCoordinator.test.ts src/modules/player/__tests__/SubtitleManager.test.ts` passed
    - `npm test -- --runInBand src/core/__tests__/PlaybackStartController.test.ts src/__tests__/orchestrator/lifecycle-resume-race.test.ts` passed
    - `desloppify scan --path .` refreshed the detector state on current branch code (`overall 83.1 / strict 83.1 / objective 94.8 / verified 94.8`; last scan `2026-04-15T04:48:37+00:00`; scan emitted `WARNING: Boilerplate duplication detection skipped: jscpd exited with errors`; security reported `clean (332 files scanned)`)
    - `desloppify status` refreshed (`overall 83.1 / strict 83.1 / objective 94.8 / verified 94.8`; queue note `1 item (51 stale tracked · 1 subjective)`)
    - reran all seven mapped `P7` imported issue-id commands above with `desloppify show ... --status all`; the three `P7-W1` rows remained stale pre-fix / pre-extraction evidence, `raw_error_code_string_branching` now points at `src/core/channel-setup/ChannelSetupPlanningService.ts`, and the three `P7-W2` rows still describe pre-fix player-surface evidence rather than a live `P7` seam
    - `rg -n "_buildStreamDescriptor\\(|onDeactivate: \\(\\): boolean =>|onDeactivateRecovery|_recoverSubtitleDeactivation|_prepareBurnInSubtitleRecovery|_executeBurnInSubtitleRecovery" src/modules/player/PlaybackRecoveryManager.ts src/modules/player/SubtitleManager.ts src/modules/player/types.ts` confirmed that `_buildStreamDescriptor()` wires the deactivation callbacks only, while `PlaybackRecoveryManager` retains the player-owned burn-in recovery helpers
    - `rg -n "_recoverHandledSubtitleDeactivation|_notifySubtitleUnavailable\\(|_notifySubtitleDeactivated\\(" src/modules/player/SubtitleManager.ts` confirmed that `SubtitleManager` owns handled-deactivation dispatch and the generic unavailable fallback path
    - `npm run verify` passed
    - `npm run verify:docs` passed
  - Security triage: `no open P0 security findings`; the fresh `desloppify scan --path .` run reported `security: clean (332 files scanned)`
  - Follow-ups:
    - none; stale detector wording remains detector lag only and no live `P7` residual owner was proven on current source
  - Handoff: `P7 complete on current integration-branch evidence; P8-W1 may begin`

- [x] `P8-EXIT`
  - required: record every mapped imported issue with an exact disposition
  - run the priority-exit review before moving to `P9`
  - refresh every `P8` issue id, the `P8` detector envelopes, `desloppify status`, `desloppify plan queue`, `npm run verify`, and `npm run verify:docs`
  - confirm one single final owner for any `P8` issue that still needs a follow-up
  - Status: completed
  - Plan: `none (priority-exit reconciliation recorded directly in this checklist)`
  - Last touched: `2026-04-15`
  - Mapped imported issues:
    - `review::.::holistic::ai_generated_debt::diagnostic_payload_dump_logging` -> `resolved` (`desloppify show ... --status all` still reports stale `2026-04-10` evidence against removed `Diagnostics payload:` / `console.table(...)` output, but current `AppDiagnosticsSurface` now emits bounded summary fields only and the focused `P8-W1` tests plus full `npm run verify` stayed green)
    - `review::.::holistic::ai_generated_debt::templated_docblock_ceremony` -> `split follow-up` (`desloppify show ... --status all` still points at a deleted auth helper anchor plus scoped player files already cleaned in `P8-W2`, but a fresh repo-wide `@fileoverview|@module|@version` census still finds live production header residue outside this bounded Priority 8 slice; no narrower `P9` owner was proven, so the one remaining owner is `P10-W1 residual mechanical detector owner`)
    - `review::.::holistic::high_level_elegance::architecture_reference_drift` -> `resolved` (`desloppify show ... --status all` still reports stale pre-refresh EPG-specific evidence, but current `modules.md`, `CURRENT_STATE.md`, `src/Orchestrator.ts`, and the server-selection owners now agree on the runtime barrel and `SelectedServerRuntimeController` side-effect split)
  - Verification:
    - `desloppify scan --path .` refreshed (`overall 83.1 / strict 83.1 / objective 94.8 / verified 94.8`; open global `398`; `security: clean (333 files scanned)`; duplication detection warned that `jscpd` exited with errors, so duplication-specific output remains non-blocking supporting context rather than `P8` closeout proof)
    - `desloppify status` refreshed (`overall 83.1 / strict 83.1 / objective 94.8 / verified 94.8`; queue note remained `1 item (51 stale tracked · 1 subjective)`)
    - `desloppify show review --status open` returned `No open issues matching: review`
    - `desloppify plan queue` refreshed (`Queue: 1 item (51 planned · 1 subjective)`)
    - `desloppify show "review::.::holistic::ai_generated_debt::diagnostic_payload_dump_logging" --status all` still reports the imported row, but its evidence remains stale `2026-04-10` line references rather than any live `AppDiagnosticsSurface` spam
    - `desloppify show "review::.::holistic::ai_generated_debt::templated_docblock_ceremony" --status all` still reports the imported row, but it now cites deleted/scoped anchors while the fresh repo-wide header census below is the only live residual proof
    - `desloppify show "review::.::holistic::high_level_elegance::architecture_reference_drift" --status all` still reports the imported row, but it remains stale against current docs/source alignment
    - `desloppify show src/core/app-shell --status open --no-budget --top 100` shows only non-slice residual issues in `AppOrchestratorConfigFactory.ts`, `AppContainerFactory.ts`, `AppStartupUiInitializer.ts`, and `AppScreenVisibilityCoordinator.ts`
    - `desloppify show logs --status open --no-budget --top 50` shows only unrelated tagged-log findings outside `AppDiagnosticsSurface.ts`
    - `desloppify show README.md --status open --no-budget --top 50` returned `No open issues matching: README.md`
    - `rg -n "console\\.table|Diagnostics payload:" src/core/app-shell/AppDiagnosticsSurface.ts` returned no matches
    - `rg -n "@fileoverview|@module|@version" src --glob '!**/__tests__/**'` still finds broader repo-wide production header residue outside the scoped `P8-W2` auth/player files
    - `rg -n "thin public runtime entry barrel|SelectedServerRuntimeController|result shaping" docs/architecture/CURRENT_STATE.md docs/architecture/modules.md` returned the refreshed ownership text for `src/Orchestrator.ts` and the server-selection split
    - `rg -n "lineup_debug_epg_log|EPGDebugRuntime|debugRuntimeGuards" docs/architecture/modules.md docs/architecture/CURRENT_STATE.md src/modules/ui/epg/EPGDebugRuntime.ts src/modules/ui/epg/debugRuntimeGuards.ts` confirmed the prior EPG-specific imported evidence is stale on current docs/source
    - `npm run verify` passed
    - `npm run verify:docs` passed
  - Security triage: `no open P0 security findings`; the fresh scan reported `security: clean (333 files scanned)`, and the refreshed `desloppify show security --status open --no-budget --top 50` output listed only three non-`P8` T3 import-cycle issues (`OrchestratorCoordinatorBuilders.ts`, `ChannelSetupSessionController.ts`, `NowPlayingInfoCoordinator.ts`)
  - Follow-ups:
    - `followup::p8-exit::template-docblock-residual`
      owner: `P10-W1 residual mechanical detector owner`
      reason: the exact `P8` auth/player/doc-drift slice is resolved on current source, but the repo-wide production-header census still shows live template comment residue outside the scoped `P8-W2` files, so the remaining debt is one owned later cleanup envelope rather than a new `P9` or second `P8` successor.
      revisit trigger: rerun `desloppify show "review::.::holistic::ai_generated_debt::templated_docblock_ceremony" --status open --no-budget` + `rg -n "@fileoverview|@module|@version" src --glob '!**/__tests__/**'` + `desloppify show src/modules/player --status open --no-budget --top 150` + `desloppify show src/modules/plex --status open --no-budget --top 150` at `P10-W1` entry and before `P10-EXIT`; keep `P9` free of this residual unless current source proves a narrower earlier owner.
  - Handoff: `P8 complete on current integration-branch evidence; P9-W1 may begin after the normal cleanup plan/review workflow`

- [x] `P9-EXIT`
  - required: record every mapped imported issue with an exact disposition and the final detector-only test debt that remains, if any
  - run the priority-exit review before moving to `P10`
  - refresh every `P9` issue id, the `P9` detector envelopes, `desloppify status`, `desloppify plan queue`, and the strongest test verification used by the closing slice
  - confirm one single final owner for any `P9` issue or residual detector debt that still needs a follow-up
  - Status: completed
  - Plan: `none (priority-exit reconciliation recorded directly in this checklist)`
  - Last touched: `2026-04-15`
  - Mapped imported issues:
    - `review::.::holistic::test_strategy::private_api_test_coupling` -> `resolved` (`desloppify show ... --status all` still reports stale legacy evidence against `playback-flow.test.ts` and umbrella prototype spying, but current source no longer contains the private helper access retired in `P9-W1`, `App.test.ts` remains on the public-port allowlist only, and `Orchestrator.test.ts` now limits assembly interception to the AppOrchestrator-owned `ensureEPGInitialized()` callback path while focused coordinator owner suites cover the builder/assembly seams)
  - Verification:
    - `desloppify scan --path .` refreshed (`Last scan: 2026-04-15T17:12:23+00:00`; `overall 83.1 / objective 94.8 / strict 83.1 / verified 94.8`; `Security 99.6%`; duplication detection warned that `jscpd` exited with errors, so duplication-specific output remains supporting context rather than `P9` closeout proof)
    - `desloppify status` refreshed (`Queue: 1 item (51 stale tracked · 1 subjective)`; `open (global): 401`)
    - `desloppify plan queue` refreshed (`Queue: 1 item (51 planned · 1 subjective)`)
    - `desloppify show signature --status open --no-budget --top 50` returned `No open issues matching: signature`
    - `desloppify show test_coverage --status open --no-budget --top 100` still reported `27` open rows, including the explicit `P9` residual matrix and the lower-priority Plex helper rows below
    - `desloppify show security --status open --no-budget --top 50` reported only the known T3 import-cycle rows (`OrchestratorCoordinatorBuilders.ts`, `ChannelSetupSessionController.ts`, `NowPlayingInfoCoordinator.ts`); no open `P0` security findings were reported
    - `desloppify show "review::.::holistic::test_strategy::private_api_test_coupling" --status all` still reports the imported review id, but its evidence is stale against current source
    - `desloppify show src/__tests__ --status open --no-budget --top 200` returned `No open issues matching: src/__tests__`
    - `desloppify show src/core --status open --no-budget --top 200` and `desloppify show src/modules/ui/channel-setup --status open --no-budget --top 200` still reported the explicit detector-lag rows plus non-test smell/cycle residue outside this exit
    - `npm test -- --runInBand src/core/orchestrator/__tests__/OrchestratorCoordinatorAssembly.test.ts src/core/orchestrator/__tests__/OrchestratorCoordinatorBuilders.test.ts src/core/orchestrator/__tests__/OrchestratorCoordinatorFactory.playbackState.test.ts src/__tests__/Orchestrator.test.ts` passed
    - `npm test -- --runInBand src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupSessionState.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupSessionRuntime.test.ts src/modules/ui/channel-setup/steps/__tests__/BuildProgressStepController.test.ts src/modules/ui/channel-setup/steps/__tests__/BuildReviewStepController.test.ts src/modules/ui/channel-setup/steps/__tests__/LibraryStepController.test.ts src/modules/ui/channel-setup/steps/__tests__/StrategyStepController.test.ts` passed
    - `npm test -- --runInBand src/__tests__/index.test.ts src/config/__tests__/timing.test.ts src/modules/ui/settings/__tests__/SettingsToggle.test.ts src/modules/ui/epg/model/__tests__/adapters.test.ts src/shared/__tests__/subtitle-formats.test.ts src/shared/__tests__/subtitle-mode.test.ts src/utils/__tests__/formatAudioLabel.test.ts src/utils/__tests__/mediaFormat.test.ts` passed
    - `npm test -- --runInBand src/core/app-shell/__tests__/AppOrchestratorConfigFactory.test.ts src/core/channel-setup/__tests__/ChannelSetupTagFilters.test.ts src/core/server-selection/__tests__/SelectedServerRuntimeController.test.ts src/modules/player/__tests__/ErrorHandler.test.ts src/modules/player/__tests__/subtitleFallbackPipeline.test.ts` passed
    - `rg -nP "spyOn\\(AppOrchestrator\\.prototype, '(?!(initialize|start|shutdown|registerErrorHandler|setNowPlayingHandler|onScreenChange|onLifecycleEvent|getNavigation|getCurrentScreen|isReady|refreshPlaybackInfoSnapshot|getRecoveryActions)')" src/__tests__/App.test.ts` returned no matches
    - `rg -n "_buildDailyScheduleConfig|as unknown as AppOrchestrator|private|spyOn\\(AppOrchestrator\\.prototype" src/__tests__/orchestrator/playback-flow.test.ts` returned no matches
    - `npm run verify` passed
    - `npm run verify:docs` passed
  - Residuals:
    - `test_coverage::src/core/app-shell/AppOrchestratorConfigFactory.ts::transitive_only`, `test_coverage::src/core/channel-setup/ChannelSetupTagFilters.ts::transitive_only`, `test_coverage::src/core/server-selection/SelectedServerRuntimeController.ts::transitive_only`, `test_coverage::src/modules/player/ErrorHandler.ts::transitive_only`, and `test_coverage::src/modules/player/subtitleFallbackPipeline.ts::transitive_only` -> `resolved on current-source proof in P9-EXIT`; direct owner tests already exist, passed on the refreshed branch evidence, and no fresh source audit justifies duplicating behavior coverage solely to satisfy stale detector wording
    - `test_coverage::src/core/orchestrator/OrchestratorEventCleanupReporter.ts::transitive_only` -> `resolved in P9-EXIT as orchestrator-helper detector residue`; current source shows a tiny orchestrator-only type/summarizer seam imported by `OrchestratorEventBinder.ts`, `OrchestratorRuntimeSeams.ts`, and `AppOrchestrator.ts`, and no fresh source audit justifies inventing a new public or direct-test seam
    - `test_coverage::src/core/orchestrator/OverlayPorts.ts::transitive_only`, `test_coverage::src/core/server-selection/ServerSelectionTypes.ts::transitive_only`, and `test_coverage::src/modules/ui/epg/model/domainTypes.ts::transitive_only` -> `resolved in P9-EXIT as type-only detector limitation`; these files are type-only contracts / picks / interfaces rather than live runtime seams needing new Priority 9 tests
  - Security triage: `no open P0 security findings`; the refreshed security output reported only the three non-`P9` T3 import-cycle issues above
  - Follow-ups:
    - `followup::p9-exit::outside-priority-test-coverage-residual`
      owner: `P10-W1 residual mechanical detector owner`
      exact issue ids: `test_coverage::src/modules/plex/auth/plexAuthPayloadParsers.ts::transitive_only`, `test_coverage::src/modules/plex/shared/fetchWithTimeoutCore.ts::transitive_only`, `test_coverage::src/modules/plex/stream/hdr.ts::transitive_only`, `test_coverage::src/modules/plex/stream/plexSessionId.ts::transitive_only`
      reason: these rows stayed open in the refreshed scan but remain outside Priority 9 startup/channel-setup/player/helper scope; `plexAuthPayloadParsers.ts` already has direct owner tests while `fetchWithTimeoutCore.ts`, `hdr.ts`, and `plexSessionId.ts` are lower-priority Plex helper coverage residue. No Priority 9-owned detector mismatch or type-only row is being transferred to `P10`.
      revisit trigger: rerun `desloppify scan --path .` + `desloppify show test_coverage --status open --no-budget --top 100` + `desloppify show src/modules/plex/auth --status open --no-budget --top 150` + `desloppify show src/modules/plex/shared --status open --no-budget --top 100` + `desloppify show src/modules/plex/stream --status open --no-budget --top 150` at `P10-W1` entry and before `P10-EXIT`; keep the Priority 9 matrix closed unless fresh source proof shows a still-live earlier owner was missed.
  - Handoff: `P9 complete on current integration-branch evidence; P10-W1 may begin for residual mechanical detector envelopes and inherited non-P9 follow-ups`

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

### [x] `P3-W2` Reshape The EPG Package And Naming Surface

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

- Status: completed
- Plan: `docs/plans/2026-04-13-p3-w2-epg-package-shape-and-naming-surface.md`
- Last touched: `2026-04-15`
- Verification:
  - `npm test -- src/modules/ui/epg/__tests__/index.test.ts src/modules/ui/epg/__tests__/DeferredEpgComponent.test.ts src/modules/ui/epg/__tests__/buildEpgStartupConfig.test.ts src/modules/ui/epg/__tests__/debugRuntimeGuards.test.ts src/modules/ui/epg/__tests__/EPGCoordinator.test.ts src/core/__tests__/InitializationCoordinator.test.ts src/__tests__/Orchestrator.test.ts src/modules/ui/epg/runtime/__tests__/index.test.ts src/modules/ui/epg/__tests__/EPGRefreshController.test.ts` passed
  - `rg -n "from './runtime'" src/modules/ui/epg/EPGRefreshController.ts` returned one package-local barrel import
  - `rg -n "runtime/(EPGScheduleRefreshRuntime|EPGVisibleRangeRefreshQueue)" src/modules/ui/epg/EPGRefreshController.ts` returned no matches
  - `npm run verify` passed
  - `npm run verify:docs` passed
  - `desloppify scan --path .` refreshed detector evidence on current branch code
  - `desloppify show "review::.::holistic::naming_quality::epg_acronym_casing_drift" --status open --no-budget` returned no open issues
  - `desloppify show "review::.::holistic::package_organization::epg_root_flat_overload" --status open --no-budget` returned no open issues
  - `desloppify show src/modules/ui/epg --status open --no-budget --top 250` no longer reports `facade::src/modules/ui/epg/runtime/index.ts`
  - `desloppify show flat_dirs --status open --no-budget --top 50` returned no open issues
  - `desloppify show naming --status open --no-budget --top 50` returned no open issues
- Follow-ups:
  - none for the mapped `P3-W2` issue set; non-mapped `facade::src/modules/ui/epg/model/index.ts` is carried in `P3-EXIT` as `followup::p3-exit::epg-model-index-facade-residue`
- Handoff: `P3-EXIT reconciliation and review handoff`

## Priority 4: Simplify Lifecycle, Navigation, Initialization, And App-Owned Startup Seams

### [x] `P4-W1` Collapse Ceremony Around Lifecycle And Navigation Contracts

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

- Status: completed
- Plan: `docs/plans/2026-04-14-p4-w1-lifecycle-navigation-contract-ceremony.md`
- Last touched: `2026-04-15`
- Verification:
  - `npm test -- src/modules/lifecycle/__tests__/StateManager.test.ts src/modules/lifecycle/__tests__/ErrorRecovery.test.ts src/modules/lifecycle/__tests__/AppLifecycle.test.ts src/__tests__/Orchestrator.test.ts` passed
  - `npm test -- src/modules/navigation/__tests__/NavigationManager.test.ts src/modules/navigation/__tests__/NavigationCoordinator.test.ts src/core/app-shell/__tests__/AppScreenVisibilityCoordinator.test.ts src/core/initialization/__tests__/InitializationStartupPolicy.test.ts src/__tests__/App.test.ts src/__tests__/Orchestrator.test.ts` passed
  - `npm run verify` passed
  - `rg -n "new (DeveloperSettingsStore|ProfileSessionStore)" src/modules/navigation` returned no matches
  - `rg -n "getScreenParams\(" src/App.ts src/core/app-shell/AppScreenVisibilityCoordinator.ts src/modules/navigation` returned no matches
  - `rg -n "Record<string, unknown>" src/modules/navigation/interfaces.ts src/modules/navigation/NavigationManager.ts src/core/app-shell/AppScreenVisibilityCoordinator.ts` returned one interfaces-only comment match and no live generic runtime seam usage
  - `rg -n "goTo\('server-select', \{ allowAutoConnect:" src/core/orchestrator/AppOrchestrator.ts src/modules/navigation/NavigationCoordinator.ts` returned explicit typed server-select route usage only
  - `rg -n "goTo\('server-select'\)" src/core/orchestrator/AppOrchestrator.ts src/core/initialization/InitializationStartupPolicy.ts` returned intentional no-param recovery/startup reset routes only
  - `rg -n "getServerSelectParams\(" src/App.ts src/core/app-shell/AppScreenVisibilityCoordinator.ts src/modules/navigation` returned the focused server-select seam only
  - `rg -n "IStateManager|IErrorRecovery|getErrorRecovery\(" src/modules/lifecycle src/core/orchestrator/AppOrchestrator.ts` returned no production matches
  - `desloppify scan --path .` completed successfully
  - `desloppify show "review::.::holistic::abstraction_fitness::lifecycle_single_impl_interfaces" --status open --no-budget` returned no open issues
  - `desloppify show "review::.::holistic::logic_clarity::redundant_async_forwarders" --status open --no-budget` returned no open issues
  - `desloppify show "review::.::holistic::logic_clarity::predicate_ladders_obscure_intent" --status open --no-budget` returned no open issues
  - `desloppify show "review::.::holistic::mid_level_elegance::navigation_hidden_store_reads" --status open --no-budget` returned no open issues
  - `desloppify show "review::.::holistic::type_safety::generic_navigation_param_bag" --status open --no-budget` returned no open issues
  - `desloppify show src/modules/lifecycle --status open --no-budget --top 100` shows only non-slice `smells::src/modules/lifecycle/AppLifecycle.ts::hardcoded_url`
  - `desloppify show src/modules/navigation --status open --no-budget --top 150` shows only non-slice `smells::src/modules/navigation/NavigationCoordinator.ts::console_error_no_throw` and `smells::src/modules/navigation/NavigationCoordinator.ts::async_no_await`
  - `desloppify show responsibility_cohesion --status open --no-budget --top 50` returned no open issues
- Follow-ups:
  - mapped imported issue ids were already silent before implementation; closeout is based on current-source proof plus refreshed detector evidence, and all mapped `P4-W1` ids are resolved
  - non-mapped residual smells remain for later mechanical burn-down under `P10-W1`: `smells::src/modules/lifecycle/AppLifecycle.ts::hardcoded_url`, `smells::src/modules/navigation/NavigationCoordinator.ts::console_error_no_throw`, and `smells::src/modules/navigation/NavigationCoordinator.ts::async_no_await`
- Handoff: `P4-W2` is now the next safe start for startup/theme seam cleanup

### [x] `P4-W2` Move Startup And Theme State Into App-Owned Seams

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

- Status: completed
- Plan: `docs/plans/2026-04-14-p4-w2-startup-theme-app-owned-seams.md`
- Last touched: `2026-04-14`
- Verification:
  - `npm test -- src/core/app-shell/__tests__/AppThemeController.test.ts src/modules/ui/settings/__tests__/SettingsScreenStateController.test.ts src/modules/ui/settings/__tests__/SettingsScreen.test.ts src/__tests__/App.test.ts` passed
  - `npm test -- src/core/app-shell/__tests__/AppStartupUiInitializer.test.ts src/core/__tests__/InitializationCoordinator.test.ts src/__tests__/Orchestrator.test.ts` passed
  - `rg -n "from '../core'|from '..'" src/__tests__/Orchestrator.test.ts src/__tests__/orchestrator src/core/orchestrator/AppOrchestrator.ts` returned no matches
  - `rg -n "ThemeManager|getInstance\(" src/App.ts src/core src/modules/ui/settings src/__tests__` returned no matches
  - `desloppify show src/core/initialization --status open --no-budget --top 100` now reports only non-slice `InitializationStartupPolicy` smells; `InitializationUiInitializer` residue is gone after `desloppify scan --path .`
  - `desloppify show src/core --status open --no-budget --top 100` reports broader non-slice residual core debt only
  - `desloppify show test_coverage --status open --no-budget --top 100` no longer reports `test_coverage::src/core/initialization/InitializationUiInitializer.ts::transitive_only`
  - `npm run verify` passed
  - `npm run verify:docs` passed
- Follow-ups:
  - mapped imported issue ids were silent on refresh before/after implementation; closure is based on current-source proof plus direct tests and refreshed detector evidence for the moved seams
  - no new `P4-W2` split follow-up ids; remaining core/test-coverage detector issues are outside this slice and remain owned by later checklist priorities (`P4-EXIT`/`P10-W1`)
- Handoff: run `P4-EXIT` priority-exit reconciliation before any `P5` planning or implementation

## Priority 5: Unify Storage And Settings Contracts

### [x] `P5-W1` Normalize Storage Write Contracts

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

- Status: completed
- Plan: `docs/plans/2026-04-14-p5-w1-storage-write-contract-normalization.md`
- Last touched: `2026-04-14`
- Verification:
  - `npm test -- --runInBand src/utils/__tests__/storage.test.ts src/modules/settings/__tests__/EpgPreferencesStore.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelPersistenceStore.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelRepository.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts` passed
  - `npm run verify` passed
  - `desloppify show src/utils/storage.ts --status open --no-budget --top 50` returned no open matches
  - `desloppify show src/modules/settings --status open --no-budget --top 100` returned no open matches
  - `rg -n "write[A-Za-z0-9]+\\(.*\\): void" src/modules/settings/EpgPreferencesStore.ts` returned no matches
  - `rg -n "StoredChannelWriteResult|CurrentChannelWriteResult" src/modules/scheduler/channel-manager` returned no matches
  - `rg -n "safeLocalStorageSetWithResult|safeLocalStorageRemoveWithResult|writeTrimmedStringOrRemoveWithResult" src/utils/storage.ts src/modules/settings/EpgPreferencesStore.ts src/modules/scheduler/channel-manager/ChannelPersistenceStore.ts` confirmed one shared write-result helper surface across the slice
- Follow-ups:
  - imported `review::.::holistic::api_surface_coherence::storage_write_contract_fragmentation` was stale in the live queue; closure is based on current-source proof and targeted verification, not queue silence
  - `P5-W2` remains the planned owner for read-side cleanup naming/semantics
- Handoff: run `P5-W2` planning/review next; keep read-side cleanup separate from this write-contract slice

### [x] `P5-W2` Separate Read Semantics From Cleanup Writes

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

- Status: completed
- Plan: `docs/plans/2026-04-14-p5-w2-read-api-cleanup-semantics.md`
- Last touched: `2026-04-14`
- Verification:
  - `npm test -- --runInBand src/modules/plex/discovery/__tests__/ServerSelectionStore.test.ts src/modules/settings/__tests__/EpgPreferencesStore.test.ts src/modules/settings/__tests__/PlaybackSettingsStore.test.ts src/modules/ui/settings/__tests__/SettingsStore.test.ts src/modules/ui/settings/__tests__/SettingsScreenStateController.test.ts src/modules/ui/epg/__tests__/EPGCoordinator.test.ts src/core/initialization/__tests__/InitializationStartupPolicy.test.ts src/core/__tests__/InitializationCoordinator.test.ts src/modules/plex/auth/__tests__/PlexAuth.test.ts src/__tests__/Orchestrator.test.ts` passed
  - `npm run verify` passed
  - `rg -n "readSelectedServerId\\(|readServerHealthMap\\(|readLibraryTabsEnabled\\(|readAggressivePreloadEnabled\\(|readSelectedLibraryId\\(|readGuideDensity\\(|readLayoutMode\\(|readNowWatchingEnabled\\(|readGuideCategoryColorsEnabled\\(|readPastItemsWindow\\(|readScheduleRangeSnapshot\\(|readInfoBackgroundMode\\(|readTranscodeCompatEnabled\\(|readSmartHdr10FallbackEnabled\\(|readForceHdr10FallbackEnabled\\(|readHdr10FallbackMode\\(|readTranscodeQualityOption\\(|readTranscodeQualityValue\\(|readToggleSetting\\(|readHdr10FallbackModeValue\\(|readEpgLayoutModeValue\\(|readEpgGuideDensityValue\\(|readEpgPastItemsWindowValue\\(|readEpgInfoBackgroundModeValue\\(|readSubtitleLanguageValue\\(|readClampedNowPlayingAutoHideValue\\(|getStoredCredentials\\(" src/modules/plex/discovery src/modules/settings src/modules/ui/settings src/modules/plex/auth src/modules/ui/server-select src/modules/ui/channel-setup src/modules/ui/epg src/core src/__tests__ docs/api/plex-integration.md` returned only out-of-scope residual store reads plus private helper names in `SettingsScreenStateController`
- Follow-ups:
  - slice-owned discovery/auth/settings-facade seams now use explicit side-effecting read names and preserve the existing cleanup-on-read behavior
  - imported `review::.::holistic::contract_coherence::read-apis-hide-cleanup-writes` remains broader than this slice; current-source residual out-of-scope plain reads stay owned by `P10-W1 residual mechanical detector owner`
  - `P5-EXIT` must reconcile the exact residual inventory before any `P6` planning or implementation begins
- Handoff: run `P5-EXIT` priority-exit review/reconciliation next; do not open `P6` while `review::.::holistic::contract_coherence::read-apis-hide-cleanup-writes` residual ownership is still unreconciled

## Priority 6: Normalize Plex Auth, Discovery, Library, And Shared Type Surfaces

### [x] `P6-W1` Normalize Plex Auth Parsers And Fetch Contracts

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

- Status: completed
- Plan: `docs/plans/2026-04-14-p6-w1-plex-auth-parser-and-fetch-contract-normalization.md`
- Last touched: `2026-04-14`
- Verification:
  - `npm test -- --runInBand src/modules/plex/stream/__tests__/fetchWithTimeout.test.ts` passed
  - `npm test -- --runInBand src/modules/plex/auth/__tests__/PlexAuth.test.ts` passed
  - `npm test -- --runInBand src/modules/ui/profile-select/__tests__/ProfileSelectScreen.test.ts` passed
  - `npm test -- --runInBand src/core/initialization/__tests__/InitializationStartupPolicy.test.ts src/__tests__/tools/plexIntegrationDocs.test.ts` passed
  - `npm test -- --runInBand src/modules/plex/stream/__tests__/fetchWithTimeout.test.ts src/modules/plex/auth/__tests__/PlexAuth.test.ts src/modules/ui/profile-select/__tests__/ProfileSelectScreen.test.ts src/core/initialization/__tests__/InitializationStartupPolicy.test.ts src/__tests__/tools/plexIntegrationDocs.test.ts` passed
  - `npm run typecheck` passed
  - `npm run verify` passed
- Follow-ups: none
- Handoff: run `lineup-cleanup-review` for `P6-W1` implementation evidence before opening `P6-W2`

### [x] `P6-W2` Remove Hidden Plex State And Duplicate Library/Type Surfaces

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

- Status: completed
- Plan: `docs/plans/2026-04-14-p6-w2-plex-state-and-type-surface-normalization.md`
- Last touched: `2026-04-14`
- Verification:
  - `npm test -- --runInBand src/modules/plex/auth/__tests__/clientIdentifier.test.ts src/modules/plex/auth/__tests__/config.test.ts src/modules/plex/auth/__tests__/PlexAuth.test.ts` passed
  - `npm test -- --runInBand src/modules/plex/library/__tests__/PlexLibrary.test.ts src/modules/plex/library/__tests__/ResponseParser.test.ts src/modules/plex/library/__tests__/types.test.ts` passed (`types.test.ts` is filtered by jest config and remained covered by `npm run verify` contract suite)
  - `npm test -- --runInBand src/modules/scheduler/channel-manager/__tests__/ContentResolver.test.ts src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts src/core/channel-setup/__tests__/ChannelSetupPlanner.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts` passed
  - `npm test -- --runInBand src/modules/plex/stream/__tests__/PlexStreamResolver.test.ts src/modules/plex/discovery/__tests__/PlexServerDiscovery.test.ts src/__tests__/tools/plexIntegrationDocs.test.ts` passed
  - `npm run typecheck` passed
  - `npm run verify` passed
  - `npm run verify:docs` passed
- Follow-ups: none
- Handoff: run `lineup-cleanup-review` for `P6-W2` implementation evidence, then execute `P6-EXIT` reconciliation before opening `P7`

## Priority 7: Repair Player And Playback Recovery Contracts

### [x] `P7-W1` Simplify Playback Recovery And Error Propagation

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

- Status: completed
- Plan: `docs/plans/2026-04-14-p7-w1-playback-recovery-and-error-propagation.md`
- Last touched: `2026-04-14`
- Verification:
  - `npm test -- --runInBand src/types/__tests__/app-errors.test.ts src/modules/player/__tests__/PlaybackRecoveryManager.test.ts src/modules/player/__tests__/VideoPlayer.test.ts src/modules/player/__tests__/error-taxonomy.test.ts src/__tests__/orchestrator/subtitle-track-recovery-warning-contract.test.ts src/modules/ui/playback-options/__tests__/PlaybackOptionsCoordinator.test.ts` passed
  - `npm run verify` passed
  - `rg -n "typeof maybe\\.code === \"string\"|typeof maybe\\.code === 'string'|as StreamResolverError\\[" src/modules/player/PlaybackRecoveryManager.ts` returned no matches
  - `rg -n 'const livePosition = \(\(\): number \| null =>|const clampedOffset = Math\.max\(0, Math\.min\(|this\._streamRecoveryInProgress = true;' src/modules/player/PlaybackRecoveryManager.ts` returned only the shared reload-executor guard and the normal `resolveStreamForProgram(...)` clamp site
  - `rg -n 'if \(!ok\)|ok === false|Subtitles unavailable for this item' src/modules/player/PlaybackRecoveryManager.ts src/core/orchestrator/SubtitleTrackRecoveryController.ts src/modules/ui/playback-options/PlaybackOptionsCoordinator.ts` returned no matches
  - `desloppify show src/modules/player --status open --no-budget --top 200` refreshed; no new `P7-W1`-specific player issues were introduced
  - `desloppify show logs --status open --no-budget --top 50` refreshed; no new log-only regressions were introduced by the Media Session warning change
  - `desloppify show smells --status open --no-budget --top 250` refreshed; no new recovery-helper smell was introduced by the shared reload executor
  - reran all four mapped `P7-W1` imported issue-id commands with `desloppify show ... --status open --no-budget --top 20`; each returned no open issues on current branch code
  - supplemental context: `desloppify show "review::.::holistic::ai_generated_debt::nested_defensive_catch_defaults" --status all` still reports stale pre-fix evidence against `PlaybackRecoveryManager`; current source no longer contains those blanket getter/live-position catch wrappers
  - supplemental context: `desloppify show "review::.::holistic::error_consistency::media_session_play_swallow" --status all` still reports stale pre-fix evidence; current `VideoPlayer` now routes Media Session `play()` failures through `_warnMediaSessionActionFailure('play', error)`
  - supplemental context: `desloppify show "review::.::holistic::low_level_elegance::playback_recovery_repeated_reload_choreography" --status all` still reports stale pre-extraction evidence; current source routes all four reload paths through `_executeRecoveryReload(...)`
  - supplemental context: `desloppify show "review::.::holistic::type_safety::raw_error_code_string_branching" --status all` now points at `src/core/channel-setup/ChannelSetupPlanningService.ts`, not the player recovery slice
- Follow-ups: `P7-W2` remains the next planned player cleanup slice; no additional `P7-W1` split follow-up is required from current-source evidence
- Handoff: run `lineup-cleanup-review` for `P7-W1` implementation evidence before opening `P7-W2`

### [x] `P7-W2` Normalize Player Public Surface And Migration Residue

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

- Status: completed
- Plan: `docs/plans/2026-04-14-p7-w2-player-public-surface-and-migration-residue.md`
- Last touched: `2026-04-15`
- Verification:
  - `npm test -- src/modules/player/__tests__/VideoPlayer.test.ts` passed
  - `npm test -- src/modules/player/__tests__/ErrorHandler.test.ts` passed
  - `npm test -- src/modules/ui/playback-options/__tests__/PlaybackOptionsCoordinator.test.ts` passed
  - `npm test -- src/__tests__/orchestrator/subtitle-track-recovery-warning-contract.test.ts` passed
  - `rg -n "from '../../player/constants'|from '../../modules/player/constants'" src/modules/ui/playback-options/PlaybackOptionsCoordinator.ts src/core/orchestrator/SubtitleTrackRecoveryController.ts` returned no matches
  - `rg -n "from './constants'" src/modules/player/PlaybackRecoveryManager.ts src/modules/player/SubtitleManager.ts` returned no matches
  - `rg -n "backward compatibility|export \{ VideoPlayer, mapMediaErrorCodeToPlaybackError \} from './VideoPlayer'|mapMediaErrorCodeToPlaybackError" src/modules/player` returned the canonical `ErrorHandler.ts` implementation, the player barrel export, the internal `RetryManager.ts` import/usage, and focused helper tests
  - `npm run typecheck` passed
  - `npm run verify` passed
- Follow-ups: `P7-EXIT` owns final evidence refresh and any detector-lag reconciliation; `P8-W1` must not begin until `P7-EXIT` records the priority-exit outcome
- Handoff: run `lineup-cleanup-review` for `P7-W2` implementation evidence, then execute `P7-EXIT` before opening `P8-W1`

## Priority 8: Remove Diagnostic Noise, Template Ceremony, And Doc Drift

### [x] `P8-W1` Replace Diagnostic Spam With Bounded Summaries

**Mapped imported review issues:**

- `review::.::holistic::ai_generated_debt::diagnostic_payload_dump_logging`

**Primary files:**

- `src/core/app-shell/AppDiagnosticsSurface.ts`

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show src/core/app-shell --status open --no-budget --top 100`
- `desloppify show logs --status open --no-budget --top 50`

**Exit rule:** diagnostics emit targeted summaries instead of object dumps and table spam.

- Status: completed
- Plan: `docs/plans/2026-04-15-p8-w1-diagnostic-summary-surface.md`
- Last touched: `2026-04-15`
- Verification:
  - `npm test -- --runInBand src/core/app-shell/__tests__/AppDiagnosticsChannelSetupSummary.test.ts src/core/app-shell/__tests__/AppDiagnosticsSurface.test.ts` passed
  - `npm run verify` passed
  - `rg -n "console\\.table|Diagnostics payload:" src/core/app-shell/AppDiagnosticsSurface.ts` returned no matches
  - `rg -n "dumpChannelSetupPlannerDiagnostics|dumpActiveChannelSetupPlannerDiagnostics" src/core/app-shell/AppDiagnosticsSurface.ts src/core/app-shell/__tests__/AppDiagnosticsSurface.test.ts` returned the expected helper entry points plus their contract coverage
  - `desloppify show src/core/app-shell --status open --no-budget --top 100` shows only non-slice residual issues in `AppOrchestratorConfigFactory.ts`, `AppContainerFactory.ts`, `AppStartupUiInitializer.ts`, and `AppScreenVisibilityCoordinator.ts`
  - `desloppify show logs --status open --no-budget --top 50` shows only unrelated tagged-log findings outside `AppDiagnosticsSurface.ts`
  - `desloppify show "review::.::holistic::ai_generated_debt::diagnostic_payload_dump_logging" --status all` still reports the imported review id, but its evidence cites removed `Diagnostics payload:` / `console.table(...)` output at stale `AppDiagnosticsSurface.ts:197-209` line ranges rather than any live current-source spam
- Follow-ups:
  - `review::.::holistic::ai_generated_debt::diagnostic_payload_dump_logging` is resolved on current-source proof plus passing tests; the current `desloppify` row is stale detector wording and should stay detector-lag only unless a later refresh finds a new live owner
- Handoff: `P8-W2` is now the next safe start for docblock and architecture-doc cleanup

### [x] `P8-W2` Remove Template Docblocks And Refresh Architecture Docs

**Mapped imported review issues:**

- `review::.::holistic::ai_generated_debt::templated_docblock_ceremony`
- `review::.::holistic::high_level_elegance::architecture_reference_drift`

**Primary files:**

- `src/modules/plex/auth/interfaces.ts`
- `src/modules/player/interfaces.ts`
- `src/modules/player/VideoPlayer.ts`
- `docs/architecture/CURRENT_STATE.md`
- `docs/architecture/modules.md`

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show README.md --status open --no-budget --top 50`
- `npm run verify:docs`

**Exit rule:** architecture docs match runtime ownership and code comments keep only non-obvious contract detail.

- Status: completed
- Plan: `docs/plans/2026-04-15-p8-w2-template-docblock-and-architecture-doc-refresh.md`
- Last touched: `2026-04-15`
- Verification:
  - `npm run typecheck` passed
  - `npm run verify:docs` passed
  - `rg -n "@fileoverview|@module|@version|Video Player Interface|Plex Authentication Interface|Key features:" src/modules/plex/auth/interfaces.ts src/modules/player/interfaces.ts src/modules/player/VideoPlayer.ts` returned no matches
  - `rg -n "thin public runtime entry barrel|SelectedServerRuntimeController|result shaping" docs/architecture/CURRENT_STATE.md docs/architecture/modules.md` returned the refreshed ownership text for `src/Orchestrator.ts` and the server-selection split
  - `rg -n "EPGDebugRuntime|debugRuntimeGuards" docs/architecture/modules.md docs/architecture/CURRENT_STATE.md` continued to show the existing EPG debug-runtime ownership wording, confirming the prior detector evidence was stale rather than a live drift in current docs
- Follow-ups:
  - `review::.::holistic::ai_generated_debt::templated_docblock_ceremony` is resolved for this slice's live auth/player anchors; `P8-EXIT` owns the integration-branch detector refresh plus any broader residual template-header debt outside the scoped files
  - `review::.::holistic::high_level_elegance::architecture_reference_drift` is resolved on current-source proof for `src/Orchestrator.ts` and the server-selection split; `P8-EXIT` owns final stale-detector reconciliation if the imported row still cites old wording
- Handoff: run `lineup-cleanup-review` for `P8-W2` implementation evidence, then execute `P8-EXIT` before opening `P9-W1`

## Priority 9: Rebuild Test Seams Instead Of Fighting Them

### [x] `P9-W1` Remove Private-API Test Coupling

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

- Status: completed
- Plan: `docs/plans/2026-04-15-p9-w1-private-api-test-seams.md`
- Last touched: `2026-04-15`
- Verification:
  - `npm test -- --runInBand src/modules/player/__tests__/SubtitleManager.test.ts src/modules/player/__tests__/subtitleFallbackPipeline.test.ts` passed
  - `npm test -- --runInBand src/__tests__/App.test.ts src/core/app-shell/__tests__/AppDiagnosticsSurface.test.ts src/core/app-shell/__tests__/AppContainerFactory.test.ts src/core/app-shell/__tests__/AppOrchestratorConfigFactory.test.ts src/core/app-shell/__tests__/AppLazyScreenRegistry.test.ts` passed
  - `npm test -- --runInBand src/__tests__/orchestrator/playback-flow.test.ts src/modules/player/__tests__/SubtitleManager.test.ts src/modules/player/__tests__/subtitleFallbackPipeline.test.ts src/__tests__/App.test.ts` passed
  - `npm run typecheck` passed
  - `npm run verify` passed
  - `rg -n "spyOn\\(AppOrchestrator\\.prototype" src/__tests__/App.test.ts` returned only the allowlisted App-owned public-port spies: `initialize`, `start`, `shutdown`, `registerErrorHandler`, `setNowPlayingHandler`, `onScreenChange`, `onLifecycleEvent`, `getNavigation`, `getCurrentScreen`, `isReady`, `refreshPlaybackInfoSnapshot`, and `getRecoveryActions`
  - `rg -nP "spyOn\\(AppOrchestrator\\.prototype, '(?!(initialize|start|shutdown|registerErrorHandler|setNowPlayingHandler|onScreenChange|onLifecycleEvent|getNavigation|getCurrentScreen|isReady|refreshPlaybackInfoSnapshot|getRecoveryActions)')" src/__tests__/App.test.ts` returned no matches
  - `rg -n "_buildDirectTrackUrl|_fetchFallbackBlobUrl|_deriveLanHttpUrl|_triggerFallback|_trackElements|_readyTracks|spyOn\\(appUnderTest as never|_lazyScreenRegistry" src/modules/player/__tests__/SubtitleManager.test.ts src/__tests__/App.test.ts` returned no matches
  - `rg -n "_buildDailyScheduleConfig|as any\\)|as unknown as .*_buildDailyScheduleConfig|private" src/__tests__/orchestrator/playback-flow.test.ts` returned no matches, confirming the imported playback-flow private-call evidence was already stale on current source
  - `desloppify show signature --status open --no-budget --top 50` reported no open `signature` issues
  - `desloppify show test_coverage --status open --no-budget --top 100` reported only broader `transitive_only` coverage residue; the bounded slice now includes direct `subtitleFallbackPipeline.test.ts` coverage for query/header auth fallback, LAN retry, HTML response rejection, stale-load short-circuit, transcode fallback, and XHR fallback, with no new private-coupling rationale
  - `desloppify show src/__tests__ --status open --no-budget --top 150` reported no open issues under `src/__tests__`
  - `desloppify show "review::.::holistic::test_strategy::private_api_test_coupling" --status all` still reports the imported review id, but its evidence cites stale `playback-flow.test.ts` wording plus broader prototype-spy debt outside this bounded slice
- Follow-ups:
  - `review::.::holistic::test_strategy::private_api_test_coupling` is resolved for the `P9-W1` bounded files on current-source proof: `SubtitleManager.test.ts` now covers observable subtitle behavior, while `subtitleFallbackPipeline.test.ts` covers the deterministic `fetchSubtitleFallbackVtt` helper paths including HTML response rejection and stale-load short-circuiting; `App.test.ts` no longer depends on private `App` seams or non-allowlisted `AppOrchestrator.prototype` spies, and `playback-flow.test.ts` was already compliant
  - `P9-W2` is the single final owner for broader remaining prototype-spy and detector-lag cleanup outside this bounded slice, including residual review evidence that still references repo-wide test debt such as `src/__tests__/Orchestrator.test.ts`
- Handoff: run `lineup-cleanup-review` for `P9-W1` implementation evidence; `P9-W2` remains the next checklist owner for broader test-only detector debt

### [x] `P9-W2` Burn Down Remaining Test-Only Detector Debt

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

- Status: completed
- Plan: `docs/plans/2026-04-15-p9-w2-test-detector-burndown.md`
- Last touched: `2026-04-15`
- Verification:
  - `npm test -- --runInBand src/core/orchestrator/__tests__/OrchestratorCoordinatorAssembly.test.ts src/core/orchestrator/__tests__/OrchestratorCoordinatorBuilders.test.ts src/core/orchestrator/__tests__/OrchestratorCoordinatorFactory.playbackState.test.ts src/__tests__/Orchestrator.test.ts` passed
  - `npm test -- --runInBand src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupSessionState.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupSessionRuntime.test.ts src/modules/ui/channel-setup/steps/__tests__/BuildProgressStepController.test.ts src/modules/ui/channel-setup/steps/__tests__/BuildReviewStepController.test.ts src/modules/ui/channel-setup/steps/__tests__/LibraryStepController.test.ts src/modules/ui/channel-setup/steps/__tests__/StrategyStepController.test.ts` passed
  - `npm test -- --runInBand src/__tests__/index.test.ts src/config/__tests__/timing.test.ts src/modules/ui/settings/__tests__/SettingsToggle.test.ts src/modules/ui/epg/model/__tests__/adapters.test.ts src/shared/__tests__/subtitle-formats.test.ts src/shared/__tests__/subtitle-mode.test.ts src/utils/__tests__/formatAudioLabel.test.ts src/utils/__tests__/mediaFormat.test.ts` passed
  - `desloppify scan --path .` completed; `desloppify status` reported `Last scan: 2026-04-15T16:14:52+00:00`, `Scores: overall 83.1 / objective 94.8 / strict 83.1 / verified 94.8`, and `Security 99.6%`
  - `desloppify show signature --status open --no-budget --top 50` reported no open issues
  - `desloppify show test_coverage --status open --no-budget --top 100` still reported `27` open `transitive_only` / `untested_module` rows even after the current-source direct-suite refresh
  - `desloppify show src/__tests__ --status open --no-budget --top 200` reported no open issues under `src/__tests__`
  - `desloppify show src/core --status open --no-budget --top 200` and `desloppify show src/modules/ui/channel-setup --status open --no-budget --top 200` still reported the detector-lag `test_coverage` rows plus non-test smell/cycle residue outside this slice
  - `desloppify show security --status open --no-budget --top 50` reported only the known T3 import-cycle rows (`OrchestratorCoordinatorBuilders.ts`, `ChannelSetupSessionController.ts`, `NowPlayingInfoCoordinator.ts`); no open `P0` security findings were reported
  - `npm run typecheck` passed
  - `npm run verify` passed
  - `npm run verify:docs` passed
- Follow-ups:
  - resolved by direct P9-W2 suites on current-source proof: `src/index.ts`, `src/config/timing.ts`, `src/core/orchestrator/OrchestratorCoordinatorAssembly.ts`, `src/core/orchestrator/OrchestratorCoordinatorBuilders.ts`, `src/modules/ui/channel-setup/ChannelSetupSessionState.ts`, `src/modules/ui/channel-setup/ChannelSetupSessionRuntime.ts`, `src/modules/ui/channel-setup/steps/BuildReviewStepController.ts`, `src/modules/ui/channel-setup/steps/LibraryStepController.ts`, `src/modules/ui/channel-setup/steps/StrategyStepController.ts`, `src/modules/ui/epg/model/adapters.ts`, `src/modules/ui/settings/SettingsToggle.ts`, `src/shared/subtitle-formats.ts`, `src/shared/subtitle-mode.ts`, `src/utils/formatAudioLabel.ts`, and `src/utils/mediaFormat.ts`
  - current-source detector mismatch with existing direct tests remains explicit for `src/core/app-shell/AppOrchestratorConfigFactory.ts`, `src/core/channel-setup/ChannelSetupTagFilters.ts`, `src/core/server-selection/SelectedServerRuntimeController.ts`, `src/modules/player/ErrorHandler.ts`, and `src/modules/player/subtitleFallbackPipeline.ts`
  - remaining Priority 9 orchestrator/helper residual stays explicit for `src/core/orchestrator/OrchestratorEventCleanupReporter.ts`; fresh source audit shows it is still imported by `OrchestratorEventBinder.ts`, `OrchestratorRuntimeSeams.ts`, and `AppOrchestrator.ts`, so `P9-EXIT` remains its single final owner unless new direct source proof shows it is no longer part of the startup/orchestrator/helper seam
  - type-only / detector-limitation residue remains explicit for `src/core/orchestrator/OverlayPorts.ts`, `src/core/server-selection/ServerSelectionTypes.ts`, and `src/modules/ui/epg/model/domainTypes.ts`
  - lower-priority residual `test_coverage` rows still open after the slice refresh: `src/modules/plex/auth/plexAuthPayloadParsers.ts`, `src/modules/plex/shared/fetchWithTimeoutCore.ts`, `src/modules/plex/stream/hdr.ts`, and `src/modules/plex/stream/plexSessionId.ts`
  - `P9-EXIT` remains the single final owner for any remaining Priority 9 detector-mismatch or type-only residue; do not hand these rows to `P10` without fresh source proof that the remaining live seam is no longer Priority 9-owned
- Handoff: run `lineup-cleanup-review` on the P9-W2 implementation evidence, then use `P9-EXIT` to disposition the remaining detector-lag/type-only matrix before any `P10` planning starts

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
- Status: planned
- Plan: `none yet`
- Last touched: `2026-04-14`
- Verification: `none yet (inherited P4 exact-mechanical follow-up recorded from current integration-branch evidence)`
- Follow-ups:
  - `followup::p4-exit::exact-p4-mechanical-residue`
    source: `P4-EXIT`
    exact issue ids: `smells::src/modules/lifecycle/AppLifecycle.ts::hardcoded_url`, `smells::src/modules/navigation/NavigationCoordinator.ts::console_error_no_throw`, `smells::src/modules/navigation/NavigationCoordinator.ts::async_no_await`, `smells::src/core/app-shell/AppStartupUiInitializer.ts::async_no_await`, `smells::src/core/InitializationCoordinator.ts::console_error_no_throw`
    required verification: `desloppify scan --path .` + `desloppify show src/modules/lifecycle --status open --no-budget --top 100` + `desloppify show src/modules/navigation --status open --no-budget --top 150` + `desloppify show src/core/app-shell --status open --no-budget --top 100` + `desloppify show src/core/InitializationCoordinator.ts --status open --no-budget --top 50`
- Handoff: `carry the exact P4 mechanical residue above into the first P10-W1 execution plan before P10-EXIT`

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

**Inherited follow-ups from `P3-EXIT` (must be explicitly dispositioned in this work item):**

- `followup::p3-exit::epg-model-index-facade-residue`
  - source exit: `P3-EXIT`
  - exact issue id: `facade::src/modules/ui/epg/model/index.ts`
  - required commands: `desloppify scan --path .`; `desloppify show facade --status open --no-budget --top 50`

**Inherited follow-ups from `P5-EXIT` (must be explicitly dispositioned in this work item):**

- `followup::p5-exit::read-api-cleanup-write-residual`
  - source exit: `P5-EXIT`
  - exact issue id: `review::.::holistic::contract_coherence::read-apis-hide-cleanup-writes`
  - required commands: `desloppify show "review::.::holistic::contract_coherence::read-apis-hide-cleanup-writes" --status open --no-budget`; `rg -n "readDtsPassthroughEnabled\\(|readDirectPlayAudioFallbackEnabled\\(|readAudioSetupComplete\\(|readDebugLoggingEnabled\\(|readSubtitleDebugLoggingEnabled\\(|readCinematicNowPlayingEnabled\\(|readPreferClearLogosEnabled\\(|readClampedAutoHideMs\\(|readShowProfilePickerOnStartup\\(|readKeepPlayingInSettings\\(|readLastProfileId\\(|readSubtitleMode\\(|readSubtitlePreferForced\\(|readSubtitleLanguage\\(|readTheme\\(|readNowPlayingStreamDebugEnabled\\(|readNowPlayingStreamDebugAutoShowEnabled\\(|readEpgDebugEnabled\\(|readTranscodeProfileName\\(" src/modules/settings/AudioSettingsStore.ts src/modules/settings/DeveloperSettingsStore.ts src/modules/settings/NowPlayingDisplayStore.ts src/modules/settings/ProfileSessionStore.ts src/modules/settings/SubtitlePreferencesStore.ts src/modules/settings/ThemePreferencesStore.ts src/modules/debug/DebugOverridesStore.ts src/bootstrap.ts src/modules/player src/modules/ui src/core src/__tests__`; `desloppify show src/modules/settings --status open --no-budget --top 100`; `desloppify show src/modules/debug --status open --no-budget --top 100`

**Inherited follow-ups from `P8-EXIT` (must be explicitly dispositioned in this work item):**

- `followup::p8-exit::template-docblock-residual`
  - source exit: `P8-EXIT`
  - exact issue id: `review::.::holistic::ai_generated_debt::templated_docblock_ceremony`
  - required commands: `desloppify show "review::.::holistic::ai_generated_debt::templated_docblock_ceremony" --status open --no-budget`; `rg -n "@fileoverview|@module|@version" src --glob '!**/__tests__/**'`; `desloppify show src/modules/player --status open --no-budget --top 150`; `desloppify show src/modules/plex --status open --no-budget --top 150`

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
