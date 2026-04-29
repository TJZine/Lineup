/**
 * Manages virtual TV channel CRUD, content resolution, and persistence.
 */

import { EventEmitter } from '../../../utils/EventEmitter';
import { fnv1a32Uint } from '../../../utils/hash';
import { summarizeErrorForLog } from '../../../utils/errors';
import { AppErrorCode, getAppErrorCode } from '../../../types/app-errors';
import { ContentResolver } from './ContentResolver';
import { ChannelRepository } from './ChannelRepository';
import { isValidContentSource } from './ChannelContentSourceValidator';
import {
    isValidBuildStrategy,
    isValidContentFilterArray,
    isValidPlaybackMode,
    isValidSortOrder,
} from './ChannelValueValidators';
import { STORAGE_CONFIG } from '../../lifecycle/constants';
import { TIMING_CONFIG } from '../../../config/timing';
import type { IChannelManager, ChannelManagerConfig, IPlexLibraryMinimal } from './interfaces';
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
    StoredChannelData,
    ChannelUpdateInput,
} from './types';
import {
    STORAGE_KEY,
    CURRENT_CHANNEL_KEY,
    CACHE_TTL_MS,
    MAX_CHANNELS,
    MIN_CHANNEL_NUMBER,
    MAX_CHANNEL_NUMBER,
    CHANNEL_ERROR_MESSAGES,
} from './constants';


/**
 * Channel-specific error with AppErrorCode.
 * Error handling guidance lives in repo-local docs and checklists (see `docs/`).
 */
export class ChannelError extends Error {
    public readonly code: AppErrorCode;
    public readonly recoverable: boolean;

    constructor(code: AppErrorCode, message: string, recoverable = false) {
        super(message);
        this.name = 'ChannelError';
        this.code = code;
        this.recoverable = recoverable;
    }
}

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

function createChannelContentSourceRequiredError(): ChannelError {
    return new ChannelError(
        AppErrorCode.CHANNEL_CONTENT_SOURCE_REQUIRED,
        CHANNEL_ERROR_MESSAGES.CONTENT_SOURCE_REQUIRED,
        false
    );
}

function createMaxChannelsReachedError(): ChannelError {
    return new ChannelError(
        AppErrorCode.MAX_CHANNELS_REACHED,
        CHANNEL_ERROR_MESSAGES.MAX_CHANNELS_REACHED,
        false
    );
}

function createDuplicateChannelNumberError(): ChannelError {
    return new ChannelError(
        AppErrorCode.DUPLICATE_CHANNEL_NUMBER,
        CHANNEL_ERROR_MESSAGES.DUPLICATE_CHANNEL_NUMBER,
        false
    );
}

function createInvalidChannelNumberError(): ChannelError {
    return new ChannelError(
        AppErrorCode.INVALID_CHANNEL_NUMBER,
        CHANNEL_ERROR_MESSAGES.INVALID_CHANNEL_NUMBER,
        false
    );
}

function createInvalidImportDataError(): ChannelError {
    return new ChannelError(
        AppErrorCode.INVALID_IMPORT_DATA,
        CHANNEL_ERROR_MESSAGES.INVALID_IMPORT_DATA,
        false
    );
}

function createStorageValidationError(message: string): ChannelError {
    return new ChannelError(AppErrorCode.STORAGE_VALIDATION_FAILED, message, false);
}

function createDisposedError(): ChannelError {
    return new ChannelError(AppErrorCode.CHANNEL_MANAGER_DISPOSED, 'ChannelManager disposed', false);
}

function createPersistenceFallbackError(message: string): ChannelError {
    return new ChannelError(AppErrorCode.PERSISTENCE_FALLBACK, message, true);
}

function formatImportErrorMessage(error: unknown): string {
    const summary = summarizeErrorForLog(error);
    if (typeof summary === 'string') {
        return summary;
    }
    if (summary && typeof summary === 'object') {
        if ('message' in summary && typeof summary.message === 'string') {
            return summary.message;
        }
        return JSON.stringify(summary);
    }
    return String(summary);
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
    private readonly _channelRepository: ChannelRepository;
    private readonly _logger: {
        warn: (message: string, ...args: unknown[]) => void;
        error: (message: string, ...args: unknown[]) => void;
    };

    private _state: ChannelManagerState;
    private readonly _reportedPersistenceFailures = new WeakSet<object>();
    /** Pending retry timers keyed by channel id. */
    private readonly _pendingRetries: Map<string, ReturnType<typeof setTimeout>> = new Map();
    private static readonly RETRY_DELAY_MS = 30000; // 30 seconds

    private _saveTimer: ReturnType<typeof setTimeout> | null = null;
    private _pendingSavePromise: Promise<void> | null = null;
    private _pendingSaveResolve: (() => void) | null = null;
    private _pendingSaveReject: ((error: unknown) => void) | null = null;
    private _queuedSaveCatchPromise: Promise<void> | null = null;
    private _nextPersistenceWarningAt = 0;
    private _persistenceWarningBackoffMs: number = TIMING_CONFIG.PERSISTENCE_WARNING_BACKOFF_MS;

    /**
     * Create a new ChannelManager instance.
     * @param config - Configuration with PlexLibrary instance
     */
    constructor(config: ChannelManagerConfig) {
        this._emitter = new EventEmitter<ChannelManagerEventMap>();
        this._library = config.plexLibrary;
        this._logger = config.logger || {
            warn: console.warn.bind(console),
            error: console.error.bind(console),
        };
        const initialStorageKey = ((): string => {
            if (config.storageKey === undefined) return STORAGE_KEY;
            const normalized = config.storageKey.trim();
            if (normalized.length === 0) {
                throw createStorageValidationError('Storage keys must be non-empty strings');
            }
            return normalized;
        })();

        const initialCurrentChannelKey = ((): string => {
            if (config.currentChannelKey === undefined) {
                return initialStorageKey === STORAGE_KEY
                    ? CURRENT_CHANNEL_KEY
                    : `${CURRENT_CHANNEL_KEY}:${initialStorageKey}`;
            }
            const normalized = config.currentChannelKey.trim();
            if (normalized.length === 0) {
                throw createStorageValidationError('Storage keys must be non-empty strings');
            }
            return normalized;
        })();

        this._channelRepository = new ChannelRepository(
            initialStorageKey,
            initialCurrentChannelKey,
            this._logger
        );
        this._contentResolver = new ContentResolver(this._library, this._logger);

        this._state = {
            channels: new Map(),
            resolvedContent: new Map(),
            currentChannelId: null,
            channelOrder: [],
        };
    }

    /**
     * Update persistence keys (multi-server / multi-mode support).
     * Does not implicitly load; caller should invoke loadChannels().
     */
    setStorageKeys(storageKey: string, currentChannelKey: string): void {
        const normalizedStorageKey = storageKey.trim();
        const normalizedCurrentChannelKey = currentChannelKey.trim();
        if (normalizedStorageKey.length === 0 || normalizedCurrentChannelKey.length === 0) {
            throw createStorageValidationError('Storage keys must be non-empty strings');
        }
        this.cancelPendingRetries();
        try {
            this._flushPendingSaveNow();
        } catch (error) {
            this._reportPersistenceFailure(
                'ChannelManager.setStorageKeys failed while flushing pending saves',
                error
            );
        }
        this._channelRepository.setStorageKeys(normalizedStorageKey, normalizedCurrentChannelKey);
        this._contentResolver.clearCaches();
        this._state.channels.clear();
        this._state.resolvedContent.clear();
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
        const nextChannels = new Map<string, ChannelConfig>();
        const nextChannelOrder: string[] = [];

        const availableNumbers: number[] = [];
        for (let n = MIN_CHANNEL_NUMBER; n <= MAX_CHANNEL_NUMBER; n++) {
            availableNumbers.push(n);
        }
        const usedNumbers = new Set<number>();
        const takeNextAvailable = (): number | null => {
            const next = availableNumbers.shift();
            if (next === undefined) {
                return null;
            }
            usedNumbers.add(next);
            return next;
        };

        for (const channel of channels) {
            if (!isValidContentSource(channel.contentSource)) {
                this._logger.warn(`Skipping invalid channel ${channel.name} (${channel.id}) during replaceAllChannels`);
                continue;
            }
            if (nextChannels.has(channel.id)) {
                this._logger.warn(`Skipping duplicate channel ${channel.name} (${channel.id}) during replaceAllChannels`);
                continue;
            }
            if (nextChannelOrder.length >= MAX_CHANNELS) {
                this._logger.warn(`Skipping channel ${channel.name} (${channel.id}) due to MAX_CHANNELS limit`);
                continue;
            }
            // Clone to avoid mutating caller-owned channel objects.
            const normalizedChannel: ChannelConfig = { ...channel };
            const isValidNumber =
                typeof normalizedChannel.number === 'number' &&
                Number.isInteger(normalizedChannel.number) &&
                normalizedChannel.number >= MIN_CHANNEL_NUMBER &&
                normalizedChannel.number <= MAX_CHANNEL_NUMBER &&
                !usedNumbers.has(normalizedChannel.number);
            if (isValidNumber) {
                const index = availableNumbers.indexOf(normalizedChannel.number);
                if (index >= 0) {
                    availableNumbers.splice(index, 1);
                }
                usedNumbers.add(normalizedChannel.number);
            } else {
                const fallback = takeNextAvailable();
                if (fallback === null) {
                    this._logger.warn(`Skipping channel ${channel.name} (${channel.id}) due to number exhaustion`);
                    continue;
                }
                normalizedChannel.number = fallback;
            }
            // Normalize seeds so imported channels behave like newly created ones.
            // This prevents nondeterministic shuffle order / missing live-drift until next app restart.
            if (typeof normalizedChannel.shuffleSeed !== 'number' || !Number.isFinite(normalizedChannel.shuffleSeed)) {
                normalizedChannel.shuffleSeed = fnv1a32Uint(`${normalizedChannel.id}:shuffle`);
            }
            if (typeof normalizedChannel.phaseSeed !== 'number' || !Number.isFinite(normalizedChannel.phaseSeed)) {
                normalizedChannel.phaseSeed = fnv1a32Uint(`${normalizedChannel.id}:phase`);
            }
            nextChannels.set(normalizedChannel.id, normalizedChannel);
            nextChannelOrder.push(normalizedChannel.id);
        }

        const requestedCurrent = options?.currentChannelId ?? null;
        const fallbackCurrent = nextChannelOrder[0] ?? null;
        const nextCurrentChannelId =
            requestedCurrent && nextChannels.has(requestedCurrent)
                ? requestedCurrent
                : fallbackCurrent;

        try {
            this._persistStoredChannelData({
                channels: Array.from(nextChannels.values()),
                channelOrder: nextChannelOrder,
                currentChannelId: nextCurrentChannelId,
                savedAt: Date.now(),
            });
            this._onPersistenceSuccess();
        } catch (error) {
            this._reportPersistenceFailure(
                'ChannelManager.replaceAllChannels failed to persist channels',
                error
            );
            throw error;
        }

        this.cancelPendingRetries();
        this._contentResolver.clearCaches();
        this._state.channels = nextChannels;
        this._state.resolvedContent.clear();
        this._state.channelOrder = nextChannelOrder;
        this._state.currentChannelId = nextCurrentChannelId;

        if (this._state.currentChannelId) {
            try {
                const result = this._channelRepository.saveCurrentChannelId(this._state.currentChannelId);
                if (!result.ok) {
                    if (result.reason === 'quota-exceeded') {
                        throw new ChannelError(
                            AppErrorCode.STORAGE_QUOTA_EXCEEDED,
                            STORAGE_CONFIG.STORAGE_QUOTA_EXCEEDED,
                            true
                        );
                    }
                    throw createPersistenceFallbackError('Failed to persist current channel');
                }
            } catch (e) {
                this._logger.warn('Failed to persist current channel', summarizeErrorForLog(e));
                this._emitPersistenceWarning(e);
            }
        }
    }


    /**
     * Create a new channel with default values for missing fields.
     * @param config - Partial channel configuration
     * @returns Promise resolving to complete channel config
     */
    async createChannel(
        config: ChannelCreateInput,
        options?: { signal?: AbortSignal | null; initialContent?: ResolvedContentItem[] | undefined }
    ): Promise<ChannelConfig> {
        if (!config.contentSource) {
            throw createChannelContentSourceRequiredError();
        }

        // Check max channels
        if (this._state.channels.size >= MAX_CHANNELS) {
            throw createMaxChannelsReachedError();
        }

        let channelNumber: number;
        if (typeof config.number === 'number') {
            this._validateChannelNumber(config.number);
            if (this._isChannelNumberInUse(config.number)) {
                throw createDuplicateChannelNumberError();
            }
            channelNumber = config.number;
        } else {
            channelNumber = this._getNextAvailableNumber();
        }

        const channel: ChannelConfig = {
            id: generateUUID(),
            number: channelNumber,
            name:
                typeof config.name === 'string' && config.name.length > 0
                    ? config.name
                    : `Channel ${channelNumber}`,
            contentSource: config.contentSource,
            playbackMode: config.playbackMode || 'sequential',
            startTimeAnchor:
                typeof config.startTimeAnchor === 'number'
                    ? config.startTimeAnchor
                    : Date.now(),
            skipIntros: config.skipIntros === true,
            skipCredits: config.skipCredits === true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lastContentRefresh: 0,
            itemCount: 0,
            totalDurationMs: 0,
        };

        // Add optional properties only if defined
        if (config.description !== undefined) channel.description = config.description;
        if (config.isAutoGenerated !== undefined) channel.isAutoGenerated = config.isAutoGenerated;
        if (config.icon !== undefined) channel.icon = config.icon;
        if (config.color !== undefined) channel.color = config.color;
        if (config.buildStrategy !== undefined) channel.buildStrategy = config.buildStrategy;
        if (config.sourceLibraryId !== undefined) channel.sourceLibraryId = config.sourceLibraryId;
        if (config.sourceLibraryName !== undefined) channel.sourceLibraryName = config.sourceLibraryName;
        if (typeof config.lineupReplicaIndex === 'number' && Number.isFinite(config.lineupReplicaIndex)) {
            channel.lineupReplicaIndex = Math.max(0, Math.floor(config.lineupReplicaIndex));
        }
        if (typeof config.isPlaybackModeVariant === 'boolean') {
            channel.isPlaybackModeVariant = config.isPlaybackModeVariant;
        }
        if (typeof config.shuffleSeed === 'number' && Number.isFinite(config.shuffleSeed)) {
            channel.shuffleSeed = config.shuffleSeed;
        } else {
            channel.shuffleSeed = fnv1a32Uint(`${channel.id}:shuffle`);
        }
        if (typeof config.phaseSeed === 'number' && Number.isFinite(config.phaseSeed)) {
            channel.phaseSeed = config.phaseSeed;
        } else {
            channel.phaseSeed = fnv1a32Uint(`${channel.id}:phase`);
        }
        if (
            channel.playbackMode === 'block'
            && typeof config.blockSize === 'number'
            && Number.isFinite(config.blockSize)
        ) {
            channel.blockSize = Math.max(1, Math.floor(config.blockSize));
        }
        if (config.contentFilters !== undefined) channel.contentFilters = config.contentFilters;
        if (config.sortOrder !== undefined) channel.sortOrder = config.sortOrder;
        if (config.maxEpisodeRunTimeMs !== undefined) channel.maxEpisodeRunTimeMs = config.maxEpisodeRunTimeMs;
        if (config.minEpisodeRunTimeMs !== undefined) channel.minEpisodeRunTimeMs = config.minEpisodeRunTimeMs;

        let resolvedContent: ResolvedChannelContent | null = null;
        let shouldEmitContentResolved = false;

        try {
            if (options?.initialContent) {
                channel.itemCount = options.initialContent.length;
                channel.totalDurationMs = options.initialContent.reduce((sum, item) => sum + item.durationMs, 0);
                channel.lastContentRefresh = Date.now();
                resolvedContent = {
                    items: options.initialContent,
                    orderedItems: options.initialContent,
                    totalDurationMs: channel.totalDurationMs,
                    channelId: channel.id,
                    resolvedAt: channel.lastContentRefresh
                };
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
            this._state.resolvedContent.set(channel.id, resolvedContent);
            if (shouldEmitContentResolved) {
                this._emitter.emit('contentResolved', resolvedContent);
            }
        }

        // Persist and emit event
        this._queueSave();
        this._emitter.emit('channelCreated', channel);

        return channel;
    }

    /**
     * Update an existing channel.
     * @param id - Channel ID
     * @param updates - Partial updates to apply
     * @returns Promise resolving to updated channel config
     */
    async updateChannel(id: string, updates: ChannelUpdateInput): Promise<ChannelConfig> {
        const channel = this._state.channels.get(id);
        if (!channel) {
            throw createChannelNotFoundError();
        }

        if (typeof updates.number === 'number' && updates.number !== channel.number) {
            this._validateChannelNumber(updates.number);
            if (this._isChannelNumberInUse(updates.number)) {
                throw createDuplicateChannelNumberError();
            }
        }

        // Apply updates
        const updated: ChannelConfig = {
            ...channel,
            ...updates,
            id: channel.id,
            createdAt: channel.createdAt,
            updatedAt: Date.now(),
            lastContentRefresh: channel.lastContentRefresh,
            itemCount: channel.itemCount,
            totalDurationMs: channel.totalDurationMs,
        };

        let resolvedContent: ResolvedChannelContent | null = null;

        if (affectsResolvedContent(updates)) {
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
            this._state.resolvedContent.set(id, resolvedContent);
            if (!resolvedContent.fromCache) {
                this._emitter.emit('contentResolved', resolvedContent);
            }
        }

        // Persist and emit event
        this._queueSave();
        this._emitter.emit('channelUpdated', updated);

        return updated;
    }

    /**
     * Delete a channel.
     * @param id - Channel ID to delete
     */
    async deleteChannel(id: string): Promise<void> {
        if (!this._state.channels.has(id)) {
            throw createChannelNotFoundError();
        }

        this._state.channels.delete(id);
        this._state.resolvedContent.delete(id);
        this._state.channelOrder = this._state.channelOrder.filter((cid) => cid !== id);

        if (this._state.currentChannelId === id) {
            this._state.currentChannelId =
                this._state.channelOrder.length > 0 ? this._state.channelOrder[0]! : null;
        }

        // Persist and emit event
        this._queueSave();
        this._emitter.emit('channelDeleted', id);
    }


    /**
     * Get a channel by ID.
     */
    getChannel(id: string): ChannelConfig | null {
        return this._state.channels.get(id) || null;
    }

    /**
     * Get all channels in order.
     */
    getAllChannels(): ChannelConfig[] {
        return this._state.channelOrder
            .map((id) => this._state.channels.get(id))
            .filter((ch): ch is ChannelConfig => ch !== undefined);
    }

    /**
     * Get a channel by its display number.
     */
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

        // Check cache
        const cached = this._state.resolvedContent.get(channelId);
        if (cached && !this._isStale(cached)) {
            // Return cloned content so callers cannot mutate internal cache state.
            return this._cloneResolvedContent(cached, {
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

        this._state.resolvedContent.delete(channelId);
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

        const cached = this._state.resolvedContent.get(channelId);
        if (cached && !this._isStale(cached)) {
            return this._cloneResolvedItems(cached.items);
        }

        const items = await this._resolveFilteredItems(channel, options);
        return this._cloneResolvedItems(items);
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

    /**
     * Set the current active channel.
     */
    setCurrentChannel(channelId: string): void {
        const channel = this._state.channels.get(channelId);
        if (!channel) {
            throw createChannelNotFoundError();
        }

        this._state.currentChannelId = channelId;

        // Persist current channel separately (namespaced to the active store)
        try {
            const result = this._channelRepository.saveCurrentChannelId(channelId);
            if (!result.ok) {
                if (result.reason === 'quota-exceeded') {
                    throw new ChannelError(
                        AppErrorCode.STORAGE_QUOTA_EXCEEDED,
                        STORAGE_CONFIG.STORAGE_QUOTA_EXCEEDED,
                        true
                    );
                }
                throw createPersistenceFallbackError('Failed to persist current channel');
            }
            this._onPersistenceSuccess();
        } catch (e) {
            this._logger.warn('Failed to persist current channel', summarizeErrorForLog(e));
            this._emitPersistenceWarning(e);
        }

        const index = this._state.channelOrder.indexOf(channelId);
        this._emitter.emit('channelSwitch', { channel, index });
    }

    /**
     * Get the current active channel.
     */
    getCurrentChannel(): ChannelConfig | null {
        if (!this._state.currentChannelId) {
            return null;
        }
        return this._state.channels.get(this._state.currentChannelId) || null;
    }

    /**
     * Get the next channel in order.
     */
    getNextChannel(): ChannelConfig | null {
        if (!this._state.currentChannelId || this._state.channelOrder.length === 0) {
            return null;
        }

        const currentIndex = this._state.channelOrder.indexOf(this._state.currentChannelId);
        const nextIndex = (currentIndex + 1) % this._state.channelOrder.length;
        const nextId = this._state.channelOrder[nextIndex];
        return nextId ? this._state.channels.get(nextId) || null : null;
    }

    /**
     * Get the previous channel in order.
     */
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
        const channels = this.getAllChannels();
        return JSON.stringify(channels, null, 2);
    }

    /**
     * Import channels from JSON string.
     */
    async importChannels(data: string): Promise<ImportResult> {
        const result: ImportResult = {
            success: false,
            importedCount: 0,
            skippedCount: 0,
            errors: [],
        };

        let parsed: unknown;
        try {
            parsed = JSON.parse(data);
        } catch {
            result.errors.push(CHANNEL_ERROR_MESSAGES.INVALID_IMPORT_DATA);
            return result;
        }

        if (!Array.isArray(parsed)) {
            result.errors.push(CHANNEL_ERROR_MESSAGES.INVALID_IMPORT_DATA);
            return result;
        }

        for (const item of parsed) {
            if (!this._isValidChannelImport(item)) {
                result.skippedCount++;
                continue;
            }

            try {
                const channelData = this._buildImportedChannelCreateInput(item);

                if (
                    typeof channelData.number === 'number' &&
                    this._isChannelNumberInUse(channelData.number)
                ) {
                    channelData.number = this._getNextAvailableNumber();
                }

                await this.createChannel(channelData);
                result.importedCount++;
            } catch (e) {
                result.skippedCount++;
                result.errors.push(`Failed to import channel: ${formatImportErrorMessage(e)}`);
            }
        }

        result.success = result.importedCount > 0;
        return result;
    }


    /**
     * Flush any pending debounced save immediately.
     */
    flushSaves(): Promise<void> {
        try {
            this._flushPendingSaveNow();
            return Promise.resolve();
        } catch (error) {
            return Promise.reject(error);
        }
    }

    dispose(): void {
        this.cancelPendingRetries();
        if (this._saveTimer) {
            clearTimeout(this._saveTimer);
            this._saveTimer = null;
        }
        // Teardown is expected; do not treat cancellation as a persistence failure.
        // Rejecting the pending save also clears internal promise state + queued catch tracking.
        const disposedError = createDisposedError();
        this._markPersistenceFailureReported(disposedError);
        this._rejectPendingSave(disposedError);
        this._contentResolver.clearCaches();
        this._emitter.removeAllListeners();
    }

    /**
     * Queues a debounced persistence write through the channel repository/store boundary.
     */
    saveChannels(): Promise<void> {
        const pendingSave = this._ensurePendingSavePromise();
        if (this._saveTimer) {
            clearTimeout(this._saveTimer);
        }

        // Debounce by 500ms to batch all closely related saves
        this._saveTimer = setTimeout(() => {
            this._saveTimer = null;
            try {
                this._runPendingSaveNow();
            } catch {
                // Errors are propagated to pending promise and handled by callers.
            }
        }, TIMING_CONFIG.SAVE_DEBOUNCE_MS);

        return pendingSave;
    }

    private _ensurePendingSavePromise(): Promise<void> {
        if (this._pendingSavePromise) {
            return this._pendingSavePromise;
        }
        this._pendingSavePromise = new Promise((resolve, reject) => {
            this._pendingSaveResolve = resolve;
            this._pendingSaveReject = reject;
        });
        return this._pendingSavePromise;
    }

    private _clearPendingSavePromise(): void {
        this._pendingSavePromise = null;
        this._pendingSaveResolve = null;
        this._pendingSaveReject = null;
        this._queuedSaveCatchPromise = null;
    }

    private _resolvePendingSave(): void {
        const resolve = this._pendingSaveResolve;
        this._clearPendingSavePromise();
        if (resolve) {
            resolve();
        }
    }

    private _rejectPendingSave(error: unknown): void {
        const reject = this._pendingSaveReject;
        this._clearPendingSavePromise();
        if (reject) {
            reject(error);
        }
    }

    private _runPendingSaveNow(): void {
        try {
            this._performSaveSync();
            this._onPersistenceSuccess();
            this._resolvePendingSave();
        } catch (error) {
            this._rejectPendingSave(error);
            throw error;
        }
    }

    private _flushPendingSaveNow(): void {
        if (!this._saveTimer) {
            return;
        }

        clearTimeout(this._saveTimer);
        this._saveTimer = null;
        this._runPendingSaveNow();
    }

    private _queueSave(): void {
        const pendingSave = this.saveChannels();
        if (this._queuedSaveCatchPromise === pendingSave) {
            return;
        }
        this._queuedSaveCatchPromise = pendingSave;
        void pendingSave.catch((error) => {
            if (this._wasPersistenceFailureReported(error)) {
                return;
            }
            this._markPersistenceFailureReported(error);

            const didEmitWarning = this._emitPersistenceWarning(error);
            const isQuotaError =
                (error instanceof ChannelError && error.code === AppErrorCode.STORAGE_QUOTA_EXCEEDED) ||
                this._isQuotaExceeded(error);
            const summary = summarizeErrorForLog(error);

            if (isQuotaError) {
                // Quota errors are expected and user-facing; keep logs quiet and throttled.
                if (didEmitWarning) {
                    this._logger.warn('Debounced save failed (quota)', summary);
                }
                return;
            }

            // Unexpected failures should remain error-level, but avoid spamming logs on rapid repeats.
            if (didEmitWarning) {
                this._logger.error('Debounced save failed', summary);
            }
        });
    }

    private _shouldEmitPersistenceWarning(isQuotaError: boolean): boolean {
        const now = Date.now();
        if (now < this._nextPersistenceWarningAt) {
            return false;
        }
        const backoff = isQuotaError
            ? this._persistenceWarningBackoffMs
            : TIMING_CONFIG.PERSISTENCE_WARNING_BACKOFF_MS;
        this._nextPersistenceWarningAt = now + backoff;
        if (isQuotaError) {
            this._persistenceWarningBackoffMs = Math.min(
                this._persistenceWarningBackoffMs * 2,
                TIMING_CONFIG.PERSISTENCE_WARNING_MAX_BACKOFF_MS
            );
        } else {
            // Non-quota warnings are a different failure class than quota exhaustion.
            // Reset any quota-driven exponential backoff to the baseline so we don't suppress
            // future warnings due to stale quota backoff state (mirrors _onPersistenceSuccess()).
            this._persistenceWarningBackoffMs = TIMING_CONFIG.PERSISTENCE_WARNING_BACKOFF_MS;
        }
        return true;
    }

    private _emitPersistenceWarning(error: unknown): boolean {
        const isQuotaError =
            (error instanceof ChannelError && error.code === AppErrorCode.STORAGE_QUOTA_EXCEEDED) ||
            this._isQuotaExceeded(error);
        if (!this._shouldEmitPersistenceWarning(isQuotaError)) {
            return false;
        }
        const code = isQuotaError
            ? AppErrorCode.STORAGE_QUOTA_EXCEEDED
            : (getErrorCode(error) ?? AppErrorCode.UNKNOWN);
        this._emitter.emit('persistenceWarning', {
            message: isQuotaError
                ? STORAGE_CONFIG.STORAGE_QUOTA_EXCEEDED
                : 'Failed to persist channels; some changes may not be saved',
            code,
            isQuotaError,
            timestamp: Date.now(),
        });
        return true;
    }

    private _reportPersistenceFailure(message: string, error: unknown): void {
        this._markPersistenceFailureReported(error);

        const didEmitWarning = this._emitPersistenceWarning(error);
        const isQuotaError =
            (error instanceof ChannelError && error.code === AppErrorCode.STORAGE_QUOTA_EXCEEDED) ||
            this._isQuotaExceeded(error);
        const summary = summarizeErrorForLog(error);

        if (isQuotaError) {
            // Quota errors are common on TVs; avoid log spam by tying logs to the same backoff as the warning.
            if (didEmitWarning) {
                this._logger.warn(message, summary);
            }
            return;
        }

        this._logger.error(message, summary);
    }

    private _onPersistenceSuccess(): void {
        this._nextPersistenceWarningAt = 0;
        this._persistenceWarningBackoffMs = TIMING_CONFIG.PERSISTENCE_WARNING_BACKOFF_MS;
    }

    private _markPersistenceFailureReported(error: unknown): void {
        if (error && (typeof error === 'object' || typeof error === 'function')) {
            this._reportedPersistenceFailures.add(error as object);
        }
    }

    private _wasPersistenceFailureReported(error: unknown): boolean {
        if (!error || (typeof error !== 'object' && typeof error !== 'function')) {
            return false;
        }
        return this._reportedPersistenceFailures.has(error as object);
    }

    private _performSaveSync(): void {
        const data: StoredChannelData = {
            channels: Array.from(this._state.channels.values()),
            channelOrder: this._state.channelOrder,
            currentChannelId: this._state.currentChannelId,
            savedAt: Date.now(),
        };

        this._persistStoredChannelData(data);
    }

    private _persistStoredChannelData(data: StoredChannelData): void {
        const writeResult = this._channelRepository.saveStoredChannelData(data);

        if (!writeResult.ok && writeResult.reason === 'quota-exceeded') {
            throw new ChannelError(
                AppErrorCode.STORAGE_QUOTA_EXCEEDED,
                STORAGE_CONFIG.STORAGE_QUOTA_EXCEEDED,
                true
            );
        }
        if (!writeResult.ok && writeResult.reason === 'unavailable') {
            throw createPersistenceFallbackError('Failed to persist channels to storage');
        }
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
            const normalized = this._channelRepository.loadNormalized();
            if (!normalized) {
                return;
            }

            const { data, didMutate: didMutateFromNormalization } = normalized;

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


    private _cloneResolvedItem(item: ResolvedContentItem): ResolvedContentItem {
        const cloned: ResolvedContentItem = { ...item };
        if (item.genres) {
            cloned.genres = [...item.genres];
        }
        if (item.directors) {
            cloned.directors = [...item.directors];
        }
        if (item.mediaInfo) {
            cloned.mediaInfo = { ...item.mediaInfo };
        }
        return cloned;
    }

    private _cloneResolvedItems(items: ResolvedContentItem[]): ResolvedContentItem[] {
        return items.map((item) => this._cloneResolvedItem(item));
    }

    private _cloneResolvedContent(
        content: ResolvedChannelContent,
        overrides?: Partial<Pick<ResolvedChannelContent, 'fromCache' | 'isStale' | 'cacheReason'>>
    ): ResolvedChannelContent {
        const cloned: ResolvedChannelContent = {
            ...content,
            items: this._cloneResolvedItems(content.items),
            orderedItems: this._cloneResolvedItems(content.orderedItems),
        };
        const fromCache = overrides?.fromCache ?? content.fromCache;
        const isStale = overrides?.isStale ?? content.isStale;
        const cacheReason = overrides?.cacheReason ?? content.cacheReason;
        if (fromCache !== undefined) {
            cloned.fromCache = fromCache;
        }
        if (isStale !== undefined) {
            cloned.isStale = isStale;
        }
        if (cacheReason !== undefined) {
            cloned.cacheReason = cacheReason;
        }
        return cloned;
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
        const cached = this._state.resolvedContent.get(channel.id);

        try {
            const items = await this._resolveFilteredItems(channel, options);
            return this._createResolvedContent(channel, items);
        } catch (error) {
            if (error instanceof ChannelError && error.code === AppErrorCode.SCHEDULER_EMPTY_CHANNEL) {
                throw error;
            }

            if (isNetworkError(error) && cached) {
                const wasStale = this._isStale(cached);
                this._logger.warn(
                    `Resolution failed for channel ${channel.id} during authoring due to network error, using cached content as stale (ttlStale: ${wasStale})`,
                    summarizeErrorForLog(error)
                );
                this._queueRetry(channel.id);
                return this._cloneResolvedContent(cached, {
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
                return this._cloneResolvedContent(cached, {
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
        options?: { signal?: AbortSignal | null }
    ): Promise<ResolvedChannelContent> {
        const cached = this._state.resolvedContent.get(channel.id);

        try {
            const items = await this._resolveFilteredItems(channel, options);

            const result = this._createResolvedContent(channel, items);

            // Cache
            this._state.resolvedContent.set(channel.id, result);
            this._emitter.emit('contentResolved', result);

            // Issue 4: Update channel metadata after every successful resolve
            this._applyResolvedContentMetadata(channel, result);
            this._state.channels.set(channel.id, channel);

            this._queueSave();

            return this._cloneResolvedContent(result);
        } catch (error) {
            // Cache fallback is allowed for network errors and graceful source-unavailable errors.
            // SCHEDULER_EMPTY_CHANNEL and other non-network errors should propagate
            if (error instanceof ChannelError && error.code === AppErrorCode.SCHEDULER_EMPTY_CHANNEL) {
                // No fallback for empty content - throw directly
                throw error;
            }

            if (isNetworkError(error) && cached) {
                const isStale = this._isStale(cached);
                this._logger.warn(
                    `Resolution failed for channel ${channel.id} due to network error, using cached content (stale: ${isStale})`,
                    summarizeErrorForLog(error)
                );
                this._queueRetry(channel.id);
                return this._cloneResolvedContent(cached, {
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
                return this._cloneResolvedContent(cached, {
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
                this._state.resolvedContent.delete(channel.id);
                this._contentResolver.invalidateSource(channel.contentSource);

                const pendingRetry = this._pendingRetries.get(channel.id);
                if (pendingRetry) {
                    clearTimeout(pendingRetry);
                    this._pendingRetries.delete(channel.id);
                }

                throw this._createAccessDeniedResolutionError(channel, error);
            }

            // No cache fallback for other errors - re-throw
            throw error;
        }
    }

    private _isStale(content: ResolvedChannelContent): boolean {
        return content.isStale === true || Date.now() - content.resolvedAt > CACHE_TTL_MS;
    }

    private _validateChannelNumber(number: number): void {
        if (
            !Number.isInteger(number) ||
            number < MIN_CHANNEL_NUMBER ||
            number > MAX_CHANNEL_NUMBER
        ) {
            throw createInvalidChannelNumberError();
        }
    }

    private _isChannelNumberInUse(number: number): boolean {
        for (const channel of this._state.channels.values()) {
            if (channel.number === number) {
                return true;
            }
        }
        return false;
    }

    private _getNextAvailableNumber(): number {
        const usedNumbers = new Set<number>();
        for (const channel of this._state.channels.values()) {
            usedNumbers.add(channel.number);
        }

        for (let n = MIN_CHANNEL_NUMBER; n <= MAX_CHANNEL_NUMBER; n++) {
            if (!usedNumbers.has(n)) {
                return n;
            }
        }

        // Fallback (should never reach due to MAX_CHANNELS check)
        return this._state.channels.size + 1;
    }

    private _isQuotaExceeded(error: unknown): boolean {
        return (
            typeof DOMException !== 'undefined' &&
            error instanceof DOMException &&
            (error.code === 22 ||
                error.code === 1014 ||
                error.name === 'QuotaExceededError' ||
                error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
        );
    }

    private _isValidChannelImport(item: unknown): boolean {
        if (!item || typeof item !== 'object') {
            return false;
        }

        const obj = item as Record<string, unknown>;

        return isValidContentSource(obj['contentSource']);
    }

    private _buildImportedChannelCreateInput(item: unknown): ChannelCreateInput {
        const record = item as Record<string, unknown>;
        const contentSource = record['contentSource'];
        if (!isValidContentSource(contentSource)) {
            throw createInvalidImportDataError();
        }

        const channel: ChannelCreateInput = {
            contentSource,
        };

        if (
            typeof record['number'] === 'number' &&
            Number.isInteger(record['number'])
        ) {
            channel.number = record['number'];
        }
        if (typeof record['name'] === 'string') {
            channel.name = record['name'];
        }
        if (typeof record['description'] === 'string') {
            channel.description = record['description'];
        }
        if (typeof record['isAutoGenerated'] === 'boolean') {
            channel.isAutoGenerated = record['isAutoGenerated'];
        }
        if (typeof record['icon'] === 'string') {
            channel.icon = record['icon'];
        }
        if (typeof record['color'] === 'string') {
            channel.color = record['color'];
        }
        if (isValidBuildStrategy(record['buildStrategy'])) {
            channel.buildStrategy = record['buildStrategy'];
        }
        if (typeof record['sourceLibraryId'] === 'string') {
            channel.sourceLibraryId = record['sourceLibraryId'];
        }
        if (typeof record['sourceLibraryName'] === 'string') {
            channel.sourceLibraryName = record['sourceLibraryName'];
        }
        if (typeof record['lineupReplicaIndex'] === 'number' && Number.isFinite(record['lineupReplicaIndex'])) {
            channel.lineupReplicaIndex = record['lineupReplicaIndex'];
        }
        if (typeof record['isPlaybackModeVariant'] === 'boolean') {
            channel.isPlaybackModeVariant = record['isPlaybackModeVariant'];
        }
        const playbackMode = isValidPlaybackMode(record['playbackMode'])
            ? record['playbackMode']
            : undefined;
        if (playbackMode !== undefined) {
            channel.playbackMode = playbackMode;
        }
        if (typeof record['shuffleSeed'] === 'number' && Number.isFinite(record['shuffleSeed'])) {
            channel.shuffleSeed = record['shuffleSeed'];
        }
        if (
            playbackMode === 'block'
            && typeof record['blockSize'] === 'number'
            && Number.isFinite(record['blockSize'])
        ) {
            channel.blockSize = record['blockSize'];
        }
        if (typeof record['phaseSeed'] === 'number' && Number.isFinite(record['phaseSeed'])) {
            channel.phaseSeed = record['phaseSeed'];
        }
        if (typeof record['startTimeAnchor'] === 'number' && Number.isFinite(record['startTimeAnchor'])) {
            channel.startTimeAnchor = record['startTimeAnchor'];
        }
        if (isValidContentFilterArray(record['contentFilters'])) {
            channel.contentFilters = record['contentFilters'];
        }
        if (isValidSortOrder(record['sortOrder'])) {
            channel.sortOrder = record['sortOrder'];
        }
        if (typeof record['skipIntros'] === 'boolean') {
            channel.skipIntros = record['skipIntros'];
        }
        if (typeof record['skipCredits'] === 'boolean') {
            channel.skipCredits = record['skipCredits'];
        }
        if (
            typeof record['maxEpisodeRunTimeMs'] === 'number'
            && Number.isFinite(record['maxEpisodeRunTimeMs'])
        ) {
            channel.maxEpisodeRunTimeMs = record['maxEpisodeRunTimeMs'];
        }
        if (
            typeof record['minEpisodeRunTimeMs'] === 'number'
            && Number.isFinite(record['minEpisodeRunTimeMs'])
        ) {
            channel.minEpisodeRunTimeMs = record['minEpisodeRunTimeMs'];
        }

        return channel;
    }

    /**
     * Queue a retry for network errors.
     * Implements spec requirement to retry failed content resolution.
     */
    private _queueRetry(channelId: string): void {
        // Don't queue if already pending
        if (this._pendingRetries.has(channelId)) {
            return;
        }

        const timeout = setTimeout(() => {
            this._pendingRetries.delete(channelId);
            this._executeRetry(channelId);
        }, ChannelManager.RETRY_DELAY_MS);

        this._pendingRetries.set(channelId, timeout);
    }

    /**
     * Execute a queued retry for a channel.
     */
    private _executeRetry(channelId: string): void {
        const channel = this._state.channels.get(channelId);
        if (!channel) {
            return;
        }

        this._resolveContentInternal(channel)
            .then(() => {
                this._logger.warn(`Retry succeeded for channel ${channelId}`);
            })
            .catch((error) => {
                this._logger.warn(`Retry failed for channel ${channelId}`, summarizeErrorForLog(error));
                // Could implement exponential backoff here if needed
            });
    }

    /**
     * Cancel any pending retries (useful for cleanup).
     */
    private cancelPendingRetries(): void {
        for (const timeout of this._pendingRetries.values()) {
            clearTimeout(timeout);
        }
        this._pendingRetries.clear();
    }
}
