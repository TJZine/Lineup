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

const selectionReceiptBrand: unique symbol = Symbol('PlexDiscoverySelectionReceipt');

export type PlexDiscoverySelectionReceipt = Readonly<{
    [selectionReceiptBrand]: true;
}>;

export type PlexDiscoverySelectionScope = 'selected' | 'unselected';

interface PlexDiscoverySelectionAuthority {
    contextGeneration: number;
    selectionGeneration: number | null;
}

interface PlexDiscoverySelectionReceiptAuthority {
    contextGeneration: number;
    controller: AbortController;
    scope: PlexDiscoverySelectionScope;
}

export class PlexDiscoverySelectionContext {
    private _generation = 0;
    private _storageNamespaceGeneration = 0;
    private _selectionGeneration = 0;
    private _receiptController = new AbortController();
    private readonly _captures = new WeakMap<
        PlexDiscoverySelectionCapture,
        PlexDiscoverySelectionAuthority
    >();
    private readonly _snapshotNamespaces = new WeakMap<object, number>();
    private readonly _receipts = new WeakMap<
        PlexDiscoverySelectionReceipt,
        PlexDiscoverySelectionReceiptAuthority
    >();

    capture(): PlexDiscoverySelectionCapture {
        const capture = Object.freeze({});
        this._captures.set(capture, {
            contextGeneration: this._generation,
            selectionGeneration: null,
        });
        return capture;
    }

    advance(): PlexDiscoverySelectionCapture {
        this._receiptController.abort();
        this._generation += 1;
        this._selectionGeneration += 1;
        this._receiptController = new AbortController();
        return this.capture();
    }

    advanceStorageNamespace(): PlexDiscoverySelectionCapture {
        this._storageNamespaceGeneration += 1;
        return this.advance();
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

    transitionForSelectionCommit(
        capture: PlexDiscoverySelectionCapture
    ): PlexDiscoverySelectionCapture {
        this.assertCurrent(capture);
        this._receiptController.abort();
        this._receiptController = new AbortController();
        const commitCapture = Object.freeze({});
        this._captures.set(commitCapture, {
            contextGeneration: this._generation,
            selectionGeneration: this._selectionGeneration,
        });
        return commitCapture;
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

    issueReceipt(
        capture: PlexDiscoverySelectionCapture,
        scope: PlexDiscoverySelectionScope
    ): PlexDiscoverySelectionReceipt {
        this.assertCurrent(capture);
        const receipt = Object.freeze({
            [selectionReceiptBrand]: true as const,
        });
        this._receipts.set(receipt, {
            contextGeneration: this._generation,
            controller: this._receiptController,
            scope,
        });
        return receipt;
    }

    getReceiptSignal(receipt: PlexDiscoverySelectionReceipt): AbortSignal {
        return this._getReceiptAuthority(receipt).controller.signal;
    }

    assertReceiptCurrent(receipt: PlexDiscoverySelectionReceipt): void {
        const authority = this._getReceiptAuthority(receipt);
        if (
            authority.contextGeneration !== this._generation
            || authority.controller.signal.aborted
        ) {
            throw new PlexDiscoverySelectionSupersededError();
        }
    }

    getReceiptScope(receipt: PlexDiscoverySelectionReceipt): PlexDiscoverySelectionScope {
        const authority = this._getReceiptAuthority(receipt);
        this.assertReceiptCurrent(receipt);
        return authority.scope;
    }

    private _getReceiptAuthority(
        receipt: PlexDiscoverySelectionReceipt
    ): PlexDiscoverySelectionReceiptAuthority {
        const authority = this._receipts.get(receipt);
        if (!authority) throw new PlexDiscoverySelectionSupersededError();
        return authority;
    }

    retainSnapshot<T extends object>(snapshot: T): T {
        this._snapshotNamespaces.set(snapshot, this._storageNamespaceGeneration);
        return snapshot;
    }

    assertSnapshotCurrent(snapshot: object): void {
        if (this._snapshotNamespaces.get(snapshot) !== this._storageNamespaceGeneration) {
            throw new PlexDiscoverySelectionSupersededError();
        }
    }
}
