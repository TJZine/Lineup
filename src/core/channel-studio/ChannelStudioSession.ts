import { cloneChannelForOwnership, cloneContentSource } from '../../modules/scheduler/channel-manager/authoring/ChannelDomainClone';
import type { ChannelConfig } from '../../modules/scheduler/channel-manager/contracts/types';
import type { ChannelStudioRequest, ChannelStudioPorts, StudioAirCheckRequest, StudioVerificationStatus } from './ChannelStudioContracts';
import { ChannelStudioDraft, type DraftIssue } from './ChannelStudioDraft';

export type StudioNotice = { kind: 'saved' | 'saved-warning' | 'error' | 'info'; text: string } | null;
export type StudioSaveResult = { kind: 'saved'; channel: ChannelConfig } | { kind: 'invalid' | 'conflict' | 'storage-failure' | 'unverified' | 'busy'; reason: string };

function sameBase(a: { generation: number; revision: number }, b: { generation: number; revision: number }): boolean {
    return a.generation === b.generation && a.revision === b.revision;
}

/** Owns local draft, preview currentness and the only durable Save action. */
export class ChannelStudioSession {
    draft: ChannelStudioDraft | null = null;
    verification: StudioVerificationStatus = { kind: 'idle' };
    notice: StudioNotice = null;
    saving = false;
    tuning = false;
    conflict = false;
    extensionStatus: StudioVerificationStatus | null = null;
    private readonly ports: ChannelStudioPorts;
    private previewController: AbortController | null = null;
    private extensionController: AbortController | null = null;
    private saveController: AbortController | null = null;
    private generation = 0;
    private verifiedRequest: StudioAirCheckRequest | null = null;
    private savedChannelId: string | null = null;
    private saveToken = 0;
    private commitStarted = false;

    constructor(ports: ChannelStudioPorts) { this.ports = ports; }

    open(request: ChannelStudioRequest): void {
        this.close();
        const load = this.ports.manager.getLastLoadOutcome();
        if (load.kind !== 'readable' && load.kind !== 'readable-degraded' && load.kind !== 'valid-empty') {
            throw new Error(`Saved channels are ${load.kind}. Retry loading before editing.`);
        }
        const base = this.ports.manager.getStructuralBase();
        const now = this.ports.now();
        const id = `studio-draft-${now}-${Math.random().toString(36).slice(2)}`;
        this.draft = ChannelStudioDraft.open(request, this.ports.manager.getAllChannels(), base, now, id);
        this.savedChannelId = null;
        this.verification = { kind: 'idle' }; this.notice = null; this.conflict = false;
    }

    close(): void {
        this.generation++; this.saveToken++; this.saving = false; this.savedChannelId = null;
        this.commitStarted = false;
        this.previewController?.abort(); this.previewController = null;
        this.extensionController?.abort(); this.extensionController = null; this.extensionStatus = null;
        this.saveController?.abort(); this.saveController = null;
        this.draft = null; this.verifiedRequest = null;
        this.verification = { kind: 'idle' }; this.notice = null; this.conflict = false;
    }

    invalidateVerification(): void {
        this.generation++;
        this.previewController?.abort(); this.previewController = null;
        this.extensionController?.abort(); this.extensionController = null; this.extensionStatus = null;
        this.verifiedRequest = null;
        this.verification = { kind: 'idle' };
        this.notice = null;
    }

    get issues(): DraftIssue[] {
        return this.draft?.validate(this.ports.manager.getAllChannels()) ?? [];
    }

    markDraftChanged(): void { this.savedChannelId = null; this.conflict = false; this.invalidateVerification(); }

    useSaved(): void {
        const id = this.draft?.originalId;
        if (!id) return;
        const base = this.ports.manager.getStructuralBase();
        this.open({ kind: 'inspect', channelId: id, expectedBase: base });
    }

    replaceSaved(): void {
        const previous = this.draft, id = previous?.originalId;
        if (!previous || !id) return;
        const saved = this.ports.manager.getChannel(id);
        if (!saved) { this.notice = { kind: 'error', text: 'The saved channel was removed. Save as new or keep editing.' }; return; }
        this.draft = ChannelStudioDraft.replaceSaved(previous, saved, this.ports.manager.getStructuralBase());
        this.invalidateVerification();
        this.conflict = false;
        this.notice = { kind: 'info', text: 'Your draft is ready to replace the latest saved version. Run Air Check, then Save.' };
    }

    saveAsNew(): void {
        const previous = this.draft; if (!previous) return;
        const now = this.ports.now();
        const id = `studio-draft-${now}-${Math.random().toString(36).slice(2)}`;
        try { this.draft = ChannelStudioDraft.saveAsNew(previous, this.ports.manager.getAllChannels(), this.ports.manager.getStructuralBase(), now, id); }
        catch (error) { this.notice = { kind: 'error', text: error instanceof Error ? error.message : 'No free channel number.' }; return; }
        this.invalidateVerification();
        this.conflict = false;
        this.notice = { kind: 'info', text: `New custom draft uses channel ${this.draft.channel.number}. Run Air Check, then Save.` };
    }

    get isBaseStale(): boolean {
        return !!this.draft && !sameBase(this.draft.originalExpectedBase, this.ports.manager.getStructuralBase());
    }

    refreshBase(): void {
        const draft = this.draft; if (!draft) return;
        if (draft.kind === 'edit') { this.replaceSaved(); return; }
        this.draft = ChannelStudioDraft.refreshNewBase(draft, this.ports.manager.getStructuralBase());
        this.invalidateVerification();
        this.notice = { kind: 'info', text: 'Lineup refreshed. Your draft and chosen number are kept. Run Air Check again.' };
    }

    get canSave(): boolean {
        const draft = this.draft;
        const verified = this.verification;
        return !!draft && draft.editable && !this.saving && !this.savedChannelId && draft.pending.length === 0
            && this.issues.length === 0 && verified.kind === 'verified'
            && verified.request === this.verifiedRequest
            && verified.request.draftRevision === draft.revision
            && verified.request.sourceIdentity === draft.sourceIdentity
            && sameBase(verified.request.expectedBase, this.ports.manager.getStructuralBase());
    }

    get lastRequest(): StudioAirCheckRequest | null { return this.verifiedRequest; }
    get focusChannelId(): string | null { return this.savedChannelId ?? this.draft?.originalId ?? null; }

    makeRequest(asOf = this.ports.now(), horizonMs = 6 * 60 * 60 * 1000): StudioAirCheckRequest | null {
        const draft = this.draft;
        if (!draft || draft.pending.length || this.issues.length) return null;
        return {
            draftRevision: draft.revision,
            expectedBase: { ...draft.originalExpectedBase },
            candidate: cloneChannelForOwnership(draft.channel),
            source: cloneContentSource(draft.channel.contentSource),
            asOf, horizonMs,
            sourceIdentity: draft.sourceIdentity,
        };
    }

    async verify(asOf = this.ports.now(), horizonMs = 6 * 60 * 60 * 1000): Promise<StudioVerificationStatus> {
        const request = this.makeRequest(asOf, horizonMs);
        if (!request) {
            this.verification = { kind: 'error', reason: this.issues[0]?.message ?? 'Apply the pending source first.', checkedAt: this.ports.now() };
            return this.verification;
        }
        this.previewController?.abort();
        const controller = new AbortController(); this.previewController = controller;
        const generation = ++this.generation;
        this.verification = { kind: 'loading' };
        let result: StudioVerificationStatus;
        try { result = await this.ports.airCheck.verify(request, controller.signal); }
        catch {
            result = controller.signal.aborted
                ? { kind: 'canceled' }
                : { kind: 'error', reason: 'Air Check failed. Retry.', checkedAt: this.ports.now() };
        }
        if (generation !== this.generation || this.previewController !== controller) {
            return { kind: 'stale', reason: 'The draft or lineup changed. Run Air Check again.', checkedAt: this.ports.now() };
        }
        this.previewController = null;
        if (!this.draft || this.draft.revision !== request.draftRevision
            || this.draft.sourceIdentity !== request.sourceIdentity
            || !sameBase(request.expectedBase, this.ports.manager.getStructuralBase())) {
            result = { kind: 'stale', reason: 'The draft or lineup changed. Run Air Check again.', checkedAt: this.ports.now() };
        }
        this.verification = result;
        this.verifiedRequest = result.kind === 'verified' && result.request === request ? request : null;
        return this.verification;
    }

    async extendHorizon(nextHorizonMs: number): Promise<StudioVerificationStatus> {
        const current = this.verification, draft = this.draft;
        if (current.kind !== 'verified' || !draft || current.request !== this.verifiedRequest) {
            return { kind: 'stale', reason: 'Run Air Check again.', checkedAt: this.ports.now() };
        }
        this.extensionController?.abort();
        const controller = new AbortController(); this.extensionController = controller;
        const request: StudioAirCheckRequest = { ...current.request, horizonMs: nextHorizonMs };
        const generation = this.generation;
        this.extensionStatus = { kind: 'loading' };
        let result: StudioVerificationStatus;
        try { result = await this.ports.airCheck.verify(request, controller.signal); }
        catch { result = controller.signal.aborted ? { kind: 'canceled' }
            : { kind: 'error', reason: 'Could not extend Air Check.', checkedAt: this.ports.now() }; }
        if (controller.signal.aborted || this.extensionController !== controller
            || generation !== this.generation || this.draft !== draft) {
            return { kind: 'stale', reason: 'The draft changed.', checkedAt: this.ports.now() };
        }
        if (draft.revision !== request.draftRevision || draft.sourceIdentity !== request.sourceIdentity
            || !sameBase(request.expectedBase, this.ports.manager.getStructuralBase())) {
            result = { kind: 'stale', reason: 'The draft or lineup changed. Run Air Check again.', checkedAt: this.ports.now() };
        }
        this.extensionController = null; this.extensionStatus = result;
        if (result.kind === 'verified' && result.request === request) {
            this.verification = result; this.verifiedRequest = request; this.extensionStatus = null;
        }
        return result;
    }

    cancelVerification(): void {
        if (!this.previewController) return;
        this.generation++; this.previewController.abort(); this.previewController = null;
        this.verifiedRequest = null; this.verification = { kind: 'canceled' };
    }

    /** A lost protected Save dialog can still stop work before the manager mutation begins. */
    cancelPendingSave(): boolean {
        if (!this.saving || this.commitStarted) return false;
        this.saveToken++; this.saveController?.abort(); this.saveController = null;
        this.saving = false; this.verifiedRequest = null;
        this.generation++; this.extensionController?.abort(); this.extensionController = null; this.extensionStatus = null;
        this.verification = { kind: 'error', reason: 'Save was interrupted. Run Air Check again.', checkedAt: this.ports.now() };
        this.notice = { kind: 'error', text: 'Save was interrupted before storage changed. Run Air Check again.' };
        return true;
    }

    async save(): Promise<StudioSaveResult> {
        const draft = this.draft;
        if (!draft || !draft.editable) return { kind: 'invalid', reason: 'This channel is read only. Duplicate it as custom to edit.' };
        if (this.saving) return { kind: 'busy', reason: 'Save is already in progress.' };
        if (!this.canSave) return { kind: 'unverified', reason: this.isBaseStale
            ? 'The lineup changed. Refresh it and run Air Check again.'
            : this.issues[0]?.message ?? 'Run a current Air Check before saving.' };
        const request = this.verifiedRequest;
        if (!request) return { kind: 'unverified', reason: 'Run Air Check before saving.' };
        this.saving = true; const saveToken = ++this.saveToken;
        const controller = new AbortController(); this.saveController = controller;
        this.notice = { kind: 'info', text: 'Saving channel…' };
        try {
            // Final source/scope verification is required even if an earlier preview was valid.
            let rechecked: StudioVerificationStatus;
            try { rechecked = await this.ports.airCheck.verify(request, controller.signal); }
            catch {
                if (saveToken !== this.saveToken) return { kind: 'unverified', reason: 'Studio closed before Save.' };
                this.generation++; this.extensionController?.abort(); this.extensionController = null; this.extensionStatus = null;
                const reason = 'Air Check failed during Save. Retry.';
                this.verification = { kind: 'error', reason, checkedAt: this.ports.now() };
                this.verifiedRequest = null; this.notice = { kind: 'error', text: reason };
                return { kind: 'unverified', reason };
            }
            if (saveToken !== this.saveToken) return { kind: 'unverified', reason: 'Studio closed before Save.' };
            if (rechecked.kind !== 'verified' || rechecked.request !== request || !this.draft || this.draft !== draft
                || this.draft.revision !== request.draftRevision || this.draft.sourceIdentity !== request.sourceIdentity
                || this.draft.pending.length > 0 || this.issues.length > 0
                || !sameBase(request.expectedBase, this.ports.manager.getStructuralBase())) {
                this.generation++; this.extensionController?.abort(); this.extensionController = null; this.extensionStatus = null;
                this.verification = rechecked.kind === 'verified'
                    ? { kind: 'stale', reason: 'The channel changed during Save. Run Air Check again.', checkedAt: this.ports.now() }
                    : rechecked;
                this.verifiedRequest = null;
                const reason = this.verification.kind === 'partial' || this.verification.kind === 'stale'
                    || this.verification.kind === 'offair' || this.verification.kind === 'error'
                    ? this.verification.reason : 'Air Check is no longer current.';
                this.notice = { kind: 'error', text: reason };
                return { kind: 'unverified', reason };
            }
            const current = draft.originalId ? this.ports.manager.getChannel(draft.originalId) : null;
            if (draft.kind === 'edit' && !current) {
                this.conflict = true; this.notice = { kind: 'error', text: 'The saved channel was removed. Your draft is kept.' };
                return { kind: 'conflict', reason: this.notice.text };
            }
            this.commitStarted = true;
            let result: Awaited<ReturnType<ChannelStudioPorts['manager']['tryCreateChannel']>>;
            try {
                result = draft.kind === 'edit' && draft.originalId
                    ? await this.ports.manager.tryUpdateChannel(draft.originalId, draft.toUpdateInput(), request.expectedBase)
                    : await this.ports.manager.tryCreateChannel(draft.toCreateInput(), { expectedBase: request.expectedBase });
            } catch {
                const reason = 'Storage could not save this channel. Retry.';
                if (saveToken === this.saveToken) this.notice = { kind: 'error', text: `Not saved: ${reason}` };
                return { kind: 'storage-failure', reason };
            }
            if (result.kind !== 'committed') {
                const reason = result.kind === 'invalid' ? result.error.message
                    : result.kind === 'conflict' ? 'The lineup changed. Choose how to continue.'
                        : 'Storage could not save this channel. Retry.';
                if (saveToken === this.saveToken) {
                    this.conflict = result.kind === 'conflict';
                    this.notice = { kind: 'error', text: `Not saved: ${reason}` };
                }
                return { kind: result.kind, reason };
            }
            if (saveToken === this.saveToken && this.draft === draft) {
                this.conflict = false; this.savedChannelId = result.value.id;
                const nextBase = this.ports.manager.getStructuralBase();
                this.draft = ChannelStudioDraft.fromCommitted(result.value, nextBase, draft.prospectiveId);
                this.invalidateVerification();
                this.notice = { kind: result.pointerWarning ? 'saved-warning' : 'saved', text: result.pointerWarning
                    ? 'Channel saved. Selection needs recovery after restart.' : 'Channel saved. Tune now is optional.' };
            }
            try { await this.ports.refreshAfterSave({ previous: draft.original, saved: result.value,
                programmingChanged: draft.isProgrammingDirty }); }
            catch {
                if (saveToken === this.saveToken) this.notice = { kind: 'saved-warning', text: 'Channel saved. Guide refresh needs retry.' };
            }
            return { kind: 'saved', channel: result.value };
        } finally {
            if (saveToken === this.saveToken) { this.saving = false; this.saveController = null; this.commitStarted = false; }
        }
    }

    async tuneNow(): Promise<void> {
        if (!this.savedChannelId || this.tuning) return;
        this.tuning = true;
        try { await this.ports.tuneNow(this.savedChannelId); }
        catch { this.notice = { kind: 'saved-warning', text: 'Channel saved. Tune failed. Try again or open Guide.' }; }
        finally { this.tuning = false; }
    }
}
