export interface ServerSwapCoordinatorDeps {
    runStartupPhase3(): Promise<void>;
    clearSelectedChannelScheduleSnapshot(): void;
    clearScheduleCaches(): void;
    clearSchedules(): void;
    primeEpgChannels(): void;
    refreshEpgSchedules(): Promise<void>;
}

export class ServerSwapCoordinator {
    constructor(private readonly _deps: ServerSwapCoordinatorDeps) {}

    async runAfterServerSelection(): Promise<void> {
        await this._deps.runStartupPhase3();
        this._deps.clearSelectedChannelScheduleSnapshot();
        this._deps.clearScheduleCaches();
        this._deps.clearSchedules();
        this._deps.primeEpgChannels();
        await this._deps.refreshEpgSchedules();
    }
}
