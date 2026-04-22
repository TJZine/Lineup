import sharedConfig from './jest.shared.config.js';

/** @type {import('ts-jest').JestConfigWithTsJest} */
const config = {
    ...sharedConfig,
    testMatch: ['**/__tests__/tools/**/*.test.ts'],
};

export default config;
