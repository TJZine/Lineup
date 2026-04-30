import { OrchestratorChannelSwitchRuntime } from '../OrchestratorChannelSwitchRuntime';
import { AppErrorCode } from '../../../types/app-errors';
import type { OrchestratorChannelSwitchRuntimeDeps } from '../OrchestratorChannelSwitchRuntime';

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

        await expect(runtime.switchToChannelWithOutcome('channel-1')).resolves.toBe('failed');

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

        await expect(runtime.switchToChannelWithOutcome('channel-1')).resolves.toBe('aborted');

        expect(deps.reportError).not.toHaveBeenCalled();
    });
});
