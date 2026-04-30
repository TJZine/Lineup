export type StubFocusable = {
    id: string;
    neighbors: { up?: string; down?: string; left?: string; right?: string };
    onFocus?: () => void;
    onSelect?: () => void;
};

export const createNavigationStub = (): {
    focusables: Map<string, StubFocusable>;
    registerFocusable: jest.Mock;
    unregisterFocusable: jest.Mock;
    setFocus: jest.Mock;
    getFocusedElement: jest.Mock;
    on: jest.Mock;
    off: jest.Mock;
} => {
    const focusables = new Map<string, StubFocusable>();
    let focusedId: string | null = null;

    return {
        focusables,
        registerFocusable: jest.fn((element: StubFocusable) => {
            focusables.set(element.id, element);
        }),
        unregisterFocusable: jest.fn((id: string) => {
            focusables.delete(id);
        }),
        setFocus: jest.fn((id: string) => {
            focusedId = id;
            focusables.get(id)?.onFocus?.();
        }),
        getFocusedElement: jest.fn(() => (focusedId ? ({ id: focusedId } as HTMLElement) : null)),
        on: jest.fn(),
        off: jest.fn(),
    };
};

export const activateCategory = (container: HTMLElement, categoryId: string): void => {
    const button = container.querySelector(`#settings-category-${categoryId}`) as HTMLButtonElement | null;
    if (!button) {
        throw new Error(`Category ${categoryId} not found`);
    }
    button.click();
};
