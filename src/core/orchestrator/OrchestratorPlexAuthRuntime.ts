import type {
    IPlexAuth,
    PlexPinRequest,
} from '../../modules/plex/auth';

export interface OrchestratorPlexAuthRuntimeDeps {
    assertNotShutdown(method: string): void;
    getPlexAuth(): IPlexAuth | null;
    throwModuleInitPreconditionError(
        message: string,
        context: Record<string, unknown>
    ): never;
}

export class OrchestratorPlexAuthRuntime {
    constructor(private readonly _deps: OrchestratorPlexAuthRuntimeDeps) {}

    async requestAuthPin(): Promise<PlexPinRequest> {
        return this._withPlexAuth('requestAuthPin').requestPin();
    }

    async pollForPin(pinId: number): Promise<PlexPinRequest> {
        return this._withPlexAuth('pollForPin').pollForPin(pinId);
    }

    async cancelPin(pinId: number): Promise<void> {
        await this._withPlexAuth('cancelPin').cancelPin(pinId);
    }

    private _withPlexAuth(method: 'requestAuthPin' | 'pollForPin' | 'cancelPin'): IPlexAuth {
        this._deps.assertNotShutdown(method);
        const plexAuth = this._deps.getPlexAuth();
        if (!plexAuth) {
            this._deps.throwModuleInitPreconditionError('PlexAuth not initialized', {
                method,
                dependency: 'PlexAuth',
            });
        }
        return plexAuth;
    }
}
