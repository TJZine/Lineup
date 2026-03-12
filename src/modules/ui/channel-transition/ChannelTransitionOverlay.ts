/**
 * @fileoverview Channel transition overlay UI.
 * @module modules/ui/channel-transition/ChannelTransitionOverlay
 */

import { CHANNEL_TRANSITION_CLASSES } from './constants';
import type { IChannelTransitionOverlay } from './interfaces';
import type { ChannelTransitionConfig, ChannelTransitionViewModel } from './types';

type ChannelTransitionElements = {
    spinner: HTMLElement | null;
    title: HTMLElement | null;
    subtitle: HTMLElement | null;
};

export class ChannelTransitionOverlay implements IChannelTransitionOverlay {
    private containerElement: HTMLElement | null = null;
    private isVisibleFlag = false;
    private elements: ChannelTransitionElements = {
        spinner: null,
        title: null,
        subtitle: null,
    };

    initialize(config: ChannelTransitionConfig): void {
        const container = document.getElementById(config.containerId);
        if (!container) {
            throw new Error(`Channel transition container #${config.containerId} not found`);
        }
        this.containerElement = container;
        this.containerElement.classList.add(CHANNEL_TRANSITION_CLASSES.CONTAINER);
        this.containerElement.replaceChildren(this.createTemplateElement());
        this.containerElement.classList.remove(CHANNEL_TRANSITION_CLASSES.VISIBLE);
        this.isVisibleFlag = false;
        this.cacheElements();
    }

    destroy(): void {
        if (this.containerElement) {
            this.containerElement.replaceChildren();
            this.containerElement.classList.remove(CHANNEL_TRANSITION_CLASSES.VISIBLE);
        }
        this.containerElement = null;
        this.isVisibleFlag = false;
        this.elements = {
            spinner: null,
            title: null,
            subtitle: null,
        };
    }

    show(): void {
        if (!this.containerElement) return;
        this.containerElement.classList.add(CHANNEL_TRANSITION_CLASSES.VISIBLE);
        this.isVisibleFlag = true;
    }

    hide(): void {
        if (!this.containerElement) return;
        this.containerElement.classList.remove(CHANNEL_TRANSITION_CLASSES.VISIBLE);
        this.isVisibleFlag = false;
    }

    isVisible(): boolean {
        return this.isVisibleFlag;
    }

    setViewModel(vm: ChannelTransitionViewModel): void {
        if (!this.containerElement) return;
        if (this.elements.spinner) {
            this.elements.spinner.style.display = vm.showSpinner ? 'block' : 'none';
        }
        if (this.elements.title) {
            this.elements.title.textContent = vm.title;
        }
        if (this.elements.subtitle) {
            this.elements.subtitle.textContent = vm.subtitle ?? '';
            this.elements.subtitle.style.display = vm.subtitle ? 'block' : 'none';
        }
    }

    private cacheElements(): void {
        if (!this.containerElement) return;
        this.elements = {
            spinner: this.containerElement.querySelector(`.${CHANNEL_TRANSITION_CLASSES.SPINNER}`),
            title: this.containerElement.querySelector(`.${CHANNEL_TRANSITION_CLASSES.TITLE}`),
            subtitle: this.containerElement.querySelector(`.${CHANNEL_TRANSITION_CLASSES.SUBTITLE}`),
        };
    }

    private createTemplateElement(): HTMLElement {
        const panel = document.createElement('div');
        panel.className = CHANNEL_TRANSITION_CLASSES.PANEL;

        const spinner = document.createElement('div');
        spinner.className = CHANNEL_TRANSITION_CLASSES.SPINNER;
        panel.appendChild(spinner);

        const text = document.createElement('div');
        text.className = CHANNEL_TRANSITION_CLASSES.TEXT;

        const title = document.createElement('div');
        title.className = CHANNEL_TRANSITION_CLASSES.TITLE;
        text.appendChild(title);

        const subtitle = document.createElement('div');
        subtitle.className = CHANNEL_TRANSITION_CLASSES.SUBTITLE;
        text.appendChild(subtitle);

        panel.appendChild(text);
        return panel;
    }
}
