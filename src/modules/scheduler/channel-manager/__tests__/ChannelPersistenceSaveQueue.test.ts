import { AppErrorCode } from '../../../../types/app-errors';
import { STORAGE_QUOTA_EXCEEDED_MESSAGE } from '../../../../shared/persistenceMessages';
import { PersistenceWarningBackoffPolicy } from '../../../../utils/persistenceWarningBackoffPolicy';
import { ChannelPersistenceSaveQueue } from '../persistence/ChannelPersistenceSaveQueue';

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

    it('uses the shared warning policy while preserving the channel warning payload', () => {
        jest.useFakeTimers().setSystemTime(20_000);
        const shouldEmitSpy = jest.spyOn(
            PersistenceWarningBackoffPolicy.prototype,
            'shouldEmitWarning'
        );
        const emitPersistenceWarning = jest.fn();
        const queue = new ChannelPersistenceSaveQueue({
            runSave: jest.fn(),
            createDisposedError,
            emitPersistenceWarning,
            logger: { warn: jest.fn(), error: jest.fn() },
        });
        const quotaError = new DOMException('quota', 'QuotaExceededError');

        expect(queue.emitWarning(quotaError)).toBe(true);

        expect(shouldEmitSpy).toHaveBeenCalledWith(true);
        expect(emitPersistenceWarning).toHaveBeenCalledWith({
            message: STORAGE_QUOTA_EXCEEDED_MESSAGE,
            code: AppErrorCode.STORAGE_QUOTA_EXCEEDED,
            isQuotaError: true,
            timestamp: 20_000,
        });
    });

    it('resets the shared warning policy after a successful save', () => {
        jest.useFakeTimers().setSystemTime(30_000);
        const resetAllSpy = jest.spyOn(PersistenceWarningBackoffPolicy.prototype, 'resetAll');
        const emitPersistenceWarning = jest.fn();
        const queue = new ChannelPersistenceSaveQueue({
            runSave: jest.fn(),
            createDisposedError,
            emitPersistenceWarning,
            logger: { warn: jest.fn(), error: jest.fn() },
        });
        const quotaError = new DOMException('quota', 'QuotaExceededError');

        expect(queue.emitWarning(quotaError)).toBe(true);
        expect(queue.emitWarning(quotaError)).toBe(false);

        queue.markSuccess();

        expect(resetAllSpy).toHaveBeenCalled();
        expect(queue.emitWarning(quotaError)).toBe(true);
        expect(emitPersistenceWarning).toHaveBeenCalledTimes(2);
    });
});
