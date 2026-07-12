import { AppErrorCode } from '../../../../types/app-errors';
import { PLEX_LIBRARY_CONSTANTS } from '../constants';
import { buildFetchRequestInit, classifyFetchResponse } from '../PlexLibraryFetchPolicy';

const logger = { warn: jest.fn(), error: jest.fn() };
const identity = (value: string): string => value;

describe('buildFetchRequestInit', () => {
    it('normalizes Headers objects while preserving caller-provided overrides', () => {
        const init = buildFetchRequestInit(
            'http://example.com/library/sections/1/all?X-Plex-Container-Start=50&X-Plex-Container-Size=25',
            {
                headers: new Headers([
                    ['Accept', 'text/plain'],
                    ['X-Test-Header', 'test-value'],
                ]),
                signal: new AbortController().signal,
            },
            {
                'X-Plex-Token': 'mock-token',
            }
        );

        expect(init.signal).toBeUndefined();

        const headers = new Headers(init.headers);
        expect(headers.get('accept')).toBe('text/plain');
        expect(headers.get('x-test-header')).toBe('test-value');
        expect(headers.get('x-plex-token')).toBe('mock-token');
        expect(headers.get('x-plex-container-start')).toBe('50');
        expect(headers.get('x-plex-container-size')).toBe('25');
    });

    it('normalizes tuple-form headers without dropping values', () => {
        const init = buildFetchRequestInit(
            'http://example.com/library/sections/1/all',
            {
                headers: [
                    ['X-Test-Header', 'tuple-value'],
                ],
            },
            {}
        );

        const headers = new Headers(init.headers);
        expect(headers.get('x-test-header')).toBe('tuple-value');
        expect(headers.get('accept')).toBe('application/json');
    });
});

describe('classifyFetchResponse', () => {
    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it('caps numeric and HTTP-date Retry-After delays at 30 seconds', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-07-12T12:00:00Z'));
        const signal = new AbortController().signal;

        await expect(classifyFetchResponse(
            new Response('', { status: 429, headers: { 'Retry-After': '3600' } }),
            'http://plex.local/library', logger, identity, signal
        )).resolves.toEqual({ kind: 'rateLimited', retryAfterMs: 30000 });
        await expect(classifyFetchResponse(
            new Response('', {
                status: 429,
                headers: { 'Retry-After': 'Sun, 12 Jul 2026 13:00:00 GMT' },
            }),
            'http://plex.local/library', logger, identity, signal
        )).resolves.toEqual({ kind: 'rateLimited', retryAfterMs: 30000 });
    });

    it('rejects oversized declared JSON before consuming it and cancels the body', async () => {
        const cancel = jest.fn();
        const response = new Response(new ReadableStream<Uint8Array>({ cancel }), {
            headers: {
                'content-length': String(PLEX_LIBRARY_CONSTANTS.MAX_RESPONSE_BODY_BYTES + 1),
            },
        });

        await expect(classifyFetchResponse(
            response,
            'http://plex.local/library',
            logger,
            identity,
            new AbortController().signal
        )).rejects.toMatchObject({ code: AppErrorCode.PARSE_ERROR });
        expect(cancel).toHaveBeenCalledTimes(1);
    });

    it('rejects oversized chunked JSON and cancels the body', async () => {
        const cancel = jest.fn();
        const stream = new ReadableStream<Uint8Array>({
            start(controller): void {
                controller.enqueue(new Uint8Array(PLEX_LIBRARY_CONSTANTS.MAX_RESPONSE_BODY_BYTES));
                controller.enqueue(new Uint8Array(1));
            },
            cancel,
        });

        await expect(classifyFetchResponse(
            new Response(stream),
            'http://plex.local/library',
            logger,
            identity,
            new AbortController().signal
        )).rejects.toMatchObject({ code: AppErrorCode.PARSE_ERROR });
        expect(cancel).toHaveBeenCalledTimes(1);
    });
});
