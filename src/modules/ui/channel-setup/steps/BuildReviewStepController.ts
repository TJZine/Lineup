import type { KeyEvent, INavigationManager } from '../../../navigation';
import type { ChannelSetupCandidateRow } from '../../../../core/channel-setup/build/ChannelSetupPreparedCandidate';
import type { ChannelSetupReview } from '../../../../core/channel-setup/types';
import { formatChannelSetupUserCopy, formatChannelSetupWarningCopy } from '../ChannelSetupUserCopy';
import type { StepRenderContext } from '../stepContracts';
import type { BuildReviewDeps } from './types';
import { ReviewRowHeightModel } from './ReviewRowHeightModel';

const WINDOW_SIZE = 24;
type Filter = 'all' | 'created' | 'changed' | 'removed';

function button(id: string, label: string, onClick: () => void, secondary = false): HTMLButtonElement {
    const element = document.createElement('button');
    element.id = id;
    element.type = 'button';
    element.className = `screen-button${secondary ? ' secondary' : ''}`;
    element.textContent = label;
    element.addEventListener('click', onClick);
    return element;
}

export class BuildReviewStepController {
    private _reviewId: string | null = null;
    private _filter: Filter = 'all';
    private _query = '';
    private _windowStart = 0;
    private _expandedId: string | null = null;
    private _rememberedRowId: string | null = null;
    private _editingSearch = false;
    private _render: (() => void) | null = null;
    private readonly _heightModel = new ReviewRowHeightModel();
    private _scrollAnchor: { id: string; offset: number } | null = null;
    private _rowStartOffset = 48;
    private _resizeObserver: ResizeObserver | null = null;
    private _resizeFallback: (() => void) | null = null;
    private _removeFontListener: (() => void) | null = null;
    private _roster: HTMLElement | null = null;

    reset(): void {
        this._stopMeasuring();
        this._heightModel.reset();
        this._reviewId = null;
        this._filter = 'all';
        this._query = '';
        this._windowStart = 0;
        this._expandedId = null;
        this._rememberedRowId = null;
        this._editingSearch = false;
        this._scrollAnchor = null;
        this._rowStartOffset = 48;
        this._roster = null;
    }

    handleKeyPress(event: KeyEvent, nav: INavigationManager): void {
        if (event.handled) return;
        const id = nav.getFocusedElement()?.id ?? '';
        if (id === 'setup-review-search') {
            if (event.button === 'back' && this._editingSearch) {
                event.handled = true;
                this._editingSearch = false;
                (document.getElementById(id) as HTMLInputElement | null)?.blur();
                nav.setFocus(id);
            } else if (event.button === 'ok') {
                event.handled = true;
                this._editingSearch = true;
                (document.getElementById(id) as HTMLInputElement | null)?.focus();
            }
            return;
        }
        const row = document.getElementById(id);
        if (row?.classList.contains('setup-review-row')) {
            const rows = this._visibleRows();
            const index = rows.findIndex((item) => this._rowId(item) === id);
            if (index < 0) return;
            this._rememberedRowId = id;
            if (event.button === 'back' && this._expandedId === rows[index]?.channelId) {
                event.handled = true;
                this._rememberCurrentScroll();
                this._heightModel.forget(id);
                this._expandedId = null;
                this._render?.();
                nav.setFocus(id);
                return;
            }
            if (event.button === 'right') {
                event.handled = true;
                if (!event.isRepeat && !event.isLongPress) nav.setFocus(this._footerActionId());
                return;
            }
            if (event.button === 'up' || event.button === 'down') {
                const next = index + (event.button === 'up' ? -1 : 1);
                if (next < 0 || next >= rows.length) return;
                event.handled = true;
                this._rememberCurrentScroll();
                this._windowStart = Math.max(0, Math.min(next - 6, Math.max(0, rows.length - WINDOW_SIZE)));
                this._render?.();
                const target = rows[next];
                if (target) nav.setFocus(this._rowId(target));
            }
            return;
        }
        if (id === this._footerActionId() && event.button === 'up' && this._rememberedRowId) {
            event.handled = true;
            if (!event.isRepeat && !event.isLongPress) {
                const rows = this._visibleRows();
                const index = rows.findIndex((item) => this._rowId(item) === this._rememberedRowId);
                if (index >= 0) {
                    this._scrollAnchor = { id: this._rememberedRowId, offset: 0 };
                    this._windowStart = Math.max(0, Math.min(index - 6, Math.max(0, rows.length - WINDOW_SIZE)));
                    this._render?.();
                    nav.setFocus(this._rememberedRowId);
                }
            }
        }
    }

    private _review: ChannelSetupReview | null = null;
    private _stale = false;
    private _applyEnabled = false;

    private _visibleRows(): ChannelSetupCandidateRow[] {
        const query = this._query.trim().toLocaleLowerCase();
        return (this._review?.rows ?? []).filter((row) =>
            (this._filter === 'all' || row.action === this._filter)
            && (!query || `${row.number} ${row.name} ${row.sourceLibraryId ?? ''} ${row.sourceKind}`.toLocaleLowerCase().includes(query)));
    }

    private _rowId(row: ChannelSetupCandidateRow): string {
        return `setup-review-row-${row.channelId.replace(/[^a-zA-Z0-9_-]/g, '_')}-${row.action}`;
    }

    private _footerActionId(): string {
        return this._applyEnabled && !this._stale ? 'setup-confirm' : 'setup-back';
    }

    private _stopMeasuring(): void {
        this._resizeObserver?.disconnect();
        this._resizeObserver = null;
        if (this._resizeFallback) window.removeEventListener('resize', this._resizeFallback);
        this._resizeFallback = null;
        this._removeFontListener?.();
        this._removeFontListener = null;
    }

    private _anchorFor(roster: HTMLElement, ids: readonly string[]): { id: string; offset: number } | null {
        if (ids.length === 0) return null;
        const offsets = this._heightModel.offsets(ids);
        const position = Math.max(0, roster.scrollTop - this._rowStartOffset);
        const index = this._heightModel.indexAt(offsets, position);
        return { id: ids[index]!, offset: position - offsets[index]! };
    }

    private _rememberCurrentScroll(): void {
        const roster = this._roster;
        if (roster) this._scrollAnchor = this._anchorFor(roster, this._visibleRows().map((row) => this._rowId(row)));
    }

    private _createRowEntry(row: ChannelSetupCandidateRow, interactive: boolean,
        focusables?: HTMLButtonElement[], onExpand?: () => void): HTMLElement {
        const entry = document.createElement('div');
        entry.className = 'setup-review-entry';
        const item = button(interactive ? this._rowId(row) : '', '', () => {
            if (interactive) onExpand?.();
        }, true);
        if (!interactive) {
            item.removeAttribute('id');
            item.tabIndex = -1;
        }
        item.classList.add('setup-review-row');
        for (const text of [String(row.number), row.name, row.sourceLibraryId ?? row.sourceKind,
            `${row.playbackMode}${row.blockSize ? ` · ${row.blockSize}` : ''}`, row.action]) {
            const cell = document.createElement('span');
            cell.textContent = text;
            item.appendChild(cell);
        }
        item.setAttribute('aria-expanded', String(this._expandedId === row.channelId));
        entry.appendChild(item);
        if (interactive) focusables?.push(item);
        else entry.setAttribute('aria-hidden', 'true');
        if (this._expandedId === row.channelId) {
            const detail = document.createElement('p');
            detail.className = 'setup-review-row-detail';
            detail.textContent = `ID ${row.channelId} · ${row.sourceKind} · ${row.sourceLibraryIds.join(', ') || 'no library'} · ${row.reason} · Seed ${row.shuffleSeed ?? 'auto'} · Anchor ${row.scheduleAnchorMode === 'fixed' ? new Date(row.startTimeAnchor).toLocaleString() : 'Automatic daily'}`;
            entry.appendChild(detail);
        }
        return entry;
    }

    private _installMeasurements(roster: HTMLElement, heading: HTMLElement,
        rows: readonly ChannelSetupCandidateRow[], entries: readonly { id: string; element: HTMLElement }[],
        before: HTMLElement, after: HTMLElement, deps: BuildReviewDeps): void {
        const ids = rows.map((row) => this._rowId(row));
        this._roster = roster;
        const restoreAnchor = (anchor: { id: string; offset: number } | null, offsets: readonly number[]): void => {
            if (!anchor) return;
            const index = ids.indexOf(anchor.id);
            if (index >= 0) roster.scrollTop = this._rowStartOffset + offsets[index]! + anchor.offset;
        };
        const measure = (forceAll = false): void => {
            const anchor = this._scrollAnchor ?? this._anchorFor(roster, ids);
            const widthChanged = this._heightModel.setWidth(roster.clientWidth);
            let changed = widthChanged;
            const rosterStyle = getComputedStyle(roster);
            const headingHeight = heading.getBoundingClientRect().height || heading.offsetHeight;
            const rowStartOffset = headingHeight + (Number.parseFloat(rosterStyle.paddingTop) || 0);
            if (headingHeight > 0 && rowStartOffset !== this._rowStartOffset) {
                this._rowStartOffset = rowStartOffset;
                changed = true;
            }
            const mountedHeights = entries.map(({ id, element }) => ({ id,
                height: element.getBoundingClientRect().height || element.offsetHeight }));
            const mountedChanged = mountedHeights.some(({ id, height }) =>
                this._heightModel.has(id) && this._heightModel.measure(id, height));
            if (forceAll || mountedChanged) {
                // Font swaps can change every cached row while only 24 are mounted.
                this._heightModel.clearHeights();
                changed = true;
            }
            for (const { id, height } of mountedHeights) {
                changed = this._heightModel.measure(id, height) || changed;
            }
            // Measure the remaining rows at the same width in transient 24-row batches.
            // Only the current 24 interactive rows remain mounted after this pass.
            const probe = document.createElement('div');
            probe.className = 'setup-review-measure-probe';
            const paddingLeft = Number.parseFloat(rosterStyle.paddingLeft) || 0;
            const paddingRight = Number.parseFloat(rosterStyle.paddingRight) || 0;
            probe.style.left = `${paddingLeft}px`;
            probe.style.width = `${Math.max(0, roster.clientWidth - paddingLeft - paddingRight)}px`;
            roster.appendChild(probe);
            for (let start = 0; start < rows.length; start += WINDOW_SIZE) {
                const pending = rows.slice(start, start + WINDOW_SIZE).filter((row) => !this._heightModel.has(this._rowId(row)));
                if (pending.length === 0) continue;
                const samples = pending.map((row) => this._createRowEntry(row, false));
                probe.replaceChildren(...samples);
                for (let index = 0; index < pending.length; index++) {
                    const sample = samples[index]!;
                    const height = sample.getBoundingClientRect().height || sample.offsetHeight;
                    changed = this._heightModel.measure(this._rowId(pending[index]!), height) || changed;
                }
            }
            probe.remove();
            if (!changed) return;
            const offsets = this._heightModel.offsets(ids);
            before.style.height = `${offsets[this._windowStart]}px`;
            after.style.height = `${offsets[ids.length]! - offsets[Math.min(ids.length, this._windowStart + WINDOW_SIZE)]!}px`;
            restoreAnchor(anchor, offsets);
            this._scrollAnchor = anchor;
        };
        measure();
        roster.addEventListener('scroll', () => {
            const offsets = this._heightModel.offsets(ids);
            const index = this._heightModel.indexAt(offsets, roster.scrollTop - this._rowStartOffset);
            this._scrollAnchor = this._anchorFor(roster, ids);
            const nextStart = Math.max(0, Math.min(index - 4, Math.max(0, rows.length - WINDOW_SIZE)));
            if (nextStart === this._windowStart) return;
            this._windowStart = nextStart;
            deps.renderStep();
        });
        if (typeof ResizeObserver !== 'undefined') {
            this._resizeObserver = new ResizeObserver(() => measure());
            this._resizeObserver.observe(roster);
            for (const { element } of entries) this._resizeObserver.observe(element);
        } else {
            this._resizeFallback = (): void => measure(true);
            window.addEventListener('resize', this._resizeFallback);
        }
        const fonts = document.fonts;
        if (fonts) {
            const onFontLoad = (): void => {
                if (this._roster === roster) measure(true);
            };
            fonts.addEventListener('loadingdone', onFontLoad);
            this._removeFontListener = (): void => fonts.removeEventListener('loadingdone', onFontLoad);
            if (fonts.status === 'loading') void fonts.ready.then(onFontLoad);
        }
        restoreAnchor(this._scrollAnchor, this._heightModel.offsets(ids));
    }

    render(ctx: StepRenderContext, deps: BuildReviewDeps): void {
        this._stopMeasuring();
        this._roster = null;
        const state = deps.state;
        const review = state.review;
        if ((review?.preparedId ?? null) !== this._reviewId) {
            this.reset();
            this._reviewId = review?.preparedId ?? null;
        }
        this._review = review;
        this._stale = state.isStale;
        this._render = deps.renderStep;
        ctx.stepEl.textContent = '3 Review';
        ctx.statusEl.textContent = 'Review your lineup';
        ctx.detailEl.textContent = 'Check what changes and what stays before applying.';
        ctx.errorEl.textContent = state.reviewError ?? '';

        const body = document.createElement('div');
        body.className = 'setup-review-stage';
        const focusables: HTMLButtonElement[] = [];
        let measurement: { roster: HTMLElement; heading: HTMLElement; rows: ChannelSetupCandidateRow[];
            entries: { id: string; element: HTMLElement }[]; before: HTMLElement; after: HTMLElement } | null = null;
        if (!review) {
            const message = document.createElement('p');
            message.textContent = state.isReviewLoading ? 'Preparing authoritative Review…'
                : state.reviewError ?? 'Review is unavailable. Scan the selected libraries or refresh Review.';
            body.appendChild(message);
        } else {
            const rows = review.rows ?? [];
            const counts = {
                created: rows.filter((row) => row.action === 'created').length,
                retained: rows.filter((row) => row.action === 'retained').length,
                changed: rows.filter((row) => row.action === 'changed').length,
                removed: rows.filter((row) => row.action === 'removed').length,
            };
            const summary = document.createElement('div');
            summary.className = 'setup-review-summary';
            const afterCount = counts.created + counts.retained + counts.changed;
            summary.textContent = `${afterCount} channels after this update · ${counts.retained} retained · ${counts.changed} changed · ${counts.created} added · ${counts.removed} removed · ${state.buildMode}`;
            body.appendChild(summary);
            const inventory = review.inventory;
            if (inventory) {
                const facts = document.createElement('p');
                const ready = inventory.libraries.filter((fact) => fact.status === 'ready').map((fact) => fact.libraryName);
                const incomplete = inventory.libraries.filter((fact) => fact.status !== 'ready').map((fact) => `${fact.libraryName} (${fact.status})`);
                facts.className = 'setup-review-inventory';
                facts.textContent = `Ready: ${ready.join(', ') || 'none'} · Incomplete: ${incomplete.join(', ') || 'none'}. Existing channels with unknown evidence stay in the lineup.`;
                body.appendChild(facts);
            }
            if (review.preview.warnings.length > 0) {
                const warnings = document.createElement('div');
                warnings.className = 'setup-preview-warnings';
                deps.renderCappedWarnings(review.preview.warnings.map(formatChannelSetupWarningCopy), warnings);
                body.appendChild(warnings);
            }
            if (state.isStale || review.preview.status === 'blocked') {
                const stale = document.createElement('div');
                stale.className = 'setup-review-stale';
                stale.textContent = state.isStale
                    ? 'Review is out of date. The lineup or accepted scan changed. Refresh Review before applying; nothing was saved.'
                    : review.preview.message ? formatChannelSetupUserCopy(review.preview.message, 'review')
                        : 'Review cannot be applied. Change Configure choices and refresh Review.';
                body.appendChild(stale);
            }
            const toolbar = document.createElement('div');
            toolbar.className = 'setup-review-toolbar';
            const search = document.createElement('input');
            search.id = 'setup-review-search';
            search.type = 'search';
            search.placeholder = 'Search channels by name or number';
            search.setAttribute('aria-label', search.placeholder);
            search.value = this._query;
            search.addEventListener('input', () => {
                this._query = search.value;
                this._windowStart = 0;
                this._scrollAnchor = null;
                this._rememberedRowId = null;
                deps.setPreferredFocusId(search.id);
                const caret = search.selectionStart;
                deps.renderStep();
                const next = document.getElementById(search.id);
                if (next instanceof HTMLInputElement) {
                    next.focus();
                    if (caret !== null) next.setSelectionRange(caret, caret);
                }
            });
            toolbar.appendChild(search);
            for (const filter of ['all', 'created', 'changed', 'removed'] as const) {
                const filterButton = button(`setup-filter-${filter}`, filter === 'created' ? 'Added' : filter.charAt(0).toUpperCase() + filter.slice(1), () => {
                    this._filter = filter;
                    this._windowStart = 0;
                    this._scrollAnchor = null;
                    this._rememberedRowId = null;
                    deps.setPreferredFocusId(`setup-filter-${filter}`);
                    deps.renderStep();
                }, true);
                filterButton.setAttribute('aria-pressed', String(this._filter === filter));
                toolbar.appendChild(filterButton);
                focusables.push(filterButton);
            }
            body.appendChild(toolbar);
            const visible = this._visibleRows();
            const count = document.createElement('p');
            count.className = 'setup-review-count';
            count.textContent = `${visible.length} of ${rows.length} reviewed channels`;
            body.appendChild(count);
            const roster = document.createElement('div');
            const heading = document.createElement('div');
            heading.className = 'setup-review-roster-heading';
            for (const label of ['No.', 'Channel', 'Source', 'Playback', 'Change']) {
                const column = document.createElement('span');
                column.textContent = label;
                heading.appendChild(column);
            }
            roster.appendChild(heading);
            roster.className = 'setup-review-roster setup-focus-safe-scroll';
            roster.setAttribute('role', 'list');
            let mountedRows: { id: string; element: HTMLElement }[] = [];
            let before: HTMLElement | null = null;
            let after: HTMLElement | null = null;
            if (visible.length === 0) {
                const empty = document.createElement('div');
                empty.textContent = 'No matching channels.';
                const clear = button('setup-clear-search', 'Clear search', () => {
                    this._query = '';
                    this._filter = 'all';
                    deps.setPreferredFocusId('setup-review-search');
                    deps.renderStep();
                }, true);
                roster.append(empty, clear);
                focusables.push(clear);
            } else {
                this._windowStart = Math.min(this._windowStart, Math.max(0, visible.length - WINDOW_SIZE));
                const slice = visible.slice(this._windowStart, this._windowStart + WINDOW_SIZE);
                const offsets = this._heightModel.offsets(visible.map((row) => this._rowId(row)));
                before = document.createElement('div');
                before.className = 'setup-review-virtual-space';
                before.style.height = `${offsets[this._windowStart]}px`;
                roster.appendChild(before);
                for (const row of slice) {
                    const entry = this._createRowEntry(row, true, focusables, () => {
                        this._rememberCurrentScroll();
                        this._expandedId = this._expandedId === row.channelId ? null : row.channelId;
                        this._heightModel.forget(this._rowId(row));
                        this._rememberedRowId = this._rowId(row);
                        deps.setPreferredFocusId(this._rowId(row));
                        deps.renderStep();
                    });
                    roster.appendChild(entry);
                    mountedRows.push({ id: this._rowId(row), element: entry });
                }
                after = document.createElement('div');
                after.className = 'setup-review-virtual-space';
                after.style.height = `${offsets[visible.length]! - offsets[this._windowStart + slice.length]!}px`;
                roster.appendChild(after);
            }
            body.appendChild(roster);
            if (before && after) measurement = { roster, heading, rows: visible, entries: mountedRows, before, after };
            if (counts.removed > 0) {
                const consent = button('setup-replace-confirm', state.replaceConfirm ? 'Removals confirmed for this Review' : `Confirm removal of ${counts.removed} channels`, () => deps.onToggleReplaceConfirm('setup-replace-confirm'), true);
                consent.setAttribute('aria-pressed', String(state.replaceConfirm));
                body.appendChild(consent);
                focusables.push(consent);
            }
            if (review.requiresWholeLineupReplacement) {
                const warning = document.createElement('p');
                warning.className = 'setup-review-protected-warning';
                warning.textContent = 'Previous lineup details unavailable. Applying this Review will replace the saved lineup.';
                body.appendChild(warning);
                const oldCount = review.oldChannelCount === null ? 'unknown' : String(review.oldChannelCount ?? 'unknown');
                const consent = button('setup-whole-lineup-confirm', state.wholeLineupReplacementConfirm
                    ? 'Protected lineup replacement confirmed' : `Replace unreadable protected lineup (${oldCount} existing channels)`,
                () => deps.onToggleWholeLineupReplacementConfirm('setup-whole-lineup-confirm'), true);
                consent.setAttribute('aria-pressed', String(state.wholeLineupReplacementConfirm));
                body.appendChild(consent);
                focusables.push(consent);
            }
            this._applyEnabled = Boolean(review.preparedId && review.inventory && review.preview.status !== 'blocked' && review.preview.status !== 'slow'
                && !state.isStale && !state.isReviewLoading
                && (counts.removed === 0 || state.replaceConfirm)
                && (!review.requiresWholeLineupReplacement || state.wholeLineupReplacementConfirm));
        }
        ctx.contentEl.appendChild(body);
        if (measurement) this._installMeasurements(measurement.roster, measurement.heading,
            measurement.rows, measurement.entries, measurement.before, measurement.after, deps);
        const footer = document.createElement('div');
        footer.className = 'button-row setup-review-footer';
        const back = button('setup-back', 'Back to Configure', deps.onBackToStrategy, true);
        footer.appendChild(back);
        const refresh = button('setup-refresh-review', 'Refresh Review', deps.onRefreshReview, true);
        footer.appendChild(refresh);
        const applyLabel = review?.requiresWholeLineupReplacement ? 'Replace saved lineup'
            : review?.diff.summary.created === 0 && review?.diff.summary.removed === 0
                && !review?.rows?.some((row) => row.action === 'changed') ? 'Open Guide' : 'Apply reviewed lineup';
        const apply = button('setup-confirm', applyLabel, deps.onConfirmBuild);
        if (review?.requiresWholeLineupReplacement) apply.classList.add('destructive', 'setup-review-destructive');
        apply.disabled = !this._applyEnabled;
        footer.appendChild(apply);
        ctx.contentEl.appendChild(footer);
        if (state.isStale) deps.setPreferredFocusId('setup-refresh-review');
        deps.registerLinearFocusables([...Array.from(body.querySelectorAll<HTMLInputElement>('input')), ...focusables, back, refresh, apply]);
    }
}
