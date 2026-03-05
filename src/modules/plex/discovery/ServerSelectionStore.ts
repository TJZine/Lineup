import {
    safeLocalStorageGet,
    safeLocalStorageRemove,
    safeLocalStorageSet,
} from '../../../utils/storage';
import { PLEX_DISCOVERY_CONSTANTS } from './constants';

export type ServerHealthStatus = 'ok' | 'unreachable' | 'auth_required';
export type ServerHealthType = 'local' | 'remote' | 'relay' | 'unknown';

export type ServerHealthRecord = {
    status: ServerHealthStatus;
    type: ServerHealthType;
    latencyMs?: number;
    testedAt?: number;
};

export type ServerHealthMap = Record<string, ServerHealthRecord>;

export type ServerHealthWriteDetails = {
    connection?: { relay?: boolean; local?: boolean };
    latency?: number;
};

export type WriteServerHealthRecordInput = {
    serverId: string;
    status: ServerHealthStatus;
    details?: ServerHealthWriteDetails;
    testedAt?: number;
};

const SERVER_HEALTH_RECORD_KEYS = new Set(['status', 'type', 'latencyMs', 'testedAt']);

export class ServerSelectionStore {
    private _selectedServerKey: string;
    private _serverHealthKey: string;

    constructor() {
        this._selectedServerKey = PLEX_DISCOVERY_CONSTANTS.SELECTED_SERVER_KEY;
        this._serverHealthKey = PLEX_DISCOVERY_CONSTANTS.SERVER_HEALTH_KEY;
    }

    setStorageKeys(selectedServerKey: string, serverHealthKey: string): void {
        if (!selectedServerKey || !serverHealthKey) {
            throw new Error('Storage keys must be non-empty strings');
        }
        this._selectedServerKey = selectedServerKey;
        this._serverHealthKey = serverHealthKey;
    }

    readSelectedServerId(): string | null {
        const raw = safeLocalStorageGet(this._selectedServerKey);
        if (raw === null) return null;

        const normalized = raw.trim();
        if (normalized.length === 0) {
            safeLocalStorageRemove(this._selectedServerKey);
            return null;
        }

        if (normalized !== raw) {
            safeLocalStorageSet(this._selectedServerKey, normalized);
        }

        return normalized;
    }

    writeSelectedServerId(serverId: string): void {
        const normalized = serverId.trim();
        if (normalized.length === 0) {
            safeLocalStorageRemove(this._selectedServerKey);
            return;
        }
        safeLocalStorageSet(this._selectedServerKey, normalized);
    }

    clearSelectedServerId(): void {
        safeLocalStorageRemove(this._selectedServerKey);
    }

    readServerHealthMap(): ServerHealthMap {
        const raw = safeLocalStorageGet(this._serverHealthKey);
        if (!raw) return {};

        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch {
            safeLocalStorageRemove(this._serverHealthKey);
            return {};
        }

        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            safeLocalStorageRemove(this._serverHealthKey);
            return {};
        }

        const normalized: ServerHealthMap = {};
        let changed = false;

        for (const [serverId, value] of Object.entries(parsed as Record<string, unknown>)) {
            const normalizedServerId = serverId.trim();
            if (normalizedServerId.length === 0) {
                changed = true;
                continue;
            }

            const record = this._normalizeHealthRecord(value);
            if (!record) {
                changed = true;
                continue;
            }

            normalized[normalizedServerId] = record;

            const original = value as Record<string, unknown>;
            const originalLatency = original.latencyMs;
            const originalTestedAt = original.testedAt;
            if (
                normalizedServerId !== serverId
                || original.status !== record.status
                || original.type !== record.type
                || (typeof record.latencyMs === 'number' && originalLatency !== record.latencyMs)
                || (record.latencyMs === undefined && originalLatency !== undefined)
                || (typeof record.testedAt === 'number' && originalTestedAt !== record.testedAt)
                || (record.testedAt === undefined && originalTestedAt !== undefined)
                || Object.keys(original).some((key) => !SERVER_HEALTH_RECORD_KEYS.has(key))
            ) {
                changed = true;
            }
        }

        if (changed) {
            if (Object.keys(normalized).length === 0) {
                safeLocalStorageRemove(this._serverHealthKey);
            } else {
                safeLocalStorageSet(this._serverHealthKey, JSON.stringify(normalized));
            }
        }

        return normalized;
    }

    writeServerHealthRecord(input: WriteServerHealthRecordInput): void {
        const serverId = input.serverId.trim();
        if (serverId.length === 0) return;

        const healthMap = this.readServerHealthMap();
        const previous = healthMap[serverId];

        const type: ServerHealthType = input.details?.connection
            ? input.details.connection.relay
                ? 'relay'
                : input.details.connection.local
                    ? 'local'
                    : 'remote'
            : previous?.type ?? 'unknown';

        const latencyMs = Number.isFinite(input.details?.latency)
            ? Math.max(0, Math.round(Number(input.details?.latency)))
            : previous?.latencyMs;

        const testedAt = Number.isFinite(input.testedAt)
            ? Math.max(0, Math.floor(Number(input.testedAt)))
            : Date.now();

        const nextRecord: ServerHealthRecord = {
            status: input.status,
            type,
            testedAt,
        };

        if (typeof latencyMs === 'number') {
            nextRecord.latencyMs = latencyMs;
        }

        healthMap[serverId] = nextRecord;
        safeLocalStorageSet(this._serverHealthKey, JSON.stringify(healthMap));
    }

    clearServerHealthMap(): void {
        safeLocalStorageRemove(this._serverHealthKey);
    }

    private _normalizeHealthRecord(value: unknown): ServerHealthRecord | null {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return null;
        }

        const input = value as Record<string, unknown>;
        const status = input.status;
        if (status !== 'ok' && status !== 'unreachable' && status !== 'auth_required') {
            return null;
        }

        const rawType = input.type;
        const type: ServerHealthType =
            rawType === 'local' || rawType === 'remote' || rawType === 'relay' || rawType === 'unknown'
                ? rawType
                : 'unknown';

        const next: ServerHealthRecord = { status, type };

        if (Number.isFinite(input.latencyMs)) {
            next.latencyMs = Math.max(0, Math.round(Number(input.latencyMs)));
        }

        if (Number.isFinite(input.testedAt)) {
            next.testedAt = Math.max(0, Math.floor(Number(input.testedAt)));
        }

        return next;
    }
}
