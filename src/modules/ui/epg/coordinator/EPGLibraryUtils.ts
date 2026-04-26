import type { ChannelConfig } from '../../../scheduler/channel-manager';

export const buildLibraries = (channels: ChannelConfig[]): Array<{ id: string; name: string }> => {
    const map = new Map<string, string>();
    for (const c of channels) {
        const id =
            c.sourceLibraryId ??
            (c.contentSource.type === 'library' ? c.contentSource.libraryId : null);
        if (!id) {
            continue;
        }

        const name = c.sourceLibraryName ?? c.name;
        const existing = map.get(id);
        if (!existing) {
            map.set(id, name);
            continue;
        }

        if (typeof c.sourceLibraryName === 'string' && c.sourceLibraryName.length > 0 && existing !== c.sourceLibraryName) {
            map.set(id, c.sourceLibraryName);
        }
    }

    return Array.from(map.entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name));
};

export const countLibraryTypeVotes = (
    channels: ChannelConfig[],
    selectedId: string
): { movieVotes: number; showVotes: number } => {
    let movieVotes = 0;
    let showVotes = 0;

    for (const channel of channels) {
        const belongsToLibrary =
            channel.sourceLibraryId === selectedId ||
            (channel.contentSource.type === 'library' && channel.contentSource.libraryId === selectedId);
        if (!belongsToLibrary) {
            continue;
        }

        if (channel.contentSource.type === 'library') {
            if (channel.contentSource.libraryType === 'movie') {
                movieVotes += 1;
            } else {
                showVotes += 1;
            }
            continue;
        }

        if (channel.contentSource.type === 'show') {
            showVotes += 1;
        }
    }

    return { movieVotes, showVotes };
};

export const countLibraryTypeVotesAcrossAllChannels = (
    channels: ChannelConfig[]
): { movieVotes: number; showVotes: number; unknownVotes: number } => {
    let movieVotes = 0;
    let showVotes = 0;
    let unknownVotes = 0;

    for (const channel of channels) {
        const source = channel.contentSource;
        if (source.type === 'library') {
            if (source.libraryType === 'movie') {
                movieVotes += 1;
            } else {
                showVotes += 1;
            }
            continue;
        }
        if (source.type === 'show') {
            showVotes += 1;
            continue;
        }
        unknownVotes += 1;
    }

    return { movieVotes, showVotes, unknownVotes };
};
