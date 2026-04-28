export interface ChannelNumberOverlayConfig {
    containerId: string;
    /**
     * Delay (ms) before auto-hiding the overlay once channel input is complete.
     * Kept in config so UX can be tuned without changing navigation/orchestrator logic.
     */
    completeHideDelayMs?: number;
}
