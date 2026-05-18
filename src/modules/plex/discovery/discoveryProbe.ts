import { logPlexWarning } from '../shared/plexLogging';
import { MixedContentConfig, PlexConnection, PlexServer } from './types';

export type PlexConnectionProbeAuthState = 'auth_required' | 'access_denied';
export type PlexConnectionProbeOutcome = 'reachable' | PlexConnectionProbeAuthState | 'unreachable';

export interface PlexConnectionProbeResult {
    connection: PlexConnection;
    outcome: PlexConnectionProbeOutcome;
}

export interface PlexFastestConnectionProbeResult {
    selectedProbe: PlexConnectionProbeResult | null;
    authRequired: boolean;
    authState: PlexConnectionProbeAuthState | null;
}

export async function findFastestConnectionProbe(options: {
    server: PlexServer;
    mixedContentConfig: MixedContentConfig;
    probeConnection: (connection: PlexConnection) => Promise<PlexConnectionProbeResult>;
}): Promise<PlexFastestConnectionProbeResult> {
    const { server, mixedContentConfig, probeConnection } = options;
    const summary: PlexFastestConnectionProbeResult = {
        selectedProbe: null,
        authRequired: false,
        authState: null,
    };
    const probeTiers = buildProbeTiers(server, mixedContentConfig);

    for (const tier of probeTiers) {
        const tierProbes = await Promise.all(tier.connections.map((connection) => probeConnection(connection)));
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
