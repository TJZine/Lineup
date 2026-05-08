import type { ModuleRuntimeStatus } from './module-status';
import type { NavigationPlaybackOptionsSectionId } from '../modules/navigation/contracts/NavigationFeaturePorts';
import type { EpgUiStatus } from '../modules/ui/epg/coordinator/EPGCoordinatorContracts';
import type { PlaybackOptionsSectionId } from '../modules/ui/playback-options';

type IsEqual<A, B> =
    (<T>() => T extends A ? 1 : 2) extends
    (<T>() => T extends B ? 1 : 2)
        ? true
        : false;

type Assert<T extends true> = T;

export type NavigationPlaybackOptionsSectionIdContract = Assert<
    IsEqual<NavigationPlaybackOptionsSectionId, PlaybackOptionsSectionId>
>;

export type EpgUiStatusContract = Assert<
    IsEqual<EpgUiStatus, ModuleRuntimeStatus | undefined>
>;
