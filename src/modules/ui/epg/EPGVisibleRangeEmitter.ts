import type { EpgVisibleRange } from './types';

type VisibleRangeChangeHandler = (range: EpgVisibleRange) => void;

export class EPGVisibleRangeEmitter {
    private _lastVisibleRangeKey: string | null = null;

    constructor(private readonly _onVisibleRangeChange?: VisibleRangeChangeHandler) { }

    emit(range: EpgVisibleRange): void {
        if (!this._onVisibleRangeChange) {
            return;
        }

        const rangeKey = this._buildRangeKey(range);
        if (rangeKey === this._lastVisibleRangeKey) {
            return;
        }

        this._lastVisibleRangeKey = rangeKey;
        this._onVisibleRangeChange(range);
    }

    reset(): void {
        this._lastVisibleRangeKey = null;
    }

    private _buildRangeKey(range: EpgVisibleRange): string {
        return `${range.channelStart}-${range.channelEnd}-${range.timeStartMs}-${range.timeEndMs}`;
    }
}
