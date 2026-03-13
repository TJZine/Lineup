export type NavigationFocusSuppressionReason = 'modal_open' | 'no_neighbor';

export interface EvaluateFocusMoveInput {
    neighborId: string | null;
    modalStack: string[];
    modalFocusableIds: Map<string, string[]>;
}

export interface EvaluateFocusMoveResult {
    allowed: boolean;
    targetId: string | null;
    reason: NavigationFocusSuppressionReason | null;
}

/**
 * Pure policy owner for directional focus movement decisions.
 */
export class NavigationFocusPolicy {
    public evaluateMove(input: EvaluateFocusMoveInput): EvaluateFocusMoveResult {
        const { neighborId, modalStack, modalFocusableIds } = input;
        if (!neighborId) {
            return { allowed: false, targetId: null, reason: 'no_neighbor' };
        }

        if (modalStack.length === 0) {
            return { allowed: true, targetId: neighborId, reason: null };
        }

        const topModalId = modalStack[modalStack.length - 1];
        if (!topModalId) {
            return { allowed: true, targetId: neighborId, reason: null };
        }

        const modalFocusables = modalFocusableIds.get(topModalId);
        if (!modalFocusables || modalFocusables.length === 0) {
            return { allowed: false, targetId: null, reason: 'modal_open' };
        }

        if (modalFocusables.indexOf(neighborId) === -1) {
            return { allowed: false, targetId: null, reason: 'modal_open' };
        }

        return { allowed: true, targetId: neighborId, reason: null };
    }
}
