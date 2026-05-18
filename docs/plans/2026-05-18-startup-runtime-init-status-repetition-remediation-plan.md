**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** standalone remediation

# Startup Runtime Init Status Repetition Remediation Plan

## Goal

Remediate `review::.::holistic::design_coherence::startup_runtime_init_repetition` by replacing the repeated playback-runtime status ceremony in `InitializationCoordinator._initializePlaybackRuntime()` with one coordinator-local helper seam.

`ready_now_execution_unit: SRIS-1-initialization-coordinator-runtime-status-helper`

The long-term owner remains `src/core/initialization/InitializationCoordinator.ts`: it is the documented startup sequencing collaborator between app shell and orchestrator, and the repeated work is startup status sequencing rather than UI focus, overlay rendering, Plex, scheduler, or navigation policy.

## Non-Goals

- Do not implement code in the planning session.
- Do not update `ARCHITECTURE_CLEANUP_CHECKLIST.md`.
- Do not touch constants boilerplate, AppOrchestrator JSDoc, EPG title policy, or channel error-context findings.
- Do not change startup phase ordering, readiness publication, post-ready routing, EPG warmup, core player UI initialization, resume listeners, or global error handling.
- Do not extract a new production collaborator unless source discovery disproves the private-helper seam.
- Do not change public module status ids, status names, load-time semantics, or disabled scheduler behavior.
- Do not change UI focus-visible behavior, overlay DOM composition, accessibility, or runtime display behavior.
- Do not grow allowlisted production hotspots unless the same change records rationale plus decomposition or revisit trigger.

## Parent Architecture Alignment

This standalone cleanup follows `docs/architecture/CURRENT_STATE.md`: `src/core/initialization/InitializationCoordinator.ts` is the focused startup sequencing collaborator between app shell and orchestrator. The remediation should make that owner more coherent without moving runtime status ownership into overlay classes, player modules, scheduler/channel-manager, AppOrchestrator, or app-shell UI owners.

No checklist update is expected unless a later controller intentionally promotes this standalone remediation into tracked cleanup backlog.

## Required Reading

Read in this order before implementation or review:

1. `docs/AGENTIC_DEV_WORKFLOW.md`
2. `agents.md`
3. `docs/agentic/session-prompts/cleanup-loop.md`
4. `docs/agentic/codanna-playbook.md`
5. `docs/architecture/CURRENT_STATE.md`
6. `docs/architecture/file-shape-guardrails.md`
7. `docs/agentic/plan-authoring-standard.md`
8. this plan
9. `src/core/initialization/InitializationCoordinator.ts`
10. `src/core/initialization/__tests__/InitializationCoordinator.test.ts`
11. `src/__tests__/orchestrator/init.test.ts`

Freshness gate: if `InitializationCoordinator.ts`, the coordinator tests, `docs/architecture/CURRENT_STATE.md`, `docs/architecture/file-shape-guardrails.md`, or the Desloppify queue changed after this plan was written, refresh this plan before implementation.

## Required Skills

- `architecture-boundaries`
- `verification-strategy`
- `execution-plan-authoring`
- `desloppify`
- `review-request` for adversarial plan or implementation review when the controller runs the loop
- `review-adjudication` for material reviewer findings
- `closeout-verification` before claiming the remediation is done

`ui-composition-patterns` remains adjacent but is not required for this execution unit because the approved scope does not change overlay DOM composition, focus behavior, visual timing, ARIA, or TV-facing UI interaction. If implementation starts changing those behaviors, stop and replan with `ui-composition-patterns`.

## Codanna Discovery

- `get_index_info`: 12712 symbols across 819 files; semantic search enabled with 132 embeddings; index created/updated about 18 hours before this plan.
- `semantic_search_with_context "InitializationCoordinator _initializePlaybackRuntime updateModuleStatus runtime modules startup" lang:typescript`: found `InitializationCoordinator` at `src/core/initialization/InitializationCoordinator.ts` with symbol id `10974`; also surfaced `InitializationCallbacks`.
- `find_symbol InitializationCoordinator`: exactly one class match, `src/core/initialization/InitializationCoordinator.ts:152-754`, symbol id `10974`; Codanna reports use from AppOrchestrator methods such as `_buildCoordinatorAssemblyInput`, `_requireInitializationCoordinator`, and `_resumeStartupAfterProfileSwitch`.
- `search_symbols initializePlaybackRuntime`: exactly one method match, `_initializePlaybackRuntime` at `src/core/initialization/InitializationCoordinator.ts:493`, symbol id `11016`.
- `find_symbol _initializePlaybackRuntime`: method spans `src/core/initialization/InitializationCoordinator.ts:493-595`, symbol id `11016`.
- `find_callers _initializePlaybackRuntime`: one direct caller, `runStartup` in the same coordinator.
- `analyze_impact 10974`: broader coordinator impact includes `AppOrchestrator` startup, profile-switch, coordinator assembly, and initialization-coordinator requirement paths.
- `analyze_impact 11016`: runtime-init impact flows through `runStartup`, AppOrchestrator `start`, selected-server/profile-switch resume paths, auth/server/profile resume registration, and profile-select sign-out/switch user flows.
- `get_calls 11016`: confirms calls to channel-manager `loadChannels`, video-player media-session request, repeated `Date.now`, and multiple `initialize` methods. Some `initialize` targets are imprecisely attributed by the index, so direct source reads are the authority for exact overlay/player calls.
- `search_documents "InitializationCoordinator startup sequencing collaborator file-shape guardrails"`: weak/noisy for the exact architecture claim; direct tracked-doc reads of `CURRENT_STATE.md` and `file-shape-guardrails.md` were required.
- Fallback reads: direct `nl`/`rg` source reads confirmed the repeated status ceremony, current tests, line count, plan-standard requirements, and the Desloppify queue/disposition commands.

## Impact Snapshot

Current source proof:

- `InitializationCoordinator._initializePlaybackRuntime()` uses one `startTime` and repeats `updateModuleStatus(id, 'initializing')`, an initializer/load call, then `updateModuleStatus(id, 'ready', undefined, Date.now() - startTime)` for:
  - `channel-manager`
  - `video-player`
  - `player-osd-ui`
  - `channel-number-overlay-ui`
  - `channel-badge-ui`
  - `mini-guide-ui`
  - `channel-transition-ui`
- `channel-scheduler` is adjacent but not the same ceremony: it has no initializing step and must keep the current ready/disabled branch.
- EPG and core player UI are outside this helper seam: EPG initialization owns idempotence/readiness/warmup behavior, and core player UI is called after playback runtime initialization from `runStartup`.
- Current tests cover startup/resume, server connection policy, readiness publication, EPG eager/warmup behavior, and post-ready routing. They do not directly assert the playback-runtime status ceremony across the repeated runtime UI modules.
- `src/__tests__/orchestrator/init.test.ts` only checks that the orchestrator seeds selected status ids before initialization; it is not enough to prove runtime status sequencing.
- `src/core/initialization/InitializationCoordinator.ts` is 754 lines, matching the allowlist baseline in `docs/architecture/file-shape-guardrails.md`. No net growth is allowed without same-change guardrail rationale and revisit trigger.
- Desloppify active queue has four items. `desloppify next` currently points to `review::.::holistic::ai_generated_debt::obvious_constant_comment_boilerplate`, so controller-side queue reordering may be needed before executing this design-coherence item.

Desloppify target:

- Exact issue id: `review::.::holistic::design_coherence::startup_runtime_init_repetition`
- Intended disposition: `fixed` after source/test verification proves the repeated ceremony was collapsed into one coordinator-local helper and behavior stayed equivalent.
- Expected resolve command after implementation and verification:

```bash
desloppify plan resolve "review::.::holistic::design_coherence::startup_runtime_init_repetition" --note "Collapsed repeated playback runtime module status ceremony in InitializationCoordinator into a coordinator-local helper while preserving startup order, module ids, load-time reporting, scheduler disabled handling, and runtime initialization behavior; verified with focused InitializationCoordinator status sequencing tests plus typecheck and npm run verify." --confirm
```

If the controller wants this item to become `desloppify next` before implementation, use a queue reorder targeted only at this issue, for example:

```bash
desloppify plan reorder "review::.::holistic::design_coherence::startup_runtime_init_repetition" top
```

Do not resolve or skip the constants, AppOrchestrator JSDoc, or channel error-context findings in this execution unit.

## Files In Scope

- `src/core/initialization/InitializationCoordinator.ts`
- `src/core/initialization/__tests__/InitializationCoordinator.test.ts`

Optional only if implementation proves the focused coordinator test cannot cover seeded status id behavior:

- `src/__tests__/orchestrator/init.test.ts`

## Files Out Of Scope

- `ARCHITECTURE_CLEANUP_CHECKLIST.md`
- `.desloppify` state except the exact reorder/resolve command for `review::.::holistic::design_coherence::startup_runtime_init_repetition`
- `src/core/orchestrator/AppOrchestrator.ts`
- `src/core/app-shell/**`
- `src/modules/ui/**` overlay/player UI implementations
- `src/modules/player/**`
- `src/modules/scheduler/**`
- `src/modules/plex/**`
- `src/modules/navigation/**`
- `src/core/initialization/InitializationStartupPolicy.ts`
- `src/core/initialization/RecoverableModuleStatusError.ts`
- constants/JSDoc/EPG/error-consistency cleanup files unrelated to the exact Desloppify issue

## Planner Self-Check

- Unresolved architecture seam: no. The status ceremony belongs to the documented startup sequencing coordinator.
- Adjacent contract changes: none approved. The helper must be private/local to the coordinator and must not change injected dependency or callback contracts.
- Out-of-scope reliance: AppOrchestrator, overlay modules, player modules, scheduler modules, Plex modules, and navigation modules stay out because the helper wraps only the existing coordinator-side calls.
- Codanna evidence and fallback reads are recorded, including weak document search and imprecise call attribution fallback to source.
- The work improves the existing owner instead of growing AppOrchestrator or pushing startup status policy into UI/runtime modules.
- A fresh session does not need to choose the owner, issue id, queue disposition, or verification strategy.
- This is execution-grade for the single approved unit.

## Architecture Seam Decision Gate

Implement only `ready_now_execution_unit: SRIS-1-initialization-coordinator-runtime-status-helper`.

Approved seam:

- Add a small private/coordinator-local helper in `InitializationCoordinator.ts` that owns the repeated "mark initializing, run initializer, mark ready with elapsed startup time" ceremony for runtime modules.
- `_initializePlaybackRuntime()` remains the sequencing owner and still names the ordered runtime steps.
- The helper may accept the module id, shared start time, and a sync-or-async initializer callback. Ordinary local naming/type-shape decisions are delegated to the implementer.
- Preserve current step order exactly: channel manager, scheduler status branch, video player, player OSD, channel number overlay, channel badge, mini guide, channel transition.
- Preserve `configureChannelManagerStorage()` before `channelManager.loadChannels()`.
- Preserve video-player config spreading and `requestMediaSession()` after successful player initialization but before marking `video-player` ready.
- Preserve each overlay's existing config argument.
- Preserve missing-dependency behavior: absent optional runtime modules remain silently untouched, while absent scheduler still sets `channel-scheduler` to `disabled`.
- Preserve the shared `startTime` load-time calculation unless source review proves the current status contract is intentionally per-step and tests/docs must be updated first.

Stop and replan if implementation requires:

- changing `InitializationDependencies`, `InitializationCallbacks`, `ModuleStatus`, or public orchestrator contracts
- changing startup phase semantics, queued startup behavior, EPG initialization/warmup, core player UI initialization, post-ready routing, or resume listener behavior
- adding a new production file or collaborator
- moving status ownership into UI, player, scheduler, Plex, navigation, app-shell, or AppOrchestrator code
- changing overlay DOM/focus/ARIA/visual behavior
- adding compatibility shims, fallbacks, or no-op adapters
- increasing `InitializationCoordinator.ts` beyond the 754-line allowlist baseline without same-change rationale and decomposition/revisit trigger
- broadening into any other Desloppify queue item

Debt-regression gate:

- Guardrail category: hotspot growth and source signal.
- Owner that must not grow: `InitializationCoordinator.ts` as a 754-line allowlisted startup coordinator.
- Forbidden shortcut: replacing repetition with a broad utility dump, shared cross-module helper, or config table that hides startup order and per-step side effects.
- Proof: line-count/maintainability verification plus focused source review showing `_initializePlaybackRuntime()` still exposes startup order and the helper owns only status ceremony.

## Verification Commands

- Verification classification: `new regression/contract test required`

Planning artifact verification:

- Docs proof mode: `broader integration/manual proof required`
- Run: `npm run verify:docs`
- Expected: passes with this active plan satisfying the serious-plan structure and no stale tracked-plan references.

Implementation verification:

- Add or update focused tests in `src/core/initialization/__tests__/InitializationCoordinator.test.ts` that prove all runtime status-wrapped steps still publish `initializing` before their initializer and `ready` after it, with the existing module ids.
- The elapsed-time proof must be deterministic: mock or spy on `Date.now` with distinct values for playback-runtime start and later initializer completion points, then assert that at least one delayed later step, such as `mini-guide-ui` or `channel-transition-ui`, reports elapsed time from the shared playback-runtime `startTime`, not from a per-helper/per-step invocation start.
- The test should also prove the special cases remain special: `channel-scheduler` stays ready/disabled without an initializing ceremony, and missing optional runtime modules do not publish new statuses.
- Add cheap failure-path preservation coverage while touching this seam: a throwing/rejecting runtime initializer must not publish that module's `ready` status, and `videoPlayer.requestMediaSession()` must still occur after successful `videoPlayer.initialize()` but before `video-player` is marked ready.
- Run:

```bash
npm test -- --runTestsByPath src/core/initialization/__tests__/InitializationCoordinator.test.ts src/__tests__/orchestrator/init.test.ts
npm run typecheck
npm run verify:maintainability
npm run verify
```

- Expected: focused coordinator tests pass, including shared-start elapsed-time proof, no-ready-on-failure proof, and `requestMediaSession()` ordering proof; orchestrator init seeding remains intact; typecheck passes; maintainability confirms no unreviewed allowlist growth; full verification passes because this is runtime startup work.

Why this depth matches risk:

- The code change should be behavior-preserving, but existing tests do not directly protect the repeated status ceremony, shared elapsed-time contract, or media-session/status ordering that the cleanup changes. A focused regression/contract test is required so the helper is proven through public startup behavior rather than private probing.
- `npm run verify` is required by repo policy because the implementation touches runtime startup behavior.

## Rollback Notes

Rollback is straightforward if status sequencing changes unexpectedly:

- Revert the helper extraction in `InitializationCoordinator.ts` and restore the explicit per-module status blocks.
- Revert only the focused status sequencing test additions if they assert helper-shaped behavior instead of public startup behavior.
- Do not revert unrelated dirty/untracked files or other active plan artifacts.
- Do not mark the Desloppify issue resolved unless the final source still removes the repetition and verification passes.

## Commit Checkpoints

- Planning checkpoint: this plan only; run `npm run verify:docs`; do not stage or commit unless the controller asks for a docs-only checkpoint.
- Implementation checkpoint: one focused code/test commit may be made by the implementation worker after passing focused tests, `npm run typecheck`, `npm run verify:maintainability`, and `npm run verify`; exclude active tracked plan docs from that implementation commit unless the controller explicitly chooses a separate docs checkpoint.
- Desloppify checkpoint: after implementation verification, resolve only `review::.::holistic::design_coherence::startup_runtime_init_repetition` with the command in `## Impact Snapshot`; do not resolve adjacent queue items.
