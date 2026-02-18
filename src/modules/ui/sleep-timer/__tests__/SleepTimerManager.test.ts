import { SleepTimerManager } from '../SleepTimerManager';

describe('SleepTimerManager', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('fires onSleep when timer expires', () => {
        const callbacks = {
            onWarning: jest.fn(),
            onSleep: jest.fn(),
            onCancel: jest.fn(),
            onTick: jest.fn(),
        };
        const manager = new SleepTimerManager(callbacks);
        manager.start(1);
        jest.advanceTimersByTime(61_000);
        expect(callbacks.onSleep).toHaveBeenCalledTimes(1);
        manager.destroy();
    });
});
