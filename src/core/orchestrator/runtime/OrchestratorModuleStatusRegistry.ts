import type { AppError } from '../../../modules/lifecycle';
import type { ModuleStatus } from '../contracts/OrchestratorTypes';
import { captureRecoverableRuntimeResult } from './OrchestratorRecoverableRuntimeResult';

const MODULE_IDS = [
    'event-emitter', 'app-lifecycle', 'navigation', 'plex-auth',
    'plex-server-discovery', 'plex-library', 'plex-stream-resolver',
    'channel-manager', 'channel-scheduler', 'video-player', 'epg-ui',
    'now-playing-info-ui', 'player-osd-ui', 'channel-number-overlay-ui',
    'channel-badge-ui', 'mini-guide-ui', 'channel-transition-ui',
    'playback-options-ui', 'exit-confirm-ui',
] as const;

export interface OrchestratorModuleStatusRegistryDeps {
    reportCloneFallback(error: unknown): void;
}

/** Owns mutable runtime status while exposing only scalar reads and defensive snapshots. */
export class OrchestratorModuleStatusRegistry {
    private readonly statuses = new Map<string, ModuleStatus>();
    private readonly reportedFallbackContexts = new WeakSet<object>();

    constructor(private readonly deps: OrchestratorModuleStatusRegistryDeps) {
        for (const id of MODULE_IDS) {
            this.statuses.set(id, { id, name: id, status: 'pending' });
        }
    }

    getRuntimeStatus(id: string): ModuleStatus['status'] | undefined {
        return this.statuses.get(id)?.status;
    }

    update(id: string, status: ModuleStatus['status'], error?: AppError, loadTimeMs?: number): void {
        const current = this.statuses.get(id);
        if (!current) return;

        current.status = status;
        if (status !== 'error') delete current.error;
        if (error) current.error = error;
        if (status !== 'initializing' && loadTimeMs === undefined) delete current.loadTimeMs;
        if (loadTimeMs !== undefined) current.loadTimeMs = loadTimeMs;
    }

    snapshot(): Map<string, ModuleStatus> {
        return new Map(Array.from(this.statuses, ([id, status]) => [id, this.cloneStatus(status)]));
    }

    private cloneStatus(status: ModuleStatus): ModuleStatus {
        return {
            ...status,
            ...(status.error ? {
                error: {
                    ...status.error,
                    ...(status.error.context ? { context: this.cloneErrorContext(status.error.context) } : {}),
                },
            } : {}),
        };
    }

    private cloneErrorContext(context: Record<string, unknown>): Record<string, unknown> {
        if (typeof globalThis.structuredClone === 'function') {
            const result = captureRecoverableRuntimeResult(
                () => globalThis.structuredClone(context) as Record<string, unknown>
            );
            if (result.ok) return result.value;

            if (!this.reportedFallbackContexts.has(context)) {
                this.reportedFallbackContexts.add(context);
                this.deps.reportCloneFallback(result.error);
            }
        }

        return this.cloneDiagnosticValue(context, new WeakMap<object, unknown>()) as Record<string, unknown>;
    }

    private cloneDiagnosticValue(value: unknown, seen: WeakMap<object, unknown>): unknown {
        if (value === null || typeof value !== 'object') return value;
        const existingClone = seen.get(value);
        if (existingClone !== undefined) return existingClone;

        if (Array.isArray(value)) {
            const clone: unknown[] = [];
            seen.set(value, clone);
            for (const item of value) clone.push(this.cloneDiagnosticValue(item, seen));
            return clone;
        }
        if (value instanceof Date) return new Date(value.getTime());
        if (value instanceof Error) {
            const clone: Record<string, unknown> = {
                name: value.name,
                message: value.message,
                ...(value.stack !== undefined ? { stack: value.stack } : {}),
            };
            seen.set(value, clone);
            for (const [key, entry] of Object.entries(value)) {
                clone[key] = this.cloneDiagnosticValue(entry, seen);
            }
            return clone;
        }
        if (value instanceof Map) {
            const clone = new Map<unknown, unknown>();
            seen.set(value, clone);
            for (const [key, entry] of value) {
                clone.set(this.cloneDiagnosticValue(key, seen), this.cloneDiagnosticValue(entry, seen));
            }
            return clone;
        }
        if (value instanceof Set) {
            const clone = new Set<unknown>();
            seen.set(value, clone);
            for (const entry of value) clone.add(this.cloneDiagnosticValue(entry, seen));
            return clone;
        }

        const clone: Record<string, unknown> = {};
        seen.set(value, clone);
        for (const [key, entry] of Object.entries(value)) {
            clone[key] = this.cloneDiagnosticValue(entry, seen);
        }
        return clone;
    }
}
