import { PlexServerDiscoveryConfig } from '../interfaces';
import { PlexConnection, PlexServer } from '../types';

export const mockConfig: PlexServerDiscoveryConfig = {
    getCloudAuthHeaders: () => ({
        Accept: 'application/json',
        'X-Plex-Token': 'mock-token',
        'X-Plex-Client-Identifier': 'mock-client-id',
    }),
};

export function createMockServer(overrides: Partial<PlexServer> = {}): PlexServer {
    return {
        id: 'srv1',
        name: 'Test Server',
        sourceTitle: 'testuser',
        ownerId: 'owner1',
        owned: true,
        capabilities: ['server'],
        connections: [
            {
                uri: 'https://192.168.1.5:32400',
                protocol: 'https',
                address: '192.168.1.5',
                port: 32400,
                local: true,
                relay: false,
                latencyMs: null,
            },
        ],
        preferredConnection: null,
        ...overrides,
    };
}

export function createMockConnection(overrides: Partial<PlexConnection> = {}): PlexConnection {
    return {
        uri: 'https://192.168.1.5:32400',
        protocol: 'https',
        address: '192.168.1.5',
        port: 32400,
        local: true,
        relay: false,
        latencyMs: null,
        ...overrides,
    };
}

export function createMockFetchResponse(body: unknown, status: number = 200): {
    ok: boolean;
    status: number;
    headers: { get: () => null };
    json: () => Promise<unknown>;
    text: () => Promise<string>;
} {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: () => null },
        json: async () => body,
        text: async () => JSON.stringify(body),
    };
}

export function mockFetchJson(body: unknown, status: number = 200): jest.Mock {
    const fetchMock = jest.fn().mockResolvedValue(createMockFetchResponse(body, status));
    (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;
    return fetchMock;
}

export function mockFetchFailure(error: Error): jest.Mock {
    const fetchMock = jest.fn().mockRejectedValue(error);
    (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;
    return fetchMock;
}

export function expectDefined<T>(
    value: T | null | undefined,
    message: string = 'Expected value to be defined'
): T {
    expect(value).toBeDefined();
    if (value === null || value === undefined) {
        throw new Error(message);
    }
    return value;
}
