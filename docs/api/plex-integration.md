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
| `IPlexStreamResolver` | `src/modules/plex/stream/interfaces.ts` | Stream URL resolution, transcode sessions |

These are composed at the application composition root, not through interface inheritance.

## Authentication (`IPlexAuth`)

Pin-based OAuth flow for TV devices. Supports Plex Home user switching.

```typescript
interface IPlexAuth {
  requestPin(): Promise<PlexPinRequest>;
  checkPinStatus(pinId: number): Promise<PlexPinRequest>;
  cancelPin(pinId: number): Promise<void>;
  pollForPin(pinId: number): Promise<PlexPinRequest>;
  validateToken(token: string): Promise<boolean>;
  getHomeUsers(options?: { signal?: AbortSignal | null }): Promise<PlexHomeUser[]>;
  switchHomeUser(userId: string, options?: { pin?: string | null; signal?: AbortSignal | null }): Promise<void>;
  getActiveUserId(): string | null;
  getAccountUserId(): string | null;
  logoutActiveUser(): Promise<void>;
  readStoredCredentialsAndClearCorruption(): Promise<PlexStoredCredentialsReadResult>;
  storeCredentials(auth: PlexAuthData): Promise<void>;
  clearCredentials(): Promise<void>;
  isAuthenticated(): boolean;
  getCurrentUser(): PlexAuthToken | null;
  getAuthHeaders(): Record<string, string>;
  on(event: 'authChange', handler: (isAuthenticated: boolean) => void): IDisposable;
  on(event: 'profileChange', handler: (payload: { fromUserId: string | null; toUserId: string }) => void): IDisposable;
}
```

Stored-credentials reads distinguish `missing`, `available`, and `corrupted`. Corrupted payloads are cleared by `PlexAuth` and surfaced distinctly from first-run missing state.

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
  [key: string]: unknown;
}

interface IPlexLibrary {
  getLibraries(options?: {
    signal?: AbortSignal | null;
    includeItemCounts?: boolean;
    itemCountConcurrency?: number;
  }): Promise<PlexLibrary[]>;

  getLibrary(libraryId: string): Promise<PlexLibrary | null>;

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

  getImageUrl(imagePath: string, width?: number, height?: number): string;

  refreshLibrary(libraryId: string): Promise<void>;

  on<K extends keyof PlexLibraryEvents>(
    event: K,
    handler: (payload: PlexLibraryEvents[K]) => void
  ): void;

  off<K extends keyof PlexLibraryEvents>(
    event: K,
    handler: (payload: PlexLibraryEvents[K]) => void
  ): void;
}
```

`getLibrary()` returns `null` only when the id is not present in a valid fetched section list. Unavailable or malformed section-list fetches throw `PlexLibraryError`.

## Server Discovery (`IPlexServerDiscovery`)

Manages server discovery, connection testing, and selection.

```typescript
type PlexServerSelectionFailureReason = 'unreachable' | 'auth_required' | 'auth_invalid';

type PlexServerSelectionResult =
  | { kind: 'selected' }
  | { kind: 'server_not_found' }
  | { kind: 'connection_unavailable'; reason: PlexServerSelectionFailureReason };

interface IPlexServerDiscovery {
  discoverServers(): Promise<PlexServer[]>;

  refreshServers(): Promise<PlexServer[]>;

  initialize(): Promise<void>;

  setStorageKeys(selectedServerKey: string, serverHealthKey: string): void;

  testConnection(
    server: PlexServer,
    connection: PlexConnection
  ): Promise<number | 'auth_required' | 'auth_invalid' | null>;

  findFastestConnection(server: PlexServer): Promise<{
    connection: PlexConnection | null;
    authRequired: boolean;
    authState: 'auth_required' | 'auth_invalid' | null;
  }>;

  selectServer(serverId: string): Promise<PlexServerSelectionResult>;

  getSelectedServer(): PlexServer | null;

  getSelectedConnection(): PlexConnection | null;

  getServerUri(): string | null;

  getHttpsConnection(): PlexConnection | null;

  getRelayConnection(): PlexConnection | null;

  getActiveConnectionUri(): string | null;

  clearSelection(): void;

  getServers(): PlexServer[];

  isConnected(): boolean;

  on(event: 'serverChange', handler: (server: PlexServer | null) => void): IDisposable;

  on(event: 'connectionChange', handler: (uri: string | null) => void): IDisposable;
}
```

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
  [key: string]: StreamResolverError;
}

interface IPlexStreamResolver {
  resolveStream(request: StreamRequest): Promise<StreamDecision>;

  stopTranscodeSession(sessionId: string): Promise<void>;

  canDirectPlay(item: PlexMediaItem): boolean;

  getTranscodeUrl(itemKey: string, options: HlsOptions): string;

  fetchUniversalTranscodeDecision(
    itemKey: string,
    request: NonNullable<StreamDecision['transcodeRequest']>
  ): Promise<NonNullable<StreamDecision['serverDecision']>>;

  on<K extends keyof StreamResolverEventMap>(
    event: K,
    handler: (payload: StreamResolverEventMap[K]) => void
  ): void;

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
    decisionCode?: string;
    decisionText?: string;
  };
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
