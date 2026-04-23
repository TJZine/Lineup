# Test Suite Cleanup Checklist

> Established 2026-04-13.
>
> Refreshed 2026-04-22 against the current workspace with live commands and targeted source inspection.

This document is the active backlog for test-suite-specific cleanup work that materially improves production-quality engineering practices in Lineup: maintainability, deterministic behavior, architectural seams, and test signal quality.

This is not a generic "make tests prettier" list. If an item does not clearly reduce suite noise, reduce coupling, improve ownership, or make failures easier to trust, it should not stay active here.

## Fresh-Session Handoff

- Last audit refresh: `2026-04-22`
- Current execution state: `T1` closed on `2026-04-22`; `T2-W1` + `T2-W2` and `T2-EXIT` closed on `2026-04-22` after current-workspace exit verification
- Next safe start: `T3-W1` + `T3-W2`
- Authoritative evidence rule: update status only from commands rerun in the target workspace or integration branch
- Discovery note: Codanna was not available in this session; repo discovery fell back to `rg`, direct file inspection, and executable commands
- Explicit user decision: do not add a coverage threshold

## Goal

- Reduce low-value and high-maintenance tests.
- Separate product-behavior signal from tooling/governance signal.
- Make passing output actionable by default.
- Push tests toward public behavior and explicit policy seams instead of private probing.
- Consolidate repeated environment setup only where it reduces real maintenance cost.

## Non-Goals

- Do not add `coverageThreshold` to Jest config.
- Do not treat coverage percentage changes as a primary success metric.
- Do not split files only because they are large.
- Do not rewrite stable suites only for aesthetics.
- Do not add production compatibility shims just to make tests easier.
- Do not silence `console.warn` or `console.error` globally without an explicit expected-log path.
- Do not replace manual browser/webOS verification with jsdom confidence theater.

## Decision Filter

Keep an item active only if it improves at least one of these:

- default signal quality
- determinism / flake resistance
- architectural seam quality
- test ownership clarity
- suite maintenance cost

If a proposed cleanup does not meet that bar, defer or delete it.

## Work-Unit Status Contract

Each `T#-W#` and `T#-EXIT` item below is a checklist item. The checkbox is the closeout signal.

When a work unit is touched, add this mini-record directly under the item:

- `Status:` `planned`, `in progress`, `blocked`, `completed`, `deferred`, or `split follow-up`
- `Plan:` tracked `docs/plans/...` path, `local-only`, or `none needed`
- `Last touched:` `YYYY-MM-DD`
- `Verification:` exact commands plus short result
- `Follow-ups:` exact owner and trigger, or `none`
- `Handoff:` one-line next safe action

Check a box only in the same pass that updates the mini-record with current verification and disposition notes.

## Workflow Fit

This checklist is a real cleanup backlog, but it is not a native `checklist-linked` package surface like [`ARCHITECTURE_CLEANUP_CHECKLIST.md`](/Users/tristan/Software/Lineup/ARCHITECTURE_CLEANUP_CHECKLIST.md).

Use the workflow this way:

- for this temporary checklist, default to a higher-scrutiny cleanup flow: `cleanup-plan` -> `cleanup-review` -> `cleanup-implement` -> `cleanup-review`
- treat that extra pre-implementation review as a checklist-local safety rule, not as a replacement for the repo's default Tier 2 cleanup sequencing elsewhere
- treat most active work here as `standalone remediation`, not native `checklist-linked` package retirement
- promote a cluster to Tier 3 only when the scope becomes multi-session, cross-cutting, or too risky for one normal implement/review loop
- use `cleanup-loop` only after an approved plan exists and only when the work truly needs Tier 3 orchestration
- do not create one tracked plan per `T#-W#` by default

## Plan Granularity Rules

The current workflow can handle multiple work units in one plan, but only when they are genuinely one bounded remediation cluster.

Group multiple `T#-W#` items into one plan only when all of these are true:

- same owner or same implementation seam
- same verification envelope
- same likely files or helper surface
- same review mode
- low risk of turning into unrelated side work

Split into separate plans when any of these are true:

- the items touch different subsystems with different verification depth
- one item is docs/control-plane only and another changes runtime behavior
- one item can complete independently without blocking the other
- the cluster would become hard to review as one artifact
- the work starts needing package-style coverage accounting to stay coherent

For grouped plans, borrow the package discipline without pretending this is package-linked workflow:

- one plan may cover multiple `T#-W#` items
- keep one explicit `ready now` execution unit in the plan
- execute one bounded batch at a time
- record replan triggers whenever the cluster widens beyond the approved seam
- update every affected checklist item in the same pass when that batch lands

## Recommended Plan Shapes

Use these as defaults unless fresh evidence shows a better seam:

- `T1-W1` + `T1-W2`: one plan
  - rationale: same command taxonomy and timing surface
- `T2-W1` + `T2-W2`: one plan
  - rationale: same console-policy seam and migration surface
- `T3-W1` + `T3-W2`: one plan
  - rationale: same anti-pattern scanner/baseline ownership
- `T4-W1` + `T4-W2`: one plan
  - rationale: same async/timer policy and helper enforcement seam
- `T6-W1` + `T6-W2`: one plan
  - rationale: shared environment-helper surface
- `T6-W3`: separate unless it naturally folds into the same helper work without widening the verification surface
- `T5-W1` + `T7-W3`: one plan if the EPG Virtualizer seam stays bounded
- `T7-W1`: separate
- `T7-W2`: separate
- `T7-W4`: separate unless it is a direct consequence of another approved UI-suite split
- `T8-W1` + `T8-W2`: one final closeout plan or one local-only closeout pass

## Tier Routing Defaults

- Tier 1:
  - tiny doc-only or checklist-status updates with no behavior change
- Tier 2:
  - the default for this checklist
  - one bounded work unit or one bounded multi-item cluster from `Recommended Plan Shapes`
- Tier 3:
  - only when a cluster becomes cross-cutting, multi-session, or review-heavy enough that controller orchestration is worth the cost
  - likely candidates: broad `T2`, broad `T3`, or large `T7` hotspot retirements

## Fresh Evidence Snapshot

### Commands Run For This Refresh

- Pre-T1 historical snapshot:
  - `desloppify status`
  - `npm run test:contracts`
  - `npm run test:timings`
  - `npm run test:coverage -- --runInBand --silent`
  - targeted `rg` and direct file inspection for test commands, anti-pattern policy, console setup, helper usage, private-probe seams, large suites, and stale checklist assumptions
- Post-T1 validation rerun:
  - `npm run test:unit`
  - `npm run test:tools`
  - `npm run test:timings`
  - `npm run test:timings:tools`
  - direct inspection of `package.json`, `jest.config.js`, and `jest.tools.config.js`

### Historical Baseline Results Before T1 Split

- Mixed Jest surface before the `test:unit` / `test:tools` split: `258` suites passed, `3,336` tests passed, `43.843s` in-band via the old `npm run test:timings`
- Contracts/policy suite at the pre-T1 snapshot: `4` suites passed, `8` tests passed, `1.526s`
- Coverage run before the split: `258` suites passed, `3,336` tests passed, `30.392s` in-band with `--silent`
- Coverage telemetry:
  - statements: `86.21%`
  - branches: `73.52%`
  - functions: `86.66%`
  - lines: `87.65%`
- Desloppify status:
  - overall: `87.5 / 100`
  - objective: `96.0 / 100`
  - strict: `87.4 / 100`
  - Test health: `94.5%`
  - Test strategy: `84.0%`

### Current Baseline Results After T1/T2 Validation

- Product/runtime Jest surface: `254` suites passed, `3,248` tests passed, `1` skipped, `13.020s` in-band via `npm run test:timings`
- Tooling/docs Jest surface: `4` suites passed, `96` tests passed, `14.594s` in-band via `npm run test:timings:tools`

### Current Structural Facts

- `package.json` now splits product/runtime and tooling/docs ownership explicitly with `test:unit`, `test:tools`, `test:all`, `test:timings`, and `test:timings:tools`.
- `jest.config.js` is now product-only and excludes `src/__tests__/tools/**`; `jest.tools.config.js` owns the tooling/docs surface, so tool suites no longer distort the default product timing lane.
- `src/__tests__/policy/AntiPatterns.policy.test.ts` still enforces only a frozen-suite list.
- `src/__tests__/policy/baselines/private-probes.allowlist.txt` still declares `# maxCount=0`, but that ratchet only protects the frozen-scope files.
- `src/__tests__/jest.setup.ts` now silences `debug`, `log`, and `info`, and it fails unexpected `console.warn` / `console.error` by default through the shared guard unless `LINEUP_TEST_CONSOLE=1` is set.
- `src/__tests__/helpers.ts` now owns the shared expected-log contract (`TestConsoleOutputGuard`, `expectConsoleWarn`, `expectConsoleError`) alongside the existing async helpers, and `src/__tests__/helpers.test.ts` directly covers that guard contract.

### Largest Current Test Files

- `src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts`: `3,861` lines
- `src/__tests__/Orchestrator.test.ts`: `3,451` lines
- `src/__tests__/tools/verifyDocs.test.ts`: `3,446` lines
- `src/modules/ui/epg/__tests__/EPGCoordinator.test.ts`: `2,689` lines
- `src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts`: `2,214` lines

### Slowest Current Suites From `npm run test:timings` (unit surface)

- `src/modules/plex/library/__tests__/PlexLibrary.test.ts`: `2,440ms`, `83` tests
- `src/modules/ui/epg/__tests__/EPGComponent.test.ts`: `907ms`, `85` tests
- `src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts`: `531ms`, `71` tests
- `src/modules/ui/server-select/__tests__/ServerSelectScreen.test.ts`: `446ms`, `45` tests
- `src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts`: `357ms`, `77` tests
- `src/__tests__/App.test.ts`: `289ms`, `27` tests
- `src/modules/ui/epg/__tests__/EPGCoordinator.test.ts`: `282ms`, `69` tests
- `src/__tests__/bootstrap.test.ts`: `233ms`, `17` tests
- `src/modules/plex/stream/__tests__/PlexStreamResolver.test.ts`: `210ms`, `69` tests
- `src/modules/ui/profile-select/__tests__/ProfileSelectScreen.test.ts`: `202ms`, `22` tests

### Slowest Current Suites From `npm run test:timings:tools` (tools surface)

- `src/__tests__/tools/verifyDocs.test.ts`: `13,954ms`, `88` tests
- `src/__tests__/tools/syncAgentSkills.test.ts`: `440ms`, `2` tests
- `src/__tests__/tools/reportStalePlans.test.ts`: `47ms`, `1` test
- `src/__tests__/tools/plexIntegrationDocs.test.ts`: `17ms`, `5` tests

### Pattern Counts Worth Acting On

- files with `jest.useFakeTimers`: `51`
- files with `jest.useRealTimers`: `50`
- files with raw `setTimeout(` in tests: `6`
- files with `new Promise(...setTimeout...)` in tests: `2`
- files with `as unknown as`: `81`
- files with `as any`: `2`
- files with explicit `jest.spyOn(console, 'warn'|'error')`: `16`
- files with direct `localStorage.` calls: `37`
- files with global descriptor mutations: `36`
- test files importing shared `__tests__/helpers`: `31`
- jsdom test files: `97`

## Adversarial Review Outcome

### Keep As Active Debt

- test command taxonomy split
- console warn/error policy
- anti-pattern enforcement beyond frozen suites
- deterministic async/timer enforcement using the existing helper set
- remaining implementation-coupling reduction in current hotspot suites
- focused consolidation of repeated storage/global/DOM setup
- targeted suite decomposition where ownership or signal clearly improves
- docs and final exit review

### Remove From The Active Queue

- checklist creation and first-baseline bootstrap work
  - stale: the document already exists and this refresh replaces the original baseline
- Plex stream URL policy extraction as a primary debt item
  - stale: `src/modules/plex/stream/plexStreamUrlPolicy.ts` and [`src/modules/plex/stream/__tests__/plexStreamUrlPolicy.test.ts`](/Users/tristan/Software/Lineup/src/modules/plex/stream/__tests__/plexStreamUrlPolicy.test.ts) already exist
  - current `PlexStreamResolver.test.ts` no longer probes `_buildUrlWithToken` or `_buildClientCapabilities`
- Subtitle direct-track URL private-probe cleanup as a primary debt item
  - stale: current `SubtitleManager.test.ts` no longer probes `_buildDirectTrackUrl`
- machine-readable coverage-summary work as its own priority
  - low ROI: useful if free, but not worth backlog priority while the higher-value work is suite signal, anti-pattern coverage, and hotspot cleanup

### Coverage Policy After This Review

Coverage remains telemetry only. Use it as a tie-breaker when deciding where new tests are worth writing, not as a reason to keep low-value tests alive or to add new metric-chasing work items.

## Priority Overview

- `T1`: split product tests from tooling/governance tests
- `T2`: make unexpected `warn` / `error` output actionable
- `T3`: expand anti-pattern enforcement across the real suite
- `T4`: enforce deterministic async/timer style with the existing helper set
- `T5`: reduce remaining implementation-detail coupling in hotspot suites
- `T6`: consolidate repeated environment setup where duplication is still expensive
- `T7`: decompose only the suites that still distort ownership or signal
- `T8`: docs and final exit review

## Priority Exit Gates

- [x] `T1-EXIT`
  - required: product unit tests and tooling/governance tests have distinct command surfaces
  - verification:
    - `npm run test:unit`
    - `npm run test:tools`
    - `npm run test:contracts`
    - `npm run verify`
  - exit rule: slow docs/tool tests no longer distort the default product timing report
  - Status: `completed`
  - Plan: `docs/plans/2026-04-22-t1-w1-w2-test-command-taxonomy.md`
  - Last touched: `2026-04-22`
  - Verification: `npm run test:unit` passed (`254` suites, `3,240` tests); `npm run test:tools` passed (`4` suites, `96` tests); `npm run test:contracts` passed (`4` suites, `8` tests); `npm run test:timings` passed with the `unit` label and no `src/__tests__/tools/**` suites in the slowest list; `npm run test:timings:tools` passed with the `tools` label and isolated `src/__tests__/tools/verifyDocs.test.ts` as the slowest suite (`21,149ms`); `npm run verify` passed through typecheck, architecture lint, CSS lint, product coverage, tools, contracts, docs verification, and build.
  - Follow-ups: `none`
  - Handoff: start `T2-W1` + `T2-W2` when ready; Priority 1 no longer blocks later test-suite cleanup work.

- [x] `T2-EXIT`
  - required: unexpected `console.warn` and `console.error` output is actionable
  - verification:
    - representative expected-log suites pass
    - helper self-tests prove unexpected logs fail
    - `npm run test:unit`
  - exit rule: passing output is quiet enough that a new warning/error is visible immediately
  - Status: `completed`
  - Plan: `none needed`
  - Last touched: `2026-04-22`
  - Verification: representative expected-log suites passed; `npm run test:unit -- --runInBand src/__tests__/helpers.test.ts` passed; `npm run test:unit` passed (`254` suites, `3,248` tests, `1` skipped); `npm run verify` passed through typecheck, architecture lint, CSS lint, product coverage, tools, contracts, docs verification, and build.
  - Follow-ups: `none`
  - Handoff: start `T3-W1` + `T3-W2` when ready; Priority 2 no longer blocks anti-pattern enforcement follow-up work.

- [x] `T3-EXIT`
  - required: anti-pattern policy protects the intended suite scope with explicit baselines and owner notes
  - verification:
    - `npm run test:contracts`
    - generated temp reports inspected when scanner fails
  - exit rule: new raw sleeps and new private probes cannot spread quietly outside approved exceptions
  - Status: `completed`
  - Plan: `none needed`
  - Last touched: `2026-04-22`
  - Verification: `npm run test:contracts -- --runInBand src/__tests__/policy/antiPatternsScanner.test.ts src/__tests__/policy/AntiPatterns.policy.test.ts` passed; `npm run verify` passed through typecheck, architecture lint, CSS lint, product coverage, tools, contracts, docs verification, and build; review of commit `8061b8c5` found no material implementation issues.
  - Follow-ups: keep `T4-W1` + `T4-W2` as the async/timer helper cleanup lane, and keep `T5-W2` as the owner for the six documented private-probe exceptions in `src/__tests__/policy/baselines/private-probes.owner-notes.md`.
  - Handoff: start `T4-W1` + `T4-W2` when ready; Priority 3 no longer blocks the documented async/timer follow-up lane.

- [ ] `T4-EXIT`
  - required: async/timer helper usage is documented, tested, and enforced where it matters
  - verification:
    - helper self-tests
    - targeted timer suites
    - `npm run test:contracts`
  - exit rule: timer tests prefer explicit fake-time advancement or approved deferred/promise helpers

- [ ] `T5-EXIT`
  - required: highest-value remaining implementation-detail tests use public outcomes or named policy/test seams
  - verification:
    - targeted hotspot suites
    - `npm run verify` if production code changed
  - exit rule: remaining deep probes are intentional, documented, and owned

- [ ] `T6-EXIT`
  - required: repeated storage/global/DOM setup uses focused helpers where that actually lowers churn
  - verification:
    - helper self-tests
    - targeted migrated suites
    - `npm run test:unit`
  - exit rule: bespoke environment setup is the exception, not the default

- [ ] `T7-EXIT`
  - required: only the suites that still distort ownership or timing have been decomposed
  - verification:
    - split-suite commands
    - `npm run test:timings`
  - exit rule: large remaining suites are intentionally retained and have a written reason

- [ ] `T8-EXIT`
  - required: docs and workflow reflect the new suite layout and cleanup policy
  - verification:
    - `npm run verify:docs`
    - `npm run verify`
  - exit rule: this checklist can either remain active with residual owners or be archived cleanly

## Priority 1: Split Product Unit Tests From Tooling And Governance Tests

**Default workflow lane:** Tier 2 standalone remediation

**Default plan shape:** one grouped plan covering `T1-W1` + `T1-W2`

### [x] `T1-W1` Define Test Command Taxonomy

**Goal:** separate product runtime tests from tooling/docs/governance tests so timing and ownership mean what they say.

**Primary files:**

- Modify: `package.json`
- Modify or create: `jest.config.js`
- Create if needed: `jest.tools.config.js`
- Keep: `jest.contracts.config.js`
- Modify: `docs/development/testing.md`

**Plan-start evidence (pre-split):**

- `verifyDocs.test.ts` was the slowest suite on the old mixed Jest surface at `14.179s`.
- `syncAgentSkills.test.ts` was still inside the default Jest surface.
- `jest.config.js` still included `src/__tests__/tools/**`.

**Required outcomes:**

- Add `test:unit` for product/runtime tests.
- Add `test:tools` for Jest-based tooling/docs tests under `src/__tests__/tools/**`.
- Keep `test:contracts` separate.
- Make `test:timings` report product test timing by default.
- Keep `verify` comprehensive; do not silently drop test coverage from verification.

**Verification:**

- `npm run test:unit`
- `npm run test:tools`
- `npm run test:contracts`
- `npm run test:all`
- `npm run verify:docs`
- `npm run verify`

- Status: `completed`
- Plan: `docs/plans/2026-04-22-t1-w1-w2-test-command-taxonomy.md`
- Last touched: `2026-04-22`
- Verification: `npm run test:unit`, `npm run test:tools`, `npm run test:contracts`, `npm run test:all`, `npm run verify:docs`, and `npm run verify` all passed after splitting `src/__tests__/tools/**` into `jest.tools.config.js` and keeping `verify` comprehensive across unit/tools/contracts/docs.
- Follow-ups: `T1-EXIT` owner, trigger = run the dedicated exit review and decide whether Priority 1 can close.
- Handoff: run `T1-EXIT` review with the verified unit/tools/contracts/docs split as the evidence surface.

### [x] `T1-W2` Make Timing Reports Match The New Taxonomy

**Goal:** stop using a timing report that answers the wrong question.

**Primary files:**

- Modify: `package.json`
- Modify if needed: `scripts/jest-report-slowest.mjs`
- Modify: `docs/development/testing.md`

**Required outcomes:**

- `npm run test:timings` reports product suites only.
- Add a tooling timing command only if it is useful enough to keep.
- Timing output identifies which test surface it measured.

- Status: `completed`
- Plan: `docs/plans/2026-04-22-t1-w1-w2-test-command-taxonomy.md`
- Last touched: `2026-04-22`
- Verification: `npm run test:timings` and `npm run test:timings:tools` both passed, with `scripts/jest-report-slowest.mjs` labeling the measured `unit` and `tools` surfaces explicitly.
- Follow-ups: `T1-EXIT` owner, trigger = confirm the exit rule after the Priority 1 review.
- Handoff: carry the new product-first `test:timings` output plus the explicit `test:timings:tools` lane into `T1-EXIT` review.

## Priority 2: Make Console Output Actionable

**Default workflow lane:** Tier 2 standalone remediation

**Promote to Tier 3 when:** the helper migration fans out across enough noisy suites that one normal implement/review pass stops being coherent

**Default plan shape:** one grouped plan covering `T2-W1` + `T2-W2`

### [x] `T2-W1` Add A Failing Default For Unexpected Warn/Error Output

- Status: `completed`
- Plan: `docs/plans/2026-04-22-t2-w1-w2-console-output-policy.md`
- Last touched: `2026-04-22`
- Verification: `npm run test:unit -- --runInBand src/__tests__/helpers.test.ts` passed; `npm run test:unit -- --runInBand src/__tests__/orchestrator/playback-flow.test.ts src/core/orchestrator/__tests__/OrchestratorRecoverableRuntimeReporter.test.ts src/modules/lifecycle/__tests__/AppLifecycle.test.ts src/__tests__/bootstrap.test.ts` passed; `npm run test:unit -- --runInBand src/modules/plex/library/__tests__/PlexLibrary.test.ts src/modules/plex/stream/__tests__/PlexStreamResolver.test.ts` passed; `npm run test:unit -- --runInBand src/modules/player/__tests__/PlaybackRecoveryManager.test.ts src/modules/player/__tests__/VideoPlayer.test.ts src/modules/scheduler/channel-manager/__tests__/ContentResolver.test.ts` passed; `npm run test:unit` passed (`254` suites, `3,248` tests, `1` skipped); `npm run verify` passed through typecheck, architecture lint, CSS lint, product coverage, tools, contracts, docs verification, and build.
- Follow-ups: `cleanup-review`, trigger = confirm the second-wave expected-log migration and decide whether `T2-EXIT` can close.
- Handoff: review `docs/plans/2026-04-22-t2-w1-w2-console-output-policy.md` execution unit `T2-W1W2-B2`, then decide `T2-EXIT`.

**Goal:** stop normalizing pages of expected warnings/errors in passing runs.

**Primary files:**

- Modify: `src/__tests__/jest.setup.ts`
- Modify: `src/__tests__/helpers.ts`
- Modify: `src/__tests__/helpers.test.ts`
- Modify: `docs/development/testing.md`

**Current evidence:**

- `jest.setup.ts` now installs the shared warn/error guard while keeping `LINEUP_TEST_CONSOLE=1` as the explicit local debugging escape hatch.
- `helpers.ts` and `helpers.test.ts` now provide direct contract coverage for expected warn/error matching, readable failure formatting, and shared-guard setup behavior.
- the approved second migration wave landed, and the full `test:unit` run now passes under the shared guard.

**Implementation constraints:**

- Do not globally suppress `warn` / `error`.
- Do not require exact brittle full-text assertions for every expected log in the first pass.
- Keep `LINEUP_TEST_CONSOLE=1` for local debugging.
- Make failures print the captured logs clearly.

**Verification:**

- helper self-tests prove unexpected `console.error` / `console.warn` fails
- representative noisy suites pass under the new policy
- `npm run test:unit`

### [x] `T2-W2` Migrate The Noisiest Expected-Log Suites First

- Status: `completed`
- Plan: `docs/plans/2026-04-22-t2-w1-w2-console-output-policy.md`
- Last touched: `2026-04-22`
- Verification: the approved second-wave migrations landed in `src/modules/plex/library/__tests__/PlexLibrary.test.ts`, `src/modules/lifecycle/__tests__/AppLifecycle.test.ts`, `src/modules/scheduler/channel-manager/__tests__/ContentResolver.test.ts`, `src/modules/plex/stream/__tests__/PlexStreamResolver.test.ts`, `src/modules/player/__tests__/PlaybackRecoveryManager.test.ts`, `src/__tests__/bootstrap.test.ts`, `src/__tests__/orchestrator/playback-flow.test.ts`, `src/modules/player/__tests__/VideoPlayer.test.ts`, and `src/core/orchestrator/__tests__/OrchestratorRecoverableRuntimeReporter.test.ts`; `npm run test:unit -- --runInBand src/__tests__/helpers.test.ts` passed; all three approved suite-batch commands passed; `npm run test:unit` passed (`254` suites, `3,248` tests, `1` skipped); `npm run verify` passed through typecheck, architecture lint, CSS lint, product coverage, tools, contracts, docs verification, and build.
- Follow-ups: `cleanup-review`, trigger = confirm the nine-suite migration is review-clean before opening `T2-EXIT`.
- Handoff: send `T2-W1W2-B2` to `cleanup-review`, then use that review outcome to decide `T2-EXIT`.

**Goal:** replace scattered ad hoc console spies with one house style.

**Approved first-wave migrations already landed:**

- `src/__tests__/Orchestrator.test.ts`
- `src/modules/plex/discovery/__tests__/PlexServerDiscovery.test.ts`
- `src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts`
- `src/modules/player/__tests__/PlaybackReloadController.test.ts`
- `src/modules/ui/now-playing-info/__tests__/NowPlayingInfoCoordinator.test.ts`
- `src/utils/__tests__/EventEmitter.test.ts`

**Second-wave migrations that resolved the previously exposed follow-up owners:**

- `src/modules/plex/library/__tests__/PlexLibrary.test.ts`
- `src/modules/lifecycle/__tests__/AppLifecycle.test.ts`
- `src/modules/scheduler/channel-manager/__tests__/ContentResolver.test.ts`
- `src/modules/plex/stream/__tests__/PlexStreamResolver.test.ts`
- `src/modules/player/__tests__/PlaybackRecoveryManager.test.ts`
- `src/__tests__/bootstrap.test.ts`
- `src/__tests__/orchestrator/playback-flow.test.ts`
- `src/modules/player/__tests__/VideoPlayer.test.ts`
- `src/core/orchestrator/__tests__/OrchestratorRecoverableRuntimeReporter.test.ts`

## Priority 3: Expand Anti-Pattern Enforcement

**Default workflow lane:** Tier 2 standalone remediation

**Promote to Tier 3 when:** scanner expansion, baseline classification, and exception ownership updates become a multi-session cross-suite rollout

**Default plan shape:** one grouped plan covering `T3-W1` + `T3-W2`

### [x] `T3-W1` Expand Scanner Scope Beyond Frozen Suites

**Goal:** stop pretending the suite is protected when only a frozen subset is ratcheted.

**Primary files:**

- Modify: `src/__tests__/policy/AntiPatterns.policy.test.ts`
- Modify if needed: `src/__tests__/policy/antiPatternsScanner.ts`
- Modify: `src/__tests__/policy/baselines/private-probes.allowlist.txt`
- Modify: `src/__tests__/policy/baselines/sleeps-ast.txt`
- Modify: `docs/development/testing.md`

**Current evidence:**

- frozen-scope policy still exists
- whole-suite scans still show `6` test files with raw `setTimeout(` and `2` with `new Promise(...setTimeout...)`
- whole-suite scans still show `81` files with `as unknown as`

**Required outcomes:**

- keep the current frozen zero-debt ratchet where it is already strict
- add a whole-suite or tiered-suite ratchet for new private probes
- keep raw sleep usage zero-tolerance outside explicitly approved helper files

- Status: `completed`
- Plan: `docs/plans/2026-04-22-t3-w1-w2-anti-pattern-enforcement.md`
- Last touched: `2026-04-22`
- Verification: `npm run test:contracts -- --runInBand src/__tests__/policy/antiPatternsScanner.test.ts src/__tests__/policy/AntiPatterns.policy.test.ts` passed; `npm run test:unit -- --runInBand src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoader.test.ts src/modules/ui/epg/__tests__/DeferredEpgComponent.test.ts src/modules/player/__tests__/subtitleFallbackPipeline.test.ts` passed; `npm run test:unit -- --runInBand src/__tests__/helpers.test.ts` passed; `npm run verify` passed through typecheck, architecture lint, CSS lint, product coverage, tools, contracts, docs verification, and build.
- Result: frozen suites remain at zero private probes and zero sleep probes; the tracked whole-suite ratchet now scans the unit + contracts Jest surfaces from tracked `src/` files only; the final private-probe baseline is `6` unique keys in `src/__tests__/policy/baselines/private-probes.allowlist.txt`; the only approved remaining sleep id is `src/__tests__/helpers.test.ts|timer-call|advanceTimersUntil > resolves when the assertion becomes true exactly at the timeout boundary|1` in `src/__tests__/policy/baselines/sleeps-ast.txt`; no sleep exception remains outside `src/__tests__/helpers.test.ts`.
- Follow-ups: `cleanup-review`, trigger = confirm the grouped `T3-W1W2-B1` implementation is review-clean before deciding `T3-EXIT`.
- Handoff: send `docs/plans/2026-04-22-t3-w1-w2-anti-pattern-enforcement.md` execution unit `T3-W1W2-B1` to `cleanup-review`, then use that outcome to decide `T3-EXIT`.

### [x] `T3-W2` Add Owner Notes For Remaining Exceptions

**Goal:** make remaining baseline exceptions reviewable instead of anonymous debt.

**Primary files:**

- Modify: `src/__tests__/policy/baselines/private-probes.allowlist.txt`
- Optionally create: `src/__tests__/policy/baselines/private-probes.owner-notes.md`
- Optionally create: `src/__tests__/policy/baselines/sleeps.owner-notes.md`

**Required outcomes:**

- every remaining exception has an owner, rationale, and revisit trigger
- resolved exceptions are removed instead of silently carried forward

- Status: `completed`
- Plan: `docs/plans/2026-04-22-t3-w1-w2-anti-pattern-enforcement.md`
- Last touched: `2026-04-22`
- Verification: `npm run test:contracts -- --runInBand src/__tests__/policy/antiPatternsScanner.test.ts src/__tests__/policy/AntiPatterns.policy.test.ts` passed; `npm run verify` passed through typecheck, architecture lint, CSS lint, product coverage, tools, contracts, docs verification, and build.
- Result: `src/__tests__/policy/baselines/private-probes.owner-notes.md` now mirrors all `6` allowlisted private-probe keys with owner, rationale, revisit trigger, and cleanup lane metadata; `src/__tests__/policy/baselines/sleeps.owner-notes.md` now mirrors the lone approved helper self-test sleep id; the policy contract fails if the baselines and owner-note files drift apart.
- Follow-ups: `cleanup-review`, trigger = confirm the owner-note synchronization and grouped anti-pattern ratchet behavior before deciding `T3-EXIT`.
- Handoff: review the `T3-W1W2-B1` implementation bundle, then carry the verified owner-note surfaces into `T3-EXIT`.

## Priority 4: Standardize Async And Timer Testing

**Default workflow lane:** Tier 2 standalone remediation

**Default plan shape:** one grouped plan covering `T4-W1` + `T4-W2`

### [ ] `T4-W1` Make The Existing Async Helper Set The Explicit House Style

**Goal:** use the helper set that already exists instead of letting each suite improvise.

**Primary files:**

- Modify: `src/__tests__/helpers.ts`
- Modify: `src/__tests__/helpers.test.ts`
- Modify: `docs/development/testing.md`

**Current evidence:**

- helper surface already exists
- helper tests currently focus narrowly on `advanceTimersUntil`
- raw `setTimeout` and `Promise(...setTimeout...)` usage still exists in active test files

**Required outcomes:**

- document when each helper is approved
- add helper self-tests for the supported patterns that matter
- make `flushPromisesAndMacrotask` explicitly opt-in for real-timer integration boundaries only

### [ ] `T4-W2` Remove Or Justify Remaining Raw Macrotask Sleeps

**Goal:** cut the last obvious flake bait.

**Current evidence:**

- current `setTimeout(` test files include:
  - `src/modules/player/__tests__/subtitleFallbackPipeline.test.ts`
  - `src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoader.test.ts`
  - `src/__tests__/startup-integration.test.ts`
  - `src/modules/ui/epg/__tests__/DeferredEpgComponent.test.ts`
- current `new Promise(...setTimeout...)` test files include:
  - `src/modules/ui/epg/__tests__/DeferredEpgComponent.test.ts`
  - `src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoader.test.ts`

**Preferred replacements:**

- `createDeferred`
- `flushPromises`
- `flushPromisesAndTimers`
- `jest.advanceTimersByTimeAsync(...)`
- await the specific production promise under test

## Priority 5: Reduce Remaining Implementation Coupling

**Default workflow lane:** Tier 2 standalone remediation

**Default plan shape:** one bounded plan per hotspot seam, not one plan for all coupling cleanup

### [ ] `T5-W1` Replace EPG Virtualizer Internal Spies With Observable Outcomes

**Goal:** keep high-value virtualization protections without anchoring the suite to method names.

**Primary files:**

- Inspect: `src/modules/ui/epg/view/EPGVirtualizer.ts`
- Modify: `src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts`

**Current evidence:**

- `EPGVirtualizer.test.ts` is still the largest suite in the repo at `3,861` lines
- it still spies on internal `updateCellPosition` and `updateCellContent`

**Preferred assertion styles:**

- DOM node identity reuse
- DOM-visible state and style stability
- public render results
- explicit public instrumentation only if a real seam already exists

### [ ] `T5-W2` Audit The Remaining High-Value Cast/Probe Hotspots

**Goal:** spend coupling-reduction effort where it still buys seam quality, not where the repo already fixed it.

**Primary files:**

- inspect hotspots with real maintenance cost first:
  - `src/__tests__/Orchestrator.test.ts`
  - `src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts`
  - `src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts`
  - any file promoted by the anti-pattern ratchet after `T3`

**Current evidence:**

- `as unknown as` still appears in `81` test files
- previously stale targets around Plex stream URL policy and subtitle direct-track URL policy are no longer the right lead items

**Implementation rule:**

- do not reopen resolved items without fresh evidence of current private probing

## Priority 6: Consolidate Global State, DOM, And Storage Setup

**Default workflow lane:** Tier 2 standalone remediation

**Default plan shape:** one grouped plan covering `T6-W1` + `T6-W2`; keep `T6-W3` separate unless it stays inside the same helper seam

### [ ] `T6-W1` Standardize Local Storage Setup Where Duplication Is Still Expensive

**Goal:** reduce hand-rolled storage mocks and inconsistent restore behavior.

**Primary files:**

- Modify: `src/__tests__/mocks/localStorage.ts`
- Modify if needed: `src/__tests__/helpers.ts`

**Current evidence:**

- `37` test files still use direct `localStorage.`
- repeated bespoke storage setups still appear in hotspots such as `StateManager.test.ts`, `Orchestrator.test.ts`, and `ChannelManager.test.ts`

**Constraint:**

- keep real jsdom `localStorage` behavior available when a suite actually needs it

### [ ] `T6-W2` Standardize Repeated Global Descriptor Setup Only Where Cleanup Semantics Repeat

**Goal:** reduce repeated descriptor-mutation boilerplate only where the setup and restore contract is genuinely the same.

**Primary files:**

- Modify if justified: `src/__tests__/helpers.ts`
- Modify if justified: `src/__tests__/helpers.test.ts`
- Prefer migrating repeated suites before widening helper scope

**Current evidence:**

- `36` test files still mutate globals with `Object.defineProperty(...)`
- many of those mutations are not the same seam, so raw count alone is not a justification for a generic helper

**Implementation constraints:**

- do not add a catch-all wrapper around every `Object.defineProperty(...)`
- only extract a helper when the repeated pattern has the same lifecycle, cleanup, and readability needs
- prefer small seam-specific helpers or local `beforeEach` / `afterEach` cleanup over a generic abstraction

### [ ] `T6-W3` Standardize DOM Container Setup Only In Repeated UI Hotspots

**Goal:** remove boilerplate without hiding required app-shell/container semantics.

**Primary files:**

- Modify if justified: `src/__tests__/helpers.ts`
- migrate only where repeated setup is obviously costly

**Current candidates:**

- `src/modules/ui/server-select/__tests__/ServerSelectScreen.test.ts`
- `src/modules/ui/epg/__tests__/EPGComponent.test.ts`
- `src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts`
- `src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts`
- `src/modules/ui/settings/__tests__/SettingsScreen.test.ts`

## Priority 7: Decompose Oversized Suites Where It Pays Off

**Default workflow lane:** Tier 2 standalone remediation

**Promote to Tier 3 when:** a hotspot split becomes multi-session or needs controller orchestration across planning, migration, and review loops

**Default plan shape:** one bounded plan per hotspot suite or tightly coupled hotspot pair

### [ ] `T7-W1` Shrink `verifyDocs.test.ts` Without Weakening Its Orchestration Role

**Goal:** reduce one giant tooling suite while keeping the targeted docs-verification proof easy to trust.

**Current evidence:**

- `verifyDocs.test.ts` is `3,446` lines and still costs `13.954s` on `npm run test:timings:tools`

**Preferred shape:**

- keep `verifyDocs.test.ts` as the docs-verification orchestration file
- extract bulky fixture builders, repo-fixture writers, and repetitive assertion helpers into sibling test-only modules when that materially improves readability
- split the suite into multiple top-level files only if the contracts are truly distinct and `verify:docs` remains equally explicit and trustworthy

### [ ] `T7-W2` Retire Or Shrink The Legacy Orchestrator Umbrella Suite

**Goal:** reduce the cost of the remaining legacy umbrella while preserving unique startup/composition behavior coverage.

**Current evidence:**

- `Orchestrator.test.ts` is `3,451` lines
- focused suites already exist under `src/__tests__/orchestrator/` and `src/core/orchestrator/__tests__/`

### [ ] `T7-W3` Split `EPGVirtualizer.test.ts` Only If It Improves Ownership Alongside `T5-W1`

**Goal:** avoid a cosmetic file split while still allowing a real cleanup if the internal-spy work exposes clean behavior families.

### [ ] `T7-W4` Split `ChannelSetupScreen.test.ts` Only If Workflow-Based Ownership Falls Out Naturally

**Goal:** do not create more helper sprawl than the split removes.

## Priority 8: Documentation And Final Exit

**Default workflow lane:** Tier 1 or Tier 2 closeout depending on churn

**Default plan shape:** one final closeout plan or one local-only closeout pass covering `T8-W1` + `T8-W2`

### [ ] `T8-W1` Update The Testing Guide

**Goal:** make the new conventions discoverable without requiring developers to reverse-engineer old suites.

**Primary files:**

- Modify: `docs/development/testing.md`
- Optionally modify: `README.md`

**Required docs updates:**

- new test command taxonomy
- console policy and expected-log helpers
- anti-pattern scope and baseline update process
- approved async/timer helper usage
- storage/global helper guidance
- explicit statement that coverage is telemetry, not a gate

### [ ] `T8-W2` Final Test Suite Cleanup Exit Review

**Required commands:**

- `desloppify status`
- `npm run test:timings`
- `npm run test:contracts`
- `npm run test:coverage -- --runInBand --silent`
- `npm run verify:docs`
- `npm run verify`

**Required final record:**

- product-suite timing after cleanup
- tool/governance-suite timing after cleanup
- contract/policy result
- coverage telemetry, explicitly non-gating
- remaining anti-pattern exceptions with owners
- largest remaining test files and written reason retained
- residual follow-up owners
