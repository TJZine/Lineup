export interface IdentityScopedRuntimeStateResetDeps {
    stopPlayback(): void;
    unloadCurrentChannel(): void;
    clearPlaybackState(): void;
    clearChannelManagerRuntimeState(): void;
    clearEpgScheduleState(): void;
}

export function clearIdentityScopedRuntimeState(
    deps: IdentityScopedRuntimeStateResetDeps,
    options: { resetPlayback: boolean }
): void {
    if (options.resetPlayback) {
        deps.stopPlayback();
        deps.unloadCurrentChannel();
        deps.clearPlaybackState();
    }
    deps.clearChannelManagerRuntimeState();
    deps.clearEpgScheduleState();
}
