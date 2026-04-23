import type {
    RawMediaItem,
    PlexMediaItem,
} from '../types';
import { applyMediaItemDetails } from './mediaItemDetailsParser';
import { buildBaseMediaItem } from './mediaItemBaseParser';
import { mapMediaType } from './mediaTypeParser';
import { parseRequiredObject } from './parserValidation';

export function parseMediaItem(data: RawMediaItem): PlexMediaItem {
    const mediaItemData = parseRequiredObject<RawMediaItem>(data, 'media item');
    const item = buildBaseMediaItem(mediaItemData);
    applyMediaItemDetails(item, mediaItemData);
    return item;
}

export { mapMediaType };
