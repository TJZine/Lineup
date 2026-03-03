import { CHANNEL_BADGE_CONTAINER_ID } from '../../modules/ui/channel-badge';
import { EXIT_CONFIRM_CONTAINER_ID } from '../../modules/ui/exit-confirm';

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

export function createAppContainers(root: HTMLElement): AppContainerRefs {
    // Video container
    const videoContainer = document.createElement('div');
    videoContainer.id = 'video-container';
    videoContainer.className = 'video-container';
    root.appendChild(videoContainer);

    const playerOsdContainer = document.createElement('div');
    playerOsdContainer.id = 'player-osd-container';
    root.appendChild(playerOsdContainer);

    const channelNumberOverlayContainer = document.createElement('div');
    channelNumberOverlayContainer.id = 'channel-number-overlay-container';
    root.appendChild(channelNumberOverlayContainer);

    const channelBadgeContainer = document.createElement('div');
    channelBadgeContainer.id = CHANNEL_BADGE_CONTAINER_ID;
    root.appendChild(channelBadgeContainer);

    const miniGuideContainer = document.createElement('div');
    miniGuideContainer.id = 'mini-guide-container';
    root.appendChild(miniGuideContainer);

    const channelTransitionContainer = document.createElement('div');
    channelTransitionContainer.id = 'channel-transition-container';
    root.appendChild(channelTransitionContainer);

    // EPG container
    const epgContainer = document.createElement('div');
    epgContainer.id = 'epg-container';
    epgContainer.className = 'epg-container';
    root.appendChild(epgContainer);

    // Now Playing Info overlay container
    const nowPlayingContainer = document.createElement('div');
    nowPlayingContainer.id = 'now-playing-info-container';
    root.appendChild(nowPlayingContainer);

    // Playback Options modal container
    const playbackOptionsContainer = document.createElement('div');
    playbackOptionsContainer.id = 'playback-options-container';
    root.appendChild(playbackOptionsContainer);

    // Exit confirmation modal container
    const exitConfirmContainer = document.createElement('div');
    exitConfirmContainer.id = EXIT_CONFIRM_CONTAINER_ID;
    root.appendChild(exitConfirmContainer);

    // Splash container (startup screen)
    const splashContainer = document.createElement('div');
    splashContainer.id = 'splash-container';
    splashContainer.className = 'screen';
    root.appendChild(splashContainer);

    // Auth container (minimal screen)
    const authContainer = document.createElement('div');
    authContainer.id = 'auth-container';
    authContainer.className = 'screen';
    root.appendChild(authContainer);

    // Profile select container (Plex Home)
    const profileSelectContainer = document.createElement('div');
    profileSelectContainer.id = 'profile-select-container';
    profileSelectContainer.className = 'screen';
    root.appendChild(profileSelectContainer);

    // Server select container (minimal screen)
    const serverSelectContainer = document.createElement('div');
    serverSelectContainer.id = 'server-select-container';
    serverSelectContainer.className = 'screen';
    root.appendChild(serverSelectContainer);

    // Channel setup container
    const channelSetupContainer = document.createElement('div');
    channelSetupContainer.id = 'channel-setup-container';
    channelSetupContainer.className = 'screen';
    root.appendChild(channelSetupContainer);

    // Audio setup container
    const audioSetupContainer = document.createElement('div');
    audioSetupContainer.id = 'audio-setup-container';
    audioSetupContainer.className = 'screen';
    root.appendChild(audioSetupContainer);

    // Settings container
    const settingsContainer = document.createElement('div');
    settingsContainer.id = 'settings-container';
    settingsContainer.className = 'screen';
    root.appendChild(settingsContainer);

    // Error overlay container
    const errorOverlay = document.createElement('div');
    errorOverlay.id = 'error-overlay';
    errorOverlay.className = 'error-overlay hidden';
    errorOverlay.setAttribute('role', 'dialog');
    errorOverlay.setAttribute('aria-modal', 'true');
    errorOverlay.setAttribute('aria-label', 'Error');
    root.appendChild(errorOverlay);

    // Dev Menu Container
    const devMenu = document.createElement('div');
    devMenu.id = 'dev-menu';
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
    root.appendChild(devMenu);

    // Toast container (non-blocking warnings)
    const toastContainer = document.createElement('div');
    toastContainer.id = 'app-toast';
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
    root.appendChild(toastContainer);

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
