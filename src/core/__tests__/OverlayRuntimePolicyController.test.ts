import {
    OverlayRuntimePolicyController,
    type OverlayRuntimePolicyControllerDeps,
} from '../orchestrator/controllers/OverlayRuntimePolicyController';

const makeDeps = (overrides: Partial<OverlayRuntimePolicyControllerDeps> = {}): OverlayRuntimePolicyControllerDeps => ({
    hasChannelBadgeOverlay: jest.fn().mockReturnValue(true),
    getPlayerOsdVisible: jest.fn().mockReturnValue(false),
    getEpgVisible: jest.fn().mockReturnValue(false),
    isChannelTransitionActive: jest.fn().mockReturnValue(false),
    getCurrentChannel: jest.fn().mockReturnValue({ number: 7, name: 'Movies' }),
    showChannelBadge: jest.fn(),
    hideChannelBadge: jest.fn(),
    ...overrides,
});

describe('OverlayRuntimePolicyController', () => {
    it('shows the current channel badge only with visible Player controls', () => {
        const deps = makeDeps({ getPlayerOsdVisible: jest.fn().mockReturnValue(true) });
        const controller = new OverlayRuntimePolicyController(deps);
        controller.syncChannelBadgeOverlay();
        expect(deps.showChannelBadge).toHaveBeenCalledWith({ channelNumber: 7, channelName: 'Movies' });
        expect(deps.hideChannelBadge).not.toHaveBeenCalled();
    });

    it.each([
        { reason: 'hidden controls', override: { getPlayerOsdVisible: jest.fn().mockReturnValue(false) } },
        { reason: 'Guide', override: { getPlayerOsdVisible: jest.fn().mockReturnValue(true), getEpgVisible: jest.fn().mockReturnValue(true) } },
        { reason: 'channel transition', override: { getPlayerOsdVisible: jest.fn().mockReturnValue(true), isChannelTransitionActive: jest.fn().mockReturnValue(true) } },
        { reason: 'no channel', override: { getPlayerOsdVisible: jest.fn().mockReturnValue(true), getCurrentChannel: jest.fn().mockReturnValue(null) } },
    ])('hides the badge for $reason', ({ override }) => {
        const deps = makeDeps(override);
        new OverlayRuntimePolicyController(deps).syncChannelBadgeOverlay();
        expect(deps.hideChannelBadge).toHaveBeenCalledTimes(1);
        expect(deps.showChannelBadge).not.toHaveBeenCalled();
    });

    it('does nothing without a badge overlay', () => {
        const deps = makeDeps({ hasChannelBadgeOverlay: jest.fn().mockReturnValue(false) });
        new OverlayRuntimePolicyController(deps).handleOverlayVisibilityChange(true);
        expect(deps.hideChannelBadge).not.toHaveBeenCalled();
        expect(deps.showChannelBadge).not.toHaveBeenCalled();
    });
});
