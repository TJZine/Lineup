import { OrchestratorChannelSwitchRuntime } from '../runtime/OrchestratorChannelSwitchRuntime';
import { AppErrorCode } from '../../../types/app-errors';
import type { OrchestratorChannelSwitchRuntimeDeps } from '../runtime/OrchestratorChannelSwitchRuntime';

const createDeps = (
    overrides: Partial<OrchestratorChannelSwitchRuntimeDeps> = {}
): jest.Mocked<OrchestratorChannelSwitchRuntimeDeps> => ({
    assertNotShutdown: jest.fn(),
    getChannelTuning: jest.fn(() => null),
    getChannelManager: jest.fn(() => null),
    getScheduler: jest.fn(() => null),
    getVideoPlayer: jest.fn(() => null),
    reportIssue: jest.fn(),
    reportError: jest.fn(),
    ...overrides,
} as jest.Mocked<OrchestratorChannelSwitchRuntimeDeps>);

describe('OrchestratorChannelSwitchRuntime', () => {
    it('delegates suspension and gates next/previous channel adapters while suspended', async () => {
        const channelTuning = {
            suspendAndDrainForScopeTransition: jest.fn().mockResolvedValue(undefined),
            isSuspended: jest.fn().mockReturnValue(true),
            switchToChannel: jest.fn(),
        };
        const channelManager = {
            getNextChannel: jest.fn(),
            getPreviousChannel: jest.fn(),
        };
        const runtime = new OrchestratorChannelSwitchRuntime(createDeps({
            getChannelTuning: jest.fn(() => channelTuning as never),
            getChannelManager: jest.fn(() => channelManager as never),
        }));

        await runtime.suspendAndDrainForScopeTransition();
        runtime.switchToNextChannel();
        runtime.switchToPreviousChannel();

        expect(channelTuning.suspendAndDrainForScopeTransition).toHaveBeenCalledTimes(1);
        expect(channelManager.getNextChannel).not.toHaveBeenCalled();
        expect(channelManager.getPreviousChannel).not.toHaveBeenCalled();
        expect(channelTuning.switchToChannel).not.toHaveBeenCalled();
    });

    it('checks shutdown before number-based outcome switches read channel tuning', async () => {
        const shutdownError = Object.assign(
            new Error('AppOrchestrator cannot be used after shutdown; create a new instance.'),
            {
                code: AppErrorCode.MODULE_INIT_FAILED,
                recoverable: false,
                context: {
                    method: 'switchToChannelByNumber',
                    lifecycle: 'shutdown',
                },
            }
        );
        const getChannelTuning = jest.fn();
        const runtime = new OrchestratorChannelSwitchRuntime(createDeps({
            assertNotShutdown: jest.fn(() => {
                throw shutdownError;
            }),
            getChannelTuning,
        }));

        await expect(runtime.switchToChannelByNumberWithOutcome(7)).rejects.toBe(shutdownError);
        expect(getChannelTuning).not.toHaveBeenCalled();
    });

    it('reports non-abort ID-based outcome switch failures and returns failed', async () => {
        const switchError = new Error('switch failed');
        const channelTuning = {
            switchToChannel: jest.fn().mockRejectedValue(switchError),
        };
        const deps = createDeps({
            getChannelTuning: jest.fn(() => channelTuning as never),
        });
        const runtime = new OrchestratorChannelSwitchRuntime(deps);

        await expect(runtime.switchToChannelWithOutcome('channel-1')).resolves.toEqual(expect.objectContaining({ kind: 'failed' }));

        expect(channelTuning.switchToChannel).toHaveBeenCalledWith('channel-1', undefined);
        expect(deps.reportError).toHaveBeenCalledWith(
            'orchestrator.channelSwitch.idOutcome',
            'switchToChannelWithOutcome failed',
            switchError
        );
    });

    it('returns aborted for abort-like ID-based outcome switch failures without reporting an error', async () => {
        const abortError = { name: 'AbortError' };
        const channelTuning = {
            switchToChannel: jest.fn().mockRejectedValue(abortError),
        };
        const deps = createDeps({
            getChannelTuning: jest.fn(() => channelTuning as never),
        });
        const runtime = new OrchestratorChannelSwitchRuntime(deps);

        await expect(runtime.switchToChannelWithOutcome('channel-1')).resolves.toEqual({ kind: 'aborted' });

        expect(deps.reportError).not.toHaveBeenCalled();
    });

    it('reports non-abort number-based outcome switch failures and returns failed', async () => {
        const switchError = new Error('switch failed');
        const channelTuning = {
            switchToChannelByNumber: jest.fn().mockRejectedValue(switchError),
        };
        const deps = createDeps({
            getChannelTuning: jest.fn(() => channelTuning as never),
        });
        const runtime = new OrchestratorChannelSwitchRuntime(deps);

        await expect(runtime.switchToChannelByNumberWithOutcome(7)).resolves.toEqual(expect.objectContaining({ kind: 'failed' }));

        expect(channelTuning.switchToChannelByNumber).toHaveBeenCalledWith(7, undefined);
        expect(deps.reportError).toHaveBeenCalledWith(
            'orchestrator.channelSwitch.byNumberOutcome',
            'switchToChannelByNumberWithOutcome failed',
            switchError
        );
    });

    it('returns aborted for abort-like number-based outcome switch failures without reporting an error', async () => {
        const abortError = { name: 'AbortError' };
        const channelTuning = {
            switchToChannelByNumber: jest.fn().mockRejectedValue(abortError),
        };
        const deps = createDeps({
            getChannelTuning: jest.fn(() => channelTuning as never),
        });
        const runtime = new OrchestratorChannelSwitchRuntime(deps);

        await expect(runtime.switchToChannelByNumberWithOutcome(7)).resolves.toEqual({ kind: 'aborted' });

        expect(channelTuning.switchToChannelByNumber).toHaveBeenCalledWith(7, undefined);
        expect(deps.reportError).not.toHaveBeenCalled();
    });
});
