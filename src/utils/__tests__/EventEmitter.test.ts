/**
 * @fileoverview Unit tests for the EventEmitter class.
 * @module utils/__tests__/EventEmitter.test
 * @version 1.0.0
 */

import { expectConsoleWarn } from '../../__tests__/helpers';
import { EventEmitter } from '../EventEmitter';

describe('EventEmitter', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('on/emit', () => {
        it('accepts closed interface event maps', () => {
            interface ClosedEvents {
                ping: { value: number };
            }

            const emitter = new EventEmitter<ClosedEvents>();
            const handler = jest.fn();

            emitter.on('ping', handler);
            emitter.emit('ping', { value: 7 });

            expect(handler).toHaveBeenCalledWith({ value: 7 });
        });

        it('should call handler with correct payload type', () => {
            type TestEvents = { test: { value: number } };
            const emitter = new EventEmitter<TestEvents>();
            const handler = jest.fn();

            emitter.on('test', handler);
            emitter.emit('test', { value: 42 });

            expect(handler).toHaveBeenCalledWith({ value: 42 });
        });

        it('should call multiple handlers for same event', () => {
            const emitter = new EventEmitter<{ test: void }>();
            const handler1 = jest.fn();
            const handler2 = jest.fn();

            emitter.on('test', handler1);
            emitter.on('test', handler2);
            emitter.emit('test', undefined);

            expect(handler1).toHaveBeenCalled();
            expect(handler2).toHaveBeenCalled();
        });

        it('should return disposable that removes handler', () => {
            const emitter = new EventEmitter<{ test: void }>();
            const handler = jest.fn();

            const disposable = emitter.on('test', handler);
            disposable.dispose();
            emitter.emit('test', undefined);

            expect(handler).not.toHaveBeenCalled();
        });

        it('invokes subscribed handlers on emit', () => {
            type Events = { ping: { value: number } };
            const emitter = new EventEmitter<Events>();

            const handler = jest.fn();
            emitter.on('ping', handler);

            emitter.emit('ping', { value: 1 });
            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith({ value: 1 });
        });
    });

    describe('error isolation', () => {
        it('should continue calling handlers after one throws', () => {
            expectConsoleWarn([
                expect.stringContaining("Handler error for event 'test'"),
                expect.objectContaining({
                    name: 'Error',
                    message: 'Handler error',
                }),
            ]);
            const emitter = new EventEmitter<{ test: void }>();
            const errorHandler = jest.fn(() => {
                throw new Error('Handler error');
            });
            const successHandler = jest.fn();

            emitter.on('test', errorHandler);
            emitter.on('test', successHandler);

            // Should not throw
            expect(() => emitter.emit('test', undefined)).not.toThrow();

            // Both handlers should have been called
            expect(errorHandler).toHaveBeenCalled();
            expect(successHandler).toHaveBeenCalled();
        });

        it('routes redacted handler errors to console.warn', () => {
            const emitter = new EventEmitter<{ test: void }>();
            const warning = expectConsoleWarn([
                expect.stringContaining('Handler error for event'),
                expect.any(Object),
            ]);
            const secret = 'super-secret';

            emitter.on('test', () => {
                throw new Error(`http://x?X-Plex-Token=${secret}`);
            });
            emitter.emit('test', undefined);

            const warningPayload = warning.getLastCall()?.[1] as { message?: string } | undefined;
            expect(warningPayload).toBeDefined();
            const message = warningPayload?.message ?? '';
            expect(message).toContain('REDACTED');
            expect(message).not.toContain(secret);
        });

        it('keeps emit isolated while reporting handler failures through console.warn', () => {
            const emitter = new EventEmitter<{ test: void }>();
            expectConsoleWarn([
                expect.stringContaining('Handler error for event'),
                expect.objectContaining({
                    name: 'Error',
                    message: 'Handler error',
                }),
            ]);
            const successHandler = jest.fn();

            emitter.on('test', () => {
                throw new Error('Handler error');
            });
            emitter.on('test', successHandler);

            expect(() => emitter.emit('test', undefined)).not.toThrow();
            expect(successHandler).toHaveBeenCalled();
        });

        it('keeps emit non-throwing even when the fallback warning path throws', () => {
            const emitter = new EventEmitter<{ test: void }>();
            jest.spyOn(console, 'warn').mockImplementation(() => {
                throw new Error('warn failed');
            });
            const successHandler = jest.fn();

            emitter.on('test', () => {
                throw new Error('Handler error');
            });
            emitter.on('test', successHandler);

            expect(() => emitter.emit('test', undefined)).not.toThrow();
            expect(successHandler).toHaveBeenCalled();
        });
    });

    describe('once', () => {
        it('should only fire handler once', () => {
            const emitter = new EventEmitter<{ test: void }>();
            const handler = jest.fn();

            emitter.once('test', handler);
            emitter.emit('test', undefined);
            emitter.emit('test', undefined);

            expect(handler).toHaveBeenCalledTimes(1);
        });

        it('supports once() handlers', () => {
            type Events = { tick: void };
            const emitter = new EventEmitter<Events>();

            const handler = jest.fn();
            emitter.once('tick', handler);

            emitter.emit('tick', undefined);
            emitter.emit('tick', undefined);
            expect(handler).toHaveBeenCalledTimes(1);
        });

        it('should allow disposing once handler before it fires', () => {
            const emitter = new EventEmitter<{ test: void }>();
            const handler = jest.fn();

            const disposable = emitter.once('test', handler);
            disposable.dispose();
            emitter.emit('test', undefined);

            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('off', () => {
        it('should remove specific handler', () => {
            const emitter = new EventEmitter<{ test: void }>();
            const handler = jest.fn();

            emitter.on('test', handler);
            emitter.off('test', handler);
            emitter.emit('test', undefined);

            expect(handler).not.toHaveBeenCalled();
        });

        it('should not throw when removing unregistered handler', () => {
            const emitter = new EventEmitter<{ test: void }>();
            const handler = jest.fn();

            expect(() => emitter.off('test', handler)).not.toThrow();
        });
    });

    describe('removeAllListeners', () => {
        it('should remove all handlers for specific event', () => {
            const emitter = new EventEmitter<{ a: void; b: void }>();
            const handlerA = jest.fn();
            const handlerB = jest.fn();

            emitter.on('a', handlerA);
            emitter.on('b', handlerB);
            emitter.removeAllListeners('a');

            emitter.emit('a', undefined);
            emitter.emit('b', undefined);

            expect(handlerA).not.toHaveBeenCalled();
            expect(handlerB).toHaveBeenCalled();
        });

        it('should remove all handlers when no event specified', () => {
            const emitter = new EventEmitter<{ a: void; b: void }>();
            emitter.on('a', jest.fn());
            emitter.on('b', jest.fn());

            emitter.removeAllListeners();

            expect(emitter.listenerCount('a')).toBe(0);
            expect(emitter.listenerCount('b')).toBe(0);
        });

        it('removeAllListeners(event) removes handlers for that event only', () => {
            type Events = { a: void; b: void };
            const emitter = new EventEmitter<Events>();

            const a = jest.fn();
            const b = jest.fn();
            emitter.on('a', a);
            emitter.on('b', b);

            emitter.removeAllListeners('a');
            emitter.emit('a', undefined);
            emitter.emit('b', undefined);
            expect(a).not.toHaveBeenCalled();
            expect(b).toHaveBeenCalledTimes(1);
        });
    });

    describe('listenerCount', () => {
        it('should return correct count', () => {
            const emitter = new EventEmitter<{ test: void }>();

            expect(emitter.listenerCount('test')).toBe(0);

            emitter.on('test', () => { });
            expect(emitter.listenerCount('test')).toBe(1);

            emitter.on('test', () => { });
            expect(emitter.listenerCount('test')).toBe(2);
        });

        it('should return 0 for unregistered events', () => {
            const emitter = new EventEmitter<{ test: void }>();
            expect(emitter.listenerCount('test')).toBe(0);
        });
    });

    describe('edge cases', () => {
        it('should handle emit with no handlers gracefully', () => {
            const emitter = new EventEmitter<{ test: { value: number } }>();

            expect(() => emitter.emit('test', { value: 42 })).not.toThrow();
        });

        it('should handle void payload events', () => {
            const emitter = new EventEmitter<{ tick: void }>();
            const handler = jest.fn();

            emitter.on('tick', handler);
            emitter.emit('tick', undefined);

            expect(handler).toHaveBeenCalledWith(undefined);
        });

        it('should safely handle handler removal during emit', () => {
            const emitter = new EventEmitter<{ test: number }>();
            const calls: string[] = [];

            const handlerA = (): void => {
                calls.push('A');
                emitter.off('test', handlerB);
            };
            const handlerB = (): void => {
                calls.push('B');
            };
            const handlerC = (): void => {
                calls.push('C');
            };

            emitter.on('test', handlerA);
            emitter.on('test', handlerB);
            emitter.on('test', handlerC);

            emitter.emit('test', 1);

            expect(calls).toEqual(['A', 'B', 'C']);
        });

        it('delivers handlers added during emit on the next emit only', () => {
            const emitter = new EventEmitter<{ test: number }>();
            const calls: string[] = [];
            const lateHandler = (): void => { calls.push('late'); };

            const handlerA = (): void => {
                calls.push('A');
                emitter.on('test', lateHandler);
            };

            emitter.on('test', handlerA);
            emitter.emit('test', 1);

            expect(calls).toEqual(['A']);

            calls.length = 0;
            emitter.emit('test', 2);

            expect(calls).toEqual(['A', 'late']);
        });
    });
});
