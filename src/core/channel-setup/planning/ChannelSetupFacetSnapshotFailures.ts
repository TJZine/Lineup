import { AppErrorCode, getAppErrorCode } from '../../../types/app-errors';
import { summarizeErrorForLog } from '../../../utils/errors';
import type { ChannelSetupPreviewFailureReason } from '../types';
import type {
    ChannelSetupFacetSnapshot,
    ChannelSetupFacetSnapshotData,
} from './ChannelSetupPlanningTypes';
import type { PlexTagDirectoryUnsupportedReason } from '../../../modules/plex/library';

export type ChannelSetupRequiredTagDirectoryLabel = 'Genres' | 'Directors' | 'Years' | 'Actors' | 'Studios';

type SnapshotFailureBuilderOptions = {
    addWarning: (message: string) => void;
    incrementErrors: () => void;
    snapshotData: (hasTransientLoadFailure: boolean) => ChannelSetupFacetSnapshotData;
};

export class ChannelSetupFacetSnapshotFailureBuilder {
    constructor(private readonly options: SnapshotFailureBuilderOptions) { }

    buildFailureSnapshot(
        status: 'blocked' | 'slow',
        message: string,
        failureReason: ChannelSetupPreviewFailureReason,
        hasTransientLoadFailure = false
    ): ChannelSetupFacetSnapshot {
        this.options.addWarning(message);
        this.options.incrementErrors();
        return {
            status,
            message,
            failureReason,
            ...this.options.snapshotData(hasTransientLoadFailure),
        };
    }

    buildRequiredTagDirectoryFailure(
        label: ChannelSetupRequiredTagDirectoryLabel,
        libraryTitle: string,
        type: number,
        reason: PlexTagDirectoryUnsupportedReason | 'error',
        error?: unknown
    ): ChannelSetupFacetSnapshot {
        const baseLabel = label.toLowerCase();
        if (reason === 'error') {
            const summaryObject = getErrorSummaryObject(error);
            const detail = getFailureDetail(summaryObject);
            if (getAppErrorCode(summaryObject.code) === AppErrorCode.NETWORK_TIMEOUT) {
                return this.buildFailureSnapshot(
                    'slow',
                    `Required ${baseLabel} tag directory (type=${type}) timed out for ${libraryTitle}; try again after Plex responds.`,
                    'timeout',
                    true
                );
            }
            return this.buildFailureSnapshot(
                'blocked',
                `Required ${baseLabel} tag directory (type=${type}) failed for ${libraryTitle} (${detail}); stop and re-plan.`,
                'error'
            );
        }
        const detail = reason === 'empty' ? 'returned no entries' : 'is unsupported';
        return this.buildFailureSnapshot(
            'blocked',
            `Required ${baseLabel} tag directory (type=${type}) ${detail} for ${libraryTitle}; stop and re-plan.`,
            reason === 'empty' ? 'empty' : 'unsupported'
        );
    }

    buildRequiredTagCountRecoveryFailure(
        label: ChannelSetupRequiredTagDirectoryLabel,
        libraryTitle: string,
        type: number,
        error: unknown
    ): ChannelSetupFacetSnapshot {
        const baseLabel = label.toLowerCase();
        const summaryObject = getErrorSummaryObject(error);
        const detail = getFailureDetail(summaryObject);
        if (getAppErrorCode(summaryObject.code) === AppErrorCode.NETWORK_TIMEOUT) {
            return this.buildFailureSnapshot(
                'slow',
                `Required ${baseLabel} item counts (type=${type}) timed out for ${libraryTitle}; try again after Plex responds.`,
                'timeout',
                true
            );
        }
        return this.buildFailureSnapshot(
            'blocked',
            `Required ${baseLabel} item counts (type=${type}) failed for ${libraryTitle} (${detail}); stop and re-plan.`,
            'error'
        );
    }
}

function getFailureDetail(summaryObject: { message?: unknown; code?: unknown }): string {
    return typeof summaryObject.message === 'string'
        ? summaryObject.message
        : summaryObject.code !== undefined
            ? String(summaryObject.code)
            : 'unknown error';
}

function getErrorSummaryObject(error: unknown): { message?: unknown; code?: unknown } {
    const summary = summarizeErrorForLog(error);
    return typeof summary === 'object' && summary !== null
        ? summary as { message?: unknown; code?: unknown }
        : {};
}
