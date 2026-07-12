import type { ChannelInitialTuneLineage } from '../channel-tuning/ChannelInitialTuneAuthority';
import type { InitializationSelectedServerLineage } from '../initialization/InitializationStartupHandoff';
import type { SelectedServerInitializationResult } from '../initialization/InitializationSelectedServerTransaction';
import type { OperationContextUpstream } from '../../utils/RetainedOperationContext';

export async function restoreSelectedServerRuntime(options: {
    operation: OperationContextUpstream & { signal: AbortSignal };
    startupLineage: InitializationSelectedServerLineage;
    suspendAndDrain(): Promise<void>;
    beginInitialTuneLineage(validators: readonly OperationContextUpstream[]): ChannelInitialTuneLineage;
    runInitialization(request: {
        lineage: ChannelInitialTuneLineage;
        startupLineage: InitializationSelectedServerLineage;
        operation: OperationContextUpstream & { signal: AbortSignal };
    }): Promise<SelectedServerInitializationResult>;
    completeInitialTuneLineage(lineage: ChannelInitialTuneLineage): void;
}): Promise<void> {
    options.operation.assertCurrent();
    await options.suspendAndDrain();
    options.operation.assertCurrent();
    const lineage = options.beginInitialTuneLineage([options.operation]);
    const result = await options.runInitialization({
        lineage,
        startupLineage: options.startupLineage,
        operation: options.operation,
    });
    options.operation.assertCurrent();
    if (result.kind !== 'completed') {
        throw result.kind === 'failed' ? result.error : new Error(`Recovery stopped: ${result.reason}`);
    }
    options.completeInitialTuneLineage(lineage);
    options.operation.assertCurrent();
}
