import type { PlexMediaType } from './types';

const PLEX_MEDIA_TYPE_MAP: Record<string, PlexMediaType> = {
    movie: 'movie',
    show: 'show',
    episode: 'episode',
    track: 'track',
    clip: 'clip',
};

export function mapMediaType(type: string): PlexMediaType {
    return PLEX_MEDIA_TYPE_MAP[type] ?? 'movie';
}
