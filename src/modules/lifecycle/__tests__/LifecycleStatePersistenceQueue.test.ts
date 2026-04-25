/**
 * @jest-environment jsdom
 */

import { LifecycleStatePersistenceQueue } from '../LifecycleStatePersistenceQueue';
import { TIMING_CONFIG } from '../constants';
import type { StateManager } from '../StateManager';
import type { PersistentState } from '../types';

describe('LifecycleStatePersistenceQueue', () => {
    let state: PersistentState;
    let stateManager: jest.Mocked<Pick<StateManager, 'save'>>;
    let buildState: jest.Mock<PersistentState>;
    let emitPersistenceWarning: jest.Mock<void, [{ message: string; isQuotaError: boolean; timestamp: number }]>;
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.useFakeTimers();
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
        stateManager = {
            save: jest.fn(),
        };
        buildState = jest.fn(() => state);
        emitPersistenceWarning = jest.fn();
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.useRealTimers();
        warnSpy.mockRestore();
    });

    function createQueue(): LifecycleStatePersistenceQueue {
        return new LifecycleStatePersistenceQueue({
            stateManager: stateManager as unknown as StateManager,
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

        expect(stateManager.save).toHaveBeenCalledTimes(1);
        expect(stateManager.save).toHaveBeenCalledWith(secondState);
    });

    it('rejects pending waiters with the original persistence error', async () => {
        const saveError = new DOMException('Quota exceeded', 'QuotaExceededError');
        stateManager.save.mockImplementation(() => {
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

    it('does not let failed warning observers mask the original save failure', async () => {
        const saveError = new Error('save failed');
        const observerError = new Error('observer failed');
        stateManager.save.mockImplementation(() => {
            throw saveError;
        });
        emitPersistenceWarning.mockImplementation(() => {
            throw observerError;
        });
        const queue = createQueue();

        const savePromise = queue.saveState();
        await queue.flush();

        await expect(savePromise).rejects.toBe(saveError);
        expect(warnSpy).toHaveBeenCalledWith(
            '[AppLifecycle] Persistence warning handler failed',
            observerError
        );
    });

    it('logs a final shutdown flush failure once while rejecting the pending save', async () => {
        const saveError = new DOMException('Quota exceeded', 'QuotaExceededError');
        stateManager.save.mockImplementation(() => {
            throw saveError;
        });
        const queue = createQueue();

        const savePromise = queue.saveState();
        await queue.flush({ finalShutdown: true });

        await expect(savePromise).rejects.toBe(saveError);
        expect(warnSpy).toHaveBeenCalledWith(
            '[AppLifecycle] Final shutdown flush failed',
            expect.objectContaining({
                name: 'QuotaExceededError',
            })
        );
    });
});
