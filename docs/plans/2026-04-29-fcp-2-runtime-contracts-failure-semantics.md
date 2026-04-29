# FCP-2 Runtime Contracts And Failure Semantics Plan

**Plan Status:** completed
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

## Goal

Resolve `FCP-2-SF1` from [the FCP-2 runtime-contract audit](./2026-04-29-fcp-2-runtime-contracts-failure-semantics-audit.md) by making ChannelManager authoring-time content-resolution failures consistent with the resolver’s existing runtime contract.

The approved package is limited to channel create/update failure semantics. It should preserve source-backed graceful fallback for deleted/empty content sources while making non-fallback content-resolution failures caller-visible and preventing failed content-affecting updates from publishing inconsistent channel state.

## Non-Goals

- Do not change Plex auth, discovery, library, stream, or payload parsing contracts.
- Do not introduce a new Result/DTO pattern for ChannelManager unless implementation proves throwing the existing typed errors cannot satisfy the contract.
- Do not change UI, AppOrchestrator, startup routing, channel tuning, player playback, export semantics, or storage persistence policy.
- Preserve the existing `importChannels()` structured `ImportResult` contract: if `createChannel()` starts propagating non-fallback content-resolution failures, imported records that hit those failures should be skipped with an error entry instead of silently importing an unresolved/empty channel.
- Do not convert best-effort teardown, diagnostics, debug probes, or non-critical storage writes into blocking failures.
- Do not close FCP-2 in `ARCHITECTURE_CLEANUP_CHECKLIST.md` until implementation, verification, and adversarial review are complete.

## Parent Priority Alignment

This plan is for `ARCHITECTURE_CLEANUP_CHECKLIST.md` item `FCP-2` Runtime Contracts And Failure Semantics.

FCP-2 requires a fresh repo-wide/source-backed audit and a coherent package, not detector-shaped fixes. The selected package is source finding `FCP-2-SF1`: ChannelManager create/update currently collapse distinct content-resolution failures into successful mutations, while refresh and the internal resolver already expose typed failure semantics.

This plan is intended to close all currently audited FCP-2 source findings after its ready execution unit is implemented, reviewed, and verified. FCP-2 closeout remains pending until the Priority-Exit Readiness section is satisfied.

## Required Reading

- `AGENTS.md`
- `docs/AGENTIC_DEV_WORKFLOW.md`
- `docs/agentic/session-prompts/cleanup-loop.md`
- `ARCHITECTURE_CLEANUP_CHECKLIST.md`, especially FCP rules and the FCP-2 mini-record
- `docs/agentic/plan-authoring-standard.md`
- `docs/architecture/CURRENT_STATE.md`
- `docs/architecture/modules.md`
- `docs/agentic/codanna-playbook.md`
- `docs/api/plex-integration.md`
- `docs/plans/2026-04-29-fcp-2-runtime-contracts-failure-semantics-audit.md`
- `src/modules/scheduler/channel-manager/ChannelManager.ts`
- `src/modules/scheduler/channel-manager/interfaces.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts`

## Required Skills

- `execution-plan-authoring`: plan must follow the Universal Plan Core plus cleanup/FCP overlays.
- `verification-strategy`: verification mode is contract/regression-first, with source audits plus runtime verification.
- `architecture-boundaries`: ChannelManager remains the scheduler/channel-manager owner; no ownership expansion.
- `persistence-boundaries`: storage failures stay within existing persistence owners and are not part of this package.
- `plex-integration-boundaries`: Plex modules are source context only; this package consumes existing Plex/channel error semantics rather than changing them.

## Codanna Discovery

Codanna MCP tools were not exposed to the controller, so CLI `codanna mcp` was used.

- `/Users/tristan/.cargo/bin/codanna mcp get_index_info`
  - 11128 symbols, 696 files, 4163 relationships.
  - Semantic search enabled with `AllMiniLML6V2`; 42 embeddings; index updated about 3 hours before planning.
- Broad semantic searches for runtime contracts, Plex failures, and scheduler persistence were weak/noisy. They pointed toward Plex, AppOrchestrator, and ChannelManager surfaces but were not proof-grade.
- `search_documents query:"FCP-2 runtime contracts failure semantics"` returned relevant planning-standard and prior-plan snippets, with Tantivy `LockBusy` auto-sync warnings. Used as orientation only.
- `search_symbols query:ChannelManager kind:class` found `ChannelManager` in `src/modules/scheduler/channel-manager/ChannelManager.ts` at line 238.
- `search_symbols query:createChannel kind:method` found `createChannel` in `ChannelManager.ts` at line 451.
- `search_symbols query:resolveChannelContent kind:method` found `resolveChannelContent` in `ChannelManager.ts` at line 682.
- `analyze_impact ChannelManager` returned 0 impacted symbols and `analyze_impact symbol_id:13187` returned an irrelevant impacted symbol. These impact results were treated as insufficient.

Deterministic fallback was `rg` plus direct source reads across runtime owners. The selected package is based on direct source evidence in `ChannelManager.ts`, `interfaces.ts`, and `ChannelManager.test.ts`.

## Impact Snapshot

`createChannel` and `updateChannel` are public ChannelManager authoring APIs. Their current implementation catches all content-resolution failures after mutating state:

- `createChannel` inserts a channel, catches failed initial resolution, logs, persists, emits `channelCreated`, and returns success.
- `updateChannel` mutates state, deletes resolved-content cache for content-affecting updates, catches failed resolution, logs, persists, emits `channelUpdated`, and returns success.
- `importChannels` calls `createChannel` for each imported record and already catches per-record failures into `ImportResult.errors`/`skippedCount`.

The same resolver path already has narrower semantics: cache fallback for network/content-unavailable cases, non-recoverable propagation for `ACCESS_DENIED`, and rethrow for non-fallback errors. Implementation should align authoring-time create/update behavior with that existing contract.

Import behavior is intentionally part of the package decision: non-fallback resolution failures during import should no longer create unresolved channels. They should use the existing skipped-import path with a structured error entry. Export behavior remains out of scope.

The blast radius is scheduler/channel-manager only. Plex modules provide existing error codes and should not change. Startup/channel-tuning/player behavior should observe the corrected ChannelManager contract through existing error handling rather than receiving direct edits.

## Files In Scope

- `src/modules/scheduler/channel-manager/ChannelManager.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts`
- `src/modules/scheduler/channel-manager/interfaces.ts` only for public contract comments if implementation changes or clarifies throw/fallback behavior
- `docs/plans/2026-04-29-fcp-2-runtime-contracts-failure-semantics-audit.md` only if source findings or accepted areas need correction during implementation
- `docs/plans/2026-04-29-fcp-2-runtime-contracts-failure-semantics.md` only for plan status notes during closeout

## Files Out Of Scope

- `src/modules/plex/**`
- `src/core/orchestrator/AppOrchestrator.ts`
- `src/core/initialization/**`
- `src/core/channel-tuning/**`
- `src/modules/player/**`
- `src/App.tsx` and UI screens/components
- `src/utils/storage.ts`
- `src/modules/scheduler/channel-manager/ChannelPersistenceStore.ts`
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` until verified closeout state is ready

## Planner Self-Check

- Source-backed? Yes. `FCP-2-SF1` is based on direct reads of `ChannelManager.ts`, `interfaces.ts`, and existing tests.
- One coherent package? Yes. The package is ChannelManager authoring content-resolution failure semantics.
- Owner clear? Yes. Scheduler/channel-manager owns channel CRUD and content-resolution cache mutation.
- No detector-shaped split? Yes. The plan does not split create/update into separate cleanup packages because they share the same contract.
- Public behavior named? Yes. Non-fallback authoring failures must become caller-visible; deleted/empty content fallback remains graceful.
- Verification mode chosen before freeze? Yes. Contract/regression-first targeted unit tests plus source audits and `npm run verify`.
- Implementation scope bounded? Yes. Plex, startup, tuning, player, UI, and persistence owners are out of scope unless a stop/replan trigger fires.

## Architecture Seam Decision Gate

The seam is the ChannelManager public authoring contract. Implementation should prefer a small internal helper or local classification inside `ChannelManager.ts` that reuses existing `ChannelError`/`AppErrorCode` semantics from `_resolveContentInternal`.

Preserve these boundaries:

- ChannelManager may classify whether a resolution failure is allowed to fall back during create/update.
- Plex modules must remain unchanged; do not reinterpret transport/auth payloads at the Plex layer.
- Storage persistence remains best-effort/typed according to existing repository/store contracts.
- UI and orchestrator behavior should rely on the existing global/handled error flow.

Stop and replan if:

- Correctness requires changing Plex library/auth/discovery/stream error taxonomy.
- Correctness requires a new public `createChannel` or `updateChannel` Result DTO instead of throwing existing typed errors.
- Tests show downstream callers intentionally depend on successful create/update for auth/access/parse/server failures.
- Import behavior cannot be preserved as structured skipped-record `ImportResult` errors when `createChannel()` propagates non-fallback content-resolution failures.
- Fixing update consistency requires a broader transactional channel-authoring abstraction across UI/orchestrator/import paths.
- Implementation needs to alter startup, channel tuning, player playback, or persistence storage policy.

## Package Decomposition

`package_id`: `FCP-2-RUNTIME-CONTRACTS-CHANNEL-AUTHORING-CONTENT-FAILURES`

`checklist_token`: `FCP-2`

`source_finding_ids`: `FCP-2-SF1`

`slice_table`:

| slice_id | goal | areas/files | source_finding_ids | verification | dependencies | stop_condition | handoff_condition | serial_only/parallel_group | parallel_justification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FCP-2-S1` | Align `createChannel`/`updateChannel` authoring failure semantics with `_resolveContentInternal`: preserve deleted/empty-source graceful fallback, propagate non-fallback failures, avoid publishing inconsistent update state/cache on failed content-affecting updates, and route import-time non-fallback failures through skipped-import `ImportResult` errors. | `ChannelManager.ts`, `ChannelManager.test.ts`, optional `interfaces.ts` comment clarification | `FCP-2-SF1` | Targeted ChannelManager/import contract tests; focused `rg` source audit; `npm run verify`; `npm run verify:docs` if docs/checklist references change | Existing resolver error taxonomy and ChannelManager test harness | Any architecture seam decision gate trigger fires | Tests prove preserved 404/deleted-source fallback, caller-visible auth/access/parse/server/non-fallback failures for create/update, and skipped import records for non-fallback create failures; no out-of-scope owner edits | `serial_only` | Single owner, shared tests, and mutation/cache semantics must be reasoned about together. |

`coverage_check`: `FCP-2-SF1` maps completely to `FCP-2-S1`. Audit accepted/no-action areas are not implementation slices. There are no deferred source findings in this plan.

`ready_now_slice`: `FCP-2-S1`

`ready_now_execution_unit`: `FCP-2-S1` is the only approved implementation unit. It is a single-slice unit and should be executed by one worker/session.

`recommended_slice_order`: `FCP-2-S1` only.

`parallel_execution_policy`: Do not authorize parallel `cleanup_worker` execution for this package. The create/update behavior, cache mutation, and tests are coupled enough that parallel work would add coordination risk without reducing verification scope.

## Verification Commands

Verification mode: contract/regression-first runtime verification.

Plan classification: `new regression/contract test required`.

Before implementation, add or update targeted tests that fail on the current behavior and pass only when the authoring contract is corrected. At minimum, cover:

- `createChannel` preserves graceful deleted/empty-source fallback already represented by the existing 404-style test.
- `createChannel` propagates non-fallback failures such as `ACCESS_DENIED` and does not emit/persist a successful channel mutation for that failure.
- `updateChannel` propagates non-fallback failures for content-affecting updates and does not delete usable cached content or publish a partially updated channel state for that failure.
- `importChannels` treats imported records whose `createChannel` path hits a non-fallback content-resolution failure as skipped imports with an `ImportResult.errors` entry, not as successfully imported unresolved channels.
- Existing `refreshChannelContent` access-denied behavior still passes.

Run:

```sh
npm run test:unit -- src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts
```

Expected outcome: targeted tests pass, including new or updated assertions for preserved deleted-source fallback, caller-visible create/update non-fallback failures, update state/cache consistency, import skipped-record behavior, and unchanged refresh access-denied propagation.

Focused source audits:

```sh
rg -n "Failed initial content resolution|Failed content resolution during update|Access denied resolving channel content|CONTENT_UNAVAILABLE|ACCESS_DENIED|SCHEDULER_EMPTY_CHANNEL|Failed to import channel" src/modules/scheduler/channel-manager/ChannelManager.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts
rg -n "localStorage|sessionStorage|fetch\\(|PlexAuth|PlexServerDiscovery|PlexStreamResolver" src/modules/scheduler/channel-manager/ChannelManager.ts
```

Expected outcome: the first audit shows the old broad warning-only create/update paths are either narrowed or covered by fallback-only semantics, access/content-unavailable branches remain explicit, and import failure reporting remains visible. The second audit should show no new raw storage, raw fetch, or direct Plex owner coupling introduced into `ChannelManager.ts`.

Full runtime verification:

```sh
npm run verify
```

Expected outcome: full runtime verification passes after the bounded ChannelManager behavior change.

Docs/control-plane verification if audit, plan, or checklist state changes during closeout:

```sh
npm run verify:docs
```

Expected outcome: docs/control-plane verification passes after any plan, audit, or checklist state updates.

## Rollback Notes

Planning-only rollback is limited to removing or reverting this plan and its audit.

Implementation rollback should revert the `FCP-2-S1` changes in `ChannelManager.ts`, `ChannelManager.test.ts`, and optional `interfaces.ts` comment edits. Do not revert unrelated dirty workspace files listed in the audit startup snapshot.

## Commit Checkpoints

- Checkpoint 1: Add failing ChannelManager contract tests for create/update non-fallback failures and preserved deleted-source fallback.
- Checkpoint 2: Implement the bounded ChannelManager contract fix.
- Checkpoint 3: Run targeted tests and focused source audits.
- Checkpoint 4: Run `npm run verify`.
- Checkpoint 5: Update FCP-2 audit/plan/checklist closeout references only after implementation verification and adversarial review agree FCP-2 is ready to close.

Implementation checkpoint:

- `239b3db5` `fix(fcp-2): enforce channel authoring failures`

## Priority-Exit Readiness

This plan is intended to be the final FCP-2 implementation package if `FCP-2-S1` resolves `FCP-2-SF1` and the accepted/no-action areas in the audit remain valid.

FCP-2 closeout evidence:

- `FCP-2-SF1` resolved by commit `239b3db5`: `createChannel()` resolves content before publishing channel state and propagates non-fallback resolution failures without persisting, emitting `channelCreated`, or leaving a channel record behind.
- `updateChannel()` resolves content-affecting updates before publishing updated state and propagates non-fallback resolution failures without persisting, emitting `channelUpdated`, mutating the stored channel, or deleting usable cached content.
- `importChannels()` retains structured `ImportResult` behavior by reporting non-fallback `createChannel()` failures as skipped records with an error entry.
- Graceful deleted/empty-source fallback remains covered by source and tests through `CONTENT_UNAVAILABLE`/404 handling.
- No out-of-scope Plex, startup, player, UI, storage-policy, or persistence-owner edits were required.

Verification evidence:

- `npm run test:unit -- src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts` passed: 1 suite, 83 tests.
- Source audit `rg -n "Failed initial content resolution|Failed content resolution during update|Access denied resolving channel content|CONTENT_UNAVAILABLE|ACCESS_DENIED|SCHEDULER_EMPTY_CHANNEL|Failed to import channel" src/modules/scheduler/channel-manager/ChannelManager.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts` returned expected ChannelManager/test references for narrowed fallback warnings, access-denied handling, content-unavailable/empty-channel semantics, and import error reporting.
- Source audit `rg -n "localStorage|sessionStorage|fetch\\(|PlexAuth|PlexServerDiscovery|PlexStreamResolver" src/modules/scheduler/channel-manager/ChannelManager.ts` returned no matches.
- First final `npm run verify` attempt exited 139 with a segmentation fault during `npm run test:contracts` after typecheck, architecture lint, CSS lint, coverage, and tools tests had passed; direct `npm run test:contracts` rerun passed: 7 suites, 201 tests.
- Final `npm run verify` rerun passed after the completed-plan/checklist update, including typecheck, architecture lint, CSS lint, coverage tests, tools tests, contracts, docs verification, and build.
- Standalone `npm run verify:docs` passed after the completed-plan/checklist update.

Review evidence:

- Initial adversarial plan review found blocking findings in checklist state, import semantics, verification classification, and audit package-brief completeness.
- Same-reviewer closure check confirmed those plan findings were resolved.
- Fresh final plan approval review found no material findings and approved implementation of only `FCP-2-S1`; parallel execution was not authorized.
- Fresh implementation review found no material findings and approved `FCP-2-S1` for implementation checkpoint commit.
- Fresh FCP-2 closeout review found no material findings and approved FCP-2 closeout after accepting the source-finding proof matrix, accepted/no-action owner record, verification evidence, and checklist mini-record update.

Residual disposition:

- No deferred `FCP-2` source findings are admitted in this plan.
- Accepted/no-action audit areas remain owned by their current module owners and will be rechecked in the final FCP reconciliation pass.
