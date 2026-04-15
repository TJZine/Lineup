import { AppErrorCode } from '../../../lifecycle/types';
import { readPlexResponse } from '../plexAuthPayloadParsers';

describe('readPlexResponse', () => {
    it('throws PARSE_ERROR for malformed JSON bodies without double-reading the response', async () => {
        let consumed = false;
        const response = {
            headers: {
                get: (name: string): string | null => (
                    name === 'Content-Type' ? 'application/json' : null
                ),
            },
            text: jest.fn(async () => {
                if (consumed) {
                    throw new Error('body already consumed');
                }
                consumed = true;
                return '{"broken":';
            }),
            json: jest.fn(async () => {
                consumed = true;
                throw new SyntaxError('Unexpected end of JSON input');
            }),
        } as unknown as Response;

        await expect(readPlexResponse(response)).rejects.toMatchObject({
            code: AppErrorCode.PARSE_ERROR,
        });
        expect(response.text).toHaveBeenCalledTimes(1);
        expect(response.json).not.toHaveBeenCalled();
    });

    it('returns empty for blank responses', async () => {
        const response = {
            headers: {
                get: (): string => 'application/json',
            },
            text: jest.fn(async () => '   '),
            json: jest.fn(),
        } as unknown as Response;

        await expect(readPlexResponse(response)).resolves.toEqual({ kind: 'empty' });
        expect(response.text).toHaveBeenCalledTimes(1);
        expect(response.json).not.toHaveBeenCalled();
    });
});
