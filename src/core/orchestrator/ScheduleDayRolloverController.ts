import type {
    ChannelConfig,
    IChannelManager,
    ResolvedChannelContent,
} from '../../modules/scheduler/channel-manager';
import type { IChannelScheduler, ScheduleConfig } from '../../modules/scheduler/scheduler';
import type { EPGCoordinator } from '../../modules/ui/epg/EPGCoordinator';

export interface ScheduleDayRolloverControllerDeps {
    now: () => number;
    getChannelManager: () => IChannelManager | null;
    getScheduler: () => IChannelScheduler | null;
    getEpgCoordinator: () => EPGCoordinator | null;
    getLocalMidnightMs: (timeMs: number) => number;
    getLocalDayKey: (timeMs: number) => number;
    buildDailyScheduleConfig: (
        channel: ChannelConfig,
        items: ResolvedChannelContent['items'],
        referenceTimeMs: number
    ) => ScheduleConfig;
    reportError: (message: string, error: unknown) => void;
}

export class ScheduleDayRolloverController {
    private _activeScheduleDayKey: number | null = null;
    private _pendingDayRolloverDayKey: number | null = null;
    private _pendingDayRolloverTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(private readonly _deps: ScheduleDayRolloverControllerDeps) {}

    public setActiveScheduleDayKey(dayKey: number): void {
        this._activeScheduleDayKey = dayKey;
    }

    public async handleScheduleDayRollover(): Promise<void> {
        const channelManager = this._deps.getChannelManager();
        const scheduler = this._deps.getScheduler();
        if (!channelManager || !scheduler) {
            return;
        }

        const now = this._deps.now();
        const dayKey = this._deps.getLocalDayKey(now);
        if (this._activeScheduleDayKey === null) {
            this._activeScheduleDayKey = dayKey;
            return;
        }
        if (dayKey === this._activeScheduleDayKey) {
            return;
        }

        if (this._pendingDayRolloverDayKey === dayKey) {
            return;
        }

        const dayStart = this._deps.getLocalMidnightMs(now);
        const currentProgram = scheduler.getCurrentProgram();
        const spansMidnight =
            currentProgram !== null &&
            currentProgram.scheduledStartTime < dayStart &&
            currentProgram.scheduledEndTime > dayStart;

        if (spansMidnight) {
            this._pendingDayRolloverDayKey = dayKey;
            this.cancelPendingDayRollover();
            const delayMs = Math.max(0, currentProgram.scheduledEndTime - now + 50);
            this._pendingDayRolloverTimer = globalThis.setTimeout(() => {
                this._pendingDayRolloverTimer = null;
                this._applyScheduleDayRollover().catch((error) => {
                    this._deps.reportError('[Orchestrator] Failed to apply day rollover:', error);
                });
            }, delayMs);
            return;
        }

        this._pendingDayRolloverDayKey = dayKey;
        await this._applyScheduleDayRollover();
    }

    public cancelPendingDayRollover(): void {
        if (this._pendingDayRolloverTimer !== null) {
            globalThis.clearTimeout(this._pendingDayRolloverTimer);
            this._pendingDayRolloverTimer = null;
        }
        this._pendingDayRolloverDayKey = null;
    }

    public dispose(): void {
        this.cancelPendingDayRollover();
    }

    private async _applyScheduleDayRollover(): Promise<void> {
        const channelManager = this._deps.getChannelManager();
        const scheduler = this._deps.getScheduler();
        if (!channelManager || !scheduler) {
            return;
        }

        const now = this._deps.now();
        const dayKey = this._deps.getLocalDayKey(now);
        if (this._activeScheduleDayKey === dayKey) {
            this._pendingDayRolloverDayKey = null;
            return;
        }

        const current = channelManager.getCurrentChannel();
        if (!current) {
            this._activeScheduleDayKey = dayKey;
            this._pendingDayRolloverDayKey = null;
            return;
        }

        const content = await channelManager.resolveChannelContent(current.id);
        scheduler.loadChannel(this._deps.buildDailyScheduleConfig(current, content.items, now));
        scheduler.syncToCurrentTime();

        const epgCoordinator = this._deps.getEpgCoordinator();
        epgCoordinator?.clearSelectedChannelScheduleSnapshot();
        await epgCoordinator?.refreshEpgSchedules();
        this._activeScheduleDayKey = dayKey;
        this._pendingDayRolloverDayKey = null;
    }
}
