/**
 * @jest-environment jsdom
 */

import { PlexLibraryRequestScope } from '../modules/plex/library/PlexLibraryRequestScope';
import { readAbortSignalReason } from '../utils/abortSignalReason';
import { setTrustedInlineSvg } from '../utils/inlineSvg';
import { installRequiredWebApis } from './requiredWebApis';

const withMissingRequiredMethods = (
    run: () => void,
    options: { omitAbortSignalReasonGetter?: boolean } = {}
): void => {
    const replaceChildrenDescriptor = Object.getOwnPropertyDescriptor(
        Element.prototype,
        'replaceChildren'
    );
    const throwIfAbortedDescriptor = Object.getOwnPropertyDescriptor(
        AbortSignal.prototype,
        'throwIfAborted'
    );
    const reasonDescriptor = Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'reason');

    Reflect.deleteProperty(Element.prototype, 'replaceChildren');
    Reflect.deleteProperty(AbortSignal.prototype, 'throwIfAborted');
    if (options.omitAbortSignalReasonGetter) {
        Reflect.deleteProperty(AbortSignal.prototype, 'reason');
    }

    try {
        run();
    } finally {
        Reflect.deleteProperty(Element.prototype, 'replaceChildren');
        Reflect.deleteProperty(AbortSignal.prototype, 'throwIfAborted');
        if (replaceChildrenDescriptor) {
            Object.defineProperty(Element.prototype, 'replaceChildren', replaceChildrenDescriptor);
        }
        if (throwIfAbortedDescriptor) {
            Object.defineProperty(AbortSignal.prototype, 'throwIfAborted', throwIfAbortedDescriptor);
        }
        if (options.omitAbortSignalReasonGetter && reasonDescriptor) {
            Object.defineProperty(AbortSignal.prototype, 'reason', reasonDescriptor);
        }
    }
};

const createPlexLibraryRequestScope = (): PlexLibraryRequestScope =>
    new PlexLibraryRequestScope({
        config: {
            getServerUri: () => 'http://server.example:32400',
            getAuthHeaders: () => ({ 'X-Plex-Token': 'test-token' }),
            getAuthToken: () => 'test-token',
            refreshSelectedServerAccessToken: async () => ({ kind: 'unchanged' }),
        },
        onScopeChange: () => undefined,
    });

describe('required web API installation', () => {
    it('preserves native methods and their property descriptors', () => {
        const nativeReplaceChildren = Element.prototype.replaceChildren;
        const nativeThrowIfAborted = AbortSignal.prototype.throwIfAborted;
        const replaceChildrenDescriptor = Object.getOwnPropertyDescriptor(
            Element.prototype,
            'replaceChildren'
        );
        const throwIfAbortedDescriptor = Object.getOwnPropertyDescriptor(
            AbortSignal.prototype,
            'throwIfAborted'
        );

        installRequiredWebApis();

        expect(Element.prototype.replaceChildren).toBe(nativeReplaceChildren);
        expect(AbortSignal.prototype.throwIfAborted).toBe(nativeThrowIfAborted);
        expect(Object.getOwnPropertyDescriptor(Element.prototype, 'replaceChildren'))
            .toEqual(replaceChildrenDescriptor);
        expect(Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'throwIfAborted'))
            .toEqual(throwIfAbortedDescriptor);
        expect(replaceChildrenDescriptor)
            .toMatchObject({ configurable: true, enumerable: true, writable: true });
        expect(throwIfAbortedDescriptor)
            .toMatchObject({ configurable: true, enumerable: true, writable: true });
    });

    it('installs an idempotent replaceChildren fallback with standard child replacement semantics', () => {
        withMissingRequiredMethods(() => {
            installRequiredWebApis();
            const fallback = Element.prototype.replaceChildren;
            const throwIfAbortedFallback = AbortSignal.prototype.throwIfAborted;

            installRequiredWebApis();

            expect(Element.prototype.replaceChildren).toBe(fallback);
            expect(AbortSignal.prototype.throwIfAborted).toBe(throwIfAbortedFallback);
            expect(Object.getOwnPropertyDescriptor(Element.prototype, 'replaceChildren'))
                .toMatchObject({ configurable: true, enumerable: true, writable: true });
            expect(Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'throwIfAborted'))
                .toMatchObject({ configurable: true, enumerable: true, writable: true });

            const target = document.createElement('div');
            const removed = document.createElement('i');
            const source = document.createElement('div');
            const first = document.createElement('b');
            const reused = document.createElement('em');
            target.appendChild(removed);
            source.append(first, reused);

            target.replaceChildren('start', first, reused, first, 'end');

            expect(Array.from(target.childNodes)).toEqual([
                expect.objectContaining({ nodeType: Node.TEXT_NODE, textContent: 'start' }),
                reused,
                first,
                expect.objectContaining({ nodeType: Node.TEXT_NODE, textContent: 'end' }),
            ]);
            expect(removed.parentNode).toBeNull();
            expect(source.childNodes).toHaveLength(0);
            expect(reused.parentNode).toBe(target);
            expect(first.parentNode).toBe(target);

            target.replaceChildren();
            expect(target.childNodes).toHaveLength(0);
        });
    });

    it('rejects invalid replacement trees before moving existing target children', () => {
        withMissingRequiredMethods(() => {
            installRequiredWebApis();

            const ancestor = document.createElement('div');
            const target = document.createElement('section');
            const retained = document.createElement('p');
            ancestor.appendChild(target);
            target.appendChild(retained);

            expect(() => target.replaceChildren(target)).toThrow(
                expect.objectContaining({ name: 'HierarchyRequestError' })
            );
            expect(() => target.replaceChildren(ancestor)).toThrow(
                expect.objectContaining({ name: 'HierarchyRequestError' })
            );
            expect(() => target.replaceChildren(document)).toThrow(
                expect.objectContaining({ name: 'HierarchyRequestError' })
            );

            expect(target.firstChild).toBe(retained);
            expect(retained.parentNode).toBe(target);
            expect(target.parentNode).toBe(ancestor);
        });
    });

    it('rejects invalid Element receivers before reading properties or moving nodes', () => {
        withMissingRequiredMethods(() => {
            installRequiredWebApis();

            const source = document.createElement('div');
            const replacement = document.createElement('b');
            source.appendChild(replacement);
            const readOwnerDocument = jest.fn(() => document);
            const fakeReceiver = Object.defineProperty({}, 'ownerDocument', {
                configurable: true,
                get: readOwnerDocument,
            });

            expect(() => Reflect.apply(Element.prototype.replaceChildren, fakeReceiver, [replacement]))
                .toThrow(TypeError);
            expect(readOwnerDocument).not.toHaveBeenCalled();
            expect(replacement.parentNode).toBe(source);

            const fragment = document.createDocumentFragment();
            const retained = document.createElement('i');
            fragment.appendChild(retained);

            expect(() => Reflect.apply(Element.prototype.replaceChildren, fragment, [replacement]))
                .toThrow(TypeError);
            expect(fragment.firstChild).toBe(retained);
            expect(replacement.parentNode).toBe(source);
        });
    });

    it('supports the existing trusted inline SVG caller when replaceChildren is absent', () => {
        withMissingRequiredMethods(() => {
            installRequiredWebApis();

            const container = document.createElement('span');
            container.textContent = 'old content';

            setTrustedInlineSvg(container, '<svg viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg>');

            const svg = container.querySelector('svg');
            expect(svg).not.toBeNull();
            expect(svg?.ownerDocument).toBe(document);

            setTrustedInlineSvg(container, '');
            expect(container.childNodes).toHaveLength(0);
        });
    });

    it('preserves abort semantics for the existing Plex library request caller', () => {
        withMissingRequiredMethods(() => {
            installRequiredWebApis();
            const scope = createPlexLibraryRequestScope();
            const controller = new AbortController();

            expect(scope.capture(controller.signal).signal).toBe(controller.signal);
            expect(() => controller.signal.throwIfAborted()).not.toThrow();

            const reason = new Error('caller canceled');
            controller.abort(reason);
            let observedReason: unknown;
            try {
                scope.capture(controller.signal);
            } catch (error: unknown) {
                observedReason = error;
            }
            expect(observedReason).toBe(reason);
        });
    });

    it('uses native internal signal state and reason even when valid signal properties are shadowed', () => {
        withMissingRequiredMethods(() => {
            installRequiredWebApis();
            const scope = createPlexLibraryRequestScope();
            const controller = new AbortController();
            const actualReason = new Error('actual cancellation');
            const shadowedReason = new Error('shadow property');
            controller.abort(actualReason);
            Object.defineProperty(controller.signal, 'aborted', { configurable: true, value: false });
            Object.defineProperty(controller.signal, 'reason', { configurable: true, value: shadowedReason });

            let observedReason: unknown;
            try {
                scope.capture(controller.signal);
            } catch (error: unknown) {
                observedReason = error;
            }

            expect(observedReason).toBe(actualReason);
            expect(readAbortSignalReason(controller.signal)).toBe(shadowedReason);
        });
    });

    it('throws TypeError for an invalid throwIfAborted receiver', () => {
        withMissingRequiredMethods(() => {
            installRequiredWebApis();

            expect(() => Reflect.apply(AbortSignal.prototype.throwIfAborted, {}, [])).toThrow(TypeError);
        });
    });

    it('uses the existing stable AbortError fallback when an older signal has no reason', () => {
        withMissingRequiredMethods(() => {
            installRequiredWebApis();
            const scope = createPlexLibraryRequestScope();
            const controller = new AbortController();
            controller.abort();
            const shadowedReason = new Error('own reason property is not the internal reason');
            Object.defineProperty(controller.signal, 'reason', { configurable: true, value: shadowedReason });

            const captureError = (): unknown => {
                try {
                    scope.capture(controller.signal);
                } catch (error: unknown) {
                    return error;
                }
                return undefined;
            };

            const firstError = captureError();
            const secondError = captureError();

            expect(firstError).toBeInstanceOf(DOMException);
            expect(firstError).toMatchObject({ name: 'AbortError', message: 'Aborted' });
            expect(secondError).toBe(firstError);
            expect(firstError).not.toBe(shadowedReason);
            expect(readAbortSignalReason(controller.signal)).toBe(shadowedReason);
        }, { omitAbortSignalReasonGetter: true });
    });
});
