import type { INavigationManager } from '../../../navigation/interfaces';

export interface FocusCoordinatorDeps {
    getNavigation: () => INavigationManager | null;
}

export type FocusRegistrationMode = 'linear' | 'spatial';
