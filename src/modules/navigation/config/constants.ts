import { RemoteButton, NavigationConfig } from '../contracts/interfaces';
import type { PlatformInputService } from '../../../platform';
import { createWebOsPlatformServices } from '../../../platform';

/**
 * webOS remote control key code mappings.
 * CRITICAL: webOS uses different key codes than standard web browsers.
 */
export function resolveKeyMap(
    inputService: PlatformInputService = createWebOsPlatformServices().input
): ReadonlyMap<number, RemoteButton> {
    return inputService.getKeyMap();
}

/**
 * Shared key-code mapping helper used by navigation consumers.
 */
export function mapKeyCode(
    keyCode: number,
    inputService: PlatformInputService = createWebOsPlatformServices().input
): RemoteButton | null {
    const button = resolveKeyMap(inputService).get(keyCode);
    return button !== undefined ? button : null;
}

/**
 * Threshold for detecting long press (ms).
 */
export const LONG_PRESS_THRESHOLD_MS = 500;

/**
 * Debounce delay after long press fires to prevent repeat triggers (ms).
 */
export const LONG_PRESS_DEBOUNCE_MS = 100;

/**
 * Cursor hide delay for pointer mode (ms).
 */
export const CURSOR_HIDE_DELAY_MS = 3000;

/**
 * Channel number input configuration.
 */
export const CHANNEL_INPUT_CONFIG = {
    /** Time to wait for next digit (ms) */
    TIMEOUT_MS: 2000,
    /** Maximum digits to collect */
    MAX_DIGITS: 3,
} as const;

export type AcceleratedRepeatTiming = Readonly<{
    TIER_1_MS: number;
    TIER_2_MS: number;
    INTERVAL_1_MS: number;
    INTERVAL_2_MS: number;
    INTERVAL_3_MS: number;
}>;

export const EPG_REPEAT_TIMING = {
    INITIAL_DELAY_MS: 250,
    TIER_1_MS: 800,
    TIER_2_MS: 1800,
    INTERVAL_1_MS: 140,
    INTERVAL_2_MS: 90,
    INTERVAL_3_MS: 55,
} as const;

export const MINI_GUIDE_REPEAT_TIMING = {
    INITIAL_DELAY_MS: 250,
    TIER_1_MS: 800,
    TIER_2_MS: 1800,
    INTERVAL_1_MS: 140,
    INTERVAL_2_MS: 90,
    INTERVAL_3_MS: 55,
} as const;

export function computeAcceleratedRepeatIntervalMs(
    heldMs: number,
    timing: AcceleratedRepeatTiming
): number {
    if (heldMs < timing.TIER_1_MS) {
        return timing.INTERVAL_1_MS;
    }
    if (heldMs < timing.TIER_2_MS) {
        return timing.INTERVAL_2_MS;
    }
    return timing.INTERVAL_3_MS;
}

/**
 * Focus ring CSS class names.
 */
export const FOCUS_CLASSES = {
    /** Class added to focusable elements */
    FOCUSABLE: 'focusable',
    /** Class added to currently focused element */
    FOCUSED: 'focused',
    /** Class for pointer mode body */
    POINTER_MODE: 'pointer-mode',
} as const;

/**
 * Default navigation configuration.
 */
export const DEFAULT_NAVIGATION_CONFIG: NavigationConfig = {
    enablePointerMode: true,
    keyRepeatDelayMs: 500,
    keyRepeatIntervalMs: 100,
    focusMemoryEnabled: true,
    debugMode: false,
};

/**
 * Initial screen when app starts.
 */
export const INITIAL_SCREEN = 'splash' as const;
