import { MIME_TYPES } from './constants';

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
