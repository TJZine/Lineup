import type { IChannelManager } from '../../modules/scheduler/channel-manager';
import type {
    IPlexLibrary,
    PlexLibraryType,
    PlexTagDirectoryItem,
    PlexPlaylist,
    PlexCollection,
    PlexTagDirectoryUnsupportedReason,
} from '../../modules/plex/library';
import { PLEX_MEDIA_TYPES } from '../../modules/plex/library';
import { DEFAULT_CHANNEL_SETUP_MAX, MAX_CHANNELS } from '../../modules/scheduler/channel-manager/constants';
import { redactSensitiveTokens } from '../../utils/redact';
import type {
    ChannelSetupConfig,
    ChannelBuildProgress,
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
import { isSignalAborted } from './utils';

const SELECTABLE_STRATEGY_KEYS: SetupStrategyKey[] = [...SETUP_STRATEGY_KEYS];

export interface ChannelSetupPlanningServiceDeps {
    plexLibrary: IPlexLibrary;
    channelManager: IChannelManager;
}

export type ChannelSetupPlanBuildResult = {
    plan: ReturnType<typeof buildChannelSetupPlan> | null;
    warnings: string[];
    canceled: boolean;
    blockedMessage?: string;
    lastTask?: ChannelBuildProgress['task'];
    errorsTotal: number;
    playlistMs: number;
    collectionsMs: number;
    libraryQueryMs: number;
};

export class ChannelSetupPlanningService {
    constructor(private readonly _deps: ChannelSetupPlanningServiceDeps) {}

    async getLibrariesForSetup(signal?: AbortSignal | null): Promise<PlexLibraryType[]> {
        const libraries = await this._deps.plexLibrary.getLibraries({
            signal: signal ?? null,
            includeItemCounts: true,
            itemCountConcurrency: 4,
        });
        return libraries.filter((lib) => lib.type === 'movie' || lib.type === 'show');
    }

    normalizeConfig(config: ChannelSetupConfig): ChannelSetupConfig {
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

    async getSetupPreview(
        config: ChannelSetupConfig,
        options?: { signal?: AbortSignal }
    ): Promise<ChannelSetupPreview> {
        const normalizedConfig = this.normalizeConfig(config);
        const libraries = await this.getLibrariesForSetup(options?.signal ?? null);
        const planResult = await this.buildSetupPlan(normalizedConfig, libraries, options?.signal ?? null);
        if (planResult.canceled || !planResult.plan) {
            return {
                estimates: this._emptyEstimates(),
                warnings: [...planResult.warnings],
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
        const normalizedConfig = this.normalizeConfig(config);
        const libraries = await this.getLibrariesForSetup(options?.signal ?? null);
        const planResult = await this.buildSetupPlan(normalizedConfig, libraries, options?.signal ?? null);
        if (planResult.canceled || !planResult.plan) {
            return {
                preview: {
                    estimates: this._emptyEstimates(),
                    warnings: [...planResult.warnings],
                    reachedMaxChannels: false,
                },
                diff: { summary: { created: 0, removed: 0, unchanged: 0 }, samples: { created: [], removed: [], unchanged: [] } },
            };
        }
        const existingChannels = this._deps.channelManager.getAllChannels();
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

    async buildSetupPlan(
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
    ): Promise<ChannelSetupPlanBuildResult> {
        const checkCanceled = (): boolean => signal?.aborted ?? false;
        const warnings = new Set<string>();
        const selectedLibraries = libraries.filter((lib) => config.selectedLibraryIds.includes(lib.id));

        let errorsTotal = 0;
        let playlistMs = 0;
        let collectionsMs = 0;
        let libraryQueryMs = 0;

        const playlists: PlexPlaylist[] = [];
        const collectionsByLibraryId = new Map<string, PlexCollection[]>();
        const genresByLibraryId = new Map<string, PlexTagDirectoryItem[]>();
        const directorsByLibraryId = new Map<string, PlexTagDirectoryItem[]>();
        const yearsByLibraryId = new Map<string, PlexTagDirectoryItem[]>();
        const actorsByLibraryId = new Map<string, PlexTagDirectoryItem[]>();
        const studiosByLibraryId = new Map<string, PlexTagDirectoryItem[]>();
        const collectWarnings = (): string[] => Array.from(warnings);
        const addPartialWarning = (
            task: ChannelBuildProgress['task'],
            detail: string,
            error: unknown
        ): void => {
            const summary = summarizeErrorForLog(error);
            const message = summary.message ?? (summary.code !== undefined ? String(summary.code) : 'unknown error');
            warnings.add(`Partial setup plan (${task}): ${detail} (${message})`);
        };
        const buildCanceledScanResult = (): ChannelSetupPlanBuildResult => ({
            plan: null,
            warnings: collectWarnings(),
            canceled: true,
            lastTask: 'scan_library_items',
            errorsTotal,
            playlistMs,
            collectionsMs,
            libraryQueryMs,
        });

        const buildBlockedScanResult = (message: string): ChannelSetupPlanBuildResult => ({
            plan: null,
            warnings: collectWarnings(),
            canceled: false,
            blockedMessage: message,
            lastTask: 'scan_library_items',
            errorsTotal,
            playlistMs,
            collectionsMs,
            libraryQueryMs,
        });

        const stopForRequiredTagDirectory = (
            label: 'Genres' | 'Directors' | 'Years',
            libraryTitle: string,
            type: number,
            reason: PlexTagDirectoryUnsupportedReason | 'error',
            error?: unknown
        ): ChannelSetupPlanBuildResult => {
            const baseLabel = label.toLowerCase();
            let message: string;
            if (reason === 'error') {
                const summary = summarizeErrorForLog(error);
                const detail = summary.message ?? (summary.code !== undefined ? String(summary.code) : 'unknown error');
                message = `Required ${baseLabel} tag directory (type=${type}) failed for ${libraryTitle} (${detail}); stop and re-plan.`;
            } else {
                const detail = reason === 'empty' ? 'returned no entries' : 'is unsupported';
                message = `Required ${baseLabel} tag directory (type=${type}) ${detail} for ${libraryTitle}; stop and re-plan.`;
            }
            warnings.add(message);
            errorsTotal++;
            return buildBlockedScanResult(message);
        };

        void buildCanceledScanResult;

        if (config.strategyConfig.playlists.enabled) {
            reportProgress?.('fetch_playlists', 'Fetching playlists...', 'Scanning server', 0, null);
            try {
                const playlistsStart = Date.now();
                const fetched = await this._deps.plexLibrary.getPlaylists({ signal });
                playlistMs += Date.now() - playlistsStart;
                playlists.push(...fetched);
            } catch (e) {
                if (isSignalAborted(signal ?? undefined)) {
                    return {
                        plan: null,
                        warnings: collectWarnings(),
                        canceled: true,
                        lastTask: 'fetch_playlists',
                        errorsTotal,
                        playlistMs,
                        collectionsMs,
                        libraryQueryMs,
                    };
                }
                console.warn('Failed to fetch playlists:', summarizeErrorForLog(e));
                addPartialWarning('fetch_playlists', 'fetch_playlists failed', e);
                errorsTotal++;
            }
        }

        for (let libIndex = 0; libIndex < selectedLibraries.length; libIndex++) {
            const library = selectedLibraries[libIndex];
            if (!library) continue;
            if (checkCanceled()) {
                return {
                    plan: null,
                    warnings: collectWarnings(),
                    canceled: true,
                    lastTask: 'scan_library_items',
                    errorsTotal,
                    playlistMs,
                    collectionsMs,
                    libraryQueryMs,
                };
            }

            if (config.strategyConfig.collections.enabled) {
                reportProgress?.('fetch_collections', 'Fetching collections...', library.title, libIndex, selectedLibraries.length);
                try {
                    const collectionsStart = Date.now();
                    const collections = await this._deps.plexLibrary.getCollections(library.id, { signal });
                    collectionsMs += Date.now() - collectionsStart;
                    collectionsByLibraryId.set(library.id, collections);
                } catch (e) {
                    if (isSignalAborted(signal ?? undefined)) {
                        return {
                            plan: null,
                            warnings: collectWarnings(),
                            canceled: true,
                            lastTask: 'fetch_collections',
                            errorsTotal,
                            playlistMs,
                            collectionsMs,
                            libraryQueryMs,
                        };
                    }
                    console.warn(`Failed to fetch collections for library ${library.title}:`, summarizeErrorForLog(e));
                    addPartialWarning('fetch_collections', `fetch_collections failed for ${library.title}`, e);
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
                const genreType = library.type === 'show' ? PLEX_MEDIA_TYPES.SHOW : PLEX_MEDIA_TYPES.MOVIE;
                const detailType = library.type === 'show' ? PLEX_MEDIA_TYPES.EPISODE : PLEX_MEDIA_TYPES.MOVIE;
                const requireEntries = library.contentCount > 0;

                if (config.strategyConfig.genres.enabled) {
                    try {
                        const tagStart = Date.now();
                        let unsupportedReason: PlexTagDirectoryUnsupportedReason | null = null;
                        const genres = await this._deps.plexLibrary.getGenres(library.id, {
                            type: genreType,
                            signal,
                            requireEntries,
                            onUnsupported: (reason) => {
                                unsupportedReason = reason;
                            },
                        });
                        libraryQueryMs += Date.now() - tagStart;
                        if (unsupportedReason) {
                            return stopForRequiredTagDirectory('Genres', library.title, genreType, unsupportedReason);
                        }
                        genresByLibraryId.set(library.id, genres);
                    } catch (e) {
                        if (isSignalAborted(signal ?? undefined)) {
                            return {
                                plan: null,
                                warnings: collectWarnings(),
                                canceled: true,
                                lastTask: 'scan_library_items',
                                errorsTotal,
                                playlistMs,
                                collectionsMs,
                                libraryQueryMs,
                            };
                        }
                        console.warn(`Failed to fetch genres for ${library.title}:`, summarizeErrorForLog(e));
                        return stopForRequiredTagDirectory('Genres', library.title, genreType, 'error', e);
                    }
                }

                if (config.strategyConfig.directors.enabled) {
                    try {
                        const tagStart = Date.now();
                        let unsupportedReason: PlexTagDirectoryUnsupportedReason | null = null;
                        const directors = await this._deps.plexLibrary.getDirectors(library.id, {
                            type: detailType,
                            signal,
                            requireEntries,
                            onUnsupported: (reason) => {
                                unsupportedReason = reason;
                            },
                        });
                        libraryQueryMs += Date.now() - tagStart;
                        if (unsupportedReason) {
                            return stopForRequiredTagDirectory('Directors', library.title, detailType, unsupportedReason);
                        }
                        directorsByLibraryId.set(library.id, directors);
                    } catch (e) {
                        if (isSignalAborted(signal ?? undefined)) {
                            return {
                                plan: null,
                                warnings: collectWarnings(),
                                canceled: true,
                                lastTask: 'scan_library_items',
                                errorsTotal,
                                playlistMs,
                                collectionsMs,
                                libraryQueryMs,
                            };
                        }
                        console.warn(`Failed to fetch directors for ${library.title}:`, summarizeErrorForLog(e));
                        return stopForRequiredTagDirectory('Directors', library.title, detailType, 'error', e);
                    }
                }

                if (config.strategyConfig.decades.enabled) {
                    try {
                        const tagStart = Date.now();
                        let unsupportedReason: PlexTagDirectoryUnsupportedReason | null = null;
                        const years = await this._deps.plexLibrary.getYears(library.id, {
                            type: detailType,
                            signal,
                            requireEntries,
                            onUnsupported: (reason) => {
                                unsupportedReason = reason;
                            },
                        });
                        libraryQueryMs += Date.now() - tagStart;
                        if (unsupportedReason) {
                            return stopForRequiredTagDirectory('Years', library.title, detailType, unsupportedReason);
                        }
                        yearsByLibraryId.set(library.id, years);
                    } catch (e) {
                        if (isSignalAborted(signal ?? undefined)) {
                            return {
                                plan: null,
                                warnings: collectWarnings(),
                                canceled: true,
                                lastTask: 'scan_library_items',
                                errorsTotal,
                                playlistMs,
                                collectionsMs,
                                libraryQueryMs,
                            };
                        }
                        console.warn(`Failed to fetch years for ${library.title}:`, summarizeErrorForLog(e));
                        return stopForRequiredTagDirectory('Years', library.title, detailType, 'error', e);
                    }
                }
            }

            if (config.strategyConfig.studios.enabled) {
                reportProgress?.('scan_library_items', 'Fetching studios...', library.title, libIndex, selectedLibraries.length);
                try {
                    const studiosStart = Date.now();
                    const studios = await this._deps.plexLibrary.getStudios(library.id, {
                        type: library.type === 'movie' ? PLEX_MEDIA_TYPES.MOVIE : PLEX_MEDIA_TYPES.EPISODE,
                        signal,
                        onUnsupported: () => {
                            warnings.add('Studios endpoint not supported by this Plex server.');
                        },
                    });
                    libraryQueryMs += Date.now() - studiosStart;
                    studiosByLibraryId.set(library.id, studios);
                } catch (e) {
                    if (isSignalAborted(signal ?? undefined)) {
                        return {
                            plan: null,
                            warnings: collectWarnings(),
                            canceled: true,
                            lastTask: 'scan_library_items',
                            errorsTotal,
                            playlistMs,
                            collectionsMs,
                            libraryQueryMs,
                        };
                    }
                    console.warn(`Failed to fetch studios for ${library.title}:`, summarizeErrorForLog(e));
                    addPartialWarning('scan_library_items', `fetch_studios failed for ${library.title}`, e);
                    errorsTotal++;
                }
            }

            if (config.strategyConfig.actors.enabled) {
                reportProgress?.('scan_library_items', 'Fetching actors...', library.title, libIndex, selectedLibraries.length);
                try {
                    const actorsStart = Date.now();
                    const actors = await this._deps.plexLibrary.getActors(library.id, {
                        type: library.type === 'movie' ? PLEX_MEDIA_TYPES.MOVIE : PLEX_MEDIA_TYPES.EPISODE,
                        signal,
                        onUnsupported: () => {
                            warnings.add('Actors endpoint not supported by this Plex server.');
                        },
                    });
                    libraryQueryMs += Date.now() - actorsStart;
                    actorsByLibraryId.set(library.id, actors);
                } catch (e) {
                    if (isSignalAborted(signal ?? undefined)) {
                        return {
                            plan: null,
                            warnings: collectWarnings(),
                            canceled: true,
                            lastTask: 'scan_library_items',
                            errorsTotal,
                            playlistMs,
                            collectionsMs,
                            libraryQueryMs,
                        };
                    }
                    console.warn(`Failed to fetch actors for ${library.title}:`, summarizeErrorForLog(e));
                    addPartialWarning('scan_library_items', `fetch_actors failed for ${library.title}`, e);
                    errorsTotal++;
                }
            }
        }

        const plan = buildChannelSetupPlan({
            config,
            libraries,
            playlists,
            collectionsByLibraryId,
            genresByLibraryId,
            directorsByLibraryId,
            yearsByLibraryId,
            actorsByLibraryId,
            studiosByLibraryId,
            warnings: Array.from(warnings),
            seedFor: (value: string): number => this._hashSeed(value),
        });

        return {
            plan,
            warnings: collectWarnings(),
            canceled: false,
            errorsTotal,
            playlistMs,
            collectionsMs,
            libraryQueryMs,
        };
    }

    getPendingChannelsForMode(
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
