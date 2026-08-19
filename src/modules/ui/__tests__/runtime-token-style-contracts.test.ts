/**
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import {
    declarationValue,
    read,
    readComposedCss,
    topLevelBlockForProperty,
} from '../../../styles/__tests__/helpers/css-test-utils';

const RUNTIME_COLOR_FILES = [
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
const SHARED_TOKEN_DEFINITION_PATTERN = /(--(?:color|space|text|z)-[\w-]+)\s*:/g;
const SHARED_TOKEN_REFERENCE_PATTERN = /var\((--(?:color|space|text|z)-[\w-]+)/g;
const LOCAL_SHARED_TOKEN_OWNERS = [
    {
        prefix: '--space-local-',
        root: 'src/modules/ui/epg/',
    },
] as const;

const exitConfirmFocusBlock = (css: string): string => {
    const block = css.match(
        /\.exit-confirm-action\.focused,\s*\.exit-confirm-action:focus-visible:not\(\.focused\)\s*\{[^}]*\}/s
    )?.[0];
    if (!block) throw new Error('Exit-confirm focus selector block not found');
    return block;
};

const cssFiles = (directory = path.join(process.cwd(), 'src')): string[] =>
    fs.readdirSync(directory, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.css'))
        .map((entry) =>
            path.relative(process.cwd(), path.join(entry.parentPath, entry.name))
                .split(path.sep)
                .join('/')
        )
        .sort();

type CssSource = {
    file: string;
    css: string;
};

const collectTokens = (css: string, pattern: RegExp): Set<string> =>
    new Set(Array.from(css.matchAll(pattern), (match) => match[1]!));

const findMissingSharedTokenReferences = (
    sources: CssSource[],
    canonicalTokenCss: string
): string[] => {
    const canonicalDefinitions = collectTokens(
        canonicalTokenCss,
        SHARED_TOKEN_DEFINITION_PATTERN
    );
    const localDefinitions = LOCAL_SHARED_TOKEN_OWNERS.map((owner) => ({
        ...owner,
        definitions: new Set(
            sources
                .filter(({ file }) => file.startsWith(owner.root))
                .flatMap(({ css }) =>
                    Array.from(collectTokens(css, SHARED_TOKEN_DEFINITION_PATTERN))
                )
                .filter((token) => token.startsWith(owner.prefix))
        ),
    }));

    return sources.flatMap(({ file, css }) =>
        Array.from(collectTokens(css, SHARED_TOKEN_REFERENCE_PATTERN))
            .filter((token) => {
                if (canonicalDefinitions.has(token)) return false;
                return !localDefinitions.some(
                    (owner) =>
                        file.startsWith(owner.root) &&
                        token.startsWith(owner.prefix) &&
                        owner.definitions.has(token)
                );
            })
            .map((token) => `${file}: ${token}`)
    );
};

const RUNTIME_LAYERS = [
    {
        name: 'mini-guide',
        file: 'src/modules/ui/mini-guide/styles.core.css',
        selector: '.mini-guide',
        variable: '--mini-guide-layer',
    },
    {
        name: 'player OSD',
        file: 'src/modules/ui/player-osd/styles.surface.css',
        selector: '.player-osd',
        variable: '--player-osd-layer',
    },
    {
        name: 'channel transition',
        file: 'src/modules/ui/channel-transition/styles.css',
        selector: '.channel-transition',
        variable: '--runtime-status-layer',
    },
    {
        name: 'channel badge',
        file: 'src/modules/ui/channel-badge/styles.css',
        selector: '.channel-badge',
        variable: '--runtime-status-layer',
    },
    {
        name: 'channel number overlay',
        file: 'src/modules/ui/channel-number-overlay/styles.css',
        selector: '.channel-number-overlay',
        variable: '--runtime-status-priority-layer',
    },
    {
        name: 'EPG',
        file: 'src/modules/ui/epg/styles.shell.css',
        selector: '.epg-container',
        variable: '--epg-overlay-layer',
    },
    {
        name: 'video EPG PiP',
        file: 'src/styles/video.css',
        selector: '.video-container.epg-pip-active',
        variable: '--video-epg-pip-layer',
    },
] as const;

const runtimeLayerBlock = ({ file, selector, variable }: (typeof RUNTIME_LAYERS)[number]): string =>
    topLevelBlockForProperty(readComposedCss(file), selector, variable);

const runtimeLayerValue = (layer: (typeof RUNTIME_LAYERS)[number]): number =>
    Number(declarationValue(runtimeLayerBlock(layer), layer.variable));

describe('runtime token style contracts', () => {
    it('defines shared runtime tokens in their canonical or bounded local owner', () => {
        const sources = cssFiles().map((file) => ({ file, css: read(file) }));

        expect(
            findMissingSharedTokenReferences(sources, read('src/styles/tokens.css'))
        ).toEqual([]);
    });

    it('does not let a theme-only declaration satisfy an unrelated default reference', () => {
        const sources = [
            {
                file: 'src/styles/default.css',
                css: '.default { color: var(--color-theme-only); }',
            },
            {
                file: 'src/styles/theme.css',
                css: '.theme-example { --color-theme-only: #fff; }',
            },
        ];

        expect(findMissingSharedTokenReferences(sources, ':root {}')).toEqual([
            'src/styles/default.css: --color-theme-only',
        ]);
    });

    it('keeps the root z-index vocabulary coarse and strictly ordered', () => {
        const tokensCss = read('src/styles/tokens.css');
        const forbidden = [
            '--z-overlay-context',
            '--z-overlay-primary',
            '--z-overlay-status',
            '--z-overlay-status-priority',
            '--z-overlay-guide',
            '--z-overlay-video-priority',
        ];
        expect(forbidden.filter((token) => tokensCss.includes(token))).toEqual([]);

        const values = ['base', 'dropdown', 'modal', 'overlay', 'toast', 'max'].map((name) => {
            const value = tokensCss.match(new RegExp(`--z-${name}:\\s*(\\d+);`))?.[1];
            expect(value).toBeDefined();
            return Number(value);
        });
        expect(values.every((value, index) => index === 0 || value > values[index - 1]!)).toBe(true);
    });

    it.each(RUNTIME_LAYERS)('binds $name z-index to $variable', (layer) => {
        expect(declarationValue(runtimeLayerBlock(layer), 'z-index')).toBe(
            `var(${layer.variable})`
        );
        expect(runtimeLayerValue(layer)).not.toBeNaN();
    });

    it('preserves runtime layer ordering with status surfaces sharing a plane', () => {
        const values = Object.fromEntries(
            RUNTIME_LAYERS.map((layer) => [layer.name, runtimeLayerValue(layer)])
        );

        expect(values['mini-guide']).toBeLessThan(values['player OSD']!);
        expect(values['player OSD']).toBeLessThan(values['channel transition']!);
        expect(values['channel transition']).toBe(values['channel badge']);
        expect(values['channel badge']).toBeLessThan(values['channel number overlay']!);
        expect(values['channel number overlay']).toBeLessThan(values.EPG!);
        expect(values.EPG).toBeLessThan(values['video EPG PiP']!);
    });

    it('keeps runtime chrome as a structure-only host plane', () => {
        const css = readComposedCss('src/styles/shell.player-runtime-chrome.css');
        const block = topLevelBlockForProperty(css, '.runtime-chrome-host', 'pointer-events');

        expect(declarationValue(block, 'position')).toBe('absolute');
        expect(declarationValue(block, 'inset')).toBe('0');
        expect(declarationValue(block, 'pointer-events')).toBe('none');
        expect(block).not.toContain('z-index');
        expect(block).not.toMatch(/\b(?:color|background|font|padding|margin)\s*:/);
    });

    it('anchors Settings to the viewport instead of retained guide scroll', () => {
        const css = readComposedCss('src/modules/ui/settings/styles.core.css');
        const screen = topLevelBlockForProperty(css, '.settings-screen', 'position');
        const rail = topLevelBlockForProperty(css, '.settings-categories', 'box-sizing');

        expect(declarationValue(screen, 'position')).toBe('fixed');
        for (const edge of ['top', 'right', 'bottom', 'left']) {
            expect(declarationValue(screen, edge)).toBe('0');
        }
        expect(declarationValue(rail, 'box-sizing')).toBe('border-box');
    });

    it('uses tokens instead of banned shared color literals across the runtime seam', () => {
        for (const file of RUNTIME_COLOR_FILES) {
            expect(readComposedCss(file)).not.toMatch(SHARED_COLOR_LITERAL_PATTERN);
        }
    });

    it('bounds bright-focus literals to the two focus-owned stylesheets and selectors', () => {
        const filesWithMatches = RUNTIME_COLOR_FILES.filter(
            (file) => readComposedCss(file).match(BRIGHT_FOCUS_LITERAL_PATTERN)?.length
        );
        expect(filesWithMatches).toEqual([
            'src/modules/ui/exit-confirm/styles.css',
            'src/modules/ui/player-osd/styles.actions.css',
        ]);

        const exitCss = readComposedCss('src/modules/ui/exit-confirm/styles.css');
        const osdCss = readComposedCss('src/modules/ui/player-osd/styles.actions.css');
        const exitFocusBlock = exitConfirmFocusBlock(exitCss);
        expect(exitCss.replace(exitFocusBlock, ''))
            .not.toMatch(BRIGHT_FOCUS_LITERAL_PATTERN);
        expect(osdCss.replace(/\.player-osd-action\.focused\s*\{[^}]*\}/gs, ''))
            .not.toMatch(BRIGHT_FOCUS_LITERAL_PATTERN);
    });

    it.each([
        {
            name: 'player OSD',
            file: 'src/modules/ui/player-osd/styles.actions.css',
            selector: '.player-osd-action.focused',
            background: 'rgba(255, 255, 255, 0.92)',
            border: 'rgba(255, 255, 255, 0.98)',
        },
        {
            name: 'exit confirm',
            file: 'src/modules/ui/exit-confirm/styles.css',
            background: 'rgba(255, 255, 255, 0.92)',
            border: 'rgba(255, 255, 255, 0.92)',
        },
    ])('keeps load-bearing focus treatment for $name', ({ file, selector, background, border }) => {
        const css = readComposedCss(file);
        const block = selector
            ? topLevelBlockForProperty(css, selector, 'background')
            : exitConfirmFocusBlock(css);

        expect(declarationValue(block, 'background')).toBe(background);
        expect(declarationValue(block, 'border-color')).toBe(border);
        expect(declarationValue(block, 'color')).toBe('var(--color-text-on-focus)');
    });
});
