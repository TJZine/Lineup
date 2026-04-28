import { getAppErrorCode } from '../../../types/app-errors';
import { summarizeErrorForLog } from '../../../utils/errors';

export type ChannelSetupErrorSummaryObject = { message?: unknown; code?: unknown };

export function getChannelSetupErrorSummaryObject(error: unknown): ChannelSetupErrorSummaryObject {
    const summary = summarizeErrorForLog(error);
    if (typeof summary === 'object' && summary !== null) {
        return summary as ChannelSetupErrorSummaryObject;
    }
    if (typeof summary === 'string') {
        return getAppErrorCode(summary) !== null
            ? { message: summary, code: summary }
            : { message: summary };
    }
    return summary == null ? {} : { message: String(summary) };
}

export function getChannelSetupFailureDetail(summaryObject: ChannelSetupErrorSummaryObject): string {
    return typeof summaryObject.message === 'string'
        ? summaryObject.message
        : summaryObject.code !== undefined
            ? String(summaryObject.code)
            : 'unknown error';
}
