/**
 * @jest-environment jsdom
 */

import { ProfileSelectScreen } from '../ProfileSelectScreen';
import { AppErrorCode, PlexApiError } from '../../../plex/auth';

type NavigationStub = {
    registerFocusable: jest.Mock;
    unregisterFocusable: jest.Mock;
    setFocus: jest.Mock;
    openModal: jest.Mock;
    closeModal: jest.Mock;
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
    getHomeUsers: () => Promise<unknown[]>;
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

describe('ProfileSelectScreen', () => {
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

    afterEach(() => {
        jest.useRealTimers();
        document.body.innerHTML = '';
        jest.clearAllMocks();
    });

    it('renders users', async () => {
        const users = [
            { id: '1', title: 'Admin', thumb: null, admin: true, protected: false },
            { id: '2', title: 'Kid', thumb: null, admin: false, protected: true },
        ];
        const orchestrator = createOrchestratorStub(users);
        const container = document.createElement('div');
        document.body.appendChild(container);

        const screen = new ProfileSelectScreen(container, orchestrator as never);
        screen.show();

        await new Promise((resolve) => setTimeout(resolve, 0));

        const rows = container.querySelectorAll('.profile-row');
        expect(rows.length).toBe(2);
        expect(container.textContent).toContain('Admin');
        expect(container.textContent).toContain('Kid');
    });

    it('stays on profile screen when only one profile is available', async () => {
        const users = [{ id: '1', title: 'Admin', thumb: null, admin: true, protected: false }];
        const orchestrator = createOrchestratorStub(users);
        const nav = orchestrator.getNavigation();
        const container = document.createElement('div');
        document.body.appendChild(container);

        const screen = new ProfileSelectScreen(container, orchestrator as never);
        screen.show();

        await new Promise((resolve) => setTimeout(resolve, 0));

        const rows = container.querySelectorAll('.profile-row');
        expect(rows.length).toBe(1);
        expect(container.textContent).toContain('Only one profile is available for this account.');
        expect(nav.goTo).not.toHaveBeenCalled();
    });

    it('opens PIN modal for protected users', async () => {
        const users = [
            { id: '1', title: 'Admin', thumb: null, admin: true, protected: false },
            { id: '2', title: 'Kid', thumb: null, admin: false, protected: true },
        ];
        const orchestrator = createOrchestratorStub(users);
        const container = document.createElement('div');
        document.body.appendChild(container);

        const screen = new ProfileSelectScreen(container, orchestrator as never);
        screen.show();

        await new Promise((resolve) => setTimeout(resolve, 0));

        const protectedButton = container.querySelector('#btn-profile-1') as HTMLButtonElement;
        protectedButton.click();

        const modal = container.querySelector('.profile-pin-modal') as HTMLElement;
        expect(modal.style.display).toBe('flex');
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

        const screen = new ProfileSelectScreen(container, orchestrator as never);
        screen.show();

        await new Promise((resolve) => setTimeout(resolve, 0));

        const protectedButton = container.querySelector('#btn-profile-1') as HTMLButtonElement;
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

        const screen = new ProfileSelectScreen(container, orchestrator as never);
        screen.show();

        await new Promise((resolve) => setTimeout(resolve, 0));

        const protectedButton = container.querySelector('#btn-profile-1') as HTMLButtonElement;
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

        const screen = new ProfileSelectScreen(container, orchestrator as never);
        screen.show();

        await new Promise((resolve) => setTimeout(resolve, 0));

        const protectedButton = container.querySelector('#btn-profile-1') as HTMLButtonElement;
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

        const screen = new ProfileSelectScreen(container, orchestrator as never);
        screen.show();

        await new Promise((resolve) => setTimeout(resolve, 0));

        const protectedButton = container.querySelector('#btn-profile-1') as HTMLButtonElement;
        protectedButton.click();

        expect(nav.setFocus).toHaveBeenCalledWith('btn-profile-pin-5');
    });

    it('numpad digit clicks enter PIN and submit after 4 digits', async () => {
        const users = [
            { id: '1', title: 'Admin', thumb: null, admin: true, protected: false },
            { id: '2', title: 'Kid', thumb: null, admin: false, protected: true },
        ];
        const orchestrator = createOrchestratorStub(users);
        const container = document.createElement('div');
        document.body.appendChild(container);

        const screen = new ProfileSelectScreen(container, orchestrator as never);
        screen.show();

        await new Promise((resolve) => setTimeout(resolve, 0));

        (container.querySelector('#btn-profile-1') as HTMLButtonElement).click();

        (container.querySelector('#btn-profile-pin-1') as HTMLButtonElement).click();
        (container.querySelector('#btn-profile-pin-2') as HTMLButtonElement).click();
        (container.querySelector('#btn-profile-pin-3') as HTMLButtonElement).click();
        (container.querySelector('#btn-profile-pin-4') as HTMLButtonElement).click();

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(orchestrator.switchHomeUser).toHaveBeenCalledTimes(1);
        expect(orchestrator.switchHomeUser).toHaveBeenCalledWith('2', '1234');
    });

    it('keeps just-filled class only on the newest slot', async () => {
        const users = [
            { id: '1', title: 'Admin', thumb: null, admin: true, protected: false },
            { id: '2', title: 'Kid', thumb: null, admin: false, protected: true },
        ];
        const orchestrator = createOrchestratorStub(users);
        const container = document.createElement('div');
        document.body.appendChild(container);

        const screen = new ProfileSelectScreen(container, orchestrator as never);
        screen.show();

        await new Promise((resolve) => setTimeout(resolve, 0));
        jest.useFakeTimers();

        (container.querySelector('#btn-profile-1') as HTMLButtonElement).click();
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

        const screen = new ProfileSelectScreen(container, orchestrator as never);
        screen.show();

        await new Promise((resolve) => setTimeout(resolve, 0));

        // Open PIN modal for protected user.
        (container.querySelector('#btn-profile-1') as HTMLButtonElement).click();

        const keyPress = nav.__handlers['keyPress'];
        expect(typeof keyPress).toBe('function');

        // Repeat for '1' should be ignored.
        keyPress!({ button: 'num1', isRepeat: true, isLongPress: false, handled: false });
        keyPress!({ button: 'num1', isRepeat: false, isLongPress: false, handled: false });
        keyPress!({ button: 'num2', isRepeat: false, isLongPress: false, handled: false });
        keyPress!({ button: 'num3', isRepeat: false, isLongPress: false, handled: false });
        keyPress!({ button: 'num4', isRepeat: false, isLongPress: false, handled: false });

        // Allow async submit to complete.
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(orchestrator.switchHomeUser).toHaveBeenCalledTimes(1);
        expect(orchestrator.switchHomeUser).toHaveBeenCalledWith('2', '1234');
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
        const screen = new ProfileSelectScreen(container, orchestrator as never);
        screen.show();

        await new Promise((resolve) => setTimeout(resolve, 0));
        jest.useFakeTimers();
        (container.querySelector('#btn-profile-1') as HTMLButtonElement).click();

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
});
