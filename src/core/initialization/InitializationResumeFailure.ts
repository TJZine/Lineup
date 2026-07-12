import type { RecoverableAsyncFailureReporter } from '../orchestrator/runtime/OrchestratorRuntimeSeams';

export type StartupResumePhase = 2 | 3;

const FAILURES: Record<StartupResumePhase, { context: string; message: string }> = {
    2: {
        context: 'initialization.resume.afterAuthChange',
        message: 'Background startup resume after auth change failed',
    },
    3: {
        context: 'initialization.resume.afterServerSelection',
        message: 'Background startup resume after server selection failed',
    },
};

export function reportInitializationResumeFailure(
    phase: StartupResumePhase,
    reporter: RecoverableAsyncFailureReporter,
    error: unknown
): void {
    try {
        const failure = FAILURES[phase];
        reporter(failure.context, failure.message, error);
    } catch {
        // Diagnostics stay best-effort.
    }
}
