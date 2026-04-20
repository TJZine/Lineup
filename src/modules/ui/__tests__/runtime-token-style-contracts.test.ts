/**
 * @jest-environment node
 */

import {
    blockFor,
    blockWithin,
    declarationValue,
    read,
    readComposedCss,
    topLevelBlockForProperty,
} from '../../../styles/__tests__/helpers/css-test-utils';

type TypographyContract = {
    file: string;
    selector: string;
    expected: string;
};

type DeclarationContract = {
    file: string;
    selector: string;
    property: string;
    expected: string;
    within?: string;
};

const COLOR_SCOPE_FILES = [
    'src/modules/ui/settings/styles.core.css',
    'src/modules/ui/settings/styles.theme.css',
    'src/modules/ui/settings/styles.dropdown.css',
    'src/modules/ui/playback-options/styles.core.css',
    'src/modules/ui/exit-confirm/styles.css',
    'src/modules/ui/channel-badge/styles.css',
    'src/modules/ui/channel-transition/styles.css',
    'src/modules/ui/channel-number-overlay/styles.css',
    'src/modules/ui/player-osd/styles.content.css',
    'src/modules/ui/player-osd/styles.actions.css',
    'src/modules/ui/player-osd/styles.meta-progress.css',
    'src/modules/ui/now-playing-info/styles.core.css',
    'src/modules/ui/now-playing-info/styles.css',
    'src/modules/ui/mini-guide/styles.core.css',
    'src/styles/shell.chrome.css',
] as const;

const SHARED_COLOR_LITERAL_PATTERN =
    /#ffffff|#eff8ff|#f0a060|#e0782a|rgba\(255, 106, 106, 0\.(?:8|95)\)|rgba\(255, 255, 255, 0\.(?:45|5|6|7|85|88|9|95)\)/;

const BRIGHT_FOCUS_LITERAL_PATTERN = /rgba\(255, 255, 255, 0\.(?:92|98)\)/g;

const TYPOGRAPHY_CONTRACTS: TypographyContract[] = [
    {
        file: 'src/styles/shell.chrome.css',
        selector: '.error-title',
        expected: 'var(--text-2xl)',
    },
    {
        file: 'src/styles/shell.chrome.css',
        selector: '.error-message',
        expected: 'var(--text-base)',
    },
    {
        file: 'src/styles/shell.chrome.css',
        selector: '.error-button',
        expected: 'var(--text-md)',
    },
    {
        file: 'src/modules/ui/mini-guide/styles.core.css',
        selector: '.mini-guide-channel-num',
        expected: 'var(--text-base)',
    },
    {
        file: 'src/modules/ui/mini-guide/styles.core.css',
        selector: '.mini-guide-channel-name',
        expected: 'var(--text-md)',
    },
    {
        file: 'src/modules/ui/mini-guide/styles.core.css',
        selector: '.mini-guide-now',
        expected: 'var(--text-base)',
    },
    {
        file: 'src/modules/ui/settings/styles.core.css',
        selector: '.settings-category-button',
        expected: 'var(--text-lg)',
    },
    {
        file: 'src/modules/ui/settings/styles.core.css',
        selector: '.settings-profile-icon',
        expected: 'var(--text-xl)',
    },
    {
        file: 'src/modules/ui/settings/styles.core.css',
        selector: '.settings-profile-name',
        expected: 'var(--text-md)',
    },
    {
        file: 'src/modules/ui/settings/styles.core.css',
        selector: '.settings-profile-action',
        expected: 'var(--text-xs)',
    },
    {
        file: 'src/modules/ui/settings/styles.core.css',
        selector: '.settings-empty',
        expected: 'var(--text-sm)',
    },
    {
        file: 'src/modules/ui/settings/styles.core.css',
        selector: '.setup-toggle-arrow',
        expected: 'var(--text-xs)',
    },
    {
        file: 'src/modules/ui/settings/styles.dropdown.css',
        selector: '.settings-dropdown-option',
        expected: 'var(--text-md)',
    },
    {
        file: 'src/modules/ui/settings/styles.dropdown.css',
        selector: '.settings-dropdown-option-check',
        expected: 'var(--text-sm)',
    },
    {
        file: 'src/modules/ui/settings/styles.dropdown.css',
        selector: '.setup-toggle-chevron',
        expected: 'var(--text-xs)',
    },
    {
        file: 'src/modules/ui/playback-options/styles.core.css',
        selector: '.playback-options-empty',
        expected: 'var(--text-sm)',
    },
    {
        file: 'src/modules/ui/channel-setup/styles.core.css',
        selector: '.setup-preview-row',
        expected: 'var(--channel-setup-font-size-15)',
    },
    {
        file: 'src/modules/ui/epg/styles.classic.css',
        selector: '.epg-container.layout-classic .epg-cell-title',
        expected: 'var(--epg-font-size-classic-title)',
    },
    {
        file: 'src/styles/themes.css',
        selector: '.theme-swiss .epg-info-title',
        expected: 'var(--theme-swiss-title-size-hero)',
    },
];

const SPACING_CONTRACTS: DeclarationContract[] = [
    {
        file: 'src/modules/ui/channel-transition/styles.css',
        selector: '.channel-transition',
        property: 'padding',
        expected: 'var(--space-4) var(--space-5)',
    },
    {
        file: 'src/modules/ui/channel-transition/styles.css',
        selector: '.channel-transition-panel',
        property: 'gap',
        expected: 'var(--space-3)',
    },
    {
        file: 'src/modules/ui/channel-number-overlay/styles.css',
        selector: '.channel-number-panel',
        property: 'padding',
        expected: 'var(--space-2) var(--space-3)',
    },
    {
        file: 'src/modules/ui/mini-guide/styles.core.css',
        selector: '.mini-guide-row.loading .mini-guide-now::before',
        property: 'top',
        expected: 'var(--space-1)',
    },
    {
        file: 'src/modules/ui/player-osd/styles.surface.css',
        selector: '.player-osd-content-row',
        property: 'gap',
        expected: 'var(--space-6)',
    },
    {
        file: 'src/modules/ui/player-osd/styles.surface.css',
        selector: '.player-osd-content-row',
        property: 'padding',
        expected: 'var(--space-10) var(--osd-safe-margin) var(--space-3)',
    },
    {
        file: 'src/modules/ui/player-osd/styles.surface.css',
        selector: '.player-osd-zone-brand',
        property: 'gap',
        expected: 'var(--space-2)',
    },
    {
        file: 'src/modules/ui/player-osd/styles.content.css',
        selector: '.player-osd-info',
        property: 'margin-top',
        expected: 'var(--space-1)',
    },
    {
        file: 'src/modules/ui/player-osd/styles.content.css',
        selector: '.player-osd-info',
        property: 'gap',
        expected: 'var(--space-2)',
    },
    {
        file: 'src/modules/ui/player-osd/styles.actions.css',
        selector: '.player-osd-action',
        property: 'padding',
        expected: 'var(--space-2) var(--space-4)',
    },
    {
        file: 'src/modules/ui/player-osd/styles.meta-progress.css',
        selector: '.player-osd-meta-strip',
        property: 'padding',
        expected: 'var(--space-2) var(--osd-safe-margin)',
    },
    {
        file: 'src/modules/ui/now-playing-info/styles.core.css',
        selector: '.now-playing-info-badges',
        property: 'gap',
        expected: 'var(--space-2)',
    },
    {
        file: 'src/modules/ui/now-playing-info/styles.core.css',
        selector: '.now-playing-info-meta',
        property: 'gap',
        expected: 'var(--space-1)',
    },
    {
        file: 'src/modules/ui/now-playing-info/styles.css',
        selector: '.now-playing-info-actors',
        property: 'gap',
        expected: 'var(--actor-gap)',
    },
    {
        file: 'src/modules/ui/now-playing-info/styles.css',
        selector: '.now-playing-info-actors',
        property: '--actor-gap',
        expected: 'var(--space-2)',
    },
    {
        file: 'src/modules/ui/now-playing-info/styles.css',
        selector: '.now-playing-info-progress',
        property: 'gap',
        expected: 'var(--space-2)',
    },
    {
        file: 'src/modules/ui/playback-options/styles.core.css',
        selector: '.playback-options-section + .playback-options-section',
        property: 'margin-top',
        expected: 'var(--space-6)',
    },
    {
        file: 'src/modules/ui/playback-options/styles.core.css',
        selector: '.playback-options-section-title',
        property: 'margin',
        expected: '0 0 var(--space-3)',
    },
    {
        file: 'src/modules/ui/playback-options/styles.core.css',
        selector: '.playback-options-empty',
        property: 'margin-top',
        expected: 'var(--space-2)',
    },
    {
        file: 'src/modules/ui/playback-options/styles.core.css',
        selector: '.playback-options-item-state',
        property: 'gap',
        expected: 'var(--space-2)',
    },
    {
        file: 'src/modules/ui/exit-confirm/styles.css',
        selector: '.exit-confirm-title',
        property: 'margin',
        expected: '0 0 var(--space-2) 0',
    },
    {
        file: 'src/modules/ui/exit-confirm/styles.css',
        selector: '.exit-confirm-actions',
        property: 'gap',
        expected: 'var(--space-3)',
    },
    {
        file: 'src/modules/ui/settings/styles.core.css',
        selector: '.settings-categories',
        property: 'padding',
        expected: 'var(--space-5)',
    },
    {
        file: 'src/modules/ui/settings/styles.core.css',
        selector: '.settings-header',
        property: 'gap',
        expected: 'var(--space-1)',
    },
    {
        file: 'src/modules/ui/settings/styles.core.css',
        selector: '.settings-header',
        property: 'margin-bottom',
        expected: 'var(--space-4)',
    },
    {
        file: 'src/modules/ui/settings/styles.core.css',
        selector: '.settings-detail',
        property: 'padding',
        expected: 'var(--space-5) var(--space-10)',
    },
    {
        file: 'src/modules/ui/settings/styles.core.css',
        selector: '.settings-detail-title',
        property: 'margin',
        expected: '0 0 var(--space-5)',
    },
    {
        file: 'src/modules/ui/settings/styles.core.css',
        selector: '.settings-detail-items',
        property: 'gap',
        expected: 'var(--space-3)',
    },
    {
        file: 'src/modules/ui/settings/styles.core.css',
        selector: '.settings-profile-row',
        property: 'gap',
        expected: 'var(--space-3)',
    },
    {
        file: 'src/modules/ui/settings/styles.core.css',
        selector: '.settings-empty',
        property: 'margin-top',
        expected: 'var(--space-2)',
    },
    {
        file: 'src/modules/ui/settings/styles.core.css',
        selector: '.setup-toggle-state',
        property: 'gap',
        expected: 'var(--space-2)',
    },
    {
        file: 'src/modules/ui/settings/styles.core.css',
        selector: '.settings-categories',
        property: 'gap',
        expected: 'var(--space-2)',
        within: '@media (max-width: 980px)',
    },
    {
        file: 'src/modules/ui/settings/styles.core.css',
        selector: '.settings-categories',
        property: 'padding',
        expected: 'var(--space-4)',
        within: '@media (max-width: 980px)',
    },
    {
        file: 'src/modules/ui/settings/styles.core.css',
        selector: '.settings-detail',
        property: 'padding',
        expected: 'var(--space-5) var(--space-4)',
        within: '@media (max-width: 980px)',
    },
    {
        file: 'src/modules/ui/settings/styles.core.css',
        selector: '.settings-profile-row',
        property: 'margin-top',
        expected: 'var(--space-2)',
        within: '@media (max-width: 980px)',
    },
    {
        file: 'src/modules/ui/settings/styles.dropdown.css',
        selector: '.settings-dropdown-option',
        property: 'gap',
        expected: 'var(--space-3)',
    },
    {
        file: 'src/styles/shell.chrome.css',
        selector: '.error-message',
        property: 'margin',
        expected: 'var(--space-3) 0 0',
    },
    {
        file: 'src/styles/shell.chrome.css',
        selector: '.error-actions',
        property: 'gap',
        expected: 'var(--space-3)',
    },
];

const LOCAL_SPACING_ALIAS_CONTRACTS: DeclarationContract[] = [
    {
        file: 'src/modules/ui/channel-transition/styles.css',
        selector: '.channel-transition-panel',
        property: 'padding',
        expected: 'var(--runtime-overlay-space-10) var(--runtime-overlay-space-14)',
    },
    {
        file: 'src/modules/ui/channel-number-overlay/styles.css',
        selector: '.channel-number-panel',
        property: 'gap',
        expected: 'var(--runtime-overlay-space-10)',
    },
    {
        file: 'src/modules/ui/player-osd/styles.surface.css',
        selector: '.player-osd-info-column',
        property: 'gap',
        expected: 'var(--player-osd-space-6)',
    },
    {
        file: 'src/modules/ui/player-osd/styles.surface.css',
        selector: '.player-osd-actions-column',
        property: 'gap',
        expected: 'var(--player-osd-space-10)',
    },
    {
        file: 'src/modules/ui/player-osd/styles.surface.css',
        selector: '.player-osd-zone-details',
        property: 'gap',
        expected: 'var(--player-osd-space-6)',
    },
    {
        file: 'src/modules/ui/player-osd/styles.actions.css',
        selector: '.player-osd-actions',
        property: 'gap',
        expected: 'var(--player-osd-actions-space-10)',
    },
    {
        file: 'src/modules/ui/player-osd/styles.content.css',
        selector: '.osd-pill',
        property: 'padding',
        expected: 'var(--space-1) var(--player-osd-space-10)',
    },
    {
        file: 'src/modules/ui/player-osd/styles.meta-progress.css',
        selector: '.player-osd-meta-strip',
        property: 'gap',
        expected: 'var(--player-osd-meta-space-18)',
    },
    {
        file: 'src/modules/ui/player-osd/styles.meta-progress.css',
        selector: '.player-osd-meta-left',
        property: 'gap',
        expected: 'var(--player-osd-meta-space-18)',
    },
    {
        file: 'src/modules/ui/now-playing-info/styles.core.css',
        selector: '.now-playing-info-content',
        property: 'gap',
        expected: 'var(--npi-space-10)',
    },
    {
        file: 'src/modules/ui/now-playing-info/styles.core.css',
        selector: '.now-playing-info-badge',
        property: 'padding',
        expected: 'var(--npi-space-3) var(--space-2)',
    },
    {
        file: 'src/modules/ui/now-playing-info/styles.css',
        selector: '.now-playing-info-actors',
        property: 'row-gap',
        expected: 'var(--npi-space-6)',
    },
    {
        file: 'src/modules/ui/now-playing-info/styles.css',
        selector: '.now-playing-info-actor-more',
        property: 'padding',
        expected: 'var(--npi-space-6) var(--npi-space-10)',
    },
    {
        file: 'src/modules/ui/playback-options/styles.core.css',
        selector: '.playback-options-list',
        property: 'gap',
        expected: 'var(--playback-options-space-10)',
    },
    {
        file: 'src/modules/ui/exit-confirm/styles.css',
        selector: '.exit-confirm-panel',
        property: 'padding',
        expected: 'var(--exit-confirm-space-26) var(--space-10) var(--exit-confirm-space-34)',
    },
    {
        file: 'src/modules/ui/exit-confirm/styles.css',
        selector: '.exit-confirm-inner',
        property: 'gap',
        expected: 'var(--exit-confirm-space-18) var(--exit-confirm-space-26)',
    },
    {
        file: 'src/modules/ui/exit-confirm/styles.css',
        selector: '.exit-confirm-action',
        property: 'padding',
        expected: 'var(--space-3) var(--exit-confirm-space-18)',
    },
    {
        file: 'src/modules/ui/settings/styles.core.css',
        selector: '.settings-categories',
        property: 'gap',
        expected: 'var(--settings-space-10)',
    },
    {
        file: 'src/modules/ui/settings/styles.core.css',
        selector: '.settings-category-button',
        property: 'padding',
        expected: 'var(--settings-space-14) var(--space-4)',
    },
    {
        file: 'src/modules/ui/settings/styles.core.css',
        selector: '.settings-profile-text',
        property: 'gap',
        expected: 'var(--settings-space-2)',
    },
    {
        file: 'src/modules/ui/settings/styles.core.css',
        selector: '.settings-profile-row',
        property: 'padding',
        expected: 'var(--settings-space-14) var(--space-4)',
    },
    {
        file: 'src/modules/ui/settings/styles.dropdown.css',
        selector: '.settings-dropdown',
        property: 'gap',
        expected: 'var(--settings-space-2)',
    },
    {
        file: 'src/modules/ui/settings/styles.dropdown.css',
        selector: '.settings-dropdown',
        property: 'padding',
        expected: 'var(--settings-space-6)',
    },
    {
        file: 'src/modules/ui/settings/styles.dropdown.css',
        selector: '.settings-dropdown-option',
        property: 'padding',
        expected: 'var(--settings-space-10) var(--settings-space-14)',
    },
    {
        file: 'src/styles/shell.chrome.css',
        selector: '.error-button',
        property: 'padding',
        expected: 'var(--space-3) var(--shell-space-18)',
    },
    {
        file: 'src/modules/ui/channel-setup/styles.core.css',
        selector: '.setup-preview',
        property: 'padding',
        expected: 'var(--space-3) var(--channel-setup-space-18) var(--space-3) var(--channel-setup-space-14)',
    },
    {
        file: 'src/modules/ui/playback-options/styles.core.css',
        selector: '.playback-options-helper',
        property: 'margin',
        expected: 'var(--playback-options-space-negative-4) 0 var(--space-3)',
    },
    {
        file: 'src/modules/ui/epg/styles.grid.css',
        selector: '.epg-time-indicator::after',
        property: 'padding',
        expected: 'var(--space-local-1) var(--space-local-5)',
    },
    {
        file: 'src/styles/shell.onboarding.shared-shell.css',
        selector: '.sr-only',
        property: 'margin',
        expected: 'var(--sr-only-space-negative-1)',
    },
];

const LOCAL_SPACING_VALUE_CONTRACTS: DeclarationContract[] = [
    {
        file: 'src/modules/ui/channel-transition/styles.css',
        selector: '.channel-transition-panel',
        property: '--runtime-overlay-space-10',
        expected: '10px',
    },
    {
        file: 'src/modules/ui/channel-transition/styles.css',
        selector: '.channel-transition-panel',
        property: '--runtime-overlay-space-14',
        expected: '14px',
    },
    {
        file: 'src/modules/ui/channel-number-overlay/styles.css',
        selector: '.channel-number-panel',
        property: '--runtime-overlay-space-10',
        expected: '10px',
    },
    {
        file: 'src/modules/ui/player-osd/styles.surface.css',
        selector: '.player-osd-panel',
        property: '--player-osd-space-6',
        expected: '6px',
    },
    {
        file: 'src/modules/ui/player-osd/styles.surface.css',
        selector: '.player-osd-panel',
        property: '--player-osd-space-10',
        expected: '10px',
    },
    {
        file: 'src/modules/ui/player-osd/styles.actions.css',
        selector: '.player-osd-actions',
        property: '--player-osd-actions-space-10',
        expected: '10px',
    },
    {
        file: 'src/modules/ui/player-osd/styles.meta-progress.css',
        selector: '.player-osd-meta-strip',
        property: '--player-osd-meta-space-18',
        expected: '18px',
    },
    {
        file: 'src/modules/ui/now-playing-info/styles.core.css',
        selector: '.now-playing-info-panel',
        property: '--npi-space-10',
        expected: '10px',
    },
    {
        file: 'src/modules/ui/now-playing-info/styles.css',
        selector: '.now-playing-info-actors',
        property: '--npi-space-6',
        expected: '6px',
    },
    {
        file: 'src/modules/ui/playback-options/styles.core.css',
        selector: '.playback-options-panel',
        property: '--playback-options-space-10',
        expected: '10px',
    },
    {
        file: 'src/modules/ui/exit-confirm/styles.css',
        selector: '.exit-confirm-container',
        property: '--exit-confirm-space-18',
        expected: '18px',
    },
    {
        file: 'src/modules/ui/settings/styles.core.css',
        selector: '.settings-screen',
        property: '--settings-space-10',
        expected: '10px',
    },
    {
        file: 'src/modules/ui/settings/styles.dropdown.css',
        selector: '.settings-dropdown',
        property: '--settings-space-6',
        expected: '6px',
    },
    {
        file: 'src/styles/shell.chrome.css',
        selector: ':root',
        property: '--shell-space-18',
        expected: '18px',
    },
    {
        file: 'src/modules/ui/playback-options/styles.core.css',
        selector: '.playback-options-panel',
        property: '--playback-options-space-negative-4',
        expected: '-4px',
    },
    {
        file: 'src/modules/ui/epg/styles.shell.css',
        selector: '.epg-container',
        property: '--space-local-5',
        expected: '5px',
    },
    {
        file: 'src/styles/shell.onboarding.shared-shell.css',
        selector: '.sr-only',
        property: '--sr-only-space-negative-1',
        expected: '-1px',
    },
];

const LOCAL_Z_INDEX_ALIAS_CONTRACTS: DeclarationContract[] = [
    {
        file: 'src/modules/ui/mini-guide/styles.core.css',
        selector: '.mini-guide',
        property: 'z-index',
        expected: 'var(--mini-guide-layer)',
    },
    {
        file: 'src/modules/ui/player-osd/styles.surface.css',
        selector: '.player-osd',
        property: 'z-index',
        expected: 'var(--player-osd-layer)',
    },
    {
        file: 'src/modules/ui/channel-badge/styles.css',
        selector: '.channel-badge',
        property: 'z-index',
        expected: 'var(--runtime-status-layer)',
    },
    {
        file: 'src/modules/ui/channel-transition/styles.css',
        selector: '.channel-transition',
        property: 'z-index',
        expected: 'var(--runtime-status-layer)',
    },
    {
        file: 'src/modules/ui/channel-number-overlay/styles.css',
        selector: '.channel-number-overlay',
        property: 'z-index',
        expected: 'var(--runtime-status-priority-layer)',
    },
    {
        file: 'src/modules/ui/epg/styles.shell.css',
        selector: '.epg-container',
        property: 'z-index',
        expected: 'var(--epg-overlay-layer)',
    },
    {
        file: 'src/styles/video.css',
        selector: '.video-container.epg-pip-active',
        property: 'z-index',
        expected: 'var(--video-epg-pip-layer)',
    },
];

const LOCAL_Z_INDEX_VALUE_CONTRACTS: DeclarationContract[] = [
    {
        file: 'src/modules/ui/mini-guide/styles.core.css',
        selector: '.mini-guide',
        property: '--mini-guide-layer',
        expected: '780',
    },
    {
        file: 'src/modules/ui/player-osd/styles.surface.css',
        selector: '.player-osd',
        property: '--player-osd-layer',
        expected: '800',
    },
    {
        file: 'src/modules/ui/channel-badge/styles.css',
        selector: '.channel-badge',
        property: '--runtime-status-layer',
        expected: '850',
    },
    {
        file: 'src/modules/ui/channel-transition/styles.css',
        selector: '.channel-transition',
        property: '--runtime-status-layer',
        expected: '850',
    },
    {
        file: 'src/modules/ui/channel-number-overlay/styles.css',
        selector: '.channel-number-overlay',
        property: '--runtime-status-priority-layer',
        expected: '860',
    },
    {
        file: 'src/modules/ui/epg/styles.shell.css',
        selector: '.epg-container',
        property: '--epg-overlay-layer',
        expected: '900',
    },
    {
        file: 'src/styles/video.css',
        selector: '.video-container.epg-pip-active',
        property: '--video-epg-pip-layer',
        expected: '999',
    },
];

const LOCAL_TYPOGRAPHY_VALUE_CONTRACTS: DeclarationContract[] = [
    {
        file: 'src/modules/ui/channel-setup/styles.core.css',
        selector: '#channel-setup-container',
        property: '--channel-setup-font-size-15',
        expected: '15px',
    },
    {
        file: 'src/modules/ui/epg/styles.shell.css',
        selector: '.epg-container',
        property: '--epg-font-size-classic-title',
        expected: '25px',
    },
    {
        file: 'src/styles/themes.css',
        selector: '.theme-swiss',
        property: '--theme-swiss-title-size-hero',
        expected: '34px',
    },
];

const COLOR_CONTRACTS: DeclarationContract[] = [
    {
        file: 'src/modules/ui/settings/styles.core.css',
        selector: '.settings-hint',
        property: 'color',
        expected: 'var(--color-text-muted)',
    },
    {
        file: 'src/modules/ui/settings/styles.core.css',
        selector: '.settings-category-button',
        property: 'color',
        expected: 'var(--color-text-primary)',
    },
    {
        file: 'src/modules/ui/settings/styles.core.css',
        selector: '.settings-category-button.active',
        property: 'color',
        expected: 'var(--color-text-primary)',
    },
    {
        file: 'src/modules/ui/settings/styles.core.css',
        selector: '.settings-detail-title',
        property: 'color',
        expected: 'var(--color-text-primary)',
    },
    {
        file: 'src/modules/ui/settings/styles.core.css',
        selector: '.settings-profile-row',
        property: 'color',
        expected: 'var(--color-text-primary)',
    },
    {
        file: 'src/modules/ui/settings/styles.core.css',
        selector: '.settings-profile-action',
        property: 'color',
        expected: 'var(--color-text-muted)',
    },
    {
        file: 'src/modules/ui/settings/styles.core.css',
        selector: '.settings-empty',
        property: 'color',
        expected: 'var(--color-text-muted)',
    },
    {
        file: 'src/modules/ui/settings/styles.core.css',
        selector: '.setup-toggle-arrow',
        property: 'color',
        expected: 'var(--color-text-secondary)',
    },
    {
        file: 'src/modules/ui/settings/styles.theme.css',
        selector: '.theme-glass .settings-category-button.active',
        property: 'color',
        expected: 'var(--color-text-primary)',
    },
    {
        file: 'src/modules/ui/settings/styles.theme.css',
        selector: '.theme-directv .settings-category-button.active',
        property: 'color',
        expected: 'var(--color-text-primary)',
    },
    {
        file: 'src/modules/ui/settings/styles.dropdown.css',
        selector: '.settings-dropdown-option',
        property: 'color',
        expected: 'var(--color-text-primary)',
    },
    {
        file: 'src/modules/ui/settings/styles.dropdown.css',
        selector: '.settings-dropdown-option--selected',
        property: 'color',
        expected: 'var(--color-primary-light)',
    },
    {
        file: 'src/modules/ui/settings/styles.dropdown.css',
        selector: '.settings-dropdown-option-check',
        property: 'color',
        expected: 'var(--color-primary)',
    },
    {
        file: 'src/modules/ui/settings/styles.dropdown.css',
        selector: '.setup-toggle-chevron',
        property: 'color',
        expected: 'var(--color-text-muted)',
    },
    {
        file: 'src/modules/ui/playback-options/styles.core.css',
        selector: '.playback-options-section-title',
        property: 'color',
        expected: 'var(--color-text-muted)',
    },
    {
        file: 'src/modules/ui/playback-options/styles.core.css',
        selector: '.playback-options-empty',
        property: 'color',
        expected: 'var(--color-text-muted)',
    },
    {
        file: 'src/modules/ui/channel-badge/styles.css',
        selector: '.channel-badge-icon',
        property: 'color',
        expected: 'var(--color-text-primary)',
    },
    {
        file: 'src/modules/ui/channel-badge/styles.css',
        selector: '.channel-badge-text',
        property: 'color',
        expected: 'var(--color-text-primary)',
    },
    {
        file: 'src/modules/ui/channel-transition/styles.css',
        selector: '.channel-transition-panel',
        property: 'color',
        expected: 'var(--color-text-primary)',
    },
    {
        file: 'src/modules/ui/channel-number-overlay/styles.css',
        selector: '.channel-number-overlay.channel-number-error .channel-number-panel',
        property: 'border-color',
        expected: 'var(--color-error)',
    },
    {
        file: 'src/modules/ui/channel-number-overlay/styles.css',
        selector: '.channel-number-overlay.channel-number-error .channel-number-digits',
        property: 'color',
        expected: 'var(--color-error-text)',
    },
    {
        file: 'src/modules/ui/player-osd/styles.content.css',
        selector: '.player-osd-sleep',
        property: 'background',
        expected: 'var(--osd-pill-bg)',
    },
    {
        file: 'src/modules/ui/player-osd/styles.content.css',
        selector: '.player-osd-sleep',
        property: 'border',
        expected: '1px solid var(--osd-pill-border)',
    },
    {
        file: 'src/modules/ui/player-osd/styles.actions.css',
        selector: '.player-osd-action',
        property: '--osd-focus-outline',
        expected: '2px solid var(--color-text-primary)',
    },
    {
        file: 'src/modules/ui/epg/styles.theme.css',
        selector: '.theme-directv .epg-container.layout-classic .epg-cell-meta',
        property: 'color',
        expected: 'var(--epg-directv-copy-secondary)',
    },
    {
        file: 'src/modules/ui/now-playing-info/styles.core.css',
        selector: '.now-playing-info-badge',
        property: 'color',
        expected: 'var(--color-text-primary)',
    },
    {
        file: 'src/modules/ui/now-playing-info/styles.css',
        selector: '.now-playing-info-actor',
        property: 'color',
        expected: 'var(--color-text-primary)',
    },
    {
        file: 'src/modules/ui/now-playing-info/styles.css',
        selector: '.now-playing-info-actor-more',
        property: 'color',
        expected: 'var(--color-text-primary)',
    },
    {
        file: 'src/modules/ui/mini-guide/styles.core.css',
        selector: '.mini-guide-row.focused',
        property: 'border-left',
        expected: '3px solid var(--focus-color)',
    },
    {
        file: 'src/modules/ui/mini-guide/styles.core.css',
        selector: '.mini-guide-start-time',
        property: 'color',
        expected: 'var(--color-text-muted)',
    },
    {
        file: 'src/styles/shell.chrome.css',
        selector: '#dev-menu',
        property: 'color',
        expected: 'var(--color-text-primary)',
    },
    {
        file: 'src/styles/shell.chrome.css',
        selector: '#app-toast',
        property: 'color',
        expected: 'var(--color-text-primary)',
    },
    {
        file: 'src/styles/shell.chrome.css',
        selector: '.error-button',
        property: 'color',
        expected: 'var(--color-text-primary)',
    },
];

const BOUNDED_COLOR_EXCEPTION_CONTRACTS: DeclarationContract[] = [
    {
        file: 'src/modules/ui/player-osd/styles.actions.css',
        selector: '.player-osd-action.focused',
        property: 'background',
        expected: 'rgba(255, 255, 255, 0.92)',
    },
    {
        file: 'src/modules/ui/player-osd/styles.actions.css',
        selector: '.player-osd-action.focused',
        property: 'border-color',
        expected: 'rgba(255, 255, 255, 0.98)',
    },
    {
        file: 'src/modules/ui/player-osd/styles.actions.css',
        selector: '.player-osd-action.focused',
        property: 'color',
        expected: 'var(--color-text-on-focus)',
    },
    {
        file: 'src/modules/ui/exit-confirm/styles.css',
        selector: '.exit-confirm-action.focused',
        property: 'background',
        expected: 'rgba(255, 255, 255, 0.92)',
    },
    {
        file: 'src/modules/ui/exit-confirm/styles.css',
        selector: '.exit-confirm-action.focused',
        property: 'border-color',
        expected: 'rgba(255, 255, 255, 0.92)',
    },
    {
        file: 'src/modules/ui/exit-confirm/styles.css',
        selector: '.exit-confirm-action.focused',
        property: 'color',
        expected: 'var(--color-text-on-focus)',
    },
    {
        file: 'src/modules/ui/exit-confirm/styles.css',
        selector: '.exit-confirm-action:focus-visible:not(.focused)',
        property: 'background',
        expected: 'rgba(255, 255, 255, 0.92)',
    },
    {
        file: 'src/modules/ui/exit-confirm/styles.css',
        selector: '.exit-confirm-action:focus-visible:not(.focused)',
        property: 'border-color',
        expected: 'rgba(255, 255, 255, 0.92)',
    },
    {
        file: 'src/modules/ui/exit-confirm/styles.css',
        selector: '.exit-confirm-action:focus-visible:not(.focused)',
        property: 'color',
        expected: 'var(--color-text-on-focus)',
    },
];

const readCss = (file: string): string => readComposedCss(file);

describe('runtime token style contracts', () => {
    it.each(TYPOGRAPHY_CONTRACTS)(
        'maps $selector in $file to $expected',
        ({ file, selector, expected }) => {
            const css = read(file);
            expect(declarationValue(blockFor(css, selector), 'font-size')).toBe(expected);
        }
    );

    it('maps the compact settings category typography to the approved token inside the responsive breakpoint', () => {
        const css = read('src/modules/ui/settings/styles.core.css');
        const responsiveBlock = blockWithin(css, '@media (max-width: 980px)', '.settings-category-button');

        expect(declarationValue(responsiveBlock, 'font-size')).toBe('var(--text-md)');
    });

    it.each(SPACING_CONTRACTS)(
        'maps $property for $selector in $file to $expected',
        ({ file, selector, property, expected, within }) => {
            const css = readCss(file);
            const block = within
                ? blockWithin(css, within, selector)
                : topLevelBlockForProperty(css, selector, property);

            expect(declarationValue(block, property)).toBe(expected);
        }
    );

    it.each(LOCAL_SPACING_ALIAS_CONTRACTS)(
        'enforces local spacing alias $property for $selector in $file as $expected',
        ({ file, selector, property, expected, within }) => {
            const css = readCss(file);
            const block = within
                ? blockWithin(css, within, selector)
                : topLevelBlockForProperty(css, selector, property);

            expect(declarationValue(block, property)).toBe(expected);
        }
    );

    it.each(LOCAL_SPACING_VALUE_CONTRACTS)(
        'pins local spacing variable $property for $selector in $file at $expected',
        ({ file, selector, property, expected, within }) => {
            const css = readCss(file);
            const block = within
                ? blockWithin(css, within, selector)
                : topLevelBlockForProperty(css, selector, property);

            expect(declarationValue(block, property)).toBe(expected);
        }
    );

    it.each(LOCAL_Z_INDEX_ALIAS_CONTRACTS)(
        'enforces local z-index alias $property for $selector in $file as $expected',
        ({ file, selector, property, expected, within }) => {
            const css = readCss(file);
            const block = within
                ? blockWithin(css, within, selector)
                : topLevelBlockForProperty(css, selector, property);

            expect(declarationValue(block, property)).toBe(expected);
        }
    );

    it.each(LOCAL_Z_INDEX_VALUE_CONTRACTS)(
        'pins local z-index variable $property for $selector in $file at $expected',
        ({ file, selector, property, expected, within }) => {
            const css = readCss(file);
            const block = within
                ? blockWithin(css, within, selector)
                : topLevelBlockForProperty(css, selector, property);

            expect(declarationValue(block, property)).toBe(expected);
        }
    );

    it.each(LOCAL_TYPOGRAPHY_VALUE_CONTRACTS)(
        'pins local typography variable $property for $selector in $file at $expected',
        ({ file, selector, property, expected, within }) => {
            const css = readCss(file);
            const block = within
                ? blockWithin(css, within, selector)
                : topLevelBlockForProperty(css, selector, property);

            expect(declarationValue(block, property)).toBe(expected);
        }
    );

    it('keeps the root z-index token contract coarse-grained', () => {
        const tokensCss = read('src/styles/tokens.css');

        expect(tokensCss).not.toContain('--z-overlay-context');
        expect(tokensCss).not.toContain('--z-overlay-primary');
        expect(tokensCss).not.toContain('--z-overlay-status');
        expect(tokensCss).not.toContain('--z-overlay-status-priority');
        expect(tokensCss).not.toContain('--z-overlay-guide');
        expect(tokensCss).not.toContain('--z-overlay-video-priority');
    });

    it('keeps root z-index tokens strictly increasing', () => {
        const tokensCss = read('src/styles/tokens.css');

        const readNumericToken = (name: string): number => {
            const match = tokensCss.match(new RegExp(`${name}:\\s*(\\d+);`));

            expect(match?.[1]).toBeDefined();

            return Number(match![1]);
        };

        const zBase = readNumericToken('--z-base');
        const zDropdown = readNumericToken('--z-dropdown');
        const zModal = readNumericToken('--z-modal');
        const zOverlay = readNumericToken('--z-overlay');
        const zToast = readNumericToken('--z-toast');
        const zMax = readNumericToken('--z-max');

        expect(zBase).toBeLessThan(zDropdown);
        expect(zDropdown).toBeLessThan(zModal);
        expect(zModal).toBeLessThan(zOverlay);
        expect(zOverlay).toBeLessThan(zToast);
        expect(zToast).toBeLessThan(zMax);
    });

    it.each(COLOR_CONTRACTS)(
        'maps $property for $selector in $file to $expected',
        ({ file, selector, property, expected, within }) => {
            const css = readCss(file);
            const block = within
                ? blockWithin(css, within, selector)
                : topLevelBlockForProperty(css, selector, property);

            expect(declarationValue(block, property)).toBe(expected);
        }
    );

    it('keeps the playback helper color override on the approved shared text token', () => {
        const css = readCss('src/modules/ui/playback-options/styles.core.css');

        expect(css).toMatch(
            /\.playback-options-helper\s*\{[^}]*color:\s*var\(--color-text-secondary\);/s
        );
    });

    it('maps the stronger OSD pill chrome to the shared pill tokens', () => {
        const css = readCss('src/modules/ui/player-osd/styles.content.css');

        expect(css).toMatch(/\.osd-pill\s*\{[^}]*background:\s*var\(--osd-pill-bg-strong\);/s);
        expect(css).toMatch(/\.osd-pill\s*\{[^}]*border-color:\s*var\(--osd-pill-border-strong\);/s);
    });

    it('retires the approved shared color literals across the runtime seam', () => {
        for (const file of COLOR_SCOPE_FILES) {
            const css = readCss(file);
            expect(css).not.toMatch(SHARED_COLOR_LITERAL_PATTERN);
        }
    });

    it.each(BOUNDED_COLOR_EXCEPTION_CONTRACTS)(
        'keeps the approved bright-focus color exception $property for $selector in $file at $expected',
        ({ file, selector, property, expected, within }) => {
            const css = readCss(file);
            const block = within
                ? blockWithin(css, within, selector)
                : topLevelBlockForProperty(css, selector, property);

            expect(declarationValue(block, property)).toBe(expected);
        }
    );

    it('keeps bright-focus white literals bounded to the approved focus selectors', () => {
        const filesWithMatches = COLOR_SCOPE_FILES.filter((file) => {
            const matches = readCss(file).match(BRIGHT_FOCUS_LITERAL_PATTERN);
            return matches !== null && matches.length > 0;
        });

        expect(filesWithMatches).toEqual([
            'src/modules/ui/exit-confirm/styles.css',
            'src/modules/ui/player-osd/styles.actions.css',
        ]);
    });
});
