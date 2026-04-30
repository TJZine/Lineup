import { summarizeErrorForLog } from '../../utils/errors';

export interface OrchestratorShutdownTeardownFailure {
    step: string;
    error: unknown;
}

export class OrchestratorShutdownTeardown {
    private readonly failures: OrchestratorShutdownTeardownFailure[] = [];

    getFailures(): OrchestratorShutdownTeardownFailure[] {
        return [...this.failures];
    }

    recordFailure(step: string, error: unknown): void {
        this.failures.push({ step, error: summarizeErrorForLog(error) });
    }

    run(step: string, teardown: () => void): void {
        try {
            teardown();
        } catch (error) {
            this.recordFailure(step, error);
        }
    }

    async runAsync(step: string, teardown: () => Promise<void>): Promise<void> {
        try {
            await teardown();
        } catch (error) {
            this.recordFailure(step, error);
        }
    }
}
