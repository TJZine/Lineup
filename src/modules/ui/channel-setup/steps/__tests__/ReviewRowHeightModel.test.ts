import { ReviewRowHeightModel } from '../ReviewRowHeightModel';

describe('ReviewRowHeightModel', () => {
    it('uses measured variable heights for prefixes and scroll lookup', () => {
        const model = new ReviewRowHeightModel();
        const ids = ['short', 'wrapped', 'expanded', 'tail'];
        model.measure('short', 64);
        model.measure('wrapped', 116);
        model.measure('expanded', 220);
        const offsets = model.offsets(ids);
        expect(offsets).toEqual([0, 64, 180, 400, 472]);
        expect(model.indexAt(offsets, 179)).toBe(1);
        expect(model.indexAt(offsets, 180)).toBe(2);
        expect(model.indexAt(offsets, 10000)).toBe(3);
    });

    it('invalidates measurements on width or disclosure change', () => {
        const model = new ReviewRowHeightModel();
        model.setWidth(800);
        model.measure('wrapped', 116);
        expect(model.offsets(['wrapped'])).toEqual([0, 116]);
        expect(model.setWidth(800)).toBe(false);
        model.forget('wrapped');
        expect(model.offsets(['wrapped'])).toEqual([0, 72]);
        model.measure('wrapped', 200);
        expect(model.setWidth(500)).toBe(true);
        expect(model.offsets(['wrapped'])).toEqual([0, 72]);
    });
});
