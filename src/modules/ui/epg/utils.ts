/**
 * @fileoverview EPG UI module utility functions
 * @module modules/ui/epg/utils
 */

import { LINEUP_STORAGE_KEYS } from '../../../config/storageKeys';
import { DebugOverridesStore } from '../../debug/DebugOverridesStore';
import { safeLocalStorageGet, safeLocalStorageSet } from '../../../utils/storage';

/**
 * Format a timestamp as a time string (e.g., "12:30 PM").
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted time string
 */
export function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${ampm}`;
}

/**
 * Format a time range for display.
 *
 * @param startTime - Start timestamp (Unix ms)
 * @param endTime - End timestamp (Unix ms)
 * @returns Formatted time range string (e.g., "12:00 PM - 2:30 PM")
 */
export function formatTimeRange(startTime: number, endTime: number): string {
    return `${formatTime(startTime)} - ${formatTime(endTime)}`;
}

export function formatTimeCompact(timestamp: number): string {
    // 12-hour without meridiem for compact rail (e.g. 3:53)
    const date = new Date(timestamp);
    const hours = date.getHours() % 12 || 12;
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

export function formatCellTimeLabel(
    startTime: number,
    endTime: number,
    options: { compact: boolean; forceFull: boolean }
): string {
    if (options.forceFull || !options.compact) {
        return formatTimeRange(startTime, endTime);
    }
    return formatTimeCompact(startTime);
}

/**
 * Format duration in human-readable form.
 *
 * @param durationMs - Duration in milliseconds
 * @returns Formatted string (e.g., "2h 15m")
 */
export function formatDuration(durationMs: number): string {
    const totalMinutes = Math.floor(durationMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) {
        return `${minutes}m`;
    }
    if (minutes === 0) {
        return `${hours}h`;
    }
    return `${hours}h ${minutes}m`;
}

/**
 * Throttle function execution using requestAnimationFrame.
 * Ensures only one execution per animation frame.
 *
 * @param fn - Function to throttle
 * @returns Throttled function
 */
export function rafThrottle<T extends (...args: unknown[]) => void>(
    fn: T
): (...args: Parameters<T>) => void {
    // In test environments (jsdom), RAF may not fire reliably
    // Fall back to synchronous execution
    const isTestEnv = typeof process !== 'undefined' &&
        process.env.NODE_ENV === 'test';

    if (isTestEnv || typeof requestAnimationFrame === 'undefined') {
        return fn;
    }

    let rafId: number | null = null;
    let latestArgs: Parameters<T> | null = null;

    return (...args: Parameters<T>): void => {
        latestArgs = args;

        if (rafId === null) {
            rafId = requestAnimationFrame(() => {
                rafId = null;
                if (latestArgs !== null) {
                    fn(...latestArgs);
                }
            });
        }
    };
}

/**
 * Append a debug log entry to localStorage when EPG debug mode is enabled.
 * Keeps a bounded log for simulator copy/paste.
 */
export function appendEpgDebugLog(event: string, data: unknown): void {
    if (!isEpgDebugLoggingEnabled()) {
        return;
    }
    const entry = { ts: Date.now(), event, data };
    appendEpgDebugEntry(entry);
}

type EpgDebugEntry = { ts: number; event: string; data: unknown };

const EPG_DEBUG_LOG_STORAGE_KEY = LINEUP_STORAGE_KEYS.EPG_DEBUG_LOG;
const EPG_DEBUG_LOG_MAX_ENTRIES = 200;
const EPG_DEBUG_LOG_FLUSH_DELAY_MS = 250;
const EPG_DEBUG_FLAG_REFRESH_MS = 500;
const debugOverridesStore = new DebugOverridesStore();

let epgDebugEntries: EpgDebugEntry[] | null = null;
let epgDebugFlushTimer: ReturnType<typeof setTimeout> | null = null;
let epgDebugEnabledCache: boolean | null = null;
let epgDebugEnabledCacheReadMs = 0;

export function isEpgDebugLoggingEnabled(): boolean {
    const now = Date.now();
    if (
        epgDebugEnabledCache !== null &&
        now - epgDebugEnabledCacheReadMs < EPG_DEBUG_FLAG_REFRESH_MS
    ) {
        return epgDebugEnabledCache;
    }
    epgDebugEnabledCacheReadMs = now;
    try {
        epgDebugEnabledCache = debugOverridesStore.readEpgDebugEnabled(false);
    } catch {
        epgDebugEnabledCache = false;
    }
    return epgDebugEnabledCache;
}

function loadEpgDebugEntries(): EpgDebugEntry[] {
    if (epgDebugEntries) {
        return epgDebugEntries;
    }
    try {
        const raw = safeLocalStorageGet(EPG_DEBUG_LOG_STORAGE_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        epgDebugEntries = Array.isArray(parsed) ? (parsed as EpgDebugEntry[]) : [];
        return epgDebugEntries;
    } catch {
        epgDebugEntries = [];
        return epgDebugEntries;
    }
}

function scheduleEpgDebugFlush(): void {
    if (epgDebugFlushTimer) {
        return;
    }
    epgDebugFlushTimer = setTimeout(() => {
        epgDebugFlushTimer = null;
        safeLocalStorageSet(EPG_DEBUG_LOG_STORAGE_KEY, JSON.stringify(epgDebugEntries ?? []));
    }, EPG_DEBUG_LOG_FLUSH_DELAY_MS);
}

function appendEpgDebugEntry(entry: EpgDebugEntry): void {
    const entries = loadEpgDebugEntries();
    entries.push(entry);
    if (entries.length > EPG_DEBUG_LOG_MAX_ENTRIES) {
        entries.splice(0, entries.length - EPG_DEBUG_LOG_MAX_ENTRIES);
    }
    scheduleEpgDebugFlush();
}

export function __resetEpgDebugStateForTests(): void {
    if (epgDebugFlushTimer) {
        clearTimeout(epgDebugFlushTimer);
        epgDebugFlushTimer = null;
    }
    epgDebugEntries = null;
    epgDebugEnabledCache = null;
    epgDebugEnabledCacheReadMs = 0;
}
