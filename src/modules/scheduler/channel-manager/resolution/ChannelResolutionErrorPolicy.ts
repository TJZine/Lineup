import { AppErrorCode, getAppErrorCode } from '../../../../types/app-errors';
import type { ChannelContentSource } from '../contracts/types';

const NETWORK_ERROR_CODES = new Set<AppErrorCode>([
    AppErrorCode.NETWORK_TIMEOUT,
    AppErrorCode.NETWORK_OFFLINE,
    AppErrorCode.SERVER_UNREACHABLE,
    AppErrorCode.NETWORK_UNAVAILABLE,
]);

function getErrorCode(error: unknown): AppErrorCode | null {
    if (error && typeof error === 'object' && 'code' in error) {
        return getAppErrorCode((error as { code: unknown }).code);
    }
    return null;
}

export function isNetworkResolutionError(error: unknown): boolean {
    const code = getErrorCode(error);
    if (code && NETWORK_ERROR_CODES.has(code)) return true;
    return error instanceof Error && (
        error.message.toLowerCase().includes('network')
        || error.message.toLowerCase().includes('timeout')
        || error.message.toLowerCase().includes('econnrefused')
        || error.message.toLowerCase().includes('failed to fetch')
    );
}

export function isAccessDeniedResolutionError(error: unknown): boolean {
    return getErrorCode(error) === AppErrorCode.ACCESS_DENIED;
}

export function isGracefulAuthoringResolutionError(error: unknown): boolean {
    if (getErrorCode(error) === AppErrorCode.CONTENT_UNAVAILABLE) return true;
    if (getErrorCode(error) === AppErrorCode.RESOURCE_NOT_FOUND) return true;
    const status = getHttpStatusForLog(error);
    return status === 404 || (error instanceof Error && /\b404\b/.test(error.message));
}

export function getHttpStatusForLog(error: unknown): number | undefined {
    if (!error || typeof error !== 'object') return undefined;
    const maybe = error as { httpStatus?: unknown; status?: unknown };
    if (typeof maybe.httpStatus === 'number') return maybe.httpStatus;
    if (typeof maybe.status === 'number') return maybe.status;
    return undefined;
}

export function getContentSourceLogIdentity(
    source: ChannelContentSource
): { type: ChannelContentSource['type']; id?: string } {
    switch (source.type) {
        case 'library': return { type: source.type, id: source.libraryId };
        case 'collection': return { type: source.type, id: source.collectionKey };
        case 'show': return { type: source.type, id: source.showKey };
        case 'playlist': return { type: source.type, id: source.playlistKey };
        default: return { type: source.type };
    }
}
