import { EventEmitter } from '../../../utils/EventEmitter';
import { summarizeErrorForLog } from '../../../utils/errors';
import { AppErrorCode } from '../../../types/app-errors';
import { ContentResolver } from './resolution/ContentResolver';
import { CollectionRecoveryLookup } from './resolution/CollectionRecoveryLookup';
import { ChannelAuthoringService, omitUndefinedChannelUpdates } from './authoring/ChannelAuthoringService';
import { ChannelImportExportService } from './import-export/ChannelImportExportService';
import { resolveChannelSeed } from './authoring/ChannelSeedPolicy';
import { ChannelPersistenceCoordinator, normalizeStorageKey } from './persistence/ChannelPersistenceCoordinator';
import { ChannelResolutionCache } from './resolution/ChannelResolutionCache';
import { ChannelRetryScheduler } from './resolution/ChannelRetryScheduler';
import {
    ChannelResolutionOperationContext,
    type ChannelInitialResolutionAuthorization,
    type ChannelResolutionLease,
} from './resolution/ChannelResolutionOperationContext';
import type { OperationContextUpstream } from '../../../utils/RetainedOperationContext';
import {
    getContentSourceLogIdentity,
    getHttpStatusForLog,
    isAccessDeniedResolutionError as isAccessDeniedError,
    isConfirmedMissingCollectionError,
    isGracefulAuthoringResolutionError,
    isNetworkResolutionError as isNetworkError,
} from './resolution/ChannelResolutionErrorPolicy';
import { cloneChannelForOwnership, clonePersistableChannel } from './authoring/ChannelDomainClone';
import { ChannelError } from './ChannelErrors';
import type { ChannelLoadOutcome, ChannelMutationOutcome, ChannelStructuralBase } from './contracts/ChannelDurability';
import type { PlexCollection } from '../../plex/library';
import type {
    ChannelContentResolutionOptions,
    IChannelManager,
    ChannelCreateOptions,
    ChannelManagerConfig,
    IPlexLibraryMinimal,
} from './contracts/interfaces';
import type { IDisposable } from '../../../utils/interfaces';
import type {
    ChannelConfig,
    ChannelCreateInput,
    ResolvedChannelContent,
    ResolvedContentItem,
    ImportResult,
    ChannelManagerEventMap,
    ChannelManagerState,
    ChannelUpdateInput,
} from './contracts/types';
import {
    STORAGE_KEY,
    CURRENT_CHANNEL_KEY,
    CHANNEL_ERROR_MESSAGES,
} from './constants';


export { ChannelError } from './ChannelErrors';

const RESOLUTION_AFFECTING_UPDATE_FIELDS = [
    'contentSource',
    'contentFilters',
    'sortOrder',
    'playbackMode',
    'blockSize',
    'includeSpecials',
    'minEpisodeRunTimeMs',
    'maxEpisodeRunTimeMs',
    'shuffleSeed',
] as const satisfies readonly (keyof ChannelConfig)[];

type ChannelResolutionOptions = ChannelContentResolutionOptions & {
    shouldApply?: () => boolean;
    operationContext?: ChannelResolutionLease;
    allowCollectionRecovery?: boolean;
};

type ActiveChannelResolutionOptions = ChannelResolutionOptions & {
    operationContext: ChannelResolutionLease;
};

type CommittedChannelMutation<T> = Extract<ChannelMutationOutcome<T>, { kind: 'committed' }>;
type ChannelReplacementOptions = {
    currentChannelId?: string | null;
    expectedBase?: ChannelStructuralBase;
    protectedReplacementHandle?: string;
};

function affectsResolvedContent(updates: ChannelUpdateInput): boolean {
    return RESOLUTION_AFFECTING_UPDATE_FIELDS.some((field) =>
        Object.prototype.hasOwnProperty.call(updates, field)
    );
}

function isResolutionCacheCompatible(cached: ChannelConfig, current: ChannelConfig): boolean {
    return RESOLUTION_AFFECTING_UPDATE_FIELDS.every((field) =>
        JSON.stringify(cached[field]) === JSON.stringify(current[field])
    );
}

function excludesBlockSpecials(channel: ChannelConfig): boolean {
    return channel.playbackMode === 'block' && channel.includeSpecials === false;
}

function hasSameAuthoredStructure(left: ChannelConfig, right: ChannelConfig): boolean {
    const l = clonePersistableChannel(left);
    const r = clonePersistableChannel(right);
    l.lastContentRefresh = r.lastContentRefresh = 0;
    l.itemCount = r.itemCount = 0;
    l.totalDurationMs = r.totalDurationMs = 0;
    return JSON.stringify(l) === JSON.stringify(r);
}

function createChannelNotFoundError(): ChannelError {
    return new ChannelError(
        AppErrorCode.CHANNEL_NOT_FOUND,
        CHANNEL_ERROR_MESSAGES.CHANNEL_NOT_FOUND,
        false
    );
}

function createStorageValidationError(message: string): ChannelError {
    return new ChannelError(AppErrorCode.STORAGE_VALIDATION_FAILED, message, false);
}

class ChannelConflictError extends ChannelError {
    constructor(message: string) {
        super(AppErrorCode.STORAGE_VALIDATION_FAILED, message, false);
    }
}

function createResolutionAbortError(): Error {
    if (typeof DOMException !== 'undefined') {
        return new DOMException('Resolution was superseded.', 'AbortError');
    }
    const error = new Error('Resolution was superseded.');
    error.name = 'AbortError';
    return error;
}

type CollectionSourceIdentity = {
    collectionKey: string;
    collectionName: string;
    sourceLibraryId: string | undefined;
};

function captureCollectionSourceIdentity(
    channel: ChannelConfig
): CollectionSourceIdentity | null {
    if (channel.contentSource.type !== 'collection') return null;
    return {
        collectionKey: channel.contentSource.collectionKey,
        collectionName: channel.contentSource.collectionName,
        sourceLibraryId: channel.sourceLibraryId,
    };
}

function isSameCollectionSourceIdentity(
    channel: ChannelConfig,
    identity: CollectionSourceIdentity
): boolean {
    return channel.contentSource.type === 'collection'
        && channel.contentSource.collectionKey === identity.collectionKey
        && channel.contentSource.collectionName === identity.collectionName
        && channel.sourceLibraryId === identity.sourceLibraryId;
}

/**
 * Generate a UUID v4.
 */
function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}


/**
 * Channel Manager implementation.
 * Manages virtual TV channels with CRUD operations and content resolution.
 * @implements {IChannelManager}
 */
export class ChannelManager implements IChannelManager {
    private readonly _emitter: EventEmitter<ChannelManagerEventMap>;
    private readonly _contentResolver: ContentResolver;
    private readonly _collectionRecoveryLookup: CollectionRecoveryLookup;
    private readonly _library: IPlexLibraryMinimal;
    private readonly _authoring: ChannelAuthoringService;
    private readonly _importExport: ChannelImportExportService;
    private readonly _persistence: ChannelPersistenceCoordinator;
    private readonly _resolutionCache: ChannelResolutionCache;
    private readonly _retryScheduler: ChannelRetryScheduler;
    private readonly _resolutionOperations = new ChannelResolutionOperationContext();
    private readonly _logger: {
        warn: (message: string, ...args: unknown[]) => void;
        error: (message: string, ...args: unknown[]) => void;
    };

    private _state: ChannelManagerState;
    private _isRuntimeStateCleared = false;
    private _generation = 0;
    private _revision = 0;
    private _protectedBody: { handle: string; raw: string; generation: number; revision: number } | null = null;
    private _lastLoadOutcome: ChannelLoadOutcome = { kind: 'unloaded', generation: 0, revision: 0 };
    private _blockedStoredBody = false;

    getStructuralBase(): ChannelStructuralBase {
        return { generation: this._generation, revision: this._revision };
    }

    getLastLoadOutcome(): ChannelLoadOutcome {
        return this._lastLoadOutcome;
    }

    prepareProtectedReplacement(): ChannelLoadOutcome {
        const base = this._protectedBody;
        if (!base || (this._lastLoadOutcome.kind !== 'unreadable' && this._lastLoadOutcome.kind !== 'unsupported')) {
            throw new ChannelConflictError('No unreadable saved lineup is available for replacement');
        }
        const read = this._persistence.readRawBody();
        if (!read.ok || read.value !== base.raw || base.generation !== this._generation || base.revision !== this._revision) {
            throw new ChannelConflictError('Saved lineup changed or could not be read');
        }
        base.handle = generateUUID();
        this._lastLoadOutcome = { kind: this._lastLoadOutcome.kind, generation: this._generation,
            revision: this._revision, replacementHandle: base.handle };
        return this._lastLoadOutcome;
    }

    cancelProtectedReplacement(handle: string): void {
        if (this._protectedBody?.handle === handle) {
            this._protectedBody.handle = '';
            if (this._lastLoadOutcome.kind === 'unreadable' || this._lastLoadOutcome.kind === 'unsupported') {
                this._lastLoadOutcome = { ...this._lastLoadOutcome, replacementHandle: '' };
            }
        }
    }

    constructor(config: ChannelManagerConfig) {
        this._emitter = new EventEmitter<ChannelManagerEventMap>();
        this._library = config.plexLibrary;
        this._logger = config.logger || {
            warn: console.warn.bind(console),
            error: console.error.bind(console),
        };
        this._contentResolver = new ContentResolver(this._library, this._logger);
        this._collectionRecoveryLookup = new CollectionRecoveryLookup(this._library);
        this._authoring = new ChannelAuthoringService({
            generateId: generateUUID,
            now: Date.now,
        });
        this._persistence = new ChannelPersistenceCoordinator({
            storageKey: config.storageKey,
            currentChannelKey: config.currentChannelKey,
            logger: this._logger,
            emitPersistenceWarning: (payload): void => this._emitter.emit('persistenceWarning', payload),
        });
        this._resolutionCache = new ChannelResolutionCache();
        this._retryScheduler = new ChannelRetryScheduler({
            getChannel: (channelId): ChannelConfig | null => this._state.channels.get(channelId) ?? null,
            resolve: (channel, isCurrent): Promise<ResolvedChannelContent> =>
                this._resolveContentInternal(channel, { shouldApply: isCurrent }),
            logger: this._logger,
        });
        this._importExport = new ChannelImportExportService({
            getAllChannels: (): ChannelConfig[] => this.getAllChannels(),
            isChannelNumberInUse: (number): boolean => this._isChannelNumberInUse(number),
            getNextAvailableNumber: (): number => this._getNextAvailableNumber(),
            createChannel: (input): Promise<ChannelConfig> => this.createChannel(input),
        });

        this._state = {
            channels: new Map(),
            currentChannelId: null,
            channelOrder: [],
        };
    }

    /**
     * Update persistence keys (multi-server / multi-mode support).
     * Does not implicitly load; caller should invoke loadChannels().
     */
    setStorageKeys(storageKey: string, currentChannelKey: string): void {
        const normalizedStorageKey = normalizeStorageKey(storageKey, STORAGE_KEY);
        const normalizedCurrentChannelKey = normalizeStorageKey(currentChannelKey, CURRENT_CHANNEL_KEY);
        this.clearRuntimeState();
        this._persistence.setStorageKeys(normalizedStorageKey, normalizedCurrentChannelKey);
        this._blockedStoredBody = false;
    }

    clearRuntimeState(): void {
        this._collectionRecoveryLookup.clear();
        this._retryScheduler.cancelAll();
        try {
            this._persistence.flush(this._getPersistableState());
        } catch (flushError) {
            try {
                this._persistence.reportFailure(
                    'ChannelManager.clearRuntimeState failed while flushing pending saves',
                    flushError
                );
            } catch (reportingError) {
                this._logger.error(
                    'ChannelManager.clearRuntimeState could not report a pending-save flush failure',
                    {
                        flushError: summarizeErrorForLog(flushError),
                        reportingError: summarizeErrorForLog(reportingError),
                    }
                );
            }
        }
        this._persistence.supersedePendingSave();
        this._clearRuntimeStateAfterPersistence();
    }

    private _clearRuntimeStateAfterPersistence(): void {
        this._generation++;
        this._revision++;
        this._protectedBody = null;
        this._lastLoadOutcome = { kind: 'unloaded', generation: this._generation, revision: this._revision };
        this._contentResolver.clearCaches();
        this._resolutionCache.clear();
        this._state.channels.clear();
        this._state.channelOrder = [];
        this._state.currentChannelId = null;
        this._isRuntimeStateCleared = true;
    }

    async supersedeActiveResolutions(): Promise<void> {
        this._collectionRecoveryLookup.clear();
        this._retryScheduler.cancelAll();
        const consumerDrain = this._resolutionOperations.supersedeAndDrain();
        this._contentResolver.clearCaches();
        await Promise.all([
            consumerDrain,
            this._contentResolver.whenIdle(),
            this._collectionRecoveryLookup.whenIdle(),
        ]);
    }

    resumeActiveResolutions(): void {
        this._resolutionOperations.resume();
    }

    async clearRuntimeStateForScopeTransition(): Promise<void> {
        const drain = this.supersedeActiveResolutions();
        this._persistence.supersedePendingSave();
        await drain;
        this._clearRuntimeStateAfterPersistence();
    }

    private _assertBase(base: ChannelStructuralBase): void {
        if (base.generation !== this._generation || base.revision !== this._revision) {
            throw new ChannelConflictError('Channel lineup changed; prepare the edit again');
        }
    }

    private _mutationFailure(error: unknown): ChannelMutationOutcome<never> {
        const failure = error instanceof Error ? error : new Error('Channel mutation failed');
        const code = failure instanceof ChannelError ? failure.code : null;
        const kind = code === AppErrorCode.STORAGE_QUOTA_EXCEEDED || code === AppErrorCode.PERSISTENCE_FALLBACK
            ? 'storage-failure'
            : failure instanceof ChannelConflictError || code === AppErrorCode.CHANNEL_NOT_FOUND
                ? 'conflict' : 'invalid';
        return { kind, error: failure };
    }

    private _persistStructure(channels: Map<string, ChannelConfig>, order: string[], current: string | null, allowProtected = false): void {
        if (this._blockedStoredBody && !allowProtected) {
            throw new ChannelConflictError('Saved lineup must be read or explicitly replaced before writing');
        }
        if (this._protectedBody && !allowProtected) {
            throw new ChannelConflictError('Unreadable saved lineup must be replaced through its protected handle');
        }
        this._persistence.persistStoredChannelData({
            channels: Array.from(channels.values()), channelOrder: order,
            currentChannelId: current, savedAt: Date.now(),
        });
        this._persistence.supersedePendingSave();
        this._persistence.markSuccess();
        this._revision++;
        this._protectedBody = null;
        this._blockedStoredBody = false;
        this._lastLoadOutcome = { kind: channels.size === 0 ? 'valid-empty' : 'readable',
            generation: this._generation, revision: this._revision, channelCount: channels.size };
    }

    private _chooseCurrent(channels: Map<string, ChannelConfig>, requested?: string | null): string | null {
        const live = this._state.currentChannelId;
        if (live && channels.has(live)) return live;
        return requested && channels.has(requested) ? requested : null;
    }

    createInitialTuneResolutionAuthorization(
        channelId: string,
        validator: OperationContextUpstream
    ): ChannelInitialResolutionAuthorization {
        return this._resolutionOperations.createInitialTuneAuthorization(channelId, validator);
    }

    async resolveChannelContentForInitialTune(
        channelId: string,
        authorization: ChannelInitialResolutionAuthorization
    ): Promise<ResolvedChannelContent> {
        const channel = this._state.channels.get(channelId);
        if (!channel) throw createChannelNotFoundError();
        return this._resolutionOperations.runInitialTune(
            channelId,
            authorization,
            (operationContext) => this._resolveContentInternal(channel, { operationContext })
        );
    }

    /**
     * Replace the entire channel lineup atomically.
     */
    async replaceAllChannels(
        channels: ChannelConfig[],
        options?: ChannelReplacementOptions
    ): Promise<void> {
        this._replaceAllChannelsCommitted(channels, options);
    }

    private _replaceAllChannelsCommitted(
        channels: ChannelConfig[],
        options?: ChannelReplacementOptions
    ): CommittedChannelMutation<void> {
        const replacement = this._authoring.buildReplacementState(channels);
        const nextChannels = replacement.channels;
        const nextChannelOrder = replacement.channelOrder;
        for (const [id, candidate] of nextChannels) {
            const live = this._state.channels.get(id);
            if (live && hasSameAuthoredStructure(live, candidate) && live.lastContentRefresh > candidate.lastContentRefresh) {
                candidate.lastContentRefresh = live.lastContentRefresh;
                candidate.itemCount = live.itemCount;
                candidate.totalDurationMs = live.totalDurationMs;
            }
        }

        if (options?.expectedBase) this._assertBase(options.expectedBase);
        const nextCurrentChannelId = this._chooseCurrent(nextChannels, options?.currentChannelId);
        if (options?.protectedReplacementHandle && !this._protectedBody) {
            throw new ChannelConflictError('Protected replacement is no longer current');
        }
        if (this._protectedBody) {
            const base = this._protectedBody;
            if (!options?.protectedReplacementHandle || options.protectedReplacementHandle !== base.handle
                || base.generation !== this._generation || base.revision !== this._revision) {
                throw new ChannelConflictError('Protected saved lineup requires its current replacement handle');
            }
            const read = this._persistence.readRawBody();
            if (!read.ok || read.value !== base.raw) {
                throw new ChannelConflictError('Protected saved lineup changed or could not be read');
            }
        }
        try {
            this._persistStructure(nextChannels, nextChannelOrder, nextCurrentChannelId, !!this._protectedBody);
        } catch (error) {
            if (!(error instanceof ChannelConflictError)) {
                this._persistence.reportFailure(
                    'ChannelManager.replaceAllChannels failed to persist channels',
                    error
                );
            }
            throw error;
        }
        const revision = this._revision;

        this._retryScheduler.cancelAll();
        this._collectionRecoveryLookup.clear();
        this._contentResolver.clearCaches();
        this._state.channels = nextChannels;
        this._resolutionCache.clear();
        this._state.channelOrder = nextChannelOrder;
        this._state.currentChannelId = nextCurrentChannelId;
        this._isRuntimeStateCleared = false;

        const pointerWarning = !this._persistence.persistCurrentChannelIdBestEffort(nextCurrentChannelId ?? '');
        return { kind: 'committed', value: undefined, revision, pointerWarning };
    }

    async tryReplaceAllChannels(
        channels: ChannelConfig[],
        options?: ChannelReplacementOptions
    ): Promise<ChannelMutationOutcome<void>> {
        try {
            return this._replaceAllChannelsCommitted(channels, options);
        } catch (error) {
            return this._mutationFailure(error);
        }
    }


    async createChannel(
        config: ChannelCreateInput,
        options?: ChannelCreateOptions
    ): Promise<ChannelConfig> {
        return (await this._createChannelCommitted(config, options)).value;
    }

    private async _createChannelCommitted(
        config: ChannelCreateInput,
        options?: ChannelCreateOptions
    ): Promise<CommittedChannelMutation<ChannelConfig>> {
        if (options?.expectedBase) this._assertBase(options.expectedBase);
        const base = this.getStructuralBase();
        const channel = this._authoring.createChannel(config, this._state.channels.values());

        let resolvedContent: ResolvedChannelContent | null = null;
        let shouldEmitContentResolved = false;

        try {
            if (options?.initialContent) {
                const initialItems = this._resolutionCache.cloneItems(options.initialContent);
                resolvedContent = this._createResolvedContent(channel, initialItems);
                this._applyResolvedContentMetadata(channel, resolvedContent);
            } else {
                resolvedContent = await this._resolveContentForAuthoring(channel, options);
                this._applyResolvedContentMetadata(channel, resolvedContent);
                shouldEmitContentResolved = !resolvedContent.fromCache;
            }
        } catch (error) {
            if (!isGracefulAuthoringResolutionError(error)) {
                throw error;
            }
            this._logger.warn(
                `Failed initial content resolution for channel ${channel.id}`,
                summarizeErrorForLog(error)
            );
        }

        this._assertBase(base);
        const nextChannels = new Map(this._state.channels);
        nextChannels.set(channel.id, channel);
        const nextOrder = [...this._state.channelOrder, channel.id];
        try {
            this._persistStructure(nextChannels, nextOrder, this._chooseCurrent(nextChannels));
        } catch (error) {
            if (!(error instanceof ChannelConflictError)) {
                this._persistence.reportFailure('ChannelManager.createChannel failed to persist channel', error);
            }
            throw error;
        }
        this._state.channels = nextChannels;
        this._state.channelOrder = nextOrder;
        this._isRuntimeStateCleared = false;
        const receipt: CommittedChannelMutation<ChannelConfig> = {
            kind: 'committed', value: cloneChannelForOwnership(channel),
            revision: this._revision, pointerWarning: false,
        };

        if (resolvedContent) {
            this._resolutionCache.set(resolvedContent);
            if (shouldEmitContentResolved) {
                this._emitter.emit('contentResolved', resolvedContent);
            }
        }

        this._emitter.emit('channelCreated', cloneChannelForOwnership(channel));

        return receipt;
    }

    async tryCreateChannel(config: ChannelCreateInput, options?: ChannelCreateOptions): Promise<ChannelMutationOutcome<ChannelConfig>> {
        try {
            return await this._createChannelCommitted(config, options);
        } catch (error) { return this._mutationFailure(error); }
    }

    async updateChannel(id: string, updates: ChannelUpdateInput, expectedBase?: ChannelStructuralBase): Promise<ChannelConfig> {
        return (await this._updateChannelCommitted(id, updates, expectedBase)).value;
    }

    private async _updateChannelCommitted(
        id: string, updates: ChannelUpdateInput, expectedBase?: ChannelStructuralBase
    ): Promise<CommittedChannelMutation<ChannelConfig>> {
        if (expectedBase) this._assertBase(expectedBase);
        const base = this.getStructuralBase();
        const channel = this._state.channels.get(id);
        if (!channel) {
            throw createChannelNotFoundError();
        }

        const filteredUpdates = omitUndefinedChannelUpdates(updates);
        const peerChannels = Array.from(this._state.channels.values()).filter((candidate) => candidate.id !== id);
        const updated = this._authoring.updateChannel(channel, filteredUpdates, peerChannels);
        const changesBlockSpecialSelection = excludesBlockSpecials(channel) !== excludesBlockSpecials(updated);

        let resolvedContent: ResolvedChannelContent | null = null;

        if (affectsResolvedContent(filteredUpdates)) {
            try {
                resolvedContent = await this._resolveContentForAuthoring(updated);
                this._applyResolvedContentMetadata(updated, resolvedContent);
            } catch (error) {
                if (changesBlockSpecialSelection && isGracefulAuthoringResolutionError(error)) {
                    throw new ChannelError(AppErrorCode.LIBRARY_UNAVAILABLE,
                        'Cannot change block specials while channel content is unavailable. Retry when the source is available.',
                        true);
                }
                if (!isGracefulAuthoringResolutionError(error)) {
                    throw error;
                }
                this._logger.warn(
                    `Failed content resolution during update for ${id}`,
                    summarizeErrorForLog(error)
                );
            }
        }

        this._assertBase(base);
        const current = this._state.channels.get(id);
        if (current !== channel) throw new ChannelConflictError('Channel changed during update');
        if (!resolvedContent || current.lastContentRefresh > updated.lastContentRefresh) {
            updated.lastContentRefresh = current.lastContentRefresh;
            updated.itemCount = current.itemCount;
            updated.totalDurationMs = current.totalDurationMs;
        }
        const nextChannels = new Map(this._state.channels);
        nextChannels.set(id, updated);
        try {
            this._persistStructure(nextChannels, [...this._state.channelOrder], this._chooseCurrent(nextChannels));
        } catch (error) {
            if (!(error instanceof ChannelConflictError)) {
                this._persistence.reportFailure('ChannelManager.updateChannel failed to persist channel', error);
            }
            throw error;
        }
        this._state.channels = nextChannels;
        const receipt: CommittedChannelMutation<ChannelConfig> = {
            kind: 'committed', value: cloneChannelForOwnership(updated),
            revision: this._revision, pointerWarning: false,
        };

        if (resolvedContent) {
            this._resolutionCache.set(resolvedContent);
            if (!resolvedContent.fromCache) {
                this._emitter.emit('contentResolved', resolvedContent);
            }
        }

        this._emitter.emit('channelUpdated', cloneChannelForOwnership(updated));

        return receipt;
    }

    async tryUpdateChannel(id: string, updates: ChannelUpdateInput, expectedBase?: ChannelStructuralBase): Promise<ChannelMutationOutcome<ChannelConfig>> {
        try {
            return await this._updateChannelCommitted(id, updates, expectedBase);
        } catch (error) { return this._mutationFailure(error); }
    }

    async deleteChannel(id: string, expectedBase?: ChannelStructuralBase): Promise<void> {
        this._deleteChannelCommitted(id, expectedBase);
    }

    private _deleteChannelCommitted(id: string, expectedBase?: ChannelStructuralBase): CommittedChannelMutation<void> {
        if (expectedBase) this._assertBase(expectedBase);
        if (!this._state.channels.has(id)) {
            throw createChannelNotFoundError();
        }

        const nextChannels = new Map(this._state.channels);
        nextChannels.delete(id);
        const nextOrder = this._state.channelOrder.filter((cid) => cid !== id);
        const nextCurrent = this._chooseCurrent(nextChannels);
        try {
            this._persistStructure(nextChannels, nextOrder, nextCurrent);
        } catch (error) {
            if (!(error instanceof ChannelConflictError)) {
                this._persistence.reportFailure('ChannelManager.deleteChannel failed to persist channel', error);
            }
            throw error;
        }
        this._state.channels = nextChannels;
        this._state.channelOrder = nextOrder;
        this._state.currentChannelId = nextCurrent;
        this._resolutionCache.delete(id);
        const revision = this._revision;
        const pointerWarning = nextCurrent === null && !this._persistence.persistCurrentChannelIdBestEffort('');
        const receipt: CommittedChannelMutation<void> = {
            kind: 'committed', value: undefined, revision, pointerWarning,
        };
        this._emitter.emit('channelDeleted', id);
        return receipt;
    }

    async tryDeleteChannel(id: string, expectedBase?: ChannelStructuralBase): Promise<ChannelMutationOutcome<void>> {
        try {
            return this._deleteChannelCommitted(id, expectedBase);
        } catch (error) { return this._mutationFailure(error); }
    }

    getChannel(id: string): ChannelConfig | null {
        const channel = this._state.channels.get(id);
        return channel ? cloneChannelForOwnership(channel) : null;
    }

    getAllChannels(): ChannelConfig[] {
        return this._state.channelOrder
            .map((id) => this._state.channels.get(id))
            .filter((ch): ch is ChannelConfig => ch !== undefined)
            .map((channel) => cloneChannelForOwnership(channel));
    }

    getChannelByNumber(number: number): ChannelConfig | null {
        for (const channel of this._state.channels.values()) {
            if (channel.number === number) {
                return cloneChannelForOwnership(channel);
            }
        }
        return null;
    }

    /**
     * Resolve content for a channel (uses cache if valid).
     * @throws {ChannelError} With AppErrorCode.CHANNEL_NOT_FOUND if channel doesn't exist
     */
    async resolveChannelContent(
        channelId: string,
        options?: ChannelContentResolutionOptions
    ): Promise<ResolvedChannelContent> {
        this._resolutionOperations.assertGeneralAdmission();
        const channel = this._state.channels.get(channelId);
        if (!channel) {
            throw createChannelNotFoundError();
        }

        const cached = this._resolutionCache.get(channelId);
        if (
            options?.cacheMode !== 'revalidate'
            && cached
            && !this._resolutionCache.isStale(cached)
            && isResolutionCacheCompatible(cached.channelSnapshot, channel)
        ) {
            // Return cloned content so callers cannot mutate internal cache state.
            return this._resolutionCache.cloneContent({
                ...cached,
                channelSnapshot: cloneChannelForOwnership(channel),
            }, {
                fromCache: true,
                isStale: false,
                cacheReason: 'fresh',
            });
        }
        if (cached && !isResolutionCacheCompatible(cached.channelSnapshot, channel)) {
            this._resolutionCache.delete(channelId);
        }

        return this._resolveContentInternal(channel, options);
    }

    /**
     * Force refresh content for a channel (bypasses cache).
     * @throws {ChannelError} With AppErrorCode.CHANNEL_NOT_FOUND if channel doesn't exist
     */
    async refreshChannelContent(
        channelId: string,
        options?: { signal?: AbortSignal | null }
    ): Promise<ResolvedChannelContent> {
        this._resolutionOperations.assertGeneralAdmission();
        const channel = this._state.channels.get(channelId);
        if (!channel) {
            throw createChannelNotFoundError();
        }

        this._resolutionCache.delete(channelId);
        this._contentResolver.invalidateSource(channel.contentSource);
        return this._resolveContentInternal(channel, options);
    }

    async resolveChannelItemsForSchedule(
        channelId: string,
        options?: ChannelContentResolutionOptions
    ): Promise<ResolvedContentItem[]> {
        this._resolutionOperations.assertGeneralAdmission();
        const channel = this._state.channels.get(channelId);
        if (!channel) {
            throw createChannelNotFoundError();
        }

        const cached = options?.cacheMode === 'revalidate'
            ? null
            : this._resolutionCache.get(channelId);
        if (cached && !this._resolutionCache.isStale(cached)) {
            return this._resolutionCache.cloneItems(cached.items);
        }

        const items = await this._resolveFilteredItems(channel, options);
        this._assertChannelStillCurrent(channel, undefined);
        return this._resolutionCache.cloneItems(items);
    }



    /** Reorder channels after a durable body write. */
    async reorderChannels(orderedIds: string[], expectedBase?: ChannelStructuralBase): Promise<void> {
        this._reorderChannelsCommitted(orderedIds, expectedBase);
    }

    private _reorderChannelsCommitted(
        orderedIds: string[], expectedBase?: ChannelStructuralBase
    ): CommittedChannelMutation<void> {
        if (expectedBase) this._assertBase(expectedBase);
        this._assertExactChannelOrder(orderedIds);
        this._persistStructure(new Map(this._state.channels), [...orderedIds], this._chooseCurrent(this._state.channels));
        this._state.channelOrder = [...orderedIds];
        return { kind: 'committed', value: undefined, revision: this._revision, pointerWarning: false };
    }

    async tryReorderChannels(orderedIds: string[], expectedBase?: ChannelStructuralBase): Promise<ChannelMutationOutcome<void>> {
        try {
            return this._reorderChannelsCommitted(orderedIds, expectedBase);
        } catch (error) { return this._mutationFailure(error); }
    }

    setCurrentChannel(channelId: string): void {
        const channel = this._state.channels.get(channelId);
        if (!channel) {
            throw createChannelNotFoundError();
        }

        this._state.currentChannelId = channelId;

        this._persistence.persistCurrentChannelIdBestEffort(channelId);

        const index = this._state.channelOrder.indexOf(channelId);
        this._emitter.emit('channelSwitch', { channel: cloneChannelForOwnership(channel), index });
    }

    getCurrentChannel(): ChannelConfig | null {
        if (!this._state.currentChannelId) {
            return null;
        }
        const channel = this._state.channels.get(this._state.currentChannelId);
        return channel ? cloneChannelForOwnership(channel) : null;
    }

    getNextChannel(): ChannelConfig | null {
        if (!this._state.currentChannelId || this._state.channelOrder.length === 0) {
            return null;
        }

        const currentIndex = this._state.channelOrder.indexOf(this._state.currentChannelId);
        const nextIndex = (currentIndex + 1) % this._state.channelOrder.length;
        const nextId = this._state.channelOrder[nextIndex];
        const channel = nextId ? this._state.channels.get(nextId) : undefined;
        return channel ? cloneChannelForOwnership(channel) : null;
    }

    getPreviousChannel(): ChannelConfig | null {
        if (!this._state.currentChannelId || this._state.channelOrder.length === 0) {
            return null;
        }

        const currentIndex = this._state.channelOrder.indexOf(this._state.currentChannelId);
        const prevIndex =
            (currentIndex - 1 + this._state.channelOrder.length) % this._state.channelOrder.length;
        const prevId = this._state.channelOrder[prevIndex];
        const channel = prevId ? this._state.channels.get(prevId) : undefined;
        return channel ? cloneChannelForOwnership(channel) : null;
    }

    exportChannels(): string {
        return this._importExport.exportChannels();
    }

    async importChannels(data: string): Promise<ImportResult> {
        return this._importExport.importChannels(data);
    }

    flushSaves(): Promise<void> {
        if (this._isRuntimeStateCleared) return Promise.resolve();
        try {
            this._persistence.flush(this._getPersistableState());
            return Promise.resolve();
        } catch (error) {
            return Promise.reject(error);
        }
    }

    dispose(): void {
        this._retryScheduler.cancelAll();
        this._persistence.dispose();
        this._collectionRecoveryLookup.clear();
        this._contentResolver.clearCaches();
        this._emitter.removeAllListeners();
    }

    saveChannels(): Promise<void> {
        if (this._isRuntimeStateCleared) return Promise.resolve();
        return this._persistence.save(this._getPersistableState());
    }

    private _queueSave(): void {
        this._isRuntimeStateCleared = false;
        this._persistence.queueSave(this._getPersistableState());
    }

    private _getPersistableState(): {
        channels: Iterable<ChannelConfig>;
        channelOrder: string[];
        currentChannelId: string | null;
    } {
        return {
            channels: this._state.channels.values(),
            channelOrder: this._state.channelOrder,
            currentChannelId: this._state.currentChannelId,
        };
    }

    private _assertExactChannelOrder(orderedIds: string[]): void {
        if (orderedIds.length !== this._state.channels.size) {
            throw createStorageValidationError('Channel reorder must include every channel exactly once');
        }

        const seen = new Set<string>();
        for (const id of orderedIds) {
            if (seen.has(id)) {
                throw createStorageValidationError('Channel reorder cannot include duplicate channel ids');
            }
            seen.add(id);
            if (!this._state.channels.has(id)) {
                throw createStorageValidationError('Channel reorder cannot include unknown channel ids');
            }
        }
    }

    async loadChannels(): Promise<ChannelLoadOutcome> {
        this._generation++;
        this._revision++;
        this._protectedBody = null;
        this._persistence.supersedePendingSave();
        try {
            const normalized = this._persistence.loadNormalized();
            if (normalized.kind !== 'readable') {
                this._blockedStoredBody = normalized.kind !== 'absent';
                this._retryScheduler.cancelAll();
                this._collectionRecoveryLookup.clear();
                this._contentResolver.clearCaches();
                this._resolutionCache.clear();
                this._state.channels.clear();
                this._state.channelOrder = [];
                this._state.currentChannelId = null;
                this._isRuntimeStateCleared = true;
                if (normalized.kind === 'unreadable' || normalized.kind === 'unsupported') {
                    const handle = generateUUID();
                    this._protectedBody = {
                        handle, raw: normalized.raw, generation: this._generation, revision: this._revision,
                    };
                    this._lastLoadOutcome = { kind: normalized.kind, generation: this._generation, revision: this._revision, replacementHandle: handle };
                } else {
                    this._lastLoadOutcome = { kind: normalized.kind, generation: this._generation, revision: this._revision };
                }
                return this._lastLoadOutcome;
            }

            const { data, didMutate: didMutateFromNormalization } = normalized;
            this._blockedStoredBody = false;

            this._persistence.supersedePendingSave();
            this._retryScheduler.cancelAll();
            this._collectionRecoveryLookup.clear();
            this._contentResolver.clearCaches();
            this._resolutionCache.clear();

            // Restore state
            this._state.channels.clear();
            for (const channel of data.channels) {
                this._state.channels.set(channel.id, channel);
            }

            this._state.channelOrder = data.channelOrder;
            this._state.currentChannelId = data.currentChannelId;
            this._isRuntimeStateCleared = false;

            this._lastLoadOutcome = {
                kind: data.channels.length === 0 ? 'valid-empty' : didMutateFromNormalization ? 'readable-degraded' : 'readable',
                generation: this._generation, revision: this._revision, channelCount: data.channels.length,
            };

            // Persist normalized/migrated channel records once.
            if (didMutateFromNormalization) {
                this._queueSave();
            }
            return this._lastLoadOutcome;
        } catch (e) {
            this._logger.error('Failed to load channels from storage', summarizeErrorForLog(e));
            this._blockedStoredBody = true;
            this._lastLoadOutcome = { kind: 'read-failed', generation: this._generation, revision: this._revision };
            return this._lastLoadOutcome;
        }
    }

    on<K extends keyof ChannelManagerEventMap>(
        event: K,
        handler: (payload: ChannelManagerEventMap[K]) => void
    ): IDisposable {
        return this._emitter.on(event, handler);
    }

    private async _resolveFilteredItems(
        channel: ChannelConfig,
        options?: ChannelResolutionOptions
    ): Promise<ResolvedContentItem[]> {
        if (!options?.operationContext) {
            return this._resolutionOperations.run(options?.signal, (operationContext) =>
                this._resolveFilteredItems(channel, { ...options, operationContext })
            );
        }
        const activeOptions: ActiveChannelResolutionOptions = {
            ...options,
            operationContext: options.operationContext,
        };
        const requestedSourceIdentity = captureCollectionSourceIdentity(channel);
        let rawItems: ResolvedContentItem[];
        try {
            rawItems = await this._resolveSourceItems(channel, activeOptions);
        } catch (error) {
            if (
                activeOptions.allowCollectionRecovery
                && requestedSourceIdentity
                && !isSameCollectionSourceIdentity(channel, requestedSourceIdentity)
            ) {
                throw createResolutionAbortError();
            }
            if (
                !activeOptions.allowCollectionRecovery
                || channel.contentSource.type !== 'collection'
                || !isConfirmedMissingCollectionError(error)
            ) {
                throw error;
            }
            return this._recoverMissingCollection(channel, activeOptions, error);
        }

        return this._applyContentSelection(channel, rawItems, activeOptions.operationContext);
    }

    private _resolveSourceItems(
        channel: ChannelConfig,
        options: ActiveChannelResolutionOptions
    ): Promise<ResolvedContentItem[]> {
        return this._contentResolver.resolveSource(channel.contentSource, {
            ...(options.signal !== undefined ? { signal: options.signal } : {}),
            operationContext: options.operationContext,
            ...(options.cacheMode !== undefined ? { cacheMode: options.cacheMode } : {}),
            ...(options.onSourceDiagnostic ? { onSourceDiagnostic: options.onSourceDiagnostic } : {}),
        });
    }

    private _applyContentSelection(
        channel: ChannelConfig,
        rawItems: ResolvedContentItem[],
        operation: ChannelResolutionLease
    ): ResolvedContentItem[] {
        operation.assertCurrent();

        if (rawItems.length === 0) {
            throw new ChannelError(
                AppErrorCode.CONTENT_UNAVAILABLE,
                'Content source returned no items - source may have been deleted',
                true
            );
        }

        const items = this._contentResolver.selectChannelItems(channel, rawItems);

        if (items.length === 0) {
            throw new ChannelError(
                AppErrorCode.SCHEDULER_EMPTY_CHANNEL,
                CHANNEL_ERROR_MESSAGES.EMPTY_CONTENT,
                false
            );
        }

        operation.assertCurrent();
        return items;
    }

    private async _recoverMissingCollection(
        channel: ChannelConfig,
        options: ActiveChannelResolutionOptions,
        missingError: unknown
    ): Promise<ResolvedContentItem[]> {
        const source = channel.contentSource;
        if (
            source.type !== 'collection'
            || !channel.sourceLibraryId
            || channel.sourceLibraryId.trim().length === 0
            || channel.sourceLibraryId !== channel.sourceLibraryId.trim()
            || (channel.sourceLibraryName !== undefined
                && channel.sourceLibraryName.trim() !== channel.sourceLibraryName)
            || source.collectionName.trim().length === 0
            || source.collectionName !== source.collectionName.trim()
            || source.collectionKey.trim().length === 0
            || source.collectionKey !== source.collectionKey.trim()
        ) {
            throw missingError;
        }

        this._assertCollectionRecoveryCurrent(channel, source, options);
        const collections = await this._collectionRecoveryLookup.lookup(
            channel.sourceLibraryId,
            options.operationContext,
            options.signal
        );
        this._assertCollectionRecoveryCurrent(channel, source, options);

        if (collections.some((collection) => collection.ratingKey === source.collectionKey)) {
            throw missingError;
        }

        const candidates = collections.filter((collection) =>
            collection.title === source.collectionName
            && typeof collection.ratingKey === 'string'
            && collection.ratingKey.trim().length > 0
        );
        if (candidates.length !== 1) {
            throw missingError;
        }

        const candidate = candidates[0] as PlexCollection;
        const replacementSource = {
            ...source,
            collectionKey: candidate.ratingKey,
        };
        const replacementChannel: ChannelConfig = {
            ...channel,
            contentSource: replacementSource,
        };
        const replacementItems = await this._resolveSourceItems(replacementChannel, options);
        const filteredItems = this._applyContentSelection(
            replacementChannel,
            replacementItems,
            options.operationContext
        );

        this._commitCollectionRecovery(channel, source, replacementSource, options);
        return filteredItems;
    }

    private _commitCollectionRecovery(
        channel: ChannelConfig,
        originalSource: Extract<ChannelConfig['contentSource'], { type: 'collection' }>,
        replacementSource: Extract<ChannelConfig['contentSource'], { type: 'collection' }>,
        options: ActiveChannelResolutionOptions
    ): void {
        this._assertCollectionRecoveryCurrent(channel, originalSource, options);
        const replacementChannel = cloneChannelForOwnership(channel);
        replacementChannel.contentSource = cloneChannelForOwnership({
            ...channel,
            contentSource: replacementSource,
        }).contentSource;
        const channels = Array.from(this._state.channels.values()).map((current) =>
            current === channel ? replacementChannel : current
        );

        try {
            this._persistStructure(new Map(channels.map((item) => [item.id, item])),
                [...this._state.channelOrder], this._chooseCurrent(this._state.channels));
        } catch (error) {
            this._persistence.reportFailure(
                `ChannelManager collection recovery failed to persist channel ${channel.id}`,
                error
            );
            throw error;
        }

        this._assertCollectionRecoveryCurrent(channel, originalSource, options);
        this._resolutionCache.delete(channel.id);
        this._contentResolver.invalidateSource(originalSource);
        channel.contentSource = cloneChannelForOwnership(replacementChannel).contentSource;
        options.operationContext.assertCurrent();
        this._emitter.emit('channelUpdated', cloneChannelForOwnership(channel));
        this._assertChannelStillCurrent(channel, options.operationContext);
    }

    private _assertCollectionRecoveryCurrent(
        channel: ChannelConfig,
        source: Extract<ChannelConfig['contentSource'], { type: 'collection' }>,
        options: ActiveChannelResolutionOptions
    ): void {
        options.operationContext.assertCurrent();
        if (options.shouldApply && !options.shouldApply()) {
            throw createResolutionAbortError();
        }
        if (
            this._state.channels.get(channel.id) !== channel
            || channel.contentSource !== source
        ) {
            throw createResolutionAbortError();
        }
    }

    private _assertChannelStillCurrent(
        channel: ChannelConfig,
        operation: ChannelResolutionLease | undefined
    ): void {
        operation?.assertCurrent();
        if (this._state.channels.get(channel.id) !== channel) {
            throw createResolutionAbortError();
        }
    }

    private _createResolvedContent(
        channel: ChannelConfig,
        items: ResolvedContentItem[]
    ): ResolvedChannelContent {
        const orderedItems = this._contentResolver.applyPlaybackMode(
            items,
            channel.playbackMode,
            resolveChannelSeed(channel.id, 'shuffleSeed', channel.shuffleSeed),
            channel.blockSize
        );

        const totalDurationMs = items.reduce((sum, item) => sum + item.durationMs, 0);
        return {
            channelId: channel.id,
            channelSnapshot: cloneChannelForOwnership(channel),
            resolvedAt: Date.now(),
            items,
            totalDurationMs,
            orderedItems,
            fromCache: false,
            isStale: false,
            cacheReason: 'fresh',
        };
    }

    private _applyResolvedContentMetadata(
        channel: ChannelConfig,
        content: ResolvedChannelContent
    ): void {
        if (content.fromCache) {
            return;
        }
        channel.lastContentRefresh = content.resolvedAt;
        channel.itemCount = content.items.length;
        channel.totalDurationMs = content.totalDurationMs;
    }

    private _createAccessDeniedResolutionError(channel: ChannelConfig, error: unknown): ChannelError {
        const httpStatus = getHttpStatusForLog(error);
        const context = {
            channelId: channel.id,
            contentSource: getContentSourceLogIdentity(channel.contentSource),
            ...(httpStatus === undefined ? {} : { httpStatus }),
        };
        const causeSummary = summarizeErrorForLog(error);
        this._logger.warn('Access denied resolving channel content', { ...context, error: causeSummary });
        return new ChannelError(
            AppErrorCode.ACCESS_DENIED,
            `Profile does not have access to this channel's content library`,
            false,
            { context, causeSummary }
        );
    }

    private async _resolveContentForAuthoring(
        channel: ChannelConfig,
        options?: ChannelResolutionOptions
    ): Promise<ResolvedChannelContent> {
        if (!options?.operationContext) {
            return this._resolutionOperations.run(options?.signal, (operationContext) =>
                this._resolveContentForAuthoring(channel, { ...options, operationContext })
            );
        }
        const operation = options.operationContext;
        const cached = this._resolutionCache.get(channel.id);

        try {
            const items = await this._resolveFilteredItems(channel, options);
            operation.assertCurrent();
            this._retryScheduler.cancel(channel.id);
            return this._createResolvedContent(channel, items);
        } catch (error) {
            operation.assertCurrent();
            if (error instanceof ChannelError && error.code === AppErrorCode.SCHEDULER_EMPTY_CHANNEL) {
                throw error;
            }

            if (isNetworkError(error) && cached
                && excludesBlockSpecials(cached.channelSnapshot) === excludesBlockSpecials(channel)) {
                const wasStale = this._resolutionCache.isStale(cached);
                this._logger.warn(
                    `Resolution failed for channel ${channel.id} during authoring due to network error, using cached content as stale (ttlStale: ${wasStale})`,
                    summarizeErrorForLog(error)
                );
                operation.assertCurrent();
                this._retryScheduler.queue(channel.id);
                return this._resolutionCache.cloneContent({
                    ...cached,
                    channelSnapshot: cloneChannelForOwnership(channel),
                }, {
                    fromCache: true,
                    isStale: true,
                    cacheReason: 'network_error',
                });
            }

            if (isGracefulAuthoringResolutionError(error) && cached
                && excludesBlockSpecials(cached.channelSnapshot) === excludesBlockSpecials(channel)) {
                this._logger.warn(
                    `Content unavailable for channel ${channel.id}, using stale cache`,
                    summarizeErrorForLog(error)
                );
                operation.assertCurrent();
                return this._resolutionCache.cloneContent({
                    ...cached,
                    channelSnapshot: cloneChannelForOwnership(channel),
                }, {
                    fromCache: true,
                    isStale: true,
                    cacheReason: 'content_unavailable',
                });
            }

            if (isAccessDeniedError(error)) {
                throw this._createAccessDeniedResolutionError(channel, error);
            }

            throw error;
        }
    }

    private async _resolveContentInternal(
        channel: ChannelConfig,
        options?: ChannelResolutionOptions
    ): Promise<ResolvedChannelContent> {
        if (!options?.operationContext) {
            return this._resolutionOperations.run(options?.signal, (operationContext) =>
                this._resolveContentInternal(channel, { ...options, operationContext })
            );
        }
        const operation = options.operationContext;
        operation.assertCurrent();
        const cached = this._resolutionCache.get(channel.id);

        try {
            const items = await this._resolveFilteredItems(channel, {
                ...options,
                allowCollectionRecovery: true,
            });
            this._assertChannelStillCurrent(channel, operation);
            const result = this._createResolvedContent(channel, items);

            if (options?.shouldApply && !options.shouldApply()) {
                return result;
            }

            this._assertChannelStillCurrent(channel, operation);
            this._retryScheduler.cancel(channel.id);
            this._applyResolvedContentMetadata(channel, result);
            result.channelSnapshot = cloneChannelForOwnership(channel);

            // Cache
            operation.assertCurrent();
            this._resolutionCache.set(result);
            operation.assertCurrent();
            this._emitter.emit('contentResolved', result);

            this._assertChannelStillCurrent(channel, operation);
            operation.assertCurrent();
            this._state.channels.set(channel.id, channel);

            operation.assertCurrent();
            this._queueSave();

            operation.assertCurrent();
            return this._resolutionCache.cloneContent(result);
        } catch (error) {
            operation.assertCurrent();
            if (options?.shouldApply && !options.shouldApply()) {
                throw error;
            }

            // Cache fallback is allowed for network errors and graceful source-unavailable errors.
            // SCHEDULER_EMPTY_CHANNEL and other non-network errors should propagate
            if (error instanceof ChannelError && error.code === AppErrorCode.SCHEDULER_EMPTY_CHANNEL) {
                // No fallback for empty content - throw directly
                throw error;
            }

            if (isNetworkError(error) && cached) {
                const isStale = this._resolutionCache.isStale(cached);
                this._assertChannelStillCurrent(channel, operation);
                this._logger.warn(
                    `Resolution failed for channel ${channel.id} due to network error, using cached content (stale: ${isStale})`,
                    summarizeErrorForLog(error)
                );
                this._retryScheduler.queue(channel.id);
                this._assertChannelStillCurrent(channel, operation);
                return this._resolutionCache.cloneContent({
                    ...cached,
                    channelSnapshot: cloneChannelForOwnership(channel),
                }, {
                    fromCache: true,
                    isStale,
                    cacheReason: 'network_error',
                });
            }

            // Per spec: library/collection deleted should return stale cache.
            if (isGracefulAuthoringResolutionError(error) && cached) {
                this._assertChannelStillCurrent(channel, operation);
                this._logger.warn(
                    `Content unavailable for channel ${channel.id}, using stale cache`,
                    summarizeErrorForLog(error)
                );
                return this._resolutionCache.cloneContent({
                    ...cached,
                    channelSnapshot: cloneChannelForOwnership(channel),
                }, {
                    fromCache: true,
                    isStale: true,
                    cacheReason: 'content_unavailable',
                });
            }

            // Access denied (403): profile lacks library permission.
            // Do NOT use stale cache — the 403 persists for the entire session.
            // Note: graceful source-unavailable errors and access-denied errors are mutually exclusive
            // by code/status policy, so ordering here is not load-bearing.
            if (isAccessDeniedError(error)) {
                // Prevent any future cache fallback for a persistent 403.
                operation.assertCurrent();
                this._resolutionCache.delete(channel.id);
                operation.assertCurrent();
                this._contentResolver.invalidateSource(channel.contentSource);
                operation.assertCurrent();
                this._retryScheduler.cancel(channel.id);

                throw this._createAccessDeniedResolutionError(channel, error);
            }

            // No cache fallback for other errors - re-throw
            throw error;
        }
    }

    private _isChannelNumberInUse(number: number): boolean {
        return this._authoring.isChannelNumberInUse(number, this._state.channels.values());
    }

    private _getNextAvailableNumber(): number {
        return this._authoring.getNextAvailableNumber(this._state.channels.values());
    }
}
