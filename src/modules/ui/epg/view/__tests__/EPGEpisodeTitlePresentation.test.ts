import { resolveEpisodeTitlePresentation } from '../EPGEpisodeTitlePresentation';
import type { ScheduledProgram } from '../../types';

const makeEpisodeItem = (
    overrides: Partial<ScheduledProgram['item']> = {}
): ScheduledProgram['item'] => ({
    ratingKey: 'episode-1',
    type: 'episode',
    title: 'Episode Name',
    fullTitle: 'Great Show - S01E01 - Episode Name',
    durationMs: 60 * 60_000,
    thumb: null,
    year: 2026,
    scheduledIndex: 0,
    ...overrides,
});

describe('resolveEpisodeTitlePresentation', () => {
    it('uses explicit showTitle after trimming', () => {
        const result = resolveEpisodeTitlePresentation(makeEpisodeItem({
            showTitle: '  Explicit Show  ',
            fullTitle: 'Other Show - S01E01 - Episode Name',
        }));

        expect(result).toEqual({
            showTitle: 'Explicit Show',
            episodeTitle: 'Episode Name',
        });
    });

    it('derives showTitle from Show - SxxExx - Episode fullTitle', () => {
        const result = resolveEpisodeTitlePresentation(makeEpisodeItem({
            showTitle: '',
            fullTitle: 'Great Show - S01E01 - Episode Name',
        }));

        expect(result.showTitle).toBe('Great Show');
    });

    it('derives showTitle from Show - Episode fullTitle', () => {
        const result = resolveEpisodeTitlePresentation(makeEpisodeItem({
            showTitle: '',
            title: 'Scavengers',
            fullTitle: 'Scavengers Reign - Scavengers',
        }));

        expect(result).toEqual({
            showTitle: 'Scavengers Reign',
            episodeTitle: 'Scavengers',
        });
    });

    it('strips a leading episode code before suffix comparison', () => {
        const result = resolveEpisodeTitlePresentation(makeEpisodeItem({
            showTitle: '',
            title: 'S01E09 - The Edge Of Recovery',
            fullTitle: 'Great Show - The Edge Of Recovery',
        }));

        expect(result).toEqual({
            showTitle: 'Great Show',
            episodeTitle: 'The Edge Of Recovery',
        });
    });

    it('trims fullTitle and episode title before deriving the fallback showTitle', () => {
        const result = resolveEpisodeTitlePresentation(makeEpisodeItem({
            showTitle: '  ',
            title: '  The Pilot  ',
            fullTitle: '  Great Show - The Pilot  ',
        }));

        expect(result).toEqual({
            showTitle: 'Great Show',
            episodeTitle: 'The Pilot',
        });
    });

    it.each([
        {
            title: 'Episode Name',
            fullTitle: 'Episode Name',
        },
        {
            title: 'Episode Name',
            fullTitle: 'Great Show - Different Episode',
        },
        {
            title: 'Episode Name',
            fullTitle: ' - Episode Name',
        },
        {
            title: 'Episode Name',
            fullTitle: ' - S01E01 - Episode Name',
        },
    ])('returns no derived showTitle for non-matching fullTitle %#', ({ title, fullTitle }) => {
        const result = resolveEpisodeTitlePresentation(makeEpisodeItem({
            showTitle: '',
            title,
            fullTitle,
        }));

        expect(result.showTitle).toBe('');
    });
});
