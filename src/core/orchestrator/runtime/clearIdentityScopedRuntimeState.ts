export type IdentityScopedRuntimeCleanupStep =
    | 'stopPlayback'
    | 'unloadCurrentChannel'
    | 'clearPlaybackState'
    | 'clearChannelManagerRuntimeState'
    | 'clearEpgScheduleState';

export type IdentityScopedRuntimeCleanupFailureReporter = (
    event: string,
    message: string,
    error: unknown,
    data: { step: IdentityScopedRuntimeCleanupStep }
) => void;

export interface IdentityScopedRuntimeStateResetDeps {
    stopPlayback(): void;
    unloadCurrentChannel(): void;
    clearPlaybackState(): void;
    clearChannelManagerRuntimeState(): void;
    clearEpgScheduleState(): void;
    reportFailure: IdentityScopedRuntimeCleanupFailureReporter;
}

export function clearIdentityScopedRuntimeState(
    deps: IdentityScopedRuntimeStateResetDeps,
    options: { stopPlayback: boolean }
): void {
    if (options.stopPlayback) {
        runCleanupStep(deps, 'stopPlayback', deps.stopPlayback);
    }
    runCleanupStep(deps, 'unloadCurrentChannel', deps.unloadCurrentChannel);
    runCleanupStep(deps, 'clearPlaybackState', deps.clearPlaybackState);
    runCleanupStep(deps, 'clearChannelManagerRuntimeState', deps.clearChannelManagerRuntimeState);
    runCleanupStep(deps, 'clearEpgScheduleState', deps.clearEpgScheduleState);
}

function runCleanupStep(
    deps: IdentityScopedRuntimeStateResetDeps,
    step: IdentityScopedRuntimeCleanupStep,
    cleanup: () => void
): void {
    try {
        cleanup();
    } catch (error) {
        try {
            deps.reportFailure(
                `orchestrator.identityScopedRuntimeState.${step}`,
                `Identity-scoped runtime cleanup step failed: ${step}`,
                error,
                { step }
            );
        } catch {
            // Reporting is diagnostic-only; identity transition continuation is authoritative.
        }
    }
}
