import type { ChannelSetupPlanDiagnosticsResult } from '../channel-setup/planning/ChannelSetupPlanDiagnostics';
import type { ChannelSetupConfig, ChannelSetupRecord } from '../channel-setup/types';
import { DebugOverridesStore } from '../../modules/debug/DebugOverridesStore';
import { DeveloperSettingsStore } from '../../modules/settings/DeveloperSettingsStore';
import type { ToastInput } from '../../shared/toast';
import type { AppShellDiagnosticsRuntimePort } from './AppShellRuntimeContracts';
import { summarizeChannelSetupPlannerDiagnostics } from './AppDiagnosticsChannelSetupSummary';
import {
    AppDiagnosticsDevMenuController,
    type AppDiagnosticsAudioSettingsStore,
} from './AppDiagnosticsDevMenuController';

type DiagnosticsWindow = Window & {
    lineup?: {
        toggleDevMenu: () => void;
        dumpChannelSetupPlannerDiagnostics: (
            configOverride?: ChannelSetupConfig
        ) => Promise<ChannelSetupPlannerDiagnosticsDump>;
        dumpActiveChannelSetupPlannerDiagnostics: () => Promise<ChannelSetupPlannerDiagnosticsDump>;
    };
};

interface ChannelSetupPlannerDiagnosticsDump {
    selectedServerId: string;
    recordSource: 'saved-record' | 'override' | 'active-screen';
    config: ChannelSetupConfig;
    savedRecord: ChannelSetupRecord | null;
    result: ChannelSetupPlanDiagnosticsResult;
}

export interface AppDiagnosticsSurfaceOptions {
    getDiagnosticsRuntime: () => AppShellDiagnosticsRuntimePort | null;
    getActiveChannelSetupConfig?: () => ChannelSetupConfig | null;
    showToast: (input: ToastInput) => void;
    debugOverridesStore: DebugOverridesStore;
    audioSettingsStore?: AppDiagnosticsAudioSettingsStore;
}

export class AppDiagnosticsSurface {
    private readonly _getDiagnosticsRuntime: () => AppShellDiagnosticsRuntimePort | null;
    private readonly _getActiveChannelSetupConfig: () => ChannelSetupConfig | null;
    private readonly _developerSettingsStore = new DeveloperSettingsStore();
    private readonly _devMenuController: AppDiagnosticsDevMenuController;
    private _container: HTMLElement | null = null;
    private _globalKeydownHandler: ((event: KeyboardEvent) => void) | null = null;

    constructor(options: AppDiagnosticsSurfaceOptions) {
        this._getDiagnosticsRuntime = options.getDiagnosticsRuntime;
        this._getActiveChannelSetupConfig = options.getActiveChannelSetupConfig ?? (() : ChannelSetupConfig | null => null);
        const devMenuOptions = {
            getDiagnosticsRuntime: options.getDiagnosticsRuntime,
            showToast: options.showToast,
            debugOverridesStore: options.debugOverridesStore,
            ...(options.audioSettingsStore ? { audioSettingsStore: options.audioSettingsStore } : {}),
        };
        this._devMenuController = new AppDiagnosticsDevMenuController(devMenuOptions);
    }

    setContainer(container: HTMLElement | null): void {
        this._container = container;
    }

    initialize(): void {
        if (this._globalKeydownHandler) {
            document.removeEventListener('keydown', this._globalKeydownHandler);
        }
        this._globalKeydownHandler = (event: KeyboardEvent): void => {
            if (this._isDebugSurfaceEnabled() && event.code === 'KeyI') {
                this._getDiagnosticsRuntime()?.toggleServerSelect();
            }
            if (this._isDebugSurfaceEnabled() && event.code === 'KeyD' && event.ctrlKey && event.shiftKey) {
                this._toggleDevMenu();
            }
        };
        document.addEventListener('keydown', this._globalKeydownHandler);

        if (this._isDebugSurfaceEnabled()) {
            (window as DiagnosticsWindow).lineup = {
                toggleDevMenu: (): void => this._toggleDevMenu(),
                dumpChannelSetupPlannerDiagnostics: async (
                    configOverride?: ChannelSetupConfig
                ): Promise<ChannelSetupPlannerDiagnosticsDump> => this._dumpChannelSetupPlannerDiagnostics(configOverride),
                dumpActiveChannelSetupPlannerDiagnostics: async (): Promise<ChannelSetupPlannerDiagnosticsDump> =>
                    this._dumpActiveChannelSetupPlannerDiagnostics(),
            };
        }
        if (!this._isDebugSurfaceEnabled()) {
            try {
                delete (window as DiagnosticsWindow).lineup;
            } catch {
                // ignore
            }
        }
    }

    dispose(): void {
        if (this._globalKeydownHandler) {
            document.removeEventListener('keydown', this._globalKeydownHandler);
        }
        this._globalKeydownHandler = null;
        try {
            delete (window as DiagnosticsWindow).lineup;
        } catch {
            // ignore
        }
        this._container = null;
    }

    private async _dumpChannelSetupPlannerDiagnostics(
        configOverride?: ChannelSetupConfig
    ): Promise<ChannelSetupPlannerDiagnosticsDump> {
        const runtime = this._getDiagnosticsRuntime();
        if (!runtime) {
            throw new Error('Diagnostics runtime is unavailable');
        }
        const workflowPort = runtime.getChannelSetupWorkflowPort();
        const selectedServerId = runtime.getSelectedServerId();
        if (!selectedServerId) {
            throw new Error('No Plex server is currently selected');
        }

        const savedRecord = workflowPort.getChannelSetupRecord(selectedServerId);
        const config = configOverride ?? savedRecord;
        if (!config) {
            throw new Error(
                'No saved channel setup record exists for the selected server. Complete setup once or pass a config override.'
            );
        }

        const result = await workflowPort.getSetupPlanDiagnostics(config);
        const dump: ChannelSetupPlannerDiagnosticsDump = {
            selectedServerId,
            recordSource: configOverride ? 'override' : 'saved-record',
            config,
            savedRecord,
            result,
        };

        this._logChannelSetupPlannerDiagnostics(dump);
        return dump;
    }

    private async _dumpActiveChannelSetupPlannerDiagnostics(): Promise<ChannelSetupPlannerDiagnosticsDump> {
        const runtime = this._getDiagnosticsRuntime();
        if (!runtime) {
            throw new Error('Diagnostics runtime is unavailable');
        }
        const selectedServerId = runtime.getSelectedServerId();
        if (!selectedServerId) {
            throw new Error('No Plex server is currently selected');
        }

        const config = this._getActiveChannelSetupConfig();
        if (!config) {
            throw new Error(
                'No active channel setup draft is available. Open Channel Setup and return to Step 2 before dumping diagnostics.'
            );
        }

        const workflowPort = runtime.getChannelSetupWorkflowPort();
        const savedRecord = workflowPort.getChannelSetupRecord(selectedServerId);
        const result = await workflowPort.getSetupPlanDiagnostics(config);
        const dump: ChannelSetupPlannerDiagnosticsDump = {
            selectedServerId,
            recordSource: 'active-screen',
            config,
            savedRecord,
            result,
        };

        this._logChannelSetupPlannerDiagnostics(dump);
        return dump;
    }

    /* eslint-disable no-console */
    private _logChannelSetupPlannerDiagnostics(dump: ChannelSetupPlannerDiagnosticsDump): void {
        const summary = summarizeChannelSetupPlannerDiagnostics(dump.result);

        console.groupCollapsed('[lineup] Channel setup planner diagnostics');
        console.info('Selected server:', dump.selectedServerId);
        console.info('Record source:', dump.recordSource);
        console.info('Planner summary:', summary.overview);
        if (summary.familySummaries.length > 0) {
            console.info('Planner facet families:', summary.familySummaries);
        }
        if (summary.warnings.length > 0) {
            console.info('Planner warnings:', summary.warnings);
        }
        if (summary.notes.length > 0) {
            console.info('Planner notes:', summary.notes);
        }
        console.groupEnd();
    }
    /* eslint-enable no-console */

    private _isDebugSurfaceEnabled(): boolean {
        if (__LINEUP_DEV_BUILD__) {
            return true;
        }
        return this._developerSettingsStore.readDebugLoggingEnabledAndClean(false);
    }

    private _toggleDevMenu(): void {
        if (!this._isDebugSurfaceEnabled()) return;
        if (!this._container) return;

        if (this._container.style.display === 'none') {
            this._renderDevMenu();
            this._container.style.display = 'block';
        } else {
            this._container.style.display = 'none';
        }
    }

    private _renderDevMenu(): void {
        if (!this._container) return;
        this._devMenuController.render(this._container);
    }
}
