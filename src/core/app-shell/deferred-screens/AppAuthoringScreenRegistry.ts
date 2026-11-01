import type { ChannelDirectoryPorts, ChannelStudioRequest } from '../../../modules/ui/channels/ChannelDirectoryPorts';
import type { ChannelStudioPorts } from '../../channel-studio/ChannelStudioContracts';
import type { ChannelDirectoryScreen } from '../../../modules/ui/channels/ChannelDirectoryScreen';
import type { ChannelStudioScreen } from '../../../modules/ui/channel-studio/ChannelStudioScreen';

interface AuthoringLoaders {
    directory(): Promise<typeof import('../../../modules/ui/channels/ChannelDirectoryScreen')>;
    studio(): Promise<typeof import('../../../modules/ui/channel-studio/ChannelStudioScreen')>;
}

export interface AppAuthoringScreenRegistryOptions {
    directoryContainer: HTMLElement;
    studioContainer: HTMLElement;
    createDirectoryPorts(): ChannelDirectoryPorts | null;
    createStudioPorts(): ChannelStudioPorts | null;
    getScopeKey(): string;
    onLoadError(error: unknown): void;
    loaders?: Partial<AuthoringLoaders>;
}

/** Owns one instance per authoring screen and fences late lazy loads by route generation. */
export class AppAuthoringScreenRegistry {
    private readonly loaders: AuthoringLoaders;
    private directory: ChannelDirectoryScreen | null = null;
    private studio: ChannelStudioScreen | null = null;
    private directoryLoad: Promise<ChannelDirectoryScreen | null> | null = null;
    private studioLoad: Promise<ChannelStudioScreen | null> | null = null;
    private generation = 0;
    private scopeKey: string | null = null;
    private scopeVersion = 0;
    private destroyed = false;

    constructor(private readonly options: AppAuthoringScreenRegistryOptions) {
        this.loaders = {
            directory: (): ReturnType<AuthoringLoaders['directory']> =>
                import('../../../modules/ui/channels/ChannelDirectoryScreen'),
            studio: (): ReturnType<AuthoringLoaders['studio']> =>
                import('../../../modules/ui/channel-studio/ChannelStudioScreen'),
            ...options.loaders,
        };
    }

    showDirectory(preferredChannelId?: string): void {
        this.ensureScope();
        const generation = ++this.generation;
        this.studio?.hide();
        void this.ensureDirectory().then(screen => {
            if (this.destroyed || generation !== this.generation || !screen) return;
            screen.show(preferredChannelId);
        }).catch(error => this.reportCurrentError(error, generation));
    }

    showStudio(request: ChannelStudioRequest): void {
        this.ensureScope();
        const generation = ++this.generation;
        this.directory?.hide();
        void this.ensureStudio().then(screen => {
            if (this.destroyed || generation !== this.generation || !screen) return;
            screen.show(request);
        }).catch(error => this.reportCurrentError(error, generation));
    }

    hide(): void {
        ++this.generation;
        this.directory?.hide();
        this.studio?.hide();
    }

    destroy(): void {
        if (this.destroyed) return;
        this.hide();
        this.destroyed = true;
        this.directory?.destroy();
        this.studio?.destroy();
        this.directory = null;
        this.studio = null;
    }

    private ensureScope(): void {
        const current = this.options.getScopeKey();
        if (this.scopeKey === current) return;
        this.scopeKey = current;
        ++this.scopeVersion;
        this.directory?.destroy();
        this.studio?.destroy();
        this.directory = null;
        this.studio = null;
        this.directoryLoad = null;
        this.studioLoad = null;
    }

    private async ensureDirectory(): Promise<ChannelDirectoryScreen | null> {
        if (this.destroyed) return null;
        if (this.directory) return this.directory;
        if (!this.directoryLoad) {
            const scopeVersion = this.scopeVersion;
            const load = this.loaders.directory().then(({ ChannelDirectoryScreen }) => {
                if (this.destroyed || scopeVersion !== this.scopeVersion) return null;
                const ports = this.options.createDirectoryPorts();
                if (!ports) throw new Error('Channel directory runtime is unavailable.');
                this.directory = new ChannelDirectoryScreen(this.options.directoryContainer, ports);
                return this.directory;
            }).finally(() => { if (this.directoryLoad === load) this.directoryLoad = null; });
            this.directoryLoad = load;
        }
        return this.directoryLoad;
    }

    private async ensureStudio(): Promise<ChannelStudioScreen | null> {
        if (this.destroyed) return null;
        if (this.studio) return this.studio;
        if (!this.studioLoad) {
            const scopeVersion = this.scopeVersion;
            const load = this.loaders.studio().then(({ ChannelStudioScreen }) => {
                if (this.destroyed || scopeVersion !== this.scopeVersion) return null;
                const ports = this.options.createStudioPorts();
                if (!ports) throw new Error('Channel Studio runtime is unavailable.');
                this.studio = new ChannelStudioScreen(this.options.studioContainer, ports);
                return this.studio;
            }).finally(() => { if (this.studioLoad === load) this.studioLoad = null; });
            this.studioLoad = load;
        }
        return this.studioLoad;
    }

    private reportCurrentError(error: unknown, generation: number): void {
        if (!this.destroyed && generation === this.generation) this.options.onLoadError(error);
    }
}
