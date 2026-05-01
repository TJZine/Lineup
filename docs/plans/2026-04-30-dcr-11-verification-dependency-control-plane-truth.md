**Plan Status:** completed
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

# DCR-11 Verification, Dependency, And Control-Plane Truth

## Goal

Retire `DCR-11` by making the final cleanup proof path, dependency advisory state, and control-plane documentation truthful against current source/config evidence.

Completion means every `DCR-11-A#` issue is fixed, source-disproved, or recorded with one final owner/outcome; `DCR-11-D1` has one accepted residual or resolved disposition; stale style cleanup intake surfaces can no longer drive active cleanup work; `verify:bundle` has exact maintainer-routing evidence; and dependency advisory health has a bounded remediation result.

## Execution Update

2026-04-30 controller update:

- `DCR-11-W1` was attempted after clean plan approval.
- `DCR-11-S1` safe docs/style/control-plane edits were applied and
  `npm run verify:docs` now passes after removing tracked-plan references to
  local-only S0 run artifact paths.
- `npm run verify:bundle` fails on the existing startup bundle guard: startup
  entry asset `assets/index-D1ytKM3-.js` is `697501` bytes and the guard
  requires `< 500000`.
- Maintainer routing clarified that this bundle guard failure existed before
  `DCR-11` and is the reason `verify:bundle` is intentionally excluded from the
  general `npm run verify` path. `DCR-11-A6` is accepted as maintainer-routed
  residual bundle-size work, owned by the release/bundle guard owner, with
  revisit trigger before any future attempt to add `verify:bundle` to
  `npm run verify` or to require it for final DCR-EXIT proof.
- The dependency advisory failure was remediated with a bounded Vite patch bump
  plus package-lock refresh of affected dev-tooling packages. This cleared
  `npm audit --audit-level=high` without `--force`, broad package upgrades,
  package-manager changes, framework migration, or production source edits.

## Non-Goals

- Do not implement `DCR-12` through `DCR-16`.
- Do not change UI visuals, layout, focus behavior, runtime code, or production source outside CSS/comment surfaces explicitly named below.
- Do not run or use the Desloppify skill, fresh Desloppify scans, runtime intake, queue/import output, score refreshes, status/next/plan output, or review packets.
- Do not perform broad dependency upgrades, framework migrations, forced audit fixes, or package-manager changes.
- Do not edit the `DCR-EXIT` plan during this package. `DCR-EXIT-S2` remains blocked until `DCR-11` through `DCR-16` close or are explicitly routed out.
- Do not touch unrelated dirty/untracked docs/plans/eval files already present before this plan.
- Do not close this package by accepting detector wording alone; every issue needs current source/docs/config proof.

## Parent Priority Alignment

`DCR-11` is the first S0-admitted follow-up package after `DCR-EXIT-S1`. It blocks `DCR-EXIT-S2` because the cleanup program cannot safely reconcile packages while docs, dependency health, and verification commands disagree with current repository truth.

This package is checklist-linked. The package membership remains owned by `ARCHITECTURE_CLEANUP_CHECKLIST.md`; this plan snapshots that membership only to define the approved execution/review surface.

## Required Reading

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/cleanup-loop.md`
4. `ARCHITECTURE_CLEANUP_CHECKLIST.md` section `DCR-11`
5. `docs/plans/2026-04-30-dcr-exit-final-dimension-audit-plan.md` only for S0/S1 routing context and `DCR-EXIT` block state
6. `docs/agentic/plan-authoring-standard.md`
7. `docs/agentic/codanna-playbook.md`
8. The tracked S0/S1 routing summaries for `DCR-11` in
   `ARCHITECTURE_CLEANUP_CHECKLIST.md` and the active `DCR-EXIT` plan. The
   local S0 run artifacts were controller-loaded during planning, but they are
   not required reading for tracked-plan execution because `docs/runs/` is
   local-only by policy.
9. Current files named in `## Files In Scope`

Freshness gate: before implementation, rerun the source/config audits listed in the slice handoff. If the named files, package advisory set, active style cleanup surfaces, or `npm run verify` script changed materially after this plan was written, update this plan and rerun plan review before editing implementation surfaces.

## Required Skills

- `architecture-boundaries` for current-state/module-doc truth and hotspot wording.
- `verification-strategy` for the integration proof classification.
- `execution-plan-authoring` for tracked package decomposition.

Do not use `desloppify`. `ui-composition-patterns`, `persistence-boundaries`, and `plex-integration-boundaries` are not required unless the worker finds a need to change UI behavior, storage contracts, or Plex runtime code; that would be outside the approved execution unit and must stop for replan.

## Codanna Discovery

- `get_index_info`: local Codanna CLI reported an index with 11646 symbols across 743 files, semantic search enabled, and an index updated about 2 hours before this planning pass.
- `search_documents`: attempted `DCR-11 Verification Dependency Control-Plane Truth`, `S0-L13-F1 verify bundle`, and `style cleanup control-plane missing artifacts`. Results were weak/noisy for DCR-11 because the new plan did not exist yet; the docs index also reported a transient `LockBusy` auto-sync warning. Useful hits pointed at `docs/design/css-governance.md` and active plan examples, not enough to prove package membership.
- `semantic_search_with_context`: attempted `verify bundle dependency audit package scripts stylelint config` and `stylelint config CSS token comment verify bundle package json scripts`; both returned no useful semantic matches.
- Direct fallback reads and `rg` supplied the decisive evidence: `AGENTS.md`, workflow/cleanup-loop/plan-standard/Codanna docs, the `DCR-11` checklist entry, the active `DCR-EXIT` plan, S0 synthesis and lane reports, `package.json`, `stylelint.config.cjs`, `docs/architecture/CURRENT_STATE.md`, `docs/architecture/modules.md`, `docs/plans/2026-03-04-epg-performance-risk-register.md`, `src/styles/tokens.css`, `docs/design/css-governance.md`, `docs/design/active-style-cleanup-package-map.json`, `docs/plans/2026-04-19-s9-inline-style-bootstrap-cleanup.md`, `npm audit --audit-level=high`, `npm audit fix --dry-run --json`, `npm audit fix --package-lock-only --dry-run --json`, and `npm ls --depth=0`.
- `analyze_impact`: not required for this plan because the approved first wave is docs/config/dependency control-plane work, not shared production-symbol refactoring. If implementation touches TypeScript runtime or shared public symbols, stop and replan with an impact snapshot.

## Impact Snapshot

Observed workspace state before planning:

- `git status --short` showed a modified `docs/plans/2026-04-30-dcr-exit-final-dimension-audit-plan.md` and several untracked docs/plans/eval files. Treat these as user-owned; do not touch them during `DCR-11`.
- `rg` found `DCR-11` ids in `ARCHITECTURE_CLEANUP_CHECKLIST.md`, the
  `DCR-EXIT` plan, and the local S0 run artifact set. The tracked plan carries
  forward only the checklist and active-plan routing summaries, not local-only
  artifact paths.
- `npm ls --depth=0` exited `0`; direct dependencies are installed cleanly.
- Initial `npm audit --audit-level=high` exited `1` with 9 vulnerabilities: 3 moderate, 5 high, 1 critical. High/critical advisories were in `flatted`, `handlebars`, `minimatch`, `picomatch`, `rollup`, and `vite`.
- Current remediation proof: `package.json` moves Vite from `^7.3.1` to
  `^7.3.2`, and `package-lock.json` refreshes affected dev-tooling transitive
  packages; `npm audit --audit-level=high` now exits `0` with `found 0
  vulnerabilities`, and `npm ls --depth=0` exits `0`.
- `package.json` defines `verify:bundle` as `node tools/verify-bundle.mjs`; `npm run verify` currently runs typecheck, architecture lint, CSS lint, coverage, tools, contracts, docs verification, and build, but not `verify:bundle`.

Issue source-audit snapshot:

| Issue | Current proof | Planned outcome |
| --- | --- | --- |
| `DCR-11-A1` / `S0-L01-F5` | `docs/architecture/CURRENT_STATE.md` still listed `SettingsScreen`, `ChannelSetupScreen`, and `PlexStreamResolver` as equivalent hotspot entries; current source proof only supports removing `SettingsScreen.ts` and `PlexStreamResolver.ts` from primary file-size-hotspot wording. `ChannelSetupScreen.ts` remains large enough to stay listed until a future source audit proves otherwise. | Fix current-state hotspot wording so reduced files are not presented as active cleanup hotspots while keeping `ChannelSetupScreen.ts` active. |
| `DCR-11-A2` / `S0-L04-F01` | `ARCHITECTURE_CLEANUP_CHECKLIST.md` records DCR-10 closeout docs verification as required after the checklist/archive update, not as passed. | Record fresh `npm run verify:docs` proof in the DCR-11 closeout/checklist evidence. |
| `DCR-11-A3` / `S0-L06-NQ-002` | `docs/architecture/CURRENT_STATE.md` now distinguishes `ChannelSetupRecordStore` and `ChannelSetupBuildScratchStore`, but `docs/architecture/modules.md` still says `ChannelSetupRecordStore.ts` owns `cleanupStaleBuildKeys`. | Fix remaining module-doc scratch/record ownership drift or source-disprove with exact current owner proof if already changed before execution. |
| `DCR-11-A4` / `S0-L10-F1` | `docs/plans/2026-03-04-epg-performance-risk-register.md` still has a `TODO` linked plan, old EPG source paths, and "Implemented in branch (uncommitted)" statuses. | Update the risk register to current paths/statuses or archive/retire stale claims with docs proof. |
| `DCR-11-A5` / `S0-L10-F2` | `src/styles/tokens.css` still says the scrim token is "consumed in later design-pass plans" even though active consumers already exist. | Clean the comment without changing token values or rendered CSS. |
| `DCR-11-A6` / `S0-L13-F1` | `package.json` has `verify:bundle` but omits it from `verify`; standalone `verify:bundle` currently fails a pre-existing startup bundle-size guard. | Accepted maintainer-routed residual. Final owner: release/bundle guard owner. Revisit trigger: future bundle-size remediation or any future attempt to add `verify:bundle` to `npm run verify` / DCR-EXIT final proof. Non-blocker rationale: existing full verification intentionally excludes a known failing bundle guard until the maintainer addresses bundle size. |
| `DCR-11-A7` / `S0-L13-F2` | `npm audit --audit-level=high` initially failed from stale vulnerable dev-tooling dependency entries. | Resolved by bounded Vite patch bump plus package-lock refresh of affected dev-tooling packages. `npm audit --audit-level=high` exits `0`; `npm ls --depth=0` exits `0`. |
| `DCR-11-A8` / `S0-L14-F1` | `STYLE_AUDIT.md` and `STYLE_CLEANUP_CHECKLIST.md` are missing, while `docs/design/active-style-cleanup-package-map.json`, `docs/design/css-governance.md`, and active `docs/plans/2026-04-19-s9-inline-style-bootstrap-cleanup.md` still point at those surfaces as live/reference intake. | Retire/archive stale style cleanup package-map and active style-plan surfaces so they cannot drive active cleanup intake; preserve durable design governance only through `docs/design/css-governance.md` and/or archived artifacts in this plan. |
| `DCR-11-D1` / `S0-L10-F3` | `stylelint.config.cjs` still carries a tighten-later comment with no owner. | Accept as residual now. Final owner: dependency/config/tooling owner. Revisit trigger: next CSS/stylelint strictness pass or any doc/checklist claim that stylelint strictness is closed. Non-blocker: CSS strictness-policy debt, not a DCR source-correctness or verification blocker. Future-port ownership does not apply. |

## Files In Scope

- `docs/plans/2026-04-30-dcr-11-verification-dependency-control-plane-truth.md`
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` for DCR-11 closeout evidence after implementation/review
- `docs/architecture/CURRENT_STATE.md`
- `docs/architecture/modules.md`
- `docs/plans/2026-03-04-epg-performance-risk-register.md`
- `src/styles/tokens.css`
- `package.json`
- `package-lock.json`
- `docs/development/testing.md`
- `docs/design/css-governance.md`
- `docs/design/active-style-cleanup-package-map.json`
- `docs/plans/2026-04-19-s9-inline-style-bootstrap-cleanup.md`
- A new archived style-control artifact under `docs/archive/` only if the worker chooses move/archive rather than in-place retirement
- `stylelint.config.cjs` is read-only for D1 unless a reviewed replan chooses to resolve instead of accept the residual

## Files Out Of Scope

- `docs/plans/2026-04-30-dcr-exit-final-dimension-audit-plan.md`
- `DCR-12` through `DCR-16` plans, checklist entries, implementation files, or tests
- Unrelated untracked docs/plans/eval files present before this plan
- Runtime TypeScript source, UI components, visual CSS values, Plex runtime, scheduler/channel runtime, settings runtime, and persistence stores
- `STYLE_AUDIT.md` and `STYLE_CLEANUP_CHECKLIST.md` restoration as live intake surfaces
- Broad package manager changes, dependency replacement, framework migration, `npm audit fix --force`, Node engine changes, CI migration, or score refresh work

## Planner Self-Check

1. Ownership seams are explicit: docs/control-plane truth, dependency/config/tooling, and style/design governance each have a named slice inside one serial execution wave.
2. No adjacent runtime contract change is required. If implementation discovers a need to change TypeScript runtime behavior, UI behavior, Plex behavior, or storage contracts, the plan requires replan.
3. Files out of scope are not needed for hidden mechanical wiring. `DCR-EXIT` stays read-only; DCR-11 closeout proof is recorded in DCR-11/checklist surfaces instead.
4. Codanna was attempted through the local CLI and proved insufficient/noisy for decisive package proof; the fallback path is recorded with exact reads and commands.
5. The plan does not grow hotspots. It corrects docs about hotspot status and keeps source owners unchanged.
6. A fresh cleanup_worker does not need to choose package membership, dependency/security disposition, D1 outcome, or DCR-EXIT routing.
7. The plan is execution-grade: the only implementation discretion left is local edit shape inside named docs/config surfaces.

## Architecture Seam Decision Gate

Chosen seam: one serial control-plane/dependency wave, `DCR-11-W1`, with two ordered slices:

1. `DCR-11-S1` repairs docs/style/control-plane truth and records D1 as an accepted residual.
2. `DCR-11-S2` records maintainer routing for the pre-existing bundle-size guard and repairs dependency advisory health with a bounded Vite patch bump plus package-lock refresh.

The cleanup controller must not enter implementation until plan review approval is clean. After approval, implementation uses `cleanup_worker`, not the general `worker`.

`cleanup_worker` may execute only `ready_now_execution_unit` `DCR-11-W1`. It must not choose package membership, dependency/security disposition, D1 residual acceptance, or DCR-EXIT routing. Those decisions are frozen here. Parallel cleanup_workers are not allowed because the slices share docs closeout and package/dependency verification gates.

Stop and replan if any of these occur:

- `npm audit fix` requires `--force`, direct major upgrades, framework migration, source changes, package-manager changes, or a wider verification surface than this plan names.
- A high/critical advisory remains and cannot be source-disproved or assigned an explicit maintainer-approved residual inside DCR-11.
- A live P0-equivalent security issue appears.
- Retiring style cleanup surfaces would delete durable design governance truth rather than moving it to `docs/design/css-governance.md` or a clearly historical archive artifact.
- Current source/docs prove `DCR-11-A3` or `DCR-11-A8` now belongs to a different package owner.
- Implementation needs to touch runtime TypeScript, UI visual behavior, Plex, scheduler, settings, persistence, or DCR-EXIT files.

## Verification Commands

- Verification classification: `broader integration/manual proof required`

Primary mode: `integration-ops`. No new automated test is required by default because DCR-11 changes docs/control-plane truth, package scripts, lockfile dependency state, and comments rather than product behavior. The proof surface is command-based plus source/config audit.

Planner/update gate:

- Run: `npm run plans:check`
- Expected: serious active plan conformance passes.

Required implementation and closeout verification:

- Run: `npm run verify:docs`
- Expected: documentation verification and harness docs tests pass after docs/control-plane/style-plan/checklist updates. This also records the DCR-10 docs verification proof required by `DCR-11-A2`.
- Run: `npm run verify:bundle`
- Expected: currently exits `1` with the known pre-existing startup bundle-size
  failure. This is accepted as maintainer-routed residual proof for `DCR-11-A6`,
  not a blocker for `DCR-11` closeout.
- Run: `npm audit --audit-level=high`
- Expected: exits `0` after the bounded Vite patch bump plus package-lock
  refresh.
- Run: `npm ls --depth=0`
- Expected: exits `0`; direct dependency installation remains clean.
- Run: `npm run lint:css`
- Expected: exits `0` if `src/styles/tokens.css` or style/CSS config comments change.
- Run: `npm run verify`
- Expected: exits `0` if `package.json`, `package-lock.json`, verification scripts, source files, or verification routing changes. Do not add `verify:bundle` to `verify` until standalone `npm run verify:bundle` passes or a reviewed replan/maintainer route changes the bundle guard policy.

Source-audit proof required before closeout:

- `rg -n "STYLE_AUDIT|STYLE_CLEANUP_CHECKLIST|active-style-cleanup-package-map|pkg_epg_followthrough|S3-W1" docs ARCHITECTURE_CLEANUP_CHECKLIST.md`
- Expected: no active/current doc or plan points at missing style cleanup artifacts as live cleanup intake. Historical/archive references are allowed only when clearly marked as historical.
- `rg -n "cleanupStaleBuildKeys|scratch cleanup|ChannelSetupRecordStore|ChannelSetupBuildScratchStore" docs/architecture`
- Expected: architecture docs identify record persistence and build-scratch cleanup owners truthfully.
- `rg -n "consumed in later design-pass plans|Implemented in branch \\(uncommitted\\)|Linked implementation plan: TODO" src/styles/tokens.css docs/plans/2026-03-04-epg-performance-risk-register.md`
- Expected: stale DCR-11-owned prose is gone or explicitly source-disproved.

## Rollback Notes

- If docs/control-plane edits fail review, revert only the DCR-11-touched docs/checklist/style-control files and keep unrelated dirty/untracked files intact.
- If dependency remediation creates an unacceptable package result, revert only
  the DCR-11 `package.json` Vite patch bump plus `package-lock.json` refresh and
  stop for replan; do not force audit fixes.
- If `verify:bundle` integration into `npm run verify` breaks for reasons unrelated to the script order, revert the package-script change and stop for replan with the observed failure.
- If style cleanup retirement removes durable design governance, restore the prior style governance docs and replan the archive/retirement path before closing A8.

## Commit Checkpoints

- Checkpoint 0: this active plan only. Do not bundle it into later cleanup_worker implementation commits.
- Checkpoint 1: `DCR-11-W1` implementation commit after `DCR-11-S1` and `DCR-11-S2` are complete, reviewed, and verified. Include package/dependency/config/docs changes, but exclude active plan progress edits unless the controller explicitly creates a separate tracked-doc commit.
- Checkpoint 2: controller closeout/checklist evidence update after clean implementation review and required verification. Keep DCR-EXIT plan edits out of this checkpoint unless a later reviewed replan explicitly authorizes them.

## Package Decomposition

- `package_id`: `DCR-11`
- `checklist_token`: `DCR-11`
- `package_issue_ids`:
  - `DCR-11-A1`: `S0-L01-F5` current-state hotspot wording is stale for reduced files.
  - `DCR-11-A2`: `S0-L04-F01` DCR-10 closeout docs verification proof is not recorded.
  - `DCR-11-A3`: `S0-L06-NQ-002` channel setup scratch cleanup is referenced through the setup-record store.
  - `DCR-11-A4`: `S0-L10-F1` active EPG risk register carries stale TODO, old paths, and uncommitted status.
  - `DCR-11-A5`: `S0-L10-F2` CSS token comment references future design-pass plans after active consumption.
  - `DCR-11-A6`: `S0-L13-F1` full verification skips release bundle guard.
  - `DCR-11-A7`: `S0-L13-F2` dependency advisory health is failing.
  - `DCR-11-A8`: `S0-L14-F1` style cleanup control-plane docs point at missing live artifacts.
  - `DCR-11-D1`: decide `S0-L10-F3` stylelint tighten-later wording; this plan accepts it as a residual owned by dependency/config/tooling.

- `slice_table`:

### `DCR-11-S1`

- `goal`: Repair docs/control-plane/style truth and freeze the `DCR-11-D1` residual decision.
- `areas/files`: `docs/architecture/CURRENT_STATE.md`, `docs/architecture/modules.md`, `docs/plans/2026-03-04-epg-performance-risk-register.md`, `src/styles/tokens.css`, `docs/design/css-governance.md`, `docs/design/active-style-cleanup-package-map.json`, `docs/plans/2026-04-19-s9-inline-style-bootstrap-cleanup.md`, optional `docs/archive/**` style-control archive target, and `ARCHITECTURE_CLEANUP_CHECKLIST.md` closeout rows after review.
- `exact_issue_ids`:
  - `DCR-11-A1`
  - `DCR-11-A2`
  - `DCR-11-A3`
  - `DCR-11-A4`
  - `DCR-11-A5`
  - `DCR-11-A8`
  - `DCR-11-D1`
- `verification`: `npm run plans:check`, `npm run verify:docs`, `npm run lint:css` if CSS/comment files change, plus the source-audit `rg` commands listed in `## Verification Commands`.
- `dependencies`: Clean plan review approval. `DCR-EXIT-S1` routing already admitted this package; `DCR-EXIT-S2` remains blocked.
- `stop_condition`: Stop if style cleanup retirement requires restoring missing `STYLE_AUDIT.md`/`STYLE_CLEANUP_CHECKLIST.md` as live intake, if durable design governance would be lost, if a current source audit moves ownership to DCR-12 through DCR-16, or if runtime/UI/source behavior changes are needed.
- `handoff_condition`: Current-state/module/risk-register/CSS/style-control docs are truthful, stale style cleanup active intake is retired or archived, D1 is recorded as accepted residual with owner/revisit/non-blocker rationale, DCR-10 docs verification proof is recorded, and docs/CSS verification passes.
- `serial_only`: yes
- `parallel_justification`: These edits share control-plane truth and closeout evidence; splitting them would risk contradictory active/inactive style cleanup state.

### `DCR-11-S2`

- `goal`: Make full verification and dependency advisory health truthful without inventing a dependency remediation path.
- `areas/files`: `package.json`, `package-lock.json`, `docs/development/testing.md`, `tools/verify-bundle.mjs` read-only unless source audit proves the verifier itself is stale, and `ARCHITECTURE_CLEANUP_CHECKLIST.md` closeout rows after review.
- `exact_issue_ids`:
  - `DCR-11-A6`
  - `DCR-11-A7`
- `verification`: `npm audit --audit-level=high`, `npm audit fix --dry-run --json`, `npm audit fix --package-lock-only --dry-run --json`, `npm ls --depth=0`, `npm run verify:bundle`, and `npm run verify` after package script/lockfile changes.
- `dependencies`: `DCR-11-S1` should land first so docs truth is stable before package closeout evidence is recorded. The dependency path used a bounded Vite patch bump plus package-lock refresh of affected dev-tool transitive packages; it did not use `npm audit fix --force`, framework migration, package-manager changes, or production source edits.
- `stop_condition`: Stop if further dependency remediation becomes necessary and requires `npm audit fix --force`, major direct dependency upgrades, framework migration, package-manager changes, production source edits, or if high/critical advisories recur without source-disproof or maintainer-approved residual rationale.
- `handoff_condition`: standalone `verify:bundle` failure is recorded as
  maintainer-routed residual bundle-size work, direct dependency tree is clean,
  and dependency advisories are cleared at high level after bounded
  Vite patch bump plus package-lock remediation.
- `serial_only`: yes
- `parallel_justification`: Package script, lockfile, audit, and full verification are one dependency/config/tooling seam and must be reviewed as one proof surface.

- `coverage_check`:
  - `DCR-11-A1` maps to `DCR-11-S1`.
  - `DCR-11-A2` maps to `DCR-11-S1`.
  - `DCR-11-A3` maps to `DCR-11-S1`.
  - `DCR-11-A4` maps to `DCR-11-S1`.
  - `DCR-11-A5` maps to `DCR-11-S1`.
  - `DCR-11-A6` maps to `DCR-11-S2`.
  - `DCR-11-A7` maps to `DCR-11-S2`.
  - `DCR-11-A8` maps to `DCR-11-S1`.
  - `DCR-11-D1` maps to `DCR-11-S1` with accepted residual disposition. Final owner: dependency/config/tooling owner. Revisit trigger: next CSS/stylelint strictness pass or any docs/checklist claim of stylelint strictness closure. Non-blocker rationale: CSS strictness-policy debt, not DCR source-correctness or final verification proof debt. Future-port ownership: not applicable.
- `coverage_ledger`:
  - `DCR-11-A1`: `slice_id` `DCR-11-S1`; `execution_unit` `DCR-11-W1`; default survivor disposition `stop/replan` unless source-disproved by current docs before edit.
  - `DCR-11-A2`: `slice_id` `DCR-11-S1`; `execution_unit` `DCR-11-W1`; default survivor disposition `stop/replan` until fresh docs verification proof is recorded.
  - `DCR-11-A3`: `slice_id` `DCR-11-S1`; `execution_unit` `DCR-11-W1`; default survivor disposition `stop/replan` unless source-disproved by current architecture docs.
  - `DCR-11-A4`: `slice_id` `DCR-11-S1`; `execution_unit` `DCR-11-W1`; default survivor disposition `stop/replan` unless the risk register is archived/retired with owner proof.
  - `DCR-11-A5`: `slice_id` `DCR-11-S1`; `execution_unit` `DCR-11-W1`; default survivor disposition `stop/replan` if changing the comment would alter CSS values.
  - `DCR-11-A6`: `slice_id` `DCR-11-S2`; `execution_unit` `DCR-11-W1`; accepted maintainer-routed residual. Final owner: release/bundle guard owner. Revisit trigger: future bundle-size remediation or any future attempt to add `verify:bundle` to `npm run verify` / DCR-EXIT final proof.
  - `DCR-11-A7`: `slice_id` `DCR-11-S2`; `execution_unit` `DCR-11-W1`; resolved by bounded Vite patch bump plus package-lock refresh; `npm audit --audit-level=high` exits `0`.
  - `DCR-11-A8`: `slice_id` `DCR-11-S1`; `execution_unit` `DCR-11-W1`; default survivor disposition `stop/replan` if stale style cleanup surfaces cannot be retired without losing governance truth.
  - `DCR-11-D1`: `slice_id` `DCR-11-S1`; `execution_unit` `DCR-11-W1`; final owner dependency/config/tooling owner; accepted residual as described above.
- `execution_waves`:
  - `wave_id`: `DCR-11-W1`
  - `slice_ids`:
    - `DCR-11-S1`
    - `DCR-11-S2`
  - `completion_condition`: Both slices are implemented, verified, reviewed clean, and the DCR-11 checklist closeout evidence records every issue outcome plus D1 residual owner/revisit/non-blocker rationale.
  - `absorb_now_scope`: Only newly discovered docs/config/control-plane residue that stays inside the same files, same owners, same verification envelope, and same final-owner accounting. No runtime source, UI behavior, DCR-EXIT, DCR-12 through DCR-16, broad dependency migration, or future-port work may be absorbed.
  - `replan_triggers`: Any stop condition from `DCR-11-S1` or `DCR-11-S2`; new package membership; changed final-owner accounting; live P0-equivalent security finding; dependency remediation beyond the bounded non-force Vite patch bump plus package-lock refresh; need for parallel implementation; or verification widening beyond this plan.
- `ready_now_slice`: none; `DCR-11-W1` has been executed.
- `ready_now_execution_unit`: none; package closeout is complete after clean
  fresh final adversarial review.
- `last_attempted_slice`: `DCR-11-S1`
- `last_attempted_execution_unit`: `DCR-11-W1`
- `current_execution_status`: execution complete; fresh final adversarial
  review clean.
- `recommended_slice_order`:
  1. `DCR-11-S1`
  2. `DCR-11-S2`
- `parallel_execution_policy`: Serial only. Parallel cleanup_workers are not authorized because both slices share control-plane closeout evidence and `DCR-11-S2` depends on truthful verification/docs routing from `DCR-11-S1`.

## Implementation Routing

Do not start another fresh `cleanup_worker` for `DCR-11-W1` from this plan in
its current state. `DCR-11-W1` has already been executed. Remaining work is
final controller verification, fresh adversarial review, and checklist closeout.

Historical approved worker handoff for the attempted wave:

The worker handoff must include:

- `PLAN`: `docs/plans/2026-04-30-dcr-11-verification-dependency-control-plane-truth.md`
- `READY_NOW_EXECUTION_UNIT`: `DCR-11-W1`
- `READY_NOW_SLICE`: `DCR-11-S1`
- The instruction that the worker may only execute the approved wave and must stop for replan on any dependency/security/DCR-EXIT/style-governance widening.

Review is wave-scoped after `DCR-11-W1`; slice-level accounting remains mandatory inside the worker output.
