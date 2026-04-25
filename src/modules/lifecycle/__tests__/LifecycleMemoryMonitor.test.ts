/**
 * @jest-environment jsdom
 */

import { LifecycleMemoryMonitor } from '../LifecycleMemoryMonitor';
import { MEMORY_THRESHOLDS } from '../constants';

describe('LifecycleMemoryMonitor', () => {
    let onMemoryWarning: jest.Mock<void, [{ level: 'warning' | 'critical'; used: number }]>;
    let clearCaches: jest.Mock<void, []>;

    beforeEach(() => {
        jest.useFakeTimers();
        onMemoryWarning = jest.fn();
        clearCaches = jest.fn();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    function createMonitor(): LifecycleMemoryMonitor {
        return new LifecycleMemoryMonitor({
            onMemoryWarning,
            clearCaches,
        });
    }

    function setMemory(usedJSHeapSize: number): void {
        Object.defineProperty(performance, 'memory', {
            value: {
                usedJSHeapSize,
                totalJSHeapSize: MEMORY_THRESHOLDS.LIMIT_BYTES,
                jsHeapSizeLimit: MEMORY_THRESHOLDS.LIMIT_BYTES,
            },
            configurable: true,
        });
    }

    it('reads Chrome/webOS performance memory and falls back when unavailable', () => {
        setMemory(100 * 1024 * 1024);
        const monitor = createMonitor();

        expect(monitor.getMemoryUsage()).toEqual({
            used: 100 * 1024 * 1024,
            limit: MEMORY_THRESHOLDS.LIMIT_BYTES,
            percentage: 33,
        });

        Object.defineProperty(performance, 'memory', {
            value: undefined,
            configurable: true,
        });

        expect(monitor.getMemoryUsage()).toEqual({
            used: 0,
            limit: MEMORY_THRESHOLDS.LIMIT_BYTES,
            percentage: 0,
        });
    });

    it('emits warning and critical memory events and clears caches on critical usage', () => {
        const monitor = createMonitor();

        setMemory(MEMORY_THRESHOLDS.WARNING_BYTES + 1);
        monitor.checkMemory();

        setMemory(MEMORY_THRESHOLDS.CRITICAL_BYTES + 1);
        monitor.checkMemory();

        expect(onMemoryWarning).toHaveBeenNthCalledWith(1, {
            level: 'warning',
            used: MEMORY_THRESHOLDS.WARNING_BYTES + 1,
        });
        expect(onMemoryWarning).toHaveBeenNthCalledWith(2, {
            level: 'critical',
            used: MEMORY_THRESHOLDS.CRITICAL_BYTES + 1,
        });
        expect(clearCaches).toHaveBeenCalledTimes(1);
    });

    it('starts and stops the periodic memory check interval', () => {
        setMemory(MEMORY_THRESHOLDS.WARNING_BYTES + 1);
        const monitor = createMonitor();

        monitor.startMonitoring();
        jest.advanceTimersByTime(MEMORY_THRESHOLDS.CHECK_INTERVAL_MS);
        monitor.stopMonitoring();
        jest.advanceTimersByTime(MEMORY_THRESHOLDS.CHECK_INTERVAL_MS);

        expect(onMemoryWarning).toHaveBeenCalledTimes(1);
    });
});
