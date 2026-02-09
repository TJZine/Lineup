export type ScreenTone = 'neutral' | 'loading' | 'success' | 'warning' | 'error';

export type ScreenActionVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

export interface ScreenAction {
    id: string;
    label: string;
    variant: ScreenActionVariant;
    disabled?: boolean;
    onSelect: () => void;
}

export interface ScreenStatus {
    title: string;
    detail?: string;
    tone: ScreenTone;
    ariaLive?: 'polite' | 'assertive';
}

export interface ScreenError {
    title: string;
    message?: string;
    recoveryHint?: string;
}

export interface ScreenShellProps {
    title: string;
    subtitle?: string;
    heroSlot?: HTMLElement | null;
    status?: ScreenStatus | null;
    error?: ScreenError | null;
    actions: ScreenAction[];
    footerHint?: string;
}
