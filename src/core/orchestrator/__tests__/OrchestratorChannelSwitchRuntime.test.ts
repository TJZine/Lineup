import { OrchestratorChannelSwitchRuntime } from '../OrchestratorChannelSwitchRuntime';
import { AppErrorCode } from '../../../types/app-errors';

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
        const runtime = new OrchestratorChannelSwitchRuntime({
            assertNotShutdown: jest.fn(() => {
                throw shutdownError;
            }),
            getChannelTuning,
            getChannelManager: jest.fn(() => null),
            getScheduler: jest.fn(() => null),
            getVideoPlayer: jest.fn(() => null),
            reportIssue: jest.fn(),
            reportError: jest.fn(),
        });

        await expect(runtime.switchToChannelByNumberWithOutcome(7)).rejects.toBe(shutdownError);
        expect(getChannelTuning).not.toHaveBeenCalled();
    });
});
