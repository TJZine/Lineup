/**
 * @jest-environment jsdom
 */

import { AudioSetupScreen } from '../AudioSetupScreen';
import { SETTINGS_STORAGE_KEYS } from '../../settings/constants';
import { AudioSettingsStore } from '../../../settings/AudioSettingsStore';

type StubFocusable = {
    id: string;
    neighbors: { up?: string; down?: string; left?: string; right?: string };
    onFocus?: () => void;
};

const createNavigationStub = (): {
    focusables: Map<string, StubFocusable>;
    registerFocusable: jest.Mock;
    unregisterFocusable: jest.Mock;
    setFocus: jest.Mock;
    getFocusedElement: jest.Mock;
} => {
    const focusables = new Map<string, StubFocusable>();
    let focusedId: string | null = null;

    return {
        focusables,
        registerFocusable: jest.fn((element: StubFocusable) => {
            focusables.set(element.id, element);
        }),
        unregisterFocusable: jest.fn((id: string) => {
            focusables.delete(id);
        }),
        setFocus: jest.fn((id: string) => {
            focusedId = id;
            const focusable = focusables.get(id);
            focusable?.onFocus?.();
        }),
        getFocusedElement: jest.fn(() => (focusedId ? ({ id: focusedId } as HTMLElement) : null)),
    };
};

describe('AudioSetupScreen', () => {
    beforeEach(() => {
        localStorage.removeItem(SETTINGS_STORAGE_KEYS.DTS_PASSTHROUGH);
        localStorage.removeItem(SETTINGS_STORAGE_KEYS.DIRECT_PLAY_AUDIO_FALLBACK);
        localStorage.removeItem(SETTINGS_STORAGE_KEYS.AUDIO_SETUP_COMPLETE);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('starts with no sound system choice and focuses TV speakers', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const nav = createNavigationStub();
        const screen = new AudioSetupScreen(container, () => nav as unknown as never, jest.fn());

        screen.show();

        const tvButton = container.querySelector('#audio-choice-tv-speakers');
        const continueBtn = container.querySelector('#audio-setup-continue') as HTMLButtonElement | null;

        expect(tvButton?.classList.contains('selected')).toBe(false);
        expect(continueBtn?.disabled).toBe(true);
        expect(nav.getFocusedElement()?.id).toBe('audio-choice-tv-speakers');
        expect(container.querySelector('#audio-setup-saved-values')?.textContent)
            .toContain('DTS passthrough — Default (not saved): Off');
        expect(container.textContent).not.toContain('Step 2 of 3');
    });

    it('shows saved DTS state without treating it as the user choice', () => {
        localStorage.setItem(SETTINGS_STORAGE_KEYS.DTS_PASSTHROUGH, '1');

        const container = document.createElement('div');
        document.body.appendChild(container);

        const nav = createNavigationStub();
        const screen = new AudioSetupScreen(container, () => nav as unknown as never, jest.fn());

        screen.show();

        const externalButton = container.querySelector('#audio-choice-external');
        expect(externalButton?.classList.contains('selected')).toBe(false);
        expect(container.querySelector('#audio-setup-saved-values')?.textContent)
            .toContain('DTS passthrough — Saved: On');
    });

    it('distinguishes invalid stored values from an effective default', () => {
        localStorage.setItem(SETTINGS_STORAGE_KEYS.DTS_PASSTHROUGH, 'invalid');
        const container = document.createElement('div');
        document.body.appendChild(container);
        const screen = new AudioSetupScreen(container, () => createNavigationStub() as unknown as never, jest.fn());

        screen.show();

        expect(container.querySelector('#audio-setup-saved-values')?.textContent)
            .toContain('DTS passthrough — Default (invalid stored value): Off');
        expect(container.querySelector('#audio-setup-saved-values')?.textContent)
            .not.toContain('DTS passthrough — Saved:');
    });

    it('labels unavailable reads separately from saved state and keeps the fallback choice actionable', () => {
        jest.spyOn(AudioSettingsStore.prototype, 'readDtsPassthroughState').mockReturnValue({
            kind: 'unavailable',
            effectiveValue: false,
        });
        jest.spyOn(AudioSettingsStore.prototype, 'readDirectPlayAudioFallbackState').mockReturnValue({
            kind: 'unavailable',
            effectiveValue: false,
        });
        const container = document.createElement('div');
        document.body.appendChild(container);
        const screen = new AudioSetupScreen(container, () => createNavigationStub() as unknown as never, jest.fn());

        screen.show();

        const summary = container.querySelector('#audio-setup-saved-values')?.textContent ?? '';
        const fallback = container.querySelector('#audio-direct-play-fallback') as HTMLButtonElement;
        expect(summary).toContain('DTS passthrough — Unavailable; default Off');
        expect(summary).toContain('Audio fallback — Unavailable; default Off');
        expect(fallback.getAttribute('aria-label')).toContain('Chosen: Off');
        expect(fallback.getAttribute('aria-label')).toContain('Unavailable; default Off');
        expect(fallback.getAttribute('aria-label')).not.toContain('Saved');
    });

    it('registers neighbors with explicit wiring', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const nav = createNavigationStub();
        const screen = new AudioSetupScreen(container, () => nav as unknown as never, jest.fn());

        screen.show();

        const external = nav.focusables.get('audio-choice-external');
        const tv = nav.focusables.get('audio-choice-tv-speakers');
        const fallback = nav.focusables.get('audio-direct-play-fallback');
        const cont = nav.focusables.get('audio-setup-continue');

        expect(external?.neighbors.right).toBe('audio-choice-tv-speakers');
        expect(external?.neighbors.down).toBe('audio-direct-play-fallback');

        expect(tv?.neighbors.left).toBe('audio-choice-external');
        expect(tv?.neighbors.down).toBe('audio-direct-play-fallback');

        expect(fallback?.neighbors.down).toBe('audio-setup-continue');
        expect(fallback?.neighbors.up).toBe('audio-choice-tv-speakers');

        expect(cont?.neighbors.up).toBe('audio-direct-play-fallback');
    });

    it('updates fallback up neighbor based on last-focused choice', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const nav = createNavigationStub();
        const screen = new AudioSetupScreen(container, () => nav as unknown as never, jest.fn());

        screen.show();
        nav.setFocus('audio-choice-external');

        const fallback = nav.focusables.get('audio-direct-play-fallback');
        expect(fallback?.neighbors.up).toBe('audio-choice-external');
    });

    it('renders SVG icons for audio choices', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const nav = createNavigationStub();
        const screen = new AudioSetupScreen(container, () => nav as unknown as never, jest.fn());

        screen.show();

        expect(container.querySelector('#audio-choice-external svg')).not.toBeNull();
        expect(container.querySelector('#audio-choice-tv-speakers svg')).not.toBeNull();
        expect(container.textContent).not.toContain('🔊');
        expect(container.textContent).not.toContain('📺');
    });

    it('renders audio choices inside horizontal row container', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const nav = createNavigationStub();
        const screen = new AudioSetupScreen(container, () => nav as unknown as never, jest.fn());

        screen.show();

        const row = container.querySelector('.audio-choice-row');
        expect(row).not.toBeNull();
        expect(container.querySelector('.setup-grid-2col')).toBeNull();
    });

    it('shows direct-play helper text immediately without delayed tooltip behavior', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const nav = createNavigationStub();
        const screen = new AudioSetupScreen(container, () => nav as unknown as never, jest.fn());

        screen.show();

        const helper = container.querySelector('#audio-direct-play-helper') as HTMLElement | null;
        expect(helper).not.toBeNull();
        expect(helper?.classList.contains('hidden')).toBe(false);
        expect(helper?.style.display).not.toBe('none');
    });

    it('hide and destroy do not rely on tooltip timers', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const nav = createNavigationStub();
        const screen = new AudioSetupScreen(container, () => nav as unknown as never, jest.fn());
        screen.show();

        expect(() => screen.hide()).not.toThrow();
        expect(() => screen.show()).not.toThrow();
        screen.destroy();
        expect(container.innerHTML).toBe('');
    });

    it('enables Continue only after a sound system choice', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const nav = createNavigationStub();
        const screen = new AudioSetupScreen(container, () => nav as unknown as never, jest.fn());

        screen.show();

        const continueBtn = container.querySelector('#audio-setup-continue') as HTMLButtonElement | null;
        expect(continueBtn?.disabled).toBe(true);

        const externalButton = container.querySelector('#audio-choice-external') as HTMLButtonElement | null;
        externalButton?.click();
        expect(continueBtn?.textContent).toBe('Continue');
        expect(continueBtn?.disabled).toBe(false);
    });

    it('delegates setup-complete reads through AudioSettingsStore', () => {
        const readSpy = jest.spyOn(AudioSettingsStore.prototype, 'readAudioSetupCompleteAndClean').mockReturnValue(true);
        expect(AudioSetupScreen.isSetupComplete()).toBe(true);
        expect(readSpy).toHaveBeenCalledWith(false);
        readSpy.mockRestore();
    });

    it('delegates setup-complete writes through AudioSettingsStore when continue is pressed', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const nav = createNavigationStub();
        const onComplete = jest.fn();
        const writeSetupCompleteSpy = jest.spyOn(AudioSettingsStore.prototype, 'writeAudioSetupComplete');

        const screen = new AudioSetupScreen(container, () => nav as unknown as never, onComplete);
        screen.show();

        const externalButton = container.querySelector('#audio-choice-external') as HTMLButtonElement | null;
        const continueButton = container.querySelector('#audio-setup-continue') as HTMLButtonElement | null;
        externalButton?.click();
        continueButton?.click();

        expect(writeSetupCompleteSpy).toHaveBeenCalledWith(true);
        expect(onComplete).toHaveBeenCalled();
        writeSetupCompleteSpy.mockRestore();
    });

    it.each([
        'writeDtsPassthroughEnabled',
        'writeDirectPlayAudioFallbackEnabled',
    ] as const)('keeps audio setup retryable when %s fails', (methodName) => {
        jest.spyOn(AudioSettingsStore.prototype, methodName).mockReturnValue({
            ok: false,
            reason: 'quota-exceeded',
        });
        const writeSetupCompleteSpy = jest.spyOn(AudioSettingsStore.prototype, 'writeAudioSetupComplete');
        const container = document.createElement('div');
        document.body.appendChild(container);
        const nav = createNavigationStub();
        const onComplete = jest.fn();
        const screen = new AudioSetupScreen(container, () => nav as unknown as never, onComplete);
        screen.show();

        (container.querySelector('#audio-choice-external') as HTMLButtonElement).click();
        (container.querySelector('#audio-setup-continue') as HTMLButtonElement).click();

        const status = container.querySelector('#audio-setup-status');
        expect(status?.textContent)
            .toBe('Audio settings were not fully saved. Current read results and retry choices are shown above.');
        expect(status?.getAttribute('role')).toBe('status');
        expect(status?.getAttribute('aria-live')).toBe('polite');
        expect(nav.getFocusedElement()?.id).toBe('audio-setup-continue');
        expect((container.querySelector('#audio-setup-continue') as HTMLButtonElement).textContent).toBe('Try again');
        expect(writeSetupCompleteSpy).not.toHaveBeenCalled();
        expect(onComplete).not.toHaveBeenCalled();
    });

    it('does not complete onboarding when the setup-complete marker cannot be persisted', () => {
        jest.spyOn(AudioSettingsStore.prototype, 'writeAudioSetupComplete').mockReturnValue({
            ok: false,
            reason: 'unavailable',
        });
        const container = document.createElement('div');
        document.body.appendChild(container);
        const nav = createNavigationStub();
        const onComplete = jest.fn();
        const screen = new AudioSetupScreen(container, () => nav as unknown as never, onComplete);
        screen.show();

        (container.querySelector('#audio-choice-external') as HTMLButtonElement).click();
        (container.querySelector('#audio-setup-continue') as HTMLButtonElement).click();

        expect(container.querySelector('#audio-setup-status')?.textContent).toBe(
            'Audio settings were not fully saved. Current read results and retry choices are shown above.'
        );
        expect(onComplete).not.toHaveBeenCalled();
    });

    it('keeps the saved audio values separate from the chosen retry state after a partial write', () => {
        localStorage.setItem(SETTINGS_STORAGE_KEYS.DTS_PASSTHROUGH, '1');
        localStorage.setItem(SETTINGS_STORAGE_KEYS.DIRECT_PLAY_AUDIO_FALLBACK, '0');
        jest.spyOn(AudioSettingsStore.prototype, 'writeDirectPlayAudioFallbackEnabled').mockReturnValue({
            ok: false,
            reason: 'quota-exceeded',
        });

        const container = document.createElement('div');
        document.body.appendChild(container);
        const nav = createNavigationStub();
        const onComplete = jest.fn();
        const screen = new AudioSetupScreen(container, () => nav as unknown as never, onComplete);
        screen.show();

        const tvSpeakersButton = container.querySelector('#audio-choice-tv-speakers') as HTMLButtonElement;
        const fallbackButton = container.querySelector('#audio-direct-play-fallback') as HTMLButtonElement;
        tvSpeakersButton.click();
        fallbackButton.click();
        (container.querySelector('#audio-setup-continue') as HTMLButtonElement).click();

        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.DTS_PASSTHROUGH)).toBe('0');
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.DIRECT_PLAY_AUDIO_FALLBACK)).toBe('0');
        expect(container.querySelector('#audio-setup-saved-values')?.textContent)
            .toBe('DTS passthrough — Saved: Off · Audio fallback — Saved: Off');
        expect(container.querySelector('#audio-choice-tv-speakers')?.classList.contains('saved')).toBe(true);
        expect(container.querySelector('#audio-choice-tv-speakers')?.classList.contains('selected')).toBe(true);
        expect(container.querySelector('#audio-direct-play-fallback .audio-fallback-state')?.textContent)
            .toBe('Saved: Off · Chosen for retry: On');
        expect((container.querySelector('#audio-setup-continue') as HTMLButtonElement).textContent).toBe('Try again');
        expect(nav.getFocusedElement()?.id).toBe('audio-setup-continue');
        expect(onComplete).not.toHaveBeenCalled();
    });

    it('re-reads both effective audio values after the final setup-complete write fails', () => {
        localStorage.setItem(SETTINGS_STORAGE_KEYS.DTS_PASSTHROUGH, '1');
        localStorage.setItem(SETTINGS_STORAGE_KEYS.DIRECT_PLAY_AUDIO_FALLBACK, '0');
        jest.spyOn(AudioSettingsStore.prototype, 'writeAudioSetupComplete').mockReturnValue({
            ok: false,
            reason: 'unavailable',
        });
        const readDtsSpy = jest.spyOn(AudioSettingsStore.prototype, 'readDtsPassthroughState');
        const readFallbackSpy = jest.spyOn(AudioSettingsStore.prototype, 'readDirectPlayAudioFallbackState');

        const container = document.createElement('div');
        document.body.appendChild(container);
        const onComplete = jest.fn();
        const screen = new AudioSetupScreen(container, () => createNavigationStub() as unknown as never, onComplete);
        screen.show();
        (container.querySelector('#audio-choice-tv-speakers') as HTMLButtonElement).click();
        (container.querySelector('#audio-setup-continue') as HTMLButtonElement).click();

        expect(readDtsSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
        expect(readFallbackSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
        expect(container.querySelector('#audio-setup-saved-values')?.textContent)
            .toBe('DTS passthrough — Saved: Off · Audio fallback — Saved: Off');
        expect(onComplete).not.toHaveBeenCalled();
    });
});
