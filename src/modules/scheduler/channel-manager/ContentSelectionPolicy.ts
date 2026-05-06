import type {
    ContentFilter,
    PlaybackMode,
    ResolvedContentItem,
    SortOrder,
} from './types';
import { shuffleWithSeed } from '../shared/prng';
import { applyPlaybackOrdering } from '../shared/playbackOrdering';

export class ContentSelectionPolicy {
    applyFilters(items: ResolvedContentItem[], filters: ContentFilter[]): ResolvedContentItem[] {
        if (!filters.length) {
            return items;
        }

        return items.filter((item) => filters.every((filter) => this._matchesFilter(item, filter)));
    }

    applySort(items: ResolvedContentItem[], order: SortOrder): ResolvedContentItem[] {
        const result = [...items];

        switch (order) {
            case 'title_asc':
                result.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'title_desc':
                result.sort((a, b) => b.title.localeCompare(a.title));
                break;
            case 'year_asc':
                result.sort((a, b) => a.year - b.year);
                break;
            case 'year_desc':
                result.sort((a, b) => b.year - a.year);
                break;
            case 'duration_asc':
                result.sort((a, b) => a.durationMs - b.durationMs);
                break;
            case 'duration_desc':
                result.sort((a, b) => b.durationMs - a.durationMs);
                break;
            case 'episode_order':
                result.sort((a, b) => {
                    const seasonA = a.seasonNumber || 0;
                    const seasonB = b.seasonNumber || 0;
                    if (seasonA !== seasonB) return seasonA - seasonB;
                    const epA = a.episodeNumber || 0;
                    const epB = b.episodeNumber || 0;
                    return epA - epB;
                });
                break;
            case 'added_asc':
                result.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
                break;
            case 'added_desc':
                result.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
                break;
            default:
                throw new Error(`Unknown content sort order: ${String(order)}`);
        }

        return result;
    }

    applyPlaybackMode(
        items: ResolvedContentItem[],
        mode: PlaybackMode,
        seed: number,
        blockSize?: number
    ): ResolvedContentItem[] {
        switch (mode) {
            case 'sequential':
            case 'shuffle':
            case 'block':
                return applyPlaybackOrdering({
                    items,
                    mode,
                    seed,
                    blockSize,
                    shuffleItems: shuffleWithSeed,
                });
            case 'random':
                return shuffleWithSeed(items, Date.now()).map((item, index) => ({
                    ...item,
                    scheduledIndex: index,
                }));
            default:
                throw new Error(`Unknown content playback mode: ${String(mode)}`);
        }
    }

    private _matchesFilter(item: ResolvedContentItem, filter: ContentFilter): boolean {
        let value: unknown;
        switch (filter.field) {
            case 'year':
                value = item.year;
                break;
            case 'duration':
                value = item.durationMs;
                break;
            case 'rating':
                value = item.rating;
                if (value === undefined) return false;
                break;
            case 'contentRating':
                value = item.contentRating;
                if (value === undefined) return false;
                break;
            case 'genre': {
                const genres = item.genres || [];
                if (filter.operator === 'contains') {
                    return genres.some((g) => g.toLowerCase().includes(String(filter.value).toLowerCase()));
                } else if (filter.operator === 'notContains') {
                    return !genres.some((g) => g.toLowerCase().includes(String(filter.value).toLowerCase()));
                } else if (filter.operator === 'eq') {
                    return genres.some((g) => g.toLowerCase() === String(filter.value).toLowerCase());
                } else if (filter.operator === 'neq') {
                    return !genres.some((g) => g.toLowerCase() === String(filter.value).toLowerCase());
                }
                return true;
            }
            case 'director': {
                const directors = item.directors || [];
                if (filter.operator === 'contains') {
                    return directors.some((d) => d.toLowerCase().includes(String(filter.value).toLowerCase()));
                } else if (filter.operator === 'notContains') {
                    return !directors.some((d) => d.toLowerCase().includes(String(filter.value).toLowerCase()));
                } else if (filter.operator === 'eq') {
                    return directors.some((d) => d.toLowerCase() === String(filter.value).toLowerCase());
                } else if (filter.operator === 'neq') {
                    return !directors.some((d) => d.toLowerCase() === String(filter.value).toLowerCase());
                }
                return true;
            }
            case 'watched':
                value = item.watched;
                if (value === undefined) return false;
                break;
            case 'addedAt':
                value = item.addedAt;
                if (value === undefined) return false;
                break;
            default:
                return true;
        }

        switch (filter.operator) {
            case 'eq':
                return value === filter.value;
            case 'neq':
                return value !== filter.value;
            case 'gt':
            case 'gte':
            case 'lt':
            case 'lte': {
                const numVal = Number(value);
                const numFilter = Number(filter.value);
                if (!Number.isFinite(numVal) || !Number.isFinite(numFilter)) {
                    return true;
                }
                if (filter.operator === 'gt') return numVal > numFilter;
                if (filter.operator === 'gte') return numVal >= numFilter;
                if (filter.operator === 'lt') return numVal < numFilter;
                return numVal <= numFilter;
            }
            case 'contains':
                return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
            case 'notContains':
                return !String(value).toLowerCase().includes(String(filter.value).toLowerCase());
            default:
                return true;
        }
    }
}
