import { DEFAULT_CHANNEL_SETUP_MAX } from '../../../modules/scheduler/channel-manager/constants';
import { normalizeChannelSetupConfig } from '../config/normalizeChannelSetupConfig';
import { DEFAULT_MIN_ITEMS_PER_CHANNEL, SETUP_STRATEGY_KEYS } from '../constants';
import type {
    ChannelExpansionConfig,
    ChannelSetupConfig,
    ChannelSetupRecord,
    SeriesOrderingConfig,
    SetupStrategyConfig,
    SetupStrategyKey,
} from '../types';

export interface ChannelSetupRecordStoreDeps {
    storageGet: (key: string) => string | null;
    storageSet: (key: string, value: string) => void;
    storageRemove: (key: string) => void;
}

export class ChannelSetupRecordStore {
    constructor(private readonly _deps: ChannelSetupRecordStoreDeps) {}

    getRecord(serverId: string): ChannelSetupRecord | null {
        const stored = this._deps.storageGet(this._getStorageKey(serverId));
        if (!stored) {
            return null;
        }
        try {
            const parsed = JSON.parse(stored) as Partial<ChannelSetupRecord>;
            if (!parsed || parsed.serverId !== serverId) {
                return null;
            }
            if (
                !Array.isArray(parsed.selectedLibraryIds) ||
                !parsed.selectedLibraryIds.every((id) => typeof id === 'string')
            ) {
                return null;
            }
            const rawStrategyConfig = parsed.strategyConfig as unknown;
            if (!rawStrategyConfig || typeof rawStrategyConfig !== 'object') {
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
                return null;
            }
            if (typeof parsed.updatedAt !== 'number' || !Number.isFinite(parsed.updatedAt)) {
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
        } catch {
            return null;
        }
    }

    markSetupComplete(serverId: string, setupConfig: ChannelSetupConfig): ChannelSetupRecord {
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
        this._deps.storageSet(this._getStorageKey(serverId), JSON.stringify(record));
        return record;
    }

    clearRecord(serverId: string): void {
        this._deps.storageRemove(this._getStorageKey(serverId));
    }

    private _getStorageKey(serverId: string): string {
        return `lineup_channel_setup_v2:${serverId}`;
    }
}
