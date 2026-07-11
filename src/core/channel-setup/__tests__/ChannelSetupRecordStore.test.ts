/**
 * @jest-environment jsdom
 */

import { ChannelSetupRecordStore } from '../persistence/ChannelSetupRecordStore';
import { DEFAULT_STRATEGY_PRIORITIES, MIXED_SCOPE_STRATEGY_KEYS, SETUP_STRATEGY_KEYS } from '../constants';
import { DEFAULT_CHANNEL_SETUP_MAX } from '../../../modules/scheduler/channel-manager/constants';
import type { ChannelSetupConfig, SetupStrategyConfig, SetupStrategyKey } from '../types';
import type { SafeLocalStorageMutationResult } from '../../../utils/storage';

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

const okMutation = (): SafeLocalStorageMutationResult => ({ ok: true });

const createStore = (
    storage: Map<string, string>,
    overrides?: Partial<ConstructorParameters<typeof ChannelSetupRecordStore>[0]>
): ChannelSetupRecordStore => new ChannelSetupRecordStore({
    storageGet: (key: string): string | null => storage.get(key) ?? null,
    storageSet: (key: string, value: string): SafeLocalStorageMutationResult => {
        storage.set(key, value);
        return okMutation();
    },
    storageRemove: (key: string): SafeLocalStorageMutationResult => {
        storage.delete(key);
        return okMutation();
    },
    getActiveUserId: (): string | null => 'user-1',
    ...overrides,
});

describe('ChannelSetupRecordStore', () => {
    it('returns null for missing records', () => {
        const storage = new Map<string, string>();
        const store = createStore(storage);

        expect(store.getRecord('server-1')).toBeNull();
    });

    it('removes and diagnoses invalid stored payloads', () => {
        const storage = new Map<string, string>();
        const diagnostics: unknown[] = [];
        storage.set('lineup_channel_setup_v3:server-1:user-1', JSON.stringify({
            serverId: 'server-1',
            selectedLibraryIds: ['lib-1'],
            strategyConfig: { playlists: { enabled: true } },
            createdAt: Date.now(),
            updatedAt: Date.now(),
        }));
        const store = createStore(storage, {
            appendDiagnostic: (event): void => {
                diagnostics.push(event);
            },
        });

        expect(store.getRecord('server-1')).toBeNull();
        expect(storage.has('lineup_channel_setup_v3:server-1:user-1')).toBe(false);
        expect(diagnostics).toEqual([
            expect.objectContaining({
                reason: 'invalid-shape',
                serverId: 'server-1',
                storageKey: 'lineup_channel_setup_v3:server-1:user-1',
            }),
        ]);
    });

    it('removes and diagnoses malformed JSON and server-mismatched records', () => {
        const storage = new Map<string, string>();
        const diagnostics: unknown[] = [];
        storage.set('lineup_channel_setup_v3:server-1:user-1', '{not-json');
        storage.set('lineup_channel_setup_v3:server-2:user-1', JSON.stringify({
            ...createConfig({ serverId: 'other-server' }),
            createdAt: 1,
            updatedAt: 2,
        }));
        const store = createStore(storage, {
            appendDiagnostic: (event): void => {
                diagnostics.push(event);
            },
        });

        expect(store.getRecord('server-1')).toBeNull();
        expect(store.getRecord('server-2')).toBeNull();

        expect(storage.has('lineup_channel_setup_v3:server-1:user-1')).toBe(false);
        expect(storage.has('lineup_channel_setup_v3:server-2:user-1')).toBe(false);
        expect(diagnostics).toEqual([
            expect.objectContaining({ reason: 'invalid-json', serverId: 'server-1' }),
            expect.objectContaining({ reason: 'server-mismatch', serverId: 'server-2' }),
        ]);
    });

    it('diagnoses cleanup failure when corrupt setup records cannot be removed', () => {
        const storage = new Map<string, string>();
        const diagnostics: unknown[] = [];
        storage.set('lineup_channel_setup_v3:server-1:user-1', '{not-json');
        const store = createStore(storage, {
            storageRemove: (): SafeLocalStorageMutationResult => ({ ok: false, reason: 'unavailable' }),
            appendDiagnostic: (event): void => {
                diagnostics.push(event);
            },
        });

        expect(store.getRecord('server-1')).toBeNull();
        expect(storage.has('lineup_channel_setup_v3:server-1:user-1')).toBe(true);
        expect(diagnostics).toEqual([
            expect.objectContaining({ reason: 'invalid-json', serverId: 'server-1' }),
            expect.objectContaining({ reason: 'remove-failed', detail: 'unavailable', serverId: 'server-1' }),
        ]);
    });

    it('reads valid stored record and normalizes config', () => {
        const storage = new Map<string, string>();
        storage.set('lineup_channel_setup_v3:server-1:user-1', JSON.stringify({
            ...createConfig({ maxChannels: Number.POSITIVE_INFINITY }),
            createdAt: 11,
            updatedAt: 22,
        }));
        const store = createStore(storage);

        const record = store.getRecord('server-1');
        expect(record).not.toBeNull();
        expect(record?.maxChannels).toBe(DEFAULT_CHANNEL_SETUP_MAX);
        expect(record?.createdAt).toBe(11);
    });

    it('markSetupComplete writes expected key and preserves createdAt', () => {
        const storage = new Map<string, string>();
        storage.set('lineup_channel_setup_v3:server-1:user-1', JSON.stringify({
            ...createConfig(),
            createdAt: 101,
            updatedAt: 202,
        }));
        const store = createStore(storage);

        const result = store.markSetupComplete('server-1', createConfig({ minItemsPerChannel: 7 }));
        expect(result.ok).toBe(true);
        expect(result.ok ? result.record.createdAt : null).toBe(101);

        const raw = storage.get('lineup_channel_setup_v3:server-1:user-1');
        expect(raw).toBeTruthy();
        expect(storage.has('lineup_channel_setup_v3:server-1:user-1')).toBe(true);
        expect(storage.has('lineup_channel_setup_v3:server-2:user-1')).toBe(false);
    });

    it('scopes setup records by active user and server', () => {
        const storage = new Map<string, string>();
        let activeUserId = 'user-a';
        const store = createStore(storage, {
            getActiveUserId: (): string | null => activeUserId,
        });

        expect(store.markSetupComplete('server-1', createConfig()).ok).toBe(true);
        activeUserId = 'user-b';
        expect(store.getRecord('server-1')).toBeNull();
        expect(store.markSetupComplete('server-1', createConfig({ selectedLibraryIds: ['lib-b'] })).ok).toBe(true);
        activeUserId = 'user-a';

        expect(store.getRecord('server-1')?.selectedLibraryIds).toEqual(['lib-1']);
        expect(storage.has('lineup_channel_setup_v3:server-1:user-a')).toBe(true);
        expect(storage.has('lineup_channel_setup_v3:server-1:user-b')).toBe(true);
    });

    it('does not report setup complete when storage set returns quota failure', () => {
        const storage = new Map<string, string>();
        const store = createStore(storage, {
            storageSet: (): SafeLocalStorageMutationResult => ({ ok: false, reason: 'quota-exceeded' }),
        });

        expect(store.markSetupComplete('server-1', createConfig())).toEqual({
            ok: false,
            reason: 'quota-exceeded',
            message: 'Device storage is full.',
        });
        expect(storage.size).toBe(0);
    });

    it('does not report setup complete when storage set returns unavailable', () => {
        const storage = new Map<string, string>();
        const store = createStore(storage, {
            storageSet: (): SafeLocalStorageMutationResult => ({ ok: false, reason: 'unavailable' }),
        });

        expect(store.markSetupComplete('server-1', createConfig())).toEqual({
            ok: false,
            reason: 'unavailable',
            message: 'Device storage is unavailable.',
        });
        expect(storage.size).toBe(0);
    });

    it('diagnoses setup record clear failures', () => {
        const storage = new Map<string, string>();
        const diagnostics: unknown[] = [];
        storage.set('lineup_channel_setup_v3:server-1:user-1', 'persisted');
        const store = createStore(storage, {
            storageRemove: (): SafeLocalStorageMutationResult => ({ ok: false, reason: 'unavailable' }),
            appendDiagnostic: (event): void => {
                diagnostics.push(event);
            },
        });

        store.clearRecord('server-1');

        expect(storage.has('lineup_channel_setup_v3:server-1:user-1')).toBe(true);
        expect(diagnostics).toEqual([
            expect.objectContaining({
                reason: 'remove-failed',
                detail: 'unavailable',
                serverId: 'server-1',
                storageKey: 'lineup_channel_setup_v3:server-1:user-1',
            }),
        ]);
    });

    it('does not use an ambiguous setup record when active user is missing', () => {
        const storage = new Map<string, string>();
        const store = createStore(storage, {
            getActiveUserId: (): string | null => null,
        });

        expect(store.getRecord('server-1')).toBeNull();
        expect(store.markSetupComplete('server-1', createConfig())).toEqual({
            ok: false,
            reason: 'missing-active-user',
            message: 'No active Plex profile is selected.',
        });
        expect(storage.size).toBe(0);
    });
});
