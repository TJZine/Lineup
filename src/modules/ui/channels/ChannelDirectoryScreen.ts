import type { KeyEvent } from '../../navigation/contracts/interfaces';
import { syncFocusableRegistry } from '../common/focus/syncFocusableRegistry';
import type { ChannelStructuralBase } from '../../scheduler/channel-manager/contracts/ChannelDurability';
import { ChannelDirectoryModel, type DirectoryFilter } from './ChannelDirectoryModel';
import { sameActiveMedia, type ActiveMediaIdentity, type ChannelDirectoryPorts } from './ChannelDirectoryPorts';
import './styles.css';

const DELETE_MODAL_ID = 'channel-directory-delete';
const POSITION_MODAL_ID = 'channel-directory-position';
type Dialog = {
    ids: string[];
    base: ChannelStructuralBase;
    scopeKey: string;
    consentedMedia: ActiveMediaIdentity | null;
    returnFocusId: string;
    stale: boolean;
} | null;
type PositionPicker = {
    channelId: string;
    base: ChannelStructuralBase;
    scopeKey: string;
    returnFocusId: string;
};

/** The directory owns only presentation and remote focus; the manager owns saved channels. */
export class ChannelDirectoryScreen {
    readonly model: ChannelDirectoryModel;
    private readonly container: HTMLElement;
    private readonly ports: ChannelDirectoryPorts;
    private registeredIds: string[] = [];
    private visible = false;
    private dialog: Dialog = null;
    private positionPicker: PositionPicker | null = null;
    private pendingDelete = false;
    private menuId: string | null = null;
    private focusKey = 'directory-search';
    private searchEditing = false;
    private composingSearch = false;
    private searchSelection: { start: number; end: number } | null = null;
    private readonly keyHandler = (event: KeyEvent): void => this.onKey(event);
    private readonly modalCloseHandler = ({ modalId }: { modalId: string }): void => {
        if (modalId === POSITION_MODAL_ID && this.positionPicker) {
            this.focusKey = this.positionPicker.returnFocusId;
            this.positionPicker = null;
            this.render();
            return;
        }
        if (modalId !== DELETE_MODAL_ID || !this.dialog) return;
        this.focusKey = this.dialog.returnFocusId;
        this.dialog = null;
        this.pendingDelete = false;
        this.render();
    };

    constructor(container: HTMLElement, ports: ChannelDirectoryPorts) {
        this.container = container;
        this.ports = ports;
        this.model = new ChannelDirectoryModel(ports);
        container.classList.add('screen', 'channel-directory');
    }

    show(preferredChannelId?: string): void {
        if (this.visible) {
            if (preferredChannelId) this.applyPreferredChannelFocus(preferredChannelId);
            this.render(); return;
        }
        this.visible = true;
        this.container.style.display = 'block';
        this.container.classList.add('visible');
        if (preferredChannelId) this.applyPreferredChannelFocus(preferredChannelId);
        this.ports.navigation.on('keyPress', this.keyHandler);
        this.ports.navigation.on('modalClose', this.modalCloseHandler);
        this.render();
    }

    hide(): void {
        if (!this.visible) return;
        this.visible = false;
        this.model.close();
        this.dialog = null; this.positionPicker = null; this.pendingDelete = false; this.menuId = null;
        this.searchEditing = false; this.composingSearch = false; this.searchSelection = null;
        this.ports.navigation.closeModal(DELETE_MODAL_ID);
        this.ports.navigation.closeModal(POSITION_MODAL_ID);
        this.ports.navigation.off('keyPress', this.keyHandler);
        this.ports.navigation.off('modalClose', this.modalCloseHandler);
        this.registeredIds = syncFocusableRegistry(this.ports.navigation, this.registeredIds, []);
        this.container.replaceChildren();
        this.container.style.display = 'none';
        this.container.classList.remove('visible');
    }

    destroy(): void { this.hide(); }

    private onKey(event: KeyEvent): void {
        if (!this.visible || event.handled) return;
        if (event.button !== 'back') return;
        if (this.searchEditing) { this.exitSearchEdit(); }
        else if (this.dialog) { this.closeDialog(); }
        else if (this.positionPicker) { this.closePositionPicker(); this.render(); }
        else if (this.menuId) { this.focusKey = this.rowActionId(this.menuId); this.menuId = null; this.render(); }
        else if (this.model.mode === 'select') { this.model.cancelSelection(); this.focusKey = 'directory-select'; this.render(); }
        else if (this.model.mode === 'reorder') { this.model.cancelReorder(); this.focusKey = 'directory-reorder'; this.render(); }
        else if (this.model.query) { this.model.setQuery(''); this.focusKey = 'directory-search'; this.render(); }
        else { this.ports.goBack(); }
        event.handled = true; event.originalEvent.preventDefault();
    }

    private button(label: string, id: string, action: () => void, className = ''): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button'; button.id = id; button.className = className; button.textContent = label;
        button.addEventListener('click', () => { this.focusKey = id; action(); });
        return button;
    }

    private rowId(id: string): string { return `directory-row-${encodeURIComponent(id)}`; }
    private rowActionId(id: string): string { return `directory-action-${encodeURIComponent(id)}`; }

    private applyPreferredChannelFocus(id: string): void {
        const rows = this.model.rows;
        const target = rows.find(row => row.channel.id === id) ?? rows[0];
        this.model.setFocusedChannel(target?.channel.id ?? null);
        this.focusKey = target ? this.rowId(target.channel.id) : 'directory-search';
    }

    private scopedActiveMedia(): ActiveMediaIdentity | null {
        const media = this.ports.getActiveMediaIdentity();
        return media?.scopeKey === this.ports.getDirectoryScopeKey() ? media : null;
    }

    private exitSearchEdit(): void {
        this.searchEditing = false;
        this.composingSearch = false;
        this.searchSelection = null;
        this.focusKey = 'directory-search';
        this.render();
    }

    private closeDialog(): void {
        if (!this.dialog || this.pendingDelete) return;
        this.focusKey = this.dialog.returnFocusId;
        this.dialog = null;
        this.ports.navigation.closeModal(DELETE_MODAL_ID);
        this.render();
    }

    private render(): void {
        if (!this.visible) return;
        if (this.positionPicker && !this.isPositionPickerCurrent(this.positionPicker)) {
            this.closePositionPicker();
            this.model.notice = { kind: 'error', text: 'The lineup changed. Cancel reorder and start again.' };
        }
        const root = document.createElement('div'); root.className = 'channel-directory-content';
        const title = document.createElement('header'); title.className = 'channel-directory-header';
        const heading = document.createElement('div');
        const h1 = document.createElement('h1');
        h1.textContent = this.model.mode === 'reorder' ? 'Reorder channels' : 'Channels';
        const count = document.createElement('span'); count.className = 'channel-directory-count'; count.textContent = String(this.model.channels.length);
        h1.append(' ', count); heading.append(h1);
        const subtitle = document.createElement('p'); subtitle.textContent = this.model.mode === 'reorder'
            ? 'Channels appear in number order. Reordering changes channel numbers.' : 'Your lineup, in channel order.';
        heading.append(subtitle); title.append(heading);
        const headingActions = document.createElement('div'); headingActions.className = 'channel-directory-heading-actions';
        const add = this.button('Add a custom channel', 'directory-add', () => this.ports.openStudio({ kind: 'create' }), 'channel-directory-primary');
        add.disabled = !this.model.canMutate;
        headingActions.append(this.button('Generate lineup', 'directory-generate', () => this.ports.openGenerate(), 'channel-directory-outline'), add);
        title.append(headingActions); root.append(title);

        const notice = document.createElement('div'); notice.className = `channel-directory-notice ${this.model.notice?.kind ?? ''}`;
        notice.setAttribute('role', this.model.notice?.kind === 'error' ? 'alert' : 'status');
        notice.textContent = this.model.notice?.text ?? '';
        root.append(notice);

        if (this.model.mode !== 'reorder') this.renderToolbar(root);
        else {
            const orderActions = document.createElement('div'); orderActions.className = 'channel-directory-mode-actions';
            orderActions.append(
                this.button('Cancel', 'directory-cancel-order', () => { this.model.cancelReorder(); this.render(); }),
                this.button('Save order', 'directory-save-order', () => { void this.model.saveOrder().then(() => this.render()); }, 'channel-directory-primary'),
            );
            root.append(orderActions);
        }

        if (!this.model.canMutate) {
            const blocked = document.createElement('section'); blocked.className = 'channel-directory-empty';
            blocked.setAttribute('role', 'alert');
            blocked.textContent = `Saved channels are ${this.model.loadKind}. Retry loading or re-run setup from recovery before editing.`;
            root.append(blocked);
        } else if (this.model.channels.length === 0) {
            const empty = document.createElement('section'); empty.className = 'channel-directory-empty';
            empty.innerHTML = '<h2>No channels yet</h2><p>Generate a lineup or create a custom channel to begin.</p>';
            empty.append(
                this.button('Generate lineup', 'directory-empty-generate', () => this.ports.openGenerate(), 'channel-directory-outline'),
                this.button('Add custom', 'directory-empty-add', () => this.ports.openStudio({ kind: 'create' }), 'channel-directory-primary'),
            ); root.append(empty);
        } else if (this.model.rows.length === 0) {
            const empty = document.createElement('section'); empty.className = 'channel-directory-empty';
            empty.innerHTML = '<h2>No matching channels</h2><p>Try another name, number, or filter.</p>';
            empty.append(this.button('Clear search', 'directory-clear-search', () => {
                this.model.setQuery(''); this.model.setFilter('all'); this.render();
            })); root.append(empty);
        } else this.renderTable(root);

        if (this.dialog) this.renderDialog(root);
        if (this.positionPicker) this.renderPositionPicker(root, this.positionPicker);
        this.container.replaceChildren(root);
        this.registerFocus();
    }

    private renderToolbar(root: HTMLElement): void {
        const toolbar = document.createElement('div'); toolbar.className = 'channel-directory-toolbar';
        if (this.searchEditing) {
            const search = document.createElement('input');
            search.id = 'directory-search-edit'; search.className = 'channel-directory-search'; search.type = 'text';
            search.inputMode = 'search'; search.placeholder = 'Search by name or number';
            search.setAttribute('aria-label', 'Edit channel search'); search.value = this.model.query;
            search.addEventListener('input', () => {
                this.searchSelection = { start: search.selectionStart ?? search.value.length, end: search.selectionEnd ?? search.value.length };
                this.model.setQuery(search.value); this.focusKey = search.id;
                if (!this.composingSearch) this.render();
            });
            search.addEventListener('compositionstart', () => { this.composingSearch = true; });
            search.addEventListener('compositionend', () => {
                this.composingSearch = false;
                this.searchSelection = { start: search.selectionStart ?? search.value.length, end: search.selectionEnd ?? search.value.length };
                this.model.setQuery(search.value); this.render();
            });
            search.addEventListener('keydown', event => {
                if (event.keyCode !== 461 && event.key !== 'Escape' && event.key !== 'Enter') return;
                event.preventDefault(); event.stopPropagation();
                this.exitSearchEdit();
            });
            toolbar.append(search);
        } else {
            const search = this.button(this.model.query || 'Search by name or number', 'directory-search', () => {
                this.searchEditing = true;
                const end = this.model.query.length;
                this.searchSelection = { start: end, end };
                this.focusKey = 'directory-search-edit'; this.render();
            }, 'channel-directory-search channel-directory-search-trigger');
            search.setAttribute('aria-label', this.model.query ? `Search channels: ${this.model.query}. Select to edit.` : 'Search channels. Select to edit.');
            toolbar.append(search);
        }
        for (const filter of ['all', 'custom', 'generated'] as DirectoryFilter[]) {
            const b = this.button(filter === 'all' ? 'All' : filter === 'custom' ? 'Custom' : 'Generated', `directory-filter-${filter}`, () => {
                this.model.setFilter(filter); this.render();
            }, this.model.filter === filter ? 'selected' : '');
            b.setAttribute('aria-pressed', String(this.model.filter === filter)); toolbar.append(b);
        }
        toolbar.append(
            this.button('Select', 'directory-select', () => { this.model.beginSelection(); this.render(); }),
            this.button('Reorder channels', 'directory-reorder', () => { this.model.beginReorder(); this.render(); }),
        ); root.append(toolbar);
        if (this.model.mode === 'select') {
            const actions = document.createElement('div'); actions.className = 'channel-directory-mode-actions';
            const count = document.createElement('span'); count.textContent = `${this.model.selectedIds.size} selected`; actions.append(count);
            actions.append(
                this.button('Select all matching', 'directory-select-all', () => { this.model.selectAllMatching(); this.render(); }),
                this.button('Clear selection', 'directory-clear-selection', () => { this.model.clearSelection(); this.render(); }),
                this.button('Cancel', 'directory-cancel-selection', () => { this.model.cancelSelection(); this.render(); }),
                this.button('Delete selected', 'directory-delete-selected', () => this.confirmDelete([...this.model.selectedIds]), 'channel-directory-destructive'),
            ); root.append(actions);
        }
    }

    private renderTable(root: HTMLElement): void {
        const rows = this.model.rows;
        const media = this.scopedActiveMedia();
        const table = document.createElement('div'); table.className = `channel-directory-table ${this.model.mode}`;
        table.setAttribute('role', 'table'); table.setAttribute('aria-label', 'Channels');
        const labels = document.createElement('div'); labels.className = 'channel-directory-columns'; labels.setAttribute('role', 'row');
        for (const label of this.model.mode === 'reorder' ? ['Number', 'Channel', 'Source', 'Playback', 'Move'] : ['No.', 'Channel', 'Source', 'Playback', 'Type', '']) {
            const cell = document.createElement('span'); cell.setAttribute('role', 'columnheader'); cell.textContent = label; labels.append(cell);
        } table.append(labels);
        for (const [rowIndex, row] of rows.entries()) {
            const ch = row.channel, tr = document.createElement('div'); tr.className = 'channel-directory-row';
            tr.setAttribute('role', 'row'); tr.dataset.channelId = ch.id;
            if (this.model.selectedIds.has(ch.id)) tr.classList.add('selected');
            if (media?.channelId === ch.id) tr.classList.add('playing');
            const number = document.createElement('span'); number.className = 'channel-directory-number';
            const proposed = this.model.mode === 'reorder' ? this.model.proposedNumber(ch.id) : ch.number;
            number.textContent = this.model.mode === 'reorder' && proposed !== ch.number ? `${ch.number} → ${proposed}` : String(ch.number);
            tr.append(number);
            const nameCell = document.createElement('div'); nameCell.className = 'channel-directory-name';
            if (this.model.mode === 'select') {
                const marker = document.createElement('span'); marker.className = 'channel-directory-select-marker';
                marker.setAttribute('aria-hidden', 'true');
                marker.textContent = this.model.selectedIds.has(ch.id) ? '☑' : '☐';
                nameCell.append(marker);
            }
            const name = this.button(ch.name, this.rowId(ch.id), () => {
                this.model.setFocusedChannel(ch.id);
                if (this.model.mode === 'select') this.model.toggleSelected(ch.id);
                else if (this.model.mode === 'browse') this.ports.openStudio({ kind: 'inspect', channelId: ch.id, expectedBase: this.ports.manager.getStructuralBase() });
                this.render();
            });
            name.setAttribute('aria-label', `${this.model.selectedIds.has(ch.id) ? 'Selected, ' : ''}channel ${ch.number}, ${ch.name}`);
            nameCell.append(name);
            if (this.model.mode !== 'reorder') {
                const support = document.createElement('small'); support.className = `channel-directory-health ${row.health.kind}`;
                support.textContent = row.health.kind === 'unchecked' ? 'Not checked' : row.health.kind === 'loading' ? 'Checking…'
                    : `${row.health.kind === 'healthy' ? 'Ready' : row.health.kind === 'offair' ? 'Off air' : row.health.kind === 'stale' ? 'Stale' : 'Check failed'} · ${new Date(row.health.checkedAt).toLocaleString()} · ${row.health.detail}`;
                nameCell.append(support);
            }
            tr.append(nameCell);
            const source = document.createElement('span'); source.textContent = row.source; tr.append(source);
            const playback = document.createElement('span'); playback.textContent = row.playback; tr.append(playback);
            if (this.model.mode === 'reorder') {
                const moves = document.createElement('div'); moves.className = 'channel-directory-moves';
                const up = this.button('↑', `directory-up-${encodeURIComponent(ch.id)}`, () => { this.model.move(ch.id, -1); this.focusKey = this.rowId(ch.id); this.render(); }, 'channel-directory-icon');
                up.setAttribute('aria-label', `Move ${ch.name} up`);
                const down = this.button('↓', `directory-down-${encodeURIComponent(ch.id)}`, () => { this.model.move(ch.id, 1); this.focusKey = this.rowId(ch.id); this.render(); }, 'channel-directory-icon');
                down.setAttribute('aria-label', `Move ${ch.name} down`);
                moves.append(up, down);
                const target = this.button(`Position ${rowIndex + 1}`, `directory-target-${encodeURIComponent(ch.id)}`,
                    () => this.openPositionPicker(ch.id, rowIndex));
                target.setAttribute('aria-label', `Move ${ch.name} to position`);
                target.setAttribute('aria-haspopup', 'dialog');
                moves.append(target); tr.append(moves);
            } else {
                const type = document.createElement('span'); type.textContent = row.generated ? 'Generated' : 'Custom'; tr.append(type);
                const actions = document.createElement('div'); actions.className = 'channel-directory-row-actions';
                const more = this.button('⋮', this.rowActionId(ch.id), () => { this.menuId = this.menuId === ch.id ? null : ch.id; this.render(); }, 'channel-directory-icon');
                more.setAttribute('aria-label', `Actions for ${ch.name}`);
                actions.append(more);
                if (this.menuId === ch.id) {
                    const menu = document.createElement('div'); menu.className = 'channel-directory-menu';
                    menu.append(
                        this.button(row.generated ? 'Inspect' : 'Inspect / edit', `directory-inspect-${encodeURIComponent(ch.id)}`, () => this.ports.openStudio({ kind: 'inspect', channelId: ch.id, expectedBase: this.ports.manager.getStructuralBase() })),
                        this.button('Duplicate as custom', `directory-duplicate-${encodeURIComponent(ch.id)}`, () => this.ports.openStudio({ kind: 'duplicate', channelId: ch.id, expectedBase: this.ports.manager.getStructuralBase() })),
                        this.button('Check source', `directory-health-${encodeURIComponent(ch.id)}`, () => { void this.model.checkHealth(ch.id).then(() => this.render()); this.render(); }),
                        this.button('Delete', `directory-delete-${encodeURIComponent(ch.id)}`, () => this.confirmDelete([ch.id]), 'channel-directory-destructive'),
                    ); actions.append(menu);
                }
                tr.append(actions);
            }
            table.append(tr);
        }
        root.append(table);
    }

    private openPositionPicker(channelId: string, index: number): void {
        if (this.model.mode !== 'reorder') return;
        this.positionPicker = { channelId, base: this.ports.manager.getStructuralBase(),
            scopeKey: this.ports.getDirectoryScopeKey(), returnFocusId: this.focusKey };
        this.focusKey = `directory-position-${index}`;
        this.render();
    }

    private closePositionPicker(): void {
        if (!this.positionPicker) return;
        this.focusKey = this.positionPicker.returnFocusId;
        this.positionPicker = null;
        this.ports.navigation.closeModal(POSITION_MODAL_ID);
    }

    private isPositionPickerCurrent(picker: PositionPicker): boolean {
        const base = this.ports.manager.getStructuralBase();
        return this.model.mode === 'reorder' && picker.scopeKey === this.ports.getDirectoryScopeKey()
            && picker.base.generation === base.generation && picker.base.revision === base.revision
            && this.model.rows.some(row => row.channel.id === picker.channelId);
    }

    private renderPositionPicker(root: HTMLElement, picker: PositionPicker): void {
        const rows = this.model.rows;
        const channel = rows.find(row => row.channel.id === picker.channelId)?.channel;
        if (!channel) return;
        const overlay = document.createElement('div'); overlay.className = 'channel-directory-dialog-overlay';
        const panel = document.createElement('section'); panel.className = 'channel-directory-dialog';
        panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-labelledby', 'directory-position-title');
        const title = document.createElement('h2'); title.id = 'directory-position-title';
        title.textContent = `Move ${channel.name}`;
        const help = document.createElement('p'); help.textContent = 'Choose a position. Save order applies your changes.';
        panel.append(title, help);
        const choices = document.createElement('div'); choices.className = 'channel-directory-position-list';
        choices.setAttribute('role', 'group'); choices.setAttribute('aria-label', 'Channel position');
        rows.forEach((row, index) => {
            const choice = this.button(`Position ${index + 1}`, `directory-position-${index}`, () => {
                if (this.positionPicker !== picker) return;
                if (!this.isPositionPickerCurrent(picker)) { this.render(); return; }
                this.model.moveTo(picker.channelId, index);
                this.closePositionPicker();
                this.focusKey = this.rowId(picker.channelId);
                this.render();
            });
            choice.setAttribute('aria-pressed', String(row.channel.id === picker.channelId));
            choices.append(choice);
        });
        panel.append(choices, this.button('Cancel', 'directory-position-cancel', () => {
            this.closePositionPicker(); this.render();
        }));
        overlay.append(panel); root.append(overlay);
    }

    private confirmDelete(ids: string[]): void {
        if (ids.length === 0) return;
        this.dialog = {
            ids, base: this.ports.manager.getStructuralBase(), scopeKey: this.ports.getDirectoryScopeKey(),
            consentedMedia: this.scopedActiveMedia(), returnFocusId: this.focusKey, stale: false,
        };
        this.model.notice = null;
        this.focusKey = 'directory-delete-cancel'; this.render();
    }

    private renderDialog(root: HTMLElement): void {
        const dialog = this.dialog;
        if (!dialog) return;
        const channels = this.model.channels.filter(ch => dialog.ids.includes(ch.id));
        const activeDeleted = dialog.consentedMedia && dialog.ids.includes(dialog.consentedMedia.channelId);
        const overlay = document.createElement('div'); overlay.className = 'channel-directory-dialog-overlay';
        const panel = document.createElement('section'); panel.className = 'channel-directory-dialog'; panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'directory-delete-title');
        panel.setAttribute('aria-busy', String(this.pendingDelete));
        const h2 = document.createElement('h2'); h2.id = 'directory-delete-title'; h2.textContent = `Delete ${channels.length} channel${channels.length === 1 ? '' : 's'}?`; panel.append(h2);
        const p = document.createElement('p'); p.textContent = activeDeleted
            ? 'Playback of the tuned channel will stop after deletion. No other channel will start automatically.'
            : 'These channels will be removed from your saved lineup.'; panel.append(p);
        if (this.model.notice?.kind === 'error') {
            const error = document.createElement('p'); error.setAttribute('role', 'alert');
            error.className = 'channel-directory-dialog-error'; error.textContent = this.model.notice.text;
            panel.append(error);
        }
        const roster = document.createElement('ul'); roster.className = 'channel-directory-delete-roster';
        channels.forEach(ch => { const item = document.createElement('li'); item.textContent = `${ch.number} · ${ch.name}`; roster.append(item); });
        panel.append(roster);
        const actions = document.createElement('div'); actions.className = 'channel-directory-dialog-actions';
        actions.append(
            this.button('Keep channels', 'directory-delete-cancel', () => this.closeDialog()),
            this.button('Delete channels', 'directory-delete-confirm', () => {
                void this.applyDelete();
            }, 'channel-directory-destructive'),
        ); panel.append(actions); overlay.append(panel); root.append(overlay);
        const keep = panel.querySelector<HTMLButtonElement>('#directory-delete-cancel');
        const confirm = panel.querySelector<HTMLButtonElement>('#directory-delete-confirm');
        if (keep) keep.disabled = this.pendingDelete;
        if (confirm) confirm.disabled = this.pendingDelete || dialog.stale;
    }

    private async applyDelete(): Promise<void> {
        const dialog = this.dialog;
        if (!dialog || this.pendingDelete || dialog.stale) return;
        if (dialog.scopeKey !== this.ports.getDirectoryScopeKey()) {
            dialog.stale = true;
            this.model.notice = { kind: 'error', text: 'The server or profile changed. Close this dialog and review the current lineup.' };
            this.focusKey = 'directory-delete-cancel'; this.render(); return;
        }
        const currentMedia = this.scopedActiveMedia();
        if (!sameActiveMedia(dialog.consentedMedia, currentMedia)) {
            dialog.consentedMedia = currentMedia;
            this.model.notice = { kind: 'error', text: 'Playback changed. Review the warning and confirm again.' };
            this.focusKey = 'directory-delete-cancel'; this.render(); return;
        }
        this.pendingDelete = true; this.render();
        const result = await this.model.deleteChannels(dialog.ids, dialog.base, dialog.consentedMedia);
        if (this.dialog !== dialog) return;
        this.pendingDelete = false;
        if (result.kind === 'saved') {
            const focused = this.model.focusedChannelId;
            this.focusKey = focused ? this.rowId(focused) : 'directory-add';
            this.dialog = null;
            this.ports.navigation.closeModal(DELETE_MODAL_ID);
            if (result.openGuide) {
                try { await this.ports.openGuideAfterActiveDelete(); }
                catch {
                    this.model.notice = { kind: 'saved-warning', text: `${this.model.notice?.text ?? 'Channels deleted.'} Guide could not open; reopen it to refresh.` };
                }
            }
        } else if (this.model.notice?.text.includes('changed')) {
            dialog.stale = this.model.notice.text.includes('lineup') || this.model.notice.text.includes('selection');
            if (!dialog.stale) dialog.consentedMedia = this.scopedActiveMedia();
            this.focusKey = 'directory-delete-cancel';
        }
        this.render();
    }

    private registerFocus(): void {
        const nav = this.ports.navigation;
        const elements = this.dialog || this.positionPicker
            ? [...this.container.querySelectorAll<HTMLElement>('.channel-directory-dialog button')]
            : [...this.container.querySelectorAll<HTMLElement>('button, input, select')];
        const focusables = elements.filter(el => !(el instanceof HTMLButtonElement && el.disabled));
        this.registeredIds = syncFocusableRegistry(nav, this.registeredIds,
            focusables.map((element, index) => {
                const previous = focusables[index - 1];
                const next = focusables[index + 1];
                return {
                    id: element.id, element,
                    neighbors: {
                        ...(previous ? { up: previous.id } : {}),
                        ...(next ? { down: next.id } : {}),
                    },
                    onFocus: (): void => {
                        element.scrollIntoView({ block: 'nearest' });
                        const row = element.closest<HTMLElement>('[data-channel-id]');
                        if (row?.dataset.channelId) this.model.setFocusedChannel(row.dataset.channelId);
                        this.focusKey = element.id;
                    },
                };
            }));
        if (this.dialog) {
            nav.openModal(DELETE_MODAL_ID, ['directory-delete-cancel', 'directory-delete-confirm'], {
                dismissOnBack: !this.pendingDelete,
                blocksBackgroundCommands: true,
            });
            if (!nav.isModalOpen(DELETE_MODAL_ID)) {
                this.dialog = null;
                this.pendingDelete = false;
                this.model.notice = { kind: 'error', text: 'Delete confirmation could not open. Try again.' };
                this.render();
                return;
            }
        } else if (this.positionPicker) {
            nav.openModal(POSITION_MODAL_ID, focusables.map(element => element.id), {
                dismissOnBack: true, blocksBackgroundCommands: true,
            });
            if (!nav.isModalOpen(POSITION_MODAL_ID)) {
                this.closePositionPicker();
                this.model.notice = { kind: 'error', text: 'Position picker could not open. Try again.' };
                this.render();
                return;
            }
        }
        const preferred = this.dialog ? 'directory-delete-cancel' : this.focusKey;
        const focusedChannelId = this.model.focusedChannelId;
        const target = focusables.find(el => el.id === preferred)
            ?? (focusedChannelId ? focusables.find(el => el.id === this.rowId(focusedChannelId)) : undefined)
            ?? focusables[0];
        if (target) nav.setFocus(target.id);
        if (this.searchEditing && target instanceof HTMLInputElement && this.searchSelection) {
            target.setSelectionRange(this.searchSelection.start, this.searchSelection.end);
        }
    }
}
