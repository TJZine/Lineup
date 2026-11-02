import type { ChannelDirectoryPorts, ChannelStudioRequest } from '../../../modules/ui/channels/ChannelDirectoryPorts';
import type { ChannelStudioPorts } from '../../channel-studio/ChannelStudioContracts';
import { ProductionAirCheck } from '../../channel-air-check/ProductionAirCheck';
import { AirCheckPanel } from '../../../modules/ui/channel-air-check/AirCheckPanel';
import type { AppShellOrchestratorRuntime } from '../runtime/AppShellRuntimeContracts';

export interface AppAuthoringRouteActions {
    openStudio(request: ChannelStudioRequest): void;
    openGenerate(): void;
    goBack(): void;
    closeStudio(focusChannelId: string | null): void;
    openGuide(): void;
}

/** Screen ports expose actual scoped runtime capabilities; all persistence remains in ChannelManager. */
export class AppAuthoringPortFactory {
    constructor(
        private readonly getRuntime: () => AppShellOrchestratorRuntime | null,
        private readonly actions: AppAuthoringRouteActions
    ) {}

    createDirectoryPorts(): ChannelDirectoryPorts | null {
        const runtime = this.getRuntime();
        const manager = runtime?.getChannelAuthoringManager();
        const navigation = runtime?.getNavigation();
        if (!runtime || !manager || !navigation) return null;
        return {
            manager, navigation,
            openStudio: request => this.actions.openStudio(request),
            openGenerate: () => this.actions.openGenerate(),
            goBack: () => this.actions.goBack(),
            getActiveMediaIdentity: () => runtime.getActiveMediaIdentity(),
            getDirectoryScopeKey: () => runtime.getDirectoryScopeKey(),
            stopDeletedMediaIfCurrent: identity => runtime.stopDeletedMediaIfCurrent(identity),
            refreshAfterCommit: () => runtime.refreshChannelDirectoryAfterCommit(),
            openGuideAfterActiveDelete: () => this.actions.openGuide(),
            now: () => Date.now(),
        };
    }

    createStudioPorts(): ChannelStudioPorts | null {
        const runtime = this.getRuntime();
        const manager = runtime?.getChannelAuthoringManager();
        const library = runtime?.getChannelAuthoringLibrary();
        const navigation = runtime?.getNavigation();
        if (!runtime || !manager || !library || !navigation) return null;
        const provider = new ProductionAirCheck({
            library,
            getStructuralBase: (): ReturnType<typeof manager.getStructuralBase> => manager.getStructuralBase(),
            now: (): number => Date.now(),
        });
        const panel = new AirCheckPanel(provider, {
            getImageUrl: (path, width, height): string | null => runtime.getChannelAuthoringImageUrl(path, width, height),
        });
        return {
            manager, plexLibrary: library, navigation, airCheck: panel,
            close: focusChannelId => this.actions.closeStudio(focusChannelId),
            refreshAfterSave: effect => runtime.refreshAfterSave(effect),
            tuneNow: async (channelId): Promise<void> => {
                const outcome = await runtime.switchToChannelWithOutcome(channelId);
                if (outcome.kind !== 'switched') throw new Error('Could not tune this channel. Try again.');
            },
            now: () => Date.now(),
        };
    }
}
