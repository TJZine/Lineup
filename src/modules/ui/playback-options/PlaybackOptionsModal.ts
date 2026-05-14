import { PLAYBACK_OPTIONS_CLASSES } from './constants';
import type { IPlaybackOptionsModal } from './interfaces';
import type { PlaybackOptionsConfig, PlaybackOptionsSection, PlaybackOptionsViewModel, PlaybackOptionsItem } from './types';
import { createOverlayPrimitives } from '../common/OverlayPrimitives';

export class PlaybackOptionsModal implements IPlaybackOptionsModal {
    private containerElement: HTMLElement | null = null;
    private isVisibleFlag = false;
    private focusableIds: string[] = [];
    private optionElements: Map<string, HTMLButtonElement> = new Map();

    initialize(config: PlaybackOptionsConfig): void {
        if (typeof document === 'undefined') {
            return;
        }
        const container = document.getElementById(config.containerId);
        if (!container) {
            throw new Error(`Playback Options container #${config.containerId} not found`);
        }
        this.containerElement = container;
        this.containerElement.className = PLAYBACK_OPTIONS_CLASSES.CONTAINER;
        this.containerElement.classList.remove('visible');
        this.isVisibleFlag = false;
    }

    show(viewModel: PlaybackOptionsViewModel): void {
        if (!this.containerElement) return;
        this.render(viewModel);
        this.containerElement.classList.add('visible');
        this.isVisibleFlag = true;
    }

    update(viewModel: PlaybackOptionsViewModel): void {
        if (!this.containerElement) return;
        this.render(viewModel);
    }

    hide(): void {
        if (!this.containerElement) return;
        this.containerElement.classList.remove('visible');
        this.isVisibleFlag = false;
    }

    destroy(): void {
        if (this.containerElement) {
            this.containerElement.textContent = '';
            this.containerElement.classList.remove('visible');
        }
        this.containerElement = null;
        this.isVisibleFlag = false;
        this.focusableIds = [];
        this.optionElements.clear();
    }

    isVisible(): boolean {
        return this.isVisibleFlag;
    }

    getFocusableIds(): string[] {
        return [...this.focusableIds];
    }

    private render(viewModel: PlaybackOptionsViewModel): void {
        if (!this.containerElement) return;
        this.containerElement.textContent = '';
        this.focusableIds = [];
        this.optionElements.clear();

        const primitives = createOverlayPrimitives(
            {
                panel: PLAYBACK_OPTIONS_CLASSES.PANEL,
                header: PLAYBACK_OPTIONS_CLASSES.HEADER,
                title: PLAYBACK_OPTIONS_CLASSES.TITLE,
            },
            {
                panel: {},
                title: viewModel.title,
            }
        );
        const panel = primitives.panelEl;

        panel.appendChild(this.createSection(viewModel.subtitles));
        panel.appendChild(this.createSection(viewModel.audio));

        this.containerElement.appendChild(panel);
    }

    private createSection(section: PlaybackOptionsSection): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.className = PLAYBACK_OPTIONS_CLASSES.SECTION;

        const title = document.createElement('h2');
        title.className = PLAYBACK_OPTIONS_CLASSES.SECTION_TITLE;
        title.textContent = section.title;
        wrapper.appendChild(title);

        if (section.helperText) {
            const helper = document.createElement('div');
            helper.className = PLAYBACK_OPTIONS_CLASSES.HELPER;
            helper.textContent = section.helperText;
            wrapper.appendChild(helper);
        }

        const list = document.createElement('div');
        list.className = PLAYBACK_OPTIONS_CLASSES.LIST;

        if (section.options.length === 0 && section.emptyMessage) {
            const empty = document.createElement('div');
            empty.className = PLAYBACK_OPTIONS_CLASSES.EMPTY;
            empty.textContent = section.emptyMessage;
            wrapper.appendChild(empty);
            return wrapper;
        }

        for (const option of section.options) {
            list.appendChild(this.createOption(option));
        }

        wrapper.appendChild(list);
        if (section.emptyMessage) {
            const empty = document.createElement('div');
            empty.className = PLAYBACK_OPTIONS_CLASSES.EMPTY;
            empty.textContent = section.emptyMessage;
            wrapper.appendChild(empty);
        }

        return wrapper;
    }

    private createOption(item: PlaybackOptionsItem): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.id = item.id;
        button.className = `${PLAYBACK_OPTIONS_CLASSES.ITEM}${item.selected ? ' selected' : ''}`;
        if (item.blocked) {
            button.classList.add('blocked');
            button.setAttribute('aria-disabled', 'true');
        }
        if (item.disabled) {
            button.disabled = true;
        }

        const label = document.createElement('span');
        label.className = 'playback-options-item-label';
        label.textContent = item.label;
        button.appendChild(label);

        const meta = document.createElement('span');
        meta.className = 'playback-options-item-meta';
        meta.textContent = '';
        if (item.meta) {
            const pill = document.createElement('span');
            pill.className = 'playback-options-item-meta-pill';
            pill.textContent = item.meta;
            meta.appendChild(pill);
        } else {
            meta.style.display = 'none';
        }
        button.appendChild(meta);

        const stateContainer = document.createElement('span');
        stateContainer.className = 'playback-options-item-state';

        if (item.selected) {
            const equalizer = document.createElement('span');
            equalizer.className = PLAYBACK_OPTIONS_CLASSES.EQUALIZER;
            equalizer.setAttribute('aria-hidden', 'true');

            for (let i = 0; i < 3; i += 1) {
                equalizer.appendChild(document.createElement('span'));
            }

            stateContainer.appendChild(equalizer);
        }

        if (item.state) {
            stateContainer.appendChild(document.createTextNode(item.state));
        }

        button.appendChild(stateContainer);

        button.addEventListener('click', () => {
            if (item.disabled) return;
            if (item.blocked) {
                item.onBlockedSelect?.();
                return;
            }
            item.onSelect();
        });

        if (!item.disabled) {
            this.focusableIds.push(item.id);
        }
        this.optionElements.set(item.id, button);
        return button;
    }
}
