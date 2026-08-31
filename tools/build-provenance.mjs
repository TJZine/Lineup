import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
    lstatSync,
    mkdirSync,
    readFileSync,
    readlinkSync,
    writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BUILD_RELEVANT_PATHS = [
    'appinfo.json',
    'index.html',
    'package-lock.json',
    'package.json',
    'public',
    'src',
    'tools',
    'vite.config.ts',
];

function fail(message) {
    throw new Error(message);
}

function runGit(cwd, args, encoding = 'utf8') {
    const result = spawnSync('git', args, {
        cwd,
        encoding,
        maxBuffer: 64 * 1024 * 1024,
    });
    if (result.status !== 0) {
        const detail = Buffer.isBuffer(result.stderr)
            ? result.stderr.toString('utf8').trim()
            : String(result.stderr ?? '').trim();
        fail(`Git provenance command failed: git ${args.join(' ')}${detail ? ` (${detail})` : ''}`);
    }
    return result.stdout;
}

function getUntrackedBuildPaths(cwd) {
    const output = runGit(
        cwd,
        ['ls-files', '--others', '--exclude-standard', '-z', '--', ...BUILD_RELEVANT_PATHS]
    );
    return String(output)
        .split('\0')
        .filter(Boolean)
        .sort();
}

export function captureSourceProvenance(cwd = process.cwd()) {
    const gitHead = String(runGit(cwd, ['rev-parse', 'HEAD'])).trim();
    const relevantDirtySummary = String(runGit(
        cwd,
        ['status', '--short', '--untracked-files=all', '--', ...BUILD_RELEVANT_PATHS]
    )).trim();
    const trackedDiff = runGit(
        cwd,
        ['diff', '--binary', 'HEAD', '--', ...BUILD_RELEVANT_PATHS],
        null
    );
    const hash = createHash('sha256');
    hash.update(`git-head\0${gitHead}\0`);
    hash.update(trackedDiff);

    for (const relativePath of getUntrackedBuildPaths(cwd)) {
        const absolutePath = path.resolve(cwd, relativePath);
        const stat = lstatSync(absolutePath);
        hash.update(`untracked\0${relativePath}\0`);
        if (stat.isSymbolicLink()) {
            hash.update(`symlink\0${readlinkSync(absolutePath)}\0`);
        } else if (stat.isFile()) {
            hash.update(readFileSync(absolutePath));
        } else {
            fail(`Unsupported untracked build input: ${relativePath}`);
        }
    }

    return {
        schema_version: 1,
        git_head: gitHead,
        source_fingerprint_sha256: hash.digest('hex'),
        relevant_dirty_summary: relevantDirtySummary,
    };
}

export function writeBuildProvenance({
    cwd = process.cwd(),
    distDir = path.resolve(cwd, 'dist'),
    buildProfile,
}) {
    if (!buildProfile) {
        fail('Build provenance requires a build profile.');
    }
    const provenance = {
        ...captureSourceProvenance(cwd),
        build_profile: buildProfile,
    };
    mkdirSync(distDir, { recursive: true });
    writeFileSync(
        path.join(distDir, 'build-provenance.json'),
        `${JSON.stringify(provenance, null, 2)}\n`,
        'utf8'
    );
    return provenance;
}

function parseOptions(argv) {
    let distDir = path.resolve(process.cwd(), 'dist');
    let buildProfile = null;
    for (let index = 0; index < argv.length; index += 1) {
        const option = argv[index];
        const value = argv[index + 1];
        if (option === '--dist' && value) {
            distDir = path.resolve(process.cwd(), value);
            index += 1;
        } else if (option === '--profile' && value) {
            buildProfile = value;
            index += 1;
        } else {
            fail(`Unknown or incomplete build-provenance option: ${option}`);
        }
    }
    return { distDir, buildProfile };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    try {
        const options = parseOptions(process.argv.slice(2));
        writeBuildProvenance(options);
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}
