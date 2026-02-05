/**
 * @jest-environment jsdom
 */

import { AudioSetupScreen } from '../AudioSetupScreen';
import { SETTINGS_STORAGE_KEYS } from '../../settings/constants';

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
        document.body.innerHTML = '';
        jest.useRealTimers();
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

    it('shows tooltip after focus delay and hides immediately when focus moves away', () => {
        jest.useFakeTimers();
        const container = document.createElement('div');
        document.body.appendChild(container);

        const nav = createNavigationStub();
        const screen = new AudioSetupScreen(container, () => nav as unknown as never, jest.fn());

        screen.show();

        const tooltip = container.querySelector('#audio-direct-play-tooltip') as HTMLElement | null;
        expect(tooltip).not.toBeNull();
        expect(tooltip?.classList.contains('hidden')).toBe(true);

        nav.setFocus('audio-direct-play-fallback');
        expect(tooltip?.classList.contains('hidden')).toBe(true);

        jest.advanceTimersByTime(300);
        expect(tooltip?.classList.contains('hidden')).toBe(false);

        nav.setFocus('audio-setup-continue');
        expect(tooltip?.classList.contains('hidden')).toBe(true);
        jest.useRealTimers();
    });

    it('clears tooltip timer on hide and destroy', () => {
        jest.useFakeTimers();
        const container = document.createElement('div');
        document.body.appendChild(container);

        const nav = createNavigationStub();
        const screen = new AudioSetupScreen(container, () => nav as unknown as never, jest.fn());
        screen.show();

        const tooltip = container.querySelector('#audio-direct-play-tooltip') as HTMLElement | null;
        nav.setFocus('audio-direct-play-fallback');
        screen.hide();
        jest.advanceTimersByTime(301);
        expect(tooltip?.classList.contains('hidden')).toBe(true);

        screen.show();
        nav.setFocus('audio-direct-play-fallback');
        screen.destroy();
        expect(() => jest.advanceTimersByTime(301)).not.toThrow();
        expect(container.innerHTML).toBe('');
        jest.useRealTimers();
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
});
