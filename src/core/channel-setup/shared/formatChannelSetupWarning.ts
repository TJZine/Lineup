import { formatChannelSetupWarningDetail } from '../../../modules/scheduler/channel-manager/ChannelImportNormalizer';

export function formatChannelSetupWarning(message: string, ...details: unknown[]): string {
    if (details.length === 0) {
        return message;
    }

    const suffix = details
        .map(formatChannelSetupWarningDetail)
        .join('; ');

    return `${message}: ${suffix}`;
}
