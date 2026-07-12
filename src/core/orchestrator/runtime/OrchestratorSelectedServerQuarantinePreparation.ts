import type { IAppLifecycle } from '../../../modules/lifecycle';
import type { INavigationManager } from '../../../modules/navigation';
import type { IChannelManager } from '../../../modules/scheduler/channel-manager';
import type { IChannelScheduler } from '../../../modules/scheduler/scheduler';
import type { IEPGComponent } from '../../../modules/ui/epg';
import type { EPGCoordinator } from '../../../modules/ui/epg/coordinator/EPGCoordinator';
import type { InitializationCoordinator } from '../../initialization/InitializationCoordinator';

export interface OrchestratorSelectedServerQuarantinePreparationDeps {
    navigation: Pick<INavigationManager, 'activateRuntimeCommandGate' | 'cancelPendingChannelInput'> | null;
    lifecycle: Pick<IAppLifecycle, 'setPhase'> | null;
    channelManager: Pick<IChannelManager, 'clearRuntimeStateForScopeTransition'> | null;
    scheduler: Pick<IChannelScheduler, 'unloadChannel'> | null;
    epgCoordinator: Pick<EPGCoordinator, 'clearSelectedChannelScheduleSnapshot' | 'clearScheduleCaches'> | null;
    epg: Pick<IEPGComponent, 'clearSchedules'> | null;
    initializationCoordinator: Pick<InitializationCoordinator, 'prepareForSelectedServerQuarantine'> | null;
    setReadyFalse(): void;
    suspendAndDrainTuning(): Promise<void>;
    stopPlayback(): void;
    clearPlaybackState(): void;
    disposeEventWiring(): void;
}

export async function prepareSelectedServerQuarantine(
    deps: OrchestratorSelectedServerQuarantinePreparationDeps
): Promise<void> {
    const failures: unknown[] = [];
    const run = (step: () => void): void => { try { step(); } catch (error: unknown) { failures.push(error); } };
    const start = (step: () => Promise<void>): Promise<void> => {
        try { return step(); } catch (error: unknown) { return Promise.reject(error); }
    };
    run(() => deps.navigation?.activateRuntimeCommandGate());
    run(() => deps.navigation?.cancelPendingChannelInput());
    run(deps.setReadyFalse);
    run(() => deps.lifecycle?.setPhase('loading_data'));
    const drains = [
        start(deps.suspendAndDrainTuning),
        start(() => deps.channelManager?.clearRuntimeStateForScopeTransition() ?? Promise.resolve()),
        start(() => deps.initializationCoordinator?.prepareForSelectedServerQuarantine() ?? Promise.resolve()),
    ];
    run(deps.stopPlayback);
    run(() => deps.scheduler?.unloadChannel());
    run(deps.clearPlaybackState);
    run(deps.disposeEventWiring);
    for (const result of await Promise.allSettled(drains)) {
        if (result.status === 'rejected') failures.push(result.reason);
    }
    run(() => deps.epgCoordinator?.clearSelectedChannelScheduleSnapshot());
    run(() => deps.epgCoordinator?.clearScheduleCaches());
    run(() => deps.epg?.clearSchedules());
    if (failures.length > 0) {
        throw Object.assign(new Error('Selected-server quarantine preparation failed.'), { failures });
    }
}
