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
    createError: (
        code: StreamResolverError['code'],
        message: string,
        recoverable: boolean
    ) => StreamResolverError;
}

export async function updatePlexPartSubtitleSelection(
    args: UpdatePlexPartSubtitleSelectionArgs
): Promise<void> {
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

        const response = await fetchWithTimeout({
            url: url.toString(),
            init: { method: 'PUT', headers: args.getAuthHeaders() },
            timeoutMs: 5000,
        });
        args.throwIfAuthFailure(response);
        if (!response.ok) {
            throw args.createError(
                AppErrorCode.TRANSCODE_FAILED,
                `Failed to update subtitle stream selection: HTTP ${response.status}`,
                true
            );
        }
    } catch (error) {
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
