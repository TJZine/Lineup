import { scanSourceText } from './antiPatternsScanner';

describe('scanSourceText', () => {
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
