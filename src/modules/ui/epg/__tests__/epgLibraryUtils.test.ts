import type { ChannelConfig, PlaybackMode } from '../../../scheduler/channel-manager';
import { buildLibraries } from '../epgLibraryUtils';

const makeChannel = (
    id: string,
    number: number,
    name: string,
    overrides: Partial<ChannelConfig> = {}
): ChannelConfig => ({
    id,
    name,
    number,
    contentSource: { type: 'manual', items: [] },
    playbackMode: 'sequential' as PlaybackMode,
    startTimeAnchor: 0,
    skipIntros: false,
    skipCredits: false,
    createdAt: 0,
    updatedAt: 0,
    lastContentRefresh: 0,
    itemCount: 0,
    totalDurationMs: 0,
    ...overrides,
});

describe('buildLibraries', () => {
    it('includes library-backed channels via contentSource.libraryId when sourceLibraryId is missing', () => {
        const libs = buildLibraries([
            makeChannel('c1', 1, 'Channel One', {
                contentSource: { type: 'library', libraryId: 'lib-1', libraryType: 'movie', includeWatched: false },
            }),
        ]);

        expect(libs).toEqual([{ id: 'lib-1', name: 'Channel One' }]);
    });

    it('prefers a non-empty sourceLibraryName when available for the same library id', () => {
        const libs = buildLibraries([
            makeChannel('c1', 1, 'Channel One', {
                contentSource: { type: 'library', libraryId: 'lib-1', libraryType: 'movie', includeWatched: false },
            }),
            makeChannel('c2', 2, 'Channel Two', {
                sourceLibraryName: 'Library One',
                contentSource: { type: 'library', libraryId: 'lib-1', libraryType: 'movie', includeWatched: false },
            }),
        ]);

        expect(libs).toEqual([{ id: 'lib-1', name: 'Library One' }]);
    });

    it('uses sourceLibraryId/sourceLibraryName even when contentSource is not a library', () => {
        const libs = buildLibraries([
            makeChannel('c1', 1, 'Show Channel', {
                sourceLibraryId: 'lib-shows',
                sourceLibraryName: 'Shows',
                contentSource: { type: 'show', showKey: 'show-1', showName: 'Show One' },
            }),
        ]);

        expect(libs).toEqual([{ id: 'lib-shows', name: 'Shows' }]);
    });
});
