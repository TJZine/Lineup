/** @jest-environment jsdom */
import { flushPromisesAndMacrotask } from '../../../../__tests__/helpers';
import { NavigationManager } from '../../../navigation/manager/NavigationManager';
import type { ChannelConfig } from '../../../scheduler/channel-manager/contracts/types';
import type { ChannelDirectoryPorts, ActiveMediaIdentity } from '../ChannelDirectoryPorts';
import { ChannelDirectoryScreen } from '../ChannelDirectoryScreen';

function channel(id: string, number: number): ChannelConfig {
    return {
        id, number, name: `Channel ${id}`, contentSource: { type: 'manual', items: [] }, playbackMode: 'sequential',
        startTimeAnchor: 0, skipIntros: false, skipCredits: false, createdAt: 0, updatedAt: 0,
        lastContentRefresh: 0, itemCount: 0, totalDurationMs: 0,
    };
}

function press(keyCode: number, target: EventTarget = document): void {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'keyCode', { value: keyCode });
    target.dispatchEvent(event);
    const up = new KeyboardEvent('keyup', { bubbles: true });
    Object.defineProperty(up, 'keyCode', { value: keyCode });
    target.dispatchEvent(up);
}

describe('directory with real remote and focus routing', () => {
    let nav: NavigationManager;
    let screen: ChannelDirectoryScreen;
    let container: HTMLElement;
    let ports: ChannelDirectoryPorts;
    let active: ActiveMediaIdentity | null;
    let channels: ChannelConfig[];
    let originalScroll: typeof HTMLElement.prototype.scrollIntoView;

    beforeEach(() => {
        originalScroll = HTMLElement.prototype.scrollIntoView;
        HTMLElement.prototype.scrollIntoView = jest.fn();
        nav = new NavigationManager({ getKeyMap: (): ReadonlyMap<number, 'ok' | 'up' | 'down' | 'back' | 'guide' | 'yellow' | 'num1'> => new Map([
            [13, 'ok'], [38, 'up'], [40, 'down'], [461, 'back'], [71, 'guide'], [89, 'yellow'], [49, 'num1'],
        ] as const) });
        nav.initialize({ enablePointerMode: false, keyRepeatDelayMs: 500, keyRepeatIntervalMs: 100, focusMemoryEnabled: true, debugMode: false });
        nav.replaceScreen('channels');
        container = document.createElement('div'); document.body.append(container);
        channels = [channel('a', 10), channel('b', 20)];
        active = { sessionId: 'one', scopeKey: 'scope', channelId: 'a' };
        ports = {
            manager: {
                getLastLoadOutcome: (): ReturnType<ChannelDirectoryPorts['manager']['getLastLoadOutcome']> => ({ kind: 'readable', generation: 1, revision: 1, channelCount: channels.length }),
                getStructuralBase: (): ReturnType<ChannelDirectoryPorts['manager']['getStructuralBase']> => ({ generation: 1, revision: 1 }),
                getAllChannels: (): ChannelConfig[] => channels,
                tryReplaceAllChannels: jest.fn(async next => {
                    channels = next;
                    return { kind: 'committed' as const, value: undefined, revision: 2, pointerWarning: false };
                }),
                resolveChannelContent: jest.fn(async id => ({ channelId: id, channelSnapshot: channel(id, 10), resolvedAt: 1,
                    items: [], orderedItems: [], totalDurationMs: 0 })),
            },
            navigation: nav,
            openStudio: jest.fn(), openGenerate: jest.fn(), goBack: jest.fn(),
            getActiveMediaIdentity: (): ActiveMediaIdentity | null => active,
            getDirectoryScopeKey: (): string => 'scope',
            stopDeletedMediaIfCurrent: jest.fn(async () => 'stopped' as const),
            refreshAfterCommit: jest.fn(async () => undefined),
            openGuideAfterActiveDelete: jest.fn(), now: (): number => 1,
        };
        screen = new ChannelDirectoryScreen(container, ports); screen.show();
    });

    afterEach(() => {
        screen.destroy(); nav.destroy(); container.remove();
        HTMLElement.prototype.scrollIntoView = originalScroll;
    });

    test('D-pad works on search trigger; OK edits and physical Back exits editable input', () => {
        expect(document.activeElement?.id).toBe('directory-search');
        press(40); expect(document.activeElement?.id).toBe('directory-filter-all');
        press(38); expect(document.activeElement?.id).toBe('directory-search');
        press(13); expect(document.activeElement?.id).toBe('directory-search-edit');
        const input = container.querySelector<HTMLInputElement>('#directory-search-edit');
        if (!input) throw new Error('search editor missing');
        input.value = 'Channel'; input.setSelectionRange(3, 3);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        expect(screen.model.query).toBe('Channel');
        expect(container.querySelector<HTMLInputElement>('#directory-search-edit')?.selectionStart).toBe(3);
        press(461, document.activeElement ?? document);
        expect(document.activeElement?.id).toBe('directory-search');
        press(13);
        expect(document.activeElement?.id).toBe('directory-search-edit');
        document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        expect(document.activeElement?.id).toBe('directory-search');
        press(40); expect(document.activeElement?.id).toBe('directory-filter-all');
        expect(ports.goBack).not.toHaveBeenCalled();
    });

    test('IME composition keeps the input mounted until composition ends', () => {
        press(13);
        const input = container.querySelector<HTMLInputElement>('#directory-search-edit');
        if (!input) throw new Error('search editor missing');
        input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
        input.value = 'Orbit';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        expect(container.querySelector('#directory-search-edit')).toBe(input);
        input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
        expect(screen.model.query).toBe('Orbit');
        expect(container.querySelector<HTMLInputElement>('#directory-search-edit')?.value).toBe('Orbit');
    });

    test('protected delete modal suppresses Guide/Settings/number, then remote Back closes it', () => {
        container.querySelector<HTMLButtonElement>('#directory-action-a')?.click();
        container.querySelector<HTMLButtonElement>('#directory-delete-a')?.click();
        expect(nav.isModalOpen('channel-directory-delete')).toBe(true);
        const guide = jest.fn(), settings = jest.fn(), number = jest.fn();
        nav.on('guide', guide); nav.on('settings', settings); nav.on('channelNumberEntered', number);
        press(71); press(89); press(49);
        expect(guide).not.toHaveBeenCalled(); expect(settings).not.toHaveBeenCalled(); expect(number).not.toHaveBeenCalled();
        expect(nav.getCurrentScreen()).toBe('channels');
        press(461);
        expect(nav.isModalOpen('channel-directory-delete')).toBe(false);
        expect(container.querySelector('[role="dialog"]')).toBeNull();
        expect(document.activeElement?.id).toBe('directory-delete-a');
    });

    test('hide and reopen close the protected modal and restore normal remote focus', () => {
        container.querySelector<HTMLButtonElement>('#directory-action-a')?.click();
        container.querySelector<HTMLButtonElement>('#directory-delete-a')?.click();
        expect(nav.isModalOpen('channel-directory-delete')).toBe(true);
        screen.hide(); expect(nav.isModalOpen('channel-directory-delete')).toBe(false);
        screen.show(); expect(document.activeElement?.id).toBe('directory-row-a');
        press(40); expect(document.activeElement?.id).toBe('directory-action-a');
    });

    test('Studio create return focuses the new channel ID ahead of Add focus memory', () => {
        container.querySelector<HTMLButtonElement>('#directory-add')?.click();
        expect(ports.openStudio).toHaveBeenCalledWith({ kind: 'create' });
        screen.hide();
        channels.push(channel('created', 30));
        screen.show('created');
        expect(document.activeElement?.id).toBe('directory-row-created');
        expect(screen.model.focusedChannelId).toBe('created');
        press(40);
        expect(document.activeElement?.id).toBe('directory-action-created');
    });

    test('missing or filtered preferred channel falls back to an eligible row or search', () => {
        screen.hide();
        screen.show('removed');
        expect(document.activeElement?.id).toBe('directory-row-a');
        screen.model.setQuery('no result');
        screen.show('removed');
        expect(document.activeElement?.id).toBe('directory-search');
        expect(screen.model.focusedChannelId).toBeNull();
    });

    test('reopen without an explicit channel keeps ordinary focus memory', () => {
        nav.setFocus('directory-row-b');
        screen.hide();
        screen.show();
        expect(document.activeElement?.id).toBe('directory-row-b');
    });

    test('remote position selection updates the reorder draft, then Save persists it', async () => {
        container.querySelector<HTMLButtonElement>('#directory-reorder')?.click();
        nav.setFocus('directory-target-a');
        press(13);
        expect(nav.isModalOpen('channel-directory-position')).toBe(true);
        expect(document.activeElement?.id).toBe('directory-position-0');
        press(40);
        expect(document.activeElement?.id).toBe('directory-position-1');
        press(13);
        expect(nav.isModalOpen('channel-directory-position')).toBe(false);
        expect(screen.model.proposedNumber('a')).toBe(20);
        expect(document.activeElement?.id).toBe('directory-row-a');
        expect(ports.manager.tryReplaceAllChannels).not.toHaveBeenCalled();
        container.querySelector<HTMLButtonElement>('#directory-save-order')?.click();
        await flushPromisesAndMacrotask();
        expect(channels.map(ch => [ch.id, ch.number])).toEqual([['b', 10], ['a', 20]]);
    });

    test('Back cancels only the position picker and hide releases its modal and focus', () => {
        container.querySelector<HTMLButtonElement>('#directory-reorder')?.click();
        nav.setFocus('directory-target-a'); press(13); press(40); press(461);
        expect(nav.isModalOpen('channel-directory-position')).toBe(false);
        expect(screen.model.mode).toBe('reorder');
        expect(screen.model.proposedNumber('a')).toBe(10);
        expect(document.activeElement?.id).toBe('directory-target-a');
        press(13);
        expect(nav.isModalOpen('channel-directory-position')).toBe(true);
        screen.hide();
        expect(nav.isModalOpen('channel-directory-position')).toBe(false);
        expect(container.querySelector('[role="dialog"]')).toBeNull();
        screen.show();
        expect(screen.model.mode).toBe('browse');
        expect(document.activeElement?.id).not.toMatch(/^directory-position-/);
    });

    test.each(['scope', 'lineup'] as const)('%s changes retire the position picker before it can move a channel', (change) => {
        container.querySelector<HTMLButtonElement>('#directory-reorder')?.click();
        nav.setFocus('directory-target-a'); press(13);
        if (change === 'scope') ports.getDirectoryScopeKey = (): string => 'different-scope';
        else ports.manager.getStructuralBase = (): ReturnType<ChannelDirectoryPorts['manager']['getStructuralBase']> => ({ generation: 1, revision: 2 });
        container.querySelector<HTMLButtonElement>('#directory-position-1')?.click();
        expect(nav.isModalOpen('channel-directory-position')).toBe(false);
        expect(screen.model.proposedNumber('a')).toBe(10);
        expect(ports.manager.tryReplaceAllChannels).not.toHaveBeenCalled();
        expect(container.textContent).toContain('lineup changed');
    });

    test('changed active session renews warning before any durable write', async () => {
        container.querySelector<HTMLButtonElement>('#directory-action-a')?.click();
        container.querySelector<HTMLButtonElement>('#directory-delete-a')?.click();
        active = { sessionId: 'two', scopeKey: 'scope', channelId: 'b' };
        container.querySelector<HTMLButtonElement>('#directory-delete-confirm')?.click();
        expect(ports.manager.tryReplaceAllChannels).not.toHaveBeenCalled();
        expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Playback changed');
        expect(document.activeElement?.id).toBe('directory-delete-cancel');
        container.querySelector<HTMLButtonElement>('#directory-delete-confirm')?.click();
        await Promise.resolve(); await Promise.resolve();
        expect(ports.manager.tryReplaceAllChannels).toHaveBeenCalledTimes(1);
        expect(ports.stopDeletedMediaIfCurrent).not.toHaveBeenCalled();
    });

    test('pending commit keeps protected modal until completion, then routes after closure', async () => {
        let release: (() => void) | undefined;
        (ports.manager.tryReplaceAllChannels as jest.Mock).mockImplementationOnce(async () => {
            await new Promise<void>(resolve => { release = resolve; });
            channels = [channel('b', 20)];
            return { kind: 'committed', value: undefined, revision: 2, pointerWarning: false };
        });
        container.querySelector<HTMLButtonElement>('#directory-action-a')?.click();
        container.querySelector<HTMLButtonElement>('#directory-delete-a')?.click();
        container.querySelector<HTMLButtonElement>('#directory-delete-confirm')?.click();
        expect(nav.isModalOpen('channel-directory-delete')).toBe(true);
        expect(container.querySelector<HTMLButtonElement>('#directory-delete-confirm')?.disabled).toBe(true);
        press(461); press(71); press(49);
        expect(nav.isModalOpen('channel-directory-delete')).toBe(true);
        expect(ports.manager.tryReplaceAllChannels).toHaveBeenCalledTimes(1);
        release?.();
        await flushPromisesAndMacrotask();
        expect(nav.isModalOpen('channel-directory-delete')).toBe(false);
        expect(ports.openGuideAfterActiveDelete).toHaveBeenCalledTimes(1);
    });

    test('Guide route failure after durable delete remains a saved warning', async () => {
        ports.openGuideAfterActiveDelete = jest.fn(async () => { throw new Error('route'); });
        container.querySelector<HTMLButtonElement>('#directory-action-a')?.click();
        container.querySelector<HTMLButtonElement>('#directory-delete-a')?.click();
        container.querySelector<HTMLButtonElement>('#directory-delete-confirm')?.click();
        await flushPromisesAndMacrotask();
        expect(nav.isModalOpen('channel-directory-delete')).toBe(false);
        expect(screen.model.notice?.kind).toBe('saved-warning');
        expect(screen.model.notice?.text).toContain('Guide could not open');
    });
});
