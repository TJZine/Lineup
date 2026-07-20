import type { AppError } from '../../../modules/lifecycle';
import type { PlexDiscoverySignalOptions } from '../../../modules/plex/discovery';
import type {
    SelectedServerQuarantineCommandState,
    SelectedServerQuarantineRecoveryPresentation,
} from '../../server-selection/SelectedServerQuarantineRecoveryState';
import type { OrchestratorServerSelectionResult } from '../../server-selection/ServerSelectionTypes';
import type { OrchestratorServerSelectionRuntime } from './OrchestratorServerSelectionRuntime';
import { createSelectedServerRecoveryAppError } from './SelectedServerRecoveryAppError';

export { createSelectedServerRecoveryGateError } from './SelectedServerRecoveryAppError';

type ReportGlobalError = (error: AppError, context: string) => void;

export class OrchestratorServerSelectionRuntimeProjection {
    constructor(
        private readonly _runtime: OrchestratorServerSelectionRuntime,
        private readonly _reportGlobalError: ReportGlobalError
    ) {}

    getSelectedServerId(): string | null {
        return this._runtime.getSelectedServerId();
    }

    async selectServer(
        serverId: string,
        options?: PlexDiscoverySignalOptions
    ): Promise<OrchestratorServerSelectionResult> {
        try {
            return await this._runtime.selectServer(serverId, options);
        } catch (error: unknown) {
            const quarantine = this._runtime.getQuarantineState();
            if (quarantine.kind === 'quarantined') {
                this._reportGlobalError(
                    createSelectedServerRecoveryAppError(
                        'Selected-server recovery requires user action.',
                        quarantine
                    ),
                    'server-selection-quarantine'
                );
            }
            throw error;
        }
    }

    async clearSelectedServer(): Promise<void> {
        try {
            await this._runtime.clearSelectedServer();
        } catch (error: unknown) {
            const quarantine = this._runtime.getQuarantineState();
            if (quarantine.kind === 'quarantined') {
                this._reportGlobalError(
                    createSelectedServerRecoveryAppError(
                        'Selected-server recovery requires user action.',
                        quarantine
                    ),
                    'server-selection-quarantine'
                );
            }
            throw error;
        }
    }

    getQuarantineState(): SelectedServerQuarantineCommandState {
        return this._runtime.getQuarantineState();
    }

    retryQuarantineRecovery(): Promise<SelectedServerQuarantineRecoveryPresentation> {
        return this._runtime.retryQuarantineRecovery();
    }

    exitQuarantine(): Promise<void> {
        return this._runtime.exitQuarantine();
    }
}
