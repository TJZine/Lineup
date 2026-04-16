import { parseHomeUsersPayloadData } from '../plexHomeUsersPayloadParser';
import { PlexApiError } from '../plexAuthTransport';

describe('plexHomeUsersPayloadParser', () => {
    it('returns an empty array for falsy and empty payloads', () => {
        expect(parseHomeUsersPayloadData(null)).toEqual([]);
        expect(parseHomeUsersPayloadData(undefined)).toEqual([]);
        expect(parseHomeUsersPayloadData('')).toEqual([]);
        expect(parseHomeUsersPayloadData('   ')).toEqual([]);
    });

    it('parses and deduplicates nested JSON payloads', () => {
        const users = parseHomeUsersPayloadData({
            MediaContainer: {
                users: [
                    { id: '1', title: 'Admin', admin: 1, protected: 1 },
                    { id: '1', title: 'Admin', admin: 1, protected: 1 },
                    { id: '2', title: 'Kid', admin: 0, protected: 0 },
                ],
            },
        });

        expect(users).toEqual([
            { id: '1', title: 'Admin', admin: true, protected: true, thumb: null },
            { id: '2', title: 'Kid', admin: false, protected: false, thumb: null },
        ]);
    });

    it('parses XML user attributes when DOMParser is available', () => {
        const users = parseHomeUsersPayloadData(
            '<MediaContainer><User id="1" title="Admin" admin="1" protected="0" /></MediaContainer>'
        );

        expect(users).toEqual([
            { id: '1', title: 'Admin', admin: true, protected: false, thumb: null },
        ]);
    });

    it('parses XML user attributes when DOMParser is unavailable', () => {
        const originalDomParser = globalThis.DOMParser;
        Object.defineProperty(globalThis, 'DOMParser', {
            configurable: true,
            value: undefined,
        });

        try {
            const users = parseHomeUsersPayloadData(
                '<MediaContainer><User id="1" title="Admin" admin="1" protected="0" /></MediaContainer>'
            );

            expect(users).toEqual([
                { id: '1', title: 'Admin', admin: true, protected: false, thumb: null },
            ]);
        } finally {
            Object.defineProperty(globalThis, 'DOMParser', {
                configurable: true,
                value: originalDomParser,
            });
        }
    });

    it('parses ManagedUser and Account XML tags using the shared container key set', () => {
        const users = parseHomeUsersPayloadData(`
            <MediaContainer>
                <ManagedUser id="1" title="Admin" admin="1" protected="0" />
                <Account id="2" title="Kid" admin="0" protected="1" />
            </MediaContainer>
        `);

        expect(users).toEqual([
            { id: '1', title: 'Admin', admin: true, protected: false, thumb: null },
            { id: '2', title: 'Kid', admin: false, protected: true, thumb: null },
        ]);
    });

    it('throws PlexApiError for malformed JSON text payloads', () => {
        expect(() => parseHomeUsersPayloadData('{invalid')).toThrow(PlexApiError);
        expect(() => parseHomeUsersPayloadData('{invalid')).toThrow(
            'Unable to parse Plex Home users JSON payload'
        );
    });

    it('filters malformed records and preserves valid normalized users', () => {
        const users = parseHomeUsersPayloadData({
            MediaContainer: {
                users: [
                    { id: '1', title: 'Admin', admin: 1, protected: 0, thumb: '' },
                    { id: '', title: 'Missing id', admin: 1, protected: 1 },
                    { id: '2', title: '', admin: 1, protected: 1 },
                    { uuid: 'uuid-only', title: 'UUID User', admin: 'true', protected: 'yes' },
                    { key: 'managed-user-key', title: 'Managed User', admin: 'true', protected: 'yes' },
                ],
            },
        });

        expect(users).toEqual([
            { id: '1', title: 'Admin', admin: true, protected: false, thumb: null },
            {
                id: 'managed-user-key',
                title: 'Managed User',
                admin: true,
                protected: true,
                thumb: null,
            },
        ]);
    });

    it('falls back cleanly when DOMParser is present but not callable', () => {
        const originalDomParser = globalThis.DOMParser;
        Object.defineProperty(globalThis, 'DOMParser', {
            configurable: true,
            value: {},
        });

        try {
            const users = parseHomeUsersPayloadData(
                '<MediaContainer><User id="1" title="Admin" admin="1" protected="0" /></MediaContainer>'
            );

            expect(users).toEqual([
                { id: '1', title: 'Admin', admin: true, protected: false, thumb: null },
            ]);
        } finally {
            Object.defineProperty(globalThis, 'DOMParser', {
                configurable: true,
                value: originalDomParser,
            });
        }
    });

    it('falls back cleanly when DOMParser throws during XML parsing', () => {
        const originalDomParser = globalThis.DOMParser;
        Object.defineProperty(globalThis, 'DOMParser', {
            configurable: true,
            value: function DOMParser(): never {
                throw new TypeError('Not constructable');
            },
        });

        try {
            const users = parseHomeUsersPayloadData(
                '<MediaContainer><User id="1" title="Admin" admin="1" protected="0" /></MediaContainer>'
            );

            expect(users).toEqual([
                { id: '1', title: 'Admin', admin: true, protected: false, thumb: null },
            ]);
        } finally {
            Object.defineProperty(globalThis, 'DOMParser', {
                configurable: true,
                value: originalDomParser,
            });
        }
    });
});
