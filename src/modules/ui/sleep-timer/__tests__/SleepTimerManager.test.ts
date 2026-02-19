import { SleepTimerManager } from '../SleepTimerManager';

describe('SleepTimerManager', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2020-01-01T00:00:00Z'));
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

    it('fires onWarning once when entering the warning window', () => {
        const callbacks = {
            onWarning: jest.fn(),
            onSleep: jest.fn(),
            onCancel: jest.fn(),
            onTick: jest.fn(),
        };
        const manager = new SleepTimerManager(callbacks);
        manager.start(2);

        jest.advanceTimersByTime(59_000);
        expect(callbacks.onWarning).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1_000);
        expect(callbacks.onWarning).toHaveBeenCalledTimes(1);
        const [remainingAtWarning] = callbacks.onWarning.mock.calls[0] ?? [];
        expect(typeof remainingAtWarning).toBe('number');
        expect(remainingAtWarning).toBeGreaterThan(0);
        expect(remainingAtWarning).toBeLessThanOrEqual(60_000);

        jest.advanceTimersByTime(5_000);
        expect(callbacks.onWarning).toHaveBeenCalledTimes(1);

        manager.destroy();
    });

    it('cancel emits onCancel and a final onTick(0) when active', () => {
        const callbacks = {
            onWarning: jest.fn(),
            onSleep: jest.fn(),
            onCancel: jest.fn(),
            onTick: jest.fn(),
        };
        const manager = new SleepTimerManager(callbacks);
        manager.start(1);

        jest.advanceTimersByTime(2_000);
        manager.cancel();

        expect(callbacks.onCancel).toHaveBeenCalledTimes(1);
        expect(callbacks.onSleep).not.toHaveBeenCalled();

        const tickCalls = callbacks.onTick.mock.calls;
        expect(tickCalls.length).toBeGreaterThan(0);
        expect(tickCalls[tickCalls.length - 1]?.[0]).toBe(0);

        manager.destroy();
    });

    it('cancel is a no-op when inactive', () => {
        const callbacks = {
            onWarning: jest.fn(),
            onSleep: jest.fn(),
            onCancel: jest.fn(),
            onTick: jest.fn(),
        };
        const manager = new SleepTimerManager(callbacks);

        manager.cancel();

        expect(callbacks.onCancel).not.toHaveBeenCalled();
        expect(callbacks.onTick).not.toHaveBeenCalled();
        manager.destroy();
    });

    it('cyclePreset advances and wraps back to off', () => {
        const callbacks = {
            onWarning: jest.fn(),
            onSleep: jest.fn(),
            onCancel: jest.fn(),
            onTick: jest.fn(),
        };
        const manager = new SleepTimerManager(callbacks);

        expect(manager.cyclePreset()).toBe(15);
        expect(manager.cyclePreset()).toBe(30);
        expect(manager.cyclePreset()).toBe(60);
        expect(manager.cyclePreset()).toBe(120);

        // Wrap to 0 disables the timer (cancel).
        expect(manager.cyclePreset()).toBe(0);
        expect(callbacks.onCancel).toHaveBeenCalledTimes(1);

        manager.destroy();
    });

    it('getRemainingMs decreases over time while active', () => {
        const callbacks = {
            onWarning: jest.fn(),
            onSleep: jest.fn(),
            onCancel: jest.fn(),
            onTick: jest.fn(),
        };
        const manager = new SleepTimerManager(callbacks);
        manager.start(1);

        jest.advanceTimersByTime(10_000);
        const remaining = manager.getRemainingMs();
        expect(remaining).toBeGreaterThanOrEqual(49_000);
        expect(remaining).toBeLessThanOrEqual(50_000);

        manager.destroy();
    });

    it('destroy stops future ticks', () => {
        const callbacks = {
            onWarning: jest.fn(),
            onSleep: jest.fn(),
            onCancel: jest.fn(),
            onTick: jest.fn(),
        };
        const manager = new SleepTimerManager(callbacks);
        manager.start(1);
        jest.advanceTimersByTime(2_000);

        manager.destroy();
        const callsAfterDestroy = callbacks.onTick.mock.calls.length;
        jest.advanceTimersByTime(5_000);
        expect(callbacks.onTick.mock.calls.length).toBe(callsAfterDestroy);
    });
});
