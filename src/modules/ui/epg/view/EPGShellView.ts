import { EPG_CLASSES } from '../constants';
import { createLineupBrandGlyph } from '../../common/brandGlyph';
import type { EPGConfig } from '../types';
import type { EpgLayoutMode } from '../../../settings/EpgPreferencesStore';

export type EPGShellElements = {
    classicHeader: HTMLElement;
    classicNowPlaying: HTMLElement;
    classicNowPlayingChannel: HTMLElement;
    classicShowcase: HTMLElement;
    classicShowcaseInfo: HTMLElement;
    overlayShowcase: HTMLElement;
    grid: HTMLElement;
    programArea: HTMLElement;
    dashboardBottom: HTMLElement;
    nowWatchingBanner: HTMLElement;
    nowWatchingChannel: HTMLElement;
    nowWatchingProgram: HTMLElement;
    nowWatchingTime: HTMLElement;
};

type CurrentChannelInfoProvider = NonNullable<EPGConfig['getCurrentChannelInfo']>;

type NowWatchingOptions = {
    enabled: boolean | undefined;
    getCurrentChannelInfo: CurrentChannelInfoProvider | undefined;
    layoutMode: EpgLayoutMode;
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
            shell.overlayShowcase,
            shell.grid,
            shell.dashboardBottom
        );
        container.appendChild(shell.watermark);

        const elements: EPGShellElements = {
            classicHeader: shell.classicHeader,
            classicNowPlaying: shell.classicNowPlaying,
            classicNowPlayingChannel: shell.classicNowPlayingChannel,
            classicShowcase: shell.classicShowcase,
            classicShowcaseInfo: shell.classicShowcaseInfo,
            overlayShowcase: shell.overlayShowcase,
            grid: shell.grid,
            programArea: shell.programArea,
            dashboardBottom: shell.dashboardBottom,
            nowWatchingBanner: shell.nowWatchingBanner,
            nowWatchingChannel: shell.nowWatchingChannel,
            nowWatchingProgram: shell.nowWatchingProgram,
            nowWatchingTime: shell.nowWatchingTime,
        };
        this.elements = elements;
        this.initializeProgramAreaOverlays(elements.programArea);
        elements.nowWatchingBanner.hidden = true;
        return elements;
    }

    syncClassicShellVisibility(layoutMode: EpgLayoutMode, isVisible: boolean): void {
        const elements = this.elements;
        if (!elements) return;

        const isClassicVisible = layoutMode === 'classic' && isVisible;
        elements.classicHeader.hidden = !isClassicVisible;
        elements.classicShowcase.hidden = !isClassicVisible;
        this.setAriaHidden(elements.classicHeader, !isClassicVisible);
        this.setAriaHidden(elements.classicShowcase, !isClassicVisible);
    }

    updateNowWatchingBanner(options: NowWatchingOptions): void {
        const elements = this.elements;
        if (!elements) return;

        const banner = elements.nowWatchingBanner;
        const classicRail = elements.classicNowPlaying;
        const classicRailChannel = elements.classicNowPlayingChannel;

        if (!options.enabled || !options.getCurrentChannelInfo) {
            classicRail.hidden = true;
            if (!banner.hidden) {
                banner.hidden = true;
            }
            this._lastNowWatchingTuple = null;
            return;
        }

        const info = options.getCurrentChannelInfo();
        if (!info) {
            classicRail.hidden = true;
            if (!banner.hidden) {
                banner.hidden = true;
            }
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
            this.applyNowWatchingVisibility(options.layoutMode, classicRail, banner);
            return;
        }

        classicRailChannel.textContent = channelText;
        elements.nowWatchingChannel.textContent = channelText;
        elements.nowWatchingProgram.textContent = programText;
        elements.nowWatchingTime.textContent = timeText;
        this.applyNowWatchingVisibility(options.layoutMode, classicRail, banner);
        this._lastNowWatchingTuple = nextTuple;
    }

    reset(): void {
        this.elements = null;
        this._lastNowWatchingTuple = null;
    }

    private applyNowWatchingVisibility(
        layoutMode: EpgLayoutMode,
        classicRail: HTMLElement,
        banner: HTMLElement
    ): void {
        if (layoutMode === 'classic') {
            classicRail.hidden = false;
            banner.hidden = true;
        } else {
            classicRail.hidden = true;
            banner.hidden = false;
        }
    }

    private buildShellStructure(): EPGShellElements & { watermark: HTMLSpanElement } {
        const classicHeader = document.createElement('div');
        classicHeader.className = 'epg-classic-header';
        classicHeader.hidden = true;

        const classicHeaderBrand = document.createElement('div');
        classicHeaderBrand.className = 'epg-classic-header-brand';
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

        const classicNowPlaying = document.createElement('div');
        classicNowPlaying.className = 'epg-classic-now-playing';
        classicNowPlaying.hidden = true;
        classicHeaderBrand.appendChild(classicNowPlaying);

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

        const actionOk = document.createElement('span');
        actionOk.textContent = 'OK Select';
        const actionNavigate = document.createElement('span');
        actionNavigate.textContent = '· LEFT/RIGHT Navigate';
        const actionBack = document.createElement('span');
        actionBack.textContent = '· BACK Close';
        classicHeaderActions.append(actionOk, actionNavigate, actionBack);

        const classicShowcase = document.createElement('div');
        classicShowcase.className = 'epg-classic-showcase';
        classicShowcase.hidden = true;

        const classicShowcasePip = document.createElement('div');
        classicShowcasePip.className = 'epg-classic-showcase-pip';
        classicShowcase.appendChild(classicShowcasePip);

        const classicShowcaseInfo = document.createElement('div');
        classicShowcaseInfo.className = 'epg-classic-showcase-info';
        classicShowcase.appendChild(classicShowcaseInfo);

        const overlayShowcase = document.createElement('div');
        overlayShowcase.className = EPG_CLASSES.OVERLAY_SHOWCASE;

        const grid = document.createElement('div');
        grid.className = EPG_CLASSES.GRID;

        const programArea = document.createElement('div');
        programArea.className = EPG_CLASSES.PROGRAM_AREA;
        grid.appendChild(programArea);

        const dashboardBottom = document.createElement('div');
        dashboardBottom.className = EPG_CLASSES.DASHBOARD_BOTTOM;

        const nowWatchingBanner = document.createElement('div');
        nowWatchingBanner.className = EPG_CLASSES.NOW_WATCHING_BANNER;
        nowWatchingBanner.setAttribute('aria-live', 'polite');
        dashboardBottom.appendChild(nowWatchingBanner);

        const nowWatchingLive = document.createElement('span');
        nowWatchingLive.className = EPG_CLASSES.NOW_WATCHING_LIVE;
        nowWatchingLive.textContent = 'NOW PLAYING';
        nowWatchingBanner.appendChild(nowWatchingLive);

        const nowWatchingChannel = document.createElement('span');
        nowWatchingChannel.className = EPG_CLASSES.NOW_WATCHING_CHANNEL;
        nowWatchingBanner.appendChild(nowWatchingChannel);

        const nowWatchingProgram = document.createElement('span');
        nowWatchingProgram.className = EPG_CLASSES.NOW_WATCHING_PROGRAM;
        nowWatchingBanner.appendChild(nowWatchingProgram);

        const nowWatchingTime = document.createElement('span');
        nowWatchingTime.className = EPG_CLASSES.NOW_WATCHING_TIME;
        nowWatchingBanner.appendChild(nowWatchingTime);

        const watermark = createLineupBrandGlyph({
            variant: 'monochrome',
            className: 'epg-watermark',
        });

        return {
            classicHeader,
            classicNowPlaying,
            classicNowPlayingChannel,
            classicShowcase,
            classicShowcaseInfo,
            overlayShowcase,
            grid,
            programArea,
            dashboardBottom,
            nowWatchingBanner,
            nowWatchingChannel,
            nowWatchingProgram,
            nowWatchingTime,
            watermark,
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
