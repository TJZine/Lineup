/**
 * @fileoverview Application entry point.
 * @module index
 * @version 1.0.0
 */

import { App } from './App';
import { RETUNE_EVENT_NAMES } from './config/events';
import { RETUNE_STORAGE_KEYS } from './config/storageKeys';
import { redactSensitiveTokens } from './utils/redact';
import { readStoredBooleanWithLegacy } from './utils/storage';
import './styles/tokens.css';
import './styles/themes.css';
import './styles/video.css';
import './modules/ui/epg/styles.css';
import './modules/ui/now-playing-info/styles.css';
import './modules/ui/player-osd/styles.css';
import './modules/ui/mini-guide/styles.css';
import './modules/ui/channel-transition/styles.css';
import './modules/ui/playback-options/styles.css';
import './modules/ui/settings/styles.css';
import './modules/ui/profile-select/styles.css';
import './modules/ui/server-select/styles.css';
import './modules/ui/audio-setup/styles.css';
import './modules/ui/channel-setup/styles.css';
import './styles/shell.css';

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
    app: App;
    openEPG: () => void;
    closeEPG: () => void;
    toggleEPG: () => void;
    domSnapshot: () => unknown;
    hideVideo: () => void;
    showVideo: () => void;
    orchestratorStatus: () => unknown;
}

let app: App | null = null;

function isDebugSurfaceEnabled(): boolean {
    const debugEnabled = readStoredBooleanWithLegacy(
        RETUNE_STORAGE_KEYS.DEBUG_LOGGING,
        RETUNE_STORAGE_KEYS.DEBUG_LOGGING_LEGACY,
        false
    );
    return __RETUNE_DEV_BUILD__ || debugEnabled;
}

function summarizeErrorForLog(value: unknown): unknown {
    if (typeof value === 'string') {
        return redactSensitiveTokens(value);
    }
    if (value instanceof Error) {
        return {
            name: value.name,
            message: redactSensitiveTokens(value.message),
        };
    }
    if (value && typeof value === 'object') {
        const maybe = value as { name?: unknown; message?: unknown; code?: unknown };
        return {
            ...(typeof maybe.name === 'string' ? { name: maybe.name } : {}),
            ...('code' in maybe ? { code: maybe.code } : {}),
            ...(typeof maybe.message === 'string'
                ? { message: redactSensitiveTokens(maybe.message) }
                : {}),
        };
    }
    return value;
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
        app: currentApp,
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

configureLoggingPolicy();
window.addEventListener(RETUNE_EVENT_NAMES.DEBUG_LOGGING_CHANGED, () => {
    configureLoggingPolicy();
    syncWindowDebugApi(app);
});

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
window.addEventListener('error', handleGlobalError);
window.addEventListener('unhandledrejection', handleUnhandledRejection);

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
        console.error('Failed to start Retune:', error);
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
    }
    syncWindowDebugApi(null);
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        bootstrap().catch(console.error);
    });
} else {
    bootstrap().catch(console.error);
}

// Cleanup on page hide (more reliable for async work than beforeunload)
window.addEventListener('pagehide', () => {
    cleanup().catch(console.error);
});

// Exported as a live binding for integration/debug harnesses.
// @internal Prefer App APIs over importing this singleton from app code.
export { app, bootstrap, cleanup };
