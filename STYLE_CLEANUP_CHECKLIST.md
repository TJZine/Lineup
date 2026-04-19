# Style Cleanup Checklist

> Established `2026-04-19` from the validated `2026-04-18` `STYLE_AUDIT.md` review.
>
> This is the live style-cleanup queue. `STYLE_AUDIT.md` remains evidence/reference only; it is not the backlog, not the approval gate, and not the checklist implementers update during execution.

This document tracks package-scoped style cleanup work for shared CSS contracts, runtime overlay parity/accessibility, EPG hotspot reduction, onboarding token follow-through, and inline-style/bootstrap cleanup.

## Fresh-Session Handoff

- Last audit refresh: `2026-04-18`
- Last structural refresh: `2026-04-19`
- Current execution state: `S1-W1` is planned and implementation-ready; no implementation package has started yet
- Next safe start: `S1-W1` / `pkg_shared_style_contracts`
- Preferred launcher: `cleanup-implement` for `S1-W1`; reserve `cleanup-loop` for approved Tier 3 packages (`S2-W1`, `S8-W1`)
- Authoritative evidence rule: change package status only from commands and source reads rerun in the target workspace/branch
- Exact issue-membership surface: `docs/design/active-style-cleanup-package-map.json`
- Audit/reference only: `STYLE_AUDIT.md`

## Goal

- Turn the validated style audit into a package-backed cleanup queue with one explicit owner for every actionable issue selected for execution.
- Remove shared-contract ambiguity before migration work starts.
- Keep style cleanup packaged by surface family and verification seam instead of by raw CSS property.

## Non-Goals

- Do not treat `STYLE_AUDIT.md` as the live checklist.
- Do not package work as repo-wide “all spacing” or “all typography” sweeps.
- Do not treat onboarding/theme-immune surfaces as runtime theme-parity defects.
- Do not mix EPG hotspot decomposition with unrelated overlay parity or onboarding cleanup.
- Do not add lint, CI, token-enforcement, or tooling policy changes in this program unless a later tracked package explicitly expands scope.

## How To Use This

- Treat this file as the active queue.
- Use the companion map for exact issue membership; keep this checklist concise at the package layer.
- Work top-down unless a later package is explicitly approved as a blocker override.
- Create or refresh a tracked `docs/plans/...` plan before implementation begins on a package that needs durable handoff memory.
- Update the checklist in the same pass when a package or exit gate changes state.

## Work-Unit Status Contract

Each `S#-W1` and `S#-EXIT` item below is a checklist item. The checkbox is the closeout signal.

When a work unit is touched, add or refresh this compact mini-record directly under the item:

- `Status:` `not started`, `planned`, `in progress`, `blocked`, `completed`, `deferred`, or `split follow-up`
- `Plan:` tracked `docs/plans/...` path, `local-only`, or `none yet`
- `Last touched:` `YYYY-MM-DD`
- `Verification:` exact commands plus short result
- `Follow-ups:` exact owner and trigger, or `none`
- `Handoff:` one-line next safe action

Check a box only in the same pass that updates the mini-record with current verification and disposition notes.

## Program Size Snapshot

- Package count: `9`
- Exact actionable issue count: `29`
- Estimated execution units: `15`
- Tier 3 packages: `S2-W1` / `pkg_epg_hotspot_decomposition`, `S8-W1` / `pkg_runtime_token_cleanup`
- Tier 2 packages: `S1-W1`, `S3-W1`, `S4-W1`, `S5-W1`, `S6-W1`, `S7-W1`, `S9-W1`

## Priority Overview

- `S1`: shared style contracts and decision locks — `4` exact issues, `1` serial execution unit, `Tier 2`
- `S2`: EPG hotspot decomposition — `1` structural issue, `3` serial execution units, `Tier 3`
- `S3`: EPG follow-through / design-accessibility cleanup — `4` exact issues, `2` serial execution units, `Tier 2`
- `S4`: runtime overlay parity — `3` exact issues, `2` serial execution units, `Tier 2`
- `S5`: runtime accessibility coverage — `5` exact issues, `2` serial execution units, `Tier 2`
- `S6`: settings / playback polish — `3` exact issues, `1` serial execution unit, `Tier 2`
- `S7`: onboarding token cleanup — `3` exact issues, `2` serial execution units, `Tier 2`
- `S8`: runtime token cleanup — `4` exact issues, `3` serial execution units, `Tier 3`
- `S9`: inline style / bootstrap cleanup — `2` exact issues, `1` serial execution unit, `Tier 2`

## Package Routing Decisions

- Shared contracts come first because later packages depend on explicit answers for overlay stack tokens, compact-radius semantics, phantom status-token policy, and focus-text token naming.
- `S2` is the largest structural package and stays separate from EPG design/accessibility follow-through.
- Overlay parity (`S4`) and runtime accessibility (`S5`) stay separate so theme work does not hide forced-colors/focus obligations.
- Onboarding cleanup (`S7`, `S9`) is separate from runtime parity because those surfaces are intentionally theme-immune.
- `STYLE_AUDIT.md` remains reference evidence; checklist state changes are driven by current-source proof and package-closeout verification.

## Priority Skill Routing

- `S1`: use `verification-strategy`; load `ui-composition-patterns` only if shared contract adoption unexpectedly changes runtime chrome behavior.
- `S2`: use `ui-composition-patterns`; treat this as Tier 3 controller work once implementation begins.
- `S3`: use `ui-composition-patterns`.
- `S4`: use `ui-composition-patterns`.
- `S5`: use `ui-composition-patterns`; preserve accessibility invariants from `docs/design/ui-design-language.md`.
- `S6`: use `ui-composition-patterns`.
- `S7`: no boundary skill by default; load `ui-composition-patterns` if onboarding layout/focus behavior changes.
- `S8`: use `ui-composition-patterns`; treat this as Tier 3 controller work because the package spans many runtime surfaces.
- `S9`: use `ui-composition-patterns`; load `architecture-boundaries` only if shared bootstrap ownership moves across module roots.

## Execution Hygiene

- Keep package work bounded to the approved surface family and verification seam.
- Run targeted source-audit commands before `npm run verify`.
- Run `npm run verify` before closing any package that touches runtime UI or CSS.
- Run `npm run verify:docs` whenever checklist, plan, or design-doc surfaces change in the same pass.
- Do not widen a package just because a nearby literal or style smell exists.
- If a package needs additional files outside its declared seam, stop and split or replan before implementation continues.

## Priority Exit Gates

- [ ] `S1-EXIT`
  - required: shared contract docs and token names are explicit, server-select phantom status-token ambiguity is retired, and later packages can consume the locked contracts without inventing policy
  - verification:
    - targeted `rg` checks from the active plan
    - `npm run verify`
    - `npm run verify:docs` if docs/checklist/plan surfaces changed in the same pass
  - exit rule: `S2-W1` may start only after `S1-W1` closes with a current checklist mini-record and no unresolved shared-contract ambiguity

- [ ] `S2-EXIT`
  - required: the EPG stylesheet hotspot is decomposed into the approved ownership split and the barrel/import surface is stable
  - verification:
    - targeted EPG contract/source-audit commands from the active plan
    - `npm run verify`
  - exit rule: EPG follow-through work can start without reopening monolith ownership questions

- [ ] `S3-EXIT`
  - required: EPG info-panel design/accessibility follow-through is closed or explicitly deferred with one final owner
  - verification:
    - targeted EPG source-audit commands from the active plan
    - `npm run verify`
  - exit rule: no live EPG design-language or forced-colors follow-through remains hidden behind `S2`

- [ ] `S4-EXIT`
  - required: compact-overlay/runtime parity work is closed without reclassifying onboarding surfaces as parity defects
  - verification:
    - targeted overlay source-audit commands from the active plan
    - `npm run verify`
  - exit rule: runtime theme-tint participation is explicit for the intended overlay family

- [ ] `S5-EXIT`
  - required: the runtime forced-colors/focus coverage package is closed for the non-EPG surfaces it owns
  - verification:
    - targeted accessibility source-audit commands from the active plan
    - `npm run verify`
  - exit rule: non-EPG runtime surfaces in this package no longer rely on audit notes for forced-colors coverage

- [ ] `S6-EXIT`
  - required: settings/playback polish decisions are closed without widening into broader migration packages
  - verification:
    - targeted source-audit commands from the active plan
    - `npm run verify`
  - exit rule: local playback/settings polish no longer blocks later runtime token cleanup

- [ ] `S7-EXIT`
  - required: onboarding token cleanup is closed while preserving theme-immune product intent
  - verification:
    - targeted onboarding source-audit commands from the active plan
    - `npm run verify`
  - exit rule: onboarding token follow-through no longer depends on unresolved shared-contract decisions

- [ ] `S8-EXIT`
  - required: runtime token migration closes the approved runtime surface family without reopening EPG/onboarding ownership
  - verification:
    - targeted runtime token source-audit commands from the active plan
    - `npm run verify`
  - exit rule: remaining runtime literal/token bypass debt either closes or has one explicit successor owner

- [ ] `S9-EXIT`
  - required: onboarding bootstrap duplication and non-geometric inline visual state drift are either retired or deferred with one final owner
  - verification:
    - targeted source-audit commands from the active plan
    - `npm run verify`
  - exit rule: style-cleanup closeout can proceed without a hidden inline-style/bootstrap package

## Priority 1: Shared Style Contracts And Decision Locks

- [ ] `S1-W1` `pkg_shared_style_contracts` Shared Style Contracts And Decision Locks
  - Backlog: `4` exact issues
  - Tier / effort / risk: `Tier 2` / `S-M` / `medium`
  - Execution shape: `1` serial execution unit
  - Scope: lock the shared decisions that later packages depend on: overlay stack contract authority, server-select phantom status-token policy, compact `10px` radius semantics, and `--color-text-on-focus`
  - Exact membership: `docs/design/active-style-cleanup-package-map.json` -> `pkg_shared_style_contracts`
  - Status: `planned`
  - Plan: `docs/plans/2026-04-19-s1-w1-shared-style-contracts.md`
  - Last touched: `2026-04-19`
  - Verification: planning-only in this pass; implementation verification is defined in the active plan
  - Follow-ups: `S1-EXIT` is the single exit owner; broader runtime/onboarding adoption stays with `S7-W1` and `S8-W1`
  - Handoff: implement `S1-W1` using `docs/plans/2026-04-19-s1-w1-shared-style-contracts.md`

## Priority 2: EPG Hotspot Decomposition

- [ ] `S2-W1` `pkg_epg_hotspot_decomposition` EPG Hotspot Decomposition
  - Backlog: `1` exact issue
  - Tier / effort / risk: `Tier 3` / `L` / `high`
  - Execution shape: `3` serial execution units
  - Scope: decompose `src/modules/ui/epg/styles.css` into the approved ownership split without mixing in unrelated parity or onboarding cleanup
  - Exact membership: `docs/design/active-style-cleanup-package-map.json` -> `pkg_epg_hotspot_decomposition`
  - Status: `not started`
  - Plan: `none yet`
  - Last touched: `2026-04-19`
  - Verification: `not run`
  - Follow-ups: `S2-EXIT` is the single exit owner; `S3-W1` depends on this package completing first
  - Handoff: do not start until `S1-EXIT` is complete

## Priority 3: EPG Follow-Through / Design-Accessibility Cleanup

- [ ] `S3-W1` `pkg_epg_followthrough` EPG Follow-Through / Design-Accessibility Cleanup
  - Backlog: `4` exact issues
  - Tier / effort / risk: `Tier 2` / `M` / `medium`
  - Execution shape: `2` serial execution units
  - Scope: finish the EPG-only design-language and accessibility work after the hotspot split stabilizes
  - Exact membership: `docs/design/active-style-cleanup-package-map.json` -> `pkg_epg_followthrough`
  - Status: `not started`
  - Plan: `none yet`
  - Last touched: `2026-04-19`
  - Verification: `not run`
  - Follow-ups: `S3-EXIT` is the single exit owner
  - Handoff: start after `S2-EXIT`

## Priority 4: Runtime Overlay Parity

- [ ] `S4-W1` `pkg_runtime_overlay_parity` Runtime Overlay Parity
  - Backlog: `3` exact issues
  - Tier / effort / risk: `Tier 2` / `M` / `medium`
  - Execution shape: `2` serial execution units
  - Scope: move the intended runtime overlay family onto the shared theme-aware treatment without reopening onboarding/theme-immune surfaces
  - Exact membership: `docs/design/active-style-cleanup-package-map.json` -> `pkg_runtime_overlay_parity`
  - Status: `not started`
  - Plan: `none yet`
  - Last touched: `2026-04-19`
  - Verification: `not run`
  - Follow-ups: `S4-EXIT` is the single exit owner
  - Handoff: start after `S1-EXIT`

## Priority 5: Runtime Accessibility Coverage

- [ ] `S5-W1` `pkg_runtime_accessibility_coverage` Runtime Accessibility Coverage
  - Backlog: `5` exact issues
  - Tier / effort / risk: `Tier 2` / `M` / `medium`
  - Execution shape: `2` serial execution units
  - Scope: add the missing non-EPG runtime forced-colors coverage and related accessibility follow-through
  - Exact membership: `docs/design/active-style-cleanup-package-map.json` -> `pkg_runtime_accessibility_coverage`
  - Status: `not started`
  - Plan: `none yet`
  - Last touched: `2026-04-19`
  - Verification: `not run`
  - Follow-ups: `S5-EXIT` is the single exit owner; EPG accessibility remains owned by `S3-W1`
  - Handoff: start after `S4-EXIT` or as an explicitly approved blocker override

## Priority 6: Settings / Playback Polish

- [ ] `S6-W1` `pkg_settings_playback_polish` Settings / Playback Polish
  - Backlog: `3` exact issues
  - Tier / effort / risk: `Tier 2` / `S-M` / `low-medium`
  - Execution shape: `1` serial execution unit
  - Scope: close the local playback/settings polish issues without widening into parity or broad token migration
  - Exact membership: `docs/design/active-style-cleanup-package-map.json` -> `pkg_settings_playback_polish`
  - Status: `not started`
  - Plan: `none yet`
  - Last touched: `2026-04-19`
  - Verification: `not run`
  - Follow-ups: `S6-EXIT` is the single exit owner
  - Handoff: start after `S4-EXIT`

## Priority 7: Onboarding Token Cleanup

- [ ] `S7-W1` `pkg_onboarding_token_cleanup` Onboarding Token Cleanup
  - Backlog: `3` exact issues
  - Tier / effort / risk: `Tier 2` / `M` / `medium`
  - Execution shape: `2` serial execution units
  - Scope: clean up onboarding-only token drift while preserving theme-immune product intent
  - Exact membership: `docs/design/active-style-cleanup-package-map.json` -> `pkg_onboarding_token_cleanup`
  - Status: `not started`
  - Plan: `none yet`
  - Last touched: `2026-04-19`
  - Verification: `not run`
  - Follow-ups: `S7-EXIT` is the single exit owner; shared contract answers come from `S1-W1`
  - Handoff: start after `S1-EXIT`

## Priority 8: Runtime Token Cleanup

- [ ] `S8-W1` `pkg_runtime_token_cleanup` Runtime Token Cleanup
  - Backlog: `4` exact issues
  - Tier / effort / risk: `Tier 3` / `L` / `high`
  - Execution shape: `3` serial execution units
  - Scope: perform the broad runtime-only token follow-through after shared contracts, overlay parity, and EPG decomposition have removed the major ambiguity seams
  - Exact membership: `docs/design/active-style-cleanup-package-map.json` -> `pkg_runtime_token_cleanup`
  - Status: `not started`
  - Plan: `none yet`
  - Last touched: `2026-04-19`
  - Verification: `not run`
  - Follow-ups: `S8-EXIT` is the single exit owner
  - Handoff: do not start until `S1-EXIT`, `S2-EXIT`, and the relevant runtime parity decisions are complete

## Priority 9: Inline Style / Bootstrap Cleanup

- [ ] `S9-W1` `pkg_inline_style_bootstrap_cleanup` Inline Style / Bootstrap Cleanup
  - Backlog: `2` exact issues
  - Tier / effort / risk: `Tier 2` / `S-M` / `medium`
  - Execution shape: `1` serial execution unit
  - Scope: centralize onboarding bootstrap duplication and retire the remaining non-geometric inline visual-state mutations that still belong in classes/state toggles
  - Exact membership: `docs/design/active-style-cleanup-package-map.json` -> `pkg_inline_style_bootstrap_cleanup`
  - Status: `not started`
  - Plan: `none yet`
  - Last touched: `2026-04-19`
  - Verification: `not run`
  - Follow-ups: `S9-EXIT` is the single exit owner
  - Handoff: start after `S7-EXIT`
