describe('buildDiscoveryFetchVariants', () => {
    afterEach(() => {
        jest.resetModules();
        jest.dontMock('../../shared/plexUrl');
    });

    it('does not add query-token variants when trusted token injection declines the URL', () => {
        jest.isolateModules(() => {
            jest.doMock('../../shared/plexUrl', () => {
                const actual = jest.requireActual('../../shared/plexUrl') as typeof import('../../shared/plexUrl');
                return {
                    ...actual,
                    PLEX_CLOUD_TRUSTED_ORIGINS: ['https://clients.plex.tv'],
                };
            });

            const { buildDiscoveryFetchVariants } =
                require('../PlexDiscoveryFetchVariants') as typeof import('../PlexDiscoveryFetchVariants');

            const variants = buildDiscoveryFetchVariants({ 'X-Plex-Token': 'token-1' });

            expect(variants).toHaveLength(2);
            expect(variants.filter((variant) => variant.url.includes('X-Plex-Token'))).toHaveLength(1);
            expect(
                variants.some((variant) =>
                    variant.url.startsWith('https://plex.tv/') && variant.url.includes('X-Plex-Token')
                )
            ).toBe(false);
        });
    });
});
