import { summarizeErrorForLog } from '../../utils/errors';

export type OrchestratorEventCleanupStep =
    | 'event-wiring.cleanup'
    | 'event-wiring.onCleanupError';

export interface OrchestratorEventCleanupFailure {
    step: OrchestratorEventCleanupStep;
    error: unknown;
}

export type OrchestratorEventCleanupReporter = (
    failures: OrchestratorEventCleanupFailure[]
) => void;

export function summarizeEventCleanupFailure(
    step: OrchestratorEventCleanupStep,
    error: unknown
): OrchestratorEventCleanupFailure {
    return {
        step,
        error: summarizeErrorForLog(error),
    };
}
