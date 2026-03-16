import { EPGVisibleRangeEmitter } from '../EPGVisibleRangeEmitter';
import type { EpgVisibleRange } from '../types';

describe('EPGVisibleRangeEmitter', () => {
    const baseRange = (overrides: Partial<EpgVisibleRange> = {}): EpgVisibleRange => ({
        channelStart: 0,
        channelEnd: 5,
        timeStartMs: 1000,
        timeEndMs: 2000,
        ...overrides,
    });

    it('emits the first visible range', () => {
        const onChange = jest.fn();
        const emitter = new EPGVisibleRangeEmitter(onChange);

        const range = baseRange();
        emitter.emit(range);

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(range);
    });

    it('suppresses duplicate range keys', () => {
        const onChange = jest.fn();
        const emitter = new EPGVisibleRangeEmitter(onChange);

        emitter.emit(baseRange());
        emitter.emit(baseRange());

        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('emits again after range values change', () => {
        const onChange = jest.fn();
        const emitter = new EPGVisibleRangeEmitter(onChange);

        emitter.emit(baseRange());
        emitter.emit(baseRange({ channelStart: 1, channelEnd: 6 }));

        expect(onChange).toHaveBeenCalledTimes(2);
    });

    it('emits again after reset for the same range', () => {
        const onChange = jest.fn();
        const emitter = new EPGVisibleRangeEmitter(onChange);
        const range = baseRange();

        emitter.emit(range);
        emitter.reset();
        emitter.emit(range);

        expect(onChange).toHaveBeenCalledTimes(2);
    });
});
