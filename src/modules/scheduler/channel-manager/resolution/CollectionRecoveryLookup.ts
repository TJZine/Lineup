import type { PlexCollection } from '../../../plex/library';
import { RetainedOperationContext } from '../../../../utils/RetainedOperationContext';
import type { IPlexLibraryMinimal } from '../contracts/interfaces';
import {
    SourceResolutionEntryAuthority,
    type SourceResolutionOperationContext,
} from './SourceResolutionEntryAuthority';

type CollectionLookupEntry = {
    libraryId: string;
    authority: SourceResolutionEntryAuthority;
    promise: Promise<PlexCollection[]>;
    waiters: number;
    completed: boolean;
    released: boolean;
};

/**
 * Coalesces only active collection-list requests. Results are not retained after
 * settlement; source and channel caches remain owned by ContentResolver and
 * ChannelManager respectively.
 */
export class CollectionRecoveryLookup {
    private readonly _inFlightByLibraryId = new Map<string, CollectionLookupEntry>();
    private readonly _activePromises = new Set<Promise<PlexCollection[]>>();

    constructor(private readonly _library: IPlexLibraryMinimal) {}

    lookup(
        libraryId: string,
        operation: SourceResolutionOperationContext,
        callerSignal?: AbortSignal | null
    ): Promise<PlexCollection[]> {
        operation.assertCurrent();
        throwIfAborted(callerSignal);

        const existing = this._inFlightByLibraryId.get(libraryId);
        if (
            existing
            && existing.authority.scope.authority === operation.authority
            && this._isEntryCurrent(existing)
        ) {
            return this._awaitEntry(existing, operation, callerSignal ?? null);
        }

        if (existing) {
            this._inFlightByLibraryId.delete(libraryId);
            this._closeEntry(existing);
        }

        const entryScope = operation.commonScope.retain(`collection-recovery:${libraryId}`);
        const authority = new SourceResolutionEntryAuthority(entryScope);
        const entry: CollectionLookupEntry = {
            libraryId,
            authority,
            promise: Promise.resolve([]),
            waiters: 0,
            completed: false,
            released: false,
        };

        const lookupPromise = Promise.resolve()
            .then(() => this._library.getCollections(libraryId, { signal: authority.signal }))
            .then((collections) => {
                authority.assertCurrent();
                if (this._inFlightByLibraryId.get(libraryId) !== entry) {
                    throw createAbortError();
                }
                return collections.map((collection) => ({ ...collection }));
            })
            .finally(() => {
                entry.completed = true;
                if (this._inFlightByLibraryId.get(libraryId) === entry) {
                    this._inFlightByLibraryId.delete(libraryId);
                }
                if (entry.waiters === 0) {
                    this._releaseEntry(entry);
                }
            });

        entry.promise = lookupPromise;
        this._activePromises.add(lookupPromise);
        void lookupPromise.then(
            () => this._activePromises.delete(lookupPromise),
            () => this._activePromises.delete(lookupPromise)
        );
        this._inFlightByLibraryId.set(libraryId, entry);

        try {
            return this._awaitEntry(entry, operation, callerSignal ?? null);
        } catch (error) {
            if (entry.waiters === 0 && this._inFlightByLibraryId.get(libraryId) === entry) {
                this._inFlightByLibraryId.delete(libraryId);
                this._closeEntry(entry);
            }
            throw error;
        }
    }

    async whenIdle(): Promise<void> {
        while (this._activePromises.size > 0) {
            await Promise.allSettled([...this._activePromises]);
        }
    }

    clear(): void {
        const entries = [...this._inFlightByLibraryId.values()];
        this._inFlightByLibraryId.clear();
        for (const entry of entries) {
            this._closeEntry(entry);
            if (entry.waiters === 0) {
                this._releaseEntry(entry);
            }
        }
    }

    private _awaitEntry(
        entry: CollectionLookupEntry,
        operation: SourceResolutionOperationContext,
        callerSignal: AbortSignal | null
    ): Promise<PlexCollection[]> {
        const waiter = new RetainedOperationContext([
            operation,
            {
                signal: callerSignal,
                assertCurrent: (): void => throwIfAborted(callerSignal),
            },
            entry.authority,
        ]);

        entry.waiters += 1;
        let onAbort = (): void => undefined;
        const aborted = new Promise<PlexCollection[]>((_, reject) => {
            onAbort = (): void => reject(waiter.signal.reason ?? createAbortError());
            waiter.signal.addEventListener('abort', onAbort, { once: true });
        });

        return Promise.race([entry.promise, aborted])
            .then((collections) => {
                waiter.assertCurrent();
                return collections.map((collection) => ({ ...collection }));
            })
            .finally(() => {
                waiter.signal.removeEventListener('abort', onAbort);
                waiter.release();
                entry.waiters -= 1;
                if (entry.waiters === 0 && !entry.completed) {
                    if (this._inFlightByLibraryId.get(entry.libraryId) === entry) {
                        this._inFlightByLibraryId.delete(entry.libraryId);
                        this._closeEntry(entry);
                    }
                }
                if (entry.waiters === 0 && entry.completed) {
                    this._releaseEntry(entry);
                }
            });
    }

    private _closeEntry(entry: CollectionLookupEntry): void {
        entry.authority.close();
    }

    private _releaseEntry(entry: CollectionLookupEntry): void {
        if (entry.released) return;
        entry.released = true;
        entry.authority.release();
    }

    private _isEntryCurrent(entry: CollectionLookupEntry): boolean {
        try {
            entry.authority.assertCurrent();
            return true;
        } catch {
            return false;
        }
    }
}

function throwIfAborted(signal: AbortSignal | null | undefined): void {
    if (signal?.aborted) throw signal.reason ?? createAbortError();
}

function createAbortError(): Error {
    if (typeof DOMException !== 'undefined') {
        return new DOMException('Aborted', 'AbortError');
    }
    const error = new Error('Aborted');
    error.name = 'AbortError';
    return error;
}
