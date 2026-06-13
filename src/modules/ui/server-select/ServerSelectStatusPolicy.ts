import { PlexApiError } from '../../plex/auth';
import type { PlexServer } from '../../plex/discovery/types';
import type { ScreenTone } from '../types/screen-shell';
import type { ServerSelectDisplayState, ServerSelectSelectionFailureReason } from './types';

export interface ServerSelectStatusPresenter {
    setStatus(status: string, detail: string, tone?: ScreenTone): void;
    setError(message: string): void;
}

export class ServerSelectStatusPolicy {
    setServerListStatus(
        presenter: ServerSelectStatusPresenter,
        servers: PlexServer[],
        options?: {
            isSelecting?: boolean;
            savedServerUnavailable?: boolean;
            autoSelectError?: unknown | null;
        }
    ): void {
        if (options?.isSelecting === true) {
            presenter.setStatus(
                'Selection in progress.',
                'Wait for the current server connection attempt to finish.',
                'loading'
            );
            return;
        }

        if (servers.length === 0) {
            presenter.setStatus('No servers found.', 'Ensure your Plex server is reachable.', 'warning');
            return;
        }

        if (options?.savedServerUnavailable === true) {
            this.handleError(presenter, options.autoSelectError, 'Unable to use the saved server.');
            presenter.setStatus('Saved server unavailable.', 'Select a server from the list.', 'warning');
            return;
        }

        presenter.setStatus('Select a server from the list.', '', 'neutral');
    }

    selectionFailureMessage(reason: ServerSelectSelectionFailureReason): string {
        switch (reason) {
            case 'server_not_found':
                return 'Selected server is no longer available.';
            case 'auth_required':
                return 'Authentication required. Sign in to Plex and try again.';
            case 'access_denied':
                return 'This Plex profile does not have access to that server. Choose another profile or update Plex sharing.';
            case 'unreachable':
                return 'Selected server is unreachable right now.';
        }
    }

    handleError(presenter: ServerSelectStatusPresenter, error: unknown, fallback: string): void {
        if (error instanceof PlexApiError) {
            presenter.setError(`${error.code}: ${error.message}`);
            return;
        }
        const message = error instanceof Error ? error.message : fallback;
        presenter.setError(message);
    }

    buildServerMeta(
        server: PlexServer,
        healthMap: ServerSelectDisplayState['serverHealth']
    ): string {
        const ownership = server.owned ? 'Owned' : `Shared by ${server.sourceTitle}`;
        const health = healthMap[server.id];
        const connectionQuality = this.formatConnectionQuality(health);

        let lastInfo: string;
        if (typeof health?.testedAt !== 'number') {
            lastInfo = 'Last: —';
        } else if (health?.status === 'ok') {
            lastInfo = `Last connected: ${this.formatRelativeTime(health.testedAt)}`;
        } else {
            lastInfo = `Last checked: ${this.formatRelativeTime(health.testedAt)}`;
        }

        return `${ownership} • ${connectionQuality} • ${lastInfo}`;
    }

    formatConnectionQuality(
        health: ServerSelectDisplayState['serverHealth'][string]
    ): string {
        if (health?.status !== 'ok') {
            return 'Connection not verified';
        }
        if (health.type === 'relay') {
            return 'Connected via Plex Relay - limited quality';
        }
        if (health.type === 'local' && health.protocol === 'http') {
            return 'Connected over local HTTP - secure connection unavailable';
        }
        if (health.type === 'local') {
            return 'Connected directly (local)';
        }
        if (health.type === 'remote') {
            return 'Connected remotely';
        }
        return 'Connection type unknown';
    }

    private formatRelativeTime(timestamp: number): string {
        const deltaMs = Math.max(0, Date.now() - timestamp);
        const seconds = Math.floor(deltaMs / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return minutes === 1 ? '1 min ago' : `${minutes} mins ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
        const days = Math.floor(hours / 24);
        return days === 1 ? '1 day ago' : `${days} days ago`;
    }
}
