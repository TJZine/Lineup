# S9-W1 Inline Style / Bootstrap Cleanup Plan

> Tier 2 tracked plan for `STYLE_CLEANUP_CHECKLIST.md` item `S9-W1` / `pkg_inline_style_bootstrap_cleanup`. The package stays checklist-linked and executes as one bounded slice because both exact issues share the same onboarding screen-shell seam.

**Plan Status:** active
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked
**Tier:** Tier 2

## Goal

- Retire `STYLE_CLEANUP_CHECKLIST.md` item `S9-W1` / `pkg_inline_style_bootstrap_cleanup` without widening into runtime overlay, app-shell bootstrap, or geometry-driven inline-style cleanup.
- Make the onboarding shell contract authoritative for onboarding screen container bootstrap so Auth, Profile Select, Server Select, and Channel Setup stop re-declaring `.screen` layout/bootstrap styles inline.
- Move the remaining package-owned non-geometric inline visual-state mutation in `AuthScreen` from direct style writes to a class/state toggle while preserving current focus, status, and countdown behavior.

## Non-Goals

- Do not reopen `bootstrap.ts`, `AppContainerFactory.ts`, runtime overlay inline styles, or any cross-layer app-shell container work.
- Do not widen into `EPG` virtualization, player/runtime geometry, or other accepted geometry-driven inline style owners.
- Do not change onboarding flow sequencing, navigation ownership, or action-button focus policy beyond the narrow state-hook updates already needed for `AuthScreen`.
- Do not treat all `style.display` toggles as defects; screen show/hide and other accepted visibility toggles remain local unless current-source proof shows they now block the package goals.
- Do not reopen onboarding token migration from `S7-W1`; consume the existing onboarding shell/token work as a locked dependency.

## Parent Priority Alignment

- Parent checklist item:
  - `STYLE_CLEANUP_CHECKLIST.md` -> `S9-W1` / `pkg_inline_style_bootstrap_cleanup`
- Companion-map dependency truth:
  - `pkg_inline_style_bootstrap_cleanup` depends on `pkg_onboarding_token_cleanup`
- Routing invariant to preserve:
  - this package is onboarding-shell/bootstrap cleanup, not runtime parity/token work and not app-shell bootstrap work
- Current execution truth at plan time:
  - `S8-EXIT` is complete
  - `S9-W1` is the next and only remaining `S#-W#` work item
  - `S9-W1` is the final planned work item before `S9-EXIT`, so this plan must leave `S9-EXIT` with a single closeout surface and no hidden successor package

## Required Reading

1. `agents.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/cleanup-plan.md`
4. `docs/agentic/plan-authoring-standard.md`
5. `STYLE_CLEANUP_CHECKLIST.md`
6. `docs/design/active-style-cleanup-package-map.json`
7. `docs/architecture/CURRENT_STATE.md`
8. `docs/design/ui-design-language.md`
9. `STYLE_AUDIT.md` section `11. Inline Style Hygiene (TypeScript)`
10. `src/styles/shell.onboarding.shared-shell.css`
11. `src/styles/shell.onboarding.auth.css`
12. `src/modules/ui/auth/AuthScreen.ts`
13. `src/modules/ui/profile-select/ProfileSelectScreen.ts`
14. `src/modules/ui/server-select/ServerSelectScreen.ts`
15. `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
16. `src/modules/ui/audio-setup/AudioSetupScreen.ts`
17. `src/modules/ui/auth/__tests__/AuthScreen.test.ts`
18. `src/modules/ui/profile-select/__tests__/ProfileSelectScreen.test.ts`
19. `src/modules/ui/server-select/__tests__/ServerSelectScreen.test.ts`
20. `src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts`

Freshness gate:

- If `STYLE_CLEANUP_CHECKLIST.md`, `docs/design/active-style-cleanup-package-map.json`, `STYLE_AUDIT.md`, or onboarding shell CSS changes materially before implementation, refresh this plan first.
- If current-source proof shows the bootstrap duplication can only be retired by changing app-shell container creation, `bootstrap.ts`, or other non-onboarding roots, stop and replan instead of widening this package implicitly.
- If current-source proof finds additional package-owned non-geometric visual-state mutations outside the approved onboarding file seam, stop and assign one final owner before implementation continues.

## Required Skills

1. `using-superpowers`
2. `ui-composition-patterns`
3. `verification-strategy`
4. `execution-plan-authoring`
5. `architecture-boundaries` only if implementation unexpectedly needs to move bootstrap ownership out of the onboarding screen-shell seam

## Codanna Discovery

- `semantic_search_with_context`
  - unavailable in this session
  - planning implication: discovery used direct tracked-doc reads plus `rg` fallback
- `search_documents`
  - unavailable in this session
  - planning implication: repo-doc context came from direct reads of `STYLE_CLEANUP_CHECKLIST.md`, `docs/design/active-style-cleanup-package-map.json`, `docs/architecture/CURRENT_STATE.md`, `docs/design/ui-design-language.md`, and `STYLE_AUDIT.md`
- `analyze_impact`
  - not required for the current risk level
  - reason: the approved seam stays inside onboarding UI owners and their existing tests; no shared public runtime symbol or cross-module wiring move is planned
- Explicit fallback reads and `rg` audits used because Codanna tooling was unavailable:
  - `rg -n "S9-W1|S9-EXIT|pkg_inline_style_bootstrap_cleanup" STYLE_CLEANUP_CHECKLIST.md docs/design/active-style-cleanup-package-map.json`
  - `rg -n "Inline Style Hygiene|onboarding shell bootstrap|non-geometric inline state" STYLE_AUDIT.md`
  - `rg -n "style\\.position = 'absolute'|style\\.inset = '0'|style\\.alignItems = 'center'|style\\.justifyContent = 'center'" src/modules/ui/auth/AuthScreen.ts src/modules/ui/profile-select/ProfileSelectScreen.ts src/modules/ui/server-select/ServerSelectScreen.ts src/modules/ui/channel-setup/ChannelSetupScreen.ts`
  - `rg -n "style\\.color =|style\\.display = 'none'|style\\.display = 'flex'|style\\.display = 'inline-flex'" src/modules/ui/auth/AuthScreen.ts src/modules/ui/profile-select/ProfileSelectScreen.ts src/modules/ui/server-select/ServerSelectScreen.ts src/modules/ui/channel-setup/ChannelSetupScreen.ts`
  - direct reads of the files listed in `## Required Reading`

## Impact Snapshot

- The duplicated onboarding bootstrap lives in four onboarding screen constructors:
  - `src/modules/ui/auth/AuthScreen.ts`
  - `src/modules/ui/profile-select/ProfileSelectScreen.ts`
  - `src/modules/ui/server-select/ServerSelectScreen.ts`
  - `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
- The shared owner already exists in CSS:
  - `src/styles/shell.onboarding.shared-shell.css` `.screen` owns absolute fill, hidden-by-default display, centering, onboarding background, and shared shell baseline
  - `src/modules/ui/audio-setup/AudioSetupScreen.ts` already relies on that class-based bootstrap and serves as the current-package proof that no second inline bootstrap owner is needed
- The remaining clearly package-owned non-geometric inline visual-state mutation is in `AuthScreen`:
  - `this._detailEl.style.color = remainingMs <= 120000 ? 'var(--color-warning)' : ''`
  - reset writes in request/cancel/expired flows also clear that inline color directly
- Current proof gaps that implementation must close:
  - the current verification surface does not distinguish constructor-level `this._container.style.display = 'none'` bootstrap from the accepted `show()` / `hide()` lifecycle toggles
  - the current `AuthScreen` tests prove countdown text and expired/cancel flows, but they do not yet prove warning-class application at the threshold or class reset across request, cancel, and expire transitions
- Preservation contracts:
  - keep onboarding theme-immune and bounded to the onboarding shell classes; do not move onboarding styling into runtime theme surfaces
  - keep `show()` / `hide()` visibility lifecycle behavior intact for all four screens
  - keep existing `ScreenShell` DOM hooks (`.screen-panel`, `.screen-status`, `.screen-detail`, action ids) intact so current tests remain valid
  - keep `AuthScreen` focus registration behavior intact when retry visibility changes
  - accept geometry/visibility inline writes that remain intentionally local to lifecycle and focus behavior; this package is not a blanket ban on inline style usage
- Locked implementation decisions:
  - the onboarding shell CSS `.screen` contract is the single owner for the duplicated bootstrap properties; implementation removes the redundant constructor writes instead of creating another competing bootstrap layer
  - no new helper file is required unless implementation proves the four screens still need an additional shared TypeScript seam after the inline bootstrap writes are removed
  - `AuthScreen` urgency styling moves to a class/state toggle on the existing shell-owned detail element; the visual rule lives in onboarding shell CSS, not in inline `style.color`
  - QR wrapper, retry-button, main-action, and screen show/hide visibility toggles stay out of scope unless a same-file change is required to preserve focus or DOM correctness while landing the package-owned state hook

## Files In Scope

- `docs/plans/2026-04-19-s9-inline-style-bootstrap-cleanup.md`
- `STYLE_CLEANUP_CHECKLIST.md` for same-pass plan linkage and package-status truth
- `src/styles/shell.onboarding.shared-shell.css`
- `src/modules/ui/auth/AuthScreen.ts`
- `src/modules/ui/profile-select/ProfileSelectScreen.ts`
- `src/modules/ui/server-select/ServerSelectScreen.ts`
- `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
- `src/modules/ui/auth/__tests__/AuthScreen.test.ts` only if a focused assertion must move from inline-style state to class/state proof
- `src/modules/ui/profile-select/__tests__/ProfileSelectScreen.test.ts` only if a focused assertion must follow the container-bootstrap cleanup
- `src/modules/ui/server-select/__tests__/ServerSelectScreen.test.ts` only if a focused assertion must follow the container-bootstrap cleanup
- `src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts` only if a focused assertion must follow the container-bootstrap cleanup

## Files Out Of Scope

- `docs/design/active-style-cleanup-package-map.json`
- `STYLE_AUDIT.md`
- `docs/design/ui-design-language.md`
- `src/styles/tokens.css`
- `src/styles/themes.css`
- `src/bootstrap.ts`
- `src/core/app-shell/AppContainerFactory.ts`
- `src/App.ts`
- `src/modules/ui/audio-setup/AudioSetupScreen.ts`
- `src/styles/shell.onboarding.auth.css` unless the auth urgency class cannot land cleanly in shared onboarding shell CSS
- `src/modules/ui/epg/**`
- `src/modules/player/**`
- runtime overlay packages (`channel-badge`, `channel-transition`, `channel-number-overlay`, `mini-guide`, `player-osd`, `now-playing-info`, `playback-options`, `exit-confirm`, `settings`)
- any new helper or utility outside the existing onboarding screen/shell seam unless the architecture gate below is reopened explicitly

## Planner Self-Check

1. Is there any unresolved architecture seam, ownership seam, or collaborator boundary hidden inside the task?
   - No. The package stays inside onboarding screen owners plus the shared onboarding shell CSS contract they already consume.
2. Does the plan depend on adjacent files needing contract or type changes that are not in scope?
   - No. Existing shell classes and onboarding screen tests are sufficient; app-shell/bootstrap roots stay frozen.
3. Am I declaring any file out of scope that implementation will still implicitly rely on?
   - No. `AudioSetupScreen.ts` is reference-only evidence, not an implementation dependency.
4. Did I record the full Codanna evidence path plus explicit fallback reads?
   - Yes. Codanna was unavailable, and the direct-read/`rg` fallback is explicit.
5. Am I assigning the work to the repo-preferred owner, or quietly growing a hotspot?
   - Yes. Ownership stays with onboarding screen modules and `shell.onboarding.shared-shell.css`.
6. Would a fresh session have to invent anything important to finish this safely?
   - No. The seam, non-goals, allowed residual inline-style cases, and verification envelope are explicit.
7. Is this truly an execution-grade plan, or do I still need to resolve a design decision first?
   - Execution-grade. The shared bootstrap owner and the auth urgency-state owner are both resolved here.

## Architecture Seam Decision Gate

- **Seam 1: onboarding container bootstrap ownership**
  - chosen owner: `src/styles/shell.onboarding.shared-shell.css` `.screen`
  - rule:
    - remove the duplicated constructor-level `position`, `inset`, default `display`, `alignItems`, and `justifyContent` writes from `AuthScreen`, `ProfileSelectScreen`, `ServerSelectScreen`, and `ChannelSetupScreen`
    - keep those screens responsible only for attaching their screen class(es) and runtime visibility lifecycle
    - do not add a second bootstrap owner in `bootstrap.ts`, app-shell code, or a new cross-module helper unless the stop conditions below fire
- **Seam 2: auth urgency visual-state ownership**
  - chosen owner: `src/styles/shell.onboarding.shared-shell.css` for styling plus `src/modules/ui/auth/AuthScreen.ts` for class/state toggling
  - rule:
    - replace direct detail-color writes with a class/state toggle on the shell-owned detail element
    - keep the warning condition (`remainingMs <= 120000`) intact
    - keep status/detail text content behavior intact
- **Explicitly accepted residue**
  - `style.display` writes that own screen `show()` / `hide()` lifecycle or existing focus-neighbor behavior remain acceptable inside this package
  - geometry-driven inline styles remain out of scope
- **Stop-and-replan conditions**
  - removing the duplicated bootstrap writes breaks onboarding layout because the current `.screen` contract is insufficient
  - implementation needs app-shell/bootstrap/container-factory changes to keep onboarding screens positioned correctly
  - the auth urgency state cannot be expressed cleanly through the existing shell/detail class seam
  - current-source proof finds another live non-geometric inline visual-state mutation in the approved package seam that needs a different final owner

## Verification Commands

- Verification classification: `new regression/contract test required`
- Why this depth matches the risk:
  - this package is structural cleanup inside onboarding UI owners, but the current proof surface is missing two exact contracts the review handoff called out
  - constructor-level `display` bootstrap removal must be proven separately from accepted lifecycle `show()` / `hide()` display toggles
  - `AuthScreen` warning-state ownership changes from inline style to class/state logic, so focused regression coverage is justified for application and reset behavior
- Plan/doc verification for this tracked artifact:
  - Run: `npm run plans:check`
  - Expected: `Serious active plan conformance passed.`
  - Run: `npm run verify:docs`
  - Expected: `Documentation verification passed.`
- Execution-unit verification:
  - `P9-W1-S1`
    - Run: `rg -n "style\\.position = 'absolute'|style\\.inset = '0'|style\\.alignItems = 'center'|style\\.justifyContent = 'center'" src/modules/ui/auth/AuthScreen.ts src/modules/ui/profile-select/ProfileSelectScreen.ts src/modules/ui/server-select/ServerSelectScreen.ts src/modules/ui/channel-setup/ChannelSetupScreen.ts`
    - Expected: `no matches`
    - Run: `rg -n "style\\.display = 'none'|show\\(\\): void|hide\\(\\): void|style\\.display = 'flex'" src/modules/ui/auth/AuthScreen.ts src/modules/ui/profile-select/ProfileSelectScreen.ts src/modules/ui/server-select/ServerSelectScreen.ts src/modules/ui/channel-setup/ChannelSetupScreen.ts`
    - Expected: constructor bootstrap display writes are absent while accepted lifecycle `show()` / `hide()` display toggles remain
    - Run: `rg -n "style\\.color =" src/modules/ui/auth/AuthScreen.ts`
    - Expected: `no matches`
    - Run: `rg -n "screen-detail--warning|warning-detail|detail-warning" src/styles/shell.onboarding.shared-shell.css src/modules/ui/auth/AuthScreen.ts`
    - Expected: matches only in the shared shell CSS owner and the auth class-toggle owner
    - Run: `npm test -- --runInBand src/modules/ui/auth/__tests__/AuthScreen.test.ts`
    - Expected: passes, including constructor bootstrap reset and countdown warning-class apply/reset coverage
    - Run: `npm test -- --runInBand src/modules/ui/profile-select/__tests__/ProfileSelectScreen.test.ts src/modules/ui/server-select/__tests__/ServerSelectScreen.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts`
    - Expected: passes, including constructor bootstrap reliance on shared `.screen` plus preserved lifecycle display ownership
- Package gate after the code-bearing execution unit:
  - Run: `npm run verify`
  - Expected: passes

## Rollback Notes

- Revert the four onboarding screen constructor changes together if removing the duplicated bootstrap writes reveals any missed dependency on inline positioning/centering.
- Revert the auth urgency class-toggle change separately if the countdown detail loses the intended warning emphasis, but do not reintroduce a second bootstrap owner while doing so.
- Do not leave a half-completed state where some onboarding screens rely on shared `.screen` bootstrap and others keep the duplicated inline bootstrap without source-audit evidence explaining why.

## Commit Checkpoints

- Checkpoint 1: `S9-W1-S1` implementation checkpoint for the four onboarding screens, shared onboarding shell CSS, and any focused test updates
- Checkpoint 2: `S9-W1` / `S9-EXIT` checklist and plan-status updates in a separate docs checkpoint
- Keep this active plan out of the implementation checkpoint; archive or deactivate it only after the package and `S9-EXIT` close

## Package Decomposition

- `package_id`: `pkg_inline_style_bootstrap_cleanup`
- `checklist_token`: `S9-W1`
- `package_issue_ids`:
  - `style_audit::inline_styles::onboarding_container_bootstrap_duplication`
  - `style_audit::inline_styles::non_geometric_visual_state_should_use_classes`
- `slice_table`:

### `P9-W1-S1` Inline Style / Bootstrap Cleanup Slice

- `goal`: remove duplicated onboarding screen bootstrap inline styles and move the remaining auth urgency visual state to class/state toggles without widening beyond the approved onboarding seam
- `areas/files`:
  - `src/styles/shell.onboarding.shared-shell.css`
  - `src/modules/ui/auth/AuthScreen.ts`
  - `src/modules/ui/profile-select/ProfileSelectScreen.ts`
  - `src/modules/ui/server-select/ServerSelectScreen.ts`
  - `src/modules/ui/channel-setup/ChannelSetupScreen.ts`
  - `src/modules/ui/auth/__tests__/AuthScreen.test.ts`
  - `src/modules/ui/profile-select/__tests__/ProfileSelectScreen.test.ts`
  - `src/modules/ui/server-select/__tests__/ServerSelectScreen.test.ts`
  - `src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts`
- `exact_issue_ids`:
  - `style_audit::inline_styles::onboarding_container_bootstrap_duplication`
  - `style_audit::inline_styles::non_geometric_visual_state_should_use_classes`
- `verification`:
  - `rg -n "style\\.position = 'absolute'|style\\.inset = '0'|style\\.alignItems = 'center'|style\\.justifyContent = 'center'" src/modules/ui/auth/AuthScreen.ts src/modules/ui/profile-select/ProfileSelectScreen.ts src/modules/ui/server-select/ServerSelectScreen.ts src/modules/ui/channel-setup/ChannelSetupScreen.ts`
  - `rg -n "style\\.display = 'none'|show\\(\\): void|hide\\(\\): void|style\\.display = 'flex'" src/modules/ui/auth/AuthScreen.ts src/modules/ui/profile-select/ProfileSelectScreen.ts src/modules/ui/server-select/ServerSelectScreen.ts src/modules/ui/channel-setup/ChannelSetupScreen.ts`
  - `rg -n "style\\.color =" src/modules/ui/auth/AuthScreen.ts`
  - `rg -n "screen-detail--warning|warning-detail|detail-warning" src/styles/shell.onboarding.shared-shell.css src/modules/ui/auth/AuthScreen.ts`
  - `npm test -- --runInBand src/modules/ui/auth/__tests__/AuthScreen.test.ts`
  - `npm test -- --runInBand src/modules/ui/profile-select/__tests__/ProfileSelectScreen.test.ts src/modules/ui/server-select/__tests__/ServerSelectScreen.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts`
  - `npm run verify`
  - `npm run plans:check`
  - `npm run verify:docs`
- `dependencies`: `S8-EXIT` complete
- `stop_condition`: app-shell/bootstrap ownership needs to move, shared `.screen` bootstrap proves insufficient, or new live package-owned inline visual-state residue appears outside this seam
- `handoff_condition`: the four screen constructors no longer re-declare the shared `.screen` bootstrap contract, accepted lifecycle display toggles remain, auth warning styling is class/state-driven with reset proof, and the package is ready for `lineup-cleanup-review`
- `serial_only`: true
- `parallel_justification`: both issue ids share one onboarding shell owner and one combined verification surface
- `coverage_check`:
  - `style_audit::inline_styles::onboarding_container_bootstrap_duplication` -> `P9-W1-S1`
  - `style_audit::inline_styles::non_geometric_visual_state_should_use_classes` -> `P9-W1-S1`
- `recommended_slice_order`:
  1. `P9-W1-S1`
- `ready_now_slice`: `P9-W1-S1`
- `ready_now_execution_unit`: `P9-W1-S1`
- `parallel_execution_policy`: serial

## Execution Notes

- `2026-04-19` implementation status:
  - `S9-W1-S1` is implemented on `code-health` and pending `lineup-cleanup-review`
  - constructor bootstrap writes were removed from `AuthScreen`, `ProfileSelectScreen`, `ServerSelectScreen`, and `ChannelSetupScreen`
  - accepted `show()` / `hide()` display toggles remain the local lifecycle owner for those four screens
  - `AuthScreen` countdown urgency now uses the shared-shell `screen-detail--warning` class toggle with focused apply/reset regression coverage
- execution proof captured in this session:
  - targeted `rg` source audits for constructor bootstrap removal, lifecycle display retention, and `AuthScreen` warning-class ownership
  - `npm test -- --runInBand src/modules/ui/auth/__tests__/AuthScreen.test.ts`
  - `npm test -- --runInBand src/modules/ui/profile-select/__tests__/ProfileSelectScreen.test.ts src/modules/ui/server-select/__tests__/ServerSelectScreen.test.ts src/modules/ui/channel-setup/__tests__/ChannelSetupScreen.test.ts`
  - `npm run verify`
  - `npm run plans:check`
  - `npm run verify:docs`

## Priority-Exit Readiness

- This is the final planned `S#-W#` work item before `S9-EXIT`, so no style-cleanup closeout or successor package planning may begin until `S9-EXIT` is completed with the reruns and checklist evidence below.
- Validator-compatibility note: the checklist token for this style package remains `S9-W1`, while the package-decomposition slice id uses the repo validator’s current `P#-W#-S#` pattern (`P9-W1-S1`) for conformance only.

### Imported issue dispositions by exact id

- `style_audit::inline_styles::onboarding_container_bootstrap_duplication`
  - expected disposition: resolved
  - closeout proof: the four approved onboarding screen constructors are source-audit clean for the duplicated bootstrap writes, with no successor owner required
- `style_audit::inline_styles::non_geometric_visual_state_should_use_classes`
  - expected disposition: resolved
  - closeout proof: `AuthScreen` no longer uses direct inline color writes for countdown urgency, and no new successor owner is required inside the approved onboarding seam

### Security gate

- expected outcome: `no open P0 security findings`
- if security output still shows open issues, record the exact issue ids and their current owner before allowing `S9-EXIT` to close style cleanup

### Next-priority gate

- no `P10` plan or implementation starts while `P9-EXIT` is unresolved
- style-program equivalent: no `S9-EXIT` closeout claim or style-cleanup program closeout starts while the `S9-W1` verification and checklist evidence remain unresolved
