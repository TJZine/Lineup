import { createDefaultPlexAuthConfig } from '../../modules/plex/auth';
import { DebugOverridesStore } from '../../modules/debug/DebugOverridesStore';
import { DeveloperSettingsStore } from '../../modules/settings/DeveloperSettingsStore';
import { createWebOsPlatformServices } from '../../platform';
import { createOrchestratorModules } from '../../core/orchestrator/assembly/OrchestratorModuleFactory';
import type { OrchestratorConfig } from '../../core/orchestrator/contracts/OrchestratorTypes';
import { PlexServerDiscovery } from '../../modules/plex/discovery';
import { PLEX_TOKEN_HEADER } from '../../modules/plex/shared/plexUrl';

describe('createOrchestratorModules wiring', () => {
    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('wires sleep timer sleep + tick callbacks to pause playback and onSleepTimerTick', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2020-01-01T00:00:00Z'));

        const onSleepTimerTick = jest.fn();
        const platformServices = createWebOsPlatformServices();
        const modules = createOrchestratorModules({
            config: {
                plexConfig: createDefaultPlexAuthConfig('test-client'),
            } as unknown as OrchestratorConfig,
            platformServices,
            debugOverridesStore: new DebugOverridesStore(),
            developerSettingsStore: new DeveloperSettingsStore(),
            onSleepTimerTick,
        });

        const pauseSpy = jest.spyOn(modules.videoPlayer, 'pause').mockImplementation(() => undefined);

        modules.sleepTimer.start(1);
        jest.advanceTimersByTime(60_000);

        expect(pauseSpy).toHaveBeenCalled();
        expect(onSleepTimerTick).toHaveBeenCalled();
        expect(modules.epgReadinessPort).toBe(modules.epg);

        pauseSpy.mockRestore();
        modules.sleepTimer.destroy();
    });

    it('wires library images, stream URLs, and playback headers to the selected PMS resource credential', async () => {
        const serverUri = 'https://selected.example:32400';
        const pmsToken = 'factory-pms-resource-token';
        const cloudToken = 'factory-cloud-token';
        jest.spyOn(PlexServerDiscovery.prototype, 'getServerUri').mockReturnValue(serverUri);
        jest.spyOn(PlexServerDiscovery.prototype, 'getSelectedServerAuthHeaders').mockReturnValue({
            [PLEX_TOKEN_HEADER]: pmsToken,
            'X-Plex-Client-Identifier': 'test-client',
        });
        jest.spyOn(PlexServerDiscovery.prototype, 'getSelectedServerAccessToken').mockReturnValue(pmsToken);

        const platformServices = createWebOsPlatformServices();
        const modules = createOrchestratorModules({
            config: {
                plexConfig: createDefaultPlexAuthConfig('test-client'),
            } as unknown as OrchestratorConfig,
            platformServices,
            debugOverridesStore: new DebugOverridesStore(),
            developerSettingsStore: new DeveloperSettingsStore(),
            onSleepTimerTick: jest.fn(),
        });
        const accountToken = {
            token: cloudToken,
            userId: 'account-user',
            username: 'account-user',
            email: 'account@example.com',
            thumb: '',
            expiresAt: null,
            issuedAt: new Date('2026-01-01T00:00:00Z'),
        };
        modules.plexAuth.storeCredentials({
            accountToken,
            activeToken: accountToken,
            activeUserId: accountToken.userId,
            selectedServerByUserId: {
                [accountToken.userId]: { serverId: null, serverUri: null },
            },
        });
        const fetchMock = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
            expect(new Headers(init?.headers).get(PLEX_TOKEN_HEADER)).toBe(pmsToken);
            expect(new Headers(init?.headers).get(PLEX_TOKEN_HEADER)).not.toBe(cloudToken);
            return new Response(JSON.stringify({ MediaContainer: { Directory: [] } }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            });
        });
        (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

        await expect(modules.plexLibrary.getLibraries()).resolves.toEqual([]);
        expect(modules.plexLibrary.getImageUrl('/library/metadata/1/thumb')).toContain(
            `X-Plex-Token=${pmsToken}`
        );
        const transcodeUrl = modules.plexStreamResolver.getTranscodeUrl('1', {});
        expect(transcodeUrl).toContain(`X-Plex-Token=${pmsToken}`);
        expect(transcodeUrl).not.toContain(cloudToken);
        expect(modules.plexDiscovery.getSelectedServerAuthHeaders()).toMatchObject({
            [PLEX_TOKEN_HEADER]: pmsToken,
        });
    });
});
