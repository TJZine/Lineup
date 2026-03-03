import type { StreamDecision } from '../../modules/plex/stream';
import type { StreamDescriptor } from '../../modules/player';
import type { ScheduledProgram } from '../../modules/scheduler/scheduler';
import {
    ProfileSwitchCleanupController,
    type ProfileSwitchCleanupControllerDeps,
} from '../orchestrator/ProfileSwitchCleanupController';

type CleanupHarness = {
    controller: ProfileSwitchCleanupController;
    deps: jest.Mocked<ProfileSwitchCleanupControllerDeps>;
    callOrder: string[];
    timerHandle: ReturnType<typeof setTimeout>;
};

const makeCleanupHarness = (
    overrides: Partial<ProfileSwitchCleanupControllerDeps> = {}
): CleanupHarness => {
    const callOrder: string[] = [];
    const timerHandle = ({ id: 'day-rollover-timer' } as unknown) as ReturnType<typeof setTimeout>;

    const deps = {
        getPendingDayRolloverTimer: jest.fn<ReturnType<typeof setTimeout> | null, []>().mockReturnValue(timerHandle),
        clearPendingDayRolloverTimer: jest.fn<void, [ReturnType<typeof setTimeout>]>((timer) => {
            callOrder.push(`clearTimer:${String((timer as unknown as { id?: string }).id ?? 'unknown')}`);
        }),
        setPendingDayRolloverTimer: jest.fn<void, [ReturnType<typeof setTimeout> | null]>((timer) => {
            callOrder.push(`setTimer:${timer === null ? 'null' : 'value'}`);
        }),
        setPendingDayRolloverDayKey: jest.fn<void, [number | null]>((dayKey) => {
            callOrder.push(`setDayKey:${dayKey === null ? 'null' : String(dayKey)}`);
        }),
        stopPlayback: jest.fn<void, []>(() => {
            callOrder.push('stopPlayback');
        }),
        unloadCurrentChannel: jest.fn<void, []>(() => {
            callOrder.push('unloadChannel');
        }),
        setPendingNowPlayingChannelId: jest.fn<void, [string | null]>((channelId) => {
            callOrder.push(`setPendingNowPlayingChannelId:${channelId === null ? 'null' : channelId}`);
        }),
        setShouldAutoShowInfoBannerOnNextPlay: jest.fn<void, [boolean]>((value) => {
            callOrder.push(`setAutoShow:${String(value)}`);
        }),
        setCurrentProgramForPlayback: jest.fn<void, [ScheduledProgram | null]>((program) => {
            callOrder.push(`setProgram:${program === null ? 'null' : 'value'}`);
        }),
        setCurrentStreamDescriptor: jest.fn<void, [StreamDescriptor | null]>((descriptor) => {
            callOrder.push(`setDescriptor:${descriptor === null ? 'null' : 'value'}`);
        }),
        setCurrentStreamDecision: jest.fn<void, [StreamDecision | null]>((decision) => {
            callOrder.push(`setDecision:${decision === null ? 'null' : 'value'}`);
        }),
        ...overrides,
    } as jest.Mocked<ProfileSwitchCleanupControllerDeps>;

    return {
        controller: new ProfileSwitchCleanupController(deps),
        deps,
        callOrder,
        timerHandle,
    };
};

describe('ProfileSwitchCleanupController', () => {
    it('clears the pending day rollover timer before resetting the rest of the profile-switch state', () => {
        const { controller, deps, callOrder, timerHandle } = makeCleanupHarness();

        controller.prepareForProfileSwitch();

        expect(deps.clearPendingDayRolloverTimer).toHaveBeenCalledTimes(1);
        expect(deps.clearPendingDayRolloverTimer).toHaveBeenCalledWith(timerHandle);
        expect(deps.setPendingDayRolloverTimer).toHaveBeenCalledTimes(1);
        expect(deps.setPendingDayRolloverTimer).toHaveBeenCalledWith(null);
        expect(callOrder).toEqual([
            'clearTimer:day-rollover-timer',
            'setTimer:null',
            'setDayKey:null',
            'stopPlayback',
            'unloadChannel',
            'setPendingNowPlayingChannelId:null',
            'setAutoShow:false',
            'setProgram:null',
            'setDescriptor:null',
            'setDecision:null',
        ]);
    });

    it('skips timer clearing when there is no pending day rollover timer but still resets the remaining profile-switch state in order', () => {
        const { controller, deps, callOrder } = makeCleanupHarness({
            getPendingDayRolloverTimer: jest.fn().mockReturnValue(null),
        });

        controller.prepareForProfileSwitch();

        expect(deps.clearPendingDayRolloverTimer).not.toHaveBeenCalled();
        expect(deps.setPendingDayRolloverTimer).not.toHaveBeenCalled();
        expect(callOrder).toEqual([
            'setDayKey:null',
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
