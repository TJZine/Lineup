import type {
    PlexAuthData,
    PlexStoredCredentialsReadResult,
} from '../../modules/plex/auth';
export interface SelectedServerCredentialsPort {
    getActiveUserId(): string | null;
    readStoredCredentialsAndClearCorruption(): PlexStoredCredentialsReadResult;
    storeCredentials(auth: PlexAuthData, options?: { emitAuthChange?: boolean }): void;
}
export interface SelectedServerPersistenceAdapterDeps {
    getCredentialsPort(): SelectedServerCredentialsPort | null;
}
const selectedServerPersistenceEvidenceBrand: unique symbol = Symbol(
    'SelectedServerPersistenceEvidence'
);
export type SelectedServerPersistenceEvidence = Readonly<{
    [selectedServerPersistenceEvidenceBrand]: true;
}>;
export type SelectedServerPersistenceProof =
    | { phase: 'candidate'; state: 'updated'; publicResult: 'updated' }
    | {
        phase: 'candidate';
        state: 'stable_missing';
        publicResult: 'skipped_missing_credentials';
    }
    | {
        phase: 'candidate';
        state: 'corruption_cleaned_to_missing';
        publicResult: 'skipped_corrupted_credentials';
    }
    | { phase: 'rollback'; state: 'restored_available_selected'; selection: { serverId: string; serverUri: string } }
    | { phase: 'rollback'; state: 'restored_available_unselected'; selection: { serverId: null; serverUri: null } }
    | { phase: 'rollback'; state: 'stable_missing' | 'corruption_cleaned_to_missing' };
type SelectedServerRecord = { serverId: string | null; serverUri: string | null };
type SelectedServerPersistenceAuthority =
    | { kind: 'missing_port'; port: null }
    | { kind: 'missing'; port: SelectedServerCredentialsPort; activeUserId: string | null }
    | { kind: 'corrupted'; port: SelectedServerCredentialsPort; activeUserId: string | null }
    | {
        kind: 'available';
        port: SelectedServerCredentialsPort;
        sessionActiveUserId: string | null;
        activeUserId: string;
        selection: SelectedServerRecord;
        candidateSelection: SelectedServerRecord | null;
        envelopeFingerprint: string;
    };
const PROOF_ERROR_MESSAGE = 'Selected-server persistence evidence is no longer current.';
export class SelectedServerPersistenceAdapter {
    private readonly _evidence = new WeakMap<
        SelectedServerPersistenceEvidence,
        SelectedServerPersistenceAuthority
    >();
    constructor(private readonly _deps: SelectedServerPersistenceAdapterDeps) {}
    capturePersistenceEvidence(): SelectedServerPersistenceEvidence {
        const evidence: SelectedServerPersistenceEvidence = Object.freeze({
            [selectedServerPersistenceEvidenceBrand]: true,
        });
        const port = this._deps.getCredentialsPort();
        if (!port) {
            this._evidence.set(evidence, { kind: 'missing_port', port: null });
            return evidence;
        }

        const activeUserId = port.getActiveUserId();
        const stored = port.readStoredCredentialsAndClearCorruption();
        if (stored.kind === 'missing') {
            this._evidence.set(evidence, { kind: 'missing', port, activeUserId });
            return evidence;
        }
        if (stored.kind === 'corrupted') {
            this._evidence.set(evidence, { kind: 'corrupted', port, activeUserId });
            return evidence;
        }

        const resolvedUserId = activeUserId ?? stored.credentials.activeUserId;
        if (
            !resolvedUserId
            || (activeUserId !== null && stored.credentials.activeUserId !== activeUserId)
        ) {
            throw new Error(PROOF_ERROR_MESSAGE);
        }
        const ownSelection = stored.credentials.selectedServerByUserId[resolvedUserId];
        if (!ownSelection || !this._isCompleteSelection(ownSelection)) {
            throw new Error(PROOF_ERROR_MESSAGE);
        }
        this._evidence.set(evidence, {
            kind: 'available',
            port,
            sessionActiveUserId: activeUserId,
            activeUserId: resolvedUserId,
            selection: { ...ownSelection },
            candidateSelection: null,
            envelopeFingerprint: this._fingerprintEnvelope(stored.credentials, resolvedUserId),
        });
        return evidence;
    }
    persistCandidateSelection(
        evidence: SelectedServerPersistenceEvidence,
        serverId: string,
        serverUri: string | null
    ): SelectedServerPersistenceProof {
        if (serverId.trim().length === 0 || serverUri === null || serverUri.trim().length === 0) {
            throw new Error(PROOF_ERROR_MESSAGE);
        }
        const authority = this._getCurrentAuthority(evidence);
        if (authority.kind === 'missing_port') {
            return {
                phase: 'candidate',
                state: 'stable_missing',
                publicResult: 'skipped_missing_credentials',
            };
        }
        if (authority.kind === 'missing' || authority.kind === 'corrupted') {
            const reread = authority.port.readStoredCredentialsAndClearCorruption();
            if (reread.kind !== 'missing') throw new Error(PROOF_ERROR_MESSAGE);
            return authority.kind === 'corrupted'
                ? {
                    phase: 'candidate',
                    state: 'corruption_cleaned_to_missing',
                    publicResult: 'skipped_corrupted_credentials',
                }
                : {
                    phase: 'candidate',
                    state: 'stable_missing',
                    publicResult: 'skipped_missing_credentials',
                };
        }

        const current = this._readExactAvailable(authority);
        this._assertSelectionEquals(
            current.selectedServerByUserId[authority.activeUserId],
            authority.selection
        );
        const nextSelection = { serverId, serverUri };
        authority.port.storeCredentials(
            {
                ...current,
                activeUserId: authority.activeUserId,
                selectedServerByUserId: {
                    ...current.selectedServerByUserId,
                    [authority.activeUserId]: nextSelection,
                },
            },
            { emitAuthChange: false }
        );
        authority.candidateSelection = nextSelection;
        this._assertStoredSelection(authority, nextSelection);
        return { phase: 'candidate', state: 'updated', publicResult: 'updated' };
    }
    restorePersistenceEvidence(
        evidence: SelectedServerPersistenceEvidence
    ): SelectedServerPersistenceProof {
        const authority = this._getCurrentAuthority(evidence);
        if (authority.kind === 'missing_port') {
            return { phase: 'rollback', state: 'stable_missing' };
        }
        if (authority.kind === 'missing' || authority.kind === 'corrupted') {
            const reread = authority.port.readStoredCredentialsAndClearCorruption();
            if (reread.kind !== 'missing') throw new Error(PROOF_ERROR_MESSAGE);
            return {
                phase: 'rollback',
                state: authority.kind === 'corrupted'
                    ? 'corruption_cleaned_to_missing'
                    : 'stable_missing',
            };
        }

        const current = this._readExactAvailable(authority);
        const currentSelection = current.selectedServerByUserId[authority.activeUserId];
        if (this._selectionEquals(currentSelection, authority.selection)) {
            authority.candidateSelection = null;
            return this._createRollbackProof(authority.selection);
        }
        this._assertSelectionEquals(currentSelection, authority.candidateSelection ?? authority.selection);
        authority.port.storeCredentials(
            {
                ...current,
                activeUserId: authority.activeUserId,
                selectedServerByUserId: {
                    ...current.selectedServerByUserId,
                    [authority.activeUserId]: authority.selection,
                },
            },
            { emitAuthChange: false }
        );
        this._assertStoredSelection(authority, authority.selection);
        authority.candidateSelection = null;
        return this._createRollbackProof(authority.selection);
    }

    assertPersistenceEvidenceCurrent(evidence: SelectedServerPersistenceEvidence): void {
        const authority = this._getCurrentAuthority(evidence);
        if (authority.kind === 'missing_port') return;
        if (authority.kind === 'missing' || authority.kind === 'corrupted') {
            if (authority.port.readStoredCredentialsAndClearCorruption().kind !== 'missing') {
                throw new Error(PROOF_ERROR_MESSAGE);
            }
            return;
        }
        const current = this._readExactAvailable(authority);
        this._assertSelectionEquals(
            current.selectedServerByUserId[authority.activeUserId],
            authority.candidateSelection ?? authority.selection
        );
    }

    private _getCurrentAuthority(
        evidence: SelectedServerPersistenceEvidence
    ): SelectedServerPersistenceAuthority {
        const authority = this._evidence.get(evidence);
        if (!authority || this._deps.getCredentialsPort() !== authority.port) {
            throw new Error(PROOF_ERROR_MESSAGE);
        }
        if (authority.kind === 'missing_port') return authority;
        const expectedActiveUserId = authority.kind === 'available'
            ? authority.sessionActiveUserId
            : authority.activeUserId;
        if (
            authority.port.getActiveUserId() !== expectedActiveUserId
        ) {
            throw new Error(PROOF_ERROR_MESSAGE);
        }
        return authority;
    }

    private _createRollbackProof(selection: SelectedServerRecord): SelectedServerPersistenceProof {
        return selection.serverId === null || selection.serverUri === null
            ? { phase: 'rollback', state: 'restored_available_unselected', selection: { serverId: null, serverUri: null } }
            : {
                phase: 'rollback',
                state: 'restored_available_selected',
                selection: { serverId: selection.serverId, serverUri: selection.serverUri },
            };
    }

    private _readExactAvailable(
        authority: Extract<SelectedServerPersistenceAuthority, { kind: 'available' }>
    ): PlexAuthData {
        const stored = authority.port.readStoredCredentialsAndClearCorruption();
        if (
            stored.kind !== 'available'
            || this._fingerprintEnvelope(stored.credentials, authority.activeUserId)
                !== authority.envelopeFingerprint
        ) {
            throw new Error(PROOF_ERROR_MESSAGE);
        }
        return stored.credentials;
    }

    private _assertStoredSelection(
        authority: Extract<SelectedServerPersistenceAuthority, { kind: 'available' }>,
        expected: SelectedServerRecord
    ): void {
        const stored = this._readExactAvailable(authority);
        this._assertSelectionEquals(
            stored.selectedServerByUserId[authority.activeUserId],
            expected
        );
    }

    private _assertSelectionEquals(
        actual: SelectedServerRecord | undefined,
        expected: SelectedServerRecord
    ): void {
        if (!this._selectionEquals(actual, expected)) {
            throw new Error(PROOF_ERROR_MESSAGE);
        }
    }

    private _selectionEquals(
        actual: SelectedServerRecord | undefined,
        expected: SelectedServerRecord
    ): boolean {
        return Boolean(
            actual
            && actual.serverId === expected.serverId
            && actual.serverUri === expected.serverUri
        );
    }

    private _fingerprintEnvelope(credentials: PlexAuthData, activeUserId: string): string {
        const otherSelections = Object.fromEntries(
            Object.entries(credentials.selectedServerByUserId)
                .filter(([userId]) => userId !== activeUserId)
        );
        return JSON.stringify({
            accountToken: credentials.accountToken,
            activeToken: credentials.activeToken,
            activeUserId: credentials.activeUserId,
            deviceKey: credentials.deviceKey ?? null,
            otherSelections,
        });
    }

    private _isCompleteSelection(selection: SelectedServerRecord): boolean {
        return (selection.serverId === null) === (selection.serverUri === null);
    }
}
