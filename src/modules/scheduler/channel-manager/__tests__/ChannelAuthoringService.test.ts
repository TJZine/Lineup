import { fnv1a32Uint } from '../../../../utils/hash';
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

    it('normalizes runtime update fields through the authoring rules before returning a channel', () => {
        const service = createService();
        const channel = createBaseChannel({
            id: 'authoring-channel',
            playbackMode: 'sequential',
            shuffleSeed: 10,
            phaseSeed: 20,
        });

        const updated = service.updateChannel(
            channel,
            {
                playbackMode: 'block',
                blockSize: 0,
                lineupReplicaIndex: -2,
                shuffleSeed: Number.NaN,
                phaseSeed: Number.NaN,
            },
            []
        );

        expect(updated.playbackMode).toBe('block');
        expect(updated.blockSize).toBe(1);
        expect(updated.lineupReplicaIndex).toBe(0);
        expect(updated.shuffleSeed).toBe(fnv1a32Uint('authoring-channel:shuffle'));
        expect(updated.phaseSeed).toBe(fnv1a32Uint('authoring-channel:phase'));
        expect(updated.id).toBe(channel.id);
        expect(updated.createdAt).toBe(channel.createdAt);
        expect(updated.updatedAt).toBe(123);
        expect(updated.lastContentRefresh).toBe(channel.lastContentRefresh);
        expect(updated.itemCount).toBe(channel.itemCount);
        expect(updated.totalDurationMs).toBe(channel.totalDurationMs);
    });

    it.each([
        ['shuffleSeed', Number.NEGATIVE_INFINITY, fnv1a32Uint('authoring-channel:shuffle')],
        ['phaseSeed', Number.NEGATIVE_INFINITY, fnv1a32Uint('authoring-channel:phase')],
    ] as const)(
        'replaces invalid %s values with deterministic defaults during updates',
        (field, rawValue, expectedSeed) => {
            const service = createService();
            const channel = createBaseChannel({
                id: 'authoring-channel',
                playbackMode: 'sequential',
                shuffleSeed: 10,
                phaseSeed: 20,
            });

            const updated = service.updateChannel(channel, { [field]: rawValue } as ChannelUpdateInput, []);

            expect(updated[field]).toBe(expectedSeed);
        }
    );

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
