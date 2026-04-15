import type { ChannelSetupRecord } from '../../../../core/channel-setup/types';
import { DEFAULT_CHANNEL_SETUP_MAX } from '../../../scheduler/channel-manager/constants';
import { DEFAULT_MIN_ITEMS_PER_CHANNEL } from '../../../../core/channel-setup/constants';
import { makeLibrary } from './channel-setup-test-helpers';
import { ChannelSetupSessionState } from '../ChannelSetupSessionState';

describe('ChannelSetupSessionState', () => {
    it('resetForNewSession restores defaults and clears derived planning state', () => {
        const state = new ChannelSetupSessionState();
        state.step = 3;
        state.libraries = [makeLibrary({ id: 'movies' })];
        state.selectedLibraryIds = new Set(['movies']);
        state.loadError = 'failed';
        state.preview = {
            estimates: {
                total: 10,
                collections: 1,
                playlists: 1,
                genres: 1,
                directors: 1,
                decades: 1,
                recentlyAdded: 1,
                studios: 1,
                actors: 1,
            },
            warnings: ['warn'],
            reachedMaxChannels: false,
        };
        state.previewError = 'preview failed';
        state.previewStatus = 'error';
        state.review = {
            preview: state.preview,
            diff: {
                summary: { created: 1, removed: 1, unchanged: 1 },
                samples: { created: ['A'], removed: ['B'], unchanged: ['C'] },
            },
        };
        state.reviewError = 'review failed';
        state.previewDeltas = { total: 2 };
        state.previewDeltaExpiresAtMs = 99;
        state.lastPreviewKey = 'preview-key';
        state.pendingPreviewKey = 'pending-preview-key';
        state.recordApplied = true;
        state.setupContext = 'existing';
        state.replaceConfirm = true;
        state.maxChannels = 400;
        state.minItems = 3;
        state.buildMode = 'append';
        state.actorStudioCombineMode = 'combined';

        state.resetForNewSession();

        expect(state.step).toBe(1);
        expect(state.libraries).toEqual([]);
        expect(state.selectedLibraryIds).toEqual(new Set());
        expect(state.loadError).toBeNull();
        expect(state.preview).toBeNull();
        expect(state.previewError).toBeNull();
        expect(state.previewStatus).toBe('idle');
        expect(state.review).toBeNull();
        expect(state.reviewError).toBeNull();
        expect(state.previewDeltas).toEqual({});
        expect(state.previewDeltaExpiresAtMs).toBe(0);
        expect(state.lastPreviewKey).toBeNull();
        expect(state.pendingPreviewKey).toBeNull();
        expect(state.recordApplied).toBe(false);
        expect(state.setupContext).toBe('unknown');
        expect(state.replaceConfirm).toBe(false);
        expect(state.maxChannels).toBe(DEFAULT_CHANNEL_SETUP_MAX);
        expect(state.minItems).toBe(DEFAULT_MIN_ITEMS_PER_CHANNEL);
        expect(state.buildMode).toBe('replace');
        expect(state.actorStudioCombineMode).toBe('separate');
    });

    it('applySetupRecord filters unavailable libraries and sorts strategy priority defensively', () => {
        const state = new ChannelSetupSessionState();
        state.libraries = [
            makeLibrary({ id: 'movies' }),
            makeLibrary({ id: 'shows', type: 'show' }),
            makeLibrary({ id: 'docs' }),
        ];
        state.preview = {
            estimates: {
                total: 4,
                collections: 1,
                playlists: 1,
                genres: 1,
                directors: 0,
                decades: 0,
                recentlyAdded: 0,
                studios: 0,
                actors: 1,
            },
            warnings: ['stale'],
            reachedMaxChannels: false,
        };

        const record: ChannelSetupRecord = {
            serverId: 'server-1',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            selectedLibraryIds: ['missing-library', 'shows'],
            maxChannels: 250,
            buildMode: 'append',
            actorStudioCombineMode: 'combined',
            minItemsPerChannel: 3,
            strategyConfig: {
                playlists: { enabled: false, priority: 1, scope: 'per-library' },
                genres: { enabled: true, priority: 2, scope: 'cross-library' },
                collections: { enabled: true, priority: 3, scope: 'per-library' },
                directors: { enabled: true, priority: 4, scope: 'cross-library' },
                decades: { enabled: true, priority: 5, scope: 'per-library' },
                recentlyAdded: { enabled: true, priority: 6, scope: 'per-library' },
                studios: { enabled: true, priority: 7, scope: 'cross-library' },
                actors: { enabled: true, priority: 8, scope: 'cross-library' },
            },
            channelExpansion: {
                addAlternateLineups: true,
                alternateLineupCopies: 2,
                variantType: 'block',
                variantBlockSize: 4,
            },
            seriesOrdering: {
                basePlaybackMode: 'block',
                baseBlockSize: 5,
            },
        };

        state.applySetupRecord(record);

        expect(state.selectedLibraryIds).toEqual(new Set(['shows']));
        expect(state.strategyOrder.slice(0, 3)).toEqual(['playlists', 'genres', 'collections']);
        expect(state.strategies.genres.scope).toBe('cross-library');
        expect(state.preview).toBeNull();
        expect(state.previewStatus).toBe('idle');
        expect(state.maxChannels).toBe(250);
        expect(state.minItems).toBe(3);
        expect(state.buildMode).toBe('append');
        expect(state.actorStudioCombineMode).toBe('combined');
    });

    it('buildConfig produces the canonical selected-library and strategy payload', () => {
        const state = new ChannelSetupSessionState();
        state.selectedLibraryIds = new Set(['movies', 'shows']);
        state.maxChannels = 300;
        state.minItems = 5;
        state.buildMode = 'append';
        state.actorStudioCombineMode = 'combined';
        state.strategyOrder = ['playlists', 'collections', ...state.strategyOrder.filter((key) => !['playlists', 'collections'].includes(key))];
        state.strategies.playlists.enabled = false;
        state.strategies.genres.scope = 'cross-library';
        state.channelExpansion = {
            addAlternateLineups: true,
            alternateLineupCopies: 2,
            variantType: 'block',
            variantBlockSize: 4,
        };
        state.seriesOrdering = {
            basePlaybackMode: 'block',
            baseBlockSize: 4,
        };

        const config = state.buildConfig('server-1');

        expect(config).toEqual(
            expect.objectContaining({
                serverId: 'server-1',
                selectedLibraryIds: ['movies', 'shows'],
                maxChannels: 300,
                minItemsPerChannel: 5,
                buildMode: 'append',
                actorStudioCombineMode: 'combined',
                channelExpansion: {
                    addAlternateLineups: true,
                    alternateLineupCopies: 2,
                    variantType: 'block',
                    variantBlockSize: 4,
                },
                seriesOrdering: {
                    basePlaybackMode: 'block',
                    baseBlockSize: 4,
                },
            })
        );
        expect(config.strategyConfig.playlists).toEqual(
            expect.objectContaining({
                enabled: false,
                priority: 1,
                scope: 'per-library',
            })
        );
        expect(config.strategyConfig.genres?.scope).toBe('cross-library');
    });

    it('buildPreviewKey ignores build mode when shaping the preview identity', () => {
        const state = new ChannelSetupSessionState();
        const replaceKey = state.buildPreviewKey({
            serverId: 'server-1',
            selectedLibraryIds: ['movies'],
            maxChannels: 100,
            buildMode: 'replace',
            strategyConfig: state.buildConfig('server-1').strategyConfig,
            channelExpansion: state.channelExpansion,
            seriesOrdering: state.seriesOrdering,
            actorStudioCombineMode: state.actorStudioCombineMode,
            minItemsPerChannel: state.minItems,
        });
        const appendKey = state.buildPreviewKey({
            serverId: 'server-1',
            selectedLibraryIds: ['movies'],
            maxChannels: 100,
            buildMode: 'append',
            strategyConfig: state.buildConfig('server-1').strategyConfig,
            channelExpansion: state.channelExpansion,
            seriesOrdering: state.seriesOrdering,
            actorStudioCombineMode: state.actorStudioCombineMode,
            minItemsPerChannel: state.minItems,
        });

        expect(appendKey).toBe(replaceKey);
    });

    it('hasSettledPreviewForKey only returns true for settled preview states with a matching key', () => {
        const state = new ChannelSetupSessionState();
        state.lastPreviewKey = 'stable-key';

        expect(state.hasSettledPreviewForKey('stable-key')).toBe(false);

        state.previewStatus = 'blocked';
        expect(state.hasSettledPreviewForKey('stable-key')).toBe(true);

        state.isPreviewLoading = true;
        expect(state.hasSettledPreviewForKey('stable-key')).toBe(false);

        state.isPreviewLoading = false;
        state.previewStatus = 'idle';
        state.preview = {
            estimates: {
                total: 3,
                collections: 1,
                playlists: 1,
                genres: 1,
                directors: 0,
                decades: 0,
                recentlyAdded: 0,
                studios: 0,
                actors: 0,
            },
            warnings: [],
            reachedMaxChannels: false,
        };
        expect(state.hasSettledPreviewForKey('stable-key')).toBe(true);
        expect(state.hasSettledPreviewForKey('other-key')).toBe(false);
    });
});
