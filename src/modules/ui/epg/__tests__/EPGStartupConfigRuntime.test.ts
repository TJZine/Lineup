/**
 * @jest-environment jsdom
 */

import { APP_SHELL_CONTAINER_IDS } from '../../common/appShellContainerIds';
import {
    CLASSIC_EPG_PIP_CLASS,
    EPGStartupConfigRuntime,
    type EPGStartupConfigRuntimeDependencies,
} from '../EPGStartupConfigRuntime';

const createDependencies = (): EPGStartupConfigRuntimeDependencies => ({
    plexLibrary: null,
    videoPlayer: null,
    channelManager: null,
    scheduler: null,
    buildPlexResourceUrl: jest.fn((path: string | null) => path ? `https://fallback.test${path}` : null),
    previousOnLayoutModeChange: null,
});

describe('EPGStartupConfigRuntime', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
    });

    it('keeps direct runtime seams safe for null dependencies', async () => {
        const runtime = new EPGStartupConfigRuntime(createDependencies());

        await expect(runtime.fetchItemDetails('rk-1')).resolves.toBeNull();
        expect(runtime.resolveThumbUrl(null)).toBeNull();
        expect(runtime.getCurrentChannelInfo()).toBeNull();
        expect(runtime.isVideoPlaying()).toBe(false);
    });

    it('chains layout-mode changes through the DOM seam', () => {
        const previousOnLayoutModeChange = jest.fn();
        const runtime = new EPGStartupConfigRuntime({
            ...createDependencies(),
            previousOnLayoutModeChange,
        });
        const videoContainer = document.createElement('div');
        videoContainer.id = APP_SHELL_CONTAINER_IDS.VIDEO;
        document.body.appendChild(videoContainer);

        runtime.onLayoutModeChange('classic');
        runtime.onLayoutModeChange('overlay');

        expect(previousOnLayoutModeChange).toHaveBeenNthCalledWith(1, 'classic');
        expect(previousOnLayoutModeChange).toHaveBeenNthCalledWith(2, 'overlay');
        expect(videoContainer.classList.contains(CLASSIC_EPG_PIP_CLASS)).toBe(false);
    });
});
