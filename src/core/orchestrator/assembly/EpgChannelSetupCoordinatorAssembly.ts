import type { ChannelConfig, IChannelManager, ResolvedChannelContent } from '../../../modules/scheduler/channel-manager';
import type { IChannelScheduler, ScheduleConfig } from '../../../modules/scheduler/scheduler';
import type { IEPGComponent } from '../../../modules/ui/epg/interfaces';
import { EPGCoordinator } from '../../../modules/ui/epg/coordinator/EPGCoordinator';
import type { EpgScheduleRefreshOptions } from '../../../modules/ui/epg/coordinator/EPGCoordinatorContracts';
import { withEpgVisibleRangeChangeBinding } from '../../../modules/ui/epg/component/EPGConfigBindings';
import type { EPGConfig, EPGUiStatus, EpgVisibleRange } from '../../../modules/ui/epg/types';
import type { ChannelSwitchOutcome } from '../../../types/channelSwitch';
import { ChannelSetupBuildScratchStore } from '../../channel-setup/build/ChannelSetupBuildScratchStore';
import { ChannelSetupCoordinator } from '../../channel-setup/ChannelSetupCoordinator';
import { ChannelSetupRecordStore } from '../../channel-setup/persistence/ChannelSetupRecordStore';
import type { ChannelSetupWorkflowPortOwners } from '../../channel-setup/workflow/createChannelSetupWorkflowPort';
import { createLazyChannelSetupWorkflowPortOwners } from '../../channel-setup/workflow/LazyChannelSetupWorkflowPortOwners';
import type { GuideSelectionSnapshot } from '../../channel-tuning';
import {
    safeLocalStorageGet,
    safeLocalStorageRemove,
    safeLocalStorageRemoveWithResult,
    safeLocalStorageSetWithResult,
} from '../../../utils/storage';
import type {
    OrchestratorChannelSetupBuilderInput,
    OrchestratorCoordinatorAssemblyInput,
    OrchestratorEpgCoordinatorBuilderInput,
} from './OrchestratorCoordinatorContracts';

function reportCoordinatorEpgInitWarning(input: OrchestratorEpgCoordinatorBuilderInput): void {
    input.nowPlaying.handler()?.({
        message: 'Guide unavailable right now. Try again.',
        type: 'warning',
    });
}

function handleVisibleRangeChange(epgCoordinator: EPGCoordinator, range: EpgVisibleRange): void {
    epgCoordinator.handleVisibleRangeChange(range);
}

export function buildEpgCoordinatorInput(
    input: OrchestratorCoordinatorAssemblyInput
): OrchestratorEpgCoordinatorBuilderInput {
    return {
        epgDebugRuntime: input.epgDebugRuntime,
        config: input.config,
        moduleStatus: input.moduleStatus,
        init: input.init,
        modules: {
            epg: input.modules.epg,
            channelManager: input.modules.channelManager,
            scheduler: input.modules.scheduler,
        },
        stores: {
            epgPreferencesStore: input.stores.epgPreferencesStore,
        },
        diagnostics: {
            appendIssueDiagnostic: input.diagnostics.appendIssueDiagnostic,
        },
        schedule: {
            lastChannelChangeSource: input.schedule.lastChannelChangeSource,
            setLastChannelChangeSource: input.schedule.setLastChannelChangeSource,
            getLocalMidnightMs: input.schedule.getLocalMidnightMs,
            buildDailyScheduleConfig: input.schedule.buildDailyScheduleConfig,
        },
        actions: {
            switchToChannel: input.actions.switchToChannel,
            switchToChannelWithOutcome: input.actions.switchToChannelWithOutcome,
            onOverlayVisibilityChange: input.actions.onOverlayVisibilityChange,
        },
        nowPlaying: input.nowPlaying,
    };
}

export function buildChannelSetupInput(
    input: OrchestratorCoordinatorAssemblyInput
): OrchestratorChannelSetupBuilderInput {
    return {
        init: input.init,
        modules: {
            navigation: input.modules.navigation,
            plexLibrary: input.modules.plexLibrary,
            channelManager: input.modules.channelManager,
        },
        schedule: {
            getActiveUserId: input.schedule.getActiveUserId,
            getSelectedServerId: input.schedule.getSelectedServerId,
        },
        diagnostics: {
            appendIssueDiagnostic: input.diagnostics.appendIssueDiagnostic,
        },
    };
}

export function buildEpgCoordinator(input: OrchestratorEpgCoordinatorBuilderInput): EPGCoordinator {
    return new EPGCoordinator({
        getEpg: (): IEPGComponent | null => input.modules.epg,
        getChannelManager: (): IChannelManager | null => input.modules.channelManager,
        getScheduler: (): IChannelScheduler | null => input.modules.scheduler,
        getEpgUiStatus: (): EPGUiStatus => input.moduleStatus.getRuntimeStatus('epg-ui'),
        ensureEpgInitialized: (): Promise<void> => input.init.ensureEpgInitialized(),
        getEpgConfig: (): EPGConfig | null => input.config?.epgConfig ?? null,
        getLocalMidnightMs: (timeMs: number): number => input.schedule.getLocalMidnightMs(timeMs),
        debugRuntime: input.epgDebugRuntime,
        buildDailyScheduleConfig: (
            channel: ChannelConfig,
            items: ResolvedChannelContent['items'],
            referenceTimeMs: number
        ): ScheduleConfig => input.schedule.buildDailyScheduleConfig(channel, items, referenceTimeMs),
        getPreserveFocusOnOpen: (): boolean => input.schedule.lastChannelChangeSource() === 'guide',
        setLastChannelChangeSourceToGuide: (): void => {
            input.schedule.setLastChannelChangeSource('guide');
        },
        switchToChannel: (
            channelId: string,
            options?: { guideSelectionSnapshot?: GuideSelectionSnapshot }
        ): Promise<ChannelSwitchOutcome> =>
            input.actions.switchToChannelWithOutcome(channelId, options),
        onVisibilityChange: (visible: boolean): void => {
            input.actions.onOverlayVisibilityChange(visible);
        },
        reportEpgInitWarning: (): void => reportCoordinatorEpgInitWarning(input),
        epgPreferencesStore: input.stores.epgPreferencesStore,
        appendIssueDiagnostic: input.diagnostics.appendIssueDiagnostic,
    });
}

export function bindEpgVisibleRangeChange(
    input: OrchestratorEpgCoordinatorBuilderInput,
    epgCoordinator: EPGCoordinator
): void {
    if (!input.config?.epgConfig) {
        return;
    }
    input.config.epgConfig =
        withEpgVisibleRangeChangeBinding(
            input.config.epgConfig,
            (range: EpgVisibleRange): void => {
                handleVisibleRangeChange(epgCoordinator, range);
            }
        ) ?? input.config.epgConfig;
}

export interface ChannelSetupOwners {
    coordinator: ChannelSetupCoordinator;
    portOwners: ChannelSetupWorkflowPortOwners;
}

export function buildChannelSetupOwners(
    input: OrchestratorChannelSetupBuilderInput,
    epgCoordinator: EPGCoordinator
): ChannelSetupOwners {
    const recordStore = new ChannelSetupRecordStore({
        storageGet: safeLocalStorageGet,
        storageSet: safeLocalStorageSetWithResult,
        storageRemove: safeLocalStorageRemoveWithResult,
        getActiveUserId: input.schedule.getActiveUserId,
        appendDiagnostic: (event): void => {
            input.diagnostics.appendIssueDiagnostic(
                'channel-setup-record',
                'channel-setup.record.persistence',
                event
            );
        },
    });
    const buildScratchStore = new ChannelSetupBuildScratchStore({
        storageRemove: safeLocalStorageRemove,
    });
    const getSelectedServerId = (): string | null => input.schedule.getSelectedServerId();
    const getExistingChannelCount = (): number => input.modules.channelManager.getAllChannels().length;
    const coordinator = new ChannelSetupCoordinator({
        recordStore,
        scratchStore: buildScratchStore,
        navigation: input.modules.navigation,
        getSelectedServerId,
        getExistingChannelCount,
    });
    return {
        coordinator,
        portOwners: createLazyChannelSetupWorkflowPortOwners({
            plexLibrary: input.modules.plexLibrary,
            channelManager: input.modules.channelManager,
            scratchStore: buildScratchStore,
            recordStore,
            ensureEpgInitialized: (): Promise<void> => input.init.ensureEpgInitialized(),
            clearSelectedChannelScheduleSnapshot: (): void => {
                epgCoordinator.clearSelectedChannelScheduleSnapshot();
            },
            primeEpgChannels: (): void => {
                epgCoordinator.primeEpgChannels();
            },
            refreshEpgSchedules: (options?: EpgScheduleRefreshOptions) =>
                epgCoordinator.refreshEpgSchedules(options),
            clearRerunRequest: (): void => {
                coordinator.clearRerunRequest();
            },
            getActiveUserId: input.schedule.getActiveUserId,
            getSelectedServerId,
            getExistingChannelCount,
        }),
    };
}
