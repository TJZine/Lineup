import { PlexLibraryError } from '../PlexLibraryError';
import {
    extractDirectoryArray,
    extractMediaContainer,
    extractMetadataArray,
    extractSearchHubMetadata,
    extractSearchHubs,
} from '../libraryResponsePayload';

describe('libraryResponsePayload', () => {
    it('returns the media container when present', () => {
        const response = { MediaContainer: { size: 3 } };

        expect(extractMediaContainer(response, 'test')).toEqual({ size: 3 });
    });

    it('throws a typed parse error when MediaContainer is missing', () => {
        expect(() => extractMediaContainer({} as never, 'test')).toThrow(PlexLibraryError);
    });

    it('rejects array MediaContainer payloads', () => {
        expect(() =>
            extractMediaContainer({ MediaContainer: [] } as never, 'test')
        ).toThrow(PlexLibraryError);
    });

    it('requires Metadata to be an array', () => {
        expect(() =>
            extractMetadataArray({ MediaContainer: { Metadata: {} } } as never, 'metadata test')
        ).toThrow(PlexLibraryError);
    });

    it('treats missing Metadata as an empty result set', () => {
        expect(extractMetadataArray({ MediaContainer: {} } as never, 'metadata test')).toEqual([]);
    });

    it('requires Directory to be an array', () => {
        expect(() =>
            extractDirectoryArray({ MediaContainer: { Directory: {} } } as never, 'directory test')
        ).toThrow(PlexLibraryError);
    });

    it('requires Hub to be an array', () => {
        expect(() =>
            extractSearchHubs({ MediaContainer: { Hub: {} } } as never, 'search test')
        ).toThrow(PlexLibraryError);
    });

    it('treats missing Hub as empty search results', () => {
        expect(extractSearchHubs({ MediaContainer: {} } as never, 'search test')).toEqual([]);
    });

    it('rejects null Hub payloads instead of treating them as empty results', () => {
        expect(() =>
            extractSearchHubs({ MediaContainer: { Hub: null } } as never, 'search test')
        ).toThrow(PlexLibraryError);
    });

    it('requires each search hub entry to be an object', () => {
        expect(() =>
            extractSearchHubs({ MediaContainer: { Hub: [null] } } as never, 'search test')
        ).toThrow(PlexLibraryError);
    });

    it('requires search hub Metadata to be an array when present', () => {
        expect(() =>
            extractSearchHubMetadata({ type: 'movie', Metadata: {} }, 'search hub')
        ).toThrow(PlexLibraryError);
    });

    it('treats missing search hub Metadata as empty results', () => {
        expect(extractSearchHubMetadata({ type: 'movie' }, 'search hub')).toEqual([]);
    });

    it('rejects null search hub Metadata', () => {
        expect(() =>
            extractSearchHubMetadata({ type: 'movie', Metadata: null }, 'search hub')
        ).toThrow(PlexLibraryError);
    });

});
