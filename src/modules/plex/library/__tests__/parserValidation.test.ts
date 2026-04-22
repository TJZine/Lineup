import { AppErrorCode } from '../../../../types/app-errors';
import { PlexLibraryError } from '../PlexLibraryError';
import {
    parseArrayOrEmpty,
    parseRequiredArray,
    parseRequiredObject,
} from '../parserValidation';

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
});
