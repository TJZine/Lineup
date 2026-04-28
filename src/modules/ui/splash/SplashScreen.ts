import './styles.css';

export class SplashScreen {
    private _container: HTMLElement;

    constructor(container: HTMLElement) {
        this._container = container;
        this._buildUI();
    }

    private _buildUI(): void {
        this._container.className = 'splash-screen screen';
        this._container.replaceChildren();

        const scene = document.createElement('div');
        scene.className = 'splash-scene';

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

        brand.appendChild(logoShell);
        brand.appendChild(wordmark);
        content.appendChild(brand);
        content.appendChild(subtitle);
        content.appendChild(status);
        scene.appendChild(ambientGlow);
        scene.appendChild(content);
        this._container.appendChild(scene);
    }

    public updateStatus(text: string): void {
        const status = this._container.querySelector('.splash-status');
        if (!(status instanceof HTMLElement)) return;
        status.textContent = text;
    }

    public show(): void {
        this._container.style.display = 'none';
        void this._container.offsetHeight;
        this._container.style.display = '';
        this._container.classList.add('visible');
    }

    public hide(): void {
        this._container.classList.remove('visible');
    }
}
