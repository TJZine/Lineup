import type { RawMediaItem, PlexMediaItem } from './types';
export { parseMediaItem, mapMediaType } from './mediaItemCoreParser';
import { parseMediaItem } from './mediaItemCoreParser';

export function parseMediaItems(metadata: RawMediaItem[] | undefined): PlexMediaItem[] {
    return (metadata ?? []).map(parseMediaItem);
}
