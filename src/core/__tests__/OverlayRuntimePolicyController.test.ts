import {
    OverlayRuntimePolicyController,
    type OverlayRuntimePolicyControllerDeps,
} from '../orchestrator/controllers/OverlayRuntimePolicyController';

type OverlayHarness = {
    controller: OverlayRuntimePolicyController;
    deps: jest.Mocked<OverlayRuntimePolicyControllerDeps>;
};

const makeOverlayHarness = (
    overrides: Partial<OverlayRuntimePolicyControllerDeps> = {}
): OverlayHarness => {
    const deps = {
        hasChannelBadgeOverlay: jest.fn<boolean, []>().mockReturnValue(true),
        getPlayerOsdVisible: jest.fn<boolean, []>().mockReturnValue(false),
        getNowPlayingInfoVisible: jest.fn<boolean, []>().mockReturnValue(false),
        getEpgVisible: jest.fn<boolean, []>().mockReturnValue(false),
        isChannelTransitionActive: jest.fn<boolean, []>().mockReturnValue(false),
        getCurrentChannel: jest.fn<
            { number: number; name: string } | null,
            []
        >().mockReturnValue(null),
        showChannelBadge: jest.fn<void, [{ channelNumber: number; channelName: string }]>(),
        hideChannelBadge: jest.fn<void, []>(),
        hasNavigation: jest.fn<boolean, []>().mockReturnValue(true),
        hasNowPlayingInfoOverlay: jest.fn<boolean, []>().mockReturnValue(true),
        getCurrentScreen: jest.fn<string | null, []>().mockReturnValue('player'),
        hasCurrentProgramForPlayback: jest.fn<boolean, []>().mockReturnValue(true),
        isModalOpen: jest.fn<boolean, [string?]>().mockReturnValue(false),
        openModal: jest.fn<void, [string]>(),
        closeModal: jest.fn<void, [string]>(),
        nowPlayingModalId: 'now-playing-info',
        ...overrides,
    } as unknown as jest.Mocked<OverlayRuntimePolicyControllerDeps>;

    return {
        controller: new OverlayRuntimePolicyController(deps),
        deps,
    };
};

describe('OverlayRuntimePolicyController', () => {
    it('returns immediately when the channel badge overlay is unavailable', () => {
        const { controller, deps } = makeOverlayHarness({
            hasChannelBadgeOverlay: jest.fn().mockReturnValue(false),
        });

        controller.syncChannelBadgeOverlay();

        expect(deps.getPlayerOsdVisible).not.toHaveBeenCalled();
        expect(deps.getNowPlayingInfoVisible).not.toHaveBeenCalled();
        expect(deps.getCurrentChannel).not.toHaveBeenCalled();
        expect(deps.hideChannelBadge).not.toHaveBeenCalled();
        expect(deps.showChannelBadge).not.toHaveBeenCalled();
    });

    it('hides the badge when both overlays are hidden', () => {
        const { controller, deps } = makeOverlayHarness({
            getPlayerOsdVisible: jest.fn().mockReturnValue(false),
            getNowPlayingInfoVisible: jest.fn().mockReturnValue(false),
        });

        controller.syncChannelBadgeOverlay();

        expect(deps.hideChannelBadge).toHaveBeenCalledTimes(1);
        expect(deps.getCurrentChannel).not.toHaveBeenCalled();
        expect(deps.showChannelBadge).not.toHaveBeenCalled();
    });

    it('hides the badge when at least one overlay is visible but there is no current channel', () => {
        const { controller, deps } = makeOverlayHarness({
            getPlayerOsdVisible: jest.fn().mockReturnValue(true),
            getNowPlayingInfoVisible: jest.fn().mockReturnValue(false),
            getCurrentChannel: jest.fn().mockReturnValue(null),
        });

        controller.syncChannelBadgeOverlay();

        expect(deps.getCurrentChannel).toHaveBeenCalledTimes(1);
        expect(deps.hideChannelBadge).toHaveBeenCalledTimes(1);
        expect(deps.showChannelBadge).not.toHaveBeenCalled();
    });

    it('shows the badge with the current channel number and name when eligible', () => {
        const { controller, deps } = makeOverlayHarness({
            getPlayerOsdVisible: jest.fn().mockReturnValue(false),
            getNowPlayingInfoVisible: jest.fn().mockReturnValue(true),
            getEpgVisible: jest.fn().mockReturnValue(false),
            getCurrentChannel: jest.fn().mockReturnValue({ number: 7, name: 'Movies' }),
        });

        controller.syncChannelBadgeOverlay();

        expect(deps.hideChannelBadge).not.toHaveBeenCalled();
        expect(deps.showChannelBadge).toHaveBeenCalledTimes(1);
        expect(deps.showChannelBadge).toHaveBeenCalledWith({
            channelNumber: 7,
            channelName: 'Movies',
        });
    });

    it('hides the badge while channel transition activity is active even if the usual visibility inputs would show it', () => {
        const { controller, deps } = makeOverlayHarness({
            getPlayerOsdVisible: jest.fn().mockReturnValue(true),
            getNowPlayingInfoVisible: jest.fn().mockReturnValue(true),
            getCurrentChannel: jest.fn().mockReturnValue({ number: 12, name: 'Comedy' }),
            isChannelTransitionActive: jest.fn().mockReturnValue(true),
        } as unknown as Partial<OverlayRuntimePolicyControllerDeps>);

        controller.syncChannelBadgeOverlay();

        expect(deps.hideChannelBadge).toHaveBeenCalledTimes(1);
        expect(deps.getCurrentChannel).not.toHaveBeenCalled();
        expect(deps.showChannelBadge).not.toHaveBeenCalled();
    });

    it.each([true, false])(
        'recomputes badge visibility from derived overlay state and ignores the callback boolean (%s)',
        (visible) => {
            const { controller, deps } = makeOverlayHarness({
                getPlayerOsdVisible: jest.fn().mockReturnValue(false),
                getNowPlayingInfoVisible: jest.fn().mockReturnValue(true),
                getCurrentChannel: jest.fn().mockReturnValue({ number: 9, name: 'News' }),
            });

            controller.handleOverlayVisibilityChange(visible);

            expect(deps.showChannelBadge).toHaveBeenCalledTimes(1);
            expect(deps.showChannelBadge).toHaveBeenCalledWith({
                channelNumber: 9,
                channelName: 'News',
            });
        }
    );

    it('hides the badge while the EPG is open even if the player OSD is visible', () => {
        const { controller, deps } = makeOverlayHarness({
            getPlayerOsdVisible: jest.fn().mockReturnValue(true),
            getNowPlayingInfoVisible: jest.fn().mockReturnValue(false),
            getEpgVisible: jest.fn().mockReturnValue(true),
            getCurrentChannel: jest.fn().mockReturnValue({ number: 11, name: 'Drama' }),
        });

        controller.syncChannelBadgeOverlay();

        expect(deps.hideChannelBadge).toHaveBeenCalledTimes(1);
        expect(deps.getCurrentChannel).not.toHaveBeenCalled();
        expect(deps.showChannelBadge).not.toHaveBeenCalled();
    });

    it('does nothing when navigation is unavailable', () => {
        const { controller, deps } = makeOverlayHarness({
            hasNavigation: jest.fn().mockReturnValue(false),
        });

        controller.toggleNowPlayingInfoOverlay();

        expect(deps.getCurrentScreen).not.toHaveBeenCalled();
        expect(deps.openModal).not.toHaveBeenCalled();
        expect(deps.closeModal).not.toHaveBeenCalled();
    });

    it('does nothing when the now playing overlay instance is unavailable', () => {
        const { controller, deps } = makeOverlayHarness({
            hasNowPlayingInfoOverlay: jest.fn().mockReturnValue(false),
        });

        controller.toggleNowPlayingInfoOverlay();

        expect(deps.getCurrentScreen).not.toHaveBeenCalled();
        expect(deps.openModal).not.toHaveBeenCalled();
        expect(deps.closeModal).not.toHaveBeenCalled();
    });

    it('does nothing when the current screen is not player', () => {
        const { controller, deps } = makeOverlayHarness({
            getCurrentScreen: jest.fn().mockReturnValue('guide'),
        });

        controller.toggleNowPlayingInfoOverlay();

        expect(deps.hasCurrentProgramForPlayback).not.toHaveBeenCalled();
        expect(deps.openModal).not.toHaveBeenCalled();
        expect(deps.closeModal).not.toHaveBeenCalled();
    });

    it('does nothing when the EPG is visible on the player screen', () => {
        const { controller, deps } = makeOverlayHarness({
            getEpgVisible: jest.fn().mockReturnValue(true),
        });

        controller.toggleNowPlayingInfoOverlay();

        expect(deps.getEpgVisible).toHaveBeenCalledTimes(1);
        expect(deps.hasCurrentProgramForPlayback).not.toHaveBeenCalled();
        expect(deps.openModal).not.toHaveBeenCalled();
        expect(deps.closeModal).not.toHaveBeenCalled();
    });

    it('does nothing when there is no current program for playback', () => {
        const { controller, deps } = makeOverlayHarness({
            hasCurrentProgramForPlayback: jest.fn().mockReturnValue(false),
        });

        controller.toggleNowPlayingInfoOverlay();

        expect(deps.isModalOpen).not.toHaveBeenCalled();
        expect(deps.openModal).not.toHaveBeenCalled();
        expect(deps.closeModal).not.toHaveBeenCalled();
    });

    it('closes the now playing modal when it is already open', () => {
        const { controller, deps } = makeOverlayHarness();
        deps.isModalOpen.mockImplementation((modalId?: string) => modalId === deps.nowPlayingModalId);

        controller.toggleNowPlayingInfoOverlay();

        expect(deps.isModalOpen).toHaveBeenCalledWith(deps.nowPlayingModalId);
        expect(deps.closeModal).toHaveBeenCalledTimes(1);
        expect(deps.closeModal).toHaveBeenCalledWith(deps.nowPlayingModalId);
        expect(deps.openModal).not.toHaveBeenCalled();
    });

    it('does nothing when a different modal is already open', () => {
        const { controller, deps } = makeOverlayHarness({
            isModalOpen: jest.fn().mockImplementation((modalId?: string) => !modalId),
        });

        controller.toggleNowPlayingInfoOverlay();

        expect(deps.isModalOpen).toHaveBeenNthCalledWith(1, deps.nowPlayingModalId);
        expect(deps.isModalOpen).toHaveBeenNthCalledWith(2, undefined);
        expect(deps.openModal).not.toHaveBeenCalled();
        expect(deps.closeModal).not.toHaveBeenCalled();
    });

    it('opens the now playing modal when the player screen is active and no modal is open', () => {
        const { controller, deps } = makeOverlayHarness();

        controller.toggleNowPlayingInfoOverlay();

        expect(deps.isModalOpen).toHaveBeenNthCalledWith(1, deps.nowPlayingModalId);
        expect(deps.isModalOpen).toHaveBeenNthCalledWith(2, undefined);
        expect(deps.openModal).toHaveBeenCalledTimes(1);
        expect(deps.openModal).toHaveBeenCalledWith(deps.nowPlayingModalId);
        expect(deps.closeModal).not.toHaveBeenCalled();
    });
});
