/** @jest-environment jsdom */

import { TextDecoder as NodeTextDecoder } from 'util';
import { AppErrorCode } from '../../../../types/app-errors';
import {
    PlexAuth,
    type PlexAuthConfig,
    type PlexCurrentCredentialValidity,
    type PlexAuthToken,
} from '../../auth';
import { PlexServerDiscovery } from '../../discovery';
import { PLEX_TOKEN_HEADER } from '../../shared/plexUrl';
import { PlexLibrary, type PlexLibraryAuthorizationFailure } from '../index';

const ACCOUNT_TOKEN = 'integration-account-token';
const MANAGED_TOKEN = 'integration-managed-token';
const PMS_ACCESS_TOKEN = 'integration-ultra-resource-token';
const SERVER_URI = 'https://ultra.example:32400';

const authConfig: PlexAuthConfig = {
    clientIdentifier: 'integration-client',
    product: 'Lineup',
    version: '1',
    platform: 'webOS',
    platformVersion: '6',
    device: 'TV',
    deviceName: 'TV',
};

function authToken(token: string, userId: string): PlexAuthToken {
    return {
        token,
        userId,
        username: userId,
        email: `${userId}@example.com`,
        thumb: '',
        expiresAt: null,
        issuedAt: new Date('2026-01-01T00:00:00Z'),
    };
}

function jsonResponse(body: unknown, status: number = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: {
            get: (name: string): string | null =>
                name.toLowerCase() === 'content-type' ? 'application/json' : null,
        },
        json: async (): Promise<unknown> => body,
        text: async (): Promise<string> => JSON.stringify(body),
    } as unknown as Response;
}

function pmsJsonResponse(body: unknown): Response {
    const text = JSON.stringify(body);
    const bytes = Uint8Array.from(Array.from(text, (character) => character.charCodeAt(0)));
    return {
        ok: true,
        status: 200,
        headers: {
            get: (name: string): string | null =>
                name.toLowerCase() === 'content-type' ? 'application/json' : null,
        },
        body: {
            getReader: (): ReadableStreamDefaultReader<Uint8Array> => {
                let consumed = false;
                return {
                    read: async (): Promise<ReadableStreamReadResult<Uint8Array>> => {
                        if (consumed) return { done: true, value: undefined };
                        consumed = true;
                        return { done: false, value: bytes };
                    },
                    cancel: async () => undefined,
                    releaseLock: () => undefined,
                } as unknown as ReadableStreamDefaultReader<Uint8Array>;
            },
        },
    } as unknown as Response;
}

function readToken(init?: RequestInit): string | null {
    return new Headers(init?.headers).get(PLEX_TOKEN_HEADER);
}

type CredentialProbeStatus = number | 'timeout';

interface ManagedAuthorizationCase {
    name: string;
    pmsStatus: 200 | 401;
    activeProbeStatus: CredentialProbeStatus;
    accountProbeStatus: number | null;
    expectedCode: AppErrorCode | null;
    expectedHttpStatus: number | undefined | null;
    expectedFailure: PlexLibraryAuthorizationFailure | null;
}

const managedAuthorizationCases: readonly ManagedAuthorizationCase[] = [
    {
        name: 'correct PMS resource credential succeeds',
        pmsStatus: 200,
        activeProbeStatus: 200,
        accountProbeStatus: null,
        expectedCode: null,
        expectedHttpStatus: null,
        expectedFailure: null,
    },
    {
        name: 'stale managed credential with a valid account',
        pmsStatus: 401,
        activeProbeStatus: 401,
        accountProbeStatus: 200,
        expectedCode: AppErrorCode.PLEX_PROFILE_AUTH_INVALID,
        expectedHttpStatus: 401,
        expectedFailure: { kind: 'managed_profile_auth_invalid' },
    },
    {
        name: 'cloud-valid managed credential rejected for profile/server access',
        pmsStatus: 401,
        activeProbeStatus: 200,
        accountProbeStatus: null,
        expectedCode: AppErrorCode.PLEX_PROFILE_SERVER_ACCESS_DENIED,
        expectedHttpStatus: 401,
        expectedFailure: { kind: 'profile_server_access_denied' },
    },
    {
        name: 'genuine account authentication expiry',
        pmsStatus: 401,
        activeProbeStatus: 401,
        accountProbeStatus: 401,
        expectedCode: AppErrorCode.AUTH_EXPIRED,
        expectedHttpStatus: 401,
        expectedFailure: { kind: 'account_auth_expired' },
    },
    {
        name: 'cloud credential-probe timeout without guessing account or PMS state',
        pmsStatus: 401,
        activeProbeStatus: 'timeout',
        accountProbeStatus: null,
        expectedCode: AppErrorCode.NETWORK_TIMEOUT,
        expectedHttpStatus: undefined,
        expectedFailure: null,
    },
    {
        name: 'cloud credential-probe rate limit without guessing account or PMS state',
        pmsStatus: 401,
        activeProbeStatus: 429,
        accountProbeStatus: null,
        expectedCode: AppErrorCode.RATE_LIMITED,
        expectedHttpStatus: 429,
        expectedFailure: null,
    },
    {
        name: 'cloud credential-probe 5xx without guessing account or PMS state',
        pmsStatus: 401,
        activeProbeStatus: 503,
        accountProbeStatus: null,
        expectedCode: AppErrorCode.PLEX_CLOUD_UNAVAILABLE,
        expectedHttpStatus: 503,
        expectedFailure: null,
    },
];

describe('managed Plex Home PMS authorization integration', () => {
    const originalTextDecoder = globalThis.TextDecoder;

    beforeAll(() => {
        globalThis.TextDecoder = NodeTextDecoder as typeof globalThis.TextDecoder;
    });

    afterAll(() => {
        globalThis.TextDecoder = originalTextDecoder;
    });

    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
    });

    it.each(managedAuthorizationCases)('traces the selected managed credential and classifies $name', async ({
        pmsStatus,
        activeProbeStatus,
        accountProbeStatus,
        expectedCode,
        expectedHttpStatus,
        expectedFailure,
    }) => {
        const auth = new PlexAuth(authConfig);
        const account = authToken(ACCOUNT_TOKEN, 'account-user');
        auth.storeCredentials({
            accountToken: account,
            activeToken: account,
            activeUserId: account.userId,
            selectedServerByUserId: {
                [account.userId]: { serverId: null, serverUri: null },
            },
        });

        let userRequestCount = 0;
        const observed = {
            switchRequestUsedAccount: false,
            switchProfileUsedManaged: false,
            storedValidationUsedManaged: false,
            discoveryUsedManaged: true,
            selectionProbeUsedPmsToken: false,
            pmsLibraryUsedPmsToken: false,
            accountProbeUsedAccount: false,
        };
        const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            const token = readToken(init);
            if (url.includes('/home/users/managed-home-user/switch')) {
                observed.switchRequestUsedAccount = token === ACCOUNT_TOKEN;
                return jsonResponse({ authToken: MANAGED_TOKEN });
            }
            if (url === 'https://plex.tv/api/v2/user') {
                userRequestCount += 1;
                if (userRequestCount === 1) {
                    observed.switchProfileUsedManaged = token === MANAGED_TOKEN;
                    return jsonResponse({
                        id: 'managed-user',
                        username: 'managed-user',
                        email: 'managed@example.com',
                        thumb: '',
                    });
                }
                if (userRequestCount === 2) {
                    observed.storedValidationUsedManaged = token === MANAGED_TOKEN;
                    return jsonResponse({
                        id: 'managed-user',
                        username: 'managed-user',
                        email: 'managed@example.com',
                        thumb: '',
                    });
                }
                if (token === MANAGED_TOKEN) {
                    if (activeProbeStatus === 'timeout') {
                        throw new DOMException('Credential probe timed out', 'AbortError');
                    }
                    return jsonResponse({}, activeProbeStatus);
                }
                observed.accountProbeUsedAccount = token === ACCOUNT_TOKEN;
                return jsonResponse({}, accountProbeStatus ?? 500);
            }
            if (url.includes('/api/v2/resources')) {
                observed.discoveryUsedManaged &&= token === MANAGED_TOKEN;
                return jsonResponse([{
                    clientIdentifier: 'ultra-server',
                    name: 'Ultra CC',
                    sourceTitle: 'account-user',
                    ownerId: 'account-user',
                    owned: false,
                    accessToken: PMS_ACCESS_TOKEN,
                    provides: 'server',
                    connections: [{
                        uri: SERVER_URI,
                        protocol: 'https',
                        address: 'ultra.example',
                        port: 32400,
                        local: false,
                        relay: false,
                    }],
                }]);
            }
            if (url === `${SERVER_URI}/identity`) {
                observed.selectionProbeUsedPmsToken = token === PMS_ACCESS_TOKEN;
                return jsonResponse({ MediaContainer: { machineIdentifier: 'ultra-server' } });
            }
            if (url === `${SERVER_URI}/library/sections`) {
                observed.pmsLibraryUsedPmsToken = token === PMS_ACCESS_TOKEN;
                return pmsStatus === 200
                    ? pmsJsonResponse({ MediaContainer: { Directory: [] } })
                    : jsonResponse({ error: 'Unauthorized' }, 401);
            }
            throw new Error(`Unexpected mocked Plex request origin/path: ${new URL(url).origin}${new URL(url).pathname}`);
        });
        (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

        await auth.switchHomeUser('managed-home-user');
        const reloadedAuth = new PlexAuth(authConfig);
        await expect(reloadedAuth.validateStoredCredentials()).resolves.toMatchObject({
            kind: 'active_valid',
        });
        const discovery = new PlexServerDiscovery({
            getCloudAuthHeaders: (): Record<string, string> => reloadedAuth.getAuthHeaders(),
        });
        await expect(discovery.discoverServers()).resolves.toHaveLength(1);
        await expect(discovery.selectServer('ultra-server')).resolves.toMatchObject({
            kind: 'selected',
        });
        const onServerUnreachable = jest.fn();
        const logger = { warn: jest.fn(), error: jest.fn() };
        const library = new PlexLibrary({
            getAuthHeaders: (): Record<string, string> => discovery.getSelectedServerAuthHeaders(),
            getAuthToken: (): string | null => discovery.getSelectedServerAccessToken(),
            getServerUri: (): string | null => discovery.getServerUri(),
            refreshSelectedServerAccessToken: (
                expectedAccessToken,
                options
            ): ReturnType<PlexServerDiscovery['refreshSelectedServerAccessToken']> =>
                discovery.refreshSelectedServerAccessToken(expectedAccessToken, options),
            probeCurrentCredentialValidity: (options): Promise<PlexCurrentCredentialValidity> =>
                reloadedAuth.probeCurrentCredentialValidity(options),
            onServerUnreachable,
            logger,
        });
        const authorizationFailure = jest.fn();
        library.on('authorizationFailure', authorizationFailure);

        let rejection: unknown = null;
        if (expectedCode === null) {
            await expect(library.getLibraries()).resolves.toEqual([]);
        } else {
            try {
                await library.getLibraries();
            } catch (error) {
                rejection = error;
            }
            expect(rejection).toMatchObject({
                code: expectedCode,
                httpStatus: expectedHttpStatus,
            });
        }
        if (expectedFailure) {
            expect(authorizationFailure).toHaveBeenCalledWith(expectedFailure);
        } else {
            expect(authorizationFailure).not.toHaveBeenCalled();
        }
        expect(onServerUnreachable).not.toHaveBeenCalled();
        expect(observed).toMatchObject({
            switchRequestUsedAccount: true,
            switchProfileUsedManaged: true,
            storedValidationUsedManaged: true,
            discoveryUsedManaged: true,
            selectionProbeUsedPmsToken: true,
            pmsLibraryUsedPmsToken: true,
        });
        if (accountProbeStatus === null) {
            expect(observed.accountProbeUsedAccount).toBe(false);
        } else {
            expect(observed.accountProbeUsedAccount).toBe(true);
        }
        const surfacedText = [
            rejection instanceof Error ? rejection.message : '',
            JSON.stringify(authorizationFailure.mock.calls),
            JSON.stringify(logger.warn.mock.calls),
            JSON.stringify(logger.error.mock.calls),
        ].join(' ');
        expect(surfacedText).not.toContain(ACCOUNT_TOKEN);
        expect(surfacedText).not.toContain(MANAGED_TOKEN);
        expect(surfacedText).not.toContain(PMS_ACCESS_TOKEN);
    });

    it('refreshes a stale PMS resource token once and retries with the replacement token', async () => {
        const stalePmsToken = `${PMS_ACCESS_TOKEN}-stale`;
        const refreshedPmsToken = `${PMS_ACCESS_TOKEN}-refreshed`;
        let resourceRequestCount = 0;
        const observedPmsTokens: Array<string | null> = [];
        const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            const token = readToken(init);
            if (url.includes('/api/v2/resources')) {
                resourceRequestCount += 1;
                expect(token).toBe(MANAGED_TOKEN);
                return jsonResponse([{
                    clientIdentifier: 'ultra-server',
                    name: 'Ultra CC',
                    sourceTitle: 'account-user',
                    ownerId: 'account-user',
                    owned: false,
                    accessToken: resourceRequestCount === 1
                        ? stalePmsToken
                        : refreshedPmsToken,
                    provides: 'server',
                    connections: [{
                        uri: SERVER_URI,
                        protocol: 'https',
                        address: 'ultra.example',
                        port: 32400,
                        local: false,
                        relay: false,
                    }],
                }]);
            }
            if (url === `${SERVER_URI}/identity`) {
                expect(token).toBe(stalePmsToken);
                return jsonResponse({ MediaContainer: { machineIdentifier: 'ultra-server' } });
            }
            if (url === `${SERVER_URI}/library/sections`) {
                observedPmsTokens.push(token);
                return token === refreshedPmsToken
                    ? pmsJsonResponse({ MediaContainer: { Directory: [] } })
                    : jsonResponse({ error: 'Unauthorized' }, 401);
            }
            throw new Error(`Unexpected mocked Plex request origin/path: ${new URL(url).origin}${new URL(url).pathname}`);
        });
        (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

        const discovery = new PlexServerDiscovery({
            getCloudAuthHeaders: (): Record<string, string> => ({
                [PLEX_TOKEN_HEADER]: MANAGED_TOKEN,
            }),
        });
        await discovery.discoverServers();
        await expect(discovery.selectServer('ultra-server')).resolves.toMatchObject({
            kind: 'selected',
        });
        const library = new PlexLibrary({
            getAuthHeaders: (): Record<string, string> => discovery.getSelectedServerAuthHeaders(),
            getAuthToken: (): string | null => discovery.getSelectedServerAccessToken(),
            getServerUri: (): string | null => discovery.getServerUri(),
            refreshSelectedServerAccessToken: (
                expectedAccessToken,
                options
            ): ReturnType<PlexServerDiscovery['refreshSelectedServerAccessToken']> =>
                discovery.refreshSelectedServerAccessToken(expectedAccessToken, options),
            probeCurrentCredentialValidity: async (): Promise<{ kind: 'active_valid' }> => ({
                kind: 'active_valid',
            }),
        });
        const authorizationFailure = jest.fn();
        library.on('authorizationFailure', authorizationFailure);

        await expect(library.getLibraries()).resolves.toEqual([]);
        expect(resourceRequestCount).toBe(2);
        expect(observedPmsTokens).toEqual([stalePmsToken, refreshedPmsToken]);
        expect(discovery.getSelectedServerAccessToken()).toBe(refreshedPmsToken);
        expect(authorizationFailure).not.toHaveBeenCalled();
    });
});
