/** @jest-environment jsdom */

import { APP_SHELL_CONTAINER_IDS } from '../../common/appShellContainerIds';
import {
    CLASSIC_EPG_PIP_CLASS,
    EPGStartupConfigRuntime,
    type EPGStartupConfigRuntimeDependencies,
} from '../startup/EPGStartupConfigRuntime';

const dependencies = (): EPGStartupConfigRuntimeDependencies => ({
    plexLibrary: null, videoPlayer: null, channelManager: null, scheduler: null,
    buildPlexResourceUrl: (path) => path,
    hasUsableRetainedSession: () => false,
    previousOnPictureOperation: null,
});

describe('EPGStartupConfigRuntime', () => {
    afterEach(() => { document.body.innerHTML = ''; });

    it('keeps null runtime seams safe', async () => {
        const runtime = new EPGStartupConfigRuntime(dependencies());
        await expect(runtime.fetchItemDetails('rk')).resolves.toBeNull();
        expect(runtime.resolveThumbUrl(null)).toBeNull();
        expect(runtime.getCurrentChannelInfo()).toBeNull();
        expect(runtime.getPictureStatus()).toBe('untuned');
    });

    it('applies explicit Guide PiP and fullscreen operations with cleanup', () => {
        const previousOnPictureOperation = jest.fn();
        const runtime = new EPGStartupConfigRuntime({ ...dependencies(), previousOnPictureOperation });
        const video = document.createElement('div');
        video.id = APP_SHELL_CONTAINER_IDS.VIDEO;
        document.body.appendChild(video);
        runtime.onPictureOperation('guide-pip');
        expect(video.classList.contains(CLASSIC_EPG_PIP_CLASS)).toBe(true);
        runtime.onPictureOperation('fullscreen');
        expect(video.classList.contains(CLASSIC_EPG_PIP_CLASS)).toBe(false);
        expect(video.dataset.guidePictureStatus).toBeUndefined();
        expect(previousOnPictureOperation.mock.calls).toEqual([['guide-pip'], ['fullscreen']]);
    });
});
