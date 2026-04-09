import { AppLazyScreenPortFactory } from '../AppLazyScreenPortFactory';

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
    clearSelectedServer: jest.Mock;
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
    getNavigation: jest.Mock;
};

const makeOrchestrator = (): MockRuntimeOrchestrator => ({
    requestAuthPin: jest.fn().mockResolvedValue({ id: 1 }),
    pollForPin: jest.fn().mockResolvedValue({ id: 1, authToken: 'token' }),
    cancelPin: jest.fn().mockResolvedValue(undefined),
    getHomeUsers: jest.fn().mockResolvedValue([]),
    switchHomeUser: jest.fn().mockResolvedValue(undefined),
    useMainAccountProfile: jest.fn().mockResolvedValue(undefined),
    signOutPlex: jest.fn().mockResolvedValue(undefined),
    discoverServers: jest.fn().mockResolvedValue([]),
    selectServer: jest.fn().mockResolvedValue({ kind: 'selected', readiness: 'ready', persistedSelection: 'updated' }),
    clearSelectedServer: jest.fn(),
    getSelectedServerStorageKey: jest.fn().mockReturnValue('selected-server-id'),
    getServerHealthStorageKey: jest.fn().mockReturnValue('server-health'),
    getChannelSetupWorkflowPort: jest.fn().mockReturnValue({ id: 'workflow-port' }),
    getSelectedServerId: jest.fn().mockReturnValue('server-1'),
    openServerSelect: jest.fn(),
    switchToChannelByNumber: jest.fn().mockResolvedValue(undefined),
    openEPG: jest.fn(),
    requestChannelSetupRerun: jest.fn(),
    setSubtitleTrack: jest.fn().mockResolvedValue(undefined),
    onGuideSettingChange: jest.fn(),
    getActiveUsername: jest.fn().mockReturnValue('UnitTestUser'),
    getNavigation: jest.fn().mockReturnValue({ replaceScreen: jest.fn() }),
});

describe('AppLazyScreenPortFactory', () => {
    it('returns null for all screen port creators without an orchestrator', (): void => {
        const factory = new AppLazyScreenPortFactory({
            getOrchestrator: (): MockRuntimeOrchestrator | null => null,
        });

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
        const factory = new AppLazyScreenPortFactory({
            getOrchestrator: (): MockRuntimeOrchestrator => orchestrator,
        });

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
        await serverPorts?.selectServer('server-1');
        serverPorts?.clearSelectedServer();
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

    it('creates channel-setup input that delegates workflow and screen ports through orchestrator', async (): Promise<void> => {
        const orchestrator = makeOrchestrator();
        const workflowPort = { id: 'workflow-port' };
        orchestrator.getChannelSetupWorkflowPort.mockReturnValue(workflowPort);

        const factory = new AppLazyScreenPortFactory({
            getOrchestrator: (): MockRuntimeOrchestrator => orchestrator,
        });

        const channelSetupInput = factory.createChannelSetupScreenInput();

        expect(channelSetupInput).not.toBeNull();
        expect(channelSetupInput?.workflowPort).toBe(workflowPort);

        expect(channelSetupInput?.screenPorts.getSelectedServerStorageKey()).toBe('selected-server-id');
        expect(channelSetupInput?.screenPorts.getServerHealthStorageKey()).toBe('server-health');
        expect(channelSetupInput?.screenPorts.getSelectedServerId()).toBe('server-1');
        channelSetupInput?.screenPorts.openServerSelect();
        channelSetupInput?.screenPorts.openEPG();
        await channelSetupInput?.screenPorts.switchToChannelByNumber(12);

        expect(orchestrator.openServerSelect).toHaveBeenCalledTimes(1);
        expect(orchestrator.openEPG).toHaveBeenCalledTimes(1);
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
            getOrchestrator: (): MockRuntimeOrchestrator => currentOrchestrator,
        });

        const channelSetupInput = factory.createChannelSetupScreenInput();
        expect(channelSetupInput?.screenPorts.getNavigation()).toBe(firstNavigation);

        currentOrchestrator = secondOrchestrator;

        expect(channelSetupInput?.screenPorts.getNavigation()).toBe(secondNavigation);
    });

    it('creates settings runtime ports for subtitle reset and guide-setting updates', async (): Promise<void> => {
        const orchestrator = makeOrchestrator();
        const factory = new AppLazyScreenPortFactory({
            getOrchestrator: (): MockRuntimeOrchestrator => orchestrator,
        });

        const settingsRuntimePorts = factory.createSettingsRuntimePorts();
        expect(settingsRuntimePorts).not.toBeNull();
        expect(settingsRuntimePorts?.getActiveUsername()).toBe('UnitTestUser');

        await settingsRuntimePorts?.clearSubtitleTrack();
        settingsRuntimePorts?.onGuideSettingChange({ key: 'categoryColors', enabled: true });

        expect(orchestrator.setSubtitleTrack).toHaveBeenCalledWith(null);
        expect(orchestrator.onGuideSettingChange).toHaveBeenCalledWith({ key: 'categoryColors', enabled: true });
    });
});
