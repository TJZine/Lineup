import type {
    RawMediaItem,
    PlexMediaItem,
} from './types';
import { applyMediaItemDetails } from './mediaItemDetailsParser';
import { buildBaseMediaItem } from './mediaItemBaseParser';
import { mapMediaType } from './mediaTypeParser';

export function parseMediaItem(data: RawMediaItem): PlexMediaItem {
    const item = buildBaseMediaItem(data);
    applyMediaItemDetails(item, data);
    return item;
}

export { mapMediaType };
