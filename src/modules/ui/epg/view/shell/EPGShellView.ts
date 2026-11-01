import { EPG_CLASSES } from '../../constants';
import { createLineupBrandGlyph } from '../../../common/brandGlyph';
import type { EPGConfig } from '../../types';

export type EPGShellElements = {
    classicHeader: HTMLElement;
    classicNowPlaying: HTMLElement;
    classicNowPlayingChannel: HTMLElement;
    classicHeaderClock: HTMLElement;
    classicShowcase: HTMLElement;
    classicShowcaseInfo: HTMLElement;
    toolbar: HTMLElement;
    menuTrigger: HTMLButtonElement;
    grid: HTMLElement;
    programArea: HTMLElement;
    pictureStatus: HTMLElement;
};

type CurrentChannelInfoProvider = NonNullable<EPGConfig['getCurrentChannelInfo']>;

type NowWatchingOptions = {
    enabled: boolean | undefined;
    getCurrentChannelInfo: CurrentChannelInfoProvider | undefined;
};

export class EPGShellView {
    private elements: EPGShellElements | null = null;
    private _lastNowWatchingTuple: [string, string, string] | null = null;

    create(container: HTMLElement): EPGShellElements {
        container.className = EPG_CLASSES.CONTAINER;

        const shell = this.buildShellStructure();
        container.replaceChildren(
            shell.classicHeader,
            shell.classicShowcase,
            shell.toolbar,
            shell.grid
        );

        const elements: EPGShellElements = {
            classicHeader: shell.classicHeader,
            classicNowPlaying: shell.classicNowPlaying,
            classicNowPlayingChannel: shell.classicNowPlayingChannel,
            classicHeaderClock: shell.classicHeaderClock,
            classicShowcase: shell.classicShowcase,
            classicShowcaseInfo: shell.classicShowcaseInfo,
            toolbar: shell.toolbar,
            menuTrigger: shell.menuTrigger,
            grid: shell.grid,
            programArea: shell.programArea,
            pictureStatus: shell.pictureStatus,
        };
        this.elements = elements;
        this.initializeProgramAreaOverlays(elements.programArea);
        return elements;
    }

    syncVisibility(isVisible: boolean): void {
        const elements = this.elements;
        if (!elements) return;

        elements.classicHeader.hidden = !isVisible;
        elements.classicShowcase.hidden = !isVisible;
        elements.toolbar.hidden = !isVisible;
        this.setAriaHidden(elements.classicHeader, !isVisible);
        this.setAriaHidden(elements.classicShowcase, !isVisible);
        this.setAriaHidden(elements.toolbar, !isVisible);
        if (isVisible) this.updateClock();
    }

    updateNowWatchingBanner(options: NowWatchingOptions): void {
        const elements = this.elements;
        if (!elements) return;
        this.updateClock();

        const classicRail = elements.classicNowPlaying;
        const classicRailChannel = elements.classicNowPlayingChannel;

        if (!options.enabled || !options.getCurrentChannelInfo) {
            classicRail.hidden = true;
            this._lastNowWatchingTuple = null;
            return;
        }

        const info = options.getCurrentChannelInfo();
        if (!info) {
            classicRail.hidden = true;
            this._lastNowWatchingTuple = null;
            return;
        }

        const channelName = typeof info.channelName === 'string' ? info.channelName.trim() : '';
        const channelText = channelName ? `${info.channelNumber} • ${channelName}` : String(info.channelNumber);
        const programText = typeof info.programTitle === 'string' ? info.programTitle : '';
        const rawTimeText = typeof info.timeLabel === 'string' ? info.timeLabel : '';
        const timeText = rawTimeText.includes('Invalid') ? '' : rawTimeText;
        const nextTuple: [string, string, string] = [channelText, programText, timeText];

        if (
            this._lastNowWatchingTuple &&
            this._lastNowWatchingTuple[0] === channelText &&
            this._lastNowWatchingTuple[1] === programText &&
            this._lastNowWatchingTuple[2] === timeText
        ) {
            classicRail.hidden = false;
            return;
        }

        classicRailChannel.textContent = channelText;
        classicRail.hidden = false;
        this._lastNowWatchingTuple = nextTuple;
    }

    reset(): void {
        this.elements = null;
        this._lastNowWatchingTuple = null;
    }

    private updateClock(): void {
        const clock = this.elements?.classicHeaderClock;
        if (!clock) return;
        clock.textContent = new Intl.DateTimeFormat(undefined, {
            weekday: 'short', month: 'short', day: 'numeric',
            hour: 'numeric', minute: '2-digit',
        }).format(new Date());
    }

    updatePictureStatus(status: 'untuned' | 'playing' | 'paused' | 'buffering' | 'seeking' | 'error'): void {
        const pictureStatus = this.elements?.pictureStatus;
        if (!pictureStatus) return;
        pictureStatus.dataset.state = status;
        pictureStatus.hidden = status === 'playing';
        pictureStatus.textContent = {
            untuned: 'Choose a program to start watching',
            playing: '',
            paused: 'Paused',
            buffering: 'Loading picture…',
            seeking: 'Seeking…',
            error: 'Picture unavailable. Choose a program or retry playback.',
        }[status];
    }

    private buildShellStructure(): EPGShellElements {
        const classicHeader = document.createElement('div');
        classicHeader.className = 'epg-classic-header';
        classicHeader.hidden = true;

        const classicHeaderBrand = document.createElement('button');
        classicHeaderBrand.className = 'epg-classic-header-brand';
        classicHeaderBrand.type = 'button';
        classicHeaderBrand.dataset.action = 'menu';
        classicHeaderBrand.setAttribute('aria-label', 'Open Lineup menu');
        classicHeader.appendChild(classicHeaderBrand);

        const classicHeaderGlyph = createLineupBrandGlyph({
            variant: 'monochrome',
            className: 'epg-classic-header-glyph',
        });
        classicHeaderBrand.appendChild(classicHeaderGlyph);

        const classicHeaderTitle = document.createElement('div');
        classicHeaderTitle.className = 'epg-classic-header-title';
        classicHeaderTitle.textContent = 'LINEUP';
        classicHeaderBrand.appendChild(classicHeaderTitle);
        const menuGlyph = document.createElement('span');
        menuGlyph.className = 'epg-menu-glyph';
        menuGlyph.textContent = '☰';
        menuGlyph.setAttribute('aria-hidden', 'true');
        classicHeaderBrand.appendChild(menuGlyph);

        const classicNowPlaying = document.createElement('div');
        classicNowPlaying.className = 'epg-classic-now-playing';
        classicNowPlaying.hidden = true;
        classicHeader.appendChild(classicNowPlaying);

        const classicNowPlayingLabel = document.createElement('span');
        classicNowPlayingLabel.className = 'epg-classic-now-playing-label';
        classicNowPlayingLabel.textContent = 'NOW PLAYING';
        classicNowPlaying.appendChild(classicNowPlayingLabel);

        const classicNowPlayingChannel = document.createElement('span');
        classicNowPlayingChannel.className = 'epg-classic-now-playing-channel';
        classicNowPlaying.appendChild(classicNowPlayingChannel);

        const classicHeaderActions = document.createElement('div');
        classicHeaderActions.className = 'epg-classic-header-actions';
        classicHeader.appendChild(classicHeaderActions);
        const classicHeaderClock = document.createElement('time');
        classicHeaderClock.className = 'epg-classic-header-clock';
        classicHeaderActions.appendChild(classicHeaderClock);
        const closeGlyph = document.createElement('span');
        closeGlyph.className = 'epg-classic-header-close-glyph';
        closeGlyph.setAttribute('aria-hidden', 'true');
        closeGlyph.textContent = '×';
        classicHeaderActions.appendChild(closeGlyph);

        const classicShowcase = document.createElement('div');
        classicShowcase.className = 'epg-classic-showcase';
        classicShowcase.hidden = true;

        const classicShowcasePip = document.createElement('div');
        classicShowcasePip.className = 'epg-classic-showcase-pip';
        classicShowcase.appendChild(classicShowcasePip);
        const pictureStatus = document.createElement('div');
        pictureStatus.className = 'epg-picture-status';
        pictureStatus.setAttribute('role', 'status');
        classicShowcasePip.appendChild(pictureStatus);

        const classicShowcaseInfo = document.createElement('div');
        classicShowcaseInfo.className = 'epg-classic-showcase-info';
        classicShowcase.appendChild(classicShowcaseInfo);

        const toolbar = document.createElement('nav');
        toolbar.className = 'epg-toolbar';
        toolbar.setAttribute('aria-label', 'Guide controls');

        const grid = document.createElement('div');
        grid.className = EPG_CLASSES.GRID;

        const programArea = document.createElement('div');
        programArea.className = EPG_CLASSES.PROGRAM_AREA;
        grid.appendChild(programArea);

        return {
            classicHeader,
            classicNowPlaying,
            classicNowPlayingChannel,
            classicHeaderClock,
            classicShowcase,
            classicShowcaseInfo,
            toolbar,
            menuTrigger: classicHeaderBrand,
            grid,
            programArea,
            pictureStatus,
        };
    }

    private initializeProgramAreaOverlays(programArea: HTMLElement): void {
        const leftMask = document.createElement('div');
        leftMask.className = `${EPG_CLASSES.PROGRAM_EDGE_MASK} ${EPG_CLASSES.PROGRAM_EDGE_MASK_LEFT}`;
        leftMask.setAttribute('aria-hidden', 'true');
        programArea.appendChild(leftMask);

        const rightMask = document.createElement('div');
        rightMask.className = `${EPG_CLASSES.PROGRAM_EDGE_MASK} ${EPG_CLASSES.PROGRAM_EDGE_MASK_RIGHT}`;
        rightMask.setAttribute('aria-hidden', 'true');
        programArea.appendChild(rightMask);
    }

    private setAriaHidden(element: HTMLElement, hidden: boolean): void {
        if (hidden) {
            element.setAttribute('aria-hidden', 'true');
        } else {
            element.removeAttribute('aria-hidden');
        }
    }
}
