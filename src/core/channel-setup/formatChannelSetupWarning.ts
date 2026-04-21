import { summarizeErrorForLog } from '../../utils/errors';

export function formatChannelSetupWarning(message: string, ...details: unknown[]): string {
    if (details.length === 0) {
        return message;
    }

    const suffix = details
        .map(formatChannelSetupWarningDetail)
        .join('; ');

    return `${message}: ${suffix}`;
}

function formatChannelSetupWarningDetail(detail: unknown): string {
    const summary = summarizeErrorForLog(detail);
    if (typeof summary === 'string') {
        return summary;
    }
    if (summary && typeof summary === 'object') {
        if ('message' in summary && typeof summary.message === 'string') {
            return summary.message;
        }
        return JSON.stringify(summary);
    }
    return String(summary);
}
