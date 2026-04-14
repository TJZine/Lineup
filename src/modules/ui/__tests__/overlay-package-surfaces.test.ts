import {
    NowPlayingInfoCoordinator,
    getNowPlayingInfoAutoHideMs,
} from '../now-playing-info';
import { PlayerOsdCoordinator } from '../player-osd';
import { MiniGuideCoordinator } from '../mini-guide';
import { ChannelTransitionCoordinator } from '../channel-transition';
import { PlaybackOptionsCoordinator } from '../playback-options';
import { ExitConfirmCoordinator } from '../exit-confirm';

describe('overlay package root surfaces', () => {
    it('exports coordinator seams consumed by core from feature roots', () => {
        expect(NowPlayingInfoCoordinator).toBeDefined();
        expect(getNowPlayingInfoAutoHideMs).toBeDefined();
        expect(PlayerOsdCoordinator).toBeDefined();
        expect(MiniGuideCoordinator).toBeDefined();
        expect(ChannelTransitionCoordinator).toBeDefined();
        expect(PlaybackOptionsCoordinator).toBeDefined();
        expect(ExitConfirmCoordinator).toBeDefined();
    });
});
