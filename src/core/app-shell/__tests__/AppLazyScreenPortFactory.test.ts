import {
    AppLazyScreenPortFactory,
    createChannelSetupRuntimePort,
    createChannelSetupScreenWorkflowPort,
} from '../AppLazyScreenPortFactory';
import type { ChannelSetupWorkflowPort } from '../../channel-setup/workflow/ChannelSetupWorkflowPort';
import type { ChannelSetupScreenWorkflowPort } from '../../../modules/ui/channel-setup';

type MockRuntimeOrchestrator = {
    requestAuthPin: jest.Mock;
    pollForPin: jest.Mock;
    cancelPin: jest.Mock;
    getHomeUsers: jest.Mock;
    switchHomeUser: jest.Mock;
    useMainAccountProfile: jest.Mock;
    signOutPlex: jest.Mock;
    discoverServers: jest.Mock;
    selectServer: jest.Mock;
    clearSelectedServer: jest.Mock<Promise<void>, []>;
    getSelectedServerStorageKey: jest.Mock;
    getServerHealthStorageKey: jest.Mock;
    getChannelSetupWorkflowPort: jest.Mock;
    getSelectedServerId: jest.Mock;
    openServerSelect: jest.Mock;
    switchToChannelByNumber: jest.Mock;
    openEPG: jest.Mock;
    requestChannelSetupRerun: jest.Mock;
    setSubtitleTrack: jest.Mock;
    onGuideSettingChange: jest.Mock;
    getActiveUsername: jest.Mock;
    getTheme: jest.Mock;
    setTheme: jest.Mock;
    getNavigation: jest.Mock;
};

const createScreenWorkflowPort = (): jest.Mocked<ChannelSetupScreenWorkflowPort> => ({
    invalidateFacetSnapshot: jest.fn(),
    getLibrariesForSetup: jest.fn((_signal?: AbortSignal | null) => Promise.resolve([])),
    getChannelSetupRecord: jest.fn((_serverId: string) => null),
    getSetupContextForSelectedServer: jest.fn(() => 'unknown'),
    getSetupPreview: jest.fn((_config, _options) => Promise.resolve({
        estimates: {
            total: 0,
            collections: 0,
            playlists: 0,
            genres: 0,
            directors: 0,
            decades: 0,
            recentlyAdded: 0,
            studios: 0,
            actors: 0,
        },
        warnings: [],
        reachedMaxChannels: false,
    })),
    getSetupReview: jest.fn((_config, _options) => Promise.resolve({
        preview: {
            estimates: {
                total: 0,
                collections: 0,
                playlists: 0,
                genres: 0,
                directors: 0,
                decades: 0,
                recentlyAdded: 0,
                studios: 0,
                actors: 0,
            },
            warnings: [],
            reachedMaxChannels: false,
        },
        diff: {
            summary: { created: 0, removed: 0, unchanged: 0 },
            samples: { created: [], removed: [], unchanged: [] },
        },
    })),
    createChannelsFromSetup: jest.fn((_config, _options) => Promise.resolve({
        created: 0,
        skipped: 0,
        reachedMaxChannels: false,
        errorCount: 0,
        canceled: false,
        lastTask: 'done',
    })),
    markSetupComplete: jest.fn((_serverId, _setupConfig) => {}),
});

const makeOrchestrator = (): MockRuntimeOrchestrator => ({
    requestAuthPin: jest.fn().mockResolvedValue({ id: 1 }),
    pollForPin: jest.fn().mockResolvedValue({ id: 1, authToken: 'token' }),
    cancelPin: jest.fn().mockResolvedValue(undefined),
    getHomeUsers: jest.fn().mockResolvedValue([]),
    switchHomeUser: jest.fn().mockResolvedValue(undefined),
    useMainAccountProfile: jest.fn().mockResolvedValue(undefined),
    signOutPlex: jest.fn().mockResolvedValue(undefined),
    discoverServers: jest.fn().mockResolvedValue([]),
    selectServer: jest.fn().mockResolvedValue({
        kind: 'selected',
        readiness: 'ready',
        persistedSelection: 'updated',
        startupResume: {
            startup: 'completed',
            epgRefresh: { kind: 'succeeded' },
        },
    }),
    clearSelectedServer: jest.fn().mockResolvedValue(undefined),
    getSelectedServerStorageKey: jest.fn().mockReturnValue('selected-server-id'),
    getServerHealthStorageKey: jest.fn().mockReturnValue('server-health'),
    getChannelSetupWorkflowPort: jest.fn().mockReturnValue(createScreenWorkflowPort()),
    getSelectedServerId: jest.fn().mockReturnValue('server-1'),
    openServerSelect: jest.fn(),
    switchToChannelByNumber: jest.fn().mockResolvedValue(undefined),
    openEPG: jest.fn(),
    requestChannelSetupRerun: jest.fn(),
    setSubtitleTrack: jest.fn().mockResolvedValue(undefined),
    onGuideSettingChange: jest.fn(),
    getActiveUsername: jest.fn().mockReturnValue('UnitTestUser'),
    getTheme: jest.fn().mockReturnValue('ember-steel'),
    setTheme: jest.fn(),
    getNavigation: jest.fn().mockReturnValue({ replaceScreen: jest.fn() }),
});

const createFactory = (runtime: MockRuntimeOrchestrator | null): AppLazyScreenPortFactory =>
    new AppLazyScreenPortFactory({
        getNavigationRuntime: (): MockRuntimeOrchestrator | null => runtime,
        getAuthRuntime: (): MockRuntimeOrchestrator | null => runtime,
        getProfileRuntime: (): MockRuntimeOrchestrator | null => runtime,
        getServerSelectionRuntime: (): MockRuntimeOrchestrator | null => runtime,
        getChannelSetupRuntime: () => createChannelSetupRuntimePort(runtime),
        getSettingsRuntime: (): MockRuntimeOrchestrator | null => runtime,
    });

describe('AppLazyScreenPortFactory', () => {
    it('returns null for all screen port creators without an orchestrator', (): void => {
        const factory = createFactory(null);

        expect(factory.createAuthScreenPorts()).toBeNull();
        expect(factory.createProfileSelectScreenPorts()).toBeNull();
        expect(factory.createServerSelectScreenPorts()).toBeNull();
        expect(factory.createChannelSetupScreenInput()).toBeNull();
        expect(factory.createSettingsRuntimePorts()).toBeNull();
        expect(factory.getNavigation()).toBeNull();
    });

    it('creates auth/profile/server ports that stay scoped to each screen contract and delegate to the orchestrator', async (): Promise<void> => {
        const orchestrator = makeOrchestrator();
        const navigation = { replaceScreen: jest.fn() };
        orchestrator.getNavigation.mockReturnValue(navigation);
        const factory = createFactory(orchestrator);

        const authPorts = factory.createAuthScreenPorts();
        const profilePorts = factory.createProfileSelectScreenPorts();
        const serverPorts = factory.createServerSelectScreenPorts();

        expect(authPorts).not.toBeNull();
        expect(profilePorts).not.toBeNull();
        expect(serverPorts).not.toBeNull();

        expect(typeof authPorts?.requestAuthPin).toBe('function');
        expect(typeof authPorts?.pollForPin).toBe('function');
        expect(typeof authPorts?.cancelPin).toBe('function');
        expect(typeof authPorts?.getNavigation).toBe('function');
        expect(typeof profilePorts?.getHomeUsers).toBe('function');
        expect(typeof profilePorts?.switchHomeUser).toBe('function');
        expect(typeof profilePorts?.useMainAccountProfile).toBe('function');
        expect(typeof profilePorts?.signOutPlex).toBe('function');
        expect(typeof profilePorts?.getNavigation).toBe('function');
        expect(typeof serverPorts?.discoverServers).toBe('function');
        expect(typeof serverPorts?.selectServer).toBe('function');
        expect(typeof serverPorts?.clearSelectedServer).toBe('function');
        expect(typeof serverPorts?.getSelectedServerStorageKey).toBe('function');
        expect(typeof serverPorts?.getServerHealthStorageKey).toBe('function');
        expect(typeof serverPorts?.requestChannelSetupRerun).toBe('function');
        expect(typeof serverPorts?.getNavigation).toBe('function');

        await authPorts?.requestAuthPin();
        await authPorts?.pollForPin(123);
        await authPorts?.cancelPin(123);
        expect(authPorts?.getNavigation()).toBe(navigation);

        await profilePorts?.getHomeUsers();
        await profilePorts?.switchHomeUser('user-1', '4321');
        await profilePorts?.useMainAccountProfile();
        await profilePorts?.signOutPlex();
        expect(profilePorts?.getNavigation()).toBe(navigation);

        await serverPorts?.discoverServers(true);
        await expect(serverPorts?.selectServer('server-1')).resolves.toEqual({ kind: 'selected' });
        await serverPorts?.clearSelectedServer();
        expect(serverPorts?.getSelectedServerStorageKey()).toBe('selected-server-id');
        expect(serverPorts?.getServerHealthStorageKey()).toBe('server-health');
        serverPorts?.requestChannelSetupRerun();
        expect(serverPorts?.getNavigation()).toBe(navigation);

        expect(orchestrator.requestAuthPin).toHaveBeenCalledTimes(1);
        expect(orchestrator.pollForPin).toHaveBeenCalledWith(123);
        expect(orchestrator.cancelPin).toHaveBeenCalledWith(123);
        expect(orchestrator.getHomeUsers).toHaveBeenCalledTimes(1);
        expect(orchestrator.switchHomeUser).toHaveBeenCalledWith('user-1', '4321');
        expect(orchestrator.useMainAccountProfile).toHaveBeenCalledTimes(1);
        expect(orchestrator.signOutPlex).toHaveBeenCalledTimes(1);
        expect(orchestrator.discoverServers).toHaveBeenCalledWith(true);
        expect(orchestrator.selectServer).toHaveBeenCalledWith('server-1');
        expect(orchestrator.clearSelectedServer).toHaveBeenCalledTimes(1);
        expect(orchestrator.getSelectedServerStorageKey).toHaveBeenCalledTimes(1);
        expect(orchestrator.getServerHealthStorageKey).toHaveBeenCalledTimes(1);
        expect(orchestrator.requestChannelSetupRerun).toHaveBeenCalledTimes(1);
        expect(orchestrator.getNavigation).toHaveBeenCalledTimes(3);

        expect('selectServer' in (authPorts ?? {})).toBe(false);
        expect('requestAuthPin' in (profilePorts ?? {})).toBe(false);
        expect('switchHomeUser' in (serverPorts ?? {})).toBe(false);
    });

    it('adapts server-select selection failures without exposing orchestrator result details', async (): Promise<void> => {
        const orchestrator = makeOrchestrator();
        orchestrator.selectServer.mockResolvedValueOnce({
            kind: 'selection_failed',
            reason: 'auth_required',
        });
        const factory = createFactory(orchestrator);

        const serverPorts = factory.createServerSelectScreenPorts();

        await expect(serverPorts?.selectServer('server-1')).resolves.toEqual({
            kind: 'selection_failed',
            reason: 'auth_required',
        });
        expect(orchestrator.selectServer).toHaveBeenCalledWith('server-1');
    });

    it('rejects unhandled server-select result kinds instead of treating them as selected', async (): Promise<void> => {
        const orchestrator = makeOrchestrator();
        orchestrator.selectServer.mockResolvedValueOnce({
            kind: 'selection_deferred',
        });
        const factory = createFactory(orchestrator);

        const serverPorts = factory.createServerSelectScreenPorts();

        await expect(serverPorts?.selectServer('server-1')).rejects.toThrow(
            'Unhandled server selection result kind: selection_deferred'
        );
        expect(orchestrator.selectServer).toHaveBeenCalledWith('server-1');
    });

    it('projects the full channel setup workflow port into the screen-only workflow contract', async (): Promise<void> => {
        const fullWorkflowPort: jest.Mocked<ChannelSetupWorkflowPort> = {
            invalidateFacetSnapshot: jest.fn(),
            getLibrariesForSetup: jest.fn().mockResolvedValue([]),
            getChannelSetupRecord: jest.fn().mockReturnValue(null),
            getSetupContextForSelectedServer: jest.fn().mockReturnValue('unknown'),
            getSetupPreview: jest.fn().mockResolvedValue({
                estimates: {
                    total: 0,
                    collections: 0,
                    playlists: 0,
                    genres: 0,
                    directors: 0,
                    decades: 0,
                    recentlyAdded: 0,
                    studios: 0,
                    actors: 0,
                },
                warnings: [],
                reachedMaxChannels: false,
            }),
            getSetupReview: jest.fn().mockResolvedValue({
                preview: {
                    estimates: {
                        total: 0,
                        collections: 0,
                        playlists: 0,
                        genres: 0,
                        directors: 0,
                        decades: 0,
                        recentlyAdded: 0,
                        studios: 0,
                        actors: 0,
                    },
                    warnings: [],
                    reachedMaxChannels: false,
                },
                diff: {
                    summary: { created: 0, removed: 0, unchanged: 0 },
                    samples: { created: [], removed: [], unchanged: [] },
                },
            }),
            getSetupPlanDiagnostics: jest.fn().mockResolvedValue({
                status: 'ready',
                diagnostics: null,
                warnings: [],
                reachedMaxChannels: false,
            }),
            createChannelsFromSetup: jest.fn().mockResolvedValue({
                created: 0,
                skipped: 0,
                reachedMaxChannels: false,
                errorCount: 0,
                canceled: false,
                lastTask: 'done',
            }),
            markSetupComplete: jest.fn(),
        };
        const signal = new AbortController().signal;
        const config = { serverId: 'server-1' } as Parameters<ChannelSetupScreenWorkflowPort['getSetupPreview']>[0];
        const buildOptions = {
            signal,
            onProgress: jest.fn(),
        };

        const screenWorkflowPort = createChannelSetupScreenWorkflowPort(fullWorkflowPort);

        expect(screenWorkflowPort).not.toBe(fullWorkflowPort);
        expect('getSetupPlanDiagnostics' in screenWorkflowPort).toBe(false);

        screenWorkflowPort.invalidateFacetSnapshot();
        await screenWorkflowPort.getLibrariesForSetup(signal);
        screenWorkflowPort.getChannelSetupRecord('server-1');
        screenWorkflowPort.getSetupContextForSelectedServer();
        await screenWorkflowPort.getSetupPreview(config, { signal });
        await screenWorkflowPort.getSetupReview(config, { signal });
        await screenWorkflowPort.createChannelsFromSetup(config, buildOptions);
        screenWorkflowPort.markSetupComplete('server-1', config);

        expect(fullWorkflowPort.invalidateFacetSnapshot).toHaveBeenCalledTimes(1);
        expect(fullWorkflowPort.getLibrariesForSetup).toHaveBeenCalledWith(signal);
        expect(fullWorkflowPort.getChannelSetupRecord).toHaveBeenCalledWith('server-1');
        expect(fullWorkflowPort.getSetupContextForSelectedServer).toHaveBeenCalledTimes(1);
        expect(fullWorkflowPort.getSetupPreview).toHaveBeenCalledWith(config, { signal });
        expect(fullWorkflowPort.getSetupReview).toHaveBeenCalledWith(config, { signal });
        expect(fullWorkflowPort.createChannelsFromSetup).toHaveBeenCalledWith(config, buildOptions);
        expect(fullWorkflowPort.markSetupComplete).toHaveBeenCalledWith('server-1', config);
        expect(fullWorkflowPort.getSetupPlanDiagnostics).not.toHaveBeenCalled();
    });

    it('creates a channel-setup runtime port from the app-shell source runtime', async (): Promise<void> => {
        const orchestrator = makeOrchestrator();
        const workflowPort = createScreenWorkflowPort();
        orchestrator.getChannelSetupWorkflowPort.mockReturnValue(workflowPort);

        const runtimePort = createChannelSetupRuntimePort(orchestrator);
        const screenWorkflowPort = runtimePort?.getChannelSetupScreenWorkflowPort();

        expect(runtimePort).not.toBeNull();
        expect(screenWorkflowPort).not.toBe(workflowPort);
        expect('getSetupPlanDiagnostics' in (screenWorkflowPort ?? {})).toBe(false);
        screenWorkflowPort?.invalidateFacetSnapshot();
        expect(workflowPort.invalidateFacetSnapshot).toHaveBeenCalledTimes(1);
        expect(runtimePort?.getSelectedServerId()).toBe('server-1');
        runtimePort?.openServerSelect();
        runtimePort?.openEPG();
        await runtimePort?.switchToChannelByNumber(12);
        const controller = new AbortController();
        await runtimePort?.switchToChannelByNumber(12, { signal: controller.signal });

        expect(orchestrator.getChannelSetupWorkflowPort).toHaveBeenCalledTimes(1);
        expect(orchestrator.openServerSelect).toHaveBeenCalledTimes(1);
        expect(orchestrator.openEPG).toHaveBeenCalledTimes(1);
        expect(orchestrator.switchToChannelByNumber).toHaveBeenCalledWith(12, undefined);
        expect(orchestrator.switchToChannelByNumber).toHaveBeenCalledWith(12, {
            signal: controller.signal,
        });
    });

    it('returns null channel-setup runtime port without a source runtime', (): void => {
        expect(createChannelSetupRuntimePort(null)).toBeNull();
    });

    it('creates channel-setup input that delegates workflow and screen ports through orchestrator', async (): Promise<void> => {
        const orchestrator = makeOrchestrator();
        const workflowPort = createScreenWorkflowPort();
        orchestrator.getChannelSetupWorkflowPort.mockReturnValue(workflowPort);

        const factory = createFactory(orchestrator);

        const channelSetupInput = factory.createChannelSetupScreenInput();

        expect(channelSetupInput).not.toBeNull();
        expect(channelSetupInput?.workflowPort).not.toBe(workflowPort);
        expect('getSetupPlanDiagnostics' in (channelSetupInput?.workflowPort ?? {})).toBe(false);
        expect('getSelectedServerStorageKey' in (channelSetupInput?.screenPorts ?? {})).toBe(false);
        expect('getServerHealthStorageKey' in (channelSetupInput?.screenPorts ?? {})).toBe(false);
        channelSetupInput?.workflowPort.invalidateFacetSnapshot();

        expect(channelSetupInput?.screenPorts.getSelectedServerId()).toBe('server-1');
        channelSetupInput?.screenPorts.openServerSelect();
        channelSetupInput?.screenPorts.openEPG();
        await channelSetupInput?.screenPorts.switchToChannelByNumber(12);

        expect(orchestrator.openServerSelect).toHaveBeenCalledTimes(1);
        expect(orchestrator.openEPG).toHaveBeenCalledTimes(1);
        expect(orchestrator.getChannelSetupWorkflowPort).toHaveBeenCalledTimes(1);
        expect(workflowPort.invalidateFacetSnapshot).toHaveBeenCalledTimes(1);
        expect(orchestrator.switchToChannelByNumber).toHaveBeenCalledWith(12, undefined);
    });

    it('looks up channel-setup navigation from the current orchestrator at call time', (): void => {
        const firstNavigation = { replaceScreen: jest.fn() };
        const secondNavigation = { replaceScreen: jest.fn() };
        const firstOrchestrator = makeOrchestrator();
        const secondOrchestrator = makeOrchestrator();
        firstOrchestrator.getNavigation.mockReturnValue(firstNavigation);
        secondOrchestrator.getNavigation.mockReturnValue(secondNavigation);

        let currentOrchestrator: MockRuntimeOrchestrator = firstOrchestrator;
        const factory = new AppLazyScreenPortFactory({
            getNavigationRuntime: (): MockRuntimeOrchestrator => currentOrchestrator,
            getAuthRuntime: (): MockRuntimeOrchestrator => currentOrchestrator,
            getProfileRuntime: (): MockRuntimeOrchestrator => currentOrchestrator,
            getServerSelectionRuntime: (): MockRuntimeOrchestrator => currentOrchestrator,
            getChannelSetupRuntime: (): ReturnType<typeof createChannelSetupRuntimePort> =>
                createChannelSetupRuntimePort(currentOrchestrator),
            getSettingsRuntime: (): MockRuntimeOrchestrator => currentOrchestrator,
        });

        const channelSetupInput = factory.createChannelSetupScreenInput();
        expect(channelSetupInput?.screenPorts.getNavigation()).toBe(firstNavigation);

        currentOrchestrator = secondOrchestrator;

        expect(channelSetupInput?.screenPorts.getNavigation()).toBe(secondNavigation);
    });

    it('creates settings runtime ports for subtitle reset and guide-setting updates', async (): Promise<void> => {
        const orchestrator = makeOrchestrator();
        const factory = createFactory(orchestrator);

        const settingsRuntimePorts = factory.createSettingsRuntimePorts();
        expect(settingsRuntimePorts).not.toBeNull();
        expect(settingsRuntimePorts?.getActiveUsername()).toBe('UnitTestUser');
        expect(settingsRuntimePorts?.getTheme()).toBe('ember-steel');

        await settingsRuntimePorts?.clearSubtitleTrack();
        settingsRuntimePorts?.onGuideSettingChange({ key: 'categoryColors', enabled: true });
        settingsRuntimePorts?.setTheme('glass');

        expect(orchestrator.setSubtitleTrack).toHaveBeenCalledWith(null);
        expect(orchestrator.onGuideSettingChange).toHaveBeenCalledWith({ key: 'categoryColors', enabled: true });
        expect(orchestrator.setTheme).toHaveBeenCalledWith('glass');
    });
});
