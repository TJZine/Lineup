export function formatAudioCodec(codec?: string): string | null {
    if (!codec) return null;
    const normalized = codec.trim().toLowerCase();
    switch (normalized) {
        case 'truehd':
            return 'TRUEHD';
        case 'eac3':
            return 'DD+';
        case 'ac3':
            return 'DD';
        case 'dca':
        case 'dts':
            return 'DTS';
        case 'dts-hd':
        case 'dtshd':
            return 'DTS-HD';
        default:
            return normalized.toUpperCase();
    }
}

export interface AudioDetailSource {
    audioChannels?: number;
    audioTrackTitle?: string | null;
}

export function formatAudioDetail(mediaInfo: AudioDetailSource | null | undefined): string | null {
    if (!mediaInfo) return null;

    if (typeof mediaInfo.audioChannels === 'number' && mediaInfo.audioChannels > 0) {
        switch (mediaInfo.audioChannels) {
            case 1:
                return '1.0';
            case 2:
                return '2.0';
            case 6:
                return '5.1';
            case 8:
                return '7.1';
            default:
                return `${mediaInfo.audioChannels}ch`;
        }
    }

    if (mediaInfo.audioTrackTitle) {
        const trimmed = mediaInfo.audioTrackTitle.trim();
        return trimmed.length > 0 ? trimmed.slice(0, 24) : null;
    }

    return null;
}
