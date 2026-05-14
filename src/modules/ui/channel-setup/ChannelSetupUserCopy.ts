type ChannelSetupBlockedCopySurface = 'estimate' | 'review' | 'build' | 'warning';

const INTERNAL_CHANNEL_SETUP_COPY_PATTERN =
    /\b(?:stop and re-plan|re-plan|planner|execution|cleanup|slice|blocked plan|plan blocked)\b|partial setup plan/i;

const RECOVERY_GUIDANCE = 'Try again later, disable that source, or continue with supported channel types.';

type ParsedNativeFacetFailure = {
    source: string;
    libraryTitle: string;
    issue: 'failed' | 'unsupported' | 'empty' | 'count-failed';
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
    const parsed = parseNativeFacetFailure(message);
    if (parsed) {
        return formatParsedNativeFacetFailure(parsed);
    }
    if (hasInternalChannelSetupCopy(message)) {
        return genericBlockedCopy(surface);
    }
    return message;
}

export function formatChannelSetupWarningCopy(message: string): string {
    return formatChannelSetupUserCopy(message, 'warning');
}
