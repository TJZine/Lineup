import { APP_SHELL_CONTAINER_IDS } from '../common/appShellContainerIds';

export const PLAYBACK_OPTIONS_MODAL_ID = 'playback-options';

export const PLAYBACK_OPTIONS_CLASSES = {
    CONTAINER: APP_SHELL_CONTAINER_IDS.PLAYBACK_OPTIONS,
    PANEL: 'playback-options-panel',
    HEADER: 'playback-options-header',
    TITLE: 'playback-options-title',
    SECTION: 'playback-options-section',
    SECTION_TITLE: 'playback-options-section-title',
    HELPER: 'playback-options-helper',
    LIST: 'playback-options-list',
    EMPTY: 'playback-options-empty',
    ITEM: 'playback-options-item',
    EQUALIZER: 'playback-options-equalizer',
} as const;
