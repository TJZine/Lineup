/**
 * @fileoverview HDR format detection utilities.
 * @module modules/plex/stream/hdr
 * @version 1.0.0
 */

interface HdrStreamLike {
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

type NormalizedHdrFields = {
    title: string;
    displayTitle: string;
    extendedDisplayTitle: string;
    hdr: string;
    dynamicRange: string;
    colorTrc: string;
};

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
    if (!stream) {
        return undefined;
    }

    const hdrFields = normalizeHdrFields(stream);
    const combined = [
        hdrFields.title,
        hdrFields.displayTitle,
        hdrFields.extendedDisplayTitle,
        hdrFields.hdr,
        hdrFields.dynamicRange,
    ]
        .join(' ')
        .trim();

    if (isDolbyVisionStream(stream, combined)) {
        return 'Dolby Vision';
    }

    if (combined.includes('hdr10+') || hdrFields.hdr.includes('hdr10+')) {
        return 'HDR10+';
    }

    if (combined.includes('hdr10') || hdrFields.colorTrc === 'smpte2084') {
        return 'HDR10';
    }

    if (combined.includes('hlg') || hdrFields.colorTrc === 'arib-std-b67') {
        return 'HLG';
    }

    return undefined;
}

function normalizeHdrFields(stream: HdrStreamLike): NormalizedHdrFields {
    return {
        title: stream.title?.toLowerCase() ?? '',
        displayTitle: stream.displayTitle?.toLowerCase() ?? '',
        extendedDisplayTitle: stream.extendedDisplayTitle?.toLowerCase() ?? '',
        hdr: stream.hdr?.toLowerCase() ?? '',
        dynamicRange: stream.dynamicRange?.toLowerCase() ?? '',
        colorTrc: stream.colorTrc?.toLowerCase() ?? '',
    };
}

function isDolbyVisionStream(stream: HdrStreamLike, combined: string): boolean {
    return (
        stream.doviPresent === true ||
        (typeof stream.doviProfile === 'string' && stream.doviProfile.length > 0) ||
        combined.includes('dolby vision') ||
        combined.includes('dovi')
    );
}
