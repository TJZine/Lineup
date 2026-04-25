import { summarizeErrorForLog } from '../../../utils/errors';
import { PLEX_MEDIA_TYPES } from './constants';
import type { LibraryQueryOptions, PlexLibrarySection } from './types';
import type { PlexLibraryConfig } from './interfaces';

type LibraryCountFetcher = (
    libraryId: string,
    options?: LibraryQueryOptions
) => Promise<number | null>;

export interface LibraryCountEnrichmentOptions {
    signal?: AbortSignal | null;
    itemCountConcurrency?: number;
    getLibraryItemCount: LibraryCountFetcher;
    logger: NonNullable<PlexLibraryConfig['logger']>;
}

function normalizeItemCountConcurrency(itemCountConcurrency: number | undefined): number {
    const defaultConcurrency = 4;
    const normalizedConcurrency =
        typeof itemCountConcurrency === 'number' && Number.isFinite(itemCountConcurrency)
            ? Math.floor(itemCountConcurrency)
            : defaultConcurrency;
    const requestedConcurrency =
        normalizedConcurrency > 0 ? normalizedConcurrency : defaultConcurrency;
    return Math.max(1, Math.min(requestedConcurrency, 8));
}

function isAbortError(error: unknown, signal: AbortSignal | null): boolean {
    return Boolean(signal?.aborted || (error instanceof Error && error.name === 'AbortError'));
}

function describeLibraryForLog(library: PlexLibrarySection): string {
    return typeof library.title === 'string' && library.title ? library.title : library.id;
}

export async function enrichLibrarySectionCounts(
    libraries: PlexLibrarySection[],
    options: LibraryCountEnrichmentOptions
): Promise<void> {
    const signal = options.signal ?? null;
    const concurrency = normalizeItemCountConcurrency(options.itemCountConcurrency);
    const queue = libraries.slice();
    const workerCount = Math.min(concurrency, queue.length);

    const workers = Array.from({ length: workerCount }, async () => {
        while (queue.length > 0) {
            if (signal?.aborted) {
                return;
            }
            const library = queue.shift();
            if (!library) {
                return;
            }
            try {
                const count = await options.getLibraryItemCount(library.id, { signal });
                library.contentCount = count;

                if (library.type === 'show') {
                    if (count === null) {
                        delete library.episodeCount;
                        continue;
                    }
                    try {
                        const episodeCount = await options.getLibraryItemCount(library.id, {
                            signal,
                            filter: { type: PLEX_MEDIA_TYPES.EPISODE },
                        });
                        if (episodeCount !== null) {
                            library.episodeCount = episodeCount;
                        } else {
                            delete library.episodeCount;
                        }
                    } catch (error) {
                        if (isAbortError(error, signal)) {
                            return;
                        }
                        delete library.episodeCount;
                        options.logger.warn(
                            `[PlexLibrary] Failed to fetch episode count for library ${describeLibraryForLog(library)}:`,
                            summarizeErrorForLog(error)
                        );
                    }
                }
            } catch (error) {
                if (isAbortError(error, signal)) {
                    return;
                }
                library.contentCount = null;
                options.logger.warn(
                    `[PlexLibrary] Failed to fetch item count for library ${describeLibraryForLog(library)}:`,
                    summarizeErrorForLog(error)
                );
            }
        }
    });

    await Promise.all(workers);
}
