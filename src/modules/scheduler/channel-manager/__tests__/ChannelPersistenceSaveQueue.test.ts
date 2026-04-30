import { AppErrorCode } from '../../../../types/app-errors';
import { ChannelPersistenceSaveQueue } from '../ChannelPersistenceSaveQueue';

const createDisposedError = (): Error =>
    Object.assign(new Error('ChannelManager disposed'), {
        name: 'ChannelError',
        code: AppErrorCode.CHANNEL_MANAGER_DISPOSED,
        recoverable: false,
    });

describe('ChannelPersistenceSaveQueue', () => {
    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('rejects save attempts after dispose without scheduling a timer', async () => {
        jest.useFakeTimers();
        const runSave = jest.fn();
        const queue = new ChannelPersistenceSaveQueue({
            runSave,
            createDisposedError,
            emitPersistenceWarning: jest.fn(),
            logger: { warn: jest.fn(), error: jest.fn() },
        });

        queue.dispose();

        await expect(queue.save()).rejects.toThrow('ChannelManager disposed');
        expect(jest.getTimerCount()).toBe(0);
        expect(runSave).not.toHaveBeenCalled();
    });

    it('ignores queued saves after dispose without scheduling a timer', () => {
        jest.useFakeTimers();
        const runSave = jest.fn();
        const queue = new ChannelPersistenceSaveQueue({
            runSave,
            createDisposedError,
            emitPersistenceWarning: jest.fn(),
            logger: { warn: jest.fn(), error: jest.fn() },
        });

        queue.dispose();
        queue.queue();

        expect(jest.getTimerCount()).toBe(0);
        expect(runSave).not.toHaveBeenCalled();
    });
});
