**Plan Status:** completed
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

# FCP-1 Channel Setup UI/Core Handoff Package Plan

## Goal

Execute the next ready `FCP-1` package by narrowing the channel setup screen/session handoff so UI and app-shell channel-setup screen wiring no longer expose the full core `ChannelSetupWorkflowPort` contract to the TV-facing setup workflow.

The tracked audit companion is `docs/plans/2026-04-29-fcp-1-architecture-handoff-audit.md`. This plan owns `ready_now_execution_unit: FCP-1-S2` only. It does not authorize package-wide `FCP-1` implementation or broad channel-setup redesign.

## Non-Goals

- Do not change channel setup behavior, screen text, focus behavior, DOM IDs, preview debounce, timeout behavior, build cancellation, setup completion bookkeeping, or first-time setup routing.
- Do not move core channel setup planning/build/persistence logic out of `src/core/channel-setup/`.
- Do not remove every UI import of core channel-setup DTOs or constants by default; this package targets the workflow-port handoff. Remaining domain DTO imports may be accepted only with source-backed rationale.
- Do not change `AppOrchestrator.getChannelSetupWorkflowPort()` or the core diagnostics workflow contract unless a replan explicitly authorizes it.
- Do not touch `FCP-1-SF4` AppOrchestrator runtime assembly hub work.
- Do not use Desloppify output, imported issue ids, package maps, score deltas, or detector evidence for intake, proof, prioritization, or closure.
- Do not mark `FCP-1` complete after this package while `FCP-1-SF4` remains unresolved or explicitly accepted by source-backed review.

## Parent Priority Alignment

Checklist token: `FCP-1`

This plan advances architecture and handoff coherence by replacing a broad UI/core workflow handoff with a screen/session-facing contract owned at the channel setup UI boundary. Current source shows the screen/session path needs setup libraries, record/context reads, preview/review, build, completion marking, and facet invalidation; it does not need planner diagnostics.

`FCP-1-SF1` and `FCP-1-SF2` were resolved by the completed first package. `FCP-1-SF3` is this plan's only approved source finding. `FCP-1-SF4` remains deferred to a later source-backed package or no-action acceptance.

## Required Reading

1. `agents.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/cleanup-loop.md`
4. `docs/agentic/plan-authoring-standard.md`
5. `docs/architecture/CURRENT_STATE.md`
6. `docs/architecture/modules.md`
7. `ARCHITECTURE_CLEANUP_CHECKLIST.md`
8. `docs/plans/2026-04-29-fcp-1-architecture-handoff-audit.md`
9. `docs/plans/2026-04-29-fcp-1-architecture-handoff-coherence.md`
10. `src/core/app-shell/AppShellRuntimeContracts.ts`
11. `src/core/app-shell/AppLazyScreenPortFactory.ts`
12. `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
13. `src/modules/ui/channel-setup/ChannelSetupScreenPorts.ts`
14. `src/modules/ui/channel-setup/ChannelSetupSessionContracts.ts`
15. `src/modules/ui/channel-setup/ChannelSetupSessionController.ts`
16. `src/modules/ui/channel-setup/ChannelSetupSessionRuntime.ts`
17. `src/modules/ui/channel-setup/ChannelSetupSessionState.ts`
18. `src/core/channel-setup/workflow/ChannelSetupWorkflowPort.ts`
19. `src/modules/ui/channel-setup/__tests__/channel-setup-test-helpers.ts`

Freshness gate: if any listed source file materially changed after this plan was written, refresh the source audit and update this plan before implementation.

## Required Skills

- `architecture-boundaries`: channel setup is a documented hotspot and this package changes a cross-module handoff.
- `ui-composition-patterns`: channel setup is a TV-facing screen with focus, listener, timer, and status behavior to preserve.
- `verification-strategy`: verification mode and proof surface are fixed before implementation.
- `execution-plan-authoring`: serious tracked cleanup plan with FCP source-backed coverage.

## Codanna Discovery

- `get_index_info`: Codanna was available with 11117 symbols, 696 files, semantic search enabled, and embeddings updated about 53 minutes before this planning pass.
- `semantic_search_with_context`: query `ChannelSetupScreen channel setup UI core handoff` returned 5 weak/noisy matches; the top hit was `src/modules/plex/library/requestIntent.ts` with score 0.354, followed by unrelated settings/navigation symbols. Query `ChannelSetupSessionController ChannelSetupSessionRuntime ChannelSetupCoordinator` was also weak/noisy and did not reliably identify package membership.
- `search_symbols`: query `ChannelSetup` found the expected source anchors, including `src/modules/ui/channel-setup/ChannelSetupScreen.ts`, `src/core/channel-setup/types.ts`, `src/core/channel-setup/ChannelSetupCoordinator.ts`, and `src/modules/ui/channel-setup/ChannelSetupScreenPorts.ts`. Query `ChannelSetupSession` found `ChannelSetupSessionState`, `ChannelSetupSessionRuntime`, `ChannelSetupSessionContracts`, and `ChannelSetupSessionController`.
- `search_documents`: query `FCP-1 channel setup UI core handoff` returned relevant prior channel setup cleanup plans and current workflow hits, with a lock-busy auto-sync warning. The most relevant prior plan was `docs/plans/2026-04-15-p10-w5-channel-setup-post-scan-residual-cleanup.md`, which established `ChannelSetupSessionController` as a wrapper over state/runtime and kept UI ownership under `src/modules/ui/channel-setup/`.
- `analyze_impact`: `ChannelSetupCoordinator` returned zero impacted symbols, which is not credible for this shared runtime seam. Treat impact output as insufficient.
- Fallback recorded: because Codanna semantic and impact results were insufficient for exact package membership, deterministic `rg`, `wc -l`, and direct source reads were used for the final readiness decision.

No external documentation was needed.

## Impact Snapshot

Current source evidence for `FCP-1-SF3`:

- `src/core/app-shell/AppShellRuntimeContracts.ts` exposes `getChannelSetupWorkflowPort(): ChannelSetupWorkflowPort` through `AppShellChannelSetupRuntimePort`, so app-shell screen wiring carries the full core workflow port.
- `src/core/app-shell/AppLazyScreenPortFactory.ts` imports `ChannelSetupWorkflowPort` from core and passes `runtime.getChannelSetupWorkflowPort()` directly to `ChannelSetupScreen`.
- `src/modules/ui/channel-setup/ChannelSetupScreen.ts`, `ChannelSetupSessionController.ts`, `ChannelSetupSessionRuntime.ts`, and `ChannelSetupSessionContracts.ts` type against core `ChannelSetupWorkflowPort`.
- `src/core/channel-setup/workflow/ChannelSetupWorkflowPort.ts` includes `getSetupPlanDiagnostics(...)`, which is used by app-shell diagnostics, not by the channel setup screen/session path.
- `src/modules/ui/channel-setup/ChannelSetupSessionRuntime.ts` actually uses only `invalidateFacetSnapshot`, `getLibrariesForSetup`, `getChannelSetupRecord`, `getSetupContextForSelectedServer`, `getSetupPreview`, `getSetupReview`, `createChannelsFromSetup`, and `markSetupComplete`.
- Existing tests cover the seam: `AppLazyScreenPortFactory.test.ts`, `AppShellRuntimeContracts.test.ts`, channel setup screen contract tests, session controller/runtime/state tests, and core workflow-port tests.

Owner seam:

- Core channel setup owns planning/build/persistence/diagnostics and the full `ChannelSetupWorkflowPort`.
- Channel setup UI owns the screen/session workflow input contract used by `ChannelSetupScreen`, `ChannelSetupSessionController`, and `ChannelSetupSessionRuntime`.
- App-shell channel setup runtime should expose the UI screen workflow contract for lazy screen construction. App-shell diagnostics may continue to consume the full core workflow port through its diagnostics-specific runtime port.

Planned closure condition:

- Channel setup UI/session/app-shell screen wiring no longer imports or exposes core `ChannelSetupWorkflowPort`.
- The UI-facing workflow contract does not include `getSetupPlanDiagnostics`.
- Runtime behavior remains unchanged because `AppOrchestrator.getChannelSetupWorkflowPort()` structurally satisfies the narrower UI-facing contract.
- Remaining direct imports of core channel setup DTOs/constants in UI are either still required data-contract imports or removed opportunistically only inside the same seam; they are documented as accepted residual if retained.

## Files In Scope

- `src/modules/ui/channel-setup/ChannelSetupScreenPorts.ts`
- `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
- `src/modules/ui/channel-setup/ChannelSetupSessionContracts.ts`
- `src/modules/ui/channel-setup/ChannelSetupSessionController.ts`
- `src/modules/ui/channel-setup/ChannelSetupSessionRuntime.ts`
- `src/modules/ui/channel-setup/__tests__/channel-setup-test-helpers.ts`
- `src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts`
- `src/modules/ui/channel-setup/__tests__/ChannelSetupSessionRuntime.test.ts`
- `src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.contracts.test.ts`
- `src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts`
- `src/core/app-shell/AppShellRuntimeContracts.ts`
- `src/core/app-shell/AppLazyScreenPortFactory.ts`
- `src/core/app-shell/__tests__/AppShellRuntimeContracts.test.ts`
- `src/core/app-shell/__tests__/AppLazyScreenPortFactory.test.ts`
- `docs/architecture/CURRENT_STATE.md` after implementation, only if source ownership changes need current-state documentation
- `docs/architecture/modules.md` after implementation, only if source ownership changes need module-reference documentation
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` after implementation/review, for same-pass mini-record accounting only

Conditional, only if typecheck shows local type aliases must move with the narrowed contract:

- `src/modules/ui/channel-setup/ChannelSetupSessionState.ts`
- `src/modules/ui/channel-setup/steps/types.ts`
- `src/modules/ui/channel-setup/steps/constants.ts`
- `src/modules/ui/channel-setup/__tests__/ChannelSetupSessionState.test.ts`

## Files Out Of Scope

- `src/core/orchestrator/AppOrchestrator.ts`, except for compile proof through its existing `getChannelSetupWorkflowPort()` method.
- `src/core/channel-setup/workflow/ChannelSetupWorkflowPort.ts`, unless a type-only export is needed to keep the core full-port contract stable.
- `src/core/channel-setup/workflow/createChannelSetupWorkflowPort.ts`
- `src/core/channel-setup/ChannelSetupCoordinator.ts`
- `src/core/channel-setup/planning/**`
- `src/core/channel-setup/build/**`
- `src/core/channel-setup/persistence/**`
- `src/core/app-shell/AppDiagnosticsSurface.ts`
- `src/core/app-shell/AppDiagnosticsChannelSetupSummary.ts`
- `src/core/app-shell/__tests__/AppDiagnosticsSurface.test.ts`
- Plex, scheduler, player, navigation, server-selection, and EPG runtime behavior files not listed in scope.
- `FCP-1-SF4` runtime assembly hub files.
- Any archived/historical package maps, Desloppify data, imported issue maps, or score artifacts.

## Planner Self-Check

1. Unresolved ownership seam? No. The UI screen/session workflow contract belongs under channel setup UI; the full core workflow/diagnostics port remains under `src/core/channel-setup/workflow/`.
2. Adjacent contract changes hidden out of scope? No. `AppOrchestrator.getChannelSetupWorkflowPort()` should satisfy the narrower UI contract by structural typing. If not, stop and replan.
3. Out-of-scope files implicitly relied on? `AppOrchestrator.ts` and core workflow-port implementation are compile/test proof only, not edit targets.
4. Codanna evidence path recorded? Yes, including weak semantic/impact results and deterministic fallback reads.
5. Repo-preferred owner? Yes. The package avoids growing `AppOrchestrator`, keeps core setup logic in core, and keeps screen-facing workflow needs in UI.
6. Fresh-session ambiguity? No. The target contract, files, stop triggers, and verification commands are explicit.
7. Execution-grade? Yes for `FCP-1-SF3`. It deliberately leaves `FCP-1-SF4` for a later package.

## Architecture Seam Decision Gate

Chosen seam: define a channel setup UI-owned workflow input contract for the screen/session path, then have app-shell lazy screen wiring expose that narrower contract instead of the full core `ChannelSetupWorkflowPort`.

The implementer may choose the exact file/name, but the owner must be under `src/modules/ui/channel-setup/` and the contract must include only the methods used by the screen/session runtime:

```ts
type ChannelSetupScreenWorkflowPort = Pick<
    ChannelSetupWorkflowPort,
    | 'invalidateFacetSnapshot'
    | 'getLibrariesForSetup'
    | 'getChannelSetupRecord'
    | 'getSetupContextForSelectedServer'
    | 'getSetupPreview'
    | 'getSetupReview'
    | 'createChannelsFromSetup'
    | 'markSetupComplete'
>;
```

The implementer may avoid importing `ChannelSetupWorkflowPort` in UI by spelling the interface directly with domain DTO types. Do not include `getSetupPlanDiagnostics` in the UI-facing contract.

Preservation contracts:

- `ChannelSetupScreen.show()` still starts the same load flow, registers the same nav listener, and renders the same first step after library load.
- `hide()`/`destroy()` still release nav listeners, dropdowns, focusables, abort controllers, timers, and transient setup state.
- Preview debounce, slow timeout, review loading, abort handling, and build cancellation remain behaviorally identical.
- Existing DOM IDs, `data-action` hooks, ARIA/status behavior, and remote focus behavior remain unchanged.
- App-shell diagnostics can still call `getSetupPlanDiagnostics(...)` through diagnostics-owned runtime paths.
- `AppOrchestrator.getChannelSetupWorkflowPort()` remains the full core port and is not narrowed for core/diagnostics callers.

Stop and replan if:

- TypeScript cannot assign the full core workflow port to the narrower UI contract without changing `AppOrchestrator` or core workflow behavior.
- The implementation needs to edit core planning/build/persistence behavior, diagnostics behavior, `AppDiagnosticsSurface`, `AppOrchestrator`, Plex, scheduler, player, or navigation runtime files.
- Removing core workflow-port imports from UI requires replacing domain DTOs with broad `unknown`, `any`, compatibility wrappers, or duplicate DTO definitions.
- The package starts trying to remove all channel setup domain DTO imports from UI instead of the approved workflow-port handoff.
- Targeted tests reveal a behavior regression in focus/listener/timer/preview/build flows.
- Source review shows that retained direct core DTO/constants imports are not data contracts but workflow-policy leakage.

## Package Decomposition

- `package_id`: `fcp-1-channel-setup-ui-core-handoff`
- `checklist_token`: `FCP-1`
- `source_finding_ids`:
  - `FCP-1-SF3`
- `slice_table`:

### `FCP-1-S2` Channel Setup Screen Workflow Port Narrowing

- `goal`: replace the full core workflow-port handoff used by channel setup UI/app-shell screen wiring with a UI-owned screen/session workflow contract and record accepted residual domain DTO imports.
- `areas/files`: `src/modules/ui/channel-setup/ChannelSetupScreenPorts.ts`, `src/modules/ui/channel-setup/ChannelSetupScreen.ts`, `src/modules/ui/channel-setup/ChannelSetupSessionContracts.ts`, `src/modules/ui/channel-setup/ChannelSetupSessionController.ts`, `src/modules/ui/channel-setup/ChannelSetupSessionRuntime.ts`, `src/modules/ui/channel-setup/__tests__/channel-setup-test-helpers.ts`, targeted channel setup UI tests, `src/core/app-shell/AppShellRuntimeContracts.ts`, `src/core/app-shell/AppLazyScreenPortFactory.ts`, targeted app-shell tests, architecture docs/checklist only after implementation if ownership/accounting changed.
- `source_finding_ids`:
  - `FCP-1-SF3`
- `verification`: source audits for workflow-port removal and diagnostics omission, targeted app-shell and channel setup tests, `npm run verify`, and `npm run verify:docs` if docs/checklist are updated.
- `dependencies`: `FCP-1-S1` completed by commit `75b59c4f`; no dependency on `FCP-1-SF4`.
- `stop_condition`: stop if implementation needs core workflow behavior changes, diagnostics changes, AppOrchestrator edits, broad DTO duplication, or any focus/timer/build behavior change.
- `handoff_condition`: UI-facing workflow contract is narrowed, tests/source audits pass, accepted residual imports are documented, and checklist/audit accounting is updated after clean implementation review.
- `serial_only`: true
- `parallel_justification`: single cross-module contract seam. Splitting app-shell contract, UI session typing, and tests would create dependent partial states.
- `coverage_check`:
  - `FCP-1-SF3`: `FCP-1-S2`; final owner: channel setup UI/core boundary owner; closure check: channel setup UI/app-shell screen wiring no longer imports or exposes full core `ChannelSetupWorkflowPort`, the UI-facing contract omits diagnostics, behavior tests pass, and retained core DTO/constants imports are recorded as accepted data-contract residue.
- `ready_now_slice`: `FCP-1-S2`
- `ready_now_execution_unit`: `FCP-1-S2`
- `recommended_slice_order`:
  1. `FCP-1-S2`
- `parallel_execution_policy`: Parallel execution is unavailable. This plan authorizes only `FCP-1-S2`; `FCP-1-SF4` remains outside the execution unit and must not be implemented in parallel from this plan.

## Verification Commands

- Primary verification mode: `contract-first`
- Verification classification: `new regression/contract test required`

Required source audits after implementation:

- Run: `rg -n "ChannelSetupWorkflowPort|getSetupPlanDiagnostics" src/modules/ui/channel-setup src/core/app-shell/AppLazyScreenPortFactory.ts`
- Expected: no matches. Channel setup UI and lazy screen construction must not import or expose the full core workflow port or diagnostics method.

- Run: `node -e "const fs=require('fs'); const s=fs.readFileSync('src/core/app-shell/AppShellRuntimeContracts.ts','utf8'); const m=s.match(/export interface AppShellChannelSetupRuntimePort \\{[\\s\\S]*?\\n\\}/); if (!m) process.exit(2); if (/ChannelSetupWorkflowPort|getSetupPlanDiagnostics/.test(m[0])) { console.error(m[0]); process.exit(1); }"`
- Expected: exit 0 with no output. The app-shell channel setup screen runtime port must not expose the full core workflow port or diagnostics method.

- Run: `rg -n "../../../core/channel-setup|../../../../core/channel-setup|../channel-setup" src/modules/ui/channel-setup src/core/app-shell/AppShellRuntimeContracts.ts src/core/app-shell/AppLazyScreenPortFactory.ts`
- Expected: any remaining matches are limited to core domain DTO/constants imports that the implementation output explicitly classifies as accepted data-contract residue, or to diagnostics-specific app-shell contracts outside `AppShellChannelSetupRuntimePort`. No UI/screen path may import `core/channel-setup/workflow/ChannelSetupWorkflowPort`.

Required targeted tests:

- Run: `npm run test:unit -- src/core/app-shell/__tests__/AppShellRuntimeContracts.test.ts src/core/app-shell/__tests__/AppLazyScreenPortFactory.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupSessionRuntime.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupSessionState.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.contracts.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts --runInBand`
- Expected: all named suites pass. At least one boundary test must assert that the UI/app-shell channel setup screen handoff does not expose `ChannelSetupWorkflowPort` or `getSetupPlanDiagnostics`.

Required full runtime gate:

- Run: `npm run verify`
- Expected: pass, because this is UI/app-shell runtime source work.

Required docs/control-plane gate if docs, checklist, or tracked plan artifacts are updated:

- Run: `npm run verify:docs`
- Expected: pass.

Why this proof depth matches risk: this is a cross-module contract cleanup with behavior intended to stay invariant. A new boundary assertion prevents the broad workflow port from returning, targeted channel setup tests protect focus/session/preview/build behavior, and `npm run verify` catches broader TypeScript/runtime regressions.

## Rollback Notes

Rollback the app-shell contract/factory edits, channel setup UI type edits, and test updates together. Do not leave docs claiming a narrowed channel setup UI workflow contract unless the source and boundary tests landed in the same implementation pass.

If an implementer edits `AppOrchestrator`, core planning/build/persistence, or diagnostics behavior to make the narrowing compile, revert those edits first and replan; this package does not authorize them.

## Commit Checkpoints

1. `refactor(fcp-1): narrow channel setup UI workflow handoff`
   - app-shell channel setup screen port, UI workflow contract, and targeted tests.
2. `docs(fcp-1): record channel setup handoff disposition`
   - architecture docs if ownership changed, audit/checklist proof matrix after clean implementation review.

If the implementation batch is small, the controller may combine these only after runtime and docs verification pass. Active tracked plan docs should stay out of delegated implementation commits unless the controller explicitly owns a separate docs checkpoint.

## Implementation Closeout

Closed execution unit: `FCP-1-S2`

Closed source finding:

| source_finding_id | disposition | proof |
| --- | --- | --- |
| `FCP-1-SF3` | Resolved for the approved workflow-port handoff scope. | Commits `23effad7` and `2326562f` move the channel setup screen/session path to `ChannelSetupScreenWorkflowPort`, keep `getSetupPlanDiagnostics` out of the UI-facing runtime port, and project the full core workflow port into a diagnostics-free screen object before lazy screen construction. |

Runtime closure evidence:

- `src/modules/ui/channel-setup/ChannelSetupScreenPorts.ts` owns the screen workflow contract and does not include `getSetupPlanDiagnostics`.
- `src/core/app-shell/AppShellRuntimeContracts.ts` exposes `getChannelSetupScreenWorkflowPort(): ChannelSetupScreenWorkflowPort` for `AppShellChannelSetupRuntimePort` while keeping the full `getChannelSetupWorkflowPort(): ChannelSetupWorkflowPort` on `AppShellDiagnosticsRuntimePort`.
- `src/core/app-shell/AppLazyScreenPortFactory.ts` calls only `runtime.getChannelSetupScreenWorkflowPort()` for screen construction.
- `src/App.ts` projects the full core workflow port into a new screen-only object before passing it to lazy screen wiring; the screen no longer receives the full core workflow object by reference.
- `src/__tests__/App.test.ts` asserts the projected workflow object is distinct from the full workflow port and does not expose `getSetupPlanDiagnostics`.

Accepted residuals:

- `src/modules/ui/channel-setup/ChannelSetupSessionState.ts` still imports `normalizeChannelSetupConfig` from `src/core/channel-setup/planning/normalizeChannelSetupConfig.ts`. This is a live planning-policy import, not DTO/constants residue. It is accepted only as an owned residual for this package because `FCP-1-S2` targeted the workflow-port handoff, not session-state policy normalization. Final owner: channel setup UI/core boundary owner. Revisit trigger: before any `FCP-1` closeout claim, or earlier if a later channel setup package changes setup record hydration/normalization ownership.
- Remaining `src/modules/ui/channel-setup/**` imports from `src/core/channel-setup/types.ts` and `src/core/channel-setup/constants.ts` are accepted data-contract residue for this package. Revisit trigger: if UI starts importing core planning/build/persistence behavior beyond the named `normalizeChannelSetupConfig` residual.

Verification evidence:

- Source audit: `if rg -n "ChannelSetupWorkflowPort|getSetupPlanDiagnostics" src/modules/ui/channel-setup src/core/app-shell/AppLazyScreenPortFactory.ts; then exit 1; else test $? -eq 1; fi` passed with no matches.
- Runtime contract audit: `node -e "const fs=require('fs'); const s=fs.readFileSync('src/core/app-shell/AppShellRuntimeContracts.ts','utf8'); const m=s.match(/export interface AppShellChannelSetupRuntimePort \\{[\\s\\S]*?\\n\\}/); if (!m) process.exit(2); if (/ChannelSetupWorkflowPort|getSetupPlanDiagnostics/.test(m[0])) { console.error(m[0]); process.exit(1); }"` passed with no output.
- Residual import audit: `rg -n "normalizeChannelSetupConfig|core/channel-setup|ChannelSetupWorkflowPort|getSetupPlanDiagnostics" src/modules/ui/channel-setup src/core/app-shell/AppShellRuntimeContracts.ts src/core/app-shell/AppLazyScreenPortFactory.ts` identified the accepted DTO/constants imports, the owned `normalizeChannelSetupConfig` residual, and diagnostics-only full workflow exposure in `AppShellDiagnosticsRuntimePort`.
- Targeted tests: `npx jest --config jest.config.js --runTestsByPath src/__tests__/App.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupSessionController.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupSessionRuntime.test.ts src/core/app-shell/__tests__/AppLazyScreenRegistry.test.ts src/core/app-shell/__tests__/AppLazyScreenPortFactory.test.ts src/core/app-shell/__tests__/AppShellRuntimeContracts.test.ts --runInBand` passed, 7 suites / 166 tests.
- Contract test: `npx jest --config jest.contracts.config.js --runTestsByPath src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.contracts.test.ts --runInBand` passed, 1 suite / 4 tests.
- Verifier policy test for the user-requested reasoning-effort verifier change: `npx jest --config jest.tools.config.js --runInBand src/__tests__/tools/verifyDocs.test.ts -t "allows maintainers to tune" --verbose` passed, 2 tests.
- Full gate: `npm run verify` passed after the corrected implementation. An earlier full run reported a shell segmentation fault immediately after contract suites printed pass; direct `npm run test:contracts` passed, and the subsequent full `npm run verify` passed end to end.
- Docs/control-plane gate: `npm run verify:docs` passed after this plan, the master audit, and the checklist mini-record were updated for `FCP-1-S2` closeout.

Review evidence:

- First fresh adversarial implementation review found that the provider was explicit but still returned the full workflow object and that app-level coverage did not prove runtime projection.
- The controller addressed both findings in commit `2326562f`.
- Second fresh adversarial re-review returned no findings and confirmed the runtime projection, diagnostics full-port path, verifier policy scope, and accepted residual handling.

Priority status:

- `FCP-1-SF3` is resolved for this package.
- `FCP-1-SF4` remains deferred to a future source-backed package or explicit no-action acceptance.
- `FCP-1` remains in progress and must not be marked complete from this plan alone.

## Current-Unit Execution Packet

execution_unit: `FCP-1-S2`

files_in_scope: `src/modules/ui/channel-setup/ChannelSetupScreenPorts.ts`, `src/modules/ui/channel-setup/ChannelSetupScreen.ts`, `src/modules/ui/channel-setup/ChannelSetupSessionContracts.ts`, `src/modules/ui/channel-setup/ChannelSetupSessionController.ts`, `src/modules/ui/channel-setup/ChannelSetupSessionRuntime.ts`, `src/modules/ui/channel-setup/__tests__/channel-setup-test-helpers.ts`, targeted channel setup UI tests, `src/core/app-shell/AppShellRuntimeContracts.ts`, `src/core/app-shell/AppLazyScreenPortFactory.ts`, targeted app-shell tests

files_out_of_scope: `src/core/orchestrator/AppOrchestrator.ts`, `src/core/channel-setup/planning/**`, `src/core/channel-setup/build/**`, `src/core/channel-setup/persistence/**`, `src/core/app-shell/AppDiagnosticsSurface.ts`, Plex/scheduler/player/navigation behavior files, `FCP-1-SF4`

constraints:

- Keep runtime behavior invariant.
- Keep the full core workflow/diagnostics port available to core and diagnostics callers.
- Keep the UI-facing workflow contract narrow and diagnostics-free.
- Do not add compatibility aliases, broad root barrels, `any` DTO shims, or duplicate domain DTOs.
- Document retained core DTO/constants imports as accepted data-contract residue in implementation output and closeout accounting.

verification:

- Run the source audits in `## Verification Commands`.
- Run the targeted test command.
- Run `npm run verify`.
- Run `npm run verify:docs` after docs/checklist updates.

stop_and_replan_if:

- Any AppOrchestrator or core channel-setup behavior change appears necessary.
- The UI-facing contract cannot exclude `getSetupPlanDiagnostics`.
- The work expands into removing all domain DTO imports from channel setup UI.
- Focus/listener/timer/preview/build behavior changes are required.
- `FCP-1-SF4` runtime assembly scope becomes necessary to complete this package.
