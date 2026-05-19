import type { ScheduledProgram } from '../types';

export type EPGEpisodeTitlePresentation = {
    showTitle: string;
    episodeTitle: string;
};

export function resolveEpisodeTitlePresentation(
    item: ScheduledProgram['item']
): EPGEpisodeTitlePresentation {
    const episodeTitle = normalizeEpisodeTitleForSubtitle(item.title);
    const explicitShowTitle = (item.showTitle ?? '').trim();
    const showTitle = explicitShowTitle ||
        deriveShowTitleFromFullTitle(item.fullTitle, episodeTitle) ||
        '';

    return {
        showTitle,
        episodeTitle,
    };
}

function deriveShowTitleFromFullTitle(fullTitle: string, episodeTitle: string): string | null {
    const trimmedFullTitle = fullTitle.trim();
    const withEpisodeCode = trimmedFullTitle.match(/^(.*?)\s-\sS\d{1,2}E\d{1,2}\s-\s(.+)$/i);
    if (withEpisodeCode) {
        const showTitle = withEpisodeCode[1]?.trim() ?? '';
        return showTitle.length > 0 ? showTitle : null;
    }

    if (episodeTitle.length > 0) {
        const episodeSuffix = ` - ${episodeTitle}`;
        if (trimmedFullTitle.endsWith(episodeSuffix)) {
            const showTitle = trimmedFullTitle.slice(0, -episodeSuffix.length).trim();
            return showTitle.length > 0 && !isEpisodeCodeOnlySegment(showTitle)
                ? showTitle
                : null;
        }
    }

    return null;
}

function isEpisodeCodeOnlySegment(value: string): boolean {
    return /^-?\s*S\d{1,2}E\d{1,2}$/i.test(value);
}

function normalizeEpisodeTitleForSubtitle(title: string): string {
    return title.replace(/^\s*S\d{1,2}E\d{1,2}\s*-\s*/i, '').trim();
}
