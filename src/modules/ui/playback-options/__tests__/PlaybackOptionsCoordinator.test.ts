import { PlaybackOptionsCoordinator } from '../PlaybackOptionsCoordinator';
import type { AudioTrack, IVideoPlayer, StreamDescriptor, SubtitleTrack } from '../../../player';
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
    return coordinator.getViewModel();
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
            getVideoPlayer: (): IVideoPlayer => player,
        });

        const viewModel = getViewModel(coordinator);
        const optionIds = viewModel.subtitles.options.map((option) => option.id);

        expect(optionIds).toContain('playback-subtitle-direct');
        expect(optionIds).not.toContain('playback-subtitle-server');
        expect(optionIds).not.toContain('playback-subtitle-burn');
    });

    it('surfaces unavailable subtitle and audio copy when no tracks exist', () => {
        const player = createPlayer([]);

        const coordinator = new PlaybackOptionsCoordinator({
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
            getVideoPlayer: (): IVideoPlayer => player,
            requestBurnInSubtitle,
        });

        const viewModel = getViewModel(coordinator);
        const direct = viewModel.subtitles.options.find((option) => option.id === 'playback-subtitle-direct');
        const server = viewModel.subtitles.options.find((option) => option.id === 'playback-subtitle-server');

        expect(direct?.meta).toBe('Direct');
        expect(server?.meta).toBe('Burn-in');
    });

    it('requests burn-in immediately for burn-in subtitle formats in Full mode', async () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_MODE, 'full');

        const player = createPlayer([makeBurnInTrack({ id: 'burn' })]);
        const requestBurnInSubtitle = jest.fn();

        const coordinator = new PlaybackOptionsCoordinator({
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

    it.each([
        'missing_deps', 'recovery_in_progress', 'already_attempted',
        'no_program', 'program_changed', 'admission_changed',
    ] as const)('keeps the confirmed subtitle and marks active ignored %s as failed', async (reason) => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_MODE, 'full');
        const player = createPlayer([makeTextTrack({ id: 'old' }), makeBurnInTrack({ id: 'burn' })]);
        player.getState = jest.fn(() => ({
            activeAudioId: null, activeSubtitleId: 'old',
        } as ReturnType<IVideoPlayer['getState']>));
        const notifyToast = jest.fn();
        const coordinator = new PlaybackOptionsCoordinator({
            getVideoPlayer: (): IVideoPlayer => player,
            requestBurnInSubtitle: jest.fn().mockResolvedValue({ outcome: 'ignored', reason }),
            notifyToast,
        });

        coordinator.getViewModel().subtitles.options
            .find((option) => option.id === 'playback-subtitle-burn')?.onSelect();
        await flushPlaybackOptionsPromises();

        const options = coordinator.getViewModel().subtitles.options;
        expect(options.find((option) => option.id === 'playback-subtitle-old')?.selected).toBe(true);
        expect(options.find((option) => option.id === 'playback-subtitle-burn')?.state).toBe('Failed');
        expect(notifyToast).toHaveBeenCalledWith({ message: 'Failed to load burn-in subtitles', type: 'warning' });
    });

    it('suppresses an ignored result after the media identity changes', async () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_MODE, 'full');
        const player = createPlayer([makeBurnInTrack({ id: 'burn' })]);
        const deferred = createDeferred<{ outcome: 'ignored'; reason: 'program_changed' }>();
        let identity = 'first-program';
        const notifyToast = jest.fn();
        const onSelectionChange = jest.fn();
        const coordinator = new PlaybackOptionsCoordinator({
            getVideoPlayer: (): IVideoPlayer => player,
            getMediaIdentity: (): string => identity,
            requestBurnInSubtitle: jest.fn().mockReturnValue(deferred.promise),
            notifyToast,
            onSelectionChange,
        });
        coordinator.getViewModel().subtitles.options[0]?.onSelect();
        identity = 'later-program';
        deferred.resolve({ outcome: 'ignored', reason: 'program_changed' });
        await flushPlaybackOptionsPromises();

        expect(coordinator.getViewModel().subtitles.options[0]?.state).toBeUndefined();
        expect(notifyToast).not.toHaveBeenCalledWith({ message: 'Failed to load burn-in subtitles', type: 'warning' });
        expect(onSelectionChange).toHaveBeenCalledTimes(1);
    });

    it('shows a failure toast when burn-in subtitle request rejects', async () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_MODE, 'full');

        const player = createPlayer([makeBurnInTrack({ id: 'burn' })]);
        const requestBurnInSubtitle = jest.fn().mockRejectedValue(new Error('fail'));
        const notifyToast = jest.fn();

        const coordinator = new PlaybackOptionsCoordinator({
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

    it('reports audio switch failure and exposes failed drawer state', async () => {
        const player = createPlayer(
            [makeTextTrack({ id: 'sub-1' })],
            [{ id: 'audio-1', language: 'en', codec: 'aac', channels: 2 } as AudioTrack]
        );
        (player.setAudioTrack as jest.Mock).mockRejectedValue(new Error('switch failed X-Plex-Token=abc123'));
        const notifyToast = jest.fn();
        const onSelectionChange = jest.fn();
        const coordinator = new PlaybackOptionsCoordinator({
            getVideoPlayer: (): IVideoPlayer => player,
            notifyToast,
            onSelectionChange,
        });

        coordinator.getViewModel().audio.options.find((option) => option.id === 'playback-audio-audio-1')?.onSelect();
        await flushPlaybackOptionsPromises();

        expect(notifyToast).toHaveBeenCalledWith({ message: 'Failed to apply audio track change', type: 'warning' });
        expect(coordinator.getViewModel().audio.options[0]?.state).toBe('Failed');
        expect(onSelectionChange).toHaveBeenCalled();
    });

    it('keeps the confirmed audio check while a new choice is pending and failed', async () => {
        const pending = createDeferred<void>();
        const player = createPlayer([], [
            { id: 'old', language: 'en', codec: 'aac', channels: 2 } as AudioTrack,
            { id: 'new', language: 'fr', codec: 'aac', channels: 2 } as AudioTrack,
        ]);
        player.getState = jest.fn(() => ({ activeAudioId: 'old', activeSubtitleId: null } as ReturnType<IVideoPlayer['getState']>));
        (player.setAudioTrack as jest.Mock).mockReturnValue(pending.promise);
        const coordinator = new PlaybackOptionsCoordinator({
            getVideoPlayer: (): IVideoPlayer => player,
        });
        coordinator.getViewModel().audio.options.find((option) => option.id === 'playback-audio-new')?.onSelect();
        let rows = coordinator.getViewModel().audio.options;
        expect(rows.find((row) => row.id === 'playback-audio-old')?.selected).toBe(true);
        expect(rows.find((row) => row.id === 'playback-audio-new')?.state).toBe('Applying…');
        pending.reject(new Error('selection failed'));
        await flushPlaybackOptionsPromises();
        rows = coordinator.getViewModel().audio.options;
        expect(rows.find((row) => row.id === 'playback-audio-old')?.selected).toBe(true);
        expect(rows.find((row) => row.id === 'playback-audio-new')?.state).toBe('Failed');
    });

    it('does not publish a late track result into another media identity', async () => {
        const pending = createDeferred<void>();
        const player = createPlayer([], [{ id: 'audio-1', language: 'en', codec: 'aac', channels: 2 } as AudioTrack]);
        (player.setAudioTrack as jest.Mock).mockReturnValue(pending.promise);
        let identity = 'program-1';
        const onSelectionChange = jest.fn();
        const coordinator = new PlaybackOptionsCoordinator({
            getVideoPlayer: (): IVideoPlayer => player,
            getMediaIdentity: (): string => identity,
            onSelectionChange,
        });
        coordinator.getViewModel().audio.options[0]?.onSelect();
        identity = 'program-2';
        pending.reject(new Error('late failure'));
        await flushPlaybackOptionsPromises();
        expect(coordinator.getViewModel().audio.options[0]?.state).toBeUndefined();
        expect(onSelectionChange).toHaveBeenCalledTimes(1);
    });

    it('fences a completed track request when a same-program stream is replaced', async () => {
        const pending = createDeferred<void>();
        const player = createPlayer([], [{ id: 'audio-1', language: 'en', codec: 'aac', channels: 2 } as AudioTrack]);
        (player.setAudioTrack as jest.Mock).mockReturnValue(pending.promise);
        let descriptor = { url: 'first' } as StreamDescriptor;
        const onSelectionChange = jest.fn();
        const coordinator = new PlaybackOptionsCoordinator({
            getVideoPlayer: (): IVideoPlayer => player,
            getMediaIdentity: (): string => 'same-program',
            getMediaDescriptor: (): StreamDescriptor => descriptor,
            onSelectionChange,
        });
        coordinator.getViewModel().audio.options[0]?.onSelect();
        descriptor = { url: 'replacement' } as StreamDescriptor;
        pending.reject(new Error('old stream failed'));
        await flushPlaybackOptionsPromises();
        expect(coordinator.getViewModel().audio.options[0]?.state).toBeUndefined();
        expect(onSelectionChange).toHaveBeenCalledTimes(1);
    });

    it('keeps a confirmed subtitle visible when the selected mode filters its format', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_MODE, 'direct');
        const player = createPlayer([makeBurnInTrack({ id: 'confirmed' })]);
        player.getState = jest.fn(() => ({ activeSubtitleId: 'confirmed', activeAudioId: null } as ReturnType<IVideoPlayer['getState']>));
        const coordinator = new PlaybackOptionsCoordinator({
            getVideoPlayer: (): IVideoPlayer => player,
        });
        const selected = coordinator.getViewModel().subtitles.options.find((option) => option.selected);
        expect(selected?.id).toBe('playback-subtitle-confirmed');
        expect(selected?.disabled).toBe(true);
    });

    it('does not warn for a superseded audio failure on the same media', async () => {
        const first = createDeferred<void>();
        const second = createDeferred<void>();
        const player = createPlayer([], [
            { id: 'first', language: 'en', codec: 'aac', channels: 2 } as AudioTrack,
            { id: 'second', language: 'fr', codec: 'aac', channels: 2 } as AudioTrack,
        ]);
        (player.setAudioTrack as jest.Mock)
            .mockReturnValueOnce(first.promise)
            .mockReturnValueOnce(second.promise);
        const notifyToast = jest.fn();
        const coordinator = new PlaybackOptionsCoordinator({
            getVideoPlayer: (): IVideoPlayer => player,
            notifyToast,
        });
        coordinator.getViewModel().audio.options[0]?.onSelect();
        coordinator.getViewModel().audio.options[1]?.onSelect();
        first.reject(new Error('old request failed'));
        await flushPlaybackOptionsPromises();
        expect(notifyToast).not.toHaveBeenCalled();
        second.resolve();
        await flushPlaybackOptionsPromises();
    });

});
