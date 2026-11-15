import type { ChannelConfig, ChannelContentSource, ChannelCreateInput, ChannelUpdateInput, ResolvedContentItem } from '../../modules/scheduler/channel-manager/contracts/types';
import type { ChannelStructuralBase, ChannelMutationOutcome, ChannelLoadOutcome } from '../../modules/scheduler/channel-manager/contracts/ChannelDurability';
import type { ChannelStudioRequest } from '../../modules/ui/channels/ChannelDirectoryPorts';
import type { IPlexLibrary } from '../../modules/plex/library/interfaces';
import type { ScheduledProgram } from '../../modules/scheduler/scheduler/types';
import type { INavigationManager } from '../../modules/navigation/contracts/interfaces';

export type StudioDraftKind = 'create' | 'edit' | 'duplicate' | 'inspect';

/** A preview is tied to this exact local draft and scope; a clock tick alone does not invalidate it. */
export interface StudioAirCheckRequest {
    readonly draftRevision: number;
    readonly expectedBase: ChannelStructuralBase;
    readonly candidate: ChannelConfig;
    readonly source: ChannelContentSource;
    readonly asOf: number;
    readonly horizonMs: number;
    readonly sourceIdentity: string;
}

export type StudioVerificationStatus =
    | { kind: 'idle' | 'loading' | 'canceled' }
    | { kind: 'verified'; request: StudioAirCheckRequest; checkedAt: number; items: readonly ResolvedContentItem[]; programs: readonly ScheduledProgram[]; coverageEnd: number; loopDurationMs?: number }
    | { kind: 'partial' | 'stale' | 'offair' | 'error'; reason: string; checkedAt: number };

/** C5 owns the production resolver/scheduler and detailed preview panel. */
export interface StudioAirCheckPort {
    verify(request: StudioAirCheckRequest, signal: AbortSignal): Promise<StudioVerificationStatus>;
    render(container: HTMLElement, status: StudioVerificationStatus, request: StudioAirCheckRequest | null,
        options: { onVerify(): void; onCancel(): void; onExtendHorizon(nextHorizonMs: number): void;
            onControlsChanged(preferredId?: string): void; extensionStatus: StudioVerificationStatus | null }): void;
}

export interface StudioManagerPort {
    getStructuralBase(): ChannelStructuralBase;
    getLastLoadOutcome(): ChannelLoadOutcome;
    getChannel(id: string): ChannelConfig | null;
    getAllChannels(): ChannelConfig[];
    tryCreateChannel(input: ChannelCreateInput, options?: { expectedBase?: ChannelStructuralBase }): Promise<ChannelMutationOutcome<ChannelConfig>>;
    tryUpdateChannel(id: string, updates: ChannelUpdateInput, expectedBase?: ChannelStructuralBase): Promise<ChannelMutationOutcome<ChannelConfig>>;
}

export interface ChannelStudioPorts {
    manager: StudioManagerPort;
    plexLibrary: Pick<IPlexLibrary, 'getLibraries' | 'getShows' | 'getShowEpisodes' | 'getShowSeasons' | 'getCollections' | 'getPlaylists' | 'search' | 'getLibraryItems'>;
    navigation: Pick<INavigationManager, 'registerFocusable' | 'unregisterFocusable' | 'setFocus' | 'on' | 'off'
        | 'openModal' | 'closeModal' | 'isModalOpen'>;
    airCheck: StudioAirCheckPort;
    /** Navigation returns to the Directory with ID-based focus. */
    close(focusChannelId: string | null): void;
    /** Post-commit refresh/pointer warnings do not relabel the durable Save as unsaved. */
    refreshAfterSave(effect: { previous: ChannelConfig | null; saved: ChannelConfig;
        programmingChanged: boolean }): Promise<void>;
    /** Explicit Tune now uses the actual current-channel and native media owner. */
    tuneNow(channelId: string): Promise<void>;
    now(): number;
}

export type { ChannelStudioRequest };
