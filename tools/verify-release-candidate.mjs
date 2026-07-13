import { createHash } from 'node:crypto';
import {
    lstatSync,
    readFileSync,
    realpathSync,
    readdirSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FORBIDDEN_FILE_NAMES = new Set(['bundle-stats.json']);
const SOURCE_FILE_PATTERN = /\.(?:[cm]?ts|tsx|jsx)$/iu;
const SOURCE_MAP_PATTERN = /\.map$/iu;
const SOURCE_MAP_REFERENCE_PATTERN = /(?:\/\/[#@]|\/\*[#@])\s*sourceMappingURL\s*=/iu;
const TEXT_ASSET_PATTERN = /\.(?:css|html?|js|mjs|cjs)$/iu;
const UNEXPANDED_BUILD_MARKER_PATTERN = /__(?:LINEUP_BUILD_PROFILE|LINEUP_DEV_BUILD)__/u;

function fail(message) {
    throw new Error(message);
}

function parseOptions(argv) {
    const options = {
        digestOnly: false,
        distDir: path.resolve(process.cwd(), 'dist'),
        expectedDigest: null,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const option = argv[index];
        if (option === '--digest-only') {
            options.digestOnly = true;
            continue;
        }
        if (option !== '--dist-dir' && option !== '--expected-digest') {
            fail(`Unknown candidate verifier option: ${option}`);
        }
        const value = argv[index + 1];
        if (value === undefined) {
            fail(`Missing value for ${option}.`);
        }
        if (option === '--dist-dir') {
            options.distDir = path.resolve(process.cwd(), value);
        } else {
            if (!/^[a-f0-9]{64}$/iu.test(value)) {
                fail('Expected candidate digest must be exactly 64 hexadecimal characters.');
            }
            options.expectedDigest = value.toLowerCase();
        }
        index += 1;
    }

    return options;
}

function readAppInfo(appInfoPath) {
    let appInfo;
    try {
        appInfo = JSON.parse(readFileSync(appInfoPath, 'utf8'));
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        fail(`Invalid appinfo.json: ${message}`);
    }
    if (typeof appInfo !== 'object' || appInfo === null || Array.isArray(appInfo)) {
        fail('Invalid appinfo.json: expected a JSON object.');
    }
    for (const field of ['id', 'version', 'main']) {
        if (typeof appInfo[field] !== 'string' || appInfo[field].trim() === '') {
            fail(`Invalid appinfo.json: ${field} must be a nonempty string.`);
        }
    }
    return appInfo;
}

function resolveCandidatePath(distDir, relativePath, description) {
    if (path.isAbsolute(relativePath)) {
        fail(`${description} must be relative to the candidate root: ${relativePath}`);
    }
    const resolved = path.resolve(distDir, relativePath);
    const relative = path.relative(distDir, resolved);
    if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
        fail(`${description} escapes the candidate root: ${relativePath}`);
    }
    return resolved;
}

function collectFiles(distDir) {
    let rootStat;
    try {
        rootStat = lstatSync(distDir);
    } catch {
        fail(`Candidate directory does not exist: ${distDir}`);
    }
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
        fail(`Candidate root must be a real directory: ${distDir}`);
    }

    const canonicalRoot = realpathSync(distDir);
    const files = [];
    const queue = [''];
    while (queue.length > 0) {
        const relativeDirectory = queue.shift();
        const directoryPath = path.join(distDir, relativeDirectory);
        const entries = readdirSync(directoryPath, { withFileTypes: true })
            .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
        for (const entry of entries) {
            const relativePath = path.posix.join(
                relativeDirectory.replaceAll(path.sep, '/'),
                entry.name
            );
            const fullPath = path.join(directoryPath, entry.name);
            const stat = lstatSync(fullPath);
            if (stat.isSymbolicLink()) {
                fail(`Candidate contains a symbolic link: ${relativePath}`);
            }
            const canonicalPath = realpathSync(fullPath);
            if (canonicalPath !== canonicalRoot && !canonicalPath.startsWith(`${canonicalRoot}${path.sep}`)) {
                fail(`Candidate path escapes its root: ${relativePath}`);
            }
            if (stat.isDirectory()) {
                queue.push(relativePath);
            } else if (stat.isFile()) {
                files.push({ fullPath, relativePath, size: stat.size });
            } else {
                fail(`Candidate contains a non-file entry: ${relativePath}`);
            }
        }
    }
    return files.sort((left, right) => (
        left.relativePath < right.relativePath ? -1 : left.relativePath > right.relativePath ? 1 : 0
    ));
}

export function verifyReleaseCandidate(distDir) {
    const resolvedDistDir = path.resolve(distDir);
    const files = collectFiles(resolvedDistDir);
    if (files.length === 0) {
        fail(`Candidate contains no files: ${resolvedDistDir}`);
    }

    const filesByPath = new Map(files.map((file) => [file.relativePath, file]));
    const appInfoFile = filesByPath.get('appinfo.json');
    if (appInfoFile === undefined) {
        fail('Candidate is missing appinfo.json.');
    }
    const appInfo = readAppInfo(appInfoFile.fullPath);
    const mainPath = path.relative(
        resolvedDistDir,
        resolveCandidatePath(resolvedDistDir, appInfo.main, 'appinfo.json main')
    ).replaceAll(path.sep, '/');
    if (!filesByPath.has(mainPath)) {
        fail(`Candidate is missing its declared main entry: ${appInfo.main}`);
    }
    if (files.length < 3) {
        fail('Candidate must contain appinfo.json, its main entry, and at least one app asset.');
    }

    const hash = createHash('sha256');
    for (const file of files) {
        if (FORBIDDEN_FILE_NAMES.has(path.posix.basename(file.relativePath))) {
            fail(`Candidate contains analyzer metadata: ${file.relativePath}`);
        }
        if (SOURCE_MAP_PATTERN.test(file.relativePath)) {
            fail(`Candidate contains a source map: ${file.relativePath}`);
        }
        if (SOURCE_FILE_PATTERN.test(file.relativePath)) {
            fail(`Candidate contains a raw source file: ${file.relativePath}`);
        }

        const contents = readFileSync(file.fullPath);
        if (TEXT_ASSET_PATTERN.test(file.relativePath) && SOURCE_MAP_REFERENCE_PATTERN.test(contents.toString('utf8'))) {
            fail(`Candidate contains a source-map reference: ${file.relativePath}`);
        }
        if (TEXT_ASSET_PATTERN.test(file.relativePath) && UNEXPANDED_BUILD_MARKER_PATTERN.test(contents.toString('utf8'))) {
            fail(`Candidate contains an unexpanded build-profile marker: ${file.relativePath}`);
        }
        const pathBytes = Buffer.from(file.relativePath, 'utf8');
        const framing = Buffer.allocUnsafe(12);
        framing.writeUInt32BE(pathBytes.length, 0);
        framing.writeBigUInt64BE(BigInt(contents.length), 4);
        hash.update(framing);
        hash.update(pathBytes);
        hash.update(contents);
    }

    return { appInfo, digest: hash.digest('hex'), files };
}

function main() {
    const { digestOnly, distDir, expectedDigest } = parseOptions(process.argv.slice(2));
    const result = verifyReleaseCandidate(distDir);
    if (expectedDigest !== null && result.digest !== expectedDigest) {
        fail(`Candidate tree SHA-256 mismatch: expected ${expectedDigest}, got ${result.digest}.`);
    }
    if (digestOnly) {
        console.log(result.digest);
        return;
    }
    console.log(`Candidate tree SHA-256: ${result.digest}`);
    console.log(`verify:release-candidate PASS (${result.files.length} files)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    try {
        main();
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}
