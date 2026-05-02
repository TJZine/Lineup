import { summarizeErrorForLog } from '../../../utils/errors';
import { STORAGE_CONFIG } from '../../lifecycle/constants';
import { AppErrorCode } from '../../../types/app-errors';
import { ChannelPersistenceSaveQueue } from './ChannelPersistenceSaveQueue';
import { ChannelRepository } from './ChannelRepository';
import { CURRENT_CHANNEL_KEY, STORAGE_KEY } from './constants';
import { ChannelError } from './ChannelErrors';
import type { ChannelConfig, ChannelManagerEventMap, StoredChannelData } from './types';

type ChannelPersistenceCoordinatorLogger = {
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
};

type ChannelPersistenceCoordinatorConfig = {
    storageKey?: string | undefined;
    currentChannelKey?: string | undefined;
    logger: ChannelPersistenceCoordinatorLogger;
    emitPersistenceWarning: (payload: ChannelManagerEventMap['persistenceWarning']) => void;
};

type PersistableChannelState = {
    channels: Iterable<ChannelConfig>;
    channelOrder: string[];
    currentChannelId: string | null;
};

export type LoadedChannelManagerState = {
    data: StoredChannelData;
    didMutate: boolean;
} | null;

export class ChannelPersistenceCoordinator {
    private readonly _repository: ChannelRepository;
    private readonly _saveQueue: ChannelPersistenceSaveQueue;
    private readonly _logger: ChannelPersistenceCoordinatorLogger;

    constructor(config: ChannelPersistenceCoordinatorConfig) {
        this._logger = config.logger;
        const initialStorageKey = normalizeStorageKey(config.storageKey, STORAGE_KEY);
        const initialCurrentChannelKey = normalizeStorageKey(
            config.currentChannelKey,
            initialStorageKey === STORAGE_KEY
                ? CURRENT_CHANNEL_KEY
                : `${CURRENT_CHANNEL_KEY}:${initialStorageKey}`
        );

        this._repository = new ChannelRepository(
            initialStorageKey,
            initialCurrentChannelKey,
            this._logger
        );
        this._saveQueue = new ChannelPersistenceSaveQueue({
            runSave: (): void => {
                throw new Error('ChannelPersistenceCoordinator.runSave requires a state snapshot');
            },
            createDisposedError,
            emitPersistenceWarning: config.emitPersistenceWarning,
            logger: this._logger,
        });
    }

    setStorageKeys(storageKey: string, currentChannelKey: string): void {
        this._repository.setStorageKeys(
            normalizeStorageKey(storageKey, STORAGE_KEY),
            normalizeStorageKey(currentChannelKey, CURRENT_CHANNEL_KEY)
        );
    }

    loadNormalized(): LoadedChannelManagerState {
        return this._repository.loadNormalized();
    }

    queueSave(state: PersistableChannelState): void {
        this._saveQueue.queueWithSnapshot(() => this._persistState(state));
    }

    save(state: PersistableChannelState): Promise<void> {
        return this._saveQueue.saveWithSnapshot(() => this._persistState(state));
    }

    flush(state: PersistableChannelState): void {
        this._saveQueue.flushWithSnapshot(() => this._persistState(state));
    }

    persistStoredChannelData(data: StoredChannelData): void {
        this._persistStoredChannelData(data);
    }

    persistCurrentChannelId(channelId: string): void {
        try {
            this._persistCurrentChannelId(channelId);
            this._saveQueue.markSuccess();
        } catch (error) {
            this._logger.warn('Failed to persist current channel', summarizeErrorForLog(error));
            this._saveQueue.emitWarning(error);
        }
    }

    persistCurrentChannelIdBestEffort(channelId: string): void {
        try {
            this._persistCurrentChannelId(channelId);
        } catch (error) {
            this._logger.warn('Failed to persist current channel', summarizeErrorForLog(error));
            this._saveQueue.emitWarning(error);
        }
    }

    reportFailure(message: string, error: unknown): void {
        this._saveQueue.reportFailure(message, error);
    }

    markSuccess(): void {
        this._saveQueue.markSuccess();
    }

    dispose(): void {
        this._saveQueue.dispose();
    }

    private _persistState(state: PersistableChannelState): void {
        this._persistStoredChannelData({
            channels: Array.from(state.channels),
            channelOrder: state.channelOrder,
            currentChannelId: state.currentChannelId,
            savedAt: Date.now(),
        });
    }

    private _persistStoredChannelData(data: StoredChannelData): void {
        const writeResult = this._repository.saveStoredChannelData(data);

        if (!writeResult.ok && writeResult.reason === 'quota-exceeded') {
            throw new ChannelError(
                AppErrorCode.STORAGE_QUOTA_EXCEEDED,
                STORAGE_CONFIG.STORAGE_QUOTA_EXCEEDED,
                true
            );
        }
        if (!writeResult.ok && writeResult.reason === 'unavailable') {
            throw new ChannelError(
                AppErrorCode.PERSISTENCE_FALLBACK,
                'Failed to persist channels to storage',
                true
            );
        }
    }

    private _persistCurrentChannelId(channelId: string): void {
        const result = this._repository.saveCurrentChannelId(channelId);
        if (!result.ok) {
            if (result.reason === 'quota-exceeded') {
                throw new ChannelError(
                    AppErrorCode.STORAGE_QUOTA_EXCEEDED,
                    STORAGE_CONFIG.STORAGE_QUOTA_EXCEEDED,
                    true
                );
            }
            throw new ChannelError(
                AppErrorCode.PERSISTENCE_FALLBACK,
                'Failed to persist current channel',
                true
            );
        }
    }
}

export function normalizeStorageKey(value: string | undefined, fallback: string): string {
    if (value === undefined) return fallback;
    const normalized = value.trim();
    if (normalized.length === 0) {
        throw new ChannelError(AppErrorCode.STORAGE_VALIDATION_FAILED, 'Storage keys must be non-empty strings', false);
    }
    return normalized;
}

function createDisposedError(): ChannelError {
    return new ChannelError(AppErrorCode.CHANNEL_MANAGER_DISPOSED, 'ChannelManager disposed', false);
}
