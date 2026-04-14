# P2-W4 App-Shell Transitional Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete `P2-W4` by removing remaining app-shell transitional seams (container-ID ownership drift and mapped shell/startup `innerHTML` security findings) while preserving startup/shell behavior.

**Architecture:** Rewire app-shell startup wiring to consume existing module-owned container constants for feature surfaces (`now-playing-info`, `playback-options`) instead of repeating literals in `App` and `AppContainerFactory`, then remove the three deferred shell/startup `innerHTML` assignments via DOM-safe clearing (`replaceChildren`) without changing UI behavior or composition-root ownership.

**Tech Stack:** TypeScript, Jest, Vite

---

## Goal

- Finish the checklist item:
  - `P2-W4 clean up shell-level glue, duplicate container knowledge, and any app-shell transitional seams left after the boundary cleanup`
- Retire the mapped imported review issue:
  - `review::.::holistic::convention_outlier::container_id_convention_split::89da5d23`
- Retire the deferred shell/startup security findings currently owned by `P2-W4`:
  - `security::src/core/app-shell/AppBlockingErrorOverlayPresenter.ts::security::innerHTML_assignment::src/core/app-shell/AppBlockingErrorOverlayPresenter.ts::49`
  - `security::src/modules/ui/audio-setup/AudioSetupScreen.ts::security::innerHTML_assignment::src/modules/ui/audio-setup/AudioSetupScreen.ts::420`
  - `security::src/modules/ui/splash/SplashScreen.ts::security::innerHTML_assignment::src/modules/ui/splash/SplashScreen.ts::19`

## Non-Goals

- No `P2-W3` policy extraction work.
- No `P3` persistence-owner-map work.
- No new long-lived collaborator that re-owns feature-surface container IDs.
- No UI redesign, class-name renaming, container append-order changes, focus-flow changes, or timing changes.
- No compatibility shims or dual-path ownership for container IDs.

## Parent-Priority Alignment (Priority 2)

This plan executes the final `P2-W#` item in [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../ARCHITECTURE_CLEANUP_CHECKLIST.md):

- `P2-W4` closes shell-level cleanup residue left by `P2-W1`/`P2-W2` and pending `P2-W3` completion.
- This is the final bounded cleanup unit before `P2-EXIT`, so it must leave imported-issue and security ownership explicit and auditable.

## Required Reading

1. [`agents.md`](../../agents.md)
2. [`docs/AGENTIC_DEV_WORKFLOW.md`](../AGENTIC_DEV_WORKFLOW.md)
3. [`docs/agentic/codanna-playbook.md`](../agentic/codanna-playbook.md)
4. [`docs/agentic/plan-authoring-standard.md`](../agentic/plan-authoring-standard.md)
5. [`docs/agentic/historical-plan-corpus-review.md`](../agentic/historical-plan-corpus-review.md)
6. [`docs/architecture/CURRENT_STATE.md`](../architecture/CURRENT_STATE.md)
7. [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../ARCHITECTURE_CLEANUP_CHECKLIST.md)
8. [`src/App.ts`](../../src/App.ts)
9. [`src/core/app-shell/AppContainerFactory.ts`](../../src/core/app-shell/AppContainerFactory.ts)
10. [`src/core/app-shell/AppBlockingErrorOverlayPresenter.ts`](../../src/core/app-shell/AppBlockingErrorOverlayPresenter.ts)
11. [`src/modules/ui/audio-setup/AudioSetupScreen.ts`](../../src/modules/ui/audio-setup/AudioSetupScreen.ts)
12. [`src/modules/ui/splash/SplashScreen.ts`](../../src/modules/ui/splash/SplashScreen.ts)
13. [`src/modules/ui/now-playing-info/constants.ts`](../../src/modules/ui/now-playing-info/constants.ts)
14. [`src/modules/ui/playback-options/constants.ts`](../../src/modules/ui/playback-options/constants.ts)
15. [`src/__tests__/fixtures/appShellContainerIds.ts`](../../src/__tests__/fixtures/appShellContainerIds.ts)

## Freshness Gate

If any of these changed materially after `2026-03-11`, refresh this plan before implementation:

- `src/App.ts`
- `src/core/app-shell/AppContainerFactory.ts`
- `src/core/app-shell/AppBlockingErrorOverlayPresenter.ts`
- `src/modules/ui/audio-setup/AudioSetupScreen.ts`
- `src/modules/ui/splash/SplashScreen.ts`
- `src/modules/ui/now-playing-info/constants.ts`
- `src/modules/ui/playback-options/constants.ts`
- `src/__tests__/fixtures/appShellContainerIds.ts`
- `ARCHITECTURE_CLEANUP_CHECKLIST.md`

Stop and re-plan if:

- `P2-W3` leaves unresolved app-shell policy ownership that changes this seam,
- container IDs are already centralized elsewhere,
- or `P2-EXIT` was already closed in a parallel branch/worktree.

## Required Skills

1. `using-superpowers`
2. `brainstorming`
3. `architecture-boundaries`
4. `ui-composition-patterns`
5. `persistence-boundaries`
6. `executing-plans`
7. `systematic-debugging` (only if verification fails unexpectedly)

## Codanna Discovery

### `semantic_search_with_context`

- Query: `P2-W4 app-shell transitional seams duplicate container knowledge diagnostics surface isolation App.ts`
  - Result: no semantic matches (`No documentation found matching query ...`).
- Retry: `AppDiagnosticsSurface dev menu diagnostics App.ts typescript`
  - Result: one weak unrelated hit (`AppErrorCode`, similarity `0.338`), not useful for seam planning.

Interpretation: semantic retrieval for this seam was insufficient/noisy.

### `get_index_info`

- Snapshot: `10365` symbols across `448` files.
- Semantic status: enabled (`AllMiniLML6V2`), embeddings `17`, updated ~11 minutes before queries.
- Limitation observed: some impact traces still referenced stale `App` method names no longer in current file text, so deterministic fallback was required.

### `search_documents`

- Query: `P2-W4 diagnostics surface isolation target shape invariants expected skills`
  - Useful tracked hit: `docs/agentic/historical-plan-corpus-review.md` (`P2-W4 diagnostics surface isolation` section).
  - Additional hits were local import artifacts under `docs/_local/**` and were not treated as canonical task memory.
- Query: `P2-W4 clean up shell-level glue duplicate container knowledge app-shell transitional seams`
  - Useful tracked hit: `docs/agentic/historical-plan-corpus-review.md` (`P2-W5 cleanup-pass shape` for sequencing constraints).

### `analyze_impact`

- `createAppContainers` (`symbol_id:6663`) -> impacted symbols:
  - `App._createContainers`
  - `App.start`
- `SplashScreen` (`symbol_id:5474`) -> impacted symbol:
  - `App`
- `AudioSetupScreen` (`symbol_id:3014`) -> impacted symbols:
  - `App`
  - `AppLazyScreenRegistry`
  - plus stale-index references to former `App` visibility methods
- `AppBlockingErrorOverlayPresenter` (`symbol_id:6796`) -> no impacted symbols returned (likely index gap for class-based usage).

### Explicit fallback note (`rg` + direct reads + `desloppify`)

Because Codanna semantic/impact coverage was partial, deterministic fallback evidence was used:

- `desloppify show review::.::holistic::convention_outlier::container_id_convention_split::89da5d23` confirms the live open issue still maps to:
  - `src/App.ts`
  - `src/core/app-shell/AppContainerFactory.ts`
  - `src/modules/ui/now-playing-info/constants.ts`
  - `src/modules/ui/playback-options/constants.ts`
- `rg` confirmed repeated feature-surface container literals are currently present in both wiring and owner constants:
  - `src/App.ts`: `now-playing-info-container`, `playback-options-container`
  - `src/core/app-shell/AppContainerFactory.ts`: `now-playing-info-container`, `playback-options-container`
  - `src/modules/ui/now-playing-info/constants.ts`: `NOW_PLAYING_INFO_CLASSES.CONTAINER`
  - `src/modules/ui/playback-options/constants.ts`: `PLAYBACK_OPTIONS_CLASSES.CONTAINER`
- `src/__tests__/fixtures/appShellContainerIds.ts` also currently hard-codes the same two IDs.
- Direct reads confirmed shell/startup `innerHTML` assignments still exist at:
  - `src/core/app-shell/AppBlockingErrorOverlayPresenter.ts:49`
  - `src/modules/ui/audio-setup/AudioSetupScreen.ts:420`
  - `src/modules/ui/splash/SplashScreen.ts:19`
- `desloppify` evidence confirmed exact open issue IDs:
  - `review::.::holistic::convention_outlier::container_id_convention_split::89da5d23`
  - security IDs listed in Goal.

## Impact Snapshot

Primary seams and symbols:

- `createAppContainers` (`symbol_id:6663`) -> startup container assembly path.
- `App._createContainers()` / `App.start()` -> app-shell startup wiring.
- `NOW_PLAYING_INFO_CLASSES.CONTAINER` / `PLAYBACK_OPTIONS_CLASSES.CONTAINER` -> module-owned feature container ID sources consumed by startup wiring.
- `AppBlockingErrorOverlayPresenter._render()` -> blocking overlay clear/render lifecycle.
- `SplashScreen._buildUI()` -> startup shell root-content rebuild.
- `AudioSetupScreen.destroy()` -> setup-screen teardown clear path.

High-risk preservation areas:

- container append order and IDs used by startup wiring/tests
- error overlay modal lifecycle and focusable registration cleanup
- splash and audio-setup visible behavior and teardown behavior

## Architecture Seam Decision Gate

Locked decisions for execution:

1. Container ID ownership for feature surfaces remains with their module constants:
   - `src/modules/ui/now-playing-info/constants.ts`
   - `src/modules/ui/playback-options/constants.ts`
   and `App` / `AppContainerFactory` must consume those owners instead of repeating literals.
2. `P2-W4` resolves only shell/startup cleanup seams; no additional feature-policy extraction.
3. All three mapped `innerHTML` issues are resolved in-place using DOM-safe node clearing, preserving behavior and ownership.
4. Final-owner rule for `review::.::holistic::convention_outlier::container_id_convention_split::89da5d23`:
   - expected disposition: `resolved` by `P2-W4`
   - if still open after the required verification commands, `P2-W4` cannot be closed unless checklist records a `split follow-up` with one final owner (`P4-W5`) plus reason and revisit trigger.

Out-of-bounds:

- expanding this task into broader UI-security backlog (Priority 4 owners remain unchanged),
- moving persistence ownership into new stores/repositories,
- changing orchestrator public contracts.

## Files In Scope

- Modify: `src/App.ts`
- Modify: `src/core/app-shell/AppContainerFactory.ts`
- Modify: `src/modules/ui/now-playing-info/constants.ts` (add/confirm dedicated exported container ID owner if needed)
- Modify: `src/modules/ui/playback-options/constants.ts` (add/confirm dedicated exported container ID owner if needed)
- Modify: `src/__tests__/fixtures/appShellContainerIds.ts`
- Modify: `src/core/app-shell/__tests__/AppContainerFactory.test.ts`
- Modify: `src/core/app-shell/AppBlockingErrorOverlayPresenter.ts`
- Modify: `src/modules/ui/audio-setup/AudioSetupScreen.ts`
- Modify: `src/modules/ui/splash/SplashScreen.ts`
- Modify: `src/core/app-shell/__tests__/AppBlockingErrorOverlayPresenter.test.ts` (only if needed for teardown parity checks)
- Modify: `src/modules/ui/audio-setup/__tests__/AudioSetupScreen.test.ts` (only if needed for teardown parity checks)
- Modify: `src/modules/ui/splash/__tests__/SplashScreen.test.ts` (only if needed for rebuild parity checks)
- Modify: `ARCHITECTURE_CLEANUP_CHECKLIST.md` (mark `P2-W4` done + issue/security disposition updates)

## Files Out Of Scope

- `src/Orchestrator.ts`
- `src/core/InitializationCoordinator.ts`
- `src/core/app-shell/AppDiagnosticsSurface.ts` (already extracted owner; no new diagnostics scope)
- `src/modules/ui/settings/**`
- `src/modules/ui/channel-setup/**`
- `src/modules/ui/epg/**`
- Any `P3-W#` implementation files

## Invariants / Preservation Contracts

- Preserve all existing app-shell startup container IDs and append order.
- Preserve module ownership for feature container IDs (`now-playing-info`, `playback-options`) instead of introducing a competing app-shell owner.
- Preserve all existing container class names and ARIA attributes.
- Preserve `App` as composition root (wiring + delegation only; no new feature policy).
- Preserve blocking overlay UX:
  - title/message/actions rendering
  - modal open/close behavior
  - focus registration/unregistration behavior
- Preserve Splash and Audio Setup screen behavior:
  - same visible content and status updates
  - same show/hide semantics
  - same destroy semantics (container clears cleanly)
- No fallback/compatibility branches.

## Verification Commands

- `npm run typecheck`
  - Expected: exit `0`.
- `npm test -- src/core/app-shell/__tests__/AppContainerFactory.test.ts`
  - Expected: PASS; idempotent creation, append order, and refs still stable.
- `npm test -- src/core/app-shell/__tests__/AppBlockingErrorOverlayPresenter.test.ts`
  - Expected: PASS; overlay rendering + modal/focus behavior unchanged.
- `npm test -- src/modules/ui/splash/__tests__/SplashScreen.test.ts`
  - Expected: PASS; splash build/show/hide/update behavior unchanged.
- `npm test -- src/modules/ui/audio-setup/__tests__/AudioSetupScreen.test.ts`
  - Expected: PASS; teardown/setup behavior unchanged.
- `npm test -- src/__tests__/App.test.ts`
  - Expected: PASS; startup container creation and app bootstrap still intact.
- `npm run verify`
  - Expected: PASS (required gate for App/UI/startup-boundary work).
- `desloppify scan --force-rescan --attest "P2-W4 shell cleanup evidence refresh"`
  - Expected: exit `0`.
- `desloppify show review::.::holistic::convention_outlier::container_id_convention_split::89da5d23`
  - Expected: `0 open issues matching ...` before marking `P2-W4` complete.
- `desloppify show security::src/core/app-shell/AppBlockingErrorOverlayPresenter.ts::security::innerHTML_assignment::src/core/app-shell/AppBlockingErrorOverlayPresenter.ts::49`
  - Expected: `0 open issues matching ...`.
- `desloppify show security::src/modules/ui/audio-setup/AudioSetupScreen.ts::security::innerHTML_assignment::src/modules/ui/audio-setup/AudioSetupScreen.ts::420`
  - Expected: `0 open issues matching ...`.
- `desloppify show security::src/modules/ui/splash/SplashScreen.ts::security::innerHTML_assignment::src/modules/ui/splash/SplashScreen.ts::19`
  - Expected: `0 open issues matching ...`.

## Rollback Notes

If parity breaks:

1. Revert container-ID ownership rewires (`App.ts`, `AppContainerFactory.ts`, `now-playing-info/constants.ts`, `playback-options/constants.ts`, fixture/test rewires).
2. Revert DOM-clear rewrites in overlay/splash/audio-setup to last-known-good behavior.
3. Revert checklist disposition updates made for `P2-W4`.

Do not introduce temporary compatibility aliases to patch over regressions; revert and re-plan.

## Commit Checkpoints

- Checkpoint 1: `cleanup(p2-w4): align app shell to module-owned feature container ids`
  - includes `App`/`AppContainerFactory` rewiring to consume module owners + fixture/test updates
- Checkpoint 2: `cleanup(p2-w4): remove shell/startup innerHTML cleanup seams`
  - includes the three targeted DOM-clear rewrites + focused behavior tests
- Checkpoint 3: `cleanup(p2-w4): close checklist work unit and refresh evidence`
  - includes `ARCHITECTURE_CLEANUP_CHECKLIST.md` updates and final `desloppify`/verify evidence

## Priority-Exit Readiness

`P2-W4` is the final planned `P2-W#` item. This plan must leave `P2-EXIT` ready to execute immediately after `P2-W3` and `P2-W4` are both complete.

Mapped imported issue for Priority 2:

- `review::.::holistic::convention_outlier::container_id_convention_split::89da5d23`
  - target disposition: `resolved` in `P2-W4` by rewiring `App` and `AppContainerFactory` to module-owned feature container constants.
  - fallback disposition rule (only if still open after required verification): `split follow-up` with single final owner `P4-W5`, reason, and revisit trigger recorded directly in `P2-EXIT`.

Mapped security issues expected to be retired by this plan:

- `security::src/core/app-shell/AppBlockingErrorOverlayPresenter.ts::security::innerHTML_assignment::src/core/app-shell/AppBlockingErrorOverlayPresenter.ts::49`
- `security::src/modules/ui/audio-setup/AudioSetupScreen.ts::security::innerHTML_assignment::src/modules/ui/audio-setup/AudioSetupScreen.ts::420`
- `security::src/modules/ui/splash/SplashScreen.ts::security::innerHTML_assignment::src/modules/ui/splash/SplashScreen.ts::19`

Required `P2-EXIT` blocking checklist record (must exist before any `P3` plan/work starts):

- `mapped imported issues`:
  - `review::.::holistic::convention_outlier::container_id_convention_split::89da5d23` with exact disposition (`resolved` or `split follow-up`).
- `follow-up ownership`:
  - only required when disposition is `deferred` or `split follow-up`;
  - must name one exact final owner (no shared ownership).
- `security triage`:
  - explicit statement `no open P0 security findings`, or exact deferred/resolved `P0` issue IDs with reason and revisit trigger.
- `verification`:
  - exact commands and outcomes listed below.

`P2-EXIT` gate commands (rerun on current code before any `P3`):

- `desloppify status`
- `desloppify show review --status open`
- `desloppify show security --status open --no-budget --top 50`
- `desloppify show review::.::holistic::convention_outlier::container_id_convention_split::89da5d23`
- `npm run verify`

Hard gate:

- If `P2-W3` or `P2-W4` remains open, or if `P2-EXIT` record is missing any block above, do not start or plan `P3`.

## Planner Self-Check

1. Unresolved seam hidden? -> **No.** Container-ID ownership and shell/startup clear-path seam are explicitly selected.
2. Adjacent contract changes needed but out of scope? -> **No.** Existing config interfaces remain unchanged; only constant ownership and DOM clearing mechanics change.
3. Out-of-scope files implicitly required? -> **No.** All required ownership files are listed in scope.
4. Full Codanna + fallback evidence recorded? -> **Yes.**
5. Growing a hotspot? -> **No.** `App` loses string-literal ownership drift; no new feature logic is added.
6. Fresh session would need to invent decisions? -> **No.** exact issue IDs, files, and verification gates are explicit.
7. Decision-grade plan? -> **Yes.** execution-safe pending freshness check.

## Execution Plan (Bite-Sized Steps)

### Task 1: Lock baseline and failing checks for container-ID drift

**Files:**
- Modify: `src/App.ts`
- Modify: `src/core/app-shell/AppContainerFactory.ts`
- Modify: `src/modules/ui/now-playing-info/constants.ts`
- Modify: `src/modules/ui/playback-options/constants.ts`
- Modify: `src/__tests__/fixtures/appShellContainerIds.ts`
- Modify: `src/core/app-shell/__tests__/AppContainerFactory.test.ts`

**Step 1: Write failing fixture/test expectations**

Update app-shell fixture/tests first so `now-playing-info` and `playback-options` container IDs are expected from module-owned constants and fail until wiring is rewired.

**Step 2: Add/confirm module-owned exported container ID constants**

Ensure these two owner modules expose explicit container-ID exports for app-shell wiring use:

- `src/modules/ui/now-playing-info/constants.ts`
- `src/modules/ui/playback-options/constants.ts`

**Step 3: Rewire `App` and `AppContainerFactory`**

Replace duplicated `now-playing-info-container` / `playback-options-container` literals with module-owned constants (while keeping existing external module constants such as channel badge and exit confirm).

**Step 4: Run focused test**

Run: `npm test -- src/core/app-shell/__tests__/AppContainerFactory.test.ts`  
Expected: PASS.

### Task 2: Resolve shell/startup `innerHTML` issues with behavior parity

**Files:**
- Modify: `src/core/app-shell/AppBlockingErrorOverlayPresenter.ts`
- Modify: `src/modules/ui/audio-setup/AudioSetupScreen.ts`
- Modify: `src/modules/ui/splash/SplashScreen.ts`
- Modify (if needed): `src/core/app-shell/__tests__/AppBlockingErrorOverlayPresenter.test.ts`
- Modify (if needed): `src/modules/ui/audio-setup/__tests__/AudioSetupScreen.test.ts`
- Modify (if needed): `src/modules/ui/splash/__tests__/SplashScreen.test.ts`

**Step 1: Add/adjust failing tests where parity assertions are missing**

If existing tests do not protect clear-path behavior, add focused assertions before implementation.

**Step 2: Replace direct `.innerHTML = ''` with DOM-safe clearing**

Use `replaceChildren()` for clear paths while keeping render/output behavior unchanged.

**Step 3: Run focused tests**

Run:

- `npm test -- src/core/app-shell/__tests__/AppBlockingErrorOverlayPresenter.test.ts`
- `npm test -- src/modules/ui/splash/__tests__/SplashScreen.test.ts`
- `npm test -- src/modules/ui/audio-setup/__tests__/AudioSetupScreen.test.ts`

Expected: PASS.

### Task 3: Run integration verification for app-shell startup parity

**Files:**
- Modify only if needed from failures: `src/__tests__/App.test.ts`

**Step 1:** Run app bootstrap suite:

`npm test -- src/__tests__/App.test.ts`

Expected: PASS.

**Step 2:** Run broad validation:

- `npm run typecheck`
- `npm run verify`

Expected: both PASS.

### Task 4: Refresh evidence and close `P2-W4` checklist item

**Files:**
- Modify: `ARCHITECTURE_CLEANUP_CHECKLIST.md`

**Step 1:** Refresh `desloppify` evidence commands:

- `desloppify scan --force-rescan --attest "P2-W4 shell cleanup evidence refresh"`
- `desloppify show review::.::holistic::convention_outlier::container_id_convention_split::89da5d23`
- three targeted `desloppify show security::<id>` commands listed above

**Step 2:** Update checklist line and dispositions:

- mark `P2-W4` complete with plan path/date
- record exact disposition for `review::.::holistic::convention_outlier::container_id_convention_split::89da5d23`:
  - `resolved`, or
  - `split follow-up` with one exact final owner (`P4-W5`), reason, and revisit trigger
- record exact security dispositions for the three `P2-W4` shell/startup `innerHTML` issue IDs
- record explicit `security triage` statement for `P2-EXIT` (`no open P0 security findings` or exact deferred IDs with triggers)

**Step 3:** If `P2-W3` and `P2-W4` are both closed, execute `P2-EXIT` evidence gate and write the full blocking `P2-EXIT` record before any `P3` planning/work.

**Step 4:** If `P2-EXIT` record is incomplete, leave `P2-EXIT` open and do not start or plan any `P3` item.
