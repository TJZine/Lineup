import { NavigationFocusPolicy } from '../NavigationFocusPolicy';

describe('NavigationFocusPolicy', () => {
    let policy: NavigationFocusPolicy;

    beforeEach(() => {
        policy = new NavigationFocusPolicy();
    });

    it('allows movement when neighbor exists and no modal is open', () => {
        const result = policy.evaluateMove({
            neighborId: 'btn-2',
            modalStack: [],
            modalFocusableIds: new Map(),
        });

        expect(result).toEqual({
            allowed: true,
            targetId: 'btn-2',
            reason: null,
        });
    });

    it('blocks movement when modal trap excludes the neighbor', () => {
        const result = policy.evaluateMove({
            neighborId: 'outside',
            modalStack: ['confirm-modal'],
            modalFocusableIds: new Map([['confirm-modal', ['inside-a', 'inside-b']]]),
        });

        expect(result).toEqual({
            allowed: false,
            targetId: null,
            reason: 'modal_open',
        });
    });

    it('allows movement when modal trap includes the neighbor', () => {
        const result = policy.evaluateMove({
            neighborId: 'inside-a',
            modalStack: ['confirm-modal'],
            modalFocusableIds: new Map([['confirm-modal', ['inside-a', 'inside-b']]]),
        });

        expect(result).toEqual({
            allowed: true,
            targetId: 'inside-a',
            reason: null,
        });
    });

    it('blocks movement when modal is open without registered focusables', () => {
        const result = policy.evaluateMove({
            neighborId: 'any-target',
            modalStack: ['confirm-modal'],
            modalFocusableIds: new Map(),
        });

        expect(result).toEqual({
            allowed: false,
            targetId: null,
            reason: 'modal_open',
        });
    });

    it('blocks movement when modal stack has an invalid top modal id', () => {
        const result = policy.evaluateMove({
            neighborId: 'btn-2',
            modalStack: [''],
            modalFocusableIds: new Map(),
        });

        expect(result).toEqual({
            allowed: false,
            targetId: null,
            reason: 'modal_open',
        });
    });

    it('returns reason tagging for no-neighbor cases', () => {
        const result = policy.evaluateMove({
            neighborId: null,
            modalStack: [],
            modalFocusableIds: new Map(),
        });

        expect(result).toEqual({
            allowed: false,
            targetId: null,
            reason: 'no_neighbor',
        });
    });
});
