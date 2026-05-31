export const BASELINE_WEBOS_AUDIO_CODECS: readonly string[] = [
    'aac',
    'ac3',
    'eac3',
    'flac',
    'vorbis',
    'opus',
    'mp3',
    'pcm',
    'dts',
    'dca',
] as const;

const DTS_FAMILY_AUDIO_CODECS = [
    'dts',
    'dts-hd',
    'dtshd',
    'dca',
    'dca-ma',
] as const;

export function normalizeAudioCodec(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

export function isDtsFamilyAudioCodec(codec: string): boolean {
    const normalizedCodec = normalizeAudioCodec(codec);
    return DTS_FAMILY_AUDIO_CODECS.includes(
        normalizedCodec as (typeof DTS_FAMILY_AUDIO_CODECS)[number]
    );
}

export function isSupportedAudioCodec(
    codec: string,
    supportedCodecs: readonly string[] = BASELINE_WEBOS_AUDIO_CODECS
): boolean {
    const normalizedCodec = normalizeAudioCodec(codec);
    if (supportedCodecs.includes(normalizedCodec)) {
        return true;
    }

    return normalizedCodec === 'eac3-joc' && supportedCodecs.includes('eac3');
}
