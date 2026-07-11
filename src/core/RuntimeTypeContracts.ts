import type { ModuleRuntimeStatus } from './module-status';
import type { EpgUiStatus } from '../modules/ui/epg/coordinator/EPGCoordinatorContracts';
import type { PlaybackOptionsSectionId } from '../modules/ui/playback-options';
import type { NavigationPlaybackOptionsSectionId } from '../modules/navigation/contracts/NavigationFeaturePorts';
import type { ServerSelectSelectionResult } from '../modules/ui/server-select/types';
import type { AppShellServerSelectionResult } from './app-shell/runtime/AppShellRuntimeContracts';

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
