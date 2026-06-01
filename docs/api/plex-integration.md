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
interface IPlexAuth {
  requestPin(options?: { signal?: AbortSignal | null }): Promise<PlexPinRequest>;
  checkPinStatus(pinId: number, options?: { signal?: AbortSignal | null }): Promise<PlexPinRequest>;
  cancelPin(pinId: number): Promise<void>;
  pollForPin(pinId: number, options?: { signal?: AbortSignal | null }): Promise<PlexPinRequest>;
  validateToken(token: string, options?: { signal?: AbortSignal | null }): Promise<boolean>;
  getHomeUsers(options?: { signal?: AbortSignal | null }): Promise<PlexHomeUser[]>;
  switchHomeUser(userId: string, options?: { pin?: string | null; signal?: AbortSignal | null }): Promise<void>;
  getActiveUserId(): string | null;
  getAccountUserId(): string | null;
  logoutActiveUser(): Promise<void>;
  readStoredCredentialsAndClearCorruption(): PlexStoredCredentialsReadResult;
  storeCredentials(auth: PlexAuthData): void;
  clearCredentials(): void;
  isAuthenticated(): boolean;
  getCurrentUser(): PlexAuthToken | null;
  getAuthHeaders(): Record<string, string>;
  on(event: 'authChange', handler: (isAuthenticated: boolean) => void): IDisposable;
  on(event: 'profileChange', handler: (payload: { fromUserId: string | null; toUserId: string }) => void): IDisposable;
}
```

Stored-credentials reads distinguish `missing`, `available`, and `corrupted`. Corrupted payloads are cleared by `PlexAuth` and surfaced distinctly from first-run missing state. The stored-credential read/write/clear methods are synchronous local storage and in-memory state operations; they do not imply an async persistence backend.

Caller-provided cancellation signals on `requestPin()`, `checkPinStatus()`, `pollForPin()`, `validateToken()`, `getHomeUsers()`, and `switchHomeUser()` rethrow the caller's raw `AbortError` or abort reason so callers can distinguish explicit cancellation from Plex failures. `cancelPin()` remains the normal best-effort PIN cancellation API.

`PlexAuthConfig.clientIdentifier` is resolved once at config assembly (`createDefaultPlexAuthConfig`) and treated as already-resolved input by `PlexAuth`.
Canonical Plex identity metadata and identity-header assembly live in `src/modules/plex/auth/config.ts`; auth transport, platform identity, and stream callers consume or adapt those values instead of generating independent product/device metadata.
`validateToken()` returns `false` only for explicit auth-invalid (`401`/`403`) outcomes. Timeout, service/network failures, and malformed success payloads throw typed `PlexApiError` failures; caller-triggered aborts are rethrown as raw aborts instead.
Plex cloud `5xx` responses surface as retryable `SERVER_ERROR` failures; transport-level failures that do not produce an HTTP response remain server/network reachability failures.
`getHomeUsers()` and `switchHomeUser()` throw typed auth failures for explicit credential problems instead of collapsing those outcomes into empty profile lists.
`PlexHomeUser.restricted` is informational-only metadata in profile select UI and does not enforce startup or playback gating.

## Library Access (`IPlexLibrary`)

Retrieving content metadata. Supports libraries, collections, playlists, TV show hierarchy, tag directories, and search.

```typescript
type PlexTagDirectoryUnsupportedReason = 'unavailable' | 'empty';

type PlexLibraryRequestIntent = 'preview' | 'background';

interface PlexTagDirectoryQueryOptions {
  type: number;
  signal?: AbortSignal | null;
  onUnsupported?: (reason: PlexTagDirectoryUnsupportedReason) => void;
  requireEntries?: boolean;
  requestIntent?: PlexLibraryRequestIntent;
}

interface PlexLibraryEvents {
  authExpired: undefined;
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
`getImageUrl()` returns `null` when no image URL can be built, such as an empty image path, missing active server URI, or a foreign absolute image URL. Plex tokens are only attached to active-server-owned image URLs.

## Server Discovery (`IPlexServerDiscovery`)

Manages server discovery, connection testing, and selection.

```typescript
type PlexServerSelectionFailureReason =
  | 'unreachable'
  | 'auth_required'
  | 'access_denied';

type PlexServerSelectionResult =
  | { kind: 'selected' }
  | { kind: 'server_not_found' }
  | { kind: 'connection_unavailable'; reason: PlexServerSelectionFailureReason };

interface PlexDiscoverySelectedServerSnapshot {
  server: PlexServer | null;
  connection: PlexConnection | null;
  storedServerId: string | null;
}

interface PlexDiscoverySignalOptions {
  signal?: AbortSignal | null;
}

interface IPlexServerDiscovery {
  discoverServers(options?: PlexDiscoverySignalOptions): Promise<PlexServer[]>;

  refreshServers(options?: PlexDiscoverySignalOptions): Promise<PlexServer[]>;

  initialize(): Promise<void>;

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

  getHttpsConnection(): PlexConnection | null;

  getRelayConnection(): PlexConnection | null;

  getActiveConnectionUri(): string | null;

  clearSelection(): void;

  captureSelectedServerSnapshot(): PlexDiscoverySelectedServerSnapshot;

  restoreSelectedServerSnapshot(snapshot: PlexDiscoverySelectedServerSnapshot): void;

  getServers(): PlexServer[];

  isConnected(): boolean;

  on(event: 'serverChange', handler: (server: PlexServer | null) => void): IDisposable;

  on(event: 'connectionChange', handler: (uri: string | null) => void): IDisposable;
}
```

Discovery list and selected-server getters return defensive snapshots. Callers may cancel their own discovery wait with `AbortSignal` without canceling the shared in-flight discovery used by other callers. Connection probes and selected-server selection accept caller cancellation signals and rethrow the caller's raw abort reason instead of converting explicit cancellation into an unreachable-server result.

Discovery is endpoint-aware: plex.tv cloud resource discovery `401`/`403` remains an auth recovery failure, while a PMS identity-probe `403` means the active Plex profile lacks permission for that server and surfaces as `access_denied` instead of invalid stored credentials.
Plex cloud discovery `5xx` responses surface as retryable `SERVER_ERROR` failures after discovery retry policy is exhausted; request failures without an HTTP response remain `SERVER_UNREACHABLE`.

## Stream Resolution (`IPlexStreamResolver`)

Converting metadata into a playable URL with codec analysis, direct-play eligibility, and transcode session management.

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

  protocol: 'hls' | 'dash' | 'http';

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

type StreamDecisionTranscodeRequest = {
  sessionId: string;
  maxBitrate: number;
  mediaIndex?: number;
  partIndex?: number;
  audioStreamId?: string;
  hideDolbyVision?: true;
} & (
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

Current PMS playback URL policy is narrower than the Lineup delivery enum:

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
- Lineup does not currently request PMS native/HLS subtitle delivery modes such
  as `subtitles=sidecar`, `subtitles=embedded`, or `subtitles=segmented`.

`subtitleBurnIn.requested` is Lineup's local request intent. It does not prove
that Plex burned the subtitle into the video. Burn-in stream resolution fetches
PMS universal decision evidence even when debug logging is disabled, and
`subtitleBurnIn.confirmed` is set only when that evidence shows the requested
subtitle stream with `decision="burn"`. Broad PMS fields such as
`subtitleDecision` are diagnostic-only unless future PMS API evidence promotes
them into the supported contract.
