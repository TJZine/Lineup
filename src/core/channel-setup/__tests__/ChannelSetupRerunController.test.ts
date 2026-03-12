import { ChannelSetupRerunController } from '../ChannelSetupRerunController';
import type { INavigationManager } from '../../../modules/navigation';

const createController = (overrides?: Partial<{
    getSelectedServerId: () => string | null;
    getChannelCount: () => number;
    hasSetupRecord: (serverId: string) => boolean;
}>): {
    controller: ChannelSetupRerunController;
    navigation: jest.Mocked<INavigationManager>;
    clearSetupRecord: jest.Mock<void, [string]>;
} => {
    const navigation = {
        goTo: jest.fn(),
    } as unknown as jest.Mocked<INavigationManager>;
    const clearSetupRecord = jest.fn();
    const getSelectedServerId = overrides?.getSelectedServerId ?? (() : string | null => 'server-1');
    const getChannelCount = overrides?.getChannelCount ?? (() : number => 1);
    const hasSetupRecord = overrides?.hasSetupRecord ?? ((_serverId: string): boolean => true);

    const controller = new ChannelSetupRerunController({
        navigation,
        getSelectedServerId,
        clearSetupRecord,
        getChannelCount,
        hasSetupRecord,
    });

    return { controller, navigation, clearSetupRecord };
};

describe('ChannelSetupRerunController', () => {
    it('requestChannelSetupRerun is a no-op when no server is selected', () => {
        const { controller, navigation, clearSetupRecord } = createController({
            getSelectedServerId: () => null,
        });

        controller.requestChannelSetupRerun();

        expect(clearSetupRecord).not.toHaveBeenCalled();
        expect(navigation.goTo).not.toHaveBeenCalled();
    });

    it('requestChannelSetupRerun clears setup record and navigates to setup', () => {
        const { controller, navigation, clearSetupRecord } = createController();

        controller.requestChannelSetupRerun();

        expect(clearSetupRecord).toHaveBeenCalledWith('server-1');
        expect(navigation.goTo).toHaveBeenCalledWith('channel-setup');
    });

    it('shouldRunChannelSetup returns true while rerun request is active and false after clear when setup exists', () => {
        const { controller } = createController({
            getChannelCount: () => 3,
            hasSetupRecord: () => true,
        });

        controller.requestChannelSetupRerun();
        expect(controller.shouldRunChannelSetup()).toBe(true);

        controller.clearRerunRequest();
        expect(controller.shouldRunChannelSetup()).toBe(false);
    });

    it('shouldRunChannelSetup returns true when no channels exist', () => {
        const { controller } = createController({
            getChannelCount: () => 0,
            hasSetupRecord: () => true,
        });
        expect(controller.shouldRunChannelSetup()).toBe(true);
    });

    it('shouldRunChannelSetup returns true when setup record is missing', () => {
        const { controller } = createController({
            getChannelCount: () => 2,
            hasSetupRecord: () => false,
        });
        expect(controller.shouldRunChannelSetup()).toBe(true);
    });
});
