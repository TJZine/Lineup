/**
 * @jest-environment jsdom
 */

import { createAppContainers } from '../AppContainerFactory';
import {
    EXPECTED_APP_ROOT_CHILD_IDS,
    EXPECTED_CONTAINER_IDS,
    EXPECTED_RUNTIME_CHROME_HOST_CHILD_IDS,
} from '../../../__tests__/fixtures/appShellContainerIds';
import { APP_SHELL_CONTAINER_IDS } from '../../../modules/ui/common/appShellContainerIds';

const SCREEN_CONTAINER_IDS = [
    APP_SHELL_CONTAINER_IDS.SPLASH,
    APP_SHELL_CONTAINER_IDS.AUTH,
    APP_SHELL_CONTAINER_IDS.PROFILE_SELECT,
    APP_SHELL_CONTAINER_IDS.SERVER_SELECT,
    APP_SHELL_CONTAINER_IDS.CHANNEL_SETUP,
    APP_SHELL_CONTAINER_IDS.AUDIO_SETUP,
];

const SETTINGS_CONTAINER_ID = APP_SHELL_CONTAINER_IDS.SETTINGS;

describe('createAppContainers', () => {
    beforeEach(() => {
        const appDiv = document.createElement('div');
        appDiv.id = 'app';
        document.body.replaceChildren(appDiv);
    });

    afterEach(() => {
        document.body.replaceChildren();
    });

    it('creates all required app-shell containers in stable append order', () => {
        const root = document.getElementById('app') as HTMLElement;

        createAppContainers(root);
        createAppContainers(root);

        expect(Array.from(root.children, (child) => (child as HTMLElement).id)).toEqual(EXPECTED_APP_ROOT_CHILD_IDS);
        expect(
            Array.from(
                (document.getElementById(APP_SHELL_CONTAINER_IDS.RUNTIME_CHROME_HOST) as HTMLElement).children,
                (child) => (child as HTMLElement).id
            )
        ).toEqual(EXPECTED_RUNTIME_CHROME_HOST_CHILD_IDS);
    });

    it('is idempotent when called repeatedly (no duplicate IDs)', () => {
        const root = document.getElementById('app') as HTMLElement;

        const first = createAppContainers(root);
        const second = createAppContainers(root);

        for (const id of EXPECTED_CONTAINER_IDS) {
            expect(root.querySelectorAll(`#${id}`).length).toBe(1);
        }

        expect(first.toastContainer).toBe(second.toastContainer);
        expect(first.errorOverlay).toBe(second.errorOverlay);
        expect(first.splashContainer).toBe(second.splashContainer);
    });

    it('applies required classes, attributes, and returned refs', () => {
        const root = document.getElementById('app') as HTMLElement;

        const refs = createAppContainers(root);
        const errorOverlay = document.getElementById(APP_SHELL_CONTAINER_IDS.ERROR_OVERLAY) as HTMLElement;
        const runtimeChromeHost = document.getElementById(APP_SHELL_CONTAINER_IDS.RUNTIME_CHROME_HOST) as HTMLElement;
        const toastContainer = document.getElementById(APP_SHELL_CONTAINER_IDS.TOAST) as HTMLElement;

        expect((document.getElementById(APP_SHELL_CONTAINER_IDS.VIDEO) as HTMLElement).className).toBe('video-container');
        expect(runtimeChromeHost.className).toBe('runtime-chrome-host');
        expect((document.getElementById('epg-container') as HTMLElement).className).toBe('epg-container');

        for (const id of SCREEN_CONTAINER_IDS) {
            expect((document.getElementById(id) as HTMLElement).className).toBe('screen');
        }
        expect((document.getElementById(SETTINGS_CONTAINER_ID) as HTMLElement).className).toBe('settings-screen');

        expect(errorOverlay.getAttribute('role')).toBe('dialog');
        expect(errorOverlay.getAttribute('aria-modal')).toBe('true');
        expect(errorOverlay.getAttribute('aria-label')).toBe('Error');
        expect(errorOverlay.classList.contains('hidden')).toBe(true);

        expect(toastContainer.className).toBe('app-toast');
        expect(toastContainer.getAttribute('role')).toBe('status');
        expect(toastContainer.getAttribute('aria-live')).toBe('polite');
        expect(toastContainer.getAttribute('aria-atomic')).toBe('true');

        expect(refs.splashContainer).toBe(document.getElementById(APP_SHELL_CONTAINER_IDS.SPLASH));
        expect(refs.authContainer).toBe(document.getElementById(APP_SHELL_CONTAINER_IDS.AUTH));
        expect(refs.profileSelectContainer).toBe(document.getElementById(APP_SHELL_CONTAINER_IDS.PROFILE_SELECT));
        expect(refs.serverSelectContainer).toBe(document.getElementById(APP_SHELL_CONTAINER_IDS.SERVER_SELECT));
        expect(refs.channelSetupContainer).toBe(document.getElementById(APP_SHELL_CONTAINER_IDS.CHANNEL_SETUP));
        expect(refs.audioSetupContainer).toBe(document.getElementById(APP_SHELL_CONTAINER_IDS.AUDIO_SETUP));
        expect(refs.settingsContainer).toBe(document.getElementById(APP_SHELL_CONTAINER_IDS.SETTINGS));
        expect(refs.errorOverlay).toBe(errorOverlay);
        expect(refs.devMenuContainer).toBe(document.getElementById(APP_SHELL_CONTAINER_IDS.DEV_MENU));
        expect(refs.toastContainer).toBe(toastContainer);
    });

    it('preserves dev menu and toast inline style defaults', () => {
        const root = document.getElementById('app') as HTMLElement;

        createAppContainers(root);

        const devMenu = document.getElementById(APP_SHELL_CONTAINER_IDS.DEV_MENU) as HTMLElement;
        const toastContainer = document.getElementById(APP_SHELL_CONTAINER_IDS.TOAST) as HTMLElement;

        expect(devMenu.style.position).toBe('absolute');
        expect(devMenu.style.top).toBe('50%');
        expect(devMenu.style.left).toBe('50%');
        expect(devMenu.style.transform).toBe('translate(-50%, -50%)');
        expect(devMenu.style.display).toBe('none');
        expect(devMenu.style.minWidth).toBe('300px');
        expect(devMenu.style.padding).toBe('20px');
        expect(devMenu.style.borderRadius).toBe('8px');
        expect(devMenu.style.zIndex).toBe('10000');

        expect(toastContainer.style.position).toBe('fixed');
        expect(toastContainer.style.left).toBe('50%');
        expect(toastContainer.style.bottom).toBe('64px');
        expect(toastContainer.style.transform).toBe('translateX(-50%)');
        expect(toastContainer.style.maxWidth).toBe('70%');
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

    it('removes duplicate app-shell containers and keeps the first matching div', () => {
        const root = document.getElementById('app') as HTMLElement;
        const first = document.createElement('div');
        first.id = APP_SHELL_CONTAINER_IDS.TOAST;
        const duplicate = document.createElement('div');
        duplicate.id = APP_SHELL_CONTAINER_IDS.TOAST;
        root.append(first, duplicate);

        const refs = createAppContainers(root);
        const toastMatches = root.querySelectorAll(`#${APP_SHELL_CONTAINER_IDS.TOAST}`);

        expect(toastMatches).toHaveLength(1);
        expect(toastMatches[0]).toBe(first);
        expect(refs.toastContainer).toBe(first);
    });

    it('replaces non-div app-shell collisions with fresh div containers', () => {
        const root = document.getElementById('app') as HTMLElement;
        const wrongTag = document.createElement('section');
        wrongTag.id = APP_SHELL_CONTAINER_IDS.ERROR_OVERLAY;
        root.appendChild(wrongTag);

        const refs = createAppContainers(root);
        const overlay = document.getElementById(APP_SHELL_CONTAINER_IDS.ERROR_OVERLAY);

        expect(overlay).toBeInstanceOf(HTMLDivElement);
        expect(overlay).not.toBe(wrongTag);
        expect(root.contains(wrongTag)).toBe(false);
        expect(refs.errorOverlay).toBe(overlay);
    });

    it('preserves an existing matching div when a wrong-tag collision appears first', () => {
        const root = document.getElementById('app') as HTMLElement;
        const wrongTag = document.createElement('section');
        wrongTag.id = APP_SHELL_CONTAINER_IDS.TOAST;
        const validDiv = document.createElement('div');
        validDiv.id = APP_SHELL_CONTAINER_IDS.TOAST;
        root.append(wrongTag, validDiv);

        const refs = createAppContainers(root);
        const toastMatches = root.querySelectorAll(`#${APP_SHELL_CONTAINER_IDS.TOAST}`);

        expect(toastMatches).toHaveLength(1);
        expect(toastMatches[0]).toBe(validDiv);
        expect(root.contains(wrongTag)).toBe(false);
        expect(refs.toastContainer).toBe(validDiv);
    });

    it('repairs duplicate runtime chrome hosts and keeps the first matching div', () => {
        const root = document.getElementById('app') as HTMLElement;
        const first = document.createElement('div');
        first.id = APP_SHELL_CONTAINER_IDS.RUNTIME_CHROME_HOST;
        const duplicate = document.createElement('div');
        duplicate.id = APP_SHELL_CONTAINER_IDS.RUNTIME_CHROME_HOST;
        root.append(first, duplicate);

        createAppContainers(root);

        const hostMatches = root.querySelectorAll(`#${APP_SHELL_CONTAINER_IDS.RUNTIME_CHROME_HOST}`);

        expect(hostMatches).toHaveLength(1);
        expect(hostMatches[0]).toBe(first);
    });

    it('repairs runtime chrome members that drift outside the host', () => {
        const root = document.getElementById('app') as HTMLElement;
        const strayPlayerOsd = document.createElement('div');
        strayPlayerOsd.id = 'player-osd-container';
        const strayMiniGuide = document.createElement('div');
        strayMiniGuide.id = 'mini-guide-container';
        root.append(strayPlayerOsd, strayMiniGuide);

        createAppContainers(root);

        const runtimeChromeHost = document.getElementById(APP_SHELL_CONTAINER_IDS.RUNTIME_CHROME_HOST) as HTMLElement;

        expect(strayPlayerOsd.parentElement).toBe(runtimeChromeHost);
        expect(strayMiniGuide.parentElement).toBe(runtimeChromeHost);
        expect(Array.from(root.children, (child) => (child as HTMLElement).id)).toEqual(EXPECTED_APP_ROOT_CHILD_IDS);
        expect(Array.from(runtimeChromeHost.children, (child) => (child as HTMLElement).id)).toEqual(
            EXPECTED_RUNTIME_CHROME_HOST_CHILD_IDS
        );
    });
});
