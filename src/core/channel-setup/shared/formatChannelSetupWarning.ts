import { formatErrorDetailForMessage } from '../../../utils/errors';

export function formatChannelSetupWarning(message: string, ...details: unknown[]): string {
    if (details.length === 0) {
        return message;
    }

    const suffix = details
        .map(formatErrorDetailForMessage)
        .join('; ');

    return `${message}: ${suffix}`;
}
