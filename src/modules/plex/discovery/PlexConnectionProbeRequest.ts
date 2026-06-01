import { PLEX_DISCOVERY_CONSTANTS } from './constants';
import type { PlexConnection } from './types';
import type { PlexConnectionProbeResult } from './PlexConnectionProbeTypes';
import { readAbortReason, throwIfCallerAbort } from './PlexDiscoveryAbort';

export interface PlexConnectionProbeRequest {
    connection: PlexConnection;
    headers: Record<string, string>;
    timeoutMs: number;
    signal?: AbortSignal | null;
}

export async function probePlexConnection(
    request: PlexConnectionProbeRequest
): Promise<PlexConnectionProbeResult> {
    const url = new URL(PLEX_DISCOVERY_CONSTANTS.IDENTITY_ENDPOINT, request.connection.uri).toString();
    const startTime = Date.now();
    const callerSignal = request.signal ?? null;
    const controller = new AbortController();
    const abortFromCaller = (): void => {
        if (callerSignal) {
            controller.abort(readAbortReason(callerSignal));
        }
    };
    const timeoutId = setTimeout(() => {
        controller.abort();
    }, request.timeoutMs);

    try {
        if (callerSignal) {
            if (callerSignal.aborted) {
                abortFromCaller();
            } else {
                callerSignal.addEventListener('abort', abortFromCaller, { once: true });
            }
        }
        const response = await fetch(url, {
            method: 'GET',
            headers: request.headers,
            signal: controller.signal,
        });

        if (response.status === 401) {
            return { connection: request.connection, outcome: 'auth_required' };
        }
        if (response.status === 403) {
            return { connection: request.connection, outcome: 'access_denied' };
        }
        if (!response.ok) {
            return { connection: request.connection, outcome: 'unreachable' };
        }

        return {
            connection: {
                ...request.connection,
                latencyMs: Date.now() - startTime,
            },
            outcome: 'reachable',
        };
    } catch (error) {
        throwIfCallerAbort(error, callerSignal);
        return { connection: request.connection, outcome: 'unreachable' };
    } finally {
        callerSignal?.removeEventListener('abort', abortFromCaller);
        clearTimeout(timeoutId);
    }
}
