import { NavigationInputTimingController } from '../NavigationInputTimingController';

describe('NavigationInputTimingController', () => {
    let tryMoveFocus: jest.Mock<boolean, ['up' | 'down' | 'left' | 'right']>;
    let emitChannelInputUpdate: jest.Mock<void, [{ digits: string; isComplete: boolean }]>;
    let emitChannelNumberEntered: jest.Mock<void, [{ channelNumber: number }]>;
    let controller: NavigationInputTimingController;

    beforeEach(() => {
        jest.useFakeTimers();
        tryMoveFocus = jest.fn<boolean, ['up' | 'down' | 'left' | 'right']>();
        emitChannelInputUpdate = jest.fn<void, [{ digits: string; isComplete: boolean }]>();
        emitChannelNumberEntered = jest.fn<void, [{ channelNumber: number }]>();
        controller = new NavigationInputTimingController({
            getRepeatConfig: (): { delayMs: number; intervalMs: number } => ({
                delayMs: 500,
                intervalMs: 100,
            }),
            getChannelInputConfig: (): { timeoutMs: number; maxDigits: number } => ({
                timeoutMs: 2000,
                maxDigits: 3,
            }),
            tryMoveFocus,
            emitChannelInputUpdate,
            emitChannelNumberEntered,
        });
    });

    afterEach(() => {
        controller.destroy();
        jest.useRealTimers();
    });

    it('runs directional repeat lifecycle and stops when movement can no longer proceed', () => {
        tryMoveFocus.mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValueOnce(false);

        controller.handleDirectionalKeyDown('down', false);
        expect(tryMoveFocus).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(500);
        jest.advanceTimersByTime(100);
        jest.advanceTimersByTime(100);

        expect(tryMoveFocus).toHaveBeenCalledTimes(3);

        // Repeat should be stopped after no-move.
        jest.advanceTimersByTime(500);
        expect(tryMoveFocus).toHaveBeenCalledTimes(3);
    });

    it('stops directional repeat on keyup of the active button', () => {
        tryMoveFocus.mockReturnValue(true);

        controller.handleDirectionalKeyDown('right', false);
        expect(tryMoveFocus).toHaveBeenCalledTimes(1);

        controller.handleDirectionalKeyUp('right');
        jest.advanceTimersByTime(1000);

        // No repeat ticks after keyup stop.
        expect(tryMoveFocus).toHaveBeenCalledTimes(1);
    });

    it('cancels repeat on non-directional key down', () => {
        tryMoveFocus.mockReturnValue(true);

        controller.handleDirectionalKeyDown('up', false);
        expect(tryMoveFocus).toHaveBeenCalledTimes(1);

        controller.handleNonDirectionalKeyDown();
        jest.advanceTimersByTime(1000);

        expect(tryMoveFocus).toHaveBeenCalledTimes(1);
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
});
