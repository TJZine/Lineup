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

    it('renders a labelled modal dialog with labelled option groups and pressed states', () => {
        const modal = new PlaybackOptionsModal();
        modal.initialize({ containerId: 'playback-options-container' });

        const { viewModel } = createViewModel();
        modal.show(viewModel);

        expect(container.getAttribute('role')).toBe('dialog');
        expect(container.getAttribute('aria-modal')).toBe('true');
        expect(container.getAttribute('aria-labelledby')).toBe('playback-options-title');
        expect(container.querySelector('#playback-options-title')?.textContent).toBe(
            'Playback options'
        );

        const groups = [...container.querySelectorAll('[role="group"]')];
        expect(groups).toHaveLength(2);
        expect(groups.map((group) => group.getAttribute('aria-labelledby'))).toEqual([
            'playback-options-subtitles-title',
            'playback-options-audio-title',
        ]);
        expect(container.querySelector('#playback-options-subtitles-title')?.textContent).toBe(
            'Subtitles'
        );
        expect(container.querySelector('#playback-options-audio-title')?.textContent).toBe('Audio');

        expect(container.querySelector('#sub-1')?.getAttribute('aria-pressed')).toBe('true');
        expect(container.querySelector('#sub-2')?.getAttribute('aria-pressed')).toBe('false');
        expect(container.querySelector('#sub-2')?.getAttribute('aria-disabled')).toBe('true');
        expect(container.querySelector('#sub-3')?.getAttribute('aria-pressed')).toBe('false');
        expect((container.querySelector('#sub-3') as HTMLButtonElement).disabled).toBe(true);
        expect(container.querySelector('#aud-1')?.getAttribute('aria-pressed')).toBe('false');
    });

    it('synchronizes pressed state when runtime selection updates', () => {
        const modal = new PlaybackOptionsModal();
        modal.initialize({ containerId: 'playback-options-container' });

        const { viewModel } = createViewModel();
        modal.show(viewModel);

        const updated = createViewModel().viewModel;
        updated.subtitles.options[0]!.selected = false;
        updated.audio.options[0]!.selected = true;
        modal.update(updated);

        expect(container.querySelector('#sub-1')?.getAttribute('aria-pressed')).toBe('false');
        expect(container.querySelector('#aud-1')?.getAttribute('aria-pressed')).toBe('true');
        expect(container.querySelectorAll('#playback-options-title')).toHaveLength(1);
        expect(container.querySelectorAll('#playback-options-subtitles-title')).toHaveLength(1);
        expect(container.querySelectorAll('#playback-options-audio-title')).toHaveLength(1);
    });

    it('renders equalizer indicator on selected items only', () => {
        const modal = new PlaybackOptionsModal();
        modal.initialize({ containerId: 'playback-options-container' });

        const { viewModel } = createViewModel();
        viewModel.audio.options[0]!.state = 'Stereo';
        modal.show(viewModel);

        const sub1 = container.querySelector('#sub-1');
        const aud1 = container.querySelector('#aud-1');
        const sub1Equalizer = sub1?.querySelector('.playback-options-equalizer');

        expect(sub1Equalizer).not.toBeNull();
        expect(sub1Equalizer?.getAttribute('aria-hidden')).toBe('true');
        expect(sub1Equalizer?.querySelectorAll('span').length).toBe(3);
        expect(aud1?.querySelector('.playback-options-equalizer')).toBeNull();
    });

    it('uses playback-options-item class, not setup-toggle', () => {
        const modal = new PlaybackOptionsModal();
        modal.initialize({ containerId: 'playback-options-container' });
        const { viewModel } = createViewModel();
        modal.show(viewModel);

        const items = container.querySelectorAll('.playback-options-item');
        const oldItems = container.querySelectorAll('.setup-toggle');
        expect(items.length).toBe(4);
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
        const audioGroup = container.querySelector(
            '[role="group"][aria-labelledby="playback-options-audio-title"]'
        );
        expect(audioGroup).not.toBeNull();
        expect(audioGroup?.children).toHaveLength(0);
        expect(container.querySelector('#playback-options-audio-title')?.textContent).toBe('Audio');
    });

    it('keeps unavailable section copy visible when a default option is present', () => {
        const modal = new PlaybackOptionsModal();
        modal.initialize({ containerId: 'playback-options-container' });

        const { viewModel } = createViewModel();
        viewModel.subtitles.options = [
            {
                id: 'playback-subtitle-off',
                label: 'Off',
                selected: true,
                onSelect: jest.fn(),
            },
        ];
        viewModel.subtitles.emptyMessage = 'No subtitles available';

        modal.show(viewModel);

        const empty = container.querySelector('.playback-options-empty') as HTMLElement | null;
        expect(empty?.textContent).toBe('No subtitles available');
        expect(empty?.style.display).toBe('');
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
        expect(container.hasAttribute('role')).toBe(false);
        expect(container.hasAttribute('aria-modal')).toBe(false);
        expect(container.hasAttribute('aria-labelledby')).toBe(false);
    });
});
