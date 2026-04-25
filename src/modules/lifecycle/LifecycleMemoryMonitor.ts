import { MEMORY_THRESHOLDS } from './constants';
import type { LifecycleEventMap, MemoryUsage } from './types';

export interface LifecycleMemoryMonitorDeps {
    onMemoryWarning: (payload: LifecycleEventMap['memoryWarning']) => void;
    clearCaches: () => void;
}

export class LifecycleMemoryMonitor {
    private readonly _onMemoryWarning: (payload: LifecycleEventMap['memoryWarning']) => void;
    private readonly _clearCaches: () => void;
    private _memoryCheckInterval: number | null = null;

    public constructor(deps: LifecycleMemoryMonitorDeps) {
        this._onMemoryWarning = deps.onMemoryWarning;
        this._clearCaches = deps.clearCaches;
    }

    public startMonitoring(): void {
        this._memoryCheckInterval = window.setInterval(() => {
            this.checkMemory();
        }, MEMORY_THRESHOLDS.CHECK_INTERVAL_MS) as unknown as number;
    }

    public stopMonitoring(): void {
        if (this._memoryCheckInterval !== null) {
            clearInterval(this._memoryCheckInterval);
            this._memoryCheckInterval = null;
        }
    }

    public getMemoryUsage(): MemoryUsage {
        const memory = (performance as unknown as {
            memory?: {
                usedJSHeapSize: number;
                totalJSHeapSize: number;
                jsHeapSizeLimit: number;
            }
        }).memory;

        if (memory) {
            return {
                used: memory.usedJSHeapSize,
                limit: memory.jsHeapSizeLimit,
                percentage: Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100),
            };
        }

        return {
            used: 0,
            limit: MEMORY_THRESHOLDS.LIMIT_BYTES,
            percentage: 0,
        };
    }

    public checkMemory(): void {
        const usage = this.getMemoryUsage();
        if (usage.used === 0) {
            return;
        }

        if (usage.used > MEMORY_THRESHOLDS.CRITICAL_BYTES) {
            this._onMemoryWarning({ level: 'critical', used: usage.used });
            this._clearCaches();
        } else if (usage.used > MEMORY_THRESHOLDS.WARNING_BYTES) {
            this._onMemoryWarning({ level: 'warning', used: usage.used });
        }
    }
}
