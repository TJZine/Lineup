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

export function normalizeAudioCodec(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

export function isDtsFamilyAudioCodec(codec: string): boolean {
    const normalizedCodec = normalizeAudioCodec(codec);
    return normalizedCodec === 'dts'
        || normalizedCodec === 'dca'
        || normalizedCodec.startsWith('dts');
}

export function isSupportedAudioCodec(
    codec: string,
    supportedCodecs: readonly string[] = BASELINE_WEBOS_AUDIO_CODECS
): boolean {
    const normalizedCodec = normalizeAudioCodec(codec);
    return supportedCodecs.some(
        (supportedCodec) =>
            normalizedCodec === supportedCodec || normalizedCodec.startsWith(supportedCodec)
    );
}
