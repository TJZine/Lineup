import { AppErrorCode } from '../../../../types/app-errors';
import { ChannelAuthoringService } from '../authoring/ChannelAuthoringService';
import { CHANNEL_ERROR_MESSAGES, MAX_CHANNEL_NUMBER, MIN_CHANNEL_NUMBER } from '../constants';
import type { ChannelCreateInput, ChannelUpdateInput } from '../contracts/types';
import {
    createBaseChannel,
    createMockContentSource,
} from './channel-manager-test-helpers';

describe('ChannelAuthoringService', () => {
    const createService = (): ChannelAuthoringService =>
        new ChannelAuthoringService({
            generateId: () => 'channel-1',
            now: () => 123,
        });

    it('rejects invalid runtime content sources before creating a channel', () => {
        const service = createService();
        const input = {
            contentSource: { type: 'library', libraryId: 'lib1' },
        } as unknown as ChannelCreateInput;

        expect(() => service.createChannel(input, [])).toThrow(
            expect.objectContaining({
                name: 'ChannelError',
                code: AppErrorCode.CHANNEL_CONTENT_SOURCE_INVALID,
                message: CHANNEL_ERROR_MESSAGES.CONTENT_SOURCE_INVALID,
            })
        );
    });

    it('rejects invalid runtime content source updates before cloning them', () => {
        const service = createService();
        const channel = createBaseChannel({
            contentSource: createMockContentSource(),
        });
        const updates = {
            contentSource: { type: 'manual' },
        } as unknown as ChannelUpdateInput;

        expect(() => service.updateChannel(channel, updates, [])).toThrow(
            expect.objectContaining({
                name: 'ChannelError',
                code: AppErrorCode.CHANNEL_CONTENT_SOURCE_INVALID,
                message: CHANNEL_ERROR_MESSAGES.CONTENT_SOURCE_INVALID,
            })
        );
    });

    it('rejects invalid authored values instead of repairing them', () => {
        const service = createService();
        const channel = createBaseChannel({ id: 'authoring-channel' });
        for (const update of [
            { blockSize: 0 }, { lineupReplicaIndex: -2 },
            { shuffleSeed: Number.NaN }, { phaseSeed: Number.NEGATIVE_INFINITY },
            { includeSpecials: 'false' as never },
        ]) {
            expect(() => service.updateChannel(channel, update, [])).toThrow(
                expect.objectContaining({ code: AppErrorCode.STORAGE_VALIDATION_FAILED })
            );
        }
    });

    it('clears optional authored fields and keeps undefined updates unchanged', () => {
        const service = createService();
        const channel = createBaseChannel({
            sortOrder: 'title_asc',
            minEpisodeRunTimeMs: 10_000,
            maxEpisodeRunTimeMs: 90_000,
        });

        const undefinedUpdates: unknown = {
            sortOrder: undefined,
            minEpisodeRunTimeMs: undefined,
            maxEpisodeRunTimeMs: undefined,
        };
        const retained = service.updateChannel(channel, undefinedUpdates as ChannelUpdateInput, []);
        expect(retained.sortOrder).toBe('title_asc');
        expect(retained.minEpisodeRunTimeMs).toBe(10_000);
        expect(retained.maxEpisodeRunTimeMs).toBe(90_000);

        const updated = service.updateChannel(channel, {
            sortOrder: 'year_desc',
            minEpisodeRunTimeMs: 20_000,
            maxEpisodeRunTimeMs: 80_000,
        }, []);
        expect(updated).toMatchObject({
            sortOrder: 'year_desc',
            minEpisodeRunTimeMs: 20_000,
            maxEpisodeRunTimeMs: 80_000,
        });

        const emptyClear = service.updateChannel(channel, { clearFields: [] }, []);
        expect(emptyClear).toMatchObject({
            sortOrder: 'title_asc',
            minEpisodeRunTimeMs: 10_000,
            maxEpisodeRunTimeMs: 90_000,
            updatedAt: 123,
        });
        expect(Object.prototype.hasOwnProperty.call(emptyClear, 'clearFields')).toBe(false);

        const clearedUpdates: unknown = {
            sortOrder: undefined,
            clearFields: ['sortOrder', 'minEpisodeRunTimeMs', 'maxEpisodeRunTimeMs'],
        };
        const cleared = service.updateChannel(channel, clearedUpdates as ChannelUpdateInput, []);
        for (const field of ['sortOrder', 'minEpisodeRunTimeMs', 'maxEpisodeRunTimeMs'] as const) {
            expect(Object.prototype.hasOwnProperty.call(cleared, field)).toBe(false);
        }
        expect(Object.prototype.hasOwnProperty.call(cleared, 'clearFields')).toBe(false);
    });

    it('rejects malformed clear commands and command metadata outside updates', () => {
        const service = createService();
        const channel = createBaseChannel({
            sortOrder: 'title_asc',
            minEpisodeRunTimeMs: 10_000,
            maxEpisodeRunTimeMs: 90_000,
        });
        const malformedUpdates: unknown[] = [
            { clearFields: 'sortOrder' },
            { clearFields: ['sortOrder', null] },
            { clearFields: ['unknownField'] },
            { clearFields: ['name'] },
            { clearFields: ['sortOrder', 'sortOrder'] },
            { sortOrder: 'year_desc', clearFields: ['sortOrder'] },
        ];

        for (const updates of malformedUpdates) {
            expect(() => service.updateChannel(channel, updates as ChannelUpdateInput, [])).toThrow(
                expect.objectContaining({ code: AppErrorCode.STORAGE_VALIDATION_FAILED })
            );
        }
        const createWithCommand = {
            contentSource: createMockContentSource(),
            clearFields: ['sortOrder'],
        };
        expect(() => service.createChannel(createWithCommand, [])).toThrow(
            expect.objectContaining({ code: AppErrorCode.STORAGE_VALIDATION_FAILED })
        );
        const replacementWithCommand = {
            ...channel,
            clearFields: ['sortOrder'],
        };
        expect(() => service.buildReplacementState([replacementWithCommand])).toThrow(
            expect.objectContaining({ code: AppErrorCode.STORAGE_VALIDATION_FAILED })
        );
    });

    it('retains a valid authored specials choice through replacement cloning', () => {
        const service = createService();
        const created = service.createChannel({ contentSource: createMockContentSource(),
            playbackMode: 'block', includeSpecials: false }, []);
        expect(created.includeSpecials).toBe(false);
        expect(service.buildReplacementState([created]).channels.get(created.id)?.includeSpecials).toBe(false);
    });

    it('requires an explicit finite timestamp to activate fixed scheduling and retains it through replacement', () => {
        const service = createService();
        const source = createMockContentSource();
        const legacy = service.createChannel({ contentSource: source, startTimeAnchor: 500 }, []);
        expect(legacy.scheduleAnchorMode).toBeUndefined();
        expect(() => service.createChannel({ contentSource: source, scheduleAnchorMode: 'fixed' }, []))
            .toThrow(expect.objectContaining({ code: AppErrorCode.STORAGE_VALIDATION_FAILED }));
        expect(() => service.updateChannel(legacy, { scheduleAnchorMode: 'fixed' }, [legacy]))
            .toThrow(expect.objectContaining({ code: AppErrorCode.STORAGE_VALIDATION_FAILED }));
        for (const invalid of ['automatic', null, 1]) {
            expect(() => service.createChannel({ contentSource: source,
                startTimeAnchor: 500, scheduleAnchorMode: invalid as never }, []))
                .toThrow(expect.objectContaining({ code: AppErrorCode.STORAGE_VALIDATION_FAILED }));
            expect(() => service.buildReplacementState([{ ...legacy, scheduleAnchorMode: invalid as never }]))
                .toThrow(expect.objectContaining({ code: AppErrorCode.STORAGE_VALIDATION_FAILED }));
        }
        const fixed = service.updateChannel(legacy, { scheduleAnchorMode: 'fixed', startTimeAnchor: 750 }, [legacy]);
        expect(service.buildReplacementState([fixed]).channels.get(fixed.id)).toMatchObject({
            scheduleAnchorMode: 'fixed', startTimeAnchor: 750,
        });
    });

    it('throws a typed error when no valid channel numbers remain', () => {
        const service = createService();
        const channels = Array.from(
            { length: MAX_CHANNEL_NUMBER - MIN_CHANNEL_NUMBER + 1 },
            (_value, index) => createBaseChannel({
                id: `channel-${index + MIN_CHANNEL_NUMBER}`,
                number: index + MIN_CHANNEL_NUMBER,
            })
        );

        expect(() => service.getNextAvailableNumber(channels)).toThrow(
            expect.objectContaining({
                name: 'ChannelError',
                code: AppErrorCode.MAX_CHANNELS_REACHED,
                message: CHANNEL_ERROR_MESSAGES.MAX_CHANNELS_REACHED,
                recoverable: false,
            })
        );
    });
});
