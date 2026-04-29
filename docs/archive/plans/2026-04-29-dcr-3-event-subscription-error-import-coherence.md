# DCR-3 Event Subscription And Error Import Coherence

**Plan Status:** archived
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

## Goal

Retire `ARCHITECTURE_CLEANUP_CHECKLIST.md` package `DCR-3` by making event
subscription cleanup contracts coherent across shared event utilities,
navigation, player, Plex, scheduler/channel-manager, and EPG surfaces, and by
normalizing the production `AppErrorCode` import source.

The implementation must resolve every listed DCR-3 issue or owner decision:

- `DCR-3-A1`: navigation/player/Plex stream/EPG event surfaces expose void
  `on()` while the canonical shared `EventEmitter` returns `IDisposable`.
- `DCR-3-A2`: Plex library interface declares void subscription cleanup while
  the implementation returns a disposable.
- `DCR-3-A3`: `App`, `AppOrchestrator`, and Plex import `AppErrorCode` from
  drifted sources.
- `DCR-3-D1`: canonical event subscription contract decision.
- `DCR-3-D2`: canonical `AppErrorCode` import-source decision.

## Non-Goals

- Do not start `DCR-4`, `DCR-EXIT`, or any other DCR package.
- Do not change event producer behavior beyond subscription API return values,
  type contracts, listener cleanup, and tests needed to prove parity.
- Do not decompose `src/App.ts` or `src/core/orchestrator/AppOrchestrator.ts`
  beyond import/API normalization required by DCR-3.
- Do not change Plex token, URL, auth persistence, discovery selection, stream
  resolution, subtitle, or transport behavior.
- Do not remove lifecycle module error types or lifecycle-facing re-exports as a
  broad compatibility cleanup. This package only normalizes production
  `AppErrorCode` imports for the DCR-3 scope.
- Do not close the checklist row during implementation; checklist closeout
  remains controller-owned after implementation and review.

## Parent Architecture Alignment

This plan advances the shared event/API contract owner named in DCR-3 while
preserving module-specific event ownership:

- `src/utils/EventEmitter.ts` remains the canonical event primitive.
- Navigation owns navigation state, focus, remote handling, and its event
  surface.
- Player owns playback runtime events.
- Plex auth/discovery/library/stream modules own their Plex-facing event
  surfaces.
- Scheduler/channel-manager owns channel-domain events.
- EPG owns TV-visible guide events and error-boundary events.
- `src/types/app-errors.ts` is the canonical app-wide `AppErrorCode` source.

The plan keeps composition roots thin: `src/App.ts` and
`src/core/orchestrator/AppOrchestrator.ts` may receive import-only or
event-cleanup type edits, but they must not absorb event producer logic or
error taxonomy ownership.

## Required Reading

Read in this order before implementation:

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/cleanup-loop.md`
4. `ARCHITECTURE_CLEANUP_CHECKLIST.md`
   - DCR Operating Rules
   - full `DCR-3` section
   - `DCR-4` only as an out-of-scope guard
5. `docs/architecture/CURRENT_STATE.md`
6. `docs/api/plex-integration.md`
7. `docs/agentic/plan-authoring-standard.md`
8. `docs/agentic/codanna-playbook.md`
9. This plan.

If role routing is unclear, also read
`docs/agentic/session-prompts/README.md`.

## Required Skills

- `architecture-boundaries`
- `plex-integration-boundaries`
- `ui-composition-patterns`
- `verification-strategy`
- `execution-plan-authoring`

Use `ui-composition-patterns` only for preserving EPG/navigation listener,
focus, and hidden-state cleanup invariants. This plan does not approve visual,
layout, or EPG default changes.

## Codanna Discovery

Codanna was unavailable/insufficient in this planner runtime. The controller
reported no matching tools for
`Codanna semantic_search_with_context analyze_impact search_documents
find_symbol get_index_info`; local MCP resource and resource-template discovery
also returned no Codanna resources/templates, and no callable Codanna namespace
was exposed. Fallback discovery used targeted `rg` and direct reads, as required
by `docs/agentic/codanna-playbook.md`.

Fallback evidence:

- Direct reads covered the required workflow docs, DCR Operating Rules, full
  DCR-3 checklist entry, current architecture state, Plex integration API doc,
  plan authoring standard, Codanna playbook, and the relevant repo-local skill
  files.
- Direct source reads covered the listed DCR-3 source surfaces enough to confirm
  current event and error-import drift:
  `src/utils/EventEmitter.ts`, `src/utils/interfaces.ts`,
  navigation/player/Plex/library/stream/auth/discovery/channel-manager
  interfaces and implementations, EPG interfaces/component/error-boundary
  surfaces, `src/App.ts`, `src/core/orchestrator/AppOrchestrator.ts`,
  `src/types/app-errors.ts`, `src/modules/lifecycle/types.ts`, and
  lifecycle/error-recovery import surfaces.
- `rg -n "\\bon\\s*\\(|\\boff\\s*\\(|IDisposable|AppErrorCode|from ['\\\"].*app-errors|from ['\\\"].*error" ...`
  over the DCR-3 source scope showed `EventEmitter.on()` and
  `EventEmitter.once()` already return `IDisposable`, auth/discovery and
  channel-manager `on()` already return disposables, and navigation/player/Plex
  stream expose void `on()/off()` surfaces.
- Direct reads confirmed `EPGComponent`, `DeferredEPGComponent`, and
  `EPGErrorBoundary` inherit the canonical `EventEmitter` contract, while
  `src/modules/ui/epg/interfaces.ts` still declares `IEPGComponent.on()` as
  `void`. Adjacent tests and mocks may also need cleanup if they encode
  void-shaped `on()` surfaces.
- Direct reads confirmed `IPlexLibrary.on()` declares `void`, while
  `PlexLibrary.on()` returns `IDisposable`.
- `rg -n "from ['\\\"].*(plex/auth|plex/discovery|modules/lifecycle|lifecycle/types|types/app-errors)" ...`
  showed production `AppErrorCode` imports split between
  `src/types/app-errors.ts`, lifecycle facades, and Plex auth/discovery
  re-export surfaces.

If Codanna becomes available in the implementation session, rerun:

- `semantic_search_with_context` for
  `EventEmitter IDisposable navigation player Plex stream EPG on off`.
- `semantic_search_with_context` for
  `AppErrorCode lifecycle types app-errors Plex auth discovery`.
- `search_documents` for `DCR-3 Event Subscription AppErrorCode`.
- `analyze_impact` for `IEventEmitter`, `INavigationManager`,
  `IVideoPlayer`, `IPlexStreamResolver`, `IPlexLibrary`, and `AppErrorCode`.

Treat contradictory Codanna results as a freshness gate and replan if they show
new production callers, public package exports, or docs that invalidate the
decisions below.

## Impact Snapshot

Source-backed findings that shape the plan:

- `src/utils/EventEmitter.ts` implements the canonical subscription primitive:
  `on()` and `once()` return `IDisposable`; `off()` remains available for
  handler-identity cleanup.
- `src/utils/interfaces.ts` declares the same `IEventEmitter` contract.
- `INavigationManager`, `IVideoPlayer`, and `IPlexStreamResolver` declare void
  `on()` plus void `off()`, and their implementations call the shared emitter
  but discard the disposable.
- `IPlexLibrary.on()` declares `void`; `PlexLibrary.on()` already returns the
  shared disposable, so the interface is narrower than the implementation.
- Plex auth, Plex discovery, and channel-manager `on()` contracts already return
  disposables and do not expose `off()`. This is acceptable once the canonical
  rule is "`on()` returns disposable"; `off()` is optional for surfaces that
  already expose it.
- EPG classes inherit `EventEmitter`, so production EPG `on()` already returns
  a disposable. Tests and runtime adapters may still need type/mocking cleanup
  if they currently encode void `on()`.
- `docs/api/plex-integration.md` currently documents `IPlexLibrary.on()` and
  `IPlexStreamResolver.on()` as returning `void`; it must be refreshed if the
  public Plex contract changes as planned.
- `src/types/app-errors.ts` owns the actual `AppErrorCode` enum.
- `src/modules/lifecycle/types.ts` re-exports `AppErrorCode` from
  `src/types/app-errors.ts` and defines lifecycle-specific types such as
  `LifecycleAppError`.
- `src/App.ts`, `src/core/orchestrator/AppOrchestrator.ts`, and several Plex
  auth/discovery helpers import `AppErrorCode` from lifecycle facades, while
  player, Plex stream, Plex library, EPG, and error-taxonomy tests already use
  `src/types/app-errors.ts`.
- Several non-lifecycle production files import lifecycle-owned types such as
  `AppError`, `IAppLifecycle`, `AppPhase`, and `LifecycleAppError` from
  lifecycle surfaces. Those non-`AppErrorCode` imports are intentionally outside
  DCR-3-S3 unless the same import declaration also carries `AppErrorCode`.

## Files In Scope

- `src/utils/EventEmitter.ts`
- `src/utils/interfaces.ts`
- `src/utils/__tests__/EventEmitter.test.ts`
- `src/modules/navigation/interfaces.ts`
- `src/modules/navigation/NavigationManager.ts`
- `src/modules/navigation/NavigationCoordinator.ts`
- `src/modules/navigation/NavigationCoordinatorEventPort.ts`
- `src/modules/navigation/__tests__/NavigationManager.test.ts`
- `src/modules/navigation/__tests__/NavigationCoordinator.test.ts`
- `src/modules/player/interfaces.ts`
- `src/modules/player/VideoPlayer.ts`
- `src/modules/player/VideoPlayerEvents.ts`
- `src/modules/player/__tests__/VideoPlayerEvents.test.ts`
- `src/modules/player/__tests__/VideoPlayer.test.ts` only if the public
  `IVideoPlayer.on()` contract change requires existing player tests to compile
  or prove disposable cleanup.
- `src/modules/plex/stream/interfaces.ts`
- `src/modules/plex/stream/PlexStreamResolver.ts`
- `src/modules/plex/stream/__tests__/PlexStreamResolver.test.ts`
- `src/modules/plex/library/interfaces.ts`
- `src/modules/plex/library/PlexLibrary.ts`
- `src/modules/plex/library/__tests__/PlexLibrary.test.ts`
- `src/modules/plex/auth/interfaces.ts`
- `src/modules/plex/auth/index.ts`
- `src/modules/plex/auth/PlexAuth.ts`
- `src/modules/plex/auth/plexAuthTransport.ts`
- `src/modules/plex/auth/plexAuthPayloadParsers.ts`
- `src/modules/plex/auth/plexSwitchPayloadParser.ts`
- `src/modules/plex/auth/plexHomeUsersPayloadParser.ts`
- `src/modules/plex/auth/plexAuthErrors.ts`
- `src/modules/plex/discovery/interfaces.ts`
- `src/modules/plex/discovery/index.ts`
- `src/modules/plex/discovery/PlexServerDiscovery.ts`
- `src/modules/plex/discovery/PlexDiscoveryRequestExecutor.ts`
- `src/modules/plex/discovery/PlexDiscoveryResponsePolicy.ts`
- `src/modules/plex/discovery/PlexResourceDiscoveryRequestPolicy.ts`
- `src/modules/scheduler/channel-manager/interfaces.ts`
- `src/modules/scheduler/channel-manager/ChannelManager.ts`
- `src/modules/ui/epg/interfaces.ts`
- `src/modules/ui/epg/component/EPGComponent.ts`
- `src/modules/ui/epg/component/DeferredEPGComponent.ts`
- `src/modules/ui/epg/view/EPGErrorBoundary.ts`
- `src/modules/ui/epg/__tests__/EPGComponent.test.ts`
- `src/modules/ui/epg/__tests__/EPGErrorBoundary.test.ts`
- `src/modules/ui/epg/__tests__/DeferredEPGComponent.test.ts` only if its
  runtime mocks need to match the canonical disposable-return event surface.
- `src/App.ts`
- `src/core/orchestrator/AppOrchestrator.ts`
- `src/core/error-recovery/RecoveryActions.ts`
- `src/core/error-recovery/types.ts`
- `src/core/initialization/InitializationCoordinator.ts`
- `src/core/initialization/InitializationStartupPolicy.ts`
- `src/core/channel-tuning/ChannelTuningCoordinator.ts`
- `src/types/app-errors.ts`
- `docs/api/plex-integration.md` only for the Plex event API return contract.
- `docs/architecture/CURRENT_STATE.md` only if the implementation changes
  long-term ownership/API facts beyond the decisions already recorded here.
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` only for controller-owned closeout after
  implementation/review is clean.

## Files Out Of Scope

- `DCR-4` EPG defaults/constants files and any EPG row-height/default-config
  normalization.
- Unrelated behavior changes inside event producers.
- Broad `src/App.ts` or `src/core/orchestrator/AppOrchestrator.ts`
  decomposition beyond import/API normalization.
- Plex token/security behavior, URL construction, selected-server persistence,
  discovery fallback, stream policy, subtitle policy, and auth flow semantics.
- Broad lifecycle package redesign, removal of lifecycle-specific types, or
  repo-wide conversion of `AppError`, `IAppLifecycle`, `AppPhase`, or
  `LifecycleAppError` imports that do not include `AppErrorCode`.
- Repo-wide conversion of test imports unless required by touched production
  contract compilation.
- `docs/runs/**` and archived plans.

## Planner Self-Check

1. Unresolved architecture seam? No. The event seam is `on()` returns
   `IDisposable`; `off()` remains optional only on surfaces that already expose
   it. The error seam is direct `src/types/app-errors.ts` imports for
   `AppErrorCode` in non-lifecycle production modules.
2. Adjacent contract changes hidden out of scope? No. The event interfaces,
   implementations, tests, and Plex API doc surfaces that need type changes are
   in scope. Lifecycle-specific types remain in lifecycle scope.
3. Out-of-scope files implicitly required? No. Any need to widen into unrelated
   producer behavior, DCR-4 defaults, Plex token/security, or broad lifecycle
   redesign is a replan trigger.
4. Codanna evidence path recorded? Yes. Codanna was unavailable/insufficient,
   and targeted `rg`/direct-read fallback evidence is recorded.
5. Repo-preferred owner? Yes. Event cleanup stays with the shared event
   primitive plus module-owned interfaces; `AppErrorCode` imports point to the
   canonical shared type file instead of widening lifecycle facades.
6. Would a fresh session invent policy? No. DCR-3-D1 and DCR-3-D2 are resolved
   below, with explicit slice/wave and verification gates.
7. Execution-grade? Yes. Package issues map to slices, the ready execution unit
   is named, parallelism is constrained, and stop/replan triggers are explicit.

## Architecture Seam Decision Gate

Decision for `DCR-3-D1`: public event APIs must return `IDisposable` from
`on()`.

- `EventEmitter` and `IEventEmitter` remain canonical.
- Every public module event subscription method touched by DCR-3 must return
  `IDisposable` from `on()`.
- Existing `off()` methods may remain where already part of the public
  emitter-like surface (`navigation`, `player`, `Plex stream`, `Plex library`,
  and inherited EPG emitter surfaces), but cleanup ownership should prefer the
  returned disposable in new or changed code.
- Do not add `off()` to Plex auth, Plex discovery, or channel-manager solely for
  symmetry; they already satisfy the canonical disposable cleanup contract.
- Do not keep a module-boundary split where some public `on()` calls return
  `void`; that is the DCR-3 inconsistency being retired.
- Production behavior must remain unchanged: subscribing still registers one
  handler, `off()` still removes the handler where exposed, disposing removes
  the same handler, and listener errors remain isolated by `EventEmitter`.

Decision for `DCR-3-D2`: `src/types/app-errors.ts` is the canonical production
import source for `AppErrorCode`.

- Non-lifecycle production modules that need `AppErrorCode` should import it
  directly from `src/types/app-errors.ts` using the correct relative path.
- Lifecycle module files may continue to import/re-export lifecycle-specific
  types through lifecycle boundaries, because `LifecycleAppError`, `AppPhase`,
  `LifecycleEventMap`, and `IAppLifecycle` are lifecycle-owned contracts.
- `src/modules/lifecycle/types.ts` may keep its re-export of `AppErrorCode` as
  a lifecycle compatibility surface; do not make it the canonical production
  import path for non-lifecycle modules.
- Non-`AppErrorCode` imports such as `AppError`, `IAppLifecycle`, `AppPhase`,
  `LifecycleAppError`, and `LifecycleEventMap` may remain lifecycle imports in
  production modules. DCR-3 does not approve a repo-wide taxonomy import
  migration for those types.
- Remove or stop adding production re-exports of `AppErrorCode` from
  `AppOrchestrator`, Plex auth, and Plex discovery if they are only supporting
  drifted taxonomy imports. Keep `PlexApiError` exports intact.
- Tests may be updated only where touched contract compilation or import
  assertions require it; broad test import churn is not required for DCR-3.

S1/S2 execution decision:

- `DCR-3-S1` and `DCR-3-S2` must execute as one wave,
  `DCR-3-WAVE1`, because Plex library is not a separate policy decision; it is
  one instance of the shared public event contract. Reviewing it separately
  would leave the public event API halfway normalized.

S3 execution decision:

- `DCR-3-S3` can run separately after `DCR-3-WAVE1` because `AppErrorCode`
  import-source cleanup does not need to change event listener behavior. It
  must still use the DCR-3-D2 decision above and run after event API decisions
  are frozen so source audits can distinguish event-contract residue from
  error-code import residue.

Stop and replan if any of these are true:

- A public event contract change requires a broad caller rewrite outside the
  files in scope.
- A module cannot return `IDisposable` from `on()` without changing event
  delivery order, handler identity, or cleanup behavior.
- Existing docs or public API claims conflict with the event contract decision
  after source discovery and cannot be refreshed within the scoped docs.
- `AppErrorCode` import cleanup requires deleting lifecycle-owned types,
  migrating non-`AppErrorCode` lifecycle type imports, or changing lifecycle
  runtime behavior.
- Plex auth/discovery `AppErrorCode` re-export removal breaks public UI imports
  in a way that cannot be solved by direct `src/types/app-errors.ts` imports
  within this package scope.
- EPG/navigation changes require TV-visible focus, navigation, or layout
  behavior changes rather than type/cleanup contract normalization.
- Verification expands into manual webOS/device proof or new package ownership
  beyond UI/navigation/Orchestrator/Plex repo verification.

## Package Decomposition

package_id: `DCR-3`
checklist_token: `DCR-3`
package_issue_ids: `DCR-3-A1`, `DCR-3-A2`, `DCR-3-A3`, `DCR-3-D1`,
`DCR-3-D2`
ready_now_execution_unit: `DCR-3-WAVE1`
ready_now_slice: `DCR-3-S1`
recommended_slice_order: `DCR-3-S1`, `DCR-3-S2`, `DCR-3-S3`
parallel_execution_policy: serial waves only; parallel cleanup_worker execution
is not approved.

slice_table:

| slice_id | goal | areas/files | exact_issue_ids | verification | dependencies | stop_condition | handoff_condition | serial_only or parallel_group | parallel_justification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DCR-3-S1` | Normalize the shared event subscription contract so navigation, player, Plex stream, and EPG public interfaces expose `on()` as `IDisposable` while preserving existing `off()` behavior. | `src/utils/EventEmitter.ts`; `src/utils/interfaces.ts`; `src/utils/__tests__/EventEmitter.test.ts`; `src/modules/navigation/interfaces.ts`; `src/modules/navigation/NavigationManager.ts`; `src/modules/navigation/NavigationCoordinator.ts`; `src/modules/navigation/NavigationCoordinatorEventPort.ts`; navigation tests; `src/modules/player/interfaces.ts`; `src/modules/player/VideoPlayer.ts`; `src/modules/player/VideoPlayerEvents.ts`; player event tests; `src/modules/plex/stream/interfaces.ts`; `src/modules/plex/stream/PlexStreamResolver.ts`; stream tests; `src/modules/ui/epg/interfaces.ts`; `src/modules/ui/epg/component/EPGComponent.ts`; `src/modules/ui/epg/component/DeferredEPGComponent.ts`; `src/modules/ui/epg/view/EPGErrorBoundary.ts`; EPG tests and mocks. | `DCR-3-A1`, `DCR-3-D1` | Targeted EventEmitter, navigation, player, Plex stream, and EPG event tests; source audit for void `on()` in touched public surfaces including `IEPGComponent`; `npm run typecheck`; `npm run verify`. | None. | Replan if any event producer requires behavior changes, broad caller rewrites outside scope, or EPG/navigation focus/layout changes. | All DCR-3 public event surfaces outside Plex library either already return or now return `IDisposable`; existing `off()` behavior remains tested where exposed. | parallel_group: `DCR-3-WAVE1` | Shares the public event contract decision and docs/source audits with S2; must be reviewed as one coherent event API batch. |
| `DCR-3-S2` | Normalize Plex library subscription interface and Plex API docs to match the canonical disposable-return event contract. | `src/modules/plex/library/interfaces.ts`; `src/modules/plex/library/PlexLibrary.ts`; `src/modules/plex/library/__tests__/PlexLibrary.test.ts`; `docs/api/plex-integration.md` Plex library/stream event snippets. | `DCR-3-A2`, `DCR-3-D1` | Targeted Plex library tests for returned disposable cleanup; source audit that interface and implementation agree; docs audit for Plex `on()` return contracts; `npm run verify`; `npm run verify:docs` if docs are changed. | Same execution wave as S1. | Replan if Plex public docs require a module-boundary split or if cleanup requires changing Plex library fetch/cache behavior. | `IPlexLibrary.on()` returns `IDisposable`; implementation, tests, and Plex docs agree. | parallel_group: `DCR-3-WAVE1` | Plex library is one instance of the same event API decision; separate implementation would leave DCR-3-A1/A2 partially normalized. |
| `DCR-3-S3` | Normalize production `AppErrorCode` import sources to direct `src/types/app-errors.ts` imports while keeping non-`AppErrorCode` lifecycle-specific type imports with lifecycle owners. | `src/App.ts`; `src/core/orchestrator/AppOrchestrator.ts`; `src/core/error-recovery/RecoveryActions.ts`; `src/core/error-recovery/types.ts`; `src/core/initialization/InitializationCoordinator.ts`; `src/core/initialization/InitializationStartupPolicy.ts`; `src/core/channel-tuning/ChannelTuningCoordinator.ts`; Plex auth/discovery files listed in scope, including `src/modules/plex/auth/index.ts` and `src/modules/plex/discovery/index.ts`; affected tests only for compile/import updates; `docs/architecture/CURRENT_STATE.md` only if ownership docs change. | `DCR-3-A3`, `DCR-3-D2` | Parser-style source audit for production `AppErrorCode` imports/re-exports from lifecycle/Plex drifted paths and from Plex auth/discovery package indexes regardless of source; targeted error-recovery/orchestrator/Plex auth/discovery tests as touched; `npm run typecheck`; `npm run verify`; `npm run verify:docs` if docs are changed. | After `DCR-3-WAVE1` or after the event contract decision is reviewed clean. | Replan if direct `AppErrorCode` imports require lifecycle API deletion, broad public re-export migration outside scope, migration of non-`AppErrorCode` lifecycle types, or changes to Plex auth/discovery runtime behavior. | Non-lifecycle production modules in DCR-3 scope import `AppErrorCode` from `src/types/app-errors.ts`; Plex auth/discovery package indexes no longer re-export `AppErrorCode`; lifecycle-specific imports remain explicit. | serial_only | Error-code import cleanup is disjoint from event behavior but shares app/orchestrator/Plex verification, so it runs after the event wave with controller-owned integration. |

coverage_check:

| package_issue_id | planned disposition |
| --- | --- |
| `DCR-3-A1` | Retired by `DCR-3-S1`; no void-return public `on()` remains in DCR-3 event surfaces, including `IEPGComponent`, except source-disproved non-production mocks updated or documented in tests. |
| `DCR-3-A2` | Retired by `DCR-3-S2`; `IPlexLibrary.on()` matches implementation by returning `IDisposable`. |
| `DCR-3-A3` | Retired by `DCR-3-S3`; production `AppErrorCode` imports in DCR-3 scope use `src/types/app-errors.ts` directly unless lifecycle-owned types are being imported. |
| `DCR-3-D1` | Resolved by the canonical event rule: all public `on()` methods return `IDisposable`; `off()` remains optional where already exposed. |
| `DCR-3-D2` | Resolved by the canonical error-code import rule: `src/types/app-errors.ts` owns `AppErrorCode`; lifecycle facades remain valid for lifecycle-specific non-`AppErrorCode` types. |

execution_waves:

| wave_id | slice_ids | completion_condition | absorb_now_scope | replan_triggers |
| --- | --- | --- | --- | --- |
| `DCR-3-WAVE1` | `DCR-3-S1`, `DCR-3-S2` | Event contract is coherent across shared event utility, navigation, player, Plex stream/library, scheduler/channel-manager, auth/discovery, and EPG surfaces; targeted event/interface tests pass; source audits pass; Plex API docs are refreshed if changed; implementation review is clean. | Same event API owner, same files or same public event-interface seam, same verification envelope, and no new package membership. | Any stop condition from the seam gate; broad caller rewrites; behavior changes to event delivery; docs conflict that cannot be refreshed inside scope. |

coverage_ledger:

| package_issue_id | execution_unit | final owner |
| --- | --- | --- |
| `DCR-3-A1` | `DCR-3-WAVE1` | shared event/API contract owner plus module-specific event owners |
| `DCR-3-A2` | `DCR-3-WAVE1` | Plex library owner |
| `DCR-3-A3` | `DCR-3-S3` | app-wide error-code owner (`src/types/app-errors.ts`) plus caller module owners |
| `DCR-3-D1` | `DCR-3-WAVE1` | shared event/API contract owner |
| `DCR-3-D2` | `DCR-3-S3` | app-wide error-code owner |

No residual acceptance is planned. Any residual can be accepted only with
source-backed evidence, one owner, and a revisit trigger recorded before DCR-3
closeout.

## Verification Commands

Verification strategy classification: `new regression/contract test required`.

Primary verification mode: `contract-first`.

Why this depth matches the risk: DCR-3 changes shared/public TypeScript
contracts that govern listener cleanup and error taxonomy imports across UI,
navigation, Orchestrator, and Plex code. Existing tests cover behavior, but the
drift is a contract/API issue; implementation must add or tighten targeted
contract assertions where void-return APIs currently compile without proving
disposable cleanup.

Plan/doc verification after plan creation or refresh:

```bash
npm run plans:check
npm run verify:docs
```

Expected: both commands pass with this active plan satisfying the serious-plan
structure.

Execution-unit verification for `DCR-3-WAVE1`:

```bash
npm test -- --runInBand \
  src/utils/__tests__/EventEmitter.test.ts \
  src/modules/navigation/__tests__/NavigationManager.test.ts \
  src/modules/navigation/__tests__/NavigationCoordinator.test.ts \
  src/modules/player/__tests__/VideoPlayerEvents.test.ts \
  src/modules/player/__tests__/VideoPlayer.test.ts \
  src/modules/plex/stream/__tests__/PlexStreamResolver.test.ts \
  src/modules/plex/library/__tests__/PlexLibrary.test.ts \
  src/modules/ui/epg/__tests__/EPGComponent.test.ts \
  src/modules/ui/epg/__tests__/DeferredEPGComponent.test.ts \
  src/modules/ui/epg/__tests__/EPGErrorBoundary.test.ts

node --input-type=module <<'NODE'
import fs from 'node:fs';
import path from 'node:path';

const roots = [
  'src/modules/navigation',
  'src/modules/player',
  'src/modules/plex/stream',
  'src/modules/plex/library',
  'src/modules/ui/epg',
];
const files = [];
function walk(entry) {
  const stat = fs.statSync(entry);
  if (stat.isDirectory()) {
    if (entry.includes(`${path.sep}__tests__`)) return;
    for (const child of fs.readdirSync(entry)) walk(path.join(entry, child));
    return;
  }
  if (entry.endsWith('.ts')) files.push(entry);
}
for (const root of roots) walk(root);

const patterns = [
  /\bon\s*<[\s\S]*?>\s*\([\s\S]*?\)\s*:\s*void\s*[;{]/g,
  /\bon\s*\([\s\S]*?handler[\s\S]*?\)\s*:\s*void\s*[;{]/g,
];
const findings = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const line = text.slice(0, match.index).split('\n').length;
      findings.push(`${file}:${line}: ${match[0].replace(/\s+/g, ' ').slice(0, 160)}`);
    }
  }
}
if (findings.length) {
  console.error('Void-return public event on() surfaces remain:');
  console.error(findings.join('\n'));
  process.exit(1);
}
NODE

npm run typecheck
npm run verify
```

Expected:

- Targeted tests pass.
- Source audits show no public DCR-3 event `on()` surface still returning
  `void`, including multiline signatures such as `IEPGComponent.on()`,
  excluding false positives that the implementer records with exact file/symbol
  rationale.
- Typecheck and full verification pass.

Execution-unit verification for `DCR-3-S3`:

```bash
node --input-type=module <<'NODE'
import fs from 'node:fs';
import path from 'node:path';

const roots = ['src/App.ts', 'src/core', 'src/modules/plex'];
const files = [];
function walk(entry) {
  const stat = fs.statSync(entry);
  if (stat.isDirectory()) {
    if (entry.includes(`${path.sep}__tests__`)) return;
    for (const child of fs.readdirSync(entry)) walk(path.join(entry, child));
    return;
  }
  if (entry.endsWith('.ts')) files.push(entry);
}
for (const root of roots) walk(root);

const driftedSources = [
  /(^|\/)modules\/lifecycle(\/types)?$/,
  /(^|\/)lifecycle(\/types)?$/,
  /(^|\/)plex\/auth$/,
  /(^|\/)plex\/discovery$/,
];
const findings = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const isPlexPackageIndex =
    file === 'src/modules/plex/auth/index.ts' ||
    file === 'src/modules/plex/discovery/index.ts';
  const statements = text.split(';').map((statement) => `${statement};`);
  let offset = 0;
  for (const statement of statements) {
    const statementIndex = text.indexOf(statement.slice(0, Math.max(1, statement.length - 1)), offset);
    offset = statementIndex >= 0 ? statementIndex + statement.length : offset;
    if (!statement.includes('import') && !statement.includes('export')) continue;
    if (!statement.includes('AppErrorCode')) continue;
    if (isPlexPackageIndex && statement.includes('export')) {
      const line = text.slice(0, Math.max(0, statementIndex)).split('\n').length;
      findings.push(`${file}:${line}: ${statement.replace(/\s+/g, ' ').slice(0, 180)}`);
      continue;
    }
    const fromIndex = statement.lastIndexOf(' from ');
    if (fromIndex < 0) {
      if (statement.includes('export') &&
          (file.includes('src/core/orchestrator') ||
           file.includes('src/modules/plex/auth') ||
           file.includes('src/modules/plex/discovery'))) {
        const line = text.slice(0, Math.max(0, statementIndex)).split('\n').length;
        findings.push(`${file}:${line}: ${statement.replace(/\s+/g, ' ').slice(0, 180)}`);
      }
      continue;
    }
    const rest = statement.slice(fromIndex + 6).trim();
    const quote = rest[0];
    if (quote !== "'" && quote !== '"') continue;
    const end = rest.indexOf(quote, 1);
    if (end < 0) continue;
    const source = rest.slice(1, end);
    if (!driftedSources.some((pattern) => pattern.test(source))) continue;
    const line = text.slice(0, Math.max(0, statementIndex)).split('\n').length;
    findings.push(`${file}:${line}: ${statement.replace(/\s+/g, ' ').slice(0, 180)}`);
  }
}
if (findings.length) {
  console.error('Drifted production AppErrorCode imports/re-exports remain:');
  console.error(findings.join('\n'));
  process.exit(1);
}
NODE

npm test -- --runInBand \
  src/core/error-recovery/__tests__/RecoveryActions.test.ts \
  src/core/orchestrator/__tests__/OrchestratorRecoverableRuntimeReporter.test.ts \
  src/modules/plex/auth/__tests__/PlexAuth.test.ts \
  src/modules/plex/discovery/__tests__/PlexServerDiscovery.test.ts \
  src/modules/plex/discovery/__tests__/PlexDiscoveryResponsePolicy.test.ts \
  src/modules/plex/discovery/__tests__/PlexResourceDiscoveryRequestPolicy.test.ts

npm run typecheck
npm run verify
```

Expected:

- Production import audit catches multiline import/export declarations and
  shows no drifted `AppErrorCode` imports/re-exports in DCR-3 scope, excluding
  lifecycle-owned files or source-backed false positives recorded by the
  implementer. Non-`AppErrorCode` lifecycle type imports are allowed.
- Targeted tests pass for touched error-recovery, orchestrator, Plex auth, and
  discovery surfaces.
- Typecheck and full verification pass.

Closeout verification:

```bash
npm run verify
npm run verify:docs
```

Expected: source/test/docs verification passes after checklist/current-state/API
doc updates needed for DCR-3 closeout.

## Rollback Notes

- If event contract edits break callers, revert the smallest affected module
  event-interface/implementation/test batch and keep the source audit output
  that identified the incompatible caller. Replan before widening beyond the
  scoped files.
- If Plex docs are updated for disposable-return `on()` but implementation
  verification fails, revert the docs update together with the matching Plex
  interface change so docs do not lead source.
- If error import normalization breaks public exports used outside DCR-3 scope,
  restore the minimal export/import needed for compile stability and replan the
  DCR-3-D2 policy with exact caller evidence.
- Do not revert unrelated dirty-worktree files. Keep active plan-doc updates
  separate from implementation commits.

## Commit Checkpoints

- Plan artifact commit/checkpoint: this tracked plan only, after
  `npm run plans:check` and docs verification.
- Implementation checkpoint 1: `DCR-3-WAVE1` event API changes, targeted tests,
  and Plex API doc update if needed. Exclude active plan-progress edits from
  the implementation commit.
- Implementation checkpoint 2: `DCR-3-S3` `AppErrorCode` import normalization
  and targeted tests. Exclude active plan-progress edits from the implementation
  commit.
- Controller closeout checkpoint: checklist mini-record and any durable
  current-state/API doc updates after implementation and review are clean.

NEXT_SESSION_HANDOFF:

PLAN: `docs/plans/2026-04-29-dcr-3-event-subscription-error-import-coherence.md`
ARTIFACT: `ARCHITECTURE_CLEANUP_CHECKLIST.md` item `DCR-3`
FILES: DCR-3 files listed in the plan
MESSAGE: Review this active DCR-3 checklist-linked cleanup plan before
implementation. The ready execution unit is `DCR-3-WAVE1`, with
`ready_now_slice` `DCR-3-S1`. Do not implement until plan review has no
material findings.
