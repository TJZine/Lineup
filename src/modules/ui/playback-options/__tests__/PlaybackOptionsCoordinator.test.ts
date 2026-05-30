import { PlaybackOptionsCoordinator } from '../PlaybackOptionsCoordinator';
import type { AudioTrack, IVideoPlayer, SubtitleTrack } from '../../../player';
import type { INavigationManager } from '../../../navigation';
import type { IPlaybackOptionsModal } from '../interfaces';
import type { PlaybackOptionsViewModel } from '../types';
import { LINEUP_STORAGE_KEYS } from '../../../../config/storageKeys';
import { flushPromises as flushSharedPromises } from '../../../../__tests__/helpers';

const makeTextTrack = (overrides: Partial<SubtitleTrack> = {}): SubtitleTrack =>
    ({
        id: 'sub-1',
        label: 'English (SRT)',
        languageCode: 'en',
        language: 'English',
        codec: 'srt',
        format: 'srt',
        forced: false,
        default: false,
        isTextCandidate: true,
        fetchableViaKey: true,
        ...overrides,
    } as SubtitleTrack);

const makeBurnInTrack = (overrides: Partial<SubtitleTrack> = {}): SubtitleTrack =>
    ({
        id: 'burn-1',
        label: 'English (PGS)',
        languageCode: 'en',
        language: 'English',
        codec: 'pgs',
        format: 'pgs',
        forced: false,
        default: false,
        isTextCandidate: false,
        fetchableViaKey: false,
        ...overrides,
    } as SubtitleTrack);

const createPlayer = (subtitles: SubtitleTrack[], audio: AudioTrack[] = []): IVideoPlayer =>
    ({
        getAvailableSubtitles: () => subtitles,
        getAvailableAudio: () => audio,
        getState: () => ({ activeSubtitleId: null, activeAudioId: null } as ReturnType<IVideoPlayer['getState']>),
        setSubtitleTrack: jest.fn().mockResolvedValue(undefined),
        setAudioTrack: jest.fn().mockResolvedValue(undefined),
    } as unknown as IVideoPlayer);

const getViewModel = (coordinator: PlaybackOptionsCoordinator): PlaybackOptionsViewModel => {
    coordinator.prepareModal();
    return (coordinator as unknown as { pendingViewModel: PlaybackOptionsViewModel | null }).pendingViewModel!;
};

const flushPlaybackOptionsPromises = (): Promise<void> => flushSharedPromises(10);

const createDeferred = <T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: unknown) => void;
} => {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

const installFetchMock = (fetchMock: jest.Mock): { restore: () => void } => {
    const originalFetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
    Object.defineProperty(globalThis, 'fetch', {
        value: fetchMock,
        writable: true,
        configurable: true,
    });
    const restore = (): void => {
        if (originalFetchDescriptor) {
            Object.defineProperty(globalThis, 'fetch', originalFetchDescriptor);
        } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (globalThis as any).fetch;
        }
    };
    return { restore };
};

const createLocalStorageMock = (): Storage => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string): string | null => (
            Object.prototype.hasOwnProperty.call(store, key) ? (store[key] ?? null) : null
        ),
        setItem: (key: string, value: string): void => {
            store[key] = String(value);
        },
        removeItem: (key: string): void => {
            delete store[key];
        },
        clear: (): void => {
            store = {};
        },
        key: (index: number): string | null => Object.keys(store)[index] ?? null,
        get length(): number {
            return Object.keys(store).length;
        },
    } as Storage;
};

describe('PlaybackOptionsCoordinator', () => {
    beforeEach(() => {
        if (!globalThis.localStorage) {
            (globalThis as { localStorage?: Storage }).localStorage = createLocalStorageMock();
        } else {
            globalThis.localStorage.clear();
        }
    });

    it('filters to direct-only subtitles when Subtitle Mode is Direct', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_MODE, 'direct');

        const player = createPlayer([
            makeTextTrack({ id: 'direct', fetchableViaKey: true, key: '/library/streams/1' }),
            makeTextTrack({ id: 'server', fetchableViaKey: false }),
            makeBurnInTrack({ id: 'burn' }),
        ]);

        const coordinator = new PlaybackOptionsCoordinator({
            playbackOptionsModalId: 'playback-options',
            getNavigation: (): null => null,
            getPlaybackOptionsModal: (): null => null,
            getVideoPlayer: (): IVideoPlayer => player,
        });

        const viewModel = getViewModel(coordinator);
        const optionIds = viewModel.subtitles.options.map((option) => option.id);

        expect(optionIds).toContain('playback-subtitle-direct');
        expect(optionIds).not.toContain('playback-subtitle-server');
        expect(optionIds).not.toContain('playback-subtitle-burn');
    });

    it('prefers audio section when requested', () => {
        const player = createPlayer(
            [makeTextTrack({ id: 'sub-1' })],
            [{ id: 'audio-1', language: 'en', codec: 'aac', channels: 2 } as AudioTrack]
        );

        const coordinator = new PlaybackOptionsCoordinator({
            playbackOptionsModalId: 'playback-options',
            getNavigation: (): null => null,
            getPlaybackOptionsModal: (): null => null,
            getVideoPlayer: (): IVideoPlayer => player,
        });

        const prep = coordinator.prepareModal('audio');

        expect(prep.preferredFocusId).toBe('playback-audio-audio-1');
    });

    it('registers modal options with scroll-neutral native focus', () => {
        const player = createPlayer(
            [makeTextTrack({ id: 'sub-1' })],
            [{ id: 'audio-1', language: 'en', codec: 'aac', channels: 2 } as AudioTrack]
        );
        const navigation: INavigationManager = {
            registerFocusable: jest.fn(),
            setFocus: jest.fn(),
        } as unknown as INavigationManager;
        const modal = {
            show: jest.fn(),
        };
        const coordinator = new PlaybackOptionsCoordinator({
            playbackOptionsModalId: 'playback-options',
            getNavigation: (): INavigationManager => navigation,
            getPlaybackOptionsModal: (): IPlaybackOptionsModal => modal as unknown as IPlaybackOptionsModal,
            getVideoPlayer: (): IVideoPlayer => player,
        });

        const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
        const elementsById = new Map<string, HTMLElement>();
        const prep = coordinator.prepareModal('audio');
        for (const id of prep.focusableIds) {
            elementsById.set(id, { id, click: jest.fn() } as unknown as HTMLElement);
        }

        Object.defineProperty(globalThis, 'document', {
            value: {
                getElementById: jest.fn((id: string) => elementsById.get(id) ?? null),
            },
            configurable: true,
        });

        try {
            coordinator.handleModalOpen('playback-options');
        } finally {
            if (originalDocumentDescriptor) {
                Object.defineProperty(globalThis, 'document', originalDocumentDescriptor);
            } else {
                delete (globalThis as { document?: Document }).document;
            }
        }

        const focusables = (navigation.registerFocusable as jest.Mock).mock.calls.map(
            (call) => call[0]
        );
        expect(focusables).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'playback-subtitle-off',
                preventScrollOnFocus: true,
            }),
            expect.objectContaining({
                id: 'playback-subtitle-sub-1',
                preventScrollOnFocus: true,
            }),
            expect.objectContaining({
                id: 'playback-audio-audio-1',
                preventScrollOnFocus: true,
            }),
        ]));
        expect(navigation.setFocus).toHaveBeenCalledWith('playback-audio-audio-1');
    });

    it('surfaces unavailable subtitle and audio copy when no tracks exist', () => {
        const player = createPlayer([]);

        const coordinator = new PlaybackOptionsCoordinator({
            playbackOptionsModalId: 'playback-options',
            getNavigation: (): null => null,
            getPlaybackOptionsModal: (): null => null,
            getVideoPlayer: (): IVideoPlayer => player,
        });

        const viewModel = getViewModel(coordinator);

        expect(viewModel.subtitles.options.map((option) => option.id)).toEqual(['playback-subtitle-off']);
        expect(viewModel.subtitles.emptyMessage).toBe('No subtitles available');
        expect(viewModel.audio.options).toEqual([]);
        expect(viewModel.audio.emptyMessage).toBe('No alternate audio tracks available');
    });

    it('persists subtitle mode off when the Off option is selected', async () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_MODE, 'full');

        const player = createPlayer([makeTextTrack({ id: 'sub-1' })]);
        const coordinator = new PlaybackOptionsCoordinator({
            playbackOptionsModalId: 'playback-options',
            getNavigation: (): null => null,
            getPlaybackOptionsModal: (): null => null,
            getVideoPlayer: (): IVideoPlayer => player,
        });

        const viewModel = getViewModel(coordinator);
        const off = viewModel.subtitles.options.find((option) => option.id === 'playback-subtitle-off');

        off?.onSelect?.();
        await flushPlaybackOptionsPromises();

        expect(player.setSubtitleTrack).toHaveBeenCalledWith(null);
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.SUBTITLE_MODE)).toBe('off');
    });

    it('selecting a subtitle from Off mode reenables standard subtitle handling', async () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_MODE, 'off');

        const player = createPlayer([
            makeTextTrack({ id: 'sub-1', fetchableViaKey: true, key: '/library/streams/1' }),
        ]);
        const coordinator = new PlaybackOptionsCoordinator({
            playbackOptionsModalId: 'playback-options',
            getNavigation: (): null => null,
            getPlaybackOptionsModal: (): null => null,
            getVideoPlayer: (): IVideoPlayer => player,
        });

        const viewModel = getViewModel(coordinator);
        const option = viewModel.subtitles.options.find((o) => o.id === 'playback-subtitle-sub-1');

        option?.onSelect?.();
        await flushPlaybackOptionsPromises();

        expect(player.setSubtitleTrack).toHaveBeenCalledWith('sub-1');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.SUBTITLE_MODE)).toBe('standard');
    });

    it('shows burn-in tracks only in Full mode', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_MODE, 'full');

        const player = createPlayer([makeBurnInTrack({ id: 'burn' })]);

        const coordinator = new PlaybackOptionsCoordinator({
            playbackOptionsModalId: 'playback-options',
            getNavigation: (): null => null,
            getPlaybackOptionsModal: (): null => null,
            getVideoPlayer: (): IVideoPlayer => player,
        });

        const viewModel = getViewModel(coordinator);
        const burnOption = viewModel.subtitles.options.find((option) => option.id === 'playback-subtitle-burn');

        expect(burnOption?.meta).toBe('Burn-in');
    });

    it('labels direct vs burn-in for text tracks', () => {
        const player = createPlayer([
            makeTextTrack({ id: 'direct', fetchableViaKey: true, key: '/library/streams/1' }),
            makeTextTrack({ id: 'server', fetchableViaKey: false }),
        ]);
        const requestBurnInSubtitle = jest.fn();

        const coordinator = new PlaybackOptionsCoordinator({
            playbackOptionsModalId: 'playback-options',
            getNavigation: (): null => null,
            getPlaybackOptionsModal: (): null => null,
            getVideoPlayer: (): IVideoPlayer => player,
            requestBurnInSubtitle,
        });

        const viewModel = getViewModel(coordinator);
        const direct = viewModel.subtitles.options.find((option) => option.id === 'playback-subtitle-direct');
        const server = viewModel.subtitles.options.find((option) => option.id === 'playback-subtitle-server');

        expect(direct?.meta).toBe('Direct');
        expect(server?.meta).toBe('Burn-in');
    });

    it('renders unavailable burn-in options without making them focusable', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_MODE, 'full');

        const player = createPlayer([makeTextTrack({ id: 'server', fetchableViaKey: false })]);
        const coordinator = new PlaybackOptionsCoordinator({
            playbackOptionsModalId: 'playback-options',
            getNavigation: (): null => null,
            getPlaybackOptionsModal: (): null => null,
            getVideoPlayer: (): IVideoPlayer => player,
        });

        const prep = coordinator.prepareModal('subtitles');
        const viewModel = (coordinator as unknown as {
            pendingViewModel: PlaybackOptionsViewModel | null;
        }).pendingViewModel!;
        const server = viewModel.subtitles.options.find((option) => option.id === 'playback-subtitle-server');

        expect(server).toEqual(expect.objectContaining({ meta: 'Burn-in', disabled: true }));
        expect(prep.focusableIds).toEqual(['playback-subtitle-off']);
        expect(prep.preferredFocusId).toBe('playback-subtitle-off');
    });

    it('requests burn-in immediately for burn-in subtitle formats in Full mode', async () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_MODE, 'full');

        const player = createPlayer([makeBurnInTrack({ id: 'burn' })]);
        const requestBurnInSubtitle = jest.fn();

        const coordinator = new PlaybackOptionsCoordinator({
            playbackOptionsModalId: 'playback-options',
            getNavigation: (): null => null,
            getPlaybackOptionsModal: (): null => null,
            getVideoPlayer: (): IVideoPlayer => player,
            requestBurnInSubtitle,
        });

        const viewModel = getViewModel(coordinator);
        const burn = viewModel.subtitles.options.find((option) => option.id === 'playback-subtitle-burn');

        burn?.onSelect?.();
        await flushPlaybackOptionsPromises();

        expect(requestBurnInSubtitle).toHaveBeenCalledWith('burn', expect.any(String));
        expect((player.setSubtitleTrack as jest.Mock)).not.toHaveBeenCalled();
    });

    it('requests burn-in immediately for keyless text subtitles in Full mode', async () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_MODE, 'full');

        const requestBurnInSubtitle = jest.fn();
        const fetchMock = jest.fn();
        const { restore } = installFetchMock(fetchMock);
        const player = createPlayer([makeTextTrack({ id: 'keyless', fetchableViaKey: false })]);
        try {
            const coordinator = new PlaybackOptionsCoordinator({
                playbackOptionsModalId: 'playback-options',
                getNavigation: (): null => null,
                getPlaybackOptionsModal: (): null => null,
                getVideoPlayer: (): IVideoPlayer => player,
                requestBurnInSubtitle,
            });

            const viewModel = getViewModel(coordinator);
            const option = viewModel.subtitles.options.find((o) => o.id === 'playback-subtitle-keyless');

            expect(option?.meta).toBe('Burn-in');
            option?.onSelect?.();

            await flushPlaybackOptionsPromises();

            expect(fetchMock).not.toHaveBeenCalled();
            expect(requestBurnInSubtitle).toHaveBeenCalledWith('keyless', 'user_selected_text_burn_in');
            expect((player.setSubtitleTrack as jest.Mock)).not.toHaveBeenCalled();
        } finally {
            restore();
        }
    });

    it('shows a failure toast when burn-in subtitle request reports a failed outcome', async () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_MODE, 'full');

        const player = createPlayer([makeBurnInTrack({ id: 'burn' })]);
        const requestBurnInSubtitle = jest.fn().mockResolvedValue({ outcome: 'failed' });
        const notifyToast = jest.fn();

        const coordinator = new PlaybackOptionsCoordinator({
            playbackOptionsModalId: 'playback-options',
            getNavigation: (): null => null,
            getPlaybackOptionsModal: (): null => null,
            getVideoPlayer: (): IVideoPlayer => player,
            requestBurnInSubtitle,
            notifyToast,
        });

        const viewModel = getViewModel(coordinator);
        const burn = viewModel.subtitles.options.find((option) => option.id === 'playback-subtitle-burn');

        burn?.onSelect?.();
        await flushPlaybackOptionsPromises();

        expect(notifyToast).toHaveBeenCalledWith({ message: 'Loading burn-in subtitles…', type: 'info' });
        expect(notifyToast).toHaveBeenCalledWith({ message: 'Failed to load burn-in subtitles', type: 'warning' });
    });

    it('suppresses late burn-in failure outcome toasts after disposal', async () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_MODE, 'full');

        const player = createPlayer([makeBurnInTrack({ id: 'burn' })]);
        const deferredRequest = createDeferred<{ outcome: 'failed' }>();
        const requestBurnInSubtitle = jest.fn().mockReturnValue(deferredRequest.promise);
        const notifyToast = jest.fn();

        const coordinator = new PlaybackOptionsCoordinator({
            playbackOptionsModalId: 'playback-options',
            getNavigation: (): null => null,
            getPlaybackOptionsModal: (): null => null,
            getVideoPlayer: (): IVideoPlayer => player,
            requestBurnInSubtitle,
            notifyToast,
        });

        getViewModel(coordinator).subtitles.options
            .find((option) => option.id === 'playback-subtitle-burn')
            ?.onSelect?.();
        coordinator.dispose();
        deferredRequest.resolve({ outcome: 'failed' });

        await flushPlaybackOptionsPromises();

        expect(notifyToast).toHaveBeenCalledWith({ message: 'Loading burn-in subtitles…', type: 'info' });
        expect(notifyToast).not.toHaveBeenCalledWith({ message: 'Failed to load burn-in subtitles', type: 'warning' });
    });

    it('does not show a failure toast when burn-in subtitle request is ignored', async () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_MODE, 'full');

        const player = createPlayer([makeBurnInTrack({ id: 'burn' })]);
        const requestBurnInSubtitle = jest.fn().mockResolvedValue({
            outcome: 'ignored',
            reason: 'already_burned_in',
        });
        const notifyToast = jest.fn();

        const coordinator = new PlaybackOptionsCoordinator({
            playbackOptionsModalId: 'playback-options',
            getNavigation: (): null => null,
            getPlaybackOptionsModal: (): null => null,
            getVideoPlayer: (): IVideoPlayer => player,
            requestBurnInSubtitle,
            notifyToast,
        });

        const viewModel = getViewModel(coordinator);
        const burn = viewModel.subtitles.options.find((option) => option.id === 'playback-subtitle-burn');

        burn?.onSelect?.();
        await flushPlaybackOptionsPromises();

        expect(notifyToast).toHaveBeenCalledWith({ message: 'Loading burn-in subtitles…', type: 'info' });
        expect(notifyToast).not.toHaveBeenCalledWith({ message: 'Failed to load burn-in subtitles', type: 'warning' });
    });

    it('shows a failure toast when burn-in subtitle request rejects', async () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_MODE, 'full');

        const player = createPlayer([makeBurnInTrack({ id: 'burn' })]);
        const requestBurnInSubtitle = jest.fn().mockRejectedValue(new Error('fail'));
        const notifyToast = jest.fn();

        const coordinator = new PlaybackOptionsCoordinator({
            playbackOptionsModalId: 'playback-options',
            getNavigation: (): null => null,
            getPlaybackOptionsModal: (): null => null,
            getVideoPlayer: (): IVideoPlayer => player,
            requestBurnInSubtitle,
            notifyToast,
        });

        const viewModel = getViewModel(coordinator);
        const burn = viewModel.subtitles.options.find((option) => option.id === 'playback-subtitle-burn');

        burn?.onSelect?.();
        await flushPlaybackOptionsPromises();

        expect(notifyToast).toHaveBeenCalledWith({ message: 'Loading burn-in subtitles…', type: 'info' });
        expect(notifyToast).toHaveBeenCalledWith({ message: 'Failed to load burn-in subtitles', type: 'warning' });
    });

    it('suppresses late burn-in rejection toasts after disposal', async () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_MODE, 'full');

        const player = createPlayer([makeBurnInTrack({ id: 'burn' })]);
        const deferredRequest = createDeferred<never>();
        const requestBurnInSubtitle = jest.fn().mockReturnValue(deferredRequest.promise);
        const notifyToast = jest.fn();

        const coordinator = new PlaybackOptionsCoordinator({
            playbackOptionsModalId: 'playback-options',
            getNavigation: (): null => null,
            getPlaybackOptionsModal: (): null => null,
            getVideoPlayer: (): IVideoPlayer => player,
            requestBurnInSubtitle,
            notifyToast,
        });

        getViewModel(coordinator).subtitles.options
            .find((option) => option.id === 'playback-subtitle-burn')
            ?.onSelect?.();
        coordinator.dispose();
        deferredRequest.reject(new Error('fail'));

        await flushPlaybackOptionsPromises();

        expect(notifyToast).toHaveBeenCalledWith({ message: 'Loading burn-in subtitles…', type: 'info' });
        expect(notifyToast).not.toHaveBeenCalledWith({ message: 'Failed to load burn-in subtitles', type: 'warning' });
    });

    it('does not persist subtitle track preference (no per-item or global storage)', async (): Promise<void> => {
        const player = createPlayer([
            makeTextTrack({ id: 'sub-99', fetchableViaKey: true, key: '/library/streams/99' }),
        ]);

        const coordinator = new PlaybackOptionsCoordinator({
            playbackOptionsModalId: 'playback-options',
            getNavigation: (): null => null,
            getPlaybackOptionsModal: (): null => null,
            getVideoPlayer: (): IVideoPlayer => player,
        });

        const viewModel = getViewModel(coordinator);
        const option = viewModel.subtitles.options.find((o) => o.id === 'playback-subtitle-sub-99');
        option?.onSelect();

        await flushPlaybackOptionsPromises();

        const storedItem = localStorage.getItem('lineup_subtitle_pref_item:item-99');
        const storedGlobal = localStorage.getItem('lineup_subtitle_pref_global');
        expect(storedItem).toBeNull();
        expect(storedGlobal).toBeNull();
    });

    it('shows a warning toast for audio switch errors and still closes/refreshes modal state', async () => {
        const navigation: INavigationManager = {
            isModalOpen: jest.fn().mockReturnValue(true),
            closeModal: jest.fn(),
        } as unknown as INavigationManager;
        const player = createPlayer(
            [makeTextTrack({ id: 'sub-1' })],
            [{ id: 'audio-1', language: 'en', codec: 'aac', channels: 2 } as AudioTrack]
        );
        (player.setAudioTrack as jest.Mock).mockRejectedValue(new Error('switch failed X-Plex-Token=abc123'));
        const notifyToast = jest.fn();

        const coordinator = new PlaybackOptionsCoordinator({
            playbackOptionsModalId: 'playback-options',
            getNavigation: (): INavigationManager => navigation,
            getPlaybackOptionsModal: (): null => null,
            getVideoPlayer: (): IVideoPlayer => player,
            notifyToast,
        });
        const refreshSpy = jest.spyOn(coordinator, 'refreshIfOpen').mockImplementation(() => undefined);

        const viewModel = getViewModel(coordinator);
        const audioOption = viewModel.audio.options.find((option) => option.id === 'playback-audio-audio-1');
        audioOption?.onSelect?.();
        await flushPlaybackOptionsPromises();

        expect(notifyToast).toHaveBeenCalledWith({ message: 'Failed to apply audio track change', type: 'warning' });
        expect(navigation.closeModal).toHaveBeenCalledWith('playback-options');
        expect(refreshSpy).toHaveBeenCalled();
    });

    it('closes modal after selecting subtitle or audio', () => {
        const navigation: INavigationManager = {
            isModalOpen: jest.fn().mockReturnValue(true),
            closeModal: jest.fn(),
        } as unknown as INavigationManager;
        const player = createPlayer(
            [makeTextTrack({ id: 'sub-1' })],
            [{ id: 'audio-1', language: 'en', codec: 'aac', channels: 2 } as AudioTrack]
        );

        const coordinator = new PlaybackOptionsCoordinator({
            playbackOptionsModalId: 'playback-options',
            getNavigation: (): INavigationManager => navigation,
            getPlaybackOptionsModal: (): null => null,
            getVideoPlayer: (): IVideoPlayer => player,
        });

        const viewModel = getViewModel(coordinator);
        const subtitleOption = viewModel.subtitles.options.find((option) => option.id === 'playback-subtitle-sub-1');
        subtitleOption?.onSelect?.();
        const audioOption = viewModel.audio.options.find((option) => option.id === 'playback-audio-audio-1');
        audioOption?.onSelect?.();

        expect(navigation.closeModal).toHaveBeenCalledWith('playback-options');
    });
});
