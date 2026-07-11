import { DEFAULT_CHANNEL_SETUP_MAX } from '../../../modules/scheduler/channel-manager/constants';
import { LINEUP_STORAGE_KEYS } from '../../../config/storageKeys';
import type { SafeLocalStorageMutationResult } from '../../../utils/storage';
import { normalizeChannelSetupConfig } from '../config/normalizeChannelSetupConfig';
import { DEFAULT_MIN_ITEMS_PER_CHANNEL, SETUP_STRATEGY_KEYS } from '../constants';
import type {
    ChannelExpansionConfig,
    ChannelSetupCompletionFailureReason,
    ChannelSetupCompletionResult,
    ChannelSetupConfig,
    ChannelSetupRecord,
    SeriesOrderingConfig,
    SetupStrategyConfig,
    SetupStrategyKey,
} from '../types';

export interface ChannelSetupRecordStoreDeps {
    storageGet: (key: string) => string | null;
    storageSet: (key: string, value: string) => SafeLocalStorageMutationResult;
    storageRemove: (key: string) => SafeLocalStorageMutationResult;
    getActiveUserId: () => string | null;
    appendDiagnostic?: (event: ChannelSetupRecordDiagnostic) => void;
}

export type ChannelSetupRecordDiagnosticReason =
    | 'missing-active-user'
    | 'invalid-json'
    | 'invalid-shape'
    | 'server-mismatch'
    | 'remove-failed'
    | 'write-failed';

export interface ChannelSetupRecordDiagnostic {
    reason: ChannelSetupRecordDiagnosticReason;
    serverId: string;
    storageKey?: string;
    detail?: string;
}

export class ChannelSetupRecordStore {
    constructor(private readonly _deps: ChannelSetupRecordStoreDeps) {}

    getRecord(serverId: string): ChannelSetupRecord | null {
        const storageKey = this._getStorageKey(serverId);
        if (!storageKey) {
            this._appendDiagnostic({ reason: 'missing-active-user', serverId });
            return null;
        }
        const stored = this._deps.storageGet(storageKey);
        if (!stored) {
            return null;
        }
        try {
            const parsed = JSON.parse(stored) as Partial<ChannelSetupRecord>;
            if (!parsed || parsed.serverId !== serverId) {
                this._discardCorruptRecord(storageKey, {
                    reason: parsed?.serverId && parsed.serverId !== serverId ? 'server-mismatch' : 'invalid-shape',
                    serverId,
                    storageKey,
                });
                return null;
            }
            if (
                !Array.isArray(parsed.selectedLibraryIds) ||
                !parsed.selectedLibraryIds.every((id) => typeof id === 'string')
            ) {
                this._discardCorruptRecord(storageKey, { reason: 'invalid-shape', serverId, storageKey });
                return null;
            }
            const rawStrategyConfig = parsed.strategyConfig as unknown;
            if (!rawStrategyConfig || typeof rawStrategyConfig !== 'object') {
                this._discardCorruptRecord(storageKey, { reason: 'invalid-shape', serverId, storageKey });
                return null;
            }
            const strategyConfig = SETUP_STRATEGY_KEYS.reduce<Record<SetupStrategyKey, SetupStrategyConfig>>((acc, key) => {
                const raw = (rawStrategyConfig as Record<string, unknown>)[key] as unknown;
                if (!raw || typeof raw !== 'object') {
                    throw new Error(`Missing strategyConfig.${key}`);
                }
                const enabled = (raw as { enabled?: unknown }).enabled;
                const priority = (raw as { priority?: unknown }).priority;
                const scope = (raw as { scope?: unknown }).scope;
                if (typeof enabled !== 'boolean') {
                    throw new Error(`Invalid strategyConfig.${key}.enabled`);
                }
                if (typeof priority !== 'number' || !Number.isFinite(priority)) {
                    throw new Error(`Invalid strategyConfig.${key}.priority`);
                }
                if (scope !== 'per-library' && scope !== 'cross-library') {
                    throw new Error(`Invalid strategyConfig.${key}.scope`);
                }
                acc[key] = { enabled, priority, scope };
                return acc;
            }, {} as Record<SetupStrategyKey, SetupStrategyConfig>);

            if (typeof parsed.createdAt !== 'number' || !Number.isFinite(parsed.createdAt)) {
                this._discardCorruptRecord(storageKey, { reason: 'invalid-shape', serverId, storageKey });
                return null;
            }
            if (typeof parsed.updatedAt !== 'number' || !Number.isFinite(parsed.updatedAt)) {
                this._discardCorruptRecord(storageKey, { reason: 'invalid-shape', serverId, storageKey });
                return null;
            }
            const maxChannels = typeof parsed.maxChannels === 'number' && Number.isFinite(parsed.maxChannels)
                ? parsed.maxChannels
                : DEFAULT_CHANNEL_SETUP_MAX;
            const minItemsPerChannel = typeof parsed.minItemsPerChannel === 'number' && Number.isFinite(parsed.minItemsPerChannel)
                ? parsed.minItemsPerChannel
                : DEFAULT_MIN_ITEMS_PER_CHANNEL;
            const buildMode = parsed.buildMode === 'append' || parsed.buildMode === 'merge'
                ? parsed.buildMode
                : 'replace';
            const actorStudioCombineMode = parsed.actorStudioCombineMode === 'combined'
                ? parsed.actorStudioCombineMode
                : 'separate';
            const channelExpansion = typeof parsed.channelExpansion === 'object' && parsed.channelExpansion !== null
                ? parsed.channelExpansion as ChannelExpansionConfig
                : undefined;
            const seriesOrdering = typeof parsed.seriesOrdering === 'object' && parsed.seriesOrdering !== null
                ? parsed.seriesOrdering as SeriesOrderingConfig
                : undefined;
            const baseConfig: ChannelSetupConfig = {
                serverId: parsed.serverId,
                selectedLibraryIds: parsed.selectedLibraryIds,
                maxChannels,
                buildMode,
                strategyConfig,
                actorStudioCombineMode,
                minItemsPerChannel,
            };
            if (channelExpansion) {
                baseConfig.channelExpansion = channelExpansion;
            }
            if (seriesOrdering) {
                baseConfig.seriesOrdering = seriesOrdering;
            }
            const normalizedConfig = normalizeChannelSetupConfig(baseConfig);

            return {
                ...normalizedConfig,
                createdAt: parsed.createdAt,
                updatedAt: parsed.updatedAt,
            };
        } catch (error: unknown) {
            const diagnostic: ChannelSetupRecordDiagnostic = {
                reason: error instanceof SyntaxError ? 'invalid-json' : 'invalid-shape',
                serverId,
                storageKey,
            };
            if (error instanceof Error) {
                diagnostic.detail = error.message;
            }
            this._discardCorruptRecord(storageKey, diagnostic);
            return null;
        }
    }

    markSetupComplete(serverId: string, setupConfig: ChannelSetupConfig): ChannelSetupCompletionResult {
        const storageKey = this._getStorageKey(serverId);
        if (!storageKey) {
            return this._completionFailure('missing-active-user', serverId);
        }
        const existing = this.getRecord(serverId);
        const createdAt = existing?.createdAt ?? Date.now();
        const normalizedConfig = normalizeChannelSetupConfig(setupConfig);
        const record: ChannelSetupRecord = {
            serverId,
            selectedLibraryIds: [...normalizedConfig.selectedLibraryIds],
            strategyConfig: { ...normalizedConfig.strategyConfig },
            channelExpansion: normalizedConfig.channelExpansion,
            seriesOrdering: normalizedConfig.seriesOrdering,
            maxChannels: normalizedConfig.maxChannels,
            buildMode: normalizedConfig.buildMode,
            actorStudioCombineMode: normalizedConfig.actorStudioCombineMode,
            minItemsPerChannel: normalizedConfig.minItemsPerChannel,
            createdAt,
            updatedAt: Date.now(),
        };
        const writeResult = this._deps.storageSet(storageKey, JSON.stringify(record));
        if (!writeResult.ok) {
            this._appendDiagnostic({
                reason: 'write-failed',
                serverId,
                storageKey,
                detail: writeResult.reason,
            });
            return this._completionFailure(writeResult.reason, serverId);
        }
        return { ok: true, record };
    }

    clearRecord(serverId: string): void {
        const storageKey = this._getStorageKey(serverId);
        if (!storageKey) {
            this._appendDiagnostic({ reason: 'missing-active-user', serverId });
            return;
        }
        const removeResult = this._deps.storageRemove(storageKey);
        if (!removeResult.ok) {
            this._appendDiagnostic({
                reason: 'remove-failed',
                serverId,
                storageKey,
                detail: removeResult.reason,
            });
        }
    }

    private _getStorageKey(serverId: string): string | null {
        const activeUserId = this._deps.getActiveUserId()?.trim();
        if (!activeUserId) {
            return null;
        }
        return `${LINEUP_STORAGE_KEYS.CHANNEL_SETUP_RECORD_PREFIX}:${serverId}:${activeUserId}`;
    }

    private _discardCorruptRecord(storageKey: string, diagnostic: ChannelSetupRecordDiagnostic): void {
        const removeResult = this._deps.storageRemove(storageKey);
        this._appendDiagnostic(diagnostic);
        if (!removeResult.ok) {
            this._appendDiagnostic({
                reason: 'remove-failed',
                serverId: diagnostic.serverId,
                storageKey,
                detail: removeResult.reason,
            });
        }
    }

    private _completionFailure(
        reason: ChannelSetupCompletionFailureReason,
        serverId: string
    ): ChannelSetupCompletionResult {
        const message = reason === 'missing-active-user'
            ? 'No active Plex profile is selected.'
            : reason === 'quota-exceeded'
                ? 'Device storage is full.'
                : 'Device storage is unavailable.';
        if (reason === 'missing-active-user') {
            this._appendDiagnostic({ reason, serverId });
        }
        return { ok: false, reason, message };
    }

    private _appendDiagnostic(diagnostic: ChannelSetupRecordDiagnostic): void {
        this._deps.appendDiagnostic?.(diagnostic);
    }
}
