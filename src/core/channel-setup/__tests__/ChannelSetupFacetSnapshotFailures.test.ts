import { ChannelSetupFacetSnapshotFailureBuilder } from '../planning/ChannelSetupFacetSnapshotFailures';
import { CHANNEL_SETUP_NATIVE_FACET_FAMILY_DESCRIPTORS } from '../planning/ChannelSetupFacetFamilies';
import type { ChannelSetupFacetSnapshotData } from '../planning/ChannelSetupPlanningTypes';

const createSnapshotData = (hasTransientLoadFailure: boolean): ChannelSetupFacetSnapshotData => ({
    playlists: [],
    collectionsByLibraryId: new Map(),
    genresByLibraryId: new Map(),
    directorsByLibraryId: new Map(),
    yearsByLibraryId: new Map(),
    actorsByLibraryId: new Map(),
    studiosByLibraryId: new Map(),
    peopleSeriesIndexByLibraryId: new Map(),
    warnings: [],
    hasTransientLoadFailure,
    errorsTotal: 0,
    playlistMs: 0,
    collectionsMs: 0,
    libraryQueryMs: 0,
});

describe('ChannelSetupFacetSnapshotFailureBuilder', () => {
    it('accepts required tag-directory labels from the canonical native facet descriptor set', () => {
        const builder = new ChannelSetupFacetSnapshotFailureBuilder({
            addWarning: jest.fn(),
            incrementErrors: jest.fn(),
            snapshotData: createSnapshotData,
        });

        for (const descriptor of CHANNEL_SETUP_NATIVE_FACET_FAMILY_DESCRIPTORS) {
            const snapshot = builder.buildRequiredTagDirectoryFailure(
                descriptor.label,
                'Shows',
                4,
                'empty'
            );

            expect(snapshot).toEqual(expect.objectContaining({
                message: expect.stringContaining(`Required ${descriptor.label.toLowerCase()} tag directory`),
            }));
        }
    });

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

    it('classifies primitive timeout codes as transient snapshot failures', () => {
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
            'NETWORK_TIMEOUT'
        );

        expect(snapshot).toEqual(expect.objectContaining({
            status: 'slow',
            failureReason: 'timeout',
            hasTransientLoadFailure: true,
        }));
        expect(snapshotData).toHaveBeenCalledWith(true);
    });

    it('preserves primitive non-timeout error details in blocked snapshot messages', () => {
        const builder = new ChannelSetupFacetSnapshotFailureBuilder({
            addWarning: jest.fn(),
            incrementErrors: jest.fn(),
            snapshotData: createSnapshotData,
        });

        const snapshot = builder.buildRequiredTagDirectoryFailure(
            'Directors',
            'Shows',
            4,
            'error',
            'directory endpoint failed'
        );

        expect(snapshot).toEqual(expect.objectContaining({
            status: 'blocked',
            message: expect.stringContaining('(directory endpoint failed)'),
            failureReason: 'error',
            hasTransientLoadFailure: false,
        }));
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
