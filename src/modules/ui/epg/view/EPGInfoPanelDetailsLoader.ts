import type { ScheduledProgram } from '../types';
import type { EpgItemDetails } from '../model/domainTypes';
import { extractHdrLabelFromPlexMedia } from '../../../plex/stream/hdr';
import { isAbortLikeError, summarizeErrorForLog } from '../../../../utils/errors';

type FetchItemDetails = (
    ratingKey: string,
    options?: { signal?: AbortSignal | null }
) => Promise<EpgItemDetails | null>;

type InfoPanelDetailsLoaderDeps = {
    onPendingWork: () => void;
    onSettled: () => void;
    onHdrLoaded: (ratingKey: string, hdr: string) => void;
    onEpisodePosterLoaded: (ratingKey: string, thumb: string | null) => void;
};

export class EPGInfoPanelDetailsLoader {
    private fetchItemDetails: FetchItemDetails | null = null;
    private readonly hdrCache = new Map<string, string>();
    private hdrFetchToken = 0;
    private hdrFetchController: AbortController | null = null;
    private hdrFetchTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly episodePosterCache = new Map<string, string | null>();
    private posterFetchToken = 0;
    private posterFetchController: AbortController | null = null;
    private posterFetchTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(private readonly deps: InfoPanelDetailsLoaderDeps) {}

    setFetchItemDetails(fetcher: FetchItemDetails | null): void {
        this.fetchItemDetails = fetcher;
    }

    getCachedHdr(ratingKey: string): string | null {
        return this.hdrCache.get(ratingKey) ?? null;
    }

    hasCachedEpisodePoster(ratingKey: string): boolean {
        return this.episodePosterCache.has(ratingKey);
    }

    getCachedEpisodePoster(ratingKey: string): string | null | undefined {
        return this.episodePosterCache.get(ratingKey);
    }

    maybeFetchHdr(program: ScheduledProgram): void {
        const ratingKey = program.item.ratingKey;
        if (!ratingKey || !this.fetchItemDetails || this.hdrCache.has(ratingKey)) {
            return;
        }

        this.clearHdrFetch();
        const fetchToken = ++this.hdrFetchToken;
        const controller = new AbortController();
        this.hdrFetchController = controller;
        this.deps.onPendingWork();
        this.hdrFetchTimer = setTimeout(() => {
            this.hdrFetchTimer = null;
            void this.fetchItemDetailsSafely(ratingKey, controller.signal)
                .then((item) => {
                    if (fetchToken !== this.hdrFetchToken) return;
                    const hdr = extractHdrLabelFromPlexMedia(item);
                    if (!hdr) return;
                    this.hdrCache.set(ratingKey, hdr);
                    this.deps.onHdrLoaded(ratingKey, hdr);
                })
                .catch((error) => {
                    if (isAbortLikeError(error, controller.signal)) {
                        return;
                    }
                    this.reportDetailsFetchFailure('hdr', error);
                })
                .finally(() => {
                    if (fetchToken === this.hdrFetchToken) {
                        this.hdrFetchController = null;
                    }
                    this.deps.onSettled();
                });
        }, 200);
    }

    clearHdrFetch(): void {
        if (this.hdrFetchTimer !== null) {
            clearTimeout(this.hdrFetchTimer);
            this.hdrFetchTimer = null;
        }
        if (this.hdrFetchController) {
            this.hdrFetchController.abort();
            this.hdrFetchController = null;
        }
        this.hdrFetchToken += 1;
        this.deps.onSettled();
    }

    maybeFetchEpisodePoster(program: ScheduledProgram): void {
        const ratingKey = program.item.ratingKey;
        if (!ratingKey || !this.fetchItemDetails || this.episodePosterCache.has(ratingKey)) {
            return;
        }

        this.clearPosterFetch();
        const fetchToken = ++this.posterFetchToken;
        const controller = new AbortController();
        this.posterFetchController = controller;
        this.deps.onPendingWork();
        this.posterFetchTimer = setTimeout(() => {
            this.posterFetchTimer = null;
            void this.fetchItemDetailsSafely(ratingKey, controller.signal)
                .then((item) => {
                    if (fetchToken !== this.posterFetchToken) return;
                    const seriesPosterThumb = item?.grandparentThumb ?? null;
                    this.episodePosterCache.set(ratingKey, seriesPosterThumb);
                    this.deps.onEpisodePosterLoaded(ratingKey, seriesPosterThumb);
                })
                .catch((error) => {
                    if (isAbortLikeError(error, controller.signal)) {
                        return;
                    }
                    this.reportDetailsFetchFailure('poster', error);
                })
                .finally(() => {
                    if (fetchToken === this.posterFetchToken) {
                        this.posterFetchController = null;
                    }
                    this.deps.onSettled();
                });
        }, 200);
    }

    clearPosterFetch(): void {
        if (this.posterFetchTimer !== null) {
            clearTimeout(this.posterFetchTimer);
            this.posterFetchTimer = null;
        }
        if (this.posterFetchController) {
            this.posterFetchController.abort();
            this.posterFetchController = null;
        }
        this.posterFetchToken += 1;
        this.deps.onSettled();
    }

    hasPendingAsyncWork(): boolean {
        return this.hdrFetchTimer !== null
            || this.hdrFetchController !== null
            || this.posterFetchTimer !== null
            || this.posterFetchController !== null;
    }

    destroy(): void {
        this.clearHdrFetch();
        this.clearPosterFetch();
        this.hdrCache.clear();
        this.episodePosterCache.clear();
        this.fetchItemDetails = null;
    }

    private fetchItemDetailsSafely(
        ratingKey: string,
        signal: AbortSignal | null
    ): Promise<EpgItemDetails | null | undefined> {
        return Promise.resolve().then(() => this.fetchItemDetails?.(ratingKey, { signal }));
    }

    private reportDetailsFetchFailure(kind: 'hdr' | 'poster', error: unknown): void {
        console.warn('EPG info panel details fetch failed', {
            kind,
            error: summarizeErrorForLog(error),
        });
    }
}
