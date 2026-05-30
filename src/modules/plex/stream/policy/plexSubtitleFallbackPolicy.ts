import {
    applyXPlexQueryParamsFromHeaders,
    PLEX_TOKEN_HEADER,
    PLEX_TOKEN_QUERY_PARAM,
    readXPlexTokenFromHeaders,
} from '../../shared/plexUrl';
import {
    applyPlexSessionQueryParams,
    buildPlexMetadataPath,
    ensurePlexClientProfileName,
} from '../url/plexStreamUrlPolicy';

export interface PlexSubtitleFallbackContext {
    serverUri: string | null;
    resolvedBaseUrl?: string | undefined;
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

export interface PlexSubtitleFetchRequest {
    variant: 'primary' | 'lan_http';
    url: URL;
    headers: Record<string, string>;
}

export function buildPlexSubtitleFetchAttempts(
    initialUrl: URL,
    authHeaders: Record<string, string>
): PlexSubtitleFetchAttempt[] {
    const tokenFromHeaders = readXPlexTokenFromHeaders(authHeaders);
    const baseAcceptHeader = { Accept: 'text/vtt, text/plain, */*' };
    const attempts: PlexSubtitleFetchAttempt[] = [
        { name: 'query', url: new URL(initialUrl.toString()), headers: baseAcceptHeader },
    ];

    if (!tokenFromHeaders) {
        return attempts;
    }

    const headerUrl = new URL(initialUrl.toString());
    headerUrl.searchParams.delete(PLEX_TOKEN_QUERY_PARAM);
    attempts.push({
        name: 'header',
        url: headerUrl,
        headers: { ...baseAcceptHeader, [PLEX_TOKEN_HEADER]: tokenFromHeaders },
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
        headers: { ...baseAcceptHeader, [PLEX_TOKEN_HEADER]: tokenFromHeaders },
    });

    return attempts;
}

export function expandPlexSubtitleFetchAttemptVariants(
    attempt: Pick<PlexSubtitleFetchAttempt, 'url' | 'headers'>,
    deriveLanHttpUrl: (original: URL) => URL | null
): PlexSubtitleFetchRequest[] {
    const requests: PlexSubtitleFetchRequest[] = [
        {
            variant: 'primary',
            url: attempt.url,
            headers: attempt.headers,
        },
    ];

    const lanHttpUrl = deriveLanHttpUrl(attempt.url);
    if (!lanHttpUrl || lanHttpUrl.toString() === attempt.url.toString()) {
        return requests;
    }

    if (!canRetryLanHttpSubtitleUrl(attempt.url, lanHttpUrl, attempt.headers)) {
        return requests;
    }

    requests.push({
        variant: 'lan_http',
        url: lanHttpUrl,
        headers: attempt.headers,
    });
    return requests;
}

export function buildPlexSubtitleTranscodeUrl(
    trackId: string,
    context: PlexSubtitleFallbackContext,
    format: 'srt' | 'vtt'
): URL | null {
    try {
        const baseUri = context.resolvedBaseUrl ?? context.serverUri ?? null;
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
        applyXPlexQueryParamsFromHeaders(url.searchParams, context.authHeaders);
        ensurePlexClientProfileName(url.searchParams);

        return url;
    } catch {
        return null;
    }
}

function hasPlexTokenMaterial(url: URL, headers: Record<string, string>): boolean {
    if (url.searchParams.has(PLEX_TOKEN_QUERY_PARAM)) {
        return true;
    }
    return typeof headers[PLEX_TOKEN_HEADER] === 'string' && headers[PLEX_TOKEN_HEADER].length > 0;
}

function canRetryLanHttpSubtitleUrl(
    original: URL,
    candidate: URL,
    headers: Record<string, string>
): boolean {
    if (original.protocol !== 'https:' || candidate.protocol !== 'http:') {
        return true;
    }
    return !hasPlexTokenMaterial(candidate, headers);
}
