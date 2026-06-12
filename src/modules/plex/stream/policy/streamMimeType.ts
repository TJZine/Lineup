import { MIME_TYPES } from './constants';

export function getMimeType(protocol: 'hls' | 'direct' | 'http'): string {
    const result = MIME_TYPES[protocol];
    if (result === undefined) {
        return 'video/mp4';
    }
    return result;
}
