import type { IEPGComponent } from '../interfaces';
import type { EpgRetainedOperationContext } from '../runtime/EPGRetainedOperationContext';
import type { ChannelConfig as EpgChannel } from '../types';
import type { ChannelConfig, IChannelManager } from '../../../scheduler/channel-manager';
import type { AppendIssueDiagnostic } from '../../../debug/IssueDiagnosticsStore';
import type { EpgPreferencesStore } from '../../../settings/EpgPreferencesStore';
import { toEpgChannels } from '../model/adapters';
import {
    computeNormalizedLibraryFilterState,
    selectVisibleChannelsForLibraryFilter,
} from './EPGCoordinatorPolicies';
import { reportLibraryFilterPersistenceResult } from './EPGLibraryFilterPersistenceDiagnostics';

export interface EPGChannelPrimePublication {
    shouldClearPersistedSelection: boolean;
    clearPersistedSelection(operation: EpgRetainedOperationContext): void;
    tabs: { libraries: Array<{ id: string; name: string }>; selectedId: string | null };
    layoutMode: Parameters<IEPGComponent['setLayoutMode']>[0];
    nowWatchingEnabled: boolean;
    visibleHours: number;
    channels: EpgChannel[];
}

export function createEpgChannelPrimePublication(options: {
    channelManager: IChannelManager;
    preferencesStore: EpgPreferencesStore;
    appendIssueDiagnostic: AppendIssueDiagnostic;
    getVisibleHours: (
        channels: ChannelConfig[],
        selectedId: string | null,
        shouldFilter: boolean
    ) => number;
}): EPGChannelPrimePublication {
    const all = options.channelManager.getAllChannels();
    const normalized = computeNormalizedLibraryFilterState(
        all,
        options.preferencesStore.readScheduleRangeSnapshotAndClean()
    );
    return {
        shouldClearPersistedSelection: normalized.shouldClearPersistedSelection,
        clearPersistedSelection: (operation): void => {
            operation.assertCurrent();
            const result = options.preferencesStore.writeSelectedLibraryId(null);
            operation.assertCurrent();
            reportLibraryFilterPersistenceResult(
                options.appendIssueDiagnostic,
                result,
                null,
                'prime-epg-channels'
            );
            operation.assertCurrent();
        },
        tabs: {
            libraries: normalized.tabsEnabled ? normalized.libraries : [],
            selectedId: normalized.tabsEnabled ? normalized.selectedId : null,
        },
        layoutMode: options.preferencesStore.readLayoutModeAndClean('classic'),
        nowWatchingEnabled: options.preferencesStore.readNowWatchingEnabledAndClean(true),
        visibleHours: options.getVisibleHours(all, normalized.selectedId, normalized.shouldFilter),
        channels: toEpgChannels(selectVisibleChannelsForLibraryFilter(
            all,
            normalized.selectedId,
            normalized.shouldFilter
        )),
    };
}

export class EPGChannelPrimePublisher {
    constructor(private readonly _getEpg: () => IEPGComponent | null) {}

    publish(
        publication: EPGChannelPrimePublication,
        operation: EpgRetainedOperationContext
    ): void {
        const epg = this._getEpg();
        operation.assertCurrent();
        if (!epg) return;
        if (publication.shouldClearPersistedSelection) {
            operation.assertCurrent();
            publication.clearPersistedSelection(operation);
            operation.assertCurrent();
        }
        operation.assertCurrent();
        epg.setLibraryTabs(publication.tabs.libraries, publication.tabs.selectedId);
        operation.assertCurrent();
        epg.setLayoutMode(publication.layoutMode);
        operation.assertCurrent();
        epg.setNowWatchingBannerEnabled(publication.nowWatchingEnabled);
        operation.assertCurrent();
        epg.setVisibleHours(publication.visibleHours);
        operation.assertCurrent();
        epg.loadChannels(publication.channels);
        operation.assertCurrent();
    }
}
