import type { InitializationSelectedServerLineage } from '../initialization/InitializationStartupHandoff';
import type { SelectedServerInitializationResult } from '../initialization/InitializationSelectedServerTransaction';
import type { OperationContextUpstream } from '../../utils/RetainedOperationContext';

export async function restoreSelectedServerRuntime(options: {
    operation: OperationContextUpstream & { signal: AbortSignal };
    startupLineage: InitializationSelectedServerLineage;
    suspendAndDrain(): Promise<void>;
    runInitialization(request: {
        startupLineage: InitializationSelectedServerLineage;
        operation: OperationContextUpstream & { signal: AbortSignal };
        commitOperation: OperationContextUpstream & { signal: AbortSignal };
    }): Promise<SelectedServerInitializationResult>;
}): Promise<void> {
    options.operation.assertCurrent();
    await options.suspendAndDrain();
    options.operation.assertCurrent();
    const result = await options.runInitialization({
        startupLineage: options.startupLineage,
        operation: options.operation,
        commitOperation: options.operation,
    });
    options.operation.assertCurrent();
    if (result.kind !== 'completed') {
        throw result.kind === 'failed' ? result.error : new Error(`Recovery stopped: ${result.reason}`);
    }
    options.operation.assertCurrent();
}
