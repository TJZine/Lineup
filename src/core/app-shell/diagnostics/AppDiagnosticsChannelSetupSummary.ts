import type { ChannelSetupPlanDiagnosticsResult } from '../../channel-setup/planning/ChannelSetupPlanDiagnostics';
import type {
    ChannelSetupPlannerCountSample,
    ChannelSetupPlannerFacetCountDiagnostics,
    ChannelSetupPlannerLibraryCount,
} from '../../channel-setup/planning/ChannelSetupPlanningTypes';
import type { ChannelSetupPeopleBreadthDiagnostic } from '../../channel-setup/planning/ChannelSetupPeopleSeriesIndex';
import {
    CHANNEL_SETUP_NATIVE_FACET_FAMILIES,
    type ChannelSetupPlannerFacetFamily,
} from '../../channel-setup/planning/ChannelSetupFacetFamilies';

const WARNING_SAMPLE_LIMIT = 3;
const FACET_SAMPLE_LIMIT = 3;

export interface AppDiagnosticsChannelSetupFamilySummary {
    family: ChannelSetupPlannerFacetFamily;
    fetchedLibraryCount: number;
    diagnosticLibraryCount: number;
    fetchedTagCount: number;
    rawTagCount: number;
    effectiveCandidateCount: number;
    candidatesWithUnknownCount: number;
    candidatesBelowMinItems: number;
    knownCountRange: string | null;
    sampleKnownCounts: string[];
    sampleUnknownCountTitles: string[];
    sampleBelowMinItems: string[];
}

export interface AppDiagnosticsChannelSetupPeopleBreadthSummary {
    family: ChannelSetupPeopleBreadthDiagnostic['family'];
    libraryId: string;
    libraryName: string;
    countBasis: ChannelSetupPeopleBreadthDiagnostic['countBasis'];
    rawTagCount: number;
    episodeIndexedPeopleCount: number;
    episodeCountQualified: number;
    distinctSeriesQualified: number;
    rejectedBelowDistinctSeries: number;
    missingEpisodeIndexCount: number;
    sampleQualified: string[];
    sampleRejectedBelowDistinctSeries: string[];
}

export interface AppDiagnosticsChannelSetupSummary {
    overview: {
        status: ChannelSetupPlanDiagnosticsResult['status'];
        reachedMaxChannels: boolean;
        warningCount: number;
        effectiveMaxChannels: number | null;
        minItems: number | null;
        candidatesBeforeMinItems: number | null;
        candidatesAfterMinItems: number | null;
        afterMaxChannels: number | null;
        lostToMaxChannels: number | null;
    };
    warnings: string[];
    notes: string[];
    familySummaries: AppDiagnosticsChannelSetupFamilySummary[];
    peopleBreadthSummaries: AppDiagnosticsChannelSetupPeopleBreadthSummary[];
}

export function summarizeChannelSetupPlannerDiagnostics(
    result: ChannelSetupPlanDiagnosticsResult
): AppDiagnosticsChannelSetupSummary {
    const diagnostics = result.diagnostics;
    const notes = [
        typeof result.message === 'string' ? result.message : null,
        typeof result.failureReason === 'string' ? result.failureReason : null,
    ].filter((value): value is string => Boolean(value));

    if (!diagnostics) {
        return {
            overview: {
                status: result.status,
                reachedMaxChannels: result.reachedMaxChannels,
                warningCount: result.warnings.length,
                effectiveMaxChannels: null,
                minItems: null,
                candidatesBeforeMinItems: null,
                candidatesAfterMinItems: null,
                afterMaxChannels: null,
                lostToMaxChannels: null,
            },
            warnings: capStrings(result.warnings, WARNING_SAMPLE_LIMIT, 'warning'),
            notes,
            familySummaries: [],
            peopleBreadthSummaries: [],
        };
    }

    const familySummaries = CHANNEL_SETUP_NATIVE_FACET_FAMILIES
        .map((family) => summarizeFamily(
            family,
            diagnostics.fetchedTagsByFamily[family],
            diagnostics.tagCountDiagnosticsByFamily[family]
        ))
        .filter((summary): summary is AppDiagnosticsChannelSetupFamilySummary => summary !== null)
        .sort((left, right) => {
            if (right.effectiveCandidateCount !== left.effectiveCandidateCount) {
                return right.effectiveCandidateCount - left.effectiveCandidateCount;
            }
            if (right.fetchedTagCount !== left.fetchedTagCount) {
                return right.fetchedTagCount - left.fetchedTagCount;
            }
            return left.family.localeCompare(right.family);
        });

    return {
        overview: {
            status: result.status,
            reachedMaxChannels: result.reachedMaxChannels,
            warningCount: result.warnings.length,
            effectiveMaxChannels: diagnostics.effectiveMaxChannels,
            minItems: diagnostics.minItems,
            candidatesBeforeMinItems: diagnostics.candidatesBeforeMinItems.total,
            candidatesAfterMinItems: diagnostics.candidatesAfterMinItems.total,
            afterMaxChannels: diagnostics.afterMaxChannels.total,
            lostToMaxChannels: diagnostics.lostToMaxChannels.total,
        },
        warnings: capStrings(result.warnings, WARNING_SAMPLE_LIMIT, 'warning'),
        notes,
        familySummaries,
        peopleBreadthSummaries: (diagnostics.peopleBreadthDiagnostics ?? [])
            .filter((entry) => entry.rawTagCount > 0 || entry.episodeIndexedPeopleCount > 0)
            .map(summarizePeopleBreadth)
            .sort((left, right) => {
                const rejectedDiff = right.rejectedBelowDistinctSeries - left.rejectedBelowDistinctSeries;
                if (rejectedDiff !== 0) {
                    return rejectedDiff;
                }
                const familyDiff = left.family.localeCompare(right.family);
                if (familyDiff !== 0) {
                    return familyDiff;
                }
                return left.libraryName.localeCompare(right.libraryName);
            }),
    };
}

function summarizePeopleBreadth(
    diagnostic: ChannelSetupPeopleBreadthDiagnostic
): AppDiagnosticsChannelSetupPeopleBreadthSummary {
    return {
        family: diagnostic.family,
        libraryId: diagnostic.libraryId,
        libraryName: diagnostic.libraryName,
        countBasis: diagnostic.countBasis,
        rawTagCount: diagnostic.rawTagCount,
        episodeIndexedPeopleCount: diagnostic.episodeIndexedPeopleCount,
        episodeCountQualified: diagnostic.episodeCountQualified,
        distinctSeriesQualified: diagnostic.distinctSeriesQualified,
        rejectedBelowDistinctSeries: diagnostic.rejectedBelowDistinctSeries,
        missingEpisodeIndexCount: diagnostic.missingEpisodeIndexCount,
        sampleQualified: capStrings(
            diagnostic.sampleQualified.map(formatPeopleSample),
            FACET_SAMPLE_LIMIT,
            'qualified person'
        ),
        sampleRejectedBelowDistinctSeries: capStrings(
            diagnostic.sampleRejectedBelowDistinctSeries.map(formatPeopleSample),
            FACET_SAMPLE_LIMIT,
            'below-breadth person'
        ),
    };
}

function summarizeFamily(
    family: ChannelSetupPlannerFacetFamily,
    fetchedTags: ChannelSetupPlannerLibraryCount[],
    diagnostics: ChannelSetupPlannerFacetCountDiagnostics[]
): AppDiagnosticsChannelSetupFamilySummary | null {
    if (fetchedTags.length === 0 && diagnostics.length === 0) {
        return null;
    }

    const mins = diagnostics
        .map((entry) => entry.minKnownCount)
        .filter((value): value is number => value !== null);
    const maxes = diagnostics
        .map((entry) => entry.maxKnownCount)
        .filter((value): value is number => value !== null);

    return {
        family,
        fetchedLibraryCount: fetchedTags.length,
        diagnosticLibraryCount: diagnostics.length,
        fetchedTagCount: sumCounts(fetchedTags.map((entry) => entry.count)),
        rawTagCount: sumCounts(diagnostics.map((entry) => entry.rawTagCount)),
        effectiveCandidateCount: sumCounts(diagnostics.map((entry) => entry.effectiveCandidateCount)),
        candidatesWithUnknownCount: sumCounts(diagnostics.map((entry) => entry.candidatesWithUnknownCount)),
        candidatesBelowMinItems: sumCounts(diagnostics.map((entry) => entry.candidatesBelowMinItems)),
        knownCountRange: mins.length > 0 && maxes.length > 0
            ? `${Math.min(...mins)}-${Math.max(...maxes)}`
            : null,
        sampleKnownCounts: capStrings(
            sortCountSamples(diagnostics.flatMap((entry) => entry.sampleKnownCounts))
                .map(formatCountSample),
            FACET_SAMPLE_LIMIT,
            'known-count sample'
        ),
        sampleUnknownCountTitles: capStrings(
            [...new Set(diagnostics.flatMap((entry) => entry.sampleUnknownCountTitles))].sort((left, right) => left.localeCompare(right)),
            FACET_SAMPLE_LIMIT,
            'unknown-count title'
        ),
        sampleBelowMinItems: capStrings(
            sortCountSamples(diagnostics.flatMap((entry) => entry.sampleBelowMinItems))
                .map(formatCountSample),
            FACET_SAMPLE_LIMIT,
            'below-min sample'
        ),
    };
}

function sortCountSamples(samples: ChannelSetupPlannerCountSample[]): ChannelSetupPlannerCountSample[] {
    return [...samples].sort((left, right) => {
        const countDiff = right.count - left.count;
        if (countDiff !== 0) {
            return countDiff;
        }
        return left.title.localeCompare(right.title);
    });
}

function formatCountSample(sample: ChannelSetupPlannerCountSample): string {
    return `${sample.title} (${sample.count})`;
}

function formatPeopleSample(sample: { title: string; episodeCount: number; distinctSeriesCount: number }): string {
    return `${sample.title} (${sample.episodeCount} episodes, ${sample.distinctSeriesCount} series)`;
}

function capStrings(values: string[], limit: number, label: string): string[] {
    if (values.length <= limit) {
        return values;
    }

    const remaining = values.length - limit;
    return [
        ...values.slice(0, limit),
        `+${remaining} more ${label}${remaining === 1 ? '' : 's'}`,
    ];
}

function sumCounts(values: number[]): number {
    return values.reduce((total, value) => total + value, 0);
}
