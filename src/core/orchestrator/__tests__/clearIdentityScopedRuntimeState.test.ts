import { clearIdentityScopedRuntimeState } from '../runtime/clearIdentityScopedRuntimeState';
import type { IdentityScopedRuntimeStateResetDeps } from '../runtime/clearIdentityScopedRuntimeState';

const createDeps = (): jest.Mocked<IdentityScopedRuntimeStateResetDeps> => ({
    stopPlayback: jest.fn(),
    unloadCurrentChannel: jest.fn(),
    clearPlaybackState: jest.fn(),
    clearChannelManagerRuntimeState: jest.fn(),
    clearEpgScheduleState: jest.fn(),
});

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

    it('preserves playback while clearing identity-scoped runtime state for profile changes', () => {
        const deps = createDeps();

        clearIdentityScopedRuntimeState(deps, { resetPlayback: false });

        expect(deps.stopPlayback).not.toHaveBeenCalled();
        expect(deps.unloadCurrentChannel).not.toHaveBeenCalled();
        expect(deps.clearPlaybackState).not.toHaveBeenCalled();
        expect(deps.clearChannelManagerRuntimeState).toHaveBeenCalledTimes(1);
        expect(deps.clearEpgScheduleState).toHaveBeenCalledTimes(1);
    });
});
