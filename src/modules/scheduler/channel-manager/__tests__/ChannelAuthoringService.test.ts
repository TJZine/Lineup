import { AppErrorCode } from '../../../lifecycle/types';
import { ChannelAuthoringService } from '../ChannelAuthoringService';
import { CHANNEL_ERROR_MESSAGES } from '../constants';
import type { ChannelCreateInput, ChannelUpdateInput } from '../types';
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
});
