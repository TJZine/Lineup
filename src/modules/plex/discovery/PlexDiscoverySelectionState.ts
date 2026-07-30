import { EventEmitter } from '../../../utils/EventEmitter';
import { throwIfAborted } from './PlexDiscoveryAbort';
import {
    PlexDiscoverySelectionCapture,
    PlexDiscoverySelectionContext,
    PlexDiscoverySelectionReceipt,
} from './PlexDiscoverySelectionContext';
import {
    clonePlexConnection,
    clonePlexServerView,
    cloneSelectedPlexServer,
} from './PlexDiscoverySnapshots';
import { ServerSelectionStore } from './ServerSelectionStore';
import { classifyPlexDiscoverySelectionSnapshot } from './PlexDiscoverySelectionSnapshot';
import {
    PlexConnection,
    PlexDiscoverySelectedServerSnapshot,
    PlexServerResource,
    PlexServerDiscoveryEvents,
    PlexServerDiscoveryState,
} from './types';

/**
 * Owns receipt-aware selected-server state transitions inside Plex discovery.
 * Mutation ordering and synchronous listener gates intentionally live together.
 */
export class PlexDiscoverySelectionState {
    constructor(
        private readonly _state: PlexServerDiscoveryState,
        private readonly _store: ServerSelectionStore,
        private readonly _emitter: EventEmitter<PlexServerDiscoveryEvents>,
        private readonly _context: PlexDiscoverySelectionContext
    ) {}

    commitSelection(
        serverId: string,
        server: PlexServerResource,
        connection: PlexConnection,
        capture: PlexDiscoverySelectionCapture,
        signal: AbortSignal | null
    ): PlexDiscoverySelectionReceipt {
        this._assertCurrent(signal, capture);
        const context = this._context.transitionForSelectionCommit(capture);
        const assertCurrent = (): void => this._assertCurrent(signal, context);
        assertCurrent();
        this._state.selectedServer = server;
        assertCurrent();
        this._state.selectedConnection = connection;
        assertCurrent();
        this._store.writeSelectedServerId(serverId);
        assertCurrent();
        this._emitter.emit('serverChange', clonePlexServerView(server));
        assertCurrent();
        this._emitter.emit('connectionChange', connection.uri);
        assertCurrent();
        this._store.writeServerHealthRecord({
            serverId,
            status: 'ok',
            testedAt: Date.now(),
            details: {
                connection,
                latency: connection.latencyMs ?? 0,
            },
        });
        assertCurrent();
        const receipt = this._context.issueReceipt(context, 'selected');
        this._assertReceiptCurrent(signal, receipt);
        return receipt;
    }

    captureSnapshot(): PlexDiscoverySelectedServerSnapshot {
        return this._context.retainSnapshot({
            server: clonePlexServerView(this._state.selectedServer),
            connection: clonePlexConnection(this._state.selectedConnection),
            storedServerId: this._store.readSelectedServerId(),
        });
    }

    restoreSnapshot(
        snapshot: PlexDiscoverySelectedServerSnapshot,
        accessToken: string | null
    ): PlexDiscoverySelectionReceipt {
        this._context.assertSnapshotCurrent(snapshot);
        classifyPlexDiscoverySelectionSnapshot(snapshot);
        const context = this._context.advance();
        const assertCurrent = (): void => this._context.assertCurrent(context);
        const previousServerId = this._state.selectedServer?.id ?? null;
        const previousConnectionUri = this._state.selectedConnection?.uri ?? null;
        const nextConnection = clonePlexConnection(snapshot.connection);
        const nextServer = snapshot.server
            ? cloneSelectedPlexServer({ ...snapshot.server, accessToken: accessToken ?? '' }, nextConnection)
            : null;
        assertCurrent();
        this._state.selectedServer = nextServer;
        assertCurrent();
        this._state.selectedConnection = nextConnection;
        assertCurrent();
        if (snapshot.storedServerId) {
            this._store.writeSelectedServerId(snapshot.storedServerId);
        } else {
            this._store.clearSelectedServerId();
        }
        const nextServerId = nextServer?.id ?? null;
        const nextConnectionUri = nextConnection?.uri ?? null;
        if (previousServerId !== nextServerId) {
            assertCurrent();
            this._emitter.emit('serverChange', clonePlexServerView(nextServer));
        }
        if (previousConnectionUri !== nextConnectionUri) {
            assertCurrent();
            this._emitter.emit('connectionChange', nextConnectionUri);
        }
        assertCurrent();
        return this._context.issueReceipt(
            context,
            nextServer && nextConnection ? 'selected' : 'unselected'
        );
    }

    captureCurrentReceipt(): PlexDiscoverySelectionReceipt | null {
        const server = this._state.selectedServer;
        const connection = this._state.selectedConnection;
        if (
            !server
            || !connection
            || server.preferredConnection?.uri !== connection.uri
            || !this._state.servers.some((candidate) => candidate.id === server.id)
        ) {
            return null;
        }
        return this._context.issueReceipt(this._context.capture(), 'selected');
    }

    clear(): void {
        const context = this._context.advance();
        const assertCurrent = (): void => this._context.assertCurrent(context);
        assertCurrent();
        this._state.selectedServer = null;
        assertCurrent();
        this._state.selectedConnection = null;
        assertCurrent();
        this._store.clearSelectedServerId();
        assertCurrent();
        this._emitter.emit('serverChange', null);
        assertCurrent();
        this._emitter.emit('connectionChange', null);
        assertCurrent();
    }

    getReceiptSignal(receipt: PlexDiscoverySelectionReceipt): AbortSignal {
        return this._context.getReceiptSignal(receipt);
    }

    assertReceiptCurrent(receipt: PlexDiscoverySelectionReceipt): void {
        this._context.assertReceiptCurrent(receipt);
    }

    private _assertCurrent(
        signal: AbortSignal | null,
        capture: PlexDiscoverySelectionCapture
    ): void {
        throwIfAborted(signal);
        this._context.assertCurrent(capture);
    }

    private _assertReceiptCurrent(
        signal: AbortSignal | null,
        receipt: PlexDiscoverySelectionReceipt
    ): void {
        throwIfAborted(signal);
        this._context.assertReceiptCurrent(receipt);
    }
}
