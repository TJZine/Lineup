/**
 * @jest-environment jsdom
 */

import { AppErrorCode } from '../../../lifecycle/types';
import { discoverPlexResourcesWithRequestPolicy } from '../PlexResourceDiscoveryRequestPolicy';

const discoveryHeaders = {
    Accept: 'application/json',
    'X-Plex-Token': 'mock-token',
    'X-Plex-Client-Identifier': 'mock-client-id',
};

function mockDiscoveryResponse(response: unknown): jest.Mock {
    const fetchMock = jest.fn().mockResolvedValue(response);
    (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;
    return fetchMock;
}

function createTextResponse(body: string, contentType: string | null = null): Response {
    return {
        ok: true,
        status: 200,
        headers: {
            get: (name: string): string | null => (
                name.toLowerCase() === 'content-type' ? contentType : null
            ),
        },
        text: async () => body,
    } as Response;
}

function createUnreadableTextResponse(contentType: string | null = null): Response {
    return {
        ok: true,
        status: 200,
        headers: {
            get: (name: string): string | null => (
                name.toLowerCase() === 'content-type' ? contentType : null
            ),
        },
        text: async () => {
            throw new Error('body stream failed');
        },
    } as unknown as Response;
}

describe('discoverPlexResourcesWithRequestPolicy response parsing', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn();
    });

    it('returns JSON resource arrays directly', async () => {
        const resources = [
            {
                clientIdentifier: 'srv-json',
                name: 'JSON Server',
                sourceTitle: 'json-user',
                ownerId: 'owner-json',
                owned: true,
                provides: 'server',
                connections: [],
            },
        ];
        mockDiscoveryResponse(createTextResponse(JSON.stringify(resources), 'application/json'));

        await expect(discoverPlexResourcesWithRequestPolicy(discoveryHeaders)).resolves.toEqual(resources);
    });

    it('returns an empty list for empty response bodies', async () => {
        mockDiscoveryResponse(createTextResponse('', 'application/json'));

        await expect(discoverPlexResourcesWithRequestPolicy(discoveryHeaders)).resolves.toEqual([]);
    });

    it('maps XML devices and connections with existing defaults', async () => {
        mockDiscoveryResponse(createTextResponse(`
            <MediaContainer>
                <Device
                    clientIdentifier="srv-xml"
                    name="XML Server"
                    sourceTitle="xml-user"
                    ownerId="owner-xml"
                    owned="1"
                    provides="server">
                    <Connection
                        uri="https://xml.example:32400"
                        protocol="https"
                        address="xml.example"
                        port="32400"
                        local="1"
                        relay="0" />
                    <Connection port="not-a-number" />
                </Device>
            </MediaContainer>
        `, 'application/xml'));

        await expect(discoverPlexResourcesWithRequestPolicy(discoveryHeaders)).resolves.toEqual([
            {
                clientIdentifier: 'srv-xml',
                name: 'XML Server',
                sourceTitle: 'xml-user',
                ownerId: 'owner-xml',
                owned: true,
                provides: 'server',
                connections: [
                    {
                        uri: 'https://xml.example:32400',
                        protocol: 'https',
                        address: 'xml.example',
                        port: 32400,
                        local: true,
                        relay: false,
                    },
                    {
                        uri: '',
                        protocol: '',
                        address: '',
                        port: 0,
                        local: false,
                        relay: false,
                    },
                ],
            },
        ]);
    });

    it('detects XML resource responses with case-insensitive content types', async () => {
        mockDiscoveryResponse(createTextResponse('not-valid-xml', 'Application/XML'));

        await expect(discoverPlexResourcesWithRequestPolicy(discoveryHeaders)).rejects.toMatchObject({
            code: AppErrorCode.PARSE_ERROR,
            message: 'Invalid XML response from server discovery',
        });
    });

    it('rejects JSON resource arrays with malformed resource items as PARSE_ERROR', async () => {
        mockDiscoveryResponse(createTextResponse(JSON.stringify([
            {
                clientIdentifier: 'srv-json',
                name: 'JSON Server',
                sourceTitle: 'json-user',
                ownerId: 'owner-json',
                owned: true,
                provides: 'server',
                connections: {},
            },
        ]), 'application/json'));

        await expect(discoverPlexResourcesWithRequestPolicy(discoveryHeaders)).rejects.toMatchObject({
            code: AppErrorCode.PARSE_ERROR,
            message: 'Invalid JSON server discovery resource',
        });
    });

    it('normalizes valid JSON resource arrays before returning discovery resources', async () => {
        mockDiscoveryResponse(createTextResponse(JSON.stringify([
            {
                clientIdentifier: ' srv-json ',
                name: ' JSON Server ',
                sourceTitle: ' json-user ',
                ownerId: ' owner-json ',
                owned: '1',
                provides: ' server ',
                connections: [
                    {
                        uri: ' https://json.example:32400 ',
                        protocol: ' https ',
                        address: ' json.example ',
                        port: '32400',
                        local: '1',
                        relay: false,
                    },
                ],
            },
        ]), 'application/json'));

        await expect(discoverPlexResourcesWithRequestPolicy(discoveryHeaders)).resolves.toEqual([
            {
                clientIdentifier: 'srv-json',
                name: 'JSON Server',
                sourceTitle: 'json-user',
                ownerId: 'owner-json',
                owned: true,
                provides: 'server',
                connections: [
                    {
                        uri: 'https://json.example:32400',
                        protocol: 'https',
                        address: 'json.example',
                        port: 32400,
                        local: true,
                        relay: false,
                    },
                ],
            },
        ]);
    });

    it('throws PARSE_ERROR for non-XML unparsable responses', async () => {
        mockDiscoveryResponse(createTextResponse('not-a-json-or-xml-payload', 'text/plain'));

        await expect(discoverPlexResourcesWithRequestPolicy(discoveryHeaders)).rejects.toMatchObject({
            code: AppErrorCode.PARSE_ERROR,
            message: 'Failed to parse server discovery response',
        });
    });

    it('throws PARSE_ERROR when the discovery response body cannot be read', async () => {
        mockDiscoveryResponse(createUnreadableTextResponse('application/json'));

        await expect(discoverPlexResourcesWithRequestPolicy(discoveryHeaders)).rejects.toMatchObject({
            code: AppErrorCode.PARSE_ERROR,
            httpStatus: 200,
            message: 'Failed to read server discovery response body (content type: application/json)',
            retryable: false,
            cause: expect.objectContaining({
                name: 'Error',
                message: 'body stream failed',
            }),
        });
    });

    it('throws the existing XML parsererror message for invalid XML responses', async () => {
        mockDiscoveryResponse(createTextResponse('<MediaContainer><Device></MediaContainer>', 'application/xml'));

        await expect(discoverPlexResourcesWithRequestPolicy(discoveryHeaders)).rejects.toMatchObject({
            code: AppErrorCode.PARSE_ERROR,
            message: 'Invalid XML response from server discovery',
        });
    });

    it('rejects non-Response objects without a text method', async () => {
        mockDiscoveryResponse({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
        });

        await expect(discoverPlexResourcesWithRequestPolicy(discoveryHeaders)).rejects.toMatchObject({
            code: AppErrorCode.PARSE_ERROR,
            message: 'Expected Response with text method for server discovery response',
        });
    });
});
