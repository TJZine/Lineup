import type { AppError } from '../../../modules/lifecycle';
import type { PlexDiscoverySignalOptions } from '../../../modules/plex/discovery';
import { AppErrorCode } from '../../../types/app-errors';
import type { SelectedServerQuarantineCommandState } from '../../server-selection/SelectedServerQuarantineRecoveryState';
import type { OrchestratorServerSelectionResult } from '../../server-selection/ServerSelectionTypes';
import type { OrchestratorServerSelectionRuntime } from './OrchestratorServerSelectionRuntime';

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
            if (this._runtime.getQuarantineState().kind === 'quarantined') {
                this._reportGlobalError({
                    code: AppErrorCode.INITIALIZATION_FAILED,
                    message: 'Selected-server recovery requires user action.',
                    recoverable: true,
                    context: { recoveryMode: 'selected-server-quarantine' },
                }, 'server-selection-quarantine');
            }
            throw error;
        }
    }

    clearSelectedServer(): Promise<void> {
        return this._runtime.clearSelectedServer();
    }

    getQuarantineState(): SelectedServerQuarantineCommandState {
        return this._runtime.getQuarantineState();
    }

    retryQuarantineRecovery(): Promise<void> {
        return this._runtime.retryQuarantineRecovery();
    }

    exitQuarantine(): Promise<void> {
        return this._runtime.exitQuarantine();
    }
}
