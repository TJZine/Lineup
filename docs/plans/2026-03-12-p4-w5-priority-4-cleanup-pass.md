# P4-W5 Priority 4 Cleanup Pass Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete `P4-W5` by removing Priority-4 transitional UI/coordinator residue (timing bridges, container-id drift, duplicated EPG status literals, and force-cast config seams) while retiring the eight inherited security findings.

**Architecture:** Keep ownership with existing module boundaries and collaborators; this is a cleanup pass, not a redesign pass. Remove transitional glue and unsafe DOM/log/random patterns in-place, tighten shared type ownership for module status/config seams, and keep EPG/UI runtime behavior unchanged.

**Tech Stack:** TypeScript, Jest (`jsdom`), DOM APIs (`replaceChildren`, `textContent`, node assembly via `createElement`), existing Lineup UI/coordinator architecture, `desloppify`, `npm` verification gates.

---

I'm using the writing-plans skill to create the implementation plan.

## Goal

- Finish checklist item:
  - `P4-W5 remove transitional coordinator glue, timing bridges, duplicated EPG status literals, and force-cast config residue created by the round-2 decomposition`
- Retire inherited follow-ups owned by `P4-W5`:
  - `review::.::holistic::convention_outlier::container_id_convention_split::89da5d23`
  - `review::.::holistic::mid_level_elegance::epg_coordinator_seam_overload::4def954d`
  - `review::.::holistic::high_level_elegance::epg_top_level_owner_blur::d400d216`
  - `review::.::holistic::cross_module_architecture::epg_subsystem_coupling_hotspot::b900285d`
  - `security::src/modules/ui/channel-transition/ChannelTransitionOverlay.ts::security::innerHTML_assignment::src/modules/ui/channel-transition/ChannelTransitionOverlay.ts::32`
  - `security::src/modules/ui/channel-transition/ChannelTransitionOverlay.ts::security::innerHTML_assignment::src/modules/ui/channel-transition/ChannelTransitionOverlay.ts::40`
  - `security::src/modules/ui/epg/EPGComponent.ts::security::innerHTML_assignment::src/modules/ui/epg/EPGComponent.ts::244`
  - `security::src/modules/ui/epg/EPGInfoPanel.ts::security::innerHTML_assignment::src/modules/ui/epg/EPGInfoPanel.ts::101`
  - `security::src/modules/ui/epg/EPGTimeHeader.ts::security::innerHTML_assignment::src/modules/ui/epg/EPGTimeHeader.ts::91`
  - `security::src/modules/ui/epg/EPGVirtualizer.ts::security::insecure_random::src/modules/ui/epg/EPGVirtualizer.ts::652`
  - `security::src/modules/ui/now-playing-info/NowPlayingInfoOverlay.ts::security::innerHTML_assignment::src/modules/ui/now-playing-info/NowPlayingInfoOverlay.ts::136`
  - `security::src/modules/ui/playback-options/PlaybackOptionsCoordinator.ts::security::log_sensitive::src/modules/ui/playback-options/PlaybackOptionsCoordinator.ts::503`

## Non-Goals

- No new feature work, UX redesign, or behavior changes for EPG/overlays.
- No fresh architecture extraction beyond cleanup seams required by `P4-W5`.
- No `P4-EXIT` completion in this slice.
- No `P5+` planning or implementation before `P4-EXIT` is complete.
- No compatibility/fallback dual-path logic.

## Parent-Priority Alignment (Priority 4)

Priority 4 is closing UI/coordinator round-2 decomposition. `P4-W1` through `P4-W4` are complete; `P4-W5` is the final `P4-W#` cleanup unit before `P4-EXIT`. This plan removes residual seams left after earlier splits so Priority 4 can exit with auditable ownership, no inherited security residue, and explicit dispositions for every mapped imported issue.

## Required Reading

1. [`agents.md`](../../agents.md)
2. [`docs/agentic/document-map.md`](../agentic/document-map.md)
3. [`docs/AGENTIC_DEV_WORKFLOW.md`](../AGENTIC_DEV_WORKFLOW.md)
4. [`docs/agentic/codanna-playbook.md`](../agentic/codanna-playbook.md)
5. [`docs/agentic/plan-authoring-standard.md`](../agentic/plan-authoring-standard.md)
6. [`docs/agentic/historical-plan-corpus-review.md`](../agentic/historical-plan-corpus-review.md)
7. [`docs/architecture/CURRENT_STATE.md`](../architecture/CURRENT_STATE.md)
8. [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](../../ARCHITECTURE_CLEANUP_CHECKLIST.md)
9. [`src/modules/ui/epg/EPGCoordinator.ts`](../../src/modules/ui/epg/EPGCoordinator.ts)
10. [`src/Orchestrator.ts`](../../src/Orchestrator.ts)
11. [`src/core/InitializationCoordinator.ts`](../../src/core/InitializationCoordinator.ts)
12. [`src/modules/ui/epg/EPGComponent.ts`](../../src/modules/ui/epg/EPGComponent.ts)
13. [`src/modules/ui/epg/constants.ts`](../../src/modules/ui/epg/constants.ts)
14. [`src/modules/ui/epg/EPGInfoPanel.ts`](../../src/modules/ui/epg/EPGInfoPanel.ts)
15. [`src/modules/ui/epg/EPGTimeHeader.ts`](../../src/modules/ui/epg/EPGTimeHeader.ts)
16. [`src/modules/ui/epg/EPGVirtualizer.ts`](../../src/modules/ui/epg/EPGVirtualizer.ts)
17. [`src/modules/ui/channel-transition/ChannelTransitionOverlay.ts`](../../src/modules/ui/channel-transition/ChannelTransitionOverlay.ts)
18. [`src/modules/ui/now-playing-info/NowPlayingInfoOverlay.ts`](../../src/modules/ui/now-playing-info/NowPlayingInfoOverlay.ts)
19. [`src/modules/ui/playback-options/PlaybackOptionsCoordinator.ts`](../../src/modules/ui/playback-options/PlaybackOptionsCoordinator.ts)
20. [`src/App.ts`](../../src/App.ts)
21. [`src/core/app-shell/AppContainerFactory.ts`](../../src/core/app-shell/AppContainerFactory.ts)
22. [`src/modules/ui/now-playing-info/constants.ts`](../../src/modules/ui/now-playing-info/constants.ts)
23. [`src/modules/ui/playback-options/constants.ts`](../../src/modules/ui/playback-options/constants.ts)
24. [`src/modules/ui/channel-transition/constants.ts`](../../src/modules/ui/channel-transition/constants.ts)
25. [`src/modules/ui/player-osd/constants.ts`](../../src/modules/ui/player-osd/constants.ts)
26. [`src/modules/ui/channel-number-overlay/constants.ts`](../../src/modules/ui/channel-number-overlay/constants.ts)
27. [`src/modules/ui/mini-guide/constants.ts`](../../src/modules/ui/mini-guide/constants.ts)
28. [`src/__tests__/fixtures/appShellContainerIds.ts`](../../src/__tests__/fixtures/appShellContainerIds.ts)

## Freshness Gate

If these changed materially after `2026-03-12`, update this plan before implementation:

- `ARCHITECTURE_CLEANUP_CHECKLIST.md`
- `src/modules/ui/epg/EPGCoordinator.ts`
- `src/Orchestrator.ts`
- `src/modules/ui/epg/EPGComponent.ts`
- `src/core/app-shell/AppContainerFactory.ts`
- `src/App.ts`

Stop and re-plan if:

- another branch already completed `P4-W5`,
- inherited `P4-W5` issue ownership changed in checklist,
- or cleanup requires widening into new collaborators not listed in scope.

## Required Skills

1. `using-superpowers`
2. `brainstorming`
3. `architecture-boundaries`
4. `ui-composition-patterns`
5. `writing-plans`
6. `executing-plans`
7. `verification-before-completion`
8. `systematic-debugging` (only if verification fails unexpectedly)

## Docs Check (Context7 -> fallback noted)

Checked via Context7 on `2026-03-12` (`/mdn/content`):

- `Element.replaceChildren()` empties a node when called with no arguments.
- `Math.random()` is not cryptographically secure; `crypto.getRandomValues()` is the secure alternative for security-sensitive contexts.

References:

- <https://github.com/mdn/content/blob/main/files/en-us/web/api/element/replacechildren/index.md>
- <https://github.com/mdn/content/blob/main/files/en-us/web/javascript/reference/global_objects/math/random/index.md>
- <https://github.com/mdn/content/blob/main/files/en-us/web/api/crypto/getrandomvalues/index.md>

No additional external docs were needed; ownership and issue mapping are repo-internal.

## Codanna Discovery

### `get_index_info`

- Snapshot: `9113 symbols / 443 files`, semantic enabled (`MultilingualE5Large`), updated within this session.

### `semantic_search_with_context`

- Queries:
  - `P4-W5 transitional coordinator glue timing bridges duplicated EPG status literals force-cast config residue EPGComponent EPGCoordinator`
  - `EPGCoordinator EPGComponent duplicated status literal union config cast cleanup`
  - `ChannelTransitionOverlay innerHTML cleanup P4-W5`
- Result: consistently noisy/unrelated top hits (player/runtime symbols), insufficient for direct planning.

### `search_documents`

- Queries:
  - `P4-W5 remove transitional coordinator glue timing bridges duplicated EPG status literals force-cast config residue`
  - `P4-W5 epg_coordinator_seam_overload 4def954d`
  - `ARCHITECTURE_CLEANUP_CHECKLIST P4-W5 inherited follow-ups`
- Result: noisy ranking (older archives/local imports outranking checklist), insufficient as primary evidence.

### Symbol-anchored Codanna evidence

- `find_symbol`:
  - `EPGCoordinator` `symbol_id:3987`
  - `EPGComponent` `symbol_id:4533`
  - `refreshEpgSchedules` `symbol_id:4042`
  - `refreshEpgSchedulesForRange` `symbol_id:4070`
  - `EpgUiStatus` `symbol_id:3969`
  - `createOrchestratorCoordinators` `symbol_id:6851`
  - `createAppContainers` `symbol_id:7010`
  - `renderSlots` `symbol_id:3129`
  - `recycleElement` `symbol_id:3440`
  - `handleAudioSelect` (playback options) `symbol_id:3102`
  - `createTemplate` in ChannelTransitionOverlay `symbol_id:5511`
  - `createTemplate` in EPGInfoPanel `symbol_id:3218`
- `analyze_impact` highlights:
  - `refreshEpgSchedulesForRange` (`4070`) impacts orchestrator startup/server swap/guide settings/channel-setup refresh call paths (11 symbols).
  - `refreshEpgSchedules` (`4042`) impacts lazy screen loading, channel setup, and orchestrator rollover/setting-change paths (13 symbols).
  - `createOrchestratorCoordinators` (`6851`) and `createAppContainers` (`7010`) each have narrow composition-root blast radius (2 symbols each).
  - `renderSlots` (`3129`), `recycleElement` (`3440`), `createTemplate` (`5511`, `3218`), and `handleAudioSelect` (`3102`) have contained local impact.

### Explicit fallback note (`rg` + direct reads + live `desloppify`)

Because Codanna semantic/doc retrieval was insufficient for this topic, deterministic fallback was used:

- `rg` + direct reads confirmed exact residue lines:
  - `EPGComponent` force casts (`DEFAULT_EPG_CONFIG as unknown as EPGConfig`, merge `as EPGConfig`)
  - duplicated status union in `EPGCoordinator` vs `Orchestrator` module status ownership
  - cast seam in `Orchestrator` (`as EpgUiStatus`)
  - inherited security lines in ChannelTransitionOverlay/EPGComponent/EPGInfoPanel/EPGTimeHeader/EPGVirtualizer/NowPlayingInfoOverlay/PlaybackOptionsCoordinator
- live `desloppify` baseline captured in this session:
  - `desloppify status` -> strict `75.2`, queue includes 8 open security issues
  - `desloppify show review::<id>` confirmed each mapped review issue still open (`4def954d`, `d400d216`, `b900285d`, `89da5d23`)
  - `desloppify show security --status open --no-budget --top 200` confirmed the exact eight inherited `P4-W5` security issues are open

## Impact Snapshot

Primary risk surfaces:

- EPG schedule-refresh entrypoints (`EPGCoordinator.refreshEpgSchedules*`) shared across orchestrator/channel-setup/lazy-screen paths.
- EPG configuration/type seams (`DEFAULT_EPG_CONFIG`, `EpgUiStatus`, module-status cast path).
- App-shell container-id wiring (`App`, `AppContainerFactory`, module container constants).
- Inherited security hot lines in UI overlays and EPG rendering helpers.

Expected blast radius if scoped correctly:

- Localized overlay/EPG DOM cleanup changes remain module-local.
- Type/status cleanup should remain compile-time wiring only.
- Container-id convention cleanup affects startup wiring/tests but not runtime behavior.

## Architecture Seam Decision Gate

Locked decisions:

1. `P4-W5` remains a cleanup pass: no new long-lived coordinator owners.
2. Remove unsafe DOM/log/random patterns in-place while preserving behavior.
3. Eliminate duplicated EPG status literal ownership by sharing one status-value type source.
4. Remove EPG force-cast config residue by making defaults/merge paths type-safe without assertions.
5. Normalize container-id ownership so `App`/`AppContainerFactory` consume module/container constants rather than mixing repeated literals.
6. Preserve existing public APIs and orchestration entrypoints (`refreshEpgSchedules`, `refreshEpgSchedulesForRange`) unless tests prove a glue-only path can be collapsed safely.
7. No fallback/compatibility shims.

## Files In Scope

- Modify:
  - `src/modules/ui/channel-transition/ChannelTransitionOverlay.ts`
  - `src/modules/ui/epg/EPGComponent.ts`
  - `src/modules/ui/epg/EPGInfoPanel.ts`
  - `src/modules/ui/epg/EPGTimeHeader.ts`
  - `src/modules/ui/epg/EPGVirtualizer.ts`
  - `src/modules/ui/now-playing-info/NowPlayingInfoOverlay.ts`
  - `src/modules/ui/playback-options/PlaybackOptionsCoordinator.ts`
  - `src/modules/ui/epg/EPGCoordinator.ts`
  - `src/Orchestrator.ts`
  - `src/modules/ui/epg/constants.ts`
  - `src/modules/ui/channel-transition/constants.ts`
  - `src/modules/ui/player-osd/constants.ts`
  - `src/modules/ui/channel-number-overlay/constants.ts`
  - `src/modules/ui/mini-guide/constants.ts`
  - `src/modules/ui/channel-transition/index.ts`
  - `src/modules/ui/player-osd/index.ts`
  - `src/modules/ui/channel-number-overlay/index.ts`
  - `src/modules/ui/mini-guide/index.ts`
  - `src/modules/ui/epg/index.ts`
  - `src/App.ts`
  - `src/core/app-shell/AppContainerFactory.ts`
  - `src/__tests__/fixtures/appShellContainerIds.ts`
  - `src/core/app-shell/__tests__/AppContainerFactory.test.ts` (if fixture/ownership assertions need updates)
  - `src/modules/ui/channel-transition/__tests__/ChannelTransitionOverlay.test.ts`
  - `src/modules/ui/epg/__tests__/EPGComponent.test.ts`
  - `src/modules/ui/epg/__tests__/EPGInfoPanel.test.ts`
  - `src/modules/ui/epg/__tests__/EPGTimeHeader.test.ts`
  - `src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts`
  - `src/modules/ui/epg/__tests__/EPGCoordinator.test.ts` (only if timing-bridge cleanup changes refresh-call expectations)
  - `src/modules/ui/now-playing-info/__tests__/NowPlayingInfoOverlay.test.ts`
  - `src/modules/ui/playback-options/__tests__/PlaybackOptionsCoordinator.test.ts`
  - `ARCHITECTURE_CLEANUP_CHECKLIST.md`

## Files Out Of Scope

- `src/Orchestrator.ts` behavior changes beyond compile-only typing consumption.
- `src/core/channel-setup/**` implementation changes.
- `src/modules/navigation/**` (already handled in `P4-W3`).
- `src/modules/ui/settings/**` and `src/modules/ui/channel-setup/**` (already handled in `P4-W4`).
- Any `P5+` files and plans.

## Invariants / Preservation Contracts

- Preserve Channel Setup review/build flow and Step 2 focus behavior.
- Preserve EPG visible-range update semantics and schedule loading behavior.
- Preserve EPG info-panel host behavior and rendering order.
- Preserve overlay class names, visibility toggling, and focusable IDs.
- Preserve startup container append order and IDs.
- Keep current user-visible copy/text and modal IDs unchanged.

## Implementation Tasks

### Task 1: Retire inherited overlay security findings (Channel Transition + Now Playing)

**Files:**

- Modify: `src/modules/ui/channel-transition/ChannelTransitionOverlay.ts`
- Modify: `src/modules/ui/now-playing-info/NowPlayingInfoOverlay.ts`
- Test: `src/modules/ui/channel-transition/__tests__/ChannelTransitionOverlay.test.ts`
- Test: `src/modules/ui/now-playing-info/__tests__/NowPlayingInfoOverlay.test.ts`

**Step 1: Decide verification class**

- `New or updated automated test required`

**Step 2: Replace `innerHTML` template usage in `ChannelTransitionOverlay`**

- Swap string-template assignment for DOM node assembly and `replaceChildren`:

```ts
this.containerElement.replaceChildren(this.createTemplateElement());
```

**Step 3: Replace `innerHTML = ''` teardown paths with safe clears**

```ts
this.containerElement.replaceChildren();
```

**Step 4: Keep class/visibility behavior unchanged**

- Preserve class additions/removals, cached element lookups, and `show()/hide()` semantics.

**Step 5: Update tests for structure and teardown parity**

- Assert expected panel/spinner/title/subtitle nodes still exist after `initialize`.
- Assert `destroy()` clears children and visibility classes.

**Step 6: Run focused verification**

- `npm test -- src/modules/ui/channel-transition/__tests__/ChannelTransitionOverlay.test.ts`
- `npm test -- src/modules/ui/now-playing-info/__tests__/NowPlayingInfoOverlay.test.ts`

**Step 7: Commit**

- `cleanup(p4-w5): replace overlay innerhtml cleanup paths`

### Task 2: Retire inherited Playback Options log-safety finding

**Files:**

- Modify: `src/modules/ui/playback-options/PlaybackOptionsCoordinator.ts`
- Test: `src/modules/ui/playback-options/__tests__/PlaybackOptionsCoordinator.test.ts`

**Step 1: Decide verification class**

- `New or updated automated test required`

**Step 2: Replace ad-hoc audio-switch error stringification with the repo-standard safe summary path**

- Keep the existing `console.error('[PlaybackOptions] Audio track switch failed:', ...)` site, but stop constructing ad-hoc string payloads from unknown errors.
- Route the caught error through the existing sanitized summary helper used in runtime/core surfaces (`summarizeErrorForLog`) so token-bearing messages stay redacted without growing a new logging helper.

**Step 3: Preserve playback-options behavior**

- Keep `handleAudioSelect()` close-modal timing, `refreshIfOpen()` behavior, and focus return semantics unchanged.
- Do not add retry/fallback branches or new toast behavior in this cleanup slice.

**Step 4: Update tests for failure-path parity**

- Assert the audio-track failure path logs only the sanitized summary shape, not the raw thrown string/object.
- Assert the modal still closes and refresh still runs after the failed audio-track switch.

**Step 5: Run focused verification**

- `npm test -- src/modules/ui/playback-options/__tests__/PlaybackOptionsCoordinator.test.ts`

**Step 6: Commit**

- `cleanup(p4-w5): redact playback option audio-switch logs`

### Task 3: Retire inherited EPG security findings (`innerHTML`, insecure random)

**Files:**

- Modify: `src/modules/ui/epg/EPGComponent.ts`
- Modify: `src/modules/ui/epg/EPGInfoPanel.ts`
- Modify: `src/modules/ui/epg/EPGTimeHeader.ts`
- Modify: `src/modules/ui/epg/EPGVirtualizer.ts`
- Test: `src/modules/ui/epg/__tests__/EPGComponent.test.ts`
- Test: `src/modules/ui/epg/__tests__/EPGInfoPanel.test.ts`
- Test: `src/modules/ui/epg/__tests__/EPGTimeHeader.test.ts`
- Test: `src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts`

**Step 1: Decide verification class**

- `New or updated automated test required`

**Step 2: Replace clear-path `innerHTML` assignments with `replaceChildren()`**

- `EPGComponent.destroy()` and `EPGTimeHeader.renderSlots()` should clear via `replaceChildren()`.

**Step 3: Replace `EPGInfoPanel` template string injection with element assembly**

- Introduce `createTemplateElement()` returning a DOM subtree and append it directly.

**Step 4: Remove `Math.random()` pool-key generation in `EPGVirtualizer`**

- Replace with deterministic monotonic key suffix:

```ts
private _poolSequence = 0;
const poolKey = `pool-${Date.now()}-${this._poolSequence++}`;
```

**Step 5: Preserve existing render/update behavior**

- No class-name/copy/layout changes.
- Keep existing timing and cleanup semantics.

**Step 6: Run focused verification**

- `npm test -- src/modules/ui/epg/__tests__/EPGComponent.test.ts`
- `npm test -- src/modules/ui/epg/__tests__/EPGInfoPanel.test.ts`
- `npm test -- src/modules/ui/epg/__tests__/EPGTimeHeader.test.ts`
- `npm test -- src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts`

**Step 7: Commit**

- `cleanup(p4-w5): remove epg innerhtml and insecure random residue`

### Task 4: Remove EPG timing-bridge/type residue (status literals + force casts)

**Files:**

- Modify: `src/modules/ui/epg/EPGCoordinator.ts`
- Modify: `src/Orchestrator.ts`
- Modify: `src/modules/ui/epg/constants.ts`
- Modify: `src/modules/ui/epg/index.ts`
- Test: `src/modules/ui/epg/__tests__/EPGCoordinator.test.ts`
- Test: `src/core/app-shell/__tests__/AppLazyScreenRegistry.test.ts` (required if `refreshEpgSchedules*` control flow changes)
- Test: `src/core/app-shell/__tests__/AppScreenVisibilityCoordinator.test.ts` (required if `refreshEpgSchedules*` control flow changes)
- Test: `src/core/channel-setup/__tests__/ChannelSetupCoordinator.test.ts` (required if `refreshEpgSchedules*` control flow changes)
- Test: `src/__tests__/Orchestrator.test.ts` (required if `refreshEpgSchedules*` control flow changes)
- Test: `src/__tests__/Orchestrator.test.ts` (only if type-driven runtime behavior changes are observable)

**Step 1: Decide verification class**

- `Existing coverage should be adjusted`

**Step 2: Remove duplicated EPG status literal ownership**

- Use one shared status-value type source so `EpgUiStatus` and `ModuleStatus.status` no longer drift.

**Step 3: Remove cast seam in coordinator factory**

- Replace:

```ts
getEpgUiStatus: (): EpgUiStatus => deps.moduleStatus.get('epg-ui')?.status as EpgUiStatus,
```

- With a cast-free typed path.

**Step 4: Remove EPG config force casts**

- Make `DEFAULT_EPG_CONFIG` and merge assignment type-safe without `as EPGConfig` assertions.

**Step 5: Collapse glue-only timing bridge if behavior is unchanged**

- Keep `refreshEpgSchedules`/`refreshEpgSchedulesForRange` public API stable.
- Remove only redundant wrapper branching if the methods remain pure public shims over the same visible-range/refresh behavior.
- If wrapper or debounce control flow changes at all, preserve the caller contracts exercised by app-shell visibility, lazy-screen loading, channel-setup, and orchestrator guide-setting refresh paths before taking the cleanup.

**Step 6: Run focused verification**

- `npm test -- src/modules/ui/epg/__tests__/EPGCoordinator.test.ts`
- `npm run typecheck`

**Step 7: Run shared-caller verification when Task 4 changes `refreshEpgSchedules*` control flow**

- `npm test -- src/core/app-shell/__tests__/AppLazyScreenRegistry.test.ts`
- `npm test -- src/core/app-shell/__tests__/AppScreenVisibilityCoordinator.test.ts`
- `npm test -- src/core/channel-setup/__tests__/ChannelSetupCoordinator.test.ts`
- `npm test -- src/__tests__/Orchestrator.test.ts`

**Step 8: Commit**

- `cleanup(p4-w5): remove epg status and config cast residue`

### Task 5: Resolve container-id convention drift in app-shell/UI wiring

**Files:**

- Modify: `src/App.ts`
- Modify: `src/core/app-shell/AppContainerFactory.ts`
- Modify: `src/modules/ui/epg/constants.ts`
- Modify: `src/modules/ui/channel-transition/constants.ts`
- Modify: `src/modules/ui/player-osd/constants.ts`
- Modify: `src/modules/ui/channel-number-overlay/constants.ts`
- Modify: `src/modules/ui/mini-guide/constants.ts`
- Modify: `src/modules/ui/epg/index.ts`
- Modify: `src/modules/ui/channel-transition/index.ts`
- Modify: `src/modules/ui/player-osd/index.ts`
- Modify: `src/modules/ui/channel-number-overlay/index.ts`
- Modify: `src/modules/ui/mini-guide/index.ts`
- Modify: `src/__tests__/fixtures/appShellContainerIds.ts`
- Test: `src/core/app-shell/__tests__/AppContainerFactory.test.ts`
- Test: `src/__tests__/App.test.ts` (if startup config/container ownership assertions need updates)

**Step 1: Decide verification class**

- `New or updated automated test required`

**Step 2: Add explicit container-id constants for modules still using wiring literals**

- Example shape:

```ts
export const EPG_CONTAINER_ID = 'epg-container' as const;
```

**Step 3: Rewire `App` + `AppContainerFactory` + fixture to consume those constants**

- Eliminate repeated string literals for module-owned container IDs.

**Step 4: Keep IDs and append order unchanged**

- Do not rename IDs or reorder container creation.

**Step 5: Run focused verification**

- `npm test -- src/core/app-shell/__tests__/AppContainerFactory.test.ts`
- `npm test -- src/__tests__/App.test.ts`

**Step 6: Commit**

- `cleanup(p4-w5): normalize app-shell container id ownership`

### Task 6: Verification and checklist closeout for `P4-W5`

**Files:**

- Modify: `ARCHITECTURE_CLEANUP_CHECKLIST.md`

**Step 1: Decide verification class**

- `Broader verification is required`

**Step 2: Run required inherited-issue evidence commands**

- `desloppify status`
- `desloppify show review --status open`
- `desloppify show review::.::holistic::mid_level_elegance::epg_coordinator_seam_overload::4def954d --no-budget`
- `desloppify show review::.::holistic::high_level_elegance::epg_top_level_owner_blur::d400d216 --no-budget`
- `desloppify show review::.::holistic::cross_module_architecture::epg_subsystem_coupling_hotspot::b900285d --no-budget`
- `desloppify show review::.::holistic::convention_outlier::container_id_convention_split::89da5d23 --no-budget`
- `desloppify show security --status open --no-budget --top 200`
- `desloppify show security::src/modules/ui/channel-transition/ChannelTransitionOverlay.ts::security::innerHTML_assignment::src/modules/ui/channel-transition/ChannelTransitionOverlay.ts::32`
- `desloppify show security::src/modules/ui/channel-transition/ChannelTransitionOverlay.ts::security::innerHTML_assignment::src/modules/ui/channel-transition/ChannelTransitionOverlay.ts::40`
- `desloppify show security::src/modules/ui/epg/EPGComponent.ts::security::innerHTML_assignment::src/modules/ui/epg/EPGComponent.ts::244`
- `desloppify show security::src/modules/ui/epg/EPGInfoPanel.ts::security::innerHTML_assignment::src/modules/ui/epg/EPGInfoPanel.ts::101`
- `desloppify show security::src/modules/ui/epg/EPGTimeHeader.ts::security::innerHTML_assignment::src/modules/ui/epg/EPGTimeHeader.ts::91`
- `desloppify show security::src/modules/ui/epg/EPGVirtualizer.ts::security::insecure_random::src/modules/ui/epg/EPGVirtualizer.ts::652`
- `desloppify show security::src/modules/ui/now-playing-info/NowPlayingInfoOverlay.ts::security::innerHTML_assignment::src/modules/ui/now-playing-info/NowPlayingInfoOverlay.ts::136`
- `desloppify show security::src/modules/ui/playback-options/PlaybackOptionsCoordinator.ts::security::log_sensitive::src/modules/ui/playback-options/PlaybackOptionsCoordinator.ts::503`

**Step 3: Run repo verification gates**

- `npm run verify:docs`
- `npm run verify`

**Step 4: Update checklist in same pass**

- Mark `P4-W5` complete.
- Record exact issue dispositions (`resolved`/`deferred`/`split follow-up`) with reason and revisit trigger.
- Keep `P4-EXIT` open and explicitly required before any `P5` work.

**Step 5: Commit**

- `cleanup(p4-w5): close priority-4 cleanup pass with evidence`

## Verification Commands

- `npm run typecheck`
  - Expected: exit `0`.
- `npm test -- src/modules/ui/channel-transition/__tests__/ChannelTransitionOverlay.test.ts`
  - Expected: PASS.
- `npm test -- src/modules/ui/now-playing-info/__tests__/NowPlayingInfoOverlay.test.ts`
  - Expected: PASS.
- `npm test -- src/modules/ui/playback-options/__tests__/PlaybackOptionsCoordinator.test.ts`
  - Expected: PASS.
- `npm test -- src/modules/ui/epg/__tests__/EPGComponent.test.ts`
  - Expected: PASS.
- `npm test -- src/modules/ui/epg/__tests__/EPGInfoPanel.test.ts`
  - Expected: PASS.
- `npm test -- src/modules/ui/epg/__tests__/EPGTimeHeader.test.ts`
  - Expected: PASS.
- `npm test -- src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts`
  - Expected: PASS.
- `npm test -- src/modules/ui/epg/__tests__/EPGCoordinator.test.ts`
  - Expected: PASS.
- `npm test -- src/core/app-shell/__tests__/AppLazyScreenRegistry.test.ts`
  - Expected: PASS when Task 4 changes `refreshEpgSchedules*` control flow.
- `npm test -- src/core/app-shell/__tests__/AppScreenVisibilityCoordinator.test.ts`
  - Expected: PASS when Task 4 changes `refreshEpgSchedules*` control flow.
- `npm test -- src/core/channel-setup/__tests__/ChannelSetupCoordinator.test.ts`
  - Expected: PASS when Task 4 changes `refreshEpgSchedules*` control flow.
- `npm test -- src/__tests__/Orchestrator.test.ts`
  - Expected: PASS when Task 4 changes `refreshEpgSchedules*` control flow.
- `npm test -- src/core/app-shell/__tests__/AppContainerFactory.test.ts`
  - Expected: PASS.
- `npm test -- src/__tests__/App.test.ts`
  - Expected: PASS.
- `npm run verify:docs`
  - Expected: PASS.
- `npm run verify`
  - Expected: PASS.
- `desloppify scan --force-rescan --attest "I understand this is not the intended workflow and I am intentionally skipping queue completion"`
  - Expected: scan completes and refreshed issue queries are available.
- `desloppify status`
  - Expected: current queue state is refreshed on current code and reports no open `P0` security findings before `P4-EXIT`.
- `desloppify show review --status open`
  - Expected: `P4-W5` mapped imported issues are absent or explicitly prepared for single-owner `P4-EXIT` deferral in the checklist.
- All `desloppify show review::<id>` and `desloppify show security::<id>` commands listed in Task 6
  - Expected: mapped `P4-W5` IDs are retired (`No open issues matching`) or explicitly dispositioned in checklist with single-owner follow-up + trigger.

## Rollback Notes

If behavior parity breaks:

1. Revert overlay/Playback Options/EPG security cleanup changes first (Task 1 through Task 3 files) if DOM or modal behavior regresses.
2. Revert status/type/cast cleanup separately (Task 4 files) if type harmonization destabilizes compile/runtime wiring.
3. Revert container-id ownership rewiring separately (Task 5 files) if startup fixture/order assertions regress.
4. Revert checklist updates for `P4-W5` if evidence commands no longer match actual state.

Do not add fallback paths; revert and re-plan.

## Commit Checkpoints

- Checkpoint 1: `cleanup(p4-w5): replace overlay innerhtml cleanup paths`
- Checkpoint 2: `cleanup(p4-w5): redact playback option audio-switch logs`
- Checkpoint 3: `cleanup(p4-w5): remove epg innerhtml and insecure random residue`
- Checkpoint 4: `cleanup(p4-w5): remove epg status and config cast residue`
- Checkpoint 5: `cleanup(p4-w5): normalize app-shell container id ownership`
- Checkpoint 6: `cleanup(p4-w5): close priority-4 cleanup pass with evidence`

## Priority-Exit Readiness

`P4-W5` is the final `P4-W#` work item; `P4-EXIT` remains mandatory before any `P5` work.

Priority 4 mapped imported issue expectations:

- Already resolved in prior slices:
  - `review::.::holistic::abstraction_fitness::orchestrator_passthrough_facade::8832435b` -> `resolved` (`P4-W2`)
  - `review::.::holistic::design_coherence::navigation_manager_overloaded_input_stack::d3d8f55f` -> `resolved` (`P4-W3`)
- Must be dispositioned by this slice (`P4-W5`) with explicit target + fallback owner:
  - `review::.::holistic::convention_outlier::container_id_convention_split::89da5d23`
    - target: `resolved`
    - fallback if still open: `deferred` to `P4-EXIT` with revisit trigger `before any P5 checklist/plan progress`
  - `review::.::holistic::mid_level_elegance::epg_coordinator_seam_overload::4def954d`
    - target: `resolved`
    - fallback if still open: `deferred` to `P4-EXIT` with revisit trigger `P4-EXIT evidence refresh on current code`
  - `review::.::holistic::high_level_elegance::epg_top_level_owner_blur::d400d216`
    - target: `resolved`
    - fallback if still open: `deferred` to `P4-EXIT` with revisit trigger `P4-EXIT evidence refresh on current code`
  - `review::.::holistic::cross_module_architecture::epg_subsystem_coupling_hotspot::b900285d`
    - target: `resolved`
    - fallback if still open: `deferred` to `P4-EXIT` with revisit trigger `P4-EXIT evidence refresh on current code`

Security triage readiness captured at plan start:

- `desloppify show security --status open --no-budget --top 200` reports 8 open issues, all `T2`; no open `P0` issues were reported.
- `P4-W5` target disposition for the 8 inherited security IDs listed in this plan is `resolved`.
- If any of those 8 IDs remain open after implementation, `P4-W5` must record exact `deferred` disposition in checklist with owner `P4-EXIT`, reason, and revisit trigger.

Priority-exit gate requirements to carry into `P4-EXIT`:

- Re-run strongest verification/evidence commands on current code:
  - `desloppify status`
  - `desloppify show review --status open`
  - all `P4-W5` mapped review/security `desloppify show <id>` commands
  - `npm run verify`
- Record exact `P0` security disposition at `P4-EXIT` (clear or deferred with exact IDs + trigger).
- If any mapped issue remains open after `P4-W5`, `P4-W5` checklist closeout must assign one explicit successor owner (not shared implicit ownership) before `P4-EXIT` can complete.
- No `P5` checklist/plan progress until `P4-EXIT` is complete.

## Planner Self-Check

1. Unresolved architecture seam hidden in task? -> **No**; this is a bounded cleanup pass with locked no-redesign rules.
2. Adjacent files need contract/type changes but are out of scope? -> **No**; all known adjacent type/wiring seams are explicitly in scope.
3. Any out-of-scope file still required for mechanical wiring? -> **No**; listed scope covers all expected wiring points.
4. Full Codanna evidence path and fallback notes recorded? -> **Yes**.
5. Growing a hotspot instead of using preferred owners? -> **No**; this plan removes residue and keeps module-owned boundaries.
6. Would a fresh session need to invent important decisions? -> **No**; decisions, files, and commands are explicit.
7. Execution-grade vs unresolved design? -> **Execution-grade** for `P4-W5`; `P4-EXIT` remains a separate mandatory gate.

## Execution Handoff

Plan complete and saved to `docs/plans/2026-03-12-p4-w5-priority-4-cleanup-pass.md`.

```text
NEXT_SESSION_HANDOFF
NEXT_PROMPT: lineup-cleanup-implement
TASK: P4-W5 priority-4 cleanup pass
TASK_FAMILY: cleanup/refactor
TIER: Tier 2
PLAN: docs/plans/2026-03-12-p4-w5-priority-4-cleanup-pass.md
ARTIFACT: docs/plans/2026-03-12-p4-w5-priority-4-cleanup-pass.md
FILES:
- docs/plans/2026-03-12-p4-w5-priority-4-cleanup-pass.md
BLOCKERS: none
MESSAGE:
Implement P4-W5 from this tracked plan exactly as written. Retire the explicit PlaybackOptions log-safety finding, keep the EPG refresh public entrypoints stable, run the added shared-caller tests if Task 4 changes refresh control flow, and do not mark P5 ready until Task 6 updates the checklist with refreshed `desloppify status`, `desloppify show review --status open`, and exact mapped-issue dispositions.
```
