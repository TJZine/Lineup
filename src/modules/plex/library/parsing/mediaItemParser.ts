import type { RawMediaItem, PlexMediaItem } from '../types';
export { parseMediaItem, mapMediaType } from './mediaItemCoreParser';
import { parseMediaItem } from './mediaItemCoreParser';
import { parseArrayOrEmpty, parseRequiredObject } from './parserValidation';

export function parseMediaItems(metadata: unknown): PlexMediaItem[] {
    return parseArrayOrEmpty<unknown>(metadata, 'media items').map((item, index) =>
        parseMediaItem(parseRequiredObject<RawMediaItem>(item, `media items[${index}]`))
    );
}
