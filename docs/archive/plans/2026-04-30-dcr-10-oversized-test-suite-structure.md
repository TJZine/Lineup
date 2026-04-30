# DCR-10 Oversized Test Suite Structure Policy Plan

**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

## Goal

Complete the `DCR-10` package from `ARCHITECTURE_CLEANUP_CHECKLIST.md` by making the affected oversized tests harder to grow accidentally:

- Establish and enforce the ChannelManager split policy before any new transactional, reorder, or error-semantics coverage lands.
- Establish the SettingsScreen split policy before constructor/dependency coverage lands.
- Implement the SettingsScreen constructor cleanup in this package by replacing the eight positional parameters with one deps object and targeted deps-object tests.

The constructor cleanup is not migrated out by this plan. Moving it to another Settings package requires explicit maintainer approval plus a plan update that names the destination, owner, revisit trigger, and why `DCR-10` can still close.

## Non-Goals

- Do not rewrite the full ChannelManager or SettingsScreen test suites.
- Do not change ChannelManager production behavior, persistence semantics, Plex behavior, scheduler policy, or content resolution semantics.
- Do not redesign SettingsScreen UI, focus behavior, settings persistence, theme semantics, or profile switching behavior.
- Do not add constructor coverage to the catch-all `SettingsScreen.test.ts` except for updating existing helper wiring to the new object-shaped constructor.
- Do not use Desloppify output, imported issue ids, score deltas, queue rows, FCP `source_finding_id` matrices, or `source_finding_id` proof as DCR intake, membership, or closeout proof.
- Do not start `DCR-EXIT`; it remains blocked until `DCR-10` is implemented, reviewed, and closed.

## Parent Priority Alignment

`DCR-10` is checklist-linked cleanup owned by the affected test-suite structure owners. It advances the active architecture cleanup queue by preventing hotspot-adjacent test files from absorbing more unrelated responsibilities while DCR work continues.

Current architecture truth still identifies `src/modules/scheduler/channel-manager/ChannelManager.ts` and `src/modules/ui/settings/SettingsScreen.ts` as hotspots. The plan keeps ChannelManager production code out of scope and limits SettingsScreen production changes to the approved constructor seam plus app-shell construction wiring. UI ownership stays with `src/modules/ui/settings/`; app-shell remains a deferred-screen composition owner and must only adapt to the new constructor contract.

`DCR-EXIT` cannot begin until this package is complete and the checklist is updated by the implementation closeout pass.

## Required Reading

1. `agents.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/cleanup-loop.md`
4. `docs/agentic/plan-authoring-standard.md`
5. `docs/agentic/codanna-playbook.md`
6. `docs/agentic/session-prompts/README.md`
7. `docs/architecture/CURRENT_STATE.md`
8. `ARCHITECTURE_CLEANUP_CHECKLIST.md` section `DCR-10`
9. This plan
10. `src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts`
11. `src/modules/scheduler/channel-manager/__tests__/ChannelManager.transactional.test.ts`
12. `src/modules/scheduler/channel-manager/__tests__/ChannelManager.import-order.test.ts`
13. `src/modules/scheduler/channel-manager/__tests__/ChannelManager.error-semantics.test.ts`
14. `src/modules/scheduler/channel-manager/__tests__/ChannelManager.stale-fallback.test.ts`
15. `src/modules/scheduler/channel-manager/__tests__/channel-manager-test-helpers.ts`
16. `src/modules/ui/settings/SettingsScreen.ts`
17. `src/modules/ui/settings/__tests__/SettingsScreen.test.ts`
18. `src/core/app-shell/AppLazyScreenRegistry.ts`
19. `src/core/app-shell/__tests__/AppLazyScreenRegistry.test.ts`

Freshness gate: before implementation, rerun the pre-implementation freshness audits in `## Verification Commands`. If the SettingsScreen constructor call sites, ChannelManager focused-test files, or DCR-10 checklist membership changed materially after this plan was written, refresh the plan before editing source or tests.

## Required Skills

- `architecture-boundaries`
- `ui-composition-patterns`
- `verification-strategy`
- `execution-plan-authoring`
- `model-selection`

Do not add `persistence-boundaries` unless the implementation changes `SettingsStore` storage semantics, settings persistence ownership, or ChannelManager persistence semantics. Do not add `plex-integration-boundaries` unless discovery unexpectedly touches Plex-owned auth, discovery, library, stream, subtitle, or playback URL behavior.

Model-selection result:

```text
MODEL_SUGGESTION
PLANNER: gpt-5.5 high
IMPLEMENTER: gpt-5.5 medium
REVIEWER: gpt-5.5 high
WHY: Tier 3 checklist-linked cleanup touches hotspot-adjacent SettingsScreen construction, app-shell UI composition wiring, oversized test-suite policy, and checklist closeout. Risk score >=4 from hotspot files, cross-module construction wiring, multiple boundary skills, and closeout consequences. Use gpt-5.4 high/medium/high fallback if gpt-5.5 is unavailable.
```

## Codanna Discovery

Fresh evidence captured on 2026-04-30:

- Codanna tools were not exposed in this planner session. There was no callable Codanna MCP/tool namespace available, matching the controller note that `tool_search` found no Codanna tools. Deterministic `rg`, `wc`, and direct reads were used as the fallback required by `docs/agentic/codanna-playbook.md`.
- Direct tracked-doc reads refreshed `agents.md`, `docs/AGENTIC_DEV_WORKFLOW.md`, `docs/agentic/session-prompts/cleanup-loop.md`, `docs/agentic/plan-authoring-standard.md`, `docs/agentic/codanna-playbook.md`, `docs/agentic/session-prompts/README.md`, `docs/architecture/CURRENT_STATE.md`, and `ARCHITECTURE_CLEANUP_CHECKLIST.md` section `DCR-10`. The controller/user input named `AGENTS.md`; the repo also has the lowercase tracked-doc entrypoint `agents.md`, so fresh-session reading should use `agents.md`.
- `git status --short` showed only unrelated untracked files under `docs/plans/` and `docs/agentic/evals/baseline-summaries/`; no in-scope source, test, checklist, or current-state files were dirty before this plan was created.
- `find docs/plans -maxdepth 1 -type f -name '*dcr-10*' -o -name '*oversized*'` found no active DCR-10 plan.
- `wc -l src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts src/modules/ui/settings/__tests__/SettingsScreen.test.ts` reported 1610 lines for `ChannelManager.test.ts` and 1033 lines for `SettingsScreen.test.ts`.
- `rg --files src/modules/scheduler/channel-manager/__tests__ src/modules/ui/settings/__tests__` confirmed existing focused ChannelManager files: `ChannelManager.transactional.test.ts`, `ChannelManager.error-semantics.test.ts`, `ChannelManager.import-order.test.ts`, `ChannelManager.stale-fallback.test.ts`, and `channel-manager-test-helpers.ts`.
- `rg -n "new SettingsScreen\\(" src -S` found exactly two current construction sites: `src/modules/ui/settings/__tests__/SettingsScreen.test.ts` and `src/core/app-shell/AppLazyScreenRegistry.ts`.
- `rg -n "undefined" src/modules/ui/settings/__tests__ src/core/app-shell/__tests__ -S` found the SettingsScreen constructor placeholder in `SettingsScreen.test.ts`; other `undefined` matches were ordinary expectations or unrelated mocked promise values.

## Impact Snapshot

Current source facts:

- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts` is still the 1610-line catch-all suite and contains broad `replaceAllChannels`, `importChannels`, channel ordering, error, and fallback coverage.
- Existing focused ChannelManager tests already cover transactional persistence, import/reorder contracts, error contracts, and stale fallback. These are the approved homes for new coverage in those domains.
- `DCR-10-S1` must do more than add a prose note: it must perform a current source audit, encode the split policy in the package test layout, and move or source-disprove any catch-all tests whose assertion focus belongs in the existing focused files.
- `src/modules/ui/settings/SettingsScreen.ts` currently has positional constructor parameters: `container`, `getNavigation`, `onSubtitleModeChange`, `onGuideSettingChange`, `getActiveUsername`, `getTheme`, `setTheme`, and `settingsStore`.
- `src/modules/ui/settings/__tests__/SettingsScreen.test.ts` currently has a `createScreen` helper that passes `undefined` as the positional placeholder for `onSubtitleModeChange`.
- `src/core/app-shell/AppLazyScreenRegistry.ts` constructs `SettingsScreen` with positional arguments from `createSettingsRuntimePorts()`.
- `src/core/app-shell/__tests__/AppLazyScreenRegistry.test.ts` currently asserts the SettingsScreen constructor argument count and indexes into positional arguments.
- Settings focus extraction is already closed and is not reopened by this plan.

## Package Decomposition

- `package_id`: `DCR-10`
- `checklist_token`: `DCR-10`
- `package_issue_ids`:
  - `DCR-10-A1`
  - `DCR-10-A2`
  - `DCR-10-A3`
  - `DCR-10-D1`
- `slice_table`:

### `DCR-10-S1`

- `goal`: Establish the ChannelManager test split policy from current source, using the existing focused DCR-era files as the approved homes for transactional, reorder/import-order, error-semantics, and stale-fallback coverage.
- `areas/files`:
  - `src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts`
  - `src/modules/scheduler/channel-manager/__tests__/ChannelManager.transactional.test.ts`
  - `src/modules/scheduler/channel-manager/__tests__/ChannelManager.import-order.test.ts`
  - `src/modules/scheduler/channel-manager/__tests__/ChannelManager.error-semantics.test.ts`
  - `src/modules/scheduler/channel-manager/__tests__/ChannelManager.stale-fallback.test.ts`
  - `src/modules/scheduler/channel-manager/__tests__/channel-manager-test-helpers.ts`
- `exact_issue_ids`: `DCR-10-A1`
- `verification`: Source audit the catch-all suite for `replaceAllChannels`, `importChannels`, `reorderChannels`, transactional, error, and stale fallback assertions; move tests whose assertion focus belongs to existing focused files or record source-disproof in implementation notes with exact evidence; run targeted ChannelManager focused and catch-all tests.
- `dependencies`: None. This slice must run before Settings work.
- `stop_condition`: Stop and replan if enforcing the policy requires ChannelManager production changes, new persistence semantics, broad helper rewrites outside the package test utilities, or a new focused file not justified by the existing file taxonomy.
- `handoff_condition`: Future transactional, reorder/import-order, error-semantics, and stale-fallback coverage has an explicit focused-file home; no DCR-related coverage needs to be added to the catch-all suite; any remaining matching strings in `ChannelManager.test.ts` are audited and either moved or justified as non-policy residuals.
- `serial_only`: yes
- `parallel_justification`: This slice is the package policy gate. It must complete before Settings constructor work so the cleanup-loop can review one policy decision before changing UI construction.

### `DCR-10-S2`

- `goal`: Replace SettingsScreen positional construction with a deps object and add targeted constructor/dependency tests outside the catch-all suite.
- `areas/files`:
  - `src/modules/ui/settings/SettingsScreen.ts`
  - `src/modules/ui/settings/index.ts`
  - `src/modules/ui/settings/__tests__/SettingsScreen.test.ts`
  - `src/modules/ui/settings/__tests__/SettingsScreen.deps.test.ts`
  - `src/modules/ui/settings/__tests__/settings-screen-test-helpers.ts`
  - `src/core/app-shell/AppLazyScreenRegistry.ts`
  - `src/core/app-shell/__tests__/AppLazyScreenRegistry.test.ts`
- `exact_issue_ids`: `DCR-10-A2`, `DCR-10-A3`, `DCR-10-D1`
- `verification`: Source audit SettingsScreen call sites and undefined placeholders; targeted SettingsScreen deps-object tests; affected SettingsScreen catch-all suite after helper migration; affected AppLazyScreenRegistry tests; `npm run typecheck`; `npm run verify` because production UI/app-shell construction changes.
- `dependencies`: Requires `DCR-10-S1` clean review or explicit controller approval to proceed after S1 completion. Constructor migration out is not approved by this plan.
- `stop_condition`: Stop and replan if constructor cleanup needs SettingsStore/storage semantics changes, ChannelManager persistence changes, Settings focus behavior changes, broad Settings redesign, new app-shell runtime-port ownership, a compatibility positional overload, or maintainer-approved migration out of DCR-10.
- `handoff_condition`: `SettingsScreen` has one object-shaped constructor contract; active call sites use named deps; the test helper no longer passes placeholder `undefined`; constructor/dependency coverage lives in a focused test file or local test helper, not as new catch-all coverage.
- `serial_only`: yes
- `parallel_justification`: Although the file writes are mostly disjoint, DCR-10 has one package closeout surface and S2 depends on S1 finishing the split-policy gate. Parallel execution is unavailable unless a reviewed replan proves disjoint writes, disjoint verification, and one controller integration gate.

- `coverage_check`:
  - `DCR-10-A1` maps exactly to `DCR-10-S1`; final owner is `DCR-10`.
  - `DCR-10-A2` maps exactly to `DCR-10-S2`; final owner is `DCR-10`.
  - `DCR-10-A3` maps exactly to `DCR-10-S2`; final owner is `DCR-10`.
  - `DCR-10-D1` maps exactly to `DCR-10-S2`; final owner is `DCR-10`, with the decision frozen to implement the deps-object constructor cleanup in this package.
- `recommended_slice_order`:
  1. `DCR-10-S1`
  2. `DCR-10-S2`
- `ready_now_slice`: `DCR-10-S1`
- `ready_now_execution_unit`: `DCR-10-S1`
- `parallel_execution_policy`: unavailable. Execute serially in the recommended order. Any parallelization requires a reviewed plan update proving disjoint writes, disjoint verification, and one controller-owned integration gate.

## Files In Scope

- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.transactional.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.import-order.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.error-semantics.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.stale-fallback.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/channel-manager-test-helpers.ts`
- `src/modules/ui/settings/SettingsScreen.ts`
- `src/modules/ui/settings/index.ts`
- `src/modules/ui/settings/__tests__/SettingsScreen.test.ts`
- `src/modules/ui/settings/__tests__/SettingsScreen.deps.test.ts`
- `src/modules/ui/settings/__tests__/settings-screen-test-helpers.ts`
- `src/core/app-shell/AppLazyScreenRegistry.ts`
- `src/core/app-shell/__tests__/AppLazyScreenRegistry.test.ts`
- `ARCHITECTURE_CLEANUP_CHECKLIST.md`, closeout status only after implementation and clean review.
- `docs/plans/2026-04-30-dcr-10-oversized-test-suite-structure.md`, active plan surface owned by the planner/controller.

## Files Out Of Scope

- `src/modules/scheduler/channel-manager/ChannelManager.ts`
- `src/modules/scheduler/channel-manager/ChannelPersistenceStore.ts`
- `src/modules/scheduler/channel-manager/ChannelRepository.ts`
- Plex auth, discovery, library, stream, subtitle, and playback URL modules.
- SettingsStore storage semantics and dedicated settings stores.
- Settings focus extraction, SettingsScreen visual redesign, and broad UI layout changes.
- App-shell runtime-port ownership beyond adapting `AppLazyScreenRegistry.ts` to the new SettingsScreen constructor shape.
- Broad repo-wide test harness changes.
- Desloppify data, score documents, imported-issue maps, FCP matrices, and cleanup score deltas as package proof.
- Unrelated untracked `docs/plans/` and `docs/agentic/evals/` files present before this plan.

## Planner Self-Check

- Architecture seam: resolved. ChannelManager production behavior stays frozen; SettingsScreen constructor cleanup is implemented in this package through a deps object.
- Adjacent contracts: explicit. AppLazyScreenRegistry is in scope because it constructs SettingsScreen; Settings persistence, Plex behavior, and ChannelManager production contracts are out of scope.
- Out-of-scope dependencies: explicit. No file declared out of scope is required for hidden wiring except read-only source audit.
- Codanna evidence: unavailable in this environment and recorded as such; fallback `rg`, `wc`, and direct reads are recorded.
- Ownership: test-suite policy stays inside affected package tests; Settings constructor contract stays with the SettingsScreen owner while app-shell only adapts composition wiring.
- Fresh-session readiness: slice order, file scopes, constructor decision, verification, and stop conditions are explicit.
- Plan grade: execution-ready at the seam and verification level without prescribing local test helper implementation details.

## Architecture Seam Decision Gate

Approved seams:

- ChannelManager production source is frozen. DCR-10-S1 may move tests and local package test helpers only.
- Existing focused ChannelManager test files are the target split policy:
  - transactional replace-all and persistence atomicity coverage belongs in `ChannelManager.transactional.test.ts`;
  - import-order and reorder contract coverage belongs in `ChannelManager.import-order.test.ts`;
  - typed error and non-fallback failure semantics belong in `ChannelManager.error-semantics.test.ts`;
  - stale fallback/cache survival behavior belongs in `ChannelManager.stale-fallback.test.ts`.
- SettingsScreen moves to a single deps object constructor. Do not add a positional compatibility overload unless the maintainer explicitly approves it in a plan update.
- The SettingsScreen deps contract should include `container`, `getNavigation`, optional `onSubtitleModeChange`, optional `onGuideSettingChange`, optional `getActiveUsername`, optional `getTheme`, optional `setTheme`, and optional `settingsStore`.
- Constructor/dependency coverage must live in a focused settings test file and/or a local settings-screen test helper. Updating the existing catch-all helper to call the new constructor is allowed; adding new constructor-policy assertions to the catch-all suite is not.
- AppLazyScreenRegistry remains the app-shell deferred-screen owner and should only pass a named deps object assembled from `createSettingsRuntimePorts()`.

Preservation contracts:

- Settings screen focus behavior, category navigation, profile-switch navigation, theme class updates, subtitle-off callback behavior, guide-setting callback behavior, ARIA/status semantics, timer/frame cleanup, and `destroy()` behavior remain unchanged.
- AppLazyScreenRegistry lazy loading, concurrent load deduping, destroyed-state cleanup, and settings prefetch behavior remain unchanged.
- ChannelManager tests must preserve behavior coverage while moving or auditing test ownership.

Stop and replan if:

- constructor cleanup changes public Settings screen construction in a way that requires app-shell ownership changes beyond passing a deps object;
- SettingsStore/storage semantics, ChannelManager persistence semantics, or ChannelManager production behavior need to change;
- a compatibility positional overload appears necessary;
- a test split requires production extraction;
- Settings focus extraction behavior or broad Settings UI redesign becomes necessary;
- another reviewed package completes the DCR-10 split/constructor obligations and updates the checklist before this plan executes;
- verification scope widens beyond targeted affected tests, `npm run typecheck`, `npm run verify`, and required docs validators;
- maintainer approval is requested to migrate constructor cleanup out of this package.

## Verification Commands

Verification mode: `refactor-invariance` with a focused contract surface for the SettingsScreen constructor API.

- Verification classification: `new regression/contract test required`

Planning artifact verification:

- Run: `npm run plans:check`
- Expected: active tracked plan conformance passes. Because new plan files are untracked until committed, also run a direct harness check against this file when validating before git tracking.

Direct active-plan harness check for this file before tracking:

- Run: `node --input-type=module -e "import { readFileSync } from 'node:fs'; import { checkPlanConformance } from './tools/harness-docs-lib.mjs'; const filePath = 'docs/plans/2026-04-30-dcr-10-oversized-test-suite-structure.md'; const result = checkPlanConformance({ filePath, content: readFileSync(filePath, 'utf8') }); const failures = [...result.errors, ...result.missingSections.map((section) => 'missing section: ' + section)]; if (failures.length > 0) { console.error(failures.join('\\n')); process.exit(1); } console.log('Direct active plan conformance passed.');"`
- Expected: direct active plan conformance passes for this plan.

Harness validator resolution evidence:

- Run: `node --test tools/__tests__/harness-docs-lib.test.mjs`
- Expected: the Node test suite for `tools/harness-docs-lib.mjs` passes, including DCR checklist slice-id conformance support.
- Evidence already observed by the controller/revision flow: direct active plan conformance passed with the `node --input-type=module` check, and `node --test tools/__tests__/harness-docs-lib.test.mjs` passed after the narrow harness update in `tools/harness-docs-lib.mjs` and `tools/__tests__/harness-docs-lib.test.mjs`.
- Do not use `npm test -- --runInBand tools/__tests__/harness-docs-lib.test.mjs` as a required validator command; Jest does not apply to that `.mjs` tools node-test path.

Pre-implementation freshness audits:

- Run: `wc -l src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts src/modules/ui/settings/__tests__/SettingsScreen.test.ts`
- Expected: line counts are captured before implementation so closeout can show whether oversized catch-all files stayed stable or shrank.
- Run: `rg --files src/modules/scheduler/channel-manager/__tests__ src/modules/ui/settings/__tests__`
- Expected: currently existing focused ChannelManager files and settings test files are visible before changing split structure. Do not require future files such as `SettingsScreen.deps.test.ts` or `settings-screen-test-helpers.ts` to exist during preflight.
- Run: `rg -n "replaceAllChannels|importChannels|reorderChannels|transaction|error|fallback|stale" src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.transactional.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.import-order.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.error-semantics.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.stale-fallback.test.ts -S`
- Expected: implementer can identify which catch-all assertions must move versus which are non-policy residuals, with exact evidence in the implementation handoff.
- Run: `rg -n "new SettingsScreen\\(" src -S`
- Expected: current SettingsScreen construction sites are identified before constructor migration.
- Run: `rg -n "undefined" src/modules/ui/settings/__tests__/SettingsScreen.test.ts src/core/app-shell/__tests__/AppLazyScreenRegistry.test.ts -S`
- Expected: current constructor placeholders and unrelated `undefined` expectations are identified before constructor migration. This preflight intentionally lists only existing files.
- Run: `rg -n "constructor\\(|new SettingsScreen\\(" src/modules/ui/settings/SettingsScreen.ts src/modules/ui/settings/index.ts src/core/app-shell/AppLazyScreenRegistry.ts src/modules/ui/settings/__tests__/SettingsScreen.test.ts src/core/app-shell/__tests__/AppLazyScreenRegistry.test.ts -S`
- Expected: current constructor contract, exports, and call sites are captured before implementation. This preflight intentionally does not reference future settings deps-test/helper files.

Post-implementation DCR-10-S1 targeted tests:

- Run: `npm test -- --runInBand src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.transactional.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.import-order.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.error-semantics.test.ts src/modules/scheduler/channel-manager/__tests__/ChannelManager.stale-fallback.test.ts`
- Expected: ChannelManager catch-all and focused tests pass after any test moves.

Post-implementation DCR-10-S2 source audits:

- Run: `rg -n "new SettingsScreen\\(" src -S`
- Expected: every SettingsScreen construction site uses the deps object after migration.
- Run: `rg -n "undefined" src/modules/ui/settings/__tests__/SettingsScreen.test.ts src/modules/ui/settings/__tests__/SettingsScreen.deps.test.ts src/modules/ui/settings/__tests__/settings-screen-test-helpers.ts src/core/app-shell/__tests__/AppLazyScreenRegistry.test.ts -S`
- Expected: no constructor placeholder remains; ordinary `undefined` expectations are reviewed and not confused with positional constructor placeholders.
- Run: `rg -n "constructor\\(|SettingsScreenDeps|new SettingsScreen\\(" src/modules/ui/settings/SettingsScreen.ts src/modules/ui/settings/index.ts src/core/app-shell/AppLazyScreenRegistry.ts src/modules/ui/settings/__tests__ src/core/app-shell/__tests__/AppLazyScreenRegistry.test.ts -S`
- Expected: constructor contract, exports, call sites, and tests all align on the deps object.

Post-implementation DCR-10-S2 targeted tests and static checks:

- Run: `npm test -- --runInBand src/modules/ui/settings/__tests__/SettingsScreen.deps.test.ts src/modules/ui/settings/__tests__/SettingsScreen.test.ts src/core/app-shell/__tests__/AppLazyScreenRegistry.test.ts`
- Expected: Settings constructor/dependency coverage, existing SettingsScreen behavior, and app-shell lazy construction tests pass.
- Run: `npm run typecheck`
- Expected: TypeScript passes after constructor/API/import/export shape changes.
- Run: `npm run verify`
- Expected: full repo verification passes because production SettingsScreen/AppLazyScreenRegistry/UI construction changed.

Docs/checklist verification when implementation closes the package:

- Run: `npm run verify:docs`
- Expected: docs verification passes after checklist/current-state/plan references or closeout notes are updated. If only active plan progress is changing during local orchestration, `npm run verify:docs:workspace` may be used as a local warning-mode supplement, but it does not replace the final `npm run verify:docs` closeout gate.

## Rollback Notes

- ChannelManager test moves should be reversible by moving the affected tests back to their prior file if targeted tests fail for structure-only reasons. Do not change ChannelManager production code as rollback.
- Settings constructor migration rollback means restoring the positional constructor and call sites together, then removing the focused deps-object test. Do not leave mixed positional and deps-object construction paths.
- If the deps object causes app-shell behavior regressions, first check argument mapping in `AppLazyScreenRegistry.ts` and `AppLazyScreenRegistry.test.ts`; do not widen app-shell runtime-port ownership without a replan.
- If docs/checklist closeout fails, leave source/test changes intact and fix the tracked docs in a separate controller-owned pass.

## Commit Checkpoints

- Implementation commits must exclude active docs/plans progress files. Keep `docs/plans/2026-04-30-dcr-10-oversized-test-suite-structure.md` out of worker implementation commits unless the controller explicitly creates a separate tracked-doc commit.
- Recommended checkpoint 1: `DCR-10-S1` ChannelManager test split policy and targeted ChannelManager verification.
- Recommended checkpoint 2: `DCR-10-S2` SettingsScreen deps-object constructor migration, focused Settings tests, app-shell call-site updates, `npm run typecheck`, and `npm run verify`.
- Closeout/checklist docs should be committed separately by the controller after implementation and review are clean.
