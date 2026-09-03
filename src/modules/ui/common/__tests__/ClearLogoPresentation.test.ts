import { isClearLogoUsable } from '../ClearLogoPresentation';

describe('isClearLogoUsable', () => {
    it.each([
        ['ordinary', 400, 120, 60, 200, true],
        ['minimum-height wide at 520px', 1300, 110, 72, 520, true],
        ['same wide logo at 400px', 1300, 110, 72, 400, false],
        ['unusably wide', 1200, 100, 84, 520, false],
        ['missing dimensions', 0, 0, 84, 520, false],
        ['missing rendered width', 400, 120, 60, 0, false],
    ])('%s clear logo', (_label, width, height, targetHeight, renderedWidth, expected) => {
        expect(isClearLogoUsable(width, height, targetHeight, renderedWidth)).toBe(expected);
    });
});
