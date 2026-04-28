import { LINEUP_STORAGE_KEYS } from '../../config/storageKeys';

export interface AppDiagnosticsDevMenuElements {
    container: HTMLElement;
    resetButton: HTMLButtonElement;
    closeButton: HTMLButtonElement;
    refreshButton: HTMLButtonElement;
    copySummaryButton: HTMLButtonElement;
    copyRawButton: HTMLButtonElement;
    playbackPre: HTMLPreElement;
    directPlayAudioFallbackEl: HTMLInputElement;
    nowPlayingStreamDebugEl: HTMLInputElement;
    nowPlayingStreamDebugAutoEl: HTMLInputElement;
    profileNameSelect: HTMLSelectElement;
    saveOverridesButton: HTMLButtonElement;
    clearOverridesButton: HTMLButtonElement;
}

interface AppDiagnosticsOverridesSection {
    section: HTMLDetailsElement;
    directPlayAudioFallbackEl: HTMLInputElement;
    nowPlayingStreamDebugEl: HTMLInputElement;
    nowPlayingStreamDebugAutoEl: HTMLInputElement;
    profileNameSelect: HTMLSelectElement;
    saveOverridesButton: HTMLButtonElement;
    clearOverridesButton: HTMLButtonElement;
}

interface AppDiagnosticsPlaybackSection {
    section: HTMLDetailsElement;
    refreshButton: HTMLButtonElement;
    copySummaryButton: HTMLButtonElement;
    copyRawButton: HTMLButtonElement;
    playbackPre: HTMLPreElement;
}

interface AppDiagnosticsFooterActions {
    resetButton: HTMLButtonElement;
    closeButton: HTMLButtonElement;
}

export function renderAppDiagnosticsDevMenu(container: HTMLElement): AppDiagnosticsDevMenuElements {
    const heading = createElement('h2', {
        textContent: 'Dev Menu',
        cssText: 'margin-top:0;border-bottom:1px solid #444;padding-bottom:10px;',
    });
    const storageInfo = createStorageInfo();
    const stack = createElement('div', {
        cssText: 'display:flex;flex-direction:column;gap:10px;',
    });
    const overrides = createOverridesSection();
    const playback = createPlaybackSection();
    const footerActions = createFooterActions();

    stack.append(overrides.section, playback.section, footerActions.resetButton, footerActions.closeButton);
    container.replaceChildren(heading, storageInfo, stack);

    return {
        container,
        resetButton: footerActions.resetButton,
        closeButton: footerActions.closeButton,
        refreshButton: playback.refreshButton,
        copySummaryButton: playback.copySummaryButton,
        copyRawButton: playback.copyRawButton,
        playbackPre: playback.playbackPre,
        directPlayAudioFallbackEl: overrides.directPlayAudioFallbackEl,
        nowPlayingStreamDebugEl: overrides.nowPlayingStreamDebugEl,
        nowPlayingStreamDebugAutoEl: overrides.nowPlayingStreamDebugAutoEl,
        profileNameSelect: overrides.profileNameSelect,
        saveOverridesButton: overrides.saveOverridesButton,
        clearOverridesButton: overrides.clearOverridesButton,
    };
}

function createStorageInfo(): HTMLDivElement {
    const storageInfo = createElement('div', {
        cssText: 'margin-bottom:15px;color:#aaa;font-size:13px;',
    });
    storageInfo.append('Storage keys: ');
    const channelsKey = createElement('code', { id: 'dev-storage-key-channels' });
    const currentChannelKey = createElement('code', { id: 'dev-storage-key-current' });
    channelsKey.textContent = LINEUP_STORAGE_KEYS.CHANNELS_REAL;
    currentChannelKey.textContent = LINEUP_STORAGE_KEYS.CURRENT_CHANNEL;
    storageInfo.append(channelsKey, ', ', currentChannelKey);
    return storageInfo;
}

function createOverridesSection(): AppDiagnosticsOverridesSection {
    const overridesSection = createElement('details', {
        cssText: 'border:1px solid #333;border-radius:8px;padding:10px;',
    });
    overridesSection.append(
        createElement('summary', {
            textContent: 'Plex Debug Overrides',
            cssText: 'cursor:pointer;color:#ddd;',
        })
    );
    const overridesBody = createElement('div', {
        cssText: 'display:flex;flex-direction:column;gap:8px;margin-top:10px;',
    });

    const directPlayLabel = createElement('label', {
        cssText: 'font-size:13px;color:#aaa;',
    });
    const directPlayAudioFallbackEl = createElement('input', {
        id: 'dev-directplay-audio-fallback',
    });
    directPlayAudioFallbackEl.type = 'checkbox';
    directPlayLabel.append(
        directPlayAudioFallbackEl,
        ' Try Direct Play using fallback audio track (lineup_direct_play_audio_fallback=1)'
    );

    const streamDebugHeader = createElement('div', {
        textContent: 'Now Playing Stream Debug (overlay)',
        cssText: 'margin-top:6px;font-size:12px;color:#888;',
    });

    const nowPlayingStreamDebugLabel = createElement('label', {
        cssText: 'font-size:13px;color:#aaa;',
    });
    const nowPlayingStreamDebugEl = createElement('input', {
        id: 'dev-nowplaying-stream-debug',
    });
    nowPlayingStreamDebugEl.type = 'checkbox';
    nowPlayingStreamDebugLabel.append(
        nowPlayingStreamDebugEl,
        ' Show stream decision in Show Info overlay (lineup_now_playing_stream_debug=1)'
    );

    const nowPlayingStreamDebugAutoLabel = createElement('label', {
        cssText: 'font-size:13px;color:#aaa;',
    });
    const nowPlayingStreamDebugAutoEl = createElement('input', {
        id: 'dev-nowplaying-stream-debug-auto',
    });
    nowPlayingStreamDebugAutoEl.type = 'checkbox';
    nowPlayingStreamDebugAutoLabel.append(
        nowPlayingStreamDebugAutoEl,
        ' Auto-open Show Info on tune when debug is enabled (lineup_now_playing_stream_debug_auto_show=1)'
    );

    const profileLabel = createElement('label', {
        textContent: 'Forced Client Profile Name',
        cssText: 'font-size:13px;color:#aaa;',
    });
    const profileNameSelect = createElement('select', {
        id: 'dev-transcode-profile-name',
        cssText: 'margin-left:8px;padding:6px;',
    });
    for (const [value, label] of [
        ['', '(default)'],
        ['HTML TV App', 'HTML TV App'],
        ['Generic', 'Generic'],
    ] as const) {
        profileNameSelect.append(createElement('option', { textContent: label, attributes: { value } }));
    }
    profileLabel.append(' ', profileNameSelect);

    const overrideButtons = createElement('div', {
        cssText: 'display:flex;gap:10px;margin-top:6px;',
    });
    const saveOverridesButton = createElement('button', {
        id: 'dev-transcode-save',
        textContent: 'Save Overrides',
        cssText: 'padding:8px;cursor:pointer;',
    });
    const clearOverridesButton = createElement('button', {
        id: 'dev-transcode-clear',
        textContent: 'Clear Overrides',
        cssText: 'padding:8px;cursor:pointer;background:#500;color:#fff;border:none;',
    });
    overrideButtons.append(saveOverridesButton, clearOverridesButton);

    const overrideNote = createElement('div', {
        textContent: 'Forced profile affects only transcode URL generation. Tokens are never shown.',
        cssText: 'font-size:12px;color:#888;margin-top:6px;',
    });
    overridesBody.append(
        directPlayLabel,
        streamDebugHeader,
        nowPlayingStreamDebugLabel,
        nowPlayingStreamDebugAutoLabel,
        profileLabel,
        overrideButtons,
        overrideNote
    );
    overridesSection.append(overridesBody);

    return {
        section: overridesSection,
        directPlayAudioFallbackEl,
        nowPlayingStreamDebugEl,
        nowPlayingStreamDebugAutoEl,
        profileNameSelect,
        saveOverridesButton,
        clearOverridesButton,
    };
}

function createPlaybackSection(): AppDiagnosticsPlaybackSection {
    const playbackSection = createElement('details', {
        cssText: 'border:1px solid #333;border-radius:8px;padding:10px;',
    });
    playbackSection.append(
        createElement('summary', {
            textContent: 'Playback Info (PMS Decision)',
            cssText: 'cursor:pointer;color:#ddd;',
        })
    );
    const playbackBody = createElement('div', {
        cssText: 'display:flex;flex-direction:column;gap:8px;margin-top:10px;',
    });
    const playbackActions = createElement('div', {
        cssText: 'display:flex;gap:10px;align-items:center;',
    });
    const refreshButton = createElement('button', {
        id: 'dev-playback-refresh',
        textContent: 'Refresh',
        cssText: 'padding:8px;cursor:pointer;',
    });
    const copySummaryButton = createElement('button', {
        id: 'dev-playback-copy-summary',
        textContent: 'Copy Summary',
        cssText: 'padding:8px;cursor:pointer;',
    });
    const copyRawButton = createElement('button', {
        id: 'dev-playback-copy-raw',
        textContent: 'Copy Raw',
        cssText: 'padding:8px;cursor:pointer;',
    });
    const playbackTip = createElement('span', {
        textContent: 'Tip: Ctrl+Shift+D (desktop) or run window.lineup.toggleDevMenu() in the console',
        cssText: 'font-size:12px;color:#888;',
    });
    playbackActions.append(refreshButton, copySummaryButton, copyRawButton, playbackTip);

    const playbackPre = createElement('pre', {
        id: 'dev-playback-info',
        cssText: 'margin:0;max-height:260px;overflow:auto;background:#111;border:1px solid #333;border-radius:6px;padding:10px;color:#ddd;font-size:12px;line-height:1.35;white-space:pre-wrap;',
    });
    const playbackNote = createElement('div', {
        textContent: "Shows Lineup's local decision and (when transcoding) the server's universal transcode decision.",
        cssText: 'font-size:12px;color:#888;',
    });
    playbackBody.append(playbackActions, playbackPre, playbackNote);
    playbackSection.append(playbackBody);

    return {
        section: playbackSection,
        refreshButton,
        copySummaryButton,
        copyRawButton,
        playbackPre,
    };
}

function createFooterActions(): AppDiagnosticsFooterActions {
    const resetButton = createElement('button', {
        id: 'dev-reset-app',
        textContent: 'Reset Lineup Storage',
        cssText: 'padding:10px;cursor:pointer;background:#500;color:#fff;border:none;',
    });
    const closeButton = createElement('button', {
        id: 'dev-close',
        textContent: 'Close',
        cssText: 'padding:10px;cursor:pointer;margin-top:10px;',
    });

    return {
        resetButton,
        closeButton,
    };
}

function createElement<K extends keyof HTMLElementTagNameMap>(
    tagName: K,
    options?: {
        id?: string;
        className?: string;
        textContent?: string;
        cssText?: string;
        attributes?: Record<string, string>;
    }
): HTMLElementTagNameMap[K] {
    const element = document.createElement(tagName);
    if (options?.id) {
        element.id = options.id;
    }
    if (options?.className) {
        element.className = options.className;
    }
    if (typeof options?.textContent === 'string') {
        element.textContent = options.textContent;
    }
    if (options?.cssText) {
        element.style.cssText = options.cssText;
    }
    if (options?.attributes) {
        for (const [name, value] of Object.entries(options.attributes)) {
            element.setAttribute(name, value);
        }
    }
    return element;
}
