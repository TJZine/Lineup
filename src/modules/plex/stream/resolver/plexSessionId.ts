/**
 * Generate a session id for Plex playback/transcode operations.
 * Uses crypto.randomUUID when available with a deterministic fallback.
 */
export function generatePlexSessionId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
        const randomNibble = (Math.random() * 16) | 0;
        const value = character === 'x' ? randomNibble : (randomNibble & 0x3) | 0x8;
        return value.toString(16);
    });
}
