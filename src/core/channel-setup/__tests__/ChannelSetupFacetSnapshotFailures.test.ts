import { ChannelSetupFacetSnapshotFailureBuilder } from '../planning/ChannelSetupFacetSnapshotFailures';
import type { ChannelSetupFacetSnapshotData } from '../planning/ChannelSetupPlanningTypes';

const createSnapshotData = (hasTransientLoadFailure: boolean): ChannelSetupFacetSnapshotData => ({
    playlists: [],
    collectionsByLibraryId: new Map(),
    genresByLibraryId: new Map(),
    directorsByLibraryId: new Map(),
    yearsByLibraryId: new Map(),
    actorsByLibraryId: new Map(),
    studiosByLibraryId: new Map(),
    warnings: [],
    hasTransientLoadFailure,
    errorsTotal: 0,
    playlistMs: 0,
    collectionsMs: 0,
    libraryQueryMs: 0,
});

describe('ChannelSetupFacetSnapshotFailureBuilder', () => {
    it('marks timeout tag directory failures as transient snapshot failures', () => {
        const snapshotData = jest.fn(createSnapshotData);
        const builder = new ChannelSetupFacetSnapshotFailureBuilder({
            addWarning: jest.fn(),
            incrementErrors: jest.fn(),
            snapshotData,
        });

        const snapshot = builder.buildRequiredTagDirectoryFailure(
            'Genres',
            'Shows',
            2,
            'error',
            { code: 'NETWORK_TIMEOUT', message: 'timed out' }
        );

        expect(snapshot).toEqual(expect.objectContaining({
            status: 'slow',
            failureReason: 'timeout',
            hasTransientLoadFailure: true,
        }));
        expect(snapshotData).toHaveBeenCalledWith(true);
    });

    it('marks timeout tag count recovery failures as transient snapshot failures', () => {
        const snapshotData = jest.fn(createSnapshotData);
        const builder = new ChannelSetupFacetSnapshotFailureBuilder({
            addWarning: jest.fn(),
            incrementErrors: jest.fn(),
            snapshotData,
        });

        const snapshot = builder.buildRequiredTagCountRecoveryFailure(
            'Genres',
            'Shows',
            2,
            { code: 'NETWORK_TIMEOUT', message: 'timed out' }
        );

        expect(snapshot).toEqual(expect.objectContaining({
            status: 'slow',
            failureReason: 'timeout',
            hasTransientLoadFailure: true,
        }));
        expect(snapshotData).toHaveBeenCalledWith(true);
    });

    it('keeps unsupported and non-timeout error failures non-transient', () => {
        const snapshotData = jest.fn(createSnapshotData);
        const builder = new ChannelSetupFacetSnapshotFailureBuilder({
            addWarning: jest.fn(),
            incrementErrors: jest.fn(),
            snapshotData,
        });

        const unsupported = builder.buildRequiredTagDirectoryFailure(
            'Genres',
            'Shows',
            2,
            'unavailable'
        );
        const error = builder.buildRequiredTagCountRecoveryFailure(
            'Genres',
            'Shows',
            2,
            { code: 'SERVER_ERROR', message: 'failed' }
        );

        expect(unsupported.hasTransientLoadFailure).toBe(false);
        expect(error.hasTransientLoadFailure).toBe(false);
        expect(snapshotData).toHaveBeenNthCalledWith(1, false);
        expect(snapshotData).toHaveBeenNthCalledWith(2, false);
    });
});
