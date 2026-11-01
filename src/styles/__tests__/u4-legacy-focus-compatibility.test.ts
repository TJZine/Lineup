/** @jest-environment jsdom */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (file: string): string => readFileSync(resolve(process.cwd(), file), 'utf8');
const settings = read('src/modules/ui/settings/styles.tv.css');
const tokens = read('src/styles/tokens.css');

function selectorsWith(source: string, declaration: string): string[] {
    const rules = [...source.matchAll(/([^{}]+)\{([^{}]*)\}/gu)];
    return rules.filter((match) => match[2]?.includes(declaration))
        .flatMap((match) => (match[1] ?? '').split(',').map((selector) => selector.trim()));
}

it('keeps Settings focused value and metadata rules matchable without :focus-visible', () => {
    const groups = [...settings.matchAll(/([^{}]+)\{([^{}]*)\}/gu)]
        .filter((match) => match[1]?.includes('.settings-screen .setup-toggle'));
    for (const group of groups) {
        if (group[1]?.includes(':focus-visible')) {
            expect(group[1].split(',').every((selector) => selector.includes(':focus-visible'))).toBe(true);
        }
    }
    const host = document.createElement('div');
    host.className = 'settings-screen';
    const toggle = document.createElement('button');
    toggle.className = 'setup-toggle';
    const meta = document.createElement('span'); meta.className = 'setup-toggle-meta';
    const state = document.createElement('span'); state.className = 'setup-toggle-state';
    toggle.append(meta, state); host.append(toggle); document.body.append(host);
    toggle.focus();
    expect(selectorsWith(settings, 'background: var(--focus-surface)')
        .some((selector) => !selector.includes(':focus-visible') && toggle.matches(selector))).toBe(true);
    expect(selectorsWith(settings, 'color: var(--focus-text-secondary)')
        .some((selector) => !selector.includes(':focus-visible') && meta.matches(selector))).toBe(true);
    host.remove();
});

it('expands Large Focus on actual DOM focus without :is or stale remembered .focused classes', () => {
    expect(tokens).not.toContain(':is(');
    const host = document.createElement('div'); host.dataset.largeFocus = 'true';
    const selected = document.createElement('button'); selected.className = 'focused';
    const actual = document.createElement('button');
    host.append(selected, actual); document.body.append(host);
    actual.focus();
    const selectors = selectorsWith(tokens, 'outline-width: var(--focus-ring-width-large)');
    const legacy = selectors.filter((selector) => !selector.includes(':focus-visible'));
    expect(legacy.some((selector) => actual.matches(selector))).toBe(true);
    expect(legacy.some((selector) => selected.matches(selector))).toBe(false);
    expect(selectors.filter((selector) => selector.includes(':focus-visible'))
        .every((selector) => selector.includes(':focus-visible'))).toBe(true);
    host.remove();
});
