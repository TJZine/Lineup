import { updatePlexPartSubtitleSelection } from '../resolver/PlexPartSubtitleSelector';

describe('updatePlexPartSubtitleSelection', () => {
    it('refreshes a stale PMS token and retries once within the captured selection scope', async () => {
        const requestScope = Object.freeze({ id: 'server-a' });
        let accessToken = 'pms-token-old';
        const fetchMock = jest.fn()
            .mockResolvedValueOnce({ ok: false, status: 401 })
            .mockResolvedValueOnce({ ok: true, status: 200 });
        global.fetch = fetchMock as unknown as typeof fetch;
        const recoverAfterUnauthorized = jest.fn(async (
            expectedAccessToken: string,
            allowResourceRefresh: boolean,
            scope: object
        ) => {
            expect(expectedAccessToken).toBe('pms-token-old');
            expect(allowResourceRefresh).toBe(true);
            expect(scope).toBe(requestScope);
            accessToken = 'pms-token-new';
        });

        await updatePlexPartSubtitleSelection({
            partId: 'part-1',
            subtitleStreamId: 'sub-1',
            getServerUri: () => 'http://plex.local:32400',
            getAuthHeaders: () => ({ 'X-Plex-Token': accessToken }),
            selectBaseUriForMixedContent: (uri) => uri,
            throwIfAuthFailure: jest.fn(),
            getAccessToken: () => accessToken,
            captureRequestScope: () => requestScope,
            assertRequestScopeCurrent: (scope) => expect(scope).toBe(requestScope),
            recoverAfterUnauthorized,
            createError: (code, message, recoverable) => ({ code, message, recoverable }),
        });

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('X-Plex-Token'))
            .toBe('pms-token-old');
        expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get('X-Plex-Token'))
            .toBe('pms-token-new');
        expect(recoverAfterUnauthorized).toHaveBeenCalledTimes(1);
    });
});
