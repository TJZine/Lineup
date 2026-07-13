import {
    prepareSelectedServerQuarantine,
    type OrchestratorSelectedServerQuarantinePreparationDeps,
} from '../runtime/OrchestratorSelectedServerQuarantinePreparation';

describe('prepareSelectedServerQuarantine', () => {
    it('gates commands and cancels numeric input before awaiting cancellation-first cleanup', async () => {
        let releaseTuning!: () => void;
        let releaseResolution!: () => void;
        const tuningDrain = new Promise<void>((resolve) => { releaseTuning = resolve; });
        const resolutionDrain = new Promise<void>((resolve) => { releaseResolution = resolve; });
        const navigation = {
            activateRuntimeCommandGate: jest.fn(),
            cancelPendingChannelInput: jest.fn(),
        };
        const lifecycle = { setPhase: jest.fn() };
        const channelManager = { clearRuntimeStateForScopeTransition: jest.fn(() => resolutionDrain) };
        const scheduler = { unloadChannel: jest.fn() };
        const epgCoordinator = {
            clearSelectedChannelScheduleSnapshot: jest.fn(),
            clearScheduleCaches: jest.fn(),
        };
        const epg = { clearSchedules: jest.fn() };
        const initializationCoordinator = { prepareForSelectedServerQuarantine: jest.fn().mockResolvedValue(undefined) };
        const deps: OrchestratorSelectedServerQuarantinePreparationDeps = {
            navigation,
            lifecycle,
            channelManager,
            scheduler,
            epgCoordinator,
            epg,
            initializationCoordinator,
            setReadyFalse: jest.fn(),
            suspendAndDrainTuning: jest.fn(() => tuningDrain),
            stopPlayback: jest.fn(),
            clearPlaybackState: jest.fn(),
            disposeEventWiring: jest.fn(),
        };

        const preparation = prepareSelectedServerQuarantine(deps);

        expect(navigation.activateRuntimeCommandGate).toHaveBeenCalledTimes(1);
        expect(navigation.cancelPendingChannelInput).toHaveBeenCalledTimes(1);
        expect(deps.setReadyFalse).toHaveBeenCalledTimes(1);
        expect(lifecycle.setPhase).toHaveBeenCalledWith('loading_data');
        expect(channelManager.clearRuntimeStateForScopeTransition).toHaveBeenCalledTimes(1);
        expect(deps.stopPlayback).toHaveBeenCalledTimes(1);
        expect(scheduler.unloadChannel).toHaveBeenCalledTimes(1);
        expect(deps.clearPlaybackState).toHaveBeenCalledTimes(1);
        expect(deps.disposeEventWiring).toHaveBeenCalledTimes(1);
        expect(epgCoordinator.clearSelectedChannelScheduleSnapshot).not.toHaveBeenCalled();
        expect(epgCoordinator.clearScheduleCaches).not.toHaveBeenCalled();
        expect(epg.clearSchedules).not.toHaveBeenCalled();
        expect(initializationCoordinator.prepareForSelectedServerQuarantine).toHaveBeenCalledTimes(1);

        releaseTuning();
        releaseResolution();
        await preparation;
        expect(epgCoordinator.clearSelectedChannelScheduleSnapshot).toHaveBeenCalledTimes(1);
        expect(epgCoordinator.clearScheduleCaches).toHaveBeenCalledTimes(1);
        expect(epg.clearSchedules).toHaveBeenCalledTimes(1);
    });

    it('continues independent cleanup and both drains after an early cleanup failure', async () => {
        const scheduler = { unloadChannel: jest.fn() };
        const disposeEventWiring = jest.fn();
        const epg = { clearSchedules: jest.fn() };
        const tuningDrain = jest.fn().mockResolvedValue(undefined);
        const resolutionDrain = jest.fn().mockResolvedValue(undefined);
        const initializationDrain = jest.fn().mockResolvedValue(undefined);
        const deps: OrchestratorSelectedServerQuarantinePreparationDeps = {
            navigation: {
                activateRuntimeCommandGate: jest.fn(() => { throw new Error('gate failed'); }),
                cancelPendingChannelInput: jest.fn(),
            },
            lifecycle: { setPhase: jest.fn() },
            channelManager: { clearRuntimeStateForScopeTransition: resolutionDrain },
            scheduler,
            epgCoordinator: {
                clearSelectedChannelScheduleSnapshot: jest.fn(),
                clearScheduleCaches: jest.fn(),
            },
            epg,
            initializationCoordinator: { prepareForSelectedServerQuarantine: initializationDrain },
            setReadyFalse: jest.fn(), suspendAndDrainTuning: tuningDrain,
            stopPlayback: jest.fn(), clearPlaybackState: jest.fn(), disposeEventWiring,
        };

        await expect(prepareSelectedServerQuarantine(deps)).rejects.toThrow(
            'Selected-server quarantine preparation failed.'
        );
        expect(tuningDrain).toHaveBeenCalledTimes(1);
        expect(resolutionDrain).toHaveBeenCalledTimes(1);
        expect(initializationDrain).toHaveBeenCalledTimes(1);
        expect(scheduler.unloadChannel).toHaveBeenCalledTimes(1);
        expect(disposeEventWiring).toHaveBeenCalledTimes(1);
        expect(epg.clearSchedules).toHaveBeenCalledTimes(1);
    });
});
