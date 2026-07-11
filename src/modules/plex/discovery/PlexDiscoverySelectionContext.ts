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

export class PlexDiscoverySelectionContext {
    private _generation = 0;
    private readonly _captures = new WeakMap<PlexDiscoverySelectionCapture, number>();
    private readonly _snapshotCaptures = new WeakMap<object, PlexDiscoverySelectionCapture>();

    capture(): PlexDiscoverySelectionCapture {
        const capture = Object.freeze({});
        this._captures.set(capture, this._generation);
        return capture;
    }

    advance(): PlexDiscoverySelectionCapture {
        this._generation += 1;
        return this.capture();
    }

    assertCurrent(capture: PlexDiscoverySelectionCapture): void {
        if (this._captures.get(capture) !== this._generation) {
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
