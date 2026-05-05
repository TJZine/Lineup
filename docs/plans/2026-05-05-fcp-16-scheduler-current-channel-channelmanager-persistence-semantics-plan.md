**Plan Status:** completed
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

# FCP-16 Scheduler Current-Channel And ChannelManager Persistence Semantics Plan

## Goal

Retire exactly `ARCHITECTURE_CLEANUP_CHECKLIST.md` item `FCP-16` by closing `FCP-16-SF1` and `FCP-16-SF2` for scheduler/channel-manager current-channel persistence semantics.

This is an `FCP-*` source-backed cleanup package. Coverage is defined only by checklist `source_finding_id` values `FCP-16-SF1` and `FCP-16-SF2`; do not use Desloppify, detector ids, imported review ids, package-map ids, score output, stale hotspot wording, fresh post-FCP verification, or retrospective subjective review as intake, proof, or closeout.

Completion means current-channel persistence semantics are named, aligned, source-audited, and tested through public scheduler/channel-manager seams; the public `ChannelManager` facade remains; storage keys and stored payload schema are unchanged unless a stopped/replanned plan receives maintainer approval.

## Non-Goals

- Do not implement production or test code from this planning pass.
- Do not reopen completed `FCP-7` through `FCP-15`, start `FCP-17` through `FCP-20`, `FCP-EXIT`, DCR packages, legacy `FCP-EXIT`, Windows port work, ContentResolver cleanup, or broader post-FCP cleanup.
- Do not remove the public `ChannelManager` facade, widen `IChannelManager`, or change channel-tuning/orchestrator/UI callers unless a stop/replan condition is met.
- Do not change storage keys, key scoping, localStorage schema, `StoredChannelData` wire shape, setup build-scratch keys, or selected-server/channel storage context behavior.
- Do not change Plex auth, Plex stream, priority-one, navigation, UI/focus behavior, EPG rendering, or Windows platform behavior.
- Do not add compatibility shims, package/root barrels, new dependencies, speculative owners, or private-probe-only tests.

## Parent Priority Alignment

`FCP-16` is the next safe package after completed `FCP-15`. The checklist marks `FCP-16` not started with no plan, and states `FCP-17` or later, `FCP-EXIT`, Windows port work, and other post-FCP cleanup must wait for clean `FCP-16` closeout evidence.

Current architecture docs identify `src/modules/scheduler/channel-manager/ChannelPersistenceStore.ts` as the storage owner for channel-domain persistence, including selected/current channel state. `ChannelManager.ts` remains the public channel-domain API/state facade while package-local collaborators own authoring/default shaping, import/export orchestration, manager-facing persistence coordination, resolved-content cache/clone policy, and retry timers.

The approved cleanup seam is scheduler/channel-manager persistence semantics only: clarify current-channel write/read behavior and, only if source audit proves it remains necessary, extract or confirm a package-local owner for persistence-adjacent `ChannelManager` facade responsibility. `ContentResolver` cache/coalescing/mapping work belongs to `FCP-17` and is frozen here.

## Required Reading

Read in this order before implementation or review:

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/README.md` routing table
4. `docs/agentic/session-prompts/cleanup-loop.md`
5. `docs/agentic/plan-authoring-standard.md`, especially Universal Plan Core, Cleanup Overlay, and FCP Source-Backed Checklist Override
6. `docs/agentic/codanna-playbook.md`
7. `ARCHITECTURE_CLEANUP_CHECKLIST.md` sections `FCP Operating Rules`, `FCP-15`, and `FCP-16`
8. `docs/architecture/CURRENT_STATE.md`
9. `docs/architecture/modules.md`
10. Completed guardrail plans only:
    - `docs/plans/2026-05-02-fcp-7-boundary-type-hygiene-plan.md`
    - `docs/plans/2026-05-02-fcp-8-api-plex-error-contract-coherence-plan.md`
    - `docs/plans/2026-05-02-fcp-9-source-signal-convention-local-elegance-plan.md`
    - `docs/plans/2026-05-02-fcp-10-epg-renderer-direct-confidence-presentation-decomposition-plan.md`
    - `docs/plans/2026-05-02-fcp-11-runtime-owner-reduction-hotspots-plan.md`, especially the completed `ChannelManager` owner-closure guardrails
    - `docs/plans/2026-05-02-fcp-12-package-organization-structure-navigation-final-exit-plan.md`
    - `docs/plans/2026-05-05-fcp-13-low-risk-source-signal-api-export-diagnostic-closure-plan.md`
    - `docs/plans/2026-05-05-fcp-14-priority-one-forwarding-assembly-seam-plan.md`
    - `docs/plans/2026-05-05-fcp-15-plexauth-home-profile-status-helper-boundary-plan.md`
11. This plan
12. Source and test files named under `## Files In Scope`
13. `git status --short --branch`

Freshness gate: stop and refresh this plan if any `FCP-16` checklist text, scheduler/channel-manager architecture ownership text, source files in scope, or tests in scope changed materially after 2026-05-05.

Planning observed branch `code-health...origin/code-health [ahead 3]` with pre-existing unrelated dirty/untracked files, including controller-noted docs/scorecard paths plus additional non-FCP harness/workflow test changes. Preserve those paths unless a fresh source audit proves direct `FCP-16` overlap.

## Required Skills

- `persistence-boundaries`: required because current-channel state is storage-backed scheduler state and storage keys/schema must remain owned by the persistence boundary.
- `architecture-boundaries`: required because `ChannelManager.ts` is a public facade and historical owner surface; this plan must avoid growing it or moving work across scheduler boundaries.
- `verification-strategy`: required to freeze proof depth for semantics cleanup without forcing brittle private probing.
- `execution-plan-authoring`: required for Tier 3 source-backed FCP package planning.

Do not load `plex-integration-boundaries`, `ui-composition-patterns`, or `brainstorming` unless source audit unexpectedly proves Plex, UI/focus, or unresolved product intent is truly in scope. That discovery should normally stop and replan because `FCP-16` is scheduler/channel-manager persistence cleanup only.

## Codanna Discovery

- `get_index_info`: Codanna available with 12,075 symbols across 797 files; 13,344 relationships; semantic search enabled with 330 embeddings; created and updated just now during planning.
- `search_documents "FCP-16 current-channel persistence ChannelManager semantics checklist"`: returned low-score/noisy plan-standard and old plan hits, not the authoritative checklist. Direct reads of `ARCHITECTURE_CLEANUP_CHECKLIST.md`, current architecture docs, and guardrail FCP plans are the deterministic membership and sequencing source.
- `semantic_search_with_context "ChannelPersistenceStore current channel save best effort strict storage failure ChannelManager persistence coordinator"`: found channel-manager persistence symbols but top hits were broad `ChannelConfig`, `ChannelManagerState`, `ChannelManager.setStorageKeys`, `saveChannels`, and constants. Useful for locating the area; direct symbol and source reads were still required.
- `semantic_search_with_context "ChannelManager persistence facade current channel ChannelPersistenceCoordinator save current channel"`: found `ChannelManagerState`, `ChannelConfig`, `CURRENT_CHANNEL_KEY`, `STORAGE_KEY`, and `setStorageKeys`; useful but not complete for current-channel method semantics.
- `find_symbol ChannelManager`: found class `ChannelManager` at `src/modules/scheduler/channel-manager/ChannelManager.ts` symbol_id `2670`; `analyze_impact` on the class returned no impacted symbols, so method-level impact and `rg` fallback are required for callers.
- `find_symbol ChannelPersistenceStore`: found class symbol_id `2199`; `analyze_impact` showed impact through `ChannelRepository`, `ChannelPersistenceCoordinator`, `ChannelManager`, and `ChannelRepository.test.ts` helper `loadNormalized`.
- `find_symbol ChannelPersistenceCoordinator`: found class symbol_id `2603`; `analyze_impact` showed direct impact through `ChannelManager`.
- `find_symbol persistCurrentChannelId`: symbol_id `2620`; `analyze_impact` showed impact through `ChannelManager.setCurrentChannel`, `ChannelTuningCoordinator._runSingleSwitch`, and `ChannelTuningCoordinator._drainSwitchQueue`.
- `find_symbol persistCurrentChannelIdBestEffort`: symbol_id `2621`; `analyze_impact` showed impact through `ChannelManager.replaceAllChannels`.
- `find_symbol writeCurrentChannelId`: symbol_id `2215`; `analyze_impact` showed impact through `ChannelRepository.saveCurrentChannelId`, `ChannelPersistenceCoordinator._persistCurrentChannelId`, and both public coordinator current-channel write methods.
- `find_symbol readCurrentChannelId`: symbol_id `2212`; `analyze_impact` showed impact through `ChannelRepository.loadNormalized`, `ChannelManager.loadChannels`, `InitializationCoordinator._initializePlaybackRuntime`, and `EPGCoordinator.primeEpgChannels`.
- `find_symbol setCurrentChannel`: symbol_id `2717`; `analyze_impact` showed impact through `ChannelTuningCoordinator.switchToChannel`, `_drainSwitchQueue`, and `_runSingleSwitch`.
- `find_symbol replaceAllChannels`: symbol_id `2685`; `analyze_impact` returned no impacted symbols, but `get_calls` showed it calls `persistStoredChannelData`, `supersedePendingSave`, `markSuccess`, `reportFailure`, cache/retry cleanup, and `persistCurrentChannelIdBestEffort`.
- `search_symbols` for affected tests was weak for file-level test ownership. Direct `rg`/source reads are the fallback for `ChannelPersistenceStore.test.ts`, `ChannelRepository.test.ts`, `ChannelManager.persistence.test.ts`, `ChannelManager.transactional.test.ts`, and storage-key tests.
- `rg` / direct source reads covered `ChannelPersistenceStore.ts`, `ChannelRepository.ts`, `ChannelPersistenceCoordinator.ts`, `ChannelPersistenceSaveQueue.ts`, `ChannelManager.ts`, `interfaces.ts`, `types.ts`, `constants.ts`, `config/storageKeys.ts`, `OrchestratorStorageContext.ts`, `OrchestratorModuleFactory.ts`, `ChannelTuningCoordinator.ts`, and affected scheduler/orchestrator tests.

## Impact Snapshot

Current-source proof at plan time:

- `ChannelPersistenceStore` owns raw localStorage mechanics for `STORAGE_KEY = 'lineup_channels_v4'` and `CURRENT_CHANNEL_KEY = 'lineup_current_channel_v4'`. `writeCurrentChannelId()` trims ids and removes the current-channel key for empty input; `readCurrentChannelId()` trims stored values and rewrites normalized values. Storage failures are represented through `SafeLocalStorageMutationResult` helpers rather than thrown by the store.
- `config/storageKeys.ts` independently defines `LINEUP_STORAGE_KEYS.CHANNELS_REAL = 'lineup_channels_v4'`, `CHANNELS_SERVER = 'lineup_channels_server_v1'`, and `CURRENT_CHANNEL = 'lineup_current_channel_v4'`; `OrchestratorStorageContext` scopes selected-server channel keys as `lineup_channels_server_v1:${serverId}[:${userId}]` and `lineup_current_channel_v4:${serverId}[:${userId}]`.
- `ChannelRepository.loadNormalized()` reads the channel blob and current-channel key together, prefers the separate current-channel key only when it points at an existing channel, and does not rewrite channel blob storage when only the separate current-channel key differs.
- `ChannelPersistenceCoordinator.persistCurrentChannelId()` and `persistCurrentChannelIdBestEffort()` currently have identical catch/log/warn/swallow behavior. Both call `_persistCurrentChannelId()`, mark success on success, and emit persistence warnings on failures. This is the core `FCP-16-SF1` ambiguity.
- `ChannelManager.setCurrentChannel()` validates the channel exists, updates in-memory `currentChannelId`, calls `persistCurrentChannelId()`, then emits `channelSwitch`. Since the coordinator swallows storage failures, the public facade currently switches in memory and emits even when current-channel persistence fails.
- `ChannelManager.replaceAllChannels()` persists the channel blob before mutating in-memory state, supersedes pending saves, updates in-memory replacement state, then best-effort persists the separate current-channel key when a current id exists. This path is intentionally distinct from the transactional channel-blob write and must not make replacement state partial.
- Existing tests already cover current-channel write success, `setCurrentChannel` warning emission on quota/unavailable failures, best-effort warning throttling, separate current-channel key load precedence, storage key scoping, transactional `replaceAllChannels` behavior, and blocked storage non-fatal behavior. They do not yet force a named semantic distinction between the strict and best-effort coordinator methods.
- `IChannelManager` exposes the broad public facade. Current source already delegates authoring, import/export, persistence coordination, cache, and retry responsibilities to package-local collaborators. `FCP-16-SF2` should therefore be limited to persistence-adjacent facade cleanup or a source-justified no-code closure; it must not become a broad `ChannelManager` split or line-count exercise.
- Affected tests include `src/modules/scheduler/channel-manager/__tests__/ChannelPersistenceStore.test.ts`, `ChannelRepository.test.ts`, `ChannelManager.persistence.test.ts`, `ChannelManager.transactional.test.ts`, `ChannelManager.test.ts` if facade behavior changes, `src/__tests__/orchestrator/storage-keys.test.ts` if storage key context is touched, and channel-tuning/orchestrator switch tests only if `setCurrentChannel` failure semantics change for callers.

## Files In Scope

- `src/modules/scheduler/channel-manager/ChannelPersistenceStore.ts`
- `src/modules/scheduler/channel-manager/ChannelRepository.ts`
- `src/modules/scheduler/channel-manager/ChannelPersistenceCoordinator.ts`
- `src/modules/scheduler/channel-manager/ChannelPersistenceSaveQueue.ts` only if warning/backoff naming or semantics need alignment
- `src/modules/scheduler/channel-manager/ChannelManager.ts` only for current-channel persistence facade wiring or source-justified persistence-adjacent owner extraction
- New `src/modules/scheduler/channel-manager/*` package-local owner file only if S1 source audit proves a focused current-channel persistence owner is needed
- `src/modules/scheduler/channel-manager/interfaces.ts` only for documentation/comment alignment; public `IChannelManager` shape is frozen unless a stopped/replanned plan approves otherwise
- `src/modules/scheduler/channel-manager/types.ts` only if tests or private owner types need local alignment; persisted `StoredChannelData` wire shape is frozen
- `src/modules/scheduler/channel-manager/constants.ts` only for read-only audit; storage key values are frozen unless a stopped/replanned plan approves otherwise
- `src/config/storageKeys.ts` and `src/core/orchestrator/storage/OrchestratorStorageContext.ts` only for read-only key/schema audit or tests; source changes here require replan unless they are docs/test-only proof alignment with unchanged key values
- `src/modules/scheduler/channel-manager/__tests__/ChannelPersistenceStore.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelRepository.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.persistence.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.transactional.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts` only if public facade behavior proof needs tightening
- `src/__tests__/orchestrator/storage-keys.test.ts` only if storage key scoping proof is touched
- `src/core/channel-tuning/__tests__/*` and `src/core/orchestrator/runtime/__tests__/*` only if public `setCurrentChannel` failure semantics change for caller-visible behavior
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` only during package closeout after clean review and verification
- `docs/architecture/CURRENT_STATE.md` and `docs/architecture/modules.md` only if implementation source audit proves current ownership truth changed

## Files Out Of Scope

- Any runtime/source file not named in `## Files In Scope`.
- `src/modules/scheduler/channel-manager/ContentResolver.ts`, ContentResolver tests, cache/coalescing/mapping work, and `FCP-17`.
- Public `IChannelManager` API widening, public facade removal, broad `ChannelManager` decomposition unrelated to current-channel persistence, and caller API changes.
- Storage key/schema migrations, compatibility read/write branches, changed key namespace formats, `lineup_channels_build_tmp_v1:*`, `lineup_current_channel_build_tmp_v1:*`, and channel setup record persistence.
- Plex auth, Plex discovery, Plex library, Plex stream URL/subtitle/transcode behavior, priority-one, navigation, UI/focus/motion/CSS, app-shell deferred screens, and Windows platform work.
- Completed `FCP-7` through `FCP-15` implementation work except as read-only guardrails.
- Pre-existing unrelated dirty/untracked files.

## Planner Self-Check

1. No unresolved package-level owner seam remains: `FCP-16-SF1` maps to `FCP-16-S1`; `FCP-16-SF2` maps to `FCP-16-S2`.
2. Adjacent contract/type changes are explicit: public `IChannelManager`, storage keys, scoped key format, `StoredChannelData`, and ContentResolver are frozen. If implementation needs to change them, it must stop and replan.
3. Files out of scope are not hidden implementation dependencies. Channel-tuning/orchestrator tests are proof surfaces only if public switch semantics change; ContentResolver is excluded and belongs to `FCP-17`.
4. Codanna evidence and insufficiencies are recorded, including weak document/test discovery and direct `rg` fallback for tests, keys, and current-channel references.
5. The plan uses repo-preferred owners: storage mechanics stay in `ChannelPersistenceStore`, normalization stays in `ChannelRepository`, manager-facing persistence coordination stays in `ChannelPersistenceCoordinator` or a package-local current-channel persistence owner if source-proven, and `ChannelManager` stays a public facade.
6. A fresh cleanup-loop session can start `ready_now_execution_unit` `FCP-16-S1` without deciding package membership, final owners, or verification depth.
7. The plan is execution-grade at seam/scope/verification level and deliberately leaves local helper names, exact private type names, and routine extraction shape to the cleanup worker.

## Architecture Seam Decision Gate

Approved seam:

- Execute serially. Start with `FCP-16-S1`.
- `FCP-16-S1` must name and align current-channel persistence semantics. The allowed implementation surface is `ChannelPersistenceStore` / `ChannelRepository` / `ChannelPersistenceCoordinator` / `ChannelManager` current-channel wiring and focused tests.
- Publicly visible behavior must be intentionally preserved unless the worker stops and replans: `ChannelManager.setCurrentChannel()` may continue to update in-memory current channel and emit `channelSwitch` despite current-channel storage failure only if the plan/test language makes that best-effort behavior explicit and source-justified.
- `replaceAllChannels()` must keep channel-blob persistence transactional before state replacement and keep separate current-channel persistence best-effort after state replacement unless a replan approves a behavior change.
- `FCP-16-S2` may run only after S1 source audit. It may extract a focused package-local current-channel/persistence-facade owner only if the current source still concentrates persistence semantics in `ChannelManager`; otherwise close S2 as source-justified no-code with one final owner: `src/modules/scheduler/channel-manager/ChannelManager.ts` as public facade delegating to `ChannelPersistenceCoordinator`.
- The public `ChannelManager` facade must stay. Callers should continue consuming `IChannelManager` public behavior, not storage mechanics or new raw owner internals.
- Storage keys and schema must be preserved: `lineup_channels_v4`, `lineup_channels_server_v1`, `lineup_current_channel_v4`, server/user suffix formats, and `StoredChannelData.currentChannelId`.
- Tests should prove public seams and owner behavior. Do not add test-only accessors or brittle private probes for helper internals.

Stop and replan if:

- a persistence schema migration, storage key migration, key namespace change, compatibility branch, or `StoredChannelData` wire-shape change is needed;
- public `IChannelManager` must widen, caller contracts must change, or `ChannelManager` facade removal becomes necessary;
- `setCurrentChannel()` must throw or stop emitting on storage failure, or `replaceAllChannels()` must make current-channel persistence transactional with the channel blob;
- ContentResolver, Plex, priority-one, navigation, UI/focus, app-shell deferred-screen, channel setup persistence, or Windows platform source changes are required;
- tests require private probing instead of public seam proof;
- S1 source audit proves `FCP-16-SF1` is already false and planned edits would be churn;
- S2 source audit proves the remaining `ChannelManager` breadth is non-persistence work, belongs to `FCP-17` or a later package, or would require a broader facade/API redesign;
- newly discovered residue changes package membership, execution-unit membership, final-owner accounting, or verification surface.

Absorb-now rule: absorb only newly discovered residue that stays within the same approved execution-unit goal, owner, seam/files, verification envelope, and final-owner accounting. Record absorbed residue in implementation/review output. Replan for new owners, wider verification, changed source-finding coverage, or changed execution-unit membership.

## Verification Commands

- Verification classification: `new regression/contract test required`

Primary proof mode: `contract-first` for current-channel persistence semantics and storage key/schema preservation, with `refactor-invariance` for any behavior-preserving package-local owner cleanup.

Plan validation:

- Run: `npm run plans:check`
  - Expected: this active tracked plan satisfies Universal Plan Core and FCP cleanup-overlay structure.
- Run after active plan creation/update: `npm run verify:docs`
  - Expected: docs/control-plane verification passes for the active plan. Run again during package closeout if checklist/current-state/modules/plan docs are updated.

Ready-now `FCP-16-S1` source-audit proof:

- Pre-edit source audit over `ChannelPersistenceStore.ts`, `ChannelRepository.ts`, `ChannelPersistenceCoordinator.ts`, `ChannelPersistenceSaveQueue.ts`, `ChannelManager.ts` current-channel methods, `interfaces.ts`, `types.ts`, `constants.ts`, `config/storageKeys.ts`, and `OrchestratorStorageContext.ts`.
  - Expected: implementation can name the exact strict/best-effort semantics, current public failure behavior, storage keys, scoped key formats, and persisted current-channel wire shape before editing.
- Post-edit source audit over the same files plus any new package-local current-channel persistence owner.
  - Expected: `FCP-16-SF1` no longer describes current source; strict vs best-effort method names either match distinct behavior or the duplicate method is collapsed/renamed behind a single explicit semantic; storage keys/schema are unchanged.
- Package-local static audits:
  - Run: `rg -n "lineup_channels_v4|lineup_channels_server_v1|lineup_current_channel_v4|CURRENT_CHANNEL_KEY|STORAGE_KEY|CURRENT_CHANNEL" src/modules/scheduler/channel-manager src/config/storageKeys.ts src/core/orchestrator/storage src/__tests__/orchestrator/storage-keys.test.ts`
    - Expected: key values and server/user suffix formats remain the existing values; any diff touching these files is explainable as tests/docs/source-audit proof, not migration.
  - Run: `rg -n "persistCurrentChannelId|persistCurrentChannelIdBestEffort|writeCurrentChannelId|readCurrentChannelId|saveCurrentChannelId|setCurrentChannel\\(|replaceAllChannels\\(" src/modules/scheduler/channel-manager src/core/channel-tuning src/core/orchestrator src/__tests__`
    - Expected: current-channel persistence calls remain inside scheduler/channel-manager plus existing public caller/test seams; no raw storage mechanics leak to callers.

Focused tests:

- Run: `npm test -- ChannelPersistenceStore ChannelRepository ChannelManager.persistence ChannelManager.transactional`
  - Expected: current-channel read/write normalization, blocked storage non-fatal behavior, key scoping, current-channel load precedence, set-current warning semantics, best-effort replacement persistence, transactional replace behavior, and warning backoff behavior pass with added/updated contract assertions.
- Run if `ChannelManager` public facade behavior or channel-switch emission semantics are touched: `npm test -- ChannelManager ChannelTuningCoordinator OrchestratorChannelSwitchRuntime`
  - Expected: public facade behavior, channel tuning switch flow, and orchestrator channel-switch runtime behavior remain stable under the approved current-channel persistence semantics.
- Run if storage key context or key scoping tests are touched: `npm test -- storage-keys`
  - Expected: channel manager storage keys remain scoped by selected server and active user with the existing key prefixes and suffix order.

`FCP-16-S2` proof, only after S1:

- Pre-edit/source-disposition audit over `ChannelManager.ts`, `ChannelPersistenceCoordinator.ts`, any new/current persistence owner, and facade tests.
  - Expected: either source proves persistence semantics are already owned outside the public facade after S1, or it identifies one focused package-local persistence-adjacent owner extraction with no public API widening.
- Focused tests as touched:
  - `npm test -- ChannelManager.persistence ChannelManager.transactional ChannelManager`
  - Expected: facade public behavior remains stable while persistence-adjacent responsibility is either source-justified in the coordinator/store or moved to the focused package-local owner.

Static and package gates:

- Run: `npm run typecheck`
  - Expected: no TypeScript errors after private semantics/owner/test changes.
- Run: `git diff --check`
  - Expected: no whitespace errors before commits and package closeout.
- Run: `npm run verify`
  - Expected: full UI/navigation/orchestrator/Plex/runtime gate passes before marking `FCP-16` complete because scheduler persistence affects runtime startup/channel switching.

Package closeout:

- Source-finding proof matrix for `FCP-16-SF1` and `FCP-16-SF2`.
  - Expected: each original source finding sentence is answered as fixed, source-disproved, deferred, or reclassified with one final owner. No detector/imported ids are used.
- Package-local old/replacement pattern audits for current-channel strict/best-effort semantics, storage key/schema preservation, and `ChannelManager` facade-local persistence responsibility.
- Run: `npm run plans:check`
- Run: `npm run verify:docs` if checklist/current-state/modules/plan docs are updated during closeout.
- Run: `git diff --check`
- Run: `npm run verify`
- Obtain clean implementation/closeout review before `FCP-17` starts.

## Rollback Notes

- Roll back by execution unit: first `FCP-16-S1`, then `FCP-16-S2` only if it runs.
- If current-channel persistence parity fails, restore the previous coordinator/store/facade behavior and keep any new public-seam tests that exposed the parity gap.
- If a strict-vs-best-effort rename/collapse changes channel-switch behavior unexpectedly, restore the public `ChannelManager.setCurrentChannel()` semantics before changing caller behavior.
- If storage key/schema preservation fails, revert the key/schema change rather than adding compatibility migration paths.
- If S2 extraction proves broad or speculative, stop the extraction, leave the public facade in place, and record source-justified retained ownership or replan with a new final owner.
- If docs/checklist closeout fails, leave reviewed source/test changes intact and fix tracked docs in a separate controller-owned closeout pass.

## Commit Checkpoints

- `FCP-16-S1` implementation checkpoint: current-channel persistence semantics alignment plus focused persistence/facade tests and source audits.
- `FCP-16-S2` implementation checkpoint only if S1 source audit admits it: persistence-adjacent `ChannelManager` facade-local owner cleanup or source-justified no-code disposition plus focused facade tests/audits.
- Closeout checkpoint: after implementation has clean review and `npm run verify` passes, update `ARCHITECTURE_CLEANUP_CHECKLIST.md` and any narrow current architecture docs only if source audit proves architecture truth changed. Keep active tracked plan progress/checklist closeout separate from implementation commits unless the controller explicitly chooses a tracked-doc commit.

## Package Decomposition

- `package_id`: `FCP-16`
- `checklist_token`: `FCP-16`
- `source_finding_ids`:
  - `FCP-16-SF1`
  - `FCP-16-SF2`
- `slice_table`:

### `FCP-16-S1` Current-Channel Persistence Semantics

- `goal`: clarify and align current-channel persistence semantics across store/repository/coordinator/facade paths while preserving public current-channel behavior, warning behavior, storage keys, and persisted schema.
- `areas/files`:
  - `src/modules/scheduler/channel-manager/ChannelPersistenceStore.ts`
  - `src/modules/scheduler/channel-manager/ChannelRepository.ts`
  - `src/modules/scheduler/channel-manager/ChannelPersistenceCoordinator.ts`
  - `src/modules/scheduler/channel-manager/ChannelPersistenceSaveQueue.ts` only if warning/backoff semantics need naming alignment
  - `src/modules/scheduler/channel-manager/ChannelManager.ts` current-channel wiring only
  - `src/modules/scheduler/channel-manager/interfaces.ts` comments only if needed
  - `src/modules/scheduler/channel-manager/types.ts` only if private type alignment is needed, with `StoredChannelData` wire shape preserved
  - key/schema audit surfaces named in `## Files In Scope`
  - affected persistence/facade tests
- `source_finding_ids`:
  - `FCP-16-SF1`
- `verification`: pre/post source audits; package-local key/schema and current-channel call audits; `npm test -- ChannelPersistenceStore ChannelRepository ChannelManager.persistence ChannelManager.transactional`; caller/facade/storage-key tests as touched; `npm run typecheck`; `git diff --check`; package closeout `npm run verify`.
- `dependencies`: `FCP-15` closeout complete; no code dependency on completed FCP packages beyond guardrail reading.
- `stop_condition`: stop if storage key/schema migration, public API widening, caller-visible channel-switch behavior change, ContentResolver work, non-persistence ChannelManager decomposition, or private-probe-only tests are needed.
- `handoff_condition`: the `FCP-16-SF1` sentence is false for current source; any retained best-effort current-channel failure behavior is explicit and tested; key/schema audits prove preservation.
- `serial_only`: true
- `parallel_justification`: S1 defines the semantics that determines whether S2 is needed; parallelizing would make S2 decide from stale source.

### `FCP-16-S2` Persistence-Adjacent ChannelManager Facade-Local Owner Cleanup

- `goal`: after S1, extract or confirm focused package-local ownership only for persistence-adjacent `ChannelManager` responsibility that remains source-proven; otherwise close as source-justified no-code with one final owner.
- `areas/files`:
  - `src/modules/scheduler/channel-manager/ChannelManager.ts`
  - `src/modules/scheduler/channel-manager/ChannelPersistenceCoordinator.ts`
  - new package-local current-channel/persistence-facade owner only if S1 source audit proves need
  - `src/modules/scheduler/channel-manager/interfaces.ts` comments only if needed
  - affected facade/persistence tests
- `source_finding_ids`:
  - `FCP-16-SF2`
- `verification`: S1 post-edit source audit as entry gate; facade responsibility audit; `npm test -- ChannelManager.persistence ChannelManager.transactional ChannelManager` as touched; `npm run typecheck`; `git diff --check`; package closeout `npm run verify`.
- `dependencies`: `FCP-16-S1` complete with source audit proving whether S2 requires code or no-code closure.
- `stop_condition`: stop if required work becomes broad `ChannelManager` decomposition, non-persistence authoring/import/cache/retry cleanup, ContentResolver work, public API widening, caller changes, storage migration, or a new owner outside scheduler/channel-manager.
- `handoff_condition`: the `FCP-16-SF2` sentence is false or explicitly source-reclassified for the persistence seam; public facade remains; final owner and revisit trigger are recorded for any accepted residual.
- `serial_only`: true
- `parallel_justification`: S2 is conditional on S1 evidence and must not start until the current-channel semantics seam is settled.

- `coverage_check`:
  - `FCP-16-SF1` maps exactly to `FCP-16-S1`.
  - `FCP-16-SF2` maps exactly to `FCP-16-S2`; S2 closed as source-justified no-code with final owner `ChannelManager` public facade, delegating persistence coordination to `ChannelPersistenceCoordinator`.
- `ready_now_execution_unit`: none; package complete
- `ready_now_slice`: none; package complete
- `recommended_slice_order`: none; package complete
- `parallel_execution_policy`: serial package. No parallel worker split and no execution wave are approved because S2 depends on the semantic and source-audit outcome of S1.

## Priority-Exit Readiness

`FCP-16` is the only planned package for this FCP priority. Package closeout may mark `FCP-16` complete only after:

- `FCP-16-SF1`
  - planned disposition after this plan: `resolved`
  - current owner: `src/modules/scheduler/channel-manager/ChannelPersistenceCoordinator.ts` with `ChannelPersistenceStore` / `ChannelRepository` storage ownership
  - closeout proof: current-channel strict/best-effort semantics are named, aligned, source-audited, and tested; storage keys/schema are preserved or the package is stopped/replanned.
- `FCP-16-SF2`
  - planned disposition after this plan: `resolved`
  - current owner: `src/modules/scheduler/channel-manager/ChannelManager.ts` public facade with persistence coordination delegated to `ChannelPersistenceCoordinator`
  - closeout proof: after S1, any remaining persistence-adjacent facade responsibility is extracted to a focused package-local owner or source-justified as retained facade wiring with one final owner.
- Security triage expectation: no open `P0` security findings are admitted by this source-backed package; if implementation discovers exact open/deferred `P0` security issue ids, stop and replan before next-priority work.
- The proof matrix records whether each original source finding still describes current source after implementation.
- Storage keys, server/user key scoping, `StoredChannelData` schema, current-channel load precedence, current-channel write failure behavior, warning behavior, and public `ChannelManager` facade behavior are confirmed preserved or intentionally replanned.
- Required focused tests, source audits, `npm run typecheck`, `git diff --check`, and `npm run verify` pass.
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` mini-record is updated with plan path, verification evidence, proof matrix, follow-ups, and handoff.
- A clean implementation/closeout review approves the package.
- No `FCP-17` starts before the checklist mini-record for `FCP-16` is completed with source-audit proof, verification evidence, clean review evidence, and owned follow-ups.
