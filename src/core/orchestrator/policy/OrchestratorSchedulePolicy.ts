import type {
    ChannelConfig,
    ResolvedChannelContent,
} from '../../../modules/scheduler/channel-manager';
import type { ScheduleConfig } from '../../../modules/scheduler/scheduler';
import { createMulberry32 } from '../../../modules/scheduler/shared/prng';
import { fnv1a32Uint } from '../../../utils/hash';

export class OrchestratorSchedulePolicy {
    getLocalMidnightMs(timeMs: number): number {
        const date = new Date(timeMs);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
    }

    getLocalDayKey(timeMs: number): number {
        const date = new Date(timeMs);
        return (date.getFullYear() * 10000) + ((date.getMonth() + 1) * 100) + date.getDate();
    }

    buildDailyScheduleConfig(
        channel: ChannelConfig,
        items: ResolvedChannelContent['items'],
        referenceTimeMs: number
    ): ScheduleConfig {
        const dayStart = this.getLocalMidnightMs(referenceTimeMs);
        const dayKey = this.getLocalDayKey(dayStart);
        const phaseOffsetMs = this._getPhaseOffsetMs(channel, items);

        const isRandomPlayback = channel.playbackMode === 'random';
        const playbackMode: ScheduleConfig['playbackMode'] =
            isRandomPlayback ? 'shuffle' : (channel.playbackMode as ScheduleConfig['playbackMode']);
        const baseSeed = this._computeSchedulerBaseSeed(channel, dayStart);
        const isShuffleLike = playbackMode === 'shuffle' || playbackMode === 'block';
        const effectiveSeed = isShuffleLike ? (baseSeed ^ dayKey) >>> 0 : baseSeed;

        const scheduleConfig: ScheduleConfig = {
            channelId: channel.id,
            anchorTime: dayStart - phaseOffsetMs,
            content: items,
            playbackMode,
            shuffleSeed: effectiveSeed,
        };

        if (typeof channel.blockSize === 'number' && Number.isFinite(channel.blockSize)) {
            scheduleConfig.blockSize = channel.blockSize;
        }

        return scheduleConfig;
    }

    private _calculateLoopDurationMs(items: ResolvedChannelContent['items']): number {
        let total = 0;
        for (const item of items) {
            total += item.durationMs;
        }
        return total;
    }

    private _getPhaseOffsetMs(channel: ChannelConfig, items: ResolvedChannelContent['items']): number {
        const loopDurationMs = this._calculateLoopDurationMs(items);
        if (!Number.isFinite(loopDurationMs) || loopDurationMs <= 0) {
            return 0;
        }
        const seed =
            typeof channel.phaseSeed === 'number' && Number.isFinite(channel.phaseSeed)
                ? channel.phaseSeed
                : 0;
        if (seed === 0) {
            return 0;
        }
        const random = createMulberry32(seed);
        return Math.floor(random() * loopDurationMs);
    }

    private _computeSchedulerBaseSeed(channel: ChannelConfig, dayStart: number): number {
        const configuredShuffleSeed =
            typeof channel.shuffleSeed === 'number' && Number.isFinite(channel.shuffleSeed)
                ? channel.shuffleSeed
                : fnv1a32Uint(`${channel.id}:shuffle`);

        if (channel.playbackMode === 'random') {
            return (configuredShuffleSeed ^ dayStart) >>> 0;
        }

        return configuredShuffleSeed;
    }
}
