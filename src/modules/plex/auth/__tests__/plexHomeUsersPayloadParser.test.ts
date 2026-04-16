import { parseHomeUsersPayloadData } from '../plexHomeUsersPayloadParser';

describe('plexHomeUsersPayloadParser', () => {
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
});
