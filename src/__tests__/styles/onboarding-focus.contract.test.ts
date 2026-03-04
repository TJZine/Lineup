/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string): string =>
    fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('onboarding focus style contract', () => {
    it('uses fill and glow for focused controls while preserving forced-colors outlines', () => {
        const css = read('src/styles/shell.css');

        expect(css).toMatch(/\.screen-button\.focused,[\s\S]*\.setup-toggle:focus-visible\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.16\);/s);
        expect(css).toMatch(/\.screen-button\.focused,[\s\S]*\.setup-toggle:focus-visible\s*\{[^}]*border-color:\s*rgba\(200,\s*160,\s*100,\s*0\.45\);/s);
        expect(css).toMatch(/\.screen-button\.focused,[\s\S]*\.setup-toggle:focus-visible\s*\{[^}]*box-shadow:\s*0\s+0\s+0\s+1px\s+rgba\(200,\s*160,\s*100,\s*0\.24\),\s*0\s+8px\s+24px\s+rgba\(200,\s*160,\s*100,\s*0\.16\);/s);
        expect(css).toMatch(/@media\s*\(forced-colors:\s*active\)/);
    });
});
