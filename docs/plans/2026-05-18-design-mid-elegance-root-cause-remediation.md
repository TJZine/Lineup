**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** standalone remediation

# Design Coherence And Mid-Elegance Root-Cause Remediation Plan

## Goal

Break the repeated Design coherence and Mid elegance rework loop by planning source-backed owner-boundary remediation, not by treating strategist identifiers as implementation membership or optimizing for score movement alone.

The selected execution unit is Package B only: channel-setup facet executor count-recovery limiter extraction plus direct executor proof. Server-select and EPG remain source-backed dispositions, not implementation scope for this session.

## Non-Goals

- Do not implement code in the planning session.
- Do not update `ARCHITECTURE_CLEANUP_CHECKLIST.md`.
- Do not treat `strategy::design-coherence-rework-loop` or `strategy::mid-elegance-regression-loop` as file membership.
- Do not plan from stale path `src/modules/ui/epg/view/EPGCellRenderer.ts`; the current path is `src/modules/ui/epg/view/cells/EPGCellRenderer.ts`.
- Do not run `desloppify scan --force-rescan`.
- Do not grow allowlisted hotspots unless the same change records rationale plus decomposition or revisit trigger.
- Do not move Plex persistence, selected-server storage, or auth policy into UI classes.

## Parent Architecture Alignment

This standalone cleanup follows `docs/architecture/CURRENT_STATE.md`:

- Server select UI keeps `ServerSelectScreen.ts` as the public screen/DOM adapter; runtime workflow remains in `ServerSelectRuntimeCoordinator.ts`; focus remains in `ServerSelectFocusCoordinator.ts`; status/display policy remains in `ServerSelectStatusPolicy.ts`. Server select is not the selected execution unit.
- Channel setup planning stays under `src/core/channel-setup/planning/`; `ChannelSetupFacetSnapshotLoadSession.ts` keeps selected-library session orchestration and final snapshot assembly; `ChannelSetupFacetLibraryExecutor.ts` keeps per-library facet orchestration.
- EPG renderer current owner is `src/modules/ui/epg/view/cells/EPGCellRenderer.ts`, with pure presentation policy in `EPGCellPresentation.ts`.

No checklist update is expected unless a later controller intentionally promotes this standalone remediation into tracked cleanup backlog.

## Required Reading

Read in this order before implementation or review:

1. `docs/AGENTIC_DEV_WORKFLOW.md`
2. `agents.md`
3. `docs/agentic/session-prompts/cleanup-loop.md`
4. `docs/agentic/codanna-playbook.md`
5. `docs/architecture/CURRENT_STATE.md`
6. `docs/architecture/file-shape-guardrails.md`
7. `docs/agentic/plan-authoring-standard.md`
8. this plan
9. current source for the selected package files

Freshness gate: if any selected source file, `docs/architecture/CURRENT_STATE.md`, or `docs/architecture/file-shape-guardrails.md` changed after this plan was written, refresh this plan before implementation.

## Required Skills

- `lineup-cleanup-loop`
- `architecture-boundaries`
- `verification-strategy`
- `execution-plan-authoring`
- `review-request`
- `review-adjudication` for any plan-review findings
- `closeout-verification`
- `desloppify`
- `ui-composition-patterns` for Package A or any EPG work
- `persistence-boundaries` for any selected-server state/storage-adjacent changes
- `plex-integration-boundaries` if a proposed change touches Plex discovery/auth/library/stream policy; current packages should keep Plex files out of scope

## Codanna Discovery

- `get_index_info`: 12712 symbols across 819 files, semantic search enabled, index updated about 16 hours before this plan.
- `semantic_search_with_context "ChannelSetupFacetLibraryExecutor channel setup facet library executor planning responsibility owner lang:typescript"`: weak/noisy; exact symbol lookup required.
- `semantic_search_with_context "ServerSelectScreen ServerSelectRuntimeCoordinator server selection screen runtime coordinator discovery select clear reconnect idle focus lang:typescript"`: surfaced server-select app/orchestrator entrypoints and confirmed app-shell adjacency.
- `semantic_search_with_context "EPGCellRenderer cell DOM rendering secondary text clear apply state EPG view cells lang:typescript"`: surfaced `EPGVirtualizer.renderVisibleCells` and EPG cell types, but not the renderer class directly.
- `find_symbol ChannelSetupFacetLibraryExecutor`: `src/core/channel-setup/planning/ChannelSetupFacetLibraryExecutor.ts`, symbol `11262`.
- `find_symbol ServerSelectScreen`: `src/modules/ui/server-select/ServerSelectScreen.ts`, symbol `6261`.
- `find_symbol ServerSelectRuntimeCoordinator`: `src/modules/ui/server-select/ServerSelectRuntimeCoordinator.ts`, symbol `6454`.
- `find_symbol EPGCellRenderer`: `src/modules/ui/epg/view/cells/EPGCellRenderer.ts`, symbol `5108`.
- `find_symbol ChannelSetupFacetSnapshotLoadSession`: `src/core/channel-setup/planning/ChannelSetupFacetSnapshotLoadSession.ts`, symbol `11371`.
- `find_symbol EPGVirtualizer`: `src/modules/ui/epg/view/EPGVirtualizer.ts`, symbol `4632`.
- `find_symbol ServerSelectionCoordinator`: `src/core/server-selection/ServerSelectionCoordinator.ts`, symbol `10627`.
- `analyze_impact ChannelSetupFacetLibraryExecutor`: no impact detected. Insufficient; direct source shows it is instantiated by `ChannelSetupFacetSnapshotLoadSession`.
- `analyze_impact ServerSelectScreen`: impacts `AppLazyScreenRegistry`, `AppScreenVisibilityCoordinator`, and `App`.
- `analyze_impact ServerSelectRuntimeCoordinator`: impacts `ServerSelectScreen` and `AppLazyScreenRegistry`.
- `analyze_impact EPGCellRenderer`: no impact detected. Insufficient; direct source shows `EPGVirtualizer` instantiates it.
- `analyze_impact EPGVirtualizer`: impacts `EPGComponent`.
- `analyze_impact ServerSelectionCoordinator`: impacts `AppOrchestrator` and `OrchestratorServerSelectionRuntime`.
- `search_documents`: weak/noisy for this exact strategy question; historical docs were useful as calibration only.
- Fallback reads: direct `rg` and source reads were required for current import/use proof, stale EPG path reconciliation, and current tests.

## Impact Snapshot

Current source and `desloppify` proof:

- `ChannelSetupFacetLibraryExecutor.ts`: 471 lines, open `test_coverage::...::transitive_only`, open `smells::...::nested_closure`, instantiated from `ChannelSetupFacetSnapshotLoadSession.ts`.
- `ServerSelectScreen.ts`: 357 lines, open `smells::...::voided_symbol` at `setClearButtonDisabled(disabled, generation)` where `generation` is void-suppressed.
- `ServerSelectRuntimeCoordinator.ts`: 506 lines, allowlisted hotspot, open structural large-file issue and open transitive-only test issue.
- `src/modules/ui/epg/view/cells/EPGCellRenderer.ts`: 585 lines, allowlisted current path, no current open issue from `desloppify show`.
- `src/modules/ui/epg/view/EPGCellRenderer.ts`: stale path. `desloppify show` still reports an old structural issue, but this path is not current source truth.

Root cause:

- Design coherence stayed at 76 because recent cleanup moved responsibility out of older hotspots but let new runtime/view owners become unreviewed absorption points. The clearest current source proof is server select: screen, focus, list view, and status owners exist, but the runtime coordinator now concentrates multiple async workflows and has no direct tests.
- Mid elegance declined from 88 to 84 because recent accepted packets were mostly compact local remediations. They were valid, but they did not change the repeated mid-level shape: coordinator/executor classes carry option bags, generation guards, callbacks, and hidden policy without narrow public seams or direct proof. The clearest current proof is `ChannelSetupFacetLibraryExecutor.ts`.
- The hotspots are related by one repeated pattern, not one implementation owner. Treat them as separate packages under one plan-review decision.

Strategist issue disposition:

- `strategy::design-coherence-rework-loop`: source-backed disposition maps to Package A, server-select runtime contract. Final owner: `ServerSelectRuntimeCoordinator`.
- `strategy::mid-elegance-regression-loop`: source-backed disposition maps to selected execution unit `DME-B1-channel-setup-facet-count-recovery-limiter-contract`. Final owner: channel-setup planning package, centered on `ChannelSetupFacetLibraryExecutor`.
- EPG stale-path signal: source-backed disposition is no immediate implementation. Final owner remains `src/modules/ui/epg/view/cells/EPGCellRenderer.ts`; reopen only on current-source proof.

## Selected Execution Unit

`ready_now_execution_unit: DME-B1-channel-setup-facet-count-recovery-limiter-contract`

Goal:

- Move the count-recovery limiter out of `ChannelSetupFacetLibraryExecutor.ts` into one package-local helper, add direct tests for that helper and the executor seam, and preserve current per-library facet behavior.

Production files in scope:

- `src/core/channel-setup/planning/ChannelSetupFacetLibraryExecutor.ts`
- `src/core/channel-setup/planning/ChannelSetupFacetCountRecoveryLimiter.ts` (new)

Test files in scope:

- `src/core/channel-setup/__tests__/ChannelSetupFacetCountRecoveryLimiter.test.ts` (new)
- `src/core/channel-setup/__tests__/ChannelSetupFacetLibraryExecutor.test.ts` (new)
- `src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoadSession.test.ts`
- `src/core/channel-setup/__tests__/ChannelSetupFacetCountRecoveryWorker.test.ts`

Frozen helper seam:

- `src/core/channel-setup/planning/ChannelSetupFacetCountRecoveryLimiter.ts` owns only the bounded concurrency limiter currently implemented as `createFacetCountRecoveryLimiter()` inside `ChannelSetupFacetLibraryExecutor.ts`.
- The helper exports `createFacetCountRecoveryLimiter(maxConcurrency: number): FacetCountRecoveryLimiter`.
- `FacetCountRecoveryLimiter` remains the worker-owned type exported from `ChannelSetupFacetCountRecoveryWorker.ts`; the new helper imports that type and does not move worker behavior.
- The helper must preserve FIFO pending-task order, max active task count, promise resolution/rejection forwarding, and release-on-settle behavior.
- The helper must not know Plex, libraries, tag families, load state, warnings, progress, abort semantics, or executor/session control policy.
- Request-control extraction is out of scope. If implementation needs a request-control helper, abort/failure-control port rewrite, or option-bag restructuring beyond importing the limiter helper, stop and replan.

Public seams to prove:

- `createFacetCountRecoveryLimiter()` through direct helper tests.
- `ChannelSetupFacetLibraryExecutor.loadLibraryFacets()` through direct executor tests.
- Existing `ChannelSetupFacetSnapshotLoadSession.load()` through existing session tests.
- Existing `ChannelSetupFacetCountRecoveryWorker.recover()` through existing worker tests.

Behavior invariants:

- native facet definition order stays unchanged
- collection fetch behavior and warning continuation stay unchanged
- required native tag-directory failures stay blocking
- count-recovery failures still return the first blocking snapshot and abort sibling work as before
- caller cancellation and failure-stop behavior stay unchanged
- progress task labels, warning text, load-state mutation, and query-duration accounting stay unchanged
- no Plex library API, channel setup planning output, UI channel setup behavior, or persistence behavior changes
- `ChannelSetupFacetLibraryExecutor.ts` must stay under 500 lines after the extraction

## Files In Scope

Selected execution unit only:

- `src/core/channel-setup/planning/ChannelSetupFacetLibraryExecutor.ts`
- `src/core/channel-setup/planning/ChannelSetupFacetCountRecoveryLimiter.ts` (new)
- `src/core/channel-setup/__tests__/ChannelSetupFacetCountRecoveryLimiter.test.ts` (new)
- `src/core/channel-setup/__tests__/ChannelSetupFacetLibraryExecutor.test.ts` (new)
- `src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoadSession.test.ts`
- `src/core/channel-setup/__tests__/ChannelSetupFacetCountRecoveryWorker.test.ts`

Source-backed dispositions only, not editable in this execution unit:

- Package A server-select runtime contract.
- Package C EPG guarded disposition.

## Files Out Of Scope

- `ARCHITECTURE_CLEANUP_CHECKLIST.md`
- `.desloppify` state except through explicit later resolve/plan commands approved by the controller
- `src/core/channel-setup/planning/ChannelSetupFacetSnapshotLoadSession.ts` except through existing tests
- `src/core/channel-setup/planning/ChannelSetupFacetCountRecoveryWorker.ts` except through existing tests
- `src/core/channel-setup/planning/ChannelSetupPlanner.ts`
- `src/core/channel-setup/planning/ChannelSetupPlanningService.ts`
- `src/core/server-selection/*`
- `src/core/orchestrator/*`
- `src/modules/ui/server-select/*`
- `src/modules/plex/discovery/*`
- `src/modules/plex/auth/*`
- `src/modules/plex/library/*`
- `src/modules/plex/stream/*`
- selected-server persistence stores
- UI channel setup screens and presenters
- scheduler/channel-manager
- stale path `src/modules/ui/epg/view/EPGCellRenderer.ts`

## Planner Self-Check

- Unresolved seam: no for the selected execution unit. `DME-B1` extracts only the count-recovery limiter helper and adds direct public-seam proof.
- Adjacent contract changes: none approved. `ChannelSetupFacetSnapshotLoadSession.ts` and `ChannelSetupFacetCountRecoveryWorker.ts` are test-only reference surfaces for this unit.
- Out-of-scope reliance: core server selection, Plex, UI, persistence, and broader channel setup planning stay out because the helper consumes only the existing `FacetCountRecoveryLimiter` type.
- Codanna evidence and fallback reads are recorded, including insufficient impact results for executor and renderer.
- The work assigns final owners instead of growing composition roots.
- A fresh session can implement `DME-B1` without selecting among packages.
- This is execution-grade for the selected unit.

## Architecture Seam Decision Gate

Implement only `ready_now_execution_unit: DME-B1-channel-setup-facet-count-recovery-limiter-contract`.

Allowed package boundaries:

- Package A remains deferred disposition only.
- Package B selected unit may extract the package-local count-recovery limiter helper at `src/core/channel-setup/planning/ChannelSetupFacetCountRecoveryLimiter.ts`. It must not change Plex library APIs, channel setup planning outputs, native facet order, abort/failure semantics, count recovery behavior, progress task labels, or warning accounting.
- Package C remains no-code unless current-source EPG review proves a live issue. Stale `view/EPGCellRenderer.ts` output is not enough.

Replan if any implementation requires:

- touching files listed out of scope
- changing a Plex, storage, app-shell, orchestrator, or navigation public contract
- changing `ChannelSetupFacetSnapshotLoadSession.ts` or `ChannelSetupFacetCountRecoveryWorker.ts` production code
- extracting request-control, abort/failure policy, option-bag grouping, load-state mutation, progress forwarding, or warning recording out of `ChannelSetupFacetLibraryExecutor.ts`
- adding compatibility shims or fallback branches
- growing `ServerSelectRuntimeCoordinator.ts` above its 506-line allowlist baseline
- growing current `EPGCellRenderer.ts` above its 585-line allowlist baseline
- pushing `ChannelSetupFacetLibraryExecutor.ts` over 500 lines
- using stale EPG path evidence as current-source truth
- broadening from one package into multiple packages in the same execution pass

Do not absorb Package A server-select work or Package C EPG work into this execution unit.

## Verification Commands

Planning artifact verification:

- Classification: `broader integration/manual proof required`
- Run: `npm run verify:docs`
- Expected: passes with this active plan self-contained and no tracked-plan dependency on local-only run artifacts.

Selected `DME-B1` verification:

- Classification: `new regression/contract test required`
- Run: `npm test -- --runTestsByPath src/core/channel-setup/__tests__/ChannelSetupFacetCountRecoveryLimiter.test.ts src/core/channel-setup/__tests__/ChannelSetupFacetLibraryExecutor.test.ts src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoadSession.test.ts src/core/channel-setup/__tests__/ChannelSetupFacetCountRecoveryWorker.test.ts`
- Run: `npm run typecheck`
- Run: `npm run verify:maintainability`
- Run: `npm run verify`
- Expected: direct helper tests prove concurrency, FIFO queueing, rejection propagation, and release-on-settle; direct executor tests prove `loadLibraryFacets()` still routes unknown tag counts through count recovery without changing success/failure behavior; existing session and worker tests continue to pass.

Deferred Package A verification, if separately planned later:

- Classification: `new regression/contract test required`
- Requires a new or revised plan selecting server-select runtime as its own execution unit.

Deferred Package C verification, only if reopened later:

- Classification: `new regression/contract test required`
- Run focused EPG cell/virtualizer tests selected by a separate approved EPG plan plus `npm run verify`.
- Expected: DOM shape, recycled-cell clearing, ticker classes/timers, sliver behavior, focused/current/live presentation, reduced-motion behavior, and virtualizer integration remain unchanged unless explicitly approved.

Why this depth matches risk:

- This selected unit is structural cleanup in channel setup planning. Existing transitive tests are part of the problem signal, so direct helper and executor public-seam tests are required.
- `npm run verify` is required because channel setup planning and Plex-library-facing facet behavior are high-risk and already covered by the repo-wide gate.

## Rollback Notes

- Package A rollback: not applicable to `DME-B1`; server-select is deferred.
- Package B rollback: revert `ChannelSetupFacetCountRecoveryLimiter.ts`, `ChannelSetupFacetLibraryExecutor.ts`, and new tests together. If count-recovery or abort behavior diverges, restore the prior in-file limiter before attempting a smaller helper extraction.
- Package C rollback: if reopened and behavior diverges, revert current-path EPG renderer/presentation/virtualizer changes together and restore previous DOM/ticker behavior.

## Commit Checkpoints

- Planning pass: docs-only checkpoint is allowed only after clean `npm run verify:docs` and plan review, if the controller asks for a commit. Stage nothing by default.
- Implementation pass: one focused implementation checkpoint for `DME-B1` after tests, `npm run verify:maintainability`, and `npm run verify` pass. Keep active plan-doc edits out of implementation commits unless the controller explicitly chooses a separate tracked-doc checkpoint.

## Review Packet

Use `review-request` before implementation:

```text
REVIEW_REQUEST
TASK: Design coherence and Mid elegance root-cause remediation plan
TASK_FAMILY: cleanup/refactor
TIER: Tier 3 standalone remediation
REVIEW_TARGET: docs/plans/2026-05-18-design-mid-elegance-root-cause-remediation.md
PLAN_OR_ARTIFACT: docs/plans/2026-05-18-design-mid-elegance-root-cause-remediation.md
FILES_IN_SCOPE: DME-B1 files listed in Selected Execution Unit
FILES_OUT_OF_SCOPE: server-select implementation, EPG implementation, core server selection, orchestrator, Plex, persistence stores, stale EPG path, checklist docs
KEY_INVARIANTS: no stale EPG path; no hotspot growth; count-recovery limiter helper only; request-control extraction triggers replan
VERIFICATION_RUN: npm run verify:docs
KNOWN_RISKS: Codanna impact was insufficient for executor and fallback reads are controlling
WHAT_TO_PRIORITIZE: whether DME-B1 is sufficiently bounded and whether helper/test seams prove behavior without widening into request-control policy
OUTPUT_EXPECTATION: findings first by severity; say explicitly whether DME-B1 is implementation-ready
```

Adjudicate reviewer findings before selecting an implementation unit.
