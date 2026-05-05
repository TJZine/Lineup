/**
 * Manages virtual TV channel CRUD, content resolution, and persistence.
 */

import { EventEmitter } from '../../../utils/EventEmitter';
import { fnv1a32Uint } from '../../../utils/hash';
import { summarizeErrorForLog } from '../../../utils/errors';
import { AppErrorCode, getAppErrorCode } from '../../../types/app-errors';
import { ContentResolver } from './ContentResolver';
import { ChannelAuthoringService, omitUndefinedChannelUpdates } from './ChannelAuthoringService';
import { ChannelImportExportService } from './ChannelImportExportService';
import { ChannelPersistenceCoordinator, normalizeStorageKey } from './ChannelPersistenceCoordinator';
import { ChannelResolutionCache } from './ChannelResolutionCache';
import { ChannelRetryScheduler } from './ChannelRetryScheduler';
import { ChannelError } from './ChannelErrors';
import type { IChannelManager, ChannelCreateOptions, ChannelManagerConfig, IPlexLibraryMinimal } from './interfaces';
import type { IDisposable } from '../../../utils/interfaces';
import type {
    ChannelConfig,
    ChannelContentSource,
    ChannelCreateInput,
    ResolvedChannelContent,
    ResolvedContentItem,
    ImportResult,
    ChannelManagerEventMap,
    ChannelManagerState,
    ChannelUpdateInput,
} from './types';
import {
    STORAGE_KEY,
    CURRENT_CHANNEL_KEY,
    CHANNEL_ERROR_MESSAGES,
} from './constants';


export { ChannelError } from './ChannelErrors';

/**
 * Network-related AppErrorCodes that allow cache fallback.
 */
const NETWORK_ERROR_CODES: Set<AppErrorCode> = new Set([
    AppErrorCode.NETWORK_TIMEOUT,
    AppErrorCode.NETWORK_OFFLINE,
    AppErrorCode.SERVER_UNREACHABLE,
    AppErrorCode.NETWORK_UNAVAILABLE,
]);

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

/**
 * Extract AppErrorCode from any error type that has a code property.
 * Works with ChannelError, PlexLibraryError, PlexApiError, etc.
 */
function getErrorCode(error: unknown): AppErrorCode | null {
    if (error && typeof error === 'object' && 'code' in error) {
        return getAppErrorCode((error as { code: unknown }).code);
    }
    return null;
}

/**
 * Check if error is a network-related error that allows cache fallback.
 */
function isNetworkError(error: unknown): boolean {
    const code = getErrorCode(error);
    if (code && NETWORK_ERROR_CODES.has(code)) {
        return true;
    }
    // Fallback: Check error message for network-related terms
    return error instanceof Error && (
        error.message.toLowerCase().includes('network') ||
        error.message.toLowerCase().includes('timeout') ||
        error.message.toLowerCase().includes('econnrefused') ||
        error.message.toLowerCase().includes('failed to fetch')
    );
}

function affectsResolvedContent(updates: ChannelUpdateInput): boolean {
    return RESOLUTION_AFFECTING_UPDATE_FIELDS.some((field) =>
        Object.prototype.hasOwnProperty.call(updates, field)
    );
}

/**
 * Check if error is a content-unavailable error that allows stale cache fallback.
 */
function isContentUnavailableError(error: unknown): boolean {
    const code = getErrorCode(error);
    return code === AppErrorCode.CONTENT_UNAVAILABLE;
}

/**
 * Check if error is an access-denied (403) error.
 * Unlike network errors, 403 is persistent for the session and should NOT use cache fallback.
 */
function isAccessDeniedError(error: unknown): boolean {
    const code = getErrorCode(error);
    return code === AppErrorCode.ACCESS_DENIED;
}

function isResourceNotFoundError(error: unknown): boolean {
    const code = getErrorCode(error);
    if (code === AppErrorCode.RESOURCE_NOT_FOUND) {
        return true;
    }
    const status = getHttpStatusForLog(error);
    if (status === 404) {
        return true;
    }
    return error instanceof Error && /\b404\b/.test(error.message);
}

function isGracefulAuthoringResolutionError(error: unknown): boolean {
    return isContentUnavailableError(error) || isResourceNotFoundError(error);
}

function getContentSourceLogIdentity(
    source: ChannelContentSource
): { type: ChannelContentSource['type']; id?: string } {
    switch (source.type) {
        case 'library':
            return { type: source.type, id: source.libraryId };
        case 'collection':
            return { type: source.type, id: source.collectionKey };
        case 'show':
            return { type: source.type, id: source.showKey };
        case 'playlist':
            return { type: source.type, id: source.playlistKey };
        case 'mixed':
        case 'manual':
        default:
            return { type: source.type };
    }
}

function getHttpStatusForLog(error: unknown): number | undefined {
    if (!error || typeof error !== 'object') return undefined;
    const maybe = error as { httpStatus?: unknown; status?: unknown };
    if (typeof maybe.httpStatus === 'number') return maybe.httpStatus;
    if (typeof maybe.status === 'number') return maybe.status;
    return undefined;
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
    private readonly _library: IPlexLibraryMinimal;
    private readonly _authoring: ChannelAuthoringService;
    private readonly _importExport: ChannelImportExportService;
    private readonly _persistence: ChannelPersistenceCoordinator;
    private readonly _resolutionCache: ChannelResolutionCache;
    private readonly _retryScheduler: ChannelRetryScheduler;
    private readonly _logger: {
        warn: (message: string, ...args: unknown[]) => void;
        error: (message: string, ...args: unknown[]) => void;
    };

    private _state: ChannelManagerState;

    constructor(config: ChannelManagerConfig) {
        this._emitter = new EventEmitter<ChannelManagerEventMap>();
        this._library = config.plexLibrary;
        this._logger = config.logger || {
            warn: console.warn.bind(console),
            error: console.error.bind(console),
        };
        this._contentResolver = new ContentResolver(this._library, this._logger);
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
        this._retryScheduler.cancelAll();
        try {
            this._persistence.flush(this._getPersistableState());
        } catch (error) {
            this._persistence.reportFailure(
                'ChannelManager.setStorageKeys failed while flushing pending saves',
                error
            );
        }
        this._persistence.setStorageKeys(normalizedStorageKey, normalizedCurrentChannelKey);
        this._contentResolver.clearCaches();
        this._state.channels.clear();
        this._resolutionCache.clear();
        this._state.channelOrder = [];
        this._state.currentChannelId = null;
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
        this._contentResolver.clearCaches();
        this._state.channels = nextChannels;
        this._resolutionCache.clear();
        this._state.channelOrder = nextChannelOrder;
        this._state.currentChannelId = nextCurrentChannelId;

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
        this._emitter.emit('channelCreated', channel);

        return channel;
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
        this._emitter.emit('channelUpdated', updated);

        return updated;
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
        return this._state.channels.get(id) || null;
    }

    getAllChannels(): ChannelConfig[] {
        return this._state.channelOrder
            .map((id) => this._state.channels.get(id))
            .filter((ch): ch is ChannelConfig => ch !== undefined);
    }

    getChannelByNumber(number: number): ChannelConfig | null {
        for (const channel of this._state.channels.values()) {
            if (channel.number === number) {
                return channel;
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
        options?: { signal?: AbortSignal }
    ): Promise<ResolvedChannelContent> {
        const channel = this._state.channels.get(channelId);
        if (!channel) {
            throw createChannelNotFoundError();
        }

        const cached = this._resolutionCache.get(channelId);
        if (cached && !this._resolutionCache.isStale(cached)) {
            // Return cloned content so callers cannot mutate internal cache state.
            return this._resolutionCache.cloneContent(cached, {
                fromCache: true,
                isStale: false,
                cacheReason: 'fresh',
            });
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
        const channel = this._state.channels.get(channelId);
        if (!channel) {
            throw createChannelNotFoundError();
        }

        this._resolutionCache.delete(channelId);
        this._contentResolver.invalidateSource(channel.contentSource);
        return this._resolveContentInternal(channel, options);
    }

    /**
     * Resolve channel items for schedule generation without mutating ChannelManager state.
     * This avoids caching, event emission, and persistence side-effects.
     */
    async resolveChannelItemsForSchedule(
        channelId: string,
        options?: { signal?: AbortSignal | null }
    ): Promise<ResolvedContentItem[]> {
        const channel = this._state.channels.get(channelId);
        if (!channel) {
            throw createChannelNotFoundError();
        }

        const cached = this._resolutionCache.get(channelId);
        if (cached && !this._resolutionCache.isStale(cached)) {
            return this._resolutionCache.cloneItems(cached.items);
        }

        const items = await this._resolveFilteredItems(channel, options);
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

        // Persist current channel separately (namespaced to the active store)
        this._persistence.persistCurrentChannelId(channelId);

        const index = this._state.channelOrder.indexOf(channelId);
        this._emitter.emit('channelSwitch', { channel, index });
    }

    getCurrentChannel(): ChannelConfig | null {
        if (!this._state.currentChannelId) {
            return null;
        }
        return this._state.channels.get(this._state.currentChannelId) || null;
    }

    getNextChannel(): ChannelConfig | null {
        if (!this._state.currentChannelId || this._state.channelOrder.length === 0) {
            return null;
        }

        const currentIndex = this._state.channelOrder.indexOf(this._state.currentChannelId);
        const nextIndex = (currentIndex + 1) % this._state.channelOrder.length;
        const nextId = this._state.channelOrder[nextIndex];
        return nextId ? this._state.channels.get(nextId) || null : null;
    }

    getPreviousChannel(): ChannelConfig | null {
        if (!this._state.currentChannelId || this._state.channelOrder.length === 0) {
            return null;
        }

        const currentIndex = this._state.channelOrder.indexOf(this._state.currentChannelId);
        const prevIndex =
            (currentIndex - 1 + this._state.channelOrder.length) % this._state.channelOrder.length;
        const prevId = this._state.channelOrder[prevIndex];
        return prevId ? this._state.channels.get(prevId) || null : null;
    }


    /**
     * Export all channels as JSON string.
     */
    exportChannels(): string {
        return this._importExport.exportChannels();
    }

    /**
     * Import channels from JSON string.
     */
    async importChannels(data: string): Promise<ImportResult> {
        return this._importExport.importChannels(data);
    }


    /**
     * Flush any pending debounced save immediately.
     */
    flushSaves(): Promise<void> {
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
        this._contentResolver.clearCaches();
        this._emitter.removeAllListeners();
    }

    /**
     * Queues a debounced persistence write through the channel repository/store boundary.
     */
    saveChannels(): Promise<void> {
        return this._persistence.save(this._getPersistableState());
    }

    private _queueSave(): void {
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

    /**
     * Load channels through the channel repository/store boundary.
     */
    async loadChannels(): Promise<void> {
        try {
            const normalized = this._persistence.loadNormalized();
            if (!normalized) {
                return;
            }

            const { data, didMutate: didMutateFromNormalization } = normalized;

            this._persistence.supersedePendingSave();
            this._retryScheduler.cancelAll();
            this._contentResolver.clearCaches();
            this._resolutionCache.clear();

            // Restore state
            this._state.channels.clear();
            for (const channel of data.channels) {
                this._state.channels.set(channel.id, channel);
            }

            this._state.channelOrder = data.channelOrder;
            this._state.currentChannelId = data.currentChannelId;

            // Persist normalized/migrated channel records once.
            if (didMutateFromNormalization) {
                this._queueSave();
            }
        } catch (e) {
            this._logger.error('Failed to load channels from storage', summarizeErrorForLog(e));
        }
    }


    /**
     * Subscribe to channel manager events.
     */
    on<K extends keyof ChannelManagerEventMap>(
        event: K,
        handler: (payload: ChannelManagerEventMap[K]) => void
    ): IDisposable {
        return this._emitter.on(event, handler);
    }

    private async _resolveFilteredItems(
        channel: ChannelConfig,
        options?: { signal?: AbortSignal | null }
    ): Promise<ResolvedContentItem[]> {
        const rawItems = await this._contentResolver.resolveSource(channel.contentSource, options);

        // If source itself returns empty, it's CONTENT_UNAVAILABLE (library/collection deleted)
        // This is different from filtering removing all items
        if (rawItems.length === 0) {
            throw new ChannelError(
                AppErrorCode.CONTENT_UNAVAILABLE,
                `Content source returned no items - source may have been deleted`,
                true // recoverable with cache fallback
            );
        }

        let items = rawItems;

        // Apply filters
        if (channel.contentFilters && channel.contentFilters.length > 0) {
            items = this._contentResolver.applyFilters(items, channel.contentFilters);
        }

        // Apply sort
        if (channel.sortOrder) {
            items = this._contentResolver.applySort(items, channel.sortOrder);
        }

        // Filter out zero-duration items
        items = items.filter((item) => item.durationMs > 0);

        // Apply duration limits
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

        // If content exists but filters removed all, it's SCHEDULER_EMPTY_CHANNEL
        if (items.length === 0) {
            throw new ChannelError(
                AppErrorCode.SCHEDULER_EMPTY_CHANNEL,
                CHANNEL_ERROR_MESSAGES.EMPTY_CONTENT,
                false
            );
        }

        return items;
    }

    private _createResolvedContent(
        channel: ChannelConfig,
        items: ResolvedContentItem[]
    ): ResolvedChannelContent {
        const orderedItems = this._contentResolver.applyPlaybackMode(
            items,
            channel.playbackMode,
            (typeof channel.shuffleSeed === 'number' && Number.isFinite(channel.shuffleSeed))
                ? channel.shuffleSeed
                : fnv1a32Uint(`${channel.id}:shuffle`),
            channel.blockSize
        );

        const totalDurationMs = items.reduce((sum, item) => sum + item.durationMs, 0);
        return {
            channelId: channel.id,
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

    private _createAccessDeniedResolutionError(
        channel: ChannelConfig,
        error: unknown
    ): ChannelError {
        this._logger.warn('Access denied resolving channel content', {
            channelId: channel.id,
            contentSource: getContentSourceLogIdentity(channel.contentSource),
            httpStatus: getHttpStatusForLog(error),
            error: summarizeErrorForLog(error),
        });

        return new ChannelError(
            AppErrorCode.ACCESS_DENIED,
            `Profile does not have access to this channel's content library`,
            false
        );
    }

    private async _resolveContentForAuthoring(
        channel: ChannelConfig,
        options?: { signal?: AbortSignal | null }
    ): Promise<ResolvedChannelContent> {
        const cached = this._resolutionCache.get(channel.id);

        try {
            const items = await this._resolveFilteredItems(channel, options);
            this._retryScheduler.cancel(channel.id);
            return this._createResolvedContent(channel, items);
        } catch (error) {
            if (error instanceof ChannelError && error.code === AppErrorCode.SCHEDULER_EMPTY_CHANNEL) {
                throw error;
            }

            if (isNetworkError(error) && cached) {
                const wasStale = this._resolutionCache.isStale(cached);
                this._logger.warn(
                    `Resolution failed for channel ${channel.id} during authoring due to network error, using cached content as stale (ttlStale: ${wasStale})`,
                    summarizeErrorForLog(error)
                );
                this._retryScheduler.queue(channel.id);
                return this._resolutionCache.cloneContent(cached, {
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
                return this._resolutionCache.cloneContent(cached, {
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
        options?: { signal?: AbortSignal | null; shouldApply?: () => boolean }
    ): Promise<ResolvedChannelContent> {
        const cached = this._resolutionCache.get(channel.id);

        try {
            const items = await this._resolveFilteredItems(channel, options);
            const result = this._createResolvedContent(channel, items);

            if (options?.shouldApply && !options.shouldApply()) {
                return result;
            }

            this._retryScheduler.cancel(channel.id);

            // Cache
            this._resolutionCache.set(result);
            this._emitter.emit('contentResolved', result);

            // Issue 4: Update channel metadata after every successful resolve
            this._applyResolvedContentMetadata(channel, result);
            this._state.channels.set(channel.id, channel);

            this._queueSave();

            return this._resolutionCache.cloneContent(result);
        } catch (error) {
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
                this._logger.warn(
                    `Resolution failed for channel ${channel.id} due to network error, using cached content (stale: ${isStale})`,
                    summarizeErrorForLog(error)
                );
                this._retryScheduler.queue(channel.id);
                return this._resolutionCache.cloneContent(cached, {
                    fromCache: true,
                    isStale,
                    cacheReason: 'network_error',
                });
            }

            // Per spec: library/collection deleted should return stale cache.
            if (isGracefulAuthoringResolutionError(error) && cached) {
                this._logger.warn(
                    `Content unavailable for channel ${channel.id}, using stale cache`,
                    summarizeErrorForLog(error)
                );
                return this._resolutionCache.cloneContent(cached, {
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
                this._resolutionCache.delete(channel.id);
                this._contentResolver.invalidateSource(channel.contentSource);
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
