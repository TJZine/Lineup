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
import { cloneChannelForOwnership } from './authoring/ChannelDomainClone';
import { ChannelError } from './ChannelErrors';
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

const RESOLUTION_AFFECTING_UPDATE_FIELDS: readonly (keyof ChannelUpdateInput)[] = [
    'contentSource',
    'contentFilters',
    'sortOrder',
    'playbackMode',
    'blockSize',
    'minEpisodeRunTimeMs',
    'maxEpisodeRunTimeMs',
    'shuffleSeed',
];

type ChannelResolutionOptions = ChannelContentResolutionOptions & {
    shouldApply?: () => boolean;
    operationContext?: ChannelResolutionLease;
    allowCollectionRecovery?: boolean;
};

type ActiveChannelResolutionOptions = ChannelResolutionOptions & {
    operationContext: ChannelResolutionLease;
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
        options?: { currentChannelId?: string | null }
    ): Promise<void> {
        const replacement = this._authoring.buildReplacementState(channels, this._logger);
        const nextChannels = replacement.channels;
        const nextChannelOrder = replacement.channelOrder;

        const requestedCurrent = options?.currentChannelId ?? null;
        const fallbackCurrent = nextChannelOrder[0] ?? null;
        const nextCurrentChannelId =
            requestedCurrent && nextChannels.has(requestedCurrent)
                ? requestedCurrent
                : fallbackCurrent;

        try {
            this._persistence.persistStoredChannelData({
                channels: Array.from(nextChannels.values()),
                channelOrder: nextChannelOrder,
                currentChannelId: nextCurrentChannelId,
                savedAt: Date.now(),
            });
            this._persistence.supersedePendingSave();
            this._persistence.markSuccess();
        } catch (error) {
            this._persistence.reportFailure(
                'ChannelManager.replaceAllChannels failed to persist channels',
                error
            );
            throw error;
        }

        this._retryScheduler.cancelAll();
        this._collectionRecoveryLookup.clear();
        this._contentResolver.clearCaches();
        this._state.channels = nextChannels;
        this._resolutionCache.clear();
        this._state.channelOrder = nextChannelOrder;
        this._state.currentChannelId = nextCurrentChannelId;
        this._isRuntimeStateCleared = false;

        if (this._state.currentChannelId) {
            this._persistence.persistCurrentChannelIdBestEffort(this._state.currentChannelId);
        }
    }


    async createChannel(
        config: ChannelCreateInput,
        options?: ChannelCreateOptions
    ): Promise<ChannelConfig> {
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

        this._state.channels.set(channel.id, channel);
        this._state.channelOrder.push(channel.id);

        if (resolvedContent) {
            this._resolutionCache.set(resolvedContent);
            if (shouldEmitContentResolved) {
                this._emitter.emit('contentResolved', resolvedContent);
            }
        }

        this._queueSave();
        this._emitter.emit('channelCreated', cloneChannelForOwnership(channel));

        return cloneChannelForOwnership(channel);
    }

    async updateChannel(id: string, updates: ChannelUpdateInput): Promise<ChannelConfig> {
        const channel = this._state.channels.get(id);
        if (!channel) {
            throw createChannelNotFoundError();
        }

        const filteredUpdates = omitUndefinedChannelUpdates(updates);
        const peerChannels = Array.from(this._state.channels.values()).filter((candidate) => candidate.id !== id);
        const updated = this._authoring.updateChannel(channel, filteredUpdates, peerChannels);

        let resolvedContent: ResolvedChannelContent | null = null;

        if (affectsResolvedContent(filteredUpdates)) {
            try {
                resolvedContent = await this._resolveContentForAuthoring(updated);
                this._applyResolvedContentMetadata(updated, resolvedContent);
            } catch (error) {
                if (!isGracefulAuthoringResolutionError(error)) {
                    throw error;
                }
                this._logger.warn(
                    `Failed content resolution during update for ${id}`,
                    summarizeErrorForLog(error)
                );
            }
        }

        this._state.channels.set(id, updated);

        if (resolvedContent) {
            this._resolutionCache.set(resolvedContent);
            if (!resolvedContent.fromCache) {
                this._emitter.emit('contentResolved', resolvedContent);
            }
        }

        this._queueSave();
        this._emitter.emit('channelUpdated', cloneChannelForOwnership(updated));

        return cloneChannelForOwnership(updated);
    }

    async deleteChannel(id: string): Promise<void> {
        if (!this._state.channels.has(id)) {
            throw createChannelNotFoundError();
        }

        this._state.channels.delete(id);
        this._resolutionCache.delete(id);
        this._state.channelOrder = this._state.channelOrder.filter((cid) => cid !== id);

        if (this._state.currentChannelId === id) {
            this._state.currentChannelId =
                this._state.channelOrder.length > 0 ? this._state.channelOrder[0]! : null;
        }

        this._queueSave();
        this._emitter.emit('channelDeleted', id);
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

        const cached = options?.cacheMode === 'revalidate'
            ? null
            : this._resolutionCache.get(channelId);
        if (
            cached
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



    /**
     * Reorder channels.
     * @remarks In-memory order is updated synchronously; persistence is queued via debounced save.
     */
    async reorderChannels(orderedIds: string[]): Promise<void> {
        this._assertExactChannelOrder(orderedIds);
        this._state.channelOrder = [...orderedIds];
        this._queueSave();
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

    async loadChannels(): Promise<void> {
        try {
            const normalized = this._persistence.loadNormalized();
            if (!normalized) {
                return;
            }

            const { data, didMutate: didMutateFromNormalization } = normalized;

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

            // Persist normalized/migrated channel records once.
            if (didMutateFromNormalization) {
                this._queueSave();
            }
        } catch (e) {
            this._logger.error('Failed to load channels from storage', summarizeErrorForLog(e));
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

        let items = rawItems;
        if (channel.contentFilters && channel.contentFilters.length > 0) {
            items = this._contentResolver.applyFilters(items, channel.contentFilters);
        }

        if (channel.sortOrder) {
            items = this._contentResolver.applySort(items, channel.sortOrder);
        }

        items = items.filter((item) => item.durationMs > 0);

        if (channel.minEpisodeRunTimeMs || channel.maxEpisodeRunTimeMs) {
            items = items.filter((item) => {
                if (channel.minEpisodeRunTimeMs && item.durationMs < channel.minEpisodeRunTimeMs) {
                    return false;
                }
                if (channel.maxEpisodeRunTimeMs && item.durationMs > channel.maxEpisodeRunTimeMs) {
                    return false;
                }
                return true;
            });
        }

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
            this._persistence.persistStoredChannelData({
                channels,
                channelOrder: [...this._state.channelOrder],
                currentChannelId: this._state.currentChannelId,
                savedAt: Date.now(),
            });
            this._persistence.supersedePendingSave();
            this._persistence.markSuccess();
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
        const cached = options?.cacheMode === 'revalidate'
            ? null
            : this._resolutionCache.get(channel.id);

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

            if (isNetworkError(error) && cached) {
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

            if (isGracefulAuthoringResolutionError(error) && cached) {
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
        const cached = options?.cacheMode === 'revalidate'
            ? null
            : this._resolutionCache.get(channel.id);

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
