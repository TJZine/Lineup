const MIME_TYPES: Record<string, string> = {
    hls: 'application/x-mpegURL',
    dash: 'application/dash+xml',
    direct: 'video/mp4',
    http: 'video/mp4',
};

/**
 * Get MIME type for a stream protocol.
 */
export function getMimeType(protocol: 'hls' | 'dash' | 'direct' | 'http'): string {
    const result = MIME_TYPES[protocol];
    if (result === undefined) {
        return 'video/mp4';
    }
    return result;
}
