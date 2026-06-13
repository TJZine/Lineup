import { logPlexWarning } from '../shared/plexLogging';
import { PLEX_DISCOVERY_CONSTANTS } from './constants';
import { MixedContentConfig, PlexConnection, PlexServer } from './types';
import { readAbortReason, throwIfAborted } from './PlexDiscoveryAbort';
import type {
    PlexConnectionProbeOutcome,
    PlexConnectionProbeResult,
    PlexFastestConnectionProbeResult,
} from './PlexConnectionProbeTypes';

export async function findFastestConnectionProbe(options: {
    server: PlexServer;
    mixedContentConfig: MixedContentConfig;
    probeConnection: (connection: PlexConnection) => Promise<PlexConnectionProbeResult>;
    signal?: AbortSignal | null;
}): Promise<PlexFastestConnectionProbeResult> {
    const { server, mixedContentConfig, probeConnection, signal = null } = options;
    const summary: PlexFastestConnectionProbeResult = {
        selectedProbe: null,
        authRequired: false,
        authState: null,
    };
    const probeTiers = buildProbeTiers(server, mixedContentConfig);

    for (const tier of probeTiers) {
        throwIfAborted(signal);
        const tierProbes = await runLimitedConnectionProbes(
            tier.connections,
            probeConnection,
            PLEX_DISCOVERY_CONSTANTS.MAX_CONCURRENT_TESTS,
            signal
        );
        const selectedProbe = pickFastestReachableProbe(tierProbes);

        tierProbes.forEach((probe) => noteAuthOutcome(summary, probe.outcome));

        if (selectedProbe) {
            if (tier.warnOnSelection && mixedContentConfig.logWarnings) {
                logPlexWarning('Selected HTTP connection (last resort)', {
                    local: selectedProbe.connection.local,
                    relay: selectedProbe.connection.relay,
                });
            }

            return {
                ...summary,
                selectedProbe,
            };
        }
    }

    if (mixedContentConfig.logWarnings) {
        const httpsCount = server.connections.filter((connection) => connection.protocol === 'https').length;
        const httpCount = server.connections.filter((connection) => connection.protocol === 'http').length;
        logPlexWarning('No working connections found', {
            serverId: server.id,
            authRequired: summary.authRequired,
            httpsCount,
            httpCount,
        });
    }

    return summary;
}

function runLimitedConnectionProbes(
    connections: PlexConnection[],
    probeConnection: (connection: PlexConnection) => Promise<PlexConnectionProbeResult>,
    maxConcurrent: number,
    signal: AbortSignal | null
): Promise<PlexConnectionProbeResult[]> {
    throwIfAborted(signal);
    if (connections.length === 0) {
        return Promise.resolve([]);
    }

    const limit = Math.max(1, Math.floor(maxConcurrent));
    const results = new Array<PlexConnectionProbeResult>(connections.length);
    let nextIndex = 0;
    let activeCount = 0;
    let settled = false;

    return new Promise((resolve, reject) => {
        const cleanupAbort = (): void => {
            signal?.removeEventListener('abort', onAbort);
        };
        const settleReject = (error: unknown): void => {
            if (settled) return;
            settled = true;
            cleanupAbort();
            reject(error);
        };
        const settleResolve = (): void => {
            if (settled || activeCount !== 0 || nextIndex < connections.length) return;
            settled = true;
            cleanupAbort();
            resolve(results);
        };
        const launchNext = (): void => {
            if (settled) return;
            try {
                throwIfAborted(signal);
            } catch (error) {
                settleReject(error);
                return;
            }
            while (activeCount < limit && nextIndex < connections.length) {
                const index = nextIndex;
                const connection = connections[index];
                nextIndex += 1;
                activeCount += 1;

                let probeResult: Promise<PlexConnectionProbeResult> | PlexConnectionProbeResult;
                try {
                    probeResult = probeConnection(connection!);
                } catch (error: unknown) {
                    activeCount -= 1;
                    settleReject(error);
                    return;
                }

                Promise.resolve(probeResult)
                    .then((result) => {
                        results[index] = result;
                    })
                    .then(() => {
                        activeCount -= 1;
                        launchNext();
                        settleResolve();
                    })
                    .catch((error: unknown) => {
                        activeCount -= 1;
                        settleReject(error);
                    });
            }
            settleResolve();
        };
        const onAbort = (): void => {
            settleReject(signal ? readAbortReason(signal) : undefined);
        };
        signal?.addEventListener('abort', onAbort, { once: true });
        launchNext();
    });
}

function pickFastestReachableProbe(
    probes: PlexConnectionProbeResult[]
): PlexConnectionProbeResult | null {
    let fastestProbe: PlexConnectionProbeResult | null = null;
    let fastestLatency = Number.POSITIVE_INFINITY;

    for (const probe of probes) {
        if (probe.outcome !== 'reachable') {
            continue;
        }

        const latency = normalizeLatency(probe.connection.latencyMs);
        if (fastestProbe === null || latency < fastestLatency) {
            fastestProbe = probe;
            fastestLatency = latency;
        }
    }

    return fastestProbe;
}

function normalizeLatency(latencyMs: number | null): number {
    return typeof latencyMs === 'number' && Number.isFinite(latencyMs)
        ? latencyMs
        : Number.POSITIVE_INFINITY;
}

interface ProbeTier {
    connections: PlexConnection[];
    warnOnSelection: boolean;
}

function buildProbeTiers(
    server: PlexServer,
    mixedContentConfig: MixedContentConfig
): ProbeTier[] {
    const tiers: ProbeTier[] = [];
    const httpsConnections = server.connections.filter((connection) => connection.protocol === 'https');
    const localDirectHttpsConnections = httpsConnections.filter((connection) => connection.local && !connection.relay);
    const remoteDirectHttpsConnections = httpsConnections.filter((connection) => !connection.local && !connection.relay);
    const relayHttpsConnections = httpsConnections.filter((connection) => connection.relay);
    const localDirectHttpConnections = server.connections
        .filter((connection) => connection.protocol === 'http')
        .filter((connection) => connection.local && !connection.relay);

    if (!mixedContentConfig.preferHttps && mixedContentConfig.allowLocalHttp) {
        tiers.push({
            connections: localDirectHttpConnections,
            warnOnSelection: true,
        });
    }

    tiers.push({ connections: localDirectHttpsConnections, warnOnSelection: false });

    if (mixedContentConfig.preferHttps) {
        tiers.push(
            { connections: remoteDirectHttpsConnections, warnOnSelection: false },
            { connections: relayHttpsConnections, warnOnSelection: false }
        );
    }

    if (mixedContentConfig.tryHttpsUpgrade) {
        tiers.push({
            connections: localDirectHttpConnections.map(upgradeConnectionToHttps),
            warnOnSelection: false,
        });
    }

    if (!mixedContentConfig.preferHttps) {
        tiers.push(
            { connections: remoteDirectHttpsConnections, warnOnSelection: false },
            { connections: relayHttpsConnections, warnOnSelection: false }
        );
    }

    if (mixedContentConfig.allowLocalHttp && mixedContentConfig.preferHttps) {
        tiers.push({
            connections: localDirectHttpConnections,
            warnOnSelection: true,
        });
    }

    return tiers;
}

function upgradeConnectionToHttps(connection: PlexConnection): PlexConnection {
    return {
        uri: connection.uri.replace('http://', 'https://'),
        protocol: 'https',
        address: connection.address,
        port: connection.port,
        local: connection.local,
        relay: connection.relay,
        latencyMs: null,
    };
}

function noteAuthOutcome(
    summary: PlexFastestConnectionProbeResult,
    outcome: PlexConnectionProbeOutcome
): void {
    if (outcome === 'access_denied') {
        summary.authState = 'access_denied';
        return;
    }

    if (outcome === 'auth_required') {
        summary.authRequired = true;
        if (summary.authState === null) {
            summary.authState = 'auth_required';
        }
    }
}
