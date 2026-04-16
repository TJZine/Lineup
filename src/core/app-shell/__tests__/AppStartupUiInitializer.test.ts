/**
 * @jest-environment jsdom
 */

import { AppStartupUiInitializer } from '../AppStartupUiInitializer';
import { EXIT_CONFIRM_CONTAINER_ID } from '../../../modules/ui/exit-confirm';
import type { ModuleStatus, OrchestratorConfig } from '../../orchestrator/OrchestratorTypes';

const createConfig = (): OrchestratorConfig => ({
    plexConfig: {} as never,
    navConfig: {} as never,
    playerConfig: {} as never,
    epgConfig: {} as never,
    nowPlayingInfoConfig: { containerId: 'now-playing-info' } as never,
    playerOsdConfig: {} as never,
    channelNumberOverlayConfig: {} as never,
    channelBadgeConfig: {} as never,
    miniGuideConfig: {} as never,
    channelTransitionConfig: {} as never,
    playbackOptionsConfig: { containerId: 'playback-options' } as never,
});

type Deferred<T> = {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
};

const createDeferred = <T>(): Deferred<T> => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    const promise = new Promise<T>((res) => {
        resolve = res;
    });
    return { promise, resolve };
};

describe('AppStartupUiInitializer', () => {
    it('coalesces duplicate initialization calls while initialization is in flight', async () => {
        const deferred = createDeferred<void>();
        const nowPlayingInfo = {
            initialize: jest.fn(() => {
                return deferred.promise;
            }),
        };
        const playbackOptions = { initialize: jest.fn() };
        const exitConfirm = { initialize: jest.fn() };
        const status = {
            updateModuleStatus: jest.fn(),
            getModuleStatus: jest.fn<ModuleStatus['status'] | undefined, [string]>().mockReturnValue(undefined),
        };

        const initializer = new AppStartupUiInitializer(
            createConfig(),
            {
                nowPlayingInfo: nowPlayingInfo as never,
                playbackOptions: playbackOptions as never,
                exitConfirm: exitConfirm as never,
            },
            status
        );

        const first = initializer.ensureCorePlayerUiInitialized();
        const second = initializer.ensureCorePlayerUiInitialized();
        expect(nowPlayingInfo.initialize).toHaveBeenCalledTimes(1);

        deferred.resolve(undefined);
        await Promise.all([first, second]);

        expect(playbackOptions.initialize).toHaveBeenCalledTimes(1);
        expect(exitConfirm.initialize).toHaveBeenCalledTimes(1);
    });

    it('skips missing overlays and only marks available modules ready', async () => {
        const playbackOptions = { initialize: jest.fn() };
        const status = {
            updateModuleStatus: jest.fn(),
            getModuleStatus: jest.fn<ModuleStatus['status'] | undefined, [string]>().mockReturnValue(undefined),
        };
        const initializer = new AppStartupUiInitializer(
            createConfig(),
            {
                nowPlayingInfo: null,
                playbackOptions: playbackOptions as never,
                exitConfirm: null,
            },
            status
        );

        await initializer.ensureCorePlayerUiInitialized();

        expect(playbackOptions.initialize).toHaveBeenCalledTimes(1);
        expect(status.updateModuleStatus).toHaveBeenCalledWith('playback-options-ui', 'initializing');
        expect(status.updateModuleStatus).toHaveBeenCalledWith(
            'playback-options-ui',
            'ready',
            undefined,
            expect.any(Number)
        );
        expect(status.updateModuleStatus).not.toHaveBeenCalledWith('now-playing-info-ui', 'initializing');
        expect(status.updateModuleStatus).not.toHaveBeenCalledWith('exit-confirm-ui', 'initializing');
    });

    it('reports module status transitions initializing -> ready and initializing -> error', async () => {
        const successStatus = {
            updateModuleStatus: jest.fn(),
            getModuleStatus: jest.fn<ModuleStatus['status'] | undefined, [string]>().mockReturnValue(undefined),
        };
        const successInitializer = new AppStartupUiInitializer(
            createConfig(),
            {
                nowPlayingInfo: { initialize: jest.fn() } as never,
                playbackOptions: { initialize: jest.fn() } as never,
                exitConfirm: { initialize: jest.fn() } as never,
            },
            successStatus
        );

        await successInitializer.ensureCorePlayerUiInitialized();
        expect(successStatus.updateModuleStatus).toHaveBeenCalledWith('now-playing-info-ui', 'initializing');
        expect(successStatus.updateModuleStatus).toHaveBeenCalledWith(
            'now-playing-info-ui',
            'ready',
            undefined,
            expect.any(Number)
        );

        const errorStatus = {
            updateModuleStatus: jest.fn(),
            getModuleStatus: jest.fn<ModuleStatus['status'] | undefined, [string]>().mockReturnValue(undefined),
        };
        const errorInitializer = new AppStartupUiInitializer(
            createConfig(),
            {
                nowPlayingInfo: { initialize: jest.fn(() => { throw new Error('boom'); }) } as never,
                playbackOptions: { initialize: jest.fn() } as never,
                exitConfirm: { initialize: jest.fn(({ containerId }) => containerId === EXIT_CONFIRM_CONTAINER_ID) } as never,
            },
            errorStatus
        );

        await expect(errorInitializer.ensureCorePlayerUiInitialized()).rejects.toThrow('boom');
        expect(errorStatus.updateModuleStatus).toHaveBeenCalledWith('now-playing-info-ui', 'initializing');
        expect(errorStatus.updateModuleStatus).toHaveBeenCalledWith(
            'now-playing-info-ui',
            'error',
            expect.objectContaining({
                code: 'MODULE_INIT_FAILED',
                message: 'boom',
                recoverable: true,
            })
        );

        const asyncErrorStatus = {
            updateModuleStatus: jest.fn(),
            getModuleStatus: jest.fn<ModuleStatus['status'] | undefined, [string]>().mockReturnValue(undefined),
        };
        const asyncErrorInitializer = new AppStartupUiInitializer(
            createConfig(),
            {
                nowPlayingInfo: {
                    initialize: jest.fn().mockRejectedValue(new Error('async boom')),
                } as never,
                playbackOptions: { initialize: jest.fn() } as never,
                exitConfirm: { initialize: jest.fn() } as never,
            },
            asyncErrorStatus
        );

        await expect(asyncErrorInitializer.ensureCorePlayerUiInitialized()).rejects.toThrow(
            'async boom'
        );
        expect(asyncErrorStatus.updateModuleStatus).toHaveBeenCalledWith(
            'now-playing-info-ui',
            'error',
            expect.objectContaining({
                code: 'MODULE_INIT_FAILED',
                message: 'async boom',
                recoverable: true,
            })
        );
    });
});
