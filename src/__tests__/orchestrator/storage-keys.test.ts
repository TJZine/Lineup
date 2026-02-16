import { AppOrchestrator } from '../../Orchestrator';
import { PLEX_DISCOVERY_CONSTANTS } from '../../modules/plex/discovery/constants';

type PlexAuthLike = {
    getActiveUserId: () => string | null;
    getAccountUserId: () => string | null;
};

type OrchestratorWithPlexAuth = {
    _plexAuth: PlexAuthLike | null;
};

describe('AppOrchestrator storage key characterization', () => {
    const setAuth = (
        orchestrator: AppOrchestrator,
        activeUserId: string | null,
        accountUserId: string | null
    ): void => {
        const orchestratorWithAuth = orchestrator as unknown as OrchestratorWithPlexAuth;
        orchestratorWithAuth._plexAuth = {
            getActiveUserId: (): string | null => activeUserId,
            getAccountUserId: (): string | null => accountUserId,
        };
    };

    it('namespaces selected server and health keys by active user when present', () => {
        const orchestrator = new AppOrchestrator();
        setAuth(orchestrator, 'user-1', 'account-1');

        expect(orchestrator.getSelectedServerStorageKey())
            .toBe(`${PLEX_DISCOVERY_CONSTANTS.SELECTED_SERVER_KEY}:user-1`);
        expect(orchestrator.getServerHealthStorageKey())
            .toBe(`${PLEX_DISCOVERY_CONSTANTS.SERVER_HEALTH_KEY}:user-1`);
    });

    it('falls back to account user id when active user id is unavailable', () => {
        const orchestrator = new AppOrchestrator();
        setAuth(orchestrator, null, 'account-1');

        expect(orchestrator.getSelectedServerStorageKey())
            .toBe(`${PLEX_DISCOVERY_CONSTANTS.SELECTED_SERVER_KEY}:account-1`);
    });

    it('falls back to base keys when both active/account ids are unavailable', () => {
        const orchestrator = new AppOrchestrator();
        setAuth(orchestrator, null, null);

        expect(orchestrator.getSelectedServerStorageKey())
            .toBe(PLEX_DISCOVERY_CONSTANTS.SELECTED_SERVER_KEY);
        expect(orchestrator.getServerHealthStorageKey())
            .toBe(PLEX_DISCOVERY_CONSTANTS.SERVER_HEALTH_KEY);
    });
});
