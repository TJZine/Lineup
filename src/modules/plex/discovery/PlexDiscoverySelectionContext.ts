const SUPERSEDED_MESSAGE = 'Plex discovery selection was superseded.';

export class PlexDiscoverySelectionSupersededError extends Error {
    constructor() {
        super(SUPERSEDED_MESSAGE);
        this.name = 'PlexDiscoverySelectionSupersededError';
    }
}

export function isPlexDiscoverySelectionSupersededError(
    error: unknown
): error is PlexDiscoverySelectionSupersededError {
    return error instanceof PlexDiscoverySelectionSupersededError;
}

export type PlexDiscoverySelectionCapture = object;

interface PlexDiscoverySelectionAuthority {
    contextGeneration: number;
    selectionGeneration: number | null;
}

export class PlexDiscoverySelectionContext {
    private _generation = 0;
    private _selectionGeneration = 0;
    private readonly _captures = new WeakMap<
        PlexDiscoverySelectionCapture,
        PlexDiscoverySelectionAuthority
    >();
    private readonly _snapshotCaptures = new WeakMap<object, PlexDiscoverySelectionCapture>();

    capture(): PlexDiscoverySelectionCapture {
        const capture = Object.freeze({});
        this._captures.set(capture, {
            contextGeneration: this._generation,
            selectionGeneration: null,
        });
        return capture;
    }

    advance(): PlexDiscoverySelectionCapture {
        this._generation += 1;
        this._selectionGeneration += 1;
        return this.capture();
    }

    advanceSelection(): PlexDiscoverySelectionCapture {
        this._selectionGeneration += 1;
        const capture = Object.freeze({});
        this._captures.set(capture, {
            contextGeneration: this._generation,
            selectionGeneration: this._selectionGeneration,
        });
        return capture;
    }

    assertCurrent(capture: PlexDiscoverySelectionCapture): void {
        const authority = this._captures.get(capture);
        if (
            authority?.contextGeneration !== this._generation
            || (
                authority.selectionGeneration !== null
                && authority.selectionGeneration !== this._selectionGeneration
            )
        ) {
            throw new PlexDiscoverySelectionSupersededError();
        }
    }

    retainSnapshot<T extends object>(snapshot: T): T {
        this._snapshotCaptures.set(snapshot, this.capture());
        return snapshot;
    }

    assertSnapshotCurrent(snapshot: object): void {
        const capture = this._snapshotCaptures.get(snapshot);
        if (!capture) {
            throw new PlexDiscoverySelectionSupersededError();
        }
        this.assertCurrent(capture);
    }
}
