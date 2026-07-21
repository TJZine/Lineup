import { AppErrorCode } from '../../../../types/app-errors';
import { fetchWithTimeout } from '../../shared/fetchWithTimeout';
import type { StreamResolverError } from '../contracts/interfaces';

interface UpdatePlexPartSubtitleSelectionArgs {
    partId: string;
    subtitleStreamId: string | null;
    getServerUri: () => string | null;
    getAuthHeaders: () => Record<string, string>;
    selectBaseUriForMixedContent: (serverUri: string) => string;
    throwIfAuthFailure: (response: Response) => void;
    getAccessToken: () => string;
    captureRequestScope: () => object | null;
    assertRequestScopeCurrent: (scope: object) => void;
    recoverAfterUnauthorized: (
        expectedAccessToken: string,
        allowResourceRefresh: boolean,
        requestScope: object
    ) => Promise<void>;
    createError: (
        code: StreamResolverError['code'],
        message: string,
        recoverable: boolean
    ) => StreamResolverError;
}

export async function updatePlexPartSubtitleSelection(
    args: UpdatePlexPartSubtitleSelectionArgs
): Promise<void> {
    const requestScope = args.captureRequestScope();
    if (!requestScope) {
        throw args.createError(AppErrorCode.SERVER_UNREACHABLE, 'No selected Plex server scope', true);
    }
    args.assertRequestScopeCurrent(requestScope);
    const serverUri = args.getServerUri();
    if (!serverUri) {
        throw args.createError(
            AppErrorCode.SERVER_UNREACHABLE,
            'No server connection available',
            true
        );
    }

    try {
        const url = new URL(
            `/library/parts/${encodeURIComponent(args.partId)}`,
            args.selectBaseUriForMixedContent(serverUri)
        );
        url.searchParams.set('subtitleStreamID', args.subtitleStreamId ?? '0');

        for (let attempt = 0; attempt < 2; attempt += 1) {
            args.assertRequestScopeCurrent(requestScope);
            const expectedAccessToken = args.getAccessToken();
            const response = await fetchWithTimeout({
                url: url.toString(),
                init: { method: 'PUT', headers: args.getAuthHeaders() },
                timeoutMs: 5000,
            });
            args.assertRequestScopeCurrent(requestScope);
            if (response.status === 401) {
                await args.recoverAfterUnauthorized(
                    expectedAccessToken,
                    attempt === 0,
                    requestScope
                );
                args.assertRequestScopeCurrent(requestScope);
                continue;
            }
            args.throwIfAuthFailure(response);
            if (!response.ok) {
                throw args.createError(
                    AppErrorCode.TRANSCODE_FAILED,
                    `Failed to update subtitle stream selection: HTTP ${response.status}`,
                    true
                );
            }
            return;
        }
    } catch (error) {
        args.assertRequestScopeCurrent(requestScope);
        if (isStreamResolverError(error)) {
            throw error;
        }
        throw args.createError(
            AppErrorCode.SERVER_UNREACHABLE,
            'Failed to update subtitle stream selection',
            true
        );
    }
}

function isStreamResolverError(error: unknown): error is StreamResolverError {
    return Boolean(
        error &&
        typeof error === 'object' &&
        'code' in error &&
        'message' in error &&
        'recoverable' in error
    );
}
