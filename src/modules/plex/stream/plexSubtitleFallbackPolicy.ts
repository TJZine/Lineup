import {
    applyXPlexQueryParamsFromHeaders,
    applyXPlexTokenQueryParam,
} from '../shared/plexUrl';
import {
    applyPlexSessionQueryParams,
    buildPlexMetadataPath,
    ensurePlexClientProfileName,
} from './plexStreamUrlPolicy';

export interface PlexSubtitleFallbackContext {
    serverUri: string | null;
    authHeaders: Record<string, string>;
    itemKey?: string | undefined;
    mediaIndex?: number | undefined;
    partIndex?: number | undefined;
    sessionId?: string | undefined;
}

export interface PlexSubtitleFetchAttempt {
    name: 'query' | 'header' | 'query_download' | 'header_download';
    url: URL;
    headers: Record<string, string>;
}

function getAuthTokenFromHeaders(headers: Record<string, string>): string | null {
    const token = headers['X-Plex-Token'];
    return typeof token === 'string' && token.length > 0 ? token : null;
}

export function buildPlexSubtitleFetchAttempts(
    initialUrl: URL,
    authHeaders: Record<string, string>
): PlexSubtitleFetchAttempt[] {
    const tokenFromHeaders = getAuthTokenFromHeaders(authHeaders);
    const baseAcceptHeader = { Accept: 'text/vtt, text/plain, */*' };
    const attempts: PlexSubtitleFetchAttempt[] = [
        { name: 'query', url: initialUrl, headers: baseAcceptHeader },
    ];

    if (!tokenFromHeaders) {
        return attempts;
    }

    const headerUrl = new URL(initialUrl.toString());
    headerUrl.searchParams.delete('X-Plex-Token');
    attempts.push({
        name: 'header',
        url: headerUrl,
        headers: { ...baseAcceptHeader, 'X-Plex-Token': tokenFromHeaders },
    });

    const queryDownloadUrl = new URL(initialUrl.toString());
    if (!queryDownloadUrl.searchParams.has('download')) {
        queryDownloadUrl.searchParams.set('download', '1');
    }
    attempts.push({ name: 'query_download', url: queryDownloadUrl, headers: baseAcceptHeader });

    const headerDownloadUrl = new URL(headerUrl.toString());
    if (!headerDownloadUrl.searchParams.has('download')) {
        headerDownloadUrl.searchParams.set('download', '1');
    }
    attempts.push({
        name: 'header_download',
        url: headerDownloadUrl,
        headers: { ...baseAcceptHeader, 'X-Plex-Token': tokenFromHeaders },
    });

    return attempts;
}

export function buildPlexSubtitleTranscodeUrl(
    trackId: string,
    context: PlexSubtitleFallbackContext,
    format: 'srt' | 'vtt'
): URL | null {
    try {
        const baseUri = context.serverUri ?? null;
        const metadataPath = buildPlexMetadataPath(context.itemKey);
        if (!baseUri || !metadataPath) {
            return null;
        }

        const url = new URL('/video/:/transcode/universal/subtitles', baseUri);
        url.searchParams.set('path', metadataPath);
        url.searchParams.set('mediaIndex', String(context.mediaIndex ?? 0));
        url.searchParams.set('partIndex', String(context.partIndex ?? 0));
        url.searchParams.set('subtitleStreamID', trackId);
        url.searchParams.set('format', format);
        url.searchParams.set('download', '1');

        applyPlexSessionQueryParams(url.searchParams, context.sessionId);
        applyXPlexTokenQueryParam(url.searchParams, getAuthTokenFromHeaders(context.authHeaders));
        applyXPlexQueryParamsFromHeaders(url.searchParams, context.authHeaders);
        ensurePlexClientProfileName(url.searchParams);

        return url;
    } catch {
        return null;
    }
}
