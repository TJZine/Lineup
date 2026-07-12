import { readFileSync } from 'node:fs';
import path from 'node:path';

const workflow = readFileSync(path.resolve(process.cwd(), '.github/workflows/ci.yml'), 'utf8');

function position(fragment: string): number {
    const index = workflow.indexOf(fragment);
    expect(index).toBeGreaterThanOrEqual(0);
    return index;
}

describe('release candidate CI contract', () => {
    it('produces one lean analyzed candidate and verifies it before artifact transfer', () => {
        expect(workflow.match(/run: npm run build:analyze\s*$/gmu)).toHaveLength(1);
        expect(workflow).not.toMatch(/run: npm run build\s*$/gmu);
        expect(position('run: npm run build:analyze')).toBeLessThan(position('run: npm run verify:bundle -- --skip-build'));
        expect(position('run: npm run verify:bundle -- --skip-build')).toBeLessThan(position('run: rm dist/bundle-stats.json'));
        expect(position('run: rm dist/bundle-stats.json')).toBeLessThan(position('id: verify-candidate'));
        expect(position('id: verify-candidate')).toBeLessThan(position('name: lean-candidate'));
        expect(workflow).toContain('include-hidden-files: true');
    });

    it('transfers the exact candidate and makes package production required', () => {
        expect(workflow.match(/name: lean-candidate/gmu)).toHaveLength(2);
        expect(workflow).toContain('candidate-digest: ${{ steps.verify-candidate.outputs.digest }}');
        expect(workflow).toContain('echo "digest=$(node tools/verify-release-candidate.mjs --digest-only)" >> "$GITHUB_OUTPUT"');
        expect(workflow).toContain("--expected-digest '${{ needs.build.outputs.candidate-digest }}'");
        expect(workflow).toContain('npm install -g @webos-tools/cli@3.2.5');
        expect(workflow).toContain('run: command -v ares-package');
        expect(workflow).toContain('run: npm run package:webos:dist');
        expect(workflow).toContain('path: packages/*.ipk');
        expect(workflow).toContain('if-no-files-found: error');
        expect(workflow).not.toMatch(/hashFiles|Skipping packaging|WARNING: Failed/iu);
    });

    it('runs every accepted missing gate on Node 24', () => {
        for (const command of [
            'npm run test:tools',
            'npm run verify:maintainability',
            'npm run verify:bundle -- --skip-build',
        ]) {
            expect(workflow).toContain(command);
        }
        expect(workflow.match(/if: matrix\.node-version == '24\.14\.0'/gmu)?.length).toBeGreaterThanOrEqual(4);
    });
});
