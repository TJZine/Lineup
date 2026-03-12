/**
 * @fileoverview Coordinates channel setup workflow and builds channel lineup.
 * @module core/channel-setup/ChannelSetupCoordinator
 * @version 1.0.0
 */

import { ChannelManager } from '../../modules/scheduler/channel-manager';
import type { IChannelManager, ChannelConfig } from '../../modules/scheduler/channel-manager';
import type { IPlexLibrary, PlexLibraryType, PlexMediaItem, LibraryQueryOptions, PlexTagDirectoryItem, PlexPlaylist, PlexCollection } from '../../modules/plex/library';
import { PLEX_MEDIA_TYPES } from '../../modules/plex/library';
import type { INavigationManager } from '../../modules/navigation';
import type { AppError } from '../../modules/lifecycle';
import { DEFAULT_CHANNEL_SETUP_MAX, MAX_CHANNELS, MAX_CHANNEL_NUMBER } from '../../modules/scheduler/channel-manager/constants';
import { redactSensitiveTokens } from '../../utils/redact';
import { safeLocalStorageRemoveByPrefixes } from '../../utils/storage';

import type {
    ChannelSetupConfig,
    ChannelSetupContext,
    ChannelBuildSummary,
    ChannelBuildProgress,
    ChannelSetupRecord,
    ChannelSetupPreview,
    ChannelSetupReview,
    SetupStrategyKey,
    SetupStrategyConfig,
    ChannelExpansionConfig,
    SeriesOrderingConfig,
} from './types';
import {
    buildChannelSetupPlan,
    diffChannelPlans,
    createChannelIdentityKey,
    type PendingChannel,
    type ChannelDiffResult,
} from './ChannelSetupPlanner';
import {
    DEFAULT_CHANNEL_EXPANSION,
    DEFAULT_MIN_ITEMS_PER_CHANNEL,
    DEFAULT_SERIES_ORDERING,
    DEFAULT_STRATEGY_PRIORITIES,
    MIXED_SCOPE_STRATEGY_KEYS,
    SETUP_STRATEGY_KEYS,
} from './constants';

const SELECTABLE_STRATEGY_KEYS: SetupStrategyKey[] = [...SETUP_STRATEGY_KEYS];

export interface ChannelSetupCoordinatorDeps {
    // Primary modules
    plexLibrary: IPlexLibrary;
    channelManager: IChannelManager;
    navigation: INavigationManager;

    // Server + storage
    getSelectedServerId: () => string | null;
    storageGet: (key: string) => string | null;
    storageSet: (key: string, value: string) => void;
    storageRemove: (key: string) => void;

    // Orchestrator hooks
    handleGlobalError: (error: AppError, context: string) => void;

    // EPG hooks (do not inject the whole epg coordinator object)
    primeEpgChannels: () => void;
    refreshEpgSchedules: (options?: { reason?: string; debounceMs?: number }) => Promise<void>;

    // Channel manager storage configuration already exists in Orchestrator; we do not move it in this slice.
    // Rerun flag storage remains in-memory in this coordinator (not in localStorage).
}

export class ChannelSetupCoordinator {
    private _channelSetupRerunRequested = false;

    constructor(private readonly deps: ChannelSetupCoordinatorDeps) { }

    // --- Public API mirrored from AppOrchestrator ---
    async getLibrariesForSetup(signal?: AbortSignal | null): Promise<PlexLibraryType[]> {
        const plexLibrary = this.deps.plexLibrary;
        const libraries = await plexLibrary.getLibraries({
            signal: signal ?? null,
            includeItemCounts: true,
            itemCountConcurrency: 4,
        });
        return libraries.filter((lib) => lib.type === 'movie' || lib.type === 'show');
    }

    getSetupRecord(serverId: string): ChannelSetupRecord | null {
        return this._getChannelSetupRecord(serverId);
    }

    getSetupContextForSelectedServer(): ChannelSetupContext {
        const channelManager = this.deps.channelManager;
        const serverId = this.deps.getSelectedServerId();
        if (!serverId) {
            return 'unknown';
        }
        return channelManager.getAllChannels().length === 0 ? 'first-time' : 'existing';
    }

    async getSetupPreview(
        config: ChannelSetupConfig,
        options?: { signal?: AbortSignal }
    ): Promise<ChannelSetupPreview> {
        const normalizedConfig = this._normalizeConfig(config);
        const libraries = await this.getLibrariesForSetup(options?.signal ?? null);
        const planResult = await this._buildSetupPlan(normalizedConfig, libraries, options?.signal ?? null);
        if (planResult.canceled || !planResult.plan) {
            return {
                estimates: this._emptyEstimates(),
                warnings: [],
                reachedMaxChannels: false,
            };
        }
        return {
            estimates: planResult.plan.estimates,
            warnings: planResult.plan.warnings,
            reachedMaxChannels: planResult.plan.reachedMaxChannels,
        };
    }

    async getSetupReview(
        config: ChannelSetupConfig,
        options?: { signal?: AbortSignal }
    ): Promise<ChannelSetupReview> {
        const channelManager = this.deps.channelManager;
        const normalizedConfig = this._normalizeConfig(config);
        const libraries = await this.getLibrariesForSetup(options?.signal ?? null);
        const planResult = await this._buildSetupPlan(normalizedConfig, libraries, options?.signal ?? null);
        if (planResult.canceled || !planResult.plan) {
            return {
                preview: { estimates: this._emptyEstimates(), warnings: [], reachedMaxChannels: false },
                diff: { summary: { created: 0, removed: 0, unchanged: 0 }, samples: { created: [], removed: [], unchanged: [] } },
            };
        }
        const existingChannels = channelManager.getAllChannels();
        const diff = diffChannelPlans(existingChannels, planResult.plan.pendingChannels);
        const normalizedDiff = this._normalizeDiffForMode(diff, normalizedConfig.buildMode);
        return {
            preview: {
                estimates: planResult.plan.estimates,
                warnings: planResult.plan.warnings,
                reachedMaxChannels: planResult.plan.reachedMaxChannels,
            },
            diff: normalizedDiff,
        };
    }

    async createChannelsFromSetup(
        config: ChannelSetupConfig,
        options?: { signal?: AbortSignal; onProgress?: (p: ChannelBuildProgress) => void }
    ): Promise<ChannelBuildSummary> {
        const channelManager = this.deps.channelManager;
        const plexLibrary = this.deps.plexLibrary;

        const signal = options?.signal;
        const reportProgress = (
            task: ChannelBuildProgress['task'],
            label: string,
            detail: string,
            current: number,
            total: number | null
        ): void => {
            options?.onProgress?.({ task, label, detail, current, total });
        };

        const checkCanceled = (): boolean => {
            return signal?.aborted ?? false;
        };

        if (checkCanceled()) {
            return { created: 0, skipped: 0, reachedMaxChannels: false, errorCount: 0, canceled: true, lastTask: 'init' };
        }

        reportProgress('fetch_playlists', 'Preparing...', 'Loading libraries', 0, null);

        let libraries: PlexLibraryType[];
        try {
            libraries = await this.getLibrariesForSetup(signal ?? null);
        } catch (e) {
            if (isAbortLike(e, signal ?? undefined)) {
                reportProgress('fetch_playlists', 'Preparing...', 'Canceled', 0, null);
                return { created: 0, skipped: 0, reachedMaxChannels: false, errorCount: 0, canceled: true, lastTask: 'fetch_playlists' };
            }
            throw e;
        }
        const normalizedConfig = this._normalizeConfig(config);
        const planResult = await this._buildSetupPlan(normalizedConfig, libraries, signal ?? null, reportProgress);

        if (planResult.canceled || !planResult.plan) {
            return {
                created: 0,
                skipped: 0,
                reachedMaxChannels: false,
                errorCount: planResult.errorsTotal,
                canceled: true,
                lastTask: planResult.lastTask ?? 'build_pending',
            };
        }

        let errorsTotal = planResult.errorsTotal;
        const pending = planResult.plan.pendingChannels;
        let skippedCount = planResult.plan.skipped;
        let reachedMax = planResult.plan.reachedMaxChannels;

        if (checkCanceled()) {
            return { created: 0, skipped: skippedCount, reachedMaxChannels: reachedMax, errorCount: errorsTotal, canceled: true, lastTask: 'build_pending' };
        }

        const existingChannels = channelManager.getAllChannels();
        const diff = diffChannelPlans(existingChannels, pending);
        const pendingToCreate = this._getPendingChannelsForMode(normalizedConfig.buildMode, pending, diff);

        reportProgress('create_channels', 'Shuffling...', 'Setting up lineup', 0, pendingToCreate.length);

        const tempKeyId = String(Date.now());
        const tempKey = `lineup_channels_build_tmp_v1:${tempKeyId}`;
        const tempCurrentKey = `lineup_current_channel_build_tmp_v1:${tempKeyId}`;
        const builder = new ChannelManager({
            plexLibrary: plexLibrary,
            storageKey: tempKey,
            currentChannelKey: tempCurrentKey,
            logger: {
                warn: (msg, ...args): void => console.warn(msg, ...args.map(summarizeErrorForLog)),
                error: (msg, ...args): void => console.error(msg, ...args.map(summarizeErrorForLog)),
            },
        });

        const finalSummary: ChannelBuildSummary = {
            created: 0,
            skipped: skippedCount,
            reachedMaxChannels: false,
            errorCount: errorsTotal,
            canceled: false,
            lastTask: 'Initializing...',
        };

        try {
            let pIndex = 0;
            const buildMode = normalizedConfig.buildMode ?? 'replace';
            const availableNumbers = buildMode === 'replace'
                ? []
                : this._getAvailableChannelNumbers(existingChannels);

            if (buildMode !== 'replace' && pendingToCreate.length > availableNumbers.length) {
                reachedMax = true;
            }

            const maxCreates = buildMode === 'replace'
                ? pendingToCreate.length
                : Math.min(pendingToCreate.length, availableNumbers.length);

            for (const p of pendingToCreate) {
                pIndex++;
                if (finalSummary.created >= maxCreates) {
                    break;
                }

                if (checkCanceled()) {
                    finalSummary.canceled = true;
                    finalSummary.lastTask = 'create_channels';
                    return finalSummary;
                }

                if (pIndex % 5 === 0) {
                    reportProgress('create_channels', 'Creating channels...', `Channel ${finalSummary.created + 1}`, pIndex, pendingToCreate.length);
                }

                try {
                    const channelParams: Partial<ChannelConfig> = {
                        name: p.name,
                        contentSource: p.contentSource,
                        playbackMode: p.playbackMode,
                        shuffleSeed: p.shuffleSeed,
                        isAutoGenerated: p.isAutoGenerated === true,
                    };
                    if (p.lineupReplicaIndex !== undefined) {
                        channelParams.lineupReplicaIndex = p.lineupReplicaIndex;
                    }
                    if (p.isSequentialVariant !== undefined) {
                        channelParams.isSequentialVariant = p.isSequentialVariant;
                    }
                    if (p.contentFilters) {
                        channelParams.contentFilters = p.contentFilters;
                    }
                    if (p.sortOrder) {
                        channelParams.sortOrder = p.sortOrder;
                    }
                    if (typeof p.blockSize === 'number' && Number.isFinite(p.blockSize)) {
                        channelParams.blockSize = p.blockSize;
                    }
                    if (p.buildStrategy !== undefined) channelParams.buildStrategy = p.buildStrategy;
                    if (p.sourceLibraryId !== undefined) channelParams.sourceLibraryId = p.sourceLibraryId;
                    if (p.sourceLibraryName !== undefined) channelParams.sourceLibraryName = p.sourceLibraryName;
                    if (buildMode !== 'replace') {
                        const nextNumber = availableNumbers.shift();
                        if (!nextNumber) {
                            reachedMax = true;
                            break;
                        }
                        channelParams.number = nextNumber;
                    }

                    await builder.createChannel(channelParams, { signal: signal ?? null });

                    finalSummary.created++;
                } catch (e) {
                    if (isAbortLike(e, signal ?? undefined)) {
                        finalSummary.canceled = true;
                        finalSummary.lastTask = 'create_channels';
                        return finalSummary;
                    }
                    console.warn(`Failed to create channel ${p.name}:`, summarizeErrorForLog(e));
                    finalSummary.errorCount++;
                }
            }
            finalSummary.reachedMaxChannels = reachedMax;

            if (checkCanceled()) {
                finalSummary.canceled = true;
                finalSummary.lastTask = 'apply_channels';
                return finalSummary;
            }

            reportProgress('apply_channels', 'Saving...', 'Saving library', finalSummary.created, finalSummary.created);
            const builtChannels = builder.getAllChannels();
            let finalChannels = builtChannels;
            if (buildMode === 'append') {
                finalChannels = [...existingChannels, ...builtChannels];
            } else if (buildMode === 'merge') {
                const mergedExisting = this._mergeExistingChannels(existingChannels, diff);
                finalChannels = [...mergedExisting, ...builtChannels];
            }
            await channelManager.replaceAllChannels(finalChannels);

            reportProgress('refresh_epg', 'Refreshing guide...', 'Loading schedules', 0, null);
            this.deps.primeEpgChannels();
            await this.deps.refreshEpgSchedules({ reason: 'channel-setup', debounceMs: 0 });

        } catch (e) {
            console.error('[ChannelSetup] Channel build failed:', summarizeErrorForLog(e));
            throw e;
        } finally {
            this.deps.storageRemove(tempKey);
            this.deps.storageRemove(tempCurrentKey);
        }

        reportProgress('done', 'Done!', `Built ${finalSummary.created} channels`, finalSummary.created, finalSummary.created);
        return finalSummary;
    }

    markSetupComplete(serverId: string, setupConfig: ChannelSetupConfig): void {
        const storageKey = this._getChannelSetupStorageKey(serverId);
        const existing = this._getChannelSetupRecord(serverId);
        const createdAt = existing?.createdAt ?? Date.now();
        const normalizedConfig = this._normalizeConfig(setupConfig);
        const record: ChannelSetupRecord = {
            serverId,
            selectedLibraryIds: [...normalizedConfig.selectedLibraryIds],
            strategyConfig: { ...normalizedConfig.strategyConfig },
            channelExpansion: normalizedConfig.channelExpansion ?? DEFAULT_CHANNEL_EXPANSION,
            seriesOrdering: normalizedConfig.seriesOrdering ?? DEFAULT_SERIES_ORDERING,
            maxChannels: normalizedConfig.maxChannels,
            buildMode: normalizedConfig.buildMode,
            actorStudioCombineMode: normalizedConfig.actorStudioCombineMode,
            minItemsPerChannel: normalizedConfig.minItemsPerChannel,
            createdAt,
            updatedAt: Date.now(),
        };
        this.deps.storageSet(storageKey, JSON.stringify(record));
        this._channelSetupRerunRequested = false;
    }

    requestChannelSetupRerun(): void {
        const serverId = this.deps.getSelectedServerId();
        if (!serverId) {
            return;
        }
        this.deps.storageRemove(this._getChannelSetupStorageKey(serverId));
        this._channelSetupRerunRequested = true;
        const navigation = this.deps.navigation;
        navigation.goTo('channel-setup');
    }

    // --- Used by InitializationCoordinator + NavigationCoordinator ---
    shouldRunChannelSetup(): boolean {
        const channelManager = this.deps.channelManager;
        const serverId = this.deps.getSelectedServerId();
        if (!serverId) {
            return false;
        }
        if (this._channelSetupRerunRequested) {
            return true;
        }
        if (channelManager.getAllChannels().length === 0) {
            return true;
        }
        const record = this._getChannelSetupRecord(serverId);
        return record === null;
    }

    // --- Called during initialize to clean up crash leftovers ---
    cleanupStaleChannelBuildKeys(): void {
        safeLocalStorageRemoveByPrefixes([
            'lineup_channels_build_tmp_v1:',
            'lineup_current_channel_build_tmp_v1:',
        ]);
    }

    private _getChannelSetupStorageKey(serverId: string): string {
        return `lineup_channel_setup_v2:${serverId}`;
    }

    private _normalizeConfig(config: ChannelSetupConfig): ChannelSetupConfig {
        const maxChannels = Number.isFinite(config.maxChannels)
            ? Math.min(Math.max(Math.floor(config.maxChannels), 1), MAX_CHANNELS)
            : DEFAULT_CHANNEL_SETUP_MAX;
        const minItemsPerChannel = Number.isFinite(config.minItemsPerChannel)
            ? Math.max(1, Math.floor(config.minItemsPerChannel))
            : DEFAULT_MIN_ITEMS_PER_CHANNEL;
        const buildMode = config.buildMode ?? 'replace';
        const actorStudioCombineMode = config.actorStudioCombineMode ?? 'separate';
        const strategyConfig = SELECTABLE_STRATEGY_KEYS.reduce<Record<SetupStrategyKey, SetupStrategyConfig>>((acc, key) => {
            const candidate = config.strategyConfig[key];
            const enabled = typeof candidate?.enabled === 'boolean' ? candidate.enabled : true;
            const priority = Number.isFinite(candidate?.priority)
                ? Math.max(1, Math.floor(Number(candidate.priority)))
                : DEFAULT_STRATEGY_PRIORITIES[key];
            const scope = MIXED_SCOPE_STRATEGY_KEYS.has(key) && candidate?.scope === 'cross-library'
                ? 'cross-library'
                : 'per-library';
            acc[key] = { enabled, priority, scope };
            return acc;
        }, {} as Record<SetupStrategyKey, SetupStrategyConfig>);
        const channelExpansion = this._normalizeChannelExpansion(config.channelExpansion);
        const seriesOrdering = this._normalizeSeriesOrdering(config.seriesOrdering);
        return {
            ...config,
            maxChannels,
            minItemsPerChannel,
            buildMode,
            actorStudioCombineMode,
            strategyConfig,
            channelExpansion,
            seriesOrdering,
        };
    }

    private _normalizeChannelExpansion(expansion: ChannelExpansionConfig | undefined): ChannelExpansionConfig {
        const addAlternateLineups = expansion?.addAlternateLineups === true;
        const alternateLineupCopies = Number.isFinite(expansion?.alternateLineupCopies)
            ? Math.min(3, Math.max(1, Math.floor(Number(expansion?.alternateLineupCopies))))
            : DEFAULT_CHANNEL_EXPANSION.alternateLineupCopies;
        const variantType =
            expansion?.variantType === 'sequential' || expansion?.variantType === 'block'
                ? expansion.variantType
                : 'none';
        const variantBlockSize = Number.isFinite(expansion?.variantBlockSize)
            ? Math.min(5, Math.max(2, Math.floor(Number(expansion?.variantBlockSize))))
            : DEFAULT_CHANNEL_EXPANSION.variantBlockSize;
        return {
            addAlternateLineups,
            alternateLineupCopies,
            variantType,
            variantBlockSize,
        };
    }

    private _normalizeSeriesOrdering(value: SeriesOrderingConfig | undefined): SeriesOrderingConfig {
        const basePlaybackMode =
            value?.basePlaybackMode === 'sequential' || value?.basePlaybackMode === 'block'
                ? value.basePlaybackMode
                : 'shuffle';
        const baseBlockSize = Number.isFinite(value?.baseBlockSize)
            ? Math.min(5, Math.max(2, Math.floor(Number(value?.baseBlockSize))))
            : DEFAULT_SERIES_ORDERING.baseBlockSize;
        return {
            basePlaybackMode,
            baseBlockSize,
        };
    }

    private _emptyEstimates(): ChannelSetupPreview['estimates'] {
        return {
            total: 0,
            collections: 0,
            playlists: 0,
            genres: 0,
            directors: 0,
            decades: 0,
            recentlyAdded: 0,
            studios: 0,
            actors: 0,
        };
    }

    private _normalizeDiffForMode(
        diff: ChannelDiffResult,
        buildMode: ChannelSetupConfig['buildMode']
    ): ChannelSetupReview['diff'] {
        if (buildMode === 'replace') {
            return {
                summary: diff.summary,
                samples: diff.samples,
            };
        }
        const unchanged = [...diff.unchanged, ...diff.removed];
        const summary = {
            created: diff.created.length,
            removed: 0,
            unchanged: unchanged.length,
        };
        const samples = {
            created: diff.created.slice(0, 6).map((c) => c.name),
            removed: [],
            unchanged: unchanged.slice(0, 6).map((c) => c.name),
        };
        return { summary, samples };
    }

    private async _buildSetupPlan(
        config: ChannelSetupConfig,
        libraries: PlexLibraryType[],
        signal: AbortSignal | null,
        reportProgress?: (
            task: ChannelBuildProgress['task'],
            label: string,
            detail: string,
            current: number,
            total: number | null
        ) => void
    ): Promise<{
        plan: ReturnType<typeof buildChannelSetupPlan> | null;
        canceled: boolean;
        lastTask?: ChannelBuildProgress['task'];
        errorsTotal: number;
        playlistMs: number;
        collectionsMs: number;
        libraryQueryMs: number;
    }> {
        const plexLibrary = this.deps.plexLibrary;

        const checkCanceled = (): boolean => signal?.aborted ?? false;
        const warnings = new Set<string>();
        const selectedLibraries = libraries.filter((lib) => config.selectedLibraryIds.includes(lib.id));

        let errorsTotal = 0;
        let playlistMs = 0;
        let collectionsMs = 0;
        let libraryQueryMs = 0;

        const playlists: PlexPlaylist[] = [];
        const collectionsByLibraryId = new Map<string, PlexCollection[]>();
        const tagItemsByLibraryId = new Map<string, PlexMediaItem[]>();
        const scanItemsByLibraryId = new Map<string, PlexMediaItem[]>();
        const actorsByLibraryId = new Map<string, PlexTagDirectoryItem[]>();
        const studiosByLibraryId = new Map<string, PlexTagDirectoryItem[]>();

        if (config.strategyConfig.playlists.enabled) {
            reportProgress?.('fetch_playlists', 'Fetching playlists...', 'Scanning server', 0, null);
            try {
                const playlistsStart = Date.now();
                const fetched = await plexLibrary.getPlaylists({ signal });
                playlistMs += Date.now() - playlistsStart;
                playlists.push(...fetched);
            } catch (e) {
                if (isAbortLike(e, signal ?? undefined)) {
                    return { plan: null, canceled: true, lastTask: 'fetch_playlists', errorsTotal, playlistMs, collectionsMs, libraryQueryMs };
                }
                console.warn('Failed to fetch playlists:', summarizeErrorForLog(e));
                errorsTotal++;
            }
        }

        const CHANNEL_SETUP_SCAN_LIMIT = 500;

        for (let libIndex = 0; libIndex < selectedLibraries.length; libIndex++) {
            const library = selectedLibraries[libIndex];
            if (!library) continue;
            if (checkCanceled()) {
                return { plan: null, canceled: true, lastTask: 'scan_library_items', errorsTotal, playlistMs, collectionsMs, libraryQueryMs };
            }

            if (config.strategyConfig.collections.enabled) {
                reportProgress?.('fetch_collections', 'Fetching collections...', library.title, libIndex, selectedLibraries.length);
                try {
                    const collectionsStart = Date.now();
                    const collections = await plexLibrary.getCollections(library.id, { signal });
                    collectionsMs += Date.now() - collectionsStart;
                    collectionsByLibraryId.set(library.id, collections);
                } catch (e) {
                    if (isAbortLike(e, signal ?? undefined)) {
                        return { plan: null, canceled: true, lastTask: 'fetch_collections', errorsTotal, playlistMs, collectionsMs, libraryQueryMs };
                    }
                    console.warn(`Failed to fetch collections for library ${library.title}:`, summarizeErrorForLog(e));
                    errorsTotal++;
                    collectionsByLibraryId.set(library.id, []);
                }
            }

            if (
                config.strategyConfig.genres.enabled
                || config.strategyConfig.directors.enabled
                || config.strategyConfig.decades.enabled
            ) {
                reportProgress?.('scan_library_items', 'Resolving filters...', library.title, libIndex, selectedLibraries.length);
                try {
                    const scanOptions: LibraryQueryOptions = {
                        signal,
                        limit: CHANNEL_SETUP_SCAN_LIMIT,
                    };

                    let tagItems: PlexMediaItem[] = [];
                    let scanItems: PlexMediaItem[] = [];

                    if (library.type === 'show') {
                        if (config.strategyConfig.genres.enabled || config.strategyConfig.directors.enabled) {
                            const tagOptions: LibraryQueryOptions = {
                                signal,
                                limit: CHANNEL_SETUP_SCAN_LIMIT,
                                filter: { type: PLEX_MEDIA_TYPES.SHOW },
                            };
                            const tagStart = Date.now();
                            tagItems = await plexLibrary.getLibraryItems(library.id, tagOptions);
                            libraryQueryMs += Date.now() - tagStart;
                        }
                        if (config.strategyConfig.decades.enabled) {
                            const episodeOptions: LibraryQueryOptions = {
                                signal,
                                limit: CHANNEL_SETUP_SCAN_LIMIT,
                                filter: { type: PLEX_MEDIA_TYPES.EPISODE },
                            };
                            const scanStart = Date.now();
                            scanItems = await plexLibrary.getLibraryItems(library.id, episodeOptions);
                            libraryQueryMs += Date.now() - scanStart;
                        }
                    } else {
                        const scanStart = Date.now();
                        tagItems = await plexLibrary.getLibraryItems(library.id, scanOptions);
                        libraryQueryMs += Date.now() - scanStart;
                        scanItems = tagItems;
                    }

                    tagItemsByLibraryId.set(library.id, tagItems);
                    scanItemsByLibraryId.set(library.id, scanItems);
                } catch (e) {
                    if (isAbortLike(e, signal ?? undefined)) {
                        return { plan: null, canceled: true, lastTask: 'scan_library_items', errorsTotal, playlistMs, collectionsMs, libraryQueryMs };
                    }
                    console.warn(`Failed to scan items for ${library.title}:`, summarizeErrorForLog(e));
                    errorsTotal++;
                }
            }

            if (config.strategyConfig.studios.enabled) {
                reportProgress?.('scan_library_items', 'Fetching studios...', library.title, libIndex, selectedLibraries.length);
                try {
                    const studiosStart = Date.now();
                    const studios = await plexLibrary.getStudios(library.id, {
                        type: library.type === 'movie' ? PLEX_MEDIA_TYPES.MOVIE : PLEX_MEDIA_TYPES.EPISODE,
                        signal,
                        onUnsupported: () => {
                            warnings.add('Studios endpoint not supported by this Plex server.');
                        },
                    });
                    libraryQueryMs += Date.now() - studiosStart;
                    studiosByLibraryId.set(library.id, studios);
                } catch (e) {
                    if (isAbortLike(e, signal ?? undefined)) {
                        return { plan: null, canceled: true, lastTask: 'scan_library_items', errorsTotal, playlistMs, collectionsMs, libraryQueryMs };
                    }
                    console.warn(`Failed to fetch studios for ${library.title}:`, summarizeErrorForLog(e));
                    errorsTotal++;
                }
            }

            if (config.strategyConfig.actors.enabled) {
                reportProgress?.('scan_library_items', 'Fetching actors...', library.title, libIndex, selectedLibraries.length);
                try {
                    const actorsStart = Date.now();
                    const actors = await plexLibrary.getActors(library.id, {
                        type: library.type === 'movie' ? PLEX_MEDIA_TYPES.MOVIE : PLEX_MEDIA_TYPES.EPISODE,
                        signal,
                        onUnsupported: () => {
                            warnings.add('Actors endpoint not supported by this Plex server.');
                        },
                    });
                    libraryQueryMs += Date.now() - actorsStart;
                    actorsByLibraryId.set(library.id, actors);
                } catch (e) {
                    if (isAbortLike(e, signal ?? undefined)) {
                        return { plan: null, canceled: true, lastTask: 'scan_library_items', errorsTotal, playlistMs, collectionsMs, libraryQueryMs };
                    }
                    console.warn(`Failed to fetch actors for ${library.title}:`, summarizeErrorForLog(e));
                    errorsTotal++;
                }
            }
        }

        const plan = buildChannelSetupPlan({
            config,
            libraries,
            playlists,
            collectionsByLibraryId,
            tagItemsByLibraryId,
            scanItemsByLibraryId,
            actorsByLibraryId,
            studiosByLibraryId,
            warnings: Array.from(warnings),
            seedFor: (value: string): number => this._hashSeed(value),
        });

        return { plan, canceled: false, errorsTotal, playlistMs, collectionsMs, libraryQueryMs };
    }

    private _getPendingChannelsForMode(
        buildMode: ChannelSetupConfig['buildMode'],
        pending: PendingChannel[],
        diff: ChannelDiffResult
    ): PendingChannel[] {
        if (buildMode === 'replace') {
            return pending;
        }
        const matchedCounts = new Map<string, number>();
        for (const pair of diff.matchedPairs) {
            const key = createChannelIdentityKey(pair.planned);
            matchedCounts.set(key, (matchedCounts.get(key) ?? 0) + 1);
        }
        const result: PendingChannel[] = [];
        for (const p of pending) {
            const key = createChannelIdentityKey(p);
            const remaining = matchedCounts.get(key) ?? 0;
            if (remaining > 0) {
                matchedCounts.set(key, remaining - 1);
                continue;
            }
            result.push(p);
        }
        return result;
    }

    private _getAvailableChannelNumbers(existingChannels: ChannelConfig[]): number[] {
        const used = new Set(existingChannels.map((channel) => channel.number));
        const available: number[] = [];
        for (let i = 1; i <= MAX_CHANNEL_NUMBER; i++) {
            if (!used.has(i)) {
                available.push(i);
            }
        }
        return available;
    }

    private _mergeExistingChannels(existingChannels: ChannelConfig[], diff: ChannelDiffResult): ChannelConfig[] {
        const plannedById = new Map<string, PendingChannel>();
        for (const pair of diff.matchedPairs) {
            plannedById.set(pair.existing.id, pair.planned);
        }
        return existingChannels.map((existing) => {
            const planned = plannedById.get(existing.id);
            if (!planned) {
                return existing;
            }
            return this._mergeChannel(existing, planned);
        });
    }

    private _mergeChannel(existing: ChannelConfig, planned: PendingChannel): ChannelConfig {
        const updated: ChannelConfig = {
            ...existing,
            contentSource: planned.contentSource,
            playbackMode: planned.playbackMode,
            shuffleSeed: planned.shuffleSeed,
            updatedAt: Date.now(),
        };
        if (planned.contentFilters) {
            updated.contentFilters = planned.contentFilters;
        } else {
            delete updated.contentFilters;
        }
        if (planned.sortOrder) {
            updated.sortOrder = planned.sortOrder;
        } else {
            delete updated.sortOrder;
        }
        if (typeof planned.blockSize === 'number' && Number.isFinite(planned.blockSize)) {
            updated.blockSize = planned.blockSize;
        } else {
            delete updated.blockSize;
        }
        if (planned.buildStrategy !== undefined) {
            updated.buildStrategy = planned.buildStrategy;
        } else {
            delete updated.buildStrategy;
        }
        if (planned.sourceLibraryId !== undefined) {
            updated.sourceLibraryId = planned.sourceLibraryId;
        } else {
            delete updated.sourceLibraryId;
        }
        if (planned.sourceLibraryName !== undefined) {
            updated.sourceLibraryName = planned.sourceLibraryName;
        } else {
            delete updated.sourceLibraryName;
        }
        if (planned.lineupReplicaIndex !== undefined) {
            updated.lineupReplicaIndex = planned.lineupReplicaIndex;
        } else {
            delete updated.lineupReplicaIndex;
        }
        if (planned.isSequentialVariant !== undefined) {
            updated.isSequentialVariant = planned.isSequentialVariant;
        } else {
            delete updated.isSequentialVariant;
        }
        if (existing.isAutoGenerated === true) {
            updated.name = planned.name;
        }
        return updated;
    }

    private _getChannelSetupRecord(serverId: string): ChannelSetupRecord | null {
        const stored = this.deps.storageGet(this._getChannelSetupStorageKey(serverId));
        if (!stored) {
            return null;
        }
        try {
            const parsed = JSON.parse(stored) as Partial<ChannelSetupRecord>;
            if (!parsed || parsed.serverId !== serverId) {
                return null;
            }
            if (
                !Array.isArray(parsed.selectedLibraryIds) ||
                !parsed.selectedLibraryIds.every((id) => typeof id === 'string')
            ) {
                return null;
            }
            const rawStrategyConfig = parsed.strategyConfig as unknown;
            if (!rawStrategyConfig || typeof rawStrategyConfig !== 'object') {
                return null;
            }
            const strategyConfig = SETUP_STRATEGY_KEYS.reduce<Record<SetupStrategyKey, SetupStrategyConfig>>((acc, key) => {
                const raw = (rawStrategyConfig as Record<string, unknown>)[key] as unknown;
                if (!raw || typeof raw !== 'object') {
                    throw new Error(`Missing strategyConfig.${key}`);
                }
                const enabled = (raw as { enabled?: unknown }).enabled;
                const priority = (raw as { priority?: unknown }).priority;
                const scope = (raw as { scope?: unknown }).scope;
                if (typeof enabled !== 'boolean') {
                    throw new Error(`Invalid strategyConfig.${key}.enabled`);
                }
                if (typeof priority !== 'number' || !Number.isFinite(priority)) {
                    throw new Error(`Invalid strategyConfig.${key}.priority`);
                }
                if (scope !== 'per-library' && scope !== 'cross-library') {
                    throw new Error(`Invalid strategyConfig.${key}.scope`);
                }
                acc[key] = { enabled, priority, scope };
                return acc;
            }, {} as Record<SetupStrategyKey, SetupStrategyConfig>);

            if (typeof parsed.createdAt !== 'number' || !Number.isFinite(parsed.createdAt)) {
                return null;
            }
            if (typeof parsed.updatedAt !== 'number' || !Number.isFinite(parsed.updatedAt)) {
                return null;
            }
            const maxChannels = typeof parsed.maxChannels === 'number' && Number.isFinite(parsed.maxChannels)
                ? parsed.maxChannels
                : DEFAULT_CHANNEL_SETUP_MAX;
            const minItemsPerChannel = typeof parsed.minItemsPerChannel === 'number' && Number.isFinite(parsed.minItemsPerChannel)
                ? parsed.minItemsPerChannel
                : DEFAULT_MIN_ITEMS_PER_CHANNEL;
            const buildMode = parsed.buildMode === 'append' || parsed.buildMode === 'merge'
                ? parsed.buildMode
                : 'replace';
            const actorStudioCombineMode = parsed.actorStudioCombineMode === 'combined'
                ? parsed.actorStudioCombineMode
                : 'separate';
            const channelExpansion = typeof parsed.channelExpansion === 'object' && parsed.channelExpansion !== null
                ? parsed.channelExpansion as ChannelExpansionConfig
                : undefined;
            const seriesOrdering = typeof parsed.seriesOrdering === 'object' && parsed.seriesOrdering !== null
                ? parsed.seriesOrdering as SeriesOrderingConfig
                : undefined;
            const baseConfig: ChannelSetupConfig = {
                serverId: parsed.serverId,
                selectedLibraryIds: parsed.selectedLibraryIds,
                maxChannels,
                buildMode,
                strategyConfig,
                actorStudioCombineMode,
                minItemsPerChannel,
            };
            if (channelExpansion) {
                baseConfig.channelExpansion = channelExpansion;
            }
            if (seriesOrdering) {
                baseConfig.seriesOrdering = seriesOrdering;
            }
            const normalizedConfig = this._normalizeConfig(baseConfig);

            return {
                ...normalizedConfig,
                createdAt: parsed.createdAt,
                updatedAt: parsed.updatedAt,
            };
        } catch {
            return null;
        }
    }

    private _hashSeed(value: string): number {
        let hash = 2166136261;
        for (let i = 0; i < value.length; i++) {
            hash ^= value.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }
}

function summarizeErrorForLog(error: unknown): { name?: string; code?: unknown; message?: string } {
    if (!error || typeof error !== 'object') return {};
    const e = error as { name?: unknown; code?: unknown; message?: unknown };
    return {
        ...(typeof e.name === 'string' ? { name: e.name } : {}),
        ...('code' in e ? { code: e.code } : {}),
        ...(typeof e.message === 'string' ? { message: redactSensitiveTokens(e.message) } : {}),
    };
}

function isAbortLike(error: unknown, signal?: AbortSignal): boolean {
    if (signal?.aborted) return true;
    if (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') return true;
    if (error && typeof error === 'object' && 'name' in error) {
        const namedError = error as { name?: unknown };
        if (namedError.name === 'AbortError') return true;
    }
    return false;
}
