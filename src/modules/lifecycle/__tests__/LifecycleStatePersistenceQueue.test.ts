/**
 * @jest-environment jsdom
 */

import { LifecycleStatePersistenceQueue } from '../LifecycleStatePersistenceQueue';
import { TIMING_CONFIG } from '../constants';
import type { LifecycleStateStore } from '../LifecycleStateStore';
import type { PersistentState } from '../types';
import { PersistenceWarningBackoffPolicy } from '../../../utils/persistenceWarningBackoffPolicy';

describe('LifecycleStatePersistenceQueue', () => {
    let state: PersistentState;
    let lifecycleStateStore: jest.Mocked<Pick<LifecycleStateStore, 'save'>>;
    let buildState: jest.MockedFunction<() => PersistentState>;
    let emitPersistenceWarning: jest.MockedFunction<
        (arg: { message: string; isQuotaError: boolean; timestamp: number }) => void
    >;
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.useFakeTimers().setSystemTime(10_000);
        state = {
            version: 1,
            userPreferences: {
                theme: 'dark',
                volume: 70,
                subtitleLanguage: null,
                audioLanguage: null,
            },
            lastUpdated: 1,
        };
        lifecycleStateStore = {
            save: jest.fn(),
        };
        buildState = jest.fn(() => state);
        emitPersistenceWarning = jest.fn();
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    function createQueue(): LifecycleStatePersistenceQueue {
        return new LifecycleStatePersistenceQueue({
            lifecycleStateStore: lifecycleStateStore as unknown as LifecycleStateStore,
            buildState,
            emitPersistenceWarning,
        });
    }

    it('replaces pending state before the debounced flush and resolves all waiters', async () => {
        const queue = createQueue();
        const firstState = { ...state, lastUpdated: 1 };
        const secondState = { ...state, lastUpdated: 2 };
        buildState.mockReturnValueOnce(firstState).mockReturnValueOnce(secondState);

        const firstSave = queue.saveState();
        const secondSave = queue.saveState();

        jest.advanceTimersByTime(TIMING_CONFIG.SAVE_DEBOUNCE_MS);
        await expect(Promise.all([firstSave, secondSave])).resolves.toEqual([undefined, undefined]);

        expect(lifecycleStateStore.save).toHaveBeenCalledTimes(1);
        expect(lifecycleStateStore.save).toHaveBeenCalledWith(secondState);
    });

    it('rejects pending waiters with the original persistence error', async () => {
        const saveError = new DOMException('Quota exceeded', 'QuotaExceededError');
        lifecycleStateStore.save.mockImplementation(() => {
            throw saveError;
        });
        const queue = createQueue();

        const savePromise = queue.saveState();
        jest.advanceTimersByTime(TIMING_CONFIG.SAVE_DEBOUNCE_MS);

        await expect(savePromise).rejects.toBe(saveError);
        expect(emitPersistenceWarning).toHaveBeenCalledWith(
            expect.objectContaining({
                isQuotaError: true,
            })
        );
    });

    it('uses the shared warning policy while preserving the lifecycle warning payload', async () => {
        const shouldEmitSpy = jest.spyOn(
            PersistenceWarningBackoffPolicy.prototype,
            'shouldEmitWarning'
        );
        const resetQuotaSpy = jest.spyOn(
            PersistenceWarningBackoffPolicy.prototype,
            'resetQuotaBackoff'
        );
        const saveError = new DOMException('Quota exceeded', 'QuotaExceededError');
        lifecycleStateStore.save.mockImplementationOnce(() => {
            throw saveError;
        });
        const queue = createQueue();

        const failedSave = queue.saveState();
        jest.advanceTimersByTime(TIMING_CONFIG.SAVE_DEBOUNCE_MS);

        await expect(failedSave).rejects.toBe(saveError);
        expect(shouldEmitSpy).toHaveBeenCalledWith(true);
        expect(emitPersistenceWarning).toHaveBeenCalledWith({
            message: 'Persistent storage quota exceeded; save deferred',
            isQuotaError: true,
            timestamp: 10_000 + TIMING_CONFIG.SAVE_DEBOUNCE_MS,
        });

        const successfulSave = queue.saveState();
        jest.advanceTimersByTime(TIMING_CONFIG.SAVE_DEBOUNCE_MS);

        await expect(successfulSave).resolves.toBeUndefined();
        expect(resetQuotaSpy).toHaveBeenCalled();
    });

    it('does not let failed warning observers mask the original save failure', async () => {
        const saveError = new Error('save failed');
        const observerError = new Error('observer failed');
        lifecycleStateStore.save.mockImplementation(() => {
            throw saveError;
        });
        emitPersistenceWarning.mockImplementation(() => {
            throw observerError;
        });
        const queue = createQueue();

        const savePromise = queue.saveState();
        const saveExpectation = expect(savePromise).rejects.toBe(saveError);

        await expect(queue.flush()).rejects.toBe(saveError);
        await saveExpectation;
        expect(warnSpy).toHaveBeenCalledWith(
            'Persistence warning handler failed',
            {
                subsystem: 'lifecycle',
                error: expect.objectContaining({
                    name: 'Error',
                    message: 'observer failed',
                }),
            }
        );
    });

    it('rejects direct non-final flush calls with the original persistence error', async () => {
        const saveError = new Error('save failed');
        lifecycleStateStore.save.mockImplementation(() => {
            throw saveError;
        });
        const queue = createQueue();

        const savePromise = queue.saveState();
        const saveExpectation = expect(savePromise).rejects.toBe(saveError);

        await expect(queue.flush()).rejects.toBe(saveError);
        await saveExpectation;
        expect(emitPersistenceWarning).toHaveBeenCalledWith(
            expect.objectContaining({
                isQuotaError: false,
            })
        );
    });

    it('logs a final shutdown flush failure once while rejecting the pending save', async () => {
        const saveError = new DOMException('Quota exceeded', 'QuotaExceededError');
        lifecycleStateStore.save.mockImplementation(() => {
            throw saveError;
        });
        const queue = createQueue();

        const savePromise = queue.saveState();
        await queue.flush({ finalShutdown: true });

        await expect(savePromise).rejects.toBe(saveError);
        expect(warnSpy).toHaveBeenCalledWith(
            'Final shutdown flush failed',
            expect.objectContaining({
                subsystem: 'lifecycle',
                error: expect.objectContaining({
                    name: 'QuotaExceededError',
                }),
            })
        );
        expect(emitPersistenceWarning).not.toHaveBeenCalled();
    });
});
