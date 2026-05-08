**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** standalone remediation

# Verify Bundle Startup Remediation Plan

## Goal

Restore `npm run verify:bundle` by reducing the eager startup JavaScript bundle below the primary startup guard without weakening the guard, widening product behavior, or moving runtime responsibilities into app-shell composition roots.

This is a Tier 3 cleanup-loop standalone remediation package. It is not checklist-linked and must not update `ARCHITECTURE_CLEANUP_CHECKLIST.md` unless the controller explicitly promotes the work into checklist backlog. The loop may execute multiple serial remediation units because the parent handoff already named the remaining bundle-startup slices, but each unit must be selected, implemented, reviewed, and verified independently.

Completion means:

- `npm run verify:bundle` passes with eager startup JS and the bootstrap-containing entry both below `STARTUP_MAX_BYTES`.
- Required deferred modules remain absent from the eager closure.
- Startup shell can still display splash/fatal error handling before runtime engine load completes.
- Runtime, channel setup, EPG, and CSS behavior have no observed regressions under the verification gates below.

## Non-Goals

- Do not edit product source during planning.
- Do not change `STARTUP_MAX_BYTES`, remove required deferred-module checks, or route around `tools/verify-bundle.mjs`.
- Do not add compatibility shims, package barrels, root barrels, fallback runtime paths, or new dependencies.
- Do not redesign product behavior, startup auth/server-selection policy, EPG behavior, channel setup behavior, Plex behavior, persistence schema, or navigation behavior.
- Do not pursue asset/IPK packaging work unless fresh evidence proves assets affect the active startup guard or the active package target.
- Do not add `verify:bundle` to `npm run verify` until `verify:bundle` passes in the same closeout evidence.

## Parent Architecture Alignment

Current architecture truth assigns `src/bootstrap.ts` to environment bootstrap/startup wiring, `src/App.ts` to application shell composition, and `src/Orchestrator.ts` to the thin public runtime entry barrel. `src/App.ts` should eagerly own splash and top-level app-shell composition only; it should not eagerly import the runtime engine or regain feature-specific logic.

The long-term owner shape is an app-shell-owned async runtime-loader boundary:

- app shell owns shell containers, theme, splash, global error handling, deferred screen ports, and user-visible failure presentation;
- runtime engine remains behind `src/Orchestrator.ts` / `src/core/orchestrator/**`;
- channel setup planning/build remains in `src/core/channel-setup/**`;
- EPG runtime remains in `src/modules/ui/epg/**`;
- feature CSS loading is changed only after JavaScript startup cuts prove insufficient or CSS itself becomes an active startup budget target.

## Required Reading

Read in this order before implementation or review:

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/cleanup-loop.md`
4. `docs/agentic/plan-authoring-standard.md`
5. `docs/agentic/codanna-playbook.md`
6. `docs/architecture/CURRENT_STATE.md`
7. This plan
8. Source and test files named under `## Files In Scope`
9. `git status --short --branch`

Freshness gate: stop and refresh this plan if `tools/verify-bundle.mjs`, `src/index.ts`, `src/bootstrap.ts`, `src/App.ts`, `src/Orchestrator.ts`, app-shell runtime contracts, orchestrator assembly, channel setup, EPG exports, Vite chunking, or the observed `verify:bundle` metrics changed materially after 2026-05-08.

Planning observed unrelated dirty/untracked paths in the working tree. Preserve them unless a fresh source audit proves direct overlap with this plan.

## Required Skills

- `lineup-cleanup-loop`: required because the parent invoked Tier 3 cleanup-loop orchestration.
- `architecture-boundaries`: required because the work touches startup composition roots, runtime ownership, and app-shell/orchestrator seams.
- `verification-strategy`: required to freeze proof depth for behavior-preserving bundle/startup refactors plus CSS/manual smoke gates.
- `execution-plan-authoring`: required for this active tracked remediation plan.

Load `ui-composition-patterns` only if VB-S4 changes TV-visible CSS/layout/focus behavior beyond lazy stylesheet loading. Load `persistence-boundaries` or `plex-integration-boundaries` only if implementation discovers storage or Plex policy changes, which should normally be a stop/replan trigger.

## Codanna Discovery

- `get_index_info`: Codanna available with 12,106 symbols across 801 files; semantic search enabled with 194 embeddings; index created/updated about 34 minutes before planning.
- `semantic_search_with_context "Lineup startup bootstrap app shell lazy load runtime engine AppOrchestrator App.ts bootstrap index dynamic import"`: useful owner hits were `AppOrchestrator` at `src/core/orchestrator/AppOrchestrator.ts`, `InitializationCoordinator`, and `cleanupAndUninstallLineupBootstrap` at `src/bootstrap.ts`.
- `semantic_search_with_context "verify bundle startup guard eager JS bytes bootstrap-containing entry STARTUP_MAX_BYTES dynamic chunks"`: weak/noisy for guard literals; fallback direct read of `tools/verify-bundle.mjs` is authoritative for guard behavior.
- `search_documents "verify:bundle startup guard eager JS STARTUP_MAX_BYTES bootstrap containing entry cleanup plan"`: weak/noisy results; fallback direct reads of workflow docs and source are authoritative.
- `find_symbol App`: `src/App.ts` class `App`, symbol_id `9122`, uses app-shell and orchestrator runtime types. `analyze_impact` returned no dependents, so direct source/test reads must be used for import and startup behavior.
- `find_symbol installLineupBootstrap`: `src/bootstrap.ts`, symbol_id `107`; `analyze_impact` found `src/__tests__/bootstrap.test.ts` as the direct test caller.
- `find_symbol AppOrchestrator`: `src/core/orchestrator/AppOrchestrator.ts`, symbol_id `10001`, 83 methods and 54 type uses. `analyze_impact` returned no dependents, so treat Codanna impact as insufficient for the runtime value-import seam and verify with direct reads.
- `semantic_search_with_context "channel setup planning build modules orchestrator assembly EPG refresh runtime eager startup import closure"`: useful hits included `AppOrchestrator`, `loadChannels`, `resolveChannelItemsForSchedule`, `EPGConfig`, and EPG runtime paths. This supports VB-S3 as a later unit, not the first cut.
- `search_symbols buildChannelSetupOwners`: found `src/core/orchestrator/assembly/OrchestratorCoordinatorBuilders.ts`.
- `search_symbols EPGScheduleRefreshRuntime`: found `src/modules/ui/epg/runtime/EPGScheduleRefreshRuntime.ts`.
- `semantic_search_with_context "AppShellRuntimeContracts app shell runtime port contracts lazy screen runtime facade"`: weak/noisy; direct read of `src/core/app-shell/runtime/AppShellRuntimeContracts.ts` is authoritative.
- Fallback reads: `src/index.ts`, `src/bootstrap.ts`, `src/App.ts`, `src/Orchestrator.ts`, `src/core/app-shell/runtime/AppShellRuntimeContracts.ts`, `src/core/app-shell/deferred-screens/AppLazyScreenRegistry.ts`, `src/core/app-shell/deferred-screens/AppLazyScreenPortFactory.ts`, `src/core/orchestrator/assembly/OrchestratorCoordinatorBuilders.ts`, `src/core/orchestrator/assembly/OrchestratorModuleFactory.ts`, `src/modules/ui/epg/index.ts`, `src/modules/ui/epg/component/DeferredEPGComponent.ts`, `tools/verify-bundle.mjs`, `vite.config.ts`, `package.json`, and targeted startup/bundle/orchestrator tests.

## Impact Snapshot

Observed VB-S1 completed evidence:

- Commit `3f49988d` `fix: harden verify-bundle startup metrics` is `HEAD` on `code-health` and changed `tools/verify-bundle.mjs` plus `src/__tests__/tools/verifyBundle.test.ts`.
- `npm run verify:bundle -- --skip-build` was observed during planning and exits `1` validly on the primary startup guard.
- Metrics observed: eager JS `711193` bytes; bootstrap-containing entry `assets/index-U33Zp4e5.js` at `711193` bytes; eager CSS `151743` bytes; required deferred modules are emitted in dynamic chunks and do not leak into the eager closure.

Current source proof:

- `src/index.ts` statically imports all feature CSS and `installLineupBootstrap`.
- `src/bootstrap.ts` statically imports `App` and owns global handler installation, safe logging, fatal overlay fallback styles, debug API sync, bootstrap, cleanup, and install/uninstall helpers.
- `src/App.ts` statically imports the `AppOrchestrator` value from `src/Orchestrator.ts`, then constructs it in `App.start()` before deferred screens are initialized. This single value import pulls the runtime engine into the eager startup closure.
- `src/Orchestrator.ts` re-exports `AppOrchestrator` from `src/core/orchestrator/AppOrchestrator.ts` and should remain the thin public runtime entry.
- `AppLazyScreenRegistry` already uses dynamic imports for auth, profile-select, server-select, audio-setup, channel-setup, and settings screens.
- `DeferredEPGComponent` already dynamically imports `EPGComponent`, so VB-S3 should focus on EPG/coordinator/runtime and channel setup assembly imports that are still dragged through orchestrator runtime, not on the already-deferred EPG component loader.
- `OrchestratorCoordinatorBuilders.ts` eagerly imports `EPGCoordinator`, EPG helper exports, and channel setup build/planning owners. That is a likely VB-S3 seam only after VB-S2 produces fresh bundle metrics.
- `tools/verify-bundle.mjs` measures HTML module scripts plus static import closure, separately reports dynamic chunks, and fails if eager JS or the bootstrap-containing entry is at least `500000` bytes.

## Files In Scope

Whole remediation package:

- `src/index.ts`
- `src/bootstrap.ts`
- `src/App.ts`
- `src/Orchestrator.ts`
- `src/core/app-shell/runtime/AppShellRuntimeContracts.ts`
- new app-shell runtime-loader contract file at `src/core/app-shell/runtime/AppRuntimeEngineLoader.ts`
- `src/core/app-shell/deferred-screens/AppLazyScreenRegistry.ts`
- `src/core/app-shell/deferred-screens/AppLazyScreenPortFactory.ts`
- `src/core/app-shell/chrome/**`
- `src/core/app-shell/config/**`
- `src/core/orchestrator/AppOrchestrator.ts`
- `src/core/orchestrator/assembly/**`
- `src/core/channel-setup/**`
- `src/modules/ui/epg/**`
- `src/styles/**`
- `src/modules/ui/**/styles*.css`
- `src/__tests__/bootstrap.test.ts`
- `src/__tests__/App.test.ts`
- `src/__tests__/tools/verifyBundle.test.ts`
- `src/core/app-shell/__tests__/**`
- `src/core/orchestrator/__tests__/**`
- `src/core/channel-setup/__tests__/**`
- `src/modules/ui/epg/__tests__/**`
- CSS/style tests under `src/styles/**/__tests__` or adjacent UI style test files if VB-S4 changes CSS loading.

Ready-now VB-S2 scope is narrower and is defined under `## Architecture Seam Decision Gate`.

## Files Out Of Scope

- `tools/verify-bundle.mjs` and `src/__tests__/tools/verifyBundle.test.ts`, except read-only unless a reviewed replan proves the VB-S1 guard has a bug.
- `vite.config.ts`, except read-only unless a reviewed replan chooses chunk-policy work after source-level lazy boundaries are exhausted.
- `package.json` verification script wiring until VB-S6.
- `dist/**`, generated bundle artifacts, IPK/package outputs, and asset packaging files except as observed verification output.
- Plex auth/discovery/library/stream policy, scheduler/channel-manager domain behavior, persistence schema/storage keys, navigation behavior, focus policy, and platform services.
- Checklist/status docs, including `ARCHITECTURE_CLEANUP_CHECKLIST.md`, because this is standalone remediation.
- Pre-existing unrelated dirty/untracked files.

## Planner Self-Check

1. The primary unresolved seam is chosen: VB-S2 moves the runtime engine value import behind an app-shell-owned async loader while preserving shell-owned splash/error behavior.
2. Adjacent contract changes are explicit: app-shell runtime loader contracts are in scope; `src/Orchestrator.ts` remains the public runtime entry and is in scope only as the loaded module seam.
3. Files out of scope are not hidden dependencies for VB-S2. If VB-S2 needs Vite manual chunks, guard changes, feature CSS loading, channel setup rewiring, or EPG runtime changes, it must stop after recording fresh metrics and replan or advance to the relevant later unit.
4. Codanna evidence and fallback reads are recorded, including weak/noisy guard and document searches.
5. The plan assigns work to repo-preferred owners: app shell owns the loader boundary; orchestrator owns runtime engine; channel setup and EPG remain with their existing owners.
6. A fresh cleanup-loop worker can start `ready_now_execution_unit` `VB-S2` without inventing the owner seam, verification depth, or stop conditions.
7. This is execution-grade at seam/scope/verification level and intentionally avoids pseudo-code for local extraction details.

## Architecture Seam Decision Gate

Approved package sequencing:

- `ready_now_execution_unit: VB-S2`
- `VB-S2` must run first.
- `VB-S3` may start only after VB-S2 has clean implementation review and fresh `verify:bundle` output proving additional JavaScript cuts are still required.
- `VB-S4` may start only after VB-S2/VB-S3 JavaScript cuts are complete or fresh metrics prove CSS is now an active startup target.
- `VB-S5` is optional and requires fresh evidence that assets affect the startup guard or active IPK/package target.
- `VB-S6` may start only after `npm run verify:bundle` passes in the same closeout evidence.

Ready-now execution unit:

`ready_now_execution_unit: VB-S2 Startup Shell Vs Runtime Engine Lazy Boundary`

Goal: let app shell paint/splash/show fatal error without eagerly importing the runtime engine.

Approved VB-S2 seam:

- Keep `src/bootstrap.ts` as environment bootstrap and global error/debug lifecycle owner.
- Keep `src/App.ts` as shell composition owner, but remove its eager runtime-engine value dependency on `AppOrchestrator`.
- Add an app-shell-owned async runtime loader contract under `src/core/app-shell/runtime/AppRuntimeEngineLoader.ts`.
- Load `src/Orchestrator.ts` dynamically through that contract when `App.start()` reaches runtime-engine initialization.
- Initialize the first-load shell before awaiting the runtime loader: shell containers must exist, theme/splash/fatal-error fallback surfaces must be paintable, and a controlled pending runtime loader must leave observable shell-visible state ready instead of keeping startup invisible until the runtime chunk resolves.
- Do not satisfy VB-S2 by replacing an eager static import with an immediate awaited dynamic import at the top of `App.start()` before shell-visible state is ready.
- Preserve the `AppShellOrchestratorRuntime` port shape needed by existing app-shell deferred screens, diagnostics, toasts, lifecycle warnings, and blocking error overlay.
- Preserve startup/shutdown ordering, pagehide/pageshow behavior, global error overlay fallback, debug API behavior, and cleanup semantics.
- Keep `src/Orchestrator.ts` thin. It may continue to export the runtime class and public runtime types; it must not gain app-shell policy.

VB-S2 files in scope:

- `src/App.ts`
- `src/bootstrap.ts`
- `src/Orchestrator.ts`
- `src/core/app-shell/runtime/AppShellRuntimeContracts.ts`
- `src/core/app-shell/runtime/AppRuntimeEngineLoader.ts`
- `src/__tests__/App.test.ts`
- `src/__tests__/bootstrap.test.ts`
- app-shell runtime/deferred-screen tests if port typing or loader injection changes

VB-S2 files out of scope:

- `src/core/orchestrator/**` internals, except the public `src/Orchestrator.ts` module seam.
- channel setup planning/build, EPG runtime/coordinator, feature CSS loading, Vite config, bundle guard logic, package scripts, and assets.

VB-S2 stop/replan triggers:

- The app shell cannot show splash or fatal errors until after runtime import resolves.
- A controlled pending runtime loader leaves `#app` without the expected app-shell containers/splash/fatal-fallback-ready shell state.
- The solution requires editing `src/core/orchestrator/**` internals rather than only loading the existing public runtime entry.
- Runtime loader work requires Vite manual chunk policy, guard changes, CSS changes, channel setup changes, EPG changes, persistence changes, Plex changes, or navigation behavior changes.
- Type alignment requires weakening the app-shell runtime port contract or adding broad facade objects.
- Fresh `verify:bundle` output shows the runtime engine was not split into a dynamic chunk or a required deferred module leaked into eager startup closure.

Remaining execution units:

- `VB-S3 Defer Channel Setup Planning/Build And EPG Runtime Code`: after VB-S2, inspect fresh bundle stats for eager channel setup, orchestrator assembly, and EPG runtime modules. Approved goal is to keep heavy setup planning/build and EPG refresh/runtime code out of the eager closure without changing behavior. Likely files: `src/core/orchestrator/assembly/**`, `src/core/channel-setup/**`, `src/modules/ui/epg/**`, and focused tests. Stop/replan if the fix requires changing channel setup workflow semantics, EPG user behavior, scheduler/channel-manager policy, or public orchestrator runtime behavior.
- `VB-S4 Feature CSS Loading`: after JavaScript cuts, change CSS loading only if the guard still fails or CSS becomes an explicit target. Likely files: `src/index.ts`, `src/styles/**`, and `src/modules/ui/**/styles*.css`. Manual/browser smoke is mandatory if CSS loading changes.
- `VB-S5 Optional Asset/IPK Follow-Up`: do not start unless fresh evidence proves assets affect startup guard or active IPK/package target.
- `VB-S6 Release Verification Restoration`: after `verify:bundle` passes, decide whether and how to restore release verification routing. Likely file: `package.json`; run docs/control-plane verification if scripts or workflow docs change.

Subagent orchestration gates:

- Clean plan review is a hard precondition before VB-S2 product-code implementation.
- Implement VB-S2 through a bounded `cleanup_worker` pass using this plan and `ready_now_execution_unit`.
- Run a fresh read-only implementation reviewer on VB-S2 before advancing to VB-S3.
- For each later unit, select the next execution unit from this plan, brief a bounded `cleanup_worker`, review the implemented unit, then either advance or stop/replan on the triggers above.

Absorb-now rule: absorb only newly discovered residue that stays within the same approved execution unit goal, owner, files, verification envelope, and final closeout accounting. Replan for new owners, new package membership, changed execution-unit membership, materially wider verification, or changed final-owner accounting.

## Verification Commands

- Verification classification: `broader integration/manual proof required`

Primary proof mode: `integration-ops` with supporting `refactor-invariance`. VB-S2 and VB-S3 are behavior-preserving startup/runtime refactors where correctness depends on bundle metrics plus existing startup/orchestrator tests. VB-S4 adds `UX-manual` proof if CSS loading changes.

Plan validation:

- Run: `npm run verify:docs`
  - Expected: active tracked plan structure and docs/tooling checks pass.

VB-S2 required proof:

- Run: `npm test -- --runTestsByPath src/__tests__/bootstrap.test.ts src/__tests__/App.test.ts`
  - Expected: bootstrap install/cleanup, debug API, global error fallback, app startup/shutdown, deferred screens, lifecycle warnings, and app-shell runtime wiring still pass.
- Add or update targeted `App` startup tests with an injected controlled pending runtime loader.
  - Expected: before the runtime loader promise resolves, `App.start()` has initialized first-load shell state enough for shell containers plus splash/fatal fallback surfaces to be paintable; the test must fail if the implementation immediately awaits the runtime chunk before observable shell-visible state is ready.
- Add or update targeted `App` startup tests with an injected rejected runtime loader.
  - Expected: runtime-load failure is reported through existing startup failure handling, leaves cleanup/debug state consistent with prior bootstrap failure behavior, and does not require `src/core/orchestrator/**` internals to load before showing a user-visible fatal fallback.
- Run app-shell focused tests if VB-S2 touches app-shell runtime/deferred-screen contracts.
  - Expected: lazy screen registry, port factory, chrome, diagnostics, and theme behavior remain stable.
- Run: `npm run typecheck`
  - Expected: async runtime loader contracts and app-shell runtime port typing compile without broad facades or unsafe casts.
- Run: `npm run verify:bundle`
  - Expected: build succeeds, required deferred modules remain deferred, and eager JS/entry metrics improve. If it still fails only on size, record the new metrics and proceed to VB-S3. If it fails on guard mapping or leakage, stop and replan.
- Run: `npm run verify`
  - Expected: full UI/navigation/orchestrator/Plex gate passes because VB-S2 touches startup and Orchestrator-facing app-shell work.

VB-S3 required proof:

- Run targeted orchestrator assembly, channel setup, and EPG tests affected by the implementation.
  - Expected: coordinator assembly, channel setup workflow/build/planning, EPG coordinator/runtime, deferred EPG component, and startup config behavior remain stable.
- Run: `npm run typecheck`
- Run: `npm run verify:bundle`
- Run: `npm run verify`

VB-S4 required proof:

- Run: `npm run lint:css`
- Run affected CSS/style tests.
- Run: `npm run verify:bundle`
- Run: `npm run verify`
- Manual/browser smoke: open the built or served app in a browser and verify splash, auth/server-select/profile/audio/channel-setup/settings screens, EPG open/close, overlays, theme application, and fatal error fallback styling remain visually usable. Capture the exact URL, viewport(s), and observed results in closeout.

VB-S5 required proof:

- Evidence first: show which asset/package target affects the startup guard or active IPK/package target.
- Then run the narrow asset/package command plus `npm run verify:bundle`; run `npm run verify` if source or UI behavior changed.

VB-S6 required proof:

- Run: `npm run verify:bundle`
  - Expected: passes in the same closeout evidence.
- Run: `npm run verify`
  - Expected: passes after any release verification routing restoration.
- Run: `npm run verify:docs` if `package.json`, workflow docs, or tracked plan references change.

## Rollback Notes

- Roll back by execution unit. Do not revert unrelated dirty files.
- If VB-S2 breaks startup shell behavior, restore the previous eager `AppOrchestrator` construction path and keep any tests that exposed the regression for the revised plan.
- If VB-S2 improves bundle size but still fails validly, keep the reviewed VB-S2 commit and proceed to VB-S3 with fresh metrics.
- If a later unit leaks required deferred modules into eager closure, revert that unit and replan from the last clean `verify:bundle` metrics.
- If CSS loading changes cause visual regressions, revert VB-S4 only and leave reviewed JavaScript lazy-boundary work intact.
- If release routing restoration fails, keep the bundle-size remediation commits and replan VB-S6 separately.

## Commit Checkpoints

- After clean plan review and before or alongside the VB-S2 execution handoff, stage and commit this tracked plan artifact as a plan-doc commit. This planning pass cannot stage or commit, so the controller closeout must handle that commit boundary explicitly.
- `cleanup(vb-s2): lazy load runtime engine from app shell`
- `cleanup(vb-s3): defer startup-heavy channel setup and epg runtime code`
- `cleanup(vb-s4): defer feature css from startup shell` only if VB-S4 is needed and reviewed.
- `cleanup(vb-s5): adjust startup asset package surface` only if evidence activates VB-S5.
- `chore(vb-s6): restore bundle verification release gate` only after `npm run verify:bundle` passes.

Keep active tracked plan updates out of worker implementation commits unless the controller explicitly chooses a separate docs commit.
