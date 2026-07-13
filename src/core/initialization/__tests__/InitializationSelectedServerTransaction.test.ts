import {
    PlexAuthOperationSupersededError,
    type PlexAuthValidationGuard,
} from '../../../modules/plex/auth';
import { AppErrorCode } from '../../../types/app-errors';
import { ChannelInitialTuneAuthority } from '../../channel-tuning/ChannelInitialTuneAuthority';
import {
    InitializationSelectedServerTransaction,
    type InitializationSelectedServerTransactionDeps,
    type SelectedServerInitializationRequest,
} from '../InitializationSelectedServerTransaction';

const READY_REFRESH = {
    readiness: 'ready' as const,
    attemptedChannelCount: 1,
    immediateReadyChannelCount: 1,
    backgroundQueuedChannelCount: 0,
    failedChannelCount: 0,
    staleCacheChannelCount: 0,
    firstVisibleScheduleReady: true,
};

interface TransactionHarness {
    deps: jest.Mocked<InitializationSelectedServerTransactionDeps>;
    request: SelectedServerInitializationRequest;
    transactionController: AbortController;
    validateStoredCredentials: jest.Mock;
    channelManager: { getCurrentChannel: jest.Mock; getAllChannels: jest.Mock };
}

function createHarness(): TransactionHarness {
    const authController = new AbortController();
    const guard: PlexAuthValidationGuard = {
        signal: authController.signal,
        assertCurrent: (): void => {
            if (authController.signal.aborted) throw authController.signal.reason;
        },
    };
    const validateStoredCredentials = jest.fn().mockResolvedValue({ kind: 'active_valid', guard });
    const navigation = { replaceScreen: jest.fn() };
    const channelManager = {
        getCurrentChannel: jest.fn(() => null),
        getAllChannels: jest.fn(() => []),
    };
    const deps: jest.Mocked<InitializationSelectedServerTransactionDeps> = {
        getPlexAuth: jest.fn(() => ({ validateStoredCredentials })),
        isSelectedServerConnected: jest.fn(() => true),
        initializePlaybackRuntime: jest.fn().mockResolvedValue(undefined),
        ensureCorePlayerUiInitialized: jest.fn().mockResolvedValue(undefined),
        initializeEpg: jest.fn().mockResolvedValue(undefined),
        getNavigation: jest.fn(() => navigation),
        getChannelManager: jest.fn(() => channelManager),
        shouldRunAudioSetup: jest.fn(() => false),
        shouldRunChannelSetup: jest.fn(() => true),
        openServerSelect: jest.fn(),
        publishCommitStart: jest.fn(),
        setupEventWiring: jest.fn(() => true),
        disposeEventWiring: jest.fn(),
        setReady: jest.fn(),
        publishLifecycleReady: jest.fn(),
        clearResumeHandlers: jest.fn(),
    };
    const transactionController = new AbortController();
    const tuneAuthority = new ChannelInitialTuneAuthority();
    const lineage = tuneAuthority.beginLineage([]);
    const request: SelectedServerInitializationRequest = {
        lineage,
        signal: transactionController.signal,
        assertCurrent: (): void => {
            if (transactionController.signal.aborted) throw transactionController.signal.reason;
        },
        beforeCommit: jest.fn().mockResolvedValue(READY_REFRESH),
        initialTune: jest.fn().mockResolvedValue({ kind: 'switched' }),
    };
    return { deps, request, transactionController, validateStoredCredentials, channelManager };
}

describe('InitializationSelectedServerTransaction', () => {
    it('maps ready EPG refresh and publishes commit only after preparation', async () => {
        const { deps, request } = createHarness();
        const transaction = new InitializationSelectedServerTransaction(deps);

        const result = await transaction.run(request);

        expect(result).toEqual({
            kind: 'completed',
            payload: { epgRefresh: { kind: 'succeeded', result: READY_REFRESH } },
        });
        expect(request.beforeCommit).toHaveBeenCalledTimes(1);
        expect(deps.publishCommitStart).toHaveBeenCalledTimes(1);
        expect(deps.setupEventWiring).toHaveBeenCalledTimes(1);
        expect(deps.setReady).toHaveBeenNthCalledWith(1, false);
        expect(deps.setReady).toHaveBeenNthCalledWith(2, true);
        expect(deps.publishLifecycleReady).toHaveBeenCalledTimes(1);
    });

    it.each(['skipped', 'partial', 'failed'] as const)(
        'maps %s EPG readiness to an exact degraded payload',
        async (readiness) => {
            const { deps, request } = createHarness();
            const resultValue = { ...READY_REFRESH, readiness };
            (request.beforeCommit as jest.Mock).mockResolvedValue(resultValue);

            const result = await new InitializationSelectedServerTransaction(deps).run(request);

            expect(result).toEqual({
                kind: 'completed',
                payload: { epgRefresh: { kind: 'degraded', result: resultValue } },
            });
        }
    );

    it('captures a thrown EPG refresh as a recoverable failed payload and still commits', async () => {
        const { deps, request } = createHarness();
        const error = new Error('refresh failed');
        (request.beforeCommit as jest.Mock).mockRejectedValue(error);

        const result = await new InitializationSelectedServerTransaction(deps).run(request);

        expect(result).toEqual({ kind: 'completed', payload: { epgRefresh: { kind: 'failed', error } } });
        expect(deps.setupEventWiring).toHaveBeenCalledTimes(1);
    });

    it('commits a same-scope local EPG supersession as an exact payload', async () => {
        const { deps, request } = createHarness();
        const result = { ...READY_REFRESH, readiness: 'superseded' as const };
        (request.beforeCommit as jest.Mock).mockResolvedValue(result);

        await expect(new InitializationSelectedServerTransaction(deps).run(request)).resolves.toEqual({
            kind: 'completed',
            payload: { epgRefresh: { kind: 'superseded', result } },
        });
        expect(deps.publishCommitStart).toHaveBeenCalledTimes(1);
        expect(deps.setupEventWiring).toHaveBeenCalledTimes(1);
        expect(deps.setReady).toHaveBeenLastCalledWith(true);
    });

    it('lets transaction invalidation override a prepared EPG payload', async () => {
        const { deps, request, transactionController } = createHarness();
        const reason = new DOMException('receipt superseded', 'AbortError');
        (request.beforeCommit as jest.Mock).mockImplementation(async () => {
            transactionController.abort(reason);
            return READY_REFRESH;
        });

        await expect(new InitializationSelectedServerTransaction(deps).run(request)).resolves.toEqual({
            kind: 'stopped',
            reason: 'superseded',
        });
        expect(deps.publishCommitStart).not.toHaveBeenCalled();
    });

    it('stops for unavailable auth or server without publishing', async () => {
        const authHarness = createHarness();
        authHarness.validateStoredCredentials.mockResolvedValue({
            kind: 'missing',
            guard: {
                signal: new AbortController().signal,
                assertCurrent: jest.fn(),
            },
        });
        const authResult = await new InitializationSelectedServerTransaction(authHarness.deps)
            .run(authHarness.request);
        expect(authResult).toEqual({ kind: 'stopped', reason: 'auth_required' });

        const serverHarness = createHarness();
        serverHarness.deps.isSelectedServerConnected.mockReturnValue(false);
        const serverResult = await new InitializationSelectedServerTransaction(serverHarness.deps)
            .run(serverHarness.request);
        expect(serverResult).toEqual({ kind: 'stopped', reason: 'server_unavailable' });
        expect(serverHarness.deps.publishCommitStart).not.toHaveBeenCalled();
    });

    it('uses the supplied lineage for the one initial tune during commit routing', async () => {
        const { deps, request, channelManager } = createHarness();
        deps.shouldRunChannelSetup.mockReturnValue(false);
        (channelManager.getCurrentChannel as jest.Mock).mockReturnValue({ id: 'channel-1' });

        await new InitializationSelectedServerTransaction(deps).run(request);

        expect(request.initialTune).toHaveBeenCalledWith('channel-1', request.lineage);
    });

    it('disposes wiring newly established by the transaction when routing fails', async () => {
        const { deps, request } = createHarness();
        const error = new Error('routing failed');
        deps.shouldRunChannelSetup.mockImplementation(() => { throw error; });

        await expect(new InitializationSelectedServerTransaction(deps).run(request))
            .resolves.toEqual({ kind: 'failed', error });

        expect(deps.setupEventWiring).toHaveReturnedWith(true);
        expect(deps.disposeEventWiring).toHaveBeenCalledTimes(1);
        expect(deps.setReady).not.toHaveBeenCalledWith(true);
    });

    it('preserves pre-existing wiring when routing fails', async () => {
        const { deps, request } = createHarness();
        const error = new Error('routing failed');
        deps.setupEventWiring.mockReturnValue(false);
        deps.shouldRunChannelSetup.mockImplementation(() => { throw error; });

        await expect(new InitializationSelectedServerTransaction(deps).run(request))
            .resolves.toEqual({ kind: 'failed', error });

        expect(deps.disposeEventWiring).not.toHaveBeenCalled();
    });

    it('disposes newly established wiring when the transaction becomes stale during binding', async () => {
        const { deps, request, transactionController } = createHarness();
        deps.setupEventWiring.mockImplementation(() => {
            transactionController.abort(new DOMException('superseded', 'AbortError'));
            return true;
        });

        await expect(new InitializationSelectedServerTransaction(deps).run(request))
            .resolves.toEqual({ kind: 'stopped', reason: 'superseded' });

        expect(deps.disposeEventWiring).toHaveBeenCalledTimes(1);
    });

    it('does not let event-wiring compensation failure mask routing failure', async () => {
        const { deps, request } = createHarness();
        const error = new Error('routing failed');
        deps.shouldRunChannelSetup.mockImplementation(() => { throw error; });
        deps.disposeEventWiring.mockImplementation(() => { throw new Error('cleanup failed'); });

        await expect(new InitializationSelectedServerTransaction(deps).run(request))
            .resolves.toEqual({ kind: 'failed', error });

        expect(deps.disposeEventWiring).toHaveBeenCalledTimes(1);
    });

    it.each([
        [
            new PlexAuthOperationSupersededError(),
            { kind: 'stopped', reason: 'superseded' },
        ],
        [
            { code: AppErrorCode.AUTH_EXPIRED },
            { kind: 'stopped', reason: 'auth_required' },
        ],
    ] as const)('classifies an outer-catch failure without invalidating the request', async (error, expected) => {
        const { deps, request, validateStoredCredentials } = createHarness();
        validateStoredCredentials.mockRejectedValue(error);

        await expect(new InitializationSelectedServerTransaction(deps).run(request))
            .resolves.toEqual(expected);
    });

    it('returns an unrelated outer-catch failure unchanged', async () => {
        const { deps, request, validateStoredCredentials } = createHarness();
        const error = new Error('unexpected selected-server initialization failure');
        validateStoredCredentials.mockRejectedValue(error);

        await expect(new InitializationSelectedServerTransaction(deps).run(request))
            .resolves.toEqual({ kind: 'failed', error });
    });
});
