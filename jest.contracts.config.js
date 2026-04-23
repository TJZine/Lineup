import sharedConfig from './jest.shared.config.js';

/** @type {import('ts-jest').JestConfigWithTsJest} */
const config = {
    ...sharedConfig,
    testMatch: [
        '**/*.contract.test.ts',
        '**/*.contracts.test.ts',
        '**/*-contract.test.ts',
        '**/*-contracts.test.ts',
        '**/*.policy.test.ts',
        '**/*-policy.test.ts',
        '**/types.test.ts',
    ],
};

export default config;
