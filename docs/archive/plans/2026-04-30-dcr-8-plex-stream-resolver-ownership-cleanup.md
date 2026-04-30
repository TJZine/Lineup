# DCR-8 Plex Stream Resolver Ownership Cleanup Plan

**Plan Status:** archived
**Task family:** cleanup/refactor
**Cleanup subtype:** checklist-linked

## Goal

Create an execution-ready cleanup plan for `ARCHITECTURE_CLEANUP_CHECKLIST.md`
item `DCR-8`: Plex Stream Resolver Ownership Cleanup.

This package retires the resolver ownership risk by:

- removing direct settings/debug store construction from
  `PlexStreamResolver`
- moving resolver-owned `SubtitleDebugLogger` construction behind a typed
  subtitle-debug logging port
- moving debug subtitle discovery/probe scheduling behind a narrow Plex stream
  debug-probe owner
- moving universal transcode decision request conversion, fetch, timeout, and
  parse behavior behind a narrow Plex stream decision owner
- preserving the public `IPlexStreamResolver` playback/debug contract and all
  token redaction protections

The repo-preferred owner is `src/modules/plex/stream/`. Settings/debug stores
remain the storage owners; the resolver receives typed policy-reader ports and
does not depend on storage mechanics.

## Non-Goals

- Do not change playback behavior, zero-transcode bias, mixed-content fallback
  selection, direct-play/transcode URL construction, HDR10/DV fallback behavior,
  subtitle delivery policy, auth failure mapping, server decision shape, session
  id behavior, timeout behavior, or event emission semantics.
- Do not redesign Plex auth, discovery, library parsing, selected-server
  persistence, player UI/native media policy, broad Plex library APIs, `DCR-9`,
  or `DCR-EXIT`.
- Do not weaken token redaction. No raw `X-Plex-Token`, `access_token`,
  token-bearing URL, subtitle stream key, or auth header value may appear in
  logs, errors, probe contexts, or new test snapshots.
- Do not add compatibility shims, fallback branches, broad public barrels, or
  speculative abstractions.
- Do not use Desloppify output, imported issue ids, score deltas, old queue
  rows, FCP `source_finding_id` coverage, or `source_finding_id` proof matrices
  as DCR-8 intake, membership, proof, or closeout.
- Do not bundle active `docs/plans/*` edits into implementation checkpoint
  commits.

## Parent Priority Alignment

`DCR-8` is a checklist-linked Tier 3 cleanup package in the DCR cleanup series.
It targets the current hotspot `src/modules/plex/stream/PlexStreamResolver.ts`,
which `docs/architecture/CURRENT_STATE.md` names as an active remediation
hotspot. `docs/api/plex-integration.md` defines `IPlexStreamResolver` as the
public Plex stream contract for stream URL resolution and transcode sessions.

This plan keeps Plex stream policy inside the Plex stream module, keeps settings
persistence behind settings/debug owners, and avoids moving URL, token, or
subtitle policy into orchestration, player UI, or debug UI callers.

## Required Reading

Fresh sessions must read these before implementation, in order:

1. `AGENTS.md`
2. `docs/AGENTIC_DEV_WORKFLOW.md`
3. `docs/agentic/session-prompts/cleanup-loop.md`
4. `docs/agentic/session-prompts/README.md`
5. `docs/agentic/plan-authoring-standard.md`
6. `docs/agentic/codanna-playbook.md`
7. `docs/architecture/CURRENT_STATE.md`
8. `docs/api/plex-integration.md`
9. `ARCHITECTURE_CLEANUP_CHECKLIST.md` `DCR-8` entry
10. this plan
11. DCR-8 source/test files named in `## Files In Scope`

Freshness gate: if any referenced file, checklist status, current-state claim,
or public Plex stream contract changed materially after this plan was written,
update this plan before implementation continues.

## Required Skills

- `plex-integration-boundaries`: keep stream resolution, URL construction,
  subtitle probing, and transcode decision policy inside Plex stream ownership.
- `persistence-boundaries`: keep settings/debug stores as storage owners and
  expose only typed policy-reader ports to resolver/collaborators.
- `architecture-boundaries`: keep the resolver hotspot from absorbing more
  responsibilities and freeze public/cross-module seams before edits.
- `verification-strategy`: use refactor-invariance plus targeted contract tests
  and token-redaction source audit.
- `execution-plan-authoring`: keep this tracked plan decision-complete without
  turning it into patch prose.

`ui-composition-patterns` is not required for the approved scope because no
player UI, overlay, focus, motion, or TV-visible behavior may change. The
existing `NowPlayingDebugManager` call path is preserved as a debug consumer of
`IPlexStreamResolver`.

Do not use `security-best-practices` for this package; token redaction/security
is an accepted residual to preserve, not a new security review track.

## Codanna Discovery

Codanna policy result:

- Codanna-first discovery was required by the workflow, but this session has no
  Codanna tool namespace exposed.
- MCP resource discovery returned no resources or resource templates.
- Fallback used: `rg` and direct reads of required docs/source files. This is
  the explicit fallback path for this plan.

Direct source/doc evidence used:

- `rg -n "DCR-8|Plex Stream Resolver|Stream Resolver"
  ARCHITECTURE_CLEANUP_CHECKLIST.md` and direct read of the `DCR-8` checklist
  entry.
- Direct reads of `docs/AGENTIC_DEV_WORKFLOW.md`,
  `docs/agentic/session-prompts/cleanup-loop.md`,
  `docs/agentic/session-prompts/README.md`,
  `docs/agentic/plan-authoring-standard.md`,
  `docs/agentic/codanna-playbook.md`,
  `docs/architecture/CURRENT_STATE.md`, and
  `docs/api/plex-integration.md`.
- Direct reads of the required skills:
  `.codex/skills/plex-integration-boundaries/SKILL.md`,
  `.codex/skills/persistence-boundaries/SKILL.md`,
  `.codex/skills/architecture-boundaries/SKILL.md`,
  `.codex/skills/verification-strategy/SKILL.md`, and
  `.codex/skills/execution-plan-authoring/SKILL.md`.
- Direct source reads of
  `src/modules/plex/stream/PlexStreamResolver.ts`,
  `src/modules/plex/stream/interfaces.ts`,
  `src/modules/plex/stream/resolveStreamPipeline.ts`,
  `src/modules/plex/stream/SubtitleStreamProbe.ts`,
  `src/modules/plex/stream/SubtitleStreamProbeSupport.ts`,
  `src/modules/plex/stream/plexStreamUrlPolicy.ts`,
  `src/core/orchestrator/OrchestratorModuleFactory.ts`,
  settings/debug store/logging files, and relevant Plex stream/debug tests.
- `rg` searches for direct resolver construction, public
  `fetchUniversalTranscodeDecision` callers, store/logger construction, debug
  logging, token/redaction tests, and subtitle probe coverage.

## Impact Snapshot

Source review confirms all DCR-8 package issues are live:

- `DCR-8-A1`: `PlexStreamResolver.resolveStream()` currently owns subtitle
  debug discovery summaries, candidate selection, and probe scheduling inline
  before calling `probeSubtitleStreamDelivery`.
- `DCR-8-A2`: `PlexStreamResolver.fetchUniversalTranscodeDecision()` currently
  converts `StreamDecision['transcodeRequest']` into `HlsOptions`, builds the
  decision endpoint from the transcode start URL, fetches with a 4000 ms
  timeout, maps auth failures, and parses XML/regex decision attributes inline.
- `DCR-8-A3`: `PlexStreamResolver` directly constructs
  `AudioSettingsStore`, `PlaybackSettingsStore`, `DeveloperSettingsStore`, and
  `SubtitleDebugLogger`.
- `DCR-8-D1`: ownership decisions are resolved in this plan and accounted to
  `DCR-8-S1` exactly once before implementation starts.

Public/caller impact snapshot:

- `IPlexStreamResolver` remains the public stream/debug contract. Public methods
  stay: `resolveStream`, `stopTranscodeSession`, `canDirectPlay`,
  `getTranscodeUrl`, `fetchUniversalTranscodeDecision`, `on`, and `off`.
- `fetchUniversalTranscodeDecision` stays public because
  `src/modules/debug/NowPlayingDebugManager.ts` calls it for the now-playing
  debug HUD and playback info snapshot. Moving that method behind another
  public collaborator would widen debug-module imports and public API impact for
  no DCR-8 benefit.
- `PlexStreamResolverConfig` may change to require typed policy-reader ports, a
  typed subtitle-debug logging port, and focused optional collaborators, but
  `docs/api/plex-integration.md` does not need an update unless an
  `IPlexStreamResolver` method shape changes.
- `src/core/orchestrator/OrchestratorModuleFactory.ts` is the only production
  composition root expected to wire the new resolver policy dependencies.

Existing behavior/proof surfaces:

- `src/modules/plex/stream/__tests__/PlexStreamResolver.test.ts` covers direct
  play/transcode decisions, mixed-content fallback, HDR10/DV fallback,
  transcode URL construction, server decision fetch, auth failure mapping,
  timeout behavior, and token-redacted transcode debug logs.
- `src/modules/plex/stream/__tests__/SubtitleStreamProbe.test.ts` and
  `SubtitleStreamProbeSupport.test.ts` cover subtitle probe request options,
  timeout, foreign-key fallback, and redacted request context.
- `src/modules/debug/__tests__/NowPlayingDebugManager.test.ts` covers the debug
  HUD/snapshot consumer of `fetchUniversalTranscodeDecision`.
- `src/__tests__/orchestrator/orchestrator-module-factory-wiring.test.ts` is
  the likely composition-root wiring proof when config dependencies change.

## Files In Scope

- `src/modules/plex/stream/PlexStreamResolver.ts`
- `src/modules/plex/stream/interfaces.ts`
- `src/modules/plex/stream/resolveStreamPipeline.ts` only if type plumbing for
  unchanged stream decisions requires it
- `src/modules/plex/stream/SubtitleStreamProbe.ts`
- `src/modules/plex/stream/SubtitleStreamProbeSupport.ts`
- `src/modules/plex/stream/plexStreamUrlPolicy.ts` only if universal decision
  extraction needs existing URL-policy types without changing URL behavior
- new focused collaborators under `src/modules/plex/stream/`, limited to debug
  subtitle probing and universal transcode decision fetch/parse ownership
- `src/modules/plex/stream/__tests__/*` as needed
- `src/core/orchestrator/OrchestratorModuleFactory.ts` only for constructor
  wiring when `PlexStreamResolverConfig` changes
- `src/modules/settings/*Store.ts` and `src/modules/debug/*Store.ts` only as
  read-port context or constructor-injected dependencies; do not change their
  storage-owner APIs unless source proof forces a replan
- `src/modules/debug/SubtitleDebugLogger.ts` only if S1 needs to consume its
  existing logging behavior through a typed stream logging port without
  changing logging/redaction behavior
- `src/modules/debug/__tests__/NowPlayingDebugManager.test.ts` only to preserve
  public resolver debug-caller behavior
- `src/__tests__/orchestrator/orchestrator-module-factory-wiring.test.ts` only
  to prove production config wiring
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` closeout update after implementation and
  clean review
- `docs/architecture/CURRENT_STATE.md` only if landed ownership changes need a
  current-state owner note
- `docs/api/plex-integration.md` only if the public `IPlexStreamResolver`
  method contract changes, which this plan currently forbids

## Files Out Of Scope

- Plex auth, discovery, and library redesign
- selected-server persistence redesign
- player UI, native media policy, screens, overlays, focus, and TV-visible
  behavior
- broad Plex library APIs or parser/request-policy changes
- `DCR-9`, `DCR-EXIT`, and unrelated DCR packages
- unrelated shared `plexUrl`, `plexLogging`, or `redact` changes except source
  audit to preserve token/url/log safety
- broad stream package barrels; no new public barrel exports unless explicitly
  approved by replan
- compatibility shims, dual config paths, or fallback branches for old resolver
  construction

## Planner Self-Check

1. The main ownership seams are resolved: S1 injects typed policy readers and a
   typed subtitle-debug logging port, S2 owns debug subtitle probing in a
   focused stream collaborator, and S3 owns universal decision fetch/parse in a
   focused stream collaborator.
2. Adjacent contract changes are bounded. `IPlexStreamResolver` public methods
   stay frozen; `PlexStreamResolverConfig` may change and has explicit
   production/test wiring scope.
3. No file is declared out of scope while still being needed for mechanical
   writes. Source reads of shared redaction/URL helpers are allowed for audit
   only; edits require replan.
4. Codanna evidence is explicitly unavailable in this session, and direct
   fallback reads/searches are recorded.
5. The owner remains Plex stream plus existing settings/debug storage owners;
   the plan does not grow Orchestrator, player UI, or debug UI ownership.
6. A fresh session should not need to invent package membership, slice order,
   DCR-8-D1 accounting, public contract policy, logger ownership, redaction
   constraints, or verification depth.
7. The plan is execution-grade at the seam/scope/verification level and leaves
   routine local coding choices to the implementer.

## Architecture Seam Decision Gate

Chosen DCR-8-D1 owners:

- Debug subtitle probing owner:
  `src/modules/plex/stream/SubtitleStreamDebugProbeCoordinator.ts` or an
  equivalently narrow stream-local name chosen during implementation. It owns
  subtitle debug discovery summaries, text-candidate selection, preferred
  key-backed/keyless candidate picking, and scheduling calls to
  `probeSubtitleStreamDelivery`. It consumes typed ports for server URI, auth
  headers, and subtitle debug logging. It must not own subtitle delivery policy,
  player subtitle attachment, UI display, or persistent settings storage.
- Universal decision fetch/parse owner:
  `src/modules/plex/stream/UniversalTranscodeDecisionClient.ts` or an
  equivalently narrow stream-local name chosen during implementation. It owns
  `StreamDecision['transcodeRequest']` to `HlsOptions` conversion, decision URL
  derivation from the existing transcode start URL, the 4000 ms fetch timeout,
  auth-failure mapping through the resolver-owned error taxonomy seam, and
  XML/regex decision parsing. `PlexStreamResolver.fetchUniversalTranscodeDecision`
  remains public and delegates to this owner.
- Typed policy-reader dependencies for `PlexStreamResolver`:
  `audioPolicyReader`, `playbackPolicyReader`, `debugPolicyReader`,
  `subtitleDebugPolicyReader`, and `debugOverridesReader`. These are typed
  ports in `src/modules/plex/stream/interfaces.ts`, not store-class dependencies
  in resolver logic. Expected methods are limited to the values the resolver
  already reads:
  `readDirectPlayAudioFallbackEnabledAndClean`,
  `readDtsPassthroughEnabledAndClean`, `readHdr10FallbackModeAndClean`,
  `readTranscodeCompatEnabledAndClean`, `readTranscodeQualityOptionAndClean`,
  `readDebugLoggingEnabledAndClean`,
  `readSubtitleDebugLoggingEnabledAndClean`, and
  `readTranscodeProfileNameAndClean`.
- Subtitle debug logging owner/port policy for S1:
  `PlexStreamResolver` must receive a typed subtitle-debug logging port instead
  of constructing `SubtitleDebugLogger`. The approved port shape is narrow:
  `isEnabled(): boolean` and `log(event: string, context: Record<string, unknown> | (() => Record<string, unknown>)): void`.
  The production owner for creating that port is a stream-local adapter such as
  `src/modules/plex/stream/PlexStreamSubtitleDebugLogPort.ts` or an
  equivalently narrow stream-local name. That adapter may construct
  `SubtitleDebugLogger` with the injected `subtitleDebugPolicyReader` and the
  existing Plex warning sink/scope, because `SubtitleDebugLogger` remains the
  debug-module owner for enabled checks, safe stringification, and logging
  failure swallowing. `PlexStreamResolver` must only call the port. S1 must not
  pull debug subtitle probe candidate selection out of `resolveStream()`; that
  remains S2.

Public interface freeze:

- Do not remove or rename any `IPlexStreamResolver` method in
  `src/modules/plex/stream/interfaces.ts`.
- Do not change `StreamDecision`, `StreamDecision['serverDecision']`, or
  `StreamDecision['transcodeRequest']` shapes.
- If implementation discovers that a public method must move behind a separate
  collaborator, stop and replan with exact import/caller impact for
  `NowPlayingDebugManager`, public stream exports, `docs/api/plex-integration.md`,
  and affected tests.

Implementation invariants:

- Preserve `resolveStream()` event emission semantics through `_createError`.
- Preserve direct-play/transcode URL construction and token placement; only
  debug/log surfaces may contain redacted token strings.
- Preserve subtitle debug probe request headers, `cors`/`omit` options, 8000 ms
  timeout, redacted contexts, and key/id fallback selection semantics.
- Preserve universal decision fetch timeout at 4000 ms, auth failure mapping for
  `401`/`403`, non-ok error behavior, parse fields, and `fetchedAt` behavior.
- Preserve current async fire-and-forget behavior for subtitle probes inside
  `resolveStream()`.

Absorb-now scope:

- Within an approved execution unit, small type/test adjustments may be absorbed
  only when they stay in the same files, same owner, same verification envelope,
  and same final-owner accounting.

Stop/replan triggers:

- any source review shows public `IPlexStreamResolver` methods must change
- resolver extraction changes playback URLs, transcode query params, token
  placement, mixed-content selection, HDR10/DV fallback, subtitle delivery, auth
  failure mapping, server decision shape, session id behavior, timeout behavior,
  or event emission semantics
- any raw token, auth header value, token-bearing URL, or subtitle stream key is
  logged/exposed in debug output, errors, probe contexts, or snapshots
- implementation requires Plex auth/discovery/library, selected-server
  persistence, player UI/native media policy, broad Plex library APIs, `DCR-9`,
  or `DCR-EXIT`
- settings/debug store APIs need storage-owner changes instead of typed
  read-port injection
- a new collaborator becomes a generic utility, public barrel expansion, or
  compatibility shim
- S2 and S3 parallelism would touch shared resolver/config/test files without a
  controller-owned integration gate
- verification requires materially broader commands or device/manual proof
  beyond this plan
- package issue coverage or final-owner accounting changes

## Package Decomposition

`package_id`: `DCR-8`

`checklist_token`: `DCR-8`

`package_issue_ids`:

- `DCR-8-A1`
- `DCR-8-A2`
- `DCR-8-A3`
- `DCR-8-D1`

`slice_table`:

| slice_id | goal | areas/files | exact_issue_ids | verification | dependencies | stop_condition | handoff_condition | serial_only or parallel_group | parallel_justification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DCR-8-S1` | Replace direct resolver settings/debug store and logger construction with typed policy-reader plus subtitle-debug logging-port injection and production/test wiring. | `src/modules/plex/stream/interfaces.ts`, `src/modules/plex/stream/PlexStreamResolver.ts`, new narrow stream-local subtitle debug log-port adapter if needed, `src/core/orchestrator/OrchestratorModuleFactory.ts`, resolver test utilities/tests, orchestrator factory wiring test. | `DCR-8-A3`, `DCR-8-D1` | `npm test -- --runInBand src/modules/plex/stream/__tests__/PlexStreamResolver.test.ts src/modules/plex/stream/__tests__/PlexStreamResolver.subtitle-errors.test.ts src/__tests__/orchestrator/orchestrator-module-factory-wiring.test.ts` plus `npm run typecheck`; source audit for no direct settings/debug store or logger construction in resolver. | none; serial first | config needs compatibility shim, settings/debug store API redesign, public `IPlexStreamResolver` method change, S1 pulls subtitle probe selection into scope, or behavior/token redaction change | resolver receives typed policy readers and a typed subtitle-debug logging port; production and tests wire them explicitly; public resolver methods unchanged; DCR-8-D1 owner decisions are codified for S2/S3; targeted tests/typecheck/source audit pass | `serial_only` | Must run first because S2 and S3 depend on constructor/config seams and logging policy reads. DCR-8-D1 maps here exactly once as pre-implementation ownership accounting; S2/S3 implement the chosen owners under A1/A2. |
| `DCR-8-S2` | Move debug subtitle discovery/probe selection/scheduling out of `PlexStreamResolver` into a focused stream-local debug-probe coordinator. | `src/modules/plex/stream/PlexStreamResolver.ts`, new `src/modules/plex/stream/*Subtitle*Debug*Probe*.ts` collaborator, `SubtitleStreamProbe.ts`, `SubtitleStreamProbeSupport.ts`, stream probe/resolver tests. | `DCR-8-A1` | `npm test -- --runInBand src/modules/plex/stream/__tests__/PlexStreamResolver.test.ts src/modules/plex/stream/__tests__/SubtitleStreamProbe.test.ts src/modules/plex/stream/__tests__/SubtitleStreamProbeSupport.test.ts`; token/debug source audit. | after S1; may be implemented with S1 only if constructor/logging dependencies are changed in the same approved execution unit | probe URL/header/timeout/redaction behavior changes, subtitle delivery policy changes, player/UI scope appears, or coordinator becomes generic debug utility | resolver no longer owns subtitle debug candidate selection/probe scheduling; existing probe behavior and redacted contexts preserved; targeted tests pass | `serial_only` | Shares resolver/logging seams with S1 and must not run before typed policy injection is stable. |
| `DCR-8-S3` | Move universal transcode decision request conversion, fetch, timeout, and parse logic out of `PlexStreamResolver` into a focused stream-local decision client while keeping the public resolver method as a delegating contract. | `src/modules/plex/stream/PlexStreamResolver.ts`, new `src/modules/plex/stream/*UniversalTranscodeDecision*.ts` collaborator, `src/modules/plex/stream/interfaces.ts` only for narrow typed ports if needed, `plexStreamUrlPolicy.ts` only for existing URL-policy types, resolver/debug manager tests. | `DCR-8-A2` | `npm test -- --runInBand src/modules/plex/stream/__tests__/PlexStreamResolver.test.ts src/modules/debug/__tests__/NowPlayingDebugManager.test.ts`; `npm run typecheck`; source audit for unchanged decision shape and no token exposure. | after S1; parallel with S2 only if controller proves disjoint writes, disjoint verification, and one integration gate | public resolver method changes, server decision shape changes, auth failure mapping/timeout changes, token-bearing decision URL/log exposure appears, or URL policy moves outside stream ownership | `fetchUniversalTranscodeDecision` remains on `IPlexStreamResolver` and delegates; focused decision client owns fetch/parse; debug manager behavior preserved; tests/typecheck pass | `parallel_group: after-S1-disjoint-candidate` | Candidate only after S1. It may be parallel with S2 only if S2 does not touch `interfaces.ts`, shared resolver regions, shared test helpers, or shared verification surfaces. |

`coverage_check`:

- `DCR-8-A1` -> `DCR-8-S2`
- `DCR-8-A2` -> `DCR-8-S3`
- `DCR-8-A3` -> `DCR-8-S1`
- `DCR-8-D1` -> `DCR-8-S1` exactly once. Final owner:
  pre-implementation ownership/accounting in S1, which codifies typed
  policy-reader dependencies, the subtitle-debug logging port, the S2 debug
  subtitle probing owner, and the S3 universal decision fetch/parse owner
  before any S2/S3 implementation starts.

Accepted residual:

- Plex token redaction/security remains acceptable and protected. It is not a
  DCR-8 issue to retire, but every slice must preserve or strengthen existing
  redaction proof before closeout.

`ready_now_slice`: `DCR-8-S1`

`ready_now_execution_unit`: `DCR-8-S1`

`recommended_slice_order`:

1. `DCR-8-S1`
2. `DCR-8-S2`
3. `DCR-8-S3`

`parallel_execution_policy`: No parallel cleanup_worker execution is available
for the ready-now unit. `DCR-8-S1` is serial first. After S1, S2 and S3 remain
serial by default. The controller may approve S2/S3 parallel execution only
after proving disjoint write scopes, disjoint verification surfaces, and one
controller-owned integration gate. Because both slices likely touch
`PlexStreamResolver.ts` and `PlexStreamResolver.test.ts`, assume serial
execution unless a fresh source review proves otherwise.

## Verification Commands

Verification strategy: `new regression/contract test required`.

Primary mode: refactor-invariance with contract-first assertions around the
public resolver contract, typed dependency injection, debug-probe redaction, and
universal decision fetch/parse. Existing coverage is substantial, but DCR-8
changes constructor ownership and extracts production debug/fetch behavior from
a playback hotspot, so targeted tests must be added or tightened where existing
tests only cover inline behavior.

Planner verification after creating or revising this active plan:

```sh
npm run plans:check
```

Expected result: the active plan conforms to the serious tracked plan standard.

S1 targeted verification:

```sh
npm test -- --runInBand src/modules/plex/stream/__tests__/PlexStreamResolver.test.ts src/modules/plex/stream/__tests__/PlexStreamResolver.subtitle-errors.test.ts src/__tests__/orchestrator/orchestrator-module-factory-wiring.test.ts
```

Expected result: resolver behavior and production config wiring pass with typed
policy readers plus the typed subtitle-debug logging port.

```sh
npm run typecheck
```

Expected result: TypeScript passes after `PlexStreamResolverConfig` and wiring
changes.

S1 source audit:

```sh
rg -n "new (AudioSettingsStore|PlaybackSettingsStore|DeveloperSettingsStore|SubtitleDebugLogger)" src/modules/plex/stream/PlexStreamResolver.ts
```

Expected result: no direct settings/debug store or logger construction remains
in `PlexStreamResolver.ts`.

If S1 adds a stream-local subtitle debug log-port adapter, also inspect any
remaining `SubtitleDebugLogger` construction:

```sh
rg -n "new SubtitleDebugLogger" src/modules/plex/stream
```

Expected result: the only stream-local `SubtitleDebugLogger` construction, if
any, is inside the approved narrow subtitle debug log-port adapter and uses the
typed `subtitleDebugPolicyReader`. Any construction in `PlexStreamResolver.ts`,
or any adapter that reads storage directly, is a replan trigger.

S2 targeted verification:

```sh
npm test -- --runInBand src/modules/plex/stream/__tests__/PlexStreamResolver.test.ts src/modules/plex/stream/__tests__/SubtitleStreamProbe.test.ts src/modules/plex/stream/__tests__/SubtitleStreamProbeSupport.test.ts
```

Expected result: resolver behavior, debug probe scheduling, request options,
timeouts, key fallback, and redacted probe contexts pass.

S3 targeted verification:

```sh
npm test -- --runInBand src/modules/plex/stream/__tests__/PlexStreamResolver.test.ts src/modules/debug/__tests__/NowPlayingDebugManager.test.ts
```

Expected result: public `fetchUniversalTranscodeDecision` behavior, server
decision parsing, auth failure mapping, timeout use, and debug HUD/snapshot
consumer behavior pass.

Token/redaction source audit after every implementation unit:

```sh
rg -n "X-Plex-Token|access_token|Authorization|subtitleStreamKey|token-bearing|auth header" src/modules/plex/stream src/modules/debug/NowPlayingDebugManager.ts
```

Expected result: any token-bearing source occurrences are either required
request construction/test inputs or explicitly redacted log/debug/error
contexts. No new raw token, auth header value, token-bearing URL, or subtitle
stream key is logged or snapshotted.

Final package verification before checklist closeout:

```sh
npm run verify
```

Expected result: full repo verification passes because this is Plex stream
playback work.

Closeout verification/document check:

```sh
npm run plans:check
```

Expected result: active plan state remains conformant until the controller
archives or marks this plan superseded/completed.

## Rollback Notes

If playback parity, token redaction, or public resolver behavior regresses,
rollback the current implementation unit as a whole rather than adding a
compatibility branch. The safe rollback boundary is the slice commit for S1,
S2, or S3. Keep active plan docs out of implementation commits so source
rollback does not discard controller state.

If S1 config injection fails, restore the previous constructor wiring and
replan the typed policy-reader/logging-port seam before attempting S2 or S3. If
S2 or S3 regresses behavior, remove the new collaborator and restore
resolver-owned inline behavior for that slice, then replan a narrower
extraction.

## Commit Checkpoints

- Planner pass: do not stage or commit this active plan unless the controller
  explicitly requests a tracked-doc commit.
- Implementation checkpoint 1: after `DCR-8-S1`, commit only source/test files
  for typed policy-reader injection, subtitle-debug logging-port injection, and
  production/test wiring, excluding active `docs/plans/*`.
- Implementation checkpoint 2: after `DCR-8-S2`, commit only source/test files
  for debug subtitle probe ownership extraction, excluding active
  `docs/plans/*`.
- Implementation checkpoint 3: after `DCR-8-S3`, commit only source/test files
  for universal decision fetch/parse ownership extraction, excluding active
  `docs/plans/*`.
- Closeout checkpoint: after clean implementation review and final
  verification, update `ARCHITECTURE_CLEANUP_CHECKLIST.md` and any required
  current-state/API docs in a separate tracked-doc pass.

MODEL_SUGGESTION
PLANNER: n/a
IMPLEMENTER: GPT-5 Codex high reasoning or tracked `cleanup_worker` default
REVIEWER: GPT-5 Codex high reasoning or tracked `reviewer` default
WHY: Tier 3 checklist-linked Plex hotspot cleanup with multiple repo-local
boundary skills, public contract preservation, token-redaction constraints, and
composition-root wiring risk.

```text
NEXT_SESSION_HANDOFF
NEXT_SESSION_LAUNCHER: lineup-cleanup-review
TASK: DCR-8 Plex Stream Resolver Ownership Cleanup plan review
TASK_FAMILY: cleanup/refactor
TIER: Tier 3
PLAN: docs/plans/2026-04-30-dcr-8-plex-stream-resolver-ownership-cleanup.md
ARTIFACT: active tracked plan
FILES:
- docs/plans/2026-04-30-dcr-8-plex-stream-resolver-ownership-cleanup.md
- ARCHITECTURE_CLEANUP_CHECKLIST.md
- src/modules/plex/stream/PlexStreamResolver.ts
- src/modules/plex/stream/interfaces.ts
- src/core/orchestrator/OrchestratorModuleFactory.ts
BLOCKERS: none known before plan review
MESSAGE:
Review the active DCR-8 plan for implementation readiness. Enforce Universal Plan Core plus Cleanup Overlay, verify DCR-8-D1 is fully resolved before implementation, and block on any public IPlexStreamResolver, token redaction, package coverage, or parallelism ambiguity.
```
