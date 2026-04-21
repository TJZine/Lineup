/**
 * @fileoverview Tab bar component for filtering EPG by library.
 * @module modules/ui/epg/view/EPGLibraryTabs
 * @version 1.0.0
 */

interface EPGLibraryTabsConfig {
    onSelect: (libraryId: string | null) => void;
}

type LibraryOption = { id: string; name: string };

type PickerNodes = {
    overlay: HTMLElement;
    panel: HTMLElement;
    items: HTMLButtonElement[];
};

export class EPGLibraryTabs {
    private static idCounter = 0;
    private element: HTMLElement | null = null;
    private gridElement: HTMLElement | null = null;
    private pill: HTMLButtonElement | null = null;
    private picker: PickerNodes | null = null;
    private libraries: LibraryOption[] = [];
    private selectedId: string | null = null;
    private focusedIndex = 0;
    private isPillFocused = false;
    private readonly panelId: string;

    constructor(private readonly config: EPGLibraryTabsConfig) {
        this.panelId = `epg-library-picker-panel-${EPGLibraryTabs.idCounter++}`;
    }

    initialize(gridElement: HTMLElement): void {
        if (this.element) return;
        const el = document.createElement('div');
        el.className = 'epg-library-tabs';
        gridElement.appendChild(el);
        this.element = el;
        this.gridElement = gridElement;
    }

    isVisible(): boolean {
        return Boolean(this.element && this.element.style.display !== 'none');
    }

    update(libraries: LibraryOption[], selectedId: string | null): void {
        this.libraries = libraries;
        this.selectedId = selectedId;

        if (!this.element) return;

        if (libraries.length <= 1) {
            this.element.style.display = 'none';
            this.element.replaceChildren();
            this.pill = null;
            this.focusedIndex = 0;
            this.isPillFocused = false;
            this.closePicker();
            return;
        }

        this.element.style.display = '';
        this.renderPill();
        this.clampFocusedIndex();
        if (this.isPickerOpen()) {
            this.renderPicker();
        }
        this.applyPillClasses();
    }

    setFocusedToSelected(): void {
        const allTabs = this.getOptionIds();
        const index = allTabs.findIndex((id) => id === this.selectedId);
        this.focusedIndex = index >= 0 ? index : 0; // 0 is "All"
        this.isPillFocused = true;
        this.applyPillClasses();
        this.applyPickerClasses();
    }

    setPillFocused(focused: boolean): void {
        this.isPillFocused = focused;
        this.applyPillClasses();
    }

    moveFocus(delta: -1 | 1): void {
        if (!this.isPickerOpen()) return;
        const count = this.getOptionIds().length;
        if (count <= 0) return;
        const next = Math.max(0, Math.min(this.focusedIndex + delta, count - 1));
        this.focusedIndex = next;
        this.applyPickerClasses();
        const focusedItem = this.picker?.items[this.focusedIndex] ?? null;
        if (focusedItem && typeof focusedItem.scrollIntoView === 'function') {
            focusedItem.scrollIntoView({ block: 'nearest' });
        }
    }

    getFocusedLibraryId(): string | null {
        this.clampFocusedIndex();
        const ids = this.getOptionIds();
        return ids[this.focusedIndex] ?? null;
    }

    selectFocused(): void {
        if (!this.isPickerOpen()) {
            this.openPicker();
            return;
        }
        this.config.onSelect(this.getFocusedLibraryId());
        this.closePicker();
    }

    closePicker(): void {
        this.picker?.overlay.remove();
        this.picker = null;
        this.applyPillClasses();
    }

    isPickerOpen(): boolean {
        return Boolean(this.picker);
    }

    destroy(): void {
        this.closePicker();
        this.element?.remove();
        this.element = null;
        this.gridElement = null;
        this.pill = null;
        this.libraries = [];
    }

    private getOptionIds(): Array<string | null> {
        return [null, ...this.libraries.map((l) => l.id)];
    }

    private getOptionLabels(): string[] {
        return ['All', ...this.libraries.map((l) => l.name)];
    }

    private renderPill(): void {
        if (!this.element) return;
        if (!this.pill) {
            const b = document.createElement('button');
            b.className = 'epg-library-pill';
            b.type = 'button';
            b.setAttribute('aria-label', 'Library filter');
            b.setAttribute('aria-haspopup', 'listbox');
            b.setAttribute('aria-controls', this.panelId);
            b.addEventListener('click', () => this.selectFocused());
            this.pill = b;
            this.element.replaceChildren(b);
        }

        const labels = this.getOptionLabels();
        const ids = this.getOptionIds();
        const selectedIndex = ids.findIndex((id) => id === this.selectedId);
        const label = labels[selectedIndex >= 0 ? selectedIndex : 0] ?? 'All';
        this.pill.textContent = `Library: ${label}`;
    }

    private openPicker(): void {
        this.focusedIndex = this.getFocusedIndexForOpen();
        this.renderPicker();
        this.applyPickerClasses();
        this.applyPillClasses();
    }

    private getFocusedIndexForOpen(): number {
        const ids = this.getOptionIds();
        const index = ids.findIndex((id) => id === this.selectedId);
        return index >= 0 ? index : 0;
    }

    private clampFocusedIndex(): void {
        const count = this.getOptionIds().length;
        this.focusedIndex = count <= 0 ? 0 : Math.max(0, Math.min(this.focusedIndex, count - 1));
    }

    private renderPicker(): void {
        if (!this.gridElement) return;

        if (!this.picker) {
            const overlay = document.createElement('div');
            overlay.className = 'epg-library-picker-overlay';

            const scrim = document.createElement('div');
            scrim.className = 'epg-library-picker-scrim';

            const panel = document.createElement('div');
            panel.className = 'epg-library-picker-panel';
            panel.id = this.panelId;
            panel.setAttribute('aria-label', 'Library filter options');

            overlay.appendChild(scrim);
            overlay.appendChild(panel);
            this.gridElement.appendChild(overlay);

            this.picker = { overlay, panel, items: [] };
        }

        const labels = this.getOptionLabels();
        const ids = this.getOptionIds();
        this.clampFocusedIndex();
        const buttons = ids.map((id, i) => {
            const b = document.createElement('button');
            b.className = 'epg-library-picker-item';
            b.type = 'button';
            b.textContent = labels[i] ?? '';
            b.dataset.libraryId = id ?? '';
            b.addEventListener('click', () => {
                this.focusedIndex = i;
                this.applyPickerClasses();
                this.selectFocused();
            });
            return b;
        });

        this.picker.items = buttons;
        this.picker.panel.replaceChildren(...buttons);
        this.applyPickerClasses();
    }

    private applyPillClasses(): void {
        if (!this.pill) return;
        this.pill.classList.toggle('focused', this.isPillFocused);
        this.pill.setAttribute('aria-expanded', this.isPickerOpen() ? 'true' : 'false');
    }

    private applyPickerClasses(): void {
        if (!this.picker) return;
        const ids = this.getOptionIds();
        this.clampFocusedIndex();
        for (let i = 0; i < this.picker.items.length; i++) {
            const b = this.picker.items[i]!;
            const id = ids[i] ?? null;
            const selected = id === this.selectedId;
            const focused = i === this.focusedIndex;

            b.classList.toggle('selected', selected);
            b.classList.toggle('focused', focused);
        }
    }
}
