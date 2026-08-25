import type { ModuleRuntimeStatus } from './module-status';
import type { EpgUiStatus } from '../modules/ui/epg/coordinator/EPGCoordinatorContracts';
import type { PlaybackOptionsSectionId } from '../modules/ui/playback-options';
import type { NavigationPlaybackOptionsSectionId } from '../modules/navigation/contracts/NavigationFeaturePorts';
import type { ServerSelectSelectionResult } from '../modules/ui/server-select/types';
import type {
    AppShellChannelSetupRuntimePort,
    AppShellDiagnosticsRuntimePort,
    AppShellServerSelectState,
    AppShellServerSelectionResult,
    AppShellServerSelectionRuntimePort,
} from './app-shell/runtime/AppShellRuntimeContracts';
import type { ChannelSetupScreenWorkflowPort } from './channel-setup/workflow/ChannelSetupScreenWorkflowPort';
import type { ChannelSetupWorkflowPort } from './channel-setup/workflow/ChannelSetupWorkflowPort';
import type { EpgScheduleRefreshOutcome } from '../shared/epgRefresh';
import type { PlexServerSelectionFailureReason } from '../modules/plex/discovery';

type IsEqual<A, B> =
    (<T>() => T extends A ? 1 : 2) extends
    (<T>() => T extends B ? 1 : 2)
        ? true
        : false;

type Assert<T extends true> = T;

export type EpgUiStatusContract = Assert<
    IsEqual<EpgUiStatus, ModuleRuntimeStatus | undefined>
>;

export type NavigationPlaybackOptionsSectionIdContract = Assert<
    IsEqual<NavigationPlaybackOptionsSectionId, PlaybackOptionsSectionId>
>;

export type AppShellServerSelectionRuntimePortContract = Assert<
    IsEqual<
        Pick<AppShellServerSelectionRuntimePort, 'getSelectedServerScreenState'>,
        {
            getSelectedServerScreenState(): AppShellServerSelectState;
        }
    >
>;

export type AppShellChannelSetupRuntimePortContract = Assert<
    IsEqual<
        Pick<
            AppShellChannelSetupRuntimePort,
            'getChannelSetupScreenWorkflowPort' | 'getSelectedServerId'
        >,
        {
            getChannelSetupScreenWorkflowPort(): ChannelSetupScreenWorkflowPort;
            getSelectedServerId(): string | null;
        }
    >
>;

export type AppShellChannelSetupRuntimePortDiagnosticsExclusionContract = Assert<
    IsEqual<
        Extract<
            keyof AppShellChannelSetupRuntimePort,
            'getChannelSetupWorkflowPort' | 'getSetupPlanDiagnostics'
        >,
        never
    >
>;

export type AppShellDiagnosticsRuntimePortContract = Assert<
    IsEqual<
        Pick<AppShellDiagnosticsRuntimePort, 'getChannelSetupWorkflowPort'>,
        {
            getChannelSetupWorkflowPort(): ChannelSetupWorkflowPort;
        }
    >
>;

export type AppShellServerSelectionResultSelectedContract = Assert<
    IsEqual<
        Extract<AppShellServerSelectionResult, { kind: 'selected' }>,
        {
            kind: 'selected';
            persistedSelection:
                | 'updated'
                | 'skipped_missing_credentials'
                | 'skipped_corrupted_credentials';
            epgRefresh: EpgScheduleRefreshOutcome;
        }
    >
>;

export type AppShellServerSelectionResultFailureContract = Assert<
    IsEqual<
        Extract<AppShellServerSelectionResult, { kind: 'selection_failed' }>,
        {
            kind: 'selection_failed';
            reason: 'server_not_found' | PlexServerSelectionFailureReason;
        }
    >
>;

export type ServerSelectionSelectedResultContract = Assert<
    IsEqual<
        Extract<ServerSelectSelectionResult, { kind: 'selected' }>,
        Extract<AppShellServerSelectionResult, { kind: 'selected' }>
    >
>;

export type ServerSelectionFailureResultContract = Assert<
    IsEqual<
        Extract<ServerSelectSelectionResult, { kind: 'selection_failed' }>,
        Extract<AppShellServerSelectionResult, { kind: 'selection_failed' }>
    >
>;
