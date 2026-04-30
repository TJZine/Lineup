# Architecture Cleanup Checklist

> Live cleanup control plane.

This checklist is the compact control plane for production cleanup. It replaces
the old score-chasing P14 wave loop as the active execution surface. Completed
P0-P13, superseded P14 wave details, and completed FCP packages remain
historical context in package maps, plans, commits, and archived summaries; they
should not drive the next cleanup task by default.

## Fresh-Session Handoff

- Current execution state: P0-P13 and FCP-1 through FCP-6 are complete. The old
  P14 wave ledger is superseded for current decision-making because repeated
  residual waves did not create meaningful score progress and kept expanding the
  active control plane.
- Next safe start: choose the first unchecked `DCR-*` package below, perform
  package-local source-backed discovery, freeze an execution-grade plan with
  package decomposition and one `ready_now_execution_unit`, run adversarial plan
  review, and only then implement the approved unit.
- Preferred launcher: `cleanup-loop` for approved checklist-linked Tier 3
  cleanup packages.
- Active program: `Dimension Cleanup Refresh` (`DCR-*`) below. The completed
  `FCP-*` records are baseline history and retained evidence, not the next task
  queue.
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
- Start each active DCR package with package-local source-backed discovery over
  the listed files/seams plus targeted adjacent searches required by its
  stop/replan triggers. Reserve repo-wide audit for `DCR-EXIT` or for a package
  whose listed scope explicitly requires repo-wide coverage.
- Use rubric dimensions as audit prompts, not as source truth.
- Freeze one execution-grade plan per priority or per approved package inside a
  priority. Keep small plans local by default; promote to `docs/plans/*` only
  when durable tracked handoff memory is needed.
- Active `DCR-*` cleanup-loop packages are durable Tier 3 handoff work by
  default. Write or refresh a tracked `docs/plans/*` execution plan while the
  package is active, then collapse durable outcomes into this checklist and
  current architecture/API docs at closeout. Delete the detailed active plan
  after closeout unless it contains a reusable architecture decision that must
  be promoted into a durable reference doc.
- Execute approved packages through planner -> reviewer -> cleanup_worker ->
  reviewer loops when `cleanup-loop` is used. The checklist names priorities and
  closeout gates; it does not enumerate endless waves.
- Keep every implementation package bounded by one owner, one seam, one proof
  surface, and explicit stop/replan triggers.
- For `DCR-*` packages, do not check a package complete unless every listed
  `actual issue` is fixed or reclassified with source-backed evidence, every
  `owner decision` is resolved or explicitly accepted with one owner and revisit
  trigger, every accepted residual is recorded with rationale, and the
  package-level completion criteria are satisfied.
- `DCR-*` cleanup-loop planning must plan coherent execution units or waves when
  the package is large. Do not close a package after one micro-fix while listed
  issues remain. Parallel `cleanup_worker` slices are allowed only when the
  approved plan shows disjoint write scopes, disjoint verification surfaces, and
  one controller-owned integration/closeout path.
- Run `npm run verify` for UI, navigation, Orchestrator, Plex, lifecycle,
  settings, persistence, or runtime source work.
- Run `npm run verify:docs` for checklist, launcher, workflow, or reference-doc
  changes.
- A final optional external score refresh may be run after the whole program is
  complete. Treat that score as a retrospective signal, not as task intake.

## Audit-First Package Rules

For the completed FCP baseline, each priority audit had to produce a short
source-backed package brief before implementation began:

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

For active DCR checklist-linked plans, package coverage is defined by the
listed `DCR-*-A*` actual issues and `DCR-*-D*` owner decisions, plus any
absorbed-now residue that meets the approved execution-unit absorption rules.
Do not invent FCP-style `source_finding_id` coverage for DCR unless a
maintainer explicitly changes this control-plane contract.

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
  commands, issue-id reruns, or package-map reconciliation. This historical
  exemption is superseded for active work by `DCR-EXIT`, and any external score
  refresh waits until `DCR-EXIT` closes.

## Final FCP Reconciliation Pass

This historical FCP-only pass is superseded by active `DCR-EXIT`. The retained
FCP records remain required input to final reconciliation, but final production
cleanup completion now requires DCR package reconciliation first. This final
pass must not use Desloppify output, imported issue ids, package maps, score
deltas, or triage as closure input.

## Dimension Cleanup Refresh

The `DCR-*` packages are the active cleanup surface after the first six FCP
priorities. They are seeded from deep source review findings, not from a
Desloppify queue. Rubric dimensions are review prompts only: file health, code
quality, duplication, test health, security, naming/API/error/abstraction/logic,
AI-generated residue, type safety, contract coherence, cross-module design, and
structure/elegance.

Discovery note for this refresh: Codanna was not available in the planning
session that created these package briefs, so file orientation used required
docs plus direct `rg`/source reads. Each execution plan must still run the
repo-required Codanna-first discovery pass, or record the same fallback if the
tool remains unavailable.

### DCR Operating Rules

- Treat each `DCR-*` row as one checklist-linked package for `cleanup-loop`.
- Do not use Desloppify output, imported issue ids, score deltas, or old queue
  rows as DCR task intake. A package plan may use rubric dimensions to review
  the scope, but membership is owned by the listed actual issues and owner
  decisions below.
- A DCR package may not be checked complete while any listed actual issue
  remains open. If source discovery disproves an issue, reclassify it with the
  exact evidence, final owner, and revisit trigger.
- DCR issue deferral is allowed only inside a completed package at individual
  issue/residual level, or through explicit maintainer-approved migration out of
  DCR with a named destination, one owner, revisit trigger, and a reason the
  migrated issue is not a final-cleanup blocker.
- Owner decisions must be resolved in the plan or explicitly accepted as
  residuals with one owner and revisit trigger. Do not hide undecided API,
  persistence, error, or test policy inside implementation steps.
- Large packages must plan coherent waves or execution units. A plan that fixes
  one tiny symptom while leaving same-package listed issues unowned is not
  implementation-ready.
- The active DCR plan lives in `docs/plans/*` while implementation/review is in
  progress. Keep worker implementation commits focused on source/test changes;
  checklist and plan-progress updates belong to controller closeout or a
  separate docs commit. At package closeout, preserve long-term facts in the
  mini-record, delete or archive the verbose execution plan, and promote only
  durable architecture/API decisions into the relevant reference docs.
- Parallel `cleanup_worker` execution is allowed only when the approved plan's
  slice table proves disjoint write scopes and verification, and names the
  controller-owned integration gate.
- `ready_now_execution_unit: none until plan is written` means the controller
  must first create/review an execution-grade plan with package decomposition,
  `slice_table`, `coverage_check`, and `ready_now_execution_unit`.

### DCR Accepted Baselines

These are not active implementation packages unless source discovery materially
changes them:

- `src/App.ts` is broadly acceptable as an app-shell composition root.
- The Settings focus extraction is closed; only shared event/API cleanup and
  constructor dependency cleanup may revisit Settings focus-adjacent code.
- `EPGVirtualizer` is a bounded internal performance owner.
- Plex token redaction/security is currently acceptable and should be preserved
  by any Plex stream cleanup.
- `window.close()` in `ExitConfirmCoordinator` is intentional webOS behavior
  and already has targeted tests.
- `ChannelSetupSessionState` importing `normalizeChannelSetupConfig` remains an
  accepted residual unless setup-record normalization ownership changes.

### [x] `DCR-1` Scheduler And ChannelManager Transactional/API Semantics

- Status: completed
- Dimensions/rubric tags: contract coherence, error consistency, type safety,
  logic clarity, test strategy, API surface coherence
- Scope owner: scheduler/channel-manager owner
- Why this package exists / production risk: channel authoring and scheduling
  are persistence-backed state machines. Misstated atomic behavior, ambiguous
  reorder semantics, and unused scheduler config make rollback, import, and
  port behavior hard to trust.
- Files in scope:
  - `src/modules/scheduler/channel-manager/ChannelManager.ts`
  - `src/modules/scheduler/channel-manager/interfaces.ts`
  - `src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts`
  - `src/modules/scheduler/scheduler/interfaces.ts`
  - `src/modules/scheduler/scheduler/ChannelScheduler.ts`
  - `src/modules/scheduler/scheduler/__tests__/ChannelScheduler.test.ts`
  - package docs/tests needed to document scheduler API decisions
- Files out of scope:
  - broad channel persistence store redesign
  - content resolver policy not needed for listed issues
  - UI channel setup flows except tests that consume public channel-manager
    behavior
- Known issues to retire:
  - actual issues:
    - `DCR-1-A1`: `ChannelManager.replaceAllChannels` claims atomic behavior
      but mutates state before persistence can fail; add regression coverage
      that a failed save preserves prior channels, current channel, and cache.
    - `DCR-1-A2`: `ChannelManager.importChannels` formats caught errors with
      `(e as Error).message`, which produces `undefined` for non-`Error`
      throwables; use the repo error summarizer.
  - owner decisions:
    - `DCR-1-D1`: decide whether `reorderChannels` requires an exact full
      order or supports partial reorder. Current filtering drops omitted
      existing channels; chosen behavior needs tests and docs/comments at the
      API seam.
    - `DCR-1-D2`: decide whether `ScheduleConfig.loopSchedule` is a supported
      public config field or dead/speculative API. It is written/instantiated
      but not read by scheduler implementation.
  - accepted residuals:
    - none yet; any residual must name one scheduler owner and revisit trigger.
- Completion means: every actual issue above is fixed or source-disproved; both
  owner decisions are resolved with tests/docs or explicitly accepted; no
  ChannelManager transactional claim remains narrower than implemented
  behavior.
- Verification routing: targeted ChannelManager and scheduler tests for changed
  contracts, source audit for non-`Error` handling and reorder/loopSchedule
  consumers, then `npm run verify`.
- Ready-now execution unit: none until plan is written.
- Suggested slice table / wave candidates:

  | Slice | Candidate goal | Write scope | Parallel policy |
  | --- | --- | --- | --- |
  | `DCR-1-S1` | transactional `replaceAllChannels` behavior and regression coverage | `ChannelManager.ts`, `ChannelManager.test.ts` | serial with S2 |
  | `DCR-1-S2` | import error summarization and reorder decision/tests | channel-manager files/tests | serial with S1 |
  | `DCR-1-S3` | `loopSchedule` keep/remove/document decision | scheduler interface/runtime/tests/docs | may run apart only if plan proves no shared tests with S1/S2 |

- Stop/replan triggers: fix requires changing storage owner APIs; reorder
  decision changes UI-facing product behavior; `loopSchedule` is consumed by
  undiscovered runtime code; verification requires broader port/manual proof.
- Plan:
  [`docs/archive/plans/2026-04-29-dcr-1-scheduler-channel-manager-api-semantics.md`](./docs/archive/plans/2026-04-29-dcr-1-scheduler-channel-manager-api-semantics.md)
- Last touched: 2026-04-29, implementation commit `12a5647d`
- Verification: targeted source audits passed for `(e as Error).message`,
  production `reorderChannels` consumers, and `loopSchedule` under `src`;
  targeted ChannelManager transactional/import-order tests passed; affected
  scheduler/core/UI tests passed; `npm run typecheck` passed; `npm run verify`
  passed. Implementation review found one P3 nit, same-reviewer closure
  approved the fix, and a fresh final implementation review approved
  `DCR-1-WAVE1`.
- Follow-ups: none for `DCR-1`. `DCR-10` remains open for its broader test
  structure package; `DCR-1` respected it by adding focused ChannelManager test
  files instead of growing the catch-all `ChannelManager.test.ts`.
- Handoff: start with a DCR-1 checklist-linked cleanup plan; do not implement a
  single ChannelManager test without resolving the package decisions.

### [x] `DCR-2` Channel Setup UI Persistence And Runtime Contract

- Status: completed
- Dimensions/rubric tags: persistence ownership, contract coherence, error
  consistency, cross-module architecture, type safety, test strategy
- Scope owner: channel setup UI/core boundary owner
- Why this package exists / production risk: channel setup spans UI, app-shell,
  core planning, Plex library facets, and persistence. Direct selected-server
  storage reads and ambiguous failure/result contracts bypass the intended
  app-shell/core seams and make setup failures hard to reason about.
- Files in scope:
  - `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
  - `src/modules/ui/channel-setup/ChannelSetupScreenPorts.ts`
  - `src/modules/ui/channel-setup/ChannelSetupSessionContracts.ts`
  - `src/modules/ui/channel-setup/ChannelSetupSessionRuntime.ts`
  - `src/modules/ui/channel-setup/ChannelSetupSessionState.ts`
  - `src/modules/ui/channel-setup/__tests__/*`
  - `src/core/app-shell/AppLazyScreenPortFactory.ts`
  - `src/core/app-shell/AppShellRuntimeContracts.ts`
  - `src/core/channel-setup/workflow/ChannelSetupWorkflowPort.ts`
  - `src/core/channel-setup/workflow/createChannelSetupWorkflowPort.ts`
  - `src/core/channel-setup/planning/ChannelSetupPlanningService.ts`
  - `src/core/channel-setup/planning/ChannelSetupFacetSnapshotFailures.ts`
- Files out of scope:
  - deep facet loader/executor cache/test cleanup owned by `DCR-7`
  - broad Plex library behavior outside setup facet failure semantics
  - accepted `ChannelSetupSessionState` normalization import unless ownership
    changes
- Known issues to retire:
  - actual issues:
    - `DCR-2-A1`: `ChannelSetupScreen` imports/instantiates
      `ServerSelectionStore` and reads selected-server persistence directly,
      bypassing app-shell/core ports.
  - owner decisions:
    - `DCR-2-D1`: decide failure semantics for collections/playlists/native
      tags. Collection/playlist failures currently continue as warnings while
      native tag failures block or slow plan creation; chosen behavior needs
      tests if changed.
    - `DCR-2-D2`: decide whether the UI runtime result shape should keep
      string-only load/build/completion errors or move to typed summarized
      errors. If string-only is retained, record the UI-level contract and
      owner.
  - accepted residuals:
    - `ChannelSetupSessionState` -> `normalizeChannelSetupConfig` remains
      accepted unless record-normalization ownership changes.
- Completion means: selected-server persistence flows only through the
  approved ports; failure semantics and result error shape are decided and
  tested or explicitly accepted; the package cannot close with only the direct
  store import removed while the runtime contract decisions remain open.
- Verification routing: targeted channel setup UI/session/core workflow tests,
  source audit for `ServerSelectionStore`/selected-server storage use in UI,
  failure-semantics tests if changed, then `npm run verify`.
- Ready-now execution unit: none until plan is written.
- Suggested slice table / wave candidates:

  | Slice | Candidate goal | Write scope | Parallel policy |
  | --- | --- | --- | --- |
  | `DCR-2-S1` | remove selected-server persistence leak behind app-shell/core port | UI screen/session + app-shell port tests | serial before S2 if runtime result shape changes |
  | `DCR-2-S2` | settle runtime result error contract | UI session contracts/runtime/tests | serial with S1 |
  | `DCR-2-S3` | settle facet failure semantics at planning boundary | planning service/failure tests | may run apart from S1/S2 only with disjoint tests |

- Stop/replan triggers: selected-server fix requires changing Plex discovery
  store ownership; UI error shape change becomes user-visible product behavior;
  facet decision overlaps DCR-7 cache/executor ownership.
- Plan:
  [`docs/archive/plans/2026-04-29-dcr-2-channel-setup-ui-persistence-runtime-contract.md`](./docs/archive/plans/2026-04-29-dcr-2-channel-setup-ui-persistence-runtime-contract.md)
- Last touched: 2026-04-29, implementation commit `fe7ec675`
- Verification: plan review approved with no material findings; targeted
  selected-server source audits passed; targeted channel setup/app-shell Jest
  coverage passed (`7` suites / `170` tests); targeted channel setup contract
  test passed (`1` suite / `6` tests); `npm run typecheck` passed;
  implementation review approved `DCR-2-WAVE1` with no material findings;
  `npm run verify` passed after checklist/current-state/plan-archive closeout
  changes; final `npm run verify:docs` passed after the mini-record evidence
  update.
- Follow-ups: accepted residual only:
  `ChannelSetupSessionState` -> `normalizeChannelSetupConfig` remains owned by
  the channel setup record-normalization owner, with revisit trigger if
  setup-record normalization ownership changes or `DCR-EXIT` source
  reconciliation disproves the accepted baseline. `DCR-7` remains open for
  loader/executor cache, progress, concurrency, and fixture cleanup. `DCR-10`
  remains open for unrelated catch-all test structure policy.
- Handoff: `DCR-2` is complete. Do not reopen selected-server persistence in
  channel setup UI; consume selected-server runtime state through the
  app-shell/core channel setup port. DCR-3 is the next unchecked DCR package
  only when the maintainer starts the next cleanup loop.

### [x] `DCR-3` Event Subscription And Error Import Coherence

- Status: completed
- Dimensions/rubric tags: API surface coherence, contract coherence, type
  safety, cross-module architecture, duplication, naming/API consistency
- Scope owner: shared event/API contract owner with module-specific event
  owners
- Why this package exists / production risk: runtime listeners span navigation,
  player, Plex, EPG, auth, discovery, and channel management. Mixed
  disposable-return and void `on/off` patterns make cleanup ownership and
  leak-prevention inconsistent, while `AppErrorCode` import-source drift keeps
  the error taxonomy seam unclear.
- Files in scope:
  - `src/utils/EventEmitter.ts`
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
  - `src/modules/plex/stream/interfaces.ts`
  - `src/modules/plex/stream/PlexStreamResolver.ts`
  - `src/modules/plex/stream/__tests__/PlexStreamResolver.test.ts`
  - `src/modules/plex/library/interfaces.ts`
  - `src/modules/plex/library/PlexLibrary.ts`
  - `src/modules/plex/library/__tests__/PlexLibrary.test.ts`
  - `src/modules/plex/auth/interfaces.ts`
  - `src/modules/plex/auth/PlexAuth.ts`
  - `src/modules/plex/discovery/interfaces.ts`
  - `src/modules/plex/discovery/PlexServerDiscovery.ts`
  - `src/modules/scheduler/channel-manager/interfaces.ts`
  - `src/modules/scheduler/channel-manager/ChannelManager.ts`
  - `src/modules/ui/epg/component/EPGComponent.ts`
  - `src/modules/ui/epg/component/DeferredEPGComponent.ts`
  - `src/modules/ui/epg/view/EPGErrorBoundary.ts`
  - `src/modules/ui/epg/__tests__/EPGComponent.test.ts`
  - `src/modules/ui/epg/__tests__/EPGErrorBoundary.test.ts`
  - `src/App.ts`
  - `src/core/orchestrator/AppOrchestrator.ts`
  - `src/types/app-errors.ts`
  - `src/core/error-recovery/LifecycleErrorAdapter.ts`
- Files out of scope:
  - unrelated behavior changes inside event producers
  - broad App or AppOrchestrator decomposition beyond import/API normalization
  - token/security behavior already owned by Plex packages
- Known issues to retire:
  - actual issues:
    - `DCR-3-A1`: canonical `EventEmitter` returns `IDisposable`, but
      navigation/player/Plex stream/EPG surfaces expose void `on/off` while
      Plex auth/discovery/channel-manager expose disposable `on()`.
    - `DCR-3-A2`: Plex library interface declares void subscription cleanup
      while implementation returns a disposable.
    - `DCR-3-A3`: `App`, `AppOrchestrator`, and Plex import `AppErrorCode` from
      drifted sources; choose and normalize the canonical import path for
      production modules.
  - owner decisions:
    - `DCR-3-D1`: decide whether all event APIs should return `IDisposable`,
      support `off`, or keep a documented split by module boundary.
    - `DCR-3-D2`: decide whether lifecycle/error-recovery facade imports remain
      valid for production callers or whether direct `src/types/app-errors`
      imports are canonical.
  - accepted residuals:
    - none.
- Completion means: event subscription contracts are internally coherent and
  documented/tested at the public seams; Plex library interface matches
  implementation; error-code import source is normalized or explicitly
  documented. Closing only one event producer is not enough.
- Verification routing: targeted event surface/interface tests, source audit for
  `on(`/`off(` return contracts and `AppErrorCode` import paths, then
  `npm run verify`.
- Ready-now execution unit: completed.
- Suggested slice table / wave candidates:

  | Slice | Candidate goal | Write scope | Parallel policy |
  | --- | --- | --- | --- |
  | `DCR-3-S1` | choose and normalize event subscription contract | shared event utilities + module interfaces/tests | serial; shared public seam |
  | `DCR-3-S2` | normalize Plex library subscription interface | Plex library interface/implementation/tests | may join S1 wave |
  | `DCR-3-S3` | normalize `AppErrorCode` import source | app/orchestrator/Plex imports/tests | may run after S1 if no shared files |

- Stop/replan triggers: public interface changes require broad caller rewrites;
  canonical event decision conflicts with existing docs/API; error taxonomy
  facade ownership is still undecided after source discovery.
- Plan:
  [`docs/archive/plans/2026-04-29-dcr-3-event-subscription-error-import-coherence.md`](./docs/archive/plans/2026-04-29-dcr-3-event-subscription-error-import-coherence.md)
- Last touched: 2026-04-29, implementation commits `53b57edb`,
  `25a3e2f9`, and `d274fa74`
- Verification: plan review initially found material scope/audit issues; the
  planner revised them, same-reviewer closure approved, and a fresh final plan
  review approved implementation. `DCR-3-WAVE1` implementation review approved
  disposable-return event contract normalization with no material findings.
  `DCR-3-S3` implementation review found remaining lifecycle-sourced
  `AppErrorCode` imports in channel-manager/profile-select production files;
  revision commit `d274fa74` fixed them, same-reviewer closure approved, and a
  fresh final implementation review approved S3. Targeted event/interface tests
  passed; targeted S3 tests passed; source audits passed for public `on()`
  return contracts and production `AppErrorCode` import/re-export drift;
  `npm run typecheck` passed; `npm run verify` passed; `npm run verify:docs`
  passed after the Plex API docs and checklist closeout updates.
- Follow-ups: none. The canonical event contract is that public `on()` methods
  return `IDisposable`; existing `off()` remains where already exposed, but new
  cleanup should prefer the disposable. The canonical production
  `AppErrorCode` import source for non-lifecycle modules is
  `src/types/app-errors.ts`; lifecycle-owned non-`AppErrorCode` types remain
  with lifecycle owners.
- Handoff: `DCR-3` is complete. Do not reopen event subscription cleanup unless
  a new public `on()` surface returns `void` or source audit finds a real
  listener-cleanup regression. Do not reopen `AppErrorCode` import coherence
  unless a non-lifecycle production module imports or re-exports it from a
  lifecycle/Plex facade. `DCR-4` is the next unchecked DCR package only when
  the maintainer starts the next cleanup loop.

### [x] `DCR-4` EPG Defaults And Constants Coherence

- Status: completed
- Dimensions/rubric tags: contract coherence, UI correctness, test strategy,
  source-of-truth coherence, logic clarity
- Scope owner: EPG config/app-shell config boundary owner
- Why this package exists / production risk: inconsistent EPG defaults produce
  subtle layout/runtime drift between UI-owned constants and app-shell
  orchestrator config assembly.
- Files in scope:
  - `src/modules/ui/epg/constants.ts`
  - `src/modules/ui/epg/types.ts`
  - `src/modules/ui/epg/component/EPGComponent.ts`
  - `src/modules/ui/epg/__tests__/*`
  - `src/core/app-shell/AppOrchestratorConfigFactory.ts`
  - `src/core/app-shell/__tests__/AppOrchestratorConfigFactory.test.ts`
  - `src/modules/ui/epg/startup/buildEPGStartupConfig.ts`
- Files out of scope:
  - EPGVirtualizer internals unless row-height source-of-truth changes require
    test updates
  - broad EPG design/layout refactors
  - app-shell composition behavior unrelated to EPG config defaults
- Known issues to retire:
  - actual issues:
    - `DCR-4-A1`: UI EPG constants use `rowHeight` 108 while
      `AppOrchestratorConfigFactory` defines `DEFAULT_EPG_CONFIG.rowHeight` 96.
  - owner decisions:
    - `DCR-4-D1`: decide which module owns canonical EPG default config and
      whether app-shell should import it, adapt it, or intentionally override
      it with documented rationale.
  - accepted residuals:
    - `EPGVirtualizer` remains a bounded performance owner unless canonical
      defaults force direct changes.
- Completion means: there is one documented source of truth or an explicit
  documented override for EPG row height; tests protect the chosen contract; no
  package closeout if only one literal is changed without deciding ownership.
- Verification routing: targeted app-shell config and EPG config tests, source
  audit for `rowHeight` defaults, then `npm run verify`.
- Ready-now execution unit: completed.
- Suggested slice table / wave candidates:

  | Slice | Candidate goal | Write scope | Parallel policy |
  | --- | --- | --- | --- |
  | `DCR-4-S1` | decide and normalize EPG default ownership | EPG constants + app-shell config/tests | single-slice package |

- Stop/replan triggers: default change requires visual/product approval; tests
  reveal row height is intentionally context-specific; fix expands into EPG
  layout/virtualization behavior.
- Plan:
  [`docs/archive/plans/2026-04-29-dcr-4-epg-defaults-constants-coherence.md`](./docs/archive/plans/2026-04-29-dcr-4-epg-defaults-constants-coherence.md)
- Last touched: 2026-04-29, implementation commit `0b1dce57`
- Verification: plan review approved with no material findings. `DCR-4-S1`
  implementation review approved with no material findings. Targeted
  app-shell/EPG config tests passed (`6` suites / `98` tests); source audit
  found no app-shell `rowHeight: 96` default or app-shell
  `DEFAULT_EPG_CONFIG` remaining; `npm run plans:check` passed; `npm run
  verify` passed; `npm run verify:docs` passed after the checklist/current-state
  closeout updates and plan archive.
- Follow-ups: none. `src/modules/ui/epg/constants.ts` owns canonical EPG
  default config values, including row height `108`; app-shell consumes fresh
  defaults through the EPG package seam and has no independent EPG row-height
  override. `EPGVirtualizer` remains a bounded performance owner.
- Handoff: `DCR-4` is complete. Do not reopen EPG default coherence unless
  app-shell regains an independent EPG default literal or product-approved
  visual requirements create an explicit documented override. DCR-5 is the next
  unchecked DCR package only when the maintainer starts the next cleanup loop.

### [x] `DCR-5` Navigation FocusManager Correctness And Tests

- Status: completed
- Dimensions/rubric tags: test strategy, UI/focus correctness, AI-generated
  residue, logic clarity, type safety
- Scope owner: navigation/focus owner
- Why this package exists / production risk: focus behavior is TV-critical.
  Restating docblocks lower source signal, while missing visibility/grid/fixed
  position tests leave D-pad navigation behavior under-proven.
- Files in scope:
  - `src/modules/navigation/FocusManager.ts`
  - `src/modules/navigation/__tests__/FocusManager.test.ts`
  - focus policy helpers/tests if needed to preserve public behavior
- Files out of scope:
  - broad `NavigationManager` or remote input refactors
  - Settings focus extraction, already closed
  - UI screen-specific focus coordinators unless source proof shows a direct
    FocusManager contract dependency
- Known issues to retire:
  - actual issues:
    - `DCR-5-A1`: `FocusManager` contains restating/generated-looking
      docblocks/comments that should be removed or compressed while preserving
      real invariants.
    - `DCR-5-A2`: missing grid/spatial/fixed-position visibility tests leave
      focus movement behavior under-proven.
  - owner decisions:
    - `DCR-5-D1`: decide whether `_isVisible` should rely on `offsetParent`
      policy as-is, change behavior for fixed-position elements, or document an
      intentional limitation with tests.
  - accepted residuals:
    - no broad navigation rewrite; only FocusManager contract/source-signal
      cleanup is admitted.
- Completion means: noisy comments are retired; `_isVisible` policy is decided
  and covered; grid/spatial/fixed-position tests protect behavior; package
  cannot close on comment cleanup alone.
- Verification routing: targeted FocusManager tests, source audit for removed
  restating comments and `_isVisible` behavior, then `npm run verify`.
- Ready-now execution unit: completed.
- Suggested slice table / wave candidates:

  | Slice | Candidate goal | Write scope | Parallel policy |
  | --- | --- | --- | --- |
  | `DCR-5-S1` | visibility policy decision and tests | `FocusManager.ts`, `FocusManager.test.ts` | serial |
  | `DCR-5-S2` | comment/source-signal cleanup after tests lock behavior | `FocusManager.ts` | serial after S1 |

- Stop/replan triggers: visibility behavior affects multiple screen focus
  coordinators; browser/jsdom limits require manual proof; fix requires public
  navigation API changes.
- Plan:
  [`docs/archive/plans/2026-04-29-dcr-5-navigation-focusmanager-correctness-and-tests.md`](./docs/archive/plans/2026-04-29-dcr-5-navigation-focusmanager-correctness-and-tests.md)
- Last touched: 2026-04-29, implementation commits `ceee655a` and `42245764`
- Verification: plan review approved with no material findings. `DCR-5-S1`
  implementation review found one zero-size coverage gap, which was fixed and
  cleared by closure review plus a fresh final approval pass. `DCR-5-S2`
  implementation review approved with no material findings. Targeted
  `FocusManager` tests passed (`21` tests); source audit confirmed `_isVisible`
  excludes zero-size, hidden, detached, and non-fixed `offsetParent === null`
  candidates while admitting visible fixed-position candidates with non-zero
  rects, and confirmed only invariant comments remain; `npm run plans:check`
  passed; `npm run verify` passed.
- Follow-ups: none. `_isVisible` now has one intentional private policy:
  fixed-position overlays with visible rects can participate in spatial focus
  even when `offsetParent === null`; detached, hidden, zero-size, and non-fixed
  layoutless candidates remain excluded. Grid, spatial fallback, hidden,
  detached, zero-size, and fixed-position behavior are covered through
  `findNeighbor` tests.
- Handoff: `DCR-5` is complete. Do not reopen navigation focus visibility
  policy unless source proof shows screen-specific focus coordinators need
  incompatible semantics, browser/jsdom behavior diverges from the tested
  contract, or the public navigation API changes. DCR-6 is the next unchecked
  DCR package only when the maintainer starts the next cleanup loop.

### [x] `DCR-6` AppOrchestrator Narrow API And File-Health Cleanup

- Status: completed
- Dimensions/rubric tags: file health, API surface coherence, cross-module
  architecture, duplication, AI-generated residue, initialization coupling
- Scope owner: core orchestrator owner
- Why this package exists / production risk: `AppOrchestrator` remains a large
  runtime hub. The intended cleanup is narrow: reduce avoidable API/file-health
  risks without reopening a broad orchestrator rewrite.
- Files in scope:
  - `src/core/orchestrator/AppOrchestrator.ts`
  - `src/Orchestrator.ts`
  - `src/core/orchestrator/OrchestratorCoordinatorAssembly.ts`
  - `src/core/orchestrator/OrchestratorCoordinatorContracts.ts`
  - `src/core/orchestrator/OrchestratorPlaybackInfoSnapshot.ts`
  - `src/core/orchestrator/OrchestratorPlaybackStateAccessors.ts`
  - `src/core/orchestrator/OrchestratorEventCleanupReporter.ts`
  - `src/core/orchestrator/OrchestratorShutdownTeardown.ts`
  - `src/core/orchestrator/__tests__/*`
  - `src/__tests__/Orchestrator.test.ts`
- Files out of scope:
  - broad priority-one, app-shell, EPG, Plex, or playback redesign
  - `src/App.ts` cleanup unless import/API normalization from `DCR-3` requires
    a narrow touch
  - module factory rewrites not needed for listed issues
- Known issues to retire:
  - actual issues:
    - `DCR-6-A1`: `AppOrchestrator` remains a large hub with wider public
      exports/API surface than needed.
    - `DCR-6-A2`: inline playback snapshot logic should be owned by a focused
      accessor/helper if source review confirms it is still inline.
    - `DCR-6-A3`: non-null assertion cluster in coordinator assembly input
      needs a safer owned construction seam.
    - `DCR-6-A4`: restating docs/comments and repeated shutdown teardown
      pattern lower source signal and increase maintenance risk.
  - owner decisions:
    - `DCR-6-D1`: decide exact public exports that `src/Orchestrator.ts` should
      retain for app/test import stability.
  - accepted residuals:
    - no broad orchestrator rewrite; this package is file-health/API surface
      cleanup only.
    - `src/App.ts` remains broadly acceptable as composition root.
- Completion means: listed narrow hub/file-health issues are retired or
  evidence-reclassified; export surface decision is documented in plan/closeout;
  no package closeout if only comments are removed while API/non-null/shutdown
  issues remain.
- Verification routing: targeted orchestrator tests for touched seams,
  import/export source audit, `npm run verify`; `npm run verify:docs` if
  architecture truth changes.
- Ready-now execution unit: completed.
- Suggested slice table / wave candidates:

  | Slice | Candidate goal | Write scope | Parallel policy |
  | --- | --- | --- | --- |
  | `DCR-6-S1` | export/API surface and playback snapshot ownership | orchestrator barrel/accessor/tests | serial |
  | `DCR-6-S2` | coordinator assembly non-null cluster | assembly contracts/builders/tests | serial with S1 if shared construction |
  | `DCR-6-S3` | shutdown teardown pattern and source-signal cleanup | orchestrator teardown/reporting/tests | may be same wave after S1/S2 |

- Stop/replan triggers: cleanup requires moving ownership into app-shell or
  priority-one modules; public runtime API consumers outside tests break;
  extracted helper starts becoming a second orchestrator.
- Plan:
  [`docs/archive/plans/2026-04-29-dcr-6-app-orchestrator-api-file-health.md`](./docs/archive/plans/2026-04-29-dcr-6-app-orchestrator-api-file-health.md)
- Last touched: 2026-04-30, implementation commits `aa199687`,
  `7f6097b1`, `2e19f997`, and `8e9f4e81`
- Verification: plan review approved with no material findings. `DCR-6-S1`
  implementation review approved export/API surface and playback snapshot
  ownership with no material findings. `DCR-6-S2` implementation review
  approved the typed coordinator assembly construction seam with no material
  findings. `DCR-6-S3` implementation review found one missing
  shutdown-order/aggregate-report test, commit `8e9f4e81` fixed it,
  same-reviewer closure approved the fix, and a fresh final implementation
  review approved the package. Targeted playback snapshot tests passed;
  targeted coordinator assembly tests passed; targeted shutdown/recoverable
  runtime tests passed; source audits passed for public orchestrator barrel
  consumers, non-null assertion containment, and shutdown/source-signal
  comments; `npm run verify` passed after each implementation unit and after
  the S3 review fix.
- Follow-ups: none. The public `src/Orchestrator.ts` barrel remains limited to
  `AppOrchestrator`, `AppOrchestratorRuntime`, `ModuleStatus`, and
  `PlaybackInfoSnapshot` for app/test import stability. Playback snapshot
  projection is owned by `OrchestratorPlaybackInfoSnapshot`, coordinator
  assembly required-module validation is owned by the typed assembly seam, and
  shutdown failure collection is owned by `OrchestratorShutdownTeardown`.
  Broad `AppOrchestrator`, app-shell, priority-one, Plex/player, UI, module
  factory, `DCR-7`, and `DCR-EXIT` cleanup remain out of scope.
- Handoff: `DCR-6` is complete. Do not reopen AppOrchestrator API/file-health
  cleanup unless source proof shows the public barrel widened beyond the
  recorded policy, playback snapshot projection regressed inline, coordinator
  assembly reintroduced scattered non-null assertions, or shutdown teardown
  loses the verified order/failure-continuation/aggregate-report behavior.
  DCR-7 is the next unchecked DCR package only when the maintainer starts the
  next cleanup loop.

### [x] `DCR-7` Channel Setup Facet Loader/Executor Confidence And Abstraction

- Status: completed
- Dimensions/rubric tags: test health, duplication, abstraction fitness,
  contract coherence, logic clarity, file health
- Scope owner: core channel setup planning owner
- Why this package exists / production risk: facet loading/execution controls
  setup plan quality and user feedback. Missing cache/concurrency/progress tests
  plus duplicated fixtures and wide options ports make future changes risky.
- Files in scope:
  - `src/core/channel-setup/planning/ChannelSetupFacetSnapshotLoader.ts`
  - `src/core/channel-setup/planning/ChannelSetupFacetLibraryExecutor.ts`
  - `src/core/channel-setup/planning/ChannelSetupFacetSnapshotLoadSession.ts`
  - `src/core/channel-setup/planning/ChannelSetupFacetCountRecoveryWorker.ts`
  - `src/core/channel-setup/planning/ChannelSetupPlanningTypes.ts`
  - `src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoader.test.ts`
  - `src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoadSession.test.ts`
  - `src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts`
  - shared test utilities under `src/core/channel-setup/__tests__/`
- Files out of scope:
  - UI selected-server persistence/runtime contract owned by `DCR-2`
  - broad Plex library parser/request policy
  - setup build/commit persistence unless tests prove direct dependency
- Known issues to retire:
  - actual issues:
    - `DCR-7-A1`: missing cache hit, invalidation, cacheability, progress
      replay, and concurrent waiter tests for facet loader/executor behavior.
    - `DCR-7-A2`: duplicated facet planning test fixtures should be reduced
      before adding more cases.
    - `DCR-7-A3`: executor options port is wide; narrow or justify the contract
      after source review.
  - owner decisions:
    - `DCR-7-D1`: decide exact cacheability/progress replay/concurrent waiter
      contract to protect before writing tests.
  - accepted residuals:
    - none yet; do not accept fixture duplication merely to avoid touching test
      helpers.
- Completion means: missing behavior tests are added or source-disproved;
  fixture duplication is reduced or assigned one owner/revisit trigger; executor
  options contract is narrowed or explicitly justified. Package cannot close by
  adding one cache test while leaving the rest open.
- Verification routing: targeted channel setup planning/facet tests, source
  audit for duplicated fixtures and executor option consumers, then
  `npm run verify`.
- Ready-now execution unit: completed.
- Suggested slice table / wave candidates:

  | Slice | Candidate goal | Write scope | Parallel policy |
  | --- | --- | --- | --- |
  | `DCR-7-S1` | fixture/test utility consolidation | channel setup test helpers/tests | serial first |
  | `DCR-7-S2` | loader cache/progress/concurrency contract tests | loader/session tests | serial after S1 |
  | `DCR-7-S3` | executor options port cleanup/justification | executor/types/tests | may run after S1 if disjoint from S2 |

- Stop/replan triggers: cache semantics conflict with DCR-2 failure semantics;
  tests reveal production behavior bug outside planning owner; port narrowing
  requires Plex library contract changes.
- Plan:
  [`docs/archive/plans/2026-04-29-dcr-7-channel-setup-facet-loader-executor.md`](./docs/archive/plans/2026-04-29-dcr-7-channel-setup-facet-loader-executor.md)
- Last touched: 2026-04-30, implementation commits `0139258e`,
  `df37bc3b`, `cb0f0691`, and `a267d680`
- Verification: plan review approved with no material findings. `DCR-7-S1`
  implementation review approved the facet-planning test helper consolidation
  with no material findings, and the targeted loader/session/planning service
  tests passed. `DCR-7-S2` implementation review found two missing direct
  loader-contract assertions for stale invalidated progress and attached source
  cancellation with multiple waiters; commit `cb0f0691` fixed both, the
  same-reviewer closure check approved the fix, and a fresh final
  implementation review approved the loader cache/progress/concurrency
  contract tests. `DCR-7-S3` implementation review approved the executor
  options narrowing with no material findings. Targeted S3 session/planning
  service tests passed and `npm run typecheck` passed.
- Follow-ups: none. Fixture duplication was reduced into the focused
  `ChannelSetupFacetPlanningTestHelpers` test helper; the loader cache,
  invalidation, cacheability, progress replay, concurrent waiter, waiter
  abort/detach, and in-flight failure/cancellation contract is covered by
  direct loader tests; and the executor options port now groups native failure
  builders under an explicit `failures` option while keeping control/state
  callbacks visible and typed.
- Handoff: `DCR-7` is complete. Do not reopen Channel Setup facet
  loader/executor cleanup unless source proof shows the helper has become a
  broad test dumping ground, DCR-7-D1 loader contract coverage has regressed,
  DCR-2 facet failure semantics changed, or executor option ownership again
  hides required state/control callbacks.

### [x] `DCR-8` Plex Stream Resolver Ownership Cleanup

- Status: completed
- Dimensions/rubric tags: cross-module architecture, abstraction fitness,
  security, contract coherence, error consistency, test strategy
- Scope owner: Plex stream/subtitle policy owner
- Why this package exists / production risk: stream resolution is a production
  playback boundary. Resolver orchestration, debug subtitle probing, universal
  transcode decision fetch/parse, and direct settings/debug store construction
  are mixed enough to make playback behavior and token safety harder to audit.
- Files in scope:
  - `src/modules/plex/stream/PlexStreamResolver.ts`
  - `src/modules/plex/stream/interfaces.ts`
  - `src/modules/plex/stream/resolveStreamPipeline.ts`
  - `src/modules/plex/stream/SubtitleStreamProbe.ts`
  - `src/modules/plex/stream/SubtitleStreamProbeSupport.ts`
  - `src/modules/plex/stream/plexStreamUrlPolicy.ts`
  - `src/modules/plex/stream/__tests__/*`
  - `src/modules/settings/*Store.ts` only as constructor-injected dependencies
    if needed
  - `src/modules/debug/*Store.ts` only as constructor-injected dependencies if
    needed
- Files out of scope:
  - Plex auth/discovery/library parser redesign
  - token redaction behavior except preserving/strengthening existing coverage
  - player UI or native media policy outside stream resolver contracts
- Known issues to retire:
  - actual issues:
    - `DCR-8-A1`: `PlexStreamResolver` mixes main stream resolution with debug
      subtitle probing.
    - `DCR-8-A2`: universal transcode decision fetch/parse is still owned
      inline by resolver rather than a focused collaborator if source review
      confirms the mix.
    - `DCR-8-A3`: resolver directly instantiates settings/debug stores instead
      of receiving typed policy dependencies.
  - owner decisions:
    - `DCR-8-D1`: choose the narrow owner for debug subtitle probing and
      universal decision fetch/parse without creating speculative abstractions.
  - accepted residuals:
    - Plex token redaction/security is currently acceptable and must remain
      protected.
- Completion means: resolver dependency ownership is explicit; debug/probe and
  universal decision responsibilities are extracted or source-justified; token
  redaction coverage remains intact; no closeout if only one helper moves while
  direct store construction remains unaddressed.
- Verification routing: focused Plex stream/subtitle/url-policy tests, source
  audit for token-bearing logs and direct store construction, then
  `npm run verify`; update `docs/api/plex-integration.md` only if public stream
  contract changes.
- Ready-now execution unit: completed.
- Suggested slice table / wave candidates:

  | Slice | Candidate goal | Write scope | Parallel policy |
  | --- | --- | --- | --- |
  | `DCR-8-S1` | dependency injection for settings/debug policy | resolver/interfaces/tests | serial |
  | `DCR-8-S2` | debug subtitle probing ownership | subtitle probe/support/tests | serial with S1 if constructor changes |
  | `DCR-8-S3` | universal decision fetch/parse ownership | resolver/pipeline/url policy/tests | serial unless plan proves disjoint |

- Stop/replan triggers: extraction changes playback URL/security contract;
  token redaction behavior regresses; solution requires auth/discovery/library
  ownership changes; tests require real device/manual proof beyond approved
  package.
- Plan:
  [`docs/archive/plans/2026-04-30-dcr-8-plex-stream-resolver-ownership-cleanup.md`](./docs/archive/plans/2026-04-30-dcr-8-plex-stream-resolver-ownership-cleanup.md)
- Last touched: 2026-04-30, implementation commits `1cb3bb7f`,
  `cbfb833f`, and `7f616597`
- Verification: plan review initially found material logger-seam and
  `DCR-8-D1` coverage-accounting blockers; the planner revised the active
  plan, same-reviewer closure approved the fixes, and a fresh final plan
  reviewer approved `DCR-8-S1`. `DCR-8-S1` implementation review approved the
  typed policy-reader and subtitle-debug logging-port injection with no
  material findings; targeted resolver/orchestrator wiring tests and
  `npm run typecheck` passed. `DCR-8-S2` implementation review approved the
  stream-local subtitle debug probe coordinator with no material findings;
  targeted resolver/probe tests passed and source audit confirmed no remaining
  inline probe candidate selection or scheduling in `PlexStreamResolver`.
  `DCR-8-S3` implementation review approved the universal transcode decision
  client extraction with no material findings; targeted resolver/debug-manager
  tests, `npm run typecheck`, and `npm run verify` passed. Closeout source
  audits confirmed no direct settings/debug store or logger construction in
  `PlexStreamResolver`, debug subtitle probing and universal decision
  fetch/parse now have focused stream-local owners, public
  `IPlexStreamResolver` methods and stream decision shapes remain unchanged,
  and no raw token/auth URL/header/subtitle-key logging was introduced.
- Follow-ups: none. `PlexStreamResolver` now receives typed audio, playback,
  debug, subtitle-debug, and debug-override policy readers plus a
  subtitle-debug logging port; `SubtitleStreamDebugProbeCoordinator` owns debug
  subtitle discovery/probe selection and scheduling; and
  `UniversalTranscodeDecisionClient` owns universal transcode decision
  fetch/parse. Plex token redaction/security remains an accepted protected
  baseline, not an open DCR-8 residual.
- Handoff: `DCR-8` is complete. Do not reopen Plex stream resolver ownership
  cleanup unless source proof shows resolver direct store/logger construction
  has returned, debug subtitle probing or universal decision fetch/parse has
  moved back inline, public stream resolver contracts changed without matching
  tests/docs, or token redaction coverage regressed.

### [ ] `DCR-9` Lifecycle Migration And Comment/API Cleanup

- Status: not started
- Dimensions/rubric tags: AI-generated residue, incomplete migration, API
  surface coherence, initialization coupling, contract coherence
- Scope owner: lifecycle module owner
- Why this package exists / production risk: lifecycle state is a portability
  and startup boundary. Restating comments and an empty exported migration seam
  make it unclear which contracts are intentional versus speculative.
- Files in scope:
  - `src/modules/lifecycle/AppLifecycle.ts`
  - `src/modules/lifecycle/constants.ts`
  - `src/modules/lifecycle/interfaces.ts`
  - `src/modules/lifecycle/StateManager.ts`
  - `src/modules/lifecycle/__tests__/AppLifecycle.test.ts`
  - `src/modules/lifecycle/__tests__/StateManager.test.ts`
- Files out of scope:
  - broad storage helper redesign
  - app-shell startup sequencing unless lifecycle API change requires docs
  - future Windows/Electron port implementation
- Known issues to retire:
  - actual issues:
    - `DCR-9-A1`: lifecycle/AppLifecycle/constants have restating comments that
      should be removed or compressed while preserving invariant/platform notes.
  - owner decisions:
    - `DCR-9-D1`: decide whether empty exported `MIGRATIONS` is an intentional
      versioning seam or speculative API. Keep, remove, or document it with
      tests/source references.
  - accepted residuals:
    - none yet; future-port lifecycle work belongs to port owner, not this
      package, unless source proof shows cleanup is required now.
- Completion means: restating lifecycle comments are cleaned; `MIGRATIONS`
  status is decided and protected/documented; package cannot close on comment
  cleanup alone while the exported empty API remains undecided.
- Verification routing: targeted lifecycle tests if API changes,
  behavior-neutral diff/source audit for comment cleanup, then `npm run verify`;
  `npm run verify:docs` if architecture/current-state docs change.
- Ready-now execution unit: none until plan is written.
- Suggested slice table / wave candidates:

  | Slice | Candidate goal | Write scope | Parallel policy |
  | --- | --- | --- | --- |
  | `DCR-9-S1` | `MIGRATIONS` keep/remove/document decision | lifecycle constants/interfaces/tests | serial |
  | `DCR-9-S2` | lifecycle comment/source-signal cleanup | lifecycle source/tests as needed | serial after S1 |

- Stop/replan triggers: migration decision changes persisted lifecycle payload
  contract; cleanup requires app-shell startup changes; storage compatibility
  policy becomes unclear.
- Plan: none yet
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: start with DCR-9 plan that resolves the migration seam before
  editing exported lifecycle constants.

### [ ] `DCR-10` Oversized Test Suite Structure Policy

- Status: not started
- Dimensions/rubric tags: test health, file health, duplication, maintainability,
  source organization
- Scope owner: test-suite structure owner for affected packages
- Why this package exists / production risk: `ChannelManager.test.ts` and
  `SettingsScreen.test.ts` are catch-all files. Adding DCR coverage directly to
  them without a split policy will keep concentrating test maintenance risk.
- Files in scope:
  - `src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts`
  - new/split channel-manager test files under the same `__tests__` directory
  - `src/modules/ui/settings/__tests__/SettingsScreen.test.ts`
  - new/split settings screen test files under the same `__tests__` directory
  - local package test utilities needed by the splits
- Files out of scope:
  - Settings focus extraction behavior already closed
  - production source changes except import/export adjustments required by
    test-only fixture splits
  - broad repo-wide test harness rewrite
- Known issues to retire:
  - actual issues:
    - `DCR-10-A1`: `ChannelManager.test.ts` should not absorb new
      transactional/reorder/error coverage without a split policy.
    - `DCR-10-A2`: `SettingsScreen.test.ts` should not absorb new constructor
      dependency coverage without a split policy.
    - `DCR-10-A3`: `SettingsScreen` has an eight-positional-param constructor
      and tests use `undefined` placeholders; resolve with a deps object and
      targeted tests, or record a maintainer-approved migration out of DCR with
      destination, owner, revisit trigger, and non-blocker rationale.
  - owner decisions:
    - `DCR-10-D1`: decide whether the constructor cleanup is implemented in this
      package or split into a named package-specific Settings destination. A
      split requires maintainer approval and cannot leave DCR-10 incomplete.
  - accepted residuals:
    - no broad Settings redesign; existing focus extraction remains closed.
- Completion means: affected packages have a clear split policy or completed
  split before new DCR coverage is added; Settings constructor cleanup is
  implemented with deps-object tests or migrated out under the DCR migration
  rule; package cannot close with only a note saying tests are large.
- Verification routing: targeted split test files plus affected package tests,
  `npm test`/`npm run verify` depending on whether production constructor/API
  changes are included.
- Ready-now execution unit: none until plan is written.
- Suggested slice table / wave candidates:

  | Slice | Candidate goal | Write scope | Parallel policy |
  | --- | --- | --- | --- |
  | `DCR-10-S1` | ChannelManager test split policy before DCR-1 coverage | channel-manager tests/helpers | can precede DCR-1 |
  | `DCR-10-S2` | SettingsScreen constructor/test split decision | settings tests and constructor if approved | separate from S1 |

- Stop/replan triggers: constructor cleanup changes public Settings screen
  construction in app-shell; test split requires production extraction; another
  reviewed package already completed the DCR-10 split/constructor obligations
  and updates this record before `DCR-EXIT`.
- Plan: none yet
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: DCR-10 is mandatory before `DCR-EXIT`. It may be planned before
  DCR-1 or Settings-adjacent work when oversized tests would block adding
  coverage; otherwise the first package that needs those tests must coordinate
  with DCR-10 instead of absorbing new cases into catch-all files.

### [ ] `DCR-EXIT` Dimension Cleanup Exit Gate

- Status: not started
- Dimensions/rubric tags: final reconciliation, source-backed proof, test
  confidence, portability residuals, docs/control-plane coherence
- Scope owner: cleanup controller/final reconciliation owner
- Why this package exists / production risk: the user wants cleanup to be done
  after these known high-confidence issues are handled, before any fresh
  scoring-only run. The exit gate prevents another narrow pass by requiring
  source-backed reconciliation across every DCR package.
- Files in scope:
  - `ARCHITECTURE_CLEANUP_CHECKLIST.md`
  - DCR package plans/audits if created under `docs/plans/`
  - `docs/architecture/CURRENT_STATE.md`
  - architecture/API/design docs touched by DCR packages
  - source/test files only for read-only reconciliation unless a final package
    explicitly reopens implementation
- Files out of scope:
  - fresh Desloppify scan/queue import as task intake
  - optional external score refresh until after DCR exit is complete
  - future Windows/Electron port implementation
- Known issues to retire:
  - actual issues:
    - `DCR-EXIT-A1`: reconcile every DCR package and prove all actual issues
      are fixed, source-disproved, or explicitly reclassified with evidence.
    - `DCR-EXIT-A2`: confirm all owner decisions have one recorded outcome,
      owner, and revisit trigger if accepted.
    - `DCR-EXIT-A3`: verify current architecture/API docs still match source
      after DCR changes.
  - owner decisions:
    - `DCR-EXIT-D1`: decide whether to run the optional external score refresh
      after exit. It may inform retrospective notes but must not reopen the
      checklist by itself.
  - accepted residuals:
    - `FCP-6` future-port residual remains explicit: real Windows/Electron
      shell, real device Plex, native media, and manual integration proof belong
      to the future-port owner and are not DCR source cleanup blockers.
- Completion means: all `DCR-1` through `DCR-10` packages are completed. Any
  unresolved work must already be handled inside a completed package as an
  individual issue/residual disposition or as a maintainer-approved migration
  out of DCR with named destination, owner, revisit trigger, and non-blocker
  rationale. Source-backed final reconciliation finds no unowned same-area
  residue; docs/current-state are accurate; required verification and clean
  closeout review are recorded.
- Verification routing: source-backed DCR reconciliation audit, package-local
  static/source audits for old patterns, strongest relevant package
  verification already run, final `npm run verify`, and `npm run verify:docs`.
  Optional external score refresh only after this gate is completed.
- Ready-now execution unit: none until all DCR packages are complete.
- Suggested slice table / wave candidates:

  | Slice | Candidate goal | Write scope | Parallel policy |
  | --- | --- | --- | --- |
  | `DCR-EXIT-S1` | package proof matrix reconciliation | checklist/plans/docs read/write | serial |
  | `DCR-EXIT-S2` | architecture/API/current-state doc reconciliation | docs + source audit | serial after S1 |
  | `DCR-EXIT-S3` | optional external score refresh decision/result | retrospective artifact only | after exit criteria pass |

- Stop/replan triggers: any DCR package has open actual issues; source audit
  finds new same-area production residue not owned by a package; docs conflict
  with source; optional score output is treated as task intake.
- Plan: none yet
- Last touched: not started
- Verification: not run
- Follow-ups: future-port residuals owned by port/test owner as above; no other
  follow-ups yet
- Handoff: do not run a fresh scoring-only pass before this exit gate completes.
  Start `DCR-1` or another maintainer-selected DCR package first.

## FCP Baseline History

The six `FCP-*` priorities below produced real improvements and are preserved
as baseline evidence. They were too conservative and narrow for the intended
production cleanup finish. Do not choose `FCP-*` or `FCP-EXIT` as the next active
cleanup-loop package unless a maintainer explicitly reopens that history; use
the `DCR-*` packages above instead.

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
- Plan: archived in git history; baseline summary retained here.
- Audit: archived in git history; source-finding proof matrix retained here.
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
  recheck this baseline if setup record hydration/normalization ownership
  changes, and include it in the final DCR reconciliation pass after the cleanup
  checklist completes. `FCP-1-SF4` resolved by commits `f2b33f28` and
  `05b6cf8`: `AppOrchestrator` now keeps only priority-one guards, required
  module validation, grouped call to `createPriorityOneRuntimeAssembly()`, and
  assignment of returned controllers/binder; `PriorityOneAssemblyBuilder.ts`
  owns mapping grouped runtime refs/callbacks into `PriorityOneAssemblyInput`
  plus controller/binder creation. Adjacent SF4 audit areas for module factory,
  coordinator assembly, runtime-controller builder, and initialization
  coordinator are accepted/no-action because current source still has focused
  owners and SF4 implementation did not need to edit them.
- Handoff: Completed FCP-1 plans and master audit are archived in git history.
  The retained baseline summary above is the active reference. Plan reviews
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
- Plan: archived in git history; baseline summary retained here.
- Audit: archived in git history; source-finding proof matrix retained here.
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
  errors. Accepted/no-action areas remain owned by Plex auth,
  Plex discovery, Plex library, Plex stream, storage owners, lifecycle/startup,
  channel tuning, and player/playback owners. No deferred `FCP-2` source
  findings are admitted. Revisit trigger: `DCR-EXIT` must recheck this FCP-2
  baseline against implemented source/docs changes as retained evidence.
- Handoff: Fresh FCP-2 closeout review found no material findings and approved
  completion after accepting the proof matrix, accepted/no-action owner record,
  verification evidence, and mini-record update. Historical next priority was
  `FCP-3`; active follow-up now routes through the DCR packages above.

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
- Plan: archived in git history; baseline summary retained here.
- Audit: archived in git history; source-finding proof matrix retained here.
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
  remain owned by EPG component/view owners, Plex stream resolver
  owner, scheduler/channel-manager owner, channel setup UI/screen owner, and
  core orchestrator/priority-one assembly owners, each with revisit triggers.
  Security triage: `no open P0 security findings`; `DCR-EXIT` must recheck this
  FCP-3 baseline against implemented source/docs changes as retained
  evidence.
- Handoff: Fresh FCP-3 implementation review found no findings and approved
  `FCP-3-S1` for controller closeout. Fresh FCP-3 priority-exit closeout review
  found no findings and approved completion after accepting the proof matrix,
  accepted/no-action and deferred-outside-selected-package owner records,
  security triage, verification evidence, and mini-record update. Historical
  next priority was `FCP-4`; active follow-up now routes through the DCR
  packages above.

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
- Plan: archived in git history; baseline summary retained here.
- Audit: archived in git history; source-finding proof matrix retained here.
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
  remain recorded here: `ScheduleConfig.loopSchedule` belongs to the scheduler
  API owner; Plex library interface docs belong to the Plex library contract
  owner; webOS/media-session/fail-open comments belong to player, Plex shared
  transport, and platform owners; brand glyph SVG comments belong to the UI
  common brand asset owner; production barrel comments belong to module package
  owners; test comment bloat belongs to relevant test owners. Security triage:
  `no open P0 security findings`.
- Handoff: FCP-4 is completed with source audit, execution plan, proof matrix,
  verification evidence, security triage/P0 disposition, implementation review,
  closeout review, final docs verification, and owned residuals recorded.
  Historical next priority was `FCP-5`; active follow-up now routes through the
  DCR packages above.

### [x] `FCP-5` Portability Readiness

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
- Status: completed
- Plan: archived in git history; baseline summary retained here.
- Audit: archived in git history; source-finding proof matrix retained here.
- Last touched: 2026-04-29
- Verification: plan-review approved `FCP-5-S1` with no material findings.
  Implementation commit `2f54311e` passed focused `StateManager` tests (24
  tests), `npm run typecheck`, `npm run verify`, `npm run verify:docs` before
  implementation and again inside full verify, raw-storage source audit (only
  `src/utils/storage.ts` production hits remain), and `git diff --check`.
  Fresh implementation review found no material findings and approved
  `FCP-5-S1` for closeout. Fresh priority-exit closeout review found no
  blocking findings and approved completion after accepting the source audit,
  proof matrix, verification evidence, security triage, and deferred/no-action
  owner records. Final post-completion `npm run verify:docs` passed before the
  closeout documentation commit.
- Follow-ups: proof matrix: `FCP-5-SF1` resolved by commit `2f54311e`
  (`StateManager` now routes lifecycle state reads/writes/cleanup through safe
  optional-storage helpers, keeps synchronous `save/load/clear`, preserves
  quota cleanup-and-retry behavior, and tests blocked/unavailable storage).
  Deferred/no-action final owners and revisit triggers are retained here for
  `FCP-5-SF2` through `FCP-5-SF7`: platform owner for webOS default runtime,
  navigation/exit UI owner for root `window.close()`, Plex/player transport
  owners for browser fetch/XHR contracts, player/Plex stream owners for native
  media policy, app/runtime owner for filesystem absence, and Plex/security
  owners for token/security revisit triggers. Security triage: `no open P0
  security findings`.
- Handoff: FCP-5 is completed after source audit, execution plan, proof matrix,
  verification evidence, security triage/P0 disposition, implementation review,
  and clean priority-exit closeout review. Historical next priority was
  `FCP-6`; active follow-up now routes through the DCR packages above.

### [x] `FCP-6` Test Confidence For The Port

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
- Status: completed
- Plan: archived in git history; baseline summary retained here.
- Audit: archived in git history; source-finding proof matrix retained here.
- Last touched: 2026-04-29
- Verification: plan-review approved `FCP-6-S1` with no material findings.
  Implementation commit `ef09466b` passed focused exit-confirm tests (4 tests),
  `npm run typecheck`, `npm run verify` including coverage/tools/contracts/docs
  verification/build, `npm run verify:docs` inside full verify, and
  `git diff --check`. Fresh implementation review found no material findings
  and approved `FCP-6-S1` for closeout. Fresh FCP-6 priority-exit closeout
  review found no material findings and approved completion.
- Follow-ups: proof matrix: `FCP-6-SF2` resolved by commit `ef09466b`
  (`ExitConfirmCoordinator` tests now cover modal render/accessibility state,
  focusable registration, Cancel close, Exit-to-Home via `window.close()`,
  close/unregister cleanup, and destroy DOM cleanup). `FCP-6-SF1` and
  `FCP-6-SF3` through `FCP-6-SF10` remain existing-coverage/no-action with
  baseline ownership archived in git history. `FCP-6-SF11` remains deferred
  to the future-port test owner for real Windows/Electron shell, device Plex,
  native media, and manual integration proof. Security triage: no P0 security
  finding admitted.
- Handoff: FCP-6 is completed after source-backed test-confidence audit,
  execution plan, proof matrix, verification evidence, security triage/P0
  disposition, clean implementation review, clean priority-exit closeout
  review, and owned residuals recorded.
  Historical next step was `FCP-EXIT`, but that is superseded by the active
  `DCR-*` refresh. Do not start `FCP-EXIT` unless a maintainer explicitly
  reopens the FCP baseline; use `DCR-1` or another selected DCR package.

### [ ] `FCP-EXIT` Superseded FCP Exit Anchor

- Close only if: every `FCP-*` priority is completed or explicitly deferred with
  one final owner, all priority closeout reviews are clean, current architecture
  truth is still accurate, and the strongest applicable verification has passed.
- Required evidence:
  - source-backed audit package or explicit no-action rationale for every
    priority
  - package proof matrices with every source finding disposed
  - final reconciliation pass over archived FCP audit artifacts, implemented
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
- Handoff: retained as a historical anchor only. Do not declare final production
  cleanup complete or run an external score refresh until `DCR-EXIT` completes
  after all active DCR packages are reconciled.

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
active `DCR-*` packages while DCR is open, or through a maintainer-approved
source-backed package after `DCR-EXIT` closes with a named owner seam, proof
surface, and reviewed plan.
