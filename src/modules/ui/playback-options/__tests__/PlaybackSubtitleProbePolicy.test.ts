import type { FetchWithTimeoutArgs } from '../../../plex/shared/fetchWithTimeout';
import type {
    StreamDescriptor,
    SubtitleExtractabilityProbeResult,
    SubtitleTrack,
} from '../../../player/types';
import {
    PlaybackSubtitleProbePolicy,
    SUBTITLE_PROBE_TOTAL_TIMEOUT_MS,
} from '../PlaybackSubtitleProbePolicy';

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
        fetchableViaKey: false,
        ...overrides,
    } as SubtitleTrack);

const makeContext = (
    overrides: Partial<NonNullable<StreamDescriptor['subtitleContext']>> = {}
): NonNullable<StreamDescriptor['subtitleContext']> => ({
    serverUri: 'http://server-a',
    authHeaders: { 'X-Plex-Token': 'secret-token' },
    itemKey: 'item-1',
    ...overrides,
});

const makeResponse = (status: number, ok = false): Response =>
    ({ ok, status } as Response);

const probe = (
    policy: PlaybackSubtitleProbePolicy,
    track: SubtitleTrack,
    context: NonNullable<StreamDescriptor['subtitleContext']> | null | undefined = makeContext(),
    fallbackItemKey: string | null = 'fallback-item'
): Promise<SubtitleExtractabilityProbeResult> =>
    policy.probeTextSubtitleExtractability({ track, context, fallbackItemKey });

describe('PlaybackSubtitleProbePolicy', () => {
    it('returns unknown without context or with an invalid probe URL', async () => {
        const fetchWithTimeout = jest.fn();
        const policy = new PlaybackSubtitleProbePolicy({ fetchWithTimeout });
        const track = makeTextTrack();

        await expect(probe(policy, track, null)).resolves.toBe('unknown');
        await expect(probe(policy, track, makeContext({ serverUri: 'not a url' }))).resolves.toBe('unknown');

        expect(fetchWithTimeout).not.toHaveBeenCalled();
    });

    it('scopes cached decisions by server, token hash, item, and track without storing raw tokens in cache keys', async () => {
        const fetchWithTimeout = jest.fn().mockResolvedValue(makeResponse(404));
        const policy = new PlaybackSubtitleProbePolicy({ fetchWithTimeout });
        const track = makeTextTrack({ id: 'sub-1' });
        const context = makeContext({
            serverUri: 'http://server-a',
            resolvedBaseUrl: 'https://10-0-0-1.plex.direct:32400',
            authHeaders: { 'X-Plex-Token': 'raw-token-a' },
            itemKey: 'item-1',
        });

        const cacheKey = policy.getProbeCacheKey(track.id, context, null);
        expect(cacheKey).toContain('https://10-0-0-1.plex.direct:32400');
        expect(cacheKey).toContain('item-1');
        expect(cacheKey).toContain('sub-1');
        expect(cacheKey).not.toContain('raw-token-a');

        await expect(probe(policy, track, context)).resolves.toBe('unsupported');
        await expect(probe(policy, track, context)).resolves.toBe('unsupported');
        await expect(probe(policy, track, makeContext({ resolvedBaseUrl: 'https://10-0-0-2.plex.direct:32400' }))).resolves.toBe('unsupported');
        await expect(probe(policy, track, makeContext({ authHeaders: { 'X-Plex-Token': 'raw-token-b' } }))).resolves.toBe('unsupported');
        await expect(probe(policy, track, makeContext({ itemKey: 'item-2' }))).resolves.toBe('unsupported');
        await expect(probe(policy, makeTextTrack({ id: 'sub-2' }), context)).resolves.toBe('unsupported');

        expect(fetchWithTimeout).toHaveBeenCalledTimes(5);
    });

    it('uses resolvedBaseUrl for probe requests when it is available', async () => {
        const fetchWithTimeout = jest.fn().mockResolvedValue(makeResponse(200, true));
        const policy = new PlaybackSubtitleProbePolicy({ fetchWithTimeout });

        await expect(
            probe(
                policy,
                makeTextTrack({ id: 'keyless', fetchableViaKey: false }),
                makeContext({
                    serverUri: 'http://server-a',
                    resolvedBaseUrl: 'https://10-0-0-1.plex.direct:32400',
                })
            )
        ).resolves.toBe('supported');

        const firstRequest = fetchWithTimeout.mock.calls[0]?.[0] as FetchWithTimeoutArgs | undefined;
        expect(firstRequest?.url).toBe(
            'https://10-0-0-1.plex.direct:32400/library/streams/keyless?X-Plex-Token=secret-token'
        );
    });

    it('caches HEAD success as supported', async () => {
        const fetchWithTimeout = jest.fn().mockResolvedValue(makeResponse(200, true));
        const policy = new PlaybackSubtitleProbePolicy({ fetchWithTimeout });
        const track = makeTextTrack();

        await expect(probe(policy, track)).resolves.toBe('supported');
        await expect(probe(policy, track)).resolves.toBe('supported');

        expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
        expect(fetchWithTimeout).toHaveBeenCalledWith(expect.objectContaining({
            init: expect.objectContaining({ method: 'HEAD' }),
            timeoutMs: SUBTITLE_PROBE_TOTAL_TIMEOUT_MS,
        }));
    });

    it('falls back from HEAD 405 to GET using the remaining total timeout with the 50ms floor', async () => {
        const dateNowSpy = jest.spyOn(Date, 'now')
            .mockReturnValueOnce(1_000)
            .mockReturnValueOnce(1_370);
        try {
            const fetchWithTimeout = jest.fn()
                .mockResolvedValueOnce(makeResponse(405))
                .mockResolvedValueOnce(makeResponse(200, true));
            const policy = new PlaybackSubtitleProbePolicy({ fetchWithTimeout });

            await expect(probe(policy, makeTextTrack())).resolves.toBe('supported');

            expect(fetchWithTimeout).toHaveBeenNthCalledWith(1, expect.objectContaining({
                init: expect.objectContaining({ method: 'HEAD' }),
                timeoutMs: 400,
            }));
            expect(fetchWithTimeout).toHaveBeenNthCalledWith(2, expect.objectContaining({
                init: expect.objectContaining({ method: 'GET' }),
                timeoutMs: 50,
            }));
        } finally {
            dateNowSpy.mockRestore();
        }
    });

    it('falls back from HEAD 501 to GET and caches fallback-exhausted 501 as unsupported', async () => {
        const fetchWithTimeout = jest.fn()
            .mockResolvedValueOnce(makeResponse(501))
            .mockResolvedValueOnce(makeResponse(501));
        const policy = new PlaybackSubtitleProbePolicy({ fetchWithTimeout });
        const track = makeTextTrack();

        await expect(probe(policy, track)).resolves.toBe('unsupported');
        await expect(probe(policy, track)).resolves.toBe('unsupported');

        expect(fetchWithTimeout).toHaveBeenCalledTimes(2);
        expect(fetchWithTimeout).toHaveBeenNthCalledWith(2, expect.objectContaining({
            init: expect.objectContaining({ method: 'GET' }),
        }));
    });

    it.each([400, 404])('caches unsupported HEAD status %i', async (status) => {
        const fetchWithTimeout = jest.fn().mockResolvedValue(makeResponse(status));
        const policy = new PlaybackSubtitleProbePolicy({ fetchWithTimeout });
        const track = makeTextTrack();

        await expect(probe(policy, track)).resolves.toBe('unsupported');
        await expect(probe(policy, track)).resolves.toBe('unsupported');

        expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
    });

    it.each([
        [401, 'auth_failure'],
        [403, 'auth_failure'],
        [408, 'transient_failure'],
        [429, 'transient_failure'],
        [503, 'transient_failure'],
    ] as const)('does not cache status %i decisions', async (status, decision) => {
        const fetchWithTimeout = jest.fn().mockResolvedValue(makeResponse(status));
        const policy = new PlaybackSubtitleProbePolicy({ fetchWithTimeout });
        const track = makeTextTrack();

        await expect(probe(policy, track)).resolves.toBe(decision);
        await expect(probe(policy, track)).resolves.toBe(decision);

        expect(fetchWithTimeout).toHaveBeenCalledTimes(2);
    });

    it('does not cache thrown probe failures', async () => {
        const fetchWithTimeout = jest.fn().mockRejectedValue(new Error('timeout'));
        const policy = new PlaybackSubtitleProbePolicy({ fetchWithTimeout });
        const track = makeTextTrack();

        await expect(probe(policy, track)).resolves.toBe('transient_failure');
        await expect(probe(policy, track)).resolves.toBe('transient_failure');

        expect(fetchWithTimeout).toHaveBeenCalledTimes(2);
    });

    it.each([
        'https://foreign.example/library/streams/foreign',
        'https://%/library/streams/foreign',
    ])('falls back to the selected server streams URL for unsafe absolute key %s', async (key) => {
        const fetchWithTimeout = jest.fn().mockResolvedValue(makeResponse(200, true));
        const policy = new PlaybackSubtitleProbePolicy({ fetchWithTimeout });
        const track = makeTextTrack({
            id: 'foreign',
            key,
            fetchableViaKey: true,
        });

        await expect(probe(policy, track, makeContext({
            resolvedBaseUrl: 'https://10-0-0-1.plex.direct:32400',
        }))).resolves.toBe('supported');

        const firstRequest = fetchWithTimeout.mock.calls[0]?.[0] as FetchWithTimeoutArgs | undefined;
        expect(firstRequest?.url).toBe('https://10-0-0-1.plex.direct:32400/library/streams/foreign?X-Plex-Token=secret-token');
    });

    it('clearCache drops cached decisions', async () => {
        const fetchWithTimeout = jest.fn().mockResolvedValue(makeResponse(404));
        const policy = new PlaybackSubtitleProbePolicy({ fetchWithTimeout });
        const track = makeTextTrack();

        await expect(probe(policy, track)).resolves.toBe('unsupported');
        policy.clearCache();
        await expect(probe(policy, track)).resolves.toBe('unsupported');

        expect(fetchWithTimeout).toHaveBeenCalledTimes(2);
    });
});
