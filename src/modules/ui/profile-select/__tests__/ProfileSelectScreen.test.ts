/**
 * @jest-environment jsdom
 */

import { ProfileSelectScreen, type ProfileSelectScreenPorts } from '../ProfileSelectScreen';
import { PlexApiError } from '../../../plex/auth';
import { AppErrorCode } from '../../../../types/app-errors';
import { ProfileSessionStore } from '../../../settings/ProfileSessionStore';
import { LINEUP_STORAGE_KEYS } from '../../../../config/storageKeys';
import { createDeferred } from '../../../../__tests__/helpers';

type NavigationStub = {
    registerFocusable: jest.Mock;
    unregisterFocusable: jest.Mock;
    setFocus: jest.Mock;
    openModal: jest.Mock;
    closeModal: jest.Mock;
    restoreFocusForCurrentScreen: jest.Mock;
    getCurrentScreen: jest.Mock;
    on: jest.Mock;
    off: jest.Mock;
    goTo: jest.Mock;
    replaceScreen: jest.Mock;
    __handlers: Record<string, ((event: unknown) => void) | undefined>;
};

const createNavigationStub = (): NavigationStub => ({
    registerFocusable: jest.fn(),
    unregisterFocusable: jest.fn(),
    setFocus: jest.fn(),
    openModal: jest.fn(),
    closeModal: jest.fn(),
    restoreFocusForCurrentScreen: jest.fn().mockReturnValue(false),
    getCurrentScreen: jest.fn().mockReturnValue('profile-select'),
    __handlers: {},
    on: jest.fn(function (this: NavigationStub, event: string, handler: (payload: unknown) => void) {
        this.__handlers[event] = handler;
    }),
    off: jest.fn(function (this: NavigationStub, event: string, _handler: (payload: unknown) => void) {
        delete this.__handlers[event];
    }),
    goTo: jest.fn(),
    replaceScreen: jest.fn(),
});

type OrchestratorStub = {
    getNavigation: () => NavigationStub;
    getHomeUsers: jest.Mock<Promise<Array<{
        id: string;
        title: string;
        thumb: string | null;
        admin: boolean;
        protected: boolean;
        restricted?: boolean;
    }>>, []>;
    switchHomeUser: jest.Mock;
    useMainAccountProfile: jest.Mock;
    signOutPlex: jest.Mock;
};

const createOrchestratorStub = (users: Array<{
    id: string;
    title: string;
    thumb: string | null;
    admin: boolean;
    protected: boolean;
    restricted?: boolean;
}>): OrchestratorStub => {
    const navigation = createNavigationStub();
    return {
        getNavigation: () => navigation,
        getHomeUsers: jest.fn().mockResolvedValue(users),
        switchHomeUser: jest.fn().mockResolvedValue(undefined),
        useMainAccountProfile: jest.fn().mockResolvedValue(undefined),
        signOutPlex: jest.fn().mockResolvedValue(undefined),
    };
};

const settleScreen = async (screen: ProfileSelectScreen): Promise<void> => {
    const idle = screen.whenIdle();
    await jest.runAllTimersAsync();
    await idle;
};

describe('ProfileSelectScreen', () => {
    let profileSessionStore: ProfileSessionStore;
    const expectedPinFocusableIds = [
        'btn-profile-pin-1',
        'btn-profile-pin-2',
        'btn-profile-pin-3',
        'btn-profile-pin-4',
        'btn-profile-pin-5',
        'btn-profile-pin-6',
        'btn-profile-pin-7',
        'btn-profile-pin-8',
        'btn-profile-pin-9',
        'btn-profile-pin-backspace',
        'btn-profile-pin-0',
        'btn-profile-pin-cancel',
    ];

    beforeEach(() => {
        jest.useFakeTimers();
        profileSessionStore = new ProfileSessionStore();
    });

    afterEach(() => {
        jest.useRealTimers();
        document.body.innerHTML = '';
        localStorage.clear();
        jest.clearAllMocks();
    });

    it('renders the branded hero glyph above the title', () => {
        const users = [
            { id: '1', title: 'Admin', thumb: null, admin: true, protected: false },
        ];
        const orchestrator = createOrchestratorStub(users);
        const container = document.createElement('div');
        document.body.appendChild(container);

        new ProfileSelectScreen(
            container,
            orchestrator as unknown as ProfileSelectScreenPorts,
            profileSessionStore
        );

        const hero = container.querySelector('.profile-select-glyph');
        const panel = container.querySelector('.screen-panel') as HTMLElement;
        const orderedClassNames = Array.from(panel.children).map((child) => child.className);

        expect(hero).not.toBeNull();
        expect(hero?.querySelector('svg')).not.toBeNull();
        expect(orderedClassNames[0]).toBe('screen-hero');
        expect(orderedClassNames[1]).toBe('screen-title');
    });

    it('relies on shared screen bootstrap while show and hide still own display lifecycle', async () => {
        const users = [{ id: '1', title: 'Admin', thumb: null, admin: true, protected: false }];
        const orchestrator = createOrchestratorStub(users);
        const container = document.createElement('div');
        document.body.appendChild(container);

        const screen = new ProfileSelectScreen(
            container,
            orchestrator as unknown as ProfileSelectScreenPorts,
            profileSessionStore
        );

        expect(container.style.position).toBe('');
        expect(container.style.inset).toBe('');
        expect(container.style.display).toBe('');
        expect(container.style.alignItems).toBe('');
        expect(container.style.justifyContent).toBe('');

        screen.show();
        await settleScreen(screen);
        expect(container.style.display).toBe('flex');

        screen.hide();
        expect(container.style.display).toBe('none');
    });

    it('renders users', async () => {
        const users = [
            { id: '1', title: 'Admin', thumb: null, admin: true, protected: false },
            { id: '2', title: 'Kid', thumb: null, admin: false, protected: true },
        ];
        const orchestrator = createOrchestratorStub(users);
        const container = document.createElement('div');
        document.body.appendChild(container);

        const screen = new ProfileSelectScreen(container, orchestrator as unknown as ProfileSelectScreenPorts, profileSessionStore);
        screen.show();

        await settleScreen(screen);

        const rows = container.querySelectorAll('.profile-row');
        expect(rows.length).toBe(2);
        expect(container.textContent).toContain('Admin');
        expect(container.textContent).toContain('Kid');
    });

    it('renders restricted badge and informational tip text for restricted profiles', async () => {
        const users = [
            { id: '1', title: 'Admin', thumb: null, admin: true, protected: false },
            { id: '2', title: 'Kids', thumb: null, admin: false, protected: false, restricted: true },
        ];
        const orchestrator = createOrchestratorStub(users);
        const container = document.createElement('div');
        document.body.appendChild(container);

        const screen = new ProfileSelectScreen(
            container,
            orchestrator as unknown as ProfileSelectScreenPorts,
            profileSessionStore
        );
        screen.show();

        await settleScreen(screen);

        const restrictedBadge = container.querySelector('#btn-profile-2 .profile-restricted');
        expect(restrictedBadge).not.toBeNull();
        expect(restrictedBadge?.textContent).toBe('Restricted');
        expect(container.textContent).toContain('"Restricted" labels are informational only.');
    });

    it('hides main account action and skips focus registration when multiple users exist', async () => {
        const users = [
            { id: '1', title: 'Admin', thumb: null, admin: true, protected: false },
            { id: '2', title: 'Kid', thumb: null, admin: false, protected: false },
        ];
        const orchestrator = createOrchestratorStub(users);
        const nav = orchestrator.getNavigation();
        const container = document.createElement('div');
        document.body.appendChild(container);

        const screen = new ProfileSelectScreen(container, orchestrator as unknown as ProfileSelectScreenPorts, profileSessionStore);
        screen.show();
        await settleScreen(screen);

        const mainButton = container.querySelector('#btn-profile-main') as HTMLButtonElement | null;
        expect(mainButton).not.toBeNull();
        expect(mainButton?.style.display).toBe('none');

        const registeredIds = nav.registerFocusable.mock.calls
            .map((call) => (call[0] as { id?: string }).id)
            .filter((id): id is string => typeof id === 'string');
        expect(registeredIds).not.toContain('btn-profile-main');
    });

    it('marks last used profile as active with Active badge', async () => {
        const users = [
            { id: '1', title: 'Admin', thumb: null, admin: true, protected: false },
            { id: '2', title: 'Kid', thumb: null, admin: false, protected: true },
        ];
        localStorage.setItem(LINEUP_STORAGE_KEYS.LAST_PROFILE_ID, '2');
        const orchestrator = createOrchestratorStub(users);
        const container = document.createElement('div');
        document.body.appendChild(container);

        const screen = new ProfileSelectScreen(container, orchestrator as unknown as ProfileSelectScreenPorts, profileSessionStore);
        screen.show();

        await settleScreen(screen);

        const activeRow = container.querySelector('#btn-profile-2') as HTMLElement;
        const badge = activeRow.querySelector('.profile-last-used') as HTMLElement;
        expect(activeRow.classList.contains('active')).toBe(true);
        expect(activeRow.getAttribute('aria-current')).toBe('true');
        expect(badge.textContent).toBe('Active');
    });

    it('disambiguates colliding sanitized user ids with deterministic suffixes', async () => {
        const users = [
            { id: 'kid/one', title: 'Kid One', thumb: null, admin: false, protected: false },
            { id: 'kid_one', title: 'Kid Two', thumb: null, admin: false, protected: false },
        ];
        const orchestrator = createOrchestratorStub(users);
        const nav = orchestrator.getNavigation();
        const container = document.createElement('div');
        document.body.appendChild(container);

        const screen = new ProfileSelectScreen(container, orchestrator as unknown as ProfileSelectScreenPorts, profileSessionStore);
        screen.show();
        await settleScreen(screen);

        const rowIds = Array.from(container.querySelectorAll('.profile-row'))
            .map((row) => (row as HTMLElement).id)
            .filter((id) => id.startsWith('btn-profile-kid_one'));
        expect(rowIds).toContain('btn-profile-kid_one');
        expect(rowIds.some((id) => /^btn-profile-kid_one-[0-9a-f]{8}$/.test(id))).toBe(true);
        expect(new Set(rowIds).size).toBe(rowIds.length);

        const registeredIds = nav.registerFocusable.mock.calls
            .map((call) => (call[0] as { id?: string })?.id)
            .filter((id): id is string => typeof id === 'string' && id.startsWith('btn-profile-kid_one'));
        expect(new Set(registeredIds).size).toBe(registeredIds.length);
    });

    it('stays on profile screen when only one profile is available', async () => {
        const users = [{ id: '1', title: 'Admin', thumb: null, admin: true, protected: false }];
        const orchestrator = createOrchestratorStub(users);
        const nav = orchestrator.getNavigation();
        const container = document.createElement('div');
        document.body.appendChild(container);

        const screen = new ProfileSelectScreen(container, orchestrator as unknown as ProfileSelectScreenPorts, profileSessionStore);
        screen.show();

        await settleScreen(screen);

        const rows = container.querySelectorAll('.profile-row');
        expect(rows.length).toBe(1);
        expect(container.textContent).toContain('Only one profile is available for this account.');
        expect(nav.goTo).not.toHaveBeenCalled();
        const mainButton = container.querySelector('#btn-profile-main') as HTMLButtonElement | null;
        expect(mainButton).not.toBeNull();
        expect(mainButton?.style.display).toBe('');
        const registeredIds = nav.registerFocusable.mock.calls
            .map((call) => (call[0] as { id?: string }).id)
            .filter((id): id is string => typeof id === 'string');
        expect(registeredIds).toContain('btn-profile-main');
    });

    it('keeps main account action visible and focus-registered when no profiles are returned', async () => {
        const users: Array<{ id: string; title: string; thumb: string | null; admin: boolean; protected: boolean }> = [];
        const orchestrator = createOrchestratorStub(users);
        const nav = orchestrator.getNavigation();
        const container = document.createElement('div');
        document.body.appendChild(container);

        const screen = new ProfileSelectScreen(container, orchestrator as unknown as ProfileSelectScreenPorts, profileSessionStore);
        screen.show();
        await settleScreen(screen);

        const mainButton = container.querySelector('#btn-profile-main') as HTMLButtonElement | null;
        expect(mainButton).not.toBeNull();
        expect(mainButton?.style.display).toBe('');

        const registeredIds = nav.registerFocusable.mock.calls
            .map((call) => (call[0] as { id?: string }).id)
            .filter((id): id is string => typeof id === 'string');
        expect(registeredIds).toContain('btn-profile-main');
    });

    it('shows loading status while sign-out is pending', async () => {
        const users = [
            { id: '1', title: 'Admin', thumb: null, admin: true, protected: false },
            { id: '2', title: 'Kid', thumb: null, admin: false, protected: false },
        ];
        const orchestrator = createOrchestratorStub(users);
        const signOutDeferred = createDeferred<void>();
        orchestrator.signOutPlex.mockReturnValue(signOutDeferred.promise);
        const container = document.createElement('div');
        document.body.appendChild(container);

        const screen = new ProfileSelectScreen(container, orchestrator as unknown as ProfileSelectScreenPorts, profileSessionStore);
        screen.show();
        await settleScreen(screen);

        (container.querySelector('#btn-profile-signout') as HTMLButtonElement).click();

        expect(container.textContent).toContain('Signing out...');

        signOutDeferred.resolve();
        await settleScreen(screen);
    });

    it('does not update hidden profile list when stale profile loading settles', async () => {
        const users = [{ id: '1', title: 'Admin', thumb: null, admin: true, protected: false }];
        const orchestrator = createOrchestratorStub(users);
        const usersDeferred = createDeferred<typeof users>();
        orchestrator.getHomeUsers.mockReturnValueOnce(usersDeferred.promise);
        const container = document.createElement('div');
        document.body.appendChild(container);

        const screen = new ProfileSelectScreen(container, orchestrator as unknown as ProfileSelectScreenPorts, profileSessionStore);
        screen.show();
        screen.hide();

        usersDeferred.resolve(users);
        await settleScreen(screen);

        expect(container.querySelectorAll('.profile-row')).toHaveLength(0);
        expect(container.textContent).toContain('Loading profiles...');
    });

    it('opens PIN modal for protected users', async () => {
        const users = [
            { id: '1', title: 'Admin', thumb: null, admin: true, protected: false },
            { id: '2', title: 'Kid', thumb: null, admin: false, protected: true },
        ];
        const orchestrator = createOrchestratorStub(users);
        const container = document.createElement('div');
        document.body.appendChild(container);

        const screen = new ProfileSelectScreen(container, orchestrator as unknown as ProfileSelectScreenPorts, profileSessionStore);
        screen.show();

        await settleScreen(screen);

        const protectedButton = container.querySelector('#btn-profile-2') as HTMLButtonElement;
        protectedButton.click();

        const modal = container.querySelector('.profile-pin-modal') as HTMLElement;
        expect(modal.style.display).toBe('flex');
    });

    it('allows restricted but non-protected profiles to switch without PIN modal', async () => {
        const users = [
            { id: '1', title: 'Admin', thumb: null, admin: true, protected: false },
            { id: '2', title: 'Kids', thumb: null, admin: false, protected: false, restricted: true },
        ];
        const orchestrator = createOrchestratorStub(users);
        const container = document.createElement('div');
        document.body.appendChild(container);

        const screen = new ProfileSelectScreen(
            container,
            orchestrator as unknown as ProfileSelectScreenPorts,
            profileSessionStore
        );
        screen.show();

        await settleScreen(screen);

        (container.querySelector('#btn-profile-2') as HTMLButtonElement).click();
        await settleScreen(screen);

        const modal = container.querySelector('.profile-pin-modal') as HTMLElement;
        expect(modal.style.display).toBe('none');
        expect(orchestrator.switchHomeUser).toHaveBeenCalledWith('2', { pin: null });
    });

    it('opens PIN modal with full focusable list', async () => {
        const users = [
            { id: '1', title: 'Admin', thumb: null, admin: true, protected: false },
            { id: '2', title: 'Kid', thumb: null, admin: false, protected: true },
        ];
        const orchestrator = createOrchestratorStub(users);
        const nav = orchestrator.getNavigation();
        const container = document.createElement('div');
        document.body.appendChild(container);

        const screen = new ProfileSelectScreen(container, orchestrator as unknown as ProfileSelectScreenPorts, profileSessionStore);
        screen.show();

        await settleScreen(screen);

        const protectedButton = container.querySelector('#btn-profile-2') as HTMLButtonElement;
        protectedButton.click();

        expect(nav.openModal).toHaveBeenCalledWith('profile-pin', expectedPinFocusableIds);
    });

    it('wires PIN modal neighbors so row-4 controls are reachable', async () => {
        const users = [
            { id: '1', title: 'Admin', thumb: null, admin: true, protected: false },
            { id: '2', title: 'Kid', thumb: null, admin: false, protected: true },
        ];
        const orchestrator = createOrchestratorStub(users);
        const nav = orchestrator.getNavigation();
        const container = document.createElement('div');
        document.body.appendChild(container);

        const screen = new ProfileSelectScreen(container, orchestrator as unknown as ProfileSelectScreenPorts, profileSessionStore);
        screen.show();

        await settleScreen(screen);

        const protectedButton = container.querySelector('#btn-profile-2') as HTMLButtonElement;
        protectedButton.click();

        const pinCalls = nav.registerFocusable.mock.calls
            .map((call) => call[0] as { id: string; neighbors?: { up?: string; down?: string; left?: string; right?: string } })
            .filter((call) => expectedPinFocusableIds.includes(call.id));
        const neighborsById = new Map(pinCalls.map((call) => [call.id, call.neighbors ?? {}]));

        expect(neighborsById.get('btn-profile-pin-7')?.down).toBe('btn-profile-pin-backspace');
        expect(neighborsById.get('btn-profile-pin-8')?.down).toBe('btn-profile-pin-0');
        expect(neighborsById.get('btn-profile-pin-9')?.down).toBe('btn-profile-pin-cancel');
        expect(neighborsById.get('btn-profile-pin-backspace')?.up).toBe('btn-profile-pin-7');
        expect(neighborsById.get('btn-profile-pin-0')?.up).toBe('btn-profile-pin-8');
        expect(neighborsById.get('btn-profile-pin-cancel')?.up).toBe('btn-profile-pin-9');
    });

    it('does not render an unused PIN OK button', async () => {
        const users = [
            { id: '1', title: 'Admin', thumb: null, admin: true, protected: false },
            { id: '2', title: 'Kid', thumb: null, admin: false, protected: true },
        ];
        const orchestrator = createOrchestratorStub(users);
        const container = document.createElement('div');
        document.body.appendChild(container);

        const screen = new ProfileSelectScreen(container, orchestrator as unknown as ProfileSelectScreenPorts, profileSessionStore);
        screen.show();

        await settleScreen(screen);

        const protectedButton = container.querySelector('#btn-profile-2') as HTMLButtonElement;
        protectedButton.click();

        expect(container.querySelector('#btn-profile-pin-ok')).toBeNull();
    });

    it('sets initial focus to 5 on PIN modal open', async () => {
        const users = [
            { id: '1', title: 'Admin', thumb: null, admin: true, protected: false },
            { id: '2', title: 'Kid', thumb: null, admin: false, protected: true },
        ];
        const orchestrator = createOrchestratorStub(users);
        const nav = orchestrator.getNavigation();
        const container = document.createElement('div');
        document.body.appendChild(container);

        const screen = new ProfileSelectScreen(container, orchestrator as unknown as ProfileSelectScreenPorts, profileSessionStore);
        screen.show();

        await settleScreen(screen);

        const protectedButton = container.querySelector('#btn-profile-2') as HTMLButtonElement;
        protectedButton.click();

        expect(nav.setFocus).toHaveBeenCalledWith('btn-profile-pin-5');
    });

    it('numpad digit clicks enter PIN and submit after 4 digits', async () => {
        const users = [
            { id: '1', title: 'Admin', thumb: null, admin: true, protected: false },
            { id: '2', title: 'Kid', thumb: null, admin: false, protected: true },
        ];
        const orchestrator = createOrchestratorStub(users);
        const nav = orchestrator.getNavigation();
        const writeLastProfileIdSpy = jest.spyOn(profileSessionStore, 'writeLastProfileId');
        const container = document.createElement('div');
        document.body.appendChild(container);

        const screen = new ProfileSelectScreen(container, orchestrator as unknown as ProfileSelectScreenPorts, profileSessionStore);
        screen.show();

        await settleScreen(screen);

        (container.querySelector('#btn-profile-2') as HTMLButtonElement).click();

        (container.querySelector('#btn-profile-pin-1') as HTMLButtonElement).click();
        (container.querySelector('#btn-profile-pin-2') as HTMLButtonElement).click();
        (container.querySelector('#btn-profile-pin-3') as HTMLButtonElement).click();
        (container.querySelector('#btn-profile-pin-4') as HTMLButtonElement).click();

        await settleScreen(screen);

        expect(orchestrator.switchHomeUser).toHaveBeenCalledTimes(1);
        expect(orchestrator.switchHomeUser).toHaveBeenCalledWith('2', { pin: '1234' });
        expect(writeLastProfileIdSpy).toHaveBeenCalledWith('2');
        expect(nav.goTo).not.toHaveBeenCalledWith('server-select', { allowAutoConnect: true });
    });

    it('clears last profile id when switching to the main account', async () => {
        const users = [{ id: '1', title: 'Admin', thumb: null, admin: true, protected: false }];
        const orchestrator = createOrchestratorStub(users);
        const nav = orchestrator.getNavigation();
        const writeLastProfileIdSpy = jest.spyOn(profileSessionStore, 'writeLastProfileId');
        const container = document.createElement('div');
        document.body.appendChild(container);

        const screen = new ProfileSelectScreen(container, orchestrator as unknown as ProfileSelectScreenPorts, profileSessionStore);
        screen.show();

        await settleScreen(screen);

        (container.querySelector('#btn-profile-main') as HTMLButtonElement).click();
        await settleScreen(screen);

        expect(orchestrator.useMainAccountProfile).toHaveBeenCalledTimes(1);
        expect(writeLastProfileIdSpy).toHaveBeenCalledWith(null);
        expect(nav.goTo).not.toHaveBeenCalledWith('server-select', { allowAutoConnect: true });
    });

    it('keeps just-filled class only on the newest slot', async () => {
        const users = [
            { id: '1', title: 'Admin', thumb: null, admin: true, protected: false },
            { id: '2', title: 'Kid', thumb: null, admin: false, protected: true },
        ];
        const orchestrator = createOrchestratorStub(users);
        const container = document.createElement('div');
        document.body.appendChild(container);

        const screen = new ProfileSelectScreen(container, orchestrator as unknown as ProfileSelectScreenPorts, profileSessionStore);
        screen.show();

        await settleScreen(screen);

        (container.querySelector('#btn-profile-2') as HTMLButtonElement).click();
        (container.querySelector('#btn-profile-pin-1') as HTMLButtonElement).click();
        (container.querySelector('#btn-profile-pin-2') as HTMLButtonElement).click();

        const slots = Array.from(container.querySelectorAll('.profile-pin-slot')) as HTMLElement[];
        expect(slots[0]?.classList.contains('just-filled')).toBe(false);
        expect(slots[1]?.classList.contains('just-filled')).toBe(true);

        jest.advanceTimersByTime(200);
        expect(slots[1]?.classList.contains('just-filled')).toBe(false);
    });

    it('PIN entry ignores repeat events and submits exactly 4 digits', async () => {
        const users = [
            { id: '1', title: 'Admin', thumb: null, admin: true, protected: false },
            { id: '2', title: 'Kid', thumb: null, admin: false, protected: true },
        ];
        const orchestrator = createOrchestratorStub(users);
        const nav = orchestrator.getNavigation();
        const container = document.createElement('div');
        document.body.appendChild(container);

        const screen = new ProfileSelectScreen(container, orchestrator as unknown as ProfileSelectScreenPorts, profileSessionStore);
        screen.show();

        await settleScreen(screen);

        // Open PIN modal for protected user.
        (container.querySelector('#btn-profile-2') as HTMLButtonElement).click();

        const keyPress = nav.__handlers['keyPress'];
        expect(typeof keyPress).toBe('function');

        // Repeat for '1' should be ignored.
        keyPress!({ button: 'num1', isRepeat: true, isLongPress: false, handled: false });
        keyPress!({ button: 'num1', isRepeat: false, isLongPress: false, handled: false });
        keyPress!({ button: 'num2', isRepeat: false, isLongPress: false, handled: false });
        keyPress!({ button: 'num3', isRepeat: false, isLongPress: false, handled: false });
        keyPress!({ button: 'num4', isRepeat: false, isLongPress: false, handled: false });

        // Allow async submit to complete.
        await settleScreen(screen);

        expect(orchestrator.switchHomeUser).toHaveBeenCalledTimes(1);
        expect(orchestrator.switchHomeUser).toHaveBeenCalledWith('2', { pin: '1234' });
    });

    it('shows wrong PIN error styling and clears it after timeout', async () => {
        const users = [
            { id: '1', title: 'Admin', thumb: null, admin: true, protected: false },
            { id: '2', title: 'Kid', thumb: null, admin: false, protected: true },
        ];
        const orchestrator = createOrchestratorStub(users);
        orchestrator.switchHomeUser.mockRejectedValue(
            new PlexApiError(AppErrorCode.AUTH_FAILED, 'invalid pin')
        );

        const container = document.createElement('div');
        document.body.appendChild(container);
        const screen = new ProfileSelectScreen(container, orchestrator as unknown as ProfileSelectScreenPorts, profileSessionStore);
        screen.show();

        await settleScreen(screen);
        (container.querySelector('#btn-profile-2') as HTMLButtonElement).click();

        (container.querySelector('#btn-profile-pin-1') as HTMLButtonElement).click();
        (container.querySelector('#btn-profile-pin-2') as HTMLButtonElement).click();
        (container.querySelector('#btn-profile-pin-3') as HTMLButtonElement).click();
        (container.querySelector('#btn-profile-pin-4') as HTMLButtonElement).click();
        await Promise.resolve();

        const slotsWrap = container.querySelector('.profile-pin-slots') as HTMLElement;
        const pinError = container.querySelector('#profile-pin-desc') as HTMLElement;
        expect(pinError.textContent).toContain('PIN');
        expect(slotsWrap.classList.contains('error')).toBe(true);

        jest.advanceTimersByTime(351);
        expect(slotsWrap.classList.contains('error')).toBe(false);
    });

    it('uses navigation restore entrypoint before preferred-focus fallback', async () => {
        const users = [
            { id: '1', title: 'Admin', thumb: null, admin: true, protected: false },
            { id: '2', title: 'Kid', thumb: null, admin: false, protected: true },
        ];
        const orchestrator = createOrchestratorStub(users);
        const nav = orchestrator.getNavigation();
        nav.restoreFocusForCurrentScreen.mockReturnValue(true);
        const container = document.createElement('div');
        document.body.appendChild(container);

        const screen = new ProfileSelectScreen(container, orchestrator as unknown as ProfileSelectScreenPorts, profileSessionStore);
        screen.show();
        await settleScreen(screen);

        screen.hide();
        nav.setFocus.mockClear();
        nav.restoreFocusForCurrentScreen.mockClear();
        screen.show();
        await settleScreen(screen);

        expect(nav.restoreFocusForCurrentScreen).toHaveBeenCalledTimes(1);
        expect(nav.setFocus).not.toHaveBeenCalled();
    });

    it('falls back to preferred focus when restoreFocusForCurrentScreen returns false', async () => {
        const users = [
            { id: '1', title: 'Admin', thumb: null, admin: true, protected: false },
            { id: '2', title: 'Kid', thumb: null, admin: false, protected: true },
        ];
        const orchestrator = createOrchestratorStub(users);
        const nav = orchestrator.getNavigation();
        nav.restoreFocusForCurrentScreen.mockReturnValue(false);
        const container = document.createElement('div');
        document.body.appendChild(container);

        const screen = new ProfileSelectScreen(container, orchestrator as unknown as ProfileSelectScreenPorts, profileSessionStore);
        screen.show();
        await settleScreen(screen);

        expect(nav.restoreFocusForCurrentScreen).toHaveBeenCalledTimes(1);
        expect(nav.setFocus).toHaveBeenCalled();
    });
});
