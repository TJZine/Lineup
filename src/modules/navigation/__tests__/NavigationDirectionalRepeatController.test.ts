import { NavigationDirectionalRepeatController } from '../input/NavigationDirectionalRepeatController';

describe('NavigationDirectionalRepeatController', () => {
    let tryMoveFocus: jest.Mock<boolean, ['up' | 'down' | 'left' | 'right']>;
    let controller: NavigationDirectionalRepeatController;

    beforeEach(() => {
        jest.useFakeTimers();
        tryMoveFocus = jest.fn<boolean, ['up' | 'down' | 'left' | 'right']>();
        controller = new NavigationDirectionalRepeatController({
            getRepeatConfig: (): { delayMs: number; intervalMs: number } => ({
                delayMs: 500,
                intervalMs: 100,
            }),
            tryMoveFocus,
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

        jest.advanceTimersByTime(500);
        expect(tryMoveFocus).toHaveBeenCalledTimes(3);
    });

    it('stops directional repeat on keyup of the active button', () => {
        tryMoveFocus.mockReturnValue(true);

        controller.handleDirectionalKeyDown('right', false);
        expect(tryMoveFocus).toHaveBeenCalledTimes(1);

        controller.handleDirectionalKeyUp('right');
        jest.advanceTimersByTime(1000);

        expect(tryMoveFocus).toHaveBeenCalledTimes(1);
    });

    it('stops immediately when the first move reaches a bounded edge', () => {
        tryMoveFocus.mockReturnValue(false);

        controller.handleDirectionalKeyDown('up', false);
        jest.advanceTimersByTime(1000);

        expect(tryMoveFocus).toHaveBeenCalledTimes(1);
    });

    it('does not start repeat on key repeat events', () => {
        controller.handleDirectionalKeyDown('up', true);

        jest.advanceTimersByTime(1000);

        expect(tryMoveFocus).not.toHaveBeenCalled();
    });

    it('can be explicitly stopped before repeat ticks start', () => {
        tryMoveFocus.mockReturnValue(true);

        controller.handleDirectionalKeyDown('left', false);
        expect(tryMoveFocus).toHaveBeenCalledTimes(1);

        controller.stop();
        jest.advanceTimersByTime(1000);

        expect(tryMoveFocus).toHaveBeenCalledTimes(1);
    });
});
