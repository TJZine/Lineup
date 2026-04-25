import type { INavigationManager } from '../../../navigation/interfaces';

export interface FocusCoordinatorDeps {
    getNavigation: () => INavigationManager | null;
}

export type FocusRegistrationMode = 'linear' | 'spatial';

export interface RegisterStep2FocusOptions {
    categoryButtons: HTMLButtonElement[];
    detailButtons: HTMLButtonElement[];
    footerButtons: HTMLButtonElement[];
    activeCategoryId: string;
    detailFocusTarget: string | null;
    preferredFocusId: string | null;
    onDetailFocus: (id: string) => void;
}
