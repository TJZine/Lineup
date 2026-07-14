import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ATTENTION_LINE_THRESHOLD = 500;
export const REVIEW_LINE_THRESHOLD = 800;

const PRODUCTION_EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.html']);

function normalizeRepoPath(filePath) {
    return filePath.replace(/\\/gu, '/').replace(/^\.\//u, '');
}

export function isProductionSourcePath(relativePath) {
    const normalized = normalizeRepoPath(relativePath);
    const segments = normalized.split('/');
    return (
        normalized.startsWith('src/') &&
        !segments.includes('__tests__') &&
        !path.posix.basename(normalized).includes('.test.') &&
        PRODUCTION_EXTENSIONS.has(path.posix.extname(normalized))
    );
}

export function countLogicalLines(content) {
    if (content.length === 0) return 0;
    const normalized = content.replace(/\r\n?/gu, '\n');
    return normalized.endsWith('\n')
        ? normalized.slice(0, -1).split('\n').length
        : normalized.split('\n').length;
}

function walkFiles(directory, repoRoot, files) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            walkFiles(fullPath, repoRoot, files);
        } else if (entry.isFile()) {
            files.push(normalizeRepoPath(path.relative(repoRoot, fullPath)));
        }
    }
}

export function collectProductionLineCounts(repoRoot) {
    const srcRoot = path.join(repoRoot, 'src');
    if (!existsSync(srcRoot)) return [];

    const paths = [];
    walkFiles(srcRoot, repoRoot, paths);
    return paths
        .filter(isProductionSourcePath)
        .sort((left, right) => left.localeCompare(right))
        .map((relativePath) => ({
            path: relativePath,
            lines: countLogicalLines(readFileSync(path.join(repoRoot, relativePath), 'utf8')),
        }));
}

export function collectArchitectureAttention(repoRoot) {
    return collectProductionLineCounts(repoRoot)
        .filter(({ lines }) => lines > ATTENTION_LINE_THRESHOLD)
        .map((file) => ({
            ...file,
            reviewRequired: file.lines > REVIEW_LINE_THRESHOLD,
        }));
}

export function parseCliArgs(argv) {
    let repoRoot = process.cwd();
    let details = false;
    for (let index = 0; index < argv.length; index += 1) {
        if (argv[index] === '--details') {
            details = true;
        } else if (argv[index] !== '--root') {
            throw new Error(`Unknown verify-maintainability option: ${argv[index]}`);
        } else {
            const value = argv[index + 1];
            if (value === undefined) throw new Error('Missing value for --root.');
            repoRoot = path.resolve(value);
            index += 1;
        }
    }
    return { details, repoRoot };
}

function runCli() {
    try {
        const { details, repoRoot } = parseCliArgs(process.argv.slice(2));
        const files = collectArchitectureAttention(repoRoot);
        if (files.length === 0) {
            console.log('Architecture attention report: no production files exceed 500 lines.');
            return;
        }

        const reviewCount = files.filter((file) => file.reviewRequired).length;
        console.log(
            `Architecture attention report: ${files.length} production files over 500 lines; ` +
            `${reviewCount} over 800 (review signals, not extraction requirements).`
        );
        if (!details) return;

        for (const file of files) {
            const action = file.reviewRequired
                ? 'fresh architecture review required when changed'
                : 'architecture disposition required when changed';
            console.log(`- ${file.path}: ${file.lines} lines (${action})`);
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Maintainability evidence failed: ${message}`);
        process.exitCode = 1;
    }
}

const entryPoint = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entryPoint === fileURLToPath(import.meta.url)) runCli();
