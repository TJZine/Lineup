import type { SetupStrategyKey } from '../types';

type ChannelSetupNativeFacetStateKey =
    | 'genresByLibraryId'
    | 'directorsByLibraryId'
    | 'yearsByLibraryId'
    | 'actorsByLibraryId'
    | 'studiosByLibraryId';

type ChannelSetupNativeFacetMediaTypeSource = 'genre' | 'detail';
type ChannelSetupNativeFacetDirectoryMethod = 'getGenres' | 'getDirectors' | 'getYears' | 'getActors' | 'getStudios';

export const CHANNEL_SETUP_NATIVE_FACET_FAMILY_DESCRIPTORS = [
    {
        family: 'genres',
        label: 'Genres',
        strategyKey: 'genres',
        countRecoveryFamily: 'genre',
        stateKey: 'genresByLibraryId',
        mediaTypeSource: 'genre',
        directoryMethod: 'getGenres',
        supportsFastKeyFilter: false,
    },
    {
        family: 'directors',
        label: 'Directors',
        strategyKey: 'directors',
        countRecoveryFamily: 'director',
        stateKey: 'directorsByLibraryId',
        mediaTypeSource: 'detail',
        directoryMethod: 'getDirectors',
        supportsFastKeyFilter: false,
    },
    {
        family: 'decades',
        label: 'Years',
        strategyKey: 'decades',
        countRecoveryFamily: 'year',
        stateKey: 'yearsByLibraryId',
        mediaTypeSource: 'detail',
        directoryMethod: 'getYears',
        supportsFastKeyFilter: false,
    },
    {
        family: 'studios',
        label: 'Studios',
        strategyKey: 'studios',
        countRecoveryFamily: 'studio',
        stateKey: 'studiosByLibraryId',
        mediaTypeSource: 'detail',
        directoryMethod: 'getStudios',
        supportsFastKeyFilter: true,
    },
    {
        family: 'actors',
        label: 'Actors',
        strategyKey: 'actors',
        countRecoveryFamily: 'actor',
        stateKey: 'actorsByLibraryId',
        mediaTypeSource: 'detail',
        directoryMethod: 'getActors',
        supportsFastKeyFilter: true,
    },
] as const satisfies readonly {
    family: SetupStrategyKey;
    label: string;
    strategyKey: SetupStrategyKey;
    countRecoveryFamily: string;
    stateKey: ChannelSetupNativeFacetStateKey;
    mediaTypeSource: ChannelSetupNativeFacetMediaTypeSource;
    directoryMethod: ChannelSetupNativeFacetDirectoryMethod;
    supportsFastKeyFilter: boolean;
}[];

export type ChannelSetupNativeFacetFamilyDescriptor = typeof CHANNEL_SETUP_NATIVE_FACET_FAMILY_DESCRIPTORS[number];
export type ChannelSetupNativeFacetFamily = ChannelSetupNativeFacetFamilyDescriptor['family'];
export type ChannelSetupPlannerFacetFamily = ChannelSetupNativeFacetFamily;
export type ChannelSetupRequiredTagDirectoryLabel = ChannelSetupNativeFacetFamilyDescriptor['label'];
export type ChannelSetupFacetCountRecoveryFamily = ChannelSetupNativeFacetFamilyDescriptor['countRecoveryFamily'];
export type ChannelSetupTagFilterType = Extract<
    ChannelSetupNativeFacetFamilyDescriptor,
    { supportsFastKeyFilter: true }
>['countRecoveryFamily'];

export const CHANNEL_SETUP_NATIVE_FACET_FAMILIES = CHANNEL_SETUP_NATIVE_FACET_FAMILY_DESCRIPTORS.map(
    (descriptor) => descriptor.family
) as readonly ChannelSetupNativeFacetFamily[];

export const createChannelSetupFacetFamilyRecord = <T>(
    createValue: (descriptor: ChannelSetupNativeFacetFamilyDescriptor) => T
): Record<ChannelSetupNativeFacetFamily, T> => {
    const record = {} as Record<ChannelSetupNativeFacetFamily, T>;
    for (const descriptor of CHANNEL_SETUP_NATIVE_FACET_FAMILY_DESCRIPTORS) {
        record[descriptor.family] = createValue(descriptor);
    }
    return record;
};
