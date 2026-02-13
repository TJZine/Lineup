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
});
