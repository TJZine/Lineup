import type { GuideFailureDiagnostic } from '../../../debug/GuideDiagnosticValues';

/**
 * Ephemeral scalars only. `result` observes items before the final delivery guards;
 * it is not successful consumer settlement. EPG requestCompleted owns that verdict.
 * A subsequent `settled` failure can record a reentrant invalidation of the result.
 */
export interface SourceResolutionDiagnostic {
    event: 'access' | 'result' | 'settled';
    consumerId: number;
    producerId: number | null;
    access: 'cache' | 'create' | 'join';
    cacheMode: 'default' | 'revalidate';
    outcome: 'pending' | 'success' | 'failure';
    timeOrigin: number;
    monotonicMs: number;
    elapsedMs: number;
    itemCount: number | null;
    activeProducers: number;
    waiters: number;
    callerAborted: boolean;
    consumerAborted: boolean;
    producerAborted: boolean;
    commonScopeAborted: boolean;
    matchesConsumerReason: boolean;
    matchesProducerReason: boolean;
    matchesCommonScopeReason: boolean;
    failure: GuideFailureDiagnostic | null;
}

export type ObserveSourceResolution = (diagnostic: SourceResolutionDiagnostic) => void;
