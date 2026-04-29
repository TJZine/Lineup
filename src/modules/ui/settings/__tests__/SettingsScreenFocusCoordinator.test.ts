/**
 * @jest-environment jsdom
 */

import type { FocusableElement, INavigationManager, KeyEvent } from '../../../navigation';
import { SettingsScreenFocusCoordinator } from '../SettingsScreenFocusCoordinator';
import type { SettingsCategoryConfig, SettingsCategoryId, SettingsSelectOption } from '../types';

let lastDropdownConfig: {
    onDismiss: () => void;
} | null = null;
let dropdownHandle: { destroy: jest.Mock; dismiss: jest.Mock } | null = null;

jest.mock('../SettingsDropdown', () => ({
    createSettingsDropdown: jest.fn((config: { onDismiss: () => void }) => {
        lastDropdownConfig = config;
        dropdownHandle = {
            destroy: jest.fn(),
            dismiss: jest.fn(() => config.onDismiss()),
        };
        return dropdownHandle;
    }),
}));

type ToggleControl = {
    element: HTMLButtonElement;
    update: (value: boolean) => void;
    setDisabled: (disabled: boolean) => void;
    isDisabled: () => boolean;
    getId: () => string;
};

type SelectControl = {
    element: HTMLButtonElement;
    update: (value: number) => void;
    setDisabled: (disabled: boolean) => void;
    isDisabled: () => boolean;
    getId: () => string;
    getOptions: () => SettingsSelectOption[];
    getValue: () => number;
    setValue: (value: number) => boolean;
    cyclePrev: () => boolean;
    cycleNext: () => boolean;
};

type NavigationTestDouble = {
    focusables: Map<string, FocusableElement>;
    keyHandler: ((event: KeyEvent) => void) | null;
    registerFocusable: jest.Mock<void, [FocusableElement]>;
    unregisterFocusable: jest.Mock<void, [string]>;
    setFocus: jest.Mock<void, [string]>;
    getFocusedElement: jest.Mock<FocusableElement | null, []>;
    on: jest.Mock<void, [string, (event: KeyEvent) => void]>;
    off: jest.Mock;
};

const createNavigation = (): NavigationTestDouble => {
    const focusables = new Map<string, FocusableElement>();
    let focusedId: string | null = null;
    const navigation = {
        focusables,
        keyHandler: null as ((event: KeyEvent) => void) | null,
        registerFocusable: jest.fn((focusable: FocusableElement) => {
            focusables.set(focusable.id, focusable);
        }),
        unregisterFocusable: jest.fn((id: string) => {
            focusables.delete(id);
        }),
        setFocus: jest.fn((id: string) => {
            focusedId = id;
            focusables.get(id)?.onFocus?.();
        }),
        getFocusedElement: jest.fn(() => {
            if (!focusedId) {
                return null;
            }
            return focusables.get(focusedId) ?? {
                id: focusedId,
                element: document.createElement('button'),
                neighbors: {},
            };
        }),
        on: jest.fn((event: string, handler: (event: KeyEvent) => void) => {
            if (event === 'keyPress') {
                navigation.keyHandler = handler;
            }
        }),
        off: jest.fn(),
    };
    return navigation;
};

const createButton = (id: string): HTMLButtonElement => {
    const button = document.createElement('button');
    button.id = id;
    document.body.appendChild(button);
    return button;
};

describe('SettingsScreenFocusCoordinator', () => {
    let container: HTMLElement;
    let navigation: ReturnType<typeof createNavigation>;
    let categories: SettingsCategoryConfig[];
    let activeCategoryId: SettingsCategoryId;
    let categoryButtons: Map<SettingsCategoryId, HTMLButtonElement>;
    let toggles: Map<string, ToggleControl>;
    let selects: Map<string, SelectControl>;

    beforeEach(() => {
        document.body.innerHTML = '';
        lastDropdownConfig = null;
        dropdownHandle = null;
        container = document.createElement('div');
        document.body.appendChild(container);
        navigation = createNavigation();
        activeCategoryId = 'audio_subtitles';
        categories = [
            {
                id: 'audio_subtitles',
                label: 'Audio',
                items: [
                    { id: 'settings-audio-old', label: 'Old', value: false, onChange: jest.fn() },
                    { id: 'settings-audio-new', label: 'New', value: false, onChange: jest.fn() },
                ],
            },
            {
                id: 'appearance',
                label: 'Appearance',
                items: [
                    {
                        id: 'settings-appearance-select',
                        label: 'Select',
                        value: 1,
                        options: [{ label: 'One', value: 1 }],
                        onChange: jest.fn(),
                    },
                ],
            },
        ];
        categoryButtons = new Map(
            categories.map((category) => [category.id, createButton(`settings-category-${category.id}`)])
        );
        toggles = new Map([
            ['settings-audio-old', {
                element: createButton('settings-audio-old'),
                update: jest.fn(),
                setDisabled: jest.fn(),
                isDisabled: (): boolean => false,
                getId: (): string => 'settings-audio-old',
            }],
            ['settings-audio-new', {
                element: createButton('settings-audio-new'),
                update: jest.fn(),
                setDisabled: jest.fn(),
                isDisabled: (): boolean => false,
                getId: (): string => 'settings-audio-new',
            }],
        ]);
        selects = new Map([
            ['settings-appearance-select', {
                element: createButton('settings-appearance-select'),
                update: jest.fn(),
                setDisabled: jest.fn(),
                isDisabled: (): boolean => false,
                getId: (): string => 'settings-appearance-select',
                getOptions: (): SettingsSelectOption[] => [{ label: 'One', value: 1 }],
                getValue: (): number => 1,
                setValue: jest.fn((): boolean => true),
                cyclePrev: jest.fn((): boolean => true),
                cycleNext: jest.fn((): boolean => true),
            }],
        ]);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    const createCoordinator = (): SettingsScreenFocusCoordinator =>
        new SettingsScreenFocusCoordinator({
            container,
            getNavigation: () => navigation as unknown as INavigationManager,
            getCategories: () => categories,
            getActiveCategoryId: () => activeCategoryId,
            getActiveCategoryItemIds: () =>
                categories.find((category) => category.id === activeCategoryId)?.items.map((item) => item.id) ?? [],
            getCategoryButton: (categoryId) => categoryButtons.get(categoryId) ?? null,
            getSwitchProfileButton: () => null,
            getToggle: (id) => toggles.get(id),
            getSelect: (id) => selects.get(id),
            setActiveCategory: (categoryId): void => {
                activeCategoryId = categoryId;
            },
            isVisible: () => true,
            isDeferredDetailSwapActive: () => false,
        });

    it('falls back when remembered category detail focus no longer belongs to that category', () => {
        const coordinator = createCoordinator();

        coordinator.registerFocusables();
        navigation.setFocus('settings-audio-old');
        categories = [{
            id: 'audio_subtitles',
            label: 'Audio',
            items: [{ id: 'settings-audio-new', label: 'New', value: false, onChange: jest.fn() }],
        }];

        expect(
            coordinator.resolveCategoryChangePreferredFocus('audio_subtitles', { focusDetail: true })
        ).toBe('settings-audio-new');
    });

    it('clears dropdown ownership when the dropdown dismiss callback runs', () => {
        const coordinator = createCoordinator();
        activeCategoryId = 'appearance';

        coordinator.attachKeyHandler();
        coordinator.openDropdownForSelect('settings-appearance-select');
        expect(lastDropdownConfig).not.toBeNull();

        lastDropdownConfig?.onDismiss();
        const backEvent = { handled: false, button: 'back' } as KeyEvent;
        navigation.keyHandler?.(backEvent);

        expect(backEvent.handled).toBe(false);
        expect(dropdownHandle?.dismiss).not.toHaveBeenCalled();
        expect(navigation.setFocus).toHaveBeenCalledWith('settings-appearance-select');
    });
});
