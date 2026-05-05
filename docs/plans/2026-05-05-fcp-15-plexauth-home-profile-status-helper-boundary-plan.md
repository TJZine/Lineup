**Plan Status:** completed
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

# FCP-15 PlexAuth Home, Profile, And Status Helper Boundary Plan

## Goal

Retire exactly `ARCHITECTURE_CLEANUP_CHECKLIST.md` item `FCP-15` by closing `FCP-15-SF1`: `PlexAuth` still mixes Plex Home endpoint fallback, profile switching, status classification, and credential persistence.

This is an `FCP-*` source-backed cleanup package. Coverage is defined only by checklist `source_finding_id` value `FCP-15-SF1`; do not use Desloppify, detector ids, imported review ids, package-map ids, stale hotspot docs, line count, score output, fresh post-FCP verification, or retrospective subjective review as intake, proof, or closeout.

Completion means the original `FCP-15-SF1` sentence is answered against current source: Home endpoint fallback, Home status classification, and profile-switch request coordination either move into a focused auth-local helper/client boundary or are source-justified as acceptable in `PlexAuth`; credential state, credential epoch, storage key/persistence behavior, token validation, PIN flow, fallback order, error taxonomy, and auth/profile event emission remain stable.

## Non-Goals

- Do not implement production or test code from this planning pass.
- Do not reopen completed `FCP-7` through `FCP-14`, start `FCP-16` or later, `FCP-EXIT`, Windows port work, or broader post-FCP cleanup.
- Do not change token validation behavior, PIN request/check/poll/cancel behavior, stored credential schema, credential epoch behavior, storage keys, persistence timing, localStorage corruption handling, `authChange` emission, or `profileChange` emission.
- Do not change Plex discovery, library, stream resolution, playback URL, subtitle behavior, scheduler/channel-manager behavior, priority-one behavior, app-shell UI/focus behavior, or Windows platform behavior.
- Do not widen `IPlexAuth`, change public Plex API docs, introduce compatibility shims, add root/package barrels, add dependencies, or create fallback behavior beyond the existing v2-first/v1-fallback Plex Home policy.
- Do not move credential persistence out of `PlexAuth` unless a stopped/replanned plan explicitly approves a persistence-owner change.

## Parent Priority Alignment

`FCP-15` is the next safe package after completed `FCP-14`. The checklist marks `FCP-14` complete and states `FCP-16` or later, `FCP-EXIT`, Windows port work, and other post-FCP cleanup must wait for clean `FCP-15` closeout evidence.

Current architecture docs place Plex auth under `src/modules/plex/auth/`, with `PlexAuth.ts` owning `lineup_plex_auth` credentials, token handling, PIN flow, and Home profile behavior. `plexHomeEndpointClient.ts` already owns shared Plex Home endpoint transport/fallback primitives. `docs/api/plex-integration.md` documents the public `IPlexAuth` contract: `validateToken()` returns `false` only for explicit `401`/`403`; `getHomeUsers()` and `switchHomeUser()` throw typed credential failures; stored-credential operations are synchronous local storage and in-memory state operations.

The chosen cleanup advances the Plex auth boundary without changing the public contract: keep `PlexAuth` as the credential/state/persistence/event owner, and extract or tighten only Home endpoint request/status/profile-switch helper responsibilities inside `src/modules/plex/auth/`.

## Required Reading

Read in this order before implementation or review:

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/README.md` routing table
4. `ARCHITECTURE_CLEANUP_CHECKLIST.md` sections `FCP Operating Rules`, `FCP-14`, and `FCP-15`
5. `docs/architecture/CURRENT_STATE.md`
6. `docs/architecture/modules.md`
7. `docs/agentic/session-prompts/cleanup-loop.md`
8. `docs/agentic/plan-authoring-standard.md`
9. `docs/agentic/codanna-playbook.md`
10. `docs/api/plex-integration.md`
11. Completed guardrail plans only:
    - `docs/plans/2026-05-02-fcp-7-boundary-type-hygiene-plan.md`
    - `docs/plans/2026-05-02-fcp-8-api-plex-error-contract-coherence-plan.md`, especially Plex auth/error contract guardrails
    - `docs/plans/2026-05-02-fcp-9-source-signal-convention-local-elegance-plan.md`
    - `docs/plans/2026-05-02-fcp-10-epg-renderer-direct-confidence-presentation-decomposition-plan.md`
    - `docs/plans/2026-05-02-fcp-11-runtime-owner-reduction-hotspots-plan.md`
    - `docs/plans/2026-05-02-fcp-12-package-organization-structure-navigation-final-exit-plan.md`
    - `docs/plans/2026-05-05-fcp-13-low-risk-source-signal-api-export-diagnostic-closure-plan.md`
    - `docs/plans/2026-05-05-fcp-14-priority-one-forwarding-assembly-seam-plan.md`, especially single-slice FCP decomposition and closeout sequencing
12. This plan
13. Source and test files named under `## Files In Scope`
14. `git status --short --branch`

Freshness gate: stop and refresh this plan if any `FCP-15` checklist text, Plex auth architecture/API ownership text, source files in scope, or tests in scope changed materially after 2026-05-05.

Planning observed branch `code-health...origin/code-health [ahead 5]` with pre-existing unrelated dirty/untracked docs and `scorecard.png` paths. Preserve those paths unless a fresh source audit proves direct `FCP-15` overlap.

## Required Skills

- `plex-integration-boundaries`: required for Plex auth, Home endpoint fallback, token/profile-switch contract, and typed Plex error behavior.
- `architecture-boundaries`: required because this is an owner-boundary cleanup in port-critical auth code and must not grow `PlexAuth` or leak Plex mechanics into callers.
- `verification-strategy`: required to freeze proof depth for behavior-preserving auth helper extraction.
- `execution-plan-authoring`: required for Tier 3 source-backed FCP package planning.

Do not load `persistence-boundaries` unless implementation proves storage-backed behavior must become a true implementation seam. That discovery should normally stop and replan because this plan preserves `lineup_plex_auth`, credential epoch, persistence behavior, and event emission rather than moving them.

## Codanna Discovery

- `get_index_info`: Codanna available with 12,095 symbols across 797 files; 13,239 relationships; semantic search enabled with 330 embeddings; created and updated about 8 minutes before planning.
- `search_documents "FCP-15 PlexAuth Home profile status helper source_finding_id checklist"`: returned noisy unrelated docs and did not return the checklist as authoritative. Direct reads of `ARCHITECTURE_CLEANUP_CHECKLIST.md`, current architecture docs, and guardrail FCP plans are the fallback membership and sequencing source.
- `search_documents "PlexAuth credential persistence Home users switch profile validateToken contract"`: returned generic cleanup-plan and user-guide hits, not the authoritative Plex auth contract. Direct read of `docs/api/plex-integration.md` is the deterministic public-contract source.
- `semantic_search_with_context "PlexAuth Home endpoint fallback profile switch status classification credential persistence"`: weak/noisy; top hits were `AppOrchestrator.discoverServers`, lifecycle preferences, and `AppOrchestrator.pollForPin`, not the PlexAuth source seam.
- `semantic_search_with_context "plexHomeEndpointClient helpers Home users status classification switchHomeUser PlexAuth"`: weak/noisy; top hits were `AppOrchestrator.requestAuthPin`, lifecycle constants, initialization callbacks, and server-select toggling.
- `find_symbol PlexAuth`: found the `PlexAuth` class documentation/signature but reported a mismatched symbol label; `analyze_impact PlexAuth` returned no impacted symbols, so direct source/caller reads are required for class-level impact.
- `search_symbols switchHomeUser`: found `AppOrchestrator.switchHomeUser` and `PlexAuth.switchHomeUser` plus profile-select/app-shell test stubs. `analyze_impact` on the PlexAuth method symbol_id `12147` returned no impacted symbols; direct `rg` proves callers through `AppOrchestrator`, app-shell ports, and profile-select UI.
- `search_symbols getHomeUsers`: found `AppOrchestrator.getHomeUsers`, `PlexAuth.getHomeUsers`, `InitializationStartupPolicy`'s auth gate pick, and profile-select/app-shell test stubs. `analyze_impact` on the PlexAuth method symbol_id `12135` returned no impacted symbols; direct `rg` proves initialization and profile-select paths.
- `search_symbols validateToken`: found `PlexAuth.validateToken` and initialization auth-gate usage. `analyze_impact validateToken` returned no impacted symbols; direct `rg` proves initialization validation and switch-PIN disambiguation rely on this behavior.
- `search_symbols requestFirstSupportedHomeEndpoint`: found `requestFirstSupportedHomeEndpoint` and `requestFirstSupportedHomeEndpointOrThrowReachabilityError`. `analyze_impact requestFirstSupportedHomeEndpoint` reported one direct caller, `requestFirstSupportedHomeEndpointOrThrowReachabilityError`; Codanna missed `PlexAuth` imports/callers, so direct reads are authoritative for same-package usage.
- `analyze_impact shouldTryNextPlexHomeEndpoint`: reported contained impact through `requestFirstSupportedHomeEndpoint` and `requestFirstSupportedHomeEndpointOrThrowReachabilityError`.
- `analyze_impact PlexHomeUser`: reported broader type impact through Home payload parsers, `ProfileSelectScreen`, `AppLazyScreenRegistry`, `App`, and app-shell visibility. This plan therefore freezes `PlexHomeUser` shape and UI behavior.
- `analyze_impact IPlexAuth`: reported impact through `OrchestratorPlexAuthRuntime`, auth-screen/app-shell port creation, and `AppOrchestrator`. This plan freezes the public `IPlexAuth` shape.
- `search_symbols PlexAuthEvents`: found the event map but `analyze_impact` returned no impacted symbols. Direct reads prove `authChange` and `profileChange` are consumed by initialization and tests.
- `search_symbols` for `PlexAuth.test` and `InitializationStartupPolicy` returned no useful test/file-level symbols. Direct reads and `rg` are the fallback for affected tests.
- `rg` / direct source reads covered `PlexAuth.ts`, `plexHomeEndpointClient.ts`, `interfaces.ts`, `constants.ts`, `plexAuthPayloadParsers.ts`, `plexSwitchPayloadParser.ts`, `InitializationStartupPolicy.ts`, `AppOrchestrator` auth/profile methods, `OrchestratorPlexAuthRuntime.ts`, `ProfileSelectScreen.ts`, `PlexAuth.test.ts`, `plexHomeEndpointClient.test.ts`, `InitializationStartupPolicy.test.ts`, `InitializationCoordinator.test.ts`, and `AppLazyScreenPortFactory.test.ts`.

## Impact Snapshot

Current-source proof at plan time:

- `PlexAuth.requestPin`, `checkPinStatus`, `pollForPin`, `cancelPin`, and `validateToken` own PIN and token behavior. They are not the extraction target. `validateToken()` updates token state on `200`, returns `false` only for `401`/`403`, and throws typed `PlexApiError` for rate limit, server, transport, timeout, and malformed-success failures.
- `PlexAuth.storeCredentials`, `clearCredentials`, `readStoredCredentialsAndClearCorruption`, `_parseStoredAuthData`, `_readStoredCredentials`, `_normalizeTokenDates`, `_normalizeDeviceKey`, and `_normalizeSelectedServerMap` own `lineup_plex_auth` persistence, corruption clearing, storage version `2`, selected-server map normalization, device key normalization, and synchronous in-memory state updates. These must remain in `PlexAuth`.
- `_credentialsEpoch` is incremented only by `clearCredentials()` and is checked by `switchHomeUser()` after the profile token fetch. This protects against credential replacement during profile switching and must not be moved or bypassed.
- `getHomeUsers()` currently builds a v2-first/v1-fallback endpoint list, calls `requestFirstSupportedHomeEndpointOrThrowReachabilityError`, maps `401` to `AUTH_REQUIRED`, maps `403` to `AUTH_INVALID`, maps other non-ok responses to retryable/non-retryable `SERVER_UNREACHABLE` by status, parses successful payloads, and falls back from an empty successful v2 payload to v1 before returning `[]`.
- `switchHomeUser()` currently owns profile-switch URL construction with encoded `userId` and optional trimmed `pin`, v2-first/v1-fallback transport, `401`/`403` PIN disambiguation via `validateToken(accountToken.token)`, unsupported endpoint mapping to `RESOURCE_NOT_FOUND`, switch payload parsing, switched-token profile fetch, credential epoch/account-token guard, active user scoping by selected Home user id, selected-server map preservation/initialization, credential storage, and `profileChange` emission.
- `plexHomeEndpointClient.ts` already owns Home endpoint transport primitives: `shouldTryNextPlexHomeEndpoint`, v2/v1 probing mechanics, timeout-aware fetch, aborted-signal handling, retryable response preservation, and redaction of Plex token/PIN values from transport causes. It does not currently own the higher-level Home users or switch status classification.
- `plexAuthPayloadParsers.ts`, `plexHomeUsersPayloadParser.ts`, and `plexSwitchPayloadParser.ts` already own payload parsing. They are not the main extraction target unless the helper boundary needs private type imports or tests prove parser contract drift.
- `InitializationStartupPolicy.applyAuthValidationPolicy()` reads stored credentials, validates active/account tokens, writes normalized credentials back through `storeCredentials`, calls `getHomeUsers()` only to decide startup profile-select routing, and treats recoverable Plex auth errors as auth reroute conditions.
- `InitializationCoordinator` listens for `authChange` and `profileChange`; profile changes configure discovery storage before discovery initialization and route through the coordinator-owned profile-switch restart helper.
- `AppOrchestrator.getHomeUsers()`, `switchHomeUser()`, and `useMainAccountProfile()` are caller/orchestration seams. `AppOrchestrator.switchHomeUser()` and `useMainAccountProfile()` prepare profile-switch cleanup, call `PlexAuth`, restore pending server resume on failure, finalize cleanup only after success, and resume startup. This plan does not move that orchestration.
- `ProfileSelectScreen` consumes `getHomeUsers`, `switchHomeUser`, `useMainAccountProfile`, and `signOutPlex` through app-shell ports. It displays Home users, handles PIN-protected profiles, treats `AUTH_FAILED` as wrong PIN, and signs out for `AUTH_REQUIRED`/`AUTH_INVALID`. UI behavior is out of scope.
- Affected auth tests include `src/modules/plex/auth/__tests__/PlexAuth.test.ts` for validate-token, persistence, events, Home users, Home fallback, switch URL/PIN/status classification, switch aborts, profile-change emission, and active-user scoping; and `src/modules/plex/auth/__tests__/plexHomeEndpointClient.test.ts` for endpoint fallback mechanics.
- Affected initialization/profile-switch tests include `src/core/initialization/__tests__/InitializationStartupPolicy.test.ts` for active/account token validation and profile-select routing; `src/core/initialization/__tests__/InitializationCoordinator.test.ts` for `profileChange` resume/storage ordering; and `src/core/app-shell/__tests__/AppLazyScreenPortFactory.test.ts` / `src/modules/ui/profile-select/__tests__/ProfileSelectScreen.test.ts` only if public port semantics or UI-facing errors are touched.

## Files In Scope

- `src/modules/plex/auth/PlexAuth.ts`
- `src/modules/plex/auth/plexHomeEndpointClient.ts`
- New `src/modules/plex/auth/*` helper/client file only if it is auth-local and limited to Home endpoint/status/profile-switch request coordination.
- `src/modules/plex/auth/interfaces.ts` only for private auth-local helper types or import/type alignment; public `IPlexAuth`, `PlexAuthData`, `PlexHomeUser`, and `PlexAuthEvents` shapes are frozen unless a stopped/replanned contract decision approves otherwise.
- `src/modules/plex/auth/plexAuthPayloadParsers.ts`, `src/modules/plex/auth/plexHomeUsersPayloadParser.ts`, and `src/modules/plex/auth/plexSwitchPayloadParser.ts` only if source audit proves parser boundary imports or tests need local alignment; parser behavior is otherwise frozen.
- `src/modules/plex/auth/__tests__/PlexAuth.test.ts`
- `src/modules/plex/auth/__tests__/plexHomeEndpointClient.test.ts`
- New `src/modules/plex/auth/__tests__/*` helper/client tests only if a new auth-local helper/client is created.
- `src/core/initialization/__tests__/InitializationStartupPolicy.test.ts` only if `getHomeUsers`, validate-token fallback, or recoverable auth routing proof is needed.
- `src/core/initialization/__tests__/InitializationCoordinator.test.ts` only if `profileChange` emission/resume proof is needed.
- `src/core/app-shell/__tests__/AppLazyScreenPortFactory.test.ts` and `src/modules/ui/profile-select/__tests__/ProfileSelectScreen.test.ts` only if public port semantics or UI-facing Plex auth error contracts are touched.
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` only during package closeout after clean review and verification.
- `docs/architecture/CURRENT_STATE.md`, `docs/architecture/modules.md`, and `docs/api/plex-integration.md` only if implementation source audit proves current ownership/API truth changed; this plan expects no public API doc change.

## Files Out Of Scope

- Any runtime/source file not named in `## Files In Scope`.
- Token/PIN behavior changes: `requestPin`, `checkPinStatus`, `pollForPin`, `cancelPin`, and `validateToken` behavior are frozen except where tests are run as preservation proof.
- Credential epoch, `lineup_plex_auth`, storage version, selected-server map schema, device key persistence, corruption clearing, localStorage read/write timing, and persistence behavior changes.
- Public `IPlexAuth` behavior/shape changes, public Plex API docs changes, app-shell/profile-select UI behavior changes, focus behavior, CSS, screen text, and port semantics.
- Plex discovery, library, stream resolution, playback URL, subtitle, transcode, image URL, or server-selection behavior.
- Scheduler/channel-manager, channel persistence, ContentResolver, priority-one, navigation, lifecycle policy outside affected auth/profile resume tests, Windows port work, and `FCP-16` or later.
- Completed `FCP-7` through `FCP-14` implementation work except as read-only guardrails.
- Pre-existing unrelated dirty/untracked workspace files.

## Planner Self-Check

1. No unresolved package-level owner seam remains: `FCP-15-SF1` maps to `FCP-15-S1`.
2. Adjacent contract/type changes are explicit: public `IPlexAuth`, `PlexHomeUser`, `PlexAuthData`, `PlexAuthEvents`, storage keys, and storage schema are frozen. If implementation needs to change them, it must stop and replan.
3. Files out of scope are not hidden implementation dependencies. App-shell/profile-select/initialization files are tests-only proof surfaces unless an explicit stop/replan condition admits source changes.
4. Codanna evidence and insufficiencies are recorded, including weak semantic/doc search, same-file impact gaps, and direct-read fallback for PlexAuth/test seams.
5. The plan uses repo-preferred owners: `PlexAuth` remains the credential/state/persistence/event owner; Home endpoint transport/status/profile request helpers stay under `src/modules/plex/auth/`; callers continue asking for auth outcomes rather than building Plex mechanics.
6. The completed plan no longer exposes ready-now implementation work; `FCP-15-S1`
   is closed with package membership, final owners, and verification evidence
   recorded in the checklist.
7. The plan is execution-grade at seam/scope/verification level and deliberately leaves helper naming, exact private type names, and routine extraction shape to the cleanup worker.

## Architecture Seam Decision Gate

Approved seam:

- Execute one slice, `FCP-15-S1`, inside the Plex auth owner.
- Keep `PlexAuth` responsible for credential state, credential epoch, `lineup_plex_auth` persistence, corruption handling, token validation state updates, active/account token selection, active user id, and `authChange`/`profileChange` event emission.
- Move or tighten only Home endpoint/status/profile-switch request coordination that can be isolated behind an auth-local helper/client without changing public `IPlexAuth` behavior. Acceptable helper responsibilities include v2/v1 Home endpoint URL construction, endpoint fallback loop orchestration, Home users response status classification, switch response status classification, wrong-PIN disambiguation policy, switch payload token extraction handoff, and sanitized transport error mapping.
- Preserve existing fallback order: v2 endpoint first, v1 endpoint second. Preserve the special `getHomeUsers()` empty-success fallback from empty v2 profile payload to v1 before returning `[]`.
- Preserve existing error taxonomy: `401` Home users -> `AUTH_REQUIRED`; `403` Home users -> `AUTH_INVALID`; switch with supplied PIN and still-valid account token on `401`/`403` -> `AUTH_FAILED`; invalid account token on switch -> `AUTH_REQUIRED`/`AUTH_INVALID`; unsupported switch endpoints -> `RESOURCE_NOT_FOUND`; malformed successful payloads -> `PARSE_ERROR`; timeout/network/retryable transport failures -> existing retryable `SERVER_UNREACHABLE` / `SERVER_ERROR` behavior.
- Preserve token/PIN redaction in thrown causes. No helper may leak `X-Plex-Token` or `pin` values into errors, logs, tests, or diagnostics.
- If source audit proves a specific part of `switchHomeUser()` must stay in `PlexAuth` because it is credential mutation rather than transport/status policy, record that as source-justified retained responsibility instead of forcing extraction.

Stop and replan if:

- token validation, PIN flow, credential epoch, storage key/schema/version, selected-server map persistence, device key persistence, corruption handling, localStorage behavior, `authChange`, or `profileChange` behavior must change;
- `IPlexAuth`, `PlexHomeUser`, `PlexAuthData`, or `PlexAuthEvents` public contracts must change;
- fallback order, empty-success Home fallback, PIN disambiguation, unsupported endpoint handling, or error taxonomy must change without a maintainer-approved contract decision;
- implementation needs Plex discovery, library, stream, playback URL, subtitle, scheduler/channel-manager, priority-one, UI/focus, Windows, or broad initialization/orchestrator source changes;
- a helper boundary would need to own credential persistence or profile-switch cleanup orchestration instead of returning typed auth-local outcomes to `PlexAuth`;
- tests require private probing of helper internals instead of public `PlexAuth`/auth-local helper behavior proof;
- source audit shows the `FCP-15-SF1` sentence is already false and planned edits would be churn;
- newly discovered residue changes package membership, execution-unit membership, final-owner accounting, or verification surface.

Absorb-now rule: absorb only newly discovered residue that stays within the same approved execution-unit goal, owner, seam/files, verification envelope, and final-owner accounting. Record absorbed residue in implementation/review output. Replan for new owners, wider verification, changed source-finding coverage, or changed execution-unit membership.

## Verification Commands

- Verification classification: `new regression/contract test required`

Primary proof mode: `refactor-invariance` for behavior-preserving auth-local helper extraction, with `contract-first` proof for Home endpoint fallback, status classification, profile-switch event/persistence preservation, and public Plex auth error taxonomy.

Plan validation:

- Controller will run: `npm run plans:check`
  - Expected: this active tracked plan satisfies Universal Plan Core and FCP cleanup-overlay structure.
- Controller will run after active plan creation/update: `npm run verify:docs`
  - Expected: docs/control-plane verification passes for the active plan. Run again during package closeout if checklist/current-state/modules/API docs are updated.

Ready-now `FCP-15-S1` source-audit proof:

- Pre-edit source audit over `PlexAuth.ts`, `plexHomeEndpointClient.ts`, relevant auth payload parser imports, `InitializationStartupPolicy.ts`, `AppOrchestrator` auth/profile methods, `OrchestratorPlexAuthRuntime.ts`, and profile-select/app-shell port usage.
  - Expected: implementation can name each moved responsibility as Home endpoint/status/profile request policy and each retained `PlexAuth` responsibility as credential state, persistence, epoch, token validation, PIN flow, or event ownership.
- Post-edit source audit over the same files plus any new auth-local helper/client.
  - Expected: `PlexAuth` no longer mixes Home endpoint fallback/status/profile request details beyond delegating to the focused auth-local helper/client; retained credential persistence/event/epoch responsibilities are source-justified; no caller outside Plex auth learns Plex Home URL, status, token, or PIN mechanics.
- Package-local static audits:
  - Run: `rg -n "PLEX_TV_BASE_URL|PLEX_TV_BASE_URL_V1|HOME_USERS_ENDPOINT|/switch|pin=|AUTH_FAILED|RESOURCE_NOT_FOUND|requestFirstSupportedHomeEndpoint" src/modules/plex/auth`
    - Expected: Home endpoint URL/status/switch mechanics live only in `PlexAuth.ts`, `plexHomeEndpointClient.ts`, approved auth-local helper/client files, and tests; no leakage outside auth.
  - Run: `rg -n "lineup_plex_auth|STORAGE_KEY|STORAGE_VERSION|_credentialsEpoch|authChange|profileChange" src/modules/plex/auth`
    - Expected: storage key/version, credential epoch, and event emission ownership remain in `PlexAuth.ts`/auth constants/interfaces as before; no new persistence owner is introduced.

Focused auth tests:

- Run: `npm test -- PlexAuth plexHomeEndpointClient`
  - Expected: PIN and validate-token behavior remain stable; Home users XML/JSON parsing and empty-v2-to-v1 fallback remain stable; Home endpoint transport fallback and abort behavior remain stable; switch URL/PIN construction, v2/v1 fallback, wrong-PIN disambiguation, unsupported endpoint mapping, abort behavior, sanitized causes, active-user scoping, selected-server map preservation, credential writes, and `profileChange` emission remain stable.
- Run additional parser tests if parser files are touched:
  - `npm test -- plexHomeUsersPayloadParser plexSwitchPayloadParser plexAuthPayloadParsers`
  - Expected: parser behavior remains unchanged except for any approved private import/type alignment.

Initialization/profile-switch proof if touched or if implementation changes `getHomeUsers()` / `switchHomeUser()` control flow:

- Run: `npm test -- InitializationStartupPolicy InitializationCoordinator`
  - Expected: active/account token validation routing, profile-select startup routing, recoverable auth rerouting, `profileChange` resume, and discovery-storage-before-discovery ordering remain unchanged.
- Run: `npm test -- AppLazyScreenPortFactory ProfileSelectScreen`
  - Expected only if public port semantics or UI-facing auth error behavior is touched; profile screen still routes `AUTH_FAILED` to wrong-PIN handling and `AUTH_REQUIRED`/`AUTH_INVALID` to sign-out behavior.

Static and package gates:

- Run: `npm run typecheck`
  - Expected: no TypeScript errors after private helper extraction/import/type changes.
- Run: `git diff --check`
  - Expected: no whitespace errors before commits and package closeout.
- Run: `npm run verify`
  - Expected: full UI/navigation/orchestrator/Plex/runtime gate passes before marking `FCP-15` complete because Plex auth behavior is port-critical and profile-switch startup integration is affected.

Package closeout:

- Source-finding proof matrix for `FCP-15-SF1`.
  - Expected: the original source finding sentence is answered as fixed, source-disproved, deferred, or reclassified with one final owner. No detector/imported ids are used.
- Package-local old/replacement pattern audits for Home endpoint fallback/status/profile-switch helper ownership, credential/token/PIN preservation, persistence/event preservation, and caller leakage.
- Run: `npm run plans:check`
- Run: `npm run verify:docs` if checklist/current-state/modules/API/plan docs are updated during closeout.
- Run: `git diff --check`
- Run: `npm run verify`
- Obtain clean closeout review before `FCP-16` starts.

## Rollback Notes

- Roll back by the single execution unit, `FCP-15-S1`.
- If auth parity fails, restore the previous `PlexAuth` Home users/switch implementation and keep any new public-behavior tests that exposed the parity gap.
- If the helper boundary accidentally changes credential persistence, event emission, or epoch protection, revert the helper extraction before changing storage/event logic.
- If a candidate extracted branch proves ownerful credential mutation rather than Home request/status policy, keep it in `PlexAuth` and record source-justified retention for closeout.
- If docs/checklist closeout fails, leave reviewed source/test changes intact and fix tracked docs in a separate controller-owned closeout pass.

## Commit Checkpoints

- `FCP-15-S1` implementation checkpoint: auth-local Home endpoint/status/profile helper cleanup plus focused auth and affected initialization/profile-switch tests and source audits.
- Closeout checkpoint: after implementation has clean review and `npm run verify` passes, update `ARCHITECTURE_CLEANUP_CHECKLIST.md` and any narrow current architecture/API docs only if source audit proves truth changed. Keep active tracked plan progress/checklist closeout separate from implementation commits unless the controller explicitly chooses a tracked-doc commit.

## Package Decomposition

- `package_id`: `FCP-15`
- `checklist_token`: `FCP-15`
- `source_finding_ids`:
  - `FCP-15-SF1`
- `slice_table`:

### `FCP-15-S1` Bounded Home/Status/Profile Helper Cleanup

- `goal`: isolate Plex Home endpoint fallback, status classification, and profile-switch request coordination into a focused auth-local boundary while preserving `PlexAuth` credential state, persistence, epoch, token/PIN, and event ownership.
- `areas/files`:
  - `src/modules/plex/auth/PlexAuth.ts`
  - `src/modules/plex/auth/plexHomeEndpointClient.ts`
  - new `src/modules/plex/auth/*` helper/client file only if auth-local and limited to the approved seam
  - auth parser files only for private import/type alignment if source-proven necessary
  - `src/modules/plex/auth/__tests__/PlexAuth.test.ts`
  - `src/modules/plex/auth/__tests__/plexHomeEndpointClient.test.ts`
  - new auth-local helper/client tests if a new helper/client is created
  - `src/core/initialization/__tests__/InitializationStartupPolicy.test.ts` and `src/core/initialization/__tests__/InitializationCoordinator.test.ts` if profile-switch/startup proof is touched or needed
  - `src/core/app-shell/__tests__/AppLazyScreenPortFactory.test.ts` and `src/modules/ui/profile-select/__tests__/ProfileSelectScreen.test.ts` only if public port/UI-facing auth error semantics are touched
- `source_finding_ids`:
  - `FCP-15-SF1`
- `verification`: pre/post source audits; package-local `rg` audits for Home endpoint/status/profile mechanics and credential/storage/event ownership; `npm test -- PlexAuth plexHomeEndpointClient`; parser tests if touched; `npm test -- InitializationStartupPolicy InitializationCoordinator` if touched/needed; `npm test -- AppLazyScreenPortFactory ProfileSelectScreen` only if public port/UI-facing error semantics are touched; `npm run typecheck`; `git diff --check`; package closeout `npm run verify`.
- `dependencies`: `FCP-14` closeout complete; no code dependency on completed FCP packages beyond guardrail reading.
- `stop_condition`: stop if token validation, PIN flow, credential epoch, storage key/schema/version, selected-server map/device key persistence, corruption handling, localStorage behavior, public `IPlexAuth`/`PlexHomeUser`/`PlexAuthData`/`PlexAuthEvents`, event emission, fallback order, error taxonomy, Plex discovery/library/stream/playback/subtitle behavior, scheduler/channel-manager, priority-one, UI/focus, Windows behavior, or broad initialization/orchestrator source changes are required.
- `handoff_condition`: the `FCP-15-SF1` sentence is false for current source, or any retained `PlexAuth` responsibility is source-justified with one final owner/revisit trigger; credential/token/PIN/persistence/event/fallback/error behavior tests and audits pass.
- `serial_only`: true
- `parallel_justification`: single auth-sensitive owner seam with shared tests and credential/event invariants; splitting would duplicate parity audits and increase risk of token/profile persistence drift.
- `coverage_check`:
  - `FCP-15-SF1` maps exactly to `FCP-15-S1`.
- `ready_now_execution_unit`: none; package complete
- `ready_now_slice`: none; package complete
- `recommended_slice_order`: none; package complete
- `parallel_execution_policy`: serial single-slice package. No parallel worker split and no execution wave are approved. Implementation and review should treat `FCP-15-S1` as one coherent Plex auth boundary unit.

## Priority-Exit Readiness

`FCP-15` is the only planned package for this FCP priority. Package closeout may mark `FCP-15` complete only after:

- `FCP-15-SF1` is resolved, source-disproved, or explicitly reclassified with one final owner and revisit trigger.
- The proof matrix records whether the original source finding still describes current source after implementation.
- Token validation, PIN flow, credential epoch, `lineup_plex_auth`, storage version/schema, selected-server map persistence, device key persistence, corruption handling, `authChange`, `profileChange`, fallback order, and error taxonomy are confirmed preserved.
- Required focused tests, source audits, `npm run typecheck`, `git diff --check`, and `npm run verify` pass.
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` mini-record is updated with plan path, verification evidence, proof matrix, follow-ups, and handoff.
- A clean implementation/closeout review approves the package.
- `FCP-16` does not start until the checklist mini-record for `FCP-15` is completed with source-audit proof, verification evidence, clean review evidence, and owned follow-ups.
