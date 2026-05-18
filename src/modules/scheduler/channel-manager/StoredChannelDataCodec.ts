import { fnv1a32Uint } from '../../../utils/hash';
import { isValidContentSource } from './ChannelContentSourceValidator';
import { cloneContentFilters, cloneContentSource } from './ChannelDomainClone';
import {
    isValidBuildStrategy,
    isValidContentFilterArray,
    isValidPlaybackMode,
    isValidSortOrder,
} from './ChannelValueValidators';
import { stripLegacySequentialVariant } from './stripLegacySequentialVariant';
import type { ChannelConfig, StoredChannelData } from './types';

function isValidStoredShape(value: unknown): value is Partial<StoredChannelData> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }

    const record = value as Record<string, unknown>;
    return Array.isArray(record.channels) && Array.isArray(record.channelOrder);
}

export function decodeStoredChannelData(raw: string): Partial<StoredChannelData> | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }

    if (!isValidStoredShape(parsed)) {
        return null;
    }
    return parsed;
}

export function encodeStoredChannelData(data: StoredChannelData): string {
    return JSON.stringify(data);
}

export type DecodedStoredChannelConfig = {
    channel: ChannelConfig;
    didMutate: boolean;
};

export function decodeStoredChannelConfigRecord(raw: unknown): DecodedStoredChannelConfig | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return null;
    }

    const sanitized = stripLegacySequentialVariant(raw);
    const record = sanitized.channel as Record<string, unknown>;
    let didMutate = sanitized.didMutate;

    const id = record['id'];
    if (typeof id !== 'string' || id.length === 0) {
        return null;
    }

    const contentSource = record['contentSource'];
    if (!isValidContentSource(contentSource)) {
        return null;
    }

    const number = decodeFiniteNumber(record, 'number', Number.NaN);
    if (number.didDefault) didMutate = true;

    const name = decodeString(record, 'name', `Channel ${Number.isFinite(number.value) ? number.value : id}`);
    if (name.didDefault) didMutate = true;

    const rawPlaybackMode = record['playbackMode'];
    const validPlaybackMode = isValidPlaybackMode(rawPlaybackMode);
    const playbackMode = validPlaybackMode ? rawPlaybackMode : 'sequential';
    if (!validPlaybackMode) {
        didMutate = true;
    }

    const startTimeAnchor = decodeFiniteNumber(record, 'startTimeAnchor', 0);
    const createdAt = decodeFiniteNumber(record, 'createdAt', 0);
    const updatedAt = decodeFiniteNumber(record, 'updatedAt', 0);
    const lastContentRefresh = decodeFiniteNumber(record, 'lastContentRefresh', 0);
    const itemCount = decodeFiniteNumber(record, 'itemCount', 0);
    const totalDurationMs = decodeFiniteNumber(record, 'totalDurationMs', 0);
    didMutate =
        didMutate ||
        startTimeAnchor.didDefault ||
        createdAt.didDefault ||
        updatedAt.didDefault ||
        lastContentRefresh.didDefault ||
        itemCount.didDefault ||
        totalDurationMs.didDefault;

    const skipIntros = decodeBoolean(record, 'skipIntros', false);
    const skipCredits = decodeBoolean(record, 'skipCredits', false);
    didMutate = didMutate || skipIntros.didDefault || skipCredits.didDefault;

    const channel: ChannelConfig = {
        id,
        number: number.value,
        name: name.value,
        contentSource: cloneContentSource(contentSource),
        playbackMode,
        startTimeAnchor: startTimeAnchor.value,
        skipIntros: skipIntros.value,
        skipCredits: skipCredits.value,
        createdAt: createdAt.value,
        updatedAt: updatedAt.value,
        lastContentRefresh: lastContentRefresh.value,
        itemCount: itemCount.value,
        totalDurationMs: totalDurationMs.value,
    };

    didMutate = applyOptionalPersistedChannelFields(channel, record, didMutate);
    if (typeof channel.shuffleSeed !== 'number' || !Number.isFinite(channel.shuffleSeed)) {
        channel.shuffleSeed = fnv1a32Uint(`${channel.id}:shuffle`);
        didMutate = true;
    }
    if (typeof channel.phaseSeed !== 'number' || !Number.isFinite(channel.phaseSeed)) {
        channel.phaseSeed = fnv1a32Uint(`${channel.id}:phase`);
        didMutate = true;
    }

    return { channel, didMutate };
}

function decodeString(
    record: Record<string, unknown>,
    key: string,
    fallback: string
): { value: string; didDefault: boolean } {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) {
        return { value, didDefault: false };
    }
    return { value: fallback, didDefault: true };
}

function decodeBoolean(
    record: Record<string, unknown>,
    key: string,
    fallback: boolean
): { value: boolean; didDefault: boolean } {
    const value = record[key];
    if (typeof value === 'boolean') {
        return { value, didDefault: false };
    }
    return { value: fallback, didDefault: true };
}

function decodeFiniteNumber(
    record: Record<string, unknown>,
    key: string,
    fallback: number
): { value: number; didDefault: boolean } {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
        return { value, didDefault: false };
    }
    return { value: fallback, didDefault: true };
}

function applyOptionalPersistedChannelFields(
    channel: ChannelConfig,
    record: Record<string, unknown>,
    didMutate: boolean
): boolean {
    if (record['description'] !== undefined) {
        if (typeof record['description'] === 'string') channel.description = record['description'];
        else didMutate = true;
    }
    if (record['isAutoGenerated'] !== undefined) {
        if (typeof record['isAutoGenerated'] === 'boolean') channel.isAutoGenerated = record['isAutoGenerated'];
        else didMutate = true;
    }
    if (record['icon'] !== undefined) {
        if (typeof record['icon'] === 'string') channel.icon = record['icon'];
        else didMutate = true;
    }
    if (record['color'] !== undefined) {
        if (typeof record['color'] === 'string') channel.color = record['color'];
        else didMutate = true;
    }
    if (record['buildStrategy'] !== undefined) {
        if (isValidBuildStrategy(record['buildStrategy'])) channel.buildStrategy = record['buildStrategy'];
        else didMutate = true;
    }
    if (record['sourceLibraryId'] !== undefined) {
        if (typeof record['sourceLibraryId'] === 'string') channel.sourceLibraryId = record['sourceLibraryId'];
        else didMutate = true;
    }
    if (record['sourceLibraryName'] !== undefined) {
        if (typeof record['sourceLibraryName'] === 'string') channel.sourceLibraryName = record['sourceLibraryName'];
        else didMutate = true;
    }
    if (record['lineupReplicaIndex'] !== undefined) {
        if (typeof record['lineupReplicaIndex'] === 'number' && Number.isFinite(record['lineupReplicaIndex'])) {
            channel.lineupReplicaIndex = Math.max(0, Math.floor(record['lineupReplicaIndex']));
            didMutate = didMutate || channel.lineupReplicaIndex !== record['lineupReplicaIndex'];
        } else {
            didMutate = true;
        }
    }
    if (record['isPlaybackModeVariant'] !== undefined) {
        if (typeof record['isPlaybackModeVariant'] === 'boolean') {
            channel.isPlaybackModeVariant = record['isPlaybackModeVariant'];
        } else {
            didMutate = true;
        }
    }
    if (record['shuffleSeed'] !== undefined) {
        if (typeof record['shuffleSeed'] === 'number' && Number.isFinite(record['shuffleSeed'])) {
            channel.shuffleSeed = record['shuffleSeed'];
        } else {
            didMutate = true;
        }
    }
    if (record['phaseSeed'] !== undefined) {
        if (typeof record['phaseSeed'] === 'number' && Number.isFinite(record['phaseSeed'])) {
            channel.phaseSeed = record['phaseSeed'];
        } else {
            didMutate = true;
        }
    }
    if (record['blockSize'] !== undefined && channel.playbackMode === 'block') {
        if (typeof record['blockSize'] === 'number' && Number.isFinite(record['blockSize'])) {
            channel.blockSize = Math.max(1, Math.floor(record['blockSize']));
            didMutate = didMutate || channel.blockSize !== record['blockSize'];
        } else {
            didMutate = true;
        }
    } else if (record['blockSize'] !== undefined) {
        didMutate = true;
    }
    if (record['contentFilters'] !== undefined) {
        if (isValidContentFilterArray(record['contentFilters'])) {
            channel.contentFilters = cloneContentFilters(record['contentFilters']);
        } else {
            didMutate = true;
        }
    }
    if (record['sortOrder'] !== undefined) {
        if (isValidSortOrder(record['sortOrder'])) channel.sortOrder = record['sortOrder'];
        else didMutate = true;
    }
    if (record['maxEpisodeRunTimeMs'] !== undefined) {
        if (typeof record['maxEpisodeRunTimeMs'] === 'number' && Number.isFinite(record['maxEpisodeRunTimeMs'])) {
            channel.maxEpisodeRunTimeMs = record['maxEpisodeRunTimeMs'];
        } else {
            didMutate = true;
        }
    }
    if (record['minEpisodeRunTimeMs'] !== undefined) {
        if (typeof record['minEpisodeRunTimeMs'] === 'number' && Number.isFinite(record['minEpisodeRunTimeMs'])) {
            channel.minEpisodeRunTimeMs = record['minEpisodeRunTimeMs'];
        } else {
            didMutate = true;
        }
    }
    return didMutate;
}
