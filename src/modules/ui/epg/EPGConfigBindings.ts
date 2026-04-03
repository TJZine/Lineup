import type { EPGConfig, EpgVisibleRange } from './types';

export function withEpgVisibleRangeChangeBinding(
    epgConfig: EPGConfig | null | undefined,
    onVisibleRangeChange: (range: EpgVisibleRange) => void
): EPGConfig | null {
    if (!epgConfig) {
        return null;
    }

    const previousOnVisibleRangeChange = epgConfig.onVisibleRangeChange ?? null;
    return {
        ...epgConfig,
        onVisibleRangeChange: (range: EpgVisibleRange): void => {
            previousOnVisibleRangeChange?.(range);
            onVisibleRangeChange(range);
        },
    };
}
