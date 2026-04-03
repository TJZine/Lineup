import type { INavigationManager } from '../../navigation';

export interface ChannelSetupScreenPorts {
    getNavigation(): INavigationManager | null;
    getSelectedServerStorageKey(): string;
    getServerHealthStorageKey(): string;
    getSelectedServerId(): string | null;
    openServerSelect(): void;
    switchToChannelByNumber(number: number, options?: { signal?: AbortSignal }): Promise<void>;
    openEPG(): void;
}
