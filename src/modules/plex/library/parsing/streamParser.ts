import type { PlexStream, RawStream } from '../types';
import {
    parseOptionalFiniteNumber,
    parseOptionalString,
    parseRequiredFiniteNumber,
    parseRequiredObject,
    parseRequiredString,
    parseRequiredStringLike,
    throwScalarTypeError,
} from './parserValidation';

const VALID_STREAM_TYPES = new Set([1, 2, 3]);
const TRUE_VALUES = new Set(['1', 'true', 'yes']);
const FALSE_VALUES = new Set(['0', 'false', 'no']);

export function parseStream(data: RawStream): PlexStream {
    const streamData = parseRequiredObject<RawStream>(data, 'stream');
    const stream: PlexStream = {
        id: parseRequiredStringLike(streamData.id, 'stream', 'id'),
        streamType: normalizeStreamType(parseRequiredFiniteNumber(streamData.streamType, 'stream', 'streamType')),
        codec: parseRequiredString(streamData.codec, 'stream', 'codec'),
    };

    assignOptionalStreamFields(stream, streamData);

    return stream;
}

function normalizeStreamType(value: number): 1 | 2 | 3 {
    return VALID_STREAM_TYPES.has(value) ? (value as 1 | 2 | 3) : 1;
}

function assignOptionalStreamFields(stream: PlexStream, data: RawStream): void {
    assignOptionalProperty(stream, 'language', parseOptionalString(data.language, 'stream', 'language'));
    assignOptionalProperty(stream, 'languageCode', parseOptionalString(data.languageCode, 'stream', 'languageCode'));
    assignOptionalProperty(stream, 'title', parseOptionalString(data.title, 'stream', 'title'));
    assignOptionalProperty(stream, 'displayTitle', parseOptionalString(data.displayTitle, 'stream', 'displayTitle'));
    assignOptionalProperty(stream, 'extendedDisplayTitle', parseOptionalString(data.extendedDisplayTitle, 'stream', 'extendedDisplayTitle'));
    assignOptionalProperty(stream, 'selected', normalizeOptionalBoolean(data.selected, 'selected', false));
    assignOptionalProperty(stream, 'default', normalizeOptionalBoolean(data.default, 'default', false));
    assignOptionalProperty(stream, 'forced', normalizeOptionalBoolean(data.forced, 'forced', false));
    assignOptionalProperty(stream, 'width', parseOptionalFiniteNumber(data.width, 'stream', 'width'));
    assignOptionalProperty(stream, 'height', parseOptionalFiniteNumber(data.height, 'stream', 'height'));
    assignOptionalProperty(stream, 'bitrate', parseOptionalFiniteNumber(data.bitrate, 'stream', 'bitrate'));
    assignOptionalProperty(stream, 'frameRate', parseOptionalFiniteNumber(data.frameRate, 'stream', 'frameRate'));
    assignOptionalProperty(stream, 'channels', parseOptionalFiniteNumber(data.channels, 'stream', 'channels'));
    assignOptionalProperty(stream, 'samplingRate', parseOptionalFiniteNumber(data.samplingRate, 'stream', 'samplingRate'));
    assignOptionalProperty(stream, 'format', parseOptionalString(data.format, 'stream', 'format'));
    assignOptionalProperty(stream, 'key', parseOptionalString(data.key, 'stream', 'key'));
    assignOptionalProperty(stream, 'profile', parseOptionalString(data.profile, 'stream', 'profile'));
    assignOptionalProperty(stream, 'colorTrc', parseOptionalString(data.colorTrc, 'stream', 'colorTrc'));
    assignOptionalProperty(stream, 'colorSpace', parseOptionalString(data.colorSpace, 'stream', 'colorSpace'));
    assignOptionalProperty(stream, 'colorPrimaries', parseOptionalString(data.colorPrimaries, 'stream', 'colorPrimaries'));
    assignOptionalProperty(stream, 'bitDepth', parseOptionalFiniteNumber(data.bitDepth, 'stream', 'bitDepth'));
    assignOptionalProperty(stream, 'hdr', parseOptionalString(data.hdr, 'stream', 'hdr'));
    assignOptionalProperty(stream, 'dynamicRange', parseOptionalString(data.dynamicRange, 'stream', 'dynamicRange'));

    const doviProfile = normalizeOptionalDoviProfile(data.DOVIProfile);
    if (doviProfile !== undefined) {
        stream.doviProfile = doviProfile;
    }

    const doviPresent = normalizeOptionalBoolean(data.DOVIPresent, 'DOVIPresent', true);
    if (typeof doviPresent === 'boolean') {
        stream.doviPresent = doviPresent;
    }
}

function assignOptionalProperty<K extends keyof PlexStream>(
    stream: PlexStream,
    key: K,
    value: PlexStream[K] | undefined
): void {
    if (value !== undefined) {
        stream[key] = value;
    }
}

function normalizeOptionalBoolean(
    value: unknown,
    field: string,
    omitUnknownString: boolean
): boolean | undefined {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        return value > 0;
    }

    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (TRUE_VALUES.has(normalized)) {
            return true;
        }
        if (FALSE_VALUES.has(normalized)) {
            return false;
        }
        if (omitUnknownString) {
            return undefined;
        }
    }

    throwScalarTypeError(
        'stream',
        field,
        'a boolean, finite number, or recognized boolean string'
    );
}

function normalizeOptionalDoviProfile(value: unknown): string | undefined {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
    }

    throwScalarTypeError('stream', 'DOVIProfile', 'a string or finite number');
}
