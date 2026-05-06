# Architecture Cleanup Checklist

> Live cleanup control plane.

This checklist is the compact control plane for production cleanup. It replaces
the old score-chasing P14 wave loop as the active execution surface. Completed
P0-P13, superseded P14 wave details, and completed FCP packages remain
historical context in package maps, plans, commits, and archived summaries; they
should not drive the next cleanup task by default.

## Fresh-Session Handoff

- Current execution state: P0-P13, FCP-1 through FCP-23, DCR-1 through DCR-16,
  and DCR-EXIT are complete baseline evidence. `FCP-22` has broadened
  owner-shape closeout evidence after its reopened replan. The old P14 wave
  ledger is superseded for current decision-making because repeated residual
  waves did not create meaningful score progress and kept expanding the active
  control plane. Fresh post-FCP verification and the retrospective subjective
  review are rubric context only, not active package intake or closeout proof.
- Next safe start: `FCP-24` planning is the next final port-foundation cleanup
  package after completed `FCP-23`; no implementation starts until an
  execution-grade plan passes review and selects a ready-now unit. `FCP-25`,
  Windows port work, or other post-FCP cleanup may start only after the
  preceding FCP package has clean closeout evidence. No
  separate `FCP-EXIT` is part of the normal future queue; legacy `FCP-EXIT`
  remains retired unless a maintainer explicitly reopens it.
- Preferred launcher: `cleanup-loop` for approved checklist-linked Tier 3
  cleanup packages. `FCP-25` is a final review gate intended for a
  `lineup-cleanup-review` agent.
- Active program: `Final Cleanup Pass` (`FCP-24` through `FCP-25`) below. The
  completed `FCP-7` through `FCP-23`, DCR, and historical FCP records are
  retained baseline evidence, not the next task queue.
- Desloppify role: rubric input and retrospective final-gate refresh only. The
  active FCP packages below are admitted by maintainer judgment from
  current-source review themes; do not use fresh Desloppify output as concrete
  issue intake, task admission, execution-unit membership, proof of closure, or
  wave sequencing. In `FCP-25`, any Desloppify scan/review refresh is delegated
  to a worker subagent as retrospective baseline input only.

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

The `FCP-7` through `FCP-21` packages are completed baseline evidence before
remaining Windows port-foundation work. Fresh post-FCP verification and
retrospective subjective review remain rubric context only; they are not issue
intake, package membership, proof of closure, or wave sequencing. The remaining
active packages below were admitted as maintainer-approved source-audit themes
and use only local `source_finding_id` coverage.

The final port-foundation pass starts at `FCP-21`. It replaces no completed
evidence; it reshapes the active queue into larger runtime, scheduler, UI,
package-organization, and final-review packages. The goal is not score chasing;
it is to retire remaining maintainability risks that would make future platform
work harder to reason about. Reopened `FCP-22` must apply that goal to the full
scheduler/channel/content owner shape before `FCP-23` resumes.

First completed baseline summary:

| Package | Completed owner surface | Baseline role |
| --- | --- | --- |
| `FCP-7` | Boundary and type hygiene | Historical evidence only |
| `FCP-8` | API, Plex, and error contracts | Historical evidence only |
| `FCP-9` | Source signal, convention, and local elegance | Historical evidence only |
| `FCP-10` | EPG renderer tests and presentation decomposition | Historical evidence only |
| `FCP-11` | Runtime owner reduction hotspots | Historical evidence only |
| `FCP-12` | App-shell/orchestrator package organization and first-pass reconciliation | Historical evidence only |

A compact `FCP-7` through `FCP-20` baseline remains below for audit trail and
closeout evidence. These are not active work queues unless a future
source-backed replan explicitly reopens one.

### FCP Operating Rules

- Treat each unchecked `FCP-*` row below as one checklist-linked package for
  `cleanup-loop`.
- Use `source_finding_id` coverage in FCP plans. For example, `FCP-7-SF1` is a
  valid source-backed finding id for `FCP-7`.
- Do not copy external review ids, detector ids, package-map ids, score deltas,
  or raw tool output into FCP package membership, proof, or closeout.
- A package plan may source-audit and reclassify listed findings, but it may not
  close by fixing only one symptom while same-package findings remain unowned.
- FCP source audits must ask whether the touched owner has the correct shape for
  the package goal, not only whether a narrow historical symptom is still live.
  `source-disproved` or no-code disposition is valid only when the original
  source concern is false and the same owner area is not still structurally
  wrong in a way that would recreate recurring cleanup work.
- Large-package execution and review should retire coherent batches or waves,
  not one tiny fix at a time. Reviewers should ask whether the approved batch
  closes the named owner seam rather than approving isolated micro-fixes while
  same-package source findings remain active.
- Prefer behavior-preserving extraction, type/API contract cleanup, and direct
  tests over broad rewrites. If a listed large refactor becomes speculative
  after source review, reclassify it with one final owner and revisit trigger
  rather than forcing churn.
- Do not defer an FCP correction solely because the required improvement is
  larger than the first slice. If the correction stays inside one package owner
  boundary and has a stable proof surface, plan it as a coherent wave or serial
  execution unit. If it crosses owners, behavior, or verification envelopes,
  stop/replan with maintainer approval, one final owner, and a revisit trigger.
- Hotspot packages must close the original source concern, not just reduce line
  count or extract one helper. Before closeout, the package audit must state
  whether the original mixed-responsibility finding still describes current
  source. If yes, continue the package or record an accepted owner/revisit
  trigger; if no, close with source proof.
- Recurring debt signals in files touched by an FCP package are audit prompts to
  verify the owner shape, not raw Desloppify intake. The package must translate
  any admitted work into current-source findings, owner seams, and closure
  conditions before implementation.
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

### FCP-7 Through FCP-12 Completed Baseline Summary

`FCP-7` through `FCP-12` are complete and retained as compact baseline
evidence. The detailed package bodies were condensed because they no longer
serve as live cleanup-loop work queues. Reopen any item only with current-source
proof, a local `source_finding_id`, one owner seam, and a reviewed plan.

| Package | Completed baseline evidence | Closeout proof retained |
| --- | --- | --- |
| `FCP-7` | Boundary/type hygiene across server-select, architecture rules, debug now-playing ports, channel setup config/workflow predicates, navigation channel-switch outcomes, and closed event-map typing. | Plan `docs/plans/2026-05-02-fcp-7-boundary-type-hygiene-plan.md`; commits `611b73e8`, `d51791ef`, and `59f35d72`; targeted server-select, architecture-rule, debug/orchestrator, channel setup, navigation, and event-owner tests plus `npm run typecheck`, `git diff --check`, and `npm run verify` passed; no follow-ups recorded. |
| `FCP-8` | API, Plex, and error contracts aligned: object-shaped timeout helper, `ChannelCreateOptions` contract alignment, distinct Plex media item names, sanitized Plex auth causes, Home endpoint helper, Plex library pagination helper, and shared channel setup warning detail formatter. | Plan `docs/plans/2026-05-02-fcp-8-api-plex-error-contract-coherence-plan.md`; commits `b18d23c9`, `65ba1bf1`, `508d52aa`, and `5e548a92`; focused Plex shared/library/auth/stream, ChannelManager, and channel setup warning/import tests plus `npm run typecheck`, `git diff --check`, `npm run verify`, and `npm run verify:docs` passed; no follow-ups recorded. |
| `FCP-9` | Source-signal and convention cleanup: now-playing stylesheet seam, architecture docs path/truth updates, redundant selected comments pruned, and native facet planning moved to descriptor-driven structure. | Plan `docs/plans/2026-05-02-fcp-9-source-signal-convention-local-elegance-plan.md`; style/import audits, runtime token style contracts, CSS lint, targeted channel setup tests, `npm run plans:check`, `npm run verify:docs`, `npm run typecheck`, `git diff --check`, and final `npm run verify` passed; no follow-ups recorded. |
| `FCP-10` | EPG renderer direct confidence and presentation decomposition: `EPGCellPresentation.ts` owns text/layout/presentation policy, `EPGCellRenderer.ts` stays the DOM adapter, and direct tests cover width tiers, slivers, focused layouts, live/progress, and ticker timing. | Plan `docs/plans/2026-05-02-fcp-10-epg-renderer-direct-confidence-presentation-decomposition-plan.md`; commits `2cc71d56` and `37b0871f`; `EPGCellRenderer` and `EPGVirtualizer` tests, source audits, `npm run typecheck`, `git diff --check`, and `npm run verify` passed; clean implementation reviews closed. |
| `FCP-11` | Runtime owner hotspot reduction: server-select runtime/focus/status owners, channel setup session/focus/dropdown/build-step owners, ChannelManager authoring/import/persistence/cache/retry owners, and priority-one forwarding collapse with owner-value seams preserved. | Plan `docs/plans/2026-05-02-fcp-11-runtime-owner-reduction-hotspots-plan.md`; proof commits `d56a13ca`, `aefbbfd0`, `606ad0ae`, `42d93a9d`, `6ed9d0c6`, `f02cc0a1`, and `51c60d02`; targeted slice tests, `npm run typecheck`, `npm run verify:architecture`, `git diff --check`, final `npm run verify`, and `npm run verify:docs` passed; no follow-ups recorded. |
| `FCP-12` | Package organization and reconciliation: app-shell and orchestrator moved into focused owner folders with no root barrels/shims, architecture docs updated, and `FCP-7` through `FCP-12` source findings reconciled. | Plan `docs/plans/2026-05-02-fcp-12-package-organization-structure-navigation-final-exit-plan.md`; commits `bf87a345` and `0a1c64af` plus closeout; old/replacement folder audits, no-barrel/no-shim audits, `npm run plans:check`, `npm run verify:docs`, `npm run typecheck`, `git diff --check`, and final `npm run verify` passed; historical closeout pointed to `FCP-13`. |

Important `FCP-7` through `FCP-12` baseline facts retained for future audits:

- Server-select shared display/state types, debug-owned now-playing refresh
  ports, canonical channel setup config/workflow helpers, shared
  `ChannelSwitchOutcome`, and closed shared event-map typing are accepted
  baseline truth.
- Plex auth, stream, library, timeout, pagination, and warning-detail helper
  contracts from `FCP-8` are baseline truth unless current-source audit proves
  drift.
- EPG renderer presentation ownership and direct test confidence from `FCP-10`
  are baseline proof for any later EPG cleanup.
- Runtime owner reductions from `FCP-11` and package organization from
  `FCP-12` should not be reopened by size or folder preference alone.
- `FCP-12` historical closeout pointed to `FCP-13`; `FCP-13` through
  `FCP-22` are now completed and compacted below. Current next safe start is
  `FCP-23`.

### FCP-13 Through FCP-20 Completed Baseline Summary

The previous active queue is complete and compacted here because several of its
late packages were too small for cleanup-loop planning overhead. These records
remain closeout evidence and port-readiness baseline context; they are not live
checklist membership for remaining `FCP-22` through `FCP-25` work unless the
new package source audit proves a current residual. Local `source_finding_id`
coverage remains the only accepted package-membership language.

| Package | Completed baseline evidence | Closeout proof retained |
| --- | --- | --- |
| `FCP-13` | Low-risk source signal, channel-manager export, Plex auth doc contract, obsolete architecture exceptions, subtitle diagnostics, abort-wrapper removal, EPG duplicate clearing, and `StrategyStepController` local helper cleanup. | Plan `docs/plans/2026-05-05-fcp-13-low-risk-source-signal-api-export-diagnostic-closure-plan.md`; commits `117206d4`, `e650740b`, `eb924084`, `4d27965c`, `8a3f2470`, and `eb19ba7f`; targeted source audits/tests, `npm run plans:check`, `npm run verify:docs`, `npm run typecheck`, `git diff --check`, and `npm run verify` passed; fresh implementation reviews closed clean. |
| `FCP-14` | Priority-one no-value forwarding collapse while preserving owner-value assembly seams. | Plan `docs/plans/2026-05-05-fcp-14-priority-one-forwarding-assembly-seam-plan.md`; commits `f9d16061`, `ddc49e95`, and `fd74c705`; targeted priority-one/orchestrator tests, source audits, `npm run plans:check`, `npm run verify:docs`, `git diff --check`, and `npm run verify` passed; fresh plan and implementation reviews closed clean. |
| `FCP-15` | PlexAuth Home endpoint, profile switch, and status classification moved into auth-local Home/profile client while credential, token, PIN, persistence, and events stayed in `PlexAuth`. | Plan `docs/plans/2026-05-05-fcp-15-plexauth-home-profile-status-helper-boundary-plan.md`; commit `3c92127a`; targeted Plex auth/Home/profile/initialization tests, source audits, `npm run plans:check`, `npm run verify:docs`, `git diff --check`, and `npm run verify` passed; fresh reviews closed clean. |
| `FCP-16` | Current-channel persistence semantics clarified as explicit best-effort pointer persistence; `ChannelManager` retained the public facade and delegated current-channel persistence coordination without broader extraction. | Plan `docs/plans/2026-05-05-fcp-16-scheduler-current-channel-channelmanager-persistence-semantics-plan.md`; commit `d74f88c3`; targeted channel persistence/facade tests, storage key/schema audits, `npm run plans:check`, `npm run verify:docs`, `git diff --check`, and `npm run verify` passed; fresh reviews closed clean. |
| `FCP-17` | `ContentResolver` kept the scheduler orchestration entrypoint while cache/coalescing, Plex item mapping, media normalization, filtering, sorting, and playback ordering moved to package-local owners. | Plan `docs/plans/2026-05-05-fcp-17-contentresolver-cache-coalescing-mapping-boundaries-plan.md`; commits `43bbd179` and `0343b591`; targeted ContentResolver/channel-manager tests, mixed-source cache invalidation proof, source audits, `npm run plans:check`, `npm run verify:docs`, `git diff --check`, and `npm run verify` passed; review follow-up closed. |
| `FCP-18` | Navigation package behavior-neutral organization into focused current-owner folders with public package seam preserved and no shims/barrels/export widening. | Plan `docs/plans/2026-05-05-fcp-18-behavior-neutral-navigation-package-organization-plan.md`; commit `55761660`; old/replacement path audits, navigation/orchestrator tests, architecture path-truth updates, `npm run plans:check`, `npm run verify:docs`, `git diff --check`, and `npm run verify` passed; review closed clean. |
| `FCP-19` | Plex stream package behavior-neutral organization into focused current-owner folders with public seam preserved and no playback, token/redaction, auth, subtitle, diagnostic, URL-policy, shim, barrel, or export widening changes. | Plan `docs/plans/2026-05-05-fcp-19-behavior-neutral-plex-stream-package-organization-plan.md`; commit `9504a3bd`; old/replacement path audits, Plex stream/policy/HDR/session/error/fetch/docs tests, API/architecture/subtitle path-truth updates, `npm run plans:check`, `npm run verify:docs`, `git diff --check`, and `npm run verify` passed; review follow-ups closed. |
| `FCP-20` | Pre-Windows cleanup exit reconciled `FCP-13` through `FCP-19`, reran source/`rg` audits, recorded no active residuals, and kept the ChannelSetupScreen candidate deferred outside `FCP-20` coverage. | Plan `docs/plans/2026-05-05-fcp-20-pre-windows-cleanup-exit-source-reconciliation-plan.md`; source-finding proof matrix and residual owner ledger recorded; `npm run plans:check`, `npm run verify:docs`, `git diff --check -- ARCHITECTURE_CLEANUP_CHECKLIST.md`, and `npm run verify` passed; final review approved closeout. |

Baseline carry-forward into `FCP-24` through `FCP-25`:

- `FCP-13` through `FCP-23` are complete. New active packages may only reopen
  current-source residuals, source-disproved baseline gaps, or port-readiness
  contract gaps that fit their owner seam.
- The old deferred ChannelSetupScreen candidate was absorbed into completed
  `FCP-23`; `ChannelSetupScreen` now stays the screen shell/step-router while
  `ChannelSetupWorkflowPresenter` owns Step 2 workflow/presenter glue, preset
  stepping, dropdown handoff, and build presenter wiring.
- Priority-one, PlexAuth, current-channel persistence, ContentResolver,
  navigation organization, and Plex stream organization closeout evidence is
  baseline proof. New work in those areas must start with a current-source
  residual audit rather than assuming the old finding is still live.
- Raw Desloppify, detector, review, or external issue ids remain invalid as
  checklist membership. Use only package-local `source_finding_id` coverage.

### [x] `FCP-21` Port Runtime, Playback, And Plex Auth Readiness

- Status: completed
- Plan: `docs/plans/2026-05-05-fcp-21-port-runtime-playback-plex-auth-readiness-plan.md`
- Dimensions/rubric tags: runtime contracts, playback portability, Plex
  integration, authorization consistency, API surface coherence, test strategy,
  cross-module architecture
- Scope owner: runtime/playback/Plex auth port-foundation owner
- Why this package exists / production risk: Windows/Plex-HTPC-style port work
  needs playback and auth contracts that are explicit, centrally owned, and
  directly testable. `FCP-14` and `FCP-15` are completed baseline evidence;
  this package activates only current-source residuals or port-readiness gaps
  that remain after that evidence.
- Files in scope:
  - `src/modules/player/**`
  - `src/core/orchestrator/**` only for runtime/playback assembly seams proven
    by the package audit
  - `src/modules/plex/auth/**`
  - `src/modules/plex/shared/**`
  - `src/modules/plex/stream/**` only for token/header or playback contract
    audits that are directly required by this package
  - affected playback, Plex auth/shared/stream, and orchestrator tests
  - architecture/API docs only when current source truth changes
- Files out of scope:
  - Windows platform implementation
  - Plex discovery/library feature behavior
  - scheduler/channel-manager/content-resolution cleanup owned by `FCP-22`
  - channel setup, EPG, navigation, or UI workflow cleanup owned by `FCP-23`
  - behavior-neutral foldering owned by `FCP-24`
  - token redaction, persisted credential, PIN, profile-switch, stream URL, or
    playback behavior changes unless a source-backed replan and maintainer
    approval explicitly admit them
- Source findings to audit/retire:
  - `FCP-21-SF1`: `IVideoPlayer` async rejection and failure-reporting
    contracts need source-backed clarity before port work. Align docs/types and
    direct tests so callers know which async playback methods reject, resolve,
    or report through events, without changing product behavior unless replanned.
  - `FCP-21-SF2`: `UniversalTranscodeDecisionClient` needs direct coverage or a
    source-backed no-code disposition that proves enough port confidence for
    universal transcode decision behavior.
  - `FCP-21-SF3`: Plex token/header ownership should be centralized around a
    canonical helper or owner for `X-Plex-Token` or equivalent header/query
    assembly, without changing token redaction, token value flow, auth policy,
    stream URL semantics, or observable requests.
  - `FCP-21-SF4`: priority-one runtime/assembly follow-through is active only
    if current-source audit after completed `FCP-14` proves no-value forwarding,
    runtime contract ambiguity, or ownership residue remains.
  - `FCP-21-SF5`: PlexAuth Home/profile/status follow-through is active only if
    current-source audit after completed `FCP-15` proves auth-local boundary
    residue or port-readiness contract ambiguity remains.
- Completion means: every listed finding is resolved, source-disproved, or
  accepted with one owner and revisit trigger; playback async contracts are
  explicit and tested or source-justified; universal transcode decisions have
  direct confidence or a documented proof surface; Plex token/header assembly
  has one owner or a source-backed accepted reason; completed `FCP-14` and
  `FCP-15` baselines are not reopened without current-source proof.
- Verification routing: Codanna impact snapshots for touched playback,
  priority-one, Plex auth, and Plex token/header symbols; package-local `rg`
  audits for old/replacement async contract and token/header patterns; targeted
  playback/Plex/orchestrator tests; `npm run typecheck`; `git diff --check`;
  `npm run verify`; `npm run plans:check` and `npm run verify:docs` when a
  tracked plan or docs change.
- Completed execution unit: `FCP-21-W1` (`FCP-21-S1`, `FCP-21-S2`,
  `FCP-21-S3`), with `FCP-21-S4` and `FCP-21-S5` closed as no-code
  source-disproved dispositions.
- Suggested slice/wave table:

  | Slice | Candidate goal | Write scope | Parallel policy |
  | --- | --- | --- | --- |
  | `FCP-21-S1` | playback async contract and direct port-confidence tests | player contracts/runtime/tests | serial first |
  | `FCP-21-S2` | universal transcode decision direct coverage | Plex stream/shared decision files/tests | may run after S1 if disjoint |
  | `FCP-21-S3` | Plex token/header owner centralization audit and cleanup | Plex shared/auth/stream token/header files/tests | auth-sensitive; serial with S4/S5 |
  | `FCP-21-S4` | priority-one residual audit after `FCP-14` | priority-one/orchestrator files/tests only if source-proven | no-code disposition allowed |
  | `FCP-21-S5` | PlexAuth residual audit after `FCP-15` | Plex auth files/tests only if source-proven | no-code disposition allowed |

- Stop/replan triggers: any public playback behavior changes; auth token,
  redaction, PIN, credential epoch, persisted key/schema, profile-switch,
  stream URL, or request-order behavior changes; source audit needs scheduler,
  UI workflow, or package-organization work; direct tests require private
  probing instead of public seam proof; completed `FCP-14` or `FCP-15` evidence
  appears source-false.
- Closeout proof matrix:

  | Source finding | Disposition | Proof |
  | --- | --- | --- |
  | `FCP-21-SF1` | resolved | `IVideoPlayer` now states the existing async reject/resolve/event-reporting contract; direct `VideoPlayer` / `VideoPlayerEvents` tests cover playback rejection and seek behavior without runtime behavior changes. |
  | `FCP-21-SF2` | resolved | `UniversalTranscodeDecisionClient` has direct constructor-seam tests for request conversion, decision URL conversion with existing query preservation, auth failure passthrough, non-ok handling, timeout, and XML/fallback parsing. |
  | `FCP-21-SF3` | resolved | `src/modules/plex/shared/plexUrl.ts` owns reusable `X-Plex-Token` header reads and query application; approved Plex/player/discovery/playback-options callers route through the canonical helper without request-shape, redaction, auth, stream URL, or UI behavior changes. |
  | `FCP-21-SF4` | source-disproved | Priority-one runtime/assembly audit found no distinct live no-value forwarding, contract ambiguity, or ownership residue beyond completed `FCP-14`; no priority-one code was changed. |
  | `FCP-21-SF5` | source-disproved | PlexAuth Home/profile/status audit found no distinct live auth-local boundary residue beyond completed `FCP-15`; no PlexAuth Home/profile code was changed. |

- Last touched: 2026-05-05
- Verification: `npm run plans:check` passed; `npm run verify:docs` passed;
  package source audits for playback async contracts, universal transcode
  decisions, token/header helpers, priority-one follow-through, and PlexAuth
  Home/profile follow-through passed; targeted playback/Plex/orchestrator tests
  passed; `npm run typecheck` passed; `git diff --check` passed; full
  verification passed (`npm run verify`); final implementation review for
  commit `646451ad` reported no blocking findings.
- Follow-ups: none.
- Handoff: `FCP-22` is the next safe start. Do not start `FCP-23` through
  `FCP-25`, Windows work, or other post-FCP cleanup until `FCP-22` has its own
  clean closeout evidence.

### [x] `FCP-22` Port Scheduler, Channel, And Content Readiness

- Status: completed
- Reopen note: maintainer direction reopened this package for broadened
  owner-shape source audit and replan. The reopened pass closed as a
  no-production-change owner-shape evidence unit after clean plan and evidence
  reviews.
- Plan: `docs/plans/2026-05-05-fcp-22-port-scheduler-channel-content-owner-shape-replan.md`
  is the completed broadened closeout plan. The older
  `docs/plans/2026-05-05-fcp-22-port-scheduler-channel-content-readiness-plan.md`
  remains completed partial evidence only.
- Dimensions/rubric tags: scheduler design, persistence ownership, content
  resolution, API surface coherence, package organization, test strategy,
  portability readiness
- Scope owner: scheduler/channel-manager/content-resolution port-foundation owner
- Why this package exists / production risk: Windows port work needs scheduler,
  channel, and content-resolution seams that keep persistence semantics,
  facade ownership, cache/coalescing, and mapping boundaries understandable.
  `FCP-16` and `FCP-17` are completed baseline evidence; this package activates
  only current-source residuals or port-readiness gaps that remain after that
  evidence. The reopened pass must judge whether the whole touched owner shape
  is correct for port-foundation maintenance, not only whether the first narrow
  symptom or helper extraction was completed.
- Files in scope:
  - `src/modules/scheduler/channel-manager/**`
  - scheduler/channel-manager tests affected by persistence, facade,
    content-resolution, or package organization cleanup
  - architecture/API docs only when current source truth changes
- Files out of scope:
  - public ChannelManager facade removal
  - public channel API widening without maintainer approval
  - persistence schema or storage-key changes without replan
  - Plex auth/runtime/playback cleanup owned by `FCP-21`
  - channel setup, EPG, navigation, or UI workflow cleanup owned by `FCP-23`
  - behavior-neutral organization outside scheduler/channel-manager unless
    routed through `FCP-24`
  - Windows platform implementation
- Source findings to audit/retire:
  - `FCP-22-SF1`: current-channel persistence semantics follow-through is
    active only if current-source audit after completed `FCP-16` proves strict
    versus best-effort ambiguity, storage warning drift, or port-readiness
    contract residue remains.
  - `FCP-22-SF2`: `ChannelManager` facade-local ownership cleanup may continue
    only inside the public facade seam. The package must not remove the public
    facade; it may extract or confirm package-local owners when current source
    proves facade responsibilities are still concentrated in a way that blocks
    port reasoning.
  - `FCP-22-SF3`: ContentResolver cache/coalescing/mapping boundaries
    follow-through is active only if current-source audit after completed
    `FCP-17` proves cache, in-flight, mapping, normalization, filtering,
    sorting, or playback-ordering residue remains.
  - `FCP-22-SF4`: channel-manager package organization is allowed only when it
    naturally reduces port risk while implementing or proving `FCP-22-SF1`
    through `FCP-22-SF3`; no foldering-only churn unless source audit proves it
    reduces navigation/review risk for the same owner seam.
- Completion means: scheduler/channel-manager persistence and content seams are
  resolved, source-disproved, or accepted with one owner and revisit trigger;
  the public ChannelManager facade remains stable; any owner extraction stays
  facade-local or package-local; no storage schema/key drift occurs; package
  organization happens only when tied to the source-proven port-readiness seam.
  No-code/source-disproved dispositions are allowed only if the current-source
  audit proves the same scheduler/channel-manager/content owner is not still
  structurally wrong in a way that would cause recurring cleanup passes.
- Verification routing: Codanna impact snapshots for `ChannelManager`, current
  channel persistence, `ContentResolver`, and touched collaborators;
  package-local `rg` audits for persistence method names, old/residual content
  owner patterns, and imports if files move; targeted channel-manager,
  persistence, content-resolution, cache/coalescing, mapping, and error-semantics
  tests; `npm run typecheck`; `git diff --check`; `npm run verify`; `npm run
  plans:check` and `npm run verify:docs` when a tracked plan or docs change.
- Completed execution unit: `FCP-22-W1` (`FCP-22-S1`, `FCP-22-S2`,
  `FCP-22-S3`, `FCP-22-S4`) closed as a no-production-change owner-shape
  evidence unit. The prior narrow pass is retained as partial source evidence;
  the reopened pass re-audited the whole scheduler/channel/content owner shape
  and found no source/test implementation wave required.
- Closeout proof matrix:

  | Source finding | Disposition | Proof |
  | --- | --- | --- |
  | `FCP-22-SF1` | source-disproved | Current-channel persistence remains explicit best-effort pointer persistence through `ChannelPersistenceCoordinator.persistCurrentChannelIdBestEffort`, with storage mechanics in `ChannelPersistenceStore`, normalized load semantics in `ChannelRepository`, unchanged server/user key scoping through `OrchestratorStorageContext`, unchanged key/schema values, warning behavior preserved, and targeted persistence tests passed. |
  | `FCP-22-SF2` | source-disproved | `ChannelManager` remains the public facade and its retained FCP-22 responsibilities are source-justified as public state transition, event emission, duration filtering, empty-content taxonomy, cache fallback, access-denied invalidation, and retry/cache coordination. Persistence, content resolution, retry timer, mapping, selection, shared ordering, and resolved-content cache owners remain package-local or scheduler-shared; no public facade removal or API widening was source-proven. |
  | `FCP-22-SF3` | source-disproved | `SourceResolutionCache`, `ContentItemMapper`, `ContentSelectionPolicy`, `ContentResolver`, `ChannelResolutionCache`, `ScheduleCalculator`, and `src/modules/scheduler/shared/playbackOrdering.ts` retain the owner split required for port reasoning. The prior playback-ordering residue remains resolved by `playbackOrdering.ts`; random mode remains content-selection-local; scheduler injected shuffler wiring remains in `ScheduleCalculator`; `ContentResolver`'s TV show-list cache fallback and `ChannelManager`'s cache/error/retry responsibilities are explicitly retained with final owners and revisit triggers. |
  | `FCP-22-SF4` | source-disproved | No standalone channel-manager package organization was source-proven in the broadened pass. Source/path/export audits found no need for shims, root barrels, old-path wrappers, or public export widening. Later behavior-neutral channel-manager organization, if source-proven, remains owned by `FCP-24-SF3`. |
- Ready-now execution unit: completed.
- Suggested slice/wave table:

  | Slice | Candidate goal | Write scope | Parallel policy |
  | --- | --- | --- | --- |
  | `FCP-22-S1` | current-channel persistence residual audit and contract proof | channel persistence files/tests | serial first; no-code allowed |
  | `FCP-22-S2` | ChannelManager facade-local ownership cleanup | ChannelManager/collaborators/tests | after S1 unless disjoint proof exists |
  | `FCP-22-S3` | ContentResolver residual audit and owner proof | ContentResolver/collaborators/tests | may run as separate wave if disjoint |
  | `FCP-22-S4` | channel-manager organization only if naturally required | scheduler/channel-manager paths/imports/docs/tests | only after S1-S3 source audit justifies it |

- Stop/replan triggers: persistence schema/key migration is needed; public
  channel API widens; public facade removal becomes necessary; Plex auth/stream
  behavior changes; UI workflow behavior changes; ContentResolver sorting,
  filtering, playback ordering, or error taxonomy changes without explicit
  contract approval; organization work creates shims, root barrels, or public
  export widening.
- Last touched: 2026-05-05
- Verification: broadened replan `npm run plans:check` passed;
  `npm run verify:docs` passed; package source audits for current-channel
  persistence, content owner split, playback-ordering ownership, public
  export/import surface, and storage key/schema passed; targeted persistence
  tests passed (`npm test -- ChannelPersistenceStore ChannelRepository
  ChannelManager.persistence ChannelManager.transactional
  ChannelPersistenceSaveQueue`); targeted content/scheduler tests passed
  (`npm test -- ContentResolver ScheduleCalculator
  ChannelManager.content-resolution`); targeted error/cache tests passed
  (`npm test -- ChannelManager.error-semantics ChannelResolutionCache`);
  `npm run typecheck` passed; `git diff --check` passed; full verification
  passed (`npm run verify`); clean final plan review and clean FCP-22-W1
  evidence review reported no blocking findings.
- Follow-ups: none for FCP-22.
- Handoff: `FCP-23` is the next safe start after refreshed plan review. Do not
  start `FCP-24`, `FCP-25`, Windows work, or other post-FCP cleanup until
  `FCP-23` has clean closeout evidence.

### [x] `FCP-23` Port UI Workflow Readiness

- Status: completed
- Blocked by: none
- Plan: `docs/plans/2026-05-05-fcp-23-port-ui-workflow-readiness-plan.md`
  completed after `FCP-23-W1` implementation and clean review.
- Dimensions/rubric tags: UI workflow portability, focus behavior, design
  coherence, channel setup ownership, EPG presentation, interaction lifecycle,
  test strategy
- Scope owner: channel setup and EPG UI workflow port-foundation owner
- Why this package exists / production risk: Windows/Plex-HTPC-style app work
  will likely preserve channel setup and live-TV workflows conceptually, even if
  the UI shell changes. ChannelSetupScreen therefore belongs in the active
  queue now, with a portable workflow/presenter/interaction extraction rather
  than a deferred candidate.
- Files in scope:
  - `src/modules/ui/channel-setup/**`
  - `src/core/channel-setup/**` only for portable workflow concepts or contracts
    directly required by channel setup UI extraction
  - `src/core/app-shell/**` only for selected-server projection or lazy-screen
    port audits directly required by channel setup UI extraction
  - `src/modules/ui/epg/view/**`
  - `src/modules/ui/epg/component/**` only if EPG view organization naturally
    follows from presentation cleanup
  - affected channel setup UI/core/app-shell and EPG tests
  - architecture docs only when current source truth changes
- Files out of scope:
  - Windows platform implementation
  - visual redesign or product behavior changes
  - scheduler/channel-manager/content-resolution cleanup owned by `FCP-22`
  - Plex runtime/playback/auth cleanup owned by `FCP-21`
  - standalone package foldering owned by `FCP-24`
  - selected-server persistence schema/key changes
  - broad EPG virtualizer or scheduler data model changes
- Source findings to audit/retire:
  - `FCP-23-SF1`: `ChannelSetupScreen` needs a source-backed portable
    wizard/presenter/interaction extraction so channel setup workflow concepts,
    build/progress presentation, dropdown/session lifecycle, and focus
    delegation are not locked to one TV/webOS-specific screen implementation.
  - `FCP-23-SF2`: `StrategyStepController` descriptor/schema cleanup
    follow-through is active only if current-source audit after completed
    `FCP-13` proves residual structural repetition or schema ambiguity remains.
  - `FCP-23-SF3`: EPGCellRenderer duplicate/presentation follow-through is
    active only if current-source audit after completed `FCP-10` and `FCP-13`
    proves duplicate presentation, text-layout, ticker, or DOM-adapter residue
    remains.
  - `FCP-23-SF4`: EPG view organization is allowed only if it naturally follows
    from UI workflow/presentation cleanup; no foldering-only churn unless the
    source audit proves current layout blocks portable presentation review.
- Completion means: ChannelSetupScreen either delegates portable wizard,
  presenter, interaction, session, and focus concepts to focused owners or the
  plan records a source-backed no-code disposition with one owner and revisit
  trigger; StrategyStepController and EPG presentation residuals are resolved,
  source-disproved, or accepted; TV/webOS-specific assumptions are separated
  from portable workflow concepts where source-proven; no user-visible flow,
  focus, dropdown, build, selected-server, or EPG behavior changes land without
  replan and proof.
- Verification routing: Codanna impact snapshots for `ChannelSetupScreen`,
  `StrategyStepController`, `EPGCellRenderer`, and touched workflow/presenter
  symbols; targeted channel setup UI/session/build/focus/dropdown tests;
  selected-server projection source audit; targeted EPG renderer/view tests;
  focus and lifecycle source audits; `npm run typecheck`; `git diff --check`;
  `npm run verify`; `npm run plans:check` and `npm run verify:docs` when a
  tracked plan or docs change.
- Completed execution unit: `FCP-23-W1` (`FCP-23-S1` through `FCP-23-S4`).
- Source-finding closeout:

  | Source finding | Disposition | Evidence |
  | --- | --- | --- |
  | `FCP-23-SF1` | resolved | `ChannelSetupScreen` remains the screen shell, visibility lifecycle owner, library renderer, and step router. `ChannelSetupWorkflowPresenter` now owns Step 2 workflow/presenter glue, preset stepping, dropdown handoff, and build presenter wiring without public API widening, selected-server storage access, or TV-visible behavior changes. |
  | `FCP-23-SF2` | source-disproved | Current Step 2 descriptors and keyboard/dropdown interaction ownership remain in `StrategyStepInteractionController`; `StrategyStepController` remains render-focused after `FCP-13`, and targeted Step 2 tests passed. |
  | `FCP-23-SF3` | source-disproved | `EPGCellPresentation.ts` remains the pure presentation helper owner; `EPGCellRenderer.ts` remains the DOM/ticker lifecycle adapter; EPG virtualizer behavior and renderer tests stayed unchanged. |
  | `FCP-23-SF4` | source-disproved for FCP-23 | No EPG organization change was naturally required by the FCP-23 presentation audit. Later behavior-neutral EPG organization remains owned by `FCP-24-SF4` only if source-proven. |
- Ready-now execution unit: completed.
- Suggested slice/wave table:

  | Slice | Candidate goal | Write scope | Parallel policy |
  | --- | --- | --- | --- |
  | `FCP-23-S1` | ChannelSetupScreen portable workflow/presenter extraction plan and first owner split | channel setup UI/core/app-shell tests as needed | serial first; focus-sensitive |
  | `FCP-23-S2` | channel setup interaction/session/dropdown/focus lifecycle closure | channel setup UI session/interaction files/tests | serial with S1 unless plan proves disjoint |
  | `FCP-23-S3` | StrategyStepController residual audit and cleanup | strategy step controller/tests | may run after S1 if disjoint |
  | `FCP-23-S4` | EPG renderer/presentation residual audit and cleanup | EPG view files/tests | separate wave if no channel setup overlap |
  | `FCP-23-S5` | EPG view organization only if naturally required | EPG view paths/imports/docs/tests | only after S4 source audit justifies it |

- Stop/replan triggers: focus behavior changes; build flow or progress/review
  semantics change; dropdown/session lifecycle ownership becomes ambiguous;
  selected-server projection or persistence behavior changes; UI extraction
  creates competing lifecycle owners; TV/webOS-specific assumptions are removed
  instead of isolated from portable workflow concepts; EPG DOM shape, ticker,
  reduced-motion, virtualizer, or layout behavior changes; tests require private
  probing instead of public seam proof.
- Last touched: 2026-05-05
- Verification: targeted channel setup, workflow presenter, app-shell
  port-factory, Strategy Step, and EPG renderer/view tests passed; selected
  server, workflow-port, Strategy Step, EPG presentation, and EPG package seam
  audits passed; `npm run typecheck`, `git diff --check`, `npm run verify`,
  `npm run plans:check`, and `npm run verify:docs` passed.
- Follow-ups: none for FCP-23.
- Handoff: `FCP-24` planning is the next safe start. Do not start `FCP-25`,
  Windows work, or other post-FCP cleanup until `FCP-24` has clean closeout
  evidence.

### [ ] `FCP-24` Behavior-Neutral Package Organization

- Status: not started
- Plan: none yet
- Dimensions/rubric tags: package organization, structure navigation,
  cross-module architecture, dependency health, convention drift, portability
  readiness
- Scope owner: final behavior-neutral package organization owner
- Why this package exists / production risk: after `FCP-21` through `FCP-23`,
  a small number of package-organization follow-through items may still improve
  port reviewability. This package exists only if source audits prove those
  organization changes remain valuable after the earlier port-foundation
  packages; it should be skipped or source-disproved rather than used for
  foldering-only churn.
- Files in scope:
  - `src/modules/navigation/**` only for source-proven follow-through after
    completed `FCP-18`
  - `src/modules/plex/stream/**` only for source-proven follow-through after
    completed `FCP-19`
  - `src/modules/scheduler/channel-manager/**` only if not handled by `FCP-22`
  - `src/modules/ui/epg/**` only if not handled by `FCP-23`
  - affected tests and architecture/API docs for moved paths
- Files out of scope:
  - behavior changes of any kind
  - compatibility shims, old-path wrappers, root barrels, subfolder barrels, or
    public export widening unless a maintainer explicitly approves
  - public API, persistence schema/key, token/redaction, playback, scheduler,
    navigation, EPG, channel setup, or platform policy changes
  - Windows platform implementation
- Source findings to audit/retire:
  - `FCP-24-SF1`: navigation package organization follow-through is active only
    if current-source audit after completed `FCP-18` proves residual path,
    owner, or reviewability risk remains.
  - `FCP-24-SF2`: Plex stream package organization follow-through is active
    only if current-source audit after completed `FCP-19` proves residual path,
    owner, or reviewability risk remains.
  - `FCP-24-SF3`: channel-manager package organization is active only if not
    naturally handled by `FCP-22` and current-source audit proves it reduces
    port risk without public facade churn.
  - `FCP-24-SF4`: EPG view package organization is active only if not naturally
    handled by `FCP-23` and current-source audit proves it reduces UI workflow
    or presentation review risk.
- Completion means: each candidate organization finding is resolved,
  source-disproved, skipped as not valuable with one owner/revisit trigger, or
  completed behavior-neutrally; no shims, barrels, public export widening, or
  behavior changes land without maintainer approval; path-truth docs match any
  moved source.
- Verification routing: Codanna impact snapshots for moved symbols;
  package-local old/replacement path `rg` audits; targeted tests affected by
  imports; public export surface audit; `npm run typecheck`; `git diff
  --check`; `npm run verify`; `npm run plans:check` and `npm run verify:docs`
  when a tracked plan or docs change.
- Ready-now execution unit: none until plan is written.
- Suggested slice/wave table:

  | Slice | Candidate goal | Write scope | Parallel policy |
  | --- | --- | --- | --- |
  | `FCP-24-S1` | post-`FCP-21..23` source audit and no-code skip/proceed decision | checklist/plan/audit artifacts | serial first |
  | `FCP-24-S2` | navigation/Plex stream follow-through only if source-proven | navigation and/or Plex stream paths/tests/docs | parallel only if disjoint and approved |
  | `FCP-24-S3` | channel-manager/EPG organization only if not already handled | scheduler and/or EPG paths/tests/docs | parallel only if disjoint and approved |
  | `FCP-24-S4` | path/import reconciliation and closeout | touched packages/docs/checklist | serial closeout |

- Stop/replan triggers: source audit shows no organization value after
  `FCP-21` through `FCP-23`; any shim, root barrel, subfolder barrel, or public
  export widening appears necessary; imports moves change behavior; path-truth
  docs require broader architecture decisions; package organization overlaps an
  unresolved runtime, scheduler, or UI workflow owner seam.
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: next safe start after completed `FCP-23`. A planner must write and
  review an execution-grade plan before implementation; ready-now remains none
  until that plan selects a coherent wave or records a source-backed no-code
  disposition.

### [ ] `FCP-25` Final Port Gate

- Status: not started
- Plan: none yet
- Dimensions/rubric tags: verified strictness, docs/source coherence, residual
  ownership, port planning readiness, review quality, test strategy
- Scope owner: final port-gate review owner for read-only review evidence;
  cleanup-loop controller owns final checklist/docs recording after clean review
- Why this package exists / production risk: after `FCP-21` through `FCP-24`,
  the project needs a final evidence gate before Windows port planning starts.
  This is a review package, not a new cleanup intake queue. It must be runnable
  by a `lineup-cleanup-review` agent and may use a worker subagent only for the
  retrospective Desloppify scan/review refresh. The review agent does not own
  checklist or docs mutation; after clean review, the cleanup-loop controller
  records the final proof matrix, ledger, verification results, and handoff.
- Files in scope:
  - `ARCHITECTURE_CLEANUP_CHECKLIST.md` `FCP-25` and `FCP-21` through `FCP-24`
    closeout evidence for read-only review; final checklist recording is
    controller-owned after clean review
  - tracked `FCP-21` through `FCP-24` plans and audit artifacts if they exist
  - `docs/architecture/CURRENT_STATE.md`, `docs/architecture/modules.md`, and
    API/development docs updated by `FCP-21` through `FCP-24`
  - read-only source audits over areas touched by `FCP-21` through `FCP-24`
  - worker-produced retrospective Desloppify scan/review refresh summary, if
    the review agent delegates it
- Files out of scope:
  - new production implementation work
  - new checklist intake from Desloppify, detector, or raw review ids
  - creating `FCP-26` without separate maintainer admission of a source-proven
    blocker
  - Windows port implementation
- Source findings to audit/retire:
  - `FCP-25-SF1`: final proof matrix must prove every `FCP-21` through
    `FCP-24` source finding is resolved, source-disproved, accepted with one
    owner/revisit trigger, or explicitly deferred to the Windows port owner.
  - `FCP-25-SF2`: residual owner ledger must name one owner, reason, and
    revisit trigger for every accepted/deferred residual from `FCP-21` through
    `FCP-24`.
  - `FCP-25-SF3`: source audits must confirm completed package baselines and
    path/API/docs truth for runtime/playback/Plex auth, scheduler/channel/content,
    UI workflow, and package organization seams.
  - `FCP-25-SF4`: final gate must record exact passed commands:
    `npm run verify`, `npm run verify:docs`, `npm run plans:check`, and
    `git diff --check`.
  - `FCP-25-SF5`: Windows port planning handoff must be explicit: next owner,
    safe start conditions, port assumptions, accepted residuals, and blockers.
  - `FCP-25-SF6`: Desloppify scan/review refresh is retrospective baseline only
    and must be run by a worker subagent if used. It cannot create `FCP-26` or
    become checklist intake unless a maintainer separately admits a
    source-proven blocker.
- Completion means: a `lineup-cleanup-review` agent has reviewed `FCP-25` plus
  `FCP-21` through `FCP-24` closeout evidence and produced clean review-output
  evidence; after that clean review, the cleanup-loop controller records the
  proof matrix, residual owner ledger, source audits, exact verification
  command results, and Windows port planning handoff in checklist/docs as
  needed. Any worker Desloppify refresh is explicitly retrospective; no new
  active cleanup package is created without maintainer admission.
- Verification routing: exact commands required before closeout are
  `npm run verify`, `npm run verify:docs`, `npm run plans:check`, and
  `git diff --check`. Also run package-local source/`rg` audits for `FCP-21`
  through `FCP-24` proof claims and review the tracked plan/audit artifacts.
  The Desloppify scan/review refresh, if requested by the review agent, is
  delegated to a worker subagent and recorded only as retrospective baseline
  context.
- Ready-now execution unit: none until `FCP-21` through `FCP-24` closeout
  evidence exists.
- Suggested slice/wave table:

  | Slice | Candidate goal | Write scope | Parallel policy |
  | --- | --- | --- | --- |
  | `FCP-25-S1` | review `FCP-21` through `FCP-24` proof matrix and source audits | checklist/plans/audit artifacts | serial review owner |
  | `FCP-25-S2` | worker Desloppify scan/review refresh | retrospective worker artifact only | worker subagent allowed; no intake |
  | `FCP-25-S3` | final verification command evidence and residual ledger review output | review-output evidence only; cleanup-loop controller records checklist/docs after clean review | serial review then controller closeout |
  | `FCP-25-S4` | Windows port planning handoff review output | review-output evidence only; cleanup-loop controller records checklist and port-planning handoff artifact if approved | serial review then controller final gate |

- Stop/replan triggers: `FCP-21` through `FCP-24` evidence is incomplete;
  residuals lack one owner or revisit trigger; source audits disprove a closeout
  claim; required verification fails; Desloppify/review refresh is treated as
  checklist intake; a source-proven blocker needs maintainer admission before it
  can become a new package; Windows port handoff cannot name safe start
  conditions.
- Last touched: not started
- Verification: not run
- Follow-ups: none yet
- Handoff: final active package after `FCP-24`. Run with a
  `lineup-cleanup-review` agent; delegate only the retrospective Desloppify
  scan/review refresh to a worker subagent if useful. The review agent produces
  evidence only; the cleanup-loop controller performs any final checklist/docs
  recording after clean review. After closeout, Windows port planning may start
  only from the recorded handoff and residual ledger.

## Dimension Cleanup Refresh History

The `DCR-*` packages, `DCR-EXIT`, and legacy `FCP-1` through `FCP-6` records are
completed history. They remain baseline evidence and rubric context, not active
package intake. Reopen any historical item only with current-source proof,
maintainer approval, a local source-backed package id, one final owner, and a
reviewed plan.

### DCR Completed Baseline Summary

DCR packages were seeded from deep source review findings, not a Desloppify
queue. The accepted DCR baselines remain: `src/App.ts` is acceptable as an
app-shell composition root; Settings focus extraction is closed; `EPGVirtualizer`
is a bounded performance owner; Plex token redaction/security remains protected;
`window.close()` in `ExitConfirmCoordinator` is intentional webOS behavior; and
`ChannelSetupSessionState` importing `normalizeChannelSetupConfig` remains an
accepted residual unless setup-record normalization ownership changes.

| Package | Completed baseline evidence | Closeout proof retained |
| --- | --- | --- |
| `DCR-1` | Scheduler and ChannelManager transactional/API semantics: replace-all rollback, non-`Error` import summarization, reorder contract, and `loopSchedule` decision. | Plan `docs/archive/plans/2026-04-29-dcr-1-scheduler-channel-manager-api-semantics.md`; commit `12a5647d`; targeted ChannelManager/scheduler tests, source audits, `npm run typecheck`, and `npm run verify` passed; review closed after one P3 nit fix. |
| `DCR-2` | Channel setup UI persistence/runtime contract: selected-server persistence moved behind app-shell/core ports, failure semantics and string error shape decided, accepted normalization import retained. | Plan `docs/archive/plans/2026-04-29-dcr-2-channel-setup-ui-persistence-runtime-contract.md`; commit `fe7ec675`; targeted channel setup/app-shell/core tests, `npm run typecheck`, `npm run verify`, and `npm run verify:docs` passed; only accepted residual is the normalization import owner/revisit trigger. |
| `DCR-3` | Event subscription and error import coherence: public `on()` methods return `IDisposable`, Plex library interface matches implementation, and production `AppErrorCode` imports use the canonical type owner. | Plan `docs/archive/plans/2026-04-29-dcr-3-event-subscription-error-import-coherence.md`; commits `53b57edb`, `25a3e2f9`, and `d274fa74`; targeted event/interface and import audits/tests, `npm run typecheck`, `npm run verify`, and `npm run verify:docs` passed. |
| `DCR-4` | EPG defaults/constants coherence: canonical row-height/default config ownership resolved with tests. | Plan `docs/archive/plans/2026-04-29-dcr-4-epg-defaults-constants-coherence.md`; commit `0b1dce57`; targeted EPG/app-shell config tests, source audits, and full verification passed. |
| `DCR-5` | Navigation FocusManager correctness/tests: focus behavior and navigation contracts clarified with focused coverage. | Plan `docs/archive/plans/2026-04-29-dcr-5-navigation-focusmanager-correctness-and-tests.md`; commits `ceee655a` and `42245764`; targeted navigation/focus tests and full verification passed. |
| `DCR-6` | AppOrchestrator narrow API and file-health cleanup: app/orchestrator seams reduced without broad app-shell behavior changes. | Plan `docs/archive/plans/2026-04-29-dcr-6-app-orchestrator-api-file-health.md`; commits `aa199687` and related DCR-6 follow-ups including `8e9f4e81`; targeted orchestrator/runtime tests and full verification passed after review follow-up. |
| `DCR-7` | Channel setup facet loader/executor confidence and abstraction: loader/executor cache, progress, concurrency, cancellation, and fixture cleanup were resolved. | Plan `docs/archive/plans/2026-04-29-dcr-7-channel-setup-facet-loader-executor.md`; commits `0139258e` and related follow-ups including `cb0f0691`; targeted channel setup facet tests and full verification passed after review follow-up. |
| `DCR-8` | Plex stream resolver ownership: typed policy readers and subtitle-debug logging port injection, stream-local subtitle debug probe coordinator, and `UniversalTranscodeDecisionClient` extraction. | Plan `docs/archive/plans/2026-04-30-dcr-8-plex-stream-resolver-ownership-cleanup.md`; commits `1cb3bb7f`, `cbfb833f`, and `7f616597`; targeted resolver/probe/debug-manager tests, token/logging audits, `npm run typecheck`, and `npm run verify` passed; token redaction/security retained as protected baseline. |
| `DCR-9` | Lifecycle migration and comment/API cleanup: `MIGRATIONS` kept package-internal and lifecycle comments compressed while storage/phase/save invariants stayed visible. | Plan `docs/archive/plans/2026-04-29-dcr-9-lifecycle-migration-comment-api-cleanup.md`; commits `900c96fb`, `bd25e51d`, and `58a63db6`; targeted lifecycle tests, source audits, `npm run typecheck`, and `npm run verify` passed. |
| `DCR-10` | Oversized test suite structure policy: ChannelManager transactional/import/error/stale-fallback coverage split into focused files; SettingsScreen dependency/constructor tests moved to deps-focused seams. | Plan `docs/archive/plans/2026-04-30-dcr-10-oversized-test-suite-structure.md`; commits `ff01fcce` and `713f6a21`; targeted ChannelManager and Settings/AppLazyScreenRegistry suites, `npm run typecheck`, `npm run verify`, and docs closeout verification passed. |
| `DCR-11` | Verification, dependency, and control-plane truth: stale docs and style cleanup artifacts retired, dependency advisories cleared, and bundle guard residual accepted. | Plan `docs/plans/2026-04-30-dcr-11-verification-dependency-control-plane-truth.md`; `npm run plans:check`, `npm run verify:docs`, `npm run lint:css`, `npm ls --depth=0`, and `npm audit --audit-level=high` passed; `verify:bundle` size failure accepted under release/bundle guard owner, and stylelint strictness remains dependency/config/tooling residual. |
| `DCR-12` | App-shell, startup, and server-selection contracts: `AppOrchestrator` responsibility reduced, Plex PIN cancellation fixed, selected-server storage-key exposure replaced with projected state, and channel-switch outcomes carried through startup/guide routing. | Plan `docs/plans/2026-04-30-dcr-12-app-shell-startup-server-selection-contracts.md`; targeted orchestrator, Plex auth cancellation, server-selection/app-shell, initialization/channel-switch, and EPG tests plus `npm run plans:check`, `npm run verify:docs`, and `npm run verify` passed; no follow-ups. |
| `DCR-13` | Scheduler, ChannelManager, and test architecture: ChannelManager save/import owners extracted, catch-all tests split, shuffle seed validation unified, test factories deduplicated, and private `_queueSave` probe removed. | Plan `docs/plans/2026-04-30-dcr-13-scheduler-channelmanager-test-architecture.md`; commits `add1fedd`, `e1af8d67`, `34bdaf9a`, and `edaa07f4`; targeted tests, source/test-health audits, `npm run plans:check`, `npm run verify:docs`, and `npm run verify` passed. |
| `DCR-14` | EPG component file-health follow-through: shell DOM/ARIA/banner moved to `EPGShellView`, focus/navigation to `EPGFocusNavigator`, and timer/listener/grid runtime to `EPGGridRuntimeController`; no visual panel treatment changed. | Plan `docs/plans/2026-04-30-dcr-14-epg-component-file-health-follow-through.md`; focused EPG tests, source/design audits, `npm run verify`, `npm run plans:check`, `npm run verify:docs`, and `git diff --check` passed; accepted visual/design residual remains outside cleanup-agent scope. |
| `DCR-15` | Player, Plex runtime, settings, and media contracts: retry listener cleanup, persistence warning backoff, native text-track debug snapshot, HDR10 precedence, burn-in reset naming, Plex cleanup/debug 401/403 handling, Plex identity ownership, and parser scalar validation closed. | Plan `docs/plans/2026-05-01-dcr-15-player-plex-runtime-settings-media-contracts-plan.md`; clean reviews for `DCR-15-S1` through `DCR-15-S8`; focused Jest suites, `npm run typecheck`, `npm run verify`, `npm run plans:check`, `npm run verify:docs`, and `git diff --check` passed. |
| `DCR-16` | Production source-signal residue: behavior-neutral comment-only cleanup across approved production files, with remaining comments source-disproved as contract/platform/security/lifecycle/focus/API/persistence/Plex/runtime rationale. | Plan `docs/plans/2026-05-01-dcr-16-production-source-signal-residue-plan.md`; targeted post-search audits, deletion-only/comment-only diff proof, `git diff --check`, `npm run plans:check`, and `npm run verify:docs` passed; `npm run verify` skipped because executable tokens and runtime surfaces did not change. |
| `DCR-EXIT` | Final dimension cleanup reconciliation across DCR packages, owner-decision ledger, docs/source truth, and future-port residuals. | Plan `docs/plans/2026-04-30-dcr-exit-final-dimension-audit-plan.md`; S0 artifacts summarized, DCR package proof matrix and owner ledger reconciled, final `npm run plans:check`, `npm run verify:docs`, `npm run verify`, and `git diff --check` passed; external/manual score refresh remains maintainer-owned and non-blocking. |

### Legacy FCP-1 Through FCP-6 Baseline Summary

The first six `FCP-*` priorities produced useful cleanup but were superseded by
completed DCR and later FCP passes. They should not be chosen as active
cleanup-loop packages unless a maintainer explicitly reopens the old baseline.

| Package | Completed baseline evidence | Closeout proof retained |
| --- | --- | --- |
| `FCP-1` | Architecture and handoff coherence: app-shell/server-selection result ownership, channel setup screen workflow port, and priority-one assembly ownership clarified. | Archived plan/audit in git history; commits `75b59c4f`, `23effad7`, `2326562f`, `f2b33f28`, and `05b6cf8`; targeted audits/tests, `npm run verify`, and `npm run verify:docs` passed. Accepted residual: `ChannelSetupSessionState` normalization import owner/revisit trigger. |
| `FCP-2` | Runtime contracts and failure semantics: channel authoring failures enforced before state publish/persist/emit, import failures structured, and fallback behavior preserved. | Archived plan/audit in git history; commit `239b3db5`; targeted ChannelManager tests, source audits, contracts rerun after one exit-139 retry, final `npm run verify`, and `npm run verify:docs` passed; no deferred source findings admitted. |
| `FCP-3` | Focused design coherence: Settings screen focus graph/key/dropdown restoration moved to `SettingsScreenFocusCoordinator`; rendering/state/lifecycle stayed in `SettingsScreen`. | Archived plan/audit in git history; commit `22847d97`; targeted settings tests, source audits, cleanup-worker `npm run verify`, and final `npm run verify` passed. Deferred/no-action owners stayed with EPG, Plex stream, scheduler, channel setup UI, and priority-one owners. |
| `FCP-4` | AI-generated residue and code signal: scheduler restating comments compressed, invariant comments preserved, and unused `ShuffleResult`/barrel export removed. | Archived plan/audit in git history; commit `f9eca40b`; source audits, scheduler tests, `npm run typecheck`, `npm run verify`, `git diff --check`, `git diff --cached --check`, and `npm run verify:docs` passed; residual comment/API owners recorded. |
| `FCP-5` | Portability readiness: lifecycle state persistence routed through optional-storage helpers while webOS, browser API, native media, filesystem absence, and Plex token/security assumptions were owner-classified. | Archived plan/audit in git history; commit `2f54311e`; focused `StateManager` tests, raw-storage audit, `npm run typecheck`, `npm run verify`, `npm run verify:docs`, and `git diff --check` passed. Future port owners retain Windows/Electron shell, media, filesystem, and security revisit triggers. |
| `FCP-6` | Test confidence for the port: `ExitConfirmCoordinator` tests added for modal/accessibility/focus/Cancel/Exit-to-Home/window-close/cleanup behavior; other port-critical paths accepted as existing coverage or future-port proof. | Archived plan/audit in git history; commit `ef09466b`; focused exit-confirm tests, `npm run typecheck`, `npm run verify`, `npm run verify:docs`, and `git diff --check` passed. `FCP-6-SF11` remains future-port test owner work for real Windows/Electron shell, device Plex, native media, and manual integration proof. |
| `FCP-EXIT` | Legacy exit anchor retired and superseded by completed `DCR-EXIT`, `FCP-12`, and the current `FCP-22` through `FCP-25` active program. | Retained historical anchor only; do not start legacy `FCP-EXIT` without maintainer reopening. |

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
active `FCP-23` through `FCP-25` packages, or through a maintainer-approved
source-backed package after the final port gate closes with a named owner seam,
proof surface, and reviewed plan.
