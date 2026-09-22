import type {
    ContentFilter,
    PlaybackMode,
    ResolvedContentItem,
    SortOrder,
} from '../contracts/types';
import { shuffleWithSeed } from '../../shared/prng';
import { applyPlaybackOrdering } from '../../shared/playbackOrdering';

export class ContentSelectionPolicy {
    interleave(arrays: ResolvedContentItem[][]): ResolvedContentItem[] {
        const result: ResolvedContentItem[] = [];
        const maxLength = Math.max(...arrays.map((items) => items.length));
        for (let index = 0; index < maxLength; index += 1) {
            for (const items of arrays) {
                const item = items[index];
                if (item) result.push({ ...item, scheduledIndex: result.length });
            }
        }
        return result;
    }

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
            case 'random':
                return applyPlaybackOrdering({
                    items,
                    mode: mode === 'random' ? 'shuffle' : mode,
                    seed,
                    blockSize,
                    shuffleItems: shuffleWithSeed,
                });
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
            case 'genre':
                return this._matchesListFilter(item.genres || [], filter);
            case 'director':
                return this._matchesListFilter(item.directors || [], filter);
            case 'watched':
                value = item.watched;
                if (value === undefined) return false;
                break;
            case 'addedAt':
                value = item.addedAt;
                if (value === undefined) return false;
                break;
            default:
                return false;
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
                    return false;
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
                return false;
        }
    }

    private _matchesListFilter(values: readonly string[], filter: ContentFilter): boolean {
        const filterValue = String(filter.value).toLowerCase();

        switch (filter.operator) {
            case 'contains':
                return values.some((value) => value.toLowerCase().includes(filterValue));
            case 'notContains':
                return !values.some((value) => value.toLowerCase().includes(filterValue));
            case 'eq':
                return values.some((value) => value.toLowerCase() === filterValue);
            case 'neq':
                return !values.some((value) => value.toLowerCase() === filterValue);
            default:
                return false;
        }
    }
}
