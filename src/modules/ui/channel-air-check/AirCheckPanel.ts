import type { StudioAirCheckPort, StudioAirCheckRequest, StudioVerificationStatus } from '../../../core/channel-studio/ChannelStudioContracts';
import type { ScheduledProgram } from '../../scheduler/scheduler/types';
import type { ChannelContentSource } from '../../scheduler/channel-manager/contracts/types';
import { redactSensitiveTokens } from '../../../utils/redact';
import './styles.css';

const SIX_HOURS_MS = 6 * 60 * 60_000;
const MAX_HORIZON_MS = 24 * 60 * 60_000;

export interface AirCheckPanelActions {
    getImageUrl(path: string, width: number, height: number): string | null;
}

export interface AirCheckRenderOptions {
    onVerify(): void;
    onCancel(): void;
    onExtendHorizon(nextHorizonMs: number): void;
    onControlsChanged(preferredId?: string): void;
    extensionStatus: StudioVerificationStatus | null;
}

const programId = (program: ScheduledProgram): string =>
    `${program.scheduledStartTime}:${program.scheduledEndTime}:${program.scheduleIndex}:${program.item.ratingKey}`;
const programElementId = (program: ScheduledProgram): string => `air-check-program-${encodeURIComponent(programId(program))}`;

const time = (value: number): string => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const date = (value: number, asOf: number): string => {
    const day = new Date(value);
    const today = new Date(asOf);
    if (day.toDateString() === today.toDateString()) return 'Today';
    const tomorrow = new Date(asOf); tomorrow.setDate(tomorrow.getDate() + 1);
    if (day.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return day.toLocaleDateString([], { month: 'numeric', day: 'numeric' });
};
const duration = (value: number): string => {
    const minutes = Math.round(value / 60_000);
    return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`;
};
const rhythm = (mode: string, blockSize?: number): string =>
    mode === 'block' ? `Block ${blockSize ?? 1}` : mode === 'random' ? 'Random' : mode === 'shuffle' ? 'Shuffle' : 'In order';
const sourceLabel = (source: ChannelContentSource): string => {
    switch (source.type) {
        case 'library': return 'Library';
        case 'collection': return source.collectionName || 'Collection';
        case 'show': return source.showName || 'Show';
        case 'playlist': return source.playlistName || 'Plex playlist';
        case 'manual': return 'Hand-picked';
        case 'mixed': return `Mixed · ${source.sources.map(sourceLabel).join(' / ')}`;
    }
};

function element<K extends keyof HTMLElementTagNameMap>(name: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(name);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function action(label: string, onClick: () => void, className = ''): HTMLButtonElement {
    const button = element('button', `air-check-action ${className}`, label);
    button.type = 'button'; button.addEventListener('click', onClick);
    return button;
}

function verifiedStatus(status: StudioVerificationStatus): status is Extract<StudioVerificationStatus, { kind: 'verified' }> {
    return status.kind === 'verified' && 'programs' in status && Array.isArray(status.programs)
        && 'coverageEnd' in status && typeof status.coverageEnd === 'number';
}

/** The Studio host owns panel visibility and focus restoration; this view owns its local selection. */
export class AirCheckPanel implements StudioAirCheckPort {
    private readonly actions: AirCheckPanelActions;
    private readonly port: Pick<StudioAirCheckPort, 'verify'>;
    private selectedId: string | null = null;
    private selectionFollowsNow = true;
    private synopsisExpanded = false;
    private requestIdentity = '';
    private container: HTMLElement | null = null;
    private status: StudioVerificationStatus = { kind: 'idle' };
    private request: StudioAirCheckRequest | null = null;
    private renderOptions!: AirCheckRenderOptions;
    private extensionPending = false;

    constructor(port: Pick<StudioAirCheckPort, 'verify'>, actions: AirCheckPanelActions) {
        this.port = port;
        this.actions = actions;
    }

    verify(request: StudioAirCheckRequest, signal: AbortSignal): Promise<StudioVerificationStatus> {
        return this.port.verify(request, signal);
    }

    render(container: HTMLElement, status: StudioVerificationStatus, request: StudioAirCheckRequest | null,
        options: AirCheckRenderOptions, internal = false): void {
        if (!internal) this.extensionPending = options.extensionStatus?.kind === 'loading';
        this.container = container; this.status = status; this.request = request; this.renderOptions = options;
        const identity = request ? `${request.draftRevision}:${request.sourceIdentity}:${request.expectedBase.generation}:${request.expectedBase.revision}` : '';
        if (identity !== this.requestIdentity) {
            this.requestIdentity = identity; this.selectedId = null; this.selectionFollowsNow = true; this.synopsisExpanded = false;
        }
        const focusedId = container.contains(document.activeElement) ? (document.activeElement as HTMLElement).id : '';
        container.textContent = '';
        container.classList.add('air-check');
        container.setAttribute('aria-label', 'Air Check');
        const header = element('div', 'air-check-header');
        header.append(element('h2', '', 'Air Check'), element('span', 'air-check-muted', 'Draft schedule'));
        container.append(header);
        if (!verifiedStatus(status)) {
            this.renderState(container, status);
        } else if (!request || status.request !== request) {
            this.renderState(container, { kind: 'stale', reason: 'Run Air Check for the current draft.', checkedAt: Date.now() });
        } else {
            this.renderVerified(container, status);
        }
        if (focusedId) this.findControl(focusedId)?.focus();
    }

    private renderState(container: HTMLElement, status: StudioVerificationStatus): void {
        const messages: Record<StudioVerificationStatus['kind'], string> = {
            idle: 'Run Air Check to verify this draft schedule.',
            loading: 'Checking source and schedule…',
            canceled: 'Air Check canceled. Your draft is kept.',
            partial: 'Some source evidence is incomplete.',
            stale: 'The draft or lineup changed.',
            offair: 'This source is off air. It remains available to edit.',
            error: 'Air Check could not verify the draft.',
            verified: 'Verified for this draft.',
        };
        const banner = element('p', `air-check-state air-check-state-${status.kind}`, messages[status.kind]);
        banner.setAttribute('role', 'status'); container.append(banner);
        if ('reason' in status) container.append(element('p', 'air-check-muted', redactSensitiveTokens(status.reason)));
        if (status.kind === 'loading') {
            const cancel = action('Cancel Air Check', () => this.renderOptions.onCancel()); cancel.id = 'air-check-cancel'; cancel.dataset.action = 'air-check-cancel'; container.append(cancel);
        } else {
            const retry = action(status.kind === 'idle' ? 'Run Air Check' : 'Retry Air Check', () => this.renderOptions.onVerify());
            retry.id = status.kind === 'idle' ? 'air-check-run' : 'air-check-retry';
            retry.dataset.action = status.kind === 'idle' ? 'air-check-run' : 'air-check-retry'; container.append(retry);
        }
    }

    private renderVerified(container: HTMLElement, status: Extract<StudioVerificationStatus, { kind: 'verified' }>): void {
        const { request, programs, items } = status;
        const current = programs.find(program => program.scheduledStartTime <= request.asOf && request.asOf < program.scheduledEndTime) ?? programs[0];
        if (!current) {
            this.renderState(container, { kind: 'offair', reason: 'No schedule could be projected.', checkedAt: status.checkedAt });
            return;
        }
        const currentId = programId(current);
        const selected = this.selectionFollowsNow ? current : programs.find(program => programId(program) === this.selectedId) ?? current;
        this.selectedId = programId(selected);
        container.append(element('p', 'air-check-facts',
            `Ch ${request.candidate.number} · ${items.length} playable · ${duration(status.loopDurationMs ?? items.reduce((sum, item) => sum + item.durationMs, 0))} cycle · ${rhythm(request.candidate.playbackMode, request.candidate.blockSize)}`));
        const extension = this.renderOptions.extensionStatus;
        const statusText = extension?.kind === 'loading' ? 'Extending schedule coverage…'
            : extension && extension.kind !== 'verified' ? 'Coverage extension did not complete. The prior verified schedule remains available.'
                : 'Verified for this draft';
        const statusClass = extension && extension.kind !== 'loading' && extension.kind !== 'verified'
            ? 'air-check-verified air-check-extension-error' : 'air-check-verified';
        const verified = element('p', statusClass, statusText); verified.setAttribute('role', 'status'); container.append(verified);
        const selection = element('section', 'air-check-selection');
        const imagePath = selected.item.showThumb || selected.item.thumb || selected.item.art;
        if (imagePath) {
            const src = this.actions.getImageUrl(imagePath, 144, 108);
            if (src) {
                const image = element('img', 'air-check-art'); image.width = 144; image.height = 108;
                image.alt = ''; image.src = src; image.addEventListener('error', () => image.remove());
                selection.append(image);
            }
        }
        const details = element('div', 'air-check-details');
        const temporal = selected.scheduledStartTime <= request.asOf && request.asOf < selected.scheduledEndTime ? 'CURRENT' : 'UPCOMING';
        details.append(element('p', 'air-check-eyebrow', `${temporal} · ${date(selected.scheduledStartTime, request.asOf)} · ${time(selected.scheduledStartTime)}–${time(selected.scheduledEndTime)}`));
        details.append(element('h3', '', selected.item.title));
        const episode = [selected.item.seasonNumber !== undefined && selected.item.episodeNumber !== undefined
            ? `S${selected.item.seasonNumber} E${selected.item.episodeNumber}` : '', selected.item.showTitle].filter(Boolean).join(' · ');
        if (episode) details.append(element('p', 'air-check-muted', episode));
        details.append(element('p', 'air-check-muted', `${duration(selected.item.durationMs)} · ${sourceLabel(request.source)}`));
        const summary = selected.item.summary?.trim();
        if (summary) {
            const synopsis = element('p', this.synopsisExpanded ? 'air-check-synopsis' : 'air-check-synopsis air-check-clamped', summary);
            details.append(synopsis);
            const more = action(this.synopsisExpanded ? 'Show less' : 'Read more', () => {
                this.synopsisExpanded = !this.synopsisExpanded; this.renderCurrent('air-check-synopsis');
            }); more.id = 'air-check-synopsis'; more.dataset.action = 'air-check-synopsis'; details.append(more);
        }
        if (this.selectedId !== currentId) {
            const back = action('Back to now', () => {
                this.selectionFollowsNow = true; this.selectedId = currentId; this.synopsisExpanded = false;
                this.renderCurrent(programElementId(current));
            }); back.id = 'air-check-back-now'; back.dataset.action = 'air-check-back-now'; details.append(back);
        }
        selection.append(details); container.append(selection);
        const list = element('div', 'air-check-schedule'); list.setAttribute('role', 'group'); list.setAttribute('aria-label', 'Current and upcoming schedule');
        for (const program of programs) {
            const active = programId(program) === this.selectedId;
            const now = programId(program) === currentId;
            const row = action('', () => {
                this.selectedId = programId(program); this.selectionFollowsNow = false; this.synopsisExpanded = false;
                this.renderCurrent(programElementId(program));
            }, `air-check-program${active ? ' is-selected' : ''}`);
            row.id = programElementId(program); row.dataset.action = 'air-check-program'; row.dataset.programId = programId(program);
            if (now) row.setAttribute('aria-current', 'time');
            row.setAttribute('aria-pressed', active ? 'true' : 'false');
            row.setAttribute('aria-label', `${now ? 'On now' : 'Upcoming'}, ${program.item.fullTitle || program.item.title}, ${time(program.scheduledStartTime)} to ${time(program.scheduledEndTime)}`);
            row.append(element('span', now ? 'air-check-live' : 'air-check-muted', now ? 'ON NOW' : time(program.scheduledStartTime)),
                element('span', 'air-check-program-title', program.item.fullTitle || program.item.title),
                element('span', 'air-check-muted', `${time(program.scheduledStartTime)}–${time(program.scheduledEndTime)}`));
            list.append(row);
        }
        container.append(list);
        const footer = element('div', 'air-check-footer');
        footer.append(element('span', 'air-check-muted', `Schedule through ${date(status.coverageEnd, request.asOf)} ${time(status.coverageEnd)}`));
        if (request.horizonMs < MAX_HORIZON_MS) {
            const extend = action(this.extensionPending ? 'Extending schedule…' : 'Show next 6 hours', () => {
                if (this.extensionPending) return;
                this.extensionPending = true; extend.disabled = true; extend.textContent = 'Extending schedule…';
                this.renderOptions.onControlsChanged(programElementId(selected));
                this.renderOptions.onExtendHorizon(Math.min(request.horizonMs + SIX_HOURS_MS, MAX_HORIZON_MS));
            });
            extend.disabled = this.extensionPending;
            extend.id = 'air-check-extend'; extend.dataset.action = 'air-check-extend'; footer.append(extend);
        }
        container.append(footer);
    }

    private findControl(id: string): HTMLElement | undefined {
        return this.container ? Array.from(this.container.querySelectorAll<HTMLElement>('button')).find(button => button.id === id) : undefined;
    }

    private renderCurrent(preferredId: string): void {
        if (!this.container) return;
        this.render(this.container, this.status, this.request, this.renderOptions, true);
        const target = this.findControl(preferredId);
        target?.focus();
        if (target) this.renderOptions.onControlsChanged(target.id);
    }
}
