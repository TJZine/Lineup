import type { ChannelConfig, ResolvedChannelContent } from '../../scheduler/channel-manager/contracts/types';
import type { ChannelLoadOutcome, ChannelMutationOutcome, ChannelStructuralBase } from '../../scheduler/channel-manager/contracts/ChannelDurability';
import type { INavigationManager } from '../../navigation/contracts/interfaces';

/** Studio owns draft creation and Save. Directory never persists a duplicate. */
export type ChannelStudioRequest =
    | { kind: 'create' }
    | { kind: 'inspect' | 'duplicate'; channelId: string; expectedBase: ChannelStructuralBase };

export interface ActiveMediaIdentity {
    readonly sessionId: string;
    readonly scopeKey: string;
    readonly channelId: string;
}

export function sameActiveMedia(a: ActiveMediaIdentity | null, b: ActiveMediaIdentity | null): boolean {
    return a === null ? b === null : b !== null
        && a.sessionId === b.sessionId && a.scopeKey === b.scopeKey && a.channelId === b.channelId;
}

export interface ChannelDirectoryPorts {
    manager: Pick<import('../../scheduler/channel-manager/ChannelManager').ChannelManager,
        'getLastLoadOutcome' | 'getStructuralBase' | 'getAllChannels' | 'tryReplaceAllChannels' | 'resolveChannelContent'>;
    navigation: Pick<INavigationManager,
        'registerFocusable' | 'unregisterFocusable' | 'setFocus' | 'getFocusedElement' | 'on' | 'off'
        | 'openModal' | 'closeModal' | 'isModalOpen'>;
    openStudio(request: ChannelStudioRequest): void;
    openGenerate(): void;
    goBack(): void;
    /** Actual media owner supplies the active session, independent of selected channel. */
    getActiveMediaIdentity(): ActiveMediaIdentity | null;
    /** Scope key for the manager instance currently displayed by this directory. */
    getDirectoryScopeKey(): string;
    /** Rechecks session + scope at effect time and stops/releases only that same session. */
    stopDeletedMediaIfCurrent(identity: ActiveMediaIdentity): Promise<'stopped' | 'superseded'>;
    /** Guide/channel pointers are post-commit effects; a failure is a saved warning. */
    refreshAfterCommit(): Promise<void>;
    openGuideAfterActiveDelete(): void | Promise<void>;
    now(): number;
}

export type DirectoryManager = ChannelDirectoryPorts['manager'];
export type DirectoryLoadOutcome = ChannelLoadOutcome;
export type DirectoryMutationOutcome = ChannelMutationOutcome<void>;
export type DirectoryResolvedContent = ResolvedChannelContent;
export type DirectoryChannel = ChannelConfig;
