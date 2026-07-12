import { AppErrorCode } from '../../../../types/app-errors';
import { PlexLibraryError } from '../PlexLibraryError';
import {
    parseArrayOrEmpty,
    parseFiniteNumberOrDefault,
    parseOptionalFiniteNumber,
    parseOptionalString,
    parseRequiredArray,
    parseRequiredFiniteNumber,
    parseRequiredObject,
    parseRequiredString,
    parseRequiredStringLike,
    parseStringOrDefault,
} from '../parsing/parserValidation';

describe('parserValidation', () => {
    it('returns objects and required arrays unchanged when the payload shape is valid', () => {
        const objectValue = { key: 'value' };
        const arrayValue = ['one', 'two'];

        expect(parseRequiredObject<typeof objectValue>(objectValue, 'object')).toEqual(objectValue);
        expect(parseRequiredArray<string>(arrayValue, 'array')).toEqual(arrayValue);
    });

    it('returns an empty array for nullable optional array payloads', () => {
        expect(parseArrayOrEmpty<string>(undefined, 'optional array')).toEqual([]);
        expect(parseArrayOrEmpty<string>(null, 'optional array')).toEqual([]);
    });

    it('throws a typed parse error when required object or array payloads are malformed', () => {
        expect(() => parseRequiredObject<string>(null, 'object')).toThrow(PlexLibraryError);
        expect(() => parseArrayOrEmpty<string>({}, 'optional array')).toThrow(PlexLibraryError);
        expect(() => parseRequiredArray<string>({}, 'required array')).toThrow(PlexLibraryError);
    });

    it('rejects arrays passed to parseRequiredObject with a typed parse error', () => {
        expect(() => parseRequiredObject<string[]>([], 'object')).toThrow(
            expect.objectContaining({
                code: AppErrorCode.PARSE_ERROR,
                message: 'Invalid object payload: expected an object',
            })
        );
    });

    it('returns valid required scalar values unchanged or normalized', () => {
        expect(parseRequiredString('value', 'object', 'field')).toBe('value');
        expect(parseRequiredStringLike(123, 'object', 'id')).toBe('123');
        expect(parseRequiredFiniteNumber(1, 'object', 'count')).toBe(1);
    });

    it('throws a typed parse error when required scalar values are missing or wrong typed', () => {
        expect(() => parseRequiredString(undefined, 'object', 'field')).toThrow(
            expect.objectContaining({
                code: AppErrorCode.PARSE_ERROR,
                message: 'Invalid object payload: field is required',
            })
        );
        expect(() => parseRequiredString(123, 'object', 'field')).toThrow(PlexLibraryError);
        expect(() => parseRequiredStringLike(null, 'object', 'id')).toThrow(PlexLibraryError);
        expect(() => parseRequiredFiniteNumber(Number.NaN, 'object', 'count')).toThrow(PlexLibraryError);
    });

    it('preserves optional/default behavior for missing and null scalar values', () => {
        expect(parseStringOrDefault(undefined, 'object', 'name')).toBe('');
        expect(parseStringOrDefault(null, 'object', 'name', 'fallback')).toBe('fallback');
        expect(parseOptionalString(null, 'object', 'name')).toBeUndefined();
        expect(parseFiniteNumberOrDefault(undefined, 'object', 'count')).toBe(0);
        expect(parseFiniteNumberOrDefault(null, 'object', 'count', 5)).toBe(5);
        expect(parseOptionalFiniteNumber(null, 'object', 'count')).toBeUndefined();
    });

    it.each([
        ['default string', (): unknown => parseStringOrDefault(12, 'object', 'name'), 'Invalid object payload: name must be a string'],
        ['optional string', (): unknown => parseOptionalString({}, 'object', 'name'), 'Invalid object payload: name must be a string'],
        ['default number', (): unknown => parseFiniteNumberOrDefault(Number.NaN, 'object', 'count'), 'Invalid object payload: count must be a finite number'],
        ['optional number', (): unknown => parseOptionalFiniteNumber('12', 'object', 'count'), 'Invalid object payload: count must be a finite number'],
    ])('throws a sanitized typed parse error for wrong-typed %s values', (_name, parse, message) => {
        expect(parse).toThrow(expect.objectContaining({
            code: AppErrorCode.PARSE_ERROR,
            message,
        }));
    });
});
