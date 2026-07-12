/**
 * @jest-environment jsdom
 */

import { LINEUP_STORAGE_KEYS } from '../../../config/storageKeys';
import { flushPromises, setDevBuildForTest } from '../../../__tests__/helpers';
import { DebugOverridesStore } from '../../../modules/debug/DebugOverridesStore';
import { APP_SHELL_CONTAINER_IDS } from '../../../modules/ui/common/appShellContainerIds';
import { AppDiagnosticsSurface } from '../diagnostics/AppDiagnosticsSurface';
import type { AppDiagnosticsAudioSettingsStore } from '../diagnostics/AppDiagnosticsDevMenuController';
import type { AppShellDiagnosticsRuntimePort } from '../runtime/AppShellRuntimeContracts';
import type { ChannelSetupWorkflowPort } from '../../channel-setup/workflow/ChannelSetupWorkflowPort';

const createContainer = (): HTMLDivElement => {
    const el = document.createElement('div');
    el.id = APP_SHELL_CONTAINER_IDS.DEV_MENU;
    el.style.display = 'none';
    return el;
};

const createSnapshot = (): { channel: null; program: null; stream: null } => ({
    channel: null,
    program: null,
    stream: null,
});

const createWorkflowPort = (
    overrides: Partial<jest.Mocked<ChannelSetupWorkflowPort>> = {}
): jest.Mocked<ChannelSetupWorkflowPort> => ({
    invalidateFacetSnapshot: jest.fn(),
    getLibrariesForSetup: jest.fn().mockResolvedValue([]),
    getChannelSetupRecord: jest.fn().mockReturnValue(null),
    getSetupContextForSelectedServer: jest.fn().mockReturnValue('unknown'),
    getSetupPreview: jest.fn().mockResolvedValue({
        estimates: {
            total: 0,
            collections: 0,
            playlists: 0,
            genres: 0,
            directors: 0,
            decades: 0,
            recentlyAdded: 0,
            studios: 0,
            actors: 0,
        },
        warnings: [],
        reachedMaxChannels: false,
    }),
    getSetupReview: jest.fn().mockResolvedValue({
        preview: {
            estimates: {
                total: 0,
                collections: 0,
                playlists: 0,
                genres: 0,
                directors: 0,
                decades: 0,
                recentlyAdded: 0,
                studios: 0,
                actors: 0,
            },
            warnings: [],
            reachedMaxChannels: false,
        },
        diff: {
            summary: { created: 0, removed: 0, unchanged: 0 },
            samples: { created: [], removed: [], unchanged: [] },
        },
    }),
    getSetupPlanDiagnostics: jest.fn().mockResolvedValue({
        status: 'ready',
        diagnostics: null,
        warnings: [],
        reachedMaxChannels: false,
    }),
    createChannelsFromSetup: jest.fn().mockResolvedValue({
        created: 0,
        skipped: 0,
        reachedMaxChannels: false,
        errorCount: 0,
        canceled: false,
        lastTask: 'done',
    }),
    markSetupComplete: jest.fn(),
    ...overrides,
});

const createOrchestrator = (
    overrides: Partial<AppShellDiagnosticsRuntimePort> = {}
): AppShellDiagnosticsRuntimePort => ({
    toggleServerSelect: jest.fn(),
    refreshPlaybackInfoSnapshot: jest.fn().mockResolvedValue(createSnapshot()),
    getSelectedServerId: jest.fn().mockReturnValue('server-1'),
    getChannelSetupWorkflowPort: jest.fn().mockReturnValue(createWorkflowPort()),
    ...overrides,
});

describe('AppDiagnosticsSurface', () => {
    let surface: AppDiagnosticsSurface | null = null;
    let restoreDevBuild: (() => void) | null = null;

    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = '';
        restoreDevBuild?.();
        restoreDevBuild = setDevBuildForTest(true);
    });

    afterEach(() => {
        surface?.dispose();
        surface = null;
        jest.restoreAllMocks();
        document.body.innerHTML = '';
        localStorage.clear();
        restoreDevBuild?.();
        restoreDevBuild = null;
        try {
            delete (window as { lineup?: unknown }).lineup;
        } catch {
            // ignore
        }
    });

    it('binds debug key handlers and global lineup helper when enabled', async () => {
        const toggleServerSelect = jest.fn();
        const refreshPlaybackInfoSnapshot = jest.fn().mockResolvedValue(createSnapshot());
        const showToast = jest.fn();
        const container = createContainer();
        document.body.appendChild(container);

        surface = new AppDiagnosticsSurface({
            getDiagnosticsRuntime: (): AppShellDiagnosticsRuntimePort =>
                createOrchestrator({ toggleServerSelect, refreshPlaybackInfoSnapshot }),
            showToast,
            debugOverridesStore: new DebugOverridesStore(),
        });
        surface.setContainer(container);
        surface.initialize();

        expect(typeof (window as { lineup?: { toggleDevMenu: () => void } }).lineup?.toggleDevMenu).toBe('function');

        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyI' }));
        expect(toggleServerSelect).toHaveBeenCalledTimes(1);

        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', ctrlKey: true, shiftKey: true }));
        await flushPromises();

        expect(container.style.display).toBe('block');
    });

    it('does not expose helper or react to shortcuts when debug surface is disabled', async () => {
        restoreDevBuild?.();
        restoreDevBuild = setDevBuildForTest(false);
        localStorage.removeItem(LINEUP_STORAGE_KEYS.DEBUG_LOGGING);
        const toggleServerSelect = jest.fn();
        const refreshPlaybackInfoSnapshot = jest.fn().mockResolvedValue(createSnapshot());
        const container = createContainer();
        document.body.appendChild(container);

        surface = new AppDiagnosticsSurface({
            getDiagnosticsRuntime: (): AppShellDiagnosticsRuntimePort =>
                createOrchestrator({ toggleServerSelect, refreshPlaybackInfoSnapshot }),
            showToast: jest.fn(),
            debugOverridesStore: new DebugOverridesStore(),
        });
        surface.setContainer(container);
        surface.initialize();

        expect((window as { lineup?: unknown }).lineup).toBeUndefined();

        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyI' }));
        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', ctrlKey: true, shiftKey: true }));
        await flushPromises();

        expect(toggleServerSelect).not.toHaveBeenCalled();
        expect(container.style.display).toBe('none');
        expect(container.innerHTML).toBe('');
    });

    it('renders playback info on open and supports refresh button', async () => {
        const refreshPlaybackInfoSnapshot = jest.fn().mockResolvedValue(createSnapshot());
        const container = createContainer();
        document.body.appendChild(container);

        surface = new AppDiagnosticsSurface({
            getDiagnosticsRuntime: (): AppShellDiagnosticsRuntimePort =>
                createOrchestrator({ toggleServerSelect: jest.fn(), refreshPlaybackInfoSnapshot }),
            showToast: jest.fn(),
            debugOverridesStore: new DebugOverridesStore(),
        });
        surface.setContainer(container);
        surface.initialize();

        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', ctrlKey: true, shiftKey: true }));
        await flushPromises();

        const playbackPre = container.querySelector('#dev-playback-info');
        const refreshButton = container.querySelector('#dev-playback-refresh');
        expect(playbackPre).toBeInstanceOf(HTMLPreElement);
        expect(refreshButton).toBeInstanceOf(HTMLButtonElement);
        expect((playbackPre as HTMLPreElement).textContent ?? '').toContain('PLAYBACK INFO');
        expect(refreshPlaybackInfoSnapshot).toHaveBeenCalledTimes(1);

        (refreshButton as HTMLButtonElement).click();
        await flushPromises();

        expect(refreshPlaybackInfoSnapshot).toHaveBeenCalledTimes(2);
    });

    it('uses the injected audio settings store for dev-menu audio fallback overrides', async () => {
        const audioSettingsStore: jest.Mocked<AppDiagnosticsAudioSettingsStore> = {
            readDirectPlayAudioFallbackEnabledAndClean: jest.fn(() => true),
            writeDirectPlayAudioFallbackEnabled: jest.fn((_enabled: boolean) => ({ ok: true })),
            clearDirectPlayAudioFallbackEnabled: jest.fn(),
        };
        const container = createContainer();
        document.body.appendChild(container);

        surface = new AppDiagnosticsSurface({
            getDiagnosticsRuntime: (): AppShellDiagnosticsRuntimePort => createOrchestrator(),
            showToast: jest.fn(),
            debugOverridesStore: new DebugOverridesStore(),
            audioSettingsStore,
        });
        surface.setContainer(container);
        surface.initialize();

        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', ctrlKey: true, shiftKey: true }));
        await flushPromises();

        const fallbackToggle = container.querySelector('#dev-directplay-audio-fallback');
        const saveButton = container.querySelector('#dev-transcode-save');
        expect(fallbackToggle).toBeInstanceOf(HTMLInputElement);
        expect(saveButton).toBeInstanceOf(HTMLButtonElement);
        expect((fallbackToggle as HTMLInputElement).checked).toBe(true);

        (fallbackToggle as HTMLInputElement).checked = false;
        (saveButton as HTMLButtonElement).click();

        expect(audioSettingsStore.writeDirectPlayAudioFallbackEnabled).toHaveBeenCalledWith(false);
    });

    it('does not claim dev overrides were saved when audio persistence fails', async () => {
            const audioSettingsStore: jest.Mocked<AppDiagnosticsAudioSettingsStore> = {
                readDirectPlayAudioFallbackEnabledAndClean: jest.fn(() => true),
                writeDirectPlayAudioFallbackEnabled: jest.fn((_enabled: boolean) => ({ ok: false })),
                clearDirectPlayAudioFallbackEnabled: jest.fn(),
            };
            const debugOverridesStore = new DebugOverridesStore();
            const debugWrite = jest.spyOn(debugOverridesStore, 'writeNowPlayingStreamDebugEnabled');
            const showToast = jest.fn();
            const container = createContainer();
            document.body.appendChild(container);

            surface = new AppDiagnosticsSurface({
                getDiagnosticsRuntime: (): AppShellDiagnosticsRuntimePort => createOrchestrator(),
                showToast,
                debugOverridesStore,
                audioSettingsStore,
            });
            surface.setContainer(container);
            surface.initialize();

            document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', ctrlKey: true, shiftKey: true }));
            await flushPromises();

            const fallbackToggle = container.querySelector('#dev-directplay-audio-fallback') as HTMLInputElement;
            const saveButton = container.querySelector('#dev-transcode-save') as HTMLButtonElement;
            fallbackToggle.checked = false;
            saveButton.click();

            expect(fallbackToggle.checked).toBe(true);
            expect(debugWrite).not.toHaveBeenCalled();
            expect(showToast).toHaveBeenCalledWith({
                message: 'Could not save overrides. Check device storage and try again.',
                type: 'warning',
            });
            expect(showToast).not.toHaveBeenCalledWith({ message: 'Saved overrides', type: 'success' });
    });

    it('dumps saved channel-setup planner diagnostics through the global helper', async () => {
        const getSetupPlanDiagnostics = jest.fn().mockResolvedValue({
            status: 'ready',
            diagnostics: {
                effectiveMaxChannels: 500,
                minItems: 5,
                allocationMode: 'priority-balanced-round-robin',
                fetchedTagsByFamily: {
                    genres: [{ libraryId: 'lib-1', libraryName: 'Shows', count: 4 }],
                    directors: [{ libraryId: 'lib-1', libraryName: 'Shows', count: 2 }],
                    decades: [],
                    studios: [{ libraryId: 'lib-1', libraryName: 'Shows', count: 1 }],
                    actors: [{ libraryId: 'lib-1', libraryName: 'Shows', count: 9 }],
                },
                tagCountDiagnosticsByFamily: {
                    genres: [{
                        libraryId: 'lib-1',
                        libraryName: 'Shows',
                        rawTagCount: 4,
                        effectiveCandidateCount: 4,
                        candidatesWithKnownCount: 4,
                        candidatesWithUnknownCount: 0,
                        candidatesBelowMinItems: 1,
                        minKnownCount: 2,
                        maxKnownCount: 22,
                        sampleKnownCounts: [{ title: 'Comedy', count: 22 }],
                        sampleUnknownCountTitles: [],
                        sampleBelowMinItems: [{ title: 'Mystery', count: 2 }],
                    }],
                    directors: [{
                        libraryId: 'lib-1',
                        libraryName: 'Shows',
                        rawTagCount: 2,
                        effectiveCandidateCount: 2,
                        candidatesWithKnownCount: 2,
                        candidatesWithUnknownCount: 0,
                        candidatesBelowMinItems: 1,
                        minKnownCount: 4,
                        maxKnownCount: 14,
                        sampleKnownCounts: [{ title: 'Jane Doe', count: 14 }],
                        sampleUnknownCountTitles: [],
                        sampleBelowMinItems: [{ title: 'John Roe', count: 4 }],
                    }],
                    decades: [],
                    studios: [{
                        libraryId: 'lib-1',
                        libraryName: 'Shows',
                        rawTagCount: 1,
                        effectiveCandidateCount: 1,
                        candidatesWithKnownCount: 1,
                        candidatesWithUnknownCount: 0,
                        candidatesBelowMinItems: 0,
                        minKnownCount: 7,
                        maxKnownCount: 7,
                        sampleKnownCounts: [{ title: 'Studio A', count: 7 }],
                        sampleUnknownCountTitles: [],
                        sampleBelowMinItems: [],
                    }],
                    actors: [{
                        libraryId: 'lib-1',
                        libraryName: 'Shows',
                        rawTagCount: 9,
                        effectiveCandidateCount: 9,
                        candidatesWithKnownCount: 7,
                        candidatesWithUnknownCount: 2,
                        candidatesBelowMinItems: 2,
                        minKnownCount: 1,
                        maxKnownCount: 30,
                        sampleKnownCounts: [{ title: 'Lead Actor', count: 30 }],
                        sampleUnknownCountTitles: ['Mystery Guest', 'Unknown Star'],
                        sampleBelowMinItems: [{ title: 'Bit Part', count: 1 }],
                    }],
                },
                candidatesBeforeMinItems: {
                    total: 16,
                    collections: 0,
                    playlists: 0,
                    genres: 4,
                    directors: 2,
                    decades: 0,
                    recentlyAdded: 0,
                    studios: 1,
                    actors: 9,
                },
                candidatesAfterMinItems: {
                    total: 12,
                    collections: 0,
                    playlists: 0,
                    genres: 3,
                    directors: 1,
                    decades: 0,
                    recentlyAdded: 0,
                    studios: 1,
                    actors: 7,
                },
                strategyBucketSizes: {
                    total: 12,
                    collections: 0,
                    playlists: 0,
                    genres: 3,
                    directors: 1,
                    decades: 0,
                    recentlyAdded: 0,
                    studios: 1,
                    actors: 7,
                },
                afterAlternateLineups: {
                    total: 12,
                    collections: 0,
                    playlists: 0,
                    genres: 3,
                    directors: 1,
                    decades: 0,
                    recentlyAdded: 0,
                    studios: 1,
                    actors: 7,
                },
                afterVariants: {
                    total: 12,
                    collections: 0,
                    playlists: 0,
                    genres: 3,
                    directors: 1,
                    decades: 0,
                    recentlyAdded: 0,
                    studios: 1,
                    actors: 7,
                },
                allocationBudgetByStrategy: {
                    total: 10,
                    collections: 0,
                    playlists: 0,
                    genres: 3,
                    directors: 0,
                    decades: 0,
                    recentlyAdded: 0,
                    studios: 0,
                    actors: 7,
                },
                selectedBeforeGlobalCapByStrategy: {
                    total: 10,
                    collections: 0,
                    playlists: 0,
                    genres: 3,
                    directors: 0,
                    decades: 0,
                    recentlyAdded: 0,
                    studios: 0,
                    actors: 7,
                },
                lostToAllocationByStrategy: {
                    total: 2,
                    collections: 0,
                    playlists: 0,
                    genres: 0,
                    directors: 1,
                    decades: 0,
                    recentlyAdded: 0,
                    studios: 1,
                    actors: 0,
                },
                afterMaxChannels: {
                    total: 10,
                    collections: 0,
                    playlists: 0,
                    genres: 3,
                    directors: 0,
                    decades: 0,
                    recentlyAdded: 0,
                    studios: 0,
                    actors: 7,
                },
                lostToMaxChannels: {
                    total: 2,
                    collections: 0,
                    playlists: 0,
                    genres: 0,
                    directors: 1,
                    decades: 0,
                    recentlyAdded: 0,
                    studios: 1,
                    actors: 0,
                },
            },
            warnings: [],
            reachedMaxChannels: true,
        });
        const workflowPort = createWorkflowPort({
            getChannelSetupRecord: jest.fn().mockReturnValue({
                serverId: 'server-1',
                selectedLibraryIds: ['lib-1'],
                maxChannels: 500,
                buildMode: 'replace',
                strategyConfig: {
                    collections: { enabled: false, priority: 1, scope: 'per-library' },
                    playlists: { enabled: false, priority: 2, scope: 'per-library' },
                    genres: { enabled: true, priority: 3, scope: 'per-library' },
                    directors: { enabled: true, priority: 4, scope: 'per-library' },
                    decades: { enabled: false, priority: 5, scope: 'per-library' },
                    recentlyAdded: { enabled: false, priority: 6, scope: 'per-library' },
                    studios: { enabled: true, priority: 7, scope: 'per-library' },
                    actors: { enabled: true, priority: 8, scope: 'per-library' },
                },
                actorStudioCombineMode: 'separate',
                minItemsPerChannel: 5,
                createdAt: 1,
                updatedAt: 2,
            }),
            getSetupPlanDiagnostics,
        });
        const consoleInfo = jest.spyOn(console, 'info').mockImplementation(() => {});
        const consoleGroupCollapsed = jest.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
        const consoleGroupEnd = jest.spyOn(console, 'groupEnd').mockImplementation(() => {});
        const container = createContainer();
        document.body.appendChild(container);

        surface = new AppDiagnosticsSurface({
            getDiagnosticsRuntime: (): AppShellDiagnosticsRuntimePort =>
                createOrchestrator({ getChannelSetupWorkflowPort: jest.fn().mockReturnValue(workflowPort) }),
            showToast: jest.fn(),
            debugOverridesStore: new DebugOverridesStore(),
        });
        surface.setContainer(container);
        surface.initialize();

        const dump = await (window as {
            lineup?: { dumpChannelSetupPlannerDiagnostics: () => Promise<unknown> };
        }).lineup?.dumpChannelSetupPlannerDiagnostics();

        expect(getSetupPlanDiagnostics).toHaveBeenCalledWith(
            expect.objectContaining({ serverId: 'server-1', selectedLibraryIds: ['lib-1'] })
        );
        expect(dump).toEqual(expect.objectContaining({
            selectedServerId: 'server-1',
            recordSource: 'saved-record',
            result: expect.objectContaining({ reachedMaxChannels: true }),
        }));
        expect(consoleInfo).toHaveBeenCalledWith('Selected server:', 'server-1');
        expect(consoleInfo).toHaveBeenCalledWith('Planner summary:', expect.objectContaining({
            status: 'ready',
            reachedMaxChannels: true,
            warningCount: 0,
            effectiveMaxChannels: 500,
            minItems: 5,
            candidatesBeforeMinItems: 16,
            candidatesAfterMinItems: 12,
            afterMaxChannels: 10,
            lostToMaxChannels: 2,
        }));
        expect(consoleInfo).toHaveBeenCalledWith('Planner facet families:', expect.arrayContaining([
            expect.objectContaining({
                family: 'actors',
                fetchedLibraryCount: 1,
                diagnosticLibraryCount: 1,
                sampleKnownCounts: ['Lead Actor (30)'],
            }),
            expect.objectContaining({
                family: 'genres',
                fetchedLibraryCount: 1,
                diagnosticLibraryCount: 1,
                sampleBelowMinItems: ['Mystery (2)'],
            }),
        ]));
        expect(consoleInfo).not.toHaveBeenCalledWith('Diagnostics payload:', expect.anything());
        expect(consoleGroupCollapsed).toHaveBeenCalledWith('[lineup] Channel setup planner diagnostics');
        expect(consoleGroupEnd).toHaveBeenCalled();
    });

    it('dumps active channel-setup planner diagnostics through the global helper', async () => {
        const activeConfig = {
            serverId: 'server-1',
            selectedLibraryIds: ['lib-1'],
            maxChannels: 300,
            buildMode: 'replace' as const,
            strategyConfig: {
                collections: { enabled: false, priority: 1, scope: 'per-library' as const },
                playlists: { enabled: false, priority: 2, scope: 'per-library' as const },
                genres: { enabled: false, priority: 3, scope: 'per-library' as const },
                directors: { enabled: true, priority: 4, scope: 'per-library' as const },
                decades: { enabled: false, priority: 5, scope: 'per-library' as const },
                recentlyAdded: { enabled: false, priority: 6, scope: 'per-library' as const },
                studios: { enabled: false, priority: 7, scope: 'per-library' as const },
                actors: { enabled: false, priority: 8, scope: 'per-library' as const },
            },
            actorStudioCombineMode: 'separate' as const,
            minItemsPerChannel: 20,
        };
        const getSetupPlanDiagnostics = jest.fn().mockResolvedValue({
            status: 'ready',
            diagnostics: null,
            warnings: [],
            reachedMaxChannels: false,
        });
        const workflowPort = createWorkflowPort({
            getSetupPlanDiagnostics,
        });
        const consoleInfo = jest.spyOn(console, 'info').mockImplementation(() => {});
        const consoleGroupCollapsed = jest.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
        const consoleGroupEnd = jest.spyOn(console, 'groupEnd').mockImplementation(() => {});
        const container = createContainer();
        document.body.appendChild(container);

        surface = new AppDiagnosticsSurface({
            getDiagnosticsRuntime: (): AppShellDiagnosticsRuntimePort =>
                createOrchestrator({ getChannelSetupWorkflowPort: jest.fn().mockReturnValue(workflowPort) }),
            getActiveChannelSetupConfig: (): typeof activeConfig => activeConfig,
            showToast: jest.fn(),
            debugOverridesStore: new DebugOverridesStore(),
        });
        surface.setContainer(container);
        surface.initialize();

        const dump = await (window as {
            lineup?: { dumpActiveChannelSetupPlannerDiagnostics: () => Promise<unknown> };
        }).lineup?.dumpActiveChannelSetupPlannerDiagnostics();

        expect(getSetupPlanDiagnostics).toHaveBeenCalledWith(activeConfig);
        expect(dump).toEqual(expect.objectContaining({
            selectedServerId: 'server-1',
            recordSource: 'active-screen',
            config: activeConfig,
        }));
        expect(consoleInfo).toHaveBeenCalledWith('Record source:', 'active-screen');
        expect(consoleInfo).toHaveBeenCalledWith('Planner summary:', expect.objectContaining({
            status: 'ready',
            reachedMaxChannels: false,
            warningCount: 0,
        }));
        expect(consoleInfo).not.toHaveBeenCalledWith('Planner facet families:', expect.anything());
        expect(consoleGroupCollapsed).toHaveBeenCalledWith('[lineup] Channel setup planner diagnostics');
        expect(consoleGroupEnd).toHaveBeenCalled();
    });

    it('dispose removes key handlers and lineup helper', async () => {
        const toggleServerSelect = jest.fn();
        const refreshPlaybackInfoSnapshot = jest.fn().mockResolvedValue(createSnapshot());
        const container = createContainer();
        document.body.appendChild(container);

        surface = new AppDiagnosticsSurface({
            getDiagnosticsRuntime: (): AppShellDiagnosticsRuntimePort =>
                createOrchestrator({ toggleServerSelect, refreshPlaybackInfoSnapshot }),
            showToast: jest.fn(),
            debugOverridesStore: new DebugOverridesStore(),
        });
        surface.setContainer(container);
        surface.initialize();

        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyI' }));
        expect(toggleServerSelect).toHaveBeenCalledTimes(1);

        surface.dispose();
        surface = null;

        expect((window as { lineup?: unknown }).lineup).toBeUndefined();

        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyI' }));
        expect(toggleServerSelect).toHaveBeenCalledTimes(1);
    });

    it('keeps the close button safe after dispose when the menu was already rendered', async () => {
        const refreshPlaybackInfoSnapshot = jest.fn().mockResolvedValue(createSnapshot());
        const container = createContainer();
        document.body.appendChild(container);

        surface = new AppDiagnosticsSurface({
            getDiagnosticsRuntime: (): AppShellDiagnosticsRuntimePort =>
                createOrchestrator({ toggleServerSelect: jest.fn(), refreshPlaybackInfoSnapshot }),
            showToast: jest.fn(),
            debugOverridesStore: new DebugOverridesStore(),
        });
        surface.setContainer(container);
        surface.initialize();

        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', ctrlKey: true, shiftKey: true }));
        await flushPromises();

        const closeButton = container.querySelector('#dev-close');
        expect(closeButton).toBeInstanceOf(HTMLButtonElement);
        expect(container.style.display).toBe('block');

        surface.dispose();
        surface = null;

        expect(() => (closeButton as HTMLButtonElement).click()).not.toThrow();
        expect(container.style.display).toBe('none');
    });

    it('writes debug override keys through DebugOverridesStore-backed flow', async () => {
        const showToast = jest.fn();
        const container = createContainer();
        document.body.appendChild(container);

        surface = new AppDiagnosticsSurface({
            getDiagnosticsRuntime: (): AppShellDiagnosticsRuntimePort => createOrchestrator(),
            showToast,
            debugOverridesStore: new DebugOverridesStore(),
        });
        surface.setContainer(container);
        surface.initialize();

        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', ctrlKey: true, shiftKey: true }));
        await flushPromises();

        const debugToggle = container.querySelector('#dev-nowplaying-stream-debug') as HTMLInputElement;
        const autoToggle = container.querySelector('#dev-nowplaying-stream-debug-auto') as HTMLInputElement;
        const profileSelect = container.querySelector('#dev-transcode-profile-name') as HTMLSelectElement;
        const saveButton = container.querySelector('#dev-transcode-save') as HTMLButtonElement;

        debugToggle.checked = true;
        autoToggle.checked = true;
        profileSelect.value = 'Generic';
        saveButton.click();

        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.NOW_PLAYING_STREAM_DEBUG)).toBe('1');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.NOW_PLAYING_STREAM_DEBUG_AUTO_SHOW)).toBe('1');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.TRANSCODE_PROFILE_NAME)).toBe('Generic');
        expect(showToast).toHaveBeenCalledWith({ message: 'Saved overrides', type: 'success' });
    });
});
