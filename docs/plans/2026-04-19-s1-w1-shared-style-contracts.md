# S1-W1 Shared Style Contracts And Decision Locks Execution Plan

**Goal:** Complete `STYLE_CLEANUP_CHECKLIST.md` item `S1-W1` by locking the shared style contracts that later packages depend on, without widening into EPG decomposition, runtime parity migration, or onboarding cleanup work that belongs to later packages.

**Architecture:** Treat `S1-W1` as a checklist-linked, single-slice Tier 2 package. The package owns contract authority only: shared style/governance docs, shared token names/defaults, and the narrow direct proof callsites needed to retire phantom status-token ambiguity and the repeated focus-text literal. Overlay-stack callsite adoption and other broader surface migration remain owned by later packages.

**Tech Stack:** CSS, TypeScript-adjacent source audit, `rg`, `wc -l`, `npm run verify`, `npm run verify:docs`

---

**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked
**Tier:** Tier 2

## Goal

- Retire `S1-W1` / `pkg_shared_style_contracts` with one bounded execution unit that removes the shared style-policy ambiguity blocking later cleanup packages.
- Close the exact issue set owned by this package:
  - `style_audit::contracts::overlay_z_index_scale_missing`
  - `style_audit::contracts::server_select_phantom_status_tokens`
  - `style_audit::contracts::compact_radius_10px_undecided`
  - `style_audit::contracts::text_on_focus_token_missing`
- Leave the style cleanup program with one explicit authority surface for these decisions:
  - `docs/design/ui-design-language.md` for visual intent
  - `docs/design/css-governance.md` for CSS decision rules
  - `src/styles/tokens.css` and `src/styles/themes.css` for shared style contract definitions
- Keep `STYLE_AUDIT.md` as evidence/reference only; do not turn it back into the live checklist.

## Non-Goals

- Do not begin the EPG file split owned by `S2-W1`.
- Do not widen into compact-overlay theme parity work owned by `S4-W1`.
- Do not add forced-colors fixes owned by `S3-W1` or `S5-W1`.
- Do not run broad runtime token migration owned by `S8-W1`.
- Do not treat onboarding/theme-immune surfaces as parity defects.
- Do not modify `STYLE_AUDIT.md`.
- Do not add lint, CI, or token-enforcement behavior in this package.

## Parent Priority Alignment

- Parent checklist item: `STYLE_CLEANUP_CHECKLIST.md` -> `S1-W1` / `pkg_shared_style_contracts`.
- Companion-map authority: `docs/design/active-style-cleanup-package-map.json`.
- This is the first ready-now package because later work should not invent answers for:
  - overlay stack token names and ownership
  - server-select status-chip token policy
  - compact `10px` radius semantics
  - shared `--color-text-on-focus` naming
- `S1-W1` is intentionally Tier 2:
  - one package-scoped execution unit is enough
  - no multi-wave controller loop is required if the work stays on docs, shared token surfaces, and the narrow direct proof callsites named below
  - any need for broader surface migration is a stop-and-replan signal toward later packages, not a reason to silently escalate this package

## Required Reading

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/cleanup-implement.md`
4. `docs/agentic/plan-authoring-standard.md`
5. `STYLE_CLEANUP_CHECKLIST.md`
6. `docs/design/active-style-cleanup-package-map.json`
7. `STYLE_AUDIT.md`
8. `docs/design/ui-design-language.md`
9. `docs/design/css-governance.md`
10. `src/styles/tokens.css`
11. `src/styles/themes.css`
12. `src/modules/ui/server-select/styles.css`
13. `src/modules/ui/mini-guide/styles.core.css`
14. `src/modules/ui/player-osd/styles.surface.css`
15. `src/modules/ui/channel-badge/styles.css`
16. `src/modules/ui/channel-transition/styles.css`
17. `src/modules/ui/channel-number-overlay/styles.css`
18. `src/modules/ui/epg/styles.css`
19. `src/styles/video.css`
20. `src/styles/shell.chrome.css`
21. `src/modules/ui/player-osd/styles.actions.css`
22. `src/modules/ui/exit-confirm/styles.css`

Freshness gate:

- If `STYLE_CLEANUP_CHECKLIST.md`, `docs/design/active-style-cleanup-package-map.json`, `docs/design/ui-design-language.md`, or `docs/design/css-governance.md` changes materially before implementation starts, refresh this plan first.
- If `src/styles/tokens.css` or any direct proof callsite already changed to answer one of the four package issues, rerun the discovery commands below and update this plan instead of executing stale assumptions.
- If implementation discovers that closing one of these four issues requires broad runtime-surface migration, stop and replan toward `S4-W1`, `S7-W1`, or `S8-W1` instead of widening `S1-W1`.

## Required Skills

1. `verification-strategy`
2. `execution-plan-authoring`
3. `ui-composition-patterns` only if a proposed token adoption unexpectedly changes runtime chrome behavior
4. `verification-before-completion`

## Codanna Discovery

- Codanna was unavailable in this session, so this plan uses explicit fallback discovery only: tracked-doc reads, `rg`, direct source reads, and `wc -l`.
- Commands run for this planning pass:
  - `rg -n "#0a0d12|--color-status-(ok|error|warning)|2147483647|\\b780\\b|\\b800\\b|\\b850\\b|\\b860\\b|\\b900\\b|\\b999\\b|10px|border-radius: 18px 18px 0 0" src/styles src/modules/ui`
    - results confirmed the current-source evidence surfaces relevant to this package:
      - overlay stack literals at `mini-guide`, `player-osd`, `channel-badge`, `channel-transition`, `channel-number-overlay`, `epg`, `video.css`, and `shell.chrome.css`; these inform the shared contract but remain adoption work for later packages
      - nine undeclared `--color-status-*` references in `src/modules/ui/server-select/styles.css`
      - repeated `10px` radius/gap usage across runtime and onboarding surfaces
      - repeated `#0a0d12` literals in `player-osd`, `exit-confirm`, and `epg`
      - the local `18px 18px 0 0` exit-confirm radius
  - `wc -l src/modules/ui/epg/styles.css src/modules/ui/server-select/styles.css src/styles/tokens.css src/styles/themes.css src/modules/ui/channel-badge/styles.css src/modules/ui/channel-transition/styles.css src/modules/ui/channel-number-overlay/styles.css src/modules/ui/exit-confirm/styles.css src/modules/ui/playback-options/styles.core.css src/modules/ui/settings/styles.core.css`
    - results observed in this session:
      - `src/modules/ui/epg/styles.css`: `2065`
      - `src/modules/ui/server-select/styles.css`: `122`
      - `src/styles/tokens.css`: `202`
      - `src/styles/themes.css`: `254`
      - `src/modules/ui/channel-badge/styles.css`: `51`
      - `src/modules/ui/channel-transition/styles.css`: `98`
      - `src/modules/ui/channel-number-overlay/styles.css`: `61`
      - `src/modules/ui/exit-confirm/styles.css`: `142`
      - `src/modules/ui/playback-options/styles.core.css`: `230`
      - `src/modules/ui/settings/styles.core.css`: `305`
  - `rg -n "forced-colors|prefers-reduced-motion|playback-item-enter|font-weight:\\s*560|font-size:\\s*(10px|12px|13px|15px|22px|25px|28px|34px|0\\.72rem|0\\.75rem|0\\.94rem|1\\.1rem)" src/modules/ui src/styles`
    - results were used to confirm that:
      - forced-colors follow-through remains package-local to `S3-W1` and `S5-W1`
      - settings/playback polish remains package-local to `S6-W1`
      - onboarding mixed-unit and off-scale typography work remains package-local to `S7-W1`
- Planning conclusion from fallback discovery:
  - `S1-W1` can stay bounded if it limits itself to shared contract authority plus the direct proof callsites for server-select status tokens and focus-text token consumers
  - overlay-stack callsite adoption is still real work, but it belongs to later packages

## Impact Snapshot

- Shared authority surfaces impacted:
  - `docs/design/ui-design-language.md`
  - `docs/design/css-governance.md`
  - `src/styles/tokens.css`
  - `src/styles/themes.css` if any shared default/override mapping belongs there instead of `tokens.css`
- Direct proof callsites that may be touched to make the shared contract real and inspectable:
  - `src/modules/ui/server-select/styles.css`
  - `src/modules/ui/player-osd/styles.actions.css`
  - `src/modules/ui/exit-confirm/styles.css`
- Later packages directly unblocked by this package:
  - `S2-W1` can decompose EPG without simultaneously inventing z-index/radius/focus-token policy
  - `S4-W1` can focus on runtime parity rather than shared contract naming
  - `S7-W1` and `S8-W1` can consume the locked compact-radius and token decisions instead of relitigating them

## Files In Scope

- `STYLE_CLEANUP_CHECKLIST.md` for `S1-W1` / `S1-EXIT` mini-record updates in the implementation closeout pass
- `docs/design/ui-design-language.md`
- `docs/design/css-governance.md`
- `src/styles/tokens.css`
- `src/styles/themes.css` only if the final shared contract belongs there
- `src/modules/ui/server-select/styles.css`
- `src/modules/ui/player-osd/styles.actions.css`
- `src/modules/ui/exit-confirm/styles.css`

## Files Out Of Scope

- `STYLE_AUDIT.md`
- `docs/design/active-style-cleanup-package-map.json` unless package membership or routing assumptions are proven wrong
- any EPG file split or EPG selector re-architecture owned by `S2-W1`
- any compact-overlay theme-tint work owned by `S4-W1`
- any forced-colors work owned by `S3-W1` or `S5-W1`
- any settings/playback motion or weight tuning owned by `S6-W1`
- any onboarding token follow-through beyond the shared contract decisions owned by `S7-W1`
- any broad runtime typography/spacing/color migration owned by `S8-W1`
- any onboarding bootstrap or inline-style ownership cleanup owned by `S9-W1`

## Planner Self-Check

1. Is there any unresolved architecture seam, ownership seam, or policy boundary hidden inside the task?
   - No. The package owns shared contract authority only; broader migration packages remain separate.
2. Does the plan depend on adjacent files needing contract or type changes that are not in scope?
   - No. Later packages consume the locked contracts, but `S1-W1` does not require their implementation to close its own issue set.
3. Am I declaring any file out of scope that implementation would still implicitly rely on?
   - No. If closing one of the four issues requires more than the named proof callsites, the package must stop and replan.
4. Did I record the full discovery path plus explicit fallback notes?
   - Yes. Codanna unavailability and the `rg`/direct-read/`wc` fallback are explicit.
5. Am I shrinking ambiguity instead of growing a new hotspot?
   - Yes. The package centralizes shared contract decisions into docs and style foundations, then stops.
6. Would a fresh implementation session have to invent anything important to execute safely?
   - No. The issue set, file seam, verification, and stop conditions are explicit.
7. Is this still a Tier 2 package after current-source review?
   - Yes. One serial execution unit is enough if the package refuses broad migration scope creep.

## Architecture Seam Decision Gate

- Chosen seam 1: shared style-contract authority lives in docs plus the shared style foundation.
  - Implementation target: document the approved decisions in `docs/design/ui-design-language.md` and/or `docs/design/css-governance.md`, then encode the shared token/default contract in `src/styles/tokens.css` and `src/styles/themes.css` only where theme/default ownership actually belongs.
- Chosen seam 2: `S1-W1` may touch direct proof callsites only when doing so proves the contract is real without widening the package.
  - Approved proof callsites: `src/modules/ui/server-select/styles.css` and the direct focus-text consumers named above.
- Chosen seam 3: onboarding/theme-immune surfaces stay outside runtime parity.
  - `Server Select` is in scope only for phantom status-token cleanup, not for parity work.
- Explicit no-crossing rules:
  - if implementation needs overlay-stack callsite adoption or EPG selector/layout changes beyond documenting the shared contract, stop and replan toward `S2-W1`, `S4-W1`, or `S8-W1` based on the proven owner
  - if implementation needs compact-overlay tint or per-theme visual retuning, stop and replan toward `S4-W1`
  - if implementation needs onboarding typography, badge-color, or bootstrap follow-through, stop and replan toward `S7-W1` or `S9-W1`
  - if implementation needs broad runtime typography/spacing/color adoption, stop and replan toward `S8-W1`
- Explicit anti-slop rule:
  - do not create placeholder tokens with no authoritative doc decision behind them, and do not close the package with doc-only prose if the shared contract is still missing from the style foundation

## Package Decomposition

- `package_id`: `pkg_shared_style_contracts`
- `checklist_token`: `S1-W1`
- `package_issue_ids`:
  - `style_audit::contracts::overlay_z_index_scale_missing`
  - `style_audit::contracts::server_select_phantom_status_tokens`
  - `style_audit::contracts::compact_radius_10px_undecided`
  - `style_audit::contracts::text_on_focus_token_missing`
- `coverage_check`:
  - all four package issues map to exactly one planned slice
  - no package issue is deferred outside `S1-W1`
- `ready_now_slice`: `S1-W1-S1`
- `ready_now_execution_unit`: `S1-W1-S1`
- `recommended_slice_order`:
  - `S1-W1-S1`
- `parallel_execution_policy`: `serial only`

`slice_table`

| slice_id | goal | areas/files | exact_issue_ids | verification | dependencies | stop_condition | handoff_condition | serial_only | parallel_justification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `S1-W1-S1` | Lock shared contract docs/tokens, resolve phantom status-token ambiguity, and make the overlay stack authority explicit without widening into migration packages. | `docs/design/ui-design-language.md`, `docs/design/css-governance.md`, `src/styles/tokens.css`, `src/styles/themes.css`, `src/modules/ui/server-select/styles.css`, and the direct focus-text consumers listed in scope | `style_audit::contracts::overlay_z_index_scale_missing`, `style_audit::contracts::server_select_phantom_status_tokens`, `style_audit::contracts::compact_radius_10px_undecided`, `style_audit::contracts::text_on_focus_token_missing` | targeted `rg` source audit, `npm run verify`, `npm run verify:docs` if docs/checklist/plan surfaces changed | none | if the slice needs broad surface migration, parity tuning, forced-colors work, overlay-stack callsite adoption, or EPG decomposition to claim closure | reviewer can verify that shared contracts are explicit, direct proof callsites match them, and later packages remain narrower as a result | `yes` | docs and shared style foundations are shared write surfaces; parallel work would thrash the same authority files |

## Priority-Exit Readiness

- `S1-EXIT` can close only in the same pass that:
  - updates `STYLE_CLEANUP_CHECKLIST.md` with current `S1-W1` and `S1-EXIT` mini-records
  - records the exact disposition for each of the four package issue ids
  - confirms `STYLE_AUDIT.md` stayed evidence/reference only
  - confirms the next safe start remains `S2-W1`
- Allowed successor owners only if the package proves the issue is broader than expected:
  - shared-contract decisions that require onboarding-only follow-through -> `S7-W1`
  - shared-contract decisions that require broad runtime adoption -> `S8-W1`
  - any parity-specific residual discovered during direct proof -> `S4-W1`
- `S1-EXIT` must not invent new package membership. If current-source evidence shows the companion map is wrong, update `docs/design/active-style-cleanup-package-map.json` in the same pass or stop and replan first.

## Verification Commands

Primary verification mode: `refactor-invariance`

Plan classification: `no new automated test needed`

Why this proof depth matches the risk:

- `S1-W1` changes shared docs and CSS contract surfaces but is not supposed to change behavior beyond making the shared style contract explicit.
- Current risk is scope creep, not missing business logic tests.
- The highest-signal proof is source audit plus the standard UI verifier gate.

Exact commands and expected outcomes:

- `rg -n -- "--z-(mini-guide|player-osd|channel-badge|channel-transition|channel-number-overlay|epg|video|shell-chrome)" docs/design/ui-design-language.md docs/design/css-governance.md src/styles/tokens.css src/styles/themes.css`
  - expected: the shared authority surfaces now define the overlay stacking contract explicitly; runtime callsite adoption remains deferred to the later package that owns it
- `rg -n -- "--color-status-(ok|error|warning)" src/styles/tokens.css src/modules/ui/server-select/styles.css`
  - expected: the referenced `--color-status-*` tokens are now declared in the shared style foundation or the phantom syntax has been removed from `server-select`
- `rg -n -- "--radius-compact|--color-text-on-focus" docs/design/ui-design-language.md docs/design/css-governance.md src/styles/tokens.css src/styles/themes.css src/modules/ui/player-osd/styles.actions.css src/modules/ui/exit-confirm/styles.css`
  - expected: the compact-radius and text-on-focus contracts are explicit in the shared authority surfaces; direct proof callsites reference them if they were intentionally adopted here
- `npm run verify`
  - expected: pass
- `npm run verify:docs`
  - expected: pass whenever docs/checklist/plan surfaces changed in the same implementation pass

Why new tests are not needed:

- The package is shared-contract cleanup, not new behavior.
- Existing verifier coverage plus direct source audit is sufficient if the package stays inside the approved seam.

## Rollback Notes

- Roll back docs and shared token/default changes together; do not leave the repo with doc-only decisions that the style foundation does not implement.
- If overlay stacking changes unexpectedly at runtime, revert the overlay-contract change together with any same-pass proof edit that depended on it.
- If server-select status chips regress, revert the token contract change and the `server-select` callsite change in the same rollback.

## Commit Checkpoints

1. Shared contract authority
   - docs + shared token/default updates for overlay stack, compact radius, and text-on-focus naming
2. Direct proof callsites and closeout
   - server-select phantom-token resolution, any approved direct focus-token callsite adoptions, and checklist closeout updates
