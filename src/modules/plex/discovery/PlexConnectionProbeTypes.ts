import type { PlexConnection } from './types';

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
