import type { INavigationManager, KeyEvent } from '../contracts/interfaces';
import type {
    EpgStopReason,
    MiniGuideStopReason,
    NavigationRepeatRuntime,
} from '../contracts/NavigationHandlerContracts';
import {
    computeAcceleratedRepeatIntervalMs,
    EPG_REPEAT_TIMING,
    MINI_GUIDE_REPEAT_TIMING,
} from '../config/constants';
import type {
    NavigationEpgPort,
    NavigationFourWayDirection,
    NavigationMiniGuidePort,
    NavigationVerticalDirection,
} from '../contracts/NavigationFeaturePorts';

export interface NavigationRepeatHandlerPort {
    navigation: INavigationManager;
    epg: NavigationEpgPort | null;
    miniGuide: NavigationMiniGuidePort;
}

export class NavigationRepeatHandler implements NavigationRepeatRuntime {
    private _epgRepeatTimer: ReturnType<typeof setTimeout> | null = null;
    private _epgRepeatButton: NavigationFourWayDirection | null = null;
    private _epgRepeatStartMs = 0;
    private _miniGuideRepeatTimer: ReturnType<typeof setTimeout> | null = null;
    private _miniGuideRepeatButton: NavigationVerticalDirection | null = null;
    private _miniGuideRepeatStartMs = 0;

    constructor(private readonly deps: NavigationRepeatHandlerPort) { }

    stopForKeyUp(button: KeyEvent['button']): void {
        if (button === this._epgRepeatButton) {
            this.stopEpgRepeat('keyup');
        }
        if (button === this._miniGuideRepeatButton) {
            this.stopMiniGuideRepeat('keyup');
        }
    }

    stopForNonDirectionalInput(event: KeyEvent): void {
        if (this._epgRepeatButton && !this._isDirectionalButton(event.button)) {
            this.stopEpgRepeat('nonDirectional');
        }
        if (this._miniGuideRepeatButton && !this._isDirectionalButton(event.button)) {
            this.stopMiniGuideRepeat('nonDirectional');
        }
    }

    stopEpgRepeat(_reason: EpgStopReason): void {
        if (this._epgRepeatTimer !== null) {
            clearTimeout(this._epgRepeatTimer);
            this._epgRepeatTimer = null;
        }
        this._epgRepeatButton = null;
        this._epgRepeatStartMs = 0;
    }

    startEpgRepeat(button: NavigationFourWayDirection): void {
        this.stopEpgRepeat('restart');
        this._epgRepeatButton = button;
        this._epgRepeatStartMs = Date.now();
        this._epgRepeatTimer = setTimeout(
            () => this._scheduleNextEpgRepeatTick(),
            EPG_REPEAT_TIMING.INITIAL_DELAY_MS
        );
    }

    stopEpgRepeatForDirectionChange(button: NavigationFourWayDirection): void {
        if (this._epgRepeatButton && this._epgRepeatButton !== button) {
            this.stopEpgRepeat('directionChange');
        }
    }

    stopMiniGuideRepeat(_reason: MiniGuideStopReason): void {
        if (this._miniGuideRepeatTimer !== null) {
            clearTimeout(this._miniGuideRepeatTimer);
            this._miniGuideRepeatTimer = null;
        }
        this._miniGuideRepeatButton = null;
        this._miniGuideRepeatStartMs = 0;
    }

    startMiniGuideRepeat(button: NavigationVerticalDirection): void {
        this.stopMiniGuideRepeat('restart');
        this._miniGuideRepeatButton = button;
        this._miniGuideRepeatStartMs = Date.now();
        this._miniGuideRepeatTimer = setTimeout(
            () => this._scheduleNextMiniGuideRepeatTick(),
            MINI_GUIDE_REPEAT_TIMING.INITIAL_DELAY_MS
        );
    }

    stopMiniGuideRepeatForDirectionChange(button: NavigationVerticalDirection): void {
        if (this._miniGuideRepeatButton && this._miniGuideRepeatButton !== button) {
            this.stopMiniGuideRepeat('directionChange');
        }
    }

    hasMiniGuideRepeatButton(): boolean {
        return this._miniGuideRepeatButton !== null;
    }

    private _scheduleNextEpgRepeatTick(): void {
        const epg = this.deps.epg;
        const navigation = this.deps.navigation;

        if (!epg || !epg.isVisible()) {
            this.stopEpgRepeat('notVisible');
            return;
        }
        if (navigation.isModalOpen()) {
            this.stopEpgRepeat('modalOpen');
            return;
        }
        if (navigation.isInputBlocked()) {
            this.stopEpgRepeat('inputBlocked');
            return;
        }
        const currentScreen = navigation.getCurrentScreen();
        if (currentScreen !== 'player' && currentScreen !== 'guide') {
            this.stopEpgRepeat('screenChange');
            return;
        }
        if (!this._epgRepeatButton) {
            this.stopEpgRepeat('noButton');
            return;
        }

        const moved = epg.handleNavigation(this._epgRepeatButton);
        if (!moved) {
            this.stopEpgRepeat('blocked');
            return;
        }

        const heldMs = Date.now() - this._epgRepeatStartMs;
        const interval = computeAcceleratedRepeatIntervalMs(heldMs, EPG_REPEAT_TIMING);
        this._epgRepeatTimer = setTimeout(
            () => this._scheduleNextEpgRepeatTick(),
            interval
        );
    }

    private _scheduleNextMiniGuideRepeatTick(): void {
        const navigation = this.deps.navigation;
        if (navigation.isModalOpen()) {
            this.stopMiniGuideRepeat('modalOpen');
            return;
        }
        if (navigation.isInputBlocked()) {
            this.stopMiniGuideRepeat('inputBlocked');
            return;
        }
        if (navigation.getCurrentScreen() !== 'player') {
            this.stopMiniGuideRepeat('notPlayer');
            return;
        }
        if (!this.deps.miniGuide.isVisible()) {
            this.stopMiniGuideRepeat('notVisible');
            return;
        }
        if (!this._miniGuideRepeatButton) {
            this.stopMiniGuideRepeat('noButton');
            return;
        }

        const moved = this.deps.miniGuide.requestMiniGuideIntent({
            type: 'navigate',
            direction: this._miniGuideRepeatButton,
        });
        if (!moved) {
            this.stopMiniGuideRepeat('blocked');
            return;
        }

        const heldMs = Date.now() - this._miniGuideRepeatStartMs;
        const interval = computeAcceleratedRepeatIntervalMs(heldMs, MINI_GUIDE_REPEAT_TIMING);
        this._miniGuideRepeatTimer = setTimeout(
            () => this._scheduleNextMiniGuideRepeatTick(),
            interval
        );
    }

    private _isDirectionalButton(button: KeyEvent['button']): button is NavigationFourWayDirection {
        return button === 'up' || button === 'down' || button === 'left' || button === 'right';
    }
}
