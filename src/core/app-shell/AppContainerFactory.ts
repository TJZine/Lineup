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

const RUNTIME_CHROME_CHILD_IDS = [
    PLAYER_OSD_CONTAINER_ID,
    CHANNEL_NUMBER_OVERLAY_CONTAINER_ID,
    CHANNEL_BADGE_CONTAINER_ID,
    MINI_GUIDE_CONTAINER_ID,
    CHANNEL_TRANSITION_CONTAINER_ID,
] as const;

function matchingElementsById(id: string): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>(`[id="${id}"]`));
}

function hasDomContent(element: HTMLElement): boolean {
    return element.childNodes.length > 0;
}

function preferredCanonicalContainerDiv(
    divMatches: readonly HTMLDivElement[],
    parent: HTMLElement
): HTMLDivElement | null {
    return (
        divMatches.find((match) => match.parentElement === parent && hasDomContent(match))
        ?? divMatches.find((match) => hasDomContent(match))
        ?? divMatches.find((match) => match.parentElement === parent)
        ?? divMatches[0]
        ?? null
    );
}

function preserveRuntimeChromeChildrenFromDuplicateHosts(
    canonicalHost: HTMLDivElement,
    matches: readonly HTMLElement[]
): void {
    for (const match of matches) {
        if (match === canonicalHost || match.tagName.toLowerCase() !== 'div') {
            continue;
        }

        for (const childId of RUNTIME_CHROME_CHILD_IDS) {
            const childMatches = Array.from(match.querySelectorAll<HTMLElement>(`[id="${childId}"]`)).filter(
                (child): child is HTMLDivElement => child.tagName.toLowerCase() === 'div'
            );

            for (const childMatch of childMatches) {
                if (childMatch.parentElement !== canonicalHost) {
                    canonicalHost.appendChild(childMatch);
                }
            }
        }
    }
}

function ensureCanonicalContainerDiv(parent: HTMLElement, id: string): HTMLDivElement {
    const matches = matchingElementsById(id);
    const divMatches = matches.filter((match): match is HTMLDivElement => match.tagName.toLowerCase() === 'div');
    const canonical = preferredCanonicalContainerDiv(divMatches, parent) ?? document.createElement('div');

    if (!canonical.id) {
        canonical.id = id;
    }

    if (id === APP_SHELL_CONTAINER_IDS.RUNTIME_CHROME_HOST) {
        preserveRuntimeChromeChildrenFromDuplicateHosts(canonical, matches);
    }

    for (const match of matches) {
        if (match !== canonical) {
            match.remove();
        }
    }

    if (canonical.parentElement !== parent) {
        parent.appendChild(canonical);
    }

    return canonical;
}

function reorderChildren(parent: HTMLElement, orderedChildren: readonly HTMLElement[]): void {
    for (const child of orderedChildren) {
        parent.appendChild(child);
    }
}

function assertManagedChildren(
    parent: HTMLElement,
    expectedChildren: readonly HTMLElement[],
    scope: string
): void {
    if (process.env.NODE_ENV === 'production') {
        return;
    }

    const expected = new Set(expectedChildren);
    const unexpected = Array.from(parent.childNodes).filter((child) =>
        !(child instanceof HTMLElement && expected.has(child))
    );
    if (unexpected.length === 0) {
        return;
    }

    const unexpectedLabels = unexpected.map((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
            return '#text';
        }
        if (child.nodeType === Node.COMMENT_NODE) {
            return '<!-- -->';
        }
        if (child instanceof HTMLElement) {
            return child.id ? `#${child.id}` : child.tagName.toLowerCase();
        }
        return `nodeType:${child.nodeType}`;
    });
    throw new Error(`${scope} has unmanaged children: ${unexpectedLabels.join(', ')}`);
}

export function createAppContainers(root: HTMLElement): AppContainerRefs {
    // Video container
    const videoContainer = ensureCanonicalContainerDiv(root, APP_SHELL_CONTAINER_IDS.VIDEO);
    videoContainer.className = 'video-container';

    const runtimeChromeHost = ensureCanonicalContainerDiv(root, APP_SHELL_CONTAINER_IDS.RUNTIME_CHROME_HOST);
    runtimeChromeHost.className = 'runtime-chrome-host';

    const runtimeChromeChildren = RUNTIME_CHROME_CHILD_IDS.map((id) => ensureCanonicalContainerDiv(runtimeChromeHost, id));
    assertManagedChildren(runtimeChromeHost, runtimeChromeChildren, 'AppContainerFactory runtime chrome host');
    reorderChildren(runtimeChromeHost, runtimeChromeChildren);

    // EPG container
    const epgContainer = ensureCanonicalContainerDiv(root, EPG_CONTAINER_ID);
    epgContainer.className = 'epg-container';

    // Now Playing Info overlay container
    const nowPlayingInfoContainer = ensureCanonicalContainerDiv(root, APP_SHELL_CONTAINER_IDS.NOW_PLAYING_INFO);

    // Playback Options modal container
    const playbackOptionsContainer = ensureCanonicalContainerDiv(root, APP_SHELL_CONTAINER_IDS.PLAYBACK_OPTIONS);

    // Exit confirmation modal container
    const exitConfirmContainer = ensureCanonicalContainerDiv(root, EXIT_CONFIRM_CONTAINER_ID);

    // Splash container (startup screen)
    const splashContainer = ensureCanonicalContainerDiv(root, APP_SHELL_CONTAINER_IDS.SPLASH);
    splashContainer.className = 'screen';

    // Auth container (minimal screen)
    const authContainer = ensureCanonicalContainerDiv(root, APP_SHELL_CONTAINER_IDS.AUTH);
    authContainer.className = 'screen';

    // Profile select container (Plex Home)
    const profileSelectContainer = ensureCanonicalContainerDiv(root, APP_SHELL_CONTAINER_IDS.PROFILE_SELECT);
    profileSelectContainer.className = 'screen';

    // Server select container (minimal screen)
    const serverSelectContainer = ensureCanonicalContainerDiv(root, APP_SHELL_CONTAINER_IDS.SERVER_SELECT);
    serverSelectContainer.className = 'screen';

    // Channel setup container
    const channelSetupContainer = ensureCanonicalContainerDiv(root, APP_SHELL_CONTAINER_IDS.CHANNEL_SETUP);
    channelSetupContainer.className = 'screen';

    // Audio setup container
    const audioSetupContainer = ensureCanonicalContainerDiv(root, APP_SHELL_CONTAINER_IDS.AUDIO_SETUP);
    audioSetupContainer.className = 'screen';

    // Settings container
    const settingsContainer = ensureCanonicalContainerDiv(root, APP_SHELL_CONTAINER_IDS.SETTINGS);
    settingsContainer.className = 'settings-screen';

    // Error overlay container
    const errorOverlay = ensureCanonicalContainerDiv(root, APP_SHELL_CONTAINER_IDS.ERROR_OVERLAY);
    errorOverlay.className = 'error-overlay hidden';
    errorOverlay.setAttribute('role', 'dialog');
    errorOverlay.setAttribute('aria-modal', 'true');
    errorOverlay.setAttribute('aria-label', 'Error');

    // Dev Menu Container
    const devMenu = ensureCanonicalContainerDiv(root, APP_SHELL_CONTAINER_IDS.DEV_MENU);
    devMenu.style.position = 'absolute';
    devMenu.style.top = '50%';
    devMenu.style.left = '50%';
    devMenu.style.transform = 'translate(-50%, -50%)';
    devMenu.style.padding = '20px';
    devMenu.style.borderRadius = '8px';
    devMenu.style.zIndex = '10000';
    devMenu.style.display = 'none';
    devMenu.style.minWidth = '300px';

    // Toast container (non-blocking warnings)
    const toastContainer = ensureCanonicalContainerDiv(root, APP_SHELL_CONTAINER_IDS.TOAST);
    toastContainer.className = 'app-toast';
    toastContainer.setAttribute('role', 'status');
    toastContainer.setAttribute('aria-live', 'polite');
    toastContainer.setAttribute('aria-atomic', 'true');
    toastContainer.style.position = 'fixed';
    toastContainer.style.left = '50%';
    toastContainer.style.bottom = '64px';
    toastContainer.style.transform = 'translateX(-50%)';
    toastContainer.style.maxWidth = '70%';
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

    const rootChildren = [
        videoContainer,
        runtimeChromeHost,
        epgContainer,
        nowPlayingInfoContainer,
        playbackOptionsContainer,
        exitConfirmContainer,
        splashContainer,
        authContainer,
        profileSelectContainer,
        serverSelectContainer,
        channelSetupContainer,
        audioSetupContainer,
        settingsContainer,
        errorOverlay,
        devMenu,
        toastContainer,
    ] as const;
    assertManagedChildren(root, rootChildren, 'AppContainerFactory root');
    reorderChildren(root, rootChildren);

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
