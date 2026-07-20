import type { IAppLifecycle } from '../../../modules/lifecycle';
import type { INavigationManager } from '../../../modules/navigation';
import type { IChannelManager } from '../../../modules/scheduler/channel-manager';
import type { IChannelScheduler } from '../../../modules/scheduler/scheduler';
import type { IEPGComponent } from '../../../modules/ui/epg';
import type { EPGCoordinator } from '../../../modules/ui/epg/coordinator/EPGCoordinator';
import type { InitializationCoordinator } from '../../initialization/InitializationCoordinator';
import { SelectedServerQuarantinePreparationError } from '../../server-selection/SelectedServerRecoveryDiagnostics';

export interface OrchestratorSelectedServerQuarantinePreparationDeps {
    navigation: Pick<INavigationManager, 'activateRuntimeCommandGate' | 'cancelPendingChannelInput'> | null;
    lifecycle: Pick<IAppLifecycle, 'setPhaseAndWait'> | null;
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
    const failures: Array<{ step: string; error: unknown }> = [];
    const run = (name: string, step: () => void): void => {
        try { step(); } catch (error: unknown) { failures.push({ step: name, error }); }
    };
    const start = (name: string, step: () => Promise<void>): Promise<void> => {
        try {
            return step().catch((error: unknown) => {
                failures.push({ step: name, error });
            });
        } catch (error: unknown) {
            failures.push({ step: name, error });
            return Promise.resolve();
        }
    };
    run('runtime_command_gate', () => deps.navigation?.activateRuntimeCommandGate());
    run('pending_channel_input', () => deps.navigation?.cancelPendingChannelInput());
    run('ready_state', deps.setReadyFalse);
    const drains = [
        start('lifecycle', async () => {
            const lifecycle = deps.lifecycle;
            if (!lifecycle) return;
            if (!await lifecycle.setPhaseAndWait('loading_data')) {
                throw new Error('Lifecycle rejected selected-server recovery phase.');
            }
        }),
        start('tuning', deps.suspendAndDrainTuning),
        start(
            'channel_runtime',
            () => deps.channelManager?.clearRuntimeStateForScopeTransition() ?? Promise.resolve()
        ),
        start(
            'initialization',
            () => deps.initializationCoordinator?.prepareForSelectedServerQuarantine()
                ?? Promise.resolve()
        ),
    ];
    run('playback', deps.stopPlayback);
    run('scheduler', () => deps.scheduler?.unloadChannel());
    run('playback_state', deps.clearPlaybackState);
    run('event_wiring', deps.disposeEventWiring);
    await Promise.all(drains);
    run('epg_selected_channel', () => deps.epgCoordinator?.clearSelectedChannelScheduleSnapshot());
    run('epg_cache', () => deps.epgCoordinator?.clearScheduleCaches());
    run('epg_schedules', () => deps.epg?.clearSchedules());
    if (failures.length > 0) {
        throw new SelectedServerQuarantinePreparationError(failures);
    }
}
