import { scanSourceText } from './antiPatternsScanner';

describe('scanSourceText', () => {
    it('throws when sourceText contains parse errors', () => {
        expect(() => scanSourceText({ file: 'broken.ts', sourceText: 'const = ;' })).toThrow(
            /Failed to parse broken\.ts/
        );
    });

    it('parses TSX and still detects private probes', () => {
        const result = scanSourceText({
            file: 'inline.tsx',
            sourceText: 'const sutAny: any = sut; const el = <div />; sutAny._secret;',
        });

        expect(result.privateProbes).toHaveLength(1);
        expect(result.privateProbes[0]?.property).toBe('_secret');
    });

    it('flags underscore private probes through typed any receiver aliases', () => {
        const result = scanSourceText({
            file: 'inline.ts',
            sourceText: 'const sutAny: any = sut; sutAny._secret;',
        });

        expect(result.privateProbes).toHaveLength(1);
        expect(result.privateProbes[0]?.property).toBe('_secret');
    });

    it('flags timer calls through global receivers', () => {
        const result = scanSourceText({
            file: 'inline.ts',
            sourceText: 'globalThis.setTimeout(() => {}, 1); window.setInterval(() => {}, 1);',
        });

        expect(result.sleepProbes).toHaveLength(2);
        expect(result.sleepProbes.map((probe) => probe.kind)).toEqual(['timer-call', 'timer-call']);
    });

    it('assigns stable Jest scope ids and ordinals to sleep probes', () => {
        const result = scanSourceText({
            file: 'inline.test.ts',
            sourceText: `
                describe('outer scope', () => {
                    it('tracks stable ids', async () => {
                        setTimeout(() => undefined, 0);
                        await new Promise((resolve) => setTimeout(resolve, 0));
                    });
                });
            `,
        });

        expect(result.sleepProbes.map((probe) => probe.id)).toEqual([
            'inline.test.ts|timer-call|outer scope > tracks stable ids|1',
            'inline.test.ts|promise-timeout|outer scope > tracks stable ids|1',
            'inline.test.ts|timer-call|outer scope > tracks stable ids|2',
        ]);
    });

    it('falls back to named-function scope paths outside Jest structure', () => {
        const result = scanSourceText({
            file: 'helpers.ts',
            sourceText: `
                const waitForReady = async () => {
                    await new Promise((resolve) => setTimeout(resolve, 0));
                };
            `,
        });

        expect(result.sleepProbes.map((probe) => ({
            id: probe.id,
            scopePath: probe.scopePath,
            ordinal: probe.ordinal,
        }))).toEqual([
            {
                id: 'helpers.ts|promise-timeout|waitForReady|1',
                scopePath: 'waitForReady',
                ordinal: 1,
            },
            {
                id: 'helpers.ts|timer-call|waitForReady|1',
                scopePath: 'waitForReady',
                ordinal: 1,
            },
        ]);
    });
});
