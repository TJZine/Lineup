import { App } from './App';
import { LINEUP_EVENT_NAMES } from './config/events';
import { LINEUP_STORAGE_KEYS } from './config/storageKeys';
import { DeveloperSettingsStore } from './modules/settings/DeveloperSettingsStore';
import { APP_SHELL_CONTAINER_IDS } from './modules/ui/common/appShellContainerIds';
import { sanitizeDiagnosticText } from './utils/redact';
import { summarizeErrorForLog } from './utils/errors';
import {
    parseStoredBoolean,
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
const { error: originalConsoleError } = console;
/* eslint-enable no-console */
const ORIGINAL_CONSOLE_ERROR = originalConsoleError.bind(console);

const developerSettingsStore = new DeveloperSettingsStore();
const GLOBAL_ERROR_OVERLAY_ID = 'global-error-overlay';
const GLOBAL_ERROR_OVERLAY_FATAL_CLASS = 'error-overlay-fatal';
type LineupAppInstance = InstanceType<typeof App>;

/**
 * In lean production builds, silence noisy console output unless debug logging is explicitly enabled.
 * Keep error logging intact for real failure diagnostics.
 */
function configureLoggingPolicy(): void {
    const debugEnabled = developerSettingsStore.readDebugLoggingEnabledAndClean(false);
    const shouldSuppressNoise = !__LINEUP_DEV_BUILD__ && !debugEnabled;
    const noop = (..._args: unknown[]): void => undefined;
    for (const method of CONSOLE_NOISE_METHODS) {
        // eslint-disable-next-line no-console
        console[method] = shouldSuppressNoise ? noop : ORIGINAL_CONSOLE_METHODS[method];
    }
}

function restoreLoggingPolicy(): void {
    for (const method of CONSOLE_NOISE_METHODS) {
        // eslint-disable-next-line no-console
        console[method] = ORIGINAL_CONSOLE_METHODS[method];
    }
}

function migrateLegacyDebugLoggingKey(): void {
    const primaryKey = LINEUP_STORAGE_KEYS.DEBUG_LOGGING;
    const legacyKey = 'lineup_debug_transcode';

    if (developerSettingsStore.hasDebugLoggingEnabledValue()) return;

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

function logSanitizedError(prefix: string, error: unknown): void {
    ORIGINAL_CONSOLE_ERROR(prefix, summarizeErrorForLog(error));
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

export interface LineupBootstrapModuleStatusSnapshot {
    readonly id: string;
    readonly status: string;
    readonly loadTimeMs: number | null;
    readonly errorCode: string | null;
}

export interface LineupBootstrapOrchestratorStatusSnapshot {
    readonly isReady: boolean;
    readonly currentScreen: string | null;
    readonly status: readonly LineupBootstrapModuleStatusSnapshot[];
}

export interface LineupBootstrapStatus {
    readonly hasApp: boolean;
    readonly hasOrchestrator: boolean;
    readonly orchestrator: LineupBootstrapOrchestratorStatusSnapshot | null;
}

let app: LineupAppInstance | null = null;
let bootstrapPromise: Promise<void> | null = null;
let bootstrapInstalled = false;

function handleDebugLoggingChanged(): void {
    configureLoggingPolicy();
    syncWindowDebugApi(app);
}

function handleDomContentLoaded(): void {
    startBootstrapAttempt('[Lineup] bootstrap failed:');
}

function handlePageHide(): void {
    void cleanup().catch(handleCleanupFailure);
}

function handlePageShow(event: PageTransitionEvent): void {
    // Restore from BFCache (browser dev). When a page is restored from cache, scripts are not re-run.
    if (!event.persisted) return;
    if (app) return;
    startBootstrapAttempt('[Lineup] bootstrap (pageshow) failed:');
}

function startBootstrapAttempt(prefix: string): void {
    void runBootstrapAttempt(prefix);
}

async function runBootstrapAttempt(prefix: string): Promise<void> {
    try {
        await bootstrap();
    } catch (error: unknown) {
        handleBootstrapFailure(prefix, error);
    }
}

function handleCleanupFailure(error: unknown): void {
    logSanitizedError('[Lineup] cleanup failed:', error);
}

function handleBootstrapFailure(prefix: string, error: unknown): void {
    logSanitizedError(prefix, error);
    showGlobalErrorOverlay(toSafeErrorMessage(error));
    app = null;
    syncWindowDebugApi(null);
}

function isDebugSurfaceEnabled(): boolean {
    const debugEnabled = developerSettingsStore.readDebugLoggingEnabledAndClean(false);
    return __LINEUP_DEV_BUILD__ || debugEnabled;
}

function toSafeErrorMessage(value: unknown): string {
    if (value instanceof Error) {
        return sanitizeDiagnosticText(value.message);
    }
    if (typeof value === 'string') {
        return sanitizeDiagnosticText(value);
    }
    return 'An unexpected error occurred.';
}

function openDebugEpg(currentApp: LineupAppInstance): void {
    currentApp.getOrchestrator()?.openEPG();
}

function closeDebugEpg(currentApp: LineupAppInstance): void {
    currentApp.getOrchestrator()?.closeEPG();
}

function toggleDebugEpg(currentApp: LineupAppInstance): void {
    currentApp.getOrchestrator()?.toggleEPG();
}

function getDebugDomSnapshot(): unknown {
    return {
        app: describeElement(document.getElementById('app')),
        videoContainer: describeElement(document.getElementById(APP_SHELL_CONTAINER_IDS.VIDEO)),
        video: describeElement(document.querySelector('video')),
        epgContainer: describeElement(document.getElementById('epg-container')),
    };
}

function setDebugVideoDisplay(display: string): void {
    const video = document.querySelector('video') as HTMLElement | null;
    if (video) video.style.display = display;
}

function hideDebugVideo(): void {
    setDebugVideoDisplay('none');
}

function showDebugVideo(): void {
    // Remove the inline override so the stylesheet/default display can apply.
    setDebugVideoDisplay('');
}

function getDebugOrchestratorStatus(currentApp: LineupAppInstance): unknown {
    const status = getOrchestratorStatusSnapshot(currentApp);
    if (!status) return null;
    return {
        isReady: status.isReady,
        status: status.status,
    };
}

function getOrchestratorStatusSnapshot(currentApp: LineupAppInstance): LineupBootstrapOrchestratorStatusSnapshot | null {
    const orchestrator = currentApp.getOrchestrator();
    if (!orchestrator) return null;
    const status = Array.from(orchestrator.getModuleStatus().values(), toDebugModuleStatusSnapshot);
    return {
        isReady: orchestrator.isReady(),
        currentScreen: orchestrator.getCurrentScreen(),
        status,
    };
}

function createLineupDebugApi(currentApp: LineupAppInstance): LineupDebugApi {
    return {
        openEPG: openDebugEpg.bind(null, currentApp),
        closeEPG: closeDebugEpg.bind(null, currentApp),
        toggleEPG: toggleDebugEpg.bind(null, currentApp),
        domSnapshot: getDebugDomSnapshot,
        hideVideo: hideDebugVideo,
        showVideo: showDebugVideo,
        orchestratorStatus: getDebugOrchestratorStatus.bind(null, currentApp),
    };
}

function syncWindowDebugApi(currentApp: LineupAppInstance | null): void {
    const win = window as Window & { __LINEUP__?: LineupDebugApi };
    if (!currentApp || !isDebugSurfaceEnabled()) {
        delete win.__LINEUP__;
        return;
    }
    win.__LINEUP__ = createLineupDebugApi(currentApp);
}

function handleGlobalError(event: ErrorEvent): void {
    const raw = event.error ?? event.message;
    logSanitizedError('Uncaught error:', raw);
    showGlobalErrorOverlay(toSafeErrorMessage(raw));
    event.preventDefault();
}

function handleUnhandledRejection(event: PromiseRejectionEvent): void {
    logSanitizedError('Unhandled promise rejection:', event.reason);
    const message = toSafeErrorMessage(event.reason);
    showGlobalErrorOverlay(message);
    event.preventDefault();
}

function showGlobalErrorOverlay(message: string): void {
    if (typeof document === 'undefined') return;
    const existing = document.getElementById(GLOBAL_ERROR_OVERLAY_ID);
    if (existing) return;

    const overlay = document.createElement('div');
    overlay.id = GLOBAL_ERROR_OVERLAY_ID;
    overlay.className = `error-overlay ${GLOBAL_ERROR_OVERLAY_FATAL_CLASS}`;
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-live', 'assertive');
    overlay.setAttribute('aria-atomic', 'true');
    overlay.tabIndex = -1;
    applyGlobalErrorOverlayFallbackStyles(overlay);
    const content = document.createElement('div');
    content.className = 'error-content';
    applyGlobalErrorContentFallbackStyles(content);

    const title = document.createElement('h2');
    const titleId = `${GLOBAL_ERROR_OVERLAY_ID}-title`;
    title.id = titleId;
    title.className = 'error-title';
    title.textContent = 'Something went wrong';

    const detail = document.createElement('p');
    const detailId = `${GLOBAL_ERROR_OVERLAY_ID}-detail`;
    detail.id = detailId;
    detail.className = 'error-message';
    detail.textContent = message || 'An unexpected error occurred.';

    const hint = document.createElement('p');
    hint.className = 'error-message';
    hint.textContent = 'Please restart the app or try again.';
    overlay.setAttribute('aria-labelledby', titleId);
    overlay.setAttribute('aria-describedby', detailId);
    content.append(title, detail, hint);
    overlay.appendChild(content);
    const host = document.body ?? document.documentElement;
    if (!host) return;
    host.appendChild(overlay);
    try {
        overlay.focus();
    } catch {
        // Best-effort focus for accessibility; some environments may block programmatic focus.
    }
}

function applyGlobalErrorOverlayFallbackStyles(overlay: HTMLElement): void {
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.left = '0';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '24px';
    overlay.style.background = 'var(--color-bg-overlay, rgba(0, 0, 0, 0.65))';
    overlay.style.color = 'var(--color-text-primary, #ffffff)';
    overlay.style.zIndex = '2147483647';
}

function applyGlobalErrorContentFallbackStyles(content: HTMLElement): void {
    content.style.width = 'min(760px, 92vw)';
}

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
        rect: describeElementRect(element),
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

function toDebugModuleStatusSnapshot(s: {
    id: string;
    status: string;
    loadTimeMs?: number | null;
    error?: { code?: string | null } | null;
}): { id: string; status: string; loadTimeMs: number | null; errorCode: string | null } {
    return {
        id: s.id,
        status: s.status,
        loadTimeMs: s.loadTimeMs ?? null,
        errorCode: s.error?.code ?? null,
    };
}

function describeElementRect(
    element: HTMLElement
): { x: number; y: number; w: number; h: number } | null {
    if (!element.getBoundingClientRect) return null;
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
}

function bootstrap(): Promise<void> {
    if (bootstrapPromise) {
        return bootstrapPromise;
    }

    logLifecycle('[Lineup] Starting...');
    const nextApp = new App();
    app = nextApp;
    syncWindowDebugApi(nextApp);

    let currentBootstrapPromise: Promise<void> | null = null;
    currentBootstrapPromise = (async (): Promise<void> => {
        try {
            await nextApp.start();
            if (app !== nextApp) {
                await nextApp.shutdown();
                return;
            }
            logLifecycle('[Lineup] Started successfully');
        } catch (error: unknown) {
            if (app === nextApp) {
                app = null;
                syncWindowDebugApi(null);
            }
            throw error;
        } finally {
            if (bootstrapPromise === currentBootstrapPromise) {
                bootstrapPromise = null;
            }
        }
    })();
    bootstrapPromise = currentBootstrapPromise;
    return currentBootstrapPromise;
}

async function cleanup(): Promise<void> {
    const pendingBootstrap = bootstrapPromise;
    if (pendingBootstrap) {
        await pendingBootstrap.catch(() => undefined);
    }

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
        logSanitizedError('[Lineup] shutdown failed:', error);
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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', handleDomContentLoaded, { once: true });
    } else {
        startBootstrapAttempt('[Lineup] bootstrap failed:');
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
    restoreLoggingPolicy();
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

export function getLineupBootstrapStatus(): LineupBootstrapStatus {
    const orchestrator = app ? getOrchestratorStatusSnapshot(app) : null;
    return {
        hasApp: app !== null,
        hasOrchestrator: orchestrator !== null,
        orchestrator,
    };
}

export { bootstrap, cleanup };
