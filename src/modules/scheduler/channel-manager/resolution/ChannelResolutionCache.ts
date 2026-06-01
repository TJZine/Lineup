import { CACHE_TTL_MS } from '../constants';
import type { ResolvedChannelContent, ResolvedContentItem } from '../contracts/types';

export class ChannelResolutionCache {
    private readonly _resolvedContent = new Map<string, ResolvedChannelContent>();

    get(channelId: string): ResolvedChannelContent | null {
        const content = this._resolvedContent.get(channelId);
        return content ? this.cloneContent(content) : null;
    }

    set(content: ResolvedChannelContent): void {
        this._resolvedContent.set(content.channelId, this.cloneContent(content));
    }

    delete(channelId: string): void {
        this._resolvedContent.delete(channelId);
    }

    clear(): void {
        this._resolvedContent.clear();
    }

    isFresh(channelId: string): boolean {
        const cached = this.get(channelId);
        return cached !== null && !this.isStale(cached);
    }

    isStale(content: ResolvedChannelContent): boolean {
        return content.isStale === true || Date.now() - content.resolvedAt > CACHE_TTL_MS;
    }

    cloneItems(items: ReadonlyArray<ResolvedContentItem>): ResolvedContentItem[] {
        return items.map((item) => this.cloneItem(item));
    }

    cloneContent(
        content: ResolvedChannelContent,
        overrides?: Partial<Pick<ResolvedChannelContent, 'fromCache' | 'isStale' | 'cacheReason'>>
    ): ResolvedChannelContent {
        const cloned: ResolvedChannelContent = {
            ...content,
            items: this.cloneItems(content.items),
            orderedItems: this.cloneItems(content.orderedItems),
        };
        const fromCache = overrides?.fromCache ?? content.fromCache;
        const isStale = overrides?.isStale ?? content.isStale;
        const cacheReason = overrides?.cacheReason ?? content.cacheReason;
        if (fromCache !== undefined) {
            cloned.fromCache = fromCache;
        }
        if (isStale !== undefined) {
            cloned.isStale = isStale;
        }
        if (cacheReason !== undefined) {
            cloned.cacheReason = cacheReason;
        }
        return cloned;
    }

    private cloneItem(item: ResolvedContentItem): ResolvedContentItem {
        const cloned: ResolvedContentItem = { ...item };
        if (item.genres) {
            cloned.genres = [...item.genres];
        }
        if (item.directors) {
            cloned.directors = [...item.directors];
        }
        if (item.mediaInfo) {
            cloned.mediaInfo = { ...item.mediaInfo };
        }
        return cloned;
    }
}
