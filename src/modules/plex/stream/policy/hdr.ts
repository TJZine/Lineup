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
    combined: string;
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

    if (isDolbyVisionStream(stream, hdrFields.combined)) {
        return 'Dolby Vision';
    }

    return detectNonDolbyVisionHdrLabel(hdrFields);
}

function normalizeHdrFields(stream: HdrStreamLike): NormalizedHdrFields {
    const title = normalizeHdrValue(stream.title);
    const displayTitle = normalizeHdrValue(stream.displayTitle);
    const extendedDisplayTitle = normalizeHdrValue(stream.extendedDisplayTitle);
    const hdr = normalizeHdrValue(stream.hdr);
    const dynamicRange = normalizeHdrValue(stream.dynamicRange);

    return {
        title,
        displayTitle,
        extendedDisplayTitle,
        hdr,
        dynamicRange,
        colorTrc: normalizeHdrValue(stream.colorTrc),
        combined: [title, displayTitle, extendedDisplayTitle, hdr, dynamicRange].join(' ').trim(),
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

function detectNonDolbyVisionHdrLabel(hdrFields: NormalizedHdrFields): string | undefined {
    if (matchesHdr10Plus(hdrFields)) {
        return 'HDR10+';
    }

    if (matchesHdr10(hdrFields)) {
        return 'HDR10';
    }

    if (matchesHlg(hdrFields)) {
        return 'HLG';
    }

    return undefined;
}

function normalizeHdrValue(value: string | null | undefined): string {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function matchesHdr10Plus(hdrFields: NormalizedHdrFields): boolean {
    return hdrFields.combined.includes('hdr10+') || hdrFields.hdr.includes('hdr10+');
}

function matchesHdr10(hdrFields: NormalizedHdrFields): boolean {
    return hdrFields.combined.includes('hdr10') || hdrFields.colorTrc === 'smpte2084';
}

function matchesHlg(hdrFields: NormalizedHdrFields): boolean {
    return hdrFields.combined.includes('hlg') || hdrFields.colorTrc === 'arib-std-b67';
}
