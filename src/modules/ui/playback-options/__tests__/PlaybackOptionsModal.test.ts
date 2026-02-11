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
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('throws if initialize cannot find the container', () => {
        const modal = new PlaybackOptionsModal();
        expect(() => modal.initialize({ containerId: 'missing' })).toThrow(
            'Playback Options container #missing not found'
        );
    });

    it('renders sections and focusable IDs on show', () => {
        const container = document.createElement('div');
        container.id = 'playback-options-container';
        document.body.appendChild(container);

        const modal = new PlaybackOptionsModal();
        modal.initialize({ containerId: 'playback-options-container' });

        const { viewModel } = createViewModel();
        modal.show(viewModel);

        expect(modal.isVisible()).toBe(true);
        expect(container.classList.contains('visible')).toBe(true);
        expect(container.querySelectorAll('button').length).toBe(4);
        expect(modal.getFocusableIds()).toEqual(['sub-1', 'sub-2', 'aud-1']);
    });

    it('routes click handlers for normal and blocked options', () => {
        const container = document.createElement('div');
        container.id = 'playback-options-container';
        document.body.appendChild(container);

        const modal = new PlaybackOptionsModal();
        modal.initialize({ containerId: 'playback-options-container' });

        const { viewModel, spies } = createViewModel();
        modal.show(viewModel);

        (container.querySelector('#sub-1') as HTMLButtonElement).click();
        (container.querySelector('#sub-2') as HTMLButtonElement).click();
        (container.querySelector('#sub-3') as HTMLButtonElement).click();
        (container.querySelector('#aud-1') as HTMLButtonElement).click();

        expect(spies.subtitleSelect).toHaveBeenCalledTimes(1);
        expect(spies.subtitleBlocked).toHaveBeenCalledTimes(1);
        expect(spies.audioSelect).toHaveBeenCalledTimes(1);
    });

    it('renders empty section message when options are absent', () => {
        const container = document.createElement('div');
        container.id = 'playback-options-container';
        document.body.appendChild(container);

        const modal = new PlaybackOptionsModal();
        modal.initialize({ containerId: 'playback-options-container' });

        const { viewModel } = createViewModel();
        viewModel.audio.options = [];
        viewModel.audio.emptyMessage = 'No alternate audio';

        modal.show(viewModel);

        expect(container.textContent ?? '').toContain('No alternate audio');
    });

    it('update rerenders and hide/destroy reset state', () => {
        const container = document.createElement('div');
        container.id = 'playback-options-container';
        document.body.appendChild(container);

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

        modal.hide();
        expect(modal.isVisible()).toBe(false);
        expect(container.classList.contains('visible')).toBe(false);

        modal.destroy();
        expect(container.textContent).toBe('');
        expect(modal.getFocusableIds()).toEqual([]);
    });
});
