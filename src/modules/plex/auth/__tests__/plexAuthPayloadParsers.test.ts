import {
    parsePinResponse,
    parseUserResponse,
    parseHomeUsersPayload,
    parseSwitchResponsePayload,
    readPlexResponse,
    type PlexResponsePayload,
} from '../plexAuthPayloadParsers';
import { AppErrorCode } from '../../../../types/app-errors';

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

describe('plexAuthPayloadParsers', () => {
    describe('parsePinResponse', () => {
        it('trims required and optional string fields after validation', () => {
            expect(
                parsePinResponse(
                    {
                        id: '42',
                        code: '  abc123  ',
                        expiresAt: '2026-04-18T12:00:00.000Z',
                        clientIdentifier: '  client-123  ',
                    },
                    'fallback-client'
                )
            ).toMatchObject({
                id: 42,
                code: 'abc123',
                clientIdentifier: 'client-123',
            });
        });

        it('falls back when optional clientIdentifier is blank after trimming', () => {
            expect(
                parsePinResponse(
                    {
                        id: 42,
                        code: 'abc123',
                        expiresAt: '2026-04-18T12:00:00.000Z',
                        clientIdentifier: '   ',
                    },
                    'fallback-client'
                )
            ).toMatchObject({
                clientIdentifier: 'fallback-client',
            });
        });

        it('normalizes blank authToken values to null', () => {
            expect(
                parsePinResponse(
                    {
                        id: 42,
                        code: 'abc123',
                        expiresAt: '2026-04-18T12:00:00.000Z',
                        authToken: '   ',
                    },
                    'fallback-client'
                )
            ).toMatchObject({
                authToken: null,
            });
        });

        it('trims non-blank authToken values', () => {
            expect(
                parsePinResponse(
                    {
                        id: 42,
                        code: 'abc123',
                        expiresAt: '2026-04-18T12:00:00.000Z',
                        authToken: '  token-123  ',
                    },
                    'fallback-client'
                )
            ).toMatchObject({
                authToken: 'token-123',
            });
        });

        it.each([
            ['missing id', { code: 'abc123', expiresAt: '2026-04-18T12:00:00.000Z' }],
            ['invalid id', { id: 'abc', code: 'abc123', expiresAt: '2026-04-18T12:00:00.000Z' }],
            ['invalid code', { id: 42, code: '   ', expiresAt: '2026-04-18T12:00:00.000Z' }],
            ['invalid expiresAt', { id: 42, code: 'abc123', expiresAt: 'not-a-date' }],
        ])('rejects %s in PIN payloads', (_label, payload) => {
            expect(() => parsePinResponse(payload, 'fallback-client')).toThrow(
                expect.objectContaining({
                    code: AppErrorCode.PARSE_ERROR,
                })
            );
        });
    });

    describe('parseUserResponse', () => {
        it('parses required user profile fields from a valid payload', () => {
            const token = parseUserResponse(
                {
                    id: 12345,
                    username: '  validateduser  ',
                    email: '  validated@example.com  ',
                    thumb: 'https://plex.tv/thumb.jpg',
                    preferredSubtitleLanguage: '  es  ',
                },
                'valid-token'
            );

            expect(token).toMatchObject({
                token: 'valid-token',
                userId: '12345',
                username: 'validateduser',
                email: 'validated@example.com',
                thumb: 'https://plex.tv/thumb.jpg',
                preferredSubtitleLanguage: 'es',
            });
        });

        it.each([
            ['non-object payload', null],
            ['array payload', []],
            ['undefined payload', undefined],
            ['missing id', { username: 'user', email: 'user@example.com' }],
            ['blank id', { id: '   ', username: 'user', email: 'user@example.com' }],
            ['invalid id', { id: {}, username: 'user', email: 'user@example.com' }],
            ['zero numeric id', { id: 0, username: 'user', email: 'user@example.com' }],
            ['negative numeric id', { id: -1, username: 'user', email: 'user@example.com' }],
            ['fractional numeric id', { id: 1.5, username: 'user', email: 'user@example.com' }],
            ['missing username', { id: 1, email: 'user@example.com' }],
            ['blank username', { id: 1, username: '   ', email: 'user@example.com' }],
            ['missing email', { id: 1, username: 'user' }],
            ['blank email', { id: 1, username: 'user', email: '   ' }],
        ])('throws PARSE_ERROR for %s', (_label, payload) => {
            expect(() => parseUserResponse(payload, 'valid-token')).toThrow(
                expect.objectContaining({
                    code: AppErrorCode.PARSE_ERROR,
                })
            );
        });
    });

    describe('parseHomeUsersPayload', () => {
        it('dedupes duplicate home users collected from nested JSON payloads', () => {
            const payload: PlexResponsePayload = {
                kind: 'json',
                data: {
                    MediaContainer: {
                        users: [
                            { id: '1', title: 'Admin', admin: 1, protected: 1 },
                            { id: '2', title: 'Kid', admin: 0, protected: 0 },
                        ],
                        homeUsers: {
                            User: [
                                { id: '1', title: 'Admin', admin: 1, protected: 1 },
                            ],
                        },
                    },
                },
            };

            const users = parseHomeUsersPayload(payload);

            expect(users.map((user) => user.id)).toEqual(['1', '2']);
        });

        it('dedupes duplicate home users when XML parsing falls back to regex extraction', () => {
            const payload: PlexResponsePayload = {
                kind: 'text',
                data: `
                    <User id="1" title="Admin" admin="1" protected="0" />
                    <User id="1" title="Admin" admin="1" protected="0" />
                `,
            };

            const users = parseHomeUsersPayload(payload);

            expect(users).toHaveLength(1);
            expect(users[0]).toMatchObject({ id: '1', title: 'Admin' });
        });
    });

    describe('parseSwitchResponsePayload', () => {
        it.each([
            ['authToken', { authToken: 'child-token' }],
            ['authenticationToken', { authenticationToken: 'child-token' }],
            ['token', { token: 'child-token' }],
        ])('accepts %s from JSON objects', (_label, data) => {
            const payload: PlexResponsePayload = { kind: 'json', data };

            expect(parseSwitchResponsePayload(payload)).toEqual({ authToken: 'child-token' });
        });

        it.each([
            ['authToken', '{"authToken":"child-token"}'],
            ['authenticationToken', '{"authenticationToken":"child-token"}'],
            ['token', '{"token":"child-token"}'],
        ])('accepts %s from JSON text payloads', (_label, data) => {
            const payload: PlexResponsePayload = { kind: 'text', data };

            expect(parseSwitchResponsePayload(payload)).toEqual({ authToken: 'child-token' });
        });

        it.each([
            ['authToken', '<User authToken="child-token" />'],
            ['authenticationToken', '<User authenticationToken="child-token" />'],
            ['token', '<User token="child-token" />'],
        ])('accepts %s from XML attributes', (_label, data) => {
            const payload: PlexResponsePayload = { kind: 'text', data };

            expect(parseSwitchResponsePayload(payload)).toEqual({ authToken: 'child-token' });
        });

        it.each([
            ['authToken', '<MediaContainer><authToken>child-token</authToken></MediaContainer>'],
            [
                'authenticationToken',
                '<MediaContainer><authenticationToken>child-token</authenticationToken></MediaContainer>',
            ],
            ['token', '<MediaContainer><token>child-token</token></MediaContainer>'],
        ])('accepts %s from XML element content', (_label, data) => {
            const payload: PlexResponsePayload = { kind: 'text', data };

            expect(parseSwitchResponsePayload(payload)).toEqual({ authToken: 'child-token' });
        });
    });
});
