import type { StreamDecision } from '../../modules/plex/stream';
import type { StreamDescriptor } from '../../modules/player';
import type { ScheduledProgram } from '../../modules/scheduler/scheduler';
import {
    ProfileSwitchCleanupController,
    type ProfileSwitchCleanupControllerDeps,
} from '../orchestrator/controllers/ProfileSwitchCleanupController';
import type { OrchestratorPlaybackStateAccessors } from '../orchestrator/runtime/OrchestratorPlaybackStateAccessors';

type CleanupHarness = {
    controller: ProfileSwitchCleanupController;
    deps: jest.Mocked<ProfileSwitchCleanupControllerDeps>;
    callOrder: string[];
};

const makeCleanupHarness = (
    overrides: Partial<ProfileSwitchCleanupControllerDeps> = {}
): CleanupHarness => {
    const callOrder: string[] = [];
    const playbackState: jest.Mocked<OrchestratorPlaybackStateAccessors> = {
        getCurrentProgramForPlayback: jest.fn().mockReturnValue(null),
        setCurrentProgramForPlayback: jest.fn<void, [ScheduledProgram | null]>((program) => {
            callOrder.push(`setProgram:${program === null ? 'null' : 'value'}`);
        }),
        getCurrentStreamDescriptor: jest.fn().mockReturnValue(null),
        setCurrentStreamDescriptor: jest.fn<void, [StreamDescriptor | null]>((descriptor) => {
            callOrder.push(`setDescriptor:${descriptor === null ? 'null' : 'value'}`);
        }),
        getCurrentStreamDecision: jest.fn().mockReturnValue(null),
        setCurrentStreamDecision: jest.fn<void, [StreamDecision | null]>((decision) => {
            callOrder.push(`setDecision:${decision === null ? 'null' : 'value'}`);
        }),
        getPendingNowPlayingChannelId: jest.fn().mockReturnValue(null),
        setPendingNowPlayingChannelId: jest.fn<void, [string | null]>((channelId) => {
            callOrder.push(`setPendingNowPlayingChannelId:${channelId === null ? 'null' : channelId}`);
        }),
        getShouldAutoShowInfoBannerOnNextPlay: jest.fn().mockReturnValue(false),
        setShouldAutoShowInfoBannerOnNextPlay: jest.fn<void, [boolean]>((value) => {
            callOrder.push(`setAutoShow:${String(value)}`);
        }),
    };
    const deps = {
        schedulerRuntime: {
            cancelPendingDayRollover: jest.fn<void, []>(() => {
                callOrder.push('cancelPendingDayRollover');
            }),
        },
        playback: {
            playbackState,
            stopPlayback: jest.fn<void, []>(() => {
                callOrder.push('stopPlayback');
            }),
            unloadCurrentChannel: jest.fn<void, []>(() => {
                callOrder.push('unloadChannel');
            }),
        },
        ...overrides,
    } as jest.Mocked<ProfileSwitchCleanupControllerDeps>;

    return {
        controller: new ProfileSwitchCleanupController(deps),
        deps,
        callOrder,
    };
};

describe('ProfileSwitchCleanupController', () => {
    it('clears the pending day rollover timer before resetting the rest of the profile-switch state', () => {
        const { controller, deps, callOrder } = makeCleanupHarness();

        controller.prepareForProfileSwitch();

        expect(deps.schedulerRuntime.cancelPendingDayRollover).toHaveBeenCalledTimes(1);
        expect(callOrder).toEqual([
            'cancelPendingDayRollover',
            'stopPlayback',
            'unloadChannel',
            'setPendingNowPlayingChannelId:null',
            'setAutoShow:false',
            'setProgram:null',
            'setDescriptor:null',
            'setDecision:null',
        ]);
    });
});
