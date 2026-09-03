const CLEAR_LOGO_MAX_WIDTH = 520;
const CLEAR_LOGO_MIN_ART_HEIGHT = 44;

export function isClearLogoUsable(
    naturalWidth: number,
    naturalHeight: number,
    targetHeight: number,
    renderedWidth: number
): boolean {
    if (naturalWidth <= 0 || naturalHeight <= 0 || renderedWidth <= 0) return false;

    const containedHeight = Math.min(
        targetHeight,
        (Math.min(renderedWidth, CLEAR_LOGO_MAX_WIDTH) * naturalHeight) / naturalWidth
    );
    return containedHeight >= CLEAR_LOGO_MIN_ART_HEIGHT;
}
