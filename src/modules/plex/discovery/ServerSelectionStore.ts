import {
    safeLocalStorageGet,
    safeLocalStorageRemove,
    safeLocalStorageSet,
} from '../../../utils/storage';
import { PLEX_DISCOVERY_CONSTANTS } from './constants';
import type { ServerHealthRecord, ServerHealthStatus, ServerHealthType } from './types';

export type ServerHealthMap = Record<string, ServerHealthRecord>;

export type ServerHealthWriteDetails = {
    connection?: { relay?: boolean; local?: boolean; protocol?: 'http' | 'https' };
    latency?: number;
};

export type WriteServerHealthRecordInput = {
    serverId: string;
    status: ServerHealthStatus;
    details?: ServerHealthWriteDetails;
    testedAt?: number;
};

type ServerSelectionStorageKeys = { selectedServerKey: string; serverHealthKey: string };

const SERVER_HEALTH_RECORD_KEYS = new Set(['status', 'type', 'protocol', 'latencyMs', 'testedAt']);
const RESERVED_SERVER_HEALTH_IDS = new Set(['__proto__', 'prototype', 'constructor']);

export class ServerSelectionStore {
    constructor(
        private readonly _getStorageKeys: () => ServerSelectionStorageKeys = () => ({
            selectedServerKey: PLEX_DISCOVERY_CONSTANTS.SELECTED_SERVER_KEY,
            serverHealthKey: PLEX_DISCOVERY_CONSTANTS.SERVER_HEALTH_KEY,
        })
    ) {}

    readSelectedServerIdAndClean(): string | null {
        const { selectedServerKey } = this._keys();
        const raw = safeLocalStorageGet(selectedServerKey);
        if (raw === null) return null;

        const normalized = raw.trim();
        if (normalized.length === 0) {
            safeLocalStorageRemove(selectedServerKey);
            return null;
        }

        if (normalized !== raw) {
            safeLocalStorageSet(selectedServerKey, normalized);
        }

        return normalized;
    }

    readSelectedServerId(): string | null {
        const { selectedServerKey } = this._keys();
        const raw = safeLocalStorageGet(selectedServerKey);
        if (raw === null) return null;

        const normalized = raw.trim();
        return normalized.length > 0 ? normalized : null;
    }

    writeSelectedServerId(serverId: string): void {
        const { selectedServerKey } = this._keys();
        const normalized = serverId.trim();
        if (normalized.length === 0) {
            safeLocalStorageRemove(selectedServerKey);
            return;
        }
        safeLocalStorageSet(selectedServerKey, normalized);
    }

    clearSelectedServerId(): void {
        const { selectedServerKey } = this._keys();
        safeLocalStorageRemove(selectedServerKey);
    }

    readServerHealthMapAndClean(): ServerHealthMap {
        const { serverHealthKey } = this._keys();
        const raw = safeLocalStorageGet(serverHealthKey);
        if (raw === null) return {};

        const normalizedRaw = raw.trim();
        if (!normalizedRaw) {
            safeLocalStorageRemove(serverHealthKey);
            return {};
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(normalizedRaw);
        } catch {
            safeLocalStorageRemove(serverHealthKey);
            return {};
        }

        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            safeLocalStorageRemove(serverHealthKey);
            return {};
        }

        const normalized = Object.create(null) as ServerHealthMap;
        let changed = normalizedRaw !== raw;

        for (const [serverId, value] of Object.entries(parsed as Record<string, unknown>)) {
            const normalizedServerId = serverId.trim();
            if (
                normalizedServerId.length === 0
                || RESERVED_SERVER_HEALTH_IDS.has(normalizedServerId)
            ) {
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
                || original.protocol !== record.protocol
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
                safeLocalStorageRemove(serverHealthKey);
            } else {
                safeLocalStorageSet(serverHealthKey, JSON.stringify(normalized));
            }
        }

        return normalized;
    }

    writeServerHealthRecord(input: WriteServerHealthRecordInput): void {
        const { serverHealthKey } = this._keys();
        const serverId = input.serverId.trim();
        if (serverId.length === 0) return;

        const healthMap = this.readServerHealthMapAndClean();
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
        const protocol = input.details?.connection?.protocol === 'http' || input.details?.connection?.protocol === 'https'
            ? input.details.connection.protocol
            : previous?.protocol;

        const testedAt = Number.isFinite(input.testedAt)
            ? Math.max(0, Math.floor(Number(input.testedAt)))
            : Date.now();

        const nextRecord: ServerHealthRecord = {
            status: input.status,
            type,
            testedAt,
        };

        if (protocol === 'http' || protocol === 'https') {
            nextRecord.protocol = protocol;
        }

        if (typeof latencyMs === 'number') {
            nextRecord.latencyMs = latencyMs;
        }

        healthMap[serverId] = nextRecord;
        safeLocalStorageSet(serverHealthKey, JSON.stringify(healthMap));
    }

    clearServerHealthMap(): void {
        const { serverHealthKey } = this._keys();
        safeLocalStorageRemove(serverHealthKey);
    }

    private _keys(): ServerSelectionStorageKeys {
        const { selectedServerKey, serverHealthKey } = this._getStorageKeys();
        if (
            typeof selectedServerKey !== 'string' ||
            typeof serverHealthKey !== 'string' ||
            selectedServerKey.trim().length === 0 ||
            serverHealthKey.trim().length === 0
        ) {
            throw new Error('Storage keys must be non-empty strings');
        }
        return {
            selectedServerKey,
            serverHealthKey,
        };
    }

    private _normalizeHealthRecord(value: unknown): ServerHealthRecord | null {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return null;
        }

        const input = value as Record<string, unknown>;
        const status = this._normalizeHealthStatus(input.status);
        if (!status) {
            return null;
        }

        const rawType = input.type;
        const type: ServerHealthType =
            rawType === 'local' || rawType === 'remote' || rawType === 'relay' || rawType === 'unknown'
                ? rawType
                : 'unknown';

        const next: ServerHealthRecord = { status, type };

        if (input.protocol === 'http' || input.protocol === 'https') {
            next.protocol = input.protocol;
        }

        if (Number.isFinite(input.latencyMs)) {
            next.latencyMs = Math.max(0, Math.round(Number(input.latencyMs)));
        }

        if (Number.isFinite(input.testedAt)) {
            next.testedAt = Math.max(0, Math.floor(Number(input.testedAt)));
        }

        return next;
    }

    private _normalizeHealthStatus(status: unknown): ServerHealthStatus | null {
        if (status === 'auth_invalid') {
            return 'access_denied';
        }

        return status === 'ok'
            || status === 'unreachable'
            || status === 'auth_required'
            || status === 'access_denied'
            ? status
            : null;
    }
}
