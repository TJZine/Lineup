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

    it('requires Metadata to be an array', () => {
        expect(() =>
            extractMetadataArray({ MediaContainer: { Metadata: {} } } as never, 'metadata test')
        ).toThrow(PlexLibraryError);
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

    it('requires each search hub entry to be an object', () => {
        expect(() =>
            extractSearchHubs({ MediaContainer: { Hub: [null] } } as never, 'search test')
        ).toThrow(PlexLibraryError);
    });

    it('requires each search hub Metadata field to be an array', () => {
        expect(() =>
            extractSearchHubMetadata({ type: 'movie', Metadata: {} }, 'search hub')
        ).toThrow(PlexLibraryError);
    });
});
