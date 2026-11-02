import type { INavigationManager, FocusableElement } from '../../navigation';
import { DEFAULT_SETTINGS } from '../settings/constants';
import { setTrustedInlineSvg } from '../../../utils/inlineSvg';
import { AudioSettingsStore, type AudioPreferenceReadResult } from '../../settings/AudioSettingsStore';
import { createScreenShell } from '../common/ScreenShell';

interface AudioChoice {
    id: 'external' | 'tv-speakers';
    label: string;
    description: string;
    iconSvg: string;
}

const SOUND_BAR_SVG = `
<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" aria-hidden="true">
  <rect x="2" y="8" width="20" height="8" rx="2"></rect>
  <circle cx="7" cy="12" r="2"></circle>
  <circle cx="17" cy="12" r="2"></circle>
  <path d="M11 10h2v4h-2z"></path>
</svg>
`;

const TV_SVG = `
<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" aria-hidden="true">
  <rect x="2" y="4" width="20" height="14" rx="2"></rect>
  <path d="M8 21h8"></path>
  <path d="M12 18v3"></path>
</svg>
`;

const AUDIO_CHOICES: AudioChoice[] = [
    {
        id: 'external',
        label: 'Yes, I have a soundbar or receiver',
        description: 'Connected via HDMI eARC',
        iconSvg: SOUND_BAR_SVG,
    },
    {
        id: 'tv-speakers',
        label: 'No, using TV speakers',
        description: 'Best for built-in speakers. Turns off DTS passthrough.',
        iconSvg: TV_SVG,
    },
];

const AUDIO_SETTINGS_FAILURE_MESSAGE = 'Audio settings were not fully saved. Current read results and retry choices are shown above.';
const AUDIO_SETTINGS_HINT = 'This helps optimize audio playback. You can change this later in Settings.';

/**
 * Audio setup screen component.
 * Displayed during onboarding to configure audio preferences.
 */
export class AudioSetupScreen {
    private _container: HTMLElement;
    private _getNavigation: () => INavigationManager | null;
    private _onComplete: () => void;
    private _focusableIds: string[] = [];
    private _selectedChoice: AudioChoice['id'] | null = null;
    private _lastFocusedChoiceId: string = 'audio-choice-tv-speakers';
    private _fallbackFocusable: FocusableElement | null = null;
    private _savedDtsPassthrough: AudioPreferenceReadResult = {
        kind: 'default',
        effectiveValue: DEFAULT_SETTINGS.audio.dtsPassthrough,
        reason: 'missing',
    };
    private _savedDirectPlayAudioFallback: AudioPreferenceReadResult = {
        kind: 'default',
        effectiveValue: DEFAULT_SETTINGS.audio.directPlayAudioFallback,
        reason: 'missing',
    };
    private _directPlayFallbackEnabled: boolean;
    private _hasSaveFailure: boolean = false;
    private _savedSummaryEl: HTMLElement | null = null;
    private _fallbackStateEl: HTMLElement | null = null;
    private _statusEl: HTMLElement | null = null;
    private _choiceSavedStatusEls = new Map<AudioChoice['id'], HTMLElement>();
    private readonly _audioSettingsStore = new AudioSettingsStore();
    private _destroyScreenShell: (() => void) | null = null;

    constructor(
        container: HTMLElement,
        getNavigation: () => INavigationManager | null,
        onComplete: () => void
    ) {
        this._container = container;
        this._getNavigation = getNavigation;
        this._onComplete = onComplete;
        this._directPlayFallbackEnabled = DEFAULT_SETTINGS.audio.directPlayAudioFallback;
        this._buildUI();
    }

    private _buildUI(): void {
        this._container.className = 'screen onboarding-screen audio-setup-screen';
        this._container.id = 'audio-setup-screen';

        const shell = createScreenShell(this._container, {
            variant: 'onboarding',
            title: 'Audio Setup',
            subtitle: 'Do you have an external sound system?',
            status: null,
            error: null,
            actions: [
                {
                    id: 'audio-setup-continue',
                    label: 'Continue',
                    variant: 'primary',
                    disabled: true,
                    onSelect: (): void => this._applyAndContinue(),
                },
            ],
        });
        this._destroyScreenShell = shell.destroy;
        shell.panelEl.classList.add('audio-setup-shell');
        shell.contentEl.classList.add('audio-setup-content');
        shell.actionsEl.classList.add('audio-setup-actions');
        shell.statusEl.remove();
        shell.detailEl.remove();
        shell.errorEl.remove();

        const content = shell.contentEl;

        const choicesList = document.createElement('div');
        choicesList.className = 'audio-choice-row';

        for (const choice of AUDIO_CHOICES) {
            const button = document.createElement('button');
            button.id = `audio-choice-${choice.id}`;
            button.className = 'setup-toggle audio-choice';
            button.addEventListener('click', () => this._selectChoice(choice.id));

            const iconWrap = document.createElement('span');
            iconWrap.className = 'audio-choice-icon';
            iconWrap.setAttribute('aria-hidden', 'true');
            setTrustedInlineSvg(iconWrap, choice.iconSvg);

            const label = document.createElement('span');
            label.className = 'audio-choice-label';
            label.textContent = choice.label;

            const desc = document.createElement('span');
            desc.className = 'audio-choice-desc';
            desc.textContent = choice.description;

            const savedStatus = document.createElement('span');
            savedStatus.className = 'audio-choice-saved-status';
            savedStatus.setAttribute('aria-live', 'polite');
            this._choiceSavedStatusEls.set(choice.id, savedStatus);

            button.appendChild(iconWrap);
            button.appendChild(label);
            button.appendChild(desc);
            button.appendChild(savedStatus);
            choicesList.appendChild(button);
        }

        content.appendChild(choicesList);

        const savedSummary = document.createElement('p');
        savedSummary.id = 'audio-setup-saved-values';
        savedSummary.className = 'audio-saved-values';
        savedSummary.setAttribute('role', 'status');
        savedSummary.setAttribute('aria-live', 'polite');
        this._savedSummaryEl = savedSummary;
        content.appendChild(savedSummary);

        const advanced = document.createElement('div');
        advanced.className = 'audio-advanced-separator';
        advanced.textContent = 'Advanced';
        content.appendChild(advanced);

        const fallbackButton = document.createElement('button');
        fallbackButton.id = 'audio-direct-play-fallback';
        fallbackButton.className = `setup-toggle audio-fallback-toggle${this._directPlayFallbackEnabled ? ' selected' : ''}`;
        fallbackButton.setAttribute('role', 'switch');
        fallbackButton.setAttribute('aria-checked', String(this._directPlayFallbackEnabled));
        fallbackButton.setAttribute('aria-pressed', String(this._directPlayFallbackEnabled));

        const fallbackLabel = document.createElement('span');
        fallbackLabel.className = 'setup-toggle-label';
        fallbackLabel.textContent = 'Direct Play Audio Fallback';

        const fallbackMeta = document.createElement('span');
        fallbackMeta.className = 'setup-toggle-meta';
        fallbackMeta.textContent = 'Allow Direct Play using a compatible fallback audio track';

        const fallbackState = document.createElement('span');
        fallbackState.className = 'setup-toggle-state audio-fallback-state';
        this._fallbackStateEl = fallbackState;
        fallbackState.textContent = '';

        const fallbackSwitch = document.createElement('span');
        fallbackSwitch.className = 'audio-fallback-switch';
        fallbackSwitch.setAttribute('aria-hidden', 'true');

        fallbackButton.addEventListener('click', () => {
            this._directPlayFallbackEnabled = !this._directPlayFallbackEnabled;
            fallbackButton.classList.toggle('selected', this._directPlayFallbackEnabled);
            fallbackButton.setAttribute('aria-checked', String(this._directPlayFallbackEnabled));
            this._updateSavedValuePresentation();
            this._restoreStatus();
        });

        fallbackButton.appendChild(fallbackLabel);
        fallbackButton.appendChild(fallbackMeta);
        fallbackButton.appendChild(fallbackState);
        fallbackButton.appendChild(fallbackSwitch);
        content.appendChild(fallbackButton);

        const helper = document.createElement('div');
        helper.id = 'audio-direct-play-helper';
        helper.className = 'audio-helper';
        helper.textContent = 'Allow a compatible fallback track instead of transcoding. Recommended for most users.';
        content.appendChild(helper);

        const hint = document.createElement('p');
        hint.id = 'audio-setup-status';
        hint.className = 'screen-detail';
        hint.setAttribute('role', 'status');
        hint.setAttribute('aria-live', 'polite');
        hint.textContent = AUDIO_SETTINGS_HINT;
        this._statusEl = hint;
        content.appendChild(hint);

    }

    private _selectChoice(choiceId: AudioChoice['id']): void {
        this._restoreStatus();
        this._selectedChoice = choiceId;
        this._setLastFocusedChoiceId(`audio-choice-${choiceId}`);

        for (const choice of AUDIO_CHOICES) {
            const btn = this._container.querySelector(`#audio-choice-${choice.id}`) as HTMLButtonElement | null;
            if (btn) {
                if (choice.id === choiceId) {
                    btn.classList.add('selected');
                    btn.setAttribute('aria-pressed', 'true');
                } else {
                    btn.classList.remove('selected');
                    btn.setAttribute('aria-pressed', 'false');
                }
            }
        }
        this._updateSavedValuePresentation();

        const continueBtn = this._container.querySelector('#audio-setup-continue') as HTMLButtonElement | null;
        if (continueBtn) {
            continueBtn.disabled = false;
            continueBtn.textContent = this._hasSaveFailure ? 'Try again' : 'Continue';
        }
        this._restoreStatus();
    }

    private _applyAndContinue(): void {
        if (!this._selectedChoice) return;

        const dtsResult = this._audioSettingsStore.writeDtsPassthroughEnabled(
            this._selectedChoice === 'external'
        );
        if (!dtsResult.ok) {
            this._showPersistenceFailure();
            return;
        }

        const fallbackResult = this._audioSettingsStore.writeDirectPlayAudioFallbackEnabled(
            this._directPlayFallbackEnabled
        );
        if (!fallbackResult.ok) {
            this._showPersistenceFailure();
            return;
        }

        const setupCompleteResult = this._audioSettingsStore.writeAudioSetupComplete(true);
        if (!setupCompleteResult.ok) {
            this._showPersistenceFailure();
            return;
        }
        this._onComplete();
    }

    private _showPersistenceFailure(): void {
        this._hasSaveFailure = true;
        this._refreshSavedAudioValues();
        if (this._statusEl) {
            this._statusEl.textContent = AUDIO_SETTINGS_FAILURE_MESSAGE;
            this._statusEl.classList.add('audio-setup-error');
        }
        const continueBtn = this._container.querySelector('#audio-setup-continue') as HTMLButtonElement | null;
        if (continueBtn) continueBtn.textContent = 'Try again';
        this._getNavigation()?.setFocus('audio-setup-continue');
    }

    private _restoreStatus(): void {
        if (this._hasSaveFailure) return;
        if (this._statusEl) {
            this._statusEl.textContent = AUDIO_SETTINGS_HINT;
            this._statusEl.classList.remove('audio-setup-error');
        }
        const continueBtn = this._container.querySelector('#audio-setup-continue') as HTMLButtonElement | null;
        if (continueBtn) continueBtn.textContent = 'Continue';
    }

    private _refreshSavedAudioValues(): void {
        this._savedDtsPassthrough = this._audioSettingsStore.readDtsPassthroughState(
            DEFAULT_SETTINGS.audio.dtsPassthrough
        );
        this._savedDirectPlayAudioFallback = this._audioSettingsStore.readDirectPlayAudioFallbackState(
            DEFAULT_SETTINGS.audio.directPlayAudioFallback
        );
        this._updateSavedValuePresentation();
    }

    private _updateSavedValuePresentation(): void {
        const fallbackChosenLabel = this._enabledLabel(this._directPlayFallbackEnabled);
        const fallbackChoiceLabel = this._hasSaveFailure
            ? `Chosen for retry: ${fallbackChosenLabel}`
            : `Chosen: ${fallbackChosenLabel}`;
        if (this._savedSummaryEl) {
            this._savedSummaryEl.textContent = `DTS passthrough — ${this._preferenceStateLabel(this._savedDtsPassthrough)} · Audio fallback — ${this._preferenceStateLabel(this._savedDirectPlayAudioFallback)}`;
        }

        const fallbackButton = this._container.querySelector('#audio-direct-play-fallback') as HTMLButtonElement | null;
        if (this._fallbackStateEl) {
            this._fallbackStateEl.textContent = `${this._preferenceStateLabel(this._savedDirectPlayAudioFallback)} · ${fallbackChoiceLabel}`;
        }
        fallbackButton?.setAttribute('aria-checked', String(this._directPlayFallbackEnabled));
        fallbackButton?.setAttribute('aria-pressed', String(this._directPlayFallbackEnabled));
        fallbackButton?.classList.toggle('selected', this._directPlayFallbackEnabled);
        fallbackButton?.setAttribute('aria-label',
            `Direct Play Audio Fallback. ${fallbackChoiceLabel}. ${this._preferenceStateLabel(this._savedDirectPlayAudioFallback)}.`
        );

        for (const choice of AUDIO_CHOICES) {
            const button = this._container.querySelector(`#audio-choice-${choice.id}`) as HTMLButtonElement | null;
            const status = this._choiceSavedStatusEls.get(choice.id);
            if (!button || !status) continue;
            const chosenDts = choice.id === 'external';
            const isSelected = this._selectedChoice === choice.id;
            const isSaved = this._savedDtsPassthrough.kind === 'stored'
                && this._savedDtsPassthrough.value === chosenDts;
            button.setAttribute('aria-pressed', String(isSelected));
            button.classList.toggle('saved', isSelected && isSaved);
            status.textContent = !isSelected
                ? ''
                : isSaved
                    ? 'This sound system is saved'
                    : this._hasSaveFailure
                        ? 'Chosen for retry'
                        : 'Chosen; not saved';
        }
    }

    private _effectiveValue(result: AudioPreferenceReadResult): boolean {
        return result.kind === 'stored' ? result.value : result.effectiveValue;
    }

    private _preferenceStateLabel(result: AudioPreferenceReadResult): string {
        if (result.kind === 'stored') {
            return `Saved: ${this._enabledLabel(result.value)}`;
        }
        if (result.kind === 'default') {
            const reason = result.reason === 'missing' ? 'not saved' : 'invalid stored value';
            return `Default (${reason}): ${this._enabledLabel(result.effectiveValue)}`;
        }
        return `Unavailable; default ${this._enabledLabel(result.effectiveValue)}`;
    }

    private _enabledLabel(enabled: boolean): string {
        return enabled ? 'On' : 'Off';
    }

    public static isSetupComplete(): boolean {
        return new AudioSettingsStore().readAudioSetupCompleteAndClean(false);
    }

    public show(): void {
        this._container.classList.add('visible');
        this._refreshSavedAudioValues();
        this._directPlayFallbackEnabled = this._effectiveValue(this._savedDirectPlayAudioFallback);
        this._updateSavedValuePresentation();
        this._ensureInitialSelectionAndState();
        this._registerFocusables();
    }

    public hide(): void {
        this._container.classList.remove('visible');
        this._unregisterFocusables();
    }

    private _registerFocusables(preferredFocusId?: string): void {
        const nav = this._getNavigation();
        if (!nav) return;

        const externalBtn = this._container.querySelector('#audio-choice-external') as HTMLButtonElement | null;
        const tvBtn = this._container.querySelector('#audio-choice-tv-speakers') as HTMLButtonElement | null;
        const fallbackBtn = this._container.querySelector('#audio-direct-play-fallback') as HTMLButtonElement | null;
        const continueBtn = this._container.querySelector('#audio-setup-continue') as HTMLButtonElement | null;

        this._fallbackFocusable = null;
        const focusables: FocusableElement[] = [];

        if (externalBtn) {
            const neighbors: FocusableElement['neighbors'] = {};
            if (tvBtn?.id) neighbors.right = tvBtn.id;
            if (fallbackBtn?.id) neighbors.down = fallbackBtn.id;
            focusables.push({
                id: externalBtn.id,
                element: externalBtn,
                neighbors,
                onFocus: () => {
                    this._setLastFocusedChoiceId(externalBtn.id);
                },
                onSelect: () => externalBtn.click(),
            });
        }

        if (tvBtn) {
            const neighbors: FocusableElement['neighbors'] = {};
            if (externalBtn?.id) neighbors.left = externalBtn.id;
            if (fallbackBtn?.id) neighbors.down = fallbackBtn.id;
            focusables.push({
                id: tvBtn.id,
                element: tvBtn,
                neighbors,
                onFocus: () => {
                    this._setLastFocusedChoiceId(tvBtn.id);
                },
                onSelect: () => tvBtn.click(),
            });
        }

        if (fallbackBtn) {
            const neighbors: FocusableElement['neighbors'] = {};
            if (this._lastFocusedChoiceId) neighbors.up = this._lastFocusedChoiceId;
            if (continueBtn?.id) neighbors.down = continueBtn.id;
            const fallbackFocusable: FocusableElement = {
                id: fallbackBtn.id,
                element: fallbackBtn,
                neighbors,
                onSelect: () => fallbackBtn.click(),
            };
            this._fallbackFocusable = fallbackFocusable;
            focusables.push(fallbackFocusable);
        }

        if (continueBtn) {
            const neighbors: FocusableElement['neighbors'] = {};
            if (fallbackBtn?.id) neighbors.up = fallbackBtn.id;
            focusables.push({
                id: continueBtn.id,
                element: continueBtn,
                neighbors,
                onSelect: () => continueBtn.click(),
            });
        }

        this._focusableIds = focusables.map((focusable) => focusable.id);

        for (const focusable of focusables) {
            nav.registerFocusable(focusable);
        }

        const selectedChoiceId = this._selectedChoice ? `audio-choice-${this._selectedChoice}` : null;
        const fallbackFocusId = this._lastFocusedChoiceId;
        const focusId = preferredFocusId && this._focusableIds.includes(preferredFocusId)
            ? preferredFocusId
            : (selectedChoiceId && this._focusableIds.includes(selectedChoiceId)
                ? selectedChoiceId
                : (fallbackFocusId && this._focusableIds.includes(fallbackFocusId) ? fallbackFocusId : null));
        if (focusId) {
            nav.setFocus(focusId);
        }
    }

    private _setLastFocusedChoiceId(choiceId: string): void {
        this._lastFocusedChoiceId = choiceId;
        if (this._fallbackFocusable) {
            this._fallbackFocusable.neighbors.up = this._lastFocusedChoiceId;
        }
    }

    private _ensureInitialSelectionAndState(): void {
        if (this._selectedChoice) {
            const continueBtnExisting = this._container.querySelector('#audio-setup-continue') as HTMLButtonElement | null;
            if (continueBtnExisting) {
                continueBtnExisting.disabled = false;
                continueBtnExisting.textContent = this._hasSaveFailure ? 'Try again' : 'Continue';
            }
            return;
        }
        const continueBtn = this._container.querySelector('#audio-setup-continue') as HTMLButtonElement | null;
        if (continueBtn) {
            continueBtn.disabled = true;
            continueBtn.textContent = 'Continue';
        }
        this._lastFocusedChoiceId = 'audio-choice-tv-speakers';
        this._updateSavedValuePresentation();
    }

    private _unregisterFocusables(): void {
        const nav = this._getNavigation();
        if (!nav) return;

        for (const id of this._focusableIds) {
            nav.unregisterFocusable(id);
        }
        this._focusableIds = [];
        this._fallbackFocusable = null;
    }

    public destroy(): void {
        this._unregisterFocusables();
        this._destroyScreenShell?.();
        this._destroyScreenShell = null;
    }
}
