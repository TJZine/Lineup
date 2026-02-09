/**
 * @fileoverview Navigation module constants - key codes and configuration.
 * @module modules/navigation/constants
 * @version 1.0.0
 */

import { RemoteButton, NavigationConfig } from './interfaces';
import type { PlatformInputService } from '../../platform';
import { webosPlatformServices } from '../../platform';

/**
 * webOS remote control key code mappings.
 * CRITICAL: webOS uses different key codes than standard web browsers.
 */
export function resolveKeyMap(
    inputService: PlatformInputService = webosPlatformServices.input
): ReadonlyMap<number, RemoteButton> {
    return inputService.getKeyMap();
}

/**
 * Shared key-code mapping helper used by navigation consumers.
 */
export function mapKeyCode(
    keyCode: number,
    inputService: PlatformInputService = webosPlatformServices.input
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
