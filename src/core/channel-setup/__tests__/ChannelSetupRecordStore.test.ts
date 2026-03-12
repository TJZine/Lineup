/**
 * @jest-environment jsdom
 */

import { ChannelSetupRecordStore } from '../ChannelSetupRecordStore';
import { DEFAULT_STRATEGY_PRIORITIES, MIXED_SCOPE_STRATEGY_KEYS, SETUP_STRATEGY_KEYS } from '../constants';
import type { ChannelSetupConfig, SetupStrategyConfig, SetupStrategyKey } from '../types';

const createStrategyConfig = (): Record<SetupStrategyKey, SetupStrategyConfig> => (
    SETUP_STRATEGY_KEYS.reduce<Record<SetupStrategyKey, SetupStrategyConfig>>((acc, key) => {
        acc[key] = {
            enabled: true,
            priority: DEFAULT_STRATEGY_PRIORITIES[key],
            scope: MIXED_SCOPE_STRATEGY_KEYS.has(key) ? 'cross-library' : 'per-library',
        };
        return acc;
    }, {} as Record<SetupStrategyKey, SetupStrategyConfig>)
);

const createConfig = (overrides?: Partial<ChannelSetupConfig>): ChannelSetupConfig => ({
    serverId: 'server-1',
    selectedLibraryIds: ['lib-1'],
    maxChannels: 100,
    buildMode: 'replace',
    strategyConfig: createStrategyConfig(),
    actorStudioCombineMode: 'separate',
    minItemsPerChannel: 5,
    ...overrides,
});

describe('ChannelSetupRecordStore', () => {
    it('returns null for missing records', () => {
        const storage = new Map<string, string>();
        const store = new ChannelSetupRecordStore({
            storageGet: (key: string): string | null => storage.get(key) ?? null,
            storageSet: (key: string, value: string): void => void storage.set(key, value),
            storageRemove: (key: string): void => void storage.delete(key),
            normalizeConfig: (config: ChannelSetupConfig): ChannelSetupConfig => config,
        });

        expect(store.getRecord('server-1')).toBeNull();
    });

    it('returns null for invalid stored payloads', () => {
        const storage = new Map<string, string>();
        storage.set('lineup_channel_setup_v2:server-1', JSON.stringify({
            serverId: 'server-1',
            selectedLibraryIds: ['lib-1'],
            strategyConfig: { playlists: { enabled: true } },
            createdAt: Date.now(),
            updatedAt: Date.now(),
        }));
        const store = new ChannelSetupRecordStore({
            storageGet: (key: string): string | null => storage.get(key) ?? null,
            storageSet: (key: string, value: string): void => void storage.set(key, value),
            storageRemove: (key: string): void => void storage.delete(key),
            normalizeConfig: (config: ChannelSetupConfig): ChannelSetupConfig => config,
        });

        expect(store.getRecord('server-1')).toBeNull();
    });

    it('reads valid stored record and normalizes via callback', () => {
        const storage = new Map<string, string>();
        storage.set('lineup_channel_setup_v2:server-1', JSON.stringify({
            ...createConfig(),
            createdAt: 11,
            updatedAt: 22,
        }));
        const normalizeConfig = jest.fn((config: ChannelSetupConfig): ChannelSetupConfig => ({
            ...config,
            maxChannels: 200,
        }));
        const store = new ChannelSetupRecordStore({
            storageGet: (key: string): string | null => storage.get(key) ?? null,
            storageSet: (key: string, value: string): void => void storage.set(key, value),
            storageRemove: (key: string): void => void storage.delete(key),
            normalizeConfig,
        });

        const record = store.getRecord('server-1');
        expect(record).not.toBeNull();
        expect(record?.maxChannels).toBe(200);
        expect(record?.createdAt).toBe(11);
        expect(normalizeConfig).toHaveBeenCalled();
    });

    it('markSetupComplete writes expected key and preserves createdAt', () => {
        const storage = new Map<string, string>();
        storage.set('lineup_channel_setup_v2:server-1', JSON.stringify({
            ...createConfig(),
            createdAt: 101,
            updatedAt: 202,
        }));
        const store = new ChannelSetupRecordStore({
            storageGet: (key: string): string | null => storage.get(key) ?? null,
            storageSet: (key: string, value: string): void => void storage.set(key, value),
            storageRemove: (key: string): void => void storage.delete(key),
            normalizeConfig: (config: ChannelSetupConfig): ChannelSetupConfig => config,
        });

        const record = store.markSetupComplete('server-1', createConfig({ minItemsPerChannel: 7 }));
        expect(record.createdAt).toBe(101);

        const raw = storage.get('lineup_channel_setup_v2:server-1');
        expect(raw).toBeTruthy();
        expect(storage.has('lineup_channel_setup_v2:server-1')).toBe(true);
        expect(storage.has('lineup_channel_setup_v2:server-2')).toBe(false);
    });

    it('cleanupStaleBuildKeys removes temp build keys only', () => {
        const store = new ChannelSetupRecordStore({
            storageGet: (): string | null => null,
            storageSet: (_key: string, _value: string): void => undefined,
            storageRemove: (_key: string): void => undefined,
            normalizeConfig: (config: ChannelSetupConfig): ChannelSetupConfig => config,
        });
        localStorage.clear();
        localStorage.setItem('lineup_channels_build_tmp_v1:abc', '1');
        localStorage.setItem('lineup_current_channel_build_tmp_v1:def', '2');
        localStorage.setItem('lineup_channel_setup_v2:server-1', 'keep');

        store.cleanupStaleBuildKeys();

        expect(localStorage.getItem('lineup_channels_build_tmp_v1:abc')).toBeNull();
        expect(localStorage.getItem('lineup_current_channel_build_tmp_v1:def')).toBeNull();
        expect(localStorage.getItem('lineup_channel_setup_v2:server-1')).toBe('keep');
    });
});
