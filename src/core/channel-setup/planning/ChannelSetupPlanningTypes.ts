import type {
    ChannelBuildProgress,
    ChannelSetupEstimates,
    ChannelSetupPreviewFailureReason,
} from '../types';
import type {
    PlexCollection,
    PlexPlaylist,
    PlexTagDirectoryItem,
    getPlexRequestIntentForChannelSetup,
} from '../../../modules/plex/library';
import type {
    ChannelConfig,
    ChannelCreateInput,
} from '../../../modules/scheduler/channel-manager';

export type PendingChannel =
    ChannelCreateInput
    & {
        name: string;
        playbackMode: ChannelConfig['playbackMode'];
        shuffleSeed: number;
    };

export const createEmptyChannelSetupEstimates = (): ChannelSetupEstimates => ({
    total: 0,
    collections: 0,
    playlists: 0,
    genres: 0,
    directors: 0,
    decades: 0,
    recentlyAdded: 0,
    studios: 0,
    actors: 0,
});

export const toChannelSetupDecadeValue = (title: string): number | null => {
    const year = Number.parseInt(title, 10);
    if (!Number.isFinite(year)) {
        return null;
    }
    return Math.floor(year / 10) * 10;
};

export type ChannelSetupPlanningIntent = 'preview' | 'build';
export type ChannelSetupPlexRequestIntent = ReturnType<typeof getPlexRequestIntentForChannelSetup>;

export type ChannelSetupFacetSnapshotData = {
    playlists: PlexPlaylist[];
    collectionsByLibraryId: Map<string, PlexCollection[]>;
    genresByLibraryId: Map<string, PlexTagDirectoryItem[]>;
    directorsByLibraryId: Map<string, PlexTagDirectoryItem[]>;
    yearsByLibraryId: Map<string, PlexTagDirectoryItem[]>;
    actorsByLibraryId: Map<string, PlexTagDirectoryItem[]>;
    studiosByLibraryId: Map<string, PlexTagDirectoryItem[]>;
    warnings: string[];
    hasTransientLoadFailure: boolean;
    errorsTotal: number;
    playlistMs: number;
    collectionsMs: number;
    libraryQueryMs: number;
    lastTask?: ChannelBuildProgress['task'];
};

export type ChannelSetupFacetSnapshot =
    | ({ status: 'ready' } & ChannelSetupFacetSnapshotData)
    | ({
        status: 'blocked' | 'slow';
        message: string;
        failureReason: ChannelSetupPreviewFailureReason;
    } & ChannelSetupFacetSnapshotData);
