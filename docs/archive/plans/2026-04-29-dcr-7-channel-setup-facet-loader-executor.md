# DCR-7 Channel Setup Facet Loader/Executor Plan

**Plan Status:** archived
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

## Goal

Create an execution-ready cleanup plan for `ARCHITECTURE_CLEANUP_CHECKLIST.md`
item `DCR-7`: Channel Setup Facet Loader/Executor Confidence And
Abstraction.

The package retires the current risk around channel setup facet loading by:

- consolidating duplicated facet-planning fixtures before adding substantial
  new tests
- freezing and testing the loader cache, invalidation, cacheability, progress,
  waiter, and in-flight concurrency contract
- narrowing or explicitly justifying the executor options port without changing
  runtime behavior by accident

The repo-preferred owner is the core channel setup planning owner. The plan must
not widen UI, Plex library, parser/request, token/security, request-intent, or
channel persistence contracts.

## Non-Goals

- Do not reopen `DCR-2` selected-server persistence or UI runtime result-shape
  work.
- Do not change broad Plex library parser/request policy, token/security
  behavior, request intent semantics, or `IPlexLibrary` APIs.
- Do not change setup build/commit persistence unless a targeted DCR-7 test
  proves a direct dependency and a replan approves it.
- Do not add a broad channel setup test dumping-ground helper.
- Do not hide required executor state/control callbacks behind an opaque
  "context" object unless the contract is still readable, typed, and behavior
  preserving.
- Do not bundle active `docs/plans/*` edits into implementation checkpoint
  commits.

## Parent Priority Alignment

`DCR-7` is a checklist-linked cleanup package in the DCR series. It follows the
completed `DCR-2` channel setup UI/core contract work and must preserve the
failure semantics established there:

- collection and playlist failures remain partial-warning enrichment failures
- enabled native tag directory/count failures remain blocking or slow
  planning-boundary failures

`docs/architecture/CURRENT_STATE.md` currently names
`src/core/channel-setup/planning/ChannelSetupPlanningService.ts` as the owner for
plan/review composition and records `ChannelSetupFacetSnapshotLoader` as its
internal facet-snapshot collaborator. This package strengthens that owner
instead of pushing planning policy into UI or Plex transport layers.

## Required Reading

Fresh sessions must read these before implementation, in order:

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/cleanup-loop.md`
4. `ARCHITECTURE_CLEANUP_CHECKLIST.md` `DCR-7` entry, plus `DCR-2` evidence if
   failure semantics are touched
5. this plan
6. `docs/agentic/plan-authoring-standard.md`
7. `docs/agentic/codanna-playbook.md`
8. `docs/architecture/CURRENT_STATE.md` channel setup planning lines
9. `docs/api/plex-integration.md` `IPlexLibrary` library access contract
10. DCR-7 source/test files named in `## Files In Scope`

Freshness gate: if any referenced file, checklist status, current-state claim,
or Plex library contract changed materially after this plan was written, update
this plan before implementation continues.

## Required Skills

- `architecture-boundaries`: keep channel setup planning ownership explicit and
  avoid growing UI/composition roots.
- `plex-integration-boundaries`: preserve Plex library contract, token, parser,
  request-intent, and request-policy boundaries.
- `verification-strategy`: use contract-first tests for behavior seams and
  broader repo verification for Plex/channel setup risk.
- `execution-plan-authoring`: keep this tracked plan decision-complete without
  turning it into patch prose.

## Codanna Discovery

- `get_index_info`: Codanna was available at `/Users/tristan/.cargo/bin/codanna`;
  index snapshot reported `13525` symbols, `793` files, semantic search enabled
  with `519` embeddings, updated about `18 minutes` before discovery.
- `semantic_search_with_context` query
  `ChannelSetupFacetSnapshotLoader cache progress concurrent waiters`: returned
  `8` low-relevance/noisy hits, mostly outside channel setup. This was
  insufficient for the cache seam, so exact symbol lookup and direct reads were
  used.
- `find_symbol ChannelSetupFacetSnapshotLoader`: found symbol `10337` in
  `src/core/channel-setup/planning/ChannelSetupFacetSnapshotLoader.ts`, with
  public `invalidate()` and `loadSnapshot()` plus private cache/waiter helpers.
- `find_symbol ChannelSetupFacetSnapshotLoadSession`: found symbol `10406` in
  `src/core/channel-setup/planning/ChannelSetupFacetSnapshotLoadSession.ts`.
- `find_symbol ChannelSetupFacetLibraryExecutor`: found symbol `10446` in
  `src/core/channel-setup/planning/ChannelSetupFacetLibraryExecutor.ts`.
- `analyze_impact symbol_id:10337`: reported one impacted symbol,
  `ChannelSetupPlanningService`.
- `analyze_impact symbol_id:10406` and `symbol_id:10446`: reported no additional
  impacted symbols. Direct source review still shows `ChannelSetupFacetSnapshotLoadSession`
  instantiates `ChannelSetupFacetLibraryExecutor`.
- `search_symbols query:"ChannelSetupFacetSnapshot"`: confirmed the related
  loader wait options, inflight load, snapshot data, and snapshot result types in
  DCR-7 planning files.
- `search_documents query:"DCR-7 Channel Setup Facet Loader Executor"` and
  `query:"ChannelSetupFacetSnapshotLoader CURRENT_STATE Plex planning"`:
  returned noisy/stale-plan-heavy results and one useful Plex API hit, but not a
  precise DCR-7/current-state answer. Fallback direct reads were used for the
  mandated checklist/current-state/API lines.
- Direct fallback reads: `ARCHITECTURE_CLEANUP_CHECKLIST.md` `DCR-2` and
  `DCR-7` entries; `docs/architecture/CURRENT_STATE.md` channel setup planning
  lines; `docs/api/plex-integration.md` `IPlexLibrary` library access contract;
  DCR-7 files listed below.

## Impact Snapshot

Primary execution owners:

- loader contract:
  `src/core/channel-setup/planning/ChannelSetupFacetSnapshotLoader.ts`
- load session and failure/progress forwarding:
  `src/core/channel-setup/planning/ChannelSetupFacetSnapshotLoadSession.ts`
- library executor options and native facet execution:
  `src/core/channel-setup/planning/ChannelSetupFacetLibraryExecutor.ts`
- snapshot/request-intent/result types:
  `src/core/channel-setup/planning/ChannelSetupPlanningTypes.ts`
- count recovery abort/failure support:
  `src/core/channel-setup/planning/ChannelSetupFacetCountRecoveryWorker.ts`

Observed source contract to preserve unless the plan is revised:

- cache key includes `serverId`, sorted selected library ids, enabled facet
  families, and planning intent
- cached snapshots are returned only after checking the caller signal for
  already-aborted state
- cacheability is currently: clean `ready` snapshots cache; `ready` snapshots
  with transient load failures do not cache; `blocked`/`slow` snapshots cache
  only for `failureReason` `unsupported` or `empty`; timeout/error snapshots do
  not cache
- `invalidate()` clears the single-entry cache, aborts all in-flight snapshot
  controllers, clears waiters, and removes in-flight loads
- same-key concurrent callers share one in-flight load
- different-key in-flight loads coexist; starting a newer key does not abort an
  older different-key load
- in-flight progress stores the last progress event and replays it only to
  later in-flight waiters with `reportProgress`
- waiter abort detaches that waiter's progress callback and rejects that waiter;
  it does not abort the shared in-flight load by itself
- callers without `reportProgress` use detached snapshot work in
  `ChannelSetupPlanningService`; callers with `reportProgress` remain attached
  and can convert their own cancellation into a canceled build result
- collection/playlist failures add warnings and continue; native tag directory
  and count failures return `blocked` or `slow` snapshots

Existing test shape:

- DCR-7 fixture duplication exists across
  `ChannelSetupFacetSnapshotLoader.test.ts`,
  `ChannelSetupFacetSnapshotLoadSession.test.ts`, and
  `ChannelSetupPlanningService.test.ts` (`createConfig`/`createLibrary` or
  `makeLibrary`/`makeTag`/`createDeferred`/mock `IPlexLibrary` patterns).
- Some cache/concurrency behavior is already covered in
  `ChannelSetupPlanningService.test.ts`, including clean ready caching,
  unsupported caching, timeout non-caching, transient playlist non-caching,
  invalidation aborting detached loads, stale progress after invalidation, and
  build cancellation while sharing preview-started inflight work.
- Missing confidence remains around lower-level loader cache hit, invalidation,
  cacheability, progress replay, concurrent waiters, waiter abort/detach, and
  in-flight failure/cancellation as direct loader/session contracts.

## Files In Scope

- `src/core/channel-setup/planning/ChannelSetupFacetSnapshotLoader.ts`
- `src/core/channel-setup/planning/ChannelSetupFacetLibraryExecutor.ts`
- `src/core/channel-setup/planning/ChannelSetupFacetSnapshotLoadSession.ts`
- `src/core/channel-setup/planning/ChannelSetupFacetCountRecoveryWorker.ts`
- `src/core/channel-setup/planning/ChannelSetupPlanningTypes.ts`
- `src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoader.test.ts`
- `src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoadSession.test.ts`
- `src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts`
- small typed helper files under `src/core/channel-setup/__tests__/`, only if
  they are facet-planning-owned and only after S1 freezes ownership

## Files Out Of Scope

- `src/modules/ui/channel-setup/*`, except source reading if a replan proves the
  DCR-7 contract cannot be tested without it
- `src/core/app-shell/*`
- broad Plex library implementation files under `src/modules/plex/library/*`
- Plex auth/discovery/stream/parser/request-policy files
- setup build/commit persistence files
- checklist/current-state/API docs, unless implementation changes ownership,
  public contracts, or checklist status
- unrelated channel setup tests outside the DCR-7 files list

## Planner Self-Check

1. No unresolved architecture seam is hidden in the first execution unit: S1 is
   test-helper ownership only.
2. S2 has a frozen behavior contract below; if source review disproves any item,
   the implementer must record the specific source-disproved item before adding
   tests.
3. S3 is explicitly after S1 and cannot change runtime behavior unless a replan
   changes and verifies the contract.
4. Out-of-scope files are frozen unless a replan trigger fires. The plan does
   not depend on UI, app-shell, or Plex library contract edits.
5. Codanna evidence and deterministic fallback reads are recorded above.
6. The owner remains core channel setup planning; the plan does not grow UI or
   Plex transport layers.
7. A fresh session should not need to invent package membership, slice order,
   DCR-2 failure semantics, Plex boundaries, DCR-7-D1 behavior expectations, or
   verification depth.

## Architecture Seam Decision Gate

Chosen seam: DCR-7 work stays inside core channel setup planning's facet
snapshot loader/session/executor boundary. The loader owns cache, in-flight
sharing, progress replay, and waiter detach behavior. The load session owns
selected-library queueing, failure-state aggregation, and progress forwarding.
The library executor owns per-library facet execution and native tag/count
failure conversion, but not Plex transport policy.

DCR-7-D1 frozen contract before S2:

- cache hit: same cache key returns the cached snapshot after rejecting
  already-aborted callers; no Plex calls or progress replay are required for a
  cached hit
- invalidation: `invalidate()` clears cached state, aborts all active snapshot
  controllers, clears all waiters, and prevents stale progress from invalidated
  loads reaching later loads
- cacheability: clean `ready`, `unsupported`, and `empty` snapshots are
  cacheable; `ready` snapshots with transient enrichment failures,
  `timeout`/`error` slow or blocked snapshots, rejected in-flight loads, and
  caller cancellations are not cacheable
- progress replay: progress is replayed only for waiters joining an existing
  in-flight load after at least one progress event; cached hits do not replay
  progress by default
- concurrent waiters: same-key callers share one in-flight load and all active
  waiters receive subsequent progress
- waiter abort/detach: aborting one waiter rejects that waiter with an
  `AbortError` using the last observed task when available, removes that waiter
  from progress delivery, and does not abort the shared load or other waiters
- in-flight failure/cancellation: source failures reject/resolve all active
  waiters consistently and clear the in-flight entry; a caller abort rejects only
  that caller unless the source request signal itself is attached and aborted;
  explicit invalidation is the operation that aborts all in-flight loads

If any bullet is source-disproved during S2 implementation, the worker must
either test the actual source contract and record the source-disproved item in
handoff, or stop for replan if the actual behavior conflicts with DCR-2 failure
semantics, Plex boundaries, or user-visible runtime behavior.

Executor options gate for S3:

- Narrowing may group callbacks by real ownership only when it improves
  readability and preserves explicit state/control responsibilities.
- Required callbacks such as cancellation checks, failure-stop checks, progress
  reporting, partial-warning recording, map writes, timing updates, and failure
  builders must remain visible and typed.
- Runtime behavior must remain unchanged unless this plan is revised to name the
  changed contract and verification.

Stop/replan triggers:

- cache semantics conflict with DCR-2 failure semantics
- tests reveal a production behavior bug outside the planning owner
- port narrowing requires Plex library contract changes
- implementation would change parser/request policy, token/security behavior,
  request intent semantics, or broad Plex library APIs
- S1 helper consolidation needs a broad shared test utility outside facet
  planning ownership
- S2 requires changes outside DCR-7 files to prove loader behavior
- S3 cannot narrow or justify executor options without hiding required state or
  control callbacks
- any source review shows collection/playlist failures would stop being
  partial-warning enrichment failures
- any source review shows enabled native tag directory/count failures would stop
  being blocking or slow planning-boundary failures
- verification requires materially broader commands than this plan lists
- package issue coverage or final-owner accounting changes

## Package Decomposition

`package_id`: `DCR-7`

`checklist_token`: `DCR-7`

`package_issue_ids`:

- `DCR-7-A1`
- `DCR-7-A2`
- `DCR-7-A3`
- `DCR-7-D1`

`slice_table`:

| slice_id | goal | areas/files | exact_issue_ids | verification | dependencies | stop_condition | handoff_condition | serial_only or parallel_group | parallel_justification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DCR-7-S1` | Consolidate fixture/test utility ownership before adding substantial tests. | `src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoader.test.ts`, `src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoadSession.test.ts`, `src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts`, small typed facet-planning-owned helper file under `src/core/channel-setup/__tests__/` if justified. | `DCR-7-A2` | `npm test -- --runInBand src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoader.test.ts src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoadSession.test.ts src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts` | none; serial first | helper becomes broad dumping ground, requires non-DCR test owners, or changes test behavior instead of reducing duplication | duplicated fixture ownership reduced or one small owner/revisit trigger recorded; targeted tests pass | `serial_only` | Must run first to avoid copying current duplicated fixtures into new S2 tests. |
| `DCR-7-S2` | Add/fill loader cache, invalidation, cacheability, progress replay, concurrent waiter, waiter abort/detach, and in-flight failure/cancellation contract tests. | `src/core/channel-setup/planning/ChannelSetupFacetSnapshotLoader.ts`, `src/core/channel-setup/planning/ChannelSetupFacetSnapshotLoadSession.ts`, `src/core/channel-setup/planning/ChannelSetupPlanningTypes.ts`, `src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoader.test.ts`, `src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoadSession.test.ts`, `src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts`, S1 helper. | `DCR-7-A1`, `DCR-7-D1` | `npm test -- --runInBand src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoader.test.ts src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoadSession.test.ts src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts` | after S1 and after DCR-7-D1 source confirmation | frozen DCR-7-D1 contract conflicts with source in a way that changes runtime behavior, DCR-2 semantics, or Plex boundary | every DCR-7-D1 bullet is tested, source-disproved with owner/revisit trigger, or explicitly out-of-contract with final owner | `parallel_group: after-S1-disjoint-candidate` | May run in parallel with S3 only if source review proves disjoint writes, disjoint verification, and controller-owned integration gate. |
| `DCR-7-S3` | Narrow or justify `ChannelSetupFacetLibraryExecutorOptions` ownership/readability without changing runtime behavior. | `src/core/channel-setup/planning/ChannelSetupFacetLibraryExecutor.ts`, `src/core/channel-setup/planning/ChannelSetupFacetSnapshotLoadSession.ts`, `src/core/channel-setup/planning/ChannelSetupFacetCountRecoveryWorker.ts` only if type ownership requires it, `src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoadSession.test.ts`, `src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts`, S1 helper. | `DCR-7-A3` | `npm test -- --runInBand src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoadSession.test.ts src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts` plus `npm run typecheck` if types change | after S1; parallel with S2 only after disjointness proof | narrowing hides required callbacks, changes runtime behavior, or requires Plex library contract changes | options port is narrower or explicitly justified in implementation handoff; targeted tests and typecheck pass when applicable | `parallel_group: after-S1-disjoint-candidate` | Source review suggests S3 writes executor/session/type surfaces while S2 writes loader/session/tests; parallelism is not approved until the controller confirms write and verification disjointness. |

`coverage_check`:

- `DCR-7-A1` -> `DCR-7-S2`
- `DCR-7-A2` -> `DCR-7-S1`
- `DCR-7-A3` -> `DCR-7-S3`
- `DCR-7-D1` -> `DCR-7-S2`

`ready_now_slice`: `DCR-7-S1`

`ready_now_execution_unit`: `DCR-7-S1`

`recommended_slice_order`:

1. `DCR-7-S1`
2. `DCR-7-S2`
3. `DCR-7-S3`

`parallel_execution_policy`: No parallel execution is ready now. `DCR-7-S1`
is serial first. After S1, S2 and S3 may run in parallel only if a controller
source review proves disjoint writes, disjoint verification, and a
controller-owned integration gate. Otherwise run S2 before S3 because S2 owns
the DCR-7-D1 contract tests that define the loader/executor confidence target.

## Verification Commands

Verification strategy: `new regression/contract test required`.

This package changes or adds protection around a shared planning contract.
Existing tests prove parts of the behavior, but DCR-7 explicitly exists because
direct loader/executor cache, progress, and concurrency confidence is
incomplete. New or tightened targeted contract tests are required.

Planner verification after creating or revising this active plan:

```sh
npm run plans:check
```

Expected result: the active plan conforms to the serious tracked plan standard.

Per-unit implementation verification:

```sh
npm test -- --runInBand src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoader.test.ts src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoadSession.test.ts src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts
```

Expected result: targeted channel setup planning/facet tests pass after S1 and
S2.

```sh
npm test -- --runInBand src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoadSession.test.ts src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts
```

Expected result: targeted executor/session planning tests pass after S3.

```sh
npm run typecheck
```

Expected result: TypeScript passes when S3 narrows/types executor options or
when any source type surface changes.

Full implementation verification:

```sh
npm run verify
```

Expected result: full UI/navigation/Orchestrator/Plex-safe repo gate passes
before DCR-7 closeout.

Docs/reference verification, required if checklist/current-state/API/reference
docs/tracked plan references change:

```sh
npm run verify:docs
```

Expected result: docs/control-plane verification passes. If only active local
plan churn is present during implementation, `npm run verify:docs:workspace`
may be used as a provisional workspace check, but it does not replace
`npm run verify:docs` before closeout when tracked references change.

## Rollback Notes

- For S1, rollback is limited to reverting the test-helper extraction and
  restoring tests to their previous local fixtures.
- For S2, rollback any behavior changes separately from tests. If tests expose a
  true production bug, stop and replan instead of silently deleting the failing
  tests.
- For S3, prefer reverting the executor options shape change if readability or
  behavior parity is not clearly improved. Do not leave compatibility aliases or
  temporary adapters behind.
- If Plex library contract or DCR-2 failure semantics are touched, rollback and
  replan before continuing DCR-7.

## Commit Checkpoints

Substantive source/test implementation changes must be committed as focused
non-interactive implementation checkpoints after targeted verification passes
and before implementation handoff.

Implementation commits must exclude active `docs/plans/*` files. If this plan
needs progress updates, the controller should handle them separately from the
worker's implementation commit.
