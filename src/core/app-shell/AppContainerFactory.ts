import { CHANNEL_BADGE_CONTAINER_ID } from '../../modules/ui/channel-badge';
import { EXIT_CONFIRM_CONTAINER_ID } from '../../modules/ui/exit-confirm';
import { EPG_CONTAINER_ID } from '../../modules/ui/epg';
import { PLAYER_OSD_CONTAINER_ID } from '../../modules/ui/player-osd';
import { CHANNEL_NUMBER_OVERLAY_CONTAINER_ID } from '../../modules/ui/channel-number-overlay';
import { MINI_GUIDE_CONTAINER_ID } from '../../modules/ui/mini-guide';
import { CHANNEL_TRANSITION_CONTAINER_ID } from '../../modules/ui/channel-transition';
import { APP_SHELL_CONTAINER_IDS } from '../../modules/ui/common/appShellContainerIds';

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

const APP_SHELL_COLORS = {
    devMenuBackground: '#222',
    toastBackground: 'rgba(0, 0, 0, 0.8)',
    foreground: '#fff',
} as const;

function ensureUniqueContainerDiv(root: HTMLElement, id: string): HTMLDivElement {
    const matches = Array.from(root.querySelectorAll<HTMLElement>(`#${id}`));
    const firstDiv = matches.find((match) => match.tagName.toLowerCase() === 'div') ?? null;

    if (firstDiv) {
        for (const match of matches) {
            if (match !== firstDiv) {
                match.remove();
            }
        }
        return firstDiv as HTMLDivElement;
    }

    for (const match of matches) {
        match.remove();
    }

    const el = document.createElement('div');
    el.id = id;
    root.appendChild(el);
    return el;
}

export function createAppContainers(root: HTMLElement): AppContainerRefs {
    // Video container
    const videoContainer = ensureUniqueContainerDiv(root, APP_SHELL_CONTAINER_IDS.VIDEO);
    videoContainer.className = 'video-container';

    void ensureUniqueContainerDiv(root, PLAYER_OSD_CONTAINER_ID);

    void ensureUniqueContainerDiv(root, CHANNEL_NUMBER_OVERLAY_CONTAINER_ID);

    void ensureUniqueContainerDiv(root, CHANNEL_BADGE_CONTAINER_ID);

    void ensureUniqueContainerDiv(root, MINI_GUIDE_CONTAINER_ID);

    void ensureUniqueContainerDiv(root, CHANNEL_TRANSITION_CONTAINER_ID);

    // EPG container
    const epgContainer = ensureUniqueContainerDiv(root, EPG_CONTAINER_ID);
    epgContainer.className = 'epg-container';

    // Now Playing Info overlay container
    void ensureUniqueContainerDiv(root, APP_SHELL_CONTAINER_IDS.NOW_PLAYING_INFO);

    // Playback Options modal container
    void ensureUniqueContainerDiv(root, APP_SHELL_CONTAINER_IDS.PLAYBACK_OPTIONS);

    // Exit confirmation modal container
    void ensureUniqueContainerDiv(root, EXIT_CONFIRM_CONTAINER_ID);

    // Splash container (startup screen)
    const splashContainer = ensureUniqueContainerDiv(root, APP_SHELL_CONTAINER_IDS.SPLASH);
    splashContainer.className = 'screen';

    // Auth container (minimal screen)
    const authContainer = ensureUniqueContainerDiv(root, APP_SHELL_CONTAINER_IDS.AUTH);
    authContainer.className = 'screen';

    // Profile select container (Plex Home)
    const profileSelectContainer = ensureUniqueContainerDiv(root, APP_SHELL_CONTAINER_IDS.PROFILE_SELECT);
    profileSelectContainer.className = 'screen';

    // Server select container (minimal screen)
    const serverSelectContainer = ensureUniqueContainerDiv(root, APP_SHELL_CONTAINER_IDS.SERVER_SELECT);
    serverSelectContainer.className = 'screen';

    // Channel setup container
    const channelSetupContainer = ensureUniqueContainerDiv(root, APP_SHELL_CONTAINER_IDS.CHANNEL_SETUP);
    channelSetupContainer.className = 'screen';

    // Audio setup container
    const audioSetupContainer = ensureUniqueContainerDiv(root, APP_SHELL_CONTAINER_IDS.AUDIO_SETUP);
    audioSetupContainer.className = 'screen';

    // Settings container
    const settingsContainer = ensureUniqueContainerDiv(root, APP_SHELL_CONTAINER_IDS.SETTINGS);
    settingsContainer.className = 'settings-screen';

    // Error overlay container
    const errorOverlay = ensureUniqueContainerDiv(root, APP_SHELL_CONTAINER_IDS.ERROR_OVERLAY);
    errorOverlay.className = 'error-overlay hidden';
    errorOverlay.setAttribute('role', 'dialog');
    errorOverlay.setAttribute('aria-modal', 'true');
    errorOverlay.setAttribute('aria-label', 'Error');

    // Dev Menu Container
    const devMenu = ensureUniqueContainerDiv(root, APP_SHELL_CONTAINER_IDS.DEV_MENU);
    devMenu.style.position = 'absolute';
    devMenu.style.top = '50%';
    devMenu.style.left = '50%';
    devMenu.style.transform = 'translate(-50%, -50%)';
    devMenu.style.background = APP_SHELL_COLORS.devMenuBackground;
    devMenu.style.color = APP_SHELL_COLORS.foreground;
    devMenu.style.padding = '20px';
    devMenu.style.borderRadius = '8px';
    devMenu.style.zIndex = '10000';
    devMenu.style.display = 'none';
    devMenu.style.boxShadow = '0 0 20px rgba(0,0,0,0.5)';
    devMenu.style.minWidth = '300px';

    // Toast container (non-blocking warnings)
    const toastContainer = ensureUniqueContainerDiv(root, APP_SHELL_CONTAINER_IDS.TOAST);
    toastContainer.className = 'app-toast';
    toastContainer.setAttribute('role', 'status');
    toastContainer.setAttribute('aria-live', 'polite');
    toastContainer.setAttribute('aria-atomic', 'true');
    toastContainer.style.position = 'fixed';
    toastContainer.style.left = '50%';
    toastContainer.style.bottom = '64px';
    toastContainer.style.transform = 'translateX(-50%)';
    toastContainer.style.maxWidth = '70%';
    toastContainer.style.background = APP_SHELL_COLORS.toastBackground;
    toastContainer.style.color = APP_SHELL_COLORS.foreground;
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
