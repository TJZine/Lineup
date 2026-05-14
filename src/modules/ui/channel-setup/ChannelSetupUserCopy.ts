type ChannelSetupBlockedCopySurface = 'estimate' | 'review' | 'build' | 'warning';

const INTERNAL_CHANNEL_SETUP_COPY_PATTERN =
    /\b(?:stop and re-plan|re-plan|planner|execution|cleanup|slice|blocked plan|plan blocked)\b|partial setup plan/i;

const RECOVERY_GUIDANCE = 'Try again later, disable that source, or continue with supported channel types.';

type ParsedNativeFacetFailure = {
    source: string;
    libraryTitle: string;
    issue: 'failed' | 'unsupported' | 'empty' | 'count-failed';
};

type ParsedPartialWarning = {
    source: 'collections' | 'playlists';
    libraryTitle: string | null;
    cause: string;
};

function normalizeSource(raw: string): string {
    return raw.trim().replace(/\s+/g, ' ');
}

function normalizeLibraryTitle(raw: string): string {
    return raw.trim().replace(/\s+/g, ' ');
}

function parseNativeFacetFailure(message: string): ParsedNativeFacetFailure | null {
    const tagFailure = message.match(/^Required (.+?) tag directory \(type=\d+\) failed for (.+?) \(.+?\);/i);
    if (tagFailure?.[1] && tagFailure[2]) {
        return {
            source: normalizeSource(tagFailure[1]),
            libraryTitle: normalizeLibraryTitle(tagFailure[2]),
            issue: 'failed',
        };
    }

    const tagUnsupported = message.match(
        /^Required (.+?) tag directory \(type=\d+\) (returned no entries|is unsupported) for (.+?);/i
    );
    if (tagUnsupported?.[1] && tagUnsupported[2] && tagUnsupported[3]) {
        return {
            source: normalizeSource(tagUnsupported[1]),
            libraryTitle: normalizeLibraryTitle(tagUnsupported[3]),
            issue: tagUnsupported[2] === 'returned no entries' ? 'empty' : 'unsupported',
        };
    }

    const countFailure = message.match(/^Required (.+?) item counts \(type=\d+\) failed for (.+?) \(.+?\);/i);
    if (countFailure?.[1] && countFailure[2]) {
        return {
            source: normalizeSource(countFailure[1]),
            libraryTitle: normalizeLibraryTitle(countFailure[2]),
            issue: 'count-failed',
        };
    }

    return null;
}

function parsePartialWarning(message: string): ParsedPartialWarning | null {
    const partialWarning = message.match(
        /^Partial setup plan \((fetch_collections|fetch_playlists)\): \1 failed(?: for (.+?))? \((.+)\)$/i
    );
    if (!partialWarning?.[1] || !partialWarning[3]) {
        return null;
    }
    return {
        source: partialWarning[1] === 'fetch_collections' ? 'collections' : 'playlists',
        libraryTitle: partialWarning[2] ? normalizeLibraryTitle(partialWarning[2]) : null,
        cause: partialWarning[3].trim(),
    };
}

function formatParsedNativeFacetFailure(parsed: ParsedNativeFacetFailure): string {
    const sourceLabel = parsed.source.toLowerCase();
    const library = parsed.libraryTitle;

    if (parsed.issue === 'unsupported') {
        return `Plex does not provide usable ${sourceLabel} data for ${library}. ${RECOVERY_GUIDANCE}`;
    }
    if (parsed.issue === 'empty') {
        return `Plex returned no ${sourceLabel} entries for ${library}. ${RECOVERY_GUIDANCE}`;
    }
    if (parsed.issue === 'count-failed') {
        return `Plex could not count ${sourceLabel} items for ${library}. ${RECOVERY_GUIDANCE}`;
    }
    return `Plex could not read ${sourceLabel} data for ${library}. ${RECOVERY_GUIDANCE}`;
}

function formatParsedPartialWarning(parsed: ParsedPartialWarning): string {
    const sourceLabel = parsed.source === 'collections' ? 'Collections' : 'Playlists';
    const librarySegment = parsed.libraryTitle ? ` for ${parsed.libraryTitle}` : '';
    return `${sourceLabel} could not be included${librarySegment}: ${parsed.cause}. ${RECOVERY_GUIDANCE}`;
}

function genericBlockedCopy(surface: ChannelSetupBlockedCopySurface): string {
    if (surface === 'build') {
        return `Some channel types could not be built for this library. ${RECOVERY_GUIDANCE}`;
    }
    return `Some channel types could not be estimated for this library. ${RECOVERY_GUIDANCE}`;
}

export function hasInternalChannelSetupCopy(text: string): boolean {
    return INTERNAL_CHANNEL_SETUP_COPY_PATTERN.test(text);
}

export function formatChannelSetupUserCopy(
    message: string,
    surface: ChannelSetupBlockedCopySurface
): string {
    const trimmed = message.trim();
    if (trimmed.length === 0) {
        return genericBlockedCopy(surface);
    }
    const parsed = parseNativeFacetFailure(trimmed);
    if (parsed) {
        return formatParsedNativeFacetFailure(parsed);
    }
    const partialWarning = parsePartialWarning(trimmed);
    if (partialWarning) {
        return formatParsedPartialWarning(partialWarning);
    }
    if (hasInternalChannelSetupCopy(trimmed)) {
        return genericBlockedCopy(surface);
    }
    return message;
}

export function formatChannelSetupWarningCopy(message: string): string {
    return formatChannelSetupUserCopy(message, 'warning');
}
