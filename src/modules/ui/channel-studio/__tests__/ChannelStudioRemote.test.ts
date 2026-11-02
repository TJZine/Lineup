/** @jest-environment jsdom */
import { NavigationManager } from '../../../navigation/manager/NavigationManager';
import { createBaseChannel } from '../../../scheduler/channel-manager/__tests__/channel-manager-test-helpers';
import type { ChannelConfig } from '../../../scheduler/channel-manager/contracts/types';
import type { StudioAirCheckRequest, StudioVerificationStatus, ChannelStudioPorts } from '../../../../core/channel-studio/ChannelStudioContracts';
import { ChannelStudioScreen } from '../ChannelStudioScreen';

function press(keyCode: number, target: EventTarget = document): void {
    const down = new KeyboardEvent('keydown', { bubbles: true, cancelable: true });
    Object.defineProperty(down, 'keyCode', { value: keyCode }); target.dispatchEvent(down);
    const up = new KeyboardEvent('keyup', { bubbles: true });
    Object.defineProperty(up, 'keyCode', { value: keyCode }); target.dispatchEvent(up);
}

const click = (root: HTMLElement, id: string): void => {
    const button = root.querySelector<HTMLButtonElement>(`#${id}`);
    if (!button) throw new Error(`Missing ${id}`);
    button.click();
};

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void } {
    let resolve: (value: T) => void = () => undefined;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
}

describe('Studio with real remote and navigation focus', () => {
    let nav: NavigationManager;
    let screen: ChannelStudioScreen;
    let container: HTMLElement;
    let ports: ChannelStudioPorts;
    let originalScroll: typeof HTMLElement.prototype.scrollIntoView;

    beforeEach(() => {
        originalScroll = HTMLElement.prototype.scrollIntoView;
        HTMLElement.prototype.scrollIntoView = jest.fn();
        nav = new NavigationManager({ getKeyMap: (): ReadonlyMap<number, 'ok' | 'up' | 'down' | 'back' | 'guide' | 'yellow' | 'num1'> => new Map([
            [13, 'ok'], [38, 'up'], [40, 'down'], [461, 'back'], [71, 'guide'], [89, 'yellow'], [49, 'num1'],
        ] as const) });
        nav.initialize({ enablePointerMode: false, keyRepeatDelayMs: 500, keyRepeatIntervalMs: 100,
            focusMemoryEnabled: true, debugMode: false });
        nav.replaceScreen('channel-studio');
        container = document.createElement('div'); document.body.append(container);
        const saved = createBaseChannel({ id: 'saved', number: 8, name: 'Eight', contentSource: {
            type: 'manual', items: [{ ratingKey: 'm1', title: 'First', durationMs: 60_000 }],
        } });
        ports = {
            manager: {
                getStructuralBase: (): ReturnType<ChannelStudioPorts['manager']['getStructuralBase']> => ({ generation: 1, revision: 2 }),
                getLastLoadOutcome: (): ReturnType<ChannelStudioPorts['manager']['getLastLoadOutcome']> => (
                    { kind: 'readable', generation: 1, revision: 2, channelCount: 1 }),
                getChannel: (): ChannelConfig => saved, getAllChannels: (): ChannelConfig[] => [saved],
                tryCreateChannel: jest.fn(), tryUpdateChannel: jest.fn(),
            },
            plexLibrary: { getLibraries: jest.fn(async () => []), getShows: jest.fn(), getShowEpisodes: jest.fn(),
                getShowSeasons: jest.fn(), getCollections: jest.fn(), getPlaylists: jest.fn(),
                search: jest.fn(), getLibraryItems: jest.fn() },
            navigation: nav,
            airCheck: { verify: jest.fn(), render: (root, _status, _request, options): void => {
                const run = document.createElement('button'); run.id = 'air-check-run'; run.textContent = 'Run Air Check';
                run.addEventListener('click', options.onVerify); root.append(run);
            } },
            close: jest.fn(), refreshAfterSave: jest.fn(), tuneNow: jest.fn(), now: (): number => 100,
        };
        screen = new ChannelStudioScreen(container, ports);
        screen.show({ kind: 'inspect', channelId: 'saved', expectedBase: { generation: 1, revision: 2 } });
    });

    afterEach(() => {
        screen.destroy(); nav.destroy(); container.remove();
        HTMLElement.prototype.scrollIntoView = originalScroll;
    });

    it('moves by D-pad, edits a text field locally, and chooses playback without a native select', () => {
        nav.setFocus('studio-name');
        press(40); expect(document.activeElement?.id).toBe('studio-number');
        press(38); expect(document.activeElement?.id).toBe('studio-name');
        press(13); expect(document.activeElement?.id).toBe('studio-name-edit');
        const input = container.querySelector<HTMLInputElement>('#studio-name-edit');
        if (!input) throw new Error('name editor missing');
        input.value = 'Edited'; input.setSelectionRange(3, 3);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        expect(screen.session.draft?.channel.name).toBe('Edited');
        expect(container.querySelector<HTMLInputElement>('#studio-name-edit')?.selectionStart).toBe(3);
        press(461, document.activeElement ?? document);
        expect(document.activeElement?.id).toBe('studio-name');
        expect(ports.close).not.toHaveBeenCalled();
        nav.setFocus('studio-number'); press(13);
        const numberInput = container.querySelector<HTMLInputElement>('#studio-number-edit');
        if (!numberInput) throw new Error('number editor missing');
        numberInput.value = '12'; numberInput.dispatchEvent(new Event('input', { bubbles: true }));
        press(461, document.activeElement ?? document);
        expect(screen.session.draft?.channel.number).toBe(12);
        expect(document.activeElement?.id).toBe('studio-number');
        nav.setFocus('studio-mode'); press(13);
        expect(document.activeElement?.id).toBe('studio-mode-option-0');
        press(40); expect(document.activeElement?.id).toBe('studio-mode-option-1');
        press(13);
        expect(screen.session.draft?.channel.playbackMode).toBe('shuffle');
        expect(document.activeElement?.id).toBe('studio-mode');
        expect(container.querySelector('select')).toBeNull();
    });

    it('keeps IME composition mounted and restores its completed value before local Back', () => {
        nav.setFocus('studio-name'); press(13);
        const input = container.querySelector<HTMLInputElement>('#studio-name-edit');
        if (!input) throw new Error('name editor missing');
        input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
        input.value = 'Orbit'; input.dispatchEvent(new Event('input', { bubbles: true }));
        expect(container.querySelector('#studio-name-edit')).toBe(input);
        input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
        expect(screen.session.draft?.channel.name).toBe('Orbit');
        expect(container.querySelector<HTMLInputElement>('#studio-name-edit')?.value).toBe('Orbit');
        press(461, document.activeElement ?? document);
        expect(document.activeElement?.id).toBe('studio-name');
    });

    it('keeps picker search navigable and protects picker, filters, and dirty leave from background commands', async () => {
        const guide = jest.fn(), settings = jest.fn(), number = jest.fn();
        nav.on('guide', guide); nav.on('settings', settings); nav.on('channelNumberEntered', number);
        click(container, 'studio-source-edit'); click(container, 'studio-manual-browse');
        await Promise.resolve();
        expect(nav.isModalOpen('channel-studio-picker')).toBe(true);
        expect(document.activeElement?.id).toBe('studio-picker-search');
        press(71); press(89); press(49);
        expect(guide).not.toHaveBeenCalled(); expect(settings).not.toHaveBeenCalled(); expect(number).not.toHaveBeenCalled();
        press(13); expect(document.activeElement?.id).toBe('studio-picker-search-edit');
        press(461, document.activeElement ?? document);
        expect(document.activeElement?.id).toBe('studio-picker-search');
        expect(nav.isModalOpen('channel-studio-picker')).toBe(true);
        press(461);
        expect(nav.isModalOpen('channel-studio-picker')).toBe(false);
        expect(document.activeElement?.id).toBe('studio-manual-browse');
        click(container, 'studio-cancel-source'); click(container, 'studio-filters');
        expect(nav.isModalOpen('channel-studio-filters')).toBe(true);
        click(container, 'studio-filter-add');
        click(container, 'studio-filter-field-0');
        expect(document.activeElement?.id).toBe('studio-filter-field-0-option-0');
        press(40); expect(document.activeElement?.id).toBe('studio-filter-field-0-option-1');
        press(461, document.activeElement ?? document);
        expect(nav.isModalOpen('channel-studio-filters')).toBe(true);
        expect(document.activeElement?.id).toBe('studio-filter-field-0');
        press(71); press(89); press(49);
        expect(guide).not.toHaveBeenCalled(); expect(settings).not.toHaveBeenCalled(); expect(number).not.toHaveBeenCalled();
        press(461); expect(nav.isModalOpen('channel-studio-filters')).toBe(false);
        click(container, 'studio-name');
        const input = container.querySelector<HTMLInputElement>('#studio-name-edit');
        if (!input) throw new Error('name editor missing');
        input.value = 'Edited'; input.dispatchEvent(new Event('input', { bubbles: true }));
        press(461, document.activeElement ?? document);
        press(461);
        expect(nav.isModalOpen('channel-studio-leave')).toBe(true);
        press(71); press(89); press(49);
        expect(guide).not.toHaveBeenCalled(); expect(settings).not.toHaveBeenCalled(); expect(number).not.toHaveBeenCalled();
        press(461);
        expect(nav.isModalOpen('channel-studio-leave')).toBe(false);
        expect(ports.close).not.toHaveBeenCalled();
    });

    it('holds an in-flight Save behind a non-dismissible modal and refuses unprotected Save', async () => {
        const recheck = deferred<StudioVerificationStatus>();
        const verify = ports.airCheck.verify as jest.Mock;
        verify.mockImplementationOnce(async (request: StudioAirCheckRequest) => ({ kind: 'verified', request,
            checkedAt: 101, items: [], programs: [], coverageEnd: request.asOf + request.horizonMs }));
        verify.mockImplementationOnce(() => recheck.promise);
        click(container, 'air-check-run'); await Promise.resolve(); await Promise.resolve();
        expect(container.querySelector<HTMLButtonElement>('#studio-save')?.disabled).toBe(false);
        click(container, 'studio-save');
        expect(nav.isModalOpen('channel-studio-saving')).toBe(true);
        const guide = jest.fn(), settings = jest.fn(), number = jest.fn();
        nav.on('guide', guide); nav.on('settings', settings); nav.on('channelNumberEntered', number);
        press(71); press(89); press(49); press(461);
        expect(nav.isModalOpen('channel-studio-saving')).toBe(true);
        expect(guide).not.toHaveBeenCalled(); expect(settings).not.toHaveBeenCalled(); expect(number).not.toHaveBeenCalled();
        recheck.resolve({ kind: 'partial', reason: 'Source changed', checkedAt: 102 });
        await Promise.resolve(); await Promise.resolve();
        expect(nav.isModalOpen('channel-studio-saving')).toBe(false);
        expect(ports.manager.tryUpdateChannel).not.toHaveBeenCalled();

        verify.mockImplementationOnce(async (request: StudioAirCheckRequest) => ({ kind: 'verified', request,
            checkedAt: 103, items: [], programs: [], coverageEnd: request.asOf + request.horizonMs }));
        click(container, 'air-check-run'); await Promise.resolve(); await Promise.resolve();
        nav.blockInput();
        click(container, 'studio-save');
        expect(nav.isModalOpen('channel-studio-saving')).toBe(false);
        expect(verify).toHaveBeenCalledTimes(3);
        expect(ports.manager.tryUpdateChannel).not.toHaveBeenCalled();
        nav.unblockInput();
    });

    it('closes Save protection on hide and prevents a late final check from writing', async () => {
        const pending = deferred<StudioVerificationStatus>();
        const verify = ports.airCheck.verify as jest.Mock;
        verify.mockImplementationOnce(async (request: StudioAirCheckRequest) => ({ kind: 'verified', request,
            checkedAt: 101, items: [], programs: [], coverageEnd: request.asOf + request.horizonMs }));
        verify.mockImplementationOnce(() => pending.promise);
        click(container, 'air-check-run'); await Promise.resolve(); await Promise.resolve();
        click(container, 'studio-save');
        expect(nav.isModalOpen('channel-studio-saving')).toBe(true);
        const request = verify.mock.calls.at(-1)?.[0] as StudioAirCheckRequest | undefined;
        if (!request) throw new Error('missing recheck request');
        screen.hide();
        expect(nav.isModalOpen('channel-studio-saving')).toBe(false);
        pending.resolve({ kind: 'verified', request, checkedAt: 102, items: [], programs: [],
            coverageEnd: request.asOf + request.horizonMs });
        await Promise.resolve(); await Promise.resolve();
        expect(ports.manager.tryUpdateChannel).not.toHaveBeenCalled();
        expect(screen.session.draft).toBeNull();
    });

    it('cancels precommit Save if its protected modal is externally closed', async () => {
        const pending = deferred<StudioVerificationStatus>();
        const verify = ports.airCheck.verify as jest.Mock;
        verify.mockImplementationOnce(async (request: StudioAirCheckRequest) => ({ kind: 'verified', request,
            checkedAt: 101, items: [], programs: [], coverageEnd: request.asOf + request.horizonMs }));
        verify.mockImplementationOnce(() => pending.promise);
        click(container, 'air-check-run'); await Promise.resolve(); await Promise.resolve();
        click(container, 'studio-save');
        expect(nav.isModalOpen('channel-studio-saving')).toBe(true);
        nav.closeModal('channel-studio-saving');
        expect(screen.session.saving).toBe(false);
        expect(screen.session.notice?.text).toContain('interrupted before storage changed');
        const request = verify.mock.calls.at(-1)?.[0] as StudioAirCheckRequest | undefined;
        if (!request) throw new Error('missing recheck request');
        pending.resolve({ kind: 'verified', request, checkedAt: 102, items: [], programs: [],
            coverageEnd: request.asOf + request.horizonMs });
        await Promise.resolve(); await Promise.resolve();
        expect(ports.manager.tryUpdateChannel).not.toHaveBeenCalled();
        expect(nav.isModalOpen('channel-studio-saving')).toBe(false);
    });
});
