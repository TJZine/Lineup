export interface SelectedServerUnselectedRestorationDeps {
    cancelRuntimeWork(): Promise<void>;
    clearIdentityScopedRuntime(): void;
    configureChannelManagerStorage(): Promise<void>;
    publishPendingServerModules(): void;
    setReady(ready: boolean): void;
    publishLoadingLifecycle(): void;
    openServerSelect(): void;
}

export async function restoreUnselectedServerRuntime(
    deps: SelectedServerUnselectedRestorationDeps,
    assertCurrent: () => void
): Promise<void> {
    assertCurrent();
    await deps.cancelRuntimeWork();
    assertCurrent();
    deps.clearIdentityScopedRuntime();
    assertCurrent();
    await deps.configureChannelManagerStorage();
    assertCurrent();
    deps.publishPendingServerModules();
    assertCurrent();
    deps.setReady(false);
    assertCurrent();
    deps.publishLoadingLifecycle();
    assertCurrent();
    deps.openServerSelect();
    assertCurrent();
}
