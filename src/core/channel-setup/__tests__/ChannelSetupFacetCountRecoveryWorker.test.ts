/**
 * @jest-environment jsdom
 */

import type { IPlexLibrary } from '../../../modules/plex/library';
import {
    ChannelSetupFacetCountRecoveryWorker,
    assertRecoveredTagCount,
    type FacetCountRecoveryLimiter,
} from '../planning/ChannelSetupFacetCountRecoveryWorker';
import { CHANNEL_SETUP_NATIVE_FACET_FAMILY_DESCRIPTORS } from '../planning/ChannelSetupFacetFamilies';

describe('ChannelSetupFacetCountRecoveryWorker', () => {
    it('checkpoints while scanning one large native-facet result with no missing counts', async () => {
        const tags = Array.from({ length: 300 }, (_, index) => ({
            key: `genre-${index}`,
            title: `Genre ${index}`,
            count: index,
        }));
        const checkpoint = jest.fn(async (): Promise<void> => undefined);
        const plexLibrary = {
            getLibraryItemCount: jest.fn(),
        } as unknown as jest.Mocked<IPlexLibrary>;

        const result = await new ChannelSetupFacetCountRecoveryWorker({
            plexLibrary,
            libraryId: 'shows',
            mediaType: 2,
            family: 'genre',
            tags,
            tagSignal: new AbortController().signal,
            countRecoveryLimiter: <T>(task: () => Promise<T>): Promise<T> => task(),
            getLastTask: (): 'scan_library_items' => 'scan_library_items',
            addLibraryQueryMs: jest.fn(),
            maxConcurrency: 1,
            checkpoint,
        }).recover();

        expect(checkpoint).toHaveBeenCalledTimes(2);
        expect(result).toBe(tags);
        expect(plexLibrary.getLibraryItemCount).not.toHaveBeenCalled();
    });

    it('uses the canonical native facet count-recovery families in unavailable-count errors', () => {
        for (const descriptor of CHANNEL_SETUP_NATIVE_FACET_FAMILY_DESCRIPTORS) {
            expect(() => assertRecoveredTagCount(
                null,
                descriptor.countRecoveryFamily,
                'Missing Count'
            )).toThrow(`${descriptor.countRecoveryFamily} count unavailable for Missing Count`);
        }
    });

    it('records only Plex count query duration and excludes limiter queue time', async () => {
        const performanceNowSpy = jest.spyOn(performance, 'now')
            .mockReturnValueOnce(100)
            .mockReturnValueOnce(120)
            .mockReturnValueOnce(130);
        const addLibraryQueryMs = jest.fn();
        const limiter: FacetCountRecoveryLimiter = jest.fn(<T>(task: () => Promise<T>) => {
            performance.now();
            return task();
        });
        const plexLibrary = {
            getLibraryItemCount: jest.fn().mockResolvedValue(12),
        } as unknown as jest.Mocked<IPlexLibrary>;

        try {
            const result = await new ChannelSetupFacetCountRecoveryWorker({
                plexLibrary,
                libraryId: 'shows',
                mediaType: 2,
                family: 'genre',
                tags: [{ key: 'genre-1', title: 'Drama', count: null }],
                tagSignal: new AbortController().signal,
                countRecoveryLimiter: limiter,
                getLastTask: (): 'scan_library_items' => 'scan_library_items',
                addLibraryQueryMs,
                maxConcurrency: 1,
                checkpoint: async (): Promise<void> => undefined,
            }).recover();

            expect(result).toEqual([{ key: 'genre-1', title: 'Drama', count: 12 }]);
            expect(limiter).toHaveBeenCalledTimes(1);
            expect(addLibraryQueryMs).toHaveBeenCalledWith(10);
            expect(plexLibrary.getLibraryItemCount).toHaveBeenCalledWith('shows', expect.objectContaining({
                filter: { type: 2, genre: 'Drama' },
                signal: expect.any(Object),
            }));
        } finally {
            performanceNowSpy.mockRestore();
        }
    });

    it('rejects invalid maxConcurrency values instead of resolving with unresolved counts', async () => {
        const plexLibrary = {
            getLibraryItemCount: jest.fn().mockResolvedValue(12),
        } as unknown as jest.Mocked<IPlexLibrary>;

        await expect(new ChannelSetupFacetCountRecoveryWorker({
            plexLibrary,
            libraryId: 'shows',
            mediaType: 2,
            family: 'genre',
            tags: [{ key: 'genre-1', title: 'Drama', count: null }],
            tagSignal: new AbortController().signal,
            countRecoveryLimiter: <T>(task: () => Promise<T>): Promise<T> => task(),
            getLastTask: (): 'scan_library_items' => 'scan_library_items',
            addLibraryQueryMs: jest.fn(),
            maxConcurrency: 0,
            checkpoint: async (): Promise<void> => undefined,
        }).recover()).rejects.toThrow('maxConcurrency must be at least 1');

        expect(plexLibrary.getLibraryItemCount).not.toHaveBeenCalled();
    });

    it('rejects when count recovery is already aborted instead of returning partial tags', async () => {
        const abortController = new AbortController();
        abortController.abort();
        const plexLibrary = {
            getLibraryItemCount: jest.fn().mockResolvedValue(12),
        } as unknown as jest.Mocked<IPlexLibrary>;

        await expect(new ChannelSetupFacetCountRecoveryWorker({
            plexLibrary,
            libraryId: 'shows',
            mediaType: 2,
            family: 'genre',
            tags: [{ key: 'genre-1', title: 'Drama', count: null }],
            tagSignal: abortController.signal,
            countRecoveryLimiter: <T>(task: () => Promise<T>): Promise<T> => task(),
            getLastTask: (): 'scan_library_items' => 'scan_library_items',
            addLibraryQueryMs: jest.fn(),
            maxConcurrency: 1,
            checkpoint: async (): Promise<void> => undefined,
        }).recover()).rejects.toMatchObject({
            name: 'AbortError',
        });

        expect(plexLibrary.getLibraryItemCount).not.toHaveBeenCalled();
    });
});
