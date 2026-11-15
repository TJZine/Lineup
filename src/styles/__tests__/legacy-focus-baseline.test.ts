/** @jest-environment node */

// This source-level contract does not replace Chromium 79 or LG rendering checks.

import {
    blockFor,
    blockWithin,
    declarationValue,
    read,
    splitSelectorList,
    topLevelBlockForProperty,
} from './helpers/css-test-utils';

const readFocusSelectors = (block: string): string[] =>
    splitSelectorList(block.slice(0, block.indexOf('{')));

const selectorGroups = (css: string): string[][] => [...css.matchAll(/([^{}]+)\{[^{}]*\}/gu)]
    .map((match) => (match[1] ?? '').trim())
    .filter((header) => header.length > 0 && !header.startsWith('@'))
    .map(splitSelectorList);

describe('legacy focus baseline contract', () => {
    const guideCells = read('src/modules/ui/epg/styles.cells.css');
    const guideGrid = read('src/modules/ui/epg/styles.grid.css');
    const guideShell = read('src/modules/ui/epg/styles.shell.css');
    const setupCore = read('src/modules/ui/channel-setup/styles.core.css');
    const setupReview = read('src/modules/ui/channel-setup/styles.review-progress.css');
    const setupStrategy = read('src/modules/ui/channel-setup/styles.strategy.css');
    const audioSetup = read('src/modules/ui/audio-setup/styles.css');
    const profileCards = read('src/modules/ui/profile-select/styles.cards.css');
    const profilePin = read('src/modules/ui/profile-select/styles.pin-modal.css');
    const onboardingAuth = read('src/styles/shell.onboarding.auth.css');
    const setup = read('src/styles/shell.onboarding.setup.css');
    const onboardingShared = read('src/styles/shell.onboarding.shared-shell.css');
    const shellChrome = read('src/styles/shell.chrome.css');
    const settingsCore = read('src/modules/ui/settings/styles.core.css');
    const retainedCss = [
        guideCells,
        guideGrid,
        guideShell,
        read('src/modules/ui/epg/styles.classic.css'),
        read('src/modules/ui/epg/styles.theme.css'),
        setupCore,
        read('src/modules/ui/channel-setup/styles.library.css'),
        setupReview,
        setupStrategy,
        audioSetup,
        profileCards,
        read('src/modules/ui/profile-select/styles.layout.css'),
        profilePin,
        read('src/modules/ui/server-select/styles.css'),
        read('src/modules/ui/mini-guide/styles.core.css'),
        read('src/modules/ui/mini-guide/styles.theme.css'),
        read('src/styles/shell.onboarding.server-selection.css'),
        onboardingAuth,
        setup,
        onboardingShared,
        shellChrome,
        settingsCore,
        read('src/modules/ui/channel-number-overlay/styles.css'),
        read('src/modules/ui/channel-badge/styles.css'),
        read('src/modules/ui/channel-transition/styles.css'),
    ];

    it('keeps native Guide cell focus separate from the remembered remote-focus class', () => {
        const nativeFocus = blockFor(guideCells, '.epg-cell:focus:not(.focused)');
        const remoteFocus = blockFor(guideCells, '.epg-cell.focused');
        const channelRowFocus = blockFor(guideGrid, '.epg-channel-row:focus:not(.focused)');

        expect(readFocusSelectors(nativeFocus)).toEqual(['.epg-cell:focus:not(.focused)']);
        expect(declarationValue(nativeFocus, 'outline'))
            .toBe('var(--focus-ring-width) solid var(--focus-border-color)');
        expect(declarationValue(nativeFocus, 'outline-offset')).toBe('var(--focus-ring-offset)');
        expect(declarationValue(remoteFocus, 'outline')).toBe('none');

        const forcedColorsFocus = blockWithin(
            guideCells,
            '@media (forced-colors: active)',
            '.epg-cell:focus:not(.focused)'
        );
        expect(declarationValue(forcedColorsFocus, 'outline'))
            .toBe('var(--focus-ring-width) solid CanvasText');
        expect(declarationValue(channelRowFocus, 'outline'))
            .toBe('var(--focus-ring-width) solid var(--focus-border-color)');
        expect(declarationValue(channelRowFocus, 'outline-offset')).toBe('var(--focus-ring-offset)');

        const searchFocus = blockFor(guideShell, '.epg-search-input:focus');
        const emptyStateFocus = blockFor(guideShell, '.epg-empty-state button:focus');
        expect(declarationValue(searchFocus, 'outline'))
            .toBe('var(--focus-ring-width) solid var(--focus-border-color)');
        expect(readFocusSelectors(emptyStateFocus)).toEqual([
            '.epg-menu-overlay button.epg-toolbar-focused',
            '.epg-empty-state button:focus',
        ]);
    });

    it('keeps onboarding remote and native focus rules valid without :focus-visible', () => {
        const focus = blockFor(setup, '.setup-toggle:focus');
        const focusRing = blockFor(setup, '.setup-toggle:focus::after');

        expect(readFocusSelectors(focus)).toEqual(['.setup-toggle.focused', '.setup-toggle:focus']);
        expect(declarationValue(focus, 'background'))
            .toBe('var(--onboarding-focus-bg, rgba(255, 255, 255, 0.16))');
        expect(readFocusSelectors(focusRing)).toEqual([
            '.setup-toggle.focused::after',
            '.setup-toggle:focus::after',
        ]);
        expect(setup).not.toContain(':focus-visible');
    });

    it('keeps the shared blocking-error focus ring independently matchable', () => {
        const focusRing = blockFor(shellChrome, '.error-button:focus::after');

        expect(readFocusSelectors(focusRing)).toEqual([
            '.error-button.focused::after',
            '.error-button:focus::after',
        ]);
        expect(declarationValue(focusRing, 'box-shadow'))
            .toBe('0 0 0 var(--focus-ring-width, 3px) var(--focus-color) inset');
        expect(shellChrome).not.toContain(':focus-visible');
    });

    it('keeps Configure and Review focus selectors independently valid', () => {
        const dropdown = topLevelBlockForProperty(setupCore, '.setup-dropdown-option:focus', 'outline');
        const category = blockFor(setupStrategy, '.setup-category-button:focus');
        const programmingInput = blockFor(
            setupStrategy,
            '#channel-setup-container .setup-programming-input:focus'
        );
        const reviewConfirm = blockFor(setupReview, '.setup-replace-confirm:focus');
        const reviewConfirmRing = blockFor(setupReview, '.setup-replace-confirm:focus::after');
        const reviewRow = blockFor(setupReview, '#channel-setup-container .setup-review-row:focus');

        expect(readFocusSelectors(dropdown)).toEqual([
            '.setup-dropdown-option.focused',
            '.setup-dropdown-option:focus',
        ]);
        expect(declarationValue(dropdown, 'outline'))
            .toBe('var(--focus-ring-width) solid var(--focus-border-color)');
        expect(readFocusSelectors(category)).toEqual([
            '.setup-category-button.focused',
            '.setup-category-button:focus',
        ]);
        expect(declarationValue(programmingInput, 'outline'))
            .toBe('var(--focus-ring-width) solid var(--focus-border-color)');
        expect(readFocusSelectors(reviewConfirm)).toEqual([
            '.setup-replace-confirm.focused',
            '.setup-replace-confirm:focus',
        ]);
        expect(readFocusSelectors(reviewConfirmRing)).toEqual([
            '.setup-replace-confirm.focused::after',
            '.setup-replace-confirm:focus::after',
        ]);
        expect(declarationValue(reviewRow, 'outline'))
            .toBe('var(--focus-ring-width) solid var(--focus-border-color)');
    });

    it('keeps Audio Setup and profile card/PIN focus separate from selection', () => {
        const audioChoice = blockFor(
            audioSetup,
            '.screen.audio-setup-screen .setup-toggle.audio-choice:focus'
        );
        const selectedAudioChoice = blockFor(
            audioSetup,
            '.screen.audio-setup-screen .setup-toggle.audio-choice.selected:focus'
        );
        const profileActive = blockFor(profileCards, '.profile-row.active');
        const profileFocus = blockFor(profileCards, '.profile-row:focus');
        const pinFocus = blockFor(profilePin, '.profile-pin-cancel:focus');

        expect(readFocusSelectors(audioChoice)).toEqual([
            '.screen.audio-setup-screen .setup-toggle.audio-choice.focused',
            '.screen.audio-setup-screen .setup-toggle.audio-choice:focus',
        ]);
        expect(declarationValue(audioChoice, 'outline'))
            .toBe('var(--focus-ring-width) solid var(--focus-border-color)');
        expect(declarationValue(selectedAudioChoice, 'background')).toBe('var(--selection-surface)');
        expect(declarationValue(profileActive, 'background')).toBe('var(--selection-surface)');
        expect(declarationValue(profileFocus, 'background')).toBe('var(--focus-surface)');
        expect(declarationValue(pinFocus, 'outline'))
            .toBe('var(--focus-ring-width) solid var(--focus-border-color)');
    });

    it('keeps onboarding focus selectors valid on the baseline engine', () => {
        const authFocus = blockFor(onboardingAuth, '.auth-link-action:focus');
        const onboardingButton = blockFor(onboardingShared, '.screen-button:focus');

        expect(readFocusSelectors(authFocus)).toEqual([
            '.auth-link-action.focused',
            '.auth-link-action:focus',
        ]);
        expect(declarationValue(authFocus, 'outline'))
            .toBe('var(--focus-ring-width) solid var(--focus-border-color)');
        expect(readFocusSelectors(onboardingButton)).toEqual([
            '.screen-button.focused',
            '.screen-button:focus',
        ]);
        expect(declarationValue(onboardingButton, 'outline'))
            .toBe('var(--focus-ring-width) solid var(--focus-border-color)');
    });

    it('never groups a baseline focus selector with unsupported focus-visible, is, or where selectors', () => {
        const mixedGroups = retainedCss.flatMap((css) => selectorGroups(css)).filter((selectors) =>
            selectors.some((selector) => selector.includes(':focus-visible'))
            && selectors.some((selector) => !selector.includes(':focus-visible'))
        );

        expect(mixedGroups).toEqual([]);
        expect(retainedCss.join('\n')).not.toMatch(/:(?:is|where)\(/u);
    });

    it('does not require :focus-visible to preserve persistent Settings selection', () => {
        const selectedOnly = blockFor(
            settingsCore,
            '.settings-screen .setup-toggle.selected:not(.focused):not(:focus)'
        );

        expect(readFocusSelectors(selectedOnly)).toEqual([
            '.settings-screen .setup-toggle.selected:not(.focused):not(:focus)',
        ]);
        expect(declarationValue(selectedOnly, 'background')).toBe('rgba(255, 255, 255, 0.08)');
        expect(settingsCore).not.toContain(':focus-visible');
    });
});
