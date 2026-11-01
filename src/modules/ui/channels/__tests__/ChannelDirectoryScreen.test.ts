/** @jest-environment jsdom */
import type { KeyEvent } from '../../../navigation/contracts/interfaces';
import type { ChannelConfig } from '../../../scheduler/channel-manager/contracts/types';
import type { ChannelDirectoryPorts } from '../ChannelDirectoryPorts';
import { ChannelDirectoryScreen } from '../ChannelDirectoryScreen';

const channel = (id: string, name = id): ChannelConfig => ({
    id, number: id === 'a' ? 10 : 20, name, contentSource: { type: 'manual', items: [] },
    playbackMode: 'sequential', startTimeAnchor: 0, skipIntros: false, skipCredits: false,
    createdAt: 0, updatedAt: 0, lastContentRefresh: 0, itemCount: 0, totalDurationMs: 0,
});

describe('ChannelDirectoryScreen', () => {
    let container: HTMLElement;
    let ports: ChannelDirectoryPorts;
    let screen: ChannelDirectoryScreen;
    let keyHandler: ((event: KeyEvent) => void) | undefined;
    let channels: ChannelConfig[];
    let modalOpen = false;

    beforeEach(() => {
        container = document.createElement('div'); document.body.append(container);
        modalOpen = false;
        channels = [channel('a', 'A very long channel title that should remain readable at large text sizes'), channel('b')];
        ports = {
            manager: {
                getLastLoadOutcome: (): ReturnType<ChannelDirectoryPorts['manager']['getLastLoadOutcome']> => ({ kind: 'readable', generation: 1, revision: 1, channelCount: channels.length }),
                getStructuralBase: (): ReturnType<ChannelDirectoryPorts['manager']['getStructuralBase']> => ({ generation: 1, revision: 1 }), getAllChannels: (): ChannelConfig[] => channels,
                tryReplaceAllChannels: jest.fn(async (next: ChannelConfig[]) => { channels = next; return { kind: 'committed' as const, value: undefined, revision: 2, pointerWarning: false }; }),
                resolveChannelContent: jest.fn(async (id: string) => ({ channelId: id, channelSnapshot: channel(id), resolvedAt: 1, items: [], orderedItems: [], totalDurationMs: 0 })),
            },
            navigation: {
                registerFocusable: jest.fn(), unregisterFocusable: jest.fn(), setFocus: jest.fn(), getFocusedElement: jest.fn((): null => null),
                on: jest.fn(() => ({ dispose: jest.fn() })), off: jest.fn(),
                openModal: jest.fn((): void => { modalOpen = true; }),
                closeModal: jest.fn((): void => { modalOpen = false; }),
                isModalOpen: jest.fn((): boolean => modalOpen),
            },
            openStudio: jest.fn(), openGenerate: jest.fn(), goBack: jest.fn(),
            getActiveMediaIdentity: (): ReturnType<ChannelDirectoryPorts['getActiveMediaIdentity']> => ({ sessionId: 'media', scopeKey: 'scope', channelId: 'a' }),
            getDirectoryScopeKey: (): string => 'scope',
            stopDeletedMediaIfCurrent: jest.fn(async () => 'stopped'),
            refreshAfterCommit: jest.fn(async () => undefined), openGuideAfterActiveDelete: jest.fn(), now: (): number => 1,
        };
        screen = new ChannelDirectoryScreen(container, ports);
        screen.show();
        keyHandler = (ports.navigation.on as jest.Mock).mock.calls[0][1] as (event: KeyEvent) => void;
    });

    afterEach(() => { screen.destroy(); container.remove(); keyHandler = undefined; });

    const back = (): void => {
        const event: KeyEvent = { button: 'back', isRepeat: false, isLongPress: false, timestamp: 1,
            originalEvent: new KeyboardEvent('keydown', { key: 'Escape' }) };
        keyHandler?.(event);
        expect(event.handled).toBe(true);
    };

    test('exposes long title and separate playing, health, and focus states', () => {
        const row = container.querySelector<HTMLElement>('[data-channel-id="a"]');
        expect(row?.classList.contains('playing')).toBe(true);
        expect(row?.textContent).toContain('A very long channel title');
        expect(row?.textContent).toContain('Not checked');
        expect(ports.navigation.registerFocusable).toHaveBeenCalled();
    });

    test('row action passes typed inspect and duplicate requests without saving a candidate', () => {
        container.querySelector<HTMLButtonElement>('#directory-action-a')?.click();
        container.querySelector<HTMLButtonElement>('#directory-duplicate-a')?.click();
        expect(ports.openStudio).toHaveBeenCalledWith({ kind: 'duplicate', channelId: 'a', expectedBase: { generation: 1, revision: 1 } });
        expect(ports.manager.tryReplaceAllChannels).not.toHaveBeenCalled();
    });

    test('Back dismisses menu and selection locally; no-match offers clear search', () => {
        container.querySelector<HTMLButtonElement>('#directory-action-a')?.click(); back();
        expect(container.querySelector('.channel-directory-menu')).toBeNull();
        container.querySelector<HTMLButtonElement>('#directory-select')?.click(); back();
        expect(screen.model.mode).toBe('browse'); expect(ports.goBack).not.toHaveBeenCalled();
        container.querySelector<HTMLButtonElement>('#directory-select')?.click();
        container.querySelector<HTMLButtonElement>('#directory-row-a')?.click();
        expect(container.querySelector('[data-channel-id="a"] .channel-directory-select-marker')?.textContent).toBe('☑');
        back();
        container.querySelector<HTMLButtonElement>('#directory-search')?.click();
        const search = container.querySelector<HTMLInputElement>('#directory-search-edit');
        if (!search) throw new Error('search missing');
        search.value = 'no match'; search.dispatchEvent(new Event('input', { bubbles: true }));
        expect(container.textContent).toContain('No matching channels');
        container.querySelector<HTMLButtonElement>('#directory-clear-search')?.click();
        expect(screen.model.rows).toHaveLength(2);
    });

    test('tuned delete dialog defaults focus to Keep and describes stop without auto tune', () => {
        container.querySelector<HTMLButtonElement>('#directory-action-a')?.click();
        container.querySelector<HTMLButtonElement>('#directory-delete-a')?.click();
        const dialog = container.querySelector('[role="dialog"]');
        expect(dialog?.textContent).toContain('Playback of the tuned channel will stop');
        expect(dialog?.textContent).toContain('No other channel will start automatically');
        expect(ports.navigation.openModal).toHaveBeenCalledWith('channel-directory-delete',
            ['directory-delete-cancel', 'directory-delete-confirm'], { dismissOnBack: true, blocksBackgroundCommands: true });
        expect(ports.navigation.setFocus).toHaveBeenLastCalledWith('directory-delete-cancel');
        back(); expect(container.querySelector('[role="dialog"]')).toBeNull();
        expect(ports.navigation.closeModal).toHaveBeenCalledWith('channel-directory-delete');
    });

    test('delete confirmation does not remain visible when navigation refuses modal protection', () => {
        (ports.navigation.openModal as jest.Mock).mockImplementation(() => undefined);
        container.querySelector<HTMLButtonElement>('#directory-action-a')?.click();
        container.querySelector<HTMLButtonElement>('#directory-delete-a')?.click();
        expect(container.querySelector('[role="dialog"]')).toBeNull();
        expect(container.textContent).toContain('Delete confirmation could not open');
        expect(ports.manager.tryReplaceAllChannels).not.toHaveBeenCalled();
    });
});
