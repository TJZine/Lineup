/**
 * @fileoverview Application bootstrap wiring.
 * @module bootstrap
 * @version 1.0.0
 */

import { App } from './App';
import { LINEUP_EVENT_NAMES } from './config/events';
import { LINEUP_STORAGE_KEYS } from './config/storageKeys';
import { redactSensitiveTokens } from './utils/redact';
import { summarizeErrorForLog } from './utils/errors';
import {
    parseStoredBoolean,
    readStoredBoolean,
    safeLocalStorageGet,
    safeLocalStorageRemove,
    safeLocalStorageSet,
} from './utils/storage';

type ConsoleNoiseMethod = 'debug' | 'info' | 'log' | 'warn';
const CONSOLE_NOISE_METHODS: ConsoleNoiseMethod[] = ['debug', 'info', 'log', 'warn'];
/* eslint-disable no-console -- preserve originals so runtime setting changes can restore methods */
const ORIGINAL_CONSOLE_METHODS: Record<ConsoleNoiseMethod, (...args: unknown[]) => void> = {
    debug: console.debug.bind(console),
    info: console.info.bind(console),
    log: console.log.bind(console),
    warn: console.warn.bind(console),
};
/* eslint-enable no-console */

/**
 * In lean production builds, silence noisy console output unless debug logging is explicitly enabled.
 * Keep console.error intact for real failure diagnostics.
 */
function configureLoggingPolicy(): void {
    const debugEnabled = readStoredBoolean(LINEUP_STORAGE_KEYS.DEBUG_LOGGING, false);
    const shouldSuppressNoise = !__LINEUP_DEV_BUILD__ && !debugEnabled;
    const noop = (..._args: unknown[]): void => undefined;
    for (const method of CONSOLE_NOISE_METHODS) {
        // eslint-disable-next-line no-console
        console[method] = shouldSuppressNoise ? noop : ORIGINAL_CONSOLE_METHODS[method];
    }
}

function migrateLegacyDebugLoggingKey(): void {
    const primaryKey = LINEUP_STORAGE_KEYS.DEBUG_LOGGING;
    const legacyKey = 'lineup_debug_transcode';

    const primary = parseStoredBoolean(safeLocalStorageGet(primaryKey));
    if (primary !== null) return;

    const legacy = parseStoredBoolean(safeLocalStorageGet(legacyKey));
    if (legacy === null) return;

    const serialized = legacy ? '1' : '0';
    const didSet = safeLocalStorageSet(primaryKey, serialized);
    if (!didSet) return;
    safeLocalStorageRemove(legacyKey);
}

function logLifecycle(message: string): void {
    ORIGINAL_CONSOLE_METHODS.warn(message);
}

interface LineupDebugApi {
    openEPG: () => void;
    closeEPG: () => void;
    toggleEPG: () => void;
    domSnapshot: () => unknown;
    hideVideo: () => void;
    showVideo: () => void;
    orchestratorStatus: () => unknown;
}

let app: App | null = null;
let bootstrapInstalled = false;

function handleDebugLoggingChanged(): void {
    configureLoggingPolicy();
    syncWindowDebugApi(app);
}

function handleDomContentLoaded(): void {
    bootstrap().catch((error: unknown) => {
        console.error('[Lineup] bootstrap failed:', summarizeErrorForLog(error));
    });
}

function handlePageHide(): void {
    cleanup().catch((error: unknown) => {
        console.error('[Lineup] cleanup failed:', summarizeErrorForLog(error));
    });
}

function handlePageShow(event: PageTransitionEvent): void {
    // Restore from BFCache (browser dev). When a page is restored from cache, scripts are not re-run.
    if (!event.persisted) return;
    if (app) return;
    bootstrap().catch((error: unknown) => {
        console.error('[Lineup] bootstrap (pageshow) failed:', summarizeErrorForLog(error));
    });
}

function isDebugSurfaceEnabled(): boolean {
    const debugEnabled = readStoredBoolean(LINEUP_STORAGE_KEYS.DEBUG_LOGGING, false);
    return __LINEUP_DEV_BUILD__ || debugEnabled;
}

function toSafeErrorMessage(value: unknown): string {
    if (value instanceof Error) {
        return redactSensitiveTokens(value.message);
    }
    if (typeof value === 'string') {
        return redactSensitiveTokens(value);
    }
    return 'An unexpected error occurred.';
}

function syncWindowDebugApi(currentApp: App | null): void {
    const win = window as Window & { __LINEUP__?: LineupDebugApi };
    if (!currentApp || !isDebugSurfaceEnabled()) {
        delete win.__LINEUP__;
        return;
    }
    win.__LINEUP__ = {
        openEPG: (): void => {
            currentApp.getOrchestrator()?.openEPG();
        },
        closeEPG: (): void => {
            currentApp.getOrchestrator()?.closeEPG();
        },
        toggleEPG: (): void => {
            currentApp.getOrchestrator()?.toggleEPG();
        },
        domSnapshot: (): unknown => ({
            app: describeElement(document.getElementById('app')),
            videoContainer: describeElement(document.getElementById('video-container')),
            video: describeElement(document.querySelector('video')),
            epgContainer: describeElement(document.getElementById('epg-container')),
        }),
        hideVideo: (): void => {
            const video = document.querySelector('video') as HTMLElement | null;
            if (video) video.style.display = 'none';
        },
        showVideo: (): void => {
            const video = document.querySelector('video') as HTMLElement | null;
            // Remove the inline override so the stylesheet/default display can apply.
            if (video) video.style.display = '';
        },
        orchestratorStatus: (): unknown => {
            const orchestrator = currentApp.getOrchestrator();
            if (!orchestrator) return null;
            const status = Array.from(orchestrator.getModuleStatus().values()).map((s) => ({
                id: s.id,
                status: s.status,
                loadTimeMs: s.loadTimeMs ?? null,
                errorCode: s.error?.code ?? null,
            }));
            return {
                isReady: orchestrator.isReady(),
                status,
            };
        },
    };
}

// ============================================
// Global Error Handling
// ============================================

/**
 * Handle uncaught errors.
 */
function handleGlobalError(event: ErrorEvent): void {
    const raw = event.error ?? event.message;
    console.error('Uncaught error:', summarizeErrorForLog(raw));
    showGlobalErrorOverlay(toSafeErrorMessage(raw));
    event.preventDefault();
}

/**
 * Handle unhandled promise rejections.
 */
function handleUnhandledRejection(event: PromiseRejectionEvent): void {
    console.error('Unhandled promise rejection:', summarizeErrorForLog(event.reason));
    const message = toSafeErrorMessage(event.reason);
    showGlobalErrorOverlay(message);
    event.preventDefault();
}

function showGlobalErrorOverlay(message: string): void {
    if (typeof document === 'undefined') return;
    const existing = document.getElementById('global-error-overlay');
    if (existing) return;

    const overlay = document.createElement('div');
    overlay.id = 'global-error-overlay';
    overlay.setAttribute('role', 'alert');
    overlay.setAttribute('aria-live', 'assertive');
    overlay.tabIndex = -1;
    overlay.style.position = 'fixed';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'rgba(0, 0, 0, 0.85)';
    overlay.style.color = '#fff';
    overlay.style.zIndex = '99999';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.fontFamily = 'sans-serif';
    overlay.style.padding = '24px';
    overlay.style.textAlign = 'center';

    const title = document.createElement('div');
    title.textContent = 'Something went wrong';
    title.style.fontSize = '28px';
    title.style.marginBottom = '12px';
    title.style.fontWeight = '600';

    const detail = document.createElement('div');
    detail.textContent = message || 'An unexpected error occurred.';
    detail.style.fontSize = '18px';
    detail.style.opacity = '0.9';
    detail.style.maxWidth = '80%';

    const hint = document.createElement('div');
    hint.textContent = 'Please restart the app or try again.';
    hint.style.fontSize = '16px';
    hint.style.marginTop = '16px';
    hint.style.opacity = '0.75';

    overlay.append(title, detail, hint);
    const host = document.body ?? document.documentElement;
    if (!host) return;
    host.appendChild(overlay);
    try {
        overlay.focus();
    } catch {
        // Best-effort focus for accessibility; some environments may block programmatic focus.
    }
}

// Register global error handlers

// ============================================
// Application Bootstrap
// ============================================

function describeElement(el: Element | null): unknown {
    if (!el) return null;
    const element = el as HTMLElement;
    const style = (globalThis as unknown as { getComputedStyle?: (el: Element) => CSSStyleDeclaration })
        .getComputedStyle?.(element);
    return {
        tag: element.tagName,
        id: element.id || null,
        className: element.className || null,
        children: element.childElementCount,
        rect: element.getBoundingClientRect
            ? ((): { x: number; y: number; w: number; h: number } => {
                const r = element.getBoundingClientRect();
                return { x: r.x, y: r.y, w: r.width, h: r.height };
            })()
            : null,
        computed: style
            ? {
                display: style.display,
                visibility: style.visibility,
                opacity: style.opacity,
                zIndex: style.zIndex,
                position: style.position,
            }
            : null,
    };
}

/**
 * Initialize the application when DOM is ready.
 */
async function bootstrap(): Promise<void> {
    logLifecycle('[Lineup] Starting...');

    try {
        app = new App();
        syncWindowDebugApi(app);
        await app.start();
        logLifecycle('[Lineup] Started successfully');
    } catch (error) {
        console.error('Failed to start Lineup:', summarizeErrorForLog(error));
        showGlobalErrorOverlay(toSafeErrorMessage(error));
        app = null;
        syncWindowDebugApi(null);
    }
}

/**
 * Cleanup when page unloads.
 */
async function cleanup(): Promise<void> {
    const currentApp = app;
    if (!currentApp) {
        syncWindowDebugApi(null);
        return;
    }

    logLifecycle('[Lineup] Shutting down...');
    try {
        await currentApp.shutdown();
        logLifecycle('[Lineup] Shut down complete');
    } catch (error: unknown) {
        console.error('[Lineup] shutdown failed:', summarizeErrorForLog(error));
        throw error;
    } finally {
        app = null;
        syncWindowDebugApi(null);
    }
}

export function installLineupBootstrap(): void {
    if (bootstrapInstalled) return;
    bootstrapInstalled = true;

    migrateLegacyDebugLoggingKey();
    configureLoggingPolicy();
    window.addEventListener(LINEUP_EVENT_NAMES.DEBUG_LOGGING_CHANGED, handleDebugLoggingChanged);

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', handleDomContentLoaded, { once: true });
    } else {
        bootstrap().catch((error: unknown) => {
            console.error('[Lineup] bootstrap failed:', summarizeErrorForLog(error));
        });
    }

    // Cleanup on page hide (more reliable for async work than beforeunload)
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);
}

/**
 * Remove global handlers registered by installLineupBootstrap().
 * @internal Primarily intended for tests and debug harnesses.
 * @remarks Call `cleanup()` first, or use `cleanupAndUninstallLineupBootstrap()` to avoid
 * leaving a running app without lifecycle handlers.
 */
function uninstallLineupBootstrap(): void {
    if (!bootstrapInstalled) return;
    bootstrapInstalled = false;

    window.removeEventListener(LINEUP_EVENT_NAMES.DEBUG_LOGGING_CHANGED, handleDebugLoggingChanged);
    window.removeEventListener('error', handleGlobalError);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    window.removeEventListener('pagehide', handlePageHide);
    window.removeEventListener('pageshow', handlePageShow);
    document.removeEventListener('DOMContentLoaded', handleDomContentLoaded);
}

/**
 * Convenience helper for tests/harnesses to shutdown the app and remove global handlers.
 * @internal
 */
export async function cleanupAndUninstallLineupBootstrap(): Promise<void> {
    let cleanupError: unknown;
    try {
        await cleanup();
    } catch (error: unknown) {
        cleanupError = error;
    } finally {
        uninstallLineupBootstrap();
    }
    if (cleanupError) {
        throw cleanupError;
    }
}

// Exported as a live binding for integration/debug harnesses.
// @internal Test/debug harness surface only; not a stable API for production consumers.
// Prefer App APIs over importing this singleton from app code.
export const bootstrapInternals = {
    configureLoggingPolicy,
    isDebugSurfaceEnabled,
    toSafeErrorMessage,
    syncWindowDebugApi,
    handleGlobalError,
    handleUnhandledRejection,
    showGlobalErrorOverlay,
    describeElement,
    uninstallLineupBootstrap,
    cleanupAndUninstallLineupBootstrap,
};

export { app, bootstrap, cleanup };
