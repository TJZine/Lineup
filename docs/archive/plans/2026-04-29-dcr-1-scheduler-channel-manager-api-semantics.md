# DCR-1 Scheduler And ChannelManager Transactional/API Semantics

**Plan Status:** completed
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

## Goal

Retire `ARCHITECTURE_CLEANUP_CHECKLIST.md` package `DCR-1` by making the
ChannelManager replacement, import, and reorder contracts truthful, and by
removing the unsupported scheduler `loopSchedule` config surface.

The implementation must resolve every listed DCR-1 issue or owner decision:

- `DCR-1-A1`: `replaceAllChannels` transactional behavior.
- `DCR-1-A2`: `importChannels` non-`Error` throwable formatting.
- `DCR-1-D1`: `reorderChannels` exact full-order API decision.
- `DCR-1-D2`: `ScheduleConfig.loopSchedule` keep/remove/document decision.

## Non-Goals

- Do not redesign `ChannelPersistenceStore` or `ChannelRepository`.
- Do not change content resolver policy.
- Do not change UI channel setup flows except compile/test fixture edits caused
  by the scheduler API cleanup.
- Do not start `DCR-2`, `DCR-EXIT`, or unrelated DCR work.
- Do not close the checklist row during implementation; checklist closeout
  remains controller-owned after implementation and review.

## Parent Architecture Alignment

This plan advances the scheduler/channel-manager owner called out in
`ARCHITECTURE_CLEANUP_CHECKLIST.md` and preserves the current architecture
truth from `docs/architecture/CURRENT_STATE.md`: `src/modules/scheduler/` owns
scheduling behavior, shuffle logic, channel domain flows, and channel-domain
persistence remains behind `ChannelPersistenceStore` with `ChannelRepository` as
a thin consumer wrapper.

`ChannelManager.ts` is a listed hotspot, so the implementation should fix the
contract defects in place without growing it into a broader persistence,
content-resolution, or UI policy owner.

## Required Reading

Read in this order before implementation:

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/cleanup-loop.md`
4. `ARCHITECTURE_CLEANUP_CHECKLIST.md`
   - DCR Operating Rules
   - full `DCR-1` section
   - `DCR-10` test-structure section
5. `docs/agentic/plan-authoring-standard.md`
6. `docs/agentic/codanna-playbook.md`
7. `docs/architecture/CURRENT_STATE.md`
8. This plan.

## Required Skills

- `architecture-boundaries`
- `persistence-boundaries`
- `verification-strategy`
- `execution-plan-authoring`

Use `bounded-worker-execution` only if the controller later proves a different
plan with disjoint write scopes and verification surfaces. This plan does not
approve parallel cleanup_worker execution.

## Codanna Discovery

Codanna MCP/tools were unavailable in the planning context; no Codanna namespace
or callable Codanna tools were exposed. Fallback discovery used `rg`, direct
source reads, and targeted impact-style searches, as required by
`docs/agentic/codanna-playbook.md`.

Fallback evidence:

- `rg -n "reorderChannels\\(" src --glob '!src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts'`
  found no production caller beyond the interface and implementation.
- `rg -n "loopSchedule" src docs ARCHITECTURE_CLEANUP_CHECKLIST.md` found
  production code only writing `loopSchedule: true`; scheduler internals do not
  read the field.
- `rg -n "summarizeErrorForLog|Failed to import channel|importChannels" src docs`
  confirmed the repo error summarizer is already imported in `ChannelManager.ts`
  and that `importChannels` is the local bad seam.
- Direct reads covered the scoped ChannelManager, scheduler, repository/store,
  tests, current architecture, DCR-1, and DCR-10 surfaces.

If Codanna becomes available in the implementation session, rerun
`semantic_search_with_context` for `ChannelManager replaceAllChannels
reorderChannels`, `search_documents` for `DCR-1 Scheduler ChannelManager`, and
`analyze_impact` for the `IChannelManager` and `ScheduleConfig` symbols before
editing. Treat contradictory results as a freshness gate and replan if they show
new runtime consumers or owners.

## Impact Snapshot

Source-backed findings that shape the plan:

- `ChannelManager.replaceAllChannels` currently clears caches and mutates
  `_state` before `_persistCurrentStateNow()` can throw. This contradicts the
  interface claim that the replacement is atomic.
- `replaceAllChannels` current-channel-key persistence is best-effort warning
  behavior today. DCR-1 requires rollback on failed channel-data save, not a
  broader policy change to make current-channel-key writes fatal.
- `ChannelManager.importChannels` catches `unknown` and formats
  `(e as Error).message`, producing `undefined` for non-`Error` throwables.
- `ChannelManager.reorderChannels` filters the caller's ids down to known ids
  and assigns the filtered list, which drops omitted channels.
- No production code currently calls `reorderChannels`; the public API seam can
  be tightened without discovered UI behavior drift.
- `ScheduleConfig.loopSchedule` is a public type field that tests and
  `OrchestratorSchedulePolicy` populate with `true`, while `ChannelScheduler`
  and `ScheduleCalculator` do not read it. Scheduler looping is inherent in the
  modulo/loop-duration calculations.
- `ChannelManager.test.ts` is oversized. DCR-10 explicitly says new
  transactional/reorder/error coverage must not be absorbed into that catch-all
  file without a split policy.

## Files In Scope

- `src/modules/scheduler/channel-manager/ChannelManager.ts`
- `src/modules/scheduler/channel-manager/interfaces.ts`
- focused new tests under `src/modules/scheduler/channel-manager/__tests__/`
- `src/modules/scheduler/channel-manager/__tests__/ChannelManager.test.ts`
  only for minimal fixture relocation if unavoidable; do not add DCR-1 cases
  there
- `src/modules/scheduler/scheduler/types.ts`
- `src/modules/scheduler/scheduler/interfaces.ts`
- `src/modules/scheduler/scheduler/ChannelScheduler.ts`
- `src/modules/scheduler/scheduler/ScheduleCalculator.ts` only for API comments
  or loop-invariant documentation if needed
- `src/modules/scheduler/scheduler/__tests__/ChannelScheduler.test.ts`
- `src/modules/scheduler/scheduler/__tests__/ScheduleCalculator.test.ts`
- adjacent `ScheduleConfig` consumers/tests found by source audit, including
  `src/core/orchestrator/OrchestratorSchedulePolicy.ts` and typed fixtures in
  core/UI tests
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` only for controller-owned plan linkage or
  later closeout

## Files Out Of Scope

- broad channel persistence store redesign
- content resolver policy not required by the listed DCR-1 issues
- UI channel setup flows except tests that consume public channel-manager
  behavior
- DCR-2
- DCR-EXIT
- unrelated DCR-10 Settings work

## Planner Self-Check

1. Unresolved architecture seam? No. ChannelManager remains the channel API
   owner; scheduler owns `ScheduleConfig`; persistence stays behind the current
   repository/store boundary.
2. Adjacent contract changes hidden out of scope? No. `ScheduleConfig`
   consumers are explicitly in scope for `loopSchedule` removal.
3. Out-of-scope files implicitly required? No. UI flows are out of scope unless
   typed tests need fixture cleanup from the scheduler type change.
4. Codanna evidence path recorded? Yes. Codanna was unavailable and fallback
   `rg`/direct-read evidence is recorded.
5. Repo-preferred owner? Yes. Work stays in scheduler/channel-manager owners and
   avoids widening hotspots.
6. Would a fresh session invent policy? No. Reorder and `loopSchedule`
   decisions are resolved below.
7. Execution-grade? Yes. Package issues map to slices, with verification and
   stop/replan triggers fixed.

## Architecture Seam Decision Gate

Decision `DCR-1-D1`: `reorderChannels` requires an exact full order.

- Input must contain every existing channel id exactly once.
- Input must not contain unknown ids.
- Input must not contain duplicates.
- Invalid input throws a `ChannelError` using
  `AppErrorCode.STORAGE_VALIDATION_FAILED`, leaves order unchanged, and does
  not queue persistence.
- Partial reorder is unsupported until a separate public API is designed.

Decision `DCR-1-D2`: `ScheduleConfig.loopSchedule` is dead/speculative API.

- Remove `loopSchedule` from `ScheduleConfig`.
- Remove all source/test fixture writes of the field.
- Document the actual scheduler invariant where appropriate: schedules always
  loop continuously through the indexed content.
- Do not replace it with a new dormant flag.

Stop and replan if any of these are true:

- Fixing transactional replacement requires changing `ChannelPersistenceStore`
  or `ChannelRepository` public APIs.
- The implementation would need to make current-channel-key persistence fatal
  instead of preserving existing best-effort warning semantics.
- A real runtime consumer of `loopSchedule: false` is discovered.
- A production caller depends on partial `reorderChannels` behavior.
- Verification expands into manual port/webOS proof rather than TypeScript,
  Jest, and full repo verification.
- DCR-10 test-structure constraints require a broader test package split before
  DCR-1 coverage can land cleanly.

## Package Decomposition

package_id: `DCR-1`
checklist_token: `DCR-1`
package_issue_ids: `DCR-1-A1`, `DCR-1-A2`, `DCR-1-D1`, `DCR-1-D2`
ready_now_execution_unit: `DCR-1-WAVE1`
ready_now_slice: `DCR-1-S1`
recommended_slice_order: `DCR-1-S1`, `DCR-1-S2`, `DCR-1-S3`
parallel_execution_policy: serial only; parallel cleanup_worker execution is
not approved.

slice_table:

| slice_id | goal | areas/files | exact_issue_ids | verification | dependencies | stop_condition | handoff_condition | serial_only or parallel_group | parallel_justification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DCR-1-S1` | Make `replaceAllChannels` transactional for channel state, current channel, and resolved-content cache on channel-data save failure. | `ChannelManager.ts`; focused new ChannelManager transactional test file. | `DCR-1-A1` | Targeted transactional tests plus source audit that mutation happens only after channel-data save succeeds or rollback restores prior state. | None. | Replan if current-channel-key persistence must become fatal or repository/store APIs must change. | Failed channel-data save preserves previous channels, current channel, and cache; successful replacement still normalizes numbers/seeds and persists. | serial_only | Shares ChannelManager mutation/persistence semantics with S2. |
| `DCR-1-S2` | Use repo error summarizer in import result errors and enforce exact reorder API. | `ChannelManager.ts`; `interfaces.ts`; focused new ChannelManager import/order test file. | `DCR-1-A2`, `DCR-1-D1` | Targeted import non-`Error` throwable test; exact reorder success/unknown/missing/duplicate tests; source audit for old error cast. | After S1 so order tests see final replacement semantics. | Replan if production caller depends on partial reorder or if no existing `AppErrorCode` fits validation failure. | Import errors summarize non-`Error` throwables without `undefined`; reorder contract is documented and tested. | serial_only | Shares ChannelManager API/test surfaces with S1. |
| `DCR-1-S3` | Remove `ScheduleConfig.loopSchedule` and update scheduler API comments/fixtures. | `scheduler/types.ts`; scheduler implementation/comments if needed; scheduler tests; `OrchestratorSchedulePolicy.ts`; affected typed fixtures found by `rg`. | `DCR-1-D2` | Source audit for no `loopSchedule` under `src`; targeted scheduler/core/UI tests; typecheck. | After S1/S2 to keep ChannelManager API work in one reviewed batch first. | Replan if live code consumes `loopSchedule: false` or removal requires product behavior change. | `ScheduleConfig` no longer exposes `loopSchedule`; tests and runtime compile against continuous-loop scheduler semantics. | serial_only | Type/API cleanup crosses scheduler consumers and needs one integration gate. |

coverage_check:

| package_issue_id | planned disposition |
| --- | --- |
| `DCR-1-A1` | Retired by `DCR-1-S1`; no residual accepted. |
| `DCR-1-A2` | Retired by `DCR-1-S2`; no residual accepted. |
| `DCR-1-D1` | Resolved by exact-full-order API in `DCR-1-S2`; no residual accepted. |
| `DCR-1-D2` | Resolved by removing `loopSchedule` in `DCR-1-S3`; no residual accepted. |

execution_waves:

| wave_id | slice_ids | completion_condition | absorb_now_scope | replan_triggers |
| --- | --- | --- | --- | --- |
| `DCR-1-WAVE1` | `DCR-1-S1`, `DCR-1-S2`, `DCR-1-S3` | All four DCR-1 issues/decisions retired, targeted tests pass, source audits pass, `npm run verify` passes, implementation review is clean. | Same owner, same files, same issue ids, same verification envelope, and no new package membership. | Any stop condition from the seam gate; new owner; new files outside scope; materially wider verification; DCR-10 test split becomes blocking. |

coverage_ledger:

| package_issue_id | wave_id | final owner |
| --- | --- | --- |
| `DCR-1-A1` | `DCR-1-WAVE1` | scheduler/channel-manager owner |
| `DCR-1-A2` | `DCR-1-WAVE1` | scheduler/channel-manager owner |
| `DCR-1-D1` | `DCR-1-WAVE1` | scheduler/channel-manager owner |
| `DCR-1-D2` | `DCR-1-WAVE1` | scheduler/channel-manager owner |

## Verification Commands

Verification strategy classification: `new regression/contract test required`.

Primary verification mode: `contract-first`, with regression coverage for the
transactional persistence failure path.

Run these commands for the implementation unit:

```bash
rg -n "\(e as Error\)\.message" src/modules/scheduler/channel-manager
rg -n "reorderChannels\(" src --glob '!**/__tests__/**'
rg -n "loopSchedule" src

npm test -- --runInBand \
  src/modules/scheduler/channel-manager/__tests__/ChannelManager.transactional.test.ts \
  src/modules/scheduler/channel-manager/__tests__/ChannelManager.import-order.test.ts

npm test -- --runInBand \
  src/modules/scheduler/scheduler/__tests__/ChannelScheduler.test.ts \
  src/modules/scheduler/scheduler/__tests__/ScheduleCalculator.test.ts \
  src/core/orchestrator/__tests__/ScheduleDayRolloverController.test.ts \
  src/core/channel-tuning/__tests__/ChannelTuningCoordinator.test.ts \
  src/modules/ui/mini-guide/__tests__/MiniGuideCoordinator.test.ts \
  src/modules/ui/epg/__tests__/EPGCoordinator.test.ts \
  src/modules/ui/epg/__tests__/EPGScheduleRefreshRuntime.test.ts \
  src/modules/ui/epg/__tests__/EPGRefreshController.test.ts

npm run typecheck
npm run verify
```

Expected results:

- No source match for `(e as Error).message`.
- `reorderChannels` production matches are limited to the public interface and
  implementation.
- No `loopSchedule` matches remain under `src`.
- Targeted tests pass.
- `npm run typecheck` passes.
- `npm run verify` passes.

The full `npm run verify` gate is required because DCR-1 changes public
scheduler/channel-manager contracts and the checklist requires full verification
after targeted source audits and tests.

## Rollback Notes

Rollback `DCR-1-WAVE1` as one coherent batch if scheduler API removal or
ChannelManager transactional semantics regress.

If only `loopSchedule` removal causes compile fallout, the controller may replan
to split `DCR-1-S3` from the ChannelManager slices. Do not leave `DCR-1-D2`
unowned; either finish the removal or record an accepted residual with one
scheduler owner and revisit trigger under DCR rules.

## Commit Checkpoints

After `DCR-1-WAVE1` passes targeted verification, `npm run verify`, and clean
implementation review, create one focused implementation commit for the code and
test changes.

Keep this active plan and any checklist progress/linkage updates out of the
implementation commit unless the controller explicitly chooses a separate
tracked-doc commit.

## Ready-Now Execution Packet

ready_now_execution_unit: `DCR-1-WAVE1`
ready_now_slice: `DCR-1-S1`

Implementation constraints:

- Build candidate replacement state before mutating `_state` or clearing caches.
- On channel-data persistence failure, preserve previous `getAllChannels()`,
  `getCurrentChannel()`, and resolved-content cache behavior.
- Preserve current-channel-key persistence as best-effort warning behavior
  unless a source-backed replan chooses otherwise.
- Validate exact reorder input before mutating order or queueing persistence.
- Remove `loopSchedule` completely from the scheduler source API.
- Add focused new ChannelManager test files instead of adding DCR-1 cases to
  `ChannelManager.test.ts`.

Current-unit stop/replan conditions:

- Transactional replacement cannot be implemented without repository/store API
  changes.
- Current-channel-key persistence must become fatal to satisfy tests.
- Source audit finds a production partial-reorder consumer.
- Source audit finds a production `loopSchedule: false` consumer.
- DCR-10 test split policy blocks focused new DCR-1 test files.
