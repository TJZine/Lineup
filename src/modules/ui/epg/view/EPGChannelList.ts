import { EPG_CLASSES, EPG_CONSTANTS } from '../constants';
import { appendDebugRuntimeLog, isDebugRuntimeEnabled } from '../debug/debugRuntimeGuards';
import type { EPGConfig, ChannelConfig } from '../types';
import { getChannelIdentityForDisplay } from '../../common/channelDisplay';

const CHANNEL_NAME_EXPANDED_ATTRIBUTE = 'data-channel-name-expanded';
const CHANNEL_NAME_TRUNCATION_THRESHOLD_PX = 2;

/**
 * EPG Channel List class.
 * Displays channel names in a column that syncs with grid scrolling.
 */
export class EPGChannelList {
    private containerElement: HTMLElement | null = null;
    private contentElement: HTMLElement | null = null;
    private topSpacerElement: HTMLElement | null = null;
    private bottomSpacerElement: HTMLElement | null = null;
    private config: EPGConfig | null = null;
    private channels: ChannelConfig[] = [];
    private rowElements: HTMLElement[] = [];
    private rowContentCache: WeakMap<
        HTMLElement,
        {
            number: HTMLSpanElement;
            name: HTMLSpanElement;
            primaryName: HTMLSpanElement;
            provenance: HTMLSpanElement;
            source: HTMLSpanElement;
            category: HTMLSpanElement;
            separator: HTMLSpanElement;
        }
    > = new WeakMap();
    private focusedChannelIndex: number = -1;
    private channelOffset: number = 0;
    private isVirtualized: boolean = false;
    private wrapFlashTimer: ReturnType<typeof setTimeout> | null = null;
    private nameExpansionRefreshTimer: ReturnType<typeof setTimeout> | null = null;
    private awaitingVisibleNameRail: boolean = false;
    private nameExpansionResizeObserver: ResizeObserver | null = null;

    initialize(parentElement: HTMLElement, config: EPGConfig): void {
        this.config = config;

        this.containerElement = document.createElement('div');
        this.containerElement.className = EPG_CLASSES.CHANNEL_LIST;

        if (typeof ResizeObserver !== 'undefined') {
            this.nameExpansionResizeObserver = new ResizeObserver(() => {
                this.awaitingVisibleNameRail = false;
                this.scheduleChannelNameExpansionRefresh({ force: true });
            });
            this.nameExpansionResizeObserver.observe(this.containerElement);
        }

        this.contentElement = document.createElement('div');
        this.containerElement.appendChild(this.contentElement);

        parentElement.appendChild(this.containerElement);
    }

    /**
     * Destroy the channel list and clean up resources.
     */
    destroy(): void {
        if (this.wrapFlashTimer) {
            clearTimeout(this.wrapFlashTimer);
            this.wrapFlashTimer = null;
        }
        if (this.nameExpansionRefreshTimer) {
            clearTimeout(this.nameExpansionRefreshTimer);
            this.nameExpansionRefreshTimer = null;
        }
        if (this.nameExpansionResizeObserver) {
            this.nameExpansionResizeObserver.disconnect();
            this.nameExpansionResizeObserver = null;
        }
        if (this.containerElement) {
            this.containerElement.classList.remove(EPG_CLASSES.CHANNEL_LIST_WRAP_FLASH);
        }
        if (this.containerElement) {
            this.containerElement.remove();
            this.containerElement = null;
        }
        this.contentElement = null;
        this.topSpacerElement = null;
        this.bottomSpacerElement = null;
        this.rowElements = [];
        this.rowContentCache = new WeakMap();
        this.channels = [];
        this.config = null;
        this.channelOffset = 0;
        this.isVirtualized = false;
        this.awaitingVisibleNameRail = false;
    }

    flashWrapCue(): void {
        if (!this.containerElement) return;
        this.containerElement.classList.add(EPG_CLASSES.CHANNEL_LIST_WRAP_FLASH);
        if (this.wrapFlashTimer) {
            clearTimeout(this.wrapFlashTimer);
        }
        this.wrapFlashTimer = setTimeout(() => {
            if (this.containerElement) {
                this.containerElement.classList.remove(EPG_CLASSES.CHANNEL_LIST_WRAP_FLASH);
            }
            this.wrapFlashTimer = null;
        }, 300);
    }

    updateChannels(channels: ChannelConfig[]): void {
        this.channels = channels;
        this.renderChannels();
    }

    refreshChannelNameLayouts(): void {
        if (this.nameExpansionRefreshTimer) {
            clearTimeout(this.nameExpansionRefreshTimer);
            this.nameExpansionRefreshTimer = null;
        }
        this.awaitingVisibleNameRail = false;
        this.refreshChannelNameExpansion();
    }

    private renderChannels(): void {
        if (!this.contentElement || !this.config) return;

        const shouldVirtualize = this.shouldVirtualize();
        if (shouldVirtualize) {
            if (!this.isVirtualized) {
                this.setupVirtualList();
            }
            this.renderVirtualRows();
        } else {
            this.isVirtualized = false;
            this.renderAllRows();
        }
    }

    private shouldVirtualize(): boolean {
        if (!this.config) return false;
        const visibleCount = Math.max(1, this.config.visibleChannels);
        const buffer = EPG_CONSTANTS.ROW_BUFFER;
        return this.channels.length > visibleCount + (buffer * 2);
    }

    private renderAllRows(): void {
        if (!this.contentElement) return;

        this.contentElement.replaceChildren();
        this.rowElements = [];
        this.topSpacerElement = null;
        this.bottomSpacerElement = null;

        for (let i = 0; i < this.channels.length; i++) {
            const channel = this.channels[i];
            if (!channel) continue;
            const row = this.createChannelRow();
            this.updateChannelRow(row, channel, i);
            this.contentElement.appendChild(row);
            this.rowElements.push(row);
        }

        this.applyFocusToRenderedRows();
        this.refreshChannelNameExpansion();
    }

    private setupVirtualList(): void {
        if (!this.contentElement) return;

        this.contentElement.replaceChildren();
        this.rowElements = [];

        this.topSpacerElement = document.createElement('div');
        this.bottomSpacerElement = document.createElement('div');

        this.contentElement.appendChild(this.topSpacerElement);
        this.contentElement.appendChild(this.bottomSpacerElement);

        this.isVirtualized = true;
    }

    private renderVirtualRows(): void {
        if (!this.contentElement || !this.config || !this.topSpacerElement || !this.bottomSpacerElement) return;

        const totalChannels = this.channels.length;
        if (totalChannels === 0) {
            this.ensureRowPool(0);
            this.topSpacerElement.style.height = '0px';
            this.bottomSpacerElement.style.height = '0px';
            return;
        }

        const visibleCount = Math.max(1, this.config.visibleChannels);
        const buffer = EPG_CONSTANTS.ROW_BUFFER;
        const desiredCount = Math.min(totalChannels, visibleCount + (buffer * 2));
        const maxStart = Math.max(0, totalChannels - desiredCount);
        const startIndex = Math.max(0, Math.min(this.channelOffset - buffer, maxStart));
        const endIndex = Math.min(totalChannels, startIndex + desiredCount);

        this.ensureRowPool(endIndex - startIndex);

        this.topSpacerElement.style.height = `${startIndex * this.config.rowHeight}px`;
        this.bottomSpacerElement.style.height = `${(totalChannels - endIndex) * this.config.rowHeight}px`;

        for (let slotIndex = 0; slotIndex < this.rowElements.length; slotIndex++) {
            const channelIndex = startIndex + slotIndex;
            const channel = this.channels[channelIndex];
            const row = this.rowElements[slotIndex];
            if (!row) continue;
            if (channel) {
                row.style.display = '';
                this.updateChannelRow(row, channel, channelIndex);
            } else {
                row.style.display = 'none';
                row.removeAttribute(CHANNEL_NAME_EXPANDED_ATTRIBUTE);
                row.dataset.channelIndex = '';
            }
        }

        this.applyFocusToRenderedRows();
        this.refreshChannelNameExpansion();
    }

    private createChannelRow(): HTMLElement {
        const row = document.createElement('div');
        row.className = EPG_CLASSES.CHANNEL_ROW;

        const number = document.createElement('span');
        number.className = EPG_CLASSES.CHANNEL_NUMBER;

        const name = document.createElement('span');
        name.className = EPG_CLASSES.CHANNEL_NAME;
        const primaryName = document.createElement('span');
        primaryName.className = EPG_CLASSES.CHANNEL_NAME_PRIMARY;
        const provenance = document.createElement('span');
        provenance.className = EPG_CLASSES.CHANNEL_NAME_PROVENANCE;
        provenance.hidden = true;
        const source = document.createElement('span');
        source.className = EPG_CLASSES.CHANNEL_NAME_SOURCE;
        source.hidden = true;
        const category = document.createElement('span');
        category.className = EPG_CLASSES.CHANNEL_NAME_CATEGORY;
        category.hidden = true;
        const separator = document.createElement('span');
        separator.className = EPG_CLASSES.CHANNEL_NAME_SEPARATOR;
        separator.textContent = '·';
        separator.hidden = true;
        provenance.append(category, separator, source);
        name.append(primaryName, provenance);

        row.append(number, name);
        this.rowContentCache.set(row, {
            number,
            name,
            primaryName,
            provenance,
            source,
            category,
            separator,
        });
        return row;
    }

    private updateChannelRow(row: HTMLElement, channel: ChannelConfig, channelIndex: number): void {
        const cached = this.rowContentCache.get(row);
        if (!cached) {
            return;
        }
        row.removeAttribute(CHANNEL_NAME_EXPANDED_ATTRIBUTE);
        row.dataset.channelIndex = channelIndex.toString();
        const displayIdentity = getChannelIdentityForDisplay({
            name: channel.name,
            sourceLibraryName: channel.sourceLibraryName ?? null,
            buildStrategy: channel.buildStrategy ?? null,
        });

        if (this.config) {
            row.style.height = `${this.config.rowHeight}px`;
        }

        const channelNumber = channel.number.toString();
        if (cached.number.textContent !== channelNumber) {
            cached.number.textContent = channelNumber;
        }
        if (cached.primaryName.textContent !== displayIdentity.primaryName) {
            cached.primaryName.textContent = displayIdentity.primaryName;
        }
        if (displayIdentity.sourceText) {
            if (cached.source.textContent !== displayIdentity.sourceText) {
                cached.source.textContent = displayIdentity.sourceText;
            }
            cached.source.hidden = false;
        } else {
            if (cached.source.textContent !== '') {
                cached.source.textContent = '';
            }
            cached.source.hidden = true;
        }
        if (displayIdentity.categoryText) {
            if (cached.category.textContent !== displayIdentity.categoryText) {
                cached.category.textContent = displayIdentity.categoryText;
            }
            cached.category.hidden = false;
        } else {
            if (cached.category.textContent !== '') {
                cached.category.textContent = '';
            }
            cached.category.hidden = true;
        }
        const shouldShowSeparator = !!(displayIdentity.categoryText && displayIdentity.sourceText);
        cached.separator.textContent = shouldShowSeparator ? '·' : '';
        cached.separator.hidden = !shouldShowSeparator;
        if (displayIdentity.sourceText || displayIdentity.categoryText) {
            cached.provenance.hidden = false;
            cached.name.setAttribute('aria-label', [
                displayIdentity.primaryName,
                displayIdentity.categoryText,
                displayIdentity.sourceText,
            ].filter((part): part is string => part !== null).join(', '));
        } else {
            cached.provenance.hidden = true;
            cached.name.removeAttribute('aria-label');
        }

        if (channelIndex === this.focusedChannelIndex) {
            row.classList.add('focused');
        } else {
            row.classList.remove('focused');
        }
    }

    private refreshChannelNameExpansion(): void {
        if (!this.contentElement) return;

        let shouldRetryWhenVisible = false;

        for (const row of this.rowElements) {
            if (row.style.display === 'none') {
                row.removeAttribute(CHANNEL_NAME_EXPANDED_ATTRIBUTE);
                continue;
            }

            const cached = this.rowContentCache.get(row);
            if (!cached) {
                row.removeAttribute(CHANNEL_NAME_EXPANDED_ATTRIBUTE);
                continue;
            }

            row.removeAttribute(CHANNEL_NAME_EXPANDED_ATTRIBUTE);

            const visibleWidth = cached.primaryName.clientWidth;
            if (visibleWidth <= 0) {
                shouldRetryWhenVisible = true;
                continue;
            }

            const singleLineWidth = cached.primaryName.scrollWidth;
            if (singleLineWidth > visibleWidth + CHANNEL_NAME_TRUNCATION_THRESHOLD_PX) {
                row.setAttribute(CHANNEL_NAME_EXPANDED_ATTRIBUTE, 'true');
            }
        }

        if (shouldRetryWhenVisible) {
            this.scheduleChannelNameExpansionRefresh();
        }
    }

    private scheduleChannelNameExpansionRefresh(options?: { force?: boolean }): void {
        if (this.nameExpansionRefreshTimer) return;
        if (this.awaitingVisibleNameRail && !options?.force) return;

        if (!options?.force) {
            this.awaitingVisibleNameRail = true;
        }

        this.nameExpansionRefreshTimer = setTimeout(() => {
            this.nameExpansionRefreshTimer = null;
            this.refreshChannelNameExpansion();
        }, 0);
    }

    private ensureRowPool(count: number): void {
        if (!this.contentElement || !this.bottomSpacerElement) return;

        while (this.rowElements.length < count) {
            const row = this.createChannelRow();
            this.contentElement.insertBefore(row, this.bottomSpacerElement);
            this.rowElements.push(row);
        }

        while (this.rowElements.length > count) {
            const row = this.rowElements.pop();
            if (row) {
                row.remove();
            }
        }
    }

    private applyFocusToRenderedRows(): void {
        for (const row of this.rowElements) {
            const rawIndex = row.dataset.channelIndex;
            if (!rawIndex) {
                row.classList.remove('focused');
                continue;
            }
            const index = Number(rawIndex);
            if (Number.isFinite(index) && index === this.focusedChannelIndex) {
                row.classList.add('focused');
            } else {
                row.classList.remove('focused');
            }
        }
    }

    updateScrollPosition(channelOffset: number): void {
        if (!this.contentElement || !this.config) return;

        if (channelOffset === this.channelOffset) {
            return;
        }
        this.channelOffset = channelOffset;
        const translateY = -(channelOffset * this.config.rowHeight);
        this.contentElement.style.transform = `translateY(${translateY}px)`;

        if (this.isVirtualized) {
            this.renderVirtualRows();
        }

        this.logDebugState(channelOffset);
    }

    /**
     * Set the focused channel.
     *
     * @param index - Channel index to focus (-1 to clear)
     */
    setFocusedChannel(index: number): void {
        this.focusedChannelIndex = index;
        this.applyFocusToRenderedRows();
    }

    getChannel(index: number): ChannelConfig | null {
        if (index >= 0 && index < this.channels.length) {
            const channel = this.channels[index];
            return channel !== undefined ? channel : null;
        }
        return null;
    }

    getChannelCount(): number {
        return this.channels.length;
    }

    private logDebugState(channelOffset: number): void {
        const debugRuntime = this.config?.debugRuntime;
        const shouldLog = isDebugRuntimeEnabled(debugRuntime);

        if (!shouldLog || !this.contentElement) return;

        const payload = {
            channelOffset,
            transform: this.contentElement.style.transform,
            renderedRows: this.rowElements.length,
        };
        appendDebugRuntimeLog(debugRuntime, 'EPGChannelList.scroll', payload);
    }
}
