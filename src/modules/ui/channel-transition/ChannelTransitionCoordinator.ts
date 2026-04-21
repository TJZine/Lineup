/**
 * @fileoverview Channel transition coordinator (delayed overlay).
 * @module modules/ui/channel-transition/ChannelTransitionCoordinator
 */

import type { INavigationManager, Screen } from '../../navigation';
import type { IVideoPlayer, PlaybackState } from '../../player';
import type { IChannelTransitionOverlay } from './interfaces';
import { CHANNEL_TRANSITION_SHOW_DELAY_MS } from './constants';

interface ChannelTransitionCoordinatorDeps {
    getOverlay: () => IChannelTransitionOverlay | null;
    getNavigation: () => INavigationManager | null;
    getVideoPlayer: () => IVideoPlayer | null;
    onActivityChange?: (active: boolean) => void;
}

export class ChannelTransitionCoordinator {
    private _armedToken = 0;
    private _showTimer: number | null = null;
    private _isActive = false;
    private _isVisible = false;
    private _pendingSubtitle: string | null = null;

    constructor(private readonly deps: ChannelTransitionCoordinatorDeps) {}

    armForChannelSwitch(channelPrefix: string | null): void {
        this._armedToken += 1;
        this._pendingSubtitle = channelPrefix ?? null;
        this._setActive(true);
        this._resetPresentationForRearm();

        const token = this._armedToken;
        this._showTimer = globalThis.setTimeout(() => {
            this._showTimer = null;
            if (token !== this._armedToken) {
                return;
            }

            const navigation = this.deps.getNavigation();
            if (!navigation || navigation.getCurrentScreen() !== 'player') {
                this._endActivity();
                return;
            }
            if (navigation.isModalOpen()) {
                this._endActivity();
                return;
            }

            if (this._isPlayerReady()) {
                this._endActivity();
                return;
            }

            this._showOverlay();
        }, CHANNEL_TRANSITION_SHOW_DELAY_MS) as unknown as number;
    }

    onPlayerStateChange(state: PlaybackState): void {
        if (state.status === 'playing' || state.status === 'paused') {
            this._endActivity();
            return;
        }
        if (state.status === 'error') {
            this._endActivity();
            return;
        }
        if (state.status === 'idle' && this._isVisible) {
            this._endActivity();
        }
    }

    onScreenChange(to: Screen): void {
        if (to !== 'player') {
            this._endActivity();
        }
    }

    hide(): void {
        this._endActivity();
    }

    isActive(): boolean {
        return this._isActive;
    }

    private _resetPresentationForRearm(): void {
        this._clearTimer();
        if (this._isVisible) {
            this.deps.getOverlay()?.hide();
            this._isVisible = false;
        }
    }

    private _showOverlay(): void {
        const overlay = this.deps.getOverlay();
        if (!overlay) return;
        overlay.setViewModel({
            title: 'Tuning…',
            subtitle: this._pendingSubtitle,
            showSpinner: true,
        });
        overlay.show();
        this._isVisible = true;
    }

    private _isPlayerReady(): boolean {
        const player = this.deps.getVideoPlayer();
        if (!player || typeof player.getState !== 'function') {
            return false;
        }
        const state = player.getState();
        if (!state) return false;
        return state.status === 'playing' || state.status === 'paused';
    }

    private _endActivity(): void {
        this._clearTimer();
        if (this._isVisible) {
            this.deps.getOverlay()?.hide();
            this._isVisible = false;
        }
        this._setActive(false);
    }

    private _setActive(active: boolean): void {
        if (this._isActive === active) {
            return;
        }
        this._isActive = active;
        this.deps.onActivityChange?.(active);
    }

    private _clearTimer(): void {
        if (this._showTimer !== null) {
            globalThis.clearTimeout(this._showTimer);
            this._showTimer = null;
        }
    }
}
