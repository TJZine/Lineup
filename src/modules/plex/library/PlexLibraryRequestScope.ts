import { fnv1a32Hex } from '../../../utils/hash';
import { AppErrorCode } from '../../../types/app-errors';
import type { PlexLibraryConfig } from './interfaces';
import {
    PlexLibraryError,
    PlexLibraryScopeSupersededError,
} from './PlexLibraryError';

export interface PlexLibraryRequestScopeSnapshot {
    readonly signal: AbortSignal | null;
    readonly serverUri: string | null;
    readonly headers: Readonly<Record<string, string>>;
    readonly key: string | null;
    readonly version: number;
}

interface PlexLibraryRequestScopeOptions {
    config: Pick<PlexLibraryConfig, 'getServerUri' | 'getAuthHeaders' | 'getAuthToken'>;
    onScopeChange: (key: string | null) => void;
}

export class PlexLibraryRequestScope {
    private readonly _config: PlexLibraryRequestScopeOptions['config'];
    private readonly _onScopeChange: PlexLibraryRequestScopeOptions['onScopeChange'];
    private _activeKey: string | null = null;
    private _version = 0;
    private _initialized = false;

    constructor(options: PlexLibraryRequestScopeOptions) {
        this._config = options.config;
        this._onScopeChange = options.onScopeChange;
    }

    capture(signal: AbortSignal | null = null): PlexLibraryRequestScopeSnapshot {
        signal?.throwIfAborted();
        const identity = this._readIdentity();
        this._observeKey(identity.key);
        return Object.freeze({
            signal,
            serverUri: identity.serverUri,
            headers: Object.freeze({ ...this._config.getAuthHeaders() }),
            key: identity.key,
            version: this._version,
        });
    }

    assertCurrent(
        scope: PlexLibraryRequestScopeSnapshot,
        signal: AbortSignal | null = null
    ): void {
        signal?.throwIfAborted();
        const { key } = this._readIdentity();
        this._observeKey(key);
        if (scope.version !== this._version || scope.key !== key) {
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

    private _readIdentity(): { serverUri: string | null; key: string | null } {
        const configuredServerUri = this._config.getServerUri();
        const serverUri = configuredServerUri ? new URL(configuredServerUri).toString() : null;
        if (!serverUri) {
            return { serverUri: null, key: null };
        }
        const token = this._config.getAuthToken() ?? '';
        const tokenHash = token ? fnv1a32Hex(token) : 'no-token';
        return { serverUri, key: `${serverUri}::${tokenHash}` };
    }

    private _observeKey(key: string | null): void {
        if (this._initialized && this._activeKey === key) {
            return;
        }
        this._initialized = true;
        this._activeKey = key;
        this._version++;
        this._onScopeChange(key);
    }
}
