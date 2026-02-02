/**
 * @fileoverview HDR format detection utilities.
 * @module modules/plex/stream/hdr
 * @version 1.0.0
 */

export interface HdrStreamLike {
    streamType?: number;
    title?: string | null;
    displayTitle?: string | null;
    extendedDisplayTitle?: string | null;
    hdr?: string | null;
    dynamicRange?: string | null;
    colorTrc?: string | null;
    doviPresent?: boolean | null;
    doviProfile?: string | null;
}

export function extractHdrLabelFromPlexMedia(
    item: { media?: Array<{ parts?: Array<{ streams?: HdrStreamLike[] }> }> } | null | undefined
): string | undefined {
    const media = item?.media?.[0];
    const part = media?.parts?.[0];
    const streams = part?.streams ?? [];
    const videoStream = streams.find((stream) => stream?.streamType === 1);
    if (!videoStream) {
        return undefined;
    }
    const raw = videoStream.hdr?.trim();
    return raw || detectHdrLabel(videoStream);
}

export function detectHdrLabel(stream?: HdrStreamLike | null): string | undefined {
    if (!stream) return undefined;
    const normalizedTitle = stream.title?.toLowerCase() ?? '';
    const normalizedDisplay = stream.displayTitle?.toLowerCase() ?? '';
    const normalizedExtended = stream.extendedDisplayTitle?.toLowerCase() ?? '';
    const normalizedHdr = stream.hdr?.toLowerCase() ?? '';
    const normalizedRange = stream.dynamicRange?.toLowerCase() ?? '';
    const normalizedColorTrc = stream.colorTrc?.toLowerCase() ?? '';
    const combined = `${normalizedTitle} ${normalizedDisplay} ${normalizedExtended} ${normalizedHdr} ${normalizedRange}`.trim();

    const doviPresent = stream.doviPresent === true
        || (typeof stream.doviProfile === 'string' && stream.doviProfile.length > 0)
        || combined.includes('dolby vision')
        || combined.includes('dovi');

    if (doviPresent) return 'Dolby Vision';
    if (combined.includes('hdr10+') || normalizedHdr.includes('hdr10+')) return 'HDR10+';
    if (combined.includes('hdr10') || normalizedColorTrc === 'smpte2084') return 'HDR10';
    if (combined.includes('hlg') || normalizedColorTrc === 'arib-std-b67') return 'HLG';
    return undefined;
}
