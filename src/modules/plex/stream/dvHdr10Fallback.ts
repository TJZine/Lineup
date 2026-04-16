/**
 * @fileoverview Dolby Vision profile parsing and HDR10 fallback decision logic.
 * @module modules/plex/stream/dvHdr10Fallback
 * @version 1.0.0
 */

type DvProfileInfo = {
    raw: string | null;
    profileId: number | null;
    levelId: number | null;
    // True only when we can confidently assert an HDR10 base layer exists.
    hasHdr10BaseLayer: boolean;
};

type DvHdr10BaseLayerContext = {
    doviProfile?: string | null;
    codecProfileString?: string | null;
    hdr?: string | null;
    dynamicRange?: string | null;
    colorTrc?: string | null;
    displayTitle?: string | null;
    extendedDisplayTitle?: string | null;
};

type DvHdr10BaseLayerResult = {
    profileInfo: DvProfileInfo;
    hasHdr10BaseLayer: boolean;
    isKnownNoHdr10BaseLayer: boolean;
    debugWhy: string;
};

const LETTERBOX_ASPECT_RATIOS: Array<{ name: string; min: number; max: number }> = [
    { name: '2.39:1 (Scope)', min: 2.35, max: 2.45 },
    { name: '2.76:1 (Ultra Panavision)', min: 2.70, max: 2.80 },
    { name: '2.20:1 (70mm)', min: 2.15, max: 2.25 },
    { name: '1.85:1 (Flat)', min: 1.82, max: 1.88 },
];

export function isLetterboxAspectRatio(aspectRatio: number | null | undefined): boolean {
    if (typeof aspectRatio !== 'number') return false;
    if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) return false;
    return LETTERBOX_ASPECT_RATIOS.some((r) => aspectRatio >= r.min && aspectRatio <= r.max);
}

export function parseDolbyVisionProfileString(
    doviProfile: string | null | undefined,
    codecProfileString?: string | null | undefined
): DvProfileInfo {
    const raw = (doviProfile ?? '').trim();
    const profileFromCodec = (codecProfileString ?? '').trim();

    const codecProfileInfo = parseCodecProfileString(profileFromCodec);
    if (codecProfileInfo) {
        return codecProfileInfo;
    }

    const rawProfileInfo = parseRawProfileString(raw);
    if (rawProfileInfo) {
        return rawProfileInfo;
    }

    return buildDvProfileInfo(raw.length > 0 ? raw : null, null, null);
}

export function hasHdr10BaseLayer(
    profileId: number | null,
    levelId: number | null,
    rawProfile: string | null
): boolean {
    if (profileId === null) return false;

    // Profile 7 always has HDR10 base layer.
    if (profileId === 7) return true;

    // Profile 5 has no HDR10 base layer.
    if (profileId === 5) return false;

    // Profile 8 varies: only 8.1 (level 1) is HDR10-compatible.
    if (profileId === 8) {
        // Prefer parsed levelId when available
        if (levelId === 1) return true;
        // Fallback: check raw string for 8.1 or codec pattern dvhe.08.01
        const raw = (rawProfile ?? '').trim();
        return /^8\.1\b/.test(raw) || /dv(?:he|h1)\.0?8\.0?1/i.test(raw);
    }

    return false;
}

function hasHdr10Indicator(...values: Array<string | null | undefined>): boolean {
    for (const value of values) {
        if (typeof value !== 'string') continue;
        if (/\bhdr10\b/i.test(value)) {
            return true;
        }
    }
    return false;
}

function normalizeColorTrc(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

function parseCodecProfileString(profileFromCodec: string): DvProfileInfo | null {
    const codecMatch = profileFromCodec.match(/dv(?:he|h1)\.(\d+)\.(\d+)/i);
    if (!codecMatch) {
        return null;
    }

    return buildDvProfileInfo(
        profileFromCodec,
        parseNumericProfilePart(codecMatch[1]),
        parseNumericProfilePart(codecMatch[2])
    );
}

function parseRawProfileString(rawProfile: string): DvProfileInfo | null {
    if (rawProfile.length === 0) {
        return null;
    }

    const match = rawProfile.match(/^(\d+)(?:\.(\d+))?$/);
    if (!match) {
        return null;
    }

    return buildDvProfileInfo(
        rawProfile,
        parseNumericProfilePart(match[1]),
        parseNumericProfilePart(match[2])
    );
}

function parseNumericProfilePart(value: string | undefined): number | null {
    if (!value) {
        return null;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function buildDvProfileInfo(
    raw: string | null,
    profileId: number | null,
    levelId: number | null
): DvProfileInfo {
    return {
        raw,
        profileId,
        levelId,
        hasHdr10BaseLayer: hasHdr10BaseLayer(profileId, levelId, raw),
    };
}

export function inferHdr10BaseLayer(context: DvHdr10BaseLayerContext): DvHdr10BaseLayerResult {
    const profileInfo = parseDolbyVisionProfileString(
        context.doviProfile ?? null,
        context.codecProfileString ?? null
    );

    if (profileInfo.profileId === null) {
        return {
            profileInfo,
            hasHdr10BaseLayer: false,
            isKnownNoHdr10BaseLayer: false,
            debugWhy: 'unknown_profile',
        };
    }

    if (profileInfo.profileId === 5) {
        return {
            profileInfo,
            hasHdr10BaseLayer: false,
            isKnownNoHdr10BaseLayer: true,
            debugWhy: 'profile_5',
        };
    }

    if (profileInfo.profileId === 7) {
        return {
            profileInfo,
            hasHdr10BaseLayer: true,
            isKnownNoHdr10BaseLayer: false,
            debugWhy: 'profile_7',
        };
    }

    if (profileInfo.profileId === 8) {
        const colorTrc = normalizeColorTrc(context.colorTrc);
        if (colorTrc === 'arib-std-b67') {
            return {
                profileInfo,
                hasHdr10BaseLayer: false,
                isKnownNoHdr10BaseLayer: true,
                debugWhy: 'profile_8_hlg',
            };
        }

        if (profileInfo.hasHdr10BaseLayer) {
            return {
                profileInfo,
                hasHdr10BaseLayer: true,
                isKnownNoHdr10BaseLayer: false,
                debugWhy: 'profile_8_level_1',
            };
        }

        if (profileInfo.levelId === 2 || profileInfo.levelId === 4) {
            return {
                profileInfo,
                hasHdr10BaseLayer: false,
                isKnownNoHdr10BaseLayer: true,
                debugWhy: `profile_8_level_${profileInfo.levelId}`,
            };
        }

        if (colorTrc === 'smpte2084') {
            return {
                profileInfo,
                hasHdr10BaseLayer: true,
                isKnownNoHdr10BaseLayer: false,
                debugWhy: 'profile_8_pq',
            };
        }

        const hasHdr10Title = hasHdr10Indicator(
            context.displayTitle,
            context.extendedDisplayTitle,
            context.hdr,
            context.dynamicRange
        );
        if (hasHdr10Title) {
            return {
                profileInfo,
                hasHdr10BaseLayer: true,
                isKnownNoHdr10BaseLayer: false,
                debugWhy: 'profile_8_title_hdr10',
            };
        }

        return {
            profileInfo,
            hasHdr10BaseLayer: false,
            isKnownNoHdr10BaseLayer: false,
            debugWhy: 'profile_8_unknown',
        };
    }

    return {
        profileInfo,
        hasHdr10BaseLayer: profileInfo.hasHdr10BaseLayer,
        isKnownNoHdr10BaseLayer: false,
        debugWhy: 'default',
    };
}

type Hdr10FallbackMode = 'off' | 'smart' | 'force';

export function computeHdr10FallbackMode(settings: {
    smartHdr10Fallback: boolean;
    forceHdr10Fallback: boolean;
}): Hdr10FallbackMode {
    if (settings.forceHdr10Fallback) return 'force';
    if (settings.smartHdr10Fallback) return 'smart';
    return 'off';
}

export function shouldApplyHdr10Fallback(args: {
    mode: Hdr10FallbackMode;
    container: string | null | undefined;
    isDolbyVision: boolean;
    doviProfile?: string | null;
    codecProfileString?: string | null;
    hdr?: string | null;
    dynamicRange?: string | null;
    colorTrc?: string | null;
    displayTitle?: string | null;
    extendedDisplayTitle?: string | null;
    aspectRatio?: number | null;
    width?: number | null;
    height?: number | null;
}): { apply: boolean; reason: 'force' | 'smart' | 'none'; debugWhy: string } {
    const mode = args.mode;
    if (mode === 'off') return { apply: false, reason: 'none', debugWhy: 'mode_off' };

    const container = (args.container ?? '').toLowerCase();
    if (container !== 'mkv') return { apply: false, reason: 'none', debugWhy: 'container_not_mkv' };

    if (!args.isDolbyVision) return { apply: false, reason: 'none', debugWhy: 'not_dolby_vision' };

    const dv = inferHdr10BaseLayer({
        doviProfile: args.doviProfile ?? null,
        codecProfileString: args.codecProfileString ?? null,
        hdr: args.hdr ?? null,
        dynamicRange: args.dynamicRange ?? null,
        colorTrc: args.colorTrc ?? null,
        displayTitle: args.displayTitle ?? null,
        extendedDisplayTitle: args.extendedDisplayTitle ?? null,
    });

    // Never apply to known non-HDR10 base-layer profiles (e.g., 5, 8.2, 8.4).
    if (!dv.hasHdr10BaseLayer) {
        return { apply: false, reason: 'none', debugWhy: 'no_hdr10_base_layer' };
    }

    const computedAspect =
        typeof args.aspectRatio === 'number' && args.aspectRatio > 0
            ? args.aspectRatio
            : typeof args.width === 'number' && typeof args.height === 'number' && args.height > 0
                ? args.width / args.height
                : null;

    if (mode === 'force') {
        return { apply: true, reason: 'force', debugWhy: 'force_enabled' };
    }

    // mode === 'smart'
    if (isLetterboxAspectRatio(computedAspect)) {
        return { apply: true, reason: 'smart', debugWhy: 'letterbox_detected' };
    }

    return { apply: false, reason: 'none', debugWhy: 'smart_not_letterbox' };
}
