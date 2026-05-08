import { NavigationChannelNumberInputController } from '../input/NavigationChannelNumberInputController';

describe('NavigationChannelNumberInputController', () => {
    let emitChannelInputUpdate: jest.Mock<void, [{ digits: string; isComplete: boolean }]>;
    let emitChannelNumberEntered: jest.Mock<void, [{ channelNumber: number }]>;
    let controller: NavigationChannelNumberInputController;

    beforeEach(() => {
        jest.useFakeTimers();
        emitChannelInputUpdate = jest.fn<void, [{ digits: string; isComplete: boolean }]>();
        emitChannelNumberEntered = jest.fn<void, [{ channelNumber: number }]>();
        controller = new NavigationChannelNumberInputController({
            getChannelInputConfig: (): { timeoutMs: number; maxDigits: number } => ({
                timeoutMs: 2000,
                maxDigits: 3,
            }),
            emitChannelInputUpdate,
            emitChannelNumberEntered,
        });
    });

    afterEach(() => {
        controller.destroy();
        jest.useRealTimers();
    });

    it('accumulates numeric input and commits on timeout', () => {
        controller.handleNumberKey('num1');
        controller.handleNumberKey('num2');

        expect(emitChannelInputUpdate).toHaveBeenNthCalledWith(1, {
            digits: '1',
            isComplete: false,
        });
        expect(emitChannelInputUpdate).toHaveBeenNthCalledWith(2, {
            digits: '12',
            isComplete: false,
        });

        jest.advanceTimersByTime(2100);

        expect(emitChannelNumberEntered).toHaveBeenCalledWith({ channelNumber: 12 });
        expect(emitChannelInputUpdate).toHaveBeenLastCalledWith({
            digits: '',
            isComplete: true,
        });
    });

    it('commits immediately once max digits are reached', () => {
        controller.handleNumberKey('num1');
        controller.handleNumberKey('num0');
        controller.handleNumberKey('num5');

        expect(emitChannelNumberEntered).toHaveBeenCalledWith({ channelNumber: 105 });
        expect(emitChannelInputUpdate).toHaveBeenLastCalledWith({
            digits: '',
            isComplete: true,
        });

        jest.advanceTimersByTime(3000);
        expect(emitChannelNumberEntered).toHaveBeenCalledTimes(1);
    });

    it('clears pending timeout on destroy', () => {
        controller.handleNumberKey('num4');
        controller.destroy();

        jest.advanceTimersByTime(2100);

        expect(emitChannelNumberEntered).not.toHaveBeenCalled();
    });
});
