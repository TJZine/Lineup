import { EPG_CLASSES } from '../constants';
import type { ScheduledProgram } from '../types';
import { extractDominantColor } from '../../../../utils/color/extractDominantColor';

const MAX_DYNAMIC_COLOR_CACHE_ENTRIES = 128;
const DYNAMIC_COLOR_FAILURE_COOLDOWN_MS = 60_000;

type DynamicBackgroundDeps = {
    onPendingWork: () => void;
    onSettled: () => void;
    isCurrentRequest: (program: ScheduledProgram, token: number) => boolean;
};

export class EPGInfoPanelDynamicBackground {
    private dynamicColorToken = 0;
    private gradientAElement: HTMLElement | null = null;
    private gradientBElement: HTMLElement | null = null;
    private activeGradientSlot: 'a' | 'b' = 'a';
    private colorExtractTimer: ReturnType<typeof setTimeout> | null = null;
    private colorFetchController: AbortController | null = null;
    private readonly colorCache = new Map<string, string>();
    private readonly colorFailureCache = new Map<string, number>();

    constructor(private readonly deps: DynamicBackgroundDeps) {}

    bindGradientElements(gradientA: HTMLElement | null, gradientB: HTMLElement | null): void {
        this.gradientAElement = gradientA;
        this.gradientBElement = gradientB;
    }

    scheduleDynamicColor(program: ScheduledProgram, sampleUrl: string): void {
        this.clearColorExtractTimer();
        this.clearColorFetch();

        const cacheKey = program.item.ratingKey;
        const cachedColor = this.colorCache.get(cacheKey);
        if (cachedColor) {
            this.applyDynamicColor(cachedColor);
            return;
        }

        const lastFailure = this.colorFailureCache.get(cacheKey) ?? null;
        if (lastFailure !== null && (Date.now() - lastFailure) < DYNAMIC_COLOR_FAILURE_COOLDOWN_MS) {
            this.clearDynamicColor();
            return;
        }
        const token = ++this.dynamicColorToken;
        this.deps.onPendingWork();
        this.colorExtractTimer = setTimeout(() => {
            this.colorExtractTimer = null;
            if (!this.isCurrentRequest(program, token)) {
                this.deps.onSettled();
                return;
            }

            if (!sampleUrl) {
                this.markDynamicColorFailure(cacheKey);
                this.clearDynamicColor();
                return;
            }
            const controller = new AbortController();
            this.colorFetchController = controller;
            void this.loadDynamicColorFromSampleUrl(program, cacheKey, token, sampleUrl, controller);
        }, 120);
    }

    clearDynamicColor(): void {
        this.dynamicColorToken += 1;
        this.clearColorExtractTimer();
        this.clearColorFetch();

        if (this.gradientAElement) {
            this.gradientAElement.style.removeProperty('--dynamic-info-bg');
            this.gradientAElement.classList.add(EPG_CLASSES.INFO_GRADIENT_ACTIVE);
        }

        if (this.gradientBElement) {
            this.gradientBElement.style.removeProperty('--dynamic-info-bg');
            this.gradientBElement.classList.remove(EPG_CLASSES.INFO_GRADIENT_ACTIVE);
        }

        this.activeGradientSlot = 'a';
    }

    clearCaches(): void {
        this.colorCache.clear();
        this.colorFailureCache.clear();
    }

    unbind(): void {
        this.dynamicColorToken += 1;
        this.clearColorFetch();
        this.clearColorExtractTimer();
        this.gradientAElement = null;
        this.gradientBElement = null;
        this.activeGradientSlot = 'a';
    }

    hasPendingAsyncWork(): boolean {
        return this.colorExtractTimer !== null || this.colorFetchController !== null;
    }

    private clearColorExtractTimer(): void {
        if (this.colorExtractTimer !== null) {
            clearTimeout(this.colorExtractTimer);
            this.colorExtractTimer = null;
        }
        this.deps.onSettled();
    }

    private clearColorFetch(): void {
        if (this.colorFetchController) {
            this.colorFetchController.abort();
            this.colorFetchController = null;
        }
        this.deps.onSettled();
    }

    private storeDynamicColor(cacheKey: string, color: string): void {
        this.colorFailureCache.delete(cacheKey);
        this.colorCache.set(cacheKey, color);
        this.ensureCacheUnderLimit(this.colorCache, MAX_DYNAMIC_COLOR_CACHE_ENTRIES);
    }

    private markDynamicColorFailure(cacheKey: string): void {
        this.colorFailureCache.set(cacheKey, Date.now());
        this.ensureCacheUnderLimit(this.colorFailureCache, MAX_DYNAMIC_COLOR_CACHE_ENTRIES);
    }

    private ensureCacheUnderLimit<T>(map: Map<string, T>, limit: number): void {
        if (map.size <= limit) {
            return;
        }

        const oldestKey = map.keys().next().value;
        if (typeof oldestKey === 'string') {
            map.delete(oldestKey);
        }
    }

    private applyDynamicColor(color: string): void {
        const incoming = this.activeGradientSlot === 'a' ? this.gradientBElement : this.gradientAElement;
        const outgoing = this.activeGradientSlot === 'a' ? this.gradientAElement : this.gradientBElement;

        if (!incoming || !outgoing) {
            return;
        }

        incoming.style.setProperty('--dynamic-info-bg', color);
        incoming.classList.add(EPG_CLASSES.INFO_GRADIENT_ACTIVE);
        outgoing.classList.remove(EPG_CLASSES.INFO_GRADIENT_ACTIVE);
        this.activeGradientSlot = this.activeGradientSlot === 'a' ? 'b' : 'a';
    }

    private async loadDynamicColorFromSampleUrl(
        program: ScheduledProgram,
        cacheKey: string,
        token: number,
        sampleUrl: string,
        controller: AbortController
    ): Promise<void> {
        try {
            if (typeof fetch !== 'function') {
                throw new Error('fetch unavailable');
            }
            if (typeof URL.createObjectURL !== 'function' || typeof URL.revokeObjectURL !== 'function') {
                throw new Error('blob url unavailable');
            }

            const response = await fetch(sampleUrl, { signal: controller.signal });
            if (!response.ok) {
                throw new Error(`sample fetch failed: ${response.status}`);
            }
            if (!this.isCurrentRequest(program, token) || this.colorFetchController !== controller) {
                return;
            }

            const blob = await response.blob();
            if (!this.isCurrentRequest(program, token) || this.colorFetchController !== controller) {
                return;
            }

            const blobUrl = URL.createObjectURL(blob);
            const sampler = new Image();

            const finalize = (): void => {
                URL.revokeObjectURL(blobUrl);
                if (this.colorFetchController === controller) {
                    this.colorFetchController = null;
                }
            };

            sampler.onload = (): void => {
                finalize();
                if (!this.isCurrentRequest(program, token)) {
                    this.deps.onSettled();
                    return;
                }

                const color = extractDominantColor(sampler);
                if (color) {
                    this.storeDynamicColor(cacheKey, color);
                    this.applyDynamicColor(color);
                    this.deps.onSettled();
                    return;
                }

                this.markDynamicColorFailure(cacheKey);
                this.clearDynamicColor();
            };

            sampler.onerror = (): void => {
                finalize();
                if (!this.isCurrentRequest(program, token)) {
                    this.deps.onSettled();
                    return;
                }

                this.markDynamicColorFailure(cacheKey);
                this.clearDynamicColor();
            };

            sampler.src = blobUrl;
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                if (this.colorFetchController === controller) {
                    this.colorFetchController = null;
                }
                this.deps.onSettled();
                return;
            }

            if (this.colorFetchController === controller) {
                this.colorFetchController = null;
            }

            if (!this.isCurrentRequest(program, token)) {
                this.deps.onSettled();
                return;
            }

            this.markDynamicColorFailure(cacheKey);
            this.clearDynamicColor();
        }
    }

    private isCurrentRequest(program: ScheduledProgram, token: number): boolean {
        return token === this.dynamicColorToken && this.deps.isCurrentRequest(program, token);
    }
}
