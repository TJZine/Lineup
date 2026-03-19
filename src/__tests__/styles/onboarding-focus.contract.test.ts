/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string): string =>
    fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('onboarding focus style contract', () => {
    it('uses fill and glow for focused controls while preserving forced-colors outlines', () => {
        const css = read('src/styles/shell.css');

        const focusRuleMatch = css.match(
            /\.screen-button\.focused,[\s\S]*?\.setup-toggle:focus-visible\s*\{([^}]*)\}/s
        );
        if (!focusRuleMatch) {
            throw new Error('Expected focus rule for .screen-button.focused and .setup-toggle:focus-visible');
        }

        const focusRuleBody = focusRuleMatch[1]!;
        expect(focusRuleBody).toMatch(
            /background:\s*var\(--onboarding-focus-bg,\s*rgba\(255,\s*255,\s*255,\s*0\.16\)\)\s*;/s
        );
        expect(focusRuleBody).toMatch(
            /border-color:\s*var\(--onboarding-accent-alpha-45,\s*rgba\(200,\s*160,\s*100,\s*0\.45\)\)\s*;/s
        );
        expect(focusRuleBody).toMatch(
            /0\s+0\s+0\s+1px\s+var\(--onboarding-accent-alpha-24,\s*rgba\(200,\s*160,\s*100,\s*0\.24\)\)/s
        );
        expect(focusRuleBody).toMatch(
            /0\s+8px\s+24px\s+var\(--onboarding-accent-alpha-16,\s*rgba\(200,\s*160,\s*100,\s*0\.16\)\)/s
        );
        expect(css).toMatch(/@media\s*\(forced-colors:\s*active\)/);
    });

    it('disables setup dropdown animation when reduced motion is requested', () => {
        const css = read('src/modules/ui/channel-setup/styles.css');

        expect(css).toMatch(/\.setup-dropdown\s*\{[\s\S]*animation:\s*setup-dropdown-enter 150ms ease-out both\s*;/s);

        const reducedMotionStart = css.lastIndexOf('@media (prefers-reduced-motion: reduce)');
        if (reducedMotionStart < 0) {
            throw new Error('Expected reduced-motion block in channel setup styles');
        }
        const reducedMotionBlock = css.slice(reducedMotionStart);

        expect(reducedMotionBlock).toMatch(/\.setup-dropdown\s*\{[\s\S]*animation:\s*none\s*;/s);
    });

    it('anchors setup dropdowns to a positioned setup body host', () => {
        const css = read('src/modules/ui/channel-setup/styles.css');

        expect(css).toMatch(/\.setup-body\s*\{[\s\S]*position:\s*relative\s*;/s);
        expect(css).toMatch(/\.setup-dropdown\s*\{[\s\S]*position:\s*absolute\s*;/s);
    });
});
