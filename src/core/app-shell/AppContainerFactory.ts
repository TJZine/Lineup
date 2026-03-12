import { CHANNEL_BADGE_CONTAINER_ID } from '../../modules/ui/channel-badge';
import { EXIT_CONFIRM_CONTAINER_ID } from '../../modules/ui/exit-confirm';
import { EPG_CONTAINER_ID } from '../../modules/ui/epg';
import { PLAYER_OSD_CONTAINER_ID } from '../../modules/ui/player-osd';
import { CHANNEL_NUMBER_OVERLAY_CONTAINER_ID } from '../../modules/ui/channel-number-overlay';
import { MINI_GUIDE_CONTAINER_ID } from '../../modules/ui/mini-guide';
import { CHANNEL_TRANSITION_CONTAINER_ID } from '../../modules/ui/channel-transition';

export interface AppContainerRefs {
    splashContainer: HTMLElement;
    authContainer: HTMLElement;
    profileSelectContainer: HTMLElement;
    serverSelectContainer: HTMLElement;
    channelSetupContainer: HTMLElement;
    audioSetupContainer: HTMLElement;
    settingsContainer: HTMLElement;
    errorOverlay: HTMLElement;
    devMenuContainer: HTMLElement;
    toastContainer: HTMLElement;
}

function getOrCreateDiv(root: HTMLElement, id: string): HTMLDivElement {
    const matches = Array.from(root.querySelectorAll<HTMLElement>(`#${id}`));
    const first = matches[0] ?? null;
    for (const extra of matches.slice(1)) {
        extra.remove();
    }

    if (first) {
        if (first.tagName.toLowerCase() === 'div') {
            return first as HTMLDivElement;
        }
        first.remove();
    }

    const el = document.createElement('div');
    el.id = id;
    root.appendChild(el);
    return el;
}

export function createAppContainers(root: HTMLElement): AppContainerRefs {
    // Video container
    const videoContainer = getOrCreateDiv(root, 'video-container');
    videoContainer.className = 'video-container';

    void getOrCreateDiv(root, PLAYER_OSD_CONTAINER_ID);

    void getOrCreateDiv(root, CHANNEL_NUMBER_OVERLAY_CONTAINER_ID);

    void getOrCreateDiv(root, CHANNEL_BADGE_CONTAINER_ID);

    void getOrCreateDiv(root, MINI_GUIDE_CONTAINER_ID);

    void getOrCreateDiv(root, CHANNEL_TRANSITION_CONTAINER_ID);

    // EPG container
    const epgContainer = getOrCreateDiv(root, EPG_CONTAINER_ID);
    epgContainer.className = 'epg-container';

    // Now Playing Info overlay container
    void getOrCreateDiv(root, 'now-playing-info-container');

    // Playback Options modal container
    void getOrCreateDiv(root, 'playback-options-container');

    // Exit confirmation modal container
    void getOrCreateDiv(root, EXIT_CONFIRM_CONTAINER_ID);

    // Splash container (startup screen)
    const splashContainer = getOrCreateDiv(root, 'splash-container');
    splashContainer.className = 'screen';

    // Auth container (minimal screen)
    const authContainer = getOrCreateDiv(root, 'auth-container');
    authContainer.className = 'screen';

    // Profile select container (Plex Home)
    const profileSelectContainer = getOrCreateDiv(root, 'profile-select-container');
    profileSelectContainer.className = 'screen';

    // Server select container (minimal screen)
    const serverSelectContainer = getOrCreateDiv(root, 'server-select-container');
    serverSelectContainer.className = 'screen';

    // Channel setup container
    const channelSetupContainer = getOrCreateDiv(root, 'channel-setup-container');
    channelSetupContainer.className = 'screen';

    // Audio setup container
    const audioSetupContainer = getOrCreateDiv(root, 'audio-setup-container');
    audioSetupContainer.className = 'screen';

    // Settings container
    const settingsContainer = getOrCreateDiv(root, 'settings-container');
    settingsContainer.className = 'settings-screen';

    // Error overlay container
    const errorOverlay = getOrCreateDiv(root, 'error-overlay');
    errorOverlay.className = 'error-overlay hidden';
    errorOverlay.setAttribute('role', 'dialog');
    errorOverlay.setAttribute('aria-modal', 'true');
    errorOverlay.setAttribute('aria-label', 'Error');

    // Dev Menu Container
    const devMenu = getOrCreateDiv(root, 'dev-menu');
    devMenu.style.position = 'absolute';
    devMenu.style.top = '50%';
    devMenu.style.left = '50%';
    devMenu.style.transform = 'translate(-50%, -50%)';
    devMenu.style.background = '#222';
    devMenu.style.color = '#fff';
    devMenu.style.padding = '20px';
    devMenu.style.borderRadius = '8px';
    devMenu.style.zIndex = '10000';
    devMenu.style.display = 'none';
    devMenu.style.boxShadow = '0 0 20px rgba(0,0,0,0.5)';
    devMenu.style.minWidth = '300px';

    // Toast container (non-blocking warnings)
    const toastContainer = getOrCreateDiv(root, 'app-toast');
    toastContainer.className = 'app-toast';
    toastContainer.setAttribute('role', 'status');
    toastContainer.setAttribute('aria-live', 'polite');
    toastContainer.setAttribute('aria-atomic', 'true');
    toastContainer.style.position = 'fixed';
    toastContainer.style.left = '50%';
    toastContainer.style.bottom = '64px';
    toastContainer.style.transform = 'translateX(-50%)';
    toastContainer.style.maxWidth = '70%';
    toastContainer.style.background = 'rgba(0, 0, 0, 0.8)';
    toastContainer.style.color = '#fff';
    toastContainer.style.padding = '12px 20px';
    toastContainer.style.borderLeft = '4px solid transparent';
    toastContainer.style.boxSizing = 'border-box';
    toastContainer.style.borderRadius = '8px';
    toastContainer.style.fontSize = '20px';
    toastContainer.style.lineHeight = '1.2';
    toastContainer.style.textAlign = 'left';
    toastContainer.style.opacity = '0';
    toastContainer.style.transition = 'opacity 200ms ease';
    toastContainer.style.pointerEvents = 'none';
    toastContainer.style.zIndex = '9999';
    toastContainer.style.display = 'none';

    return {
        splashContainer,
        authContainer,
        profileSelectContainer,
        serverSelectContainer,
        channelSetupContainer,
        audioSetupContainer,
        settingsContainer,
        errorOverlay,
        devMenuContainer: devMenu,
        toastContainer,
    };
}
