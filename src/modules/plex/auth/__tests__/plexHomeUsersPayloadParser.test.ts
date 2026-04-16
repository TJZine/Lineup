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
});
