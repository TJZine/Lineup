**Plan Status:** completed
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

# FCP-10 EPG Renderer Direct Confidence And Presentation Decomposition Plan

## Goal

Retire exactly `ARCHITECTURE_CLEANUP_CHECKLIST.md` item `FCP-10` by adding direct confidence around `EPGCellRenderer` public behavior, then separating pure presentation and text-layout policy from DOM mutation enough that the renderer remains the EPG cell DOM adapter instead of owning every display decision inline.

This is an `FCP-*` source-backed cleanup package. Coverage is defined only by checklist `source_finding_id` values `FCP-10-SF1` and `FCP-10-SF2`; do not use Desloppify, detector ids, imported review ids, package-map ids, or score deltas for intake, proof, or closeout.

## Non-Goals

- Do not reopen DCR-14 or broaden into `EPGComponent` shell/focus/runtime ownership work.
- Do not redesign EPG visuals, CSS, layout aesthetics, focus hooks, reduced-motion behavior, or ticker behavior.
- Do not rewrite `EPGVirtualizer` ownership; use it only for affected integration proof if renderer integration behavior changes.
- Do not change scheduler/channel data models, Plex behavior, persistence-backed settings, or app-shell/orchestrator wiring.
- Do not add test-only public APIs, private probes, compatibility shims, fallback branches, new dependencies, or framework changes.
- Do not update `FCP-11`, `FCP-12`, `FCP-EXIT`, or legacy detector-backed cleanup records from this plan.

## Parent Priority Alignment

`FCP-10` is the active source-backed final-cleanup package after completed `FCP-7` through `FCP-9`. It advances the final cleanup rule that each unchecked `FCP-*` row is planned and executed as one checklist-linked package through `cleanup-loop`, with source findings mapped exactly once before implementation begins.

The current architecture docs place EPG ownership under `src/modules/ui/epg/`, with `src/modules/ui/epg/view/` as the staged view-layer owner. `src/modules/ui/epg/view/EPGVirtualizer.ts` remains the virtualized-grid owner, while `EPGCellRenderer` is the package-local DOM adapter used by the virtualizer. This plan keeps that owner map intact and narrows only the renderer's direct confidence and local presentation/text-layout responsibilities.

## Required Reading

Read in this order before implementation or review:

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/README.md`
4. `docs/agentic/session-prompts/cleanup-loop.md`
5. `docs/agentic/plan-authoring-standard.md`
6. `docs/agentic/codanna-playbook.md`
7. `ARCHITECTURE_CLEANUP_CHECKLIST.md` sections `FCP Operating Rules` and `FCP-10`
8. `docs/architecture/CURRENT_STATE.md` `UI` and `Current Hotspots` sections
9. `docs/architecture/modules.md` `UI Modules` and `Current Hotspot Reference` sections
10. `docs/plans/2026-04-30-dcr-14-epg-component-file-health-follow-through.md` as completed background only; do not reopen DCR-14 or broad EPGComponent/virtualizer ownership work
11. This plan
12. Source and test files named under `## Files In Scope`
13. `git status --short --branch`

Freshness gate: before implementation, stop and refresh this plan if any of these changed materially: the `FCP-10` checklist row, EPG view ownership text in `CURRENT_STATE.md` or `modules.md`, `src/modules/ui/epg/view/EPGCellRenderer.ts`, `src/modules/ui/epg/view/EPGVirtualizer.ts`, `src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts`, `src/modules/ui/epg/view/__tests__/index.test.ts`, or this plan.

Planning observed the branch `code-health...origin/code-health [ahead 11]` with unrelated dirty/untracked paths. Preserve these unless the controller explicitly scopes them later: `docs/archive/plans/2026-04-30-dcr-10-oversized-test-suite-structure.md`, `docs/plans/2026-04-30-dcr-exit-final-dimension-audit-plan.md`, `scorecard.png`, `docs/agentic/evals/baseline-summaries/2026-04-28-prompt-13-feature-low-implementer-policy.md`, `docs/plans/2026-04-28-ai-generated-debt-hygiene-sweep.md`, `docs/plans/2026-04-28-cross-module-architecture-audit-plan.md`, `docs/plans/2026-04-28-cross-module-architecture-cleanup-checklist.md`, `docs/plans/2026-04-28-design-coherence-audit-checklist.md`, `docs/plans/2026-04-28-design-coherence-audit-plan.md`, `docs/plans/2026-04-28-plex-stream-url-policy-capability-cleanup-plan.md`, and `docs/plans/2026-05-01-server-select-list-view-extraction-plan.md`.

## Required Skills

- `architecture-boundaries`: keep the renderer decomposition inside the EPG view owner and avoid growing adjacent owners.
- `ui-composition-patterns`: preserve TV-visible DOM, focus, ticker, ARIA, and reduced-motion behavior while refactoring presentation policy.
- `verification-strategy`: use direct public-seam tests for current behavior before refactor-invariance work.
- `execution-plan-authoring`: keep the package decision-complete without writing patch prose.

Do not load `persistence-boundaries` unless an implementer unexpectedly proposes storage-backed behavior changes. That should normally stop and replan. Plex skills are not expected for this package.

## Codanna Discovery

- `get_index_info`: Codanna available; index contained 11,896 symbols across 775 files, semantic search enabled, updated about 51 minutes before planning.
- `find_symbol EPGCellRenderer`: found `src/modules/ui/epg/view/EPGCellRenderer.ts:61-785`, `symbol_id:4628`, class with 28 methods.
- `analyze_impact symbol_id:4628`: reported no impacted symbols. Treat this as insufficient for this seam because direct `rg` proves `EPGVirtualizer` imports, constructs, and calls the renderer.
- `get_calls symbol_id:4628`: reported no function calls. Treat as Codanna insufficiency for class-method internals, not proof that the class is behaviorally inert.
- `find_callers symbol_id:4628`: reported no callers. Treat as Codanna insufficiency because the virtualizer import/constructor path is present in source.
- `semantic_search_with_context "EPGCellRenderer width tier ticker text layout EPGVirtualizer"`: surfaced `CellRenderData` use in renderer methods but did not surface the `EPGVirtualizer` import directly; top hits were weak/noisy.
- `search_documents "FCP-10 EPGCellRenderer direct renderer tests presentation decomposition"`: returned noisy prior docs and did not find the authoritative `FCP-10` row, so direct checklist reads are the source of truth.
- `rg` fallback: `src/modules/ui/epg/view/EPGVirtualizer.ts` imports `EPGCellRenderer` and `EPGRenderedCellData`, constructs `private cellRenderer = new EPGCellRenderer()`, and calls renderer methods in text-metrics, content-delta, render/recycle/focus/ticker, and temporal update paths.

Codanna is useful for the class anchor but insufficient for call-path proof on this seam. Direct source reads and `rg` are the authoritative caller/test coverage evidence.

## Impact Snapshot

Current-source proof:

- `src/modules/ui/epg/view/EPGCellRenderer.ts` exists and is the single renderer class for EPG cells.
- Public renderer methods are `createElement`, `resetCache`, `resetElement`, `getCellWidthTier`, `isSliverCell`, `computeVisibleTextMetrics`, `updateCellContent`, `updatePositionPresentation`, `updateTemporalPresentation`, `clearFocusedTickers`, `clearFocusedTickersForElement`, and `syncFocusedTicker`.
- Private renderer helpers currently own time label formatting, show-title extraction, episode tag formatting, subtitle normalization, progress presentation, text-layout derivation, episode presentation, width-tier/sliver/live-badge presentation, ticker measurement, and ticker target construction.
- `src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts` is absent.
- `src/modules/ui/epg/view/__tests__/index.test.ts` exists and covers only the view barrel exports. Treat it as view-barrel coverage unless `FCP-10-S2` intentionally adds package-local helper exports; that requires a fresh impact/source audit and an explanation.
- `src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts` indirectly covers many renderer behaviors including width tiers, sliver handling, focused episode/movie layouts, ticker timing, live/progress badge behavior, and text shifting, but the coverage is integration-level and tied to virtualizer setup.
- `EPGVirtualizer` is the only source caller found by `rg`; this does not authorize broad virtualizer rewrites. It defines the integration proof surface for renderer changes.
- DCR-14 completed background establishes that `EPGComponent` is now facade/wiring while shell rendering, focus/navigation, and grid runtime lifecycle are package-local owners. FCP-10 must not reopen that completed component decomposition.

Source finding disposition planned:

- `FCP-10-SF2` is owned by `FCP-10-S1`: add direct renderer tests around stable public behavior before refactoring.
- `FCP-10-SF1` is owned by `FCP-10-S2`: extract pure presentation/text-layout decisions into local helpers or presentation models while keeping `EPGCellRenderer` as DOM adapter.

## Files In Scope

- `src/modules/ui/epg/view/EPGCellRenderer.ts`
- `src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts` (new)
- new package-local helper/model file(s) under `src/modules/ui/epg/view/` only if `FCP-10-S2` can keep them renderer-local and pure
- `src/modules/ui/epg/view/index.ts` only if extracted helpers must become package-local exports; prefer no barrel change unless source audit proves a package-local consumer needs it
- `src/modules/ui/epg/view/__tests__/index.test.ts` only if `src/modules/ui/epg/view/index.ts` changes
- `src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts` only for affected integration proof after renderer behavior or exported helper ownership changes
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` only during package closeout after implementation, verification, and clean review
- `docs/architecture/CURRENT_STATE.md` and `docs/architecture/modules.md` only if source audit proves a narrow current EPG view ownership/status update is needed

## Files Out Of Scope

- `src/modules/ui/epg/component/EPGComponent.ts`
- broad `src/modules/ui/epg/view/EPGVirtualizer.ts` ownership changes; read/integration-audit only unless renderer integration requires a narrow call-site adjustment
- `src/modules/ui/epg/styles.css` and all EPG CSS files
- `src/modules/ui/epg/coordinator/*`, `src/modules/ui/epg/runtime/*`, `src/modules/ui/epg/model/*`, and `src/modules/ui/epg/component/*`
- scheduler/channel data model files
- Plex, persistence, app-shell, orchestrator, navigation, and channel setup files
- DCR-14 plan/checklist/status surfaces except as completed background guardrail
- unrelated dirty/untracked files listed in `## Required Reading`

## Planner Self-Check

1. Architecture seam resolved: `EPGCellRenderer` stays the DOM adapter; pure renderer-local text-layout and presentation policy may move to package-local helpers/models under `view/`.
2. Adjacent contracts are frozen: `EPGVirtualizer` remains the caller/virtualized-grid owner; no `EPGComponent`, scheduler, persistence, Plex, app-shell, or navigation contract changes are planned.
3. Out-of-scope files are not hidden implementation dependencies. `EPGVirtualizer` tests may prove integration, but virtualizer ownership is not part of the refactor.
4. Codanna evidence and insufficiency are recorded, with deterministic `rg` fallback for the actual caller path.
5. The plan assigns work to the existing EPG view owner and avoids growing broader EPG hotspots.
6. A fresh cleanup-loop session can start with `ready_now_execution_unit` `FCP-10-S1` without deciding package membership, final owners, or verification depth.
7. This is execution-grade at seam/scope/verification level. It deliberately leaves helper names and local implementation structure to the worker as long as the approved seam and proof surface hold.

## Architecture Seam Decision Gate

Approved seams:

- `FCP-10-S1`: direct tests may instantiate `EPGCellRenderer` and use only its public methods plus resulting DOM/class/style/text state. They must not reach private methods, cast through private fields, or test through `EPGVirtualizer` as a substitute for direct renderer confidence.
- `FCP-10-S2`: extract pure decisions such as text-layout derivation, episode/show/movie presentation model shaping, width-tier/sliver/live-badge presentation decisions, progress value calculation, and ticker measurement policy only when they can stay local to `src/modules/ui/epg/view/` and preserve current DOM behavior. `EPGCellRenderer` applies the model to DOM nodes.
- `src/modules/ui/epg/view/index.ts` remains package-local barrel surface. Do not export helpers there unless a source audit shows package-local consumers need them; if exported, update the barrel test and explain why the helper is a real package-local contract rather than test-only access.

Preservation contracts:

- Preserve cell DOM structure, class names, `data-key` behavior, text-shift CSS variable, live badge ARIA label/text/compact class behavior, progress fill width behavior, time label compact/full behavior, focused movie overlay class behavior, focused compact episode layout, sliver suppression, and placeholder loading presentation.
- Preserve ticker behavior: reduced-motion suppression, no ticker for sliver or zero-visible-width focused cells, ready/running classes, distance/duration variables, 900ms start delay, reset on focus changes/recycle, and title/subtitle target behavior.
- Preserve `EPGVirtualizer` render/recycle/focus/temporal interactions with renderer public methods and `EPGRenderedCellData`.
- Preserve direct tests as behavior tests, not snapshots of private helper structure.

Stop and replan if:

- direct renderer tests require private probing, test-only APIs, or exposing helpers solely for tests;
- helper extraction changes DOM shape, CSS classes, focus hooks, reduced-motion behavior, ticker timing, live/progress presentation, text clamping/shift semantics, or virtualizer behavior;
- the work needs broad `EPGVirtualizer`, `EPGComponent`, scheduler/model, CSS/design, persistence, Plex, app-shell, or navigation changes;
- extracted helpers become generic utilities outside the EPG view owner or create circular imports;
- source audit shows either `FCP-10-SF1` or `FCP-10-SF2` is already false and the planned edit would be churn;
- implementation discovers additional FCP findings or residue that changes package membership, final-owner accounting, verification surface, or execution-unit membership.

Absorb-now rule: absorb only newly discovered residue that stays within the same approved execution unit goal, owner, seam/files, verification envelope, and final-owner accounting. Record absorbed residue in implementation/review output. Replan for new owners, wider verification, changed source-finding coverage, or changed execution-unit membership.

## Verification Commands

Verification strategy classification: `new regression/contract test required`.

Primary proof mode: contract-first for direct renderer public behavior in `FCP-10-S1`, then refactor-invariance for `FCP-10-S2` using the new direct test net plus affected integration tests.

Plan validation:

- `npm run plans:check`
  - Expected: this active plan satisfies Universal Plan Core and FCP cleanup overlay conformance.

Ready-now `FCP-10-S1` verification:

- `npm test -- --runInBand src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts`
  - Expected: new direct jsdom renderer tests pass. Required coverage includes width tiers, sliver handling, visible text metrics and shift clamping, focused episode/movie layout, live/progress badge behavior, placeholder reset/loading behavior, and stable ticker timing where jsdom measurement can prove it.
- `npm run typecheck`
  - Expected: no TypeScript errors after adding the direct test file.
- `git diff --check`
  - Expected: no whitespace errors.

`FCP-10-S2` verification:

- `npm test -- --runInBand src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts`
  - Expected: direct renderer behavior remains unchanged after helper/model extraction.
- `npm test -- --runInBand src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts`
  - Expected: affected virtualizer integration behavior remains unchanged if renderer implementation or helper exports change.
- `npm test -- --runInBand src/modules/ui/epg/view/__tests__/index.test.ts`
  - Expected: only required if `src/modules/ui/epg/view/index.ts` changes; view barrel exports remain intentional and package-local.
- `npm run typecheck`
  - Expected: no TypeScript errors, no circular or invalid imports, and helper/model contracts stay local to the EPG view owner.
- `git diff --check`
  - Expected: no whitespace errors.

Package closeout:

- source audit: `rg -n "private (extractShowTitleFromFullTitle|formatEpisodeTag|normalizeEpisodeTitleForSubtitle|getProgramCellTextLayout|updateEpisodePresentation|applyWidthTierPresentation|updateProgressPresentation|getEffectiveTickerClientWidth|measureReadyStateTickerOverflow|buildTickerTarget)" src/modules/ui/epg/view/EPGCellRenderer.ts`
  - Expected: after `FCP-10-S2`, pure text-layout/presentation policy is no longer all concentrated as private methods on `EPGCellRenderer`, or implementation output records a source-justified replan/defer disposition for `FCP-10-SF1`.
- source audit: `rg -n "EPGCellRenderer|EPGRenderedCellData" src/modules/ui/epg`
  - Expected: callers remain limited to the approved EPG view/test surfaces unless a reviewed package-local export decision explains a new consumer.
- `npm run verify:docs`
  - Expected: required if closeout updates `ARCHITECTURE_CLEANUP_CHECKLIST.md`, architecture docs, or this active plan after implementation.
- `npm run verify`
  - Expected: full UI/package closeout gate passes before marking `FCP-10` complete.

## Rollback Notes

- Roll back by slice. If `FCP-10-S1` direct tests prove unstable or require private probing, do not proceed to extraction; replan the test seam first.
- If `FCP-10-S2` extraction changes renderer behavior, revert helper/model extraction while keeping any valid direct behavior tests from `FCP-10-S1`.
- If helper exports create a wider package API than intended, revert the export and keep helpers private/module-local unless a fresh plan review approves the package-local contract.
- If virtualizer integration regresses, restore the prior renderer public-method behavior before considering virtualizer call-site changes.
- If package closeout docs are wrong, revert only the docs/checklist closeout and keep reviewed source/test changes that still satisfy their slice.

## Commit Checkpoints

- `FCP-10-S1` implementation checkpoint: direct `EPGCellRenderer` jsdom tests only, with typecheck and diff-check evidence.
- `FCP-10-S2` implementation checkpoint: renderer-local presentation/text-layout helper extraction plus updated direct/integration tests.
- Closeout checkpoint: after both slices pass clean review and verification, update the `FCP-10` checklist mini-record and any narrow EPG architecture status docs in a separate orchestrator-owned closeout pass if implementation commits were already made.

## Package Decomposition

- `package_id`: `FCP-10`
- `checklist_token`: `FCP-10`
- `package_issue_ids`: n/a for FCP source-backed packages; use `source_finding_ids`
- `source_finding_ids`: `FCP-10-SF1`, `FCP-10-SF2`
- `coverage_check`:
  - `FCP-10-SF1` maps exactly to `FCP-10-S2`.
  - `FCP-10-SF2` maps exactly to `FCP-10-S1`.
- `ready_now_execution_unit`: `FCP-10-S1`
- `ready_now_slice`: `FCP-10-S1`
- `recommended_slice_order`: `FCP-10-S1`, then `FCP-10-S2`, then package closeout source audit and docs/checklist update if earned.
- `parallel_execution_policy`: serial only. No execution waves are approved. `FCP-10-S1` must land before `FCP-10-S2` so the behavior-preserving extraction has direct renderer proof; both slices touch or depend on the same renderer behavior surface.

| slice_id | goal | areas/files | source_finding_ids | verification | dependencies | stop_condition | handoff_condition | serial_only | parallel_justification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FCP-10-S1` | Add direct renderer tests around current public behavior without private probing. | `src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts`; read-only source audit of `src/modules/ui/epg/view/EPGCellRenderer.ts`; no production/test files beyond the new direct test unless plan review approves a missing test utility import. | `FCP-10-SF2` | `npm test -- --runInBand src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts`; `npm run typecheck`; `git diff --check` | none | Stop if required assertions cannot be made through public renderer methods and DOM output, if jsdom measurement makes ticker tests unstable beyond bounded property stubbing, or if tests require changing production code. | Direct tests cover width tiers, sliver handling, text metrics/shift clamping, focused episode/movie layout, live/progress badge behavior, placeholder reset/loading behavior, and stable ticker timing. | true | This is the test-only safety net for the later extraction; parallel work would race the same behavior contract. |
| `FCP-10-S2` | Extract pure presentation/text-layout decisions into renderer-local helper/model ownership while keeping `EPGCellRenderer` as DOM adapter. | `src/modules/ui/epg/view/EPGCellRenderer.ts`; new renderer-local helper/model file(s) under `src/modules/ui/epg/view/`; `src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts`; `src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts` only if affected; `src/modules/ui/epg/view/index.ts` and its barrel test only if a package-local export is truly needed. | `FCP-10-SF1` | direct renderer tests; affected virtualizer tests if renderer integration behavior changes; optional view barrel test if export changes; `npm run typecheck`; helper concentration/source audits; `git diff --check`; package closeout `npm run verify` | `FCP-10-S1` clean review and passing direct tests | Stop if extraction changes DOM/classes/ticker/focus/reduced-motion/live/progress behavior, requires broad virtualizer or CSS changes, creates package cycles, or exposes helpers only for tests. | Pure text-layout/presentation policy is separated enough that the renderer applies a model instead of owning every decision inline; direct and affected integration tests pass; source audit proves `FCP-10-SF1` is retired or replan/defer is explicit. | true | Depends on the direct test safety net and edits the same renderer surface, so serial execution is required. |

No `execution_waves` are approved in this plan. `cleanup-loop` should execute and review `FCP-10-S1` as the first single-slice execution unit, then return to this plan for `FCP-10-S2` unless review requires a replan.

## Source Finding Disposition

- `FCP-10-SF2`: planned for retirement by `FCP-10-S1` when direct renderer tests cover the listed high-risk public behaviors without private probes.
- `FCP-10-SF1`: planned for retirement by `FCP-10-S2` when pure text-layout and presentation policy has a local owner separate from DOM mutation and source audit shows the original mixed-responsibility finding no longer describes current source.

No deferred `FCP-10` source findings are approved before implementation. If either finding cannot be retired inside its slice, stop for replan with one explicit final owner and revisit trigger.

## Closeout Evidence

`FCP-10` completed on 2026-05-02 after clean plan review, clean implementation
review for both approved slices, and source-backed closeout audit.

- `FCP-10-S1`: added direct jsdom coverage in
  `src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts` for width tiers,
  sliver handling, visible text metrics and shift clamping, focused
  episode/movie layouts, live/progress badge behavior, placeholder
  reset/loading behavior, and ticker timing/cleanup through public renderer
  methods and DOM output.
- `FCP-10-S2`: extracted renderer-local presentation/text-layout policy into
  `src/modules/ui/epg/view/EPGCellPresentation.ts`, including width/sliver
  decisions, visible text metrics, time label presentation, program/episode
  text layout, focused compact/movie presentation decisions, progress fill
  calculation, and ticker target/overflow policy. `EPGCellRenderer` remains the
  DOM adapter that applies those decisions.

Source finding disposition:

- `FCP-10-SF1`: retired. Pure presentation/text-layout policy no longer lives
  entirely as private methods on `EPGCellRenderer`; the renderer applies local
  helper decisions while preserving its public DOM adapter surface.
- `FCP-10-SF2`: retired. Direct renderer tests cover the high-risk public
  behavior without private probing or test-only production APIs.

Source audit:

- `rg -n "private (extractShowTitleFromFullTitle|formatEpisodeTag|normalizeEpisodeTitleForSubtitle|getProgramCellTextLayout|updateEpisodePresentation|applyWidthTierPresentation|updateProgressPresentation|getEffectiveTickerClientWidth|measureReadyStateTickerOverflow|buildTickerTarget)" src/modules/ui/epg/view/EPGCellRenderer.ts`
  returned no matches after `FCP-10-S2`.
- `rg -n "EPGCellRenderer|EPGRenderedCellData" src/modules/ui/epg` showed
  usage limited to `EPGVirtualizer`, `EPGCellRenderer`, and direct renderer
  tests. No view barrel export was added.

Verification observed during implementation/review:

- Clean final plan approval completed before implementation.
- `FCP-10-S1` implementation review found no material findings.
- `FCP-10-S2` implementation review found no material findings.
- `npm test -- --runInBand
  src/modules/ui/epg/view/__tests__/EPGCellRenderer.test.ts` passed.
- `npm test -- --runInBand
  src/modules/ui/epg/__tests__/EPGVirtualizer.test.ts` passed.
- `npm run typecheck` passed.
- `git diff --check` passed for implementation slices.
- Implementation commits: `2cc71d56` and `37b0871f`.

No `FCP-10` source findings or follow-ups remain open.
