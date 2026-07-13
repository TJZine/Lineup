import crossSpawn from 'cross-spawn';
import { existsSync, lstatSync, mkdirSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyReleaseCandidate } from './verify-release-candidate.mjs';

function fail(message) {
    throw new Error(message);
}

function parseOptions(argv) {
    const options = {
        aresPackage: 'ares-package',
        distDir: path.resolve(process.cwd(), 'dist'),
        outputDir: path.resolve(process.cwd(), 'packages'),
    };
    const valueOptions = new Map([
        ['--ares-package', 'aresPackage'],
        ['--dist-dir', 'distDir'],
        ['--output-dir', 'outputDir'],
    ]);
    for (let index = 0; index < argv.length; index += 1) {
        const option = argv[index];
        const key = valueOptions.get(option);
        if (key === undefined) {
            fail(`Unknown package-webos option: ${option}`);
        }
        const value = argv[index + 1];
        if (value === undefined) {
            fail(`Missing value for ${option}.`);
        }
        options[key] = key === 'aresPackage' ? value : path.resolve(process.cwd(), value);
        index += 1;
    }
    return options;
}

function expectedPackageName(appInfo) {
    const safeComponent = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
    if (!safeComponent.test(appInfo.id) || !safeComponent.test(appInfo.version)) {
        fail('appinfo.json id and version must be safe IPK filename components.');
    }
    return `${appInfo.id}_${appInfo.version}_all.ipk`;
}

function canonicalizePotentialPath(inputPath) {
    const missingSegments = [];
    let existingPath = path.resolve(inputPath);
    while (!existsSync(existingPath)) {
        const parentPath = path.dirname(existingPath);
        if (parentPath === existingPath) {
            fail(`Cannot find an existing parent for path: ${inputPath}`);
        }
        missingSegments.unshift(path.basename(existingPath));
        existingPath = parentPath;
    }
    return path.resolve(realpathSync(existingPath), ...missingSegments);
}

function isWithinOrEqual(parentPath, childPath) {
    const relative = path.relative(parentPath, childPath);
    return relative === '' || (
        relative !== '..' &&
        !relative.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relative)
    );
}

export function packageWebos({ aresPackage, distDir, outputDir }) {
    const candidate = verifyReleaseCandidate(distDir);
    const expectedName = expectedPackageName(candidate.appInfo);
    const canonicalCandidateDir = canonicalizePotentialPath(distDir);
    const canonicalOutputDir = canonicalizePotentialPath(outputDir);
    if (
        isWithinOrEqual(canonicalCandidateDir, canonicalOutputDir) ||
        isWithinOrEqual(canonicalOutputDir, canonicalCandidateDir)
    ) {
        fail('Candidate and package output directories must not overlap.');
    }

    if (existsSync(outputDir)) {
        const stat = lstatSync(outputDir);
        if (!stat.isDirectory() || stat.isSymbolicLink()) {
            fail(`Package output must be a real directory: ${outputDir}`);
        }
        const existingEntries = readdirSync(outputDir);
        const unexpectedEntries = existingEntries.filter((entry) => entry !== expectedName);
        if (unexpectedEntries.length > 0) {
            fail(`Package output directory contains unexpected entries: ${unexpectedEntries.sort().join(', ')}`);
        }
        const previousPackagePath = path.join(outputDir, expectedName);
        if (existsSync(previousPackagePath)) {
            const previousPackageStat = lstatSync(previousPackagePath);
            if (!previousPackageStat.isFile() || previousPackageStat.isSymbolicLink()) {
                fail(`Previous package output is not a regular file: ${previousPackagePath}`);
            }
            rmSync(previousPackagePath);
        }
    }
    mkdirSync(outputDir, { recursive: true });

    const result = crossSpawn.sync(aresPackage, [distDir, '-o', outputDir], {
        encoding: 'utf8',
        windowsHide: true,
    });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    if (result.error instanceof Error) {
        fail(`Failed to run ares-package: ${result.error.message}`);
    }
    if (result.status !== 0) {
        fail(`ares-package failed with exit code ${result.status}\n${output}`);
    }

    const entries = readdirSync(outputDir).sort();
    if (entries.length === 0) {
        fail(`ares-package produced no output in ${outputDir}`);
    }
    if (entries.length !== 1 || entries[0] !== expectedName) {
        fail(`ares-package produced unexpected output; expected only ${expectedName}, found: ${entries.join(', ')}`);
    }
    const packagePath = path.join(outputDir, expectedName);
    const packageStat = lstatSync(packagePath);
    if (!packageStat.isFile() || packageStat.isSymbolicLink() || packageStat.size === 0) {
        fail(`ares-package output is not a nonempty regular file: ${packagePath}`);
    }

    const packagedCandidate = verifyReleaseCandidate(distDir);
    if (packagedCandidate.digest !== candidate.digest) {
        fail('ares-package mutated the verified release candidate.');
    }

    console.log(`Candidate tree SHA-256: ${candidate.digest}`);
    console.log(`webOS package: ${packagePath}`);
    return packagePath;
}

function main() {
    packageWebos(parseOptions(process.argv.slice(2)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    try {
        main();
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}
