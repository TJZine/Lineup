# FCP-5 Portability Readiness Audit

Date: 2026-04-29

Checklist token: `FCP-5`

Task family: cleanup/refactor

Cleanup subtype: checklist-linked

This audit is source-backed only. It does not use Desloppify output, imported issue ids, score deltas, package maps, or generated task queues for intake, proof, prioritization, or closure.

## Discovery And Tool Fallback

Codanna is preferred by `docs/AGENTIC_DEV_WORKFLOW.md` and `docs/agentic/codanna-playbook.md`, but no Codanna MCP tools were exposed in this controller session. Deterministic fallback used `rg` and direct reads.

Fallback query coverage:

- `rg -n "webOS|webos|PalmSystem|webOSTV|luna|platform|Platform" src docs --glob '!docs/archive/**'`
- `rg -n "localStorage|sessionStorage|indexedDB|cookie|Storage|storage" src --glob '!**/__tests__/**'`
- `rg -n "\bfetch\b|XMLHttpRequest|WebSocket|EventSource|AbortController|AbortSignal|X-Plex-Token|token" src --glob '!**/__tests__/**'`
- `rg -n "fullscreen|requestFullscreen|exitFullscreen|webkit|mozFullScreen|HTMLVideoElement|video\.|\.play\(|\.pause\(|load\(|controls|srcObject" src --glob '!**/__tests__/**'`
- `rg -n "window\.|document\.|navigator\.|performance\.|location\.|addEventListener\(|removeEventListener\(|beforeunload|visibilitychange|pagehide|online|offline|webOSRelaunch|close\(|reload\(" src --glob '!**/__tests__/**'`
- `rg -n "\bfs\b|node:fs|path\.|process\.|require\(|electron|ipcRenderer|FileSystem|showOpenFilePicker|file://|download|Blob|URL\.createObjectURL" src package.json vite.config.* --glob '!**/__tests__/**'`
- `rg -n "innerHTML|outerHTML|insertAdjacentHTML|eval\(|new Function|dangerously|X-Plex-Token|redact|console\.(log|warn|error|info)|Authorization|Cookie" src --glob '!**/__tests__/**'`
- `rg -n "canPlayType|MediaSource|SourceBuffer|textTracks|audioTracks|subtitle|transcode|direct play|directPlay|webOS|Chrome|userAgent" src/modules/player src/modules/plex src/platform --glob '!**/__tests__/**'`
- `rg -n "\blocalStorage\.\w+|\bsessionStorage\.\w+" src --glob '!**/__tests__/**'`

Direct source reads covered the platform, lifecycle, persistence, Plex, media, networking, and app-shell files cited below.

## Audited Areas

| Area | Source coverage | Result |
| --- | --- | --- |
| webOS and platform services | `src/platform/services.ts`, `src/platform/webosPlatformServices.ts`, `src/core/app-shell/AppOrchestratorConfigFactory.ts`, platform wiring tests surfaced by `rg` | Existing platform seam is webOS-default and injectable. Keep as production invariant; future Windows/Electron work must add a real runtime service only when that port starts. |
| Browser APIs and DOM globals | `src/bootstrap.ts`, `src/App.ts`, app-shell/UI owners, navigation, player | Browser/DOM is a production runtime contract. No Node/Electron dependency was found in production source. |
| Storage APIs | `src/utils/storage.ts`, `src/modules/lifecycle/StateManager.ts`, settings/debug/Plex/scheduler stores | Most storage is behind safe helpers. Planning found `StateManager` was the only production direct-storage bypass outside `src/utils/storage.ts`; implementation commit `2f54311e` resolved it by routing lifecycle state reads/writes/cleanup through safe helpers. |
| Networking and cancellation | `src/modules/plex/auth/plexAuthTransport.ts`, `src/modules/plex/shared/fetchWithTimeout*.ts`, `src/modules/player/subtitleFallbackPipeline.ts`, `src/modules/lifecycle/LifecycleConnectivityMonitor.ts` | Production assumes browser `fetch`, `AbortController`, and targeted XHR fallback for webOS subtitle transport. This is a browser-renderer runtime contract, not a filesystem/server contract. |
| Startup, shutdown, lifecycle | `src/bootstrap.ts`, `src/modules/lifecycle/AppLifecycle.ts`, `src/platform/webosPlatformServices.ts` | Startup waits for DOM readiness; shutdown is tied to `pagehide`; lifecycle binds `visibilitychange` and webOS relaunch through `PlatformLifecycleService`. |
| Fullscreen/media behavior | `src/modules/player/VideoPlayer.ts`, `src/modules/player/SubtitleManager.ts`, `src/modules/player/AudioTrackManager.ts`, `src/modules/plex/stream/*` | No production fullscreen API dependency was found. Media behavior is native `HTMLVideoElement`, text-track/subtitle fallback, Media Session best-effort, and webOS codec policy. |
| Filesystem absence | production `src` plus `vite.config.ts` search for Node/Electron/fs/file APIs | No production filesystem or Electron IPC dependency found. Runtime blobs/Object URLs are used for subtitle/backdrop renderer behavior only. |
| Plex auth/token/connectivity | `docs/api/plex-integration.md`, `src/modules/plex/auth/*`, `src/modules/plex/discovery/*`, `src/modules/plex/library/*`, `src/modules/plex/stream/*`, `src/utils/redact.ts` | Direct Plex integration is intentional. Token-bearing headers/query params are redacted in logging paths inspected here; no P0 security finding admitted by this planning audit. |

## Source-Backed Candidates

| source_finding_id | Classification | Owner | Source proof | Disposition |
| --- | --- | --- | --- | --- |
| `FCP-5-SF1` | future-port blocker needing cleanup now | lifecycle persistence owner | Planning found `src/modules/lifecycle/StateManager.ts` directly called `localStorage.setItem`, `localStorage.getItem`, and `localStorage.removeItem` while `src/utils/storage.ts` already provided safe optional-storage helpers and current architecture says `StateManager` owns only `lineup_app_state`. Post-implementation `rg "\blocalStorage\.\w+|\bsessionStorage\.\w+" src --glob '!**/__tests__/**'` reports raw production storage calls only in `src/utils/storage.ts`. | Resolved by commit `2f54311e`: `StateManager` now uses safe helper reads/writes/removes, keeps synchronous `save/load/clear`, preserves quota cleanup-and-retry behavior, and has blocked/unavailable storage tests. |
| `FCP-5-SF2` | intentional webOS-only invariant / portable runtime port | platform owner | `src/platform/services.ts` defines injectable `PlatformServices`; `src/platform/webosPlatformServices.ts` owns key map, `webOSTV.platform.version`, UA heuristics, `webOSRelaunch`, Plex identity headers, and subtitle LAN HTTP derivation; `AppOrchestrator` accepts injected platform services. | No runtime cleanup now. Future port should add a real runtime implementation when the port exists, not an unused adapter today. |
| `FCP-5-SF3` | intentional webOS-only invariant with future-port revisit | navigation/exit UI owner | `src/modules/navigation/NavigationManager.ts` and `src/modules/ui/exit-confirm/ExitConfirmCoordinator.ts` call `window.close()` for root Back/Exit; comments identify webOS packaged app exit-to-Home behavior. | Accepted residue. Revisit only when root Back/Exit behavior is changed or a Windows/Electron runtime is planned. |
| `FCP-5-SF4` | accepted portable browser-renderer contract | Plex/player transport owners | Plex auth/library/stream code uses browser `fetch` with timeout/cancellation; subtitle fallback deliberately tries fetch, LAN HTTP rewrite, XHR, and Plex universal subtitle endpoints. `docs/development/subtitles.md` records webOS fetch/XHR quirks. | No cleanup now. Keep browser transport contract explicit; future port can supply renderer-compatible fetch/XHR or replan if it cannot. |
| `FCP-5-SF5` | accepted/no-action media contract | player and Plex stream owners | `VideoPlayer` uses native `HTMLVideoElement`, `textTracks`, `MediaMetadata`/Media Session feature checks, and no fullscreen API. Plex stream policy contains webOS codec, user-agent, and client-capability assumptions. | No cleanup now. Preserve webOS media invariants and avoid generic media adapters until a concrete port needs them. |
| `FCP-5-SF6` | accepted/no-action filesystem absence | app/runtime owner | Production source search found no `fs`, `node:fs`, Electron IPC, file picker, or runtime filesystem dependency. Blob/Object URL usage is renderer-local subtitle/backdrop behavior. | No cleanup now. Future packages must keep production runtime filesystem-free unless a new approved runtime contract says otherwise. |
| `FCP-5-SF7` | security triage / accepted no P0 | Plex/security owners | `docs/api/plex-integration.md` warns not to log Plex tokens; `src/utils/redact.ts` redacts token-bearing strings/URLs; inspected player/Plex logging paths call redaction helpers around URLs, subtitle keys, errors, and debug payloads. | No P0 admitted. Revisit if FCP-5 implementation changes auth/token storage, URL construction, logging, or debug surfaces. |

## Accepted And No-Action Areas

- Preserve the LG webOS production target stated in `docs/architecture/CURRENT_STATE.md`.
- Preserve `createWebOsPlatformServices()` as the default production platform service factory.
- Preserve `window.close()` root-exit behavior for the current webOS packaged app.
- Preserve direct Plex connectivity with no Lineup cloud backend.
- Preserve browser renderer APIs as the current runtime contract: DOM, `HTMLVideoElement`, `fetch`, `AbortController`, `XMLHttpRequest` subtitle fallback, `localStorage` through typed/safe owners, Media Session feature checks, and Blob/Object URLs.
- Preserve filesystem absence in production source.
- Preserve redaction requirements for token-bearing Plex URLs, headers, errors, and debug payloads.

## Deferred Findings

| source_finding_id | Final owner | Reason deferred | Revisit trigger |
| --- | --- | --- | --- |
| `FCP-5-SF2` | platform owner | Current default runtime is intentionally webOS. A Windows/Electron service implementation would be unused speculative infrastructure today. | A concrete Windows/Electron port plan opens, or production runtime selection stops being webOS-only. |
| `FCP-5-SF3` | navigation/exit UI owner | Root Back/Exit is correct for webOS packaged apps and is user-visible behavior. | A port plan needs non-`window.close()` exit semantics, or root Back/Exit behavior changes. |
| `FCP-5-SF4` | Plex/player transport owners | Fetch/XHR/browser-renderer transport is required for current subtitle and Plex behavior. | A future runtime cannot provide browser-compatible `fetch`/`XMLHttpRequest`, or subtitle transport policy changes. |
| `FCP-5-SF5` | player and Plex stream owners | Media policy is webOS-native and directly tied to current playback compatibility. | A concrete port needs different native media/capability contracts, or Plex stream policy changes. |
| `FCP-5-SF6` | app/runtime owner | No production filesystem dependency exists. | Any future package proposes runtime filesystem, Electron IPC, local file picker, or OS storage integration. |
| `FCP-5-SF7` | Plex/security owners | No P0 token exposure was found in this static planning audit. | Any implementation changes token storage, token-bearing URL/header construction, logging, debug surfaces, or Plex auth/connectivity behavior. |

## Proof Matrix

| source_finding_id | classification | closeout status | proof | final owner | revisit trigger |
| --- | --- | --- | --- | --- | --- |
| `FCP-5-SF1` | future-port blocker needing cleanup now | resolved by commit `2f54311e` | `StateManager` storage reads/writes/removes route through `safeLocalStorageGet`, `safeLocalStorageSetWithResult`, and `safeLocalStorageRemove`; tests cover blocked load, blocked clear, cleanup remove failures, quota retry failure, and unavailable save failure; focused tests passed (24 tests); `npm run typecheck`, `npm run verify`, `npm run verify:docs`, `git diff --check`, and raw-storage source audit passed. | lifecycle persistence owner | Reopen if lifecycle state persistence adds raw storage access outside `src/utils/storage.ts`, changes the synchronous lifecycle persistence contract, or a future runtime needs a different storage backend. |
| `FCP-5-SF2` | intentional webOS-only invariant / portable runtime port | deferred/no-action | Audit preserves the existing injectable webOS-default platform seam and does not add unused Windows/Electron services. | platform owner | A concrete Windows/Electron port plan opens, or production runtime selection stops being webOS-only. |
| `FCP-5-SF3` | intentional webOS-only invariant with future-port revisit | accepted residue | Root Back/Exit `window.close()` behavior remains unchanged and owned by navigation/exit UI for the current webOS packaged app. | navigation/exit UI owner | A port plan needs non-`window.close()` exit semantics, or root Back/Exit behavior changes. |
| `FCP-5-SF4` | accepted portable browser-renderer contract | accepted/no-action | Browser `fetch`, `AbortController`, and XHR subtitle fallback remain explicit renderer contracts; no Plex/player transport code changed. | Plex/player transport owners | A future runtime cannot provide browser-compatible `fetch`/`XMLHttpRequest`, or subtitle transport policy changes. |
| `FCP-5-SF5` | accepted/no-action media contract | accepted/no-action | Native `HTMLVideoElement`, Media Session feature checks, subtitle/text-track behavior, and webOS codec policy remain unchanged. | player and Plex stream owners | A concrete port needs different native media/capability contracts, or Plex stream policy changes. |
| `FCP-5-SF6` | accepted/no-action filesystem absence | accepted/no-action | Source audit found no production filesystem/Electron IPC dependency; implementation introduced none. | app/runtime owner | Any future package proposes runtime filesystem, Electron IPC, local file picker, or OS storage integration. |
| `FCP-5-SF7` | security triage / accepted no P0 | no P0 admitted | FCP-5 implementation did not touch token storage, token-bearing URL/header construction, logging, debug surfaces, or Plex auth/connectivity behavior. | Plex/security owners | Any implementation changes token storage, token-bearing URL/header construction, logging, debug surfaces, or Plex auth/connectivity behavior. |

## Known Uncertainty

- Codanna discovery and impact analysis could not run because Codanna MCP tools were unavailable in this controller session. This audit records the explicit `rg`/direct-read fallback and query coverage.
- This is static/source audit evidence, not device proof. It does not claim webOS-device playback, subtitle, or Plex connectivity behavior was exercised.
- This audit does not implement or design the Windows/Electron port. It only classifies assumptions that matter before such a port begins.

## Security Triage / P0 Disposition

- Planning-time disposition: `no open P0 security findings`.
- Implementation commit `2f54311e` touched only lifecycle state storage and tests. It did not touch Plex auth, token storage, token-bearing URL/header construction, logging, debug surfaces, Plex connectivity, DOM injection, media policy, filesystem APIs, or platform identity.
- Post-implementation closeout disposition remains `no open P0 security findings`.
- If any future FCP-5 revision changes token/security behavior, stop and replan with Plex/security ownership before closeout or FCP-6 work.

## FCP-5 Closeout Readiness

FCP-5 priority-exit closeout review approved completion with no blocking findings after implementation commit `2f54311e` resolved `FCP-5-SF1`.

Closeout evidence so far:

- `FCP-5-SF1` resolved by commit `2f54311e`: lifecycle `StateManager` no longer owns raw `localStorage` mechanics and instead consumes shared safe storage helpers while preserving synchronous `save/load/clear` behavior and quota cleanup-and-retry.
- Focused `StateManager` tests passed: `npm run test -- --runTestsByPath src/modules/lifecycle/__tests__/StateManager.test.ts` (24 tests).
- `npm run typecheck` passed.
- `npm run verify` passed, including full coverage tests, tools tests, contracts, docs verification, and Vite build.
- `npm run verify:docs` passed before planning review and again as part of `npm run verify`.
- Final post-completion `npm run verify:docs` passed before the closeout documentation commit.
- Raw storage source audit passed: `rg -n "\blocalStorage\.\w+|\bsessionStorage\.\w+" src --glob '!**/__tests__/**'` now reports raw production storage calls only in `src/utils/storage.ts`.
- `git diff --check` passed.
- Fresh implementation review approved `FCP-5-S1` with no material findings.
- Fresh FCP-5 priority-exit closeout review found no blocking findings and approved marking FCP-5 completed after checklist/plan status updates and final docs verification.
- Deferred/no-action records for `FCP-5-SF2` through `FCP-5-SF7` remain owned above with single final owners and revisit triggers.
- FCP-6 remains blocked from actual work until its own cleanup-loop scope-load, source-backed audit, execution-grade plan, and clean plan review begin in a later session.

## Future Package Rule

Any future FCP-5 package, FCP-5 closeout revision, or later portability-related package must update this audit when it is planned and again when it closes if it changes, retires, accepts, or defers any listed `source_finding_id`, or if it discovers a new production platform-bound assumption.
