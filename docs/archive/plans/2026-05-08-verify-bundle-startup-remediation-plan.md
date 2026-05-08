**Plan Status:** archived
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

Load `ui-composition-patterns` only if VB-S5 changes TV-visible CSS/layout/focus behavior beyond lazy stylesheet loading. Load `persistence-boundaries` or `plex-integration-boundaries` only if implementation discovers storage or Plex policy changes, which should normally be a stop/replan trigger.

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
- 2026-05-08 post-VB-S3 refresh:
  - `semantic_search_with_context "Lineup verify bundle startup eager JS Orchestrator chunk lazy runtime engine after VB-S3 next remediation unit"` was weak/noisy for the post-VB-S3 source seam.
  - `search_documents "verify bundle startup remediation plan VB-S3 VB-S4 eager JS Orchestrator chunk"` was weak/noisy; direct reads of this plan plus `dist/index.html`, `dist/bundle-stats.json`, and source import seams are authoritative.
  - `search_symbols "AppRuntimeEngineLoader"` returned no symbol because the current Codanna index does not expose the new loader symbol; direct read of `src/core/app-shell/runtime/AppRuntimeEngineLoader.ts` is authoritative.
  - `search_symbols "createChannelSetupWorkflowPort LazyChannelSetupWorkflowPortOwners EPGScheduleRefreshRuntime"` confirmed the VB-S3 deferred owners are present, including `EPGScheduleRefreshRuntime` and channel setup workflow/planning symbols.
- Fallback reads: `src/index.ts`, `src/bootstrap.ts`, `src/App.ts`, `src/Orchestrator.ts`, `src/core/app-shell/runtime/AppShellRuntimeContracts.ts`, `src/core/app-shell/deferred-screens/AppLazyScreenRegistry.ts`, `src/core/app-shell/deferred-screens/AppLazyScreenPortFactory.ts`, `src/core/orchestrator/assembly/OrchestratorCoordinatorBuilders.ts`, `src/core/orchestrator/assembly/OrchestratorModuleFactory.ts`, `src/modules/ui/epg/index.ts`, `src/modules/ui/epg/component/DeferredEPGComponent.ts`, `tools/verify-bundle.mjs`, `vite.config.ts`, `package.json`, and targeted startup/bundle/orchestrator tests.

## Impact Snapshot

Observed VB-S1 completed evidence:

- Commit `3f49988d` `fix: harden verify-bundle startup metrics` is `HEAD` on `code-health` and changed `tools/verify-bundle.mjs` plus `src/__tests__/tools/verifyBundle.test.ts`.
- `npm run verify:bundle -- --skip-build` was observed during planning and exits `1` validly on the primary startup guard.
- Metrics observed: eager JS `711193` bytes; bootstrap-containing entry `assets/index-U33Zp4e5.js` at `711193` bytes; eager CSS `151743` bytes; required deferred modules are emitted in dynamic chunks and do not leak into the eager closure.

Current source proof:

- `src/index.ts` statically imports all feature CSS and `installLineupBootstrap`.
- `src/bootstrap.ts` statically imports `App` and owns global handler installation, safe logging, fatal overlay fallback styles, debug API sync, bootstrap, cleanup, and install/uninstall helpers.
- `src/App.ts` now uses the VB-S2 async runtime loader boundary from `src/core/app-shell/runtime/AppRuntimeEngineLoader.ts`; the remaining post-VB-S3 eager JavaScript path comes from app-shell startup value imports through `AppOrchestratorConfigFactory` and `AppContainerFactory` into runtime-heavy feature barrels.
- `src/Orchestrator.ts` re-exports `AppOrchestrator` from `src/core/orchestrator/AppOrchestrator.ts` and should remain the thin public runtime entry.
- `AppLazyScreenRegistry` already uses dynamic imports for auth, profile-select, server-select, audio-setup, channel-setup, and settings screens.
- Pre-VB-S3 source proof showed `DeferredEPGComponent` already dynamically imported `EPGComponent`, while `OrchestratorCoordinatorBuilders.ts` still pulled EPG/coordinator/runtime and channel setup assembly imports through the orchestrator runtime. VB-S3 has since deferred the named channel setup and EPG runtime owners; the remaining post-VB-S3 eager path is app-shell config/container imports of feature barrels.
- `tools/verify-bundle.mjs` measures HTML module scripts plus static import closure, separately reports dynamic chunks, and fails if eager JS or the bootstrap-containing entry is at least `500000` bytes.

Post-VB-S3 observed evidence:

- Commits `2c0eb531` and `327c9d3a` completed VB-S2 and VB-S3. Current generated metadata from `dist/index.html` points at eager script `assets/index-Wo7eMbml.js` and eager stylesheet `assets/index-ei58rT2C.css`.
- `npm run verify:bundle -- --skip-build` exits `1` validly on eager JavaScript only: eager JS `633387` bytes; bootstrap entry `assets/index-Wo7eMbml.js` `80817` bytes; eager CSS `151743` bytes; required deferred modules remain emitted in dynamic chunks.
- Eager JS chunks are `assets/hash-3SHkovZ7.js`, `assets/index-Wo7eMbml.js`, `assets/inlineSvg-CZL4jy0t.js`, `assets/plexAuthTransport-BnzAoAGI.js`, and `assets/Orchestrator-BfZpYjKW.js`. The failing guard is still JavaScript, not CSS.
- Static closure tracing from `dist/bundle-stats.json` shows eager paths into `assets/Orchestrator-BfZpYjKW.js` are caused by app-shell startup imports, not by the CSS entry:
  - `src/App.ts` -> `src/core/app-shell/config/AppOrchestratorConfigFactory.ts` -> feature barrels such as `src/modules/plex/auth/index.ts` and `src/modules/ui/epg/index.ts`, which re-export runtime-heavy owners.
  - `src/App.ts` -> `src/core/app-shell/chrome/AppContainerFactory.ts` -> feature barrels such as `src/modules/ui/player-osd/index.ts` and `src/modules/ui/mini-guide/index.ts`, which re-export overlays/coordinators and scheduler dependencies.
- `assets/Orchestrator-BfZpYjKW.js` contains eager-reachable app-shell configuration/container dependencies including Plex auth, EPG coordinator/startup config, player OSD, mini guide, channel badge/number/transition, exit confirm, scheduler, and shared utility modules. The next guard lever is therefore source-level app-shell import hygiene before any CSS unit.

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
- CSS/style tests under `src/styles/**/__tests__` or adjacent UI style test files if VB-S5 changes CSS loading.

Ready-now VB-S4 scope is narrower and is defined under `## Architecture Seam Decision Gate`.

## Files Out Of Scope

- `tools/verify-bundle.mjs` and `src/__tests__/tools/verifyBundle.test.ts`, except read-only unless a reviewed replan proves the VB-S1 guard has a bug.
- `vite.config.ts`, except read-only unless a reviewed replan chooses chunk-policy work after source-level lazy boundaries are exhausted.
- `package.json` verification script wiring until VB-S7.
- `dist/**`, generated bundle artifacts, IPK/package outputs, and asset packaging files except as observed verification output.
- Plex auth/discovery/library/stream policy, scheduler/channel-manager domain behavior, persistence schema/storage keys, navigation behavior, focus policy, and platform services.
- Checklist/status docs, including `ARCHITECTURE_CLEANUP_CHECKLIST.md`, because this is standalone remediation.
- Pre-existing unrelated dirty/untracked files.

## Planner Self-Check

1. The primary unresolved seam is chosen: VB-S4 removes app-shell eager value imports of feature barrels that drag runtime-heavy modules into the startup static closure, while preserving app-shell ownership of startup config values and container IDs.
2. Adjacent contract changes are explicit: app-shell config/container imports may change only to owning leaf modules for existing constants/config/types; feature behavior and public barrels are out of scope unless a stop/replan approves a wider owner.
3. Files out of scope are not hidden dependencies for VB-S4. If VB-S4 needs Vite manual chunks, guard changes, feature CSS loading, runtime-loader changes, channel setup rewiring, EPG runtime changes, Plex behavior changes, or navigation changes, it must stop after recording fresh metrics and replan or advance to the relevant later unit.
4. Codanna evidence and fallback reads are recorded, including weak/noisy guard and document searches.
5. The plan assigns work to repo-preferred owners: app shell owns startup config/container composition imports; feature modules own their constants/config/types; orchestrator owns runtime engine; channel setup and EPG runtime behavior remain with their existing owners.
6. A fresh cleanup-loop worker can start `ready_now_execution_unit` `VB-S4` without inventing the owner seam, verification depth, or stop conditions.
7. This is execution-grade at seam/scope/verification level and intentionally avoids pseudo-code for local extraction details.

## Architecture Seam Decision Gate

Approved package sequencing:

- `VB-S2` completed in commit `2c0eb531`.
- `VB-S3` completed in commit `327c9d3a`.
- `ready_now_execution_unit: VB-S4`
- `VB-S4` must run next because post-VB-S3 bundle metadata proves eager JavaScript still fails and is pulled through app-shell value imports of runtime-heavy feature barrels.
- `VB-S5` may start only after VB-S4 JavaScript cuts are complete or fresh metrics prove CSS is now an active startup target.
- `VB-S6` is optional and requires fresh evidence that assets affect the startup guard or active IPK/package target.
- `VB-S7` may start only after `npm run verify:bundle` passes in the same closeout evidence.

Ready-now execution unit:

`ready_now_execution_unit: VB-S4 App-Shell Startup Import Hygiene`

Goal: remove app-shell startup value imports of feature barrels that drag runtime-heavy modules into the eager JavaScript closure, while preserving startup config values, container IDs, shell DOM order, and runtime behavior.

Approved VB-S4 seam:

- Keep `src/bootstrap.ts` as environment bootstrap and global error/debug lifecycle owner.
- Keep `src/App.ts` as app-shell composition owner and preserve the existing async runtime loader boundary from VB-S2.
- Keep `src/core/app-shell/config/AppOrchestratorConfigFactory.ts` as the startup config assembly owner, but do not import runtime-heavy feature barrels just to read defaults, constants, or types. Use owning leaf modules for constants/config/type-only imports.
- Keep `src/core/app-shell/chrome/AppContainerFactory.ts` as the shell container owner, but do not import overlay/coordinator barrels just to read container IDs. Use owning constants leaf modules or the existing app-shell container ID owner.
- Do not change public feature barrels solely to make startup smaller unless a direct leaf import is impossible or would create a worse owner boundary. If a barrel change is required, stop and replan with the affected feature owner named.
- Preserve app-shell container IDs, append order, duplicate-container reconciliation, class names, ARIA attributes, startup config values, platform service usage, and `OrchestratorConfig` shape.
- Do not move Plex auth policy, EPG runtime/coordinator behavior, overlay/coordinator logic, scheduler policy, or navigation behavior into app shell.
- Do not satisfy VB-S4 by hiding eager code in unmeasured chunks, changing `tools/verify-bundle.mjs`, changing Vite chunk policy, or raising `STARTUP_MAX_BYTES`.

VB-S4 files in scope:

- `src/App.ts`
- `src/core/app-shell/config/AppOrchestratorConfigFactory.ts`
- `src/core/app-shell/chrome/AppContainerFactory.ts`
- owning constants/config/type leaf modules already referenced by those two files, including:
  - `src/modules/plex/auth/config.ts`
  - `src/modules/ui/epg/constants.ts`
  - `src/modules/ui/epg/types.ts`
  - `src/modules/ui/player-osd/constants.ts`
  - `src/modules/ui/player-osd/types.ts`
  - `src/modules/ui/channel-number-overlay/constants.ts`
  - `src/modules/ui/channel-number-overlay/types.ts`
  - `src/modules/ui/channel-badge/constants.ts`
  - `src/modules/ui/channel-badge/types.ts`
  - `src/modules/ui/mini-guide/constants.ts`
  - `src/modules/ui/mini-guide/types.ts`
  - `src/modules/ui/channel-transition/constants.ts`
  - `src/modules/ui/channel-transition/types.ts`
  - `src/modules/ui/exit-confirm/constants.ts`
- `src/__tests__/App.test.ts`
- focused app-shell config/container tests if existing coverage does not already assert preserved config values or DOM order

VB-S4 files out of scope:

- `src/bootstrap.ts`, `src/Orchestrator.ts`, `src/core/orchestrator/**`, runtime loader contracts, channel setup planning/build, EPG runtime/coordinator/component behavior, feature CSS loading, Vite config, bundle guard logic, package scripts, and assets.
- Plex auth implementation, Plex transport/discovery/library/stream behavior, scheduler/channel-manager behavior, navigation behavior, and UI overlay behavior.

VB-S4 stop/replan triggers:

- Any required fix changes feature behavior, feature public contracts, feature barrel exports, Plex auth/discovery/library/stream policy, scheduler/channel-manager policy, navigation behavior, EPG behavior, or UI overlay behavior instead of only narrowing app-shell imports.
- Existing owner leaf modules do not expose the needed constants/config/types without introducing a new public compatibility path or root barrel.
- The source closure cannot be mapped soundly from `dist/bundle-stats.json`, bootstrap entry is not eager-reachable, or required deferred modules leak into the eager closure.
- Fresh `verify:bundle` still includes `assets/Orchestrator-*.js` in eager chunks for app-shell config/container reasons after all approved direct-import fixes are exhausted.
- The change requires Vite manual chunk policy, CSS loading changes, guard changes, runtime loader changes, channel setup changes, EPG runtime changes, persistence changes, Plex behavior changes, or navigation behavior changes.
- Type alignment requires adding broad facades, compatibility shims, root barrels, or fallback paths.

Remaining execution units:

- `VB-S5 Feature CSS Loading`: after JavaScript cuts, change CSS loading only if the guard still fails or CSS becomes an explicit target. Likely files: `src/index.ts`, `src/styles/**`, and `src/modules/ui/**/styles*.css`. Manual/browser smoke is mandatory if CSS loading changes.
- `VB-S6 Optional Asset/IPK Follow-Up`: do not start unless fresh evidence proves assets affect startup guard or active IPK/package target.
- `VB-S7 Release Verification Restoration`: after `verify:bundle` passes, decide whether and how to restore release verification routing. Likely file: `package.json`; run docs/control-plane verification if scripts or workflow docs change.

Subagent orchestration gates:

- Clean plan refresh/review is a hard precondition before VB-S4 product-code implementation.
- Implement VB-S4 through a bounded `cleanup_worker` pass using this plan and `ready_now_execution_unit`.
- Run a fresh read-only implementation reviewer on VB-S4 before advancing to VB-S5 or closeout.
- For each later unit, select the next execution unit from this plan, brief a bounded `cleanup_worker`, review the implemented unit, then either advance or stop/replan on the triggers above.

Absorb-now rule: absorb only newly discovered residue that stays within the same approved execution unit goal, owner, files, verification envelope, and final closeout accounting. Replan for new owners, new package membership, changed execution-unit membership, materially wider verification, or changed final-owner accounting.

## Verification Commands

- Verification classification: `broader integration/manual proof required`

Primary proof mode: `integration-ops` with supporting `refactor-invariance`. VB-S4 is a behavior-preserving app-shell import-boundary refactor where correctness depends on bundle metrics plus existing app-shell/startup/orchestrator tests. CSS work is now VB-S5 and adds `UX-manual` proof only if CSS loading changes.

Plan validation:

- Run: `npm run verify:docs`
  - Expected: active tracked plan structure and docs/tooling checks pass.

VB-S4 required proof:

- Run: `npm test -- --runTestsByPath src/__tests__/App.test.ts`
  - Expected: app startup/shutdown, shell containers, deferred screens, lifecycle warnings, runtime loader wiring, config values, and screen visibility behavior still pass.
- Run focused app-shell config/container tests if the implementation changes or adds tests near those owners.
  - Expected: container IDs, DOM append order, duplicate-container reconciliation, class names, ARIA attributes, startup config defaults, and platform service config behavior remain stable.
- Run: `npm run typecheck`
  - Expected: direct leaf imports and type-only imports compile without broad facades, compatibility shims, root barrels, or unsafe casts.
- Run: `npm run verify:bundle`
  - Expected: build succeeds, required deferred modules remain deferred, bootstrap entry remains eager-reachable, eager JS improves, and `assets/Orchestrator-*.js` is no longer eager due to app-shell config/container imports. If it still fails only on size after removing those imports, record the new metrics and select VB-S5 only if CSS becomes active or replan for the next JavaScript source seam. If it fails on guard mapping or leakage, stop and replan.
- Run: `npm run verify`
  - Expected: full UI/navigation/orchestrator/Plex gate passes because VB-S4 touches startup app-shell imports that feed orchestrator config and shell containers.

Historical VB-S2/VB-S3 proof already observed by controller:

- `npm run verify`: pass.
- `npm run build:analyze`: pass with existing Vite >500 kB warning.
- `npm run verify:bundle`: valid failure only on eager JS `633387` bytes with bootstrap entry `80817` bytes and required deferred modules still dynamic.

VB-S5 required proof:

- Run: `npm run lint:css`
- Run affected CSS/style tests.
- Run: `npm run verify:bundle`
- Run: `npm run verify`
- Manual/browser smoke: open the built or served app in a browser and verify splash, auth/server-select/profile/audio/channel-setup/settings screens, EPG open/close, overlays, theme application, and fatal error fallback styling remain visually usable. Capture the exact URL, viewport(s), and observed results in closeout.

VB-S6 required proof:

- Evidence first: show which asset/package target affects the startup guard or active IPK/package target.
- Then run the narrow asset/package command plus `npm run verify:bundle`; run `npm run verify` if source or UI behavior changed.

VB-S7 required proof:

- Run: `npm run verify:bundle`
  - Expected: passes in the same closeout evidence.
- Run: `npm run verify`
  - Expected: passes after any release verification routing restoration.
- Run: `npm run verify:docs` if `package.json`, workflow docs, or tracked plan references change.

## Rollback Notes

- Roll back by execution unit. Do not revert unrelated dirty files.
- If VB-S2 breaks startup shell behavior, restore the previous eager `AppOrchestrator` construction path and keep any tests that exposed the regression for the revised plan.
- If VB-S2 improves bundle size but still fails validly, keep the reviewed VB-S2 commit and proceed to VB-S3 with fresh metrics.
- If VB-S4 breaks startup config/container behavior or changes feature runtime behavior, revert VB-S4 only and replan from the post-VB-S3 metrics.
- If a later unit leaks required deferred modules into eager closure, revert that unit and replan from the last clean `verify:bundle` metrics.
- If CSS loading changes cause visual regressions, revert VB-S5 only and leave reviewed JavaScript lazy-boundary work intact.
- If release routing restoration fails, keep the bundle-size remediation commits and replan VB-S7 separately.

## Commit Checkpoints

- Stage and commit this tracked plan refresh as a separate plan-doc commit before VB-S4 product-code implementation or alongside the controller handoff. Keep it out of the worker implementation commit.
- `cleanup(vb-s2): lazy load runtime engine from app shell`
- `cleanup(vb-s3): defer startup-heavy channel setup and epg runtime code`
- `cleanup(vb-s4): remove app-shell eager feature barrel imports`
- `cleanup(vb-s5): defer feature css from startup shell` only if VB-S5 is needed and reviewed.
- `cleanup(vb-s6): adjust startup asset package surface` only if evidence activates VB-S6.
- `chore(vb-s7): restore bundle verification release gate` only after `npm run verify:bundle` passes.

Keep active tracked plan updates out of worker implementation commits unless the controller explicitly chooses a separate docs commit.
