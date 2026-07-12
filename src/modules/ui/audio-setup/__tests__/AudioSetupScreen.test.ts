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

    it('defaults to TV speakers when DTS passthrough not enabled', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const nav = createNavigationStub();
        const screen = new AudioSetupScreen(container, () => nav as unknown as never, jest.fn());

        screen.show();

        const tvButton = container.querySelector('#audio-choice-tv-speakers');
        const continueBtn = container.querySelector('#audio-setup-continue') as HTMLButtonElement | null;

        expect(tvButton?.classList.contains('selected')).toBe(true);
        expect(continueBtn?.disabled).toBe(false);
    });

    it('defaults to External when DTS passthrough enabled', () => {
        localStorage.setItem(SETTINGS_STORAGE_KEYS.DTS_PASSTHROUGH, '1');

        const container = document.createElement('div');
        document.body.appendChild(container);

        const nav = createNavigationStub();
        const screen = new AudioSetupScreen(container, () => nav as unknown as never, jest.fn());

        screen.show();

        const externalButton = container.querySelector('#audio-choice-external');
        expect(externalButton?.classList.contains('selected')).toBe(true);
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

    it('shows current-settings continue text until user explicitly chooses', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const nav = createNavigationStub();
        const screen = new AudioSetupScreen(container, () => nav as unknown as never, jest.fn());

        screen.show();

        const continueBtn = container.querySelector('#audio-setup-continue') as HTMLButtonElement | null;
        expect(continueBtn?.textContent).toContain('current settings');

        const externalButton = container.querySelector('#audio-choice-external') as HTMLButtonElement | null;
        externalButton?.click();
        expect(continueBtn?.textContent).toBe('Continue');
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

        (container.querySelector('#audio-setup-continue') as HTMLButtonElement).click();

        const status = container.querySelector('#audio-setup-status');
        expect(status?.textContent).toBe('Could not save audio settings. Check device storage and try again.');
        expect(status?.getAttribute('role')).toBe('status');
        expect(status?.getAttribute('aria-live')).toBe('polite');
        expect(nav.getFocusedElement()?.id).toBe('audio-setup-continue');
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

        (container.querySelector('#audio-setup-continue') as HTMLButtonElement).click();

        expect(container.querySelector('#audio-setup-status')?.textContent).toBe(
            'Could not save audio settings. Check device storage and try again.'
        );
        expect(onComplete).not.toHaveBeenCalled();
    });
});
