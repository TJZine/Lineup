**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

# DCR-EXIT Final Dimension Audit Plan

## Goal

Close `DCR-EXIT` only after a comprehensive, source-backed, project-wide final audit proves the cleanup program is actually ready to exit.

This plan adds a required first execution slice, `DCR-EXIT-S0`, before any DCR package reconciliation. `DCR-EXIT-S0` uses Desloppify's objective and subjective dimensions as the audit rubric, but it does not run a fresh Desloppify scan, queue import, review import, or score refresh as task intake. The maintainer owns any score refresh outside DCR-EXIT execution after closeout.

Execution must produce an audit matrix and findings ledger where every finding has exactly one disposition:

- fix in DCR-EXIT only if the controller records a bounded same-exit-envelope write unit before editing;
- split into a named final DCR package when the finding needs implementation or wider verification;
- source-disprove with exact current-source evidence;
- accept as residual with one final owner and one revisit trigger.

No DCR-EXIT closeout is allowed from known DCR package checkboxes alone. The S0 audit matrix is a blocking proof surface.

## Non-Goals

- Do not run a fresh Desloppify scan, `desloppify review --prepare`, review import, queue import, or automated score refresh as DCR-EXIT intake.
- Do not include an optional score refresh slice in DCR-EXIT execution. `DCR-EXIT-D1` is external/manual by maintainer after closeout and is non-blocking for this plan.
- Do not implement production/test source changes during S0 reviewer lanes. S0 reviewers are read-only.
- Do not reopen completed DCR packages because stale detector wording exists without current-source evidence of live debt.
- Do not move future Windows/Electron, real device Plex, native media, or manual integration proof into DCR-EXIT.
- Do not edit unrelated dirty or untracked DCR-10 implementation/doc files while executing this plan.

## Parent Priority Alignment

`DCR-EXIT` is the final checklist-linked cleanup gate for the DCR sequence in `ARCHITECTURE_CLEANUP_CHECKLIST.md`. It reconciles `DCR-1` through `DCR-10`, confirms owner decisions, verifies architecture/API/docs truth against source, and blocks cleanup closeout until current source supports the outcome.

The plan treats the existing Desloppify dimension taxonomy as the review rubric, not as an intake queue. That keeps the final gate source-backed and avoids reintroducing the old score-chasing loop that DCR was designed to replace.

## Required Reading

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/cleanup-loop.md`
4. `docs/agentic/plan-authoring-standard.md`
5. `docs/agentic/codanna-playbook.md`
6. `docs/plans/README.md`
7. `docs/architecture/CURRENT_STATE.md`
8. `ARCHITECTURE_CLEANUP_CHECKLIST.md` section `DCR-EXIT`
9. Completed `DCR-1` through `DCR-10` checklist entries and any active/completed DCR plans referenced by them
10. `docs/api/plex-integration.md`
11. `docs/design/ui-design-language.md`
12. Current source/test files named by the S0 audit lane packets
13. This plan

Freshness gate: before execution, confirm `DCR-1` through `DCR-10` are complete enough to enter `DCR-EXIT`. If `DCR-10` is still open, stop before S0. If DCR checklist membership, owner decisions, architecture docs, or DCR plan paths changed materially after this plan was written, update this plan and rerun plan review before launching reviewers.

## Required Skills

- `execution-plan-authoring`
- `verification-strategy`
- `model-selection`
- `parallel-sidecars`
- `architecture-boundaries`
- `ui-composition-patterns`
- `persistence-boundaries`
- `plex-integration-boundaries`

`bounded-worker-execution` is intentionally not required for the S0 audit. S0 lanes are read-only reviewer sidecars. If synthesis approves a concrete implementation-worthy final fix inside DCR-EXIT, the controller must replan the write unit first and add `bounded-worker-execution` only when there are disjoint write slices worth delegating.

Desloppify runtime use is intentionally excluded from DCR-EXIT execution. Do not load the `desloppify` skill, run the Desloppify CLI, import a Desloppify review packet, or use score/queue output as DCR-EXIT intake. DCR-EXIT uses only the already-recorded rubric vocabulary and checklist-derived review prompts:

- objective/mechanical: file health, code quality, duplication, test health, security, objective strictness, verified strictness;
- subjective/core: naming quality, error consistency, abstraction fitness, logic clarity, AI-generated debt, type safety, contract coherence;
- checklist-expanded subjective prompts: high-level elegance, mid-level elegance, low-level elegance, cross-module architecture, initialization coupling, convention outlier, dependency health, test strategy, API surface coherence, authorization consistency, incomplete migration, package organization, and design coherence.

## Codanna Discovery

Planning discovery on 2026-04-30:

- Codanna tools were not exposed in this runtime. No callable Codanna namespace was available, so this planner used deterministic `rg`, direct tracked-doc reads, and current checklist reads as the fallback required by `docs/agentic/codanna-playbook.md`.
- Direct reads refreshed `AGENTS.md`, `docs/AGENTIC_DEV_WORKFLOW.md`, `docs/agentic/session-prompts/cleanup-loop.md`, `docs/agentic/plan-authoring-standard.md`, `docs/plans/README.md`, `docs/agentic/codanna-playbook.md`, the DCR-EXIT checklist entry, and required repo-local/global skill instructions.
- `git status --short` showed unrelated modified tool files and untracked DCR-10/plan/eval files before this plan was created. Those files are out of scope for this planning pass.

Execution discovery requirement:

- Every S0 reviewer packet must start Codanna-first where available:
  - `semantic_search_with_context` for the lane topic and assigned source families;
  - `search_documents` for architecture, API, design, checklist, and plan claims;
  - `analyze_impact` for risky/shared source symbols if the lane identifies a live implementation-worthy seam;
  - `find_symbol`, `get_calls`, or `find_callers` when the lane needs precise call-path proof.
- If Codanna is unavailable, stale, or insufficient, the reviewer must record the fallback explicitly and use `rg --files`, `rg`, and direct reads. Fallback notes must include the missing/insufficient tool, query intent, and source files inspected.

## Impact Snapshot

Current planning facts:

- `DCR-EXIT` currently exists to reconcile every DCR package, confirm owner decisions, verify docs/current-state against source, and prevent a fresh scoring-only run before source-backed exit proof.
- The checklist entry still contained an optional score refresh slice before this plan. This plan removes that from active execution. Any refresh is external/manual by maintainer after DCR-EXIT closeout.
- `DCR-EXIT-S0` must happen before package reconciliation so the final gate can find same-area residue that was not captured by earlier DCR items.
- The audit must cover both Desloppify dimensions and Lineup-specific boundaries: app-shell/orchestrator/initialization, player runtime, scheduler/channel manager, settings/UI/focus, Plex integration, persistence/storage, dependency/config/tooling surfaces, docs/control-plane, and test architecture.
- Review throughput is capped at four read-only reviewers at a time. The controller owns packet assignment, synthesis, dispositions, replan decisions, and final adversarial review.

## Package Decomposition

- `package_id`: `DCR-EXIT`
- `checklist_token`: `DCR-EXIT`
- `package_issue_ids`:
  - `DCR-EXIT-A0`: run the comprehensive final source-backed dimension audit and ledger before package reconciliation.
  - `DCR-EXIT-A1`: reconcile every DCR package and prove all actual issues are fixed, source-disproved, or explicitly reclassified with evidence.
  - `DCR-EXIT-A2`: confirm all owner decisions have one recorded outcome, owner, and revisit trigger if accepted.
  - `DCR-EXIT-A3`: verify current architecture/API docs still match source after DCR changes.
- `external_nonblocking_issue_ids`:
  - `DCR-EXIT-D1`: maintainer-owned external/manual score refresh decision after DCR-EXIT closeout. It is out of DCR-EXIT execution and must not block or reopen this plan by itself.

- `slice_table`:

### `DCR-EXIT-S0`

- `goal`: Complete the comprehensive final source-backed dimension audit before reconciling known DCR packages.
- `areas/files`: project-wide source, tests, architecture/API/design docs, control-plane docs, DCR plans, and checklist entries assigned through the S0 lane packets.
- `exact_issue_ids`: `DCR-EXIT-A0`
- `verification`: S0 audit matrix, findings ledger, lane reports, Codanna/fallback evidence trails, controller synthesis, and an adversarial S0 synthesis review.
- `dependencies`: All `DCR-1` through `DCR-10` packages must be completed or explicitly maintainer-cleared to enter DCR-EXIT.
- `stop_condition`: Stop and replan if a lane finds implementation-worthy residue, cross-boundary ambiguity, docs/source contradiction, security issue, final-owner ambiguity, or work that belongs outside final reconciliation.
- `handoff_condition`: Every S0 lane is reviewed, every finding has exactly one disposition, every accepted residual has one owner and revisit trigger, and the controller has a reviewed matrix proving whether DCR-EXIT may proceed to S1.
- `parallel_group`: `S0-readonly-reviewers`
- `parallel_justification`: Reviewer lanes are read-only and can run in parallel in batches of up to four. Synthesis remains serial and controller-owned before S1 can start.

### `DCR-EXIT-S1`

- `goal`: Reconcile `DCR-1` through `DCR-10` package proof after S0 has no unowned blockers.
- `areas/files`: `ARCHITECTURE_CLEANUP_CHECKLIST.md`, DCR package plans/audits, package-local source/test evidence named by completed DCR entries.
- `exact_issue_ids`: `DCR-EXIT-A1`
- `verification`: Package proof matrix showing each actual issue fixed, source-disproved, reclassified, split to a named final DCR package, or accepted residual with owner/revisit trigger.
- `dependencies`: `DCR-EXIT-S0` clean synthesis or reviewed replan.
- `stop_condition`: Stop if any DCR package lacks evidence, has unresolved actual issues, has stale detector-only proof, or needs implementation beyond the approved exit envelope.
- `handoff_condition`: All DCR package issues have one recorded final disposition and no known package can be closed solely by checkbox status.
- `serial_only`: yes
- `parallel_justification`: Package reconciliation consumes S0 synthesis and must preserve one final owner ledger.

### `DCR-EXIT-S2`

- `goal`: Confirm every owner decision from DCR work has one recorded outcome, owner, and revisit trigger when accepted or deferred.
- `areas/files`: `ARCHITECTURE_CLEANUP_CHECKLIST.md`, completed DCR plans, decision notes, architecture/current-state docs where owner decisions were recorded.
- `exact_issue_ids`: `DCR-EXIT-A2`
- `verification`: Owner-decision ledger with no duplicate or conflicting final owners.
- `dependencies`: `DCR-EXIT-S1`
- `stop_condition`: Stop if a decision has competing owners, no revisit trigger, unclear accepted-residual rationale, or a destination outside DCR that is not maintainer-approved.
- `handoff_condition`: Every owner decision has one final status and any residual has a named owner plus revisit trigger.
- `serial_only`: yes
- `parallel_justification`: Owner accounting must be single-writer to avoid conflicting closeout records.

### `DCR-EXIT-S3`

- `goal`: Reconcile architecture, API, design, and control-plane docs against current source after DCR changes.
- `areas/files`: `docs/architecture/CURRENT_STATE.md`, `docs/architecture/README.md`, `docs/architecture/modules.md`, `docs/api/plex-integration.md`, `docs/design/ui-design-language.md`, `docs/AGENTIC_DEV_WORKFLOW.md`, `docs/agentic/*` surfaces only when DCR evidence requires it, and source files used as proof.
- `exact_issue_ids`: `DCR-EXIT-A3`
- `verification`: Docs/source contradiction matrix, required doc edits if any, `npm run verify:docs`, and `npm run verify` after any implementation-worthy source fixes.
- `dependencies`: `DCR-EXIT-S2`
- `stop_condition`: Stop if docs claim ownership or behavior that source contradicts, if a public contract changed without a doc owner, or if doc correction requires source implementation.
- `handoff_condition`: Current docs match source or each mismatch has a named final package/owner before closeout.
- `serial_only`: yes
- `parallel_justification`: Doc reconciliation consumes the package and owner ledgers and must leave one authoritative source-of-truth update.

### `DCR-EXIT-S4`

- `goal`: Run final closeout verification, clean adversarial review, and checklist update.
- `areas/files`: `ARCHITECTURE_CLEANUP_CHECKLIST.md`, this plan, verification output summaries, and any docs touched by S1-S3.
- `exact_issue_ids`: `DCR-EXIT-A0`, `DCR-EXIT-A1`, `DCR-EXIT-A2`, `DCR-EXIT-A3`
- `verification`: `npm run plans:check`, `npm run verify:docs`, `npm run verify` after docs/source reconciliation and any implementation-worthy fixes, final priority-exit review.
- `dependencies`: `DCR-EXIT-S3`
- `stop_condition`: Stop if verification fails, adversarial review finds material gaps, S0 ledger has unowned findings, or D1 score refresh is accidentally treated as a DCR-EXIT execution blocker.
- `handoff_condition`: Checklist entry records DCR-EXIT closeout evidence and D1 remains external/manual by maintainer.
- `serial_only`: yes
- `parallel_justification`: Closeout is a controller-owned final gate.

- `coverage_check`:
  - `DCR-EXIT-A0` maps to `DCR-EXIT-S0` and final closeout confirmation in `DCR-EXIT-S4`.
  - `DCR-EXIT-A1` maps to `DCR-EXIT-S1` and final closeout confirmation in `DCR-EXIT-S4`.
  - `DCR-EXIT-A2` maps to `DCR-EXIT-S2` and final closeout confirmation in `DCR-EXIT-S4`.
  - `DCR-EXIT-A3` maps to `DCR-EXIT-S3` and final closeout confirmation in `DCR-EXIT-S4`.
  - `DCR-EXIT-D1` is external/manual by maintainer after closeout and is not active plan coverage.
- `coverage_ledger`:
  - `DCR-EXIT-A0`: `slice_id` `DCR-EXIT-S0`; `execution_unit` `DCR-EXIT-W0`; default survivor disposition is stop/replan with final owner assigned by the controller.
  - `DCR-EXIT-A1`: `slice_id` `DCR-EXIT-S1`; `execution_unit` `DCR-EXIT-S1`; default survivor disposition is stop/replan with final owner assigned by the controller.
  - `DCR-EXIT-A2`: `slice_id` `DCR-EXIT-S2`; `execution_unit` `DCR-EXIT-S2`; default survivor disposition is stop/replan with final owner assigned by the controller.
  - `DCR-EXIT-A3`: `slice_id` `DCR-EXIT-S3`; `execution_unit` `DCR-EXIT-S3`; default survivor disposition is stop/replan with final owner assigned by the controller.
- `execution_waves`:
  - `wave_id`: `DCR-EXIT-W0`
  - `slice_ids`: `DCR-EXIT-S0`
  - `completion_condition`: All S0 lane reports are returned, synthesized, dispositioned, and adversarially reviewed with no material gaps.
  - `absorb_now_scope`: Read-only findings synthesis only. No source implementation is absorbed during W0.
  - `replan_triggers`: Any implementation-worthy residue, security issue, cross-boundary ambiguity, docs/source contradiction, external-scope finding, final-owner ambiguity, or need to widen beyond the approved S0 lanes.
- `ready_now_slice`: `DCR-EXIT-S0`
- `ready_now_execution_unit`: `DCR-EXIT-W0`
- `recommended_slice_order`:
  1. `DCR-EXIT-S0`
  2. `DCR-EXIT-S1`
  3. `DCR-EXIT-S2`
  4. `DCR-EXIT-S3`
  5. `DCR-EXIT-S4`
- `parallel_execution_policy`: Only S0 reviewer lanes may run in parallel, with at most four read-only reviewers active at once. S1-S4 are serial. No reviewer may edit files. The controller synthesizes findings and owns all write decisions.

### S0 Audit Lane Design

The controller launches these read-only lanes in batches of no more than four. Each lane must inspect both its Desloppify-derived dimension and the assigned Lineup source families. Lanes may report "no finding" only after recording the source/doc proof they checked.

| Lane | Dimension basis | Lineup coverage focus |
| --- | --- | --- |
| `S0-L01-file-health-hotspots` | file health | hotspot size/shape in app-shell, Orchestrator, SettingsScreen, ChannelManager, PlexStreamResolver, player runtime, large tests |
| `S0-L02-code-quality-control-flow` | code quality | control-flow complexity, lifecycle cleanup, async orchestration, scheduler/channel manager, player recovery, app-shell delegation |
| `S0-L03-duplication-near-miss` | duplication | duplicated policy/helpers across settings stores, Plex URL/policy logic, player/subtitle logic, scheduler/channel setup, tests |
| `S0-L04-test-health-architecture` | test health, test strategy | oversized tests, fragile harness patterns, missing focused coverage, DCR-10 split policy, package verification evidence |
| `S0-L05-security-token-data` | security | Plex tokens/URLs/logging, player/debug logging, shared redaction/storage/platform URL helpers, storage failure behavior, debug surfaces, user data exposure |
| `S0-L06-naming-quality` | naming quality, convention outlier | owners, ports, stores, coordinators, DCR-era names, misleading abstractions or stale names after refactors |
| `S0-L07-error-consistency` | error consistency | Plex auth/discovery/stream errors, player recovery/subtitle errors, storage normalization failures, scheduler/import errors, user-visible diagnostics |
| `S0-L08-abstraction-fitness` | abstraction fitness, cross-module architecture | app-shell/orchestrator composition seams, UI vs persistence vs Plex ownership, player ownership, collaborator boundaries |
| `S0-L09-logic-clarity` | logic clarity | scheduling/channel setup, EPG/settings flow, stream resolution branches, player lifecycle, startup/shutdown paths |
| `S0-L10-ai-generated-debt` | AI-generated debt | restating comments, over-broad helpers, TODO/debug leftovers, boilerplate abstractions, stale plan-driven prose in source/docs |
| `S0-L11-type-safety` | type safety | `any`/casts/non-null assertions, app-facing Plex/player types, settings deps, storage schemas, test helper type erosion |
| `S0-L12-contract-coherence` | contract coherence, API surface coherence | source/API/doc agreement for architecture, Plex integration, UI design rules, control-plane workflow, public module exports |
| `S0-L13-dependency-config-tooling` | dependency health, objective strictness, verified strictness | package manifests/lockfile, TS/Jest/Vite/ESLint config, webOS metadata, verification scripts, strictness drift |
| `S0-L14-package-design-organization` | package organization, design coherence | module exports, folder ownership, UI/design-language agreement, package-local helper placement, public/private seams |
| `S0-L15-initialization-auth-migration` | initialization coupling, authorization consistency, incomplete migration | startup/bootstrap coupling, Plex auth handoff, selected-server/session state, partially migrated APIs or compatibility leftovers |
| `S0-L16-elegance-scale` | high-level elegance, mid-level elegance, low-level elegance | product-level ownership shape, module-level collaboration, local code clarity, slop that is real but not captured by one mechanical detector |

Required source-family coverage across S0:

- `SF1` app-shell/orchestrator/initialization: `src/core/app-shell/`, `src/core/orchestrator/`, `src/core/initialization/`, `src/core/error-recovery/`, related tests.
- `SF2` scheduler/channel/EPG: `src/modules/scheduler/`, `src/core/channel-setup/`, `src/core/channel-tuning/`, `src/modules/ui/epg/`, related tests.
- `SF3` settings/UI/focus/navigation: `src/modules/ui/settings/`, `src/modules/ui/*`, `src/modules/navigation/`, `src/styles/`, related tests.
- `SF4` Plex integration: `src/modules/plex/`, `src/modules/ui/auth/`, `src/modules/ui/server-select/`, `src/core/server-selection/`, related tests.
- `SF5` player/runtime/subtitles: `src/modules/player/`, player-facing UI modules, media/subtitle/recovery tests.
- `SF6` persistence/storage/config state: `src/modules/settings/`, `src/config/`, storage-backed owners in `src/core/*` and `src/modules/*`, raw `localStorage`/`sessionStorage` access.
- `SF7` shared/types/utils/platform: `src/shared/`, `src/types/`, `src/utils/`, `src/platform/`.
- `SF8` tests/harness/fixtures: `src/**/__tests__/`, `tools/`, test fixtures/mocks, package verification surfaces.
- `SF9` docs/control-plane/plans: `ARCHITECTURE_CLEANUP_CHECKLIST.md`, `docs/AGENTIC_DEV_WORKFLOW.md`, `docs/agentic/`, active/completed DCR plans, architecture/API/design docs.
- `SF10` dependency/config/tooling/app metadata: `package.json`, `package-lock.json`, `tsconfig*.json`, `vite.config.ts`, `jest.config.js`, `eslint.config.js`, `public/appinfo.json`, release/build scripts.

### S0 Inventory Gate

Before launching S0 reviewers, the controller must create an inventory artifact from current source using `rg --files` or Codanna-equivalent file inventory plus explicit direct checks for config/doc files. The inventory must cover:

- `src/`;
- `tools/`;
- root dependency/config files: `package.json`, `package-lock.json`, `tsconfig*.json`, `vite.config.ts`, `jest.config.js`, `eslint.config.js`;
- app metadata under `public/`;
- required docs: `ARCHITECTURE_CLEANUP_CHECKLIST.md`, `docs/AGENTIC_DEV_WORKFLOW.md`, `docs/agentic/`, `docs/architecture/`, `docs/api/`, `docs/design/`, and active/completed DCR plans referenced by the checklist.

The controller must map every inventory path or path group to at least one `SOURCE_FAMILY_ID` and one S0 lane before reviewer launch. Explicit exclusions are allowed only for generated/vendor/build artifacts or source-disproved irrelevance, and each exclusion must list the path, reason, and reviewer-approved scope exception. S0 synthesis fails if any in-scope inventory path or path group is unassigned, if a reviewer packet omits an assigned path group, or if a lane report uses hotspot sampling as a substitute for inventory-backed coverage.

### S0 Rubric Coverage Matrix

The controller must assign reviewer packets so every row below has explicit finding or no-finding proof. "Required source families" is a floor, not a sampling suggestion. A lane may inspect more, but it may not omit a required source family without recording a reviewed scope exception before launch.

| Rubric dimension | Primary lane(s) | Required source families | Minimum proof required |
| --- | --- | --- | --- |
| file health | `S0-L01` | `SF1`-`SF9` | list hotspot files reviewed, size/shape rationale, and whether responsibility has concentrated since DCR work |
| code quality | `S0-L02` | `SF1`-`SF7` | inspect complex control flow, async/timer/listener cleanup, lifecycle branches, and record no-finding proof by family |
| duplication | `S0-L03` | `SF1`-`SF8` | run targeted near-miss searches for policy/helper/test duplication and record duplicate/non-duplicate evidence |
| test health | `S0-L04` | `SF1`-`SF8` | map focused vs catch-all coverage, brittle fixture/helper risk, and missing package verification proof |
| security | `S0-L05` | `SF3`-`SF7`, `SF10` | review token/URL/user-data/log/debug/config exposure, including shared redaction/error logging, storage helpers, platform URL/identity helpers, and focused tests; classify live vs source-disproved risks |
| objective strictness | `S0-L13` | `SF7`, `SF8`, `SF10` | inspect strictness config, lint/test/typecheck tool coverage, and known bypasses/suppressions |
| verified strictness | `S0-L13`, `S0-L04` | `SF8`-`SF10` | verify the plan's proof commands cover the audited risk surface or record exact gaps |
| naming quality | `S0-L06` | `SF1`-`SF9` | sample public and owner-facing names in each family and flag stale/misleading DCR-era names |
| error consistency | `S0-L07` | `SF1`, `SF2`, `SF4`, `SF5`, `SF6` | compare error creation/translation/reporting paths and user-visible diagnostics |
| abstraction fitness | `S0-L08` | `SF1`-`SF7` | inspect owner seams, collaborators, ports, factories, stores, and responsibility boundaries |
| logic clarity | `S0-L09` | `SF1`-`SF7` | trace high-risk branches from inputs to outcomes and record clarity/no-finding proof by family |
| AI-generated debt | `S0-L10` | `SF1`-`SF10` | search for TODO/debug leftovers, restating comments, bloated helpers, stale plan prose, and boilerplate abstractions |
| type safety | `S0-L11` | `SF1`-`SF8` | search for `any`, casts, non-null assertions, unsafe parsing, schema gaps, and test-helper type erosion |
| contract coherence | `S0-L12` | `SF1`-`SF10` | compare source exports/contracts with architecture/API/design/control-plane docs and checklist claims |
| high-level elegance | `S0-L16` | `SF1`-`SF9` | judge whether top-level module responsibilities and product/runtime flows are coherent after DCR |
| mid-level elegance | `S0-L16`, `S0-L08` | `SF1`-`SF8` | judge package/class/function collaboration shape for unnecessary indirection or overloaded owners |
| low-level elegance | `S0-L16`, `S0-L09` | `SF1`-`SF8` | inspect local readability, branch naming, helper boundaries, and avoid style-only findings without source risk |
| cross-module architecture | `S0-L08`, `S0-L12` | `SF1`-`SF7`, `SF9` | inspect dependency direction, call paths, module exports, and docs/source architecture agreement |
| initialization coupling | `S0-L15`, `S0-L02` | `SF1`, `SF4`, `SF6` | inspect startup, lazy screen construction, auth/server/session wiring, and shutdown ordering |
| convention outlier | `S0-L06`, `S0-L14` | `SF1`-`SF10` | compare package patterns, filenames, exports, helper locations, test naming, and config conventions |
| dependency health | `S0-L13` | `SF10` | inspect dependency surfaces and tooling config for stale, risky, or unverified setup without running score intake |
| test strategy | `S0-L04` | `SF1`-`SF8` | prove tests are focused around contracts and not only large catch-all suites or brittle internals |
| API surface coherence | `S0-L12`, `S0-L14` | `SF1`-`SF7`, `SF9` | inspect public exports, constructor/factory APIs, docs, and unused or leaky surfaces |
| authorization consistency | `S0-L15`, `S0-L05` | `SF4`, `SF5`, `SF6`, `SF7` | inspect Plex auth/session/token paths, player/stream consumers, shared helpers, and platform URL/identity helpers for consistent ownership |
| incomplete migration | `S0-L15`, `S0-L10` | `SF1`-`SF10` | search for compatibility leftovers, old/new APIs coexisting without owner, stale docs, and migration comments |
| package organization | `S0-L14` | `SF1`-`SF10` | inspect folder/module ownership, helper placement, barrel exports, and package boundaries |
| design coherence | `S0-L14`, `S0-L12` | `SF3`, `SF9` | compare UI source with design language for focus/TV semantics and avoid broad redesign asks |

S0 synthesis must preserve coverage by both `LANE_ID` and `SOURCE_FAMILY_ID`. A "no finding" conclusion is invalid unless the lane report lists the exact source families inspected and the proof used for each required rubric cell.

### Reviewer Packet Template

Each S0 reviewer receives one packet with this shape:

```text
S0_REVIEWER_PACKET
LANE_ID:
DIMENSION_BASIS:
RUBRIC_DIMENSIONS:
ASSIGNED_INVENTORY_PATHS_OR_GROUPS:
SOURCE_FAMILIES:
SOURCE_FAMILY_IDS:
COVERAGE_CELLS:
REQUIRED_DOCS:
CODANNA_FIRST:
  - run semantic_search_with_context/search_documents for the lane topic when available
  - run analyze_impact if a live shared-symbol seam is identified
  - record fallback to rg/direct reads when unavailable or insufficient
READ_ONLY: yes
OUTPUT_REQUIRED:
  - S0_LANE_REPORT
  - source evidence list
  - confirmation that assigned inventory paths or path groups were inspected or explicitly scope-excepted
  - no-finding proof by source family and rubric cell
  - findings ledger rows
  - no-write confirmation
STOP_AND_FLAG:
  - security issue
  - implementation-worthy residue
  - docs/source contradiction
  - cross-boundary ambiguity
  - final-owner ambiguity
```

Lane reports must use this output shape:

```text
S0_LANE_REPORT
LANE_ID:
DIMENSION_BASIS:
RUBRIC_DIMENSIONS:
ASSIGNED_INVENTORY_PATHS_OR_GROUPS:
SOURCES_CHECKED:
SOURCE_FAMILY_PROOF:
  - source_family_id:
    paths_checked:
    inventory_assignment_coverage:
    rubric_cells:
    no_finding_or_finding_ids:
CODANNA_EVIDENCE:
FALLBACK_EVIDENCE:
NO_FINDING_PROOF:
FINDINGS:
  - id:
    title:
    dimension:
    source_paths:
    evidence:
    severity: blocker | high | medium | low
    recommended_disposition: fix_in_dcr_exit | split_final_dcr_package | source_disprove | accepted_residual
    proposed_owner:
    revisit_trigger:
    verification_needed:
READ_ONLY_CONFIRMATION: no files changed
```

### Synthesis Rules

The controller builds one audit matrix and one findings ledger from all S0 reports:

- Deduplicate overlapping findings by current-source evidence, not by wording.
- Preserve every lane's no-finding proof in the matrix by `LANE_ID`, `SOURCE_FAMILY_ID`, and rubric dimension.
- Treat any missing required rubric/source-family cell as a material S0 synthesis gap until a reviewer fills it or the controller records a reviewed scope exception.
- Treat any unassigned or unchecked in-scope inventory path/path group as a material S0 synthesis gap until a reviewer fills it or the controller records a reviewed scope exception.
- Assign each finding exactly one disposition before S1.
- `fix_in_dcr_exit` requires a bounded write unit and verification envelope before editing; otherwise stop and replan.
- `split_final_dcr_package` must name the package id, owner, source finding ids or issue ids, and verification gate.
- `source_disprove` must cite exact source/doc evidence and explain why the apparent issue is not live.
- `accepted_residual` must include final owner, revisit trigger, non-blocker rationale, and whether future-port ownership applies.
- Security findings default to stop/replan unless source-disproved as false positive by exact evidence.
- A final adversarial reviewer must review S0 synthesis before S1 begins.

## Files In Scope

- `docs/plans/2026-04-30-dcr-exit-final-dimension-audit-plan.md`
- `ARCHITECTURE_CLEANUP_CHECKLIST.md`
- Completed DCR plan files referenced by `ARCHITECTURE_CLEANUP_CHECKLIST.md`
- `docs/architecture/CURRENT_STATE.md`
- `docs/architecture/README.md`
- `docs/architecture/modules.md`
- `docs/api/plex-integration.md`
- `docs/design/ui-design-language.md`
- `docs/AGENTIC_DEV_WORKFLOW.md` and `docs/agentic/*` only when control-plane source/docs reconciliation requires it
- Source and test files read by S0 reviewers or package reconciliation
- Dependency/config/tooling/app metadata files required by `SF10`: `package.json`, `package-lock.json`, `tsconfig*.json`, `vite.config.ts`, `jest.config.js`, `eslint.config.js`, `public/appinfo.json`, and verification/build scripts under `tools/`
- DCR-EXIT inventory map, audit matrix, and findings ledger if the controller creates tracked or local execution artifacts during the loop

## Files Out Of Scope

- Unrelated dirty or untracked DCR-10 implementation/doc files present before this plan executes
- Fresh Desloppify scan output, score artifacts, review packets, review imports, queue imports, and automated score refresh artifacts
- Future Windows/Electron port implementation, real-device Plex validation, native media integration, and manual future-port proof
- New feature/design work
- Broad dependency upgrades, framework migrations, or test harness rewrites not forced by a source-backed DCR-EXIT blocker
- Production/test source edits during S0 reviewer lanes

## Planner Self-Check

- Architecture seam: resolved for planning. DCR-EXIT starts with read-only source audit, then serial reconciliation. Any implementation-worthy source change stops for replan before writes.
- Adjacent contracts: explicit. App-shell, initialization, player, UI, persistence, Plex, scheduler, dependency/config/tooling, docs, and test architecture are audit surfaces; contract changes are not pre-approved.
- Out-of-scope dependencies: explicit. Future-port work and score refresh work are outside this execution surface.
- Codanna evidence: Codanna was unavailable in this planner runtime; fallback reads are recorded. Execution is required to try Codanna first and record fallback.
- Ownership: S0 reviewers are read-only; the cleanup controller owns synthesis and final disposition; final residuals require one owner and revisit trigger.
- Fresh-session readiness: package id, ready-now execution unit, lane packets, disposition rules, verification, and stop conditions are explicit.
- Plan grade: execution-ready at audit/reconciliation seam level without pretending to know future implementation patches.

## Architecture Seam Decision Gate

Approved seams:

- `DCR-EXIT-S0` is a read-only audit wave. Reviewers do not edit files.
- DCR-EXIT closeout requires S0 source-backed audit proof plus package reconciliation. Known DCR checkboxes alone are insufficient.
- Score refresh is external/manual by maintainer after closeout and cannot drive DCR-EXIT scope.
- The controller may only approve a DCR-EXIT write after assigning a bounded finding disposition and verification envelope.

Preservation contracts:

- Existing DCR package closeout evidence remains authoritative only when supported by current source.
- Architecture/API/design docs must remain subordinate to current source when contradictions appear.
- UI/focus, Plex token/URL policy, persistence ownership, scheduler behavior, and app-shell lifecycle claims must not be silently changed by documentation-only closeout.

Stop and replan if:

- S0 finds implementation-worthy residue that is not a trivial documentation/checklist correction;
- any source finding crosses app-shell/UI/Plex/persistence/scheduler ownership boundaries without one clear owner;
- docs contradict source in a way that changes public architecture/API/design truth;
- a security finding is live or cannot be source-disproved quickly;
- a finding belongs to future-port work or another non-DCR track and needs maintainer routing;
- any accepted residual lacks final owner, revisit trigger, and non-blocker rationale;
- verification scope widens beyond `npm run plans:check`, `npm run verify:docs`, `npm run verify`, targeted package tests, and source-audit proof surfaces;
- a reviewer or implementer tries to use a fresh Desloppify scan/queue/import/score refresh as DCR-EXIT intake.

## Verification Commands

Verification mode: `integration-ops` with source-audit proof and priority-exit review.

- Verification classification: `broader integration/manual proof required`

Planning artifact verification:

- Run: `npm run plans:check`
- Expected: active tracked plan conformance passes for this plan and other active plans.

Direct active-plan harness check for this file before tracking, if `plans:check` does not see untracked files:

- Run: `node --input-type=module -e "import { readFileSync } from 'node:fs'; import { checkPlanConformance } from './tools/harness-docs-lib.mjs'; const filePath = 'docs/plans/2026-04-30-dcr-exit-final-dimension-audit-plan.md'; const result = checkPlanConformance({ filePath, content: readFileSync(filePath, 'utf8') }); const failures = [...result.errors, ...result.missingSections.map((section) => 'missing section: ' + section)]; if (failures.length > 0) { console.error(failures.join('\\n')); process.exit(1); } console.log('Direct active plan conformance passed.');"`
- Expected: direct active plan conformance passes for this plan.

S0 source-audit proof surfaces:

- Codanna evidence per lane: `semantic_search_with_context`, `search_documents`, and `analyze_impact` where applicable, or explicit fallback notes.
- Fallback evidence per lane: `rg --files`, targeted `rg`, direct reads, and source/doc paths inspected.
- S0 lane reports: every lane returns source evidence, no-finding proof or findings, and no-write confirmation.
- S0 synthesis: audit matrix plus findings ledger with every finding dispositioned.
- S0 adversarial review: clean reviewer pass before S1 begins.

Execution verification:

- Run: targeted tests named by any final package reconciliation or bounded DCR-EXIT fix.
- Expected: affected source/test proof passes before the finding is marked fixed.
- Run: `npm run verify:docs`
- Expected: workflow/control-plane/reference docs validate after checklist/plan/doc updates.
- Run: `npm run verify`
- Expected: full UI/navigation/Orchestrator/Plex/runtime proof passes after docs/source reconciliation and any implementation-worthy fixes.

Closeout review:

- Run a priority-exit cleanup review after S0-S4 synthesis and verification.
- Expected: no material findings; if review previously found material issues, run a fresh final clean approval pass after closure checks.

## Rollback Notes

- If the plan/checklist doc refresh is wrong, revert only the DCR-EXIT plan file and the DCR-EXIT checklist entry. Do not touch unrelated dirty/untracked DCR-10 files.
- If S0 synthesis proves the plan shape is too narrow, keep the S0 lane reports as evidence and update this plan before any implementation.
- If a small DCR-EXIT fix fails verification, revert that focused fix and keep the finding open in the ledger with a named final owner or split package.
- If docs/source reconciliation exposes broad architecture drift, stop closeout and create a named final DCR package instead of forcing DCR-EXIT completion.

## Commit Checkpoints

- Commit this plan/checklist documentation refresh separately from any later implementation commits.
- Do not bundle active `docs/plans/*` progress edits into implementation commits.
- If DCR-EXIT later creates implementation fixes, each fix batch needs a focused commit that excludes active plan progress files unless the controller explicitly creates a separate tracked-doc commit.
- Do not commit unrelated dirty or untracked DCR-10 work as part of DCR-EXIT planning or closeout.

## Priority-Exit Readiness

Before closing `DCR-EXIT`, execution must record:

- `DCR-EXIT-A0`
  - Expected disposition: `resolved`
  - Final owner: cleanup controller until the S0 audit matrix has no unowned findings.
  - Revisit trigger: any source-backed S0 finding remains undispositioned.
- `DCR-EXIT-A1`
  - Expected disposition: `resolved`
  - Final owner: cleanup controller until every `DCR-1` through `DCR-10` package outcome has proof.
  - Revisit trigger: any DCR package has an unresolved actual issue or detector-only proof.
- `DCR-EXIT-A2`
  - Expected disposition: `resolved`
  - Final owner: cleanup controller until every owner decision has one outcome, owner, and accepted-residual trigger where applicable.
  - Revisit trigger: any owner decision has competing owners or no revisit trigger.
- `DCR-EXIT-A3`
  - Expected disposition: `resolved`
  - Final owner: cleanup controller until architecture/API/design/control-plane docs match source.
  - Revisit trigger: docs/source contradiction remains without a named package or owner.
- `DCR-EXIT-D1`
  - Expected disposition: `accepted residue`
  - Final owner: maintainer, external/manual after closeout.
  - Revisit trigger: maintainer chooses to run a retrospective score refresh after DCR-EXIT closes.

Security triage expectation: no open `P0` security findings may remain live, open, or deferred at closeout. A `P0` may close only when fixed with verification or source-disproved by exact current-source evidence. Owner/revisit/non-blocker rationale is allowed for lower-severity accepted residuals or explicitly maintainer-approved non-`P0` future-port/security-adjacent work; it is not sufficient for a live `P0`.

No `P(n+1)` should start until `DCR-EXIT` is completed, reviewed, and updated in `ARCHITECTURE_CLEANUP_CHECKLIST.md`.

`DCR-EXIT` is complete only when the S0 audit, DCR package reconciliation, owner-decision ledger, docs/source reconciliation, required verification, and clean priority-exit review are all complete.

## Handoff

MODEL_SUGGESTION
PLANNER: gpt-5.5 high
IMPLEMENTER: gpt-5.5 medium
REVIEWER: gpt-5.5 high
WHY: Tier 3 priority-exit cleanup gate with cross-boundary source audit, multiple boundary skills, security/docs/source risk, and checklist closeout consequences. Use gpt-5.4 high/medium/high fallback if gpt-5.5 is unavailable.

```text
NEXT_SESSION_HANDOFF
LAUNCHER: $lineup-cleanup-loop
PLAN: docs/plans/2026-04-30-dcr-exit-final-dimension-audit-plan.md
CHECKLIST: ARCHITECTURE_CLEANUP_CHECKLIST.md section DCR-EXIT
TASK_FAMILY: cleanup/refactor
CLEANUP_SUBTYPE: checklist-linked
PACKAGE_ID: DCR-EXIT
READY_NOW_EXECUTION_UNIT: DCR-EXIT-W0
READY_NOW_SLICE: DCR-EXIT-S0
MESSAGE:
  Run cleanup-loop for DCR-EXIT using the active plan above.
  First confirm DCR-1 through DCR-10 are complete enough to enter DCR-EXIT.
  Execute DCR-EXIT-S0 before package reconciliation: first build the S0
  inventory map from current source/docs/config, then launch read-only reviewer
  lanes in batches of at most four, using Desloppify dimensions as rubric only.
  Do not run a fresh Desloppify scan, review import, queue import, or score
  refresh as task intake. Codanna-first discovery is required; record fallback
  to rg/direct reads when Codanna is unavailable or insufficient.
  Synthesize all lane reports into an audit matrix/findings ledger. Every
  finding needs exactly one disposition: fix in DCR-EXIT only after a bounded
  replan, split into a named final DCR package, source-disprove, or accepted
  residual with owner and revisit trigger. Run a final adversarial review of S0
  synthesis before S1. Any live P0 security finding blocks closeout unless fixed
  with verification or source-disproved. Score refresh D1 is external/manual by
  maintainer after closeout and is out of DCR-EXIT execution.
```
