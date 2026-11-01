/** @jest-environment jsdom */

import { EpgPreferencesStore } from '../../../settings/EpgPreferencesStore';
import { APP_SHELL_CONTAINER_IDS } from '../../common/appShellContainerIds';
import { buildEPGStartupConfig, CLASSIC_EPG_PIP_CLASS, type EPGStartupConfigInputs } from '../startup/EPGStartupConfigRuntime';
import type { EPGConfig } from '../types';

const baseConfig = (): EPGConfig => ({
    containerId: 'epg', visibleChannels: 5, timeSlotMinutes: 30, visibleHours: 2,
    totalHours: 24, pixelsPerMinute: 4, rowHeight: 114, autoScrollToNow: true,
});
const inputs = (): EPGStartupConfigInputs => ({
    epgConfig: baseConfig(), plexLibrary: null, videoPlayer: null, channelManager: null,
    scheduler: null, buildPlexResourceUrl: (path) => path,
    hasUsableRetainedSession: () => false,
    epgPreferencesStore: new EpgPreferencesStore(),
    readShowNowWatchingBanner: () => true,
    debugRuntime: null,
});

describe('buildEPGStartupConfig', () => {
    beforeEach(() => { localStorage.clear(); document.body.innerHTML = ''; });

    it('uses accepted session lineage for paused, buffering and seeking picture states', () => {
        let status: 'playing' | 'paused' | 'buffering' | 'seeking' | 'error' = 'paused';
        let usable = true;
        const input = inputs();
        input.hasUsableRetainedSession = (): boolean => usable;
        input.videoPlayer = {
            getCurrentDescriptor: () => ({ url: 'native' }),
            getState: () => ({ status }),
            on: jest.fn(() => ({ dispose: jest.fn() })),
        } as unknown as EPGStartupConfigInputs['videoPlayer'];
        const video = document.createElement('div');
        video.id = APP_SHELL_CONTAINER_IDS.VIDEO;
        document.body.appendChild(video);
        const config = buildEPGStartupConfig(input);
        for (status of ['paused', 'buffering', 'seeking', 'playing'] as const) {
            expect(config.getPictureStatus?.()).toBe(status);
        }
        usable = false;
        expect(config.getPictureStatus?.()).toBe('untuned');
        status = 'error';
        expect(config.getPictureStatus?.()).toBe('error');
        config.onPictureOperation?.('guide-pip');
        expect(video.classList.contains(CLASSIC_EPG_PIP_CLASS)).toBe(true);
        config.onPictureOperation?.('fullscreen');
        expect(video.classList.contains(CLASSIC_EPG_PIP_CLASS)).toBe(false);
    });

    it('persists selected hours and leaves failed writes unapplied', () => {
        const config = buildEPGStartupConfig(inputs());
        expect(config.onGuideHoursChange?.(4)).toBe(true);
        expect(localStorage.getItem('lineup_epg_guide_hours')).toBe('4');
    });

    it('keeps null dependencies safe', async () => {
        const config = buildEPGStartupConfig(inputs());
        await expect(config.fetchItemDetails?.('rk')).resolves.toBeNull();
        expect(config.getPictureStatus?.()).toBe('untuned');
        expect(config.getCurrentChannelInfo?.()).toBeNull();
    });
});
