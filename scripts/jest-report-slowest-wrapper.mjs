import { runJestReportSlowestWrapper } from './jest-report-slowest-wrapper-lib.mjs';

const surface = process.argv[2];
const configPath = process.argv[3];

if (!surface || !configPath) {
    console.error('Usage: node scripts/jest-report-slowest-wrapper.mjs <surface> <jest-config>');
    process.exit(1);
}

const exitCode = runJestReportSlowestWrapper({
    surface,
    configPath,
});

process.exit(exitCode);
