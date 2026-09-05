import { describeGuideFailure } from '../GuideDiagnosticValues';
import { AppErrorCode } from '../../../types/app-errors';

describe('Guide failure diagnostic privacy', () => {
    it('retains allowlisted classification without private throwable fields', () => {
        const error = Object.assign(new Error('private title and authenticated URL'), {
            name: 'PlexLibraryError', code: AppErrorCode.ACCESS_DENIED, httpStatus: 403,
            context: { token: 'private-token' },
        });
        expect(describeGuideFailure(error)).toEqual({
            thrownType: 'object', errorClass: 'PlexLibraryError', errorCode: AppErrorCode.ACCESS_DENIED,
            httpStatus: 403, cancellationReason: null,
        });
    });

    it('does not forward arbitrary names, codes, strings, or invalid HTTP status', () => {
        expect(describeGuideFailure({ name: 'private-name', code: 'private-code', httpStatus: 123456 }))
            .toEqual({ thrownType: 'object', errorClass: null, errorCode: null, httpStatus: null, cancellationReason: null });
        expect(describeGuideFailure('private-token')).toEqual({
            thrownType: 'string', errorClass: null, errorCode: null, httpStatus: null, cancellationReason: null,
        });
        expect(describeGuideFailure('request-replaced').cancellationReason).toBe('request-replaced');
    });

    it('does not throw when inspecting a hostile throwable', () => {
        const error = { get name(): string { throw new Error('private'); } };
        expect(() => describeGuideFailure(error)).not.toThrow();
        expect(describeGuideFailure(null).thrownType).toBe('null');
    });

    it('validates and returns the same snapshot of each throwable property', () => {
        let nameReads = 0;
        let codeReads = 0;
        const error = {
            get name(): string { return ++nameReads === 1 ? 'Error' : 'private-name'; },
            get code(): string { return ++codeReads === 1 ? AppErrorCode.ACCESS_DENIED : 'private-code'; },
        };
        expect(describeGuideFailure(error)).toEqual(expect.objectContaining({
            errorClass: 'Error', errorCode: AppErrorCode.ACCESS_DENIED,
        }));
        expect(nameReads).toBe(1);
        expect(codeReads).toBe(1);
    });
});
