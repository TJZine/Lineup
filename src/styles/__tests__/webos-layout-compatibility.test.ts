/** @jest-environment node */

import {
    blockFor,
    blockWithin,
    declarationValue,
    read,
    topLevelBlockForProperty,
} from './helpers/css-test-utils';

const WRAPPING_FILES = [
    'src/modules/ui/channel-air-check/styles.css',
    'src/modules/ui/channel-setup/styles.library.css',
    'src/modules/ui/channel-setup/styles.review-progress.css',
    'src/modules/ui/channel-setup/styles.strategy.css',
    'src/modules/ui/channel-studio/styles.css',
    'src/modules/ui/channels/styles.css',
    'src/modules/ui/epg/styles.grid.css',
    'src/modules/ui/profile-select/styles.cards.css',
    'src/modules/ui/profile-select/styles.pin-modal.css',
    'src/modules/ui/settings/styles.tv.css',
    'src/styles/shell.onboarding.server-selection.css',
    'src/styles/shell.onboarding.shared-shell.css',
] as const;

const lastMobileBlock = (css: string, selector: string): string => {
    const media = '@media (max-width: 800px)';
    const start = css.lastIndexOf(media);
    expect(start).toBeGreaterThanOrEqual(0);
    return blockWithin(css.slice(start), media, selector);
};

describe('webOS 6 layout source compatibility', () => {
    it('keeps physical spacing before progressive logical properties', () => {
        const cases = [
            {
                file: 'src/modules/ui/channel-setup/styles.core.css',
                selector: '#channel-setup-container .setup-scroll',
                physical: ['margin-left', 'margin-right'],
                logical: 'margin-inline',
                value: 'auto',
            },
            {
                file: 'src/modules/ui/channel-setup/styles.review-progress.css',
                selector: '#channel-setup-container .setup-review-row',
                physical: ['padding-left', 'padding-right'],
                logical: 'padding-inline',
                value: '16px',
            },
            {
                file: 'src/modules/ui/channel-studio/styles.css',
                selector: '.channel-studio .studio-link',
                physical: ['padding-left', 'padding-right'],
                logical: 'padding-inline',
                value: '0',
            },
        ] as const;

        for (const { file, selector, physical, logical, value } of cases) {
            const block = topLevelBlockForProperty(read(file), selector, logical);
            for (const property of physical) {
                expect(declarationValue(block, property)).toBe(value);
                expect(block.indexOf(`${property}:`)).toBeLessThan(block.indexOf(`${logical}:`));
            }
            expect(declarationValue(block, logical)).toBe(value);
        }
    });

    it('allows long names and report text to wrap before anywhere support', () => {
        let declarations = 0;
        for (const file of WRAPPING_FILES) {
            const css = read(file);
            for (const match of css.matchAll(/^[ \t]*overflow-wrap: anywhere;/gm)) {
                const preceding = css.slice(0, match.index).trimEnd();
                expect(preceding.endsWith('overflow-wrap: break-word;')).toBe(true);
                declarations += 1;
            }
        }
        expect(declarations).toBeGreaterThan(0);
    });

    it('switches legacy flex spacing with the responsive direction', () => {
        const studio = read('src/modules/ui/channel-studio/styles.css');
        expect(declarationValue(blockFor(studio, '.studio-header'), 'display')).toBe('grid');
        expect(declarationValue(blockFor(studio, '.studio-header'), 'gap')).toBe('8px 24px');
        expect(declarationValue(blockWithin(studio, '@media (max-width: 800px)', '.studio-header'), 'display')).toBe('flex');
        expect(declarationValue(blockWithin(studio, '@media (max-width: 800px)', '.studio-header'), 'flex-wrap')).toBe('wrap');
        const studioFallback = lastMobileBlock(studio, '.no-flex-gap .studio-header');
        expect(declarationValue(studioFallback, 'margin-right')).toBe('-24px');
        expect(declarationValue(studioFallback, 'margin-bottom')).toBe('-8px');
        const ordinaryChild = '.no-flex-gap .studio-header > :not([hidden]):not(.studio-header-actions)';
        expect(declarationValue(lastMobileBlock(studio, ordinaryChild), 'margin-right')).toBe('24px');
        expect(declarationValue(lastMobileBlock(studio, ordinaryChild), 'margin-bottom')).toBe('8px');

        const nestedActions = blockFor(studio, '.no-flex-gap .studio-header-actions');
        const nestedActionChild = blockFor(studio, '.no-flex-gap .studio-header-actions > :not([hidden])');
        expect(declarationValue(nestedActions, 'margin-right')).toBe('calc(-1 * 12px)');
        expect(declarationValue(nestedActions, 'margin-bottom')).toBe('calc(-1 * 12px)');
        expect(declarationValue(nestedActionChild, 'margin-right')).toBe('12px');
        expect(declarationValue(nestedActionChild, 'margin-bottom')).toBe('12px');

        const mobileActions = lastMobileBlock(studio, '.no-flex-gap .studio-header > .studio-header-actions:not([hidden])');
        expect(declarationValue(mobileActions, 'margin-right')).toBe('12px');
        expect(declarationValue(mobileActions, 'margin-bottom')).toBe('-4px');
        expect(declarationValue(mobileActions, 'width')).toBe('calc(100% - 12px)');

        const review = read('src/modules/ui/channel-setup/styles.review-progress.css');
        const inventory = '.no-flex-gap #channel-setup-container .setup-inventory-line > :not([hidden]) ~ :not([hidden])';
        expect(declarationValue(blockFor(review, '#channel-setup-container .setup-inventory-line'), 'gap')).toBe('12px');
        expect(declarationValue(blockWithin(review, '@media (max-width: 800px)', '#channel-setup-container .setup-inventory-line'), 'flex-direction')).toBe('column');
        expect(declarationValue(blockFor(review, inventory), 'margin-left')).toBe('12px');
        expect(declarationValue(lastMobileBlock(review, inventory), 'margin-left')).toBe('0');
        expect(declarationValue(lastMobileBlock(review, inventory), 'margin-top')).toBe('12px');

        const strategy = read('src/modules/ui/channel-setup/styles.strategy.css');
        const footer = '.no-flex-gap #channel-setup-container .setup-configure-footer > :not([hidden]) ~ :not([hidden])';
        expect(declarationValue(blockFor(strategy, '#channel-setup-container .setup-configure-footer'), 'gap')).toBe('24px');
        expect(declarationValue(blockWithin(strategy, '@media (max-width: 800px)', '#channel-setup-container .setup-configure-footer'), 'flex-direction')).toBe('column');
        expect(declarationValue(blockWithin(strategy, '@media (max-width: 800px)', '#channel-setup-container .setup-configure-footer'), 'gap')).toBe('16px');
        expect(declarationValue(blockFor(strategy, footer), 'margin-left')).toBe('24px');
        expect(declarationValue(lastMobileBlock(strategy, footer), 'margin-left')).toBe('0');
        expect(declarationValue(lastMobileBlock(strategy, footer), 'margin-top')).toBe('16px');
    });
});
