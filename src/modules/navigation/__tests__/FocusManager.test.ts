/**
 * @jest-environment jsdom
 */

/**
 * @fileoverview Unit tests for FocusManager.
 * @module modules/navigation/__tests__/FocusManager.test
 */

import { FocusManager } from '../manager/FocusManager';
import { FocusGroup } from '../contracts/interfaces';

type LayoutOptions = {
    display?: string;
    offsetParent?: HTMLElement | null;
    position?: string;
    visibility?: string;
};

// Mock elements
function createMockElement(id: string): HTMLElement {
    const el = document.createElement('button');
    el.id = id;
    document.body.appendChild(el);
    return el;
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
    return {
        x: left,
        y: top,
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        toJSON: () => ({}),
    } as DOMRect;
}

function setLayout(
    element: HTMLElement,
    elementRect: DOMRect,
    options: LayoutOptions = {}
): void {
    element.getBoundingClientRect = jest.fn(() => elementRect);
    element.style.display = options.display ?? 'block';
    element.style.position = options.position ?? 'static';
    element.style.visibility = options.visibility ?? 'visible';

    Object.defineProperty(element, 'offsetParent', {
        configurable: true,
        get: () => (
            Object.prototype.hasOwnProperty.call(options, 'offsetParent')
                ? options.offsetParent
                : document.body
        ),
    });
}

describe('FocusManager', () => {
    let focusManager: FocusManager;
    let elements: HTMLElement[] = [];

    beforeEach(() => {
        elements.forEach((el) => {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        });
        elements = [];
        focusManager = new FocusManager();
    });

    afterEach(() => {
        focusManager.clear();
        elements.forEach((el) => {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        });
        elements = [];
    });

    describe('focus operations', () => {
        it('should focus a registered element', () => {
            const el = createMockElement('btn1');
            elements.push(el);

            focusManager.registerFocusable({ id: 'btn1', element: el, neighbors: {} });
            const result = focusManager.focus('btn1');

            expect(result).toBe(true);
            expect(focusManager.getCurrentFocusId()).toBe('btn1');
            expect(el.classList.contains('focused')).toBe(true);
        });

        it('should return false for unregistered element', () => {
            const result = focusManager.focus('unknown');

            expect(result).toBe(false);
            expect(focusManager.getCurrentFocusId()).toBeNull();
        });

        it('should blur previous element when focusing new one', () => {
            const el1 = createMockElement('btn1');
            const el2 = createMockElement('btn2');
            elements.push(el1, el2);

            focusManager.registerFocusable({ id: 'btn1', element: el1, neighbors: {} });
            focusManager.registerFocusable({ id: 'btn2', element: el2, neighbors: {} });

            focusManager.focus('btn1');
            focusManager.focus('btn2');

            expect(el1.classList.contains('focused')).toBe(false);
            expect(el2.classList.contains('focused')).toBe(true);
        });

        it('should call onFocus callback', () => {
            const onFocus = jest.fn();
            const el = createMockElement('btn1');
            elements.push(el);

            focusManager.registerFocusable({
                id: 'btn1',
                element: el,
                onFocus,
                neighbors: {},
            });
            focusManager.focus('btn1');

            expect(onFocus).toHaveBeenCalled();
        });

        it('should call onBlur callback', () => {
            const onBlur = jest.fn();
            const el1 = createMockElement('btn1');
            const el2 = createMockElement('btn2');
            elements.push(el1, el2);

            focusManager.registerFocusable({
                id: 'btn1',
                element: el1,
                onBlur,
                neighbors: {},
            });
            focusManager.registerFocusable({ id: 'btn2', element: el2, neighbors: {} });

            focusManager.focus('btn1');
            focusManager.focus('btn2');

            expect(onBlur).toHaveBeenCalled();
        });
    });

    describe('explicit neighbor navigation', () => {
        it('should find explicit neighbor', () => {
            const el1 = createMockElement('btn1');
            const el2 = createMockElement('btn2');
            elements.push(el1, el2);

            focusManager.registerFocusable({
                id: 'btn1',
                element: el1,
                neighbors: { right: 'btn2' },
            });
            focusManager.registerFocusable({
                id: 'btn2',
                element: el2,
                neighbors: { left: 'btn1' },
            });

            const neighbor = focusManager.findNeighbor('btn1', 'right');
            expect(neighbor).toBe('btn2');
        });

        it('should return null when no neighbor defined', () => {
            const el = createMockElement('btn1');
            elements.push(el);

            focusManager.registerFocusable({
                id: 'btn1',
                element: el,
                neighbors: { right: 'btn2' },
            });

            const neighbor = focusManager.findNeighbor('btn1', 'left');
            expect(neighbor).toBeNull();
        });
    });

    describe('focus group navigation', () => {
        it('should navigate within vertical group', () => {
            const el1 = createMockElement('item1');
            const el2 = createMockElement('item2');
            const el3 = createMockElement('item3');
            elements.push(el1, el2, el3);

            focusManager.registerFocusable({
                id: 'item1',
                element: el1,
                group: 'menu',
                neighbors: {},
            });
            focusManager.registerFocusable({
                id: 'item2',
                element: el2,
                group: 'menu',
                neighbors: {},
            });
            focusManager.registerFocusable({
                id: 'item3',
                element: el3,
                group: 'menu',
                neighbors: {},
            });

            const group: FocusGroup = {
                id: 'menu',
                elements: ['item1', 'item2', 'item3'],
                wrapAround: false,
                orientation: 'vertical',
            };
            focusManager.registerFocusGroup(group);

            focusManager.focus('item1');

            // Move down
            let neighbor = focusManager.findNeighbor('item1', 'down');
            expect(neighbor).toBe('item2');

            neighbor = focusManager.findNeighbor('item2', 'down');
            expect(neighbor).toBe('item3');

            // At end, no wrap
            neighbor = focusManager.findNeighbor('item3', 'down');
            expect(neighbor).toBeNull();
        });

        it('should wrap around when enabled', () => {
            const el1 = createMockElement('w1');
            const el2 = createMockElement('w2');
            elements.push(el1, el2);

            focusManager.registerFocusable({
                id: 'w1',
                element: el1,
                group: 'wrap',
                neighbors: {},
            });
            focusManager.registerFocusable({
                id: 'w2',
                element: el2,
                group: 'wrap',
                neighbors: {},
            });

            const group: FocusGroup = {
                id: 'wrap',
                elements: ['w1', 'w2'],
                wrapAround: true,
                orientation: 'vertical',
            };
            focusManager.registerFocusGroup(group);

            // From last, go down should wrap to first
            const neighbor = focusManager.findNeighbor('w2', 'down');
            expect(neighbor).toBe('w1');
        });

        it('should navigate within horizontal group', () => {
            const el1 = createMockElement('h1');
            const el2 = createMockElement('h2');
            elements.push(el1, el2);

            focusManager.registerFocusable({
                id: 'h1',
                element: el1,
                group: 'horiz',
                neighbors: {},
            });
            focusManager.registerFocusable({
                id: 'h2',
                element: el2,
                group: 'horiz',
                neighbors: {},
            });

            const group: FocusGroup = {
                id: 'horiz',
                elements: ['h1', 'h2'],
                wrapAround: false,
                orientation: 'horizontal',
            };
            focusManager.registerFocusGroup(group);

            const neighbor = focusManager.findNeighbor('h1', 'right');
            expect(neighbor).toBe('h2');
        });

        it('should navigate within grid groups by row and column', () => {
            const gridElements = Array.from({ length: 6 }, (_, index) => {
                const el = createMockElement(`grid-${index + 1}`);
                elements.push(el);
                focusManager.registerFocusable({
                    id: el.id,
                    element: el,
                    group: 'grid',
                    neighbors: {},
                });
                return el.id;
            });

            const group: FocusGroup = {
                id: 'grid',
                elements: gridElements,
                wrapAround: false,
                orientation: 'grid',
                columns: 3,
            };
            focusManager.registerFocusGroup(group);

            expect(focusManager.findNeighbor('grid-2', 'down')).toBe('grid-5');
            expect(focusManager.findNeighbor('grid-5', 'up')).toBe('grid-2');
            expect(focusManager.findNeighbor('grid-3', 'right')).toBeNull();
            expect(focusManager.findNeighbor('grid-4', 'left')).toBeNull();
        });
    });

    describe('spatial navigation fallback', () => {
        it('should choose the best visible spatial candidate when no explicit or group neighbor exists', () => {
            const origin = createMockElement('origin');
            const aligned = createMockElement('aligned');
            const offAxis = createMockElement('off-axis');
            elements.push(origin, aligned, offAxis);

            setLayout(origin, rect(100, 100, 50, 50));
            setLayout(aligned, rect(170, 100, 50, 50));
            setLayout(offAxis, rect(155, 210, 50, 50));

            focusManager.registerFocusable({ id: 'origin', element: origin, neighbors: {} });
            focusManager.registerFocusable({ id: 'off-axis', element: offAxis, neighbors: {} });
            focusManager.registerFocusable({ id: 'aligned', element: aligned, neighbors: {} });

            expect(focusManager.findNeighbor('origin', 'right')).toBe('aligned');
        });

        it('should ignore zero-size, hidden, and detached spatial candidates', () => {
            const origin = createMockElement('origin');
            const zeroSize = createMockElement('zero-size');
            const hidden = createMockElement('hidden');
            const detached = createMockElement('detached');
            const visible = createMockElement('visible');
            elements.push(origin, zeroSize, hidden, detached, visible);

            detached.remove();
            setLayout(origin, rect(100, 100, 50, 50));
            setLayout(zeroSize, rect(160, 100, 0, 50));
            setLayout(hidden, rect(165, 100, 50, 50), { visibility: 'hidden' });
            setLayout(detached, rect(170, 100, 50, 50));
            setLayout(visible, rect(230, 100, 50, 50));

            focusManager.registerFocusable({ id: 'origin', element: origin, neighbors: {} });
            focusManager.registerFocusable({ id: 'zero-size', element: zeroSize, neighbors: {} });
            focusManager.registerFocusable({ id: 'hidden', element: hidden, neighbors: {} });
            focusManager.registerFocusable({ id: 'detached', element: detached, neighbors: {} });
            focusManager.registerFocusable({ id: 'visible', element: visible, neighbors: {} });

            expect(focusManager.findNeighbor('origin', 'right')).toBe('visible');
        });

        it('should ignore a zero-size spatial candidate even when it is the only directional candidate', () => {
            const origin = createMockElement('origin');
            const zeroSize = createMockElement('zero-size');
            elements.push(origin, zeroSize);

            setLayout(origin, rect(100, 100, 50, 50));
            setLayout(zeroSize, rect(160, 100, 0, 50));

            focusManager.registerFocusable({ id: 'origin', element: origin, neighbors: {} });
            focusManager.registerFocusable({ id: 'zero-size', element: zeroSize, neighbors: {} });

            expect(focusManager.findNeighbor('origin', 'right')).toBeNull();
        });

        it('should include fixed-position candidates without offsetParent when they have a visible rect', () => {
            const origin = createMockElement('origin');
            const fixed = createMockElement('fixed');
            const regularWithoutParent = createMockElement('regular-without-parent');
            elements.push(origin, fixed, regularWithoutParent);

            setLayout(origin, rect(100, 100, 50, 50));
            setLayout(fixed, rect(170, 100, 50, 50), {
                offsetParent: null,
                position: 'fixed',
            });
            setLayout(regularWithoutParent, rect(160, 100, 50, 50), {
                offsetParent: null,
            });

            focusManager.registerFocusable({ id: 'origin', element: origin, neighbors: {} });
            focusManager.registerFocusable({ id: 'regular-without-parent', element: regularWithoutParent, neighbors: {} });
            focusManager.registerFocusable({ id: 'fixed', element: fixed, neighbors: {} });

            expect(focusManager.findNeighbor('origin', 'right')).toBe('fixed');
        });
    });

    describe('focus memory', () => {
        it('should save and restore focus state', () => {
            const el = createMockElement('btn1');
            elements.push(el);

            focusManager.registerFocusable({ id: 'btn1', element: el, neighbors: {} });
            focusManager.focus('btn1');

            focusManager.saveFocusState('home');
            focusManager.blur();

            const restored = focusManager.restoreFocusState('home');
            expect(restored).toBe(true);
            expect(focusManager.getCurrentFocusId()).toBe('btn1');
        });

        it('should return false when restoring without saved state', () => {
            const restored = focusManager.restoreFocusState('unknown');
            expect(restored).toBe(false);
        });

        it('restores by restoreGroup + highest restorePriority when saved id no longer exists', () => {
            const elSaved = createMockElement('saved');
            const elLow = createMockElement('candidate-low');
            const elHigh = createMockElement('candidate-high');
            elements.push(elSaved, elLow, elHigh);

            focusManager.registerFocusable({
                id: 'saved',
                element: elSaved,
                restoreGroup: 'profile-list',
                restorePriority: 1,
                neighbors: {},
            });
            focusManager.registerFocusable({
                id: 'candidate-low',
                element: elLow,
                restoreGroup: 'profile-list',
                restorePriority: 10,
                neighbors: {},
            });
            focusManager.registerFocusable({
                id: 'candidate-high',
                element: elHigh,
                restoreGroup: 'profile-list',
                restorePriority: 20,
                neighbors: {},
            });

            focusManager.focus('saved');
            focusManager.saveFocusState('home');
            focusManager.unregisterFocusable('saved');

            const restored = focusManager.restoreFocusState('home');
            expect(restored).toBe(true);
            expect(focusManager.getCurrentFocusId()).toBe('candidate-high');
        });

        it('uses id ascending tie-break when restore priorities match', () => {
            const elSaved = createMockElement('saved');
            const elB = createMockElement('btn-b');
            const elA = createMockElement('btn-a');
            elements.push(elSaved, elA, elB);

            focusManager.registerFocusable({
                id: 'saved',
                element: elSaved,
                restoreGroup: 'server-list',
                restorePriority: 5,
                neighbors: {},
            });
            focusManager.registerFocusable({
                id: 'btn-b',
                element: elB,
                restoreGroup: 'server-list',
                restorePriority: 10,
                neighbors: {},
            });
            focusManager.registerFocusable({
                id: 'btn-a',
                element: elA,
                restoreGroup: 'server-list',
                restorePriority: 10,
                neighbors: {},
            });

            focusManager.focus('saved');
            focusManager.saveFocusState('server-select');
            focusManager.unregisterFocusable('saved');

            const restored = focusManager.restoreFocusState('server-select');
            expect(restored).toBe(true);
            expect(focusManager.getCurrentFocusId()).toBe('btn-a');
        });
    });

    describe('modal focus', () => {
        it('should save and restore pre-modal focus', () => {
            const el = createMockElement('btn1');
            elements.push(el);

            focusManager.registerFocusable({ id: 'btn1', element: el, neighbors: {} });
            focusManager.focus('btn1');

            focusManager.savePreModalFocus();
            focusManager.blur();

            const restored = focusManager.restorePreModalFocus();
            expect(restored).toBe(true);
            expect(focusManager.getCurrentFocusId()).toBe('btn1');
        });
    });

    describe('unregister', () => {
        it('should clear focus on unregister of focused element', () => {
            const el = createMockElement('btn1');
            elements.push(el);

            focusManager.registerFocusable({ id: 'btn1', element: el, neighbors: {} });
            focusManager.focus('btn1');

            focusManager.unregisterFocusable('btn1');

            expect(focusManager.getCurrentFocusId()).toBeNull();
        });
    });
});
