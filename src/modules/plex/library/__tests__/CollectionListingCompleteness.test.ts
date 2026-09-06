import { AppErrorCode } from '../../../../types/app-errors';
import { PlexLibrary } from '../PlexLibrary';
import { mockConfig, mockFetchSequence } from './plexLibraryTestUtils';

const first = { ratingKey: 'one', key: '/library/collections/one', title: 'Daily' };
const second = { ratingKey: 'two', key: '/library/collections/two', title: 'Other' };

describe('complete collection listings', () => {
    afterEach(() => jest.restoreAllMocks());

    it('continues short pages without a total until an empty page proves completion', async () => {
        mockFetchSequence([
            { json: { MediaContainer: { size: 1, offset: 0, Metadata: [first] } } },
            { json: { MediaContainer: { size: 1, offset: 1, Metadata: [second] } } },
            { json: { MediaContainer: { size: 0, offset: 2, Metadata: [] } } },
        ]);

        const result = await new PlexLibrary(mockConfig).getCollections('library');

        expect(result.map(collection => collection.ratingKey)).toEqual(['one', 'two']);
        expect(fetch).toHaveBeenCalledTimes(3);
        for (const [index, call] of jest.mocked(fetch).mock.calls.entries()) {
            expect(new URL(String(call[0])).searchParams.get('X-Plex-Container-Start'))
                .toBe(String(index));
        }
    });

    it.each([
        ['wrong offset', { totalSize: 2, offset: 0, Metadata: [second] }],
        ['changing total', { totalSize: 3, offset: 1, Metadata: [second] }],
        ['duplicate identity', { totalSize: 2, offset: 1, Metadata: [first] }],
        ['malformed entry', { totalSize: 2, offset: 1, Metadata: [{ title: 'Daily' }] }],
        ['invalid total', { totalSize: -1, offset: 1, Metadata: [second] }],
        ['excess items', { totalSize: 2, offset: 1, Metadata: [second, { ...first, ratingKey: 'three' }] }],
    ])('rejects %s rather than returning a partial candidate set', async (_label, laterPage) => {
        mockFetchSequence([
            { json: { MediaContainer: { totalSize: 2, offset: 0, Metadata: [first] } } },
            { json: { MediaContainer: laterPage } },
        ]);

        await expect(new PlexLibrary(mockConfig).getCollections('library'))
            .rejects.toMatchObject({ code: AppErrorCode.PARSE_ERROR });
        expect(fetch).toHaveBeenCalledTimes(2);
    });
});
