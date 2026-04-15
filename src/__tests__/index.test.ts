jest.mock('../bootstrap', () => ({
    installLineupBootstrap: jest.fn(),
}));

describe('src/index', () => {
    afterEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('installs the lineup bootstrap exactly once on module import', () => {
        [
            '../styles/tokens.css',
            '../styles/themes.css',
            '../styles/video.css',
            '../modules/ui/epg/styles.css',
            '../modules/ui/now-playing-info/styles.css',
            '../modules/ui/player-osd/styles.css',
            '../modules/ui/channel-number-overlay/styles.css',
            '../modules/ui/channel-badge/styles.css',
            '../modules/ui/mini-guide/styles.css',
            '../modules/ui/channel-transition/styles.css',
            '../modules/ui/playback-options/styles.css',
            '../modules/ui/exit-confirm/styles.css',
            '../modules/ui/settings/styles.css',
            '../modules/ui/profile-select/styles.css',
            '../modules/ui/server-select/styles.css',
            '../modules/ui/audio-setup/styles.css',
            '../modules/ui/channel-setup/styles.css',
            '../styles/shell.css',
        ].forEach((path) => {
            jest.doMock(path, () => ({}));
        });

        let installLineupBootstrap!: jest.Mock;
        jest.isolateModules(() => {
            installLineupBootstrap = (require('../bootstrap') as {
                installLineupBootstrap: jest.Mock;
            }).installLineupBootstrap;
            require('../index');
        });
        expect(installLineupBootstrap).toHaveBeenCalledTimes(1);
    });
});
