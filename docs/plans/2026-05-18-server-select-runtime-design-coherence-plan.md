**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** standalone remediation

# Server-Select Runtime Design-Coherence Plan

## Goal

Remediate Design coherence Package A by tightening the server-select runtime contract without changing product behavior.

`ready_now_execution_unit: DME-A1-server-select-runtime-contract`

The unit extracts the runtime adapter contract from the oversized runtime coordinator, removes the leaked visibility `generation` argument from the DOM adapter's `setClearButtonDisabled` contract, and adds direct public-seam tests for `ServerSelectRuntimeCoordinator`.

## Non-Goals

- Do not implement code in this planning session.
- Do not change selected-server persistence, Plex discovery/auth/library/stream behavior, app-shell route policy, navigation contracts, or startup routing.
- Do not update `ARCHITECTURE_CLEANUP_CHECKLIST.md`; this is standalone remediation unless the controller intentionally promotes it later.
- Do not run `desloppify scan --force-rescan`.
- Do not use stale detector IDs as the owner of this work. Current source owns the scope.
- Do not add compatibility shims, fallback adapter overloads, test-only public methods, or private probes.
- Do not grow `ServerSelectRuntimeCoordinator.ts` above its 506-line file-shape baseline.

## Parent Architecture Alignment

This plan follows `docs/architecture/CURRENT_STATE.md`:

- `ServerSelectScreen.ts` is the public screen and DOM adapter for server select.
- Runtime workflow, discovery/select/clear/reconnect, visibility generation, and idle ownership stay in `ServerSelectRuntimeCoordinator.ts`.
- Focus registration/restore stays in `ServerSelectFocusCoordinator.ts`.
- Status/display policy stays in `ServerSelectStatusPolicy.ts`.
- Server-list DOM rendering stays in `ServerSelectListView.ts`.
- Shared display-state types stay in `src/modules/ui/server-select/types.ts`.
- Selected-server storage remains behind `src/core/server-selection/*`, `src/core/orchestrator/runtime/OrchestratorServerSelectionRuntime.ts`, and `src/modules/plex/discovery/ServerSelectionStore.ts`; UI code consumes screen-ready state and runtime ports only.

The cleanup advances the existing owner map by making the runtime/screen contract explicit in a sibling server-select contract file instead of letting the hotspot coordinator own an inline UI adapter interface.

## Required Reading

Read in this order before implementation or review:

1. `docs/AGENTIC_DEV_WORKFLOW.md`
2. `agents.md`
3. `docs/agentic/session-prompts/cleanup-loop.md`
4. `docs/agentic/codanna-playbook.md`
5. `docs/agentic/plan-authoring-standard.md`
6. `docs/architecture/CURRENT_STATE.md`
7. `docs/architecture/file-shape-guardrails.md`
8. `docs/plans/2026-05-18-design-mid-elegance-root-cause-remediation.md`
9. this plan
10. current source for the files listed in `## Files In Scope`

Freshness gate: if any in-scope source file, `docs/architecture/CURRENT_STATE.md`, `docs/architecture/file-shape-guardrails.md`, or the prior DME plan changed materially after this plan was written, refresh this plan before implementation.

## Required Skills

- `lineup-cleanup-loop`
- `architecture-boundaries`
- `ui-composition-patterns`
- `persistence-boundaries`
- `verification-strategy`
- `execution-plan-authoring`
- `review-request`
- `review-adjudication` for any plan-review or implementation-review findings
- `closeout-verification`
- `desloppify`

## Codanna Discovery

- `get_index_info`: 12712 symbols across 819 files; semantic search enabled; index updated about 17 hours before this plan.
- `semantic_search_with_context "ServerSelectRuntimeCoordinator screen adapter setClearButtonDisabled generation server-select runtime contract"`: weak/noisy for the coordinator; top hits were app-shell/orchestrator server-select entrypoints. Exact symbol lookup was required.
- `semantic_search_with_context "class ServerSelectRuntimeCoordinator loadServers autoConnect clearSelectedServer generation token hidden destroyed focus settlement"`: weak/noisy; again surfaced app-shell/orchestrator entrypoints more strongly than the coordinator internals.
- `find_symbol ServerSelectRuntimeCoordinator`: `src/modules/ui/server-select/ServerSelectRuntimeCoordinator.ts`, symbol `6454`, class at 38-506; uses inline `ServerSelectRuntimeScreenAdapter`, `PlexServer`, `ServerSelectScreenPorts`, and status policy.
- `find_symbol ServerSelectRuntimeScreenAdapter`: `src/modules/ui/server-select/ServerSelectRuntimeCoordinator.ts`, symbol `6453`; implemented by `ServerSelectScreen`.
- `search_symbols setClearButtonDisabled` and `find_symbol setClearButtonDisabled`: one method in `ServerSelectScreen.ts`, symbol `6309`, signature `setClearButtonDisabled(disabled: boolean, generation: number): void`.
- `find_callers setClearButtonDisabled`: callers are `_loadServers`, `_handleClearSelectionAsync`, and `_selectServer` in `ServerSelectRuntimeCoordinator.ts`.
- `find_symbol ServerSelectScreen`: `src/modules/ui/server-select/ServerSelectScreen.ts`, symbol `6261`; implements `ServerSelectRuntimeScreenAdapter`.
- `search_documents "server-select runtime coordinator design coherence cleanup plan"` and `"Design coherence stuck 76 DME Package A server select runtime"`: weak/noisy, but direct `rg` found the prior active DME plan's Package A disposition.
- Controller-provided Codanna impact snapshot: `analyze_impact 6454` affects `ServerSelectScreen`, and then app-shell usage through `AppLazyScreenRegistry`, `AppScreenVisibilityCoordinator`, and `App`.
- Local Codanna fallback note: this session's exposed Codanna tool list did not include `analyze_impact`; the controller's observed impact snapshot is recorded above, and direct source reads checked the app-shell files named by that snapshot.
- Direct fallback reads: `ServerSelectRuntimeCoordinator.ts`, `ServerSelectScreen.ts`, `ServerSelectScreen.test.ts`, `ServerSelectStatusPolicy.ts`, `ServerSelectFocusCoordinator.ts`, `types.ts`, `index.ts`, `AppScreenVisibilityCoordinator.ts`, `AppLazyScreenRegistry.ts`, `AppLazyScreenPortFactory.ts`, `AppOrchestrator.ts`, `CURRENT_STATE.md`, `file-shape-guardrails.md`, and the prior DME plan.
- Desloppify commands run for evidence only: `desloppify show src/modules/ui/server-select/ServerSelectRuntimeCoordinator.ts --status open` and `desloppify show src/modules/ui/server-select/ServerSelectScreen.ts --status open`.

## Impact Snapshot

Current source proof:

- `ServerSelectRuntimeCoordinator.ts` is 506 LOC and declares `ServerSelectRuntimeScreenAdapter` inline at the top of the hotspot file.
- `ServerSelectRuntimeScreenAdapter.setClearButtonDisabled` currently accepts `(disabled: boolean, generation: number)`.
- `ServerSelectScreen.ts` implements the adapter and suppresses the unused generation argument with `void generation`, proving runtime generation policy leaks into the DOM adapter contract.
- `ServerSelectScreen.test.ts` has broad screen-level jsdom coverage for discovery, auto-connect, manual selection, clear selection, hide/show generation guards, focus restore, and idle settlement, but there is no direct `ServerSelectRuntimeCoordinator` test file.
- `docs/architecture/file-shape-guardrails.md` records `ServerSelectRuntimeCoordinator.ts` at a 506-line accepted baseline with no routine line growth allowed.
- `docs/architecture/CURRENT_STATE.md` says runtime workflow, discovery/select/clear/reconnect, visibility generation, and idle ownership belong in `ServerSelectRuntimeCoordinator.ts`; screen, focus, status, and list rendering are separate owners.

Desloppify proof:

- `desloppify show src/modules/ui/server-select/ServerSelectRuntimeCoordinator.ts --status open`: open `structural::src/modules/ui/server-select/ServerSelectRuntimeCoordinator.ts` large-file issue and open `test_coverage::src/modules/ui/server-select/ServerSelectRuntimeCoordinator.ts::transitive_only`.
- `desloppify show src/modules/ui/server-select/ServerSelectScreen.ts --status open`: open `smells::src/modules/ui/server-select/ServerSelectScreen.ts::voided_symbol` at `setClearButtonDisabled(disabled, generation)`.
- The same output reports subjective Design coherence at 76.0%, confirming this is the deferred Package A surface from the DME loop.

App-shell impact:

- `AppScreenVisibilityCoordinator` shows and hides `ServerSelectScreen` through `show({ allowAutoConnect })` / `hide()` only.
- `AppLazyScreenRegistry` constructs `ServerSelectScreen` and stores the instance; it does not consume the runtime adapter contract directly.
- `AppLazyScreenPortFactory` adapts app-shell server-selection runtime into `ServerSelectScreenPorts`.
- `AppOrchestrator.openServerSelect()` only routes to `server-select` with `allowAutoConnect`.

No app-shell public contract change is required for `DME-A1`.

## Ready Now Execution Unit

`ready_now_execution_unit: DME-A1-server-select-runtime-contract`

Execution target:

- Move `ServerSelectRuntimeScreenAdapter` from `ServerSelectRuntimeCoordinator.ts` into `src/modules/ui/server-select/ServerSelectRuntimeContracts.ts`.
- Update `ServerSelectRuntimeCoordinator.ts` to import that adapter type from the new contract file.
- Update `ServerSelectScreen.ts` to import the adapter type from the contract file, keep constructing `ServerSelectRuntimeCoordinator`, and implement `setClearButtonDisabled(disabled: boolean)` without a `generation` parameter or `void generation`.
- Update every runtime call to `adapter.setClearButtonDisabled` so generation checks stay inside `ServerSelectRuntimeCoordinator` before the adapter is called; the adapter receives only disabled state.
- Add `src/modules/ui/server-select/__tests__/ServerSelectRuntimeCoordinator.test.ts` with direct public-seam tests through runtime methods and adapter/port spies.

Required direct runtime test coverage:

- discovery load: `show({ allowAutoConnect: false })` discovers servers, renders through the adapter, clears loading controls/spinner, restores focus, and settles `whenIdle()`.
- auto-connect success: saved server plus `allowAutoConnect: true` calls `ports.selectServer(savedId)`, hides the hint, reports connected success, and does not render fallback selection state.
- auto-connect failure: missing or failing saved server renders the server list, reports saved-server-unavailable status through status policy, hides the hint, and leaves manual selection available.
- manual selection guard behavior: a second `selectServer()` while selection is in flight is ignored; clear-selection is disabled while selection is active and re-enabled only after current visible work settles.
- clear-selection guard behavior: repeated clear requests while clearing or selecting are ignored; successful clear rerenders from the last discovered servers and restores focus.
- hidden/destroyed generation guard behavior: late discovery, selection, and clear completions after `hide()` or `destroy()` do not call adapter methods that update visible UI, do not restore focus, and allow idle settlement.
- idle/focus settlement: `whenIdle()` waits for load/clear/select plus pending focus restore and resolves when `notifyFocusRestoreSettled()` or `destroy()` settles pending work.

Test constraints:

- Import and construct `ServerSelectRuntimeCoordinator` directly.
- Use a fully typed fake `ServerSelectRuntimeScreenAdapter` and fake `ServerSelectScreenPorts`.
- Assert through public runtime methods (`show`, `hide`, `refresh`, `handleClearSelection`, `selectServer`, `whenIdle`, `destroy`, `markFocusRestorePending`, `notifyFocusRestoreSettled`) and adapter/port spies only.
- Do not call private methods, expose private state, or add test-only runtime methods.
- Do not make the runtime contract file a broad package barrel; it owns only runtime adapter-facing contracts needed by `ServerSelectRuntimeCoordinator` and `ServerSelectScreen`.

Exit condition:

- `ServerSelectRuntimeCoordinator.ts` must drop below the 506-line allowlist baseline and preferably below 500 LOC.
- `ServerSelectScreen.ts` must no longer contain `void generation` for `setClearButtonDisabled`.
- `ServerSelectRuntimeCoordinator.ts` must have direct tests and no longer be only transitively covered by `ServerSelectScreen.test.ts`.

## Files In Scope

Production files:

- `src/modules/ui/server-select/ServerSelectRuntimeCoordinator.ts`
- `src/modules/ui/server-select/ServerSelectRuntimeContracts.ts` (new)
- `src/modules/ui/server-select/ServerSelectScreen.ts`
- `docs/architecture/file-shape-guardrails.md` only if `ServerSelectRuntimeCoordinator.ts` shrinks to 500 lines or fewer and the allowlist row must be removed

Test files:

- `src/modules/ui/server-select/__tests__/ServerSelectRuntimeCoordinator.test.ts` (new)
- `src/modules/ui/server-select/__tests__/ServerSelectScreen.test.ts`
- `src/modules/ui/server-select/__tests__/ServerSelectFocusCoordinator.test.ts`
- `src/modules/ui/server-select/__tests__/ServerSelectListView.test.ts`

The existing screen/focus/list tests are in scope for verification and narrow updates only if the contract import/signature change requires test helper adjustments. They are not a license to rewrite screen DOM, focus policy, or list rendering.

## Files Out Of Scope

- `ARCHITECTURE_CLEANUP_CHECKLIST.md`
- `.desloppify` state except through later controller-approved resolve/plan commands
- `docs/architecture/CURRENT_STATE.md` unless implementation proves the public owner map changed; the expected path should not need updates
- `src/modules/ui/server-select/types.ts`
- `src/modules/ui/server-select/index.ts`
- `src/modules/ui/server-select/ServerSelectStatusPolicy.ts`
- `src/modules/ui/server-select/ServerSelectFocusCoordinator.ts`
- `src/modules/ui/server-select/ServerSelectListView.ts`
- `src/styles/shell.onboarding.server-selection.css`
- `src/core/server-selection/*`
- `src/core/orchestrator/*`
- `src/core/app-shell/*`
- `src/modules/plex/discovery/*`
- `src/modules/plex/auth/*`
- `src/modules/plex/library/*`
- `src/modules/plex/stream/*`
- navigation manager/contracts
- channel setup, EPG, settings, playback, scheduler, and persistence stores

Out-of-scope app-shell files may be read for verification of impact, but implementation must stop and replan before editing them.

## Planner Self-Check

1. Unresolved seam: none for `DME-A1`. The adapter contract belongs in a package-local server-select runtime contract file; runtime generation policy stays inside the runtime coordinator.
2. Adjacent contract changes: the only approved contract change is `ServerSelectRuntimeScreenAdapter.setClearButtonDisabled(disabled: boolean)`. App-shell `show`/`hide`, `ServerSelectScreenPorts`, navigation, and selected-server runtime ports are frozen.
3. Out-of-scope reliance: app-shell and core selected-server owners are source-read for impact only. The unit can complete without changing them.
4. Codanna evidence and fallback reads are recorded, including the unavailable local `analyze_impact` tool and controller-provided impact snapshot.
5. Owner fit: this reduces hotspot-owned contract surface and removes runtime policy from the DOM adapter instead of growing the screen or composition roots.
6. Fresh-session readiness: a worker can implement this without selecting among packages or inventing verification policy.
7. Execution-grade status: yes, pending controller plan-review. The unit has exact files, contract decision, tests, stop conditions, and verification commands.

## Architecture Seam Decision Gate

Implement only `ready_now_execution_unit: DME-A1-server-select-runtime-contract`.

Approved seam:

- `ServerSelectRuntimeCoordinator` owns visibility generation checks and async runtime policy.
- `ServerSelectRuntimeScreenAdapter` is a package-local contract consumed by the runtime and implemented by the screen.
- `ServerSelectScreen` receives UI commands only; it does not know runtime generation tokens for clear-button updates.

Replan before implementation continues if any of these become necessary:

- editing any file listed out of scope
- changing `ServerSelectScreenPorts`, app-shell runtime contracts, navigation route params, selected-server persistence, Plex discovery/auth behavior, or startup routing
- moving discovery/select/clear runtime workflow out of `ServerSelectRuntimeCoordinator.ts`
- moving focus restore/timer ownership out of `ServerSelectFocusCoordinator.ts`
- moving status policy out of `ServerSelectStatusPolicy.ts`
- adding a compatibility overload or adapter bridge for old `setClearButtonDisabled(disabled, generation)` callers
- adding private probes or test-only methods to prove runtime behavior
- allowing `ServerSelectRuntimeCoordinator.ts` to stay at or above 506 LOC after moving the adapter contract
- editing `docs/architecture/file-shape-guardrails.md` for anything other than removing the stale `ServerSelectRuntimeCoordinator.ts` allowlist row if the file shrinks to 500 lines or fewer
- turning `ServerSelectRuntimeContracts.ts` into a general barrel for unrelated types
- discovering that direct runtime tests require real DOM behavior instead of adapter spies

Absorb-now policy:

- Absorb only import/signature fallout inside the exact in-scope files and exact runtime adapter contract.
- Any new server-selection persistence, app-shell route, Plex discovery, focus, status, or visual behavior residue requires replan with one final owner.

## Verification Commands

- Verification classification: `new regression/contract test required`

Planning artifact verification:

- Docs proof mode: `broader integration/manual proof required`
- Run: `npm run verify:docs`
- Expected: passes with this active tracked plan satisfying the serious-plan standard.

Implementation verification:

- Proof surface: direct runtime contract tests plus existing server-select behavior tests.
- Run: `npm test -- --runTestsByPath src/modules/ui/server-select/__tests__/ServerSelectRuntimeCoordinator.test.ts src/modules/ui/server-select/__tests__/ServerSelectScreen.test.ts src/modules/ui/server-select/__tests__/ServerSelectFocusCoordinator.test.ts src/modules/ui/server-select/__tests__/ServerSelectListView.test.ts`
- Expected: new direct runtime tests pass; existing screen/focus/list tests preserve DOM, focus, status, auto-connect, clear-selection, generation guard, and list behavior.
- Run: `npm run typecheck`
- Expected: adapter contract imports and `setClearButtonDisabled(disabled)` signature compile with no stale generation argument.
- Run: `npm run verify:maintainability`
- Expected: production file-shape guardrail passes; `ServerSelectRuntimeCoordinator.ts` does not grow beyond the 506-line baseline and should be below 500. If it is 500 lines or fewer, remove the stale `ServerSelectRuntimeCoordinator.ts` row from `docs/architecture/file-shape-guardrails.md` in the same implementation pass.
- Run: `npm run verify`
- Expected: full UI/navigation/Plex-adjacent verification passes because the touched screen participates in startup routing, navigation focus, and selected-server runtime flows.
- Optional evidence command after implementation, if the controller wants detector confirmation without rescanning: `desloppify show src/modules/ui/server-select/ServerSelectRuntimeCoordinator.ts --status open` and `desloppify show src/modules/ui/server-select/ServerSelectScreen.ts --status open`.
- Expected optional evidence: direct-test and voided-symbol findings are absent or narrowed by current-source proof; structural large-file issue is absent if the file drops below the detector threshold, otherwise the guardrail proof must still show no baseline growth.

Why this depth matches risk:

- This is refactor-invariance plus public contract cleanup, but existing coverage is explicitly transitive-only for the runtime owner. New direct contract tests are required to prove the runtime public seam without private probes.
- `npm run verify` is required because the server-select screen is a startup UI surface with navigation focus, app-shell visibility, and selected-server persistence-adjacent behavior.

## Rollback Notes

- If the adapter extraction breaks compilation, revert `ServerSelectRuntimeContracts.ts` and restore the inline interface in `ServerSelectRuntimeCoordinator.ts`.
- If removing `generation` from `setClearButtonDisabled` regresses hidden/destroyed stale-update guards, keep the public adapter signature narrow and fix the runtime generation checks; do not push generation back into `ServerSelectScreen`.
- If direct runtime tests reveal behavior that cannot be proved through adapter spies, stop and replan rather than adding DOM dependencies or private probes to the runtime tests.
- If app-shell behavior regresses, revert only the server-select contract/test changes and replan the app-shell seam explicitly.

## Commit Checkpoints

- Planning checkpoint: docs-only checkpoint is allowed only after `npm run verify:docs` passes and the controller's plan-review gate is clean. Stage this plan only; leave unrelated dirty docs/assets untouched.
- Implementation checkpoint: one focused implementation checkpoint for `DME-A1` after targeted server-select tests, `npm run typecheck`, `npm run verify:maintainability`, and `npm run verify` pass. Include the `docs/architecture/file-shape-guardrails.md` stale-row removal in that implementation checkpoint only if the coordinator drops to 500 lines or fewer.
- Keep active tracked plan docs out of the implementation commit unless the controller explicitly chooses a separate tracked-doc checkpoint.

## Review Packet

Use `review-request` before implementation:

```text
REVIEW_REQUEST
TASK: Design coherence Package A server-select runtime contract remediation
TASK_FAMILY: cleanup/refactor
TIER: Tier 3 standalone remediation
REVIEW_TARGET: docs/plans/2026-05-18-server-select-runtime-design-coherence-plan.md
PLAN_OR_ARTIFACT: docs/plans/2026-05-18-server-select-runtime-design-coherence-plan.md
FILES_IN_SCOPE: ServerSelectRuntimeCoordinator.ts, ServerSelectRuntimeContracts.ts, ServerSelectScreen.ts, ServerSelectRuntimeCoordinator.test.ts, existing server-select screen/focus/list tests for verification
FILES_OUT_OF_SCOPE: app-shell, core server-selection, orchestrator, Plex, persistence stores, navigation contracts, status/focus/list owners except verification-only reads
KEY_INVARIANTS: runtime owns generation guards; screen adapter receives no generation token for clear-button state; no private probes; coordinator drops below 506 LOC and preferably below 500; selected-server persistence stays behind existing owners
VERIFICATION_RUN: npm run verify:docs
KNOWN_RISKS: local Codanna tool surface lacked analyze_impact, so controller-provided impact snapshot and direct source reads are recorded
WHAT_TO_PRIORITIZE: boundary correctness, test proof through public runtime API, accidental app-shell/persistence scope creep, and file-shape guardrail compliance
OUTPUT_EXPECTATION: findings first by severity; say explicitly whether DME-A1 is implementation-ready
```

Use `review-adjudication` for every material finding before implementation. Accepted findings must either update this plan or explicitly block `DME-A1`; do not let the worker resolve review findings by widening scope during implementation.
