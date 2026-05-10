# Runtime Chunk Performance Cleanup Plan

**Plan Status:** archived
**Task family:** cleanup/refactor
**Cleanup subtype:** standalone remediation

## Goal

Reduce or justify the remaining production-build Vite warning for the deferred
`assets/Orchestrator-*.js` runtime chunk without weakening bundle guards,
reopening the resolved eager-startup work, or moving runtime/feature policy into
app-shell owners.

This is a Tier 3 cleanup-loop standalone remediation. It is not
checklist-linked. Do not update `ARCHITECTURE_CLEANUP_CHECKLIST.md` unless a
future controller explicitly promotes this work into backlog.

Current completion target for the approved ready unit is measurement-grade
evidence plus a disposition, not a source split: produce repeatable attribution
and runtime timing evidence, then close RC-S1 with either one named owner-safe
lazy-boundary candidate and next-plan trigger, or an explicit no-split/accepted
residual rationale backed by measured user-visible cost.

## Non-Goals

- Do not raise Vite `chunkSizeWarningLimit`, `STARTUP_MAX_BYTES`, or any
  `tools/verify-bundle.mjs` threshold as the primary fix.
- Do not use additional `manualChunks` policy as the first fix.
- Do not reopen startup eager-JS remediation unless fresh evidence shows eager
  startup regression.
- Do not move feature/runtime logic into `src/App.ts`, `src/bootstrap.ts`,
  `src/Orchestrator.ts`, or app-shell composition owners.
- Do not reintroduce eager app-shell imports of `src/Orchestrator.ts`, feature
  barrels, or runtime-heavy modules.
- Do not weaken deferred-module leakage checks.
- Do not change Plex policy, scheduler/channel-manager behavior, persistence
  schema, navigation behavior, UI behavior, or startup routing behavior during
  the ready unit.
- Do not create checklist linkage for this standalone remediation.

## Parent Architecture Alignment

Current architecture assigns:

- `src/bootstrap.ts`: environment bootstrap/startup wiring.
- `src/App.ts`: app-shell composition, splash, shell containers, runtime loading,
  and top-level startup flow.
- `src/Orchestrator.ts`: thin public runtime entry barrel.
- `src/core/orchestrator/AppOrchestrator.ts`: central runtime coordinator
  implementation owner.

The resolved startup remediation already created the app-shell-owned async
runtime-loader boundary in
`src/core/app-shell/runtime/AppRuntimeEngineLoader.ts`. This plan protects that
shape: eager startup remains small, and all further runtime chunk work must stay
inside runtime/module owners or stop for a new owner-specific plan.

## Required Reading

Read in this order before implementation or review:

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/cleanup-loop.md`
4. `docs/agentic/plan-authoring-standard.md`
5. `docs/agentic/codanna-playbook.md`
6. `docs/architecture/CURRENT_STATE.md`
7. `docs/archive/plans/2026-05-08-verify-bundle-startup-remediation-plan.md`
8. This plan
9. `git status --short`

Freshness gate: stop and refresh this plan if `vite.config.ts`,
`tools/verify-bundle.mjs`, `src/App.ts`, `src/Orchestrator.ts`,
`src/core/app-shell/runtime/AppRuntimeEngineLoader.ts`,
`src/core/orchestrator/AppOrchestrator.ts`, orchestrator assembly/module factory
files, or `dist/bundle-stats.json` chunk naming/shape changed materially after
2026-05-08.

Planning observed unrelated dirty/untracked paths listed in the parent handoff.
Preserve those paths unless a fresh source audit proves direct overlap.

## Required Skills

- `lineup-cleanup-loop`: required because the parent invoked Tier 3 cleanup-loop
  standalone remediation.
- `architecture-boundaries`: required because the task concerns app-shell,
  Orchestrator, and runtime owner boundaries.
- `verification-strategy`: required to freeze bundle-size and runtime
  performance proof before source changes.
- `execution-plan-authoring`: required for this active tracked plan.

Load `plex-integration-boundaries`, `persistence-boundaries`, or
`ui-composition-patterns` only if a later reviewed plan proposes touching Plex
policy, storage-backed state, visible UI/focus behavior, or TV-visible lazy-load
behavior. The ready unit should not need them.

## Codanna Discovery

- `get_index_info`: Codanna available with 12,117 symbols across 801 files;
  semantic search enabled with 194 embeddings; index updated about 10 hours
  before planning.
- `semantic_search_with_context "Orchestrator dynamic chunk runtime chunk AppOrchestrator lazy load performance bundle stats owner boundaries"`:
  weak for bundle metadata, but returned runtime/lifecycle and EPG-adjacent hits.
- `search_documents "runtime chunk performance cleanup Orchestrator dynamic chunk verify bundle startup remediation plan"`:
  weak/noisy for this exact plan context; fallback direct reads of workflow docs
  and the archived startup remediation plan are authoritative.
- `find_symbol AppOrchestrator`: found
  `src/core/orchestrator/AppOrchestrator.ts`, symbol_id `10001`, 83 methods and
  53 type uses.
- `analyze_impact` for symbol_id `10001`: returned no impacted symbols. Treat
  this as insufficient for static import closure and confirm with source reads
  plus `dist/bundle-stats.json`.
- `find_symbol AppRuntimeEngineLoader`: no symbol found, likely index shape or
  staleness for the newer runtime-loader source; direct source read is
  authoritative.
- `semantic_search_with_context "AppOrchestratorConfigFactory app shell startup imports feature barrels EPG Plex defaults"`:
  found `AppOrchestrator`, `DEFAULT_EPG_CONFIG`, and `EPGConfig`, supporting
  the archived startup remediation evidence that app-shell import hygiene was
  already addressed.
- `semantic_search_with_context "AppContainerFactory app shell container IDs player osd mini guide channel badge startup imports"`:
  weak for the current post-remediation state; direct reads and bundle stats are
  authoritative.
- Fallback reads: `docs/agentic/plan-authoring-standard.md`,
  `docs/architecture/CURRENT_STATE.md`, archived startup plan,
  `tools/verify-bundle.mjs`, `vite.config.ts`, `package.json`,
  `src/core/app-shell/runtime/AppRuntimeEngineLoader.ts`, `src/App.ts`,
  `src/core/orchestrator/AppOrchestrator.ts`,
  `src/core/initialization/InitializationCoordinator.ts`,
  `src/core/orchestrator/assembly/OrchestratorModuleFactory.ts`,
  `src/core/orchestrator/assembly/OrchestratorCoordinatorBuilders.ts`,
  `src/modules/plex/stream/resolver/PlexStreamResolver.ts`,
  `src/modules/player/PlaybackRecoveryManager.ts`,
  `src/modules/debug/NowPlayingDebugManager.ts`, and
  `src/core/orchestrator/priority-one/PriorityOneAssemblyBuilder.ts`.

## Impact Snapshot

Baseline refreshed during planning:

- `npm run build:analyze`: passed. Vite warned because
  `dist/assets/Orchestrator-Cnu40tTZ.js` is `542611` bytes minified.
- `npm run verify:bundle`: passed.
- `verify:bundle` metrics: eager JS `80641` bytes, bootstrap entry
  `assets/index-CemhfixE.js` `80641` bytes, eager CSS `151743` bytes, required
  deferred modules still mapped to dynamic chunks.

Current chunk attribution from `dist/bundle-stats.json` and file stats:

- Deferred runtime chunk: `assets/Orchestrator-Cnu40tTZ.js`, `542611` bytes
  on disk.
- Largest visualizer-attributed modules inside that chunk by rendered length:
  `src/core/orchestrator/AppOrchestrator.ts` `53241`,
  `src/modules/plex/library/PlexLibrary.ts` `31202`,
  `src/modules/scheduler/channel-manager/ChannelManager.ts` `23537`,
  `src/modules/player/VideoPlayer.ts` `22324`,
  `src/core/orchestrator/assembly/OrchestratorCoordinatorBuilders.ts` `20040`,
  `src/modules/ui/now-playing-info/NowPlayingInfoOverlay.ts` `19926`,
  `src/core/initialization/InitializationCoordinator.ts` `18277`,
  `src/modules/plex/auth/PlexAuth.ts` `18157`,
  `src/modules/player/SubtitleManager.ts` `17206`, and
  `src/core/channel-tuning/ChannelTuningCoordinator.ts` `16963`.
- Owner grouping by visualizer rendered length:
  `modules/plex` `214718`, `core/orchestrator` `146931`,
  `modules/scheduler` `115621`, `modules/player` `98266`,
  `modules/navigation` `64510`, `modules/ui/epg` `57368`,
  `modules/ui/now-playing-info` `36593`, `modules/lifecycle` `32761`,
  `modules/ui/player-osd` `31070`, and `core/initialization` `26218`.

Runtime phase classification:

- Initial runtime boot currently imports `src/Orchestrator.ts` dynamically from
  `AppRuntimeEngineLoader`, then constructs `AppOrchestrator`, calls
  `initialize(config)`, and then `start()`. Source reads show
  `initialize(config)` currently constructs the broad module set through
  `createOrchestratorModules`, creates coordinators, creates runtime
  controllers, and initializes priority-one controllers before startup routing
  has established auth/server/channel state.
- Required before auth/server/channel state: runtime entry import, lifecycle,
  navigation/screen routing, auth validation/PIN runtime, server-selection
  access, app-shell error handling, selected-server resume coordination, and
  enough initialization policy to route to auth, profile, server-select, audio
  setup, channel setup, or player.
- First use after auth/server/channel state: Plex discovery/library/stream,
  channel manager/repository/resolution, scheduler, video player, channel
  tuning, player OSD/now-playing/playback-options/mini-guide/channel-transition
  runtime, EPG coordinator/runtime, and channel setup owners.
- Rare/debug/recovery paths: now-playing stream debug fetch/HUD, EPG debug
  logging, issue diagnostics, subtitle debug probes, universal transcode
  decision fetch, playback recovery reload/failure-guard paths, subtitle-track
  recovery, schedule-day rollover, shutdown teardown failure collection, and
  fatal/recoverable error-recovery helpers.

User-visible metric to improve or protect:

- Primary metric: production-build time from app-shell start to first actionable
  route/ready state, split into runtime chunk import duration, orchestrator
  initialization duration, and orchestrator startup/routing duration.
- Supporting metric: deferred runtime chunk transfer/eval pressure, represented
  by `assets/Orchestrator-*.js` bytes and top-owner attribution from
  `dist/bundle-stats.json`.
- Guard metric to protect: eager startup JS stays near the observed `80641`
  bytes and `npm run verify:bundle` stays passing with deferred-module leakage
  checks intact.

Timing baseline and comparison contract:

- Before baseline for RC-S1 is the current production build produced by
  `npm run build:analyze` before any runtime source split. The baseline must be
  captured from that build, not inferred from bundle bytes.
- Baseline collection must use the production build served locally from
  `npm run preview -- --host 127.0.0.1` or an equivalent static server pointed
  at the same freshly generated `dist/` directory. Record the exact URL.
- Baseline collection must run at least 7 samples in one browser/device target
  with cache state declared. Preferred target is desktop Chromium at
  `1280x720`, matching TV-ish layout constraints; if Browser tooling is
  unavailable, stop/replan rather than substituting anecdotes.
- Required baseline command shape:
  `node tools/measure-runtime-chunk-performance.mjs --dist dist --url http://127.0.0.1:5173/ --runs 7 --viewport 1280x720 --cache cold`.
- Future after comparison must use the same measurement command, URL shape,
  viewport/device target, cache policy, run count, build profile, and output
  schema. A later implementation plan may add a second device target, but it
  must not compare unlike environments as proof of improvement.
- Required timing fields are medians plus min/max for:
  `runtime_import_ms`, `orchestrator_initialize_ms`, `orchestrator_start_ms`,
  `app_start_to_first_actionable_ms`, and `sample_count`.
- Required bundle fields are:
  `build_profile`, `entry_js_bytes`, `bootstrap_entry_bytes`,
  `eager_css_bytes`, `runtime_chunk_file`, `runtime_chunk_bytes`,
  `runtime_chunk_gzip_bytes` when available, and top module/owner attribution.
- Required environment fields are:
  `timestamp`, `git_head`, `git_dirty_summary`, `node_version`,
  `browser_user_agent`, `viewport`, `url`, `cache_policy`, `run_count`, and
  whether timings came from Performance API marks or a documented fallback.

First safe lazy-boundary answer before code changes:

- No source-level lazy split is approved yet.
- The first candidate boundary to evaluate after measurement is a runtime-owned
  rare/debug/recovery boundary, not app-shell startup: now-playing/debug server
  decision fetch, Plex stream diagnostic probes/universal transcode decision,
  and playback/subtitle recovery helpers. That candidate is only safe if RC-S1
  proves it accounts for enough of the warning residual and can remain inside
  Plex/debug/player owners without changing policy.
- A larger selected-server/playback-runtime package split may become the
  meaningful cut if rare/debug/recovery is too small, but it crosses Plex,
  scheduler, channel-manager, player, navigation, and UI runtime seams and
  requires a separate reviewed plan before implementation.

## Files In Scope

Approved ready-now unit `RC-S1`:

- `docs/archive/plans/2026-05-08-runtime-chunk-performance-cleanup-plan.md`
- `tools/measure-runtime-chunk-performance.mjs` for the focused local
  measurement/attribution helper.
- Focused tool tests adjacent to the measurement helper if the implementation
  adds parser/stat aggregation logic that can be tested without browser timing.
- `src/core/app-shell/runtime/AppRuntimeEngineLoader.ts` only for inert
  production-safe user-timing marks around runtime import.
- `src/App.ts` only for inert user-timing marks around orchestrator
  initialize/start and first actionable route/ready completion.
- Focused tests adjacent to any added helper or startup timing code.

Read-only attribution/source surfaces for `RC-S1`:

- `dist/index.html`
- `dist/bundle-stats.json`
- `src/Orchestrator.ts`
- `src/core/orchestrator/AppOrchestrator.ts`
- `src/core/orchestrator/assembly/**`
- `src/core/initialization/InitializationCoordinator.ts`
- `src/core/app-shell/**`
- `src/modules/plex/**`
- `src/modules/scheduler/**`
- `src/modules/player/**`
- `src/modules/navigation/**`
- `src/modules/ui/**`
- `vite.config.ts`
- `tools/verify-bundle.mjs`

## Files Out Of Scope

- `ARCHITECTURE_CLEANUP_CHECKLIST.md` and checklist companion docs.
- `vite.config.ts`, except read-only.
- `tools/verify-bundle.mjs`, except read-only.
- `package.json`, unless a future reviewed docs/tooling plan adds a named
  measurement script.
- `src/Orchestrator.ts`, `src/core/orchestrator/**`, Plex, scheduler,
  channel-manager, player, navigation, UI feature, persistence, and CSS behavior
  source during `RC-S1`.
- `dist/**` as committed artifacts. Build output is evidence only.
- Known unrelated dirty/untracked paths from the parent handoff.

## Planner Self-Check

1. The architecture seam is not being hidden: `RC-S1` approves measurement and
   attribution only; no runtime split is approved.
2. Adjacent contract changes are not required for `RC-S1`. If timing marks need
   shared helpers, they must stay inert and production-safe.
3. Files out of scope are read-only evidence for `RC-S1`; implementation must
   not depend on changing them.
4. Codanna evidence is recorded, including weak/noisy results and direct-read
   fallbacks for bundle closure.
5. The plan avoids hotspot growth by forbidding feature/runtime policy in
   app-shell owners and keeping later splits with the owning modules.
6. A fresh session can execute `RC-S1` without choosing a lazy split or changing
   behavior.
7. This is execution-grade for the ready unit. It intentionally defers source
   split approval until runtime timing and attribution evidence exist.

## Architecture Seam Decision Gate

`ready_now_execution_unit: RC-S1 Runtime Chunk Attribution And Production Timing Harness`

`RC-S1` is the only approved bounded execution target for this standalone
remediation. It is measurement-only and decision-complete.

Approved `RC-S1` scope:

- Refresh `npm run build:analyze` and `npm run verify:bundle`.
- Preserve current `verify:bundle` pass status and record eager JS,
  bootstrap-entry bytes, eager CSS, dynamic `Orchestrator` chunk bytes, and
  deferred-module mappings.
- Add or update a focused measurement surface that reports:
  runtime chunk file bytes, top module/owner attribution from
  `dist/bundle-stats.json`, and the exact `assets/Orchestrator-*.js` filename.
- Add production-safe user-timing marks and collect them for the current
  production build:
  runtime engine import duration, orchestrator initialize duration, orchestrator
  start/routing duration, and app-shell start-to-first-actionable-route/ready
  duration.
- Add or update this exact repeatable measurement command:
  `node tools/measure-runtime-chunk-performance.mjs --dist dist --url http://127.0.0.1:5173/ --runs 7 --viewport 1280x720 --cache cold`.
  Its role is to
  measure freshly built `dist/` bundle stats plus browser-collected production
  startup timings for at least 7 runs against a local production server. The
  command may require a separately started preview server, but it must emit the
  minimum output schema below and must exit non-zero if any required timing
  field is missing.
- Close RC-S1 with a measured disposition:
  either one named owner-safe lazy-boundary candidate with expected value and
  next-plan trigger, or an explicit no-split/accepted residual with measured
  user-visible cost, rationale, and concrete revisit trigger.

Minimum RC-S1 measurement output schema:

```json
{
  "build_profile": "lean",
  "git_head": "<sha>",
  "git_dirty_summary": "<git status --short summary>",
  "node_version": "<process.version>",
  "timestamp": "<iso-8601>",
  "bundle": {
    "entry_js_bytes": 80641,
    "bootstrap_entry_bytes": 80641,
    "eager_css_bytes": 151743,
    "runtime_chunk_file": "assets/Orchestrator-Cnu40tTZ.js",
    "runtime_chunk_bytes": 542611,
    "runtime_chunk_gzip_bytes": 136570,
    "top_modules": [
      { "path": "src/core/orchestrator/AppOrchestrator.ts", "rendered_bytes": 53241 }
    ],
    "top_owners": [
      { "owner": "modules/plex", "rendered_bytes": 214718 }
    ]
  },
  "timing": {
    "url": "http://127.0.0.1:5173/",
    "browser_user_agent": "<user-agent>",
    "viewport": "1280x720",
    "cache_policy": "declared-warm-or-cold",
    "run_count": 7,
    "sample_count": 7,
    "timing_source": "performance_api_marks | documented_fallback",
    "runtime_import_ms": { "median": 0, "min": 0, "max": 0 },
    "orchestrator_initialize_ms": { "median": 0, "min": 0, "max": 0 },
    "orchestrator_start_ms": { "median": 0, "min": 0, "max": 0 },
    "app_start_to_first_actionable_ms": { "median": 0, "min": 0, "max": 0 }
  },
  "disposition": {
    "outcome": "next_plan_lazy_boundary | accepted_residual",
    "owner": "<named owner or none>",
    "expected_value": "<measured value or rationale>",
    "next_plan_trigger": "<required concrete next-plan or revisit trigger>"
  }
}
```

Disposition contract:

- `next_plan_lazy_boundary`: `owner` must name the proposed source owner,
  `expected_value` must cite measured timing and bundle evidence, and
  `next_plan_trigger` must name the exact condition for drafting the next split
  plan.
- `accepted_residual`: `owner` may be `none` only when no source owner is being
  assigned for immediate implementation, but `expected_value` must record the
  measured user-visible cost and rationale, and `next_plan_trigger` must be a
  concrete revisit trigger. `accepted_residual` must not use `none`, `n/a`, or
  an empty trigger.

Before/after comparison rule:

- RC-S1 establishes the `before` baseline above.
- Any later split plan must re-run the same command after implementation and
  compare median deltas for the four timing metrics plus runtime chunk bytes.
- A later split is worth keeping only if it either removes the Vite warning or
  improves a named user-visible median timing by a material amount without
  regressing eager JS, startup routing, auth/server/channel behavior, or
  verification. The later plan must define the exact material threshold before
  code changes.

`RC-S1` must not:

- split source modules;
- change runtime behavior;
- change Vite chunking;
- change bundle thresholds;
- alter Plex, scheduler/channel-manager, persistence, navigation, or UI policy;
- move runtime/feature logic into app shell.

Stop/replan triggers:

- `dist/bundle-stats.json` cannot map the static/dynamic closure soundly.
- `npm run verify:bundle` fails, eager startup JS regresses materially from the
  observed `80641` bytes, or required deferred modules leak into eager closure.
- The measured bottleneck is not the deferred `assets/Orchestrator-*.js` chunk.
- User-timing marks cannot be added without changing startup/runtime behavior or
  public contracts.
- Runtime timing evidence cannot be collected from a production build with the
  required run count, environment fields, and timing schema.
- The implementer cannot produce the final measured disposition required by
  RC-S1.
- The first meaningful split appears to require Plex policy, scheduler/channel
  manager behavior, navigation behavior, UI behavior, persistence schema, or
  app-shell ownership changes.
- A proposed source split crosses an owner boundary not explicitly approved by a
  reviewed plan.

Accepted residuals after `RC-S1`:

- The Vite chunk-size warning may remain.
- `assets/Orchestrator-*.js` may remain above `500000` bytes.
- No source-level lazy split is expected or approved until the runtime timing
  evidence and bundle attribution identify one safe owner boundary.
- An accepted residual is valid only when RC-S1 records measured user-visible
  cost, explains why the remaining warning is not worth a source split now, and
  names the revisit trigger for reopening runtime chunk work.

## Verification Commands

- Verification classification: `broader integration/manual proof required`

Primary proof mode: `integration-ops` with supporting `refactor-invariance`.
`RC-S1` is measurement/instrumentation work for a runtime/startup seam. It needs
bundle metadata proof, focused helper/timing checks, and full verification if
startup/runtime source is touched.

Planning baseline already observed:

- Run: `npm run build:analyze`
  - Observed: pass; Vite warns on `assets/Orchestrator-Cnu40tTZ.js`
    `542611` bytes.
- Run: `npm run verify:bundle`
  - Observed: pass; eager JS `80641` bytes; bootstrap entry
    `assets/index-CemhfixE.js` `80641` bytes; eager CSS `151743` bytes.

Required after `RC-S1` implementation:

- Run: `npm run build:analyze`
  - Expected: build succeeds; current `assets/Orchestrator-*.js` filename and
    bytes are recorded; Vite warning is accepted only if still isolated to the
    deferred runtime chunk.
- Run: `npm run verify:bundle`
  - Expected: pass; eager startup JS remains below `STARTUP_MAX_BYTES`; required
    deferred modules remain dynamic.
- Start the local production server:
  `npm run preview -- --host 127.0.0.1`
  - Expected: serves the freshly generated `dist/` build at
    `http://127.0.0.1:5173/` or fails visibly before timing collection.
- Run the RC-S1 measurement command against that local production build:
  `node tools/measure-runtime-chunk-performance.mjs --dist dist --url http://127.0.0.1:5173/ --runs 7 --viewport 1280x720 --cache cold`
  - Expected: exits `0` and emits the minimum schema from
    `## Architecture Seam Decision Gate`, including runtime chunk bytes,
    top modules/owners, all four timing metric summaries, environment fields,
    and one measured disposition.
  - Required environment: fresh `npm run build:analyze` output served from
    `npm run preview -- --host 127.0.0.1` or an equivalent static server for the
    same `dist/`; exact URL recorded; at least 7 samples; viewport recorded;
    cache policy recorded.
  - Failure rule: if browser timing collection is unavailable or incomplete,
    stop/replan. Bundle attribution alone is not sufficient RC-S1 closeout
    evidence.
- Run focused tests for any added timing/helper code.
  - Expected: timing helper is inert when Performance APIs are unavailable and
    does not throw during startup.
- Run: `npm run verify`
  - Expected: pass if `RC-S1` changes `src/App.ts`,
    `AppRuntimeEngineLoader.ts`, runtime, Orchestrator, UI, navigation, Plex, or
    scheduler source. This is mandatory for startup/runtime source touches.
- Run: `npm run verify:docs`
  - Expected: pass because this active tracked plan is a docs/control-plane
    artifact.

Manual/browser smoke is not required for measurement-only helper work unless
visible loading behavior changes. If a later plan changes visible UI load
timing or lazy-loading UI behavior, require a browser/manual smoke with exact
URL, viewport/device target, and observations.

## Rollback Notes

- Roll back `RC-S1` by reverting only the measurement helper and inert timing
  marks. Do not revert unrelated dirty files.
- If timing marks break startup in tests or manual smoke, remove the timing marks
  and keep bundle-attribution reporting as the lower-risk measurement surface.
- If `verify:bundle` starts failing from `RC-S1`, revert the measurement change
  and replan from the last passing bundle baseline.
- If later evidence proves the warning is not runtime-chunk related, stop and
  replace this plan rather than preserving an irrelevant lazy-split target.

## Commit Checkpoints

- Commit this active plan separately from any later implementation commit.
- Suggested plan commit: `docs: plan runtime chunk performance cleanup`
- If the delegated `RC-S1` worker makes substantive changes, including a
  measurement tool, timing marks, tests, or source-adjacent helper code, it must
  create a focused non-interactive implementation commit before handing back for
  implementation review, unless the controller explicitly records a no-commit
  tiny-edit exception.
- The `RC-S1` implementation commit must exclude this active plan and any other
  active tracked plan docs. Implementation review then reviews that commit/diff
  and the measured RC-S1 output.
- Suggested `RC-S1` implementation commit:
  `cleanup(runtime): measure orchestrator chunk performance`
- If implementation review requires follow-up revisions, the worker should make
  focused revision changes and create the matching follow-up checkpoint before
  rereview unless the controller records the same explicit no-commit tiny-edit
  exception.
- Keep active tracked plan updates out of implementation commits unless the
  controller explicitly creates a separate docs commit.

## Closeout Evidence

RC-S1 completed on 2026-05-08.

Commits:

- Plan commit: `4a0d69e6 docs: plan runtime chunk performance cleanup`
- Implementation commit:
  `65871c45 cleanup(runtime): measure orchestrator chunk performance`

Implementation files:

- `src/App.ts`
- `src/core/app-shell/runtime/AppRuntimeEngineLoader.ts`
- `src/__tests__/App.test.ts`
- `tools/measure-runtime-chunk-performance.mjs`
- `tools/__tests__/measure-runtime-chunk-performance.test.mjs`

Review:

- Plan review loop: clean after fresh final reviewer approval.
- Implementation review: clean; no material findings.

Controller verification after implementation:

- `node --test tools/__tests__/measure-runtime-chunk-performance.test.mjs`:
  passed.
- `npx jest --config jest.config.js --runInBand src/__tests__/App.test.ts`:
  passed.
- `npm run build:analyze`: passed; Vite warning remained isolated to
  `assets/Orchestrator-pRDMwBFw.js` at `542611` bytes minified and
  `136567` gzip bytes.
- `npm run verify:bundle`: passed; eager JS `81687` bytes, bootstrap entry
  `assets/index-DhWHnitH.js` `81687` bytes, eager CSS `151743` bytes, and
  required deferred modules remained dynamic.
- Production preview:
  `npm run preview -- --host 127.0.0.1` served
  `http://127.0.0.1:5173/` for measurement.
- RC-S1 measurement:
  `node tools/measure-runtime-chunk-performance.mjs --dist dist --url http://127.0.0.1:5173/ --runs 7 --viewport 1280x720 --cache cold`
  passed with `sample_count: 7`, `timing_source: performance_api_marks`,
  median runtime import `24.9 ms`, median orchestrator initialize `2.7 ms`,
  median orchestrator start `1.2 ms`, and median app start to first
  actionable `31 ms`.
- `npm run verify`: passed.

Measured disposition:

- Outcome: `next_plan_lazy_boundary`.
- Candidate owner: `src/modules/plex/stream/diagnostics`.
- Rationale: the deferred Orchestrator runtime chunk remains `542611` bytes
  (`136567` gzip), and `modules/plex` is the largest rendered owner at
  `214718` bytes. The measured startup/runtime cost is bounded on the local
  production preview target: median runtime import `24.9 ms` and median app
  start to first actionable `31 ms`.
- Revisit trigger: draft a reviewed owner-boundary split plan only if source
  audit confirms a Plex diagnostics/debug/recovery lazy boundary can reduce
  the deferred Orchestrator chunk while preserving the measured timing medians
  and bundle guards.

Accepted residual:

- The generic Vite chunk-size warning still appears because the deferred
  `assets/Orchestrator-*.js` chunk remains above `500000` bytes.
- Startup eager JS remains guarded and below the existing startup budget.
- No source-level runtime split is approved by this plan; any future split
  requires a new reviewed owner-boundary plan.
