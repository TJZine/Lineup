import { AppErrorCode } from '../../../types/app-errors';
import type { AppError } from '../../../modules/lifecycle';
import { OrchestratorModuleStatusRegistry } from '../runtime/OrchestratorModuleStatusRegistry';

function createError(context: Record<string, unknown>): AppError {
    return {
        code: AppErrorCode.AUTH_INVALID,
        message: 'bad auth',
        recoverable: true,
        context,
    };
}

describe('OrchestratorModuleStatusRegistry', () => {
    it('owns canonical statuses and applies transition cleanup rules', () => {
        const registry = new OrchestratorModuleStatusRegistry({ reportCloneFallback: jest.fn() });

        expect(registry.getRuntimeStatus('plex-auth')).toBe('pending');
        registry.update('plex-auth', 'error', createError({ source: 'test' }), 12);
        expect(registry.snapshot().get('plex-auth')).toMatchObject({
            status: 'error',
            loadTimeMs: 12,
            error: { message: 'bad auth' },
        });

        registry.update('plex-auth', 'ready');
        expect(registry.snapshot().get('plex-auth')).toEqual({
            id: 'plex-auth',
            name: 'plex-auth',
            status: 'ready',
        });
    });

    it('returns defensive copies of status values and nested diagnostic context', () => {
        const sourceContext = { source: 'test', nested: { value: 'original' } };
        const registry = new OrchestratorModuleStatusRegistry({ reportCloneFallback: jest.fn() });
        registry.update('plex-auth', 'error', createError(sourceContext));

        const returned = registry.snapshot().get('plex-auth');
        expect(returned?.error?.context).toEqual(sourceContext);
        expect(returned?.error?.context).not.toBe(sourceContext);

        if (returned?.error?.context) {
            returned.status = 'ready';
            returned.error.context.source = 'mutated';
            (returned.error.context.nested as { value: string }).value = 'mutated';
        }

        const second = registry.snapshot().get('plex-auth');
        expect(second?.status).toBe('error');
        expect(second?.error?.context).toEqual(sourceContext);
    });

    it('preserves Error diagnostics when structuredClone falls back', () => {
        const originalStructuredClone = globalThis.structuredClone;
        const registry = new OrchestratorModuleStatusRegistry({ reportCloneFallback: jest.fn() });
        const diagnosticError = Object.assign(new Error('nested failure'), {
            code: 'E_TEST',
            details: { attempt: 1 },
        });

        Object.defineProperty(globalThis, 'structuredClone', {
            configurable: true,
            value: jest.fn(() => { throw new Error('clone failed'); }),
        });

        try {
            registry.update('plex-auth', 'error', createError({ diagnosticError }));

            const firstContext = registry.snapshot().get('plex-auth')?.error?.context;
            const clonedError = firstContext?.diagnosticError as Record<string, unknown> | undefined;
            expect(clonedError).toMatchObject({
                name: 'Error',
                message: 'nested failure',
                stack: expect.stringContaining('nested failure'),
                code: 'E_TEST',
                details: { attempt: 1 },
            });
            expect(clonedError).not.toBe(diagnosticError);

            if (clonedError) {
                (clonedError.details as { attempt: number }).attempt = 2;
            }

            expect(
                registry.snapshot().get('plex-auth')?.error?.context?.diagnosticError
            ).toMatchObject({
                details: { attempt: 1 },
            });
        } finally {
            Object.defineProperty(globalThis, 'structuredClone', {
                configurable: true,
                value: originalStructuredClone,
            });
        }
    });

    it('reports structuredClone fallback once for each failing context identity', () => {
        const originalStructuredClone = globalThis.structuredClone;
        const reportCloneFallback = jest.fn();
        const registry = new OrchestratorModuleStatusRegistry({ reportCloneFallback });
        const firstContext = { source: 'first', nested: { value: 'original' } };
        const secondContext = { source: 'second' };

        Object.defineProperty(globalThis, 'structuredClone', {
            configurable: true,
            value: jest.fn(() => { throw new Error('clone failed'); }),
        });

        try {
            registry.update('plex-auth', 'error', createError(firstContext));
            expect(registry.snapshot().get('plex-auth')?.error?.context).toEqual(firstContext);
            registry.snapshot();
            registry.update('plex-auth', 'error', createError(secondContext));
            registry.snapshot();

            expect(reportCloneFallback).toHaveBeenCalledTimes(2);
            expect(reportCloneFallback).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({ message: 'clone failed' })
            );
        } finally {
            Object.defineProperty(globalThis, 'structuredClone', {
                configurable: true,
                value: originalStructuredClone,
            });
        }
    });
});
