/**
 * @jest-environment jsdom
 */

import { DEFAULT_BUILD_RESULT, DEFAULT_PREVIEW, createWorkflowPort, makeLibrary } from './channel-setup-test-helpers';
import { ChannelSetupSessionRuntime } from '../ChannelSetupSessionRuntime';
import { ChannelSetupSessionState } from '../ChannelSetupSessionState';
import { CHANNEL_SETUP_PREVIEW_DEBOUNCE_MS } from '../constants';
import { flushPromises } from '../../../../__tests__/helpers';
import type { ChannelBuildSummary } from '../../../../core/channel-setup/types';

const createUnavailableError = (): Error => {
    const error = new Error('Channel setup not initialized');
    error.name = 'ChannelSetupWorkflowUnavailableError';
    return error;
};

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

const createRuntime = (
    overrides: {
        workflowPort?: ReturnType<typeof createWorkflowPort>;
        getSelectedServerId?: () => string | null;
    } = {}
): {
    runtime: ChannelSetupSessionRuntime;
    state: ChannelSetupSessionState;
    workflowPort: ReturnType<typeof createWorkflowPort>;
} => {
    const state = new ChannelSetupSessionState();
    const workflowPort = overrides.workflowPort ?? createWorkflowPort();
    const runtime = new ChannelSetupSessionRuntime({
        workflowPort,
        getSelectedServerId: overrides.getSelectedServerId ?? (() : string => 'server-1'),
        state,
    });
    return { runtime, state, workflowPort };
};

describe('ChannelSetupSessionRuntime', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it('beginSession increments the session token, resets stale state, and invalidates facet snapshots', () => {
        const { runtime, state, workflowPort } = createRuntime();
        state.step = 3;
        state.previewError = 'stale';
        state.previewStatus = 'error';
        state.reviewError = 'review failed';
        state.replaceConfirm = true;
        state.recordApplied = true;

        runtime.beginSession();

        expect(state.sessionToken).toBe(1);
        expect(state.step).toBe(1);
        expect(state.previewError).toBeNull();
        expect(state.previewStatus).toBe('idle');
        expect(state.reviewError).toBeNull();
        expect(state.replaceConfirm).toBe(false);
        expect(state.recordApplied).toBe(false);
        expect(workflowPort.invalidateSessionData).toHaveBeenCalledTimes(1);
        expect(workflowPort.invalidateFacetSnapshot).not.toHaveBeenCalled();
    });

    it('endSession aborts in-flight load/build work and clears loading flags', async () => {
        let loadSignal: AbortSignal | null | undefined;
        let buildSignal: AbortSignal | undefined;
        const loadDeferred = createDeferred<ReturnType<typeof makeLibrary>[]>();
        const buildDeferred = createDeferred<typeof DEFAULT_BUILD_RESULT>();
        const workflowPort = createWorkflowPort({
            getLibrariesForSetup: jest.fn((signal?: AbortSignal | null) => {
                loadSignal = signal;
                return loadDeferred.promise;
            }),
            createChannelsFromSetup: jest.fn((_config, options) => {
                buildSignal = options?.signal;
                return buildDeferred.promise;
            }),
        });
        const { runtime, state } = createRuntime({ workflowPort });

        runtime.beginSession();
        const loadPromise = runtime.loadLibraries();
        const buildPromise = runtime.beginBuild({
            onProgress: jest.fn(),
            onStateChange: jest.fn(),
        });

        expect(state.isLoading).toBe(true);
        expect(state.isBuilding).toBe(true);

        runtime.endSession();

        expect(loadSignal?.aborted ?? false).toBe(true);
        expect(buildSignal?.aborted ?? false).toBe(true);
        expect(state.isLoading).toBe(false);
        expect(state.isBuilding).toBe(false);

        loadDeferred.resolve([makeLibrary({ id: 'movies' })]);
        buildDeferred.resolve(DEFAULT_BUILD_RESULT);

        await expect(loadPromise).resolves.toBeUndefined();
        await expect(buildPromise).resolves.toEqual({ kind: 'canceled' });
        expect(workflowPort.markSetupComplete).not.toHaveBeenCalled();
    });

    it('syncSetupContext keeps recognized contexts and falls back to unknown on unavailable errors', () => {
        const workflowPort = createWorkflowPort({
            getSetupContextForSelectedServer: jest
                .fn()
                .mockReturnValueOnce('first-time')
                .mockReturnValueOnce('existing')
                .mockReturnValueOnce('unexpected')
                .mockImplementationOnce(() => {
                    throw createUnavailableError();
                }),
        });
        const { runtime, state } = createRuntime({ workflowPort });

        runtime.syncSetupContext();
        expect(state.setupContext).toBe('first-time');

        runtime.syncSetupContext();
        expect(state.setupContext).toBe('existing');

        runtime.syncSetupContext();
        expect(state.setupContext).toBe('unknown');

        runtime.syncSetupContext();
        expect(state.setupContext).toBe('unknown');
    });

    it('syncSetupContext rethrows non-unavailable workflow errors', () => {
        const workflowPort = createWorkflowPort({
            getSetupContextForSelectedServer: jest.fn(() => {
                throw new Error('boom');
            }),
        });
        const { runtime } = createRuntime({ workflowPort });

        expect(() => runtime.syncSetupContext()).toThrow('boom');
    });

    it('treats unavailable workflow queries as UI-safe defaults at the runtime edge', async () => {
        const workflowPort = createWorkflowPort({
            invalidateSessionData: jest.fn(() => {
                throw createUnavailableError();
            }),
            invalidateFacetSnapshot: jest.fn(() => {
                throw createUnavailableError();
            }),
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getChannelSetupRecord: jest.fn(() => {
                throw createUnavailableError();
            }),
            getSetupContextForSelectedServer: jest.fn(() => {
                throw createUnavailableError();
            }),
        });
        const { runtime, state } = createRuntime({ workflowPort });

        expect(() => runtime.beginSession()).not.toThrow();

        await runtime.loadLibraries();
        runtime.syncSetupContext();

        expect(state.recordApplied).toBe(true);
        expect(state.selectedLibraryIds).toEqual(new Set(['movies']));
        expect(state.setupContext).toBe('unknown');
    });

    it('setStep and clearReviewAndReturnToStep2 clean preview/review async state at planning boundaries', () => {
        const { runtime, state } = createRuntime();
        state.recordApplied = true;
        state.step = 2;
        state.isPreviewLoading = true;
        state.previewStatus = 'loading';
        state.pendingPreviewKey = 'pending-preview-key';
        state.isReviewLoading = true;
        state.review = {
            preview: DEFAULT_PREVIEW,
            diff: {
                summary: { created: 1, removed: 0, unchanged: 0 },
                samples: { created: ['News'], removed: [], unchanged: [] },
            },
        };
        state.replaceConfirm = true;

        runtime.clearReviewAndReturnToStep2();
        runtime.setStep(1);

        expect(state.step).toBe(1);
        expect(state.review).toBeNull();
        expect(state.reviewError).toBeNull();
        expect(state.replaceConfirm).toBe(false);
        expect(state.isReviewLoading).toBe(false);
        expect(state.previewStatus).toBe('idle');
        expect(state.pendingPreviewKey).toBeNull();
    });

    it('schedulePreview owns the debounce timer and marks slow previews with cleanup when the timeout expires', async () => {
        let previewSignal: AbortSignal | undefined;
        const previewDeferred = createDeferred<typeof DEFAULT_PREVIEW>();
        const onStateChange = jest.fn();
        const workflowPort = createWorkflowPort({
            getSetupPreview: jest.fn((_config, options) => {
                previewSignal = options?.signal;
                return previewDeferred.promise;
            }),
        });
        const { runtime, state } = createRuntime({ workflowPort });
        state.step = 2;

        runtime.schedulePreview(onStateChange);
        jest.advanceTimersByTime(CHANNEL_SETUP_PREVIEW_DEBOUNCE_MS);
        await Promise.resolve();

        expect(workflowPort.getSetupPreview).toHaveBeenCalledTimes(1);
        expect(state.isPreviewLoading).toBe(true);
        expect(state.previewStatus).toBe('loading');

        jest.advanceTimersByTime(15_000);

        expect(previewSignal?.aborted ?? false).toBe(true);
        expect(state.isPreviewLoading).toBe(false);
        expect(state.previewStatus).toBe('slow');
        expect(state.previewError).toContain('taking too long');

        previewDeferred.resolve(DEFAULT_PREVIEW);
        await Promise.resolve();
    });

    it('cancelBuild only aborts when a build is active', async () => {
        let buildSignal: AbortSignal | undefined;
        const buildDeferred = createDeferred<typeof DEFAULT_BUILD_RESULT>();
        const workflowPort = createWorkflowPort({
            createChannelsFromSetup: jest.fn((_config, options) => {
                buildSignal = options?.signal;
                return buildDeferred.promise;
            }),
        });
        const { runtime } = createRuntime({ workflowPort });

        expect(runtime.cancelBuild()).toBe(false);

        const buildPromise = runtime.beginBuild({
            onProgress: jest.fn(),
            onStateChange: jest.fn(),
        });

        expect(runtime.cancelBuild()).toBe(true);
        expect(buildSignal?.aborted ?? false).toBe(true);

        buildDeferred.reject(new DOMException('Aborted', 'AbortError'));
        await expect(buildPromise).resolves.toEqual({ kind: 'canceled' });
    });

    it('converts runtime failures to string-only UI error fields and outcomes', async () => {
        const workflowPort = createWorkflowPort({
            getLibrariesForSetup: jest.fn().mockRejectedValue('load primitive'),
            getSetupPreview: jest.fn().mockRejectedValue('preview primitive'),
            getSetupReview: jest.fn().mockRejectedValue('review primitive'),
            createChannelsFromSetup: jest.fn().mockRejectedValue('build primitive'),
            markSetupComplete: jest.fn(() => {
                throw 'bookkeeping primitive';
            }),
        });
        const { runtime, state } = createRuntime({ workflowPort });

        await runtime.loadLibraries();
        expect(state.loadError).toBe('Unable to load libraries.');

        state.step = 2;
        runtime.schedulePreview(jest.fn());
        jest.advanceTimersByTime(CHANNEL_SETUP_PREVIEW_DEBOUNCE_MS);
        await flushPromises();
        expect(state.previewError).toBe('Unable to estimate channels.');

        await runtime.ensureReviewLoaded(jest.fn());
        expect(state.reviewError).toBe('Unable to load review.');

        await expect(runtime.beginBuild({
            onProgress: jest.fn(),
            onStateChange: jest.fn(),
        })).resolves.toEqual({
            kind: 'error',
            message: 'Build failed.',
        });

        workflowPort.createChannelsFromSetup = jest.fn().mockResolvedValue(DEFAULT_BUILD_RESULT);
        await expect(runtime.beginBuild({
            onProgress: jest.fn(),
            onStateChange: jest.fn(),
        })).resolves.toEqual(expect.objectContaining({
            kind: 'success',
            bookkeepingError: 'Unable to save setup completion.',
        }));
    });

    it.each(['append', 'merge'] as const)(
        'returns committed guide interruption and records %s completion exactly once',
        async (buildMode) => {
            const interruptedResult: ChannelBuildSummary = {
                ...DEFAULT_BUILD_RESULT,
                commitState: 'committed',
                guideRefresh: {
                    kind: 'interrupted',
                    interruption: { kind: 'aborted', stage: 'refresh_schedules' },
                },
            };
            const workflowPort = createWorkflowPort({
                createChannelsFromSetup: jest.fn().mockResolvedValue(interruptedResult),
            });
            const { runtime, state } = createRuntime({ workflowPort });
            runtime.beginSession();
            state.buildMode = buildMode;

            const outcome = await runtime.beginBuild({
                onProgress: jest.fn(),
                onStateChange: jest.fn(),
            });
            expect(outcome).toMatchObject({
                kind: 'committed-with-guide-interrupted',
                serverId: 'server-1',
                result: interruptedResult,
                config: { buildMode },
            });

            expect(workflowPort.createChannelsFromSetup).toHaveBeenCalledTimes(1);
            expect(workflowPort.markSetupComplete).toHaveBeenCalledTimes(1);
            expect(outcome).not.toHaveProperty('bookkeepingError');
        }
    );

    it('records a committed stale completion once but returns canceled without reviving ended session state', async () => {
        const buildDeferred = createDeferred<ChannelBuildSummary>();
        const workflowPort = createWorkflowPort({
            createChannelsFromSetup: jest.fn(() => buildDeferred.promise),
        });
        const { runtime, state } = createRuntime({ workflowPort });
        runtime.beginSession();
        const endedToken = state.sessionToken;
        const buildPromise = runtime.beginBuild({
            onProgress: jest.fn(),
            onStateChange: jest.fn(),
        });

        runtime.endSession();
        buildDeferred.resolve({
            ...DEFAULT_BUILD_RESULT,
            commitState: 'committed',
            guideRefresh: {
                kind: 'interrupted',
                interruption: { kind: 'aborted', stage: 'refresh_schedules' },
            },
        });

        await expect(buildPromise).resolves.toEqual({ kind: 'canceled' });
        expect(workflowPort.markSetupComplete).toHaveBeenCalledTimes(1);
        expect(state.sessionToken).toBe(endedToken + 1);
        expect(state.isBuilding).toBe(false);
    });

    it('records stale committed work without clearing or overwriting a newer active build', async () => {
        const firstBuildDeferred = createDeferred<ChannelBuildSummary>();
        const secondBuildDeferred = createDeferred<ChannelBuildSummary>();
        const workflowPort = createWorkflowPort({
            createChannelsFromSetup: jest.fn()
                .mockImplementationOnce(() => firstBuildDeferred.promise)
                .mockImplementationOnce(() => secondBuildDeferred.promise),
        });
        const { runtime, state } = createRuntime({ workflowPort });
        runtime.beginSession();
        const firstBuild = runtime.beginBuild({
            onProgress: jest.fn(),
            onStateChange: jest.fn(),
        });

        runtime.beginSession();
        const newerSessionToken = state.sessionToken;
        const secondBuild = runtime.beginBuild({
            onProgress: jest.fn(),
            onStateChange: jest.fn(),
        });
        firstBuildDeferred.resolve({
            ...DEFAULT_BUILD_RESULT,
            commitState: 'committed',
            guideRefresh: {
                kind: 'interrupted',
                interruption: { kind: 'aborted', stage: 'refresh_schedules' },
            },
        });

        await expect(firstBuild).resolves.toEqual({ kind: 'canceled' });
        expect(workflowPort.markSetupComplete).toHaveBeenCalledTimes(1);
        expect(state.sessionToken).toBe(newerSessionToken);
        expect(state.isBuilding).toBe(true);

        expect(runtime.cancelBuild()).toBe(true);
        secondBuildDeferred.reject(new DOMException('Aborted', 'AbortError'));
        await expect(secondBuild).resolves.toEqual({ kind: 'canceled' });
        expect(workflowPort.markSetupComplete).toHaveBeenCalledTimes(1);
    });

    it('keeps a committed interruption outcome when completion bookkeeping throws', async () => {
        const interruptedResult: ChannelBuildSummary = {
            ...DEFAULT_BUILD_RESULT,
            commitState: 'committed',
            guideRefresh: {
                kind: 'interrupted',
                interruption: { kind: 'aborted', stage: 'ensure_initialized' },
            },
        };
        const workflowPort = createWorkflowPort({
            createChannelsFromSetup: jest.fn().mockResolvedValue(interruptedResult),
            markSetupComplete: jest.fn(() => {
                throw new DOMException('Storage write interrupted', 'AbortError');
            }),
        });
        const { runtime } = createRuntime({ workflowPort });
        runtime.beginSession();

        await expect(runtime.beginBuild({
            onProgress: jest.fn(),
            onStateChange: jest.fn(),
        })).resolves.toMatchObject({
            kind: 'committed-with-guide-interrupted',
            result: interruptedResult,
            bookkeepingError: 'Storage write interrupted',
        });
        expect(workflowPort.markSetupComplete).toHaveBeenCalledTimes(1);
    });
});
