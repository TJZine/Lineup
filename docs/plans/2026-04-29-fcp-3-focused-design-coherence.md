# FCP-3 Focused Design Coherence Plan

**Plan Status:** completed
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

## Goal

Resolve `FCP-3-SF1` from [the FCP-3 focused-design audit](./2026-04-29-fcp-3-focused-design-coherence-audit.md) by separating Settings screen focus/remote-control orchestration from Settings screen rendering and state consumption.

The approved package is limited to the Settings screen focus seam: focus graph construction, D-pad key routing, dropdown focus restoration, per-category detail focus memory, deferred category-swap focus intent, and focus registry sync. The work must preserve behavior and ownership; it must not redesign the Settings UI.

## Non-Goals

- Do not change settings persistence, settings category definitions, or `SettingsScreenStateController` behavior.
- Do not change app-shell lazy-screen construction, app-shell visibility coordination, or public `SettingsScreen` constructor behavior.
- Do not change `NavigationManager`, shared focus primitive contracts, or other screen focus implementations.
- Do not change CSS, visual design, theme metadata, rendered IDs/classes, or ARIA/status semantics except where a test-proven bug is discovered and triggers replan.
- Do not touch EPG, channel setup, Plex, scheduler, player, Orchestrator, or FCP-4 code-signal work.
- Do not mark FCP-3 completed until implementation, verification, audit closeout, and adversarial reviews are complete.

## Parent Priority Alignment

This plan is for `ARCHITECTURE_CLEANUP_CHECKLIST.md` item `FCP-3` Focused Design Coherence.

FCP-3 requires source-backed cleanup of mixed responsibilities, dense control flow, and unclear stage boundaries only when there is a real closure condition beyond making code smaller. The selected package is `FCP-3-SF1`: `SettingsScreen.ts` currently mixes view composition with D-pad focus orchestration and dropdown focus restoration, while existing tests provide a stable proof surface for behavior-preserving extraction.

This plan is intended to close all currently admitted FCP-3 source findings after its ready execution unit is implemented, reviewed, verified, and the Priority-Exit Readiness section is satisfied. Accepted/no-action and deferred-outside-selected-package audit areas remain owned in the audit and must be rechecked before closeout.

## Required Reading

Read in this order before implementation:

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/cleanup-loop.md`
4. `ARCHITECTURE_CLEANUP_CHECKLIST.md`, especially the FCP operating contract and FCP-3 mini-record
5. `docs/agentic/plan-authoring-standard.md`
6. `docs/architecture/CURRENT_STATE.md`
7. `docs/architecture/modules.md`
8. `docs/agentic/codanna-playbook.md`
9. `docs/plans/2026-04-29-fcp-3-focused-design-coherence-audit.md`
10. this plan
11. `src/modules/ui/settings/SettingsScreen.ts`
12. `src/modules/ui/settings/__tests__/SettingsScreen.test.ts`
13. `src/modules/ui/settings/SettingsScreenStateController.ts` for read-only boundary confirmation

Freshness gate: if any referenced Settings screen, navigation, app-shell lazy-screen, or settings-state files changed materially after this plan was written, refresh the audit and plan before implementation.

## Required Skills

- `architecture-boundaries`: keep the extraction inside the settings UI owner and avoid growing app-shell, navigation, or shared focus contracts.
- `ui-composition-patterns`: preserve TV D-pad focus behavior, hide/destroy cleanup, ARIA hooks, and deferred animation/focus behavior.
- `verification-strategy`: primary mode is refactor-invariance with targeted UI/focus tests and source audits.
- `execution-plan-authoring`: keep the handoff decision-complete without turning the plan into implementation pseudo-code.

## Codanna Discovery

Codanna MCP tools were not exposed in this session, so local CLI `codanna mcp` was used.

- `get_index_info`: 11140 symbols across 696 files, 3148 relationships, semantic search enabled with `AllMiniLML6V2`, 14 embeddings, updated about 1 hour before audit.
- `semantic_search_with_context query:"FCP-3 focused design coherence hotspots mixed responsibilities dense control flow" limit:10`: weak/noisy overall, but surfaced `SettingsScreen._registerFocusables` and `SettingsScreen.show` as relevant focus/design-coherence hints.
- `search_documents query:"FCP-3 focused design coherence" limit:10`: returned plan-standard and workflow hits, with a `LockBusy` warning during document auto-sync. Used as orientation only.
- `analyze_impact SettingsScreen`: reported limited public impact through `AppLazyScreenRegistry` and `AppScreenVisibilityCoordinator`, supporting a settings-screen-local package.
- `search_symbols query:_registerFocusables limit:10`: found `SettingsScreen._registerFocusables` among screen-local focus registration methods.
- `analyze_impact _registerFocusables`: reported local coupling to `SettingsScreen` constructor, `_buildUI`, `_createCategoryButton`, `_renderActiveCategory`, `_setActiveCategory`, `show`, and `_handleStateInvalidated`.

Deterministic fallback used `wc -l`, targeted `rg`, and direct source reads for proof-grade classification across the current hotspots and recently changed coordination files. No Desloppify output, issue ids, package maps, score deltas, or triage were used.

## Impact Snapshot

The implementation blast radius is settings UI source and tests.

Current source evidence:

- `SettingsScreen.ts` has the public constructor consumed by `AppLazyScreenRegistry`; app-shell callers should not see a contract change.
- `SettingsScreenStateController.ts` already owns settings category/state construction and persistence-facing callbacks. It is not part of the extraction.
- `SettingsScreen.ts` owns rendering and focus orchestration inline. The focus orchestration seam is concentrated in `_renderActiveCategory`, `_setActiveCategory`, `show`, `_handleStateInvalidated`, `_openDropdownForSelect`, `_registerFocusables`, `_unregisterFocusables`, `_isFocusableEnabled`, and `_getFocusableElement`.
- `SettingsScreen.test.ts` already covers the critical behavior surface: category order, active detail rendering, RIGHT into details, deferred category swaps, hide cleanup, re-registering focusables after deferred swaps, remembered detail focus, storage refresh on category switches, subtitle-dependent rerender focus preservation, roundtrip focus continuity, unrelated previous-screen focus, select left/right behavior, dropdown behavior, profile row rendering, transcode controls, and theme selection.

The intended owner split:

- `SettingsScreen.ts`: DOM composition, category detail rendering, screen show/hide/destroy lifecycle, and callbacks into settings state.
- New settings-local focus owner: focus graph construction, focus registry sync, keypress handling policy, focus target selection, per-category detail focus memory, and dropdown focus restoration hooks.
- `SettingsScreenStateController.ts`: unchanged settings state/persistence facade.

## Files In Scope

- `src/modules/ui/settings/SettingsScreen.ts`
- New settings-local focus owner file(s) under `src/modules/ui/settings/`, preferably one focused coordinator such as `SettingsScreenFocusCoordinator.ts`
- `src/modules/ui/settings/__tests__/SettingsScreen.test.ts`
- Optional new narrow test under `src/modules/ui/settings/__tests__/` only if the extraction creates a stable pure coordinator contract worth testing directly
- `docs/plans/2026-04-29-fcp-3-focused-design-coherence-audit.md` only for closeout evidence updates
- `docs/plans/2026-04-29-fcp-3-focused-design-coherence.md` only for status/closeout evidence updates
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` only for FCP-3 mini-record status/evidence updates

## Files Out Of Scope

- `src/modules/ui/settings/SettingsScreenStateController.ts`, except read-only verification
- `src/modules/ui/settings/SettingsStore.ts`
- `src/modules/ui/settings/constants.ts`
- Settings CSS/theme files
- `src/modules/navigation/**`
- `src/modules/ui/common/focus/**`, except read-only verification
- `src/core/app-shell/AppLazyScreenRegistry.ts`
- `src/core/app-shell/AppScreenVisibilityCoordinator.ts`
- `src/App.ts`
- `src/Orchestrator.ts` and `src/core/orchestrator/**`
- `src/modules/ui/epg/**`
- `src/modules/ui/channel-setup/**`
- `src/modules/plex/**`
- `src/modules/scheduler/**`
- `src/modules/player/**`
- FCP-4 planning or source work

If implementation needs an out-of-scope source edit, stop and replan before coding it.

## Planner Self-Check

- Source-backed? Yes. `FCP-3-SF1` is based on direct reads of `SettingsScreen.ts`, `SettingsScreen.test.ts`, and current architecture docs, with Codanna impact as supporting evidence.
- One coherent package? Yes. The package is Settings screen focus/remote-control orchestration coherence.
- Owner clear? Yes. Settings UI owns the screen; a settings-local focus coordinator owns focus graph/key routing. Settings state/persistence and app-shell lazy-screen wiring remain in their existing owners.
- Real closure condition beyond smaller file? Yes. Closure requires inline focus orchestration to move behind a settings-local owner while preserving tested focus/dropdown/deferred-swap behavior and source-audited boundaries.
- Verification mode chosen before freeze? Yes. Refactor-invariance with existing focused tests, source audits, `npm run verify`, and `npm run verify:docs` for docs/checklist changes.
- FCP-4 avoided? Yes. Code-signal/comment cleanup and broad noise removal are explicitly out of scope.
- Fresh session safe? Yes. Scope, owner seam, files, verification, and stop/replan triggers are explicit.

## Architecture Seam Decision Gate

The chosen seam is a settings-local focus coordinator/policy owner extracted from `SettingsScreen.ts`.

Proceed only if implementation can preserve these boundaries:

- `SettingsScreen` continues to render settings DOM, own category-detail composition, and call the settings state controller.
- The new focus owner may depend on settings screen DOM accessors and callbacks supplied by `SettingsScreen`, but it must not become a second renderer or settings state store.
- The new focus owner may use `INavigationManager`, `FocusableElement`, and `syncFocusableRegistry`, but it must not change navigation manager or shared focus primitive contracts.
- Dropdown focus restoration may be coordinated through narrow callbacks, but dropdown rendering remains with existing settings dropdown/popover code.
- The public `SettingsScreen` constructor and app-shell lazy-screen imports remain stable.

Stop and replan if:

- implementation requires edits to `NavigationManager`, shared focus primitives, app-shell lazy-screen wiring, app-shell visibility coordination, or settings state/persistence contracts
- a new focus owner starts owning rendered markup, settings item creation, storage reads/writes, Plex policy, scheduler data, or app-shell route policy
- existing `SettingsScreen` tests must be weakened or removed to pass
- preserving deferred category-swap focus behavior requires broader integration/manual proof not named here
- current source reveals another live FCP-3 source finding with a different owner or verification surface
- the implementation expands into FCP-4 code-signal cleanup or any FCP-4 planning

## Package Decomposition

`package_id`: `FCP-3-SETTINGS-SCREEN-FOCUS-COHERENCE`

`checklist_token`: `FCP-3`

`source_finding_ids`: `FCP-3-SF1`

`slice_table`:

| slice_id | goal | areas/files | source_finding_ids | verification | dependencies | stop_condition | handoff_condition | serial_only/parallel_group | parallel_justification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FCP-3-S1` | Extract Settings screen focus/key/dropdown focus restoration orchestration into one settings-local owner while preserving rendering, state, app-shell, and navigation contracts. | `SettingsScreen.ts`; new settings-local focus owner file(s); `SettingsScreen.test.ts`; optional narrow focus-owner test | `FCP-3-SF1` | Targeted SettingsScreen tests; focus/source ownership `rg` audits; `npm run verify`; `npm run verify:docs` after docs/checklist updates | Existing SettingsScreen tests and `syncFocusableRegistry` behavior | Any architecture seam decision gate trigger fires | Tests pass; source review confirms focus graph/key handling/focus memory moved behind settings-local owner; no out-of-scope source files changed; proof matrix ready for FCP-3 closeout review | `serial_only` | One screen-local behavior seam with coupled focus/lifecycle tests; parallel execution would split the same focus graph and increase regression risk. |

`coverage_check`: `FCP-3-SF1` maps completely to `FCP-3-S1`. No other FCP-3 source findings are admitted. Accepted/no-action and deferred-outside-selected-package audit areas stay owned by the FCP-3 audit record and final FCP reconciliation.

`ready_now_slice`: `FCP-3-S1`

`ready_now_execution_unit`: `FCP-3-S1`

`recommended_slice_order`: `FCP-3-S1` only.

`parallel_execution_policy`: Do not authorize parallel `cleanup_worker` execution. This is a single-slice package whose focus graph, key handler, dropdown restoration, and lifecycle cleanup are coupled through the same test surface.

## Verification Commands

Verification mode: refactor-invariance with targeted UI/focus proof.

Plan classification: `existing coverage sufficient`.

Existing coverage is sufficient because `src/modules/ui/settings/__tests__/SettingsScreen.test.ts` already asserts the stable focus and lifecycle behavior that this refactor must preserve: RIGHT into details, deferred category swap focus, hide cleanup, focusable re-registration, remembered detail focus, left/right select handling, dropdown-driven focus restoration, subtitle-dependent rerender focus, and re-open focus continuity. Add a new narrow coordinator test only if implementation creates a pure contract that is not already protected through the screen behavior tests.

Run targeted tests:

```sh
npm run test:unit -- src/modules/ui/settings/__tests__/SettingsScreen.test.ts src/modules/ui/settings/__tests__/SettingsScreenStateController.test.ts
```

Expected outcome: all Settings screen and state-controller tests pass. The state-controller test is included to prove the extraction did not disturb settings state/persistence facade behavior.

Run source ownership audits:

```sh
rg -n "_registerFocusables|_unregisterFocusables|_navKeyHandler|_lastFocusedItemByCategory|_pendingFocusRestore|syncFocusableRegistry|keyPress|createSettingsDropdown" src/modules/ui/settings/SettingsScreen.ts src/modules/ui/settings
rg -n "localStorage|sessionStorage|SettingsStore|Plex|fetch\\(|AppLazyScreenRegistry|AppScreenVisibilityCoordinator|NavigationManager" src/modules/ui/settings --glob "*Focus*.ts" --glob "*focus*.ts"
```

Expected outcome: the first audit shows focus graph/key/dropdown focus restoration ownership moved to the settings-local focus owner while `SettingsScreen.ts` keeps only narrow orchestration/callback calls. The second audit shows the new focus owner did not absorb persistence, Plex/network, app-shell, or concrete navigation-manager ownership. `INavigationManager` type-only usage is permitted because the focus owner needs the existing navigation interface seam; concrete `NavigationManager` imports/instantiation, app-shell visibility imports, or edits to navigation internals are ownership drift. If a different approved settings-local filename does not match the focus globs, rerun the same audit against that exact file.

Run full runtime verification for UI/navigation source work:

```sh
npm run verify
```

Expected outcome: full repo verification passes after implementation.

Run docs/control-plane verification after plan, audit, or checklist updates:

```sh
npm run verify:docs
```

Expected outcome: docs/control-plane verification passes after this active plan, audit, and FCP-3 mini-record updates.

## Rollback Notes

Planning-only rollback is limited to reverting this plan, its audit artifact, and the FCP-3 checklist mini-record update.

Implementation rollback should revert only the `FCP-3-S1` source/test files: `SettingsScreen.ts`, the new settings-local focus owner file(s), and any touched Settings screen tests. Do not revert unrelated dirty workspace files listed in the audit.

If the extraction partially lands and focus behavior regresses, restore the previous inline focus handling in `SettingsScreen.ts` before attempting a smaller extraction. Do not patch around regressions by weakening tests or changing navigation manager behavior.

## Commit Checkpoints

- Checkpoint 1: Add or adjust targeted Settings screen tests only if implementation exposes a real unprotected focus contract.
- Checkpoint 2: Extract one settings-local focus owner and adapt `SettingsScreen.ts` through narrow callbacks/accessors.
- Checkpoint 3: Run targeted Settings tests and source ownership audits.
- Checkpoint 4: Run `npm run verify`.
- Checkpoint 5: Update audit, plan status, and FCP-3 checklist mini-record only after implementation verification and adversarial review approve closeout.

## Priority-Exit Readiness

This plan is intended to be the final FCP-3 implementation package if `FCP-3-S1` resolves `FCP-3-SF1` and the accepted/no-action plus deferred-outside-selected-package records in the audit remain valid.

Source finding disposition required before FCP-4 can start:

| source_finding_id | intended disposition | required closeout evidence | final owner |
| --- | --- | --- | --- |
| `FCP-3-SF1` | resolved by `FCP-3-S1` commit `22847d97` | Source review confirms settings focus orchestration is behind `SettingsScreenFocusCoordinator.ts`; `SettingsScreen.ts` retains rendering/state/lifecycle delegation; targeted controller-rerun Settings tests passed (2 suites / 46 tests); source audits show moved focus terms in the settings-local coordinator and no forbidden ownership drift beyond allowed type-only `INavigationManager` usage; security triage remains `no open P0 security findings`; worker-rerun `npm run verify` passed; clean implementation review approved `FCP-3-S1`; fresh FCP-3 closeout review found no findings and approved completion after recording this evidence; controller-rerun final `npm run verify` passed after the completed plan, audit, and checklist closeout update. | Settings UI focus owner |

Accepted/no-action and deferred-outside-selected-package areas from the audit:

- EPG grid/render/focus density remains owned by EPG component/view owners; revisit through FCP-6 or a future EPG-specific source audit only if a narrow behavior-proven seam is identified.
- Plex stream resolver density remains owned by Plex stream resolver owner; revisit through Plex boundary or FCP-5 portability planning if a coherent subtitle-debug, URL, universal-decision, or platform-assumption package is proven.
- ChannelManager density remains owned by scheduler/channel-manager owner; do not disturb FCP-2 failure semantics without a new source-backed package.
- Channel setup screen density remains owned by channel setup UI/screen owner; no FCP-3 package is admitted.
- AppOrchestrator/priority-one assembly remains owned by the FCP-1 accepted core orchestrator and priority-one assembly seams.

Security triage / expected P0 disposition:

- `no open P0 security findings` for this package at planning time.
- The approved source work is a UI focus/refactor package and must not change auth, token handling, Plex transport, storage schemas, network requests, authorization behavior, or security-sensitive persistence. If implementation or review discovers a P0 security finding, stop and replan with one final owner, reason, and revisit trigger before FCP-3 closeout or any FCP-4 work.

Priority-exit commands/evidence required:

- source-backed audit rerun/source review for `FCP-3-SF1`: complete; focus
  orchestration moved to `SettingsScreenFocusCoordinator.ts` and rendering/state
  ownership remained in `SettingsScreen.ts`
- package-local source audits listed in `## Verification Commands`: complete;
  focus terms moved into the settings-local coordinator and forbidden ownership
  audit found only allowed type-only `INavigationManager` usage in focus files
- targeted Settings tests: complete; controller rerun passed 2 suites / 46 tests
- `npm run verify`: complete in the cleanup-worker implementation pass after
  commit `22847d97`, and complete again in the controller final closeout pass
  after the completed plan, audit, and checklist update
- security triage remains `no open P0 security findings`
- `npm run verify:docs` after checklist/plan/audit closeout updates: complete
  inside the controller final `npm run verify` pass
- fresh FCP-3 closeout review: complete; no findings, approved FCP-3
  completion after recording the clean review evidence
- updated FCP-3 mini-record with proof matrix disposition, deferred
  owners/revisit triggers, verification evidence, and clean closeout review
  evidence: complete

Do not start, plan, or mark progress on FCP-4 until FCP-3 is completed with this evidence or explicitly blocked/deferred by maintainer direction.
