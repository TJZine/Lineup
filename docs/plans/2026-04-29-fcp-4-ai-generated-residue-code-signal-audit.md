# FCP-4 AI-Generated Residue And Code Signal Audit

## Purpose And Scope

This is the source-backed audit for `ARCHITECTURE_CLEANUP_CHECKLIST.md` item `FCP-4` AI-Generated Residue And Code Signal.

The audit covers production source for noisy comments, docstring bloat, generic names, defensive boilerplate, pass-through wrappers, copied logging/error patterns, repetitive helpers, and convention outliers that make code intent look generated or obscure. It uses current source, tests/docs where relevant, Codanna where available, and deterministic `rg`/direct reads. It does not use Desloppify output, issue ids, package maps, score deltas, generated queues, or triage as intake, proof, prioritization, or closure evidence.

## Audit Freshness And Update Rule

- Audit date: 2026-04-29.
- Source baseline: current workspace at planning time.
- Worktree hygiene observed with `git status --short`; unrelated dirty/untracked files were present and ignored for FCP-4 intake, proof, prioritization, and package membership:
  - `M scorecard.png`
  - `?? docs/agentic/evals/baseline-summaries/2026-04-28-prompt-13-feature-low-implementer-policy.md`
  - `?? docs/plans/2026-04-28-ai-generated-debt-hygiene-sweep.md`
  - `?? docs/plans/2026-04-28-cross-module-architecture-audit-plan.md`
  - `?? docs/plans/2026-04-28-cross-module-architecture-cleanup-checklist.md`
  - `?? docs/plans/2026-04-28-design-coherence-audit-checklist.md`
  - `?? docs/plans/2026-04-28-design-coherence-audit-plan.md`
  - `?? docs/plans/2026-04-28-plex-stream-url-policy-capability-cleanup-plan.md`
- The untracked 2026-04-28 AI/generated-debt artifact was not read and was not used as FCP-4 intake, proof, prioritization, or package membership.
- Update this audit if implementation touches code-signal areas outside the selected scheduler package, if plan review admits another FCP-4 source finding, if the selected package expands beyond comments/source-surface cleanup, or before FCP-4 closeout if more than one implementation session has passed.
- Future FCP-4 packages, if any are approved before closeout, must update this audit when planned and when closed. Execution plans may summarize this audit, but this file remains the durable coverage surface.

## Discovery Trail

Codanna MCP tools were not exposed in this session, so the local CLI was used:

- `/Users/tristan/.cargo/bin/codanna mcp get_index_info`
  - Index contained 11072 symbols across 696 files and 3112 relationships.
  - Semantic search was enabled with model `AllMiniLML6V2`, 16 embeddings, 384 dimensions, updated about 33 minutes before audit.
- `/Users/tristan/.cargo/bin/codanna mcp semantic_search_with_context query:"AI generated residue comments wrappers boilerplate code signal" limit:8`
  - Weak/noisy for package membership. Top hits included `LINEUP_GLYPH_SOURCE_BY_VARIANT`, `PlexDeviceKey`, `AppOrchestrator` fields, and `ChannelSetupPlexRequestUseCase`.
- `/Users/tristan/.cargo/bin/codanna mcp semantic_search_with_context query:"restating comments defensive boilerplate pass through wrappers production source" limit:8`
  - Weak/noisy. Top hits included `LINEUP_GLYPH_SOURCE_BY_VARIANT`, `ChannelSetupPlexRequestUseCase`, `NavigationFocusPolicy`, and orchestrator fields.
- `/Users/tristan/.cargo/bin/codanna mcp semantic_search_with_context query:"generic helper manager options config wrapper generated TypeScript" limit:8`
  - Weak/noisy. Top hits again mixed brand glyph, orchestrator fields, `ChannelSetupPlexRequestUseCase`, and `NavigationFocusPolicy`.
- `/Users/tristan/.cargo/bin/codanna mcp search_documents query:"FCP-4 AI-Generated Residue Code Signal" limit:8`
  - Returned workflow/plan-standard hits and historical cleanup plans; a Tantivy `LockBusy` auto-sync warning appeared. Used as orientation only.
- `/Users/tristan/.cargo/bin/codanna mcp search_symbols query:ShuffleResult limit:8`
  - Found one symbol: `ShuffleResult` in `src/modules/scheduler/scheduler/types.ts`.
- `/Users/tristan/.cargo/bin/codanna mcp analyze_impact ShuffleResult`
  - Reported no impacted symbols, supporting the direct `rg` evidence that the export is isolated.
- Codanna `find_symbol` and `analyze_impact` for scheduler functions/classes produced several mislabeled results under `AppOrchestrator` symbols, so deterministic fallback reads own the proof-grade scheduler classification.

Deterministic fallback used direct source reads, current-source `rg`, and a read-only comment-density script over production TypeScript. Direct proof commands included:

- comment-density scan over `src/**/*.ts` excluding `__tests__`
- direct reads of `src/modules/scheduler/scheduler/ChannelScheduler.ts`, `ScheduleCalculator.ts`, `ShuffleGenerator.ts`, `interfaces.ts`, `types.ts`, `constants.ts`, and `src/modules/scheduler/shared/prng.ts`
- `rg -n "buildScheduleIndex|calculateProgramAtTime|calculateNextProgram|calculatePreviousProgram|generateScheduleWindow|ChannelScheduler|ShuffleGenerator|IChannelScheduler|IShuffleGenerator" src --glob '!**/__tests__/**'`
- `rg -n "Build a schedule index|Pre-computes|Core algorithm|Calculate the next|Calculate the previous|Generate a schedule window|Fisher-Yates shuffle|Simple hash|Hash the channelId|Ensure positive value|Get the current scheduler state|Stop the sync timer|Channel Scheduler implementation|@example|@param|@returns" src/modules/scheduler/scheduler --glob '*.ts'`
- `rg -n "ShuffleResult" src --glob '!**/__tests__/**'`
- `rg -n "loopSchedule|ShuffleResult" src --glob '*.{test,spec}.ts'`
- `rg -n "Zero \(epoch\)|same seed = same shuffle|webOS|fail-open|Semantic absence|Malformed payloads|Media Session|not continuously during playback|X-Plex-Container-Size" src --glob '*.{ts,tsx}'`
- `rg -n "token|password|auth|secret|credential|localStorage|sessionStorage|innerHTML|eval\(|Function\(|dangerously|X-Plex|Plex|webOS|security" src/modules/scheduler/scheduler --glob '*.ts'`

Direct source/read targets for accepted or no-action classification included:

- `src/modules/plex/library/interfaces.ts`
- `src/modules/ui/common/brandGlyphSource.ts`
- `src/modules/plex/shared/fetchWithTimeout.ts`
- `src/modules/player/VideoPlayer.ts`
- `src/modules/scheduler/channel-manager/types.ts`
- `docs/architecture/CURRENT_STATE.md`
- `docs/architecture/modules.md`

## Audited Area Matrix

| Area | Classification | source_finding_id | Owner | Source evidence | Closure or no-action rationale |
| --- | --- | --- | --- | --- | --- |
| Scheduler core comments/docblocks | Behavior-neutral ready package | `FCP-4-SF1` | Scheduler core owner | Comment-density scan found `ChannelScheduler.ts` at 163 comment lines / 559 total, `ScheduleCalculator.ts` at 82 / 303, `ShuffleGenerator.ts` at 45 / 91, `interfaces.ts` at 57 / 127, and `src/modules/scheduler/shared/prng.ts` at 17 / 49. Targeted `rg` shows generated-looking tutorial/API boilerplate such as `@example`, `@param`, `@returns`, `Build a schedule index`, `Calculate the next`, `Generate a schedule window`, `Fisher-Yates shuffle`, `Simple hash`, `Hash the channelId`, `Ensure positive value`, `Get the current scheduler state`, and `Stop the sync timer`. | Retain comments that protect scheduler invariants, such as epoch/negative anchor timestamps, same-seed/no-index-rebuild reasoning, hard-resync/drift behavior, and window safety guard. Remove or compress restating method docblocks, tutorial examples, and line comments that simply narrate adjacent code. |
| Scheduler unused exported type | Behavior-coupled ready package | `FCP-4-SF2` | Scheduler core public-surface owner | `ShuffleResult` appears only in `src/modules/scheduler/scheduler/types.ts` and the scheduler barrel export in `src/modules/scheduler/scheduler/index.ts` for production source. Codanna found the symbol and reported no impacted symbols. No production or test source imports it. | Retire the dead exported type and its barrel export only if current `rg` still proves no imports. Because this touches an exported scheduler surface, implementation must run typecheck/targeted scheduler tests and `npm run verify`. Stop and replan if any consumer appears. |
| `ScheduleConfig.loopSchedule` | Out of scope / behavior-coupled | none | Scheduler API owner | Production source constructs the field in `OrchestratorSchedulePolicy.ts` and declares it in `ScheduleConfig`, but scheduler implementation does not read it. Tests include many fixtures with `loopSchedule: true`. | This looks like a broader scheduler config/API contraction, not a code-signal cleanup with a small proof surface. Removing it would churn runtime fixtures and public scheduler config shape. Final owner: scheduler API owner. Revisit trigger: a future scheduler contract change, FCP-6 test-confidence audit, or a dedicated scheduler API cleanup plan. |
| Plex library interface comments | Accepted residue | none | Plex library contract owner | `IPlexLibrary` includes some generic method docblocks, but the same file also records semantic absence, malformed-payload rejection, count-query behavior, and `X-Plex-Container-Size=0` details. | Preserve. The comments protect external Plex API semantics and failure contracts; FCP-4 explicitly preserves external API contract and behavior comments. |
| webOS/media-session/fail-open comments | Accepted residue | none | Player, Plex shared transport, platform owners | `VideoPlayer.ts` records webOS media-session retry/support behavior; `fetchWithTimeout.ts` records fail-open listener/abort cleanup; `platform/webosPlatformServices.ts` and Plex stream policy comments identify platform constraints. | Preserve. These comments explain platform constraints, lifecycle ordering, compatibility, and fail-open invariants. |
| Brand glyph SVG comments | Accepted residue | none | UI common brand asset owner | Codanna surfaced `LINEUP_GLYPH_SOURCE_BY_VARIANT`. The file is the canonical editable SVG source and comments are inside asset markup for layer/design annotation. | Accepted for FCP-4 selected package. These are asset-layer notes rather than scheduler/source-intent comments. Revisit only if the brand asset is regenerated or a UI asset cleanup is explicitly scoped. |
| Production barrel section comments | Accepted/no-action | none | Module package owners | `src/modules/player/index.ts` contains small `// Interface` and `// Types` section comments; `src/modules/scheduler/channel-manager/index.ts:2` contains `// Export main class and error`; scheduler barrel is already comment-free. | No FCP-4 package admitted. These are minor barrel-local grouping comments outside the scheduler-core package and do not currently obscure intent enough to justify cross-module churn. |
| Test comment bloat | Out of scope | none | Test owners | `rg` found many test fixture/explanation comments, especially scheduler tests. | FCP-4 scope is production source code-signal. Test confidence and fixture hygiene belong to FCP-6 only if the test audit proves risk. |

## Ready Package Findings

### FCP-4-SF1: Scheduler Core Comment And Docblock Noise

Scheduler core files contain high comment density and repeated boilerplate-style docs around already self-explanatory methods. The strongest examples are:

- `ShuffleGenerator` class and methods carry tutorial-style `@example`, `@implements`, `@param`, and `@returns` blocks, then line comments restate the loop/hash operations.
- `ScheduleCalculator` exports have long docblocks for direct function names such as `buildScheduleIndex`, `calculateNextProgram`, `calculatePreviousProgram`, and `generateScheduleWindow`, plus local line comments that narrate one-line call choices.
- `ChannelScheduler` has method docblocks like `Get the current scheduler state`, `Stop the sync timer`, and `Synchronize scheduler state with wall-clock time` where the symbol names already carry the intent.
- `interfaces.ts`, `types.ts`, and `constants.ts` include field-level comments that restate names or basic units, mixed with a smaller set of useful contract notes.

This matters because scheduler code is production-critical and already algorithm-heavy. Restating comments increase the amount of prose a maintainer must distrust while looking for the comments that actually encode invariants.

#### Audit-First Package Brief

- `source_finding_id`: `FCP-4-SF1`
- `source findings`: comment/docblock noise in `src/modules/scheduler/scheduler/ChannelScheduler.ts`, `ScheduleCalculator.ts`, `ShuffleGenerator.ts`, `interfaces.ts`, `types.ts`, `constants.ts`, and `src/modules/scheduler/shared/prng.ts`.
- `rubric linkage`: AI-generated debt, naming quality, low-level elegance, convention outlier, duplication, and abstraction fitness.
- `owner seam`: scheduler core and scheduler shared PRNG source-signal hygiene. Do not move scheduling behavior or ownership.
- `files in scope`: scheduler files named above.
- `files out of scope`: scheduler channel-manager behavior, channel tuning, EPG runtime, mini guide runtime, orchestrator schedule policy, player, Plex, UI, tests unless source behavior changes require targeted proof.
- `closure condition`: restating docs/comments are removed or compressed; invariant comments remain; no runtime logic, exported behavior, scheduling math, timer behavior, event names, or test expectations change for this finding.
- `verification routing`: behavior-neutral diff/source audit, `git diff --check`, targeted `rg` checks for removed boilerplate patterns and preserved invariant comments, `npm run verify:docs` for docs; no new automated tests for comment-only edits.
- `stop/replan triggers`: implementation needs to change scheduling logic, public types, event behavior, timing constants, scheduler consumers, or tests to make the cleanup pass.
- `security triage`: `no open P0 security findings`; scheduler core has no auth/token/storage/network/security-sensitive hits in the selected files.

### FCP-4-SF2: Unused `ShuffleResult` Exported Surface

`ShuffleResult` is exported from `src/modules/scheduler/scheduler/types.ts` and re-exported from `src/modules/scheduler/scheduler/index.ts`, but current production and test source do not import it.

This matters because a dead exported type makes the scheduler API look broader than it is and invites future callers to depend on a non-contract. Unlike pure comment cleanup, this is behavior-coupled at the type/export surface and needs stronger proof.

#### Audit-First Package Brief

- `source_finding_id`: `FCP-4-SF2`
- `source findings`: `ShuffleResult` appears only at its declaration and scheduler barrel export in production source; Codanna reports no impacted symbols.
- `rubric linkage`: API surface coherence, AI-generated debt, naming quality, low-level elegance, and convention outlier.
- `owner seam`: scheduler core public-surface owner.
- `files in scope`: `src/modules/scheduler/scheduler/types.ts`, `src/modules/scheduler/scheduler/index.ts`.
- `files out of scope`: all scheduler behavior files unless needed for compile fallout; all consumers unless current `rg` proves a real import and triggers replan.
- `closure condition`: `ShuffleResult` declaration and re-export are gone, current-source `rg` confirms no references remain, typecheck/targeted tests/full verification pass.
- `verification routing`: current-source import audit, `npm run typecheck`, targeted scheduler tests, `npm run verify`, `git diff --check`, `npm run verify:docs`.
- `stop/replan triggers`: any production/test consumer of `ShuffleResult` appears, external package API policy blocks export removal, or removing the type requires changing scheduler behavior.
- `security triage`: `no open P0 security findings`; type-export cleanup does not touch security-sensitive state.

## Proof Matrix

| source_finding_id | classification | planned slice | current status | proof required before closeout | final owner | revisit trigger |
| --- | --- | --- | --- | --- | --- | --- |
| `FCP-4-SF1` | behavior-neutral | `FCP-4-S1` | resolved by commit `f9eca40b` | Scheduler core restating docblocks/comments were removed or compressed while preserving invariant comments for epoch/negative anchor validity, same-seed/no-index-rebuild behavior, hard resync/drift handling, and `MAX_WINDOW_PROGRAMS` memory safety. Worker and implementation-review source audits confirmed the old-pattern `rg` audit had no hits, preserved-pattern audit retained required invariant hits, and `git diff --check` passed. Fresh implementation review approved `FCP-4-WAVE1` with no blocking findings. Fresh FCP-4 priority-exit closeout review approved completion with no findings. | Scheduler core owner | Reopen if scheduler files regain tutorial-style/generated-looking comments, if invariant comments are accidentally removed, or if final FCP reconciliation finds code-signal drift in the same owner. |
| `FCP-4-SF2` | behavior-coupled exported surface cleanup | `FCP-4-S2` | resolved by commit `f9eca40b` | Fresh pre-edit source audit found `ShuffleResult` only at its declaration/export and no test consumers. The declaration and scheduler barrel export were removed. Post-edit source audit found no `ShuffleResult` hits in `src`, and `npm run typecheck`, targeted scheduler tests, `npm run verify`, `git diff --check`, and implementation review passed. Fresh FCP-4 priority-exit closeout review approved completion with no findings. | Scheduler core public-surface owner | Reopen if current-source consumers appear, if package API policy requires restoring the export, or if final FCP reconciliation finds a replacement dead scheduler export. |

## Deferred And Accepted Residuals

- `ScheduleConfig.loopSchedule`: out of scope / behavior-coupled. Final owner: scheduler API owner. Revisit trigger: future scheduler config contract cleanup, FCP-6 test-confidence audit, or any implementation that starts reading/writing this field differently. Do not remove it under FCP-4 without replan because tests and config construction are broad.
- Plex library interface documentation: accepted residue. Final owner: Plex library contract owner. Revisit trigger: Plex library contract/failure semantics change.
- webOS/platform/media-session/fail-open comments: accepted residue. Final owner: player, Plex shared transport, and platform owners. Revisit trigger: platform compatibility or lifecycle behavior changes.
- Brand glyph inline SVG comments: accepted residue for this FCP-4 package. Final owner: UI common brand asset owner. Revisit trigger: brand asset regeneration or a dedicated UI asset cleanup scope.
- Production barrel section comments, including `src/modules/player/index.ts` grouping comments and `src/modules/scheduler/channel-manager/index.ts:2`: accepted/no-action. Final owner: module package owners. Revisit trigger: package barrel policy changes or a future source audit finds misleading exports.
- Test comment bloat: out of scope for FCP-4 production source. Final owner: relevant test owners. Revisit trigger: FCP-6 test-confidence audit.

No deferred FCP-4 source finding is admitted beyond the planned `FCP-4-SF1` and `FCP-4-SF2` package. The residuals above either preserve required context or require a different owner/proof surface before they become executable work.

## Known Uncertainty And Tool Fallback

- Codanna CLI was available at `/Users/tristan/.cargo/bin/codanna`; Codanna MCP tools were not exposed to this agent. The audit records the CLI fallback exactly.
- Codanna semantic search was weak/noisy for subjective code-signal classification and several scheduler symbol impact calls were mislabeled. Direct source reads and `rg` are the proof-grade basis for membership, classification, and no-action decisions.
- This is source-backed, not a mechanically exhaustive proof that every comment in the repo is optimal. The selected package is intentionally broad but bounded to one scheduler owner/proof surface, with accepted/no-action records for other audited areas.

## Security Triage / P0 Disposition

- Planning-time disposition: `no open P0 security findings`.
- Selected scheduler files returned no hits for auth/token/credential/storage/network/DOM-injection/security-sensitive patterns in the package-local security triage search.
- Implementation-time package-local security/source audit returned no hits, and implementation review found no P0/security concern.
- Implementation must not change auth, token handling, Plex transport, storage schemas, network requests, authorization behavior, DOM injection, or security-sensitive persistence.
- If implementation or review discovers a P0 security finding, stop and replan with one final owner, reason, and revisit trigger before FCP-4 closeout or any FCP-5 work.

## FCP-4 Closeout Readiness

FCP-4 priority-exit closeout review approved completion with no findings after
implementation commit `f9eca40b` resolved the approved scheduler package.

Closeout evidence:

- `FCP-4-SF1` resolved by `f9eca40b`: scheduler restating comments/docblocks
  were removed or compressed in the approved scheduler files, while invariant
  comments for anchor validity, same-seed/no-index-rebuild behavior, hard
  resync/drift handling, and `MAX_WINDOW_PROGRAMS` memory safety remain.
- `FCP-4-SF2` resolved by `f9eca40b`: `ShuffleResult` declaration and
  scheduler barrel export were removed after fresh consumer proof showed only
  declaration/export hits and no test consumers.
- Worker verification passed: `ShuffleResult` pre/post `rg` audits,
  old-pattern source audit, preserved-pattern source audit, package-local
  security/source audit, `npm run typecheck`, targeted scheduler tests (3
  suites / 79 tests), `npm run verify`, `git diff --check`, and
  `git diff --cached --check`.
- Fresh implementation review found no blocking findings and approved
  `FCP-4-WAVE1` for controller closeout.
- Fresh FCP-4 priority-exit closeout review found no blocking findings and
  approved completion.
- Security triage remains `no open P0 security findings`.
- Accepted/no-action and out-of-scope residual owners above remain unchanged.
- Final post-completion `npm run verify:docs` passed before the closeout
  documentation commit.
