/** @jest-environment jsdom */
import { SettingsScreen } from '../SettingsScreen';
import { activateCategory } from './settings-screen-test-helpers';
import { NavigationManager } from '../../../navigation';
import { LINEUP_STORAGE_KEYS } from '../../../../config/storageKeys';
import type { PlatformRemoteButton } from '../../../../platform/services';

const openScreens: Array<{ screen: SettingsScreen; nav: NavigationManager }> = [];
function press(keyCode: number, target: EventTarget = document): void {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'keyCode', { value: keyCode });
    target.dispatchEvent(event);
    const up = new KeyboardEvent('keyup', { bubbles: true });
    Object.defineProperty(up, 'keyCode', { value: keyCode });
    target.dispatchEvent(up);
}
function createScreen(): { host: HTMLElement; nav: NavigationManager; screen: SettingsScreen } {
    const host = document.createElement('div');
    document.body.append(host);
    const nav = new NavigationManager({ getKeyMap: (): ReadonlyMap<number, PlatformRemoteButton> => new Map([
        [13, 'ok'], [38, 'up'], [40, 'down'], [461, 'back'], [71, 'guide'],
        [89, 'yellow'], [49, 'num1'], [73, 'info'],
    ] as const) });
    nav.initialize({
        enablePointerMode: true, keyRepeatDelayMs: 500, keyRepeatIntervalMs: 100,
        focusMemoryEnabled: true, debugMode: false,
    });
    nav.replaceScreen('settings');
    const screen = new SettingsScreen({ container: host, getNavigation: (): NavigationManager => nav });
    screen.show();
    activateCategory(host, 'support');
    openScreens.push({ screen, nav });
    return { host, nav, screen };
}

beforeEach(() => localStorage.clear());
afterEach(() => {
    for (const { screen, nav } of openScreens.splice(0)) { screen.destroy(); nav.destroy(); }
    document.body.replaceChildren(); jest.restoreAllMocks();
});

it('exposes consent and offline notices without network, then restores its invoker on remote Back', () => {
    expect(globalThis.fetch).toBeUndefined();
    const { host, nav } = createScreen();
    expect(host.querySelector('#settings-support-report-opt-in')?.textContent).toContain('Collect Support Report');
    nav.setFocus('settings-support-notices');
    press(13);
    expect(nav.isModalOpen('settings-support-reader')).toBe(true);
    expect(host.querySelector('.support-reader-body')?.textContent).toContain('SIL OPEN FONT LICENSE');
    expect(host.querySelector('.support-reader-body')?.textContent).toContain('LG webOSTV.js');
    expect(nav.getState().focusedElementId).toBe('support-reader-body');
    press(461);
    expect(nav.isModalOpen()).toBe(false);
    expect(host.querySelector('.support-reader')).toBeNull();
    expect(nav.getState().focusedElementId).toBe('settings-support-notices');
});

it('shows a local-only report and a truthful clear result', async () => {
    const { host, nav } = createScreen();
    host.querySelector<HTMLButtonElement>('#settings-support-report-opt-in')?.click();
    expect(localStorage.getItem(LINEUP_STORAGE_KEYS.SUPPORT_REPORT_OPT_IN)).toBe('1');
    nav.setFocus('settings-support-view-report'); press(13);
    expect(host.querySelector('.support-reader-body')?.textContent).toContain('"platform": "webOS TV"');
    expect(host.querySelector('.support-reader-body')?.textContent).not.toContain('lineup_debug_issue_log');
    host.querySelector<HTMLButtonElement>('#support-reader-close')?.click();
    host.querySelector<HTMLButtonElement>('#settings-support-clear-report')?.click();
    await Promise.resolve();
    expect(host.querySelector('#settings-support-clear-report')?.parentElement?.textContent).toContain('Local report cleared.');
});

it('opens the same Support category from recovery and focuses its category entry', () => {
    const { host, nav, screen } = createScreen();
    activateCategory(host, 'guide');
    screen.showSupport();
    expect(host.querySelector('#settings-support-view-report')).not.toBeNull();
    expect(nav.getState().focusedElementId).toBe('settings-category-support');
});

it('shows an effective Off state and cleanup retry when consent clears but report removal fails', () => {
    const { host } = createScreen();
    const toggle = host.querySelector<HTMLButtonElement>('#settings-support-report-opt-in');
    toggle?.click();
    localStorage.setItem(LINEUP_STORAGE_KEYS.SUPPORT_REPORT, '{"version":1,"events":[]}');
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    toggle?.click();
    expect(toggle?.getAttribute('aria-checked')).toBe('false');
    expect(toggle?.parentElement?.textContent).toContain('Use Clear local report to retry');
    expect(localStorage.getItem(LINEUP_STORAGE_KEYS.SUPPORT_REPORT_OPT_IN)).toBe('0');
});

it('protected reader scrolls on D-pad and blocks Guide, Yellow, number and Info commands', () => {
    const { host, nav } = createScreen();
    const guide = jest.fn(), settings = jest.fn(), number = jest.fn();
    nav.on('guide', guide); nav.on('settings', settings); nav.on('channelNumberEntered', number);
    nav.setFocus('settings-support-notices'); press(13);
    const body = host.querySelector<HTMLElement>('#support-reader-body');
    if (!body) throw new Error('Notices body missing');
    press(40, body);
    expect(body.scrollTop).toBe(80);
    expect(nav.getState().focusedElementId).toBe('support-reader-body');
    press(71); press(89); press(49); press(73);
    expect(guide).not.toHaveBeenCalled(); expect(settings).not.toHaveBeenCalled();
    expect(number).not.toHaveBeenCalled();
    expect(nav.getCurrentScreen()).toBe('settings');
    expect(nav.isModalOpen('settings-support-reader')).toBe(true);
    nav.closeModal('settings-support-reader');
    expect(host.querySelector('.support-reader')).toBeNull();
    expect(nav.getState().focusedElementId).toBe('settings-support-notices');
});

it('cleans modal ownership on hide and refuses a reader when navigation blocks modal opening', () => {
    const { host, nav, screen } = createScreen();
    nav.blockInput();
    host.querySelector<HTMLButtonElement>('#settings-support-notices')?.click();
    expect(nav.isModalOpen()).toBe(false);
    expect(host.querySelector('.support-reader')).toBeNull();
    expect(host.querySelector('#settings-support-notices')?.parentElement?.textContent).toContain('Reader could not open');
    nav.unblockInput();
    host.querySelector<HTMLButtonElement>('#settings-support-notices')?.click();
    expect(nav.isModalOpen('settings-support-reader')).toBe(true);
    screen.hide();
    expect(nav.isModalOpen()).toBe(false);
    expect(host.querySelector('.support-reader')).toBeNull();
});
