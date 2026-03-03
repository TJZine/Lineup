/**
 * @jest-environment jsdom
 */

import { createAppContainers } from '../AppContainerFactory';
import { CHANNEL_BADGE_CONTAINER_ID } from '../../../modules/ui/channel-badge';
import { EXIT_CONFIRM_CONTAINER_ID } from '../../../modules/ui/exit-confirm';

const EXPECTED_CONTAINER_IDS = [
    'video-container',
    'player-osd-container',
    'channel-number-overlay-container',
    CHANNEL_BADGE_CONTAINER_ID,
    'mini-guide-container',
    'channel-transition-container',
    'epg-container',
    'now-playing-info-container',
    'playback-options-container',
    EXIT_CONFIRM_CONTAINER_ID,
    'splash-container',
    'auth-container',
    'profile-select-container',
    'server-select-container',
    'channel-setup-container',
    'audio-setup-container',
    'settings-container',
    'error-overlay',
    'dev-menu',
    'app-toast',
];

const SCREEN_CONTAINER_IDS = [
    'splash-container',
    'auth-container',
    'profile-select-container',
    'server-select-container',
    'channel-setup-container',
    'audio-setup-container',
    'settings-container',
];

describe('createAppContainers', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="app"></div>';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('creates all required app-shell containers in stable append order', () => {
        const root = document.getElementById('app') as HTMLElement;

        createAppContainers(root);

        expect(Array.from(root.children, (child) => (child as HTMLElement).id)).toEqual(EXPECTED_CONTAINER_IDS);
    });

    it('applies required classes, attributes, and returned refs', () => {
        const root = document.getElementById('app') as HTMLElement;

        const refs = createAppContainers(root);
        const errorOverlay = document.getElementById('error-overlay') as HTMLElement;
        const toastContainer = document.getElementById('app-toast') as HTMLElement;

        expect((document.getElementById('video-container') as HTMLElement).className).toBe('video-container');
        expect((document.getElementById('epg-container') as HTMLElement).className).toBe('epg-container');

        for (const id of SCREEN_CONTAINER_IDS) {
            expect((document.getElementById(id) as HTMLElement).className).toBe('screen');
        }

        expect(errorOverlay.getAttribute('role')).toBe('dialog');
        expect(errorOverlay.getAttribute('aria-modal')).toBe('true');
        expect(errorOverlay.getAttribute('aria-label')).toBe('Error');
        expect(errorOverlay.classList.contains('hidden')).toBe(true);

        expect(toastContainer.className).toBe('app-toast');
        expect(toastContainer.getAttribute('role')).toBe('status');
        expect(toastContainer.getAttribute('aria-live')).toBe('polite');
        expect(toastContainer.getAttribute('aria-atomic')).toBe('true');

        expect(refs.splashContainer).toBe(document.getElementById('splash-container'));
        expect(refs.authContainer).toBe(document.getElementById('auth-container'));
        expect(refs.profileSelectContainer).toBe(document.getElementById('profile-select-container'));
        expect(refs.serverSelectContainer).toBe(document.getElementById('server-select-container'));
        expect(refs.channelSetupContainer).toBe(document.getElementById('channel-setup-container'));
        expect(refs.audioSetupContainer).toBe(document.getElementById('audio-setup-container'));
        expect(refs.settingsContainer).toBe(document.getElementById('settings-container'));
        expect(refs.errorOverlay).toBe(errorOverlay);
        expect(refs.devMenuContainer).toBe(document.getElementById('dev-menu'));
        expect(refs.toastContainer).toBe(toastContainer);
    });

    it('preserves dev menu and toast inline style defaults', () => {
        const root = document.getElementById('app') as HTMLElement;

        createAppContainers(root);

        const devMenu = document.getElementById('dev-menu') as HTMLElement;
        const toastContainer = document.getElementById('app-toast') as HTMLElement;

        expect(devMenu.style.position).toBe('absolute');
        expect(devMenu.style.top).toBe('50%');
        expect(devMenu.style.left).toBe('50%');
        expect(devMenu.style.transform).toBe('translate(-50%, -50%)');
        expect(devMenu.style.display).toBe('none');
        expect(devMenu.style.minWidth).toBe('300px');
        expect(devMenu.style.backgroundColor).toBe('rgb(34, 34, 34)');
        expect(devMenu.style.color).toBe('rgb(255, 255, 255)');
        expect(devMenu.style.padding).toBe('20px');
        expect(devMenu.style.borderRadius).toBe('8px');
        expect(devMenu.style.boxShadow.replace(/\s+/g, '')).toBe('0020pxrgba(0,0,0,0.5)');
        expect(devMenu.style.zIndex).toBe('10000');

        expect(toastContainer.style.position).toBe('fixed');
        expect(toastContainer.style.left).toBe('50%');
        expect(toastContainer.style.bottom).toBe('64px');
        expect(toastContainer.style.transform).toBe('translateX(-50%)');
        expect(toastContainer.style.maxWidth).toBe('70%');
        expect(toastContainer.style.backgroundColor).toBe('rgba(0, 0, 0, 0.8)');
        expect(toastContainer.style.color).toBe('rgb(255, 255, 255)');
        expect(toastContainer.style.padding).toBe('12px 20px');
        expect(toastContainer.style.borderLeftWidth).toBe('4px');
        expect(toastContainer.style.borderLeftStyle).toBe('solid');
        expect(toastContainer.style.boxSizing).toBe('border-box');
        expect(toastContainer.style.borderRadius).toBe('8px');
        expect(toastContainer.style.fontSize).toBe('20px');
        expect(toastContainer.style.lineHeight).toBe('1.2');
        expect(toastContainer.style.textAlign).toBe('left');
        expect(toastContainer.style.opacity).toBe('0');
        expect(toastContainer.style.transition).toBe('opacity 200ms ease');
        expect(toastContainer.style.pointerEvents).toBe('none');
        expect(toastContainer.style.display).toBe('none');
        expect(toastContainer.style.zIndex).toBe('9999');
    });
});
