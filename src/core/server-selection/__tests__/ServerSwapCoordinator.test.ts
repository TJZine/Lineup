import { ServerSwapCoordinator } from '../ServerSwapCoordinator';

describe('ServerSwapCoordinator', () => {
    it('re-runs startup phase 3 and refreshes EPG state in the expected order', async () => {
        const calls: string[] = [];
        const coordinator = new ServerSwapCoordinator({
            runStartupPhase3: jest.fn(async () => {
                calls.push('runStartupPhase3');
            }),
            clearSelectedChannelScheduleSnapshot: jest.fn(() => {
                calls.push('clearSelectedChannelScheduleSnapshot');
            }),
            clearScheduleCaches: jest.fn(() => {
                calls.push('clearScheduleCaches');
            }),
            clearSchedules: jest.fn(() => {
                calls.push('clearSchedules');
            }),
            primeEpgChannels: jest.fn(() => {
                calls.push('primeEpgChannels');
            }),
            refreshEpgSchedules: jest.fn(async () => {
                calls.push('refreshEpgSchedules');
            }),
        });

        await coordinator.runAfterServerSelection();

        expect(calls).toEqual([
            'runStartupPhase3',
            'clearSelectedChannelScheduleSnapshot',
            'clearScheduleCaches',
            'clearSchedules',
            'primeEpgChannels',
            'refreshEpgSchedules',
        ]);
    });
});
