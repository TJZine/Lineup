import { readFileSync } from 'node:fs';
import path from 'node:path';

const workflow = readFileSync(path.resolve(process.cwd(), '.github/workflows/ci.yml'), 'utf8');

function getJobBlock(jobName: string): string {
    const header = new RegExp(`^  ${jobName}:\\s*$`, 'mu');
    const start = workflow.search(header);
    expect(start).toBeGreaterThanOrEqual(0);
    const remaining = workflow.slice(start + 1);
    const nextJobOffset = remaining.search(/^  [a-z0-9_-]+:\s*$/mu);
    return nextJobOffset < 0
        ? workflow.slice(start)
        : workflow.slice(start, start + 1 + nextJobOffset);
}

function position(block: string, fragment: string): number {
    const index = block.indexOf(fragment);
    expect(index).toBeGreaterThanOrEqual(0);
    return index;
}

const buildJob = getJobBlock('build');
const packageWebosJob = getJobBlock('package-webos');
const testJob = getJobBlock('test');
const lintJob = getJobBlock('lint');

describe('release candidate CI contract', () => {
    it('pins every external action to an immutable full commit SHA', () => {
        const actionReferences = Array.from(
            workflow.matchAll(/^\s*-?\s*uses:\s+([^\s#]+)(?:\s+#.*)?$/gmu),
            (match): string => {
                const reference = match[1];
                if (!reference) throw new Error('Matched action reference was empty');
                return reference;
            }
        );
        expect(actionReferences.length).toBeGreaterThan(0);
        for (const reference of actionReferences) {
            const [repository, sha, unexpectedPart] = reference.split('@');
            expect(unexpectedPart).toBeUndefined();
            expect(repository).toMatch(/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/iu);
            expect(sha).toHaveLength(40);
            expect(sha).toMatch(/^[a-f0-9]+$/u);
        }
    });

    it('produces one lean analyzed candidate and verifies it before artifact transfer', () => {
        expect(buildJob.match(/run: npm run build:analyze\s*$/gmu)).toHaveLength(1);
        expect(buildJob).not.toMatch(/run: npm run build\s*$/gmu);
        expect(position(buildJob, 'run: npm run build:analyze')).toBeLessThan(position(buildJob, 'run: npm run verify:bundle -- --skip-build'));
        expect(position(buildJob, 'run: npm run verify:bundle -- --skip-build')).toBeLessThan(position(buildJob, 'run: rm dist/bundle-stats.json'));
        expect(position(buildJob, 'run: rm dist/bundle-stats.json')).toBeLessThan(position(buildJob, 'id: verify-candidate'));
        expect(position(buildJob, 'id: verify-candidate')).toBeLessThan(position(buildJob, 'name: lean-candidate'));
        expect(buildJob).toContain('include-hidden-files: true');
    });

    it('transfers the exact candidate and makes package production required', () => {
        expect(buildJob.match(/name: lean-candidate/gmu)).toHaveLength(1);
        expect(packageWebosJob.match(/name: lean-candidate/gmu)).toHaveLength(1);
        expect(buildJob).toContain('candidate-digest: ${{ steps.verify-candidate.outputs.digest }}');
        expect(buildJob).toContain('echo "digest=$(node tools/verify-release-candidate.mjs --digest-only)" >> "$GITHUB_OUTPUT"');
        expect(packageWebosJob).toContain("--expected-digest '${{ needs.build.outputs.candidate-digest }}'");
        expect(packageWebosJob).toContain('npm install -g @webos-tools/cli@3.2.5');
        expect(packageWebosJob).toContain('run: command -v ares-package');
        expect(packageWebosJob).toContain('run: npm run package:webos:dist');
        expect(packageWebosJob).toContain('timeout-minutes: 10');
        expect(packageWebosJob).toContain('path: packages/*.ipk');
        expect(packageWebosJob).toContain('if-no-files-found: error');
        expect(`${buildJob}\n${packageWebosJob}`).not.toMatch(/hashFiles|Skipping packaging|WARNING: Failed/iu);
    });

    it('runs every accepted missing gate on Node 24', () => {
        for (const command of [
            'npm run test:tools',
            'npm run verify:maintainability',
            'npm run verify:bundle -- --skip-build',
        ]) {
            const owningJob = command === 'npm run verify:maintainability' ? lintJob
                : command === 'npm run test:tools' ? testJob
                    : buildJob;
            expect(owningJob).toContain(command);
        }
        expect(`${lintJob}\n${testJob}`.match(/if: matrix\.node-version == '24\.14\.0'/gmu)?.length).toBeGreaterThanOrEqual(4);
    });

    it('runs the package CLI regression suite on a real Windows runner', () => {
        const windowsJob = getJobBlock('package-tools-windows');
        expect(windowsJob).toContain('runs-on: windows-latest');
        expect(windowsJob).toContain('src/__tests__/tools/packageWebos.test.ts');
    });
});
