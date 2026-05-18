**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** standalone remediation

# EPG Episode Title Policy Drift Remediation Plan

## Goal

Remediate `review::.::holistic::design_coherence::epg_episode_title_policy_drift` by giving EPG episode title presentation one small owner and making the EPG cell and info panel consume the same show-title derivation policy.

`ready_now_execution_unit: EPG-title-policy-drift`

The execution unit extracts episode show/title presentation policy out of duplicated UI classes, preserves current visual behavior where already tested, and adds direct contract proof for both full-title formats:

- `Show - SxxExx - Episode`
- `Show - Episode`

## Non-Goals

- Do not implement code in this planning session.
- Do not update `ARCHITECTURE_CLEANUP_CHECKLIST.md`; this is standalone remediation unless the controller intentionally promotes it later.
- Do not run Desloppify disposition commands in the planning session.
- Do not change EPG startup initialization, schedule refresh, focus navigation, grid virtualization, cell timing, ticker behavior, poster loading, dynamic background loading, clear-logo preferences, constants, JSDoc, or error consistency.
- Do not create a broad EPG utility barrel or compatibility shim.
- Do not move Plex, scheduler, persistence, navigation, or app-shell policy into EPG view helpers.
- Do not grow any allowlisted EPG hotspot file beyond its current file-shape baseline.

## Parent Architecture Alignment

This standalone remediation follows `docs/architecture/CURRENT_STATE.md` and the current EPG owner shape:

- EPG UI remains under `src/modules/ui/epg/`.
- Cell rendering stays in `src/modules/ui/epg/view/cells/EPGCellRenderer.ts`.
- Pure cell presentation helpers currently live in `src/modules/ui/epg/view/cells/EPGCellPresentation.ts`.
- Info panel DOM/rendering behavior stays in `src/modules/ui/epg/view/info-panel/EPGInfoPanel.ts`.
- Shared episode-title display policy should not be owned privately by either the cell surface or the info panel surface.

The intended owner is a small EPG view-level presentation policy module, not a new cross-module domain utility. It may import only EPG view/types needed to shape UI display text and must remain DOM-free.

## Required Reading

Read in this order before implementation or review:

1. `docs/AGENTIC_DEV_WORKFLOW.md`
2. `agents.md`
3. `docs/agentic/session-prompts/cleanup-loop.md`
4. `docs/agentic/codanna-playbook.md`
5. `docs/architecture/CURRENT_STATE.md`
6. `docs/architecture/file-shape-guardrails.md`
7. `docs/agentic/plan-authoring-standard.md`
8. this plan
9. `src/modules/ui/epg/view/cells/EPGCellPresentation.ts`
10. `src/modules/ui/epg/view/info-panel/EPGInfoPanel.ts`
11. `src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts`
12. `src/modules/ui/epg/__tests__/EPGInfoPanel.test.ts`
13. `src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts`

Freshness gate: if any in-scope source/test file, `docs/architecture/CURRENT_STATE.md`, or `docs/architecture/file-shape-guardrails.md` changed materially after this plan was written, refresh this plan before implementation.

## Required Skills

- `lineup-cleanup-loop`
- `architecture-boundaries`
- `ui-composition-patterns`
- `verification-strategy`
- `execution-plan-authoring`
- `review-request`
- `review-adjudication` for any plan-review or implementation-review findings
- `closeout-verification`
- `desloppify`

## Codanna Discovery

- `get_index_info`: 12712 symbols across 819 files; semantic search enabled; index updated about 17 hours before this plan.
- `semantic_search_with_context "EPG episode title show title presentation policy EPGInfoPanel EPGCellPresentation extractShowTitleFromFullTitle"`: found `EPGInfoPanel` at `src/modules/ui/epg/view/info-panel/EPGInfoPanel.ts`, symbol `4940`, and did not surface `EPGCellPresentation` as a class/module owner.
- `find_symbol EPGInfoPanel`: found class `EPGInfoPanel`, symbol `4940`, at `src/modules/ui/epg/view/info-panel/EPGInfoPanel.ts:41-889`, implemented by `IEPGInfoPanel` and used by `EPGComponent`.
- `find_symbol EPGCellPresentation`: no symbol found. This triggered the index freshness/fallback path.
- `search_symbols extractShowTitleFromFullTitle`: found two duplicate symbols: private method in `EPGInfoPanel.ts` and local function in `EPGCellPresentation.ts`.
- `search_symbols EPGCellPresentation`: no symbol found, even though direct source exists at `src/modules/ui/epg/view/cells/EPGCellPresentation.ts`.
- `get_calls 4940` and `find_callers 4940`: insufficient for class impact; no function-level call graph was returned for the class symbol.
- `analyze_impact`: not available in this session's exposed Codanna tool list. The fallback impact proof is direct source and `rg` reads of current EPG imports/tests.
- `search_documents "EPG episode title show title presentation policy info panel cell architecture"`: weak/noisy; results were eval prompt summaries, not EPG architecture guidance.
- Direct fallback reads: `EPGCellPresentation.ts`, `EPGInfoPanel.ts`, `EPGCellRenderer.ts`, `EPGVirtualizer.test.ts`, `EPGInfoPanel.test.ts`, `EPGCellRenderer.test.ts`, `CURRENT_STATE.md`, `file-shape-guardrails.md`, and active EPG/design remediation plans.

## Impact Snapshot

Current source proof:

- `src/modules/ui/epg/view/cells/EPGCellPresentation.ts` owns `getProgramCellTextLayout()` and a local `extractShowTitleFromFullTitle(fullTitle, episodeTitle)` helper.
- The cell helper handles both `Show - SxxExx - Episode` and `Show - Episode` by comparing `fullTitle` with the normalized episode title suffix.
- `src/modules/ui/epg/view/info-panel/EPGInfoPanel.ts` owns a private `extractShowTitleFromFullTitle(fullTitle)` method and `getEffectiveShowTitle()`.
- The info-panel helper handles only the `Show - SxxExx - Episode` format. It does not handle the `Show - Episode` suffix format that cells already support.
- `EPGInfoPanel.ts` also uses the derived show title for the visible series eyebrow and poster `alt` text through `applyTitleText()` and `showPoster()`.
- `EPGVirtualizer.test.ts` already proves cell behavior for `Scavengers Reign - Scavengers` and leading-code episode titles.
- `EPGInfoPanel.test.ts` already proves info-panel behavior for `Great Show - S01E01 - Episode Name`, but it lacks the no-season-code fallback that currently works for cells.

File-shape proof:

- `EPGCellPresentation.ts`: 388 lines, not allowlisted.
- `EPGInfoPanel.ts`: 889 lines, allowlisted at 889 lines with no routine line growth allowed.
- `EPGCellRenderer.ts`: 585 lines, allowlisted and out of implementation scope except as verification surface.
- `EPGVirtualizer.ts`: 930 lines, allowlisted and out of implementation scope.

Design-coherence risk:

- The drift is not a rendering-layout concern; it is duplicated presentation policy inside two UI view surfaces.
- Moving the policy into the renderer would grow the wrong owner. Moving it into scheduler/domain types would make a UI display fallback look like domain truth. A small EPG view-level presentation policy is the bounded long-term owner.

## Ready Now Execution Unit

`ready_now_execution_unit: EPG-title-policy-drift`

Execution target:

- Add one focused EPG view-level presentation policy module, expected path `src/modules/ui/epg/view/EPGEpisodeTitlePresentation.ts`.
- Move the shared episode title/show-title presentation policy into that module.
- Replace `EPGCellPresentation.ts`'s local show-title derivation and leading-code episode-title normalization with the shared policy.
- Replace `EPGInfoPanel.ts`'s private `extractShowTitleFromFullTitle()` and show-title derivation with the shared policy.
- Keep the helper DOM-free and EPG-local. It should not read preferences, touch poster/dynamic-background behavior, or depend on Plex/scheduler internals beyond existing EPG item types.

Approved policy contract:

- Explicit `item.showTitle` wins after trimming.
- If `showTitle` is absent, derive from `fullTitle` matching `Show - SxxExx - Episode`.
- If that does not match, derive from `fullTitle` ending with ` - <episode title>`.
- Strip a leading `SxxExx - ` prefix from the episode title before suffix comparison, preserving the cell behavior already tested for `Great Show - The Edge Of Recovery`.
- Return no derived show title when the computed show segment is empty or when the suffix comparison does not match.
- Preserve non-episode behavior in each caller.

Expected public helper shape:

- Prefer one exported helper that resolves the episode display state needed by both callers, for example `{ showTitle, episodeTitle }`.
- The exact function/type names are an implementation detail as long as the helper owns the policy above, remains small, and both callers consume it.

Required test coverage:

- Add direct helper tests in `src/modules/ui/epg/view/__tests__/EPGEpisodeTitlePresentation.test.ts`.
- Cover explicit `showTitle`, `Show - SxxExx - Episode`, `Show - Episode`, leading-code episode title normalization, whitespace trimming, and no-false-positive cases.
- Update `EPGInfoPanel.test.ts` to prove the no-season-code fallback, including visible `.epg-info-show` text and poster `alt` text for an episode shaped like `Scavengers Reign - Scavengers`.
- Keep existing `EPGVirtualizer.test.ts` cell assertions passing; add only narrow assertions there if implementation removes or weakens the current no-season-code and leading-code proof.

Exit condition:

- There is exactly one production owner for episode show-title derivation.
- `EPGCellPresentation.ts` and `EPGInfoPanel.ts` no longer each implement their own `extractShowTitleFromFullTitle`.
- Cell and info-panel surfaces agree on the two full-title formats listed in `## Goal`.
- `EPGInfoPanel.ts` does not exceed its 889-line file-shape baseline.

## Files In Scope

Production files:

- `src/modules/ui/epg/view/EPGEpisodeTitlePresentation.ts` (new)
- `src/modules/ui/epg/view/cells/EPGCellPresentation.ts`
- `src/modules/ui/epg/view/info-panel/EPGInfoPanel.ts`

Test files:

- `src/modules/ui/epg/view/__tests__/EPGEpisodeTitlePresentation.test.ts` (new)
- `src/modules/ui/epg/__tests__/EPGInfoPanel.test.ts`
- `src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts`
- `src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts`

Existing EPGVirtualizer and EPGCellRenderer tests are in scope for verification and narrow updates only if imports or shared policy behavior require them. They are not a license to rewrite virtualization, rendering, focus, ticker, or layout behavior.

## Files Out Of Scope

- `ARCHITECTURE_CLEANUP_CHECKLIST.md`
- `.desloppify` state except through later controller-approved disposition commands
- `docs/architecture/CURRENT_STATE.md` unless implementation proves the EPG owner map changed materially; closeout must explicitly audit the existing EPG presentation-owner claim and either leave it source-true or update it in the same pass
- `docs/architecture/file-shape-guardrails.md` unless implementation unexpectedly changes an allowlisted EPG baseline, which should be avoided
- `src/modules/ui/epg/component/EPGComponent.ts`
- `src/modules/ui/epg/view/EPGVirtualizer.ts`
- `src/modules/ui/epg/view/cells/EPGCellRenderer.ts`
- `src/modules/ui/epg/view/info-panel/EPGInfoPanelDetailsLoader.ts`
- `src/modules/ui/epg/view/info-panel/EPGInfoPanelDynamicBackground.ts`
- EPG startup, refresh runtime, focus navigator, shell view, channel list, time header, library tabs, and CSS
- scheduler/channel-manager, Plex, player, navigation, app-shell, persistence, and settings modules

Out-of-scope files may be read for impact verification, but implementation must stop and replan before editing them.

## Planner Self-Check

1. Unresolved seam: none for this unit. Shared episode title presentation policy belongs in a small EPG view-level policy module, not in either caller class.
2. Adjacent contract changes: none approved. EPG component, virtualizer, scheduler item types, Plex details, settings stores, poster loading, and dynamic background contracts are frozen.
3. Out-of-scope reliance: `EPGVirtualizer` and `EPGCellRenderer` remain verification surfaces only; the shared helper can be consumed through existing cell presentation helpers without editing those owners.
4. Codanna evidence and fallback reads are recorded, including the missing `EPGCellPresentation` symbol and unavailable `analyze_impact` tool.
5. Owner fit: the plan removes duplicated policy from an allowlisted hotspot and a cell helper instead of growing either view surface.
6. Fresh-session readiness: a worker can implement this without choosing among owner locations, verification depth, or Desloppify disposition policy.
7. Execution-grade status: yes, pending controller plan review. The unit has exact files, policy contract, tests, stop conditions, and verification commands.

## Architecture Seam Decision Gate

Implement only `ready_now_execution_unit: EPG-title-policy-drift`.

Approved seam:

- `EPGEpisodeTitlePresentation.ts` owns episode display-text policy shared by EPG cells and the info panel.
- `EPGCellPresentation.ts` owns cell-specific layout decisions, width tiers, ticker measurement helpers, episode tag display, and time visibility.
- `EPGInfoPanel.ts` owns info-panel DOM, poster/background updates, preferences, details loading, and title application to existing elements.

Replan before implementation continues if any of these become necessary:

- editing any file listed out of scope
- changing `ScheduledProgram` or scheduler item type contracts
- changing EPG component construction, virtualizer rendering, focus navigation, startup/runtime refresh, or CSS
- moving poster, dynamic-background, clear-logo, media-quality, preference, or async details-loader behavior
- creating a generic cross-module title utility outside the EPG view boundary
- adding compatibility wrappers, fallback branches, or duplicate helper variants
- adding private probes or test-only methods
- growing `EPGInfoPanel.ts` above its 889-line allowlist baseline
- updating `docs/architecture/file-shape-guardrails.md` as routine bookkeeping instead of stopping on unexpected baseline growth
- broadening the plan into startup initialization, constants cleanup, JSDoc cleanup, or error-consistency work

Absorb-now policy:

- Absorb only import/signature fallout and narrow test-helper updates inside the exact in-scope files.
- Any new EPG layout, focus, async, persistence, Plex, scheduler, or navigation residue requires replan with one final owner.

## Verification Commands

- Verification classification: `new regression/contract test required`

Planning artifact verification:

- Docs proof mode: `broader integration/manual proof required`
- Run: `npm run verify:docs`
- Expected: passes with this active tracked plan satisfying the serious-plan standard.

Implementation verification:

- Proof surface: direct helper contract tests plus existing cell/info-panel behavior tests.
- Run: `npm test -- --runTestsByPath src/modules/ui/epg/view/__tests__/EPGEpisodeTitlePresentation.test.ts src/modules/ui/epg/__tests__/EPGInfoPanel.test.ts src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts`
- Expected: helper tests prove the shared policy; info panel now proves `Show - Episode`; existing cell/renderer tests preserve focused/unfocused episode title, subtitle, tag, ticker, and layout behavior.
- Run: `npm run typecheck`
- Expected: both EPG callers import the shared helper with no stale private `extractShowTitleFromFullTitle` references.
- Run: `npm run verify:maintainability`
- Expected: production file-shape guardrail passes; `EPGInfoPanel.ts` stays at or below 889 lines, and no allowlisted EPG file grows beyond baseline.
- Run: `npm run verify`
- Expected: full UI/navigation/Plex-adjacent repo verification passes because the touched EPG surfaces are user-visible TV UI.

Why this depth matches risk:

- The task is behavior-preserving for cells but corrective for the info panel, and the drift is a shared presentation contract. Direct helper tests are required so future caller changes cannot fork the policy again.
- `npm run verify` is required after implementation because EPG cells and the info panel are user-visible UI surfaces with layout, focus-adjacent, and Plex-data presentation behavior.

## Desloppify Disposition Expectations

Do not run these commands until after implementation, verification, and clean review. Run authoritative Desloppify evidence and disposition commands only on the receiving integration branch, not from a detached worktree copy.

Expected evidence check for this finding only:

```bash
desloppify show "review::.::holistic::design_coherence::epg_episode_title_policy_drift" --status open --code
```

Expected disposition command shape if source proof and verification are clean:

```bash
desloppify plan resolve "review::.::holistic::design_coherence::epg_episode_title_policy_drift" \
  --note "Fixed by extracting one EPG episode title presentation policy owner consumed by cells and info panel; verified with direct helper tests plus EPG info panel and cell behavior tests." \
  --attest "I have actually verified the EPG episode title presentation policy drift is fixed in current source and I am not gaming the score."
```

If the issue wording remains stale after current-source proof, keep this same EPG title presentation module as final owner and record the current-source proof in the disposition note rather than inventing a split follow-up.

## Rollback Notes

- If the shared helper breaks existing cell behavior, revert the caller imports first and compare against the helper contract tests before changing UI layout code.
- If info-panel poster `alt` or clear-logo fallback behavior regresses, keep the shared show-title policy and fix only the info-panel application path; do not restore private title derivation.
- If the helper starts needing scheduler, Plex, settings, or DOM knowledge, stop and replan because the chosen owner is too broad or the task has crossed an unapproved boundary.

## Commit Checkpoints

- Do not stage or commit this plan during planning closeout unless the controller/user explicitly asks.
- Implementation should use one focused commit for the EPG title-policy remediation after tests, `npm run verify:maintainability`, and `npm run verify` pass.
- Keep active tracked plan docs out of the implementation commit unless the controller explicitly chooses a separate tracked-doc commit.
