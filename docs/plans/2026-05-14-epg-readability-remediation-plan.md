# EPG Readability Remediation Plan

**Plan Status:** active

**Task family:** cleanup/refactor

**Cleanup subtype:** standalone remediation

## Goal

Produce one Tier 2 implementation-ready remediation slice for the grouped EPG readability defects observed in the 2026-05-14 Browser Use QA audit at the target `1920x1080` TV viewport:

- prevent the sticky current-time header label/current marker from visually overlapping the first future time-slot label after selecting `Library: Anime Home`;
- prevent current/live cell badges from rendering partial `LIVE` text such as dot plus `L` or `LIV` in constrained or partially visible current cells.

This is a runtime UI remediation inside the EPG module. It is not checklist-linked cleanup, and no `ARCHITECTURE_CLEANUP_CHECKLIST.md` item is updated by this plan.

## Non-Goals

- Do not remediate the blocking error overlay heading contrast finding; that remains a separate owner slice.
- Do not change first-run/auth/PIN/audio relink flows.
- Do not run destructive `Confirm & Replace` channel-build paths as part of verification.
- Do not target physical webOS playback or small viewport support.
- Do not change storage, Plex, auth, stream policy, channel scheduling contracts, or EPG data contracts.
- Do not redesign the navigation/focus system, modal contracts, or public virtualizer contracts.
- Do not make broad guide documentation changes. Only touch `docs/user-guide/epg.md` if the implementation discovers that the focused-cell/current-indicator contract needs clarification after source and runtime proof.

## Parent Architecture Alignment

The current architecture document treats `src/modules/ui/epg/` as the EPG UI module owner. This plan keeps the fix inside the EPG view/presentation seam:

- `EPGTimeHeader` and `styles.grid.css` own header slot/current-label readability.
- `EPGCellPresentation`, `EPGCellRenderer`, and `styles.cells.css` own in-cell width, live-badge, sliver, and focused-cell visual presentation.
- `EPGVirtualizer` may be touched only to reuse or correct existing `visibleWidthPx`/partial-cell geometry for presentation decisions. Any change to its public contract or grid data contract is a stop-and-replan event.

## Required Reading

Read these before implementation:

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/cleanup-implement.md`
4. `docs/agentic/codanna-playbook.md`
5. `docs/architecture/CURRENT_STATE.md`
6. `docs/design/ui-design-language.md`
7. `docs/user-guide/epg.md`
8. `docs/plans/2026-05-14-epg-readability-remediation-plan.md`
9. `docs/qa/reports/2026-05-14-browser-use-broad-smoke-qa.md`, if present in the workspace

Freshness gate: if any EPG files named in this plan have materially changed since the plan was written, rerun Codanna discovery and update this plan before implementing. The QA report was local-only/untracked at planning time; if it is absent, use this plan's Goal, Codanna Discovery, and Verification sections as the durable intake summary.

## Required Skills

- `ui-composition-patterns`
- `verification-strategy`
- `execution-plan-authoring`
- `review-adjudication` if the cleanup review returns findings before implementation
- `closeout-verification` before claiming implementation complete

Use `architecture-boundaries` only if implementation discovery shows the fix must cross out of the EPG view/presentation seam.

## Codanna Discovery

- `get_index_info`: index contained 12,601 symbols across 812 files; semantic search was enabled with 338 embeddings and updated about 30 minutes before planning.
- `semantic_search_with_context` for `EPG time header current marker sticky current-time label slot overlap lang:typescript`: anchored the header seam on `TimeSlot` usage in `src/modules/ui/epg/view/EPGTimeHeader.ts`, `refreshCurrentTime`/`setGridAnchorTime` in `EPGComponent`, and the current-time overlay host returned by `EPGVirtualizer.getContentElement`.
- `semantic_search_with_context` for `EPG live badge current cell visibleWidthPx sliver partial LIVE text presentation lang:typescript`: anchored the cell seam on `EPGVirtualizer.renderVisibleCells`, `CellRenderData.visibleWidthPx`, `VirtualizedGridState`, `calculateVisibleRange`, and the renderer/presentation helpers that consume `visibleWidthPx`.
- `search_documents` for EPG/QA phrases returned noisy workflow/eval hits rather than the EPG user guide or QA report. Fallback was direct reading of `docs/user-guide/epg.md`, `docs/design/ui-design-language.md`, and `docs/qa/reports/2026-05-14-browser-use-broad-smoke-qa.md`.
- `find_symbol`: `EPGTimeHeader` resolved to symbol `4251`; `EPGCellRenderer` resolved to symbol `4432`; `getCellWidthPresentation` resolved to symbol `4922`; `getVisibleTextMetrics` resolved to symbol `4896`; `EPGVirtualizer` resolved to symbol `4646`. `EPGCellPresentation` is a module file, not an aggregate symbol, so helper-level symbols were used.
- Direct-read/`rg` fallback covered CSS classes and tests because Codanna does not index CSS selector behavior. Direct reads confirmed relevant tests in `src/modules/ui/epg/__tests__/EPGTimeHeader.test.ts`, `src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts`, `src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts`, and `src/modules/ui/epg/__tests__/epg-focused-overflow-style.test.ts`.

## Impact Snapshot

- `analyze_impact` on `EPGTimeHeader` (`4251`) reported one affected class: `EPGComponent`.
- `analyze_impact` on `EPGCellRenderer` (`4432`) reported no detected dependents, so direct reads of `EPGVirtualizer` and renderer tests are the controlling fallback evidence.
- `analyze_impact` on `getCellWidthPresentation` (`4922`) reported five affected methods: `applyWidthPresentation`, `updateCellContent`, `reconcileVisibleCells`, `renderCell`, and `setFocusedCell`.
- `analyze_impact` on `getVisibleTextMetrics` (`4896`) reported three affected methods: `collectVisibleCells`, `computeVisibleTextMetrics`, and `collectCellsForScheduledRow`.
- `analyze_impact` on `EPGVirtualizer` (`4646`) reported one affected class: `EPGComponent`.

The impact radius is contained to EPG view composition and the existing EPG test surface. No public runtime, Plex, persistence, navigation, or app-shell boundary is implicated by the preferred fix.

## Files In Scope

Implementation files:

- `src/modules/ui/epg/view/EPGTimeHeader.ts`
- `src/modules/ui/epg/styles.grid.css`
- `src/modules/ui/epg/view/EPGCellRenderer.ts`
- `src/modules/ui/epg/view/EPGCellPresentation.ts`
- `src/modules/ui/epg/styles.cells.css`
- `src/modules/ui/epg/view/EPGVirtualizer.ts`, only if existing `visibleWidthPx`, sliver, or partial-cell geometry is insufficient without changing public contracts

Regression/proof files:

- `src/modules/ui/epg/__tests__/EPGTimeHeader.test.ts`
- `src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts`
- `src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts`
- `src/modules/ui/epg/__tests__/epg-focused-overflow-style.test.ts`, only if CSS selector contracts change

Conditional documentation:

- `docs/user-guide/epg.md`, only if implementation confirms the guide must clarify whether full focused/live context is guaranteed inside cells, in the detail panel, or both.

## Files Out Of Scope

- `ARCHITECTURE_CLEANUP_CHECKLIST.md`
- `docs/architecture/CURRENT_STATE.md`, unless implementation crosses an architecture boundary, which should stop and replan first
- `src/core/**`
- `src/modules/navigation/**`
- `src/modules/plex/**`
- `src/modules/player/**`
- `src/modules/ui/app-shell/**` and shared blocking error overlay code
- Channel setup, auth, PIN, server selection, audio setup, storage, and stream-resolution files

## Planner Self-Check

- No unresolved architecture seam remains: the selected seam is EPG view/presentation, not data, Plex, persistence, navigation, or app-shell orchestration.
- Adjacent type/contract changes are not assumed. If implementation needs new public `CellRenderData`/`VirtualizedGridState` fields or public virtualizer contract changes, stop and replan.
- No file is declared out of scope while still being required for mechanical wiring.
- Codanna results and direct-read fallbacks are recorded above.
- The plan assigns work to the repo-preferred owner instead of growing an app-shell or navigation hotspot.
- A fresh session has the key ownership, scope, and verification decisions needed to implement safely.
- No design/product decision remains open. The runtime contract is: time header labels must not overlap, and live/current badges must render either full `LIVE` or an intentional compact dot with no partial text.

## Architecture Seam Decision Gate

Proceed only while all remediation stays inside the EPG view/presentation seam:

- Header fix: prefer `EPGTimeHeader` plus `styles.grid.css`. The implementation should prevent partially clipped time-slot label fragments near the sticky current-time label, not merely hide the left part of a conflicting slot label.
- Live badge fix: prefer `EPGCellPresentation`/`EPGCellRenderer` plus `styles.cells.css`. The full `LIVE` label must be used only when the rendered visible space can show the complete badge; otherwise use the existing compact dot presentation intentionally.
- Virtualizer fix: allowed only when reusing or correcting existing local `visibleWidthPx`/partial/sliver geometry for presentation. Do not redesign the virtualizer API.
- Preserve focused-cell title, time-range, compact episode layout, movie overlay layout, progress fill, ticker behavior, and detail-panel update behavior.
- Preserve `aria-label="Currently playing"` on the live badge and forced-colors/prefers-reduced-motion behavior where relevant.

Stop and replan if:

- the fix requires changing EPG data contracts, public virtualizer contracts, navigation/focus routing, persistence/Plex/auth/playback behavior, small viewport support, or unrelated guide redesign;
- Browser Use cannot reproduce or verify the finding and no deterministic substitute is available;
- current-source discovery shows either issue is already fixed before implementation begins;
- solving one issue regresses focused-cell title/time/live indicator behavior;
- the implementation needs to move responsibilities out of `src/modules/ui/epg/view` or make shared UI primitive changes.

## Execution Plan

1. Reconfirm current source and runtime state.
   - Rerun Codanna or direct reads if the files changed.
   - Start the local app only after source audit identifies the candidate fix, unless the implementer needs to reproduce the issue first.

2. Fix the time-header overlap.
   - Audit the projected slot label position around offsets where the current time is close to the first future slot, for example a `3:55 PM` sticky label with a `4:00 PM` slot five minutes to the right.
   - Replace the current "clip only by sticky label width" behavior with a presentation rule that prevents partial future-slot label fragments from rendering in the sticky label's occlusion/guard area.
   - Keep the time header stationary while slot content translates with scroll.
   - Add or update a deterministic `EPGTimeHeader` unit test around a near-boundary offset. The test should assert the DOM state or style/class contract that hides or suppresses the overlapping slot label, not pixel-perfect browser rendering.

3. Fix live/current badge partial clipping.
   - Use the existing `visibleWidthPx`, width tier, sliver, focused compact, and movie overlay signals to decide whether the full `LIVE` badge can render coherently.
   - Ensure constrained/partial current cells render either full `LIVE` or the compact dot, never partial text.
   - Add a required regression in `EPGVirtualizer.test.ts` for the actual rerender/reconcile path: an already-mounted current medium/wide cell starts with enough `visibleWidthPx` for full `LIVE`, then rerenders or scrolls into a constrained partial-visible state without changing total width tier or becoming a sliver, and the existing DOM badge flips to the compact dot. A renderer-level test may be added as supporting coverage, but it is not sufficient by itself.
   - Keep existing tests that require compact dots for narrow/tiny, focused compact, focused movie overlay, and sliver cells passing.

4. Check docs only if runtime contract changed.
   - If the implementation changes only in-grid readability and preserves the documented focused-cell/currently-airing behavior, do not edit `docs/user-guide/epg.md`.
   - If Browser proof shows the detail panel is the intended reliable fallback for full focused context while the grid intentionally compacts constrained cells, update `docs/user-guide/epg.md` narrowly to clarify that constrained cells may use compact indicators while the detail panel carries full focused context.

5. Run verification and closeout review.
   - Run targeted tests while iterating, then `npm run verify`.
   - Run Browser Use proof at `1920x1080`.
   - Route the implementation to `lineup-cleanup-review` before closeout.

## Verification Commands

- Verification classification: `broader integration/manual proof required`

Primary verification mode: `UX-manual` supported by targeted regression tests where the current seams are deterministic.

During implementation, run targeted tests first:

- Run: `npm test -- --runTestsByPath src/modules/ui/epg/__tests__/EPGTimeHeader.test.ts src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts`
- Expected: targeted EPG tests pass, including a new or updated deterministic proof for header near-slot suppression and live-badge compacting on constrained current cells.

Then run the full UI verification gate:

- Run: `npm run verify`
- Expected: typecheck, architecture verification, CSS lint, coverage, tool/contract/docs checks, bundle verification, and build all pass.

Browser Use proof:

1. Start the app with `npm run dev -- --host 127.0.0.1` if no suitable dev server is already running.
2. Open `http://127.0.0.1:5173/` at `1920x1080`.
3. Load or resume the existing signed-in/saved-lineup state.
4. Open the EPG with `G`.
5. Open the library filter and select `Anime Home`.
6. Inspect the left edge of the time header near the current-time marker. Expected: current-time label/current marker and future slot labels remain readable, with no combined strings like `3:55 PM0 PM`.
7. Inspect current-airing cells near the visible time-window edge. Expected: each current indicator renders as full `LIVE` or an intentional compact dot; no dot-plus-partial text such as `L` or `LIV`.
8. Sample D-pad focus movement across at least two programs. Expected: focus remains visible and the detail panel updates title/time/current-state context.
9. Record the observed current minute offset and the relevant header guard condition in closeout. If the wall-clock state is not near a slot boundary during Browser Use, explicitly tie the visual check back to the deterministic near-boundary test instead of treating the manual pass as the sole header proof.

Deterministic proof strategy:

- Header overlap is wall-clock/offset sensitive, so the implementation should add a source-level deterministic test around the near-slot geometry/presentation rule. If browser layout measurement is required and cannot be represented in jsdom, document the limitation in the implementation closeout and rely on the Browser Use 1920x1080 proof plus source audit of the guard calculation.
- Live badge clipping must receive deterministic `EPGVirtualizer.test.ts` coverage because `visibleWidthPx` is computed in the virtualizer and existing cells are refreshed through virtualizer position/content delta checks. Renderer-only coverage can prove the presentation helper, but it cannot prove the scroll/rerender path that exposed partial `LIVE` text.

If this plan is changed without UI code, run:

- Run: `npm run verify:docs`
- Expected: active plan structure and docs contracts pass.

## Rollback Notes

Rollback is local to EPG view/presentation:

- Revert changes in `EPGTimeHeader.ts`/`styles.grid.css` to restore previous header behavior.
- Revert changes in `EPGCellPresentation.ts`/`EPGCellRenderer.ts`/`styles.cells.css` and any conditional `EPGVirtualizer.ts` edits to restore previous badge behavior.
- Revert only the related EPG tests and optional `docs/user-guide/epg.md` wording.

No storage migrations, persisted settings, Plex/auth state, navigation contracts, or public virtualizer contracts should be involved. If any such change appears in the diff, stop and replan rather than relying on rollback.

## Commit Checkpoints

This is tracked Tier 2 remediation. After implementation and cleanup review approval, create one focused implementation checkpoint for the EPG runtime/test changes. Keep this active plan doc out of the implementation checkpoint unless the orchestrator explicitly chooses a separate tracked-doc commit.

Suggested checkpoint description:

```text
Fix EPG time header and live badge readability
```

## Review Request

Route the finished plan to `lineup-cleanup-review` before implementation.

```text
REVIEW_REQUEST
TASK: Review the Tier 2 standalone remediation plan for grouped EPG readability defects: time header/current-marker overlap and partial live/current badge text.
TASK_FAMILY: cleanup/refactor
CLEANUP_SUBTYPE: standalone remediation
TIER: Tier 2
REVIEW_TARGET: plan
PLAN_OR_ARTIFACT: docs/plans/2026-05-14-epg-readability-remediation-plan.md
FILES_IN_SCOPE:
- src/modules/ui/epg/view/EPGTimeHeader.ts
- src/modules/ui/epg/styles.grid.css
- src/modules/ui/epg/view/EPGCellRenderer.ts
- src/modules/ui/epg/view/EPGCellPresentation.ts
- src/modules/ui/epg/styles.cells.css
- conditional: src/modules/ui/epg/view/EPGVirtualizer.ts
- relevant EPG tests named in the plan
FILES_OUT_OF_SCOPE:
- blocking error overlay contrast
- first-run/auth/PIN/audio relink flows
- destructive Confirm & Replace execution
- physical webOS playback
- small viewport support
- storage/Plex/auth/stream policy
- broad navigation/modal contract rewrites
KEY_INVARIANTS:
- no checklist update; standalone remediation only
- keep fix inside EPG view/presentation seam
- no EPG data contract or public virtualizer contract redesign
- full LIVE or compact dot only; never partial LIVE text
- no header label overlap around current marker
- D-pad focus and detail-panel updates remain intact
VERIFICATION_RUN: Planner session must run npm run verify:docs after writing the plan. Implementation plan requires targeted EPG tests, npm run verify, and Browser Use proof at 1920x1080 with Library: Anime Home selected.
KNOWN_RISKS:
- header issue is wall-clock/offset sensitive and may need source-level deterministic guard plus Browser Use proof
- live badge issue may hide in partial medium/wide cells where total width and visible width differ
WHAT_TO_PRIORITIZE:
- scope creep across EPG boundaries
- insufficient deterministic proof for time-header guard
- missing live-badge regression for partial visible width
- regressions to focused-cell title/time/live indicator behavior
OUTPUT_EXPECTATION:
- Lead with findings ordered by severity.
- Cite exact plan sections and source files where possible.
- Separate blockers from optional improvements.
- Say explicitly if no blocking findings are found.
```

## Next Session Handoff

```text
NEXT_SESSION_LAUNCHER: lineup-cleanup-review

TASK: Review the Tier 2 standalone remediation implementation plan for grouped EPG readability defects from the 2026-05-14 Browser Use QA audit: (1) time header/current-marker overlap at 1920x1080 after selecting Library: Anime Home, and (2) live/current badge partial text such as dot+L or dot+LIV in current cells.

TASK_FAMILY: cleanup/refactor
CLEANUP_SUBTYPE: standalone remediation
TIER: Tier 2

PLAN: docs/plans/2026-05-14-epg-readability-remediation-plan.md
ARTIFACT: docs/plans/2026-05-14-epg-readability-remediation-plan.md

FILES:
- docs/plans/2026-05-14-epg-readability-remediation-plan.md
- src/modules/ui/epg/view/EPGTimeHeader.ts
- src/modules/ui/epg/styles.grid.css
- src/modules/ui/epg/view/EPGCellRenderer.ts
- src/modules/ui/epg/view/EPGCellPresentation.ts
- src/modules/ui/epg/styles.cells.css
- src/modules/ui/epg/view/EPGVirtualizer.ts
- src/modules/ui/epg/__tests__/EPGTimeHeader.test.ts
- src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts
- src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts
- src/modules/ui/epg/__tests__/epg-focused-overflow-style.test.ts
- docs/user-guide/epg.md

MESSAGE:
Use the Review Request block in the plan. This is standalone remediation with no checklist update. Verify the plan is decision-complete, keeps ownership inside the EPG view/presentation seam, includes adequate deterministic proof for the time-header and live-badge issues, and preserves the required 1920x1080 Browser Use proof before implementation routes to lineup-cleanup-implement.
```
