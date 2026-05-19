import { ChannelImportNormalizer } from './ChannelImportNormalizer';
import { clonePersistableChannel } from './ChannelDomainClone';
import type { ChannelConfig, ChannelCreateInput, ImportResult } from './types';

type ChannelImportExportServiceConfig = {
    getAllChannels: () => ChannelConfig[];
    isChannelNumberInUse: (number: number) => boolean;
    getNextAvailableNumber: () => number;
    createChannel: (input: ChannelCreateInput) => Promise<ChannelConfig>;
};

export class ChannelImportExportService {
    private readonly _normalizer = new ChannelImportNormalizer();
    private readonly _getAllChannels: () => ChannelConfig[];
    private readonly _isChannelNumberInUse: (number: number) => boolean;
    private readonly _getNextAvailableNumber: () => number;
    private readonly _createChannel: (input: ChannelCreateInput) => Promise<ChannelConfig>;

    constructor(config: ChannelImportExportServiceConfig) {
        this._getAllChannels = config.getAllChannels;
        this._isChannelNumberInUse = config.isChannelNumberInUse;
        this._getNextAvailableNumber = config.getNextAvailableNumber;
        this._createChannel = config.createChannel;
    }

    exportChannels(): string {
        return JSON.stringify(this._getAllChannels().map(clonePersistableChannel), null, 2);
    }

    async importChannels(data: string): Promise<ImportResult> {
        const result: ImportResult = {
            success: false,
            importedCount: 0,
            skippedCount: 0,
            errors: [],
        };

        const normalized = this._normalizer.normalizePayload(data);
        if (!normalized.ok) {
            result.errors.push(normalized.error);
            return result;
        }
        result.skippedCount += normalized.skippedCount;

        for (const channelData of normalized.channels) {
            try {
                if (
                    typeof channelData.number === 'number' &&
                    this._isChannelNumberInUse(channelData.number)
                ) {
                    channelData.number = this._getNextAvailableNumber();
                }

                await this._createChannel(channelData);
                result.importedCount++;
            } catch (error) {
                result.skippedCount++;
                result.errors.push(`Failed to import channel: ${this._normalizer.formatErrorMessage(error)}`);
            }
        }

        result.success = result.importedCount > 0;
        return result;
    }
}
