import { OrchestratorEventBinder } from '../events/OrchestratorEventBinder';
import type { OrchestratorEventBinderDeps } from '../events/OrchestratorEventBinder';
import type { ScheduledProgram } from '../../../modules/scheduler/scheduler';

function createProgram(): ScheduledProgram {
    return {
        item: {
            ratingKey: 'item-1',
            title: 'Test Item',
            fullTitle: 'Test Item',
            durationMs: 60_000,
            type: 'movie',
            thumb: null,
            year: 2024,
            scheduledIndex: 0,
        },
        scheduledStartTime: 0,
        scheduledEndTime: 60_000,
        elapsedMs: 0,
        remainingMs: 60_000,
        scheduleIndex: 0,
        loopNumber: 0,
        isCurrent: true,
    };
}

function createBinder(
    overrides: Partial<OrchestratorEventBinderDeps> = {}
): {
    binder: OrchestratorEventBinder;
    deps: OrchestratorEventBinderDeps;
    schedulerHandlers: {
        programStart?: (program: ScheduledProgram) => void;
        scheduleSync?: () => void;
    };
} {
    const schedulerHandlers: {
        programStart?: (program: ScheduledProgram) => void;
        scheduleSync?: () => void;
    } = {};

    const scheduler = {
        on: jest.fn((event: 'programStart' | 'scheduleSync', handler: unknown) => {
            if (event === 'programStart') {
                schedulerHandlers.programStart = handler as (program: ScheduledProgram) => void;
                return;
            }
            schedulerHandlers.scheduleSync = handler as () => void;
        }),
        off: jest.fn(),
    };

    const deps: OrchestratorEventBinderDeps = {
        cleanupReporter: jest.fn(),
        getScheduler: () => scheduler as never,
        getVideoPlayer: () => null,
        getPlexLibrary: () => null,
        getPlexStreamResolver: () => null,
        getNavigation: () => null,
        getLifecycle: () => null,
        getChannelManager: () => null,
        wireNavigationCoordinatorEvents: () => [],
        wireEpgCoordinatorEvents: () => [],
        handleProgramStartTracked: jest.fn().mockResolvedValue(undefined),
        handleScheduleDayRollover: jest.fn().mockResolvedValue(undefined),
        handlePlayerEnded: jest.fn(),
        handlePlayerTrackChange: jest.fn(),
        handlePlaybackError: jest.fn(),
        handlePlayerStateChange: jest.fn(),
        handlePlayerTimeUpdate: jest.fn(),
        handlePlayerBufferUpdate: jest.fn(),
        handlePlexLibraryAuthExpired: jest.fn(),
        handlePlexStreamError: jest.fn(),
        handleScreenChange: jest.fn(),
        handleLifecyclePause: jest.fn().mockResolvedValue(undefined),
        handleLifecycleResume: jest.fn().mockResolvedValue(undefined),
        reportPersistenceWarning: jest.fn(),
        reportRecoverableAsyncFailure: jest.fn(),
        ...overrides,
    };

    return {
        binder: new OrchestratorEventBinder(deps),
        deps,
        schedulerHandlers,
    };
}

describe('OrchestratorEventBinder', () => {
    it('reports whether a bind established wiring', () => {
        const { binder } = createBinder();

        expect(binder.bind()).toBe(true);
        expect(binder.bind()).toBe(false);
    });

    it('reports synchronous program-start failures through recoverable diagnostics instead of throwing', () => {
        const failure = new Error('sync boom');
        const { binder, deps, schedulerHandlers } = createBinder({
            handleProgramStartTracked: jest.fn(() => {
                throw failure;
            }),
        });

        binder.bind();

        expect(() => {
            schedulerHandlers.programStart?.(createProgram());
        }).not.toThrow();

        expect(deps.reportRecoverableAsyncFailure).toHaveBeenCalledWith(
            'orchestratorEventBinder.programStart',
            'Unhandled program-start failure',
            failure
        );
    });
});
