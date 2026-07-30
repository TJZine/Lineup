# QA-021 Plex Home PMS Token Investigation

- Status: `REMEDIATED — AUTOMATION, MANAGED-PROFILE, AND SERVER-RECOVERY BROWSER PROOF GREEN`
- Date: 2026-07-16
- Final browser validation: 2026-07-20
- Task family: high-risk Plex integration / credential-boundary correction
- Runtime target: Lineup at `http://127.0.0.1:5173/`, measured `1920x1080`
- Public contract: [Plex integration](../../api/plex-integration.md)

## Summary

Before remediation, Lineup could authenticate the owning Plex account and switch
into Plex Home managed profiles, but Ari and Tina received a PMS `401` when Lineup
requested Ultra CC's libraries. The admin profile worked.

The live failure was initially classified as a cloud-valid profile lacking access to
the selected server. That recovery classification is useful only after PMS receives
the correct server credential. At investigation time, Lineup did not satisfy that
precondition: it discarded the per-server `accessToken` returned by Plex resource
discovery and sent the active Plex.tv Home-user token to PMS instead.

Plex documents these as different credential layers. A Plex.tv user token is used to
request `/api/v2/resources`; each resource contains the `accessToken` used to
communicate with that PMS instance. Plezy independently implements the same boundary
and explicitly avoids substituting a Plex Home user token for a distinct server
token.

This is a root-cause correction to QA-021, not a new unrelated QA item. QA-022's
runtime auth-resume remediation remains independently valid. QA-023 and QA-024 stay
out of scope unless the implementation necessarily touches their owner seams.

## Remediation Progress

Source remediation now keeps Plex.tv account/Home credentials at the cloud boundary,
retains each resource's opaque PMS token in discovery-owned memory, and wires PMS
identity, library, image, stream, playback, and resource-URL consumers to the selected
server credential. PMS `401` recovery performs at most one active-profile resource
refresh and one retry, with profile/server/token supersession and typed transport
failures preserved. Token-bearing discovery state remains internal; `serverChange`
emits a token-free projection.

The managed-profile integration proof now uses distinct synthetic account, Home-user,
and PMS resource tokens. The final focused discovery/library/stream proof passed 41
suites / 726 tests; the broader auth, selection, initialization, recovery, and
orchestrator proof passed 74 suites / 1,322 tests. The complete `npm run verify`
passed 348 suites / 4,486 tests plus typecheck, lint, maintainability, tools,
contracts, docs, bundle, and build gates before the final review correction.

Independent review found and then cleared one P1 privacy issue: selection now passes
a token-free server view through the public connection-probe seam while discovery
privately resolves the matching PMS token by server id. Post-fix typecheck, lint, and
the focused discovery/integration proof passed 2 suites / 101 tests. The post-fix
complete `npm run verify` rerun also passed 348 suites / 4,486 tests and every
non-Jest gate. The source/review phase is green; the guarded browser proof below is
also complete.

The later clear-server recovery investigation produced four isolated runtime commits:
`b65784d1`, `cef646c9`, `dceab3e6`, and `89c999ab`. They make clear/reselection
coherent, preserve redacted recovery causality, allow validation-owned credential
metadata refresh without weakening token/user/profile/server identity proof, and
prevent cached Channel Setup navigation from cancelling its own committed selection.
Each changed owner received independent review. The final complete `npm run verify`
passed 348 suites / 4,515 tests plus every tool, contract, documentation, bundle, and
build gate. A fresh focused current-state audit then passed 15 suites / 685 tests
covering Plex auth, resource discovery, selected-server scope, library authorization,
stream authorization, initialization/auth resume, recovery actions, composition
wiring, and Orchestrator behavior.

## Runtime Evidence

After a clean Vite restart that preserved browser storage:

- the replacement browser tab measured `1492x1996`, DPR `1`, before calibration;
- the documented `960x540` override produced measured `1920x1080`, DPR `0.5`;
- Tina was the active Plex Home profile;
- Plex cloud validation succeeded for Tina's active credential;
- discovery returned both Ultra CC and Tristan's PC;
- Ultra CC was selected and reachable;
- PMS `/library/sections` returned `401`;
- Lineup showed `This Plex profile cannot access the selected server` with
  `Switch Profile` and `Select Server`;
- no destructive saved-data clear, sign-out, relink, or channel build occurred.

The same Ultra CC library failure was previously reproduced with Ari. The account
admin profile can load the server, so this is profile/token-path specific rather than
a general server outage.

After the final green automation run and independent review, the guarded browser was
reclaimed again. With no user tab available to claim, one replacement Lineup tab was
opened against the already-running local app. Its natural capture again measured
`1492x1996`; the `960x540` viewport override produced a measured CSS viewport of
`1920x1080` at DPR `0.5`. The tab was parked at the existing Channel Setup step with
4 of 4 libraries selected. No navigation control, library selection, auth control,
relink, channel build, or saved state was changed. Action-time relink confirmation is
the next required checkpoint in that evidence snapshot.

Final guarded validation completed on 2026-07-20 after explicit action-time approval:

- the stopped Vite dev server was restarted from the preserved dirty worktree without
  a production build, saved-data clear, or saved-server clear;
- the reclaimed tab's natural viewport measured `1798x1996`, DPR `1`, and the
  documented `960x540` override again produced `1920x1080`, DPR `0.5`;
- Lineup signed out once and requested one Plex link; the human completed the
  QR/`plex.tv/link` step without exposing the one-time code;
- after Plex approved the link, QA-022 resumed automatically from the auth screen to
  `Who's watching?` without a reload, duplicate PIN request, or second sign-in;
- Ari selected Ultra CC and loaded Channel Setup with 5 of 5 accessible libraries,
  including Anime, with no auth-required or profile/server access-denied result;
- Lineup returned to the profile picker without another sign-in; Tina then discovered
  and connected to Ultra CC and loaded Channel Setup with 4 of 4 accessible libraries,
  again with no auth-required or profile/server access-denied result;
- both Channel Setup visits were exited with `Back`; no channel build, replacement,
  or library-selection change occurred;
- the browser was left with Tina active and Ultra CC connected, and no credential
  value was read, logged, copied, or included in this report.

After the recovery commits and their final automation/review gates, the exact
clear/reselection regression was exercised separately without another sign-in,
relink, profile switch, saved-data clear, channel build, or channel replacement:

- the existing Vite server was still live and returned the app without a restart;
- the natural viewport measured `1798x1996`, DPR `1`, before the documented
  `960x540` override produced measured `1920x1080`, DPR `0.5`;
- Tristan's PC first loaded Channel Setup, warming the lazy screen;
- Lineup returned to server selection, cleared only the saved selected server, and
  selected Tristan's PC again;
- the cached-screen reselection returned to Channel Setup with both accessible
  libraries loaded (245 movies and 108 series / 3,042 episodes);
- no quarantine, lifecycle-transition, recovery-overlay, or related warning/error
  occurred after the final fix.

This later regression intentionally left the local server selected for recovery QA;
it did not repeat or invalidate the earlier Ari/Tina Ultra CC token-boundary proof.

## External Protocol Evidence

### Plex

The official [Plex Media Server API documentation](https://developer.plex.tv/pms/)
states that after obtaining a token for plex.tv, a client obtains a different set of
tokens for PMS instances by calling `/api/v2/resources`. The resource response
contains each PMS instance's `accessToken` and its connection URLs.

Required implication for Lineup:

- account/Home-user token: plex.tv auth, Home switching, user validation, and
  resource discovery;
- resource `accessToken`: identity probes and all requests to that specific PMS.

Equality between these token values is not a supported invariant and must never be
assumed.

### Plezy Reference Implementation

Reference repository: [edde746/plezy](https://github.com/edde746/plezy), inspected at
commit `fa901be3283cbc8a394d0c037fc127765bdfb7a8`.

- [Plex resource discovery](https://github.com/edde746/plezy/blob/fa901be3283cbc8a394d0c037fc127765bdfb7a8/lib/services/plex_auth_service.dart#L208-L226)
  calls `/resources` with the active user token and parses each server resource.
- [Plex server parsing](https://github.com/edde746/plezy/blob/fa901be3283cbc8a394d0c037fc127765bdfb7a8/lib/services/plex_auth_service.dart#L332-L389)
  requires and retains the resource's `accessToken`.
- [Plex Home cached-token policy](https://github.com/edde746/plezy/blob/fa901be3283cbc8a394d0c037fc127765bdfb7a8/lib/profiles/active_profile_binder.dart#L749-L768)
  documents that resource tokens are user-scoped and that replacing a distinct PMS
  token with the Home-user token produces `401` on shared servers.

Plezy is GPL-3.0. Use it only as protocol and architecture evidence; do not copy its
implementation.

## Pre-remediation Lineup Source Evidence

The following source snapshot records the defect as it existed when this
investigation began. It is superseded by the remediation and verification evidence
above.

### Discovery dropped the PMS credential

At investigation time, `src/modules/plex/discovery/types.ts` defined
`PlexApiResource` and `PlexServer` without an `accessToken` field.

`src/modules/plex/discovery/PlexServerDiscovery.ts::_parseResources()` retained the
server id, ownership metadata, capabilities, and connections but discarded the
resource `accessToken`.

### PMS consumers received the Plex.tv credential

`src/core/orchestrator/assembly/OrchestratorModuleFactory.ts` originally wired
`PlexLibrary.getAuthHeaders()` and `getAuthToken()` directly to `PlexAuth`. The
captured library request scope therefore carried the active account/Home-user token,
not the selected server's resource token.

Discovery connection probes also used `PlexAuth.getAuthHeaders()`, so the same wrong
credential could reach PMS `/identity` before library loading.

Stream, image, playback, and other PMS consumers required the same audit; the
completed remediation covers those consumers rather than fixing
`/library/sections` alone.

### The focused integration test encoded the defect

`src/modules/plex/library/__tests__/PlexManagedProfileAuthorizationIntegration.test.ts`
initially:

- returns a `/resources` fixture with no `accessToken`;
- asserts the managed Plex.tv token is sent to PMS `/identity`;
- asserts the same managed token is sent to PMS `/library/sections`.

That test proved the then-implemented path but not the Plex contract. It was rewritten
with three distinct opaque fixtures:

1. owning account token;
2. active Plex Home user token;
3. Ultra CC resource/PMS access token.

No fixture or production credential value may appear in logs, messages, screenshots,
or failure context.

## Root-Cause Statement

Initial high-confidence root cause:

> Lineup conflated the Plex.tv account/Home-user credential with the per-resource PMS
> credential. Resource discovery dropped `accessToken`, so selection, identity,
> library, and downstream PMS requests used the Home-user token.
> Shared/profile-scoped servers could reject that token with `401` even while Plex
> cloud correctly validated it.

The admin profile likely works because an owned-server account token is also accepted
by that PMS or matches its resource credential. This is an inference, not an invariant
to encode.

The initial `profile_server_access_denied` browser result was therefore not proof that
Tina lacked Ultra CC permission. It proved only that PMS rejected the credential
Lineup sent at that time.

## Decision-Complete Remediation Boundary

### Ownership

- `PlexAuth` continues to own account and active Plex Home cloud credentials.
- `PlexServerDiscovery` owns resource parsing, per-server PMS access tokens, selected
  server/connection state, token refresh, and token-aware selection snapshots.
- PMS consumers obtain headers/token from the selected discovery-owned server scope.
- `PlexLibraryRequestClient` retains PMS response classification and bounded recovery.
- `AppOrchestrator` wires owners and maps sanitized outcomes; it must not choose tokens.

### Required contract changes

1. Add the opaque resource credential to `PlexApiResource` and `PlexServer`.
2. Preserve it through resource normalization, parsing, cloning, selected-server
   snapshots, selection rollback, and profile/server supersession.
3. Expose a discovery-owned selected-server auth-header/token seam for PMS consumers.
4. Use that seam for PMS identity probes, library, images, stream resolution,
   playback URLs, and any other server endpoint.
5. Continue using the active Home/account token for plex.tv endpoints only.
6. Refresh resources under the active profile after a profile switch; never reuse a
   resource token captured under another profile.
7. Keep resource tokens in memory by default. Do not add browser-storage persistence
   without a separate persistence-boundary decision and migration/cleanup design.

### Bounded PMS `401` policy

For a PMS `401`:

1. If the request scope is no longer the current profile/server/resource-token scope,
   return the existing supersession outcome and emit nothing.
2. Refresh plex.tv resources once under the active cloud credential.
3. If the selected server returns a different PMS access token, update the selected
   discovery scope and retry the PMS request exactly once.
4. If the current PMS token is unchanged and Plex cloud says the active credential is
   valid, classify `profile_server_access_denied`.
5. If a managed credential is invalid while the account credential remains valid,
   classify `managed_profile_auth_invalid`.
6. If the owning account credential is invalid, classify `account_auth_expired`.
7. If resource refresh or cloud classification times out, is rate-limited, or fails,
   preserve its typed transport outcome; do not guess access or auth expiry.

Do not add repeated retries, main-account fallback, cross-profile token reuse, or a
rule that treats every managed-profile `401` as access denied.

## Required Automated Proof

### Primary integration flow

Use mocked Plex cloud and PMS responses with distinct opaque tokens to prove:

- `switchHomeUser` sends the account token to plex.tv and stores the returned Home
  user token;
- stored validation uses the Home user token;
- `/resources` receives the Home user token;
- the Ultra CC resource contains a distinct PMS access token;
- `/identity` receives only the Ultra CC PMS token;
- the immutable library scope captures that PMS token;
- `/library/sections` receives only that PMS token;
- no token appears in logs, thrown messages, event payloads, or error context.

### Classification matrix

Add focused tests for:

1. Correct PMS token succeeds for a managed profile.
2. Stale PMS token receives `401`; one resource refresh returns a new token; one retry
   succeeds.
3. Current PMS token receives `401`; resource token remains unchanged; cloud-valid
   profile maps to profile/server access denial.
4. Managed Home credential invalid + account valid maps to profile re-selection.
5. Account credential invalid maps to runtime Sign In.
6. Resource refresh timeout, `429`, and `5xx` remain typed and emit no auth/access
   conclusion.
7. Profile or server supersession during resource refresh/retry suppresses stale
   callbacks, cache writes, selection writes, and retries.
8. Admin/owned-server success does not assume its cloud and PMS tokens are equal.

### Regression coverage

Preserve:

- QA-022's runtime `AUTH_EXPIRED -> Sign In -> successful PIN -> exactly-once startup
  resume` proof;
- startup-originated auth, cancellation, retry, and supersession;
- AuthScreen presentation-only ownership;
- selected-server rollback and profile-scoped storage namespaces;
- existing token redaction guarantees.

## Verification And Review

Run:

1. focused Plex auth, discovery, selected-server, library scope, library transport,
   stream, initialization, recovery, and orchestrator tests;
2. `npm run verify`;
3. `git diff --check`;
4. a complete dirty-worktree-aware diff audit;
5. one independent final review covering the full changed Plex owner(s) and any
   composition-root/hotspot edits.

Only after automated proof and review are green:

1. reopen or reclaim the in-app browser;
2. measure its natural viewport before applying calibration;
3. calibrate to measured `1920x1080` when needed;
4. request action-time confirmation for one Plex relink;
5. verify QA-022 resumes automatically after successful PIN linking;
6. test Ari and Tina against Ultra CC without repeated sign-ins;
7. confirm both load libraries using the correct selected-server credential.

Browser proof does not replace simulator or physical-TV proof.

## Mutation Guard And Non-Goals

- Preserve the dirty worktree and the uncommitted QA-019 plus current QA-021/022 work.
- Inspect current `git status --short` before edits; do not infer ownership from this
  report alone.
- Do not clear saved data or saved server state.
- Do not sign out, relink, build, or replace channels without action-time approval.
- Do not expose or log credentials.
- Do not implement QA-023 or QA-024 unless a necessary changed seam makes separation
  impossible; document that decision before expanding scope.
- Do not copy Plezy source code.

## New-Task Entry Point

Start with this report, then inspect current source and the dirty worktree as
authoritative. Reproduce the existing integration test's incorrect token flow before
editing. The first implementation decision is the discovery-owned selected-server
credential contract; do not patch individual PMS callers before that owner seam is
settled.
