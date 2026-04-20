# Style Cleanup Checklist

> Established `2026-04-19` from the validated `2026-04-18` `STYLE_AUDIT.md` review.
>
> This is the live style-cleanup queue. `STYLE_AUDIT.md` remains evidence/reference only; it is not the backlog, not the approval gate, and not the checklist implementers update during execution.

This document tracks package-scoped style cleanup work for shared CSS contracts, runtime overlay parity/accessibility, EPG hotspot reduction, onboarding token follow-through, and inline-style/bootstrap cleanup.

## Fresh-Session Handoff

- Last audit refresh: `2026-04-18`
- Last structural refresh: `2026-04-19`
- Current execution state: `S1-W1`, `S1-EXIT`, `S2-W1`, `S2-EXIT`, `S3-W1`, `S3-EXIT`, `S4-W1`, `S4-EXIT`, `S5-W1`, `S5-EXIT`, `S6-W1`, `S6-EXIT`, `S7-W1`, `S7-EXIT`, and `S8-W1` are complete
- Next safe start: fresh `lineup-cleanup-review` for `S8-EXIT`
- Preferred launcher: `S8-W1` is complete; use `cleanup-review` for the remaining Priority 8 exit gate and do not start `S9-W1` until `S8-EXIT` is complete
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

- [x] `S1-EXIT`
  - required: shared contract docs and token names are explicit, server-select phantom status-token ambiguity is retired, and later packages can consume the locked contracts without inventing policy
  - verification:
    - targeted `rg` checks from the active plan
    - `npm run verify`
    - `npm run verify:docs` if docs/checklist/plan surfaces changed in the same pass
  - exit rule: `S2-W1` may start only after `S1-W1` closes with a current checklist mini-record and no unresolved shared-contract ambiguity
  - Status: `completed`
  - Plan: `local-only`
  - Last touched: `2026-04-19`
  - Verification: `rg -n 'overlay stack|z-index|stacking' docs/design/ui-design-language.md docs/design/css-governance.md src/styles/tokens.css src/styles/themes.css` -> matched `docs/design/ui-design-language.md:72`, `docs/design/css-governance.md:16,18`, `src/styles/tokens.css:169`; `rg -n -- '--color-status-(ok|error|warning)' src/styles/tokens.css src/modules/ui/server-select/styles.css` -> no matches; `rg -n -- '--radius-compact|--color-text-on-focus|--directv-focus-text' docs/design/ui-design-language.md docs/design/css-governance.md src/styles/tokens.css src/styles/themes.css src/modules/ui/player-osd/styles.actions.css src/modules/ui/exit-confirm/styles.css` -> matched docs, shared tokens/themes, and both scoped focus-text callsites; `npm run verify` -> pass; `npm run verify:docs` -> pass
  - Follow-ups: `S7-W1` on onboarding token cleanup start and `S8-W1` on runtime token cleanup start should consume these locked shared contracts; no further `S1` owner remains
  - Handoff: `S2-W1` or any later approved package may start from the locked shared contracts without reopening `S1`

- [x] `S2-EXIT`
  - required: the EPG stylesheet hotspot is decomposed into the approved ownership split and the barrel/import surface is stable
  - verification:
    - targeted EPG contract/source-audit commands from the active plan
    - `npm run verify`
  - exit rule: EPG follow-through work can start without reopening monolith ownership questions
  - Status: `completed`
  - Plan: `local-only`
  - Last touched: `2026-04-19`
  - Verification: `npm test -- --runInBand src/modules/ui/epg/__tests__/epg-focused-overflow-style.test.ts src/styles/__tests__/classic-pip-alignment.test.ts` -> pass after the final EU3 ownership corrections; `npx stylelint src/modules/ui/epg/styles.css src/modules/ui/epg/styles.grid.css src/modules/ui/epg/styles.classic.css src/modules/ui/epg/styles.theme.css src/modules/ui/epg/styles.motion.css` -> pass; `rg -n "prefers-reduced-motion|forced-colors|layout-classic \\.epg-grid" src/modules/ui/epg/styles.grid.css src/modules/ui/epg/styles.classic.css src/modules/ui/epg/styles.theme.css src/modules/ui/epg/styles.motion.css src/modules/ui/epg/styles.cells.css` -> showed classic grid residue only in `styles.classic.css`, shared reduced-motion only in `styles.motion.css`, base forced-colors in `styles.cells.css`, classic forced-colors/reduced-motion in `styles.classic.css`, and theme-scoped forced-colors in `styles.theme.css`; `npm run verify` -> pass
  - Follow-ups: `S3-W1` is now the single downstream owner for remaining EPG design-language and accessibility follow-through; no further `S2` owner remains
  - Handoff: start `S3-W1` without reopening the EPG stylesheet ownership split

- [x] `S3-EXIT`
  - required: EPG info-panel design/accessibility follow-through is closed or explicitly deferred with one final owner
  - verification:
    - targeted EPG source-audit commands from the active plan
    - `npm run verify`
  - exit rule: no live EPG design-language or forced-colors follow-through remains hidden behind `S2`
  - Status: `completed`
  - Plan: `local-only`
  - Last touched: `2026-04-19`
  - Verification: `npm test -- --runInBand src/modules/ui/epg/__tests__/EPGLibraryTabs.test.ts src/modules/ui/epg/__tests__/EPGInfoPanel.test.ts src/modules/ui/epg/__tests__/epg-focused-overflow-style.test.ts` -> pass; `npx stylelint src/modules/ui/epg/styles.grid.css src/modules/ui/epg/styles.theme.css src/modules/ui/epg/styles.css` -> pass; `rg -n "epg-library-pill|epg-library-picker-panel|epg-library-picker-item|forced-colors|\\.theme-swiss \\\\.epg-info-panel \\\\.epg-info-(backdrop|tags)|\\.theme-swiss \\\\.epg-(cell-meta|cell-subtitle)|!important" src/modules/ui/epg/styles.grid.css src/modules/ui/epg/styles.theme.css src/modules/ui/epg/__tests__/EPGLibraryTabs.test.ts src/modules/ui/epg/__tests__/epg-focused-overflow-style.test.ts` -> matched the new library-picker forced-colors block and the narrowed Swiss info-panel selector ownership, with no remaining Swiss `!important` or stale Swiss cell-meta/subtitle selector residue in the package seam; `npm run verify` -> pass
  - Follow-ups: `none`
  - Handoff: no further `S3` follow-through session is needed; downstream packages may proceed without reopening EPG follow-through ownership

- [x] `S4-EXIT`
  - required: compact-overlay/runtime parity work is closed without reclassifying onboarding surfaces as parity defects
  - verification:
    - targeted overlay source-audit commands from the active plan
    - `npm run verify`
  - exit rule: runtime theme-tint participation is explicit for the intended overlay family
  - Status: `completed`
  - Plan: `docs/plans/2026-04-19-s4-s5-runtime-overlay-parity-accessibility.md`
  - Last touched: `2026-04-19`
  - Verification: `npm test -- --runInBand src/modules/ui/__tests__/runtime-overlay-style-contracts.test.ts src/modules/ui/channel-badge/__tests__/ChannelBadgeOverlay.test.ts src/modules/ui/channel-transition/__tests__/ChannelTransitionOverlay.test.ts src/modules/ui/channel-number-overlay/__tests__/ChannelNumberOverlay.test.ts src/modules/ui/playback-options/__tests__/PlaybackOptionsModal.test.ts` -> pass; `rg -n "theme-(glass|swiss|directv|ember-steel|slate-pine)|scrim-tint-rgb|playback-options-panel|exit-confirm-panel" src/modules/ui/channel-badge/styles.css src/modules/ui/channel-transition/styles.css src/modules/ui/channel-number-overlay/styles.css src/modules/ui/playback-options/styles.core.css src/modules/ui/playback-options/styles.theme.css src/modules/ui/exit-confirm/styles.css` -> matched the compact-overlay and modal parity selectors only in the approved runtime files; `npm run verify` -> pass; manual runtime smoke proof via `file:///tmp/s4-overlay-smoke.html` in Firefox -> clean for Ember & Steel/base, Glass, and DirecTV compact overlays plus Playback Options / Exit Confirm parity/readability; `npm run verify:docs` -> pass
  - Follow-ups: Priority 4 now routes to `lineup-cleanup-review` for the required cleanup review before any `S5-W1` execution starts
  - Handoff: request a Priority 4 cleanup review for `pkg_runtime_overlay_parity`; if that review is clean, start `S5-W1-S1` from the shared plan

- [x] `S5-EXIT`
  - required: the runtime forced-colors/focus coverage package is closed for the non-EPG surfaces it owns
  - verification:
    - targeted accessibility source-audit commands from the active plan
    - `npm run verify`
  - exit rule: non-EPG runtime surfaces in this package no longer rely on audit notes for forced-colors coverage
  - Status: `completed`
  - Plan: `docs/plans/2026-04-19-s4-s5-runtime-overlay-parity-accessibility.md`
  - Last touched: `2026-04-19`
  - Verification: `npm test -- --runInBand src/modules/ui/__tests__/runtime-overlay-style-contracts.test.ts src/modules/ui/channel-badge/__tests__/ChannelBadgeOverlay.test.ts src/modules/ui/channel-transition/__tests__/ChannelTransitionOverlay.test.ts src/modules/ui/channel-number-overlay/__tests__/ChannelNumberOverlay.test.ts src/modules/ui/mini-guide/__tests__/MiniGuideOverlay.test.ts src/modules/ui/playback-options/__tests__/PlaybackOptionsModal.test.ts` -> pass; `rg -n "@media \\(forced-colors: active\\)|mini-guide-row\\.focused|channel-badge|channel-transition|channel-number-panel|playback-options-item\\.(focused|selected)|playback-options-item:focus-visible" src/modules/ui/mini-guide/styles.core.css src/modules/ui/channel-badge/styles.css src/modules/ui/channel-transition/styles.css src/modules/ui/channel-number-overlay/styles.css src/modules/ui/playback-options/styles.core.css src/modules/ui/playback-options/styles.theme.css` -> matched only the approved S5 runtime files/selectors; `npm run verify` -> pass; manual runtime proof observed via a local-only Playback Options forced-colors preview harness rendered from the exact `styles.core.css` forced-colors selectors, with focused/selected readability remaining clear; `npm run verify:docs` -> pass
  - Follow-ups: Priority 5 now routes to `lineup-cleanup-review` for the required cleanup review before any `S6-W1` execution starts
  - Handoff: request a Priority 5 cleanup review for `pkg_runtime_accessibility_coverage`; if that review is clean, start `S6-W1`

- [x] `S6-EXIT`
  - required: settings/playback polish decisions are closed without widening into broader migration packages
  - verification:
    - targeted source-audit commands from the active plan
    - `npm run verify`
  - exit rule: local playback/settings polish no longer blocks later runtime token cleanup
  - Status: `completed`
  - Plan: `docs/plans/2026-04-19-s6-s7-settings-onboarding-style-polish.md`
  - Last touched: `2026-04-19`
  - Verification: `npm test -- --runInBand src/modules/ui/__tests__/runtime-overlay-style-contracts.test.ts src/modules/ui/settings/__tests__/SettingsScreen.test.ts src/modules/ui/playback-options/__tests__/PlaybackOptionsModal.test.ts` -> pass; `rg -n "border-radius: 18px 18px 0 0|font-weight: 560" src/modules/ui/exit-confirm/styles.css src/modules/ui/settings/styles.core.css` -> no matches; `rg -n "animation-delay: (210|240|270|300|330|360)ms" src/modules/ui/playback-options/styles.core.css src/modules/ui/playback-options/styles.motion.css` -> no matches; `npm run verify` -> pass; `npm run verify:docs` -> pass
  - Follow-ups: `S6` is fully closed with no deferred package residue; `S7-W1` is now the next owner for onboarding token cleanup and must start from a fresh planning pass
  - Handoff: start `lineup-cleanup-plan` for `S7-W1` before any Priority 7 implementation begins

- [x] `S7-EXIT`
  - required: onboarding token cleanup is closed while preserving theme-immune product intent
  - verification:
    - targeted onboarding source-audit commands from the active plan
    - `npm run verify`
  - exit rule: onboarding token follow-through no longer depends on unresolved shared-contract decisions
  - Status: `completed`
  - Plan: `docs/plans/2026-04-19-s7-onboarding-token-cleanup.md`
  - Last touched: `2026-04-19`
  - Verification: `rg -n "#ffd2a0|#8cc2ff|#ffd0ba|rgba\\(255, 176, 90|rgba\\(76, 153, 255|rgba\\(255, 136, 87" src/modules/ui/profile-select/styles/cards.css` -> no matches; `rg -n "font-size: calc\\(34px|font-size: 12px|font-size: 22px|font-size: 28px|font-size: calc\\(22px|font-size: calc\\(15px|font-size: 0\\.75rem|font-size: 0\\.72rem|font-size: 0\\.94rem|font-size: 1\\.1rem|font-size: 0\\.9rem" src/styles/shell.onboarding.shared-shell.css src/styles/shell.onboarding.server-selection.css src/modules/ui/profile-select/styles/cards.css src/modules/ui/profile-select/styles/pin-modal.css src/modules/ui/server-select/styles.css src/modules/ui/channel-setup/styles.review-progress.css src/modules/ui/audio-setup/styles.css` -> no matches; `rg -n -- "--onboarding-badge-(lock|admin|restricted)-(bg|border|text)|font-size: calc\\(var\\(--text-(2xl|lg)\\)|font-size: var\\(--text-(xl|md|xs)\\)" src/styles/shell.onboarding.shared-shell.css src/styles/shell.onboarding.server-selection.css src/modules/ui/profile-select/styles/cards.css src/modules/ui/profile-select/styles/pin-modal.css src/modules/ui/server-select/styles.css src/modules/ui/channel-setup/styles.review-progress.css src/modules/ui/audio-setup/styles.css` -> matched only the approved onboarding files and shared-shell badge-token definitions; `npm test -- --runInBand src/modules/ui/profile-select/__tests__/ProfileSelectScreen.test.ts src/modules/ui/server-select/__tests__/ServerSelectScreen.test.ts src/modules/ui/channel-setup/steps/__tests__/BuildProgressStepController.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts src/modules/ui/audio-setup/__tests__/AudioSetupScreen.test.ts` -> pass; `npm run verify` -> pass; `desloppify status` -> no blocking P0 ids reported (security 100.0%); `desloppify show review --status open` -> no open issues matching review; `npm run verify:docs` -> pass
  - Follow-ups: `S8-W1` is now the next owner for runtime token cleanup; Priority 7 closed with no deferred onboarding residue
  - Handoff: Priority 7 cleanup review is complete; `S8-W1` may proceed from the tracked runtime-token plan without reopening onboarding ownership

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

- [x] `S1-W1` `pkg_shared_style_contracts` Shared Style Contracts And Decision Locks
  - Backlog: `4` exact issues
  - Tier / effort / risk: `Tier 2` / `S-M` / `medium`
  - Execution shape: `1` serial execution unit
  - Scope: lock the shared decisions that later packages depend on: overlay stack contract authority, server-select phantom status-token policy, compact `10px` radius semantics, and `--color-text-on-focus`
  - Exact membership: `docs/design/active-style-cleanup-package-map.json` -> `pkg_shared_style_contracts`
  - Status: `completed`
  - Plan: `local-only`
  - Last touched: `2026-04-19`
  - Verification: `rg -n 'overlay stack|z-index|stacking' docs/design/ui-design-language.md docs/design/css-governance.md src/styles/tokens.css src/styles/themes.css` -> matched `docs/design/ui-design-language.md:72`, `docs/design/css-governance.md:16,18`, `src/styles/tokens.css:169`; `rg -n -- '--color-status-(ok|error|warning)' src/styles/tokens.css src/modules/ui/server-select/styles.css` -> no matches; `rg -n -- '--radius-compact|--color-text-on-focus|--directv-focus-text' docs/design/ui-design-language.md docs/design/css-governance.md src/styles/tokens.css src/styles/themes.css src/modules/ui/player-osd/styles.actions.css src/modules/ui/exit-confirm/styles.css` -> matched docs, shared tokens/themes, and both scoped focus-text callsites; `npm run verify` -> pass; `npm run verify:docs` -> pass
  - Follow-ups: `S7-W1` on onboarding token cleanup start and `S8-W1` on runtime token cleanup start should adopt these shared contracts more broadly; `S1-EXIT` closed in the same pass
  - Handoff: downstream packages can now rely on the shared overlay stack, compact radius, and focus-text contracts without reopening `S1-W1`

## Priority 2: EPG Hotspot Decomposition

- [x] `S2-W1` `pkg_epg_hotspot_decomposition` EPG Hotspot Decomposition
  - Backlog: `1` exact issue
  - Tier / effort / risk: `Tier 3` / `L` / `high`
  - Execution shape: `3` serial execution units
  - Scope: decompose `src/modules/ui/epg/styles.css` into the approved ownership split without mixing in unrelated parity or onboarding cleanup
  - Exact membership: `docs/design/active-style-cleanup-package-map.json` -> `pkg_epg_hotspot_decomposition`
  - Status: `completed`
  - Plan: `local-only`
  - Last touched: `2026-04-19`
  - Verification: `wc -l src/modules/ui/epg/styles.css` -> `2065` lines confirmed hotspot size before the split; `rg -n '^/\\*|^@media|^@keyframes|^\\.epg|^\\.library-picker|^\\.show-info' src/modules/ui/epg/styles.css` -> confirmed shell/grid/cells/info-panel/classic/theme blocks were co-located in one seam before extraction; `npm test -- --runInBand src/modules/ui/epg/__tests__/epg-focused-overflow-style.test.ts src/styles/__tests__/classic-pip-alignment.test.ts` -> pass after the final EU3 seam-only split and ownership corrections; `npx stylelint src/modules/ui/epg/styles.css src/modules/ui/epg/styles.grid.css src/modules/ui/epg/styles.classic.css src/modules/ui/epg/styles.theme.css src/modules/ui/epg/styles.motion.css` -> pass; `rg -n "prefers-reduced-motion|forced-colors|layout-classic \\.epg-grid" src/modules/ui/epg/styles.grid.css src/modules/ui/epg/styles.classic.css src/modules/ui/epg/styles.theme.css src/modules/ui/epg/styles.motion.css src/modules/ui/epg/styles.cells.css` -> confirmed the final ownership split for classic/theme/motion and forced-colors residue; `npm run verify` -> pass
  - Follow-ups: `S3-W1` now owns the remaining EPG design-language and accessibility follow-through; `S2-EXIT` closed in the same pass
  - Handoff: `S3-W1` may start from the approved split-file ownership without reopening monolith decomposition

## Priority 3: EPG Follow-Through / Design-Accessibility Cleanup

- [x] `S3-W1` `pkg_epg_followthrough` EPG Follow-Through / Design-Accessibility Cleanup
  - Backlog: `4` exact issues
  - Tier / effort / risk: `Tier 2` / `M` / `medium`
  - Execution shape: `2` serial execution units
  - Scope: finish the EPG-only design-language and accessibility work after the hotspot split stabilizes
  - Exact membership: `docs/design/active-style-cleanup-package-map.json` -> `pkg_epg_followthrough`
  - Status: `completed`
  - Plan: `local-only`
  - Last touched: `2026-04-19`
  - Verification: `npm test -- --runInBand src/modules/ui/epg/__tests__/EPGLibraryTabs.test.ts src/modules/ui/epg/__tests__/EPGInfoPanel.test.ts src/modules/ui/epg/__tests__/epg-focused-overflow-style.test.ts` -> pass; `npx stylelint src/modules/ui/epg/styles.grid.css src/modules/ui/epg/styles.theme.css src/modules/ui/epg/styles.info-panel.css src/modules/ui/epg/styles.css` -> pass; `rg -n "border: var\\(--panel-border\\)|border-radius: var\\(--panel-radius\\)|box-shadow: var\\(--shadow-md\\)|\\.epg-info-panel\\.epg-info-mode-bleed" src/modules/ui/epg/styles.info-panel.css` -> matched only the retained bleed-mode selectors plus poster-wrap radius, confirming the base info-panel floating-card chrome remains retired; `rg -n "epg-info-button|epg-info-actions" src/modules/ui/epg/styles.info-panel.css src/modules/ui/epg/EPGInfoPanel.ts src/modules/ui/epg/__tests__/EPGInfoPanel.test.ts` -> no matches; `rg -n "epg-info-mode-theme-default" src/modules/ui/epg/EPGInfoPanel.ts src/modules/ui/epg/__tests__/EPGInfoPanel.test.ts src/modules/ui/epg/styles.info-panel.css src/modules/ui/epg/styles.theme.css` -> matched the runtime class application, the default-mode DOM assertion, and the remaining mode-specific styling; `rg -n "epg-library-pill|epg-library-picker-panel|epg-library-picker-item|forced-colors|\\.theme-swiss \\\\.epg-info-panel \\\\.epg-info-(backdrop|tags)|\\.theme-swiss \\\\.epg-(cell-meta|cell-subtitle)|!important" src/modules/ui/epg/styles.grid.css src/modules/ui/epg/styles.theme.css src/modules/ui/epg/__tests__/EPGLibraryTabs.test.ts src/modules/ui/epg/__tests__/epg-focused-overflow-style.test.ts` -> matched the new library-picker forced-colors block and the narrowed Swiss info-panel selector ownership, with no remaining Swiss `!important` or stale Swiss cell-meta/subtitle selector residue in the package seam; `npm run verify` -> pass`
  - Follow-ups: `none`
  - Handoff: `S3-W1` and `S3-EXIT` closed in the same pass; no further EPG follow-through execution unit remains

## Priority 4: Runtime Overlay Parity

- [x] `S4-W1` `pkg_runtime_overlay_parity` Runtime Overlay Parity
  - Backlog: `3` exact issues
  - Tier / effort / risk: `Tier 2` / `M` / `medium`
  - Execution shape: `2` serial execution units
  - Scope: move the intended runtime overlay family onto the shared theme-aware treatment without reopening onboarding/theme-immune surfaces
  - Exact membership: `docs/design/active-style-cleanup-package-map.json` -> `pkg_runtime_overlay_parity`
  - Status: `completed`
  - Plan: `docs/plans/2026-04-19-s4-s5-runtime-overlay-parity-accessibility.md`
  - Last touched: `2026-04-19`
  - Verification: `npm test -- --runInBand src/modules/ui/__tests__/runtime-overlay-style-contracts.test.ts src/modules/ui/channel-badge/__tests__/ChannelBadgeOverlay.test.ts src/modules/ui/channel-transition/__tests__/ChannelTransitionOverlay.test.ts src/modules/ui/channel-number-overlay/__tests__/ChannelNumberOverlay.test.ts src/modules/ui/playback-options/__tests__/PlaybackOptionsModal.test.ts` -> pass; `rg -n "theme-(glass|swiss|directv|ember-steel|slate-pine)|scrim-tint-rgb|playback-options-panel|exit-confirm-panel" src/modules/ui/channel-badge/styles.css src/modules/ui/channel-transition/styles.css src/modules/ui/channel-number-overlay/styles.css src/modules/ui/playback-options/styles.core.css src/modules/ui/playback-options/styles.theme.css src/modules/ui/exit-confirm/styles.css` -> matched the compact-overlay and modal parity selectors only in the approved runtime files; `npm run verify` -> pass
  - Follow-ups: `S4-EXIT` closed in the same pass after fresh manual smoke and workspace verification; the next owner is `lineup-cleanup-review` for the Priority 4 closeout gate before `S5-W1`
  - Handoff: request a Priority 4 cleanup review for `pkg_runtime_overlay_parity`; if that review is clean, start `S5-W1-S1` from the shared plan

## Priority 5: Runtime Accessibility Coverage

- [x] `S5-W1` `pkg_runtime_accessibility_coverage` Runtime Accessibility Coverage
  - Backlog: `5` exact issues
  - Tier / effort / risk: `Tier 2` / `M` / `medium`
  - Execution shape: `2` serial execution units
  - Scope: add the missing non-EPG runtime forced-colors coverage and related accessibility follow-through
  - Exact membership: `docs/design/active-style-cleanup-package-map.json` -> `pkg_runtime_accessibility_coverage`
  - Status: `completed`
  - Plan: `docs/plans/2026-04-19-s4-s5-runtime-overlay-parity-accessibility.md`
  - Last touched: `2026-04-19`
  - Verification: `npm test -- --runInBand src/modules/ui/__tests__/runtime-overlay-style-contracts.test.ts src/modules/ui/channel-badge/__tests__/ChannelBadgeOverlay.test.ts src/modules/ui/channel-transition/__tests__/ChannelTransitionOverlay.test.ts src/modules/ui/channel-number-overlay/__tests__/ChannelNumberOverlay.test.ts src/modules/ui/mini-guide/__tests__/MiniGuideOverlay.test.ts src/modules/ui/playback-options/__tests__/PlaybackOptionsModal.test.ts` -> pass; `rg -n "@media \\(forced-colors: active\\)|mini-guide-row\\.focused|channel-badge|channel-transition|channel-number-panel|playback-options-item\\.(focused|selected)|playback-options-item:focus-visible" src/modules/ui/mini-guide/styles.core.css src/modules/ui/channel-badge/styles.css src/modules/ui/channel-transition/styles.css src/modules/ui/channel-number-overlay/styles.css src/modules/ui/playback-options/styles.core.css src/modules/ui/playback-options/styles.theme.css` -> matched only the approved S5 runtime files/selectors; `npm run verify` -> pass
  - Follow-ups: `S5-EXIT` closed in the same pass after fresh package verification and the remaining manual Playback Options proof; the required Priority 5 cleanup review later cleared, so the next owner is `S6-W1`
  - Handoff: start `S6-W1-S1` from `docs/plans/2026-04-19-s6-s7-settings-onboarding-style-polish.md`

## Priority 6: Settings / Playback Polish

- [x] `S6-W1` `pkg_settings_playback_polish` Settings / Playback Polish
  - Backlog: `3` exact issues
  - Tier / effort / risk: `Tier 2` / `S-M` / `low-medium`
  - Execution shape: `1` serial execution unit
  - Scope: close the local playback/settings polish issues without widening into parity or broad token migration
  - Exact membership: `docs/design/active-style-cleanup-package-map.json` -> `pkg_settings_playback_polish`
  - Status: `completed`
  - Plan: `docs/plans/2026-04-19-s6-s7-settings-onboarding-style-polish.md`
  - Last touched: `2026-04-19`
  - Verification: `npm test -- --runInBand src/modules/ui/__tests__/runtime-overlay-style-contracts.test.ts src/modules/ui/settings/__tests__/SettingsScreen.test.ts src/modules/ui/playback-options/__tests__/PlaybackOptionsModal.test.ts` -> pass; `rg -n "border-radius: 18px 18px 0 0|font-weight: 560" src/modules/ui/exit-confirm/styles.css src/modules/ui/settings/styles.core.css` -> no matches; `rg -n "animation-delay: (210|240|270|300|330|360)ms" src/modules/ui/playback-options/styles.core.css src/modules/ui/playback-options/styles.motion.css` -> no matches; `npm run verify` -> pass
  - Follow-ups: `S6-EXIT` closed in the same pass with refreshed proof; no `S6` residue remains and `S7-W1` must stay behind a fresh plan rather than opening implementation directly
  - Handoff: start `lineup-cleanup-plan` for `S7-W1` after `S6-EXIT`

## Priority 7: Onboarding Token Cleanup

- [x] `S7-W1` `pkg_onboarding_token_cleanup` Onboarding Token Cleanup
  - Backlog: `3` exact issues
  - Tier / effort / risk: `Tier 2` / `M` / `medium`
  - Execution shape: `2` serial execution units
  - Scope: clean up onboarding-only token drift while preserving theme-immune product intent
  - Exact membership: `docs/design/active-style-cleanup-package-map.json` -> `pkg_onboarding_token_cleanup`
  - Status: `completed`
  - Plan: `docs/plans/2026-04-19-s7-onboarding-token-cleanup.md`
  - Last touched: `2026-04-19`
  - Verification: `rg -n "#ffd2a0|#8cc2ff|#ffd0ba|rgba\\(255, 176, 90|rgba\\(76, 153, 255|rgba\\(255, 136, 87" src/modules/ui/profile-select/styles/cards.css` -> no matches; `rg -n "font-size: calc\\(34px|font-size: 12px|font-size: 22px|font-size: 28px|font-size: calc\\(22px|font-size: calc\\(15px|font-size: 0\\.75rem|font-size: 0\\.72rem|font-size: 0\\.94rem|font-size: 1\\.1rem|font-size: 0\\.9rem" src/styles/shell.onboarding.shared-shell.css src/styles/shell.onboarding.server-selection.css src/modules/ui/profile-select/styles/cards.css src/modules/ui/profile-select/styles/pin-modal.css src/modules/ui/server-select/styles.css src/modules/ui/channel-setup/styles.review-progress.css src/modules/ui/audio-setup/styles.css` -> no matches; `rg -n -- "--onboarding-badge-(lock|admin|restricted)-(bg|border|text)|font-size: calc\\(var\\(--text-(2xl|lg)\\)|font-size: var\\(--text-(xl|md|xs)\\)" src/styles/shell.onboarding.shared-shell.css src/styles/shell.onboarding.server-selection.css src/modules/ui/profile-select/styles/cards.css src/modules/ui/profile-select/styles/pin-modal.css src/modules/ui/server-select/styles.css src/modules/ui/channel-setup/styles.review-progress.css src/modules/ui/audio-setup/styles.css` -> matched only the approved onboarding files and shared-shell badge-token definitions; `npm test -- --runInBand src/modules/ui/profile-select/__tests__/ProfileSelectScreen.test.ts src/modules/ui/server-select/__tests__/ServerSelectScreen.test.ts src/modules/ui/channel-setup/steps/__tests__/BuildProgressStepController.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts src/modules/ui/audio-setup/__tests__/AudioSetupScreen.test.ts` -> pass; `npm run verify` -> pass
  - Follow-ups: `S7-EXIT` closed in the same pass; `S8-W1` is now the next owner for runtime token cleanup
  - Handoff: Priority 7 cleanup review is complete; `S8-W1` is now the next owner for runtime token cleanup

## Priority 8: Runtime Token Cleanup

- [x] `S8-W1` `pkg_runtime_token_cleanup` Runtime Token Cleanup
  - Backlog: `4` exact issues
  - Tier / effort / risk: `Tier 3` / `L` / `high`
  - Execution shape: `3` serial execution units
  - Scope: perform the broad runtime-only token follow-through after shared contracts, overlay parity, and EPG decomposition have removed the major ambiguity seams
  - Exact membership: `docs/design/active-style-cleanup-package-map.json` -> `pkg_runtime_token_cleanup`
  - Status: `completed`
  - Plan: `docs/plans/2026-04-19-s8-runtime-token-cleanup.md`
  - Last touched: `2026-04-19`
  - Verification: `rg -n "#ffffff|#eff8ff|#f0a060|#e0782a|rgba\(255, 106, 106, 0\.(8|95)\)|rgba\(255, 255, 255, 0\.(45|5|6|7|85|88|9|95)\)" src/modules/ui/settings/styles.core.css src/modules/ui/settings/styles.theme.css src/modules/ui/settings/styles.dropdown.css src/modules/ui/playback-options/styles.core.css src/modules/ui/exit-confirm/styles.css src/modules/ui/channel-badge/styles.css src/modules/ui/channel-transition/styles.css src/modules/ui/channel-number-overlay/styles.css src/modules/ui/player-osd/styles.content.css src/modules/ui/player-osd/styles.actions.css src/modules/ui/player-osd/styles.meta-progress.css src/modules/ui/now-playing-info/styles.core.css src/modules/ui/now-playing-info/styles.css src/modules/ui/mini-guide/styles.core.css src/styles/shell.chrome.css` -> no matches; `rg -n "rgba\(255, 255, 255, 0\.(92|98)\)" src/modules/ui/settings/styles.core.css src/modules/ui/settings/styles.theme.css src/modules/ui/settings/styles.dropdown.css src/modules/ui/playback-options/styles.core.css src/modules/ui/exit-confirm/styles.css src/modules/ui/channel-badge/styles.css src/modules/ui/channel-transition/styles.css src/modules/ui/channel-number-overlay/styles.css src/modules/ui/player-osd/styles.content.css src/modules/ui/player-osd/styles.actions.css src/modules/ui/player-osd/styles.meta-progress.css src/modules/ui/now-playing-info/styles.core.css src/modules/ui/now-playing-info/styles.css src/modules/ui/mini-guide/styles.core.css src/styles/shell.chrome.css` -> matched only `src/modules/ui/player-osd/styles.actions.css:22,24` and `src/modules/ui/exit-confirm/styles.css:116,118`; `npm test -- --runInBand src/modules/ui/__tests__/runtime-overlay-style-contracts.test.ts src/modules/ui/__tests__/runtime-token-style-contracts.test.ts` -> pass; `npm test -- --runInBand src/modules/ui/channel-badge/__tests__/ChannelBadgeOverlay.test.ts src/modules/ui/channel-transition/__tests__/ChannelTransitionOverlay.test.ts src/modules/ui/channel-number-overlay/__tests__/ChannelNumberOverlay.test.ts src/modules/ui/mini-guide/__tests__/MiniGuideOverlay.test.ts src/modules/ui/player-osd/__tests__/PlayerOsdOverlay.test.ts src/modules/ui/now-playing-info/__tests__/NowPlayingInfoOverlay.test.ts src/modules/ui/playback-options/__tests__/PlaybackOptionsModal.test.ts src/modules/ui/settings/__tests__/SettingsScreen.test.ts src/modules/ui/settings/__tests__/SettingsDropdown.test.ts` -> pass; `npm run verify` -> pass
  - Follow-ups: `S8-EXIT` remains the single exit owner for the deferred `style_audit::runtime_tokens::runtime_overlay_z_index_token_adoption` seam and the final cross-layer defer evidence; `S9-W1` stays blocked until `S8-EXIT` is complete
  - Handoff: start `S8-EXIT` from `docs/plans/2026-04-19-s8-runtime-token-cleanup.md` plus the completed typography/spacing/color evidence above; do not reopen `S8-W1`, and do not retry runtime z-index adoption outside `S8-EXIT`

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
  - Handoff: do not start until `S8-EXIT` is complete
