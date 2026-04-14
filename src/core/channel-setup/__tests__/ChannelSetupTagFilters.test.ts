/**
 * @jest-environment jsdom
 */

import {
    buildChannelSetupTagFilter,
    parseChannelSetupTagFastKeyFilters,
} from '../ChannelSetupTagFilters';
import type { PlexTagDirectoryItem } from '../../../modules/plex/library';

const makeTag = (overrides: Partial<PlexTagDirectoryItem>): PlexTagDirectoryItem => ({
    key: 'tag-1',
    title: 'Default Tag',
    count: 1,
    ...overrides,
});

describe('ChannelSetupTagFilters', () => {
    it('parses actor/studio/type from fastKey and strips Plex token params', () => {
        expect(
            parseChannelSetupTagFastKeyFilters(
                '/library/sections/1/actor?type=4&actor=Alex%20Star&X-Plex-Token=secret'
            )
        ).toEqual({ type: 4, actor: 'Alex Star' });
    });

    it('falls back to tag.key when fastKey does not contain the requested family', () => {
        expect(
            buildChannelSetupTagFilter(
                makeTag({
                    key: 'k1',
                    title: 'Alex Star',
                    fastKey: '/library/sections/1/studio?studio=Studio%20A',
                }),
                'actor'
            )
        ).toEqual({ actor: 'k1' });
    });

    it('returns an empty object for malformed fastKey values', () => {
        expect(parseChannelSetupTagFastKeyFilters('%%%%')).toEqual({});
    });

    it('ignores unsupported and empty query values', () => {
        expect(
            parseChannelSetupTagFastKeyFilters(
                '/library/sections/1/actor?type=4&actor=&studio=Studio%20A&foo=bar'
            )
        ).toEqual({ type: 4, studio: 'Studio A' });
    });
});
