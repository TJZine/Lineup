/** @jest-environment jsdom */
import { AirCheckPanel, type AirCheckRenderOptions } from '../AirCheckPanel';
import type { StudioAirCheckRequest, StudioVerificationStatus } from '../../../../core/channel-studio/ChannelStudioContracts';
import { createBaseChannel } from '../../../scheduler/channel-manager/__tests__/channel-manager-test-helpers';
import { syncFocusableRegistry } from '../../common/focus/syncFocusableRegistry';
import type { FocusableElement } from '../../../navigation/contracts/interfaces';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const at = new Date('2026-10-31T18:00:00-04:00').getTime();
const source = { type: 'manual' as const, items: [{ ratingKey: 'a', title: 'One', durationMs: 30 * 60_000 }] };
const request: StudioAirCheckRequest = {
    draftRevision: 1, expectedBase: { generation: 1, revision: 1 }, source,
    sourceIdentity: JSON.stringify(source), asOf: at, horizonMs: 6 * 60 * 60_000,
    candidate: createBaseChannel({ contentSource: source, playbackMode: 'sequential', number: 42 }),
};
const item = { ratingKey: 'a', type: 'episode' as const, title: 'One', fullTitle: 'Series · One',
    showTitle: 'Series', seasonNumber: 1, episodeNumber: 1, durationMs: 30 * 60_000,
    thumb: '/art', year: 2026, scheduledIndex: 0, summary: 'A story '.repeat(100) };
const programs = [0, 1, 2].map(index => ({ item: { ...item, title: `Episode ${index + 1}`, ratingKey: String(index) },
    scheduledStartTime: at + index * 30 * 60_000, scheduledEndTime: at + (index + 1) * 30 * 60_000,
    elapsedMs: 0, remainingMs: item.durationMs, scheduleIndex: index, loopNumber: 0, isCurrent: index === 0 }));
const verified: StudioVerificationStatus = { kind: 'verified', request, checkedAt: at, items: [item], programs,
    coverageEnd: programs[2]!.scheduledEndTime, loopDurationMs: 90 * 60_000 };

describe('AirCheckPanel', () => {
    let host: HTMLDivElement;
    let panel: AirCheckPanel;
    let extend: jest.Mock;
    let retry: jest.Mock;
    let cancel: jest.Mock;
    let changed: jest.Mock;
    const options = (extensionStatus: StudioVerificationStatus | null = null): AirCheckRenderOptions => ({
        onVerify: retry, onCancel: cancel, onExtendHorizon: extend, onControlsChanged: changed, extensionStatus,
    });

    beforeEach(() => {
        host = document.createElement('div'); document.body.append(host);
        extend = jest.fn(); retry = jest.fn(); cancel = jest.fn(); changed = jest.fn();
        panel = new AirCheckPanel({ verify: jest.fn() }, {
            getImageUrl: (path: string): string => `https://example.test${path}`,
        });
    });
    afterEach(() => { host.remove(); });

    it('renders full schedule details and preserves selected upcoming program across a longer horizon', () => {
        panel.render(host, verified, request, options());
        expect(host.textContent).toContain('1h 30m');
        expect(host.textContent).toContain('cycle');
        expect(host.querySelector('img')?.getAttribute('src')).toBe('https://example.test/art');
        expect(host.querySelectorAll('[data-action="air-check-program"]')).toHaveLength(3);
        const rows = host.querySelectorAll<HTMLButtonElement>('[data-action="air-check-program"]');
        rows[1]!.click();
        expect(host.querySelector('.air-check-details')?.textContent).toContain('Episode 2');
        expect(document.activeElement?.getAttribute('data-program-id')).toBe(rows[1]!.dataset.programId);
        expect(host.textContent).toContain('Back to now');
        expect(host.querySelectorAll<HTMLButtonElement>('[aria-current="time"]')).toHaveLength(1);
        expect(host.querySelector<HTMLButtonElement>('[aria-current="time"]')?.dataset.programId).toBe(rows[0]!.dataset.programId);
        expect(host.querySelectorAll<HTMLButtonElement>('[aria-pressed="true"]')).toHaveLength(1);
        expect(host.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.dataset.programId).toBe(rows[1]!.dataset.programId);
        host.querySelector<HTMLButtonElement>('[data-action="air-check-synopsis"]')!.click();
        expect(host.querySelector('.air-check-synopsis')?.classList.contains('air-check-clamped')).toBe(false);
        const longerRequest = { ...request, horizonMs: 12 * 60 * 60_000 };
        const longer: StudioVerificationStatus = { ...verified, request: longerRequest,
            programs: [...programs, { ...programs[2]!, item: { ...item, ratingKey: '3', title: 'Episode 4' },
                scheduledStartTime: at + 90 * 60_000, scheduledEndTime: at + 120 * 60_000 }],
            coverageEnd: at + 120 * 60_000 };
        panel.render(host, longer, longerRequest, options());
        expect(host.querySelector('.air-check-details')?.textContent).toContain('Episode 2');
        const extendButton = host.querySelector<HTMLButtonElement>('[data-action="air-check-extend"]')!;
        extendButton.click(); extendButton.click();
        expect(extend).toHaveBeenCalledWith(18 * 60 * 60_000);
        expect(extend).toHaveBeenCalledTimes(1);
        expect(extendButton.disabled).toBe(true);
        host.querySelector<HTMLButtonElement>('[data-action="air-check-back-now"]')!.click();
        expect(host.querySelector('.air-check-details')?.textContent).toContain('Episode 1');
    });

    it('exposes loading cancellation and retryable failures without a verified schedule', () => {
        panel.render(host, { kind: 'idle' }, request, options());
        host.querySelector<HTMLButtonElement>('[data-action="air-check-run"]')!.click();
        expect(retry).toHaveBeenCalledTimes(1);
        panel.render(host, { kind: 'loading' }, request, options());
        host.querySelector<HTMLButtonElement>('[data-action="air-check-cancel"]')!.click();
        expect(cancel).toHaveBeenCalledTimes(1);
        panel.render(host, { kind: 'partial', reason: 'One source missing. X-Plex-Token=private-value', checkedAt: at }, request, options());
        expect(host.textContent).toContain('One source missing.');
        expect(host.textContent).not.toContain('private-value');
        expect(host.querySelector('[data-action="air-check-program"]')).toBeNull();
        host.querySelector<HTMLButtonElement>('[data-action="air-check-retry"]')!.click();
        expect(retry).toHaveBeenCalledTimes(2);
    });

    it('uses the render callbacks to show pending immediately and completion when verification settles', async () => {
        let resolve!: (status: StudioVerificationStatus) => void;
        const pending = new Promise<StudioVerificationStatus>(complete => { resolve = complete; });
        const provider = { verify: jest.fn().mockReturnValue(pending) };
        panel = new AirCheckPanel(provider, { getImageUrl: (path: string): string => `https://example.test${path}` });
        const callbacks: AirCheckRenderOptions = {
            onVerify: (): void => {
                const result = panel.verify(request, new AbortController().signal);
                panel.render(host, { kind: 'loading' }, request, callbacks);
                void result.then(status => panel.render(host, status, request, callbacks));
            },
            onCancel: cancel, onExtendHorizon: extend, onControlsChanged: changed, extensionStatus: null,
        };
        panel.render(host, { kind: 'idle' }, request, callbacks);
        host.querySelector<HTMLButtonElement>('#air-check-run')!.click();
        expect(provider.verify).toHaveBeenCalledTimes(1);
        expect(host.querySelector('#air-check-cancel')).not.toBeNull();
        expect(host.querySelector('.air-check-selection')).toBeNull();
        resolve(verified);
        await pending;
        await Promise.resolve();
        expect(host.querySelector('.air-check-selection')).not.toBeNull();
        expect(host.querySelector('#air-check-cancel')).toBeNull();
    });

    it('shows extension pending and failure in the one verified status while preserving programming', () => {
        panel.render(host, verified, request, options({ kind: 'loading' }));
        expect(host.querySelectorAll('[role="status"]')).toHaveLength(1);
        expect(host.textContent).toContain('Extending schedule coverage');
        expect(host.querySelector<HTMLButtonElement>('#air-check-extend')?.disabled).toBe(true);
        expect(host.querySelectorAll('[data-action="air-check-program"]')).toHaveLength(3);
        panel.render(host, verified, request, options({ kind: 'error', reason: 'Private transport failure', checkedAt: at }));
        expect(host.querySelectorAll('[role="status"]')).toHaveLength(1);
        expect(host.textContent).toContain('prior verified schedule remains available');
        expect(host.textContent).not.toContain('Private transport failure');
        expect(host.querySelector<HTMLButtonElement>('#air-check-extend')?.disabled).toBe(false);
    });

    it('uses a readable detail layout when artwork is unavailable', () => {
        const noArt: StudioVerificationStatus = { ...verified, programs: programs.map(program => ({
            ...program, item: { ...program.item, thumb: null, showThumb: null, art: null },
        })) };
        panel.render(host, noArt, request, options());
        expect(host.querySelector('img')).toBeNull();
        expect(host.querySelector('.air-check-details')?.textContent).toContain('Episode 1');
    });

    it('keeps registered remote targets current through local rerenders and a disappearing Back to now', () => {
        const registry = new Map<string, HTMLElement>();
        let registeredIds: string[] = [];
        const nav = {
            registerFocusable: (entry: FocusableElement): void => { registry.set(entry.id, entry.element); },
            unregisterFocusable: (id: string): void => { registry.delete(id); },
        };
        const registerVisible = (preferredId?: string): void => {
            const controls = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).filter(button => !button.disabled);
            registeredIds = syncFocusableRegistry(nav, registeredIds,
                controls.map((element, index): FocusableElement => ({
                    id: element.id, element,
                    neighbors: { ...(controls[index - 1] ? { up: controls[index - 1]!.id } : {}),
                        ...(controls[index + 1] ? { down: controls[index + 1]!.id } : {}) },
                })));
            const target = registry.get(preferredId ?? '');
            target?.focus();
        };
        panel.render(host, verified, request, { ...options(), onControlsChanged: registerVisible });
        registerVisible();
        const checkRegistry = (): void => {
            expect(registeredIds.length).toBeGreaterThan(0);
            expect(new Set(registeredIds).size).toBe(registeredIds.length);
            expect(registeredIds.every(Boolean)).toBe(true);
            expect([...registry.values()].every(element => host.contains(element))).toBe(true);
            expect([...registry.keys()].every(id => host.querySelectorAll('button').length > 0 && registry.get(id)?.id === id)).toBe(true);
        };
        checkRegistry();
        const upcoming = host.querySelectorAll<HTMLButtonElement>('[data-action="air-check-program"]')[1]!;
        const selectedId = upcoming.id;
        upcoming.click();
        checkRegistry();
        expect(registry.get(selectedId)).toBe(document.activeElement);
        host.querySelector<HTMLButtonElement>('#air-check-synopsis')!.click();
        checkRegistry();
        expect(registry.get('air-check-synopsis')).toBe(document.activeElement);
        host.querySelector<HTMLButtonElement>('#air-check-back-now')!.click();
        checkRegistry();
        expect(registry.has('air-check-back-now')).toBe(false);
        expect(document.activeElement?.id).toBe(host.querySelectorAll<HTMLButtonElement>('[data-action="air-check-program"]')[0]!.id);
        expect(registry.get(document.activeElement!.id)).toBe(document.activeElement);
    });

    it('keeps unusual Plex item keys safe as focus IDs without selector interpolation', () => {
        const unusual: StudioVerificationStatus = { ...verified, programs: programs.map((program, index) => ({
            ...program, item: { ...program.item, ratingKey: `key[${index}]"' / ?#` },
        })) };
        panel.render(host, unusual, request, options());
        const rows = host.querySelectorAll<HTMLButtonElement>('[data-action="air-check-program"]');
        expect(new Set(Array.from(rows, row => row.id)).size).toBe(rows.length);
        rows[1]!.click();
        expect(document.activeElement?.id).toBe(rows[1]!.id);
        expect(changed).toHaveBeenCalledWith(rows[1]!.id);
    });

    it('keeps required TV focus styling matchable without modern-only pseudo selectors', () => {
        const css = readFileSync(resolve(process.cwd(), 'src/modules/ui/channel-air-check/styles.css'), 'utf8');
        const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/gu)];
        const focusRules = rules.filter(match => match[2]?.includes('background: var(--focus-surface)'));
        expect(focusRules).toHaveLength(1);
        const selectors = focusRules[0]![1]!.split(',').map(selector => selector.trim());
        expect(selectors).toEqual(['.air-check-action.focused', '.air-check-action:focus']);
        expect(focusRules[0]![2]).toContain('color: var(--focus-text-primary)');
        expect(focusRules[0]![2]).toContain('var(--focus-ring-width) solid var(--focus-border-color)');
        for (const rule of rules) {
            if (rule[1]?.includes(':focus-visible')) {
                expect(rule[1].split(',').every(selector => selector.includes(':focus-visible'))).toBe(true);
            }
        }
        expect(css).toContain('.air-check-program.is-selected');
        expect(css).toContain('background: var(--selection-surface)');
    });
});
