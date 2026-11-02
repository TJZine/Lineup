import type { KeyEvent } from '../../navigation/contracts/interfaces';
import { syncFocusableRegistry } from '../common/focus/syncFocusableRegistry';
import type { PlexLibrarySection, PlexMediaItem, PlexSeason } from '../../plex/library/types';
import type { ChannelContentSource, ContentFilter, FilterField, FilterOperator, ManualContentItem, PlaybackMode, SortOrder } from '../../scheduler/channel-manager/contracts/types';
import { sourceLabel } from '../channels/ChannelDirectoryModel';
import { ChannelStudioSession } from '../../../core/channel-studio/ChannelStudioSession';
import type { ChannelUpdateInput } from '../../scheduler/channel-manager/contracts/types';
import type { ChannelStudioPorts, ChannelStudioRequest } from '../../../core/channel-studio/ChannelStudioContracts';
import './styles.css';

type Choice = { key: string; title: string; subtitle: string; item?: PlexMediaItem; season?: PlexSeason; library?: PlexLibrarySection };
type PickerKind = 'library' | 'collection' | 'show' | 'playlist' | 'manual' | 'season';
type PickerState = { kind: PickerKind; invoker: string; query: string; libraryId: string; libraryTitle: string; libraryType: 'movie' | 'show' | null; showKey: string; mediaType: 'all' | 'movie' | 'episode'; choices: Choice[]; manualItems: ManualContentItem[] | null; seasons: number[] | null; allSeasonIds: number[]; status: 'loading' | 'ready' | 'empty' | 'error'; reason: string; generation: number; searchTimer: ReturnType<typeof setTimeout> | null };
const SOURCE_TYPES: ChannelContentSource['type'][] = ['library', 'collection', 'show', 'playlist', 'manual', 'mixed'];
const SOURCE_NAMES: Record<ChannelContentSource['type'], string> = { library: 'Library', collection: 'Collection', show: 'Show', playlist: 'Plex playlist', manual: 'Hand-picked', mixed: 'Mixed' };
const MODES: { value: PlaybackMode; label: string }[] = [{ value: 'sequential', label: 'In order' }, { value: 'shuffle', label: 'Mix it up' }, { value: 'block', label: 'Mini marathon' }, { value: 'random', label: 'Random' }];
const SORTS: { value: SortOrder; label: string }[] = [
    { value: 'title_asc', label: 'Title A–Z' }, { value: 'title_desc', label: 'Title Z–A' },
    { value: 'year_asc', label: 'Year oldest' }, { value: 'year_desc', label: 'Year newest' },
    { value: 'added_asc', label: 'Added oldest' }, { value: 'added_desc', label: 'Added newest' },
    { value: 'duration_asc', label: 'Shortest' }, { value: 'duration_desc', label: 'Longest' },
    { value: 'episode_order', label: 'Episode order' },
];
const FILTER_FIELDS: { value: FilterField; label: string; kind: 'number' | 'text' | 'boolean' }[] = [
    { value: 'year', label: 'Year', kind: 'number' }, { value: 'rating', label: 'Rating', kind: 'number' },
    { value: 'contentRating', label: 'Content rating', kind: 'text' }, { value: 'genre', label: 'Genre', kind: 'text' },
    { value: 'director', label: 'Director', kind: 'text' }, { value: 'duration', label: 'Duration (ms)', kind: 'number' },
    { value: 'watched', label: 'Watched', kind: 'boolean' }, { value: 'addedAt', label: 'Added at (timestamp)', kind: 'number' },
];
const FILTER_OPERATORS: Record<'number' | 'text' | 'boolean', FilterOperator[]> = {
    number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'], text: ['eq', 'neq', 'contains', 'notContains'], boolean: ['eq', 'neq'],
};
function formatLocalDateTime(value: number): string {
    if (!Number.isFinite(value)) return '';
    const date = new Date(value);
    const pad = (part: number): string => String(part).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
const NO_SOURCE = { type: 'manual', items: [] } as const satisfies ChannelContentSource;
const LEAVE_MODAL_ID = 'channel-studio-leave';
const PICKER_MODAL_ID = 'channel-studio-picker';
const FILTER_MODAL_ID = 'channel-studio-filters';
const SAVE_MODAL_ID = 'channel-studio-saving';
const initialSource = (type: ChannelContentSource['type']): ChannelContentSource => {
    switch (type) {
        case 'library': return { type, libraryId: '', libraryType: 'movie', includeWatched: true };
        case 'collection': return { type, collectionKey: '', collectionName: '' };
        case 'show': return { type, showKey: '', showName: '' };
        case 'playlist': return { type, playlistKey: '', playlistName: '' };
        case 'manual': return { type, items: [] };
        case 'mixed': return { type, sources: [], mixMode: 'interleave' };
    }
};

/** TV composition; all durable and preview policies remain in typed ports. */
export class ChannelStudioScreen {
    readonly session: ChannelStudioSession;
    private readonly container: HTMLElement;
    private readonly ports: ChannelStudioPorts;
    private visible = false;
    private registeredIds: string[] = [];
    private focusKey = 'studio-back';
    private picker: PickerState | null = null;
    private pickerController: AbortController | null = null;
    private filterDraft: ContentFilter[] | null = null;
    private leavePrompt = false;
    private pendingIssue: string | null = null;
    private openError: string | null = null;
    private openingRequest: ChannelStudioRequest | null = null;
    private editingField: { id: string; value: string; committedValue: string; start: number; end: number; composing: boolean } | null = null;
    private openChoiceId: string | null = null;
    private ownedModalId: string | null = null;
    private modalError: string | null = null;
    private saveUiToken = 0;
    private readonly onKeyPress = (event: KeyEvent): void => this.onKey(event);
    private readonly onModalClose = ({ modalId }: { modalId: string }): void => {
        if (!this.visible || modalId !== this.ownedModalId) return;
        this.ownedModalId = null;
        if (modalId === LEAVE_MODAL_ID) { this.leavePrompt = false; this.focusKey = 'studio-back'; }
        else if (modalId === PICKER_MODAL_ID) {
            this.focusKey = this.picker?.invoker ?? 'studio-source-edit';
            if (this.picker?.searchTimer) clearTimeout(this.picker.searchTimer);
            this.pickerController?.abort(); this.pickerController = null; this.picker = null;
            this.editingField = null;
        } else if (modalId === FILTER_MODAL_ID) { this.filterDraft = null; this.editingField = null; this.focusKey = 'studio-filters'; }
        else if (modalId === SAVE_MODAL_ID && this.session.saving) {
            if (!this.session.cancelPendingSave()) {
                this.modalError = 'Save is committing. Wait for storage to finish.';
            }
        }
        this.openChoiceId = null;
        this.render();
    };

    constructor(container: HTMLElement, ports: ChannelStudioPorts) {
        this.container = container; this.ports = ports; this.session = new ChannelStudioSession(ports);
        container.classList.add('screen', 'channel-studio');
    }

    show(request: ChannelStudioRequest): void {
        if (this.visible) this.hide();
        this.openingRequest = request; this.openError = null;
        try { this.session.open(request); }
        catch (error) { this.openError = error instanceof Error ? error.message : 'Could not open Studio.'; }
        this.visible = true;
        this.container.style.display = 'block'; this.container.classList.add('visible');
        this.focusKey = 'studio-back'; this.leavePrompt = false; this.picker = null; this.filterDraft = null; this.pendingIssue = null;
        this.editingField = null; this.openChoiceId = null; this.modalError = null;
        this.ports.navigation.on('keyPress', this.onKeyPress);
        this.ports.navigation.on('modalClose', this.onModalClose); this.render();
    }
    hide(): void {
        if (!this.visible) return;
        this.saveUiToken++;
        this.visible = false; this.ports.navigation.off('keyPress', this.onKeyPress);
        this.ownedModalId = null;
        for (const id of [SAVE_MODAL_ID, LEAVE_MODAL_ID, PICKER_MODAL_ID, FILTER_MODAL_ID]) this.ports.navigation.closeModal(id);
        this.ports.navigation.off('modalClose', this.onModalClose);
        if (this.picker?.searchTimer) clearTimeout(this.picker.searchTimer);
        this.pickerController?.abort(); this.pickerController = null; this.picker = null; this.filterDraft = null; this.leavePrompt = false;
        this.editingField = null; this.openChoiceId = null;
        this.registeredIds = syncFocusableRegistry(this.ports.navigation, this.registeredIds, []);
        this.container.replaceChildren(); this.container.style.display = 'none'; this.container.classList.remove('visible');
        this.session.close(); this.openError = null; this.openingRequest = null;
    }
    destroy(): void { this.hide(); }

    private onKey(event: KeyEvent): void {
        if (!this.visible || event.handled || event.button !== 'back') return;
        if (this.session.saving) { event.handled = true; event.originalEvent.preventDefault(); return; }
        if (this.editingField) { this.exitFieldEdit(); }
        else if (this.openChoiceId) { this.focusKey = this.openChoiceId; this.openChoiceId = null; this.render(); }
        else if (this.leavePrompt) { this.leavePrompt = false; this.focusKey = 'studio-back'; this.render(); }
        else if (this.picker) { this.closePicker(); }
        else if (this.filterDraft) { this.filterDraft = null; this.editingField = null; this.openChoiceId = null; this.focusKey = 'studio-filters'; this.render(); }
        else if (this.session.draft?.activeSource) {
            this.focusKey = this.session.draft.cancelPending() ?? 'studio-source-edit'; this.render();
        } else this.back();
        event.handled = true; event.originalEvent.preventDefault();
    }
    private back(): void {
        const draft = this.session.draft;
        if (!draft) { this.ports.close(this.openingRequest?.kind === 'create' ? null : this.openingRequest?.channelId ?? null); return; }
        if (draft?.dirty) { this.modalError = null; this.leavePrompt = true; this.focusKey = 'studio-stay'; this.render(); }
        else this.ports.close(this.session.focusChannelId);
    }
    private button(label: string, id: string, action: () => void, className = ''): HTMLButtonElement {
        const element = document.createElement('button'); element.type = 'button'; element.id = id; element.textContent = label;
        element.className = className; element.addEventListener('click', () => { this.focusKey = id; action(); }); return element;
    }
    private field(label: string, id: string, value: string, onChange: (value: string) => void, type = 'text'): HTMLElement {
        const wrap = document.createElement('div'); wrap.className = 'studio-field';
        const heading = document.createElement('span'); heading.textContent = label; wrap.append(heading);
        const editing = this.editingField?.id === id ? this.editingField : null;
        if (!editing) {
            const trigger = this.button(value || 'Select to edit', id, () => {
                this.editingField = { id, value, committedValue: value, start: value.length, end: value.length, composing: false };
                this.focusKey = `${id}-edit`; this.render();
            }, 'studio-field-trigger');
            trigger.setAttribute('aria-label', `${label}: ${value || 'empty'}. Select to edit.`);
            trigger.disabled = this.session.draft?.editable === false || this.session.saving;
            wrap.append(trigger); return wrap;
        }
        const input = document.createElement('input'); input.id = `${id}-edit`; input.type = type;
        input.value = editing.value; input.setAttribute('aria-label', `Edit ${label}`);
        const update = (): void => {
            editing.value = input.value;
            editing.start = input.selectionStart ?? input.value.length;
            editing.end = input.selectionEnd ?? input.value.length;
            if (!editing.composing && editing.committedValue !== input.value) {
                editing.committedValue = input.value; onChange(input.value);
            }
        };
        input.addEventListener('input', () => {
            update();
            if (!editing.composing) this.render();
        });
        input.addEventListener('change', () => { update(); this.render(); });
        input.addEventListener('compositionstart', () => { editing.composing = true; });
        input.addEventListener('compositionend', () => { editing.composing = false; update(); this.render(); });
        input.addEventListener('keydown', event => {
            if (event.keyCode !== 461 && event.key !== 'Escape' && event.key !== 'Enter') return;
            event.preventDefault(); event.stopPropagation(); update(); this.exitFieldEdit();
        });
        wrap.append(input); return wrap;
    }
    private select(label: string, id: string, value: string, options: { value: string; label: string }[], onChange: (value: string) => void): HTMLElement {
        const wrap = document.createElement('div'); wrap.className = 'studio-field';
        const heading = document.createElement('span'); heading.textContent = label; wrap.append(heading);
        const current = options.find(option => option.value === value)?.label ?? value;
        const trigger = this.button(current, id, () => {
            this.openChoiceId = this.openChoiceId === id ? null : id;
            this.focusKey = this.openChoiceId ? `${id}-option-0` : id; this.render();
        }, 'studio-field-trigger');
        trigger.setAttribute('aria-label', `${label}: ${current}. Select to choose.`);
        trigger.setAttribute('aria-expanded', String(this.openChoiceId === id));
        trigger.disabled = this.session.draft?.editable === false || this.session.saving;
        wrap.append(trigger);
        if (this.openChoiceId === id) {
            const choices = document.createElement('div'); choices.className = 'studio-choice-list'; choices.setAttribute('role', 'group');
            choices.setAttribute('aria-label', label);
            choices.addEventListener('keydown', event => {
                if (event.keyCode !== 461 && event.key !== 'Escape') return;
                event.preventDefault(); event.stopPropagation(); this.openChoiceId = null; this.focusKey = id; this.render();
            });
            options.forEach((option, index) => {
                const choice = this.button(option.label, `${id}-option-${index}`, () => {
                    this.openChoiceId = null; this.focusKey = id;
                    if (option.value !== value) onChange(option.value);
                    this.render();
                });
                choice.setAttribute('aria-pressed', String(option.value === value)); choices.append(choice);
            }); wrap.append(choices);
        }
        return wrap;
    }
    private exitFieldEdit(): void {
        const editing = this.editingField; if (!editing) return;
        this.editingField = null; this.focusKey = editing.id; this.render();
    }
    private status(text: string, kind = 'info'): HTMLElement {
        const element = document.createElement('p'); element.className = `studio-status ${kind}`;
        element.setAttribute('role', kind === 'error' ? 'alert' : 'status'); element.textContent = text; return element;
    }

    private render(): void {
        if (!this.visible) return;
        if (this.editingField?.composing) return;
        const draft = this.session.draft;
        if (!draft) { this.renderOpenError(); return; }
        const root = document.createElement('div'); root.className = 'studio-content';
        const header = document.createElement('header'); header.className = 'studio-header';
        header.append(this.button('‹ Channels', 'studio-back', () => this.back(), 'studio-link'));
        const title = document.createElement('h1'); title.textContent = draft.kind === 'create' ? 'Create a channel' : draft.kind === 'duplicate' ? 'Duplicate as custom' : draft.channel.name;
        header.append(title);
        const summary = document.createElement('p'); summary.textContent = draft.kind === 'inspect'
            ? 'Generated programming · inspect or duplicate as custom' : draft.dirty ? 'Unsaved draft' : this.session.focusChannelId && this.session.notice?.kind === 'saved' ? 'Saved' : 'Draft';
        header.append(summary);
        const headerActions = document.createElement('div'); headerActions.className = 'studio-header-actions';
        if (draft.kind === 'inspect') headerActions.append(this.button('Duplicate as custom', 'studio-duplicate', () => {
            const id = draft.originalId; if (!id) return;
            this.show({ kind: 'duplicate', channelId: id, expectedBase: this.ports.manager.getStructuralBase() });
        }, 'studio-primary'));
        else {
            const save = this.button(this.session.saving ? 'Saving…' : 'Save channel', 'studio-save', () => { void this.save(); }, 'studio-primary');
            save.disabled = !this.session.canSave || !!this.editingField; headerActions.append(save);
            if (this.session.focusChannelId && (this.session.notice?.kind === 'saved' || this.session.notice?.kind === 'saved-warning')) {
                headerActions.append(this.button('Tune now', 'studio-tune', () => { void this.session.tuneNow().then(() => this.render()); }));
            }
        }
        header.append(headerActions); root.append(header);
        if (this.session.notice) root.append(this.status(this.session.notice.text, this.session.notice.kind));
        if (this.modalError) root.append(this.status(this.modalError, 'error'));
        if (this.session.conflict) this.renderConflict(root);
        if (this.session.issues.length) root.append(this.status(this.session.issues.map(issue => issue.message).join(' '), 'error'));
        const identity = document.createElement('section'); identity.className = 'studio-identity';
        identity.append(this.field('Channel name', 'studio-name', draft.channel.name, value => this.change({ name: value })));
        identity.append(this.field('Channel number · 1–500', 'studio-number', String(draft.channel.number), value => this.change({ number: Number(value) }), 'number'));
        identity.append(this.select('Playback order', 'studio-mode', draft.channel.playbackMode, MODES, value => this.change({ playbackMode: value as PlaybackMode })));
        if (!draft.editable || this.session.saving) identity.querySelectorAll('input,select').forEach(el => { (el as HTMLInputElement).disabled = true; });
        root.append(identity);
        const columns = document.createElement('div'); columns.className = 'studio-columns';
        const programming = document.createElement('section'); programming.className = 'studio-programming';
        const h2 = document.createElement('h2'); h2.textContent = 'Programming'; programming.append(h2);
        this.renderProgramming(programming);
        const air = document.createElement('section'); air.className = 'studio-aircheck';
        this.renderAirCheck(air);
        columns.append(programming, air); root.append(columns);
        if (this.leavePrompt) this.renderLeave(root);
        if (this.picker) this.renderPicker(root);
        if (this.filterDraft) this.renderFilterPicker(root);
        if (this.session.saving) {
            const overlay = document.createElement('div'); overlay.className = 'studio-overlay';
            const status = document.createElement('section'); status.id = 'studio-save-status'; status.className = 'studio-dialog';
            status.tabIndex = -1; status.setAttribute('role', 'status'); status.textContent = 'Saving channel. Please wait.';
            overlay.append(status); root.append(overlay);
        }
        if (this.session.saving) root.querySelectorAll('button,input,select').forEach(element => {
            (element as HTMLButtonElement).disabled = true;
        });
        this.container.replaceChildren(root); this.registerFocus();
    }

    private renderOpenError(): void {
        const root = document.createElement('div'); root.className = 'studio-content';
        const heading = document.createElement('h1'); heading.textContent = 'Channel Studio'; root.append(heading);
        root.append(this.status(this.openError ?? 'Studio is unavailable.', 'error'));
        root.append(this.button('Back to Channels', 'studio-back', () => this.ports.close(this.openingRequest?.kind === 'create' ? null : this.openingRequest?.channelId ?? null)));
        const request = this.openingRequest;
        if (request && request.kind !== 'create') root.append(this.button('Reopen latest', 'studio-reopen', () => {
            this.show({ ...request, expectedBase: this.ports.manager.getStructuralBase() });
        }));
        this.container.replaceChildren(root); this.registerFocus();
    }

    private change(patch: ChannelUpdateInput): void {
        const draft = this.session.draft; if (!draft?.editable || this.session.saving) return;
        draft.change(patch); this.session.markDraftChanged();
    }
    private async save(): Promise<void> {
        if (!this.session.canSave || this.editingField) return;
        const nav = this.ports.navigation;
        nav.openModal(SAVE_MODAL_ID, ['studio-save-status'], { dismissOnBack: false, blocksBackgroundCommands: true });
        if (!nav.isModalOpen(SAVE_MODAL_ID)) {
            this.modalError = 'Save could not be protected. Try again.'; this.render(); return;
        }
        this.modalError = null;
        this.ownedModalId = SAVE_MODAL_ID;
        const token = ++this.saveUiToken;
        const pending = this.session.save(); this.render();
        try { await pending; }
        finally {
            if (token === this.saveUiToken && this.visible) {
                this.ownedModalId = null; nav.closeModal(SAVE_MODAL_ID); this.render();
            }
        }
    }
    private renderProgramming(root: HTMLElement): void {
        const draft = this.session.draft; if (!draft) return;
        const active = draft.activeSource;
        if (active) {
            if (this.pendingIssue) root.append(this.status(this.pendingIssue, 'error'));
            const crumbs = document.createElement('p'); crumbs.className = 'studio-breadcrumb';
            crumbs.textContent = [draft.channel.name, ...draft.pending.map((frame, i) => i === 0
                ? `${SOURCE_NAMES[frame.source.type]} source`
                : `Part ${(frame.path[frame.path.length - 1] ?? 0) + 1} · ${sourceLabel(frame.source)}`)].join(' › ');
            root.append(crumbs);
            root.append(this.sourceTabs(active.source.type, type => {
                this.pendingIssue = null; draft.updatePending(initialSource(type)); this.render();
            }));
            this.renderSourceLeaf(root, active.source);
            const actions = document.createElement('div'); actions.className = 'studio-actions';
            const apply = this.button(draft.pending.length > 1 ? 'Apply child' : 'Apply source', 'studio-apply-source', () => {
                const focus = draft.applyPending();
                if (focus) { this.pendingIssue = null; this.focusKey = focus; if (!draft.activeSource) this.session.markDraftChanged(); }
                else this.pendingIssue = 'Complete this source before applying it.';
                this.render();
            }, 'studio-primary');
            actions.append(apply, this.button('Cancel', 'studio-cancel-source', () => { this.focusKey = draft.cancelPending() ?? 'studio-source-edit'; this.render(); }));
            root.append(actions); return;
        }
        root.append(this.sourceTabs(draft.channel.contentSource.type, type => {
            if (!draft.editable) return;
            draft.beginSource(type === draft.channel.contentSource.type ? draft.channel.contentSource : initialSource(type), `studio-tab-${type}`);
            this.render();
        }, draft.editable));
        const source = document.createElement('p'); source.className = 'studio-current-source'; source.textContent = `Current source: ${sourceLabel(draft.channel.contentSource)}`; root.append(source);
        if (draft.editable) root.append(this.button('Edit source', 'studio-source-edit', () => { draft.beginSource(draft.channel.contentSource, 'studio-source-edit'); this.render(); }));
        if (draft.editable) root.append(this.button(`Filters (${draft.channel.contentFilters?.length ?? 0})`, 'studio-filters', () => {
            this.modalError = null; this.filterDraft = draft.channel.contentFilters?.map(filter => ({ ...filter })) ?? []; this.render();
        }));
        else root.append(this.status(`${draft.channel.contentFilters?.length ?? 0} saved filters`));
        root.append(this.select('Skip intros', 'studio-skip-intros', String(draft.channel.skipIntros), [
            { value: 'false', label: 'Play intros' }, { value: 'true', label: 'Skip intros' },
        ], value => this.change({ skipIntros: value === 'true' })));
        root.append(this.select('Skip credits', 'studio-skip-credits', String(draft.channel.skipCredits), [
            { value: 'false', label: 'Play credits' }, { value: 'true', label: 'Skip credits' },
        ], value => this.change({ skipCredits: value === 'true' })));
        root.append(this.field('Description', 'studio-description', draft.channel.description ?? '', value => this.change({ description: value })));
        root.append(this.select('Sort content', 'studio-sort', draft.channel.sortOrder ?? '',
            [{ value: '', label: 'Source order' }, ...SORTS], value => {
                if (value) this.change({ sortOrder: value as SortOrder });
                else { draft.clearSortOrder(); this.session.markDraftChanged(); }
            }));
        root.append(this.field('Shuffle seed', 'studio-seed', String(draft.channel.shuffleSeed ?? ''), value => this.change({ shuffleSeed: Number(value) }), 'number'));
        root.append(this.field('Phase seed', 'studio-phase', String(draft.channel.phaseSeed ?? ''), value => this.change({ phaseSeed: Number(value) }), 'number'));
        if (draft.channel.playbackMode === 'block') {
            root.append(this.field('Episodes per show', 'studio-block-size', String(draft.channel.blockSize ?? 3), value => this.change({ blockSize: Number(value) }), 'number'));
            root.append(this.select('Special episodes', 'studio-specials', String(draft.channel.includeSpecials !== false), [
                { value: 'true', label: 'Include specials' }, { value: 'false', label: 'Exclude specials' },
            ], value => this.change({ includeSpecials: value === 'true' })));
        }
        root.append(this.select('Schedule start', 'studio-anchor-mode', draft.channel.scheduleAnchorMode ?? 'daily', [
            { value: 'daily', label: 'Automatic each day' }, { value: 'fixed', label: 'Fixed date and time' },
        ], value => this.change(value === 'fixed' ? { scheduleAnchorMode: 'fixed', startTimeAnchor: this.ports.now() } : { scheduleAnchorMode: 'daily' })));
        if (draft.channel.scheduleAnchorMode === 'fixed') root.append(this.field('Fixed start · local date/time', 'studio-anchor',
            formatLocalDateTime(draft.channel.startTimeAnchor), value => this.change({ startTimeAnchor: new Date(value).getTime() }), 'datetime-local'));
        root.append(this.field('Maximum program duration (ms) · optional', 'studio-max-duration',
            draft.channel.maxEpisodeRunTimeMs === undefined ? '' : String(draft.channel.maxEpisodeRunTimeMs), value => {
                if (value === '') { draft.clearRuntimeBound('maxEpisodeRunTimeMs'); this.session.markDraftChanged(); }
                else this.change({ maxEpisodeRunTimeMs: Number(value) });
            }, 'number'));
        root.append(this.field('Minimum program duration (ms) · optional', 'studio-min-duration',
            draft.channel.minEpisodeRunTimeMs === undefined ? '' : String(draft.channel.minEpisodeRunTimeMs), value => {
                if (value === '') { draft.clearRuntimeBound('minEpisodeRunTimeMs'); this.session.markDraftChanged(); }
                else this.change({ minEpisodeRunTimeMs: Number(value) });
            }, 'number'));
        if (!draft.editable || this.session.saving) root.querySelectorAll('input,select').forEach(el => { (el as HTMLInputElement).disabled = true; });
    }

    private sourceTabs(selected: ChannelContentSource['type'], choose: (type: ChannelContentSource['type']) => void, enabled = true): HTMLElement {
        const tabs = document.createElement('div'); tabs.className = 'studio-source-tabs';
        for (const type of SOURCE_TYPES) {
            const tab = this.button(SOURCE_NAMES[type], `studio-tab-${type}`, () => choose(type), type === selected ? 'selected' : '');
            tab.setAttribute('aria-pressed', String(type === selected)); tab.disabled = !enabled; tabs.append(tab);
        }
        return tabs;
    }

    private renderSourceLeaf(root: HTMLElement, source: ChannelContentSource): void {
        const draft = this.session.draft; if (!draft) return;
        switch (source.type) {
            case 'library':
                root.append(this.status(source.libraryId ? `Library ${source.libraryId} · ${source.libraryType}` : 'Choose a library.'));
                root.append(this.button('Choose library', 'studio-pick-library', () => this.openPicker('library', 'studio-pick-library')));
                root.append(this.select('Watched content', 'studio-include-watched', String(source.includeWatched), [
                    { value: 'true', label: 'Include watched' }, { value: 'false', label: 'Unwatched only' },
                ], value => { draft.updatePending({ ...source, includeWatched: value === 'true' }); }));
                root.append(this.field('Library filter · key=value pairs', 'studio-library-filter', Object.entries(source.libraryFilter ?? {}).map(([key, value]) => `${key}=${value}`).join(', '), value => {
                    const pairs = value.split(',').map(part => part.trim()).filter(Boolean);
                    const filter: Record<string, string | number> = {};
                    for (const pair of pairs) {
                        const i = pair.indexOf('=');
                        if (i <= 0 || !pair.slice(0, i).trim()) {
                            this.pendingIssue = 'Use key=value for each library filter.'; return;
                        }
                        const key = pair.slice(0, i).trim(); const textValue = pair.slice(i + 1).trim();
                        if (!textValue) { this.pendingIssue = 'Library filter values cannot be empty.'; return; }
                        const former = source.libraryFilter?.[key];
                        filter[key] = typeof former === 'number' && Number.isFinite(Number(textValue))
                            ? Number(textValue) : textValue;
                    }
                    this.pendingIssue = null;
                    const next = { ...source }; delete next.libraryFilter;
                    draft.updatePending({ ...next, ...(Object.keys(filter).length ? { libraryFilter: filter } : {}) });
                }));
                break;
            case 'collection': {
                root.append(this.status(source.collectionKey ? `Collection: ${source.collectionName} · ${source.collectionKey}` : 'Choose a collection.'));
                root.append(this.status(source.libraryId && source.libraryType && source.libraryName
                    ? `Collection type: ${source.libraryType === 'show' ? 'TV' : 'Movies'} · Library scope: ${source.libraryName}`
                    : 'Collection type and library scope are unknown. Choose a collection to set them.'));
                root.append(this.button('Choose type, library and collection', 'studio-pick-collection', () => this.openPicker('collection', 'studio-pick-collection'))); break; }
            case 'show':
                root.append(this.status(source.showKey ? `Show: ${source.showName} · ${source.showKey}` : 'Choose a show.'));
                root.append(this.button('Choose show', 'studio-pick-show', () => this.openPicker('show', 'studio-pick-show')));
                if (source.showKey) root.append(this.button('Choose seasons', 'studio-pick-season', () => this.openPicker('season', 'studio-pick-season')));
                root.append(this.status(source.seasonFilter?.length ? `Seasons: ${source.seasonFilter.join(', ')}` : 'All seasons'));
                root.append(this.status('Episode order: season, then episode. Channel sort is set under Programming.'));
                break;
            case 'playlist':
                root.append(this.status(source.playlistKey ? `Playlist: ${source.playlistName} · ${source.playlistKey}` : 'Choose a playlist.'));
                root.append(this.button('Choose playlist', 'studio-pick-playlist', () => this.openPicker('playlist', 'studio-pick-playlist'))); break;
            case 'manual':
                root.append(this.status(`${source.items.length} program occurrence${source.items.length === 1 ? '' : 's'} in the rundown.`));
                source.items.forEach((item, index) => {
                    const row = document.createElement('div'); row.className = 'studio-item';
                    const count = source.items.filter(entry => entry.ratingKey === item.ratingKey).length;
                    const label = document.createElement('span'); label.textContent = `${index + 1}. ${item.title}${count > 1 ? ` · ${count} occurrences` : ''}`;
                    row.append(label);
                    row.append(this.button('↑', `studio-item-up-${index}`, () => this.moveManual(index, -1)), this.button('↓', `studio-item-down-${index}`, () => this.moveManual(index, 1)),
                        this.button('Remove', `studio-item-remove-${index}`, () => {
                            draft.updatePending({ ...source, items: source.items.filter((_, i) => i !== index) }); this.render();
                        })); root.append(row);
                });
                root.append(this.button('Browse programs', 'studio-manual-browse', () => this.openPicker('manual', 'studio-manual-browse'))); break;
            case 'mixed':
                root.append(this.select('Mix order', 'studio-mix-mode', source.mixMode, [
                    { value: 'interleave', label: 'Interleave children' }, { value: 'sequential', label: 'Play each child in order' },
                ], value => draft.updatePending({ ...source, mixMode: value as 'interleave' | 'sequential' })));
                source.sources.forEach((child, index) => {
                    const row = document.createElement('div'); row.className = 'studio-item';
                    const label = document.createElement('span'); label.textContent = `Part ${index + 1} · ${sourceLabel(child)}`; row.append(label);
                    row.append(this.button('Edit', `studio-mix-edit-${index}`, () => { draft.enterMixedChild(index, child, `studio-mix-edit-${index}`); this.render(); }),
                        this.button('↑', `studio-mix-up-${index}`, () => { draft.moveMixedChild(index, -1); this.render(); }),
                        this.button('↓', `studio-mix-down-${index}`, () => { draft.moveMixedChild(index, 1); this.render(); }),
                        this.button('Remove', `studio-mix-remove-${index}`, () => { draft.removeMixedChild(index); this.render(); })); root.append(row);
                });
                const add = this.button('Add child', 'studio-mix-add', () => { draft.enterMixedChild('new', NO_SOURCE, 'studio-mix-add'); this.render(); });
                add.disabled = (draft.activeSource?.path.length ?? 0) >= 25; root.append(add);
                if (add.disabled) root.append(this.status('This source is at the maximum Mixed nesting depth.'));
                break;
        }
    }
    private moveManual(index: number, offset: number): void {
        const draft = this.session.draft, source = draft?.activeSource?.source;
        if (!draft || source?.type !== 'manual') return;
        const to = index + offset; if (to < 0 || to >= source.items.length) return;
        const items = [...source.items]; const current = items[index], other = items[to];
        if (!current || !other) return; items[index] = other; items[to] = current;
        draft.updatePending({ ...source, items }); this.focusKey = `studio-item-${offset < 0 ? 'up' : 'down'}-${to}`; this.render();
    }

    private renderAirCheck(root: HTMLElement): void {
        if (this.session.isBaseStale) {
            root.append(this.status('The lineup changed since this draft opened. Refresh before saving.', 'error'));
            root.append(this.button('Refresh lineup', 'studio-refresh-base', () => { this.session.refreshBase(); this.render(); }));
        }
        if (this.session.draft?.pending.length) root.append(this.status(
            'Source choice pending. Apply or cancel it before saving. The schedule shown is for the applied draft.'));
        const content = document.createElement('div'); content.className = 'studio-air-content';
        this.ports.airCheck.render(content, this.session.verification, this.session.lastRequest, {
            onVerify: (): void => {
                const pending = this.session.verify(); this.render(); void pending.then(() => this.render());
            },
            onCancel: (): void => { this.session.cancelVerification(); this.render(); },
            onExtendHorizon: (nextHorizonMs): void => {
                const pending = this.session.extendHorizon(nextHorizonMs); this.render(); void pending.then(() => this.render());
            },
            onControlsChanged: (preferredId?: string): void => {
                if (!this.visible) return;
                if (preferredId && [...this.container.querySelectorAll<HTMLElement>('[id]')].some(element => element.id === preferredId)) {
                    this.focusKey = preferredId;
                }
                this.registerFocus();
            },
            extensionStatus: this.session.extensionStatus,
        }); root.append(content);
    }
    private renderConflict(root: HTMLElement): void {
        const panel = document.createElement('section'); panel.className = 'studio-conflict';
        const heading = document.createElement('h2'); heading.textContent = 'Saved channel changed'; panel.append(heading);
        panel.append(this.status('Your draft is still here. Choose how to continue. Replacing requires a fresh Air Check.'));
        const draft = this.session.draft;
        const latest = draft?.kind === 'edit' && draft.originalId ? this.ports.manager.getChannel(draft.originalId) : null;
        if (latest) panel.append(
            this.button('Use saved', 'studio-conflict-use', () => { this.session.useSaved(); this.render(); }),
            this.button('Replace saved', 'studio-conflict-replace', () => { this.session.replaceSaved(); this.render(); }));
        if (draft?.kind === 'edit') panel.append(this.button('Save as new', 'studio-conflict-new', () => { this.session.saveAsNew(); this.render(); }));
        else panel.append(this.button('Refresh lineup', 'studio-conflict-refresh', () => { this.session.refreshBase(); this.render(); }));
        panel.append(this.button('Keep editing', 'studio-conflict-keep', () => { this.session.conflict = false; this.render(); }));
        root.append(panel);
    }

    private renderLeave(root: HTMLElement): void {
        const overlay = document.createElement('div'); overlay.className = 'studio-overlay';
        const box = document.createElement('section'); box.className = 'studio-dialog'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
        const heading = document.createElement('h2'); heading.textContent = 'Leave this draft?'; box.append(heading);
        box.append(this.status('Unsaved changes will be discarded.'));
        box.append(this.button('Keep editing', 'studio-stay', () => { this.leavePrompt = false; this.render(); }, 'studio-primary'),
            this.button('Discard draft', 'studio-discard', () => this.ports.close(this.session.focusChannelId), 'studio-destructive'));
        overlay.append(box); root.append(overlay);
    }
    private openPicker(kind: PickerKind, invoker: string): void {
        this.modalError = null;
        if (this.picker?.searchTimer) clearTimeout(this.picker.searchTimer);
        this.pickerController?.abort();
        const source = this.session.draft?.activeSource?.source;
        this.picker = { kind, invoker, query: '', libraryId: kind === 'collection' && source?.type === 'collection' ? source.libraryId ?? '' : '',
            libraryTitle: kind === 'collection' && source?.type === 'collection' ? source.libraryName ?? '' : '',
            libraryType: kind === 'collection' && source?.type === 'collection' ? source.libraryType ?? null : null,
            showKey: '', mediaType: 'all',
            choices: [], manualItems: kind === 'manual' && source?.type === 'manual' ? source.items.map(item => ({ ...item })) : null,
            seasons: kind === 'season' && source?.type === 'show' ? source.seasonFilter ? [...source.seasonFilter] : null : null,
            allSeasonIds: [], status: 'loading', reason: '', generation: 0, searchTimer: null };
        this.focusKey = 'studio-picker-search'; this.render(); void this.loadPicker();
    }
    private applyPicker(): void {
        const picker = this.picker, draft = this.session.draft, source = draft?.activeSource?.source;
        if (!picker || !draft || !source) return;
        if (picker.kind === 'manual' && source.type === 'manual' && picker.manualItems) {
            draft.updatePending({ ...source, items: picker.manualItems.map(item => ({ ...item })) });
        }
        if (picker.kind === 'season' && source.type === 'show') {
            const next = { ...source }; delete next.seasonFilter;
            draft.updatePending(picker.seasons === null ? next : { ...next, seasonFilter: [...picker.seasons] });
        }
        this.closePicker();
    }
    private closePicker(): void {
        const invoker = this.picker?.invoker ?? 'studio-source-edit';
        if (this.picker?.searchTimer) clearTimeout(this.picker.searchTimer);
        this.pickerController?.abort(); this.pickerController = null; this.picker = null;
        this.editingField = null; this.openChoiceId = null;
        this.focusKey = invoker; this.render();
    }
    private async loadPicker(): Promise<void> {
        const picker = this.picker; if (!picker) return;
        this.pickerController?.abort(); const controller = new AbortController(); this.pickerController = controller;
        const generation = ++picker.generation;
        picker.status = 'loading'; picker.reason = ''; picker.choices = []; this.render();
        try {
            const signal = controller.signal;
            let choices: Choice[] = []; let allSeasonIds: number[] | null = null;
            if (((picker.kind === 'collection' || picker.kind === 'show') && !picker.libraryId)
                || ((picker.kind === 'library' || picker.kind === 'manual') && !picker.libraryId && !picker.query)) {
                const libraries = await this.ports.plexLibrary.getLibraries({ signal });
                choices = libraries.filter(item => item.type === 'movie' || item.type === 'show')
                    .filter(item => picker.kind !== 'show' || item.type === 'show')
                    .filter(item => picker.kind !== 'collection' || !picker.libraryType || item.type === picker.libraryType)
                    .filter(item => item.title.toLocaleLowerCase().includes(picker.query.toLocaleLowerCase()))
                    .map(library => ({ key: library.id, title: library.title, subtitle: `${library.type} library`, library }));
            } else if (picker.kind === 'collection') {
                const collections = await this.ports.plexLibrary.getCollections(picker.libraryId, { signal, requestIntent: 'preview' });
                choices = collections.filter(item => item.title.toLocaleLowerCase().includes(picker.query.toLocaleLowerCase()))
                    .map(item => ({ key: item.ratingKey || item.key, title: item.title, subtitle: `${item.childCount} items` }));
            } else if (picker.kind === 'show') {
                const shows = await this.ports.plexLibrary.getShows(picker.libraryId, { signal });
                choices = shows.filter(item => item.title.toLocaleLowerCase().includes(picker.query.toLocaleLowerCase()))
                    .map(item => ({ key: item.ratingKey, title: item.title, subtitle: 'TV show', item }));
            } else if (picker.kind === 'season') {
                const source = this.session.draft?.activeSource?.source;
                if (source?.type === 'show') {
                    const seasons = await this.ports.plexLibrary.getShowSeasons(source.showKey, { signal });
                    allSeasonIds = seasons.map(season => season.index);
                    choices = seasons.filter(season => season.title.toLocaleLowerCase().includes(picker.query.toLocaleLowerCase()))
                        .map(season => ({ key: String(season.index), title: season.title,
                        subtitle: `${season.leafCount} episodes${season.index === 0 ? ' · specials' : ''}`, season }));
                }
            } else if (picker.kind === 'playlist') {
                const playlists = await this.ports.plexLibrary.getPlaylists({ signal, requestIntent: 'preview' });
                choices = playlists.filter(item => item.title.toLocaleLowerCase().includes(picker.query.toLocaleLowerCase()))
                    .map(item => ({ key: item.ratingKey || item.key, title: item.title, subtitle: `${item.leafCount} items` }));
            } else if (picker.kind === 'manual') {
                let media: PlexMediaItem[];
                if (picker.query.trim()) media = await this.ports.plexLibrary.search(picker.query.trim(), {
                    ...(picker.libraryId ? { libraryId: picker.libraryId } : {}),
                    ...(picker.mediaType === 'all' ? {} : { types: [picker.mediaType] }), signal,
                });
                else if (picker.libraryType === 'show' && picker.showKey)
                    media = await this.ports.plexLibrary.getShowEpisodes(picker.showKey, { signal });
                else if (picker.libraryType === 'show') media = await this.ports.plexLibrary.getShows(picker.libraryId, { signal });
                else media = await this.ports.plexLibrary.getLibraryItems(picker.libraryId, { signal });
                choices = media.filter(item => picker.libraryType === 'show' && !picker.showKey && !picker.query
                    ? item.type === 'show' : (item.type === 'movie' || item.type === 'episode')
                        && (picker.mediaType === 'all' || item.type === picker.mediaType))
                    .map(item => ({ key: item.ratingKey, title: item.title, subtitle: `${item.type} · ${Math.round(item.durationMs / 60000)} min`, item }));
            } else if (picker.kind === 'library' && picker.query) {
                const libraries = await this.ports.plexLibrary.getLibraries({ signal });
                choices = libraries.filter(item => (item.type === 'movie' || item.type === 'show')
                    && item.title.toLocaleLowerCase().includes(picker.query.toLocaleLowerCase()))
                    .map(library => ({ key: library.id, title: library.title, subtitle: `${library.type} library`, library }));
            }
            if (this.picker !== picker || picker.generation !== generation || signal.aborted || !this.visible) return;
            picker.choices = choices; if (allSeasonIds) picker.allSeasonIds = allSeasonIds;
            picker.status = choices.length ? 'ready' : 'empty'; this.render();
        } catch {
            if (this.picker !== picker || picker.generation !== generation || controller.signal.aborted || !this.visible) return;
            picker.status = 'error'; picker.reason = 'Source unavailable. Retry.'; this.render();
        }
    }
    private choosePicker(choice: Choice): void {
        const picker = this.picker, draft = this.session.draft, source = draft?.activeSource?.source;
        if (!picker || !draft || !source) return;
        if (choice.library) {
            if (picker.kind === 'library' && source.type === 'library') {
                draft.updatePending({ type: 'library', libraryId: choice.library.id,
                    libraryType: choice.library.type === 'show' ? 'show' : 'movie', includeWatched: source.includeWatched,
                    ...(source.libraryFilter ? { libraryFilter: { ...source.libraryFilter } } : {}) });
                this.closePicker(); return;
            }
            picker.libraryId = choice.library.id; picker.libraryTitle = choice.library.title;
            picker.libraryType = choice.library.type === 'show' ? 'show' : 'movie';
            picker.showKey = ''; picker.query = ''; picker.choices = [];
            this.focusKey = 'studio-picker-search'; void this.loadPicker(); return;
        }
        if (picker.kind === 'collection' && source.type === 'collection') {
            if (!picker.libraryId || !picker.libraryType || !picker.libraryTitle) return;
            draft.updatePending({ type: 'collection', collectionKey: choice.key, collectionName: choice.title,
                libraryId: picker.libraryId, libraryType: picker.libraryType, libraryName: picker.libraryTitle });
        }
        else if (picker.kind === 'show' && source.type === 'show') draft.updatePending({ type: 'show', showKey: choice.key, showName: choice.title });
        else if (picker.kind === 'playlist' && source.type === 'playlist') draft.updatePending({ type: 'playlist', playlistKey: choice.key, playlistName: choice.title });
        else if (picker.kind === 'manual' && source.type === 'manual' && choice.item) {
            if (choice.item.type === 'show') { picker.showKey = choice.item.ratingKey; picker.query = ''; void this.loadPicker(); return; }
            if (choice.item.durationMs <= 0) { picker.reason = 'This item has no playable duration.'; this.render(); return; }
            const item: ManualContentItem = { ratingKey: choice.item.ratingKey, title: choice.item.title, durationMs: choice.item.durationMs };
            picker.manualItems?.push(item);
            // Keep browse open; Apply choices stages repeated occurrences together.
            this.render(); return;
        } else if (picker.kind === 'season' && source.type === 'show' && choice.season) {
            const index = choice.season.index;
            if (index >= 0) {
                const selected = picker.seasons ?? picker.allSeasonIds;
                const next = selected.includes(index)
                    ? selected.filter(value => value !== index) : [...selected, index].sort((a, b) => a - b);
                if (next.length === 0) { picker.reason = 'Include at least one season.'; this.render(); return; }
                picker.reason = ''; picker.seasons = next;
            }
            this.render(); return;
        }
        this.closePicker();
    }
    private renderPicker(root: HTMLElement): void {
        const picker = this.picker; if (!picker) return;
        const overlay = document.createElement('div'); overlay.className = 'studio-overlay';
        const dialog = document.createElement('section'); dialog.className = 'studio-picker'; dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true');
        const heading = document.createElement('h2'); heading.textContent = picker.kind === 'manual' ? 'Browse programs' : `Choose ${picker.kind}`; dialog.append(heading);
        dialog.append(this.field(`Search ${picker.kind}`, 'studio-picker-search', picker.query, value => {
            picker.query = value;
            if (picker.searchTimer) clearTimeout(picker.searchTimer);
            picker.searchTimer = setTimeout(() => { if (this.picker === picker) void this.loadPicker(); }, 250);
        }, 'search'));
        if (picker.kind === 'collection') {
            dialog.append(this.select('Collection type', 'studio-picker-collection-type', picker.libraryType ?? 'all', [
                { value: 'all', label: 'Movies or TV' }, { value: 'movie', label: 'Movies' }, { value: 'show', label: 'TV' },
            ], value => {
                picker.libraryType = value === 'all' ? null : value as 'movie' | 'show';
                picker.libraryId = ''; picker.libraryTitle = ''; picker.query = '';
                void this.loadPicker();
            }));
            if (picker.libraryId) dialog.append(this.button('Change library', 'studio-picker-change-library', () => {
                picker.libraryId = ''; picker.libraryTitle = ''; picker.query = '';
                void this.loadPicker();
            }));
        }
        if (picker.libraryId) dialog.append(this.status(`Library scope: ${picker.libraryId}${picker.showKey ? ` · Show ${picker.showKey}` : ''}`));
        if (picker.kind === 'manual' && picker.showKey) dialog.append(this.button('Choose another show', 'studio-picker-other-show', () => {
            picker.showKey = ''; picker.query = ''; void this.loadPicker();
        }));
        if (picker.kind === 'season') dialog.append(this.button('All seasons', 'studio-season-all', () => {
            const source = this.session.draft?.activeSource?.source;
            if (source?.type === 'show') { picker.seasons = null; this.render(); }
        }));
        if (picker.reason && picker.status !== 'error') dialog.append(this.status(picker.reason, 'error'));
        if (picker.kind === 'manual' && picker.manualItems) dialog.append(this.status(`${picker.manualItems.length} staged program occurrences`));
        if (picker.kind === 'manual') dialog.append(this.select('Media type', 'studio-picker-type', picker.mediaType,
            [{ value: 'all', label: 'All types' }, { value: 'movie', label: 'Movies' }, { value: 'episode', label: 'Episodes' }], value => {
                picker.mediaType = value as PickerState['mediaType']; void this.loadPicker();
            }));
        dialog.append(this.status(picker.status === 'loading' ? 'Loading…' : picker.status === 'empty' ? 'No matching items.'
            : picker.status === 'error' ? picker.reason : `${picker.choices.length} available`, picker.status === 'error' ? 'error' : 'info'));
        if (picker.status === 'error') dialog.append(this.button('Retry', 'studio-picker-retry', () => { void this.loadPicker(); }));
        const list = document.createElement('div'); list.className = 'studio-picker-list';
        picker.choices.forEach((choice, index) => {
            const selectedSeason = picker.kind === 'season' && choice.season
                && (picker.seasons === null || picker.seasons.includes(choice.season.index));
            const row = this.button(`${selectedSeason ? '✓ ' : ''}${choice.title} · ${choice.subtitle}`, `studio-picker-choice-${index}`, () => this.choosePicker(choice));
            list.append(row);
        }); dialog.append(list);
        if (picker.kind === 'manual' || picker.kind === 'season') dialog.append(this.button('Apply choices', 'studio-picker-apply', () => this.applyPicker(), 'studio-primary'));
        dialog.append(this.button('Cancel', 'studio-picker-cancel', () => this.closePicker()));
        overlay.append(dialog); root.append(overlay);
    }
    private renderFilterPicker(root: HTMLElement): void {
        const filters = this.filterDraft, draft = this.session.draft; if (!filters || !draft) return;
        const overlay = document.createElement('div'); overlay.className = 'studio-overlay';
        const dialog = document.createElement('section'); dialog.className = 'studio-picker'; dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true');
        const h = document.createElement('h2'); h.textContent = 'Filters'; dialog.append(h);
        filters.forEach((filter, index) => {
            const row = document.createElement('div'); row.className = 'studio-filter-row';
            const field = FILTER_FIELDS.find(entry => entry.value === filter.field) ?? FILTER_FIELDS[0];
            if (!field) return;
            row.append(this.select('Field', `studio-filter-field-${index}`, filter.field, FILTER_FIELDS.map(item => ({ value: item.value, label: item.label })), value => {
                const next = FILTER_FIELDS.find(item => item.value === value); if (!next) return;
                filters[index] = { field: next.value, operator: 'eq', value: next.kind === 'number' ? 0 : next.kind === 'boolean' ? false : '' }; this.render();
            }));
            const operators: { value: string; label: string }[] = FILTER_OPERATORS[field.kind].map(value => ({ value, label: value }));
            if (!FILTER_OPERATORS[field.kind].includes(filter.operator))
                operators.unshift({ value: filter.operator, label: `Unsupported saved operator · ${filter.operator}` });
            row.append(this.select('Operator', `studio-filter-operator-${index}`, filter.operator,
                operators, value => { filter.operator = value as FilterOperator; this.render(); }));
            if (field.kind === 'boolean') row.append(this.select('Value', `studio-filter-value-${index}`, String(filter.value), [
                { value: 'true', label: 'Watched' }, { value: 'false', label: 'Unwatched' },
            ], value => { filter.value = value === 'true'; this.render(); }));
            else row.append(this.field('Value', `studio-filter-value-${index}`, String(filter.value), value => {
                filter.value = field.kind === 'number' ? Number(value) : value;
            }, field.kind === 'number' ? 'number' : 'text'));
            row.append(this.button('Remove', `studio-filter-remove-${index}`, () => { filters.splice(index, 1); this.render(); }));
            dialog.append(row);
        });
        dialog.append(this.button('Add filter', 'studio-filter-add', () => { filters.push({ field: 'year', operator: 'eq', value: new Date().getFullYear() }); this.render(); }));
        const valid = filters.every(filter => {
            const field = FILTER_FIELDS.find(entry => entry.value === filter.field);
            return !!field && FILTER_OPERATORS[field.kind].includes(filter.operator)
                && (field.kind === 'number' ? typeof filter.value === 'number' && Number.isFinite(filter.value)
                    : field.kind === 'boolean' ? typeof filter.value === 'boolean' : typeof filter.value === 'string');
        });
        if (!valid) dialog.append(this.status('Enter a valid value for each filter.', 'error'));
        const apply = this.button('Apply filters', 'studio-filter-apply', () => {
            draft.setFilters(filters); this.filterDraft = null; this.editingField = null; this.openChoiceId = null;
            this.session.markDraftChanged(); this.focusKey = 'studio-filters'; this.render();
        }, 'studio-primary'); apply.disabled = !valid;
        dialog.append(apply, this.button('Cancel', 'studio-filter-cancel', () => {
            this.filterDraft = null; this.editingField = null; this.openChoiceId = null; this.focusKey = 'studio-filters'; this.render();
        }));
        overlay.append(dialog); root.append(overlay);
    }
    private registerFocus(): void {
        const selector = this.session.saving ? '#studio-save-status' : this.leavePrompt ? '.studio-dialog button'
            : this.picker || this.filterDraft ? '.studio-picker button, .studio-picker input' : 'button, input';
        const all = [...this.container.querySelectorAll<HTMLElement>(selector)].filter(element => {
            if (element.id === 'studio-save-status') return true;
            if (element instanceof HTMLButtonElement || element instanceof HTMLInputElement) return !element.disabled;
            return false;
        });
        this.registeredIds = syncFocusableRegistry(this.ports.navigation, this.registeredIds, all.map((element, index) => ({
            id: element.id, element,
            neighbors: { ...(all[index - 1] ? { up: all[index - 1]!.id } : {}), ...(all[index + 1] ? { down: all[index + 1]!.id } : {}) },
            onFocus: (): void => { element.scrollIntoView({ block: 'nearest' }); this.focusKey = element.id; },
        })));
        if (!this.syncModal(all.map(element => element.id))) return;
        const preferred = this.session.saving ? 'studio-save-status' : this.editingField ? `${this.editingField.id}-edit`
            : this.openChoiceId ? (all.some(element => element.id === this.focusKey) ? this.focusKey : `${this.openChoiceId}-option-0`)
                : this.leavePrompt ? 'studio-stay'
                : this.picker ? (all.some(element => element.id === this.focusKey) ? this.focusKey : 'studio-picker-search')
                    : this.filterDraft ? (all.some(element => element.id === this.focusKey) ? this.focusKey : 'studio-filter-add')
                        : this.focusKey;
        const target = all.find(element => element.id === preferred) ?? all[0];
        if (target) {
            this.ports.navigation.setFocus(target.id);
            if (target instanceof HTMLInputElement && this.editingField) {
                try { target.setSelectionRange(this.editingField.start, this.editingField.end); }
                catch { /* Number and date inputs do not support text selection. */ }
            }
        }
    }

    private syncModal(focusableIds: string[]): boolean {
        const desired = this.session.saving ? SAVE_MODAL_ID : this.leavePrompt ? LEAVE_MODAL_ID
            : this.picker ? PICKER_MODAL_ID : this.filterDraft ? FILTER_MODAL_ID : null;
        const nav = this.ports.navigation;
        if (this.ownedModalId && this.ownedModalId !== desired) {
            const former = this.ownedModalId; this.ownedModalId = null; nav.closeModal(former);
        }
        if (!desired) return true;
        nav.openModal(desired, focusableIds, { dismissOnBack: desired !== SAVE_MODAL_ID, blocksBackgroundCommands: true });
        if (!nav.isModalOpen(desired)) {
            this.ownedModalId = null;
            if (desired === PICKER_MODAL_ID) {
                if (this.picker?.searchTimer) clearTimeout(this.picker.searchTimer);
                this.pickerController?.abort(); this.pickerController = null; this.picker = null;
            }
            else if (desired === FILTER_MODAL_ID) this.filterDraft = null;
            else if (desired === LEAVE_MODAL_ID) this.leavePrompt = false;
            else this.session.cancelPendingSave();
            this.openChoiceId = null;
            this.modalError = 'Studio dialog could not be protected. Try again.';
            if (desired !== SAVE_MODAL_ID) this.render();
            return false;
        }
        this.ownedModalId = desired;
        this.modalError = null;
        return true;
    }
}
