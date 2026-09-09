# Plex Integration API

> [!CAUTION]
> Never log or expose Plex tokens or URLs containing `X-Plex-Token`. Use the redaction utilities in `src/utils/` when logging URLs.

## Architecture

Lineup does not have a single unified Plex API class. Each Plex concern is owned by a separate module with its own interface:

| Interface | Source | Concern |
|-----------|--------|---------|
| `IPlexAuth` | `src/modules/plex/auth/interfaces.ts` | OAuth PIN flow, token management |
| `IPlexServerDiscovery` | `src/modules/plex/discovery/interfaces.ts` | Server discovery, connection testing, selection |
| `IPlexLibrary` | `src/modules/plex/library/interfaces.ts` | Library browsing, metadata, search |
| `IPlexStreamResolver` | `src/modules/plex/stream/contracts/interfaces.ts` | Stream URL resolution, transcode sessions |

These are composed at the application composition root, not through interface inheritance.

## Authentication (`IPlexAuth`)

Pin-based OAuth flow for TV devices. Supports Plex Home user switching.

```typescript
type PlexCurrentCredentialValidity =
  | { kind: 'active_valid' }
  | { kind: 'managed_profile_invalid'; accountValid: true }
  | { kind: 'account_expired' }
  | { kind: 'superseded' };

interface IPlexAuth {
  requestPin(options?: { signal?: AbortSignal | null }): Promise<PlexPinRequest>;
  checkPinStatus(pinId: number, options?: { signal?: AbortSignal | null }): Promise<PlexPinRequest>;
  cancelPin(pinId: number): Promise<void>;
  pollForPin(pinId: number, options?: { signal?: AbortSignal | null }): Promise<PlexPinRequest>;
  validateToken(token: string, options?: { signal?: AbortSignal | null }): Promise<boolean>;
  validateStoredCredentials(options?: {
    signal?: AbortSignal | null;
  }): Promise<PlexStoredCredentialsValidationResult>;
  probeCurrentCredentialValidity(options?: {
    signal?: AbortSignal | null;
  }): Promise<PlexCurrentCredentialValidity>;
  getHomeUsers(options?: { signal?: AbortSignal | null }): Promise<PlexHomeUser[]>;
  switchHomeUser(userId: string, options?: { pin?: string | null; signal?: AbortSignal | null }): Promise<void>;
  getActiveUserId(): string | null;
  getAccountUserId(): string | null;
  logoutActiveUser(): Promise<void>;
  readStoredCredentialsAndClearCorruption(): PlexStoredCredentialsReadResult;
  storeCredentials(auth: PlexAuthData, options?: { emitAuthChange?: boolean }): void;
  clearCredentials(): void;
  isAuthenticated(): boolean;
  getCurrentUser(): PlexAuthToken | null;
  // Plex.tv account/Home credential headers; PMS callers use discovery-owned resource headers.
  getAuthHeaders(): Record<string, string>;
  on(event: 'authChange', handler: (isAuthenticated: boolean) => void): IDisposable;
  on(event: 'profileChange', handler: (payload: { fromUserId: string | null; toUserId: string }) => void): IDisposable;
}
```

Stored-credentials reads distinguish `missing`, `available`, and `corrupted`. Corrupted payloads are cleared by `PlexAuth` and surfaced distinctly from first-run missing state. The stored-credential read/write/clear methods are synchronous local storage and in-memory state operations; they do not imply an async persistence backend.

PIN and credential-capable auth operations use a private monotonic authority owned by `PlexAuth`: the latest-started operation wins. Authority is acquired synchronously before caller-abort observation, so a newer pre-aborted or remotely failing invocation still permanently supersedes older work. `cancelPin()` invalidates only the matching PIN operation. Public `storeCredentials()` and `clearCredentials()` are synchronous authorities; `{ emitAuthChange: false }` suppresses notification only.

`validateStoredCredentials()` owns the stored read, active/account fallback probes, validated credential reconstruction, and conditional commit as one transaction. Its tagged result includes an opaque guard whose `assertCurrent()` and read-only signal protect the remainder of that startup pass without exposing a counter or commit capability. Superseded work is a dedicated auth-local outcome, not invalid credentials and not recoverable pending-auth routing.

Stored-token validation reuses the persisted username and email only when Plex omits
those account-style fields from an otherwise valid managed-profile response. A
distinct managed-profile token preserves its stored Plex Home `activeUserId` scope
across validation; an account-active token adopts the freshly validated account id.

PIN, profile-switch, and main-account logout success is fixed immediately after the guarded credential commit and before the first synchronous success event. Listener re-entry may supersede the operation and suppress later notifications, but cannot reject the committed result. `logoutActiveUser()` acquires authority even when no account exists; that path is a mutation-free successful no-op that still supersedes older work. Normal account-present notification order remains `authChange` then `profileChange`.

Caller-provided cancellation signals on `requestPin()`, `checkPinStatus()`, `pollForPin()`, `validateToken()`, `getHomeUsers()`, and `switchHomeUser()` rethrow the caller's raw `AbortError` or abort reason so callers can distinguish explicit cancellation from Plex failures. `cancelPin()` remains the normal best-effort PIN cancellation API.

`PlexAuthConfig.clientIdentifier` is resolved once at config assembly (`createDefaultPlexAuthConfig`) and treated as already-resolved input by `PlexAuth`.
Canonical Plex identity metadata and identity-header assembly live in `src/modules/plex/auth/config.ts`; auth transport, platform identity, and stream callers consume or adapt those values instead of generating independent product/device metadata.
`validateToken()` returns `false` only for explicit auth-invalid (`401`/`403`) outcomes. Timeout, service/network failures, and malformed success payloads throw typed `PlexApiError` failures; caller-triggered aborts are rethrown as raw aborts instead.
`probeCurrentCredentialValidity()` is a read-only, race-aware cloud probe for PMS
authorization classification. It does not acquire credential authority or expose
tokens. It distinguishes a valid active credential, an invalid managed credential
whose account credential remains valid, genuine account expiry, and concurrent
credential supersession.
Plex cloud `5xx` responses surface as retryable `SERVER_ERROR` failures; transport-level failures that do not produce an HTTP response remain server/network reachability failures.
`getHomeUsers()` and `switchHomeUser()` throw typed auth failures for explicit credential problems instead of collapsing those outcomes into empty profile lists.
`PlexHomeUser.restricted` is informational-only metadata in profile select UI and does not enforce startup or playback gating.

## Library Access (`IPlexLibrary`)

Retrieving content metadata. Supports libraries, collections, playlists, TV show hierarchy, tag directories, and search.

```typescript
type PlexTagDirectoryUnsupportedReason = 'unavailable' | 'empty';

type PlexLibraryRequestIntent = 'preview' | 'background';

class PlexLibraryScopeSupersededError extends Error {}

function isPlexLibraryScopeSupersededError(
  error: unknown
): error is PlexLibraryScopeSupersededError;

interface PlexTagDirectoryQueryOptions {
  type: number;
  signal?: AbortSignal | null;
  onUnsupported?: (reason: PlexTagDirectoryUnsupportedReason) => void;
  requireEntries?: boolean;
  requestIntent?: PlexLibraryRequestIntent;
}

type PlexLibraryAuthorizationFailure =
  | { kind: 'account_auth_expired' }
  | { kind: 'managed_profile_auth_invalid' }
  | { kind: 'profile_server_access_denied' };

interface PlexLibraryEvents {
  authorizationFailure: PlexLibraryAuthorizationFailure;
  libraryRefreshed: { libraryId: string };
}

interface IPlexLibrary {
  getLibraries(options?: {
    signal?: AbortSignal | null;
    includeItemCounts?: boolean;
    itemCountConcurrency?: number;
  }): Promise<PlexLibrarySection[]>;

  getLibrary(
    libraryId: string,
    options?: { signal?: AbortSignal | null }
  ): Promise<PlexLibrarySection | null>;

  getLibraryItems(libraryId: string, options?: LibraryQueryOptions): Promise<PlexMediaItem[]>;

  getLibraryItemCount(libraryId: string, options?: LibraryQueryOptions): Promise<number | null>;

  getItem(ratingKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItem | null>;

  getShows(libraryId: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItem[]>;

  getShowSeasons(showKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexSeason[]>;

  getSeasonEpisodes(seasonKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItem[]>;

  getShowEpisodes(showKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItem[]>;

  search(query: string, options?: SearchOptions): Promise<PlexMediaItem[]>;

  getCollections(libraryId: string, options?: {
    signal?: AbortSignal | null;
    requestIntent?: PlexLibraryRequestIntent;
  }): Promise<PlexCollection[]>;

  getCollectionItems(collectionKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItem[]>;

  getPlaylists(options?: {
    signal?: AbortSignal | null;
    requestIntent?: PlexLibraryRequestIntent;
  }): Promise<PlexPlaylist[]>;

  getPlaylistItems(playlistKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItem[]>;

  getActors(libraryId: string, options: PlexTagDirectoryQueryOptions): Promise<PlexTagDirectoryItem[]>;

  getStudios(libraryId: string, options: PlexTagDirectoryQueryOptions): Promise<PlexTagDirectoryItem[]>;

  getGenres(libraryId: string, options: PlexTagDirectoryQueryOptions): Promise<PlexTagDirectoryItem[]>;

  getDirectors(libraryId: string, options: PlexTagDirectoryQueryOptions): Promise<PlexTagDirectoryItem[]>;

  getYears(libraryId: string, options: PlexTagDirectoryQueryOptions): Promise<PlexTagDirectoryItem[]>;

  getImageUrl(imagePath: string, width?: number, height?: number): string | null;

  refreshLibrary(libraryId: string): Promise<void>;

  on<K extends keyof PlexLibraryEvents>(
    event: K,
    handler: (payload: PlexLibraryEvents[K]) => void
  ): IDisposable;

  off<K extends keyof PlexLibraryEvents>(
    event: K,
    handler: (payload: PlexLibraryEvents[K]) => void
  ): void;
}
```

`getLibrary()` returns `null` only when the id is not present in a valid fetched section list. Unavailable or malformed section-list fetches throw `PlexLibraryError`.
Across the rest of the library surface, `null` and empty arrays are reserved for real Plex not-found or empty-success outcomes such as `404` item lookups, empty metadata lists, or unsupported tag directories. Malformed payloads, empty `200` response bodies, timeout failures, and server errors reject with `PlexLibraryError` instead of collapsing into semantic empties.
Collection-child HTTP 404 specifically rejects with `RESOURCE_NOT_FOUND` and
`httpStatus: 404`; a successful empty collection still returns `[]`. This preserves
the evidence needed for guarded saved-reference recovery. `getCollections()`
returns only a complete bounded listing: it validates page offsets, consistent
totals and unique valid identities, and rejects failed or inconsistent later
pages. Without a reported total it continues through short pages until an empty
page. A partial listing must never establish that a replacement name is unique.
Each network/cache operation captures one immutable active-server URI and auth-header snapshot. If the active server/account identity changes before that operation settles, the operation rejects with `PlexLibraryScopeSupersededError`; stale results do not update library caches or emit library transport/refresh/tag callbacks. Callers that intentionally provide partial-result fallbacks must use `isPlexLibraryScopeSupersededError()` to rethrow that exact error before ordinary fallback conversion.
PMS library `401` responses are handled inside the Plex boundary before recovery is
emitted. The request client refreshes plex.tv resources once under the active cloud
credential. When the selected resource returns a different PMS access token, the
library adopts a new immutable selected-server scope and retries the PMS request
exactly once. An unchanged token, a rejected one-time retry, or an unavailable
selected resource then proceeds to cloud credential classification. There is no
account-token fallback and no repeated resource refresh or PMS retry.

A stale profile/server/resource-token scope remains
`PlexLibraryScopeSupersededError`; a cloud-invalid managed credential with a
still-valid account emits
`managed_profile_auth_invalid`; a cloud-valid active credential rejected by PMS emits
`profile_server_access_denied`; only cloud rejection of the owning account emits
`account_auth_expired` and maps to global sign-in. These outcomes contain no token or
token-bearing URL data.
If resource refresh or the cloud credential probe times out, is rate-limited, or is
unavailable, Lineup does not guess at credential or PMS access state and emits no
authorization failure event. The typed cloud transport result is preserved; cloud service or
reachability failures translate to `PLEX_CLOUD_UNAVAILABLE`, whose recovery is Retry
or Exit rather than profile, account sign-in, or PMS server selection.
Caller cancellation remains distinct and takes precedence at each observation boundary: an aborted signal rejects with its raw reason, including on a current cache hit. Count enrichment treats caller abort and scope supersession as fatal for the whole library-list request, while ordinary count failures remain best-effort and leave the affected count unknown.
`getImageUrl()` returns `null` when no image URL can be built, such as an empty image path, missing active server URI, or an untrusted foreign absolute image URL. Absolute `https://metadata-static.plex.tv` actor images are allowed: direct requests remain token-free, while resized requests use the authenticated active-server photo transcoder. Plex tokens are never attached to the metadata CDN URL.

## Server Discovery (`IPlexServerDiscovery`)

Manages server discovery, connection testing, and selection.

```typescript
type PlexServerSelectionFailureReason =
  | 'unreachable'
  | 'auth_required'
  | 'access_denied';

type PlexServerSelectionResult =
  | { kind: 'selected'; receipt: PlexDiscoverySelectionReceipt }
  | { kind: 'server_not_found' }
  | { kind: 'connection_unavailable'; reason: PlexServerSelectionFailureReason };

class PlexDiscoverySelectionSupersededError extends Error {}

function isPlexDiscoverySelectionSupersededError(
  error: unknown
): error is PlexDiscoverySelectionSupersededError;

type PlexSavedServerRestoreResult =
  | { kind: 'skipped_no_servers' }
  | { kind: 'skipped_no_saved_server' }
  | { kind: 'already_selected'; serverId: string; receipt: PlexDiscoverySelectionReceipt }
  | { kind: 'selected'; serverId: string; receipt: PlexDiscoverySelectionReceipt }
  | {
      kind: 'selection_failed';
      serverId: string;
      reason: 'server_not_found' | PlexServerSelectionFailureReason;
    };

interface PlexDiscoverySelectedServerSnapshot {
  server: PlexServer | null;
  connection: PlexConnection | null;
  storedServerId: string | null;
}

interface PlexDiscoverySignalOptions {
  signal?: AbortSignal | null;
}

type PlexSelectedServerAccessTokenRefreshResult =
  | { kind: 'updated' }
  | { kind: 'unchanged' }
  | { kind: 'selected_server_unavailable' };

interface IPlexServerDiscovery {
  discoverServers(options?: PlexDiscoverySignalOptions): Promise<PlexServer[]>;

  refreshServers(options?: PlexDiscoverySignalOptions): Promise<PlexServer[]>;

  initialize(options?: PlexDiscoverySignalOptions): Promise<PlexSavedServerRestoreResult>;

  setStorageKeys(selectedServerKey: string, serverHealthKey: string): void;

  testConnection(
    server: PlexServer,
    connection: PlexConnection,
    options?: PlexDiscoverySignalOptions
  ): Promise<number | 'auth_required' | 'access_denied' | null>;

  findFastestConnection(server: PlexServer, options?: PlexDiscoverySignalOptions): Promise<{
    connection: PlexConnection | null;
    authRequired: boolean;
    authState: 'auth_required' | 'access_denied' | null;
  }>;

  selectServer(serverId: string, options?: PlexDiscoverySignalOptions): Promise<PlexServerSelectionResult>;

  getSelectedServer(): PlexServer | null;

  getSelectedConnection(): PlexConnection | null;

  getServerUri(): string | null;

  getSelectedServerAuthHeaders(): Record<string, string>;

  getSelectedServerAccessToken(): string | null;

  refreshSelectedServerAccessToken(
    expectedAccessToken: string,
    options?: PlexDiscoverySignalOptions
  ): Promise<PlexSelectedServerAccessTokenRefreshResult>;

  getHttpsConnection(): PlexConnection | null;

  getRelayConnection(): PlexConnection | null;

  getActiveConnectionUri(): string | null;

  clearSelection(): void;

  captureSelectedServerSnapshot(): PlexDiscoverySelectedServerSnapshot;

  restoreSelectedServerSnapshot(
    snapshot: PlexDiscoverySelectedServerSnapshot
  ): PlexDiscoverySelectionReceipt;

  captureCurrentSelectionReceipt(): PlexDiscoverySelectionReceipt | null;

  getSelectionReceiptSignal(receipt: PlexDiscoverySelectionReceipt): AbortSignal;

  assertSelectionReceiptCurrent(receipt: PlexDiscoverySelectionReceipt): void;

  getServers(): PlexServer[];

  isConnected(): boolean;

  on(event: 'serverChange', handler: (server: PlexServer | null) => void): IDisposable;

  on(event: 'connectionChange', handler: (uri: string | null) => void): IDisposable;
}
```

Discovery list and selected-server getters return defensive snapshots. Startup initialization returns a saved-server restore result so callers can distinguish each restore branch:

- `skipped_no_servers`: discovery completed with no available servers and there is no saved server id to restore.
- `skipped_no_saved_server`: discovery found servers, but there is no saved server id to restore.
- `already_selected`: the saved server is already the active selection.
- `selected`: the saved server was restored and selected.
- `selection_failed`: the saved server id could not be selected; inspect `reason` for `server_not_found`, `unreachable`, `auth_required`, or `access_denied`. When a saved id exists but discovery returns no servers, initialization returns `selection_failed` with `server_not_found` and clears that stale saved selection.

Successful selection and saved-server restore results carry an opaque discovery-owned receipt. Callers may obtain its read-only invalidation signal and assert currentness through the discovery port, but cannot construct, compare, advance, or abort discovery authority. A successful replacement selection, clear, real storage-key change, or snapshot restore aborts prior receipts before mutating selected state. Failed probes and idempotent same-key configuration leave the current receipt valid. Snapshot restoration returns a fresh receipt for the restored selected or unselected scope; `captureCurrentSelectionReceipt()` remains selected-only.

Callers may cancel their own discovery wait with `AbortSignal` without canceling the shared in-flight discovery used by other callers. Connection probes and selected-server selection accept caller cancellation signals and rethrow the caller's raw abort reason instead of converting explicit cancellation into an unreachable-server result.

Server selection and saved-server initialization capture one discovery-local monotonic context before discovery or probing. A storage/profile transition, authoritative clear, or snapshot restore supersedes older work even when later storage keys reuse the same text. Superseded selection rejects with `PlexDiscoverySelectionSupersededError`; it is not a selection-result kind, abort, or application error code. Callers may classify it through `isPlexDiscoverySelectionSupersededError()` but do not own or construct selection validity. Caller abort remains the first observation at every continuation and therefore retains its raw reason when cancellation and supersession coincide.

Selection revalidates before each probe continuation and before every selected-state, selected-id, event, health, and successful-return suffix. Snapshot restore validates its discovery-owned capture before advancing the context; clear and restore then guard their own synchronous mutation/event suffixes, so a re-entrant `serverChange` listener cannot continue under a newly selected storage context. Standalone `testConnection()` and `findFastestConnection()` retain their existing transport contracts.

Discovery is endpoint-aware: plex.tv cloud resource discovery `401`/`403` remains an auth recovery failure, while a PMS identity-probe `403` means the active Plex profile lacks permission for that server and surfaces as `access_denied` instead of invalid stored credentials.
Plex cloud discovery `5xx` responses surface as retryable `SERVER_ERROR` failures after discovery retry policy is exhausted; request failures without an HTTP response remain `SERVER_UNREACHABLE`.

The active account or Plex Home token is used only for plex.tv resource discovery.
Discovery privately retains the opaque, user-scoped `accessToken` returned by
`/api/v2/resources`; PMS identity probes and all selected-server consumers use that
resource token with the normal Plex client identity headers. Resource tokens stay in
memory and are preserved behind discovery-owned selection snapshots, rollback, and
selected-server replacement. Public server lists, getters, and events are token-free.
A profile/storage namespace or cloud-credential
change invalidates cached resources before saved-server restoration so a token from
another Home profile cannot be reused.
The public `serverChange` event uses a token-free selected-server projection; callers
that need PMS authorization use the dedicated selected-server header/token seams.

## Stream Resolution (`IPlexStreamResolver`)

Converting metadata into a playable URL with codec analysis, direct-play eligibility, and transcode session management.

Direct PMS stream transports use the same bounded authorization policy as library
requests. A `401` refreshes the selected resource once; a changed PMS token permits
exactly one retry. An unchanged or rejected replacement token is classified through
the active Plex cloud credential as profile/server denial, managed-profile expiry,
or account expiry. Cloud transport failures remain typed, and no account token is
sent to PMS as a fallback. Universal-decision, selected-part subtitle, and transcode
stop requests also retain the discovery-owned selection receipt across every async
continuation. A replacement selection supersedes the request before retry or
classification even when both resources happen to expose the same PMS token.

```typescript
type StreamResolverErrorStage =
  | 'media_selection'
  | 'burn_in_selected_part';

interface StreamResolverError {
  code: PlexStreamErrorCode;
  message: string;
  recoverable: boolean;
  retryAfterMs?: number;
  stage?: StreamResolverErrorStage;
}

interface StreamResolverEventMap {
  error: StreamResolverError;
}

interface IPlexStreamResolver {
  resolveStream(request: StreamRequest): Promise<StreamDecision>;

  stopTranscodeSession(sessionId: string): Promise<void>;

  canDirectPlay(item: PlexStreamMediaItem): boolean;

  /** Throws StreamResolverError synchronously when a transcode URL cannot be built. */
  getTranscodeUrl(itemKey: string, options: HlsOptions): string;

  fetchUniversalTranscodeDecision(
    itemKey: string,
    request: NonNullable<StreamDecision['transcodeRequest']>
  ): Promise<NonNullable<StreamDecision['serverDecision']>>;

  on<K extends keyof StreamResolverEventMap>(
    event: K,
    handler: (payload: StreamResolverEventMap[K]) => void
  ): IDisposable;

  off<K extends keyof StreamResolverEventMap>(
    event: K,
    handler: (payload: StreamResolverEventMap[K]) => void
  ): void;
}
```

### `StreamDecision`

The resolved stream decision includes playback URL, codec details, subtitle delivery, diagnostics, and available track lists:

```typescript
interface StreamDecision {
  playbackUrl: string;

  resolvedBaseUrl?: string;

  protocol: 'hls' | 'http';

  isDirectPlay: boolean;

  isTranscoding: boolean;

  container: string;

  videoCodec: string;

  audioCodec: string;

  subtitleDelivery: 'embed' | 'sidecar' | 'burn' | 'none';

  sessionId: string;

  mediaIndex: number;

  partIndex: number;

  partKey: string;

  selectedAudioStream: PlexStream | null;

  selectedSubtitleStream: PlexStream | null;

  availableAudioStreams?: PlexStream[];

  availableSubtitleStreams?: PlexStream[];

  width: number;

  height: number;

  bitrate: number;

  source?: {
    container: string;
    videoCodec: string;
    audioCodec: string;
    width: number;
    height: number;
    bitrate: number;
    hdr?: string;
    dynamicRange?: string;
    doviPresent?: boolean;
    doviProfile?: string;
  };

  directPlay?: {
    allowed: boolean;
    reasons: string[];
  };

  hdr10Fallback?: {
    mode: 'off' | 'smart' | 'force';
    applied: boolean;
    reason: 'none' | 'smart' | 'force';
    debugWhy: string;
    hideDolbyVision: boolean;
    forcedHls: boolean;
  };

  subtitleBurnIn?: {
    requested: boolean;
    confirmed?: boolean;
    reason: 'requested' | 'format_required' | 'none';
    subtitleStreamId?: string;
    subtitleMode?: 'none' | 'burn';
  };

  audioFallback?: {
    fromCodec: string;
    toCodec: string;
    reason: string;
  };

  transcodeRequest?: StreamDecisionTranscodeRequest;

  serverDecision?: {
    fetchedAt: number;
    videoDecision?: string;
    audioDecision?: string;
    subtitleDecision?: string;
    streams?: PlexStreamDecision[];
    decisionCode?: string;
    decisionText?: string;
  };
}

interface PlexStreamDecision {
  id?: string;
  streamType?: 1 | 2 | 3;
  decision?: string;
}

type StreamDecisionTranscodeRequestBase = {
  sessionId: string;
  startOffsetMs: number;
  startOffsetSeconds: number;
  transcodeCompatMode: boolean;
  transcodeQuality: TranscodeQualityOption | null;
  mediaIndex?: number;
  partIndex?: number;
  audioStreamId?: string;
  hideDolbyVision?: true;
};

type StreamDecisionTranscodeRequestBitrate =
  | {
      maxBitrate?: undefined;
      maxBitrateReason: 'none';
    }
  | {
      maxBitrate: number;
      maxBitrateReason: 'explicit' | 'quality' | 'explicit_quality';
    };

type StreamDecisionTranscodeRequest = StreamDecisionTranscodeRequestBase &
  StreamDecisionTranscodeRequestBitrate & (
  | {
      subtitleStreamId?: undefined;
      subtitleMode?: undefined;
    }
  | {
      subtitleStreamId: string;
      subtitleMode: 'burn';
    }
);
```

Lineup currently resolves transcode/direct-stream sessions through Plex
universal HLS only. DASH remains out of scope until it is deliberately validated
for webOS playback.

For HLS sessions, `startOffsetMs` is the clamped virtual-channel playback
position Lineup requested and `startOffsetSeconds` is the integer value sent to
PMS as the universal transcode `offset` parameter. Lineup still carries the
same offset into the player descriptor because the HTML video element resets its
local position during load.

`maxBitrate` is optional. When absent, Lineup requests original/uncapped HLS and
omits Plex `maxVideoBitrate`; PMS may still direct-stream/remux/transcode based
on codecs, subtitles, and client capabilities. `maxBitrateReason` records why a
cap was sent: explicit request, persisted quality setting, both, or no cap.

`StreamDecision.isTranscoding` is a legacy compatibility/session-lifecycle
flag for Lineup-requested HLS sessions. It remains `true` for request paths that
need transcode-session lifecycle handling even when PMS later reports copy/remux
or audio-only transcode. It is not proof of a PMS video transcode. User-facing
compact summaries should use PMS `serverDecision` fields and confirmed
`subtitleBurnIn` evidence when available:

- direct play: `Direct Play`
- HLS session without PMS decision evidence: `HLS Session`
- PMS copy/remux without audio or video transcode: `Direct Stream`
- PMS audio-only transcode: `Audio Transcode`
- PMS video transcode or confirmed subtitle burn-in: `Video Transcode`

`StreamDecision.subtitleDelivery` uses Lineup-facing delivery terms, not PMS
HLS subtitle URL modes. In particular, `subtitleDelivery: 'sidecar'` means
Lineup handles a text subtitle out-of-band from the video stream: the player
attaches an already WebVTT-capable direct/key-backed text track when possible,
or it fetches/extracts text and converts it to a local VTT `blob:` track through
the subtitle fallback pipeline. The legacy `subtitleDelivery: 'embed'` value is
a native-or-unknown/unhandled diagnostic category: the selected subtitle is
neither a recognized Lineup text-sidecar format nor a recognized
burn-in-required format. It is not evidence that webOS, the HTML video element,
or PMS native embedded subtitle delivery rendered the subtitle.

Each subtitle fallback fetch keeps header and response-body consumption inside
one 10-second attempt deadline. Successful subtitle bodies are capped at 16 MiB,
error-body diagnostic samples at 16 KiB, and unload or destroy cancellation
aborts the active body reader. The XHR compatibility fallback uses the same
successful-body limit and aborts once progress exceeds it.

Current PMS playback URL policy is narrower than the Lineup delivery enum:

- Transcode/direct-stream URLs are built as
  `/video/:/transcode/universal/start.m3u8` with `protocol=hls`.
- HLS URLs include the server-side `offset` derived from the clamped
  `StreamRequest.startOffsetMs`; they do not start every virtual-channel
  playback session from zero unless the clamped program offset is zero.
- Burn-in requests send PMS `subtitles=burn` with the selected
  `subtitleStreamID`.
- Before a burn-in HLS transcode starts, `PlexStreamResolver` also selects the
  requested subtitle on the chosen PMS media part with
  `PUT /library/parts/{partId}?subtitleStreamID={streamId}`. This resolver-owned
  PMS mutation is required for the observed keyless embedded SRT burn-in path
  and is not persisted in Lineup storage. When Lineup disables a burn-in subtitle
  stream, the resolver clears the selected PMS part subtitle with
  `subtitleStreamID=0` before resolving the no-subtitle reload.
- Non-burn HLS playback sends PMS `subtitles=none`, `subtitleStreamID=0`, and
  `subtitleFormat=none`; Lineup then handles eligible text subtitles locally.
- HLS playback sends `maxVideoBitrate` only when a request cap or persisted
  transcode quality setting explicitly asks for one. Original-quality/LAN
  playback omits the cap.
- Lineup does not currently request PMS native/HLS subtitle delivery modes such
  as `subtitles=sidecar`, `subtitles=embedded`, or `subtitles=segmented`.

`subtitleBurnIn.requested` is Lineup's local request intent. It does not prove
that Plex burned the subtitle into the video. Burn-in stream resolution fetches
PMS universal decision evidence even when debug logging is disabled, and
`subtitleBurnIn.confirmed` is set only when that evidence shows the requested
subtitle stream with `decision="burn"`. Broad PMS fields such as
`subtitleDecision` are diagnostic-only unless future PMS API evidence promotes
them into the supported contract.
