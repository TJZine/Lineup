import { buildPlexResourceUrlWithAuth } from '../../../modules/plex/shared/plexUrl';
import { summarizeErrorForLog } from '../../../utils/errors';
import { captureRecoverableRuntimeResult } from './OrchestratorRecoverableRuntimeResult';

export interface PlexResourceUrlRuntimeDeps {
    getServerUri(): string | null;
    getAuthHeaders(): Record<string, string>;
    reportError(event: string, message: string, error: unknown, data?: Record<string, unknown>): void;
}

export function buildPlexResourceUrlSafely(
    deps: PlexResourceUrlRuntimeDeps,
    pathOrUrl: string
): string | null {
    let baseUri: string | null = null;
    let headers: Record<string, string> = {};
    const buildResult = captureRecoverableRuntimeResult(() => {
        baseUri = deps.getServerUri();
        headers = deps.getAuthHeaders();
        return buildPlexResourceUrlWithAuth(baseUri, pathOrUrl, headers);
    });
    if (!buildResult.ok) {
        deps.reportError('orchestrator.plexResourceUrl.build', 'buildPlexResourceUrlWithAuth failed', buildResult.error, {
            pathOrUrl: summarizeErrorForLog(pathOrUrl),
            baseUri: summarizeErrorForLog(baseUri),
        });
        return null;
    }
    return buildResult.value;
}
