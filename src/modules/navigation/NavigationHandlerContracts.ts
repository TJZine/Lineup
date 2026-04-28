import type { KeyEvent, Screen } from './interfaces';
import type {
    NavigationFourWayDirection,
    NavigationVerticalDirection,
} from './NavigationFeaturePorts';

export type NavigationRepeatStopReason =
    | 'inputBlocked'
    | 'keyup'
    | 'nonDirectional'
    | 'directionChange'
    | 'restart'
    | 'notVisible'
    | 'modalOpen'
    | 'noButton'
    | 'blocked'
    | 'guide'
    | 'screenChange'
    | 'ok'
    | 'back';

export type EpgStopReason =
    | NavigationRepeatStopReason
    | 'play'
    | 'channelPage';

export type MiniGuideStopReason =
    | NavigationRepeatStopReason
    | 'page'
    | 'right'
    | 'notPlayer';

export interface NavigationRepeatRuntime {
    stopForKeyUp(button: KeyEvent['button']): void;
    stopForNonDirectionalInput(event: KeyEvent): void;
    stopEpgRepeat(reason: EpgStopReason): void;
    startEpgRepeat(button: NavigationFourWayDirection): void;
    stopEpgRepeatForDirectionChange(button: NavigationFourWayDirection): void;
    stopMiniGuideRepeat(reason: MiniGuideStopReason): void;
    startMiniGuideRepeat(button: NavigationVerticalDirection): void;
    stopMiniGuideRepeatForDirectionChange(button: NavigationVerticalDirection): void;
    hasMiniGuideRepeatButton(): boolean;
}

export interface NavigationKeyModeRouterRuntime {
    handleLongPressBack(): void;
    handleKeyPress(event: KeyEvent): void;
}

export interface NavigationScreenEffectsRuntime {
    handleScreenChange(from: Screen, to: Screen): void;
}

export interface NavigationModalEffectsRuntime {
    handleModalOpen(modalId: string): void;
    handleModalClose(modalId: string): void;
}

export interface NavigationChannelNumberHandlerRuntime {
    handleChannelNumberEntered(channelNumber: number): Promise<void>;
}
