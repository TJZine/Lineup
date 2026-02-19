/**
 * @jest-environment jsdom
 */

import { PlaybackOptionsModal } from '../PlaybackOptionsModal';
import type { PlaybackOptionsViewModel } from '../types';

const createViewModel = (): { spies: { subtitleSelect: jest.Mock; subtitleBlocked: jest.Mock; audioSelect: jest.Mock }; viewModel: PlaybackOptionsViewModel } => {
    const subtitleSelect = jest.fn();
    const subtitleBlocked = jest.fn();
    const audioSelect = jest.fn();

    return {
        spies: {
            subtitleSelect,
            subtitleBlocked,
            audioSelect,
        },
        viewModel: {
            title: 'Playback options',
            subtitles: {
                title: 'Subtitles',
                helperText: 'Choose subtitle track',
                emptyMessage: 'No subtitles',
                options: [
                    {
                        id: 'sub-1',
                        label: 'English',
                        meta: 'SRT',
                        state: 'Default',
                        selected: true,
                        onSelect: subtitleSelect,
                    },
                    {
                        id: 'sub-2',
                        label: 'Spanish',
                        blocked: true,
                        onSelect: jest.fn(),
                        onBlockedSelect: subtitleBlocked,
                    },
                    {
                        id: 'sub-3',
                        label: 'French',
                        disabled: true,
                        onSelect: jest.fn(),
                    },
                ],
            },
            audio: {
                title: 'Audio',
                emptyMessage: '',
                options: [
                    {
                        id: 'aud-1',
                        label: 'English 5.1',
                        meta: 'AAC',
                        onSelect: audioSelect,
                    },
                ],
            },
        },
    };
};

describe('PlaybackOptionsModal', () => {
    let container: HTMLDivElement;

    const clickButton = (selector: string): void => {
        const button = container.querySelector(selector);
        if (!(button instanceof HTMLButtonElement)) {
            throw new Error(`Button not found: ${selector}`);
        }
        button.click();
    };

    beforeEach(() => {
        container = document.createElement('div');
        container.id = 'playback-options-container';
        document.body.appendChild(container);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('throws if initialize cannot find the container', () => {
        document.body.innerHTML = '';
        const modal = new PlaybackOptionsModal();
        expect(() => modal.initialize({ containerId: 'missing' })).toThrow(
            'Playback Options container #missing not found'
        );
    });

    it('renders sections and focusable IDs on show', () => {
        const modal = new PlaybackOptionsModal();
        modal.initialize({ containerId: 'playback-options-container' });

        const { viewModel } = createViewModel();
        modal.show(viewModel);

        expect(modal.isVisible()).toBe(true);
        expect(container.classList.contains('visible')).toBe(true);
        expect(container.querySelectorAll('button').length).toBe(4);
        expect(modal.getFocusableIds()).toEqual(['sub-1', 'sub-2', 'aud-1']);
    });

    it('uses playback-options-item class, not setup-toggle', () => {
        const modal = new PlaybackOptionsModal();
        modal.initialize({ containerId: 'playback-options-container' });
        const { viewModel } = createViewModel();
        modal.show(viewModel);

        const items = container.querySelectorAll('.playback-options-item');
        const oldItems = container.querySelectorAll('.setup-toggle');
        expect(items.length).toBeGreaterThan(0);
        expect(oldItems.length).toBe(0);
    });

    it('routes click handlers for normal and blocked options', () => {
        const modal = new PlaybackOptionsModal();
        modal.initialize({ containerId: 'playback-options-container' });

        const { viewModel, spies } = createViewModel();
        modal.show(viewModel);

        clickButton('#sub-1');
        clickButton('#sub-2');
        clickButton('#sub-3');
        clickButton('#aud-1');

        expect(spies.subtitleSelect).toHaveBeenCalledTimes(1);
        expect(spies.subtitleBlocked).toHaveBeenCalledTimes(1);
        expect(spies.audioSelect).toHaveBeenCalledTimes(1);

        const blockedOption = viewModel.subtitles.options.find((o) => o.id === 'sub-2');
        expect(blockedOption).toBeDefined();
        expect(blockedOption?.onSelect).not.toHaveBeenCalled();

        const disabledOption = viewModel.subtitles.options.find((o) => o.id === 'sub-3');
        expect(disabledOption).toBeDefined();
        const disabledButton = container.querySelector('#sub-3') as HTMLButtonElement | null;
        expect(disabledButton).not.toBeNull();
        expect(disabledButton!.disabled).toBe(true);
        expect(disabledOption?.onSelect).not.toHaveBeenCalled();
    });

    it('renders empty section message when options are absent', () => {
        const modal = new PlaybackOptionsModal();
        modal.initialize({ containerId: 'playback-options-container' });

        const { viewModel } = createViewModel();
        viewModel.audio.options = [];
        viewModel.audio.emptyMessage = 'No alternate audio';

        modal.show(viewModel);

        expect(container.textContent ?? '').toContain('No alternate audio');
    });

    it('update rerenders content', () => {
        const modal = new PlaybackOptionsModal();
        modal.initialize({ containerId: 'playback-options-container' });

        const { viewModel } = createViewModel();
        modal.show(viewModel);

        const updated = createViewModel().viewModel;
        updated.title = 'Updated options';
        updated.subtitles.options = [];
        updated.subtitles.emptyMessage = 'Nothing selected';
        modal.update(updated);

        expect(container.textContent ?? '').toContain('Updated options');
        expect(container.textContent ?? '').toContain('Nothing selected');
    });

    it('hide resets visible state', () => {
        const modal = new PlaybackOptionsModal();
        modal.initialize({ containerId: 'playback-options-container' });

        const { viewModel } = createViewModel();
        modal.show(viewModel);

        modal.hide();
        expect(modal.isVisible()).toBe(false);
        expect(container.classList.contains('visible')).toBe(false);
    });

    it('destroy clears content and focusables', () => {
        const modal = new PlaybackOptionsModal();
        modal.initialize({ containerId: 'playback-options-container' });

        const { viewModel } = createViewModel();
        modal.show(viewModel);

        modal.destroy();
        expect(container.textContent).toBe('');
        expect(modal.getFocusableIds()).toEqual([]);
    });
});
