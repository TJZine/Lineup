const restrictedAppModuleRoots = ['plex', 'player', 'scheduler'];

/**
 * First-pass architecture boundary contract for Lineup.
 *
 * This contract is tool-agnostic by design. Consumers (ESLint today, other
 * validators later) should map these sections into enforcement rules.
 */
export const lineupArchitectureRules = {
    version: '2026-04-14-first-pass',
    compositionRoots: {
        files: ['src/App.ts', 'src/Orchestrator.ts'],
        appRestrictedImportPatterns: restrictedAppModuleRoots.flatMap((moduleRoot) => [
            `./modules/${moduleRoot}`,
            `./modules/${moduleRoot}/**`,
            `@modules/${moduleRoot}`,
            `@modules/${moduleRoot}/**`,
            `src/modules/${moduleRoot}`,
            `src/modules/${moduleRoot}/**`,
        ]),
    },
    storageOwnership: {
        restrictedGlobals: ['localStorage', 'sessionStorage'],
        allowedFiles: [
            'src/utils/storage.ts',
            'src/modules/lifecycle/StateManager.ts',
            'src/modules/plex/auth/PlexAuth.ts',
            'src/modules/scheduler/channel-manager/ChannelPersistenceStore.ts',
        ],
    },
    runtimeUiBoundary: {
        nonUiRuntimeModuleGlobs: [
            'src/modules/plex/**/*.ts',
            'src/modules/player/**/*.ts',
            'src/modules/scheduler/**/*.ts',
            'src/modules/navigation/**/*.ts',
            'src/modules/lifecycle/**/*.ts',
        ],
        forbiddenUiImportPatterns: [
            '@modules/ui/**',
            'src/modules/ui/**',
            '../ui/**',
            '../../ui/**',
            '../../../ui/**',
        ],
    },
    compositionRootAccessBoundary: {
        restrictedImportRegexAlternatives: [
            'App(?:\\\\.ts)?',
            'Orchestrator(?:\\\\.ts)?',
            'src\\\\/App(?:\\\\.ts)?',
            'src\\\\/Orchestrator(?:\\\\.ts)?',
            '(?:\\\\.{1,2}\\\\/)+(?:.*\\\\/)?App(?:\\\\.ts)?',
            '(?:\\\\.{1,2}\\\\/)+(?:.*\\\\/)?Orchestrator(?:\\\\.ts)?',
        ],
        allowedImporters: ['src/bootstrap.ts'],
    },
    temporaryExceptions: [
        {
            rule: 'composition-root-access-boundary',
            from: 'src/core/app-shell/AppOrchestratorConfigFactory.ts',
            to: '../../Orchestrator',
            reason: 'Config factory currently depends on root orchestrator type export surface.',
            cleanupPriority: 'P3',
        },
        {
            rule: 'composition-root-access-boundary',
            from: 'src/core/app-shell/AppShellRuntimeContracts.ts',
            to: '../../Orchestrator',
            reason: 'App-shell runtime contracts still reference orchestrator snapshot type from root export.',
            cleanupPriority: 'P3',
        },
    ],
};
