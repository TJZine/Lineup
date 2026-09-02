/** @type {import('ts-jest').JestConfigWithTsJest} */
const sharedConfig = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    setupFilesAfterEnv: ['<rootDir>/src/__tests__/jest.setup.ts'],
    roots: ['<rootDir>/src'],
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            useESM: true,
        }],
    },
    moduleNameMapper: {
        '^.+\\.css$': '<rootDir>/src/__tests__/mocks/style.ts',
        '^@types/(.*)$': '<rootDir>/src/types/$1',
        '^@modules/(.*)$': '<rootDir>/src/modules/$1',
        '^@utils/(.*)$': '<rootDir>/src/utils/$1',
        '^@core/(.*)$': '<rootDir>/src/core/$1',
        '^@config/(.*)$': '<rootDir>/src/config/$1',
    },
    extensionsToTreatAsEsm: ['.ts'],
    reporters: ['<rootDir>/tools/jest-summary-reporter.cjs'],
};

export default sharedConfig;
