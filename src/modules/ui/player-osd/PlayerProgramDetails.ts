import type { StreamDescriptor } from '../../player';
import type { PlexMediaItem } from '../../plex/library';
import type { ScheduledProgram } from '../../scheduler/scheduler';

export type PlayerDetailStatus = 'loading' | 'ready' | 'unavailable' | 'error';

export interface PlayerProgramDetailsDeps {
    getCurrentProgram: () => ScheduledProgram | null;
    getCurrentChannelId: () => string | null;
    getScopeIdentity: () => { userId: string | null; serverId: string | null };
    getCurrentStreamDescriptor: () => StreamDescriptor | null;
    fetchProgramDetails: (ratingKey: string, signal: AbortSignal) => Promise<PlexMediaItem | null>;
    isPresentationVisible: () => boolean;
    onChange: () => void;
}

/** One visibility-scoped detail request and one cache for expanded Player and its reader. */
export class PlayerProgramDetails {
    private identity: string | null = null;
    private descriptor: StreamDescriptor | null = null;
    private details: PlexMediaItem | null = null;
    private status: PlayerDetailStatus = 'unavailable';
    private request = 0;
    private abort: AbortController | null = null;

    constructor(private readonly deps: PlayerProgramDetailsDeps) {}

    getIdentity(program: ScheduledProgram | null): string | null {
        if (!program) return null;
        const scope = this.deps.getScopeIdentity();
        const stream = this.deps.getCurrentStreamDescriptor();
        return [
            scope.userId ?? '', scope.serverId ?? '', this.deps.getCurrentChannelId() ?? '',
            program.item.ratingKey, program.scheduledStartTime, program.scheduledEndTime,
            stream?.subtitleContext?.sessionId ?? '', stream?.url ?? '',
        ].join('\u0000');
    }

    snapshot(program: ScheduledProgram | null): { details: PlexMediaItem | null; status: PlayerDetailStatus } {
        return this.isCurrent(program)
            ? { details: this.details, status: this.status }
            : { details: null, status: 'unavailable' };
    }

    isCurrent(program: ScheduledProgram | null): boolean {
        return this.getIdentity(program) === this.identity &&
            this.deps.getCurrentStreamDescriptor() === this.descriptor;
    }

    ensure(program: ScheduledProgram | null, force = false): void {
        if (!this.deps.isPresentationVisible()) return;
        const identity = this.getIdentity(program);
        if (!program || !identity) return;
        const descriptor = this.deps.getCurrentStreamDescriptor();
        if (!force && identity === this.identity && descriptor === this.descriptor &&
            (this.status === 'loading' || this.status === 'ready')) return;
        this.stopRequest();
        this.identity = identity;
        this.descriptor = descriptor;
        this.details = null;
        this.status = 'loading';
        this.deps.onChange();
        const request = this.request;
        const abort = new AbortController();
        this.abort = abort;
        void this.deps.fetchProgramDetails(program.item.ratingKey, abort.signal)
            .then((details) => {
                if (!this.canPublish(request, identity, descriptor)) return;
                this.details = details;
                this.status = details ? 'ready' : 'unavailable';
                this.deps.onChange();
            })
            .catch(() => {
                if (!this.canPublish(request, identity, descriptor)) return;
                this.status = 'error';
                this.deps.onChange();
            });
    }

    hide(): void {
        this.stopRequest();
        if (this.status === 'loading') this.status = 'unavailable';
    }

    clear(): void {
        this.hide();
        this.identity = null;
        this.descriptor = null;
        this.details = null;
        this.status = 'unavailable';
    }

    private stopRequest(): void {
        this.request += 1;
        this.abort?.abort();
        this.abort = null;
    }

    private canPublish(request: number, identity: string, descriptor: StreamDescriptor | null): boolean {
        return request === this.request
            && this.deps.isPresentationVisible()
            && identity === this.getIdentity(this.deps.getCurrentProgram())
            && descriptor === this.deps.getCurrentStreamDescriptor();
    }
}
