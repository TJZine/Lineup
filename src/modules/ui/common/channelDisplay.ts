import type { BuildStrategy } from '../../scheduler/channel-manager/contracts/types';

type ChannelDisplayArgs = {
    name: string;
    sourceLibraryName?: string | null;
};

type ChannelIdentityDisplayArgs = ChannelDisplayArgs & {
    buildStrategy?: BuildStrategy | null;
};

type ChannelIdentityDisplayParts = {
    primaryName: string;
    sourceText: string | null;
    categoryText: string | null;
    provenanceText: string | null;
};

const CATEGORY_LABELS = {
    actors: 'Actor',
    directors: 'Director',
    genres: 'Genre',
    studios: 'Studio',
    collections: 'Collection',
    playlists: 'Playlist',
    decades: 'Decade',
    recentlyAdded: 'Recently Added',
    libraryFallback: 'Library',
} satisfies Record<BuildStrategy, string>;

export function getChannelNameForDisplay({ name, sourceLibraryName }: ChannelDisplayArgs): string {
    if (!sourceLibraryName) return name;
    const trimmed = sourceLibraryName.trim();
    if (!trimmed) return name;
    const prefix = `${trimmed} - `;
    if (name.startsWith(prefix)) {
        return name.slice(prefix.length);
    }
    return name;
}

export function getChannelIdentityForDisplay({
    name,
    sourceLibraryName,
    buildStrategy,
}: ChannelIdentityDisplayArgs): ChannelIdentityDisplayParts {
    const trimmedName = name.trim();
    const trimmedSource = sourceLibraryName?.trim() ?? '';
    let primaryName = trimmedName;

    if (trimmedSource && trimmedName !== trimmedSource) {
        const prefix = `${trimmedSource} - `;
        const suffix = ` - ${trimmedSource}`;

        if (trimmedName.startsWith(prefix)) {
            primaryName = trimmedName.slice(prefix.length).trim();
        } else if (trimmedName.endsWith(suffix)) {
            primaryName = trimmedName.slice(0, -suffix.length).trim();
        }

        if (!primaryName) {
            primaryName = trimmedName;
        }
    }

    const categoryLabel = buildStrategy ? CATEGORY_LABELS[buildStrategy] : null;
    const sourceText = trimmedSource && !equalsIgnoreCase(trimmedSource, primaryName)
        ? trimmedSource
        : null;
    const categoryText = categoryLabel &&
        !equalsIgnoreCase(categoryLabel, primaryName) &&
        !equalsIgnoreCase(categoryLabel, sourceText ?? '')
        ? categoryLabel
        : null;
    const provenanceParts = [categoryText, sourceText].filter((part): part is string => part !== null);

    return {
        primaryName,
        sourceText,
        categoryText,
        provenanceText: provenanceParts.length > 0 ? provenanceParts.join(' · ') : null,
    };
}

function equalsIgnoreCase(left: string, right: string): boolean {
    return left.localeCompare(right, undefined, { sensitivity: 'accent' }) === 0;
}
