/**
 * @fileoverview Media selection policy for Plex stream resolution.
 */

import type { PlexMediaFile } from './types';

export type SelectedMedia = {
    media: PlexMediaFile;
    mediaIndex: number;
    partIndex: number;
};

function findSubtitlePartIndex(media: PlexMediaFile, subtitleStreamId: string): number {
    if (!media?.parts || media.parts.length === 0) {
        return -1;
    }

    return media.parts.findIndex((part) => {
        if (!part?.streams || part.streams.length === 0) {
            return false;
        }
        return part.streams.some((stream) => stream.streamType === 3 && stream.id === subtitleStreamId);
    });
}

function pickHighestResolution(
    candidates: PlexMediaFile[],
    allMedia: PlexMediaFile[],
    maxBitrate?: number
): Omit<SelectedMedia, 'partIndex'> | null {
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
    const selected = pickHighestResolution(mediaList, mediaList, maxBitrate);
    if (!selected) return null;
    return { ...selected, partIndex: 0 };
}

export function selectBestMediaWithSubtitleStream(
    mediaList: PlexMediaFile[],
    subtitleStreamId: string,
    maxBitrate?: number
): SelectedMedia | null {
    if (!mediaList || mediaList.length === 0) return null;

    const candidates = mediaList.filter((media) => {
        return findSubtitlePartIndex(media, subtitleStreamId) >= 0;
    });

    const selected = pickHighestResolution(candidates, mediaList, maxBitrate);
    if (!selected) return null;

    const partIndex = findSubtitlePartIndex(selected.media, subtitleStreamId);
    if (partIndex < 0) {
        return null;
    }

    return { ...selected, partIndex };
}
