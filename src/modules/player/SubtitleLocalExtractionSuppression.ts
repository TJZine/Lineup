import type { LocalSubtitleExtractionSuppression, StreamDescriptor } from './types';

type SubtitleTrackContext = NonNullable<StreamDescriptor['subtitleContext']>;

export function getRequestedBurnInExtractionSuppression(
    context: SubtitleTrackContext | null,
    trackId: string | null
): LocalSubtitleExtractionSuppression | null {
    const suppression = context?.localExtractionSuppression ?? null;
    if (!trackId || suppression?.trackId !== trackId) {
        return null;
    }
    return suppression;
}
