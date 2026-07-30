import { AppErrorCode } from '../../../types/app-errors';
import type { PlexLibraryConfig } from './interfaces';
import { isPlexDiscoverySelectionSupersededError } from '../discovery';
import {
    PlexLibraryError,
    PlexLibraryScopeSupersededError,
} from './PlexLibraryError';

export interface PlexLibraryRequestScopeSnapshot {
    readonly signal: AbortSignal | null;
    readonly serverUri: string | null;
    readonly headers: Readonly<Record<string, string>>;
    readonly accessToken: string;
    readonly key: object | null;
    readonly version: number;
}

interface PlexLibraryRequestScopeOptions {
    config: Pick<
        PlexLibraryConfig,
        | 'getServerUri'
        | 'getAuthHeaders'
        | 'getAuthToken'
        | 'refreshSelectedServerAccessToken'
    >;
    onScopeChange: () => void;
}

export class PlexLibraryRequestScope {
    private readonly _config: PlexLibraryRequestScopeOptions['config'];
    private readonly _onScopeChange: PlexLibraryRequestScopeOptions['onScopeChange'];
    private _activeKey: object | null = null;
    private _activeServerUri: string | null = null;
    private _activeAuthToken = '';
    private _version = 0;
    private _initialized = false;

    constructor(options: PlexLibraryRequestScopeOptions) {
        this._config = options.config;
        this._onScopeChange = options.onScopeChange;
    }

    capture(signal: AbortSignal | null = null): PlexLibraryRequestScopeSnapshot {
        signal?.throwIfAborted();
        const identity = this._readIdentity();
        this._observeIdentity(identity);
        return Object.freeze({
            signal,
            serverUri: identity.serverUri,
            headers: Object.freeze({ ...this._config.getAuthHeaders() }),
            accessToken: identity.authToken,
            key: this._activeKey,
            version: this._version,
        });
    }

    async refreshAfterUnauthorized(
        scope: PlexLibraryRequestScopeSnapshot,
        signal: AbortSignal | null = null
    ): Promise<{
        kind: 'updated' | 'unchanged' | 'selected_server_unavailable';
        scope: PlexLibraryRequestScopeSnapshot;
    }> {
        this.assertCurrent(scope, signal);
        let result: Awaited<ReturnType<PlexLibraryConfig['refreshSelectedServerAccessToken']>>;
        try {
            result = await this._config.refreshSelectedServerAccessToken(
                scope.accessToken,
                { signal }
            );
        } catch (error) {
            if (isPlexDiscoverySelectionSupersededError(error)) {
                throw new PlexLibraryScopeSupersededError();
            }
            throw error;
        }
        signal?.throwIfAborted();
        if (result.kind !== 'updated') {
            this.assertCurrent(scope, signal);
            return { kind: result.kind, scope };
        }

        const refreshedScope = this.capture(signal);
        if (
            refreshedScope.serverUri !== scope.serverUri
            || refreshedScope.accessToken === scope.accessToken
        ) {
            throw new PlexLibraryScopeSupersededError();
        }
        return { kind: 'updated', scope: refreshedScope };
    }

    assertCurrent(
        scope: PlexLibraryRequestScopeSnapshot,
        signal: AbortSignal | null = null
    ): void {
        signal?.throwIfAborted();
        this._observeIdentity(this._readIdentity());
        if (scope.version !== this._version || scope.key !== this._activeKey) {
            throw new PlexLibraryScopeSupersededError();
        }
    }

    buildUrl(
        scope: PlexLibraryRequestScopeSnapshot,
        endpoint: string,
        params: Record<string, string | number> = {}
    ): string {
        if (!scope.serverUri) {
            throw new PlexLibraryError(
                AppErrorCode.SERVER_UNREACHABLE,
                'No server URI available'
            );
        }
        const url = new URL(endpoint, scope.serverUri);
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, String(value));
        }
        return url.toString();
    }

    private _readIdentity(): { serverUri: string | null; authToken: string } {
        const configuredServerUri = this._config.getServerUri();
        const serverUri = configuredServerUri ? new URL(configuredServerUri).toString() : null;
        return { serverUri, authToken: this._config.getAuthToken() ?? '' };
    }

    private _observeIdentity(identity: { serverUri: string | null; authToken: string }): void {
        if (
            this._initialized
            && this._activeServerUri === identity.serverUri
            && this._activeAuthToken === identity.authToken
        ) {
            return;
        }
        this._initialized = true;
        this._activeServerUri = identity.serverUri;
        this._activeAuthToken = identity.authToken;
        this._activeKey = identity.serverUri ? Object.freeze({}) : null;
        this._version++;
        this._onScopeChange();
    }
}
