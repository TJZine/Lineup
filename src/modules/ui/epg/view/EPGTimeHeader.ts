import { EPG_CLASSES } from '../constants';
import { appendDebugRuntimeLog, isDebugRuntimeEnabled } from '../debug/debugRuntimeGuards';
import type { EPGConfig, TimeSlot } from '../types';

function formatTimeSlot(timestamp: number): string {
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${ampm}`;
}

export class EPGTimeHeader {
    private containerElement: HTMLElement | null = null;
    private slotsElement: HTMLElement | null = null;
    private stickyElement: HTMLElement | null = null;
    private config: EPGConfig | null = null;
    private gridAnchorTime: number = 0;
    private slotElements: HTMLElement[] = [];
    private lastTimeOffsetMinutes: number = 0;

    private _syncSlotsOcclusionWidth(): void {
        if (!this.slotsElement || !this.stickyElement) return;
        const px = Math.max(0, Math.ceil(this.stickyElement.offsetWidth));
        this.slotsElement.style.setProperty('--epg-time-header-sticky-width-px', `${px}px`);
    }

    initialize(
        parentElement: HTMLElement,
        config: EPGConfig,
        gridAnchorTime: number
    ): void {
        this.config = config;
        this.gridAnchorTime = gridAnchorTime;

        this.containerElement = document.createElement('div');
        this.containerElement.className = EPG_CLASSES.TIME_HEADER;
        parentElement.appendChild(this.containerElement);

        this.slotsElement = document.createElement('div');
        this.slotsElement.className = EPG_CLASSES.TIME_HEADER_SLOTS;
        this.containerElement.appendChild(this.slotsElement);

        this.stickyElement = document.createElement('div');
        this.stickyElement.className = EPG_CLASSES.TIME_HEADER_STICKY;
        this.containerElement.appendChild(this.stickyElement);

        this.renderSlots();
        this.updateStickyLabel(0);
        this._syncSlotsOcclusionWidth();
    }

    destroy(): void {
        if (this.containerElement) {
            this.containerElement.remove();
            this.containerElement = null;
        }
        this.slotsElement = null;
        this.stickyElement = null;
        this.slotElements = [];
        this.config = null;
    }

    private renderSlots(): void {
        if (!this.slotsElement || !this.config) return;

        this.slotsElement.replaceChildren();
        this.slotElements = [];

        const totalMinutes = this.config.totalHours * 60;
        const slotMinutes = this.config.timeSlotMinutes;
        const slotCount = totalMinutes / slotMinutes;

        for (let i = 0; i < slotCount; i++) {
            const slotTime = this.gridAnchorTime + (i * slotMinutes * 60000);
            const slot = this.createSlotElement(slotTime, i * slotMinutes);
            this.slotsElement.appendChild(slot);
            this.slotElements.push(slot);
        }
    }

    refreshLayout(): void {
        if (!this.containerElement || !this.config || this.slotElements.length === 0) return;

        const totalMinutes = this.config.totalHours * 60;
        const slotMinutes = this.config.timeSlotMinutes;
        const slotCount = totalMinutes / slotMinutes;
        const maxSlots = Math.min(slotCount, this.slotElements.length);

        for (let i = 0; i < maxSlots; i++) {
            const slot = this.slotElements[i];
            if (!slot) continue;
            const minutesFromAnchor = i * slotMinutes;
            const left = minutesFromAnchor * this.config.pixelsPerMinute;
            slot.style.left = `${left}px`;
            slot.style.width = `${slotMinutes * this.config.pixelsPerMinute}px`;
        }
    }

    private createSlotElement(time: number, minutesFromAnchor: number): HTMLElement {
        const slot = document.createElement('div');
        slot.className = EPG_CLASSES.TIME_SLOT;
        slot.textContent = formatTimeSlot(time);

        if (this.config) {
            const left = minutesFromAnchor * this.config.pixelsPerMinute;
            slot.style.left = `${left}px`;
            slot.style.width = `${this.config.timeSlotMinutes * this.config.pixelsPerMinute}px`;
        }

        return slot;
    }

    updateScrollPosition(timeOffset: number): void {
        if (!this.slotsElement || !this.config) return;

        this.lastTimeOffsetMinutes = timeOffset;
        const translateX = -(timeOffset * this.config.pixelsPerMinute);
        this.slotsElement.style.transform = `translateX(${translateX}px)`;
        this.updateStickyLabel(timeOffset);
        this._syncSlotsOcclusionWidth();

        if (isDebugRuntimeEnabled(this.config.debugRuntime)) {
            appendDebugRuntimeLog(this.config.debugRuntime, 'EPGTimeHeader.scroll', {
                timeOffset,
                transform: this.slotsElement.style.transform,
            });
        }
    }

    getVisibleTimeSlots(visibleStart: number, visibleEnd: number): TimeSlot[] {
        if (!this.config) return [];

        const slots: TimeSlot[] = [];
        const slotMinutes = this.config.timeSlotMinutes;
        const startSlot = Math.floor(visibleStart / slotMinutes);
        const endSlot = Math.ceil(visibleEnd / slotMinutes);

        for (let i = startSlot; i <= endSlot; i++) {
            const minutesFromAnchor = i * slotMinutes;
            const time = this.gridAnchorTime + (minutesFromAnchor * 60000);

            slots.push({
                time,
                label: formatTimeSlot(time),
                left: minutesFromAnchor * this.config.pixelsPerMinute,
            });
        }

        return slots;
    }

    setGridAnchorTime(anchorTime: number): void {
        this.gridAnchorTime = anchorTime;
        this.renderSlots();
        this.updateStickyLabel(this.lastTimeOffsetMinutes);
        this._syncSlotsOcclusionWidth();
    }

    private updateStickyLabel(timeOffset: number): void {
        if (!this.stickyElement || !this.config) return;
        const timestampMs = this.gridAnchorTime + (timeOffset * 60000);
        this.stickyElement.textContent = formatTimeSlot(timestampMs);
    }
}
