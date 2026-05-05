# Architecture Cleanup Checklist

> Live cleanup control plane.

This checklist is the compact control plane for production cleanup. It replaces
the old score-chasing P14 wave loop as the active execution surface. Completed
P0-P13, superseded P14 wave details, and completed FCP packages remain
historical context in package maps, plans, commits, and archived summaries; they
should not drive the next cleanup task by default.

## Fresh-Session Handoff

- Current execution state: P0-P13, FCP-1 through FCP-12, DCR-1 through DCR-16,
  and DCR-EXIT are complete baseline evidence. The old P14 wave ledger is
  superseded for current decision-making because repeated residual waves did
  not create meaningful score progress and kept expanding the active control
  plane. Fresh post-FCP verification and the retrospective subjective review
  are rubric context only, not active package intake or closeout proof.
- Next safe start: `FCP-13` is the first additional pre-Windows-port cleanup
  package. `FCP-14` through `FCP-20`, `FCP-EXIT`, Windows port work, or other
  post-FCP cleanup may start only after the preceding FCP package has clean
  closeout evidence.
- Preferred launcher: `cleanup-loop` for approved checklist-linked Tier 3
  cleanup packages.
- Active program: `Final Cleanup Pass` (`FCP-13` through `FCP-20`) below. The
  completed `FCP-7` through `FCP-12`, DCR, and historical FCP records are
  retained baseline evidence, not the next task queue.
- Desloppify role: rubric input and optional end-of-program external score
  refresh only. The active FCP packages below were admitted by maintainer
  judgment from current-source review themes; do not use fresh Desloppify
  output as concrete issue intake, task admission, execution-unit membership,
  proof of closure, or wave sequencing.

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
- Start each active cleanup package with package-local source-backed discovery over
  the listed files/seams plus targeted adjacent searches required by its
  stop/replan triggers. Reserve repo-wide audit for an exit package or for a
  package whose listed scope explicitly requires repo-wide coverage.
- Use rubric dimensions as audit prompts, not as source truth.
- Freeze one execution-grade plan per priority or per approved package inside a
  priority. Keep small plans local by default; promote to `docs/plans/*` only
  when durable tracked handoff memory is needed.
- Active cleanup-loop packages are durable Tier 3 handoff work by
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
- For active packages, do not check a package complete unless every listed
  `actual issue` is fixed or reclassified with source-backed evidence, every
  `owner decision` is resolved or explicitly accepted with one owner and revisit
  trigger, every accepted residual is recorded with rationale, and the
  package-level completion criteria are satisfied.
- Active cleanup-loop planning must plan coherent execution units or waves when
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

For FCP packages, each priority audit must produce a short source-backed package
brief before implementation begins:

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

For completed DCR checklist-linked plans, package coverage was defined by the
listed `DCR-*-A*` actual issues and `DCR-*-D*` owner decisions, plus absorbed
residue that met the approved execution-unit absorption rules. Do not invent
FCP-style `source_finding_id` coverage for DCR unless a maintainer explicitly
reopens a DCR package and changes this control-plane contract.

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
  commands, issue-id reruns, or package-map reconciliation. The active FCP
  packages still require source audits, proof matrices, targeted verification,
  and clean closeout review before the next FCP package begins.

## Final Cleanup Pass

The `FCP-7` through `FCP-12` packages were the first final cleanup surface before
Windows port work and are now completed baseline evidence. Fresh post-FCP
verification and the retrospective subjective review are rubric context only;
they are not issue intake, package membership, proof of closure, or wave
sequencing. The additional packages below were admitted as maintainer-approved
source-audit themes and use only local `source_finding_id` coverage.

The additional pre-Windows-port pass starts at `FCP-13`. It replaces no
completed evidence; it adds a bounded queue for source-signal closure,
shared-core owner cleanup, behavior-neutral package organization, and final
reconciliation. The goal is not score chasing;
it is to retire remaining maintainability risks that would make future platform
work harder to reason about.

Completed baseline summary:

| Package | Completed owner surface | Baseline role |
| --- | --- | --- |
| `FCP-7` | Boundary and type hygiene | Historical evidence only |
| `FCP-8` | API, Plex, and error contracts | Historical evidence only |
| `FCP-9` | Source signal, convention, and local elegance | Historical evidence only |
| `FCP-10` | EPG renderer tests and presentation decomposition | Historical evidence only |
| `FCP-11` | Runtime owner reduction hotspots | Historical evidence only |
| `FCP-12` | App-shell/orchestrator package organization and first-pass reconciliation | Historical evidence only |

The detailed completed bodies for `FCP-7` through `FCP-12` remain below for
audit trail and closeout evidence. They are not active work queues unless a
future source-backed replan explicitly reopens one.

### FCP Operating Rules

- Treat each unchecked `FCP-*` row below as one checklist-linked package for
  `cleanup-loop`.
- Use `source_finding_id` coverage in FCP plans. For example, `FCP-7-SF1` is a
  valid source-backed finding id for `FCP-7`.
- Do not copy external review ids, detector ids, package-map ids, score deltas,
  or raw tool output into FCP package membership, proof, or closeout.
- A package plan may source-audit and reclassify listed findings, but it may not
  close by fixing only one symptom while same-package findings remain unowned.
- Prefer behavior-preserving extraction, type/API contract cleanup, and direct
  tests over broad rewrites. If a listed large refactor becomes speculative
  after source review, reclassify it with one final owner and revisit trigger
  rather than forcing churn.
- Hotspot packages must close the original source concern, not just reduce line
  count or extract one helper. Before closeout, the package audit must state
  whether the original mixed-responsibility finding still describes current
  source. If yes, continue the package or record an accepted owner/revisit
  trigger; if no, close with source proof.
- Broad refactors are allowed when they stay inside one owner boundary and have
  a stable proof surface. Broad changes that cross UI, persistence, Plex,
  scheduler, navigation, and platform policy at the same time must split into
  separate packages or stop for maintainer reapproval.
- Run `npm run verify` for runtime/UI/Plex/navigation/orchestrator changes and
  `npm run verify:docs` for checklist/workflow/reference-doc changes.
- Additional pre-Windows-port broad-refactor stop conditions:
  - no cross-platform feature behavior changes without a replan
  - no persistence schema changes without a replan
  - no public API widening without matching docs/tests and maintainer approval
  - no folder reorganization compatibility shims or root/package barrels unless
    explicitly approved by the maintainer
  - no active package may absorb another package's source finding unless the
    same owner seam, verification envelope, and closeout owner still apply

### [x] `FCP-7` Boundary And Type Hygiene

- Status: completed
- Plan: `docs/plans/2026-05-02-fcp-7-boundary-type-hygiene-plan.md`
- Dimensions/rubric tags: cross-module architecture, type safety, dependency
  health, contract coherence, convention drift
- Scope owner: boundary/type contract owner across server-select, navigation,
  debug, channel setup, and shared events
- Why this package exists / production risk: recent cleanup left several small
  but real boundary leaks and type drift hazards. These are cheap to fix now and
  expensive to debug during platform work because they normalize circular source
  dependencies, stale architecture exceptions, and duplicated runtime values.
- Files in scope:
  - `src/modules/ui/server-select/*`
  - `tools/architecture-rules/lineupArchitectureRules.mjs`
  - architecture-rule tests under `tools/__tests__/`
  - `src/modules/debug/NowPlayingDebugManager.ts`
  - `src/core/orchestrator/OrchestratorCoordinatorBuilders.ts`
  - `src/modules/ui/now-playing-info/interfaces.ts` only for read-only adapter
    proof unless a public contract change is approved
  - `src/core/channel-setup/config/*`
  - `src/core/channel-setup/build/ChannelSetupBuildExecutor.ts`
  - `src/core/channel-setup/planning/*`
  - `src/core/channel-setup/workflow/ChannelSetupWorkflowPort.ts`
  - `src/modules/ui/channel-setup/ChannelSetupSessionRuntime.ts`
  - `src/modules/navigation/NavigationFeaturePorts.ts`
  - `src/types/channelSwitch.ts`
  - `src/utils/EventEmitter.ts`, `src/utils/interfaces.ts`, and event-map
    owner files/tests if the event-map tightening slice is accepted
- Files out of scope:
  - server-select discovery/autoconnect/focus state-machine extraction
  - broad NavigationCoordinator rewrite
  - channel setup wizard rendering cleanup
  - debug modal redesign
- Source findings to retire:
  - `FCP-7-SF1`: `ServerSelectListView` and `ServerSelectScreen` form a source
    cycle through shared state types. Move shared server-select display/state
    shapes into a sibling owner module or narrow the list-view input contract.
  - `FCP-7-SF2`: architecture lint still carries temporary
    `NavigationCoordinator` UI-boundary exceptions after the source import
    violations were removed. Remove stale exceptions and keep the rule active.
  - `FCP-7-SF3`: the debug module imports a UI overlay interface when it only
    needs a minimal debug-owned presence/visibility port adapted at the
    orchestrator boundary.
  - `FCP-7-SF4`: active channel setup planning code still imports setup-config
    normalization through a compatibility re-export. Migrate active callers to
    the canonical config owner and remove the compatibility path if unused.
  - `FCP-7-SF5`: channel setup UI duplicates the workflow-unavailable error
    predicate instead of consuming the canonical boundary helper.
  - `FCP-7-SF6`: navigation duplicates the global channel-switch outcome union.
    Alias or import the shared owner type so runtime values cannot drift.
  - `FCP-7-SF7`: shared event maps require string index signatures, widening
    allowed event names to arbitrary strings. Tighten the emitter contract to
    closed event maps if impact analysis shows the change is bounded.
- Completion means: listed type/boundary findings are fixed or
  source-disproved with one owner; no circular server-select source dependency
  remains; stale architecture exceptions are removed; duplicated literal unions
  and error predicates have one owner; event maps either reject arbitrary event
  names or have a documented accepted owner/revisit trigger.
- Verification routing: targeted source/import audits, architecture-rule tests,
  affected unit tests, `npm run typecheck`, then `npm run verify`.
- Ready-now execution unit: none until plan is written.
- Suggested slice table / wave candidates:

  | Slice | Candidate goal | Write scope | Parallel policy |
  | --- | --- | --- | --- |
  | `FCP-7-S1` | server-select type cycle and stale architecture exceptions | server-select types, architecture rules/tests | serial first |
  | `FCP-7-S2` | debug-owned now-playing port and channel setup canonical imports/predicate | debug/orchestrator/channel-setup files/tests | may run after S1 if disjoint |
  | `FCP-7-S3` | duplicated outcome union and closed event-map typing | shared event/navigation/types/tests | serial; broader type impact |

- Stop/replan triggers: event-map tightening requires broad public API redesign;
  debug fix changes UI behavior; channel setup import migration reopens DCR-2
  failure semantics; architecture-rule changes loosen rather than tighten a
  boundary.
- Last touched: 2026-05-02
- Verification: passed `npm test -- ServerSelectListView ServerSelectScreen`;
  `node --test tools/__tests__/build-eslint-architecture-rules.test.mjs`;
  `npm test -- NowPlayingDebugManager OrchestratorCoordinatorBuilders`;
  `npm test -- ChannelSetupWorkflowPort ChannelSetupSessionRuntime
  ChannelSetupPlanningService normalizeChannelSetupConfig`;
  `npm test -- ChannelSetupBuildExecutor`;
  `npm test -- NavigationCoordinator EventEmitter`;
  affected event-owner tests; `npm run typecheck`; targeted source audits;
  `git diff --check`; and `npm run verify`.
- Follow-ups: none yet
- Handoff: completed by cleanup-loop in commits `611b73e8`, `d51791ef`,
  and `59f35d72`; package closeout verification passed on 2026-05-02.

### [x] `FCP-8` API, Plex, And Error Contract Coherence

- Status: completed
- Plan: `docs/plans/2026-05-02-fcp-8-api-plex-error-contract-coherence-plan.md`
- Dimensions/rubric tags: API surface coherence, contract coherence, error
  consistency, type safety, Plex integration, logic clarity
- Scope owner: Plex/shared transport, scheduler channel contracts, and error
  contract owners
- Why this package exists / production risk: platform work benefits from one
  clear API shape per operation, aligned public interfaces, sanitized error
  cause preservation, and Plex contracts that do not hide duplicated transport
  policy or ambiguous media item names.
- Files in scope:
  - `src/modules/plex/shared/fetchWithTimeout.ts`
  - `src/modules/plex/shared/fetchWithTimeoutCore.ts`
  - `src/modules/plex/library/PlexLibrary.ts`
  - `src/modules/plex/library/types.ts`
  - `src/modules/plex/stream/types.ts`
  - `src/modules/plex/stream/interfaces.ts`
  - `src/modules/plex/auth/PlexAuth.ts`
  - Plex tests under `src/modules/plex/**/__tests__/`
  - `src/modules/scheduler/channel-manager/ChannelManager.ts`
  - `src/modules/scheduler/channel-manager/interfaces.ts`
  - `src/core/channel-setup/shared/formatChannelSetupWarning.ts`
  - `src/modules/scheduler/channel-manager/ChannelImportNormalizer.ts`
- Files out of scope:
  - broad Plex auth/session redesign
  - playback URL/token redaction policy changes except preserving existing
    redaction coverage
  - channel persistence schema changes
- Source findings to retire:
  - `FCP-8-SF1`: Plex timeout helpers expose both object-shaped and positional
    public call shapes for the same operation. Keep one public shape and make
    lower-level core private or shape-aligned.
  - `FCP-8-SF2`: `ChannelManager.createChannel` accepts `initialContent` while
    `IChannelManager` does not expose it. Decide and align the public contract.
  - `FCP-8-SF3`: library and stream packages export different
    `PlexMediaItem` contracts under the same name. Rename or reuse so imports
    cannot silently mean different shapes.
  - `FCP-8-SF4`: Plex auth catch-and-wrap paths drop original failure context.
    Preserve sanitized causes where `PlexApiError` already supports redaction.
  - `FCP-8-SF5`: Plex auth still mixes Home endpoint probing, status
    classification, and profile-switch persistence enough to invite drift.
    Extract only a focused Home endpoint/status helper or client; keep token,
    PIN, credential epoch, profile persistence, and event emission in
    `PlexAuth`.
  - `FCP-8-SF6`: Plex library repeats pagination guards and accumulation logic
    in multiple methods. Extract a private page iterator only if tests can prove
    behavior and error semantics stay unchanged.
  - `FCP-8-SF7`: channel setup warning formatting and channel import
    normalization duplicate the same error-detail formatting adapter. Extract a
    shared local formatter with no new subsystem.
- Completion means: public API shapes are singular and aligned; Plex auth wraps
  preserve sanitized causes; Home fallback extraction preserves existing v1/v2
  fallback, abort, unsupported, PIN, and profile-switch behavior; pagination
  and error-formatting duplication are removed or source-justified.
- Verification routing: focused Plex shared/library/auth/stream tests,
  ChannelManager contract tests, channel setup warning/import tests if touched,
  `npm run typecheck`, then `npm run verify`.
- Ready-now execution unit: none until plan is written.
- Suggested slice table / wave candidates:

  | Slice | Candidate goal | Write scope | Parallel policy |
  | --- | --- | --- | --- |
  | `FCP-8-S1` | shared transport API shape and Plex media item naming | Plex shared/library/stream files/tests | serial first |
  | `FCP-8-S2` | Plex auth cause preservation and bounded Home endpoint helper | `PlexAuth.ts` and auth tests | serial; auth-sensitive |
  | `FCP-8-S3` | ChannelManager create contract and shared error-detail formatter | scheduler/channel setup files/tests | may run apart if no shared tests |
  | `FCP-8-S4` | Plex library pagination helper | `PlexLibrary.ts` and tests | optional wave after S1/S2 |

- Stop/replan triggers: Plex auth extraction changes credential persistence,
  token redaction, PIN validation, or existing fallback tests; `initialContent`
  requires product/API decision outside channel manager; pagination helper
  changes request order or error taxonomy.
- Last touched: 2026-05-02
- Verification: passed `npm test -- fetchWithTimeout`;
  `npm test -- PlexStreamResolver`; `npm test -- PlexLibrary`;
  `npm test -- PlexAuth`; `npm test -- ChannelManager
  ChannelImportNormalizer`; `npm test -- formatChannelSetupWarning`;
  `npm run typecheck`; targeted source audits for timeout helper call shape,
  media-item exports, auth cause redaction, channel create options,
  pagination guards, and formatter ownership; `git diff --check`;
  `npm run verify`; and `npm run verify:docs`.
- Follow-ups: none yet
- Handoff: completed by cleanup-loop in commits `b18d23c9`, `65ba1bf1`,
  `508d52aa`, and `5e548a92`; package closeout verification passed on
  2026-05-02.

### [x] `FCP-9` Source Signal, Convention, And Local Elegance

- Status: completed
- Plan: `docs/plans/2026-05-02-fcp-9-source-signal-convention-local-elegance-plan.md`
- Dimensions/rubric tags: AI-generated debt, convention drift, low-level
  elegance, naming quality, docs/source coherence
- Scope owner: source-signal and convention owner with style, architecture docs,
  and channel setup planning reviewers
- Why this package exists / production risk: small convention violations and
  restating comments make real contracts harder to spot. This package should
  remove low-risk noise without reopening DCR-16 as a broad comment sweep.
- Files in scope:
  - `src/modules/ui/now-playing-info/styles.css` and sibling leaf stylesheets
  - `src/modules/ui/__tests__/runtime-token-style-contracts.test.ts` for
    stylesheet seam policy updates
  - `docs/architecture/CURRENT_STATE.md`
  - `docs/architecture/modules.md`
  - `src/modules/navigation/interfaces.ts`
  - `src/modules/plex/stream/interfaces.ts`
  - `src/modules/plex/library/interfaces.ts`
  - `src/modules/player/AudioTrackManager.ts`
  - `src/modules/ui/epg/view/EPGErrorBoundary.ts`
  - `src/modules/ui/epg/view/EPGVirtualizer.ts`
  - `src/core/channel-setup/planning/ChannelSetupFacetLibraryExecutor.ts`
- Files out of scope:
  - visual redesign
  - public Plex/library API behavior changes
  - broad generated-comment cleanup outside listed files unless the plan proves
    a same-family source-signal issue
- Source findings to retire:
  - `FCP-9-SF1`: `now-playing-info/styles.css` mixes package seam imports with
    leaf component rules. Move local rules into a leaf stylesheet and keep the
    package seam as composition.
  - `FCP-9-SF2`: architecture references disagree about current hotspot
    ownership and public surface reality. Update docs to defer to current
    source-backed hotspot truth.
  - `FCP-9-SF3`: selected interface files contain JSDoc that mostly restates
    signatures. Prune only redundant comments; preserve behavior, null/error
    semantics, Plex quirks, side effects, lifecycle, and public contract notes.
  - `FCP-9-SF4`: selected implementation comments echo the next statement
    instead of explaining a constraint. Delete narrating comments; keep
    platform/performance/failure rationale.
  - `FCP-9-SF5`: native facet definitions repeat nearly identical enabled
    branch blocks. Use a local descriptor table inside the existing executor if
    it improves readability without reopening DCR-7 callback ownership.
- Completion means: stylesheet seam policy is consistent; architecture docs no
  longer name stale hotspots; redundant comments are pruned only where
  behavior-neutral; facet definition repetition is reduced or source-justified.
- Verification routing: style/import source audits, `npm run lint:css` if CSS
  changes, targeted channel setup tests if executor logic moves, `git diff
  --check`, `npm run verify:docs`, and `npm run verify` if executable code
  changes.
- Ready-now execution unit: none; package complete.
- Suggested slice table / wave candidates:

  | Slice | Candidate goal | Write scope | Parallel policy |
  | --- | --- | --- | --- |
  | `FCP-9-S1` | stylesheet seam and architecture-doc truth | styles + architecture docs/tests | may run first |
  | `FCP-9-S2` | narrow comment/source-signal cleanup | listed interfaces/implementation files | behavior-neutral |
  | `FCP-9-S3` | facet descriptor table | facet executor/tests | serial if executable code changes |

- Stop/replan triggers: comment pruning removes semantic API guidance; CSS move
  changes visuals; facet table extraction changes failure/progress semantics or
  DCR-7 callback ownership.
- Last touched: 2026-05-02
- Verification: `npm run plans:check`; `npm run test:contracts -- src/modules/ui/__tests__/runtime-token-style-contracts.test.ts`; `npm run lint:css`; `npm run verify:docs`; `npm run typecheck`; `npm test -- --runInBand src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotLoader.test.ts src/core/channel-setup/__tests__/ChannelSetupFacetCountRecoveryWorker.test.ts src/core/channel-setup/__tests__/ChannelSetupPlanner.test.ts src/core/channel-setup/__tests__/ChannelSetupPlanningService.test.ts src/core/channel-setup/__tests__/ChannelSetupFacetSnapshotFailures.test.ts`; `git diff --check`; final `npm run verify`.
- Follow-ups: none yet
- Handoff: start with source audit and behavior-neutral diff constraints; do not
  broaden into a repo-wide comment sweep.

### [x] `FCP-10` EPG Renderer Direct Confidence And Presentation Decomposition

- Status: completed
- Plan:
  `docs/plans/2026-05-02-fcp-10-epg-renderer-direct-confidence-presentation-decomposition-plan.md`
- Dimensions/rubric tags: design coherence, test strategy, UI/focus behavior,
  mid-level elegance
- Scope owner: EPG view/rendering owner
- Why this package exists / production risk: `EPGCellRenderer` owns complex DOM
  rendering behavior, width-tier policy, text derivation, and focused ticker
  timing with only indirect coverage. This is the best larger UI refactor to
  complete before port work because EPG behavior is TV-critical and likely to
  be revisited during platform adaptation. We want to adapt this into a best practice maintainability architectural pattern that would be found in a production level codebase. We can expand FCP-10-SF1 to include any additional changes that would get us toward this goal.
- Files in scope:
  - `src/modules/ui/epg/view/EPGCellRenderer.ts`
  - `src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts`
  - `src/modules/ui/epg/view/__tests__/index.test.ts`
  - `src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts` only for affected
    integration proof
- Files out of scope:
  - broad EPGComponent or virtualizer ownership changes already handled by
    DCR-14
  - CSS/visual redesign
  - scheduler/channel data model changes
- Source findings to retire:
  - `FCP-10-SF1`: `EPGCellRenderer` combines cell DOM lifecycle, text
    derivation, width-tier presentation policy, and ticker measurement. Keep the
    renderer as the DOM adapter but move pure text-layout and presentation
    decisions into local helpers/presentation models.
  - `FCP-10-SF2`: `EPGCellRenderer` has complex public behavior but lacks direct
    tests. Add focused jsdom tests for width tiers, sliver handling, text
    metrics/shift clamping, focused episode/movie layout, live/progress badge
    behavior, and ticker timing where stable.
- Completion means: direct renderer tests cover the high-risk public behavior;
  pure presentation/text-layout policy is separated enough that the renderer
  applies a model instead of owning every decision inline; existing
  virtualizer-level behavior remains intact.
- Verification routing: focused `EPGCellRenderer` tests, affected
  `EPGVirtualizer` tests, `npm run typecheck`, then `npm run verify`.
- Ready-now execution unit: none; package complete.
- Suggested slice table / wave candidates:

  | Slice | Candidate goal | Write scope | Parallel policy |
  | --- | --- | --- | --- |
  | `FCP-10-S1` | direct renderer tests around current behavior | renderer tests only | serial first |
  | `FCP-10-S2` | pure presentation/text-layout helper extraction | renderer/helpers/tests | serial after S1 |

- Stop/replan triggers: tests require private probing instead of public renderer
  methods; helper extraction changes DOM shape, focus hooks, reduced-motion, or
  ticker behavior; visual changes require maintainer design approval.
- Last touched: 2026-05-02
- Verification: passed `npm run plans:check`; clean plan review; `npm test --
  --runInBand src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts`;
  `npm test -- --runInBand
  src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts`; `npm run typecheck`;
  targeted source audits for private renderer presentation-helper residue and
  renderer/export callers; clean implementation review for `FCP-10-S1` and
  `FCP-10-S2`; `git diff --check`; and final package `npm run verify`.
- Follow-ups: none yet
- Handoff: completed by cleanup-loop in commits `2cc71d56` and `37b0871f`;
  package closeout verification passed on 2026-05-02.

### [x] `FCP-11` Runtime Owner Reduction Hotspots

- Status: completed
- Plan:
  `docs/plans/2026-05-02-fcp-11-runtime-owner-reduction-hotspots-plan.md`
- Dimensions/rubric tags: high-level elegance, design coherence, abstraction
  fitness, file health, structure navigation
- Scope owner: UI/runtime hotspot owners
- Why this package exists / production risk: several remaining classes are
  still broad enough that future work may reintroduce mixed responsibilities,
  and prior narrow cleanups sometimes fixed one symptom while leaving the
  original review sentence source-true. This package is allowed to perform
  broader refactors than the earlier surgical packages, but only inside named
  owner seams with behavior locked by tests and source audits. `ChannelManager`
  and priority-one work in this package is owner-concentration closure, not a
  claim that stale hotspot docs are authoritative or that those files are
  current primary file-size hotspots.
- Files in scope:
  - `src/modules/ui/server-select/ServerSelectScreen.ts`
  - `src/modules/ui/server-select/ServerSelectListView.ts`
  - new server-select package-local runtime/focus/rendering collaborators if
    the plan proves the owner seam
  - `src/modules/ui/server-select/__tests__/*`
  - `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
  - existing and new channel setup package-local rendering, interaction,
    session, and focus collaborators if the plan proves the owner seam
  - channel setup UI package tests/helpers
  - `src/modules/scheduler/channel-manager/ChannelManager.ts`
  - existing and new scheduler/channel-manager package-local authoring,
    import/export, persistence-coordination, cache, and retry collaborators if
    the plan proves the owner seam
  - channel-manager tests/helpers
  - `src/core/orchestrator/priority-one/*`
  - `src/core/orchestrator/OrchestratorRuntimeSeams.ts`
  - priority-one package-local dependency/assembly collaborators if the plan
    proves forwarding layers add no owner value
  - priority-one/orchestrator tests
- Files out of scope:
  - Plex auth Home endpoint/client cleanup owned by `FCP-8`
  - EPG renderer cleanup owned by `FCP-10`
  - package folder reorganization owned by `FCP-12`
  - cross-package behavior changes to Plex, scheduler persistence schema,
    navigation public API, or platform policy unless a stop/replan gate promotes
    that work into a separate package
- Source findings to retire:
  - `FCP-11-SF1`: after the list-view extraction, prove whether
    `ServerSelectScreen` still combines screen rendering, async discovery/select
    workflows, saved-server reconnect, focus wiring, status policy, visibility
    generation, and idle tracking. If source proof remains, extract the
    necessary package-local owners, such as a session runtime and/or focus
    adapter, until the original mixed-responsibility finding is false. If only
    the list-view/type-cycle concern remains, record the `FCP-7` cleanup as
    sufficient with source proof.
  - `FCP-11-SF2`: `ChannelSetupScreen` remains the package-level convergence
    point for too many wizard concerns. Extract enough package-local owners to
    make the original concern false, prioritizing build review/progress
    rendering, dropdown interaction lifecycle, and session/focus delegation
    seams that source audit proves are still concentrated in the screen.
  - `FCP-11-SF3`: `ChannelManager` still spans channel authoring,
    import/export, persistence coordination, resolution cache, and retry policy.
    Extract enough package-local owners to make the original concern false,
    while preserving public channel contracts and persistence schema. The plan
    must name the target owner set before implementation rather than doing an
    open-ended rewrite.
  - `FCP-11-SF4`: priority-one controller assembly may rebuild dependency
    interfaces mostly by forwarding existing ports. Collapse only direct
    forwarding layers that add no translation; preserve explicit controller
    seams where they clarify ownership.
- Completion means: each hotspot finding is either reduced through one
  source-backed owner extraction set or reclassified with evidence that the
  current post-DCR source is acceptable. The package may not close while the
  original mixed-responsibility sentence remains source-true without an
  accepted owner/revisit trigger. No package closeout by generic "still large"
  commentary, and no package closeout after a single helper extraction if the
  same owner still carries the same workflow mix.
- Execution boundary: each `FCP-11-S*` row is its own implementation/review unit
  unless an approved plan creates an explicit wave with disjoint write scopes.
  Before a slice starts, the plan must freeze the exact `source_finding_ids`,
  owner seam, files in scope/out of scope, public contracts, proof surface, and
  source-audit question that decides whether the original finding is false.
- Verification routing: targeted tests for each touched owner, source audits for
  moved responsibilities and private-probe avoidance, public-seam tests before
  helper extraction when behavior is subtle, `npm run typecheck`, then `npm run
  verify`. Update `docs/architecture/CURRENT_STATE.md` or
  `docs/architecture/modules.md` when hotspot status or ownership truth changes,
  and run `npm run verify:docs` for those docs updates.
- Ready-now execution unit: none; package complete.
- Suggested slice table / wave candidates:

  | Slice | Candidate goal | Write scope | Parallel policy |
  | --- | --- | --- | --- |
  | `FCP-11-S1` | server-select owner closure audit and sufficient runtime/focus/session extraction | server-select files/tests | serial; UI/focus-sensitive |
  | `FCP-11-S2` | channel setup screen owner closure audit and sufficient wizard/render/interaction extraction | channel setup UI files/tests | separate wave if disjoint |
  | `FCP-11-S3` | ChannelManager owner closure audit and sufficient authoring/import/persistence/cache/retry extraction | scheduler/channel files/tests | separate wave if disjoint |
  | `FCP-11-S4` | priority-one direct-forwarding reduction | priority-one/orchestrator files/tests | may run apart after impact audit |

- Stop/replan triggers: a slice becomes a broad feature rewrite; focus behavior
  changes without tests; persistence schema, public channel contracts, or public
  runtime contracts need to change even if tests can be added; extraction
  creates a second screen/controller with hidden lifecycle ownership; direct
  forwarding is needed to preserve an explicit cross-module seam; an owner
  closure requires changing public API or behavior in a different package; the
  plan cannot state how the original mixed-responsibility finding will become
  false.
- Last touched: 2026-05-02
- Verification: passed `npm run plans:check`; clean plan review; targeted
  `FCP-11-S1` server-select tests; targeted `FCP-11-S2` channel setup tests
  including build `Done` success-path proof; targeted `FCP-11-S3`
  channel-manager/persistence/cache/retry tests including stale debounced-save
  regression proof; targeted `FCP-11-S4` priority-one/orchestrator assembly
  tests; `npm run typecheck`; `npm run verify:architecture`; `git diff
  --check`; and clean final implementation reviews for `FCP-11-S1` through
  `FCP-11-S4`. Final package `npm run verify` and `npm run verify:docs`
  passed during closeout.
- Follow-ups: none
- Proof matrix: `FCP-11-SF1` retired by commit `d56a13ca` (server-select
  runtime/focus/status owners); `FCP-11-SF2` retired by commits `aefbbfd0` and
  `606ad0ae` (channel setup dropdown/build presenter owners plus public
  success-path proof); `FCP-11-SF3` retired by commits `42d93a9d` and
  `6ed9d0c6` (ChannelManager owner split plus debounced-save interleaving fix);
  `FCP-11-SF4` retired by commit `f02cc0a1` (priority-one forwarding collapse
  while preserving owner-value seams). `51c60d02` records the lint-gate fix for
  reviewed FCP-11 files.
- Handoff: completed by cleanup-loop on 2026-05-02 after source-backed owner
  closure, targeted verification, clean implementation review, and package
  closeout verification. Next safe package is `FCP-12` only after this closeout
  commit and review evidence remain clean.

### [x] `FCP-12` Package Organization, Structure Navigation, And Final Exit

- Status: completed
- Plan: `docs/plans/2026-05-02-fcp-12-package-organization-structure-navigation-final-exit-plan.md`
- Dimensions/rubric tags: structure navigation, package organization,
  high-level elegance, docs/source coherence
- Scope owner: app-shell/core orchestrator package organization owner with final
  cleanup closeout owner
- Why this package exists / production risk: even after responsibility
  extraction, some package roots remain flat enough to slow navigation and code
  review. This package should perform structure-only reorganization where it
  improves discoverability, then reconcile the final cleanup pass without using
  score output as closure proof.
- Files in scope:
  - `src/core/app-shell/*`
  - `src/core/orchestrator/*`
  - focused subfolders under `src/core/app-shell/` and
    `src/core/orchestrator/` if created
  - app-shell/orchestrator tests affected by import moves
  - `docs/architecture/CURRENT_STATE.md`
  - `docs/architecture/modules.md`
  - `ARCHITECTURE_CLEANUP_CHECKLIST.md`
- Files out of scope:
  - behavior changes inside app-shell/orchestrator owners unless required by a
    source-proven import move
  - reopening completed FCP-7 through FCP-11 implementation work
  - Windows port implementation
- Source findings to retire:
  - `FCP-12-SF1`: `src/core/app-shell` mixes diagnostics, deferred-screen
    loading, runtime theming, startup UI, toast, containers, and config in one
    flat folder. Introduce focused subfolders only if exports/imports remain
    stable and no new root barrel is created.
  - `FCP-12-SF2`: `src/core/orchestrator` remains a large flat coordination
    package with distinct composition, event binding, runtime facade, and
    controller clusters. Stage behavior-neutral foldering around existing
    owners.
  - `FCP-12-SF3`: final cleanup pass reconciliation must prove `FCP-7` through
    `FCP-11` are fixed, source-disproved, or accepted with one owner/revisit
    trigger before closing this package.
- Completion means: package reorganization either lands with stable behavior
  and updated docs/imports, or is source-reclassified as not worth pre-port
  churn; all active FCP packages are reconciled; architecture docs match current
  source; final verification and clean closeout review are recorded.
- Verification routing: import/source audits, targeted app-shell/orchestrator
  tests affected by moves, `npm run typecheck`, `npm run verify`,
  `npm run plans:check`, `npm run verify:docs`, and `git diff --check`.
- Ready-now execution unit: none; package complete.
- Suggested slice table / wave candidates:

  | Slice | Candidate goal | Write scope | Parallel policy |
  | --- | --- | --- | --- |
  | `FCP-12-S1` | app-shell folder organization | app-shell files/tests/docs | serial with S2 unless plan proves disjoint |
  | `FCP-12-S2` | core orchestrator folder organization | orchestrator files/tests/docs | serial with S1 if imports overlap |
  | `FCP-12-S3` | final FCP reconciliation and closeout | checklist/docs only unless replanned | serial after S1/S2 |

- Stop/replan triggers: foldering changes public imports, creates barrels that
  widen API surface, conflicts with unfinished FCP packages, or becomes a
  behavior refactor.
- Last touched: 2026-05-04
- Verification: source audits for `src/core/app-shell` and
  `src/core/orchestrator` old/replacement folder structure, no barrels/shims,
  no old flat imports, and no package-local cycles; FCP-7 through FCP-12
  source-finding reconciliation audit; `npm run plans:check`;
  `npm run verify:docs`; `npm run typecheck`; `git diff --check`; and final
  `npm run verify`.
- Follow-ups: none
- Proof matrix:
  - `FCP-12-SF1`: resolved. Current source has focused
    `src/core/app-shell/diagnostics/`, `deferred-screens/`, `runtime/`,
    `chrome/`, and `config/` owners; no production import remains from the old
    flat app-shell leaf paths, and no app-shell root barrel or compatibility
    shim exists.
  - `FCP-12-SF2`: resolved. Current source keeps
    `src/core/orchestrator/AppOrchestrator.ts` as the implementation facade and
    preserves `priority-one/`, while composition, event, runtime, controller,
    policy, storage, and contract files live under focused subfolders; no
    production import remains from the old flat orchestrator leaf paths, and no
    orchestrator root barrel or compatibility shim exists.
  - `FCP-12-SF3`: resolved. Current-source audits plus prior reviewed
    checkpoints prove `FCP-7` through `FCP-11` source findings are fixed or
    source-disproved with no accepted residuals; `FCP-12-SF1` and
    `FCP-12-SF2` are resolved above.
- Final FCP source reconciliation:
  - `FCP-7`: resolved. Current source shows server-select shared display/state
    types in `src/modules/ui/server-select/types.ts`, no stale
    `NavigationCoordinator` runtime-UI architecture exception, a debug-owned
    now-playing refresh port in `NowPlayingDebugManager`, canonical
    channel-setup config imports, canonical workflow-unavailable predicate use,
    navigation aliasing the shared `ChannelSwitchOutcome`, and closed event-map
    typing for the shared emitter.
  - `FCP-8`: resolved. Current source shows object-shaped Plex timeout helpers,
    aligned `ChannelCreateOptions` on `IChannelManager` and `ChannelManager`,
    library-owned `PlexMediaItem` plus stream-owned `PlexStreamMediaItem`,
    sanitized Plex auth causes, Home endpoint probing in
    `plexHomeEndpointClient.ts`, private `_fetchPagedMediaItems` pagination,
    and shared `formatChannelSetupWarningDetail`.
  - `FCP-9`: resolved. Current source keeps
    `now-playing-info/styles.css` as an import seam with content rules in
    `styles.content.css`, updates architecture docs to current source-backed
    owners, leaves only semantic contract comments in the audited files, and
    uses descriptor-driven native facet planning in
    `ChannelSetupFacetLibraryExecutor`.
  - `FCP-10`: resolved. Current source has `EPGCellPresentation.ts` as the
    text/layout/presentation policy owner, `EPGCellRenderer.ts` as the DOM
    adapter, and direct renderer tests for width tiers, slivers, focused
    episode/movie layout, live/progress, and ticker timing.
  - `FCP-11`: resolved. Current source splits server-select runtime/focus/status
    owners, channel-setup session/focus/dropdown/build-step owners,
    ChannelManager authoring/import/persistence/cache/retry owners, and
    priority-one assembly/collaborator owner-value seams.
  - `FCP-12`: resolved by `bf87a345`, `0a1c64af`, and this closeout.
- Handoff: `FCP-12` closed the completed `FCP-7` through `FCP-12` baseline.
  The next additional pre-Windows-port package is `FCP-13`; do not start
  `FCP-14` or later, `FCP-EXIT`, Windows port work, or other post-FCP cleanup
  until the preceding FCP package has clean closeout evidence.

### [x] `FCP-13` Low-Risk Source Signal, API Export, And Diagnostic Closure

- Status: completed
- Plan:
  `docs/plans/2026-05-05-fcp-13-low-risk-source-signal-api-export-diagnostic-closure-plan.md`
- Dimensions/rubric tags: source signal, API surface coherence, contract
  coherence, error consistency, duplication, low-level elegance
- Scope owner: source-signal and small API/diagnostic contract owner across
  navigation, Plex, player, EPG, channel setup, scheduler package seams, and
  architecture rules
- Why this package exists / production risk: maintainer-admitted source-audit
  themes found small closure issues that should be cheap to retire before broad
  refactors. These are low-risk, high-signal cleanups: remove redundant
  commentary, align public package exports and docs with current behavior,
  remove obsolete lint exceptions, and fix tiny duplication/diagnostic noise
  without changing product behavior.
- Files in scope:
  - `src/modules/navigation/interfaces.ts`
  - `src/modules/plex/stream/interfaces.ts`
  - `src/modules/plex/library/interfaces.ts`
  - `src/modules/player/AudioTrackManager.ts`
  - `src/modules/player/ErrorHandler.ts`
  - `src/modules/ui/epg/view/EPGErrorBoundary.ts`
  - `src/modules/ui/epg/view/EPGCellRenderer.ts`
  - `src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts`
  - `src/modules/scheduler/channel-manager/interfaces.ts`
  - `src/modules/scheduler/channel-manager/index.ts`
  - `src/modules/scheduler/channel-manager/__tests__/*` only for API export
    proof if needed
  - `src/modules/plex/auth/PlexAuth.ts`
  - `src/modules/plex/auth/__tests__/PlexAuth.test.ts`
  - `tools/architecture-rules/lineupArchitectureRules.mjs`
  - `tools/__tests__/build-eslint-architecture-rules.test.mjs`
  - `src/core/orchestrator/controllers/SubtitleTrackRecoveryController.ts`
  - `src/__tests__/orchestrator/subtitle-track-recovery-warning-contract.test.ts`
  - `src/core/channel-setup/shared/utils.ts`
  - call sites/tests for `isSignalAborted` only if the wrapper has live
    production callers
  - `src/modules/ui/channel-setup/steps/StrategyStepController.ts`
  - channel setup UI tests affected by strictly local strategy-step cleanup
- Files out of scope:
  - broad repo-wide comment cleanup
  - behavior changes to navigation, Plex auth, stream resolution, playback,
    scheduler persistence, channel setup workflow, or EPG visuals
  - Plex auth extraction, channel manager owner extraction, content resolver
    decomposition, package folder reorganization, and ChannelSetupScreen
    convergence cleanup
- Source findings to retire:
  - `FCP-13-SF1`: selected navigation, Plex stream, and Plex library interface
    JSDoc restates TypeScript signatures. Prune redundant comments while
    preserving semantic notes about lifecycle, nullability, side effects,
    server quirks, and error behavior.
  - `FCP-13-SF2`: selected implementation comments in player and EPG files
    narrate the next statement. Delete only comments that add no constraint,
    failure rationale, platform rationale, or public contract signal.
  - `FCP-13-SF3`: `ChannelCreateOptions` is public through
    `IChannelManager.createChannel` but not exported from the channel-manager
    package seam. Align the public export surface without widening behavior.
  - `FCP-13-SF4`: `PlexAuth.validateToken` documentation says invalid tokens
    return `false`, but implementation throws for non-auth service failures.
    Align the doc with current tested behavior or replan if the behavior is
    wrong.
  - `FCP-13-SF5`: architecture lint still carries obsolete app-shell
    composition-root exceptions for old paths/reasons. Remove stale exceptions
    only if current rule tests prove the boundary remains active or stricter.
  - `FCP-13-SF6`: subtitle burn-in diagnostics can report an attempt even when
    no burn-in attempt object exists. Emit diagnostics only for actual attempts
    and preserve existing user warnings.
  - `FCP-13-SF7`: `isSignalAborted` is a redundant wrapper around
    `signal?.aborted`. Remove it or source-justify keeping it if current
    callers need one canonical helper.
  - `FCP-13-SF8`: `EPGCellRenderer` repeats the same secondary text clearing
    block in adjacent branches. Consolidate the local logic without changing
    DOM shape, width-tier behavior, focus hooks, reduced-motion handling, or
    ticker behavior.
  - `FCP-13-SF9`: `StrategyStepController` repeats inline structural control
    patterns. Use a local descriptor table or focused helper only if it reduces
    concrete repetition without hiding behavior or changing preview, validation,
    focus, or step lifecycle semantics.
- Completion means: all listed small source-signal/API/diagnostic findings are
  fixed or source-disproved; no semantic comments are deleted; channel-manager
  package exports align with public interfaces; architecture lint exceptions are
  current; subtitle burn-in diagnostics match actual attempts; EPG renderer
  duplicate clearing and strategy-step structural repetition are consolidated
  or accepted with one owner/revisit trigger.
- Verification routing: targeted source audits for each listed file, focused
  tests for touched Plex auth, EPG renderer, subtitle recovery, and architecture
  rules, `npm run typecheck`, `git diff --check`, `npm run plans:check`,
  `npm run verify:docs` for checklist/architecture-rule docs impact, then
  `npm run verify` because runtime source changes are likely.
- Ready-now execution unit: none; package complete.
- Suggested slice table / wave candidates:

  | Slice | Candidate goal | Write scope | Parallel policy |
  | --- | --- | --- | --- |
  | `FCP-13-S1` | comment/JSDoc pruning and `validateToken` doc alignment | listed interface/player/EPG/PlexAuth files/tests | may run first; behavior-neutral |
  | `FCP-13-S2` | channel-manager package export and obsolete architecture exceptions | scheduler package seam + architecture rules/tests | may run apart after source audit |
  | `FCP-13-S3` | subtitle diagnostic, abort wrapper, and EPG duplicate clearing | subtitle/channel-setup/EPG files/tests | serial if tests overlap |
  | `FCP-13-S4` | StrategyStepController descriptor/helper cleanup | strategy step controller/tests | serial; only local structural cleanup |

- Stop/replan triggers: comment pruning touches semantic API or platform
  guidance; `ChannelCreateOptions` requires a new public API decision instead
  of exporting an existing public type; architecture-rule cleanup loosens a
  boundary; subtitle diagnostic changes user-visible warnings; EPG renderer
  consolidation changes DOM/focus/ticker behavior; strategy-step cleanup
  changes preview, validation, focus, or step lifecycle behavior; abort helper
  removal requires broader channel setup cancellation policy decisions.
- Last touched: 2026-05-05
- Verification: targeted source audits for all listed source-finding surfaces;
  `npm test -- PlexAuth`; `node --test
  tools/__tests__/build-eslint-architecture-rules.test.mjs`; targeted subtitle
  recovery warning contract tests; channel setup cancellation/caller tests for
  the removed abort helper; direct EPG renderer tests; `npm test --
  StrategyStepController`; `npm run plans:check`; `npm run verify:docs`;
  `npm run typecheck`; `git diff --check`; and final `npm run verify`.
- Follow-ups: none
- Proof matrix:
  - `FCP-13-SF1`: resolved. Redundant selected interface JSDoc in navigation,
    Plex stream, and Plex library contracts was pruned while lifecycle,
    nullability, side-effect, server-quirk, and error-behavior guidance was
    preserved.
  - `FCP-13-SF2`: resolved. Adjacent-statement implementation comments in the
    selected player and EPG files were removed or narrowed; failure-handling,
    security/redaction, focus, and behavior rationale comments were preserved.
  - `FCP-13-SF3`: resolved. `ChannelCreateOptions` remains owned by
    `src/modules/scheduler/channel-manager/interfaces.ts` and is now exported
    from the channel-manager package seam without changing
    `IChannelManager.createChannel` behavior.
  - `FCP-13-SF4`: resolved. `PlexAuth.validateToken` class documentation now
    matches current tested behavior: explicit `401`/`403` auth-invalid
    responses return `false`, while timeout, service, transport, and malformed
    success failures throw.
  - `FCP-13-SF5`: resolved. Obsolete old-path app-shell composition-root
    exceptions were removed from architecture lint, and rule tests prove the
    composition-root boundary remains enforced.
  - `FCP-13-SF6`: resolved. Subtitle burn-in attempt diagnostics are emitted
    only for source-proven attempts while failure diagnostics and user warnings
    remain intact.
  - `FCP-13-SF7`: resolved. The redundant `isSignalAborted` wrapper and its
    shared utility file were removed; live channel setup callers now use direct
    `signal?.aborted` or existing cancellation checks with targeted caller
    coverage.
  - `FCP-13-SF8`: resolved. `EPGCellRenderer` consolidates the adjacent
    secondary-text clearing logic locally without changing DOM shape,
    width-tier behavior, focus hooks, reduced-motion handling, or ticker
    behavior.
  - `FCP-13-SF9`: resolved. `StrategyStepController` now uses a local helper
    for repeated adjustable-control construction while preserving preview,
    validation, focus registration, category state, and step lifecycle
    behavior.
- Closeout commits: `117206d4` (plan), `e650740b` (`FCP-13-S1`), `eb924084`
  (`FCP-13-S2`), `4d27965c` (`FCP-13-S3`), `8a3f2470` (plan conformance), and
  `eb19ba7f` (`FCP-13-S4`). The unrelated dirty/untracked paths present at
  handoff remained unstaged and are not FCP-13 closure evidence.
- Review evidence:
  - Plan review: fresh tracked reviewer reported no material findings and
    approved `ready_now_execution_unit` / `ready_now_slice` as `FCP-13-S1`.
  - `FCP-13-S1`: initial review found one remaining EPG narration comment; the
    same reviewer closure check cleared the amended commit, and a fresh final
    reviewer approved `e650740b` clean.
  - `FCP-13-S2`: fresh implementation review approved `eb924084` clean.
  - `FCP-13-S3`: fresh implementation review approved `4d27965c` clean.
  - Plan conformance revision: fresh reviewer approved `8a3f2470` clean after
    `npm run plans:check` / `npm run verify:docs` passed against the tracked
    active plan.
  - `FCP-13-S4`: fresh implementation review found no code issues in
    `eb19ba7f`; the only finding was the pre-existing unrelated dirty/untracked
    workspace state, now accounted for in this closeout record.
- Handoff: `FCP-13` is closed. The next safe package is `FCP-14`; do not start
  `FCP-15` or later, `FCP-EXIT`, Windows port work, or other post-FCP cleanup
  until `FCP-14` has clean closeout evidence.

### [x] `FCP-14` Priority-One Forwarding And Assembly Seam

- Status: completed
- Plan:
  `docs/plans/2026-05-05-fcp-14-priority-one-forwarding-assembly-seam-plan.md`
- Dimensions/rubric tags: cross-module architecture, abstraction fitness,
  contract coherence, orchestrator runtime seams
- Scope owner: priority-one orchestrator assembly owner
- Why this package exists / production risk: priority-one controller assembly is
  a shared runtime seam. Any no-value adapter layer makes the Windows port
  harder to reason about because dependencies appear to be translated when they
  are mostly forwarded. This package is intentionally only the priority-one
  forwarding seam.
- Files in scope:
  - `src/core/orchestrator/priority-one/PriorityOneControllerCollaborators.ts`
  - `src/core/orchestrator/priority-one/PriorityOneAssemblyBuilder.ts`
  - `src/core/orchestrator/priority-one/PlaybackRuntimeController.ts`
  - `src/core/orchestrator/runtime/OrchestratorRuntimeSeams.ts`
  - `src/core/orchestrator/controllers/ProfileSwitchCleanupController.ts`
  - priority-one/orchestrator tests affected by assembly changes
- Files out of scope:
  - Plex auth, scheduler/channel-manager, ContentResolver, navigation, Plex
    stream, UI, persistence schema, and Windows platform behavior
- Source findings to retire:
  - `FCP-14-SF1`: priority-one controller assembly rebuilds dependency
    interfaces mostly by forwarding grouped runtime ports, and the same seam
    includes a duplicate adapter handoff. Collapse only forwarding layers that
    add no translation, and preserve seams that encode controller ownership.
- Completion means: priority-one assembly no longer has no-value double
  forwarding; preserved seams have source-backed owner value; no runtime public
  contract or behavior changes.
- Verification routing: Codanna impact snapshot for priority-one assembly
  symbols, targeted priority-one/orchestrator tests, source audit for removed
  forwarding and preserved owner-value seams, `npm run typecheck`,
  `git diff --check`, then `npm run verify`.
- Ready-now execution unit: none; package complete.
- Suggested slice table / wave candidates:

  | Slice | Candidate goal | Write scope | Parallel policy |
  | --- | --- | --- | --- |
  | `FCP-14-S1` | priority-one forwarding collapse | priority-one/runtime/controller files/tests | single-owner package |

- Stop/replan triggers: direct forwarding is needed to preserve an explicit
  cross-module seam; a runtime public contract must change; the work needs
  Plex, scheduler, UI, persistence, or Windows behavior changes; tests require
  private probing instead of public seam proof.
- Last touched: 2026-05-05
- Verification: pre/post source audits for `FCP-14-SF1`; `npm test --
  PriorityOneAssemblyBuilder PriorityOneControllerCollaborators
  PriorityOneControllerFactory`; `npm test -- PlaybackRuntimeController
  ProfileSwitchCleanupController OrchestratorRuntimeSeams`; `npm test --
  lifecycle-resume-race`; `npm run typecheck`; `npm run plans:check`;
  `npm run verify:docs`; `git diff --check`; and final `npm run verify`.
- Follow-ups: none
- Proof matrix:
  - `FCP-14-SF1`: resolved. `PriorityOneControllerCollaborators` no longer
    rebuilds method-by-method dependency interfaces for playback runtime and
    profile-switch cleanup when the grouped priority-one runtime ports already
    carry the same contract. `PlaybackRuntimeController` now consumes grouped
    playback, scheduler, player-event, and UI runtime ports directly, while
    `ProfileSwitchCleanupController` consumes the grouped scheduler/playback
    ports it needs. Preserved priority-one seams still carry owner value:
    `PriorityOneAssemblyBuilder` keeps null-safe optional surface adaptation,
    delayed channel-badge synchronization, recoverable transcode-stop error
    reporting, UI side-effect aggregation, event cleanup reporting, and
    lifecycle/event wiring; event-binder shaping and controller construction
    order remain in the priority-one owner.
- Closeout commits before checklist closeout: `f9d16061` (plan), `ddc49e95`
  (`FCP-14-S1` implementation), and `fd74c705` (plan conformance).
- Review evidence:
  - Plan review: fresh tracked reviewer reported no material findings and
    approved `ready_now_execution_unit` / `ready_now_slice` as `FCP-14-S1`.
  - `FCP-14-S1`: fresh implementation reviewer reported no material findings
    and approved the execution unit for package closeout.
- Handoff: `FCP-14` is closed. The next safe package is `FCP-15`; do not start
  `FCP-16` or later, `FCP-EXIT`, Windows port work, or other post-FCP cleanup
  until `FCP-15` has clean closeout evidence.

### [x] `FCP-15` PlexAuth Home, Profile, And Status Helper Boundary

- Status: completed
- Plan:
  `docs/plans/2026-05-05-fcp-15-plexauth-home-profile-status-helper-boundary-plan.md`
- Dimensions/rubric tags: Plex integration, authorization consistency, contract
  coherence, error consistency, persistence ownership
- Scope owner: Plex auth Home endpoint/status/profile-switch owner
- Why this package exists / production risk: `PlexAuth` is port-critical auth
  code. The safe cleanup seam is narrow: Home endpoint fallback, status
  classification, and profile-switch coordination. Token validation, PIN,
  credential epoch, persistence, and event behavior must remain stable unless a
  source audit proves a smaller safe seam and the plan replans explicitly.
- Files in scope:
  - `src/modules/plex/auth/PlexAuth.ts`
  - `src/modules/plex/auth/plexHomeEndpointClient.ts`
  - `src/modules/plex/auth/*` only for Home endpoint/status/profile-switch
    extraction proven by source audit
  - `src/modules/plex/auth/__tests__/*`
- Files out of scope:
  - token/PIN behavior changes
  - credential epoch, storage key, or persistence behavior changes
  - Plex discovery, library, stream resolution, playback URL, or subtitle
    behavior
  - scheduler/channel-manager and priority-one work
- Source findings to retire:
  - `FCP-15-SF1`: `PlexAuth` still mixes Home endpoint fallback, profile
    switching, status classification, and credential persistence. Keep
    extraction bounded around Home endpoint/status/profile-switch boundaries;
    preserve token validation, PIN flow, credential epoch, event emission, and
    persistence behavior unless source audit proves a safe narrower seam.
- Completion means: Home endpoint/status/profile-switch responsibilities are
  either owned by a focused auth-local helper or source-justified as acceptable
  in `PlexAuth`; token, PIN, credential epoch, persistence, and event behavior
  are preserved with targeted proof.
- Verification routing: Codanna impact snapshot for `PlexAuth`, targeted auth
  and initialization/profile-switch tests, source audits for credential/token
  behavior preservation, `npm run typecheck`, `git diff --check`, then
  `npm run verify`.
- Ready-now execution unit: none; package complete.
- Suggested slice table / wave candidates:

  | Slice | Candidate goal | Write scope | Parallel policy |
  | --- | --- | --- | --- |
  | `FCP-15-S1` | bounded Home/status/profile helper cleanup | Plex auth files/tests | single-owner, auth-sensitive |

- Stop/replan triggers: token validation, PIN flow, credential epoch,
  persistence schema/key, or event behavior must change; stream/discovery/library
  code must change; fallback order or error taxonomy changes without an explicit
  contract decision.
- Last touched: 2026-05-05
- Verification: pre/post source audits for `FCP-15-SF1`; `npm test -- PlexAuth
  plexHomeEndpointClient`; `npm test -- plexHomeProfileClient`; `npm test --
  InitializationStartupPolicy InitializationCoordinator`; `npm run typecheck`;
  `git diff --check`; `npm run plans:check`; `npm run verify:docs`; and final
  `npm run verify`.
- Follow-ups: none
- Proof matrix:
  - `FCP-15-SF1`: resolved. `PlexAuth` no longer owns Plex Home endpoint
    fallback loops, Home status classification, switch URL/PIN construction,
    unsupported switch mapping, or wrong-PIN status coordination directly.
    `plexHomeProfileClient.ts` now owns those auth-local Home/profile request
    and status responsibilities. `PlexAuth` remains the owner for credential
    state, credential epoch protection, `lineup_plex_auth` persistence,
    corruption handling, token validation, PIN flow, active/account token
    selection, selected-server map preservation, and `authChange` /
    `profileChange` event emission.
- Closeout commits before checklist closeout: `3c92127a` (`FCP-15-S1`
  implementation).
- Review evidence:
  - Plan review: fresh tracked reviewer reported no blocking findings and
    approved `ready_now_execution_unit` / `ready_now_slice` as `FCP-15-S1`.
  - `FCP-15-S1`: fresh implementation reviewer reported no material findings
    and approved the execution unit for package closeout.
- Handoff: `FCP-15` is closed. The next safe package is `FCP-16`; do not start
  `FCP-17` or later, `FCP-EXIT`, Windows port work, or other post-FCP cleanup
  until `FCP-16` has clean closeout evidence.

### [x] `FCP-16` Scheduler Current-Channel And ChannelManager Persistence Semantics

- Status: completed
- Plan:
  `docs/plans/2026-05-05-fcp-16-scheduler-current-channel-channelmanager-persistence-semantics-plan.md`
- Dimensions/rubric tags: persistence ownership, contract coherence, API
  surface coherence, scheduler design, test strategy
- Scope owner: scheduler/channel-manager persistence semantics owner
- Why this package exists / production risk: current-channel persistence is
  shared scheduler state. Strict and best-effort methods that both swallow
  storage failures make behavior hard to reason about before port work. This
  package also allows only the ChannelManager facade-local owner cleanup needed
  to clarify that persistence seam.
- Files in scope:
  - `src/modules/scheduler/channel-manager/ChannelManager.ts`
  - `src/modules/scheduler/channel-manager/ChannelPersistenceStore.ts`
  - `src/modules/scheduler/channel-manager/ChannelPersistenceCoordinator.ts`
  - existing and new package-local channel-manager persistence/facade owners if
    source audit proves they are needed for the current-channel seam
  - scheduler/channel-manager persistence/facade tests affected by owner moves
- Files out of scope:
  - public channel-manager facade removal or public API widening
  - persistence schema changes or storage key changes
  - ContentResolver cache/mapping cleanup
  - Plex auth, Plex stream, priority-one, navigation, and UI work
  - Windows platform feature implementation
- Source findings to retire:
  - `FCP-16-SF1`: current-channel persistence exposes strict and best-effort
    methods while both swallow storage failures. Clarify and align semantics
    before Windows port work, preserving current storage keys and schema unless
    a replan approves a behavior change.
  - `FCP-16-SF2`: `ChannelManager` remains a broad public facade across
    authoring, persistence, cache, import/export, and retry policy. Keep the
    public facade, but extract or confirm focused package-local owners only
    where current source still concentrates responsibility around persistence
    semantics.
- Completion means: current-channel persistence semantics are named, aligned,
  and tested; ChannelManager keeps its public facade; any package-local owner
  extraction stays inside scheduler/channel-manager persistence/facade seams;
  storage schema and keys are unchanged unless a replan approves otherwise.
- Verification routing: Codanna impact snapshot for `ChannelManager` and
  current-channel persistence symbols, targeted channel-manager persistence and
  facade tests, source audits for storage schema/key preservation,
  `npm run typecheck`, `git diff --check`, then `npm run verify`.
- Ready-now execution unit: none; package complete.
- Suggested slice table / wave candidates:

  | Slice | Candidate goal | Write scope | Parallel policy |
  | --- | --- | --- | --- |
  | `FCP-16-S1` | current-channel persistence semantics | channel-manager persistence files/tests | serial first |
  | `FCP-16-S2` | persistence-adjacent ChannelManager facade-local owner cleanup | ChannelManager/facade tests | only if S1 source audit proves need |

- Stop/replan triggers: a persistence schema or storage-key migration is
  needed; public channel API widens; non-persistence ChannelManager concerns
  become necessary; ContentResolver changes are required; tests need private
  probing instead of public seam proof.
- Last touched: 2026-05-05
- Verification: pre/post source audits for `FCP-16-SF1`; source-backed no-code
  disposition audit for `FCP-16-SF2`; package-local storage key/schema and
  current-channel call audits; `npm test -- ChannelPersistenceStore
  ChannelRepository ChannelManager.persistence ChannelManager.transactional`;
  `npm test -- ChannelManager ChannelTuningCoordinator
  OrchestratorChannelSwitchRuntime`; `npm run typecheck`; `git diff --check`;
  `npm run plans:check`; `npm run verify:docs`; and final `npm run verify`.
- Follow-ups: none
- Proof matrix:
  - `FCP-16-SF1`: resolved. `ChannelPersistenceCoordinator` no longer exposes
    duplicate strict and best-effort current-channel persistence methods with
    identical swallow/warn semantics. The public current-channel path is
    explicitly best-effort through `persistCurrentChannelIdBestEffort()`;
    `ChannelManager.setCurrentChannel()` preserves the public facade behavior
    of updating in-memory current channel, emitting `channelSwitch`, and
    emitting the existing persistence warning without throwing when the
    separate current-channel write fails. Storage keys, scoped server/user key
    formats, and `StoredChannelData` schema were source-audited unchanged.
  - `FCP-16-SF2`: resolved as source-justified no-code after `FCP-16-S1`.
    Current source no longer concentrates current-channel persistence semantics
    in `ChannelManager` beyond public facade wiring. `ChannelManager` remains
    the single final owner of public facade exposure, delegating persistence
    coordination to `ChannelPersistenceCoordinator`; no package-local owner
    extraction, public API widening, or broader `ChannelManager` decomposition
    was needed.
- Closeout commits before checklist closeout: `d74f88c3` (`FCP-16-S1`
  implementation).
- Review evidence:
  - Plan review: fresh tracked reviewer reported no blocking findings and
    approved `ready_now_execution_unit` / `ready_now_slice` as `FCP-16-S1`.
  - `FCP-16-S1`: fresh implementation reviewer reported no material findings
    and approved the execution unit for next-unit selection.
  - `FCP-16-S2`: fresh implementation reviewer reported no material findings
    and approved the source-justified no-code disposition for package closeout.
- Handoff: `FCP-16` is closed. The next safe package is `FCP-17`; do not start
  `FCP-18` or later, `FCP-EXIT`, Windows port work, or other post-FCP cleanup
  until `FCP-17` has clean closeout evidence.

### [x] `FCP-17` ContentResolver Cache, Coalescing, And Mapping Boundaries

- Status: completed
- Plan:
  `docs/plans/2026-05-05-fcp-17-contentresolver-cache-coalescing-mapping-boundaries-plan.md`
- Dimensions/rubric tags: abstraction fitness, scheduler design, duplication,
  contract coherence, test strategy
- Scope owner: scheduler ContentResolver owner
- Why this package exists / production risk: `ContentResolver` is the scheduler
  entrypoint for source resolution, but it also carries cache/in-flight
  coordination and item mapping/normalization. This package keeps the
  orchestration entrypoint stable while isolating only source-proven local
  cache/coalescing and mapping/normalization owners.
- Files in scope:
  - `src/modules/scheduler/channel-manager/ContentResolver.ts`
  - existing and new package-local ContentResolver collaborators if source
    audit proves cache/coalescing or mapping/normalization seams
  - `src/modules/scheduler/channel-manager/__tests__/ContentResolver.test.ts`
  - `src/modules/scheduler/channel-manager/__tests__/ChannelManager.content-resolution.test.ts`
  - related scheduler/channel-manager tests affected by ContentResolver owner
    moves
- Files out of scope:
  - ChannelManager persistence/current-channel semantics
  - public channel-manager API widening
  - Plex auth, Plex stream, navigation, UI, and Windows feature behavior
  - persistence schema or storage-key changes
- Source findings to retire:
  - `FCP-17-SF1`: `ContentResolver` combines source resolution,
    cache/in-flight coordination, item mapping/filtering/sorting, and media
    metadata normalization. Keep the orchestration entrypoint, but extract or
    confirm local cache/coalescing and mapping/normalization owners where
    current source proves the mix is still live.
- Completion means: ContentResolver keeps its public orchestration entrypoint;
  cache/coalescing and mapping/normalization are owned by package-local
  collaborators or source-justified; behavior, sorting/filtering semantics, and
  error behavior are preserved with tests.
- Verification routing: Codanna impact snapshot for `ContentResolver`,
  targeted ContentResolver and channel-manager content-resolution tests, source
  audits for behavior preservation and public entrypoint stability,
  `npm run typecheck`, `git diff --check`, then `npm run verify`.
- Ready-now execution unit: none; package complete.
- Suggested slice table / wave candidates:

  | Slice | Candidate goal | Write scope | Parallel policy |
  | --- | --- | --- | --- |
  | `FCP-17-S1` | cache/coalescing owner audit and cleanup | ContentResolver collaborators/tests | serial first |
  | `FCP-17-S2` | mapping/normalization owner audit and cleanup | ContentResolver collaborators/tests | serial after S1 unless plan proves disjoint |

- Stop/replan triggers: public ChannelManager API must widen; persistence
  behavior changes; Plex auth/stream behavior changes; sorting/filtering/error
  semantics change; tests need private probing instead of public seam proof.
- Last touched: 2026-05-05
- Verification: pre/post source audits for `FCP-17-SF1`; focused
  cache/coalescing, mixed invalidation, mapping/normalization, filtering,
  sorting, playback, and public error behavior tests; `npm test --
  ContentResolver ChannelManager.content-resolution`; `npm test --
  ChannelManager.error-semantics`; `npm run typecheck`; `git diff --check`;
  `npm run plans:check`; `npm run verify:docs`; and final `npm run verify`.
- Follow-ups: none
- Proof matrix:
  - `FCP-17-SF1`: resolved. `ContentResolver` remains the stable
    scheduler/channel-manager source-resolution orchestration entrypoint and
    keeps the public methods consumed by `ChannelManager`. Source-result
    cache/coalescing semantics now live in package-local `SourceResolutionCache`;
    Plex item mapping and media metadata normalization live in package-local
    `ContentItemMapper`; filtering, sorting, and playback ordering live in
    package-local `ContentSelectionPolicy`. Public channel-manager API,
    persistence/current-channel behavior, Plex behavior, and UI/navigation
    behavior were unchanged.
- Closeout commits before checklist closeout: `43bbd179` (`FCP-17-S1`
  implementation) and `0343b591` (mixed-source cache invalidation test
  follow-up).
- Review evidence:
  - Plan review: initial tracked reviewer found checklist-state and
    verification-plan gaps; the planner revised the plan/checklist, the same
    reviewer confirmed closure, and a fresh final plan reviewer approved
    `FCP-17-S1` for implementation.
  - Implementation review: initial tracked reviewer found a missing
    mixed-source cached invalidation proof; the worker added the public-seam
    test in `0343b591`, the same reviewer confirmed closure, and a fresh final
    implementation reviewer reported no blocking findings and approved
    `FCP-17-S1` for package closeout.
- Handoff: `FCP-17` is closed. The next safe package is `FCP-18`; do not start
  `FCP-19` or later, `FCP-EXIT`, Windows port work, or other post-FCP cleanup
  until `FCP-18` has clean closeout evidence.

### [x] `FCP-18` Behavior-Neutral Navigation Package Organization

- Status: completed
- Plan:
  `docs/plans/2026-05-05-fcp-18-behavior-neutral-navigation-package-organization-plan.md`
- Dimensions/rubric tags: package organization, structure navigation,
  cross-module architecture, dependency health, convention drift
- Scope owner: navigation package organization owner
- Why this package exists / production risk: the navigation package flat folder
  mixes input routing, effects, repeat policy, contracts, and managers. The user
  is willing to do this cleanup if bounded; this package is behavior-neutral
  folder organization only.
- Files in scope:
  - `src/modules/navigation/*`
  - `src/modules/navigation/__tests__/*`
  - focused subfolders under `src/modules/navigation/` if created
  - architecture docs when named navigation paths move
- Files out of scope:
  - behavior changes to navigation input routing, repeat timing, focus policy,
    modal effects, screen effects, public exports, or runtime contracts
  - Plex stream organization
  - compatibility barrels, migration shims, or widened package exports
- Source findings to retire:
  - `FCP-18-SF1`: the navigation package flat folder mixes input routing,
    effects, repeat policy, contracts, and managers. Stage behavior-neutral
    foldering around current owners only if import moves stay local and tests
    prove no navigation behavior changed.
- Completion means: navigation is reorganized around focused current owners or
  source-reclassified as not worth pre-port churn with one owner/revisit
  trigger; no shim, root barrel, public export widening, or behavior change
  lands.
- Verification routing: import/source audits for old and replacement paths,
  targeted navigation tests affected by moves, `npm run typecheck`,
  `git diff --check`, `npm run verify`, and `npm run verify:docs` if
  architecture docs change.
- Ready-now execution unit: none; package complete.
- Suggested slice table / wave candidates(these can be done in 1 pass, no need for seperate reviews for both):

  | Slice | Candidate goal | Write scope | Parallel policy |
  | --- | --- | --- | --- |
  | `FCP-18-S1` | navigation folder organization | navigation files/tests/docs if needed | single-owner package |
  | `FCP-18-S2` | import/path reconciliation | navigation imports/tests/docs | serial closeout |

- Stop/replan triggers: foldering needs compatibility shims or root barrels;
  import moves change public package exports; navigation behavior changes;
  source audit shows organization is not worth pre-port churn.
- Last touched: 2026-05-05
- Verification: pre/post source audits for `FCP-18-SF1`; old flat-path import
  and export audits; replacement-path/public-seam audit;
  `ChannelSwitchOutcome` owner audit; targeted navigation tests; targeted
  orchestrator assembly tests; `npm run typecheck`; `git diff --check`;
  `npm run plans:check`; `npm run verify:docs`; and final `npm run verify`.
- Follow-ups: none
- Proof matrix:
  - `FCP-18-SF1`: resolved. Navigation production files now live under
    focused owner folders: `contracts/`, `manager/`, `input/`, `coordinator/`,
    `handlers/`, and `config/`. The root `src/modules/navigation/index.ts`
    remains the existing public package seam and exports the same public names
    from moved owners. Old flat-path direct imports were reconciled with no
    old-path shim files, subfolder barrels, public export widening, or behavior
    changes. `docs/architecture/CURRENT_STATE.md` and
    `docs/architecture/modules.md` were updated for current path truth.
- Closeout commits before checklist closeout: `55761660`
  (`FCP-18-S1` implementation and architecture path-truth updates).
- Review evidence:
  - Plan review: initial tracked reviewer found missing FCP priority-exit
    readiness and architecture path-truth scope gaps; the planner revised the
    plan, the same reviewer confirmed closure, and a fresh final plan reviewer
    approved `FCP-18-S1` for implementation.
  - Implementation review: tracked reviewer reported no blocking findings and
    approved `FCP-18-S1` for closeout after checking package organization,
    public export stability, absence of shims/barrels, path-truth docs, and
    verification evidence.
- Handoff: `FCP-18` is closed. The next safe package is `FCP-19`; do not start
  `FCP-20`, `FCP-EXIT`, Windows port work, or other post-FCP cleanup until
  `FCP-19` has clean closeout evidence.

### [ ] `FCP-19` Behavior-Neutral Plex Stream Package Organization

- Status: not started
- Plan: none yet
- Dimensions/rubric tags: package organization, structure navigation, Plex
  integration, dependency health, convention drift
- Scope owner: Plex stream package organization owner
- Why this package exists / production risk: the Plex stream package flat folder
  mixes resolver, policy, URL helpers, subtitle probe/debug, and pipeline code.
  The user is willing to do this cleanup if bounded; this package is
  behavior-neutral folder organization only.
- Files in scope:
  - `src/modules/plex/stream/*`
  - `src/modules/plex/stream/__tests__/*`
  - focused subfolders under `src/modules/plex/stream/` if created
  - architecture/API docs only if Plex stream ownership claims change
- Files out of scope:
  - behavior changes to stream resolution, playback URL policy, subtitle
    delivery, debug probes, auth handling, token redaction, or public exports
  - navigation organization
  - compatibility barrels, migration shims, or widened package exports
- Source findings to retire:
  - `FCP-19-SF1`: the Plex stream package flat folder mixes resolver, policy,
    URL helpers, subtitle probe/debug, and pipeline code. Stage
    behavior-neutral foldering around current owners only if imports remain
    stable and no playback/diagnostic behavior changes.
- Completion means: Plex stream is reorganized around focused current owners or
  source-reclassified as not worth pre-port churn with one owner/revisit
  trigger; no shim, root barrel, public export widening, token/redaction change,
  auth-policy change, or playback behavior change lands.
- Verification routing: import/source audits for old and replacement paths,
  targeted Plex stream tests affected by moves, `npm run typecheck`,
  `git diff --check`, `npm run verify`, and `npm run verify:docs` if
  architecture/API docs change.
- Ready-now execution unit: none until plan is written.
- Suggested slice table / wave candidates:

  | Slice | Candidate goal | Write scope | Parallel policy |
  | --- | --- | --- | --- |
  | `FCP-19-S1` | Plex stream folder organization | Plex stream files/tests/docs if needed | single-owner package |
  | `FCP-19-S2` | import/path reconciliation | Plex stream imports/tests/docs | serial closeout |

- Stop/replan triggers: foldering needs compatibility shims or root barrels;
  import moves change public package exports; stream resolution, auth, token
  redaction, subtitle, debug, or playback behavior changes; source audit shows
  organization is not worth pre-port churn.
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: start only after `FCP-18` closeout. Explicit maintainer approval is
  required before creating any compatibility shim or root/package barrel.

### Deferred Pre-Port Candidate: ChannelSetupScreen Distinct Residual

- Disposition: deferred, not an active checklist-linked package
- Plan: none
- Final owner: channel setup UI owner
- Revisit trigger: open a source-backed brief only if current source proves a
  distinct ChannelSetupScreen residual not covered by completed `FCP-11`
  channel setup owner closure or `FCP-13-SF9` strategy-step structural cleanup.
- Reason: broad ChannelSetupScreen cleanup risks reopening completed FCP-11 work
  without a new owner seam. It is not active pre-port work until the brief names
  the exact residual, files in scope/out of scope, behavior invariants,
  verification proof, and stop/replan triggers.
- Verification if activated: targeted channel setup UI tests, source audit
  against FCP-11 completed owner seams, focus/lifecycle proof if touched,
  `npm run typecheck`, `git diff --check`, then `npm run verify`.

### [ ] `FCP-20` Pre-Windows Cleanup Exit And Source Reconciliation

- Status: not started
- Plan: none yet
- Dimensions/rubric tags: verified strictness, docs/source coherence,
  package organization, cross-module architecture, test strategy
- Scope owner: final cleanup controller and pre-Windows reconciliation owner
- Why this package exists / production risk: after `FCP-13` through `FCP-19`,
  the checklist needs an auditable exit gate before Windows port work. The exit
  package should reconcile admitted source-audit themes through local
  `source_finding_id` coverage, prove completed baseline evidence still holds
  where relevant, and leave no ambiguous owner for accepted residue.
- Files in scope:
  - `ARCHITECTURE_CLEANUP_CHECKLIST.md`
  - `docs/architecture/CURRENT_STATE.md` and `docs/architecture/modules.md`
    only if FCP-13 through FCP-19 changed architecture truth
  - package-local audit artifacts if a tracked plan creates them
  - source files touched by FCP-13 through FCP-19 for read-only reconciliation
    audits
- Files out of scope:
  - new implementation work except fixing checklist/docs inconsistencies found
    during exit
  - Windows port implementation
  - new Desloppify issue intake, raw review id mapping, or score-chasing waves
  - reopening completed FCP-7 through FCP-12 unless current-source proof shows
    their recorded baseline evidence is false
- Source findings to retire:
  - `FCP-20-SF1`: final pre-Windows cleanup reconciliation must prove
    `FCP-13` through `FCP-19` local source findings are fixed,
    source-disproved, accepted with one owner/revisit trigger, or explicitly
    deferred to the Windows port owner. The duplicated priority-one review
    observation remains covered only by `FCP-14-SF1`, not by a second checklist
    member.
- Completion means: every `FCP-13` through `FCP-19` source finding has a
  source-backed disposition; all accepted/deferred residuals have one owner and
  revisit trigger; architecture docs match current source; verification and
  clean closeout review evidence are recorded; Windows port work has a clear
  next safe start or a named blocker. Before Windows port work starts, the exit
  record must include passed results for `npm run plans:check`,
  `npm run verify:docs`, `npm run verify`, and
  `git diff --check -- ARCHITECTURE_CLEANUP_CHECKLIST.md`.
- Verification routing: source-finding proof matrix audit for `FCP-13` through
  `FCP-19`, package-local `rg` audits for old/replacement patterns, exact
  commands `npm run plans:check`, `npm run verify:docs`, `npm run verify`, and
  `git diff --check -- ARCHITECTURE_CLEANUP_CHECKLIST.md`. A final optional
  external score refresh may be recorded only as retrospective signal, not as
  checklist membership or closure proof.
- Ready-now execution unit: none until plan is written.
- Suggested slice table / wave candidates:

  | Slice | Candidate goal | Write scope | Parallel policy |
  | --- | --- | --- | --- |
  | `FCP-20-S1` | source-finding proof matrix and residual owner ledger | checklist/audit artifacts | serial |
  | `FCP-20-S2` | architecture doc reconciliation if source ownership changed | architecture docs/checklist | serial after S1 |
  | `FCP-20-S3` | final verification and handoff record | checklist only | serial closeout |

- Stop/replan triggers: exit audit finds a live source issue without one owner;
  completed FCP-7 through FCP-12 baseline evidence is source-false; a
  source-audit theme cannot be mapped to local `source_finding_id`
  coverage; verification fails for runtime work completed in FCP-13 through
  FCP-19; the exit package would need production refactoring instead of
  reconciliation.
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: start only after `FCP-19` closeout. This is the gate before Windows
  port work or any broader post-FCP cleanup.

## Dimension Cleanup Refresh History

The `DCR-*` packages below are completed history after the first six FCP
priorities. They were seeded from deep source review findings, not from a
Desloppify queue. Rubric dimensions remain review prompts only: file health,
code quality, duplication, test health, security,
naming/API/error/abstraction/logic, AI-generated residue, type safety, contract
coherence, cross-module design, and structure/elegance. The active cleanup
surface is now the Final Cleanup Pass above.

Discovery note for this refresh: Codanna was not available in the planning
session that created these package briefs, so file orientation used required
docs plus direct `rg`/source reads. Each execution plan must still run the
repo-required Codanna-first discovery pass, or record the same fallback if the
tool remains unavailable.

### DCR Operating Rules

- Treat each unchecked `DCR-*` row as one checklist-linked package for
  `cleanup-loop`. All current DCR rows are completed history unless a maintainer
  explicitly reopens one with current-source proof.
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
- When a DCR package is reopened by maintainer direction, its active plan lives
  in `docs/plans/*` while implementation/review is in progress. Keep worker
  implementation commits focused on source/test changes; checklist and
  plan-progress updates belong to controller closeout or a separate docs commit.
  At package closeout, preserve long-term facts in the mini-record, delete or
  archive the verbose execution plan, and promote only durable architecture/API
  decisions into the relevant reference docs.
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

### [x] `DCR-9` Lifecycle Migration And Comment/API Cleanup

- Status: completed
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
- Ready-now execution unit: completed.
- Suggested slice table / wave candidates:

  | Slice | Candidate goal | Write scope | Parallel policy |
  | --- | --- | --- | --- |
  | `DCR-9-S1` | `MIGRATIONS` keep/remove/document decision | lifecycle constants/interfaces/tests | serial |
  | `DCR-9-S2` | lifecycle comment/source-signal cleanup | lifecycle source/tests as needed | serial after S1 |

- Stop/replan triggers: migration decision changes persisted lifecycle payload
  contract; cleanup requires app-shell startup changes; storage compatibility
  policy becomes unclear.
- Plan:
  [`docs/archive/plans/2026-04-29-dcr-9-lifecycle-migration-comment-api-cleanup.md`](./docs/archive/plans/2026-04-29-dcr-9-lifecycle-migration-comment-api-cleanup.md)
- Last touched: 2026-04-30, implementation commits `900c96fb`,
  `bd25e51d`, and `58a63db6`
- Verification: plan review approved the active DCR-9 plan with no material
  findings after `npm run plans:check` passed. `DCR-9-S1` implementation
  review approved the package-internal `MIGRATIONS` decision with no material
  findings; targeted `StateManager` tests passed and source audits confirmed
  the registry remains consumed only by `StateManager` and absent from the
  lifecycle barrel. `DCR-9-S2` implementation review found a missing
  cleanup-key ownership note; the narrow revision restored that source signal,
  same-reviewer closure approved it, and a fresh final implementation reviewer
  approved the package. Targeted lifecycle tests, `npm run typecheck`, and
  `npm run verify` passed.
- Follow-ups: none. `MIGRATIONS` remains an intentional package-internal
  lifecycle persistence registry, not public lifecycle API; older persisted
  versions without an approved migration remain rejected. Restating lifecycle
  comments were removed or compressed while storage ownership, cleanup-key,
  phase/save-ordering, platform, and async persistence invariants remain
  discoverable.
- Handoff: `DCR-9` is complete. Do not reopen lifecycle migration/comment API
  cleanup unless source proof shows `MIGRATIONS` became public API, external
  consumers were added, older-version-without-migration rejection regressed,
  cleanup keys became lifecycle-owned schemas, or restating/generated lifecycle
  comments returned in the DCR-9 source surface.

### [x] `DCR-10` Oversized Test Suite Structure Policy

- Status: completed 2026-04-30
- Dimensions/rubric tags: test health, file health, duplication, maintainability,
  source organization
- Scope owner: test-suite structure owner for affected packages
- Why this package exists / production risk: `ChannelManager.test.ts` and
  `SettingsScreen.test.ts` are catch-all files. Adding DCR coverage directly to
  them without a split policy will keep concentrating test maintenance risk.
- Files in scope:
  - `src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts`
  - focused channel-manager test files under the same `__tests__` directory:
    `ChannelManager.transactional.test.ts`,
    `ChannelManager.import-order.test.ts`,
    `ChannelManager.error-semantics.test.ts`, and
    `ChannelManager.stale-fallback.test.ts`
  - `src/modules/ui/settings/__tests__/SettingsScreen.test.ts`
  - `src/modules/ui/settings/__tests__/SettingsScreen.deps.test.ts`
  - `src/modules/ui/settings/__tests__/settings-screen-test-helpers.ts`
  - `src/modules/ui/settings/SettingsScreen.ts`
  - `src/modules/ui/settings/index.ts`
  - `src/core/app-shell/AppLazyScreenRegistry.ts`
  - `src/core/app-shell/__tests__/AppLazyScreenRegistry.test.ts`
- Files out of scope:
  - Settings focus extraction behavior already closed
  - production source changes outside the approved SettingsScreen deps-object
    constructor seam and app-shell construction call shape
  - broad repo-wide test harness rewrite
- Known issues to retire:
  - actual issues:
    - `DCR-10-A1`: completed by commit `ff01fcce`
      (`test(dcr-10): split channel manager coverage`). ChannelManager
      transactional replace-all/current-channel persistence coverage now lives
      in `ChannelManager.transactional.test.ts`; import/reorder contracts live
      in `ChannelManager.import-order.test.ts`; typed error and non-fallback
      failure semantics live in `ChannelManager.error-semantics.test.ts`; stale
      fallback coverage remains in `ChannelManager.stale-fallback.test.ts`.
      Residual policy-term matches in `ChannelManager.test.ts` were reviewed as
      incidental setup, broad CRUD/storage/current-channel behavior, or export
      coverage rather than new transactional/reorder/error DCR coverage.
    - `DCR-10-A2`: completed by commit `713f6a21`
      (`Refactor SettingsScreen constructor deps`). Constructor/dependency
      coverage lives in `SettingsScreen.deps.test.ts` and the catch-all
      `SettingsScreen.test.ts` only migrated existing helper wiring.
    - `DCR-10-A3`: completed by commit `713f6a21`. `SettingsScreen` now uses a
      single `SettingsScreenDeps` object constructor, and the test helper no
      longer passes a positional `undefined` placeholder.
  - owner decisions:
    - `DCR-10-D1`: resolved in this package. The SettingsScreen constructor
      cleanup was implemented as a deps-object seam with targeted tests; no
      migration-out or positional compatibility overload was used.
  - accepted residuals:
    - no broad Settings redesign; existing focus extraction remains closed.
- Completion means: affected packages have a clear split policy or completed
  split before new DCR coverage is added; Settings constructor cleanup is
  implemented with deps-object tests or migrated out under the DCR migration
  rule; package cannot close with only a note saying tests are large.
- Verification routing: targeted split test files plus affected package tests,
  `npm test`/`npm run verify` depending on whether production constructor/API
  changes are included.
- Completed slice table:

  | Slice | Completed goal | Write scope | Result |
  | --- | --- | --- | --- |
  | `DCR-10-S1` | ChannelManager test split policy before future DCR coverage | channel-manager tests/helpers | completed and reviewed clean |
  | `DCR-10-S2` | SettingsScreen constructor/test split decision and deps-object migration | settings tests, SettingsScreen constructor, app-shell call site | completed and reviewed clean |

- Stop/replan triggers: constructor cleanup changes public Settings screen
  construction in app-shell; test split requires production extraction; another
  reviewed package already completed the DCR-10 split/constructor obligations
  and updates this record before `DCR-EXIT`.
- Plan: archived at
  `docs/archive/plans/2026-04-30-dcr-10-oversized-test-suite-structure.md`
- Last touched: completed 2026-04-30
- Verification:
  - Plan gate: direct `checkPlanConformance` for the DCR-10 plan passed after
    the narrow DCR slice-id harness update; `node --test
    tools/__tests__/harness-docs-lib.test.mjs` passed; `npm run plans:check`
    passed; plan review and fresh final approval were clean.
  - `DCR-10-S1`: targeted ChannelManager suites passed (`5` suites, `94`
    tests), and implementation review was clean.
  - `DCR-10-S2`: targeted Settings/AppLazyScreenRegistry suites passed (`3`
    suites, `52` tests), `npm run typecheck` passed, `npm run verify` passed,
    and implementation review was clean.
  - Closeout docs: `npm run verify:docs` required after this checklist/archive
    update.
- Follow-ups: none yet
- Handoff: DCR-10 is complete and no longer blocks `DCR-EXIT`. Future
  ChannelManager transactional/reorder/error/stale-fallback coverage should use
  the focused ChannelManager test files named above instead of growing the
  catch-all suite. Future SettingsScreen constructor/dependency coverage should
  use `SettingsScreen.deps.test.ts` or the local
  `settings-screen-test-helpers.ts` seam instead of adding constructor-policy
  assertions to `SettingsScreen.test.ts`.

### DCR-EXIT S0 Evidence Lookup

`DCR-11` through `DCR-16` are routed from the completed `DCR-EXIT-S0`
controller synthesis. For each package plan, start from the exact S0 finding
ids listed in that package's `Known issues to retire`, search those ids in the
local DCR-EXIT S0 run artifacts and active DCR-EXIT plan, then verify against
current source/docs/config before choosing implementation slices. The checklist
summarizes each issue, but the S0 lane reports and synthesis provide the
supporting source-family proof, recommended disposition, owner, and verification
notes. Do not use stale style/package-map artifacts or fresh Desloppify output
as intake.

### [x] `DCR-11` Verification, Dependency, And Control-Plane Truth

- Status: completed
- Plan: `docs/plans/2026-04-30-dcr-11-verification-dependency-control-plane-truth.md`
- Dimensions/rubric tags: verified strictness, dependency health, docs/source
  coherence, AI-generated debt, package organization, design coherence
- Scope owner: docs/control-plane owner with dependency/config/tooling and
  style/design owners
- Why this package exists / production risk: `DCR-EXIT-S0` found that final
  verification and control-plane truth are not yet reliable enough to close the
  cleanup program. Stale docs, missing proof, omitted bundle verification, and
  dependency advisory state can make later source cleanup appear complete when
  the project cannot prove it.
- Files in scope: `ARCHITECTURE_CLEANUP_CHECKLIST.md`,
  `docs/architecture/CURRENT_STATE.md`, DCR/control-plane docs and plans named
  by S0, style/design docs named by S0, `package.json`, `package-lock.json`,
  verification scripts, stale style cleanup package-map surfaces, and CSS/config
  comments only if needed for listed issues.
- Known issues to retire:
  - actual issues:
    - `DCR-11-A1`: `S0-L01-F5` current-state hotspot wording is stale for
      reduced files.
    - `DCR-11-A2`: `S0-L04-F01` DCR-10 closeout requires docs verification
      proof that is not recorded.
    - `DCR-11-A3`: `S0-L06-NQ-002` module reference points channel setup
      scratch cleanup at the setup-record store.
    - `DCR-11-A4`: `S0-L10-F1` active EPG risk register carries stale TODO,
      old source paths, and uncommitted status.
    - `DCR-11-A5`: `S0-L10-F2` CSS token comment references future design-pass
      plans after active consumption.
    - `DCR-11-A6`: `S0-L13-F1` full verification skips the existing release
      bundle guard.
    - `DCR-11-A7`: `S0-L13-F2` dependency advisory health is failing and needs
      remediation or maintainer-approved residual rationale.
    - `DCR-11-A8`: `S0-L14-F1` style cleanup control-plane docs point at
      missing live artifacts. Retire the stale style cleanup package map rather
      than using it as active cleanup intake.
  - owner decisions:
    - `DCR-11-D1`: decide whether `S0-L10-F3` stylelint tighten-later wording
      remains an accepted residual owned by dependency/config/tooling or is
      resolved in this package.
- Completion means: listed docs/control-plane contradictions are corrected or
  retired with source proof, DCR-10 docs verification proof is recorded,
  `verify:bundle` has maintainer-routed residual/future-owner evidence,
  dependency advisory state has one owner/outcome, and `S0-L10-F3` has a final
  residual or resolved disposition. The stale style cleanup package map is
  retired or archived so it cannot keep generating active UI-panel cleanup work.
- Verification routing: `npm run plans:check`, `npm run verify:docs`,
  `npm run verify:bundle`, `npm audit --audit-level=high`, `npm ls --depth=0`,
  and `npm run lint:css` if CSS changes.
- Ready-now execution unit: none; `DCR-11-W1` has executed and package closeout
  is complete.
- Stop/replan triggers: dependency remediation requires broad package upgrades,
  style-control artifacts cannot be restored or retired cleanly, or bundle
  verification failure exposes implementation work outside this package.
- Last touched: 2026-04-30 during `DCR-11-W1` execution and bounded dependency
  remediation.
- Verification: reviewed DCR-11 plan reached clean final approval; implementation
  review, closure review, and fresh final adversarial review were clean; `npm
  run plans:check` passed; `npm run verify:docs` passed after removing
  local-only run-artifact paths from the active plan; `npm run lint:css` passed
  in the implementation worker; `npm ls --depth=0` passed; bounded Vite patch
  bump plus package-lock refresh of affected dev-tooling packages cleared
  dependency advisories and `npm audit --audit-level=high` passed with `found 0
  vulnerabilities`; `npm run
  verify:bundle` failed because startup entry asset `assets/index-D1ytKM3-.js`
  is `697501` bytes and the guard requires `< 500000`.
- Follow-ups: `DCR-11-A1`, `DCR-11-A2`, `DCR-11-A3`, `DCR-11-A4`,
  `DCR-11-A5`, `DCR-11-A7`, and `DCR-11-A8` have in-scope resolution evidence;
  `DCR-11-A6` is accepted as a maintainer-routed residual owned by the
  release/bundle guard owner with revisit trigger before future bundle-size
  remediation or any attempt to add `verify:bundle` to `npm run verify` /
  DCR-EXIT final proof. `DCR-11-D1` remains the accepted residual owned by
  dependency/config/tooling with revisit trigger on the next CSS/stylelint
  strictness pass or any docs/checklist claim that stylelint strictness is
  closed.
- Handoff: DCR-11 is closed. Do not resume `DCR-EXIT-S2` until `DCR-12` through
  `DCR-16` are complete or explicitly maintainer-routed out of DCR.

### [x] `DCR-12` App-Shell, Startup, And Server-Selection Contracts

- Status: completed
- Plan: `docs/plans/2026-04-30-dcr-12-app-shell-startup-server-selection-contracts.md`
- Dimensions/rubric tags: file health, code quality, abstraction fitness,
  contract coherence, logic clarity, initialization coupling
- Scope owner: app-shell/orchestrator/initialization/server-selection owner with
  Plex auth startup review
- Known issues to retire:
  - actual issues:
    - `DCR-12-A1`: `S0-L01-F1` `AppOrchestrator` remains a live production
      file-health hotspot after DCR-6.
    - `DCR-12-A2`: `F-S0L02-001` cancelled Plex PIN polling can still store
      credentials or resume startup.
    - `DCR-12-A3`: `S0-L08-F1` / `S0-L12-F1` server-select API still exposes
      selected-server storage-key details through app-shell ports.
    - `DCR-12-A4`: `F-S0-L09-001` channel-switch failure outcomes are
      discarded before startup/guide routing can react.
- Completion evidence: all four package issues are closed by implementation and
  tests. `DCR-12-A1` closed through actual `AppOrchestrator` responsibility
  reduction: channel-switch runtime policy, Plex auth screen-runtime facade, and
  selected-server runtime/startup-swap orchestration moved to focused runtime
  owners with fresh source-audit proof. `DCR-12-A2` closed through cancellable
  Plex PIN polling from AuthScreen through PlexAuth/startup resume.
  `DCR-12-A3` closed by replacing app-shell/server-select/diagnostics storage
  key exposure with owner-projected selected-server screen state. `DCR-12-A4`
  closed by carrying channel-switch outcomes through startup and guide routing
  under the approved A4 policy.
- Verification routing: targeted orchestrator, Plex auth cancellation,
  server-selection/app-shell, initialization/channel-switch, and EPG tests
  passed across the slice commits; source audits for `AppOrchestrator` file
  health and selected-server storage-key exposure passed; `npm run plans:check`,
  `npm run verify:docs`, and full `npm run verify` passed during DCR-12.
- Ready-now execution unit: none; package complete.
- Stop/replan triggers: public runtime contracts change, auth/session ownership
  moves across boundaries, app-shell decomposition becomes broad refactor, or
  the planned slices do not name concrete owner seams for reducing the
  `AppOrchestrator` hotspot.
- Last touched: 2026-04-30
- Verification: targeted slice verification and full `npm run verify` passed.
- Follow-ups: none yet.
- Handoff: DCR-12 is closed. Do not resume `DCR-EXIT-S2` until `DCR-13`
  through `DCR-16` are complete or explicitly maintainer-routed out of DCR.

### [x] `DCR-13` Scheduler, ChannelManager, And Test Architecture

- Status: completed
- Plan: `docs/plans/2026-04-30-dcr-13-scheduler-channelmanager-test-architecture.md`
- Dimensions/rubric tags: file health, duplication, test strategy, type safety,
  logic clarity
- Scope owner: scheduler/channel owner with test-suite structure owner
- Known issues to retire:
  - actual issues:
    - `DCR-13-A1`: `S0-L01-F3` `ChannelManager` remains a production hub.
    - `DCR-13-A2`: `S0-L01-F4` oversized catch-all tests remain outside DCR-10
      split scope.
    - `DCR-13-A3`: `S0-L03-F01` duplicate scheduler shuffle implementations
      have inconsistent seed validation.
    - `DCR-13-A4`: `S0-L03-F05` `ContentResolver` tests duplicate
      channel-manager package test factories.
    - `DCR-13-A5`: `TS-002` `ChannelManager` catch-all test spies private
      `_queueSave` outside the private-probe baseline.
- Completion means: scheduler/channel findings are fixed or source-disproved;
  test-structure policy is explicit enough that DCR-EXIT can reconcile it
  without private-probe ambiguity; and both `S0-L01-F3` and `S0-L01-F4` are
  closed by actual production/test responsibility reduction or explicit
  maintainer reclassification. A plan may not close the ChannelManager or
  catch-all-test hotspots by adding coverage, comments, or residual wording
  alone.
- Verification routing: targeted `ChannelManager`, scheduler, and
  `ContentResolver` suites; private-probe policy proof; fresh file/test-health
  source audit proving `S0-L01-F3` and `S0-L01-F4` no longer describe current
  source; `npm run verify` if helpers or production source move.
- Completion evidence: all five package issues are closed by implementation,
  source audit, and clean reviews. `DCR-13-A1` closed through actual
  `ChannelManager` responsibility reduction: debounced save lifecycle and
  import normalization moved to package-local owners
  `ChannelPersistenceSaveQueue` and `ChannelImportNormalizer`, reducing
  `ChannelManager.ts` from `1742` to `1399` lines while preserving persistence
  schema/key ownership in `ChannelPersistenceStore`. `DCR-13-A2` closed through
  actual catch-all test responsibility reduction: `ChannelManager.test.ts`
  shrank from `1218` to `385` lines, with persistence/storage/current-channel
  coverage in `ChannelManager.persistence.test.ts` and content-resolution
  coverage in `ChannelManager.content-resolution.test.ts`. `DCR-13-A3` closed
  by routing scheduler `ShuffleGenerator` through shared `shuffleWithSeed` and
  adding finite-seed compatibility plus non-finite seed validation contracts.
  `DCR-13-A4` closed by removing duplicate `ContentResolver.test.ts`
  `createMockLibrary` / `createMockItem` factories in favor of package-local
  helpers. `DCR-13-A5` closed by removing the private `_queueSave` spy and
  replacing it with public storage/repository proof; private-probe policy
  baseline was not weakened.
- Ready-now execution unit: none; package complete.
- Stop/replan triggers: ChannelManager public behavior or persistence contract
  changes, the package becomes a broad test harness rewrite, or the planned
  slices do not name concrete owner seams for reducing the ChannelManager and
  catch-all-test hotspots.
- Last touched: 2026-04-30, implementation commits `add1fedd`, `e1af8d67`,
  `34bdaf9a`, and `edaa07f4`
- Verification: DCR-13 plan reached clean final approval after one reviewer
  finding was fixed. S1, S2, S3, and S4 implementation reviews were clean.
  Targeted ChannelManager, scheduler, ContentResolver, and private-probe policy
  tests passed during slice execution/review; `npm run typecheck` passed for
  production extraction; `npm run verify` passed after each implementation
  slice. Final closeout source/test-health audits passed: `ChannelManager.ts`
  is `1399` lines, `ChannelManager.test.ts` is `385` lines, no unapproved
  ChannelManager private-probe grep matches remain, `ContentResolver.test.ts`
  no longer defines duplicate `createMockLibrary` / `createMockItem` factories,
  and scheduler `ShuffleGenerator` delegates to shared `shuffleWithSeed`.
  Controller closeout `npm run plans:check`, `npm run verify:docs`, and full
  `npm run verify` passed. The Vite build kept its existing large-chunk warning
  for `dist/assets/index-Bt0C3_fN.js`; the command exited successfully.
- Follow-ups: none for `DCR-13`. DCR-EXIT remains blocked on `DCR-14` through
  `DCR-16` until those packages close or are explicitly maintainer-routed.
- Handoff: DCR-13 is closed. Do not resume `DCR-EXIT-S2` until `DCR-14`
  through `DCR-16` are complete or explicitly maintainer-routed out of DCR.

### [x] `DCR-14` EPG Component File-Health Follow-Through

- Status: completed
- Plan: `docs/plans/2026-04-30-dcr-14-epg-component-file-health-follow-through.md`
- Dimensions/rubric tags: file health, design coherence, UI/focus/navigation,
  test strategy
- Scope owner: EPG/UI owner with design/style review
- Known issues to retire:
  - actual issues:
    - `DCR-14-A1`: `S0-L01-F2` `EPGComponent` still concentrates
      rendering/focus/navigation/timers/grid runtime.
  - accepted residuals:
    - `S0-L14-F2` EPG info-panel edge residual is accepted by maintainer
      decision for codebase cleanup. Current UI panel visuals are intentional;
      future visual changes belong to maintainer-led manual QA after codebase
      cleanup completion, not cleanup-agent implementation.
- Completion means: EPG file-health follow-through is source-backed and tested;
  `S0-L01-F2` is closed by actual responsibility reduction in `EPGComponent` or
  explicit maintainer reclassification; and no visual panel treatment changes
  are introduced by cleanup agents. A plan may not close the EPGComponent
  hotspot by adding tests, documenting it, or accepting it as residual without
  maintainer approval.
- Verification routing: focused EPG component/navigation/rendering tests,
  fresh file-health source audit proving `S0-L01-F2` no longer describes
  current source, source/design audit confirming `S0-L14-F2` remains out of code
  cleanup, then `npm run verify`.
- Ready-now execution unit: none; package complete.
- Stop/replan triggers: a cleanup agent proposes visible panel treatment changes,
  focus/navigation changes overlap unrelated UI cleanup, or the planned slices
  do not name concrete owner seams for reducing the `EPGComponent` hotspot.
- Completion evidence: `DCR-14-A1` closed through actual `EPGComponent`
  responsibility reduction. Shell DOM/ARIA/banner ownership moved to
  `EPGShellView`, focus/navigation/page/select/back ownership moved to
  `EPGFocusNavigator`, and timer/listener lifecycle, visible-range emission,
  and grid render coordination moved to `EPGGridRuntimeController`.
  `EPGComponent.ts` is now a `778`-line `IEPGComponent` facade/wiring owner
  instead of the owner of rendering, focus/navigation, timers, and grid runtime
  at the same time. `S0-L14-F2` remains accepted visual/design residual work
  outside cleanup-agent implementation scope; no EPG CSS or visual panel
  treatment files changed.
- Last touched: 2026-04-30
- Verification: clean final DCR-14 plan approval completed; implementation
  review found no material findings; focused EPG facade/deferred/coordinator
  tests passed; focused `EPGShellView`, `EPGFocusNavigator`, and
  `EPGGridRuntimeController` tests passed; implementation review reran the six
  EPG suites with `178` tests passing; `npm run verify` passed; controller
  closeout `npm run plans:check`, `npm run verify:docs`, and `git diff --check`
  passed.
- Follow-ups: none yet.
- Handoff: DCR-14 is closed. DCR-15 is now also closed. Do not resume
  `DCR-EXIT-S2` until `DCR-16` is complete or explicitly maintainer-routed out
  of DCR.

### [x] `DCR-15` Player, Plex Runtime, Settings, And Media Contracts

- Status: completed
- Plan:
  `docs/plans/2026-05-01-dcr-15-player-plex-runtime-settings-media-contracts-plan.md`
- Dimensions/rubric tags: code quality, duplication, naming quality, error
  consistency, authorization consistency, type safety, incomplete migration
- Scope owner: player/runtime, Plex stream/library, settings boundary, and
  persistence owners
- Known issues to retire:
  - actual issues:
    - `DCR-15-A1`: `F-S0L02-002` `RetryManager` cannot remove active metadata
      retry listeners during unload/destroy.
    - `DCR-15-A2`: `S0-L03-F02` persistence warning backoff policy is
      duplicated across lifecycle and `ChannelManager`.
    - `DCR-15-A3`: `S0-L03-F03` native text-track debug snapshot is copied in
      `VideoPlayer` and `SubtitleManager`.
    - `DCR-15-A4`: `S0-L03-F04` HDR10 fallback mode precedence is repeated.
    - `DCR-15-A5`: `S0-L06-NQ-001` `PlaybackRecoveryManager` reset method name
      hides burn-in state reset.
    - `DCR-15-A6`: `S0-L07-001` best-effort Plex cleanup/debug auth failures
      can surface as global user errors.
    - `DCR-15-A7`: `S0-L15-F1` Plex identity metadata has two live owners with
      divergent device names.
    - `DCR-15-A8`: `TS-001` Plex library media parsers cast external payloads
      without required scalar validation.
- Completion means: runtime/listener cleanup, settings/Plex policy duplication,
  error-boundary behavior, identity ownership, and parser validation are fixed
  or split with one owner and proof.
- Verification routing: RetryManager/VideoPlayer, SubtitleManager,
  HDR10/settings resolver, cleanup/debug 401/403, Plex identity, parser
  scalar-validation tests, typecheck, then `npm run verify`.
- Ready-now execution unit: none; package complete.
- Stop/replan triggers: auth/session ownership changes, stream error contract
  changes, media parsing policy requires API redesign, or package scope needs
  multiple disjoint plans.
- Last touched: 2026-05-01
- Verification: clean plan review; clean implementation reviews for
  `DCR-15-S1` through `DCR-15-S8`; focused DCR-15 Jest suites passed during
  implementation/review; final `npm run typecheck`, `npm run verify`,
  `npm run plans:check`, `npm run verify:docs`, and `git diff --check` passed.
- Follow-ups: none yet.
- Handoff: DCR-15 is closed. DCR-16 is now also closed; resume with a fresh
  `DCR-EXIT` cleanup-loop session for `DCR-EXIT-S2`.

### [x] `DCR-16` Production Source-Signal Residue

- Status: completed
- Plan: `docs/plans/2026-05-01-dcr-16-production-source-signal-residue-plan.md`
- Dimensions/rubric tags: AI-generated debt, code signal, low-level elegance
- Scope owner: code-signal owner with app-shell, scheduler, navigation, and UI
  reviewers
- Known issues to retire:
  - actual issues:
    - `DCR-16-A1`: `S0-L10-F4` production hot-path files still carry
      generated-style step and trivial method comments after code-signal cleanup
      was marked complete.
- Completion means: source-signal residue is removed or source-disproved through
  behavior-neutral edits and search proof without changing runtime behavior.
- Verification routing: targeted source search, behavior-neutral diff audit,
  `git diff --check`, and typecheck/tests only if code moves.
- Completion evidence: `DCR-16-A1` / `S0-L10-F4` closed by the approved
  `DCR-16-S1` behavior-neutral comment-only cleanup. The source pass removed
  generated-style step narration, duplicate file/class banners, trivial method
  JSDoc, and obvious DOM/pool/action narration from the approved 19 production
  files without changing code tokens, imports/exports, signatures, selectors,
  CSS, storage keys, event names, tests, or runtime order. Remaining source
  search matches are source-disproved as retained contract, platform,
  security/token/logging, lifecycle, focus/accessibility, public API,
  persistence, Plex, or runtime invariant commentary.
- Ready-now execution unit: none; package complete.
- Stop/replan triggers: cleanup requires behavior changes, signatures move, or
  overlaps with source files still being actively changed by `DCR-12` through
  `DCR-15`.
- Last touched: 2026-05-01
- Verification: clean plan review, closure check, and fresh final plan approval;
  clean implementation review; targeted post-search and bounded all-family
  audit left only retained/source-disproved comment categories; source diff was
  deletion-only and comment-only across the approved 19 files; `git diff
  --check`, `npm run plans:check`, and `npm run verify:docs` passed. `npm run
  verify` was skipped because the package changed no executable code, UI/
  navigation/orchestrator/Plex runtime tokens, selectors, CSS runtime
  declarations, tests, imports/exports, storage keys, or Plex auth/library/
  stream behavior.
- Follow-ups: none yet.
- Handoff: DCR-16 is closed. Start the next fresh cleanup-loop session for
  `DCR-EXIT-S2`; do not perform DCR-EXIT package proof reconciliation inside
  DCR-16.

### [x] `DCR-EXIT` Dimension Cleanup Exit Gate

- Status: completed
- Plan: `docs/plans/2026-04-30-dcr-exit-final-dimension-audit-plan.md`
- Dimensions/rubric tags: final reconciliation, full rubric coverage,
  source-backed proof, test confidence, dependency/config/tooling health,
  player/runtime coverage, portability residuals, docs/control-plane coherence
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
  - dependency/config/tooling/app metadata surfaces required by the active plan
  - source/test files only for read-only reconciliation unless a final package
    explicitly reopens implementation
- Files out of scope:
  - fresh Desloppify scan/queue import as task intake
  - external/manual score refresh; maintainer may run it after DCR exit closes,
    but it is not a DCR-EXIT execution slice or blocker
  - future Windows/Electron port implementation
- Known issues to retire:
  - actual issues:
    - `DCR-EXIT-A0`: run a comprehensive final source-backed dimension audit
      before package reconciliation, using Desloppify objective/subjective
      dimensions as rubric only and requiring an audit matrix/findings ledger
      with no unowned follow-ups.
    - `DCR-EXIT-A1`: reconcile every DCR package and prove all actual issues
      are fixed, source-disproved, or explicitly reclassified with evidence.
    - `DCR-EXIT-A2`: confirm all owner decisions have one recorded outcome,
      owner, and revisit trigger if accepted.
    - `DCR-EXIT-A3`: verify current architecture/API docs still match source
      after DCR changes.
  - owner decisions:
    - `DCR-EXIT-D1`: external/manual by maintainer after exit closeout. It may
      inform retrospective notes but is out of DCR-EXIT execution and must not
      reopen the checklist by itself.
  - accepted residuals:
    - `FCP-6` future-port residual remains explicit: real Windows/Electron
      shell, real device Plex, native media, and manual integration proof belong
      to the future-port owner and are not DCR source cleanup blockers.
- Completion means: all `DCR-1` through `DCR-16` packages are completed. Any
  unresolved work must already be handled inside a completed package as an
  individual issue/residual disposition or as a maintainer-approved migration
  out of DCR with named destination, owner, revisit trigger, and non-blocker
  rationale. Source-backed final reconciliation finds no unowned same-area
  residue; docs/current-state are accurate; required verification and clean
  closeout review are recorded.
- Verification routing: source-backed DCR reconciliation audit, package-local
  static/source audits for old patterns, strongest relevant package
  verification already run, final `npm run verify`, and `npm run verify:docs`.
  `npm run plans:check` applies while the active plan is the handoff surface.
  External/manual score refresh is maintainer-owned after this gate closes.
- Ready-now execution unit: none; `DCR-EXIT` is complete.
- Suggested slice table / wave candidates:

  | Slice | Candidate goal | Write scope | Parallel policy |
  | --- | --- | --- | --- |
  | `DCR-EXIT-S0` | comprehensive source-backed dimension audit | complete; local controller artifacts summarized in the active plan | complete |
  | `DCR-EXIT-S1` | route S0 findings into checklist packages/residuals/source-disproves | checklist/plan/docs only | serial; no production/test implementation |
  | `DCR-EXIT-S2` | package proof matrix reconciliation | checklist/plans/docs read/write | serial after `DCR-11` through `DCR-16` close |
  | `DCR-EXIT-S3` | owner-decision ledger reconciliation | checklist/plans/docs read/write | serial after S2 |
  | `DCR-EXIT-S4` | architecture/API/current-state doc reconciliation | docs + source audit | serial after S3 |
  | `DCR-EXIT-S5` | final verification, adversarial review, checklist closeout | checklist/docs only unless replanned | serial after S4 |

- Stop/replan triggers: any DCR package has open actual issues; source audit
  finds new same-area production residue not owned by a package; docs conflict
  with source; security issue appears; a finding lacks final owner/revisit
  trigger; score refresh output is treated as task intake.
- Last touched: 2026-05-01
- Verification: S0 audit artifacts recorded in local controller run storage and
  summarized in the completed plan; `DCR-EXIT-S1` routing review approved with
  no material findings; DCR-11 through DCR-16 package closeout evidence was
  reconciled in the completed DCR-EXIT package proof matrix; owner decisions
  were reconciled in the completed owner-decision ledger; docs/source truth was
  reconciled with the only stale plan-state contradiction corrected in the
  archived DCR-10 plan and the stale DCR-EXIT S2 handoff removed from the
  active plan. Final `npm run plans:check`, `npm run verify:docs`, `npm run
  verify`, and `git diff --check` passed. Final adversarial priority-exit
  closure review was clean after stale historical S2 wording was corrected.
- Follow-ups: none inside DCR. `DCR-EXIT-D1` remains external/manual
  maintainer-owned after closeout and must not block or reopen DCR by itself.
  Future-port residuals remain owned by the port/test owner as above.
- Handoff: no further DCR cleanup-loop session is required. Do not run a fresh
  scoring-only pass as DCR closeout work.

## FCP Baseline History

The six `FCP-*` priorities below produced real improvements and are preserved
as baseline evidence. They were too conservative and narrow for the intended
production cleanup finish. Do not choose historical `FCP-1` through `FCP-6` or
the legacy `FCP-EXIT` anchor as the next active cleanup-loop package unless a
maintainer explicitly reopens that history; use completed `FCP-7` through
`FCP-12` above as baseline instead.

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
  `FCP-3`; later DCR routing superseded this old follow-up.

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
  next priority was `FCP-4`; later DCR routing superseded this old follow-up.

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
  `FCP-6`; later DCR routing superseded this old follow-up.

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
  Historical next step was `FCP-EXIT`, but that was superseded by the completed
  DCR refresh and then by the active `FCP-7` through `FCP-12` final cleanup
  pass. Do not start this legacy `FCP-EXIT` unless a maintainer explicitly
  reopens the old FCP baseline.

### [x] `FCP-EXIT` Superseded FCP Exit Anchor

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
- Status: retired historical anchor
- Plan: none; replaced by completed `DCR-EXIT` and completed `FCP-12` final
  reconciliation
- Last touched: 2026-05-01
- Verification: superseded by completed DCR-EXIT verification; not rerun for
  this retained historical anchor
- Follow-ups: final cleanup completed in `FCP-7` through `FCP-12`.
- Handoff: retained as a historical anchor only. Do not start this legacy
  `FCP-EXIT`; use the completed `FCP-7` through `FCP-12` records above as
  baseline evidence.

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
