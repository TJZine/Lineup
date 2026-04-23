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
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov'],
};

export default config;
