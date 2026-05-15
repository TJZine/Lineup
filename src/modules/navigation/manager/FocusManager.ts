import { IFocusManager, FocusableElement, FocusGroup } from '../contracts/interfaces';
import { FOCUS_CLASSES } from '../config/constants';

interface FocusManagerState {
    currentFocusId: string | null;
    focusableElements: Map<string, FocusableElement>;
    focusGroups: Map<string, FocusGroup>;
    focusMemory: Map<string, { id: string; restoreGroup?: string; restorePriority?: number }>;
    preFocusIdBeforeModal: string | null;
}

export class FocusManager implements IFocusManager {
    private _state: FocusManagerState;

    constructor() {
        this._state = {
            currentFocusId: null,
            focusableElements: new Map(),
            focusGroups: new Map(),
            focusMemory: new Map(),
            preFocusIdBeforeModal: null,
        };
    }

    public getCurrentFocusId(): string | null {
        return this._state.currentFocusId;
    }

    public getFocusedElement(): FocusableElement | null {
        if (!this._state.currentFocusId) {
            return null;
        }
        const element = this._state.focusableElements.get(this._state.currentFocusId);
        return element !== undefined ? element : null;
    }

    public getElement(elementId: string): FocusableElement | null {
        const element = this._state.focusableElements.get(elementId);
        return element !== undefined ? element : null;
    }

    public registerFocusable(element: FocusableElement): void {
        this._state.focusableElements.set(element.id, element);
        element.element.tabIndex = -1;
        element.element.classList.add(FOCUS_CLASSES.FOCUSABLE);
    }

    public unregisterFocusable(elementId: string): void {
        const element = this._state.focusableElements.get(elementId);
        if (element) {
            element.element.classList.remove(FOCUS_CLASSES.FOCUSABLE);
            element.element.classList.remove(FOCUS_CLASSES.FOCUSED);
        }
        this._state.focusableElements.delete(elementId);

        if (this._state.currentFocusId === elementId) {
            this._state.currentFocusId = null;
        }
    }

    public registerFocusGroup(group: FocusGroup): void {
        this._state.focusGroups.set(group.id, group);
    }

    public unregisterFocusGroup(groupId: string): void {
        this._state.focusGroups.delete(groupId);
    }

    public focus(elementId: string): boolean {
        const element = this._state.focusableElements.get(elementId);
        if (!element) {
            return false;
        }

        const previousId = this._state.currentFocusId;
        if (previousId && previousId !== elementId) {
            this.blur();
        }

        this._state.currentFocusId = elementId;
        element.element.classList.add(FOCUS_CLASSES.FOCUSED);
        this.updateFocusRing(elementId);

        if (element.onFocus) {
            element.onFocus();
        }

        return true;
    }

    public blur(): void {
        const currentId = this._state.currentFocusId;
        if (!currentId) {
            return;
        }

        const element = this._state.focusableElements.get(currentId);
        if (element) {
            element.element.classList.remove(FOCUS_CLASSES.FOCUSED);

            if (element.onBlur) {
                element.onBlur();
            }
        }

        this.hideFocusRing();
        this._state.currentFocusId = null;
    }

    public findNeighbor(
        fromId: string,
        direction: 'up' | 'down' | 'left' | 'right'
    ): string | null {
        const fromElement = this._state.focusableElements.get(fromId);
        if (!fromElement) {
            return null;
        }

        const explicitNeighbor = fromElement.neighbors[direction];
        if (explicitNeighbor !== undefined) {
            if (this._state.focusableElements.has(explicitNeighbor)) {
                return explicitNeighbor;
            }
        }

        const groupId = fromElement.group;
        if (groupId !== undefined) {
            const group = this._state.focusGroups.get(groupId);
            if (group) {
                const groupNeighbor = this._findNextInGroup(fromId, direction, group);
                if (groupNeighbor) {
                    return groupNeighbor;
                }
            }
        }

        return this._calculateSpatialNeighbor(fromId, direction);
    }

    public saveFocusState(screenId: string): void {
        const currentFocusId = this._state.currentFocusId;
        if (!currentFocusId) {
            return;
        }
        const focused = this._state.focusableElements.get(currentFocusId);
        if (!focused) {
            return;
        }
        const record: { id: string; restoreGroup?: string; restorePriority?: number } = {
            id: focused.id,
        };
        if (focused.restoreGroup !== undefined) {
            record.restoreGroup = focused.restoreGroup;
        }
        if (focused.restorePriority !== undefined) {
            record.restorePriority = focused.restorePriority;
        }
        this._state.focusMemory.set(screenId, record);
    }

    public restoreFocusState(screenId: string): boolean {
        const saved = this._state.focusMemory.get(screenId);
        if (!saved) {
            return false;
        }
        if (this._state.focusableElements.has(saved.id)) {
            return this.focus(saved.id);
        }
        if (saved.restoreGroup) {
            let bestCandidateId: string | null = null;
            let bestPriority = Number.NEGATIVE_INFINITY;
            this._state.focusableElements.forEach((candidate) => {
                if (candidate.restoreGroup !== saved.restoreGroup) {
                    return;
                }
                const candidatePriority = candidate.restorePriority ?? 0;
                if (candidatePriority > bestPriority) {
                    bestCandidateId = candidate.id;
                    bestPriority = candidatePriority;
                    return;
                }
                if (candidatePriority === bestPriority && bestCandidateId !== null && candidate.id.localeCompare(bestCandidateId) < 0) {
                    bestCandidateId = candidate.id;
                }
            });
            if (bestCandidateId) {
                return this.focus(bestCandidateId);
            }
        }
        return false;
    }

    public savePreModalFocus(): void {
        this._state.preFocusIdBeforeModal = this._state.currentFocusId;
    }

    public restorePreModalFocus(): boolean {
        const preModalId = this._state.preFocusIdBeforeModal;
        this._state.preFocusIdBeforeModal = null;

        if (preModalId && this._state.focusableElements.has(preModalId)) {
            return this.focus(preModalId);
        }
        return false;
    }

    public updateFocusRing(elementId: string): void {
        const element = this._state.focusableElements.get(elementId);
        if (element) {
            if (element.preventScrollOnFocus === true) {
                element.element.focus({ preventScroll: true });
                return;
            }
            element.element.focus();
        }
    }

    public hideFocusRing(): void {
    }

    public clear(): void {
        this._state.focusableElements.forEach((element) => {
            element.element.classList.remove(FOCUS_CLASSES.FOCUSABLE);
            element.element.classList.remove(FOCUS_CLASSES.FOCUSED);
        });

        this._state.currentFocusId = null;
        this._state.focusableElements.clear();
        this._state.focusGroups.clear();
        // Note: focusMemory and preFocusIdBeforeModal are intentionally preserved
        // to maintain focus state across screen transitions and modal cycles.
    }

    private _findNextInGroup(
        currentId: string,
        direction: 'up' | 'down' | 'left' | 'right',
        group: FocusGroup
    ): string | null {
        const currentIndex = group.elements.indexOf(currentId);
        if (currentIndex === -1) {
            return null;
        }

        if (group.orientation === 'grid' && group.columns !== undefined) {
            return this._navigateGrid(currentIndex, direction, group);
        }

        const isVertical = group.orientation === 'vertical';
        const isPrimary =
            (isVertical && (direction === 'up' || direction === 'down')) ||
            (!isVertical && (direction === 'left' || direction === 'right'));

        if (!isPrimary) {
            return null;
        }

        const isForward = direction === 'down' || direction === 'right';
        let nextIndex: number;

        if (isForward) {
            nextIndex = currentIndex + 1;
            if (nextIndex >= group.elements.length) {
                nextIndex = group.wrapAround ? 0 : -1;
            }
        } else {
            nextIndex = currentIndex - 1;
            if (nextIndex < 0) {
                nextIndex = group.wrapAround ? group.elements.length - 1 : -1;
            }
        }

        if (nextIndex === -1) {
            return null;
        }

        const nextElement = group.elements[nextIndex];
        return nextElement !== undefined ? nextElement : null;
    }

    private _navigateGrid(
        currentIndex: number,
        direction: 'up' | 'down' | 'left' | 'right',
        group: FocusGroup
    ): string | null {
        if (group.columns === undefined) {
            return null;
        }

        const cols = group.columns;
        const row = Math.floor(currentIndex / cols);
        const col = currentIndex % cols;
        const totalRows = Math.ceil(group.elements.length / cols);

        let targetIndex: number;

        switch (direction) {
            case 'left':
                if (col === 0) {
                    if (group.wrapAround) {
                        targetIndex = currentIndex + cols - 1;
                        if (targetIndex >= group.elements.length) {
                            targetIndex = group.elements.length - 1;
                        }
                    } else {
                        return null;
                    }
                } else {
                    targetIndex = currentIndex - 1;
                }
                break;
            case 'right':
                if (col === cols - 1 || currentIndex === group.elements.length - 1) {
                    if (group.wrapAround) {
                        targetIndex = row * cols;
                    } else {
                        return null;
                    }
                } else {
                    targetIndex = currentIndex + 1;
                }
                break;
            case 'up':
                if (row === 0) {
                    if (group.wrapAround) {
                        targetIndex = (totalRows - 1) * cols + col;
                        if (targetIndex >= group.elements.length) {
                            targetIndex = group.elements.length - 1;
                        }
                    } else {
                        return null;
                    }
                } else {
                    targetIndex = currentIndex - cols;
                }
                break;
            case 'down':
                if (row === totalRows - 1) {
                    if (group.wrapAround) {
                        targetIndex = col;
                    } else {
                        return null;
                    }
                } else {
                    targetIndex = currentIndex + cols;
                    if (targetIndex >= group.elements.length) {
                        return null;
                    }
                }
                break;
        }

        if (targetIndex < 0 || targetIndex >= group.elements.length) {
            return null;
        }

        const targetElement = group.elements[targetIndex];
        return targetElement !== undefined ? targetElement : null;
    }

    private _calculateSpatialNeighbor(
        fromId: string,
        direction: 'up' | 'down' | 'left' | 'right'
    ): string | null {
        const fromElement = this._state.focusableElements.get(fromId);
        if (!fromElement) {
            return null;
        }

        const fromRect = fromElement.element.getBoundingClientRect();
        let bestCandidateId: string | null = null;
        let bestScore = -Infinity;

        this._state.focusableElements.forEach((element, id) => {
            if (id === fromId) {
                return;
            }

            const rect = element.element.getBoundingClientRect();

            if (!this._isVisible(element.element, rect)) {
                return;
            }

            if (!this._isInDirection(fromRect, rect, direction)) {
                return;
            }

            const overlap = this._calculateOverlap(fromRect, rect, direction);
            const distance = this._calculateDistance(fromRect, rect, direction);

            // Prefer candidates aligned on the perpendicular axis, then nearer
            // candidates in the requested direction.
            const score = overlap * 1000 - distance;

            if (score > bestScore) {
                bestScore = score;
                bestCandidateId = id;
            }
        });

        return bestCandidateId;
    }

    private _isVisible(element: HTMLElement, rect?: DOMRect): boolean {
        const resolvedRect = rect ?? element.getBoundingClientRect();
        if (resolvedRect.width <= 0 || resolvedRect.height <= 0 || !element.isConnected) {
            return false;
        }

        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
        }

        // Fixed-position overlays have no offsetParent in browsers but still
        // participate in spatial focus when they have a visible rect.
        return element.offsetParent !== null || style.position === 'fixed';
    }

    private _isInDirection(
        fromRect: DOMRect,
        toRect: DOMRect,
        direction: 'up' | 'down' | 'left' | 'right'
    ): boolean {
        const fromCenter = {
            x: fromRect.left + fromRect.width / 2,
            y: fromRect.top + fromRect.height / 2,
        };
        const toCenter = {
            x: toRect.left + toRect.width / 2,
            y: toRect.top + toRect.height / 2,
        };

        switch (direction) {
            case 'up':
                return toCenter.y < fromCenter.y;
            case 'down':
                return toCenter.y > fromCenter.y;
            case 'left':
                return toCenter.x < fromCenter.x;
            case 'right':
                return toCenter.x > fromCenter.x;
        }
    }

    private _calculateOverlap(
        fromRect: DOMRect,
        toRect: DOMRect,
        direction: 'up' | 'down' | 'left' | 'right'
    ): number {
        if (direction === 'up' || direction === 'down') {
            const overlapStart = Math.max(fromRect.left, toRect.left);
            const overlapEnd = Math.min(fromRect.right, toRect.right);
            const overlap = Math.max(0, overlapEnd - overlapStart);
            const maxWidth = Math.min(fromRect.width, toRect.width);
            return maxWidth > 0 ? overlap / maxWidth : 0;
        } else {
            const overlapStart = Math.max(fromRect.top, toRect.top);
            const overlapEnd = Math.min(fromRect.bottom, toRect.bottom);
            const overlap = Math.max(0, overlapEnd - overlapStart);
            const maxHeight = Math.min(fromRect.height, toRect.height);
            return maxHeight > 0 ? overlap / maxHeight : 0;
        }
    }

    private _calculateDistance(
        fromRect: DOMRect,
        toRect: DOMRect,
        direction: 'up' | 'down' | 'left' | 'right'
    ): number {
        switch (direction) {
            case 'up':
                return fromRect.top - toRect.bottom;
            case 'down':
                return toRect.top - fromRect.bottom;
            case 'left':
                return fromRect.left - toRect.right;
            case 'right':
                return toRect.left - fromRect.right;
        }
    }
}
