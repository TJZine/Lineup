import type { ChannelConfig } from '../types';

export type GuideToolbarAction = 'search' | 'earlier' | 'now' | 'later' | 'hours';

export class EPGGuideToolbar {
    private buttons: HTMLButtonElement[] = [];
    private focusedIndex: number | null = null;
    private searchOverlay: HTMLElement | null = null;
    private searchInput: HTMLInputElement | null = null;
    private searchMatches: Array<{ channel: ChannelConfig; index: number }> = [];
    private searchIndex = 0;
    private channels: ChannelConfig[] = [];
    private statusElement: HTMLElement | null = null;
    private onAction: (action: GuideToolbarAction) => void = () => {};
    private onPickChannel: (index: number) => void = () => {};

    initialize(host: HTMLElement, overlayHost: HTMLElement, callbacks: {
        onAction: (action: GuideToolbarAction) => void;
        onPickChannel: (index: number) => void;
    }): void {
        this.onAction = callbacks.onAction;
        this.onPickChannel = callbacks.onPickChannel;
        const definitions: Array<[GuideToolbarAction, string]> = [
            ['search', 'Search channels'], ['earlier', '‹'], ['now', 'Now'],
            ['later', '›'], ['hours', '2 hours ⌄'],
        ];
        this.buttons = definitions.map(([action, label]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'epg-toolbar-button';
            button.dataset.action = action;
            button.textContent = label;
            button.setAttribute('aria-label', {
                search: 'Search channels', earlier: 'Previous time', now: 'Now',
                later: 'Next time', hours: 'Guide hours',
            }[action]);
            button.addEventListener('click', () => {
                this.focusedIndex = this.buttons.indexOf(button);
                this.syncFocus();
                if (action === 'search') this.openSearch(overlayHost);
                else this.onAction(action);
            });
            host.appendChild(button);
            return button;
        });
        const status = document.createElement('span');
        status.className = 'epg-toolbar-status';
        status.setAttribute('role', 'status');
        host.appendChild(status);
        this.statusElement = status;
    }

    setChannels(channels: ChannelConfig[]): void {
        this.channels = channels;
        if (this.searchOverlay) this.updateSearch();
    }

    setHours(hours: number): void {
        const button = this.buttons.find((candidate) => candidate.dataset.action === 'hours');
        if (button) button.textContent = `${hours} hours ⌄`;
    }

    reportSaveFailure(): void {
        if (this.statusElement) this.statusElement.textContent = 'Could not save Guide hours. Try again.';
    }

    clearStatus(): void {
        if (this.statusElement) this.statusElement.textContent = '';
    }

    isFocused(): boolean { return this.focusedIndex !== null; }
    isSearchOpen(): boolean { return this.searchOverlay !== null; }

    focus(index = 0): void {
        this.focusedIndex = Math.max(0, Math.min(index, this.buttons.length - 1));
        this.syncFocus();
    }

    blur(): void {
        this.focusedIndex = null;
        this.syncFocus();
    }

    handleNavigation(direction: 'up' | 'down' | 'left' | 'right'): 'handled' | 'grid' | 'menu' | 'library' {
        if (this.searchOverlay) {
            if (direction === 'up' || direction === 'down') {
                this.searchIndex = Math.max(0, Math.min(
                    this.searchIndex + (direction === 'down' ? 1 : -1), this.searchMatches.length - 1
                ));
                this.syncSearchSelection();
            }
            return 'handled';
        }
        if (this.focusedIndex === null) return 'grid';
        if (direction === 'down') { this.blur(); return 'grid'; }
        if (direction === 'up') { this.blur(); return 'menu'; }
        if (direction === 'left' && this.focusedIndex === 0) { this.blur(); return 'library'; }
        this.focus(this.focusedIndex + (direction === 'right' ? 1 : -1));
        return 'handled';
    }

    select(overlayHost: HTMLElement): boolean {
        if (this.searchOverlay) {
            const match = this.searchMatches[this.searchIndex];
            if (match) {
                this.closeSearch();
                this.onPickChannel(match.index);
            }
            return true;
        }
        const button = this.focusedIndex === null ? null : this.buttons[this.focusedIndex];
        if (!button) return false;
        if (button.dataset.action === 'search') this.openSearch(overlayHost);
        else this.onAction(button.dataset.action as GuideToolbarAction);
        return true;
    }

    back(): boolean {
        if (this.searchOverlay) { this.closeSearch(); return true; }
        if (this.focusedIndex !== null) { this.blur(); return true; }
        return false;
    }

    destroy(): void {
        this.closeSearch();
        for (const button of this.buttons) button.remove();
        this.buttons = [];
        this.statusElement?.remove();
        this.statusElement = null;
        this.channels = [];
        this.focusedIndex = null;
    }

    private syncFocus(): void {
        this.buttons.forEach((button, index) => {
            button.classList.toggle('epg-toolbar-focused', index === this.focusedIndex);
            button.tabIndex = index === this.focusedIndex ? 0 : -1;
        });
    }

    private openSearch(overlayHost: HTMLElement): void {
        if (this.searchOverlay) return;
        const overlay = document.createElement('div');
        overlay.className = 'epg-search-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-label', 'Search channels');
        const input = document.createElement('input');
        input.className = 'epg-search-input';
        input.type = 'search';
        input.placeholder = 'Channel name or number';
        input.setAttribute('aria-label', 'Channel name or number');
        const results = document.createElement('div');
        results.className = 'epg-search-results';
        results.setAttribute('role', 'listbox');
        overlay.append(input, results);
        overlayHost.appendChild(overlay);
        this.searchOverlay = overlay;
        this.searchInput = input;
        input.addEventListener('input', () => this.updateSearch());
        input.addEventListener('keydown', (event) => {
            if (event.isComposing || event.keyCode === 229) return;
            if (event.keyCode === 461 || event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                this.closeSearch();
                return;
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation();
                this.select(overlayHost);
                return;
            }
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                event.preventDefault();
                event.stopPropagation();
                this.handleNavigation(event.key === 'ArrowUp' ? 'up' : 'down');
            }
        });
        this.updateSearch();
        input.focus();
    }

    private updateSearch(): void {
        const results = this.searchOverlay?.querySelector('.epg-search-results');
        if (!results) return;
        const query = this.searchInput?.value.trim().toLocaleLowerCase() ?? '';
        this.searchMatches = this.channels.flatMap((channel, index) =>
            !query || channel.name.toLocaleLowerCase().includes(query) || String(channel.number).includes(query)
                ? [{ channel, index }] : []
        ).slice(0, 20);
        this.searchIndex = 0;
        results.replaceChildren(...this.searchMatches.map(({ channel, index }) => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'epg-search-result';
            option.setAttribute('role', 'option');
            option.textContent = `${channel.number} · ${channel.name}`;
            option.addEventListener('click', () => {
                this.closeSearch();
                this.onPickChannel(index);
            });
            return option;
        }));
        if (this.searchMatches.length === 0) results.textContent = 'No matching channels';
        this.syncSearchSelection();
    }

    private syncSearchSelection(): void {
        this.searchOverlay?.querySelectorAll('.epg-search-result').forEach((element, index) => {
            const selected = index === this.searchIndex;
            element.classList.toggle('epg-toolbar-focused', selected);
            element.setAttribute('aria-selected', selected ? 'true' : 'false');
            if (selected && typeof element.scrollIntoView === 'function') {
                element.scrollIntoView({ block: 'nearest' });
            }
        });
    }

    private closeSearch(): void {
        this.searchOverlay?.remove();
        this.searchOverlay = null;
        this.searchInput = null;
        this.searchMatches = [];
    }
}
