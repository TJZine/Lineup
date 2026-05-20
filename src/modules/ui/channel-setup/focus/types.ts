import type { INavigationManager } from '../../../navigation/contracts/interfaces';

export interface FocusCoordinatorDeps {
    getNavigation: () => INavigationManager | null;
}

export type FocusRegistrationMode = 'linear' | 'spatial';

export interface RegisterLibraryStepFocusOptions {
    selectAllButton: HTMLButtonElement;
    clearAllButton: HTMLButtonElement;
    listButtons: HTMLButtonElement[];
    footerButtons: HTMLButtonElement[];
    preferredFocusId: string | null;
}

export interface RegisterStep2FocusOptions {
    categoryButtons: HTMLButtonElement[];
    detailButtons: HTMLButtonElement[];
    footerButtons: HTMLButtonElement[];
    activeCategoryId: string;
    detailFocusTarget: string | null;
    preferredFocusId: string | null;
    onFocus?: (id: string) => void;
    onDetailFocus: (id: string) => void;
}
