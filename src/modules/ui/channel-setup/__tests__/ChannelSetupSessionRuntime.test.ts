/**
 * @jest-environment jsdom
 */

import { DEFAULT_BUILD_RESULT, DEFAULT_PREVIEW, createWorkflowPort, makeLibrary } from './channel-setup-test-helpers';
import { ChannelSetupSessionRuntime } from '../ChannelSetupSessionRuntime';
import { ChannelSetupSessionState } from '../ChannelSetupSessionState';
import { CHANNEL_SETUP_PREVIEW_DEBOUNCE_MS } from '../constants';
import { ChannelSetupWorkflowUnavailableError } from '../../../../core/channel-setup/ChannelSetupWorkflowPort';

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
        expect(workflowPort.invalidateFacetSnapshot).toHaveBeenCalledTimes(1);
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
    });

    it('syncSetupContext keeps recognized contexts and falls back to unknown on unavailable errors', () => {
        const workflowPort = createWorkflowPort({
            getSetupContextForSelectedServer: jest
                .fn()
                .mockReturnValueOnce('first-time')
                .mockReturnValueOnce('existing')
                .mockReturnValueOnce('unexpected')
                .mockImplementationOnce(() => {
                    throw new ChannelSetupWorkflowUnavailableError();
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
            invalidateFacetSnapshot: jest.fn(() => {
                throw new ChannelSetupWorkflowUnavailableError();
            }),
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getChannelSetupRecord: jest.fn(() => {
                throw new ChannelSetupWorkflowUnavailableError();
            }),
            getSetupContextForSelectedServer: jest.fn(() => {
                throw new ChannelSetupWorkflowUnavailableError();
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
});
