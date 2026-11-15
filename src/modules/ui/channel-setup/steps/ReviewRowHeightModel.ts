const ESTIMATED_ROW_HEIGHT = 72;

/** Measured row and disclosure heights for one prepared Review at one roster width. */
export class ReviewRowHeightModel {
    private readonly _heights = new Map<string, number>();
    private _width = 0;

    reset(): void {
        this._heights.clear();
        this._width = 0;
    }

    clearHeights(): void { this._heights.clear(); }

    setWidth(width: number): boolean {
        if (width <= 0 || width === this._width) return false;
        this._width = width;
        this._heights.clear();
        return true;
    }

    measure(id: string, height: number): boolean {
        if (!Number.isFinite(height) || height <= 0) return false;
        const previous = this._heights.get(id);
        if (previous !== undefined && Math.abs(previous - height) < 0.5) return false;
        this._heights.set(id, height);
        return true;
    }

    has(id: string): boolean { return this._heights.has(id); }

    forget(id: string): void { this._heights.delete(id); }

    offsets(ids: readonly string[]): number[] {
        const offsets = [0];
        for (const id of ids) offsets.push(offsets[offsets.length - 1]! + (this._heights.get(id) ?? ESTIMATED_ROW_HEIGHT));
        return offsets;
    }

    indexAt(offsets: readonly number[], position: number): number {
        if (offsets.length < 2) return 0;
        let low = 0;
        let high = offsets.length - 1;
        const target = Math.max(0, position);
        while (low + 1 < high) {
            const middle = Math.floor((low + high) / 2);
            if (offsets[middle]! <= target) low = middle;
            else high = middle;
        }
        return low;
    }
}
