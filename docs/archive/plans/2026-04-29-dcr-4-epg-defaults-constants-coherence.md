# DCR-4 EPG Defaults And Constants Coherence

**Plan Status:** archived
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

## Goal

Retire `ARCHITECTURE_CLEANUP_CHECKLIST.md` package `DCR-4` by making EPG
default config ownership coherent across the EPG module and app-shell
orchestrator config assembly.

This plan resolves the listed DCR-4 issues:

- `DCR-4-A1`: UI EPG constants use `rowHeight` `108` while
  `AppOrchestratorConfigFactory` defines `DEFAULT_EPG_CONFIG.rowHeight` `96`.
- `DCR-4-D1`: decide which module owns canonical EPG default config and whether
  app-shell imports it, adapts it, or intentionally overrides it.

The chosen contract is: `src/modules/ui/epg/constants.ts` owns the canonical EPG
default config values, including row height. App-shell must import an EPG-owned
default-config factory from the public EPG package seam and must not keep a
second local EPG default literal or intentional override for DCR-4.

## Non-Goals

- Do not start `DCR-5`, `DCR-EXIT`, or unrelated cleanup.
- Do not update `ARCHITECTURE_CLEANUP_CHECKLIST.md` during implementation;
  checklist closeout remains controller-owned after implementation and review.
- Do not redesign EPG layout, sizing, focus, virtualization, or visual behavior.
- Do not change `EPGVirtualizer` internals unless the targeted tests prove the
  row-height source-of-truth change requires a minimal test expectation update.
- Do not change app-shell composition behavior unrelated to EPG config defaults.
- Do not introduce compatibility branches or a temporary app-shell override.

## Parent Architecture Alignment

DCR-4 advances the EPG config/app-shell config boundary owner named in the
checklist. Current architecture truth says:

- `src/modules/ui/epg/startup/buildEPGStartupConfig.ts` owns EPG startup-config
  shaping consumed by initialization.
- The EPG package root is a bounded cross-module seam.
- App-shell composition may wire and materialize feature-owned containers, but
  feature packages retain ownership of their feature defaults and UI policy.

The app-shell config factory should therefore assemble app-level config from
module-owned defaults. It may clone/adapt the EPG-owned default config through a
public EPG package seam, but it must not own an independent EPG default config.

## Required Reading

Read in this order before implementation:

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/cleanup-loop.md`
4. `ARCHITECTURE_CLEANUP_CHECKLIST.md`
   - DCR Operating Rules
   - full `DCR-4` section
   - `DCR-5` only as an out-of-scope guard
5. `docs/architecture/CURRENT_STATE.md`
6. `docs/agentic/plan-authoring-standard.md`
7. `docs/agentic/codanna-playbook.md`
8. This plan

## Required Skills

- `architecture-boundaries`
- `verification-strategy`
- `execution-plan-authoring`

Use `ui-composition-patterns` only if implementation discovery proves a direct
TV-visible EPG component/layout change is unavoidable. This plan expects no
layout refactor.

## Codanna Discovery

Codanna tools were unavailable in this planner session: no callable Codanna
namespace or Codanna MCP tools were exposed in tool discovery. Following
`docs/agentic/codanna-playbook.md`, discovery used deterministic `rg` and
direct reads as the fallback.

Fallback evidence:

- Direct reads covered the required workflow docs, cleanup-loop launcher, DCR
  Operating Rules, full DCR-4 checklist entry, current architecture EPG/app-shell
  ownership claims, plan authoring standard, Codanna playbook, and relevant
  repo-local skill instructions.
- Direct source reads covered:
  `src/modules/ui/epg/constants.ts`,
  `src/modules/ui/epg/types.ts`,
  `src/modules/ui/epg/component/EPGComponent.ts`,
  `src/modules/ui/epg/startup/buildEPGStartupConfig.ts`,
  `src/modules/ui/epg/startup/EPGStartupConfigRuntime.ts`,
  `src/modules/ui/epg/index.ts`,
  `src/core/app-shell/AppOrchestratorConfigFactory.ts`,
  `src/core/app-shell/__tests__/AppOrchestratorConfigFactory.test.ts`, and the
  relevant EPG tests under `src/modules/ui/epg/__tests__/`.
- `rg -n "rowHeight|DEFAULT_EPG|EPG_CONSTANTS|ROW_HEIGHT|buildEPGStartupConfig"`
  over the DCR-4 source/test surface showed EPG constants define
  `EPG_CONSTANTS.ROW_HEIGHT` as `108`, EPG `DEFAULT_EPG_CONFIG.rowHeight` derives
  from that constant, and app-shell independently defines `rowHeight: 96`.
- The same search showed EPG CSS fallbacks reference `108px` and comment that
  they must match `EPG_CONSTANTS.ROW_HEIGHT`; those CSS files are read-only
  audit context unless the implementation proposes changing the canonical value.

If Codanna becomes available in the implementation session, rerun:

- `semantic_search_with_context` for `EPG default config rowHeight app-shell`.
- `search_documents` for `DCR-4 EPG Defaults And Constants Coherence`.
- `analyze_impact` for the chosen public EPG default-config factory symbol
  before widening its package-root export.

Replan if Codanna or source discovery reveals a production consumer that depends
on app-shell's `96` row height as an intentional context-specific override.

## Impact Snapshot

Source-backed facts that shape the plan:

- `src/modules/ui/epg/constants.ts` already owns `EPG_CONSTANTS`,
  `EPG_CONTAINER_ID`, and `DEFAULT_EPG_CONFIG`.
- `DEFAULT_EPG_CONFIG.rowHeight` already points at
  `EPG_CONSTANTS.ROW_HEIGHT`, currently `108`.
- `EPGComponent` initializes with `{ ...DEFAULT_EPG_CONFIG, ...config }` and
  applies `config.rowHeight` to `--epg-row-height`, so callers can still pass an
  explicit row-height override for tests or future product-approved behavior.
- `buildEPGStartupConfig` and `EPGStartupConfigRuntime` enrich an incoming
  `EPGConfig` with runtime callbacks and settings; they do not own static
  default values.
- `AppOrchestratorConfigFactory` currently imports only `EPG_CONTAINER_ID` and
  `EPGConfig` from the EPG root, then defines a private
  `DEFAULT_EPG_CONFIG` literal with `rowHeight: 96`.
- `AppOrchestratorConfigFactory.test.ts` proves fresh object creation and
  container ids, but it does not protect the canonical EPG default ownership
  contract or the row-height value.
- EPG tests commonly use fixture-specific row heights such as `80`, `72`, `64`,
  `50`, and `123`; those are intentional local test inputs, not default config
  sources.

## Files In Scope

- `src/modules/ui/epg/constants.ts`
- `src/modules/ui/epg/index.ts`
- `src/modules/ui/epg/types.ts`
- `src/modules/ui/epg/component/EPGComponent.ts`
- `src/modules/ui/epg/__tests__/*`
- `src/modules/ui/epg/startup/buildEPGStartupConfig.ts`
- `src/modules/ui/epg/startup/EPGStartupConfigRuntime.ts`
- `src/core/app-shell/AppOrchestratorConfigFactory.ts`
- `src/core/app-shell/__tests__/AppOrchestratorConfigFactory.test.ts`
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` only for controller-owned closeout after
  implementation/review is clean.

`src/modules/ui/epg/startup/EPGStartupConfigRuntime.ts` is in scope only if the
implementation proves the default-config seam must be composed with startup
config enrichment. The expected implementation does not need to edit it.

## Files Out Of Scope

- `DCR-5`, `DCR-EXIT`, and unrelated DCR packages.
- `src/modules/ui/epg/view/EPGVirtualizer.ts` internals unless tests prove a
  minimal expectation update is required by the chosen default source of truth.
- Broad EPG design, layout, focus, visual, or virtualization refactors.
- App-shell container composition or orchestration behavior unrelated to EPG
  config defaults.
- EPG CSS files, unless the canonical row-height value changes away from `108`;
  this plan chooses `108`, so CSS fallback edits are not expected.
- Docs outside the checklist/current-state closeout path unless implementation
  changes the public architecture claims recorded in this plan.

## Package Decomposition

package_id: `DCR-4`

checklist_token: `DCR-4`

package_issue_ids: `DCR-4-A1`, `DCR-4-D1`

ready_now_slice: `DCR-4-S1`

ready_now_execution_unit: `DCR-4-S1`

recommended_slice_order: `DCR-4-S1`

parallel_execution_policy: serial-only. DCR-4 is a single-slice package with
shared EPG/app-shell default-config ownership and shared verification. Parallel
cleanup-worker execution is unavailable because there is no disjoint write
scope, no disjoint verification surface, and no separate controller-owned
integration path to prove.

slice_table:

| slice_id | goal | areas/files | exact_issue_ids | verification | dependencies | stop_condition | handoff_condition | serial_only | parallel_justification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DCR-4-S1` | Decide and normalize EPG default ownership. Keep EPG as canonical owner, expose an EPG-owned default-config factory through the package root, remove app-shell's private EPG default literal, and protect the contract with targeted tests plus source audit. | `src/modules/ui/epg/constants.ts`; `src/modules/ui/epg/index.ts`; `src/core/app-shell/AppOrchestratorConfigFactory.ts`; targeted tests under `src/modules/ui/epg/__tests__/*` and `src/core/app-shell/__tests__/AppOrchestratorConfigFactory.test.ts`; `EPGComponent.ts`, `types.ts`, and startup config files only if the compile/test seam requires them. | `DCR-4-A1`, `DCR-4-D1` | Add or update targeted EPG default-config and app-shell config tests, run the row-height source audit, then `npm run verify`; controller closeout also runs `npm run verify:docs` after checklist mini-record changes. | None. This is the first and only DCR-4 slice. | Stop and replan if the default value must change from `108` to `96`, if tests/source prove `96` is an intentional app-shell-only visual override, if implementation must edit EPG layout/virtualizer internals beyond test expectations, or if a new cross-module default-config owner is needed. | Handoff is complete when app-shell consumes the EPG-owned default factory, no production `rowHeight: 96` app-shell default remains, tests prove fresh config objects and canonical row-height ownership, and the row-height audit has only intentional fixture overrides or CSS fallbacks aligned with the chosen canonical value. | yes | Single shared ownership seam; splitting would duplicate app-shell/EPG edits and weaken the contract proof. |

coverage_check:

- `DCR-4-A1` maps exactly to `DCR-4-S1`; it is retired when the app-shell
  factory no longer carries `rowHeight: 96` and instead consumes the EPG-owned
  canonical default.
- `DCR-4-D1` maps exactly to `DCR-4-S1`; it is retired by the explicit decision
  that EPG owns canonical defaults and app-shell imports a fresh EPG-owned
  default-config factory without a documented override.
- No DCR-4 issue is deferred or split. Any discovered residual with a different
  owner requires replan before implementation continues.

## Planner Self-Check

- Ownership seam is resolved: EPG owns canonical defaults; app-shell consumes
  through the public EPG package seam.
- No out-of-scope file is required for the expected implementation. Startup
  runtime files are listed with a narrow guard because startup config delegates
  through them, but they are not expected write targets.
- The plan does not require `EPGVirtualizer` internals or broad layout changes.
- Codanna unavailability is recorded, and fallback `rg`/direct-read evidence is
  listed.
- The plan avoids growing app-shell into an EPG policy owner.
- A fresh session does not need to choose the default owner, override policy, or
  verification depth.

## Architecture Seam Decision Gate

DCR-4-D1 is resolved before implementation:

- Canonical owner: `src/modules/ui/epg/constants.ts`.
- Public cross-module seam: the EPG package root should expose an EPG-owned
  default-config factory that returns a fresh `EPGConfig` clone.
- App-shell policy: `src/core/app-shell/AppOrchestratorConfigFactory.ts` must
  import and use that EPG-owned factory. It must remove its private
  `DEFAULT_EPG_CONFIG` literal and must not intentionally override row height.
- Canonical row-height value for this package: `108`, because EPG constants,
  EPG component defaults, and existing CSS fallback comments already align on
  `108`; the app-shell `96` literal is the drift to retire.
- `buildEPGStartupConfig` remains the owner for runtime startup enrichment, not
  static default values.

Stop and replan before source edits if any of these become true:

- Product/visual evidence requires changing the canonical row height from `108`
  to `96` or another value.
- Source discovery proves app-shell intentionally needs a context-specific EPG
  row-height override.
- The implementation needs to alter EPG virtualization behavior, layout
  semantics, focus behavior, or startup order.
- A public API or type change outside the DCR-4 source surface is required.
- Verification must expand beyond the targeted config tests, source audit,
  `npm run verify`, and docs closeout commands listed below.

Absorb-now policy:

- Absorb only row-height/default-config residue inside the same EPG constants to
  app-shell config seam, same files, same verification envelope, and same final
  EPG default owner.
- Replan for any new owner, new checklist membership, widened layout/visual
  surface, or changed final-owner accounting.

## Verification Commands

Verification strategy classification: `new regression/contract test required`.

Primary verification mode: `contract-first`, supported by a source audit and the
repo-wide UI/app-shell gate.

Required implementation verification:

1. Targeted config tests:
   `npm run test:unit -- src/core/app-shell/__tests__/AppOrchestratorConfigFactory.test.ts src/modules/ui/epg/__tests__/EPGComponent.test.ts src/modules/ui/epg/__tests__/buildEPGStartupConfig.test.ts src/modules/ui/epg/__tests__/EPGStartupConfigRuntime.test.ts src/modules/ui/epg/__tests__/index.test.ts src/modules/ui/epg/__tests__/constants.test.ts --runInBand`
   - Expected result: passes after adding/updating the EPG default-config
     contract test. If the implementer uses a different test filename for the
     new EPG default-config contract, substitute that exact file and record the
     substitution in handoff.
2. Source audit:
   `rg -n "rowHeight:\\s*(96|108)|ROW_HEIGHT|DEFAULT_EPG_CONFIG|createDefaultEpgConfig|--epg-row-height" src/modules/ui/epg src/core/app-shell`
   - Expected result: no production app-shell `rowHeight: 96` default remains;
     the only canonical default row height is EPG-owned; fixture-specific
     row-height values in tests are clearly intentional; CSS fallbacks, if
     present, still align with `EPG_CONSTANTS.ROW_HEIGHT`.
3. `npm run verify`
   - Expected result: passes because DCR-4 touches EPG UI/app-shell config
     wiring.
4. `npm run plans:check`
   - Expected result: passes after this active tracked plan is created or
     refreshed.
5. Controller closeout after implementation/review and checklist mini-record
   update:
   `npm run verify:docs`
   - Expected result: passes because DCR-4 closeout updates
     `ARCHITECTURE_CLEANUP_CHECKLIST.md` and may archive/delete this active
     plan according to DCR Operating Rules.

This proof depth matches the risk because the package changes a shared
configuration contract, not a broad behavior flow. A narrow contract test should
catch future app-shell/local-default drift, while `npm run verify` covers the
UI/app-shell integration blast radius.

## Rollback Notes

Rollback is narrow:

- Restore app-shell's prior local EPG default literal only if implementation
  uncovers a source-backed, product-approved app-shell override requirement, and
  replan first because that would change DCR-4-D1's decision.
- If the public EPG package-root factory export causes import-cycle or barrel
  pressure, roll back that export and replan a narrower public seam before
  editing app-shell further.
- Do not roll back by silently changing EPG row height to `96`; that would be a
  product/layout decision outside this cleanup plan.

## Commit Checkpoints

- Planning artifact only: this active plan may be committed separately by the
  controller if desired, but this session does not commit.
- Implementation checkpoint: after `DCR-4-S1` implementation and targeted
  verification pass, the cleanup worker should create one focused
  non-interactive implementation commit containing only source/test changes.
- Controller closeout checkpoint: after clean implementation review, the
  controller updates `ARCHITECTURE_CLEANUP_CHECKLIST.md`, runs
  `npm run verify:docs`, and archives/deletes this active plan according to DCR
  Operating Rules in a separate docs/control-plane commit if a commit is
  requested.
