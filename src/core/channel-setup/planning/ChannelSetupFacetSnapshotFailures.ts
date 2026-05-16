import { AppErrorCode, getAppErrorCode } from '../../../types/app-errors';
import type {
    ChannelBuildProgress,
} from '../types';
import type {
    PlexCollection,
    PlexPlaylist,
    PlexTagDirectoryItem,
} from '../../../modules/plex/library';
import type {
    ChannelSetupFacetMap,
    ChannelSetupFacetSnapshot,
    ChannelSetupFacetSnapshotData,
    ChannelSetupFacetSnapshotFailureReason,
} from './ChannelSetupPlanningTypes';
import type { PlexTagDirectoryUnsupportedReason } from '../../../modules/plex/library';
import {
    getChannelSetupErrorSummaryObject,
    getChannelSetupFailureDetail,
} from './ChannelSetupErrorSummary';
import type {
    ChannelSetupNativeFacetFamily,
    ChannelSetupRequiredTagDirectoryLabel,
} from './ChannelSetupFacetFamilies';

function createReadonlyFacetMap<T>(source: Map<string, T[]>): ChannelSetupFacetMap<T> {
    const snapshot = new Map<string, readonly T[]>();
    for (const [libraryId, values] of source.entries()) {
        snapshot.set(libraryId, Object.freeze([...values]));
    }
    const readonlyMap: ChannelSetupFacetMap<T> = {
        get size() {
            return snapshot.size;
        },
        get: (key: string): readonly T[] | undefined => snapshot.get(key),
        has: (key: string): boolean => snapshot.has(key),
        entries: (): MapIterator<[string, readonly T[]]> => snapshot.entries(),
        keys: (): MapIterator<string> => snapshot.keys(),
        values: (): MapIterator<readonly T[]> => snapshot.values(),
        forEach: (
            callbackfn: (value: readonly T[], key: string, map: ReadonlyMap<string, readonly T[]>) => void,
            thisArg?: unknown
        ): void => {
            snapshot.forEach((value, key) => {
                callbackfn.call(thisArg, value, key, readonlyMap);
            });
        },
        [Symbol.iterator]: (): MapIterator<[string, readonly T[]]> => snapshot[Symbol.iterator](),
    };
    return Object.freeze(readonlyMap);
}

export class ChannelSetupFacetSnapshotLoadState {
    readonly playlists: PlexPlaylist[] = [];
    readonly collectionsByLibraryId = new Map<string, PlexCollection[]>();
    readonly genresByLibraryId = new Map<string, PlexTagDirectoryItem[]>();
    readonly directorsByLibraryId = new Map<string, PlexTagDirectoryItem[]>();
    readonly yearsByLibraryId = new Map<string, PlexTagDirectoryItem[]>();
    readonly actorsByLibraryId = new Map<string, PlexTagDirectoryItem[]>();
    readonly studiosByLibraryId = new Map<string, PlexTagDirectoryItem[]>();
    private readonly _warnings = new Set<string>();
    private _hasWarningOnlyTransientLoadFailure = false;
    errorsTotal = 0;
    playlistMs = 0;
    collectionsMs = 0;
    libraryQueryMs = 0;

    addPartialWarning(task: ChannelBuildProgress['task'], detail: string, error: unknown): void {
        const message = getChannelSetupFailureDetail(getChannelSetupErrorSummaryObject(error));
        this._warnings.add(`Partial setup plan (${task}): ${detail} (${message})`);
    }

    addWarning(message: string): void {
        this._warnings.add(message);
    }

    addEmptyTagDirectoryWarning(
        _family: ChannelSetupNativeFacetFamily,
        label: ChannelSetupRequiredTagDirectoryLabel,
        libraryTitle: string,
        type: number
    ): void {
        this._hasWarningOnlyTransientLoadFailure = true;
        this._warnings.add(
            `Skipped ${label.toLowerCase()} for ${libraryTitle}: Plex returned no tag entries (type=${type}).`
        );
    }

    snapshotData(
        hasTransientLoadFailure: boolean,
        lastTask: ChannelBuildProgress['task'] | undefined
    ): ChannelSetupFacetSnapshotData {
        return {
            playlists: Object.freeze([...this.playlists]),
            collectionsByLibraryId: createReadonlyFacetMap(this.collectionsByLibraryId),
            genresByLibraryId: createReadonlyFacetMap(this.genresByLibraryId),
            directorsByLibraryId: createReadonlyFacetMap(this.directorsByLibraryId),
            yearsByLibraryId: createReadonlyFacetMap(this.yearsByLibraryId),
            actorsByLibraryId: createReadonlyFacetMap(this.actorsByLibraryId),
            studiosByLibraryId: createReadonlyFacetMap(this.studiosByLibraryId),
            warnings: Object.freeze(Array.from(this._warnings).sort((a, b) => a.localeCompare(b))),
            hasTransientLoadFailure: hasTransientLoadFailure || this._hasWarningOnlyTransientLoadFailure,
            errorsTotal: this.errorsTotal,
            playlistMs: this.playlistMs,
            collectionsMs: this.collectionsMs,
            libraryQueryMs: this.libraryQueryMs,
            ...(lastTask !== undefined ? { lastTask } : {}),
        };
    }
}

type SnapshotFailureBuilderOptions = {
    addWarning: (message: string) => void;
    incrementErrors: () => void;
    snapshotData: (hasTransientLoadFailure: boolean) => ChannelSetupFacetSnapshotData;
};

export class ChannelSetupFacetSnapshotFailureBuilder {
    constructor(private readonly options: SnapshotFailureBuilderOptions) { }

    buildFailureSnapshot(
        status: 'blocked' | 'slow',
        message: string,
        failureReason: ChannelSetupFacetSnapshotFailureReason,
        hasTransientLoadFailure = false
    ): ChannelSetupFacetSnapshot {
        this.options.addWarning(message);
        this.options.incrementErrors();
        return {
            status,
            message,
            failureReason,
            ...this.options.snapshotData(hasTransientLoadFailure),
        };
    }

    buildRequiredTagDirectoryFailure(
        label: ChannelSetupRequiredTagDirectoryLabel,
        libraryTitle: string,
        type: number,
        reason: PlexTagDirectoryUnsupportedReason | 'error',
        error?: unknown
    ): ChannelSetupFacetSnapshot {
        const baseLabel = label.toLowerCase();
        if (reason === 'error') {
            const summaryObject = getChannelSetupErrorSummaryObject(error);
            const detail = getChannelSetupFailureDetail(summaryObject);
            if (getAppErrorCode(summaryObject.code) === AppErrorCode.NETWORK_TIMEOUT) {
                return this.buildFailureSnapshot(
                    'slow',
                    `Required ${baseLabel} tag directory (type=${type}) timed out for ${libraryTitle}; try again after Plex responds.`,
                    'timeout',
                    true
                );
            }
            return this.buildFailureSnapshot(
                'blocked',
                `Required ${baseLabel} tag directory (type=${type}) failed for ${libraryTitle} (${detail}); stop and re-plan.`,
                'error'
            );
        }
        const detail = reason === 'empty' ? 'returned no entries' : 'is unsupported';
        return this.buildFailureSnapshot(
            'blocked',
            `Required ${baseLabel} tag directory (type=${type}) ${detail} for ${libraryTitle}; stop and re-plan.`,
            reason === 'empty' ? 'empty' : 'unsupported'
        );
    }

    buildRequiredTagCountRecoveryFailure(
        label: ChannelSetupRequiredTagDirectoryLabel,
        libraryTitle: string,
        type: number,
        error: unknown
    ): ChannelSetupFacetSnapshot {
        const baseLabel = label.toLowerCase();
        const summaryObject = getChannelSetupErrorSummaryObject(error);
        const detail = getChannelSetupFailureDetail(summaryObject);
        if (getAppErrorCode(summaryObject.code) === AppErrorCode.NETWORK_TIMEOUT) {
            return this.buildFailureSnapshot(
                'slow',
                `Required ${baseLabel} item counts (type=${type}) timed out for ${libraryTitle}; try again after Plex responds.`,
                'timeout',
                true
            );
        }
        return this.buildFailureSnapshot(
            'blocked',
            `Required ${baseLabel} item counts (type=${type}) failed for ${libraryTitle} (${detail}); stop and re-plan.`,
            'error'
        );
    }
}
