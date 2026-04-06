/**
 * @fileoverview EPG Channel List - Channel column showing channel names
 * @module modules/ui/epg/EPGChannelList
 * @version 1.0.0
 */

import { EPG_CLASSES, EPG_CONSTANTS } from '../constants';
import { appendDebugRuntimeLog, isDebugRuntimeEnabled } from '../debugRuntimeGuards';
import type { EPGConfig, ChannelConfig } from '../types';
import { getChannelNameForDisplay } from '../../channelDisplay';

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
        }
    > = new WeakMap();
    private focusedChannelIndex: number = -1;
    private channelOffset: number = 0;
    private isVirtualized: boolean = false;
    private wrapFlashTimer: ReturnType<typeof setTimeout> | null = null;
    private _categoryColorsEnabled = true;

    /**
     * Initialize the channel list.
     *
     * @param parentElement - Parent element to append channel list to
     * @param config - EPG configuration
     */
    initialize(parentElement: HTMLElement, config: EPGConfig): void {
        this.config = config;

        this.containerElement = document.createElement('div');
        this.containerElement.className = EPG_CLASSES.CHANNEL_LIST;

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
    }

    setCategoryColorsEnabled(enabled: boolean): void {
        this._categoryColorsEnabled = enabled;
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

    /**
     * Update the channel list.
     *
     * @param channels - Array of channel configurations
     */
    updateChannels(channels: ChannelConfig[]): void {
        this.channels = channels;
        this.renderChannels();
    }

    /**
     * Render channel rows.
     */
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
                row.dataset.channelIndex = '';
            }
        }

        this.applyFocusToRenderedRows();
    }

    /**
     * Create a channel row element.
     *
     * @returns The row element
     */
    private createChannelRow(): HTMLElement {
        const row = document.createElement('div');
        row.className = EPG_CLASSES.CHANNEL_ROW;

        const number = document.createElement('span');
        number.className = EPG_CLASSES.CHANNEL_NUMBER;

        const name = document.createElement('span');
        name.className = EPG_CLASSES.CHANNEL_NAME;

        row.append(number, name);
        this.rowContentCache.set(row, {
            number,
            name,
        });
        return row;
    }

    private updateChannelRow(row: HTMLElement, channel: ChannelConfig, channelIndex: number): void {
        const cached = this.rowContentCache.get(row);
        if (!cached) {
            return;
        }
        row.dataset.channelIndex = channelIndex.toString();
        const displayName = getChannelNameForDisplay({
            name: channel.name,
            sourceLibraryName: channel.sourceLibraryName ?? null,
        });

        // Category colors: only apply when enabled AND when no custom color is used.
        // Note: rows are recycled; always clear stale dataset when not applying.
        if (!this._categoryColorsEnabled) {
            if (row.dataset.buildStrategy) {
                delete row.dataset.buildStrategy;
            }
        } else if (channel.buildStrategy) {
            row.dataset.buildStrategy = channel.buildStrategy;
        } else {
            if (row.dataset.buildStrategy) {
                delete row.dataset.buildStrategy;
            }
        }

        if (this.config) {
            row.style.height = `${this.config.rowHeight}px`;
        }

        const channelNumber = channel.number.toString();
        if (cached.number.textContent !== channelNumber) {
            cached.number.textContent = channelNumber;
        }
        if (cached.name.textContent !== displayName) {
            cached.name.textContent = displayName;
        }

        row.style.borderLeftColor = '';
        row.style.borderLeftWidth = '';
        row.style.borderLeftStyle = '';

        // Apply color if set - validate to prevent CSS injection
        if (channel.color) {
            const supports = typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
                ? CSS.supports('color', channel.color)
                : null;
            // Fallback: safe color formats if CSS.supports is unavailable.
            const fallbackIsValidColor = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(channel.color) ||
                /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i.test(channel.color) ||
                /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*[\d.]+\s*\)$/i.test(channel.color) ||
                /^[a-z]+$/i.test(channel.color); // Named colors (no spaces/special chars)
            const isValidColor = supports === null ? fallbackIsValidColor : supports;
            if (isValidColor) {
                row.style.borderLeftColor = channel.color;
                row.style.borderLeftWidth = '4px';
                row.style.borderLeftStyle = 'solid';
                if (row.dataset.buildStrategy) {
                    delete row.dataset.buildStrategy;
                }
            }
        }

        if (channelIndex === this.focusedChannelIndex) {
            row.classList.add('focused');
        } else {
            row.classList.remove('focused');
        }
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

    /**
     * Update scroll position to sync with grid.
     *
     * @param channelOffset - First visible channel index
     */
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

    /**
     * Get channel at index.
     *
     * @param index - Channel index
     * @returns Channel config or null
     */
    getChannel(index: number): ChannelConfig | null {
        if (index >= 0 && index < this.channels.length) {
            const channel = this.channels[index];
            return channel !== undefined ? channel : null;
        }
        return null;
    }

    /**
     * Get total channel count.
     *
     * @returns Number of channels
     */
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
