**Plan Status:** completed
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

# DCR-13 Scheduler, ChannelManager, And Test Architecture Plan

## Goal

Retire `DCR-13` by reducing live scheduler/channel architecture debt from current source, not by accepting the S0 findings as documentation-only residuals.

This package must:

- reduce `ChannelManager` production responsibility with source proof and a fresh file-health audit;
- reduce `ChannelManager.test.ts` catch-all responsibility under the DCR-10 split policy with source proof and a fresh test-health audit;
- unify scheduler shuffle seed validation at one shared shuffle owner;
- consolidate `ContentResolver` test factories through package-local channel-manager helpers;
- remove the `ChannelManager.test.ts` private `_queueSave` probe or align it with private-probe policy through explicit maintainer approval.

`DCR-13-A1` and `DCR-13-A2` are hard gates. They cannot close through tests only, docs only, line-count narration, or residual acceptance without explicit maintainer approval recorded with owner, rationale, and revisit trigger.

## Non-Goals

- Do not use Desloppify runtime intake, scan, queue, import, score, or refreshed detector output as package membership or closeout proof.
- Do not change channel persistence schemas, storage keys, migrations, or `ChannelPersistenceStore` ownership.
- Do not change public `IChannelManager`, `ChannelManagerConfig`, scheduler, or content resolver contracts unless implementation proves a narrow same-owner type/import adjustment is required and the plan is refreshed first.
- Do not broaden into `DCR-14` EPG work, `DCR-15` player/Plex runtime work, `DCR-16` source-signal cleanup, broad channel-setup runtime refactors, or repo-wide harness rewrites.
- Do not weaken the private-probe policy by increasing `private-probes.allowlist.txt` or adding owner notes unless the maintainer explicitly approves a private-probe residual for `DCR-13-A5`.
- Do not add new DCR coverage to the `ChannelManager.test.ts` catch-all suite as a way to close `DCR-13-A2`.

## Parent Priority Alignment

`DCR-13` is the scheduler/channel follow-up package admitted by `DCR-EXIT-S0`. It blocks `DCR-EXIT` package reconciliation until every listed issue is fixed, source-disproved, or explicitly maintainer-routed.

Current architecture truth says `src/modules/scheduler/` owns scheduling behavior, shuffle logic, and channel domain flows. Channel-domain persistence ownership stays with `src/modules/scheduler/channel-manager/ChannelPersistenceStore.ts`; `ChannelRepository` remains the thin consumer wrapper over that store. This plan keeps that storage-owner map intact while extracting workflow responsibility that currently lives inside `ChannelManager.ts`.

## Required Reading

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/cleanup-loop.md`
4. `docs/agentic/plan-authoring-standard.md`
5. `docs/agentic/codanna-playbook.md`
6. `ARCHITECTURE_CLEANUP_CHECKLIST.md` sections `DCR-10`, `DCR-13`, and `DCR-EXIT`
7. `docs/plans/2026-04-30-dcr-exit-final-dimension-audit-plan.md`, only for S0/S1 routing and DCR-EXIT block state
8. `docs/archive/plans/2026-04-30-dcr-10-oversized-test-suite-structure.md`
9. `docs/architecture/CURRENT_STATE.md` scheduler/channel and persistence owner sections
10. The inline `DCR-13 S0 Fact Summary` below; no hidden controller packet or local-only run artifact is required for a fresh implementation session.
11. Current source/test files listed in `## Files In Scope`
12. This plan

DCR-13 S0 Fact Summary:

- `ARCHITECTURE_CLEANUP_CHECKLIST.md` section `DCR-13` is the package membership source for `DCR-13-A1` through `DCR-13-A5`.
- The tracked DCR-EXIT plan routes `S0-L01-F3`, `S0-L01-F4`, `S0-L03-F01`, `S0-L03-F05`, and `TS-002` into `DCR-13`.
- `S0-L01-F3` means `ChannelManager` remains a production hub and requires actual production responsibility reduction or maintainer reclassification.
- `S0-L01-F4` means oversized catch-all tests remain outside DCR-10 split scope and requires actual test responsibility reduction or maintainer reclassification.
- `S0-L03-F01` means scheduler shuffle implementations duplicate seed/shuffle behavior with inconsistent finite-seed validation.
- `S0-L03-F05` means `ContentResolver` tests duplicate channel-manager package test factories.
- `TS-002` means `ChannelManager.test.ts` spies private `_queueSave` outside the private-probe baseline.

Freshness gate: before implementation, rerun the pre-implementation source/test audits in `## Verification Commands`. If `ChannelManager` collaborators, focused ChannelManager test files, shuffle owners, private-probe baselines, or DCR-13 checklist membership changed materially after this plan was written, update this plan and rerun plan review before editing production or test code.

## Required Skills

- `execution-plan-authoring`
- `verification-strategy`
- `model-selection`
- `parallel-sidecars`
- `architecture-boundaries`
- `persistence-boundaries`

`parallel-sidecars` decision: no read-only sidecar was delegated during this plan authoring pass because the required S0 routing facts are now tracked or inlined here and the remaining discovery was package-local. Future implementation review may use read-only reviewer sidecars, but implementation ownership stays with the approved cleanup worker and this package plan.

Model-selection result:

```text
MODEL_SUGGESTION
PLANNER: gpt-5.5 high
IMPLEMENTER: gpt-5.5 medium
REVIEWER: gpt-5.5 high
WHY: Tier 3 checklist-linked cleanup touches a current hotspot, moves production responsibilities, uses multiple boundary skills, updates test architecture/policy proof, and blocks DCR-EXIT. Risk score >=4. Use gpt-5.4 high/medium/high fallback if gpt-5.5 is unavailable.
```

## Codanna Discovery

Fresh evidence captured on 2026-04-30:

- `codanna mcp get_index_info --json`: `11651` symbols, `743` files, semantic search enabled, embeddings created/updated 8 hours ago.
- `codanna mcp find_symbol ChannelManager --json`: found class at `src/modules/scheduler/channel-manager/ChannelManager.ts` lines `266-1741`.
- `codanna mcp find_symbol ContentResolver --json`: found class at `src/modules/scheduler/channel-manager/ContentResolver.ts` lines `65-1047`.
- `codanna mcp analyze_impact ChannelManager --json`: returned `0` impacted symbols.
- `codanna mcp analyze_impact ContentResolver --json`: returned `0` impacted symbols.
- `codanna mcp search_documents query:"DCR-13 ChannelManager scheduler shuffle ContentResolver private probe" limit:5 --json`: found `docs/architecture/CURRENT_STATE.md` scheduler/channel ownership plus related archived scheduler plan context; the command logged a docs lock-busy warning but returned useful document hits.
- `codanna mcp semantic_search_with_context query:"ChannelManager scheduler shuffle ContentResolver private probe" limit:5 --json`: returned no similar symbols.

Fallback used because Codanna impact/semantic results were insufficient for shared/public source risk:

- direct reads of required workflow, plan-standard, checklist, DCR-10 archive, current-state, tracked DCR-EXIT routing summaries, and local S0 artifacts used only as planner evidence;
- `wc -l` current source/test sizing;
- `rg` for `_queueSave`, private-probe baselines, shuffle helpers, `createMockLibrary`, `createMulberry32`, `shuffleWithSeed`, `Number.isFinite`, `new ChannelManager`, `new ContentResolver`, `new ShuffleGenerator`, and package test ownership.

Do not replace this source-backed package membership with Desloppify evidence.

## Impact Snapshot

Current source facts from this planning pass:

- `src/modules/scheduler/channel-manager/ChannelManager.ts` is `1742` lines and still owns channel CRUD, import parsing/normalization, content resolution/cache fallback, current-channel switching, debounced persistence saves, warning backoff, retry timers, and repository writes.
- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts` is `1218` lines. DCR-10 already moved transactional, import/reorder, error-semantics, and stale-fallback coverage to focused files, but the catch-all still owns broad CRUD, storage-key, content-resolution, switching, persistence, filtering/sorting, and constructor-validation coverage.
- `ChannelManager.test.ts` spies `loadManager as unknown as { _queueSave: () => void }` in the saved-current-channel load case. `src/__tests__/policy/baselines/private-probes.allowlist.txt` allows only `src/modules/ui/epg/__tests__/EPGScheduleCacheStore.test.ts|store|_loadedRangeKeyByChannel`, and `private-probes.owner-notes.md` has only the EPG cache-store owner note.
- `src/modules/scheduler/shared/prng.ts` owns `shuffleWithSeed` and throws `Seed must be a finite number` for non-finite seeds.
- `src/modules/scheduler/scheduler/ShuffleGenerator.ts` imports `createMulberry32` and duplicates the Fisher-Yates loop without the shared finite-seed guard.
- `ContentResolver` imports `shuffleWithSeed`; `ContentResolver.test.ts` locally defines `createMockLibrary` and `createMockItem` even though `channel-manager-test-helpers.ts` already exports package-local equivalents.
- Direct caller search shows `ChannelManager` is constructed at the orchestrator module factory and consumed through `IChannelManager` across orchestrator, channel tuning, EPG, mini-guide, channel setup, and tests. Public API drift would widen the package and requires replan.

Approved production responsibility seams for `DCR-13-A1`:

- Move debounced channel-data save lifecycle out of `ChannelManager` to a package-local owner named `ChannelPersistenceSaveQueue` or an equivalent narrowly named owner under `src/modules/scheduler/channel-manager/`.
  - Responsibility moved: pending save promise lifecycle, debounce timer, flush/run now, queued catch tracking, persistence failure reporting, quota/current warning backoff, and success reset.
  - Destination owner: scheduler/channel package-local persistence-save queue. It consumes `ChannelRepository.saveStoredChannelData` through a callback and may emit `persistenceWarning` through a typed callback; it must not own storage keys, schema normalization, migrations, or raw storage access.
  - `ChannelManager` remains the channel domain API and state owner. Its persistence role after extraction should be limited to assembling `StoredChannelData` from state and asking the queue to persist.
- Move import payload parsing/normalization out of `ChannelManager` to a package-local pure owner named `ChannelImportNormalizer` or an equivalent narrowly named owner under `src/modules/scheduler/channel-manager/`.
  - Responsibility moved: JSON payload validation boundary, imported record field validation, imported `ChannelCreateInput` shaping, and import error message formatting policy.
  - Destination owner: scheduler/channel package-local import normalizer. It may depend on existing channel validators and `summarizeErrorForLog`; it must not call `createChannel`, mutate manager state, or own channel-number conflict policy.
  - `ChannelManager.importChannels` remains the workflow loop that resolves conflicts, calls `createChannel`, and updates `ImportResult`.

These seams are deliberately package-local. They reduce `ChannelManager` as a production hub without changing cross-module public contracts or persistence schema ownership.

## Package Decomposition

- `package_id`: `DCR-13`
- `checklist_token`: `DCR-13`
- `package_issue_ids`:
  - `DCR-13-A1`: `S0-L01-F3` `ChannelManager` remains a production hub.
  - `DCR-13-A2`: `S0-L01-F4` oversized catch-all tests remain outside DCR-10 split scope.
  - `DCR-13-A3`: `S0-L03-F01` duplicate scheduler shuffle implementations have inconsistent seed validation.
  - `DCR-13-A4`: `S0-L03-F05` `ContentResolver` tests duplicate channel-manager package test factories.
  - `DCR-13-A5`: `TS-002` `ChannelManager` catch-all test spies private `_queueSave` outside the private-probe baseline.
- `slice_table`:

### `DCR-13-S1`

- `goal`: Reduce `ChannelManager` production responsibility by extracting the approved persistence-save queue and import-normalization owners while preserving public `IChannelManager` behavior and channel persistence schema ownership.
- `areas/files`:
  - `src/modules/scheduler/channel-manager/ChannelManager.ts`
  - `src/modules/scheduler/channel-manager/ChannelPersistenceSaveQueue.ts` or equivalent package-local new owner
  - `src/modules/scheduler/channel-manager/ChannelImportNormalizer.ts` or equivalent package-local new owner
  - `src/modules/scheduler/channel-manager/ChannelRepository.ts` as read-only consumer proof unless callback typing requires a narrow import-only adjustment
  - `src/modules/scheduler/channel-manager/ChannelPersistenceStore.ts` read-only proof only
  - `src/modules/scheduler/channel-manager/interfaces.ts`, `types.ts`, `index.ts` only if package-local type/export wiring requires it
  - affected focused ChannelManager tests named in S2 if behavior coverage must move with the production seam
- `exact_issue_ids`: `DCR-13-A1`
- `verification`: targeted ChannelManager persistence/import/focused tests; `npm run typecheck` if production imports/types change; fresh file-health source audit proving the approved responsibilities no longer live in `ChannelManager.ts`; `npm run verify` because production source moves in a hotspot.
- `dependencies`: none.
- `stop_condition`: Stop and replan if the extraction needs public `IChannelManager` contract changes, persistence schema/key/migration changes, raw storage access outside `ChannelPersistenceStore`, changes to repository/store ownership, changes to channel authoring semantics, or if fresh file-health audit still supports `S0-L01-F3` after the planned production extraction.
- `handoff_condition`: `ChannelManager.ts` no longer contains the save queue/private `_queueSave` lifecycle or imported-record normalization helpers; new owners have focused tests or public behavior coverage; persistence schemas and keys are unchanged; source audit records before/after responsibility and line-count proof.
- `serial_only`: yes
- `parallel_justification`: This is the architecture seam for the package and shares ChannelManager production/test state with S2. It must complete and review clean before catch-all test split closeout.

### `DCR-13-S2`

- `goal`: Reduce `ChannelManager.test.ts` catch-all responsibility under the DCR-10 split policy and remove the private `_queueSave` probe through public behavior/storage assertions.
- `areas/files`:
  - `src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts`
  - `src/modules/scheduler/channel-manager/__tests__/ChannelManager.persistence.test.ts` as the approved new focused home for storage-key, current-channel persistence, debounced save, load/export, and constructor storage-key validation coverage
  - `src/modules/scheduler/channel-manager/__tests__/ChannelManager.content-resolution.test.ts` as the approved new focused home for non-stale happy-path content resolution, schedule-item cloning, filtering/sorting, and zero-duration filtering coverage
  - existing focused files: `ChannelManager.transactional.test.ts`, `ChannelManager.import-order.test.ts`, `ChannelManager.error-semantics.test.ts`, `ChannelManager.stale-fallback.test.ts`
  - `src/modules/scheduler/channel-manager/__tests__/channel-manager-test-helpers.ts`
  - `src/__tests__/policy/AntiPatterns.policy.test.ts`
  - `src/__tests__/policy/baselines/private-probes.allowlist.txt` and `src/__tests__/policy/baselines/private-probes.owner-notes.md` only if maintainer explicitly approves policy alignment instead of removal
- `exact_issue_ids`: `DCR-13-A2`, `DCR-13-A5`
- `verification`: targeted ChannelManager catch-all plus all focused ChannelManager suites; private-probe policy test; fresh test-health source audit proving the catch-all no longer owns persistence/content-resolution groups and no `_queueSave` private spy remains. If maintainer approves a private-probe residual instead, add owner notes without weakening policy and rerun the same policy test.
- `dependencies`: after `DCR-13-S1`, because the `_queueSave` probe should be removed against the new production save boundary and the test split must follow the final production seam.
- `stop_condition`: Stop and replan if preserving coverage requires adding DCR-specific tests back to `ChannelManager.test.ts`, if `_queueSave` or another private ChannelManager member still needs probing without maintainer approval, if focused-file taxonomy conflicts with DCR-10 policy, or if fresh test-health audit still supports `S0-L01-F4`.
- `handoff_condition`: `ChannelManager.test.ts` is reduced to broad CRUD/channel switching smoke coverage only; persistence and content-resolution coverage live in focused files; no private `ChannelManager` probe is present unless maintainer-approved owner notes exist; targeted tests and policy proof pass.
- `serial_only`: yes
- `parallel_justification`: Shares the catch-all test file and helper setup with S1 and S4; execute serially after S1 to keep one reviewed test architecture change.

### `DCR-13-S3`

- `goal`: Unify scheduler shuffle seed validation by making scheduler `ShuffleGenerator` use the shared shuffle implementation and adding a contract test for non-finite seed behavior.
- `areas/files`:
  - `src/modules/scheduler/shared/prng.ts`
  - `src/modules/scheduler/scheduler/ShuffleGenerator.ts`
  - `src/modules/scheduler/scheduler/__tests__/ShuffleGenerator.test.ts`
  - `src/modules/scheduler/scheduler/__tests__/ScheduleCalculator.test.ts`
  - `src/modules/scheduler/scheduler/__tests__/ChannelScheduler.test.ts`
  - `src/modules/scheduler/shared/__tests__/blockPlayback.test.ts` only if shared shuffle/block behavior needs proof
- `exact_issue_ids`: `DCR-13-A3`
- `verification`: targeted `ShuffleGenerator`, `ScheduleCalculator`, and `ChannelScheduler` tests; add or update a contract assertion that `ShuffleGenerator.shuffle` and `shuffleIndices` reject non-finite seeds with the same finite-seed rule as `shuffleWithSeed`; preserve deterministic order for finite seeds unless targeted tests intentionally authorize a behavior correction.
- `dependencies`: after S1 is preferred for simpler package review, but this slice is source-disjoint from S1/S2 and may be replanned into a parallel implementation only if the controller proves disjoint writes and one integration gate.
- `stop_condition`: Stop and replan if unifying shuffle changes finite-seed deterministic order, scheduler public API, schedule playback semantics, or ContentResolver playback semantics beyond the explicit non-finite-seed validation correction.
- `handoff_condition`: `ShuffleGenerator` delegates to `shuffleWithSeed` or an equivalent single shared owner; no duplicate Fisher-Yates loop remains in scheduler; finite-seed behavior stays stable; non-finite seed behavior is covered.
- `serial_only`: yes
- `parallel_justification`: Kept serial by default because package closeout shares scheduler verification. Parallelization requires a reviewed plan update.

### `DCR-13-S4`

- `goal`: Consolidate duplicated `ContentResolver` test factories through package-local channel-manager helpers.
- `areas/files`:
  - `src/modules/scheduler/channel-manager/__tests__/ContentResolver.test.ts`
  - `src/modules/scheduler/channel-manager/__tests__/channel-manager-test-helpers.ts`
  - affected ChannelManager focused tests only if helper signatures change
- `exact_issue_ids`: `DCR-13-A4`
- `verification`: targeted `ContentResolver.test.ts` plus ChannelManager focused tests that consume the shared helpers; source audit proving `createMockLibrary` and `createMockItem` are not locally duplicated in `ContentResolver.test.ts`.
- `dependencies`: after S2 is preferred if S2 changes helper shape; otherwise source-disjoint. Controller may only parallelize after confirming no concurrent edits to `channel-manager-test-helpers.ts`.
- `stop_condition`: Stop and replan if helper consolidation requires a broad test harness rewrite, cross-package test utilities, Plex runtime fixture changes beyond minimal `PlexMediaItemMinimal` data, or production `ContentResolver` changes.
- `handoff_condition`: `ContentResolver.test.ts` imports package-local helper factories for shared mock library/item shapes; ContentResolver-specific media/episode fixtures may stay local when not reused; targeted tests pass.
- `serial_only`: yes
- `parallel_justification`: Shares `channel-manager-test-helpers.ts` with S2, so default execution is serial.

- `coverage_check`:
  - `DCR-13-A1` maps exactly to `DCR-13-S1`; final owner is `DCR-13` scheduler/channel production owner. It may close only through actual production responsibility reduction plus fresh file-health audit, or maintainer reclassification with owner/rationale/revisit trigger.
  - `DCR-13-A2` maps exactly to `DCR-13-S2`; final owner is `DCR-13` test-suite structure owner. It may close only through actual catch-all test responsibility reduction/split-policy enforcement plus fresh test-health audit, or maintainer reclassification with owner/rationale/revisit trigger.
  - `DCR-13-A3` maps exactly to `DCR-13-S3`; final owner is `DCR-13` scheduler shuffle owner.
  - `DCR-13-A4` maps exactly to `DCR-13-S4`; final owner is `DCR-13` scheduler test-structure owner.
  - `DCR-13-A5` maps exactly to `DCR-13-S2`; final owner is `DCR-13` private-probe policy/test owner.
- `ready_now_slice`: none; package complete.
- `ready_now_execution_unit`: none; package complete.
- `completed_execution_units`: `DCR-13-S1`, `DCR-13-S2`, `DCR-13-S3`,
  `DCR-13-S4`.
- `recommended_slice_order`:
  1. `DCR-13-S1`
  2. `DCR-13-S2`
  3. `DCR-13-S3`
  4. `DCR-13-S4`
- `parallel_execution_policy`: default unavailable for implementation. Execute slices serially in the recommended order. A controller may only replan S3 or S4 into parallel work after proving disjoint writes, disjoint targeted tests, no concurrent `channel-manager-test-helpers.ts` edits, and one package-level integration gate. Read-only review/source-audit sidecars are allowed when they do not take over planning or implementation ownership.

## Files In Scope

- `src/modules/scheduler/channel-manager/ChannelManager.ts`
- `src/modules/scheduler/channel-manager/ChannelPersistenceSaveQueue.ts` or equivalent package-local save-queue owner created by S1
- `src/modules/scheduler/channel-manager/ChannelImportNormalizer.ts` or equivalent package-local import-normalization owner created by S1
- `src/modules/scheduler/channel-manager/ChannelRepository.ts` for consumer proof or narrow callback type integration only
- `src/modules/scheduler/channel-manager/ChannelPersistenceStore.ts` for read-only persistence-owner proof only
- `src/modules/scheduler/channel-manager/interfaces.ts`, `types.ts`, `index.ts` only for necessary package-local type/export wiring
- `src/modules/scheduler/channel-manager/ContentResolver.ts` only if helper/test consolidation exposes an already-owned import/type issue; production behavior changes are out of scope
- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.persistence.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.content-resolution.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.transactional.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.import-order.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.error-semantics.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.stale-fallback.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ContentResolver.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/channel-manager-test-helpers.ts`
- `src/modules/scheduler/shared/prng.ts`
- `src/modules/scheduler/scheduler/ShuffleGenerator.ts`
- `src/modules/scheduler/scheduler/__tests__/ShuffleGenerator.test.ts`
- `src/modules/scheduler/scheduler/__tests__/ScheduleCalculator.test.ts`
- `src/modules/scheduler/scheduler/__tests__/ChannelScheduler.test.ts`
- `src/modules/scheduler/shared/__tests__/blockPlayback.test.ts` only if shared shuffle proof requires it
- `src/__tests__/policy/AntiPatterns.policy.test.ts`
- `src/__tests__/policy/baselines/private-probes.allowlist.txt` and `src/__tests__/policy/baselines/private-probes.owner-notes.md` only for explicit maintainer-approved private-probe policy alignment
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` closeout status only after implementation and clean review
- `docs/architecture/CURRENT_STATE.md` only if production ownership docs need updating after S1 closeout
- this active plan

## Files Out Of Scope

- `src/core/orchestrator/`, `src/core/channel-tuning/`, EPG, mini-guide, channel setup, player, Plex, and UI consumers except as read-only public-contract proof.
- Persistence schema, storage-key, migration, raw storage helper, or repository/store ownership changes in `ChannelPersistenceStore.ts`.
- `DCR-14`, `DCR-15`, `DCR-16`, broad source-signal cleanup, broad channel-setup runtime refactors, and broad test harness rewrites.
- Plex auth, discovery, library parser, stream, subtitle, and playback URL logic beyond minimal ContentResolver test fixtures.
- `docs/plans/2026-04-30-dcr-exit-final-dimension-audit-plan.md`, which is currently dirty user-owned context and must not be edited by this package.
- Unrelated untracked docs/plans/eval files present before this plan.
- Desloppify runtime data, queue/scan/import/score artifacts, and detector refresh output.

## Planner Self-Check

- Unresolved architecture seam? No. S1 explicitly moves debounced persistence-save lifecycle and import normalization to package-local owners; storage schema ownership remains unchanged.
- Adjacent contract/type changes hidden out of scope? No. Public `IChannelManager` and scheduler contracts are frozen unless a plan update brings a narrow contract change into scope.
- Out-of-scope files implicitly required? No. Consumers are read-only proof surfaces; repository/store implementation is not a write target except for narrow type integration if S1 proves it.
- Codanna evidence path recorded? Yes. Index, symbol, impact, document, semantic-search results and `rg`/direct-read fallback are recorded.
- Repo-preferred owner? Yes. Scheduler/channel package owns channel domain flows, shuffle, and package-local test helpers; persistence schema stays with `ChannelPersistenceStore`.
- Fresh-session readiness? Yes. Slice order, hard closure gates, files, verification, and stop conditions are explicit.
- Execution grade? Yes. The plan freezes expensive seam and verification decisions without prescribing full implementation bodies.

## Architecture Seam Decision Gate

Approved seams:

- `ChannelManager` remains the public channel-domain API/state owner. It should delegate save queue behavior and import normalization rather than grow new private workflow helpers.
- `ChannelPersistenceSaveQueue` or equivalent package-local owner owns debounced save orchestration and warning backoff. It must not own raw storage, storage keys, stored-data normalization, migrations, or channel state.
- `ChannelImportNormalizer` or equivalent package-local owner owns import payload validation and create-input shaping. It must not call `createChannel`, mutate `ChannelManager` state, or decide channel-number conflict behavior.
- `ChannelManager.persistence.test.ts` and `ChannelManager.content-resolution.test.ts` are the approved new focused homes for DCR-13 catch-all test reduction. Existing DCR-10 focused files keep their existing transactional, import/reorder, error-semantics, and stale-fallback domains.
- Private `_queueSave` probing should be removed. The approved replacement proof is public behavior or storage-boundary assertion through `loadChannels`, `saveChannels`, `flushSaves`, repository write spies, or persisted storage state. Policy alignment through baselines is a fallback only with explicit maintainer approval.
- `ShuffleGenerator` must share the finite-seed validation path with `shuffleWithSeed` or an equivalent single shared helper. Finite-seed deterministic order should be preserved unless a targeted contract test proves and authorizes a behavior correction.
- `ContentResolver.test.ts` should consume package-local helper factories for shared mock library/item shapes. ContentResolver-specific media/episode fixtures may remain local.

Preservation contracts:

- Channel CRUD, import result semantics, exact reorder semantics, current-channel switching, persistence warning payloads, debounced save promise behavior, `flushSaves`, `dispose`, stale cache fallback, access-denied no-fallback behavior, retry cancellation, and event emission semantics remain unchanged unless a targeted test and plan update authorize a behavior correction.
- `ChannelPersistenceStore` remains the storage namespace/schema owner. Raw `localStorage` access must not be introduced in `ChannelManager`, new collaborators, tests, or helpers except through existing test mocks.
- Public imports from `src/modules/scheduler/channel-manager` and `src/modules/scheduler/scheduler` remain stable unless the plan is refreshed and `npm run typecheck`/`npm run verify` are required.

Stop and replan if:

- `DCR-13-A1` would close without actual production responsibility reduction in `ChannelManager.ts` and fresh file-health audit proof.
- `DCR-13-A2` would close without actual catch-all test responsibility reduction/split-policy enforcement and fresh test-health audit proof.
- implementation requires channel persistence schema/key/migration changes or changes the storage-owner map;
- public `IChannelManager`, scheduler, or cross-module contracts need to change;
- `ChannelManager` still owns the approved save queue/import normalizer responsibilities after S1;
- `ChannelManager.test.ts` still needs private `_queueSave` probing and no maintainer-approved baseline owner note exists;
- finite-seed scheduler order changes unexpectedly;
- helper consolidation turns into cross-package fixture or harness work;
- verification scope widens beyond the commands listed below.

## Verification Commands

Verification mode: `refactor-invariance` with narrow contract-first proof for shuffle seed validation and private-probe policy.

- Verification classification: `new regression/contract test required`

Planning artifact verification:

- Run after plan creation/update and before closeout: `npm run plans:check`
- Expected: active tracked plan conformance passes.
- Run after active plan/checklist/current-state docs change: `npm run verify:docs`
- Expected: docs verifier, harness docs tests, and docs contracts pass.

Pre-implementation freshness audits:

- Run: `git status --short`
- Expected: no dirty in-scope production/test/checklist/current-state files except this active plan or explicitly owned implementation edits. Preserve the dirty DCR-EXIT plan and unrelated untracked docs/eval files.
- Run: `wc -l src/modules/scheduler/channel-manager/ChannelManager.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts src/modules/scheduler/channel-manager/ContentResolver.ts src/modules/scheduler/channel-manager/__tests__/ContentResolver.test.ts src/modules/scheduler/channel-manager/__tests__/channel-manager-test-helpers.ts src/modules/scheduler/shared/prng.ts src/modules/scheduler/scheduler/ShuffleGenerator.ts`
- Expected: records current source/test sizes before edits.
- Run: `rg -n "_queueSave|createMockLibrary|createMockItem|shuffleWithSeed|createMulberry32|Number\\.isFinite" src/modules/scheduler src/__tests__/policy -S`
- Expected: confirms current private probe, helper duplication, and shuffle validation ownership before edits.

S1 production responsibility reduction proof:

- Run: `npm test -- --runInBand src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.persistence.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.transactional.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.import-order.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.error-semantics.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.stale-fallback.test.ts`
- Expected: ChannelManager catch-all and focused tests pass after production extraction and any coverage moves.
- Run: `npm run typecheck`
- Expected: TypeScript passes if S1 changes production imports/types or package exports.
- Run: `wc -l src/modules/scheduler/channel-manager/ChannelManager.ts`
- Expected: `ChannelManager.ts` is lower than the `1742`-line baseline, and the source audit proves the approved save queue/import-normalizer responsibilities moved to focused owners. If the fresh audit still supports `S0-L01-F3`, do not close A1; replan or seek maintainer reclassification.
- Run: `rg -n "_queueSave|_ensurePendingSavePromise|_clearPendingSavePromise|_resolvePendingSave|_rejectPendingSave|_runPendingSaveNow|_flushPendingSaveNow|_shouldEmitPersistenceWarning|_buildImportedChannelCreateInput|_isValidChannelImport|formatImportErrorMessage" src/modules/scheduler/channel-manager/ChannelManager.ts src/modules/scheduler/channel-manager -S`
- Expected: responsibilities are absent from `ChannelManager.ts` or reduced to delegating public methods; new package-local owners contain the moved implementation.

S2 test split and private-probe proof:

- Run: `npm test -- --runInBand src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.persistence.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.content-resolution.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.transactional.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.import-order.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.error-semantics.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.stale-fallback.test.ts`
- Expected: catch-all and focused ChannelManager suites pass.
- Run: `npm run test:contracts -- --runInBand src/__tests__/policy/AntiPatterns.policy.test.ts`
- Expected: private-probe policy passes with no new ChannelManager private probe. If maintainer approved a baseline owner note instead, the allowlist count/notes must match policy without weakening unrelated entries.
- Run: `wc -l src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts`
- Expected: catch-all suite is lower than the `1218`-line baseline and no longer owns persistence/content-resolution test groups. If fresh test-health audit still supports `S0-L01-F4`, do not close A2; replan or seek maintainer reclassification.
- Run: `rg -n "_queueSave|jest\\.spyOn\\([^\\n]*_[A-Za-z]|as unknown as \\{ _" src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.*.test.ts src/__tests__/policy/baselines/private-probes.* -S`
- Expected: no unapproved ChannelManager private probe remains.
- Run: `rg -n "describe\\(|it\\(" src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.persistence.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.content-resolution.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.transactional.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.import-order.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.error-semantics.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.stale-fallback.test.ts`
- Expected: describes/its show the approved focused ownership split.

S3 scheduler shuffle proof:

- Run: `npm test -- --runInBand src/modules/scheduler/scheduler/__tests__/ShuffleGenerator.test.ts src/modules/scheduler/scheduler/__tests__/ScheduleCalculator.test.ts src/modules/scheduler/scheduler/__tests__/ChannelScheduler.test.ts src/modules/scheduler/shared/__tests__/blockPlayback.test.ts`
- Expected: scheduler/shared playback tests pass; finite-seed deterministic behavior remains stable; non-finite seed validation is consistent with `shuffleWithSeed`.
- Run: `rg -n "createMulberry32|shuffleWithSeed|Number\\.isFinite\\(seed\\)" src/modules/scheduler/shared/prng.ts src/modules/scheduler/scheduler/ShuffleGenerator.ts src/modules/scheduler/channel-manager/ContentResolver.ts -S`
- Expected: scheduler shuffle uses the shared shuffle owner instead of duplicating the Fisher-Yates loop without validation.

S4 ContentResolver helper proof:

- Run: `npm test -- --runInBand src/modules/scheduler/channel-manager/__tests__/ContentResolver.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.persistence.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.content-resolution.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.transactional.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.import-order.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.error-semantics.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.stale-fallback.test.ts`
- Expected: ContentResolver and ChannelManager helper consumers pass.
- Run: `rg -n "function createMockLibrary|function createMockItem" src/modules/scheduler/channel-manager/__tests__/ContentResolver.test.ts src/modules/scheduler/channel-manager/__tests__/channel-manager-test-helpers.ts -S`
- Expected: shared factories live in `channel-manager-test-helpers.ts`; ContentResolver-specific fixtures may stay local when not duplicated.

Package integration and docs proof:

- Run when helpers move, production source moves, public contracts change, private-probe policy changes, or full integration proof is needed: `npm run verify`
- Expected: full verification passes.
- Run before package closeout: `npm run plans:check && npm run verify:docs`
- Expected: plan/docs/checklist state passes. If checklist/current-state docs are updated at closeout, this is mandatory.

## Rollback Notes

- Roll back S1 by restoring `ChannelManager` ownership for the moved save queue/import-normalizer code and removing new package-local owners if targeted ChannelManager behavior regresses. Do not leave half-wired collaborators or duplicate owners.
- Roll back S2 by moving tests back only if the split itself caused failure; do not reintroduce the `_queueSave` private probe without maintainer-approved policy notes.
- Roll back S3 by restoring the previous `ShuffleGenerator` implementation only if finite-seed order compatibility breaks and cannot be preserved through shared helper delegation. Keep the non-finite-seed contract decision explicit before rollback.
- Roll back S4 by restoring local ContentResolver factories only if package-local helpers create fixture coupling that breaks tests; do not introduce cross-package helpers.
- Any rollback that leaves A1 or A2 still live must keep the DCR-13 checklist open and record the blocked slice in implementation handoff.

## Commit Checkpoints

- Checkpoint 1: `DCR-13-S1` production responsibility extraction, targeted ChannelManager verification, fresh file-health audit.
- Checkpoint 2: `DCR-13-S2` ChannelManager catch-all split/private-probe removal, targeted tests, private-probe policy proof, fresh test-health audit.
- Checkpoint 3: `DCR-13-S3` shuffle validation unification and scheduler targeted tests.
- Checkpoint 4: `DCR-13-S4` ContentResolver helper consolidation and targeted tests.
- Closeout checkpoint: checklist/current-state/plan status updates after clean implementation review and required verification.

Keep active tracked plan docs out of implementation commits unless the controller intentionally makes a separate tracked-doc commit.

## Closeout Evidence

`DCR-13` completed on 2026-04-30 after clean plan review, clean slice
implementation reviews, and focused implementation checkpoints.

- `DCR-13-S1` / `DCR-13-A1`: commit `add1fedd` extracted
  `ChannelPersistenceSaveQueue` and `ChannelImportNormalizer`.
  `ChannelManager.ts` dropped from `1742` to `1399` lines; the save lifecycle
  and import-normalization helper grep audit showed the moved responsibilities
  absent from `ChannelManager.ts` except `_queueSave` delegation.
- `DCR-13-S2` / `DCR-13-A2` and `DCR-13-A5`: commit `e1af8d67` split
  `ChannelManager.test.ts` into focused persistence and content-resolution
  suites. `ChannelManager.test.ts` dropped from `1218` to `385` lines, and the
  private `_queueSave` spy was replaced by public storage/repository proof.
  Private-probe policy tests passed without baseline changes.
- `DCR-13-S3` / `DCR-13-A3`: commit `34bdaf9a` made `ShuffleGenerator`
  delegate to shared `shuffleWithSeed`, preserved finite-seed order contracts,
  and added non-finite seed rejection coverage for `shuffle` and
  `shuffleIndices`.
- `DCR-13-S4` / `DCR-13-A4`: commit `edaa07f4` removed duplicate
  `ContentResolver.test.ts` `createMockLibrary` / `createMockItem` factories
  and reused package-local helpers.

Verification observed during implementation/review:

- Targeted ChannelManager suites passed after S1 and S2.
- `npm run test:contracts -- --runInBand
  src/__tests__/policy/AntiPatterns.policy.test.ts` passed after S2.
- Targeted scheduler/shared shuffle suites passed after S3.
- Targeted ContentResolver plus ChannelManager helper-consumer suites passed
  after S4.
- `npm run typecheck` passed after S1 production extraction.
- `npm run verify` passed after each implementation slice.
- Final controller closeout source/test-health audits passed:
  `ChannelManager.ts` is `1399` lines, `ChannelManager.test.ts` is `385`
  lines, no unapproved ChannelManager private-probe grep matches remain,
  `ContentResolver.test.ts` no longer defines duplicate `createMockLibrary` /
  `createMockItem` factories, and scheduler `ShuffleGenerator` delegates to
  shared `shuffleWithSeed`.
- Final controller closeout verification passed: `npm run plans:check`, `npm
  run verify:docs`, and full `npm run verify`. The Vite build kept its existing
  large-chunk warning for `dist/assets/index-Bt0C3_fN.js`; the command exited
  successfully.

No DCR-13 closeout gates remain open. DCR-EXIT remains blocked on `DCR-14`
through `DCR-16`.
