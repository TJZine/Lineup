# Architecture Cleanup Checklist

> V5 established 2026-04-16 from the fresh holistic review imported from `.desloppify/subagents/runs/20260416_084655`.
>
> Archived prior wave: `docs/archive/checklists/2026-04-16-architecture-cleanup-checklist-wave-4.md`.
>
> Any pre-refresh copy preserved under `docs/_local/` is scratch-only and must not be treated as tracked handoff memory or current truth.

This document is the active cleanup queue for the live debt confirmed by the 2026-04-16 `desloppify` baseline.

This is the authoritative tracked backlog for this cleanup wave. Per [`docs/AGENTIC_DEV_WORKFLOW.md#authority-and-document-roles`](./docs/AGENTIC_DEV_WORKFLOW.md#authority-and-document-roles), `ARCHITECTURE_CLEANUP_CHECKLIST.md` is the live cleanup and status surface, while execution plans remain task-scoped memory that stay local by default unless durable tracked handoff memory is explicitly needed.

This checklist is not complete until a fresh authoritative rerun on the target integration branch proves all live 2026-04-16 review and mechanical debt is retired or stale-proven with current-source evidence, `strict` is greater than `87.2`, and `overall` is greater than `87.2`.

## Fresh-Session Handoff

- Last structural refresh: `2026-04-16` from `.desloppify/subagents/runs/20260416_084655`
- Prior completed ledger: `docs/archive/checklists/2026-04-16-architecture-cleanup-checklist-wave-4.md`
- Current execution state: fresh reset; no `V5` work unit has started yet
- Next safe start: `P0-W1`
- Authoritative evidence rule: only integration-branch `desloppify` reruns may change checklist status, baseline counts, exit records, or closeout claims
- Queue-trust signal to resolve first:
  - `desloppify status`: `Queue: 1 item (41 stale tracked · 1 subjective)`
  - `desloppify plan queue --sort recent`: `Queue: 1 item (41 planned · 1 subjective)`
  - `desloppify show review --status open --no-budget --top 100`: `41` live open review issues
- Reopen guardrails:
  - `src/Orchestrator.ts` is now a thin public barrel, not the old hotspot owner
  - `src/modules/ui/channel-setup/ChannelSetupSessionController.ts` is a small facade, not a fresh decomposition target unless new current-source proof appears
  - `src/modules/plex/auth/plexAuthPayloadParsers.ts` is focused enough; do not elevate it into a standalone hotspot absent new evidence
  - current cycle/security rows must be verified on current source before they are treated as live architecture regressions; some prior cycle noise is known stale residue

## Goal

- retire every live imported review issue and non-review detector envelope confirmed by the 2026-04-16 baseline
- improve the authoritative integration-branch baseline beyond `overall 87.2 / strict 87.2`
- keep one explicit final owner for every imported review envelope and one explicit detector-owner path for every remaining mechanical backlog slice

## Non-Goals

- do not reopen retired work just because older wording or stale tracked review state still exists
- do not close priorities on bookkeeping, suppressions, exclusions, archive cleanup, or prose-only improvements
- do not freeze unstable mechanical issue ids as permanent ownership records in this file
- do not turn this wave into a rewrite-the-world program; priorities stay surgical and owner-based

## How To Use This

- work top to bottom unless a production incident or explicit maintainer direction forces a different order
- keep the authoritative execution state in `update_plan`
- before code changes begin, create an execution-grade plan for the selected `P#-W#`; keep it local by default and promote it to `docs/plans/*` only when durable handoff memory is needed
- refresh the listed authoritative `desloppify` commands at the start and end of each work unit on the integration branch
- boxes are checked only after current-source proof, rerun evidence, and the mini-record fields below are current
- no `P(n+1)` work, tracked plan, or checklist progress starts before the current `P#-EXIT` is complete

## Work-Unit Status Contract

Each work unit and each `P#-EXIT` keeps the same compact shared ledger:

- `Status`: `not started`, `in progress`, `blocked`, or `completed`
- `Plan`: exact tracked plan path or `local-only`; `none yet` is explicit
- `Last touched`: exact date or `not started`
- `Verification`: exact latest commands and whether they passed; `not run` is explicit
- `Follow-ups`: exact inherited/deferred residuals with one owner, or `none yet`
- `Handoff`: next safe step, next owner, or blocking condition

Do not check a box unless the mini-record is updated in the same pass with current evidence.

## Fresh Evidence Snapshot

### Commands Run For The Current Baseline

- `desloppify status`
- `desloppify show review --status open --no-budget --top 100`
- `desloppify show security --status open --no-budget --top 50`
- `desloppify plan queue --sort recent`
- inspect `.desloppify/subagents/runs/20260416_084655/run_summary.json`
- inspect `.desloppify/subagents/runs/20260416_084655/holistic_issues_merged.json`
- inspect the completed `ARCHITECTURE_CLEANUP_CHECKLIST.md` wave being archived
- inspect `docs/archive/checklists/2026-03-26-architecture-cleanup-checklist-wave-2.md` for archive-note pattern
- inspect `.desloppify/state-typescript.json` for open detector inventory

### Run Summary

- Fresh run directory: `.desloppify/subagents/runs/20260416_084655`
- Import replay already succeeded: `desloppify review --import-run /Users/tristan/Software/Lineup/.desloppify/subagents/runs/20260416_084655 --scan-after-import`
- Run summary: `20 / 20` successful batches, `0` failed batches
- Merged output: `.desloppify/subagents/runs/20260416_084655/holistic_issues_merged.json`
- Review scope metadata: imported `20` subjective dimensions; no missing scored dimensions

### Current Post-Import Score State

- Last scan: `2026-04-16T09:51:26+00:00`
- `desloppify status`: `overall 87.2 / objective 94.9 / strict 87.2 / verified 94.2`
- Strict target `85.0` is already reached; checklist closeout still requires `strict > 87.2` and `overall > 87.2`
- Open issues: `393` total
- Open imported review issues: `41`
- Open non-review issues: `352`
- Subjective pool average: `84.7`
- Current security surface: `desloppify show security --status open --no-budget --top 50` reports `3` open `cycles` rows and no `P0` blocker beyond those detector envelopes

### Full 20-Dimension Subjective Scorecard

- `abstraction_fitness`: `80.0`
- `ai_generated_debt`: `78.0`
- `api_surface_coherence`: `81.0`
- `authorization_consistency`: `84.0`
- `contract_coherence`: `82.0`
- `convention_outlier`: `91.0`
- `cross_module_architecture`: `88.0`
- `dependency_health`: `96.0`
- `design_coherence`: `84.0`
- `error_consistency`: `82.0`
- `high_level_elegance`: `83.0`
- `incomplete_migration`: `88.0`
- `initialization_coupling`: `87.0`
- `logic_clarity`: `85.6`
- `low_level_elegance`: `88.7`
- `mid_level_elegance`: `87.0`
- `naming_quality`: `90.0`
- `package_organization`: `84.5`
- `test_strategy`: `84.0`
- `type_safety`: `84.0`

### Current Detector Inventory

These counts come from open work items in `.desloppify/state-typescript.json` and sum to the current `393` open issues:

- `smells`: `181`
- `structural`: `81`
- `review`: `41`
- `test_coverage`: `25`
- `facade`: `21`
- `logs`: `9`
- `signature`: `9`
- `stale_exclude`: `7`
- `responsibility_cohesion`: `5`
- `flat_dirs`: `5`
- `single_use`: `4`
- `cycles`: `3`
- `naming`: `1`
- `boilerplate_duplication`: `1`

### Queue-Trust And Current-Source Guards

- the `41` stale tracked review items are not allowed to remain implicit backlog truth after `P0`
- the one live subjective reminder is not implementation work; it is a queue-surface signal that must stay separated from the imported review backlog
- `dependency_health` has no live review issues despite the subjective reminder surface; do not invent dependency work just because the reminder exists
- do not treat stale historical complaints about `src/Orchestrator.ts`, `ChannelSetupSessionController`, or `plexAuthPayloadParsers.ts` as live backlog without fresh source proof from this baseline

## Discovery Trail

- Codanna index lookup succeeded (`9172` symbols / `550` files), which was enough to confirm repo-index health.
- Codanna document search was too imprecise for this archive-and-reset task, so final shaping used direct reads of:
  - `docs/AGENTIC_DEV_WORKFLOW.md`
  - `agents.md`
  - `docs/architecture/CURRENT_STATE.md`
  - the completed `ARCHITECTURE_CLEANUP_CHECKLIST.md` wave being archived
  - `docs/archive/checklists/2026-03-26-architecture-cleanup-checklist-wave-2.md`
  - `.desloppify/subagents/runs/20260416_084655/run_summary.json`
  - `.desloppify/subagents/runs/20260416_084655/holistic_issues_merged.json`
  - `.desloppify/state-typescript.json`
- Live owner mapping used `desloppify show review --status open --no-budget --top 100` as the authoritative open-review surface and used the merged run only for score/evidence context and full issue metadata.

## Review Backlog Shape By Dimension

- `abstraction_fitness`: `2`
- `ai_generated_debt`: `3`
- `api_surface_coherence`: `2`
- `authorization_consistency`: `2`
- `contract_coherence`: `3`
- `convention_outlier`: `1`
- `cross_module_architecture`: `2`
- `dependency_health`: `0`
- `design_coherence`: `3`
- `error_consistency`: `3`
- `high_level_elegance`: `3`
- `incomplete_migration`: `2`
- `initialization_coupling`: `2`
- `logic_clarity`: `1`
- `low_level_elegance`: `2`
- `mid_level_elegance`: `1`
- `naming_quality`: `2`
- `package_organization`: `2`
- `test_strategy`: `2`
- `type_safety`: `3`

## Mechanical Debt Planning Rule

Imported review issues are stable enough to track by exact id. The remaining `352` non-review issues are not.

Track mechanical debt in this checklist by:

- detector envelope
- owner area
- authoritative `desloppify show <area-or-detector> --status open --no-budget` commands
- entry and exit score snapshots
- explicit inherited follow-ups when a priority cannot retire all live detector residue in its area

Do not convert the current `352` non-review issue ids into long-lived ownership records here. Refresh them at each `P#-EXIT` instead.

## Companion Plan Rule

Before implementing any work unit below:

- keep the authoritative execution state in `update_plan`
- create an execution-grade plan with exact files in scope, exact files out of scope, mapped review issue ids, detector envelopes, verification commands, and rollback notes where ownership/persistence/startup/runtime seams change
- keep that plan local by default; promote it to `docs/plans/*` only when durable tracked handoff memory is explicitly needed
- if the slice is the last planned `P#-W#` item for a priority, include the priority-exit review steps and score-delta recording in the same plan before implementation starts

## Priority Overview

- `P0`: queue trust, stale tracked review-state retirement, and baseline lock
- `P1`: runtime/orchestrator ownership and priority-one assembly concentration
- `P2`: app-shell seams, package surfaces, and UI-owned persistence residue
- `P3`: Plex discovery/library/auth contract coherence
- `P4`: auth/profile/startup/lifecycle state coherence
- `P5`: player, playback, and subtitle-recovery ownership
- `P6`: channel-setup, scheduler, and EPG contract/package residue
- `P7`: template-comment, wrapper-sprawl, and low-value migration residue cleanup
- `P8`: type-safety, naming, and verification-ratchet cleanup
- `P9`: residual mechanical burn-down and score-gated final closeout

## Priority Skill Routing

- `P0`: docs/process only by default; add `architecture-boundaries` only if queue-trust cleanup changes tracked ownership rules
- `P1`: `architecture-boundaries`
- `P2`: `architecture-boundaries`, `ui-composition-patterns`, `persistence-boundaries`
- `P3`: `architecture-boundaries`, `plex-integration-boundaries`
- `P4`: `architecture-boundaries`, `plex-integration-boundaries`, `persistence-boundaries`, `ui-composition-patterns`
- `P5`: `architecture-boundaries`, `plex-integration-boundaries`
- `P6`: `architecture-boundaries`, `ui-composition-patterns`, `persistence-boundaries`
- `P7`: boundary skill matching touched files; default `architecture-boundaries`
- `P8`: `architecture-boundaries` plus the narrow boundary skill matching the touched owner area
- `P9`: only the skills needed by the remaining live residual owners; do not load broad skills by habit

## Execution Hygiene

- Disposition vocabulary:
  - `resolved`: the exact review issue or slice-owned detector rationale is retired on current source and backed by fresh rerun evidence
  - `deferred`: the issue stays open, but the record names the exact owner, reason, and revisit trigger
  - `split follow-up`: the current slice is not the final owner; the remaining live gap is handed to one exact later owner in this checklist
  - `owned follow-up`: the exact successor owner named by a `split follow-up` record; no shared implicit ownership
  - `priority-exit review`: the blocking review and rerun pass that closes a priority before any lower priority starts
  - `stale-proven`: current-source proof shows the live rationale is gone even if detector wording or tracked state still lags; this still requires a fresh rerun and exact evidence
  - `security triage`: `desloppify show security --status open --no-budget --top 50` has been refreshed and any live blocker is either retired or explicitly deferred with owner plus revisit trigger
- Issue-envelope ownership rule:
  - every imported review issue listed in this checklist has a single final owner the moment the wave starts
  - detector lag alone is not a reason to reassign an issue to a new owner
  - a completed work unit may hand remaining live debt to one exact later owner, but it may not leave ownership implicit
- Source-audit precedence rule:
  - when current-source proof shows the slice-owned rationale is gone, prefer `resolved` or `stale-proven` over inventing a new follow-up
  - use `split follow-up` only when current-source proof shows a genuinely different remaining owner
- Mechanical follow-up rule:
  - mechanical debt is tracked by detector envelope plus owner area, not by frozen issue ids
  - every `P#-EXIT` must record the entry and exit detector counts that matter for that priority and name the exact later owner for any surviving live residue
- Priority-exit score rule:
  - every `P#-EXIT` requires a fresh authoritative rerun on the integration branch
  - every `P#-EXIT` records `entry baseline`, `exit baseline`, and `delta`
  - if neither `overall` nor `strict` improves versus the priority-entry snapshot, the exit stays open unless all remaining live debt is explicitly handed to one later owner inside this checklist and the no-drop proof is updated in the same pass
- Priority-exit record format:
  - mapped imported issues with one disposition each
  - follow-up ownership for every `deferred` or `split follow-up`
  - relevant detector envelopes and counts at entry vs exit
  - `security triage`
  - exact verification commands
  - score delta versus the priority-entry snapshot
- Cleanup slice execution template:
  - `priority/work units`: exact `P#-W#` items in scope for the slice
  - `imported review issues`: exact mapped review ids being retired
  - `security triage`: `no open P0 security findings`, or the exact deferred/resolved blocker ids plus owner and revisit trigger
  - `verification`: exact commands that prove the slice is complete
  - `deferred items`: anything intentionally left open with one exact owner and revisit trigger
  - `proof matrix`: for each mapped imported issue, record whether the slice-owned rationale is retired on current source, whether live residual debt remains, and the single final owner if anything survives
- Priority exit command checklist:
  - rerun `desloppify status`
  - rerun `desloppify plan queue --sort recent`
  - rerun `desloppify show review --status open --no-budget --top 100`
  - rerun `desloppify show security --status open --no-budget --top 50`
  - rerun every exact area/detector command used to scope the closing priority
  - confirm every mapped imported issue for the priority is either retired here or explicitly deferred/split with a single final owner
  - do not mark progress on `P(n+1)` work until the current priority's `P#-EXIT` record is complete
- Final closeout rule:
  - the checklist itself cannot close on wording improvements, exclusions, suppressions, archive hygiene, or stale-state cleanup alone
  - `P9-EXIT` must prove `overall > 87.2`, `strict > 87.2`, no live 2026-04-16 review issue was dropped without owner or stale-proof disposition, and the remaining detector table is fully accounted for

## Priority Exit Gates

Each exit gate below is mandatory. Do not mark progress on `P(n+1)` work until the current `P#-EXIT` is complete with a fresh authoritative rerun and recorded score delta.

- [ ] `P0-EXIT`
  - required: record every mapped imported issue with an exact disposition, assign a single final owner for every deferred or split follow-up, and record the priority score delta before `P1`
  - required: reconcile the `41` stale tracked queue entries against the V5 owner map, record them as stale queue-state rather than live owner truth, lock the V5 owner map as the only live checklist truth, refresh `status`/`plan queue`/`review`/`security`, and record `entry vs exit` score deltas before `P1`
  - Status: not started
  - Plan: none yet; execution-grade plan required before edits
  - Last touched: not started
  - Verification: not run
  - Follow-ups: none yet
  - Handoff: `P1-W1` only after queue-trust and owner-map evidence is current
- [ ] `P1-EXIT`
  - required: record every mapped imported issue with an exact disposition, assign a single final owner for every deferred or split follow-up, and record the priority score delta before `P2`
  - required: runtime/orchestrator review issues are retired or explicitly reassigned, orchestrator detector residue is refreshed, and the exit records a positive score delta or an exact later-owner handoff inside this checklist
  - Status: not started
  - Plan: none yet; execution-grade plan required before edits
  - Last touched: not started
  - Verification: not run
  - Follow-ups: none yet
  - Handoff: `P2-W1` only after runtime/orchestrator exit evidence is complete
- [ ] `P2-EXIT`
  - required: record every mapped imported issue with an exact disposition, assign a single final owner for every deferred or split follow-up, and record the priority score delta before `P3`
  - required: app-shell/package seam issues are retired, `src/types` runtime-ownership drift is resolved or explicitly reassigned, persistence-adapter residue is accounted for, and the exit records a fresh score delta
  - Status: not started
  - Plan: none yet; execution-grade plan required before edits
  - Last touched: not started
  - Verification: not run
  - Follow-ups: none yet
  - Handoff: `P3-W1` only after app-shell/package exit evidence is complete
- [ ] `P3-EXIT`
  - required: record every mapped imported issue with an exact disposition, assign a single final owner for every deferred or split follow-up, and record the priority score delta before `P4`
  - required: Plex discovery/library/auth contract drift is retired or reassigned with one owner, library/discovery detector envelopes are refreshed, and the exit records a fresh score delta
  - Status: not started
  - Plan: none yet; execution-grade plan required before edits
  - Last touched: not started
  - Verification: not run
  - Follow-ups: none yet
  - Handoff: `P4-W1` only after Plex contract exit evidence is complete
- [ ] `P4-EXIT`
  - required: record every mapped imported issue with an exact disposition, assign a single final owner for every deferred or split follow-up, and record the priority score delta before `P5`
  - required: startup auth/profile state is coherent, lifecycle timing claims are honest, startup normalization tests are current, and the exit records a fresh score delta
  - Status: not started
  - Plan: none yet; execution-grade plan required before edits
  - Last touched: not started
  - Verification: not run
  - Follow-ups: none yet
  - Handoff: `P5-W1` only after startup/lifecycle exit evidence is complete
- [ ] `P5-EXIT`
  - required: record every mapped imported issue with an exact disposition, assign a single final owner for every deferred or split follow-up, and record the priority score delta before `P6`
  - required: playback recovery ownership is narrowed, subtitle-specific helper duplication is retired or reassigned with one owner, player/log detector envelopes are refreshed, and the exit records a fresh score delta
  - Status: not started
  - Plan: none yet; execution-grade plan required before edits
  - Last touched: not started
  - Verification: not run
  - Follow-ups: none yet
  - Handoff: `P6-W1` only after playback/subtitle exit evidence is complete
- [ ] `P6-EXIT`
  - required: record every mapped imported issue with an exact disposition, assign a single final owner for every deferred or split follow-up, and record the priority score delta before `P7`
  - required: channel-setup, scheduler, and EPG contract/package residue is retired or explicitly handed forward, area detector envelopes are refreshed, and the exit records a fresh score delta
  - Status: not started
  - Plan: none yet; execution-grade plan required before edits
  - Last touched: not started
  - Verification: not run
  - Follow-ups: none yet
  - Handoff: `P7-W1` only after channel/EPG exit evidence is complete
- [ ] `P7-EXIT`
  - required: record every mapped imported issue with an exact disposition, assign a single final owner for every deferred or split follow-up, and record the priority score delta before `P8`
  - required: template-comment noise, wrapper sprawl, and the toast migration residue are retired or reassigned with current-source proof; wording-only cleanup is not enough; the exit records a fresh score delta
  - Status: not started
  - Plan: none yet; execution-grade plan required before edits
  - Last touched: not started
  - Verification: not run
  - Follow-ups: none yet
  - Handoff: `P8-W1` only after AI-debt/migration exit evidence is complete
- [ ] `P8-EXIT`
  - required: record every mapped imported issue with an exact disposition, assign a single final owner for every deferred or split follow-up, and record the priority score delta before `P9`
  - required: type-safety, naming, and test-ratchet issues are retired or reassigned, verification envelopes are refreshed, and the exit records a fresh score delta
  - Status: not started
  - Plan: none yet; execution-grade plan required before edits
  - Last touched: not started
  - Verification: not run
  - Follow-ups: none yet
  - Handoff: `P9-W1` only after type-safety/test exit evidence is complete
- [ ] `P9-EXIT`
  - required: authoritative rerun on the integration branch records previous baseline, new baseline, delta, remaining open issues by detector, remaining open review issues, and proof that no live 2026-04-16 issue was dropped without an owner or stale-proof disposition; close only if `overall > 87.2` and `strict > 87.2`
  - Status: not started
  - Plan: none yet; execution-grade plan required before edits
  - Last touched: not started
  - Verification: not run
  - Follow-ups: none yet
  - Handoff: checklist complete only when this gate is satisfied

## Priority 0: Restore Queue Trust Before Cleanup Execution

### [ ] `P0-W1` Reconcile Stale Tracked Review State And Lock The V5 Baseline

**Goal:** make the V5 checklist the only live owner map before implementation starts.

**Required outcomes:**

- reconcile the `41` stale tracked review items so queue surfaces stop competing with the live imported review backlog
- confirm the one live subjective reminder stays outside the implementation queue unless a later rerun turns it into concrete review debt
- refresh the baseline commands and lock the detector inventory plus imported-owner map to the V5 checklist
- record any surviving queue-surface mismatch as repo-state, by-design semantics, or upstream tool defect with a local operating rule

**Primary files/areas:**

- `ARCHITECTURE_CLEANUP_CHECKLIST.md`
- `.desloppify/plan.json`
- `.desloppify/state-typescript.json`
- `.desloppify/subagents/runs/20260416_084655/*`

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify status`
- `desloppify plan queue --sort recent`
- `desloppify show review --status open --no-budget --top 100`
- `desloppify show security --status open --no-budget --top 50`
- `desloppify show stale_exclude --status open --no-budget --top 50`

**Exit rule:** queue-trust ambiguity is no longer an excuse to drop or mis-own live 2026-04-16 work.

- Status: not started
- Plan: none yet; execution-grade plan required before edits
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P0-EXIT`

## Priority 1: Retire Runtime Ownership And Assembly Concentration

### [ ] `P1-W1` Shrink The Runtime Hub And Priority-One Factory Step

**Goal:** stop `AppOrchestrator` and the priority-one assembly path from remaining the de facto owner for cross-domain runtime behavior.

**Mapped live review issues:**

- `review::.::holistic::high_level_elegance::runtime_owner_concentration`
- `review::.::holistic::design_coherence::app_orchestrator_remains_runtime_hub`
- `review::.::holistic::design_coherence::priority_one_runtime_assembly_is_still_one_large_factory_step`
- `review::.::holistic::package_organization::core_priority_one_root_residue`

**Primary files/areas:**

- `src/core/orchestrator/AppOrchestrator.ts`
- `src/core/orchestrator/OrchestratorPriorityOneControllerFactory.ts`
- `src/core/orchestrator/OrchestratorRuntimeSeams.ts`
- `src/core/PlaybackStartController.ts`
- `src/core/PlaybackRuntimeController.ts`

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show src/core/orchestrator --status open --no-budget --top 150`
- `desloppify show src/core --status open --no-budget --top 150`
- `desloppify show smells --status open --no-budget --top 250`
- `desloppify show structural --status open --no-budget --top 150`

**Exit rule:** runtime controller ownership no longer forces readers through one large orchestrator shell or one large priority-one assembly step.

- Status: not started
- Plan: none yet; execution-grade plan required before edits
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P1-W2`

### [ ] `P1-W2` Remove Broad Builder Bags And Reverse Runtime Seams

**Goal:** replace wrapper-heavy coordinator assembly with direct, owner-honest seams.

**Mapped live review issues:**

- `review::.::holistic::abstraction_fitness::orchestrator_builder_passthrough_bags`
- `review::.::holistic::abstraction_fitness::single_impl_runtime_interfaces`
- `review::.::holistic::cross_module_architecture::navigation_depends_on_orchestrator_runtime_seam`

**Primary files/areas:**

- `src/core/orchestrator/OrchestratorCoordinatorContracts.ts`
- `src/core/orchestrator/OrchestratorCoordinatorBuilders.ts`
- `src/modules/navigation/NavigationCoordinator.ts`
- `src/core/orchestrator/OrchestratorModuleFactory.ts`

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show src/core/orchestrator/OrchestratorCoordinatorContracts.ts --status open --no-budget --top 80`
- `desloppify show src/core/orchestrator/OrchestratorCoordinatorBuilders.ts --status open --no-budget --top 120`
- `desloppify show src/modules/navigation --status open --no-budget --top 120`
- `desloppify show logs --status open --no-budget --top 50`

**Exit rule:** coordinator builders use focused dependency types, navigation no longer imports orchestrator-owned callback types, and full-module one-implementation interfaces are retired or narrowed where they still add ceremony without substitution value.

- Status: not started
- Plan: none yet; execution-grade plan required before edits
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P1-EXIT`

## Priority 2: Repair App-Shell Seams, Package Surfaces, And UI-Owned Persistence Residue

### [ ] `P2-W1` Move App-Shell And Overlay Wiring Onto Package-Owned Seams

**Goal:** keep app-shell wiring on public owner seams instead of concrete UI implementation files or the old public orchestrator barrel.

**Mapped live review issues:**

- `review::.::holistic::cross_module_architecture::lazy_screen_contracts_live_in_concrete_ui_files`
- `review::.::holistic::convention_outlier::playback_options_root_surface_bypass`
- `review::.::holistic::incomplete_migration::internal_orchestrator_barrel_drift`
- `review::.::holistic::high_level_elegance::orchestrator_public_barrel_backflow`

**Primary files/areas:**

- `src/core/app-shell/AppLazyScreenRegistry.ts`
- `src/core/app-shell/AppLazyScreenPortFactory.ts`
- `src/core/app-shell/AppOrchestratorConfigFactory.ts`
- `src/core/app-shell/AppShellRuntimeContracts.ts`
- `src/modules/ui/playback-options/index.ts`

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show src/core/app-shell --status open --no-budget --top 150`
- `desloppify show src/modules/ui --status open --no-budget --top 150`
- `desloppify show facade --status open --no-budget --top 80`

**Exit rule:** app-shell imports package-owned seams only, overlay package conventions are consistent, and the top-level `src/Orchestrator.ts` barrel is reserved for external entry stability instead of internal core wiring.

- Status: not started
- Plan: none yet; execution-grade plan required before edits
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P2-W2`

### [ ] `P2-W2` Resolve Package-Role Drift And UI-Owned Persistence Assembly

**Goal:** finish the remaining ownership drift where package names and persistence seams still misdescribe reality.

**Mapped live review issues:**

- `review::.::holistic::high_level_elegance::types_package_role_drift`
- `review::.::holistic::mid_level_elegance::ui_owned_persistence_seams`

**Primary files/areas:**

- `src/types/**`
- `src/config/storageKeys.ts`
- `src/core/app-shell/AppDiagnosticsSurface.ts`
- `src/modules/ui/server-select/ServerSelectScreen.ts`
- `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
- `src/modules/ui/settings/SettingsStore.ts`

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show src/types --status open --no-budget --top 80`
- `desloppify show src/core/app-shell --status open --no-budget --top 150`
- `desloppify show src/modules/ui --status open --no-budget --top 150`
- `desloppify show signature --status open --no-budget --top 80`

**Exit rule:** runtime storage ownership no longer hides under `src/types`, and storage-backed collaborators are constructed by the right composition owners instead of inside UI/app-shell leaves.

- Status: not started
- Plan: none yet; execution-grade plan required before edits
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P2-EXIT`

## Priority 3: Normalize Plex Discovery, Library, And Auth Contract Surfaces

### [ ] `P3-W1` Replace Scalar And Sentinel Plex Result Drift With Coherent Contracts

**Goal:** make Plex discovery and library boundaries tell the truth about failure and success in one coherent way.

**Mapped live review issues:**

- `review::.::holistic::api_surface_coherence::plex_discovery_scalar_test_result`
- `review::.::holistic::api_surface_coherence::plex_library_failure_contract_drift`
- `review::.::holistic::error_consistency::plex_library_null_results_mask_fetch_failures`

**Primary files/areas:**

- `src/modules/plex/discovery/interfaces.ts`
- `src/modules/plex/discovery/PlexServerDiscovery.ts`
- `src/modules/plex/library/interfaces.ts`
- `src/modules/plex/library/PlexLibrary.ts`

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show src/modules/plex/discovery --status open --no-budget --top 120`
- `desloppify show src/modules/plex/library --status open --no-budget --top 150`
- `desloppify show structural --status open --no-budget --top 150`
- `desloppify show test_coverage --status open --no-budget --top 120`

**Exit rule:** discovery and library readers use explicit, internally consistent result contracts instead of raw scalar unions and mixed `throw`/`null`/`[]` failure semantics.

- Status: not started
- Plan: none yet; execution-grade plan required before edits
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P3-W2`

### [ ] `P3-W2` Normalize Plex Parse, Polling, And Platform-Identity Error Paths

**Goal:** keep Plex auth and stream request setup on typed, observable failure paths without reopening already-focused parser helpers as fake hotspots.

**Mapped live review issues:**

- `review::.::holistic::error_consistency::plex_auth_pin_parsing_bypasses_typed_errors`
- `review::.::holistic::error_consistency::plex_auth_poll_timeout_masks_retryable_failures`
- `review::.::holistic::initialization_coupling::platform_version_first_probe_cache`

**Primary files/areas:**

- `src/modules/plex/auth/PlexAuth.ts`
- `src/modules/plex/auth/plexAuthPayloadParsers.ts`
- `src/platform/webosPlatformServices.ts`
- `src/modules/plex/stream/PlexStreamResolver.ts`

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show src/modules/plex/auth --status open --no-budget --top 150`
- `desloppify show src/modules/plex/stream --status open --no-budget --top 150`
- `desloppify show logs --status open --no-budget --top 50`
- `desloppify show test_coverage --status open --no-budget --top 120`

**Exit rule:** PIN/profile parse failures stay typed, polling preserves the true retryable failure class, and platform-version identity is no longer frozen by an early fallback probe.

- Status: not started
- Plan: none yet; execution-grade plan required before edits
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P3-EXIT`

## Priority 4: Make Auth, Profile, Startup, And Lifecycle State Coherent

### [ ] `P4-W1` Normalize Startup Auth/Profile Expiry And Constructor-Time Auth State

**Goal:** stop startup and profile selection from advertising a coherent auth state while reusing stale tokens or constructor-time side effects.

**Mapped live review issues:**

- `review::.::holistic::authorization_consistency::startup_invalid_active_token_persisted`
- `review::.::holistic::authorization_consistency::profile_select_auth_resume_gap`
- `review::.::holistic::low_level_elegance::phase2_auth_gate_branch_stack`
- `review::.::holistic::initialization_coupling::plex_auth_constructor_storage_side_effect`

**Primary files/areas:**

- `src/core/initialization/InitializationStartupPolicy.ts`
- `src/modules/plex/auth/PlexAuth.ts`
- `src/modules/ui/profile-select/ProfileSelectScreen.ts`
- `src/modules/ui/profile-select/__tests__/ProfileSelectScreen.test.ts`

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show src/core/initialization --status open --no-budget --top 150`
- `desloppify show src/modules/ui/profile-select --status open --no-budget --top 120`
- `desloppify show src/modules/plex/auth --status open --no-budget --top 150`
- `desloppify show test_coverage --status open --no-budget --top 120`

**Exit rule:** startup no longer preserves a known-invalid active token as authenticated state, profile actions follow one auth-expiry recovery rule, and auth construction no longer performs stateful cleanup before startup policy owns the decision.

- Status: not started
- Plan: none yet; execution-grade plan required before edits
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P4-W2`

### [ ] `P4-W2` Make Lifecycle Timing And Startup Error Normalization Honest

**Goal:** align startup/lifecycle public timing contracts with what the runtime actually does.

**Mapped live review issues:**

- `review::.::holistic::logic_clarity::lifecycle_promise_semantics_hide_real_timing`
- `review::.::holistic::test_strategy::startup-error-normalization-gap`

**Primary files/areas:**

- `src/modules/lifecycle/AppLifecycle.ts`
- `src/core/PlaybackRuntimeController.ts`
- `src/core/channel-tuning/ChannelTuningCoordinator.ts`
- `src/core/initialization/RecoverableModuleStatusError.ts`
- `src/core/initialization/__tests__/**`

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show src/modules/lifecycle --status open --no-budget --top 120`
- `desloppify show src/core/initialization --status open --no-budget --top 150`
- `desloppify show test_coverage --status open --no-budget --top 120`
- `desloppify show signature --status open --no-budget --top 80`

**Exit rule:** lifecycle `await`/phase semantics are truthful, and startup error normalization has focused tests for the shared unknown-error branches it currently owns.

- Status: not started
- Plan: none yet; execution-grade plan required before edits
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P4-EXIT`

## Priority 5: Narrow Player, Playback, And Subtitle-Recovery Ownership

### [ ] `P5-W1` Split Subtitle-Specific Recovery Policy Out Of Generic Playback Recovery

**Goal:** keep generic stream recovery and subtitle policy in explicit sibling owners instead of one blended class.

**Mapped live review issues:**

- `review::.::holistic::design_coherence::playback_recovery_manager_blends_generic_recovery_with_subtitle_policy`

**Primary files/areas:**

- `src/modules/player/PlaybackRecoveryManager.ts`
- `src/core/orchestrator/SubtitleTrackRecoveryController.ts`
- `src/modules/player/**`

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show src/modules/player --status open --no-budget --top 150`
- `desloppify show src/core/orchestrator --status open --no-budget --top 150`
- `desloppify show smells --status open --no-budget --top 250`
- `desloppify show structural --status open --no-budget --top 150`

**Exit rule:** subtitle-specific fallback policy no longer hides inside the generic playback recovery owner.

- Status: not started
- Plan: none yet; execution-grade plan required before edits
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P5-W2`

### [ ] `P5-W2` Deduplicate Subtitle Debug Helpers Behind One Honest Logging Seam

**Goal:** remove the repeated subtitle-debug boilerplate without broadening diagnostics ceremony.

**Mapped live review issues:**

- `review::.::holistic::ai_generated_debt::duplicate_subtitle_debug_helpers`

**Primary files/areas:**

- `src/modules/player/VideoPlayer.ts`
- `src/modules/player/SubtitleManager.ts`
- `src/modules/plex/stream/PlexStreamResolver.ts`
- shared logging helpers used by those owners

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show src/modules/player --status open --no-budget --top 150`
- `desloppify show src/modules/plex/stream --status open --no-budget --top 150`
- `desloppify show logs --status open --no-budget --top 50`

**Exit rule:** subtitle-debug behavior is owned by one bounded helper path rather than three near-identical fail-open copies.

- Status: not started
- Plan: none yet; execution-grade plan required before edits
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P5-EXIT`

## Priority 6: Finish Channel-Setup, Scheduler, And EPG Contract And Package Cleanup

### [ ] `P6-W1` Normalize Channel-Setup And Scheduler Public Contract Semantics

**Goal:** make channel setup and channel-manager contracts honest about absence and rejection behavior without reopening already-retired facade work.

**Mapped live review issues:**

- `review::.::holistic::contract_coherence::channel_setup_port_absence_contract_split`
- `review::.::holistic::contract_coherence::channel_manager_error_contract_docs_lag_runtime`

**Primary files/areas:**

- `src/core/channel-setup/ChannelSetupWorkflowPort.ts`
- `src/core/channel-setup/createChannelSetupWorkflowPort.ts`
- `src/modules/scheduler/channel-manager/interfaces.ts`
- `src/modules/scheduler/channel-manager/ChannelManager.ts`

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show src/core/channel-setup --status open --no-budget --top 150`
- `desloppify show src/modules/scheduler/channel-manager --status open --no-budget --top 150`
- `desloppify show signature --status open --no-budget --top 80`
- `desloppify show test_coverage --status open --no-budget --top 120`

**Exit rule:** missing-workflow behavior and channel-manager rejection surfaces are uniform, explicit, and test-backed.

- Status: not started
- Plan: none yet; execution-grade plan required before edits
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P6-W2`

### [ ] `P6-W2` Finish EPG Read Semantics, View Packaging, And Naming Residue

**Goal:** close the remaining EPG residue without resurrecting already-retired public-surface work.

**Mapped live review issues:**

- `review::.::holistic::contract_coherence::epg_cache_queries_hide_cleanup_side_effects`
- `review::.::holistic::low_level_elegance::epg_refresh_session_too_dense`
- `review::.::holistic::package_organization::epg_view_leaves_in_root`
- `review::.::holistic::naming_quality::boolean_accessor_get_is_drift`
- `review::.::holistic::naming_quality::epg_run_for_channel_callback`

**Primary files/areas:**

- `src/modules/ui/epg/runtime/EPGScheduleCacheStore.ts`
- `src/modules/ui/epg/runtime/EPGScheduleRefreshRuntime.ts`
- `src/modules/ui/epg/view/**`
- `src/modules/ui/epg/EPGComponent.ts`

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show src/modules/ui/epg --status open --no-budget --top 180`
- `desloppify show src/modules/ui/epg/runtime --status open --no-budget --top 120`
- `desloppify show facade --status open --no-budget --top 80`
- `desloppify show structural --status open --no-budget --top 150`

**Exit rule:** EPG query APIs are honest about side effects, refresh flow is decomposed into named phases, view-only leaves live under `view/`, and awkward `getIs*` / `runForChannel` naming residue is gone.

- Status: not started
- Plan: none yet; execution-grade plan required before edits
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P6-EXIT`

## Priority 7: Remove Template Noise, Wrapper Sprawl, And Low-Value Migration Residue

### [ ] `P7-W1` Delete Template Docblock Noise And Defensive Wrapper Sprawl

**Goal:** improve the weakest AI-debt dimensions by removing codebase-wide template ceremony and low-signal wrapper layers where current source shows no real platform constraint.

**Mapped live review issues:**

- `review::.::holistic::ai_generated_debt::template_docblock_noise`
- `review::.::holistic::ai_generated_debt::defensive_nonfatal_wrapper_sprawl`

**Primary files/areas:**

- representative noisy files called out by the baseline:
  - `src/config/timing.ts`
  - `src/modules/player/constants.ts`
  - `src/modules/lifecycle/AppLifecycle.ts`
  - `src/modules/plex/discovery/interfaces.ts`
  - `src/modules/scheduler/channel-manager/interfaces.ts`
- current diagnostic/wrapper owners called out by the baseline

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show src/config --status open --no-budget --top 80`
- `desloppify show src/modules --status open --no-budget --top 200`
- `desloppify show boilerplate_duplication --status open --no-budget --top 50`
- `desloppify show logs --status open --no-budget --top 50`

**Exit rule:** template commentary and multi-layered fail-open wrappers are materially reduced on live source, with no false claim that docs-only cleanup finished the wave.

- Status: not started
- Plan: none yet; execution-grade plan required before edits
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P7-W2`

### [ ] `P7-W2` Retire Dead Toast Compatibility Residue

**Goal:** remove the remaining migration-only toast compatibility path once current-source proof confirms production callers already use the structured payload contract.

**Mapped live review issues:**

- `review::.::holistic::incomplete_migration::toast_string_back_compat_dead`

**Primary files/areas:**

- `src/modules/ui/toast/types.ts`
- current production toast callsites

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show src/modules/ui --status open --no-budget --top 150`
- `desloppify show signature --status open --no-budget --top 80`
- `desloppify show test_coverage --status open --no-budget --top 120`

**Exit rule:** the toast surface no longer carries dead string compatibility that current production code does not need.

- Status: not started
- Plan: none yet; execution-grade plan required before edits
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P7-EXIT`

## Priority 8: Normalize Type Safety, Naming, And Verification Guardrails

### [ ] `P8-W1` Collapse Duplicate Error Taxonomies And Unsafe String Coercions

**Goal:** stop shadow error enums and raw string coercions from undermining the canonical typed error surface.

**Mapped live review issues:**

- `review::.::holistic::type_safety::duplicated_error_code_taxonomies`
- `review::.::holistic::type_safety::unsafe_error_code_coercions`
- `review::.::holistic::type_safety::branding_icon_api_uses_plain_string`

**Primary files/areas:**

- `src/types/app-errors.ts`
- `src/modules/player/types.ts`
- `src/modules/plex/library/types.ts`
- `src/modules/plex/stream/types.ts`
- `src/modules/plex/stream/resolveStreamPipeline.ts`
- `src/core/channel-tuning/ChannelTuningCoordinator.ts`
- `src/core/channel-setup/ChannelSetupFacetSnapshotLoader.ts`
- `src/modules/ui/common/channelBrandingIcons.ts`

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show src/modules/player --status open --no-budget --top 150`
- `desloppify show src/modules/plex --status open --no-budget --top 180`
- `desloppify show src/core/channel-tuning --status open --no-budget --top 100`
- `desloppify show naming --status open --no-budget --top 50`

**Exit rule:** the canonical error-code surface is singular, unknown values are validated before they become typed, and branding icon helpers no longer accept plain strings when a domain type already exists.

- Status: not started
- Plan: none yet; execution-grade plan required before edits
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P8-W2`

### [ ] `P8-W2` Expand The Test Fragility Ratchet To Live Blind Spots

**Goal:** stop private-probe and sleep-wait debt from surviving outside the currently frozen suite subset.

**Mapped live review issues:**

- `review::.::holistic::test_strategy::fragility-ratchet-blind-spots`

**Primary files/areas:**

- `src/__tests__/policy/AntiPatterns.policy.test.ts`
- the live blind-spot suites called out by the baseline in player, Plex stream, scheduler, and channel-setup tests

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show test_coverage --status open --no-budget --top 150`
- `desloppify show src/__tests__ --status open --no-budget --top 120`
- `desloppify show structural --status open --no-budget --top 150`

**Exit rule:** fragility guardrails cover the live private-probe and sleep-wait offenders instead of only a frozen historical subset.

- Status: not started
- Plan: none yet; execution-grade plan required before edits
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P8-EXIT`

## Priority 9: Burn Down Remaining Mechanical Debt And Prove The Score Gate

### [ ] `P9-W1` Retire Or Reassign The Remaining Mechanical Detector Backlog

**Goal:** clear the non-review backlog that survives owner-priority cleanup without hiding it behind suppressions or stale wording.

**Required outcomes:**

- refresh every open detector envelope from the 2026-04-16 baseline
- burn down or stale-prove the remaining non-review backlog by owner area
- if any mechanical residue survives, assign it to one explicit later owner inside `P9` with exact revisit proof
- record detector-count deltas for every still-live detector family

**Primary files/areas:**

- whichever owner areas still contain live non-review residue after `P1` through `P8`
- `ARCHITECTURE_CLEANUP_CHECKLIST.md`
- `.desloppify/state-typescript.json`

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify show smells --status open --no-budget --top 250`
- `desloppify show structural --status open --no-budget --top 150`
- `desloppify show test_coverage --status open --no-budget --top 150`
- `desloppify show facade --status open --no-budget --top 100`
- `desloppify show logs --status open --no-budget --top 50`
- `desloppify show signature --status open --no-budget --top 80`
- `desloppify show stale_exclude --status open --no-budget --top 50`
- `desloppify show security --status open --no-budget --top 50`

**Exit rule:** no live non-review detector family remains unowned or undocumented before the final rerun prep begins.

- Status: not started
- Plan: none yet; execution-grade plan required before edits
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P9-W2`

### [ ] `P9-W2` Run The Authoritative Rerun And Build The No-Drop Proof Matrix

**Goal:** prepare the final closeout record with an integration-branch rerun, exact score deltas, and proof that every live 2026-04-16 issue is either retired or explicitly owned.

**Required outcomes:**

- run the authoritative integration-branch rerun (`desloppify scan --path .`) and refresh `status`, `plan queue`, `review`, and `security`
- compare the new baseline against the 2026-04-16 baseline and record `previous`, `new`, and `delta`
- produce the final detector table and remaining-review table
- prove no live fresh-run review issue or mechanical envelope disappeared without a `resolved`, `stale-proven`, `deferred`, or `split follow-up` record

**Primary files/areas:**

- `ARCHITECTURE_CLEANUP_CHECKLIST.md`
- `.desloppify/state-typescript.json`
- `.desloppify/plan.json`

**Mechanical envelopes to refresh at entry and exit:**

- `desloppify scan --path .`
- `desloppify status`
- `desloppify plan queue --sort recent`
- `desloppify show review --status open --no-budget --top 100`
- `desloppify show security --status open --no-budget --top 50`

**Exit rule:** the final closeout record is ready to prove a real score-improving finish instead of a bookkeeping-only stop.

- Status: not started
- Plan: none yet; execution-grade plan required before edits
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: `P9-EXIT`

## Imported Review Issue Map By Priority

### `P1`

- `review::.::holistic::high_level_elegance::runtime_owner_concentration`
- `review::.::holistic::design_coherence::app_orchestrator_remains_runtime_hub`
- `review::.::holistic::design_coherence::priority_one_runtime_assembly_is_still_one_large_factory_step`
- `review::.::holistic::package_organization::core_priority_one_root_residue`
- `review::.::holistic::abstraction_fitness::orchestrator_builder_passthrough_bags`
- `review::.::holistic::abstraction_fitness::single_impl_runtime_interfaces`
- `review::.::holistic::cross_module_architecture::navigation_depends_on_orchestrator_runtime_seam`

### `P2`

- `review::.::holistic::cross_module_architecture::lazy_screen_contracts_live_in_concrete_ui_files`
- `review::.::holistic::convention_outlier::playback_options_root_surface_bypass`
- `review::.::holistic::incomplete_migration::internal_orchestrator_barrel_drift`
- `review::.::holistic::high_level_elegance::orchestrator_public_barrel_backflow`
- `review::.::holistic::high_level_elegance::types_package_role_drift`
- `review::.::holistic::mid_level_elegance::ui_owned_persistence_seams`

### `P3`

- `review::.::holistic::api_surface_coherence::plex_discovery_scalar_test_result`
- `review::.::holistic::api_surface_coherence::plex_library_failure_contract_drift`
- `review::.::holistic::error_consistency::plex_library_null_results_mask_fetch_failures`
- `review::.::holistic::error_consistency::plex_auth_pin_parsing_bypasses_typed_errors`
- `review::.::holistic::error_consistency::plex_auth_poll_timeout_masks_retryable_failures`
- `review::.::holistic::initialization_coupling::platform_version_first_probe_cache`

### `P4`

- `review::.::holistic::authorization_consistency::startup_invalid_active_token_persisted`
- `review::.::holistic::authorization_consistency::profile_select_auth_resume_gap`
- `review::.::holistic::low_level_elegance::phase2_auth_gate_branch_stack`
- `review::.::holistic::initialization_coupling::plex_auth_constructor_storage_side_effect`
- `review::.::holistic::logic_clarity::lifecycle_promise_semantics_hide_real_timing`
- `review::.::holistic::test_strategy::startup-error-normalization-gap`

### `P5`

- `review::.::holistic::design_coherence::playback_recovery_manager_blends_generic_recovery_with_subtitle_policy`
- `review::.::holistic::ai_generated_debt::duplicate_subtitle_debug_helpers`

### `P6`

- `review::.::holistic::contract_coherence::channel_setup_port_absence_contract_split`
- `review::.::holistic::contract_coherence::channel_manager_error_contract_docs_lag_runtime`
- `review::.::holistic::contract_coherence::epg_cache_queries_hide_cleanup_side_effects`
- `review::.::holistic::low_level_elegance::epg_refresh_session_too_dense`
- `review::.::holistic::package_organization::epg_view_leaves_in_root`
- `review::.::holistic::naming_quality::boolean_accessor_get_is_drift`
- `review::.::holistic::naming_quality::epg_run_for_channel_callback`

### `P7`

- `review::.::holistic::ai_generated_debt::template_docblock_noise`
- `review::.::holistic::ai_generated_debt::defensive_nonfatal_wrapper_sprawl`
- `review::.::holistic::incomplete_migration::toast_string_back_compat_dead`

### `P8`

- `review::.::holistic::type_safety::duplicated_error_code_taxonomies`
- `review::.::holistic::type_safety::unsafe_error_code_coercions`
- `review::.::holistic::type_safety::branding_icon_api_uses_plain_string`
- `review::.::holistic::test_strategy::fragility-ratchet-blind-spots`

## Detector Envelope Inventory For Fresh Refreshes

Use these exact commands at the start and end of each priority. The counts below are the 2026-04-16 open baseline and must be refreshed during `P9-W2` and `P9-EXIT`.

- `smells (181)`: `desloppify show smells --status open --no-budget --top 250`
- `structural (81)`: `desloppify show structural --status open --no-budget --top 150`
- `review (41)`: `desloppify show review --status open --no-budget --top 100`
- `test_coverage (25)`: `desloppify show test_coverage --status open --no-budget --top 150`
- `facade (21)`: `desloppify show facade --status open --no-budget --top 100`
- `logs (9)`: `desloppify show logs --status open --no-budget --top 50`
- `signature (9)`: `desloppify show signature --status open --no-budget --top 80`
- `stale_exclude (7)`: `desloppify show stale_exclude --status open --no-budget --top 50`
- `responsibility_cohesion (5)`: `desloppify show responsibility_cohesion --status open --no-budget --top 80`
- `flat_dirs (5)`: `desloppify show flat_dirs --status open --no-budget --top 50`
- `single_use (4)`: `desloppify show single_use --status open --no-budget --top 50`
- `cycles (3)`: `desloppify show security --status open --no-budget --top 50`
- `naming (1)`: `desloppify show naming --status open --no-budget --top 50`
- `boilerplate_duplication (1)`: `desloppify show boilerplate_duplication --status open --no-budget --top 50`

## Operating Rules

- no imported review issue may be resolved without direct current-source proof plus a fresh authoritative rerun
- no mechanical detector may be suppressed purely to improve the score
- no already-retired seam may be reopened because of historical wording alone
- every `P#-EXIT` must record entry baseline, exit baseline, delta, mapped imported issue dispositions, relevant detector counts, and security triage
- no priority may claim success if it leaves live 2026-04-16 debt outside this checklist without an explicit later owner
- no final closeout claim is valid unless `P9-EXIT` proves `overall > 87.2`, `strict > 87.2`, and the no-drop proof matrix is complete
