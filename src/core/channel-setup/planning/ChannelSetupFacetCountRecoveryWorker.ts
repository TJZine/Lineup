import type { IPlexLibrary, PlexTagDirectoryItem } from '../../../modules/plex/library';
import { buildChannelSetupFacetCountFilter } from './ChannelSetupTagFilters';
import { createAbortError } from './ChannelSetupFacetSnapshotAbort';
import type { ChannelBuildProgress } from '../types';

export type ChannelSetupFacetCountRecoveryFamily = 'genre' | 'director' | 'year' | 'actor' | 'studio';
export type FacetCountRecoveryLimiter = <T>(task: () => Promise<T>) => Promise<T>;

export class ChannelSetupPlanningError extends Error {
    public readonly code: 'COUNT_UNAVAILABLE' = 'COUNT_UNAVAILABLE';

    constructor(message: string) {
        super(message);
        this.name = 'ChannelSetupPlanningError';
    }
}

export function assertRecoveredTagCount(
    count: number | null,
    family: ChannelSetupFacetCountRecoveryFamily,
    tagTitle: string
): number {
    if (count === null) {
        throw new ChannelSetupPlanningError(`${family} count unavailable for ${tagTitle}`);
    }
    return count;
}

type ChannelSetupFacetCountRecoveryWorkerOptions = {
    plexLibrary: IPlexLibrary;
    libraryId: string;
    mediaType: number;
    family: ChannelSetupFacetCountRecoveryFamily;
    tags: PlexTagDirectoryItem[];
    tagSignal: AbortSignal;
    countRecoveryLimiter: FacetCountRecoveryLimiter;
    getLastTask: () => ChannelBuildProgress['task'] | undefined;
    addLibraryQueryMs: (durationMs: number) => void;
    maxConcurrency: number;
};

export class ChannelSetupFacetCountRecoveryWorker {
    constructor(private readonly options: ChannelSetupFacetCountRecoveryWorkerOptions) { }

    async recover(): Promise<PlexTagDirectoryItem[]> {
        const unknownIndexes = this.options.tags
            .map((tag, index) => (tag.count === null ? index : -1))
            .filter((index) => index >= 0);
        if (unknownIndexes.length === 0) {
            return this.options.tags;
        }

        const hydratedTags = [...this.options.tags];
        const workerCount = Math.min(this.options.maxConcurrency, unknownIndexes.length);
        const queue = [...unknownIndexes];
        const siblingAbortController = new AbortController();
        let hasFirstError = false;
        let firstError: unknown;
        const linkedAbortSignal = createLinkedAbortSignal([
            this.options.tagSignal,
            siblingAbortController.signal,
        ]);
        const workers = Array.from({ length: workerCount }, async (): Promise<void> => {
            try {
                while (queue.length > 0) {
                    if (linkedAbortSignal.signal.aborted) {
                        if (hasFirstError) {
                            throw firstError;
                        }
                        return;
                    }
                    const tagIndex = queue.shift();
                    if (tagIndex === undefined || linkedAbortSignal.signal.aborted) {
                        if (hasFirstError) {
                            throw firstError;
                        }
                        return;
                    }
                    const tag = hydratedTags[tagIndex];
                    if (!tag || tag.count !== null) {
                        continue;
                    }
                    const countStart = performance.now();
                    let count: number | null;
                    try {
                        count = await this.options.countRecoveryLimiter(async () => {
                            if (linkedAbortSignal.signal.aborted) {
                                throw createAbortError(this.options.getLastTask());
                            }
                            return this.options.plexLibrary.getLibraryItemCount(this.options.libraryId, {
                                filter: buildChannelSetupFacetCountFilter(
                                    tag,
                                    this.options.family,
                                    this.options.mediaType
                                ),
                                signal: linkedAbortSignal.signal,
                            });
                        });
                    } finally {
                        this.options.addLibraryQueryMs(performance.now() - countStart);
                    }
                    hydratedTags[tagIndex] = {
                        ...tag,
                        count: assertRecoveredTagCount(count, this.options.family, tag.title),
                    };
                }
            } catch (error) {
                const isAbortError = error instanceof Error && error.name === 'AbortError';
                if (!isAbortError && !hasFirstError) {
                    firstError = error;
                    hasFirstError = true;
                }
                if (!siblingAbortController.signal.aborted) {
                    siblingAbortController.abort();
                }
                if (isAbortError && hasFirstError) {
                    throw firstError;
                }
                throw hasFirstError ? firstError : error;
            }
        });
        try {
            await Promise.all(workers);
        } finally {
            linkedAbortSignal.dispose();
        }
        return hydratedTags;
    }
}

function createLinkedAbortSignal(signals: AbortSignal[]): { signal: AbortSignal; dispose: () => void } {
    const controller = new AbortController();
    if (signals.some((signal) => signal.aborted)) {
        controller.abort();
        return {
            signal: controller.signal,
            dispose: () => undefined,
        };
    }
    const listeners: Array<{ signal: AbortSignal; listener: () => void }> = [];
    const abort = (): void => {
        if (!controller.signal.aborted) {
            controller.abort();
        }
    };

    for (const signal of signals) {
        signal.addEventListener('abort', abort, { once: true });
        listeners.push({ signal, listener: abort });
    }

    return {
        signal: controller.signal,
        dispose: (): void => {
            for (const { signal, listener } of listeners) {
                signal.removeEventListener('abort', listener);
            }
            listeners.length = 0;
        },
    };
}
