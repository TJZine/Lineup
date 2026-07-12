import sharedConfig from './jest.shared.config.js';

/** @type {import('ts-jest').JestConfigWithTsJest} */
const config = {
    ...sharedConfig,
    testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/__tests__/tools/',
        '[.-](contracts?|policy)\\.test\\.ts$',
        '/types\\.test\\.ts$',
    ],
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.test.ts',
        '!src/**/__tests__/**',
        '!src/**/*.d.ts',
        '!src/**/interfaces.ts',
        '!src/core/channel-setup/types.ts',
        '!src/core/error-recovery/types.ts',
        '!src/modules/player/types.ts',
        '!src/modules/plex/auth/types.ts',
        '!src/modules/plex/discovery/types.ts',
        '!src/modules/plex/library/types.ts',
        '!src/modules/plex/shared/types.ts',
        '!src/modules/scheduler/channel-manager/types.ts',
        '!src/modules/scheduler/scheduler/types.ts',
        '!src/modules/ui/channel-number-overlay/types.ts',
        '!src/modules/ui/playback-options/types.ts',
        '!src/modules/ui/channel-badge/types.ts',
        '!src/modules/ui/player-osd/types.ts',
        '!src/modules/ui/epg/types.ts',
        '!src/modules/ui/mini-guide/types.ts',
        '!src/modules/ui/channel-transition/types.ts',
        '!src/modules/ui/channel-setup/steps/types.ts',
        '!src/modules/ui/server-select/types.ts',
        '!src/modules/ui/channel-setup/focus/types.ts',
        '!src/modules/ui/settings/types.ts',
        '!src/modules/ui/now-playing-info/types.ts',
        '!src/utils/interfaces.ts',
    ],
    coverageThreshold: {
        global: {
            statements: 88,
            branches: 76,
            functions: 88,
            lines: 89,
        },
    },
    coverageDirectory: 'coverage',
    coverageReporters: ['text-summary', 'lcov'],
};

export default config;
