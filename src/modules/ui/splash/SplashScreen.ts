import './styles.css';
import type { InitializationRestoreProjection } from '../../../core/initialization/InitializationRestoreProjection';
import type { INavigationManager } from '../../navigation';
import { createLineupBrandGlyph } from '../common/brandGlyph';

const RESTORE_PHASE_TEXT: Record<InitializationRestoreProjection['phase'], string> = {
    auth: 'Checking your Plex account…',
    server: 'Connecting to your server…',
    'read-lineup': 'Reading saved channels…',
    'prepare-runtime': 'Preparing channels…',
    'prepare-guide': 'Preparing the Guide…',
    complete: 'Lineup is ready.',
};

export class SplashScreen {
    private _container: HTMLElement;
    private _lastRestoreGeneration = -1;
    private _switchRegistered = false;

    constructor(
        container: HTMLElement,
        private readonly _onSwitchServer?: () => void,
        private readonly _getNavigation?: () => Pick<INavigationManager, 'registerFocusable' | 'unregisterFocusable' | 'setFocus'> | null
    ) {
        this._container = container;
        this._buildUI();
    }

    private _buildUI(): void {
        this._container.className = 'splash-screen screen';
        this._container.replaceChildren();

        const scene = document.createElement('div');
        scene.className = 'splash-scene';

        const topbar = document.createElement('header');
        topbar.className = 'screen-shell-topbar splash-restore-topbar';
        const topbarBrand = document.createElement('div');
        topbarBrand.className = 'screen-shell-brand';
        const topbarWordmark = document.createElement('span');
        topbarWordmark.className = 'screen-shell-wordmark';
        topbarWordmark.textContent = 'LINEUP';
        topbarBrand.append(createLineupBrandGlyph({ variant: 'color', className: 'screen-shell-brand-glyph' }), topbarWordmark);
        topbar.appendChild(topbarBrand);

        const ambientGlow = document.createElement('div');
        ambientGlow.className = 'splash-ambient-glow';

        const content = document.createElement('div');
        content.className = 'splash-content';

        const brand = document.createElement('div');
        brand.className = 'splash-brand';

        const logoShell = document.createElement('div');
        logoShell.className = 'splash-logo-shell';

        const logoMark = document.createElement('img');
        logoMark.className = 'splash-logo-mark';
        logoMark.src = './lineup-logo-mark.png';
        logoMark.alt = '';
        logoMark.decoding = 'sync';
        logoMark.setAttribute('aria-hidden', 'true');
        logoShell.appendChild(logoMark);

        const wordmark = document.createElement('img');
        wordmark.className = 'splash-wordmark';
        wordmark.src = './lineup-wordmark.png';
        wordmark.alt = 'Lineup';
        wordmark.decoding = 'sync';

        const subtitle = document.createElement('p');
        subtitle.className = 'splash-subtitle screen-subtitle';
        subtitle.textContent = 'Connecting Plex and preparing your lineup.';

        const status = document.createElement('div');
        status.className = 'splash-status screen-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        status.textContent = 'Starting up…';

        const restore = document.createElement('section');
        restore.className = 'splash-restore';
        restore.hidden = true;
        const title = document.createElement('h1');
        title.className = 'splash-restore-title';
        title.textContent = 'Loading your lineup…';
        const phase = document.createElement('p');
        phase.className = 'splash-restore-phase';
        phase.setAttribute('role', 'status');
        phase.setAttribute('aria-live', 'polite');
        restore.append(title, phase);
        if (this._onSwitchServer) {
            const switchServer = document.createElement('button');
            switchServer.type = 'button';
            switchServer.className = 'splash-switch-server';
            switchServer.textContent = 'Switch server';
            switchServer.addEventListener('click', () => this._onSwitchServer?.());
            restore.appendChild(switchServer);
        }

        brand.appendChild(logoShell);
        brand.appendChild(wordmark);
        content.appendChild(brand);
        content.appendChild(subtitle);
        content.appendChild(status);
        content.appendChild(restore);
        scene.appendChild(ambientGlow);
        scene.appendChild(content);
        this._container.append(topbar, scene);
    }

    public updateStatus(text: string): void {
        const status = this._container.querySelector('.splash-status');
        if (!(status instanceof HTMLElement)) return;
        status.textContent = text;
    }

    public updateRestoreProjection(projection: InitializationRestoreProjection): void {
        if (projection.generation < this._lastRestoreGeneration) return;
        this._lastRestoreGeneration = projection.generation;
        const restore = this._container.querySelector<HTMLElement>('.splash-restore');
        const phase = this._container.querySelector<HTMLElement>('.splash-restore-phase');
        if (!restore || !phase) return;
        const isRestoring = projection.phase !== 'complete' && projection.phase !== 'auth';
        restore.hidden = !isRestoring;
        this._container.classList.toggle('restoring', isRestoring);
        if (!isRestoring) {
            this._unregisterSwitch();
            return;
        }
        const count = projection.channelCount;
        phase.textContent = count === null
            ? RESTORE_PHASE_TEXT[projection.phase]
            : `${RESTORE_PHASE_TEXT[projection.phase]} ${count} saved ${count === 1 ? 'channel' : 'channels'}.`;
        this._registerSwitch();
    }

    private _registerSwitch(): void {
        if (this._switchRegistered || !this._container.classList.contains('visible')) return;
        const button = this._container.querySelector<HTMLButtonElement>('.splash-switch-server');
        const navigation = this._getNavigation?.();
        if (!button || !navigation) return;
        navigation.registerFocusable({ id: 'splash-switch-server', element: button, neighbors: {},
            onSelect: (): void => button.click() });
        this._switchRegistered = true;
        navigation.setFocus('splash-switch-server');
    }

    private _unregisterSwitch(): void {
        if (!this._switchRegistered) return;
        this._getNavigation?.()?.unregisterFocusable('splash-switch-server');
        this._switchRegistered = false;
    }

    public show(): void {
        this._container.style.display = 'none';
        void this._container.offsetHeight;
        this._container.style.display = '';
        this._container.classList.add('visible');
        if (this._container.classList.contains('restoring')) this._registerSwitch();
    }

    public hide(): void {
        this._unregisterSwitch();
        this._container.classList.remove('visible');
    }
}
