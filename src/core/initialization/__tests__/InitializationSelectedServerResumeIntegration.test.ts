/** @jest-environment jsdom */

import { PlexAuth, type PlexAuthConfig, type PlexAuthToken } from '../../../modules/plex/auth';
import { PLEX_TOKEN_HEADER } from '../../../modules/plex/shared/plexUrl';
import { SelectedServerPersistenceAdapter } from '../../server-selection/SelectedServerPersistenceAdapter';
import { EpgPreferencesStore } from '../../../modules/settings/EpgPreferencesStore';
import { ProfileSessionStore } from '../../../modules/settings/ProfileSessionStore';
import {
    InitializationCoordinator,
    STARTUP_PHASE,
    type InitializationCallbacks,
    type InitializationDependencies,
} from '../InitializationCoordinator';
import { createDeferred } from '../../../__tests__/helpers';
import { PlexDiscoverySelectionContext } from '../../../modules/plex/discovery/PlexDiscoverySelectionContext';
import type { PlexSavedServerRestoreResult } from '../../../modules/plex/discovery';

const config: PlexAuthConfig = {
    clientIdentifier: 'integration-client', product: 'Lineup', version: '1', platform: 'webOS',
    platformVersion: '6', device: 'TV', deviceName: 'TV',
};
const accountToken: PlexAuthToken = {
    token: 'account-token', userId: 'account-user', username: 'account',
    email: 'account@example.com', thumb: 'account-thumb',
    expiresAt: null, issuedAt: new Date('2026-01-01T00:00:00Z'),
};
const activeToken: PlexAuthToken = {
    token: 'active-token', userId: 'active-user', username: 'active-before-validation',
    email: 'active-before@example.com', thumb: 'active-before-thumb',
    expiresAt: null, issuedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('selected-server auth resume integration', () => {
    it('revalidates queued phase 3 after eventless metadata authority supersedes the active pass', async () => {
        localStorage.clear();
        const auth = new PlexAuth(config);
        auth.storeCredentials({
            accountToken,
            activeToken,
            activeUserId: 'active-user',
            selectedServerByUserId: {
                'account-user': { serverId: 'account-server', serverUri: 'http://account-server' },
                'active-user': { serverId: 'old-active-server', serverUri: 'http://old-active-server' },
            },
            deviceKey: {
                kid: 'device-key',
                privateKey: 'private-key',
                createdAt: new Date('2026-01-02T00:00:00Z'),
                publicJwk: { kty: 'OKP', crv: 'Ed25519', x: 'public-x', alg: 'EdDSA' },
            },
        });
        const firstDiscoveryStarted = createDeferred<() => void>();
        const selectionContext = new PlexDiscoverySelectionContext();
        const createRestoreResult = (): PlexSavedServerRestoreResult => {
            const receipt = selectionContext.issueReceipt(selectionContext.capture(), 'selected');
            return { kind: 'already_selected' as const, serverId: 'server-1', receipt };
        };
        let discoveryCalls = 0;
        const discovery = {
            initialize: jest.fn(() => {
                discoveryCalls += 1;
                if (discoveryCalls === 1) {
                    return new Promise((resolve) => {
                        firstDiscoveryStarted.resolve(
                            (): void => resolve(createRestoreResult())
                        );
                    });
                }
                return Promise.resolve(createRestoreResult());
            }),
            isConnected: jest.fn().mockReturnValue(true),
            getSelectionReceiptSignal: jest.fn((receipt) => selectionContext.getReceiptSignal(receipt)),
            assertSelectionReceiptCurrent: jest.fn((receipt) => selectionContext.assertReceiptCurrent(receipt)),
            on: jest.fn(() => ({ dispose: jest.fn() })),
        };
        const setReady = jest.fn();
        const setupEventWiring = jest.fn();
        const updateModuleStatus = jest.fn();
        const openServerSelect = jest.fn();
        const navigation = {
            getCurrentScreen: jest.fn().mockReturnValue('player'),
            goTo: jest.fn(), replaceScreen: jest.fn(), initialize: jest.fn(),
        };
        const dependencies = {
            modules: {
                lifecycle: null,
                navigation,
                plexAuth: auth,
                plexDiscovery: discovery,
                plexLibrary: {}, plexStreamResolver: {}, channelManager: null, scheduler: null,
                videoPlayer: null, epg: null,
            },
            readiness: { epg: null },
            overlays: {
                playerOsd: null, channelNumberOverlay: null, channelBadgeOverlay: null,
                miniGuide: null, channelTransition: null,
            },
            startupUiInitializer: { ensureCorePlayerUiInitialized: jest.fn().mockResolvedValue(undefined) },
            epgDebugRuntime: null,
            stores: {
                epgPreferencesStore: new EpgPreferencesStore(),
                profileSessionStore: new ProfileSessionStore(),
            },
        } as unknown as InitializationDependencies;
        const callbacks = {
            status: { updateModuleStatus, getModuleStatus: jest.fn() },
            errors: { handleGlobalError: jest.fn() },
            diagnostics: { reportRecoverableAsyncFailure: jest.fn() },
            state: { setReady, setupEventWiring },
            serverStorage: {
                configureDiscoveryStorage: jest.fn(),
                configureChannelManagerStorage: jest.fn().mockResolvedValue(undefined),
                getSelectedServerId: jest.fn().mockReturnValue(null),
            },
            routing: {
                shouldRunAudioSetup: jest.fn().mockReturnValue(false),
                shouldRunChannelSetup: jest.fn().mockReturnValue(false),
                switchToChannel: jest.fn().mockResolvedValue({ kind: 'switched' }),
                openServerSelect,
            },
            resources: { buildPlexResourceUrl: jest.fn().mockReturnValue(null) },
            epgWarmup: { warmCurrentViewportForStartup: jest.fn().mockResolvedValue(undefined) },
        } as unknown as InitializationCallbacks;
        const coordinator = new InitializationCoordinator({
            plexConfig: {} as never, navConfig: {} as never, playerConfig: {} as never,
            epgConfig: {} as never, nowPlayingInfoConfig: {} as never, playerOsdConfig: {} as never,
            channelNumberOverlayConfig: {} as never, channelBadgeConfig: {} as never,
            miniGuideConfig: {} as never, channelTransitionConfig: {} as never,
            playbackOptionsConfig: {} as never,
        }, dependencies, callbacks);
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                id: 'active-user', username: 'active-after-validation',
                email: 'active-after@example.com', thumb: 'active-after-thumb',
            }),
        });
        (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;
        const adapter = new SelectedServerPersistenceAdapter({
            getCredentialsPort: (): PlexAuth => auth,
        });

        const firstRun = coordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION);
        const releaseFirstDiscovery = await firstDiscoveryStarted.promise;
        expect(releaseFirstDiscovery).toEqual(expect.any(Function));
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(setReady.mock.calls.map(([ready]) => ready)).toEqual([false]);
        expect(setupEventWiring).not.toHaveBeenCalled();
        expect(openServerSelect).not.toHaveBeenCalled();
        expect(updateModuleStatus.mock.calls).not.toContainEqual([
            'plex-server-discovery', 'ready', undefined, expect.any(Number),
        ]);
        const authEvents: boolean[] = [];
        auth.on('authChange', (authenticated) => authEvents.push(authenticated));
        const persistenceEvidence = adapter.capturePersistenceEvidence();
        expect(adapter.persistCandidateSelection(
            persistenceEvidence,
            'server-1',
            'http://server-1'
        )).toEqual({
            phase: 'candidate',
            state: 'updated',
            publicResult: 'updated',
        });
        const queuedRun = coordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION);
        expect(setupEventWiring).not.toHaveBeenCalled();
        expect(openServerSelect).not.toHaveBeenCalled();
        expect(setReady.mock.calls.map(([ready]) => ready)).toEqual([false]);
        releaseFirstDiscovery();
        await firstRun;
        await queuedRun;

        expect(discovery.initialize).toHaveBeenCalledTimes(2);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls.map(([, options]) =>
            (options.headers as Record<string, string>)[PLEX_TOKEN_HEADER]
        )).toEqual(['active-token', 'active-token']);
        expect(authEvents).toEqual([true]);
        expect(setReady.mock.calls.map(([ready]) => ready)).toEqual([false, false, true]);
        expect(setupEventWiring).toHaveBeenCalledTimes(1);
        expect(openServerSelect).toHaveBeenCalledTimes(1);
        expect(navigation.goTo).not.toHaveBeenCalled();
        expect(navigation.replaceScreen).not.toHaveBeenCalled();
        expect(updateModuleStatus.mock.calls
            .filter(([, status]) => status === 'ready')
            .map(([id]) => id)).toEqual([
            'plex-auth',
            'plex-auth',
            'plex-server-discovery',
            'plex-library',
            'plex-stream-resolver',
        ]);
        const stored = auth.readStoredCredentialsAndClearCorruption();
        expect(stored).toEqual({
            kind: 'available',
            credentials: {
                accountToken,
                activeToken: {
                    token: 'active-token',
                    userId: 'active-user',
                    username: 'active-after-validation',
                    email: 'active-after@example.com',
                    thumb: 'active-after-thumb',
                    preferredSubtitleLanguage: null,
                    expiresAt: null,
                    issuedAt: expect.any(Date),
                },
                activeUserId: 'active-user',
                selectedServerByUserId: {
                    'account-user': {
                        serverId: 'account-server', serverUri: 'http://account-server',
                    },
                    'active-user': { serverId: 'server-1', serverUri: 'http://server-1' },
                },
                deviceKey: {
                    kid: 'device-key',
                    privateKey: 'private-key',
                    createdAt: new Date('2026-01-02T00:00:00Z'),
                    publicJwk: { kty: 'OKP', crv: 'Ed25519', x: 'public-x', alg: 'EdDSA' },
                },
            },
        });
    });
});
