# FCP-4 AI-Generated Residue And Code Signal Plan

**Plan Status:** completed
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

## Goal

Resolve the admitted FCP-4 scheduler code-signal findings from [the FCP-4 audit](./2026-04-29-fcp-4-ai-generated-residue-code-signal-audit.md):

- `FCP-4-SF1`: remove or compress generated-looking/restating scheduler comments and docblocks while preserving comments that encode invariants.
- `FCP-4-SF2`: retire the unused exported `ShuffleResult` scheduler type if current-source proof still shows no consumers.

The approved package is scheduler-owned source-signal cleanup. It is not a behavior refactor, scheduler redesign, or source-wide generated-comment sweep.

## Non-Goals

- Do not change scheduler math, ordering, timer behavior, event names, channel tuning behavior, EPG range refresh behavior, mini guide behavior, or orchestrator schedule policy.
- Do not remove comments that explain epoch/negative anchor validity, same-seed/no-index-rebuild behavior, hard resync/drift handling, window safety guard rationale, platform constraints, security, lifecycle ordering, compatibility, external API contracts, or non-obvious domain behavior.
- Do not remove `ScheduleConfig.loopSchedule` or change scheduler config construction/fixtures under this plan.
- Do not touch Plex, player, UI, navigation, app-shell, persistence, or channel-manager source unless current-source proof reveals a direct `ShuffleResult` consumer and the plan is revised first.
- Do not use Desloppify output, issue ids, package maps, score deltas, generated task queues, or triage for intake, proof, package membership, or closeout.
- Do not start, plan, or mark progress on `FCP-5`.
- Do not update `ARCHITECTURE_CLEANUP_CHECKLIST.md` during implementation until the approved execution unit is implemented, verified, reviewed, and ready for controller closeout.

## Parent Priority Alignment

This plan is for `ARCHITECTURE_CLEANUP_CHECKLIST.md` item `FCP-4` AI-Generated Residue And Code Signal.

FCP-4 requires a repo-wide/source-backed audit for production code-signal noise and an execution-grade package that avoids drip-feed generated-comment cleanup. The selected package is intentionally broad but bounded: scheduler core comments/docblocks and one dead scheduler export share the same owner and verification surface.

This plan is intended to close all currently admitted FCP-4 source findings after `FCP-4-WAVE1` is implemented, verified, reviewed, and the Priority-Exit Readiness section is satisfied. Accepted/no-action and out-of-scope residuals remain owned by the audit and final FCP reconciliation.

## Required Reading

Read in this order before implementation:

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/cleanup-loop.md`
4. `ARCHITECTURE_CLEANUP_CHECKLIST.md`, especially the FCP operating contract and FCP-4 mini-record
5. `docs/agentic/plan-authoring-standard.md`
6. `docs/architecture/CURRENT_STATE.md`
7. `docs/architecture/modules.md`
8. `docs/agentic/codanna-playbook.md`
9. `docs/plans/2026-04-29-fcp-4-ai-generated-residue-code-signal-audit.md`
10. this plan
11. `src/modules/scheduler/scheduler/ChannelScheduler.ts`
12. `src/modules/scheduler/scheduler/ScheduleCalculator.ts`
13. `src/modules/scheduler/scheduler/ShuffleGenerator.ts`
14. `src/modules/scheduler/scheduler/interfaces.ts`
15. `src/modules/scheduler/scheduler/types.ts`
16. `src/modules/scheduler/scheduler/constants.ts`
17. `src/modules/scheduler/scheduler/index.ts`
18. `src/modules/scheduler/shared/prng.ts`

Freshness gate: if any referenced scheduler files, scheduler consumers, or the FCP-4 audit changed materially after this plan was written, refresh the audit and plan before implementation.

## Required Skills

- `verification-strategy`: primary mode is refactor-invariance with source-audit proof for comment cleanup plus stronger exported-surface verification for `ShuffleResult`.
- `execution-plan-authoring`: keep the handoff decision-complete without turning the plan into patch pseudo-code.

No architecture-boundary, UI-composition, persistence, or Plex boundary skill is required for the approved package. If implementation needs edits in those areas, stop and replan before coding.

## Codanna Discovery

Codanna MCP tools were not exposed in this session, so local CLI `codanna mcp` was used.

- `get_index_info`: 11072 symbols across 696 files, 3112 relationships, semantic search enabled with `AllMiniLML6V2`, 16 embeddings, updated about 33 minutes before audit.
- `semantic_search_with_context query:"AI generated residue comments wrappers boilerplate code signal" limit:8`: weak/noisy; top hits mixed brand glyph, Plex auth/library contracts, orchestrator fields, and channel setup request-intent docs.
- `semantic_search_with_context query:"restating comments defensive boilerplate pass through wrappers production source" limit:8`: weak/noisy; useful only as a signal to inspect brand glyph, Plex contracts, navigation policy, and orchestrator fields.
- `semantic_search_with_context query:"generic helper manager options config wrapper generated TypeScript" limit:8`: weak/noisy; no proof-grade package membership.
- `search_documents query:"FCP-4 AI-Generated Residue Code Signal" limit:8`: returned workflow/plan-standard hits and historical cleanup plans; emitted a Tantivy `LockBusy` auto-sync warning.
- `search_symbols query:ShuffleResult limit:8`: found one symbol in `src/modules/scheduler/scheduler/types.ts`.
- `analyze_impact ShuffleResult`: reported no impacted symbols.

Codanna was insufficient for the subjective code-signal package membership and mislabeled several scheduler symbol impact results. Deterministic fallback used direct reads and `rg` as proof:

- comment-density scan over production TypeScript excluding `__tests__`
- direct reads of selected scheduler files and accepted/no-action areas
- current-source `rg` for scheduler exports/callers, comment patterns, preserved invariant comments, `ShuffleResult`, `loopSchedule`, and package-local security-sensitive terms

No Desloppify output, issue ids, package maps, score deltas, generated queues, or triage were used.

## Impact Snapshot

The approved implementation blast radius is scheduler source plus scheduler tests/verification only as required by export cleanup.

Current source evidence:

- `ChannelScheduler.ts` has 163 comment lines / 559 total, including method docblocks and line comments that often restate adjacent names or code.
- `ScheduleCalculator.ts` has 82 comment lines / 303 total, including long export docblocks and generated-looking `@param` / `@returns` boilerplate for self-explanatory functions.
- `ShuffleGenerator.ts` has 45 comment lines / 91 total, including tutorial-style class and method docs plus line comments for the shuffle/hash loop.
- `interfaces.ts`, `types.ts`, `constants.ts`, and `src/modules/scheduler/shared/prng.ts` contain a mix of redundant doc comments and useful invariant/API notes.
- `ShuffleResult` appears only in `src/modules/scheduler/scheduler/types.ts` and the scheduler barrel export in `src/modules/scheduler/scheduler/index.ts`; Codanna and `rg` found no current consumers.
- `ScheduleConfig.loopSchedule` is intentionally out of scope because it appears in production config construction and many tests, while the scheduler implementation does not read it. Removing it is a scheduler API cleanup with a broader proof surface.

Preservation contracts:

- Keep scheduler determinism, shuffle, block mode, program lookup, window generation, event emission, hard resync, skip/jump, and timer behavior unchanged.
- Preserve useful invariant comments for non-finite anchor fallback versus valid zero/negative anchors, same-seed/no-index-rebuild reasoning, hard-resync drift cases, and `MAX_WINDOW_PROGRAMS` memory-safety rationale.
- Keep all exports except `ShuffleResult` stable.

## Files In Scope

- `src/modules/scheduler/scheduler/ChannelScheduler.ts`
- `src/modules/scheduler/scheduler/ScheduleCalculator.ts`
- `src/modules/scheduler/scheduler/ShuffleGenerator.ts`
- `src/modules/scheduler/scheduler/interfaces.ts`
- `src/modules/scheduler/scheduler/types.ts`
- `src/modules/scheduler/scheduler/constants.ts`
- `src/modules/scheduler/scheduler/index.ts`
- `src/modules/scheduler/shared/prng.ts`
- Scheduler tests only if implementation changes exported surface or compile fallout requires fixture updates
- `docs/plans/2026-04-29-fcp-4-ai-generated-residue-code-signal-audit.md` only for closeout evidence updates
- `docs/plans/2026-04-29-fcp-4-ai-generated-residue-code-signal.md` only for status/closeout evidence updates
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` only after implementation/review/verification approve FCP-4 closeout

## Files Out Of Scope

- `src/core/orchestrator/OrchestratorSchedulePolicy.ts`
- `src/core/channel-tuning/**`
- `src/modules/ui/epg/**`
- `src/modules/ui/mini-guide/**`
- `src/modules/scheduler/channel-manager/**`
- `src/modules/player/**`
- `src/modules/plex/**`
- `src/modules/navigation/**`
- `src/modules/ui/**`, except no source edits in this plan
- `src/App.ts`
- `src/core/app-shell/**`
- FCP-5/FCP-6/FCP-EXIT planning or source work
- Untracked 2026-04-28 planning/eval artifacts and `scorecard.png`

If implementation needs an out-of-scope source edit, stop and replan before coding it.

## Planner Self-Check

- Source-backed? Yes. `FCP-4-SF1` and `FCP-4-SF2` are based on direct reads, targeted `rg`, Codanna CLI evidence where useful, and current architecture docs.
- One coherent package? Yes. Both admitted findings are scheduler-owned source-signal cleanup. `FCP-4-SF1` is behavior-neutral; `FCP-4-SF2` is exported-surface cleanup with stronger verification.
- Owner clear? Yes. Scheduler core/shared PRNG owners own the selected files. Scheduler API owner owns the out-of-scope `loopSchedule` residual.
- Real closure condition beyond removing comments? Yes. Closure requires preserving invariant comments while removing restating/generated-looking scheduler prose, and retiring a dead exported scheduler type only with current-source consumer proof.
- Verification mode chosen before freeze? Yes. Refactor-invariance with source audit for comments, plus typecheck/targeted scheduler tests/`npm run verify` for exported-surface cleanup.
- FCP-5 avoided? Yes. Portability readiness is explicitly out of scope.
- Fresh session safe? Yes. Scope, owner seam, files, verification, and stop/replan triggers are explicit.

## Architecture Seam Decision Gate

The chosen seam is scheduler-owned source-signal cleanup:

- Scheduler core files may lose restating comments/docblocks and the unused `ShuffleResult` type/export.
- Scheduler behavior, runtime wiring, persisted channel state, EPG range generation behavior, mini guide behavior, channel tuning behavior, and orchestrator schedule policy remain unchanged.
- Invariant comments are preserved or clarified only where they protect non-obvious scheduler contracts.

Stop and replan if:

- any source edit is needed outside `## Files In Scope`
- `ShuffleResult` has a current production/test consumer or maintainer policy requires retaining the exported type
- implementation changes scheduler behavior, public config shape beyond `ShuffleResult`, event names, timing constants, schedule math, or tests to force the cleanup through
- comment cleanup starts deleting platform, security, external API, lifecycle, compatibility, or non-obvious invariant comments
- `ScheduleConfig.loopSchedule` removal or scheduler config redesign becomes tempting or necessary
- current source reveals another live FCP-4 source finding with a different owner or proof surface
- any P0 security issue is discovered

## Package Decomposition

`package_id`: `FCP-4-SCHEDULER-CODE-SIGNAL`

`checklist_token`: `FCP-4`

`source_finding_ids`: `FCP-4-SF1`, `FCP-4-SF2`

`slice_table`:

| slice_id | goal | areas/files | source_finding_ids | verification | dependencies | stop_condition | handoff_condition | serial_only/parallel_group | parallel_justification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FCP-4-S1` | Remove/compress scheduler restating comments and docblocks while preserving invariant comments. | `ChannelScheduler.ts`, `ScheduleCalculator.ts`, `ShuffleGenerator.ts`, `interfaces.ts`, `types.ts`, `constants.ts`, `src/modules/scheduler/shared/prng.ts` | `FCP-4-SF1` | `git diff --check`; targeted old-pattern `rg`; targeted preserved-pattern `rg`; `npm run verify:docs` after docs updates; no new automated tests unless source behavior changes. | None beyond current audit and plan. | Any architecture seam decision gate trigger fires, or cleanup needs logic/test changes. | Source diff is behavior-neutral; removed-pattern audit passes; preserved invariant audit passes; no out-of-scope files changed. | `parallel_group: FCP-4-WAVE1` | Can execute in the same wave as `FCP-4-S2` because both are scheduler-owned source-signal cleanup, but order remains serial inside the wave to keep review simple. |
| `FCP-4-S2` | Remove unused `ShuffleResult` declaration and scheduler barrel export if current-source proof still shows no consumers. | `src/modules/scheduler/scheduler/types.ts`, `src/modules/scheduler/scheduler/index.ts` | `FCP-4-SF2` | Current-source `rg` for `ShuffleResult`; `npm run typecheck`; targeted scheduler tests; `npm run verify`; `git diff --check`; `npm run verify:docs`. | Run after `FCP-4-S1` or alongside it in the same worker pass; requires a fresh consumer audit immediately before edit. | Any consumer appears, export policy blocks removal, or removal requires behavior changes. | `ShuffleResult` has no remaining references; typecheck, targeted tests, full verify, diff check, and docs verify pass. | `parallel_group: FCP-4-WAVE1` | Same owner and final proof surface as S1, but not safe for independent parallel writes because both touch scheduler types/barrel review context. |

`coverage_check`:

- `FCP-4-SF1` maps completely to `FCP-4-S1`.
- `FCP-4-SF2` maps completely to `FCP-4-S2`.
- If fresh consumer proof finds any real `ShuffleResult` consumer, implementation must stop and replan before closeout. The revised plan/audit must either keep the source finding in a resolved path or explicitly defer it with one final owner, reason, revisit trigger, and updated Priority-Exit Readiness wording. Under this plan, consumer proof is not a completed disposition and does not close `FCP-4-WAVE1`.
- No other FCP-4 source findings are admitted. Accepted/no-action and out-of-scope residuals stay owned by the audit record and final FCP reconciliation.

`execution_waves`:

| wave_id | slice_ids | completion_condition | absorb_now_scope | replan_triggers |
| --- | --- | --- | --- | --- |
| `FCP-4-WAVE1` | `FCP-4-S1`, `FCP-4-S2` | `FCP-4-SF1` and `FCP-4-SF2` are both resolved and verified: approved source audits pass, `ShuffleResult` has no remaining references, `git diff --check` passes, targeted scheduler tests pass, `npm run typecheck` passes, `npm run verify` passes, and `npm run verify:docs` passes after docs/checklist closeout updates. | Newly discovered scheduler comment/docblock residue may be absorbed only if it is in the same in-scope scheduler files, behavior-neutral, same owner, same proof surface, and does not change accepted residual accounting. | New owner, new files, `ShuffleResult` consumer, scheduler behavior change, removal of invariant comments, public API/config contraction beyond `ShuffleResult`, broader verification need, or P0 security finding. |

`coverage_ledger`:

| source_finding_id | owner | planned disposition | execution surface |
| --- | --- | --- | --- |
| `FCP-4-SF1` | Scheduler core owner | Resolve in `FCP-4-S1` | `FCP-4-WAVE1` |
| `FCP-4-SF2` | Scheduler core public-surface owner | Resolve in `FCP-4-S2`; fresh consumer proof is a stop/replan trigger, not a completion path | `FCP-4-WAVE1` |

`ready_now_slice`: `FCP-4-S1`

`ready_now_execution_unit`: `FCP-4-WAVE1`

`recommended_slice_order`: `FCP-4-S1` then `FCP-4-S2` inside `FCP-4-WAVE1`.

`parallel_execution_policy`: Do not authorize parallel `cleanup_worker` execution. The selected package is small enough for one coherent wave, and independent workers would create unnecessary review churn across the same scheduler files and proof surface.

## Verification Commands

Verification mode: refactor-invariance with source-audit proof plus exported-surface verification.

Plan classification: `existing coverage sufficient`.

Existing coverage is sufficient because the intended changes should not alter scheduler behavior. `FCP-4-SF1` is comment/source-signal cleanup; `FCP-4-SF2` removes an unused exported type only if a current-source audit still proves no consumers. Existing typecheck, scheduler tests, and full repo verification are the right proof for accidental exported-surface or behavior regressions. New tests are not justified unless implementation changes behavior, changes scheduler config shape beyond `ShuffleResult`, or exposes a real unprotected contract.

Run a fresh consumer audit before removing `ShuffleResult`:

```sh
rg -n "ShuffleResult" src --glob '!**/__tests__/**'
rg -n "ShuffleResult" src --glob '*.{test,spec}.ts'
```

Expected outcome before edit: only `types.ts` and `index.ts` production hits, and no test hits. Expected outcome after edit: no hits. If any real consumer appears, stop and replan.

Run old-pattern source audits after comment cleanup:

```sh
rg -n "@example|@implements|@param|@returns|Build a schedule index|Pre-computes|Core algorithm|Calculate the next|Calculate the previous|Generate a schedule window|Fisher-Yates shuffle|Simple hash|Hash the channelId|Ensure positive value|Get the current scheduler state|Stop the sync timer|Create a new ChannelScheduler instance|Channel Scheduler implementation" src/modules/scheduler/scheduler src/modules/scheduler/shared/prng.ts
```

Expected outcome: no hits for boilerplate/restating patterns that the implementation intentionally removed. Any remaining hit must be justified in implementation notes as an invariant-preserving comment.

Run preserved-pattern source audits:

```sh
rg -n "Zero \\(epoch\\)|negative timestamps|same seed = same shuffle|independent of anchorTime|hard resync|drift|memory safety guard|MAX_WINDOW_PROGRAMS" src/modules/scheduler/scheduler src/modules/scheduler/shared/prng.ts
```

Expected outcome: approved scheduler invariant comments still exist where source behavior would otherwise be non-obvious.

Run package-local security/source audit:

```sh
rg -n "token|password|auth|secret|credential|localStorage|sessionStorage|innerHTML|eval\\(|Function\\(|dangerously|X-Plex|Plex|webOS|security" src/modules/scheduler/scheduler --glob "*.ts"
```

Expected outcome: no hits. If any hit appears because implementation changed scope, stop and replan.

Run static and targeted scheduler verification:

```sh
npm run typecheck
npm run test:unit -- src/modules/scheduler/scheduler/__tests__/ShuffleGenerator.test.ts src/modules/scheduler/scheduler/__tests__/ScheduleCalculator.test.ts src/modules/scheduler/scheduler/__tests__/ChannelScheduler.test.ts
```

Expected outcome: typecheck and targeted scheduler tests pass.

Run full verification because `FCP-4-S2` touches an exported scheduler surface:

```sh
npm run verify
```

Expected outcome: full repo verification passes.

Run diff hygiene:

```sh
git diff --check
```

Expected outcome: no whitespace or patch hygiene errors.

Run docs/control-plane verification after audit, plan, or checklist updates:

```sh
npm run verify:docs
```

Expected outcome: docs/control-plane verification passes after this active plan, audit, and any FCP-4 mini-record update.

## Rollback Notes

Planning-only rollback is limited to reverting this plan and its audit artifact.

Implementation rollback should revert only the `FCP-4-WAVE1` files touched by the worker: selected scheduler files, scheduler shared PRNG file, scheduler barrel/types, and any targeted scheduler test fixture updates if they were required by a reviewed exported-surface change. Do not revert unrelated dirty workspace files.

If `ShuffleResult` removal produces unexpected consumer or type fallout, restore the type/export and leave `FCP-4-SF2` as blocked for replan instead of broadening into scheduler API redesign.

## Commit Checkpoints

- Checkpoint 1: Completed by commit `f9eca40b`. Scheduler comments/docblocks
  were cleaned for `FCP-4-SF1` while preserving invariant comments.
- Checkpoint 2: Completed by commit `f9eca40b`. Fresh consumer audit found no
  `ShuffleResult` consumers, so the declaration and scheduler barrel export
  were removed for `FCP-4-SF2`.
- Checkpoint 3: Completed by worker. Targeted source audits, `git diff --check`,
  `npm run typecheck`, targeted scheduler tests, and `npm run verify` passed.
- Checkpoint 4: Completed. Fresh implementation review approved
  `FCP-4-WAVE1` with no blocking findings.
- Checkpoint 5: Completed. Audit, plan, and FCP-4 checklist mini-record were
  updated, `npm run verify:docs` passed in the pending-closeout state, fresh
  FCP-4 closeout review approved completion with no findings, and final
  post-completion `npm run verify:docs` passed before the closeout documentation
  commit.

## Priority-Exit Readiness

This plan is intended to be the final FCP-4 implementation package if `FCP-4-WAVE1` resolves `FCP-4-SF1` and `FCP-4-SF2`, and the accepted/no-action plus out-of-scope records in the audit remain valid.

Source finding disposition required before FCP-5 can start:

| source_finding_id | intended disposition | required closeout evidence | final owner |
| --- | --- | --- | --- |
| `FCP-4-SF1` | resolved by `FCP-4-S1` commit `f9eca40b` | Source review confirms scheduler restating comments/docblocks were removed or compressed; invariant comments for anchor validity, same-seed/no-index-rebuild, hard resync/drift, and window safety remain; old-pattern `rg` audit had no hits; preserved-pattern `rg` audit retained required invariant hits; `git diff --check` passed; clean implementation review approved `FCP-4-WAVE1`; fresh FCP-4 priority-exit closeout review approved completion with no findings. | Scheduler core owner |
| `FCP-4-SF2` | resolved by `FCP-4-S2` commit `f9eca40b` | Fresh pre-edit consumer proof found `ShuffleResult` only at declaration/export and no test consumers. Source review confirms `ShuffleResult` declaration and scheduler barrel export were removed; post-edit `rg -n "ShuffleResult" src` returned no relevant hits; `npm run typecheck`, targeted scheduler tests, `npm run verify`, `git diff --check`, clean implementation review, and fresh FCP-4 priority-exit closeout review passed. | Scheduler core public-surface owner |

Accepted/no-action and out-of-scope residuals from the audit:

- `ScheduleConfig.loopSchedule` remains out of scope / behavior-coupled. Final owner: scheduler API owner. Revisit trigger: future scheduler config contract cleanup, FCP-6 test-confidence audit, or any source change that starts reading/writing this field differently.
- Plex library interface docs remain accepted. Final owner: Plex library contract owner. Revisit trigger: Plex library contract/failure semantics change.
- webOS/platform/media-session/fail-open comments remain accepted. Final owner: player, Plex shared transport, and platform owners. Revisit trigger: platform compatibility or lifecycle behavior changes.
- Brand glyph inline SVG comments remain accepted for this package. Final owner: UI common brand asset owner. Revisit trigger: brand asset regeneration or dedicated UI asset cleanup scope.
- Production barrel section comments, including `src/modules/player/index.ts` grouping comments and `src/modules/scheduler/channel-manager/index.ts:2`, remain accepted/no-action. Final owner: module package owners. Revisit trigger: package barrel policy changes or a future source audit finds misleading exports.
- Test comment bloat remains out of scope for FCP-4 production source. Final owner: relevant test owners. Revisit trigger: FCP-6 test-confidence audit.

Security triage / expected P0 disposition:

- `no open P0 security findings` for this package at planning time.
- Implementation must not change auth, token handling, Plex transport, storage schemas, network requests, authorization behavior, DOM injection, or security-sensitive persistence.
- Worker package-local security/source audit returned no hits, and
  implementation review found no P0/security concern.
- If implementation or review discovers a P0 security finding, stop and replan with one final owner, reason, and revisit trigger before FCP-4 closeout or any FCP-5 work.

Priority-exit commands/evidence required:

- source-backed audit rerun/source review for `FCP-4-SF1` and `FCP-4-SF2`
- package-local old-pattern, preserved-pattern, `ShuffleResult`, and security/source audits listed in `## Verification Commands`
- `git diff --check`
- `npm run typecheck`
- targeted scheduler tests
- `npm run verify`
- `npm run verify:docs` after audit/plan/checklist closeout updates
- clean implementation review and clean FCP-4 priority-exit closeout review

Do not start, plan, or mark progress on `FCP-5` until the FCP-4 mini-record is completed with this source-finding proof matrix, verification evidence, clean closeout review, and owned residuals recorded.

Implementation evidence:

- Focused implementation commit: `f9eca40b`
  (`refactor(fcp-4): clean scheduler code signal`), containing only the eight
  approved scheduler source files.
- Worker verification passed: `ShuffleResult` pre/post source audits,
  old-pattern source audit, preserved-pattern source audit, package-local
  security/source audit, `npm run typecheck`, targeted scheduler tests (3
  suites / 79 tests), `npm run verify`, `git diff --check`, and
  `git diff --cached --check`.
- Fresh implementation review found no blocking findings and approved
  `FCP-4-WAVE1` for controller closeout.
- Controller closeout updates passed `npm run verify:docs` in the
  pending-closeout state, and fresh FCP-4 priority-exit closeout review found no
  blocking findings and approved completion.
- Final post-completion `npm run verify:docs` passed before the closeout
  documentation commit.
