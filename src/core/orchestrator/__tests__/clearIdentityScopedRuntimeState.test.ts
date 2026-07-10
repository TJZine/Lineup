import { clearIdentityScopedRuntimeState } from '../runtime/clearIdentityScopedRuntimeState';
import type {
    IdentityScopedRuntimeCleanupStep,
    IdentityScopedRuntimeStateResetDeps,
} from '../runtime/clearIdentityScopedRuntimeState';

const createDeps = (): jest.Mocked<IdentityScopedRuntimeStateResetDeps> => ({
    stopPlayback: jest.fn(),
    unloadCurrentChannel: jest.fn(),
    clearPlaybackState: jest.fn(),
    clearChannelManagerRuntimeState: jest.fn(),
    clearEpgScheduleState: jest.fn(),
    reportFailure: jest.fn(),
});

const cleanupSteps: readonly IdentityScopedRuntimeCleanupStep[] = [
    'stopPlayback',
    'unloadCurrentChannel',
    'clearPlaybackState',
    'clearChannelManagerRuntimeState',
    'clearEpgScheduleState',
];

describe('clearIdentityScopedRuntimeState', () => {
    it('clears playback and identity-scoped runtime state when playback reset is requested', () => {
        const deps = createDeps();

        clearIdentityScopedRuntimeState(deps, { resetPlayback: true });

        expect(deps.stopPlayback).toHaveBeenCalledTimes(1);
        expect(deps.unloadCurrentChannel).toHaveBeenCalledTimes(1);
        expect(deps.clearPlaybackState).toHaveBeenCalledTimes(1);
        expect(deps.clearChannelManagerRuntimeState).toHaveBeenCalledTimes(1);
        expect(deps.clearEpgScheduleState).toHaveBeenCalledTimes(1);
    });

    it('preserves active playback operations while clearing playback identity state for profile changes', () => {
        const deps = createDeps();

        clearIdentityScopedRuntimeState(deps, { resetPlayback: false });

        expect(deps.stopPlayback).not.toHaveBeenCalled();
        expect(deps.unloadCurrentChannel).not.toHaveBeenCalled();
        expect(deps.clearPlaybackState).toHaveBeenCalledTimes(1);
        expect(deps.clearChannelManagerRuntimeState).toHaveBeenCalledTimes(1);
        expect(deps.clearEpgScheduleState).toHaveBeenCalledTimes(1);
    });

    it.each(cleanupSteps)('reports %s failure and continues through later cleanup steps', (failingStep) => {
        const calls: IdentityScopedRuntimeCleanupStep[] = [];
        const failure = new Error(`${failingStep} failed`);
        const deps = createDeps();
        for (const step of cleanupSteps) {
            deps[step].mockImplementation(() => {
                calls.push(step);
                if (step === failingStep) {
                    throw failure;
                }
            });
        }

        expect(() => clearIdentityScopedRuntimeState(deps, { resetPlayback: true })).not.toThrow();

        expect(calls).toEqual(cleanupSteps);
        expect(deps.reportFailure).toHaveBeenCalledWith(
            `orchestrator.identityScopedRuntimeState.${failingStep}`,
            `Identity-scoped runtime cleanup step failed: ${failingStep}`,
            failure,
            { step: failingStep }
        );
    });

    it('continues cleanup when failure reporting throws', () => {
        const deps = createDeps();
        deps.stopPlayback.mockImplementation(() => {
            throw new Error('stop failed');
        });
        deps.reportFailure.mockImplementation(() => {
            throw new Error('report failed');
        });

        expect(() => clearIdentityScopedRuntimeState(deps, { resetPlayback: true })).not.toThrow();

        expect(deps.clearEpgScheduleState).toHaveBeenCalledTimes(1);
    });
});
