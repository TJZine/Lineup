import { appendDebugRuntimeLog, isDebugRuntimeEnabled } from '../debugRuntimeGuards';
import type { IEpgDebugRuntime } from '../EPGDebugRuntime';

describe('debugRuntimeGuards', () => {
    it('returns false when isEnabled throws', () => {
        const debugRuntime: IEpgDebugRuntime = {
            isEnabled: () => {
                throw new Error('boom');
            },
            append: jest.fn(),
            destroy: jest.fn(),
        };

        expect(isDebugRuntimeEnabled(debugRuntime)).toBe(false);
    });

    it('returns underlying enabled state when isEnabled succeeds', () => {
        const debugRuntime: IEpgDebugRuntime = {
            isEnabled: () => true,
            append: jest.fn(),
            destroy: jest.fn(),
        };

        expect(isDebugRuntimeEnabled(debugRuntime)).toBe(true);
    });

    it('swallows append failures', () => {
        const debugRuntime: IEpgDebugRuntime = {
            isEnabled: () => true,
            append: () => {
                throw new Error('append failed');
            },
            destroy: jest.fn(),
        };

        expect(() => {
            appendDebugRuntimeLog(debugRuntime, 'event:test', { ok: true });
        }).not.toThrow();
    });

    it('forwards append payloads when append succeeds', () => {
        const append = jest.fn();
        const debugRuntime: IEpgDebugRuntime = {
            isEnabled: () => true,
            append,
            destroy: jest.fn(),
        };

        appendDebugRuntimeLog(debugRuntime, 'event:test', { ok: true });

        expect(append).toHaveBeenCalledWith('event:test', { ok: true });
    });
});
