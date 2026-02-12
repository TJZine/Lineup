/**
 * @fileoverview Application bootstrap wiring.
 * @module bootstrap
 * @version 1.0.0
 */

import { App } from './App';
import { RETUNE_EVENT_NAMES } from './config/events';
import { RETUNE_STORAGE_KEYS } from './config/storageKeys';
import { redactSensitiveTokens } from './utils/redact';
import { summarizeErrorForLog } from './utils/errors';
import { readStoredBooleanWithLegacy } from './utils/storage';

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
    const debugEnabled = readStoredBooleanWithLegacy(
        RETUNE_STORAGE_KEYS.DEBUG_LOGGING,
        RETUNE_STORAGE_KEYS.DEBUG_LOGGING_LEGACY,
        false
    );
    const shouldSuppressNoise = !__RETUNE_DEV_BUILD__ && !debugEnabled;
    const noop = (..._args: unknown[]): void => undefined;
    for (const method of CONSOLE_NOISE_METHODS) {
        // eslint-disable-next-line no-console
        console[method] = shouldSuppressNoise ? noop : ORIGINAL_CONSOLE_METHODS[method];
    }
}

function logLifecycle(message: string): void {
    ORIGINAL_CONSOLE_METHODS.warn(message);
}

interface RetuneDebugApi {
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

function isDebugSurfaceEnabled(): boolean {
    const debugEnabled = readStoredBooleanWithLegacy(
        RETUNE_STORAGE_KEYS.DEBUG_LOGGING,
        RETUNE_STORAGE_KEYS.DEBUG_LOGGING_LEGACY,
        false
    );
    return __RETUNE_DEV_BUILD__ || debugEnabled;
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
    const win = window as Window & { __RETUNE__?: RetuneDebugApi };
    if (!currentApp || !isDebugSurfaceEnabled()) {
        delete win.__RETUNE__;
        return;
    }
    win.__RETUNE__ = {
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
            if (video) video.style.display = 'block';
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
    logLifecycle('[Retune] Starting...');

    try {
        app = new App();
        syncWindowDebugApi(app);
        await app.start();
        logLifecycle('[Retune] Started successfully');
    } catch (error) {
        console.error('Failed to start Retune:', summarizeErrorForLog(error));
        showGlobalErrorOverlay(toSafeErrorMessage(error));
        app = null;
        syncWindowDebugApi(null);
    }
}

/**
 * Cleanup when page unloads.
 */
async function cleanup(): Promise<void> {
    if (app) {
        logLifecycle('[Retune] Shutting down...');
        await app.shutdown();
        logLifecycle('[Retune] Shut down complete');
        app = null;
    }
    syncWindowDebugApi(null);
}

export function installRetuneBootstrap(): void {
    if (bootstrapInstalled) return;
    bootstrapInstalled = true;

    configureLoggingPolicy();
    window.addEventListener(RETUNE_EVENT_NAMES.DEBUG_LOGGING_CHANGED, () => {
        configureLoggingPolicy();
        syncWindowDebugApi(app);
    });

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            bootstrap().catch((error: unknown) => {
                console.error('[Retune] bootstrap failed:', summarizeErrorForLog(error));
            });
        });
    } else {
        bootstrap().catch((error: unknown) => {
            console.error('[Retune] bootstrap failed:', summarizeErrorForLog(error));
        });
    }

    // Cleanup on page hide (more reliable for async work than beforeunload)
    window.addEventListener('pagehide', () => {
        cleanup().catch((error: unknown) => {
            console.error('[Retune] cleanup failed:', summarizeErrorForLog(error));
        });
    });

    // Restore from BFCache (browser dev). When a page is restored from cache, scripts are not re-run.
    window.addEventListener('pageshow', (event: PageTransitionEvent) => {
        if (!event.persisted) return;
        if (app) return;
        bootstrap().catch((error: unknown) => {
            console.error('[Retune] bootstrap (pageshow) failed:', summarizeErrorForLog(error));
        });
    });
}

// Exported as a live binding for integration/debug harnesses.
// @internal Prefer App APIs over importing this singleton from app code.
export const bootstrapInternals = {
    configureLoggingPolicy,
    isDebugSurfaceEnabled,
    toSafeErrorMessage,
    syncWindowDebugApi,
    handleGlobalError,
    handleUnhandledRejection,
    showGlobalErrorOverlay,
    describeElement,
};

export { app, bootstrap, cleanup };
