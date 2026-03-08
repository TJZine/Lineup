/**
 * @fileoverview Media selection policy for Plex stream resolution.
 */

import type { PlexMediaFile } from './types';

export type SelectedMedia = {
    media: PlexMediaFile;
    mediaIndex: number;
};

function pickHighestResolution(
    candidates: PlexMediaFile[],
    allMedia: PlexMediaFile[],
    maxBitrate?: number
): SelectedMedia | null {
    if (!candidates || candidates.length === 0) {
        return null;
    }

    let filtered = candidates;
    if (typeof maxBitrate === 'number') {
        filtered = candidates.filter((m) => m.bitrate <= maxBitrate);
        if (filtered.length === 0) {
            filtered = [candidates.reduce((a, b) => (a.bitrate < b.bitrate ? a : b))];
        }
    }

    const sorted = [...filtered].sort((a, b) =>
        (b.width * b.height) - (a.width * a.height)
    );

    const media = sorted[0];
    if (!media) return null;
    const mediaIndex = allMedia.findIndex((entry) => entry === media);
    if (mediaIndex < 0 && __LINEUP_DEV_BUILD__) {
        console.warn(
            '[mediaSelectionPolicy] mediaIndex < 0: selected media not found in allMedia; defaulting mediaIndex to 0',
            { media, allMediaCount: allMedia.length }
        );
    }

    return { media, mediaIndex: mediaIndex >= 0 ? mediaIndex : 0 };
}

export function selectBestMedia(
    mediaList: PlexMediaFile[],
    maxBitrate?: number
): SelectedMedia | null {
    return pickHighestResolution(mediaList, mediaList, maxBitrate);
}

export function selectBestMediaWithSubtitleStream(
    mediaList: PlexMediaFile[],
    subtitleStreamId: string,
    maxBitrate?: number
): SelectedMedia | null {
    if (!mediaList || mediaList.length === 0) return null;

    const candidates = mediaList.filter((media) => {
        const part = media.parts[0];
        if (!part) return false;
        return part.streams.some((stream) => stream.streamType === 3 && stream.id === subtitleStreamId);
    });

    return pickHighestResolution(candidates, mediaList, maxBitrate);
}
