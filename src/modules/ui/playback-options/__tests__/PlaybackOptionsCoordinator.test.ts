import { PlaybackOptionsCoordinator, SUBTITLE_PROBE_TOTAL_TIMEOUT_MS } from '../PlaybackOptionsCoordinator';
import type { IVideoPlayer } from '../../../player';
import type { INavigationManager } from '../../../navigation';
import type { PlaybackOptionsViewModel } from '../types';
import type { ScheduledProgram } from '../../../scheduler/scheduler';
import type { SubtitleTrack, AudioTrack } from '../../../player/types';
import { RETUNE_STORAGE_KEYS } from '../../../../config/storageKeys';
import type { StreamDescriptor } from '../../../player/types';

const makeProgram = (ratingKey = 'item-1'): ScheduledProgram =>
    ({
        item: {
            ratingKey,
            title: 'Test Item',
            durationMs: 60000,
            type: 'movie',
        } as ScheduledProgram['item'],
        elapsedMs: 0,
        scheduledStartTime: 0,
        scheduledEndTime: 0,
        remainingMs: 0,
        scheduleIndex: 0,
    } as ScheduledProgram);

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

const flushPromises = async (rounds: number = 10): Promise<void> => {
    for (let i = 0; i < rounds; i += 1) {
        await Promise.resolve();
    }
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
        localStorage.setItem(RETUNE_STORAGE_KEYS.SUBTITLE_MODE, 'direct');

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
            getCurrentProgram: (): ScheduledProgram | null => makeProgram(),
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
            getCurrentProgram: (): ScheduledProgram | null => makeProgram(),
        });

        const prep = coordinator.prepareModal('audio');

        expect(prep.preferredFocusId).toBe('playback-audio-audio-1');
    });

    it('shows burn-in tracks only in Full mode', () => {
        localStorage.setItem(RETUNE_STORAGE_KEYS.SUBTITLE_MODE, 'full');

        const player = createPlayer([makeBurnInTrack({ id: 'burn' })]);

        const coordinator = new PlaybackOptionsCoordinator({
            playbackOptionsModalId: 'playback-options',
            getNavigation: (): null => null,
            getPlaybackOptionsModal: (): null => null,
            getVideoPlayer: (): IVideoPlayer => player,
            getCurrentProgram: (): ScheduledProgram | null => makeProgram(),
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

        const coordinator = new PlaybackOptionsCoordinator({
            playbackOptionsModalId: 'playback-options',
            getNavigation: (): null => null,
            getPlaybackOptionsModal: (): null => null,
            getVideoPlayer: (): IVideoPlayer => player,
            getCurrentProgram: (): ScheduledProgram | null => makeProgram(),
        });

        const viewModel = getViewModel(coordinator);
        const direct = viewModel.subtitles.options.find((option) => option.id === 'playback-subtitle-direct');
        const server = viewModel.subtitles.options.find((option) => option.id === 'playback-subtitle-server');

        expect(direct?.meta).toBe('Direct');
        expect(server?.meta).toBe('Extract');
    });

    it('requests burn-in immediately for burn-in subtitle formats in Full mode', async () => {
        localStorage.setItem(RETUNE_STORAGE_KEYS.SUBTITLE_MODE, 'full');

        const player = createPlayer([makeBurnInTrack({ id: 'burn' })]);
        const requestBurnInSubtitle = jest.fn();

        const coordinator = new PlaybackOptionsCoordinator({
            playbackOptionsModalId: 'playback-options',
            getNavigation: (): null => null,
            getPlaybackOptionsModal: (): null => null,
            getVideoPlayer: (): IVideoPlayer => player,
            getCurrentProgram: (): ScheduledProgram | null => makeProgram(),
            requestBurnInSubtitle,
        });

        const viewModel = getViewModel(coordinator);
        const burn = viewModel.subtitles.options.find((option) => option.id === 'playback-subtitle-burn');

        burn?.onSelect?.();
        await flushPromises();

        expect(requestBurnInSubtitle).toHaveBeenCalledWith('burn', expect.any(String));
        expect((player.setSubtitleTrack as jest.Mock)).not.toHaveBeenCalled();
    });

    it('requests burn-in immediately for unsupported text subtitle probes in Full mode', async () => {
        localStorage.setItem(RETUNE_STORAGE_KEYS.SUBTITLE_MODE, 'full');

        const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 501 });
        const { restore } = installFetchMock(fetchMock);

        try {
            const player = createPlayer([makeTextTrack({ id: 'keyless', fetchableViaKey: false })]);
            const requestBurnInSubtitle = jest.fn();

            const coordinator = new PlaybackOptionsCoordinator({
                playbackOptionsModalId: 'playback-options',
                getNavigation: (): null => null,
                getPlaybackOptionsModal: (): null => null,
                getVideoPlayer: (): IVideoPlayer => player,
                getCurrentProgram: (): ScheduledProgram | null => makeProgram(),
                getCurrentStreamDescriptor: (): StreamDescriptor =>
                    ({
                        subtitleContext: { serverUri: 'http://example.com', authHeaders: { 'X-Plex-Token': 'token' } },
                    } as unknown as StreamDescriptor),
                requestBurnInSubtitle,
            });

            const viewModel = getViewModel(coordinator);
            const option = viewModel.subtitles.options.find((o) => o.id === 'playback-subtitle-keyless');
            option?.onSelect?.();

            await flushPromises();

            expect(fetchMock).toHaveBeenCalledWith(
                expect.stringContaining('/library/streams/keyless'),
                expect.objectContaining({
                    method: 'HEAD',
                    headers: { Accept: 'text/vtt, text/plain, */*' },
                })
            );
            expect(fetchMock.mock.calls[0]?.[0]).toContain('X-Plex-Token=token');
            expect(requestBurnInSubtitle).toHaveBeenCalledWith('keyless', expect.any(String));
            expect((player.setSubtitleTrack as jest.Mock)).not.toHaveBeenCalled();
        } finally {
            restore();
        }
    });

    it('scopes subtitle probe cache by server identity', async () => {
        localStorage.setItem(RETUNE_STORAGE_KEYS.SUBTITLE_MODE, 'full');

        const fetchMock = jest.fn()
            .mockResolvedValueOnce({ ok: false, status: 400 })
            .mockResolvedValueOnce({ ok: true, status: 200 });
        const { restore } = installFetchMock(fetchMock);

        try {
            const player = createPlayer([makeTextTrack({ id: 'keyless', fetchableViaKey: false })]);
            const requestBurnInSubtitle = jest.fn();
            let context: NonNullable<StreamDescriptor['subtitleContext']> = {
                serverUri: 'http://server-a',
                authHeaders: { 'X-Plex-Token': 'token-a' },
                itemKey: 'item-1',
            };

            const coordinator = new PlaybackOptionsCoordinator({
                playbackOptionsModalId: 'playback-options',
                getNavigation: (): null => null,
                getPlaybackOptionsModal: (): null => null,
                getVideoPlayer: (): IVideoPlayer => player,
                getCurrentProgram: (): ScheduledProgram | null => makeProgram('item-1'),
                getCurrentStreamDescriptor: (): StreamDescriptor =>
                    ({ subtitleContext: context } as unknown as StreamDescriptor),
                requestBurnInSubtitle,
            });

            const firstViewModel = getViewModel(coordinator);
            const firstOption = firstViewModel.subtitles.options.find((o) => o.id === 'playback-subtitle-keyless');
            firstOption?.onSelect?.();

            await flushPromises();

            expect(requestBurnInSubtitle).toHaveBeenCalledWith('keyless', expect.any(String));

            context = {
                serverUri: 'http://server-b',
                authHeaders: { 'X-Plex-Token': 'token-b' },
                itemKey: 'item-1',
            };

            const secondViewModel = getViewModel(coordinator);
            const secondOption = secondViewModel.subtitles.options.find((o) => o.id === 'playback-subtitle-keyless');
            secondOption?.onSelect?.();

            await flushPromises();

            expect(fetchMock).toHaveBeenCalledTimes(2);
            expect((player.setSubtitleTrack as jest.Mock)).toHaveBeenCalledWith('keyless');
        } finally {
            restore();
        }
    });

    it('ignores stale probe results when playback item changes', async () => {
        localStorage.setItem(RETUNE_STORAGE_KEYS.SUBTITLE_MODE, 'full');

        let resolveFetch: ((value: { ok: boolean; status: number }) => void) | undefined;
        const fetchMock = jest.fn().mockImplementation(() => (
            new Promise((resolve) => {
                resolveFetch = resolve as (value: { ok: boolean; status: number }) => void;
            })
        ));
        const { restore } = installFetchMock(fetchMock);

        try {
            const subtitles = [makeTextTrack({ id: 'keyless', fetchableViaKey: false })];
            const player = createPlayer(subtitles);
            const requestBurnInSubtitle = jest.fn();
            let currentProgram: ScheduledProgram | null = makeProgram('item-1');

            const coordinator = new PlaybackOptionsCoordinator({
                playbackOptionsModalId: 'playback-options',
                getNavigation: (): null => null,
                getPlaybackOptionsModal: (): null => null,
                getVideoPlayer: (): IVideoPlayer => player,
                getCurrentProgram: (): ScheduledProgram | null => currentProgram,
                getCurrentStreamDescriptor: (): StreamDescriptor =>
                    ({
                        subtitleContext: {
                            serverUri: 'http://example.com',
                            authHeaders: { 'X-Plex-Token': 'token' },
                            itemKey: currentProgram?.item.ratingKey ?? undefined,
                        },
                    } as unknown as StreamDescriptor),
                requestBurnInSubtitle,
            });

            const viewModel = getViewModel(coordinator);
            const option = viewModel.subtitles.options.find((o) => o.id === 'playback-subtitle-keyless');
            option?.onSelect?.();

            currentProgram = makeProgram('item-2');
            subtitles.splice(0, subtitles.length, makeTextTrack({ id: 'other', fetchableViaKey: false }));
            if (resolveFetch) {
                resolveFetch({ ok: false, status: 404 });
            }

            await flushPromises();

            expect(requestBurnInSubtitle).not.toHaveBeenCalled();
            expect((player.setSubtitleTrack as jest.Mock)).not.toHaveBeenCalled();
        } finally {
            restore();
        }
    });

    it('ignores stale probe results when the user re-selects another subtitle', async () => {
        localStorage.setItem(RETUNE_STORAGE_KEYS.SUBTITLE_MODE, 'full');

        let resolveFirstProbe: ((value: { ok: boolean; status: number }) => void) | undefined;
        const fetchMock = jest.fn().mockImplementation((url: string) => {
            if (url.includes('/library/streams/first')) {
                return new Promise((resolve) => {
                    resolveFirstProbe = resolve as (value: { ok: boolean; status: number }) => void;
                });
            }
            if (url.includes('/library/streams/second')) {
                return Promise.resolve({ ok: true, status: 200 });
            }
            throw new Error(`Unexpected probe URL: ${url}`);
        });
        const { restore } = installFetchMock(fetchMock);

        try {
            const subtitles = [
                makeTextTrack({ id: 'first', fetchableViaKey: false }),
                makeTextTrack({ id: 'second', fetchableViaKey: false }),
            ];
            const player = createPlayer(subtitles);
            const requestBurnInSubtitle = jest.fn();

            const coordinator = new PlaybackOptionsCoordinator({
                playbackOptionsModalId: 'playback-options',
                getNavigation: (): null => null,
                getPlaybackOptionsModal: (): null => null,
                getVideoPlayer: (): IVideoPlayer => player,
                getCurrentProgram: (): ScheduledProgram | null => makeProgram('item-1'),
                getCurrentStreamDescriptor: (): StreamDescriptor =>
                    ({
                        subtitleContext: {
                            serverUri: 'http://example.com',
                            authHeaders: { 'X-Plex-Token': 'token' },
                            itemKey: 'item-1',
                        },
                    } as unknown as StreamDescriptor),
                requestBurnInSubtitle,
            });

            const viewModel = getViewModel(coordinator);
            const first = viewModel.subtitles.options.find((o) => o.id === 'playback-subtitle-first');
            const second = viewModel.subtitles.options.find((o) => o.id === 'playback-subtitle-second');

            first?.onSelect?.();
            second?.onSelect?.();

            await flushPromises();

            expect((player.setSubtitleTrack as jest.Mock)).toHaveBeenCalledWith('second');
            expect(requestBurnInSubtitle).not.toHaveBeenCalled();

            if (resolveFirstProbe) {
                resolveFirstProbe({ ok: false, status: 404 });
            }

            await flushPromises();

            expect(requestBurnInSubtitle).not.toHaveBeenCalled();
            expect((player.setSubtitleTrack as jest.Mock)).not.toHaveBeenCalledWith('first');
        } finally {
            restore();
        }
    });

    it('requests burn-in when text subtitle probe times out in Full mode', async (): Promise<void> => {
        localStorage.setItem(RETUNE_STORAGE_KEYS.SUBTITLE_MODE, 'full');

        jest.useFakeTimers();
        const fetchMock = jest.fn().mockImplementation((_url: string, init?: RequestInit) => (
            new Promise((_resolve, reject) => {
                const signal = init?.signal;
                if (!signal) return;
                if (signal.aborted) {
                    reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
                    return;
                }
                signal.addEventListener('abort', () => {
                    reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
                });
                // Never resolves unless aborted.
            })
        ));
        const { restore } = installFetchMock(fetchMock);

        try {
            const player = createPlayer([makeTextTrack({ id: 'keyless', fetchableViaKey: false })]);
            const requestBurnInSubtitle = jest.fn();

            const coordinator = new PlaybackOptionsCoordinator({
                playbackOptionsModalId: 'playback-options',
                getNavigation: (): null => null,
                getPlaybackOptionsModal: (): null => null,
                getVideoPlayer: (): IVideoPlayer => player,
                getCurrentProgram: (): ScheduledProgram | null => makeProgram(),
                getCurrentStreamDescriptor: (): StreamDescriptor =>
                    ({
                        subtitleContext: { serverUri: 'http://example.com', authHeaders: { 'X-Plex-Token': 'token' } },
                    } as unknown as StreamDescriptor),
                requestBurnInSubtitle,
            });

            const viewModel = getViewModel(coordinator);
            const option = viewModel.subtitles.options.find((o) => o.id === 'playback-subtitle-keyless');
            option?.onSelect?.();

            jest.advanceTimersByTime(SUBTITLE_PROBE_TOTAL_TIMEOUT_MS + 50);
            await flushPromises();

            expect(requestBurnInSubtitle).toHaveBeenCalledWith('keyless', expect.any(String));
            expect((player.setSubtitleTrack as jest.Mock)).not.toHaveBeenCalled();
        } finally {
            jest.useRealTimers();
            restore();
        }
    });

    it('shows a failure toast when burn-in subtitle request returns false', async () => {
        localStorage.setItem(RETUNE_STORAGE_KEYS.SUBTITLE_MODE, 'full');

        const player = createPlayer([makeBurnInTrack({ id: 'burn' })]);
        const requestBurnInSubtitle = jest.fn().mockResolvedValue(false);
        const notifyToast = jest.fn();

        const coordinator = new PlaybackOptionsCoordinator({
            playbackOptionsModalId: 'playback-options',
            getNavigation: (): null => null,
            getPlaybackOptionsModal: (): null => null,
            getVideoPlayer: (): IVideoPlayer => player,
            getCurrentProgram: (): ScheduledProgram | null => makeProgram(),
            requestBurnInSubtitle,
            notifyToast,
        });

        const viewModel = getViewModel(coordinator);
        const burn = viewModel.subtitles.options.find((option) => option.id === 'playback-subtitle-burn');

        burn?.onSelect?.();
        await flushPromises();

        expect(notifyToast).toHaveBeenCalledWith('Loading burn-in subtitles…', 'info');
        expect(notifyToast).toHaveBeenCalledWith('Failed to load burn-in subtitles', 'warning');
    });

    it('shows a failure toast when burn-in subtitle request rejects', async () => {
        localStorage.setItem(RETUNE_STORAGE_KEYS.SUBTITLE_MODE, 'full');

        const player = createPlayer([makeBurnInTrack({ id: 'burn' })]);
        const requestBurnInSubtitle = jest.fn().mockRejectedValue(new Error('fail'));
        const notifyToast = jest.fn();

        const coordinator = new PlaybackOptionsCoordinator({
            playbackOptionsModalId: 'playback-options',
            getNavigation: (): null => null,
            getPlaybackOptionsModal: (): null => null,
            getVideoPlayer: (): IVideoPlayer => player,
            getCurrentProgram: (): ScheduledProgram | null => makeProgram(),
            requestBurnInSubtitle,
            notifyToast,
        });

        const viewModel = getViewModel(coordinator);
        const burn = viewModel.subtitles.options.find((option) => option.id === 'playback-subtitle-burn');

        burn?.onSelect?.();
        await flushPromises();

        expect(notifyToast).toHaveBeenCalledWith('Loading burn-in subtitles…', 'info');
        expect(notifyToast).toHaveBeenCalledWith('Failed to load burn-in subtitles', 'warning');
    });

    it('does not persist subtitle preference (no per-item or global storage)', async (): Promise<void> => {
        const player = createPlayer([
            makeTextTrack({ id: 'sub-99', fetchableViaKey: true, key: '/library/streams/99' }),
        ]);

        const coordinator = new PlaybackOptionsCoordinator({
            playbackOptionsModalId: 'playback-options',
            getNavigation: (): null => null,
            getPlaybackOptionsModal: (): null => null,
            getVideoPlayer: (): IVideoPlayer => player,
            getCurrentProgram: (): ScheduledProgram | null => makeProgram('item-99'),
        });

        const viewModel = getViewModel(coordinator);
        const option = viewModel.subtitles.options.find((o) => o.id === 'playback-subtitle-sub-99');
        option?.onSelect();

        await flushPromises();

        const storedItem = localStorage.getItem(`${RETUNE_STORAGE_KEYS.SUBTITLE_PREFERENCE_BY_ITEM_PREFIX}item-99`);
        const storedGlobal = localStorage.getItem(RETUNE_STORAGE_KEYS.SUBTITLE_PREFERENCE_GLOBAL);
        expect(storedItem).toBeNull();
        expect(storedGlobal).toBeNull();
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
            getCurrentProgram: (): ScheduledProgram | null => makeProgram(),
        });

        const viewModel = getViewModel(coordinator);
        const subtitleOption = viewModel.subtitles.options.find((option) => option.id === 'playback-subtitle-sub-1');
        subtitleOption?.onSelect?.();
        const audioOption = viewModel.audio.options.find((option) => option.id === 'playback-audio-audio-1');
        audioOption?.onSelect?.();

        expect(navigation.closeModal).toHaveBeenCalledWith('playback-options');
    });
});
