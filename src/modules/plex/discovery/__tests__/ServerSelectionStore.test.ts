import { installMockLocalStorage, mockLocalStorage } from '../../../../__tests__/mocks/localStorage';
import { PLEX_DISCOVERY_CONSTANTS } from '../constants';
import { ServerSelectionStore } from '../ServerSelectionStore';

installMockLocalStorage();

describe('ServerSelectionStore', () => {
    beforeEach(() => {
        mockLocalStorage.clear();
        jest.restoreAllMocks();
    });

    it('reads null selected server when key is missing', () => {
        const store = new ServerSelectionStore();
        expect(store.readSelectedServerId()).toBeNull();
    });

    it('writes and reads selected server id', () => {
        const store = new ServerSelectionStore();

        store.writeSelectedServerId('srv-1');

        expect(mockLocalStorage.getItem(PLEX_DISCOVERY_CONSTANTS.SELECTED_SERVER_KEY)).toBe('srv-1');
        expect(store.readSelectedServerId()).toBe('srv-1');
    });

    it('normalizes invalid selected server ids by clearing persisted value', () => {
        mockLocalStorage.setItem(PLEX_DISCOVERY_CONSTANTS.SELECTED_SERVER_KEY, '   ');
        const store = new ServerSelectionStore();

        expect(store.readSelectedServerId()).toBeNull();
        expect(mockLocalStorage.getItem(PLEX_DISCOVERY_CONSTANTS.SELECTED_SERVER_KEY)).toBeNull();
    });

    it('returns empty map and clears malformed health JSON', () => {
        mockLocalStorage.setItem(PLEX_DISCOVERY_CONSTANTS.SERVER_HEALTH_KEY, '{bad-json');
        const store = new ServerSelectionStore();

        expect(store.readServerHealthMap()).toEqual({});
        expect(mockLocalStorage.getItem(PLEX_DISCOVERY_CONSTANTS.SERVER_HEALTH_KEY)).toBeNull();
    });

    it('filters invalid health entries and rewrites normalized map', () => {
        mockLocalStorage.setItem(
            PLEX_DISCOVERY_CONSTANTS.SERVER_HEALTH_KEY,
            JSON.stringify({
                'srv-valid': { status: 'ok', type: 'local', latencyMs: 12.7, testedAt: 123 },
                'srv-invalid': { status: 'bogus', type: 'local', latencyMs: 10, testedAt: 123 },
            })
        );

        const store = new ServerSelectionStore();
        const healthMap = store.readServerHealthMap();

        expect(healthMap).toEqual({
            'srv-valid': { status: 'ok', type: 'local', latencyMs: 13, testedAt: 123 },
        });
        expect(mockLocalStorage.getItem(PLEX_DISCOVERY_CONSTANTS.SERVER_HEALTH_KEY)).toBe(
            JSON.stringify({
                'srv-valid': { status: 'ok', type: 'local', latencyMs: 13, testedAt: 123 },
            })
        );
    });

    it('writes health records and preserves previous type/latency when details are missing', () => {
        const store = new ServerSelectionStore();

        store.writeServerHealthRecord({
            serverId: 'srv-1',
            status: 'ok',
            details: {
                connection: { relay: false, local: true },
                latency: 42,
            },
            testedAt: 500,
        });

        store.writeServerHealthRecord({
            serverId: 'srv-1',
            status: 'unreachable',
            testedAt: 600,
        });

        expect(store.readServerHealthMap()).toEqual({
            'srv-1': {
                status: 'unreachable',
                type: 'local',
                latencyMs: 42,
                testedAt: 600,
            },
        });
    });

    it('supports switching storage keys', () => {
        const store = new ServerSelectionStore();

        store.setStorageKeys('selected-a', 'health-a');
        store.writeSelectedServerId('srv-a');

        store.setStorageKeys('selected-b', 'health-b');
        expect(store.readSelectedServerId()).toBeNull();

        store.writeSelectedServerId('srv-b');

        expect(mockLocalStorage.getItem('selected-a')).toBe('srv-a');
        expect(mockLocalStorage.getItem('selected-b')).toBe('srv-b');
    });

    it('treats blocked storage as non-fatal', () => {
        const store = new ServerSelectionStore();

        const getSpy = jest.spyOn(mockLocalStorage, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        const setSpy = jest.spyOn(mockLocalStorage, 'setItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        const removeSpy = jest.spyOn(mockLocalStorage, 'removeItem').mockImplementation(() => {
            throw new Error('blocked');
        });

        expect(() => store.readSelectedServerId()).not.toThrow();
        expect(() => store.readServerHealthMap()).not.toThrow();
        expect(() => store.writeSelectedServerId('srv-1')).not.toThrow();
        expect(() => store.writeServerHealthRecord({ serverId: 'srv-1', status: 'ok' })).not.toThrow();
        expect(() => store.clearSelectedServerId()).not.toThrow();
        expect(() => store.clearServerHealthMap()).not.toThrow();

        getSpy.mockRestore();
        setSpy.mockRestore();
        removeSpy.mockRestore();
    });
});
