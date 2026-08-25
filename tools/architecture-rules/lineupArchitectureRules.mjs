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
            'src/modules/plex/auth/PlexAuth.ts',
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
    appShellRuntimeBoundary: {
        runtimeModuleGlobs: ['src/core/app-shell/runtime/**'],
        forbiddenImportPatterns: [
            {
                regex: '(?:^|/)(?:Orchestrator|AppOrchestrator)(?:\\.ts)?$',
                message: 'App-shell runtime modules must not import the orchestrator root or concrete implementation.',
            },
            {
                regex: '(?:^|/)ServerSelectionTypes(?:\\.ts)?$',
                message: 'App-shell runtime modules must not import the core server-selection result owner.',
            },
            {
                regex: '(?:^|/)OrchestratorStorageContext(?:\\.ts)?$',
                message: 'App-shell runtime modules must not import orchestrator-owned storage context.',
            },
            {
                regex: '.*',
                importNames: [
                    'OrchestratorServerSelectionResult',
                    'getSelectedServerStorageKey',
                    'getServerHealthStorageKey',
                ],
                message: 'App-shell runtime modules must consume narrowed app-shell seams, not orchestrator or storage implementation symbols.',
            },
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
    temporaryExceptions: [],
};
