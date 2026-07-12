const initialResolutionBrand: unique symbol = Symbol('ChannelInitialResolutionAuthorization');

export type ChannelInitialResolutionAuthorization = Readonly<{
    [initialResolutionBrand]: true;
}>;

export function createChannelInitialResolutionAuthorization(): ChannelInitialResolutionAuthorization {
    return Object.freeze({ [initialResolutionBrand]: true as const });
}
