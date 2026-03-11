/**
 * @jest-environment jsdom
 */

import * as clientIdentifierModule from '../clientIdentifier';
import { createDefaultPlexAuthConfig } from '../config';

describe('createDefaultPlexAuthConfig', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
    });

    it('returns invariant metadata defaults and resolved client identifier', () => {
        jest.spyOn(clientIdentifierModule, 'resolveClientIdentifier').mockReturnValue('client-id-1');

        const config = createDefaultPlexAuthConfig();

        expect(clientIdentifierModule.resolveClientIdentifier).toHaveBeenCalledWith(undefined);
        expect(config).toEqual({
            clientIdentifier: 'client-id-1',
            product: 'Lineup',
            version: '1.0.0',
            platform: 'webOS',
            platformVersion: '6.0',
            device: 'LG Smart TV',
            deviceName: 'Living Room TV',
        });
    });

    it('passes through preferred client identifier for boundary-owned resolution', () => {
        jest.spyOn(clientIdentifierModule, 'resolveClientIdentifier').mockReturnValue('resolved-id');

        const config = createDefaultPlexAuthConfig('preferred-id');

        expect(clientIdentifierModule.resolveClientIdentifier).toHaveBeenCalledWith('preferred-id');
        expect(config.clientIdentifier).toBe('resolved-id');
    });

    it('returns a fresh object each call', () => {
        const resolver = jest
            .spyOn(clientIdentifierModule, 'resolveClientIdentifier')
            .mockReturnValueOnce('first-id')
            .mockReturnValueOnce('second-id');

        const first = createDefaultPlexAuthConfig();
        first.product = 'Mutated';
        const second = createDefaultPlexAuthConfig();

        expect(resolver).toHaveBeenCalledTimes(2);
        expect(second).toEqual({
            clientIdentifier: 'second-id',
            product: 'Lineup',
            version: '1.0.0',
            platform: 'webOS',
            platformVersion: '6.0',
            device: 'LG Smart TV',
            deviceName: 'Living Room TV',
        });
    });
});
