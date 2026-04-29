# Architecture Cleanup Checklist

> Live cleanup control plane.

This checklist is the compact control plane for the final production cleanup
program. It replaces the old score-chasing P14 wave loop as the active execution
surface. Completed P0-P13 and superseded P14 wave details remain historical
context in package maps, plans, commits, and archived summaries; they should not
drive the next cleanup task by default.

## Fresh-Session Handoff

- Current execution state: P0-P13 are complete. The old P14 wave ledger is
  superseded for current decision-making because repeated residual waves did not
  create meaningful score progress and kept expanding the active control plane.
- Next safe start: choose the first unchecked final cleanup priority below,
  perform its repo-wide/source-backed audit, freeze an execution-grade plan, run
  adversarial plan review, and only then implement the approved package.
- Preferred launcher: `cleanup-loop` for approved checklist-linked Tier 3
  cleanup packages.
- Active program: the six `FCP-*` priorities below. They are production-risk
  cleanup packages, not detector issue queues.
- Desloppify role: rubric input and optional end-of-program external score
  refresh only. Do not use Desloppify output as concrete issue intake, task
  admission, execution-unit membership, proof of closure, or wave sequencing.

## Rubric Basis

Use the quality rubric as a lens for engineering review, then rely on current
source, tests, architecture docs, and reviewer judgment for actual task intake.

- Subjective dimensions considered: naming quality, logic clarity, type safety,
  contract coherence, error consistency, abstraction fitness, AI-generated
  debt, high-level elegance, mid-level elegance, low-level elegance,
  cross-module architecture, initialization coupling, convention outlier,
  dependency health, test strategy, API surface coherence, authorization
  consistency, incomplete migration, package organization, and design
  coherence.
- Objective dimensions considered: file health, code quality, duplication, test
  health, security, objective strictness, and verified strictness.
- Current risk interpretation: mechanical health is already strong; the
  remaining risk is subjective and production-facing: boundary coherence,
  runtime contracts, focused design clarity, code signal, portability, and port
  test confidence.

## Operating Contract

- Work top to bottom unless maintainer direction says otherwise.
- Keep authoritative execution state in Codex `update_plan`.
- Start each priority with a repo-wide/source-backed audit before implementation.
  The audit must inspect production source and relevant tests/docs directly.
- Use rubric dimensions as audit prompts, not as source truth.
- Freeze one execution-grade plan per priority or per approved package inside a
  priority. Keep small plans local by default; promote to `docs/plans/*` only
  when durable tracked handoff memory is needed.
- Execute approved packages through planner -> reviewer -> cleanup_worker ->
  reviewer loops when `cleanup-loop` is used. The checklist names priorities and
  closeout gates; it does not enumerate endless waves.
- Keep every implementation package bounded by one owner, one seam, one proof
  surface, and explicit stop/replan triggers.
- Run `npm run verify` for UI, navigation, Orchestrator, Plex, lifecycle,
  settings, persistence, or runtime source work.
- Run `npm run verify:docs` for checklist, launcher, workflow, or reference-doc
  changes.
- A final optional external score refresh may be run after the whole program is
  complete. Treat that score as a retrospective signal, not as task intake.

## Audit-First Package Rules

Each priority audit must produce a short source-backed package brief before any
implementation begins:

- `source_finding_id`: stable local id such as `FCP-1-SF1`; this is the FCP
  package coverage token and is not a Desloppify or detector issue id
- `source findings`: exact files/symbols and the current-source reason the
  issue matters for production risk
- `rubric linkage`: dimensions that explain why the issue belongs in this
  priority
- `owner seam`: the module or composition boundary that should own the fix
- `files in scope`: exact files or directories the package may touch
- `files out of scope`: adjacent files explicitly frozen unless a replan occurs
- `closure condition`: what must become true in source, behavior, tests, and
  docs
- `verification routing`: exact commands and manual/source audits expected
- `stop/replan triggers`: boundary, behavior, verification, or ownership facts
  that invalidate the package

Do not admit work merely because a detector or prior historical row names it.
The current-source audit must make the case.

For FCP checklist-linked plans, package coverage is defined by the package
brief's `source_finding_id` values and proof matrix. Any future companion
artifact must use only `source_finding_id` / `source_finding_ids` coverage and
must not seed intake, membership, proof, closeout, task generation, or ownership
from imported, detector, or Desloppify ids.

For every FCP package or priority that claims repo-wide or package-wide audit
coverage, create or update either one tracked master audit artifact for that
FCP priority or explicit tracked per-area/package audit artifacts referenced by
the mini-record. The audit surface must exist before implementation or closeout
proceeds, and it must record audited areas, source-backed candidates,
accepted/no-action areas, deferred findings with one owner and revisit trigger,
known uncertainty/tool fallback, and the rule that future packages update the
audit when planned or closed. Execution plans may summarize the audit, but they
must link to the tracked audit surface instead of being the only durable
coverage record.

Each FCP priority mini-record should link the current audit artifact(s), active
or completed execution plan(s), `source_finding_id` proof matrix, deferred
owners and revisit triggers, verification evidence, and clean adversarial review
evidence before closeout. If any of those are intentionally absent, the
mini-record must say why and name the next owner or blocking condition.

## Mini-Record Contract

Every work item and exit gate must keep this compact ledger:

- `Status`: `not started`, `in progress`, `blocked`, or `completed`
- `Plan`: exact tracked plan path, `local-only`, or `none yet`
- `Last touched`: exact date or `not started`
- `Verification`: exact latest commands and result; `not run` is explicit
- `Follow-ups`: exact inherited/deferred residuals with one owner, or `none yet`
- `Handoff`: next safe step, next owner, or blocking condition

Do not check a box unless the mini-record is updated in the same pass with
current evidence.

## Priority Exit Enforcement

- Disposition vocabulary: `resolved`, `stale-proven`, `accepted residue`,
  `deferred`, `split follow-up`, and `owned follow-up`.
- Ownership rule: every deferred or split follow-up must have one single final
  owner, a reason, and a revisit trigger.
- Priority-exit review: run the matching closeout review before starting or
  planning the next priority.
- Do not mark progress on P(n+1) work until the current priority's P#-EXIT record is complete.
- FCP sequencing rule: do not start, plan, or mark progress on `FCP-(n+1)`
  until the current `FCP-n` mini-record is `completed` with its source audit,
  `source_finding_id` proof matrix, clean priority-exit review, verification
  evidence, and owned follow-ups recorded.
- Cleanup slice execution template:
  - `priority/work units`: exact `FCP-*` item and approved package in scope.
  - `imported review issues`: `none`; this program uses source-backed audit
    packages, not detector issue ids.
  - `security triage`: `no open P0 security findings`, or exact deferred or
    resolved P0 findings from the package audit.
  - `verification`: exact commands proving the slice.
  - `deferred items`: exact owner, reason, and revisit trigger.
  - `proof matrix`: source finding disposition, live residual status, final
    owner, and revisit trigger.
- Priority exit command checklist:
  - package source audit rerun for the priority's approved scope
  - package-local `rg`/static audits for the old and replacement patterns
  - task-specific targeted tests
  - strongest applicable verification command (`npm run verify` for runtime
    work, `npm run verify:docs` for docs/control-plane work)
  - source review confirming the closure condition is true and same-area residue
    has one owner
- FCP closeout exemption: FCP priority closeout does not require Desloppify
  commands, issue-id reruns, or package-map reconciliation. A single external
  score refresh is allowed only after `FCP-EXIT` as a retrospective signal.

## Final FCP Reconciliation Pass

After all `FCP-*` checklist priorities are completed or explicitly deferred,
run a source-backed final reconciliation pass before claiming final production
cleanup completion. Compare the tracked FCP audit artifacts, implemented source
and docs changes, mini-record proof matrices, and verification evidence to find
any follow-ups, ownership drift, stale architecture docs, stale package/audit
references, or newly introduced architecture/handoff residues. Any residual
must be recorded with one final owner and revisit trigger, or resolved before
`FCP-EXIT` closes. This final pass must not use Desloppify output, imported
issue ids, package maps, score deltas, or triage as closure input.

## Final Production Cleanup Program

### [x] `FCP-1` Architecture And Handoff Coherence

- Scope: reduce production risk from unclear ownership, broad handoff seams,
  composition-root drift, module hubs, and cross-module glue that makes behavior
  hard to change safely.
- Linked rubric dimensions: cross-module architecture, mid-level elegance,
  high-level elegance, package organization, initialization coupling, API
  surface coherence, and design coherence.
- Starting audit/plan expectation: audit current composition roots, hotspot
  modules, module boundary docs, package root exports, and cross-module
  handoffs. Produce one package brief per coherent ownership seam; do not split
  into tiny detector-shaped fixes.
- Verification routing: architecture source audit, targeted import/dependency
  audits, targeted tests for touched runtime seams, `npm run verify` for source
  work, and `npm run verify:docs` if current architecture truth changes.
- Status: completed
- Plan: `docs/plans/2026-04-29-fcp-1-app-orchestrator-runtime-assembly-hub.md`
- Audit: `docs/plans/2026-04-29-fcp-1-architecture-handoff-audit.md`
- Last touched: 2026-04-29
- Verification: `FCP-1-S1` source audits confirmed no app-shell
  import/exposure of `OrchestratorServerSelectionResult` /
  `ServerSelectionTypes`, no `startupResume` / `persistedSelection` /
  `readiness` leakage in app-shell or server-select, and full selected-server
  result ownership still in core/orchestrator. Targeted tests passed (`npm run
  test:unit -- ...`, 4 suites / 62 tests). `npm run verify:docs` and `npm run
  verify` passed for `FCP-1-S1`. `FCP-1-S2` source audits confirmed no
  `ChannelSetupWorkflowPort` / `getSetupPlanDiagnostics` exposure in
  channel-setup UI or `AppLazyScreenPortFactory`, and no full workflow/diagnostic
  method exposure in `AppShellChannelSetupRuntimePort`. Targeted tests passed
  (7 suites / 166 tests) plus `ChannelSetupScreen.contracts.test.ts` (1 suite /
  4 tests). `npm run verify` passed after the corrected implementation. `npm run
  verify:docs` passed after the `FCP-1-S2` completed plan, master audit, and
  checklist mini-record updates. `FCP-1-S3` source audits confirmed no
  `createPriorityOneAssembly(` / `createPriorityOneControllersAndBinder(` /
  `nowPlayingModalId` / `wireNavigationCoordinatorEvents` /
  `wireEpgCoordinatorEvents` hits in `AppOrchestrator`, while expected
  priority-one owner hits remained; confirmed priority-one guard, assignment,
  deferred bind, module/coordinator/runtime-controller/initialization startup
  anchors remained. Targeted tests passed:
  `PriorityOneAssemblyBuilder.test.ts`; `PriorityOneControllerCollaborators`,
  `PriorityOneControllerFactory.playbackState`, and `OrchestratorRuntimeSeams`;
  `src/__tests__/Orchestrator.test.ts`. `npm run verify` passed after the
  implementation revision.
- Follow-ups: proof matrix: `FCP-1-SF1` resolved by commit `75b59c4f`
  (`AppShellRuntimeContracts.ts` owns `AppShellServerSelectionResult` and no
  longer imports the core server-selection result); `FCP-1-SF2` resolved by
  commit `75b59c4f` (`CURRENT_STATE.md` and `modules.md` distinguish full
  core/orchestrator result ownership from narrowed app-shell/server-select
  ownership). `FCP-1-SF3` resolved by commits `23effad7` and `2326562f`
  (`ChannelSetupScreenWorkflowPort` owns the screen/session contract,
  app-shell screen runtime exposes `getChannelSetupScreenWorkflowPort()`, and
  `App.ts` projects the full core workflow into a diagnostics-free screen
  object). Accepted residual: `ChannelSetupSessionState.ts` still imports
  `normalizeChannelSetupConfig` from core planning; this is not DTO/constants
  residue. Final owner: channel setup UI/core boundary owner. Revisit trigger:
  rerun the FCP-1 audit if setup record hydration/normalization ownership
  changes, and include it in the final FCP reconciliation pass after the cleanup
  checklist completes. `FCP-1-SF4` resolved by commits `f2b33f28` and
  `05b6cf8`: `AppOrchestrator` now keeps only priority-one guards, required
  module validation, grouped call to `createPriorityOneRuntimeAssembly()`, and
  assignment of returned controllers/binder; `PriorityOneAssemblyBuilder.ts`
  owns mapping grouped runtime refs/callbacks into `PriorityOneAssemblyInput`
  plus controller/binder creation. Adjacent SF4 audit areas for module factory,
  coordinator assembly, runtime-controller builder, and initialization
  coordinator are accepted/no-action because current source still has focused
  owners and SF4 implementation did not need to edit them.
- Handoff: Completed plans are
  `docs/plans/2026-04-29-fcp-1-architecture-handoff-coherence.md`,
  `docs/plans/2026-04-29-fcp-1-channel-setup-ui-core-handoff.md`, and
  `docs/plans/2026-04-29-fcp-1-app-orchestrator-runtime-assembly-hub.md`.
  Master audit:
  `docs/plans/2026-04-29-fcp-1-architecture-handoff-audit.md`. Plan reviews
  passed for each package; SF4 implementation review closure found no findings
  and a fresh final implementation review approved SF4 source implementation for
  docs/audit closeout. Fresh FCP-1 priority-exit closeout review found no
  closeout findings and approved completion after accepting the source-finding
  proof matrix, accepted/no-action SF4 areas, residual owner, verification
  evidence, and mini-record update. `npm run verify:docs` passed after this
  completion status update.

### [x] `FCP-2` Runtime Contracts And Failure Semantics

- Scope: make public/internal runtime contracts predictable across parsing,
  network, Plex, persistence, startup, lifecycle, scheduler, and player paths.
  Prioritize inconsistent throws/returns, swallowed errors, context loss, broad
  DTOs, and fallback behavior that is hard to reason about.
- Linked rubric dimensions: error consistency, contract coherence, type safety,
  API surface coherence, authorization consistency, incomplete migration, and
  logic clarity.
- Starting audit/plan expectation: audit boundary contracts and failure flows
  directly in source and tests. Identify concrete mismatches in behavior or
  semantics before proposing code changes.
- Verification routing: targeted contract/regression tests where behavior can
  regress, source audit of error/fallback propagation, `npm run verify` for
  runtime changes, and reference-doc updates when public behavior contracts
  change.
- Status: completed
- Plan: `docs/plans/2026-04-29-fcp-2-runtime-contracts-failure-semantics.md`
- Audit: `docs/plans/2026-04-29-fcp-2-runtime-contracts-failure-semantics-audit.md`
- Last touched: 2026-04-29
- Verification: `FCP-2-SF1` resolved by commit `239b3db5`
  (`fix(fcp-2): enforce channel authoring failures`). Targeted ChannelManager
  tests passed (`npm run test:unit --
  src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts`, 1
  suite / 83 tests). Focused source audit for error/fallback strings returned
  expected ChannelManager/test anchors; focused coupling audit for raw storage,
  raw fetch, and direct Plex owner references in `ChannelManager.ts` returned no
  matches. Initial final `npm run verify` attempt exited 139 during
  `npm run test:contracts` after earlier phases passed; direct `npm run
  test:contracts` rerun passed (7 suites / 201 tests). Final `npm run verify`
  rerun passed after the completion update, including typecheck, architecture
  lint, CSS lint, coverage tests, tools tests, contracts, docs verification, and
  build. Standalone `npm run verify:docs` passed after the completion update.
- Follow-ups: proof matrix: `FCP-2-SF1` resolved by commit `239b3db5`.
  `createChannel()` and content-affecting `updateChannel()` now resolve content
  before publishing channel state, propagate non-fallback failures without
  persist/emit/state mutation, preserve deleted/empty-source fallback, and keep
  import non-fallback failures in structured skipped-record `ImportResult`
  errors. Accepted/no-action areas in the audit remain owned by Plex auth,
  Plex discovery, Plex library, Plex stream, storage owners, lifecycle/startup,
  channel tuning, and player/playback owners. No deferred `FCP-2` source
  findings are admitted. Revisit trigger: final FCP reconciliation must recheck
  the FCP-2 audit against implemented source/docs changes before `FCP-EXIT`
  closes.
- Handoff: Fresh FCP-2 closeout review found no material findings and approved
  completion after accepting the proof matrix, accepted/no-action owner record,
  verification evidence, and mini-record update. Next safe checklist priority is
  `FCP-3`; do not start it without its own cleanup-loop scope-load, source audit,
  plan, and review.

### [x] `FCP-3` Focused Design Coherence

- Scope: improve focused design where a file, class, or function mixes distinct
  responsibilities, carries dense control flow, or obscures the domain model.
  Avoid preference-only extraction; fix only source-backed production
  readability or maintainability risk.
- Linked rubric dimensions: design coherence, mid-level elegance,
  low-level elegance, abstraction fitness, logic clarity, convention outlier,
  and naming quality.
- Starting audit/plan expectation: audit current hotspots and recently changed
  coordination files for mixed responsibilities, unclear stage boundaries,
  unearned abstractions, and repeated structural patterns. Confirm each
  candidate has a real closure condition beyond "make it smaller."
- Verification routing: targeted tests for touched behavior, source review for
  responsibility boundaries, import/API stability audits, and `npm run verify`
  for source work.
- Status: completed
- Plan: `docs/plans/2026-04-29-fcp-3-focused-design-coherence.md`
- Audit: `docs/plans/2026-04-29-fcp-3-focused-design-coherence-audit.md`
- Last touched: 2026-04-29
- Verification: `FCP-3-SF1` resolved by implementation commit `22847d97`
  (`Extract settings screen focus coordinator`). Targeted controller rerun
  passed (`npm run test:unit --
  src/modules/ui/settings/__tests__/SettingsScreen.test.ts
  src/modules/ui/settings/__tests__/SettingsScreenStateController.test.ts`, 2
  suites / 46 tests). Package-local source audits showed focus graph/key
  handling/dropdown focus restoration terms moved into
  `SettingsScreenFocusCoordinator.ts`, with no remaining inline focus-owner
  implementation in `SettingsScreen.ts`; forbidden focus-owner audit found only
  allowed type-only `INavigationManager` usage and no storage, Plex/network,
  app-shell, concrete `NavigationManager`, auth, token, authorization, or
  security-sensitive persistence ownership. Cleanup-worker `npm run verify`
  passed after implementation. Controller-rerun final `npm run verify` passed
  after the completed plan, audit, and checklist closeout update, including
  typecheck, architecture lint, CSS lint, coverage tests, tools tests, contracts,
  docs verification, and build.
- Follow-ups: proof matrix: `FCP-3-SF1` resolved by commit `22847d97`.
  `SettingsScreenFocusCoordinator.ts` now owns focus graph registration, key
  routing, dropdown focus restoration, per-category detail focus memory,
  deferred focus restore intent, and focus registry sync; `SettingsScreen.ts`
  retains rendering, settings-state consumption, and screen lifecycle
  delegation. Accepted/no-action and deferred-outside-selected-package areas
  remain owned in the audit: EPG component/view owners, Plex stream resolver
  owner, scheduler/channel-manager owner, channel setup UI/screen owner, and
  core orchestrator/priority-one assembly owners, each with revisit triggers.
  Security triage: `no open P0 security findings`; final FCP reconciliation
  must recheck the FCP-3 audit against implemented source/docs changes before
  `FCP-EXIT` closes.
- Handoff: Fresh FCP-3 implementation review found no findings and approved
  `FCP-3-S1` for controller closeout. Fresh FCP-3 priority-exit closeout review
  found no findings and approved completion after accepting the proof matrix,
  accepted/no-action and deferred-outside-selected-package owner records,
  security triage, verification evidence, and mini-record update. Next safe
  checklist priority is `FCP-4`; do not start it without its own cleanup-loop
  scope-load, source audit, execution-grade plan, and clean plan review.

### [x] `FCP-4` AI-Generated Residue And Code Signal

- Scope: remove code-signal noise that makes production source look generated:
  restating comments, docstring bloat, generic names, defensive boilerplate,
  pass-through wrappers, and copied error/logging patterns. Preserve comments
  and wrappers that explain business rules, platform constraints, security,
  compatibility, lifecycle ordering, or external API contracts.
- Linked rubric dimensions: AI-generated debt, naming quality, abstraction
  fitness, low-level elegance, convention outlier, and duplication.
- Starting audit/plan expectation: perform a repo-wide source audit for noisy
  comments/wrappers/boilerplate and classify candidates as behavior-neutral,
  behavior-coupled, accepted residue, or out of scope. Do not run a drip-feed
  generated-comment loop.
- Verification routing: behavior-neutral diff audit, `git diff --check`,
  targeted source searches for removed and preserved patterns, targeted tests
  when code changes beyond comments, and `npm run verify` when source behavior
  or exported surfaces are touched.
- Status: completed
- Plan: `docs/plans/2026-04-29-fcp-4-ai-generated-residue-code-signal.md`
- Audit:
  `docs/plans/2026-04-29-fcp-4-ai-generated-residue-code-signal-audit.md`
- Last touched: 2026-04-29
- Verification: `FCP-4-WAVE1` implementation commit `f9eca40b` passed
  `ShuffleResult` pre/post source audits, old-pattern source audit,
  preserved-pattern source audit, package-local security/source audit,
  `npm run typecheck`, targeted scheduler tests (3 suites / 79 tests),
  `npm run verify`, `git diff --check`, and `git diff --cached --check`.
  Fresh implementation review found no blocking findings and approved the
  execution unit. Controller closeout `npm run verify:docs` passed in the
  pending-closeout state. Fresh FCP-4 priority-exit closeout review found no
  blocking findings and approved completion. Final post-completion
  `npm run verify:docs` passed before the closeout documentation commit.
- Follow-ups: completed proof matrix: `FCP-4-SF1` resolved by commit `f9eca40b`
  (scheduler restating comments/docblocks removed or compressed while invariant
  comments remain); `FCP-4-SF2` resolved by commit `f9eca40b` (`ShuffleResult`
  declaration and scheduler barrel export removed after fresh consumer proof
  found no consumers). Accepted/no-action and out-of-scope residual owners
  remain in the audit: `ScheduleConfig.loopSchedule` belongs to the scheduler
  API owner; Plex library interface docs belong to the Plex library contract
  owner; webOS/media-session/fail-open comments belong to player, Plex shared
  transport, and platform owners; brand glyph SVG comments belong to the UI
  common brand asset owner; production barrel comments belong to module package
  owners; test comment bloat belongs to relevant test owners. Security triage:
  `no open P0 security findings`.
- Handoff: FCP-4 is completed with source audit, execution plan, proof matrix,
  verification evidence, security triage/P0 disposition, implementation review,
  closeout review, final docs verification, and owned residuals recorded. Next
  safe checklist priority is `FCP-5`; do not start it without its own
  cleanup-loop scope-load, source audit, execution-grade plan, and clean plan
  review.

### [ ] `FCP-5` Portability Readiness

- Scope: prepare production code for a Windows/Electron-style port without
  implementing the port. Make platform assumptions explicit around webOS,
  browser APIs, storage, networking, lifecycle, fullscreen/media behavior,
  filesystem absence, and Plex connectivity.
- Linked rubric dimensions: initialization coupling, incomplete migration,
  dependency health, contract coherence, error consistency, authorization
  consistency, API surface coherence, and test strategy.
- Starting audit/plan expectation: audit platform-bound assumptions and decide
  whether each is an intentional webOS-only invariant, a portable runtime port,
  or a future-port blocker needing cleanup now.
- Verification routing: platform-assumption source audit, targeted tests for
  changed abstractions, `npm run verify` for runtime changes, and architecture
  or API doc updates when platform contracts become explicit.
- Status: not started
- Plan: none yet
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: planner should produce a portability-readiness package that clarifies
  assumptions without adding unused platform frameworks or speculative adapters.

### [ ] `FCP-6` Test Confidence For The Port

- Scope: raise confidence that the eventual port will preserve startup,
  navigation, Plex auth/discovery/library/stream behavior, scheduler/channel
  persistence, player recovery, settings persistence, and channel setup flows.
  Prioritize critical-path gaps, brittle timing/order tests, and missing
  cross-module proofs.
- Linked rubric dimensions: test strategy, test health, contract coherence,
  error consistency, initialization coupling, and portability readiness from
  the final program.
- Starting audit/plan expectation: audit current test coverage by critical user
  and runtime path. Identify where existing tests are sufficient, where a
  narrow regression/contract test is needed, and where manual/source proof is
  the right evidence.
- Verification routing: targeted new or updated tests only where they protect a
  real contract, `npm test`/targeted Jest commands as appropriate, `npm run
  verify` for broad runtime proof, and a final optional external score refresh
  after all six priorities complete.
- Status: not started
- Plan: none yet
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: planner should start from critical port-survival paths and avoid
  adding brittle tests that only codify implementation details.

### [ ] `FCP-EXIT` Final Production Cleanup Exit

- Close only if: every `FCP-*` priority is completed or explicitly deferred with
  one final owner, all priority closeout reviews are clean, current architecture
  truth is still accurate, and the strongest applicable verification has passed.
- Required evidence:
  - source-backed audit package or explicit no-action rationale for every
    priority
  - package proof matrices with every source finding disposed
  - final reconciliation pass over tracked FCP audit artifacts, implemented
    changes, mini-record proof matrices, and architecture docs
  - security triage for any touched runtime boundary
  - verification results for runtime and docs surfaces
  - final portability/test-confidence summary for port handoff
- Optional external score check: after the program closes, a single external
  score refresh may be run to compare rubric movement. It must not reopen the
  checklist by itself; any new work still needs maintainer approval and a
  source-backed audit.
- Status: not started
- Plan: none yet
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: do not declare final production cleanup complete until all six
  priorities have source-backed closeout records, clean review evidence, and a
  completed final reconciliation pass with any residuals owned.

## Not Active Checklist Scope By Default

- Historical P14 wave rows, old package-map issue ids, detector-lag rows, and
  stale focused-review language.
- Detector-generated or tool-generated identity/output must not be carried into
  FCP intake, membership, proof, or closeout. A source audit may independently
  rediscover the same source area, but the FCP package must describe it with
  local `source_finding_id` coverage and current-source proof.
- Broad hotspot cleanup without a named owner seam and closure condition.
- Port implementation work; this checklist prepares for the port but does not
  build it.
- Dirty source edits already present in the worktree; evaluate them separately
  before assuming they belong to a final cleanup package.

## Archived Priority Exit Anchors

These compact anchors keep the historical P1-P8 priority-exit gates visible to
the docs verifier without retaining the completed P0-P11 cleanup ledger in the
active docs tree.

- [x] `P1-EXIT`
  - required: record every mapped imported issue with an exact disposition, assign one single final owner for every deferred or split follow-up, and record the package score delta before moving to `P2`
  - Status: completed
  - Handoff: archived

- [x] `P2-EXIT`
  - required: record every mapped imported issue with an exact disposition, assign one single final owner for every deferred or split follow-up, and record the package score delta before moving to `P3`
  - Status: completed
  - Handoff: archived

- [x] `P3-EXIT`
  - required: record every mapped imported issue with an exact disposition, assign one single final owner for every deferred or split follow-up, and record the package score delta before moving to `P4`
  - Status: completed
  - Handoff: archived

- [x] `P4-EXIT`
  - required: record every mapped imported issue with an exact disposition, assign one single final owner for every deferred or split follow-up, and record the package score delta before moving to `P5`
  - Status: completed
  - Handoff: archived

- [x] `P5-EXIT`
  - required: record every mapped imported issue with an exact disposition, assign one single final owner for every deferred or split follow-up, and record the package score delta before moving to `P6`
  - Status: completed
  - Handoff: archived

- [x] `P6-EXIT`
  - required: record every mapped imported issue with an exact disposition, assign one single final owner for every deferred or split follow-up, and record the package score delta before moving to `P7`
  - Status: completed
  - Handoff: archived

- [x] `P7-EXIT`
  - required: record every mapped imported issue with an exact disposition, assign one single final owner for every deferred or split follow-up, and record the package score delta before moving to `P8`
  - Status: completed
  - Handoff: archived

- [x] `P8-EXIT`
  - required: record every mapped imported issue with an exact disposition, assign one single final owner for every deferred or split follow-up, and record the package score delta before moving to `P9`
  - Status: completed
  - Handoff: archived

## Completed P12 Subjective Refresh Summary

P12 is closed. Its exact completed package membership remains in
`docs/architecture/p12-subjective-refresh-package-map.json`.

- Final status: `P12-W1` through `P12-W5` and `P12-EXIT` completed.
- Closeout commit: `5738defa` `Close P12 exit scan evidence`.
- Final scan date: `2026-04-25`.
- Disposition: refreshed post-P12 review items seeded later historical cleanup.
  They are not active source-fix instructions for the final production cleanup
  program.

- [x] `P12-EXIT`
  - required: every P12 review issue had one checklist owner or explicit
    disposition, the P12 package map and checklist agreed, package-local checks
    passed, final integration-branch scan/queue/status/security/review evidence
    was recorded, and docs verification passed.
  - Status: completed
  - Handoff: archived

## Completed P13 Post-P12 Subjective Backlog Summary

P13 is closed. Its exact completed package membership remains in
`docs/architecture/p13-post-p12-subjective-backlog-package-map.json`.

- Final status: `P13-W1` through `P13-W5` and `P13-EXIT` completed.
- Closeout commit: `195508ab` `Close P13 cleanup exit`.
- Final scan date: `2026-04-26`.
- Disposition: no P13 exact-membership follow-ups remain. Historical detector
  wording should not be reopened without current-source proof and maintainer
  approval.

- [x] `P13-EXIT`
  - required: every P13 review issue had one checklist owner or explicit
    disposition, the P13 package map and checklist agreed, package-local checks
    passed, final integration-branch scan/status/queue/review/security evidence
    was recorded, and `npm run verify` / `npm run verify:docs` passed as
    appropriate.
  - Status: completed
  - Handoff: archived

## Historical P14 Wave Ledger

P14 was a score-targeted subjective cleanup program after P13. It completed many
source cleanup passes and left detailed accounting in
`docs/architecture/p14-post-p13-subjective-review-package-map.json`.

That ledger is now historical, not active control-plane state. Do not route new
work through old P14 waves, old focused-review admissions, or old detector issue
ids by default. Any future work in the same source areas must enter through the
`FCP-*` priorities above with a fresh source-backed audit, owner seam, proof
surface, and reviewed plan.
